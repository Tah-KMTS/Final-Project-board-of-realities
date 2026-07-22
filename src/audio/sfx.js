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
