import { TIER_SPRITES } from '../../game/vehicleGen'

// Real overworld building each location opens from - see WorldScreen.jsx's
// BUILDING_TO_INTERACTIVE_LOCATION map, which is the other half of this
// wiring (a building's interior-desk click routes here by id). `buildingId`
// used to be a dead `coordinates: {x,y}` pair that nothing read; only
// mcdonalds_diner was actually reachable (hardcoded into WorldScreen.jsx's
// toolbar button), so the other 4 locations were unreachable dead data.
export const INTERACTIVE_LOCATIONS = [
  {
    id: 'mcdonalds_diner',
    name: "McDonald's & Cherry Coke Diner",
    district: 'Financial District',
    buildingId: 'teaHouse',
    icon: '🍔',
    description: "Warren Biffle's favorite breakfast spot. Order $3.17 Bacon McMuffins and cold Cherry Coke.",
    residentNpc: 'Warren Biffle',
    items: [
      { id: 'mcmuffin', name: '$3.17 Bacon McMuffin', cost: 3, energyRestore: 25, bonusText: '+25 Energy & Compound Interest Luck' },
      { id: 'cherry_coke', name: 'Cold Cherry Coke', cost: 2, energyRestore: 15, bonusText: '+15 Energy & Strategic Clarity' },
      { id: 'buffett_combo', name: "The Oracle's Combo", cost: 5, energyRestore: 50, bonusText: '+50 Energy & +$500 Passive Yield' },
    ],
  },
  {
    id: 'ford_factory',
    name: 'Ford Mass Assembly Plant',
    district: 'Commercial District - Docks',
    buildingId: 'fordRougeComplex',
    icon: '🏭',
    description: "Henry Ford's automated assembly line. Inspect production efficiency to boost company yield.",
    residentNpc: 'Henry Ford',
    actions: [
      { id: 'inspect_line', name: 'Inspect Assembly Line Efficiency', cost: 100, rewardText: '+15% Daily Company Dividend Yield' },
    ],
  },
  {
    id: 'apple_lab',
    name: 'Apple Glass Design Studio',
    district: 'Commercial District',
    buildingId: 'appleHQ',
    icon: '💻',
    description: "Steve Jobs' unibody glass design studio. Test prototype hardware to boost tech stock valuation.",
    residentNpc: 'Steve Jobs',
    actions: [
      { id: 'test_prototype', name: 'Test Prototype Curved Glass Hardware', cost: 200, rewardText: '+5% Tech Stock Price Hype' },
    ],
  },
  {
    id: 'speakeasy_club',
    name: 'Underground Speakeasy Club',
    district: 'Underground District',
    buildingId: 'speakeasyHotel',
    icon: '🍷',
    description: 'Prohibition-era subterranean club frequented by Al Capone, Lucky Luciano, and Arnold Rothstein.',
    residentNpc: 'Al Capone & Lucky Luciano',
    items: [
      { id: 'bootleg_whiskey', name: 'Prohibition Bootleg Whiskey', cost: 50, energyRestore: 30, bonusText: '-1 Wanted Level (Bribe Cop)' },
    ],
  },
  {
    id: 'transit_hub',
    name: 'Grand Central City Transit Hub',
    district: 'Government & Cultural District',
    // House rule: trainStation is special-cased in OverworldScene.js to open
    // the city-travel UI (TownTravelUI) directly from the overworld instead
    // of loading a generic building interior, so it never reaches
    // WorldScreen.jsx's generic BUILDING_TO_INTERACTIVE_LOCATION map the way
    // the other 4 locations do. This is opened from a "Station Shop" button
    // inside TownTravelUI instead (see WorldScreen.jsx/TownTravelUI.jsx) so
    // walking to the train station still reaches it without disabling the
    // real, working inter-city travel feature that building already runs.
    buildingId: 'trainStation',
    icon: '🚆',
    description: 'Central hub for express trains, electric bicycles, and luxury car rentals.',
    options: [
      { id: 'train_ticket', name: 'Express Train Pass to All Districts', cost: 20, type: 'transit' },
      // spriteName mirrors vehicleGen.js's TIER_SPRITES keyed by this same
      // option id, so WorldScreen's acquireVehicle bridge emit (and the
      // Phaser scene reading it) stays in sync with the atlas frame Vehicle
      // spawning actually uses, without a second copy of that mapping.
      { id: 'rent_bike', name: 'Rent City Bicycle (+50% Move Speed)', cost: 15, type: 'vehicle', speedMultiplier: 1.5, spriteName: TIER_SPRITES.rent_bike.spriteName },
      { id: 'rent_sedan', name: 'Rent Executive Sedan (+100% Move Speed)', cost: 100, type: 'vehicle', speedMultiplier: 2.0, spriteName: TIER_SPRITES.rent_sedan.spriteName },
      { id: 'buy_tesla', name: 'Purchase Cyber Roadster (+150% Move Speed)', cost: 5000, type: 'vehicle', speedMultiplier: 2.5, spriteName: TIER_SPRITES.buy_tesla.spriteName },
    ],
  },
]
