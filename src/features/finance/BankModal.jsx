import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { REAL_ESTATE_LISTINGS, JOB_ENERGY_COST } from './marketData'
import CorporateModal from './CorporateModal'

function MoneyField({ value, onChange, disabled }) {
  return (
    <input
      type="number"
      min={0}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value)) || 0))}
      className="w-24 border border-gray-600 bg-black px-1 py-1 text-white disabled:opacity-50"
    />
  )
}

// `embedded` (default false): standalone building access (walking up to the
// Bank building) keeps working exactly as before. When true (Phone app ->
// Banking & Portfolio's "Bank & Realty" tab - see src/features/phone/
// BankingApp.jsx), skip the outer fixed-overlay wrapper and the bottom
// "Leave" button - the wrapping hub (BankingApp / the phone shell) supplies
// both, same convention as CryptoModal.jsx/GovernmentModal.jsx. Work Shift,
// Rob Vault, Real Estate, AND Corporate Holdings (company acquisitions,
// embeds CorporateModal.jsx - see that file) are ALSO gated to !embedded
// (building-only) - only deposits/withdrawals/loans stay phone-reachable
// now. Clocking in for a shift, holding up the vault, or touring/acquiring
// a property/company all only make sense standing in the building; assets
// you already own still show up in the phone's Portfolio tab
// (PortfolioTab.jsx), this just moves the *buying* actions to a building
// visit.
export default function BankModal({ onClose, embedded = false }) {
  const cash = useGameStore((s) => s.cash)
  const world2 = useGameStore((s) => s.world2)
  const player = useGameStore((s) => s.player)
  const buyRealEstate = useGameStore((s) => s.buyRealEstate)
  const workShift = useGameStore((s) => s.workShift)
  const currentJobTier = useGameStore((s) => s.currentJobTier)
  const depositCash = useGameStore((s) => s.depositCash)
  const withdrawCash = useGameStore((s) => s.withdrawCash)
  const creditScore = useGameStore((s) => s.creditScore)
  const loanTier = useGameStore((s) => s.loanTier)
  const takeLoan = useGameStore((s) => s.takeLoan)
  const repayLoan = useGameStore((s) => s.repayLoan)
  const executeCrime = useGameStore((s) => s.executeCrime)

  const [depositInput, setDepositInput] = useState(100)
  const [withdrawInput, setWithdrawInput] = useState(100)
  const [loanInput, setLoanInput] = useState(1000)
  const [repayInput, setRepayInput] = useState(1000)
  const [feedbackMsg, setFeedbackMsg] = useState(null)

  const tier = currentJobTier()
  const atRiskCash = Math.max(0, cash - (world2.bankedAmount || 0))
  const score = Math.round(creditScore())
  const tierInfo = loanTier()
  const loanBalance = world2.loanBalance || 0
  const canWork = player.energy >= JOB_ENERGY_COST

  const body = (
    <>
        <h2 className="mb-2 text-xl font-bold text-blue-300">Bank & Realty Office</h2>

        {/* Work Shift and Rob Vault (below) are both building-only now - you
            physically clock in or physically hold up the vault, neither
            makes sense to do remotely from a phone. Everything else here
            (deposit/withdraw/loans/real estate) stays available from the
            phone's Bank & Realty tab. */}
        {!embedded && (
          <div className="mb-4 border-2 border-gray-600 bg-[#0f1020] p-3">
            <p className="mb-2 text-sm font-bold">Job: {tier.label}</p>
            <p className="mb-2 text-xs text-gray-400">
              Pay ${tier.pay}/shift • costs {JOB_ENERGY_COST} energy • next tier needs
              {' '}{tier.id === 'executive' ? 'nothing - top tier' : 'more INT/Reputation'}
            </p>
            <button
              onClick={workShift}
              disabled={!canWork}
              className="w-full border-2 border-green-400 bg-green-500 py-1 text-sm font-bold text-black hover:bg-green-400 disabled:opacity-40"
            >
              {canWork ? `Work Shift (+$${tier.pay})` : `Not enough energy (${player.energy}/${JOB_ENERGY_COST})`}
            </button>
          </div>
        )}

        <div className="mb-4 border-2 border-gray-600 bg-[#0f1020] p-3">
          <p className="mb-2 text-sm font-bold">Bank Account</p>
          <p className="mb-2 text-xs text-gray-400">
            On hand: <span className="text-yellow-300">${atRiskCash.toLocaleString()}</span> (at risk) •
            Banked: <span className="text-green-400">${(world2.bankedAmount || 0).toLocaleString()}</span> (protected)
          </p>
          <div className="flex items-center gap-2 mb-2">
            <MoneyField value={depositInput} onChange={setDepositInput} />
            <button
              onClick={() => depositCash(depositInput)}
              disabled={depositInput <= 0 || depositInput > atRiskCash}
              className="border border-green-400 px-2 py-1 text-xs text-green-400 hover:bg-green-400 hover:text-black disabled:opacity-30"
            >
              Deposit
            </button>
          </div>
          <div className="flex items-center gap-2">
            <MoneyField value={withdrawInput} onChange={setWithdrawInput} />
            <button
              onClick={() => withdrawCash(withdrawInput)}
              disabled={withdrawInput <= 0 || withdrawInput > (world2.bankedAmount || 0)}
              className="border border-cyan-400 px-2 py-1 text-xs text-cyan-400 hover:bg-cyan-400 hover:text-black disabled:opacity-30"
            >
              Withdraw
            </button>
          </div>
        </div>

        <div className="mb-4 border-2 border-gray-600 bg-[#0f1020] p-3">
          <p className="mb-2 text-sm font-bold">Loans</p>
          <p className="mb-2 text-xs text-gray-400">
            Credit score: <span className="text-yellow-300">{score}/100</span> •
            Max loan: <span className="text-yellow-300">${tierInfo.maxLoan.toLocaleString()}</span> •
            Interest: <span className="text-orange-400">{Math.round(tierInfo.interestPerDay * 100)}%/day</span>
          </p>
          <p className="mb-2 text-xs text-gray-400">Outstanding debt: <span className="text-red-400">${loanBalance.toLocaleString()}</span></p>
          <div className="flex items-center gap-2 mb-2">
            <MoneyField value={loanInput} onChange={setLoanInput} />
            <button
              onClick={() => takeLoan(loanInput)}
              disabled={loanInput <= 0 || loanBalance + loanInput > tierInfo.maxLoan}
              className="border border-green-400 px-2 py-1 text-xs text-green-400 hover:bg-green-400 hover:text-black disabled:opacity-30"
            >
              Borrow
            </button>
          </div>
          <div className="flex items-center gap-2">
            <MoneyField value={repayInput} onChange={setRepayInput} />
            <button
              onClick={() => repayLoan(repayInput)}
              disabled={repayInput <= 0 || repayInput > cash || repayInput > loanBalance}
              className="border border-cyan-400 px-2 py-1 text-xs text-cyan-400 hover:bg-cyan-400 hover:text-black disabled:opacity-30"
            >
              Repay
            </button>
          </div>
        </div>

        {!embedded && (
          <div className="mb-4 border-2 border-gray-600 bg-[#0f1020] p-3">
            <p className="mb-2 text-sm font-bold">Real Estate</p>
            {REAL_ESTATE_LISTINGS.map((listing) => {
              const owned = world2.realEstate.includes(listing.id)
              const milestoneLocked = listing.requiresMilestone && !(world2.netWorthMilestones || []).includes(listing.requiresMilestone)
              return (
                <div key={listing.id} className="mb-2 flex items-center justify-between border-b border-gray-700 pb-2 text-xs">
                  <div>
                    <p className="font-bold">{listing.name}</p>
                    <p className="text-gray-400">${listing.price.toLocaleString()} • rent ${listing.rentPerTick}/tick</p>
                    {milestoneLocked && (
                      <p className="text-purple-400">Requires Conglomerate Threshold milestone ($1,000,000 net worth)</p>
                    )}
                  </div>
                  {owned ? (
                    <span className="text-green-400">Owned</span>
                  ) : (
                    <button
                      onClick={() => buyRealEstate(listing)}
                      disabled={cash < listing.price || milestoneLocked}
                      className="border border-green-400 px-2 py-1 text-green-400 hover:bg-green-400 hover:text-black disabled:opacity-30"
                    >
                      Buy
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Corporate Holdings (company acquisitions) - moved here from the
            phone's Startups & M&A app, which was removed: CorporateModal
            had zero other entry point in the game (its old standalone
            buildings, "Corporate Holdings"/"VC Hub", were deleted in an
            earlier map-trim pass), so relocating it here rather than
            deleting the feature outright. Same building-only gating as
            Real Estate right above - reuses CorporateModal.jsx as-is via
            its embedded prop instead of duplicating its listing markup. */}
        {!embedded && (
          <div className="mb-4 border-2 border-gray-600 bg-[#0f1020] p-3">
            <CorporateModal embedded />
          </div>
        )}

        {!embedded && (
          <button
            onClick={() => {
              const res = executeCrime({
                type: 'rob',
                baseSuccessChance: 0.4, // 40% base
                payout: 25000,
                notorietyIncreaseOnFail: 25,
                wantedIncreaseOnFail: 3,
                energyCost: 30,
                assetSeizureOnFail: 0.2, // lose 20% of cash
                jailChanceOnFail: 0.30,
              })
              setFeedbackMsg(res.message || res.reason)
            }}
            className="mb-4 w-full border-4 border-red-500 bg-red-900 py-2 font-bold text-white hover:bg-red-700"
          >
            Rob Vault (30 Energy)
          </button>
        )}

        {feedbackMsg && <p className="mb-4 text-xs italic text-red-300">{feedbackMsg}</p>}

        {!embedded && (
          <button
            onClick={onClose}
            className="w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500"
          >
            Leave
          </button>
        )}
    </>
  )

  if (embedded) return <div className="text-white">{body}</div>

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[480px] max-h-[85vh] overflow-y-auto border-4 border-blue-400 bg-[#1c1d3a] p-6 font-mono text-white">
        {body}
      </div>
    </div>
  )
}
