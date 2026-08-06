import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { INTERACTIVE_LOCATIONS } from './interactiveLocations'

// `embedded` (default false): the standalone 'interactiveLocation' modal
// case in WorldScreen.jsx (mcdonalds_diner/ford_factory/transit_hub) is
// unaffected. When true (BusinessCenterModal's Jobs tab reusing apple_lab,
// UnderworldModal's Speakeasy Hotel tab reusing speakeasy_club), skip the
// outer overlay + "Leave Location" footer button - the wrapping hub modal
// supplies both.
export default function InteractiveLocationModal({ locationId, onClose, onAcquireVehicle, embedded = false }) {
  const cash = useGameStore((s) => s.cash)
  const addCash = useGameStore((s) => s.addCash)
  const addWantedLevel = useGameStore((s) => s.addWantedLevel)
  const world2 = useGameStore((s) => s.world2)
  const setVehicle = useGameStore((s) => s.setVehicle)
  const player = useGameStore((s) => s.player)
  const restoreEnergy = useGameStore((s) => s.restoreEnergy)
  const healPlayer = useGameStore((s) => s.healPlayer)
  const endDay = useGameStore((s) => s.endDay)

  const loc = INTERACTIVE_LOCATIONS.find((l) => l.id === locationId) || INTERACTIVE_LOCATIONS[0]
  const [feedback, setFeedback] = useState(null)

  // 'lay_low' (Speakeasy Hotel) advances the whole day via endDay() - the
  // only time-advancing action this game has (see useGameStore.js) - so a
  // confirm dialog first, same as the named-NPC Attack warning in
  // WorldScreen.jsx, rather than silently eating the player's day off a
  // misclick in what otherwise looks like a plain purchase button.
  const handleLayLow = (item) => {
    if (cash < item.cost) {
      setFeedback(`Insufficient funds! Need $${item.cost}.`)
      return
    }
    const proceed = window.confirm(
      `Lay low until morning? This ends your day (same as pressing End Day) and costs $${item.cost}.`
    )
    if (!proceed) return
    addCash(-item.cost)
    addCash(150)
    addWantedLevel(-1)
    setFeedback('You keep your head down until the room clears out. -1 Wanted, $150 richer.')
    endDay()
  }

  const handlePurchaseItem = (item) => {
    if (item.id === 'lay_low') {
      handleLayLow(item)
      return
    }
    if (cash < item.cost) {
      setFeedback(`Insufficient funds! Need $${item.cost}.`)
      return
    }
    // Buying a snack purely for its energyRestore when already at full
    // energy would just be burning cash for nothing - block it the same way
    // the cost check blocks an unaffordable purchase, rather than silently
    // letting restoreEnergy's own maxEnergy clamp eat the difference. Same
    // reasoning for healHp against full HP.
    if (item.energyRestore && player.energy >= player.maxEnergy) {
      setFeedback('Already at full Energy.')
      return
    }
    if (item.healHp && player.hp >= player.maxHp) {
      setFeedback('Already at full HP.')
      return
    }
    addCash(-item.cost)

    if (item.id === 'bootleg_whiskey') {
      addWantedLevel(-1)
    }
    if (item.energyRestore) restoreEnergy(item.energyRestore)
    if (item.healHp) healPlayer(item.healHp)

    setFeedback(`Purchased ${item.name}! ${item.bonusText}`)
  }

  const handleVehicleSelect = (opt) => {
    if (cash < opt.cost) {
      setFeedback(`Insufficient funds! Need $${opt.cost}.`)
      return
    }
    addCash(-opt.cost)
    if (opt.type === 'vehicle') {
      setVehicle(opt.name, opt.speedMultiplier)
      setFeedback(`Acquired ${opt.name}! Movement speed updated.`)
      // Tells the Phaser scene to actually spawn the car (setVehicle above
      // only writes the store's cosmetic name/speedMultiplier fields).
      onAcquireVehicle?.(opt)
    } else {
      setFeedback(`Purchased ${opt.name}! Express train access granted.`)
    }
  }

  const body = (
    <>
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-amber-500/40 bg-[#161a38] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{loc.icon}</span>
            <div>
              <h1 className="text-xl font-bold text-amber-300">{loc.name}</h1>
              <p className="text-xs text-gray-400">District: {loc.district} • Key Resident: {loc.residentNpc || 'Public Venue'}</p>
            </div>
          </div>
          <div className="text-right text-xs">
            <div className="text-gray-400">Your Cash</div>
            <div className="text-base font-bold text-emerald-400">${Math.round(cash).toLocaleString()}</div>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className="bg-amber-950/80 border-b border-amber-500 p-3 text-center text-xs font-bold text-amber-300">
            {feedback}
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="rounded border border-gray-700 bg-[#131631] p-4 text-xs text-gray-300">
            <p className="italic">{loc.description}</p>
          </div>

          {/* Dining Menu / Items */}
          {loc.items && (
            <div>
              <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3">🍔 Menu & Refreshments</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {loc.items.map((item) => (
                  <div key={item.id} className="rounded border border-gray-800 bg-[#15193a] p-4 flex flex-col justify-between">
                    <div>
                      <div className="font-bold text-yellow-300 text-sm">{item.name}</div>
                      <div className="text-xs text-emerald-400 font-bold mt-1">${item.cost}</div>
                      <div className="text-xs text-gray-300 mt-2">{item.bonusText}</div>
                    </div>
                    <button
                      onClick={() => handlePurchaseItem(item)}
                      className="mt-4 w-full border border-amber-400 bg-amber-500/20 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500 hover:text-black transition-all"
                    >
                      Order ${item.cost}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Factory / Studio Actions - also reused by speakeasy_club's
              'lay_low' below, which isn't an "inspection" so the section
              heading/button label swap for it specifically. */}
          {loc.actions && (
            <div>
              <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-3">
                {loc.id === 'speakeasy_club' ? '🥃 Back Room' : '⚙️ Inspection & Production Operations'}
              </h3>
              <div className="space-y-3">
                {loc.actions.map((act) => (
                  <div key={act.id} className="rounded border border-cyan-500/40 bg-[#141b3d] p-4 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-cyan-300 text-sm">{act.name}</div>
                      <div className="text-xs text-gray-300 mt-1">{act.rewardText}</div>
                    </div>
                    <button
                      onClick={() => handlePurchaseItem({ id: act.id, name: act.name, cost: act.cost, bonusText: act.rewardText })}
                      className="border border-cyan-400 bg-cyan-500/20 px-4 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500 hover:text-black transition-all"
                    >
                      {act.id === 'lay_low' ? `Lay Low ($${act.cost})` : `Inspect ($${act.cost})`}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transit Hub Vehicles & Passes */}
          {loc.options && (
            <div>
              <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-3">🚆 Vehicles & Express Train Passes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {loc.options.map((opt) => (
                  <div key={opt.id} className="rounded border border-emerald-500/40 bg-[#12242e] p-4 flex flex-col justify-between">
                    <div>
                      <div className="font-bold text-emerald-300 text-sm">{opt.name}</div>
                      <div className="text-xs text-gray-300 mt-1">Cost: ${opt.cost}</div>
                    </div>
                    <button
                      onClick={() => handleVehicleSelect(opt)}
                      className="mt-3 w-full border border-emerald-400 bg-emerald-500/20 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500 hover:text-black transition-all"
                    >
                      Select ${opt.cost}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!embedded && (
          <div className="border-t border-gray-800 bg-[#101229] p-4 text-right">
            <button
              onClick={onClose}
              className="border border-gray-600 bg-gray-800 px-6 py-2 text-xs font-bold text-white hover:bg-gray-700 transition-colors"
            >
              Leave Location
            </button>
          </div>
        )}
    </>
  )

  // Embedded mode drops the fixed-height (h-[80vh]) flex-col overlay panel
  // entirely - the wrapping hub modal already gives this tab its own
  // scrollable area, so this just flows as plain content inside it.
  if (embedded) return <div className="text-white">{body}</div>

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 font-mono text-white">
      <div className="flex h-[80vh] w-full max-w-3xl flex-col border-4 border-amber-400 bg-[#0e1126] shadow-2xl">
        {body}
      </div>
    </div>
  )
}
