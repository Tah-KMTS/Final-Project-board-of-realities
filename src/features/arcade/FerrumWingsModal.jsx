import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGameStore } from '../../store/useGameStore'
import { playVictorySound, playDefeatSound } from '../../audio/sfx'

// "Capital Syndicate: Operation Ferrum Wings" - a complete, self-contained
// vanilla JS/Canvas shmup the user supplied as a finished drop-in (its own
// README.md ships the exact same instruction: "link / iframe / route the
// board hub to: minigames/capital-syndicate/index.html"). It's copied
// verbatim into public/minigames/capital-syndicate/ (Vite serves public/ as
// a static passthrough, unbundled, at the same relative path - required
// here since the game's own asset/script paths are relative to its own
// index.html, not to this app's build output) rather than ported into a
// React component: it owns its own canvas, title/pause/gameover/victory
// screens, keyboard+mouse input, and audio - re-implementing any of that
// in this codebase's usual style would mean rewriting a finished game for
// no benefit. An iframe is a real browsing context of its own, so its
// keydown/mouseup handlers never leak to (or fight with) OverworldScene's
// or any other modal's listeners - no special focus plumbing needed,
// unlike GameCanvas.jsx's text-field-vs-Phaser-keyboard problem.
//
// createPortal to document.body (not a plain `fixed inset-0` div in place)
// - launched from SortieCabinetModal.jsx (the Game Center's Ferrum Wings
// cabinet, itself an ordinary `glass-panel` overlay), so this escapes that
// ancestor's `.glass-panel` wrapper. `.glass-panel` sets backdrop-filter
// (index.css), and per spec backdrop-filter (like transform/filter/
// perspective) establishes a new containing block for `position: fixed`
// descendants - so without the portal, "fixed inset-0" here would render
// pinned to that ancestor's own box instead of the real viewport, showing
// up as a squashed, scrolled-with-the-panel mess instead of a true
// full-screen takeover. Confirmed live back when this was reached through
// Casino's now-removed Arcade tab (nested inside CasinoModal's own
// glass-panel): without the portal the title screen rendered clipped
// inside that tab panel; with it, this covers the whole page correctly -
// same fix still applies to any glass-panel ancestor, present or future.
//
// Money-making: the game itself has no idea this app has an economy - it's
// a `postMessage({source:'capital-syndicate-ferrum-wings', type:'result',
// outcome, score, sector})` call added to its own showScreen('gameover'/
// 'victory') branches (see public/minigames/capital-syndicate/js/game.js's
// own reportResult method) since those are the only two ways a run ends.
// SortieCabinetModal.jsx already charges the entry fee up front (same "pay
// to start" convention every other minigame here uses); this listens for
// that one postMessage and credits a payout scaled by the run's own score,
// once per sortie. Only the FIRST result per mount counts - the game's own
// "Relaunch"/"Play Again" buttons let a player retry inside the SAME
// iframe for free (it has no concept of this app's entry fee), so paying
// out again on those would be an unlimited free-money loop; ignoring
// repeats means an extra paid attempt requires actually closing and
// re-launching (a fresh entry fee) like every other minigame's replay does.
const SCORE_RATE = 0.08
const VICTORY_BONUS = 300
const MAX_PAYOUT = 1500

function clamp(min, max, v) {
  return Math.min(max, Math.max(min, v))
}

function computePayout(score, outcome) {
  const base = Math.max(0, score) * SCORE_RATE
  const bonus = outcome === 'victory' ? VICTORY_BONUS : 0
  return Math.round(clamp(0, MAX_PAYOUT, base + bonus))
}

export default function FerrumWingsModal({ onClose }) {
  const addCash = useGameStore((s) => s.addCash)
  const [report, setReport] = useState(null)
  const paidOutRef = useRef(false)

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return
      const data = event.data
      if (!data || data.source !== 'capital-syndicate-ferrum-wings' || data.type !== 'result') return
      if (paidOutRef.current) return
      paidOutRef.current = true

      const payout = computePayout(data.score, data.outcome)
      if (payout > 0) addCash(payout)
      if (data.outcome === 'victory') playVictorySound()
      else playDefeatSound()
      setReport({ outcome: data.outcome, score: data.score, sector: data.sector, payout })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [addCash])

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between border-b-4 border-cyan-400 bg-[#1c1d3a] px-4 py-2 font-mono text-white">
        <span className="text-sm font-bold text-cyan-300">Capital Syndicate: Operation Ferrum Wings</span>
        <button onClick={onClose} className="border-2 border-gray-500 px-3 py-1 text-xs font-bold hover:bg-gray-500">
          Leave
        </button>
      </div>
      <div className="relative flex-1">
        <iframe
          src="/minigames/capital-syndicate/index.html"
          title="Capital Syndicate: Operation Ferrum Wings"
          className="h-full w-full border-0"
          allow="autoplay"
        />
        {report && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
            <div className="pointer-events-auto border-2 border-purple-400 bg-[#1c1d3a]/95 px-4 py-2 text-center font-mono text-sm text-white shadow-lg">
              <p className="font-bold text-purple-300">
                {report.outcome === 'victory' ? 'Mission Complete' : 'Mission Report'}
              </p>
              <p className="text-xs text-gray-400">
                Sector {report.sector} &middot; Score {report.score.toLocaleString()}
              </p>
              {report.payout > 0 ? (
                <p className="text-green-400">+${report.payout.toLocaleString()} wired to your account</p>
              ) : (
                <p className="text-gray-500">Score too low to pay out this run.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
