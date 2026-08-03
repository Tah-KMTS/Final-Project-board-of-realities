import { useGameStore } from '../store/useGameStore'

// One-time "what can I do / what's the goal" screen, shown on WorldScreen's
// first mount after a brand new game (gated by store.hasSeenIntro - see
// useGameStore.js's startNewGame/loadGame/dismissIntro). Content mirrors
// the same game-reference facts Aria (the phone's Guide app) already
// answers from - see src/features/phone/aiGuide.js and
// backend/main.py's GUIDE_SYSTEM_PROMPT - so a player who reads this and a
// player who later asks Aria "how do I win?" get the same answer.
//
// `onClose` (optional): lets GuideApp.jsx's "How to Play" button reopen
// this exact same screen later without touching the persisted
// hasSeenIntro flag - that instance passes its own close handler instead
// of falling through to dismissIntro, so re-reading the tutorial never
// re-flips a save-state flag that's already true. The original first-time
// call site (WorldScreen.jsx's `!hasSeenIntro` render) omits this prop, so
// it keeps using dismissIntro exactly as before.
export default function WelcomeIntroModal({ onClose }) {
  const dismissIntro = useGameStore((s) => s.dismissIntro)
  const handleClose = onClose || dismissIntro

  return (
    // max-h + column flex + a scrollable body: this screen is taller than a
    // short viewport (laptops, and any window that isn't near-fullscreen),
    // and with no height cap it simply ran off the bottom - taking the
    // "Let's Go" button with it, so the intro couldn't be dismissed at all.
    // The button sits outside the scroll area so it stays reachable no
    // matter how little vertical room there is.
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
      <div className="glass-panel neon-ring flex max-h-[92vh] w-[560px] max-w-[92vw] flex-col border-4 border-yellow-300 bg-[#1c1d3a] p-4 font-mono text-white [@media(min-height:640px)]:p-6">
        {/* Keyed off viewport HEIGHT, not width - this is a vertical-space
            problem, so Tailwind's width breakpoints (sm:, md:) would do
            nothing on a wide-but-short window, which is exactly the case that
            broke. The heading is a wide pixel face that wraps to three lines
            at text-2xl and eats most of a short viewport, leaving the scroll
            body a uselessly thin slit; the flavour subtitle goes too, since
            the body text is what actually has to be readable. */}
        <h2 className="mb-1 shrink-0 text-lg font-bold leading-tight text-yellow-300 [@media(min-height:640px)]:text-2xl">Welcome to Capital Syndicate</h2>
        <p className="mb-3 hidden shrink-0 text-sm text-gray-400 [@media(min-height:640px)]:mb-4 [@media(min-height:640px)]:block">A dark-neon financial sandbox - here's what you're doing.</p>

        <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
        <div className="mb-4 border-2 border-yellow-400/60 bg-yellow-400/10 p-3">
          <p className="text-sm font-bold text-yellow-300">The Goal</p>
          <p className="mt-1 text-sm text-gray-200">
            Build your net worth (cash + stocks + crypto) to <span className="font-bold text-green-400">$10,000,000</span> to
            win. You'll pass milestones along the way - $50k, $250k, $1M, $5M - each one a real step, not just a number.
          </p>
        </div>

        <div className="mb-4 space-y-2 text-sm text-gray-200">
          <p><span className="font-bold text-cyan-300">Press End Day</span> to advance time - it ticks the market and resolves whatever you set in motion.</p>
          <p><span className="font-bold text-cyan-300">Walk up to a building or person</span> and press E to interact - that's how everything in the world opens.</p>
          <p><span className="font-bold text-cyan-300">Two paths to money</span>, and you can mix both: legit (jobs, stocks, real estate, companies) or criminal (the Underworld, syndicate work, heists) - the criminal path pays faster but raises your Wanted Level, and getting caught means jail.</p>
          <p><span className="font-bold text-cyan-300">Energy</span> is your daily budget - most real actions cost some, and it only refills fully at End Day. Run out early and you can top it up: a cheap snack at the Food Court, or a bigger Restorative Blessing at the Temple (priced off your cash, so it stays a real cost even once you're rich).</p>
          <p><span className="font-bold text-cyan-300">Your Phone</span> (top-right) has Social/X, Banking & Portfolio, Contacts, a Map, and Aria - an in-game guide you can ask anything, any time you're stuck. Aria can also pull this screen back up if you forget any of it.</p>
        </div>
        </div>

        <button
          onClick={handleClose}
          className="btn-sheen mt-4 w-full shrink-0 border-4 border-yellow-300 bg-yellow-400 py-3 text-lg font-bold text-black hover:bg-yellow-300"
        >
          Let's Go
        </button>
      </div>
    </div>
  )
}
