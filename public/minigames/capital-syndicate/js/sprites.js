/**
 * Procedural sprites inspired by Ikaruga:
 * high-contrast black/white polarity, sharp geometric silhouettes,
 * soft luminous energy, clean facet shading.
 */

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function facet(ctx, points, hi, mid, lo, light = [-0.4, -0.8]) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();

  // rough normal from first triangle for lighting
  const ax = points[1][0] - points[0][0];
  const ay = points[1][1] - points[0][1];
  const bx = points[2][0] - points[0][0];
  const by = points[2][1] - points[0][1];
  let nx = ax * by - ay * bx;
  let ny = bx * ax + by * ay;
  // use centroid gradient instead for stable look
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const g = ctx.createLinearGradient(
    minX + (maxX - minX) * (0.5 + light[0] * 0.3),
    minY + (maxY - minY) * (0.5 + light[1] * 0.3),
    minX + (maxX - minX) * (0.5 - light[0] * 0.3),
    minY + (maxY - minY) * (0.5 - light[1] * 0.3)
  );
  g.addColorStop(0, hi);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, lo);
  ctx.fillStyle = g;
  ctx.fill();
  void nx;
  void ny;
}

function glowDot(ctx, x, y, r, color, alpha = 0.9) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(0.35, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Ikaruga-like white-polarity fighter: sharp swept wings, luminous core. */
function drawHeroShip() {
  const c = makeCanvas(72, 72);
  const ctx = c.getContext("2d");

  // soft polarity aura
  glowDot(ctx, 36, 38, 28, "rgba(210,230,255,0.55)", 0.55);

  // outer wings
  facet(
    ctx,
    [
      [36, 8],
      [64, 44],
      [52, 52],
      [36, 40],
      [20, 52],
      [8, 44],
    ],
    "#ffffff",
    "#d7dde8",
    "#6a7380"
  );

  // inner body
  facet(
    ctx,
    [
      [36, 12],
      [46, 42],
      [36, 54],
      [26, 42],
    ],
    "#f4f7ff",
    "#b8c2d4",
    "#3a4250"
  );

  // black polarity stripe / vent
  ctx.fillStyle = "#12151c";
  ctx.beginPath();
  ctx.moveTo(36, 18);
  ctx.lineTo(40, 40);
  ctx.lineTo(36, 48);
  ctx.lineTo(32, 40);
  ctx.closePath();
  ctx.fill();

  // twin cannons
  ctx.fillStyle = "#2a303a";
  ctx.fillRect(28, 24, 3, 16);
  ctx.fillRect(41, 24, 3, 16);
  ctx.fillStyle = "#9eb6ff";
  ctx.fillRect(28, 24, 3, 4);
  ctx.fillRect(41, 24, 3, 4);

  // engine glow
  glowDot(ctx, 30, 56, 5, "rgba(180,210,255,0.95)");
  glowDot(ctx, 42, 56, 5, "rgba(180,210,255,0.95)");
  return c;
}

function drawEnemy(kind) {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext("2d");
  const white = kind === "scout" || kind === "dart";
  const hi = white ? "#f5f7fb" : "#3a3f48";
  const mid = white ? "#c5ccd8" : "#1c2028";
  const lo = white ? "#6b7382" : "#07090d";
  const accent = white ? "rgba(200,220,255,0.95)" : "rgba(255,170,80,0.95)";

  glowDot(ctx, 32, 32, 18, accent, 0.35);

  if (kind === "scout") {
    // white diamond interceptor (nose down toward player)
    facet(ctx, [[32, 54], [50, 28], [32, 10], [14, 28]], hi, mid, lo);
    facet(ctx, [[32, 54], [44, 34], [32, 24], [20, 34]], "#ffffff", "#aeb6c4", "#4a5160");
    ctx.fillStyle = "#0c0e14";
    ctx.fillRect(30, 30, 4, 14);
    glowDot(ctx, 32, 26, 5, accent);
  } else if (kind === "lancer") {
    // black swept lancer
    facet(ctx, [[32, 56], [58, 30], [44, 10], [32, 18], [20, 10], [6, 30]], hi, mid, lo);
    facet(ctx, [[32, 48], [42, 28], [32, 16], [22, 28]], "#2a303a", "#12151c", "#000000");
    glowDot(ctx, 22, 24, 4, accent);
    glowDot(ctx, 42, 24, 4, accent);
    ctx.fillStyle = "#f0f2f6";
    ctx.fillRect(30, 34, 4, 12);
  } else if (kind === "heavy") {
    // heavy block ship, white armor plates
    facet(ctx, [[10, 20], [54, 20], [58, 40], [32, 56], [6, 40]], hi, mid, lo);
    facet(ctx, [[18, 24], [46, 24], [48, 38], [32, 48], [16, 38]], "#ffffff", "#b0b8c6", "#555e6c");
    ctx.fillStyle = "#0c0e14";
    ctx.fillRect(28, 28, 8, 16);
    for (const x of [18, 32, 46]) glowDot(ctx, x, 22, 4, accent, 0.8);
  } else if (kind === "dart") {
    // slim black dagger
    facet(ctx, [[32, 56], [42, 30], [32, 8], [22, 30]], "#2c323c", "#141820", "#000000");
    facet(ctx, [[32, 50], [38, 30], [32, 14], [26, 30]], "#f2f4f8", "#9aa3b2", "#3a4250");
    glowDot(ctx, 32, 28, 5, accent);
  }
  return c;
}

function drawBoss(final = false) {
  const w = final ? 200 : 168;
  const h = final ? 120 : 100;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  const cx = w / 2;
  const cy = h / 2 + 4;

  glowDot(ctx, cx, cy, final ? 70 : 52, final ? "rgba(255,180,90,0.45)" : "rgba(200,220,255,0.4)", 0.5);

  // wide geometric fortress wing
  facet(
    ctx,
    [
      [cx, h - 10],
      [w - 12, cy + 16],
      [w - 20, 18],
      [cx + 28, 22],
      [cx, 12],
      [cx - 28, 22],
      [20, 18],
      [12, cy + 16],
    ],
    final ? "#2a303a" : "#eef1f6",
    final ? "#12151c" : "#b4bcc8",
    final ? "#000000" : "#5a6270"
  );

  // center core plates
  facet(
    ctx,
    [
      [cx - 34, cy - 10],
      [cx + 34, cy - 10],
      [cx + 40, cy + 18],
      [cx, cy + 30],
      [cx - 40, cy + 18],
    ],
    final ? "#f4f6fa" : "#1a1e26",
    final ? "#c0c6d2" : "#0a0c10",
    final ? "#6a7280" : "#000000"
  );

  // weapon pods
  const pods = final
    ? [
        [cx - 62, 34],
        [cx - 40, 26],
        [cx + 40, 26],
        [cx + 62, 34],
        [cx - 78, 52],
        [cx + 78, 52],
      ]
    : [
        [cx - 52, 30],
        [cx - 32, 24],
        [cx + 32, 24],
        [cx + 52, 30],
      ];
  for (const [px, py] of pods) {
    facet(
      ctx,
      [
        [px - 6, py - 10],
        [px + 6, py - 10],
        [px + 7, py + 12],
        [px - 7, py + 12],
      ],
      "#dfe4ec",
      "#8a93a2",
      "#2a303a"
    );
  }

  // polarity cores
  const core = final ? "rgba(255,170,70,0.95)" : "rgba(220,235,255,0.95)";
  glowDot(ctx, cx - 14, cy, final ? 12 : 9, core);
  glowDot(ctx, cx + 14, cy, final ? 12 : 9, core);
  glowDot(ctx, cx, cy - 2, final ? 10 : 8, core, 0.7);

  ctx.fillStyle = final ? "#0a0c10" : "#f8f9fc";
  ctx.fillRect(cx - 12, cy + 4, 24, 5);
  return c;
}

function drawAmmo(kind) {
  const sizes = {
    gun: [14, 28],
    ion: [16, 40],
    plasma: [22, 36],
    rocket: [18, 40],
    enemy: [22, 22],
    enemyHeavy: [26, 26],
  };
  const [w, h] = sizes[kind] || [14, 24];
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  const cx = w / 2;

  if (kind === "gun") {
    // white polarity bolt
    glowDot(ctx, cx, 8, 7, "rgba(255,255,255,0.95)");
    const g = ctx.createLinearGradient(cx, 0, cx, h);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.35, "#c8d4ff");
    g.addColorStop(1, "rgba(40,60,120,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - 2, 6);
    ctx.lineTo(cx + 2, 6);
    ctx.lineTo(cx + 1, h);
    ctx.lineTo(cx - 1, h);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "ion") {
    const g = ctx.createLinearGradient(cx, 0, cx, h);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.25, "#9eb6ff");
    g.addColorStop(1, "rgba(20,40,100,0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - 2, 2, 4, h - 4);
    ctx.globalAlpha = 0.45;
    ctx.fillRect(cx - 4, 4, 8, h - 8);
    ctx.globalAlpha = 1;
  } else if (kind === "plasma") {
    // black-polarity energy orb with amber rim
    glowDot(ctx, cx, 12, 11, "rgba(255,180,90,0.85)");
    const g = ctx.createRadialGradient(cx, 12, 1, cx, 14, 10);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.25, "#1a1e26");
    g.addColorStop(0.7, "#000000");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, 12, 8, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "rocket") {
    facet(
      ctx,
      [
        [cx, 2],
        [cx + 5, 12],
        [cx + 4, 28],
        [cx - 4, 28],
        [cx - 5, 12],
      ],
      "#f2f4f8",
      "#9aa3b2",
      "#1c2028"
    );
    ctx.fillStyle = "#0c0e14";
    ctx.fillRect(cx - 2, 10, 4, 14);
    glowDot(ctx, cx, 6, 4, "rgba(255,200,120,0.95)");
    const eg = ctx.createLinearGradient(cx, 28, cx, h);
    eg.addColorStop(0, "#fff2cc");
    eg.addColorStop(0.4, "#ff9a40");
    eg.addColorStop(1, "rgba(40,10,0,0)");
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.moveTo(cx - 3, 28);
    ctx.lineTo(cx + 3, 28);
    ctx.lineTo(cx, h);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "enemy") {
    // Bright white-polarity orb — high visibility against starfield
    glowDot(ctx, cx, cx, w * 0.72, "rgba(255,255,255,1)", 1);
    glowDot(ctx, cx, cx, w * 0.45, "rgba(180,220,255,0.95)", 0.95);
    const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, w / 2 - 0.5);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.35, "#e8f0ff");
    g.addColorStop(0.7, "#9eb8ff");
    g.addColorStop(1, "rgba(120,160,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cx, w / 2 - 0.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "enemyHeavy") {
    // Bright amber / black-polarity orb
    glowDot(ctx, cx, cx, w * 0.75, "rgba(255,200,90,1)", 1);
    glowDot(ctx, cx, cx, w * 0.48, "rgba(255,140,60,0.95)", 0.95);
    const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, w / 2 - 0.5);
    g.addColorStop(0, "#fff8e8");
    g.addColorStop(0.25, "#ffc060");
    g.addColorStop(0.55, "#ff7a30");
    g.addColorStop(1, "rgba(40,10,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cx, w / 2 - 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

function drawPowerup(kind) {
  const c = makeCanvas(32, 32);
  const ctx = c.getContext("2d");
  const map = {
    shield: ["#e8eeff", "#6a82c8"],
    repair: ["#ffe2b0", "#c07820"],
    super: ["#ffffff", "#d0d0d0"],
    ammo: ["#c8d0dc", "#3a4250"],
    rocket: ["#ffb060", "#6a3010"],
  };
  const [hi, lo] = map[kind] || map.ammo;
  glowDot(ctx, 16, 16, 14, hi, 0.45);
  facet(
    ctx,
    [
      [16, 4],
      [28, 16],
      [16, 28],
      [4, 16],
    ],
    hi,
    "#b0b8c4",
    lo
  );
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = "#0c0e14";
  ctx.beginPath();
  ctx.arc(16, 16, 4, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

let atlas = null;

export function getSprites() {
  if (atlas) return atlas;
  atlas = {
    hero: drawHeroShip(),
    scout: drawEnemy("scout"),
    lancer: drawEnemy("lancer"),
    heavy: drawEnemy("heavy"),
    dart: drawEnemy("dart"),
    boss: drawBoss(false),
    finalBoss: drawBoss(true),
    gun: drawAmmo("gun"),
    ion: drawAmmo("ion"),
    plasma: drawAmmo("plasma"),
    rocket: drawAmmo("rocket"),
    enemyBullet: drawAmmo("enemy"),
    enemyBulletHeavy: drawAmmo("enemyHeavy"),
    powerShield: drawPowerup("shield"),
    powerRepair: drawPowerup("repair"),
    powerSuper: drawPowerup("super"),
    powerAmmo: drawPowerup("ammo"),
    powerRocket: drawPowerup("rocket"),
  };
  return atlas;
}

export function drawSprite(ctx, img, x, y, w, h, opts = {}) {
  if (!img) return;
  const sx = opts.sx ?? 1;
  const sy = opts.sy ?? 1;
  const dw = w * sx;
  const dh = h * sy;
  ctx.save();
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  if (opts.flash) ctx.filter = "brightness(3.4) contrast(1.2)";
  else if (opts.flashRed) ctx.filter = "brightness(1.5) sepia(1) hue-rotate(-35deg) saturate(5)";
  ctx.drawImage(img, x - dw / 2, y - dh / 2, dw, dh);
  if (opts.flash || opts.flashRed) {
    ctx.filter = "none";
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = opts.flashRed ? 0.35 : 0.5;
    ctx.drawImage(img, x - dw / 2, y - dh / 2, dw, dh);
  }
  ctx.restore();
}
