import { useState } from 'react'
import { MessageCircle, Repeat2, Heart } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import { FINANCE_NPCS } from './financeNpcs'
import { getCityById } from '../world/japanCities'

const FILTERS = [
  { id: 'all', label: 'All', activeClasses: 'border-cyan-400 text-cyan-300' },
  { id: 'butterfly', label: '🦋 Butterfly', activeClasses: 'border-fuchsia-400 text-fuchsia-300' },
  { id: 'migration', label: '✈️ Migrations', activeClasses: 'border-emerald-400 text-emerald-300' },
  { id: 'assets', label: '💰 Assets', activeClasses: 'border-yellow-400 text-yellow-300' },
  { id: 'city', label: '🏙️ In City', activeClasses: 'border-orange-400 text-orange-300' },
]

// Splits an event's title into its leading emoji (for the fallback avatar)
// and the remaining category text (e.g. "🦋 Butterfly Effect" -> emoji "🦋",
// category "Butterfly Effect"). Falls back to a generic 📡 emoji for titles
// with no leading emoji (e.g. the old "AGENT INTEL LOG" default).
// Crude but reliable non-ASCII check (avoids both Unicode-property regex
// classes and control-character regex ranges, and their assorted lint
// pitfalls) - a plain charCodeAt scan instead.
function hasNonAsciiChar(str) {
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 127) return true
  }
  return false
}

function splitTitleEmoji(title) {
  const raw = (title || 'Agent Intel').trim()
  const spaceIdx = raw.indexOf(' ')
  if (spaceIdx > 0) {
    const lead = raw.slice(0, spaceIdx)
    const rest = raw.slice(spaceIdx + 1).trim()
    // Every real title in this game is "<emoji> Words", so a non-ASCII
    // leading token is always the emoji.
    if (rest && hasNonAsciiChar(lead)) return { emoji: lead, category: rest }
  }
  return { emoji: '📡', category: raw }
}

// Scans an event's text for any FINANCE_NPCS name mentioned by name, so the
// feed card can show a "who posted this" avatar even though agentEventFeed
// entries carry no actor id - see class comment on SocialApp.jsx.
function findMentionedNpc(text) {
  if (!text) return null
  return FINANCE_NPCS.find((n) => text.includes(n.name)) || null
}

// `embedded` (default false): the former "Titan Feed" header button's
// content. That button is gone (folded into the Phone's Social/X app - see
// src/features/phone/SocialApp.jsx); embedded=true drops the outer
// fixed-overlay wrapper and the bottom "Close Feed" button, same convention
// as every other hub-tab modal in this codebase (CryptoModal.jsx etc).
export default function AgentInteractionsModal({ onClose, embedded = false }) {
  const world2 = useGameStore((s) => s.world2)
  const currentCityId = useGameStore((s) => s.currentCityId) || 'tokyo'
  const [filterType, setFilterType] = useState('all') // 'all' | 'butterfly' | 'migration' | 'assets' | 'city'

  const eventFeed = world2.agentEventFeed || []
  const city = getCityById(currentCityId)

  const filteredFeed = eventFeed.filter((evt) => {
    if (filterType === 'butterfly') return evt.title?.includes('Butterfly') || evt.type === 'butterfly'
    if (filterType === 'migration') return evt.title?.includes('Migration') || evt.type === 'migration'
    if (filterType === 'assets') return evt.title?.includes('Asset') || evt.type === 'asset'
    if (filterType === 'city') return evt.city === currentCityId || evt.text?.includes(city.name)
    return true
  })

  const body = (
    <>
        {/* Compact single-line header - wordmark + current city, most of the
            vertical space goes to the feed below rather than a dashboard
            banner. */}
        <div className="flex shrink-0 items-center justify-between border-b border-cyan-500/30 pb-1.5">
          <span className="text-sm font-extrabold tracking-wide text-cyan-300">X</span>
          <span className="text-xs text-gray-400">{city.name}</span>
        </div>

        {/* Filter chips - slim single-line row, active state is just a
            filled border + text color, no bg-fill blocks. The "Agents"
            roster tab that used to sit next to Feed was removed - the NPC
            routine/simulation data it displayed (TITAN_ROUTINES/agentsState)
            is backend-only now, feeding the Feed's content rather than
            having its own player-facing screen. */}
        <div className="mt-2 flex shrink-0 gap-1.5 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition-colors ${
                filterType === f.id ? f.activeClasses : 'border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-2 flex-1 space-y-2 overflow-y-auto">
          {filteredFeed.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded border border-dashed border-gray-800 text-center text-gray-500">
              <span className="text-4xl mb-2">📡</span>
              <p className="text-sm font-bold text-gray-400">No agent interaction logs yet.</p>
              <p className="text-xs max-w-md mt-1 text-gray-500">
                Press <span className="text-cyan-300 font-bold">End Day</span> to trigger autonomous agent interactions, butterfly chain reactions, and town migrations!
              </p>
            </div>
          ) : (
            filteredFeed.map((evt) => {
              const mentionedNpc = findMentionedNpc(evt.text)
              const { emoji, category } = splitTitleEmoji(evt.title)
              return (
                <div key={evt.id} className="rounded border border-cyan-500/30 bg-cyan-950/10 p-2.5 shadow-md">
                  <div className="flex items-start gap-2">
                    {mentionedNpc ? (
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-600 text-xs font-bold"
                        style={{ backgroundColor: mentionedNpc.palette?.outfit || '#1a1a1a', color: '#ffffff' }}
                      >
                        {mentionedNpc.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                      </div>
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-600 bg-gray-800 text-sm">
                        {emoji}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-yellow-300">
                        {mentionedNpc ? mentionedNpc.name : 'Market Intel'}
                      </div>
                      <div className="truncate text-xs text-gray-500">{category}</div>
                    </div>
                  </div>
                  <div className="mt-1.5 text-base leading-relaxed text-gray-100">{evt.text}</div>
                  <div className="mt-2 flex items-center gap-4 text-gray-600">
                    <MessageCircle size={13} />
                    <Repeat2 size={13} />
                    <Heart size={13} />
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        {!embedded && (
          <div className="border-t border-gray-800 bg-[#121429] p-4 text-right">
            <button
              onClick={onClose}
              className="border-2 border-gray-600 bg-gray-800 px-6 py-2 text-xs font-bold text-white hover:bg-gray-700 transition-colors"
            >
              Close Feed
            </button>
          </div>
        )}
    </>
  )

  // Embedded mode drops the fixed h-[90vh] overlay panel entirely - the
  // wrapping Phone app tab already gives this its own scrollable area, same
  // reasoning as GovernmentModal.jsx's embedded branch.
  if (embedded) return <div className="flex max-h-[70vh] flex-col overflow-y-auto text-white">{body}</div>

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 font-mono">
      <div className="flex h-[90vh] w-full max-w-4xl flex-col border-4 border-cyan-500/70 bg-[#0c1024] text-white shadow-2xl">
        {body}
      </div>
    </div>
  )
}
