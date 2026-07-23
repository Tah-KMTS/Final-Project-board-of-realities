/**
 * Enter & Exit Building Interior Engine.
 */

export function enterBuildingInterior(buildingId) {
  return {
    buildingId,
    activeRoomId: 'main_lobby',
    entryTimestamp: Date.now(),
  }
}

export function switchInteriorRoom(currentInterior, targetRoomId) {
  return {
    ...currentInterior,
    activeRoomId: targetRoomId,
  }
}
