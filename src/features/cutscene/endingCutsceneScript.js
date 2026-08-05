// Ending cutscene script - fires the moment the HUD cash figure reaches
// $10,000,000 (the watcher is in WorldScreen.jsx; the screen switch is
// useGameStore's triggerEnding()). Closes the loop the opening opened:
// the debt from introCutsceneScript.js gets paid, he goes home, and he
// goes back to class.
//
// Same entry shape as the opening - see introCutsceneScript.js for the
// `panel` / `speaker` / `sfx` contract. Panels live in endingPanels.js.

// The number the HUD cash figure has to reach for the ending to fire.
// Deliberately raw `cash`, not computeNetWorth() - the brief was "when the
// cash indicator at the top hits ten million", and that indicator renders
// state.cash (WorldScreen.jsx). This is therefore a different, stricter
// condition than marketData.js's net-worth-based FINANCE_VICTORY_TARGET,
// which still drives the Stock Exchange's "richest person alive" button.
export const ENDING_CASH_TARGET = 10000000

export const ENDING_SPEAKERS = {
  narrator: { label: '', color: '#8b8ba7', voice: 'narrator', italic: true },
  you: { label: 'YOU', color: '#fde047', voice: 'player' },
  dad: { label: 'DAD', color: '#fb923c', voice: 'gruff' },
  system: { label: 'SYSTEM', color: '#4ade80', voice: 'robot' },
  lecturer: { label: 'LECTURER', color: '#67e8f9', voice: 'receptionist' },
}

export const ENDING_CUTSCENE = [
  // --- paying it off ---
  {
    panel: 'settlement',
    speaker: 'narrator',
    text: 'Ten million dollars. You did not find it in one night, and nothing about getting it was quick.',
  },
  {
    panel: 'settlement',
    speaker: 'you',
    text: 'Settle it. All of it. Every cent against the outstanding balance.',
  },
  {
    panel: 'settlement',
    speaker: 'system',
    text: 'TRANSFER COMPLETE. Outstanding balance: $0. Account closed in good standing. PAID IN FULL.',
    sfx: 'questComplete',
  },
  {
    panel: 'settlement',
    speaker: 'narrator',
    text: 'The same terminal that printed MARGIN CALL printed that. It took the exact same three seconds to do it.',
  },

  // --- going home ---
  {
    panel: 'homecoming',
    speaker: 'narrator',
    text: 'You took the train home. This time you knocked on the study door without rehearsing anything first.',
  },
  {
    panel: 'homecoming',
    speaker: 'you',
    text: "It's paid. Not refinanced, not deferred - paid. And your thousand dollars is still the only money I ever took from you.",
  },
  {
    panel: 'homecoming',
    speaker: 'dad',
    text: "...Sit down. I'm not going to say I'm proud of how it started.",
  },
  {
    panel: 'homecoming',
    speaker: 'dad',
    text: "But you paid a ten-million-dollar debt at twenty-two, and you did it without lying to me once. Sit down, and eat something.",
    sfx: 'victory',
  },

  // --- back to class ---
  {
    panel: 'lecture',
    speaker: 'narrator',
    text: 'Term started again in September. You went back with two exams still owed and a seat in the second row.',
  },
  {
    panel: 'lecture',
    speaker: 'lecturer',
    text: "...which is why leverage is not a strategy. It is a multiplier applied to whatever strategy you already have - including a bad one.",
  },
  {
    panel: 'lecture',
    speaker: 'you',
    text: '(I could have saved myself ten million dollars by attending this lecture.)',
  },

  // --- doing it properly ---
  {
    panel: 'studyingRight',
    speaker: 'narrator',
    text: 'You kept investing. You just stopped trying to skip to the end of it.',
  },
  {
    panel: 'studyingRight',
    speaker: 'you',
    text: 'One times leverage. Boring, slow, and mine. Seven percent a year is not a headline - it is a life.',
  },
  {
    panel: 'studyingRight',
    speaker: 'narrator',
    text: 'You read the agreements now. All of them. It turns out they were never long - you had just never been willing to wait.',
  },

  // --- out into the morning ---
  {
    panel: 'campusMorning',
    speaker: 'narrator',
    text: 'The city is still out there, and it still eats people who are in a hurry. You are simply no longer one of them.',
  },
  {
    panel: 'campusMorning',
    speaker: 'you',
    text: "Ten million, paid. Two exams, then coffee. That'll do.",
  },
  {
    panel: 'campusMorning',
    speaker: 'narrator',
    text: 'He made it back. Slowly, in the end - which was always the only way it was going to work.',
  },
]
