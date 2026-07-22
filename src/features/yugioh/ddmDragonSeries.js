// Dragon Series (50 monsters, 5 factions of 10). Each ability carries a
// `mechanic` tag + params consumed by ddmEffectResolver.js. Abilities whose
// mechanic doesn't fit this board's turn/targeting model (graveyard,
// multi-turn banking, full board-wide multi-target selection, etc.) are
// tagged 'not_implemented' - they still summon and show their real
// name/description, they just don't have a working action button yet.

const dragon = (id, name, level, hp, atk, def, ability) => ({
  id, name, level, hp, atk, def, creatureType: 'Dragon', ability,
})

export const DRAGON_SERIES = [
  // --- Faction 1: Volcanic & Earth Wyrms ---
  dragon('ember_hatchling', 'Ember Hatchling', 1, 10, 10, 0, {
    id: 'ignite', name: 'Ignite', crestCost: { spell: 1 }, target: 'adjacent-any',
    description: 'Deal 10 damage to an adjacent tile. Destroy this monster after use.',
    mechanic: 'self_destruct_target', params: { amount: 10 },
  }),
  dragon('obsidian_skitterer', 'Obsidian Skitterer', 1, 20, 10, 10, {
    id: 'hard_shell', name: 'Hard Shell', crestCost: { defense: 1 }, target: 'self',
    description: 'Gain +10 DEF against the next attack this turn.',
    mechanic: 'temp_def_buff', params: { amount: 10, duration: 1 },
  }),
  dragon('magma_burrower', 'Magma Burrower', 2, 20, 20, 10, {
    id: 'lava_surge', name: 'Lava Surge', crestCost: { spell: 1 }, target: 'not_implemented',
    description: 'Move through 1 obstacle tile or enemy-occupied tile without triggering combat.',
    mechanic: 'not_implemented',
  }),
  dragon('cinder_vanguard', 'Cinder Vanguard', 2, 30, 10, 20, {
    id: 'heat_shield', name: 'Heat Shield', crestCost: { defense: 1 }, target: 'not_implemented',
    description: "Redirect an adjacent ally monster's targeted attack to Cinder Vanguard.",
    mechanic: 'not_implemented',
  }),
  dragon('basalt_breaker', 'Basalt Breaker', 3, 30, 30, 20, {
    id: 'armor_crush', name: 'Armor Crush', crestCost: { attack: 2 }, target: 'adjacent-enemy',
    description: "Reduce target enemy's DEF by 10 permanently upon hit.",
    mechanic: 'perm_def_debuff', params: { amount: 10 },
  }),
  dragon('pyre_ridge_drake', 'Pyre Ridge Drake', 3, 40, 20, 10, {
    id: 'firewall_sweep', name: 'Firewall Sweep', crestCost: { spell: 2 }, target: 'not_implemented',
    description: 'Target a row of 3 tiles in front; deal 10 fire damage to all units in range.',
    mechanic: 'not_implemented',
  }),
  dragon('tectonic_serpent', 'Tectonic Serpent', 3, 30, 20, 30, {
    id: 'quake', name: 'Quake', crestCost: { spell: 2 }, target: 'self',
    description: 'Immobilize all adjacent enemy monsters for 1 turn.',
    mechanic: 'freeze_adjacent', params: { duration: 1 },
  }),
  dragon('pyroclastic_titan', 'Pyroclastic Titan', 4, 50, 40, 20, {
    id: 'ash_plume', name: 'Ash Plume', crestCost: { spell: 3 }, target: 'not_implemented',
    description: 'Create 2 Hazard Tiles on adjacent empty spots. Units on Hazard Tiles take 10 damage at start of turn.',
    mechanic: 'not_implemented',
  }),
  dragon('volcanic_world_eater', 'Volcanic World-Eater', 4, 60, 30, 30, {
    id: 'eruption', name: 'Eruption', crestCost: { spell: 4 }, target: 'self',
    description: 'Deal 20 damage to all units within a 2-tile radius (allies and enemies).',
    mechanic: 'damage_radius', params: { amount: 20, radius: 2, includeAllies: true },
  }),
  dragon('molten_core_behemoth', 'Molten Core Behemoth', 4, 50, 50, 10, {
    id: 'magma_burst', name: 'Magma Burst', crestCost: { attack: 3 }, target: 'not_implemented',
    description: 'Pay 3 ATK crests to perform a second attack on the same turn.',
    mechanic: 'not_implemented',
  }),

  // --- Faction 2: Storm & Astral Drakes ---
  dragon('zephyr_sprite', 'Zephyr Sprite', 1, 10, 10, 10, {
    id: 'tailwind', name: 'Tailwind', crestCost: { spell: 1 }, target: 'ally-adjacent',
    description: 'Target ally monster gains +2 Movement tiles for this turn.',
    mechanic: 'not_implemented',
  }),
  dragon('arc_whelp', 'Arc Whelp', 1, 20, 10, 0, {
    id: 'static_shock', name: 'Static Shock', crestCost: { attack: 1 }, target: 'line',
    description: 'Deal 10 direct damage to an enemy up to 2 tiles away in a straight line.',
    mechanic: 'damage_line', params: { amount: 10 },
  }),
  dragon('gale_skystriker', 'Gale Skystriker', 2, 20, 20, 10, {
    id: 'divebomb', name: 'Divebomb', crestCost: { movement: 1 }, target: 'not_implemented',
    description: 'Move 3 tiles in a straight line and attack an enemy at the end of the movement.',
    mechanic: 'not_implemented',
  }),
  dragon('tempest_wyvern', 'Tempest Wyvern', 2, 30, 10, 10, {
    id: 'siphon_charge', name: 'Siphon Charge', crestCost: { spell: 1 }, target: 'self',
    description: "Steal 1 MAG crest from the opponent's crest pool.",
    mechanic: 'crest_steal', params: { amount: 1, crestType: 'spell' },
  }),
  dragon('thunderhead_drake', 'Thunderhead Drake', 3, 30, 30, 10, {
    id: 'chain_lightning', name: 'Chain Lightning', crestCost: { spell: 2 }, target: 'not_implemented',
    description: 'Deal 20 damage to a primary target and 10 damage to one adjacent target behind it.',
    mechanic: 'not_implemented',
  }),
  dragon('static_sentinel', 'Static Sentinel', 3, 40, 10, 30, {
    id: 'overcharge', name: 'Overcharge', crestCost: { defense: 2 }, target: 'passive',
    description: 'Reflect 10 damage back to attacker when attacked with a melee strike.',
    mechanic: 'reflect_damage', params: { amount: 10 },
  }),
  dragon('astral_stargazer', 'Astral Stargazer', 3, 30, 20, 20, {
    id: 'starfall', name: 'Starfall', crestCost: { spell: 2 }, target: 'ally-any',
    description: 'Swap positions with any allied dragon monster on the field.',
    mechanic: 'position_swap_ally',
  }),
  dragon('vortex_leviathan', 'Vortex Leviathan', 4, 50, 30, 20, {
    id: 'maelstrom', name: 'Maelstrom', crestCost: { spell: 3 }, target: 'self',
    description: 'Pull all enemies within 3 tiles 1 space closer to Vortex Leviathan.',
    mechanic: 'pull_radius', params: { radius: 3, tiles: 1 },
  }),
  dragon('supernova_dragon', 'Supernova Dragon', 4, 40, 50, 10, {
    id: 'cosmic_blast', name: 'Cosmic Blast', crestCost: { attack: 3 }, target: 'self',
    description: 'Ignore enemy DEF completely during combat this turn.',
    mechanic: 'ignore_def_self', params: { duration: 1 },
  }),
  dragon('sky_rupture_sovereign', 'Sky-Rupture Sovereign', 4, 50, 40, 20, {
    id: 'tempest_ray', name: 'Tempest Ray', crestCost: { spell: 3 }, target: 'line',
    description: 'Fire a beam in a straight line (4 tiles length); deal 30 damage to all units caught in line.',
    mechanic: 'damage_line', params: { amount: 30, length: 4 },
  }),

  // --- Faction 3: Venom & Shadow Serpents ---
  dragon('noxious_viperling', 'Noxious Viperling', 1, 10, 10, 10, {
    id: 'venom_spit', name: 'Venom Spit', crestCost: { spell: 1 }, target: 'adjacent-enemy',
    description: 'Inflict Poison on an adjacent enemy (loses 10 HP at the start of their turn for 2 turns).',
    mechanic: 'poison', params: { amountPerTurn: 10, duration: 2 },
  }),
  dragon('shade_crawler', 'Shade Crawler', 1, 20, 10, 0, {
    id: 'shadow_blend', name: 'Shadow Blend', crestCost: { defense: 1 }, target: 'self',
    description: 'Become untargetable by direct attacks for 1 full turn cycle.',
    mechanic: 'untargetable', params: { duration: 1 },
  }),
  dragon('acidic_hydra_whelp', 'Acidic Hydra-Whelp', 2, 20, 20, 10, {
    id: 'acid_splash', name: 'Acid Splash', crestCost: { spell: 1 }, target: 'not_implemented',
    description: 'Destroy 1 defense-type tile (barrier/shield) on the board.',
    mechanic: 'destroy_barrier',
  }),
  dragon('mire_stalker', 'Mire Stalker', 2, 30, 10, 10, {
    id: 'blight_grip', name: 'Blight Grip', crestCost: { attack: 1 }, target: 'passive',
    description: 'Target enemy loses 1 MOV crest from their pool when damaged by this unit.',
    mechanic: 'on_hit_crest_drain', params: { amount: 1, crestType: 'movement' },
  }),
  dragon('phantom_wyrm', 'Phantom Wyrm', 3, 30, 20, 10, {
    id: 'phase_shift', name: 'Phase Shift', crestCost: { spell: 2 }, target: 'not_implemented',
    description: 'Walk through enemy units and obstacles freely during movement phase.',
    mechanic: 'not_implemented',
  }),
  dragon('corrosive_basilisk', 'Corrosive Basilisk', 3, 40, 20, 20, {
    id: 'petrify_mist', name: 'Petrify Mist', crestCost: { spell: 2 }, target: 'adjacent-enemy',
    description: "Reduce targeted enemy monster's ATK to 0 until end of turn.",
    mechanic: 'temp_atk_debuff', params: { setTo: 0, duration: 1 },
  }),
  dragon('abyss_weaver', 'Abyss Weaver', 3, 30, 30, 10, {
    id: 'web_of_night', name: 'Web of Night', crestCost: { spell: 2 }, target: 'adjacent-empty',
    description: 'Place a Shadow Net tile; enemies stepping on it stop moving instantly and lose 10 HP.',
    mechanic: 'hazard_create', params: { amount: 10, immobilize: true },
  }),
  dragon('dread_blight_serpent', 'Dread-Blight Serpent', 4, 50, 30, 20, {
    id: 'plague_vector', name: 'Plague Vector', crestCost: { spell: 3 }, target: 'not_implemented',
    description: 'All poisoned enemies on the field immediately suffer 20 poison damage.',
    mechanic: 'not_implemented',
  }),
  dragon('void_eater_hydragorgon', 'Void-Eater Hydragorgon', 4, 50, 40, 10, {
    id: 'multi_head_bite', name: 'Multi-Head Bite', crestCost: { attack: 2 }, target: 'not_implemented',
    description: 'Attack up to 3 different adjacent targets in a single turn.',
    mechanic: 'not_implemented',
  }),
  dragon('eclipse_doom_wyrm', 'Eclipse Doom-Wyrm', 4, 60, 30, 30, {
    id: 'darkness_falls', name: 'Darkness Falls', crestCost: { spell: 3 }, target: 'not_implemented',
    description: 'Disable all enemy monster Special Effects across the entire board for 1 turn.',
    mechanic: 'not_implemented',
  }),

  // --- Faction 4: Frost & Crystal Dragons ---
  dragon('rime_drake_cub', 'Rime Drake-Cub', 1, 10, 10, 10, {
    id: 'frost_touch', name: 'Frost Touch', crestCost: { spell: 1 }, target: 'not_implemented',
    description: 'Target enemy monster cannot turn or rotate orientation next turn.',
    mechanic: 'not_implemented',
  }),
  dragon('quartz_crawler', 'Quartz Crawler', 1, 20, 0, 20, {
    id: 'reflect_scale', name: 'Reflect Scale', crestCost: { defense: 1 }, target: 'passive',
    description: 'If attacked by a ranged effect, reflect 10 damage to the caster.',
    mechanic: 'reflect_damage', params: { amount: 10 },
  }),
  dragon('glacier_glider', 'Glacier Glider', 2, 20, 20, 10, {
    id: 'ice_slide', name: 'Ice Slide', crestCost: { movement: 1 }, target: 'not_implemented',
    description: 'Move 2 extra tiles if moving in a straight line over unobstructed board tiles.',
    mechanic: 'not_implemented',
  }),
  dragon('prism_wing', 'Prism Wing', 2, 30, 10, 20, {
    id: 'refraction_barrier', name: 'Refraction Barrier', crestCost: { defense: 1 }, target: 'not_implemented',
    description: 'Negate the next Magic effect targeted at Prism Wing or an adjacent ally.',
    mechanic: 'not_implemented',
  }),
  dragon('hoarfrost_crusher', 'Hoarfrost Crusher', 3, 40, 20, 20, {
    id: 'glacial_lock', name: 'Glacial Lock', crestCost: { spell: 2 }, target: 'adjacent-enemy',
    description: 'Freeze target enemy monster; frozen units cannot move or attack for 1 turn.',
    mechanic: 'freeze_target', params: { duration: 1 },
  }),
  dragon('shard_geode_wyrm', 'Shard-Geode Wyrm', 3, 30, 10, 40, {
    id: 'spike_armor', name: 'Spike Armor', crestCost: { defense: 2 }, target: 'passive',
    description: 'When attacked physically, deal 10 retaliation damage to the attacker.',
    mechanic: 'reflect_damage', params: { amount: 10 },
  }),
  dragon('diamond_bite_drake', 'Diamond-Bite Drake', 3, 30, 30, 20, {
    id: 'shatter_strike', name: 'Shatter Strike', crestCost: { attack: 2 }, target: 'not_implemented',
    description: 'Deal double damage (+30 ATK) if attacking a monster with 30 or higher DEF.',
    mechanic: 'not_implemented',
  }),
  dragon('frozen_epoch_dragon', 'Frozen Epoch Dragon', 4, 50, 30, 30, {
    id: 'absolute_zero', name: 'Absolute Zero', crestCost: { spell: 3 }, target: 'not_implemented',
    description: 'Freeze all adjacent empty tiles into Ice Hazards (units moving across slip and lose 1 MOV).',
    mechanic: 'not_implemented',
  }),
  dragon('crystal_spire_leviathan', 'Crystal-Spire Leviathan', 4, 60, 20, 40, {
    id: 'prismatic_wall', name: 'Prismatic Wall', crestCost: { defense: 3 }, target: 'adjacent-empty',
    description: 'Create a 30 HP Crystal Shield in front of this monster that absorbs all incoming frontal damage.',
    mechanic: 'barrier_create', params: { hp: 30, duration: 2 },
  }),
  dragon('absolute_zero_sovereign', 'Absolute-Zero Sovereign', 4, 50, 40, 30, {
    id: 'avalanche', name: 'Avalanche', crestCost: { spell: 3 }, target: 'not_implemented',
    description: 'Freeze all Level 1 and Level 2 enemy monsters on the field for 1 turn.',
    mechanic: 'not_implemented',
  }),

  // --- Faction 5: Celestial & Ancient Wyrms ---
  dragon('radiant_fae_drake', 'Radiant Fae-Drake', 1, 10, 10, 10, {
    id: 'blessing_light', name: 'Blessing Light', crestCost: { spell: 1 }, target: 'ally-adjacent',
    description: 'Restore 10 HP to an adjacent allied monster.',
    mechanic: 'heal_target', params: { amount: 10 },
  }),
  dragon('solar_sparkler', 'Solar Sparkler', 1, 20, 10, 0, {
    id: 'flashblind', name: 'Flashblind', crestCost: { spell: 1 }, target: 'adjacent-enemy',
    description: "Reduce an adjacent enemy monster's ATK by 10 for 1 turn.",
    mechanic: 'temp_atk_debuff', params: { amount: 10, duration: 1 },
  }),
  dragon('auroral_guardian', 'Auroral Guardian', 2, 20, 10, 20, {
    id: 'aura_shield', name: 'Aura Shield', crestCost: { defense: 1 }, target: 'self',
    description: 'Grant 10 DEF buff to all adjacent allied monsters until next turn.',
    mechanic: 'buff_def_adjacent_allies', params: { amount: 10, duration: 1 },
  }),
  dragon('dawnfang_wyvern', 'Dawnfang Wyvern', 2, 30, 20, 10, {
    id: 'sunfire_tooth', name: 'Sunfire Tooth', crestCost: { attack: 1 }, target: 'not_implemented',
    description: 'Gain +10 ATK when attacking dark/shadow type monsters.',
    mechanic: 'not_implemented',
  }),
  dragon('high_priest_drake', 'High-Priest Drake', 3, 30, 20, 20, {
    id: 'rejuvenate', name: 'Rejuvenate', crestCost: { spell: 2 }, target: 'self',
    description: 'Gain 2 extra crests of your choice into your Crest Pool immediately.',
    mechanic: 'crest_gain', params: { amount: 2, crestType: 'choice' },
  }),
  dragon('chrono_scale_wyrm', 'Chrono-Scale Wyrm', 3, 30, 30, 10, {
    id: 'time_warp', name: 'Time Warp', crestCost: { spell: 2 }, target: 'not_implemented',
    description: "Reset target ally monster's action flag, allowing it to move or attack again this turn.",
    mechanic: 'not_implemented',
  }),
  dragon('sol_emperor_dragon', 'Sol-Emperor Dragon', 4, 50, 40, 20, {
    id: 'solar_flare', name: 'Solar Flare', crestCost: { spell: 3 }, target: 'self',
    description: 'Deal 20 damage to all enemy monsters with DEF 10 or lower.',
    mechanic: 'damage_all_enemies_below_def', params: { amount: 20, defThreshold: 10 },
  }),
  dragon('genesis_aegis_wyrm', 'Genesis Aegis Wyrm', 4, 60, 10, 40, {
    id: 'divine_sanctuary', name: 'Divine Sanctuary', crestCost: { defense: 3 }, target: 'self',
    description: 'All allied monsters on the field take 10 less damage from all sources for 1 turn.',
    mechanic: 'not_implemented',
  }),
  dragon('singularity_oversoul', 'Singularity Oversoul', 4, 40, 50, 20, {
    id: 'graviton_crush', name: 'Graviton Crush', crestCost: { spell: 3 }, target: 'not_implemented',
    description: 'Swap the position of 2 enemy monsters anywhere on the board.',
    mechanic: 'not_implemented',
  }),
  dragon('eternal_celestial_dragon', 'Eternal Celestial Dragon', 4, 50, 50, 30, {
    id: 'supernova_judgement', name: 'Supernova Judgement', crestCost: { spell: 4 }, target: 'self',
    description: 'Pay 4 MAG crests. Deal 30 damage to all enemy monsters on the entire field and heal all allies by 20 HP.',
    mechanic: 'not_implemented',
  }),
]
