import { getCharacterBiography } from './characterBiographies'
import {
  FINANCE_NPC_LINES,
  CRIME_NPC_LINES,
  PRESIDENT_NPC_LINES,
  FED_NPC_LINES,
  FTC_NPC_LINES
} from '../../data/financeDialogue'

const ALL_DIALOGUE = {
  ...FINANCE_NPC_LINES,
  ...CRIME_NPC_LINES,
  ...PRESIDENT_NPC_LINES,
  ...FED_NPC_LINES,
  ...FTC_NPC_LINES
};

/**
 * Context-Aware Dynamic Non-Predetermined AI Speech Engine.
 * Generates custom speech lines based on agent personality, recent events, relationship level, and location.
 * Uses the 76-character roster from financeDialogue.js.
 *
 * Mood/aggression tone layer: `agent.currentMood`/`agent.aggression` come from
 * world2.agentsState (per-Titan simulation in agentEngine.js, 0-1 aggression
 * scale, e.g. 'Aggressive Raid' after being raided) merged over NamedNpcModal's
 * generic fallback defaults ('Bullish Expansion' / 50, a 0-100-scale neutral
 * placeholder used by the 51 non-Titan characters who have no agentsState
 * entry at all). Both scales are normalized below so the same thresholds work
 * for real Titan data and the placeholder alike, and the placeholder always
 * lands below the "elevated" threshold so non-Titans see no behavior change.
 */
export function generateDynamicSpeech(agent, relationshipLevel, recentEvent, timeBlock) {
  const id = agent.id || agent.npcId;
  const bio = getCharacterBiography(id);
  const name = agent.name || 'Titan';

  const rawAggression = typeof agent.aggression === 'number' ? agent.aggression : 0.5;
  const aggression = rawAggression > 1 ? rawAggression / 100 : rawAggression;
  const isRaidMood = agent.currentMood === 'Aggressive Raid';
  const isHighAggression = aggression >= 0.75;
  const isElevatedAggression = !isHighAggression && aggression >= 0.6;

  // Applies a visible mood/aggression "tell" on top of whatever line the
  // relationship/context logic below produces. Raid mood takes priority
  // (it overrides the tone even for a romance/partner-tier line — the Titan
  // is still furious about the raid regardless of how they feel about the
  // player), then raw aggression level adds a lighter confrontational tell.
  const applyTone = (line) => {
    if (isRaidMood) {
      return `(still seething from the raid on their positions) ${line} — and do not think I have forgotten who profited from it.`;
    }
    if (isHighAggression) {
      return `${line} My patience is thin right now, so choose your next move carefully.`;
    }
    if (isElevatedAggression) {
      return `${line} I am watching the board closely — do not test me.`;
    }
    return line;
  };

  // Romance / Suitor Speech (Relationship >= 75)
  if (relationshipLevel >= 75) {
    if (id === 'buffett') return applyTone(`My dear partner, compound interest is wonderful, but spending time with you at the Kyoto diner is the best investment I have ever made.`)
    if (id === 'jobs') return applyTone(`You have an eye for elegance. Together, we are building something truly magical that changes the world.`)
    if (id === 'musk') return applyTone(`Forget Mars for a minute. You and I are the ultimate power couple in this market.`)
    if (id === 'blanco') return applyTone(`In this business, trust is rare. But with you by my side, we control all of Osaka's nightlife.`)
    if (id === 'jfk') return applyTone(`The journey ahead is challenging, but with your grace and intellect, victory is assured.`)
    if (id === 'gates') return applyTone(`I have analyzed every risk factor and the data is clear — you are the best partnership decision I have ever made.`)
    if (id === 'soros') return applyTone(`Reflexivity works in markets and in love. Our alliance creates a self-reinforcing cycle of power.`)
    if (id === 'bezos') return applyTone(`Two Day Delivery cannot compare to you. You are the Prime membership I never knew I needed.`)
    return applyTone(`My beloved partner, standing alongside you gives me total confidence in all our strategic moves.`)
  }

  // Business Partner Speech (Relationship 50-74)
  if (relationshipLevel >= 50) {
    if (id === 'munger') return applyTone(`Invert, always invert. Our combined strengths eliminate each other's blind spots — that is the edge.`)
    if (id === 'icahn') return applyTone(`I respect your aggressiveness. We should launch a joint hostile position on the next weak target.`)
    if (id === 'dalio') return applyTone(`Risk parity demands balance. Together we cover uncorrelated return streams — that is structural alpha.`)
    return applyTone(`Partnering with you has proven highly lucrative. Let us keep our capital aligned and capitalize on the next market shift.`)
  }

  // Professional Acquaintance Speech (Relationship 25-49)
  if (relationshipLevel >= 25) {
    return applyTone(`I respect your ambition in ${agent.currentCity || 'the city'}. Keep your risk managed and we may find common ground.`)
  }

  if (recentEvent) {
    return applyTone(`Have you heard about the latest market shift? ${recentEvent.text || 'Things are moving fast.'}`)
  }

  // Base Contextual Speech — unique per NPC (Relationship 0-24)
  const lines = ALL_DIALOGUE[id];
  if (lines && lines.length > 0) {
    const line = lines[Math.floor(Math.random() * lines.length)];
    return applyTone(typeof line === 'string' ? line : line.text);
  }

  return applyTone(`Welcome to ${agent.currentCity || 'Capital Syndicate'}. I am currently focusing on ${agent.currentAction || 'core strategic goals'}.`)
}
