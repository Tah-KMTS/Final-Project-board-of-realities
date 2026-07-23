import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { PRESIDENTS_ROSTER, FED_CHAIRMEN_ROSTER, FTC_CHAIRMEN_ROSTER } from './governmentRoster'
import { CRIME_SYNDICATES } from './crimeSyndicates'
import { EXPANDED_AGENCIES } from './expandedAgencies'
import { FAMOUS_AGENCY_LEADERS } from './famousAgencyRoster'
import { AGENCY_SUBDEPARTMENTS } from './agencySubdepartments'
import { getCharacterPortrait } from '../../data/characterPortraits'

export default function GovernmentModal({ onClose }) {
  const world2 = useGameStore((s) => s.world2)
  const castPresidentialVote = useGameStore((s) => s.castPresidentialVote)
  const [activeTab, setActiveTab] = useState('elections') // 'elections' | 'fed' | 'ftc' | 'agencies' | 'crime'
  const [voteSubmittedMsg, setVoteSubmittedMsg] = useState(null)

  const gov = world2.governmentState || {}
  const currentPresident = gov.president || PRESIDENTS_ROSTER[0]
  const currentFed = gov.fedChairman || FED_CHAIRMEN_ROSTER[0]
  const currentFtc = gov.ftcChairman || FTC_CHAIRMEN_ROSTER[0]
  const crimeFamilies = gov.crimeSyndicatesState || CRIME_SYNDICATES
  const agencyLogs = gov.agencyLogs || []

  const handleVote = (candidateId) => {
    castPresidentialVote(candidateId)
    setVoteSubmittedMsg(`Ballot cast for ${candidateId}! Presidential election results calculated.`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 font-mono text-white">
      <div className="flex h-[88vh] w-full max-w-5xl flex-col border-4 border-amber-500/70 bg-[#0c0e21] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-amber-500/40 bg-[#161938] px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-amber-400 tracking-wide">🏛️ GOVERNMENT, FEDERAL RESERVE, FTC & AGENCIES</h1>
            <p className="text-xs text-gray-400">Presidential Elections, Fed Monetary Policy, FTC Antitrust, Famous Agency Leaders & Subdepartments.</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">Current President</div>
            <div className="text-base font-bold text-yellow-300">{currentPresident.name}</div>
          </div>
        </div>

        {/* Quick Executive Stats Bar */}
        <div className="grid grid-cols-4 divide-x divide-gray-800 bg-[#101229] border-b border-gray-800 py-3 text-center text-xs">
          <div>
            <div className="text-gray-400">Federal Tax Rate</div>
            <div className="text-sm font-bold text-yellow-400">{gov.taxRate || 10}%</div>
          </div>
          <div>
            <div className="text-gray-400">Fed Interest Rate</div>
            <div className="text-sm font-bold text-cyan-400">{gov.interestRate || 5.0}%</div>
          </div>
          <div>
            <div className="text-gray-400">Inflation Rate</div>
            <div className="text-sm font-bold text-orange-400">{gov.inflationRate || 2.5}%</div>
          </div>
          <div>
            <div className="text-gray-400">Days Until Election</div>
            <div className="text-sm font-bold text-emerald-400">{gov.daysUntilElection || 10} Days</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-800 bg-[#171a3d] text-xs font-bold">
          <button
            onClick={() => setActiveTab('elections')}
            className={`px-4 py-3 transition-colors ${activeTab === 'elections' ? 'bg-amber-500 text-black font-extrabold' : 'text-gray-400 hover:text-white'}`}
          >
            🗳️ Presidential Elections
          </button>
          <button
            onClick={() => setActiveTab('fed')}
            className={`px-4 py-3 transition-colors ${activeTab === 'fed' ? 'bg-cyan-500 text-black font-extrabold' : 'text-gray-400 hover:text-white'}`}
          >
            🏦 Federal Reserve
          </button>
          <button
            onClick={() => setActiveTab('ftc')}
            className={`px-4 py-3 transition-colors ${activeTab === 'ftc' ? 'bg-indigo-500 text-white font-extrabold' : 'text-gray-400 hover:text-white'}`}
          >
            ⚖️ FTC Antitrust
          </button>
          <button
            onClick={() => setActiveTab('agencies')}
            className={`px-4 py-3 transition-colors ${activeTab === 'agencies' ? 'bg-emerald-600 text-white font-extrabold' : 'text-gray-400 hover:text-white'}`}
          >
            📋 Famous Leaders & Subdepartments
          </button>
          <button
            onClick={() => setActiveTab('crime')}
            className={`px-4 py-3 transition-colors ${activeTab === 'crime' ? 'bg-red-600 text-white font-extrabold' : 'text-gray-400 hover:text-white'}`}
          >
            🩸 7 Crime Syndicates
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: ELECTION & PRESIDENT */}
          {activeTab === 'elections' && (
            <div className="space-y-6">
              {voteSubmittedMsg && (
                <div className="rounded border border-emerald-500 bg-emerald-950/60 p-3 text-center text-xs font-bold text-emerald-300">
                  {voteSubmittedMsg}
                </div>
              )}

              {/* Incumbent President Banner */}
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
                  <div className="text-right">
                    <span className="rounded bg-amber-950 px-2.5 py-1 text-xs font-bold text-amber-300 border border-amber-500">
                      Tax Rate: {currentPresident.taxRate}%
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-300 italic">{currentPresident.description}</p>
              </div>

              {/* Active Election Candidates */}
              <div>
                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3">🗳️ Active Presidential Candidates</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(gov.activeCandidates || PRESIDENTS_ROSTER.slice(0, 3)).map((cand) => (
                    <div key={cand.id} className="rounded border border-gray-700 bg-[#141733] p-4 flex flex-col justify-between shadow-md">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <img src={getCharacterPortrait(cand.id, cand.name, 'Pres')} alt={cand.name} className="h-10 w-10 rounded border border-yellow-400" />
                          <div>
                            <div className="text-xs font-bold text-yellow-400">{cand.party}</div>
                            <h4 className="text-sm font-bold text-white">{cand.name}</h4>
                          </div>
                        </div>
                        <p className="text-xs text-cyan-300 font-semibold">"{cand.platform}"</p>
                        <p className="text-xs text-gray-300 mt-2">{cand.description}</p>
                      </div>
                      <button
                        onClick={() => handleVote(cand.id)}
                        className="mt-4 w-full border-2 border-yellow-400 bg-yellow-600/30 py-2 text-xs font-bold text-yellow-300 hover:bg-yellow-500 hover:text-black transition-all"
                      >
                        Vote for {cand.name}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FEDERAL RESERVE */}
          {activeTab === 'fed' && (
            <div className="space-y-6">
              <div className="rounded border border-cyan-500/50 bg-[#121938] p-4">
                <div className="flex items-center justify-between border-b border-gray-700 pb-2">
                  <div className="flex items-center gap-3">
                    <img src={getCharacterPortrait(currentFed.id, currentFed.name, 'Fed')} alt={currentFed.name} className="h-12 w-12 rounded border border-cyan-400" />
                    <div>
                      <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Federal Reserve Chairman</span>
                      <h2 className="text-xl font-bold text-cyan-300">{currentFed.name}</h2>
                      <p className="text-xs text-gray-300">"{currentFed.title}" • Policy Stance: <b className="text-yellow-300">{currentFed.policyBias}</b></p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">Target Benchmark Rate</div>
                    <div className="text-lg font-bold text-cyan-300">{currentFed.targetRate}%</div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-300 italic">{currentFed.description}</p>
              </div>
            </div>
          )}

          {/* TAB 3: FTC ANTITRUST */}
          {activeTab === 'ftc' && (
            <div className="space-y-6">
              <div className="rounded border border-indigo-500/50 bg-[#171638] p-4">
                <div className="flex items-center justify-between border-b border-gray-700 pb-2">
                  <div className="flex items-center gap-3">
                    <img src={getCharacterPortrait(currentFtc.id, currentFtc.name, 'FTC')} alt={currentFtc.name} className="h-12 w-12 rounded border border-indigo-400" />
                    <div>
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">FTC Chairman</span>
                      <h2 className="text-xl font-bold text-indigo-300">{currentFtc.name}</h2>
                      <p className="text-xs text-gray-300">"{currentFtc.title}" • Enforcement Focus: <b className="text-yellow-300">{currentFtc.bias}</b></p>
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-300 italic">{currentFtc.description}</p>
              </div>
            </div>
          )}

          {/* TAB 4: FAMOUS LEADERS & SUBDEPARTMENTS */}
          {activeTab === 'agencies' && (
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-3">🏛️ Famous Historical Agency Leaders & Statutory Terms</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(FAMOUS_AGENCY_LEADERS).flatMap(([agencyKey, leaders]) =>
                  leaders.map((leader) => (
                    <div key={leader.id} className="rounded border border-emerald-500/50 bg-[#111f26] p-4 shadow-md">
                      <div className="flex items-start gap-3 border-b border-emerald-800 pb-2">
                        <img src={getCharacterPortrait(leader.id, leader.name, agencyKey)} alt={leader.name} className="h-12 w-12 rounded border border-emerald-400" />
                        <div>
                          <h4 className="font-bold text-emerald-300 text-base">{leader.name}</h4>
                          <div className="text-xs text-yellow-300">{leader.title}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">Term: {leader.termType}</div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-300 mt-2 italic">{leader.background}</p>
                      
                      {/* Department Staff */}
                      <div className="mt-3 rounded bg-black/40 p-2 text-xs border border-emerald-950">
                        <div className="text-[10px] text-emerald-400 font-bold uppercase mb-1">Key Department Staff:</div>
                        {leader.staff.map((st) => (
                          <div key={st.id} className="flex justify-between text-[11px]">
                            <span className="text-gray-300">• {st.name}:</span>
                            <b className="text-yellow-400">{st.role}</b>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Agency Subdepartments */}
              <div className="mt-6">
                <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-3">⚙️ Agency Subdepartments & Tasks</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {AGENCY_SUBDEPARTMENTS.map((sub, idx) => (
                    <div key={idx} className="rounded border border-cyan-500/30 bg-[#121936] p-3 text-xs">
                      <div className="font-bold text-cyan-300">{sub.name}</div>
                      <div className="text-gray-400 text-[11px] mt-0.5">Lead: {sub.lead}</div>
                      <div className="text-yellow-300 font-semibold mt-1">Task: {sub.task}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: 7 CRIME SYNDICATES */}
          {activeTab === 'crime' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider">BS 7 Historical Crime Syndicates</h3>
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

                    <div className="mt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">👑 Boss:</span>
                        <b className="text-yellow-300">{syn.boss.name}</b>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">🗡️ Underboss:</span>
                        <b className="text-red-300">{syn.underboss.name}</b>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">💼 Capo:</span>
                        <b className="text-gray-300">{syn.capo.name}</b>
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
