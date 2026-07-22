// Domino City's card database - a proper fixed Card_ID schema (unlike the
// other Yu-Gi-Oh world's procedurally-generated cardGenerator.js). Every
// card's Effect_Logic_Hook (when non-null) is resolved by
// duelEffects.js - keep hook names in sync with that file's registry.

export const CARD_DATABASE = [
  // --- Sample batch from the GDD ---
  { Card_ID: 'CARD_001', Name: 'Dark Magician', Primary_Type: 'Monster', Sub_Type: 'Normal', Attribute: 'Dark', Level: 7, Base_ATK: 2500, Base_DEF: 2100, Effect_Logic_Hook: null,
    Description: 'The ultimate wizard in terms of attack and defense.' },
  { Card_ID: 'CARD_002', Name: 'Mystical Space Typhoon', Primary_Type: 'Spell', Sub_Type: 'Quick-Play', Attribute: null, Level: null, Base_ATK: null, Base_DEF: null, Effect_Logic_Hook: 'Destroy_Single_SpellTrap',
    Description: 'Target 1 Spell/Trap Card on the field; destroy that target.' },
  { Card_ID: 'CARD_003', Name: 'Trap Hole', Primary_Type: 'Trap', Sub_Type: 'Normal', Attribute: null, Level: null, Base_ATK: null, Base_DEF: null, Effect_Logic_Hook: 'Destroy_Summoned_Monster_1000ATK_Min',
    Description: 'When your opponent Normal or Flip Summons a monster with 1000 or more ATK: Target that monster; destroy that target.' },
  { Card_ID: 'CARD_004', Name: 'Gene-Warped Warwolf', Primary_Type: 'Monster', Sub_Type: 'Normal', Attribute: 'Earth', Level: 4, Base_ATK: 2000, Base_DEF: 100, Effect_Logic_Hook: null,
    Description: 'This warwolf was given massive strength through genetic manipulation. Its gentle nature was completely wiped out, and it now lives only to unleash destruction.' },

  // --- Extra monsters (enough unique IDs to build valid 40-60 card decks at max-3-copies) ---
  { Card_ID: 'CARD_005', Name: 'Baby Dragon', Primary_Type: 'Monster', Sub_Type: 'Normal', Attribute: 'Wind', Level: 3, Base_ATK: 1200, Base_DEF: 700, Effect_Logic_Hook: null,
    Description: 'An infant dragon, only just hatched from its shell. Its future strength is unknown.' },
  { Card_ID: 'CARD_006', Name: 'Celtic Guardian', Primary_Type: 'Monster', Sub_Type: 'Normal', Attribute: 'Earth', Level: 4, Base_ATK: 1400, Base_DEF: 1200, Effect_Logic_Hook: null,
    Description: 'An elf who lives in the forest. Their bow-and-arrow skill is unparalleled.' },
  { Card_ID: 'CARD_007', Name: 'Mystical Elf', Primary_Type: 'Monster', Sub_Type: 'Normal', Attribute: 'Light', Level: 4, Base_ATK: 800, Base_DEF: 2000, Effect_Logic_Hook: null,
    Description: 'A magical elf hidden in the depths of the forest. Powerful in defense.' },
  { Card_ID: 'CARD_008', Name: 'Feral Imp', Primary_Type: 'Monster', Sub_Type: 'Normal', Attribute: 'Dark', Level: 4, Base_ATK: 1300, Base_DEF: 1400, Effect_Logic_Hook: null,
    Description: 'A wicked, sinister imp lurking in the shadows.' },
  { Card_ID: 'CARD_009', Name: 'Skull Servant', Primary_Type: 'Monster', Sub_Type: 'Normal', Attribute: 'Dark', Level: 1, Base_ATK: 300, Base_DEF: 200, Effect_Logic_Hook: null,
    Description: 'A skeleton that crawls up from the ground to attack intruders.' },
  { Card_ID: 'CARD_010', Name: 'Battle Ox', Primary_Type: 'Monster', Sub_Type: 'Normal', Attribute: 'Earth', Level: 4, Base_ATK: 1700, Base_DEF: 1000, Effect_Logic_Hook: null,
    Description: 'A monster with a savage battle axe and the head of an ox.' },
  { Card_ID: 'CARD_011', Name: 'Flame Swordsman', Primary_Type: 'Monster', Sub_Type: 'Effect', Attribute: 'Fire', Level: 5, Base_ATK: 1800, Base_DEF: 1600, Effect_Logic_Hook: 'Buff_Self_Vs_Fiend',
    Description: 'A warrior wreathed in flame. Gains 400 ATK when battling a Fiend-Type monster.' },
  { Card_ID: 'CARD_012', Name: 'Curse of Dragon', Primary_Type: 'Monster', Sub_Type: 'Normal', Attribute: 'Dark', Level: 5, Base_ATK: 2000, Base_DEF: 1500, Effect_Logic_Hook: null,
    Description: 'A cursed dragon awoken from an ancient tomb.' },
  { Card_ID: 'CARD_013', Name: 'Man-Eater Bug', Primary_Type: 'Monster', Sub_Type: 'Effect', Attribute: 'Earth', Level: 2, Base_ATK: 450, Base_DEF: 600, Effect_Logic_Hook: 'Destroy_On_Flip',
    Description: 'FLIP: Destroy 1 monster on the field.' },
  { Card_ID: 'CARD_014', Name: 'Winged Dragon, Guardian of the Fortress', Primary_Type: 'Monster', Sub_Type: 'Normal', Attribute: 'Wind', Level: 4, Base_ATK: 1400, Base_DEF: 1200, Effect_Logic_Hook: null,
    Description: 'A dragon that watches over the fortress ruins, wings spread wide.' },
  { Card_ID: 'CARD_015', Name: 'Dragon Zombie', Primary_Type: 'Monster', Sub_Type: 'Normal', Attribute: 'Dark', Level: 3, Base_ATK: 1600, Base_DEF: 0, Effect_Logic_Hook: null,
    Description: 'The withered remains of a once-great dragon, reanimated by dark magic.' },
  { Card_ID: 'CARD_016', Name: 'Kaiser Sea Horse', Primary_Type: 'Monster', Sub_Type: 'Normal', Attribute: 'Light', Level: 4, Base_ATK: 1700, Base_DEF: 1650, Effect_Logic_Hook: null,
    Description: 'A powerful sea horse warrior serving under a corporate banner.' },
  { Card_ID: 'CARD_017', Name: 'Blue-Eyes White Dragon', Primary_Type: 'Monster', Sub_Type: 'Normal', Attribute: 'Light', Level: 8, Base_ATK: 3000, Base_DEF: 2500, Effect_Logic_Hook: null,
    Description: 'This legendary dragon is a powerful engine of destruction.' },

  // --- Spells ---
  { Card_ID: 'CARD_018', Name: 'Dark Hole', Primary_Type: 'Spell', Sub_Type: 'Normal', Attribute: null, Level: null, Base_ATK: null, Base_DEF: null, Effect_Logic_Hook: 'Destroy_All_Monsters',
    Description: 'Destroy all monsters on the field.' },
  { Card_ID: 'CARD_019', Name: 'Monster Reborn', Primary_Type: 'Spell', Sub_Type: 'Normal', Attribute: null, Level: null, Base_ATK: null, Base_DEF: null, Effect_Logic_Hook: 'Revive_From_Graveyard',
    Description: 'Target 1 monster in either Graveyard; Special Summon it.' },
  { Card_ID: 'CARD_020', Name: "Swords of Revealing Light", Primary_Type: 'Spell', Sub_Type: 'Normal', Attribute: null, Level: null, Base_ATK: null, Base_DEF: null, Effect_Logic_Hook: 'Lock_Opponent_Attacks',
    Description: "Opponent's monsters cannot declare an attack for 3 of their turns." },
  { Card_ID: 'CARD_021', Name: 'Card Destruction', Primary_Type: 'Spell', Sub_Type: 'Normal', Attribute: null, Level: null, Base_ATK: null, Base_DEF: null, Effect_Logic_Hook: 'Redraw_Hand',
    Description: 'Both players discard their entire hand, then draw the same number of cards discarded.' },
  { Card_ID: 'CARD_022', Name: 'Fissure', Primary_Type: 'Spell', Sub_Type: 'Normal', Attribute: null, Level: null, Base_ATK: null, Base_DEF: null, Effect_Logic_Hook: 'Destroy_Lowest_ATK_Monster',
    Description: 'Destroy the opponent monster with the lowest ATK.' },
  { Card_ID: 'CARD_023', Name: 'Polymerization', Primary_Type: 'Spell', Sub_Type: 'Normal', Attribute: null, Level: null, Base_ATK: null, Base_DEF: null, Effect_Logic_Hook: 'Draw_1',
    Description: 'Fusion Summon 1 Fusion Monster. (Simplified: draw 1 card.)' },

  // --- Traps ---
  { Card_ID: 'CARD_024', Name: 'Magic Cylinder', Primary_Type: 'Trap', Sub_Type: 'Normal', Attribute: null, Level: null, Base_ATK: null, Base_DEF: null, Effect_Logic_Hook: 'Reflect_Attack_Damage',
    Description: "Negate an opponent's attack, and inflict damage to their Life Points equal to the ATK of the attacking monster." },
  { Card_ID: 'CARD_025', Name: 'Waboku', Primary_Type: 'Trap', Sub_Type: 'Normal', Attribute: null, Level: null, Base_ATK: null, Base_DEF: null, Effect_Logic_Hook: 'Prevent_Battle_Damage_This_Turn',
    Description: "This turn, you take no battle damage and your monsters aren't destroyed by battle." },
  { Card_ID: 'CARD_026', Name: 'Mirror Force', Primary_Type: 'Trap', Sub_Type: 'Normal', Attribute: null, Level: null, Base_ATK: null, Base_DEF: null, Effect_Logic_Hook: 'Destroy_All_Attack_Position',
    Description: 'When an opponent monster declares an attack: destroy all their Attack Position monsters.' },

  // --- More monsters to keep the pool wide (Fiend/Beast/Machine flavor) ---
  { Card_ID: 'CARD_027', Name: 'Summoned Skull', Primary_Type: 'Monster', Sub_Type: 'Normal', Attribute: 'Dark', Level: 6, Base_ATK: 2500, Base_DEF: 1200, Effect_Logic_Hook: null,
    Description: 'A fiend with dark powers, wreathed in crackling lightning.' },
  { Card_ID: 'CARD_028', Name: 'Giant Soldier of Stone', Primary_Type: 'Monster', Sub_Type: 'Normal', Attribute: 'Earth', Level: 3, Base_ATK: 1300, Base_DEF: 2000, Effect_Logic_Hook: null,
    Description: 'A towering guardian carved from ancient stone.' },
  { Card_ID: 'CARD_029', Name: 'Rogue Doll', Primary_Type: 'Monster', Sub_Type: 'Normal', Attribute: 'Fire', Level: 3, Base_ATK: 1600, Base_DEF: 1000, Effect_Logic_Hook: null,
    Description: 'A cursed doll possessed by a mischievous spirit.' },
  { Card_ID: 'CARD_030', Name: 'Gaia the Fierce Knight', Primary_Type: 'Monster', Sub_Type: 'Normal', Attribute: 'Earth', Level: 7, Base_ATK: 2300, Base_DEF: 2100, Effect_Logic_Hook: null,
    Description: 'A knight who rides fearlessly into battle atop his loyal steed.' },
]

export function getCard(cardId) {
  return CARD_DATABASE.find((c) => c.Card_ID === cardId) || null
}

export function getCardsByType(primaryType) {
  return CARD_DATABASE.filter((c) => c.Primary_Type === primaryType)
}

// A basic legal 40-card starter deck: 3 copies of most monsters/spells,
// staying within the max-3-copies rule and the 40-60 card range.
export const STARTER_DP_DECK = [
  ...Array(3).fill('CARD_006'), ...Array(3).fill('CARD_007'), ...Array(3).fill('CARD_008'),
  ...Array(3).fill('CARD_010'), ...Array(3).fill('CARD_009'), ...Array(3).fill('CARD_005'),
  ...Array(3).fill('CARD_028'), ...Array(3).fill('CARD_029'), ...Array(3).fill('CARD_013'),
  ...Array(2).fill('CARD_018'), ...Array(2).fill('CARD_022'), ...Array(2).fill('CARD_025'),
  ...Array(2).fill('CARD_026'), ...Array(2).fill('CARD_024'), ...Array(2).fill('CARD_002'),
  ...Array(2).fill('CARD_003'),
]

// Builds a legal ~40-card deck for an NPC duelist, skewed toward
// higher-ATK monsters (and a couple of traps) as Tier increases - there's
// no per-archetype card pool defined in the seed data, so this is a
// tractable stand-in for "Deck_Archetype" until a real archetype→card
// mapping is authored.
export function buildNpcDeck(tier) {
  const atkFloor = 800 + tier * 250
  const monsters = CARD_DATABASE.filter((c) => c.Primary_Type === 'Monster' && c.Base_ATK >= atkFloor)
  const pool = monsters.length >= 5 ? monsters : CARD_DATABASE.filter((c) => c.Primary_Type === 'Monster')
  const traps = CARD_DATABASE.filter((c) => c.Primary_Type === 'Trap')
  const spells = CARD_DATABASE.filter((c) => c.Primary_Type === 'Spell')

  const deck = []
  const pickN = (list, count) => {
    for (let i = 0; i < count; i++) deck.push(list[Math.floor(Math.random() * list.length)].Card_ID)
  }
  pickN(pool, 30)
  pickN(traps, 6)
  pickN(spells, 6)
  return deck
}

export function validateDeck(cardIds) {
  const errors = []
  if (cardIds.length < 40) errors.push(`Deck has ${cardIds.length} cards - minimum is 40.`)
  if (cardIds.length > 60) errors.push(`Deck has ${cardIds.length} cards - maximum is 60.`)
  const counts = {}
  for (const id of cardIds) counts[id] = (counts[id] || 0) + 1
  for (const [id, count] of Object.entries(counts)) {
    if (count > 3) errors.push(`${getCard(id)?.Name || id} appears ${count} times - maximum is 3.`)
  }
  return { valid: errors.length === 0, errors }
}
