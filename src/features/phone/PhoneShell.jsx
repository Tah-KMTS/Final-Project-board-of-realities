import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowLeft, Wallet, Siren, Rss, Heart, EyeOff, Rocket, CalendarClock, TrendingUp } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import { NET_WORTH_WIN_TARGET, NET_WORTH_MILESTONES } from '../../features/finance/marketData'

// The 5 planned apps. `social`/`banking`/`startups`/`darkweb` are wired to
// real content (Social/X -> AgentInteractionsModal + the news ticker,
// Banking & Portfolio -> BankModal/StockExchangeModal/SyndicateBoardModal,
// Startups & M&A -> CorporateModal, Dark Web & Underground ->
// UnderworldModal/HitmanContractModal/SyndicateOperationsModal/
// NarcoticsTradeModal - see src/features/phone/
// {SocialApp,BankingApp,StartupsApp,DarkWebApp,ContactsApp}.jsx) via the
// `apps` prop below. All 5 are now wired.
const APP_DEFS = [
  { id: 'social', label: 'Social/X', Icon: Rss, color: 'cyan', enabled: true },
  { id: 'banking', label: 'Banking', Icon: Wallet, color: 'emerald', enabled: true },
  { id: 'contacts', label: 'Contacts', Icon: Heart, color: 'rose', enabled: true },
  { id: 'darkweb', label: 'Dark Web', Icon: EyeOff, color: 'red', enabled: true },
  { id: 'startups', label: 'Startups', Icon: Rocket, color: 'violet', enabled: true },
]

const ICON_COLOR_CLASSES = {
  cyan: 'text-cyan-400 border-cyan-400/70 bg-cyan-500/10',
  emerald: 'text-emerald-400 border-emerald-400/70 bg-emerald-500/10',
  rose: 'text-rose-400 border-rose-400/70 bg-rose-500/10',
  red: 'text-red-500 border-red-500/70 bg-red-500/10',
  violet: 'text-violet-400 border-violet-400/70 bg-violet-500/10',
}

/**
 * Persistent phone overlay shell. This pass only builds the frame + home
 * screen navigation - no real app content yet (that's a follow-up pass).
 *
 * `apps` is the plug point for that follow-up: an optional object keyed by
 * app id ('social' | 'banking' | 'startups') whose value is a render
 * function `() => ReactNode` for that app's real screen. Any app id not
 * present in `apps` falls back to an inline "Coming soon" placeholder, so
 * this shell works standalone today and just starts rendering real content
 * the moment a caller passes e.g. `apps={{ banking: () => <BankModal .../> }}`.
 */
export default function PhoneShell({ onClose, apps = {} }) {
  const [screen, setScreen] = useState('home') // 'home' | appId

  const cash = useGameStore((s) => s.cash)
  const wantedLevel = useGameStore((s) => s.wantedLevel)
  const day = useGameStore((s) => s.day)
  const computeNetWorth = useGameStore((s) => s.computeNetWorth)
  const world2 = useGameStore((s) => s.world2)
  const heatPct = Math.round((wantedLevel / 5) * 100)
  const heatDanger = heatPct >= 60

  // Same net-worth-target computation FinanceStatusBar.jsx used to do before
  // the header strip-down - the denominator progresses through the
  // milestone ladder (next unreached tier's threshold/name) rather than the
  // static $1B flex target, falling back to $1B once all 5 tiers are
  // cleared. Reused verbatim here since the header no longer shows it.
  const netWorth = computeNetWorth()
  const earnedMilestones = world2.netWorthMilestones || []
  const nextMilestone = NET_WORTH_MILESTONES.find((tier) => !earnedMilestones.includes(tier.id))
  const netWorthTargetLabel = nextMilestone
    ? `$${nextMilestone.threshold.toLocaleString()} (${nextMilestone.name})`
    : `$${(NET_WORTH_WIN_TARGET / 1e9).toFixed(1)}B`

  const activeApp = APP_DEFS.find((a) => a.id === screen)
  const renderActiveApp = activeApp && apps[activeApp.id]

  return (
    <div className="fixed inset-0 z-50 bg-black/70">
      <motion.div
        initial={{ opacity: 0, scale: 0.4, x: 260, y: 260 }}
        animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, scale: 0.4, x: 260, y: 260 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        style={{ animation: 'none' }}
        className="glass-panel neon-ring absolute bottom-6 right-6 flex h-[720px] w-[360px] flex-col overflow-hidden rounded-[2.5rem] border-2 border-violet-400/60 bg-[#0a0b18] p-3 font-mono text-white"
      >
        {/* Screen area - reuses the game's existing panel gradient */}
        <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#1c1d3a] px-4 pb-4 pt-3">
          {/* Status tray - Cash + Wanted/Heat from the original build, plus
              Day and Net Worth (computed the same way FinanceStatusBar.jsx
              used to before the header strip-down) now that this is the only
              place those two are still shown. Two rows: not enough width in
              this 360px frame for all 4 stats plus the back/close buttons on
              one line. */}
          <div className="mb-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {screen !== 'home' && (
                  <button
                    onClick={() => setScreen('home')}
                    className="mr-1 rounded border border-white/20 p-1 text-gray-300 hover:bg-white/10"
                    title="Back to home screen"
                  >
                    <ArrowLeft size={14} />
                  </button>
                )}
                <CalendarClock size={14} className="text-cyan-300" />
                <span className="font-bold text-cyan-300">Day {day}</span>
              </div>
              <button
                onClick={onClose}
                className="rounded border border-white/20 p-1 text-gray-300 hover:bg-white/10"
                title="Close phone"
              >
                <X size={14} />
              </button>
            </div>

            <div className="mt-1.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Wallet size={14} className="text-emerald-300" />
                <span>
                  <b className="text-emerald-300">${Math.round(cash).toLocaleString()}</b>
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-1" title="Net Worth">
                <TrendingUp size={14} className="shrink-0 text-fuchsia-300" />
                <span className="truncate">
                  <b className="text-fuchsia-300">${Math.round(netWorth).toLocaleString()}</b>
                  <span className="text-gray-500"> / {netWorthTargetLabel}</span>
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1" title="Police Heat / SEC Suspicion">
                <Siren size={14} className={heatDanger ? 'animate-pulse text-red-500' : 'text-orange-300'} />
                <span className={heatDanger ? 'font-bold text-red-400' : 'text-orange-300'}>{heatPct}%</span>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {screen === 'home' ? (
              <motion.div
                key="home"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="grid flex-1 grid-cols-2 content-start gap-4 pt-2"
              >
                {APP_DEFS.map(({ id, label, Icon, color, enabled }) => (
                  <button
                    key={id}
                    disabled={!enabled}
                    onClick={() => enabled && setScreen(id)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-bold transition-colors ${
                      enabled
                        ? `${ICON_COLOR_CLASSES[color]} hover:bg-white/10`
                        : 'cursor-not-allowed border-gray-600/50 bg-white/5 text-gray-500 opacity-50'
                    }`}
                    title={enabled ? label : `${label} (coming soon)`}
                  >
                    <Icon size={22} />
                    <span>{label}</span>
                  </button>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key={screen}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                className="flex flex-1 flex-col"
              >
                {renderActiveApp ? (
                  renderActiveApp()
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-gray-400">
                    {activeApp && <activeApp.Icon size={32} className={ICON_COLOR_CLASSES[activeApp.color].split(' ')[0]} />}
                    <p className="text-sm font-bold text-gray-300">{activeApp?.label}</p>
                    <p className="text-xs italic text-gray-500">Coming soon.</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
