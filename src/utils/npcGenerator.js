import { SKIN_TONES, HAIR_COLORS, OUTFIT_COLORS, HAIR_OPTIONS } from '../game/characterPalettes'

const FIRST_NAMES = [
  'Mira', 'Toby', 'Suri', 'Dax', 'Elena', 'Kip', 'Nadia', 'Fenn', 'Yara', 'Otis',
  'Ines', 'Zeke', 'Rosa', 'Milo', 'Ada', 'Basil', 'Junie', 'Reo', 'Petra', 'Sable',
]

const PERSONALITY_TAGS = [
  'nervous', 'gossipy', 'grumpy', 'cheerful', 'suspicious', 'bored', 'chatty', 'sleepy',
]

const VISUAL_TRAITS = [
  'a chipped tooth', 'a lucky coin necklace', 'mismatched socks', 'a faded band t-shirt',
  'a nervous twitch', 'a battered backpack', 'sunburn on the nose', 'a homemade tattoo',
]

function seededPick(list, seed) {
  const idx = Math.abs(Math.floor(seed)) % list.length
  return list[idx]
}

function hashSeed(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}

export function generateAmbientNpc(id) {
  const seed = hashSeed(id)
  const palette = {
    skin: SKIN_TONES[seed % SKIN_TONES.length],
    hair: HAIR_COLORS[(seed >>> 3) % HAIR_COLORS.length],
    outfit: OUTFIT_COLORS[(seed >>> 6) % OUTFIT_COLORS.length],
    hairStyle: HAIR_OPTIONS[(seed >>> 9) % HAIR_OPTIONS.length],
  }
  return {
    id,
    name: seededPick(FIRST_NAMES, seed),
    personality: seededPick(PERSONALITY_TAGS, seed >> 2),
    trait: seededPick(VISUAL_TRAITS, seed >> 4),
    palette,
  }
}

export function generateAmbientNpcs(prefix, count) {
  return Array.from({ length: count }, (_, i) => generateAmbientNpc(`${prefix}_${i}`))
}
