/**
 * Legacy Autonomous AI Agent Movement & Daily Routine Behavior Engine.
 *
 * House rule: this file's `updateAgentPositions` used to be the position
 * source OverworldScene.js's updateNamedRoamers drove sprites from (bespoke
 * TITAN_ROUTINES schedules for these 25 titans, an id-seeded orbit for
 * everyone else). It has been SUPERSEDED for that purpose by
 * worldPresenceEngine.js, which resolves all 88 characters (not just these
 * 25) from one deterministic model shared with the text modals, so a
 * character's on-map position and their modal's location text can never
 * contradict each other - the thing this file's positions could never
 * guarantee for the 63 characters it had no bespoke schedule for. As of this
 * change `updateAgentPositions` has no remaining callers anywhere in src/
 * (verified by grep) but is kept, unremoved, because:
 *   - TITAN_ROUTINES itself is still very much alive: characterDispositions.js
 *     reads it for homeCity, and OverworldScene.js's homeDistrictFor() reads
 *     it for district grouping.
 *   - Deleting an exported function is a bigger, separate decision than the
 *     position-source swap this comment is documenting.
 * Positions below are in the legacy tilemap grid (40x45 grid, 40px tiles =
 * 1600x1800 coordinate space) that predates the current 80-col mega-map.
 */

export const TITAN_ROUTINES = {
  // Tokyo — Luxury Architectural District
  jobs: {
    name: 'Steve Jobs',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Apple Glass Campus', action: '🍎 Perfecting the Next Design Language', buildingId: 'appleHQ', x: 320, y: 1360 },
      { location: 'Tokyo Stock Exchange', action: '📈 Reviewing Apple Share Buyback Program', buildingId: 'stockExchange', x: 840, y: 320 },
      { location: 'Musk Industries', action: '🤝 Meeting Musk on AI Chip Supply Chain', buildingId: 'muskHQ', x: 1240, y: 1400 },
    ],
  },
  musk: {
    name: 'Elon Musk',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Musk Industries', action: '🤖 Inspecting Robotic Assembly Lines', buildingId: 'muskHQ', x: 1160, y: 1400 },
      { location: 'Musk Industries', action: '🚀 Testing Starship Propulsion Burns', buildingId: 'muskHQ', x: 1400, y: 1440 },
      { location: 'Apple Glass Campus', action: '📱 Negotiating AI Chip Silicon Patents', buildingId: 'appleHQ', x: 400, y: 1360 },
    ],
  },
  huang: {
    name: 'Jensen Huang',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Tokyo Stock Exchange', action: '📊 Pitching H100 GPU Cluster Order', buildingId: 'stockExchange', x: 800, y: 320 },
      { location: 'Apple Glass Campus', action: '🧠 Demoing AI Inference Engine', buildingId: 'appleHQ', x: 340, y: 1360 },
      { location: 'Parliament Hall', action: '⚖️ Defending CUDA Monopoly Claim', buildingId: 'parliament', x: 1300, y: 1000 },
    ],
  },

  // Kyoto — HD-2D JRPG Shinto Pagoda District
  buffett: {
    name: 'Warren Buffett',
    homeCity: 'kyoto',
    schedule: [
      { location: 'Machiya Executive Estate', action: '📈 Auditing Value Stock Balance Sheets', buildingId: 'machiyaEstate', x: 440, y: 320 },
      { location: 'Cherry Coke Tea House', action: '🥤 Drinking Cherry Coke at the Diner', buildingId: 'teaHouse', x: 800, y: 320 },
      { location: 'Ryokan Mountain Inn', action: '🍵 Reviewing Portfolio Over Morning Tea', buildingId: 'hotel', x: 1240, y: 720 },
    ],
  },
  munger: {
    name: 'Charlie Munger',
    homeCity: 'kyoto',
    schedule: [
      { location: 'Whispering Temple Chapel', action: '📚 Reading Multi-Disciplinary Research', buildingId: 'temple', x: 520, y: 320 },
      { location: 'Machiya Executive Estate', action: '🧠 Applying Mental Model Inversion', buildingId: 'machiyaEstate', x: 1000, y: 320 },
      { location: 'Cherry Coke Tea House', action: '☕ Discussing Philosophy with Buffett', buildingId: 'teaHouse', x: 780, y: 320 },
    ],
  },
  graham: {
    name: 'Benjamin Graham',
    homeCity: 'kyoto',
    schedule: [
      { location: 'Zen Rock Garden', action: '📖 Writing Security Analysis Appendix', buildingId: 'zenGarden', x: 460, y: 320 },
      { location: 'Ryokan Mountain Inn', action: '💰 Scanning for Net-Net Opportunities', buildingId: 'hotel', x: 1160, y: 720 },
      { location: 'Cherry Coke Tea House', action: '📊 Tutoring Young Buffett on Margins', buildingId: 'teaHouse', x: 820, y: 320 },
    ],
  },
  templeton: {
    name: 'Sir John Templeton',
    homeCity: 'kyoto',
    schedule: [
      { location: 'Serenity Park', action: '🌿 Meditating on Maximum Pessimism', buildingId: 'park', x: 1360, y: 320 },
      { location: 'Machiya Executive Estate', action: '🌍 Buying Cheap Japanese Export Stocks', buildingId: 'machiyaEstate', x: 480, y: 320 },
      { location: 'IRS Internal Revenue', action: '📑 Filing Offshore Tax Exemption Papers', buildingId: 'irsHQ', x: 900, y: 760 },
    ],
  },

  // Osaka — Underground Merchant & Crime Hub
  capone: {
    name: 'Al Capone',
    homeCity: 'osaka',
    schedule: [
      { location: 'Speakeasy Hotel', action: '🩸 Collecting Protection Tolls', buildingId: 'speakeasyHotel', x: 760, y: 240 },
      { location: 'Dotonbori Arcade', action: '🎰 Inspecting Underground Gambling Vaults', buildingId: 'dotonboriArcade', x: 1040, y: 240 },
      { location: 'Dock Underground Vaults', action: '🚢 Overseeing Rum Runner Shipments', buildingId: 'dockVaults', x: 400, y: 640 },
    ],
  },
  luciano: {
    name: 'Lucky Luciano',
    homeCity: 'osaka',
    schedule: [
      { location: 'Speakeasy Hotel', action: '🤝 Brokering Five Families Summit', buildingId: 'speakeasyHotel', x: 800, y: 240 },
      { location: 'Dock Underground Vaults', action: '💼 Reviewing Narcotics Import Manifests', buildingId: 'dockVaults', x: 420, y: 640 },
      { location: 'Dotonbori Arcade', action: '🎲 Holding Court at the Casino Tables', buildingId: 'dotonboriArcade', x: 1120, y: 240 },
    ],
  },
  soros: {
    name: 'George Soros',
    homeCity: 'osaka',
    schedule: [
      { location: 'Black Market', action: '💴 Shorting the Japanese Yen', buildingId: 'blackMarket', x: 960, y: 1040 },
      { location: 'Speakeasy Hotel', action: '📞 Calling London to Execute Pound Short', buildingId: 'speakeasyHotel', x: 780, y: 240 },
      { location: 'Kuromon Fish Market', action: '🌊 Watching the Yen Crash from the Canal-side Market', buildingId: 'fishMarket', x: 600, y: 640 },
    ],
  },
  livermore: {
    name: 'Jesse Livermore',
    homeCity: 'osaka',
    schedule: [
      { location: 'Black Market', action: '📉 Accumulating Short Positions', buildingId: 'blackMarket', x: 900, y: 1040 },
      { location: 'Dock Underground Vaults', action: '📜 Reviewing Commodity Futures Ledgers', buildingId: 'dockVaults', x: 360, y: 640 },
      { location: 'Speakeasy Hotel', action: '🥃 Drinking Alone After Margin Call', buildingId: 'speakeasyHotel', x: 800, y: 240 },
    ],
  },

  // Sapporo — Industrial Alpine Region
  ford: {
    name: 'Henry Ford',
    homeCity: 'sapporo',
    schedule: [
      { location: 'Ford River Rouge Complex', action: '⚙️ Inspecting Assembly Line Efficiency', buildingId: 'fordRougeComplex', x: 400, y: 320 },
      { location: 'Homestead Steel Mill', action: '🔩 Ordering Steel Coil Deliveries', buildingId: 'carnegieSteelMill', x: 1080, y: 320 },
      { location: 'Mount Yotei Alpine Lodge', action: '🔧 Testing New Engine Designs at the Lodge Workshop', buildingId: 'alpineLodge', x: 740, y: 720 },
    ],
  },
  carnegie: {
    name: 'Andrew Carnegie',
    homeCity: 'sapporo',
    schedule: [
      { location: 'Homestead Steel Mill', action: '🔥 Inspecting Bessemer Converter Output', buildingId: 'carnegieSteelMill', x: 1040, y: 320 },
      { location: 'Standard Oil Refinery', action: '🤝 Negotiating Rail-Oil Integration Deal', buildingId: 'standardOilRefinery', x: 640, y: 320 },
      { location: 'Mount Yotei Alpine Lodge', action: '📚 Donating Books to the Lodge Library', buildingId: 'alpineLodge', x: 1360, y: 1200 },
    ],
  },
  rockefeller: {
    name: 'John D. Rockefeller',
    homeCity: 'sapporo',
    schedule: [
      { location: 'Standard Oil Refinery', action: '🛢️ Squeezing Rival Refinery Margins', buildingId: 'standardOilRefinery', x: 680, y: 320 },
      { location: 'Ford River Rouge Complex', action: '🚗 Supplying Gasoline to Ford Plants', buildingId: 'fordRougeComplex', x: 420, y: 320 },
      { location: 'Central Train Station', action: '💵 Wiring This Month\'s Monopoly Rents', buildingId: 'trainStation', x: 1180, y: 720 },
    ],
  },
  vanderbilt: {
    name: 'Cornelius Vanderbilt',
    homeCity: 'sapporo',
    schedule: [
      { location: 'Central Train Station', action: '🚂 Auditing New Track Expansion Plans', buildingId: 'trainStation', x: 920, y: 720 },
      { location: 'Alpine Snow Brewery', action: '⚓ Auditing Freight Manifests at the Brewery Docks', buildingId: 'sapporoBrewery', x: 440, y: 720 },
      { location: 'Ford River Rouge Complex', action: '🤝 Negotiating Rail-Factory Partnership', buildingId: 'fordRougeComplex', x: 420, y: 320 },
    ],
  },
  gates: {
    name: 'Bill Gates',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Tokyo Stock Exchange', action: '💻 Pitching MS Office Enterprise Deals', buildingId: 'stockExchange', x: 820, y: 320 },
      { location: 'Parliament Hall', action: '⚖️ Defending Windows OS Antitrust Case', buildingId: 'parliament', x: 1280, y: 1000 },
      { location: 'Apple Glass Campus', action: '👀 Observing Apple Design Philosophy', buildingId: 'appleHQ', x: 330, y: 1360 },
    ],
  },
  bezos: {
    name: 'Jeff Bezos',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Tokyo Stock Exchange', action: '📦 Announcing AWS Cloud Expansion', buildingId: 'stockExchange', x: 840, y: 320 },
      { location: 'Musk Industries', action: '🤖 Testing Amazon Delivery Drones', buildingId: 'muskHQ', x: 1180, y: 1400 },
      { location: 'Bank & Realty Office', action: '💰 Reviewing Prime Credit Card Float', buildingId: 'bank', x: 1400, y: 1000 },
    ],
  },
  son: {
    name: 'Masayoshi Son',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Tokyo Stock Exchange', action: '📱 Pitching SoftBank Vision Fund II', buildingId: 'stockExchange', x: 830, y: 320 },
      { location: 'Apple Glass Campus', action: '💡 Scouting AI Startup Founders', buildingId: 'appleHQ', x: 336, y: 1360 },
      { location: 'Musk Industries', action: '🚀 Co-Investing SpaceX Series Round', buildingId: 'muskHQ', x: 1170, y: 1400 },
    ],
  },
  icahn: {
    name: 'Carl Icahn',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Tokyo Stock Exchange', action: '⚔️ Filing Hostile Takeover Prospectus', buildingId: 'stockExchange', x: 844, y: 320 },
      { location: 'Parliament Hall', action: '💼 Greenmail Negotiation with Board', buildingId: 'parliament', x: 1296, y: 1000 },
      { location: 'Corporate Holdings', action: '📋 Stripping Underperforming Assets', buildingId: 'corporateOffice', x: 620, y: 1000 },
    ],
  },
  dalio: {
    name: 'Ray Dalio',
    homeCity: 'kyoto',
    schedule: [
      { location: 'Machiya Executive Estate', action: '🌦️ Calibrating All-Weather Portfolio', buildingId: 'machiyaEstate', x: 456, y: 320 },
      { location: 'Serenity Park', action: '🧘 Practicing Principles Meditation', buildingId: 'park', x: 1350, y: 320 },
      { location: 'IRS Internal Revenue', action: '📊 Filing Bridgewater Macro Projections', buildingId: 'irsHQ', x: 896, y: 760 },
    ],
  },
  simons: {
    name: 'Jim Simons',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Tokyo Stock Exchange', action: '🔢 Running Medallion HFT Algorithms', buildingId: 'stockExchange', x: 836, y: 320 },
      { location: 'Bank & Realty Office', action: '📡 Accessing Central Bank Data Feeds', buildingId: 'bank', x: 1390, y: 1000 },
      { location: 'Crypto HQ', action: '💻 Expanding Quant Research Servers', buildingId: 'cryptoExchange', x: 326, y: 1360 },
    ],
  },
  lynch: {
    name: 'Peter Lynch',
    homeCity: 'kyoto',
    schedule: [
      { location: 'Cherry Coke Tea House', action: '☕ Spotting Consumer Trend Opportunities', buildingId: 'teaHouse', x: 810, y: 320 },
      { location: 'Silk & Kimono Market', action: '🏪 Researching Convenience Store Stocks', buildingId: 'silkMarket', x: 1080, y: 1160 },
      { location: 'Machiya Executive Estate', action: '📈 Presenting 10-Bagger Fund Results', buildingId: 'machiyaEstate', x: 470, y: 320 },
    ],
  },
  walker: {
    name: 'Madam C.J. Walker',
    homeCity: 'osaka',
    schedule: [
      { location: 'Kuromon Fish Market', action: '💼 Expanding Door-to-Door Sales Network', buildingId: 'fishMarket', x: 740, y: 640 },
      { location: 'Dotonbori Arcade', action: '🌟 Recruiting Female Sales Agents', buildingId: 'dotonboriArcade', x: 1070, y: 240 },
      { location: 'Speakeasy Hotel', action: '🤝 Pitching Haircare Empire to Investors', buildingId: 'speakeasyHotel', x: 790, y: 240 },
    ],
  },
  jpmorgan: {
    name: 'J.P. Morgan',
    homeCity: 'tokyo',
    schedule: [
      { location: 'Tokyo Stock Exchange', action: '🏦 Organizing Emergency Market Bailout', buildingId: 'stockExchange', x: 850, y: 320 },
      { location: 'Bank & Realty Office', action: '💰 Meeting with Central Bankers', buildingId: 'bank', x: 1376, y: 1000 },
      { location: 'Corporate Holdings', action: '📋 Consolidating Steel & Rail Trusts', buildingId: 'corporateOffice', x: 630, y: 1000 },
    ],
  },
  escobar: {
    name: 'Pablo Escobar',
    homeCity: 'osaka',
    schedule: [
      { location: 'Dock Underground Vaults', action: '🌿 Inspecting Medellin Cocaine Shipments', buildingId: 'dockVaults', x: 390, y: 640 },
      { location: 'Speakeasy Hotel', action: '🍷 Brokering Syndicate Deals with Capone', buildingId: 'speakeasyHotel', x: 804, y: 240 },
      { location: 'Dotonbori Arcade', action: '🎲 Laundering Dirty Cartel Cash', buildingId: 'dotonboriArcade', x: 1096, y: 240 },
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
      // currentX/currentY (legacy space), currentBuildingId/nextBuildingId,
      // and stepProgress are unused by any current caller now that
      // OverworldScene.js's updateNamedRoamers reads sprite positions from
      // worldPresenceEngine.js instead (see this file's header comment) -
      // kept for shape/back-compat since this function has no callers to
      // update but is not being deleted.
      currentX: Math.min(1560, Math.max(40, lerpX)),
      currentY: Math.min(1760, Math.max(40, lerpY)),
      currentAction: currentStep.action,
      currentLocation: currentStep.location,
      currentCity: routine.homeCity,
      currentBuildingId: currentStep.buildingId || null,
      nextBuildingId: nextStep.buildingId || null,
      stepProgress: progress,
    }
  })
}
