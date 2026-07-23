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
// (see audio-director agent for the rationale). 20 named characters total,
// spread across all 6 gpt-4o-mini-tts voice timbres available at the time
// this was written (alloy, ash, ballad, coral, echo, fable, onyx, nova,
// sage, shimmer, verse) - some timbres are intentionally reused across two
// characters where the `instructions` delivery-style field differentiates
// the performance. Yugi/Kaiba/Tea/Tah/Cynn/Joey/Solomon/Duke/Tristan are
// shared identities between world3 (King of Games) and Domino City per the
// known unsynced-duplicate issue - one line covers both, not doubled.
const LINES = [
  // Hunter
  { id: 'hunter_hq_receptionist', voice: 'nova', text: 'Welcome back to the Association, Hunter.' },
  { id: 'hunter_poom_intro', voice: 'onyx', text: '...You again. Heard you want something from me.' },
  { id: 'hunter_tan_intro', voice: 'echo', text: 'Oh, you heard about the Spring of Nazarick too, huh?' },
  { id: 'hunter_marriage_first_meet', voice: 'shimmer', text: "Oh — I haven't seen you around here before." },
  // Finance
  { id: 'finance_buffett_intro', voice: 'fable', text: "Well now, another young hustler come to make their fortune. Sit down, sit down — everyone's got an angle, might as well hear yours." },
  { id: 'finance_vanderbilt_intro', voice: 'onyx', text: "Money built these rails, and it'll bury whoever tries to take them from me. State your business." },
  { id: 'finance_musk_intro', voice: 'echo', text: "Oh, it's you. Here to invest, or here to cause problems? Either way, I'm bored, so make it interesting." },
  {
    id: 'finance_marks_intro',
    voice: 'sage',
    instructions: 'Measured, thoughtful, faintly amused by young hustlers who think they can time the cycle.',
    text: "Ah, another name looking for the fortune at the bottom of the cycle. Let me guess — you think this time is different.",
  },
  // Yu-Gi-Oh / King of Games (shared identity with Domino City)
  { id: 'yugioh_yugi_intro', voice: 'alloy', text: 'You want to be King of Games? Prove it — however you think is fair.' },
  { id: 'yugioh_kaiba_intro', voice: 'onyx', text: 'You want to buy my company? ...Fine. Everyone has a price, apparently. Even me.' },
  { id: 'yugioh_tea_intro', voice: 'nova', text: 'Oh, hey! Are you friends with Yugi too?' },
  { id: 'yugioh_tah_intro', voice: 'echo', text: "You're playing me. Not negotiable." },
  {
    id: 'yugioh_cynn_intro',
    voice: 'coral',
    instructions: 'Cool, aloof, faintly intrigued despite herself - speaks quietly, never in a hurry.',
    text: "...You're still here. Most people leave the moment I stop talking.",
  },
  {
    id: 'yugioh_joey_intro',
    voice: 'ash',
    instructions: 'Scrappy, competitive, hot-headed but warm underneath - talks fast and loud.',
    text: "Hey! You look like you actually wanna duel, not just talk about it. Let's go!",
  },
  {
    id: 'yugioh_solomon_intro',
    voice: 'verse',
    instructions: 'Warm, wise, a little mischievous grandfather energy.',
    text: 'Ah, a new face in my shop. Careful — the game looks simple until it isn\'t.',
  },
  {
    id: 'yugioh_duke_intro',
    voice: 'ballad',
    instructions: 'Smooth, salesman-charming, always closing.',
    text: "Looking for cards, or looking for an edge? In my shop, that's the same question.",
  },
  {
    id: 'yugioh_tristan_intro',
    voice: 'ash',
    instructions: 'Quick, protective, a little goofy - lighter and friendlier delivery than Joey.',
    text: "You a friend of Yugi's? Then you're a friend of mine. Just don't get him into trouble.",
  },
  {
    id: 'yugioh_pegasus_intro',
    voice: 'fable',
    instructions: 'Theatrical, eccentric, faintly unsettling charm - drawn-out and delighted, unlike Biffle\'s folksy delivery on this same voice.',
    text: 'Oh, how marvelous — a new challenger. Do sit, won\'t you? The game is ever so much more fun with company.',
  },
  {
    id: 'yugioh_marik_intro',
    voice: 'onyx',
    instructions: 'Cold, controlled menace - quieter and more clipped than Kaiba or Vanderbilt on this same voice.',
    text: "You have no idea what you've walked into. But you will.",
  },
  {
    id: 'yugioh_mai_intro',
    voice: 'shimmer',
    instructions: 'Confident, sharp-tongued, a little flirtatious - bolder delivery than the Hunter marriage candidate on this same voice.',
    text: "Well, look who wandered in. Think you've got what it takes to duel with the big leagues?",
  },
]

async function generateLine({ id, voice, text, instructions }) {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice,
      input: text,
      response_format: 'mp3',
      ...(instructions ? { instructions } : {}),
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
