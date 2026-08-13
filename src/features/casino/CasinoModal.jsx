import { useCallback, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import Blackjack from './Blackjack'
import Poker from './Poker'
import Slots from './Slots'
import RussianRoulette from './RussianRoulette'
import ChallengeNpc from './ChallengeNpc'
import CasinoMapScene from './CasinoMapScene'

// The floor's real reference illustration (public/assets/packs/casino-interior/
// casino_interior.png, a 2048x2048 casino+arcade floor, user-supplied) used
// as a small header banner once you're past the walk-in screen below, same
// "real image cropped via background-position" technique as
// UnderworldModal.jsx's RoomBanner - see that file's own header comment for
// why. This modal still keeps its flat tab-button UI for actually PICKING a
// game (there's no per-room crop table here, just one fixed shot) - only the
// front door changed, from an instant click to walking up to the 777
// machine (CasinoMapScene.jsx) first, same as the user's Underworld request.
// Cropped tight on the 777 reel readout (the image's own literal center, and
// its single most recognizable prop) rather than the whole cabinet
// top-to-bottom - measured by hand against a coordinate-grid overlay of the
// source art, not guessed, the same way every other real-art crop in this
// game has been.
const CASINO_IMAGE_URL = '/assets/packs/casino-interior/casino_interior.png'
const CASINO_NATIVE_SIZE = 2048
const CASINO_BANNER_CROP = { x0: 833, y0: 974, x1: 1213, y1: 1076 }
const CASINO_BANNER_W = 592
const CASINO_BANNER_H = 160

function CasinoBanner() {
  const scale = CASINO_BANNER_W / (CASINO_BANNER_CROP.x1 - CASINO_BANNER_CROP.x0)
  const bg = CASINO_NATIVE_SIZE * scale
  return (
    <div
      className="relative mb-3 border-2 border-pink-500/60"
      style={{
        width: CASINO_BANNER_W,
        height: CASINO_BANNER_H,
        backgroundImage: `url(${CASINO_IMAGE_URL})`,
        backgroundSize: `${bg}px ${bg}px`,
        backgroundPosition: `${-(CASINO_BANNER_CROP.x0 * scale)}px ${-(CASINO_BANNER_CROP.y0 * scale)}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-8"
        style={{ background: 'linear-gradient(to bottom, transparent, #1c1d3a)' }}
      />
    </div>
  )
}

const TABS = [
  { id: 'blackjack', label: 'Blackjack' },
  { id: 'poker', label: 'Poker' },
  { id: 'slots', label: 'Slots' },
  { id: 'roulette', label: 'Russian Roulette' },
  { id: 'challenge', label: 'Challenge an NPC' },
  { id: 'host_blackjack', label: 'Host Blackjack (House Edge)' },
  { id: 'host_poker', label: 'Host Poker (House Edge)' },
]

// onOpenPhone/onEndDay are optional - FinanceStatusBar's own Phone/End Day
// buttons sit in the normal page flow, so a `fixed inset-0` modal like this
// one covers them entirely for as long as it's open (same as every other
// modal in the game). A casino session runs long enough that "back out
// entirely just to end the day or check the phone" was a real reported
// annoyance, so this modal gets its own copies wired straight to the same
// handlers WorldScreen.jsx gives FinanceStatusBar - see its own render site
// for how onEndDay also closes this modal first (so the daily report isn't
// left rendering underneath it).
export default function CasinoModal({ onClose, onOpenPhone, onEndDay }) {
  const cash = useGameStore((s) => s.cash)
  const [tab, setTab] = useState('blackjack')
  // false = the walk-in floor (CasinoMapScene) - the "pink building" front
  // door is gone, so this is now the very first thing a player sees, every
  // time the modal opens. true = the actual tab bar, reached by walking up
  // to the 777 machine and pressing Enter/E (or clicking it).
  const [entered, setEntered] = useState(false)
  // useCallback: passed straight to CasinoMapScene.jsx as `onEnter`, which
  // sits in that component's per-frame movement effect's dependency array
  // - see UnderworldModal.jsx's identical selectTab comment for why an
  // inline arrow here would tear down/rebuild that effect on every
  // CasinoModal re-render.
  const enterFloor = useCallback(() => setEntered(true), [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div
        className={`glass-panel max-h-[92vh] overflow-y-auto overflow-x-hidden border-4 border-pink-400 bg-[#1c1d3a] p-6 font-mono text-white ${
          // The walk-in floor needs real width for CasinoMapScene's 1040px
          // stage (same reasoning as UnderworldModal.jsx's own per-tab width
          // ternary) - the tab bar keeps the original 640px once inside.
          entered ? 'w-[640px]' : 'w-[1120px] max-w-[95vw]'
        }`}
      >
        {(onOpenPhone || onEndDay) && (
          <div className="absolute right-4 top-4 flex gap-2">
            {onOpenPhone && (
              <button
                onClick={onOpenPhone}
                className="border-2 border-violet-500/70 bg-violet-500/10 px-2 py-1 text-xs font-bold text-violet-300 hover:bg-violet-500/30"
              >
                Phone
              </button>
            )}
            {onEndDay && (
              <button
                onClick={onEndDay}
                className="border-2 border-fuchsia-400/70 bg-fuchsia-500/10 px-2 py-1 text-xs font-bold text-fuchsia-200 hover:bg-fuchsia-500/30"
              >
                End Day
              </button>
            )}
          </div>
        )}

        <p className="mb-1 text-xs uppercase tracking-widest text-gray-500">Commercial District</p>
        <h2 className="mb-2 text-xl font-bold text-pink-300">Neon Dragon Casino</h2>
        <p className="mb-3 text-xs text-gray-400">
          Chips clatter under buzzing neon dragons. The house always has an edge - but so do you, tonight.
        </p>

        {!entered && <CasinoMapScene onEnter={enterFloor} />}

        {entered && (
          <>
            <CasinoBanner />
            <button
              onClick={() => setEntered(false)}
              className="mb-3 border-2 border-gray-600 px-3 py-1 text-xs font-bold text-gray-400 hover:border-gray-400"
            >
              ← Back to the Casino Floor
            </button>

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
            </div>
          </>
        )}

        <button onClick={onClose} className="mt-3 w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500">
          Leave the Casino Floor
        </button>
      </div>
    </div>
  )
}
