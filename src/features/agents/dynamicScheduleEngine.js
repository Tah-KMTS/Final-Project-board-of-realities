/**
 * Dynamic AI Schedule & Event Reaction Engine for 76 Agents.
 */

const LOCATIONS_LIST = [
  'Financial District - Stock Exchange',
  "McDonald's & Cherry Coke Diner",
  'Apple Design Lab',
  'Ford Assembly Plant',
  'Underground Speakeasy Club',
  'Commercial District - Docks',
  'Government District - White House',
  'Government District - Fed Reserve',
  'Grand Central Transit Hub',
  'Serenity City Park',
]

const TIME_BLOCKS = ['Morning (8:00 AM)', 'Midday (12:00 PM)', 'Afternoon (4:00 PM)', 'Night (8:00 PM)', 'Midnight (12:00 AM)']

/**
 * Updates dynamic routines, locations, and actions for all 76 agents based on day, time, and world events.
 */
export function simulateDynamicSchedules(agents, day, govState) {
  const currentBlockIndex = (day - 1) % TIME_BLOCKS.length
  const currentBlockName = TIME_BLOCKS[currentBlockIndex]

  const updatedAgents = agents.map((agent) => {
    const copy = { ...agent }
    const rand = Math.random()

    // Warren Biffle Special Routine
    if (copy.id === 'buffett') {
      if (currentBlockIndex === 0 || currentBlockIndex === 1) {
        copy.currentLocation = "McDonald's & Cherry Coke Diner"
        copy.currentAction = 'Ordering $3.17 Bacon McMuffin & Sipping Cherry Coke'
        copy.thoughtProcess = 'Predictable low-cost breakfast fuels compound interest.'
      } else {
        copy.currentLocation = 'Financial District - Berkshire Office'
        copy.currentAction = 'Reading Financial Statements & Annual Reports'
        copy.thoughtProcess = 'Rule No. 1: Never lose money. Rule No. 2: Never forget rule No. 1.'
      }
      return copy
    }

    // Elan Rusk Routine
    if (copy.id === 'musk') {
      if (rand < 0.4) {
        copy.currentLocation = 'Giga Factory & Design Lab'
        copy.currentAction = 'Inspecting Automated Robot Assembly Lines'
        copy.thoughtProcess = 'Optimizing manufacturing throughput down to first principles.'
      } else {
        copy.currentLocation = 'Crypto Trading Hub'
        copy.currentAction = 'Posting Market Headlines & Memes'
        copy.thoughtProcess = 'Decentralized liquidity will outpace traditional fiat.'
      }
      return copy
    }

    // Steve Jobs Routine
    if (copy.id === 'jobs') {
      copy.currentLocation = 'Apple Design Lab'
      copy.currentAction = 'Perfecting Unibody Curved Glass Aesthetics'
      copy.thoughtProcess = 'Design is not just what it looks like; design is how it works.'
      return copy
    }

    // Crime Syndicates Routine (Capone, Luciano, Escobar, etc.)
    if (copy.category && copy.category.includes('Crime')) {
      if (currentBlockIndex >= 3) {
        copy.currentLocation = 'Underground Speakeasy Club'
        copy.currentAction = 'Counting Weekly Turf Tolls & Bribing Local Officials'
        copy.thoughtProcess = 'Keeping law enforcement compliant and protecting syndicate borders.'
      } else {
        copy.currentLocation = copy.homeBase || 'Syndicate Safehouse'
        copy.currentAction = 'Meeting with Capos & Reviewing Protection Rackets'
        copy.thoughtProcess = 'Expanding turf before rival syndicates make a move.'
      }
      return copy
    }

    // Federal Reserve & FTC Chairs Routine
    if (copy.category && (copy.category.includes('Fed') || copy.category.includes('FTC'))) {
      if (currentBlockIndex === 1 || currentBlockIndex === 2) {
        copy.currentLocation = copy.category.includes('Fed') ? 'Government District - Fed Reserve' : 'Government District - FTC HQ'
        copy.currentAction = copy.category.includes('Fed') ? 'Analyzing Benchmark Yield Curves' : 'Drafting Antitrust Subpoenas'
        copy.thoughtProcess = 'Evaluating macroeconomic stability vs corporate compliance.'
      } else {
        copy.currentLocation = 'Capitol Townhouse'
        copy.currentAction = 'Reviewing Economic Intelligence Briefings'
        copy.thoughtProcess = 'Preparing for upcoming regulatory testimony.'
      }
      return copy
    }

    // Generic Agent Routine Rotation
    if (rand < 0.3) {
      copy.currentLocation = LOCATIONS_LIST[Math.floor(rand * LOCATIONS_LIST.length)]
      copy.currentAction = 'Traveling between city districts'
      copy.thoughtProcess = 'Monitoring local commerce and evaluating new opportunities.'
    } else if (rand < 0.7) {
      copy.currentLocation = copy.favoriteHangout || 'Financial District'
      copy.currentAction = 'Conducting daily operations'
      copy.thoughtProcess = 'Executing core strategic objectives.'
    } else {
      copy.currentLocation = copy.homeBase || 'Private Residence'
      copy.currentAction = 'Resting & Planning Next Move'
      copy.thoughtProcess = 'Resting before the next trading session.'
    }

    return copy
  })

  return {
    updatedAgents,
    timeBlockName: currentBlockName,
  }
}
