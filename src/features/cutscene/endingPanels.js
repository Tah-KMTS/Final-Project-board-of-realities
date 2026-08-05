// The five panels of the ENDING cutscene, played the moment the HUD cash
// figure reaches $10,000,000 (see endingCutsceneScript.js, EndingCutscene.jsx
// and the cash watcher in WorldScreen.jsx). Deliberate visual answers to the
// opening: the same terminal that said MARGIN CALL now says PAID IN FULL,
// the same study has the lamp on and nobody shouting, and the same kind of
// chart is drawn slow and unlevered instead of 25x.
//
// Palette, primitives, figures and set dressing come from panelKit.js - see
// that file's header for the (ctx, t) drawing contract these follow.

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
  screenFrame,
  bookshelf,
  drawStudent,
  drawStudentFromBehind,
  drawStudentBackStanding,
  drawFather,
} from './panelKit'

// A smooth compounding curve - the anti-candlestick. Drawn as a polyline
// rather than candles precisely because it should read as boring and slow
// next to the opening's 25x chart.
function compoundCurve(ctx, x, y, w, h, reveal = 1, color = C.green) {
  const pts = 40
  const upto = Math.max(2, Math.floor(pts * reveal))
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let i = 0; i < upto; i += 1) {
    const f = i / (pts - 1)
    // gentle exponential with a little noise, never more than a wobble
    const v = Math.pow(f, 1.7) * 0.86 + 0.06 + Math.sin(f * 9) * 0.012
    const px = x + f * w
    const py = y + h - v * h
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
}

// ============================================================================
// PANELS
// ============================================================================

// 1. The settlement terminal. Same screen that delivered the margin call.
function settlement(ctx, t) {
  bg(ctx, '#06120c')
  const scr = screenFrame(ctx, 40, 22, 400, 204)
  r(ctx, scr.x, scr.y, scr.w, scr.h, '#07160f')

  txt(ctx, 'SETTLEMENT', 240, scr.y + 14, C.grey, 11, 'center')
  r(ctx, scr.x + 40, scr.y + 32, 320, 1, C.line)

  txt(ctx, 'OUTSTANDING BALANCE', 240, scr.y + 42, C.grey, 9, 'center')

  // Balance counts up from -10,000,000 to 0 over the first ~2.4s, then holds.
  const f = Math.min(1, t / 2.4)
  const bal = Math.round(-10000000 * (1 - f))
  const cleared = f >= 1
  const shown = bal === 0 ? '$0' : `-$${Math.abs(bal).toLocaleString()}`
  txt(ctx, shown, 240, scr.y + 56, cleared ? C.green : C.red, 30, 'center')

  // transfer progress
  txt(ctx, 'TRANSFER  $10,000,000', 240, scr.y + 100, C.grey, 9, 'center')
  r(ctx, scr.x + 60, scr.y + 114, 280, 8, '#0d2318')
  r(ctx, scr.x + 60, scr.y + 114, 280 * f, 8, C.green)
  txt(ctx, `${Math.round(f * 100)}%`, 240, scr.y + 126, C.green, 9, 'center')

  // PAID IN FULL stamp, once the balance lands
  if (cleared) {
    const pop = Math.min(1, (t - 2.4) / 0.35)
    const bw = 236 * pop
    const bx = 240 - bw / 2
    r(ctx, bx, scr.y + 146, bw, 34, '#0c2a1a')
    r(ctx, bx, scr.y + 146, bw, 2, C.green)
    r(ctx, bx, scr.y + 178, bw, 2, C.green)
    r(ctx, bx, scr.y + 146, 2, 34, C.green)
    r(ctx, bx + bw - 2, scr.y + 146, 2, 34, C.green)
    if (pop >= 1) txt(ctx, 'PAID IN FULL', 240, scr.y + 155, C.green, 20, 'center')
  }

  glow(ctx, 240, 130, 240, 'rgba(74,222,128,0.35)', cleared ? 0.5 : 0.28)
  vignette(ctx, 0.5)
  scanlines(ctx)
}

// 2. The study again - warm lamp, no shouting. Mirror of the opening's
//    argument panel, same room, same blocking, opposite temperature.
function homecoming(ctx, t) {
  bg(ctx, '#191108')
  r(ctx, 0, 0, PANEL_W, 206, '#241a10')
  bookshelf(ctx, 22, 26, 150, 180, false)

  // desk lamp, brighter than in the argument scene
  r(ctx, 386, 128, 6, 58, '#2a2a30')
  r(ctx, 370, 116, 38, 14, '#3a3a44')
  glow(ctx, 389, 140, 190, 'rgba(255,205,130,0.6)', 0.62 + Math.sin(t * 1.6) * 0.03)

  // desk
  r(ctx, 300, 186, 170, 8, '#4a3628')
  r(ctx, 310, 194, 8, 62, '#33251b')
  // floor
  r(ctx, 0, 206, PANEL_W, 64, '#1d1409')
  r(ctx, 0, 206, PANEL_W, 2, '#33251b')

  // Standing closer together than in the argument (168/316 there): the gap
  // closing is the whole point of the shot.
  drawFather(ctx, 288, 246, 1, 0, -1, 'warm')
  drawStudent(ctx, 196, 246, 0.92, 0)

  vignette(ctx, 0.5)
  scanlines(ctx)
}

// 3. The lecture hall, seen from the back rows. He's in the middle of it,
//    one student among many, which is the point.
function lecture(ctx, t) {
  bg(ctx, '#101427')
  // front wall + whiteboard
  r(ctx, 0, 0, PANEL_W, 150, '#1b2038')
  r(ctx, 96, 20, 288, 104, '#e8e6dc')
  r(ctx, 96, 20, 288, 4, '#b9b7ad')
  txt(ctx, 'RISK  &  TIME', 240, 30, '#2b3550', 13, 'center')
  // a slow curve and some labels on the board
  compoundCurve(ctx, 118, 52, 150, 58, 1, '#2f7d4f')
  r(ctx, 118, 110, 150, 1, '#8b8ba7')
  txt(ctx, 'COMPOUND', 300, 60, '#2b3550', 9)
  txt(ctx, 'DIVERSIFY', 300, 76, '#2b3550', 9)
  txt(ctx, 'NEVER 25x', 300, 92, '#a33', 9)
  glow(ctx, 240, 70, 190, 'rgba(230,230,210,0.28)', 0.35)

  // Lecturer beside the board, gently shifting weight. Drawn as an actual
  // little figure - as three stacked boxes they read as furniture.
  const sway = Math.round(Math.sin(t * 1.4) * 2)
  const lx = 60 + sway
  r(ctx, lx - 6, 128, 5, 22, '#2b3048') // legs
  r(ctx, lx + 1, 128, 5, 22, '#2b3048')
  r(ctx, lx - 7, 148, 6, 3, '#1a1d2c') // shoes
  r(ctx, lx + 1, 148, 6, 3, '#1a1d2c')
  r(ctx, lx - 8, 104, 16, 26, '#46557d') // torso
  r(ctx, lx - 8, 104, 5, 26, '#36436a')
  r(ctx, lx - 11, 106, 3, 17, '#36436a') // arms
  r(ctx, lx + 8, 106, 3, 14, '#36436a')
  r(ctx, lx + 8, 100, 3, 8, C.skin) // raised arm, gesturing at the board
  r(ctx, lx - 11, 122, 3, 4, C.skin)
  r(ctx, lx - 5, 90, 11, 13, C.skin) // head
  r(ctx, lx - 5, 90, 3, 13, C.skinDark)
  r(ctx, lx - 6, 87, 13, 5, '#43424e') // hair
  r(ctx, lx - 3, 95, 2, 2, '#2a2420') // eyes
  r(ctx, lx + 2, 95, 2, 2, '#2a2420')

  // tiered rows of desks, receding upward. Nearer rows are wider/darker.
  const rows = [
    { y: 150, h: 16, dx: 0, seatW: 26, color: '#2a2f4a' },
    { y: 178, h: 18, dx: -8, seatW: 30, color: '#242942' },
    { y: 210, h: 20, dx: -18, seatW: 34, color: '#1e2339' },
  ]
  rows.forEach((row, ri) => {
    // heads sitting behind this row's desk
    for (let i = 0; i < 9; i += 1) {
      const hx = 44 + row.dx + i * (row.seatW + 14)
      if (hx < -10 || hx > PANEL_W) continue
      // the player sits in the middle of the second row
      const isPlayer = ri === 1 && i === 4
      const hw = 14 + ri * 2
      const hh = 12 + ri * 2
      // Classmates need to sit clearly ABOVE the wall tone (#1b2038) or the
      // back rows disappear and the hall reads as empty.
      const hairCols = ['#6b5a4a', '#4a4657', '#5c4740', '#454b60', '#6a5568']
      const hairCol = hairCols[Math.floor(hash(ri * 7.3 + i * 2.1) * hairCols.length)]
      r(ctx, hx, row.y - hh - 2, hw, hh, isPlayer ? C.hair : hairCol)
      // top-light rim so each head separates from the one behind it
      r(ctx, hx, row.y - hh - 2, hw, 2, isPlayer ? C.hairDark : '#8a7f92')
      if (isPlayer) {
        r(ctx, hx + 2, row.y - hh - 5, 3, 3, C.hair)
        r(ctx, hx + 8, row.y - hh - 6, 3, 4, C.hair)
      }
      // shoulders
      r(ctx, hx - 3, row.y - 4, hw + 6, 6, isPlayer ? C.shirt : '#39405c')
    }
    // the desk bar itself, drawn over the shoulders
    r(ctx, -20, row.y, PANEL_W + 40, row.h, row.color)
    r(ctx, -20, row.y, PANEL_W + 40, 2, '#3a4166')
  })

  // His open notebook, on HIS desk (row 2, directly under where he's
  // drawn) rather than floating in the aisle below the front row.
  r(ctx, 190, 179, 44, 15, '#e8e4d8')
  r(ctx, 211, 179, 2, 15, '#b9b5aa')
  for (let i = 0; i < 3; i += 1) {
    r(ctx, 194, 182 + i * 4, 13, 1, '#6b7280')
    r(ctx, 216, 182 + i * 4, 13, 1, '#6b7280')
  }

  vignette(ctx, 0.5)
  scanlines(ctx)
}

// 4. Studying it properly this time. Same over-the-shoulder framing as the
//    opening's dorm panel - the screen is what changed, not the person.
function studyingRight(ctx, t) {
  bg(ctx, '#0d1018')
  r(ctx, 0, 0, PANEL_W, 200, '#151a28')
  bookshelf(ctx, 300, 18, 160, 168, true)

  // desk lamp
  r(ctx, 92, 120, 5, 66, '#2a2a30')
  r(ctx, 76, 108, 38, 14, '#3a3a44')
  glow(ctx, 95, 132, 160, 'rgba(255,214,150,0.5)', 0.5)

  // desk
  r(ctx, 40, 186, 300, 8, '#3a2c22')
  r(ctx, 48, 194, 8, 62, '#2a2019')

  // laptop with the slow curve
  const scr = screenFrame(ctx, 196, 132, 100, 52)
  r(ctx, scr.x, scr.y, scr.w, scr.h, '#0a1a12')
  compoundCurve(ctx, scr.x + 6, scr.y + 6, 62, 38, Math.min(1, t / 1.8))
  txt(ctx, '1.0x', scr.x + 74, scr.y + 10, C.green, 9)
  txt(ctx, 'NO LEV', scr.x + 74, scr.y + 22, C.grey, 7)
  txt(ctx, '+7.2%', scr.x + 74, scr.y + 34, C.green, 8)
  r(ctx, 188, 184, 116, 5, '#4a4a56')
  glow(ctx, 246, 152, 90, 'rgba(90,200,140,0.35)', 0.4)

  // open textbook + notebook on the desk, lit by the lamp
  r(ctx, 66, 168, 62, 20, '#e8e4d8')
  r(ctx, 96, 168, 2, 20, '#b9b5aa')
  for (let i = 0; i < 3; i += 1) {
    r(ctx, 70, 173 + i * 5, 22, 1, '#8b8ba7')
    r(ctx, 101, 173 + i * 5, 22, 1, '#8b8ba7')
  }
  r(ctx, 140, 174, 34, 14, '#d8d4c6')

  // him, seated, calm
  drawStudentFromBehind(ctx, 246, 267, 1.5)
  vignette(ctx, 0.55)
  scanlines(ctx)
}

// 5. Morning on the way to class. The city that ate him is just scenery now.
function campusMorning(ctx, t) {
  // Morning, and it has to read as morning at a glance. The earlier top
  // stop (#2b4a86) was dark enough that the panel scanned as night, since
  // everything below 0.66 - where the warm light lived - is covered by the
  // campus building and the ground.
  const g = ctx.createLinearGradient(0, 0, 0, PANEL_H)
  g.addColorStop(0, '#5b8fd0')
  g.addColorStop(0.34, '#9dc0e4')
  g.addColorStop(0.56, '#d5d5c4')
  g.addColorStop(0.74, '#f0dcae')
  g.addColorStop(1, '#f8ebc8')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, PANEL_W, PANEL_H)

  // sun
  glow(ctx, 372, 96, 90, 'rgba(255,236,180,0.85)', 0.6)
  r(ctx, 364, 88, 16, 16, '#fff3cf')

  // distant city - the skyline from the opening, now far away and hazy.
  // Darkened against the lighter sky so it still separates from it.
  skyline(ctx, 186, 77, '#7789b3', '#fdf6dc', 0.05)

  // campus building nearer, warm stone
  r(ctx, 40, 132, 180, 74, '#c9b48f')
  r(ctx, 40, 132, 180, 4, '#e0cba4')
  for (let wx = 52; wx < 210; wx += 22) {
    r(ctx, wx, 146, 12, 18, '#5c6c8a')
    r(ctx, wx, 174, 12, 18, '#5c6c8a')
  }
  // pediment + columns over the entrance
  r(ctx, 96, 118, 68, 16, '#d6c19c')
  for (let cx = 104; cx < 160; cx += 14) r(ctx, cx, 134, 6, 72, '#e0cba4')

  // trees
  for (let i = 0; i < 3; i += 1) {
    const tx = 250 + i * 62
    r(ctx, tx + 6, 178, 6, 28, '#5c4630')
    r(ctx, tx - 6, 150, 30, 30, '#3f6b3a')
    r(ctx, tx - 2, 142, 22, 14, '#4a7d43')
  }

  // ground + path
  r(ctx, 0, 206, PANEL_W, 64, '#5d7a49')
  r(ctx, 0, 206, PANEL_W, 2, '#6f8f57')
  ctx.fillStyle = '#c9b899'
  ctx.beginPath()
  ctx.moveTo(196, 206)
  ctx.lineTo(268, 206)
  ctx.lineTo(320, 270)
  ctx.lineTo(150, 270)
  ctx.closePath()
  ctx.fill()

  // him, walking away up the path - a slow bob so the frame isn't static
  const bob = Math.round(Math.sin(t * 2.6) * 1.5)
  drawStudentBackStanding(ctx, 236, 250 + bob, 1)

  vignette(ctx, 0.4)
  scanlines(ctx)
}

// Keyed by the `panel` field in endingCutsceneScript.js. A missing key is a
// script/art mismatch, so the player falls back to a flat fill rather than
// throwing mid-cutscene.
export const ENDING_PANELS = {
  settlement,
  homecoming,
  lecture,
  studyingRight,
  campusMorning,
}

export function paintEndingPanel(ctx, key, t) {
  const painter = ENDING_PANELS[key]
  if (!painter) {
    bg(ctx, C.deep)
    return
  }
  painter(ctx, t)
}
