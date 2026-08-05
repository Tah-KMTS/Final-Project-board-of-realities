import { useCallback, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import CutscenePlayer from './CutscenePlayer'
import CreditsRoll from './CreditsRoll'
import { ENDING_CUTSCENE, ENDING_SPEAKERS } from './endingCutsceneScript'
import { paintEndingPanel } from './endingPanels'

// The ending: the debt-repayment cutscene, then the credits roll, then the
// congratulations card. Entered by triggerEnding() the moment the HUD cash
// figure reaches $10,000,000 (the watcher lives in WorldScreen.jsx).
//
// Two phases in one screen rather than two top-level screens, because the
// credits are part of the ending rather than a place the player can be
// sent independently - there is no other route into them.
export default function EndingCutscene() {
  const setScreen = useGameStore((s) => s.setScreen)
  const [phase, setPhase] = useState('cutscene') // cutscene | credits

  const paint = useCallback((ctx, key, t) => paintEndingPanel(ctx, key, t), [])
  const toCredits = useCallback(() => setPhase('credits'), [])
  const toTitle = useCallback(() => setScreen('welcome'), [setScreen])

  if (phase === 'credits') return <CreditsRoll onReturnToTitle={toTitle} />

  return (
    <CutscenePlayer
      script={ENDING_CUTSCENE}
      speakers={ENDING_SPEAKERS}
      paint={paint}
      onDone={toCredits}
      skipLabel="SKIP TO CREDITS ▸"
    />
  )
}
