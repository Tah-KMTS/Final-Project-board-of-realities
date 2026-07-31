import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import AgentInteractionsModal from '../finance/AgentInteractionsModal'
import { STOCKS, CRYPTO_NAME } from '../finance/marketData'

// The 5 postable targets - preset picker only (no free text), same design
// rationale as everywhere else in this file: bounded outcomes, no
// content-moderation surface.
const POST_TARGETS = [
  ...STOCKS.map((s) => ({ id: s.ticker, label: s.ticker })),
  { id: 'CRYPTO', label: CRYPTO_NAME },
]

// Phone's Social/X app. This is the former "Titan Feed" header button's
// content (AgentInteractionsModal, embedded - see that file's `embedded`
// prop), plus the news headline ticker that used to live in
// FinanceStatusBar.jsx, plus a "post to manipulate market sentiment" panel -
// folded in here since posting/feed/news content all belong on the same
// social app screen.
export default function SocialApp() {
  const newsHeadline = useGameStore((s) => s.newsHeadline)
  const day = useGameStore((s) => s.day)
  const lastPostDay = useGameStore((s) => s.world2.lastPostDay)
  const postToMarket = useGameStore((s) => s.postToMarket)

  const [target, setTarget] = useState('GRT')
  const [direction, setDirection] = useState('up')
  const [result, setResult] = useState(null)

  const alreadyPostedToday = lastPostDay != null && day <= lastPostDay

  const handlePost = () => {
    const res = postToMarket({ target, direction })
    setResult(res)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {newsHeadline && (
        <div className="mb-2 flex shrink-0 items-center gap-1.5 rounded border border-cyan-500/30 bg-cyan-950/20 px-2 py-1.5 text-[11px] italic text-cyan-200">
          <span className="shrink-0">📰</span>
          <span>{newsHeadline}</span>
        </div>
      )}

      {/* Post composer - two-step preset picker (target, then direction),
          then a Post button gated by the same day's-cooldown pattern as
          Temple's Seek Atonement button (disabled={...} + opacity-30). */}
      <div className="mb-2 shrink-0 rounded border border-cyan-500/30 bg-[#0c1024] p-2">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-cyan-400">
          Post to Manipulate Sentiment (20 Energy)
        </div>

        <div className="mb-1.5 flex flex-wrap gap-1">
          {POST_TARGETS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTarget(t.id)}
              className={`rounded border px-2 py-1 text-[10px] font-bold transition-colors ${
                target === t.id
                  ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300'
                  : 'border-gray-600 text-gray-400 hover:border-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mb-1.5 flex gap-1">
          <button
            onClick={() => setDirection('up')}
            className={`flex-1 rounded border px-2 py-1 text-[10px] font-bold transition-colors ${
              direction === 'up'
                ? 'border-emerald-400 bg-emerald-400/20 text-emerald-300'
                : 'border-gray-600 text-gray-400 hover:border-gray-400'
            }`}
          >
            📈 Talk Up
          </button>
          <button
            onClick={() => setDirection('down')}
            className={`flex-1 rounded border px-2 py-1 text-[10px] font-bold transition-colors ${
              direction === 'down'
                ? 'border-red-400 bg-red-400/20 text-red-300'
                : 'border-gray-600 text-gray-400 hover:border-gray-400'
            }`}
          >
            📉 Talk Down
          </button>
        </div>

        <button
          onClick={handlePost}
          disabled={alreadyPostedToday}
          className="w-full rounded border-2 border-cyan-400 py-1.5 text-xs font-bold text-cyan-300 transition-colors hover:bg-cyan-400 hover:text-black disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-cyan-300"
        >
          {alreadyPostedToday ? 'Already Posted Today' : 'Post'}
        </button>

        {result && !result.success && (
          <div className="mt-1.5 text-[10px] font-bold text-red-400">{result.reason}</div>
        )}
        {result?.success && (
          <div className="mt-1.5 text-[10px] font-bold text-emerald-400">
            Posted. Effect resolves after the next End Day.
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <AgentInteractionsModal embedded />
      </div>
    </div>
  )
}
