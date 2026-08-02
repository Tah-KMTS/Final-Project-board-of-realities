import { useState } from 'react'
import { getCard } from './cardDatabase'
import { createDuelPlayerState, drawCards, findEmptyZoneSlot, resolveBattle, excessHandCount, HAND_LIMIT } from './duelEngine'
import { isHookImplemented, hookNeedsTarget } from './duelEffects'
import { assessThreat, checkLethal, decideSummonPosition, pickMonsterToSummon, pickAttackTarget } from './duelAI'
import { playHitSound, playTakeDamageSound, playVictorySound, playDefeatSound, playClickSound } from '../../audio/sfx'

const OPENING_HAND = 5

export default function DominoDuelModal({
  opponentNpc,
  playerDeckIds,
  opponentDeckIds,
  onClose,
  onVictory,
  onDefeat,
}) {
  const [player, setPlayer] = useState(() => {
    const s = createDuelPlayerState(playerDeckIds)
    const { hand, deck } = drawCards(s, OPENING_HAND)
    return { ...s, hand, deck }
  })
  const [opponent, setOpponent] = useState(() => {
    const s = createDuelPlayerState(opponentDeckIds)
    const { hand, deck } = drawCards(s, OPENING_HAND)
    return { ...s, hand, deck }
  })
  const [phase, setPhase] = useState('main1')
  const [turn, setTurn] = useState('player')
  const [turnCount, setTurnCount] = useState(1)
  const [normalSummonUsed, setNormalSummonUsed] = useState(false)
  const [attackerSlot, setAttackerSlot] = useState(null)
  const [pendingCard, setPendingCard] = useState(null) // { handIndex, cardId, needsPositionChoice, needsTarget }
  const [attackLockTurns, setAttackLockTurns] = useState(0) // Swords of Revealing Light, on the player being locked
  const [log, setLog] = useState([`A duel begins against ${opponentNpc?.Name || 'your opponent'}!`])
  const [outcome, setOutcome] = useState(null)

  const appendLog = (line) => setLog((prev) => [...prev.slice(-6), line])

  const playerCard = (id) => getCard(id)

  const checkDeckOutOrLethal = (nextPlayer, nextOpponent) => {
    if (nextPlayer.lp <= 0) { setOutcome('defeat'); playDefeatSound(); return true }
    if (nextOpponent.lp <= 0) { setOutcome('victory'); playVictorySound(); return true }
    return false
  }

  // --- Main Phase actions -------------------------------------------------

  const handlePlayCard = (index) => {
    if (outcome || turn !== 'player' || (phase !== 'main1' && phase !== 'main2')) return
    const cardId = player.hand[index]
    const card = playerCard(cardId)
    if (!card) return

    if (card.Primary_Type === 'Monster') {
      if (normalSummonUsed) { appendLog('Already used your Normal Summon this turn.'); return }
      if (findEmptyZoneSlot(player.monsterZone) === -1) { appendLog('Your Monster Zone is full.'); return }
      setPendingCard({ handIndex: index, cardId, kind: 'monster' })
      return
    }

    if (card.Primary_Type === 'Spell') {
      if (!isHookImplemented(card.Effect_Logic_Hook) && card.Effect_Logic_Hook) {
        appendLog(`${card.Name}'s effect isn't wired up yet - can't activate it.`)
        return
      }
      if (hookNeedsTarget(card.Effect_Logic_Hook)) {
        setPendingCard({ handIndex: index, cardId, kind: 'spell-target' })
        return
      }
      resolveSpell(index, cardId, card)
      return
    }

    if (card.Primary_Type === 'Trap') {
      if (findEmptyZoneSlot(player.spellTrapZone) === -1) { appendLog('Your Spell/Trap Zone is full.'); return }
      setPlayer((p) => {
        const idx = findEmptyZoneSlot(p.spellTrapZone)
        const spellTrapZone = [...p.spellTrapZone]
        spellTrapZone[idx] = { cardId, faceDown: true, justSet: true }
        return { ...p, hand: p.hand.filter((_, i) => i !== index), spellTrapZone }
      })
      appendLog(`You set a card face-down.`)
      playClickSound()
    }
  }

  const confirmSummon = (position) => {
    const { handIndex, cardId } = pendingCard
    setPlayer((p) => {
      const idx = findEmptyZoneSlot(p.monsterZone)
      const monsterZone = [...p.monsterZone]
      monsterZone[idx] = { cardId, position, faceDown: position === 'defense', attacked: false }
      return { ...p, hand: p.hand.filter((_, i) => i !== handIndex), monsterZone }
    })
    setNormalSummonUsed(true)
    const card = playerCard(cardId)
    appendLog(`You ${position === 'attack' ? 'Summon' : 'Set'} ${card.Name}${position === 'defense' ? ' face-down in Defense Position' : ' in Attack Position'}.`)
    playClickSound()

    // Trap Hole-style hooks: react to a Normal Summon meeting a threshold.
    const triggeredTrap = opponent.spellTrapZone.find((s) => s && !s.justSet && getCard(s.cardId)?.Effect_Logic_Hook === 'Destroy_Summoned_Monster_1000ATK_Min')
    if (triggeredTrap && card.Base_ATK >= 1000) {
      appendLog(`${opponentNpc?.Name || 'Opponent'}'s Trap Hole destroys ${card.Name}!`)
      setPlayer((p) => {
        const idx = p.monsterZone.findIndex((s) => s?.cardId === cardId)
        const monsterZone = [...p.monsterZone]
        const destroyed = monsterZone[idx]
        monsterZone[idx] = null
        return { ...p, monsterZone, graveyard: [...p.graveyard, destroyed.cardId] }
      })
      setOpponent((o) => ({
        ...o,
        spellTrapZone: o.spellTrapZone.map((s) => (s === triggeredTrap ? null : s)),
        graveyard: [...o.graveyard, triggeredTrap.cardId],
      }))
    }
    setPendingCard(null)
  }

  const resolveSpell = (index, cardId, card, targetSlotIdx = null) => {
    const hook = card.Effect_Logic_Hook
    setPlayer((p) => ({ ...p, hand: p.hand.filter((_, i) => i !== index), graveyard: [...p.graveyard, cardId] }))
    appendLog(`You activate ${card.Name}.`)

    if (hook === 'Destroy_Single_SpellTrap' && targetSlotIdx !== null) {
      const target = opponent.spellTrapZone[targetSlotIdx]
      if (target) {
        setOpponent((o) => {
          const spellTrapZone = [...o.spellTrapZone]
          spellTrapZone[targetSlotIdx] = null
          return { ...o, spellTrapZone, graveyard: [...o.graveyard, target.cardId] }
        })
        appendLog(`Destroyed ${opponentNpc?.Name || 'opponent'}'s set card.`)
      }
    } else if (hook === 'Destroy_All_Monsters') {
      setPlayer((p) => ({ ...p, monsterZone: Array(5).fill(null), graveyard: [...p.graveyard, ...p.monsterZone.filter(Boolean).map((s) => s.cardId)] }))
      setOpponent((o) => ({ ...o, monsterZone: Array(5).fill(null), graveyard: [...o.graveyard, ...o.monsterZone.filter(Boolean).map((s) => s.cardId)] }))
      appendLog('All monsters on the field are destroyed.')
    } else if (hook === 'Lock_Opponent_Attacks') {
      setAttackLockTurns(3)
      appendLog(`${opponentNpc?.Name || 'Opponent'} cannot attack for 3 turns.`)
    } else if (hook === 'Redraw_Hand') {
      setPlayer((p) => {
        const discarded = p.hand.length
        const graveyard = [...p.graveyard, ...p.hand]
        const { hand, deck } = drawCards({ ...p, hand: [], graveyard }, discarded)
        return { ...p, hand, deck, graveyard }
      })
      appendLog('You discard your hand and redraw the same number of cards.')
    } else if (hook === 'Destroy_Lowest_ATK_Monster') {
      setOpponent((o) => {
        const withCards = o.monsterZone.map((s, i) => (s ? { i, atk: getCard(s.cardId)?.Base_ATK ?? 0 } : null)).filter(Boolean)
        if (withCards.length === 0) return o
        withCards.sort((a, b) => a.atk - b.atk)
        const idx = withCards[0].i
        const monsterZone = [...o.monsterZone]
        const destroyed = monsterZone[idx]
        monsterZone[idx] = null
        return { ...o, monsterZone, graveyard: [...o.graveyard, destroyed.cardId] }
      })
      appendLog(`Destroyed ${opponentNpc?.Name || 'opponent'}'s lowest-ATK monster.`)
    } else if (hook === 'Draw_1') {
      setPlayer((p) => {
        const { hand, deck } = drawCards(p, 1)
        return { ...p, hand, deck }
      })
      appendLog('You draw 1 card.')
    }
    setPendingCard(null)
  }

  const handleSpellTarget = (slotIdx) => {
    const { handIndex, cardId } = pendingCard
    const card = playerCard(cardId)
    resolveSpell(handIndex, cardId, card, slotIdx)
  }

  // --- Battle Phase ---------------------------------------------------------

  const handleSelectAttacker = (slotIdx) => {
    if (phase !== 'battle' || turn !== 'player' || outcome) return
    const slot = player.monsterZone[slotIdx]
    if (!slot || slot.position !== 'attack' || slot.attacked) return
    setAttackerSlot(slotIdx)
  }

  const handleDeclareAttack = (defenderSlotIdx) => {
    if (attackerSlot === null) return
    const attackerEntry = player.monsterZone[attackerSlot]
    const attackerCard = playerCard(attackerEntry.cardId)
    const defenderEntry = defenderSlotIdx === null ? null : opponent.monsterZone[defenderSlotIdx]
    const defenderCard = defenderEntry ? playerCard(defenderEntry.cardId) : null

    // Passive traps trigger on attack declaration.
    const mirrorForce = opponent.spellTrapZone.find((s) => s && !s.justSet && getCard(s.cardId)?.Effect_Logic_Hook === 'Destroy_All_Attack_Position')
    const magicCylinder = opponent.spellTrapZone.find((s) => s && !s.justSet && getCard(s.cardId)?.Effect_Logic_Hook === 'Reflect_Attack_Damage')
    const waboku = opponent.spellTrapZone.find((s) => s && !s.justSet && getCard(s.cardId)?.Effect_Logic_Hook === 'Prevent_Battle_Damage_This_Turn')

    if (mirrorForce) {
      appendLog(`${opponentNpc?.Name || 'Opponent'} activates Mirror Force! All your Attack Position monsters are destroyed.`)
      setPlayer((p) => {
        const destroyedIds = p.monsterZone.filter((s) => s?.position === 'attack').map((s) => s.cardId)
        return { ...p, monsterZone: p.monsterZone.map((s) => (s?.position === 'attack' ? null : s)), graveyard: [...p.graveyard, ...destroyedIds] }
      })
      setOpponent((o) => ({ ...o, spellTrapZone: o.spellTrapZone.map((s) => (s === mirrorForce ? null : s)), graveyard: [...o.graveyard, mirrorForce.cardId] }))
      setAttackerSlot(null)
      return
    }
    if (magicCylinder) {
      appendLog(`${opponentNpc?.Name || 'Opponent'} activates Magic Cylinder! The attack is negated and reflected.`)
      setOpponent((o) => ({ ...o, spellTrapZone: o.spellTrapZone.map((s) => (s === magicCylinder ? null : s)), graveyard: [...o.graveyard, magicCylinder.cardId] }))
      setPlayer((p) => {
        const nextLp = Math.max(0, p.lp - attackerCard.Base_ATK)
        checkDeckOutOrLethal({ ...p, lp: nextLp }, opponent)
        return { ...p, lp: nextLp }
      })
      setAttackerSlot(null)
      return
    }
    if (waboku) {
      appendLog(`${opponentNpc?.Name || 'Opponent'} activates Waboku! No battle damage or destruction this turn.`)
      setOpponent((o) => ({ ...o, spellTrapZone: o.spellTrapZone.map((s) => (s === waboku ? null : s)), graveyard: [...o.graveyard, waboku.cardId] }))
      setPlayer((p) => ({ ...p, monsterZone: p.monsterZone.map((s, i) => (i === attackerSlot ? { ...s, attacked: true } : s)) }))
      setAttackerSlot(null)
      return
    }

    const result = resolveBattle(attackerEntry, attackerCard, defenderEntry, defenderCard)
    playHitSound()
    appendLog(
      defenderCard
        ? `${attackerCard.Name} attacks ${defenderCard.Name}!`
        : `${attackerCard.Name} attacks directly for ${attackerCard.Base_ATK}!`
    )

    setPlayer((p) => {
      let monsterZone = p.monsterZone.map((s, i) => (i === attackerSlot ? { ...s, attacked: true } : s))
      let graveyard = p.graveyard
      let lp = p.lp
      if (result.attackerDestroyed) {
        graveyard = [...graveyard, attackerEntry.cardId]
        monsterZone = monsterZone.map((s, i) => (i === attackerSlot ? null : s))
      }
      if (result.lpDamageToAttacker) { lp = Math.max(0, lp - result.lpDamageToAttacker); playTakeDamageSound() }
      return { ...p, monsterZone, graveyard, lp }
    })
    setOpponent((o) => {
      let monsterZone = o.monsterZone
      let graveyard = o.graveyard
      let lp = o.lp
      if (defenderSlotIdx !== null && result.defenderDestroyed) {
        graveyard = [...graveyard, defenderEntry.cardId]
        monsterZone = monsterZone.map((s, i) => (i === defenderSlotIdx ? null : s))
      }
      if (result.lpDamageToDefender) lp = Math.max(0, lp - result.lpDamageToDefender)
      return { ...o, monsterZone, graveyard, lp }
    })

    setTimeout(() => {
      const latestPlayer = { ...player, lp: player.lp - (result.lpDamageToAttacker || 0) }
      const latestOpponent = { ...opponent, lp: opponent.lp - (result.lpDamageToDefender || 0) }
      if (checkDeckOutOrLethal(latestPlayer, latestOpponent)) playVictorySound()
    }, 50)

    setAttackerSlot(null)
  }

  // --- Phase progression -----------------------------------------------------

  const advancePhase = () => {
    if (outcome || turn !== 'player') return
    if (phase === 'main1') { setPhase('battle'); return }
    if (phase === 'battle') { setPhase('main2'); return }
    if (phase === 'main2') { endTurn(); return }
  }

  const endTurn = () => {
    // End Phase: discard down to the hand limit (simplest cards first).
    const excess = excessHandCount(player.hand)
    if (excess > 0) {
      setPlayer((p) => ({ ...p, hand: p.hand.slice(0, HAND_LIMIT), graveyard: [...p.graveyard, ...p.hand.slice(HAND_LIMIT)] }))
      appendLog(`Discarded ${excess} card(s) to the hand limit.`)
    }
    setPlayer((p) => ({ ...p, monsterZone: p.monsterZone.map((s) => (s ? { ...s, attacked: false } : s)), spellTrapZone: p.spellTrapZone.map((s) => (s ? { ...s, justSet: false } : s)) }))
    setPhase('main1')
    setNormalSummonUsed(false)
    setTurn('opponent')
    setTimeout(() => runOpponentTurn(), 500)
  }

  const runOpponentTurn = () => {
    if (outcome) return
    let opp = { ...opponent }
    let plr = { ...player }

    // Draw Phase
    const drawn = drawCards(opp, 1)
    if (drawn.deckOut) {
      setOutcome('victory')
      playVictorySound()
      appendLog(`${opponentNpc?.Name || 'Opponent'} has no cards left to draw!`)
      return
    }
    opp = { ...opp, hand: drawn.hand, deck: drawn.deck }

    // Main Phase 1: summon a monster if possible.
    const behavior = opponentNpc?.Behavior || 'Balanced_Tactical'
    const underThreat = assessThreat(opp, plr)
    const emptySlot = findEmptyZoneSlot(opp.monsterZone)
    if (emptySlot !== -1) {
      const cardId = pickMonsterToSummon(opp.hand, behavior, underThreat)
      if (cardId) {
        const position = decideSummonPosition(behavior, underThreat)
        const monsterZone = [...opp.monsterZone]
        monsterZone[emptySlot] = { cardId, position, faceDown: position === 'defense', attacked: false }
        opp = { ...opp, monsterZone, hand: opp.hand.filter((id) => id !== cardId) }
        appendLog(`${opponentNpc?.Name || 'Opponent'} ${position === 'attack' ? 'Summons' : 'Sets'} ${getCard(cardId).Name}.`)
      }
    }
    // Opportunistically set a trap if one's in hand and a slot's open.
    const trapIdx = opp.hand.findIndex((id) => getCard(id)?.Primary_Type === 'Trap')
    const emptySpellSlot = findEmptyZoneSlot(opp.spellTrapZone)
    if (trapIdx !== -1 && emptySpellSlot !== -1) {
      const cardId = opp.hand[trapIdx]
      const spellTrapZone = [...opp.spellTrapZone]
      spellTrapZone[emptySpellSlot] = { cardId, faceDown: true, justSet: false }
      opp = { ...opp, spellTrapZone, hand: opp.hand.filter((_, i) => i !== trapIdx) }
      appendLog(`${opponentNpc?.Name || 'Opponent'} sets a card face-down.`)
    }

    // Battle Phase: attack lock check, then lethal-first, else priority targeting.
    if (attackLockTurns > 0) {
      appendLog(`${opponentNpc?.Name || 'Opponent'} cannot attack (Swords of Revealing Light).`)
      setAttackLockTurns((n) => n - 1)
    } else {
      const attackers = opp.monsterZone.map((s, i) => (s?.position === 'attack' ? i : null)).filter((i) => i !== null)
      const lethal = checkLethal(opp, plr)
      for (const idx of attackers) {
        const attackerCard = getCard(opp.monsterZone[idx].cardId)
        const targetIdx = lethal ? null : pickAttackTarget(attackerCard, plr.monsterZone)
        const defenderEntry = targetIdx === null ? null : plr.monsterZone[targetIdx]
        const defenderCard = defenderEntry ? getCard(defenderEntry.cardId) : null
        const result = resolveBattle(opp.monsterZone[idx], attackerCard, defenderEntry, defenderCard)
        appendLog(defenderCard ? `${attackerCard.Name} attacks your ${defenderCard.Name}!` : `${attackerCard.Name} attacks you directly for ${attackerCard.Base_ATK}!`)
        playTakeDamageSound()

        if (result.attackerDestroyed) opp = { ...opp, monsterZone: opp.monsterZone.map((s, i2) => (i2 === idx ? null : s)), graveyard: [...opp.graveyard, opp.monsterZone[idx].cardId] }
        if (result.lpDamageToAttacker) opp = { ...opp, lp: Math.max(0, opp.lp - result.lpDamageToAttacker) }
        if (targetIdx !== null && result.defenderDestroyed) plr = { ...plr, monsterZone: plr.monsterZone.map((s, i2) => (i2 === targetIdx ? null : s)), graveyard: [...plr.graveyard, defenderEntry.cardId] }
        if (result.lpDamageToDefender) plr = { ...plr, lp: Math.max(0, plr.lp - result.lpDamageToDefender) }
      }
    }

    // End Phase: discard down to hand limit.
    const excess = excessHandCount(opp.hand)
    if (excess > 0) opp = { ...opp, hand: opp.hand.slice(0, HAND_LIMIT), graveyard: [...opp.graveyard, ...opp.hand.slice(HAND_LIMIT)] }
    opp = { ...opp, monsterZone: opp.monsterZone.map((s) => (s ? { ...s, attacked: false } : s)) }

    setOpponent(opp)
    setPlayer(plr)
    setTurnCount((t) => t + 1)
    setTurn('player')
    setPhase('main1')
    setNormalSummonUsed(false)

    if (plr.lp <= 0) { setOutcome('defeat'); playDefeatSound(); return }
    if (opp.lp <= 0) { setOutcome('victory'); playVictorySound(); return }

    const nextDraw = drawCards(plr, 1)
    if (nextDraw.deckOut) { setOutcome('defeat'); playDefeatSound(); return }
    setPlayer((p) => ({ ...p, hand: nextDraw.hand, deck: nextDraw.deck }))
  }

  const handleContinue = () => {
    if (outcome === 'victory' && onVictory) onVictory()
    if (outcome === 'defeat' && onDefeat) onDefeat()
  }

  const ZoneCard = ({ entry, isPlayer, onClick, highlighted }) => {
    if (!entry) return <div className="h-16 w-12 border border-dashed border-gray-700" />
    const card = getCard(entry.cardId)
    const faceDown = entry.faceDown && !isPlayer
    return (
      <button
        onClick={onClick}
        className={`h-16 w-12 border-2 text-xs leading-tight ${highlighted ? 'border-yellow-300' : 'border-gray-500'} ${
          entry.position === 'defense' ? 'bg-blue-950' : 'bg-red-950'
        } px-0.5 py-0.5 text-left text-gray-200`}
        title={card?.Description}
      >
        {faceDown ? '???' : card?.Name}
        {!faceDown && card?.Base_ATK != null && <div className="text-orange-300">{card.Base_ATK}</div>}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="flex max-h-[95vh] w-[820px] flex-col overflow-y-auto border-4 border-purple-500 bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1e] p-4 font-mono text-white">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-purple-300">Domino City Duel</h2>
          <span className="text-xs text-gray-400">
            Turn {turnCount} — {turn === 'player' ? 'Your' : `${opponentNpc?.Name || 'Opponent'}'s`} turn — Phase: <span className="text-purple-300 uppercase">{phase}</span>
          </span>
        </div>

        <div className="mb-2 flex justify-between text-sm">
          <span className="text-red-300">{opponentNpc?.Name || 'Opponent'}: {opponent.lp} LP</span>
          <span className="text-blue-300">You: {player.lp} LP</span>
        </div>

        {/* Opponent field */}
        <div className="mb-1 flex justify-center gap-1">
          {opponent.spellTrapZone.map((s, i) => <ZoneCard key={`ost-${i}`} entry={s} isPlayer={false} />)}
        </div>
        <div className="mb-2 flex justify-center gap-1">
          {opponent.monsterZone.map((s, i) => (
            <ZoneCard
              key={`om-${i}`}
              entry={s}
              isPlayer={false}
              onClick={() => attackerSlot !== null && phase === 'battle' && turn === 'player' && handleDeclareAttack(i)}
            />
          ))}
        </div>

        <div className="my-1 border-t border-purple-800" />

        {/* Player field */}
        <div className="mb-1 flex justify-center gap-1">
          {player.monsterZone.map((s, i) => (
            <ZoneCard
              key={`pm-${i}`}
              entry={s}
              isPlayer
              highlighted={attackerSlot === i}
              onClick={() => (phase === 'battle' ? handleSelectAttacker(i) : null)}
            />
          ))}
        </div>
        <div className="mb-2 flex justify-center gap-1">
          {player.spellTrapZone.map((s, i) => (
            <ZoneCard
              key={`pst-${i}`}
              entry={s}
              isPlayer
              highlighted={pendingCard?.kind === 'spell-target'}
              onClick={() => pendingCard?.kind === 'spell-target' && handleSpellTarget(i)}
            />
          ))}
        </div>

        {phase === 'battle' && turn === 'player' && attackerSlot !== null && opponent.monsterZone.every((s) => !s) && (
          <button
            onClick={() => handleDeclareAttack(null)}
            className="mb-2 border-2 border-red-400 bg-red-600 py-1 text-xs font-bold hover:bg-red-500"
          >
            Attack {opponentNpc?.Name || 'Opponent'} Directly
          </button>
        )}

        {/* Hand */}
        <p className="mb-1 text-xs font-bold text-gray-400">Your Hand ({player.hand.length}/{HAND_LIMIT})</p>
        <div className="mb-2 flex flex-wrap gap-1">
          {player.hand.map((cardId, i) => {
            const card = getCard(cardId)
            return (
              <button
                key={`${cardId}-${i}`}
                onClick={() => handlePlayCard(i)}
                disabled={turn !== 'player' || (phase !== 'main1' && phase !== 'main2') || !!outcome}
                className="h-16 w-12 border-2 border-gray-500 bg-[#1c1d3a] px-0.5 py-0.5 text-left text-xs leading-tight text-gray-200 hover:border-purple-400 disabled:opacity-40"
                title={card?.Description}
              >
                {card?.Name}
                <div className={card?.Primary_Type === 'Monster' ? 'text-orange-300' : card?.Primary_Type === 'Spell' ? 'text-green-300' : 'text-pink-300'}>
                  {card?.Primary_Type === 'Monster' ? card.Base_ATK : card?.Primary_Type}
                </div>
              </button>
            )
          })}
        </div>

        {pendingCard?.kind === 'monster' && (
          <div className="mb-2 flex gap-2">
            <button onClick={() => confirmSummon('attack')} className="border-2 border-red-400 px-3 py-1 text-xs hover:bg-red-400 hover:text-black">
              Normal Summon (Attack Position)
            </button>
            <button onClick={() => confirmSummon('defense')} className="border-2 border-blue-400 px-3 py-1 text-xs hover:bg-blue-400 hover:text-black">
              Set (Defense Position, face-down)
            </button>
            <button onClick={() => setPendingCard(null)} className="border-2 border-gray-500 px-3 py-1 text-xs hover:bg-gray-500">
              Cancel
            </button>
          </div>
        )}
        {pendingCard?.kind === 'spell-target' && (
          <p className="mb-2 text-xs text-orange-300">Click one of {opponentNpc?.Name || "the opponent"}'s set cards above to target it.</p>
        )}

        <div className="mb-2 h-16 overflow-y-auto border-2 border-gray-700 bg-black p-2 text-xs text-gray-300">
          {log.map((line, i) => <div key={i}>{line}</div>)}
        </div>

        {!outcome && turn === 'player' && (
          <div className="flex gap-2">
            <button onClick={advancePhase} className="flex-1 border-4 border-purple-400 bg-purple-600 py-2 font-bold hover:bg-purple-500">
              {phase === 'main1' ? 'Proceed to Battle Phase' : phase === 'battle' ? 'Proceed to Main Phase 2' : 'End Turn'}
            </button>
            <button onClick={onClose} className="border-2 border-gray-600 px-3 py-2 text-xs text-gray-400 hover:bg-gray-700">
              Forfeit
            </button>
          </div>
        )}
        {!outcome && turn === 'opponent' && <p className="text-center text-sm text-gray-400">{opponentNpc?.Name || 'Opponent'} is dueling...</p>}

        {outcome && (
          <div className="text-center">
            <p className={`mb-2 font-bold ${outcome === 'victory' ? 'text-green-400' : 'text-red-500'}`}>
              {outcome === 'victory' ? `You win! ${opponentNpc?.Dialog_Loss || ''}` : `You lose. ${opponentNpc?.Dialog_Win || ''}`}
            </p>
            <button onClick={handleContinue} className="border-4 border-green-400 bg-green-500 px-6 py-2 font-bold text-black hover:bg-green-400">
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
