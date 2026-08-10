/** Animated enemy sprite strips (horizontal frames, black keyed to alpha). */

const DEFAULT_FPS = 10;

const SHEETS = {
  scout: { src: "assets/enemies/scout.png", alt: "assets/enemies/scout_alt.png", fps: 8 },
  dart: { src: "assets/enemies/dart.png", fps: 14 },
  lancer: { src: "assets/enemies/lancer.png", alt: "assets/enemies/lancer_alt.png", fps: 9 },
  heavy: { src: "assets/enemies/heavy.png", alt: "assets/enemies/heavy_alt.png", fps: 11 },
  boss: { src: "assets/enemies/boss.png", fps: 8 },
  finalBoss: { src: "assets/enemies/finalBoss.png", fps: 10 },
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Needed for getImageData keying when served cross-origin (e.g. raw.githack share links)
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

function keyBlack(img) {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] < 12 && d[i + 1] < 12 && d[i + 2] < 12) d[i + 3] = 0;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

function makeStrip(img, meta = {}) {
  const fh = img.height;
  const frames = meta.frames || Math.max(1, Math.round(img.width / fh));
  const fw = Math.floor(img.width / frames);
  return {
    img,
    frames,
    fw,
    fh,
    fps: meta.fps || DEFAULT_FPS,
  };
}

export class EnemyAtlas {
  constructor() {
    this.ready = false;
    this.strips = {};
    this.loadPromise = this.load();
  }

  async load() {
    await Promise.all(
      Object.entries(SHEETS).map(async ([type, meta]) => {
        try {
          const img = keyBlack(await loadImage(meta.src));
          this.strips[type] = makeStrip(img, meta);
          if (meta.alt) {
            try {
              const alt = keyBlack(await loadImage(meta.alt));
              this.strips[`${type}_alt`] = makeStrip(alt, meta);
            } catch {
              /* optional */
            }
          }
        } catch (err) {
          console.warn(err);
        }
      })
    );
    this.ready = Object.keys(this.strips).length > 0;
    return this;
  }

  resolveKey(type, variant = 0, final = false) {
    if (type === "boss" && final && this.strips.finalBoss) return "finalBoss";
    if (variant && this.strips[`${type}_alt`]) return `${type}_alt`;
    return type;
  }

  draw(ctx, type, x, y, w, h, timeSec, opts = {}) {
    const key = this.resolveKey(type, opts.variant, opts.final);
    const strip = this.strips[key] || this.strips[type];
    if (!strip) return false;
    const fps = opts.fps ?? strip.fps ?? DEFAULT_FPS;
    const frame = Math.floor(Math.max(0, timeSec) * fps) % strip.frames;
    const sx = frame * strip.fw;
    ctx.save();
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    if (opts.flash) ctx.filter = "brightness(3.2) contrast(1.15)";
    else if (opts.flashRed) ctx.filter = "brightness(1.6) sepia(1) hue-rotate(-40deg) saturate(4)";
    ctx.imageSmoothingEnabled = false;
    const dw = w * (opts.sx ?? 1);
    const dh = h * (opts.sy ?? 1);
    ctx.drawImage(strip.img, sx, 0, strip.fw, strip.fh, x - dw / 2, y - dh / 2, dw, dh);
    ctx.restore();
    return true;
  }
}

let atlasPromise = null;

export function loadEnemyAtlas() {
  if (!atlasPromise) atlasPromise = new EnemyAtlas().loadPromise;
  return atlasPromise;
}
