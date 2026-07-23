/**
 * Inter-Agent Butterfly Effect Chain Reaction Engine.
 * Calculates multi-agent ripple effects across all 76 characters.
 */

export function triggerButterflyEffect(triggerEvent, agents, day) {
  const butterflyLogs = []

  const updatedAgents = agents.map((agent) => {
    const copy = { ...agent }

    // 1. Fed Interest Rate Hike Ripple Effect
    if (triggerEvent.type === 'FED_RATE_HIKE') {
      if (copy.id === 'rockefeller' || copy.id === 'carnegie') {
        copy.thoughtProcess = 'Rate hike increases borrowing costs; scaling down factory expansion.'
        butterflyLogs.push({
          id: `butterfly_${day}_${copy.id}`,
          day,
          text: `🦋 Fed Rate Hike Butterfly Effect: ${copy.name} slowed factory expansion in Sapporo.`,
        })
      }
      if (copy.id === 'musk') {
        copy.thoughtProcess = 'Tech growth stocks cooling down; pivoting capital into automated robot R&D.'
      }
    }

    // 2. FBI / RICO Raid Butterfly Effect
    if (triggerEvent.type === 'FBI_RAID') {
      if (copy.category?.includes('Crime')) {
        copy.thoughtProcess = 'FBI Strike Force wiretaps detected! Moving speakeasy revenues into offshore accounts.'
        butterflyLogs.push({
          id: `butterfly_${day}_${copy.id}`,
          day,
          text: `🦋 FBI Raid Butterfly Effect: ${copy.name} shifted syndicate funds into offshore vaults.`,
        })
      }
    }

    // 3. Warren Buffett Stock Buy Butterfly Effect
    if (triggerEvent.type === 'BUFFETT_BUY') {
      if (copy.id === 'soros' || copy.id === 'livermore') {
        copy.thoughtProcess = 'Buffett acquired value stake; initiating short-squeeze position.'
        butterflyLogs.push({
          id: `butterfly_${day}_${copy.id}`,
          day,
          text: `🦋 Buffett Acquisition Butterfly Effect: ${copy.name} initiated short-squeeze options trading.`,
        })
      }
    }

    return copy
  })

  return {
    updatedAgents,
    butterflyLogs,
  }
}
