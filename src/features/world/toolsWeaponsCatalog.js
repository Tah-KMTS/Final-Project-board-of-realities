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

// GunStoreModal purchases used to be flavor-only (nothing but THEFT_ITEM ever
// reached the player's real inventory - see that file's old comment), which
// meant a fight's "use weapon" option had nothing real to check ownership
// against. This converts a catalog entry into useGameStore's inventory-item
// shape (id/name/description/sellValue - see InventoryModal.jsx) so a
// purchase actually lands in state.inventory like any other item. Resale at
// 50% of catalog value, the same "sell for less than you paid" convention
// THEFT_ITEM already uses (value 120 -> sellValue 15, ~12%) just less steep,
// since these are real weapons rather than a single-purpose lockpick.
export function weaponToInventoryItem(weapon) {
  return {
    id: weapon.id,
    name: weapon.name,
    type: weapon.category,
    category: weapon.category,
    damage: weapon.damage,
    description: `${weapon.category === 'armor' ? 'Defense' : 'Damage'}: ${weapon.damage ?? weapon.defense ?? '—'}`,
    sellValue: Math.round(weapon.value * 0.5),
  }
}

// What "use weapon" in a fight actually means: the strongest real offensive
// item the player is currently carrying. Armor (kevlar_vest) is never one -
// it has no damage stat at all. The >= 15 floor excludes the two utility
// tools that carry a nominal damage value for other purposes elsewhere
// (lockpick_set: 5, THEFT_ITEM: unset) without hand-picking categories -
// crowbar (30, catalog category 'tool') still counts, same as any firearm
// or melee weapon, because a crowbar swung at someone is obviously a weapon
// regardless of which NPC type the catalog defaults it to.
// Every distinct combat-eligible weapon the player is carrying (same
// category/damage-floor filter getCombatWeapon always used), deduped by id
// - addItem never stacks a repeat purchase into a quantity, it just pushes
// another inventory entry, so without the dedupe a 2nd Glock would render
// as two identical "USE GLOCK" buttons. Sorted strongest-first so
// PoliceFightModal's per-weapon action list reads as a ranked choice, not
// catalog order. Backs the actual weapon-select UI (PoliceFightModal.jsx
// - one "USE {name}" button per carried weapon, so the player picks THIS
// fight's weapon by which button they press) - getCombatWeapon below still
// exists for anything that only wants the single best pick.
export function getCarriedWeapons(inventory) {
  const seen = new Set()
  const list = []
  for (const item of inventory) {
    if (item.category === 'armor' || !(item.damage >= 15) || seen.has(item.id)) continue
    seen.add(item.id)
    list.push(item)
  }
  return list.sort((a, b) => b.damage - a.damage)
}

export function getCombatWeapon(inventory) {
  return getCarriedWeapons(inventory)[0] || null
}

// getCombatWeapon's defensive counterpart - only kevlar_vest qualifies today
// (the catalog's one `category: 'armor'` entry), but reduce-to-best mirrors
// getCombatWeapon's shape in case a heavier armor item is ever added.
export function getCombatArmor(inventory) {
  const candidates = inventory.filter((item) => item.category === 'armor' && item.defense > 0)
  if (!candidates.length) return null
  return candidates.reduce((best, item) => (item.defense > best.defense ? item : best))
}

// Diminishing-returns curve (defense/(defense+100)) rather than a flat
// per-point cut, so a future higher-defense item can't approach 100%
// reduction and make the wearer unhittable - kevlar_vest's defense:50 works
// out to a 1/3 cut. Math.max(1, ...) floor matches rollOfficerDamage's own
// "always at least 1" floor - armor mitigates, never fully no-sells a hit.
export function applyArmorReduction(rawDamage, armor) {
  if (!armor) return rawDamage
  const reduction = armor.defense / (armor.defense + 100)
  return Math.max(1, Math.round(rawDamage * (1 - reduction)))
}
