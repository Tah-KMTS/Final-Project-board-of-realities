/**
 * Stealth Homicides, Citizen Rat/Snitch Reporting & FBI Informant Mechanics.
 */

export function executeStealthElimination(victimName, isDiscreetLocation = true) {
  if (isDiscreetLocation) {
    return {
      witnessed: false,
      initialWantedChange: 0,
      investigationLog: `🤫 DISCREET ELIMINATION: ${victimName} was eliminated silently in a secluded location. Zero snitches or witnesses around to rat you out. Wanted level remains 0!`,
      crimeScene: {
        id: `crime_${Date.now()}`,
        victimName,
        discovered: false,
        cleaned: false,
      },
    }
  } else {
    return {
      witnessed: true,
      initialWantedChange: 2,
      investigationLog: `🚨 PUBLIC ELIMINATION: ${victimName} was eliminated in plain view! A citizen ratted you out and snitched to Captain Sato's police patrol. Wanted level +2!`,
      crimeScene: null,
    }
  }
}

export function simulateSnitchReporting(crimeScene, day) {
  const isSnitched = Math.random() < 0.4
  if (isSnitched) {
    return {
      snitched: true,
      log: {
        id: `snitch_${day}_${Date.now()}`,
        day,
        title: '🐀 Snitch / Informant Rat Out',
        text: `A neighborhood informant ratted out details regarding ${crimeScene.victimName}'s disappearance to FBI Director J. Edgar Hoover!`,
      },
    }
  }
  return {
    snitched: false,
    log: null,
  }
}

export function simulatePoliceInvestigations(activeCrimeScenes, day) {
  const investigationLogs = []
  const updatedScenes = []

  activeCrimeScenes.forEach((scene) => {
    if (scene.cleaned) return // Cold case!

    if (!scene.discovered && Math.random() < 0.35) {
      scene.discovered = true
      const { snitched, log } = simulateSnitchReporting(scene, day)
      if (snitched && log) {
        investigationLogs.push(log)
      } else {
        investigationLogs.push({
          id: `investigation_${day}_${Date.now()}`,
          day,
          title: '🕵️ Police Forensic Investigation',
          text: `Police discovered a crime scene involving ${scene.victimName}. Captain Sato's forensic unit is auditing evidence.`,
        })
      }
    }
    updatedScenes.push(scene)
  })

  return {
    updatedScenes,
    investigationLogs,
  }
}
