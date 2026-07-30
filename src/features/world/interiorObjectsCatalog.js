/**
 * Interior Room Layouts, Equipment, Objects, Vehicles & NPCs Catalog.
 */

export const INTERIOR_BUILDINGS_CATALOG = {
  general_hospital: {
    buildingName: 'Central General Hospital & Trauma Center',
    rooms: [
      {
        id: 'main_lobby',
        name: '🚑 ER Emergency Triage Lobby',
        coordinates: { x: 0, y: 0 },
        npc: { name: 'Nurse Yuka', title: 'Triage Nurse' },
        equipment: [
          { id: 'defibrillator', name: 'Emergency Defibrillator & Medical Pod', effect: 'Heals 100% HP & Energy', coordinates: { x: 5, y: 5 } },
        ],
        vehicle: { name: 'Emergency Medical Ambulance', status: 'Parked in ER Bay', coordinates: { x: 10, y: 10 } },
      },
      {
        id: 'surgical_suite',
        name: '🩺 Operating Room & Surgical Suite',
        coordinates: { x: 20, y: 0 },
        npc: { name: 'Dr. Hiroshi', title: 'Chief Surgeon' },
        equipment: [
          { id: 'surgical_laser', name: 'Laser Surgical Station', effect: 'Cures all status ailments & trauma', coordinates: { x: 25, y: 5 } },
        ],
      },
      {
        id: 'icu_ward',
        name: '🛏️ ICU Patient Recovery Ward',
        coordinates: { x: 40, y: 0 },
        npc: { name: 'Dr. Tanaka', title: 'ICU Specialist' },
        equipment: [
          { id: 'patient_bed', name: 'Insured Patient Bed', effect: 'Restores +50 HP', coordinates: { x: 45, y: 5 } },
        ],
      },
      {
        id: 'helipad_roof',
        name: '🚁 Rooftop Helipad',
        coordinates: { x: 60, y: 0 },
        npc: null,
        equipment: [],
        vehicle: { name: 'Trauma Evacuation Helicopter', status: 'Stationed on Rooftop', coordinates: { x: 65, y: 5 } },
      },
    ],
  },
  fire_station: {
    buildingName: 'Municipal Fire Station & Rescue Depot',
    rooms: [
      {
        id: 'main_lobby',
        name: '🚒 Apparatus Engine Bay',
        coordinates: { x: 0, y: 0 },
        npc: { name: 'Chief Tanaka', title: 'Fire Marshal' },
        equipment: [
          { id: 'water_cannon', name: 'High-Pressure Water Hose Station', effect: 'Refills water cannons', coordinates: { x: 5, y: 5 } },
        ],
        vehicle: { name: 'Heavy Duty Fire Truck Engine', status: 'Parked in Apparatus Bay 1', coordinates: { x: 10, y: 10 } },
      },
      {
        id: 'dispatch_room',
        name: '📞 Dispatch & Control Center',
        coordinates: { x: 20, y: 0 },
        npc: { name: 'Dispatcher Ken', title: 'Emergency Dispatcher' },
        equipment: [
          { id: 'siren_control', name: 'Municipal Fire Alarm Siren', effect: 'Dispatches emergency units', coordinates: { x: 25, y: 5 } },
        ],
      },
    ],
  },
  police_hq: {
    buildingName: 'Central Metropolitan Police Headquarters',
    rooms: [
      {
        id: 'main_lobby',
        name: '🚓 SWAT Armored Garage & Lobby',
        coordinates: { x: 0, y: 0 },
        npc: { name: 'Captain Sato', title: 'Police Captain' },
        equipment: [
          { id: 'armor_rack', name: 'SWAT Tactical Body Armor Rack', effect: 'Equips Heavy Armor (+50 Defense)', coordinates: { x: 5, y: 5 } },
        ],
        vehicle: { name: 'SWAT Tactical Armored Cruiser', status: 'Parked in SWAT Garage', coordinates: { x: 10, y: 10 } },
      },
      {
        id: 'holding_cells',
        name: '🔒 Holding Cells & Booking Desk',
        coordinates: { x: 20, y: 0 },
        npc: { name: 'Officer Yamamoto', title: 'Booking Officer' },
        equipment: [
          { id: 'mugshot_camera', name: 'Federal Booking Camera', effect: 'Processes bail & release', coordinates: { x: 25, y: 5 } },
        ],
      },
    ],
  },
  commercial_bank: {
    buildingName: 'Commercial Bank & Safe Vault Depository',
    rooms: [
      {
        id: 'main_lobby',
        name: '💵 Main Teller Hall',
        coordinates: { x: 0, y: 0 },
        npc: { name: 'Banker Takahashi', title: 'Branch Manager' },
        equipment: [
          { id: 'teller_counter', name: 'Insured Cash Teller Counter', effect: 'Deposit / Withdraw Cash', coordinates: { x: 5, y: 5 } },
        ],
      },
      {
        id: 'safe_vault',
        name: '🔐 Underground Safe Vault',
        coordinates: { x: 20, y: 0 },
        npc: { name: 'Vault Guard Marcus', title: 'Armed Vault Guard' },
        equipment: [
          { id: 'vault_door', name: 'Heavy Reinforced Steel Vault Door', effect: 'Crackable with Crowbar/Lockpick for Gold Bullion!', coordinates: { x: 25, y: 5 } },
        ],
        vehicle: { name: 'Armored Money Transport Truck', status: 'Parked in Loading Bay', coordinates: { x: 30, y: 10 } },
      },
    ],
  },
  giga_factory: {
    buildingName: 'Giga Factory & SpaceX Launchpad',
    rooms: [
      {
        id: 'main_lobby',
        name: '🤖 Automated Robot Assembly Line',
        coordinates: { x: 0, y: 0 },
        npc: { name: 'Elon Musk', title: 'CEO & Chief Engineer' },
        equipment: [
          { id: 'welding_arm', name: 'Laser Robotic Welding Arm', effect: '+15% Manufacturing Production Yield', coordinates: { x: 5, y: 5 } },
        ],
        vehicle: { name: 'Tesla Cybertruck & Roadster', status: 'Parked on Test Track', coordinates: { x: 10, y: 10 } },
      },
    ],
  },
}
