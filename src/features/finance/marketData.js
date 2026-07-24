// Simulated (fictional) market data - not real tickers, not real financial
// advice. Prices random-walk each tick so the market feels alive.

export const STOCKS = [
  { ticker: 'GRT', name: 'Grit Corp', basePrice: 42 },
  { ticker: 'NMB', name: 'Nimbus Technologies', basePrice: 118 },
  { ticker: 'SLF', name: 'Solace Foods', basePrice: 27 },
  { ticker: 'VEX', name: 'Vex Dynamics', basePrice: 264 },
]

export const CRYPTO_BASE_PRICE = 0.02
export const CRYPTO_NAME = 'ShrimpCoin'
export const CRYPTO_TICKER = 'SHRP'

export const REAL_ESTATE_LISTINGS = [
  { id: 're_apartment', name: 'Downtown Apartment Block', price: 50000, rentPerTick: 400 },
  { id: 're_office', name: 'Midtown Office Tower', price: 150000, rentPerTick: 1400 },
  { id: 're_mall', name: 'Suburban Shopping Mall', price: 400000, rentPerTick: 4200 },
]

export const COMPANY_LISTINGS = [
  { id: 'co_startup', name: 'Acquire a Startup', price: 80000, incomePerTick: 900 },
  { id: 'co_midcap', name: 'Take Over a Mid-Cap Firm', price: 300000, incomePerTick: 3800 },
  { id: 'co_conglomerate', name: 'Buy a Conglomerate', price: 1000000, incomePerTick: 14000 },
]

export const NET_WORTH_WIN_TARGET = 1000000000

// Job ladder (replaces the old flat JOB_WAGE/JOB_COOLDOWN_MS real-time
// cooldown - see workShift() in useGameStore.js, which now gates shifts on
// energy only and pays whatever the highest tier the player qualifies for
// pays). Listed lowest to highest; currentJobTier() in the store walks this
// backwards and returns the first one the player meets both gates for.
export const JOB_TIERS = [
  { id: 'clerk', label: 'Entry Clerk', minInt: 0, minReputation: 0, pay: 200 },
  { id: 'analyst', label: 'Analyst', minInt: 10, minReputation: 20, pay: 500 },
  { id: 'manager', label: 'Manager', minInt: 20, minReputation: 40, pay: 1200 },
  { id: 'executive', label: 'Executive', minInt: 35, minReputation: 65, pay: 3000 },
]
export const JOB_ENERGY_COST = 20

// Loan/credit tiers - creditScore() in the store derives a 0-100 score from
// reputation/wantedLevel/net worth (same 0-100 convention as every other
// stat in the game, not a 300-850 FICO scale) rather than storing it, so it
// always reflects the player's current standing.
export const LOAN_TIERS = [
  { minCreditScore: 70, maxLoan: 50000, interestPerDay: 0.05 },
  { minCreditScore: 40, maxLoan: 20000, interestPerDay: 0.10 },
  { minCreditScore: 0, maxLoan: 5000, interestPerDay: 0.20 },
]

export function randomWalk(price, volatility) {
  const change = 1 + (Math.random() - 0.5) * volatility
  // Floor scales with the price itself (rather than a fixed 0.5) so a
  // low-base asset like crypto doesn't get clamped up to 25x its value.
  return Math.max(price * 0.01, 0.001, price * change)
}
