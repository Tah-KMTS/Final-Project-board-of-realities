import { getCharacterBiography } from './characterBiographies'

export function initializeRomanceState() {
  return {
    relationships: {},
    spouses: [],
    datingHistory: [],
    // npcId -> full raw chat transcript ([{ role, text }]), capped per-npc.
    // Separate from datingHistory (curated highlight log fed to the LLM as
    // situationContext) - this is the player-facing "what have we actually
    // talked about" log, not a summary. Added for LisaModal's history
    // viewer; empty object is a no-op for every NPC that doesn't use it.
    chatLog: {},
    // npcId -> in-game day of that NPC's last completed date, mirrors
    // world2.bossJobLastDay's "once per day" cooldown pattern
    // (isBossJobAvailableToday in useGameStore.js) so a date can't just be
    // spammed for repeat big affection gains.
    lastDateDay: {},
  }
}

export function courtCharacter(currentRomance, npcId, npcName, actionType, playerGender = 'Male') {
  const rels = { ...(currentRomance.relationships || {}) }
  const currentLevel = rels[npcId] || 0
  const bio = getCharacterBiography(npcId)

  // 1. Sexual Orientation Rule Check
  if (playerGender === bio.gender && bio.orientation === 'Heterosexual') {
    return {
      success: false,
      reason: `${npcName} is historically heterosexual and politely declines same-gender romantic courtship.`,
      updatedRomance: currentRomance,
    }
  }
  if (playerGender !== bio.gender && bio.orientation === 'Homosexual') {
    return {
      success: false,
      reason: `${npcName} is historically homosexual and politely declines opposite-gender romantic courtship.`,
      updatedRomance: currentRomance,
    }
  }

  // 2. Fidelity Check: Strictly Faithful characters refuse cheating if married to someone else
  if (bio.maritalStatus === 'Married' && bio.fidelity === 'Strictly Faithful' && currentLevel < 50) {
    return {
      success: false,
      reason: `${npcName} is devotedly married (${bio.maritalStatus}) and politely declines romantic flirtation due to strictly faithful principles.`,
      updatedRomance: currentRomance,
    }
  }

  // Increase relationship level
  let gain = 10
  if (actionType === 'date_diner') gain = 15
  if (actionType === 'date_opera') gain = 25
  if (actionType === 'proposal') gain = 35

  const newLevel = Math.min(100, currentLevel + gain)
  rels[npcId] = newLevel

  const updatedSpouses = [...(currentRomance.spouses || [])]
  if (newLevel >= 100 && !updatedSpouses.includes(npcId)) {
    updatedSpouses.push(npcId)
  }

  const newLog = {
    id: `date_${Date.now()}`,
    npcId,
    text: `Courtship with ${npcName} successful! Relationship level is now ${newLevel}/100.`,
  }

  return {
    success: true,
    newLevel,
    isSpouse: newLevel >= 100,
    updatedRomance: {
      ...currentRomance,
      relationships: rels,
      spouses: updatedSpouses,
      datingHistory: [newLog, ...(currentRomance.datingHistory || [])].slice(0, 20),
    },
  }
}
