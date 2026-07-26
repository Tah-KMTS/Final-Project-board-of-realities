import { getSyndicateMemberSchedule } from '../../data/syndicate'
import { TIME_BLOCKS, simulateWorldPresence } from './worldPresenceEngine'

// House rule: this file used to be its OWN independent "where is this agent"
// simulation (bespoke buffett/musk/jobs specials, a flat LOCATIONS_LIST for
// everyone else, and `(day-1) % TIME_BLOCKS.length` block math) that never
// touched the map sprites - so a character's modal text and their actual
// on-map position routinely contradicted each other, and one full 5-block
// day-cycle took 5 in-game days instead of cycling within one. It is now a
// THIN ADAPTER over worldPresenceEngine.js (the single source of truth both
// sprites and this modal text read from) so those two views can never
// disagree again. It still exists, unchanged in name/signature/return
// shape, purely so useGameStore.js's endDay() and the two modals
// (AgentInteractionsModal.jsx, NamedNpcModal.jsx) keep working with zero
// changes on their end.
//
// `extraCtx` is an additive 4th parameter (optional, defaults to `{}`) - it
// doesn't change the original 3-arg call shape, it just carries the extra
// inputs worldPresenceEngine.js's contract requires (timeBlockIndex,
// runSeed, wantedLevel, heatByCharacter) that the old 3-arg signature had no
// room for. useGameStore.js (the only caller) passes these from its own
// clock/runSeed state.
export function simulateDynamicSchedules(agents, day, govState, extraCtx = {}) {
  const timeBlockIndex = normalizeBlockIndex(extraCtx.timeBlockIndex)
  const timeBlock = TIME_BLOCKS[timeBlockIndex]

  const ctx = {
    day,
    timeBlockIndex,
    runSeed: extraCtx.runSeed ?? 0,
    wantedLevel: extraCtx.wantedLevel ?? 0,
    heatByCharacter: extraCtx.heatByCharacter,
  }

  const presenceById = new Map(
    simulateWorldPresence(agents.map((agent) => agent.id), ctx).map((presence) => [presence.characterId, presence])
  )

  const updatedAgents = agents.map((agent) => {
    const presence = presenceById.get(agent.id)
    if (!presence) return { ...agent }

    const copy = {
      ...agent,
      currentLocation: presence.location,
      currentAction: presence.action,
      thoughtProcess: presence.thought,
    }

    // The 21 Crime Syndicate members keep syndicate.js's authored
    // action/thought flavor text (still canonical for these characters'
    // voice) layered on top of the engine's result - but never its
    // `location` string, which is free text that could disagree with the
    // buildingId worldPresenceEngine actually resolved (and therefore with
    // where the character's sprite/home building places them on the map).
    const syndicateSchedule = getSyndicateMemberSchedule(agent.id, timeBlock.key)
    if (syndicateSchedule) {
      copy.currentAction = syndicateSchedule.action
      copy.thoughtProcess = syndicateSchedule.thought
    }

    return copy
  })

  return {
    updatedAgents,
    timeBlockName: timeBlock.label,
  }
}

function normalizeBlockIndex(index) {
  const n = Number.isFinite(index) ? Math.trunc(index) : 0
  return ((n % TIME_BLOCKS.length) + TIME_BLOCKS.length) % TIME_BLOCKS.length
}
