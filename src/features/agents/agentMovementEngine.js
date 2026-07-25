/**
 * Autonomous AI Agent Movement & Daily Routine Behavior Engine.
 * All 25 Finance NPCs have bespoke city-authentic schedules based on their
 * home city assignment in japanCities.js primaryResidents lists.
 * Positions are synced to the new tilemap grid (40×45 grid, 40px tiles = 1600×1800 tilemap coordinate space).
 */

export const TITAN_ROUTINES = {
  // Tokyo — Luxury Architectural District
  jobs: {
    name: 'Steve Jobs',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Apple Glass Campus', action: '🍎 Perfecting the Next Design Language', x: 320, y: 1360 },
      { location: 'Tokyo Stock Exchange', action: '📈 Reviewing Apple Share Buyback Program', x: 840, y: 320 },
      { location: 'Giga Factory', action: '🤝 Meeting Rusk on AI Chip Supply Chain', x: 1240, y: 1400 },
    ],
  },
  musk: {
    name: 'Elan Rusk',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Giga Factory Spire', action: '🤖 Inspecting Robotic Assembly Lines', x: 1160, y: 1400 },
      { location: 'SpaceX Launchpad', action: '🚀 Testing Starship Propulsion Burns', x: 1400, y: 1440 },
      { location: 'Apple Glass Campus', action: '📱 Negotiating AI Chip Silicon Patents', x: 400, y: 1360 },
    ],
  },
  huang: {
    name: 'Jensen Fang',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Tokyo Stock Exchange', action: '📊 Pitching H100 GPU Cluster Order', x: 800, y: 320 },
      { location: 'Apple Glass Campus', action: '🧠 Demoing AI Inference Engine', x: 340, y: 1360 },
      { location: 'FTC Hearing Room', action: '⚖️ Defending CUDA Monopoly Claim', x: 1300, y: 1000 },
    ],
  },

  // Kyoto — HD-2D JRPG Shinto Pagoda District
  buffett: {
    name: 'Warren Biffle',
    homeCity: 'kyoto',
    schedule: [
      { location: 'Berkshire Tower', action: '📈 Auditing Value Stock Balance Sheets', x: 440, y: 320 },
      { location: 'Cherry Coke Tea House', action: '🥤 Drinking Cherry Coke at the Diner', x: 800, y: 320 },
      { location: 'Commercial Bank', action: '🏦 Depositing Capital Dividends', x: 1240, y: 720 },
    ],
  },
  munger: {
    name: 'Charlie Munger',
    homeCity: 'kyoto',
    schedule: [
      { location: 'Berkshire Tower', action: '📚 Reading Multi-Disciplinary Research', x: 520, y: 320 },
      { location: 'Kyoto Machiya Library', action: '🧠 Applying Mental Model Inversion', x: 1000, y: 320 },
      { location: 'Cherry Coke Tea House', action: '☕ Discussing Philosophy with Biffle', x: 780, y: 320 },
    ],
  },
  graham: {
    name: 'Benjamin Graham',
    homeCity: 'kyoto',
    schedule: [
      { location: 'Berkshire Tower', action: '📖 Writing Security Analysis Appendix', x: 460, y: 320 },
      { location: 'Kyoto Commercial Bank', action: '💰 Scanning for Net-Net Opportunities', x: 1160, y: 720 },
      { location: 'Cherry Coke Tea House', action: '📊 Tutoring Young Biffle on Margins', x: 820, y: 320 },
    ],
  },
  templeton: {
    name: 'Sir John Templeton',
    homeCity: 'kyoto',
    schedule: [
      { location: 'Kyoto Bamboo Forest', action: '🌿 Meditating on Maximum Pessimism', x: 1360, y: 320 },
      { location: 'Berkshire Tower', action: '🌍 Buying Cheap Japanese Export Stocks', x: 480, y: 320 },
      { location: 'IRS Building', action: '📑 Filing Offshore Tax Exemption Papers', x: 900, y: 760 },
    ],
  },

  // Osaka — Underground Merchant & Crime Hub
  capone: {
    name: 'Al Capone',
    homeCity: 'osaka',
    schedule: [
      { location: 'Speakeasy Hotel', action: '🩸 Collecting Protection Tolls', x: 760, y: 240 },
      { location: 'Dotonbori Arcade', action: '🎰 Inspecting Underground Gambling Vaults', x: 1040, y: 240 },
      { location: 'Osaka Docks', action: '🚢 Overseeing Rum Runner Shipments', x: 400, y: 640 },
    ],
  },
  luciano: {
    name: 'Lucky Luciano',
    homeCity: 'osaka',
    schedule: [
      { location: 'Speakeasy Hotel', action: '🤝 Brokering Five Families Summit', x: 800, y: 240 },
      { location: 'Osaka Docks', action: '💼 Reviewing Narcotics Import Manifests', x: 420, y: 640 },
      { location: 'Dotonbori Arcade', action: '🎲 Holding Court at the Casino Tables', x: 1120, y: 240 },
    ],
  },
  soros: {
    name: 'George Zoros',
    homeCity: 'osaka',
    schedule: [
      { location: 'Osaka Currency Exchange', action: '💴 Shorting the Japanese Yen', x: 960, y: 1040 },
      { location: 'Speakeasy Hotel', action: '📞 Calling London to Execute Pound Short', x: 780, y: 240 },
      { location: 'Dotonbori Canal', action: '🌊 Watching the Yen Crash from the Bridge', x: 600, y: 640 },
    ],
  },
  livermore: {
    name: 'Jesse Livermore',
    homeCity: 'osaka',
    schedule: [
      { location: 'Osaka Stock Exchange', action: '📉 Accumulating Short Positions', x: 900, y: 1040 },
      { location: 'Docks Warehouse', action: '📜 Reviewing Commodity Futures Ledgers', x: 360, y: 640 },
      { location: 'Speakeasy Hotel', action: '🥃 Drinking Alone After Margin Call', x: 800, y: 240 },
    ],
  },

  // Sapporo — Industrial Alpine Region
  ford: {
    name: 'Henry Ford',
    homeCity: 'sapporo',
    schedule: [
      { location: 'Ford River Rouge Complex', action: '⚙️ Inspecting Assembly Line Efficiency', x: 400, y: 320 },
      { location: 'Carnegie Steel Mill', action: '🔩 Ordering Steel Coil Deliveries', x: 1080, y: 320 },
      { location: 'Sapporo Tool Shop', action: '🔧 Testing New Engine Block Designs', x: 740, y: 720 },
    ],
  },
  carnegie: {
    name: 'Andrew Carnegie',
    homeCity: 'sapporo',
    schedule: [
      { location: 'Homestead Steel Mill', action: '🔥 Inspecting Bessemer Converter Output', x: 1040, y: 320 },
      { location: 'Standard Oil Refinery', action: '🤝 Negotiating Rail-Oil Integration Deal', x: 640, y: 320 },
      { location: 'Alpine Library', action: '📚 Donating Books to Sapporo Library', x: 1360, y: 1200 },
    ],
  },
  rockefeller: {
    name: 'John D. Rockefeller',
    homeCity: 'sapporo',
    schedule: [
      { location: 'Standard Oil Refinery', action: '🛢️ Squeezing Rival Refinery Margins', x: 680, y: 320 },
      { location: 'Ford River Rouge Complex', action: '🚗 Supplying Gasoline to Ford Plants', x: 420, y: 320 },
      { location: 'Sapporo Bank', action: '💵 Depositing This Month\'s Monopoly Rents', x: 1180, y: 720 },
    ],
  },
  vanderbilt: {
    name: 'Cornelius Vanderbilt',
    homeCity: 'sapporo',
    schedule: [
      { location: 'Sapporo Rail Depot', action: '🚂 Auditing New Track Expansion Plans', x: 920, y: 720 },
      { location: 'Hokkaido Port', action: '⚓ Inspecting Steamship Cargo Manifests', x: 440, y: 720 },
      { location: 'Ford River Rouge Complex', action: '🤝 Negotiating Rail-Factory Partnership', x: 420, y: 320 },
    ],
  },
  gates: {
    name: 'Will Gatling',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Tokyo Stock Exchange', action: '💻 Pitching MS Office Enterprise Deals', x: 820, y: 320 },
      { location: 'FTC Hearing Room', action: '⚖️ Defending Windows OS Antitrust Case', x: 1280, y: 1000 },
      { location: 'Apple Glass Campus', action: '👀 Observing Apple Design Philosophy', x: 330, y: 1360 },
    ],
  },
  bezos: {
    name: 'Geoff Bezel',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Tokyo Stock Exchange', action: '📦 Announcing AWS Cloud Expansion', x: 840, y: 320 },
      { location: 'Giga Factory', action: '🤖 Testing Amazon Delivery Drones', x: 1180, y: 1400 },
      { location: 'Federal Reserve HQ', action: '💰 Reviewing Prime Credit Card Float', x: 1400, y: 1000 },
    ],
  },
  son: {
    name: 'Masatoshi Ren',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Tokyo Stock Exchange', action: '📱 Pitching SoftBank Vision Fund II', x: 830, y: 320 },
      { location: 'Apple Glass Campus', action: '💡 Scouting AI Startup Founders', x: 336, y: 1360 },
      { location: 'Giga Factory', action: '🚀 Co-Investing SpaceX Series Round', x: 1170, y: 1400 },
    ],
  },
  icahn: {
    name: 'Karl Eikahn',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Tokyo Stock Exchange', action: '⚔️ Filing Hostile Takeover Prospectus', x: 844, y: 320 },
      { location: 'FTC Hearing Room', action: '💼 Greenmail Negotiation with Board', x: 1296, y: 1000 },
      { location: 'Corporate Tower', action: '📋 Stripping Underperforming Assets', x: 620, y: 1000 },
    ],
  },
  dalio: {
    name: 'Ray Daglio',
    homeCity: 'kyoto',
    schedule: [
      { location: 'Berkshire Tower', action: '🌦️ Calibrating All-Weather Portfolio', x: 456, y: 320 },
      { location: 'Kyoto Bamboo Forest', action: '🧘 Practicing Principles Meditation', x: 1350, y: 320 },
      { location: 'IRS Building', action: '📊 Filing Bridgewater Macro Projections', x: 896, y: 760 },
    ],
  },
  simons: {
    name: 'Jim Simons',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Tokyo Stock Exchange', action: '🔢 Running Medallion HFT Algorithms', x: 836, y: 320 },
      { location: 'Federal Reserve HQ', action: '📡 Accessing Central Bank Data Feeds', x: 1390, y: 1000 },
      { location: 'Apple Glass Campus', action: '💻 Expanding Quant Research Servers', x: 326, y: 1360 },
    ],
  },
  lynch: {
    name: 'Peter Vance',
    homeCity: 'kyoto',
    schedule: [
      { location: 'Cherry Coke Tea House', action: '☕ Spotting Consumer Trend Opportunities', x: 810, y: 320 },
      { location: 'Kyoto Machiya 7-Eleven', action: '🏪 Researching Convenience Store Stocks', x: 1080, y: 1160 },
      { location: 'Berkshire Tower', action: '📈 Presenting 10-Bagger Fund Results', x: 470, y: 320 },
    ],
  },
  walker: {
    name: 'Madam C.J. Walker',
    homeCity: 'osaka',
    schedule: [
      { location: 'Osaka Market District', action: '💼 Expanding Door-to-Door Sales Network', x: 740, y: 640 },
      { location: 'Dotonbori Arcade', action: '🌟 Recruiting Female Sales Agents', x: 1070, y: 240 },
      { location: 'Speakeasy Hotel', action: '🤝 Pitching Haircare Empire to Investors', x: 790, y: 240 },
    ],
  },
  jpmorgan: {
    name: 'J.P. Morgan',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Tokyo Stock Exchange', action: '🏦 Organizing Emergency Market Bailout', x: 850, y: 320 },
      { location: 'Federal Reserve HQ', action: '💰 Meeting with Central Bankers', x: 1376, y: 1000 },
      { location: 'Corporate Tower', action: '📋 Consolidating Steel & Rail Trusts', x: 630, y: 1000 },
    ],
  },
  escobar: {
    name: 'Pablo Escobar',
    homeCity: 'osaka',
    schedule: [
      { location: 'Osaka Docks', action: '🌿 Inspecting Medellin Cocaine Shipments', x: 390, y: 640 },
      { location: 'Speakeasy Hotel', action: '🍷 Brokering Syndicate Deals with Capone', x: 804, y: 240 },
      { location: 'Dotonbori Arcade', action: '🎲 Laundering Dirty Cartel Cash', x: 1096, y: 240 },
    ],
  },
}

// Bounded per-id hash for the generic wander tier below. This used to be
// `parseInt(agent.id, 36)`, which silently parses an ENTIRE lowercase id as
// a base-36 integer (every a-z character is a valid base-36 digit), so any
// multi-letter id produces a seed in the ~1e15-1e17 range. Adding
// timeTick's small per-frame increment to a number that large gets
// swallowed by floating-point rounding (a double only carries ~15-17
// significant digits), so `angle` never actually changed and
// Math.cos/sin(angle) returned the same constant forever - the agent
// visually froze in place. Most of the roster (everyone without a bespoke
// TITAN_ROUTINES entry) was silently affected, not just one character. A
// small bounded hash keeps the seed tiny so real motion never gets lost to
// rounding.
function hashSeed(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h % 100000
}

export function updateAgentPositions(activeAgents, timeTick = 0) {
  return activeAgents.map((agent) => {
    // Match strictly by id - the old fuzzy name.includes(key) matching made
    // unrelated characters inherit someone else's routine (e.g. FTC chairman
    // "Joe Simons" picked up quant Jim Simons' schedule via the 'simons'
    // substring). Registry ids equal roster ids, so exact match is enough.
    const routineKey = TITAN_ROUTINES[agent.id?.toLowerCase()] ? agent.id.toLowerCase() : null
    if (!routineKey) {
      // Generic agent tier: characters without a bespoke schedule wander a
      // deterministic per-id orbit - id-seeded center, radius, and angular
      // speed so no two agents share the same track, and the agent's own
      // ambientActions (derived from their real biographical data) rotate as
      // their current "thought". Coordinates live in the same 1600x1800
      // space the routines use; callers remap into the live map.
      const seed = hashSeed(agent.id || '') || 1
      const angle = timeTick * (0.04 + (seed % 7) * 0.012) + seed
      const cx = 300 + (seed % 11) * 100
      const cy = 400 + ((seed >> 3) % 9) * 120
      const radius = 120 + (seed % 5) * 60
      const actions = agent.ambientActions?.length ? agent.ambientActions : ['🚶 Wandering City District']
      const actionIndex = Math.floor(Math.max(0, timeTick) / 5 + (seed % actions.length)) % actions.length
      return {
        ...agent,
        currentX: Math.min(1560, Math.max(40, Math.round(cx + Math.cos(angle) * radius))),
        currentY: Math.min(1760, Math.max(40, Math.round(cy + Math.sin(angle) * radius))),
        currentAction: actions[actionIndex],
      }
    }

    const routine = TITAN_ROUTINES[routineKey]
    const safeTimeTick = Math.max(0, timeTick)
    const stepIndex = Math.floor((safeTimeTick / 5)) % routine.schedule.length
    const currentStep = routine.schedule[stepIndex]
    const nextStep = routine.schedule[(stepIndex + 1) % routine.schedule.length]

    const progress = (safeTimeTick % 5) / 5
    const lerpX = Math.round(currentStep.x + (nextStep.x - currentStep.x) * progress)
    const lerpY = Math.round(currentStep.y + (nextStep.y - currentStep.y) * progress)

    return {
      ...agent,
      currentX: Math.min(1560, Math.max(40, lerpX)),
      currentY: Math.min(1760, Math.max(40, lerpY)),
      currentAction: currentStep.action,
      currentLocation: currentStep.location,
      currentCity: routine.homeCity,
    }
  })
}
