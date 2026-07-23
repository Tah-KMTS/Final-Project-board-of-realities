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
        npc: { name: 'Nurse Yuka', title: 'Triage Nurse' },
        equipment: [
          { id: 'defibrillator', name: 'Emergency Defibrillator & Medical Pod', effect: 'Heals 100% HP & Energy' },
        ],
        vehicle: { name: 'Emergency Medical Ambulance', status: 'Parked in ER Bay' },
      },
      {
        id: 'surgical_suite',
        name: '🩺 Operating Room & Surgical Suite',
        npc: { name: 'Dr. Hiroshi', title: 'Chief Surgeon' },
        equipment: [
          { id: 'surgical_laser', name: 'Laser Surgical Station', effect: 'Cures all status ailments & trauma' },
        ],
      },
      {
        id: 'icu_ward',
        name: '🛏️ ICU Patient Recovery Ward',
        npc: { name: 'Dr. Tanaka', title: 'ICU Specialist' },
        equipment: [
          { id: 'patient_bed', name: 'Insured Patient Bed', effect: 'Restores +50 HP' },
        ],
      },
      {
        id: 'helipad_roof',
        name: '🚁 Rooftop Helipad',
        npc: null,
        equipment: [],
        vehicle: { name: 'Trauma Evacuation Helicopter', status: 'Stationed on Rooftop' },
      },
    ],
  },
  fire_station: {
    buildingName: 'Municipal Fire Station & Rescue Depot',
    rooms: [
      {
        id: 'main_lobby',
        name: '🚒 Apparatus Engine Bay',
        npc: { name: 'Chief Tanaka', title: 'Fire Marshal' },
        equipment: [
          { id: 'water_cannon', name: 'High-Pressure Water Hose Station', effect: 'Refills water cannons' },
        ],
        vehicle: { name: 'Heavy Duty Fire Truck Engine', status: 'Parked in Apparatus Bay 1' },
      },
      {
        id: 'dispatch_room',
        name: '📞 Dispatch & Control Center',
        npc: { name: 'Dispatcher Ken', title: 'Emergency Dispatcher' },
        equipment: [
          { id: 'siren_control', name: 'Municipal Fire Alarm Siren', effect: 'Dispatches emergency units' },
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
        npc: { name: 'Captain Sato', title: 'Police Captain' },
        equipment: [
          { id: 'armor_rack', name: 'SWAT Tactical Body Armor Rack', effect: 'Equips Heavy Armor (+50 Defense)' },
        ],
        vehicle: { name: 'SWAT Tactical Armored Cruiser', status: 'Parked in SWAT Garage' },
      },
      {
        id: 'holding_cells',
        name: '🔒 Holding Cells & Booking Desk',
        npc: { name: 'Officer Yamamoto', title: 'Booking Officer' },
        equipment: [
          { id: 'mugshot_camera', name: 'Federal Booking Camera', effect: 'Processes bail & release' },
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
        npc: { name: 'Banker Takahashi', title: 'Branch Manager' },
        equipment: [
          { id: 'teller_counter', name: 'Insured Cash Teller Counter', effect: 'Deposit / Withdraw Cash' },
        ],
      },
      {
        id: 'safe_vault',
        name: '🔐 Underground Safe Vault',
        npc: { name: 'Vault Guard Marcus', title: 'Armed Vault Guard' },
        equipment: [
          { id: 'vault_door', name: 'Heavy Reinforced Steel Vault Door', effect: 'Crackable with Crowbar/Lockpick for Gold Bullion!' },
        ],
        vehicle: { name: 'Armored Money Transport Truck', status: 'Parked in Loading Bay' },
      },
    ],
  },
  giga_factory: {
    buildingName: 'Giga Factory & SpaceX Launchpad',
    rooms: [
      {
        id: 'main_lobby',
        name: '🤖 Automated Robot Assembly Line',
        npc: { name: 'Elon Musk', title: 'CEO & Chief Engineer' },
        equipment: [
          { id: 'welding_arm', name: 'Laser Robotic Welding Arm', effect: '+15% Manufacturing Production Yield' },
        ],
        vehicle: { name: 'Tesla Cybertruck & Roadster', status: 'Parked on Test Track' },
      },
    ],
  },
}
