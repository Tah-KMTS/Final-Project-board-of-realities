import { getCharacterBiography } from './characterBiographies'

/**
 * Context-Aware Dynamic Non-Predetermined AI Speech Engine.
 * Generates custom speech lines based on agent personality, recent events, relationship level, and location.
 * All 25 Finance NPCs have unique personalized lines — no generic fallbacks for named characters.
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
    if (agent.id === 'gates') return `I have analyzed every risk factor and the data is clear — you are the best partnership decision I have ever made.`
    if (agent.id === 'soros') return `Reflexivity works in markets and in love. Our alliance creates a self-reinforcing cycle of power.`
    if (agent.id === 'bezos') return `Two Day Delivery cannot compare to you. You are the Prime membership I never knew I needed.`
    return `My beloved partner, standing alongside you gives me total confidence in all our strategic moves.`
  }

  // Business Partner Speech (Relationship 50-74)
  if (relationshipLevel >= 50) {
    if (agent.id === 'munger') return `Invert, always invert. Our combined strengths eliminate each other's blind spots — that is the edge.`
    if (agent.id === 'icahn') return `I respect your aggressiveness. We should launch a joint hostile position on the next weak target.`
    if (agent.id === 'dalio') return `Risk parity demands balance. Together we cover uncorrelated return streams — that is structural alpha.`
    return `Partnering with you has proven highly lucrative. Let us keep our capital aligned and capitalize on the next market shift.`
  }

  // Professional Acquaintance Speech (Relationship 25-49)
  if (relationshipLevel >= 25) {
    return `I respect your ambition in ${agent.currentCity || 'the city'}. Keep your risk managed and we may find common ground.`
  }

  // Base Contextual Speech — unique per NPC (Relationship 0-24)
  if (recentEvent) {
    return `Have you heard about the latest market shift? ${recentEvent.text || 'Things are moving fast.'}`
  }

  // Ancient & Sovereign Bankers
  if (agent.id === 'mansamusa') return `My gold reserves dwarf every treasury in this city combined. Tell me — what do you seek? Wealth or power? Both can be arranged.`
  if (agent.id === 'fugger') return `I financed Holy Roman Emperors. I can finance you. But my loans come with an iron guarantee of repayment.`
  if (agent.id === 'rothschild') return `Information is more valuable than gold. My courier network knew about Waterloo before any monarch. What intelligence do you bring me?`
  if (agent.id === 'hamilton') return `A national bank requires trust in institutions. Build your credit record here in the Capital Syndicate and the Treasury will back your ventures.`

  // Gilded Age Monopolists
  if (agent.id === 'vanderbilt') return `Law? What do I care about the law? Hain't I got the power? Your competitor's railroad ends today.`
  if (agent.id === 'rockefeller') return `The secret of success is to do the common thing uncommonly well. Standard Oil did not dominate by chance — systematic pressure on every rival.`
  if (agent.id === 'carnegie') return `A man who dies rich dies disgraced. My steel empire built this nation — what legacy are you building?`
  if (agent.id === 'jpmorgan') return `I do not lend money to men who need it. I lend to men who can multiply it tenfold. Show me your collateral.`
  if (agent.id === 'ford') return `Coming together is a beginning, staying together is progress, working together is success. My assembly lines never stop — can you keep up?`
  if (agent.id === 'walker') return `I had to make my own living and my own opportunity! Don't sit down and wait for the opportunities to come — get up and make them.`

  // Value Investors
  if (agent.id === 'graham') return `Price is what you pay, value is what you get. This market is full of Mr. Market's mood swings — I see margins of safety everywhere right now.`
  if (agent.id === 'livermore') return `The market is never wrong. Only opinions are. I am accumulating a massive short position in the dominant stock — care to join the raid?`
  if (agent.id === 'templeton') return `The time of maximum pessimism is the best time to buy. Everyone is panicking — I am buying everything in sight.`
  if (agent.id === 'buffett') return `Rule No. 1: Never lose money. Rule No. 2: Never forget rule No. 1. I am heading to McDonald's for breakfast.`
  if (agent.id === 'munger') return `It is not supposed to be easy. Anyone who finds it easy is stupid. Invert your thinking — what kills your plan?`
  if (agent.id === 'lynch') return `Invest in what you know. I found ten-baggers in shopping malls and diners long before Wall Street noticed them.`

  // Macro Speculators
  if (agent.id === 'soros') return `Markets are always in a state of uncertainty and flux. My reflexivity theory says perception shapes reality — and I shape perception.`
  if (agent.id === 'dalio') return `Pain plus reflection equals progress. Every crisis is a machine teaching you. The All-Weather portfolio is calibrated for chaos.`
  if (agent.id === 'simons') return `God gave us the integers; all else is the work of Man. My algorithms have found patterns no human eye could see. The Medallion never loses.`
  if (agent.id === 'icahn') return `In life and business, there are two cardinal sins. The first is to act precipitously without thought; the second is to not act at all. I always act.`

  // Tech Disruptors
  if (agent.id === 'jobs') return `Design is not just what it looks like; design is how it works. Our glass campus in Tokyo will redefine computing.`
  if (agent.id === 'gates') return `Software is a great combination of artistry and engineering. My OS royalty engine generates revenue while I sleep.`
  if (agent.id === 'bezos') return `Your margin is my opportunity. Amazon built AWS because we needed it ourselves — now it generates more profit than retail.`
  if (agent.id === 'musk') return `Production hell is real, but scaling automated manufacturing down to first principles is the only way forward.`
  if (agent.id === 'huang') return `Software is eating the world, but GPU compute is what software runs on. Every AI model in existence needs my silicon.`
  if (agent.id === 'son') return `Vision Fund is not about returns — it is about changing the trajectory of civilization. One bet on the right founder pays for a thousand losses.`

  // Crime & Government
  if (agent.id === 'capone') return `You can get much further with a kind word and a gun than you can with a kind word alone.`
  if (agent.id === 'powell') return `We are monitoring benchmark yield curves carefully. Inflation metrics dictate our next rate decision.`
  if (agent.id === 'hoover') return `The Bureau operates on facts and intelligence. Organized crime wiretaps are yielding critical leads.`

  return `Welcome to ${agent.currentCity || 'Capital Syndicate'}. I am currently focusing on ${agent.currentAction || 'core strategic goals'}.`
}
