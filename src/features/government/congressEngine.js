export const CONGRESS_LEADERS = [
  { id: 'clay', name: 'Henry Clay', title: 'Speaker of the House (The Great Compromiser)' },
  { id: 'webster', name: 'Daniel Webster', title: 'Senate Financial System Defender' },
  { id: 'rayburn', name: 'Sam Rayburn', title: 'Longest-Serving Speaker of the House' },
  { id: 'lbj_senate', name: 'Lyndon B. Johnson', title: 'Senate Majority Leader' },
  { id: 'taft', name: 'Robert A. Taft', title: 'Senate Leader (Mr. Republican)' },
]

export function simulateCongressTick(day) {
  const congressLogs = []
  if (Math.random() < 0.3) {
    const leader = CONGRESS_LEADERS[Math.floor(Math.random() * CONGRESS_LEADERS.length)]
    congressLogs.push({
      id: `congress_${day}_${Date.now()}`,
      day,
      title: '📜 US Congress Legislative Hearing',
      text: `${leader.title} ${leader.name} convened Congressional hearings, voting to confirm Federal Reserve and FTC nominees.`,
    })
  }
  return congressLogs
}
