// The nine panels of the OPENING cutscene (see introCutsceneScript.js and
// CutscenePlayer.jsx). Palette, primitives, figures and set dressing all
// come from panelKit.js, which endingPanels.js shares - see that file's
// header for the drawing contract these painters follow.

import {
  PANEL_W,
  PANEL_H,
  C,
  r,
  txt,
  hash,
  bg,
  scanlines,
  vignette,
  glow,
  skyline,
  candles,
  screenFrame,
  drawStudent,
  drawStudentFromBehind,
  drawStudentBackStanding,
  drawFather,
} from './panelKit'

export { PANEL_W, PANEL_H }

const RISE = [
  { o: 0.18, c: 0.24, hi: 0.27, lo: 0.15 },
  { o: 0.24, c: 0.22, hi: 0.28, lo: 0.2 },
  { o: 0.22, c: 0.33, hi: 0.36, lo: 0.21 },
  { o: 0.33, c: 0.41, hi: 0.44, lo: 0.31 },
  { o: 0.41, c: 0.39, hi: 0.46, lo: 0.36 },
  { o: 0.39, c: 0.52, hi: 0.55, lo: 0.38 },
  { o: 0.52, c: 0.63, hi: 0.67, lo: 0.5 },
  { o: 0.63, c: 0.61, hi: 0.69, lo: 0.58 },
  { o: 0.61, c: 0.74, hi: 0.78, lo: 0.6 },
  { o: 0.74, c: 0.83, hi: 0.88, lo: 0.72 },
]

const CRASH = [
  { o: 0.83, c: 0.86, hi: 0.9, lo: 0.82 },
  { o: 0.86, c: 0.78, hi: 0.87, lo: 0.76 },
  { o: 0.78, c: 0.6, hi: 0.79, lo: 0.57 },
  { o: 0.6, c: 0.63, hi: 0.66, lo: 0.55 },
  { o: 0.63, c: 0.4, hi: 0.64, lo: 0.36 },
  { o: 0.4, c: 0.28, hi: 0.42, lo: 0.22 },
  { o: 0.28, c: 0.3, hi: 0.34, lo: 0.24 },
  { o: 0.3, c: 0.14, hi: 0.31, lo: 0.1 },
  { o: 0.14, c: 0.07, hi: 0.16, lo: 0.04 },
  { o: 0.07, c: 0.03, hi: 0.08, lo: 0.02 },
]

// ============================================================================
// PANELS
// ============================================================================

// 1. The dorm room at night. Establishes who he is before anything happens.
function dorm(ctx, t) {
  bg(ctx, '#0a0b16')
  // back wall + window. The skyline is drawn full-width by design, so it
  // MUST be clipped to the window rect - without the clip its lit windows
  // scatter across the bedroom wall as free-floating yellow dots.
  r(ctx, 0, 0, PANEL_W, 200, '#12132247')
  r(ctx, 28, 26, 150, 96, '#070812')
  ctx.save()
  ctx.beginPath()
  ctx.rect(28, 26, 150, 96)
  ctx.clip()
  skyline(ctx, 122, 11, '#0d0e1c', '#e8c96a', 0.18)
  ctx.restore()
  r(ctx, 28, 26, 150, 96, 'rgba(40,60,120,0.18)')
  // window frame
  r(ctx, 26, 24, 154, 3, C.line)
  r(ctx, 26, 119, 154, 3, C.line)
  r(ctx, 26, 24, 3, 98, C.line)
  r(ctx, 177, 24, 3, 98, C.line)
  r(ctx, 101, 24, 2, 98, C.line)
  // poster
  r(ctx, 300, 34, 62, 78, '#1a1b30')
  r(ctx, 303, 37, 56, 50, '#232447')
  txt(ctx, 'BULL', 331, 92, C.grey, 11, 'center')
  // floor
  r(ctx, 0, 200, PANEL_W, 70, '#0d0e1a')
  // desk
  r(ctx, 150, 186, 230, 8, '#3a2c22')
  r(ctx, 156, 194, 8, 62, '#2a2019')
  r(ctx, 366, 194, 8, 62, '#2a2019')
  // laptop
  const scr = screenFrame(ctx, 236, 138, 76, 46)
  r(ctx, scr.x, scr.y, scr.w, scr.h, '#12203c')
  // a small green chart on the screen, too far away to read. Sits high in
  // the screen so his head (drawn in front, below) never covers it.
  candles(ctx, scr.x + 6, scr.y + 4, 64, 26, RISE.slice(0, 6), 1)
  r(ctx, 228, 184, 92, 5, '#4a4a56')
  glow(ctx, 274, 160, 92, 'rgba(90,170,255,0.5)', 0.5 + Math.sin(t * 3) * 0.04)
  // ramen cup + steam
  r(ctx, 336, 168, 20, 18, '#c8442f')
  r(ctx, 334, 165, 24, 4, '#e8e4d8')
  ctx.globalAlpha = 0.25
  for (let i = 0; i < 3; i += 1) {
    const sy = 160 - ((t * 14 + i * 12) % 34)
    r(ctx, 344 + Math.sin((t + i) * 2) * 4, sy, 2, 5, C.white)
  }
  ctx.globalAlpha = 1
  // book stack
  r(ctx, 168, 176, 44, 4, '#2f4f7a')
  r(ctx, 170, 180, 44, 4, '#6b3550')
  r(ctx, 167, 184, 44, 3, '#3d5f3a')
  // Centred on the laptop and scaled up, so he reads as one hunched
  // silhouette at the screen. Sat lower than the framing alone needs: the
  // character's spiked orange hair is much taller than the art this
  // replaced, and at the old y it covered the chart on the screen.
  drawStudentFromBehind(ctx, 274, 288, 1.4)
  vignette(ctx, 0.62)
  scanlines(ctx)
}

// 2. The ad. Fills the frame with the screen itself - the moment the idea
// gets into him.
function theAd(ctx, t) {
  bg(ctx, '#070810')
  const scr = screenFrame(ctx, 40, 24, 400, 200)
  r(ctx, scr.x, scr.y, scr.w, scr.h, '#0b1226')
  // browser chrome
  r(ctx, scr.x, scr.y, scr.w, 14, '#1b1f38')
  r(ctx, scr.x + 5, scr.y + 4, 6, 6, '#ef4444')
  r(ctx, scr.x + 15, scr.y + 4, 6, 6, '#fbbf24')
  r(ctx, scr.x + 25, scr.y + 4, 6, 6, '#4ade80')
  r(ctx, scr.x + 40, scr.y + 3, 200, 8, '#0d1120')
  txt(ctx, 'why-wait-40-years.io', scr.x + 44, scr.y + 4, C.grey, 7)

  // Rising arrow FIRST - it's backdrop for the pitch. Drawn after the text
  // it cut straight through the "25x" and "LEVERAGE" wordmarks.
  ctx.strokeStyle = C.green
  ctx.lineWidth = 3
  ctx.globalAlpha = 0.55
  ctx.beginPath()
  ctx.moveTo(70, scr.y + 176)
  ctx.lineTo(140, scr.y + 152)
  ctx.lineTo(205, scr.y + 162)
  ctx.lineTo(290, scr.y + 118)
  ctx.lineTo(392, scr.y + 84)
  ctx.stroke()
  r(ctx, 388, scr.y + 80, 10, 10, C.green)
  ctx.globalAlpha = 1

  // the pitch
  const flash = Math.sin(t * 6) > 0
  txt(ctx, 'WHY WAIT 40 YEARS?', 240, scr.y + 30, C.grey, 14, 'center')
  txt(ctx, '25x', 240, scr.y + 52, flash ? C.yellow : '#ffb703', 46, 'center')
  txt(ctx, 'LEVERAGE', 240, scr.y + 104, C.fuchsia, 22, 'center')

  txt(ctx, 'TURN $4,000 INTO $100,000', 240, scr.y + 176, C.green, 12, 'center')
  ctx.globalAlpha = 0.5
  txt(ctx, 'losses may exceed your deposit', 240, scr.y + 190, C.grey, 7, 'center', 'normal')
  ctx.globalAlpha = 1

  glow(ctx, 240, 120, 240, 'rgba(232,121,249,0.35)', 0.4)
  vignette(ctx, 0.6)
  scanlines(ctx)
}

// 3. The first win. Everything green, the number climbing.
function firstWin(ctx, t) {
  bg(ctx, '#07120c')
  const scr = screenFrame(ctx, 30, 20, 420, 210)
  r(ctx, scr.x, scr.y, scr.w, scr.h, '#08150f')
  // grid
  for (let gy = scr.y + 20; gy < scr.y + scr.h; gy += 26) r(ctx, scr.x, gy, scr.w, 1, '#10241a')
  candles(ctx, scr.x + 20, scr.y + 40, 300, 150, RISE, Math.min(1, t / 1.6))
  // portfolio readout - counts up with t
  const val = Math.round(4000 + Math.min(1, t / 1.8) * 7000)
  txt(ctx, 'PORTFOLIO', scr.x + 336, scr.y + 44, C.grey, 9)
  txt(ctx, `$${val.toLocaleString()}`, scr.x + 336, scr.y + 58, C.green, 17)
  txt(ctx, '+175.0%', scr.x + 336, scr.y + 80, C.green, 11)
  txt(ctx, 'LEV  25x', scr.x + 336, scr.y + 104, C.yellow, 10)
  txt(ctx, 'MARGIN', scr.x + 336, scr.y + 122, C.grey, 8)
  r(ctx, scr.x + 336, scr.y + 134, 84, 6, '#12241a')
  r(ctx, scr.x + 336, scr.y + 134, 30, 6, C.green)
  glow(ctx, 200, 130, 220, 'rgba(74,222,128,0.3)', 0.45)
  vignette(ctx, 0.5)
  scanlines(ctx)
}

// 4. All in. The order ticket, every ticker, leverage pinned to the top.
function allIn(ctx, t) {
  bg(ctx, '#0c0a14')
  const scr = screenFrame(ctx, 60, 18, 360, 216)
  r(ctx, scr.x, scr.y, scr.w, scr.h, '#101024')
  txt(ctx, 'ORDER TICKET', scr.x + 16, scr.y + 14, C.cyan, 12)
  r(ctx, scr.x + 16, scr.y + 30, 328, 1, C.line)

  const rows = [
    ['SEMICONDUCTORS', '$18,400'],
    ['AIRLINES', '$12,750'],
    ['LITHIUM ETF', '$9,900'],
    ['$MOONX', '$41,200'],
  ]
  rows.forEach((row, i) => {
    const ry = scr.y + 42 + i * 22
    txt(ctx, row[0], scr.x + 16, ry, C.white, 10)
    txt(ctx, row[1], scr.x + 344, ry, C.yellow, 10, 'right')
  })

  // leverage slider, pinned to max
  txt(ctx, 'LEVERAGE', scr.x + 16, scr.y + 140, C.grey, 9)
  r(ctx, scr.x + 16, scr.y + 154, 328, 8, '#1c1d3a')
  r(ctx, scr.x + 16, scr.y + 154, 328, 8, C.redDim)
  r(ctx, scr.x + 336, scr.y + 150, 8, 16, C.yellow)
  txt(ctx, '25x  MAX', scr.x + 344, scr.y + 168, C.red, 10, 'right')
  txt(ctx, 'BORROWED  $10,082,250', scr.x + 16, scr.y + 168, C.red, 10)

  // confirm button, pulsing
  const pulse = Math.sin(t * 5) * 0.5 + 0.5
  r(ctx, scr.x + 96, scr.y + 186, 168, 22, pulse > 0.5 ? '#b91c1c' : '#7f1d1d')
  txt(ctx, 'CONFIRM  ALL  POSITIONS', scr.x + 180, scr.y + 192, C.white, 10, 'center')

  glow(ctx, 240, 200, 160, 'rgba(239,68,68,0.3)', 0.4)
  vignette(ctx, 0.55)
  scanlines(ctx)
}

// 5. The crash. Same chart, other direction.
function crash(ctx, t) {
  bg(ctx, '#140708')
  const shake = t < 1.2 ? Math.sin(t * 40) * (1.2 - t) * 3 : 0
  ctx.save()
  ctx.translate(shake, 0)
  const scr = screenFrame(ctx, 30, 20, 420, 210)
  r(ctx, scr.x, scr.y, scr.w, scr.h, '#150809')
  for (let gy = scr.y + 20; gy < scr.y + scr.h; gy += 26) r(ctx, scr.x, gy, scr.w, 1, '#2a1013')
  candles(ctx, scr.x + 20, scr.y + 30, 300, 160, CRASH, Math.min(1, t / 1.4))
  txt(ctx, 'PORTFOLIO', scr.x + 336, scr.y + 44, C.grey, 9)
  const val = Math.round(11000 * Math.max(0, 1 - t / 1.4))
  txt(ctx, `$${val.toLocaleString()}`, scr.x + 336, scr.y + 58, C.red, 17)
  txt(ctx, '-100.0%', scr.x + 336, scr.y + 80, C.red, 11)
  txt(ctx, 'MARGIN', scr.x + 336, scr.y + 122, C.grey, 8)
  r(ctx, scr.x + 336, scr.y + 134, 84, 6, '#2a1013')
  r(ctx, scr.x + 336, scr.y + 134, 84 * Math.min(1, t / 1.2), 6, C.red)
  ctx.restore()
  glow(ctx, 200, 150, 240, 'rgba(239,68,68,0.4)', 0.5)
  vignette(ctx, 0.55)
  scanlines(ctx)
}

// 6. The margin call. The number that defines the rest of the game.
function marginCall(ctx, t) {
  const flash = Math.sin(t * 9) > -0.2
  bg(ctx, flash ? '#1c0709' : '#0a0406')
  r(ctx, 0, 0, PANEL_W, PANEL_H, flash ? 'rgba(239,68,68,0.07)' : 'rgba(0,0,0,0)')

  r(ctx, 44, 40, 392, 40, flash ? '#b91c1c' : '#7f1d1d')
  txt(ctx, 'MARGIN CALL', 240, 50, C.white, 26, 'center')

  txt(ctx, 'POSITIONS LIQUIDATED', 240, 96, C.red, 12, 'center')
  txt(ctx, 'ACCOUNT BALANCE', 240, 124, C.grey, 10, 'center')
  txt(ctx, '-$10,000,000', 240, 140, flash ? C.red : '#d13a3a', 36, 'center')

  r(ctx, 100, 194, 280, 1, C.line)
  txt(ctx, 'SETTLEMENT DUE', 240, 204, C.grey, 9, 'center')
  txt(ctx, 'REPAYMENT DEADLINE ENFORCED', 240, 218, C.yellow, 11, 'center')

  glow(ctx, 240, 150, 260, 'rgba(239,68,68,0.5)', flash ? 0.55 : 0.3)
  vignette(ctx, 0.6)
  scanlines(ctx, 0.2)
}

// 7. The father's study. Warm light, cold conversation.
function study(ctx, t) {
  bg(ctx, '#120e0a')
  // wall + bookshelf
  r(ctx, 0, 0, PANEL_W, 206, '#1a140f')
  r(ctx, 22, 26, 150, 180, '#241a12')
  for (let sy = 34; sy < 200; sy += 34) {
    r(ctx, 26, sy + 26, 142, 4, '#3a2a1c')
    for (let bx = 30; bx < 164; bx += 8) {
      const h = 18 + Math.floor(hash(bx * 2.3 + sy) * 8)
      const cols = ['#5b3a2e', '#3f5137', '#3b4668', '#6b4a2a', '#4a3550']
      r(ctx, bx, sy + 26 - h, 6, h, cols[Math.floor(hash(bx + sy * 1.7) * cols.length)])
    }
  }
  // desk lamp glow on the right
  r(ctx, 386, 128, 6, 58, '#2a2a30')
  r(ctx, 370, 116, 38, 14, '#3a3a44')
  glow(ctx, 389, 140, 150, 'rgba(255,190,110,0.55)', 0.55)
  // desk
  r(ctx, 300, 186, 170, 8, '#3a2c22')
  r(ctx, 310, 194, 8, 62, '#2a2019')
  // floor
  r(ctx, 0, 206, PANEL_W, 64, '#15100c')
  r(ctx, 0, 206, PANEL_W, 2, '#241a12')

  // Feet at 246, not 258: the component letterboxes the bottom 6% of the
  // panel (~16px), which was cutting both characters off at the ankle.
  // dir -1 so he points AT his son on the left, not off into empty frame.
  drawFather(ctx, 316, 246, 1, Math.sin(t * 2.2) > -0.4 ? 1 : 0, -1)
  drawStudent(ctx, 168, 246, 0.92, 1)
  vignette(ctx, 0.6)
  scanlines(ctx)
}

// 8. The thousand dollars. A close, quiet, humiliating frame.
function theThousand(ctx, t) {
  bg(ctx, '#140f0a')
  // Same desk lamp as the study panel, one beat later - the faint flicker
  // keeps this otherwise still frame from reading as a frozen screenshot.
  glow(ctx, 240, 90, 200, 'rgba(255,190,110,0.4)', 0.46 + Math.sin(t * 1.7) * 0.05)
  // desk surface filling the lower frame
  r(ctx, 0, 150, PANEL_W, 120, '#4a3728')
  r(ctx, 0, 150, PANEL_W, 4, '#5e4634')
  // wood grain
  for (let i = 0; i < 14; i += 1) {
    const gy = 160 + i * 8
    ctx.globalAlpha = 0.25
    r(ctx, 0, gy, PANEL_W, 1, hash(i) > 0.5 ? '#3d2d21' : '#57402f')
    ctx.globalAlpha = 1
  }
  // Upper half is the dim study behind the desk, so this frame reads as
  // the same room as the argument panel rather than a floating void.
  r(ctx, 0, 0, PANEL_W, 150, '#181009')
  r(ctx, 24, 18, 120, 132, '#241a12')
  for (let sy = 26; sy < 146; sy += 34) {
    r(ctx, 28, sy + 26, 112, 4, '#3a2a1c')
    for (let bx = 32; bx < 136; bx += 8) {
      const h = 16 + Math.floor(hash(bx * 2.3 + sy) * 8)
      const cols = ['#3b2a22', '#2c3428', '#2a3048', '#4a3520', '#33253a']
      r(ctx, bx, sy + 26 - h, 6, h, cols[Math.floor(hash(bx + sy * 1.7) * cols.length)])
    }
  }

  // the bills - a thin stack, deliberately small in a big frame
  for (let i = 0; i < 5; i += 1) {
    const bxo = 176 + i * 2
    const byo = 186 - i * 3
    r(ctx, bxo, byo, 118, 52, i === 4 ? '#7fa06b' : '#638054')
    r(ctx, bxo + 2, byo + 2, 114, 48, i === 4 ? '#8fb079' : '#638054')
  }
  r(ctx, 206, 200, 58, 24, '#6d8c5c')
  txt(ctx, '$1,000', 235, 206, '#22331c', 13, 'center')
  txt(ctx, '100', 186, 192, '#3d5233', 8)
  txt(ctx, '100', 268, 216, '#3d5233', 8)

  // The father's hand, just released and pulling back out of frame. Drawn
  // as sleeve -> forearm -> palm -> four separated fingers; the earlier
  // version was a single skin-coloured slab that read as a wooden plank.
  const pull = Math.min(1, t / 2.2) * 14
  const hx = 300 - pull
  const hy = 96 - pull
  r(ctx, hx + 6, hy - 100, 46, 104, C.dadShirtDark) // sleeve from top of frame
  r(ctx, hx + 4, hy - 6, 50, 14, '#3d2f24') // cuff
  r(ctx, hx, hy + 6, 58, 34, C.skin) // back of the hand
  r(ctx, hx, hy + 34, 58, 6, C.skinDark)
  // fingers, angled down toward the notes with gaps between them
  for (let f = 0; f < 4; f += 1) {
    const fx = hx + 4 + f * 14
    const flen = 26 - Math.abs(f - 1) * 4
    r(ctx, fx, hy + 40, 10, flen, C.skin)
    r(ctx, fx, hy + 40 + flen - 3, 10, 3, C.skinDark)
  }
  // thumb
  r(ctx, hx - 8, hy + 14, 10, 24, C.skin)

  vignette(ctx, 0.65)
  scanlines(ctx)
}

// 9. Dawn over the city. He owes ten million and owns a thousand.
function cityDawn(ctx, t) {
  // Dawn gradient. The warm band has to finish ABOVE the rooflines or the
  // skylines cover it and the whole panel just reads as night - so the
  // orange is packed into 0.45-0.72 (y ~120-195), which is sky.
  const g = ctx.createLinearGradient(0, 0, 0, PANEL_H)
  g.addColorStop(0, '#150f33')
  g.addColorStop(0.3, '#2e1d4a')
  g.addColorStop(0.5, '#6b3a5e')
  g.addColorStop(0.63, '#b25f57')
  g.addColorStop(0.72, '#e0955c')
  g.addColorStop(0.82, '#f0bd77')
  g.addColorStop(1, '#f5d191')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, PANEL_W, PANEL_H)
  // fading stars
  ctx.globalAlpha = 0.5
  for (let i = 0; i < 40; i += 1) {
    const sx = hash(i * 3.1) * PANEL_W
    const sy = hash(i * 7.7) * 90
    if (Math.sin(t * 2 + i) > 0.2) r(ctx, sx, sy, 1, 1, C.white)
  }
  ctx.globalAlpha = 1
  // far skyline, hazy against the sunrise
  skyline(ctx, 208, 31, '#3a2a52', '#f8d97a', 0.1)
  // near skyline, near-silhouette
  skyline(ctx, 232, 77, '#171029', '#ffcf6a', 0.22)
  // neon signs on the near towers
  const neon = Math.sin(t * 3) > -0.5
  r(ctx, 62, 176, 34, 8, neon ? C.fuchsia : '#5d2f63')
  r(ctx, 356, 158, 26, 6, C.cyan)
  glow(ctx, 79, 180, 40, 'rgba(232,121,249,0.6)', neon ? 0.5 : 0.2)
  // street
  r(ctx, 0, 232, PANEL_W, 38, '#100c1a')
  r(ctx, 0, 232, PANEL_W, 2, '#2a2140')
  for (let lx = 10; lx < PANEL_W; lx += 40) r(ctx, lx, 250, 18, 2, '#3a3050')
  // Him: standing (not the seated pose - that drew a chair on the street),
  // back to camera, clear of the letterboxed bottom 16px.
  drawStudentBackStanding(ctx, 240, 250, 1)
  vignette(ctx, 0.5)
  scanlines(ctx)
}

// Keyed by the `panel` field in introCutsceneScript.js. A missing key is a
// script/art mismatch, so IntroCutscene.jsx falls back to a flat fill
// rather than throwing mid-cutscene.
export const PANELS = {
  dorm,
  theAd,
  firstWin,
  allIn,
  crash,
  marginCall,
  study,
  theThousand,
  cityDawn,
}

export function paintPanel(ctx, key, t) {
  const painter = PANELS[key]
  if (!painter) {
    bg(ctx, C.deep)
    return
  }
  painter(ctx, t)
}
