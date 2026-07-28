import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { THEFT_ITEM } from '../../game/vehicleGen'

// Two theft methods, both routed through the store's stealVehicle() (which
// itself reuses executeCrime() - no bespoke RNG here, see useGameStore.js).
// 'equipment' needs THEFT_ITEM (Slim Jim) in inventory and is quiet/cheap;
// 'smash' needs nothing but is loud/expensive on failure. Mirrors
// AmbientNpcModal.jsx's shape (two action buttons + Leave), with an added
// feedback banner like NarcoticsTradeModal/GunStoreModal for surfacing the
// roll result.
export default function VehicleTheftModal({ vehicle, onClose, onStolen }) {
  const inventory = useGameStore((s) => s.inventory)
  const stealVehicle = useGameStore((s) => s.stealVehicle)
  const [feedback, setFeedback] = useState(null)
  const [busy, setBusy] = useState(false)

  const hasTool = inventory.some((i) => i.id === THEFT_ITEM.id)

  const attemptTheft = (method) => {
    setBusy(true)
    const result = stealVehicle({ method, vehicle })
    if (result.success) {
      onStolen?.(result.vehicle ?? vehicle)
      onClose()
      return
    }
    setBusy(false)
    if (result.reason === 'need tool') {
      setFeedback(`You need a ${THEFT_ITEM.name} to pick this lock quietly.`)
      return
    }
    setFeedback(result.message || 'Not enough energy to try that.')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[380px] border-4 border-red-500 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-1 text-xl font-bold text-red-300">Steal Vehicle</h2>
        <p className="mb-4 text-sm text-gray-400">Target: {vehicle?.name || 'Unmarked Car'}</p>

        {feedback && (
          <div className="mb-3 border-2 border-red-500 bg-red-950/70 p-2 text-xs font-bold text-red-200">
            {feedback}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={() => attemptTheft('equipment')}
            disabled={!hasTool || busy}
            title={hasTool ? '' : `Buy a ${THEFT_ITEM.name} first (Gun Store Black Market)`}
            className={`border-2 py-1 text-sm ${
              hasTool ? 'border-cyan-400 hover:bg-cyan-400 hover:text-black' : 'border-gray-700 text-gray-600 cursor-not-allowed'
            }`}
          >
            Use Slim Jim (quiet){!hasTool ? ' — need Slim Jim' : ''}
          </button>
          <button
            onClick={() => attemptTheft('smash')}
            disabled={busy}
            className="border-2 border-orange-500 py-1 text-sm hover:bg-orange-500 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            Smash & Hotwire (noisy — high heat)
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-3 w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500"
        >
          Leave
        </button>
      </div>
    </div>
  )
}
