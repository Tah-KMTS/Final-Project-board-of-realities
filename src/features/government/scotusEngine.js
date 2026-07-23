export const SCOTUS_JUSTICES = [
  { id: 'marshall_scotus', name: 'John Marshall', title: 'Chief Justice (Established Judicial Review)' },
  { id: 'warren_scotus', name: 'Earl Warren', title: 'Chief Justice (Progressive Rights)' },
  { id: 'brandeis_scotus', name: 'Louis Brandeis', title: 'Associate Justice (Anti-Monopoly Pioneer)' },
  { id: 'holmes_scotus', name: 'Oliver Wendell Holmes Jr.', title: 'Associate Justice (The Great Dissenter)' },
  { id: 'frankfurter_scotus', name: 'Felix Frankfurter', title: 'Associate Justice (Judicial Restraint)' },
  { id: 'marshall_t_scotus', name: 'Thurgood Marshall', title: 'Associate Justice (Civil Rights Icon)' },
  { id: 'rgb_scotus', name: 'Ruth Bader Ginsburg', title: 'Associate Justice (Equal Rights)' },
  { id: 'oconnor_scotus', name: 'Sandra Day O\'Connor', title: 'Associate Justice (1st Female Justice)' },
  { id: 'scalia_scotus', name: 'Antonin Scalia', title: 'Associate Justice (Originalist Jurisprudence)' },
]

export function simulateScotusJudicialReview(day) {
  const scotusLogs = []
  if (Math.random() < 0.25) {
    const justice = SCOTUS_JUSTICES[Math.floor(Math.random() * SCOTUS_JUSTICES.length)]
    scotusLogs.push({
      id: `scotus_${day}_${Date.now()}`,
      day,
      title: '⚖️ Supreme Court (SCOTUS) Judicial Review',
      text: `Justice ${justice.name} authored a landmark 5-4 ruling: Auditing FTC regulatory authority and upholding constitutional market protection.`,
    })
  }
  return scotusLogs
}
