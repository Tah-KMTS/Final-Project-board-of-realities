import { FINANCE_NPCS } from '../finance/financeNpcs'

export const EXPANDED_AGENCIES = [
  {
    id: 'irs',
    name: 'IRS (Internal Revenue Service)',
    head: 'Commissioner Charles Rettig',
    task: 'Tax Audits, Asset Confiscation & Wealth Audits',
    color: '#eab308',
    description: 'Audits ultra-high net worth players & titans for tax evasion, levying 15% back-tax penalties.',
  },
  {
    id: 'sec',
    name: 'SEC (Securities & Exchange Commission)',
    head: 'Chairman Gary Gensler',
    task: 'Insider Trading Enforcement & Market Halts',
    color: '#06b6d4',
    description: 'Monitors suspicious stock pool pumps, freezes illegal insider trading assets, and halts volatility.',
  },
  {
    id: 'fbi',
    name: 'FBI & Department of Justice',
    head: 'Director J. Edgar Hoover',
    task: 'Organized Crime Wiretaps & RICO Prosecutions',
    color: '#ef4444',
    description: 'Conducts federal wiretaps on 7 Crime Syndicates, executing RICO indictments and SWAT raids.',
  },
  {
    id: 'dod',
    name: 'DOD (Department of Defense / Pentagon)',
    head: 'Secretary of Defense',
    task: 'Military Procurement Contracts & Tech Grants',
    color: '#3b82f6',
    description: 'Grants multi-billion dollar military defense contracts to tech and industrial companies.',
  },
  {
    id: 'epa',
    name: 'EPA (Environmental Protection Agency)',
    head: 'Administrator Michael Regan',
    task: 'Industrial Pollution Inspections & Fines',
    color: '#22c55e',
    description: 'Inspects Rockefeller Oil & Carnegie Steel factories, issuing environmental compliance fines.',
  },
]

/**
 * Simulates daily operations for all 5 expanded agencies.
 */
export function simulateExpandedAgenciesTick(day, cash, wantedLevel) {
  const agencyLogs = []
  let cashPenalty = 0
  let wantedChange = 0

  // 1. IRS Tax Audit Check
  if (Math.random() < 0.25) {
    const auditPenalty = Math.round(1000 + Math.random() * 5000)
    agencyLogs.push({
      id: `irs_audit_${day}`,
      agency: 'IRS',
      title: '📋 IRS Tax Audit Issued',
      text: `The IRS conducted a surprise wealth audit on high-bracket investors, levying $${auditPenalty.toLocaleString()} in compliance fees.`,
    })
  }

  // 2. SEC Insider Trading Watchdog
  if (Math.random() < 0.3) {
    const target = FINANCE_NPCS[Math.floor(Math.random() * FINANCE_NPCS.length)]
    agencyLogs.push({
      id: `sec_raid_${day}`,
      agency: 'SEC',
      title: '🔍 SEC Insider Trading Raid',
      text: `SEC Enforcement Division issued a formal subpoena against ${target.name}'s hedge fund for suspicious market pools.`,
    })
  }

  // 3. FBI / RICO Wiretap
  if (wantedLevel >= 3 || Math.random() < 0.2) {
    wantedChange -= 1
    agencyLogs.push({
      id: `fbi_rico_${day}`,
      agency: 'FBI',
      title: '🚔 FBI Organized Crime Strike Force',
      text: 'FBI agents executed federal search warrants on Underground speakeasy venues, suppressing syndicate heat.',
    })
  }

  // 4. DOD Defense Procurement Contract
  if (Math.random() < 0.25) {
    agencyLogs.push({
      id: `dod_grant_${day}`,
      agency: 'DOD',
      title: '🎖️ Pentagon Defense Procurement Contract',
      text: 'Department of Defense awarded a $2.5B defense technology development grant to industrial contractors.',
    })
  }

  // 5. EPA Environmental Inspection
  if (Math.random() < 0.25) {
    agencyLogs.push({
      id: `epa_fine_${day}`,
      agency: 'EPA',
      title: '🌿 EPA Environmental Compliance Penalty',
      text: 'EPA inspectors issued clean-air compliance citations against heavy industrial refinery plants.',
    })
  }

  return {
    agencyLogs,
    cashPenalty,
    wantedChange,
  }
}
