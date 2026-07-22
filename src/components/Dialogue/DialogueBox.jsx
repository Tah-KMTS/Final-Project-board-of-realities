import { useEffect, useRef, useState } from 'react'
import { playTalkBlip } from '../../audio/voiceBlip'
import { sendNpcMessage } from '../../utils/npcChatClient'

const CHAR_INTERVAL_MS = 22

// Reusable NPC dialogue box: typewriter text reveal, backed by either a real
// generated voice-line audio file (for load-bearing character-intro
// moments - see scripts/generate-voice-lines.mjs) or a per-character retro
// "talk blip" (voiceBlip.js) fallback for everything else. `lines` entries
// may be a plain string (blip-only) or `{ text, audioSrc }` (real voice).
// Advances one line per click; click/Enter/Space skips the typewriter or
// advances to the next line. Calls onDone after the last line is dismissed.
//
// Pass `npcId` to also render a free-text chat input below the scripted
// lines: the player can type anything and it's sent to the local FastAPI
// backend (backend/main.py) for a live, in-character LLM reply, alongside
// whatever fixed choice buttons the parent modal already renders.
// `relationshipTier` (0-100) is forwarded so the backend can gate romantic
// content by how well the NPC knows the player.
export default function DialogueBox({
  speaker,
  portrait,
  voiceId = 'default',
  lines,
  onDone,
  npcId = null,
  relationshipTier = 0,
}) {
  const [lineIndex, setLineIndex] = useState(0)
  const [shown, setShown] = useState('')
  const [typing, setTyping] = useState(true)
  const timerRef = useRef(null)
  const audioRef = useRef(null)

  const [chatHistory, setChatHistory] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState(false)

  const currentLine = lines[lineIndex]
  const fullLine = typeof currentLine === 'string' ? currentLine : currentLine?.text || ''
  const audioSrc = typeof currentLine === 'object' ? currentLine.audioSrc : null

  useEffect(() => {
    setShown('')
    setTyping(true)

    if (audioSrc) {
      const audio = new Audio(audioSrc)
      audioRef.current = audio
      audio.play().catch(() => {})
    }

    let i = 0
    timerRef.current = setInterval(() => {
      i += 1
      setShown(fullLine.slice(0, i))
      if (!audioSrc && i % 2 === 0 && fullLine[i - 1] && fullLine[i - 1] !== ' ') playTalkBlip(voiceId)
      if (i >= fullLine.length) {
        clearInterval(timerRef.current)
        setTyping(false)
      }
    }, CHAR_INTERVAL_MS)
    return () => {
      clearInterval(timerRef.current)
      audioRef.current?.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineIndex, fullLine, audioSrc])

  const advance = () => {
    if (typing) {
      clearInterval(timerRef.current)
      setShown(fullLine)
      setTyping(false)
      return
    }
    if (lineIndex + 1 < lines.length) {
      setLineIndex((i) => i + 1)
    } else {
      onDone?.()
    }
  }

  const submitChat = async (e) => {
    e.preventDefault()
    const text = chatInput.trim()
    if (!text || chatLoading || !npcId) return

    const historyForRequest = chatHistory.map((h) => ({ role: h.role, text: h.text }))
    setChatHistory((h) => [...h, { role: 'player', text }])
    setChatInput('')
    setChatLoading(true)
    setChatError(false)

    const { reply, ok } = await sendNpcMessage({
      npcId,
      playerText: text,
      relationshipTier,
      conversationHistory: historyForRequest,
    })

    setChatHistory((h) => [...h, { role: 'npc', text: reply }])
    setChatError(!ok)
    setChatLoading(false)
  }

  return (
    <div className="mb-4">
      <div
        onClick={advance}
        className="cursor-pointer select-none border-2 border-yellow-300/60 bg-black/60 p-3 shadow-[0_0_12px_rgba(253,224,71,0.15)] transition-shadow hover:shadow-[0_0_18px_rgba(253,224,71,0.3)]"
      >
        <div className="mb-1 flex items-center gap-2">
          {portrait && <span className="text-lg leading-none">{portrait}</span>}
          <span className="text-xs font-bold uppercase tracking-wide text-yellow-300">{speaker}</span>
        </div>
        <p className="min-h-[2.5em] text-sm text-gray-200">
          {shown}
          <span className={typing ? 'animate-pulse' : 'invisible'}>▌</span>
        </p>
        <div className="mt-1 text-right text-[10px] text-gray-500">
          {typing ? 'click to skip' : lineIndex + 1 < lines.length ? 'click to continue ▸' : 'click to close ▸'}
        </div>
      </div>

      {npcId && (
        <div className="mt-2 border-2 border-cyan-400/40 bg-black/60 p-3">
          {chatHistory.length > 0 && (
            <div className="mb-2 max-h-40 overflow-y-auto pr-1">
              {chatHistory.map((turn, i) => (
                <p
                  key={i}
                  className={`mb-1 text-xs ${turn.role === 'player' ? 'text-cyan-300' : 'text-gray-200'}`}
                >
                  <span className="font-bold uppercase">{turn.role === 'player' ? 'You' : speaker}: </span>
                  {turn.text}
                </p>
              ))}
              {chatError && (
                <p className="text-[10px] italic text-red-400">
                  (Couldn't reach the NPC chat backend - is it running? See backend/README.md.)
                </p>
              )}
            </div>
          )}
          <form onSubmit={submitChat} className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={`Say something to ${speaker}...`}
              disabled={chatLoading}
              maxLength={500}
              className="flex-1 border-2 border-cyan-400/60 bg-black/70 px-2 py-1 text-xs text-white placeholder:text-gray-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={chatLoading || !chatInput.trim()}
              className="border-2 border-cyan-400 px-3 py-1 text-xs font-bold text-cyan-300 hover:bg-cyan-400 hover:text-black disabled:opacity-30"
            >
              {chatLoading ? '...' : 'Send'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
