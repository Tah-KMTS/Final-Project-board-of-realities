// Shared deck/card-value/poker-hand-ranking utilities for Blackjack.jsx and
// Poker.jsx. A standard 52-card deck, fully re-shuffled at the start of
// every hand (simplification: real casinos deal from a multi-deck "shoe"
// that persists across hands so card-counting has something to count across
// hands; here each hand is an independent fresh shuffle, which is also why
// Blackjack's "Count Cards" option below reads the dealer's hole card
// directly instead of simulating a running count).

export const SUITS = ['♠', '♥', '♦', '♣']
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

export function createDeck() {
  const deck = []
  for (const suit of SUITS) {
    for (let i = 0; i < RANKS.length; i++) {
      deck.push({ rank: RANKS[i], suit, rankIndex: i, id: `${RANKS[i]}${suit}` })
    }
  }
  return deck
}

export function shuffle(deck) {
  const d = [...deck]
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

export function isRed(card) {
  return card.suit === '♥' || card.suit === '♦'
}

// ---------------- Blackjack ----------------

export function blackjackCardValue(rank) {
  if (rank === 'A') return 11
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10
  return Number(rank)
}

// Soft-ace-aware hand total (aces count as 11 unless that would bust, then
// they drop to 1 one at a time).
export function blackjackTotal(cards) {
  let total = cards.reduce((sum, c) => sum + blackjackCardValue(c.rank), 0)
  let aces = cards.filter((c) => c.rank === 'A').length
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }
  return total
}

export function isBlackjack(cards) {
  return cards.length === 2 && blackjackTotal(cards) === 21
}

// ---------------- Poker (5-card hand ranking) ----------------

const HAND_NAMES = [
  'High Card',
  'Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush',
]

// Returns { rank: 0-8, tiebreak: [...], name } for a 5-card hand. Higher
// rank always wins; ties are broken by comparing `tiebreak` arrays in order.
export function evaluateHand(cards) {
  const values = cards
    .map((c) => (c.rankIndex === 0 ? 14 : c.rankIndex + 1)) // Ace high (14) by default
    .sort((a, b) => a - b)

  const suitCounts = {}
  for (const c of cards) suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1
  const isFlush = Object.values(suitCounts).some((n) => n === 5)

  const uniqueVals = [...new Set(values)]
  let isStraight = false
  let straightHigh = 0
  if (uniqueVals.length === 5) {
    if (uniqueVals[4] - uniqueVals[0] === 4) {
      isStraight = true
      straightHigh = uniqueVals[4]
    } else if (uniqueVals.join(',') === '2,3,4,5,14') {
      // wheel straight: A-2-3-4-5, the Ace plays low and the "high" card is the 5
      isStraight = true
      straightHigh = 5
    }
  }

  const valueCounts = {}
  for (const v of values) valueCounts[v] = (valueCounts[v] || 0) + 1
  const counts = Object.entries(valueCounts)
    .map(([v, c]) => ({ v: Number(v), c }))
    .sort((a, b) => b.c - a.c || b.v - a.v)
  const countPattern = counts.map((x) => x.c).join('')

  let rank
  let tiebreak
  if (isStraight && isFlush) {
    rank = 8
    tiebreak = [straightHigh]
  } else if (countPattern.startsWith('4')) {
    rank = 7
    tiebreak = counts.map((x) => x.v)
  } else if (countPattern === '32') {
    rank = 6
    tiebreak = counts.map((x) => x.v)
  } else if (isFlush) {
    rank = 5
    tiebreak = values.slice().reverse()
  } else if (isStraight) {
    rank = 4
    tiebreak = [straightHigh]
  } else if (countPattern.startsWith('3')) {
    rank = 3
    tiebreak = counts.map((x) => x.v)
  } else if (countPattern === '221') {
    rank = 2
    tiebreak = counts.map((x) => x.v)
  } else if (countPattern.startsWith('2')) {
    rank = 1
    tiebreak = counts.map((x) => x.v)
  } else {
    rank = 0
    tiebreak = values.slice().reverse()
  }

  return { rank, tiebreak, name: HAND_NAMES[rank] }
}

// Positive = a beats b, negative = b beats a, 0 = true tie (split the pot).
export function compareHands(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank
  const len = Math.max(a.tiebreak.length, b.tiebreak.length)
  for (let i = 0; i < len; i++) {
    const av = a.tiebreak[i] || 0
    const bv = b.tiebreak[i] || 0
    if (av !== bv) return av - bv
  }
  return 0
}
