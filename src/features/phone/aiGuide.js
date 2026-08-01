// AI guide layer for the phone's Guide app (Nova) - same OpenAI Responses
// API integration pattern as src/features/finance/aiNarrator.js (same model/
// endpoint/timeout, same "resolves to null on any failure, never throws"
// contract), but built for one-shot player Q&A about game mechanics rather
// than narrating a single event. Reads VITE_OPENAI_API_KEY from the Vite
// env (see project .env, gitignored) - if unset, or the request fails for
// any reason, the caller (GuideApp.jsx) falls back to a canned tip instead.
const OPENAI_URL = 'https://api.openai.com/v1/responses'
const MODEL = 'gpt-5.6-luna'
const REQUEST_TIMEOUT_MS = 8000
const MAX_TOKENS = 220
const MAX_CHARS = 700

// Concise system-level game knowledge, not exhaustive - covers "what is X
// for" at the level a new player actually needs, not full mechanic specs.
// Update this if a major new system ships and players would plausibly ask
// Nova about it.
const SYSTEM_PROMPT = `You are Nova, a friendly in-game AI guide inside the phone overlay of "Capital Syndicate: Financial Reality Engine," a dark-neon cyberpunk-Tokyo financial sandbox game. Answer the player's question about game mechanics using ONLY the reference below. Keep answers to 2-4 short sentences, warm and encouraging tone, no markdown. If asked about something outside the game, gently redirect back to game topics in one sentence.

GAME REFERENCE:
- Core loop: press End Day to advance the day, tick the market, and resolve pending effects. Net worth (cash + stocks + crypto) is the real win condition - reach $10,000,000 to win, with a 5-tier milestone ladder along the way ($50k/$250k/$1M/$5M/$10M).
- Bank & Realty building: deposit/withdraw cash (deposited cash is "protected" from being seized on a failed crime), take/repay loans, Work Shift for guaranteed pay, Rob Vault for a risky payout, and buy Real Estate or acquire Companies for passive daily income - the last four (Work/Rob/Real Estate/Companies) only work by physically visiting the building, not from the phone.
- Stock Exchange building/phone tab: buy/sell/short stocks and crypto (ShrimpCoin). Trades use a timing meter - clicking Execute in the green zone gets a better price.
- Casino: Slots, Blackjack, Poker, Roulette, and Russian Roulette - all balanced to the same house edge so no one game is strictly best.
- The Underworld building (standalone only, not on the phone): Black Market, Call Center Ops, Crime Alley, Speakeasy Hotel, plus Hitman Contracts, Syndicate Ops, and Narcotics trading elsewhere in the world - all raise Wanted Level/notoriety if you get caught.
- Getting arrested sends you to Capital City Central Booking: pay bail outright, try bribing the desk (costs cash, capped success), or risk the escape maze (free but the only path that raises Wanted Level further on failure) which can lead to the Underworld through a back tunnel.
- Temple: pray for a Luck blessing, or embezzle for quick cash at some notoriety risk.
- Wharf (Bonded Cargo Pier): a fishing minigame, with an honest-or-fraudulent choice on each catch.
- Entertainment Complex: Concert Hall (arrow-key rhythm minigame) and Sports Stadium (alternating-key sprint race against AI runners), both skill-based.
- The phone has 3 apps: Social/X (news feed, plus posting to nudge market sentiment once per day), Banking & Portfolio (a Portfolio tab showing everything you own, plus Bank & Realty deposits/loans and the Stock Exchange), and Contacts (people you're dating, married to, or recruited as financial advisors - they show up automatically once you have a relationship, no manual add).
- Recruiting financial-titan advisors for passive income and dating/marrying NPCs both happen by walking up to them in the overworld and interacting.
- Wanted Level/notoriety rise from crimes and cool down over time; high Wanted Level increases police encounter risk and jail chances on future crimes.`

function buildFallback(question) {
  const q = (question || '').toLowerCase()
  if (q.includes('win') || q.includes('net worth')) {
    return "The real win condition is reaching $10,000,000 net worth (cash + stocks + crypto) - watch the milestone ladder in your Portfolio tab for progress."
  }
  if (q.includes('jail') || q.includes('arrest')) {
    return 'Got arrested? Head to the Booking Desk to pay bail or try a bribe, or risk the escape maze - just know a failed maze attempt is the one path that raises your Wanted Level further.'
  }
  if (q.includes('bank') || q.includes('loan')) {
    return "The Bank & Realty building handles deposits, withdrawals, and loans - but Work Shift, Rob Vault, Real Estate, and Company acquisitions only work if you're actually standing in the building."
  }
  return "I'm having trouble connecting right now, but here's a start: press End Day often to keep the market and your income ticking, and check the Portfolio tab any time you want a full picture of what you own."
}

/**
 * Asks Nova a single question about game mechanics. Never throws - resolves
 * to the generated answer string on success, or a canned fallback tip
 * (never null) on any failure, since GuideApp.jsx always needs something to
 * show the player.
 */
export async function askGuide(question) {
  try {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    if (!apiKey) return buildFallback(question)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let res
    try {
      res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          input: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: question },
          ],
          reasoning: { effort: 'none' },
          max_output_tokens: MAX_TOKENS,
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!res || !res.ok) return buildFallback(question)

    const data = await res.json()
    const messageItem = data?.output?.find((item) => item.type === 'message')
    const textPart = messageItem?.content?.find((part) => part.type === 'output_text')
    const text = textPart?.text?.trim()
    if (!text) return buildFallback(question)

    return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS - 1)}…` : text
  } catch {
    return buildFallback(question)
  }
}
