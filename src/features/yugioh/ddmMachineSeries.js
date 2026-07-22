// Machine/Industrial Series (50 monsters, 5 factions of 10). See
// ddmDragonSeries.js for the mechanic-tag convention.

const machine = (id, name, level, hp, atk, def, ability) => ({
  id, name, level, hp, atk, def, creatureType: 'Machine', ability,
})

export const MACHINE_SERIES = [
  // --- Faction 1: The Dark Forge (Heat & Armor) ---
  machine('slag_mite', 'Slag Mite', 1, 10, 10, 10, {
    id: 'scrap_shield', name: 'Scrap Shield', crestCost: { defense: 1 }, target: 'self',
    description: 'Gain +10 DEF this turn.', mechanic: 'temp_def_buff', params: { amount: 10, duration: 1 },
  }),
  machine('coal_stoker_imp', 'Coal-Stoker Imp', 1, 20, 10, 0, {
    id: 'kindle', name: 'Kindle', crestCost: { spell: 1 }, target: 'adjacent-enemy',
    description: 'Deal 10 damage to an adjacent enemy.', mechanic: 'damage_target', params: { amount: 10 },
  }),
  machine('ironclad_welder', 'Ironclad Welder', 2, 20, 10, 20, {
    id: 'spot_weld', name: 'Spot Weld', crestCost: { spell: 1 }, target: 'ally-adjacent',
    description: 'Restore 10 HP to an adjacent Machine-type ally.', mechanic: 'heal_target', params: { amount: 10 },
  }),
  machine('smelt_hound', 'Smelt-Hound', 2, 30, 20, 10, {
    id: 'bite_clamp', name: 'Bite-Clamp', crestCost: { attack: 1 }, target: 'adjacent-enemy',
    description: 'Target enemy cannot move next turn.', mechanic: 'freeze_target', params: { duration: 1, moveOnly: true },
  }),
  machine('crucible_automaton', 'Crucible Automaton', 3, 30, 20, 30, {
    id: 'molten_spill', name: 'Molten Spill', crestCost: { spell: 2 }, target: 'self',
    description: 'Deal 10 damage to all enemies within 2 tiles.', mechanic: 'damage_radius', params: { amount: 10, radius: 2 },
  }),
  machine('bellows_lung_brute', 'Bellows-Lung Brute', 3, 40, 20, 10, {
    id: 'heat_wave', name: 'Heat Wave', crestCost: { spell: 2 }, target: 'not_implemented',
    description: 'Push all adjacent enemies 2 tiles away.', mechanic: 'not_implemented',
  }),
  machine('thermal_core_sentinel', 'Thermal-Core Sentinel', 3, 30, 30, 20, {
    id: 'overheat', name: 'Overheat', crestCost: { attack: 2 }, target: 'self',
    description: 'Ignore enemy DEF for your next attack this turn.', mechanic: 'ignore_def_self', params: { duration: 1 },
  }),
  machine('blast_furnace_golem', 'Blast-Furnace Golem', 4, 50, 30, 30, {
    id: 'incinerate', name: 'Incinerate', crestCost: { spell: 3 }, target: 'not_implemented',
    description: 'Destroy one adjacent enemy level 2 or lower instantly.', mechanic: 'not_implemented',
  }),
  machine('magma_tread_titan', 'Magma-Tread Titan', 4, 60, 30, 40, {
    id: 'slag_trail', name: 'Slag Trail', crestCost: { spell: 3 }, target: 'not_implemented',
    description: 'Leave Hazard Tiles behind when moving this turn; enemies stepping on them take 10 damage.',
    mechanic: 'not_implemented',
  }),
  machine('dark_steel_overlord', 'Dark-Steel Overlord', 4, 50, 50, 20, {
    id: 'furnace_roar', name: 'Furnace Roar', crestCost: { spell: 4 }, target: 'self',
    description: 'Deal 20 damage to all enemies on the board.', mechanic: 'damage_all_enemies',
    params: { amount: 20 },
  }),

  // --- Faction 2: S.K.Y. Pneumatics (Air Pressure & Nozzles) ---
  machine('valve_tick', 'Valve-Tick', 1, 10, 10, 10, {
    id: 'release_valve', name: 'Release Valve', crestCost: { spell: 1 }, target: 'not_implemented',
    description: 'Move an ally 1 tile in any direction.', mechanic: 'not_implemented',
  }),
  machine('hissing_nozzle_whelp', 'Hissing Nozzle-Whelp', 1, 20, 10, 0, {
    id: 'air_burst', name: 'Air Burst', crestCost: { spell: 1 }, target: 'adjacent-enemy',
    description: 'Push an adjacent enemy 1 tile backward.', mechanic: 'push', params: { tiles: 1 },
  }),
  machine('aero_stream_skimmer', 'Aero-Stream Skimmer', 2, 20, 20, 10, {
    id: 'hover_dash', name: 'Hover Dash', crestCost: { movement: 1 }, target: 'not_implemented',
    description: "Move through enemy units during this turn's movement phase.", mechanic: 'not_implemented',
  }),
  machine('sky_pressure_drone', 'S.K.Y. Pressure-Drone', 2, 30, 10, 20, {
    id: 'wind_wall', name: 'Wind Wall', crestCost: { defense: 1 }, target: 'not_implemented',
    description: "Negate all ranged attacks passing through this drone's adjacent tiles.", mechanic: 'not_implemented',
  }),
  machine('piston_puncher', 'Piston-Puncher', 3, 30, 30, 10, {
    id: 'jackhammer', name: 'Jackhammer', crestCost: { attack: 2 }, target: 'not_implemented',
    description: 'Deal double damage against monsters with 20 or more DEF.', mechanic: 'not_implemented',
  }),
  machine('blow_gun_sniper', 'Blow-Gun Sniper', 3, 30, 20, 20, {
    id: 'precision_blast', name: 'Precision Blast', crestCost: { spell: 2 }, target: 'line',
    description: 'Target an enemy in a straight line up to 4 tiles away. Push them to the end of the line and deal 20 damage.',
    mechanic: 'damage_line', params: { amount: 20, length: 4 },
  }),
  machine('cyclone_compressor', 'Cyclone-Compressor', 3, 40, 10, 30, {
    id: 'vacuum_pull', name: 'Vacuum Pull', crestCost: { spell: 2 }, target: 'self',
    description: 'Pull all enemies in a straight line 3 tiles toward this monster.', mechanic: 'pull_radius', params: { radius: 3, tiles: 3 },
  }),
  machine('barometric_crawler', 'Barometric Crawler', 4, 50, 30, 20, {
    id: 'pressure_drop', name: 'Pressure Drop', crestCost: { spell: 3 }, target: 'self',
    description: 'Reduce the ATK of all enemies within a 3-tile radius by 10.', mechanic: 'debuff_atk_radius',
    params: { amount: 10, radius: 3, duration: 1 },
  }),
  machine('sky_aero_eliminator', 'S.K.Y. Aero-Eliminator', 4, 40, 50, 10, {
    id: 'tornado_cannon', name: 'Tornado Cannon', crestCost: { attack: 3 }, target: 'not_implemented',
    description: 'Attack an enemy up to 3 tiles away; ignore 20 points of their DEF.', mechanic: 'not_implemented',
  }),
  machine('atmos_breaker_colossus', 'Atmos-Breaker Colossus', 4, 60, 40, 20, {
    id: 'rupture', name: 'Rupture', crestCost: { spell: 3 }, target: 'self',
    description: 'Destroy all barriers and clear all hazard tiles on the entire board.', mechanic: 'destroy_all_barriers',
  }),

  // --- Faction 3: Assembly Swarm (Multiplication & Synergy) ---
  machine('cog_swarm_drone', 'Cog-Swarm Drone', 1, 10, 10, 10, {
    id: 'replicate', name: 'Replicate', crestCost: { spell: 1 }, target: 'adjacent-empty',
    description: 'Summon a 10 HP / 10 ATK Cog Clone on an adjacent empty tile.', mechanic: 'summon_clone',
    params: { hp: 10, atk: 10, def: 0 },
  }),
  machine('wrench_bot', 'Wrench-Bot', 1, 20, 10, 0, {
    id: 'tighten', name: 'Tighten', crestCost: { defense: 1 }, target: 'ally-adjacent',
    description: 'Target ally gains +10 DEF this turn.', mechanic: 'temp_def_buff', params: { amount: 10, duration: 1 },
  }),
  machine('conveyor_crawler', 'Conveyor Crawler', 2, 20, 10, 20, {
    id: 'supply_line', name: 'Supply Line', crestCost: { movement: 1 }, target: 'not_implemented',
    description: 'Move an adjacent ally up to 3 tiles for free.', mechanic: 'not_implemented',
  }),
  machine('rivet_gunner', 'Rivet-Gunner', 2, 30, 20, 10, {
    id: 'nail_down', name: 'Nail Down', crestCost: { attack: 1 }, target: 'passive',
    description: 'Target enemy loses 1 MOV crest from their pool when hit by this attack.', mechanic: 'on_hit_crest_drain',
    params: { amount: 1, crestType: 'movement' },
  }),
  machine('assembly_line_foreman', 'Assembly-Line Foreman', 3, 30, 20, 20, {
    id: 'mass_produce', name: 'Mass Produce', crestCost: { spell: 2 }, target: 'self',
    description: 'All Level 1 and 2 allies gain +10 ATK this turn.', mechanic: 'buff_atk_allies_by_level',
    params: { amount: 10, maxLevel: 2, duration: 1 },
  }),
  machine('modular_arm_sentinel', 'Modular-Arm Sentinel', 3, 40, 20, 20, {
    id: 'reassemble', name: 'Reassemble', crestCost: { spell: 2 }, target: 'not_implemented',
    description: 'Swap HP values with an adjacent allied monster.', mechanic: 'not_implemented',
  }),
  machine('scaffolding_brute', 'Scaffolding Brute', 3, 30, 30, 10, {
    id: 'tower_strike', name: 'Tower Strike', crestCost: { attack: 2 }, target: 'not_implemented',
    description: 'Deal 10 damage to all enemies in a 2-tile wide line.', mechanic: 'not_implemented',
  }),
  machine('factory_core_overmind', 'Factory-Core Overmind', 4, 50, 20, 40, {
    id: 'network_override', name: 'Network Override', crestCost: { spell: 3 }, target: 'not_implemented',
    description: 'Take control of an adjacent enemy monster level 2 or lower for 1 turn.', mechanic: 'not_implemented',
  }),
  machine('scrap_metal_amalgam', 'Scrap-Metal Amalgam', 4, 60, 40, 10, {
    id: 'absorb_parts', name: 'Absorb Parts', crestCost: { spell: 3 }, target: 'not_implemented',
    description: "Destroy an adjacent ally; this monster gains ATK and HP equal to the destroyed ally's stats.",
    mechanic: 'not_implemented',
  }),
  machine('the_grand_constructor', 'The Grand Constructor', 4, 50, 30, 30, {
    id: 'blueprint', name: 'Blueprint', crestCost: { spell: 3 }, target: 'not_implemented',
    description: 'Revive a destroyed Level 1 or 2 monster and place it on an adjacent tile.', mechanic: 'not_implemented',
  }),

  // --- Faction 4: The Voltage Grid (Energy & Stun) ---
  machine('spark_plug_sprite', 'Spark-Plug Sprite', 1, 10, 10, 10, {
    id: 'jolt', name: 'Jolt', crestCost: { spell: 1 }, target: 'passive',
    description: "Target enemy loses 1 ATK crest from their pool.", mechanic: 'crest_steal',
    params: { amount: 1, crestType: 'attack', destroyOnly: true },
  }),
  machine('copper_coil_snake', 'Copper-Coil Snake', 1, 20, 10, 0, {
    id: 'conduct', name: 'Conduct', crestCost: { defense: 1 }, target: 'passive',
    description: 'If attacked with Magic, reflect 10 damage to the attacker.', mechanic: 'reflect_damage', params: { amount: 10 },
  }),
  machine('transformer_hound', 'Transformer Hound', 2, 20, 20, 10, {
    id: 'step_up', name: 'Step-Up', crestCost: { spell: 1 }, target: 'self',
    description: 'Gain 1 MAG crest into your pool.', mechanic: 'crest_gain', params: { amount: 1, crestType: 'spell' },
  }),
  machine('plasma_arc_glider', 'Plasma-Arc Glider', 2, 30, 10, 20, {
    id: 'short_circuit', name: 'Short Circuit', crestCost: { attack: 1 }, target: 'adjacent-enemy',
    description: 'Target enemy hit by this attack cannot use Magic effects next turn.', mechanic: 'silence',
    params: { duration: 1 },
  }),
  machine('volt_weaver_spider', 'Volt-Weaver Spider', 3, 30, 20, 30, {
    id: 'electrified_web', name: 'Electrified Web', crestCost: { spell: 2 }, target: 'adjacent-empty',
    description: 'Place a Stun Tile. Enemies stepping on it stop moving immediately and lose their attack phase.',
    mechanic: 'hazard_create', params: { amount: 0, immobilize: true },
  }),
  machine('emp_generator', 'EMP Generator', 3, 40, 10, 20, {
    id: 'blackout', name: 'Blackout', crestCost: { spell: 2 }, target: 'self',
    description: "Destroy 2 crests of any type from the opponent's pool.", mechanic: 'crest_destroy',
    params: { amount: 2, crestType: 'any' },
  }),
  machine('lightning_rod_knight', 'Lightning-Rod Knight', 3, 30, 30, 10, {
    id: 'grounding_strike', name: 'Grounding Strike', crestCost: { attack: 2 }, target: 'not_implemented',
    description: 'Deal 20 damage. If the target is a Machine or Flying type, deal 40 damage instead.', mechanic: 'not_implemented',
  }),
  machine('grid_surge_dragon', 'Grid-Surge Dragon', 4, 50, 40, 20, {
    id: 'chain_lightning_grid', name: 'Chain Lightning', crestCost: { spell: 3 }, target: 'not_implemented',
    description: 'Deal 15 damage to 3 different enemy units.', mechanic: 'not_implemented',
  }),
  machine('dynamo_behemoth', 'Dynamo Behemoth', 4, 60, 30, 30, {
    id: 'kinetic_battery', name: 'Kinetic Battery', crestCost: { defense: 3 }, target: 'not_implemented',
    description: "Store all damage taken this turn. Next turn, add the stored damage to this monster's ATK.",
    mechanic: 'not_implemented',
  }),
  machine('high_voltage_sovereign', 'High-Voltage Sovereign', 4, 40, 50, 20, {
    id: 'ion_cannon', name: 'Ion Cannon', crestCost: { spell: 4 }, target: 'not_implemented',
    description: 'Pay 4 MAG. Deal 40 damage to a target and 20 damage to all enemies adjacent to the target.',
    mechanic: 'not_implemented',
  }),

  // --- Faction 5: Heavy Ordnance (Siege & Artillery) ---
  machine('shrapnel_mine', 'Shrapnel Mine', 1, 10, 10, 10, {
    id: 'detonate_mine', name: 'Detonate', crestCost: { spell: 1 }, target: 'self',
    description: 'Destroy this unit to deal 10 damage to all adjacent units.', mechanic: 'self_destruct_adjacent',
    params: { amount: 10, includeAllies: true },
  }),
  machine('mortar_shell_bug', 'Mortar-Shell Bug', 1, 20, 10, 0, {
    id: 'lob', name: 'Lob', crestCost: { spell: 1 }, target: 'not_implemented',
    description: 'Deal 10 damage to a target exactly 3 tiles away, ignoring obstacles in between.', mechanic: 'not_implemented',
  }),
  machine('tread_scout', 'Tread-Scout', 2, 20, 10, 20, {
    id: 'entrench', name: 'Entrench', crestCost: { defense: 1 }, target: 'self',
    description: 'Target cannot be pushed or pulled this turn. Gain +10 DEF.', mechanic: 'temp_def_buff',
    params: { amount: 10, duration: 1 },
  }),
  machine('flak_cannon_spider', 'Flak-Cannon Spider', 2, 30, 20, 10, {
    id: 'anti_air', name: 'Anti-Air', crestCost: { attack: 1 }, target: 'not_implemented',
    description: 'If an enemy uses a movement effect (Hover/Fly/Jump) within 3 tiles, deal 10 free damage to it.',
    mechanic: 'not_implemented',
  }),
  machine('artillery_centaur', 'Artillery Centaur', 3, 30, 30, 20, {
    id: 'bombard', name: 'Bombard', crestCost: { spell: 2 }, target: 'line',
    description: 'Deal 20 damage to any enemy in a straight line, regardless of distance.', mechanic: 'damage_line',
    params: { amount: 20 },
  }),
  machine('bunker_buster_mech', 'Bunker-Buster Mech', 3, 40, 20, 20, {
    id: 'armor_piercing', name: 'Armor Piercing', crestCost: { attack: 2 }, target: 'self',
    description: 'Destroy any barrier, obstacle, or shield on the board instantly.', mechanic: 'destroy_all_barriers',
  }),
  machine('siege_tower_golem', 'Siege-Tower Golem', 3, 30, 20, 30, {
    id: 'deploy_barricade', name: 'Deploy Barricade', crestCost: { defense: 2 }, target: 'adjacent-empty',
    description: 'Create two 20 HP Barricade Tiles on adjacent empty squares.', mechanic: 'barrier_create',
    params: { hp: 20, duration: 99 },
  }),
  machine('dreadnought_walker', 'Dreadnought Walker', 4, 50, 40, 30, {
    id: 'broadside', name: 'Broadside', crestCost: { spell: 3 }, target: 'not_implemented',
    description: 'Deal 30 damage to a 2x2 grid area anywhere on the board.', mechanic: 'not_implemented',
  }),
  machine('orbital_strike_satellite', 'Orbital-Strike Satellite', 4, 40, 50, 10, {
    id: 'target_painter', name: 'Target Painter', crestCost: { spell: 3 }, target: 'not_implemented',
    description: 'Target one enemy. Next turn, that enemy takes 40 unavoidable damage.', mechanic: 'not_implemented',
  }),
  machine('annihilation_engine', 'Annihilation Engine', 4, 60, 50, 30, {
    id: 'doomsday_volley', name: 'Doomsday Volley', crestCost: { spell: 4 }, target: 'not_implemented',
    description: 'Pay 4 MAG. Deal 40 damage to all enemies in a 3-tile wide line spanning the entire length of the board.',
    mechanic: 'not_implemented',
  }),
]
