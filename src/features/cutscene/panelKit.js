// Shared drawing kit for every cutscene panel (cutscenePanels.js for the
// opening, endingPanels.js for the ending). Palette, canvas primitives,
// the two recurring characters and the set dressing they stand in.
//
// Everything here is Canvas 2D drawn at runtime onto a fixed 480x270
// backing store that CutscenePlayer scales up with
// `image-rendering: pixelated` - no .png is imported, in line with the
// project's no-external-assets rule (the same reason spriteGen.js and
// tileGen.js draw the world instead of loading sheets).
//
// Panel painters have the signature (ctx, t), `t` being seconds since that
// panel became visible, so they can flicker/pulse/draw themselves in
// without owning a timer. Painters must be pure w.r.t. `t`: the player
// repaints every frame and nothing may accumulate across calls, or
// skipping/rewinding a line would desync the art.

export const PANEL_W = 480
export const PANEL_H = 270

// Matches the game's dark-neon UI (see index.css / WelcomeScreen).
export const C = {
  void: '#0b0c18',
  deep: '#0f1020',
  panel: '#1c1d3a',
  panelLit: '#272850',
  line: '#3b3d6b',
  cyan: '#22d3ee',
  fuchsia: '#e879f9',
  yellow: '#fde047',
  green: '#4ade80',
  greenDim: '#166534',
  red: '#ef4444',
  redDim: '#7f1d1d',
  white: '#e8e4d8',
  grey: '#8b8ba7',
  // the player's own sprite palette, lifted from game/playerSpriteArt.js so
  // the cutscene protagonist reads as the character you control
  hair: '#8a3d2b',
  hairDark: '#5c2a1e',
  skin: '#e8b98c',
  skinDark: '#c99468',
  shirt: '#1f4d3a',
  shirtDark: '#153527',
  pants: '#232a3d',
  // father
  dadHair: '#4a4a52',
  dadShirt: '#5b4636',
  dadShirtDark: '#3d2f24',
}

// --- primitives ---
export const r = (ctx, x, y, w, h, c) => {
  ctx.fillStyle = c
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

export const txt = (ctx, s, x, y, c, size = 12, align = 'left', weight = 'bold') => {
  ctx.fillStyle = c
  ctx.font = `${weight} ${size}px "Courier New", monospace`
  ctx.textAlign = align
  ctx.textBaseline = 'top'
  ctx.fillText(s, Math.round(x), Math.round(y))
  ctx.textAlign = 'left'
}

// Deterministic value noise - panels need stable "random" detail (window
// lights, star fields, book spines) that does NOT reshuffle every repaint.
export const hash = (n) => {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

export const bg = (ctx, c) => r(ctx, 0, 0, PANEL_W, PANEL_H, c)

// Horizontal CRT scanlines - ties the cutscenes to the game's retro
// presentation and hides banding in the flat fills.
export const scanlines = (ctx, alpha = 0.14) => {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`
  for (let y = 0; y < PANEL_H; y += 3) ctx.fillRect(0, y, PANEL_W, 1)
}

export const vignette = (ctx, strength = 0.55) => {
  const g = ctx.createRadialGradient(PANEL_W / 2, PANEL_H / 2, 60, PANEL_W / 2, PANEL_H / 2, 300)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(0,0,0,${strength})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, PANEL_W, PANEL_H)
}

// Soft additive glow, used for every light source (monitors, lamps, neon).
export const glow = (ctx, x, y, radius, color, alpha = 0.5) => {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius)
  g.addColorStop(0, color)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = g
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  ctx.restore()
}

// --- figures ---

// Standing player character, front-facing, ~72px tall at s=1. `slump`
// (0..1) drops the head and shoulders and closes the eyes.
export function drawStudent(ctx, x, y, s = 1, slump = 0) {
  const p = (n) => n * s
  const drop = p(slump * 5)
  // legs
  r(ctx, x - p(9), y - p(26), p(7), p(24), C.pants)
  r(ctx, x + p(2), y - p(26), p(7), p(24), C.pants)
  r(ctx, x - p(10), y - p(3), p(9), p(3), '#2a2a2a')
  r(ctx, x + p(1), y - p(3), p(9), p(3), '#2a2a2a')
  // torso
  r(ctx, x - p(11), y - p(52) + drop, p(22), p(27), C.shirt)
  r(ctx, x - p(11), y - p(52) + drop, p(4), p(27), C.shirtDark)
  // sash (the character's white belt in playerSpriteArt.js)
  r(ctx, x - p(11), y - p(30) + drop, p(22), p(3), C.white)
  // arms
  r(ctx, x - p(15), y - p(50) + drop, p(4), p(22), C.shirtDark)
  r(ctx, x + p(11), y - p(50) + drop, p(4), p(22), C.shirtDark)
  r(ctx, x - p(15), y - p(29) + drop, p(4), p(4), C.skin)
  r(ctx, x + p(11), y - p(29) + drop, p(4), p(4), C.skin)
  // head
  r(ctx, x - p(8), y - p(68) + drop, p(16), p(16), C.skin)
  r(ctx, x - p(8), y - p(68) + drop, p(4), p(16), C.skinDark)
  // hair - flat cap plus three spikes, echoing the in-world sprite
  r(ctx, x - p(9), y - p(70) + drop, p(18), p(7), C.hair)
  r(ctx, x - p(9), y - p(70) + drop, p(18), p(2), C.hairDark)
  r(ctx, x - p(7), y - p(73) + drop, p(3), p(3), C.hair)
  r(ctx, x - p(1), y - p(74) + drop, p(3), p(4), C.hair)
  r(ctx, x + p(4), y - p(72) + drop, p(3), p(2), C.hair)
  // eyes - a flat line once slumped
  if (slump > 0.5) {
    r(ctx, x - p(5), y - p(60) + drop, p(3), p(1), '#2a2420')
    r(ctx, x + p(2), y - p(60) + drop, p(3), p(1), '#2a2420')
  } else {
    r(ctx, x - p(5), y - p(61) + drop, p(3), p(3), '#2a2420')
    r(ctx, x + p(2), y - p(61) + drop, p(3), p(3), '#2a2420')
  }
}

// Seated at a desk, seen from behind over the shoulder - the pose for
// every "at the laptop" panel. Draws a chair, so do NOT use it standing.
export function drawStudentFromBehind(ctx, x, y, s = 1) {
  const p = (n) => n * s
  // chair back
  r(ctx, x - p(18), y - p(34), p(36), p(34), '#191a2e')
  r(ctx, x - p(18), y - p(34), p(36), p(3), '#23243f')
  // shoulders / back
  r(ctx, x - p(15), y - p(44), p(30), p(20), C.shirt)
  r(ctx, x - p(15), y - p(44), p(30), p(3), '#2a6b4f')
  // neck
  r(ctx, x - p(4), y - p(50), p(8), p(7), C.skinDark)
  // head from behind - all hair
  r(ctx, x - p(10), y - p(66), p(20), p(18), C.hair)
  r(ctx, x - p(10), y - p(66), p(20), p(4), C.hairDark)
  r(ctx, x - p(8), y - p(69), p(3), p(3), C.hair)
  r(ctx, x - p(2), y - p(70), p(3), p(4), C.hair)
  r(ctx, x + p(4), y - p(68), p(3), p(3), C.hair)
}

// Standing, seen from behind - for street/exterior shots. Distinct from
// drawStudentFromBehind, which is seated and draws a chair.
export function drawStudentBackStanding(ctx, x, y, s = 1) {
  const p = (n) => n * s
  r(ctx, x - p(9), y - p(26), p(7), p(24), C.pants)
  r(ctx, x + p(2), y - p(26), p(7), p(24), C.pants)
  r(ctx, x - p(10), y - p(3), p(9), p(3), '#1c1c1c')
  r(ctx, x + p(1), y - p(3), p(9), p(3), '#1c1c1c')
  r(ctx, x - p(12), y - p(52), p(24), p(27), C.shirtDark)
  r(ctx, x - p(12), y - p(52), p(24), p(3), C.shirt)
  r(ctx, x - p(16), y - p(50), p(4), p(22), '#102019')
  r(ctx, x + p(12), y - p(50), p(4), p(22), '#102019')
  r(ctx, x - p(4), y - p(56), p(8), p(6), C.skinDark)
  r(ctx, x - p(9), y - p(70), p(18), p(16), C.hair)
  r(ctx, x - p(9), y - p(70), p(18), p(4), C.hairDark)
  r(ctx, x - p(7), y - p(73), p(3), p(3), C.hair)
  r(ctx, x - p(1), y - p(74), p(3), p(4), C.hair)
  r(ctx, x + p(4), y - p(72), p(3), p(3), C.hair)
}

// The father: heavier build, greying hair. `point` (0..1) raises an
// accusing arm; `dir` (-1 left / +1 right) is which way it points, so he
// can be aimed at whoever he's talking to. `mouth` picks the expression:
// 'shout' (open), 'flat' (neutral line) or 'warm' (small smile).
export function drawFather(ctx, x, y, s = 1, point = 0, dir = 1, mouth = 'shout') {
  const p = (n) => n * s
  r(ctx, x - p(11), y - p(30), p(9), p(28), '#2f3038')
  r(ctx, x + p(2), y - p(30), p(9), p(28), '#2f3038')
  r(ctx, x - p(12), y - p(3), p(10), p(3), '#1a1a1e')
  r(ctx, x + p(2), y - p(3), p(10), p(3), '#1a1a1e')
  // torso - broader than the student's
  r(ctx, x - p(14), y - p(58), p(28), p(30), C.dadShirt)
  r(ctx, x - p(14), y - p(58), p(5), p(30), C.dadShirtDark)
  // the arm he isn't pointing with always hangs
  const restX = dir > 0 ? x - p(18) : x + p(13)
  r(ctx, restX, y - p(56), p(5), p(24), C.dadShirtDark)
  r(ctx, restX, y - p(33), p(5), p(5), C.skin)
  // the other arm: extended when pointing, hanging otherwise
  if (point > 0.5) {
    const armX = dir > 0 ? x + p(14) : x - p(34)
    r(ctx, armX, y - p(56), p(20), p(5), C.dadShirt)
    r(ctx, dir > 0 ? x + p(34) : x - p(41), y - p(57), p(7), p(6), C.skin)
  } else {
    const hangX = dir > 0 ? x + p(14) : x - p(18)
    r(ctx, hangX, y - p(56), p(5), p(24), C.dadShirtDark)
    r(ctx, hangX, y - p(33), p(5), p(5), C.skin)
  }
  // head
  r(ctx, x - p(9), y - p(76), p(18), p(18), C.skin)
  r(ctx, x - p(9), y - p(76), p(5), p(18), C.skinDark)
  r(ctx, x - p(10), y - p(78), p(20), p(6), C.dadHair)
  r(ctx, x - p(10), y - p(78), p(20), p(2), '#33333a')
  // brow + eyes - the brow lifts and softens when he isn't shouting
  if (mouth === 'shout') {
    r(ctx, x - p(7), y - p(69), p(6), p(2), '#33333a')
    r(ctx, x + p(1), y - p(69), p(6), p(2), '#33333a')
  } else {
    r(ctx, x - p(7), y - p(70), p(6), p(1), '#4a4a52')
    r(ctx, x + p(1), y - p(70), p(6), p(1), '#4a4a52')
  }
  r(ctx, x - p(6), y - p(66), p(3), p(3), '#2a2420')
  r(ctx, x + p(2), y - p(66), p(3), p(3), '#2a2420')
  // mouth
  if (mouth === 'shout') {
    r(ctx, x - p(4), y - p(61), p(8), p(4), '#5c2020')
  } else if (mouth === 'warm') {
    r(ctx, x - p(4), y - p(60), p(8), p(1), '#8a5a4a')
    r(ctx, x - p(5), y - p(61), p(1), p(1), '#8a5a4a')
    r(ctx, x + p(4), y - p(61), p(1), p(1), '#8a5a4a')
  } else {
    r(ctx, x - p(3), y - p(60), p(6), p(1), '#8a5a4a')
  }
}

// --- shared set dressing ---

// Skyline silhouette with stable lit windows, drawn from `yBase` upward.
// Drawn full-width by design: clip it yourself if it must sit in a window.
export function skyline(ctx, yBase, seed = 1, color = '#141527', litColor = '#f8d97a', litChance = 0.25) {
  let x = -10
  let i = 0
  while (x < PANEL_W + 10) {
    const w = 22 + Math.floor(hash(seed + i * 3.7) * 26)
    const h = 40 + Math.floor(hash(seed + i * 7.3) * 95)
    r(ctx, x, yBase - h, w, h, color)
    for (let wy = yBase - h + 6; wy < yBase - 6; wy += 9) {
      for (let wx = x + 4; wx < x + w - 5; wx += 8) {
        if (hash(seed + wx * 1.7 + wy * 3.1) < litChance) r(ctx, wx, wy, 3, 4, litColor)
      }
    }
    x += w + 3
    i += 1
  }
}

// A candlestick run. `data` is {o, c, hi, lo} in 0..1 chart space.
// `reveal` (0..1) draws only the first portion, so a chart can animate in
// as the narration lands on it.
export function candles(ctx, x, y, w, h, data, reveal = 1) {
  const n = data.length
  const cw = w / n
  const upto = Math.ceil(n * reveal)
  for (let i = 0; i < upto; i += 1) {
    const d = data[i]
    const up = d.c >= d.o
    const col = up ? C.green : C.red
    const px = x + i * cw
    const yTop = y + h - d.hi * h
    const yBot = y + h - d.lo * h
    r(ctx, px + cw / 2 - 0.5, yTop, 1, yBot - yTop, up ? C.greenDim : C.redDim)
    const bTop = y + h - Math.max(d.o, d.c) * h
    const bBot = y + h - Math.min(d.o, d.c) * h
    r(ctx, px + 1, bTop, Math.max(2, cw - 2), Math.max(2, bBot - bTop), col)
  }
}

// Monitor / laptop bezel. Returns the inner screen rect for the caller.
export function screenFrame(ctx, x, y, w, h) {
  r(ctx, x - 3, y - 3, w + 6, h + 6, '#0a0a12')
  r(ctx, x - 1, y - 1, w + 2, h + 2, C.line)
  r(ctx, x, y, w, h, '#0d1424')
  return { x, y, w, h }
}

// A wall of bookshelves - the father's study, and the university library.
export function bookshelf(ctx, x, y, w, h, dim = false) {
  r(ctx, x, y, w, h, '#241a12')
  for (let sy = y + 8; sy < y + h; sy += 34) {
    r(ctx, x + 4, sy + 26, w - 8, 4, '#3a2a1c')
    for (let bx = x + 8; bx < x + w - 8; bx += 8) {
      const bh = 16 + Math.floor(hash(bx * 2.3 + sy) * 10)
      const cols = dim
        ? ['#3b2a22', '#2c3428', '#2a3048', '#4a3520', '#33253a']
        : ['#5b3a2e', '#3f5137', '#3b4668', '#6b4a2a', '#4a3550']
      r(ctx, bx, sy + 26 - bh, 6, bh, cols[Math.floor(hash(bx + sy * 1.7) * cols.length)])
    }
  }
}
