import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { clamp, computeFavorability } from './crimeDifficulty'
import { playGoodHitSound, playBadHitSound, playPurchaseSound, playClickSound, playVictorySound, playDefeatSound } from '../../audio/sfx'

const ITEM_NAMES = [
  'a gold watch', 'a case of bootleg cigarettes', 'a stack of blank checks', 'a fur coat',
  'a crate of "salvaged" electronics', 'a briefcase of loose jewelry', 'a set of silver flatware',
  'a pallet of designer knockoffs', 'a box of untraceable phones', "a dead man's signet ring",
]

// Black Market's minigame - "The Fence's Table". Replaces the shared
// LeverageMeter race with a haggling decision ladder: items appear one at a
// time (endlessly - there's no fixed item count, same "race to target
// before the cap" shape every Underworld minigame uses), and the ONLY
// choice per item is Take (bank the fence's lowball offer, zero Suspicion
// risk), Push (a favorability-weighted shot at a much bigger cut - miss and
// you bank nothing AND eat a flat, notoriety-scaled Suspicion hit), or Skip
// (nothing either way). A small passive Suspicion trickle per item shown
// (not per second, unlike LeverageMeter/CallCenterQTEModal/TheCircuitModal
// - Black Market's tension is "how many chances did you take," not a real-
// time clock) keeps endless Skipping from being a risk-free stall. Same
// stakes shape and resolve()->applyCrimeOutcome contract as LeverageMeter.
export default function FencesTableModal({
  onClose,
  embedded = false,
  title = 'The Fence\'s Table',
  markName = 'A Fence Who Asks No Questions',
  markDescription = '',
  buttonLabel = 'Haggle',
  stakes,
}) {
  const {
    target,
    suspicionCap = 100,
    payout,
    notorietyIncreaseOnFail,
    wantedIncreaseOnFail,
    reputationDeltaOnFail,
    assetSeizureOnFail,
    jailChanceOnFail,
    energyCost,
    baseSuccessChance,
    syndicateId = null,
    inHomeTurf = false,
  } = stakes

  const player = useGameStore((s) => s.player)
  const spendEnergy = useGameStore((s) => s.spendEnergy)
  const applyCrimeOutcome = useGameStore((s) => s.applyCrimeOutcome)
  const addReputation = useGameStore((s) => s.addReputation)
  const declineSyndicateJob = useGameStore((s) => s.declineSyndicateJob)

  const [screen, setScreen] = useState('intro') // 'intro' | 'race' | 'result'
  const [locked, setLocked] = useState(null)
  const [leverage, setLeverage] = useState(0)
  const [suspicion, setSuspicion] = useState(0)
  const [item, setItem] = useState(null)
  const [itemNum, setItemNum] = useState(0)
  const [lastOutcome, setLastOutcome] = useState(null) // brief flash text for the last Push/Take
  const [resultData, setResultData] = useState(null)

  const rollItem = () => {
    const name = ITEM_NAMES[Math.floor(Math.random() * ITEM_NAMES.length)]
    return { name }
  }

  const resolve = (success) => {
    const res = applyCrimeOutcome({
      success,
      payout,
      notorietyIncreaseOnFail,
      wantedIncreaseOnFail,
      assetSeizureOnFail,
      jailChanceOnFail,
      syndicateId,
      inHomeTurf,
    })
    if (!success && reputationDeltaOnFail) addReputation(reputationDeltaOnFail)
    if (success) playVictorySound()
    else playDefeatSound()
    setResultData({ success, res })
    setScreen('result')
  }

  const begin = () => {
    if (player.energy < energyCost) return
    if (!spendEnergy(energyCost)) return
    const favorability = computeFavorability(baseSuccessChance)
    const streetwise = player.stats.streetwise ?? 5
    const notoriety = useGameStore.getState().notoriety ?? 0
    const lowball = Math.max(6, Math.round(target / 9))
    // Range width narrows with streetwise - "better information," not a
    // better roll (the roll itself is favorability-biased below,
    // identically regardless of streetwise).
    const width = Math.max(10, 30 - streetwise * 1.5)
    const params = {
      favorability,
      lowball,
      pushMin: lowball + 10,
      pushMax: lowball + 10 + width,
      // Notoriety-scaled: a more notorious player draws a harder reaction
      // when a Push falls through, same convention LookoutWatchModal's
      // Safe-window shrink and CallCenterQTEModal/TheCircuitModal's flat
      // miss costs all lean on.
      pushFailSuspicion: Math.max(8, Math.round(suspicionCap / 9) + Math.round(notoriety * 0.15)),
      itemPassiveSuspicion: Math.max(1, Math.round(suspicionCap / 60)),
    }
    setLocked(params)
    setLeverage(0)
    setSuspicion(0)
    setItemNum(1)
    setItem(rollItem())
    setLastOutcome(null)
    setResultData(null)
    setScreen('race')
  }

  const nextItem = (leverageDelta, suspicionDelta, outcomeText) => {
    const newLeverage = leverage + leverageDelta
    const newSuspicion = suspicion + suspicionDelta + locked.itemPassiveSuspicion
    setLeverage(newLeverage)
    setSuspicion(newSuspicion)
    setLastOutcome(outcomeText)
    if (newLeverage >= target) {
      resolve(true)
      return
    }
    if (newSuspicion >= suspicionCap) {
      resolve(false)
      return
    }
    setItemNum((n) => n + 1)
    setItem(rollItem())
  }

  const handleTake = () => {
    playPurchaseSound()
    nextItem(locked.lowball, 0, `Took the lowball offer - +${locked.lowball} leverage.`)
  }

  const handlePush = () => {
    const hit = Math.random() < locked.favorability
    if (hit) {
      playGoodHitSound()
      const rollFrac = clamp(0, 1, 0.5 + (locked.favorability - 0.5))
      const value = Math.round(locked.pushMin + rollFrac * (locked.pushMax - locked.pushMin))
      nextItem(value, 0, `Pushed and got it - +${value} leverage.`)
    } else {
      playBadHitSound()
      nextItem(0, locked.pushFailSuspicion, `He balked. Nothing banked, +${locked.pushFailSuspicion} suspicion.`)
    }
  }

  const handleSkip = () => {
    playClickSound()
    nextItem(0, 0, 'Passed on that one.')
  }

  const walkAway = () => {
    setLocked(null)
    setScreen('intro')
    if (syndicateId) declineSyndicateJob(syndicateId)
  }

  const leveragePct = target > 0 ? clamp(0, 100, (leverage / target) * 100) : 0
  const suspicionPct = suspicionCap > 0 ? clamp(0, 100, (suspicion / suspicionCap) * 100) : 0

  const body = (
    <>
      {!embedded && (
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 border border-gray-500 px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-600 hover:text-white"
        >
          X
        </button>
      )}

      <h2 className="mb-2 text-xl font-bold text-purple-300">{title}</h2>

      {screen === 'intro' && (
        <div className="flex flex-col gap-3">
          <div className="border-2 border-purple-500/60 bg-[#0f1020] p-3">
            <p className="text-sm font-bold text-purple-300">{markName}</p>
            {markDescription && <p className="mt-1 text-xs text-gray-400">{markDescription}</p>}
          </div>
          <p className="text-xs text-gray-400">
            Item by item: Take the safe lowball, Push for more and risk him getting cold feet, or Skip and move on.
          </p>
          <div className="grid grid-cols-2 gap-y-1 text-xs">
            <span className="uppercase tracking-widest text-gray-500">Energy Cost</span>
            <span className="text-right text-yellow-300">{energyCost}</span>
            <span className="uppercase tracking-widest text-gray-500">Payout</span>
            <span className="text-right text-green-400">${payout.toLocaleString()}</span>
          </div>
          <button
            onClick={begin}
            disabled={player.energy < energyCost}
            className="w-full border-2 border-purple-400 py-1.5 text-sm font-bold uppercase tracking-widest text-purple-300 hover:bg-purple-400 hover:text-black disabled:opacity-30"
          >
            Begin
          </button>
        </div>
      )}

      {screen === 'race' && locked && item && (
        <div className="flex flex-col gap-3">
          <div className="border-2 border-purple-500/60 bg-[#0f1020] p-3 text-center">
            <p className="text-xs uppercase tracking-widest text-gray-500">Item {itemNum}</p>
            <p className="text-sm font-bold text-purple-200">{item.name}</p>
            <p className="mt-1 text-xs text-gray-400">Lowball offer: {locked.lowball}</p>
          </div>

          <div>
            <div className="mb-0.5 flex items-center justify-between text-xs uppercase tracking-widest text-cyan-300">
              <span>Leverage</span>
              <span>{Math.floor(leverage)} / {target}</span>
            </div>
            <div className="h-5 w-full border-2 border-cyan-500 bg-[#0a0a16]">
              <div className="h-full bg-cyan-500 transition-[width] duration-150" style={{ width: `${leveragePct}%` }} />
            </div>
          </div>

          <div>
            <div className="mb-0.5 flex items-center justify-between text-xs uppercase tracking-widest text-red-400">
              <span>Suspicion</span>
              <span>{Math.floor(suspicion)} / {suspicionCap}</span>
            </div>
            <div className="h-5 w-full border-2 border-red-500 bg-[#0a0a16]">
              <div
                className={`h-full bg-red-600 transition-[width] duration-150 ${suspicionPct > 75 ? 'animate-pulse' : ''}`}
                style={{ width: `${suspicionPct}%` }}
              />
            </div>
          </div>

          {lastOutcome && <p className="text-center text-xs italic text-gray-400">{lastOutcome}</p>}

          <div className="grid grid-cols-3 gap-2">
            <button onClick={handleTake} className="border-2 border-green-500 py-2 text-xs font-bold uppercase text-green-300 hover:bg-green-500 hover:text-black">
              Take
            </button>
            <button onClick={handlePush} className="border-2 border-purple-400 py-2 text-xs font-bold uppercase text-purple-300 hover:bg-purple-400 hover:text-black">
              {buttonLabel}
            </button>
            <button onClick={handleSkip} className="border-2 border-gray-500 py-2 text-xs font-bold uppercase text-gray-300 hover:bg-gray-500 hover:text-black">
              Skip
            </button>
          </div>

          <button onClick={walkAway} className="w-full border-2 border-gray-500 py-1.5 text-xs text-gray-300 hover:bg-gray-700">
            Walk Away
          </button>
        </div>
      )}

      {screen === 'result' && resultData && (
        <div className="flex flex-col gap-2 border-2 border-purple-500 bg-[#0f1020] p-3 text-sm">
          <p className="text-center text-lg font-bold text-purple-300">{resultData.success ? 'Deal Closed' : 'He Walked'}</p>
          {resultData.success ? (
            <p className="text-center text-base font-bold text-green-400">+${resultData.res.payout.toLocaleString()}</p>
          ) : (
            <>
              <p className="text-center text-base font-bold text-red-400">{resultData.res.message}</p>
              <p className="text-center text-xs text-gray-400">
                Notoriety +{notorietyIncreaseOnFail} &middot; Wanted +{wantedIncreaseOnFail}
                {!!reputationDeltaOnFail && ` · Reputation ${reputationDeltaOnFail > 0 ? '+' : ''}${reputationDeltaOnFail}`}
                {resultData.res.fine > 0 && ` · Seized $${resultData.res.fine.toLocaleString()}`}
                {resultData.res.jailed && ' · Arrested'}
              </p>
            </>
          )}
          <div className="mt-1 flex gap-2">
            <button
              onClick={() => setScreen('intro')}
              className="flex-1 border-2 border-purple-400 py-1.5 text-sm font-bold text-purple-300 hover:bg-purple-400 hover:text-black"
            >
              Try Again
            </button>
            <button onClick={onClose} className="flex-1 border-2 border-gray-600 py-1.5 text-sm text-gray-400 hover:bg-gray-700">
              Leave
            </button>
          </div>
        </div>
      )}
    </>
  )

  if (embedded) return body

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="glass-panel relative w-[480px] max-h-[85vh] overflow-y-auto border-4 border-purple-500 bg-[#1c1d3a] p-6 font-mono text-white">
        {body}
      </div>
    </div>
  )
}
