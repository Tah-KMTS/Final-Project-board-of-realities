import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import DDMBoard from './DDMBoard'
import RockPaperScissors from './RockPaperScissors'

export default function CynnEncounterModal({ onClose }) {
  const cynnRelationship = useGameStore((s) => s.world3.cynnRelationship)
  const setCynnRelationship = useGameStore((s) => s.setCynnRelationship)
  const recordCynnDuelWin = useGameStore((s) => s.recordCynnDuelWin)
  const removeCardFromDeck = useGameStore((s) => s.removeCardFromDeck)
  const deck = useGameStore((s) => s.world3.deck)
  const addCash = useGameStore((s) => s.addCash)

  const [phase, setPhase] = useState('intro')
  const [playerWonCynn, setPlayerWonCynn] = useState(null)
  const [reactionMessage, setReactionMessage] = useState('')

  const handleCynnVictory = () => {
    setPlayerWonCynn(true)
    recordCynnDuelWin()
    const reaction = Math.random() < 0.5 ? 'angry' : 'stalking'
    setCynnRelationship(reaction)
    setReactionMessage(
      reaction === 'angry'
        ? 'Cynn stares at you, silent, then storms off. She will not forget this.'
        : "Cynn tilts her head. \"Interesting...\" She starts following you at a distance. Always at a distance."
    )
    setPhase('reaction')
  }

  const handleCynnDefeat = () => {
    setPlayerWonCynn(false)
    addCash(-200)
    setReactionMessage('Cynn wins and takes $200 from you without a word. She loses interest and wanders off.')
    setPhase('reaction')
  }

  const handleContinueToTah = () => setPhase('tahIntervention')

  const handleRpsVetoResult = (outcome) => {
    if (outcome === 'win') setPhase('tahBackedOff')
    else setPhase('tahPrehistoricDdm')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[480px] border-4 border-fuchsia-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-2 text-xl font-bold text-fuchsia-300">Cynn</h2>

        {phase === 'intro' && (
          <>
            <p className="mb-3 text-sm text-gray-300">
              She's been watching you for a while now. {cynnRelationship === 'stalking' ? 'Again.' : ''}
              {cynnRelationship === 'angry' ? " She still looks furious about last time." : ''}
            </p>
            <p className="mb-4 text-xs text-gray-400">She plays a Faux-Disney Dungeon Dice Monsters deck. It's unsettling.</p>
            <button
              onClick={() => setPhase('ddmCynn')}
              className="mb-3 w-full border-2 border-fuchsia-400 py-2 text-sm hover:bg-fuchsia-400 hover:text-black"
            >
              Challenge Her to DDM
            </button>
            <button onClick={onClose} className="w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500">
              Walk Away
            </button>
          </>
        )}

        {phase === 'ddmCynn' && (
          <DDMBoard
            opponentName="Cynn"
            deckFlavorName="Faux-Disney Deck"
            opponentPowerBonus={1}
            onClose={onClose}
            onVictory={handleCynnVictory}
            onDefeat={handleCynnDefeat}
          />
        )}

        {phase === 'reaction' && (
          <div>
            <p className="mb-4 text-sm text-gray-300">{reactionMessage}</p>
            <p className="mb-3 text-xs text-red-400">
              Somewhere nearby, Tah suddenly perks up — he always knows when his sister plays.
            </p>
            <button
              onClick={handleContinueToTah}
              className="w-full border-4 border-red-500 bg-red-600 py-2 font-bold hover:bg-red-500"
            >
              Continue
            </button>
          </div>
        )}

        {phase === 'tahIntervention' && playerWonCynn && (
          <div>
            <p className="mb-4 text-sm text-gray-300">
              "You beat my sister?" Tah doesn't ask twice before he attacks.
            </p>
            <button
              onClick={() => setPhase('tahAttack')}
              className="w-full border-4 border-red-500 bg-red-600 py-2 font-bold hover:bg-red-500"
            >
              Face Tah's Attack
            </button>
          </div>
        )}

        {phase === 'tahAttack' && (
          <DDMBoard
            opponentName="Tah (Furious)"
            deckFlavorName="Chaos Deck"
            opponentPowerBonus={2}
            onClose={onClose}
            onVictory={onClose}
            onDefeat={() => {
              addCash(-500)
              onClose()
            }}
          />
        )}

        {phase === 'tahIntervention' && playerWonCynn === false && (
          <div>
            <p className="mb-4 text-sm text-gray-300">
              "She lost? Interesting." Tah challenges you himself with an RNG-rolled Prehistoric Deck. "Lose, and you
              forfeit a card. Unless you're fast enough for Rock-Paper-Scissors."
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setPhase('tahRpsVeto')}
                className="border-2 border-cyan-400 py-2 text-sm hover:bg-cyan-400 hover:text-black"
              >
                Invoke the RPS Veto
              </button>
              <button
                onClick={() => setPhase('tahPrehistoricDdm')}
                className="border-2 border-red-500 py-2 text-sm hover:bg-red-500 hover:text-black"
              >
                Just Play Him
              </button>
            </div>
          </div>
        )}

        {phase === 'tahRpsVeto' && <RockPaperScissors onResult={handleRpsVetoResult} />}

        {phase === 'tahBackedOff' && (
          <div className="text-center">
            <p className="mb-4 text-sm text-green-400">Tah shrugs and backs off. No forfeit this time.</p>
            <button onClick={onClose} className="border-4 border-green-400 bg-green-500 px-6 py-2 font-bold text-black hover:bg-green-400">
              Continue
            </button>
          </div>
        )}

        {phase === 'tahPrehistoricDdm' && (
          <DDMBoard
            opponentName="Tah"
            deckFlavorName="Prehistoric Deck"
            opponentPowerBonus={2 + Math.floor(Math.random() * 3)}
            onClose={onClose}
            onVictory={onClose}
            onDefeat={() => {
              if (deck.length > 0) removeCardFromDeck(deck[Math.floor(Math.random() * deck.length)].id)
              onClose()
            }}
          />
        )}
      </div>
    </div>
  )
}
