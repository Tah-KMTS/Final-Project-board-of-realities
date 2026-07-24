import { useEffect, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { createDeck, shuffle, evaluateHand, compareHands } from './playingCards'
import { randomCasinoNpc } from './casinoNpcs'
import PlayingCard from './PlayingCard'

const BIG_WIN_REPUTATION_THRESHOLD = 300
const MAX_DISCARD = 3 // standard draw-poker house rule (real games special-case a 4-of-a-kind draw's kicker; skipped here)

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function cardHighValue(card) {
  return card.rankIndex === 0 ? 14 : card.rankIndex + 1
}

// Simple discard heuristic: keep anything that's part of a pair-or-better,
// otherwise keep only the single highest card and redraw the rest (capped
// at MAX_DISCARD). Not a full expected-value solver, just a believable NPC.
function npcDraw(hand, deck) {
  const rankCounts = {}
  for (const c of hand) rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1
  let keep = hand.filter((c) => rankCounts[c.rank] >= 2)
  if (keep.length === 0) {
    const sorted = [...hand].sort((a, b) => cardHighValue(b) - cardHighValue(a))
    keep = [sorted[0]]
  }
  const discardCount = Math.min(5 - keep.length, MAX_DISCARD)
  const finalKeep = keep.slice(0, 5 - discardCount)
  const d = [...deck]
  const drawn = []
  for (let i = 0; i < discardCount; i++) drawn.push(d.pop())
  return { hand: [...finalKeep, ...drawn], deck: d }
}

const TELL_STRONG = [
  'Their hands are steady. This feels like real strength.',
  'Ice-cold expression - that is not a bluff.',
  'They are already stacking chips in their head.',
]
const TELL_WEAK = [
  'Their eye keeps twitching - nervous energy.',
  "They're stalling a beat too long. Something's off.",
  'A little too much bravado for a hand this quiet.',
]
const TELL_NEUTRAL = [
  'Hard to say. They are playing it cool.',
  'No obvious tell this time.',
  'Unreadable. Could genuinely be anything.',
]

// Uses the player's PER (Perception) stat as the "charisma"/read-people stat
// for this mechanic - Board of Realities' player model doesn't have a
// distinct charisma stat (see player.stats: STR/AGI/INT/VIT/PER), and PER is
// the closest existing analog for "reading a tell" in the RPG stat sheet.
function generateTellHint(npcHandEval, npcTellSkill, playerPER) {
  const readChance = Math.min(0.9, Math.max(0.15, 0.4 + (playerPER - npcTellSkill) * 0.05))
  const isStrong = npcHandEval.rank >= 3 // three-of-a-kind or better
  const isWeak = npcHandEval.rank <= 1 // high card or one pair
  const accurate = Math.random() < readChance
  let bucket
  if (accurate) {
    bucket = isStrong ? TELL_STRONG : isWeak ? TELL_WEAK : TELL_NEUTRAL
  } else {
    if (isStrong) bucket = TELL_WEAK
    else if (isWeak) bucket = TELL_STRONG
    else bucket = Math.random() < 0.5 ? TELL_STRONG : TELL_WEAK
  }
  return pick(bucket)
}

function npcRespondsToRaise(npcHandEval, npcTellSkill, playerPER, raiseSizeRelativeToPot) {
  const confidence = npcHandEval.rank / 8
  let foldChance = 0.55 - confidence * 0.45 + (playerPER - npcTellSkill) * 0.03 + raiseSizeRelativeToPot * 0.1
  foldChance = Math.min(0.9, Math.max(0.05, foldChance))
  return Math.random() < foldChance // true = NPC folds
}

// 5-card draw, heads-up vs one NPC, single betting round after the draw.
// Same two-mode contract as Blackjack.jsx: variant="house" manages its own
// ante and settles cash itself (a fresh regular sits down each hand);
// variant="challenge" plays for a stake already agreed in ChallengeNpc.jsx,
// reports 'win' | 'lose' | 'push' via onResolve(), and never touches
// cash/inventory directly.
export default function Poker({ variant = 'house', npc, fixedStake = 0, onResolve }) {
  const cash = useGameStore((s) => s.cash)
  const addCash = useGameStore((s) => s.addCash)
  const addReputation = useGameStore((s) => s.addReputation)
  const spendEnergy = useGameStore((s) => s.spendEnergy)
  const player = useGameStore((s) => s.player)
  const playerPER = player.stats?.PER ?? 5

  const [phase, setPhase] = useState(variant === 'challenge' ? 'loading' : 'ante')
  const [anteInput, setAnteInput] = useState(20)
  const [ante, setAnte] = useState(0)
  const [activeNpc, setActiveNpc] = useState(npc || randomCasinoNpc())
  const [deck, setDeck] = useState([])
  const [playerHand, setPlayerHand] = useState([])
  const [npcHand, setNpcHand] = useState([])
  const [held, setHeld] = useState([false, false, false, false, false])
  const [tellHint, setTellHint] = useState('')
  const [raiseInput, setRaiseInput] = useState(0)
  const [message, setMessage] = useState('')
  const [outcome, setOutcome] = useState(null)

  const startHand = () => {
    const useAnte = variant === 'challenge' ? fixedStake : anteInput
    if (variant === 'house') {
      if (cash < useAnte || player.energy < 5) return
      if (!spendEnergy(5)) return
      addCash(-useAnte)
    }
    const useNpc = variant === 'challenge' ? npc : randomCasinoNpc()
    let d = shuffle(createDeck())
    const pHand = d.splice(d.length - 5, 5)
    const nHand = d.splice(d.length - 5, 5)
    setActiveNpc(useNpc)
    setAnte(useAnte)
    setDeck(d)
    setPlayerHand(pHand)
    setNpcHand(nHand)
    setHeld([false, false, false, false, false])
    setMessage('')
    setOutcome(null)
    setRaiseInput(0)
    setPhase('dealt')
  }

  useEffect(() => {
    if (variant === 'challenge') startHand()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleHold = (i) => {
    setHeld((h) => h.map((v, idx) => (idx === i ? !v : v)))
  }

  const drawCards = () => {
    let d = [...deck]
    const newHand = playerHand.map((c, i) => (held[i] ? c : d.pop()))
    const npcResult = npcDraw(npcHand, d)
    setPlayerHand(newHand)
    setNpcHand(npcResult.hand)
    setDeck(npcResult.deck)
    const npcEval = evaluateHand(npcResult.hand)
    setTellHint(generateTellHint(npcEval, activeNpc.tellSkill, playerPER))
    setPhase('drawn')
  }

  const finalize = (result, payout, msg) => {
    setPhase('showdown')
    setOutcome(result)
    setMessage(msg)
    if (variant === 'house') {
      if (payout > 0) addCash(payout)
      if (payout >= BIG_WIN_REPUTATION_THRESHOLD) addReputation(2)
    }
  }

  const resolveShowdown = (raiseAmt, npcFolded) => {
    if (npcFolded) {
      finalize('win', (ante * 2) + raiseAmt, `${activeNpc.name} folds. You take the pot.`)
      return
    }
    const playerEval = evaluateHand(playerHand)
    const npcEval = evaluateHand(npcHand)
    const cmp = compareHands(playerEval, npcEval)
    const total = (ante + raiseAmt) * 2
    if (cmp > 0) finalize('win', total, `You win with ${playerEval.name} vs their ${npcEval.name}!`)
    else if (cmp < 0) finalize('lose', 0, `${activeNpc.name} wins with ${npcEval.name} vs your ${playerEval.name}.`)
    else finalize('push', ante + raiseAmt, `Split pot - you both show ${playerEval.name}.`)
  }

  const doFold = () => finalize('lose', 0, `You fold. ${activeNpc.name} takes the pot.`)
  const doCall = () => resolveShowdown(0, false)
  const doRaise = () => {
    if (variant !== 'house') return
    const maxRaise = Math.max(0, cash - ante)
    const amt = Math.min(raiseInput, maxRaise)
    if (amt <= 0) return
    addCash(-amt)
    const npcEval = evaluateHand(npcHand)
    const npcFolds = npcRespondsToRaise(npcEval, activeNpc.tellSkill, playerPER, amt / (ante * 2 || 1))
    resolveShowdown(amt, npcFolds)
  }

  const playAgain = () => setPhase('ante')
  const continueChallenge = () => onResolve?.(outcome)

  return (
    <div className="border-2 border-pink-400 bg-[#12071c] p-4 text-sm">
      <p className="mb-2 text-xs text-gray-400">
        5-Card Draw vs {activeNpc.name} ({activeNpc.title}). Your Perception stat helps you read their tells - and helps you sell a bluff.
      </p>

      {phase === 'ante' && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="text-xs text-gray-400">Ante ($)</label>
          <input
            type="number"
            min={10}
            value={anteInput}
            onChange={(e) => setAnteInput(Math.max(10, Math.floor(Number(e.target.value)) || 10))}
            className="w-24 border border-gray-600 bg-black px-1 py-1 text-white"
          />
          <button
            onClick={startHand}
            disabled={cash < anteInput || player.energy < 5}
            className="border-2 border-pink-400 px-3 py-1 font-bold text-pink-300 hover:bg-pink-400 hover:text-black disabled:opacity-30"
          >
            Sit Down
          </button>
        </div>
      )}

      {(phase === 'dealt' || phase === 'drawn' || phase === 'showdown') && (
        <div className="mb-3">
          <p className="mb-1 text-xs text-gray-400">
            {activeNpc.name}'s Hand {phase === 'showdown' ? `(${evaluateHand(npcHand).name})` : ''}
          </p>
          <div className="mb-2 flex gap-1">
            {npcHand.map((c, i) => (
              <PlayingCard key={c.id + i} card={c} faceDown={phase !== 'showdown'} small />
            ))}
          </div>
          <p className="mb-1 text-xs text-gray-400">
            Your Hand {phase !== 'dealt' ? `(${evaluateHand(playerHand).name})` : ''}
          </p>
          <div className="flex gap-1">
            {playerHand.map((c, i) => (
              <div key={c.id + i} className="flex flex-col items-center gap-1">
                <PlayingCard card={c} small />
                {phase === 'dealt' && (
                  <label className="flex items-center gap-0.5 text-[10px] text-gray-400">
                    <input type="checkbox" checked={held[i]} onChange={() => toggleHold(i)} /> hold
                  </label>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === 'dealt' && (
        <button onClick={drawCards} className="border-2 border-cyan-400 px-3 py-1 font-bold text-cyan-300 hover:bg-cyan-400 hover:text-black">
          Draw (replace unheld cards)
        </button>
      )}

      {phase === 'drawn' && (
        <div>
          <p className="mb-2 italic text-yellow-300">"{tellHint}"</p>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={doFold} className="border-2 border-red-400 px-3 py-1 font-bold text-red-300 hover:bg-red-400 hover:text-black">
              Fold
            </button>
            <button onClick={doCall} className="border-2 border-green-400 px-3 py-1 font-bold text-green-300 hover:bg-green-400 hover:text-black">
              Call
            </button>
            {variant === 'house' && (
              <>
                <input
                  type="number"
                  min={1}
                  value={raiseInput}
                  onChange={(e) => setRaiseInput(Math.max(0, Math.floor(Number(e.target.value)) || 0))}
                  className="w-20 border border-gray-600 bg-black px-1 py-1 text-white"
                />
                <button
                  onClick={doRaise}
                  disabled={raiseInput <= 0 || cash < ante}
                  className="border-2 border-purple-400 px-3 py-1 font-bold text-purple-300 hover:bg-purple-400 hover:text-black disabled:opacity-30"
                >
                  Raise & Bluff
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {phase === 'showdown' && (
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
              Next Hand
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
