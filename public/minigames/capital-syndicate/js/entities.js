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
    ammo: { gun: Infinity, ion: 40, plasma: 24, rocket: 8 },
    fireCd: 0,
    trail: [],
    alive: true,
    sx: 1,
    sy: 1,
    hitFlash: 0,
    shipLevel: 1,
    upgrades: {
      laserWidthMul: 1,
      laserDamageMul: 1,
      rocketCount: 1,
      plasmaShots: 2,
      minigun: false,
      ionWidthMul: 1,
      taken: [],
    },
  };
}

/** Permanent upgrade choices offered after each sector boss. */
export const UPGRADE_POOL = [
  {
    id: "laser",
    title: "OVERCHARGE LASER",
    desc: "+25% super-laser width & damage",
  },
  {
    id: "rocket2",
    title: "TWIN MISSILES",
    desc: "Rockets fire 2 per volley",
  },
  {
    id: "plasma3",
    title: "TRIPLE PLASMA",
    desc: "Plasma particles: 2 → 3",
  },
  {
    id: "minigun",
    title: "MINIGUN",
    desc: "Gun +20% fire rate, +10% damage",
  },
  {
    id: "ionwide",
    title: "WIDE ION",
    desc: "Ion particle +200% wider",
  },
];

export function pickUpgradeChoices(taken = [], count = 3) {
  const pool = UPGRADE_POOL.filter((u) => !taken.includes(u.id));
  const src = pool.length ? pool : UPGRADE_POOL;
  const shuffled = [...src].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function applyUpgrade(player, upgradeId) {
  const u = player.upgrades;
  if (!u.taken.includes(upgradeId)) u.taken.push(upgradeId);
  if (upgradeId === "laser") {
    u.laserWidthMul = 1.25;
    u.laserDamageMul = 1.25;
  } else if (upgradeId === "rocket2") {
    u.rocketCount = 2;
  } else if (upgradeId === "plasma3") {
    u.plasmaShots = 3;
  } else if (upgradeId === "minigun") {
    u.minigun = true;
  } else if (upgradeId === "ionwide") {
    u.ionWidthMul = 3; // +200% width
  }
  player.shipLevel = (player.shipLevel || 1) + 1;
}

export const WEAPONS = {
  gun: { rate: 0.1, speed: 780, damage: 12, pierce: false, splash: 0, color: "#e8eeff", cost: 0 },
  // Harder-hitting pierce bolt; slower cadence than before.
  ion: { rate: 0.28, speed: 980, damage: 42, pierce: true, splash: 0, color: "#9eb6ff", cost: 1 },
  // Nerf plasma DPS (was ~500) — still punchy, no longer the default shredder.
  plasma: { rate: 0.14, speed: 640, damage: 22, pierce: false, splash: 0, color: "#ffb060", cost: 1 },
  // Single smart missile: wider blast, stronger seek, one shot per press.
  rocket: {
    rate: 0.55,
    speed: 460,
    damage: 110,
    pierce: false,
    splash: 91, // +30% vs previous 70
    splashDamage: 65,
    homing: 420,
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

/** Sector 1 boss HP is the baseline for later sector scaling. */
export const SECTOR1_BOSS_HP = 1650;

export function bossHpForLevel(level) {
  const final = level >= MAX_LEVEL;
  if (final) return 5200;
  if (level <= 1) return SECTOR1_BOSS_HP;
  if (level === 2) return Math.round(SECTOR1_BOSS_HP * 1.5);
  // Sector 3+: 100% more than sector 1
  return Math.round(SECTOR1_BOSS_HP * 2);
}

export function spawnBoss(level, opts = {}) {
  const final = level >= MAX_LEVEL;
  const hp = bossHpForLevel(level);
  const pairIndex = opts.pairIndex || 0;
  const pairCount = opts.pairCount || 1;
  const slotX =
    pairCount > 1 ? (pairIndex === 0 ? -120 : 120) : 0;
  return {
    type: "boss",
    final,
    x: W / 2 + slotX,
    y: -80,
    w: final ? 170 : pairCount > 1 ? 118 : 130,
    h: final ? 120 : pairCount > 1 ? 88 : 96,
    hp,
    maxHp: hp,
    speed: final ? 85 : 55 + level * 6,
    score: final ? 20000 : 4000 + level * 1000,
    color: final ? "#ffb060" : "#e8eef8",
    polarity: final ? "black" : "white",
    fireRate: final ? 0.22 : Math.max(0.28, 0.42 - level * 0.04),
    bulletSpeed: final ? 360 : 280 + level * 30,
    pattern: final ? "finalBoss" : "boss",
    fireCd: 1.0,
    phase: pairIndex * 1.7,
    age: 0,
    flash: 0,
    sx: 1,
    sy: 1,
    entered: false,
    bossPhase: 1,
    specialCd: final ? 2.5 : 2.2 - level * 0.15,
    // Final: escorts every 4s (3 mini planes). Sector bosses use specials.
    spawnCd: final ? 4 : 99,
    chargeCd: final ? 4.5 : 5.5 - level * 0.4,
    charging: 0,
    chargeVx: 0,
    chargeVy: 0,
    // Final laser: first lock after 5s, 10s charge, 2s beam
    laserCd: final ? 5 : 99,
    laserState: null,
    laserT: 0,
    laserAimX: W / 2,
    laserHalfW: 22,
    laserHitCd: 0,
    attackIndex: 0,
    // All sector bosses alternate spread with focused gun fire
    altGun: !final,
    shotStyle: 0,
    sectorLevel: level,
    slotX,
    pairPhase: pairIndex * Math.PI,
    variant: 0,
    animOffset: pairIndex * 0.37,
  };
}

export const POWERUP_TYPES = {
  shield: { label: "SHIELD", color: "#3ef0d0", passScore: 500 },
  repair: { label: "REPAIR", color: "#f0a23a", passScore: 500 },
  super: { label: "SUPER", color: "#ff5a6e", passScore: 0, extraLife: true },
  rocket: { label: "ROCKET", color: "#ff8a40", passScore: 300, rockets: 2 },
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
