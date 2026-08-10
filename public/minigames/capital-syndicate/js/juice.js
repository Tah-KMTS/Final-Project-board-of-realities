/** Lightweight “game feel” helpers: trauma shake, hitstop, particles, squash. */

export function createJuiceState() {
  return {
    trauma: 0,
    hitstop: 0,
    flashAlpha: 0,
    flashColor: "#ffffff",
    flashCooldown: 0,
    time: 0,
  };
}

export function addTrauma(juice, amount) {
  juice.trauma = Math.min(1, juice.trauma + amount);
}

export function hitStop(juice, seconds = 0.06) {
  juice.hitstop = Math.max(juice.hitstop, seconds);
}

/** Rare, short screen flashes — skipped while cooldown is active. */
export function impactFlash(juice, color = "rgba(255,255,255,0.2)", alpha = 0.18, cooldown = 0.45) {
  if (juice.flashCooldown > 0) return;
  juice.flashColor = color;
  juice.flashAlpha = Math.min(0.22, alpha);
  juice.flashCooldown = cooldown;
}

export function decayJuice(juice, dt) {
  juice.time += dt;
  juice.trauma = Math.max(0, juice.trauma - dt * 1.6);
  if (juice.hitstop > 0) juice.hitstop = Math.max(0, juice.hitstop - dt);
  if (juice.flashCooldown > 0) juice.flashCooldown = Math.max(0, juice.flashCooldown - dt);
  if (juice.flashAlpha > 0) juice.flashAlpha = Math.max(0, juice.flashAlpha - dt * 6);
}

export function shakeOffset(juice) {
  const mag = juice.trauma * juice.trauma * 18;
  if (mag <= 0.05) return { x: 0, y: 0 };
  return {
    x: (Math.random() - 0.5) * mag * 2,
    y: (Math.random() - 0.5) * mag * 2,
  };
}

export function lerpSquash(entity, dt, rate = 10) {
  entity.sx += (1 - (entity.sx ?? 1)) * Math.min(1, rate * dt);
  entity.sy += (1 - (entity.sy ?? 1)) * Math.min(1, rate * dt);
}

export function setSquash(entity, sx, sy) {
  // Bosses are large pre-rendered sprites — squash reads as warping
  if (entity?.type === "boss") return;
  entity.sx = sx;
  entity.sy = sy;
}

export function spawnBurst(particles, x, y, opts = {}) {
  const {
    count = 12,
    speed = 180,
    color = "#ffffff",
    colors = null,
    life = 0.45,
    size = 2.2,
    gravity = 40,
    drag = 0.4,
    spread = Math.PI * 2,
    angle = -Math.PI / 2,
    glow = false,
    shape = "circle",
  } = opts;

  for (let i = 0; i < count; i++) {
    const a = angle + (Math.random() - 0.5) * spread;
    const s = speed * (0.35 + Math.random() * 0.75);
    const c = colors ? colors[(Math.random() * colors.length) | 0] : color;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: life * (0.55 + Math.random() * 0.6),
      max: life,
      color: c,
      size: size * (0.6 + Math.random() * 0.9),
      gravity,
      drag,
      glow,
      shape,
    });
  }
}

export function spawnSparks(particles, x, y, count = 10) {
  spawnBurst(particles, x, y, {
    count,
    speed: 340,
    colors: ["#ffffff", "#ffe66d", "#ff4fd8", "#4de8ff", "#ff7a3d", "#b388ff"],
    life: 0.38,
    size: 2.6,
    gravity: 70,
    drag: 0.9,
    glow: true,
  });
}

export function spawnSmoke(particles, x, y, count = 8) {
  spawnBurst(particles, x, y, {
    count,
    speed: 70,
    colors: ["rgba(180,120,200,0.45)", "rgba(60,40,80,0.5)", "rgba(255,140,90,0.28)", "rgba(80,180,220,0.3)"],
    life: 0.85,
    size: 6.5,
    gravity: -28,
    drag: 0.7,
    spread: Math.PI,
    angle: -Math.PI / 2,
  });
}

export function spawnMuzzle(particles, x, y) {
  spawnBurst(particles, x, y, {
    count: 8,
    speed: 180,
    colors: ["#ffffff", "#ffe66d", "#ff4fd8", "#4de8ff"],
    life: 0.14,
    size: 3,
    gravity: 0,
    drag: 2,
    spread: 0.8,
    angle: -Math.PI / 2,
    glow: true,
  });
}

/** Multi-layer kill / boom FX — sparks, fire, embers, shockwave ring. */
export function spawnExplosion(particles, x, y, { big = false } = {}) {
  const scale = big ? 1.85 : 1;
  // Core flash
  spawnBurst(particles, x, y, {
    count: Math.round(18 * scale),
    speed: 90 * scale,
    colors: ["#ffffff", "#fff3c4", "#ffe66d"],
    life: 0.18,
    size: 5.5 * scale,
    gravity: 0,
    drag: 2.5,
    glow: true,
  });
  // Hot fire ring
  spawnBurst(particles, x, y, {
    count: Math.round(28 * scale),
    speed: 260 * scale,
    colors: ["#ff4fd8", "#ff7a3d", "#ffe66d", "#ff2a6d"],
    life: 0.55,
    size: 3.8 * scale,
    gravity: 40,
    drag: 0.55,
    glow: true,
  });
  // Electric / synthwave outer sparks
  spawnBurst(particles, x, y, {
    count: Math.round(22 * scale),
    speed: 420 * scale,
    colors: ["#4de8ff", "#b388ff", "#ffffff", "#ff4fd8"],
    life: 0.42,
    size: 2.4 * scale,
    gravity: 50,
    drag: 0.75,
    glow: true,
  });
  // Rising embers
  spawnBurst(particles, x, y, {
    count: Math.round(14 * scale),
    speed: 140 * scale,
    colors: ["#ff9a4a", "#ff4fd8", "#ffe66d"],
    life: 0.75,
    size: 2.8 * scale,
    gravity: -55,
    drag: 0.45,
    spread: Math.PI * 1.2,
    angle: -Math.PI / 2,
    glow: true,
  });
  // Colored smoke bloom
  spawnSmoke(particles, x, y, Math.round((big ? 26 : 12) * scale));
  // Slow shockwave discs
  for (let i = 0; i < (big ? 3 : 1); i++) {
    particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.35 + i * 0.08,
      max: 0.45 + i * 0.08,
      color: i % 2 ? "rgba(77,232,255,0.85)" : "rgba(255,79,216,0.8)",
      size: (10 + i * 8) * scale,
      gravity: 0,
      drag: 0,
      glow: true,
      shape: "ring",
      grow: 90 * scale,
    });
  }
}

export function updateParticles(particles, dt) {
  for (const p of particles) {
    p.vx *= Math.max(0, 1 - (p.drag || 0) * dt);
    p.vy *= Math.max(0, 1 - (p.drag || 0) * dt);
    p.vy += (p.gravity ?? 20) * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.grow) p.size += p.grow * dt;
  }
  let write = 0;
  for (let i = 0; i < particles.length; i++) {
    if (particles[i].life > 0) particles[write++] = particles[i];
  }
  particles.length = write;
}

export function drawParticles(ctx, particles) {
  for (const p of particles) {
    const a = Math.max(0, Math.min(1, p.life / p.max));
    ctx.globalAlpha = a;
    if (p.shape === "ring") {
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1.5, 4 * a);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(2, p.size), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      continue;
    }
    if (p.glow) {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 2.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 1.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.fillStyle = p.color;
    if (p.shape === "square") {
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

/** Soft radial glow (player light / bloom accents). */
export function drawGlow(ctx, x, y, radius, color, alpha = 0.35) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Vignette + vivid synthwave grade + optional impact flash. */
export function drawPostFx(ctx, w, h, juice) {
  // vignette / dark corners
  const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.18, w / 2, h / 2, h * 0.82);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(0.55, "rgba(20,0,30,0.06)");
  vig.addColorStop(1, "rgba(0,0,0,0.58)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  // Magenta / cyan synthwave lift to match BGM energy
  ctx.globalCompositeOperation = "soft-light";
  const grade = ctx.createLinearGradient(0, 0, 0, h);
  grade.addColorStop(0, "rgba(90, 40, 140, 0.28)");
  grade.addColorStop(0.45, "rgba(30, 50, 90, 0.18)");
  grade.addColorStop(1, "rgba(180, 50, 90, 0.22)");
  ctx.fillStyle = grade;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = "rgba(255, 90, 180, 0.08)";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";

  // impact screen flash (rare / brief)
  if (juice.flashAlpha > 0.01) {
    ctx.globalAlpha = juice.flashAlpha;
    ctx.fillStyle = juice.flashColor;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
}
