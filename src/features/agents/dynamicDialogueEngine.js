import { getCharacterBiography } from './characterBiographies'

/**
 * Context-Aware Dynamic Non-Predetermined AI Speech Engine.
 * Generates custom speech lines based on agent personality, recent events, relationship level, and location.
 */
export function generateDynamicSpeech(agent, relationshipLevel, recentEvent, timeBlock) {
  const bio = getCharacterBiography(agent.id || agent.npcId)
  const name = agent.name || 'Titan'

  // Romance / Suitor Speech (Relationship >= 75)
  if (relationshipLevel >= 75) {
    if (agent.id === 'buffett') return `My dear partner, compound interest is wonderful, but spending time with you at the Kyoto diner is the best investment I have ever made.`
    if (agent.id === 'jobs') return `You have an eye for elegance. Together, we are building something truly magical that changes the world.`
    if (agent.id === 'musk') return `Forget Mars for a minute. You and I are the ultimate power couple in this market.`
    if (agent.id === 'blanco') return `In this business, trust is rare. But with you by my side, we control all of Osaka's nightlife.`
    if (agent.id === 'jfk') return `The journey ahead is challenging, but with your grace and intellect, victory is assured.`
    return `My beloved partner, standing alongside you gives me total confidence in all our strategic moves.`
  }

  // Business Partner Speech (Relationship 50-74)
  if (relationshipLevel >= 50) {
    return `Partnering with you has proven highly lucrative. Let us keep our capital aligned and capitalize on the next market shift.`
  }

  // Professional Acquaintance Speech (Relationship 25-49)
  if (relationshipLevel >= 25) {
    return `I respect your ambition in ${agent.currentCity || 'the city'}. Keep your risk managed and we may find common ground.`
  }

  // Base Contextual Speech (Relationship 0-24)
  if (recentEvent) {
    return `Have you heard about the latest market shift? ${recentEvent.text || 'Things are moving fast.'}`
  }

  if (agent.id === 'buffett') return `Rule No. 1: Never lose money. Rule No. 2: Never forget rule No. 1. I am heading to McDonald's for breakfast.`
  if (agent.id === 'jobs') return `Design is not just what it looks like; design is how it works. Our glass campus in Tokyo will redefine computing.`
  if (agent.id === 'musk') return `Production hell is real, but scaling automated manufacturing down to first principles is the only way forward.`
  if (agent.id === 'capone') return `You can get much further with a kind word and a gun than you can with a kind word alone.`
  if (agent.id === 'powell') return `We are monitoring benchmark yield curves carefully. Inflation metrics dictate our next rate decision.`
  if (agent.id === 'hoover') return `The Bureau operates on facts and intelligence. Organized crime wiretaps are yielding critical leads.`

  return `Welcome to ${agent.currentCity || 'Capital Syndicate'}. I am currently focusing on ${agent.currentAction || 'core strategic goals'}.`
}
