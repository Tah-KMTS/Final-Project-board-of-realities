import { useState } from 'react'
import NamedNpcModal from './NamedNpcModal'
import InteractiveLocationModal from '../world/InteractiveLocationModal'
import LeverageActionPanel from './LeverageActionPanel'

// Building consolidation (Phase 4): Ford River Rouge Complex + Homestead
// Steel Mill + Standard Oil Refinery + Pentagon Procurement HQ + EPA
// Regulation Agency used to be 5 separate standalone buildings. They're now
// one physical building ('industrialZone' in OverworldScene.js's
// FINANCE_BUILDING_DEFS) with a tab per former tenant - same TABS pattern as
// BusinessCenterModal.jsx/UnderworldModal.jsx/GovernmentBuildingModal.jsx.
const TABS = [
  { id: 'ford', label: 'Ford' },
  { id: 'carnegie', label: 'Carnegie' },
  { id: 'rockefeller', label: 'Rockefeller' },
  { id: 'mcnamara', label: 'McNamara' },
  { id: 'ruckelshaus', label: 'Ruckelshaus' },
]

// The Industrial Zone's one skill-checked criminal action: a procurement
// kickback with McNamara, who runs Pentagon Procurement here - defense
// contracts are the single most on-theme "regulatory capture" target in
// this building (Carnegie/Rockefeller are industrialists, not the ones who
// approve contracts; Ruckelshaus is the EPA regulator, closer to an
// adversary than a mark for a kickback). Mid stakes between the Business
// Center's insider arrangement (highest) and the Government Building's
// bribe (lowest) - a defense procurement kickback is real money and a real
// federal crime, but it's routed through paperwork and sign-off chains
// rather than one man's individual, easily-revoked trust, so it isn't as
// fragile (suspicionCap 100, not Hoover's 60) or as reputation-poisonous as
// getting caught colluding with a market peer.
//
// Syndicate branding pass (see syndicateStandingEngine.js/syndicate.js):
// murder_inc. Lepke Buchalter, Murder Inc.'s boss, is canonically nicknamed
// "The Industrial Extortionist" in syndicate.js and his bio is explicitly
// labor/garment/industrial racketeering ("dominated New York's garment
// industry... through labor racketeering") - a defense-procurement kickback
// is the same flavor of racket one industry over. inHomeTurf is false:
// murder_inc's territory is "Underground District - Alleyways"
// (crimeSyndicates.js), but this building is the Industrial District - not
// the same place, so no home-turf bonus applies.
const MCNAMARA_KICKBACK_STAKES = {
  target: 95,
  suspicionCap: 100,
  payout: 2200,
  notorietyIncreaseOnFail: 12,
  wantedIncreaseOnFail: 2,
  reputationDeltaOnFail: -5,
  assetSeizureOnFail: 0.08,
  jailChanceOnFail: 0.12,
  energyCost: 24,
  baseSuccessChance: 0.5,
  syndicateId: 'murder_inc',
  inHomeTurf: false,
}

export default function IndustrialZoneModal({ onClose }) {
  const [tab, setTab] = useState('ford')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="glass-panel w-[640px] border-4 border-slate-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <p className="mb-1 text-xs uppercase tracking-widest text-gray-500">Industrial District</p>
        <h2 className="mb-2 text-xl font-bold text-slate-300">Industrial Zone</h2>
        <p className="mb-3 text-xs text-gray-400">
          Five industrialists and regulators, one sprawling complex. Ford, Carnegie, Rockefeller, McNamara, and
          Ruckelshaus all run their operations out of here.
        </p>

        <div className="mb-3 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`border-2 px-3 py-1 text-xs font-bold ${
                tab === t.id ? 'border-slate-400 bg-slate-400/20 text-slate-200' : 'border-gray-600 text-gray-400 hover:border-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mb-4 max-h-[520px] overflow-y-auto">
          {/* Ford keeps his Ford Mass Assembly Plant Inspect-Assembly-Line
              content (InteractiveLocationModal's ford_factory entry) rather
              than the plain NamedNpcModal the other 4 tenants get - same
              precedent BusinessCenterModal.jsx set for Jobs' apple_lab tab -
              unchanged content, just embedded here instead of its own
              building/intercept. */}
          {tab === 'ford' && <InteractiveLocationModal locationId="ford_factory" embedded />}
          {tab === 'carnegie' && <NamedNpcModal npcId="carnegie" embedded />}
          {tab === 'rockefeller' && <NamedNpcModal npcId="rockefeller" embedded />}
          {tab === 'mcnamara' && (
            <>
              <NamedNpcModal npcId="mcnamara" embedded />
              <LeverageActionPanel
                accentBorderClass="border-slate-400"
                teaser="Procurement paperwork is long, dense, and reviewed by people who trust whatever it says on the summary page. He writes the summary page."
                buttonLabel="Adjust the Line Item"
                leverage={{
                  title: 'A Line Item Nobody Reads',
                  markName: 'Robert McNamara',
                  markDescription:
                    'Pentagon Procurement runs on sign-offs, not scrutiny. A rounding error in the right column, initialed by the right man, and the contract clears.',
                  buttonLabel: 'Push The Adjustment',
                  stakes: MCNAMARA_KICKBACK_STAKES,
                }}
              />
            </>
          )}
          {tab === 'ruckelshaus' && <NamedNpcModal npcId="ruckelshaus" embedded />}
        </div>

        <button onClick={onClose} className="w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500">
          Leave the Industrial Zone
        </button>
      </div>
    </div>
  )
}
