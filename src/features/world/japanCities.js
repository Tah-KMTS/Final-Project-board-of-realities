// 4 Authentic Japanese Cities with Real Topography, Character Landmarks & Government Agency HQs

export const JAPAN_CITIES = [
  {
    id: 'tokyo',
    name: 'Tokyo (Metro Financial Capital)',
    region: 'Kanto Plain',
    topography: 'Flat Urban Plain along Tokyo Bay',
    naturalFeatures: ['Tokyo Bay Coastal Waterfront', 'Sumida River'],
    landmarks: [
      { id: 'tokyo_se', name: 'Tokyo Stock Exchange', type: 'financial' },
      { id: 'apple_glass_hq', name: 'Apple Unibody Glass Headquarters', type: 'character_built', owner: 'Steve Jobs' },
      { id: 'giga_factory_tokyo', name: 'Giga Factory & SpaceX Launchpad', type: 'character_built', owner: 'Elon Musk' },
      { id: 'fed_hq', name: 'Federal Reserve Central Bank HQ', type: 'government_agency', head: 'Jerome Powell' },
      { id: 'ftc_hq', name: 'FTC Antitrust Hearing Commission', type: 'government_agency', head: 'Lina Khan' },
    ],
    primaryResidents: ['Steve Jobs', 'Elon Musk', 'Jensen Huang', 'Jerome Powell', 'Lina Khan', 'Gary Gensler'],
  },
  {
    id: 'kyoto',
    name: 'Kyoto (Historical & Cultural Capital)',
    region: 'Kansai Valley',
    topography: 'Valley Surrounded by Higashiyama & Arashiyama Mountain Ranges',
    naturalFeatures: ['Kamo River', 'Lake Biwa Channel', 'Bamboo Forests'],
    landmarks: [
      { id: 'berkshire_tower', name: 'Berkshire Hathaway Financial Tower', type: 'character_built', owner: 'Warren Buffett' },
      { id: 'cherry_tea_house', name: "Cherry Coke Tea House & Diner", type: 'cultural' },
      { id: 'irs_hq', name: 'IRS Internal Revenue Building', type: 'government_agency', head: 'Mortimer Caplin' },
      { id: 'machiya_estate', name: 'Traditional Machiya Executive Estate', type: 'residence' },
    ],
    primaryResidents: ['Warren Buffett', 'Mortimer Caplin', 'Thomas Jefferson', 'George Washington'],
  },
  {
    id: 'osaka',
    name: 'Osaka (Merchant & Underground Nightlife Hub)',
    region: 'Kansai Delta',
    topography: 'Yodo River Delta & Osaka Bay Canals',
    naturalFeatures: ['Yodo River Delta', 'Dotonbori Canal', 'Osaka Bay Docks'],
    landmarks: [
      { id: 'chicago_speakeasy_hotel', name: 'Chicago Outfit Speakeasy Hotel & Casino', type: 'character_built', owner: 'Al Capone & Lucky Luciano' },
      { id: 'fbi_hq', name: 'FBI Federal Bureau Headquarters', type: 'government_agency', head: 'J. Edgar Hoover' },
      { id: 'dotonbori_arcade', name: 'Dotonbori Commercial Merchant Arcade', type: 'commercial' },
      { id: 'dock_vaults', name: 'Osaka Dock Underground Vaults', type: 'syndicate' },
    ],
    primaryResidents: ['Al Capone', 'Lucky Luciano', 'J. Edgar Hoover', 'Jesse Livermore', 'George Soros'],
  },
  {
    id: 'sapporo',
    name: 'Sapporo (Northern Industrial & Alpine Region)',
    region: 'Hokkaido Alpine',
    topography: 'Alpine Snow Peaks & Ishikari River Basin',
    naturalFeatures: ['Ishikari River', 'Lake Shikotsu Crater', 'Mount Yotei Snow Peaks'],
    landmarks: [
      { id: 'ford_rouge_complex', name: 'Ford River Rouge Mega Assembly Complex', type: 'character_built', owner: 'Henry Ford' },
      { id: 'carnegie_steel_mill', name: 'Homestead Steel Mill', type: 'character_built', owner: 'Andrew Carnegie' },
      { id: 'standard_oil_refinery', name: 'Standard Oil Central Refinery', type: 'character_built', owner: 'John D. Rockefeller' },
      { id: 'pentagon_dod_hq', name: 'Pentagon / DOD Military Procurement HQ', type: 'government_agency', head: 'Robert McNamara' },
      { id: 'epa_hq', name: 'EPA Environmental Regulation Agency', type: 'government_agency', head: 'William Ruckelshaus' },
    ],
    primaryResidents: ['Henry Ford', 'Andrew Carnegie', 'John D. Rockefeller', 'Robert McNamara', 'William Ruckelshaus'],
  },
]
