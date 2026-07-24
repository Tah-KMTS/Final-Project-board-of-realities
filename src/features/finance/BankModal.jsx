import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { REAL_ESTATE_LISTINGS, JOB_ENERGY_COST } from './marketData'

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

export default function BankModal({ onClose }) {
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

  const [depositInput, setDepositInput] = useState(100)
  const [withdrawInput, setWithdrawInput] = useState(100)
  const [loanInput, setLoanInput] = useState(1000)
  const [repayInput, setRepayInput] = useState(1000)

  const tier = currentJobTier()
  const atRiskCash = Math.max(0, cash - (world2.bankedAmount || 0))
  const score = Math.round(creditScore())
  const tierInfo = loanTier()
  const loanBalance = world2.loanBalance || 0
  const canWork = player.energy >= JOB_ENERGY_COST

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[480px] max-h-[85vh] overflow-y-auto border-4 border-blue-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-2 text-xl font-bold text-blue-300">Bank & Realty Office</h2>

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

        <div className="mb-4 border-2 border-gray-600 bg-[#0f1020] p-3">
          <p className="mb-2 text-sm font-bold">Real Estate</p>
          {REAL_ESTATE_LISTINGS.map((listing) => {
            const owned = world2.realEstate.includes(listing.id)
            return (
              <div key={listing.id} className="mb-2 flex items-center justify-between border-b border-gray-700 pb-2 text-xs">
                <div>
                  <p className="font-bold">{listing.name}</p>
                  <p className="text-gray-400">${listing.price.toLocaleString()} • rent ${listing.rentPerTick}/tick</p>
                </div>
                {owned ? (
                  <span className="text-green-400">Owned</span>
                ) : (
                  <button
                    onClick={() => buyRealEstate(listing)}
                    disabled={cash < listing.price}
                    className="border border-green-400 px-2 py-1 text-green-400 hover:bg-green-400 hover:text-black disabled:opacity-30"
                  >
                    Buy
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <button
          onClick={onClose}
          className="w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500"
        >
          Leave
        </button>
      </div>
    </div>
  )
}
