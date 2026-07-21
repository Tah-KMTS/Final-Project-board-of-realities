import { useState } from 'react'

const OPTIONS = ['Rock', 'Paper', 'Scissors']

function decide(player, cpu) {
  if (player === cpu) return 'tie'
  const beats = { Rock: 'Scissors', Paper: 'Rock', Scissors: 'Paper' }
  return beats[player] === cpu ? 'win' : 'lose'
}

export default function RockPaperScissors({ onResult }) {
  const [result, setResult] = useState(null)
  const [cpuChoice, setCpuChoice] = useState(null)

  const play = (choice) => {
    const cpu = OPTIONS[Math.floor(Math.random() * OPTIONS.length)]
    const outcome = decide(choice, cpu)
    setCpuChoice(cpu)
    setResult(outcome)
    if (outcome !== 'tie') {
      setTimeout(() => onResult(outcome), 900)
    }
  }

  return (
    <div className="text-center">
      <p className="mb-3 text-sm text-gray-300">Rock, Paper, Scissors — winner takes it.</p>
      <div className="mb-3 flex justify-center gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt}
            onClick={() => play(opt)}
            disabled={result === 'tie' ? false : !!result}
            className="border-2 border-cyan-400 px-4 py-2 text-sm hover:bg-cyan-400 hover:text-black disabled:opacity-40"
          >
            {opt}
          </button>
        ))}
      </div>
      {cpuChoice && (
        <p className="text-xs text-gray-400">
          They chose {cpuChoice}.{' '}
          {result === 'tie' && <span className="text-yellow-300">Tie — throw again.</span>}
          {result === 'win' && <span className="text-green-400">You win!</span>}
          {result === 'lose' && <span className="text-red-400">You lose.</span>}
        </p>
      )}
    </div>
  )
}
