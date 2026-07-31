// Optional AI-flavor layer for the Titan Feed (see agentEngine.js /
// useGameStore.js's endDay()). Reads VITE_OPENAI_API_KEY from the Vite env
// (see project .env, gitignored) - if that var is unset/empty, or the
// request fails/times out/errors for ANY reason, this module resolves to
// null and the caller keeps showing the existing templated event text.
// This is a progressive-enhancement layer, not a dependency: the game must
// work identically with no key present, and endDay() itself never awaits
// this call (see the fire-and-forget usage in useGameStore.js).
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const REQUEST_TIMEOUT_MS = 7000
const MAX_TOKENS = 70
// Defensive client-side cap in case the model ignores the max_tokens/prompt
// instruction and rambles - keeps a single Titan Feed line from blowing out
// the feed UI.
const MAX_CHARS = 220

function buildPrompt({ type, actorName, targetName, amount, archetypeDescription, fallbackText }) {
  const facts = [
    `Event type: ${type}`,
    actorName ? `Actor: ${actorName}${archetypeDescription ? ` (${archetypeDescription})` : ''}` : null,
    targetName ? `Target/counterparty: ${targetName}` : null,
    amount != null ? `Amount/impact: ${amount}` : null,
    fallbackText ? `Today's plain summary: "${fallbackText}"` : null,
  ].filter(Boolean).join('\n')

  return `Rewrite this financial-titan board game event as one vivid, varied in-fiction market-news sentence (max ~30 words). Keep the same facts, just make the prose fresh and punchy:\n${facts}`
}

/**
 * Generates a single punchy in-fiction market-news sentence for one titan
 * event via OpenAI's chat completions API. Never throws - resolves to the
 * generated string on success, or null on ANY failure (no key, network
 * error, timeout, non-2xx response, malformed body). Callers can safely do
 * `generateEventNarration(ctx).then((text) => { if (text) ... })` with no
 * try/catch of their own.
 */
export async function generateEventNarration(eventContext) {
  try {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    if (!apiKey) return null

    const prompt = buildPrompt(eventContext || {})

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
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You write single punchy in-fiction market-news sentences for a finance-world board game. Respond with exactly one sentence. No quotes, no markdown, no hashtags.',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: MAX_TOKENS,
          temperature: 0.9,
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!res || !res.ok) return null

    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content?.trim()
    if (!text) return null

    return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS - 1)}…` : text
  } catch {
    // Network error, AbortError from the timeout, malformed JSON, or
    // anything else - fall back silently, exactly as if there were no key.
    return null
  }
}
