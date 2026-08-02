import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import AgentInteractionsModal from '../finance/AgentInteractionsModal'
import { STOCKS, CRYPTO_NAME } from '../finance/marketData'

// The 5 postable targets - preset picker only (no free text), same design
// rationale as everywhere else in this file: bounded outcomes, no
// content-moderation surface. Carries both `name` (the full company name,
// what a real post/ticker-tag would actually show) and `ticker` (the
// cashtag) - the picker used to show raw tickers only ("GRT"), which read
// as an abbreviation puzzle rather than a real post target.
const POST_TARGETS = [
  ...STOCKS.map((s) => ({ id: s.ticker, name: s.name, ticker: s.ticker })),
  { id: 'CRYPTO', name: CRYPTO_NAME, ticker: null },
]

// Mirrors postToMarket's own templatedText formula in useGameStore.js
// exactly (target name + optional ticker + bullish/bearish), so the preview
// shown here is a true preview of the feed card that will actually post,
// not a separate guess at the wording.
function buildPreviewText(post, direction) {
  const tag = post.ticker ? ` ($${post.ticker})` : ''
  return `You posted about ${post.name}${tag} — sentiment turning ${direction === 'up' ? 'bullish' : 'bearish'}.`
}

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
  const selectedPost = POST_TARGETS.find((t) => t.id === target) || POST_TARGETS[0]
  const previewText = buildPreviewText(selectedPost, direction)

  const handlePost = () => {
    const res = postToMarket({ target, direction })
    setResult(res)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {newsHeadline && (
        <div className="mb-2 flex shrink-0 items-center gap-1.5 rounded border border-cyan-500/30 bg-cyan-950/20 px-2 py-1.5 text-xs italic text-cyan-200">
          <span className="shrink-0">📰</span>
          <span>{newsHeadline}</span>
        </div>
      )}

      {/* Post composer - two-step preset picker (target, then direction),
          a live preview card styled exactly like a real feed post (not a
          settings form), then a Post button gated by the same day's-cooldown
          pattern as Temple's Seek Atonement button (disabled={...} +
          opacity-30). Target buttons show the full company name with a
          small $TICKER badge rather than a bare ticker - the abbreviation-
          only version read as a puzzle instead of a real post target.
          Capped at 45% of the phone's height with its own scroll - on a
          short browser window (a smaller laptop screen vs. the desktop this
          was built on) this used to be tall enough to push the feed below
          it down to zero visible height. Now the composer scrolls
          internally instead, and the feed's flex-1 area always keeps room. */}
      <div className="mb-2 max-h-[45%] shrink-0 overflow-y-auto rounded border border-cyan-500/30 bg-[#0c1024] p-2">
        <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-cyan-400">
          Post to Manipulate Sentiment (20 Energy)
        </div>

        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {POST_TARGETS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTarget(t.id)}
              className={`rounded border px-2 py-1 text-left text-xs font-bold transition-colors ${
                target === t.id
                  ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300'
                  : 'border-gray-600 text-gray-400 hover:border-gray-400'
              }`}
            >
              {t.name}
              {t.ticker && <span className="ml-1 font-normal opacity-70">${t.ticker}</span>}
            </button>
          ))}
        </div>

        <div className="mb-1.5 flex gap-1">
          <button
            onClick={() => setDirection('up')}
            className={`flex-1 rounded border px-2 py-1 text-xs font-bold transition-colors ${
              direction === 'up'
                ? 'border-emerald-400 bg-emerald-400/20 text-emerald-300'
                : 'border-gray-600 text-gray-400 hover:border-gray-400'
            }`}
          >
            📈 Bullish Take
          </button>
          <button
            onClick={() => setDirection('down')}
            className={`flex-1 rounded border px-2 py-1 text-xs font-bold transition-colors ${
              direction === 'down'
                ? 'border-red-400 bg-red-400/20 text-red-300'
                : 'border-gray-600 text-gray-400 hover:border-gray-400'
            }`}
          >
            📉 Bearish Take
          </button>
        </div>

        {/* Live preview - same card shape as a real feed post (avatar,
            name, body text, engagement icon row), so composing reads as
            "here's the post you're about to send" rather than a form. */}
        <div className="mb-1.5 rounded border border-gray-700 bg-cyan-950/10 p-2">
          <div className="flex items-start gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-600 bg-gray-800 text-xs font-bold text-cyan-300">
              You
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-yellow-300">You</div>
              <div className="text-sm leading-snug text-gray-200">{previewText}</div>
            </div>
          </div>
        </div>

        <button
          onClick={handlePost}
          disabled={alreadyPostedToday}
          className="w-full rounded border-2 border-cyan-400 py-1.5 text-sm font-bold text-cyan-300 transition-colors hover:bg-cyan-400 hover:text-black disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-cyan-300"
        >
          {alreadyPostedToday ? 'Already Posted Today' : 'Post'}
        </button>

        {result && !result.success && (
          <div className="mt-1.5 text-xs font-bold text-red-400">{result.reason}</div>
        )}
        {result?.success && (
          <div className="mt-1.5 text-xs font-bold text-emerald-400">
            Posted. Effect resolves after the next End Day.
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <AgentInteractionsModal embedded />
      </div>
    </div>
  )
}
