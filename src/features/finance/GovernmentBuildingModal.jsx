import { useState } from 'react'
import NamedNpcModal from './NamedNpcModal'
import GovernmentModal from '../../components/GovernmentModal'
import LeverageActionPanel from './LeverageActionPanel'

// Building consolidation (Phase 2): FBI Headquarters (Hoover) + IRS Internal
// Revenue (Caplin) used to be 2 separate standalone buildings. They're now
// one physical building ('governmentBuilding' in OverworldScene.js's
// FINANCE_BUILDING_DEFS) with a tab per former tenant, plus a 3rd tab that
// embeds the existing elections/Fed/FTC/SCOTUS/Congress/Treasury/agencies
// hub (src/components/GovernmentModal.jsx) - previously only reachable via
// FinanceStatusBar's "Open Gov" button, which keeps working standalone and
// unaffected (see that component's embedded=false default).
const TABS = [
  { id: 'hoover', label: 'Hoover (FBI)' },
  { id: 'caplin', label: 'Caplin (IRS)' },
  { id: 'affairs', label: 'Government Affairs' },
]

// The Government Building's one skill-checked criminal action: bribing
// Hoover directly. Lowest payout of the three new hub actions - bribing a
// federal law-enforcement official isn't a moneymaker, it's damage control,
// so `payout` here is deliberately modest and reads as "what it's worth to
// have this go away quietly" rather than a real income source. We do NOT
// have success reduce wantedLevel directly (flagged in the task as
// off-limits without discussion, and risky to interact with the jail
// system) - instead the "heat relief" IS the success case by construction:
// notorietyIncreaseOnFail/wantedIncreaseOnFail/jailChanceOnFail only ever
// fire on a LOST negotiation (see LeverageMeter.jsx's resolve()), so a won
// negotiation already means "no federal case gets opened," full stop,
// with a small payout on top standing in for evidence/paperwork that
// quietly disappears. `suspicionCap` is intentionally low (60, not the
// usual 100) per spec - this is the "one strike" of the three: you can't
// out-grind Hoover the way you can grind a black-market fence, you have to
// read him right, fast. `jailChanceOnFail` is the highest of the three new
// actions - failing to bribe the head of the FBI is exactly the scenario
// that should end with handcuffs, not a fine.
// Syndicate branding pass (see syndicateStandingEngine.js/syndicate.js):
// speakeasy_syndicate. Arnold Rothstein's bio names him the underworld's
// "master gambler, financier, and underworld fixer" who "transformed
// bootlegging into corporate enterprise" through political connections -
// bribing a federal official is the single most on-theme "fixer" job in the
// game, and it's Rothstein's job specifically (not Waxey Gordon's rum-running
// or Remus' legal-loophole distilling) among his own syndicate's three
// members. inHomeTurf is true: speakeasy_syndicate's territory is
// "Government & Cultural District" (crimeSyndicates.js), an exact match for
// this building's district (see the header below) - the strongest possible
// home-turf case in this whole branding pass.
const HOOVER_BRIBE_STAKES = {
  target: 55,
  suspicionCap: 60,
  payout: 1500,
  notorietyIncreaseOnFail: 15,
  wantedIncreaseOnFail: 3,
  reputationDeltaOnFail: -6,
  assetSeizureOnFail: 0.1,
  jailChanceOnFail: 0.3,
  energyCost: 18,
  baseSuccessChance: 0.55,
  syndicateId: 'speakeasy_syndicate',
  inHomeTurf: true,
}

export default function GovernmentBuildingModal({ onClose }) {
  const [tab, setTab] = useState('hoover')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="glass-panel w-[720px] border-4 border-amber-500 bg-[#1c1d3a] p-6 font-mono text-white">
        <p className="mb-1 text-xs uppercase tracking-widest text-gray-500">Government & Cultural District</p>
        <h2 className="mb-2 text-xl font-bold text-amber-300">Federal Government Building</h2>
        <p className="mb-3 text-xs text-gray-400">
          The FBI's Hoover, the IRS's Caplin, and the full machinery of federal oversight, all in one building.
        </p>

        <div className="mb-3 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`border-2 px-3 py-1 text-xs font-bold ${
                tab === t.id ? 'border-amber-400 bg-amber-400/20 text-amber-300' : 'border-gray-600 text-gray-400 hover:border-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mb-4 max-h-[560px] overflow-y-auto">
          {tab === 'hoover' && (
            <>
              <NamedNpcModal npcId="hoover" embedded />
              <LeverageActionPanel
                accentBorderClass="border-amber-500"
                teaser="He built a career on being the one man in this building who can't be bought. That reputation is exactly what makes this a bad idea - and exactly why it would be worth something if it landed."
                buttonLabel="Make the Offer"
                leverage={{
                  title: 'An Unofficial Conversation',
                  markName: 'Director Hoover',
                  markDescription:
                    'A closed office door and a manila folder he hasn\'t filed yet. One shot at this - he does not sit still for a second offer.',
                  buttonLabel: 'Sweeten The Offer',
                  stakes: HOOVER_BRIBE_STAKES,
                }}
              />
            </>
          )}
          {tab === 'caplin' && <NamedNpcModal npcId="caplin" embedded />}
          {tab === 'affairs' && <GovernmentModal embedded />}
        </div>

        <button onClick={onClose} className="w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500">
          Leave the Government Building
        </button>
      </div>
    </div>
  )
}
