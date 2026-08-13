/**
 * Intro cinematic cutscene + thin factories for game.js hooks.
 * Primary intro: image-sequence opening with voice-over + subtitles.
 * Fallback: stitched opening video (same beats + baked VO audio).
 */
import { W, H } from "./entities.js";

/** Bump to force CDN / browser cache refresh of opening assets. */
const OPENING_ASSET_VER = "opening-vo-7";
/** Pin CDN assets to a known-good commit once VO lands on main. */
const OPENING_CDN_REF = "2debb6aa3e1f8d4d4f52ed62b158eb2bbc8f73c7";

const OPENING_BEATS = [
  {
    file: "01-briefing.jpg",
    voice: "01-briefing.mp3",
    speaker: "COMMAND",
    caption:
      "Welcome to Capital Syndicate: Operation Ferrum Wings. Agent Zlisto — this briefing is for you.",
    hold: 8.96,
    voiceDuration: 8.208,
  },
  {
    file: "02-legacy-base.jpg",
    voice: "02-legacy-base.mp3",
    speaker: "COMMAND",
    caption: "We've got urgent work to do… and only you can finish it.",
    hold: 4.95,
    voiceDuration: 4.2,
  },
  {
    file: "03-lisa-captured.jpg",
    voice: "03-lisa-captured.mp3",
    speaker: "COMMAND",
    caption:
      "Princess Lisa has been captured. Only you can save her — and the world.",
    hold: 7.35,
    voiceDuration: 6.6,
  },
  {
    file: "04-board-fighter.jpg",
    voice: "04-board-fighter.mp3",
    speaker: "ZLISTO",
    caption: "Leave it to me! I got this!",
    hold: 4.7,
    voiceDuration: 3.768,
  },
  {
    file: "05-launch.jpg",
    voice: "05-launch.mp3",
    speaker: "OPS",
    caption: "All systems ready. Prepare for takeoff.",
    hold: 5.07,
    voiceDuration: 4.32,
  },
];

const OPENING_LOCAL_DIR = "assets/cutscenes/opening/";
const OPENING_VO_LOCAL_DIR = "assets/cutscenes/opening/vo/";
const OPENING_CDN_BASE = `https://cdn.jsdelivr.net/gh/PRangsi1886/Homework-2@${OPENING_CDN_REF}/assets/cutscenes/opening/`;
const OPENING_VO_CDN_BASE = `https://cdn.jsdelivr.net/gh/PRangsi1886/Homework-2@${OPENING_CDN_REF}/assets/cutscenes/opening/vo/`;

function isCdnHost(host) {
  return (
    /githack\.com$/i.test(host) ||
    /statically\.io$/i.test(host) ||
    /jsdelivr\.net$/i.test(host) ||
    /github\.io$/i.test(host)
  );
}

function openingBeats() {
  const host = typeof location !== "undefined" ? location.hostname : "";
  // Small JPG/MP3 assets load reliably as same-origin relatives on rawcdn.
  // Absolute CDN is a fallback when the host historically mishandles binaries.
  const useCdn = isCdnHost(host);
  return OPENING_BEATS.map((b) => ({
    ...b,
    src: `${OPENING_LOCAL_DIR}${b.file}?v=${OPENING_ASSET_VER}`,
    srcFallback: useCdn ? `${OPENING_CDN_BASE}${b.file}?v=${OPENING_ASSET_VER}` : null,
    voiceSrc: `${OPENING_VO_LOCAL_DIR}${b.voice}?v=${OPENING_ASSET_VER}`,
    voiceFallback: useCdn ? `${OPENING_VO_CDN_BASE}${b.voice}?v=${OPENING_ASSET_VER}` : null,
  }));
}

const INTRO_VIDEO_LOCAL = `assets/cutscenes/intro.mp4?v=${OPENING_ASSET_VER}`;
const INTRO_VIDEO_CDN = `https://cdn.jsdelivr.net/gh/PRangsi1886/Homework-2@${OPENING_CDN_REF}/assets/cutscenes/intro.mp4?v=${OPENING_ASSET_VER}`;

function introVideoSources() {
  const host = typeof location !== "undefined" ? location.hostname : "";
  if (isCdnHost(host)) {
    return [INTRO_VIDEO_CDN, INTRO_VIDEO_LOCAL];
  }
  return [INTRO_VIDEO_LOCAL, INTRO_VIDEO_CDN];
}

function loadImage(src, fallback = null) {
  return new Promise((resolve, reject) => {
    const tryLoad = (url, allowFallback) => {
      const img = new Image();
      img.decoding = "async";
      try {
        const abs = new URL(url, typeof location !== "undefined" ? location.href : undefined);
        if (typeof location !== "undefined" && abs.origin !== location.origin) {
          img.crossOrigin = "anonymous";
        }
      } catch {
        /* ignore */
      }
      img.onload = () => resolve(img);
      img.onerror = () => {
        if (allowFallback && fallback) tryLoad(fallback, false);
        else reject(new Error(`Failed to load ${src}`));
      };
      img.src = url;
    };
    tryLoad(src, true);
  });
}

function preferredVoiceVolume() {
  try {
    if (localStorage.getItem("ferrum-wing-muted") === "1") return 0;
    const raw = Number(localStorage.getItem("ferrum-wing-volume"));
    if (Number.isFinite(raw)) return Math.max(0, Math.min(1, raw));
  } catch {
    /* ignore */
  }
  return 0.85;
}

function loadVoice(src, fallback = null) {
  return new Promise((resolve) => {
    const tryLoad = (url, allowFallback) => {
      const audio = new Audio();
      audio.preload = "auto";
      try {
        const abs = new URL(url, typeof location !== "undefined" ? location.href : undefined);
        if (typeof location !== "undefined" && abs.origin !== location.origin) {
          audio.crossOrigin = "anonymous";
        }
      } catch {
        /* ignore */
      }
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        if (ok) resolve(audio);
        else if (allowFallback && fallback) tryLoad(fallback, false);
        else resolve(null);
      };
      audio.addEventListener("canplaythrough", () => done(true), { once: true });
      audio.addEventListener("loadeddata", () => done(true), { once: true });
      audio.addEventListener("error", () => done(false), { once: true });
      audio.src = url;
      try {
        audio.load();
      } catch {
        done(false);
      }
      setTimeout(() => done(audio.readyState >= 2), 4000);
    };
    tryLoad(src, true);
  });
}

function wrapText(ctx, text, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Reveal subtitle words roughly in sync with voice duration.
 */
function revealedCaption(full, beatTime, voiceDuration) {
  const text = String(full || "");
  if (!text) return "";
  const dur = Math.max(0.8, voiceDuration || 3);
  // Finish revealing a bit before VO ends so the last words aren't rushed.
  const t = Math.min(1, beatTime / (dur * 0.92));
  const words = text.split(/\s+/);
  const count = Math.max(1, Math.ceil(words.length * t));
  return words.slice(0, count).join(" ");
}

/**
 * Full-bleed multi-beat still cinematic drawn to the game canvas.
 * Contract: update(dt) / draw(ctx) / skip() / onDone.
 */
export class ImageSequenceCutscene {
  constructor({ beats, onDone, width = W, height = H } = {}) {
    this.onDone = onDone;
    this.onComplete = onDone;
    this.w = width;
    this.h = height;
    this.done = false;
    this.fade = 1;
    this.time = 0;
    this.beatIndex = 0;
    this.beatTime = 0;
    this.cross = 0;
    this.ready = false;
    this.failed = false;
    this._finishing = false;
    this._voiceIndex = -1;
    this.beats = (beats || openingBeats()).map((b) => ({ ...b, img: null, audio: null }));
    this.transition = 0.45;

    void this.preload();
  }

  async preload() {
    try {
      const images = await Promise.all(
        this.beats.map((b) => loadImage(b.src, b.srcFallback))
      );
      images.forEach((img, i) => {
        this.beats[i].img = img;
      });
      // Voice is best-effort — stills still play if VO fails.
      const voices = await Promise.all(
        this.beats.map((b) =>
          b.voiceSrc ? loadVoice(b.voiceSrc, b.voiceFallback) : Promise.resolve(null)
        )
      );
      voices.forEach((audio, i) => {
        this.beats[i].audio = audio;
      });
      this.ready = true;
      this.failed = false;
    } catch {
      this.failed = true;
      this.ready = false;
    }
  }

  stopVoice() {
    for (const beat of this.beats) {
      const a = beat.audio;
      if (!a) continue;
      try {
        a.pause();
        a.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    this._voiceIndex = -1;
  }

  ensureVoice() {
    if (this.done || this._finishing || !this.ready) return;
    if (this._voiceIndex === this.beatIndex) return;
    this.stopVoice();
    this._voiceIndex = this.beatIndex;
    const beat = this.currentBeat();
    const audio = beat?.audio;
    if (!audio) return;
    const vol = preferredVoiceVolume();
    audio.volume = vol;
    audio.muted = vol <= 0.001;
    void audio.play().catch(() => {
      // Autoplay may require a prior unlock click — game already unlocks on start.
    });
  }

  fadeOutAndFinish() {
    if (this.done) return;
    this._finishing = true;
    this.stopVoice();
  }

  skip() {
    if (this.done) return;
    this.stopVoice();
    this.done = true;
    this.onDone?.();
  }

  currentBeat() {
    return this.beats[this.beatIndex] || null;
  }

  nextBeat() {
    return this.beats[this.beatIndex + 1] || null;
  }

  update(dt) {
    if (this.done) return;
    if (this.failed) return;
    if (!this.ready) {
      this.time += dt;
      return;
    }

    this.time += dt;
    this.beatTime += dt;
    this.ensureVoice();

    if (this._finishing) {
      this.fade = Math.min(1, this.fade + dt / 0.55);
      if (this.fade >= 1) this.skip();
      return;
    }

    if (this.time < 0.5) this.fade = 1 - this.time / 0.5;
    else this.fade = Math.max(0, this.fade - dt * 2.2);

    const beat = this.currentBeat();
    if (!beat) {
      this.fadeOutAndFinish();
      return;
    }

    const hold = beat.hold ?? 3.2;
    const edge = hold - this.transition;

    if (this.beatTime >= edge && this.nextBeat()) {
      this.cross = Math.min(1, (this.beatTime - edge) / this.transition);
    } else {
      this.cross = 0;
    }

    if (this.beatTime >= hold) {
      if (this.beatIndex >= this.beats.length - 1) {
        this.fadeOutAndFinish();
        return;
      }
      this.beatIndex += 1;
      this.beatTime = 0;
      this.cross = 0;
    }
  }

  drawCover(ctx, img) {
    if (!img) return;
    const { w, h } = this;
    // Static cover fit — fill the screen (crop edges), no Ken Burns zoom.
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  drawSubtitle(ctx, speaker, text) {
    if (!text) return;
    const { w, h } = this;
    const padX = 28;
    const maxW = w - padX * 2;

    ctx.font = "600 18px Rajdhani, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = wrapText(ctx, text, maxW);

    const lineH = 26;
    const speakerH = speaker ? 22 : 0;
    const boxH = lines.length * lineH + 22 + speakerH;
    const boxY = h - 56 - boxH - 12;

    ctx.fillStyle = "rgba(1, 3, 8, 0.78)";
    ctx.fillRect(18, boxY, w - 36, boxH);
    ctx.strokeStyle = "rgba(232, 162, 74, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(18.5, boxY + 0.5, w - 37, boxH - 1);

    let textY = boxY + 14;
    if (speaker) {
      ctx.font = "700 13px Orbitron, Rajdhani, sans-serif";
      ctx.fillStyle = "rgba(232, 162, 74, 0.95)";
      ctx.textAlign = "left";
      ctx.fillText(String(speaker).toUpperCase(), 34, textY + 8);
      textY += speakerH;
    }

    ctx.font = "600 18px Rajdhani, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(244, 246, 250, 0.96)";
    lines.forEach((ln, i) => {
      ctx.fillText(ln, w / 2, textY + lineH / 2 + i * lineH);
    });
  }

  draw(ctx) {
    if (this.done) return;
    const { w, h } = this;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    if (!this.ready) {
      ctx.fillStyle = "rgba(158, 179, 209, 0.85)";
      ctx.font = "600 16px Rajdhani, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("LOADING BRIEFING…", w / 2, h / 2);
      return;
    }

    const beat = this.currentBeat();
    const next = this.nextBeat();

    if (beat?.img) this.drawCover(ctx, beat.img);

    if (this.cross > 0 && next?.img) {
      ctx.globalAlpha = this.cross;
      this.drawCover(ctx, next.img);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = "#010308";
    ctx.fillRect(0, 0, w, 56);
    ctx.fillRect(0, h - 56, w, 56);

    const active = this.cross > 0.55 && next ? next : beat;
    const fullCaption = active?.caption || "";
    const shown =
      active === beat
        ? revealedCaption(fullCaption, this.beatTime, beat?.voiceDuration)
        : fullCaption;
    this.drawSubtitle(ctx, active?.speaker, shown);

    ctx.fillStyle = "rgba(232, 162, 74, 0.95)";
    ctx.font = "700 13px Rajdhani, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("OPENING v3", 24, h - 20);

    ctx.fillStyle = "rgba(158, 179, 209, 0.9)";
    ctx.font = "600 14px Rajdhani, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("CLICK / SPACE TO SKIP", w - 24, h - 20);

    const pipY = 28;
    const total = this.beats.length;
    const pipW = 28;
    const gap = 8;
    const rowW = total * pipW + (total - 1) * gap;
    let pipX = (w - rowW) / 2;
    for (let i = 0; i < total; i++) {
      ctx.fillStyle = i <= this.beatIndex ? "rgba(232,162,74,0.95)" : "rgba(158,179,209,0.28)";
      ctx.fillRect(pipX, pipY, pipW, 3);
      pipX += pipW + gap;
    }

    if (this.fade > 0.01) {
      ctx.globalAlpha = Math.min(1, this.fade);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }
}

/**
 * Full-bleed HTMLVideoElement cutscene drawn to the game canvas.
 * Contract: update(dt) / draw(ctx) / skip() / onDone.
 * Video includes baked VO; timed subtitle cues mirror the stills path.
 */
export class VideoCutscene {
  constructor({
    src,
    onDone,
    width = W,
    height = H,
    muted = false,
    subtitleBeats = OPENING_BEATS,
  } = {}) {
    this.onDone = onDone;
    this.onComplete = onDone;
    this.w = width;
    this.h = height;
    this.done = false;
    this.fade = 1;
    this.time = 0;
    this.started = false;
    this.failed = false;
    this.ended = false;
    this._hasData = false;
    this.subtitleBeats = subtitleBeats || OPENING_BEATS;

    this.sources = Array.isArray(src) ? src.filter(Boolean) : [src || INTRO_VIDEO_LOCAL];
    this.sourceIndex = 0;

    this.video = document.createElement("video");
    this.video.playsInline = true;
    this.video.preload = "auto";
    this.video.loop = false;
    this.video.playbackRate = 1.0;
    this.video.muted = muted;
    this.video.volume = preferredVoiceVolume();

    this.video.addEventListener("loadeddata", () => {
      this._hasData = true;
    });
    this.video.addEventListener("canplay", () => {
      this._hasData = true;
    });
    this.video.addEventListener("ended", () => {
      this.ended = true;
      this.fadeOutAndFinish();
    });
    this.video.addEventListener("error", () => this.onVideoError());

    this.applySource(this.sources[0]);
  }

  applySource(url) {
    this._hasData = false;
    try {
      const abs = new URL(url, typeof location !== "undefined" ? location.href : undefined);
      if (abs.origin !== location.origin) this.video.crossOrigin = "anonymous";
      else this.video.removeAttribute("crossorigin");
    } catch {
      this.video.removeAttribute("crossorigin");
    }
    this.video.src = url;
    try {
      this.video.load();
    } catch {
      /* ignore */
    }
  }

  onVideoError() {
    if (this.done || this.failed) return;
    if (this.sourceIndex + 1 < this.sources.length) {
      this.sourceIndex += 1;
      this.started = false;
      this.applySource(this.sources[this.sourceIndex]);
      return;
    }
    this.failed = true;
    this.skip();
  }

  fadeOutAndFinish() {
    if (this.done) return;
    this._finishing = true;
  }

  skip() {
    if (this.done) return;
    try {
      this.video.pause();
    } catch {
      /* ignore */
    }
    this.done = true;
    this.onDone?.();
  }

  async ensurePlaying() {
    if (this.started || this.failed || this.done) return;
    this.started = true;
    const vol = preferredVoiceVolume();
    this.video.volume = vol;
    this.video.muted = vol <= 0.001;
    try {
      await this.video.play();
    } catch {
      try {
        this.video.muted = true;
        await this.video.play();
      } catch {
        this.started = false;
      }
    }
  }

  activeSubtitle() {
    const t = this.video?.currentTime || this.time;
    let cursor = 0;
    for (const beat of this.subtitleBeats) {
      const hold = beat.hold ?? 3.2;
      if (t < cursor + hold) {
        const local = t - cursor;
        return {
          speaker: beat.speaker,
          caption: revealedCaption(beat.caption, local, beat.voiceDuration),
        };
      }
      cursor += hold;
    }
    const last = this.subtitleBeats[this.subtitleBeats.length - 1];
    return last ? { speaker: last.speaker, caption: last.caption } : null;
  }

  update(dt) {
    if (this.done) return;
    this.time += dt;
    void this.ensurePlaying();

    if (this._finishing) {
      this.fade = Math.min(1, this.fade + dt / 0.55);
      if (this.fade >= 1) this.skip();
      return;
    }

    if (this.time < 0.45) this.fade = 1 - this.time / 0.45;
    else this.fade = Math.max(0, this.fade - dt * 2);

    if (this.time > 8 && !this._hasData && this.video.readyState < 2) {
      if (this.sourceIndex + 1 < this.sources.length) {
        this.sourceIndex += 1;
        this.started = false;
        this.time = 0;
        this.applySource(this.sources[this.sourceIndex]);
        return;
      }
      this.failed = true;
      this.skip();
    }
  }

  drawSubtitle(ctx, speaker, text) {
    if (!text) return;
    const { w, h } = this;
    const padX = 28;
    const maxW = w - padX * 2;
    ctx.font = "600 18px Rajdhani, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = wrapText(ctx, text, maxW);
    const lineH = 26;
    const speakerH = speaker ? 22 : 0;
    const boxH = lines.length * lineH + 22 + speakerH;
    const boxY = h - 56 - boxH - 12;
    ctx.fillStyle = "rgba(1, 3, 8, 0.78)";
    ctx.fillRect(18, boxY, w - 36, boxH);
    ctx.strokeStyle = "rgba(232, 162, 74, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(18.5, boxY + 0.5, w - 37, boxH - 1);
    let textY = boxY + 14;
    if (speaker) {
      ctx.font = "700 13px Orbitron, Rajdhani, sans-serif";
      ctx.fillStyle = "rgba(232, 162, 74, 0.95)";
      ctx.textAlign = "left";
      ctx.fillText(String(speaker).toUpperCase(), 34, textY + 8);
      textY += speakerH;
    }
    ctx.font = "600 18px Rajdhani, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(244, 246, 250, 0.96)";
    lines.forEach((ln, i) => {
      ctx.fillText(ln, w / 2, textY + lineH / 2 + i * lineH);
    });
  }

  draw(ctx) {
    if (this.done) return;
    const { w, h } = this;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    if (this.video.readyState >= 2) {
      const vw = this.video.videoWidth || w;
      const vh = this.video.videoHeight || h;
      const scale = Math.max(w / vw, h / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const dx = (w - dw) / 2;
      const dy = (h - dh) / 2;
      try {
        ctx.drawImage(this.video, dx, dy, dw, dh);
      } catch {
        /* ignore */
      }
    }

    ctx.fillStyle = "#010308";
    ctx.fillRect(0, 0, w, 56);
    ctx.fillRect(0, h - 56, w, 56);

    const sub = this.activeSubtitle();
    if (sub) this.drawSubtitle(ctx, sub.speaker, sub.caption);

    ctx.fillStyle = "rgba(232, 162, 74, 0.95)";
    ctx.font = "700 13px Rajdhani, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("OPENING v3", 24, h - 20);

    ctx.fillStyle = "rgba(158, 179, 209, 0.9)";
    ctx.font = "600 14px Rajdhani, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("CLICK / SPACE TO SKIP", w - 24, h - 20);

    if (this.fade > 0.01) {
      ctx.globalAlpha = Math.min(1, this.fade);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }
}

export function createIntroCutscene(onDone) {
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    onDone?.();
  };

  const sequence = new ImageSequenceCutscene({
    beats: openingBeats(),
    onDone: finish,
  });

  let active = sequence;
  let video = null;
  let waited = 0;

  return {
    get done() {
      return finished;
    },
    update(dt) {
      if (finished) return;
      if (active === sequence && sequence.failed && !video) {
        video = new VideoCutscene({
          src: introVideoSources(),
          onDone: finish,
          subtitleBeats: OPENING_BEATS,
        });
        active = video;
      }
      if (active === sequence && !sequence.ready && !sequence.failed) {
        waited += dt;
        if (waited > 8) {
          sequence.failed = true;
          video = new VideoCutscene({
            src: introVideoSources(),
            onDone: finish,
            subtitleBeats: OPENING_BEATS,
          });
          active = video;
        }
      }
      active.update(dt);
    },
    draw(ctx) {
      if (finished) return;
      active.draw(ctx);
    },
    skip() {
      if (finished) return;
      active.skip();
    },
  };
}

export function createVictoryCutscene(_score, onDone) {
  const stub = {
    done: false,
    update() {
      if (!this.done) {
        this.done = true;
        onDone?.();
      }
    },
    draw() {},
    skip() {
      if (this.done) return;
      this.done = true;
      onDone?.();
    },
  };
  queueMicrotask(() => stub.skip());
  return stub;
}
