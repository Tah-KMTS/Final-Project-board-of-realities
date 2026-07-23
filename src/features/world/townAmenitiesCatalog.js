/**
 * Town Amenities, Running NPCs & Interactive Items Catalog across Tokyo, Kyoto, Osaka, and Sapporo.
 */

export const TOWN_AMENITIES_CATALOG = [
  {
    id: 'tokyo_supermarket',
    name: 'Tokyo Bay Supermarket & Fresh Market',
    city: 'Tokyo',
    district: 'Tokyo Bay Commercial Center',
    npc: { id: 'kenji', name: 'Manager Kenji', title: 'Store Manager', awareness: 40 },
    description: 'Bustling supermarket selling fresh groceries, Bacon McMuffins, Wagyu beef, and Cherry Cokes.',
    items: [
      { id: 'mcmuffin', name: 'Bacon McMuffin', type: 'food', price: 3.17, healHp: 25, stock: 20 },
      { id: 'wagyu_beef', name: 'A5 Wagyu Beef Prime Cut', type: 'food', price: 45.00, healHp: 80, stock: 8 },
      { id: 'cherry_coke', name: 'Ice Cold Cherry Coke', type: 'drink', price: 2.50, healHp: 15, stock: 30 },
      { id: 'energy_drink', name: 'Hyper Titan Energy Drink', type: 'drink', price: 3.00, healHp: 30, stock: 15 },
    ],
  },
  {
    id: 'kyoto_convenience',
    name: 'Kyoto Machiya 7-Eleven Convenience Store',
    city: 'Kyoto',
    district: 'Kyoto Historic District',
    npc: { id: 'yumi', name: 'Clerk Yumi', title: 'Night Shift Clerk', awareness: 30 },
    description: 'Traditional Machiya style 24/7 convenience store selling snacks, tea, and ramen.',
    items: [
      { id: 'instant_ramen', name: 'Spicy Tonkotsu Instant Ramen', type: 'food', price: 1.50, healHp: 20, stock: 25 },
      { id: 'matcha_tea', name: 'Uji Organic Matcha Green Tea', type: 'drink', price: 2.00, healHp: 15, stock: 20 },
      { id: 'onigiri', name: 'Salmon Onigiri Rice Ball', type: 'food', price: 1.80, healHp: 18, stock: 25 },
    ],
  },
  {
    id: 'tokyo_luxury_vault',
    name: 'Tokyo Ginza Luxury Department Store & Jewelry Vault',
    city: 'Tokyo',
    district: 'Tokyo Ginza District',
    npc: { id: 'pierre', name: 'Jeweler Pierre', title: 'Master Horologist', awareness: 75 },
    description: 'High-end Ginza luxury vault selling diamond watches, gold bullion, and bespoke suits.',
    items: [
      { id: 'diamond_watch', name: 'Diamond Chronograph Luxury Watch', type: 'luxury', price: 15000, perk: '+10 Charisma & Titan Respect', stock: 3 },
      { id: 'gold_bullion', name: '100g 24k Gold Bullion Bar', type: 'luxury', price: 25000, perk: 'High Wealth Asset', stock: 2 },
      { id: 'designer_suit', name: 'Bespoke Italian Silk Suit', type: 'luxury', price: 3500, perk: '+5 Charisma', stock: 5 },
    ],
  },
  {
    id: 'sapporo_tool_shop',
    name: 'Sapporo Heavy Tool & Blacksmith Workshop',
    city: 'Sapporo',
    district: 'Sapporo Industrial District',
    npc: { id: 'daiki', name: 'Blacksmith Daiki', title: 'Master Machinist', awareness: 55 },
    description: 'Industrial tool supply shop selling crowbars, lockpicks, and heavy sledgehammers.',
    items: [
      { id: 'crowbar', name: 'Forged Steel Heavy Crowbar', type: 'tool', price: 120, perk: 'Forces open store safes & doors', stock: 10 },
      { id: 'lockpick_set', name: 'Precision Diamond Lockpick Set', type: 'tool', price: 80, perk: 'Picks bank vaults & asset doors', stock: 15 },
      { id: 'sledgehammer', name: 'Demolition Heavy Sledgehammer', type: 'tool', price: 150, perk: 'Smashes store displays & barriers', stock: 8 },
    ],
  },
  {
    id: 'osaka_pawn_shop',
    name: 'Osaka Dotonbori Underground Pawn & Fence Shop',
    city: 'Osaka',
    district: 'Osaka Dotonbori District',
    npc: { id: 'sal', name: 'Pawn Broker Sal', title: 'Underground Syndicate Fence', awareness: 65 },
    description: 'Underground speakeasy pawn shop fencing stolen jewelry and selling contraband.',
    items: [
      { id: 'contraband_passport', name: 'Encrypted Offshore Passport', type: 'contraband', price: 2500, perk: 'Lowers Police Heat by -1', stock: 5 },
      { id: 'stolen_jewelry', name: 'Fenced Diamond Necklace', type: 'contraband', price: 5000, perk: 'High Value Syndicate Asset', stock: 4 },
    ],
  },
]
