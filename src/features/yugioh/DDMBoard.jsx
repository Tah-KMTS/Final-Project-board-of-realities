import { useEffect, useRef, useState } from 'react'
import {
  GRID_COLS, GRID_ROWS, CREST_TYPES, CREST_CAP, DIE_MASTER_MAX_HP,
  PLAYER_DM, OPPONENT_DM,
  createInitialBoard, createEmptyCrestBank, rollDice, resolveRoll,
  generateMonster, findUnfoldCandidates, unfoldNet, isAdjacent, computeDamage,
} from './ddmEngine'
import { playHitSound, playClickSound, playVictorySound, playDefeatSound, playTakeDamageSound } from '../../audio/sfx'

const TILE = 18
const CANVAS_W = GRID_COLS * TILE
const CANVAS_H = GRID_ROWS * TILE

const CREST_LABELS = { movement: 'Move', attack: 'Attack', defense: 'Defense', spell: 'Spell' }
const CREST_COLORS = { movement: '#4ea8de', attack: '#e63946', defense: '#2a9d8f', spell: '#f4a261' }

export default function DDMBoard({
  opponentName = 'Opponent',
  deckFlavorName = 'Standard Deck',
  opponentPowerBonus = 0,
  wagerLabel,
  onClose,
  onVictory,
  onDefeat,
}) {
  const canvasRef = useRef(null)

  const [cells, setCells] = useState(() => createInitialBoard())
  const [playerBank, setPlayerBank] = useState(createEmptyCrestBank())
  const [opponentBank, setOpponentBank] = useState(createEmptyCrestBank())
  const [playerDmHp, setPlayerDmHp] = useState(DIE_MASTER_MAX_HP)
  const [opponentDmHp, setOpponentDmHp] = useState(DIE_MASTER_MAX_HP)
  const [monsters, setMonsters] = useState([])
  const [turn, setTurn] = useState('player')
  const [lastRoll, setLastRoll] = useState(null)
  const [summonAvailable, setSummonAvailable] = useState(null)
  const [mode, setMode] = useState('idle') // idle | placing | moving | attacking
  const [selectedMonsterId, setSelectedMonsterId] = useState(null)
  const [log, setLog] = useState([`A Dungeon Dice Monsters match begins against ${opponentName}!`])
  const [outcome, setOutcome] = useState(null)
  const [defensePrompt, setDefensePrompt] = useState(null)
  const [hasRolledThisTurn, setHasRolledThisTurn] = useState(false)

  const appendLog = (line) => setLog((prev) => [...prev.slice(-5), line])

  useEffect(() => {
    render()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, monsters, mode, selectedMonsterId])

  const selectedMonster = monsters.find((m) => m.id === selectedMonsterId)

  const handleRoll = () => {
    if (hasRolledThisTurn || outcome) return
    playClickSound()
    const results = rollDice(0)
    const { nextBank, summonLevel } = resolveRoll(playerBank, results)
    setPlayerBank(nextBank)
    setLastRoll(results)
    setSummonAvailable(summonLevel)
    setHasRolledThisTurn(true)
    appendLog(
      `Rolled: ${results.map((r) => (r.type === 'summon' ? `Lv${r.level} Summon` : CREST_LABELS[r.type])).join(', ')}.`
    )
    if (summonLevel) appendLog(`2+ matching Lv${summonLevel} Summon crests! You may summon.`)
  }

  const handleStartSummon = () => {
    if (!summonAvailable) return
    setMode('placing')
  }

  const handleStartMove = (monsterId) => {
    if (playerBank.movement <= 0) return
    setSelectedMonsterId(monsterId)
    setMode('moving')
  }

  const handleStartAttack = (monsterId) => {
    if (playerBank.attack <= 0) return
    setSelectedMonsterId(monsterId)
    setMode('attacking')
  }

  const cellKey = (c, r) => `${c},${r}`

  const monsterAt = (col, row) => monsters.find((m) => m.col === col && m.row === row)

  const handleTileClick = (col, row) => {
    if (outcome || turn !== 'player') return

    if (mode === 'placing') {
      const candidates = findUnfoldCandidates(cells, 'player')
      const valid = candidates.some((c) => c.col === col && c.row === row)
      if (!valid) return
      const nextCells = unfoldNet(cells, { col, row })
      const monster = generateMonster('player', summonAvailable)
      monster.col = col
      monster.row = row
      setCells(nextCells)
      setMonsters((prev) => [...prev, monster])
      setSummonAvailable(null)
      setMode('idle')
      appendLog(`You summon ${monster.name} (Lv${monster.level}, ATK ${monster.atk}/DEF ${monster.def})!`)
      return
    }

    if (mode === 'moving' && selectedMonster) {
      const target = { col, row }
      if (!isAdjacent(selectedMonster, target)) return
      if (cells[cellKey(col, row)] !== 'path') return
      if (monsterAt(col, row)) return
      setPlayerBank((prev) => ({ ...prev, movement: prev.movement - 1 }))
      setMonsters((prev) => prev.map((m) => (m.id === selectedMonster.id ? { ...m, col, row } : m)))
      appendLog(`${selectedMonster.name} moves.`)
      setMode('idle')
      setSelectedMonsterId(null)
      return
    }

    if (mode === 'attacking' && selectedMonster) {
      const targetMonster = monsterAt(col, row)
      const targetIsOpponentDm = col === OPPONENT_DM.col && row === OPPONENT_DM.row
      if (!isAdjacent(selectedMonster, { col, row })) return

      if (targetIsOpponentDm) {
        setPlayerBank((prev) => ({ ...prev, attack: prev.attack - 1 }))
        const newHp = Math.max(0, opponentDmHp - 1)
        setOpponentDmHp(newHp)
        appendLog(`${selectedMonster.name} strikes ${opponentName}'s Die Master directly! -1 HP.`)
        playHitSound()
        setMode('idle')
        setSelectedMonsterId(null)
        if (newHp <= 0) { setOutcome('victory'); playVictorySound() }
        return
      }

      if (targetMonster && targetMonster.owner === 'opponent') {
        setPlayerBank((prev) => ({ ...prev, attack: prev.attack - 1 }))
        const defenderSpends = opponentBank.defense > 0 && Math.random() < 0.6
        if (defenderSpends) setOpponentBank((prev) => ({ ...prev, defense: prev.defense - 1 }))
        const dmg = computeDamage(selectedMonster.atk, targetMonster.def, defenderSpends)
        playHitSound()
        const newHp = targetMonster.hp - dmg
        appendLog(
          `${selectedMonster.name} attacks ${targetMonster.name} for ${dmg}${defenderSpends ? ' (defense crest spent)' : ''}.`
        )
        if (newHp <= 0) {
          appendLog(`${targetMonster.name} is destroyed!`)
          setMonsters((prev) => prev.filter((m) => m.id !== targetMonster.id))
        } else {
          setMonsters((prev) => prev.map((m) => (m.id === targetMonster.id ? { ...m, hp: newHp } : m)))
        }
        setMode('idle')
        setSelectedMonsterId(null)
      }
    }
  }

  const handleEndTurn = () => {
    if (outcome) return
    setMode('idle')
    setSelectedMonsterId(null)
    setHasRolledThisTurn(false)
    setLastRoll(null)
    setSummonAvailable(null)
    setTurn('opponent')
    setTimeout(() => runOpponentTurn(), 400)
  }

  const runOpponentTurn = () => {
    const results = rollDice(opponentPowerBonus)
    const { nextBank, summonLevel } = resolveRoll(opponentBank, results)
    let bank = nextBank
    let currentMonsters = monsters
    let dmHp = playerDmHp
    let cellState = cells

    appendLog(`${opponentName} rolls the dice.`)

    if (summonLevel && currentMonsters.filter((m) => m.owner === 'opponent').length < 3) {
      const candidates = findUnfoldCandidates(cellState, 'opponent')
      if (candidates.length > 0) {
        const spot = candidates[Math.floor(Math.random() * candidates.length)]
        cellState = unfoldNet(cellState, spot)
        const monster = generateMonster('opponent', summonLevel)
        monster.col = spot.col
        monster.row = spot.row
        currentMonsters = [...currentMonsters, monster]
        appendLog(`${opponentName} summons ${monster.name} (Lv${monster.level})!`)
      }
    }

    const opponentMonsters = currentMonsters.filter((m) => m.owner === 'opponent')
    for (const monster of opponentMonsters) {
      const distToPlayerDm = Math.abs(monster.col - PLAYER_DM.col) + Math.abs(monster.row - PLAYER_DM.row)
      if (distToPlayerDm === 1 && bank.attack > 0) {
        bank = { ...bank, attack: bank.attack - 1 }
        dmHp = Math.max(0, dmHp - 1)
        appendLog(`${monster.name} strikes your Die Master directly! -1 HP.`)
        playTakeDamageSound()
        continue
      }
      if (bank.movement > 0) {
        const dx = PLAYER_DM.col - monster.col
        const dy = PLAYER_DM.row - monster.row
        let nextCol = monster.col
        let nextRow = monster.row
        if (Math.abs(dx) > Math.abs(dy)) nextCol += Math.sign(dx)
        else nextRow += Math.sign(dy)
        const key = `${nextCol},${nextRow}`
        const occupied = currentMonsters.some((m) => m.col === nextCol && m.row === nextRow)
        if (cellState[key] === 'path' && !occupied) {
          bank = { ...bank, movement: bank.movement - 1 }
          currentMonsters = currentMonsters.map((m) => (m.id === monster.id ? { ...m, col: nextCol, row: nextRow } : m))
        }
      }
    }

    setCells(cellState)
    setMonsters(currentMonsters)
    setOpponentBank(bank)
    setPlayerDmHp(dmHp)

    if (dmHp <= 0) {
      setOutcome('defeat')
      playDefeatSound()
    }
    setTurn('player')
  }

  const handleContinue = () => {
    if (outcome === 'victory' && onVictory) onVictory()
    if (outcome === 'defeat' && onDefeat) onDefeat()
  }

  const render = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#0f1020'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    const candidates =
      mode === 'placing'
        ? findUnfoldCandidates(cells, 'player')
        : []
    const candidateSet = new Set(candidates.map((c) => `${c.col},${c.row}`))

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const key = `${c},${r}`
        const x = c * TILE
        const y = r * TILE
        if (cells[key] === 'path') {
          ctx.fillStyle = '#2a2b4a'
          ctx.fillRect(x, y, TILE - 1, TILE - 1)
        } else if (candidateSet.has(key)) {
          ctx.fillStyle = '#3a6b3a'
          ctx.fillRect(x, y, TILE - 1, TILE - 1)
        } else {
          ctx.fillStyle = '#141428'
          ctx.fillRect(x, y, TILE - 1, TILE - 1)
        }
      }
    }

    // Die Masters
    ctx.fillStyle = '#457b9d'
    ctx.fillRect(PLAYER_DM.col * TILE + 2, PLAYER_DM.row * TILE + 2, TILE - 5, TILE - 5)
    ctx.fillStyle = '#e63946'
    ctx.fillRect(OPPONENT_DM.col * TILE + 2, OPPONENT_DM.row * TILE + 2, TILE - 5, TILE - 5)

    // valid move/attack targets
    if ((mode === 'moving' || mode === 'attacking') && selectedMonster) {
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      for (const [dx, dy] of dirs) {
        const tc = selectedMonster.col + dx
        const tr = selectedMonster.row + dy
        if (tc < 0 || tc >= GRID_COLS || tr < 0 || tr >= GRID_ROWS) continue
        const key = `${tc},${tr}`
        const isOpponentDm = tc === OPPONENT_DM.col && tr === OPPONENT_DM.row
        if (mode === 'moving' && cells[key] === 'path' && !monsterAt(tc, tr)) {
          ctx.strokeStyle = '#4ea8de'
          ctx.lineWidth = 2
          ctx.strokeRect(tc * TILE + 1, tr * TILE + 1, TILE - 3, TILE - 3)
        }
        if (mode === 'attacking' && (monsterAt(tc, tr)?.owner === 'opponent' || isOpponentDm)) {
          ctx.strokeStyle = '#e63946'
          ctx.lineWidth = 2
          ctx.strokeRect(tc * TILE + 1, tr * TILE + 1, TILE - 3, TILE - 3)
        }
      }
    }

    // monsters
    for (const m of monsters) {
      ctx.fillStyle = m.owner === 'player' ? '#8ecae6' : '#f28482'
      const x = m.col * TILE
      const y = m.row * TILE
      ctx.beginPath()
      ctx.arc(x + TILE / 2, y + TILE / 2, TILE / 2 - 3, 0, Math.PI * 2)
      ctx.fill()
      if (m.id === selectedMonsterId) {
        ctx.strokeStyle = '#ffe066'
        ctx.lineWidth = 2
        ctx.stroke()
      }
      ctx.fillStyle = '#0f1020'
      ctx.font = '9px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(String(m.level), x + TILE / 2, y + TILE / 2 + 3)
    }
  }

  const getCanvasCell = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    return { col: Math.floor(x / TILE), row: Math.floor(y / TILE) }
  }

  const handleCanvasClick = (e) => {
    const { col, row } = getCanvasCell(e)
    handleTileClick(col, row)
  }

  const playerMonsters = monsters.filter((m) => m.owner === 'player')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="flex max-h-[95vh] gap-4 overflow-y-auto border-4 border-teal-400 bg-[#1c1d3a] p-4 font-mono text-white">
        <div>
          <h2 className="mb-1 text-lg font-bold text-teal-300">Dungeon Dice Monsters</h2>
          <p className="mb-2 text-xs text-gray-400">
            vs. {opponentName} ({deckFlavorName}){wagerLabel ? ` — Bet: ${wagerLabel}` : ''}
          </p>
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="border-2 border-gray-700"
            onClick={handleCanvasClick}
          />
          <div className="mt-2 flex justify-between text-xs">
            <span className="text-blue-300">Your Die Master: {playerDmHp}/{DIE_MASTER_MAX_HP} HP</span>
            <span className="text-red-300">{opponentName}: {opponentDmHp}/{DIE_MASTER_MAX_HP} HP</span>
          </div>
        </div>

        <div className="w-64">
          <div className="mb-3 border-2 border-gray-600 bg-[#0f1020] p-2 text-xs">
            <p className="mb-1 font-bold text-gray-300">Crest Bank</p>
            {CREST_TYPES.map((type) => (
              <div key={type} className="mb-1 flex items-center justify-between">
                <span style={{ color: CREST_COLORS[type] }}>{CREST_LABELS[type]}</span>
                <span>{playerBank[type]}/{CREST_CAP}</span>
              </div>
            ))}
          </div>

          {lastRoll && (
            <div className="mb-3 border-2 border-gray-600 bg-[#0f1020] p-2 text-xs">
              <p className="mb-1 font-bold text-gray-300">Last Roll</p>
              {lastRoll.map((r, i) => (
                <span key={i} className="mr-2">
                  {r.type === 'summon' ? `Lv${r.level}★` : CREST_LABELS[r.type]}
                </span>
              ))}
            </div>
          )}

          <div className="mb-3 h-24 overflow-y-auto border-2 border-gray-700 bg-black p-2 text-xs text-gray-300">
            {log.map((line, i) => <div key={i}>{line}</div>)}
          </div>

          {!outcome && turn === 'player' && (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleRoll}
                disabled={hasRolledThisTurn}
                className="border-2 border-teal-400 py-1 text-xs hover:bg-teal-400 hover:text-black disabled:opacity-30"
              >
                Roll 3 Dice
              </button>
              {summonAvailable && mode !== 'placing' && (
                <button
                  onClick={handleStartSummon}
                  className="border-2 border-yellow-400 py-1 text-xs text-yellow-300 hover:bg-yellow-400 hover:text-black"
                >
                  Summon Lv{summonAvailable} Monster (click a green tile)
                </button>
              )}
              {mode === 'placing' && (
                <p className="text-center text-xs text-green-400">Click a highlighted tile to place your monster.</p>
              )}

              <p className="mt-1 text-xs font-bold text-gray-400">Your Monsters</p>
              {playerMonsters.length === 0 && <p className="text-xs text-gray-600">None yet.</p>}
              {playerMonsters.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-xs">
                  <span>{m.name} (Lv{m.level}, {m.hp}/{m.maxHp}HP)</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleStartMove(m.id)}
                      disabled={playerBank.movement <= 0}
                      className="border border-blue-400 px-1 text-blue-300 hover:bg-blue-400 hover:text-black disabled:opacity-30"
                    >
                      Move
                    </button>
                    <button
                      onClick={() => handleStartAttack(m.id)}
                      disabled={playerBank.attack <= 0}
                      className="border border-red-400 px-1 text-red-300 hover:bg-red-400 hover:text-black disabled:opacity-30"
                    >
                      Atk
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={handleEndTurn}
                className="mt-2 border-4 border-teal-400 bg-teal-500 py-2 font-bold text-black hover:bg-teal-400"
              >
                End Turn
              </button>
              <button
                onClick={onClose}
                className="border-2 border-gray-600 py-1 text-xs text-gray-400 hover:bg-gray-700"
              >
                Forfeit Match
              </button>
            </div>
          )}

          {!outcome && turn === 'opponent' && (
            <p className="text-center text-sm text-gray-400">{opponentName} is taking their turn...</p>
          )}

          {outcome && (
            <div className="text-center">
              <p className={`mb-2 font-bold ${outcome === 'victory' ? 'text-green-400' : 'text-red-500'}`}>
                {outcome === 'victory' ? 'You destroyed their Die Master!' : 'Your Die Master was destroyed.'}
              </p>
              <button
                onClick={handleContinue}
                className="border-4 border-green-400 bg-green-500 px-6 py-2 font-bold text-black hover:bg-green-400"
              >
                Continue
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
