import React, { useState } from 'react'
import { useGameStore } from '../store/useGameStore'
import { PRESIDENTS_ROSTER, FED_CHAIRMEN_ROSTER, FTC_CHAIRMEN_ROSTER } from '../features/government/governmentRoster'
import { CRIME_SYNDICATES } from '../features/government/crimeSyndicates'
import { EXPANDED_AGENCIES } from '../features/government/expandedAgencies'
import { FAMOUS_AGENCY_LEADERS } from '../features/government/famousAgencyRoster'
import { AGENCY_SUBDEPARTMENTS } from '../features/government/agencySubdepartments'
import { SCOTUS_JUSTICES } from '../features/government/scotusEngine'
import { CONGRESS_LEADERS } from '../features/government/congressEngine'
import { TREASURY_SECRETARIES } from '../features/government/treasuryEngine'
import { getCharacterPortrait } from '../data/characterPortraits'

// `embedded` (default false): the status-bar "Open Gov" button in
// FinanceStatusBar.jsx keeps working exactly as before, standalone. When
// true (GovernmentBuildingModal's "Government Affairs" tab), skip the outer
// overlay + the footer's "Close Government Modal" button - the wrapping hub
// modal supplies both. GovernmentModal's own internal elections/Fed/FTC/
// SCOTUS/Congress/Treasury/agencies/crime tab bar is kept either way - that's
// the content actually being embedded, not something this flattens away.
export default function GovernmentModal({ onClose, embedded = false }) {
  const world2 = useGameStore((s) => s.world2)
  const castPresidentialVote = useGameStore((s) => s.castPresidentialVote)
  const triggerElection = useGameStore((s) => s.triggerElection)
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
  const activeCandidates = gov.activeCandidates || PRESIDENTS_ROSTER.slice(0, 3)

  const handleVote = (candidateId) => {
    castPresidentialVote(candidateId)
    const candidateObj = PRESIDENTS_ROSTER.find((c) => c.id === candidateId)
    setFeedbackMsg(`Ballot cast for ${candidateObj?.name || candidateId}! Election tally calculated across Titans & Citizens.`)
  }

  const handleTriggerElection = () => {
    triggerElection()
    setFeedbackMsg('🗳️ Special Presidential Election Campaign launched! Review candidates below.')
  }

  const handleBuyBonds = () => {
    const amt = parseFloat(bondAmountInput) || 10000
    const res = buyBondsAction(amt)
    if (res.success) {
      setFeedbackMsg(`Successfully purchased $${amt.toLocaleString()} in US Treasury Bonds at ${treasury.bondRate}% yield!`)
    } else {
      setFeedbackMsg(res.reason || 'Failed to buy bonds.')
    }
  }

  const body = (
    <>
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-amber-500/40 bg-[#141733] px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-amber-400 tracking-wide flex items-center gap-2">
              <span>🏛️</span> UNITED STATES FEDERAL GOVERNMENT & ELECTION SYSTEM
            </h1>
            <p className="text-xs text-gray-300 mt-1">
              Executive Elections, Legislative (Congress), SCOTUS, Treasury, Fed, FTC & Crime Control.
            </p>
          </div>
          <div className="text-right bg-amber-950/40 border border-amber-500/40 px-3 py-1.5 rounded">
            <div className="text-xs text-gray-400 uppercase tracking-wider">Incumbent President</div>
            <div className="text-sm font-bold text-yellow-300">{currentPresident.name} ({currentPresident.party})</div>
          </div>
        </div>

        {/* Quick Executive Stats Bar */}
        <div className="grid grid-cols-4 divide-x divide-gray-800 bg-[#0f1124] border-b border-gray-800 py-2.5 text-center text-xs">
          <div>
            <div className="text-gray-400">Federal Tax Rate</div>
            <div className="text-sm font-bold text-yellow-400">{gov.taxRate ?? currentPresident.taxRate ?? 10}%</div>
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
        <div className="flex flex-wrap border-b border-gray-800 bg-[#161836] text-xs font-bold">
          <button
            onClick={() => setActiveTab('elections')}
            className={`px-4 py-2.5 transition-colors ${
              activeTab === 'elections'
                ? 'bg-amber-500 text-black font-extrabold shadow-md'
                : 'text-gray-300 hover:text-white hover:bg-amber-500/20'
            }`}
          >
            🗳️ Presidential Elections
          </button>
          <button
            onClick={() => setActiveTab('fed')}
            className={`px-4 py-2.5 transition-colors ${
              activeTab === 'fed'
                ? 'bg-cyan-500 text-black font-extrabold shadow-md'
                : 'text-gray-300 hover:text-white hover:bg-cyan-500/20'
            }`}
          >
            🏦 Federal Reserve
          </button>
          <button
            onClick={() => setActiveTab('ftc')}
            className={`px-4 py-2.5 transition-colors ${
              activeTab === 'ftc'
                ? 'bg-indigo-500 text-white font-extrabold shadow-md'
                : 'text-gray-300 hover:text-white hover:bg-indigo-500/20'
            }`}
          >
            ⚖️ FTC Antitrust
          </button>
          <button
            onClick={() => setActiveTab('scotus')}
            className={`px-4 py-2.5 transition-colors ${
              activeTab === 'scotus'
                ? 'bg-purple-600 text-white font-extrabold shadow-md'
                : 'text-gray-300 hover:text-white hover:bg-purple-600/20'
            }`}
          >
            ⚖️ SCOTUS Court
          </button>
          <button
            onClick={() => setActiveTab('congress')}
            className={`px-4 py-2.5 transition-colors ${
              activeTab === 'congress'
                ? 'bg-blue-600 text-white font-extrabold shadow-md'
                : 'text-gray-300 hover:text-white hover:bg-blue-600/20'
            }`}
          >
            📜 US Congress
          </button>
          <button
            onClick={() => setActiveTab('treasury')}
            className={`px-4 py-2.5 transition-colors ${
              activeTab === 'treasury'
                ? 'bg-emerald-600 text-white font-extrabold shadow-md'
                : 'text-gray-300 hover:text-white hover:bg-emerald-600/20'
            }`}
          >
            💵 US Treasury
          </button>
          <button
            onClick={() => setActiveTab('agencies')}
            className={`px-4 py-2.5 transition-colors ${
              activeTab === 'agencies'
                ? 'bg-teal-600 text-white font-extrabold shadow-md'
                : 'text-gray-300 hover:text-white hover:bg-teal-600/20'
            }`}
          >
            📋 Federal Agencies
          </button>
          <button
            onClick={() => setActiveTab('crime')}
            className={`px-4 py-2.5 transition-colors ${
              activeTab === 'crime'
                ? 'bg-red-600 text-white font-extrabold shadow-md'
                : 'text-gray-300 hover:text-white hover:bg-red-600/20'
            }`}
          >
            🩸 7 Crime Syndicates
          </button>
        </div>

        {/* Alert Feedback Banner */}
        {feedbackMsg && (
          <div className="bg-amber-950/90 border-b border-amber-500 px-4 py-2 text-center text-xs font-bold text-amber-300">
            {feedbackMsg}
          </div>
        )}

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#0b0d1e]">
          {/* TAB: PRESIDENTIAL ELECTIONS */}
          {activeTab === 'elections' && (
            <div className="space-y-6">
              {/* Incumbent Commander In Chief Banner */}
              <div className="rounded-lg border border-amber-500/60 bg-gradient-to-r from-[#171a3d] to-[#0f1127] p-5 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <img
                      src={getCharacterPortrait(currentPresident.id, currentPresident.name, 'Pres')}
                      alt={currentPresident.name}
                      className="h-16 w-16 rounded-md border-2 border-amber-400 object-cover shadow-md"
                    />
                    <div>
                      <span className="text-xs font-extrabold text-amber-400 uppercase tracking-widest">
                        Incumbent President of the United States
                      </span>
                      <h2 className="text-2xl font-bold text-yellow-300">{currentPresident.name}</h2>
                      <p className="text-xs text-gray-300 mt-1">
                        Party: <span className="text-amber-300 font-semibold">{currentPresident.party}</span> • Federal Tax Rate: <span className="text-emerald-400 font-bold">{currentPresident.taxRate}%</span>
                      </p>
                      <p className="text-xs text-gray-400 italic mt-0.5">"{currentPresident.platform}"</p>
                    </div>
                  </div>
                  <div className="text-right space-y-2">
                    <div className="text-xs text-gray-300">
                      Days Until Election: <span className="text-yellow-400 font-bold text-base">{gov.daysUntilElection ?? 10} Days</span>
                    </div>
                    <button
                      onClick={handleTriggerElection}
                      className="border-2 border-amber-400 bg-amber-500/20 px-4 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500 hover:text-black transition-all rounded"
                    >
                      📢 Call Snap Presidential Election
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Election Candidates Ballot */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                    <span>🗳️</span> Presidential Candidate Ballot & Tax Platforms
                  </h3>
                  {gov.electionActive && (
                    <span className="animate-pulse text-xs font-bold bg-amber-500 text-black px-2.5 py-0.5 rounded">
                      ELECTION IN PROGRESS — VOTE NOW!
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {activeCandidates.map((candidate) => {
                    const isWinner = gov.lastElectionWinner === candidate.name
                    const isPlayerVoted = gov.playerVote === candidate.id
                    const voteCount = gov.lastElectionTally ? gov.lastElectionTally[candidate.id] : null

                    return (
                      <div
                        key={candidate.id}
                        className={`rounded-lg border p-4 flex flex-col justify-between transition-all ${
                          isPlayerVoted
                            ? 'border-amber-400 bg-[#241e3a] shadow-lg shadow-amber-500/20 ring-2 ring-amber-400'
                            : 'border-amber-500/30 bg-[#141733] hover:border-amber-500/70'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-3 border-b border-gray-700/60 pb-3">
                            <img
                              src={getCharacterPortrait(candidate.id, candidate.name, 'Pres')}
                              alt={candidate.name}
                              className="h-14 w-14 rounded border border-amber-400/70 object-cover"
                            />
                            <div>
                              <h4 className="font-bold text-yellow-300 text-base">{candidate.name}</h4>
                              <p className="text-xs text-gray-300">{candidate.party}</p>
                              <span className="inline-block mt-1 text-xs font-bold bg-emerald-950 border border-emerald-500/40 text-emerald-400 px-2 py-0.5 rounded">
                                Tax Rate: {candidate.taxRate}%
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 space-y-2 text-xs">
                            <div>
                              <span className="text-gray-400 font-semibold">Platform:</span>
                              <p className="text-gray-200 italic mt-0.5">"{candidate.platform}"</p>
                            </div>
                            <div>
                              <span className="text-gray-400 font-semibold">Economic Policy:</span>
                              <p className="text-gray-300 mt-0.5">{candidate.description || 'Promotes economic expansion and regulatory balance.'}</p>
                            </div>
                            {voteCount !== null && (
                              <div className="mt-2 text-xs text-amber-300 font-bold bg-black/40 px-2 py-1 rounded">
                                Vote Tally: {voteCount} Votes
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-gray-700/60">
                          {isPlayerVoted ? (
                            <div className="text-center py-1.5 text-xs font-bold text-amber-300 bg-amber-500/20 border border-amber-400 rounded">
                              ✓ Your Cast Ballot
                            </div>
                          ) : (
                            <button
                              onClick={() => handleVote(candidate.id)}
                              className="w-full border-2 border-amber-400 bg-amber-500/20 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500 hover:text-black transition-all rounded"
                            >
                              Vote for {candidate.name}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Presidential Election Logs & History */}
              <div className="rounded-lg border border-gray-800 bg-[#101229] p-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  📜 Federal Government & Election Event Feed
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-2 text-xs">
                  {(gov.governmentFeed || []).map((feedItem, idx) => (
                    <div key={feedItem.id || idx} className="rounded border border-gray-800 bg-[#161838] p-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                        <span>{feedItem.title}</span>
                        <span className="text-gray-500">Day {feedItem.day || 1}</span>
                      </div>
                      <p className="text-gray-300 mt-1 text-xs">{feedItem.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: FEDERAL RESERVE */}
          {activeTab === 'fed' && (
            <div className="space-y-6">
              <div className="rounded-lg border border-cyan-500/50 bg-[#121938] p-5 shadow-lg">
                <div className="flex items-center justify-between border-b border-gray-700 pb-3">
                  <div className="flex items-center gap-4">
                    <img
                      src={getCharacterPortrait(currentFed.id, currentFed.name, 'Fed')}
                      alt={currentFed.name}
                      className="h-16 w-16 rounded border-2 border-cyan-400 object-cover"
                    />
                    <div>
                      <span className="text-xs font-extrabold text-cyan-400 uppercase tracking-widest">
                        Federal Reserve Chairman
                      </span>
                      <h2 className="text-2xl font-bold text-cyan-300">{currentFed.name}</h2>
                      <p className="text-xs text-gray-300 mt-1">
                        Policy Stance: <span className="text-yellow-300 font-bold">{currentFed.stance || 'Hawkish/Dovish'}</span> • Target Benchmark Rate: <span className="text-cyan-400 font-bold">{currentFed.targetRate || 5.0}%</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">Current Interest Rate</div>
                    <div className="text-2xl font-bold text-cyan-300">{gov.interestRate || 5.0}%</div>
                  </div>
                </div>
                <p className="text-xs text-gray-300 mt-3 italic">
                  "{currentFed.description || 'The Fed sets monetary policy, impacting loan interest, market liquidity, and asset values.'}"
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  🏦 Federal Reserve Chairmen Roster
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {FED_CHAIRMEN_ROSTER.map((f) => (
                    <div key={f.id} className="rounded border border-cyan-500/30 bg-[#141b3a] p-3 text-xs">
                      <div className="font-bold text-cyan-300">{f.name}</div>
                      <div className="text-gray-400 text-xs mt-1">Target Rate: {f.targetRate}%</div>
                      <div className="text-gray-300 text-xs mt-1 italic">{f.stance}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: FTC ANTITRUST */}
          {activeTab === 'ftc' && (
            <div className="space-y-6">
              <div className="rounded-lg border border-indigo-500/50 bg-[#171638] p-5 shadow-lg">
                <div className="flex items-center gap-4 border-b border-gray-700 pb-3">
                  <img
                    src={getCharacterPortrait(currentFtc.id, currentFtc.name, 'FTC')}
                    alt={currentFtc.name}
                    className="h-16 w-16 rounded border-2 border-indigo-400 object-cover"
                  />
                  <div>
                    <span className="text-xs font-extrabold text-indigo-400 uppercase tracking-widest">
                      Federal Trade Commission (FTC) Chairman
                    </span>
                    <h2 className="text-2xl font-bold text-indigo-300">{currentFtc.name}</h2>
                    <p className="text-xs text-gray-300 mt-1">
                      Aggressiveness: <span className="text-red-400 font-bold">{currentFtc.aggressiveness || 'High'}</span>
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-300 mt-3 italic">
                  "{currentFtc.description || 'The FTC investigates monopoly cartels, issuing hefty compliance fines on billionaire titans.'}"
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  ⚖️ FTC Chairmen Roster
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {FTC_CHAIRMEN_ROSTER.map((f) => (
                    <div key={f.id} className="rounded border border-indigo-500/30 bg-[#17183d] p-3 text-xs">
                      <div className="font-bold text-indigo-300">{f.name}</div>
                      <div className="text-gray-300 text-xs mt-1">{f.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: SCOTUS JUDICIAL REVIEW */}
          {activeTab === 'scotus' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                <span>⚖️</span> Supreme Court of the United States (SCOTUS) — 9 Justices
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {SCOTUS_JUSTICES.map((j) => (
                  <div key={j.id} className="rounded-lg border border-purple-500/40 bg-[#16122b] p-3.5 text-xs shadow">
                    <div className="font-bold text-purple-300 text-sm">{j.name}</div>
                    <div className="text-gray-400 text-xs mt-1 font-semibold">{j.title}</div>
                    <div className="text-gray-300 text-xs mt-1.5 italic">"{j.philosophy || 'Constitutional Judicial Review'}"</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: US CONGRESS */}
          {activeTab === 'congress' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                <span>📜</span> Legislative Branch — US Congress (Senate & House Leaders)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CONGRESS_LEADERS.map((c) => (
                  <div key={c.id} className="rounded-lg border border-blue-500/40 bg-[#121931] p-3.5 text-xs shadow">
                    <div className="font-bold text-blue-300 text-sm">{c.name}</div>
                    <div className="text-gray-400 text-xs mt-1 font-semibold">{c.title}</div>
                    <div className="text-gray-300 text-xs mt-1.5">{c.role || 'Coordinates national tax & spending legislation.'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: US TREASURY & BONDS */}
          {activeTab === 'treasury' && (
            <div className="space-y-6">
              <div className="rounded-lg border border-emerald-500/50 bg-[#10241b] p-5 shadow-lg">
                <h3 className="text-sm font-bold text-emerald-300 uppercase tracking-wider mb-1">
                  💵 US Treasury Department & Bond Investment Desk
                </h3>
                <p className="text-xs text-gray-300 italic">
                  Invest in guaranteed US 10-Year Treasury Bonds yielding <span className="text-emerald-400 font-bold">{treasury.bondRate}%</span> safe annual interest.
                </p>
                <div className="mt-4 flex gap-3 items-center">
                  <input
                    type="number"
                    value={bondAmountInput}
                    onChange={(e) => setBondAmountInput(e.target.value)}
                    className="rounded border border-emerald-500 bg-black/60 px-3 py-1.5 text-xs text-white w-44 font-mono"
                    placeholder="Bond Amount $"
                  />
                  <button
                    onClick={handleBuyBonds}
                    className="border-2 border-emerald-400 bg-emerald-500/20 px-5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500 hover:text-black transition-all rounded"
                  >
                    Purchase Treasury Bonds
                  </button>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  📜 Treasury Secretaries Directory
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {TREASURY_SECRETARIES.map((t) => (
                    <div key={t.id} className="rounded border border-emerald-500/30 bg-[#121f1c] p-3 text-xs">
                      <div className="font-bold text-emerald-300">{t.name}</div>
                      <div className="text-gray-300 text-xs mt-1">{t.title}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: FEDERAL AGENCIES */}
          {activeTab === 'agencies' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(FAMOUS_AGENCY_LEADERS).flatMap(([agencyKey, leaders]) =>
                  leaders.map((leader) => (
                    <div key={leader.id} className="rounded-lg border border-teal-500/40 bg-[#111f26] p-4 shadow-md">
                      <div className="flex items-start gap-3 border-b border-teal-800/60 pb-3">
                        <img
                          src={getCharacterPortrait(leader.id, leader.name, agencyKey)}
                          alt={leader.name}
                          className="h-12 w-12 rounded border border-teal-400 object-cover"
                        />
                        <div>
                          <h4 className="font-bold text-teal-300 text-base">{leader.name}</h4>
                          <div className="text-xs text-yellow-300 font-semibold">{leader.title}</div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-300 mt-2">{leader.description || 'Oversees federal law enforcement & regulatory oversight.'}</p>
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
                  <div key={syn.id} className="rounded-lg border border-red-500/50 bg-[#1d121c] p-4 shadow-md">
                    <div className="flex items-start justify-between border-b border-red-900/50 pb-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={getCharacterPortrait(syn.boss.id, syn.boss.name, 'Crime')}
                          alt={syn.boss.name}
                          className="h-12 w-12 rounded border border-red-500 object-cover"
                        />
                        <div>
                          <h4 className="font-bold text-red-400 text-base">{syn.name}</h4>
                          <p className="text-xs text-gray-300">
                            Boss: <span className="text-yellow-300 font-bold">{syn.boss.name}</span>
                          </p>
                          <p className="text-xs text-gray-400">Territory: {syn.territory}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-gray-400">Daily Revenue: <strong className="text-emerald-400">${(syn.dailyRevenue || syn.dailyToll || 5000).toLocaleString()}</strong></span>
                      <span className="text-gray-400">Heat Level: <strong className="text-orange-400">{'★'.repeat(syn.heatLevel || 1)}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!embedded && (
          <div className="border-t border-gray-800 bg-[#101229] p-4 flex items-center justify-between">
            <div className="text-xs text-gray-400">
              Capital Syndicate Elections & Federal Oversight Panel
            </div>
            <button
              onClick={onClose}
              className="border-2 border-amber-500/60 bg-amber-500/20 px-6 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500 hover:text-black transition-colors rounded"
            >
              Close Government Modal
            </button>
          </div>
        )}
    </>
  )

  // Embedded mode drops the fixed h-[90vh] overlay panel entirely - the
  // wrapping GovernmentBuildingModal tab already gives this its own
  // scrollable area, same reasoning as InteractiveLocationModal's embedded
  // branch.
  if (embedded) return <div className="text-white max-h-[70vh] overflow-y-auto">{body}</div>

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 font-mono text-white">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col border-4 border-amber-500/80 bg-[#0b0d1e] shadow-2xl rounded-lg overflow-hidden">
        {body}
      </div>
    </div>
  )
}
