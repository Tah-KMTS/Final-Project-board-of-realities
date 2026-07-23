/**
 * Autonomous AI Agent Movement & Daily Routine Behavior Engine.
 * All 25 Finance NPCs have bespoke city-authentic schedules based on their
 * home city assignment in japanCities.js primaryResidents lists.
 * Positions are in the 800×500 canvas coordinate space.
 */

export const TITAN_ROUTINES = {
  // Tokyo — Luxury Architectural District
  jobs: {
    name: 'Steve Jobs',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Apple Glass Campus', action: '🍎 Perfecting the Next Design Language', x: 160, y: 180 },
      { location: 'Tokyo Stock Exchange', action: '📈 Reviewing Apple Share Buyback Program', x: 420, y: 290 },
      { location: 'Giga Factory', action: '🤝 Meeting Musk on AI Chip Supply Chain', x: 620, y: 200 },
    ],
  },
  musk: {
    name: 'Elon Musk',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Giga Factory Spire', action: '🤖 Inspecting Robotic Assembly Lines', x: 580, y: 200 },
      { location: 'SpaceX Launchpad', action: '🚀 Testing Starship Propulsion Burns', x: 700, y: 350 },
      { location: 'Apple Glass Campus', action: '📱 Negotiating AI Chip Silicon Patents', x: 200, y: 400 },
    ],
  },
  huang: {
    name: 'Jensen Huang',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Tokyo Stock Exchange', action: '📊 Pitching H100 GPU Cluster Order', x: 400, y: 280 },
      { location: 'Apple Glass Campus', action: '🧠 Demoing AI Inference Engine', x: 170, y: 200 },
      { location: 'FTC Hearing Room', action: '⚖️ Defending CUDA Monopoly Claim', x: 650, y: 430 },
    ],
  },

  // Kyoto — HD-2D JRPG Shinto Pagoda District
  buffett: {
    name: 'Warren Buffett',
    homeCity: 'kyoto',
    schedule: [
      { location: 'Berkshire Tower', action: '📈 Auditing Value Stock Balance Sheets', x: 220, y: 250 },
      { location: 'Cherry Coke Tea House', action: '🥤 Drinking Cherry Coke at the Diner', x: 400, y: 380 },
      { location: 'Commercial Bank', action: '🏦 Depositing Capital Dividends', x: 620, y: 200 },
    ],
  },
  munger: {
    name: 'Charlie Munger',
    homeCity: 'kyoto',
    schedule: [
      { location: 'Berkshire Tower', action: '📚 Reading Multi-Disciplinary Research', x: 260, y: 230 },
      { location: 'Kyoto Machiya Library', action: '🧠 Applying Mental Model Inversion', x: 500, y: 350 },
      { location: 'Cherry Coke Tea House', action: '☕ Discussing Philosophy with Buffett', x: 390, y: 400 },
    ],
  },
  graham: {
    name: 'Benjamin Graham',
    homeCity: 'kyoto',
    schedule: [
      { location: 'Berkshire Tower', action: '📖 Writing Security Analysis Appendix', x: 230, y: 240 },
      { location: 'Kyoto Commercial Bank', action: '💰 Scanning for Net-Net Opportunities', x: 580, y: 310 },
      { location: 'Cherry Coke Tea House', action: '📊 Tutoring Young Buffett on Margins', x: 410, y: 390 },
    ],
  },
  templeton: {
    name: 'Sir John Templeton',
    homeCity: 'kyoto',
    schedule: [
      { location: 'Kyoto Bamboo Forest', action: '🌿 Meditating on Maximum Pessimism', x: 680, y: 180 },
      { location: 'Berkshire Tower', action: '🌍 Buying Cheap Japanese Export Stocks', x: 240, y: 250 },
      { location: 'IRS Building', action: '📑 Filing Offshore Tax Exemption Papers', x: 450, y: 350 },
    ],
  },

  // Osaka — Underground Merchant & Crime Hub
  capone: {
    name: 'Al Capone',
    homeCity: 'osaka',
    schedule: [
      { location: 'Speakeasy Hotel', action: '🩸 Collecting Protection Tolls', x: 380, y: 240 },
      { location: 'Dotonbori Arcade', action: '🎰 Inspecting Underground Gambling Vaults', x: 520, y: 410 },
      { location: 'Osaka Docks', action: '🚢 Overseeing Rum Runner Shipments', x: 200, y: 360 },
    ],
  },
  luciano: {
    name: 'Lucky Luciano',
    homeCity: 'osaka',
    schedule: [
      { location: 'Speakeasy Hotel', action: '🤝 Brokering Five Families Summit', x: 400, y: 220 },
      { location: 'Osaka Docks', action: '💼 Reviewing Narcotics Import Manifests', x: 210, y: 370 },
      { location: 'Dotonbori Arcade', action: '🎲 Holding Court at the Casino Tables', x: 560, y: 420 },
    ],
  },
  soros: {
    name: 'George Soros',
    homeCity: 'osaka',
    schedule: [
      { location: 'Osaka Currency Exchange', action: '💴 Shorting the Japanese Yen', x: 480, y: 260 },
      { location: 'Speakeasy Hotel', action: '📞 Calling London to Execute Pound Short', x: 390, y: 220 },
      { location: 'Dotonbori Canal', action: '🌊 Watching the Yen Crash from the Bridge', x: 300, y: 420 },
    ],
  },
  livermore: {
    name: 'Jesse Livermore',
    homeCity: 'osaka',
    schedule: [
      { location: 'Osaka Stock Exchange', action: '📉 Accumulating Short Positions', x: 450, y: 280 },
      { location: 'Docks Warehouse', action: '📜 Reviewing Commodity Futures Ledgers', x: 180, y: 390 },
      { location: 'Speakeasy Hotel', action: '🥃 Drinking Alone After Margin Call', x: 400, y: 230 },
    ],
  },

  // Sapporo — Industrial Alpine Region
  ford: {
    name: 'Henry Ford',
    homeCity: 'sapporo',
    schedule: [
      { location: 'Ford River Rouge Complex', action: '⚙️ Inspecting Assembly Line Efficiency', x: 200, y: 200 },
      { location: 'Carnegie Steel Mill', action: '🔩 Ordering Steel Coil Deliveries', x: 540, y: 320 },
      { location: 'Sapporo Tool Shop', action: '🔧 Testing New Engine Block Designs', x: 370, y: 440 },
    ],
  },
  carnegie: {
    name: 'Andrew Carnegie',
    homeCity: 'sapporo',
    schedule: [
      { location: 'Homestead Steel Mill', action: '🔥 Inspecting Bessemer Converter Output', x: 520, y: 300 },
      { location: 'Standard Oil Refinery', action: '🤝 Negotiating Rail-Oil Integration Deal', x: 320, y: 230 },
      { location: 'Alpine Library', action: '📚 Donating Books to Sapporo Library', x: 680, y: 380 },
    ],
  },
  rockefeller: {
    name: 'John D. Rockefeller',
    homeCity: 'sapporo',
    schedule: [
      { location: 'Standard Oil Refinery', action: '🛢️ Squeezing Rival Refinery Margins', x: 340, y: 220 },
      { location: 'Ford River Rouge Complex', action: '🚗 Supplying Gasoline to Ford Plants', x: 210, y: 210 },
      { location: 'Sapporo Bank', action: '💵 Depositing This Month\'s Monopoly Rents', x: 590, y: 350 },
    ],
  },
  // Additional characters with default wandering until city assignment grows
  vanderbilt: {
    name: 'Cornelius Vanderbilt',
    homeCity: 'sapporo',
    schedule: [
      { location: 'Sapporo Rail Depot', action: '🚂 Auditing New Track Expansion Plans', x: 460, y: 260 },
      { location: 'Hokkaido Port', action: '⚓ Inspecting Steamship Cargo Manifests', x: 220, y: 380 },
      { location: 'Ford River Rouge Complex', action: '🤝 Negotiating Rail-Factory Partnership', x: 210, y: 210 },
    ],
  },
  gates: {
    name: 'Bill Gates',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Tokyo Stock Exchange', action: '💻 Pitching MS Office Enterprise Deals', x: 410, y: 290 },
      { location: 'FTC Hearing Room', action: '⚖️ Defending Windows OS Antitrust Case', x: 640, y: 430 },
      { location: 'Apple Glass Campus', action: '👀 Observing Apple Design Philosophy', x: 165, y: 195 },
    ],
  },
  bezos: {
    name: 'Jeff Bezos',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Tokyo Stock Exchange', action: '📦 Announcing AWS Cloud Expansion', x: 420, y: 285 },
      { location: 'Giga Factory', action: '🤖 Testing Amazon Delivery Drones', x: 590, y: 195 },
      { location: 'Federal Reserve HQ', action: '💰 Reviewing Prime Credit Card Float', x: 700, y: 340 },
    ],
  },
  son: {
    name: 'Masayoshi Son',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Tokyo Stock Exchange', action: '📱 Pitching SoftBank Vision Fund II', x: 415, y: 288 },
      { location: 'Apple Glass Campus', action: '💡 Scouting AI Startup Founders', x: 168, y: 192 },
      { location: 'Giga Factory', action: '🚀 Co-Investing SpaceX Series Round', x: 585, y: 202 },
    ],
  },
  icahn: {
    name: 'Carl Icahn',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Tokyo Stock Exchange', action: '⚔️ Filing Hostile Takeover Prospectus', x: 422, y: 292 },
      { location: 'FTC Hearing Room', action: '💼 Greenmail Negotiation with Board', x: 648, y: 428 },
      { location: 'Corporate Tower', action: '📋 Stripping Underperforming Assets', x: 310, y: 360 },
    ],
  },
  dalio: {
    name: 'Ray Dalio',
    homeCity: 'kyoto',
    schedule: [
      { location: 'Berkshire Tower', action: '🌦️ Calibrating All-Weather Portfolio', x: 228, y: 248 },
      { location: 'Kyoto Bamboo Forest', action: '🧘 Practicing Principles Meditation', x: 675, y: 182 },
      { location: 'IRS Building', action: '📊 Filing Bridgewater Macro Projections', x: 448, y: 352 },
    ],
  },
  simons: {
    name: 'Jim Simons',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Tokyo Stock Exchange', action: '🔢 Running Medallion HFT Algorithms', x: 418, y: 286 },
      { location: 'Federal Reserve HQ', action: '📡 Accessing Central Bank Data Feeds', x: 695, y: 345 },
      { location: 'Apple Glass Campus', action: '💻 Expanding Quant Research Servers', x: 163, y: 197 },
    ],
  },
  lynch: {
    name: 'Peter Lynch',
    homeCity: 'kyoto',
    schedule: [
      { location: 'Cherry Coke Tea House', action: '☕ Spotting Consumer Trend Opportunities', x: 405, y: 385 },
      { location: 'Kyoto Machiya 7-Eleven', action: '🏪 Researching Convenience Store Stocks', x: 540, y: 300 },
      { location: 'Berkshire Tower', action: '📈 Presenting 10-Bagger Fund Results', x: 235, y: 245 },
    ],
  },
  walker: {
    name: 'Madam C.J. Walker',
    homeCity: 'osaka',
    schedule: [
      { location: 'Osaka Market District', action: '💼 Expanding Door-to-Door Sales Network', x: 370, y: 260 },
      { location: 'Dotonbori Arcade', action: '🌟 Recruiting Female Sales Agents', x: 535, y: 415 },
      { location: 'Speakeasy Hotel', action: '🤝 Pitching Haircare Empire to Investors', x: 395, y: 225 },
    ],
  },
  jpmorgan: {
    name: 'J.P. Morgan',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Tokyo Stock Exchange', action: '🏦 Organizing Emergency Market Bailout', x: 425, y: 283 },
      { location: 'Federal Reserve HQ', action: '💰 Meeting with Central Bankers', x: 688, y: 348 },
      { location: 'Corporate Tower', action: '📋 Consolidating Steel \u0026 Rail Trusts', x: 315, y: 355 },
    ],
  },
  // Crime character — escobar referenced in old code
  escobar: {
    name: 'Pablo Escobar',
    homeCity: 'osaka',
    schedule: [
      { location: 'Osaka Docks', action: '🌿 Inspecting Medellin Cocaine Shipments', x: 195, y: 415 },
      { location: 'Speakeasy Hotel', action: '🍷 Brokering Syndicate Deals with Capone', x: 402, y: 222 },
      { location: 'Dotonbori Arcade', action: '🎲 Laundering Dirty Cartel Cash', x: 548, y: 418 },
    ],
  },
}

export function updateAgentPositions(activeAgents, timeTick = 0) {
  return activeAgents.map((agent) => {
    const routineKey = Object.keys(TITAN_ROUTINES).find((k) =>
      agent.name?.toLowerCase().includes(k) ||
      agent.id?.toLowerCase() === k
    )
    if (!routineKey) {
      // Default wandering behavior — stays within 800×500 canvas bounds
      const angle = (timeTick * 0.05 + (parseInt(agent.id, 36) || 0)) % (Math.PI * 2)
      return {
        ...agent,
        currentX: Math.round(380 + Math.cos(angle) * 160),
        currentY: Math.round(240 + Math.sin(angle) * 100),
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
      currentX: Math.min(780, Math.max(20, lerpX)),
      currentY: Math.min(480, Math.max(20, lerpY)),
      currentAction: currentStep.action,
      currentLocation: currentStep.location,
      currentCity: routine.homeCity,
    }
  })
}
