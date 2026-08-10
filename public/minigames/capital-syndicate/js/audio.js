const STORAGE_KEY = "ferrum-wing-volume";
const MUTE_KEY = "ferrum-wing-muted";
const BGM_DB = "ferrum-wing-bgm";
const BGM_STORE = "tracks";
const BGM_KEY = "custom";
const BASE_GAIN = 0.6875; // was 0.55 — ~25% louder master bus
const MUSIC_BASE_GAIN = 0.55;
const SFX_BASE_GAIN = 2.4; // weapon / combat SFX bus — kept well above BGM
const BUNDLED_BGM = [
  "assets/bgm.mp3",
  "assets/bgm.ogg",
  "assets/bgm.wav",
  "assets/bgm.m4a",
  "assets/bgm.flac",
];

const NOTE = {
  C2: 65.41,
  D2: 73.42,
  E2: 82.41,
  F2: 87.31,
  G2: 98.0,
  A2: 110.0,
  Bb2: 116.54,
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  G3: 196.0,
  A3: 220.0,
  Bb3: 233.08,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  Bb4: 466.16,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
};

const TRACKS = {
  title: {
    bpm: 86,
    swing: 0.04,
    bass: [NOTE.A2, 0, NOTE.A2, 0, NOTE.G2, 0, NOTE.F2, 0, NOTE.A2, 0, NOTE.C3, 0, NOTE.G2, 0, NOTE.E2, 0],
    arp: [NOTE.A3, NOTE.C4, NOTE.E4, NOTE.A4, NOTE.G3, NOTE.C4, NOTE.E4, NOTE.G4, NOTE.F3, NOTE.A3, NOTE.C4, NOTE.F4, NOTE.E3, NOTE.G3, NOTE.B3, NOTE.E4],
    lead: [NOTE.E4, 0, 0, NOTE.C4, 0, 0, NOTE.A3, 0, NOTE.G4, 0, 0, NOTE.E4, 0, NOTE.D4, 0, 0],
    pad: [NOTE.A3, NOTE.C4, NOTE.E4],
    drums: false,
    intensity: 0.55,
  },
  cutscene: {
    bpm: 78,
    swing: 0.02,
    bass: [NOTE.F2, 0, 0, 0, NOTE.G2, 0, 0, 0, NOTE.A2, 0, 0, 0, NOTE.G2, 0, 0, 0],
    arp: [NOTE.A3, 0, NOTE.C4, 0, NOTE.E4, 0, NOTE.C4, 0, NOTE.G3, 0, NOTE.Bb3, 0, NOTE.D4, 0, NOTE.Bb3, 0],
    lead: [NOTE.C4, 0, 0, 0, NOTE.E4, 0, 0, 0, NOTE.G4, 0, 0, NOTE.E4, 0, 0, NOTE.C4, 0],
    pad: [NOTE.F3, NOTE.A3, NOTE.C4],
    drums: false,
    intensity: 0.45,
  },
  combat: {
    bpm: 140,
    swing: 0.05,
    bass: [NOTE.A2, NOTE.A2, 0, NOTE.A2, NOTE.G2, NOTE.G2, 0, NOTE.G2, NOTE.F2, NOTE.F2, 0, NOTE.F2, NOTE.E2, NOTE.E2, NOTE.G2, NOTE.A2],
    arp: [NOTE.A3, NOTE.C4, NOTE.E4, NOTE.A4, NOTE.A3, NOTE.C4, NOTE.G4, NOTE.E4, NOTE.F3, NOTE.A3, NOTE.C4, NOTE.F4, NOTE.E3, NOTE.G3, NOTE.B3, NOTE.E4],
    lead: [NOTE.A4, 0, NOTE.E4, 0, NOTE.C5, 0, NOTE.A4, 0, NOTE.G4, 0, NOTE.E4, NOTE.G4, 0, NOTE.A4, 0, 0],
    pad: [NOTE.A3, NOTE.C4, NOTE.E4],
    drums: true,
    intensity: 0.95,
  },
  boss: {
    bpm: 158,
    swing: 0.03,
    bass: [NOTE.E2, NOTE.E2, NOTE.E2, 0, NOTE.F2, NOTE.F2, 0, NOTE.G2, NOTE.E2, NOTE.E2, NOTE.E2, 0, NOTE.D2, NOTE.D2, NOTE.F2, NOTE.E2],
    arp: [NOTE.E4, NOTE.G4, NOTE.Bb4, NOTE.E5, NOTE.E4, NOTE.G4, NOTE.D5, NOTE.Bb4, NOTE.F4, NOTE.A4, NOTE.C5, NOTE.F5, NOTE.E4, NOTE.G4, NOTE.B4, NOTE.E5],
    lead: [NOTE.E5, NOTE.Bb4, 0, NOTE.G4, NOTE.E5, 0, NOTE.F5, 0, NOTE.E5, NOTE.D5, 0, NOTE.Bb4, NOTE.G4, 0, NOTE.E4, 0],
    pad: [NOTE.E3, NOTE.G3, NOTE.Bb3],
    drums: true,
    intensity: 1.15,
  },
  victory: {
    bpm: 110,
    swing: 0.02,
    bass: [NOTE.C3, 0, NOTE.C3, 0, NOTE.G2, 0, NOTE.G2, 0, NOTE.A2, 0, NOTE.A2, 0, NOTE.F2, 0, NOTE.G2, 0],
    arp: [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5, NOTE.B3, NOTE.D4, NOTE.G4, NOTE.B4, NOTE.A3, NOTE.C4, NOTE.E4, NOTE.A4, NOTE.F3, NOTE.A3, NOTE.C4, NOTE.F4],
    lead: [NOTE.G4, 0, NOTE.E4, NOTE.G4, NOTE.C5, 0, 0, NOTE.B4, NOTE.A4, 0, NOTE.E4, 0, NOTE.F4, NOTE.G4, 0, 0],
    pad: [NOTE.C4, NOTE.E4, NOTE.G4],
    drums: false,
    intensity: 0.7,
  },
};

/** Lightweight Web Audio synth + optional looping file BGM for Ferrum Wing. */
export class AudioBus {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.volume = this.loadVolume();
    this.muted = this.loadMuted();
    this.musicDuck = 1;
    this.musicMode = "title";
    this.musicPlaying = false;
    this.musicTimer = null;
    this.nextNoteTime = 0;
    this.step = 0;
    this.padNodes = null;
    this.trackEl = null;
    this.trackNode = null;
    this.trackUrl = null;
    this.trackName = null;
    this.usingFileTrack = false;
    this.onTrackChange = null;
    this.readyPromise = this.bootstrapTracks();
  }

  async bootstrapTracks() {
    try {
      await this.restoreCustomTrack();
    } catch {
      /* ignore — fall back to bundled / procedural */
    }
    if (!this.trackUrl) {
      try {
        await this.tryLoadBundledBgm();
      } catch {
        /* ignore — procedural synth remains */
      }
    }
  }

  getTrackLabel() {
    return this.trackName;
  }

  hasCustomTrack() {
    return !!this.trackUrl;
  }

  loadVolume() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const v = raw == null ? 0.7 : Number(raw);
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.7;
  }

  loadMuted() {
    return localStorage.getItem(MUTE_KEY) === "1";
  }

  persist() {
    localStorage.setItem(STORAGE_KEY, String(this.volume));
    localStorage.setItem(MUTE_KEY, this.muted ? "1" : "0");
  }

  unlock() {
    if (this.ctx) {
      this.resume();
      this.syncFileTrackPlayback();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      this.enabled = false;
      return;
    }
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain.gain.value = SFX_BASE_GAIN;
    this.musicGain.gain.value = MUSIC_BASE_GAIN;
    this.sfxGain.connect(this.master);
    this.musicGain.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.wireTrackElement();
    this.applyGain();
    this.applyMusicBus();
    this.resume();
    // Ensure bundled/custom BGM is ready before starting music.
    Promise.resolve(this.readyPromise).finally(() => {
      if (!this.musicPlaying && !this.usingFileTrack) {
        this.setMusic(this.musicMode || "title");
      } else {
        this.syncFileTrackPlayback();
      }
    });
  }

  applyGain() {
    if (!this.master) return;
    const value = this.muted ? 0 : BASE_GAIN * this.volume;
    const t = this.ctx?.currentTime ?? 0;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(value, t, 0.02);
    this.syncFileTrackPlayback();
  }

  applyMusicBus() {
    if (!this.musicGain) return;
    const t = this.ctx?.currentTime ?? 0;
    const value = MUSIC_BASE_GAIN * this.musicDuck;
    this.musicGain.gain.cancelScheduledValues(t);
    this.musicGain.gain.setTargetAtTime(value, t, 0.08);
  }

  /** Multiply BGM bus (1 = full, 0.35 = 35% of normal level). */
  setMusicDuck(factor = 1) {
    this.musicDuck = Math.max(0, Math.min(1, Number(factor) || 0));
    this.applyMusicBus();
  }

  clearMusicDuck() {
    this.setMusicDuck(1);
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, Number(v) || 0));
    if (this.volume > 0 && this.muted) this.muted = false;
    this.applyGain();
    this.persist();
    if (!this.muted && this.ctx && !this.musicPlaying && !this.usingFileTrack) {
      this.setMusic(this.musicMode);
    }
  }

  getVolume() {
    return this.volume;
  }

  setMuted(muted) {
    this.muted = !!muted;
    this.applyGain();
    this.persist();
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  isMuted() {
    return this.muted || this.volume <= 0;
  }

  resume() {
    if (this.ctx?.state === "suspended") this.ctx.resume();
  }

  ready() {
    return this.enabled && this.ctx && this.sfxGain && !this.isMuted();
  }

  tone(freq, duration, type = "square", gain = 0.2, slide = 0, delay = 0) {
    if (!this.ready()) return;
    this.resume();
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (slide) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + duration);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  noise(duration, gain = 0.15, freq = 900, delay = 0) {
    if (!this.ready()) return;
    this.resume();
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    src.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = 0.7;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(t0);
  }

  // --- File / custom BGM ------------------------------------------------

  wireTrackElement() {
    if (!this.ctx || !this.musicGain || this.trackNode) return;
    if (!this.trackEl) {
      this.trackEl = new Audio();
      this.trackEl.loop = true;
      this.trackEl.preload = "auto";
      this.trackEl.crossOrigin = "anonymous";
    }
    try {
      this.trackNode = this.ctx.createMediaElementSource(this.trackEl);
      this.trackNode.connect(this.musicGain);
    } catch {
      /* already wired */
    }
  }

  usesFileForMode(mode = this.musicMode) {
    if (!this.trackUrl) return false;
    // Custom track covers title + combat intensity; keep short victory cue synth-only.
    return mode !== "victory";
  }

  syncFileTrackPlayback() {
    if (!this.trackEl || !this.trackUrl) return;
    if (this.usingFileTrack && !this.muted && this.volume > 0) {
      const play = this.trackEl.play();
      if (play?.catch) play.catch(() => {});
    } else {
      this.trackEl.pause();
    }
  }

  async tryLoadBundledBgm() {
    for (const url of BUNDLED_BGM) {
      const ok = await this.urlExists(url);
      if (!ok) continue;
      await this.setCustomTrackFromUrl(url, url.split("/").pop());
      return true;
    }
    return false;
  }

  urlExists(url) {
    return new Promise((resolve) => {
      const probe = new Audio();
      const done = (value) => {
        probe.onloadedmetadata = null;
        probe.onerror = null;
        probe.removeAttribute("src");
        probe.load();
        resolve(value);
      };
      probe.preload = "metadata";
      probe.onloadedmetadata = () => done(true);
      probe.onerror = () => done(false);
      probe.src = url;
    });
  }

  async setCustomTrackFromFile(file) {
    if (!file) throw new Error("No audio file selected");
    const blob = file instanceof Blob ? file : null;
    if (!blob) throw new Error("Invalid audio file");
    const name = file.name || "Custom BGM";
    await this.persistCustomTrack(blob, name);
    const url = URL.createObjectURL(blob);
    await this.applyTrackUrl(url, name, true);
    return name;
  }

  async setCustomTrackFromUrl(url, name = "Bundled BGM") {
    await this.applyTrackUrl(url, name, false);
    return name;
  }

  async applyTrackUrl(url, name, revokePreviousObjectUrl) {
    if (revokePreviousObjectUrl && this.trackUrl && this.trackUrl.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(this.trackUrl);
      } catch {
        /* ignore */
      }
    }
    if (!this.trackEl) {
      this.trackEl = new Audio();
      this.trackEl.loop = true;
      this.trackEl.preload = "auto";
      this.trackEl.crossOrigin = "anonymous";
    }
    this.trackUrl = url;
    this.trackName = name;
    this.trackEl.loop = true;
    this.trackEl.src = url;
    try {
      this.trackEl.load();
    } catch {
      /* ignore */
    }
    if (this.ctx) this.wireTrackElement();
    this.notifyTrackChange();
    if (this.ctx) this.setMusic(this.musicMode);
  }

  clearCustomTrack() {
    this.pauseFileTrack();
    if (this.trackUrl?.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(this.trackUrl);
      } catch {
        /* ignore */
      }
    }
    this.trackUrl = null;
    this.trackName = null;
    if (this.trackEl) {
      this.trackEl.removeAttribute("src");
      try {
        this.trackEl.load();
      } catch {
        /* ignore */
      }
    }
    this.clearPersistedTrack();
    this.notifyTrackChange();
    if (this.ctx) this.setMusic(this.musicMode);
  }

  notifyTrackChange() {
    if (typeof this.onTrackChange === "function") this.onTrackChange(this.trackName);
  }

  openDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        resolve(null);
        return;
      }
      const req = indexedDB.open(BGM_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(BGM_STORE)) db.createObjectStore(BGM_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
  }

  async persistCustomTrack(blob, name) {
    const db = await this.openDb();
    if (!db) return;
    await new Promise((resolve) => {
      try {
        const tx = db.transaction(BGM_STORE, "readwrite");
        tx.objectStore(BGM_STORE).put({ blob, name, savedAt: Date.now() }, BGM_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
    db.close();
  }

  async clearPersistedTrack() {
    const db = await this.openDb();
    if (!db) return;
    await new Promise((resolve) => {
      try {
        const tx = db.transaction(BGM_STORE, "readwrite");
        tx.objectStore(BGM_STORE).delete(BGM_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
    db.close();
  }

  async restoreCustomTrack() {
    const db = await this.openDb();
    if (!db) return false;
    const record = await new Promise((resolve) => {
      try {
        const tx = db.transaction(BGM_STORE, "readonly");
        const req = tx.objectStore(BGM_STORE).get(BGM_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    db.close();
    if (!record?.blob) return false;
    const url = URL.createObjectURL(record.blob);
    await this.applyTrackUrl(url, record.name || "Custom BGM", false);
    return true;
  }

  pauseFileTrack() {
    this.usingFileTrack = false;
    if (this.trackEl) {
      try {
        this.trackEl.pause();
      } catch {
        /* ignore */
      }
    }
  }

  startFileTrack() {
    if (!this.trackUrl || !this.trackEl) return false;
    this.usingFileTrack = true;
    this.stopSynthMusic();
    if (this.ctx) this.wireTrackElement();
    this.resume();
    this.syncFileTrackPlayback();
    return true;
  }

  stopSynthMusic() {
    this.musicPlaying = false;
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
    this.stopPad();
  }

  // --- Background music -------------------------------------------------

  setMusic(mode = "title") {
    this.musicMode = TRACKS[mode] ? mode : "title";
    if (!this.ctx || !this.musicGain) return;
    this.resume();

    if (this.usesFileForMode(this.musicMode)) {
      this.startFileTrack();
      return;
    }

    this.pauseFileTrack();
    this.stopPad();
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    if (!this.musicPlaying) {
      this.musicPlaying = true;
      this.pumpMusic();
    }
    this.startPad();
  }

  stopMusic() {
    this.stopSynthMusic();
    this.pauseFileTrack();
  }

  startPad() {
    if (!this.ctx || !this.musicGain) return;
    const track = TRACKS[this.musicMode];
    const t0 = this.ctx.currentTime;
    const nodes = [];
    for (const freq of track.pad) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      osc.type = "sine";
      osc.frequency.value = freq;
      filter.type = "lowpass";
      filter.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.03 * track.intensity, t0 + 1.2);
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.musicGain);
      osc.start(t0);
      nodes.push({ osc, g });
    }
    this.padNodes = nodes;
  }

  stopPad() {
    if (!this.padNodes) return;
    const t0 = this.ctx?.currentTime ?? 0;
    for (const n of this.padNodes) {
      try {
        n.g.gain.cancelScheduledValues(t0);
        n.g.gain.setTargetAtTime(0.0001, t0, 0.2);
        n.osc.stop(t0 + 0.5);
      } catch {
        /* already stopped */
      }
    }
    this.padNodes = null;
  }

  pumpMusic() {
    if (!this.musicPlaying || !this.ctx || this.usingFileTrack) return;
    const track = TRACKS[this.musicMode];
    const secondsPerBeat = 60 / track.bpm;
    const stepDur = secondsPerBeat / 2; // 8th notes
    const horizon = this.ctx.currentTime + 0.2;

    while (this.nextNoteTime < horizon) {
      const i = this.step % 16;
      const swing = i % 2 === 1 ? stepDur * track.swing : 0;
      const t = this.nextNoteTime + swing;
      const intensity = track.intensity;

      if (track.bass[i]) this.musicNote(track.bass[i], t, stepDur * 0.9, "sawtooth", 0.08 * intensity, 180);
      if (track.arp[i]) this.musicNote(track.arp[i], t, stepDur * 0.55, "triangle", 0.04 * intensity, 2400);
      if (track.lead[i]) this.musicNote(track.lead[i], t, stepDur * 1.1, "square", 0.032 * intensity, 1800);

      if (track.drums) {
        if (i % 4 === 0) this.musicKick(t, 0.1 * intensity);
        if (i % 4 === 2) this.musicHat(t, 0.04 * intensity);
        if (i === 4 || i === 12) this.musicHat(t, 0.055 * intensity);
        if (i === 8) this.musicKick(t, 0.06 * intensity);
      }

      this.nextNoteTime += stepDur;
      this.step += 1;
    }

    this.musicTimer = setTimeout(() => this.pumpMusic(), 40);
  }

  musicNote(freq, time, duration, type, gain, filterFreq) {
    if (!this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(filterFreq, time);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  musicKick(time, gain) {
    if (!this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.14);
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    osc.connect(g);
    g.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  musicHat(time, gain) {
    if (!this.musicGain) return;
    const len = Math.floor(this.ctx.sampleRate * 0.05);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    src.buffer = buffer;
    filter.type = "highpass";
    filter.frequency.value = 6000;
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.musicGain);
    src.start(time);
  }

  // --- SFX --------------------------------------------------------------

  shoot(weapon) {
    if (weapon === "rocket") {
      // Thruster whoosh + bass launch thump + descending growl
      this.noise(0.14, 0.28, 320);
      this.noise(0.2, 0.16, 900, 0.04);
      this.tone(110, 0.14, "sine", 0.32, -50);
      this.tone(220, 0.24, "sawtooth", 0.26, -140);
      this.tone(70, 0.3, "triangle", 0.16, -15, 0.03);
    } else if (weapon === "plasma") {
      // Heavy energy pulse: low thump, mid blast, bright harmonic
      this.tone(140, 0.16, "sine", 0.3, -40);
      this.tone(280, 0.14, "sawtooth", 0.26, -120);
      this.tone(560, 0.1, "square", 0.14, 180);
      this.tone(840, 0.08, "triangle", 0.1, 220, 0.03);
      this.noise(0.08, 0.16, 1100);
    } else if (weapon === "ion") {
      // Electric arc: rising zap + sparkle crackle
      this.tone(640, 0.09, "sawtooth", 0.2, 420);
      this.tone(980, 0.07, "triangle", 0.22, 320);
      this.tone(1480, 0.06, "sine", 0.14, 260);
      this.tone(2100, 0.05, "sine", 0.09, 0, 0.02);
      this.noise(0.05, 0.12, 2800);
    } else {
      // Kinetic gun: sharp metallic crack + body thump
      this.tone(980, 0.045, "square", 0.18, -280);
      this.tone(420, 0.065, "triangle", 0.14, -100);
      this.tone(180, 0.06, "sine", 0.12, -40);
      this.noise(0.04, 0.14, 2200);
    }
  }

  superLaser() {
    // Charge snap → sustained beam roar → high scream
    this.tone(180, 0.14, "sawtooth", 0.3, 220);
    this.tone(90, 0.5, "sawtooth", 0.36, -20);
    this.tone(360, 0.38, "square", 0.18, 80, 0.04);
    this.tone(1200, 0.3, "sine", 0.16, 400, 0.06);
    this.tone(2400, 0.24, "triangle", 0.1, 200, 0.08);
    this.noise(0.4, 0.32, 500);
    this.noise(0.22, 0.2, 1600, 0.05);
    this.noise(0.16, 0.14, 3200, 0.1);
  }

  hit() {
    this.noise(0.05, 0.07, 1400);
    this.tone(220, 0.06, "square", 0.05, -80);
  }

  explosion(big = false) {
    if (big) {
      this.noise(0.4, 0.24, 280);
      this.noise(0.25, 0.12, 700, 0.05);
      this.tone(70, 0.35, "sawtooth", 0.16, -30);
      this.tone(140, 0.2, "triangle", 0.08, -60, 0.04);
    } else {
      this.noise(0.16, 0.14, 500);
      this.tone(120, 0.14, "sawtooth", 0.1, -50);
    }
  }

  pickup(type = "generic") {
    this.unlock();
    if (type === "shield") {
      this.tone(520, 0.08, "sine", 0.12, 180);
      this.tone(780, 0.1, "sine", 0.1, 220, 0.07);
      this.tone(1040, 0.12, "triangle", 0.08, 0, 0.14);
    } else if (type === "repair") {
      this.tone(360, 0.09, "triangle", 0.11, 120);
      this.tone(540, 0.1, "sine", 0.1, 160, 0.08);
      this.tone(720, 0.12, "sine", 0.08, 0, 0.16);
    } else if (type === "super") {
      this.tone(440, 0.08, "square", 0.1, 200);
      this.tone(660, 0.1, "sine", 0.11, 240, 0.07);
      this.tone(880, 0.12, "triangle", 0.1, 280, 0.14);
      this.tone(1320, 0.14, "sine", 0.07, 0, 0.22);
    } else if (type === "rocket") {
      this.tone(200, 0.08, "sawtooth", 0.1, 100);
      this.tone(300, 0.1, "square", 0.08, 140, 0.07);
      this.noise(0.08, 0.06, 600, 0.05);
    } else if (type === "ammo") {
      this.tone(600, 0.06, "square", 0.08, 100);
      this.tone(800, 0.07, "square", 0.07, 120, 0.06);
      this.tone(1000, 0.09, "triangle", 0.06, 0, 0.12);
    } else {
      this.tone(500, 0.07, "sine", 0.1, 160);
      this.tone(750, 0.1, "sine", 0.09, 200, 0.07);
    }
  }

  powerup() {
    this.pickup("generic");
  }

  alert() {
    this.tone(196, 0.12, "square", 0.1, 30);
    this.tone(155, 0.16, "square", 0.1, -25, 0.11);
  }

  launch() {
    this.noise(0.2, 0.1, 350);
    this.tone(110, 0.22, "sawtooth", 0.12, 280);
    this.tone(220, 0.12, "triangle", 0.06, 160, 0.08);
  }

  hurt() {
    this.noise(0.1, 0.12, 700);
    this.tone(180, 0.12, "sawtooth", 0.1, -70);
    this.tone(90, 0.15, "square", 0.07, -20, 0.04);
  }
}
