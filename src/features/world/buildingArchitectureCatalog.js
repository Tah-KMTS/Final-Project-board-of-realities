/**
 * Real-World Building Architectural Heights & Option 2 (HD-2D JRPG) / Option 3 (Luxury Architectural) Visual Profiles Catalog.
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
  SHINTO_PAGODA: {
    name: 'Kyoto Shinto Pagoda',
    floors: '3–5 Eaves',
    style: 'HD-2D Traditional Japanese Red Timber Pagoda with Paper Lanterns',
    icon: '⛩️',
  },
  LUXURY_TOWER: {
    name: 'Luxury Slate & Gold Tower',
    floors: '15–20 Stories',
    style: 'Brushed Slate Marble & Gold Leaf Curtain-Wall Skyscraper',
    icon: '🏢',
  },
}

export const BUILDING_VISUAL_PROFILES = {
  hospital: {
    heightCategory: 'HIGH_RISE',
    floors: 8,
    facade: 'Modern White & Cyan Glass Medical Tower with Red Cross Helipad & Ambulance Bay',
    colorHex: '#06b6d4',
    coordinates: { x: 0, y: 0 },
  },
  police_hq: {
    heightCategory: 'HIGH_RISE',
    floors: 12,
    facade: 'Dark Blue Tinted Glass & Steel Citadel with Antenna Arrays & SWAT Garage',
    colorHex: '#1e40af',
    coordinates: { x: 0, y: 0 },
  },
  fire_station: {
    heightCategory: 'LOW_RISE',
    floors: 2,
    facade: 'Classic Red Brick Station House with Brass Bell Tower & Red Roll-Up Bay Doors',
    colorHex: '#dc2626',
    coordinates: { x: 0, y: 0 },
  },
  university: {
    heightCategory: 'MID_RISE',
    floors: 4,
    facade: 'HD-2D Gothic Red Brick Institute with Telescope Dome & Shinto Torii Gate',
    colorHex: '#7c3aed',
    coordinates: { x: 0, y: 0 },
  },
  commercial_bank: {
    heightCategory: 'MID_RISE',
    floors: 5,
    facade: 'Neoclassical Granite Building with Marble Pillars & Subterranean Vault Doors',
    colorHex: '#059669',
    coordinates: { x: 0, y: 0 },
  },
  government_fed: {
    heightCategory: 'HIGH_RISE',
    floors: 10,
    facade: 'Neoclassical Granite Banking Citadel with Gold Depository Vaults',
    colorHex: '#d97706',
    coordinates: { x: 0, y: 0 },
  },
  // KYOTO HD-2D JRPG PILOT BUILDINGS
  nintendo_hq: {
    heightCategory: 'MID_RISE',
    floors: 5,
    facade: 'HD-2D Cel-Shaded Red & White Corporate Gaming Pavilion with Pixel Signs',
    colorHex: '#e11d48',
    coordinates: { x: 0, y: 0 },
  },
  berkshire_pavilion: {
    heightCategory: 'SHINTO_PAGODA',
    floors: 4,
    facade: 'HD-2D Cel-Shaded Dark Wood & Gold Leaf Financial Pavilion (Warren Biffle HQ)',
    colorHex: '#eab308',
    coordinates: { x: 0, y: 0 },
  },
  cherry_tea_house: {
    heightCategory: 'LOW_RISE',
    floors: 2,
    facade: 'HD-2D Traditional Japanese Timber Tea House with Red Paper Lanterns & Cherry Blossom Garden',
    colorHex: '#f43f5e',
    coordinates: { x: 0, y: 0 },
  },
  // TOKYO OPTION 3 LUXURY ARCHITECTURAL PILOT BUILDINGS
  apple_glass_campus: {
    heightCategory: 'LUXURY_TOWER',
    floors: 16,
    facade: 'Sleek Curved Glass Curtain-Wall Skyscraper with Solar Panels (Steve Jobs HQ)',
    colorHex: '#94a3b8',
    coordinates: { x: 0, y: 0 },
  },
  giga_factory_spire: {
    heightCategory: 'LUXURY_TOWER',
    floors: 18,
    facade: 'Brushed Titanium Assembly Complex & Rocket Gantry Spire (Elan Rusk HQ)',
    colorHex: '#38bdf8',
    coordinates: { x: 0, y: 0 },
  },
  tokyo_stock_citadel: {
    heightCategory: 'LUXURY_TOWER',
    floors: 15,
    facade: 'Dark Slate Marble Financial Citadel with Gold Ledgers & Market Ticker Marquees',
    colorHex: '#f59e0b',
    coordinates: { x: 0, y: 0 },
  },
}
