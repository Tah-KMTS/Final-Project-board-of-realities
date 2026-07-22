// Procedural ambient loop for the Hunter's Rift world: sparse, minor-key,
// tense - a darker sibling to themeSong.js using the same oscillator
// scheduling approach, so the world has a distinct sonic identity.

const NOTE_FREQ = {
  A2: 110.0, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0,
  A3: 220.0, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0,
}

const PAD = [
  ['A2', 4], ['F3', 4], ['C3', 4], ['G3', 4],
]

const LEAD = [
  [null, 1], ['A3', 0.5], [null, 0.5], ['C4', 0.5], [null, 1.5],
  [null, 1], ['G3', 0.5], [null, 0.5], ['E3', 0.5], [null, 1.5],
  [null, 2], ['D4', 0.5], ['C4', 0.5], [null, 1],
  [null, 1], ['F3', 0.5], [null, 0.5], ['A3', 0.5], [null, 1.5],
]

class HunterAmbient {
  constructor() {
    this.ctx = null
    this.gainNode = null
    this.playing = false
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

  _scheduleNote(freq, startTime, duration, type, gainScale) {
    const osc = this.ctx.createOscillator()
    const noteGain = this.ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    noteGain.gain.setValueAtTime(0, startTime)
    noteGain.gain.linearRampToValueAtTime(gainScale, startTime + 0.4)
    noteGain.gain.linearRampToValueAtTime(0, startTime + duration * 0.95)
    osc.connect(noteGain)
    noteGain.connect(this.gainNode)
    osc.start(startTime)
    osc.stop(startTime + duration)
  }

  _scheduleLoop(loopStartTime) {
    const tempo = 0.5

    let padTime = loopStartTime
    for (const [note, beats] of PAD) {
      this._scheduleNote(NOTE_FREQ[note], padTime, beats * tempo, 'triangle', 0.22)
      padTime += beats * tempo
    }

    let leadTime = loopStartTime
    for (const [note, beats] of LEAD) {
      if (note) this._scheduleNote(NOTE_FREQ[note], leadTime, beats * tempo * 0.9, 'sine', 0.3)
      leadTime += beats * tempo
    }

    const loopDuration = padTime - loopStartTime
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

export const hunterAmbient = new HunterAmbient()
