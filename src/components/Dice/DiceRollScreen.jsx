import { useEffect, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { playDiceSound, playQuestCompleteSound } from '../../audio/sfx'

const PIP_LAYOUTS = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
}

function Die({ value }) {
  return (
    <div
      className="grid h-20 w-20 grid-cols-3 grid-rows-3 gap-1 rounded-md border-4 border-gray-800 bg-gradient-to-br from-white to-gray-200 p-2 shadow-[0_0_16px_rgba(255,224,102,0.35)]"
    >
      {Array.from({ length: 9 }).map((_, i) => {
        const row = Math.floor(i / 3)
        const col = i % 3
        const hasPip = PIP_LAYOUTS[value]?.some(([r, c]) => r === row && c === col)
        return (
          <div key={i} className="flex items-center justify-center">
            {hasPip && <div className="h-3 w-3 rounded-full bg-black shadow-inner" />}
          </div>
        )
      })}
    </div>
  )
}

export default function DiceRollScreen() {
  const rollStartingBlock = useGameStore((s) => s.rollStartingBlock)
  const enterWorld = useGameStore((s) => s.enterWorld)
  const [rolling, setRolling] = useState(true)
  const [display, setDie] = useState([1, 1])
  const [result, setResult] = useState(null)
  const [chosenBlock, setChosenBlock] = useState(null)

  useEffect(() => {
    let ticks = 0
    const interval = setInterval(() => {
      setDie([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)])
      playDiceSound()
      ticks += 1
      if (ticks > 12) {
        clearInterval(interval)
        const block = rollStartingBlock()
        const state = useGameStore.getState()
        setDie([state.diceRoll.die1, state.diceRoll.die2])
        setResult(state.diceRoll.total)
        setChosenBlock(block)
        setRolling(false)
        playQuestCompleteSound()
      }
    }, 100)
    return () => clearInterval(interval)
  }, [rollStartingBlock])

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 bg-[#0f1020] font-mono text-white">
      <h2 className="title-glow text-2xl font-bold">Rolling for your starting Block...</h2>
      <div className="flex gap-6">
        <Die value={display[0]} />
        <Die value={display[1]} />
      </div>

      {!rolling && chosenBlock && (
        <div className="flex flex-col items-center gap-4 border-4 border-yellow-300 bg-[#1c1d3a] px-8 py-6 text-center shadow-[0_0_24px_rgba(255,224,102,0.2)]">
          <p className="text-lg">
            You rolled a <span className="font-bold text-yellow-300">{result}</span>!
          </p>
          <p className="text-xl font-bold">{chosenBlock.name}</p>
          <p className="text-sm text-gray-400">
            Difficulty: {chosenBlock.difficulty}/10 &nbsp;|&nbsp; Survival Rate: {chosenBlock.survivalRate}%
          </p>
          <button
            onClick={enterWorld}
            className="btn-sheen mt-2 border-4 border-green-400 bg-green-500 px-6 py-2 font-bold text-black hover:bg-green-400"
          >
            Enter the World
          </button>
        </div>
      )}
    </div>
  )
}
