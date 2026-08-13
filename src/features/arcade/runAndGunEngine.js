import {
  VIEW_W, TILE, PLAYER_ANIM, POSE_CROUCH, POSE_PRONE,
  // SHEETS is imported for its frame COUNTS only (an explosion lives as many
  // steps as its sheet has frames) - never for the images themselves, which
  // is the modal's business. Keeping the count here rather than duplicating
  // it as a constant means the two can't drift if the sheet is ever swapped.
  SHEETS, ENEMY_ANIM, BALANCE as B, LEVELS,
// Extension is explicit (unlike most imports in this codebase, where Vite
// resolves it) so that plain Node can load this module - which is what lets
// production/simulateRunNGun.mjs play the game headlessly.
} from './runAndGunLevels.js'

// Pure simulation for the Third Rail arcade cabinet - no React, no DOM, no
// canvas. RunAndGunModal.jsx owns rendering and input; everything that
// decides what the world DOES lives here.
//
// Split out for the same reason ddmEngine.js / romanceEngine.js are, plus one
// specific to this cabinet: a game loop welded to requestAnimationFrame can
// only be tested by looking at it, and rAF does not run in a headless or
// backgrounded context. With the simulation importable on its own,
// production/simulateRunNGun.mjs can play thousands of frames in Node and
// assert that the player actually traverses a level, that enemies die, and
// that the boss fight terminates - none of which a screenshot proves.
//
// Sound is injected rather than imported so this file stays DOM-free; the
// modal passes the real sfx functions, the headless harness passes no-ops.
const SILENT = { shoot() {}, hit() {}, hurt() {}, die() {}, boom() {}, win() {} }

// Sprite frames are 45x45 but the character inside one only occupies a narrow
// column of that, so the collision body is hand-fitted rather than taken from
// the frame size - a 45-wide body would visibly collide with walls a full
// tile before touching them. FOOT is where the feet sit inside the frame,
// used to line the sprite up with the bottom of its body.
export const PLAYER = { w: 16, h: 34, crouchH: 22, foot: 42 }
export const ENEMY_BODY = {
  ar: { w: 14, h: 30, foot: 36 },
  sniper: { w: 16, h: 32, foot: 40 },
  rpg: { w: 18, h: 32, foot: 40 },
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
export const rectsOverlap = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

// --- world construction ----------------------------------------------------
function buildLevel(index) {
  const def = LEVELS[index]
  const solids = def.solids.map((s) => ({
    x: s.c * TILE, y: s.r * TILE, w: s.w * TILE, h: s.h * TILE,
  }))
  const enemies = def.enemies.map((e) => spawnEnemy(e.type, e.c, e.r))
  if (def.boss) enemies.push(spawnBoss(def.boss.c, def.boss.r))
  return {
    def,
    solids,
    enemies,
    props: def.props,
    worldW: def.widthTiles * TILE,
    worldH: def.heightTiles * TILE,
  }
}

function spawnEnemy(type, c, r) {
  const body = ENEMY_BODY[type]
  const hp = { ar: B.AR_HP, sniper: B.SNIPER_HP, rpg: B.RPG_HP }[type]
  return {
    type, boss: false,
    x: c * TILE, y: (r + 1) * TILE - body.h,
    w: body.w, h: body.h, foot: body.foot,
    vx: 0, vy: 0,
    hp, maxHp: hp,
    face: -1,
    cool: Math.floor(Math.random() * 60), // stagger so a cluster never fires in unison
    telegraph: 0,
    dying: 0,
    anim: 0,
    scale: 1,
  }
}

function spawnBoss(c, r) {
  const body = ENEMY_BODY.rpg
  const S = B.BOSS_SCALE
  return {
    type: 'rpg', boss: true,
    x: c * TILE, y: (r + 1) * TILE - body.h * S,
    w: body.w * S, h: body.h * S, foot: body.foot,
    vx: 0, vy: 0,
    hp: B.BOSS_HP, maxHp: B.BOSS_HP,
    face: -1,
    cool: 90,
    telegraph: 0,
    dying: 0,
    anim: 0,
    scale: S,
    salvo: 0,
    salvoGap: 0,
    driftDir: -1,
  }
}

export function createGame(levelIndex, carry, sfx = SILENT) {
  const level = buildLevel(levelIndex)
  return {
    sfx,
    level,
    levelIndex,
    cam: 0,
    player: {
      x: 3 * TILE, y: 14 * TILE - PLAYER.h,
      vx: 0, vy: 0,
      w: PLAYER.w, h: PLAYER.h,
      face: 1,
      grounded: false,
      crouch: false,
      prone: false,
      hp: carry?.hp ?? B.PLAYER_HP,
      iframes: 0,
      cool: 0,
      anim: 0,
      dead: 0,
    },
    lives: carry?.lives ?? B.PLAYER_LIVES,
    score: carry?.score ?? 0,
    tookDamage: carry?.tookDamage ?? false,
    bullets: [],
    booms: [],
    phase: 'play', // 'play' | 'levelClear' | 'dead' | 'over' | 'won'
    phaseTimer: 0,
    checkpointX: 3 * TILE,
  }
}

// --- collision -------------------------------------------------------------
// Swept one axis at a time: move on X and push out of anything hit, then the
// same on Y. Resolving both at once is what produces the classic "catches on
// a seam between two floor tiles while running" bug, and doing X first means
// a body that is exactly floor-height never snags on the corner of the next
// platform along.
function moveBody(body, solids, worldW) {
  body.x += body.vx
  for (const s of solids) {
    if (!rectsOverlap(body, s)) continue
    if (body.vx > 0) body.x = s.x - body.w
    else if (body.vx < 0) body.x = s.x + s.w
    body.vx = 0
  }
  body.x = clamp(body.x, 0, worldW - body.w)

  body.y += body.vy
  let grounded = false
  for (const s of solids) {
    if (!rectsOverlap(body, s)) continue
    if (body.vy > 0) { body.y = s.y - body.h; grounded = true }
    else if (body.vy < 0) body.y = s.y + s.h
    body.vy = 0
  }
  return grounded
}

// --- projectiles -----------------------------------------------------------
function addBullet(g, opts) {
  g.bullets.push({
    x: opts.x, y: opts.y, vx: opts.vx, vy: opts.vy,
    w: opts.w ?? 6, h: opts.h ?? 6,
    hostile: opts.hostile,
    dmg: opts.dmg ?? 1,
    kind: opts.kind ?? 'bullet', // 'bullet' | 'rocket'
    life: opts.life ?? 240,
    sprite: opts.sprite ?? null,
  })
}

function addBoom(g, x, y, scale = 1) {
  g.booms.push({ x, y, t: 0, scale })
}

// --- player ----------------------------------------------------------------
// Contra's aiming rules: Up alone shoots straight up, Up + a direction shoots
// the 45-degree diagonal, Down only aims downward while airborne (on the
// ground it means crouch instead). Returns a unit-ish vector.
export function aimVector(input, p) {
  const airborne = !p.grounded
  if (input.up && (input.left || input.right)) return { x: p.face * 0.7071, y: -0.7071 }
  if (input.up) return { x: 0, y: -1 }
  if (input.down && airborne && (input.left || input.right)) return { x: p.face * 0.7071, y: 0.7071 }
  if (input.down && airborne) return { x: 0, y: 1 }
  return { x: p.face, y: 0 }
}

export function playerAnimFrame(p, input, firing) {
  if (p.dead > 0) {
    const a = PLAYER_ANIM.death
    return a[Math.min(a.length - 1, Math.floor(p.dead / 8))]
  }
  if (p.prone) return { pose: POSE_PRONE }
  if (p.crouch) return { pose: POSE_CROUCH }
  const moving = input.left || input.right
  if (!p.grounded) {
    if (firing && input.down) return PLAYER_ANIM.shootDown[Math.floor(p.anim / 4) % 2]
    if (firing && input.up) return PLAYER_ANIM.shootUp[Math.floor(p.anim / 4) % 2]
    return PLAYER_ANIM.jump[0]
  }
  if (moving) {
    const set = firing ? (input.up ? PLAYER_ANIM.runShootUp : PLAYER_ANIM.runShoot) : PLAYER_ANIM.run
    return set[Math.floor(p.anim / 4) % set.length]
  }
  if (firing) {
    const set = input.up ? PLAYER_ANIM.shootUp : PLAYER_ANIM.shoot
    return set[Math.floor(p.anim / 6) % set.length]
  }
  return PLAYER_ANIM.idle[Math.floor(p.anim / 10) % PLAYER_ANIM.idle.length]
}

function updatePlayer(g, input) {
  const p = g.player
  p.anim += 1

  if (p.dead > 0) {
    p.dead += 1
    p.vy = Math.min(p.vy + B.GRAVITY, B.MAX_FALL)
    moveBody(p, g.level.solids, g.level.worldW)
    if (p.dead > 70) respawn(g)
    return
  }

  if (p.iframes > 0) p.iframes -= 1
  if (p.cool > 0) p.cool -= 1

  // Crouch and prone are ground-only. Prone (Down held while already
  // crouching is not a separate input - holding Down + the run key stays
  // crouched) is reached by holding Down while standing still.
  p.crouch = p.grounded && input.down && !input.up
  p.prone = p.crouch && !input.left && !input.right && input.down
  const targetH = p.crouch ? PLAYER.crouchH : PLAYER.h
  if (targetH !== p.h) {
    // Grow/shrink from the feet so changing stance never shoves the body
    // into the floor.
    p.y += p.h - targetH
    p.h = targetH
  }

  if (!p.crouch) {
    if (input.left) { p.vx = -B.RUN_SPEED; p.face = -1 }
    else if (input.right) { p.vx = B.RUN_SPEED; p.face = 1 }
    else p.vx = 0
  } else {
    p.vx = 0
  }

  if (input.jump && p.grounded && !p.crouch) {
    p.vy = B.JUMP_V
    p.grounded = false
    p.jumpHeld = true
  }
  // Variable jump height: letting go on the way up cuts the rest of the rise.
  if (p.jumpHeld && !input.jump) {
    if (p.vy < 0) p.vy *= B.JUMP_CUTOFF
    p.jumpHeld = false
  }

  p.vy = Math.min(p.vy + B.GRAVITY, B.MAX_FALL)
  p.grounded = moveBody(p, g.level.solids, g.level.worldW)

  // Pits. The level is exactly one screen tall, so anything past the bottom
  // is a fall, not a lower floor.
  if (p.y > g.level.worldH + 40) {
    p.hp = 0
    killPlayer(g)
    return
  }

  const firing = input.fire && p.cool <= 0 && !p.prone
  if (firing) {
    const a = aimVector(input, p)
    const muzzleY = p.y + (p.crouch ? p.h * 0.4 : p.h * 0.32)
    addBullet(g, {
      x: p.x + p.w / 2 + a.x * 12 - 3,
      y: muzzleY + a.y * 8,
      vx: a.x * B.BULLET_SPEED,
      vy: a.y * B.BULLET_SPEED,
      hostile: false,
    })
    p.cool = B.FIRE_COOLDOWN
    g.sfx.shoot()
  }

  // Checkpoint trails the player so a respawn never drops them into the pit
  // they just fell in, or on top of the enemy that just killed them.
  if (p.grounded && p.x > g.checkpointX) g.checkpointX = p.x
}

function damagePlayer(g, amount, fromX = null) {
  const p = g.player
  if (p.iframes > 0 || p.dead > 0) return
  p.hp -= amount
  p.iframes = B.IFRAMES
  g.tookDamage = true
  // Knock back away from the source - physically breaks contact with
  // whatever just hit you instead of leaving you standing in it.
  if (fromX !== null) p.x += (p.x + p.w / 2 < fromX ? -1 : 1) * B.KNOCKBACK
  if (p.hp <= 0) killPlayer(g)
  else g.sfx.hurt()
}

function killPlayer(g) {
  const p = g.player
  if (p.dead > 0) return
  p.dead = 1
  p.vy = -4
  p.vx = 0
  g.sfx.die()
}

function respawn(g) {
  g.lives -= 1
  if (g.lives <= 0) {
    g.phase = 'over'
    g.phaseTimer = 0
    return
  }
  const p = g.player
  // Respawn has to land on real floor, every time. Backing up 40px from the
  // checkpoint can easily put the player over the pit they just died in, and
  // the two obvious shortcuts both fail badly:
  //   - defaulting y to 0 when nothing is underneath drops them straight back
  //     into the void, which kills them again on landing and burns every
  //     remaining life in a loop (observed: 99 lives gone in 185 seconds);
  //   - picking the solid with the SMALLEST y puts them on the highest
  //     floating platform above that column instead of the ground.
  // So: prefer the lowest solid actually under the target x, and if the
  // column is empty, fall back to the nearest solid anywhere and stand them
  // on the middle of it.
  const wanted = clamp(g.checkpointX - 40, 0, g.level.worldW - p.w)
  const under = g.level.solids
    .filter((s) => wanted + p.w > s.x && wanted < s.x + s.w)
    .sort((a, b) => b.y - a.y)[0]
  if (under) {
    p.x = wanted
    p.y = under.y - p.h
  } else {
    const nearest = g.level.solids
      .slice()
      .sort((a, b) => Math.abs(a.x + a.w / 2 - wanted) - Math.abs(b.x + b.w / 2 - wanted))[0]
    p.x = clamp(nearest.x + nearest.w / 2 - p.w / 2, 0, g.level.worldW - p.w)
    p.y = nearest.y - p.h
  }
  // Pull the checkpoint back to wherever they actually landed, so a
  // checkpoint stranded over a pit can't keep re-proposing the same bad spot.
  g.checkpointX = p.x
  p.vx = 0; p.vy = 0
  p.hp = B.PLAYER_HP
  p.dead = 0
  p.iframes = B.RESPAWN_IFRAMES
  p.h = PLAYER.h
}

// --- enemies ---------------------------------------------------------------
function updateEnemy(g, en) {
  const p = g.player
  en.anim += 1

  if (en.dying > 0) {
    en.dying += 1
    return
  }

  const dx = (p.x + p.w / 2) - (en.x + en.w / 2)
  const dy = (p.y + p.h / 2) - (en.y + en.h / 2)
  const dist = Math.abs(dx)
  en.face = dx < 0 ? -1 : 1
  if (en.cool > 0) en.cool -= 1

  // Off-camera enemies are frozen. Without this the whole level's worth of
  // soldiers walk toward the player's spawn while level 1 is still loading
  // and arrive as one unfightable crowd.
  const onCamera = en.x + en.w > g.cam - 60 && en.x < g.cam + VIEW_W + 60
  if (!onCamera) return

  if (en.boss) { updateBoss(g, en, dx); return }

  if (en.type === 'ar') {
    if (dist < B.AR_RANGE && dist > 40) en.vx = en.face * B.AR_SPEED
    else en.vx = 0
    en.vy = Math.min(en.vy + B.GRAVITY, B.MAX_FALL)
    moveBody(en, g.level.solids, g.level.worldW)
    // Troopers walk toward the player with no ledge detection, so one can
    // chase you off the lip of a pit. Without this it then falls forever -
    // still counted as a live enemy, still updated every frame, y climbing
    // without bound (observed: 13,953 and rising). Drop it from the level
    // instead, and award nothing, since the player didn't kill it.
    if (en.y > g.level.worldH + 40) { en.gone = true; return }
    if (dist < B.AR_RANGE && en.cool <= 0) {
      const up = dy < -30
      addBullet(g, {
        x: en.x + en.w / 2, y: en.y + en.h * 0.35,
        vx: up ? 0 : en.face * B.AR_BULLET_SPEED,
        vy: up ? -B.AR_BULLET_SPEED : 0,
        hostile: true, dmg: B.AR_DMG,
        sprite: { sheet: 'ar', frame: ENEMY_ANIM.ar.bullet },
      })
      en.cool = B.AR_FIRE_EVERY
    }
    return
  }

  if (en.type === 'sniper') {
    if (dist < B.SNIPER_RANGE) {
      if (en.telegraph > 0) {
        en.telegraph -= 1
        if (en.telegraph === 0) {
          // Aimed at where the player IS when the shot goes off, not where
          // they were when the wind-up started - so standing still through
          // the telegraph is what gets punished, and moving beats it.
          const len = Math.hypot(dx, dy) || 1
          addBullet(g, {
            x: en.x + en.w / 2, y: en.y + en.h * 0.3,
            vx: (dx / len) * B.SNIPER_BULLET_SPEED,
            vy: (dy / len) * B.SNIPER_BULLET_SPEED,
            hostile: true, dmg: B.SNIPER_DMG,
            sprite: { sheet: 'sniper', frame: ENEMY_ANIM.sniper.bullet },
          })
          en.cool = B.SNIPER_FIRE_EVERY
        }
      } else if (en.cool <= 0) {
        en.telegraph = B.SNIPER_TELEGRAPH
      }
    } else if (en.telegraph > 0) {
      // Player broke line of sight mid-wind-up. Reset rather than freeze the
      // countdown: a paused telegraph resumes the instant they step back
      // into range and fires with almost no visible tell, which breaks the
      // "this shot is always dodgeable if you're watching" contract that is
      // the entire point of this enemy.
      en.telegraph = 0
      en.cool = B.SNIPER_FIRE_EVERY / 2
    }
    return
  }

  if (en.type === 'rpg') {
    if (dist < B.RPG_RANGE && en.cool <= 0) {
      fireRocket(g, en, en.face * B.RPG_BULLET_SPEED, B.RPG_ARC)
      en.cool = B.RPG_FIRE_EVERY
    }
  }
}

function fireRocket(g, en, vx, vy) {
  addBullet(g, {
    x: en.x + en.w / 2, y: en.y + en.h * 0.3,
    vx, vy, w: 10, h: 10,
    hostile: true, kind: 'rocket', dmg: B.RPG_DMG,
    sprite: { sheet: 'rpg', frame: ENEMY_ANIM.rpg.bullet },
  })
}

function bossPhase(en) {
  const frac = en.hp / en.maxHp
  return B.BOSS_PHASES.find((ph) => frac > ph.above) ?? B.BOSS_PHASES[B.BOSS_PHASES.length - 1]
}

// Boss pattern: drift across the arena and throw rocket fans whose count and
// spread widen as its health drops (see BOSS_PHASES). Everything it does has
// to be expressible as "fires an arcing rocket" plus movement - that's the
// only attack animation the sprite has, and inventing a second one would mean
// art the pack doesn't contain. Rocket SPEED deliberately never changes, so
// the read the player learned from the regular RPG troopers stays valid.
function updateBoss(g, en, dx) {
  en.x += en.driftDir * B.BOSS_SPEED
  const arenaL = 150 * TILE
  const arenaR = g.level.worldW - 60
  if (en.x < arenaL) en.driftDir = 1
  if (en.x + en.w > arenaR) en.driftDir = -1

  const phase = bossPhase(en)
  if (en.salvo > 0) {
    en.salvoGap -= 1
    if (en.salvoGap <= 0) {
      // Fan the salvo symmetrically around the shot that would hit the
      // player, so the middle rocket is always the "aimed" one.
      const idx = phase.rockets - en.salvo
      const offset = idx - (phase.rockets - 1) / 2
      fireRocket(g, en, Math.sign(dx || -1) * (2.6 + Math.abs(offset) * 0.5), B.RPG_ARC + offset * phase.spread)
      en.salvo -= 1
      en.salvoGap = B.BOSS_SALVO_GAP
    }
    return
  }
  if (en.cool <= 0) {
    en.salvo = phase.rockets
    en.salvoGap = 0
    en.cool = phase.every
  }
}

function killEnemy(g, en) {
  en.dying = 1
  en.vx = 0
  g.score += B.SCORE_KILL[en.boss ? 'boss' : en.type]
  addBoom(g, en.x + en.w / 2, en.y + en.h / 2, en.boss ? 3 : 1)
  if (en.boss) g.sfx.boom()
  else g.sfx.hit()
}

// --- projectile step -------------------------------------------------------
function updateBullets(g) {
  const p = g.player
  const solids = g.level.solids
  g.bullets = g.bullets.filter((b) => {
    if (b.kind === 'rocket') b.vy += B.GRAVITY * 0.5
    b.x += b.vx
    b.y += b.vy
    b.life -= 1
    if (b.life <= 0) return false
    if (b.x < -40 || b.x > g.level.worldW + 40 || b.y > g.level.worldH + 60 || b.y < -80) return false

    const box = { x: b.x, y: b.y, w: b.w, h: b.h }
    for (const s of solids) {
      if (rectsOverlap(box, s)) {
        if (b.kind === 'rocket') addBoom(g, b.x, b.y, 1)
        return false
      }
    }

    if (b.hostile) {
      if (p.dead === 0 && p.iframes === 0 && rectsOverlap(box, p)) {
        if (b.kind === 'rocket') addBoom(g, b.x, b.y, 1)
        damagePlayer(g, b.dmg ?? 1, b.x)
        return false
      }
    } else {
      for (const en of g.level.enemies) {
        if (en.dying > 0) continue
        if (!rectsOverlap(box, en)) continue
        en.hp -= B.BULLET_DMG
        if (en.hp <= 0) killEnemy(g, en)
        else g.sfx.hit()
        return false
      }
    }
    return true
  })

  g.booms = g.booms.filter((x) => { x.t += 1; return x.t < SHEETS.boom.cols * 3 })
}

// --- top-level step --------------------------------------------------------
export function step(g, input) {
  if (g.phase === 'over' || g.phase === 'won') { g.phaseTimer += 1; return }

  if (g.phase === 'levelClear') {
    g.phaseTimer += 1
    return
  }

  updatePlayer(g, input)
  for (const en of g.level.enemies) updateEnemy(g, en)
  updateBullets(g)

  // Touching a living enemy hurts - otherwise walking straight through the
  // AR soldiers is strictly better than shooting them.
  const p = g.player
  if (p.dead === 0 && p.iframes === 0) {
    for (const en of g.level.enemies) {
      if (en.dying === 0 && rectsOverlap(p, en)) { damagePlayer(g, 1, en.x + en.w / 2); break }
    }
  }

  g.level.enemies = g.level.enemies.filter((en) => !en.gone && en.dying < 40)

  g.cam = clamp(p.x + p.w / 2 - VIEW_W / 2, 0, Math.max(0, g.level.worldW - VIEW_W))

  // Level 2 ends by killing the boss; level 1 ends by walking off the right
  // edge. Checking `boss` rather than the level index keeps the two levels
  // interchangeable if their order ever changes.
  if (g.level.def.boss) {
    const bossAlive = g.level.enemies.some((en) => en.boss && en.dying === 0)
    const bossSpawned = g.level.def.boss
    if (bossSpawned && !bossAlive) {
      g.score += B.SCORE_LEVEL_CLEAR
      if (!g.tookDamage) g.score += B.SCORE_NO_DAMAGE_BONUS
      g.phase = 'won'
      g.phaseTimer = 0
      g.sfx.win()
    }
  } else if (p.x + p.w >= g.level.worldW - 4) {
    g.score += B.SCORE_LEVEL_CLEAR
    if (!g.tookDamage) g.score += B.SCORE_NO_DAMAGE_BONUS
    g.phase = 'levelClear'
    g.phaseTimer = 0
    g.sfx.win()
  }
}
