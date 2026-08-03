// Named background-music tracks, one per world/combat-mood, played through a
// single switchable Web Audio engine - the generalized sibling of themeSong.js
// and hunterAmbient.js (which each hardcode exactly one hand-written melody
// and never need to switch tracks). This module needs to switch between
// several tracks as the player moves between regions/modals, so it takes a
// track id instead of being a one-tune singleton.
//
// The RECIPES table and buildPattern() below are a direct port of
// game_phaser_agent's studio/blips.py synth_music() (a cloned course repo,
// see that file for the Python original) - same scale-walking arpeggio
// algorithm, so this reproduces the real Sound Agent's melodic choices
// exactly, just rendered live via oscillators instead of baked to a WAV.
// That's also why this stays procedural rather than shipping the generated
// .wav files as assets: this project's audio is 100% synthesized (see
// sfx.js/themeSong.js/hunterAmbient.js) with no external audio files
// anywhere, and porting the exact recipe preserves that with no loss of the
// agent's actual composition (root note, scale, tempo, waveform per track).

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
}

const NOTES_PER_BAR = 8

// One entry per generated track. mood is documentation only (matches the
// Sound Agent's own mood_note) - the four numeric fields plus wave are what
// actually drive buildPattern()/oscillator type.
const RECIPES = {
  police_battle: {
    rootMidi: 50, scale: 'minor', tempoBpm: 128, bars: 4, wave: 'square', volume: 0.2,
    mood: 'Tense, determined standoff pulse - a wary alert melody, not a horror sting.',
  },
  street_skirmish: {
    rootMidi: 55, scale: 'minor', tempoBpm: 142, bars: 4, wave: 'square', volume: 0.21,
    mood: 'Fast, scrappy back-alley rhythm - reckless and punchy rather than severe.',
  },
  capital_overworld: {
    rootMidi: 48, scale: 'pentatonic', tempoBpm: 110, bars: 4, wave: 'triangle', volume: 0.18,
    mood: 'Confident driving city-hustle groove for comfortable long gameplay loops.',
  },
  hunters_rift: {
    rootMidi: 45, scale: 'minor', tempoBpm: 96, bars: 4, wave: 'sine', volume: 0.14,
    mood: 'Sparse exploratory minor-key ambience - eerie and spacious, never horror.',
  },
  king_of_games: {
    rootMidi: 60, scale: 'major', tempoBpm: 132, bars: 4, wave: 'square', volume: 0.2,
    mood: 'Upbeat competitive card-duel showmanship with a lightly theatrical hook.',
  },
  casino: {
    rootMidi: 53, scale: 'pentatonic', tempoBpm: 116, bars: 4, wave: 'triangle', volume: 0.19,
    mood: 'Glitzy, sly lounge-leaning loop - inviting, playful, faintly sleazy-fun.',
  },
  jail: {
    rootMidi: 43, scale: 'minor', tempoBpm: 84, bars: 4, wave: 'sine', volume: 0.11,
    mood: 'Low-energy sparse minor loop - subdued and humbled, not tragic.',
  },
}

function midiToHz(midi) {
  return 440 * 2 ** ((midi - 69) / 12)
}

// Same walk as synth_music(): step through the scale degree-by-degree,
// octave-jumping every full pass through it, with every 7th slot swapped for
// a low drone "blip" - deterministic, so this always reproduces the same
// tune for a given recipe (no per-play randomness).
function buildPattern(recipe) {
  const scale = SCALES[recipe.scale] || SCALES.major
  const totalNotes = recipe.bars * NOTES_PER_BAR
  const beatSec = 60 / Math.max(60, recipe.tempoBpm)
  const noteSec = beatSec / 2
  const pattern = []
  for (let i = 0; i < totalNotes; i++) {
    const deg = scale[i % scale.length]
    const octave = Math.floor(i / scale.length) % 2 ? 12 : 0
    const midi = i % 7 === 3 ? recipe.rootMidi - 12 + scale[0] : recipe.rootMidi + deg + octave
    pattern.push({ midi, duration: noteSec })
  }
  return pattern
}

class BgmPlayer {
  constructor() {
    this.ctx = null
    this.gainNode = null
    this.playing = false
    this.currentTrackId = null
    this.volume = 0.2
    this._timeouts = []
  }

  _ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)()
      this.gainNode = this.ctx.createGain()
      this.gainNode.gain.value = this.volume
      this.gainNode.connect(this.ctx.destination)
    }
  }

  _scheduleNote(freq, startTime, duration, type) {
    const osc = this.ctx.createOscillator()
    const noteGain = this.ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    noteGain.gain.setValueAtTime(0, startTime)
    noteGain.gain.linearRampToValueAtTime(1, startTime + Math.min(0.02, duration * 0.2))
    noteGain.gain.linearRampToValueAtTime(0, startTime + duration * 0.95)
    osc.connect(noteGain)
    noteGain.connect(this.gainNode)
    osc.start(startTime)
    osc.stop(startTime + duration)
  }

  _scheduleLoop(recipe, loopStartTime) {
    const pattern = buildPattern(recipe)
    let t = loopStartTime
    for (const { midi, duration } of pattern) {
      this._scheduleNote(midiToHz(midi), t, duration, recipe.wave)
      t += duration
    }
    const loopDuration = t - loopStartTime
    const timeoutId = setTimeout(() => {
      if (this.playing) this._scheduleLoop(recipe, this.ctx.currentTime)
    }, (loopDuration - 0.1) * 1000)
    this._timeouts.push(timeoutId)
  }

  _stopScheduling() {
    this._timeouts.forEach(clearTimeout)
    this._timeouts = []
  }

  // Starting a track already playing is a no-op (avoids restarting the loop
  // from bar 1 on every re-render); switching to a different id stops the
  // old loop's pending reschedule and starts the new one clean.
  play(trackId) {
    const recipe = RECIPES[trackId]
    if (!recipe) return
    this._ensureContext()
    if (this.ctx.state === 'suspended') this.ctx.resume()
    if (this.playing && this.currentTrackId === trackId) return
    this._stopScheduling()
    this.playing = true
    this.currentTrackId = trackId
    this.volume = recipe.volume
    this.gainNode.gain.value = this.volume
    this._scheduleLoop(recipe, this.ctx.currentTime + 0.05)
  }

  pause() {
    this.playing = false
    this.currentTrackId = null
    this._stopScheduling()
    if (this.ctx) this.ctx.suspend()
  }

  // The track's own authored volume (each recipe was tuned individually -
  // jail is meant quieter than police_battle) - callers duck relative to
  // THIS rather than a shared constant, so ducking the same amount reads
  // consistently across tracks of different base loudness.
  currentBaseVolume() {
    const recipe = RECIPES[this.currentTrackId]
    return recipe ? recipe.volume : this.volume
  }

  setVolume(v) {
    this.volume = v
    if (this.gainNode) this.gainNode.gain.value = v
  }
}

export const bgmPlayer = new BgmPlayer()
