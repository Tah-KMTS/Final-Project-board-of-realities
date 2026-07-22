// Client for the free-text NPC interaction backend (see backend/main.py).
// The Python process is the only thing that ever talks to OpenAI - this
// file just POSTs the player's text and the NPC's reply comes back.
//
// Requires the backend running locally: `npm run dev:backend`
// (uvicorn backend.main:app --reload --port 8000). If it's not running,
// or the request fails for any reason, this resolves to a graceful
// in-character-ish fallback instead of throwing, so the dialogue UI never
// crashes because the Python process isn't up.

const NPC_CHAT_URL = 'http://localhost:8000/npc-interact'

const FALLBACK_REPLY = "(...they don't seem to hear you. Try again in a moment.)"

/**
 * @param {object} params
 * @param {string} params.npcId
 * @param {string} params.playerText
 * @param {number} [params.relationshipTier] - 0-100
 * @param {{role: 'player'|'npc', text: string}[]} [params.conversationHistory]
 * @returns {Promise<{ reply: string, ok: boolean, error?: string }>}
 */
export async function sendNpcMessage({ npcId, playerText, relationshipTier = 0, conversationHistory = [] }) {
  try {
    const res = await fetch(NPC_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npcId, playerText, relationshipTier, conversationHistory }),
    })

    if (!res.ok) {
      const detail = await res.json().catch(() => null)
      throw new Error(detail?.detail || `Backend responded with ${res.status}`)
    }

    const data = await res.json()
    if (!data?.reply) throw new Error('Backend returned no reply')

    return { reply: data.reply, ok: true }
  } catch (err) {
    return {
      reply: FALLBACK_REPLY,
      ok: false,
      error: err?.message || String(err),
    }
  }
}
