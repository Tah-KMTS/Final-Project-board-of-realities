/**
 * Transportation & Transit System (Cars, Bicycles, Express Train Line).
 */

export function initializeTransportationState() {
  return {
    currentVehicle: 'On Foot', // 'On Foot' | 'City Bicycle' | 'Executive Sedan' | 'Cyber Roadster'
    speedMultiplier: 1.0,
    hasTrainPass: false,
    activeStation: 'Financial District Station',
    transitLogs: [
      { id: 'transit_init', time: '8:00 AM', text: 'Transit system ready. Electric bicycles, cars, and express trains available.' }
    ],
  }
}

export function purchaseVehicle(currentTransit, vehicleName, cost, multiplier) {
  return {
    ...currentTransit,
    currentVehicle: vehicleName,
    speedMultiplier: multiplier,
    transitLogs: [
      { id: `vehicle_${Date.now()}`, time: 'Now', text: `Acquired ${vehicleName}! Movement speed increased by ${Math.round((multiplier - 1) * 100)}%.` },
      ...(currentTransit.transitLogs || []),
    ].slice(0, 20),
  }
}

export function boardExpressTrain(currentTransit, targetDistrict) {
  return {
    ...currentTransit,
    activeStation: `${targetDistrict} Station`,
    transitLogs: [
      { id: `train_${Date.now()}`, time: 'Now', text: `Boarded Express Train to ${targetDistrict}. Instant district transit complete!` },
      ...(currentTransit.transitLogs || []),
    ].slice(0, 20),
  }
}
