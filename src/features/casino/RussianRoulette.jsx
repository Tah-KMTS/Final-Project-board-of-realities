import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { playClickSound, playAlarmSound, playPurchaseSound, playQuestCompleteSound, playGunshotSound, playVictorySound } from '../../audio/sfx'

// Sprite crops out of a user-supplied reference sheet (production/ has no
// record of this one - it was a one-off asset drop, not a generated pack),
// sliced by exact connected-component bounding boxes (same "measured, not
// eyeballed" approach as ClawMachine.jsx's labubusprite.png extraction) into
// public/assets/packs/russian-roulette/. Plain <img> tags, not Phaser - this
// is a React minigame like every other one in this file's directory.
const DEALER_PORTRAIT_URL = '/assets/packs/russian-roulette/dealer_portrait.png'
const CYLINDER_IDLE_URL = '/assets/packs/russian-roulette/cylinder_idle.png'
const CYLINDER_LOADED_URL = '/assets/packs/russian-roulette/cylinder_loaded.png'
const CYLINDER_FINAL_CHAMBER_URL = '/assets/packs/russian-roulette/cylinder_final_chamber.png'

// The revolver itself is a real frame-by-frame animation, cut from the `guns`
// pack's Colt 45 sheets by production/process_revolver.py (see that script for
// why all three strips share one bounding box). The pairing is the mechanic:
// `click` and `fire` are the SAME hammer cycle and are pixel-identical up to
// REVEAL_FRAME, so watching the gun tells the player nothing until the flash
// either lands or doesn't - which is the whole "pull it and find out" beat.
// process_revolver.py asserts that identity against the actual pixels, so this
// cannot quietly rot if the pack is ever updated.
const FRAME_W = 55
const FRAME_H = 26
const REVOLVER_SCALE = 4
const REVEAL_FRAME = 5 // muzzle flash lands here in `fire`; `click` stays empty

const CLIPS = {
  load: { url: '/assets/packs/russian-roulette/revolver_load.png', frames: 29 },
  click: { url: '/assets/packs/russian-roulette/revolver_click.png', frames: 10 },
  fire: { url: '/assets/packs/russian-roulette/revolver_fire.png', frames: 10 },
}

// Per-frame hold times for the 10-frame hammer cycle. Frames 0-4 are the
// hammer drawing back with nothing visible happening yet, so they run slow to
// stretch the dread; the flash lands on REVEAL_FRAME and the aftermath (smoke,
// spinning casing) runs fast so the result text isn't left hanging. ~555ms of
// wind-up, ~340ms of follow-through.
const SHOOT_FRAME_MS = [130, 120, 110, 100, 95, 90, 60, 60, 60, 70]
const LOAD_FRAME_MS = 36 // flat - the load is a flourish, not a suspense beat

function frameMs(clip, frame) {
  return clip === 'load' ? LOAD_FRAME_MS : SHOOT_FRAME_MS[frame]
}

const MIN_BET = 25
const ENERGY_COST = 5
const CHAMBERS = 6 // one prop revolver, six chambers, one dummy round loaded at random
// Pulling a 6th trigger would be a guaranteed hit (1 bullet left in the last
// remaining chamber) - that's not a decision, it's a formality, not a real
// bet, so the fair push-your-luck system below (ROUND_MULTIPLIERS) stops one
// short of it: a normal cash-out-eligible "round" tops out at 5. The 6th
// chamber is still reachable, but only via the separate, deliberately
// not-fair FINAL_CHAMBER_* easter egg further down - see its own comment.
// This is a stylized cash-stakes tension game, NOT a literal death mechanic -
// no HP loss, no depiction of harm. A "bang" just means you lose the pot and
// the scene cuts away, exactly like busting in Blackjack or a dead spin on
// Slots.
const MAX_ROUNDS = CHAMBERS - 1
const BIG_WIN_REPUTATION_THRESHOLD = MAX_ROUNDS // only the full 5-for-5 run grants reputation

// Payout curve, derived (not hand-picked) from the actual odds of a
// without-replacement 6-chamber cylinder with a single round loaded:
//   P(survive round k | reached round k) = (CHAMBERS - k) / (CHAMBERS - k + 1)
//   => P(survive n rounds in a row) = (CHAMBERS - n) / CHAMBERS
// A mathematically "fair" (0% house edge) payout for cashing out after
// surviving n rounds is exactly the inverse of that cumulative survival
// probability: fairMultiplier(n) = CHAMBERS / (CHAMBERS - n). We then scale
// every fair multiplier by a flat HOUSE_EDGE_RETENTION factor, same
// ~10%-house-edge target as Slots.jsx's documented ~90% RTP.
//
// Because fairMultiplier(n) is exactly 1 / P(survive n), scaling it by a
// constant k gives EV(cash out after n rounds) = P(survive n) * k *
// fairMultiplier(n) * bet = k * bet for every n - i.e. the house edge is
// mathematically identical (10%) no matter which round the player chooses
// to walk away on. This was verified analytically above (not simulated,
// since the payoff structure collapses to closed form) rather than by
// Monte Carlo like Slots.jsx - the push-your-luck tension here is pure
// variance (bigger pot the longer you push), it does NOT change the house's
// cut, same as real single-zero-roulette style games where every bet on the
// table carries the same edge regardless of which one you pick.
const HOUSE_EDGE_RETENTION = 0.9 // keep 90% of the fair multiplier => 10% house edge
const ROUND_MULTIPLIERS = Array.from({ length: MAX_ROUNDS }, (_, idx) => {
  const roundsSurvived = idx + 1
  const fairMultiplier = CHAMBERS / (CHAMBERS - roundsSurvived)
  return Math.round(fairMultiplier * HOUSE_EDGE_RETENTION * 100) / 100
})
// => [1.08, 1.35, 1.8, 2.7, 5.4]

// The true 6th/last chamber - deliberately OUTSIDE the fair-odds system
// above. After 5 clean pulls the last remaining chamber holds the round
// with mathematical certainty (P=1, see MAX_ROUNDS's own comment on why the
// normal push-your-luck flow refuses to let the player pull it as a real
// bet). Reaching it is still optional - Walk Away at round 5 keeps the
// guaranteed 5.4x - but a player who dares it anyway isn't making a bet
// with real odds, they're making a wish. So this is a flat, hardcoded,
// intentionally-NOT-fair exception (unlike every number above it, which was
// derived and verified): a tiny hand-picked "the prop gun jammed" chance,
// existing purely as a rare easter egg, not a rebalancing of the real game.
const FINAL_CHAMBER_ROUND = CHAMBERS // 6
const FINAL_CHAMBER_SURVIVAL_CHANCE = 0.02
const FINAL_CHAMBER_JACKPOT = 1_000_000
const FINAL_CHAMBER_JACKPOT_MESSAGE =
  "Click. ...CLICK. Dead man's chamber - EMPTY. The dealer stares at the revolver like it just betrayed him personally. Nobody in this room has ever seen that happen before."

const SURVIVE_MESSAGES = [
  'Click. Empty chamber. The pot ticks up - the table leans in closer.',
  'Click. Still nothing. There\'s sweat on your collar now, but the pot is bigger.',
  "Click. Somehow, still nothing. The dealer isn't smiling anymore.",
  "Click. Four in a row. The whole room has gone quiet.",
  "Click. FIVE. One chamber left in the cylinder - and it's the one. Walk away. Right now.",
]

const BUST_MESSAGES = [
  "BANG. The lights cut for a beat - when they come back up, the pit boss is already raking your pot into the house tray.",
  "Click... BANG. Somewhere backstage a stagehand resets the prop for the next sucker. Your pot's gone. You, notably, are fine.",
  "The hammer falls on the loaded chamber. Screen-goes-black, house-laughs energy. Pot: forfeited.",
  "BANG. Confetti cannon, not a bullet - this is a casino floor, not an assassination. Still, the pot's the house's now.",
]

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export default function RussianRoulette() {
  const cash = useGameStore((s) => s.cash)
  const addCash = useGameStore((s) => s.addCash)
  const addReputation = useGameStore((s) => s.addReputation)
  const spendEnergy = useGameStore((s) => s.spendEnergy)
  const energy = useGameStore((s) => s.player.energy)
  const getEffectiveLuck = useGameStore((s) => s.getEffectiveLuck)
  const triggerRouletteGameOver = useGameStore((s) => s.triggerRouletteGameOver)

  const [phase, setPhase] = useState('bet') // 'bet' | 'playing' | 'result'
  const [bet, setBet] = useState(MIN_BET)
  const [round, setRound] = useState(0) // rounds survived so far this sit-down
  const [outcome, setOutcome] = useState(null) // 'bust' | 'cashout' | 'jackpot'
  const [message, setMessage] = useState('')

  // The currently-playing revolver clip, or null when the gun is at rest:
  // { clip: 'load' | 'click' | 'fire', frame: number }. Every control is
  // locked while this is non-null - the outcome is already decided by then
  // (see pullTrigger), and letting the player click through the animation
  // would skip the only part that tells them whether they lived.
  const [anim, setAnim] = useState(null)
  const timerRef = useRef(null)
  // Callbacks for the in-flight clip. Refs, not state, so advancing a frame
  // doesn't have to re-run the driver effect with a new identity each time.
  const onRevealRef = useRef(null)
  const onDoneRef = useRef(null)

  const playClip = useCallback((clip, { onReveal, onDone } = {}) => {
    clearTimeout(timerRef.current)
    onRevealRef.current = onReveal ?? null
    onDoneRef.current = onDone ?? null
    setAnim({ clip, frame: 0 })
  }, [])

  // Frame driver. One timeout per frame rather than a single interval, so
  // SHOOT_FRAME_MS can hold the slow wind-up frames longer than the fast
  // follow-through ones.
  useEffect(() => {
    if (!anim) return undefined
    const { frames } = CLIPS[anim.clip]
    timerRef.current = setTimeout(() => {
      const next = anim.frame + 1
      if (next >= frames) {
        setAnim(null)
        onDoneRef.current?.()
        return
      }
      // Fires as the flash frame goes up, so the bang is heard exactly when
      // it's seen; the result text waits for onDone so it lands after the
      // smoke rather than on top of it.
      if (next === REVEAL_FRAME) onRevealRef.current?.()
      setAnim({ clip: anim.clip, frame: next })
    }, frameMs(anim.clip, anim.frame))
    return () => clearTimeout(timerRef.current)
  }, [anim])

  const busy = anim !== null
  const currentMultiplier = round > 0 ? ROUND_MULTIPLIERS[round - 1] : null

  const sitDown = () => {
    if (cash < bet || bet < MIN_BET || energy < ENERGY_COST || busy) return
    if (!spendEnergy(ENERGY_COST)) return
    addCash(-bet)
    setRound(0)
    setOutcome(null)
    setMessage('The dealer thumbs a single round into the cylinder, snaps it shut, and sets the revolver down in front of you. Your move.')
    setPhase('playing')
    playClip('load')
  }

  // Every branch below settles the outcome IMMEDIATELY (the rolls and the
  // payout maths are untouched from when this was instant) and then hands the
  // consequences to playClip's onDone, so the result is already sealed before
  // the hammer starts moving - the animation reports it, it never decides it.
  // What the animation buys is that the player can't read the result off the
  // screen until the flash frame either lands or doesn't.
  const pullTrigger = () => {
    if (phase !== 'playing' || busy) return
    const attemptNumber = round + 1 // 1-indexed pull about to happen

    // The dare: round 5 survived, one chamber left, certain death by the
    // real math - see FINAL_CHAMBER_SURVIVAL_CHANCE's own comment for why
    // this branch intentionally ignores the fair ROUND_MULTIPLIERS table
    // entirely instead of extending it with a 6th entry.
    if (attemptNumber === FINAL_CHAMBER_ROUND) {
      const luckySurvive = Math.random() < FINAL_CHAMBER_SURVIVAL_CHANCE
      if (!luckySurvive) {
        // A real "start a new game or load game" ending, not just a lost
        // pot - the one loss condition in the whole finance world that
        // drops straight to GameOverScreen (App.jsx) instead of a
        // recoverable-in-session setback. See triggerRouletteGameOver's own
        // comment for why this still doesn't wipe the save. No local
        // phase/outcome/message is set - this component unmounts along with
        // the rest of WorldScreen the instant `screen` changes, so setting it
        // would be dead work. The game-over waits for onDone so the flash and
        // the smoke actually play before the screen cuts away.
        playClip('fire', { onReveal: playGunshotSound, onDone: triggerRouletteGameOver })
        return
      }
      const payout = Math.round(bet * ROUND_MULTIPLIERS[MAX_ROUNDS - 1]) + FINAL_CHAMBER_JACKPOT
      playClip('click', {
        onReveal: playClickSound,
        onDone: () => {
          addCash(payout)
          playVictorySound()
          addReputation(10)
          setPhase('result')
          setOutcome('jackpot')
          setMessage(`${FINAL_CHAMBER_JACKPOT_MESSAGE} $${payout.toLocaleString()} wired to your account.`)
        },
      })
      return
    }

    const chambersRemaining = CHAMBERS - (attemptNumber - 1)
    // Luck discount applies to round 1 ONLY. A flat per-round discount
    // compounds multiplicatively across every round and flips the house
    // edge player-positive (up to +23.6% EV at the real Luck cap of 8) -
    // confirmed by hand-computation, do not extend this to rounds 2-5.
    // Restricting it to round 1 keeps the "same house edge regardless of
    // cash-out round" invariant intact (~5.1% house edge at max Luck vs
    // 10% today, still house-positive).
    const luckBangReduction = attemptNumber === 1 ? (getEffectiveLuck() - 5) * 0.015 : 0
    const bangChance = Math.max(0, 1 / chambersRemaining - luckBangReduction)
    const bang = Math.random() < bangChance

    if (bang) {
      playClip('fire', {
        onReveal: playGunshotSound,
        onDone: () => {
          playAlarmSound() // the house sting, after the shot itself
          setPhase('result')
          setOutcome('bust')
          setMessage(pickRandom(BUST_MESSAGES))
        },
      })
      return
    }

    const newRound = round + 1
    playClip('click', {
      onReveal: playClickSound,
      onDone: () => {
        setRound(newRound)
        setMessage(SURVIVE_MESSAGES[newRound - 1])
      },
    })
  }

  const cashOut = () => {
    if (phase !== 'playing' || round < 1 || busy) return
    const multiplier = ROUND_MULTIPLIERS[round - 1]
    const payout = Math.round(bet * multiplier)
    addCash(payout)
    if (round >= BIG_WIN_REPUTATION_THRESHOLD) {
      playQuestCompleteSound()
      addReputation(3)
    } else {
      playPurchaseSound()
    }
    setPhase('result')
    setOutcome('cashout')
    setMessage(`You set the revolver down and pocket the pot. ${round}/${MAX_ROUNDS} chambers cleared - $${payout.toLocaleString()} (${multiplier}x).`)
  }

  const playAgain = () => {
    setPhase('bet')
    setRound(0)
    setOutcome(null)
    setMessage('')
  }

  const atFinalChamber = phase === 'playing' && round === MAX_ROUNDS
  // The red-ringed final-chamber art doubles as the jackpot reveal image
  // (the "impossible empty chamber" IS that exact chamber) - everywhere
  // else falls back to the plain loaded-cylinder art.
  const showFinalChamberArt = atFinalChamber || outcome === 'jackpot'
  // One-shot spin/tick/shake on the cylinder art, keyed so React remounts
  // the <img> (retriggering the CSS animation) on every relevant
  // transition - same pattern LisaModal's animate-portrait-swap uses.
  // Big decelerating spin for "the dealer spins the cylinder" (round 0) and
  // the jackpot's own impossible reveal; a quick tick for every ordinary
  // round cleared; a shake for any bust.
  const cylinderAnimClass =
    outcome === 'bust'
      ? 'animate-shake'
      : outcome === 'jackpot' || (phase === 'playing' && round === 0)
        ? 'animate-cylinder-spin-in'
        : phase === 'playing'
          ? 'animate-cylinder-tick'
          : ''
  const cylinderAnimKey = `${phase}-${round}-${outcome ?? 'none'}`

  return (
    <div className="border-2 border-pink-400 bg-[#12071c] p-4 text-sm">
      <div className="mb-3 flex items-center gap-3">
        <img
          src={DEALER_PORTRAIT_URL}
          alt=""
          className="h-16 w-auto shrink-0 border border-pink-500/40"
          style={{ imageRendering: 'pixelated' }}
        />
        <p className="text-xs text-gray-400">
          The house's velvet-lined back room: a prop revolver, a six-chamber cylinder, one dummy round loaded at
          random. Pull the trigger and the pot climbs. Cash out whenever you like. Get unlucky and the scene cuts
          away - you lose the pot, nothing more.
        </p>
      </div>

      {/* The revolver, as a sprite-sheet frame window: one <div> whose
          background is scrolled by whole frames (same backgroundPosition
          technique CasinoMapScene.jsx uses for its walk cycles). At rest it
          parks on frame 0 of `click`, which is the plain gun. */}
      <div className="mb-3 flex justify-center">
        <div
          role="img"
          aria-label={
            anim?.clip === 'fire' && anim.frame >= REVEAL_FRAME
              ? 'The revolver fires'
              : anim?.clip === 'load'
                ? 'The dealer loads the cylinder'
                : 'A revolver resting on the table'
          }
          style={{
            width: FRAME_W * REVOLVER_SCALE,
            height: FRAME_H * REVOLVER_SCALE,
            backgroundImage: `url(${CLIPS[anim?.clip ?? 'click'].url})`,
            backgroundPosition: `${-(anim?.frame ?? 0) * FRAME_W * REVOLVER_SCALE}px 0`,
            backgroundSize: `${FRAME_W * CLIPS[anim?.clip ?? 'click'].frames * REVOLVER_SCALE}px ${FRAME_H * REVOLVER_SCALE}px`,
            backgroundRepeat: 'no-repeat',
            imageRendering: 'pixelated',
          }}
        />
      </div>

      {phase === 'bet' && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <img src={CYLINDER_IDLE_URL} alt="" className="h-14 w-auto" style={{ imageRendering: 'pixelated' }} />
          <label className="text-xs text-gray-400">Bet ($)</label>
          <input
            type="number"
            min={MIN_BET}
            value={bet}
            onChange={(e) => setBet(Math.max(MIN_BET, Math.floor(Number(e.target.value)) || MIN_BET))}
            className="w-24 border border-gray-600 bg-black px-1 py-1 text-white"
          />
          <button
            onClick={sitDown}
            disabled={cash < bet || bet < MIN_BET || energy < ENERGY_COST || busy}
            className="border-2 border-pink-400 px-3 py-1 font-bold text-pink-300 hover:bg-pink-400 hover:text-black disabled:opacity-30"
          >
            Sit Down (min ${MIN_BET})
          </button>
        </div>
      )}

      {phase !== 'bet' && (
        <div className="mb-3 border-2 border-gray-600 bg-black p-3">
          <div className="mb-2 flex justify-center">
            <img
              key={cylinderAnimKey}
              src={showFinalChamberArt ? CYLINDER_FINAL_CHAMBER_URL : CYLINDER_LOADED_URL}
              alt=""
              className={`h-16 w-auto ${cylinderAnimClass} ${atFinalChamber ? 'animate-pulse' : ''}`}
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
          <div className="mb-2 flex items-center justify-center gap-2">
            {Array.from({ length: CHAMBERS }).map((_, i) => (
              <div
                key={i}
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs ${
                  i < round
                    ? 'border-green-400 bg-green-400/20 text-green-300'
                    : i === round && phase === 'playing'
                      ? 'border-yellow-400 bg-yellow-400/20 text-yellow-300 animate-pulse'
                      : 'border-gray-600 text-gray-600'
                }`}
              >
                {i < round ? '✓' : '?'}
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-400">
            Round {round}/{MAX_ROUNDS}
            {currentMultiplier ? ` - current pot multiplier ${currentMultiplier}x ($${Math.round(bet * currentMultiplier).toLocaleString()})` : ''}
          </p>
          {atFinalChamber && (
            <p className="mt-2 text-center text-xs font-bold text-amber-300">
              Five clean pulls. One chamber left - and by the house's own math, it's loaded for certain. Walk away
              with your ${Math.round(bet * ROUND_MULTIPLIERS[MAX_ROUNDS - 1]).toLocaleString()} now, or dare the
              last chamber anyway - losing that one doesn't just cost the pot, it ends the run. Your save stays put,
              but you're back at the title screen.
            </p>
          )}
        </div>
      )}

      {phase === 'playing' && (
        <div className="flex gap-2">
          <button
            onClick={pullTrigger}
            disabled={busy}
            className={
              atFinalChamber
                ? 'animate-pulse border-2 border-amber-300 px-3 py-1 font-bold text-amber-300 hover:bg-amber-300 hover:text-black disabled:animate-none disabled:opacity-30'
                : 'border-2 border-red-400 px-3 py-1 font-bold text-red-300 hover:bg-red-400 hover:text-black disabled:opacity-30'
            }
          >
            {/* Deliberately the same label for both shoot clips - a label that
                changed with the outcome would give it away before the flash. */}
            {busy && anim.clip !== 'load'
              ? 'The hammer falls...'
              : atFinalChamber
                ? 'Dare the Last Chamber'
                : 'Pull the Trigger'}
          </button>
          <button
            onClick={cashOut}
            disabled={round < 1 || busy}
            className="border-2 border-green-400 px-3 py-1 font-bold text-green-300 hover:bg-green-400 hover:text-black disabled:opacity-30"
          >
            Walk Away (Cash Out)
          </button>
        </div>
      )}

      {outcome === 'jackpot' ? (
        <div className="mt-3 border-4 border-amber-300 bg-amber-300/10 p-3 text-center">
          <p className="text-lg font-extrabold text-amber-300">THE CHAMBER WAS EMPTY</p>
          <p className="mt-1 text-xs text-amber-200">{message}</p>
        </div>
      ) : (
        message && (
          <p className={`mt-3 font-bold ${outcome === 'bust' ? 'text-red-400' : outcome === 'cashout' ? 'text-green-400' : 'text-yellow-300'}`}>
            {message}
          </p>
        )
      )}

      {phase === 'result' && (
        <button
          onClick={playAgain}
          className="mt-3 border-2 border-pink-400 px-3 py-1 font-bold text-pink-300 hover:bg-pink-400 hover:text-black"
        >
          Play Again
        </button>
      )}
    </div>
  )
}
