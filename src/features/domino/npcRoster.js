// Domino City's duelist roster. Day: 1=Monday..7=Sunday. TimeBlock:
// 1=Morning, 2=Afternoon, 3=Evening, 4=Night. Active_Schedule is an array
// of {day, blocks:[...]} entries - an NPC is visible in the world only
// when the current day/time-block matches one of its entries.

export const NPC_ROSTER = [
  {
    NPC_ID: 'NPC_Kaiba',
    Name: 'Seto Kaiba',
    Tier: 5,
    Deck_Archetype: 'Blue-Eyes / Heavy Aggro',
    Behavior: 'Aggressive_Aggro',
    Spawn_Location: 'kcTower',
    Active_Schedule: [{ day: 7, blocks: [3, 4] }],
    Dialog_PreDuel: "Don't waste my time. Draw your cards.",
    Dialog_Win: 'A predictable and pathetic strategy.',
    Dialog_Loss: 'Impossible! My Blue-Eyes cannot be defeated!',
    palette: { skin: '#f1c27d', hair: '#5a3825', outfit: '#1a1a2e', hairStyle: 'Long' },
  },
  {
    NPC_ID: 'NPC_Joey',
    Name: 'Joey Wheeler',
    Tier: 4,
    Deck_Archetype: 'Red-Eyes / Warrior Luck',
    Behavior: 'Unpredictable_Luck',
    Spawn_Location: 'domiPark',
    Active_Schedule: [{ day: 1, blocks: [2] }, { day: 3, blocks: [2] }, { day: 5, blocks: [2] }],
    Dialog_PreDuel: 'Time to show you what a real Brooklyn brawler can do!',
    Dialog_Win: "Aww yeah! That's how we do it!",
    Dialog_Loss: 'Man, you completely outplayed me.',
    palette: { skin: '#e0ac69', hair: '#c99b3c', outfit: '#3f6fd6', hairStyle: 'Short' },
  },
  {
    NPC_ID: 'NPC_Yugi',
    Name: 'Muto Yugi',
    Tier: 5,
    Deck_Archetype: 'Dark Magician / Balanced',
    Behavior: 'Balanced_Tactical',
    Spawn_Location: 'kameShop',
    Active_Schedule: [{ day: 1, blocks: [1, 2, 3] }, { day: 2, blocks: [1, 2, 3] }, { day: 3, blocks: [1, 2, 3] }, { day: 4, blocks: [1, 2, 3] }, { day: 5, blocks: [1, 2, 3] }],
    Dialog_PreDuel: 'You want to be King of Games? Prove it - however you think is fair.',
    Dialog_Win: 'The Heart of the Cards guided me today.',
    Dialog_Loss: "That was a great duel. You've really grown.",
    palette: { skin: '#f1c27d', hair: '#e0e0e0', outfit: '#7a2fd6', hairStyle: 'Spiky' },
  },
  {
    NPC_ID: 'NPC_Solomon',
    Name: 'Solomon Muto',
    Tier: 2,
    Deck_Archetype: 'Vintage Warrior',
    Behavior: 'Balanced_Tactical',
    Spawn_Location: 'kameShop',
    Active_Schedule: [{ day: 6, blocks: [1, 2] }, { day: 7, blocks: [1, 2] }],
    Dialog_PreDuel: "Ho ho! Let an old man show you a few tricks, eh?",
    Dialog_Win: "Experience beats enthusiasm every time, my boy.",
    Dialog_Loss: "Ha! You've got real talent. Reminds me of Yugi.",
    palette: { skin: '#e0ac69', hair: '#e0e0e0', outfit: '#5a3825', hairStyle: 'Short' },
  },
  {
    NPC_ID: 'NPC_Tea',
    Name: 'Téa Gardner',
    Tier: 2,
    Deck_Archetype: 'Magician Girl Support',
    Behavior: 'Balanced_Tactical',
    Spawn_Location: 'townSquare',
    Active_Schedule: [{ day: 2, blocks: [2, 3] }, { day: 4, blocks: [2, 3] }],
    Dialog_PreDuel: "Friendship is great, but I'm still gonna beat you!",
    Dialog_Win: 'See? Belief in your deck is everything.',
    Dialog_Loss: "You're really strong. I need to practice more.",
    palette: { skin: '#f1c27d', hair: '#5a3825', outfit: '#2f9e44', hairStyle: 'Long' },
  },
  {
    NPC_ID: 'NPC_Duke',
    Name: 'Duke Devlin',
    Tier: 3,
    Deck_Archetype: 'Dice & Trap Control',
    Behavior: 'Unpredictable_Luck',
    Spawn_Location: 'streets',
    Active_Schedule: [{ day: 3, blocks: [1, 2] }, { day: 6, blocks: [2, 3] }],
    Dialog_PreDuel: 'Care to roll the dice with me, duelist?',
    Dialog_Win: 'The house always wins eventually.',
    Dialog_Loss: 'Lucky roll. Rematch sometime.',
    palette: { skin: '#f1c27d', hair: '#1a1a1a', outfit: '#333333', hairStyle: 'Ponytail' },
  },
  {
    NPC_ID: 'NPC_Rando1',
    Name: 'Street Duelist',
    Tier: 1,
    Deck_Archetype: 'Generic Beatdown',
    Behavior: 'Balanced_Tactical',
    Spawn_Location: 'streets',
    Active_Schedule: [{ day: 1, blocks: [1, 2, 3, 4] }, { day: 2, blocks: [1, 2, 3, 4] }, { day: 3, blocks: [1, 2, 3, 4] }, { day: 4, blocks: [1, 2, 3, 4] }, { day: 5, blocks: [1, 2, 3, 4] }, { day: 6, blocks: [1, 2, 3, 4] }, { day: 7, blocks: [1, 2, 3, 4] }],
    Dialog_PreDuel: "Hey, you look like you can duel. Let's go!",
    Dialog_Win: 'Ha, too easy.',
    Dialog_Loss: 'Whatever, I wasn\'t even trying.',
    palette: { skin: '#c68642', hair: '#1a1a1a', outfit: '#8a5a1f', hairStyle: 'Buzzcut' },
  },
]

export function getNpc(npcId) {
  return NPC_ROSTER.find((n) => n.NPC_ID === npcId) || null
}

export function isNpcActive(npc, day, timeBlock) {
  return npc.Active_Schedule.some((entry) => entry.day === day && entry.blocks.includes(timeBlock))
}

export function getActiveNpcsAt(zoneId, day, timeBlock) {
  return NPC_ROSTER.filter((n) => n.Spawn_Location === zoneId && isNpcActive(n, day, timeBlock))
}

export function dpPayoutForWin(tier, { quickVictory, flawless } = {}) {
  let dp = tier <= 2 ? 100 : tier <= 4 ? 150 : 200
  if (quickVictory) dp += 50
  if (flawless) dp += 50
  return dp
}

export const DP_LOSS_PAYOUT = 10
