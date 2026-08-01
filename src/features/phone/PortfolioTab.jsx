import { useGameStore } from '../../store/useGameStore'
import { REAL_ESTATE_LISTINGS, COMPANY_LISTINGS, CRYPTO_NAME, CRYPTO_TICKER } from '../finance/marketData'

// Banking app's default landing tab - a read-only "what do I actually own"
// summary, since the other 3 tabs (Bank & Realty/Stock Exchange/Syndicate
// Board) are all action screens with no single place that shows holdings
// across all of them at a glance.
//
// "Liquid Net Worth" reuses computeNetWorth() verbatim (cash + stocks +
// crypto - short liability) - the same number the milestone ladder/win
// condition already use elsewhere, so this screen never invents a second,
// competing net-worth figure. Real estate/companies are listed separately
// by their daily income rather than folded into that total: they have no
// live resale price anywhere in the game (buyRealEstate/buyCompany are
// one-way), so valuing them at purchase price would overstate net worth
// the moment prices market-move, and there's no sell path to make that
// number real - showing income instead of a fabricated valuation matches
// how the rest of the game actually treats these assets.
export default function PortfolioTab() {
  const cash = useGameStore((s) => s.cash)
  const world2 = useGameStore((s) => s.world2)
  const computeNetWorth = useGameStore((s) => s.computeNetWorth)

  const bankedAmount = world2.bankedAmount || 0
  const onHand = cash - bankedAmount
  const portfolio = world2.portfolio || {}
  const stocks = world2.stocks || []
  const cryptoHoldings = world2.cryptoHoldings || 0
  const cryptoPrice = world2.cryptoPrice || 0
  const ownedRealEstate = (world2.realEstate || [])
    .map((id) => REAL_ESTATE_LISTINGS.find((l) => l.id === id))
    .filter(Boolean)
  const ownedCompanies = (world2.companies || [])
    .map((id) => COMPANY_LISTINGS.find((l) => l.id === id))
    .filter(Boolean)

  const stockRows = Object.entries(portfolio).map(([ticker, holding]) => {
    const stock = stocks.find((s) => s.ticker === ticker)
    const price = stock?.price ?? holding.avgCost
    const value = price * holding.shares
    const costBasis = holding.avgCost * holding.shares
    const gain = value - costBasis
    const gainPct = costBasis > 0 ? (gain / costBasis) * 100 : 0
    return { ticker, name: stock?.name || ticker, shares: holding.shares, value, gain, gainPct }
  })

  const stockValue = stockRows.reduce((sum, r) => sum + r.value, 0)
  const cryptoValue = cryptoHoldings * cryptoPrice
  const liquidNetWorth = computeNetWorth()

  return (
    <div className="flex flex-col gap-2.5 text-white">
      <div className="rounded border border-emerald-500/40 bg-emerald-950/20 p-2.5 text-center">
        <div className="text-[10px] uppercase tracking-wide text-emerald-400">Liquid Net Worth</div>
        <div className="text-xl font-bold text-emerald-300">${Math.round(liquidNetWorth).toLocaleString()}</div>
        <div className="text-[10px] text-gray-500">Cash + Stocks + {CRYPTO_NAME}</div>
      </div>

      <div className="rounded border border-gray-700 bg-[#0c1024] p-2.5">
        <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-cyan-400">Cash</div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">On Hand</span>
          <span className="font-bold text-green-400">${Math.round(onHand).toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">In Bank (protected)</span>
          <span className="font-bold text-cyan-300">${Math.round(bankedAmount).toLocaleString()}</span>
        </div>
      </div>

      <div className="rounded border border-gray-700 bg-[#0c1024] p-2.5">
        <div className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-cyan-400">
          <span>Stocks</span>
          <span className="normal-case text-gray-400">${Math.round(stockValue).toLocaleString()}</span>
        </div>
        {stockRows.length === 0 ? (
          <p className="text-xs italic text-gray-500">No stock positions yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {stockRows.map((r) => (
              <div key={r.ticker} className="flex items-center justify-between text-xs">
                <span className="text-gray-300">
                  {r.name} <span className="text-gray-500">${r.ticker}</span> × {r.shares}
                </span>
                <span className="text-right">
                  <span className="font-bold text-white">${Math.round(r.value).toLocaleString()}</span>{' '}
                  <span className={r.gain >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    ({r.gain >= 0 ? '+' : ''}
                    {r.gainPct.toFixed(1)}%)
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded border border-gray-700 bg-[#0c1024] p-2.5">
        <div className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-cyan-400">
          <span>{CRYPTO_NAME}</span>
          <span className="normal-case text-gray-400">${Math.round(cryptoValue).toLocaleString()}</span>
        </div>
        {cryptoHoldings <= 0 ? (
          <p className="text-xs italic text-gray-500">No {CRYPTO_NAME} held.</p>
        ) : (
          <div className="flex justify-between text-xs text-gray-300">
            <span>
              {cryptoHoldings.toLocaleString()} {CRYPTO_TICKER}
            </span>
            <span className="font-bold text-white">${Math.round(cryptoValue).toLocaleString()}</span>
          </div>
        )}
      </div>

      {(ownedRealEstate.length > 0 || ownedCompanies.length > 0) && (
        <div className="rounded border border-gray-700 bg-[#0c1024] p-2.5">
          <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-yellow-400">Real Estate &amp; Companies</div>
          <div className="flex flex-col gap-1.5">
            {ownedRealEstate.map((l) => (
              <div key={l.id} className="flex justify-between text-xs text-gray-300">
                <span>{l.name}</span>
                <span className="text-yellow-300">+${l.rentPerTick.toLocaleString()}/day</span>
              </div>
            ))}
            {ownedCompanies.map((l) => (
              <div key={l.id} className="flex justify-between text-xs text-gray-300">
                <span>{l.name}</span>
                <span className="text-yellow-300">+${l.incomePerTick.toLocaleString()}/day</span>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] italic text-gray-600">
            Daily income shown, not counted toward Liquid Net Worth above - these have no live resale market.
          </p>
        </div>
      )}
    </div>
  )
}
