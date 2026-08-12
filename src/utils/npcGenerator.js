import { SKIN_TONES, HAIR_COLORS, OUTFIT_COLORS, HAIR_OPTIONS } from '../game/characterPalettes'

const FIRST_NAMES = [
  'Tah', 'Jeff', 'Ince', 'Franc', 'Tan', 'Poom',
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

// Mug difficulty tiers - success chance trades off against payout, so a
// wary/tough mark is riskier to hit but worth more when it lands (see
// WorldScreen.jsx's handleMug, the only place these get read). Picked once,
// deterministically, from the same id-derived seed as the npc's cosmetic
// traits below - a given ambient NPC is always exactly this hard/lucrative
// to mug, every run, not re-rolled per attempt.
const MUG_TIERS = [
  { label: 'Easy Mark', baseSuccessChance: 0.9, payout: 90, notorietyIncreaseOnFail: 3, wantedIncreaseOnFail: 1 },
  { label: 'Average Mark', baseSuccessChance: 0.8, payout: 180, notorietyIncreaseOnFail: 5, wantedIncreaseOnFail: 1 },
  { label: 'Wary Mark', baseSuccessChance: 0.65, payout: 330, notorietyIncreaseOnFail: 7, wantedIncreaseOnFail: 2 },
  { label: 'Tough Mark', baseSuccessChance: 0.5, payout: 540, notorietyIncreaseOnFail: 10, wantedIncreaseOnFail: 2 },
]

// Callable with just an id (no need to regenerate the whole npc) - both of
// WorldScreen.jsx's mug call sites (Ince's bespoke house branch, which only
// ever has her id on hand, and the generic ambientNpc branch) go through
// this rather than reading generateAmbientNpc(id).mugDifficulty.
export function getMugProfile(id) {
  const seed = hashSeed(id)
  // >>> 12 keeps this independent of the bits palette/personality/trait
  // below already consume (seed, seed>>>3/6/9, seed>>2, seed>>4).
  return seededPick(MUG_TIERS, seed >>> 12)
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
    mugDifficulty: getMugProfile(id),
  }
}

export function generateAmbientNpcs(prefix, count) {
  return Array.from({ length: count }, (_, i) => generateAmbientNpc(`${prefix}_${i}`))
}
