/**
 * Realistic Tools & Weapons Placement Database.
 */

export const WEAPONS_DATABASE = [
  { id: 'glock19', name: 'Glock 19 Service Pistol (9mm)', category: 'firearm', damage: 35, value: 650, assignedTo: ['police', 'swat', 'bodyguard'] },
  { id: 'police_shotgun', name: 'Tactical Police Pump Shotgun (12 Gauge)', category: 'firearm', damage: 75, value: 1200, assignedTo: ['police', 'swat'] },
  { id: 'kevlar_vest', name: 'Kevlar Body Armor Vest', category: 'armor', defense: 50, value: 800, assignedTo: ['police', 'swat', 'bodyguard'] },
  { id: 'police_baton', name: 'Police Steel Baton', category: 'melee', damage: 20, value: 150, assignedTo: ['police'] },
  { id: 'tommy_gun', name: 'Thompson Submachine Gun (Tommy Gun 45 ACP)', category: 'firearm', damage: 55, value: 2500, assignedTo: ['crime_boss', 'mobster'] },
  { id: 'snubnose_revolver', name: 'Snubnose Revolver (38 Special)', category: 'firearm', damage: 40, value: 450, assignedTo: ['mobster', 'street_target'] },
  { id: 'stiletto_knife', name: 'Italian Stiletto Switchblade', category: 'melee', damage: 25, value: 200, assignedTo: ['mobster', 'street_target'] },
  { id: 'crowbar', name: 'Forged Steel Heavy Crowbar', category: 'tool', damage: 30, value: 120, assignedTo: ['blacksmith', 'burglar'] },
  { id: 'lockpick_set', name: 'Precision Diamond Lockpick Set', category: 'tool', damage: 5, value: 80, assignedTo: ['burglar', 'pawn_broker'] },
]

export function getNpcDefaultWeapons(npcType = 'mobster') {
  return WEAPONS_DATABASE.filter((w) => w.assignedTo.includes(npcType))
}
