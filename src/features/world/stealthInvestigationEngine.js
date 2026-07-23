/**
 * Stealth Homicides, Citizen Rat Reporting & Police Forensic Investigation Engine.
 */

export function executeStealthElimination(victimName, isDiscreetLocation = true) {
  if (isDiscreetLocation) {
    return {
      witnessed: false,
      initialWantedChange: 0,
      investigationLog: `🤫 DISCREET ELIMINATION: ${victimName} was eliminated silently in a secluded location. Zero witnesses. Wanted level remains 0!`,
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
      investigationLog: `🚨 PUBLIC ELIMINATION: ${victimName} was eliminated in plain view! Witnesses reported crime to police. Wanted level +2!`,
      crimeScene: null,
    }
  }
}

export function simulatePoliceInvestigations(activeCrimeScenes, day) {
  const investigationLogs = []
  const updatedScenes = []

  activeCrimeScenes.forEach((scene) => {
    if (scene.cleaned) return // Cold case!

    if (!scene.discovered && Math.random() < 0.35) {
      scene.discovered = true
      investigationLogs.push({
        id: `investigation_${day}_${Date.now()}`,
        day,
        title: '🕵️ Police Crime Scene Investigation',
        text: `Police discovered a crime scene involving ${scene.victimName}. Captain Sato's forensic unit is auditing shell casings & footprints!`,
      })
    }
    updatedScenes.push(scene)
  })

  return {
    updatedScenes,
    investigationLogs,
  }
}
