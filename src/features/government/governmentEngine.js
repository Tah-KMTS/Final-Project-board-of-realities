import { PRESIDENTS_ROSTER, FED_CHAIRMEN_ROSTER, FTC_CHAIRMEN_ROSTER } from './governmentRoster'
import { CRIME_SYNDICATES } from './crimeSyndicates'
import { FINANCE_NPCS } from '../finance/financeNpcs'

/**
 * Initializes Government, Federal Reserve, FTC, and Crime Syndicates state.
 */
export function initializeGovernmentState() {
  const currentPresident = PRESIDENTS_ROSTER[0] // George Washington
  const currentFed = FED_CHAIRMEN_ROSTER[4] // Jerome Powell
  const currentFtc = FTC_CHAIRMEN_ROSTER[0] // Lina Khan

  return {
    president: currentPresident,
    fedChairman: currentFed,
    ftcChairman: currentFtc,
    interestRate: 5.0,
    inflationRate: 2.5,
    taxRate: currentPresident.taxRate || 10,
    electionCycleDay: 1,
    daysUntilElection: 10,
    electionActive: false,
    activeCandidates: [PRESIDENTS_ROSTER[0], PRESIDENTS_ROSTER[1], PRESIDENTS_ROSTER[2]],
    playerVote: null,
    lastElectionWinner: currentPresident.name,
    governmentFeed: [
      { id: 'gov_init_1', day: 1, title: 'Government System Initialized', text: `${currentPresident.name} is President. ${currentFed.name} chairs the Federal Reserve. ${currentFtc.name} leads the FTC.` }
    ],
    ftcInvestigations: [],
    crimeSyndicatesState: CRIME_SYNDICATES.map((syndicate) => ({
      ...syndicate,
      heatLevel: Math.floor(Math.random() * 3),
      dailyRevenue: syndicate.dailyToll,
      status: 'Active',
    })),
  }
}

/**
 * Simulates daily government, monetary policy, FTC antitrust, and crime syndicate actions.
 */
export function simulateGovernmentDailyTick(currentGovState, day, cash, wantedLevel, portfolio, stocks) {
  const gov = { ...currentGovState }
  const feed = [...(gov.governmentFeed || [])]
  let cashDelta = 0
  let wantedDelta = 0
  let cryptoHypeDelta = 0

  // 1. Election Cycle Progress
  gov.daysUntilElection = Math.max(0, 10 - (day % 10))
  if (day % 10 === 0 && day > 0) {
    // Trigger Presidential Election
    gov.electionActive = true
    // Pick 3 candidates for ballot
    const shuffled = [...PRESIDENTS_ROSTER].sort(() => Math.random() - 0.5)
    gov.activeCandidates = shuffled.slice(0, 3)
  }

  // 2. Federal Reserve Monetary Policy Tick
  const fed = gov.fedChairman || FED_CHAIRMEN_ROSTER[0]
  if (fed) {
    if (gov.interestRate < fed.targetRate) {
      gov.interestRate = parseFloat((gov.interestRate + 0.25).toFixed(2))
      if (gov.inflationRate > 1.5) gov.inflationRate = parseFloat((gov.inflationRate - 0.15).toFixed(2))
      if (Math.random() < 0.3) {
        feed.unshift({
          id: `fed_hike_${day}`,
          day,
          title: '🏦 Federal Reserve Rate Hike',
          text: `${fed.name} raised the benchmark interest rate to ${gov.interestRate}%. Loan costs rise, cooling stock inflation.`,
        })
      }
    } else if (gov.interestRate > fed.targetRate) {
      gov.interestRate = parseFloat((gov.interestRate - 0.25).toFixed(2))
      gov.inflationRate = parseFloat((gov.inflationRate + 0.2).toFixed(2))
      cryptoHypeDelta += 3
      if (Math.random() < 0.3) {
        feed.unshift({
          id: `fed_cut_${day}`,
          day,
          title: '🏦 Federal Reserve Interest Rate Cut',
          text: `${fed.name} slashed interest rates to ${gov.interestRate}%. Liquidity surges into stocks and crypto markets!`,
        })
      }
    }
  }

  // 3. FTC Antitrust Enforcement Tick
  const ftc = gov.ftcChairman || FTC_CHAIRMEN_ROSTER[0]
  if (ftc && Math.random() < 0.35) {
    // Pick a major monopolist titan to investigate
    const monopolists = FINANCE_NPCS.filter((n) => n.netWorth > 10000000000)
    const targetTitan = monopolists[Math.floor(Math.random() * monopolists.length)]
    
    if (targetTitan) {
      const fineAmount = Math.round(5000 + Math.random() * 20000)
      feed.unshift({
        id: `ftc_investigation_${day}`,
        day,
        title: '⚖️ FTC Antitrust Investigation Launched',
        text: `${ftc.name} launched a formal FTC antitrust investigation against ${targetTitan.name} ("${targetTitan.title}"), issuing $${fineAmount.toLocaleString()} in regulatory compliance penalties.`,
      })
    }
  }

  // 4. Crime Syndicate Daily Activity
  if (gov.crimeSyndicatesState) {
    const activeSyndicate = gov.crimeSyndicatesState[Math.floor(Math.random() * gov.crimeSyndicatesState.length)]
    if (activeSyndicate && Math.random() < 0.4) {
      feed.unshift({
        id: `crime_event_${day}`,
        day,
        title: `🩸 ${activeSyndicate.name} Racket Operation`,
        text: `${activeSyndicate.boss.name} expanded turf in ${activeSyndicate.territory}, extracting $${activeSyndicate.dailyRevenue.toLocaleString()} in syndicate tolls.`,
      })
    }
  }

  // Cap feed size
  gov.governmentFeed = feed.slice(0, 30)

  return {
    updatedGovState: gov,
    cashDelta,
    wantedDelta,
    cryptoHypeDelta,
  }
}

/**
 * Conducts the Democratic Election vote tally across all NPC agents and the player.
 */
export function resolvePresidentialElection(govState, playerCandidateChoice) {
  const candidates = govState.activeCandidates || PRESIDENTS_ROSTER.slice(0, 3)
  const voteTally = {}
  candidates.forEach((c) => (voteTally[c.id] = 0))

  // 1. Player Vote
  if (playerCandidateChoice && voteTally[playerCandidateChoice] !== undefined) {
    voteTally[playerCandidateChoice] += 15 // Player vote has heavy weight!
  }

  // 2. All 25 Financial Titans Vote based on Tax Platforms
  FINANCE_NPCS.forEach((npc) => {
    // Wealthy titans prefer lower tax rates (Reagan, Jefferson)
    const preferredCandidate = candidates.reduce((best, c) => (c.taxRate < best.taxRate ? c : best), candidates[0])
    voteTally[preferredCandidate.id] += 2
  })

  // 3. General Public / Ambient NPCs Vote
  for (let i = 0; i < 50; i++) {
    const randomPick = candidates[Math.floor(Math.random() * candidates.length)]
    voteTally[randomPick.id] += 1
  }

  // Determine Winner
  let winner = candidates[0]
  let maxVotes = -1
  candidates.forEach((c) => {
    if (voteTally[c.id] > maxVotes) {
      maxVotes = voteTally[c.id]
      winner = c
    }
  })

  // Winner appoints new Fed Chairman & FTC Chairman
  const newFed = FED_CHAIRMEN_ROSTER[Math.floor(Math.random() * FED_CHAIRMEN_ROSTER.length)]
  const newFtc = FTC_CHAIRMEN_ROSTER[Math.floor(Math.random() * FTC_CHAIRMEN_ROSTER.length)]

  const electionResultFeed = {
    id: `election_res_${Date.now()}`,
    day: govState.electionCycleDay,
    title: '🗳️ PRESIDENTIAL ELECTION RESULTS ANNOUNCED',
    text: `${winner.name} won the Presidential Election with ${maxVotes} votes! President ${winner.name} appointed ${newFed.name} as Federal Reserve Chairman and ${newFtc.name} as FTC Chairman. Tax rate set to ${winner.taxRate}%.`,
  }

  return {
    ...govState,
    president: winner,
    fedChairman: newFed,
    ftcChairman: newFtc,
    taxRate: winner.taxRate,
    electionActive: false,
    playerVote: null,
    lastElectionWinner: winner.name,
    governmentFeed: [electionResultFeed, ...(govState.governmentFeed || [])].slice(0, 30),
  }
}
