// Second batch of real TTS voice generation - covers every remaining named
// character across Finance, Crime Syndicate, Presidents, Fed Chairmen, FTC
// Chairmen, and Famous Agency Leaders who was still sharing a placeholder/
// borrowed audio file. Every id below is unique and gets its own file, so no
// two characters play the same clip. Same OpenAI gpt-4o-mini-tts pipeline as
// scripts/generate-voice-lines.mjs (kept separate so the first 20 already-
// generated lines are not re-billed/re-rendered). Run with:
//   node --env-file=.env scripts/generate-voice-lines-batch2.mjs

import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '..', 'public', 'audio', 'voice')

const API_KEY = process.env.OPENAI_API_KEY
if (!API_KEY) {
  console.error('OPENAI_API_KEY is not set. Run with: node --env-file=.env scripts/generate-voice-lines-batch2.mjs')
  process.exit(1)
}

// 10 gpt-4o-mini-tts timbres exist (alloy, ash, ballad, coral, echo, fable,
// onyx, nova, sage, shimmer, verse) for 84 characters, so timbres repeat -
// every repeat carries a distinct `instructions` delivery style so no two
// characters actually sound alike, matching the differentiation pattern
// already used in generate-voice-lines.mjs (Pegasus/Biffle both on 'fable',
// Marik/Kaiba/Vanderbilt both on 'onyx').
const LINES = [
  // ─── Finance Titans (remaining 23; buffett/vanderbilt/musk/marks already real) ───
  { id: 'finance_mansamusa_intro', voice: 'onyx', instructions: 'Regal, booming, ancient imperial authority - slower and more resonant than a robber baron growl.', text: "Gold is not merely wealth; it is the lifeblood of nations. My treasury funded mosque spires from Timbuktu to Cairo. Seek true leverage, not petty coins." },
  { id: 'finance_fugger_intro', voice: 'verse', instructions: 'Shrewd, calculating European banker - formal, precise diction.', text: "Popes and Emperors bow to the man who holds the ledger. I financed Charles V's election. Are you ready to command sovereign credit?" },
  { id: 'finance_rothschild_intro', voice: 'sage', instructions: 'Quiet, secretive confidence - speaks like every word is already profitable.', text: "Information moves faster than armies. My courier reached London before Wellington's own dispatch. He who hears the news first owns the market." },
  { id: 'finance_hamilton_intro', voice: 'ash', instructions: 'Fast-talking, intense, ambitious young statesman - words tumble out under pressure.', text: "A national debt, if it is not excessive, will be to us a national blessing. Credit creates power — without it, ambition is just chaos." },
  { id: 'finance_rockefeller_intro', voice: 'onyx', instructions: 'Cold, controlled, methodical - flat affect, never raises volume.', text: "Competition is a sin. Control the refinery, control the pipelines, and the market is yours by morning." },
  { id: 'finance_carnegie_intro', voice: 'verse', instructions: 'Thrifty, philosophical, faint Scottish cadence - warm but calculating.', text: "Cost reduction is the mother of all profit. Master the Bessemer process and the steel flows like water — cheap water." },
  { id: 'finance_jpmorgan_intro', voice: 'onyx', instructions: 'Gravelly, commanding old-money authority - short, final sentences.', text: "Character is the basis of money. I would not lend to a man I did not trust for all the gold in Christendom." },
  { id: 'finance_ford_intro', voice: 'ballad', instructions: 'Plain-spoken Midwestern practicality - unhurried, matter-of-fact.', text: "Pay your workers enough to buy what they build. That is not charity; it is market expansion and basic arithmetic." },
  { id: 'finance_walker_intro', voice: 'nova', instructions: 'Warm but firm self-made pride - steady conviction, no apology.', text: "I got my start by giving myself a start. No one handed me anything. I created a system that empowered thousands of other women." },
  { id: 'finance_graham_intro', voice: 'verse', instructions: 'Academic, measured, professorial - deliberate pacing like a lecture.', text: "In the short run, the market is a voting machine. In the long run, it is a weighing machine. Patience is the only edge." },
  { id: 'finance_livermore_intro', voice: 'ash', instructions: "Sharp, fast, gambler's edge - clipped and restless.", text: "There is only one side of the stock market and it is not the bull side or the bear side — it is the right side." },
  { id: 'finance_templeton_intro', voice: 'sage', instructions: 'Calm, contrarian, faintly reverent - unhurried and serene.', text: "The time of maximum pessimism is the best time to buy. Everyone was selling in 1939 — I bought every European stock I could." },
  { id: 'finance_munger_intro', voice: 'onyx', instructions: 'Dry, blunt, curmudgeonly wit - deadpan delivery.', text: "It is remarkable how much long-term advantage people like us have gotten by trying to be consistently not stupid." },
  { id: 'finance_lynch_intro', voice: 'nova', instructions: "Upbeat, chatty, enthusiastic - talks fast like he's excited to tell you a secret.", text: "Go for a business that any idiot can run — because sooner or later, any idiot is going to run it. I found ten-baggers in shopping malls." },
  { id: 'finance_soros_intro', voice: 'verse', instructions: 'Faint Central European cadence, philosophical and calculating - deliberate, weighing every word.', text: "I'm only rich because I know when I'm wrong. Markets are reflective, biased, and absolutely ready to be broken." },
  { id: 'finance_dalio_intro', voice: 'sage', instructions: 'Systematic, calm, principle-driven - even and unemotional.', text: "Pain plus reflection equals progress. You must understand the economic machine to navigate the cycle." },
  { id: 'finance_simons_intro', voice: 'coral', instructions: 'Quiet, precise, mathematical - understated and exact.', text: "We do not guess. We analyze high-frequency price signals and let raw mathematics extract absolute alpha from the market." },
  { id: 'finance_icahn_intro', voice: 'ash', instructions: 'Aggressive New York bluntness - fast, confrontational.', text: "In takeovers, if you want a friend, get a dog. I unlock value by shaking up lazy, entrenched boardrooms." },
  { id: 'finance_jobs_intro', voice: 'echo', instructions: 'Intense, minimalist, visionary - quiet then suddenly emphatic.', text: "People don't know what they want until you show it to them. We don't do market research. We create realities." },
  { id: 'finance_gates_intro', voice: 'coral', instructions: 'Nerdy, analytical, matter-of-fact - precise and a little clipped.', text: "A computer on every desk and in every home. Software is the highest margin product ever conceived by human intelligence." },
  { id: 'finance_bezos_intro', voice: 'ballad', instructions: 'Booming confident energy - big laugh lurking under every sentence.', text: "Your margin is my opportunity. We reinvest every single dollar back into scale, infrastructure, and obsessive customer service." },
  { id: 'finance_huang_intro', voice: 'echo', instructions: 'Confident, energetic charisma - fast and enthusiastic, leather-jacket swagger.', text: "Accelerated computing is the engine of the modern world. Parallel processing has rendered traditional CPUs functionally obsolete." },
  { id: 'finance_son_intro', voice: 'fable', instructions: "Visionary urgency, big-picture intensity - speaks like he's already three decades ahead.", text: "I look 300 years into the future. High risk is the price of total technology domination. I write the checks others are afraid to write." },

  // ─── Crime Syndicate (21) ───
  { id: 'crime_capone_intro', voice: 'onyx', instructions: 'Brash, commanding Chicago boss - booming and self-assured.', text: "You can get much further with a kind word and a gun than you can with a kind word alone. Remember that." },
  { id: 'crime_nitti_intro', voice: 'echo', instructions: 'Cold, quiet enforcer menace - flat and unhurried.', text: "The Enforcer doesn't negotiate. He delivers. You got a problem with the Outfit, you got a problem with me." },
  { id: 'crime_ricca_intro', voice: 'sage', instructions: 'Calculating quiet strategist - measured, never raises his voice.', text: "The Brain never acts without thinking three moves ahead. Every decision is a chess match. Are you a pawn or a player?" },
  { id: 'crime_luciano_intro', voice: 'ballad', instructions: 'Smooth, organizational, businesslike - persuasive and composed.', text: "I created the Commission so the families could stop killing each other and start making real money together." },
  { id: 'crime_genovese_intro', voice: 'onyx', instructions: 'Possessive, sharp, controlling - clipped and territorial.', text: "They call me The Don for a reason. I've outmaneuvered everyone who ever tried to take my seat." },
  { id: 'crime_costello_intro', voice: 'verse', instructions: "Diplomatic, smooth 'Prime Minister' tone - polished and unhurried.", text: "I am the Prime Minister of the underworld. I solve problems diplomatically — until diplomacy becomes impossible." },
  { id: 'crime_lansky_intro', voice: 'coral', instructions: "Precise accountant's calm - quiet, exact, unemotional.", text: "We're bigger than U.S. Steel. I'm not exaggerating — I ran the numbers. The Syndicate's cash flow beats most nations." },
  { id: 'crime_siegel_intro', voice: 'ash', instructions: 'Manic, grandiose, volatile - fast and theatrical, on the edge of unhinged.', text: "I'm building something in the Nevada desert that'll change everything. They call me crazy. In five years they'll call it Vegas." },
  { id: 'crime_cohen_intro', voice: 'echo', instructions: 'Defiant, tough West Coast edge - fast and combative.', text: "I run the West Coast operation. California is mine from San Francisco to San Diego. Don't test that claim." },
  { id: 'crime_escobar_intro', voice: 'verse', instructions: 'Faint Colombian cadence, intense and fatalistic - slow, deliberate menace.', text: "I will not rest until every dollar this country owes me is paid in blood or in cash. Plata o plomo." },
  { id: 'crime_gaviria_intro', voice: 'sage', instructions: 'Calm logistics-minded background operator - quiet competence.', text: "Pablo is the face. I am the infrastructure. The routes, the contacts, the logistics — that's me." },
  { id: 'crime_ochoa_intro', voice: 'coral', instructions: 'Meticulous financial architect - precise, understated.', text: "Money laundering is an art form. Every peso that enters clean assets — that is my signature." },
  { id: 'crime_blanco_intro', voice: 'shimmer', instructions: 'Sharp, dangerous, female - cold confidence, faintly amused by threats.', text: "They call me the Black Widow. Three husbands. All three are dead. The fourth man who crosses me will join them." },
  { id: 'crime_osvaldo_intro', voice: 'nova', instructions: 'Controlled, ruthless - even-toned but unmistakably threatening.', text: "The Griselda Empire doesn't negotiate from weakness. We negotiate from total market dominance." },
  { id: 'crime_dixon_intro', voice: 'shimmer', instructions: 'Smooth nightlife-front charisma - sultry and unbothered.', text: "Nightlife is the front. The club, the music, the lights — it's cover for the real operation underneath." },
  { id: 'crime_lepke_intro', voice: 'onyx', instructions: 'Businesslike, transactional menace - flat, procedural delivery.', text: "I run industrial extortion like a business — contracts, invoices, payment schedules. Murder is just the enforcement clause." },
  { id: 'crime_anastasia_intro', voice: 'echo', instructions: 'Flat, terrifying calm - almost bureaucratic about violence.', text: "I am Lord High Executioner. That is not a metaphor. I have personally handled more contracts than any man alive." },
  { id: 'crime_weiss_intro', voice: 'ash', instructions: 'Clipped, professional hitman tone - short sentences, no wasted words.', text: "I lead the hit squad. We are organized, precise, and professional. We do not leave loose ends." },
  { id: 'crime_rothstein_intro', voice: 'ballad', instructions: 'Smooth gambler-fixer charm - confident and unbothered.', text: "I fixed the 1919 World Series. Do you understand what that means? I bent the national pastime to my will." },
  { id: 'crime_waxey_intro', voice: 'ash', instructions: 'Fast-talking rum-runner hustle - quick and streetwise.', text: "I ran rum from Canada to New York during Prohibition. Every drop that hit Manhattan passed through my hands." },
  { id: 'crime_remus_intro', voice: 'verse', instructions: "Articulate, legalistic bootlegger - precise like a defense attorney's closing argument.", text: "I was a defense attorney before I became a bootlegger. I knew every law I was breaking — in precise legal detail." },

  // ─── US Presidents (10) ───
  { id: 'president_washington_intro', voice: 'onyx', instructions: 'Formal, dignified 18th-century gravitas - measured and unhurried.', text: "Guard against the impostures of pretended patriotism. I built this republic on discipline and sacrifice, not rhetoric." },
  { id: 'president_lincoln_intro', voice: 'verse', instructions: 'Plainspoken, folksy gravity - warm but weighty pauses.', text: "No man has a good enough memory to be a successful liar. This Union was built on hard truths, not comfortable ones." },
  { id: 'president_fdr_intro', voice: 'fable', instructions: 'Confident, reassuring, patrician warmth - steady fireside cadence.', text: "The only thing we have to fear is fear itself. This nation will not be paralyzed by crisis — we will build our way out." },
  { id: 'president_jfk_intro', voice: 'ash', instructions: 'Crisp, energetic, inspirational - brisk New England cadence.', text: "Ask not what your country can do for you — ask what you can do for your country. Then go to the moon." },
  { id: 'president_reagan_intro', voice: 'ballad', instructions: 'Warm, folksy, confident storyteller - affable but firm.', text: "Government is not the solution to our problem — government is the problem. Cut the rate, free the market." },
  { id: 'president_tr_intro', voice: 'onyx', instructions: 'Booming, energetic, larger-than-life - fast and emphatic.', text: "Speak softly and carry a big stick. The trust-busters are coming for every monopolist in this room." },
  { id: 'president_jefferson_intro', voice: 'sage', instructions: 'Thoughtful Enlightenment intellectual - measured, philosophical.', text: "I hold it that a little rebellion now and then is a good thing. The tree of liberty must be refreshed from time to time." },
  { id: 'president_eisenhower_intro', voice: 'verse', instructions: 'Plainspoken military gravity - calm, direct, weighing his words.', text: "Beware the military-industrial complex. I know it well — I built it. Now I am warning you about what it becomes." },
  { id: 'president_obama_intro', voice: 'coral', instructions: 'Measured, articulate, deliberate cadence - thoughtful pauses before key words.', text: "Change will not come if we wait for some other person or some other time. We are the ones we have been waiting for." },
  { id: 'president_clinton_intro', voice: 'ballad', instructions: 'Warm Southern charm, folksy persuasion - easy and conversational.', text: "There is nothing wrong with America that cannot be cured by what is right with America. Build the surplus, run the boom." },

  // ─── Federal Reserve Chairmen (10) ───
  { id: 'fed_volcker_intro', voice: 'onyx', instructions: 'Gravelly, blunt, no-nonsense - low and imposing.', text: "Inflation is like toothpaste. Once it's out you can hardly get it back in again. I raised rates to 20% and I would do it again." },
  { id: 'fed_greenspan_intro', voice: 'sage', instructions: 'Deliberately ambiguous, dry academic mumble - careful and evasive.', text: "If I seem unduly clear to you, you must have misunderstood what I said. The Maestro speaks in deliberate ambiguity." },
  { id: 'fed_bernanke_intro', voice: 'coral', instructions: 'Calm academic precision - measured, professorial.', text: "The U.S. government has a technology, called a printing press. We can drop money from helicopters if necessary." },
  { id: 'fed_yellen_intro', voice: 'nova', instructions: 'Careful, empathetic economist - measured warmth.', text: "The labor market is not yet back to its pre-pandemic strength. I will hold rates until workers are actually working." },
  { id: 'fed_powell_intro', voice: 'verse', instructions: 'Composed central-banker gravity - steady and deliberate.', text: "We are moving expeditiously to bring inflation back down. My credibility and the Fed's credibility are on the line." },
  { id: 'fed_eccles_intro', voice: 'ballad', instructions: 'Populist conviction, plainspoken - firm and grounded.', text: "As mass production has to be accompanied by mass consumption, mass consumption requires a distribution of wealth to provide purchasing power." },
  { id: 'fed_martin_intro', voice: 'onyx', instructions: 'Stern, adult-in-the-room authority - firm and unhurried.', text: "The Federal Reserve's job is to take away the punch bowl just as the party gets going. Someone has to be the adult." },
  { id: 'fed_burns_intro', voice: 'sage', instructions: 'Wry, defensive academic - measured with an edge of justification.', text: "The Nixon administration wanted easy money and they got it. I provided the liquidity. History has opinions about that." },
  { id: 'fed_miller_intro', voice: 'coral', instructions: 'Brisk, matter-of-fact - short tenure, no time to waste.', text: "I served 18 months as Fed Chair. That is enough time to understand what the role requires. I moved on to Treasury." },
  { id: 'fed_meyer_intro', voice: 'verse', instructions: 'Old-school banking formality - precise, institutional.', text: "The Federal Reserve's primary obligation is to the solvency of the commercial banking system. Everything else follows from that." },

  // ─── FTC Chairmen (10) ───
  { id: 'ftc_khan_intro', voice: 'nova', instructions: 'Sharp, confident reformer - fast, assertive, unapologetic.', text: "The FTC was created to stop exactly what Amazon, Google, and Meta are doing right now. I am just enforcing the mandate properly." },
  { id: 'ftc_ramirez_intro', voice: 'coral', instructions: 'Precise consumer-protection focus - measured and exact.', text: "Mergers that eliminate head-to-head competition harm consumers even when the market looks big on paper." },
  { id: 'ftc_simons_intro', voice: 'echo', instructions: 'Direct, focused enforcer - brisk and matter-of-fact.', text: "Big Tech has acquired over 500 companies in the past decade. My job is to review what that concentration means for competition." },
  { id: 'ftc_muris_intro', voice: 'ash', instructions: 'Data-driven, aggressive prosecutor tone - fast and pointed.', text: "Fraud costs American consumers billions annually. My approach is data-driven, evidence-based, and aggressive." },
  { id: 'ftc_pertschuk_intro', voice: 'verse', instructions: 'Crusading consumer advocate - firm, principled cadence.', text: "Consumer protection is not anti-business. It is pro-market. Fraud and deception destroy the trust markets need to function." },
  { id: 'ftc_kirkpatrick_intro', voice: 'sage', instructions: 'Formal disclosure-era regulator - measured, institutional.', text: "Transparency in corporate governance prevents the insider trading and stock pool manipulation that destroyed investor confidence in the 1920s." },
  { id: 'ftc_kovacic_intro', voice: 'coral', instructions: 'Global-minded, methodical - precise and international in tone.', text: "International cartels are the most sophisticated form of market manipulation. They cross borders. So must our enforcement." },
  { id: 'ftc_majoras_intro', voice: 'nova', instructions: 'Careful retrospective analyst - measured, exacting.', text: "Retrospective merger review catches what prospective review misses. The harm became clear only after the deal closed." },
  { id: 'ftc_leibowitz_intro', voice: 'ash', instructions: 'Pointed anti-cartel prosecutor - fast, indignant energy.', text: "Pay-for-delay settlements in pharmaceuticals are legalized market manipulation. They cost consumers billions per year." },
  { id: 'ftc_pitofsky_intro', voice: 'verse', instructions: 'Scholarly antitrust authority - measured, professorial.', text: "Vertical integration creates market power that horizontal merger review completely misses. The Standard Oil model never died." },

  // ─── Famous Agency Leaders: SEC / FBI / IRS / DOD / EPA (10) ───
  { id: 'agency_kennedysec_intro', voice: 'ballad', instructions: 'Wry ex-swindler turned regulator - confident, knowing smirk in the voice.', text: "It takes a stock swindler to catch one. I ran the pools myself before I was appointed to police them — nobody outmaneuvers me." },
  { id: 'agency_douglassec_intro', voice: 'verse', instructions: 'Rugged outdoorsman turned jurist - plainspoken and sturdy.', text: "I came from the mountains of Washington State to the exchange floors of New York. Both taught me the same lesson: never trust a smooth incline." },
  { id: 'agency_levittsec_intro', voice: 'coral', instructions: 'Patient institution-builder - measured, veteran calm.', text: "The individual investor is not a rounding error. Every rule I wrote at the SEC started with that one sentence." },
  { id: 'agency_hoover_intro', voice: 'onyx', instructions: 'Controlled, ominous bureaucratic power - flat and watchful.', text: "I built this Bureau from a filing cabinet of unsolved cases into the most feared law enforcement organization in the world. I intend to keep it that way." },
  { id: 'agency_mueller_intro', voice: 'echo', instructions: 'Terse, methodical G-man - clipped and unemotional.', text: "I don't do theater. I do casework — methodical, documented, and airtight by the time it reaches a courtroom." },
  { id: 'agency_caplin_intro', voice: 'sage', instructions: 'Modernizing technocrat - brisk and precise.', text: "Kennedy told me to modernize this agency, so I put every taxpayer record onto a computer before most of Washington knew what a computer was." },
  { id: 'agency_andrews_intro', voice: 'ash', instructions: 'Blunt, outspoken reformer - fast, unapologetic.', text: "I reorganized this agency into regional audit districts because a single office in Washington cannot see what's happening in every state at once." },
  { id: 'agency_mcnamara_intro', voice: 'coral', instructions: 'Systems-analysis precision - crisp, data-driven cadence.', text: "Every dollar of defense spending should survive a systems analysis, the same as any other capital allocation. Sentiment is not a procurement strategy." },
  { id: 'agency_marshall_intro', voice: 'onyx', instructions: 'Quiet military-logistics authority - steady, understated gravity.', text: "I organized the largest industrial mobilization in this nation's history, then spent the peace rebuilding what the war destroyed. Both were the same job." },
  { id: 'agency_ruckelshaus_intro', voice: 'verse', instructions: 'Principled regulator - firm, calm conviction.', text: "I signed the first federal orders against industrial polluters when no one else in government was willing to. Someone had to be willing to be unpopular." },
]

async function generateLine({ id, voice, text, instructions }, attempt = 1) {
  try {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice,
        input: text,
        response_format: 'mp3',
        ...(instructions ? { instructions } : {}),
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`${id} (${voice}) failed: ${res.status} ${body}`)
    }

    const buffer = Buffer.from(await res.arrayBuffer())
    const outPath = path.join(OUT_DIR, `${id}.mp3`)
    await writeFile(outPath, buffer)
    console.log(`✓ ${id}.mp3 (${(buffer.length / 1024).toFixed(1)} KB)`)
  } catch (err) {
    if (attempt < 3) {
      console.warn(`  retry ${id} (attempt ${attempt + 1}): ${err.message}`)
      await new Promise((r) => setTimeout(r, 1500 * attempt))
      return generateLine({ id, voice, text, instructions }, attempt + 1)
    }
    throw err
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  let done = 0
  for (const line of LINES) {
    // eslint-disable-next-line no-await-in-loop
    await generateLine(line)
    done += 1
  }
  console.log(`\nDone. ${done}/${LINES.length} voice lines written to ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
