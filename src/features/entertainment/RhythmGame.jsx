import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'

// Concert Hall arrow-key rhythm minigame. Follows the ClawMachine.jsx/
// MiniGolfModal.jsx shadow-state rAF pattern: refs own the per-frame truth
// (note positions, target timestamps, score/combo), React state is only
// touched for things that actually need to re-render (combo readout,
// Perfect/Good/Miss toast). Notes render as plain positioned <div>s per
// lane, moved every tick via direct DOM style writes on ref'd elements -
// not React state, not <canvas> (no freeform physics needed for a 4-lane
// scroller).
//
// Mounts fresh (via key/conditional-render in ConcertHallTab.jsx) once per
// song and unmounts on finish/forfeit - that's what makes the keydown
// listener cleanup and the rAF loop cleanup correct, same reliance on the
// tab-conditional-unmount convention IndustrialZoneModal.jsx/
// UnderworldModal.jsx already established for their tabs.

const KEY_TO_LANE = { ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 }
const LANE_KEYS = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight']
const LANE_GLYPHS = ['←', '↓', '↑', '→']
const LANE_COLORS = ['#e0507a', '#4aa8e0', '#e0c040', '#4ac07a']

const TRACK_HEIGHT_PX = 340
const HIT_LINE_PX = 300
const NOTE_TRAVEL_MS = 1400 // time a note takes to scroll from spawn to the hit-line, independent of BPM (BPM only controls note spacing)
const NOTE_HEIGHT_PX = 16

// Points per judgment, per spec.
const POINTS = { perfect: 3, good: 1, miss: 0 }
const TOAST_MS = 450

export default function RhythmGame({ song, onFinish }) {
  // song = { id, label, notes, bpm, entry, energy, laneSequence } - laneSequence
  // is the procedurally-generated per-note lane array, built once by
  // ConcertHallTab.startSong() before this component mounts.
  const [combo, setCombo] = useState(0)
  const [toast, setToast] = useState(null) // { text, tone } | null
  const [leaveConfirm, setLeaveConfirm] = useState(false)

  // --- Refs: the actual per-frame/per-keypress truth ------------------
  const notesRef = useRef(song.laneSequence.map((lane) => ({ lane, result: null })))
  const noteElRefs = useRef([])
  const laneElRefs = useRef([])
  const rafRef = useRef(null)
  const toastTimeoutRef = useRef(null)
  const finishedRef = useRef(false)

  const songStartRef = useRef(0)
  const beatIntervalMsRef = useRef(60000 / song.bpm)
  const pausedRef = useRef(false)
  const hiddenAtRef = useRef(0)

  const scoreRef = useRef(0)
  const perfectCountRef = useRef(0)
  const goodCountRef = useRef(0)
  const missCountRef = useRef(0)
  const unresolvedCountRef = useRef(song.laneSequence.length)
  const comboRef = useRef(0)

  // Timing windows, AGI-modified, read once at song start per spec item 6
  // (getState() snapshot, not a reactive subscription inside the loop).
  // Floored defensively so a very low AGI can never collapse a window to
  // ~0/negative and make the song unplayable.
  const timingRef = useRef(null)
  if (timingRef.current === null) {
    const agi = useGameStore.getState().player.stats.AGI ?? 5
    timingRef.current = {
      perfectWindowMs: Math.max(20, 80 + (agi - 5) * 4),
      goodWindowMs: Math.max(40, 150 + (agi - 5) * 6),
    }
  }

  const maxScore = song.notes * POINTS.perfect

  // --- Group note indices by lane once, for the initial (and only) render
  // of note chips - their positions are then driven purely by direct DOM
  // writes in the rAF tick, never by re-rendering this list.
  const notesByLane = [[], [], [], []]
  song.laneSequence.forEach((lane, i) => notesByLane[lane].push(i))

  const showToast = (text, tone) => {
    setToast({ text, tone })
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = setTimeout(() => setToast(null), TOAST_MS)
  }

  const setComboValue = (next) => {
    if (comboRef.current === next) return
    comboRef.current = next
    setCombo(next)
  }

  const hideNoteEl = (idx) => {
    const el = noteElRefs.current[idx]
    if (el) el.style.opacity = '0'
  }

  const finishSong = (reason) => {
    if (finishedRef.current) return
    finishedRef.current = true
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    onFinish({
      score: scoreRef.current,
      maxScore,
      perfectCount: perfectCountRef.current,
      goodCount: goodCountRef.current,
      missCount: missCountRef.current,
      reason,
    })
  }

  const resolveNote = (idx, result) => {
    const note = notesRef.current[idx]
    if (note.result !== null) return
    note.result = result
    unresolvedCountRef.current -= 1
    scoreRef.current += POINTS[result]
    if (result === 'perfect') perfectCountRef.current += 1
    else if (result === 'good') goodCountRef.current += 1
    else missCountRef.current += 1

    if (result === 'miss') setComboValue(0)
    else setComboValue(comboRef.current + 1)

    showToast(result === 'perfect' ? 'PERFECT' : result === 'good' ? 'GOOD' : 'MISS', result)
    hideNoteEl(idx)
  }

  // --- Keyboard capture -------------------------------------------------
  // Hit judgment happens synchronously right here, comparing performance.now()
  // against the ref-stored target timestamp for the nearest unresolved note
  // in that lane - not inside the rAF tick, not gated behind setState. That's
  // the single most important correctness detail per the feasibility pass:
  // judging off a once-per-render value would make the ~80ms Perfect window
  // silently looser/unfair.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!(e.key in KEY_TO_LANE)) return
      e.preventDefault()
      if (e.repeat) return
      if (pausedRef.current || finishedRef.current) return

      const lane = KEY_TO_LANE[e.key]
      const now = performance.now()
      const notes = notesRef.current
      let idx = -1
      for (let i = 0; i < notes.length; i++) {
        if (notes[i].lane === lane && notes[i].result === null) { idx = i; break }
      }
      if (idx === -1) return

      const targetTime = songStartRef.current + idx * beatIntervalMsRef.current
      const diff = Math.abs(now - targetTime)
      if (diff <= timingRef.current.perfectWindowMs) {
        resolveNote(idx, 'perfect')
      } else if (diff <= timingRef.current.goodWindowMs) {
        resolveNote(idx, 'good')
      } else {
        // Outside the Good window entirely (way early or way late) - a
        // mistimed press. Breaks combo but doesn't consume the note; it's
        // still hittable later, or will auto-miss on its own once its own
        // window closes (handled in the rAF tick below).
        setComboValue(0)
        showToast('MISS', 'miss')
      }
    }
    const handleKeyUp = (e) => {
      if (!(e.key in KEY_TO_LANE)) return
      e.preventDefault()
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Pause the song clock when the tab loses focus, rather than letting
  // every note that would have scrolled by while backgrounded silently miss
  // (or skip ahead) on refocus. Shifting songStartRef forward by the hidden
  // duration is equivalent to shifting every note's target time by the same
  // amount, since targetTime is always computed as songStartRef + i*interval.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        pausedRef.current = true
        hiddenAtRef.current = performance.now()
      } else if (pausedRef.current) {
        songStartRef.current += performance.now() - hiddenAtRef.current
        pausedRef.current = false
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  // --- Single race/song-start timestamp, captured once. Every note's target
  // hit-time is an offset from it, never incremented per-frame (no drift).
  useEffect(() => {
    songStartRef.current = performance.now()

    const tick = () => {
      if (!pausedRef.current) {
        const now = performance.now()
        const notes = notesRef.current
        for (let i = 0; i < notes.length; i++) {
          if (notes[i].result !== null) continue
          const targetTime = songStartRef.current + i * beatIntervalMsRef.current
          if (now - targetTime > timingRef.current.goodWindowMs) {
            resolveNote(i, 'miss')
            continue
          }
          const spawnTime = targetTime - NOTE_TRAVEL_MS
          const progress = (now - spawnTime) / NOTE_TRAVEL_MS
          const el = noteElRefs.current[i]
          if (el) {
            el.style.opacity = progress < 0 ? '0' : '1'
            el.style.transform = `translateY(${Math.min(progress, 1.3) * HIT_LINE_PX}px)`
          }
        }
        if (unresolvedCountRef.current <= 0) {
          finishSong('complete')
          return
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toastColor = toast?.tone === 'perfect' ? 'text-yellow-300' : toast?.tone === 'good' ? 'text-cyan-300' : 'text-red-400'

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full items-center justify-between text-sm">
        <span className="text-gray-300">{song.label}</span>
        <span className="font-bold text-fuchsia-300">Combo: {combo}</span>
      </div>

      <div className="relative h-6 w-full text-center">
        {toast && <p className={`text-lg font-black tracking-widest ${toastColor}`}>{toast.text}</p>}
      </div>

      <div className="flex gap-2">
        {LANE_KEYS.map((key, laneIdx) => (
          <div
            key={key}
            ref={(el) => (laneElRefs.current[laneIdx] = el)}
            className="relative overflow-hidden border-2 border-gray-700 bg-[#0a0a14]"
            style={{ width: 56, height: TRACK_HEIGHT_PX }}
          >
            <div className="absolute left-0 right-0 border-t-4 border-white/70" style={{ top: HIT_LINE_PX }} />
            {notesByLane[laneIdx].map((i) => (
              <div
                key={i}
                ref={(el) => (noteElRefs.current[i] = el)}
                className="absolute left-0.5 right-0.5 rounded-sm"
                style={{
                  top: 0,
                  height: NOTE_HEIGHT_PX,
                  backgroundColor: LANE_COLORS[laneIdx],
                  opacity: 0,
                  willChange: 'transform',
                }}
              />
            ))}
            <div className="absolute bottom-1 left-0 right-0 text-center text-lg text-gray-500">{LANE_GLYPHS[laneIdx]}</div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-500">Press the matching arrow key as each note crosses the white line.</p>

      {!leaveConfirm ? (
        <button
          onClick={() => setLeaveConfirm(true)}
          className="mt-1 border-2 border-gray-600 px-3 py-1 text-xs text-gray-400 hover:border-red-500 hover:text-red-400"
        >
          Leave Stage
        </button>
      ) : (
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span className="text-red-400">Walk off mid-song? Booking fee is forfeit either way.</span>
          <button onClick={() => finishSong('forfeit')} className="border-2 border-red-500 px-2 py-0.5 font-bold text-red-400 hover:bg-red-500 hover:text-black">
            Yes, leave
          </button>
          <button onClick={() => setLeaveConfirm(false)} className="border-2 border-gray-600 px-2 py-0.5 text-gray-400 hover:bg-gray-700">
            Keep playing
          </button>
        </div>
      )}
    </div>
  )
}
