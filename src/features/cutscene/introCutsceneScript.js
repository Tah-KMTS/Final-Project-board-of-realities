// Opening cutscene script - plays once, immediately after "New Game", and
// sets up why the player starts the game with exactly $1,000 in a city
// where the win condition is $10,000,000 (see useGameStore.js's
// startNewGame + createDefaultState, and WelcomeIntroModal.jsx which
// shows the rules straight after this).
//
// One entry = one dialogue line. `panel` names a painter in
// cutscenePanels.js; consecutive lines sharing a panel hold on the same
// image while the narration moves, and the panel's animation clock only
// resets when the panel key actually changes - so a chart that draws
// itself in doesn't restart under every line of dialogue on top of it.
//
// `speaker` is looked up in SPEAKERS below for its colour and blip voice.
// `sfx` (optional) names a one-shot from audio/sfx.js, fired when the line
// starts.

export const SPEAKERS = {
  narrator: { label: '', color: '#8b8ba7', voice: 'narrator', italic: true },
  you: { label: 'YOU', color: '#fde047', voice: 'player' },
  dad: { label: 'DAD', color: '#fb923c', voice: 'gruff' },
  system: { label: 'SYSTEM', color: '#ef4444', voice: 'robot' },
  ad: { label: 'WHY-WAIT-40-YEARS.IO', color: '#e879f9', voice: 'robot' },
}

export const INTRO_CUTSCENE = [
  // --- the setup ---
  {
    panel: 'dorm',
    speaker: 'narrator',
    text: 'Third year of university. Two exams left, one part-time job, and a bank balance that has not moved in eleven months.',
  },
  {
    panel: 'dorm',
    speaker: 'you',
    text: "Everyone in my year is making money. Everyone. I'm the only one still checking the price of instant noodles.",
  },
  {
    panel: 'dorm',
    speaker: 'narrator',
    text: 'You had $4,000 saved. Slowly, honestly, and it was never going to be enough. So at 3 a.m. you went looking for a faster way.',
  },

  // --- the idea ---
  {
    panel: 'theAd',
    speaker: 'narrator',
    text: 'The internet is very good at finding people who are looking for a faster way.',
  },
  {
    panel: 'theAd',
    speaker: 'ad',
    text: 'WHY WAIT 40 YEARS? Trade with 25x LEVERAGE. Turn $4,000 into $100,000. Start in ninety seconds.',
  },
  {
    panel: 'theAd',
    speaker: 'you',
    text: "Twenty-five times... so I don't need capital at all. I just need to be right.",
  },
  {
    panel: 'theAd',
    speaker: 'narrator',
    text: 'You read that sentence as a discovery. It is, in fact, the oldest way there is to lose money quickly.',
  },

  // --- the win ---
  {
    panel: 'firstWin',
    speaker: 'narrator',
    text: 'You skipped the demo account. You skipped the reading. You put the entire $4,000 in on the first night - tuition included.',
  },
  {
    panel: 'firstWin',
    speaker: 'you',
    text: "It's working. It's actually working - that's four thousand into eleven in nine minutes.",
  },
  {
    panel: 'firstWin',
    speaker: 'narrator',
    text: 'The market had not made you smart. It had made you confident. Those feel identical from the inside.',
  },

  // --- all in ---
  {
    panel: 'allIn',
    speaker: 'you',
    text: 'If 25x did that with four thousand, then with the full margin line...',
  },
  {
    panel: 'allIn',
    speaker: 'narrator',
    text: "So you bought everything. Semiconductors. Airlines. A lithium fund. Some ticker you'd first heard of eleven minutes earlier.",
  },
  {
    panel: 'allIn',
    speaker: 'narrator',
    text: 'All of it leveraged. All of it borrowed. Ten million dollars of a stranger\'s money, and you pressed CONFIRM without reading one line of the agreement.',
  },

  // --- the turn ---
  {
    panel: 'crash',
    speaker: 'narrator',
    text: 'Then the market exhaled.',
    sfx: 'defeat',
  },
  {
    panel: 'crash',
    speaker: 'you',
    text: "It's fine. It'll bounce. It always bounces, it just has to—",
  },
  {
    panel: 'crash',
    speaker: 'narrator',
    text: "Leverage multiplies both directions. Nobody puts that part in the advertisement.",
  },

  // --- the number ---
  {
    panel: 'marginCall',
    speaker: 'system',
    text: 'MARGIN CALL. All positions liquidated at market. Outstanding balance is due in full within the repayment window.',
    sfx: 'defeat',
  },
  {
    panel: 'marginCall',
    speaker: 'you',
    text: "...That's not my number. That can't be my number. There's a minus in front of it.",
  },
  {
    panel: 'marginCall',
    speaker: 'narrator',
    text: 'Negative ten million dollars. Not lost savings - debt. Real, enforceable, and on a clock.',
  },

  // --- the father ---
  {
    panel: 'study',
    speaker: 'narrator',
    text: 'There was exactly one person left to ask. You took the train home and knocked on your father\'s study door.',
  },
  {
    panel: 'study',
    speaker: 'dad',
    text: 'Ten million dollars. You lost ten million dollars that you never had, on a website, in one week.',
  },
  {
    panel: 'study',
    speaker: 'you',
    text: 'Dad, please - if you just cover the margin, I can work it off, I swear I can—',
  },
  {
    panel: 'study',
    speaker: 'dad',
    text: 'You can WHAT? Borrow more? Is that the plan? Is the plan to do the exact thing again?',
  },
  {
    panel: 'study',
    speaker: 'dad',
    text: "I built this house at a desk, over thirty years. You set fire to three of them in a week and came to me for a match.",
  },

  // --- the thousand ---
  {
    panel: 'theThousand',
    speaker: 'dad',
    text: "No. I'm not paying it. You are.",
  },
  {
    panel: 'theThousand',
    speaker: 'dad',
    text: "One thousand dollars. That is what I have for you. Not a loan - the last thing I'm giving you.",
    sfx: 'purchase',
  },
  {
    panel: 'theThousand',
    speaker: 'dad',
    text: "Don't come back to this house until that number is positive.",
  },

  // --- out the door ---
  {
    panel: 'cityDawn',
    speaker: 'narrator',
    text: 'One thousand dollars in your pocket. Ten million owed, on a deadline. And a city that has never once felt sorry for anybody.',
  },
  {
    panel: 'cityDawn',
    speaker: 'you',
    text: "...Fine. Ten million. I'll make every cent of it back.",
  },
  {
    panel: 'cityDawn',
    speaker: 'narrator',
    text: 'There are two ways to make that kind of money in this city. Only one of them is legal. Nobody is going to stop you from choosing.',
  },
]
