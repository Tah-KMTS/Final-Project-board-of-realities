// Dialogue scripts for Financial Anarchy's named NPCs, played through
// DialogueBox. First line of each has a real generated voice line; the
// rest stay on the retro talk-blip system (see audio-director agent).

export const BUFFETT_LINES = [
  {
    text: "Well now, another young hustler come to make their fortune. Sit down, sit down — everyone's got an angle, might as well hear yours.",
    audioSrc: '/audio/voice/finance_buffett_intro.mp3',
  },
  "I've made more money holding still than most people make sprinting. Try not to be foolish.",
]

export const VANDERBILT_LINES = [
  {
    text: "Money built these rails, and it'll bury whoever tries to take them from me. State your business.",
    audioSrc: '/audio/voice/finance_vanderbilt_intro.mp3',
  },
  "Everyone thinks they're the exception. They are, occasionally. Rarely.",
]

export const MUSK_LINES = [
  {
    text: "Oh, it's you. Here to invest, or here to cause problems? Either way, I'm bored, so make it interesting.",
    audioSrc: '/audio/voice/finance_musk_intro.mp3',
  },
  "Everything's a market. Even this conversation.",
]

export const FINANCE_NPC_LINES = {
  buffett: BUFFETT_LINES,
  vanderbilt: VANDERBILT_LINES,
  musk: MUSK_LINES,
}
