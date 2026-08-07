import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { playHitSound, playTakeDamageSound, playVictorySound, playDefeatSound, playRetreatSound } from '../../audio/sfx'
import { generateSwatSquad } from './financeNpcs'
import { rollPunchDamage, rollKickDamage, rollUnleashDamage, rollOfficerDamage } from './policeFightEngine'
import { getCarriedWeapons, getCombatArmor, applyArmorReduction } from '../world/toolsWeaponsCatalog'
import PokeBattleLayout from './PokeBattleLayout'

// The Fight branch of PoliceStopModal's Fight/Escape/Bribe/Talk menu -
// Punch/Kick/Use Weapon/Special Move, replacing the old flat "Fight Now"
// -> FinanceSkirmishModal (Attack/Heavy/Guard/Dodge) path for THIS encounter
// only. FinanceSkirmishModal is untouched and still runs the two street-
// fight callers in WorldScreen.jsx plus its own police skin is no longer
// reachable from PoliceStopModal but is left in place rather than deleted,
// in case a future caller wants the simpler 4-choice engine.
//
// Same modal contract as every other combat component here: { onClose,
// onVictory, onDefeat }, plus onRetreat/retreatLabel for the in-fight Run
// button (same "bailing costs a Wanted bump" reasoning FinanceSkirmishModal's
// own onRetreat already documents - removing that option entirely would
// have been a net loss of player agency nobody asked for).
//
// Combat math lives in policeFightEngine.js, not here - see that file.
// Equipment modifiers (getCombatWeapon/getCombatArmor/applyArmorReduction,
// toolsWeaponsCatalog.js) are read from inventory the same way weapon
// already was: armor reduces every officer hit (resolveTurn and the
// charge-punish hit in handleSpecial both apply it) via a diminishing-
// returns curve, never a flat subtraction - see applyArmorReduction's own
// comment for why.

let floatingTextSeq = 0

export default function PoliceFightModal({ wantedLevel, isFBI, onClose, onVictory, onDefeat, onRetreat, retreatLabel }) {
  const player = useGameStore((s) => s.player)
  const inventory = useGameStore((s) => s.inventory)
  const takeFinanceCombatDamage = useGameStore((s) => s.takeFinanceCombatDamage)

  const [officer] = useState(() => generateSwatSquad(wantedLevel))
  const [officerHp, setOfficerHp] = useState(officer.hp)
  const armor = getCombatArmor(inventory)
  const [log, setLog] = useState([
    `${officer.name} squares up. Pick your move.`,
    ...(armor ? [`Your ${armor.name} is soaking up some of whatever's coming.`] : []),
  ])
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState(null) // null | 'victory' | 'defeat'
  const [charging, setCharging] = useState(false)

  const [enemyFloats, setEnemyFloats] = useState([])
  const [playerFloats, setPlayerFloats] = useState([])
  const [enemyHitPulse, setEnemyHitPulse] = useState(0)
  const [playerHitPulse, setPlayerHitPulse] = useState(0)
  // Idle stance is the fighting-ready pose (this is an active confrontation,
  // not a casual standoff) - briefly swaps to the attack pose right when a
  // side lands a hit, same "acting for a beat" idea PokeBattleLayout's own
  // internal logic uses, just driven explicitly here since the pose set
  // (ready/attack/down/tactical) doesn't fit that component's plain binary.
  const [enemyPose, setEnemyPose] = useState(isFBI ? 'officer_tactical' : 'officer_ready')
  const [playerPose, setPlayerPose] = useState('player_ready')

  const carriedWeapons = getCarriedWeapons(inventory)

  const appendLog = (line) => setLog((prev) => [...prev.slice(-5), line])

  const spawnFloat = (setFloats, text) => {
    const id = ++floatingTextSeq
    setFloats((prev) => [...prev, { id, text }])
    setTimeout(() => setFloats((prev) => prev.filter((f) => f.id !== id)), 700)
  }

  const enemyIdlePose = () => (isFBI ? 'officer_tactical' : 'officer_ready')
  const enemyActionPose = () => (isFBI ? 'officer_tactical' : 'officer_attack')

  // Shared turn resolver for every player action except the charge-start
  // turn (see handleSpecial) - a punch/kick/weapon swing, or the automatic
  // unleash, all just deal playerDamage to the officer then let the officer
  // swing back once. Charging is cleared here too, since the unleash turn
  // is always the one that follows a charge.
  const resolveTurn = (playerDamage, logLine) => {
    setBusy(true)
    setPlayerPose('player_attack')
    setEnemyPose(enemyActionPose())
    appendLog(logLine)

    setTimeout(() => {
      const newOfficerHp = Math.max(0, officerHp - playerDamage)
      setOfficerHp(newOfficerHp)
      if (playerDamage > 0) {
        spawnFloat(setEnemyFloats, `-${playerDamage}`)
        setEnemyHitPulse((p) => p + 1)
        playHitSound()
        appendLog(`You hit ${officer.name} for ${playerDamage} damage.`)
      }

      if (newOfficerHp <= 0) {
        appendLog(`${officer.name} is down!`)
        setEnemyPose('officer_down')
        setOutcome('victory')
        setBusy(false)
        setCharging(false)
        playVictorySound()
        return
      }

      const officerDamage = applyArmorReduction(rollOfficerDamage(officer.attack), armor)
      const stillStanding = takeFinanceCombatDamage(officerDamage)
      spawnFloat(setPlayerFloats, `-${officerDamage}`)
      setPlayerHitPulse((p) => p + 1)
      playTakeDamageSound()
      appendLog(`${officer.name} hits back for ${officerDamage} damage.`)

      setCharging(false)
      setEnemyPose(enemyIdlePose())

      if (!stillStanding) {
        appendLog('You’ve been beaten badly.')
        setPlayerPose('player_crouch')
        setOutcome('defeat')
        setBusy(false)
        playDefeatSound()
        return
      }

      setPlayerPose('player_ready')
      setBusy(false)
    }, 450)
  }

  const handlePunch = () => resolveTurn(rollPunchDamage(), 'You throw a punch...')
  const handleKick = () => resolveTurn(rollKickDamage(), 'You lead with a kick...')
  const handleWeapon = (w) => resolveTurn(w.damage, `You go for your ${w.name}...`)
  const handleUnleash = () => resolveTurn(rollUnleashDamage(), 'You unleash the charged strike!')

  // Charging deals no damage this turn and skips straight to the officer's
  // swing - winding up leaves you open, which is the real cost of picking
  // this over a normal hit. Player pose stays 'ready' rather than 'attack'
  // (no dedicated wind-up art exists) with the log line carrying the beat.
  const handleSpecial = () => {
    setBusy(true)
    appendLog('You plant your feet and wind up for a big hit...')
    setEnemyPose(enemyActionPose())

    setTimeout(() => {
      const officerDamage = applyArmorReduction(rollOfficerDamage(officer.attack), armor)
      const stillStanding = takeFinanceCombatDamage(officerDamage)
      spawnFloat(setPlayerFloats, `-${officerDamage}`)
      setPlayerHitPulse((p) => p + 1)
      playTakeDamageSound()
      appendLog(`${officer.name} catches you mid-windup for ${officerDamage} damage!`)
      setEnemyPose(enemyIdlePose())

      if (!stillStanding) {
        appendLog('You’ve been beaten badly.')
        setPlayerPose('player_crouch')
        setOutcome('defeat')
        setBusy(false)
        playDefeatSound()
        return
      }

      setCharging(true)
      setBusy(false)
    }, 450)
  }

  const handleRetreat = () => {
    playRetreatSound()
    onRetreat?.()
    onClose()
  }

  const handleContinue = () => {
    if (outcome === 'victory' && onVictory) onVictory()
    if (outcome === 'defeat' && onDefeat) onDefeat()
    onClose()
  }

  // One "USE {name}" button per distinct carried weapon (not just the
  // strongest) - this IS the weapon-select UI: which button the player
  // presses this turn is the pick, same click-a-move interaction every
  // other action here already uses, no separate picker widget needed.
  // Unarmed shows a disabled hint in that same grid slot instead of a
  // silent gap, pointing at where a weapon actually comes from.
  const actions = charging
    ? [{ key: 'unleash', label: 'UNLEASH!', onClick: handleUnleash, disabled: busy }]
    : [
        { key: 'punch', label: 'PUNCH', onClick: handlePunch, disabled: busy },
        { key: 'kick', label: 'KICK', onClick: handleKick, disabled: busy },
        ...(carriedWeapons.length
          ? carriedWeapons.map((w) => ({
              key: `weapon-${w.id}`,
              label: `USE ${w.name.split(' ')[0].toUpperCase()} (${w.damage})`,
              onClick: () => handleWeapon(w),
              disabled: busy,
            }))
          : [{ key: 'noWeapon', label: 'NO WEAPON (Underworld Gun Store)', onClick: () => {}, disabled: true }]),
        { key: 'special', label: 'SPECIAL MOVE', onClick: handleSpecial, disabled: busy },
      ]

  return (
    <PokeBattleLayout
      title={isFBI ? 'FBI Confrontation' : 'Police Confrontation'}
      subtitle={charging ? 'Charging - the next hit lands hard' : 'Losing costs cash and pride, not the run.'}
      enemyName={officer.name}
      enemyHp={officerHp}
      enemyMaxHp={officer.maxHp}
      playerName={player.name}
      playerHp={player.hp}
      playerMaxHp={player.maxHp}
      log={log}
      outcome={outcome}
      victoryText={`${officer.name} stands down. You are clear to go.`}
      defeatText="They put you down. You wake up later, patched up and lighter in the wallet."
      actions={actions}
      retreat={{ label: retreatLabel, onClick: handleRetreat, disabled: busy }}
      onContinue={handleContinue}
      enemyHitPulse={enemyHitPulse}
      playerHitPulse={playerHitPulse}
      enemyFloats={enemyFloats}
      playerFloats={playerFloats}
      enemySpriteKey={enemyPose}
      playerSpriteKey={playerPose}
    />
  )
}
