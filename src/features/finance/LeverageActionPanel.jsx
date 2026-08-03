import { useState } from 'react'
import LeverageMeter from './LeverageMeter'

// Small reusable "bolt a LeverageMeter action onto an existing tab" wrapper.
// Used by BusinessCenterModal / GovernmentBuildingModal / IndustrialZoneModal
// to add exactly one skill-checked criminal action to a specific tenant's
// tab WITHOUT replacing that tab's existing content.
//
// This is deliberately a different integration shape from
// DistrictBuildingModal's (see that file): DistrictBuildingModal swaps its
// ENTIRE action list for the meter because the whole tab IS the action list.
// These three hub tabs are different - each tab already renders a full
// NamedNpcModal (bio, dialogue, chat, recruit, romance...) that must keep
// working untouched, so the meter has to sit ALONGSIDE that content as an
// extra panel, not replace it. Same end result though: closing the meter
// (or finishing a round) collapses back to the teaser/button, never stacks
// a second full-screen overlay on top of the hub modal.
// `component` (default LeverageMeter): lets one call site swap in a
// racket-specific minigame instead of the shared meter, without touching
// any of this panel's other callers (BusinessCenterModal/
// GovernmentBuildingModal/IndustrialZoneModal/ConcertHallTab all keep
// LeverageMeter untouched by omitting this prop). Currently only
// UnderworldModal's Capone squeeze passes TheCircuitModal.
export default function LeverageActionPanel({
  accentBorderClass = 'border-amber-500',
  teaser,
  buttonLabel,
  leverage,
  component: MinigameComponent = LeverageMeter,
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`mt-3 border-2 ${accentBorderClass} bg-[#11122a] p-3`}>
      {open ? (
        <MinigameComponent embedded onClose={() => setOpen(false)} {...leverage} />
      ) : (
        <>
          {teaser && <p className="mb-2 text-xs text-gray-400">{teaser}</p>}
          <button
            onClick={() => setOpen(true)}
            className={`w-full border-2 ${accentBorderClass} py-1.5 text-sm font-bold uppercase tracking-widest hover:bg-white/10`}
          >
            {buttonLabel}
          </button>
        </>
      )}
    </div>
  )
}
