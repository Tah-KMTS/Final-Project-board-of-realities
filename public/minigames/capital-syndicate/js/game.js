import { AudioBus } from "./audio.js";
import { createIntroCutscene } from "./cutscenes.js";
import {
  W,
  H,
  clamp,
  aabb,
  createPlayer,
  WEAPONS,
  MAX_LEVEL,
  spawnEnemy,
  spawnBoss,
  spawnPowerup,
  spawnPickupAmmo,
  pickUpgradeChoices,
  applyUpgrade,
  UPGRADE_POOL,
} from "./entities.js";
import { getSprites, drawSprite } from "./sprites.js";
import { loadPickupAtlas } from "./pickups.js";
import { loadEnemyAtlas } from "./enemies.js";
import { loadPlayerAtlas } from "./playerSprites.js";
import {
  createJuiceState,
  addTrauma,
  hitStop,
  impactFlash,
  decayJuice,
  shakeOffset,
  lerpSquash,
  setSquash,
  spawnBurst,
  spawnSparks,
  spawnSmoke,
  spawnMuzzle,
  spawnExplosion,
  updateParticles,
  drawParticles,
  drawGlow,
  drawPostFx,
} from "./juice.js";

const STATES = {
  TITLE: "title",
  CUTSCENE: "cutscene",
  PLAYING: "playing",
  PAUSED: "paused",
  LEVEL_CLEAR: "levelclear",
  UPGRADE: "upgrade",
  VICTORY_BANNER: "victorybanner",
  GAME_OVER: "gameover",
  VICTORY: "victory",
};

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.audio = new AudioBus();
    this.state = STATES.TITLE;
    this.keys = new Set();
    this.mouse = { x: W / 2, y: H - 140, down: false, inCanvas: false };
    this.last = 0;
    this.accum = 0;
    this.step = 1 / 60;
    this.stars = this.makeStars(120);
    this.particles = [];
    this.shake = 0;
    this.juice = createJuiceState();
    this.selfDestructArmed = 0;
    this.message = null;
    this.cutscene = null;
    this.sprites = getSprites();
    this.pickupAtlas = null;
    this.enemyAtlas = null;
    this.playerAtlas = null;
    this.animTime = 0;
    this.muzzleFlashes = [];
    loadPickupAtlas().then((atlas) => {
      this.pickupAtlas = atlas;
    });
    loadEnemyAtlas().then((atlas) => {
      this.enemyAtlas = atlas;
    });
    loadPlayerAtlas().then((atlas) => {
      this.playerAtlas = atlas;
    });
    this.bindUi();
    this.bindInput();
    this.resetRun();
    requestAnimationFrame((t) => this.frame(t));
  }

  bindUi() {
    this.ui = {
      hud: document.getElementById("hud"),
      title: document.getElementById("title-screen"),
      briefing: document.getElementById("briefing-screen"),
      cutscene: document.getElementById("cutscene-screen"),
      pause: document.getElementById("pause-screen"),
      gameover: document.getElementById("gameover-screen"),
      victory: document.getElementById("victory-screen"),
      levelclear: document.getElementById("levelclear-screen"),
      upgrade: document.getElementById("upgrade-screen"),
      upgradeChoices: document.getElementById("upgrade-choices"),
      upgradeLevel: document.getElementById("upgrade-ship-level"),
      score: document.getElementById("hud-score"),
      level: document.getElementById("hud-level"),
      lives: document.getElementById("hud-lives"),
      shield: document.getElementById("bar-shield"),
      hull: document.getElementById("bar-hull"),
      laser: document.getElementById("bar-laser"),
      ammoGun: document.getElementById("ammo-gun"),
      ammoIon: document.getElementById("ammo-ion"),
      ammoPlasma: document.getElementById("ammo-plasma"),
      ammoRocket: document.getElementById("ammo-rocket"),
      finalScore: document.getElementById("final-score"),
      finalLevel: document.getElementById("final-level"),
      victoryScore: document.getElementById("victory-score"),
      levelClearTitle: document.getElementById("level-clear-title"),
      levelClearSub: document.getElementById("level-clear-sub"),
      shipLevel: document.getElementById("hud-ship-level"),
    };

    document.getElementById("btn-start").addEventListener("click", () => this.startGame());
    document.getElementById("btn-restart").addEventListener("click", () => this.startGame());
    document.getElementById("btn-victory-restart").addEventListener("click", () => this.startGame());
    document.getElementById("btn-resume").addEventListener("click", () => this.resume());
    const skipBtn = document.getElementById("btn-skip-cutscene");
    if (skipBtn) skipBtn.addEventListener("click", () => this.skipCutscene());
    if (this.ui.upgradeChoices) {
      this.ui.upgradeChoices.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-upgrade]");
        if (!btn) return;
        this.chooseUpgrade(btn.dataset.upgrade);
      });
    }
    document.getElementById("btn-how").addEventListener("click", () => {
      this.ui.title.classList.add("hidden");
      this.ui.briefing.classList.remove("hidden");
    });
    document.getElementById("btn-brief-back").addEventListener("click", () => {
      this.ui.briefing.classList.add("hidden");
      this.ui.title.classList.remove("hidden");
    });

    this.ui.muteBtn = document.getElementById("btn-mute");
    this.ui.volumeSlider = document.getElementById("volume-slider");
    this.ui.volumeValue = document.getElementById("volume-value");
    this.ui.volumeControl = document.getElementById("volume-control");

    this.ui.volumeSlider.value = String(Math.round(this.audio.getVolume() * 100));
    this.syncVolumeUi();

    this.ui.muteBtn.addEventListener("click", () => {
      this.audio.unlock();
      this.audio.toggleMute();
      this.audio.setMusic(this.currentMusicMode());
      this.syncVolumeUi();
    });
    const onVolumeInput = () => {
      this.audio.unlock();
      this.audio.setVolume(Number(this.ui.volumeSlider.value) / 100);
      this.audio.setMusic(this.currentMusicMode());
      this.syncVolumeUi();
    };
    // First interaction can start title music
    const bootMusic = () => {
      this.audio.unlock();
      this.audio.setMusic(this.currentMusicMode());
    };
    window.addEventListener("pointerdown", bootMusic, { once: true });
    window.addEventListener("keydown", bootMusic, { once: true });
    this.ui.volumeSlider.addEventListener("input", onVolumeInput);
    this.ui.volumeSlider.addEventListener("change", onVolumeInput);
    // Keep slider drags from steering the fighter
    for (const ev of ["pointerdown", "pointerup", "click", "mousedown", "mouseup", "touchstart"]) {
      this.ui.volumeControl.addEventListener(ev, (e) => e.stopPropagation());
    }
  }

  syncVolumeUi() {
    const pct = Math.round(this.audio.getVolume() * 100);
    const muted = this.audio.muted;
    this.ui.volumeSlider.value = String(pct);
    this.ui.volumeValue.textContent = muted ? "OFF" : String(pct);
    this.ui.muteBtn.classList.toggle("is-muted", muted || pct === 0);
    this.ui.muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
    this.ui.muteBtn.textContent = muted || pct === 0 ? "MUTE" : "VOL";
    this.ui.muteBtn.title = muted ? "Unmute" : "Mute";
  }

  bindInput() {
    window.addEventListener("keydown", (e) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
      this.keys.add(e.code);
      if (this.state === STATES.CUTSCENE && (e.code === "Space" || e.code === "Enter" || e.code === "Escape")) {
        e.preventDefault();
        this.skipCutscene();
        return;
      }
      if (e.code === "Space" && this.state === STATES.PLAYING && this.laserCharge >= 100) {
        e.preventDefault();
        this.fireSuperLaser();
        return;
      }
      if (e.code === "Digit1") this.setWeapon("gun");
      if (e.code === "Digit2") this.setWeapon("ion");
      if (e.code === "Digit3") this.setWeapon("plasma");
      if (e.code === "Digit4") this.setWeapon("rocket");
      if (e.code === "KeyM") {
        this.audio.unlock();
        this.audio.toggleMute();
        this.syncVolumeUi();
      }
      if (e.code === "KeyP" || e.code === "Escape") this.togglePause();
      if (e.code === "Digit0" || e.code === "Enter" || e.code === "Numpad0") {
        this.armSelfDestruct();
      }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));

    const toLocal = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * W,
        y: ((e.clientY - rect.top) / rect.height) * H,
      };
    };

    this.canvas.addEventListener("pointermove", (e) => {
      const p = toLocal(e);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.mouse.inCanvas = true;
    });
    this.canvas.addEventListener("pointerdown", (e) => {
      this.audio.unlock();
      if (this.state === STATES.CUTSCENE) {
        this.skipCutscene();
        return;
      }
      if (e.button === 0) this.mouse.down = true;
      if (e.button === 2) {
        e.preventDefault();
        this.armSelfDestruct();
      }
    });
    window.addEventListener("pointerup", (e) => {
      if (e.button === 0) this.mouse.down = false;
    });
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    this.canvas.addEventListener("pointerleave", () => {
      this.mouse.inCanvas = false;
    });
  }

  makeStars(n) {
    const stars = [];
    for (let i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        z: 0.35 + Math.random() * 1.4,
        s: 0.6 + Math.random() * 1.8,
      });
    }
    return stars;
  }

  resetRun() {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.player = createPlayer();
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.powerups = [];
    this.particles = [];
    this.waveIndex = 0;
    this.waveTimer = 0;
    this.spawnQueue = [];
    this.boss = null;
    this.levelKills = 0;
    this.levelGoal = 0;
    this.levelPhase = "waves";
    this.clearTimer = 0;
    this.combo = 0;
    this.laserCharge = 0;
    this.superLaser = null;
    this.bossLaser = null;
    this.killShakeScale = 1;
    this.selfDestructUsed = false;
    this.selfDestructArmed = 0;
  }

  currentMusicMode() {
    if (this.state === STATES.VICTORY) return "victory";
    if (this.state === STATES.CUTSCENE) return "cutscene";
    if (
      this.state === STATES.PLAYING ||
      this.state === STATES.LEVEL_CLEAR ||
      this.state === STATES.VICTORY_BANNER ||
      this.state === STATES.UPGRADE ||
      this.state === STATES.PAUSED
    ) {
      if (this.levelPhase === "boss" || this.levelPhase === "victoryBanner") return "boss";
      return "combat";
    }
    return "title";
  }

  syncMusic() {
    this.audio.setMusic(this.currentMusicMode());
  }

  startGame() {
    this.audio.unlock();
    this.audio.launch();
    this.resetRun();
    this.beginIntroCutscene();
  }

  beginIntroCutscene() {
    // Keep BGM under the intro video at 35% so dialogue/SFX can cut through.
    this.audio.setMusic("cutscene");
    this.audio.setMusicDuck(0.22); // keep BGM under opening VO
    this.cutscene = createIntroCutscene(() => this.beginGameplay());
    this.cutsceneStartedAt = performance.now();
    this.state = STATES.CUTSCENE;
    this.showScreen("cutscene");
  }

  beginGameplay() {
    this.cutscene = null;
    this.audio.clearMusicDuck();
    this.buildLevel();
    this.state = STATES.PLAYING;
    this.showScreen("playing");
    this.flashMessage("FIGHTER DEPLOYED", 1.4);
    this.audio.launch();
    this.syncMusic();
  }

  showVictory() {
    this.cutscene = null;
    this.state = STATES.VICTORY;
    this.ui.victoryScore.textContent = String(this.score);
    this.showScreen("victory");
    this.audio.setMusic("victory");
    this.audio.explosion(true);
    // Keep a little combat juice under the overlay while Zlisto cheers.
    spawnExplosion(this.particles, W * 0.5, H * 0.32, { big: true });
    spawnExplosion(this.particles, W * 0.5 + 70, H * 0.32 + 40, { big: false });
    spawnExplosion(this.particles, W * 0.5 - 90, H * 0.32 + 20, { big: false });
    addTrauma(this.juice, 0.28);
    impactFlash(this.juice, "rgba(255,160,60,0.2)", 0.2, 0.45);
    this.flashMessage("AGENT ZLISTO — VICTORY", 1.6);
  }

  skipCutscene() {
    if (this.state !== STATES.CUTSCENE || !this.cutscene) return;
    if (performance.now() - (this.cutsceneStartedAt || 0) < 400) return;
    this.cutscene.skip();
  }

  showScreen(mode) {
    const { hud, title, briefing, cutscene, pause, gameover, victory, levelclear, upgrade } = this.ui;
    title.classList.add("hidden");
    briefing.classList.add("hidden");
    if (cutscene) cutscene.classList.add("hidden");
    pause.classList.add("hidden");
    gameover.classList.add("hidden");
    victory.classList.add("hidden");
    levelclear.classList.add("hidden");
    if (upgrade) upgrade.classList.add("hidden");
    hud.classList.add("hidden");

    if (mode === "playing") hud.classList.remove("hidden");
    if (mode === "title") title.classList.remove("hidden");
    if (mode === "cutscene" && cutscene) cutscene.classList.remove("hidden");
    if (mode === "pause") {
      hud.classList.remove("hidden");
      pause.classList.remove("hidden");
    }
    if (mode === "gameover") {
      this.ui.finalScore.textContent = String(this.score);
      this.ui.finalLevel.textContent = String(this.level);
      gameover.classList.remove("hidden");
    }
    if (mode === "victory") victory.classList.remove("hidden");
    if (mode === "levelclear") {
      hud.classList.remove("hidden");
      levelclear.classList.remove("hidden");
    }
    if (mode === "upgrade" && upgrade) {
      hud.classList.remove("hidden");
      upgrade.classList.remove("hidden");
    }
    if (mode === "victorybanner") {
      hud.classList.remove("hidden");
    }
  }

  togglePause() {
    if (this.state === STATES.PLAYING) {
      this.state = STATES.PAUSED;
      this.showScreen("pause");
    } else if (this.state === STATES.PAUSED) {
      this.resume();
    }
  }

  resume() {
    if (this.state !== STATES.PAUSED) return;
    this.state = STATES.PLAYING;
    this.showScreen("playing");
  }

  setWeapon(name) {
    if (!this.player?.alive) return;
    if (name !== "gun" && this.player.ammo[name] <= 0) {
      this.flashMessage("NO AMMO", 0.8);
      return;
    }
    this.player.weapon = name;
  }

  armSelfDestruct() {
    if (this.state !== STATES.PLAYING || !this.player.alive) return;
    if (this.selfDestructUsed) {
      this.flashMessage("SELF-DESTRUCT SPENT THIS SECTOR", 1.1);
      return;
    }
    const now = performance.now();
    if (now - this.selfDestructArmed < 700) {
      this.selfDestruct();
      this.selfDestructArmed = 0;
    } else {
      this.selfDestructArmed = now;
      this.flashMessage("SELF-DESTRUCT ARMED — PRESS AGAIN", 0.9);
    }
  }

  selfDestruct() {
    if (this.selfDestructUsed) return;
    this.selfDestructUsed = true;
    const p = this.player;
    const ejected = spawnPickupAmmo(p.x, p.y - 20, {
      ion: Math.floor(p.ammo.ion * 0.5),
      plasma: Math.floor(p.ammo.plasma * 0.5),
      rocket: Math.floor(p.ammo.rocket * 0.5),
      gun: 0,
    });
    this.powerups.push(ejected);
    this.burst(p.x, p.y, "#4de8ff", 36, 280);
    this.audio.explosion(true);
    this.shake = 10;
    addTrauma(this.juice, 0.35);
    hitStop(this.juice, 0.08);
    impactFlash(this.juice, "rgba(255,79,216,0.16)", 0.16, 0.4);
    spawnExplosion(this.particles, p.x, p.y, { big: true });

    let bossDestroyed = false;
    // Clear nearby hostiles only (not the whole sky).
    for (const e of this.enemies) {
      if (e.type === "boss") {
        e.hp -= 80; // was 260 — self-destruct is a panic tool, not a boss melt
        e.flash = 0.2;
        if (e.hp <= 0) {
          this.killEnemy(e, true);
          bossDestroyed = true;
        }
        continue;
      }
      if (Math.hypot(e.x - p.x, e.y - p.y) < 280) this.killEnemy(e, true);
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    this.enemyBullets = this.enemyBullets.filter(
      (b) => Math.hypot(b.x - p.x, b.y - p.y) > 220
    );

    this.loseLife(true);
    if (bossDestroyed && this.state !== STATES.GAME_OVER) {
      const bossesLeft = this.enemies.some((e) => e.type === "boss" && e.hp > 0);
      if (!bossesLeft) this.defeatBoss();
      else this.boss = this.enemies.find((e) => e.type === "boss" && e.hp > 0) || null;
    }
  }

  buildLevel() {
    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.powerups = [];
    this.boss = null;
    this.bossLaser = null;
    this.waveIndex = 0;
    this.waveTimer = 1.2;
    this.spawnQueue = [];
    this.levelPhase = "waves";
    this.levelKills = 0;
    this.selfDestructUsed = false;
    this.selfDestructArmed = 0;

    const waves = [];
    const isFinal = this.level >= MAX_LEVEL;
    const waveCount = isFinal ? 9 : 5 + Math.min(3, this.level);
    const base = 4 + this.level + (isFinal ? 3 : 0);
    for (let w = 0; w < waveCount; w++) {
      const pack = [];
      const count = base + w;
      for (let i = 0; i < count; i++) {
        let type = "scout";
        const roll = Math.random();
        if (this.level >= 2 && roll > 0.5) type = "lancer";
        if (this.level >= 3 && roll > 0.7) type = "heavy";
        if (isFinal && roll > 0.55) type = "heavy";
        if (roll > 0.84 || (isFinal && roll > 0.78)) type = "dart";
        pack.push({
          type,
          delay: i * (0.12 + Math.max(0, 0.06 - this.level * 0.01)),
          x: 60 + Math.random() * (W - 120),
        });
      }
      waves.push(pack);
    }
    this.waves = waves;
    this.levelGoal = waves.reduce((n, pack) => n + pack.length, 0);
  }

  flashMessage(text, time = 1.2) {
    this.message = { text, t: time };
  }

  frame(t) {
    const now = t * 0.001;
    let dt = Math.min(0.05, now - (this.last || now));
    this.last = now;
    this.animTime += dt;
    if (this.muzzleFlashes.length) {
      for (const m of this.muzzleFlashes) m.t -= dt;
      this.muzzleFlashes = this.muzzleFlashes.filter((m) => m.t > 0);
    }

    // Freeze-frame: keep rendering juice/flash, pause simulation
    if (this.juice.hitstop > 0 && (this.state === STATES.PLAYING || this.state === STATES.LEVEL_CLEAR || this.state === STATES.VICTORY_BANNER)) {
      decayJuice(this.juice, dt);
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);
      this.draw();
      requestAnimationFrame((nt) => this.frame(nt));
      return;
    }

    if (
      this.state === STATES.PLAYING ||
      this.state === STATES.LEVEL_CLEAR ||
      this.state === STATES.VICTORY_BANNER
    ) {
      this.accum += dt;
      while (this.accum >= this.step) {
        this.update(this.step);
        this.accum -= this.step;
      }
    } else if (this.state === STATES.CUTSCENE && this.cutscene) {
      this.accum = 0;
      this.cutscene.update(dt);
    } else {
      this.accum = 0;
      this.updateDecor(dt);
    }

    this.draw();
    requestAnimationFrame((nt) => this.frame(nt));
  }

  updateDecor(dt) {
    for (const s of this.stars) {
      s.y += 40 * s.z * dt;
      if (s.y > H) {
        s.y = -4;
        s.x = Math.random() * W;
      }
    }
    updateParticles(this.particles, dt);
    decayJuice(this.juice, dt);
    if (this.message) {
      this.message.t -= dt;
      if (this.message.t <= 0) this.message = null;
    }
  }

  update(dt) {
    this.updateDecor(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);
    if (this.killShakeScale < 1) {
      this.killShakeScale = Math.min(1, this.killShakeScale + dt * 1.35);
    }
    if (this.player) {
      lerpSquash(this.player, dt, 12);
      if (this.player.hitFlash > 0) this.player.hitFlash -= dt;
    }
    for (const e of this.enemies) {
      if (e.type === "boss") {
        e.sx = 1;
        e.sy = 1;
      } else {
        lerpSquash(e, dt, 10);
      }
    }

    if (this.levelPhase === "waves") this.updateWaves(dt);
    else if (this.levelPhase === "boss") this.updateBossPhase(dt);
    else if (this.levelPhase === "clear") {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) this.openUpgradeSelect();
    } else if (this.levelPhase === "victoryBanner") {
      this.clearTimer -= dt;
      this.victoryBannerT = (this.victoryBannerT || 0) + dt;
      if (this.clearTimer <= 0) this.showVictory();
    }

    this.updatePlayer(dt);
    this.updateBullets(dt);
    this.updateEnemies(dt);
    this.updatePowerups(dt);
    this.resolveCollisions();
    this.syncHud();
  }

  updateWaves(dt) {
    this.waveTimer -= dt;
    if (this.spawnQueue.length) {
      for (const item of this.spawnQueue) item.delay -= dt;
      while (this.spawnQueue.length && this.spawnQueue[0].delay <= 0) {
        const item = this.spawnQueue.shift();
        this.enemies.push(spawnEnemy(item.type, item.x, -40, this.level));
      }
    } else if (this.waveTimer <= 0 && this.waveIndex < this.waves.length) {
      this.spawnQueue = this.waves[this.waveIndex].map((x) => ({ ...x }));
      this.waveIndex += 1;
      this.waveTimer = 1.55;
    } else if (
      this.waveIndex >= this.waves.length &&
      !this.spawnQueue.length &&
      this.enemies.length === 0
    ) {
      this.levelPhase = "boss";
      const pairCount = this.level === 3 ? 2 : 1;
      const bosses = [];
      for (let i = 0; i < pairCount; i++) {
        bosses.push(spawnBoss(this.level, { pairIndex: i, pairCount }));
      }
      this.boss = bosses[0];
      this.enemies.push(...bosses);
      const label =
        this.level >= MAX_LEVEL
          ? "FINAL BOSS — BLOCKADE COMMANDER"
          : pairCount > 1
            ? `TWIN BOSSES — SECTOR ${this.level}`
            : `BOSS — SECTOR ${this.level}`;
      this.flashMessage(label, 1.8);
      this.audio.alert();
      this.audio.setMusic("boss");
    }
  }

  updateBossPhase() {
    // handled via enemy updates / defeatBoss
  }

  nextLevel() {
    if (this.level >= MAX_LEVEL) {
      this.showVictory();
      return;
    }
    this.level += 1;
    this.ui.levelclear.classList.add("hidden");
    if (this.ui.upgrade) this.ui.upgrade.classList.add("hidden");
    this.player.invuln = 1.5;
    this.player.shield = Math.min(100, this.player.shield + 25);
    this.player.ammo.ion += 12;
    this.player.ammo.plasma += 8;
    this.player.ammo.rocket += 2;
    this.buildLevel();
    this.state = STATES.PLAYING;
    this.showScreen("playing");
    this.flashMessage(this.level >= MAX_LEVEL ? "FINAL SECTOR" : `SECTOR ${this.level}`, 1.3);
    this.audio.setMusic("combat");
  }

  updatePlayer(dt) {
    const p = this.player;
    if (!p.alive) return;

    let ax = 0;
    let ay = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) ax -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) ax += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) ay -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) ay += 1;

    const usingKeys = ax !== 0 || ay !== 0;
    if (usingKeys) {
      const len = Math.hypot(ax, ay) || 1;
      p.vx = (ax / len) * 420;
      p.vy = (ay / len) * 420;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    } else if (this.mouse.inCanvas) {
      const dx = this.mouse.x - p.x;
      const dy = this.mouse.y - p.y;
      p.x += dx * Math.min(1, 12 * dt);
      p.y += dy * Math.min(1, 12 * dt);
      p.vx = dx;
      p.vy = dy;
    } else {
      p.vx *= 0.85;
      p.vy *= 0.85;
    }

    p.x = clamp(p.x, 28, W - 28);
    p.y = clamp(p.y, 60, H - 40);

    if (p.invuln > 0) p.invuln -= dt;
    if (p.fireCd > 0) p.fireCd -= dt;

    p.trail.push({ x: p.x, y: p.y + 18, life: 0.25 });
    if (p.trail.length > 12) p.trail.shift();
    for (const t of p.trail) t.life -= dt;

    // engine dust / thruster particles
    if (Math.random() < 0.55) {
      spawnBurst(this.particles, p.x + (Math.random() - 0.5) * 10, p.y + 22, {
        count: 1,
        speed: 50,
        colors: ["#ffb040", "#ff6a30", "#ffe08a", "#ffffff"],
        life: 0.18,
        size: 1.8,
        gravity: 60,
        drag: 1,
        glow: true,
        spread: 0.5,
        angle: Math.PI / 2,
        sprite: "thrust",
      });
    }

    // Hold click to fire. Space is reserved for super laser when charged;
    // otherwise Space still fires the current weapon.
    const spaceFire = this.keys.has("Space") && this.laserCharge < 100;
    const firing = this.mouse.down || spaceFire;
    if (firing) this.tryFire(dt);
    this.updateSuperLaser(dt);
  }

  tryFire() {
    const p = this.player;
    if (p.fireCd > 0) return;
    let weapon = p.weapon;
    if (weapon !== "gun" && p.ammo[weapon] <= 0) {
      weapon = "gun";
      p.weapon = "gun";
    }
    const def = WEAPONS[weapon];
    const up = p.upgrades || {};
    if (weapon !== "gun") {
      p.ammo[weapon] -= def.cost;
      if (p.ammo[weapon] < 0) p.ammo[weapon] = 0;
    }
    let rate = def.rate;
    let damage = def.damage;
    if (weapon === "gun" && up.minigun) {
      rate *= 0.8; // +20% attack speed
      damage *= 1.1;
    }
    p.fireCd = rate;

    setSquash(p, 0.82, 1.22);
    spawnMuzzle(this.particles, p.x, p.y - 26);
    this.muzzleFlashes.push({ x: p.x, y: p.y - 26, t: 0.12, weapon });

    if (weapon === "rocket") {
      const count = up.rocketCount || 1;
      for (let i = 0; i < count; i++) {
        const ox = count > 1 ? (i === 0 ? -16 : 16) : 0;
        this.bullets.push({
          x: p.x + ox,
          y: p.y - 28,
          w: 16,
          h: 30,
          vy: -def.speed,
          vx: count > 1 ? ox * 0.6 : 0,
          damage: def.damage,
          pierce: false,
          splash: def.splash,
          splashDamage: def.splashDamage,
          homing: def.homing,
          color: def.color,
          life: 2.6,
          weapon,
        });
      }
      this.audio.shoot("rocket");
      addTrauma(this.juice, 0.06);
      return;
    }

    if (weapon === "plasma") {
      const n = up.plasmaShots || 2;
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : i / (n - 1) - 0.5;
        this.bullets.push({
          x: p.x + t * 26,
          y: p.y - 24,
          w: 12,
          h: 22,
          vy: -def.speed,
          vx: t * 90,
          damage: def.damage,
          pierce: false,
          splash: 0,
          color: def.color,
          life: 1.4,
          weapon,
        });
      }
      this.audio.shoot("plasma");
      return;
    }

    if (weapon === "ion") {
      const widthMul = up.ionWidthMul || 1;
      this.bullets.push({
        x: p.x,
        y: p.y - 24,
        w: 8 * widthMul,
        h: 28,
        vy: -def.speed,
        vx: 0,
        damage: def.damage,
        pierce: true,
        splash: 0,
        color: def.color,
        life: 1.4,
        weapon,
      });
      this.audio.shoot("ion");
      return;
    }

    // Gun / minigun
    const spread = 1;
    for (let i = -spread; i <= spread; i++) {
      this.bullets.push({
        x: p.x + i * 10,
        y: p.y - 24,
        w: 6,
        h: 16,
        vy: -def.speed,
        vx: i * 40,
        damage,
        pierce: false,
        splash: 0,
        color: up.minigun ? "#ffe08a" : def.color,
        life: 1.4,
        weapon,
      });
    }
    this.audio.shoot("gun");
  }

  updateBullets(dt) {
    for (const b of this.bullets) {
      if (b.homing && b.weapon === "rocket") {
        let best = null;
        let bestD = Infinity;
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          // Prefer threats ahead, but allow a wider forward seek cone.
          const d = Math.hypot(e.x - b.x, e.y - b.y);
          if (d < bestD && e.y < b.y + 120 && d < 520) {
            bestD = d;
            best = e;
          }
        }
        if (best) {
          const ang = Math.atan2(best.y - b.y, best.x - b.x);
          const speed = Math.max(WEAPONS.rocket.speed, Math.hypot(b.vx || 0, b.vy));
          const tx = Math.cos(ang) * speed;
          const ty = Math.sin(ang) * speed;
          // Stronger turn-in than the old 3-shot cone missiles.
          const turn = Math.min(1, b.homing * dt * 0.018);
          b.vx = (b.vx || 0) + (tx - (b.vx || 0)) * turn;
          b.vy = b.vy + (ty - b.vy) * turn;
        }
      }
      b.x += (b.vx || 0) * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.weapon === "rocket" && Math.random() < 0.7) {
        spawnBurst(this.particles, b.x, b.y + 12, {
          count: 1,
          speed: 30,
          colors: ["#ffb040", "#ff6a30", "#fff2a0"],
          life: 0.2,
          size: 2.2,
          gravity: -10,
          drag: 1,
          glow: true,
          spread: 0.6,
          angle: Math.PI / 2,
        });
      } else if (b.weapon !== "rocket" && Math.random() < 0.35) {
        spawnBurst(this.particles, b.x, b.y + 8, {
          count: 1,
          speed: 20,
          color: b.color,
          life: 0.12,
          size: 1.4,
          gravity: 0,
          drag: 2,
          glow: true,
          spread: 0.4,
          angle: Math.PI / 2,
        });
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0 && b.y > -40 && b.y < H + 40);

    for (const b of this.enemyBullets) {
      b.x += (b.vx || 0) * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      // Lighter trails — less screen clutter in dense fights
      if (Math.random() < (b.fromFinal ? 0.25 : 0.55)) {
        spawnBurst(this.particles, b.x, b.y, {
          count: 1,
          speed: 30,
          colors: b.heavy ? ["#ffb060", "#ffe08a"] : ["#ffffff", "#b8d0ff"],
          life: 0.16,
          size: b.heavy ? 2.4 : 2,
          glow: true,
          gravity: 0,
          spread: Math.PI * 2,
          angle: Math.atan2(-(b.vy || 1), -(b.vx || 0)),
        });
      }
    }
    this.enemyBullets = this.enemyBullets.filter((b) => b.life > 0 && b.y < H + 40 && b.y > -40);
  }

  updateEnemies(dt) {
    const survivors = [];
    this.pendingSpawns = [];
    for (const e of this.enemies) {
      e.age += dt;
      if (e.flash > 0) e.flash -= dt;
      this.moveEnemy(e, dt);

      if (e.type === "boss" && e.final && e.entered) {
        this.updateFinalBoss(e, dt);
      } else if (e.type === "boss" && !e.final && e.entered) {
        this.updateSectorBoss(e, dt);
      }

      if (e.fireRate > 0 && e.y > 20 && e.y < H - 80 && e.charging <= 0 && !e.laserState) {
        e.fireCd -= dt;
        if (e.fireCd <= 0) {
          this.enemyShoot(e);
          const haste = e.final ? Math.max(0.75, 1.25 - e.bossPhase * 0.12) : 1;
          e.fireCd = e.fireRate * (0.85 + Math.random() * 0.4) * haste;
        }
      }

      if (e.y - e.h / 2 > H) {
        this.enemyEscaped(e);
        continue;
      }
      if (e.hp > 0) survivors.push(e);
    }
    this.enemies = survivors.concat(this.pendingSpawns);
    this.pendingSpawns = [];
  }

  updateFinalBoss(e, dt) {
    const ratio = e.hp / e.maxHp;
    e.bossPhase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;

    e.specialCd -= dt;
    e.spawnCd -= dt;
    e.chargeCd -= dt;
    e.laserCd -= dt;

    // Escorts keep spawning even during laser charge/fire
    if (e.spawnCd <= 0) {
      for (let i = 0; i < 3; i++) {
        const type = Math.random() > 0.4 ? "dart" : "scout";
        this.pendingSpawns.push(
          spawnEnemy(type, e.x + (i - 1) * 48, e.y + 28, this.level)
        );
      }
      this.flashMessage("COMMANDER DEPLOYS ESCORTS", 1);
      e.spawnCd = 4;
      this.audio.alert();
    }

    if (e.laserState) {
      this.updateBossLaser(e, dt);
      return;
    }

    if (e.specialCd <= 0 && e.charging <= 0) {
      this.finalBossSpecial(e);
      e.specialCd = e.bossPhase === 1 ? 3.8 : e.bossPhase === 2 ? 3.0 : 2.3;
    }

    if (e.laserCd <= 0 && e.charging <= 0) {
      this.startBossLaser(e);
      return;
    }

    if (e.chargeCd <= 0 && e.bossPhase >= 2 && e.charging <= 0) {
      const ang = Math.atan2(this.player.y - e.y, this.player.x - e.x);
      e.charging = 0.85;
      e.chargeVx = Math.cos(ang) * 420;
      e.chargeVy = Math.sin(ang) * 420;
      e.chargeCd = e.bossPhase === 3 ? 3.2 : 4.8;
      this.flashMessage("INCOMING CHARGE", 0.8);
    }
  }

  startBossLaser(e) {
    e.laserState = "telegraph";
    e.laserT = 10; // 10s charge / telegraph
    e.laserAimX = this.player.x;
    e.laserHalfW = e.bossPhase === 3 ? 30 : e.bossPhase === 2 ? 26 : 22;
    e.laserHitCd = 0;
    e.laserFireEmitted = false;
    this.bossLaser = {
      owner: e,
      state: "telegraph",
      t: 10,
      aimX: e.laserAimX,
      halfW: e.laserHalfW,
    };
    this.flashMessage("LASER CHARGING", 1.2);
    this.audio.alert();
    addTrauma(this.juice, 0.08);
  }

  updateBossLaser(e, dt) {
    e.laserT -= dt;
    if (this.bossLaser && this.bossLaser.owner === e) {
      this.bossLaser.t = e.laserT;
      this.bossLaser.state = e.laserState;
    }

    // Track more during charge; lock harder once firing
    const track = e.laserState === "telegraph" ? 1.35 : 0.2;
    e.laserAimX += (this.player.x - e.laserAimX) * Math.min(1, track * dt);
    e.laserAimX = clamp(e.laserAimX, 40, W - 40);
    if (this.bossLaser && this.bossLaser.owner === e) {
      this.bossLaser.aimX = e.laserAimX;
      this.bossLaser.halfW = e.laserHalfW;
    }

    if (e.laserState === "telegraph") {
      if (Math.random() < 0.45) {
        spawnBurst(this.particles, e.laserAimX + (Math.random() - 0.5) * e.laserHalfW, e.y + e.h * 0.4, {
          count: 1,
          speed: 50,
          colors: ["#ff6a30", "#ffe08a", "#ffffff"],
          life: 0.25,
          size: 2.2,
          glow: true,
          gravity: 40,
          angle: Math.PI / 2,
          spread: 0.35,
        });
      }
      if (e.laserT <= 0) {
        e.laserState = "fire";
        e.laserT = 2; // beam lasts 2 seconds
        e.laserHitCd = 0;
        e.laserFireEmitted = true;
        if (this.bossLaser && this.bossLaser.owner === e) {
          this.bossLaser.state = "fire";
          this.bossLaser.t = 2;
        }
        this.flashMessage("BEAM FIRE", 0.9);
        addTrauma(this.juice, 0.35);
        impactFlash(this.juice, "rgba(255,120,40,0.28)", 0.18, 0.55);
        this.shake = Math.max(this.shake, 12);
        this.audio.alert();
        this.audio.explosion(false);
        // Immediate opening blast so fire is unmistakable
        this.emitBossLaserBolts(e, true);
      }
      return;
    }

    if (e.laserState === "fire") {
      e.laserHitCd -= dt;
      this.applyBossLaserDamage(e);
      // Continuous damaging bolts down the beam corridor
      this.emitBossLaserBolts(e, false);
      if (Math.random() < 0.9) {
        spawnBurst(this.particles, e.laserAimX + (Math.random() - 0.5) * e.laserHalfW * 1.4, e.y + 40 + Math.random() * (H - e.y - 60), {
          count: 2,
          speed: 50,
          colors: ["#ff4a20", "#ffb040", "#fff2c0", "#ffffff"],
          life: 0.22,
          size: 3.2,
          glow: true,
          gravity: 0,
          spread: Math.PI * 2,
        });
      }
      if (e.laserT <= 0) {
        e.laserState = null;
        e.laserCd = 8;
        e.specialCd = Math.max(e.specialCd, 0.8);
        if (this.bossLaser && this.bossLaser.owner === e) this.bossLaser = null;
      }
    }
  }

  applyBossLaserDamage(e) {
    const p = this.player;
    if (!p?.alive || p.y <= e.y) return;
    const half = (e.laserHalfW || 22) + p.w * 0.45;
    if (Math.abs(p.x - e.laserAimX) > half) return;
    if (e.laserHitCd > 0) return;
    this.damagePlayer(e.bossPhase >= 3 ? 18 : 14);
    e.laserHitCd = 0.1;
    spawnSparks(this.particles, p.x, p.y, 8);
    addTrauma(this.juice, 0.1);
  }

  emitBossLaserBolts(e, burst) {
    const count = burst ? 14 : 3;
    const half = e.laserHalfW || 22;
    for (let i = 0; i < count; i++) {
      const ox = (Math.random() - 0.5) * half * 1.6;
      this.enemyBullets.push({
        x: e.laserAimX + ox,
        y: e.y + e.h * 0.45 + (burst ? i * 18 : Math.random() * 30),
        w: burst ? 10 : 8,
        h: burst ? 28 : 22,
        vx: ox * 0.15,
        vy: 780 + Math.random() * 120,
        damage: 16,
        color: i % 2 ? "#ffe08a" : "#ff4a20",
        life: 1.2,
        heavy: true,
        fromFinal: true,
        laserBolt: true,
      });
    }
  }

  updateSectorBoss(e, dt) {
    const ratio = e.hp / e.maxHp;
    e.bossPhase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    e.specialCd -= dt;
    e.chargeCd -= dt;

    if (e.specialCd <= 0 && e.charging <= 0) {
      this.sectorBossSpecial(e);
      e.specialCd = e.bossPhase === 1 ? 3.2 : e.bossPhase === 2 ? 2.6 : 2.0;
    }

    if (e.chargeCd <= 0 && e.bossPhase >= 2 && e.charging <= 0 && (e.sectorLevel || 1) >= 2) {
      const ang = Math.atan2(this.player.y - e.y, this.player.x - e.x);
      e.charging = 0.7;
      e.chargeVx = Math.cos(ang) * (340 + e.bossPhase * 40);
      e.chargeVy = Math.sin(ang) * (340 + e.bossPhase * 40);
      e.chargeCd = e.bossPhase === 3 ? 4.2 : 5.5;
      this.flashMessage("SECTOR CHARGE", 0.7);
    }
  }

  sectorBossSpecial(e) {
    const phase = e.bossPhase || 1;
    e.attackIndex = (e.attackIndex || 0) + 1;
    const kinds = phase >= 3 ? ["ring", "sweep", "sides", "fan"] : phase >= 2 ? ["ring", "sweep", "fan"] : ["fan", "ring"];
    const kind = kinds[e.attackIndex % kinds.length];
    if (kind === "ring") this.finalBossRing(e, 6 + phase);
    else if (kind === "sweep") this.finalBossSweep(e);
    else if (kind === "sides") this.finalBossSides(e);
    else this.finalBossFan(e);
  }

  finalBossSpecial(e) {
    const phase = e.bossPhase || 1;
    e.attackIndex = (e.attackIndex || 0) + 1;
    const pools = {
      1: ["ring", "fan", "sweep"],
      2: ["ring", "spiral", "sweep", "sides", "fan"],
      3: ["ring", "spiral", "sweep", "sides", "burst", "fan"],
    };
    const pool = pools[phase] || pools[1];
    const kind = pool[e.attackIndex % pool.length];
    if (kind === "ring") this.finalBossRing(e, phase >= 3 ? 10 : 7);
    else if (kind === "spiral") this.finalBossSpiral(e);
    else if (kind === "sweep") this.finalBossSweep(e);
    else if (kind === "sides") this.finalBossSides(e);
    else if (kind === "fan") this.finalBossFan(e);
    else if (kind === "burst") {
      this.finalBossRing(e, 8);
      this.finalBossSpiral(e);
    }
  }

  finalBossRing(e, count) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + e.phase;
      this.enemyBullets.push({
        x: e.x,
        y: e.y,
        w: 8,
        h: 8,
        vx: Math.cos(a) * (220 + e.bossPhase * 30),
        vy: Math.sin(a) * (220 + e.bossPhase * 30),
        damage: 11,
        color: "#ffb020",
        life: 3.5,
        heavy: true,
        fromFinal: true,
      });
    }
  }

  finalBossSpiral(e) {
    const arms = e.bossPhase >= 3 ? 3 : 2;
    const n = e.bossPhase >= 3 ? 10 : 8;
    for (let arm = 0; arm < arms; arm++) {
      for (let i = 0; i < n; i++) {
        const a = e.phase * 1.7 + (Math.PI * 2 * arm) / arms + i * 0.28;
        const speed = 160 + i * 18 + e.bossPhase * 20;
        this.enemyBullets.push({
          x: e.x,
          y: e.y,
          w: 7,
          h: 7,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          damage: 9,
          color: i % 2 ? "#f2f5ff" : "#ff8a40",
          life: 3.2,
          heavy: i % 2 === 0,
          fromFinal: true,
        });
      }
    }
  }

  finalBossSweep(e) {
    const aim = Math.atan2(this.player.y - e.y, this.player.x - e.x);
    const shots = 5 + e.bossPhase;
    const spread = 0.55 + e.bossPhase * 0.08;
    for (let i = 0; i < shots; i++) {
      const t = shots === 1 ? 0.5 : i / (shots - 1);
      const a = aim - spread / 2 + t * spread;
      this.enemyBullets.push({
        x: e.x,
        y: e.y + e.h / 2,
        w: 8,
        h: 10,
        vx: Math.cos(a) * (300 + e.bossPhase * 35),
        vy: Math.sin(a) * (300 + e.bossPhase * 35),
        damage: 10,
        color: "#ffe08a",
        life: 3.0,
        heavy: true,
        fromFinal: true,
      });
    }
  }

  finalBossSides(e) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        this.enemyBullets.push({
          x: e.x + side * (e.w * 0.45),
          y: e.y + 10 + i * 8,
          w: 7,
          h: 11,
          vx: side * (40 + i * 18),
          vy: e.bulletSpeed * (0.75 + i * 0.08),
          damage: 10,
          color: side < 0 ? "#1a1e26" : "#f2f5ff",
          life: 2.8,
          heavy: side < 0,
          fromFinal: true,
        });
      }
    }
  }

  finalBossFan(e) {
    const aim = Math.atan2(this.player.y - e.y, this.player.x - e.x);
    const shots = 3 + e.bossPhase;
    for (let i = 0; i < shots; i++) {
      const a = aim + (i - (shots - 1) / 2) * 0.16;
      this.enemyBullets.push({
        x: e.x,
        y: e.y + e.h / 2,
        w: 8,
        h: 8,
        vx: Math.cos(a) * e.bulletSpeed,
        vy: Math.sin(a) * e.bulletSpeed,
        damage: 11,
        color: i % 2 ? "#f2f5ff" : "#1a1e26",
        life: 3.1,
        heavy: i % 2 === 0,
        fromFinal: true,
      });
    }
  }

  moveEnemy(e, dt) {
    if (e.type === "boss") {
      const holdY = e.final ? 150 : 130;
      if (!e.entered) {
        e.y += 80 * dt;
        if (e.y >= holdY) {
          e.y = holdY;
          e.entered = true;
        }
        return;
      }
      e.phase += dt;

      if (e.charging > 0) {
        e.charging -= dt;
        e.x += e.chargeVx * dt;
        e.y += e.chargeVy * dt;
        e.x = clamp(e.x, 50, W - 50);
        e.y = clamp(e.y, 80, H * 0.55);
        if (e.charging <= 0) {
          e.chargeVx = 0;
          e.chargeVy = 0;
        }
        return;
      }

      // Lerp toward patrol path so charge recovery doesn't teleport/warp
      let targetX;
      let targetY;
      if (e.final) {
        const amp = e.bossPhase === 3 ? 0.4 : 0.34;
        const speed = e.bossPhase === 3 ? 1.45 : 1.15;
        targetX = W / 2 + Math.sin(e.phase * speed) * (W * amp);
        targetY = holdY + Math.sin(e.phase * 2.1) * (e.bossPhase === 3 ? 40 : 28);
      } else {
        const slot = e.slotX || 0;
        const amp = slot ? 0.18 : 0.28;
        targetX = W / 2 + slot + Math.sin(e.phase * 0.9 + (e.pairPhase || 0)) * (W * amp);
        targetY = holdY + Math.sin(e.phase * 1.7 + (e.pairPhase || 0)) * 18;
      }
      const follow = Math.min(1, 3.2 * dt);
      e.x += (targetX - e.x) * follow;
      e.y += (targetY - e.y) * follow;
      return;
    }

    if (e.pattern === "drift") {
      e.y += e.speed * dt;
      e.x += Math.sin(e.age * 2 + e.phase) * 40 * dt;
    } else if (e.pattern === "sine") {
      e.y += e.speed * dt;
      e.x += Math.sin(e.age * 3 + e.phase) * 120 * dt;
    } else if (e.pattern === "tank") {
      e.y += e.speed * dt;
      e.x += Math.sin(e.age * 1.2 + e.phase) * 20 * dt;
    } else if (e.pattern === "dive") {
      e.y += e.speed * dt * (1 + e.age * 0.35);
      e.x += Math.sin(e.phase) * 30 * dt;
    }
    e.x = clamp(e.x, 30, W - 30);
  }

  enemyShoot(e) {
    const aim = Math.atan2(this.player.y - e.y, this.player.x - e.x);
    const black = e.polarity === "black" || e.final;
    const bulletColor = black ? "#1a1e26" : "#f2f5ff";
    spawnBurst(this.particles, e.x, e.y + e.h / 2, {
      count: e.final ? 4 : e.type === "boss" ? 8 : 8,
      speed: 140,
      colors: black ? ["#ff8a40", "#ffc060", "#ffffff"] : ["#ffffff", "#c8dcff", "#7aa6ff"],
      life: 0.22,
      size: e.final ? 2.4 : 3.4,
      glow: true,
      gravity: 0,
      angle: aim,
      spread: 0.7,
    });
    if (e.final) {
      const phase = e.bossPhase || 1;
      e.shotStyle = ((e.shotStyle || 0) + 1) % 3;
      if (e.shotStyle === 0) {
        // Aimed fan
        const shots = 2 + phase;
        const spread = 0.1 + phase * 0.02;
        for (let i = 0; i < shots; i++) {
          const a = aim + (i - (shots - 1) / 2) * spread;
          const dark = i % 2 === 0;
          this.enemyBullets.push({
            x: e.x,
            y: e.y + e.h / 2,
            w: 8,
            h: 8,
            vx: Math.cos(a) * e.bulletSpeed,
            vy: Math.sin(a) * e.bulletSpeed,
            damage: 12,
            color: dark ? "#1a1e26" : "#f2f5ff",
            life: 3.2,
            heavy: dark,
            fromFinal: true,
          });
        }
      } else if (e.shotStyle === 1) {
        // Cross / rotating spokes
        const spokes = 3 + phase;
        for (let i = 0; i < spokes; i++) {
          const a = e.phase * 2.2 + (Math.PI * 2 * i) / spokes;
          this.enemyBullets.push({
            x: e.x,
            y: e.y,
            w: 7,
            h: 7,
            vx: Math.cos(a) * (210 + phase * 25),
            vy: Math.sin(a) * (210 + phase * 25),
            damage: 9,
            color: i % 2 ? "#f2f5ff" : "#1a1e26",
            life: 2.6,
            heavy: i % 2 === 0,
            fromFinal: true,
          });
        }
      } else {
        // Vertical pillar volley toward player lane
        for (let i = -1; i <= 1; i++) {
          this.enemyBullets.push({
            x: e.x + i * 30,
            y: e.y + e.h / 2,
            w: 7,
            h: 12,
            vx: i * 16 + (this.player.x - e.x) * 0.04,
            vy: e.bulletSpeed * 0.95,
            damage: 11,
            color: bulletColor,
            life: 2.8,
            heavy: black,
            fromFinal: true,
          });
        }
        if (phase >= 3) {
          const a = aim;
          this.enemyBullets.push({
            x: e.x,
            y: e.y + e.h / 2,
            w: 9,
            h: 9,
            vx: Math.cos(a) * (e.bulletSpeed + 40),
            vy: Math.sin(a) * (e.bulletSpeed + 40),
            damage: 12,
            color: "#ffb020",
            life: 3.0,
            heavy: true,
            fromFinal: true,
          });
        }
      }
      return;
    }

    // Sector 2+ bosses alternate spread volley with a focused gun stream
    if (e.type === "boss" && e.altGun) {
      e.shotStyle = ((e.shotStyle || 0) + 1) % 2;
      if (e.shotStyle === 1) {
        for (let i = 0; i < 5; i++) {
          this.enemyBullets.push({
            x: e.x + (i - 2) * 3,
            y: e.y + e.h / 2 + i * 6,
            w: 6,
            h: 10,
            vx: Math.cos(aim) * (e.bulletSpeed + 40) + (i - 2) * 8,
            vy: Math.sin(aim) * (e.bulletSpeed + 40),
            damage: 14,
            color: "#9ec8ff",
            life: 2.8,
            heavy: false,
          });
        }
        return;
      }
    }

    const shots = e.type === "boss" ? 5 : e.type === "heavy" ? 3 : 1;
    const spread = 0.18;
    for (let i = 0; i < shots; i++) {
      const a = aim + (i - (shots - 1) / 2) * spread;
      this.enemyBullets.push({
        x: e.x,
        y: e.y + e.h / 2,
        w: 7,
        h: 7,
        vx: Math.cos(a) * e.bulletSpeed,
        vy: Math.sin(a) * e.bulletSpeed,
        damage: e.type === "boss" ? 16 : 12,
        color: bulletColor,
        life: 3,
        heavy: black || e.type === "heavy" || e.type === "boss",
      });
    }
  }

  enemyEscaped(e) {
    if (e.type === "boss") return;
    this.burst(e.x, H - 10, "#ff5a6e", 10, 120);
    // Enemies that slip past simply leave — no fighter penalty
  }

  updatePowerups(dt) {
    const kept = [];
    for (const p of this.powerups) {
      p.y += p.vy * dt;
      p.bob = (p.bob || 0) + dt * 4;
      if (p.y - p.h / 2 > H) {
          if (p.type === "super") {
            this.lives += 1;
            this.flashMessage("EXTRA FIGHTER SECURED", 1.3);
            this.audio.pickup("super");
          } else if (p.passScore) {
            this.score += p.passScore;
            this.flashMessage(`+${p.passScore} LET PASS`, 0.9);
            this.audio.pickup("generic");
          }
        continue;
      }
      kept.push(p);
    }
    this.powerups = kept;
  }

  resolveCollisions() {
    const p = this.player;
    if (!p.alive) return;

    // player bullets vs enemies
    for (const b of this.bullets) {
      if (b.spent) continue;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (!aabb(b, e)) continue;
        e.hp -= b.damage;
        e.flash = b.weapon === "rocket" ? 0.1 : 0.05;
        setSquash(e, 1.25, 0.75);
        spawnSparks(this.particles, b.x, b.y, b.weapon === "rocket" ? 16 : 7);
        if (b.weapon === "rocket") {
          spawnSmoke(this.particles, b.x, b.y, 10);
          addTrauma(this.juice, 0.23); // ~40% less than previous 0.38
          hitStop(this.juice, 0.06);
          impactFlash(this.juice, "rgba(255,79,216,0.14)", 0.14, 0.4);
          spawnExplosion(this.particles, b.x, b.y, { big: false });
        } else {
          addTrauma(this.juice, 0.04);
          if (!b.pierce || Math.random() < 0.3) this.audio.hit();
        }
        this.burst(b.x, b.y, b.color, b.weapon === "rocket" ? 18 : 5, b.weapon === "rocket" ? 220 : 100);
        if (b.splash) this.applySplash(b, e);
        if (!b.pierce) b.spent = true;
        if (e.hp <= 0) this.killEnemy(e);
        if (!b.pierce) break;
      }
    }
    this.bullets = this.bullets.filter((b) => !b.spent);
    this.enemies = this.enemies.filter((e) => e.hp > 0);

    // enemy bullets vs player
    for (const b of this.enemyBullets) {
      if (b.spent) continue;
      if (aabb(b, p)) {
        b.spent = true;
        this.damagePlayer(b.damage);
      }
    }
    this.enemyBullets = this.enemyBullets.filter((b) => !b.spent);

    // ram
    for (const e of this.enemies) {
      if (aabb(p, e)) {
        const dmg = e.type === "boss" ? 28 : 18;
        this.damagePlayer(dmg);
        e.hp -= 35;
        e.flash = 0.12;
        setSquash(e, 1.3, 0.7);
        setSquash(p, 1.2, 0.8);
        spawnSparks(this.particles, (p.x + e.x) / 2, (p.y + e.y) / 2, 14);
        addTrauma(this.juice, 0.18);
        hitStop(this.juice, 0.04);
        this.burst((p.x + e.x) / 2, (p.y + e.y) / 2, "#fff2cc", 12, 160);
        if (e.hp <= 0) this.killEnemy(e);
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);

    // powerups
    const left = [];
    for (const up of this.powerups) {
      if (aabb(p, up)) {
        this.collectPowerup(up);
      } else left.push(up);
    }
    this.powerups = left;
  }

  applySplash(b, primary) {
    const r = b.splash;
    for (const e of this.enemies) {
      if (e === primary || e.hp <= 0) continue;
      const d = Math.hypot(e.x - b.x, e.y - b.y);
      if (d <= r) {
        const falloff = 1 - d / r;
        e.hp -= (b.splashDamage || b.damage * 0.5) * falloff;
        e.flash = 0.1;
        setSquash(e, 1.2, 0.8);
        if (e.hp <= 0) this.killEnemy(e);
      }
    }
    this.shake = Math.max(this.shake, 6); // ~40% less than previous rocket splash shake (10)
    spawnExplosion(this.particles, b.x, b.y, { big: false });
    addTrauma(this.juice, 0.12); // was 0.2 — ~40% less
    impactFlash(this.juice, "rgba(255,122,61,0.12)", 0.12, 0.35);
    this.audio.explosion(false);
  }

  killEnemy(e, fromSuicide = false) {
    if (e._dead) return;
    e._dead = true;
    e.hp = 0;
    const big = e.type === "boss";
    if (big) {
      // Epic screen punch — bosses only
      spawnExplosion(this.particles, e.x, e.y, { big: true });
      this.burst(e.x, e.y, "#ff4fd8", 36, 380);
      addTrauma(this.juice, 0.72);
      this.shake = Math.max(this.shake, 18);
      hitStop(this.juice, 0.14);
      impactFlash(this.juice, "rgba(255,90,200,0.28)", 0.28, 0.55);
      this.addLaserCharge(20);
      this.killShakeScale = 1;
    } else {
      spawnExplosion(this.particles, e.x, e.y, { big: false });
      this.burst(e.x, e.y, "#4de8ff", 14, 220);
      // Soften shake when many small kills chain together
      const scale = this.killShakeScale ?? 1;
      addTrauma(this.juice, 0.08 * scale);
      this.shake = Math.max(this.shake, 3.2 * scale);
      this.killShakeScale = Math.max(0.12, scale * 0.42);
      this.addLaserCharge(5);
    }
    this.audio.explosion(big);
    if (!fromSuicide) {
      this.score += e.score;
      this.levelKills += 1;
      this.combo += 1;
      if (Math.random() < 0.07 + Math.min(0.05, this.combo * 0.005)) {
        const types = ["shield", "repair", "super", "rocket"];
        const max = this.level >= 2 ? 4 : 3;
        const type = types[(Math.random() * max) | 0];
        this.powerups.push(spawnPowerup(type, e.x, e.y));
      }
      if (Math.random() < 0.04) {
        this.powerups.push(
          spawnPickupAmmo(e.x, e.y, {
            ion: 8 + ((Math.random() * 8) | 0),
            plasma: 4 + ((Math.random() * 6) | 0),
            rocket: 1 + ((Math.random() * 2) | 0),
            gun: 0,
          })
        );
      } else if (Math.random() < 0.03) {
        this.powerups.push(spawnPowerup("rocket", e.x, e.y));
      }
    }
    if (e.type === "boss" && !fromSuicide) {
      const remaining = this.enemies.some((x) => x.type === "boss" && x !== e && !x._dead && x.hp > 0);
      if (remaining) {
        this.boss = this.enemies.find((x) => x.type === "boss" && x !== e && !x._dead && x.hp > 0) || null;
        this.flashMessage("WINGMAN DOWN", 1.1);
      } else {
        this.defeatBoss();
      }
    }
  }

  defeatBoss() {
    if (
      this.levelPhase === "clear" ||
      this.levelPhase === "victory" ||
      this.levelPhase === "victoryBanner" ||
      this.state === STATES.UPGRADE
    ) {
      return;
    }
    this.score += 1000 * this.level;
    this.burst(W / 2, 160, this.level >= MAX_LEVEL ? "#ffb020" : "#3ef0d0", 60, 360);
    this.audio.explosion(true);
    this.boss = null;
    this.enemies = this.enemies.filter((e) => e.type !== "boss");

    if (this.level >= MAX_LEVEL) {
      this.levelPhase = "victoryBanner";
      this.clearTimer = 3.2;
      this.victoryBannerT = 0;
      this.state = STATES.VICTORY_BANNER;
      this.showScreen("victorybanner");
      this.flashMessage("VICTORY", 2.8);
      addTrauma(this.juice, 0.4);
      impactFlash(this.juice, "rgba(255,200,80,0.28)", 0.28, 0.55);
      return;
    }

    this.levelPhase = "clear";
    this.clearTimer = 1.6;
    this.state = STATES.LEVEL_CLEAR;
    this.ui.levelClearTitle.textContent = `Sector ${this.level} Cleared`;
    this.ui.levelClearSub.textContent = "Ship level-up inbound…";
    this.showScreen("levelclear");
  }

  openUpgradeSelect() {
    if (this.state === STATES.UPGRADE) return;
    const taken = this.player?.upgrades?.taken || [];
    this.upgradeOptions = pickUpgradeChoices(taken, 3);
    this.state = STATES.UPGRADE;
    this.levelPhase = "upgrade";
    if (this.ui.upgradeLevel) {
      this.ui.upgradeLevel.textContent = String((this.player.shipLevel || 1) + 1);
    }
    if (this.ui.upgradeChoices) {
      this.ui.upgradeChoices.innerHTML = this.upgradeOptions
        .map(
          (u) => `
        <button type="button" class="upgrade-card" data-upgrade="${u.id}">
          <span class="upgrade-card-title">${u.title}</span>
          <span class="upgrade-card-desc">${u.desc}</span>
        </button>`
        )
        .join("");
    }
    this.showScreen("upgrade");
    this.audio.alert();
  }

  chooseUpgrade(id) {
    if (this.state !== STATES.UPGRADE) return;
    const valid = (this.upgradeOptions || []).some((u) => u.id === id) || UPGRADE_POOL.some((u) => u.id === id);
    if (!valid) return;
    applyUpgrade(this.player, id);
    const label = UPGRADE_POOL.find((u) => u.id === id)?.title || "UPGRADE";
    this.flashMessage(`SHIP LV ${this.player.shipLevel} — ${label}`, 1.6);
    this.audio.pickup("super");
    this.nextLevel();
  }

  collectPowerup(up) {
    this.audio.unlock();
    this.audio.pickup(up.type || "generic");
    spawnSparks(this.particles, up.x, up.y, 8);
    setSquash(this.player, 0.9, 1.12);
    if (up.type === "ammo") {
      this.player.ammo.ion += up.ammo.ion || 0;
      this.player.ammo.plasma += up.ammo.plasma || 0;
      this.player.ammo.rocket += up.ammo.rocket || 0;
      this.flashMessage("AMMO RECOVERED", 1);
      return;
    }
    if (up.type === "shield") {
      this.player.shield = 100;
      this.flashMessage("SHIELDS RESTORED", 1);
    } else if (up.type === "repair") {
      this.player.hull = 100;
      this.flashMessage("HULL REPAIRED", 1);
    } else if (up.type === "super") {
      this.player.shield = 100;
      this.player.invuln = 4;
      this.flashMessage("SUPER SHIELDS", 1.2);
    } else if (up.type === "rocket") {
      this.player.ammo.rocket += up.rockets || 4;
      this.flashMessage("+ROCKETS", 1);
    }
  }

  damagePlayer(amount) {
    const p = this.player;
    if (!p.alive || p.invuln > 0) return;
    let dmg = amount;
    if (p.shield > 0) {
      const absorbed = Math.min(p.shield, dmg);
      p.shield -= absorbed;
      dmg -= absorbed;
    }
    if (dmg > 0) p.hull -= dmg;
    p.invuln = 0.55;
    p.hitFlash = 0.08;
    setSquash(p, 1.28, 0.72);
    this.shake = 8;
    addTrauma(this.juice, 0.22);
    hitStop(this.juice, 0.045);
    impactFlash(this.juice, "rgba(255,70,90,0.14)", 0.14, 0.5);
    this.audio.hurt();
    spawnSparks(this.particles, p.x, p.y, 12);
    this.burst(p.x, p.y, "#ff5a6e", 10, 120);
    if (p.hull <= 0) this.loseLife(false);
  }

  loseLife(fromSuicide) {
    this.lives -= 1;
    this.combo = 0;
    if (this.lives <= 0) {
      this.player.alive = false;
      this.burst(this.player.x, this.player.y, "#3ef0d0", 36, 260);
      this.state = STATES.GAME_OVER;
      this.showScreen("gameover");
      this.audio.explosion(true);
      this.audio.setMusic("title");
      return;
    }

    // respawn fighter — strategic launch burst clears nearby enemies
    const oldAmmo = fromSuicide
      ? null
      : {
          ion: Math.floor(this.player.ammo.ion * 0.5),
          plasma: Math.floor(this.player.ammo.plasma * 0.5),
          rocket: Math.floor(this.player.ammo.rocket * 0.5),
        };

    this.player = createPlayer();
    if (oldAmmo) {
      this.player.ammo.ion = oldAmmo.ion;
      this.player.ammo.plasma = oldAmmo.plasma;
      this.player.ammo.rocket = oldAmmo.rocket;
    } else {
      // next fighter will pick up ejected ammo pod; start with reserve
      this.player.ammo.ion = 10;
      this.player.ammo.plasma = 6;
      this.player.ammo.rocket = 3;
    }
    this.player.invuln = 2.2;
    setSquash(this.player, 0.75, 1.35);
    spawnSmoke(this.particles, this.player.x, this.player.y + 20, 12);
    spawnSparks(this.particles, this.player.x, this.player.y, 10);
    addTrauma(this.juice, 0.2);
    this.audio.launch();
    this.flashMessage("NEW FIGHTER LAUNCHED", 1.2);

    // launch burst
    for (const e of this.enemies) {
      if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < 260 || e.y > H * 0.45) {
        e.hp -= 80;
        e.flash = 0.2;
        if (e.hp <= 0) this.killEnemy(e, true);
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    this.enemyBullets = [];
    this.burst(this.player.x, this.player.y, "#f0a23a", 28, 240);
  }

  burst(x, y, color, count, speed) {
    spawnBurst(this.particles, x, y, {
      count,
      speed,
      colors: [color, "#ffffff", "#ff4fd8", "#4de8ff", "#ffe66d"],
      life: 0.55,
      size: 3.2,
      gravity: 25,
      drag: 0.45,
      glow: true,
    });
  }

  addLaserCharge(amount) {
    const wasReady = this.laserCharge >= 100;
    this.laserCharge = Math.min(100, (this.laserCharge || 0) + amount);
    if (!wasReady && this.laserCharge >= 100) {
      this.flashMessage("SUPER LASER READY — SPACE", 1.6);
      this.audio.alert();
    }
  }

  fireSuperLaser() {
    if (this.state !== STATES.PLAYING || !this.player?.alive) return;
    if ((this.laserCharge || 0) < 100) return;
    if (this.superLaser) return;
    this.laserCharge = 0;
    const up = this.player.upgrades || {};
    this.superLaser = {
      t: 0.65,
      tick: 0,
      x: this.player.x,
      halfW: 28 * (up.laserWidthMul || 1),
      damage: 55 * (up.laserDamageMul || 1),
    };
    hitStop(this.juice, 0.08);
    impactFlash(this.juice, "rgba(255,79,216,0.24)", 0.24, 0.4);
    addTrauma(this.juice, 0.35);
    this.shake = Math.max(this.shake, 10);
    this.audio.superLaser();
    this.flashMessage("SUPER LASER", 0.7);
    spawnBurst(this.particles, this.player.x, this.player.y - 40, {
      count: 28,
      speed: 320,
      colors: ["#ffffff", "#ff4fd8", "#4de8ff", "#ffe66d"],
      life: 0.35,
      size: 3.5,
      glow: true,
      gravity: 0,
      angle: -Math.PI / 2,
      spread: 0.5,
    });
  }

  updateSuperLaser(dt) {
    const beam = this.superLaser;
    if (!beam) return;
    beam.t -= dt;
    beam.tick -= dt;
    beam.x = this.player?.x ?? beam.x;
    if (beam.tick <= 0) {
      beam.tick = 0.05;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (Math.abs(e.x - beam.x) <= beam.halfW + e.w / 2 && e.y < this.player.y) {
          e.hp -= beam.damage;
          e.flash = 0.1;
          setSquash(e, 1.25, 0.75);
          if (Math.random() < 0.4) {
            spawnSparks(this.particles, e.x, e.y, 4);
          }
          if (e.hp <= 0) this.killEnemy(e);
        }
      }
      this.enemies = this.enemies.filter((e) => e.hp > 0);
      // Clear enemy bullets caught in the beam corridor
      this.enemyBullets = this.enemyBullets.filter(
        (b) => Math.abs(b.x - beam.x) > beam.halfW + 8 || b.y > this.player.y
      );
      spawnBurst(this.particles, beam.x + (Math.random() - 0.5) * beam.halfW, this.player.y - 80 - Math.random() * 400, {
        count: 2,
        speed: 40,
        colors: ["#ff4fd8", "#4de8ff", "#ffffff"],
        life: 0.2,
        size: 2.5,
        glow: true,
        gravity: 0,
      });
    }
    if (beam.t <= 0) this.superLaser = null;
  }

  renderLivesHud() {
    const el = this.ui.lives;
    if (!el) return;
    const n = Math.max(0, this.lives | 0);
    // Always show at least 3 heart slots so starting lives are obvious.
    const slots = Math.max(3, n);
    let html = "";
    for (let i = 0; i < slots; i++) {
      html += `<i class="heart${i < n ? " on" : ""}" aria-hidden="true"></i>`;
    }
    el.innerHTML = html;
    el.setAttribute("aria-label", `Lives: ${n}`);
  }

  syncHud() {
    const p = this.player;
    this.ui.score.textContent = String(this.score);
    this.ui.level.textContent = `${this.level} / ${MAX_LEVEL}`;
    this.ui.lives && this.renderLivesHud();
    this.ui.shield.style.transform = `scaleX(${clamp(p.shield / 100, 0, 1)})`;
    this.ui.hull.style.transform = `scaleX(${clamp(p.hull / 100, 0, 1)})`;
    if (this.ui.shipLevel) this.ui.shipLevel.textContent = String(p.shipLevel || 1);
    if (this.ui.laser) {
      this.ui.laser.style.transform = `scaleX(${clamp((this.laserCharge || 0) / 100, 0, 1)})`;
    }
    this.ui.ammoGun.textContent = "∞";
    this.ui.ammoIon.textContent = String(p.ammo.ion);
    this.ui.ammoPlasma.textContent = String(p.ammo.plasma);
    if (this.ui.ammoRocket) this.ui.ammoRocket.textContent = String(p.ammo.rocket);
    for (const el of document.querySelectorAll(".ammo")) {
      el.classList.toggle("active", el.dataset.weapon === p.weapon);
    }
  }

  draw() {
    const ctx = this.ctx;
    if (this.state === STATES.CUTSCENE && this.cutscene) {
      this.cutscene.draw(ctx);
      return;
    }

    const traumaShake = shakeOffset(this.juice);
    const sx = traumaShake.x + (this.shake ? (Math.random() - 0.5) * this.shake : 0);
    const sy = traumaShake.y + (this.shake ? (Math.random() - 0.5) * this.shake : 0);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, sx, sy);
    ctx.fillStyle = "#030406";
    ctx.fillRect(-10, -10, W + 20, H + 20);

    // Ikaruga-like stone/void atmosphere
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(28, 32, 40, 0.55)");
    g.addColorStop(0.4, "rgba(10, 12, 16, 0.2)");
    g.addColorStop(1, "rgba(8, 8, 10, 0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // scrolling geometric architecture silhouettes
    this.drawArchitecture(ctx);

    for (const s of this.stars) {
      ctx.globalAlpha = 0.3 + s.z * 0.45;
      ctx.fillStyle = s.z > 1.2 ? "#ffffff" : "#c8d0dc";
      ctx.fillRect(s.x, s.y, s.s, s.s * (1 + s.z * 0.8));
    }
    ctx.globalAlpha = 1;

    // danger line
    ctx.strokeStyle = "rgba(232, 162, 74, 0.35)";
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.moveTo(20, H - 18);
    ctx.lineTo(W - 20, H - 18);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(232, 162, 74, 0.65)";
    ctx.font = "600 12px Rajdhani";
    ctx.fillText("COMBAT ZONE", 24, H - 28);

    if (this.state !== STATES.TITLE) {
      this.drawPowerups(ctx);
      this.drawEnemies(ctx);
      this.drawBossLaser(ctx);
      this.drawSuperLaser(ctx);
      this.drawBullets(ctx);
      if (this.player.alive || this.state === STATES.GAME_OVER) this.drawPlayer(ctx);
    } else {
      this.drawTitleShip(ctx);
    }

    drawParticles(ctx, this.particles);

    // soft bloom accents on bright projectiles
    if (this.state === STATES.PLAYING || this.state === STATES.LEVEL_CLEAR || this.state === STATES.PAUSED) {
      for (const b of this.bullets) {
        drawGlow(ctx, b.x, b.y, b.weapon === "rocket" ? 28 : 14, b.color, 0.22);
      }
    }

    if (this.levelPhase === "boss") {
      const bosses = this.enemies.filter((e) => e.type === "boss" && e.hp > 0);
      const live = bosses.length ? bosses : this.boss ? [this.boss] : [];
      if (live.length) {
        const hp = live.reduce((s, b) => s + Math.max(0, b.hp), 0);
        const maxHp = live.reduce((s, b) => s + b.maxHp, 0) || 1;
        const ratio = clamp(hp / maxHp, 0, 1);
        const isFinal = live.some((b) => b.final);
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(80, 24, W - 160, 14);
        ctx.fillStyle = isFinal ? "#e8a24a" : "#dce6ff";
        ctx.fillRect(80, 24, (W - 160) * ratio, 14);
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.strokeRect(80, 24, W - 160, 14);
      }
    }

    if (this.message) {
      ctx.save();
      ctx.globalAlpha = clamp(this.message.t * 2, 0, 1);
      ctx.fillStyle = "rgba(5, 8, 15, 0.55)";
      ctx.fillRect(W * 0.15, H * 0.38, W * 0.7, 44);
      ctx.fillStyle = "#eef4ff";
      ctx.font = "700 18px Orbitron";
      ctx.textAlign = "center";
      ctx.fillText(this.message.text, W / 2, H * 0.38 + 28);
      ctx.restore();
    }

    if (this.state === STATES.VICTORY_BANNER) {
      const t = this.victoryBannerT || 0;
      const pulse = 0.85 + Math.sin(t * 6) * 0.08;
      const fade = clamp(this.clearTimer / 0.45, 0, 1);
      ctx.save();
      ctx.globalAlpha = 0.55 * fade;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = fade;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(232, 162, 74, 0.95)";
      ctx.font = `800 ${Math.floor(72 * pulse)}px Orbitron, sans-serif`;
      ctx.fillText("VICTORY", W / 2, H * 0.42);
      ctx.fillStyle = "rgba(238, 244, 255, 0.92)";
      ctx.font = "700 22px Rajdhani, sans-serif";
      ctx.fillText("BLOCKADE COMMANDER DESTROYED", W / 2, H * 0.42 + 64);
      ctx.fillStyle = "rgba(158, 179, 209, 0.9)";
      ctx.font = "600 16px Rajdhani, sans-serif";
      ctx.fillText("Freighter path clear — standing by…", W / 2, H * 0.42 + 96);
      ctx.restore();
    }

    ctx.restore();

    // post passes in screen space (no shake)
    drawPostFx(ctx, W, H, this.juice);
  }

  drawArchitecture(ctx) {
    const t = (this.juice?.time || performance.now() * 0.001) * 40;
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#8a93a2";
    ctx.fillStyle = "#12151c";
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const y = ((i * 180 + t) % (H + 180)) - 90;
      const x = i % 2 === 0 ? 24 : W - 90;
      ctx.fillRect(x, y, 66, 120);
      ctx.strokeRect(x, y, 66, 120);
      ctx.beginPath();
      ctx.moveTo(x, y + 40);
      ctx.lineTo(x + 66, y + 40);
      ctx.moveTo(x + 22, y);
      ctx.lineTo(x + 22, y + 120);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawTitleShip(ctx) {
    const t = performance.now() * 0.001;
    const x = W / 2 + Math.sin(t * 0.8) * 30;
    const y = H * 0.58 + Math.cos(t * 1.1) * 10;
    const s = 1 + Math.sin(t * 4) * 0.03;
    drawGlow(ctx, x, y, 80, "rgba(255,200,80,0.35)", 0.45);
    const drawn =
      this.playerAtlas && this.playerAtlas.draw(ctx, "hero", x, y, 72 * s, 72 * s, t);
    if (!drawn) drawSprite(ctx, this.sprites.hero, x, y, 68 * s, 68 * s);
  }

  drawPlayer(ctx) {
    const p = this.player;
    const glowColor = p.invuln > 1.5 ? "rgba(255,200,120,0.5)" : "rgba(255,210,100,0.42)";
    drawGlow(ctx, p.x, p.y, 95, glowColor, 0.42);
    drawGlow(ctx, p.x, p.y + 12, 36, "rgba(255,140,60,0.3)", 0.35);

    // thruster sprites behind ship
    if (this.playerAtlas) {
      this.playerAtlas.draw(ctx, "thrust", p.x - 8, p.y + 26, 10, 18, this.animTime, { alpha: 0.85 });
      this.playerAtlas.draw(ctx, "thrust", p.x + 8, p.y + 26, 10, 18, this.animTime + 0.07, { alpha: 0.85 });
    }

    for (const t of p.trail) {
      if (t.life <= 0) continue;
      ctx.globalAlpha = t.life * 0.75;
      ctx.fillStyle = "#ffb060";
      ctx.beginPath();
      ctx.arc(t.x, t.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (p.shield > 0 && this.playerAtlas) {
      const a = 0.25 + (p.shield / 100) * 0.45;
      this.playerAtlas.draw(ctx, "shield_fx", p.x, p.y, 78, 78, this.animTime, { alpha: a });
    }

    const blink = p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0;
    if (!blink) {
      const drawn =
        this.playerAtlas &&
        this.playerAtlas.draw(ctx, "hero", p.x, p.y, 60, 60, this.animTime, {
          flash: p.hitFlash > 0.05,
          flashRed: p.hitFlash > 0 && p.hitFlash <= 0.05,
          sx: p.sx ?? 1,
          sy: p.sy ?? 1,
        });
      if (!drawn) {
        drawSprite(ctx, this.sprites.hero, p.x, p.y, 58, 58, {
          flash: p.hitFlash > 0.05,
          flashRed: p.hitFlash > 0 && p.hitFlash <= 0.05,
          sx: p.sx ?? 1,
          sy: p.sy ?? 1,
        });
      }
    }

    for (const m of this.muzzleFlashes) {
      if (this.playerAtlas) {
        this.playerAtlas.draw(ctx, "muzzle", m.x, m.y, 22, 22, 1 - m.t / 0.12, {
          alpha: Math.max(0, m.t / 0.12),
          frame: Math.floor((1 - m.t / 0.12) * 4),
        });
      }
    }
  }

  drawEnemies(ctx) {
    for (const e of this.enemies) {
      let w = e.w * 1.45;
      let h = e.h * 1.45;
      if (e.type === "boss") {
        w = e.w * 1.2;
        h = e.h * 1.2;
        drawGlow(
          ctx,
          e.x,
          e.y,
          e.final ? 120 : 90,
          e.final ? "rgba(255,170,80,0.3)" : "rgba(220,230,255,0.28)",
          0.35
        );
      } else if (e.polarity === "white") {
        drawGlow(ctx, e.x, e.y, 28, "rgba(220,230,255,0.25)", 0.3);
      } else {
        drawGlow(ctx, e.x, e.y, 28, "rgba(255,170,80,0.2)", 0.28);
      }
      const flashing = e.flash > 0;
      const t = this.animTime + (e.animOffset || 0);
      const drawn =
        this.enemyAtlas &&
        this.enemyAtlas.draw(ctx, e.type, e.x, e.y, w, h, t, {
          variant: e.variant || 0,
          final: !!e.final,
          flash: flashing && e.flash > 0.03,
          flashRed: flashing && e.flash <= 0.03,
          sx: e.type === "boss" ? 1 : e.sx ?? 1,
          sy: e.type === "boss" ? 1 : e.sy ?? 1,
        });
      if (!drawn) {
        let img = this.sprites[e.type] || this.sprites.scout;
        if (e.type === "boss") img = e.final ? this.sprites.finalBoss : this.sprites.boss;
        drawSprite(ctx, img, e.x, e.y, w, h, {
          flash: flashing && e.flash > 0.03,
          flashRed: flashing && e.flash <= 0.03,
          sx: e.type === "boss" ? 1 : e.sx ?? 1,
          sy: e.type === "boss" ? 1 : e.sy ?? 1,
        });
      }
      if (e.hp < e.maxHp && e.type !== "boss") {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(e.x - 16, e.y - e.h / 2 - 10, 32, 3);
        ctx.fillStyle = "#dce6ff";
        ctx.fillRect(e.x - 16, e.y - e.h / 2 - 10, 32 * (e.hp / e.maxHp), 3);
      }
    }
  }

  drawBossLaser(ctx) {
    // Prefer live final-boss laser state from enemies (authoritative), then mirror.
    const live =
      this.enemies.find((x) => x.type === "boss" && x.final && x.laserState) ||
      (this.bossLaser?.owner?.laserState ? this.bossLaser.owner : null) ||
      (this.boss?.final && this.boss?.laserState ? this.boss : null);
    if (!live) return;
    const x = live.laserAimX;
    const top = live.y + live.h * 0.2;
    const bottom = H;
    const halfW = live.laserHalfW || 22;
    const t = this.juice?.time || performance.now() * 0.001;
    const firing = live.laserState === "fire";

    ctx.save();
    if (!firing) {
      const pulse = 0.4 + Math.sin(t * 22) * 0.2;
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = "rgba(255, 140, 40, 0.95)";
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255, 120, 40, 0.14)";
      ctx.fillRect(x - halfW, top, halfW * 2, bottom - top);
      ctx.strokeStyle = "rgba(255, 200, 80, 0.6)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x - halfW, top, halfW * 2, bottom - top);
      // Charge meter at boss
      const charge = clamp(1 - (live.laserT || 0) / 10, 0, 1);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(x - 40, top - 18, 80, 6);
      ctx.fillStyle = "#ffb040";
      ctx.fillRect(x - 40, top - 18, 80 * charge, 6);
      ctx.globalAlpha = 1;
      drawGlow(ctx, x, top + 20, 40, "rgba(255,140,40,0.45)", 0.4);
    } else {
      const pulse = 0.85 + Math.sin(t * 48) * 0.15;
      ctx.globalCompositeOperation = "lighter";
      // Outer glow slab
      ctx.globalAlpha = pulse * 0.45;
      ctx.fillStyle = "rgba(255, 80, 20, 0.85)";
      ctx.fillRect(x - halfW * 1.55, top, halfW * 3.1, bottom - top);
      // Core beam
      const g = ctx.createLinearGradient(x, top, x, bottom);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.1, "rgba(255,220,120,0.98)");
      g.addColorStop(0.45, "rgba(255,90,20,0.95)");
      g.addColorStop(1, "rgba(255,40,10,0.35)");
      ctx.fillStyle = g;
      ctx.globalAlpha = pulse;
      ctx.fillRect(x - halfW, top, halfW * 2, bottom - top);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fillRect(x - halfW * 0.28, top, halfW * 0.56, bottom - top);
      ctx.strokeStyle = "rgba(255,255,220,1)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      drawGlow(ctx, x, top + 10, 90, "rgba(255,180,60,0.75)", 0.7);
      drawGlow(ctx, x, (top + bottom) / 2, 70, "rgba(255,80,20,0.55)", 0.55);
      drawGlow(ctx, x, bottom - 40, 60, "rgba(255,120,40,0.4)", 0.45);
    }
    ctx.restore();
  }

  drawSuperLaser(ctx) {
    const beam = this.superLaser;
    if (!beam || !this.player) return;
    const x = beam.x;
    const top = 0;
    const bottom = this.player.y - 10;
    const w = beam.halfW * 2;
    const pulse = 0.65 + Math.sin((this.juice?.time || 0) * 40) * 0.2;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createLinearGradient(x, bottom, x, top);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.15, "rgba(255,79,216,0.85)");
    g.addColorStop(0.55, "rgba(77,232,255,0.7)");
    g.addColorStop(1, "rgba(255,79,216,0.15)");
    ctx.fillStyle = g;
    ctx.globalAlpha = pulse;
    ctx.fillRect(x - w / 2, top, w, bottom - top);
    ctx.globalAlpha = pulse * 0.55;
    ctx.fillRect(x - w * 0.22, top, w * 0.44, bottom - top);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, bottom);
    ctx.lineTo(x, top);
    ctx.stroke();
    ctx.restore();

    drawGlow(ctx, x, this.player.y - 30, 70, "rgba(255,79,216,0.55)", 0.55);
  }

  drawBullets(ctx) {
    for (const b of this.bullets) {
      const size =
        b.weapon === "rocket"
          ? { w: b.w + 6, h: b.h + 8 }
          : b.weapon === "plasma"
            ? { w: b.w + 16, h: b.h + 10 }
            : b.weapon === "ion"
              ? { w: b.w + 14, h: b.h + 14 }
              : { w: b.w + 4, h: b.h + 10 };
      const drawn =
        this.playerAtlas &&
        this.playerAtlas.drawWeapon(ctx, b.weapon, b.x, b.y, size.w, size.h, this.animTime + b.x * 0.01);
      if (!drawn) {
        const img =
          b.weapon === "rocket"
            ? this.sprites.rocket
            : b.weapon === "ion"
              ? this.sprites.ion
              : b.weapon === "plasma"
                ? this.sprites.plasma
                : this.sprites.gun;
        if (b.weapon === "rocket") {
          const ang = Math.atan2(b.vy, b.vx || 0) + Math.PI / 2;
          ctx.save();
          ctx.translate(b.x, b.y);
          ctx.rotate(ang);
          ctx.drawImage(img, -b.w / 2, -b.h / 2, b.w, b.h);
          ctx.restore();
        } else {
          drawSprite(ctx, img, b.x, b.y, b.w + 4, b.h + 4);
        }
      }
    }
    for (const b of this.enemyBullets) {
      const size = b.heavy ? b.w + 14 : b.w + 12;
      // Outer glow halo
      drawGlow(
        ctx,
        b.x,
        b.y,
        size * 1.35,
        b.heavy ? "rgba(255,160,60,0.85)" : "rgba(200,230,255,0.9)",
        0.55
      );
      const img = b.heavy ? this.sprites.enemyBulletHeavy : this.sprites.enemyBullet;
      drawSprite(ctx, img, b.x, b.y, size, size);
    }
  }

  drawPowerups(ctx) {
    for (const p of this.powerups) {
      const bobY = Math.sin(p.bob || 0) * 3;
      const size = p.type === "ammo" ? 36 : 38;
      const drawn =
        this.pickupAtlas &&
        this.pickupAtlas.draw(ctx, p.type, p.x, p.y + bobY, size, size, this.animTime + (p.bob || 0) * 0.15, {
          variant: p.variant || 0,
          fps: 12,
        });
      if (!drawn) {
        const map = {
          shield: this.sprites.powerShield,
          repair: this.sprites.powerRepair,
          super: this.sprites.powerSuper,
          ammo: this.sprites.powerAmmo,
          rocket: this.sprites.powerRocket,
        };
        const img = map[p.type] || this.sprites.powerAmmo;
        drawSprite(ctx, img, p.x, p.y + bobY, 32, 32);
      }
    }
  }
}
