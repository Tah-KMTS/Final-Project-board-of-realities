import { getDisposition, getAllDispositions } from './characterDispositions'
import { resolvePresence } from './worldPresenceEngine'

// User decision: hidden characters must be discoverable via in-game intel -
// a hiding character is a hunt, not a dead end, and wanted bosses leak their
// location less often. worldPresenceEngine.js already computes exactly that
// leak chance per character per tick as `discoverable` (recluses and
// characters under heat leak less); this module turns that boolean into
// event-feed text - full "seen at" reveal when discoverable, an occasional
// rumor that never names the building otherwise.
const VAGUE_RUMOR_TEMPLATES = [
  (name) => `Word on the street: nobody's seen ${name} in days.`,
  (name) => `Rumor has it ${name} is keeping an unusually low profile right now.`,
  (name) => `Whispers place ${name} somewhere in the city, but nothing solid.`,
]

const VAGUE_RUMOR_CHANCE = 0.3

// Crime Syndicate members are the characters actually worth hunting (heat,
// hideouts, un-flee - see townMigrationEngine.js); everyone else is normally
// out and about, so defaulting to the full 88-character roster would flood
// the event feed with "seen at" noise for people nobody is trying to find.
function defaultTargetIds() {
  return getAllDispositions()
    .filter((d) => d.isCrime)
    .map((d) => d.id)
}

/**
 * Produces intel-feed entries for a set of characters (Crime Syndicate
 * members by default) for one (day, timeBlockIndex) instant.
 *
 * `ctx` should be the exact same { day, timeBlockIndex, runSeed, wantedLevel,
 * heatByCharacter } shape useGameStore.js's endDay() already builds for
 * simulateDynamicSchedules (see that call site) - resolvePresence is a pure
 * function of its inputs, so calling it again here with the identical ctx
 * reproduces the identical buildingId/discoverable result rather than
 * guessing at a second, possibly-contradictory location.
 */
export function generateIntelReports(characterIds, ctx = {}) {
  const ids = characterIds && characterIds.length ? characterIds : defaultTargetIds()
  const reports = []

  for (const id of ids) {
    const disposition = getDisposition(id)
    if (!disposition) continue

    const presence = resolvePresence(id, ctx)

    if (presence.discoverable) {
      reports.push({
        id: `intel_${ctx.day ?? 0}_${ctx.timeBlockIndex ?? 0}_${id}`,
        characterId: id,
        title: '🕵️ Street Intel',
        text: `Word on the street: ${disposition.name} was seen at ${presence.location}.`,
        revealed: true,
      })
    } else if (Math.random() < VAGUE_RUMOR_CHANCE) {
      const template = VAGUE_RUMOR_TEMPLATES[Math.floor(Math.random() * VAGUE_RUMOR_TEMPLATES.length)]
      reports.push({
        id: `intel_vague_${ctx.day ?? 0}_${ctx.timeBlockIndex ?? 0}_${id}`,
        characterId: id,
        title: '🕵️ Street Intel',
        text: template(disposition.name),
        revealed: false,
      })
    }
  }

  return reports
}
