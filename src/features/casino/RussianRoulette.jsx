import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'

const MIN_BET = 25
const ENERGY_COST = 5
const CHAMBERS = 6 // one prop revolver, six chambers, one dummy round loaded at random
// Pulling a 6th trigger would be a guaranteed hit (1 bullet left in the last
// remaining chamber) - that's not a decision, it's a formality, so the game
// force-stops the "pull trigger" option at round 5 and the player must cash
// out. This is a stylized cash-stakes tension game, NOT a literal death
// mechanic - no HP loss, no depiction of harm. A "bang" just means you lose
// the pot and the scene cuts away, exactly like busting in Blackjack or a
// dead spin on Slots.
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

  const [phase, setPhase] = useState('bet') // 'bet' | 'playing' | 'result'
  const [bet, setBet] = useState(MIN_BET)
  const [round, setRound] = useState(0) // rounds survived so far this sit-down
  const [outcome, setOutcome] = useState(null) // 'bust' | 'cashout'
  const [message, setMessage] = useState('')

  const currentMultiplier = round > 0 ? ROUND_MULTIPLIERS[round - 1] : null

  const sitDown = () => {
    if (cash < bet || bet < MIN_BET || energy < ENERGY_COST) return
    if (!spendEnergy(ENERGY_COST)) return
    addCash(-bet)
    setRound(0)
    setOutcome(null)
    setMessage('The dealer spins the cylinder and sets the revolver down in front of you. Your move.')
    setPhase('playing')
  }

  const pullTrigger = () => {
    if (phase !== 'playing' || round >= MAX_ROUNDS) return
    const attemptNumber = round + 1 // 1-indexed pull about to happen
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
      setPhase('result')
      setOutcome('bust')
      setMessage(pickRandom(BUST_MESSAGES))
      return
    }

    const newRound = round + 1
    setRound(newRound)
    setMessage(SURVIVE_MESSAGES[newRound - 1])
  }

  const cashOut = () => {
    if (phase !== 'playing' || round < 1) return
    const multiplier = ROUND_MULTIPLIERS[round - 1]
    const payout = Math.round(bet * multiplier)
    addCash(payout)
    if (round >= BIG_WIN_REPUTATION_THRESHOLD) addReputation(3)
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

  return (
    <div className="border-2 border-pink-400 bg-[#12071c] p-4 text-sm">
      <p className="mb-3 text-xs text-gray-400">
        The house's velvet-lined back room: a prop revolver, a six-chamber cylinder, one dummy round loaded at
        random. Pull the trigger and the pot climbs. Cash out whenever you like. Get unlucky and the scene cuts
        away - you lose the pot, nothing more.
      </p>

      {phase === 'bet' && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
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
            disabled={cash < bet || bet < MIN_BET || energy < ENERGY_COST}
            className="border-2 border-pink-400 px-3 py-1 font-bold text-pink-300 hover:bg-pink-400 hover:text-black disabled:opacity-30"
          >
            Sit Down (min ${MIN_BET})
          </button>
        </div>
      )}

      {phase !== 'bet' && (
        <div className="mb-3 border-2 border-gray-600 bg-black p-3">
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
        </div>
      )}

      {phase === 'playing' && (
        <div className="flex gap-2">
          <button
            onClick={pullTrigger}
            disabled={round >= MAX_ROUNDS}
            className="border-2 border-red-400 px-3 py-1 font-bold text-red-300 hover:bg-red-400 hover:text-black disabled:opacity-30"
          >
            Pull the Trigger
          </button>
          <button
            onClick={cashOut}
            disabled={round < 1}
            className="border-2 border-green-400 px-3 py-1 font-bold text-green-300 hover:bg-green-400 hover:text-black disabled:opacity-30"
          >
            Walk Away (Cash Out)
          </button>
        </div>
      )}

      {message && (
        <p
          className={`mt-3 font-bold ${
            outcome === 'bust' ? 'text-red-400' : outcome === 'cashout' ? 'text-green-400' : 'text-yellow-300'
          }`}
        >
          {message}
        </p>
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
