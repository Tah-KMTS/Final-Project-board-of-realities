import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { calculateAtonementCost } from './templeEngine'

export default function TempleModal({ onClose }) {
  const cash = useGameStore((s) => s.cash)
  const wantedLevel = useGameStore((s) => s.wantedLevel)
  const notoriety = useGameStore((s) => s.notoriety)
  const addCash = useGameStore((s) => s.addCash)
  const addWantedLevel = useGameStore((s) => s.addWantedLevel)
  const addNotoriety = useGameStore((s) => s.addNotoriety)
  const executeCrime = useGameStore((s) => s.executeCrime)

  const [feedbackMsg, setFeedbackMsg] = useState(null)

  const atonementCost = calculateAtonementCost(wantedLevel, notoriety, cash)

  const handleDonate = () => {
    if (cash < atonementCost) {
      setFeedbackMsg("You don't have enough money to show true penance.")
      return
    }
    addCash(-atonementCost)
    if (wantedLevel > 0) addWantedLevel(-1)
    if (notoriety > 0) addNotoriety(-15)
    setFeedbackMsg(`You donated $${atonementCost.toLocaleString()}. The monks nod. Some of the noise around you quiets.`)
  }

  const handleEmbezzle = () => {
    const res = executeCrime({
      type: 'rob',
      baseSuccessChance: 0.3,
      payout: 50000,
      notorietyIncreaseOnFail: 40,
      wantedIncreaseOnFail: 3,
      energyCost: 20,
      assetSeizureOnFail: 0
    })
    
    if (res.success) {
      setFeedbackMsg(`You embezzled the donation box! You gained $${res.payout.toLocaleString()}, but the monks will remember this.`)
      // It's a temple, so massive notoriety hit even if successful
      addNotoriety(20)
    } else {
      setFeedbackMsg(`The monks caught you! ${res.message}`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="glass-panel w-[420px] border-4 border-slate-300 bg-[#1c1d3a] p-6 font-mono text-white">
        <p className="mb-1 text-[10px] uppercase tracking-widest text-gray-500">Government & Cultural District</p>
        <h2 className="mb-2 text-xl font-bold text-slate-200">Whispering Temple Chapel</h2>
        <p className="mb-4 text-xs text-gray-400">
          Incense smoke curls past old stone. Even the most ruthless traders come here to feel forgiven.
        </p>

        <div className="mb-4 border-2 border-gray-600 bg-[#0f1020] p-3 text-sm">
          <p>Cash: <span className="text-green-400">${Math.round(cash).toLocaleString()}</span></p>
          <p>Wanted Level: <span className="text-red-400">{wantedLevel}</span></p>
          <p>Notoriety: <span className="text-orange-400">{notoriety}/100</span></p>
        </div>

        <div className="mb-4 flex flex-col gap-2">
          <button
            onClick={handleDonate}
            disabled={cash < atonementCost || (wantedLevel === 0 && notoriety === 0)}
            className="border-2 border-slate-300 py-1.5 text-sm font-bold text-slate-200 hover:bg-slate-300 hover:text-black disabled:opacity-30"
          >
            Seek Atonement (Cost: ${atonementCost.toLocaleString()})
          </button>
          
          <button
            onClick={handleEmbezzle}
            className="border-2 border-red-500 bg-red-950 py-1.5 text-sm font-bold text-red-400 hover:bg-red-500 hover:text-black"
          >
            Embezzle Donation Box & Flee (20 Energy)
          </button>
        </div>

        {feedbackMsg && <p className="mb-4 text-xs italic text-gray-300">{feedbackMsg}</p>}

        <button onClick={onClose} className="w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500">
          Leave
        </button>
      </div>
    </div>
  )
}
