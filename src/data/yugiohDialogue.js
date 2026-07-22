// Dialogue scripts for King of Games' named NPCs, played through
// DialogueBox. First line of each has a real generated voice line; the
// rest stay on the retro talk-blip system (see audio-director agent).
// Cynn is deliberately left voiceless everywhere - her whole character is
// unsettling silence, and giving her a spoken line would undercut that.

export const YUGI_LINES = [
  {
    text: 'You want to be King of Games? Prove it — however you think is fair.',
    audioSrc: '/audio/voice/yugioh_yugi_intro.mp3',
  },
]

export const KAIBA_LINES = [
  {
    text: 'You want to buy my company? ...Fine. Everyone has a price, apparently. Even me.',
    audioSrc: '/audio/voice/yugioh_kaiba_intro.mp3',
  },
]

export const TEA_LINES = [
  { text: 'Oh, hey! Are you friends with Yugi too?', audioSrc: '/audio/voice/yugioh_tea_intro.mp3' },
]

export const TAH_LINES = [
  { text: "You're playing me. Not negotiable.", audioSrc: '/audio/voice/yugioh_tah_intro.mp3' },
]
