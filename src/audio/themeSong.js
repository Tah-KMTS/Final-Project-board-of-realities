// Procedural 8-bit / synthwave theme loop using Web Audio API oscillators.
// No external audio files required.

const NOTE_FREQ = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0,
}

const MELODY = [
  ['E4', 0.25], ['G4', 0.25], ['A4', 0.25], ['G4', 0.25],
  ['E4', 0.25], ['D4', 0.25], ['C4', 0.5],
  ['D4', 0.25], ['E4', 0.25], ['D4', 0.25], ['C4', 0.25],
  ['B3', 0.25], ['C4', 0.25], ['D4', 0.5],
  ['E4', 0.25], ['G4', 0.25], ['A4', 0.25], ['C5', 0.25],
  ['B4', 0.25], ['A4', 0.25], ['G4', 0.5],
  ['A4', 0.25], ['G4', 0.25], ['E4', 0.25], ['D4', 0.25],
  ['C4', 0.5], ['G3', 0.5],
]

const BASS = [
  ['C3', 0.5], ['G3', 0.5], ['A3', 0.5], ['E3', 0.5],
  ['F3', 0.5], ['C3', 0.5], ['G3', 0.5], ['G3', 0.5],
]

class ThemeSong {
  constructor() {
    this.ctx = null
    this.gainNode = null
    this.playing = false
    this.volume = 0.3
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

  _scheduleNote(freq, startTime, duration, type = 'square', gainScale = 1) {
    const osc = this.ctx.createOscillator()
    const noteGain = this.ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    noteGain.gain.setValueAtTime(0, startTime)
    noteGain.gain.linearRampToValueAtTime(gainScale, startTime + 0.02)
    noteGain.gain.linearRampToValueAtTime(0, startTime + duration * 0.9)
    osc.connect(noteGain)
    noteGain.connect(this.gainNode)
    osc.start(startTime)
    osc.stop(startTime + duration)
  }

  _scheduleLoop(loopStartTime) {
    const tempo = 0.4 // seconds per beat unit
    let melodyTime = loopStartTime
    for (const [note, beats] of MELODY) {
      this._scheduleNote(NOTE_FREQ[note], melodyTime, beats * tempo, 'square', 0.5)
      melodyTime += beats * tempo
    }
    let bassTime = loopStartTime
    for (const [note, beats] of BASS) {
      this._scheduleNote(NOTE_FREQ[note], bassTime, beats * tempo, 'triangle', 0.6)
      bassTime += beats * tempo
    }
    const loopDuration = melodyTime - loopStartTime
    const timeoutId = setTimeout(() => {
      if (this.playing) this._scheduleLoop(this.ctx.currentTime)
    }, (loopDuration - 0.1) * 1000)
    this._timeouts.push(timeoutId)
  }

  play() {
    this._ensureContext()
    if (this.ctx.state === 'suspended') this.ctx.resume()
    if (this.playing) return
    this.playing = true
    this._scheduleLoop(this.ctx.currentTime + 0.05)
  }

  pause() {
    this.playing = false
    this._timeouts.forEach(clearTimeout)
    this._timeouts = []
    if (this.ctx) this.ctx.suspend()
  }

  setVolume(v) {
    this.volume = v
    if (this.gainNode) this.gainNode.gain.value = v
  }
}

export const themeSong = new ThemeSong()
