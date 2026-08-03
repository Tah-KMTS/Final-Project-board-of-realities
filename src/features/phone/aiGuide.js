// AI guide layer for the phone's Guide app (Aria). Used to call OpenAI
// directly from the browser with a VITE_-prefixed key - that key ships
// inside the client bundle in production (any VITE_* env var does), so
// anyone with devtools could read it straight out of the shipped JS. Now
// routes through the same backend every other NPC free-text chat already
// uses (see src/utils/npcChatClient.js -> backend/main.py's /guide-ask),
// which is the only thing that ever holds the real key.
//
// Requires the backend running locally: `npm run dev:backend` (or
// `npm run dev:all` to run both at once). If it's not running, or the
// request fails for any reason, this resolves to a canned fallback tip
// instead of throwing, so GuideApp.jsx always has something to show.
const GUIDE_ASK_URL = 'http://localhost:8091/guide-ask'
const REQUEST_TIMEOUT_MS = 8000

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
 * Asks Aria a single question about game mechanics. Never throws - resolves
 * to the generated answer string on success, or a canned fallback tip
 * (never null) on any failure, since GuideApp.jsx always needs something to
 * show the player.
 */
export async function askGuide(question) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let res
    try {
      res = await fetch(GUIDE_ASK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!res || !res.ok) return buildFallback(question)

    const data = await res.json()
    const text = data?.reply?.trim()
    return text || buildFallback(question)
  } catch {
    return buildFallback(question)
  }
}
