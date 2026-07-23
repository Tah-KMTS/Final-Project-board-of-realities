/**
 * Autonomous AI Agent Movement & Daily Routine Behavior Engine.
 * Makes Warren Buffett, Elon Musk, Pablo Escobar, Al Capone, etc. walk around and execute daily routines!
 */

export const TITAN_ROUTINES = {
  buffett: {
    name: 'Warren Buffett',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Berkshire Tower', action: '📈 Auditing Value Stock Balance Sheets', x: 220, y: 180 },
      { location: 'Commercial Bank', action: '🏦 Depositing Capital Dividends', x: 450, y: 320 },
      { location: 'Nintendo HQ', action: '🎮 Inspecting Gaming Moats in Kyoto', x: 680, y: 240 },
    ],
  },
  musk: {
    name: 'Elon Musk',
    homeCity: 'sapporo',
    schedule: [
      { location: 'Giga Factory', action: '🤖 Inspecting Robotic Assembly Lines', x: 300, y: 200 },
      { location: 'SpaceX Launchpad', action: '🚀 Testing Starship Propulsion', x: 580, y: 350 },
      { location: 'Apple Glass Campus', action: '📱 Negotiating Tech Silicon Patents', x: 150, y: 400 },
    ],
  },
  escobar: {
    name: 'Pablo Escobar',
    homeCity: 'osaka',
    schedule: [
      { location: 'Osaka Docks', action: '🌿 Inspecting Medellin Cocaine Shipments', x: 180, y: 420 },
      { location: 'Speakeasy Hotel', action: '🍷 Brokering Syndicate Deals with Capone', x: 400, y: 220 },
      { location: 'Flamingo Casino', action: '🎲 Laundering Dirty Cartel Cash', x: 650, y: 380 },
    ],
  },
  capone: {
    name: 'Al Capone',
    homeCity: 'osaka',
    schedule: [
      { location: 'Speakeasy Hotel', action: '🩸 Collecting Protection Tolls', x: 380, y: 240 },
      { location: 'Dotonbori Arcade', action: '🎰 Inspecting Underground Gambling Vaults', x: 520, y: 410 },
      { location: 'Police HQ', action: '👮 Bribing Bureau Officers', x: 280, y: 150 },
    ],
  },
}

export function updateAgentPositions(activeAgents, timeTick = 0) {
  return activeAgents.map((agent) => {
    const routineKey = Object.keys(TITAN_ROUTINES).find((k) => agent.name?.toLowerCase().includes(k))
    if (!routineKey) {
      // Default wandering behavior
      const angle = (timeTick * 0.05 + (agent.id || 0)) % (Math.PI * 2)
      return {
        ...agent,
        currentX: Math.round(300 + Math.cos(angle) * 120),
        currentY: Math.round(250 + Math.sin(angle) * 90),
        currentAction: '🚶 Wandering City District',
      }
    }

    const routine = TITAN_ROUTINES[routineKey]
    const stepIndex = Math.floor((timeTick / 5) % routine.schedule.length)
    const currentStep = routine.schedule[stepIndex]
    const nextStep = routine.schedule[(stepIndex + 1) % routine.schedule.length]

    const progress = (timeTick % 5) / 5
    const lerpX = Math.round(currentStep.x + (nextStep.x - currentStep.x) * progress)
    const lerpY = Math.round(currentStep.y + (nextStep.y - currentStep.y) * progress)

    return {
      ...agent,
      currentX: lerpX,
      currentY: lerpY,
      currentAction: currentStep.action,
      currentLocation: currentStep.location,
    }
  })
}
