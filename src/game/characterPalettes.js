// Single source of truth for character-creator options so the creator
// preview and the in-game Phaser sprite always render identically.

export const SKIN_TONES = ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#4a2c14']
export const HAIR_COLORS = ['#1a1a1a', '#5a3825', '#c99b3c', '#e0e0e0', '#8b0000', '#003f7f']
export const OUTFIT_COLORS = ['#d64545', '#3f6fd6', '#2f9e44', '#f2b705', '#7a2fd6', '#333333']

export const FACE_OPTIONS = ['Round', 'Angular', 'Oval', 'Square']
export const EYEBROW_OPTIONS = ['Thin', 'Thick', 'Arched', 'Straight']
export const EYE_OPTIONS = ['Round', 'Sharp', 'Sleepy', 'Wide']
export const MOUTH_OPTIONS = ['Neutral', 'Smile', 'Smirk', 'Frown']
export const NOSE_OPTIONS = ['Small', 'Straight', 'Button', 'Angular']
export const HAIR_OPTIONS = ['Short', 'Spiky', 'Long', 'Buzzcut', 'Ponytail']

export function resolvePalette(player) {
  return {
    skin: SKIN_TONES[player.skinTone % SKIN_TONES.length],
    hair: HAIR_COLORS[player.hair % HAIR_COLORS.length],
    outfit: OUTFIT_COLORS[player.outfitColor % OUTFIT_COLORS.length],
    hairStyle: HAIR_OPTIONS[player.hair % HAIR_OPTIONS.length],
    gender: player.gender,
  }
}
