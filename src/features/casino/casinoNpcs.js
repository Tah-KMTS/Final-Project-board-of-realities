// Small closed roster of Neon Dragon Casino regulars. Used both by the
// generic "Poker vs NPCs" table (a random regular sits down opposite you)
// and by the "Challenge a specific NPC" flow (ChallengeNpc.jsx lets the
// player pick exactly one of these by name).
//
// `tellSkill` (0-10) is how good a poker face the NPC has - it's compared
// against the player's PER stat (see the charisma note in Poker.jsx) to
// decide how reliable the "tell" hint shown to the player is, and how easily
// the NPC can be bluffed off a hand.

export const CASINO_NPCS = [
  {
    id: 'lucky_han',
    name: 'Lucky Han',
    title: 'Riverboat Regular',
    tellSkill: 2,
    avatarColor: '#e0ac69',
    flavor: 'Grins at everything. Grins hardest right before he folds.',
  },
  {
    id: 'iron_may',
    name: 'Iron May',
    title: 'The Unreadable',
    tellSkill: 9,
    avatarColor: '#8d5524',
    flavor: "Hasn't blinked since the dealer shuffled. Good luck reading her.",
  },
  {
    id: 'whistling_dax',
    name: 'Whistling Dax',
    title: 'Small-Stakes Shark',
    tellSkill: 4,
    avatarColor: '#f1c27d',
    flavor: 'Hums old jazz standards. The tune changes when his hand does.',
  },
  {
    id: 'madame_reiko',
    name: 'Madame Reiko',
    title: 'High Roller',
    tellSkill: 7,
    avatarColor: '#4a2c14',
    flavor: 'Old money, older habits. Taps two fingers on the felt when bluffing.',
  },
  {
    id: 'crooked_finn',
    name: 'Crooked Finn',
    title: 'Table-Hopper',
    tellSkill: 3,
    avatarColor: '#c68642',
    flavor: 'Sweats through his shirt collar whenever the pot gets big.',
  },
  {
    id: 'the_accountant',
    name: '"The Accountant"',
    title: 'Nobody Knows His Real Name',
    tellSkill: 8,
    avatarColor: '#ffdbac',
    flavor: 'Counts everything silently. Barely reacts to his own cards.',
  },
]

export function getCasinoNpc(id) {
  return CASINO_NPCS.find((n) => n.id === id)
}

export function randomCasinoNpc() {
  return CASINO_NPCS[Math.floor(Math.random() * CASINO_NPCS.length)]
}
