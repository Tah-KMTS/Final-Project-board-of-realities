// 4 Authentic Japanese Cities with Real Topography, Character Landmarks & Government Agency HQs

export const JAPAN_CITIES = [
  {
    id: 'tokyo',
    name: 'Tokyo (Metro Financial Capital)',
    region: 'Kanto Plain',
    coordinates: { x: 100, y: 100 },
    topography: 'Flat Urban Plain along Tokyo Bay',
    naturalFeatures: ['Tokyo Bay Coastal Waterfront', 'Sumida River'],
    landmarks: [
      { id: 'tokyo_se', name: 'Tokyo Stock Exchange', type: 'financial', coordinates: { x: 110, y: 110 } },
      { id: 'apple_glass_hq', name: 'Apple Unibody Glass Headquarters', type: 'character_built', owner: 'Steve Jobs', coordinates: { x: 120, y: 120 } },
      { id: 'giga_factory_tokyo', name: 'Giga Factory & SpaceX Launchpad', type: 'character_built', owner: 'Elon Musk', coordinates: { x: 130, y: 130 } },
      { id: 'fed_hq', name: 'Federal Reserve Central Bank HQ', type: 'government_agency', head: 'Jerome Powell', coordinates: { x: 140, y: 140 } },
      { id: 'ftc_hq', name: 'FTC Antitrust Hearing Commission', type: 'government_agency', head: 'Lina Khan', coordinates: { x: 150, y: 150 } },
    ],
    primaryResidents: ['Steve Jobs', 'Elon Musk', 'Jensen Huang', 'Jerome Powell', 'Lina Khan', 'Gary Gensler'],
  },
  {
    id: 'kyoto',
    name: 'Kyoto (Historical & Cultural Capital)',
    region: 'Kansai Valley',
    coordinates: { x: 200, y: 200 },
    topography: 'Valley Surrounded by Higashiyama & Arashiyama Mountain Ranges',
    naturalFeatures: ['Kamo River', 'Lake Biwa Channel', 'Bamboo Forests'],
    landmarks: [
      { id: 'berkshire_tower', name: 'Berkshire Hathaway Financial Tower', type: 'character_built', owner: 'Warren Buffett', coordinates: { x: 210, y: 210 } },
      { id: 'cherry_tea_house', name: "Cherry Coke Tea House & Diner", type: 'cultural', coordinates: { x: 220, y: 220 } },
      { id: 'irs_hq', name: 'IRS Internal Revenue Building', type: 'government_agency', head: 'Mortimer Caplin', coordinates: { x: 230, y: 230 } },
      { id: 'machiya_estate', name: 'Traditional Machiya Executive Estate', type: 'residence', coordinates: { x: 240, y: 240 } },
    ],
    primaryResidents: ['Warren Buffett', 'Mortimer Caplin', 'Thomas Jefferson', 'George Washington'],
  },
  {
    id: 'osaka',
    name: 'Osaka (Merchant & Underground Nightlife Hub)',
    region: 'Kansai Delta',
    coordinates: { x: 300, y: 300 },
    topography: 'Yodo River Delta & Osaka Bay Canals',
    naturalFeatures: ['Yodo River Delta', 'Dotonbori Canal', 'Osaka Bay Docks'],
    landmarks: [
      { id: 'chicago_speakeasy_hotel', name: 'Chicago Outfit Speakeasy Hotel & Casino', type: 'character_built', owner: 'Al Capone & Lucky Luciano', coordinates: { x: 310, y: 310 } },
      { id: 'fbi_hq', name: 'FBI Federal Bureau Headquarters', type: 'government_agency', head: 'J. Edgar Hoover', coordinates: { x: 320, y: 320 } },
      { id: 'dotonbori_arcade', name: 'Dotonbori Commercial Merchant Arcade', type: 'commercial', coordinates: { x: 330, y: 330 } },
      { id: 'dock_vaults', name: 'Osaka Dock Underground Vaults', type: 'syndicate', coordinates: { x: 340, y: 340 } },
    ],
    primaryResidents: ['Al Capone', 'Lucky Luciano', 'J. Edgar Hoover', 'Jesse Livermore', 'George Soros'],
  },
  {
    id: 'sapporo',
    name: 'Sapporo (Northern Industrial & Alpine Region)',
    region: 'Hokkaido Alpine',
    coordinates: { x: 400, y: 400 },
    topography: 'Alpine Snow Peaks & Ishikari River Basin',
    naturalFeatures: ['Ishikari River', 'Lake Shikotsu Crater', 'Mount Yotei Snow Peaks'],
    landmarks: [
      { id: 'ford_rouge_complex', name: 'Ford River Rouge Mega Assembly Complex', type: 'character_built', owner: 'Henry Ford', coordinates: { x: 410, y: 410 } },
      { id: 'carnegie_steel_mill', name: 'Homestead Steel Mill', type: 'character_built', owner: 'Andrew Carnegie', coordinates: { x: 420, y: 420 } },
      { id: 'standard_oil_refinery', name: 'Standard Oil Central Refinery', type: 'character_built', owner: 'John D. Rockefeller', coordinates: { x: 430, y: 430 } },
      { id: 'pentagon_dod_hq', name: 'Pentagon / DOD Military Procurement HQ', type: 'government_agency', head: 'Robert McNamara', coordinates: { x: 440, y: 440 } },
      { id: 'epa_hq', name: 'EPA Environmental Regulation Agency', type: 'government_agency', head: 'William Ruckelshaus', coordinates: { x: 450, y: 450 } },
    ],
    primaryResidents: ['Henry Ford', 'Andrew Carnegie', 'John D. Rockefeller', 'Robert McNamara', 'William Ruckelshaus'],
  },
]

export function getCityById(cityId = 'tokyo') {
  return JAPAN_CITIES.find((c) => c.id === cityId) || JAPAN_CITIES[0]
}

