import { FINANCE_NPCS } from './financeNpcs'

// Archetype Strategy Descriptions
export const ARCHETYPE_PROFILES = {
  sovereign_banker: {
    name: 'Sovereign Banker',
    description: 'Leverages royal loans and gold reserves to control systemic credit.',
    preferredActions: ['sovereign_grant', 'credit_squeeze', 'bond_manipulation'],
  },
  monopolist: {
    name: 'Industrial Monopolist',
    description: 'Crushes competitors by controlling supply chains and essential infrastructure.',
    preferredActions: ['hostile_buyout', 'supply_squeeze', 'predatory_pricing'],
  },
  value_investor: {
    name: 'Value Investor',
    description: 'Seeks undervalued assets, margin of safety, and compounding interest.',
    preferredActions: ['value_buy', 'dividend_reinvest', 'contrarian_hold'],
  },
  macro_speculator: {
    name: 'Macro Speculator',
    description: 'Capitalizes on market reflexivity, currency raids, and market drops.',
    preferredActions: ['currency_short', 'bear_raid', 'volatility_boost'],
  },
  corporate_raider: {
    name: 'Corporate Raider',
    description: 'Launches aggressive hostile board takeovers and strips corporate assets.',
    preferredActions: ['board_raid', 'greenmail', 'asset_strip'],
  },
  tech_disruptor: {
    name: 'Tech Disruptor',
    description: 'Bets heavily on high-volatility breakthroughs, crypto hype, and AI hardware.',
    preferredActions: ['crypto_hype', 'tech_breakthrough', 'seed_grant'],
  },
}

const MOODS = ['Bullish', 'Bearish', 'Aggressive Raid', 'Defensive Hold', 'Opportunistic']

/**
 * Generates initial dynamic agent state for all 25 titans for a new playthrough.
 * Randomizes aggression, risk tolerance, rivalries, and initial mood so every game differs.
 */
export function initializeAgentsState() {
  const agentState = {}
  const npcIds = FINANCE_NPCS.map((n) => n.id)

  FINANCE_NPCS.forEach((npc) => {
    // Pick a random initial rival (not self)
    const availableRivals = npcIds.filter((id) => id !== npc.id)
    const randomRival = availableRivals[Math.floor(Math.random() * availableRivals.length)]

    agentState[npc.id] = {
      npcId: npc.id,
      aggression: parseFloat((0.2 + Math.random() * 0.75).toFixed(2)),
      riskTolerance: parseFloat((0.2 + Math.random() * 0.75).toFixed(2)),
      greed: parseFloat((0.3 + Math.random() * 0.65).toFixed(2)),
      rivalId: randomRival,
      currentMood: MOODS[Math.floor(Math.random() * MOODS.length)],
      capital: npc.netWorth,
      memories: [`Entered Capital Syndicate with initial wealth of $${npc.netWorth.toLocaleString()}.`],
      victories: 0,
      allies: [],
    }
  })

  return agentState
}

/**
 * Simulates daily inter-agent interactions during endDay().
 * Returns updated agent states and generated event logs.
 */
export function simulateDailyAgentInteractions(currentAgentsState, day) {
  const updatedAgents = { ...currentAgentsState }
  const eventFeed = []

  // Ensure state exists for all NPCs
  FINANCE_NPCS.forEach((npc) => {
    if (!updatedAgents[npc.id]) {
      const availableRivals = FINANCE_NPCS.map((n) => n.id).filter((id) => id !== npc.id)
      updatedAgents[npc.id] = {
        npcId: npc.id,
        aggression: 0.5,
        riskTolerance: 0.5,
        greed: 0.5,
        rivalId: availableRivals[Math.floor(Math.random() * availableRivals.length)],
        currentMood: 'Bullish',
        capital: npc.netWorth,
        memories: [],
        victories: 0,
        allies: [],
      }
    }
  })

  // Pick 2 to 4 active events for this day tick
  const activeNpcs = [...FINANCE_NPCS].sort(() => Math.random() - 0.5)
  const eventCount = Math.floor(Math.random() * 3) + 2

  for (let i = 0; i < eventCount && i < activeNpcs.length; i++) {
    const actorNpc = activeNpcs[i]
    const actorState = updatedAgents[actorNpc.id]
    const rivalNpc = FINANCE_NPCS.find((n) => n.id === actorState.rivalId) || activeNpcs[(i + 1) % activeNpcs.length]
    const rivalState = updatedAgents[rivalNpc.id]

    // Shift mood randomly 20% of the time
    if (Math.random() < 0.2) {
      actorState.currentMood = MOODS[Math.floor(Math.random() * MOODS.length)]
    }

    // Determine event action based on archetype & aggression
    if (actorState.aggression > 0.6 && Math.random() < 0.5) {
      // Hostile Action / Raid
      const raidImpact = Math.round(1000 + Math.random() * 9000)
      const eventText = `⚔️ ${actorNpc.name} launched a hostile market attack against ${rivalNpc.name}, shorting their positions for $${raidImpact.toLocaleString()}!`
      
      actorState.memories.unshift(`Day ${day}: Shorted ${rivalNpc.name}'s market assets for $${raidImpact.toLocaleString()}.`)
      if (rivalState) {
        rivalState.memories.unshift(`Day ${day}: Suffered a hostile market attack from ${actorNpc.name}.`)
        // Raid retaliation loop: the victim's rivalry reassigns to their
        // attacker, they get measurably more aggressive, and their mood is
        // forced to reflect just having been raided (separate from - and
        // additional to - the 20%-random mood reroll above, which only ever
        // touches the actor's own mood).
        rivalState.rivalId = actorNpc.id
        rivalState.aggression = Math.max(0, Math.min(1, rivalState.aggression + 0.12))
        rivalState.currentMood = 'Aggressive Raid'
      }
      actorState.victories += 1
      eventFeed.push({ id: `event_${day}_${i}`, day, type: 'raid', text: eventText, actorId: actorNpc.id, targetId: rivalNpc.id, raidImpact })
    } else if (actorState.riskTolerance > 0.6 && Math.random() < 0.5) {
      // High-Risk Tech / Crypto Surge
      const hypeDelta = Math.floor(Math.random() * 15) + 5
      const eventText = `🚀 ${actorNpc.name} poured massive capital into tech & crypto, driving market hype up by +${hypeDelta}%!`
      
      actorState.memories.unshift(`Day ${day}: Injected capital into high-volatility assets, boosting market hype +${hypeDelta}%.`)
      eventFeed.push({ id: `event_${day}_${i}`, day, type: 'hype', text: eventText, actorId: actorNpc.id, hypeDelta })
    } else {
      // Strategic Investment / Alliance
      const allyNpc = activeNpcs.find((n) => n.id !== actorNpc.id && n.id !== rivalNpc.id) || rivalNpc
      const eventText = `🤝 ${actorNpc.name} formed a strategic liquidity syndicate with ${allyNpc.name}.`
      
      actorState.memories.unshift(`Day ${day}: Formed strategic market syndicate with ${allyNpc.name}.`)
      if (!actorState.allies.includes(allyNpc.id)) actorState.allies.push(allyNpc.id)
      eventFeed.push({ id: `event_${day}_${i}`, day, type: 'alliance', text: eventText, actorId: actorNpc.id, targetId: allyNpc.id })
    }

    // Keep memory size capped at 10 items
    if (actorState.memories.length > 10) actorState.memories = actorState.memories.slice(0, 10)
  }

  return { updatedAgents, eventFeed }
}
