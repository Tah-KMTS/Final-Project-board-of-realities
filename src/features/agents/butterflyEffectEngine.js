/**
 * Inter-Agent Butterfly Effect Chain Reaction Engine.
 * Calculates multi-agent ripple effects across all 76 characters.
 */

export function triggerButterflyEffect(triggerEvent, agents, day) {
  const butterflyLogs = []

  const updatedAgents = agents.map((agent) => {
    const copy = { ...agent }

    // 1. Fed Interest Rate Hike Ripple Effect - archetype-based (not just
    // rockefeller/carnegie/musk) so every Industrial Monopolist and Tech
    // Disruptor Titan reacts, matching agentEngine.js's ARCHETYPE_PROFILES
    // key names (confirmed against financeNpcs.js's real `archetype` field).
    if (triggerEvent.type === 'FED_RATE_HIKE') {
      if (copy.personality === 'monopolist') {
        copy.thoughtProcess = 'Rate hike increases borrowing costs; scaling down factory expansion.'
        butterflyLogs.push({
          id: `butterfly_${day}_${copy.id}`,
          day,
          text: `🦋 Fed Rate Hike Butterfly Effect: ${copy.name} slowed factory expansion in Sapporo.`,
        })
      }
      if (copy.personality === 'tech_disruptor') {
        copy.thoughtProcess = 'Tech growth stocks cooling down; pivoting capital into automated robot R&D.'
        butterflyLogs.push({
          id: `butterfly_${day}_${copy.id}`,
          day,
          text: `🦋 Fed Rate Hike Butterfly Effect: ${copy.name} pivoted capital into automated robot R&D.`,
        })
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

    // 3. Warren Biffle Stock Buy Butterfly Effect - archetype-based (every
    // Macro Speculator Titan, not just soros/livermore).
    if (triggerEvent.type === 'BUFFETT_BUY') {
      if (copy.personality === 'macro_speculator') {
        copy.thoughtProcess = 'Biffle acquired value stake; initiating short-squeeze position.'
        butterflyLogs.push({
          id: `butterfly_${day}_${copy.id}`,
          day,
          text: `🦋 Biffle Acquisition Butterfly Effect: ${copy.name} initiated short-squeeze options trading.`,
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
