import { useState } from 'react'
import NamedNpcModal from './NamedNpcModal'
import InteractiveLocationModal from '../world/InteractiveLocationModal'
import LeverageActionPanel from './LeverageActionPanel'

// Building consolidation (Phase 2): Buffett HQ (Biffle Tower) + Vanderbilt
// Rail Co. + Rusk Industries (Musk) + Oaktree Cycle Capital (Howard Marks) +
// Apple Glass HQ (Jobs) used to be 5 separate standalone buildings. They're
// now one physical building ('businessCenter' in OverworldScene.js's
// FINANCE_BUILDING_DEFS) with a tab per former tenant - same TABS pattern as
// CasinoModal.jsx. Ford's own former single-tenant HQ (fordRougeComplex) was
// deliberately left out of this hub back then - it's since landed in its own
// Industrial Zone hub instead (Phase 4 - see IndustrialZoneModal.jsx).
const TABS = [
  { id: 'buffett', label: 'Buffett' },
  { id: 'vanderbilt', label: 'Vanderbilt' },
  { id: 'musk', label: 'Musk' },
  { id: 'howardmarks', label: 'Howard Marks' },
  { id: 'jobs', label: 'Jobs' },
]

// The Business Center's one skill-checked criminal action: a quiet
// stock-collusion / insider-arrangement with Vanderbilt - "The Commodore"
// historically built his fortune on rate-fixing cartels with rival rail
// barons, so a modern insider arrangement is squarely in character (unlike
// Buffett/Jobs/Musk, whose bios lean value-investing/product/engineering,
// not price-fixing). This is the highest-stakes of the three new hub
// actions (Business Center / Government Building / Industrial Zone): the
// mark here is a peer, not a victim or a target, so failure isn't "getting
// caught shaking someone down" - it's a leaked arrangement, hence the
// biggest reputationDeltaOnFail of the three and a real (if not dominant)
// jailChanceOnFail for securities fraud. Numbers continue the Underground
// District's established scaling (payout/target/energyCost up,
// baseSuccessChance down as the score gets bigger) one rung above that
// tier's $1,200 ceiling, and comfortably under financeNpcAction's $5,000
// extort ceiling (see useGameStore.js) since this isn't even the riskiest
// action in the game.
//
// Syndicate branding pass (see syndicateStandingEngine.js/syndicate.js):
// national_syndicate. Meyer Lansky's whole bio is corporate/financial-skim
// crime run through legitimate-looking channels ("developed a global
// gambling empire... pioneering offshore Swiss banking and corporate skim
// operations") - a quiet insider rate-fixing arrangement with a fellow
// financial titan is squarely his register, more so than any of the other
// remaining syndicates' bios (bootlegging, narcotics, contract killing,
// nightclub rackets). inHomeTurf is true: national_syndicate's territory is
// "Financial District - Vaults" (crimeSyndicates.js), and this building is
// explicitly labeled "Financial District" (see the header below) - a real
// district-prefix match per isHomeTurf(), not an assumed one.
const VANDERBILT_ARRANGEMENT_STAKES = {
  target: 130,
  suspicionCap: 100,
  payout: 3000,
  notorietyIncreaseOnFail: 15,
  wantedIncreaseOnFail: 2,
  reputationDeltaOnFail: -8,
  assetSeizureOnFail: 0.12,
  jailChanceOnFail: 0.15,
  energyCost: 30,
  baseSuccessChance: 0.42,
  syndicateId: 'national_syndicate',
  inHomeTurf: true,
}

export default function BusinessCenterModal({ onClose }) {
  const [tab, setTab] = useState('buffett')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="glass-panel w-[640px] border-4 border-slate-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <p className="mb-1 text-[10px] uppercase tracking-widest text-gray-500">Financial District</p>
        <h2 className="mb-2 text-xl font-bold text-slate-300">Capital Business Center</h2>
        <p className="mb-3 text-xs text-gray-400">
          Five titans, five floors, one lobby. Buffett, Vanderbilt, Musk, Howard Marks, and Jobs all keep offices here.
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
          {tab === 'buffett' && <NamedNpcModal npcId="buffett" embedded />}
          {tab === 'vanderbilt' && (
            <>
              <NamedNpcModal npcId="vanderbilt" embedded />
              <LeverageActionPanel
                accentBorderClass="border-slate-400"
                teaser="A separate matter from the office pleasantries. The Commodore still likes an arrangement over a long lunch - nothing on paper, nothing traced back."
                buttonLabel="Discuss a Quiet Arrangement"
                leverage={{
                  title: 'A Quiet Arrangement',
                  markName: 'Cornelius Vanderbilt',
                  markDescription:
                    "He built the railroads on rate-fixing handshakes with men he called rivals in public. He's amenable to another one - if you can read the room before he decides you can't be trusted with it.",
                  buttonLabel: 'Push The Arrangement',
                  stakes: VANDERBILT_ARRANGEMENT_STAKES,
                }}
              />
            </>
          )}
          {tab === 'musk' && <NamedNpcModal npcId="musk" embedded />}
          {tab === 'howardmarks' && <NamedNpcModal npcId="howardmarks" embedded />}
          {/* Jobs keeps his Apple Glass Design Studio prototype-testing action
              (InteractiveLocationModal's apple_lab entry) rather than the
              plain NamedNpcModal the other 4 tenants get - unchanged content,
              just embedded here instead of its own building/intercept. */}
          {tab === 'jobs' && <InteractiveLocationModal locationId="apple_lab" embedded />}
        </div>

        <button onClick={onClose} className="w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500">
          Leave the Business Center
        </button>
      </div>
    </div>
  )
}
