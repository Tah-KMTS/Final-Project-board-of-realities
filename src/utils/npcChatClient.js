// Client for the free-text NPC interaction backend (see backend/main.py).
// The Python process is the only thing that ever talks to OpenAI - this
// file just POSTs the player's text and the NPC's reply comes back.
//
// Requires the backend running locally: `npm run dev:backend`
// (uvicorn backend.main:app --reload --port 8079 - not 8000, which is
// already in use by other local services on dev machines). If it's not
// running, or the request fails for any reason, this resolves to a
// graceful in-character-ish fallback instead of throwing, so the dialogue
// UI never crashes because the Python process isn't up.

const NPC_CHAT_URL = 'http://localhost:8079/npc-interact'

const FALLBACK_REPLY = "(...they don't seem to hear you. Try again in a moment.)"

/**
 * @param {object} params
 * @param {string} params.npcId
 * @param {string} params.playerText
 * @param {number} [params.relationshipTier] - 0-100
 * @param {{role: 'player'|'npc', text: string}[]} [params.conversationHistory]
 * @param {object|null} [params.character] - roster + biography data (see
 *   characterLookup.js / characterBiographies.js) for the Capital Syndicate
 *   roster, so the backend builds the persona from real data instead of a
 *   hand-written one. Omit for worlds using the backend's static personas
 *   (Hunter's Rift, King of Games).
 * @returns {Promise<{ reply: string, ok: boolean, agreed: boolean|null, relationshipDelta: number, error?: string }>}
 *   `agreed`/`relationshipDelta` reflect whether this specific character was
 *   persuaded by the player's message and how it moved their opinion;
 *   `agreed` is null (not false) when the request failed, so callers can
 *   tell "declined" apart from "we don't know".
 */
export async function sendNpcMessage({ npcId, playerText, relationshipTier = 0, conversationHistory = [], character = null }) {
  try {
    const res = await fetch(NPC_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npcId, playerText, relationshipTier, conversationHistory, character }),
    })

    if (!res.ok) {
      const detail = await res.json().catch(() => null)
      throw new Error(detail?.detail || `Backend responded with ${res.status}`)
    }

    const data = await res.json()
    if (!data?.reply) throw new Error('Backend returned no reply')

    return {
      reply: data.reply,
      ok: true,
      agreed: typeof data.agreed === 'boolean' ? data.agreed : false,
      relationshipDelta: typeof data.relationshipDelta === 'number' ? data.relationshipDelta : 0,
    }
  } catch (err) {
    return {
      reply: FALLBACK_REPLY,
      ok: false,
      agreed: null,
      relationshipDelta: 0,
      error: err?.message || String(err),
    }
  }
}
