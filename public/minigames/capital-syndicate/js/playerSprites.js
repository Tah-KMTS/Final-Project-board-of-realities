/** Animated player / weapon / particle sprite strips. */

const DEFAULT_FPS = 12;

const SHEETS = {
  hero: { src: "assets/player/hero.png", frames: 11, fps: 10 },
  hero_alt: { src: "assets/player/hero_alt.png", frames: 4, fps: 8 },
  gun: { src: "assets/player/gun.png", frames: 8, fps: 14 },
  ion: { src: "assets/player/ion.png", frames: 10, fps: 12 },
  plasma: { src: "assets/player/plasma.png", frames: 6, fps: 10 },
  rocket: { src: "assets/player/rocket.png", frames: 6, fps: 12 },
  muzzle: { src: "assets/player/muzzle.png", frames: 4, fps: 18 },
  thrust: { src: "assets/player/thrust.png", frames: 4, fps: 16 },
  spark: { src: "assets/player/spark.png", frames: 5, fps: 16 },
  shield_fx: { src: "assets/player/shield_fx.png", frames: 6, fps: 10 },
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
  const frames = meta.frames || Math.max(1, Math.round(img.width / Math.max(1, fh)));
  // For non-square cells (e.g. thin lasers), prefer meta.fw if set, else width/frames
  const fw = meta.fw || Math.floor(img.width / frames);
  return { img, frames, fw, fh, fps: meta.fps || DEFAULT_FPS };
}

export class PlayerAtlas {
  constructor() {
    this.ready = false;
    this.strips = {};
    this.loadPromise = this.load();
  }

  async load() {
    await Promise.all(
      Object.entries(SHEETS).map(async ([key, meta]) => {
        try {
          const img = keyBlack(await loadImage(meta.src));
          this.strips[key] = makeStrip(img, meta);
        } catch (err) {
          console.warn(err);
        }
      })
    );
    this.ready = Object.keys(this.strips).length > 0;
    return this;
  }

  draw(ctx, key, x, y, w, h, timeSec, opts = {}) {
    const strip = this.strips[key];
    if (!strip) return false;
    const fps = opts.fps ?? strip.fps;
    const frame =
      opts.frame != null
        ? ((opts.frame % strip.frames) + strip.frames) % strip.frames
        : Math.floor(Math.max(0, timeSec) * fps) % strip.frames;
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

  drawWeapon(ctx, weapon, x, y, w, h, timeSec, opts = {}) {
    const key = ["gun", "ion", "plasma", "rocket"].includes(weapon) ? weapon : "gun";
    return this.draw(ctx, key, x, y, w, h, timeSec, opts);
  }
}

let atlasPromise = null;

export function loadPlayerAtlas() {
  if (!atlasPromise) atlasPromise = new PlayerAtlas().loadPromise;
  return atlasPromise;
}
