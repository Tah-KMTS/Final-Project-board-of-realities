import { useCallback } from 'react'
import { useGameStore } from '../../store/useGameStore'
import CutscenePlayer from './CutscenePlayer'
import { INTRO_CUTSCENE, SPEAKERS } from './introCutsceneScript'
import { paintPanel } from './cutscenePanels'

// The opening cutscene, played once immediately after "New Game" - the
// leverage blow-up that explains why the player starts with $1,000 in a
// city where the target is $10,000,000. All the machinery lives in
// CutscenePlayer.jsx; this just supplies the script and the exit.
//
// Deliberately its own top-level screen rather than a modal over
// WorldScreen: the world scene boots Phaser, spawns 88 agents and starts
// the day clock, and none of that should be running underneath a cutscene
// the player hasn't finished reading.
export default function IntroCutscene() {
  const finishCutscene = useGameStore((s) => s.finishCutscene)
  const paint = useCallback((ctx, key, t) => paintPanel(ctx, key, t), [])

  return (
    <CutscenePlayer
      script={INTRO_CUTSCENE}
      speakers={SPEAKERS}
      paint={paint}
      onDone={finishCutscene}
    />
  )
}
