import { useGameStore } from './store/useGameStore'
import WelcomeScreen from './components/Menu/WelcomeScreen'
import WorldScreen from './components/WorldScreen'
import IntroCutscene from './features/cutscene/IntroCutscene'
import EndingCutscene from './features/cutscene/EndingCutscene'
import LeverageMeterDemo from './features/finance/LeverageMeterDemo'

function GameOverScreen() {
  const setScreen = useGameStore((s) => s.setScreen)
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-black font-mono text-white">
      <h1 className="text-6xl font-bold text-red-600">GAME OVER</h1>
      <p className="text-gray-400">Your save file has been wiped. Permadeath is permanent.</p>
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
    <div className="h-screen w-screen overflow-hidden">
      {isLeverageDemo ? <LeverageMeterDemo /> : <Screen />}
    </div>
  )
}

export default App
