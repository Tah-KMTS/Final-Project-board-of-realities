import { useCallback, useEffect, useRef, useState } from 'react'
import { themeSong } from '../../audio/themeSong'
import { playClickSound, playQuestCompleteSound } from '../../audio/sfx'

// Movie-style end credits: a black screen, the developer names rolling
// slowly upward, a fade to nothing, then the congratulations card. Plays
// straight after the ending cutscene (see EndingCutscene.jsx).
//
// The roll is driven by one rAF clock rather than a CSS keyframe because
// the travel distance depends on the measured content height, and the
// fade-out has to be timed against the same progress value - two CSS
// animations would drift apart on a slow first paint.

const ROLL_MS = 26000
// Fraction of the roll after which the whole block starts fading out, so
// the names dissolve rather than sliding off the top edge.
const FADE_FROM = 0.86

const DEVELOPERS = [
  'Pornpavis Jongdepaisarn',
  'Ataya Chitmeesilp',
  'Thanakorm Kornmatisuk',
  'Lapat Jitsangvorawong',
  'Poom Rangsisingpipat',
  'Tan Briton Rungwattanasophon',
]

export default function CreditsRoll({ onReturnToTitle }) {
  const [phase, setPhase] = useState('roll') // roll | final
  const [offset, setOffset] = useState(0)
  const [opacity, setOpacity] = useState(1)

  const wrapRef = useRef(null)
  const contentRef = useRef(null)
  const rafRef = useRef(0)

  const finish = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    setPhase('final')
    playQuestCompleteSound()
  }, [])

  // Title theme under the credits, stopped on unmount so it never leaks
  // into the welcome screen the player returns to.
  useEffect(() => {
    themeSong.setVolume(0.25)
    themeSong.play()
    return () => themeSong.pause()
  }, [])

  useEffect(() => {
    if (phase !== 'roll') return undefined
    const start = performance.now()

    const tick = () => {
      const wrap = wrapRef.current
      const content = contentRef.current
      if (!wrap || !content) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      const travel = wrap.clientHeight + content.offsetHeight
      const p = Math.min(1, (performance.now() - start) / ROLL_MS)
      setOffset(wrap.clientHeight - p * travel)
      setOpacity(p > FADE_FROM ? Math.max(0, 1 - (p - FADE_FROM) / (1 - FADE_FROM)) : 1)
      if (p >= 1) {
        finish()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase, finish])

  // Escape skips the roll straight to the congratulations card - 26s with
  // no way out is a long time to be stuck looking at a finished game.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && phase === 'roll') {
        e.preventDefault()
        finish()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, finish])

  if (phase === 'final') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-black px-6 font-mono text-white">
        <div className="credits-final flex flex-col items-center gap-4 text-center">
          <p className="text-sm tracking-[0.4em] text-gray-500">— THE END —</p>
          <h1 className="title-glow text-3xl font-bold tracking-widest text-yellow-300 sm:text-5xl">
            YOU HAVE FINISHED THE GAME
          </h1>
          <p className="text-2xl font-bold tracking-[0.3em] text-fuchsia-400 sm:text-4xl">
            CONGRATULATIONS
          </p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-400">
            You started ten million dollars in debt with a thousand to your name, and you paid
            every cent of it back.
          </p>
        </div>
        <button
          onClick={() => {
            playClickSound()
            onReturnToTitle()
          }}
          className="btn-sheen mt-4 border-4 border-yellow-300 bg-[#1c1d3a] px-6 py-3 text-lg font-bold hover:bg-yellow-300 hover:text-black"
        >
          Return to Title
        </button>
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-black font-mono text-white">
      <div
        ref={contentRef}
        className="absolute left-0 w-full px-6 text-center"
        style={{ transform: `translateY(${offset}px)`, opacity }}
      >
        <h2 className="title-glow text-2xl font-bold tracking-widest text-yellow-300 sm:text-4xl">
          CAPITAL SYNDICATE
        </h2>
        <p className="mt-2 text-xs tracking-[0.35em] text-fuchsia-400/80 sm:text-sm">
          FINANCIAL REALITY ENGINE
        </p>

        <p className="mt-20 text-xs tracking-[0.4em] text-gray-500 sm:text-sm">— DEVELOPED BY —</p>

        <div className="mt-8 flex flex-col gap-5">
          {DEVELOPERS.map((name) => (
            <p key={name} className="text-lg font-bold tracking-wide text-white sm:text-2xl">
              {name}
            </p>
          ))}
        </div>

        <p className="mt-20 text-xs tracking-[0.4em] text-gray-500 sm:text-sm">— THANK YOU FOR PLAYING —</p>
        {/* Tail padding so the last line clears the top edge before the
            roll's own fade-out finishes. */}
        <div className="h-24" />
      </div>

      <button
        onClick={() => {
          playClickSound()
          finish()
        }}
        className="absolute bottom-4 right-4 border-2 border-gray-700 px-3 py-1 text-xs font-bold text-gray-500 hover:border-yellow-300 hover:text-yellow-300"
      >
        SKIP ▸
      </button>
    </div>
  )
}
