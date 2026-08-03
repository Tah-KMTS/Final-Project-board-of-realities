import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { JOB_ENERGY_COST } from './marketData'

// Bank "Read the Room" - replaces the old flat-click Work Shift button with
// an inductive rule-learning + classification puzzle. A hidden approval rule
// (scaled in complexity by job tier) decides Approve/Reject for a
// "transaction". The player studies untimed worked examples, then classifies
// a fresh queue themselves; final accuracy scales the payout.
//
// Self-contained like VaultCrackModal.jsx: own onClose, internal screen-state
// machine ('setup' | 'briefing' | 'queue' | 'results'), all puzzle state
// local to this component (generated fresh per shift, nothing persisted to
// the store beyond the existing energy/cash/reputation actions it calls).

const TIER_CONFIG = {
  clerk: { baseExamples: 3, queueSize: 4 },
  analyst: { baseExamples: 4, queueSize: 5 },
  manager: { baseExamples: 5, queueSize: 6 },
  executive: { baseExamples: 6, queueSize: 7 },
}

const AMOUNT_MIN = 100
const AMOUNT_MAX = 9000
const RISK_LEVELS = ['Low', 'Medium', 'High']

function randomAmount() {
  return Math.round((AMOUNT_MIN + Math.random() * (AMOUNT_MAX - AMOUNT_MIN)) / 50) * 50
}
function randomBool() {
  return Math.random() < 0.5
}
function randomRisk() {
  return RISK_LEVELS[Math.floor(Math.random() * RISK_LEVELS.length)]
}
function randomTenure() {
  return 1 + Math.floor(Math.random() * 15)
}
// A threshold that keeps roughly a plausible approve/reject split against
// the AMOUNT_MIN..AMOUNT_MAX range above.
function rollThreshold() {
  return Math.round((2000 + Math.random() * 3000) / 100) * 100
}

// Rule complexity scales distinctly by tier - not just more examples, an
// actually different shape of rule:
//  - clerk:     1-variable threshold on amount alone.
//  - analyst:   2-variable AND (amount AND documentation).
//  - manager:   adds an OR/exception clause (documented-and-under-threshold,
//               OR flagged Low risk regardless of amount).
//  - executive: same 3-variable rule PLUS a nested "unless" exception (High
//               risk is an automatic reject, overriding everything else)
//               PLUS a red-herring attribute (clientTenureYears) that is
//               shown on every item but has zero effect on the true label -
//               tests whether the player overfits to noise.
function evaluateRule(tierId, threshold, item) {
  switch (tierId) {
    case 'clerk':
      return item.amount < threshold
    case 'analyst':
      return item.amount < threshold && item.hasDocumentation
    case 'manager':
      return (item.amount < threshold && item.hasDocumentation) || item.riskFlag === 'Low'
    case 'executive':
      if (item.riskFlag === 'High') return false
      return (item.amount < threshold && item.hasDocumentation) || item.riskFlag === 'Low'
    default:
      return item.amount < threshold
  }
}

// Which attributes are actually shown to the player for a given tier -
// mirrors evaluateRule's variable count exactly, except executive's extra
// red-herring attribute (clientTenureYears), which is shown but plays no
// part in evaluateRule('executive', ...) above.
const TIER_ATTRIBUTES = {
  clerk: ['amount'],
  analyst: ['amount', 'hasDocumentation'],
  manager: ['amount', 'hasDocumentation', 'riskFlag'],
  executive: ['amount', 'hasDocumentation', 'riskFlag', 'clientTenureYears'],
}

function generateItem(tierId, threshold) {
  const item = {
    amount: randomAmount(),
    hasDocumentation: randomBool(),
    riskFlag: randomRisk(),
    clientTenureYears: randomTenure(),
  }
  return { ...item, approved: evaluateRule(tierId, threshold, item) }
}

// Regenerates the whole batch (bounded retries) until at least one Approve
// and one Reject appear - an all-one-label example/queue set would be
// useless for the player to learn from or be graded fairly against.
function generateBalancedSet(tierId, threshold, count) {
  if (count < 2) return [generateItem(tierId, threshold)]
  for (let attempt = 0; attempt < 50; attempt++) {
    const items = Array.from({ length: count }, () => generateItem(tierId, threshold))
    const hasApprove = items.some((i) => i.approved)
    const hasReject = items.some((i) => !i.approved)
    if (hasApprove && hasReject) return items
  }
  return Array.from({ length: count }, () => generateItem(tierId, threshold))
}

function renderAttr(key, value) {
  switch (key) {
    case 'amount':
      return `Amount: $${value.toLocaleString()}`
    case 'hasDocumentation':
      return `Documentation: ${value ? 'Provided' : 'Missing'}`
    case 'riskFlag':
      return `Risk Flag: ${value}`
    case 'clientTenureYears':
      return `Client Tenure: ${value} yr${value === 1 ? '' : 's'}`
    default:
      return `${key}: ${String(value)}`
  }
}

function TransactionCard({ item, tierId, showLabel }) {
  const attrs = TIER_ATTRIBUTES[tierId] || TIER_ATTRIBUTES.clerk
  return (
    <div className="border-2 border-gray-600 bg-[#0f1020] p-2 text-xs">
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {attrs.map((key) => (
          <span key={key} className="text-gray-300">{renderAttr(key, item[key])}</span>
        ))}
      </div>
      {showLabel && (
        <p className={`mt-1 font-bold ${item.approved ? 'text-green-400' : 'text-red-400'}`}>
          {item.approved ? 'APPROVED' : 'REJECTED'}
        </p>
      )}
    </div>
  )
}

export default function WorkShiftModal({ onClose }) {
  const player = useGameStore((s) => s.player)
  const spendEnergy = useGameStore((s) => s.spendEnergy)
  const currentJobTier = useGameStore((s) => s.currentJobTier)
  const addCash = useGameStore((s) => s.addCash)
  const addReputation = useGameStore((s) => s.addReputation)

  const [screen, setScreen] = useState('setup') // 'setup' | 'briefing' | 'queue' | 'results'
  const [tier, setTier] = useState(null)
  const [examples, setExamples] = useState([])
  const [queue, setQueue] = useState([])
  const [queueIndex, setQueueIndex] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [pendingFeedback, setPendingFeedback] = useState(null)
  const [resultData, setResultData] = useState(null)

  const previewTier = currentJobTier()
  const canWork = player.energy >= JOB_ENERGY_COST

  const startShift = () => {
    if (!spendEnergy(JOB_ENERGY_COST)) return
    const activeTier = currentJobTier()
    // INT is read once, right here at shift start via getState() (not the
    // reactive `player` above) - the example budget is locked in for the
    // whole shift, same convention VaultCrackModal uses for its attempts
    // budget.
    const INT = useGameStore.getState().player.stats.INT ?? 5
    const config = TIER_CONFIG[activeTier.id] || TIER_CONFIG.clerk
    const exampleCount = config.baseExamples + Math.max(0, Math.floor((INT - 5) / 6))
    const th = rollThreshold()

    setTier(activeTier)
    setExamples(generateBalancedSet(activeTier.id, th, exampleCount))
    setQueue(generateBalancedSet(activeTier.id, th, config.queueSize))
    setQueueIndex(0)
    setCorrectCount(0)
    setPendingFeedback(null)
    setResultData(null)
    setScreen('briefing')
  }

  const answer = (choiceApproved) => {
    const item = queue[queueIndex]
    const correct = choiceApproved === item.approved
    if (correct) setCorrectCount((c) => c + 1)
    setPendingFeedback({ item, correct })
  }

  const finishShift = (finalCorrectCount) => {
    const accuracy = finalCorrectCount / queue.length
    let multiplier
    let repHit = 0
    if (accuracy >= 0.9) multiplier = 1.5
    else if (accuracy >= 0.7) multiplier = 1.0
    else if (accuracy >= 0.5) multiplier = 0.6
    else {
      multiplier = 0.25
      repHit = -3
    }
    const payout = Math.round(tier.pay * multiplier)
    addCash(payout)
    if (repHit) addReputation(repHit)
    setResultData({ accuracy, payout, multiplier, repHit, correctCount: finalCorrectCount, queueSize: queue.length })
    setScreen('results')
  }

  const advance = () => {
    const item = pendingFeedback.item
    setExamples((prev) => [...prev, item])
    setPendingFeedback(null)
    const nextIndex = queueIndex + 1
    if (nextIndex >= queue.length) {
      // The user had to click through the feedback screen (a separate render
      // pass) to reach this click, so correctCount already reflects answer()'s
      // update for this item - safe to read directly rather than re-derive.
      finishShift(correctCount)
    } else {
      setQueueIndex(nextIndex)
    }
  }

  const walkAway = () => {
    setScreen('setup')
    setTier(null)
    setExamples([])
    setQueue([])
    setQueueIndex(0)
    setCorrectCount(0)
    setPendingFeedback(null)
    setResultData(null)
  }

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

        <h2 className="mb-2 text-xl font-bold text-blue-300">Work Shift — Read the Room</h2>

        {screen === 'setup' && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-400">
              The bank has a hidden approval rule for today's transactions. Study the worked examples, then classify
              the queue yourself - your accuracy decides your pay. No timer.
            </p>
            <div className="border-2 border-gray-600 bg-[#0f1020] p-3 text-sm">
              <p className="mb-1 font-bold">Job: {previewTier.label}</p>
              <p className="text-xs text-gray-400">
                Base pay: <span className="text-green-400">${previewTier.pay}</span> · costs{' '}
                <span className="text-yellow-300">{JOB_ENERGY_COST} energy</span>
              </p>
            </div>
            <button
              onClick={startShift}
              disabled={!canWork}
              className="w-full border-2 border-green-400 bg-green-500 py-1.5 text-sm font-bold text-black hover:bg-green-400 disabled:opacity-40"
            >
              {canWork ? 'Start Shift' : `Not enough energy (${player.energy}/${JOB_ENERGY_COST})`}
            </button>
            <button
              onClick={onClose}
              className="w-full border-2 border-gray-500 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        )}

        {screen === 'briefing' && tier && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-400">
              Worked examples - already decided by the bank. Study them to infer the approval rule.
            </p>
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
              {examples.map((ex, i) => (
                <TransactionCard key={i} item={ex} tierId={tier.id} showLabel />
              ))}
            </div>
            <button
              onClick={() => setScreen('queue')}
              className="w-full border-2 border-blue-400 py-1.5 text-sm font-bold text-blue-300 hover:bg-blue-400 hover:text-black"
            >
              Begin Queue
            </button>
            <button
              onClick={walkAway}
              className="w-full border-2 border-gray-500 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
            >
              Walk Away
            </button>
          </div>
        )}

        {screen === 'queue' && tier && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-2 border-gray-600 bg-[#0f1020] p-2 text-xs">
              <span>Transaction {queueIndex + 1} / {queue.length}</span>
              <span>Correct so far: <span className="text-cyan-300 font-bold">{correctCount}</span></span>
            </div>

            {!pendingFeedback && (
              <>
                <TransactionCard item={queue[queueIndex]} tierId={tier.id} showLabel={false} />
                <div className="flex gap-2">
                  <button
                    onClick={() => answer(true)}
                    className="flex-1 border-2 border-green-400 py-1.5 text-sm font-bold text-green-400 hover:bg-green-400 hover:text-black"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => answer(false)}
                    className="flex-1 border-2 border-red-400 py-1.5 text-sm font-bold text-red-400 hover:bg-red-400 hover:text-black"
                  >
                    Reject
                  </button>
                </div>
              </>
            )}

            {pendingFeedback && (
              <div className="border-2 border-gray-600 bg-[#0f1020] p-3 text-center">
                <p className={`text-sm font-bold ${pendingFeedback.correct ? 'text-green-400' : 'text-red-400'}`}>
                  {pendingFeedback.correct ? 'Correct!' : 'Incorrect.'}
                </p>
                <p className="mb-2 text-xs text-gray-400">
                  True call: {pendingFeedback.item.approved ? 'APPROVED' : 'REJECTED'}
                </p>
                <button
                  onClick={advance}
                  className="w-full border-2 border-blue-400 py-1.5 text-sm font-bold text-blue-300 hover:bg-blue-400 hover:text-black"
                >
                  {queueIndex + 1 >= queue.length ? 'See Results' : 'Next Transaction'}
                </button>
              </div>
            )}

            <div>
              <p className="mb-1 text-xs font-bold text-gray-400">Examples So Far</p>
              <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
                {examples.map((ex, i) => (
                  <TransactionCard key={i} item={ex} tierId={tier.id} showLabel />
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
            <p className="text-center text-lg font-bold text-blue-300">Shift Complete</p>
            <p className="text-center text-xs text-gray-400">
              Accuracy: {Math.round(resultData.accuracy * 100)}% ({resultData.correctCount}/{resultData.queueSize})
            </p>
            <p className="text-center text-base font-bold text-green-400">
              +${resultData.payout.toLocaleString()} ({resultData.multiplier}x pay)
            </p>
            {resultData.repHit < 0 && (
              <p className="text-center text-xs text-red-400">Reputation {resultData.repHit}</p>
            )}
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => setScreen('setup')}
                className="flex-1 border-2 border-blue-400 py-1.5 text-sm font-bold text-blue-300 hover:bg-blue-400 hover:text-black"
              >
                Work Another Shift
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
