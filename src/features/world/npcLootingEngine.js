import { getNpcDefaultWeapons } from './toolsWeaponsCatalog'

/**
 * Dead NPC Belongings & Inventory Looting Engine.
 */
export function generateNpcLoot(victimNpc) {
  const npcRole = victimNpc.role || 'mobster'
  const weapons = getNpcDefaultWeapons(npcRole)

  const cashWallet = Math.floor(Math.random() * (victimNpc.netWorth ? Math.min(25000, victimNpc.netWorth * 0.0001) : 500)) + 150

  const lootItems = [
    ...weapons.map((w) => ({ id: `w_${w.id}_${Date.now()}`, name: w.name, category: w.category, value: w.value })),
    { id: `cash_${Date.now()}`, name: `Cash Wallet ($${cashWallet.toLocaleString()})`, category: 'cash', value: cashWallet },
  ]

  if (Math.random() < 0.3) {
    lootItems.push({ id: `luxury_${Date.now()}`, name: 'Gold Chronograph Watch', category: 'luxury', value: 3500 })
  }

  return {
    victimName: victimNpc.name || 'Defeated Target',
    cashWallet,
    lootItems,
  }
}
