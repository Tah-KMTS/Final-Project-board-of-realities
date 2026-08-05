import { useEffect, useState } from 'react'

// Pokemon-style battle presentation for police confrontations.
//
// PURE PRESENTATION - it owns no combat state. Three police-flavored fights
// in the game render through here, each its own engine:
//   - Finance's PoliceStopModal -> FinanceSkirmishModal (4-choice
//     Attack/Heavy/Guard/Dodge, stamina-gated, simultaneous reveal)
//   - Finance's PoliceStopModal "Fight" choice -> PoliceFightModal
//     (Punch/Kick/Use Weapon/Special Move, see policeFightEngine.js)
//   - Hunter's policeEncounter -> RiftCombatModal (stat-based chip damage,
//     Attack/Flee plus situational Meteor/Umbrella)
// None of the three changed to get this skin. That's why actions are passed
// in as a list rather than hardcoded, why the stamina pips and status badges
// are optional (the Rift engine has no such concepts and simply omits them),
// and why enemySpriteKey/playerSpriteKey exist (PoliceFightModal needs more
// poses - ready/attack/down/tactical - than the other two engines' plain
// acting/idle binary requires; they just omit the props and get that binary
// unchanged).
//
// Layout mirrors the GBA reference: enemy status top-left with the enemy
// sprite opposite it, player back sprite bottom-left with the player status
// bottom-right, and a message box + command grid across the bottom. Sprites
// come from public/assets/packs/police-battle/ (cut out of the reference
// sheets in packs/police fighting/); each already carries its own baked
// ground platform, which is why nothing here draws one.

const SPRITES = '/assets/packs/police-battle'

// Matches the reference sheet's HP bar states: green healthy, yellow low,
// red critical.
function hpColor(ratio) {
  if (ratio > 0.5) return '#5cd65c'
  if (ratio > 0.2) return '#f5c518'
  return '#e04040'
}

// Flips a side to its "command" pose for a beat whenever that side lands a
// hit, so a turn reads as somebody doing something rather than two statues
// swapping HP. Driven off the hit-pulse counters both engines already bump -
// no new combat state.
function useActingPose(hitPulseOnOpponent) {
  const [acting, setActing] = useState(false)
  useEffect(() => {
    if (!hitPulseOnOpponent) return undefined
    setActing(true)
    const t = setTimeout(() => setActing(false), 550)
    return () => clearTimeout(t)
  }, [hitPulseOnOpponent])
  return acting
}

function StatusBox({ name, hp, maxHp, stamina, boost, stunned, showNumbers, tint }) {
  const ratio = maxHp > 0 ? Math.max(0, hp / maxHp) : 0
  return (
    <div
      className="border-[3px] border-[#2f2f38] px-2 py-1 shadow-[3px_3px_0_rgba(0,0,0,0.45)]"
      style={{ background: tint, minWidth: 168 }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold tracking-wide text-[#22222a]">{name}</span>
        {typeof stamina === 'number' && (
          <span className="text-[9px] text-[#4a4a55]">
            {'●'.repeat(stamina)}
            <span className="text-[#b9b9c4]">{'○'.repeat(Math.max(0, 3 - stamina))}</span>
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-1">
        <span className="bg-[#e8a020] px-1 text-[8px] font-bold text-white">HP</span>
        <div className="h-[7px] flex-1 border border-[#2f2f38] bg-[#3a3a44]">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${ratio * 100}%`, background: hpColor(ratio) }}
          />
        </div>
      </div>
      {showNumbers && (
        <div className="mt-0.5 text-right text-[10px] font-bold text-[#22222a]">
          {Math.max(0, hp)}/{maxHp}
        </div>
      )}
      {(boost || stunned) && (
        <div className="mt-0.5 flex gap-1 text-[8px] font-bold">
          {boost && <span className="bg-[#7b3fbf] px-1 text-white">COUNTER</span>}
          {stunned && <span className="bg-[#c07000] px-1 text-white">STAGGERED</span>}
        </div>
      )}
    </div>
  )
}

export default function PokeBattleLayout({
  title,
  subtitle,
  enemyName,
  enemyHp,
  enemyMaxHp,
  playerName,
  playerHp,
  playerMaxHp,
  // Optional - the Rift engine has neither, and omitting them hides the pips
  // and badges rather than rendering empty ones.
  playerStamina,
  enemyStamina,
  playerBoost,
  enemyBoost,
  playerStunned,
  enemyStunned,
  log,
  outcome,
  victoryText,
  defeatText,
  // [{ key, label, onClick, disabled, costsStamina }] - rendered into the 2x2
  // command grid in order.
  actions,
  retreat,
  onContinue,
  enemyHitPulse,
  playerHitPulse,
  enemyFloats,
  playerFloats,
  // Optional explicit sprite basenames (no .png), e.g. 'officer_attack' or
  // 'player_crouch' - PoliceFightModal's punch/kick/weapon/special moves and
  // guard/down states need more poses than the plain acting/idle binary
  // below can express. Omitted by both existing callers (FinanceSkirmishModal,
  // RiftCombatModal), which keep exactly the old officer_front/officer_command
  // and player_back/player_command behavior.
  enemySpriteKey,
  playerSpriteKey,
}) {
  // Both engines keep a rolling log; the message box shows its tail, the way
  // the reference shows the last couple of lines rather than a scrollback.
  const recent = log.slice(-2)
  // A hit landing on the enemy means the PLAYER acted, and vice versa.
  const playerActing = useActingPose(enemyHitPulse)
  const enemyActing = useActingPose(playerHitPulse)
  const anyCostsStamina = actions.some((a) => a.costsStamina)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3">
      <div className="flex max-h-[94vh] w-[720px] max-w-full flex-col border-4 border-[#2f2f38] bg-[#101018] font-mono shadow-[0_0_0_3px_rgba(0,0,0,0.6)]">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b-[3px] border-[#2f2f38] bg-[#1c1d3a] px-3 py-1">
          <span className="text-[12px] font-bold text-blue-300">{title}</span>
          {subtitle && <span className="text-right text-[9px] text-yellow-300">{subtitle}</span>}
        </div>

        {/* --- arena --- */}
        {/* Height is keyed off viewport HEIGHT (not Tailwind's width
            breakpoints) so a short window shrinks the picture instead of
            pushing the command buttons off the bottom. */}
        <div
          className="relative h-[186px] shrink-0 overflow-hidden [@media(min-height:700px)]:h-[248px]"
          style={{ background: 'linear-gradient(180deg,#241a3a 0%,#3a2450 45%,#6b3a5e 100%)' }}
        >
          {/* Ground band, angled the way the reference's arena is, so the
              sprites' baked platforms sit on something rather than floating in
              a flat gradient. */}
          <div
            className="absolute inset-x-0 bottom-0 h-[46%] bg-[#241b30]/75"
            style={{ clipPath: 'polygon(0 22%, 100% 0, 100% 100%, 0 100%)' }}
          />

          <div className="absolute left-3 top-3 z-10">
            <StatusBox
              name={enemyName}
              hp={enemyHp}
              maxHp={enemyMaxHp}
              stamina={enemyStamina}
              boost={enemyBoost}
              stunned={enemyStunned}
              showNumbers={false}
              tint="#f7e9e9"
            />
          </div>
          <div key={`enemy-${enemyHitPulse}`} className="animate-shake absolute right-8 top-1">
            <img
              src={`${SPRITES}/${enemySpriteKey || (enemyActing ? 'officer_command' : 'officer_front')}.png`}
              alt=""
              className="h-[118px] w-auto [@media(min-height:700px)]:h-[152px]"
              style={{ imageRendering: 'pixelated' }}
            />
            {enemyFloats.map((f) => (
              <span
                key={f.id}
                className="animate-float-up-fade pointer-events-none absolute -top-1 right-2 text-lg font-bold text-red-400 drop-shadow-[1px_1px_0_#000]"
              >
                {f.text}
              </span>
            ))}
          </div>

          {/* Player sprite is bottom-anchored and a touch larger than the
              enemy, the way a back sprite reads as nearer the camera. */}
          <div key={`player-${playerHitPulse}`} className="animate-shake absolute bottom-0 left-4">
            <img
              src={`${SPRITES}/${playerSpriteKey || (playerActing ? 'player_command' : 'player_back')}.png`}
              alt=""
              className="h-[132px] w-auto [@media(min-height:700px)]:h-[178px]"
              style={{ imageRendering: 'pixelated' }}
            />
            {playerFloats.map((f) => (
              <span
                key={f.id}
                className="animate-float-up-fade pointer-events-none absolute -top-1 right-0 text-lg font-bold text-red-400 drop-shadow-[1px_1px_0_#000]"
              >
                {f.text}
              </span>
            ))}
          </div>
          <div className="absolute bottom-2 right-3 z-10">
            <StatusBox
              name={playerName}
              hp={playerHp}
              maxHp={playerMaxHp}
              stamina={playerStamina}
              boost={playerBoost}
              stunned={playerStunned}
              showNumbers
              tint="#f6f6ee"
            />
          </div>
        </div>

        {/* --- message + commands --- */}
        <div className="flex min-h-0 flex-1 border-t-[3px] border-[#2f2f38]">
          <div className="flex min-h-[92px] flex-1 flex-col justify-center border-r-[3px] border-[#2f2f38] bg-[#f6f6ee] px-3 py-2">
            {outcome === 'victory' ? (
              <p className="text-[13px] font-bold text-[#1a7a1a]">{victoryText}</p>
            ) : outcome === 'defeat' ? (
              <p className="text-[12px] font-bold text-[#a01818]">{defeatText}</p>
            ) : (
              recent.map((line, i) => (
                <p key={i} className="text-[12px] leading-snug text-[#22222a]">
                  {line}
                </p>
              ))
            )}
          </div>

          <div className="w-[292px] shrink-0 bg-[#f6f6ee] p-2">
            {!outcome ? (
              <>
                {/* The Rift engine can offer a single action (plain ATTACK,
                    with Meteor/Umbrella only situationally available), and a
                    lone button in a 2-column grid reads as a broken layout. */}
                <div className={`grid gap-1.5 ${actions.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {actions.map((a) => (
                    <button
                      key={a.key}
                      onClick={a.onClick}
                      disabled={a.disabled}
                      className="group border-[3px] border-[#2f2f38] bg-[#f6f6ee] px-2 py-2 text-left text-[13px] font-bold text-[#22222a] transition-colors hover:bg-[#fffbe0] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="mr-1 text-[#c02020] opacity-0 group-hover:opacity-100" aria-hidden="true">
                        {'▶'}
                      </span>
                      {a.label}
                      {a.costsStamina && <span className="ml-1 text-[9px] font-normal text-[#c06000]">●</span>}
                    </button>
                  ))}
                </div>
                {retreat && (
                  <button
                    onClick={retreat.onClick}
                    disabled={retreat.disabled}
                    className="mt-1.5 w-full border-[3px] border-[#2f2f38] bg-[#e6e6dc] px-2 py-1 text-[11px] font-bold text-[#22222a] hover:bg-[#fffbe0] disabled:opacity-40"
                  >
                    {retreat.label}
                  </button>
                )}
                {anyCostsStamina && (
                  <p className="mt-1 text-center text-[8px] text-[#6a6a75]">{'●'} costs stamina</p>
                )}
              </>
            ) : (
              <button
                onClick={onContinue}
                className="h-full w-full border-[3px] border-[#2f2f38] bg-[#ffd84d] text-[15px] font-bold text-[#22222a] hover:bg-[#ffe680]"
              >
                CONTINUE
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
