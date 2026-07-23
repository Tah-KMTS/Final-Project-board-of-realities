import { motion, AnimatePresence } from 'framer-motion'
import { CalendarClock, Wallet, TrendingUp, Siren, Award, Newspaper, Users, Zap, Landmark, Utensils } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import { NET_WORTH_WIN_TARGET } from '../../features/finance/marketData'

export default function FinanceStatusBar({ onOpenBoard, onOpenAgentFeed, onOpenGov, onOpenLocations }) {
  const cash = useGameStore((s) => s.cash)
  const computeNetWorth = useGameStore((s) => s.computeNetWorth)
  const wantedLevel = useGameStore((s) => s.wantedLevel)
  const reputation = useGameStore((s) => s.reputation)
  const day = useGameStore((s) => s.day)
  const newsHeadline = useGameStore((s) => s.newsHeadline)
  const endDay = useGameStore((s) => s.endDay)
  const getDailyFinanceIncome = useGameStore((s) => s.getDailyFinanceIncome)
  const world2 = useGameStore((s) => s.world2)

  const netWorth = computeNetWorth()
  const heatPct = Math.round((wantedLevel / 5) * 100)
  const heatDanger = heatPct >= 60
  const { income, burn, net } = getDailyFinanceIncome()
  const recruitedCount = (world2.recruitedAdvisors || []).length
  const eventFeedCount = (world2.agentEventFeed || []).length
  const currentVehicle = (world2.transitState || {}).currentVehicle || 'On Foot'

  return (
    <div className="glass-panel neon-ring w-full max-w-[1120px] rounded-lg px-4 py-3 text-xs text-white">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-1.5">
          <CalendarClock size={14} className="text-cyan-300" />
          <span className="font-bold text-cyan-300">Day {day}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Wallet size={14} className="text-emerald-300" />
          <span>
            Cash <b className="text-emerald-300">${Math.round(cash).toLocaleString()}</b>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <TrendingUp size={14} className="text-fuchsia-300" />
          <span>
            Net Worth <b className="text-fuchsia-300">${Math.round(netWorth).toLocaleString()}</b>
            <span className="text-gray-500"> / ${(NET_WORTH_WIN_TARGET / 1e9).toFixed(1)}B</span>
          </span>
        </div>

        <div className="flex items-center gap-1" title="Daily passive income minus overhead/legal costs">
          <span className={net >= 0 ? 'font-bold text-green-300' : 'font-bold text-red-400'}>
            {net >= 0 ? '+' : ''}
            ${Math.round(net).toLocaleString()}/day
          </span>
        </div>

        <div className="flex items-center gap-1.5" title="Police Heat / SEC Suspicion">
          <Siren size={14} className={heatDanger ? 'animate-pulse text-red-500' : 'text-orange-300'} />
          <span className={heatDanger ? 'font-bold text-red-400' : 'text-orange-300'}>{heatPct}%</span>
        </div>

        {/* Places & Transit Modal Trigger */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.04 }}
          onClick={onOpenLocations}
          className="flex items-center gap-1 rounded border border-emerald-400/80 bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-300 hover:bg-emerald-500/40 transition-colors"
        >
          <Utensils size={13} className="text-emerald-400" />
          <span>Places & Transit ({currentVehicle})</span>
        </motion.button>

        {/* Government, Fed & FTC Modal Trigger */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.04 }}
          onClick={onOpenGov}
          className="flex items-center gap-1 rounded border border-amber-400/80 bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-300 hover:bg-amber-500/40 transition-colors"
        >
          <Landmark size={13} className="text-amber-400" />
          <span>Gov & Agencies</span>
        </motion.button>

        {/* Titan Intelligence Feed Modal Trigger */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.04 }}
          onClick={onOpenAgentFeed}
          className="flex items-center gap-1 rounded border border-cyan-400/80 bg-cyan-500/20 px-2.5 py-1 text-xs font-bold text-cyan-300 hover:bg-cyan-500/40 transition-colors"
        >
          <Zap size={13} className="text-cyan-400" />
          <span>Titan Feed ({eventFeedCount})</span>
        </motion.button>

        {/* Board of Realities Modal Trigger */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.04 }}
          onClick={onOpenBoard}
          className="flex items-center gap-1 rounded border border-yellow-400/80 bg-yellow-500/20 px-2.5 py-1 text-xs font-bold text-yellow-300 hover:bg-yellow-500/40 transition-colors"
        >
          <Users size={13} className="text-yellow-400" />
          <span>Board ({recruitedCount})</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.04 }}
          onClick={endDay}
          className="neon-border-magenta rounded-md border-2 border-fuchsia-400 bg-fuchsia-500/20 px-3 py-1.5 text-xs font-bold text-fuchsia-200 hover:bg-fuchsia-500/40"
        >
          End Day
        </motion.button>
      </div>

      <AnimatePresence mode="wait">
        {newsHeadline && (
          <motion.div
            key={newsHeadline}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2 flex items-center gap-1.5 border-t border-white/10 pt-2 text-[11px] text-gray-300"
          >
            <Newspaper size={12} className="shrink-0 text-cyan-300" />
            <span className="italic">{newsHeadline}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
