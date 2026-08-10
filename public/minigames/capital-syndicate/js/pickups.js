/** Animated pickup sprite strips (horizontal frames, black keyed to alpha). */

const FRAME_SIZE = 32;
const DEFAULT_FPS = 12;

const SHEETS = {
  shield: { src: "assets/pickups/shield.png", frames: 16, alt: "assets/pickups/shield_alt.png" },
  repair: { src: "assets/pickups/repair.png", frames: 16, alt: "assets/pickups/repair_alt.png" },
  super: { src: "assets/pickups/super.png", frames: 16, alt: "assets/pickups/super_alt.png" },
  rocket: { src: "assets/pickups/rocket.png", frames: 16 },
  ammo: { src: "assets/pickups/ammo.png", frames: 16 },
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

/** Treat near-black pixels as transparent for sheets that bake a black matte. */
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

export class PickupAtlas {
  constructor() {
    this.ready = false;
    this.strips = {};
    this.loadPromise = this.load();
  }

  async load() {
    const entries = Object.entries(SHEETS);
    await Promise.all(
      entries.map(async ([type, meta]) => {
        try {
          const img = keyBlack(await loadImage(meta.src));
          const fh = img.height;
          const frames = meta.frames || Math.max(1, Math.round(img.width / fh));
          const fw = Math.floor(img.width / frames);
          this.strips[type] = { img, frames, fw, fh };

          if (meta.alt) {
            try {
              const altImg = keyBlack(await loadImage(meta.alt));
              const altFh = altImg.height;
              const altFrames = meta.frames || Math.max(1, Math.round(altImg.width / altFh));
              this.strips[`${type}_alt`] = {
                img: altImg,
                frames: altFrames,
                fw: Math.floor(altImg.width / altFrames),
                fh: altFh,
              };
            } catch {
              /* optional alt missing */
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

  resolveKey(type, variant = 0) {
    if (variant && this.strips[`${type}_alt`]) return `${type}_alt`;
    return type;
  }

  draw(ctx, type, x, y, w, h, timeSec, opts = {}) {
    const key = this.resolveKey(type, opts.variant);
    const strip = this.strips[key] || this.strips[type];
    if (!strip) return false;
    const fps = opts.fps ?? DEFAULT_FPS;
    const frame = Math.floor(Math.max(0, timeSec) * fps) % strip.frames;
    const sx = frame * strip.fw;
    ctx.save();
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(strip.img, sx, 0, strip.fw, strip.fh, x - w / 2, y - h / 2, w, h);
    ctx.restore();
    return true;
  }
}

let atlasPromise = null;

export function loadPickupAtlas() {
  if (!atlasPromise) atlasPromise = new PickupAtlas().loadPromise;
  return atlasPromise;
}
