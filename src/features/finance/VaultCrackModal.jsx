import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { playClickSound, playDiceSound, playVictorySound, playAlarmSound } from '../../audio/sfx'

// Vault Cracking - replaces the old single-click coin-flip "Rob Vault"
// button with a real Mastermind-style combination-cracking puzzle. Two
// tiers of hidden N-digit code from an M-symbol pool; the player narrows
// it down guess by guess using black/white peg feedback. No RNG gate of
// its own on the outcome - the puzzle result (crack vs. run out of
// attempts) IS the outcome, fed straight into the shared
// applyCrimeOutcome() helper (see useGameStore.js, extracted from
// executeCrime() specifically so this modal could reuse the exact same
// fail-consequence math without an RNG roll of its own).
//
// Self-contained like WharfModal/ConcertHallTab: own onClose only, no
// onVictory/onDefeat handshake - nothing upstream branches on this
// outcome. Plain turn-based React state, no rAF/animation loop.

const TIERS = [
  {
    id: 'tier1',
    name: 'Night Deposit Box',
    flavor: 'A slow after-hours drop box. Low stakes, low security.',
    N: 3,
    M: 5,
    allowRepeats: false,
    baseAttempts: 6,
    energyCost: 15,
    payout: 6000,
    notorietyIncreaseOnFail: 10,
    wantedIncreaseOnFail: 1,
    assetSeizureOnFail: 0.10,
    jailChanceOnFail: 0.10,
  },
  {
    id: 'tier2',
    name: 'Main Vault',
    flavor: 'The real vault. Full six-tumbler lock, digits can repeat.',
    N: 4,
    M: 6,
    allowRepeats: true,
    baseAttempts: 8,
    energyCost: 30,
    payout: 18000,
    notorietyIncreaseOnFail: 25,
    wantedIncreaseOnFail: 3,
    assetSeizureOnFail: 0.20,
    jailChanceOnFail: 0.30,
  },
]

function generateSecret({ N, M, allowRepeats }) {
  if (allowRepeats) {
    return Array.from({ length: N }, () => 1 + Math.floor(Math.random() * M))
  }
  const pool = Array.from({ length: M }, (_, i) => i + 1)
  const secret = []
  for (let i = 0; i < N; i++) {
    const idx = Math.floor(Math.random() * pool.length)
    secret.push(pool[idx])
    pool.splice(idx, 1)
  }
  return secret
}

// Exact two-pass Mastermind scoring: remove exact (black-peg) matches
// first, THEN count color-only (white-peg) overlaps against what's left.
// A naive single-pass approach over/under-counts white pegs whenever the
// secret or guess has repeated digits (Tier 2 allows repeats) - this is
// the part most likely to have a subtle bug, so it's implemented exactly
// as specced, no shortcuts.
function scoreGuess(secret, guess) {
  let blackPegs = 0
  const secretRemaining = []
  const guessRemaining = []
  for (let i = 0; i < secret.length; i++) {
    if (guess[i] === secret[i]) {
      blackPegs++
    } else {
      secretRemaining.push(secret[i])
      guessRemaining.push(guess[i])
    }
  }
  let whitePegs = 0
  for (const g of guessRemaining) {
    const idx = secretRemaining.indexOf(g)
    if (idx !== -1) {
      whitePegs++
      secretRemaining.splice(idx, 1)
    }
  }
  return { blackPegs, whitePegs }
}

function computeAttempts(baseAttempts, INT) {
  const raw = baseAttempts + Math.floor((INT - 5) / 3)
  return Math.max(baseAttempts - 2, Math.min(baseAttempts + 3, raw))
}

export default function VaultCrackModal({ onClose }) {
  const player = useGameStore((s) => s.player)
  const spendEnergy = useGameStore((s) => s.spendEnergy)
  const applyCrimeOutcome = useGameStore((s) => s.applyCrimeOutcome)

  const [screen, setScreen] = useState('tierSelect') // 'tierSelect' | 'puzzle' | 'results'
  const [activeTier, setActiveTier] = useState(null)
  const [secret, setSecret] = useState(null)
  const [guesses, setGuesses] = useState([])
  const [currentSlots, setCurrentSlots] = useState([])
  const [attempts, setAttempts] = useState(0)
  const [attemptsMax, setAttemptsMax] = useState(0)
  const [resultData, setResultData] = useState(null)

  const historyRef = useRef(null)
  useEffect(() => {
    if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight
  }, [guesses])

  const startTier = (tier) => {
    if (player.energy < tier.energyCost) return
    if (!spendEnergy(tier.energyCost)) return
    // INT is read once, right here at puzzle start via getState() (not the
    // reactive `player` above) - the attempts budget is locked in for the
    // whole puzzle, it doesn't change if INT changes mid-run.
    const INT = useGameStore.getState().player.stats.INT ?? 5
    const max = computeAttempts(tier.baseAttempts, INT)
    setActiveTier(tier)
    setSecret(generateSecret(tier))
    setAttemptsMax(max)
    setAttempts(max)
    setGuesses([])
    setCurrentSlots(Array(tier.N).fill(null))
    setResultData(null)
    setScreen('puzzle')
  }

  const fillSlot = (digit) => {
    playClickSound()
    setCurrentSlots((prev) => {
      const idx = prev.indexOf(null)
      if (idx === -1) return prev
      const next = [...prev]
      next[idx] = digit
      return next
    })
  }

  const clearSlot = (idx) => {
    setCurrentSlots((prev) => prev.map((v, i) => (i === idx ? null : v)))
  }

  const backspace = () => {
    setCurrentSlots((prev) => {
      const next = [...prev]
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i] != null) {
          next[i] = null
          break
        }
      }
      return next
    })
  }

  const resolveOutcome = (success, guessesUsedCount) => {
    const res = applyCrimeOutcome({
      success,
      payout: activeTier.payout,
      notorietyIncreaseOnFail: activeTier.notorietyIncreaseOnFail,
      wantedIncreaseOnFail: activeTier.wantedIncreaseOnFail,
      assetSeizureOnFail: activeTier.assetSeizureOnFail,
      jailChanceOnFail: activeTier.jailChanceOnFail,
    })
    if (success) playVictorySound()
    else playAlarmSound()
    setResultData({ outcome: success ? 'crack' : 'alarm', guessesUsed: guessesUsedCount, tier: activeTier, res })
    setScreen('results')
  }

  const submitGuess = () => {
    if (!activeTier || currentSlots.some((v) => v == null)) return
    playDiceSound()
    const guess = [...currentSlots]
    const { blackPegs, whitePegs } = scoreGuess(secret, guess)
    const newGuesses = [...guesses, { guess, blackPegs, whitePegs }]
    setGuesses(newGuesses)
    setCurrentSlots(Array(activeTier.N).fill(null))

    if (blackPegs === activeTier.N) {
      resolveOutcome(true, newGuesses.length)
      return
    }

    const remaining = attempts - 1
    if (remaining <= 0) {
      setAttempts(0)
      resolveOutcome(false, newGuesses.length)
      return
    }
    setAttempts(remaining)
  }

  // Walk-away / X-close: a clean exit at any point before attempts hit 0.
  // Deliberately does NOT touch applyCrimeOutcome - only spent entry energy
  // is lost, no notoriety/wanted/jail/payout. Resets puzzle state back to
  // tier-select so re-opening the modal doesn't resurrect a stale run.
  const walkAway = () => {
    setActiveTier(null)
    setSecret(null)
    setGuesses([])
    setCurrentSlots([])
    setResultData(null)
    setScreen('tierSelect')
  }

  const allSlotsFilled = currentSlots.length > 0 && currentSlots.every((v) => v != null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="glass-panel relative w-[480px] max-h-[85vh] overflow-y-auto border-4 border-blue-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 border border-gray-500 px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-600 hover:text-white"
        >
          X
        </button>

        <h2 className="mb-2 text-xl font-bold text-blue-300">Vault Cracking</h2>

        {screen === 'tierSelect' && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-400">
              Crack the combination before you run out of attempts. Each guess gets scored: a filled dot for every
              digit that's the right number in the right spot, a hollow dot for every digit that's right but
              misplaced.
            </p>
            {TIERS.map((tier) => {
              const affordable = player.energy >= tier.energyCost
              const previewAttempts = computeAttempts(tier.baseAttempts, player.stats.INT ?? 5)
              return (
                <button
                  key={tier.id}
                  onClick={() => startTier(tier)}
                  disabled={!affordable}
                  className="flex flex-col items-start gap-1 border-2 border-blue-500/60 bg-[#0f1020] p-3 text-left hover:bg-blue-900/40 disabled:opacity-30"
                >
                  <span className="text-sm font-bold text-blue-300">{tier.name}</span>
                  <span className="text-xs text-gray-400">{tier.flavor}</span>
                  <span className="text-xs text-gray-400">
                    {tier.N}-digit code · {tier.M}-symbol pool · {tier.allowRepeats ? 'repeats allowed' : 'no repeats'}
                  </span>
                  <span className="text-xs">
                    <span className="text-yellow-300">{tier.energyCost} energy</span>
                    {' · '}
                    <span className="text-green-400">${tier.payout.toLocaleString()} payout</span>
                    {' · '}
                    <span className="text-cyan-300">{previewAttempts} attempts</span>
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {screen === 'puzzle' && activeTier && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-2 border-gray-600 bg-[#0f1020] p-2 text-xs">
              <span>{activeTier.name}</span>
              <span>
                Attempts left: <span className="font-bold text-cyan-300">{attempts}</span> / {attemptsMax}
              </span>
            </div>

            <div className="flex justify-center gap-2">
              {currentSlots.map((v, i) => (
                <button
                  key={i}
                  onClick={() => clearSlot(i)}
                  className="flex h-10 w-10 items-center justify-center border-2 border-blue-400 bg-[#0f1020] text-lg font-bold text-blue-200 hover:bg-blue-900/40"
                >
                  {v ?? ''}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {Array.from({ length: activeTier.M }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  onClick={() => fillSlot(num)}
                  disabled={!currentSlots.includes(null)}
                  className="h-9 w-9 border-2 border-gray-500 bg-[#0f1020] font-bold text-white hover:bg-gray-700 disabled:opacity-30"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={backspace}
                className="border-2 border-gray-500 bg-[#0f1020] px-2 text-xs text-gray-300 hover:bg-gray-700"
              >
                Backspace
              </button>
            </div>

            <button
              onClick={submitGuess}
              disabled={!allSlotsFilled}
              className="w-full border-2 border-green-400 py-1.5 text-sm font-bold text-green-300 hover:bg-green-400 hover:text-black disabled:opacity-30"
            >
              Submit Guess
            </button>

            <div>
              <p className="mb-1 text-xs font-bold text-gray-400">Guess History</p>
              <div ref={historyRef} className="max-h-40 overflow-y-auto border-2 border-gray-700 bg-[#0a0a16] p-2">
                {guesses.length === 0 && <p className="text-xs text-gray-500">No guesses yet.</p>}
                {guesses.map((g, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-gray-800 py-1 text-xs last:border-b-0">
                    <span className="font-bold tracking-widest">{g.guess.join(' ')}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-sm">
                        {'●'.repeat(g.blackPegs)}
                        <span className="text-gray-500">{'○'.repeat(g.whitePegs)}</span>
                      </span>
                      <span className="text-gray-500">{g.blackPegs} exact · {g.whitePegs} partial</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={walkAway}
              className="w-full border-2 border-gray-500 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
            >
              Walk Away
            </button>
          </div>
        )}

        {screen === 'results' && resultData && (
          <div className="flex flex-col gap-2 border-2 border-blue-500 bg-[#0f1020] p-3 text-sm">
            <p className="text-center text-lg font-bold text-blue-300">
              {resultData.outcome === 'crack' ? 'Vault Cracked!' : 'The Alarm Goes Off'}
            </p>
            <p className="text-center text-xs text-gray-400">
              {resultData.tier.name} · {resultData.guessesUsed} guess{resultData.guessesUsed === 1 ? '' : 'es'} used
              (of {attemptsMax} attempts)
            </p>
            {resultData.outcome === 'crack' ? (
              <p className="text-center text-base font-bold text-green-400">
                +${resultData.res.payout.toLocaleString()}
              </p>
            ) : (
              <>
                <p className="text-center text-base font-bold text-red-400">{resultData.res.message}</p>
                <p className="text-center text-xs text-gray-400">
                  Notoriety +{resultData.tier.notorietyIncreaseOnFail} · Wanted +{resultData.tier.wantedIncreaseOnFail}
                  {resultData.res.fine > 0 && ` · Seized $${resultData.res.fine.toLocaleString()}`}
                  {resultData.res.jailed && ' · Arrested'}
                </p>
              </>
            )}
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => setScreen('tierSelect')}
                className="flex-1 border-2 border-blue-400 py-1.5 text-sm font-bold text-blue-300 hover:bg-blue-400 hover:text-black"
              >
                Back to Tier Select
              </button>
              <button
                onClick={onClose}
                className="flex-1 border-2 border-gray-600 py-1.5 text-sm text-gray-400 hover:bg-gray-700"
              >
                Leave
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
