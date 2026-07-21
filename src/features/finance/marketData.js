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

export const NET_WORTH_WIN_TARGET = 5000000
export const JOB_WAGE = 200
export const JOB_COOLDOWN_MS = 20000

export function randomWalk(price, volatility) {
  const change = 1 + (Math.random() - 0.5) * volatility
  return Math.max(0.5, price * change)
}
