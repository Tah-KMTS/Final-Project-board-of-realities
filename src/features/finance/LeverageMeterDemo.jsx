import { useState } from 'react'
import LeverageMeter from './LeverageMeter'

// Self-test harness for LeverageMeter - NOT part of the normal game flow
// and NOT referenced by any building modal. Reached only via a dev-only
// query param gate in App.jsx (?leverageDemo=1) so it never affects a
// normal playthrough. Exists purely so this component can be exercised
// end-to-end (energy spend, tap timing, win/lose -> applyCrimeOutcome)
// against the real store without wiring it into DistrictBuildingModal /
// UnderworldModal / BusinessCenterModal / GovernmentBuildingModal /
// IndustrialZoneModal, all of which are off-limits for this task.
//
// Three presets sanity-check that the same component reads as
// differently-flavored scenes purely through the `stakes` + presentational
// props, per the spec (back-alley shakedown / judicial bribe / corporate
// collusion) without any per-preset code branching inside LeverageMeter
// itself.
const PRESETS = {
  shakedown: {
    key: 'shakedown',
    title: 'Back-Alley Shakedown',
    markName: 'Lonnie "Two-Times" Grebb',
    markDescription: 'Runs the corner numbers game. Leans easy, talks fast, spooks easier.',
    buttonLabel: 'Lean On Him',
    stakes: {
      target: 60,
      suspicionCap: 100,
      payout: 4000,
      notorietyIncreaseOnFail: 8,
      wantedIncreaseOnFail: 1,
      assetSeizureOnFail: 0.05,
      jailChanceOnFail: 0.05,
      energyCost: 10,
      baseSuccessChance: 0.7,
    },
  },
  bribe: {
    key: 'bribe',
    title: 'Judicial Bribe',
    markName: 'Judge Elena Wroth',
    markDescription: 'Presides over municipal contracts. Cautious, well-connected, expensive to spook.',
    buttonLabel: 'Sweeten The Offer',
    stakes: {
      target: 90,
      suspicionCap: 100,
      payout: 15000,
      notorietyIncreaseOnFail: 20,
      wantedIncreaseOnFail: 2,
      assetSeizureOnFail: 0.15,
      jailChanceOnFail: 0.2,
      energyCost: 20,
      baseSuccessChance: 0.5,
    },
  },
  collusion: {
    key: 'collusion',
    title: 'Corporate Collusion',
    markName: 'Halberd Freight Board',
    markDescription: 'A whole boardroom to bring around, not just one mark. Slow, deep-pocketed, paranoid.',
    buttonLabel: 'Push The Deal',
    stakes: {
      target: 130,
      suspicionCap: 100,
      payout: 40000,
      notorietyIncreaseOnFail: 30,
      wantedIncreaseOnFail: 3,
      assetSeizureOnFail: 0.25,
      jailChanceOnFail: 0.3,
      energyCost: 30,
      baseSuccessChance: 0.4,
    },
  },
}

export default function LeverageMeterDemo() {
  const [activeKey, setActiveKey] = useState(null)
  const preset = activeKey ? PRESETS[activeKey] : null

  return (
    <div className="flex h-full w-full items-center justify-center bg-black font-mono text-white">
      {!preset ? (
        <div className="flex flex-col gap-3 border-4 border-amber-400 bg-[#1c1d3a] p-6">
          <h1 className="text-lg font-bold text-amber-300">LeverageMeter Self-Test</h1>
          <p className="max-w-xs text-xs text-gray-400">
            Dev-only harness, not part of the real game flow. Pick a flavor preset to launch the real component against
            the live store.
          </p>
          {Object.values(PRESETS).map((p) => (
            <button
              key={p.key}
              onClick={() => setActiveKey(p.key)}
              className="border-2 border-amber-500/60 px-3 py-1.5 text-left text-sm hover:bg-amber-900/30"
            >
              {p.title}
            </button>
          ))}
        </div>
      ) : (
        <LeverageMeter
          onClose={() => setActiveKey(null)}
          title={preset.title}
          markName={preset.markName}
          markDescription={preset.markDescription}
          buttonLabel={preset.buttonLabel}
          stakes={preset.stakes}
        />
      )}
    </div>
  )
}
