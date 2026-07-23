// Flavor-only daily news ticker for the "End Day" loop. Purely cosmetic -
// none of these headlines drive market prices or state, they just sell the
// Capital Syndicate world as alive from one day to the next.

export const NEWS_HEADLINES = [
  'Analysts baffled as retail investors pile into meme assets — again.',
  "Central bank signals 'patience'; markets read it as permission to panic.",
  'Anonymous whistleblower alleges accounting irregularities at a major conglomerate.',
  'Neon Dragon Casino reports a record night as high rollers chase their losses.',
  "SEC opens inquiry into 'unusual trading patterns' across several small-cap names.",
  'Startup unicorn writes down its valuation by 80% overnight.',
  "Crypto influencer's 'guaranteed' coin rugs followers within hours.",
  'City council debates zoning for the new Financial District skyline.',
  "Underground fixer network reportedly expanding 'reputation laundering' services.",
  'Temple donations spike as speculators seek better karma before earnings season.',
  "Tabloids speculate on the identity of the district's richest new face.",
  'Parliament passes a vague new disclosure rule; lawyers rejoice.',
  'Black market chatter suggests a big move is coming before the bell.',
  'Hotel bar rumor mill: someone in this city is about to make — or lose — a fortune.',
  'Arcade high-score boards mysteriously dominated by a single set of initials.',
  'Howard Marks memo leaks early: "You cannot predict. You can prepare."',
  'Call center scam ring busted two districts over — locals shrug.',
  'Vanderbilt Rail Co. stock spikes on rumors of a hostile takeover.',
  "Rusk Industries teases 'something big.' Markets have heard this before.",
]

export function rollHeadline() {
  return NEWS_HEADLINES[Math.floor(Math.random() * NEWS_HEADLINES.length)]
}
