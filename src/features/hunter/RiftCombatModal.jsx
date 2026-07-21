import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { generateMonster } from './monsters'
import { getProfession } from './professions'
import { rollRiftLoot } from './items'
import { playHitSound, playTakeDamageSound, playVictorySound, playDefeatSound } from '../../audio/sfx'

function computePlayerDamage(player) {
  const profession = getProfession(player.professionId)
  const focusStats = profession?.statFocus || ['STR']
  const base = focusStats.reduce((sum, key) => sum + (player.stats[key] || 0), 0) / focusStats.length
  const variance = 0.8 + Math.random() * 0.4
  return Math.max(1, Math.round(base * 1.6 * variance))
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
  onClose,
  onVictory,
}) {
  const player = useGameStore((s) => s.player)
  const takeDamage = useGameStore((s) => s.takeDamage)
  const gainExp = useGameStore((s) => s.gainExp)
  const addCash = useGameStore((s) => s.addCash)
  const addItem = useGameStore((s) => s.addItem)
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

  const appendLog = (line) => setLog((prev) => [...prev.slice(-4), line])

  const spawnFloat = (setFloats, text) => {
    const id = ++floatingTextSeq
    setFloats((prev) => [...prev, { id, text }])
    setTimeout(() => setFloats((prev) => prev.filter((f) => f.id !== id)), 700)
  }

  const handleAttack = () => {
    if (busy || outcome) return
    setBusy(true)

    const dmg = computePlayerDamage(player)
    const newMonsterHp = Math.max(0, monsterHp - dmg)
    setMonsterHp(newMonsterHp)
    appendLog(`You hit ${monster.name} for ${dmg} damage.`)
    spawnFloat(setMonsterFloats, `-${dmg}`)
    setMonsterHitPulse((p) => p + 1)
    playHitSound()

    if (newMonsterHp <= 0) {
      appendLog(`${monster.name} is defeated!`)
      if (variant === 'police') {
        appendLog('The Hunter Cops retreat. Your Wanted Level drops.')
        setWantedLevel(-5)
      } else {
        const loot = rollRiftLoot()
        const expReward = variant === 'finalRaid' ? 5000 : (20 + difficulty * 15)
        const cashReward = variant === 'finalRaid' ? 0 : (10 + difficulty * 8)
        gainExp(expReward)
        addCash(cashReward)
        addItem(loot)
        recordMonsterDefeated()
        recordRiftClear({ tookDamage })
      }
      setOutcome('victory')
      setBusy(false)
      playVictorySound()
      return
    }

    const playerHpPct = player.hp / player.maxHp
    if (playerHpPct <= 0.05) recordLowHpTurn()

    const monsterDmg = Math.max(1, Math.round(monster.attack * (0.85 + Math.random() * 0.3)))
    setTimeout(() => {
      appendLog(`${monster.name} strikes back for ${monsterDmg} damage.`)
      setTookDamage(true)
      spawnFloat(setPlayerFloats, `-${monsterDmg}`)
      setPlayerHitPulse((p) => p + 1)
      playTakeDamageSound()
      takeDamage(monsterDmg)
      const afterState = useGameStore.getState()
      if (!afterState.player.alive) {
        setOutcome('defeat')
        playDefeatSound()
      }
      setBusy(false)
    }, 500)
  }

  const handleFlee = () => {
    onClose()
  }

  const handleContinue = () => {
    if (outcome === 'victory' && onVictory) onVictory()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[480px] border-4 border-red-500 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-2 text-xl font-bold text-red-400">
          {VARIANT_TITLES[variant]}
        </h2>

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

        {outcome === 'defeat' && (
          <div className="text-center">
            <p className="mb-3 font-bold text-red-500">You have fallen...</p>
          </div>
        )}
      </div>
    </div>
  )
}
