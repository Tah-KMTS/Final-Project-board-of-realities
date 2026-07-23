import { getCharacterBiography } from './characterBiographies'

export const ROMANCE_TIERS = {
  STRANGER: { min: 0, max: 24, name: 'Stranger / Neutral' },
  ACQUAINTANCE: { min: 25, max: 49, name: 'Professional Acquaintance' },
  PARTNER: { min: 50, max: 74, name: 'Trusted Business Partner' },
  SUITOR: { min: 75, max: 99, name: 'Romantic Suitor / Courtship' },
  SPOUSE: { min: 100, max: 100, name: 'Spouse / Power Couple' },
}

export function initializeRomanceState() {
  return {
    relationships: {}, // npcId -> level (0-100)
    spouses: [],
    datingHistory: [],
  }
}

export function courtCharacter(currentRomance, npcId, npcName, actionType) {
  const rels = { ...(currentRomance.relationships || {}) }
  const currentLevel = rels[npcId] || 0
  const bio = getCharacterBiography(npcId)

  // Fidelity Check: Strictly Faithful characters refuse cheating if married to someone else
  if (bio.maritalStatus === 'Married' && bio.fidelity === 'Strictly Faithful' && currentLevel < 50) {
    return {
      success: false,
      reason: `${npcName} is devotedly married (${bio.maritalStatus}) and politely declines romantic flirtation due to their strictly faithful principles.`,
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
    text: `Went on a ${actionType.replace('_', ' ')} with ${npcName}. Relationship level is now ${newLevel}/100!`,
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
