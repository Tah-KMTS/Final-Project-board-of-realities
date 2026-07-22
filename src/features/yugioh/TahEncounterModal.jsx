import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import DDMBoard from './DDMBoard'
import RockPaperScissors from './RockPaperScissors'
import DialogueBox from '../../components/Dialogue/DialogueBox'
import { TAH_LINES } from '../../data/yugiohDialogue'

export default function TahEncounterModal({ onClose }) {
  const addCash = useGameStore((s) => s.addCash)
  const setTahTyrantSummoned = useGameStore((s) => s.setTahTyrantSummoned)
  const tahTyrantSummoned = useGameStore((s) => s.world3.tahTyrantSummoned)

  const [betAmount] = useState(() => 3000 + Math.floor(Math.random() * 5000))
  const [vetoOffered] = useState(() => Math.random() < 0.15)
  const [phase, setPhase] = useState('intro') // intro | rps | ddm | resolved

  const handleRpsResult = (outcome) => {
    if (outcome === 'win') {
      setTahTyrantSummoned()
      setPhase('vetoWin')
    } else {
      setPhase('ddm')
    }
  }

  if (tahTyrantSummoned) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <div className="w-[420px] border-4 border-red-500 bg-[#1c1d3a] p-6 text-center font-mono text-white">
          <h2 className="mb-3 text-xl font-bold text-red-400">Tah</h2>
          <p className="mb-4 text-sm text-gray-300">
            "Tah the Tyrant" already answers to you. He's off somewhere hoarding loot. Tah just waves.
          </p>
          <button onClick={onClose} className="w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500">
            Leave
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'ddm') {
    return (
      <DDMBoard
        opponentName="Tah"
        deckFlavorName="Chaos Deck"
        opponentPowerBonus={Math.floor(Math.random() * 3)}
        wagerLabel={`$${betAmount.toLocaleString()}`}
        onClose={onClose}
        onVictory={() => {
          addCash(betAmount)
          onClose()
        }}
        onDefeat={() => {
          addCash(-betAmount)
          onClose()
        }}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[440px] border-4 border-red-500 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-2 text-xl font-bold text-red-400">Tah</h2>

        {phase === 'intro' && (
          <>
            <DialogueBox speaker="Tah" portrait="🎲" lines={TAH_LINES} onDone={() => {}} />
            <p className="mb-4 text-sm text-gray-300">
              ${betAmount.toLocaleString()} says he wins. Tah doesn't wait for you to agree.
            </p>
            <div className="flex flex-col gap-2">
              {vetoOffered && (
                <button
                  onClick={() => setPhase('rps')}
                  className="border-2 border-cyan-400 py-2 text-sm hover:bg-cyan-400 hover:text-black"
                >
                  Something feels off — call for Rock-Paper-Scissors instead
                </button>
              )}
              <button
                onClick={() => setPhase('ddm')}
                className="border-2 border-red-500 py-2 text-sm hover:bg-red-500 hover:text-black"
              >
                Accept the Game (Dungeon Dice Monsters)
              </button>
              <button
                onClick={onClose}
                className="border-2 border-gray-600 py-2 text-sm text-gray-400 hover:bg-gray-700"
              >
                Walk Away (Tah lets you, this time)
              </button>
            </div>
          </>
        )}

        {phase === 'rps' && <RockPaperScissors onResult={handleRpsResult} />}

        {phase === 'vetoWin' && (
          <div className="text-center">
            <p className="mb-3 text-sm text-green-400">
              You win the RPS veto! Tah, delighted rather than upset, hands over "Tah the Tyrant" — an item that
              summons an unpredictable AI companion. It tends to hoard loot, but it's yours now.
            </p>
            <button
              onClick={onClose}
              className="border-4 border-green-400 bg-green-500 px-6 py-2 font-bold text-black hover:bg-green-400"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
