import { useGameStore } from '../store/useGameStore'

// One-time "what can I do / what's the goal" screen, shown on WorldScreen's
// first mount after a brand new game (gated by store.hasSeenIntro - see
// useGameStore.js's startNewGame/loadGame/dismissIntro). Content mirrors
// the same game-reference facts Aria (the phone's Guide app) already
// answers from - see src/features/phone/aiGuide.js and
// backend/main.py's GUIDE_SYSTEM_PROMPT - so a player who reads this and a
// player who later asks Aria "how do I win?" get the same answer.
export default function WelcomeIntroModal() {
  const dismissIntro = useGameStore((s) => s.dismissIntro)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80">
      <div className="glass-panel neon-ring w-[560px] max-w-[92vw] border-4 border-yellow-300 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-1 text-2xl font-bold text-yellow-300">Welcome to Capital Syndicate</h2>
        <p className="mb-4 text-sm text-gray-400">A dark-neon financial sandbox - here's what you're doing.</p>

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
          <p><span className="font-bold text-cyan-300">Your Phone</span> (top-right) has Social/X, Banking & Portfolio, Contacts, and Aria - an in-game guide you can ask anything, any time you're stuck.</p>
        </div>

        <button
          onClick={dismissIntro}
          className="btn-sheen w-full border-4 border-yellow-300 bg-yellow-400 py-3 text-lg font-bold text-black hover:bg-yellow-300"
        >
          Let's Go
        </button>
      </div>
    </div>
  )
}
