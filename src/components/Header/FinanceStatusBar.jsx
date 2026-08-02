import { motion } from 'framer-motion'
import { Smartphone } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'

// Header cleanup pass: this bar used to also show Day, Cash, Net Worth,
// Heat, and buttons for Places & Transit / Gov & Agencies / Titan Feed /
// Board, plus the news headline ticker. All of that moved into the phone
// (src/features/phone/PhoneShell.jsx's status tray + its Social/Banking
// apps - see SocialApp.jsx/BankingApp.jsx) or, for Gov & Agencies, was
// deleted outright as a redundant duplicate of the Government building's
// own "Government Affairs" tab (GovernmentBuildingModal.jsx already embeds
// the same GovernmentModal). Places & Transit's only reachable via the new
// Food Court building now (see OverworldScene.js's `foodCourt` building and
// WorldScreen.jsx's BUILDING_TO_INTERACTIVE_LOCATION). Only Phone and End
// Day are always-visible now.
export default function FinanceStatusBar({ onOpenPhone }) {
  const endDay = useGameStore((s) => s.endDay)

  return (
    <div className="glass-panel neon-ring w-full max-w-[1120px] rounded-lg px-4 py-3 text-xs text-white">
      <div className="flex items-center justify-end gap-3">
        {/* Phone Overlay Trigger */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.04 }}
          onClick={onOpenPhone}
          className="flex items-center gap-1 rounded border border-violet-400/80 bg-violet-500/20 px-2.5 py-1 text-xs font-bold text-violet-300 hover:bg-violet-500/40 transition-colors"
        >
          <Smartphone size={13} className="text-violet-400" />
          <span>Phone</span>
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
    </div>
  )
}
