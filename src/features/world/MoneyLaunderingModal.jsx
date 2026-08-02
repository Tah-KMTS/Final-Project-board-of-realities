import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { LAUNDERING_VENUES } from './moneyLaunderingEngine'

// Money Laundering: Route-the-Cash - replaces the old single-click
// "type an amount, pick one venue, click Launder" form with a real
// route-building puzzle. Unlike VaultCrackModal's hidden-information
// deduction mechanic, this is a full-information constrained-optimization
// puzzle: every heat number is shown exactly, before every hop, always -
// that transparency is load-bearing (see design brief), not a UI nicety.
// Self-contained like VaultCrackModal: own onClose only, no
// onVictory/onDefeat handshake.

const MIN_DECLARE = 5000
const MAX_ROUTE_CAPACITY = LAUNDERING_VENUES.reduce((sum, v) => sum + v.dailyCapacity, 0) // 460,000
const MAX_HOPS = 4
const ENERGY_COST = 20
const MIN_HOP_AMOUNT = 500

// Flat per-hop heat, indexed by hop position within THIS route (0-indexed).
const FLAT_HOP_HEAT = [4, 7, 12, 18]

function heatFromHop(venue, hopIndexInRoute, amount) {
  return venue.heatPerFullFill * (amount / venue.dailyCapacity) + FLAT_HOP_HEAT[hopIndexInRoute]
}

function computeHeatLimit(streetwise) {
  const raw = 100 + (streetwise - 5) * 4
  return Math.max(80, Math.min(130, raw))
}

export default function MoneyLaunderingModal({ onClose }) {
  const cash = useGameStore((s) => s.cash)
  const player = useGameStore((s) => s.player)
  const spendEnergy = useGameStore((s) => s.spendEnergy)
  const addCash = useGameStore((s) => s.addCash)
  const applyCrimeOutcome = useGameStore((s) => s.applyCrimeOutcome)

  const [screen, setScreen] = useState('setup') // 'setup' | 'route' | 'results'
  const [declaredAmount, setDeclaredAmount] = useState(String(Math.min(50000, cash)))
  const [heatLimit, setHeatLimit] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [hops, setHops] = useState([]) // { venueId, venueName, amount, clean, heatAdded, runningHeat }
  const [cumulativeHeat, setCumulativeHeat] = useState(0)
  const [totalClean, setTotalClean] = useState(0)
  const [resultData, setResultData] = useState(null)

  // In-progress hop picker state (route screen).
  const [pickVenueId, setPickVenueId] = useState('')
  const [pickAmount, setPickAmount] = useState('')

  const maxDeclare = Math.min(cash, MAX_ROUTE_CAPACITY)
  const canAffordEntry = cash >= MIN_DECLARE && player.energy >= ENERGY_COST

  const usedVenueIds = new Set(hops.map((h) => h.venueId))
  const availableVenues = LAUNDERING_VENUES.filter((v) => !usedVenueIds.has(v.id))
  const pickedVenue = LAUNDERING_VENUES.find((v) => v.id === pickVenueId) || null

  const startRoute = () => {
    const declared = Math.max(MIN_DECLARE, Math.min(maxDeclare, Math.floor(Number(declaredAmount) || 0)))
    if (declared < MIN_DECLARE || cash < MIN_DECLARE) return
    if (player.energy < ENERGY_COST) return
    if (!spendEnergy(ENERGY_COST)) return

    // Streetwise is read once, right here at route start via getState() -
    // the heat limit is locked in for the whole route, same "locked in for
    // the run" pattern VaultCrackModal uses for its attempts budget.
    const streetwise = useGameStore.getState().player.stats.streetwise ?? 5
    setHeatLimit(computeHeatLimit(streetwise))
    setRemaining(declared)
    setHops([])
    setCumulativeHeat(0)
    setTotalClean(0)
    setResultData(null)
    setPickVenueId('')
    setPickAmount('')
    setScreen('route')
  }

  // Walk-away before any hop is confirmed: only the entry energy is lost,
  // zero cash/notoriety/wanted/jail consequence.
  const walkAway = () => {
    setHops([])
    setCumulativeHeat(0)
    setTotalClean(0)
    setResultData(null)
    setPickVenueId('')
    setPickAmount('')
    setScreen('setup')
  }

  const hopIndex = hops.length // 0-indexed position of the NEXT hop
  const hopAmountNum = Math.floor(Number(pickAmount) || 0)
  const hopMaxAmount = pickedVenue ? Math.min(pickedVenue.dailyCapacity, remaining) : 0
  const hopAmountValid =
    pickedVenue != null && hopAmountNum >= MIN_HOP_AMOUNT && hopAmountNum <= hopMaxAmount

  const previewHeatAdded = pickedVenue && hopAmountValid ? heatFromHop(pickedVenue, hopIndex, hopAmountNum) : null
  const previewCumulative = previewHeatAdded != null ? cumulativeHeat + previewHeatAdded : null
  const previewWillAudit = previewCumulative != null && previewCumulative >= heatLimit

  const confirmHop = () => {
    if (!pickedVenue || !hopAmountValid) return
    const heatAdded = heatFromHop(pickedVenue, hopIndex, hopAmountNum)
    const newCumulativeHeat = cumulativeHeat + heatAdded
    const willAudit = newCumulativeHeat >= heatLimit

    if (willAudit) {
      // Cash seized: dirty cash is gone, no clean return. Prior hops already
      // fully applied their clean cash and are unaffected.
      addCash(-hopAmountNum)
      const auditedHop = {
        venueId: pickedVenue.id,
        venueName: pickedVenue.name,
        amount: hopAmountNum,
        clean: 0,
        heatAdded,
        runningHeat: newCumulativeHeat,
        audited: true,
      }
      const newHops = [...hops, auditedHop]
      setHops(newHops)
      setCumulativeHeat(newCumulativeHeat)
      setRemaining((r) => r - hopAmountNum)

      const res = applyCrimeOutcome({
        success: false,
        payout: 0,
        notorietyIncreaseOnFail: 15,
        wantedIncreaseOnFail: 1,
        assetSeizureOnFail: 0, // deliberately 0 - the seizure already happened above, scoped to just this hop
        jailChanceOnFail: 0.08,
      })
      setResultData({ outcome: 'audit', hops: newHops, totalClean, res })
      setScreen('results')
      return
    }

    const clean = hopAmountNum * (1 - pickedVenue.feePercent)
    addCash(-hopAmountNum)
    addCash(clean)
    const cleanHop = {
      venueId: pickedVenue.id,
      venueName: pickedVenue.name,
      amount: hopAmountNum,
      clean,
      heatAdded,
      runningHeat: newCumulativeHeat,
      audited: false,
    }
    const newHops = [...hops, cleanHop]
    setHops(newHops)
    setCumulativeHeat(newCumulativeHeat)
    setTotalClean((t) => t + clean)
    setRemaining((r) => r - hopAmountNum)
    setPickVenueId('')
    setPickAmount('')
  }

  const cashOut = () => {
    setResultData({ outcome: 'cashout', hops, totalClean })
    setScreen('results')
  }

  const canRouteAnother = hops.length < MAX_HOPS && availableVenues.length > 0 && remaining >= MIN_HOP_AMOUNT

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="glass-panel relative w-[520px] max-h-[85vh] overflow-y-auto border-4 border-emerald-400 bg-[#0d1c17] p-6 font-mono text-white">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 border border-gray-500 px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-600 hover:text-white"
        >
          X
        </button>

        <h2 className="mb-2 text-xl font-bold text-emerald-300">Money Laundering: Route the Cash</h2>

        {screen === 'setup' && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-400">
              Declare a total amount of dirty cash. Route it through up to 4 venues (no repeats) before cashing out.
              Every hop shows its exact heat cost up front - nothing is hidden. Cash out before cumulative heat hits
              the audit threshold, or a hop's cash gets seized on the spot.
            </p>
            <div className="border-2 border-emerald-500/60 bg-[#0f1020] p-3">
              <label className="mb-1 block text-xs text-gray-400">
                Declared Amount (min ${MIN_DECLARE.toLocaleString()}, max ${maxDeclare.toLocaleString()})
              </label>
              <input
                type="number"
                min={MIN_DECLARE}
                max={maxDeclare}
                value={declaredAmount}
                onChange={(e) => setDeclaredAmount(e.target.value)}
                className="w-full border border-emerald-500 bg-black/60 px-3 py-1.5 text-sm text-white font-mono"
              />
              <p className="mt-2 text-xs">
                <span className="text-yellow-300">{ENERGY_COST} energy</span> to start ·{' '}
                <span className="text-gray-400">cash on hand: ${cash.toLocaleString()}</span>
              </p>
            </div>

            <div className="border-2 border-gray-700 bg-[#0f1020] p-3 text-xs text-gray-400">
              <p className="mb-1 font-bold text-gray-300">Venues</p>
              {LAUNDERING_VENUES.map((v) => (
                <div key={v.id} className="flex items-center justify-between border-b border-gray-800 py-1 last:border-b-0">
                  <span>{v.name}</span>
                  <span>
                    cap ${v.dailyCapacity.toLocaleString()} · fee {Math.round(v.feePercent * 100)}% · heat/full fill{' '}
                    {v.heatPerFullFill}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={startRoute}
              disabled={!canAffordEntry}
              className="w-full border-2 border-emerald-400 py-1.5 text-sm font-bold text-emerald-300 hover:bg-emerald-400 hover:text-black disabled:opacity-30"
            >
              Start Route
            </button>
            <button
              onClick={onClose}
              className="w-full border-2 border-gray-500 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
            >
              Walk Away
            </button>
          </div>
        )}

        {screen === 'route' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-2 border-gray-600 bg-[#0f1020] p-2 text-xs">
              <span>
                Hop <span className="font-bold text-cyan-300">{hops.length}</span> / {MAX_HOPS}
              </span>
              <span>
                Heat: <span className="font-bold text-orange-300">{cumulativeHeat.toFixed(1)}</span> / {heatLimit}{' '}
                (audit threshold)
              </span>
              <span>
                Undeclared left: <span className="font-bold text-green-400">${remaining.toLocaleString()}</span>
              </span>
            </div>

            <div>
              <p className="mb-1 text-xs font-bold text-gray-400">Route History</p>
              <div className="max-h-32 overflow-y-auto border-2 border-gray-700 bg-[#0a0a16] p-2">
                {hops.length === 0 && <p className="text-xs text-gray-500">No hops yet.</p>}
                {hops.map((h, i) => (
                  <div key={i} className="border-b border-gray-800 py-1 text-xs last:border-b-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-200">
                        #{i + 1} {h.venueName}
                      </span>
                      <span className={h.audited ? 'font-bold text-red-400' : 'font-bold text-green-400'}>
                        {h.audited ? 'SEIZED' : `+$${Math.round(h.clean).toLocaleString()}`}
                      </span>
                    </div>
                    <div className="text-gray-500">
                      ${h.amount.toLocaleString()} routed · heat +{h.heatAdded.toFixed(1)} · running {h.runningHeat.toFixed(1)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {canRouteAnother && (
              <div className="border-2 border-emerald-500/60 bg-[#0f1020] p-3">
                <p className="mb-2 text-xs font-bold text-gray-300">Pick next venue &amp; amount</p>
                <div className="mb-2 flex flex-wrap gap-2">
                  {availableVenues.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => {
                        setPickVenueId(v.id)
                        setPickAmount('')
                      }}
                      className={`border-2 px-2 py-1 text-left text-xs ${
                        pickVenueId === v.id
                          ? 'border-emerald-400 bg-emerald-900/40 text-emerald-200'
                          : 'border-gray-600 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      <div className="font-bold">{v.name}</div>
                      <div className="text-gray-400">
                        cap ${v.dailyCapacity.toLocaleString()} · fee {Math.round(v.feePercent * 100)}% · heat/full{' '}
                        {v.heatPerFullFill}
                      </div>
                    </button>
                  ))}
                </div>

                {pickedVenue && (
                  <>
                    <label className="mb-1 block text-xs text-gray-400">
                      Amount to route (${MIN_HOP_AMOUNT.toLocaleString()} - ${hopMaxAmount.toLocaleString()})
                    </label>
                    <input
                      type="number"
                      min={MIN_HOP_AMOUNT}
                      max={hopMaxAmount}
                      value={pickAmount}
                      onChange={(e) => setPickAmount(e.target.value)}
                      className="w-full border border-emerald-500 bg-black/60 px-3 py-1.5 text-sm text-white font-mono"
                    />
                    {hopAmountValid && (
                      <div className="mt-2 border border-gray-700 bg-black/40 p-2 text-xs">
                        <p>
                          Clean return: <span className="font-bold text-green-400">${Math.round(hopAmountNum * (1 - pickedVenue.feePercent)).toLocaleString()}</span>{' '}
                          (fee ${Math.round(hopAmountNum * pickedVenue.feePercent).toLocaleString()})
                        </p>
                        <p>
                          Heat this hop: <span className="font-bold text-orange-300">+{previewHeatAdded.toFixed(1)}</span>{' '}
                          → cumulative <span className="font-bold text-orange-300">{previewCumulative.toFixed(1)}</span> / {heatLimit}
                        </p>
                        {previewWillAudit && (
                          <p className="mt-1 font-bold text-red-400">
                            WARNING: this hop would push cumulative heat to or past the audit threshold. This hop's
                            ${hopAmountNum.toLocaleString()} will be seized instead of cleaned if you confirm.
                          </p>
                        )}
                      </div>
                    )}
                    <button
                      onClick={confirmHop}
                      disabled={!hopAmountValid}
                      className={`mt-2 w-full border-2 py-1.5 text-sm font-bold disabled:opacity-30 ${
                        previewWillAudit
                          ? 'border-red-400 text-red-300 hover:bg-red-400 hover:text-black'
                          : 'border-emerald-400 text-emerald-300 hover:bg-emerald-400 hover:text-black'
                      }`}
                    >
                      {previewWillAudit ? 'Confirm Hop (Risk of Audit)' : 'Confirm Hop'}
                    </button>
                  </>
                )}
              </div>
            )}

            {hops.length === 0 ? (
              // Before the first hop is confirmed, there's nothing banked yet
              // to "cash out" - offer Walk Away instead, which costs only the
              // 20 energy already spent to start the route (zero cash/
              // notoriety/wanted/jail consequence).
              <button
                onClick={walkAway}
                className="w-full border-2 border-gray-500 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
              >
                Walk Away
              </button>
            ) : (
              <button
                onClick={cashOut}
                className="w-full border-2 border-cyan-400 py-1.5 text-sm font-bold text-cyan-300 hover:bg-cyan-400 hover:text-black"
              >
                Cash Out Now (bank ${Math.round(totalClean).toLocaleString()} cleared so far)
              </button>
            )}
          </div>
        )}

        {screen === 'results' && resultData && (
          <div className="flex flex-col gap-2 border-2 border-emerald-500 bg-[#0f1020] p-3 text-sm">
            <p className="text-center text-lg font-bold text-emerald-300">
              {resultData.outcome === 'cashout' ? 'Cashed Out Clean' : 'Audited'}
            </p>
            <p className="text-center text-xs text-gray-400">
              {resultData.hops.length} hop{resultData.hops.length === 1 ? '' : 's'} used
            </p>
            {resultData.outcome === 'cashout' ? (
              <p className="text-center text-base font-bold text-green-400">
                +${Math.round(resultData.totalClean).toLocaleString()} clean cash banked
              </p>
            ) : (
              <>
                <p className="text-center text-base font-bold text-red-400">{resultData.res.message}</p>
                <p className="text-center text-xs text-gray-400">
                  Notoriety +15 · Wanted +1
                  {resultData.res.jailed && ' · Arrested'}
                </p>
                {resultData.totalClean > 0 && (
                  <p className="text-center text-xs text-gray-400">
                    (Earlier hops this route already banked ${Math.round(resultData.totalClean).toLocaleString()} clean.)
                  </p>
                )}
              </>
            )}
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => setScreen('setup')}
                className="flex-1 border-2 border-emerald-400 py-1.5 text-sm font-bold text-emerald-300 hover:bg-emerald-400 hover:text-black"
              >
                New Route
              </button>
              <button
                onClick={onClose}
                className="flex-1 border-2 border-gray-600 py-1.5 text-sm text-gray-400 hover:bg-gray-700"
              >
                Leave
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
