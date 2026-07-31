import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { generateMonster } from './monsters'
import { getProfession } from './professions'
import { rollRiftLoot } from './items'
import { playHitSound, playTakeDamageSound, playVictorySound, playDefeatSound, playQuestCompleteSound } from '../../audio/sfx'
import {
  getAttackMultiplier,
  getDamageReduction,
  getPreTurnHealPct,
  checkExecute,
  getLethalSaveEffect,
  canCastMeteor,
  getMeteorDamage,
  getAriseRewardMultiplier,
} from './skillEffects'
import { getInventoryStatBonus, getInventoryLifeSteal, getInventoryAuraReduction, findConsumableByAbility } from './inventoryEffects'

function computePlayerDamage(player, inventoryBonus, multiplier) {
  const profession = getProfession(player.professionId)
  const focusStats = profession?.statFocus || ['STR']
  const effectiveStats = {
    STR: player.stats.STR + inventoryBonus.STR,
    AGI: player.stats.AGI + inventoryBonus.AGI,
    INT: player.stats.INT + inventoryBonus.INT,
    VIT: player.stats.VIT + inventoryBonus.VIT,
    PER: player.stats.PER + inventoryBonus.PER,
  }
  const base = focusStats.reduce((sum, key) => sum + (effectiveStats[key] || 0), 0) / focusStats.length
  const variance = 0.8 + Math.random() * 0.4
  return Math.max(1, Math.round(base * 1.6 * variance * multiplier))
}

const VARIANT_TITLES = {
  rift: 'Rift Encounter',
  finalRaid: 'FINAL RAID',
  police: 'Hunter Police Ambush!',
}

let floatingTextSeq = 0

export default function RiftCombatModal({
  difficulty,
  isFinalRaid = false,
  variant = isFinalRaid ? 'finalRaid' : 'rift',
  monsterOverride = null,
  // Hunter's Rift dungeon-crawl combat keeps its intentional permadeath
  // stakes (lethal=true, the default). Finance-world encounters routed
  // through this same modal (ambientCombat/financeCombat/
  // financePoliceEncounter - see WorldScreen.jsx) pass lethal={false} so a
  // loss knocks the player out via takeFinanceCombatDamage() instead of
  // wiping the save.
  lethal = true,
  onClose,
  onVictory,
  onDefeat,
}) {
  const player = useGameStore((s) => s.player)
  const world1 = useGameStore((s) => s.world1)
  const inventory = useGameStore((s) => s.inventory)
  const takeDamage = useGameStore((s) => s.takeDamage)
  const takeFinanceCombatDamage = useGameStore((s) => s.takeFinanceCombatDamage)
  const updatePlayer = useGameStore((s) => s.updatePlayer)
  const gainExp = useGameStore((s) => s.gainExp)
  const addCash = useGameStore((s) => s.addCash)
  const addItem = useGameStore((s) => s.addItem)
  const removeItem = useGameStore((s) => s.removeItem)
  const recordRiftClear = useGameStore((s) => s.recordRiftClear)
  const recordMonsterDefeated = useGameStore((s) => s.recordMonsterDefeated)
  const recordLowHpTurn = useGameStore((s) => s.recordLowHpTurn)
  const setWantedLevel = useGameStore((s) => s.addWantedLevel)

  const [monster] = useState(() =>
    monsterOverride || generateMonster(isFinalRaid ? difficulty + 4 : difficulty)
  )
  const [monsterHp, setMonsterHp] = useState(monster.hp)
  const [log, setLog] = useState([`A wild ${monster.name} blocks your path!`])
  const [tookDamage, setTookDamage] = useState(false)
  const [outcome, setOutcome] = useState(null) // null | 'victory' | 'defeat'
  const [busy, setBusy] = useState(false)
  const [monsterFloats, setMonsterFloats] = useState([])
  const [playerFloats, setPlayerFloats] = useState([])
  const [monsterHitPulse, setMonsterHitPulse] = useState(0)
  const [playerHitPulse, setPlayerHitPulse] = useState(0)
  const [hitCount, setHitCount] = useState(0)
  const [meteorUsed, setMeteorUsed] = useState(false)
  const [lethalSaveUsed, setLethalSaveUsed] = useState(false)

  const professionId = player.professionId
  const hunterRank = world1.hunterRank
  const inventoryBonus = getInventoryStatBonus(inventory)
  const lifeSteal = getInventoryLifeSteal(inventory)
  const auraReduction = getInventoryAuraReduction(inventory)
  const skillDamageReduction = getDamageReduction(professionId, hunterRank)
  const weirdUmbrella = variant === 'rift' ? findConsumableByAbility(inventory, 'instant_rift_clear') : null

  const appendLog = (line) => setLog((prev) => [...prev.slice(-4), line])

  const spawnFloat = (setFloats, text) => {
    const id = ++floatingTextSeq
    setFloats((prev) => [...prev, { id, text }])
    setTimeout(() => setFloats((prev) => prev.filter((f) => f.id !== id)), 700)
  }

  const grantVictoryRewards = () => {
    const loot = rollRiftLoot()
    const rewardMultiplier = getAriseRewardMultiplier(professionId)
    const expReward = Math.round((variant === 'finalRaid' ? 5000 : 20 + difficulty * 15) * rewardMultiplier)
    const cashReward = Math.round((variant === 'finalRaid' ? 0 : 10 + difficulty * 8) * rewardMultiplier)
    gainExp(expReward)
    addCash(cashReward)
    addItem(loot)
    recordMonsterDefeated()
    recordRiftClear({ tookDamage })
  }

  const handleAttack = () => {
    if (busy || outcome) return
    setBusy(true)

    const isFirstHit = hitCount === 0
    setHitCount((c) => c + 1)

    // Healer's Minor Heal / Regeneration ticks before the attack resolves.
    const healPct = getPreTurnHealPct(professionId, hunterRank)
    if (healPct > 0 && player.hp < player.maxHp) {
      const healed = Math.min(player.maxHp, player.hp + Math.round(player.maxHp * healPct))
      updatePlayer({ hp: healed })
    }

    const multiplier = getAttackMultiplier(professionId, hunterRank, player, isFirstHit)
    const willExecute = checkExecute(professionId, hunterRank, monsterHp, monster.maxHp)
    const dmg = willExecute ? monsterHp : computePlayerDamage(player, inventoryBonus, multiplier)
    const newMonsterHp = Math.max(0, monsterHp - dmg)
    setMonsterHp(newMonsterHp)
    appendLog(willExecute ? `Execute! You finish off ${monster.name}.` : `You hit ${monster.name} for ${dmg} damage.`)
    spawnFloat(setMonsterFloats, `-${dmg}`)
    setMonsterHitPulse((p) => p + 1)
    playHitSound()

    if (lifeSteal > 0) {
      const healed = Math.min(player.maxHp, player.hp + Math.round(dmg * lifeSteal))
      if (healed > player.hp) updatePlayer({ hp: healed })
    }

    if (newMonsterHp <= 0) {
      appendLog(`${monster.name} is defeated!`)
      if (variant === 'police') {
        appendLog('The Hunter Cops retreat. Your Wanted Level drops.')
        setWantedLevel(-5)
      } else {
        grantVictoryRewards()
      }
      setOutcome('victory')
      setBusy(false)
      playVictorySound()
      return
    }

    const playerHpPct = player.hp / player.maxHp
    if (playerHpPct <= 0.05) recordLowHpTurn()

    const rawMonsterDmg = Math.max(1, Math.round(monster.attack * (0.85 + Math.random() * 0.3)))
    const totalReduction = Math.min(0.85, skillDamageReduction + auraReduction)
    const monsterDmg = Math.max(1, Math.round(rawMonsterDmg * (1 - totalReduction)))

    setTimeout(() => {
      const wouldBeLethal = monsterDmg >= player.hp
      const lethalSave = wouldBeLethal ? getLethalSaveEffect(professionId, hunterRank, lethalSaveUsed) : null

      if (lethalSave) {
        setLethalSaveUsed(true)
        if (lethalSave.type === 'unbreakable') {
          appendLog(`${monster.name} strikes for ${monsterDmg}, but you refuse to fall! (Unbreakable)`)
          updatePlayer({ hp: lethalSave.surviveHp })
        } else {
          const healedHp = Math.round(player.maxHp * lethalSave.healPct)
          appendLog(`${monster.name}'s blow should have been fatal — Sanctuary shields you and mends your wounds.`)
          updatePlayer({ hp: healedHp })
        }
        setTookDamage(true)
        spawnFloat(setPlayerFloats, `-${monsterDmg}`)
        setPlayerHitPulse((p) => p + 1)
        playTakeDamageSound()
        setBusy(false)
        return
      }

      appendLog(`${monster.name} strikes back for ${monsterDmg} damage.`)
      setTookDamage(true)
      spawnFloat(setPlayerFloats, `-${monsterDmg}`)
      setPlayerHitPulse((p) => p + 1)
      playTakeDamageSound()
      if (lethal) {
        takeDamage(monsterDmg)
        const afterState = useGameStore.getState()
        if (!afterState.player.alive) {
          setOutcome('defeat')
          playDefeatSound()
        }
      } else {
        const stillStanding = takeFinanceCombatDamage(monsterDmg)
        if (!stillStanding) {
          setOutcome('defeat')
          playDefeatSound()
        }
      }
      setBusy(false)
    }, 500)
  }

  const handleMeteor = () => {
    if (busy || outcome || meteorUsed) return
    setBusy(true)
    setMeteorUsed(true)
    const dmg = getMeteorDamage(player)
    const newMonsterHp = Math.max(0, monsterHp - dmg)
    setMonsterHp(newMonsterHp)
    appendLog(`You unleash Meteor! ${monster.name} takes ${dmg} magic damage.`)
    spawnFloat(setMonsterFloats, `-${dmg}`)
    setMonsterHitPulse((p) => p + 1)
    playHitSound()

    if (newMonsterHp <= 0) {
      appendLog(`${monster.name} is obliterated!`)
      if (variant === 'police') {
        setWantedLevel(-5)
      } else {
        grantVictoryRewards()
      }
      setOutcome('victory')
      setBusy(false)
      playVictorySound()
      return
    }
    setBusy(false)
  }

  const handleUseUmbrella = () => {
    if (busy || outcome || !weirdUmbrella) return
    removeItem(weirdUmbrella.id)
    appendLog(`You quietly close the rift from the outside with ${weirdUmbrella.name}.`)
    grantVictoryRewards()
    setOutcome('victory')
    playQuestCompleteSound()
  }

  const handleFlee = () => {
    onClose()
  }

  const handleContinue = () => {
    if (outcome === 'victory' && onVictory) onVictory()
    if (outcome === 'defeat' && onDefeat) onDefeat()
    onClose()
  }

  const meteorAvailable = canCastMeteor(professionId, hunterRank, meteorUsed) && !outcome

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[480px] border-4 border-red-500 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-2 text-xl font-bold text-red-400">
          {VARIANT_TITLES[variant]}
        </h2>
        {!lethal && (
          <p className="mb-2 text-xs text-yellow-300">
            This fight won't kill you - losing means a costly, humiliating retreat, not game over.
          </p>
        )}

        <div key={`monster-bar-${monsterHitPulse}`} className="relative mb-3 border-2 border-gray-600 bg-[#0f1020] p-3 animate-shake">
          <div className="flex justify-between text-sm">
            <span>{monster.name}</span>
            <span>{monsterHp} / {monster.maxHp} HP</span>
          </div>
          <div className="mt-1 h-3 w-full bg-gray-800">
            <div
              className="h-3 bg-red-500 transition-all"
              style={{ width: `${(monsterHp / monster.maxHp) * 100}%` }}
            />
          </div>
          {monsterFloats.map((f) => (
            <span
              key={f.id}
              className="animate-float-up-fade pointer-events-none absolute right-3 top-1 font-bold text-red-400"
            >
              {f.text}
            </span>
          ))}
        </div>

        <div key={`player-bar-${playerHitPulse}`} className="relative mb-3 border-2 border-gray-600 bg-[#0f1020] p-3 animate-shake">
          <div className="flex justify-between text-sm">
            <span>{player.name}</span>
            <span>{player.hp} / {player.maxHp} HP</span>
          </div>
          <div className="mt-1 h-3 w-full bg-gray-800">
            <div
              className="h-3 bg-green-500 transition-all"
              style={{ width: `${Math.max(0, (player.hp / player.maxHp) * 100)}%` }}
            />
          </div>
          {playerFloats.map((f) => (
            <span
              key={f.id}
              className="animate-float-up-fade pointer-events-none absolute right-3 top-1 font-bold text-red-400"
            >
              {f.text}
            </span>
          ))}
        </div>

        <div className="mb-4 h-24 overflow-y-auto border-2 border-gray-700 bg-black p-2 text-xs text-gray-300">
          {log.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>

        {!outcome && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-3">
              <button
                onClick={handleAttack}
                disabled={busy}
                className="flex-1 border-4 border-red-400 bg-red-500 py-2 font-bold text-black hover:bg-red-400 disabled:opacity-50"
              >
                Attack
              </button>
              <button
                onClick={handleFlee}
                disabled={busy}
                className="border-4 border-gray-500 px-4 py-2 font-bold hover:bg-gray-500 disabled:opacity-50"
              >
                Flee
              </button>
            </div>
            {meteorAvailable && (
              <button
                onClick={handleMeteor}
                disabled={busy}
                className="border-2 border-cyan-400 py-1 text-sm text-cyan-300 hover:bg-cyan-400 hover:text-black disabled:opacity-50"
              >
                ✦ Cast Meteor (once per fight)
              </button>
            )}
            {weirdUmbrella && (
              <button
                onClick={handleUseUmbrella}
                disabled={busy}
                className="border-2 border-purple-400 py-1 text-sm text-purple-300 hover:bg-purple-400 hover:text-black disabled:opacity-50"
              >
                ☂ Use {weirdUmbrella.name} (close rift instantly)
              </button>
            )}
          </div>
        )}

        {outcome === 'victory' && (
          <div className="text-center">
            <p className="mb-3 font-bold text-green-400">Victory!</p>
            <button
              onClick={handleContinue}
              className="border-4 border-green-400 bg-green-500 px-6 py-2 font-bold text-black hover:bg-green-400"
            >
              Continue
            </button>
          </div>
        )}

        {outcome === 'defeat' && lethal && (
          <div className="text-center">
            <p className="mb-3 font-bold text-red-500">You have fallen...</p>
          </div>
        )}

        {outcome === 'defeat' && !lethal && (
          <div className="text-center">
            <p className="mb-2 font-bold text-red-500">You've been beaten badly.</p>
            <p className="mb-3 text-xs text-gray-400">
              You wake up later, patched up and lighter in the wallet - a cut of your cash
              covered the "fees," and you're too drained to do anything else today.
            </p>
            <button
              onClick={handleContinue}
              className="border-4 border-gray-500 px-6 py-2 font-bold hover:bg-gray-500"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
