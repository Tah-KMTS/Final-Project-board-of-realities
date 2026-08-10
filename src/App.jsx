import { useGameStore } from './store/useGameStore'
import WelcomeScreen from './components/Menu/WelcomeScreen'
import WorldScreen from './components/WorldScreen'
import IntroCutscene from './features/cutscene/IntroCutscene'
import EndingCutscene from './features/cutscene/EndingCutscene'
import LeverageMeterDemo from './features/finance/LeverageMeterDemo'

function GameOverScreen() {
  const setScreen = useGameStore((s) => s.setScreen)
  // 'permadeath' (Hunter's Rift HP hitting 0, save wiped - see takeDamage)
  // vs 'daysUp' (Days Left hit 0 before the $10M target, see endDay) show
  // different reasons here - only the former actually wipes the save.
  const gameOverReason = useGameStore((s) => s.gameOverReason)
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-black font-mono text-white">
      <h1 className="text-6xl font-bold text-red-600">GAME OVER</h1>
      <p className="text-gray-400">
        {gameOverReason === 'daysUp'
          ? "Time's up. 30 days came and went, and you never cleared the $10,000,000 balance."
          : 'Your save file has been wiped. Permadeath is permanent.'}
      </p>
      <button
        onClick={() => setScreen('welcome')}
        className="border-4 border-gray-500 px-6 py-2 font-bold hover:bg-gray-500"
      >
        Return to Title
      </button>
    </div>
  )
}

const SCREENS = {
  welcome: WelcomeScreen,
  cutscene: IntroCutscene,
  world: WorldScreen,
  ending: EndingCutscene,
  gameOver: GameOverScreen,
}

function App() {
  const screen = useGameStore((s) => s.screen)
  const Screen = SCREENS[screen] || WelcomeScreen

  // Dev-only self-test entry point for LeverageMeter (see
  // src/features/finance/LeverageMeterDemo.jsx) - gated behind a query
  // param so it never appears in normal play and needs no store/screen
  // plumbing of its own. Not referenced by any building modal; that
  // wiring is a separate follow-up task.
  const isLeverageDemo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('leverageDemo')

  return (
    // min-h-screen + overflow-y-auto (not h-screen + overflow-hidden) - the
    // old fixed-height clip silently cut off the bottom of WorldScreen's
    // stack (status header + FinanceStatusBar + 600px game canvas + hint
    // text) on any viewport shorter than ~900px, which is most laptop
    // screens once browser chrome is subtracted. That forced players to
    // zoom the whole browser out just to see the clipped content, which
    // then made all the text too small to read - and the in-game
    // "Fullscreen" button (plain requestFullscreen()) only removes browser
    // chrome, it doesn't change this math, so it didn't help. Letting the
    // page scroll instead of clipping means nothing is ever invisible at
    // 100% zoom; horizontal overflow is still guarded (w-screen behavior
    // preserved via overflow-x-hidden) since every inner layout is designed
    // to fit width, not height.
    <div className="min-h-screen w-screen overflow-y-auto overflow-x-hidden">
      {isLeverageDemo ? <LeverageMeterDemo /> : <Screen />}
    </div>
  )
}

export default App
