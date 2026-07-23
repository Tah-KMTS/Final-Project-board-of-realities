/**
 * Agency Subdepartments & Autonomous Staff Task Engine.
 */

export const AGENCY_SUBDEPARTMENTS = [
  {
    agencyId: 'irs',
    name: 'IRS Criminal Investigation Division (CID)',
    lead: 'CID Special Agent-in-Charge',
    task: 'Syndicate Money Laundering & Offshore Account Subpoenas',
    description: 'Investigates illicit cash flows from Underground speakeasy operations and shell companies.',
  },
  {
    agencyId: 'irs',
    name: 'Global High Wealth Industry Group',
    lead: 'High Net-Worth Audit Examiner',
    task: 'Billionaire Tax Return & Dividend Audits',
    description: 'Audits personal dividend payouts of financial titans (Rockefeller, Carnegie, Rusk).',
  },
  {
    agencyId: 'sec',
    name: 'SEC Division of Enforcement',
    lead: 'Chief Enforcement Counsel',
    task: 'Insider Trading Subpoenas & Asset Freezes',
    description: 'Monitors suspicious stock pool spikes and issues asset freeze orders against hedge funds.',
  },
  {
    agencyId: 'sec',
    name: 'Division of Corporation Finance',
    lead: 'Corporation Finance Analyst',
    task: 'SEC 10-K Filing & Board Audit Oversight',
    description: 'Verifies corporate financial statements before public stock listings.',
  },
  {
    agencyId: 'fbi',
    name: 'Organized Crime & Financial Crimes Section',
    lead: 'Special Agent-in-Charge',
    task: 'RICO Indictments & Syndicate Wiretaps',
    description: 'Monitors Al Capone and Lucky Luciano turf operations, executing federal wiretaps.',
  },
  {
    agencyId: 'fbi',
    name: 'FBI Cyber Crime Division',
    lead: 'Cyber Crime Chief',
    task: 'Crypto Exchange Fraud & Scam Investigations',
    description: 'Tracks decentralized crypto exchange pumps and illicit wallet transfers.',
  },
  {
    agencyId: 'dod',
    name: 'DARPA (Defense Advanced Research Projects Agency)',
    lead: 'DARPA Program Director',
    task: 'Cutting-Edge Military Technology Grants',
    description: 'Grants R&D capital to innovation pioneers (Steve Jobs, Elan Rusk, Jensen Fang).',
  },
  {
    agencyId: 'dod',
    name: 'DCAA (Defense Contract Audit Agency)',
    lead: 'DCAA Lead Auditor',
    task: 'Manufacturing Procurement Audits',
    description: 'Audits heavy industrial assembly plants (Henry Ford) for defense procurement.',
  },
  {
    agencyId: 'epa',
    name: 'OECA (Office of Enforcement and Compliance Assurance)',
    lead: 'OECA Enforcement Chief',
    task: 'Industrial Refinery Pollution Citations',
    description: 'Issues environmental compliance citations against steel mills and oil refineries.',
  },
]

export function simulateSubdepartmentsTick(day) {
  const subLogs = []
  if (Math.random() < 0.4) {
    const sub = AGENCY_SUBDEPARTMENTS[Math.floor(Math.random() * AGENCY_SUBDEPARTMENTS.length)]
    subLogs.push({
      id: `sub_log_${day}_${Date.now()}`,
      day,
      agencyId: sub.agencyId,
      department: sub.name,
      title: `⚙️ ${sub.name} Action`,
      text: `${sub.lead} executed routine operation: "${sub.task}".`,
    })
  }
  return subLogs
}
