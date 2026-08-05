import { useCallback, useEffect, useRef, useState } from 'react'
import { PANEL_W, PANEL_H } from './cutscenePanels'
import { playTalkBlip } from '../../audio/voiceBlip'
import {
  playClickSound,
  playDefeatSound,
  playPurchaseSound,
  playQuestCompleteSound,
  playVictorySound,
} from '../../audio/sfx'

// Shared cutscene engine: a procedurally-drawn panel on top, a typewriter
// dialogue box underneath. Both the opening (IntroCutscene.jsx) and the
// ending (EndingCutscene.jsx) are this component with a different script
// and paint function - they were one file until the ending was added, and
// duplicating 180 lines of typewriter/rAF/keyboard plumbing to change the
// words was not worth it.
//
// Props:
//   script    - array of { panel, speaker, text, sfx? } (see *Script.js)
//   speakers  - id -> { label, color, voice, italic? } map
//   paint     - (ctx, panelKey, tSeconds) => void
//   onDone    - called once, when the last line is dismissed OR skipped
//   skipLabel - text for the skip button

const CHAR_INTERVAL_MS = 26
// A blip on every character is a machine-gun at 26ms; every 3rd matches
// the rate the rest of the game's DialogueBox lands on.
const BLIP_EVERY = 3

const SFX = {
  defeat: playDefeatSound,
  purchase: playPurchaseSound,
  questComplete: playQuestCompleteSound,
  victory: playVictorySound,
}

export default function CutscenePlayer({ script, speakers, paint, onDone, skipLabel = 'SKIP ▸' }) {
  const [index, setIndex] = useState(0)
  const [shown, setShown] = useState('')
  const [typing, setTyping] = useState(true)
  // Drives the black dip between panel changes. Purely cosmetic; the
  // dialogue underneath keeps typing through it.
  const [fade, setFade] = useState(0)

  const canvasRef = useRef(null)
  const typeTimer = useRef(null)
  const rafRef = useRef(0)
  // Wall-clock ms at which the CURRENT panel first appeared - the painters
  // take seconds-since-panel-start, so this must survive line advances
  // within one panel and reset only when the panel key changes.
  const panelStartRef = useRef(performance.now())

  const line = script[index]
  const speaker = speakers[line.speaker] || Object.values(speakers)[0]
  const isLast = index >= script.length - 1
  const panelKey = line.panel

  // --- panel animation loop ---
  // A single rAF that repaints the active panel every frame. Keyed on
  // panelKey only: advancing a line inside the same panel must not restart
  // the clock, or the chart animations would stutter back to zero.
  useEffect(() => {
    panelStartRef.current = performance.now()
    setFade(1)

    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false

    let alive = true
    const frame = () => {
      if (!alive) return
      const t = (performance.now() - panelStartRef.current) / 1000
      paint(ctx, panelKey, t)
      setFade(Math.max(0, 1 - t / 0.22)) // 220ms dip-to-black on entry
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)

    return () => {
      alive = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [panelKey, paint])

  // --- typewriter ---
  useEffect(() => {
    setShown('')
    setTyping(true)
    SFX[line.sfx]?.()

    let i = 0
    typeTimer.current = setInterval(() => {
      i += 1
      setShown(line.text.slice(0, i))
      if (i % BLIP_EVERY === 0 && line.text[i - 1] && line.text[i - 1] !== ' ') {
        playTalkBlip(speaker.voice)
      }
      if (i >= line.text.length) {
        clearInterval(typeTimer.current)
        setTyping(false)
      }
    }, CHAR_INTERVAL_MS)

    return () => clearInterval(typeTimer.current)
    // speaker.voice is derived from `line`; index is what actually advances.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  const advance = useCallback(() => {
    if (typing) {
      clearInterval(typeTimer.current)
      setShown(line.text)
      setTyping(false)
      return
    }
    if (isLast) {
      onDone()
      return
    }
    playClickSound()
    setIndex((i) => i + 1)
  }, [typing, isLast, line.text, onDone])

  const skip = useCallback(() => {
    playClickSound()
    onDone()
  }, [onDone])

  // Keyboard: Space/Enter advance, Escape skips. Bound on window rather
  // than a focused element so the player never has to click into the page
  // first for keys to work.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        advance()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        skip()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance, skip])

  const progress = (index + 1) / script.length

  return (
    <div
      onClick={advance}
      className="relative flex h-full w-full cursor-pointer select-none flex-col items-center justify-center gap-3 bg-black p-3 font-mono text-white sm:gap-4 sm:p-6"
    >
      {/* --- top: the panel --- */}
      <div className="relative w-full max-w-[880px]" style={{ aspectRatio: `${PANEL_W} / ${PANEL_H}` }}>
        <canvas
          ref={canvasRef}
          width={PANEL_W}
          height={PANEL_H}
          className="h-full w-full border-2 border-[#2a2b4a]"
          style={{ imageRendering: 'pixelated' }}
        />
        <div className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: fade }} />
        {/* letterbox bars, drawn over the canvas so the art stays 16:9 */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[6%] bg-black/70" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[6%] bg-black/70" />
      </div>

      {/* --- bottom: the dialogue --- */}
      <div className="w-full max-w-[880px]">
        <div className="neon-ring border-2 border-yellow-300/50 bg-black/80 p-3 shadow-[0_0_18px_rgba(253,224,71,0.12)] sm:p-4">
          {speaker.label && (
            <div
              className="mb-1 text-xs font-bold uppercase tracking-[0.2em]"
              style={{ color: speaker.color }}
            >
              {speaker.label}
            </div>
          )}
          <p
            className="min-h-[3.6em] text-sm leading-relaxed sm:min-h-[3.2em] sm:text-base"
            style={{ color: speaker.color, fontStyle: speaker.italic ? 'italic' : 'normal' }}
          >
            {shown}
            <span className={typing ? 'animate-pulse' : 'invisible'}>▌</span>
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <span>
              {index + 1} / {script.length}
            </span>
            <span>
              {typing ? 'click / space to skip line' : isLast ? 'click to continue ▸' : 'click to continue ▸'}
            </span>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-3">
          <div className="h-1 flex-1 bg-[#1c1d3a]">
            <div
              className="h-1 bg-yellow-300/70 transition-[width] duration-200"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              skip()
            }}
            className="border-2 border-gray-600 px-3 py-1 text-xs font-bold text-gray-400 hover:border-yellow-300 hover:text-yellow-300"
          >
            {skipLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
