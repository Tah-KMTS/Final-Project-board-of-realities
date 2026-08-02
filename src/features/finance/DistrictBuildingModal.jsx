import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { DISTRICT_BUILDINGS_CONFIG } from './districtBuildings'
import LeverageMeter from './LeverageMeter'
import LookoutWatchModal from './LookoutWatchModal'
import FencesTableModal from './FencesTableModal'
import CallCenterQTEModal from './CallCenterQTEModal'

// Maps each Underground District action's `minigame` field (districtBuildings.js)
// to the racket-specific component it opens instead of the shared
// LeverageMeter - see those 3 files' own header comments for what makes
// each one distinct. Falls back to LeverageMeter for any action that
// doesn't set `minigame` (none currently do, but this keeps a future
// flat-leverage action from silently crashing if this map isn't updated
// alongside it).
const MINIGAME_COMPONENTS = {
  lookoutWatch: LookoutWatchModal,
  fencesTable: FencesTableModal,
  callCenterQte: CallCenterQTEModal,
}

// Single reusable modal for every flavor-tier building added by the
// Tokyo-inspired 4-district expansion (Commercial/Underground/Government &
// Cultural). Mirrors the existing modal-wrapper pattern used everywhere
// else in the game (fixed inset-0 z-50 overlay + bordered panel), just
// driven by data instead of one bespoke component per building.
// `embedded` (default false): standalone call site in WorldScreen.jsx is
// unaffected. When true (a tab inside UnderworldModal - Black Market/Call
// Center Ops/Crime Alley all reuse this same config-driven component 3x),
// skip the outer overlay + Leave button; the wrapping hub modal supplies
// both, and `buildingId` is passed explicitly per tab rather than read from
// activeModal.id.
//
// Two action shapes live side by side in DISTRICT_BUILDINGS_CONFIG:
//   - `type: 'leverage'` - a risky, skill-checked action. Used to be
//     resolved by a flat `Math.random() < 0.5` coin flip right here
//     (removed - see git history); now hands its `leverage` block straight
//     through as LeverageMeter props, and LeverageMeter owns its own
//     resolution (applyCrimeOutcome) end to end. Clicking swaps the action
//     list for the embedded meter in place, so it never stacks a second
//     overlay on top of a hub modal like UnderworldModal.
//   - everything else (no `type`) - a flat priced transaction with no risk
//     (e.g. Temple's old Seek Atonement entry, now actually dead - see
//     districtBuildings.js). Runs instantly through runAction() below, no
//     meter involved. Any future flat action added to this config keeps
//     using this path; only give an action `type: 'leverage'` if it's an
//     actual gamble.
export default function DistrictBuildingModal({ buildingId, onClose, embedded = false }) {
  const cash = useGameStore((s) => s.cash)
  const addCash = useGameStore((s) => s.addCash)
  const addWantedLevel = useGameStore((s) => s.addWantedLevel)
  const addReputation = useGameStore((s) => s.addReputation)
  const [result, setResult] = useState(null)
  // Label of whichever `type: 'leverage'` action currently has its meter
  // open, or null. Only one can be open at a time; opening one hides the
  // action list/result text underneath it instead of stacking on top.
  const [activeLeverageLabel, setActiveLeverageLabel] = useState(null)

  const config = DISTRICT_BUILDINGS_CONFIG[buildingId]
  if (!config) return null

  const runAction = (action) => {
    if (action.cost && cash < action.cost) return
    if (action.cost) addCash(-action.cost)

    if (action.cashDelta) addCash(action.cashDelta)
    setResult(action.resultText || 'Done.')
    if (action.wantedDelta) addWantedLevel(action.wantedDelta)
    if (action.reputationDelta) addReputation(action.reputationDelta)
  }

  const activeLeverageAction = config.actions.find(
    (action) => action.type === 'leverage' && action.label === activeLeverageLabel
  )
  const ActiveMinigame = activeLeverageAction
    ? MINIGAME_COMPONENTS[activeLeverageAction.minigame] || LeverageMeter
    : null

  const body = (
    <>
        <p className="mb-1 text-xs uppercase tracking-widest text-gray-500">{config.district}</p>
        <h2 className={`mb-2 text-xl font-bold ${config.textClass}`}>{config.title}</h2>
        <p className="mb-4 text-xs text-gray-400">{config.flavor}</p>

        {activeLeverageAction ? (
          // embedded here too: this whole DistrictBuildingModal body may
          // itself already be embedded inside UnderworldModal, so nesting
          // the minigame's own full-screen overlay would stack a second one
          // on top. Always render it in-place instead.
          <ActiveMinigame embedded onClose={() => setActiveLeverageLabel(null)} {...activeLeverageAction.leverage} />
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-2">
              {config.actions.map((action) =>
                action.type === 'leverage' ? (
                  <button
                    key={action.label}
                    onClick={() => setActiveLeverageLabel(action.label)}
                    className={`border-2 ${config.borderClass} py-1.5 text-sm font-bold hover:bg-white/10`}
                  >
                    {action.label}
                  </button>
                ) : (
                  <button
                    key={action.label}
                    onClick={() => runAction(action)}
                    disabled={action.cost ? cash < action.cost : false}
                    className={`border-2 ${config.borderClass} py-1.5 text-sm font-bold hover:bg-white/10 disabled:opacity-30`}
                  >
                    {action.label}
                  </button>
                )
              )}
            </div>

            {result && <p className="mb-4 text-xs italic text-gray-300">{result}</p>}
          </>
        )}

        {!embedded && (
          <button onClick={onClose} className="w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500">
            Leave
          </button>
        )}
    </>
  )

  if (embedded) return body

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className={`glass-panel w-[420px] border-4 ${config.borderClass} bg-[#1c1d3a] p-6 font-mono text-white`}>
        {body}
      </div>
    </div>
  )
}
