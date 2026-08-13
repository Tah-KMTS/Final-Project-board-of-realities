import { useEffect, useRef, useState } from 'react'
import { useGameStore, DAYS_LIMIT } from '../store/useGameStore'
import GameCanvas, { createEventBridge } from '../game/GameCanvas'
import WelcomeIntroModal from './WelcomeIntroModal'
import DailyReportModal from './DailyReportModal'
import { ENDING_CASH_TARGET } from '../features/cutscene/endingCutsceneScript'
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
import RealEstateModal from '../features/finance/RealEstateModal'
import NamedNpcModal from '../features/finance/NamedNpcModal'
import AmbientNpcModal from '../features/finance/AmbientNpcModal'
import DistrictBuildingModal from '../features/finance/DistrictBuildingModal'
import CasinoModal from '../features/casino/CasinoModal'
import TurboRacerModal from '../features/arcade/TurboRacerModal'
import AirHockeyModal from '../features/arcade/AirHockeyModal'
import ClawMachineModal from '../features/arcade/ClawMachineModal'
import SortieCabinetModal from '../features/arcade/SortieCabinetModal'
import RunAndGunModal from '../features/arcade/RunAndGunModal'
import UnderworldModal from '../features/finance/UnderworldModal'
import BusinessCenterModal from '../features/finance/BusinessCenterModal'
import GovernmentBuildingModal from '../features/finance/GovernmentBuildingModal'
import IndustrialZoneModal from '../features/finance/IndustrialZoneModal'
import PoliceStopModal from '../features/finance/PoliceStopModal'
import TempleModal from '../features/temple/TempleModal'
import WharfModal from '../features/wharf/WharfModal'
import EntertainmentComplexModal from '../features/entertainment/EntertainmentComplexModal'
import LisaModal from '../features/lisa/LisaModal'
import WarrenModal from '../features/finance/WarrenModal'
import IncModal from '../features/finance/IncModal'
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
import { getMugProfile } from '../utils/npcGenerator'
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
import { bgmPlayer } from '../audio/bgm'
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

// Per-building bgm track (src/audio/bgm.js's RECIPES) for the bgm effect
// below - any `type: 'building'` modal id not listed here still gets music
// (falls back to 'building_interior'), it just doesn't have a bespoke theme
// of its own yet. Buildings sharing one financial-institution flavor (bank/
// stockExchange/businessCenter/realEstateAgency) intentionally share the
// 'bank' track rather than each getting a unique one. hq/supermarket/
// burgerJoint (Hunter's Rift) and kameGameShop/kaibaCorpTower/cardShop (King
// of Games) are pinned to their own region's existing track rather than
// falling to 'building_interior', preserving the pre-existing behavior of
// just carrying the region loop on through those buildings' interiors.
const BUILDING_TRACK_MAP = {
  casino: 'casino',
  underworld: 'underworld',
  bank: 'bank',
  stockExchange: 'bank',
  businessCenter: 'bank',
  realEstateAgency: 'bank',
  governmentBuilding: 'government',
  temple: 'temple',
  hq: 'hunters_rift',
  supermarket: 'hunters_rift',
  burgerJoint: 'hunters_rift',
  kameGameShop: 'king_of_games',
  kaibaCorpTower: 'king_of_games',
  cardShop: 'king_of_games',
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
  // Days Left counts down from DAYS_LIMIT as `day` advances (End Day, see
  // useGameStore.js's endDay) - day starts at 1, so Days Left starts at the
  // full DAYS_LIMIT rather than DAYS_LIMIT-1. endDay() itself triggers the
  // 'daysUp' game over once this hits 0 without ENDING_CASH_TARGET cleared;
  // this is purely the read-only display.
  const day = useGameStore((s) => s.day)
  const daysLeft = Math.max(0, DAYS_LIMIT - (day - 1))
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
  const pendingCrimeArrest = useGameStore((s) => s.pendingCrimeArrest)
  const policeWarning = useGameStore((s) => s.policeWarning)
  const nearbyWitnesses = useGameStore((s) => s.nearbyWitnesses)
  const hasSeenIntro = useGameStore((s) => s.hasSeenIntro)
  const triggerEnding = useGameStore((s) => s.triggerEnding)

  const bridgeRef = useRef(createEventBridge())
  const [activeModal, setActiveModal] = useState(null)
  // Transient "CAUGHT RED-HANDED" flash shown before pendingCrimeArrest's
  // effect (below) opens the actual encounter modal - see that effect.
  const [caughtFlash, setCaughtFlash] = useState(false)
  // Lets GuideApp.jsx's "How to Play" button reopen WelcomeIntroModal on
  // demand, independent of the persisted hasSeenIntro flag (see that
  // component's own header comment on why re-reading the tutorial must
  // never re-flip a save-state flag that's already true).
  const [showHelp, setShowHelp] = useState(false)
  // "What happened today" recap, shown once right after End Day resolves -
  // see handleEndDay below. Null hides DailyReportModal entirely; End Day
  // no longer calls the store's endDay() directly (FinanceStatusBar used
  // to), it goes through this wrapper instead so a before/after snapshot
  // can be diffed into a report.
  const [dailyReport, setDailyReport] = useState(null)
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

  // One switchable bgm engine covers every world + both combat moods now
  // (see src/audio/bgm.js) - this replaces the old hunter-only hunterAmbient
  // singleton, which had no equivalent for finance/yugioh/casino/jail/police-
  // battle/street-skirmish. Explicit combat/place modals take priority over
  // the region's ambient loop; domino mode still has no track (none was
  // generated for it) so it stays silent, same as before this change.
  //
  // `type === 'building'` now branches further on BUILDING_TRACK_MAP so
  // walking into a specific building swaps the music instead of just
  // carrying on the outdoor capital_overworld loop - previously there was a
  // `type === 'casino'` check here that could never actually match (the
  // Casino modal's real activeModal shape is `{ type: 'building', id:
  // 'casino' }`, same as every other building), so its RECIPES track never
  // played; this both fixes that and extends the idea to every other
  // building via the map (falling back to 'building_interior' for the rest).
  useEffect(() => {
    const type = activeModal?.type
    let trackId = null
    if (type === 'financePoliceEncounter' || type === 'policeEncounter') {
      trackId = 'police_battle'
    } else if (type === 'financeCombat' || type === 'ambientCombat') {
      trackId = 'street_skirmish'
    } else if (type === 'jail') {
      trackId = 'jail'
    } else if (type === 'building') {
      trackId = BUILDING_TRACK_MAP[activeModal.id] || 'building_interior'
    } else if (mode === 'overworld') {
      if (activeRegion === 'finance') trackId = 'capital_overworld'
      else if (activeRegion === 'hunter') trackId = 'hunters_rift'
      else if (activeRegion === 'yugioh') trackId = 'king_of_games'
    }
    if (trackId) bgmPlayer.play(trackId)
    else bgmPlayer.pause()
  }, [mode, activeRegion, activeModal])

  // Unmounting WorldScreen entirely (leaving to the title menu) should stop
  // music regardless of which track was last playing - the per-change effect
  // above only handles switching between tracks while mounted.
  useEffect(() => () => bgmPlayer.pause(), [])

  // Duck the ambient loop during combat types that have no dedicated track of
  // their own (rift/finalRaid/criminalEncounter) so hit/victory SFX read
  // clearly, without switching away from whatever region ambient is already
  // looping. Police and street fights don't need this - they already switch
  // to their own dedicated combat track above. Ducking is relative to the
  // CURRENT track's own authored volume, not a shared constant, since each
  // recipe was independently tuned (jail is meant quieter than police_battle).
  useEffect(() => {
    if (mode !== 'overworld' || activeRegion !== 'hunter') return
    const inCombat = ['rift', 'finalRaid', 'criminalEncounter'].includes(activeModal?.type)
    bgmPlayer.setVolume(inCombat ? bgmPlayer.currentBaseVolume() * 0.4 : bgmPlayer.currentBaseVolume())
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

  // Ending watcher: the moment the HUD cash figure reaches $10,000,000 the
  // game cuts to the ending cutscene + credits (features/cutscene/
  // EndingCutscene.jsx). Deliberately watches raw `cash` rather than
  // computeNetWorth(), because the brief was the number displayed at the
  // top of the screen - which is what the HUD below renders.
  //
  // Sitting on the rendered value rather than inside the store means every
  // route that can move cash (jobs, trades, heists, rent, End Day payouts,
  // debug) is covered by one check, instead of needing a call added to each
  // of the ~40 places that call set({ cash }). triggerEnding() carries its
  // own one-way latch, so re-renders at or above the target are no-ops.
  useEffect(() => {
    if (cash >= ENDING_CASH_TARGET) triggerEnding()
  }, [cash, triggerEnding])

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

  // A failed crime's jail roll no longer arrests the player directly (see
  // useGameStore.js's applyCrimeOutcome) - it sets pendingCrimeArrest as a
  // request instead, so "caught in the act" gets the same Fight/Escape/
  // Bribe/Talk choice the physical street-chase encounter gives, rather than
  // an instant, unavoidable cell with zero warning. This force-replaces
  // whatever crime modal was open (a vehicle theft attempt, say) with the
  // encounter, same "arrest physically removes you from whatever you were
  // doing" precedent jail?.inJail's own effect above already set.
  //
  // clearPendingCrimeArrest() is deliberately called INSIDE the timeout,
  // not synchronously up front - this effect's dependency array is
  // [pendingCrimeArrest], so clearing it synchronously here would flip that
  // same value back to null WHILE this effect is still running, which React
  // reads as "the dependency changed again" and responds by running this
  // effect's own cleanup (clearTimeout) before the 900ms timer ever fires.
  // That self-cancelling loop was a real bug: the flash would show, the
  // timer got silently killed a tick later, and the player was stuck on it
  // forever with no way to reach the actual encounter modal. Clearing it
  // only once the timer has already done its job avoids the dependency
  // ever changing mid-effect.
  useEffect(() => {
    if (!pendingCrimeArrest) return
    const { isFBI, bailDiscountMultiplier } = pendingCrimeArrest
    // Brief full-screen beat before the encounter modal opens - "caught in
    // the act" reading as an instant, silent modal swap was part of what
    // made this whole path feel like a bug rather than a real moment. The
    // modal itself also carries caughtRedHanded: true so its opening line
    // ("You've been caught red-handed!") matches this, distinct from the
    // physical chase encounter's "your heat finally caught up" framing -
    // see PoliceStopModal.jsx.
    setCaughtFlash(true)
    const t = setTimeout(() => {
      setCaughtFlash(false)
      setActiveModal({
        type: 'financePoliceEncounter',
        wantedLevel: useGameStore.getState().wantedLevel,
        isFBI,
        bailDiscountMultiplier,
        caughtRedHanded: true,
      })
      useGameStore.getState().clearPendingCrimeArrest()
    }, 900)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCrimeArrest])

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
          alert('Court & Jail. Best not to go in voluntarily.')
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
        if (!jailState?.inJail) {
          bridge.emit('resumeScene')
          return
        }
        // mazeAttemptedToday locks EVERY checkpoint, not just whichever one
        // was failed (see attemptMazeSegment) - without this the player just
        // sees nothing happen when they press E, with no indication that
        // it's a "one run per day" lockout rather than a dead interactable.
        if (jailState.mazeAttemptedToday) {
          alert(
            "You already tried the corridor today - too many eyes on it for a second run. Press End Day to serve a day and get another shot, or head back to the Booking Desk to pay bail or bribe your way out instead."
          )
          bridge.emit('resumeScene')
          return
        }
        if (payload.segmentIndex !== (jailState.mazeProgress || 0)) {
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

  // Wraps the store's raw endDay() (previously called directly from
  // FinanceStatusBar's button) with a before/after snapshot so
  // DailyReportModal can show what actually changed - endDay() itself
  // mutates cash/wantedLevel/notoriety/jail through a dozen scattered
  // set()/addCash()/addWantedLevel() calls with no single return value, so
  // diffing getState() before and after is far less invasive than trying to
  // thread a summary object out through that whole function. topEvents
  // reads world2.agentEventFeed AFTER the call - endDay() already prepends
  // this tick's fresh entries onto that same array (see its own comment),
  // the exact feed the Phone's Social/X app reads, so "View Full Feed"
  // below opens straight into it rather than a second, separate feed.
  const handleEndDay = () => {
    const before = useGameStore.getState()
    const wasJailed = !!before.jail?.inJail
    const cashBefore = before.cash
    const wantedBefore = before.wantedLevel
    const notorietyBefore = before.notoriety
    const dayBefore = before.day

    before.endDay()

    const after = useGameStore.getState()
    const stillJailed = !!after.jail?.inJail

    let jailLine = null
    if (wasJailed && !stillJailed) jailLine = "Released - your sentence is served."
    else if (stillJailed) jailLine = `Still locked up - ${after.jail.sentenceDaysRemaining} day${after.jail.sentenceDaysRemaining === 1 ? '' : 's'} left on your sentence.`

    setDailyReport({
      dayEnded: dayBefore,
      daysLeft: Math.max(0, DAYS_LIMIT - (after.day - 1)),
      cashDelta: after.cash - cashBefore,
      wantedDelta: after.wantedLevel - wantedBefore,
      notorietyDelta: after.notoriety - notorietyBefore,
      jailLine,
      headline: after.newsHeadline,
      topEvents: (after.world2.agentEventFeed || []).slice(0, 3),
    })
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

  // min-h-screen (not h-full) - the parent in App.jsx now sets min-h-screen
  // instead of a hard h-screen, and percentage/h-full heights don't
  // reliably resolve against an ancestor's min-height across browsers.
  // min-h-screen here keeps the background filling at least the viewport
  // while still letting this stack grow taller (and scroll, via App.jsx's
  // overflow-y-auto) when its content exceeds one screen.
  return (
    <div className="flex min-h-screen w-full flex-col items-center gap-4 bg-[#0f1020] p-4 font-mono text-white">
      {!hasSeenIntro && <WelcomeIntroModal />}
      {hasSeenIntro && showHelp && <WelcomeIntroModal onClose={() => setShowHelp(false)} />}
      {dailyReport && (
        <DailyReportModal
          report={dailyReport}
          onClose={() => setDailyReport(null)}
          onOpenFeed={() => {
            setDailyReport(null)
            setActiveModal({ type: 'phone', initialApp: 'social' })
          }}
        />
      )}
      {/* justify-center + an explicit gap (not justify-between/justify-start)
          - with "Days Left" added, justify-between stretched every item
          (Days Left/Player/HP/Energy/Cash/Wanted on the first wrapped line,
          district label + button group on the second) to fill the full
          860px width, leaving oversized gaps between them; justify-start
          then left-aligned both lines, leaving all the leftover space
          bunched up on the right instead. Centering each wrapped line
          keeps items close together AND balances the leftover space
          evenly on both sides. */}
      <div className="flex w-full max-w-[860px] flex-wrap items-center justify-center gap-x-5 gap-y-2 border-2 border-gray-700 bg-[#1c1d3a] px-4 py-2 text-sm">
        <div>
          Days Left: <span className={daysLeft <= 5 ? 'text-red-400' : 'text-cyan-300'}>{daysLeft}</span>
        </div>
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
        {/* Persistent "you are currently jailed" indicator - the jail cell
            zone's own Phaser region label (OverworldScene.js's
            buildJailCellZone, "Court & Jail") only shows while that specific
            scene is on screen, so a player who tabs into the phone or another
            modal while jailed had no visible confirmation they're still
            locked up. This status-bar badge is visible everywhere, same as
            Wanted above, and counts down using jail.sentenceDaysRemaining
            (see useGameStore.js's sendToJail). */}
        {jail?.inJail && (
          <div className="animate-pulse font-bold text-red-400">
            🔒 In Jail ({jail.sentenceDaysRemaining}d left)
          </div>
        )}
        {mode === 'domino' && (
          <div>
            DP: <span className="text-purple-300">{world4.dp}</span>{' '}
            <span className="text-gray-500">
              (D{world4.calendar.day} B{world4.calendar.timeBlock}{useGameStore.getState().isDominoWeekend() ? ' • Weekend' : ''})
            </span>
          </div>
        )}
        <div className="text-gray-400">{displayBlockName}</div>
        {/* Grouped with a tight gap instead of left as separate flex
            children of the header's own justify-between - on this second
            wrapped line there are only 2-3 items total, so space-between
            was spreading these 4 buttons across the full header width with
            huge gaps between them. Clustering them into one flex child
            keeps that same justify-between behavior for the line as a
            whole (district label on the left, button group on the right)
            without stretching the buttons themselves apart. */}
        <div className="flex items-center gap-2">
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
      </div>

      {mode === 'overworld' && (
        <FinanceStatusBar onOpenPhone={() => setActiveModal({ type: 'phone' })} onEndDay={handleEndDay} />
      )}

      {!worldCleared && (
        <div className="relative w-full max-w-7xl mx-auto my-2 rounded-xl overflow-hidden flex items-center justify-center">
          <GameCanvas mode={mode} bridge={bridgeRef.current} spawnOverride={overworldSpawnHint} />
          {/* On-screen early-warning signs, overlaid on the canvas rather
              than buried in the stat bar text - both read from state
              OverworldScene.js already computes every frame/throttled tick
              (policeWarning, nearbyWitnesses), this just surfaces them
              visibly instead of only mattering the instant a crime resolves. */}
          {policeWarning && (
            <div className="absolute top-2 left-1/2 z-20 -translate-x-1/2 animate-pulse rounded border-2 border-red-500 bg-red-950/90 px-4 py-1 text-sm font-bold uppercase tracking-widest text-red-300 shadow-lg">
              🚨 {policeWarning.isFBI ? 'FBI Agent' : 'Officer'} closing in!
            </div>
          )}
          {nearbyWitnesses > 0 && (
            <div className="absolute top-2 right-2 z-20 rounded border border-amber-400 bg-amber-950/85 px-2 py-1 text-xs font-bold text-amber-300 shadow-lg">
              👁 Eyewitness nearby - a botched crime here raises Wanted
            </div>
          )}
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
              // store (attemptMazeSegment cleared it) - swap the scene to
              // the real, persistent underworldInterior room (see
              // OverworldScene.js's enterUnderworldFromJail) and open the
              // Underworld hub modal on top of it, satisfying "auto-open
              // UnderworldModal once, framed as emerging through the
              // tunnel" with zero new modal code. Deliberately skips
              // resumeScene here (unlike the two branches below) - the
              // scene stays paused straight through into the Underworld
              // modal rather than letting the player move around the room
              // for a frame before it opens.
              setActiveModal({ type: 'building', id: 'underworld' })
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
          initialApp={activeModal.initialApp}
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
      {/* Real Estate Agency gets its own dedicated listings-only modal
          (RealEstateModal.jsx) - it used to just open the full BankModal
          (banking/work shift/rob vault/corporate holdings included), which
          meant two different buildings on the map opened one identical
          mega-modal. Real estate purchasing now lives ONLY here; BankModal
          no longer has a Real Estate section at all (see its own header
          comment) - it never displayed owned properties either, only the
          buy-listing block this replaces. Properties bought here still show
          up in the phone's Portfolio tab (PortfolioTab.jsx), unaffected by
          this split - only the *buying* UI moved. */}
      {activeModal?.type === 'building' && activeModal.id === 'realEstateAgency' && (
        <RealEstateModal onClose={closeModal} />
      )}
      {/* Casino got its own bespoke Phaser interior + a tabbed modal (real
          blackjack/poker/slots/NPC-challenge minigames). It no longer hosts
          the Arcade tab - Pixel Palace Arcade's two extra attractions
          (Ferrum Wings sortie + claw machine) moved out to the Game Center
          building's own walk-in room, alongside Turbo Racer/Air Hockey,
          below. Neither routes through the generic DistrictBuildingModal. */}
      {activeModal?.type === 'arcadeGame' && activeModal.id === 'turboRacer' && (
        <TurboRacerModal onClose={closeModal} />
      )}
      {activeModal?.type === 'arcadeGame' && activeModal.id === 'airHockey' && (
        <AirHockeyModal onClose={closeModal} />
      )}
      {activeModal?.type === 'arcadeGame' && activeModal.id === 'ferrumWings' && (
        <SortieCabinetModal onClose={closeModal} />
      )}
      {activeModal?.type === 'arcadeGame' && activeModal.id === 'clawMachine' && (
        <ClawMachineModal onClose={closeModal} />
      )}
      {activeModal?.type === 'arcadeGame' && activeModal.id === 'thirdRail' && (
        <RunAndGunModal onClose={closeModal} />
      )}
      {activeModal?.type === 'building' && activeModal.id === 'casino' && (
        <CasinoModal
          onClose={closeModal}
          onOpenPhone={() => setActiveModal({ type: 'phone' })}
          // Closes this modal first, then ends the day - DailyReportModal
          // renders independently of activeModal (see its own `dailyReport`
          // state above), so leaving this modal mounted would paint it
          // UNDER the casino's still-open fixed-inset-0 overlay instead of
          // showing the report.
          onEndDay={() => {
            closeModal()
            handleEndDay()
          }}
        />
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
      {/* Lisa Manobal gets a bespoke visual-novel modal instead of the shared
          NamedNpcModal. Same two entry points every other named roamer has,
          both carrying npcId 'lisa': walking up to her directly as she roams
          the map (type 'building', id 'namedRoamer' - see OverworldScene.js's
          roamer interaction emit), or the desk inside her home building's
          walk-in interior (id 'home_lisa', from the auto-generated
          characterHomeBuildings.js entry every roster member gets - no
          bespoke building of her own). This must sit ABOVE the generic
          `activeModal.npcId && <NamedNpcModal>` branch below, or she would
          render both modals at once. */}
      {activeModal?.type === 'building' && activeModal.npcId === 'lisa' && (
        <LisaModal onClose={closeModal} buildingId={activeModal.buildingId || activeModal.id} />
      )}
      {/* Warren Buffett gets the same VN-style treatment as Lisa, just kept
          on his existing roster-driven persona (see WarrenModal.jsx's own
          header) rather than a hand-authored one - only the interaction
          SCREEN changed, not who he is or what he can do. Same "must sit
          above the generic fallback" reasoning as Lisa's guard above. */}
      {activeModal?.type === 'building' && activeModal.npcId === 'buffett' && (
        <WarrenModal
          onClose={closeModal}
          buildingId={activeModal.buildingId || activeModal.id}
          onAttack={() => {
            const npc = getAnyCharacter('buffett')
            const guard = generateBodyguardMonster(npc)
            const proceed = window.confirm(
              `${npc?.name || 'This target'}'s security detail looks serious - roughly ${guard.maxHp} HP, hitting for ` +
              `~${guard.attack} per swing. You won't die if you lose, but you'll get hospitalized ` +
              `and lose a cut of your cash. Attack anyway?`
            )
            if (!proceed) return
            setActiveModal({ type: 'financeCombat', npcId: 'buffett' })
          }}
        />
      )}
      {/* Ince's house - a bespoke hub building (OverworldScene.js's
          FINANCE_BUILDING_DEFS, id 'inceHome') rather than a
          characterHomeBuildings.js entry, since she's a procedural ambient
          NPC, not a roster member (see IncModal.jsx's header). Reuses the
          exact same Mug/Attack mechanics as her ambientNpc encounter below,
          just hardcoded to her fixed id since there's no activeModal.npcId
          on a building interaction. */}
      {activeModal?.type === 'building' && activeModal.id === 'inceHome' && (
        <IncModal
          onClose={closeModal}
          mugProfile={getMugProfile('finance_ambient_2')}
          onMug={() => {
            const profile = getMugProfile('finance_ambient_2')
            useGameStore.getState().executeCrime({
              type: 'mug',
              baseSuccessChance: profile.baseSuccessChance,
              payout: profile.payout,
              notorietyIncreaseOnFail: profile.notorietyIncreaseOnFail,
              wantedIncreaseOnFail: profile.wantedIncreaseOnFail,
              energyCost: 15,
              assetSeizureOnFail: 0,
              jailChanceOnFail: 0,
              checkWitnesses: true,
              excludeVictimWitness: true,
            })
            closeModal()
          }}
          onAttack={() => setActiveModal({ type: 'ambientCombat', npcId: 'finance_ambient_2' })}
        />
      )}
      {/* The 4 Phase-2/4 consolidated hubs - each is a tabbed modal wrapping
          several formerly-standalone buildings' content via the `embedded`
          prop pattern (see each modal file for its TABS array). None of
          these building ids exist in DISTRICT_BUILDING_IDS, so they can't
          double-fire the DistrictBuildingModal branch below. */}
      {activeModal?.type === 'building' && activeModal.id === 'underworld' && (
        <UnderworldModal
          // Set by the underworldInterior zone's desk interactables
          // (OverworldScene.js's 'underworldDesk' zone type, still used by
          // the jail-tunnel escape room) so walking up to a specific racket
          // there opens UnderworldModal straight to that tab. Undefined for
          // every other entry point - the normal overworld front door now
          // included (see triggerInteraction's straight-to-modal id list)
          // - which UnderworldModal's own `initialTab = 'map'` default
          // covers by landing on its walkable hub (UnderworldMapScene.jsx)
          // instead of guessing a tab.
          initialTab={activeModal.initialTab}
          // Reached via the jail maze's tunnel or the normal overworld
          // building, doesn't matter which any more - enterUnderworldFromJail
          // (OverworldScene.js) already lands the jail-tunnel arrival on this
          // exact same persistent underworldInterior zone, so closing just
          // unpauses in place like any other building visit. Whichever way
          // the player got here, they're free to walk to another desk or
          // leave through the room's own door.
          onClose={closeModal}
          onOpenPhone={() => setActiveModal({ type: 'phone' })}
          // See CasinoModal's identical onEndDay above for why this closes
          // the modal first.
          onEndDay={() => {
            closeModal()
            handleEndDay()
          }}
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
      {/* Generic roster fallback. Excludes 'lisa'/'buffett' - they have their
          own bespoke modals above, and without this guard both would mount
          together. */}
      {activeModal?.type === 'building' && activeModal.npcId && activeModal.npcId !== 'lisa' && activeModal.npcId !== 'buffett' && (
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
      {/* Both ambient-NPC branches below share the exact same Mug/Attack
          mechanics (WorldScreen never changed what these DO, only how
          they're presented for Ince) - defined once here rather than
          duplicated across both modals. */}
      {activeModal?.type === 'ambientNpc' && (() => {
        // Success chance vs. payout is per-mark, not a flat coin-flip -
        // deterministically derived from the npc's own id (getMugProfile),
        // so the same NPC is always exactly this hard/lucrative to mug
        // every run, and tougher marks are riskier but pay out more.
        const mugProfile = getMugProfile(activeModal.npcId)
        const handleMug = () => {
          const res = useGameStore.getState().executeCrime({
            type: 'mug',
            baseSuccessChance: mugProfile.baseSuccessChance,
            payout: mugProfile.payout,
            notorietyIncreaseOnFail: mugProfile.notorietyIncreaseOnFail,
            wantedIncreaseOnFail: mugProfile.wantedIncreaseOnFail,
            energyCost: 15,
            assetSeizureOnFail: 0,
            jailChanceOnFail: 0,
            // Physically standing next to the mark in the overworld - a
            // botched mug only raises heat if a bystander (or a patrolling
            // officer) was actually close enough to see it happen.
            checkWitnesses: true,
            excludeVictimWitness: true,
          })
          // Stays open showing the actual roll outcome instead of closing
          // silently - the old behavior gave zero indication of whether the
          // mug succeeded, whiffed clean (no witness around), or got you
          // caught, which is exactly what made "wanted level didn't move"
          // read as a bug instead of the 80%-success/witness-gated roll it
          // actually is. A pendingCrimeArrest hit (see useGameStore.js)
          // still supersedes this on the very next render regardless.
          setActiveModal({ ...activeModal, feedback: res.message })
        }
        const handleAttack = () => setActiveModal({ type: 'ambientCombat', npcId: activeModal.npcId })

        // finance_ambient_2 deterministically hashes to "Ince" every run
        // (see npcGenerator.js's FIRST_NAMES pool) - the only one of the 6
        // ambient slots with a bespoke modal (IncModal.jsx). The other 5
        // fall through to the plain AmbientNpcModal below, unchanged.
        if (activeModal.npcId === 'finance_ambient_2') {
          return (
            <IncModal
              onClose={closeModal}
              mugProfile={mugProfile}
              onMug={handleMug}
              onAttack={handleAttack}
              feedback={activeModal.feedback}
            />
          )
        }
        return (
          <AmbientNpcModal
            npcName={activeModal.npcName}
            onClose={closeModal}
            mugProfile={mugProfile}
            onMug={handleMug}
            onAttack={handleAttack}
            feedback={activeModal.feedback}
          />
        )
      })()}
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
        <PoliceStopModal
          wantedLevel={activeModal.wantedLevel}
          isFBI={activeModal.isFBI}
          bailDiscountMultiplier={activeModal.bailDiscountMultiplier}
          caughtRedHanded={activeModal.caughtRedHanded}
          onClose={closeModal}
        />
      )}
      {caughtFlash && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-red-950/90">
          <p className="animate-pulse text-4xl font-black uppercase tracking-widest text-red-300">
            Caught Red-Handed!
          </p>
        </div>
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
