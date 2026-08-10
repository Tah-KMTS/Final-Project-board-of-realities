export const W = 720;
export const H = 960;
export const MAX_LEVEL = 4;

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function aabb(a, b) {
  return (
    a.x - a.w / 2 < b.x + b.w / 2 &&
    a.x + a.w / 2 > b.x - b.w / 2 &&
    a.y - a.h / 2 < b.y + b.h / 2 &&
    a.y + a.h / 2 > b.y - b.h / 2
  );
}

export function createPlayer() {
  return {
    x: W / 2,
    y: H - 140,
    w: 44,
    h: 50,
    vx: 0,
    vy: 0,
    shield: 100,
    hull: 100,
    invuln: 0,
    weapon: "gun",
    ammo: { gun: Infinity, ion: 40, plasma: 24, rocket: 10 },
    fireCd: 0,
    trail: [],
    alive: true,
    sx: 1,
    sy: 1,
    hitFlash: 0,
  };
}

export const WEAPONS = {
  gun: { rate: 0.1, speed: 780, damage: 12, pierce: false, splash: 0, color: "#e8eeff", cost: 0 },
  ion: { rate: 0.16, speed: 980, damage: 28, pierce: true, splash: 0, color: "#9eb6ff", cost: 1 },
  plasma: { rate: 0.08, speed: 640, damage: 40, pierce: false, splash: 0, color: "#ffb060", cost: 1 },
  rocket: {
    rate: 0.42,
    speed: 420,
    damage: 95,
    pierce: false,
    splash: 70,
    splashDamage: 55,
    homing: 220,
    color: "#ffb060",
    cost: 1,
  },
};

export const ENEMY_TYPES = {
  scout: {
    w: 36,
    h: 36,
    hp: 28,
    speed: 140,
    score: 100,
    color: "#e8eef8",
    polarity: "white",
    fireRate: 1.4,
    bulletSpeed: 260,
    pattern: "drift",
  },
  lancer: {
    w: 42,
    h: 46,
    hp: 55,
    speed: 100,
    score: 220,
    color: "#1a1e26",
    polarity: "black",
    fireRate: 1.1,
    bulletSpeed: 300,
    pattern: "sine",
  },
  heavy: {
    w: 60,
    h: 54,
    hp: 140,
    speed: 70,
    score: 450,
    color: "#d0d6e0",
    polarity: "white",
    fireRate: 0.85,
    bulletSpeed: 220,
    pattern: "tank",
  },
  dart: {
    w: 30,
    h: 32,
    hp: 18,
    speed: 220,
    score: 150,
    color: "#0c0e14",
    polarity: "black",
    fireRate: 0,
    bulletSpeed: 0,
    pattern: "dive",
  },
};

export function spawnEnemy(type, x, y, level) {
  const t = ENEMY_TYPES[type];
  const scale = 1 + (level - 1) * 0.08;
  return {
    type,
    x,
    y,
    w: t.w,
    h: t.h,
    hp: Math.round(t.hp * scale),
    maxHp: Math.round(t.hp * scale),
    speed: t.speed * (1 + (level - 1) * 0.04),
    score: t.score,
    color: t.color,
    polarity: t.polarity,
    fireRate: Math.max(0.35, t.fireRate / (1 + (level - 1) * 0.05)),
    bulletSpeed: t.bulletSpeed,
    pattern: t.pattern,
    fireCd: 0.4 + Math.random() * 0.8,
    phase: Math.random() * Math.PI * 2,
    age: 0,
    flash: 0,
    sx: 1,
    sy: 1,
    variant: Math.random() < 0.4 ? 1 : 0,
    animOffset: Math.random() * 10,
  };
}

export function spawnBoss(level) {
  const final = level >= MAX_LEVEL;
  const hp = final ? 5200 : 900 + level * 280;
  return {
    type: "boss",
    final,
    x: W / 2,
    y: -80,
    w: final ? 170 : 130,
    h: final ? 120 : 96,
    hp,
    maxHp: hp,
    speed: final ? 85 : 55,
    score: final ? 20000 : 4000 + level * 1000,
    color: final ? "#ffb060" : "#e8eef8",
    polarity: final ? "black" : "white",
    fireRate: final ? 0.22 : 0.45,
    bulletSpeed: final ? 360 : 280,
    pattern: final ? "finalBoss" : "boss",
    fireCd: 1.2,
    phase: 0,
    age: 0,
    flash: 0,
    sx: 1,
    sy: 1,
    entered: false,
    bossPhase: 1,
    specialCd: 2.5,
    spawnCd: 3.5,
    chargeCd: 4.5,
    charging: 0,
    chargeVx: 0,
    chargeVy: 0,
    variant: 0,
    animOffset: 0,
  };
}

export const POWERUP_TYPES = {
  shield: { label: "SHIELD", color: "#3ef0d0", passScore: 500 },
  repair: { label: "REPAIR", color: "#f0a23a", passScore: 500 },
  super: { label: "SUPER", color: "#ff5a6e", passScore: 0, extraLife: true },
  rocket: { label: "ROCKET", color: "#ff8a40", passScore: 300, rockets: 4 },
};

export function spawnPowerup(type, x, y) {
  return {
    type,
    x,
    y,
    w: 34,
    h: 34,
    vy: 90,
    bob: Math.random() * Math.PI * 2,
    variant: Math.random() < 0.45 ? 1 : 0,
    ...POWERUP_TYPES[type],
  };
}

export function spawnPickupAmmo(x, y, ammo) {
  return {
    type: "ammo",
    x,
    y,
    w: 34,
    h: 34,
    vy: 70,
    bob: Math.random() * Math.PI * 2,
    variant: 0,
    ammo: { ...ammo },
    label: "AMMO",
    color: "#9eb3d1",
  };
}
