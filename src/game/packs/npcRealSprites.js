// Salvaged NPC art. Source: public/assets/packs/npc/ (AI-generated reference
// sheets - raw sheets are gitignored; only the processed/ output below is
// committed, since the raw ones are unusable as-is: baked-in titles, grid
// lines, labels, and a solid white background).
//
// Every sheet under processed/ is built to ONE fixed layout by the salvage
// pipeline, so this module stays trivial: a 2-column x 4-row grid, columns
// being the two walk steps and rows being down / up / left / right in that
// order. Frame index is therefore just row*2 + step. Left is baked in
// pre-mirrored where the source only authored a right-facing profile, so
// nothing here ever needs flipX.
//
// The three things that made the first version of this look wrong in game,
// all fixed in the sheets themselves rather than with runtime fudge factors:
//
// 1. SIZE. Every character is normalised so its standing pose is 64px tall -
//    exactly what the game's own actors are (procedural NPCs are a 12x16
//    grid of 4px units = 64px at scale 1; the player art is 44x80 at scale
//    0.8 = 64px). Before this they were rendering ~100px and towered over
//    everyone. Scale is 1.0 for every sheet now; the art is already the
//    right size, so there's no runtime rescale to get wrong.
//
// 2. MOTION. The walk frames are the actual walk cycle. The first pass used
//    columns 9+ of the side row, which are the RUN poses - dramatic
//    forward-leaning lunges that read as sprinting on the spot.
//
// 3. BLENDING. The source art ships with a white sticker halo around each
//    figure. That's removed by flood-filling the background inward from the
//    cell border (a plain white threshold would punch holes in Graham's
//    white hair and Musk's white shirt - interior whites aren't connected to
//    the border, so they survive), then a 1px dark outline is baked on, the
//    same post-process trick spriteGen.js's outlineFrame uses on the
//    procedural sprites. The downscale to final size is also baked in, so
//    Phaser's pixelArt/NEAREST sampling draws these 1:1 instead of harshly
//    minifying a ~130px source every frame.
//
// Cell size still varies per sheet - each source image was independently
// generated, so trimmed content differs by a few px. Measure every new sheet
// on its own terms. That applies to ROW ORDER too, not just dimensions: the
// male and thai_warrior sources put the back view on row 0 and the front on
// row 4, while female and prince_thai are the other way round. The old shared
// `ROW = { up: 0, ..., down: 4 }` constant assumed one order for all of them
// and was silently wrong for prince_thai - Washington used to show his face
// while walking away and the back of his head while walking toward you. The
// per-sheet row order is resolved during salvage now, so by the time a sheet
// reaches this file it is always down/up/left/right.

// Row index within every processed sheet, by facing.
const FACING_ROW = { down: 0, up: 1, left: 2, right: 3 }
const STEPS_PER_ROW = 2

const SHEETS = {
  graham: { key: 'npcReal_graham', path: '/assets/packs/npc/processed/graham.png', cellW: 46, cellH: 81 },
  musk: { key: 'npcReal_musk', path: '/assets/packs/npc/processed/musk.png', cellW: 46, cellH: 82 },
  jobs: { key: 'npcReal_jobs', path: '/assets/packs/npc/processed/jobs.png', cellW: 43, cellH: 85 },
  ford: { key: 'npcReal_ford', path: '/assets/packs/npc/processed/ford.png', cellW: 45, cellH: 81 },
  luciano: { key: 'npcReal_luciano', path: '/assets/packs/npc/processed/luciano.png', cellW: 46, cellH: 83 },
  maleNpc: { key: 'npcReal_maleNpc', path: '/assets/packs/npc/processed/male_npc.png', cellW: 42, cellH: 79 },
  femaleNpc: { key: 'npcReal_femaleNpc', path: '/assets/packs/npc/processed/female_npc.png', cellW: 45, cellH: 81 },
  princeThai: { key: 'npcReal_princeThai', path: '/assets/packs/npc/processed/prince_thai.png', cellW: 43, cellH: 86 },
  thaiWarrior: { key: 'npcReal_thaiWarrior', path: '/assets/packs/npc/processed/thai_warrior.png', cellW: 52, cellH: 78 },
  // Built from packs/Lisa/lisa character.png (an RPG-Maker-style sheet, not
  // the AI-generated portrait sheets in that same folder) into this module's
  // standard 2x4 layout. Its own left/right rows are baked copies of the
  // front walk - the source sheet has no side-profile art anywhere, so
  // NO_BACK_VIEW-style runtime redirection isn't needed here.
  lisa: { key: 'npcReal_lisa', path: '/assets/packs/Lisa/processed/lisa.png', cellW: 33, cellH: 64 },
  // Built from packs/police fighting/police sprite.png - a "spread" pose
  // reference sheet (one pose per direction per animation state), not a
  // multi-frame animation strip. Its WALK row's 8 "directional" columns are
  // all the same front-facing pose (no real back or side view anywhere, an
  // even flatter limitation than graham/musk/etc below), and the sheet's
  // RUN row is a genuinely different sprint animation, not a second walk
  // frame - pairing them would look like lurching into a sprint every other
  // step, the exact mistake this file's own header warns about. So both
  // step columns here are baked identical (no leg animation while walking)
  // rather than faking motion that isn't in the source art.
  police: { key: 'npcReal_police', path: '/assets/packs/police-battle/police_walk.png', cellW: 29, cellH: 64 },
}

// The five flat-format sources (graham/musk/jobs/ford/luciano) have no back
// view authored anywhere on the sheet - every pose is front or side, checked
// row by row. Their 'up' row is a copy of the front pose, so those five show
// their face while walking away from the camera. That's a limit of the source
// art, not a wiring mistake; the alternative (reusing a side profile for up)
// reads worse. The four directional sheets have real back views. `police`
// joins this set too (see its SHEETS comment above) - its up/down rows are
// already baked identical, so the redirect is a no-op, kept only so the
// limitation is documented the same way as everywhere else.
const NO_BACK_VIEW = new Set(['graham', 'musk', 'jobs', 'ford', 'luciano', 'police'])

// Which character id uses which sheet. Named ids are real roster ids;
// fin_ambient_N ids are the non-named ambient NPCs (npc_fin_ambient_${i} keys
// from OverworldScene.js's spawnFinanceAmbientNpcs - after getActorRenderInfo
// strips the npc_ prefix, that's what characterId is for them). Ambient NPCs
// carry no gender field (see npcGenerator.js - the palette is seeded from the
// id and no gender attribute exists), so the male/female split below is an
// arbitrary but deterministic choice across the 6 ambient slots, not derived
// from in-game data. Slots 4 and 5 stay procedural. 'police' is not a roster
// id or an ambient slot - every physically-chasing officer OverworldScene's
// spawnPoliceChaser() creates shares this same one texture key (npc_police),
// same as how every fin_ambient_0 shares 'maleNpc' - a shared texture key is
// just Phaser asset reuse, each spawned actor is still its own sprite/body.
const REAL_SPRITE_NPCS = {
  washington: 'princeThai',
  jefferson: 'thaiWarrior',
  graham: 'graham',
  musk: 'musk',
  jobs: 'jobs',
  ford: 'ford',
  luciano: 'luciano',
  lisa: 'lisa',
  police: 'police',
  fin_ambient_0: 'maleNpc',
  fin_ambient_1: 'maleNpc',
  fin_ambient_2: 'femaleNpc',
  fin_ambient_3: 'femaleNpc',
}

export function hasRealSprite(characterId) {
  return characterId in REAL_SPRITE_NPCS
}

// The texture key a character's sheet loads under, so callers can check
// scene.textures.exists(...) without knowing the sheet-selection logic.
export function realSpriteTextureKey(characterId) {
  const sheet = SHEETS[REAL_SPRITE_NPCS[characterId]]
  return sheet ? sheet.key : null
}

export function preloadNpcRealSprites(scene) {
  for (const sheet of Object.values(SHEETS)) {
    if (scene.textures.exists(sheet.key)) continue
    scene.load.spritesheet(sheet.key, sheet.path, { frameWidth: sheet.cellW, frameHeight: sheet.cellH })
  }
}

// Same shape spriteGen.js's getActorRenderInfo returns for every other mode,
// so actor.js's SpriteActor needs no changes - see that file's single
// dispatch point.
export function realSpriteRenderInfo(characterId) {
  const sheetName = REAL_SPRITE_NPCS[characterId]
  const sheet = SHEETS[sheetName]
  const noBack = NO_BACK_VIEW.has(sheetName)

  return {
    textureKey: sheet.key,
    // Only 2 step values ever reach this - see actor.js: stepFrame stays 0
    // while idle and alternates 0/1 while moving.
    frameName: (facing, step) => {
      const f = noBack && facing === 'up' ? 'down' : facing
      const row = FACING_ROW[f] ?? FACING_ROW.down
      return row * STEPS_PER_ROW + (step === 1 ? 1 : 0)
    },
    // Left-facing art is baked pre-mirrored into the sheet during salvage,
    // so there is never a runtime flip.
    flipX: () => false,
    tint: null,
    // The art is already at final display size - see note 1 in the header.
    scale: 1,
    frameW: sheet.cellW,
    frameH: sheet.cellH,
  }
}
