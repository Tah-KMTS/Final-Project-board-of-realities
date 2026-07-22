// One-off asset-generation script: calls OpenAI's TTS API to render real
// spoken voice lines for load-bearing NPC introductions, saved as static
// mp3 files under public/audio/voice/. Run with:
//   node --env-file=.env scripts/generate-voice-lines.mjs
// Never call this from client code - it needs OPENAI_API_KEY server-side
// only, and Vite would otherwise bundle any client-exposed key into the
// public JS output.

import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '..', 'public', 'audio', 'voice')

const API_KEY = process.env.OPENAI_API_KEY
if (!API_KEY) {
  console.error('OPENAI_API_KEY is not set. Run with: node --env-file=.env scripts/generate-voice-lines.mjs')
  process.exit(1)
}

// Only load-bearing character-introduction lines get real voice; every
// other line in the game stays on the free procedural talk-blip system
// (see audio-director agent for the rationale).
const LINES = [
  { id: 'hunter_hq_receptionist', voice: 'nova', text: 'Welcome back to the Association, Hunter.' },
  { id: 'hunter_poom_intro', voice: 'onyx', text: '...You again. Heard you want something from me.' },
  { id: 'hunter_tan_intro', voice: 'echo', text: 'Oh, you heard about the Spring of Nazarick too, huh?' },
  { id: 'hunter_marriage_first_meet', voice: 'shimmer', text: "Oh — I haven't seen you around here before." },
  { id: 'finance_buffett_intro', voice: 'fable', text: "Well now, another young hustler come to make their fortune. Sit down, sit down — everyone's got an angle, might as well hear yours." },
  { id: 'finance_vanderbilt_intro', voice: 'onyx', text: "Money built these rails, and it'll bury whoever tries to take them from me. State your business." },
  { id: 'finance_musk_intro', voice: 'echo', text: "Oh, it's you. Here to invest, or here to cause problems? Either way, I'm bored, so make it interesting." },
  { id: 'yugioh_yugi_intro', voice: 'alloy', text: 'You want to be King of Games? Prove it — however you think is fair.' },
  { id: 'yugioh_kaiba_intro', voice: 'onyx', text: 'You want to buy my company? ...Fine. Everyone has a price, apparently. Even me.' },
  { id: 'yugioh_tea_intro', voice: 'nova', text: 'Oh, hey! Are you friends with Yugi too?' },
  { id: 'yugioh_tah_intro', voice: 'echo', text: "You're playing me. Not negotiable." },
]

async function generateLine({ id, voice, text }) {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      voice,
      input: text,
      response_format: 'mp3',
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${id} (${voice}) failed: ${res.status} ${body}`)
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  const outPath = path.join(OUT_DIR, `${id}.mp3`)
  await writeFile(outPath, buffer)
  console.log(`✓ ${id}.mp3 (${(buffer.length / 1024).toFixed(1)} KB)`)
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  for (const line of LINES) {
    // eslint-disable-next-line no-await-in-loop
    await generateLine(line)
  }
  console.log(`\nDone. ${LINES.length} voice lines written to ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
