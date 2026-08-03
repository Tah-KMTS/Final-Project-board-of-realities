import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import Blackjack from './Blackjack'
import Poker from './Poker'
import Slots from './Slots'
import RussianRoulette from './RussianRoulette'
import ChallengeNpc from './ChallengeNpc'
import ArcadeModal from '../arcade/ArcadeModal'

const TABS = [
  { id: 'blackjack', label: 'Blackjack' },
  { id: 'poker', label: 'Poker' },
  { id: 'slots', label: 'Slots' },
  { id: 'roulette', label: 'Russian Roulette' },
  { id: 'challenge', label: 'Challenge an NPC' },
  { id: 'host_blackjack', label: 'Host Blackjack (House Edge)' },
  { id: 'host_poker', label: 'Host Poker (House Edge)' },
  // Building consolidation (Phase 2): Pixel Palace Arcade merged into the
  // Casino building - its content is unchanged, just reached as a tab here
  // instead of its own building/modal (see ArcadeModal.jsx's `embedded` prop).
  { id: 'arcade', label: 'Pixel Palace Arcade' },
]

export default function CasinoModal({ onClose }) {
  const cash = useGameStore((s) => s.cash)
  const [tab, setTab] = useState('blackjack')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="glass-panel w-[640px] border-4 border-pink-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <p className="mb-1 text-xs uppercase tracking-widest text-gray-500">Commercial District</p>
        <h2 className="mb-2 text-xl font-bold text-pink-300">Neon Dragon Casino</h2>
        <p className="mb-3 text-xs text-gray-400">
          Chips clatter under buzzing neon dragons. The house always has an edge - but so do you, tonight.
        </p>

        <div className="mb-3 border-2 border-gray-600 bg-[#0f1020] p-2 text-sm">
          Cash: <span className="text-green-400">${Math.round(cash).toLocaleString()}</span>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`border-2 px-3 py-1 text-xs font-bold ${
                tab === t.id ? 'border-pink-400 bg-pink-400/20 text-pink-300' : 'border-gray-600 text-gray-400 hover:border-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mb-4 max-h-[460px] overflow-y-auto">
          {tab === 'blackjack' && <Blackjack variant="house" />}
          {tab === 'poker' && <Poker variant="house" />}
          {tab === 'slots' && <Slots />}
          {tab === 'roulette' && <RussianRoulette />}
          {tab === 'challenge' && <ChallengeNpc />}
          {tab === 'host_blackjack' && <Blackjack variant="playerHouse" dealerName="The Challenger" />}
          {tab === 'host_poker' && <Poker variant="playerHouse" />}
          {tab === 'arcade' && <ArcadeModal embedded />}
        </div>

        <button onClick={onClose} className="w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500">
          Leave the Casino Floor
        </button>
      </div>
    </div>
  )
}
