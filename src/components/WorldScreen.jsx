import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/useGameStore'
import GameCanvas, { createEventBridge } from '../game/GameCanvas'
import WelcomeIntroModal from './WelcomeIntroModal'
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
import NamedNpcModal from '../features/finance/NamedNpcModal'
import AmbientNpcModal from '../features/finance/AmbientNpcModal'
import DistrictBuildingModal from '../features/finance/DistrictBuildingModal'
import CasinoModal from '../features/casino/CasinoModal'
import UnderworldModal from '../features/finance/UnderworldModal'
import BusinessCenterModal from '../features/finance/BusinessCenterModal'
import GovernmentBuildingModal from '../features/finance/GovernmentBuildingModal'
import IndustrialZoneModal from '../features/finance/IndustrialZoneModal'
import PoliceStopModal from '../features/finance/PoliceStopModal'
import TempleModal from '../features/temple/TempleModal'
import WharfModal from '../features/wharf/WharfModal'
import EntertainmentComplexModal from '../features/entertainment/EntertainmentComplexModal'
import JailEscapeModal from '../features/jail/JailEscapeModal'
import JailMazeModal from '../features/jail/JailMazeModal'
import JailMazeMinigame from '../features/jail/JailMazeMinigame'
import InteractiveLocationModal from '../features/world/InteractiveLocationModal'
import ScotusCourtroomModal from '../features/government/ScotusCourtroomModal'
import IrsHearingModal from '../features/government/IrsHearingModal'
import FbiInterrogationModal from '../features/government/FbiInterrogationModal'
import AmenityStoreModal from '../features/world/AmenityStoreModal'
import EssentialBuildingModal from '../features/world/EssentialBuildingModal'
import BuildingInteriorModal from '../features/world/BuildingInteriorModal'
import NpcLootModal from '../features/world/NpcLootModal'
import GunStoreModal from '../features/world/GunStoreModal'
import VehicleTheftModal from '../features/world/VehicleTheftModal'
import NarcoticsTradeModal from '../features/world/NarcoticsTradeModal'
import SyndicateOperationsModal from '../features/world/SyndicateOperationsModal'
import HitmanContractModal from '../features/world/HitmanContractModal'
import { JAPAN_CITIES } from '../features/world/japanCities'
import { DISTRICT_BUILDINGS_CONFIG } from '../features/finance/districtBuildings'
import FinanceStatusBar from './Header/FinanceStatusBar'
import { generateBodyguardMonster, generateStreetTargetMonster } from '../features/finance/financeNpcs'
import FinanceSkirmishModal from '../features/finance/FinanceSkirmishModal'
import { getAnyCharacter } from '../features/agents/characterLookup'
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
import TownTravelUI from './TownTravelUI'
import PhoneShell from '../features/phone/PhoneShell'
import SocialApp from '../features/phone/SocialApp'
import BankingApp from '../features/phone/BankingApp'
import ContactsApp from '../features/phone/ContactsApp'
import GuideApp from '../features/phone/GuideApp'
import WorldMapOverview from '../features/phone/WorldMapOverview'

const REGION_LABELS = {
  hunter: "The Hunter's Rift",
  finance: 'Capital Syndicate',
  yugioh: 'King of Games',
}

const DISTRICT_BUILDING_IDS = Object.keys(DISTRICT_BUILDINGS_CONFIG)

// Building ids that open an InteractiveLocationModal when the player reaches
// their interior desk (OverworldScene.js's buildGenericInteriorZone emits
// `interact: { type: 'building', id, npcId }` for every FINANCE building
// except stockExchange/casino/trainStation - see this file's 'interact'
// handler below). trainStation is special-cased by OverworldScene.js to
// open city travel directly instead of a generic interior, so transit_hub
// is opened from a button inside TownTravelUI, not from this map - see
// interactiveLocations.js's house-rule comment on that location.
// appleHQ and speakeasyHotel used to route here too - both buildings are
// gone (Phase 2 consolidation folded their InteractiveLocationModal content
// straight into a tab of BusinessCenterModal/UnderworldModal instead, each
// rendering InteractiveLocationModal with `embedded`), so their intercept
// entries are removed. fordRougeComplex (Ford) went the same way in Phase 4
// (folded into IndustrialZoneModal's Ford tab - see that file). teaHouse's
// entry used to be removed too: the building itself was gone (Phase 4's
// 14-category trim), and its mcdonalds_diner content was only reachable
// through FinanceStatusBar's "Places & Transit" header button. That button
// is gone now (header cleanup pass - Phone + End Day only), so
// mcdonalds_diner needed a real building again: `foodCourt` (OverworldScene.js's
// FINANCE_BUILDING_DEFS) is that building, wired through this same
// extension-point mechanism the comment above used to describe as
// hypothetical.
const BUILDING_TO_INTERACTIVE_LOCATION = { foodCourt: 'mcdonalds_diner' }

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
  const addOwnedVehicle = useGameStore((s) => s.addOwnedVehicle)
  const jail = useGameStore((s) => s.jail)
  const hasSeenIntro = useGameStore((s) => s.hasSeenIntro)

  const bridgeRef = useRef(createEventBridge())
  const [activeModal, setActiveModal] = useState(null)
  // Lets GuideApp.jsx's "How to Play" button reopen WelcomeIntroModal on
  // demand, independent of the persisted hasSeenIntro flag (see that
  // component's own header comment on why re-reading the tutorial must
  // never re-flip a save-state flag that's already true).
  const [showHelp, setShowHelp] = useState(false)
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

  // Being arrested (jail.inJail flipping false -> true, from any executeCrime
  // call site - Temple/Bank/Crypto/collude/extort/vehicle theft) teleports
  // the player into the jailCell zone (jail mini-map plan) instead of
  // force-popping a full-screen modal over whatever they were doing - see
  // GameCanvas.jsx's 'enterJail' bridge listener and OverworldScene.js's
  // buildJailCellZone. Deliberately keyed only on jail?.inJail so it doesn't
  // refire every render while still jailed. The old re-route guard that used
  // to force JailEscapeModal back open if the player tried Temple/Bank/
  // Crypto/Stock Exchange while jailed is gone - arrest now physically
  // removes the player from the overworld, so those buildings' zones are
  // unreachable anyway.
  useEffect(() => {
    if (jail?.inJail) bridgeRef.current.emit('enterJail')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jail?.inJail])

  useEffect(() => {
    const bridge = bridgeRef.current
    const offInteract = bridge.on('interact', (payload) => {
      // Court & Prison's single 'courtAndPrison' building id is shared by
      // two mutually-exclusive interactions that can never both be true at
      // once: walking up to it on the overworld (only possible while free)
      // vs. the guard desk inside the jailCell zone (only reachable while
      // jailed) - see OverworldScene.js's courtAndPrison special-case and
      // buildJailCellZone.
      if (payload.type === 'building' && payload.id === 'courtAndPrison') {
        if (useGameStore.getState().jail?.inJail) {
          setActiveModal({ type: 'jail' })
        } else {
          alert('Capital City Central Booking. Best not to go in voluntarily.')
          bridge.emit('resumeScene')
        }
        return
      }
      // jailMaze checkpoints open a real input challenge (JailMazeMinigame)
      // rather than resolving instantly - the coin-flip that used to sit
      // behind this event is gone. The out-of-order guard (see
      // attemptMazeSegment's mazeProgress check in useGameStore.js) is
      // re-checked here up front too, so a stale/duplicate checkpoint event
      // never even opens the minigame modal.
      if (payload.type === 'jailMazeCheckpoint') {
        const jailState = useGameStore.getState().jail
        const outOfOrder =
          !jailState?.inJail ||
          jailState.mazeAttemptedToday ||
          payload.segmentIndex !== (jailState.mazeProgress || 0)
        if (outOfOrder) {
          bridge.emit('resumeScene')
          return
        }
        // getMazeSegmentDifficulty computes the exact same evadeChance the
        // old coin-flip used (AGI/streetwise/effective Luck/wantedLevel,
        // rising per segment) and inverts it into a 0..1 "how hard should
        // the minigame be" number - it is NOT itself rolled against here or
        // anywhere downstream. The minigame's own pass/fail decides the
        // checkpoint (see JailMazeMinigame.jsx).
        const difficulty = useGameStore.getState().getMazeSegmentDifficulty(payload.segmentIndex)
        setActiveModal({ type: 'jailMazeMinigame', segmentIndex: payload.segmentIndex, difficulty })
        return
      }
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
      if (payload.type === 'building' && BUILDING_TO_INTERACTIVE_LOCATION[payload.id]) {
        setActiveModal({ type: 'interactiveLocation', locationId: BUILDING_TO_INTERACTIVE_LOCATION[payload.id] })
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
    // getAnyCharacter (not getFinanceNpc) - this fires for any named roamer's
    // bodyguard fight, not just Financial Titans, and every roster entry
    // carries netWorth (see characterLookup.js's INDEX build).
    const npc = getAnyCharacter(npcId)
    markFinanceNpcDead(npcId)
    useGameStore.getState().addCash(Math.round((npc?.netWorth || 0) / 1e8))
    bridgeRef.current.emit('npcKilled', { npcId })
  }

  const handleAmbientCombatVictory = (npcId) => {
    recordAmbientKill()
    bridgeRef.current.emit('ambientNpcKilled', { npcId })
  }

  // Bridges a transit_hub purchase (InteractiveLocationModal's
  // handleVehicleSelect, which already deducted cash and called setVehicle)
  // into an actual spawned, drivable car - addOwnedVehicle makes it
  // player-owned in the store, then 'acquireVehicle' tells the Phaser scene
  // to spawn it. opt.spriteName is interactiveLocations.js's copy of
  // vehicleGen.js's TIER_SPRITES[opt.id].spriteName.
  const handleAcquireVehicle = (opt) => {
    const vehicle = { tierId: opt.id, name: opt.name, spriteName: opt.spriteName, speedMultiplier: opt.speedMultiplier }
    addOwnedVehicle(vehicle)
    bridgeRef.current.emit('acquireVehicle', vehicle)
  }

  // Car theft success handler - VehicleTheftModal already resolved
  // stealVehicle() (which itself calls addOwnedVehicle on success); this
  // just tells the Phaser scene to make the stolen car drivable, reusing
  // the same 'acquireVehicle' event a legitimate purchase emits so the
  // scene only needs one spawn handler for both paths.
  const handleVehicleStolen = (vehicle) => {
    bridgeRef.current.emit('acquireVehicle', vehicle)
  }

  return (
    <div className="flex h-full w-full flex-col items-center gap-4 bg-[#0f1020] p-4 font-mono text-white">
      {!hasSeenIntro && <WelcomeIntroModal />}
      {hasSeenIntro && showHelp && <WelcomeIntroModal onClose={() => setShowHelp(false)} />}
      <div className="flex w-full max-w-[640px] flex-wrap items-center justify-between gap-2 border-2 border-gray-700 bg-[#1c1d3a] px-4 py-2 text-sm">
        <div>
          <span className="font-bold text-yellow-300">{player.name}</span>{' '}
          <span className="text-gray-400">Lv.{player.level}</span>
        </div>
        <div>
          HP: <span className="text-red-400">{player.hp}/{player.maxHp}</span>
        </div>
        <div>
          Energy: <span className="text-cyan-400">{player.energy}/{player.maxEnergy}</span>
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
        <FinanceStatusBar onOpenPhone={() => setActiveModal({ type: 'phone' })} />
      )}

      {!worldCleared && (
        <div className="relative w-full max-w-7xl mx-auto my-2 rounded-xl overflow-hidden flex items-center justify-center">
          <GameCanvas mode={mode} bridge={bridgeRef.current} spawnOverride={overworldSpawnHint} />
        </div>
      )}

      <p className="text-xs text-gray-500">
        Move with WASD/Arrows • E to interact{mode === 'overworld' && activeRegion === 'hunter' ? ' • R to commit crime' : ''}
      </p>

      {activeModal?.type === 'jail' && (
        <JailEscapeModal onClose={closeModal} onVictory={() => bridgeRef.current.emit('exitJail')} />
      )}
      {activeModal?.type === 'jailMazeMinigame' && (
        <JailMazeMinigame
          segmentIndex={activeModal.segmentIndex}
          difficulty={activeModal.difficulty}
          onResolved={(result) => {
            if (!result) {
              // Walk-away before the first input registered - free, no
              // store call ever happened, no consequence. Bounces back to
              // the jailMaze zone exactly like never having interacted
              // with the checkpoint (matches VaultCrackModal's Walk Away).
              closeModal()
              return
            }
            setActiveModal({ type: 'jailMazeResult', ...result })
          }}
        />
      )}
      {activeModal?.type === 'jailMazeResult' && (
        <JailMazeModal
          result={activeModal}
          onContinue={() => {
            if (activeModal.success && activeModal.final) {
              // Final checkpoint clear: jail is already resolved in the
              // store (attemptMazeSegment cleared it) - swap to the
              // jailUnderworld backdrop and open the real Underworld hub
              // modal on top of it, satisfying "auto-open UnderworldModal
              // once, framed as emerging through the tunnel" with zero new
              // modal code. Deliberately skips resumeScene here (unlike the
              // two branches below) - the scene stays paused straight
              // through into the Underworld modal rather than letting the
              // player move around the transient backdrop for a frame.
              setActiveModal({ type: 'building', id: 'underworld', viaJailMaze: true })
              bridgeRef.current.emit('enterJailUnderworld')
            } else if (activeModal.success) {
              // Non-final segment cleared - still standing in jailMaze,
              // free to walk to the next checkpoint.
              closeModal()
            } else {
              // Failed a segment - bounced back to jailCell with the
              // harsher penalty already applied by the store.
              setActiveModal(null)
              bridgeRef.current.emit('enterJail')
              bridgeRef.current.emit('resumeScene')
            }
          }}
        />
      )}
      {activeModal?.type === 'inventory' && <InventoryModal onClose={closeModal} />}
      {/* Board of Realities' 4 functional phone apps: Social/X (Titan Feed +
          news ticker), Banking & Portfolio (Portfolio/Bank & Realty/Stock
          Exchange tabs), Contacts & Romance (list view over
          world2.romanceState/recruitedAdvisors, opens NamedNpcModal per
          contact), Guide (Aria, an original AI helper character answering
          "how does X work" questions - see GuideApp.jsx/aiGuide.js) - see
          src/features/phone/{SocialApp,BankingApp,ContactsApp,GuideApp}.jsx.
          Two apps used to live here and were both deliberately removed:
          Dark Web & Underground (Underworld/Hitman Contracts/Syndicate Ops/
          Narcotics tabs) - phone-anywhere access undercut the point of
          walking to the physical Underworld building, that content is
          standalone-only now, same as before phone integration (see the
          'narcoticsTrade'/'syndicateOperations'/'hitmanContract' modal types
          and the 'underworld' building case below). Startups & M&A
          (CorporateModal, company acquisitions) - relocated into the Bank &
          Realty building instead of orphaned, since it had no other entry
          point in the game (see BankModal.jsx). Syndicate Board (advisor
          recruitment) was also removed from Banking around the same time -
          still reachable by walking up to a titan NPC in the overworld. */}
      {activeModal?.type === 'phone' && (
        <PhoneShell
          onClose={closeModal}
          apps={{
            social: () => <SocialApp />,
            banking: () => <BankingApp />,
            contacts: () => <ContactsApp />,
            guide: () => (
              <GuideApp
                onShowHelp={() => {
                  closeModal()
                  setShowHelp(true)
                }}
              />
            ),
            map: () => <WorldMapOverview />,
          }}
        />
      )}
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
        <InteractiveLocationModal
          locationId={activeModal.locationId || 'mcdonalds_diner'}
          onClose={closeModal}
          onAcquireVehicle={handleAcquireVehicle}
        />
      )}
      {activeModal?.type === 'vehicleTheft' && (
        <VehicleTheftModal vehicle={activeModal.vehicle} onClose={closeModal} onStolen={handleVehicleStolen} />
      )}
      {activeModal?.type === 'townTravel' && (
        <TownTravelUI
          onClose={closeModal}
          onOpenTransitShop={() => setActiveModal({ type: 'interactiveLocation', locationId: 'transit_hub' })}
        />
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
          // Preserve Hunter's Rift's original "beat the cops, Wanted resets
          // to 0" behavior - the "real arrest pipeline" nerf to -1 is scoped
          // to Finance's financePoliceEncounter/PoliceStopModal only.
          wantedRewardOnWin={-5}
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
      {/* Crypto HQ is gone as a standalone building - it's now the Crypto tab
          inside StockExchangeModal, so there's no top-level 'cryptoExchange'
          case left to render here. Corporate Holdings and the VC Hub (former
          CorporateModal front doors) are gone too - Phase 4's 14-category
          trim deleted both outright, neither maps to a spec'd main-building
          category. */}
      {/* Real Estate Agency is a new-district front door onto the same
          existing Bank system, rather than duplicate mechanics - Commercial
          District's realty wing. */}
      {activeModal?.type === 'building' && activeModal.id === 'realEstateAgency' && (
        <BankModal onClose={closeModal} />
      )}
      {/* Casino got its own bespoke Phaser interior + a tabbed modal (real
          blackjack/poker/slots/NPC-challenge minigames), and now also hosts
          Pixel Palace Arcade as an embedded tab (see CasinoModal.jsx's TABS)
          - Arcade no longer has its own top-level 'arcade' building id/case,
          it's reached only through Casino's Arcade tab now. Neither routes
          through the generic DistrictBuildingModal. */}
      {activeModal?.type === 'building' && activeModal.id === 'casino' && (
        <CasinoModal onClose={closeModal} />
      )}
      {activeModal?.type === 'building' && activeModal.id === 'temple' && (
        <TempleModal onClose={closeModal} />
      )}
      {/* Bonded Cargo Pier (Dock/Pier spec category) - Cast & Reel fishing +
          Declare Honest/Pad the Manifest, entirely self-contained in
          WharfModal.jsx (own addCash/spendEnergy/executeCrime calls, no
          onVictory/onDefeat handshake) - same "straight-to-modal, no Phaser
          interior" shape as foodCourt, but a bespoke component instead of
          InteractiveLocationModal since it needs live state/interaction. */}
      {activeModal?.type === 'building' && activeModal.id === 'wharf' && (
        <WharfModal onClose={closeModal} />
      )}
      {/* Entertainment Complex (Concert Hall + Sports Stadium) - 2-tab hub
          modal, same shape as the 4 consolidated hubs below. Concert Hall
          composes Dixon's NamedNpcModal flavor tab with the arrow-key
          rhythm minigame (RhythmGame.jsx); Sports Stadium composes
          Rothstein's flavor tab with the alternating-key sprint QTE
          (SprintRace.jsx). */}
      {activeModal?.type === 'building' && activeModal.id === 'entertainmentComplex' && (
        <EntertainmentComplexModal onClose={closeModal} />
      )}
      {/* The 4 Phase-2/4 consolidated hubs - each is a tabbed modal wrapping
          several formerly-standalone buildings' content via the `embedded`
          prop pattern (see each modal file for its TABS array). None of
          these building ids exist in DISTRICT_BUILDING_IDS, so they can't
          double-fire the DistrictBuildingModal branch below. */}
      {activeModal?.type === 'building' && activeModal.id === 'underworld' && (
        <UnderworldModal
          // Set by the underworldInterior zone's desk interactables
          // (OverworldScene.js's 'underworldDesk' zone type) so walking up
          // to a specific racket opens UnderworldModal straight to that
          // tab, instead of always landing on Black Market. Undefined for
          // every other entry point (jail-tunnel arrival, anything else
          // that opens this modal), which UnderworldModal's own
          // `initialTab = 'blackMarket'` default already covers.
          initialTab={activeModal.initialTab}
          onClose={
            // Reached via the jail maze's tunnel rather than the normal
            // overworld building - the scene is sitting on the transient
            // jailUnderworld backdrop, not 'overworld', so closing needs to
            // actually travel back rather than just unpausing in place.
            activeModal.viaJailMaze
              ? () => {
                  setActiveModal(null)
                  // interactionLocked was set by the pauseForModal() call
                  // that fired when the final jailMazeCheckpoint was
                  // triggered, and nothing since has resumed it (unlike the
                  // failed-segment branch above, which does) - without this,
                  // the player lands back on the overworld with movement and
                  // interaction permanently frozen.
                  bridgeRef.current.emit('resumeScene')
                  bridgeRef.current.emit('exitJail')
                }
              : closeModal
          }
        />
      )}
      {activeModal?.type === 'building' && activeModal.id === 'businessCenter' && (
        <BusinessCenterModal onClose={closeModal} />
      )}
      {activeModal?.type === 'building' && activeModal.id === 'governmentBuilding' && (
        <GovernmentBuildingModal onClose={closeModal} />
      )}
      {activeModal?.type === 'building' && activeModal.id === 'industrialZone' && (
        <IndustrialZoneModal onClose={closeModal} />
      )}
      {activeModal?.type === 'building' && activeModal.id !== 'temple' && DISTRICT_BUILDING_IDS.includes(activeModal.id) && (
        <DistrictBuildingModal buildingId={activeModal.id} onClose={closeModal} />
      )}
      {activeModal?.type === 'building' && activeModal.npcId && (
        <NamedNpcModal
          npcId={activeModal.npcId}
          onClose={closeModal}
          onAttack={() => {
            // Named tycoons' bodyguards scale with bodyguardPower (up to
            // ~380 HP / ~38 ATK vs a fresh player's 100 HP) - warn before
            // committing, same spirit as the riftB rank-gate warning above.
            // Losing no longer wipes the save (see RiftCombatModal's
            // lethal={false} below), but it's still a real, felt setback,
            // so the player should know that going in.
            // getAnyCharacter (not getFinanceNpc) - namedRoamer NPCs can be
            // any roster (Financial Titan, Crime Syndicate, President, Fed/
            // FTC Chairman, Agency Leader), all reachable through this same
            // Attack button. getFinanceNpc only ever found Financial Titans
            // and returned undefined for everyone else, which crashed
            // generateBodyguardMonster below.
            const npc = getAnyCharacter(activeModal.npcId)
            const guard = generateBodyguardMonster(npc)
            const proceed = window.confirm(
              `${npc?.name || 'This target'}'s security detail looks serious - roughly ${guard.maxHp} HP, hitting for ` +
              `~${guard.attack} per swing. You won't die if you lose, but you'll get hospitalized ` +
              `and lose a cut of your cash. Attack anyway?`
            )
            if (!proceed) return
            setActiveModal({ type: 'financeCombat', npcId: activeModal.npcId })
          }}
        />
      )}
      {activeModal?.type === 'ambientNpc' && (
        <AmbientNpcModal
          npcName={activeModal.npcName}
          onClose={closeModal}
          onMug={() => {
            const res = useGameStore.getState().executeCrime({
              type: 'mug',
              baseSuccessChance: 0.8,
              payout: 50,
              notorietyIncreaseOnFail: 5,
              wantedIncreaseOnFail: 1,
              energyCost: 15,
              assetSeizureOnFail: 0,
              jailChanceOnFail: 0,
            })
            // if we had a toast we could show res.message
            closeModal()
          }}
          onAttack={() => setActiveModal({ type: 'ambientCombat', npcId: activeModal.npcId })}
        />
      )}
      {/* Finance-world street-level combats (bodyguard fights, ambient
          street-target skirmishes) use the 4-choice Attack/Heavy/Guard/Dodge
          skirmish engine, not Hunter's Rift's stat-based combat -
          FinanceSkirmishModal always routes losses through
          takeFinanceCombatDamage (hospitalized + cash hit), never the
          permadeath takeDamage path. See useGameStore.js's comment on
          takeFinanceCombatDamage for why. readProbability defaults to 0
          (flat uniform-random AI) for both these street-fight call sites -
          only PoliceStopModal's combat uses a nonzero read probability. */}
      {activeModal?.type === 'financeCombat' && (
        <FinanceSkirmishModal
          title="Bodyguard Skirmish"
          monster={generateBodyguardMonster(getAnyCharacter(activeModal.npcId))}
          onClose={closeModal}
          onVictory={() => handleFinanceCombatVictory(activeModal.npcId)}
        />
      )}
      {activeModal?.type === 'ambientCombat' && (
        <FinanceSkirmishModal
          title="Street Fight"
          monster={generateStreetTargetMonster()}
          onClose={closeModal}
          onVictory={() => handleAmbientCombatVictory(activeModal.npcId)}
        />
      )}
      {activeModal?.type === 'financePoliceEncounter' && (
        <PoliceStopModal wantedLevel={activeModal.wantedLevel} onClose={closeModal} />
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
