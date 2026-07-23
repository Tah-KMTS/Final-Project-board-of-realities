import { BUILDING_VISUAL_PROFILES } from './buildingArchitectureCatalog'

export const ESSENTIAL_BUILDINGS_CATALOG = [
  {
    id: 'general_hospital',
    name: 'Central General Hospital & Emergency Trauma ER',
    city: 'Tokyo',
    district: 'Tokyo Medical District',
    height: '8 Stories (High-Rise)',
    profile: BUILDING_VISUAL_PROFILES.hospital,
    npc: { id: 'hiroshi', name: 'Dr. Hiroshi', title: 'Chief Surgeon & ER Director' },
    description: 'Modern white & cyan glass medical tower with a rooftop red cross helipad and emergency ambulance bay.',
    services: [
      { id: 'full_heal', name: 'Full Medical Treatment & Trauma Recovery', cost: 5000, effect: 'Restores 100% HP & Energy' },
      { id: 'trauma_kit', name: 'Purchase Emergency Trauma Medical Kit', cost: 1200, effect: 'Portable instant 50 HP restore' },
    ],
  },
  {
    id: 'fire_station',
    name: 'Municipal Fire Station & Rescue Depot',
    city: 'Osaka',
    district: 'Osaka Municipal District',
    height: '2 Stories (Low-Rise Depot)',
    profile: BUILDING_VISUAL_PROFILES.fire_station,
    npc: { id: 'tanaka', name: 'Chief Tanaka', title: 'Municipal Fire Marshal' },
    description: 'Classic red brick station house with brass bell tower, red roll-up bay doors, and fire engines.',
    services: [
      { id: 'arson_extinguish', name: 'Extinguish Active Arson & Factory Fires', cost: 8000, effect: 'Clears factory damage & restores production' },
      { id: 'fireproof_system', name: 'Install Automated Factory Sprinkler System', cost: 15000, effect: 'Grants +50% Arson Protection to assets' },
    ],
  },
  {
    id: 'police_hq',
    name: 'Central Metropolitan Police Headquarters',
    city: 'Tokyo',
    district: 'Tokyo Capitol District',
    height: '12 Stories (Skyscraper)',
    profile: BUILDING_VISUAL_PROFILES.police_hq,
    npc: { id: 'sato', name: 'Captain Sato', title: 'Metropolitan Police Captain' },
    description: 'Sleek dark blue glass & steel tower with radio antennas and SWAT vehicle garage.',
    services: [
      { id: 'warrant_payoff', name: 'Clear Municipal Arrest Warrants', cost: 50000, effect: 'Lowers Police Wanted Level by -2' },
      { id: 'police_escort', name: 'Hire Tactical Police Escort Squad', cost: 25000, effect: 'Protects player from syndicate muggings' },
    ],
  },
  {
    id: 'university_institute',
    name: 'National University & Technological Research Institute',
    city: 'Kyoto',
    district: 'Kyoto Academic Valley',
    height: '4 Stories (Mid-Rise)',
    profile: BUILDING_VISUAL_PROFILES.university,
    npc: { id: 'prof_sato', name: 'Dean Professor Sato', title: 'Research Institute Director' },
    description: 'Ivy League gothic red brick library with clock tower and solar research observatory dome.',
    services: [
      { id: 'fund_rd', name: 'Fund Advanced AI & Tech R&D Project', cost: 100000, effect: 'Pumps Tech Stock Price Hype (+10%)' },
      { id: 'hire_interns', name: 'Recruit University Research Interns', cost: 15000, effect: '+5% Daily Company Dividend Yield' },
    ],
  },
  {
    id: 'commercial_bank',
    name: 'Commercial Bank & Vault Depository',
    city: 'Osaka',
    district: 'Osaka Merchant District',
    height: '5 Stories (Mid-Rise)',
    profile: BUILDING_VISUAL_PROFILES.commercial_bank,
    npc: { id: 'takahashi', name: 'Banker Takahashi', title: 'Commercial Branch Manager' },
    description: 'Neoclassical granite building with marble pillars and subterranean vault doors.',
    services: [
      { id: 'safe_deposit', name: 'Deposit Cash into Insured Vault', cost: 0, effect: 'Protects cash from syndicate theft' },
      { id: 'commercial_loan', name: 'Take Out Business Expansion Loan', cost: -100000, effect: 'Borrow $100,000 capital at 5% interest' },
    ],
  },
]
