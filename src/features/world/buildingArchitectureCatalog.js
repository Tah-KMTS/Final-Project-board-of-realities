/**
 * Real-World Building Architectural Heights & Visual Profiles Catalog.
 */

export const BUILDING_HEIGHT_CATEGORIES = {
  HIGH_RISE: {
    name: 'Skyscraper / High-Rise',
    floors: '8–15 Stories',
    style: 'Reinforced Steel & Solar Glass Tower',
    icon: '🏙️',
  },
  MID_RISE: {
    name: 'Mid-Rise Institutional',
    floors: '4–6 Stories',
    style: 'Neoclassical Granite Columned Building',
    icon: '🏛️',
  },
  LOW_RISE: {
    name: 'Low-Rise Depot / Facility',
    floors: '1–3 Stories',
    style: 'Brick Depot or Glass Storefront',
    icon: '🏘️',
  },
}

export const BUILDING_VISUAL_PROFILES = {
  hospital: {
    heightCategory: 'HIGH_RISE',
    floors: 8,
    facade: 'Modern White & Cyan Glass Medical Tower with Red Cross Helipad & Ambulance Bay',
    colorHex: '#06b6d4',
  },
  police_hq: {
    heightCategory: 'HIGH_RISE',
    floors: 12,
    facade: 'Dark Blue Tinted Glass & Steel Citadel with Antenna Arrays & SWAT Garage',
    colorHex: '#1e40af',
  },
  fire_station: {
    heightCategory: 'LOW_RISE',
    floors: 2,
    facade: 'Classic Red Brick Station House with Brass Bell Tower & Red Roll-Up Bay Doors',
    colorHex: '#dc2626',
  },
  university: {
    heightCategory: 'MID_RISE',
    floors: 4,
    facade: 'Gothic Red Brick Library with Clock Tower & Solar Research Observatory Dome',
    colorHex: '#7c3aed',
  },
  commercial_bank: {
    heightCategory: 'MID_RISE',
    floors: 5,
    facade: 'Neoclassical Granite Building with Marble Pillars & Subterranean Vault Doors',
    colorHex: '#059669',
  },
  government_fed: {
    heightCategory: 'HIGH_RISE',
    floors: 10,
    facade: 'Neoclassical Granite Banking Citadel with Gold Depository Vaults',
    colorHex: '#d97706',
  },
}
