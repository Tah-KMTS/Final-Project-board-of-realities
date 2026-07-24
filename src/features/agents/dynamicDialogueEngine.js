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
 */
export function generateDynamicSpeech(agent, relationshipLevel, recentEvent, timeBlock) {
  const id = agent.id || agent.npcId;
  const bio = getCharacterBiography(id);
  const name = agent.name || 'Titan';

  // Romance / Suitor Speech (Relationship >= 75)
  if (relationshipLevel >= 75) {
    if (id === 'buffett') return `My dear partner, compound interest is wonderful, but spending time with you at the Kyoto diner is the best investment I have ever made.`
    if (id === 'jobs') return `You have an eye for elegance. Together, we are building something truly magical that changes the world.`
    if (id === 'musk') return `Forget Mars for a minute. You and I are the ultimate power couple in this market.`
    if (id === 'blanco') return `In this business, trust is rare. But with you by my side, we control all of Osaka's nightlife.`
    if (id === 'jfk') return `The journey ahead is challenging, but with your grace and intellect, victory is assured.`
    if (id === 'gates') return `I have analyzed every risk factor and the data is clear — you are the best partnership decision I have ever made.`
    if (id === 'soros') return `Reflexivity works in markets and in love. Our alliance creates a self-reinforcing cycle of power.`
    if (id === 'bezos') return `Two Day Delivery cannot compare to you. You are the Prime membership I never knew I needed.`
    return `My beloved partner, standing alongside you gives me total confidence in all our strategic moves.`
  }

  // Business Partner Speech (Relationship 50-74)
  if (relationshipLevel >= 50) {
    if (id === 'munger') return `Invert, always invert. Our combined strengths eliminate each other's blind spots — that is the edge.`
    if (id === 'icahn') return `I respect your aggressiveness. We should launch a joint hostile position on the next weak target.`
    if (id === 'dalio') return `Risk parity demands balance. Together we cover uncorrelated return streams — that is structural alpha.`
    return `Partnering with you has proven highly lucrative. Let us keep our capital aligned and capitalize on the next market shift.`
  }

  // Professional Acquaintance Speech (Relationship 25-49)
  if (relationshipLevel >= 25) {
    return `I respect your ambition in ${agent.currentCity || 'the city'}. Keep your risk managed and we may find common ground.`
  }

  if (recentEvent) {
    return `Have you heard about the latest market shift? ${recentEvent.text || 'Things are moving fast.'}`
  }

  // Base Contextual Speech — unique per NPC (Relationship 0-24)
  const lines = ALL_DIALOGUE[id];
  if (lines && lines.length > 0) {
    const line = lines[Math.floor(Math.random() * lines.length)];
    return typeof line === 'string' ? line : line.text;
  }

  return `Welcome to ${agent.currentCity || 'Capital Syndicate'}. I am currently focusing on ${agent.currentAction || 'core strategic goals'}.`
}
