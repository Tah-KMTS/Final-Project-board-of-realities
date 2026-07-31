// Optional AI-flavor layer for the Titan Feed (see agentEngine.js /
// useGameStore.js's endDay()). Reads VITE_OPENAI_API_KEY from the Vite env
// (see project .env, gitignored) - if that var is unset/empty, or the
// request fails/times out/errors for ANY reason, this module resolves to
// null and the caller keeps showing the existing templated event text.
// This is a progressive-enhancement layer, not a dependency: the game must
// work identically with no key present, and endDay() itself never awaits
// this call (see the fire-and-forget usage in useGameStore.js).
// Responses endpoint, not Chat Completions - this project's OpenAI key only
// has access to gpt-5.6-luna via /v1/responses (verified against the API;
// gpt-4o-mini and any /v1/chat/completions call 403 on this key's model
// allowlist - see backend/main.py's matching note for the NPC-chat backend,
// which hit the same wall and already uses /v1/responses).
const OPENAI_URL = 'https://api.openai.com/v1/responses'
const MODEL = 'gpt-5.6-luna'
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
 * event via OpenAI's Responses API. Never throws - resolves to the
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
          model: MODEL,
          input: [
            {
              role: 'system',
              content: 'You write single punchy in-fiction market-news sentences for a finance-world board game. Respond with exactly one sentence. No quotes, no markdown, no hashtags.',
            },
            { role: 'user', content: prompt },
          ],
          reasoning: { effort: 'none' },
          max_output_tokens: MAX_TOKENS,
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!res || !res.ok) return null

    const data = await res.json()
    // Responses API shape: data.output is an array of items; the text lives
    // in the first 'message' item's content array, as an 'output_text' part
    // (there's no output_text convenience field outside the Python/JS SDKs,
    // which this plain fetch call doesn't use).
    const messageItem = data?.output?.find((item) => item.type === 'message')
    const textPart = messageItem?.content?.find((part) => part.type === 'output_text')
    const text = textPart?.text?.trim()
    if (!text) return null

    return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS - 1)}…` : text
  } catch {
    // Network error, AbortError from the timeout, malformed JSON, or
    // anything else - fall back silently, exactly as if there were no key.
    return null
  }
}
