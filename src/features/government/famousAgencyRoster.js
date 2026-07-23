// Famous Real-World Agency Leaders & Departmental Staff with Statutory Appointment Terms

export const FAMOUS_AGENCY_LEADERS = {
  sec: [
    {
      id: 'kennedy_sec',
      name: 'Joseph P. Kennedy Sr.',
      title: '1st SEC Chairman (Appointed by FDR)',
      statutoryTermYears: 5,
      termType: '5-Year Staggered Statutory Term',
      background: 'Legendary Wall Street financier turned inaugural regulator. Tamed stock pools.',
      staff: [
        { id: 'sec_staff_1', name: 'Chief Enforcement Counsel', role: 'Division of Enforcement Director' },
        { id: 'sec_staff_2', name: 'Corporation Finance Analyst', role: 'SEC 10-K Compliance Officer' },
      ],
    },
    {
      id: 'douglas_sec',
      name: 'William O. Douglas',
      title: '2nd SEC Chairman & Supreme Court Justice',
      statutoryTermYears: 5,
      termType: '5-Year Staggered Statutory Term',
      background: 'Reformed stock exchanges and eliminated unlisted trading abuses.',
      staff: [{ id: 'sec_staff_3', name: 'Market Oversight Director', role: 'Exchange Audit Chief' }],
    },
    {
      id: 'levitt_sec',
      name: 'Arthur Levitt',
      title: 'Longest-Serving SEC Chairman',
      statutoryTermYears: 5,
      termType: '5-Year Staggered Statutory Term',
      background: 'Championed individual investor protection and corporate transparency.',
      staff: [{ id: 'sec_staff_4', name: 'Auditor Independence Officer', role: 'Accounting Compliance' }],
    },
  ],

  fbi: [
    {
      id: 'hoover',
      name: 'J. Edgar Hoover',
      title: '1st Director of the FBI',
      statutoryTermYears: 10,
      termType: '10-Year Fixed Statutory Term',
      background: 'Built the modern FBI, pioneering fingerprinting, forensic labs, and organized crime wiretaps.',
      staff: [
        { id: 'fbi_staff_1', name: 'Mark Felt ("Deep Throat")', role: 'Associate FBI Director' },
        { id: 'fbi_staff_2', name: 'Special Agent-in-Charge', role: 'Organized Crime Strike Force Chief' },
      ],
    },
    {
      id: 'mueller',
      name: 'Robert Mueller',
      title: 'Modern FBI Director',
      statutoryTermYears: 10,
      termType: '10-Year Fixed Statutory Term',
      background: 'Transformed the Bureau into an intelligence-driven financial crimes & counterterrorism agency.',
      staff: [{ id: 'fbi_staff_3', name: 'Cyber Crime Chief', role: 'Digital Forensics Unit' }],
    },
  ],

  irs: [
    {
      id: 'caplin',
      name: 'Mortimer Caplin',
      title: 'Kennedy IRS Commissioner',
      statutoryTermYears: 5,
      termType: '5-Year Fixed Statutory Term',
      background: 'Introduced computerized taxpayer data processing and high-income audits.',
      staff: [
        { id: 'irs_staff_1', name: 'CID Special Agent', role: 'Criminal Investigation Division Chief' },
        { id: 'irs_staff_2', name: 'High Wealth Audit Examiner', role: 'Billionaire Tax Audit Lead' },
      ],
    },
    {
      id: 'andrews',
      name: 'T. Coleman Andrews',
      title: 'Pioneer IRS Commissioner',
      statutoryTermYears: 5,
      termType: '5-Year Fixed Statutory Term',
      background: 'Restructured federal internal revenue collection into modern regional audit districts.',
      staff: [{ id: 'irs_staff_3', name: 'Tax Fraud Examiner', role: 'Offshore Wealth Audits' }],
    },
  ],

  dod: [
    {
      id: 'mcnamara',
      name: 'Robert McNamara',
      title: 'Secretary of Defense & Ford President',
      statutoryTermYears: 4,
      termType: 'Presidential Pleasure Appointment',
      background: 'Applied Systems Analysis to military defense logistics and contract procurement.',
      staff: [
        { id: 'dod_staff_1', name: 'DARPA Program Director', role: 'Advanced Tech Research Chief' },
        { id: 'dod_staff_2', name: 'DCAA Lead Auditor', role: 'Defense Contract Audit Agency Chief' },
      ],
    },
    {
      id: 'marshall',
      name: 'General George C. Marshall',
      title: 'Army Chief of Staff & Secretary of Defense',
      statutoryTermYears: 4,
      termType: 'Presidential Pleasure Appointment',
      background: 'Organized the industrial victory effort and Marshall Plan economic reconstruction.',
      staff: [{ id: 'dod_staff_3', name: 'Logistics Quartermaster', role: 'Procurement Supply Lead' }],
    },
  ],

  epa: [
    {
      id: 'ruckelshaus',
      name: 'William Ruckelshaus',
      title: '1st EPA Administrator',
      statutoryTermYears: 4,
      termType: 'Presidential Pleasure Appointment',
      background: 'Established federal clean air and water standards, enforcing citations against industrial refiners.',
      staff: [
        { id: 'epa_staff_1', name: 'OECA Enforcement Chief', role: 'Office of Compliance Assurance' },
        { id: 'epa_staff_2', name: 'Clean Air Inspector', role: 'Industrial Refinery Pollution Inspector' },
      ],
    },
  ],
}
