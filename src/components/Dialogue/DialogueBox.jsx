import { useEffect, useRef, useState } from 'react'
import { playTalkBlip } from '../../audio/voiceBlip'

const CHAR_INTERVAL_MS = 22

// Reusable NPC dialogue box: typewriter text reveal, backed by either a real
// generated voice-line audio file (for load-bearing character-intro
// moments - see scripts/generate-voice-lines.mjs) or a per-character retro
// "talk blip" (voiceBlip.js) fallback for everything else. `lines` entries
// may be a plain string (blip-only) or `{ text, audioSrc }` (real voice).
// Advances one line per click; click/Enter/Space skips the typewriter or
// advances to the next line. Calls onDone after the last line is dismissed.
export default function DialogueBox({ speaker, portrait, voiceId = 'default', lines, onDone }) {
  const [lineIndex, setLineIndex] = useState(0)
  const [shown, setShown] = useState('')
  const [typing, setTyping] = useState(true)
  const timerRef = useRef(null)
  const audioRef = useRef(null)

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

  return (
    <div
      onClick={advance}
      className="mb-4 cursor-pointer select-none border-2 border-yellow-300/60 bg-black/60 p-3 shadow-[0_0_12px_rgba(253,224,71,0.15)] transition-shadow hover:shadow-[0_0_18px_rgba(253,224,71,0.3)]"
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
  )
}
