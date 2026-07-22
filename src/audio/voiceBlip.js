// Retro "talk blip" voice synthesis (Animal Crossing / Undertale style):
// a short pitched chirp per revealed character instead of recorded speech.
// Fits the procedural 8-bit aesthetic and needs no audio asset pipeline.

let ctx = null
function getContext() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

// Each speaker gets a distinct base pitch/timbre so NPCs feel differentiated
// even without real voice actors.
const VOICE_PRESETS = {
  default: { base: 320, spread: 60, type: 'square' },
  poom: { base: 180, spread: 40, type: 'sawtooth' },
  tan: { base: 260, spread: 70, type: 'triangle' },
  receptionist: { base: 420, spread: 50, type: 'square' },
  marriageCandidate: { base: 460, spread: 80, type: 'sine' },
  narrator: { base: 240, spread: 30, type: 'triangle' },
}

export function playTalkBlip(voiceId = 'default') {
  const preset = VOICE_PRESETS[voiceId] || VOICE_PRESETS.default
  const audio = getContext()
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  const freq = preset.base + Math.random() * preset.spread
  osc.type = preset.type
  osc.frequency.setValueAtTime(freq, audio.currentTime)
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq * 0.7), audio.currentTime + 0.045)
  gain.gain.setValueAtTime(0.14, audio.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.05)
  osc.connect(gain)
  gain.connect(audio.destination)
  osc.start()
  osc.stop(audio.currentTime + 0.05)
}
