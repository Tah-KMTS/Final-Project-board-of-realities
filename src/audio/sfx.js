// Short procedural sound effects (Web Audio oscillators) for combat feedback.
// A lazily-created shared AudioContext, same pattern as themeSong.js.

let ctx = null
function getContext() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function blip({ freqStart, freqEnd, duration, type = 'square', volume = 0.25 }) {
  const audio = getContext()
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freqStart, audio.currentTime)
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), audio.currentTime + duration)
  gain.gain.setValueAtTime(volume, audio.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration)
  osc.connect(gain)
  gain.connect(audio.destination)
  osc.start()
  osc.stop(audio.currentTime + duration)
}

// Adds vibrato (a wobbling pitch, for a "charged/primed" read) and a
// buffer-noise voice (for a percussive "thud"/"crunch" read that a plain
// oscillator can't produce) on top of blip()'s plain up/down sweep. Modeled
// on studio/blips.py's synth_blip from the cloned game_phaser_agent repo -
// that Python version renders once to a WAV file since it has to ship as a
// static asset; this one renders live every call since Web Audio is already
// sitting in the page, so there's nothing to bake ahead of time.
function moodyBlip({
  freqStart,
  freqEnd,
  duration,
  type = 'square',
  volume = 0.25,
  vibratoHz = 0,
  vibratoDepth = 0,
  noiseAmount = 0,
}) {
  const audio = getContext()
  const gain = audio.createGain()
  gain.gain.setValueAtTime(volume, audio.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration)
  gain.connect(audio.destination)

  if (noiseAmount > 0) {
    const bufferSize = Math.max(1, Math.round(audio.sampleRate * duration))
    const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
    const noise = audio.createBufferSource()
    noise.buffer = buffer
    const noiseGain = audio.createGain()
    noiseGain.gain.value = noiseAmount
    noise.connect(noiseGain)
    noiseGain.connect(gain)
    noise.start()
    noise.stop(audio.currentTime + duration)
  }

  if (noiseAmount < 1) {
    const osc = audio.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freqStart, audio.currentTime)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), audio.currentTime + duration)
    const oscGain = audio.createGain()
    oscGain.gain.value = 1 - noiseAmount
    osc.connect(oscGain)
    oscGain.connect(gain)
    osc.start()
    osc.stop(audio.currentTime + duration)

    if (vibratoHz > 0 && vibratoDepth > 0) {
      const lfo = audio.createOscillator()
      lfo.frequency.value = vibratoHz
      const lfoGain = audio.createGain()
      // Depth is a fraction of the base frequency, same as blips.py's
      // vibrato_depth, so it scales sensibly whether freqStart is a low
      // thud or a high chime.
      lfoGain.gain.value = freqStart * vibratoDepth
      lfo.connect(lfoGain)
      lfoGain.connect(osc.frequency)
      lfo.start()
      lfo.stop(audio.currentTime + duration)
    }
  }
}

export function playHitSound() {
  blip({ freqStart: 320, freqEnd: 80, duration: 0.12 })
}

export function playTakeDamageSound() {
  blip({ freqStart: 180, freqEnd: 60, duration: 0.18, type: 'sawtooth', volume: 0.2 })
}

export function playVictorySound() {
  const audio = getContext()
  ;[523, 659, 784].forEach((freq, i) => {
    const start = audio.currentTime + i * 0.09
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'square'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.2, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15)
    osc.connect(gain)
    gain.connect(audio.destination)
    osc.start(start)
    osc.stop(start + 0.15)
  })
}

export function playDefeatSound() {
  blip({ freqStart: 200, freqEnd: 40, duration: 0.5, type: 'sawtooth', volume: 0.25 })
}

export function playClickSound() {
  blip({ freqStart: 600, freqEnd: 500, duration: 0.05, volume: 0.12 })
}

export function playPurchaseSound() {
  const audio = getContext()
  ;[440, 660].forEach((freq, i) => {
    const start = audio.currentTime + i * 0.06
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'square'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.16, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1)
    osc.connect(gain)
    gain.connect(audio.destination)
    osc.start(start)
    osc.stop(start + 0.1)
  })
}

export function playQuestCompleteSound() {
  const audio = getContext()
  ;[392, 523, 659, 784].forEach((freq, i) => {
    const start = audio.currentTime + i * 0.1
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.22, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2)
    osc.connect(gain)
    gain.connect(audio.destination)
    osc.start(start)
    osc.stop(start + 0.2)
  })
}

export function playDoorSound() {
  blip({ freqStart: 220, freqEnd: 340, duration: 0.15, type: 'triangle', volume: 0.15 })
}

export function playDiceSound() {
  blip({ freqStart: 800, freqEnd: 200, duration: 0.06, type: 'square', volume: 0.1 })
}

// The four skirmish moments below (financeSkirmishEngine's matchup.arm/stun,
// and Retreat/Flee) already narrate themselves in the log but previously had
// no sound of their own - a dodge-counter prime, a detonating Counter Boost,
// a stagger, and bailing out of a fight all played silently or borrowed the
// generic hit/damage blip. See FinanceSkirmishModal.jsx and
// RiftCombatModal.jsx for where each of these is now wired in.

// Rising sweep with a light wobble, for "you dodge clean and prime a
// Counter Boost" - reads as charging up rather than taking or dealing a hit.
export function playCounterPrimeSound() {
  moodyBlip({
    freqStart: 300,
    freqEnd: 640,
    duration: 0.16,
    type: 'triangle',
    volume: 0.22,
    vibratoHz: 18,
    vibratoDepth: 0.06,
  })
}

// Sharper and louder than the prime, plus a thin noise layer, for the boost
// actually detonating on a landed hit.
export function playCounterDetonateSound() {
  moodyBlip({
    freqStart: 500,
    freqEnd: 980,
    duration: 0.2,
    type: 'square',
    volume: 0.28,
    vibratoHz: 26,
    vibratoDepth: 0.08,
    noiseAmount: 0.15,
  })
}

// A stumble, not a hit: short downward wobble with a soft noise thud, for
// getting staggered (Guard Counter reflect or Exhaustion Stagger).
export function playStaggerSound() {
  moodyBlip({
    freqStart: 260,
    freqEnd: 150,
    duration: 0.22,
    type: 'sawtooth',
    volume: 0.22,
    vibratoHz: 10,
    vibratoDepth: 0.12,
    noiseAmount: 0.25,
  })
}

// A footstep-like double-tap fading downward, for breaking off a fight
// (Retreat / Flee) - distinct from Defeat's single long sawtooth droop.
export function playRetreatSound() {
  const audio = getContext()
  ;[420, 300].forEach((freq, i) => {
    const start = audio.currentTime + i * 0.09
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, start)
    osc.frequency.exponentialRampToValueAtTime(freq * 0.6, start + 0.12)
    gain.gain.setValueAtTime(0.18, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14)
    osc.connect(gain)
    gain.connect(audio.destination)
    osc.start(start)
    osc.stop(start + 0.14)
  })
}
