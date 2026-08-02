import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { playHitSound, playTakeDamageSound, playVictorySound, playDefeatSound } from '../../audio/sfx'
import { MOVE_LABELS, resolveMatchup, payMoveCost, pickAiMove } from './financeSkirmishEngine'

// Finance world's 4-choice discrete-move combat: Attack / Heavy / Guard /
// Dodge, simultaneous reveal, stamina-gated. This is a deliberately
// different combat model from Hunter's Rift's stat-based chip-damage engine
// (RiftCombatModal.jsx) - do not merge them. Used ONLY for:
//   - PoliceStopModal.jsx's combat phase (street-level police stops)
//   - WorldScreen.jsx's financeCombat/ambientCombat (bodyguard fights /
//     street-target skirmishes)
// Hunter's Rift keeps RiftCombatModal for its own rift/police/finalRaid
// encounters untouched.
//
// Same modal contract as every other combat/mini-game in this codebase:
// { onClose, onVictory, onDefeat }. This component never closes itself on
// an outcome - the outcome screen's "Continue" button is the only thing
// that calls onVictory/onDefeat, then onClose, exactly like RiftCombatModal.
//
// All pure combat-math (damage matrix, stamina/whiff-fatigue cost, AI move
// selection, getPoliceReadProbability) lives in ./financeSkirmishEngine.js,
// not in this file - keeping every non-component value out of this module
// is what lets Vite's React Fast Refresh treat it as a clean component
// boundary (a file that exports a non-component alongside a component can't
// be hot-patched and forces a full page reload on every edit instead).

let floatingTextSeq = 0

export default function FinanceSkirmishModal({
  monster,
  title = 'Skirmish',
  // 0 for Underworld street fights (flat uniform-random AI). Police stops
  // pass getPoliceReadProbability(wantedLevel).
  readProbability = 0,
  onClose,
  onVictory,
  onDefeat,
}) {
  const player = useGameStore((s) => s.player)
  const takeFinanceCombatDamage = useGameStore((s) => s.takeFinanceCombatDamage)

  const [monsterHp, setMonsterHp] = useState(monster.hp)
  const [log, setLog] = useState([`${monster.name} squares up. Pick your move.`])
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState(null) // null | 'victory' | 'defeat'

  const [playerStamina, setPlayerStamina] = useState(3)
  const [monsterStamina, setMonsterStamina] = useState(3)
  const [playerBoost, setPlayerBoost] = useState(false)
  const [monsterBoost, setMonsterBoost] = useState(false)
  const [lastPlayerMove, setLastPlayerMove] = useState(null)
  const [turnCount, setTurnCount] = useState(0)

  const [monsterFloats, setMonsterFloats] = useState([])
  const [playerFloats, setPlayerFloats] = useState([])
  const [monsterHitPulse, setMonsterHitPulse] = useState(0)
  const [playerHitPulse, setPlayerHitPulse] = useState(0)

  const appendLog = (line) => setLog((prev) => [...prev.slice(-5), line])

  const spawnFloat = (setFloats, text) => {
    const id = ++floatingTextSeq
    setFloats((prev) => [...prev, { id, text }])
    setTimeout(() => setFloats((prev) => prev.filter((f) => f.id !== id)), 700)
  }

  const handleMove = (playerMove) => {
    if (busy || outcome) return
    if ((playerMove === 'heavy' || playerMove === 'dodge') && playerStamina < 1) return
    setBusy(true)
    appendLog(`You commit to ${MOVE_LABELS[playerMove]}...`)

    setTimeout(() => {
      const turnNumber = turnCount + 1
      const { move: aiMove, wasRead } = pickAiMove({
        turnNumber,
        lastPlayerMove,
        aiStamina: monsterStamina,
        readProbability,
      })

      const matchup = resolveMatchup(playerMove, aiMove)
      let dmgToPlayer = matchup.dmg1
      let dmgToMonster = matchup.dmg2

      // Counter Boost (armed by a Dodge that beat Attack/Heavy last turn):
      // multiplies the damage THAT side deals this turn, then is consumed
      // regardless of whether it actually landed.
      if (monsterBoost && dmgToPlayer > 0) dmgToPlayer = Math.round(dmgToPlayer * 1.5)
      if (playerBoost && dmgToMonster > 0) dmgToMonster = Math.round(dmgToMonster * 1.5)
      const playerBoostConsumed = playerBoost
      const monsterBoostConsumed = monsterBoost

      const playerCost = payMoveCost(playerMove, aiMove, playerStamina)
      const monsterCost = payMoveCost(aiMove, playerMove, monsterStamina)
      dmgToPlayer += playerCost.chipDamage
      dmgToMonster += monsterCost.chipDamage

      // Regen only fires for a side that spent ZERO stamina this turn -
      // otherwise a side paying 1 stamina every turn (sustained Heavy/Dodge,
      // or repeated whiffed Attacks) would have that cost fully cancelled by
      // regen every single turn and could never actually run out. A side
      // that paid stamina carries its post-cost value into next turn
      // unchanged (no +1); a side that paid nothing regens as normal.
      const playerPaidStamina = playerCost.staminaAfterCost < playerStamina
      const monsterPaidStamina = monsterCost.staminaAfterCost < monsterStamina

      const newPlayerStamina = playerPaidStamina
        ? playerCost.staminaAfterCost
        : Math.min(3, playerCost.staminaAfterCost + 1)
      const newMonsterStamina = monsterPaidStamina
        ? monsterCost.staminaAfterCost
        : Math.min(3, monsterCost.staminaAfterCost + 1)

      // --- Log lines ---
      if (wasRead) appendLog(`${monster.name} reads your last move and reacts with ${MOVE_LABELS[aiMove]}!`)
      if (matchup.knockdown) {
        appendLog(`Both sides trade Heavy Strikes - a bone-jarring knockdown clash!`)
      } else if (dmgToMonster > 0 && dmgToPlayer > 0) {
        appendLog(`You both connect - ${dmgToMonster} to ${monster.name}, ${dmgToPlayer} to you.`)
      } else if (dmgToMonster > 0) {
        appendLog(`Your ${MOVE_LABELS[playerMove]} beats their ${MOVE_LABELS[aiMove]} - ${dmgToMonster} damage!`)
      } else if (dmgToPlayer > 0) {
        appendLog(`Their ${MOVE_LABELS[aiMove]} beats your ${MOVE_LABELS[playerMove]} - you take ${dmgToPlayer} damage!`)
      } else {
        appendLog(`Your ${MOVE_LABELS[playerMove]} and their ${MOVE_LABELS[aiMove]} cancel out - no damage.`)
      }
      if (playerCost.whiffed) appendLog('Overextended and exposed - you eat 5 bonus damage!')
      if (monsterCost.whiffed) appendLog(`${monster.name} is overextended and exposed - takes 5 bonus damage!`)
      if (matchup.arm1) appendLog('You dodge clean and prime a Counter Boost for next turn!')
      if (matchup.arm2) appendLog(`${monster.name} dodges clean and primes a counter!`)
      if (playerBoostConsumed && dmgToMonster > matchup.dmg2) appendLog('Your Counter Boost detonates for extra damage!')
      else if (playerBoostConsumed) appendLog('Your primed Counter Boost goes unused this turn.')
      if (monsterBoostConsumed && dmgToPlayer > matchup.dmg1) appendLog(`${monster.name}'s Counter Boost detonates!`)

      const newMonsterHp = Math.max(0, monsterHp - dmgToMonster)
      setMonsterHp(newMonsterHp)
      if (dmgToMonster > 0) {
        spawnFloat(setMonsterFloats, `-${dmgToMonster}`)
        setMonsterHitPulse((p) => p + 1)
        playHitSound()
      }

      let stillStanding = true
      if (dmgToPlayer > 0) {
        stillStanding = takeFinanceCombatDamage(dmgToPlayer)
        spawnFloat(setPlayerFloats, `-${dmgToPlayer}`)
        setPlayerHitPulse((p) => p + 1)
        playTakeDamageSound()
      }

      setPlayerStamina(newPlayerStamina)
      setMonsterStamina(newMonsterStamina)
      setPlayerBoost(matchup.arm1)
      setMonsterBoost(matchup.arm2)
      setLastPlayerMove(playerMove)
      setTurnCount(turnNumber)

      // Monster defeat is checked before player defeat so a simultaneous
      // double-KO turn favors the player (judgment call - the spec doesn't
      // define a tie-break and this is the friendlier outcome).
      if (newMonsterHp <= 0) {
        appendLog(`${monster.name} is defeated!`)
        setOutcome('victory')
        setBusy(false)
        playVictorySound()
        return
      }
      if (!stillStanding) {
        appendLog(`You've been beaten badly.`)
        setOutcome('defeat')
        setBusy(false)
        playDefeatSound()
        return
      }

      setBusy(false)
    }, 450)
  }

  const handleRetreat = () => {
    onClose()
  }

  const handleContinue = () => {
    if (outcome === 'victory' && onVictory) onVictory()
    if (outcome === 'defeat' && onDefeat) onDefeat()
    onClose()
  }

  const staminaPips = (value) => (
    <span className="ml-2 text-cyan-300">
      {'●'.repeat(value)}
      <span className="text-gray-600">{'○'.repeat(3 - value)}</span>
    </span>
  )

  const moveButtonClass = (color) =>
    `flex-1 border-4 py-2 font-bold disabled:opacity-40 disabled:cursor-not-allowed ${color}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[480px] border-4 border-red-500 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-2 text-xl font-bold text-red-400">{title}</h2>
        <p className="mb-2 text-xs text-yellow-300">
          This fight won't kill you - losing means a costly, humiliating retreat, not game over.
        </p>

        <div key={`monster-bar-${monsterHitPulse}`} className="relative mb-3 border-2 border-gray-600 bg-[#0f1020] p-3 animate-shake">
          <div className="flex justify-between text-sm">
            <span>{monster.name}</span>
            <span>{monsterHp} / {monster.maxHp} HP{staminaPips(monsterStamina)}</span>
          </div>
          <div className="mt-1 h-3 w-full bg-gray-800">
            <div className="h-3 bg-red-500 transition-all" style={{ width: `${(monsterHp / monster.maxHp) * 100}%` }} />
          </div>
          {monsterBoost && <div className="mt-1 text-[10px] text-purple-300">⚡ Counter Boost primed</div>}
          {monsterFloats.map((f) => (
            <span key={f.id} className="animate-float-up-fade pointer-events-none absolute right-3 top-1 font-bold text-red-400">
              {f.text}
            </span>
          ))}
        </div>

        <div key={`player-bar-${playerHitPulse}`} className="relative mb-3 border-2 border-gray-600 bg-[#0f1020] p-3 animate-shake">
          <div className="flex justify-between text-sm">
            <span>{player.name}</span>
            <span>{player.hp} / {player.maxHp} HP{staminaPips(playerStamina)}</span>
          </div>
          <div className="mt-1 h-3 w-full bg-gray-800">
            <div className="h-3 bg-green-500 transition-all" style={{ width: `${Math.max(0, (player.hp / player.maxHp) * 100)}%` }} />
          </div>
          {playerBoost && <div className="mt-1 text-[10px] text-purple-300">⚡ Counter Boost primed</div>}
          {playerFloats.map((f) => (
            <span key={f.id} className="animate-float-up-fade pointer-events-none absolute right-3 top-1 font-bold text-red-400">
              {f.text}
            </span>
          ))}
        </div>

        <div className="mb-4 h-24 overflow-y-auto border-2 border-gray-700 bg-black p-2 text-xs text-gray-300">
          {log.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>

        {!outcome && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={() => handleMove('attack')}
                disabled={busy}
                className={moveButtonClass('border-red-400 bg-red-500 text-black hover:bg-red-400')}
              >
                Attack
              </button>
              <button
                onClick={() => handleMove('heavy')}
                disabled={busy || playerStamina < 1}
                className={moveButtonClass('border-orange-400 bg-orange-600 text-black hover:bg-orange-500')}
              >
                Heavy
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleMove('guard')}
                disabled={busy}
                className={moveButtonClass('border-blue-400 bg-blue-600 text-black hover:bg-blue-500')}
              >
                Guard
              </button>
              <button
                onClick={() => handleMove('dodge')}
                disabled={busy || playerStamina < 1}
                className={moveButtonClass('border-cyan-400 bg-cyan-600 text-black hover:bg-cyan-500')}
              >
                Dodge
              </button>
            </div>
            <button
              onClick={handleRetreat}
              disabled={busy}
              className="border-4 border-gray-500 py-1 text-sm font-bold hover:bg-gray-500 disabled:opacity-50"
            >
              Retreat
            </button>
          </div>
        )}

        {outcome === 'victory' && (
          <div className="text-center">
            <p className="mb-3 font-bold text-green-400">Victory!</p>
            <button
              onClick={handleContinue}
              className="border-4 border-green-400 bg-green-500 px-6 py-2 font-bold text-black hover:bg-green-400"
            >
              Continue
            </button>
          </div>
        )}

        {outcome === 'defeat' && (
          <div className="text-center">
            <p className="mb-2 font-bold text-red-500">You've been beaten badly.</p>
            <p className="mb-3 text-xs text-gray-400">
              You wake up later, patched up and lighter in the wallet - a cut of your cash
              covered the "fees," and you're too drained to do anything else today.
            </p>
            <button
              onClick={handleContinue}
              className="border-4 border-gray-500 px-6 py-2 font-bold hover:bg-gray-500"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
