import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/useGameStore'
import GameCanvas, { createEventBridge } from '../game/GameCanvas'
import RiftCombatModal from '../features/hunter/RiftCombatModal'
import PoomQuestModal from '../features/hunter/PoomQuestModal'
import MiniGolfModal from '../features/hunter/MiniGolfModal'
import SupermarketModal from '../features/hunter/SupermarketModal'
import BurgerJointModal from '../features/hunter/BurgerJointModal'
import FamilyModal from '../features/hunter/FamilyModal'
import HunterHQModal from '../features/hunter/HunterHQModal'
import { generateHunterPolice, generateMonster } from '../features/hunter/monsters'
import { hasRank } from '../features/hunter/skillEffects'
import StockExchangeModal from '../features/finance/StockExchangeModal'
import BankModal from '../features/finance/BankModal'
import CorporateModal from '../features/finance/CorporateModal'
import CryptoModal from '../features/finance/CryptoModal'
import NamedNpcModal from '../features/finance/NamedNpcModal'
import AmbientNpcModal from '../features/finance/AmbientNpcModal'
import DistrictBuildingModal from '../features/finance/DistrictBuildingModal'
import SyndicateBoardModal from '../features/finance/SyndicateBoardModal'
import AgentInteractionsModal from '../features/finance/AgentInteractionsModal'
import GovernmentModal from '../features/government/GovernmentModal'
import InteractiveLocationModal from '../features/world/InteractiveLocationModal'
import ScotusCourtroomModal from '../features/government/ScotusCourtroomModal'
import IrsHearingModal from '../features/government/IrsHearingModal'
import FbiInterrogationModal from '../features/government/FbiInterrogationModal'
import AmenityStoreModal from '../features/world/AmenityStoreModal'
import EssentialBuildingModal from '../features/world/EssentialBuildingModal'
import BuildingInteriorModal from '../features/world/BuildingInteriorModal'
import NpcLootModal from '../features/world/NpcLootModal'
import GunStoreModal from '../features/world/GunStoreModal'
import NarcoticsTradeModal from '../features/world/NarcoticsTradeModal'
import SyndicateOperationsModal from '../features/world/SyndicateOperationsModal'
import HitmanContractModal from '../features/world/HitmanContractModal'
import { updateAgentPositions } from '../features/agents/agentMovementEngine'
import { JAPAN_CITIES } from '../features/world/japanCities'
import SwimmingStatusOverlay from '../features/world/SwimmingStatusOverlay'
import { calculateSwimmingTick } from '../features/world/swimmingFatigueEngine'
import Minimap from './Header/Minimap'
import { DISTRICT_BUILDINGS_CONFIG } from '../features/finance/districtBuildings'
import FinanceStatusBar from './Header/FinanceStatusBar'
import { generateBodyguardMonster, generateStreetTargetMonster, generateSwatSquad, getFinanceNpc } from '../features/finance/financeNpcs'
import YugiEncounterModal from '../features/yugioh/YugiEncounterModal'
import KaibaCorpModal from '../features/yugioh/KaibaCorpModal'
import CardShopModal from '../features/yugioh/CardShopModal'
import KidnappableNpcModal from '../features/yugioh/KidnappableNpcModal'
import TeaModal from '../features/yugioh/TeaModal'
import TahEncounterModal from '../features/yugioh/TahEncounterModal'
import CynnEncounterModal from '../features/yugioh/CynnEncounterModal'
import ChallengeModal from '../features/yugioh/ChallengeModal'
import DuelModal from '../features/yugioh/DuelModal'
import { YUGI_DECK } from '../features/yugioh/cardGenerator'
import { hunterAmbient } from '../audio/hunterAmbient'
import InventoryModal from './Inventory/InventoryModal'
import BedModal from '../features/domino/BedModal'
import DeckBuilderModal from '../features/domino/DeckBuilderModal'
import ShopModal from '../features/domino/ShopModal'
import EventBoardModal from '../features/domino/EventBoardModal'
import DominoNpcModal from '../features/domino/DominoNpcModal'
import { getNpc } from '../features/domino/npcRoster'

const REGION_LABELS = {
  hunter: "The Hunter's Rift",
  finance: 'Capital Syndicate',
  yugioh: 'King of Games',
}

const DISTRICT_BUILDING_IDS = Object.keys(DISTRICT_BUILDINGS_CONFIG)

function WorldClearedModal({ blockName, allCleared, onContinue }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="w-[420px] border-4 border-yellow-300 bg-[#1c1d3a] p-6 text-center font-mono text-white">
        <h2 className="mb-3 text-2xl font-bold text-yellow-300">
          {allCleared ? 'ALL BLOCKS CLEARED!' : `${blockName} — CLEARED`}
        </h2>
        <p className="mb-4 text-sm text-gray-300">
          {allCleared
            ? 'You have conquered every block on the board. Victory!'
            : 'That block is cleared for good. The rest of the board is still open to explore, and everything you own carries over.'}
        </p>
        <button
          onClick={onContinue}
          className="border-4 border-green-400 bg-green-500 px-6 py-2 font-bold text-black hover:bg-green-400"
        >
          {allCleared ? 'Return to Title' : 'Continue'}
        </button>
      </div>
    </div>
  )
}

export default function WorldScreen() {
  const player = useGameStore((s) => s.player)
  const cash = useGameStore((s) => s.cash)
  const wantedLevel = useGameStore((s) => s.wantedLevel)
  const currentBlockId = useGameStore((s) => s.currentBlockId)
  const blocks = useGameStore((s) => s.blocks)
  const saveGame = useGameStore((s) => s.saveGame)
  const setScreen = useGameStore((s) => s.setScreen)
  const assignStartingProfession = useGameStore((s) => s.assignStartingProfession)
  const world1 = useGameStore((s) => s.world1)
  const clearWorld1 = useGameStore((s) => s.clearWorld1)
  const clearWorld2 = useGameStore((s) => s.clearWorld2)
  const markFinanceNpcDead = useGameStore((s) => s.markFinanceNpcDead)
  const recordAmbientKill = useGameStore((s) => s.recordAmbientKill)
  const clearWorld3 = useGameStore((s) => s.clearWorld3)
  const world3 = useGameStore((s) => s.world3)
  const world4 = useGameStore((s) => s.world4)

  const bridgeRef = useRef(createEventBridge())
  const [activeModal, setActiveModal] = useState(null)
  const [worldCleared, setWorldCleared] = useState(null)
  // Snapshot of which block ids were already cleared, used by the global
  // win-condition watcher below.
  const prevClearedIdsRef = useRef(new Set(blocks.filter((b) => b.cleared).map((b) => b.id)))
  // Where the overworld scene should spawn the player next time it mounts.
  // Only meaningful for the 'dominoGate' value (see the exitDomino handler
  // below, and task 2/OverworldScene.createPlayer) - null means "use the
  // normal currentBlockId-based default spawn".
  const [overworldSpawnHint, setOverworldSpawnHint] = useState(null)
  // Hunter's Rift / Financial Anarchy / King of Games are all one continuous
  // OverworldScene now; Domino City is still its own star-topology scene,
  // entered/exited through a gate on the overworld map (like a big building).
  // `mode` tracks which of those two is mounted; `activeRegion` tracks which
  // overworld region the player is physically standing in (kept in sync by
  // the scene's 'regionChanged' bridge event), independent of currentBlockId
  // which is meta/save-state (dice-roll assignment, block-clear rotation)
  // and no longer drives scene mounting.
  const [mode, setMode] = useState(currentBlockId === 'domino' ? 'domino' : 'overworld')
  const [activeRegion, setActiveRegion] = useState(
    currentBlockId && currentBlockId !== 'domino' ? currentBlockId : 'finance'
  )
  const currentCityId = useGameStore((s) => s.currentCityId || 'tokyo')
  const switchCity = useGameStore((s) => s.switchCity || (() => {}))
  const masterAgents = useGameStore((s) => s.world2?.masterAgents || [])
  const [timeTick, setTimeTick] = useState(0)

  const [isSwimming, setIsSwimming] = useState(false)
  const [swimmingFatigue, setSwimmingFatigue] = useState(0)
  const [swimmingStatusMsg, setSwimmingStatusMsg] = useState('')

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTick((t) => t + 1)
    }, 2000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!isSwimming) return
    const swimTimer = setInterval(() => {
      const res = calculateSwimmingTick(swimmingFatigue, 2, true)
      setSwimmingFatigue(res.nextFatigue)
      setSwimmingStatusMsg(res.statusMessage)
    }, 1500)
    return () => clearInterval(swimTimer)
  }, [isSwimming, swimmingFatigue])

  const movingAgents = updateAgentPositions(masterAgents, timeTick)
  const currentCity = JAPAN_CITIES.find((c) => c.id === currentCityId) || JAPAN_CITIES[0]
  const displayBlockName = currentCity?.name || 'Capital Syndicate'

  useEffect(() => {
    assignStartingProfession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (mode === 'overworld' && activeRegion === 'hunter') {
      hunterAmbient.play()
    } else {
      hunterAmbient.pause()
    }
    return () => hunterAmbient.pause()
  }, [mode, activeRegion])

  // Duck the ambient loop during combat so hit/victory SFX read clearly.
  useEffect(() => {
    if (mode !== 'overworld' || activeRegion !== 'hunter') return
    const inCombat = ['rift', 'finalRaid', 'police', 'criminalEncounter', 'policeEncounter'].includes(activeModal?.type)
    hunterAmbient.setVolume(inCombat ? 0.08 : 0.2)
  }, [activeModal, mode, activeRegion])

  // Global win-condition watcher. Each world's win check still lives where
  // it always has (clearWorld1/clearWorld2/clearWorld3 in useGameStore,
  // called from whichever modal/flow already ends that world - Final Raid
  // victory, Stock Exchange's Declare Victory button, the Yugi duel/
  // challenge win, plus autonomous triggers like Sole Survivor); this is
  // just the single place that watches for ANY of them firing and surfaces
  // the same WorldClearedModal that always showed, regardless of which
  // region/scene (hunter/finance/yugioh/domino) the player currently has
  // mounted or is standing in.
  //
  // This watches `blocks[].cleared` directly rather than diffing
  // `currentBlockId`: clearBlock() reassigns currentBlockId to a random
  // *uncleared* block afterward, which can coincidentally re-pick the same
  // block that was already current - a currentBlockId-only diff would then
  // see no change and silently swallow a real clear event. Comparing the
  // cleared-id set catches every clear unconditionally.
  useEffect(() => {
    const newlyCleared = blocks.filter((b) => b.cleared && !prevClearedIdsRef.current.has(b.id))
    if (newlyCleared.length > 0) {
      setWorldCleared({ name: newlyCleared[0].name })
    }
    prevClearedIdsRef.current = new Set(blocks.filter((b) => b.cleared).map((b) => b.id))
  }, [blocks])

  useEffect(() => {
    const bridge = bridgeRef.current
    const offInteract = bridge.on('interact', (payload) => {
      // Save Point and the KC Tower Security Gate resolve immediately
      // rather than opening a modal.
      if (payload.type === 'domino' && payload.id === 'savePoint') {
        saveGame()
        alert('Game saved!')
        bridge.emit('resumeScene')
        return
      }
      if (payload.type === 'domino' && payload.id === 'securityGate') {
        const state = useGameStore.getState()
        const canEnter = state.isDominoWeekend() && state.world4.tournamentPassOwned
        alert(
          canEnter
            ? 'The gate recognizes your Tournament Pass. The elevator is unlocked.'
            : !state.isDominoWeekend()
            ? 'The Arena only opens on weekends.'
            : 'You need a Tournament Pass from the Kame Game Shop to enter.'
        )
        bridge.emit('resumeScene')
        return
      }
      if (payload.type === 'rift' && payload.id === 'riftB') {
        const state = useGameStore.getState()
        if (!hasRank(state.world1.hunterRank, 'C')) {
          alert('This rift is a Difficulty 7 tear - far too dangerous below C-rank. Clear easier rifts and level up first.')
          bridge.emit('resumeScene')
          return
        }
      }
      if (payload.type === 'domino' && payload.id === 'elevator') {
        const state = useGameStore.getState()
        if (!state.isDominoWeekend() || !state.world4.tournamentPassOwned) {
          alert('The elevator is locked. Check the Security Gate.')
          bridge.emit('resumeScene')
          return
        }
        setActiveModal({ type: 'dominoNpc', npc: getNpc('NPC_Kaiba') })
        return
      }
      setActiveModal(payload)
    })
    const offCriminal = bridge.on('criminalEncounter', () =>
      setActiveModal({ type: 'criminalEncounter' })
    )
    const offPolice = bridge.on('policeEncounter', (payload) =>
      setActiveModal({ type: 'policeEncounter', ...payload })
    )
    const offFinancePolice = bridge.on('financePoliceEncounter', (payload) =>
      setActiveModal({ type: 'financePoliceEncounter', ...payload })
    )
    // Walking into the Domino City gate on the overworld, or into its exit
    // back out, swaps GameCanvas's mounted scene between OverworldScene and
    // DominoWorldScene (Domino stays a separate star-topology scene, entered
    // like a big building rather than folded into the continuous map).
    const offEnterDomino = bridge.on('enterDomino', () => setMode('domino'))
    // Re-entering the overworld from Domino should drop the player back at
    // (or right next to) the Domino Gate, not at their originally-assigned
    // region's default spawn - see OverworldScene.createPlayer.
    const offExitDomino = bridge.on('exitDomino', () => {
      setOverworldSpawnHint('dominoGate')
      setMode('overworld')
    })
    const offRegionChanged = bridge.on('regionChanged', ({ region }) => setActiveRegion(region))
    return () => {
      offInteract()
      offCriminal()
      offPolice()
      offFinancePolice()
      offEnterDomino()
      offExitDomino()
      offRegionChanged()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const closeModal = () => {
    setActiveModal(null)
    bridgeRef.current.emit('resumeScene')
  }

  const handleSave = () => {
    saveGame()
    alert('Game saved!')
  }

  const handleWorldClearedContinue = () => {
    const state = useGameStore.getState()
    const stillHasBlocks = state.currentBlockId !== null
    setWorldCleared(null)
    setActiveModal(null)
    bridgeRef.current.emit('resumeScene')
    if (!stillHasBlocks) {
      setScreen('welcome')
    }
  }

  const handleFinanceCombatVictory = (npcId) => {
    const npc = getFinanceNpc(npcId)
    markFinanceNpcDead(npcId)
    useGameStore.getState().addCash(Math.round(npc.netWorth / 1e8))
    bridgeRef.current.emit('npcKilled', { npcId })
  }

  const handleAmbientCombatVictory = (npcId) => {
    recordAmbientKill()
    bridgeRef.current.emit('ambientNpcKilled', { npcId })
  }

  return (
    <div className="flex h-full w-full flex-col items-center gap-4 bg-[#0f1020] p-4 font-mono text-white">
      <div className="flex w-full max-w-[640px] flex-wrap items-center justify-between gap-2 border-2 border-gray-700 bg-[#1c1d3a] px-4 py-2 text-sm">
        <div>
          <span className="font-bold text-yellow-300">{player.name}</span>{' '}
          <span className="text-gray-400">Lv.{player.level}</span>
        </div>
        <div>
          HP: <span className="text-red-400">{player.hp}/{player.maxHp}</span>
        </div>
        <div>
          Cash: <span className="text-green-400">${Math.round(cash).toLocaleString()}</span>
        </div>
        <div>
          Wanted: <span className="text-orange-400">{'★'.repeat(wantedLevel) || 'none'}</span>
        </div>
        {mode === 'domino' && (
          <div>
            DP: <span className="text-purple-300">{world4.dp}</span>{' '}
            <span className="text-gray-500">
              (D{world4.calendar.day} B{world4.calendar.timeBlock}{useGameStore.getState().isDominoWeekend() ? ' • Weekend' : ''})
            </span>
          </div>
        )}
        <div className="text-gray-400">{displayBlockName}</div>
        <button
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen()
            } else {
              document.exitFullscreen()
            }
          }}
          className="border border-cyan-300 px-2 py-1 text-xs hover:bg-cyan-300 hover:text-black font-bold"
          title="Toggle Fullscreen Mode"
        >
          📺 Fullscreen
        </button>
        <button
          onClick={() => setActiveModal({ type: 'inventory' })}
          className="border border-purple-300 px-2 py-1 text-xs hover:bg-purple-300 hover:text-black"
        >
          Inventory
        </button>
        <button
          onClick={handleSave}
          className="border border-blue-300 px-2 py-1 text-xs hover:bg-blue-300 hover:text-black"
        >
          Save
        </button>
        <button
          onClick={() => setScreen('welcome')}
          className="border border-gray-500 px-2 py-1 text-xs hover:bg-gray-500 hover:text-black"
        >
          Menu
        </button>
      </div>

      {mode === 'overworld' && (
        <>
          <FinanceStatusBar
            onOpenBoard={() => setActiveModal({ type: 'syndicateBoard' })}
            onOpenAgentFeed={() => setActiveModal({ type: 'agentFeed' })}
            onOpenGov={() => setActiveModal({ type: 'government' })}
            onOpenLocations={() => setActiveModal({ type: 'interactiveLocation', locationId: 'mcdonalds_diner' })}
          />
          <Minimap currentCityId={currentCityId} />

          {/* 4 Japanese Cities Fast-Travel Navigation Bar */}
          <div className="flex items-center justify-center gap-2 bg-[#090d1f]/90 border-y border-cyan-500/40 p-2 font-mono text-xs z-30">
            <span className="text-gray-400 font-bold">🗺️ Japanese City Fast-Travel:</span>
            {JAPAN_CITIES.map((c) => (
              <button
                key={c.id}
                onClick={() => switchCity(c.id)}
                className={`px-3 py-1.5 rounded font-bold transition-all ${
                  currentCityId === c.id
                    ? c.id === 'kyoto'
                      ? 'bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.6)] font-extrabold scale-105 border-2 border-yellow-300'
                      : 'bg-cyan-500 text-black shadow-lg font-extrabold scale-105'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {c.name.split(' ')[0]} {c.id === 'kyoto' ? '⛩️ (HD-2D JRPG)' : c.id === 'tokyo' ? '🏛️ (LUXURY ARCH)' : ''}
              </button>
            ))}

            <button
              onClick={() => {
                setIsSwimming(true)
                setSwimmingFatigue(15)
                setSwimmingStatusMsg('🏊 SWIMMING IN WATER BODY: Swimming across coastal sea channel!')
              }}
              className="px-3 py-1.5 rounded font-bold transition-all bg-blue-600 hover:bg-blue-500 text-white border border-blue-400"
            >
              🏊 Swim Water Channel
            </button>
          </div>
        </>
      )}

      {isSwimming && (
        <SwimmingStatusOverlay
          fatigue={swimmingFatigue}
          statusMsg={swimmingStatusMsg}
          onExitWater={() => {
            setIsSwimming(false)
            setSwimmingFatigue(0)
          }}
        />
      )}

      {!worldCleared && (
        <div className="relative w-full max-w-5xl mx-auto my-2 rounded-xl overflow-hidden flex items-center justify-center">
          <GameCanvas mode={mode} bridge={bridgeRef.current} spawnOverride={overworldSpawnHint} />

          {/* Option 3: Sleek Luxury Architectural Pilot Overlay for Tokyo */}
          {mode === 'overworld' && currentCityId === 'tokyo' && (
            <div className="pointer-events-none absolute inset-0 z-20 border-4 border-amber-400/80 bg-[#060a12]/20 shadow-[inset_0_0_60px_rgba(245,158,11,0.2)]">
              {/* Financial Executive Header Arch */}
              <div className="absolute top-4 left-6 flex items-center gap-2 bg-[#0d1526]/95 border-2 border-amber-400 px-4 py-1.5 rounded-lg shadow-2xl backdrop-blur-md">
                <span className="text-lg">🏛️</span>
                <span className="text-xs font-black text-amber-300 tracking-wider uppercase">TOKYO FINANCIAL DISTRICT (OPTION 3 LUXURY ARCHITECTURAL PILOT)</span>
              </div>

              {/* Polished Executive Corporate Titan Badges (Steve Jobs, Elon Musk, Jerome Powell) */}
              {movingAgents.slice(0, 5).map((agent, i) => (
                <div
                  key={agent.id || i}
                  className="absolute flex flex-col items-center transition-all duration-1000 ease-in-out"
                  style={{ left: `${(agent.currentX || 300) % 700}px`, top: `${(agent.currentY || 200) % 400}px` }}
                >
                  <div className="rounded-md bg-[#0a1120]/95 border border-amber-400/90 px-3 py-1 text-[11px] font-extrabold text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.4)] flex items-center gap-2 backdrop-blur-md">
                    <span className="text-xs">💼</span>
                    <span>{agent.name}:</span>
                    <span className="text-emerald-400 font-extrabold">{agent.currentAction || 'Executive Strategy'}</span>
                  </div>
                  <div className="h-5 w-5 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 border-2 border-white shadow-2xl animate-pulse mt-1 flex items-center justify-center text-[10px]">
                    👔
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Option 2: Neo-Retro HD-2D JRPG Pilot Environment Overlay for Kyoto */}
          {mode === 'overworld' && currentCityId === 'kyoto' && (
            <div className="pointer-events-none absolute inset-0 z-20 border-4 border-yellow-500/60 shadow-[inset_0_0_50px_rgba(234,179,8,0.2)]">
              {/* Shinto Torii Gate Entrance */}
              <div className="absolute top-4 left-6 flex items-center gap-2 bg-red-950/90 border-2 border-red-500 px-3 py-1 rounded shadow-xl">
                <span className="text-lg">⛩️</span>
                <span className="text-xs font-extrabold text-yellow-300 tracking-wider uppercase">KYOTO SHINTO PAGODA DISTRICT (HD-2D JRPG PILOT)</span>
              </div>

              {/* Animated Paper Lantern Sconces */}
              <div className="absolute top-16 left-8 text-xl animate-pulse">🏮</div>
              <div className="absolute top-16 right-8 text-xl animate-pulse">🏮</div>

              {/* Cel-Shaded AI Titan Badges (Warren Buffett HD-2D JRPG Persona Badge) */}
              {movingAgents.slice(0, 5).map((agent, i) => (
                <div
                  key={agent.id || i}
                  className="absolute flex flex-col items-center transition-all duration-1000 ease-in-out"
                  style={{ left: `${(agent.currentX || 300) % 700}px`, top: `${(agent.currentY || 200) % 400}px` }}
                >
                  <div className="rounded-lg bg-red-950/95 border-2 border-yellow-400 px-3 py-1 text-[11px] font-black text-yellow-200 shadow-[0_0_15px_rgba(239,68,68,0.5)] flex items-center gap-1.5">
                    <span className="text-sm">⛩️</span>
                    <span>{agent.name}:</span>
                    <span className="text-cyan-300 font-bold">{agent.currentAction || 'Walking'}</span>
                  </div>
                  <div className="h-5 w-5 rounded-full bg-yellow-400 border-2 border-black shadow-xl animate-bounce mt-1 flex items-center justify-center text-[10px]">
                    👤
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Standard Overworld Overlay for other cities */}
          {mode === 'overworld' && currentCityId !== 'kyoto' && (
            <div className="pointer-events-none absolute inset-0 z-20">
              {movingAgents.slice(0, 6).map((agent, i) => (
                <div
                  key={agent.id || i}
                  className="absolute flex flex-col items-center transition-all duration-1000 ease-in-out"
                  style={{ left: `${(agent.currentX || 300) % 700}px`, top: `${(agent.currentY || 200) % 400}px` }}
                >
                  <div className="rounded bg-cyan-950/90 border border-cyan-400 px-2 py-0.5 text-[10px] font-bold text-cyan-200 shadow-md">
                    {agent.name}: <span className="text-yellow-300">{agent.currentAction || 'Walking'}</span>
                  </div>
                  <div className="h-4 w-4 rounded-full bg-cyan-400 border-2 border-white shadow-lg animate-bounce mt-1" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-gray-500">
        Move with WASD/Arrows • E to interact{mode === 'overworld' && activeRegion === 'hunter' ? ' • R to commit crime' : ''}
      </p>

      {activeModal?.type === 'inventory' && <InventoryModal onClose={closeModal} />}
      {activeModal?.type === 'syndicateBoard' && <SyndicateBoardModal onClose={closeModal} />}
      {activeModal?.type === 'agentFeed' && <AgentInteractionsModal onClose={closeModal} />}
      {activeModal?.type === 'government' && <GovernmentModal onClose={closeModal} />}
      {activeModal?.type === 'scotusTrial' && <ScotusCourtroomModal onClose={closeModal} />}
      {activeModal?.type === 'irsAudit' && <IrsHearingModal onClose={closeModal} />}
      {activeModal?.type === 'fbiInterrogation' && <FbiInterrogationModal onClose={closeModal} />}
      {activeModal?.type === 'amenityStore' && (
        <AmenityStoreModal amenityId={activeModal.amenityId || 'tokyo_supermarket'} onClose={closeModal} />
      )}
      {activeModal?.type === 'essentialBuilding' && (
        <EssentialBuildingModal buildingId={activeModal.buildingId || 'general_hospital'} onClose={closeModal} />
      )}
      {activeModal?.type === 'buildingInterior' && (
        <BuildingInteriorModal buildingId={activeModal.buildingId || 'general_hospital'} onClose={closeModal} />
      )}
      {activeModal?.type === 'npcLoot' && (
        <NpcLootModal victimNpc={activeModal.victimNpc || { name: 'Defeated Target', role: 'mobster' }} onClose={closeModal} />
      )}
      {activeModal?.type === 'gunStore' && <GunStoreModal onClose={closeModal} />}
      {activeModal?.type === 'narcoticsTrade' && <NarcoticsTradeModal onClose={closeModal} />}
      {activeModal?.type === 'syndicateOperations' && <SyndicateOperationsModal onClose={closeModal} />}
      {activeModal?.type === 'hitmanContract' && <HitmanContractModal onClose={closeModal} />}
      {activeModal?.type === 'interactiveLocation' && (
        <InteractiveLocationModal locationId={activeModal.locationId || 'mcdonalds_diner'} onClose={closeModal} />
      )}

      {/* World 1 */}
      {activeModal?.type === 'building' && activeModal.id === 'hq' && (
        <HunterHQModal
          onClose={closeModal}
          onBeginFinalRaid={() => setActiveModal({ type: 'finalRaid' })}
        />
      )}
      {activeModal?.type === 'building' && activeModal.id === 'supermarket' && (
        <SupermarketModal onClose={closeModal} />
      )}
      {activeModal?.type === 'building' && activeModal.id === 'burgerJoint' && (
        <BurgerJointModal onClose={closeModal} />
      )}
      {activeModal?.type === 'rift' && (
        <RiftCombatModal difficulty={activeModal.difficulty} variant="rift" onClose={closeModal} />
      )}
      {activeModal?.type === 'marriage' && <FamilyModal onClose={closeModal} />}
      {activeModal?.type === 'poom' && <PoomQuestModal onClose={closeModal} />}
      {activeModal?.type === 'tan' && <MiniGolfModal onClose={closeModal} />}
      {activeModal?.type === 'criminalEncounter' && (
        <RiftCombatModal difficulty={2} variant="rift" monsterOverride={generateMonster(2)} onClose={closeModal} />
      )}
      {activeModal?.type === 'policeEncounter' && (
        <RiftCombatModal
          difficulty={activeModal.wantedLevel}
          variant="police"
          monsterOverride={generateHunterPolice(activeModal.wantedLevel)}
          onClose={closeModal}
        />
      )}
      {activeModal?.type === 'finalRaid' && (
        <RiftCombatModal
          difficulty={world1.hunterRank === 'S' ? 10 : 8}
          variant="finalRaid"
          onClose={closeModal}
          onVictory={clearWorld1}
        />
      )}

      {/* World 2 */}
      {activeModal?.type === 'building' && activeModal.id === 'stockExchange' && (
        <StockExchangeModal onClose={closeModal} onDeclareVictory={clearWorld2} />
      )}
      {activeModal?.type === 'building' && activeModal.id === 'bank' && (
        <BankModal onClose={closeModal} />
      )}
      {activeModal?.type === 'building' && activeModal.id === 'corporateOffice' && (
        <CorporateModal onClose={closeModal} />
      )}
      {activeModal?.type === 'building' && activeModal.id === 'cryptoExchange' && (
        <CryptoModal onClose={closeModal} />
      )}
      {/* Real Estate Agency and the VC Hub are new-district front doors onto
          the same existing Bank/Corporate systems, rather than duplicate
          mechanics - Commercial District's realty wing and Financial
          District's startup-investing wing respectively. */}
      {activeModal?.type === 'building' && activeModal.id === 'realEstateAgency' && (
        <BankModal onClose={closeModal} />
      )}
      {activeModal?.type === 'building' && activeModal.id === 'vcHub' && (
        <CorporateModal onClose={closeModal} />
      )}
      {activeModal?.type === 'building' && DISTRICT_BUILDING_IDS.includes(activeModal.id) && (
        <DistrictBuildingModal buildingId={activeModal.id} onClose={closeModal} />
      )}
      {activeModal?.type === 'building' && activeModal.npcId && (
        <NamedNpcModal
          npcId={activeModal.npcId}
          onClose={closeModal}
          onAttack={() => setActiveModal({ type: 'financeCombat', npcId: activeModal.npcId })}
        />
      )}
      {activeModal?.type === 'ambientNpc' && (
        <AmbientNpcModal
          npcName={activeModal.npcName}
          onClose={closeModal}
          onMug={() => {
            useGameStore.getState().addCash(50)
            useGameStore.getState().addWantedLevel(1)
            closeModal()
          }}
          onAttack={() => setActiveModal({ type: 'ambientCombat', npcId: activeModal.npcId })}
        />
      )}
      {activeModal?.type === 'financeCombat' && (
        <RiftCombatModal
          difficulty={5}
          variant="rift"
          monsterOverride={generateBodyguardMonster(getFinanceNpc(activeModal.npcId))}
          onClose={closeModal}
          onVictory={() => handleFinanceCombatVictory(activeModal.npcId)}
        />
      )}
      {activeModal?.type === 'ambientCombat' && (
        <RiftCombatModal
          difficulty={1}
          variant="rift"
          monsterOverride={generateStreetTargetMonster()}
          onClose={closeModal}
          onVictory={() => handleAmbientCombatVictory(activeModal.npcId)}
        />
      )}
      {activeModal?.type === 'financePoliceEncounter' && (
        <RiftCombatModal
          difficulty={activeModal.wantedLevel}
          variant="police"
          monsterOverride={generateSwatSquad(activeModal.wantedLevel)}
          onClose={closeModal}
        />
      )}

      {/* World 3 */}
      {activeModal?.type === 'building' && activeModal.id === 'kameGameShop' && (
        <YugiEncounterModal
          onClose={closeModal}
          onDirectCombat={() => setActiveModal({ type: 'yugiDuel', rescue: false })}
          onRescueDuel={() => setActiveModal({ type: 'yugiDuel', rescue: true })}
          onChallenge={() => setActiveModal({ type: 'yugiChallenge' })}
        />
      )}
      {activeModal?.type === 'building' && activeModal.id === 'kaibaCorpTower' && (
        <KaibaCorpModal onClose={closeModal} />
      )}
      {activeModal?.type === 'building' && activeModal.id === 'cardShop' && (
        <CardShopModal onClose={closeModal} />
      )}
      {activeModal?.type === 'namedNpc' && activeModal.kidnappable && (
        <KidnappableNpcModal npcId={activeModal.npcId} onClose={closeModal} />
      )}
      {activeModal?.type === 'namedNpc' && activeModal.npcId === 'tea' && (
        <TeaModal onClose={closeModal} />
      )}
      {activeModal?.type === 'namedNpc' && activeModal.npcId === 'tah' && (
        <TahEncounterModal onClose={closeModal} />
      )}
      {activeModal?.type === 'cynn' && <CynnEncounterModal onClose={closeModal} />}
      {activeModal?.type === 'ambientChallenge' && (
        <ChallengeModal opponentName={activeModal.npcName} isYugi={false} onClose={closeModal} />
      )}
      {activeModal?.type === 'yugiDuel' && (
        <DuelModal
          opponentName="Muto Yugi"
          opponentDeck={YUGI_DECK}
          opponentAtkModifier={world3.yugiBrokenHeart ? 0.5 : 1}
          allowHolographicCheat={world3.ownsKaibaCorp}
          onClose={closeModal}
          onVictory={() => {
            clearWorld3()
            closeModal()
          }}
          onDefeat={closeModal}
        />
      )}
      {activeModal?.type === 'yugiChallenge' && (
        <ChallengeModal opponentName="Muto Yugi" isYugi onClose={closeModal} onWin={clearWorld3} />
      )}

      {/* World 4: Domino City */}
      {activeModal?.type === 'domino' && activeModal.id === 'bed' && <BedModal onClose={closeModal} />}
      {activeModal?.type === 'domino' && activeModal.id === 'pc' && <DeckBuilderModal onClose={closeModal} />}
      {activeModal?.type === 'domino' && activeModal.id === 'shopCounter' && <ShopModal onClose={closeModal} />}
      {activeModal?.type === 'domino' && activeModal.id === 'eventBoard' && <EventBoardModal onClose={closeModal} />}
      {activeModal?.type === 'dominoNpc' && (
        <DominoNpcModal npc={activeModal.npc} onClose={closeModal} />
      )}

      {worldCleared && (
        <WorldClearedModal
          blockName={worldCleared.name}
          allCleared={useGameStore.getState().currentBlockId === null}
          onContinue={handleWorldClearedContinue}
        />
      )}
    </div>
  )
}
