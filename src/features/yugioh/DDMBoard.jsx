import { useEffect, useRef, useState } from 'react'
import {
  GRID_COLS, GRID_ROWS, CREST_TYPES, CREST_CAP, DIE_MASTER_MAX_HP, MAX_DIMENSIONS,
  PLAYER_DM, OPPONENT_DM,
  createInitialBoard, createEmptyCrestBank, rollDice, resolveRoll,
  generateMonster, findUnfoldCandidates, unfoldNet, isAdjacent, computeDamage,
} from './ddmEngine'
import {
  canAffordAbility, spendCrests, manhattanDistance, isInLine, computeKnockback, rollParry,
  IMPLEMENTED_MECHANICS, isAbilityImplemented,
} from './ddmAbilities'
import { DDM_ITEM_CATALOG, canAffordItem, isItemImplemented } from './ddmItemCatalog'
import { pickCatalogMonster } from './ddmMonsterCatalog'
import { playHitSound, playClickSound, playVictorySound, playDefeatSound, playTakeDamageSound } from '../../audio/sfx'

const TILE = 18
const CANVAS_W = GRID_COLS * TILE
const CANVAS_H = GRID_ROWS * TILE
const BARRIER_HP = 20
const BARRIER_TURNS = 2

const CREST_LABELS = { movement: 'Move', attack: 'Attack', defense: 'Defense', spell: 'Spell (Magic)', trap: 'Trap' }
const CREST_COLORS = { movement: '#4ea8de', attack: '#e63946', defense: '#2a9d8f', spell: '#f4a261', trap: '#9b5de5' }

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
  const [barriers, setBarriers] = useState([])
  const [defSuppressedIds, setDefSuppressedIds] = useState([])
  const [traps, setTraps] = useState([]) // [{id, itemId, col, row, trigger, mechanic, params}]
  const [terrainTiles, setTerrainTiles] = useState([]) // [{id, itemId, col, row, owner, mechanic, params}]
  const [dmImmuneTurns, setDmImmuneTurns] = useState(0)
  const [soulHarvesterActive, setSoulHarvesterActive] = useState(false)
  const [pendingItem, setPendingItem] = useState(null) // { item }
  const [showItems, setShowItems] = useState(false)
  // Each side has its own 15-die pool and 10-Dimension cap (rulebook).
  const [playerDimensionsUsed, setPlayerDimensionsUsed] = useState(0)
  const [opponentDimensionsUsed, setOpponentDimensionsUsed] = useState(0)
  const [turn, setTurn] = useState('player')
  const [lastRoll, setLastRoll] = useState(null)
  const [summonAvailable, setSummonAvailable] = useState(null)
  const [mode, setMode] = useState('idle') // idle | placing | moving | attacking | ability-target
  const [selectedMonsterId, setSelectedMonsterId] = useState(null)
  const [pendingAbility, setPendingAbility] = useState(null) // { monsterId, ability }
  const [log, setLog] = useState([`A Dungeon Dice Monsters match begins against ${opponentName}!`])
  const [outcome, setOutcome] = useState(null)
  const [hasRolledThisTurn, setHasRolledThisTurn] = useState(false)

  const appendLog = (line) => setLog((prev) => [...prev.slice(-5), line])

  useEffect(() => {
    render()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, monsters, mode, selectedMonsterId, barriers, traps, terrainTiles, pendingItem])

  const selectedMonster = monsters.find((m) => m.id === selectedMonsterId)

  const monsterAt = (col, row) => monsters.find((m) => m.col === col && m.row === row)
  const barrierAt = (col, row) => barriers.find((b) => b.col === col && b.row === row)
  const isOccupiedOrBarrier = (col, row) => !!monsterAt(col, row) || !!barrierAt(col, row)
  const effectiveDef = (m) => (defSuppressedIds.includes(m.id) ? 0 : m.def + (m.tempDefBuff || 0))

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
    if (!summonAvailable || playerDimensionsUsed >= MAX_DIMENSIONS) return
    setMode('placing')
  }

  const handleStartMove = (monsterId) => {
    const m = monsters.find((mm) => mm.id === monsterId)
    if (playerBank.movement <= 0 || m?.frozen) return
    setSelectedMonsterId(monsterId)
    setMode('moving')
  }

  const handleStartAttack = (monsterId) => {
    const m = monsters.find((mm) => mm.id === monsterId)
    if (playerBank.attack <= 0 || m?.frozen) return
    setSelectedMonsterId(monsterId)
    setMode('attacking')
  }

  const handleStartAbility = (monster) => {
    const ability = monster.ability
    if (!ability || ability.target === 'passive') return
    if (monster.silencedTurns > 0 || monster.frozen) return
    if (!isAbilityImplemented(ability)) return
    if (!canAffordAbility(playerBank, ability.crestCost)) return

    if (ability.target === 'self') {
      resolveSelfAbility(monster, ability)
      return
    }
    setSelectedMonsterId(monster.id)
    setPendingAbility({ monsterId: monster.id, ability })
    setMode('ability-target')
  }

  const resolveSelfAbility = (caster, ability) => {
    setPlayerBank((prev) => spendCrests(prev, ability.crestCost))

    if (ability.id === 'detonate') {
      const targets = monsters.filter((m) => m.owner === 'opponent' && isAdjacent(caster, m))
      appendLog(`${caster.name} detonates! ${targets.length} nearby ${opponentName} monster(s) take 10 damage.`)
      setMonsters((prev) =>
        prev
          .filter((m) => m.id !== caster.id)
          .map((m) => (targets.some((t) => t.id === m.id) ? { ...m, hp: m.hp - 10 } : m))
          .filter((m) => m.hp > 0)
      )
      playHitSound()
    } else if (ability.id === 'hyper_focus') {
      appendLog(`${caster.name} focuses - +10 ATK this turn, but can't move.`)
      setMonsters((prev) =>
        prev.map((m) => (m.id === caster.id ? { ...m, atk: m.atk + 10, moveLocked: true } : m))
      )
    } else if (ability.id === 'meltdown') {
      const targets = monsters.filter((m) => m.owner === 'opponent' && manhattanDistance(caster, m) <= 3)
      appendLog(`${caster.name} triggers Meltdown - ${targets.length} ${opponentName} monster(s) lose all DEF this turn.`)
      setDefSuppressedIds((prev) => [...new Set([...prev, ...targets.map((t) => t.id)])])
    } else if (IMPLEMENTED_MECHANICS.has(ability.mechanic)) {
      resolveGenericSelfMechanic(caster, ability)
    }
    setMode('idle')
    setSelectedMonsterId(null)
  }

  // Generic resolver for self-target abilities across the 150-monster
  // series (see ddmAbilities.js IMPLEMENTED_MECHANICS for the full list of
  // what's wired vs left as flavor-only).
  const resolveGenericSelfMechanic = (caster, ability) => {
    const { mechanic, params = {} } = ability

    if (mechanic === 'temp_def_buff') {
      setMonsters((prev) => prev.map((m) => (m.id === caster.id ? { ...m, tempDefBuff: (m.tempDefBuff || 0) + params.amount } : m)))
      appendLog(`${caster.name} uses ${ability.name}: +${params.amount} DEF this turn.`)
    } else if (mechanic === 'temp_atk_buff') {
      setMonsters((prev) =>
        prev.map((m) =>
          m.id === caster.id
            ? { ...m, atk: m.atk + params.amount, tempAtkBuffApplied: (m.tempAtkBuffApplied || 0) + params.amount, moveLocked: !!params.moveLocked || m.moveLocked }
            : m
        )
      )
      appendLog(`${caster.name} uses ${ability.name}: +${params.amount} ATK this turn.`)
    } else if (mechanic === 'freeze_adjacent') {
      const targets = monsters.filter((m) => m.owner === 'opponent' && isAdjacent(caster, m))
      setMonsters((prev) => prev.map((m) => (targets.some((t) => t.id === m.id) ? { ...m, frozen: true, freezeTurnsLeft: params.duration || 1 } : m)))
      appendLog(`${caster.name} uses ${ability.name}: freezes ${targets.length} adjacent enem${targets.length === 1 ? 'y' : 'ies'}.`)
    } else if (mechanic === 'damage_radius') {
      const radius = params.radius || 1
      const eligible = monsters.filter(
        (m) => m.id !== caster.id && ((m.owner === 'opponent') || (params.includeAllies && m.owner === 'player')) && manhattanDistance(caster, m) <= radius
      )
      const targets = params.maxTargets ? eligible.slice(0, params.maxTargets) : eligible
      const amount = params.useAtk ? caster.atk : params.amount
      setMonsters((prev) =>
        prev.map((m) => (targets.some((t) => t.id === m.id) ? { ...m, hp: m.hp - amount } : m)).filter((m) => m.hp > 0)
      )
      appendLog(`${caster.name} uses ${ability.name}: hits ${targets.length} target(s) for ${amount}.`)
      playHitSound()
    } else if (mechanic === 'damage_all_enemies') {
      setMonsters((prev) => prev.map((m) => (m.owner === 'opponent' ? { ...m, hp: m.hp - params.amount } : m)).filter((m) => m.hp > 0))
      appendLog(`${caster.name} uses ${ability.name}: hits all enemies for ${params.amount}.`)
      playHitSound()
    } else if (mechanic === 'crest_steal') {
      const type = params.crestType
      const amt = Math.min(params.amount, opponentBank[type] || 0)
      setOpponentBank((prev) => ({ ...prev, [type]: prev[type] - amt }))
      if (!params.destroyOnly) setPlayerBank((prev) => ({ ...prev, [type]: Math.min(CREST_CAP, prev[type] + amt) }))
      appendLog(`${caster.name} uses ${ability.name}: ${params.destroyOnly ? 'destroys' : 'steals'} ${amt} ${CREST_LABELS[type]} from ${opponentName}.`)
    } else if (mechanic === 'crest_destroy') {
      if (params.crestType === 'any') {
        setOpponentBank(createEmptyCrestBank())
        appendLog(`${caster.name} uses ${ability.name}: wipes ${opponentName}'s crest pool.`)
      } else {
        const amt = Math.min(params.amount, opponentBank[params.crestType] || 0)
        setOpponentBank((prev) => ({ ...prev, [params.crestType]: prev[params.crestType] - amt }))
        appendLog(`${caster.name} uses ${ability.name}: destroys ${amt} ${CREST_LABELS[params.crestType]} from ${opponentName}.`)
      }
    } else if (mechanic === 'crest_gain') {
      const type = params.crestType === 'choice' ? 'movement' : params.crestType
      setPlayerBank((prev) => ({ ...prev, [type]: Math.min(CREST_CAP, prev[type] + params.amount) }))
      appendLog(`${caster.name} uses ${ability.name}: gains ${params.amount} ${CREST_LABELS[type]}.`)
    } else if (mechanic === 'self_destruct_adjacent') {
      const targets = monsters.filter((m) => m.id !== caster.id && (m.owner === 'opponent' || params.includeAllies) && isAdjacent(caster, m))
      setMonsters((prev) =>
        prev
          .filter((m) => m.id !== caster.id)
          .map((m) => (targets.some((t) => t.id === m.id) ? { ...m, hp: m.hp - params.amount } : m))
          .filter((m) => m.hp > 0)
      )
      appendLog(`${caster.name} self-destructs: ${targets.length} adjacent unit(s) take ${params.amount} damage.`)
      playHitSound()
    }
  }

  const resolveTargetedAbility = (col, row) => {
    const caster = monsters.find((m) => m.id === pendingAbility.monsterId)
    const ability = pendingAbility.ability
    if (!caster) return

    if (ability.id === 'firewall') {
      // Adjacent tile only - it doesn't need to already be a path, since
      // the barrier creates its own impassable ground.
      if (!isAdjacent(caster, { col, row }) || isOccupiedOrBarrier(col, row)) return
      setPlayerBank((prev) => spendCrests(prev, ability.crestCost))
      setBarriers((prev) => [...prev, { id: `barrier_${Date.now()}`, col, row, hp: BARRIER_HP, turnsLeft: BARRIER_TURNS, owner: 'player' }])
      appendLog(`${caster.name} raises a Firewall barrier.`)
    } else if (ability.id === 'piercing_breath') {
      const target = monsterAt(col, row)
      if (!target || target.owner !== 'opponent' || !isInLine(caster, target)) return
      setPlayerBank((prev) => spendCrests(prev, ability.crestCost))
      const newHp = target.hp - 10
      appendLog(`${caster.name}'s Piercing Breath hits ${target.name} for 10 damage, ignoring Defense.`)
      playHitSound()
      if (newHp <= 0) {
        setMonsters((prev) => prev.filter((m) => m.id !== target.id))
      } else {
        setMonsters((prev) => prev.map((m) => (m.id === target.id ? { ...m, hp: newHp } : m)))
      }
    } else if (ability.id === 'gale_force') {
      const target = monsterAt(col, row)
      if (!target || target.owner !== 'opponent' || !isAdjacent(caster, target)) return
      setPlayerBank((prev) => spendCrests(prev, ability.crestCost))
      const dest = computeKnockback(caster, target, 3, GRID_COLS, GRID_ROWS, (c, r) => isOccupiedOrBarrier(c, r) || cells[`${c},${r}`] !== 'path')
      appendLog(`${caster.name}'s Gale Force pushes ${target.name} away.`)
      setMonsters((prev) => prev.map((m) => (m.id === target.id ? { ...m, col: dest.col, row: dest.row } : m)))
    } else if (IMPLEMENTED_MECHANICS.has(ability.mechanic)) {
      resolveGenericTargetedMechanic(caster, ability, col, row)
    }

    setMode('idle')
    setSelectedMonsterId(null)
    setPendingAbility(null)
  }

  // Generic resolver for targeted abilities (adjacent-enemy / adjacent-empty
  // / line / ally-adjacent / adjacent-any). Validates targeting itself since
  // the shared click handler doesn't know each ability's target rules.
  const resolveGenericTargetedMechanic = (caster, ability, col, row) => {
    const { mechanic, params = {}, target: targetKind } = ability
    const targetMonster = monsterAt(col, row)

    const validTarget = () => {
      if (targetKind === 'adjacent-enemy') return targetMonster?.owner === 'opponent' && isAdjacent(caster, { col, row })
      if (targetKind === 'adjacent-empty') return !isOccupiedOrBarrier(col, row) && isAdjacent(caster, { col, row })
      if (targetKind === 'line') return targetMonster?.owner === 'opponent' && isInLine(caster, { col, row })
      if (targetKind === 'ally-adjacent') return targetMonster?.owner === 'player' && targetMonster.id !== caster.id && isAdjacent(caster, { col, row })
      if (targetKind === 'adjacent-any') return isAdjacent(caster, { col, row })
      return false
    }
    if (!validTarget()) return
    setPlayerBank((prev) => spendCrests(prev, ability.crestCost))

    if (mechanic === 'damage_target' || mechanic === 'damage_line') {
      const dmg = params.amount
      appendLog(`${caster.name} uses ${ability.name}: ${dmg} damage to ${targetMonster.name}${mechanic === 'damage_line' ? ', ignoring Defense' : ''}.`)
      playHitSound()
      const newHp = targetMonster.hp - dmg
      setMonsters((prev) => (newHp <= 0 ? prev.filter((m) => m.id !== targetMonster.id) : prev.map((m) => (m.id === targetMonster.id ? { ...m, hp: newHp } : m))))
    } else if (mechanic === 'perm_def_debuff') {
      setMonsters((prev) => prev.map((m) => (m.id === targetMonster.id ? { ...m, def: Math.max(0, m.def - params.amount) } : m)))
      appendLog(`${caster.name} uses ${ability.name}: ${targetMonster.name}'s DEF permanently reduced by ${params.amount}.`)
    } else if (mechanic === 'temp_atk_debuff') {
      const nextAtk = params.setTo !== undefined ? params.setTo : Math.max(0, targetMonster.atk - params.amount)
      const applied = targetMonster.atk - nextAtk
      setMonsters((prev) => prev.map((m) => (m.id === targetMonster.id ? { ...m, atk: nextAtk, tempAtkDebuffApplied: (m.tempAtkDebuffApplied || 0) + applied } : m)))
      appendLog(`${caster.name} uses ${ability.name}: reduces ${targetMonster.name}'s ATK.`)
    } else if (mechanic === 'freeze_target') {
      setMonsters((prev) => prev.map((m) => (m.id === targetMonster.id ? { ...m, frozen: true, freezeTurnsLeft: params.duration || 1 } : m)))
      appendLog(`${caster.name} uses ${ability.name}: freezes ${targetMonster.name}.`)
    } else if (mechanic === 'poison') {
      setMonsters((prev) => prev.map((m) => (m.id === targetMonster.id ? { ...m, poisonPerTurn: params.amountPerTurn, poisonTurnsLeft: params.duration } : m)))
      appendLog(`${caster.name} uses ${ability.name}: poisons ${targetMonster.name}.`)
    } else if (mechanic === 'silence') {
      setMonsters((prev) => prev.map((m) => (m.id === targetMonster.id ? { ...m, silencedTurns: params.duration } : m)))
      appendLog(`${caster.name} uses ${ability.name}: silences ${targetMonster.name}.`)
    } else if (mechanic === 'push') {
      const dest = computeKnockback(caster, targetMonster, params.tiles || 1, GRID_COLS, GRID_ROWS, (c, r) => isOccupiedOrBarrier(c, r) || cells[`${c},${r}`] !== 'path')
      setMonsters((prev) => prev.map((m) => (m.id === targetMonster.id ? { ...m, col: dest.col, row: dest.row } : m)))
      appendLog(`${caster.name} uses ${ability.name}: pushes ${targetMonster.name} away.`)
    } else if (mechanic === 'pull_target') {
      const dest = computeKnockback(targetMonster, caster, params.tiles || 1, GRID_COLS, GRID_ROWS, (c, r) => isOccupiedOrBarrier(c, r) || cells[`${c},${r}`] !== 'path')
      setMonsters((prev) => prev.map((m) => (m.id === targetMonster.id ? { ...m, col: dest.col, row: dest.row } : m)))
      appendLog(`${caster.name} uses ${ability.name}: pulls ${targetMonster.name} closer.`)
    } else if (mechanic === 'heal_target') {
      setMonsters((prev) => prev.map((m) => (m.id === targetMonster.id ? { ...m, hp: Math.min(m.maxHp, m.hp + params.amount) } : m)))
      appendLog(`${caster.name} uses ${ability.name}: heals ${targetMonster.name} for ${params.amount}.`)
    } else if (mechanic === 'shield_next_hit') {
      setMonsters((prev) => prev.map((m) => (m.id === targetMonster.id ? { ...m, shielded: true } : m)))
      appendLog(`${caster.name} uses ${ability.name}: shields ${targetMonster.name} from the next hit.`)
    } else if (mechanic === 'temp_def_buff') {
      setMonsters((prev) => prev.map((m) => (m.id === targetMonster.id ? { ...m, tempDefBuff: (m.tempDefBuff || 0) + params.amount } : m)))
      appendLog(`${caster.name} uses ${ability.name}: +${params.amount} DEF to ${targetMonster.name}.`)
    } else if (mechanic === 'barrier_create') {
      setBarriers((prev) => [...prev, { id: `barrier_${Date.now()}`, col, row, hp: params.hp || BARRIER_HP, turnsLeft: params.duration || BARRIER_TURNS, owner: 'player' }])
      appendLog(`${caster.name} uses ${ability.name}: creates a barrier.`)
    } else if (mechanic === 'summon_clone') {
      const clone = {
        id: `clone_${Date.now()}`, owner: caster.owner, level: 1, name: `${caster.name}'s Clone`, ability: null,
        atk: params.atk || 0, def: params.def || 0, hp: params.hp || 10, maxHp: params.hp || 10, col, row,
      }
      setMonsters((prev) => [...prev, clone])
      appendLog(`${caster.name} uses ${ability.name}: summons a clone.`)
    } else if (mechanic === 'self_destruct_target') {
      playHitSound()
      if (targetMonster) {
        const newHp = targetMonster.hp - params.amount
        setMonsters((prev) =>
          prev
            .filter((m) => m.id !== caster.id)
            .map((m) => (m.id === targetMonster.id ? { ...m, hp: newHp } : m))
            .filter((m) => m.hp > 0)
        )
      } else {
        setMonsters((prev) => prev.filter((m) => m.id !== caster.id))
      }
      appendLog(`${caster.name} uses ${ability.name} and is destroyed.`)
    }
  }

  // --- Items (traps/spells/equipment/terrain/artifacts) ----------------
  // Unlike monster abilities, items are played directly from the crest
  // pool - there's no summoned "caster", so targeting is absolute
  // (anywhere on the board / any ally / any enemy) rather than adjacency-
  // relative.

  const handleStartItem = (item) => {
    if (!isItemImplemented(item) || !canAffordItem(playerBank, item.cost) || turn !== 'player' || outcome) return
    if (item.target === 'self') {
      resolveSelfItem(item)
      return
    }
    setPendingItem({ item })
    setMode('item-target')
  }

  const placeTrapOrTerrain = (item, col, row) => {
    setPlayerBank((prev) => spendCrests(prev, item.cost))
    if (item.type === 'trap') {
      setTraps((prev) => [...prev, { id: `trap_${Date.now()}`, itemId: item.id, col, row, trigger: item.trigger, mechanic: item.mechanic, params: item.params || {}, name: item.name }])
      appendLog(`You set ${item.name} face-down.`)
    } else {
      setTerrainTiles((prev) => [...prev, { id: `terrain_${Date.now()}`, itemId: item.id, col, row, owner: 'player', mechanic: item.mechanic, params: item.params || {}, name: item.name }])
      appendLog(`You deploy ${item.name}.`)
    }
  }

  const resolveSelfItem = (item) => {
    const { mechanic, params = {} } = item
    setPlayerBank((prev) => spendCrests(prev, item.cost))

    if (mechanic === 'gain_random_crests') {
      setPlayerBank((prev) => {
        const next = { ...prev }
        for (let i = 0; i < params.count; i++) {
          const type = CREST_TYPES[Math.floor(Math.random() * CREST_TYPES.length)]
          next[type] = Math.min(CREST_CAP, next[type] + 1)
        }
        return next
      })
      appendLog(`${item.name}: gained ${params.count} random crests.`)
    } else if (mechanic === 'steal_random_crests') {
      let stolen = 0
      setOpponentBank((prevOpp) => {
        const nextOpp = { ...prevOpp }
        const available = CREST_TYPES.filter((t) => nextOpp[t] > 0)
        for (let i = 0; i < params.count && available.length > 0; i++) {
          const idx = Math.floor(Math.random() * available.length)
          const type = available[idx]
          nextOpp[type] -= 1
          stolen++
          setPlayerBank((prevPlayer) => ({ ...prevPlayer, [type]: Math.min(CREST_CAP, prevPlayer[type] + 1) }))
          if (nextOpp[type] === 0) available.splice(idx, 1)
        }
        return nextOpp
      })
      appendLog(`${item.name}: stole ${stolen} crest(s) from ${opponentName}.`)
    } else if (mechanic === 'cleanse_board') {
      setMonsters((prev) =>
        prev.map((m) => ({
          ...m,
          tempAtkBuffApplied: 0,
          tempAtkDebuffApplied: 0,
          tempDefBuff: 0,
          frozen: false,
          freezeTurnsLeft: 0,
          silencedTurns: 0,
          poisonTurnsLeft: 0,
        }))
      )
      setDefSuppressedIds([])
      appendLog(`${item.name}: cleared all buffs, debuffs, and status effects on the board.`)
    } else if (mechanic === 'fill_crest_pool') {
      setPlayerBank({ movement: CREST_CAP, attack: CREST_CAP, defense: CREST_CAP, spell: CREST_CAP, trap: CREST_CAP })
      appendLog(`${item.name}: crest pool filled to maximum.`)
    } else if (mechanic === 'clear_board_effects') {
      setTraps([])
      setTerrainTiles([])
      setBarriers([])
      setMonsters((prev) => prev.map((m) => ({ ...m, equippedItemId: null, equipIgnoresDef: false, equipTrapImmune: false, equipLifestealPct: 0, equipShieldPerTurn: false, equipRecoil: 0 })))
      appendLog(`${item.name}: destroyed all terrain, traps, and equipped items on the board.`)
    } else if (mechanic === 'dm_immune') {
      setDmImmuneTurns(params.duration)
      appendLog(`${item.name}: your Die Master is immune to direct damage for ${params.duration} turns.`)
    } else if (mechanic === 'convert_opponent_crests') {
      setOpponentBank((prev) => {
        const amt = prev[params.from]
        return { ...prev, [params.from]: 0, [params.to]: Math.min(CREST_CAP, prev[params.to] + amt) }
      })
      appendLog(`${item.name}: converted ${opponentName}'s ${CREST_LABELS[params.from]} crests into ${CREST_LABELS[params.to]}.`)
    } else if (mechanic === 'silence_all_enemies') {
      setMonsters((prev) => prev.map((m) => (m.owner === 'opponent' ? { ...m, silencedTurns: params.duration } : m)))
      appendLog(`${item.name}: silenced all of ${opponentName}'s monsters.`)
    } else if (mechanic === 'soul_harvester_activate') {
      setSoulHarvesterActive(true)
      appendLog(`${item.name}: active for the rest of the match.`)
    }
    setMode('idle')
    setPendingItem(null)
  }

  const resolveTargetedItem = (item, col, row) => {
    const { mechanic, params = {}, target: targetKind } = item
    const targetMonster = monsterAt(col, row)

    const validTarget = () => {
      if (targetKind === 'any-empty') return !isOccupiedOrBarrier(col, row) && !traps.some((t) => t.col === col && t.row === row) && !terrainTiles.some((t) => t.col === col && t.row === row)
      if (targetKind === 'ally-any') return targetMonster?.owner === 'player'
      if (targetKind === 'enemy-any') return targetMonster?.owner === 'opponent'
      return false
    }
    if (!validTarget()) return

    if (item.type === 'trap' || item.type === 'terrain') {
      placeTrapOrTerrain(item, col, row)
      setMode('idle')
      setPendingItem(null)
      return
    }

    setPlayerBank((prev) => spendCrests(prev, item.cost))

    if (mechanic === 'heal_target') {
      setMonsters((prev) => prev.map((m) => (m.id === targetMonster.id ? { ...m, hp: Math.min(m.maxHp, m.hp + params.amount) } : m)))
      appendLog(`${item.name}: heals ${targetMonster.name} for ${params.amount}.`)
    } else if (mechanic === 'damage_target_and_nearest') {
      const others = monsters.filter((m) => m.owner === 'opponent' && m.id !== targetMonster.id)
      const nearest = others.reduce((best, m) => {
        const d = manhattanDistance(targetMonster, m)
        return !best || d < best.dist ? { m, dist: d } : best
      }, null)
      appendLog(`${item.name}: ${params.amount} damage to ${targetMonster.name}${nearest ? ` and ${nearest.m.name}` : ''}.`)
      playHitSound()
      setMonsters((prev) =>
        prev
          .map((m) => {
            if (m.id === targetMonster.id) return { ...m, hp: m.hp - params.amount }
            if (nearest && m.id === nearest.m.id) return { ...m, hp: m.hp - params.amount }
            return m
          })
          .filter((m) => m.hp > 0)
      )
    } else if (mechanic === 'berserk_buff') {
      setMonsters((prev) =>
        prev.map((m) =>
          m.id === targetMonster.id
            ? { ...m, atk: m.atk + params.amount, tempAtkBuffApplied: (m.tempAtkBuffApplied || 0) + params.amount, endTurnSelfDamage: (m.endTurnSelfDamage || 0) + params.selfDamage }
            : m
        )
      )
      appendLog(`${item.name}: ${targetMonster.name} gains +${params.amount} ATK this turn (will take ${params.selfDamage} damage at end of turn).`)
    } else if (mechanic === 'upgrade_to_level4') {
      if (targetMonster.level < 2 || targetMonster.level > 3) {
        appendLog(`${item.name} requires a Level 2 or 3 monster.`)
      } else {
        const upgraded = pickCatalogMonster(4)
        if (upgraded) {
          setMonsters((prev) =>
            prev.map((m) =>
              m.id === targetMonster.id
                ? { ...m, level: 4, name: upgraded.name, creatureType: upgraded.creatureType, ability: upgraded.ability, atk: upgraded.atk, def: upgraded.def, hp: upgraded.hp, maxHp: upgraded.hp }
                : m
            )
          )
          appendLog(`${item.name}: ${targetMonster.name} is reforged into ${upgraded.name}!`)
        }
      }
    } else if (item.type === 'equip') {
      setMonsters((prev) =>
        prev.map((m) => {
          if (m.id !== targetMonster.id) return m
          let next = { ...m, equippedItemId: item.id }
          if (mechanic === 'equip_stat') next = { ...next, atk: next.atk + (params.atk || 0), def: next.def + (params.def || 0) }
          else if (mechanic === 'equip_stat_ignore_def') next = { ...next, atk: next.atk + (params.atk || 0), equipIgnoresDef: true }
          else if (mechanic === 'equip_trap_immune') next = { ...next, equipTrapImmune: true }
          else if (mechanic === 'equip_lifesteal') next = { ...next, equipLifestealPct: params.pct }
          else if (mechanic === 'equip_shield_per_turn') next = { ...next, equipShieldPerTurn: true, shielded: true }
          else if (mechanic === 'equip_stat_recoil') next = { ...next, def: next.def + (params.def || 0), equipRecoil: params.recoil }
          return next
        })
      )
      appendLog(`You equip ${item.name} to ${targetMonster.name}.`)
    }

    setMode('idle')
    setPendingItem(null)
  }

  // A monster landing on (col,row) sets off any face-down step-trigger trap
  // there. Only opponent monsters can trigger player-set traps in this
  // pass (traps are player-only, and the opponent's own summon zone is far
  // from where a player would place one) - findTrapAt is still checked
  // generically for both sides in case that changes later.
  const findTrapAt = (col, row) => traps.find((t) => t.col === col && t.row === row && t.trigger === 'step')

  const cellKey = (c, r) => `${c},${r}`

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
      setPlayerDimensionsUsed((d) => d + 1)
      setMode('idle')
      appendLog(`You summon ${monster.name} (Lv${monster.level}, ATK ${monster.atk}/DEF ${monster.def})${monster.ability ? ` - ${monster.ability.name}` : ''}!`)
      return
    }

    if (mode === 'ability-target') {
      resolveTargetedAbility(col, row)
      return
    }

    if (mode === 'item-target' && pendingItem) {
      resolveTargetedItem(pendingItem.item, col, row)
      return
    }

    if (mode === 'moving' && selectedMonster) {
      if (selectedMonster.moveLocked) return
      const target = { col, row }
      if (!isAdjacent(selectedMonster, target)) return
      if (cells[cellKey(col, row)] !== 'path') return
      if (isOccupiedOrBarrier(col, row)) return
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

        // Parry (Mystic Blader passive): d6 roll, 4-6 negates all damage.
        if (targetMonster.ability?.id === 'parry' && rollParry()) {
          appendLog(`${targetMonster.name} parries the attack! No damage.`)
          setMode('idle')
          setSelectedMonsterId(null)
          return
        }

        if (targetMonster.shielded) {
          appendLog(`${targetMonster.name}'s shield absorbs the attack completely!`)
          setMonsters((prev) => prev.map((m) => (m.id === targetMonster.id ? { ...m, shielded: false } : m)))
          setMode('idle')
          setSelectedMonsterId(null)
          return
        }

        const defenderSpends = opponentBank.defense > 0 && Math.random() < 0.6
        if (defenderSpends) setOpponentBank((prev) => ({ ...prev, defense: prev.defense - 1 }))
        const dmg = selectedMonster.equipIgnoresDef
          ? selectedMonster.atk
          : computeDamage(selectedMonster.atk, effectiveDef(targetMonster), defenderSpends)
        playHitSound()
        const newHp = targetMonster.hp - dmg
        appendLog(
          `${selectedMonster.name} attacks ${targetMonster.name} for ${dmg}${defenderSpends ? ' (defense crest spent)' : ''}.`
        )

        // Vampiric Amulet (equip passive): attacker heals a % of damage dealt.
        if (selectedMonster.equipLifestealPct) {
          const healed = Math.round(dmg * selectedMonster.equipLifestealPct)
          setMonsters((prev) => prev.map((m) => (m.id === selectedMonster.id ? { ...m, hp: Math.min(m.maxHp, m.hp + healed) } : m)))
        }

        // Reflect Damage (passive): defender hits back regardless of outcome.
        if (targetMonster.ability?.mechanic === 'reflect_damage') {
          const reflectAmount = targetMonster.ability.params?.amount || 0
          appendLog(`${targetMonster.name} reflects ${reflectAmount} damage back to ${selectedMonster.name}.`)
          setMonsters((prev) =>
            prev.map((m) => (m.id === selectedMonster.id ? { ...m, hp: m.hp - reflectAmount } : m)).filter((m) => m.hp > 0)
          )
        }

        // Spiked Carapace (equip passive): melee attackers take recoil.
        if (targetMonster.equipRecoil) {
          appendLog(`${targetMonster.name}'s Spiked Carapace deals ${targetMonster.equipRecoil} recoil damage to ${selectedMonster.name}.`)
          setMonsters((prev) =>
            prev.map((m) => (m.id === selectedMonster.id ? { ...m, hp: m.hp - targetMonster.equipRecoil } : m)).filter((m) => m.hp > 0)
          )
        }

        if (newHp <= 0) {
          appendLog(`${targetMonster.name} is destroyed!`)
          setMonsters((prev) => prev.filter((m) => m.id !== targetMonster.id))
          // Pressure Blast (Pneumatic Golem passive): if the ATTACKER has
          // Pressure Blast and lands the kill, drain the defender's owner's
          // Movement crest.
          if (selectedMonster.ability?.id === 'pressure_blast') {
            setOpponentBank((prev) => ({ ...prev, movement: Math.max(0, prev.movement - 1) }))
            appendLog(`Pressure Blast drains 1 Movement Crest from ${opponentName}.`)
          }
          // Soul Harvester Relic (artifact, active for the match).
          if (soulHarvesterActive) {
            setPlayerBank((prev) => ({ ...prev, spell: Math.min(CREST_CAP, prev.spell + 1) }))
            appendLog('Soul Harvester Relic grants +1 Magic Crest.')
          }
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

    // Every "lasts until end of turn" effect (temp ATK/DEF buffs and
    // debuffs, move-lock, Meltdown's DEF suppression) clears here. Poison
    // ticks once per round; freeze/silence count down by 1. This is a
    // one-clock-per-round simplification rather than tracking each side's
    // turns independently - documented like the engine's other house rules.
    setMonsters((prev) =>
      prev
        .map((m) => {
          let next = m
          if (m.tempAtkBuffApplied) next = { ...next, atk: next.atk - m.tempAtkBuffApplied, tempAtkBuffApplied: 0 }
          if (m.tempAtkDebuffApplied) next = { ...next, atk: next.atk + m.tempAtkDebuffApplied, tempAtkDebuffApplied: 0 }
          if (m.tempDefBuff) next = { ...next, tempDefBuff: 0 }
          if (m.moveLocked) next = { ...next, moveLocked: false }
          if (m.freezeTurnsLeft > 0) {
            const turnsLeft = m.freezeTurnsLeft - 1
            next = { ...next, freezeTurnsLeft: turnsLeft, frozen: turnsLeft > 0 }
          }
          if (m.silencedTurns > 0) next = { ...next, silencedTurns: m.silencedTurns - 1 }
          if (m.poisonTurnsLeft > 0) {
            next = { ...next, hp: next.hp - m.poisonPerTurn, poisonTurnsLeft: m.poisonTurnsLeft - 1 }
          }
          if (m.endTurnSelfDamage) {
            next = { ...next, hp: next.hp - m.endTurnSelfDamage, endTurnSelfDamage: 0 }
          }
          // Terrain: hazard/heal tiles apply to whoever's standing on them
          // at end of turn. Hazards only hurt the side that didn't place
          // them; heal tiles help everyone (matches Rejuvenation Spring's
          // "any monster" wording).
          const tile = terrainTiles.find((t) => t.col === next.col && t.row === next.row)
          if (tile?.mechanic === 'terrain_hazard_tile' && tile.owner !== next.owner) {
            next = { ...next, hp: next.hp - tile.params.amount }
          } else if (tile?.mechanic === 'terrain_heal_tile') {
            next = { ...next, hp: Math.min(next.maxHp, next.hp + tile.params.amount) }
          }
          return next
        })
        .filter((m) => m.hp > 0)
    )
    setDefSuppressedIds([])
    if (dmImmuneTurns > 0) setDmImmuneTurns((d) => Math.max(0, d - 1))
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
    let currentBarriers = barriers

    appendLog(`${opponentName} rolls the dice.`)

    let dimensionsUsedThisTurn = 0
    if (summonLevel && opponentDimensionsUsed < MAX_DIMENSIONS && currentMonsters.filter((m) => m.owner === 'opponent').length < 3) {
      const candidates = findUnfoldCandidates(cellState, 'opponent')
      if (candidates.length > 0) {
        const spot = candidates[Math.floor(Math.random() * candidates.length)]
        cellState = unfoldNet(cellState, spot)
        const monster = generateMonster('opponent', summonLevel)
        monster.col = spot.col
        monster.row = spot.row
        currentMonsters = [...currentMonsters, monster]
        dimensionsUsedThisTurn = 1
        appendLog(`${opponentName} summons ${monster.name} (Lv${monster.level})${monster.ability ? ` - ${monster.ability.name}` : ''}!`)
      }
    }

    const isBlockedForOpponent = (c, r) =>
      currentMonsters.some((m) => m.col === c && m.row === r) || currentBarriers.some((b) => b.col === c && b.row === r)

    const opponentMonsters = currentMonsters.filter((m) => m.owner === 'opponent')
    for (const monster of opponentMonsters) {
      if (!currentMonsters.find((m) => m.id === monster.id)) continue // already destroyed this turn

      const distToPlayerDm = Math.abs(monster.col - PLAYER_DM.col) + Math.abs(monster.row - PLAYER_DM.row)
      const adjacentPlayerMonster = currentMonsters.find((m) => m.owner === 'player' && isAdjacent(monster, m))

      // The AI now has real tactical choices instead of only rushing the
      // Die Master: it attacks an adjacent player monster if one is in
      // range and it has an Attack crest, otherwise rushes the Die Master
      // directly, otherwise closes distance.
      if (adjacentPlayerMonster && bank.attack > 0) {
        bank = { ...bank, attack: bank.attack - 1 }
        if (adjacentPlayerMonster.ability?.id === 'parry' && rollParry()) {
          appendLog(`${adjacentPlayerMonster.name} parries ${monster.name}'s attack!`)
          continue
        }
        if (adjacentPlayerMonster.shielded) {
          appendLog(`Your ${adjacentPlayerMonster.name}'s shield absorbs ${monster.name}'s attack completely!`)
          currentMonsters = currentMonsters.map((m) => (m.id === adjacentPlayerMonster.id ? { ...m, shielded: false } : m))
          continue
        }
        const dmg = computeDamage(monster.atk, adjacentPlayerMonster.def, false)
        const newHp = adjacentPlayerMonster.hp - dmg
        appendLog(`${monster.name} attacks your ${adjacentPlayerMonster.name} for ${dmg}.`)
        playTakeDamageSound()
        if (newHp <= 0) {
          appendLog(`Your ${adjacentPlayerMonster.name} is destroyed!`)
          currentMonsters = currentMonsters.filter((m) => m.id !== adjacentPlayerMonster.id)
        } else {
          currentMonsters = currentMonsters.map((m) => (m.id === adjacentPlayerMonster.id ? { ...m, hp: newHp } : m))
        }
        if (adjacentPlayerMonster.ability?.mechanic === 'reflect_damage') {
          const reflectAmount = adjacentPlayerMonster.ability.params?.amount || 0
          appendLog(`Your ${adjacentPlayerMonster.name} reflects ${reflectAmount} damage back to ${monster.name}.`)
          const reflectedHp = monster.hp - reflectAmount
          currentMonsters = reflectedHp <= 0
            ? currentMonsters.filter((m) => m.id !== monster.id)
            : currentMonsters.map((m) => (m.id === monster.id ? { ...m, hp: reflectedHp } : m))
        }
        continue
      }

      if (distToPlayerDm === 1 && bank.attack > 0) {
        bank = { ...bank, attack: bank.attack - 1 }
        if (dmImmuneTurns > 0) {
          appendLog(`${monster.name} strikes your Die Master, but Aegis of the Ancients absorbs it completely!`)
        } else {
          dmHp = Math.max(0, dmHp - 1)
          appendLog(`${monster.name} strikes your Die Master directly! -1 HP.`)
        }
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
        const occupied = isBlockedForOpponent(nextCol, nextRow)
        if (cellState[key] === 'path' && !occupied) {
          bank = { ...bank, movement: bank.movement - 1 }
          currentMonsters = currentMonsters.map((m) => (m.id === monster.id ? { ...m, col: nextCol, row: nextRow } : m))

          // Face-down player traps trigger when an opponent monster steps on them.
          const trap = findTrapAt(nextCol, nextRow)
          const mover = currentMonsters.find((m) => m.id === monster.id)
          if (trap && mover && !mover.equipTrapImmune) {
            appendLog(`${mover.name} triggers ${trap.name}!`)
            if (trap.mechanic === 'trap_damage') {
              currentMonsters = currentMonsters.map((m) => (m.id === mover.id ? { ...m, hp: m.hp - trap.params.amount } : m)).filter((m) => m.hp > 0)
            } else if (trap.mechanic === 'trap_damage_splash') {
              const splashTargets = currentMonsters.filter((m) => m.id !== mover.id && isAdjacent({ col: nextCol, row: nextRow }, m))
              currentMonsters = currentMonsters
                .map((m) => {
                  if (m.id === mover.id) return { ...m, hp: m.hp - trap.params.amount }
                  if (splashTargets.some((t) => t.id === m.id)) return { ...m, hp: m.hp - trap.params.splash }
                  return m
                })
                .filter((m) => m.hp > 0)
            } else if (trap.mechanic === 'trap_poison') {
              currentMonsters = currentMonsters.map((m) => (m.id === mover.id ? { ...m, poisonPerTurn: trap.params.amountPerTurn, poisonTurnsLeft: trap.params.duration } : m))
            } else if (trap.mechanic === 'trap_silence') {
              currentMonsters = currentMonsters.map((m) => (m.id === mover.id ? { ...m, silencedTurns: trap.params.duration } : m))
            } else if (trap.mechanic === 'trap_crest_drain') {
              bank = { ...bank, [trap.params.crestType]: Math.max(0, bank[trap.params.crestType] - trap.params.amount) }
            } else if (trap.mechanic === 'trap_instakill_low_level' && mover.level <= trap.params.maxLevel) {
              currentMonsters = currentMonsters.filter((m) => m.id !== mover.id)
            }
            setTraps((prev) => prev.filter((t) => t.id !== trap.id))
          }
        }
      }
    }

    // Barriers tick down and expire.
    currentBarriers = currentBarriers.map((b) => ({ ...b, turnsLeft: b.turnsLeft - 1 })).filter((b) => b.turnsLeft > 0)

    // Deflector Shield Generator (equip): refreshes at the start of the
    // player's own turn.
    currentMonsters = currentMonsters.map((m) => (m.owner === 'player' && m.equipShieldPerTurn ? { ...m, shielded: true } : m))

    setCells(cellState)
    setMonsters(currentMonsters)
    setOpponentBank(bank)
    setPlayerDmHp(dmHp)
    setBarriers(currentBarriers)
    if (dimensionsUsedThisTurn > 0) setOpponentDimensionsUsed((d) => d + dimensionsUsedThisTurn)

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

    // Barriers (Firewall / terrain barriers)
    for (const b of barriers) {
      const x = b.col * TILE
      const y = b.row * TILE
      ctx.fillStyle = 'rgba(78,168,222,0.55)'
      ctx.fillRect(x + 1, y + 1, TILE - 3, TILE - 3)
      ctx.strokeStyle = '#8ecae6'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 1, y + 1, TILE - 3, TILE - 3)
    }

    // Terrain tiles (hazard/heal)
    for (const t of terrainTiles) {
      const x = t.col * TILE
      const y = t.row * TILE
      ctx.fillStyle = t.mechanic === 'terrain_heal_tile' ? 'rgba(74,220,140,0.4)' : 'rgba(230,90,50,0.4)'
      ctx.fillRect(x + 1, y + 1, TILE - 3, TILE - 3)
    }

    // Traps (visible to the player who set them - face-down to the opponent)
    for (const t of traps) {
      const x = t.col * TILE
      const y = t.row * TILE
      ctx.fillStyle = 'rgba(155,93,229,0.5)'
      ctx.fillRect(x + 3, y + 3, TILE - 7, TILE - 7)
    }

    // valid move/attack/ability targets
    if ((mode === 'moving' || mode === 'attacking') && selectedMonster) {
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      for (const [dx, dy] of dirs) {
        const tc = selectedMonster.col + dx
        const tr = selectedMonster.row + dy
        if (tc < 0 || tc >= GRID_COLS || tr < 0 || tr >= GRID_ROWS) continue
        const key = `${tc},${tr}`
        const isOpponentDm = tc === OPPONENT_DM.col && tr === OPPONENT_DM.row
        if (mode === 'moving' && cells[key] === 'path' && !isOccupiedOrBarrier(tc, tr)) {
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

    if (mode === 'ability-target' && selectedMonster && pendingAbility) {
      const ability = pendingAbility.ability
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          let valid = false
          if (ability.target === 'adjacent-empty') valid = isAdjacent(selectedMonster, { col: c, row: r }) && !isOccupiedOrBarrier(c, r)
          if (ability.target === 'line') valid = monsterAt(c, r)?.owner === 'opponent' && isInLine(selectedMonster, { col: c, row: r })
          if (ability.target === 'adjacent-enemy') valid = monsterAt(c, r)?.owner === 'opponent' && isAdjacent(selectedMonster, { col: c, row: r })
          if (ability.target === 'ally-adjacent') valid = monsterAt(c, r)?.owner === 'player' && monsterAt(c, r)?.id !== selectedMonster.id && isAdjacent(selectedMonster, { col: c, row: r })
          if (ability.target === 'adjacent-any') valid = isAdjacent(selectedMonster, { col: c, row: r })
          if (valid) {
            ctx.strokeStyle = '#f4a261'
            ctx.lineWidth = 2
            ctx.strokeRect(c * TILE + 1, r * TILE + 1, TILE - 3, TILE - 3)
          }
        }
      }
    }

    if (mode === 'item-target' && pendingItem) {
      const item = pendingItem.item
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          let valid = false
          if (item.target === 'any-empty') valid = !isOccupiedOrBarrier(c, r) && !traps.some((t) => t.col === c && t.row === r) && !terrainTiles.some((t) => t.col === c && t.row === r)
          if (item.target === 'ally-any') valid = monsterAt(c, r)?.owner === 'player'
          if (item.target === 'enemy-any') valid = monsterAt(c, r)?.owner === 'opponent'
          if (valid) {
            ctx.strokeStyle = '#9b5de5'
            ctx.lineWidth = 2
            ctx.strokeRect(c * TILE + 1, r * TILE + 1, TILE - 3, TILE - 3)
          }
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
      if (m.ability) {
        ctx.strokeStyle = '#f4a261'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(x + TILE / 2, y + TILE / 2, TILE / 2 - 1, 0, Math.PI * 2)
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
          {mode === 'ability-target' && (
            <p className="mt-1 text-xs text-orange-300">Select a highlighted target for {pendingAbility?.ability.name}.</p>
          )}
          {mode === 'item-target' && (
            <p className="mt-1 text-xs text-purple-300">Select a highlighted target for {pendingItem?.item.name}.</p>
          )}
        </div>

        <div className="w-72">
          <div className="mb-3 border-2 border-gray-600 bg-[#0f1020] p-2 text-xs">
            <p className="mb-1 font-bold text-gray-300">Crest Bank</p>
            {CREST_TYPES.map((type) => (
              <div key={type} className="mb-1 flex items-center justify-between">
                <span style={{ color: CREST_COLORS[type] }}>{CREST_LABELS[type]}</span>
                <span>{playerBank[type]}/{CREST_CAP}</span>
              </div>
            ))}
          </div>

          {!outcome && turn === 'player' && (
            <button
              onClick={() => setShowItems((s) => !s)}
              className="mb-3 w-full border-2 border-purple-400 py-1 text-xs text-purple-300 hover:bg-purple-400 hover:text-black"
            >
              {showItems ? '▲ Hide Items' : `▼ Items (${DDM_ITEM_CATALOG.filter(isItemImplemented).length} usable / ${DDM_ITEM_CATALOG.length} total)`}
            </button>
          )}

          {showItems && !outcome && turn === 'player' && (
            <div className="mb-3 max-h-64 overflow-y-auto border-2 border-gray-600 bg-[#0f1020] p-2 text-xs">
              {['trap', 'spell', 'equip', 'terrain', 'artifact'].map((type) => (
                <div key={type} className="mb-2">
                  <p className="mb-1 font-bold uppercase text-purple-300">{type === 'equip' ? 'Equipment' : `${type}s`}</p>
                  {DDM_ITEM_CATALOG.filter((i) => i.type === type).map((item) => {
                    const implemented = isItemImplemented(item)
                    const affordable = canAffordItem(playerBank, item.cost)
                    return (
                      <div key={item.id} className="mb-1 flex items-center justify-between gap-2">
                        <span
                          className={implemented ? 'text-gray-200' : 'text-gray-600'}
                          title={item.description}
                        >
                          {item.name} ({Object.entries(item.cost).map(([t, a]) => `${a} ${CREST_LABELS[t]}`).join(', ')})
                        </span>
                        {implemented ? (
                          <button
                            onClick={() => handleStartItem(item)}
                            disabled={!affordable}
                            className="shrink-0 border border-purple-400 px-1 text-purple-300 hover:bg-purple-400 hover:text-black disabled:opacity-30"
                          >
                            Use
                          </button>
                        ) : (
                          <span className="shrink-0 text-[9px] text-gray-600">not yet active</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}

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
                  disabled={playerDimensionsUsed >= MAX_DIMENSIONS}
                  className="border-2 border-yellow-400 py-1 text-xs text-yellow-300 hover:bg-yellow-400 hover:text-black disabled:opacity-30"
                >
                  Summon Lv{summonAvailable} Monster (click a green tile)
                </button>
              )}
              <p className="text-[10px] text-gray-500">Dimensions used: {playerDimensionsUsed}/{MAX_DIMENSIONS}</p>
              {mode === 'placing' && (
                <p className="text-center text-xs text-green-400">Click a highlighted tile to place your monster.</p>
              )}

              <p className="mt-1 text-xs font-bold text-gray-400">Your Monsters</p>
              {playerMonsters.length === 0 && <p className="text-xs text-gray-600">None yet.</p>}
              {playerMonsters.map((m) => (
                <div key={m.id} className="flex flex-col gap-1 border-b border-gray-800 pb-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span>{m.name} (Lv{m.level}, {m.hp}/{m.maxHp}HP)</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleStartMove(m.id)}
                        disabled={playerBank.movement <= 0 || m.moveLocked}
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
                  {m.ability && m.ability.target !== 'passive' && isAbilityImplemented(m.ability) && (
                    <button
                      onClick={() => handleStartAbility(m)}
                      disabled={!canAffordAbility(playerBank, m.ability.crestCost) || m.frozen || m.silencedTurns > 0}
                      className="border border-orange-400 px-1 py-0.5 text-left text-orange-300 hover:bg-orange-400 hover:text-black disabled:opacity-30"
                      title={m.ability.description}
                    >
                      ✦ {m.ability.name} ({Object.entries(m.ability.crestCost).map(([t, a]) => `${a} ${CREST_LABELS[t]}`).join(', ')})
                    </button>
                  )}
                  {m.ability && m.ability.target === 'passive' && (
                    <span className="text-[10px] text-orange-400" title={m.ability.description}>
                      🛡 {m.ability.name} (passive)
                    </span>
                  )}
                  {m.ability && m.ability.target !== 'passive' && !isAbilityImplemented(m.ability) && (
                    <span className="text-[10px] text-gray-600" title={m.ability.description}>
                      ✦ {m.ability.name} (flavor only - not yet active)
                    </span>
                  )}
                  {(m.frozen || m.silencedTurns > 0 || m.poisonTurnsLeft > 0) && (
                    <span className="text-[10px] text-cyan-400">
                      {m.frozen && '❄ Frozen '}
                      {m.silencedTurns > 0 && '🔇 Silenced '}
                      {m.poisonTurnsLeft > 0 && '☠ Poisoned'}
                    </span>
                  )}
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
