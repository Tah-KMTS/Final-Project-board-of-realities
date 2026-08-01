import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import NamedNpcModal from '../finance/NamedNpcModal'
import LeverageActionPanel from '../finance/LeverageActionPanel'
import RhythmGame from './RhythmGame'

// Concert Hall - Dixon Trujillo's entertainment front. Composes an NPC-
// flavor angle (NamedNpcModal, same as every other hub tab) with a real
// mechanic in one tab body - same precedent UnderworldModal.jsx's Crime
// Alley tab already set (DistrictBuildingModal + NamedNpcModal stacked in
// one tab), and the same "NPC tab that also embeds a real mini-game"
// precedent the Narcotics tab established, just applied here instead of
// Sports Stadium (which is still a stub - see EntertainmentComplexModal.jsx).
//
// The Book-a-Show rhythm game itself is zero crime risk by design: no
// notoriety/wantedLevel/jail interaction at all. Dixon carries the legal
// exposure there (the show is his laundering cover, a good performance is
// what lets him pad the invoice around it without suspicion) - not the
// player, who is just the hired act.
//
// The Leverage panel below it is a SEPARATE, deliberately riskier action -
// see NIGHTCLUB_DUES_STAKES - added to give griselda_empire standing (see
// syndicateStandingEngine.js) a path upward. Before this, griselda_empire
// had no branded action anywhere in the game while being on the receiving
// end of BOTH rivalry pairs (medellin_cartel and national_syndicate each
// apply -4 to her on every completed job of their own - see RIVALRY_PAIRS
// in syndicateStandingEngine.js), making her standing strictly
// net-negative and her Boss-tier content permanently unreachable. Dixon
// Trujillo is the correct venue for that fix, not a stretch: his syndicate.js
// entry is syndicateId 'griselda_empire' and his specialty is verbatim
// "Nightclub Extortion & Entertainment Fronts", with a bio built entirely
// around collecting weekly nightclub/venue dues ("ensured every nightclub,
// bar, and gaming den paid weekly dues to La Madrina"). This tab is
// literally his venue in-game already.
const NIGHTCLUB_DUES_STAKES = {
  target: 82,
  suspicionCap: 100,
  payout: 780,
  // Kept at the same "street-tier" shape as Crime Alley/Black Market/Call
  // Center Ops (districtBuildings.js) rather than the Boss-tier shape
  // (Hoover/McNamara/Vanderbilt), since this is explicitly a street-level
  // extortion racket, not a federal-scale operation: notoriety stays at 0
  // and there's no asset seizure or jail chance on a failed collection run,
  // matching that same tier's precedent exactly.
  notorietyIncreaseOnFail: 0,
  wantedIncreaseOnFail: 2,
  reputationDeltaOnFail: -3,
  assetSeizureOnFail: 0,
  jailChanceOnFail: 0,
  energyCost: 17,
  baseSuccessChance: 0.55,
  syndicateId: 'griselda_empire',
  // inHomeTurf is false: griselda_empire's territory is "Commercial District
  // - Nightlife" (syndicate.js/crimeSyndicates.js), but the Entertainment
  // Complex physically sits in the Industrial District (OverworldScene.js's
  // FINANCE_BUILDING_DEFS has entertainmentComplex at zone: 'industry', and
  // this modal's own header literally reads "Industrial District") - a real
  // mismatch, not an ambiguous case, so no home-turf bonus applies here even
  // though this is Dixon's own signature racket.
  inHomeTurf: false,
}

const SONGS = [
  { id: 'openMic', label: 'Open Mic', notes: 12, bpm: 90, entry: 20, energy: 5 },
  { id: 'headliner', label: 'Headliner Set', notes: 20, bpm: 120, entry: 50, energy: 10 },
  { id: 'soldOut', label: 'Sold-Out Show', notes: 30, bpm: 150, entry: 100, energy: 15 },
]

// performanceRatio = totalScore / maxPossibleScore (max = every note Perfect).
function payoutMultiplierFor(ratio) {
  if (ratio >= 0.9) return { multiplier: 6, reputation: 2, tier: 'Full Combo' }
  if (ratio >= 0.7) return { multiplier: 3, reputation: 0, tier: 'Strong Set' }
  if (ratio >= 0.4) return { multiplier: 1.5, reputation: 0, tier: 'Serviceable' }
  return { multiplier: 0, reputation: 0, tier: 'Bombed' }
}

export default function ConcertHallTab() {
  const cash = useGameStore((s) => s.cash)
  const energy = useGameStore((s) => s.player.energy)
  const addCash = useGameStore((s) => s.addCash)
  const spendEnergy = useGameStore((s) => s.spendEnergy)
  const addReputation = useGameStore((s) => s.addReputation)

  const [screen, setScreen] = useState('hub') // 'hub' | 'songSelect' | 'playing' | 'results'
  const [activeSong, setActiveSong] = useState(null)
  const [results, setResults] = useState(null)

  const startSong = (tier) => {
    if (cash < tier.entry || energy < tier.energy) return
    if (!spendEnergy(tier.energy)) return
    addCash(-tier.entry)
    const laneSequence = Array.from({ length: tier.notes }, () => Math.floor(Math.random() * 4))
    setActiveSong({ ...tier, laneSequence })
    setScreen('playing')
  }

  const handleFinish = (result) => {
    const ratio = result.maxScore > 0 ? result.score / result.maxScore : 0
    const { multiplier, reputation, tier } = payoutMultiplierFor(ratio)
    const payout = Math.round(activeSong.entry * multiplier)
    if (payout > 0) addCash(payout)
    if (reputation > 0) addReputation(reputation)
    setResults({ ...result, ratio, payout, reputation, tier })
    setScreen('results')
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] uppercase tracking-widest text-fuchsia-500">Entertainment Complex</p>
      <h3 className="text-lg font-bold text-fuchsia-300">Concert Hall</h3>
      <p className="text-xs text-gray-400">
        Nobody in the room actually cares about the music. Inflated production budgets, payola disguised as
        "booking fees," VIP bottle service as the real profit center - the show is Dixon's laundering cover, and a
        good set is what lets him pad the invoice around it without anyone asking questions.
      </p>

      {screen === 'hub' && (
        <>
          <div className="border-2 border-fuchsia-900 bg-[#170a1e]">
            <NamedNpcModal npcId="dixon" embedded />
          </div>
          <LeverageActionPanel
            accentBorderClass="border-fuchsia-500"
            teaser="Booking fees and bottle service pad Dixon's real ledger. The dues run underneath it - every venue on the strip owes its weekly cut whether or not a show is on the bill tonight."
            buttonLabel="Collect Weekly Dues"
            leverage={{
              title: 'Weekly Venue Dues',
              markName: 'A Club Owner Behind On Payments',
              markDescription:
                "He's a week late on the Griselda cut and has a story ready about a slow month. Dixon doesn't want excuses, he wants the envelope.",
              buttonLabel: 'Squeeze The Envelope',
              stakes: NIGHTCLUB_DUES_STAKES,
            }}
          />
          <button
            onClick={() => setScreen('songSelect')}
            className="w-full border-2 border-fuchsia-400 py-2 text-sm font-bold text-fuchsia-300 hover:bg-fuchsia-400 hover:text-black"
          >
            Book a Show
          </button>
        </>
      )}

      {screen === 'songSelect' && (
        <div className="flex flex-col gap-2">
          <div className="mb-1 border-2 border-gray-600 bg-[#0f1020] p-2 text-xs">
            <p>Cash: <span className="text-green-400">${Math.round(cash).toLocaleString()}</span></p>
            <p>Energy: <span className="text-yellow-300">{energy}</span></p>
          </div>
          {SONGS.map((tier) => {
            const affordable = cash >= tier.entry && energy >= tier.energy
            return (
              <button
                key={tier.id}
                onClick={() => startSong(tier)}
                disabled={!affordable}
                className="flex items-center justify-between border-2 border-fuchsia-500/60 bg-[#170a1e] px-3 py-2 text-left text-sm hover:bg-fuchsia-900/40 disabled:opacity-30"
              >
                <span>
                  <span className="font-bold text-fuchsia-300">{tier.label}</span>
                  <span className="ml-2 text-gray-500">{tier.notes} notes · {tier.bpm} BPM</span>
                </span>
                <span className="text-xs text-gray-400">${tier.entry} · {tier.energy} energy</span>
              </button>
            )
          })}
          <button onClick={() => setScreen('hub')} className="w-full border-2 border-gray-600 py-1 text-xs text-gray-400 hover:bg-gray-700">
            Back
          </button>
        </div>
      )}

      {screen === 'playing' && activeSong && <RhythmGame song={activeSong} onFinish={handleFinish} />}

      {screen === 'results' && results && activeSong && (
        <div className="flex flex-col gap-2 border-2 border-fuchsia-500 bg-[#170a1e] p-3 text-sm">
          <p className="text-center text-lg font-bold text-fuchsia-300">{results.tier}</p>
          <p className="text-center text-xs text-gray-400">
            {activeSong.label} · {(results.ratio * 100).toFixed(0)}% performance ({results.score}/{results.maxScore} pts)
          </p>
          <p className="text-center text-xs text-gray-500">
            {results.perfectCount} Perfect · {results.goodCount} Good · {results.missCount} Miss
            {results.reason === 'forfeit' ? ' · walked off early' : ''}
          </p>
          <p className="text-center text-base">
            {results.payout > 0 ? (
              <span className="font-bold text-green-400">+${results.payout.toLocaleString()}</span>
            ) : (
              <span className="font-bold text-red-400">Dixon's not paying for that.</span>
            )}
            {results.reputation > 0 && <span className="ml-2 font-bold text-yellow-300">+{results.reputation} reputation</span>}
          </p>
          <div className="mt-1 flex gap-2">
            <button
              onClick={() => setScreen('songSelect')}
              className="flex-1 border-2 border-fuchsia-400 py-1.5 text-sm font-bold text-fuchsia-300 hover:bg-fuchsia-400 hover:text-black"
            >
              Book Another Show
            </button>
            <button
              onClick={() => setScreen('hub')}
              className="flex-1 border-2 border-gray-600 py-1.5 text-sm text-gray-400 hover:bg-gray-700"
            >
              Back to Dixon
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
