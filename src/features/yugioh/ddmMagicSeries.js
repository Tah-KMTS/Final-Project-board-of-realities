// Magic/Spellcaster Series (50 monsters, 5 factions of 10). See
// ddmDragonSeries.js for the mechanic-tag convention.

const caster = (id, name, level, hp, atk, def, ability) => ({
  id, name, level, hp, atk, def, creatureType: 'Spellcaster', ability,
})

export const MAGIC_SERIES = [
  // --- Faction 1: The Astral Court (Cosmic & Arcane) ---
  caster('apprentice_stargazer', 'Apprentice Stargazer', 1, 10, 10, 0, {
    id: 'mana_spark', name: 'Mana Spark', crestCost: { spell: 1 }, target: 'line',
    description: 'Deal 10 damage to an enemy exactly 2 tiles away.', mechanic: 'damage_line', params: { amount: 10 },
  }),
  caster('rune_scribe', 'Rune Scribe', 1, 20, 10, 10, {
    id: 'transmute', name: 'Transmute', crestCost: { defense: 1 }, target: 'self',
    description: 'Convert 1 DEF crest into 1 MAG crest.', mechanic: 'crest_convert',
    params: { from: 'defense', to: 'spell', amount: 1 },
  }),
  caster('comet_channeller', 'Comet Channeller', 2, 20, 20, 10, {
    id: 'shooting_star', name: 'Shooting Star', crestCost: { spell: 1 }, target: 'self',
    description: 'Deal 10 damage to 2 different targets within a 3-tile radius.', mechanic: 'damage_radius',
    params: { amount: 10, radius: 3, maxTargets: 2 },
  }),
  caster('arcane_barrier_mage', 'Arcane Barrier-Mage', 2, 30, 10, 20, {
    id: 'forcefield', name: 'Forcefield', crestCost: { spell: 1 }, target: 'ally-adjacent',
    description: 'Target ally takes 0 damage from the next attack.', mechanic: 'shield_next_hit',
  }),
  caster('meteor_evoker', 'Meteor Evoker', 3, 30, 30, 10, {
    id: 'crater', name: 'Crater', crestCost: { spell: 2 }, target: 'not_implemented',
    description: 'Destroy an empty tile on the board, making it impassable for the rest of the game.', mechanic: 'not_implemented',
  }),
  caster('nebula_illusionist', 'Nebula Illusionist', 3, 20, 20, 30, {
    id: 'mirage', name: 'Mirage', crestCost: { spell: 2 }, target: 'not_implemented',
    description: 'Swap the position of two allied monsters on the board.', mechanic: 'not_implemented',
  }),
  caster('gravity_weaver', 'Gravity Weaver', 3, 40, 10, 20, {
    id: 'singularity', name: 'Singularity', crestCost: { spell: 2 }, target: 'adjacent-enemy',
    description: 'Pull target enemy up to 2 tiles closer to this monster.', mechanic: 'pull_target', params: { tiles: 2 },
  }),
  caster('grand_cosmos_magus', 'Grand Cosmos Magus', 4, 50, 40, 20, {
    id: 'astral_alignment', name: 'Astral Alignment', crestCost: { spell: 3 }, target: 'self',
    description: 'Roll a 6-sided die. Gain MAG crests equal to half the result (rounded up).', mechanic: 'crest_gain_random_d6half',
    params: { crestType: 'spell' },
  }),
  caster('high_arbiter_of_stars', 'High-Arbiter of Stars', 4, 40, 50, 20, {
    id: 'supernova', name: 'Supernova', crestCost: { spell: 3 }, target: 'not_implemented',
    description: 'Deal 30 damage to a target and 10 damage to all units adjacent to it.', mechanic: 'not_implemented',
  }),
  caster('eclipse_master', 'Eclipse Master', 4, 60, 30, 40, {
    id: 'void_collapse', name: 'Void Collapse', crestCost: { spell: 4 }, target: 'not_implemented',
    description: 'Pay 4 MAG. Remove target Level 3 or lower monster from the board completely.', mechanic: 'not_implemented',
  }),

  // --- Faction 2: The S.K.Y. Diviners (Cyber-Magic & Data) ---
  caster('data_sprite', 'Data Sprite', 1, 10, 10, 10, {
    id: 'ping', name: 'Ping', crestCost: { spell: 1 }, target: 'not_implemented',
    description: "Reveal the opponent's next dice roll before they use it.", mechanic: 'not_implemented',
  }),
  caster('ui_channeller', 'UI-Channeller', 1, 20, 10, 0, {
    id: 'login_screen', name: 'Login Screen', crestCost: { defense: 1 }, target: 'adjacent-empty',
    description: 'Create a temporary 1-tile barrier.', mechanic: 'barrier_create', params: { hp: 10, duration: 2 },
  }),
  caster('grid_hacker', 'Grid-Hacker', 2, 20, 20, 10, {
    id: 'bypass', name: 'Bypass', crestCost: { spell: 1 }, target: 'not_implemented',
    description: 'Move through one enemy-occupied tile this turn.', mechanic: 'not_implemented',
  }),
  caster('sky_analyst_mage', 'S.K.Y. Analyst Mage', 2, 30, 10, 20, {
    id: 'stat_buff', name: 'Stat Buff', crestCost: { spell: 1 }, target: 'ally-adjacent',
    description: 'Grant an adjacent ally +10 ATK and +10 DEF this turn.', mechanic: 'buff_atk_def_target',
    params: { atk: 10, def: 10, duration: 1 },
  }),
  caster('hologram_summoner', 'Hologram Summoner', 3, 30, 20, 20, {
    id: 'project_clone', name: 'Project Clone', crestCost: { spell: 2 }, target: 'adjacent-empty',
    description: 'Create a 10 HP decoy that draws all adjacent enemy attacks.', mechanic: 'summon_clone',
    params: { hp: 10, atk: 0, def: 0 },
  }),
  caster('firewall_mystic', 'Firewall Mystic', 3, 40, 10, 30, {
    id: 'access_denied', name: 'Access Denied', crestCost: { defense: 2 }, target: 'not_implemented',
    description: 'Enemies cannot enter the 3 tiles directly in front of this monster.', mechanic: 'not_implemented',
  }),
  caster('cyber_shaman', 'Cyber-Shaman', 3, 30, 30, 10, {
    id: 'overclock', name: 'Overclock', crestCost: { attack: 2 }, target: 'not_implemented',
    description: 'Target ally can attack twice this turn but loses 10 HP.', mechanic: 'not_implemented',
  }),
  caster('the_sky_architect', 'The S.K.Y. Architect', 4, 50, 30, 30, {
    id: 'reformat_grid', name: 'Reformat Grid', crestCost: { spell: 3 }, target: 'not_implemented',
    description: 'Rearrange up to 3 empty tiles on the board.', mechanic: 'not_implemented',
  }),
  caster('quantum_diviner', 'Quantum Diviner', 4, 40, 40, 20, {
    id: 'data_wipe', name: 'Data Wipe', crestCost: { spell: 3 }, target: 'adjacent-enemy',
    description: 'Target enemy loses all its current buffs and active effects.', mechanic: 'cleanse_buffs',
  }),
  caster('mainframe_overlord', 'Mainframe Overlord', 4, 60, 40, 30, {
    id: 'system_crash', name: 'System Crash', crestCost: { spell: 4 }, target: 'self',
    description: "Pay 4 MAG. Opponent loses all crests in their crest pool.", mechanic: 'crest_destroy',
    params: { amount: 99, crestType: 'any' },
  }),

  // --- Faction 3: The Inner Vanguard (Street-Magic & Brawlers) ---
  caster('graffiti_sparks', 'Graffiti Sparks', 1, 10, 20, 0, {
    id: 'tag', name: 'Tag', crestCost: { attack: 1 }, target: 'adjacent-enemy',
    description: 'Mark an enemy; allies deal +10 damage to marked enemies.', mechanic: 'mark_target',
    params: { bonusDamage: 10 },
  }),
  caster('street_ward_monk', 'Street-Ward Monk', 1, 20, 10, 10, {
    id: 'block', name: 'Block', crestCost: { defense: 1 }, target: 'self',
    description: 'Reduce incoming physical attack damage by 10.', mechanic: 'temp_def_buff',
    params: { amount: 10, duration: 1 },
  }),
  caster('neon_fist_striker', 'Neon-Fist Striker', 2, 20, 30, 0, {
    id: 'flash_punch', name: 'Flash Punch', crestCost: { attack: 1 }, target: 'adjacent-enemy',
    description: 'Deal 20 damage. If target is defeated, gain 1 MOV crest.', mechanic: 'damage_target_kill_bonus',
    params: { amount: 20, bonusCrest: 'movement' },
  }),
  caster('asphalt_alchemist', 'Asphalt Alchemist', 2, 30, 20, 10, {
    id: 'concrete_spikes', name: 'Concrete Spikes', crestCost: { spell: 1 }, target: 'adjacent-empty',
    description: 'Turn an adjacent empty tile into a hazard that deals 10 damage to enemies.', mechanic: 'hazard_create',
    params: { amount: 10 },
  }),
  caster('inner_kinetic', 'Inner Kinetic', 3, 40, 30, 10, {
    id: 'focus_state', name: 'Focus State', crestCost: { spell: 2 }, target: 'self',
    description: 'Gain +20 ATK for the rest of the turn, but cannot move next turn.', mechanic: 'temp_atk_buff',
    params: { amount: 20, duration: 1, moveLocked: true },
  }),
  caster('ley_line_runner', 'Ley-Line Runner', 3, 30, 20, 20, {
    id: 'parkour', name: 'Parkour', crestCost: { movement: 1 }, target: 'not_implemented',
    description: 'Move up to 4 tiles in a straight line, ignoring obstacles.', mechanic: 'not_implemented',
  }),
  caster('ward_breaker_brawler', 'Ward-Breaker Brawler', 3, 30, 40, 0, {
    id: 'shatter', name: 'Shatter', crestCost: { attack: 2 }, target: 'self',
    description: 'Instantly destroy any barrier or shield effect on the target before dealing damage.',
    mechanic: 'destroy_barrier',
  }),
  caster('the_inner_champion', 'The Inner Champion', 4, 50, 50, 10, {
    id: 'limit_break', name: 'Limit Break', crestCost: { spell: 3 }, target: 'self',
    description: 'Pay 3 MAG. Perform a melee attack against all adjacent enemies simultaneously.', mechanic: 'damage_radius',
    params: { amount: 50, radius: 1, useAtk: true },
  }),
  caster('urban_sorcerer_king', 'Urban Sorcerer-King', 4, 60, 40, 20, {
    id: 'turf_war', name: 'Turf War', crestCost: { spell: 3 }, target: 'not_implemented',
    description: 'All allied Inner Vanguard monsters gain +10 HP and +10 ATK.', mechanic: 'not_implemented',
  }),
  caster('aether_flow_master', 'Aether-Flow Master', 4, 50, 40, 30, {
    id: 'counter_current', name: 'Counter-Current', crestCost: { defense: 3 }, target: 'passive',
    description: 'If attacked in melee, negate the damage and deal the exact same amount back to the attacker.',
    mechanic: 'reflect_full_damage',
  }),

  // --- Faction 4: The Nano-Oracles (AI & Algorithmic Magic) ---
  caster('bit_wisp', 'Bit-Wisp', 1, 10, 10, 10, {
    id: 'scan', name: 'Scan', crestCost: { spell: 1 }, target: 'not_implemented',
    description: 'Look at one facedown enemy dice or hidden effect.', mechanic: 'not_implemented',
  }),
  caster('query_bot', 'Query Bot', 1, 20, 10, 0, {
    id: 'prompt', name: 'Prompt', crestCost: { spell: 1 }, target: 'not_implemented',
    description: 'Force the opponent to declare which monster they will move next turn.', mechanic: 'not_implemented',
  }),
  caster('logic_gatekeeper', 'Logic Gatekeeper', 2, 20, 10, 20, {
    id: 'if_then_shield', name: 'If/Then Shield', crestCost: { defense: 1 }, target: 'passive',
    description: 'If target ally is attacked, roll a die. Evens: 0 damage. Odds: normal damage.', mechanic: 'coinflip_negate',
  }),
  caster('cache_striker', 'Cache Striker', 2, 30, 20, 10, {
    id: 'memory_dump', name: 'Memory Dump', crestCost: { attack: 1 }, target: 'adjacent-enemy',
    description: 'Deal 10 damage. Return the spent ATK crest to your pool if the attack destroys the target.',
    mechanic: 'damage_target_refund_on_kill', params: { amount: 10, crestType: 'attack' },
  }),
  caster('algorithm_weaver', 'Algorithm Weaver', 3, 30, 20, 20, {
    id: 'recalculate', name: 'Recalculate', crestCost: { spell: 2 }, target: 'self',
    description: 'Change the type of one crest in your pool to any other type (e.g., ATK to MAG).', mechanic: 'crest_convert',
    params: { from: 'choice', to: 'choice', amount: 1 },
  }),
  caster('parameter_enforcer', 'Parameter Enforcer', 3, 40, 30, 10, {
    id: 'syntax_error', name: 'Syntax Error', crestCost: { spell: 2 }, target: 'adjacent-enemy',
    description: 'Silence an enemy monster. It cannot use MAG effects for 2 turns.', mechanic: 'silence',
    params: { duration: 2 },
  }),
  caster('heuristic_oracle', 'Heuristic Oracle', 3, 30, 10, 30, {
    id: 'predictive_model', name: 'Predictive Model', crestCost: { defense: 2 }, target: 'ally-adjacent',
    description: 'Target ally perfectly dodges the next ranged attack.', mechanic: 'shield_next_hit',
  }),
  caster('nano_b_neural_model', 'Nano-B Neural Model', 4, 50, 40, 20, {
    id: 'deep_learning', name: 'Deep Learning', crestCost: { spell: 3 }, target: 'not_implemented',
    description: 'Mimic any MAG effect used by any monster on the board in the previous turn.', mechanic: 'not_implemented',
  }),
  caster('agi_supreme_sovereign', 'AGI-Supreme Sovereign', 4, 60, 30, 40, {
    id: 'rewrite_code', name: 'Rewrite Code', crestCost: { spell: 4 }, target: 'not_implemented',
    description: 'Pay 4 MAG. Change the outcome of any die rolled this turn to a face of your choice.', mechanic: 'not_implemented',
  }),
  caster('reality_renderer', 'Reality Renderer', 4, 40, 50, 20, {
    id: 'format_drive', name: 'Format Drive', crestCost: { attack: 3 }, target: 'adjacent-enemy',
    description: 'Deal 40 damage. This attack cannot be countered, blocked, or reduced by any effect.',
    mechanic: 'damage_target', params: { amount: 40, unblockable: true },
  }),

  // --- Faction 5: The Nether-Weavers (Necromancy & Void) ---
  caster('skull_familiar', 'Skull Familiar', 1, 10, 10, 10, {
    id: 'haunt', name: 'Haunt', crestCost: { spell: 1 }, target: 'adjacent-enemy',
    description: 'Attach to an enemy. That enemy takes 5 damage at the start of every turn.', mechanic: 'poison',
    params: { amountPerTurn: 5, duration: 99 },
  }),
  caster('blood_chalice_acolyte', 'Blood-Chalice Acolyte', 1, 20, 10, 0, {
    id: 'siphon', name: 'Siphon', crestCost: { spell: 1 }, target: 'not_implemented',
    description: 'Deal 10 damage to an enemy and heal 10 HP to an ally.', mechanic: 'not_implemented',
  }),
  caster('tomb_stalker', 'Tomb-Stalker', 2, 20, 20, 10, {
    id: 'grave_strike', name: 'Grave Strike', crestCost: { attack: 1 }, target: 'not_implemented',
    description: 'Gain +10 ATK for every destroyed monster in your graveyard.', mechanic: 'not_implemented',
  }),
  caster('bone_mender', 'Bone-Mender', 2, 30, 10, 20, {
    id: 'marrow_knit', name: 'Marrow Knit', crestCost: { defense: 1 }, target: 'ally-adjacent',
    description: 'Restore 20 HP to a target, but it loses 10 MAX HP permanently.', mechanic: 'heal_target_maxhp_cost',
    params: { amount: 20, maxHpCost: 10 },
  }),
  caster('spirit_harvester', 'Spirit Harvester', 3, 30, 30, 10, {
    id: 'soul_tear', name: 'Soul Tear', crestCost: { spell: 2 }, target: 'not_implemented',
    description: 'Destroy an enemy Level 1 or 2 monster. Gain MAG crests equal to its Level.', mechanic: 'not_implemented',
  }),
  caster('void_channeler', 'Void Channeler', 3, 40, 20, 20, {
    id: 'abyssal_grasp', name: 'Abyssal Grasp', crestCost: { spell: 2 }, target: 'adjacent-enemy',
    description: 'Immobilize an enemy for 2 turns.', mechanic: 'freeze_target', params: { duration: 2 },
  }),
  caster('wraith_lord', 'Wraith-Lord', 3, 30, 20, 30, {
    id: 'ethereal_form', name: 'Ethereal Form', crestCost: { defense: 2 }, target: 'self',
    description: 'Become completely immune to physical (ATK) damage for 1 turn.', mechanic: 'immune_physical',
    params: { duration: 1 },
  }),
  caster('lich_king_of_the_abyss', 'Lich-King of the Abyss', 4, 50, 40, 30, {
    id: 'resurrection', name: 'Resurrection', crestCost: { spell: 3 }, target: 'not_implemented',
    description: 'Summon a destroyed Level 1, 2, or 3 monster from your graveyard to an adjacent empty tile.',
    mechanic: 'not_implemented',
  }),
  caster('blood_magic_archfiend', 'Blood-Magic Archfiend', 4, 60, 50, 10, {
    id: 'crimson_pact', name: 'Crimson Pact', crestCost: { spell: 3 }, target: 'not_implemented',
    description: 'Pay half your current HP. Deal damage equal to the HP paid to any target.', mechanic: 'not_implemented',
  }),
  caster('the_end_bringer', 'The End-Bringer', 4, 50, 50, 20, {
    id: 'oblivion', name: 'Oblivion', crestCost: { spell: 4 }, target: 'not_implemented',
    description: 'Pay 4 MAG. Destroy all Level 1, 2, and 3 monsters on the board (both allied and enemy).',
    mechanic: 'not_implemented',
  }),
]
