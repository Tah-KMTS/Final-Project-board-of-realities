import { useEffect, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { createDeck, shuffle, blackjackTotal, isBlackjack } from './playingCards'
import PlayingCard from './PlayingCard'

const CARD_COUNT_CATCH_CHANCE = 0.2
const BIG_WIN_REPUTATION_THRESHOLD = 300

// Standard blackjack vs a dealer. Two ways to use this component:
//  - variant="house": self-contained, manages its own bet input and pays
//    cash directly (the flat "Neon Dragon Casino" blackjack table).
//  - variant="challenge": a fixed stake (already agreed with a specific NPC
//    in ChallengeNpc.jsx) is passed in as `fixedBet` purely for payout math -
//    this component never touches cash/inventory itself in that mode, it
//    just reports 'win' | 'lose' | 'push' back through onResolve() and lets
//    the caller settle the actual stake (cash or an item). Mirrors the
//    onVictory/onDefeat "caller decides" contract the combat engines use.
export default function Blackjack({ variant = 'house', dealerName = 'The House', minBet = 20, fixedBet = 0, onResolve }) {
  const cash = useGameStore((s) => s.cash)
  const addCash = useGameStore((s) => s.addCash)
  const addWantedLevel = useGameStore((s) => s.addWantedLevel)
  const addReputation = useGameStore((s) => s.addReputation)
  const spendEnergy = useGameStore((s) => s.spendEnergy)
  const energy = useGameStore((s) => s.player.energy)

  const [phase, setPhase] = useState(variant === 'challenge' ? 'dealing' : 'bet')
  const [bet, setBet] = useState(Math.max(minBet, 20))
  const [deck, setDeck] = useState([])
  const [playerHand, setPlayerHand] = useState([])
  const [dealerHand, setDealerHand] = useState([])
  const [revealHole, setRevealHole] = useState(false)
  const [countCards, setCountCards] = useState(false)
  const [caughtCounting, setCaughtCounting] = useState(false)
  const [message, setMessage] = useState('')
  const [outcome, setOutcome] = useState(null) // 'win' | 'lose' | 'push'

  const activeBet = variant === 'challenge' ? fixedBet : bet

  const startHand = () => {
    let usingCount = false
    if (variant === 'house') {
      if (cash < bet || bet < minBet || energy < 5) return
      if (!spendEnergy(5)) return
      addCash(-bet)
      if (countCards) {
        usingCount = true
        if (Math.random() < CARD_COUNT_CATCH_CHANCE) {
          setCaughtCounting(true)
          setCountCards(false)
          addWantedLevel(1)
          addReputation(-3)
          setPhase('result')
          setOutcome('lose')
          setMessage('Security taps your shoulder. "We saw that." You are escorted off the floor - hand forfeited.')
          return
        }
      }
    }

    let d = shuffle(createDeck())
    const pHand = [d.pop(), d.pop()]
    const dHand = [d.pop(), d.pop()]
    setDeck(d)
    setPlayerHand(pHand)
    setDealerHand(dHand)
    setRevealHole(usingCount)
    setMessage('')

    const playerBJ = isBlackjack(pHand)
    const dealerBJ = isBlackjack(dHand)
    if (playerBJ || dealerBJ) {
      resolveHand(pHand, dHand, d, true)
      return
    }
    setPhase('player')
  }

  const hit = () => {
    const d = [...deck]
    if (d.length === 0) return
    const card = d.pop()
    const pHand = [...playerHand, card]
    setDeck(d)
    setPlayerHand(pHand)
    if (blackjackTotal(pHand) > 21) {
      resolveHand(pHand, dealerHand, d, false)
      return
    }
  }

  const stand = () => {
    runDealerAndResolve(playerHand, dealerHand, deck)
  }

  const doubleDown = () => {
    if (variant !== 'house' || cash < bet) return
    addCash(-bet)
    const d = [...deck]
    if (d.length === 0) return
    const card = d.pop()
    const pHand = [...playerHand, card]
    setDeck(d)
    setPlayerHand(pHand)
    if (blackjackTotal(pHand) > 21) {
      resolveHand(pHand, dealerHand, d, false, bet * 2)
      return
    }
    runDealerAndResolve(pHand, dealerHand, d, bet * 2)
  }

  const runDealerAndResolve = (pHand, dHandStart, deckStart, betOverride) => {
    let dHand = [...dHandStart]
    let d = [...deckStart]
    while (blackjackTotal(dHand) < 17 && d.length > 0) {
      dHand.push(d.pop())
    }
    setDealerHand(dHand)
    setDeck(d)
    resolveHand(pHand, dHand, d, false, betOverride)
  }

  const resolveHand = (pHand, dHand, _d, checkedNaturals, betOverride) => {
    setRevealHole(true)
    setPhase('result')
    const usedBet = betOverride ?? activeBet
    const pTotal = blackjackTotal(pHand)
    const dTotal = blackjackTotal(dHand)
    const playerBJ = isBlackjack(pHand)
    const dealerBJ = isBlackjack(dHand)

    let result
    let payout = 0
    let msg

    if (pTotal > 21) {
      result = 'lose'
      msg = 'Bust! You lose the hand.'
    } else if (checkedNaturals && (playerBJ || dealerBJ)) {
      if (playerBJ && dealerBJ) {
        result = 'push'
        payout = usedBet
        msg = 'Both dealt naturals - push, your bet is returned.'
      } else if (playerBJ) {
        result = 'win'
        payout = Math.round(usedBet * 2.5)
        msg = 'Blackjack! Natural 21 pays 3:2.'
      } else {
        result = 'lose'
        msg = `${dealerName} has a natural blackjack.`
      }
    } else if (dTotal > 21) {
      result = 'win'
      payout = usedBet * 2
      msg = 'Dealer busts. You win!'
    } else if (pTotal > dTotal) {
      result = 'win'
      payout = usedBet * 2
      msg = 'You beat the dealer!'
    } else if (pTotal < dTotal) {
      result = 'lose'
      msg = 'Dealer wins.'
    } else {
      result = 'push'
      payout = usedBet
      msg = 'Push - your bet is returned.'
    }

    setOutcome(result)
    setMessage(msg)

    if (variant === 'house') {
      if (payout > 0) addCash(payout)
      const profit = payout - usedBet
      if (profit >= BIG_WIN_REPUTATION_THRESHOLD) addReputation(2)
    }
  }

  const playAgain = () => {
    setPhase('bet')
    setPlayerHand([])
    setDealerHand([])
    setMessage('')
    setOutcome(null)
    setRevealHole(false)
  }

  const continueChallenge = () => {
    onResolve?.(outcome)
  }

  // Challenge variant deals itself immediately on mount (no bet-input step,
  // the stake was already agreed in ChallengeNpc.jsx).
  useEffect(() => {
    if (variant === 'challenge') startHand()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="border-2 border-pink-400 bg-[#12071c] p-4 text-sm">
      <p className="mb-2 text-xs text-gray-400">
        Blackjack vs {dealerName}. Beat the dealer's hand without going over 21. Dealer hits until 17.
      </p>

      {phase === 'bet' && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="text-xs text-gray-400">Bet ($)</label>
          <input
            type="number"
            min={minBet}
            value={bet}
            onChange={(e) => setBet(Math.max(minBet, Math.floor(Number(e.target.value)) || minBet))}
            className="w-24 border border-gray-600 bg-black px-1 py-1 text-white"
          />
          <button
            onClick={startHand}
            disabled={cash < bet || bet < minBet || energy < 5}
            className="border-2 border-pink-400 px-3 py-1 font-bold text-pink-300 hover:bg-pink-400 hover:text-black disabled:opacity-30"
          >
            Deal (min ${minBet})
          </button>
          <label className={`ml-auto flex items-center gap-1 text-xs ${caughtCounting ? 'text-gray-600' : 'text-yellow-400'}`}>
            <input
              type="checkbox"
              checked={countCards}
              disabled={caughtCounting}
              onChange={(e) => setCountCards(e.target.checked)}
            />
            Count Cards (risky - {Math.round(CARD_COUNT_CATCH_CHANCE * 100)}% catch chance)
          </label>
        </div>
      )}

      {phase !== 'bet' && (
        <div className="mb-3">
          <p className="mb-1 text-xs text-gray-400">
            {dealerName}'s Hand {revealHole || phase === 'result' ? `(${blackjackTotal(dealerHand)})` : ''}
          </p>
          <div className="mb-2 flex gap-1">
            {dealerHand.map((c, i) => (
              <PlayingCard key={c.id + i} card={c} faceDown={i === 1 && !revealHole && phase !== 'result'} small />
            ))}
          </div>
          <p className="mb-1 text-xs text-gray-400">Your Hand ({blackjackTotal(playerHand)})</p>
          <div className="flex gap-1">
            {playerHand.map((c, i) => (
              <PlayingCard key={c.id + i} card={c} small />
            ))}
          </div>
        </div>
      )}

      {phase === 'player' && (
        <div className="flex gap-2">
          <button onClick={hit} className="border-2 border-green-400 px-3 py-1 font-bold text-green-300 hover:bg-green-400 hover:text-black">
            Hit
          </button>
          <button onClick={stand} className="border-2 border-red-400 px-3 py-1 font-bold text-red-300 hover:bg-red-400 hover:text-black">
            Stand
          </button>
          {variant === 'house' && playerHand.length === 2 && (
            <button
              onClick={doubleDown}
              disabled={cash < bet}
              className="border-2 border-cyan-400 px-3 py-1 font-bold text-cyan-300 hover:bg-cyan-400 hover:text-black disabled:opacity-30"
            >
              Double Down
            </button>
          )}
        </div>
      )}

      {phase === 'result' && (
        <div>
          <p
            className={`mb-3 font-bold ${
              outcome === 'win' ? 'text-green-400' : outcome === 'lose' ? 'text-red-400' : 'text-gray-300'
            }`}
          >
            {message}
          </p>
          {variant === 'house' ? (
            <button onClick={playAgain} className="border-2 border-pink-400 px-3 py-1 font-bold text-pink-300 hover:bg-pink-400 hover:text-black">
              Play Again
            </button>
          ) : (
            <button onClick={continueChallenge} className="border-2 border-pink-400 px-3 py-1 font-bold text-pink-300 hover:bg-pink-400 hover:text-black">
              Continue
            </button>
          )}
        </div>
      )}
    </div>
  )
}
