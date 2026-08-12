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
    // h-screen (a real 100vh, not min-h-screen's min-height:100vh) +
    // overflow-y-auto - still never clips: WorldScreen's stack (status
    // header + FinanceStatusBar + 600px game canvas + hint text) on a short
    // viewport now scrolls within THIS div's own box instead of growing the
    // whole page past 100vh, which is the same "nothing is ever invisible"
    // outcome the old min-h-screen approach was chosen for, just via a
    // nested scroll region instead of the page/window scrolling.
    //
    // That min-height (not height) choice had a real side effect though:
    // per the CSS spec, a block box's height only counts as "definite" for
    // percentage-height children when it comes from an explicit `height`,
    // not from `min-height` alone - so WelcomeScreen/WorldScreen's own
    // `h-full` root divs couldn't resolve against it and silently collapsed
    // to their own CONTENT height instead of the viewport. On any window
    // taller than that content, the leftover space below just showed flat
    // body background with none of a screen's own background art on it
    // (reported as "black screen on the bottom half of the start page" once
    // WelcomeSkyline made the missing art visible by contrast). `h-screen`
    // is a real viewport-unit height, always definite regardless of any
    // ancestor/content chain, so this fixes that for every screen at once.
    <div className="h-screen w-screen overflow-y-auto overflow-x-hidden">
      {isLeverageDemo ? <LeverageMeterDemo /> : <Screen />}
    </div>
  )
}

export default App
