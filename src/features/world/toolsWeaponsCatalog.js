/**
 * Realistic Tools & Weapons Placement Database.
 */

import { THEFT_ITEM } from '../../game/vehicleGen'

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
  // Catalog entry for vehicleGen.js's THEFT_ITEM so it's purchasable through
  // the Gun Store's existing Black Market tab (id/value/category match this
  // array's shape). GunStoreModal special-cases this id to addItem(THEFT_ITEM)
  // on purchase - the canonical object, not this display-only entry - so the
  // inventory copy keeps THEFT_ITEM's description/sellValue for InventoryModal.
  { id: THEFT_ITEM.id, name: THEFT_ITEM.name, category: 'tool', damage: 0, value: 120, assignedTo: ['burglar'] },
]

export function getNpcDefaultWeapons(npcType = 'mobster') {
  return WEAPONS_DATABASE.filter((w) => w.assignedTo.includes(npcType))
}
