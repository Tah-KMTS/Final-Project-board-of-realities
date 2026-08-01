import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import NamedNpcModal from '../finance/NamedNpcModal'
import SprintRace from './SprintRace'

// Sports Stadium - Arnold Rothstein's "fixed-odds" front, but the sprint
// itself is played straight: a skill-shaped QTE, not a gambling wheel. Same
// "NPC tab that also embeds a real mini-game" shape ConcertHallTab.jsx
// established for Dixon - NamedNpcModal embedded for portrait/bio/dialogue,
// stacked with the actual mechanic.
//
// Zero crime-stat interaction by design: no wantedLevel/notoriety/
// executeCrime anywhere in this file. It's a race, not fraud - Rothstein's
// own rap sheet (the 'Fixed Sports Betting' racket in
// syndicateActivitiesEngine.js's SYNDICATE_OPERATIONS_CATALOG) carries that
// weight elsewhere; the player here is just an entrant.

const TIERS = [
  { id: 'amateur', label: 'Amateur Heat', entry: 25, energy: 5 },
  { id: 'club', label: 'Club Heat', entry: 75, energy: 8 },
  { id: 'invitational', label: 'Invitational', entry: 200, energy: 12 },
]

const FIX_COST = 50

const PLACE_MULTIPLIER = { 1: 3.0, 2: 1.8, 3: 1.1 } // 4th-6th: 0x, no payout

const PLACE_LABEL = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th' }

export default function SportsStadiumTab() {
  const cash = useGameStore((s) => s.cash)
  const energy = useGameStore((s) => s.player.energy)
  const addCash = useGameStore((s) => s.addCash)
  const spendEnergy = useGameStore((s) => s.spendEnergy)
  const addReputation = useGameStore((s) => s.addReputation)

  const [screen, setScreen] = useState('hub') // 'hub' | 'tierSelect' | 'racing' | 'results'
  const [wantFix, setWantFix] = useState(false)
  const [activeRace, setActiveRace] = useState(null) // { ...tier, fixApplied }
  const [results, setResults] = useState(null)

  const startRace = (tier) => {
    const totalCost = tier.entry + (wantFix ? FIX_COST : 0)
    if (cash < totalCost || energy < tier.energy) return
    if (!spendEnergy(tier.energy)) return
    addCash(-totalCost)
    setActiveRace({ ...tier, fixApplied: wantFix })
    setScreen('racing')
  }

  // SprintRace reports the raw race outcome only (place/strides/reason/
  // effectiveLuckAtStart) - payout math lives here, same separation of
  // concerns ConcertHallTab.jsx keeps between RhythmGame's raw score and its
  // own payoutMultiplierFor().
  const handleFinish = (result) => {
    if (result.reason === 'forfeit' || result.place === null) {
      setResults({ ...result, payout: 0, luckSaved: false, reputation: 0 })
      setScreen('results')
      return
    }

    const multiplier = PLACE_MULTIPLIER[result.place] || 0
    let payout = Math.round(activeRace.entry * multiplier)
    let luckSaved = false

    if (multiplier === 0) {
      // This is a skill-shaped QTE, NOT a gambling game - deliberately do
      // NOT apply the Casino's fairMultiplier = 1/p * 0.9 RTP-conformity
      // formula here (see Slots.jsx). Payout is fixed by finishing place,
      // never back-solved from a win probability. The luck-save below is
      // scoped narrowly to a no-payout finish, and only ever refunds the
      // entry fee - same "wash, never a win" contract Slots.jsx uses; it
      // can never upgrade a 4th-6th finish into a paying place.
      const luckSaveChance = Math.max(0, Math.min(0.15, (result.effectiveLuckAtStart - 5) * 0.02))
      if (Math.random() < luckSaveChance) {
        payout = activeRace.entry
        luckSaved = true
      }
    }

    const reputation = result.place === 1 ? 2 : 0
    if (payout > 0) addCash(payout)
    if (reputation > 0) addReputation(reputation)

    setResults({ ...result, payout, luckSaved, reputation })
    setScreen('results')
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] uppercase tracking-widest text-fuchsia-500">Entertainment Complex</p>
      <h3 className="text-lg font-bold text-fuchsia-300">Sports Stadium — Rothstein's Track</h3>
      <p className="text-xs text-gray-400">
        Officially, it's a footrace with an entry fee and a purse. Unofficially, Arnold Rothstein's "fixed-odds
        operation" means the house always books a cut - what happens on the track between the white lines, though,
        is still on you.
      </p>

      {screen === 'hub' && (
        <>
          <div className="border-2 border-fuchsia-900 bg-[#170a1e]">
            <NamedNpcModal npcId="rothstein" embedded />
          </div>
          <button
            onClick={() => setScreen('tierSelect')}
            className="w-full border-2 border-fuchsia-400 py-2 text-sm font-bold text-fuchsia-300 hover:bg-fuchsia-400 hover:text-black"
          >
            Enter the Track
          </button>
        </>
      )}

      {screen === 'tierSelect' && (
        <div className="flex flex-col gap-2">
          <div className="mb-1 border-2 border-gray-600 bg-[#0f1020] p-2 text-xs">
            <p>Cash: <span className="text-green-400">${Math.round(cash).toLocaleString()}</span></p>
            <p>Energy: <span className="text-yellow-300">{energy}</span></p>
          </div>

          <label className="flex cursor-pointer items-start gap-2 border-2 border-yellow-700/60 bg-[#1c1706] p-2 text-xs">
            <input type="checkbox" checked={wantFix} onChange={(e) => setWantFix(e.target.checked)} className="mt-0.5" />
            <span>
              <span className="font-bold text-yellow-300">Slip Rothstein's man ${FIX_COST}</span> to have a word
              with the favorite. Takes the kick out of their legs for this heat only - doesn't touch your own
              running, doesn't touch the odds, just quiets down the one racer who'd otherwise surge late.
            </span>
          </label>

          {TIERS.map((tier) => {
            const totalCost = tier.entry + (wantFix ? FIX_COST : 0)
            const affordable = cash >= totalCost && energy >= tier.energy
            return (
              <button
                key={tier.id}
                onClick={() => startRace(tier)}
                disabled={!affordable}
                className="flex items-center justify-between border-2 border-fuchsia-500/60 bg-[#170a1e] px-3 py-2 text-left text-sm hover:bg-fuchsia-900/40 disabled:opacity-30"
              >
                <span>
                  <span className="font-bold text-fuchsia-300">{tier.label}</span>
                  <span className="ml-2 text-gray-500">40 strides · 6-runner field</span>
                </span>
                <span className="text-xs text-gray-400">
                  ${totalCost}{wantFix ? ` (incl. $${FIX_COST} fix)` : ''} · {tier.energy} energy
                </span>
              </button>
            )
          })}
          <button onClick={() => setScreen('hub')} className="w-full border-2 border-gray-600 py-1 text-xs text-gray-400 hover:bg-gray-700">
            Back
          </button>
        </div>
      )}

      {screen === 'racing' && activeRace && (
        <SprintRace tier={activeRace} fixApplied={activeRace.fixApplied} onFinish={handleFinish} />
      )}

      {screen === 'results' && results && activeRace && (
        <div className="flex flex-col gap-2 border-2 border-fuchsia-500 bg-[#170a1e] p-3 text-sm">
          <p className="text-center text-lg font-bold text-fuchsia-300">
            {results.reason === 'forfeit' ? 'Pulled Out' : `Finished ${PLACE_LABEL[results.place] || '—'}`}
          </p>
          <p className="text-center text-xs text-gray-400">
            {activeRace.label} · {results.strides}/40 strides
            {results.reason === 'forfeit' ? ' · left the track early' : ''}
          </p>
          <p className="text-center text-base">
            {results.payout > 0 ? (
              <span className="font-bold text-green-400">
                +${results.payout.toLocaleString()}{results.luckSaved ? ' (entry refunded)' : ''}
              </span>
            ) : (
              <span className="font-bold text-red-400">No purse this time.</span>
            )}
            {results.reputation > 0 && <span className="ml-2 font-bold text-yellow-300">+{results.reputation} reputation</span>}
          </p>
          <div className="mt-1 flex gap-2">
            <button
              onClick={() => setScreen('tierSelect')}
              className="flex-1 border-2 border-fuchsia-400 py-1.5 text-sm font-bold text-fuchsia-300 hover:bg-fuchsia-400 hover:text-black"
            >
              Run Again
            </button>
            <button
              onClick={() => setScreen('hub')}
              className="flex-1 border-2 border-gray-600 py-1.5 text-sm text-gray-400 hover:bg-gray-700"
            >
              Back to Rothstein
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
