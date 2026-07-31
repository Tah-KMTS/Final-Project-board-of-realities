import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { FINANCE_NPCS } from './financeNpcs'

// `embedded` (default false): the former "Board" header button's content.
// That button is gone (folded into the Phone's Banking & Portfolio app - see
// src/features/phone/BankingApp.jsx, since recruiting financial advisors is
// a portfolio decision); embedded=true drops the outer fixed-overlay wrapper
// and the bottom "Close Board Room" button, same convention as every other
// hub-tab modal in this codebase (CryptoModal.jsx etc).
export default function SyndicateBoardModal({ onClose, embedded = false }) {
  const world2 = useGameStore((s) => s.world2)
  const cash = useGameStore((s) => s.cash)
  const getDailyFinanceIncome = useGameStore((s) => s.getDailyFinanceIncome)
  const recruitFinanceNpc = useGameStore((s) => s.recruitFinanceNpc)
  const [activeTab, setActiveTab] = useState('board') // 'board' | 'all'

  const recruitedIds = world2.recruitedAdvisors || []
  const recruitedTitans = FINANCE_NPCS.filter((n) => recruitedIds.includes(n.id))
  const unrecruitedTitans = FINANCE_NPCS.filter((n) => !recruitedIds.includes(n.id))

  const { advisorPassive } = getDailyFinanceIncome()

  const body = (
    <>
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-yellow-500/40 bg-[#171a35] px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-yellow-400 tracking-wide">💼 BOARD OF REALITIES — SYNDICATE CABINET</h1>
            <p className="text-xs text-gray-400">Recruit history's greatest financial minds & industrial titans to dominate the market.</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">Board Members</div>
            <div className="text-lg font-bold text-emerald-400">{recruitedTitans.length} / {FINANCE_NPCS.length}</div>
          </div>
        </div>

        {/* Stats Banner */}
        <div className="grid grid-cols-3 divide-x divide-gray-800 bg-[#121429] border-b border-gray-800 py-3 text-center text-xs">
          <div>
            <div className="text-gray-400">Daily Advisor Passive Payout</div>
            <div className="text-sm font-bold text-emerald-400">+${(advisorPassive || 0).toLocaleString()} / day</div>
          </div>
          <div>
            <div className="text-gray-400">Syndicate Liquid Treasury</div>
            <div className="text-sm font-bold text-yellow-400">${cash.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-gray-400">Active Board Perks</div>
            <div className="text-sm font-bold text-cyan-400">{recruitedTitans.length} Perks Enabled</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-800 bg-[#181a38] text-xs font-bold">
          <button
            onClick={() => setActiveTab('board')}
            className={`px-6 py-2.5 transition-colors ${activeTab === 'board' ? 'bg-yellow-500 text-black font-extrabold' : 'text-gray-400 hover:text-white'}`}
          >
            My Board Members ({recruitedTitans.length})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-6 py-2.5 transition-colors ${activeTab === 'all' ? 'bg-yellow-500 text-black font-extrabold' : 'text-gray-400 hover:text-white'}`}
          >
            All Historical Titans ({unrecruitedTitans.length} available)
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'board' && (
            <div>
              {recruitedTitans.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center rounded border border-dashed border-gray-700 text-center text-gray-500">
                  <span className="text-4xl mb-2">🏛️</span>
                  <p className="text-sm font-bold text-gray-400">Your Syndicate Board is currently empty.</p>
                  <p className="text-xs max-w-md mt-1">Explore the Financial District overworld and talk to historical titans, or switch to the 'All Historical Titans' tab to recruit them directly!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recruitedTitans.map((npc) => (
                    <div key={npc.id} className="rounded border border-emerald-500/50 bg-[#181c3b] p-4 shadow-md">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-yellow-900/60 px-1.5 py-0.5 text-[10px] text-yellow-300 font-semibold">{npc.era}</span>
                            <h3 className="font-bold text-emerald-400">{npc.name}</h3>
                          </div>
                          <p className="text-xs text-gray-400">"{npc.title}"</p>
                        </div>
                        <span className="rounded bg-emerald-950 px-2 py-0.5 text-[10px] text-emerald-300 font-bold border border-emerald-500/60">ACTIVE</span>
                      </div>
                      <div className="mt-3 rounded bg-emerald-950/40 p-2.5 text-xs border border-emerald-500/30">
                        <div className="font-bold text-emerald-300">⚡ {npc.perkTitle}</div>
                        <div className="text-gray-300 text-[11px] mt-0.5">{npc.perkDescription}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'all' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {FINANCE_NPCS.map((npc) => {
                const isRecruited = recruitedIds.includes(npc.id)
                return (
                  <div key={npc.id} className={`rounded border p-4 shadow-md transition-all ${isRecruited ? 'border-emerald-500/40 bg-[#161c36]' : 'border-gray-700 bg-[#14162e]'}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-yellow-300">{npc.era}</span>
                          <h3 className="font-bold text-gray-200">{npc.name}</h3>
                        </div>
                        <p className="text-xs text-gray-400">"{npc.title}" • Wealth: ${npc.netWorth.toLocaleString()}</p>
                      </div>
                      {isRecruited ? (
                        <span className="rounded bg-emerald-950 px-2 py-0.5 text-[10px] text-emerald-300 font-bold border border-emerald-500">RECRUITED</span>
                      ) : (
                        <span className="text-xs font-bold text-yellow-400">${npc.recruitCost.toLocaleString()}</span>
                      )}
                    </div>

                    <div className="mt-2.5 rounded bg-gray-900/60 p-2.5 text-xs border border-gray-800">
                      <div className="font-bold text-yellow-400">⚡ {npc.perkTitle}</div>
                      <div className="text-gray-300 text-[11px] mt-0.5">{npc.perkDescription}</div>
                    </div>

                    {!isRecruited && (() => {
                      // Simons and Buffett (the two strongest passive-income
                      // advisors) are gated behind the Titan Apprentice net
                      // worth milestone ($5M) in recruitFinanceNpc() - mirror
                      // that gate here so the button reflects it instead of
                      // just silently no-op'ing on click.
                      const milestoneLocked = (npc.id === 'simons' || npc.id === 'buffett')
                        && !(world2.netWorthMilestones || []).includes('titan_apprentice')
                      const affordable = cash >= npc.recruitCost && !milestoneLocked
                      return (
                        <button
                          onClick={() => recruitFinanceNpc(npc.id)}
                          disabled={!affordable}
                          className={`mt-3 w-full border py-1.5 text-xs font-bold transition-all ${affordable ? 'border-yellow-400 bg-yellow-600/30 text-yellow-300 hover:bg-yellow-500 hover:text-black' : 'border-gray-700 bg-gray-800 text-gray-600 cursor-not-allowed'}`}
                        >
                          {milestoneLocked
                            ? 'Requires Titan Apprentice milestone ($5,000,000 net worth)'
                            : affordable
                              ? `👔 Recruit to Board ($${npc.recruitCost.toLocaleString()})`
                              : `Insufficient Cash ($${npc.recruitCost.toLocaleString()})`}
                        </button>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {!embedded && (
          <div className="border-t border-gray-800 bg-[#121429] p-4 text-right">
            <button
              onClick={onClose}
              className="border-2 border-gray-600 bg-gray-800 px-6 py-2 text-xs font-bold text-white hover:bg-gray-700 transition-colors"
            >
              Close Board Room
            </button>
          </div>
        )}
    </>
  )

  // Embedded mode drops the fixed h-[85vh] overlay panel entirely - the
  // wrapping Phone app tab already gives this its own scrollable area, same
  // reasoning as GovernmentModal.jsx's embedded branch.
  if (embedded) return <div className="flex max-h-[70vh] flex-col overflow-y-auto text-white">{body}</div>

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="flex h-[85vh] w-full max-w-4xl flex-col border-4 border-yellow-500/70 bg-[#0f1123] font-mono text-white shadow-2xl">
        {body}
      </div>
    </div>
  )
}
