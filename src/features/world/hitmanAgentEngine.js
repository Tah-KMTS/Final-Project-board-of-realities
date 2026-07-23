import { FAMOUS_HITMEN_CATALOG } from './famousHitmenCatalog'

/**
 * Autonomous Hitman AI Agent Engine & Detective Counterpart Pursuit.
 */

export function executeHitmanContract(hitmanId, targetName, framingOption = 'innocent_citizen') {
  const hitman = FAMOUS_HITMEN_CATALOG.find((h) => h.id === hitmanId) || FAMOUS_HITMEN_CATALOG[0]

  let framingLog = ''
  if (framingOption === 'innocent_citizen') {
    framingLog = `🎭 FRAMING INNOCENT: ${hitman.name} planted incriminating weapons on an innocent street citizen! Police issued wrongful arrest warrant.`
  } else if (framingOption === 'rival_cartel') {
    framingLog = `💣 FRAMING RIVAL CARTEL: ${hitman.name} dropped Medellin cartel cocaine at the scene! Incited syndicate turf war between cartels.`
  } else {
    framingLog = `🤫 CLEAN EXECUTION: No framing evidence planted. ${hitman.name} left signature trace (${hitman.signatureTrace}).`
  }

  const contractResult = {
    id: `hit_${Date.now()}`,
    hitmanName: hitman.name,
    targetName,
    signatureWeapon: hitman.signatureWeapon,
    signatureTrace: hitman.signatureTrace,
    framingLog,
    detective: hitman.detectiveCounterpart,
    timestamp: Date.now(),
  }

  return contractResult
}

export function simulateDetectivePursuit(activeHits, day) {
  const pursuitLogs = []

  activeHits.forEach((hit) => {
    if (Math.random() < 0.4) {
      pursuitLogs.push({
        id: `detective_${day}_${Date.now()}`,
        day,
        title: `🕵️ ${hit.detective.name} Counter-Investigation`,
        text: `${hit.detective.agency} (${hit.detective.name}): Analyzing ${hit.signatureTrace} from ${hit.targetName}'s elimination! Target skill rating: ${hit.detective.skill}.`,
      })
    }
  })

  return pursuitLogs
}
