import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { PRESIDENTS_ROSTER, FED_CHAIRMEN_ROSTER, FTC_CHAIRMEN_ROSTER } from './governmentRoster'
import { CRIME_SYNDICATES } from './crimeSyndicates'
import { EXPANDED_AGENCIES } from './expandedAgencies'
import { FAMOUS_AGENCY_LEADERS } from './famousAgencyRoster'
import { AGENCY_SUBDEPARTMENTS } from './agencySubdepartments'
import { SCOTUS_JUSTICES } from './scotusEngine'
import { CONGRESS_LEADERS } from './congressEngine'
import { TREASURY_SECRETARIES } from './treasuryEngine'
import { getCharacterPortrait } from '../../data/characterPortraits'

export default function GovernmentModal({ onClose }) {
  const world2 = useGameStore((s) => s.world2)
  const cash = useGameStore((s) => s.cash)
  const addCash = useGameStore((s) => s.addCash)
  const castPresidentialVote = useGameStore((s) => s.castPresidentialVote)
  const buyBondsAction = useGameStore((s) => s.buyBondsAction)

  const [activeTab, setActiveTab] = useState('elections') // 'elections' | 'fed' | 'ftc' | 'scotus' | 'congress' | 'treasury' | 'agencies' | 'crime'
  const [bondAmountInput, setBondAmountInput] = useState('10000')
  const [feedbackMsg, setFeedbackMsg] = useState(null)

  const gov = world2.governmentState || {}
  const treasury = world2.treasuryState || { bondRate: 4.5, playerBonds: 0 }
  const currentPresident = gov.president || PRESIDENTS_ROSTER[0]
  const currentFed = gov.fedChairman || FED_CHAIRMEN_ROSTER[0]
  const currentFtc = gov.ftcChairman || FTC_CHAIRMEN_ROSTER[0]
  const crimeFamilies = gov.crimeSyndicatesState || CRIME_SYNDICATES
  const agencyLogs = gov.agencyLogs || []

  const handleVote = (candidateId) => {
    castPresidentialVote(candidateId)
    setFeedbackMsg(`Ballot cast for ${candidateId}! Presidential election results calculated.`)
  }

  const handleBuyBonds = () => {
    const amt = parseFloat(bondAmountInput) || 10000
    const res = buyBondsAction(amt)
    if (res.success) {
      setFeedbackMsg(`Successfully purchased $${amt.toLocaleString()} in US 10-Year Treasury Bonds at ${treasury.bondRate}% yield!`)
    } else {
      setFeedbackMsg(res.reason)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 font-mono text-white">
      <div className="flex h-[88vh] w-full max-w-5xl flex-col border-4 border-amber-500/70 bg-[#0c0e21] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-amber-500/40 bg-[#161938] px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-amber-400 tracking-wide">🏛️ COMPLETE FEDERAL GOVERNMENT SYSTEM</h1>
            <p className="text-xs text-gray-400">Executive, Legislative (Congress), Judicial (SCOTUS), Treasury, Fed, FTC, Agencies & Crime.</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">Current President</div>
            <div className="text-base font-bold text-yellow-300">{currentPresident.name}</div>
          </div>
        </div>

        {/* Quick Executive Stats Bar */}
        <div className="grid grid-cols-4 divide-x divide-gray-800 bg-[#101229] border-b border-gray-800 py-3 text-center text-xs">
          <div>
            <div className="text-gray-400">Tax Rate</div>
            <div className="text-sm font-bold text-yellow-400">{gov.taxRate || 10}%</div>
          </div>
          <div>
            <div className="text-gray-400">Fed Interest Rate</div>
            <div className="text-sm font-bold text-cyan-400">{gov.interestRate || 5.0}%</div>
          </div>
          <div>
            <div className="text-gray-400">Treasury Bond Yield</div>
            <div className="text-sm font-bold text-emerald-400">{treasury.bondRate || 4.5}%</div>
          </div>
          <div>
            <div className="text-gray-400">Treasury Bonds Held</div>
            <div className="text-sm font-bold text-yellow-300">${(treasury.playerBonds || 0).toLocaleString()}</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap border-b border-gray-800 bg-[#171a3d] text-xs font-bold">
          <button onClick={() => setActiveTab('elections')} className={`px-3 py-2.5 ${activeTab === 'elections' ? 'bg-amber-500 text-black font-extrabold' : 'text-gray-400 hover:text-white'}`}>🗳️ Elections</button>
          <button onClick={() => setActiveTab('fed')} className={`px-3 py-2.5 ${activeTab === 'fed' ? 'bg-cyan-500 text-black font-extrabold' : 'text-gray-400 hover:text-white'}`}>🏦 Fed Reserve</button>
          <button onClick={() => setActiveTab('ftc')} className={`px-3 py-2.5 ${activeTab === 'ftc' ? 'bg-indigo-500 text-white font-extrabold' : 'text-gray-400 hover:text-white'}`}>⚖️ FTC Antitrust</button>
          <button onClick={() => setActiveTab('scotus')} className={`px-3 py-2.5 ${activeTab === 'scotus' ? 'bg-purple-600 text-white font-extrabold' : 'text-gray-400 hover:text-white'}`}>⚖️ SCOTUS</button>
          <button onClick={() => setActiveTab('congress')} className={`px-3 py-2.5 ${activeTab === 'congress' ? 'bg-blue-600 text-white font-extrabold' : 'text-gray-400 hover:text-white'}`}>📜 US Congress</button>
          <button onClick={() => setActiveTab('treasury')} className={`px-3 py-2.5 ${activeTab === 'treasury' ? 'bg-emerald-600 text-white font-extrabold' : 'text-gray-400 hover:text-white'}`}>💵 US Treasury</button>
          <button onClick={() => setActiveTab('agencies')} className={`px-3 py-2.5 ${activeTab === 'agencies' ? 'bg-teal-600 text-white font-extrabold' : 'text-gray-400 hover:text-white'}`}>📋 Agencies</button>
          <button onClick={() => setActiveTab('crime')} className={`px-3 py-2.5 ${activeTab === 'crime' ? 'bg-red-600 text-white font-extrabold' : 'text-gray-400 hover:text-white'}`}>🩸 7 Crime Syndicates</button>
        </div>

        {/* Alert Message */}
        {feedbackMsg && (
          <div className="bg-amber-950/80 border-b border-amber-500 p-2 text-center text-xs font-bold text-amber-300">
            {feedbackMsg}
          </div>
        )}

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB: SCOTUS JUDICIAL REVIEW */}
          {activeTab === 'scotus' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider">⚖️ Supreme Court of the United States (SCOTUS) — 9 Justices</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {SCOTUS_JUSTICES.map((j) => (
                  <div key={j.id} className="rounded border border-purple-500/40 bg-[#16122b] p-3 text-xs">
                    <div className="font-bold text-purple-300">{j.name}</div>
                    <div className="text-[11px] text-gray-300 mt-1">{j.title}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: US CONGRESS */}
          {activeTab === 'congress' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider">📜 Legislative Branch — US Congress (Senate & House Leaders)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CONGRESS_LEADERS.map((c) => (
                  <div key={c.id} className="rounded border border-blue-500/40 bg-[#121931] p-3 text-xs">
                    <div className="font-bold text-blue-300">{c.name}</div>
                    <div className="text-[11px] text-gray-300 mt-1">{c.title}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: US TREASURY & BONDS */}
          {activeTab === 'treasury' && (
            <div className="space-y-6">
              <div className="rounded border border-emerald-500/50 bg-[#10241b] p-4">
                <h3 className="text-sm font-bold text-emerald-300 uppercase tracking-wider mb-2">💵 US Treasury Department & Bond Investments</h3>
                <p className="text-xs text-gray-300 italic">Invest in guaranteed US 10-Year Treasury Bonds yielding {treasury.bondRate}% safe annual interest.</p>
                <div className="mt-4 flex gap-3 items-center">
                  <input
                    type="number"
                    value={bondAmountInput}
                    onChange={(e) => setBondAmountInput(e.target.value)}
                    className="rounded border border-emerald-500 bg-black/60 px-3 py-1.5 text-xs text-white w-40 font-mono"
                    placeholder="Bond Amount $"
                  />
                  <button
                    onClick={handleBuyBonds}
                    className="border border-emerald-400 bg-emerald-500/20 px-5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500 hover:text-black transition-all"
                  >
                    Purchase Treasury Bonds
                  </button>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">📜 Treasury Secretaries Directory</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {TREASURY_SECRETARIES.map((t) => (
                    <div key={t.id} className="rounded border border-emerald-500/30 bg-[#121f1c] p-3 text-xs">
                      <div className="font-bold text-emerald-300">{t.name}</div>
                      <div className="text-[11px] text-gray-300 mt-1">{t.title}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: ELECTION & PRESIDENT */}
          {activeTab === 'elections' && (
            <div className="space-y-6">
              <div className="rounded border border-amber-500/50 bg-[#161a3b] p-4">
                <div className="flex items-center justify-between border-b border-gray-700 pb-2">
                  <div className="flex items-center gap-3">
                    <img src={getCharacterPortrait(currentPresident.id, currentPresident.name, 'Pres')} alt={currentPresident.name} className="h-12 w-12 rounded border border-amber-400" />
                    <div>
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Incumbent Commander-In-Chief</span>
                      <h2 className="text-xl font-bold text-yellow-300">{currentPresident.name}</h2>
                      <p className="text-xs text-gray-300">Party: {currentPresident.party} • Platform: "{currentPresident.platform}"</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: FEDERAL RESERVE */}
          {activeTab === 'fed' && (
            <div className="space-y-6">
              <div className="rounded border border-cyan-500/50 bg-[#121938] p-4">
                <div className="flex items-center justify-between border-b border-gray-700 pb-2">
                  <div className="flex items-center gap-3">
                    <img src={getCharacterPortrait(currentFed.id, currentFed.name, 'Fed')} alt={currentFed.name} className="h-12 w-12 rounded border border-cyan-400" />
                    <div>
                      <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Federal Reserve Chairman</span>
                      <h2 className="text-xl font-bold text-cyan-300">{currentFed.name}</h2>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: FTC ANTITRUST */}
          {activeTab === 'ftc' && (
            <div className="space-y-6">
              <div className="rounded border border-indigo-500/50 bg-[#171638] p-4">
                <div className="flex items-center gap-3">
                  <img src={getCharacterPortrait(currentFtc.id, currentFtc.name, 'FTC')} alt={currentFtc.name} className="h-12 w-12 rounded border border-indigo-400" />
                  <div>
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">FTC Chairman</span>
                    <h2 className="text-xl font-bold text-indigo-300">{currentFtc.name}</h2>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: AGENCIES */}
          {activeTab === 'agencies' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(FAMOUS_AGENCY_LEADERS).flatMap(([agencyKey, leaders]) =>
                  leaders.map((leader) => (
                    <div key={leader.id} className="rounded border border-emerald-500/50 bg-[#111f26] p-4 shadow-md">
                      <div className="flex items-start gap-3 border-b border-emerald-800 pb-2">
                        <img src={getCharacterPortrait(leader.id, leader.name, agencyKey)} alt={leader.name} className="h-12 w-12 rounded border border-emerald-400" />
                        <div>
                          <h4 className="font-bold text-emerald-300 text-base">{leader.name}</h4>
                          <div className="text-xs text-yellow-300">{leader.title}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: 7 CRIME SYNDICATES */}
          {activeTab === 'crime' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {crimeFamilies.map((syn) => (
                  <div key={syn.id} className="rounded border border-red-500/50 bg-[#1d121c] p-4 shadow-md">
                    <div className="flex items-start justify-between border-b border-red-900/50 pb-2">
                      <div className="flex items-center gap-3">
                        <img src={getCharacterPortrait(syn.boss.id, syn.boss.name, 'Crime')} alt={syn.boss.name} className="h-10 w-10 rounded border border-red-500" />
                        <div>
                          <h4 className="font-bold text-red-400 text-base">{syn.name}</h4>
                          <p className="text-xs text-gray-400">Territory: {syn.territory}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 bg-[#101229] p-4 text-right">
          <button
            onClick={onClose}
            className="border-2 border-gray-600 bg-gray-800 px-6 py-2 text-xs font-bold text-white hover:bg-gray-700 transition-colors"
          >
            Close Government Modal
          </button>
        </div>
      </div>
    </div>
  )
}
