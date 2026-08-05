import { create } from 'zustand'
import {
  rollStartingProfession,
  rankForExp,
  rollShadowMonarchCondition,
  getShadowMonarchCondition,
} from '../features/hunter/professions'
import { shouldGrantFortify } from '../features/hunter/skillEffects'
import {
  STOCKS,
  CRYPTO_BASE_PRICE,
  CRYPTO_NAME,
  randomWalk,
  FINANCE_VICTORY_TARGET,
  NET_WORTH_MILESTONES,
  REAL_ESTATE_LISTINGS,
  COMPANY_LISTINGS,
  JOB_TIERS,
  JOB_ENERGY_COST,
  LOAN_TIERS,
} from '../features/finance/marketData'
import { FINANCE_NPCS } from '../features/finance/financeNpcs'
import { rollHeadline } from '../features/finance/newsHeadlines'
import { initializeAgentsState, simulateDailyAgentInteractions, ARCHETYPE_PROFILES } from '../features/finance/agentEngine'
import { generateEventNarration } from '../features/finance/aiNarrator'
import { calculateAtonementCost, calculateEnergyBlessingCost } from '../features/temple/templeEngine'
import {
  applyStandingEvent,
  applyStandingDecayTick,
  getUnlockedRankTier,
  getHomeTurfPayoutMultiplier,
  getHomeTurfBailDiscountMultiplier,
  getHomeTurfJailChanceReduction,
  getRivalEncounterChance,
  getRivalIds,
  isHomeTurf,
  SYNDICATE_IDS,
} from '../features/agents/syndicateStandingEngine'
import { initializeGovernmentState, simulateGovernmentDailyTick, resolvePresidentialElection, triggerPresidentialElection } from '../features/government/governmentEngine'
import { buildMasterAgentRegistry } from '../features/agents/agentRegistry'
import { simulateDynamicSchedules } from '../features/agents/dynamicScheduleEngine'
import { generateIntelReports } from '../features/agents/intelReports'
import { TIME_BLOCKS } from '../features/agents/worldPresenceEngine'
import { simulateTownMigration } from '../features/agents/townMigrationEngine'
import { triggerButterflyEffect } from '../features/agents/butterflyEffectEngine'
import { simulateExpandedAgenciesTick } from '../features/government/expandedAgencies'
import { simulateSubdepartmentsTick } from '../features/government/agencySubdepartments'
import { simulateScotusJudicialReview } from '../features/government/scotusEngine'
import { simulateCongressTick } from '../features/government/congressEngine'
import { initializeTreasuryState, buyTreasuryBonds } from '../features/government/treasuryEngine'
import { initializeTransportationState, purchaseVehicle } from '../features/world/transportationSystem'
import { initializeRomanceState } from '../features/agents/romanceEngine'
import { simulateAgentAssetPurchasing } from '../features/agents/agentAssetPurchasing'
import { STARTER_DP_DECK } from '../features/domino/cardDatabase'

const SAVE_KEY = 'board-of-realities-save'
export const FINANCE_AMBIENT_NPC_COUNT = 8
const FINANCE_TOTAL_NPCS = FINANCE_NPCS.length + FINANCE_AMBIENT_NPC_COUNT

const BLOCKS = [
  { id: 'hunter', name: "The Hunter's Rift", difficulty: 8, survivalRate: 20 },
  { id: 'finance', name: 'Capital Syndicate', difficulty: 5, survivalRate: 55 },
  { id: 'yugioh', name: 'King of Games', difficulty: 4, survivalRate: 65 },
  { id: 'domino', name: 'Domino City', difficulty: 6, survivalRate: 45 },
]

// Only Finance is currently reachable from OverworldScene.js (see
// production/backlog.md "Current state") - hunter/yugioh/domino are paused
// and nothing ever clears them, so letting clearBlock() below pick from
// every uncleared block would strand currentBlockId on a world the player
// can't actually enter. Add a block's id back here once it's wired back
// into the overworld.
const REACHABLE_BLOCK_IDS = ['finance']

// world4.calendar: Time Block 1=Morning, 2=Afternoon, 3=Evening, 4=Night.
// Day 1=Monday..7=Sunday. Display names live in the domino UI components.

// Capital Syndicate's own clock, decoupled from world4's Domino calendar
// above. `day` here is a private counter that only advances once its 5
// timeBlockIndex values (see worldPresenceEngine.js's TIME_BLOCKS) have all
// been visited - i.e. a full Morning->Midnight cycle is guaranteed to
// complete WITHIN one worldClock.day, mirroring the same
// advance-block/roll-day-over shape advanceTimeBlocks() already uses for
// world4 below. It intentionally does NOT reuse the top-level `day` field
// (which is a plain "how many times has End Day been pressed" counter that
// every existing per-press economic system - loan interest, market tick,
// headline roll, wanted/notoriety decay, government tick - already keys off
// of); changing that field's cadence would ripple into all of those
// unrelated systems. worldClock is additive and only feeds the
// character-presence engine's day/timeBlockIndex dimensions.
function generateRunSeed() {
  return Math.floor(Math.random() * 0xffffffff)
}

// Shared crash-reset shape for ShrimpCoin - used by BOTH tickFinanceMarket's
// ambient real-time crash roll AND the Hype Deck mini-game's "Whale Dump"
// bust outcome (see CryptoModal.jsx), so the two can never drift out of
// sync on what "the market crashed" actually resets to.
function crashResetCrypto() {
  return { cryptoPrice: CRYPTO_BASE_PRICE, cryptoHype: 0 }
}

function createDefaultState() {
  return {
    screen: 'welcome', // welcome | world | gameOver
    // Gates the one-time "how to play / goal of the game" intro shown on
    // WorldScreen's first mount after a brand new game - false only on a
    // fresh startNewGame(); loadGame() always forces this true, since
    // resuming a save should never re-show it (see loadGame() below).
    hasSeenIntro: false,
    player: {
      name: '',
      gender: 'male',
      face: 0,
      skinTone: 0,
      eyebrows: 0,
      eyes: 0,
      mouth: 0,
      nose: 0,
      hair: 0,
      outfitColor: 0,
      level: 1,
      exp: 0,
      // streetwise/luck are the doc's "crime stat model" additions, kept
      // alongside the original RPG set rather than replacing it - Hunter
      // combat (computePlayerDamage) reads STR/AGI/INT/VIT/PER by name, and
      // Poker's bluff mechanic already leans on PER as a charisma stand-in,
      // so swapping the set out would risk breaking both. allocateStat is
      // key-agnostic, so these level up through the same mechanism.
      stats: { STR: 5, AGI: 5, INT: 5, VIT: 5, PER: 5, streetwise: 5, luck: 5 },
      unallocatedPoints: 0,
      hp: 100,
      maxHp: 100,
      energy: 100,
      maxEnergy: 100,
      alive: true,
      professionId: null,
    },
    inventory: [],
    // Bumped from the original $100 - that left almost nothing affordable
    // (bribes alone start at $500) before the player had done any work,
    // making the very first minutes of the game feel broke rather than
    // just early-game. $1,000 still sits far below the $50k "First Comma"
    // milestone, so the climb to net worth still means something.
    cash: 1000,
    wantedLevel: 0,
    notoriety: 0, // 0-100 stat for crime visibility
    // Live count of NPCs (police, ambient pedestrians, named roamers) within
    // witness range of the player right now - published every ~400ms by
    // OverworldScene.updateNearbyWitnesses while the player is in the
    // overworld (0 the rest of the time: interiors have no equivalent
    // physical-bystander concept, so any crime resolved from inside one is
    // deliberately never routed through the checkWitnesses gate at all -
    // see applyCrimeOutcome). Read by applyCrimeOutcome to decide whether a
    // failed street crime's caught-in-the-act consequences (notoriety/
    // wanted/seizure/jail) actually apply.
    nearbyWitnesses: 0,
    // Jail: a sibling top-level field to wantedLevel/notoriety, not nested in
    // world2 - being locked up is a cross-world consequence of Heat, not a
    // Finance-only concept, even though every crime that can trigger it
    // today happens to live in world2. sentenceDaysRemaining is 1-3+ days
    // (see sendToJail), bailCost is a snapshot taken at arrest time (not
    // recomputed live). bribeAttemptsToday/mazeAttemptedToday (replacing the
    // old escapeAttemptedToday) live here rather than in a modal's local
    // state because the jailCell/jailMaze zones open the resolution modal
    // via a walk-up interactable that mounts/unmounts per visit - local
    // component state would silently reset the attempt cap every time the
    // player walked away from the desk and back.
    jail: { inJail: false, sentenceDaysRemaining: 0, bailCost: 0, bribeAttemptsToday: 0, mazeAttemptedToday: false, mazeProgress: 0 },
    // Capital Syndicate core loop: a persistent day counter (advanced by the
    // "End Day" button), a rolling flavor headline, and Public Reputation/
    // Social Status (0-100). Police Heat/SEC Suspicion is deliberately NOT a
    // new field here - it's wantedLevel (already 0-5) read as a percentage,
    // per the brief's instruction to reuse the existing Wanted Level system
    // rather than build a parallel one.
    day: 1,
    // Per-run seed for worldPresenceEngine.js: generated once here (freshly,
    // every createDefaultState() call - i.e. every "New Game") and then
    // persisted verbatim through saveGame/loadGame, so a loaded save keeps
    // replaying the same characters' schedules while two separate
    // playthroughs (two different seeds) diverge.
    runSeed: generateRunSeed(),
    worldClock: { day: 1, timeBlockIndex: 0 },
    newsHeadline: null,
    reputation: 50,
    shadowMonarch: { unlocked: false, used: false, conditionId: null },
    blocks: BLOCKS.map((b) => ({ ...b, cleared: false })),
    currentBlockId: null,
    world1: {
      hunterRank: 'E',
      married: false,
      marriageCandidateMet: false,
      children: 0,
      hasSpringOfNazarick: false,
      finalRaidUnlocked: false,
      professionAssigned: false,
      fortifyApplied: false,
      poomQuestComplete: false,
      poomRewardItemId: null,
      tanQuestComplete: false,
      riftsCleared: 0,
      shadowMonarchProgress: {
        flawlessRiftStreak: 0,
        monstersDefeated: 0,
        lowHpTurnsSurvived: 0,
        itemsPurchased: 0,
      },
    },
    world2: {
      marketInitialized: false,
      stocks: [],
      portfolio: {},
      shortPositions: {},
      cryptoPrice: CRYPTO_BASE_PRICE,
      cryptoHype: 0,
      cryptoHoldings: 0,
      // Hype Deck mini-game session flag (see CryptoModal.jsx) - while true,
      // tickFinanceMarket's ambient real-time crash roll is skipped so the
      // background timer can't crash the market out from under an open
      // session. Ordinary price drift is unaffected. Always false outside an
      // active Hype Deck run.
      pumpSessionActive: false,
      realEstate: [],
      companies: [],
      npcStatus: {},
      ambientKillCount: 0,
      // Social/X "post to manipulate market sentiment" mechanic (see
      // postToMarket()/endDay()'s pendingPost consumption below, and
      // SocialApp.jsx for the UI). lastPostDay gates one post per day.
      // pendingPost holds the single in-flight post (posting again before it
      // resolves is blocked by lastPostDay, so this is always at most one
      // entry deep). postCounts drives the per-target repeat-post decay.
      lastPostDay: null,
      pendingPost: null,
      postCounts: {},
      // bankedAmount is a protected sub-bucket of `cash`, not a separate
      // pool - deposit/withdraw move value in and out of it. loanBalance is
      // real debt, added to cash when borrowed and accruing interest each
      // endDay() tick until repaid.
      bankedAmount: 0,
      loanBalance: 0,
      recruitedAdvisors: [],
      // Sticky, one-way net worth milestone ladder (see NET_WORTH_MILESTONES
      // in marketData.js and checkNetWorthMilestones() below) - once a tier
      // id lands in here it is never removed, same permanence contract as
      // recruitedAdvisors/npcStatus above, even if net worth later dips back
      // below the threshold.
      netWorthMilestones: [],
      // Chapel Blessing: a temporary, additive Luck buff bought at the
      // Temple (see buyTempleBlessing/getEffectiveLuck) - does not stack,
      // buying again while active just refreshes expiresOnDay.
      templeBlessing: { active: false, bonus: 3, expiresOnDay: null },
      // Per-syndicate Standing (0-100, default 0) for the 7 canonical crime
      // syndicates (see syndicateStandingEngine.js) - persistent-but-mutable
      // like loanBalance above, NOT a sticky one-way ladder like
      // netWorthMilestones and NOT a timed buff like templeBlessing.
      // syndicateLastInteractionDay drives the 3-day-no-interaction decay
      // tick in endDay() below. Both are plain id->number maps rather than
      // pre-seeded with all 7 ids at 0 - every read goes through
      // `state.world2.syndicateStanding?.[id] || 0`
      // (getSyndicateStanding selector below), so a save from before these
      // fields existed loads as "all zero" instead of crashing.
      syndicateStanding: {},
      syndicateLastInteractionDay: {},
      // Boss-tier signature jobs (Escobar's Air-Drop Route Planner, Lansky's
      // Offshore Audit, Lepke's Contract Deduction - see EscobarAirDropModal
      // .jsx/OffshoreAuditModal.jsx/ContractDeductionModal.jsx) each gate at
      // standing >= RANK_GATE.boss AND a once-per-in-game-day-per-syndicate
      // cooldown - the cooldown, not difficulty, is what stops grinding one
      // of these for repeated $10-12k paydays. Plain syndicateId->day map,
      // same "absent key = never done" convention as syndicateLastInteractionDay
      // above, so a save from before this field existed loads as "every job
      // available today" instead of crashing (see isBossJobAvailableToday).
      bossJobLastDay: {},
      agentsState: initializeAgentsState(),
      agentEventFeed: [],
      governmentState: initializeGovernmentState(),
      masterAgents: buildMasterAgentRegistry(),
      transitState: initializeTransportationState(),
      romanceState: initializeRomanceState(),
      treasuryState: initializeTreasuryState(),
    },
    world3: {
      deck: [],
      ownsKaibaCorp: false,
      yugiDefeated: false,
      teaRelationship: 0,
      teaMarried: false,
      yugiBrokenHeart: false,
      kidnappedNpcs: [],
      tahTyrantSummoned: false,
      cynnRelationship: 'neutral',
      cynnDuelsWon: 0,
    },
    world4: {
      calendar: { day: 1, timeBlock: 1, week: 1 }, // day 1-7 (Mon-Sun), timeBlock 1-4
      dp: 300,
      deck: [...STARTER_DP_DECK],
      trunk: [],
      totalWins: 0,
      winsByTier: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      tier4Defeated: [],
      tournamentPassOwned: false,
      currentZone: 'playersRoom',
    },
  }
}

export const useGameStore = create((set, get) => ({
  ...createDefaultState(),

  setScreen: (screen) => set({ screen }),

  dismissIntro: () => set({ hasSeenIntro: true }),

  updatePlayer: (patch) =>
    set((state) => ({ player: { ...state.player, ...patch } })),

  updatePlayerStats: (statPatch) =>
    set((state) => ({
      player: { ...state.player, stats: { ...state.player.stats, ...statPatch } },
    })),

  // Character creator and the dice-roll screen are removed - there's only
  // one world in play (Capital Syndicate/Finance) and one fixed character,
  // so "New Game" goes straight from the welcome screen into the world.
  startNewGame: () => {
    const fresh = createDefaultState()
    set({
      ...fresh,
      player: { ...fresh.player, name: 'Player', gender: 'male' },
      shadowMonarch: { ...fresh.shadowMonarch, conditionId: rollShadowMonarchCondition() },
      currentBlockId: 'finance',
      screen: 'world',
    })
  },

  enterWorld: () => set({ screen: 'world' }),

  // Dev-only: teleport straight into any world, skipping the dice roll and
  // every unlock condition. Fills in a placeholder character if none exists
  // yet so QA can test a world without going through character creation.
  devJumpToWorld: (blockId) => {
    const state = get()
    const needsPlayer = !state.player.name
    set({
      player: needsPlayer
        ? {
            ...state.player,
            name: 'QA Tester',
            gender: 'male',
            hp: state.player.maxHp,
            alive: true,
          }
        : state.player,
      currentBlockId: blockId,
      screen: 'world',
    })
    get().assignStartingProfession()
    if (blockId === 'finance') get().initFinanceMarket()
  },

  clearBlock: (blockId) =>
    set((state) => {
      const blocks = state.blocks.map((b) =>
        b.id === blockId ? { ...b, cleared: true } : b
      )
      const uncleared = blocks.filter(
        (b) => !b.cleared && REACHABLE_BLOCK_IDS.includes(b.id)
      )
      const nextBlock = uncleared.length > 0
        ? uncleared[Math.floor(Math.random() * uncleared.length)]
        : null
      return { blocks, currentBlockId: nextBlock ? nextBlock.id : null }
    }),

  addCash: (amount) => set((state) => ({ cash: state.cash + amount })),

  addWantedLevel: (amount) =>
    set((state) => ({
      wantedLevel: Math.max(0, Math.min(5, state.wantedLevel + amount)),
    })),

  addReputation: (amount) =>
    set((state) => ({
      reputation: Math.max(0, Math.min(100, state.reputation + amount)),
    })),

  addItem: (item) =>
    set((state) => ({ inventory: [...state.inventory, item] })),

  removeItem: (itemId) =>
    set((state) => {
      const index = state.inventory.findIndex((i) => i.id === itemId)
      if (index === -1) return {}
      const inventory = [...state.inventory]
      inventory.splice(index, 1)
      return { inventory }
    }),

  takeDamage: (amount) => {
    const state = get()
    const newHp = state.player.hp - amount
    if (newHp > 0) {
      set({ player: { ...state.player, hp: newHp } })
      return
    }
    if (state.shadowMonarch.unlocked && !state.shadowMonarch.used) {
      set({
        player: {
          ...state.player,
          hp: state.player.maxHp,
          stats: Object.fromEntries(
            Object.entries(state.player.stats).map(([k, v]) => [k, v * 2])
          ),
        },
        shadowMonarch: { ...state.shadowMonarch, used: true },
      })
      return
    }
    set({ player: { ...state.player, hp: 0, alive: false } })
    localStorage.removeItem(SAVE_KEY)
    set({ screen: 'gameOver' })
  },

  // Non-lethal counterpart to takeDamage(), for Finance-world encounters
  // (ambient muggings, named-tycoon bodyguard fights, SWAT/police ambushes)
  // that route through the same RiftCombatModal as Hunter's Rift dungeon
  // crawl. Rift's permadeath/save-wipe stakes are intentional for that
  // world's dungeon crawl, but were never meant to apply to these optional
  // side fights - losing an optional "rob this guy's guards" encounter
  // shouldn't be able to erase a multi-hour econ-grind save. Returns true
  // while the player is still standing (mirrors takeDamage's early-return
  // shape), false once they've been knocked out - the caller decides how to
  // present that in the modal.
  takeFinanceCombatDamage: (amount) => {
    const state = get()
    const newHp = state.player.hp - amount
    if (newHp > 0) {
      set({ player: { ...state.player, hp: newHp } })
      return true
    }
    // Beaten down, not killed: you get patched up/bribed off (a cut of your
    // cash), wake up with a partial HP floor instead of 0, and lose the
    // rest of the day's energy - a real, felt setback with no save wipe.
    const hospitalBill = Math.round(state.cash * 0.15)
    set({
      cash: Math.max(0, state.cash - hospitalBill),
      player: {
        ...state.player,
        hp: Math.max(1, Math.round(state.player.maxHp * 0.25)),
        energy: 0,
      },
    })
    return false
  },

  // --- World 1: Hunter's Rift ---------------------------------------------

  assignStartingProfession: () => {
    const state = get()
    if (state.world1.professionAssigned) return
    set({
      player: { ...state.player, professionId: rollStartingProfession() },
      world1: { ...state.world1, professionAssigned: true },
    })
    get().checkFortifyUnlock()
  },

  // Gate for the daily action economy - every meaningful action (job shift,
  // crime, a casino hand, a date) costs energy instead of being limited only
  // by a real-time cooldown or nothing at all, so a day's worth of actions
  // is naturally capped at a handful instead of one action being spammable
  // forever. Returns false (and changes nothing) if the player can't afford
  // it, same shape as every existing `if (cash < cost) return false` guard.
  spendEnergy: (amount) => {
    const state = get()
    // Defense-in-depth backstop: a jailed player has 0 energy already (set
    // by sendToJail), but this guard makes the lockout explicit and immune
    // to any future action that doesn't cost energy at all.
    if (state.jail?.inJail) return false
    if (state.player.energy < amount) return false
    set({ player: { ...state.player, energy: state.player.energy - amount } })
    return true
  },

  // Inverse of spendEnergy - the mid-day energy economy's one relief valve
  // (Food Court snack, Temple energy blessing). Energy otherwise only ever
  // refills at End Day (see endDay's player.energy reset), which is the
  // whole reason these two paid top-ups exist: without them, running out of
  // energy mid-day just ends the day's options early with no way to keep
  // playing except advancing time. Clamped at maxEnergy same as the reset
  // does - buying a top-up while already near full never overshoots.
  restoreEnergy: (amount) => {
    const state = get()
    set({ player: { ...state.player, energy: Math.min(state.player.maxEnergy, state.player.energy + amount) } })
  },

  allocateStat: (statKey) => {
    const state = get()
    if (state.player.unallocatedPoints <= 0) return
    set({
      player: {
        ...state.player,
        unallocatedPoints: state.player.unallocatedPoints - 1,
        stats: { ...state.player.stats, [statKey]: state.player.stats[statKey] + 1 },
      },
    })
  },

  gainExp: (amount) => {
    const state = get()
    const newExp = state.player.exp + amount
    const leveledUp = Math.floor(newExp / 1000) > Math.floor(state.player.exp / 1000)
    const newLevel = state.player.level + (leveledUp ? 1 : 0)
    const newRank = rankForExp(newExp)
    set({
      player: {
        ...state.player,
        exp: newExp,
        level: newLevel,
        unallocatedPoints: state.player.unallocatedPoints + (leveledUp ? 3 : 0),
      },
      world1: { ...state.world1, hunterRank: newRank },
    })
    get().checkShadowMonarchUnlock()
    get().checkFortifyUnlock()
  },

  // Tank's Fortify skill (C-rank): +25% max HP, granted once, permanently,
  // the first time a Tank reaches C-rank or above.
  checkFortifyUnlock: () => {
    const state = get()
    if (state.world1.fortifyApplied) return
    if (!shouldGrantFortify(state.player.professionId, state.world1.hunterRank)) return
    const bonus = Math.round(state.player.maxHp * 0.25)
    set({
      player: {
        ...state.player,
        maxHp: state.player.maxHp + bonus,
        hp: state.player.hp + bonus,
      },
      world1: { ...state.world1, fortifyApplied: true },
    })
  },

  recordRiftClear: ({ tookDamage }) => {
    const state = get()
    const progress = state.world1.shadowMonarchProgress
    set({
      world1: {
        ...state.world1,
        riftsCleared: state.world1.riftsCleared + 1,
        shadowMonarchProgress: {
          ...progress,
          flawlessRiftStreak: tookDamage ? 0 : progress.flawlessRiftStreak + 1,
        },
      },
    })
    get().checkShadowMonarchUnlock()
  },

  recordMonsterDefeated: () => {
    const state = get()
    set({
      world1: {
        ...state.world1,
        shadowMonarchProgress: {
          ...state.world1.shadowMonarchProgress,
          monstersDefeated: state.world1.shadowMonarchProgress.monstersDefeated + 1,
        },
      },
    })
    get().checkShadowMonarchUnlock()
  },

  recordLowHpTurn: () => {
    const state = get()
    set({
      world1: {
        ...state.world1,
        shadowMonarchProgress: {
          ...state.world1.shadowMonarchProgress,
          lowHpTurnsSurvived: state.world1.shadowMonarchProgress.lowHpTurnsSurvived + 1,
        },
      },
    })
    get().checkShadowMonarchUnlock()
  },

  recordPurchase: () => {
    const state = get()
    set({
      world1: {
        ...state.world1,
        shadowMonarchProgress: {
          ...state.world1.shadowMonarchProgress,
          itemsPurchased: state.world1.shadowMonarchProgress.itemsPurchased + 1,
        },
      },
    })
  },

  checkShadowMonarchUnlock: () => {
    const state = get()
    if (state.shadowMonarch.unlocked || !state.shadowMonarch.conditionId) return
    const condition = getShadowMonarchCondition(state.shadowMonarch.conditionId)
    if (condition && condition.check(state.world1.shadowMonarchProgress, state)) {
      set({
        shadowMonarch: { ...state.shadowMonarch, unlocked: true },
        player: { ...state.player, professionId: 'shadow_monarch' },
      })
    }
  },

  buySpringOfNazarick: () => {
    const state = get()
    const spawnAvailable = state.world1.hunterRank !== 'S'
    if (!spawnAvailable || state.cash < 1 || state.world1.hasSpringOfNazarick) return false
    set({
      cash: state.cash - 1,
      world1: { ...state.world1, hasSpringOfNazarick: true },
    })
    get().recordPurchase()
    return true
  },

  completePoomQuest: (item) => {
    const state = get()
    set({
      inventory: [...state.inventory, item],
      world1: { ...state.world1, poomQuestComplete: true, poomRewardItemId: item.id },
    })
  },

  completeTanQuest: () => {
    const state = get()
    if (state.world1.hasSpringOfNazarick) return
    set({
      world1: { ...state.world1, tanQuestComplete: true, hasSpringOfNazarick: true },
    })
  },

  meetMarriageCandidate: () =>
    set((state) => ({ world1: { ...state.world1, marriageCandidateMet: true } })),

  marry: () => set((state) => ({ world1: { ...state.world1, married: true } })),

  haveChild: () =>
    set((state) => ({ world1: { ...state.world1, children: state.world1.children + 1 } })),

  finalRaidConditionsMet: () => {
    const state = get()
    const w1 = state.world1
    return (
      w1.hunterRank === 'S' &&
      w1.married &&
      state.cash >= 1000000 &&
      w1.children >= 1 &&
      w1.hasSpringOfNazarick
    )
  },

  clearWorld1: () => {
    get().clearBlock('hunter')
  },

  switchCity: (cityId) => set({ currentCityId: cityId }),

  // --- World 2: Financial Anarchy ------------------------------------------

  initFinanceMarket: () => {
    const state = get()
    if (state.world2.marketInitialized) return
    set({
      world2: {
        ...state.world2,
        marketInitialized: true,
        stocks: STOCKS.map((s) => ({ ticker: s.ticker, name: s.name, price: s.basePrice })),
      },
    })
  },

  tickFinanceMarket: () => {
    const state = get()
    const w2 = state.world2
    if (!w2.marketInitialized) return

    const stocks = w2.stocks.map((s) => ({ ...s, price: randomWalk(s.price, 0.06) }))

    let cryptoPrice = w2.cryptoPrice
    let cryptoHype = w2.cryptoHype
    // Crash roll is skipped entirely while a Hype Deck session is open (see
    // world2.pumpSessionActive) - the ordinary randomWalk drift below still
    // runs unaffected either way.
    if (!w2.pumpSessionActive && cryptoHype > 0 && Math.random() < cryptoHype * 0.15) {
      const reset = crashResetCrypto()
      cryptoPrice = reset.cryptoPrice
      cryptoHype = reset.cryptoHype
    } else {
      cryptoPrice = randomWalk(cryptoPrice, 0.1)
    }

    const rentIncome = w2.realEstate.reduce((sum, id) => {
      const listing = REAL_ESTATE_LISTINGS.find((l) => l.id === id)
      return sum + (listing?.rentPerTick || 0)
    }, 0)
    const companyIncome = w2.companies.reduce((sum, id) => {
      const listing = COMPANY_LISTINGS.find((l) => l.id === id)
      return sum + (listing?.incomePerTick || 0)
    }, 0)

    set({ world2: { ...w2, stocks, cryptoPrice, cryptoHype } })
    const passiveIncome = rentIncome + companyIncome
    if (passiveIncome > 0) get().addCash(passiveIncome)
  },

  // priceMultiplier lets the Stock Exchange's timed-meter mini-game apply a
  // discount (<1) when the player executes inside the "sweet zone" - plain
  // callers omit it and pay exactly stock.price*shares as before.
  buyStock: (ticker, shares, priceMultiplier = 1) => {
    const state = get()
    const stock = state.world2.stocks.find((s) => s.ticker === ticker)
    if (!stock) return false
    const cost = stock.price * shares * priceMultiplier
    if (state.cash < cost) return false
    const existing = state.world2.portfolio[ticker] || { shares: 0, avgCost: 0 }
    const totalShares = existing.shares + shares
    const avgCost = (existing.shares * existing.avgCost + cost) / totalShares
    set({
      cash: state.cash - cost,
      world2: {
        ...state.world2,
        portfolio: { ...state.world2.portfolio, [ticker]: { shares: totalShares, avgCost } },
      },
    })
    return true
  },

  // priceMultiplier lets the Stock Exchange's timed-meter mini-game apply a
  // bonus (>1) when the player executes inside the "sweet zone" - plain
  // callers omit it and receive exactly stock.price*shares as before.
  sellStock: (ticker, shares, priceMultiplier = 1) => {
    const state = get()
    const stock = state.world2.stocks.find((s) => s.ticker === ticker)
    const holding = state.world2.portfolio[ticker]
    if (!stock || !holding || holding.shares < shares) return false
    const proceeds = stock.price * shares * priceMultiplier
    const remaining = holding.shares - shares
    const portfolio = { ...state.world2.portfolio }
    if (remaining <= 0) delete portfolio[ticker]
    else portfolio[ticker] = { ...holding, shares: remaining }
    set({ cash: state.cash + proceeds, world2: { ...state.world2, portfolio } })
    return true
  },

  // Short-selling: the inverse of buyStock/sellStock. Opening a short
  // "borrows shares and sells them now" - proceeds are credited to cash
  // immediately, no cash check needed since nothing is being spent. Covering
  // later buys the shares back at whatever the price is then; if the price
  // rose since opening, covering costs MORE than was received, so a short
  // can leave the player unable to afford closing it out - a real,
  // unbounded-downside liability that computeNetWorth must account for.
  //
  // priceMultiplier follows the same convention as buyStock/sellStock: the
  // Stock Exchange's timed-meter mini-game passes a bonus (>1, priced like
  // sellStock - a HIGH entry price is good when opening a short) or discount
  // (<1, priced like buyStock - a LOW cover price is good); plain callers
  // omit it and get exactly stock.price*shares.
  openShort: (ticker, shares, priceMultiplier = 1) => {
    const state = get()
    const stock = state.world2.stocks.find((s) => s.ticker === ticker)
    if (!stock) return false
    const currentShorts = state.world2.shortPositions || {}
    const proceeds = stock.price * shares * priceMultiplier
    const existing = currentShorts[ticker] || { shares: 0, entryPrice: 0 }
    const totalShares = existing.shares + shares
    const entryPrice = (existing.shares * existing.entryPrice + proceeds) / totalShares
    set({
      cash: state.cash + proceeds,
      world2: {
        ...state.world2,
        shortPositions: { ...currentShorts, [ticker]: { shares: totalShares, entryPrice } },
      },
    })
    return true
  },

  coverShort: (ticker, shares, priceMultiplier = 1) => {
    const state = get()
    const stock = state.world2.stocks.find((s) => s.ticker === ticker)
    const currentShorts = state.world2.shortPositions || {}
    const position = currentShorts[ticker]
    if (!stock || !position || position.shares < shares) return false
    const cost = stock.price * shares * priceMultiplier
    if (state.cash < cost) return false
    const remaining = position.shares - shares
    const shortPositions = { ...currentShorts }
    if (remaining <= 0) delete shortPositions[ticker]
    else shortPositions[ticker] = { ...position, shares: remaining }
    set({ cash: state.cash - cost, world2: { ...state.world2, shortPositions } })
    return true
  },

  buyCrypto: (usdAmount) => {
    const state = get()
    if (state.cash < usdAmount || usdAmount <= 0) return false
    const coins = usdAmount / state.world2.cryptoPrice
    set({
      cash: state.cash - usdAmount,
      world2: { ...state.world2, cryptoHoldings: state.world2.cryptoHoldings + coins },
    })
    return true
  },

  sellCrypto: (coins) => {
    const state = get()
    if (state.world2.cryptoHoldings < coins) return false
    const proceeds = coins * state.world2.cryptoPrice
    set({
      cash: state.cash + proceeds,
      world2: { ...state.world2, cryptoHoldings: state.world2.cryptoHoldings - coins },
    })
    return true
  },

  // Superseded by the Hype Deck mini-game's applyCryptoPumpCard below (see
  // CryptoModal.jsx) - kept in place since nothing else has ever called it
  // (verified via grep) and removing it isn't necessary to ship Hype Deck.
  shillCrypto: () => {
    const state = get()
    const newHype = Math.min(1, state.world2.cryptoHype + 0.15)
    set({
      world2: {
        ...state.world2,
        cryptoHype: newHype,
        cryptoPrice: state.world2.cryptoPrice * 1.35,
      },
    })
  },

  // --- World 2: Crypto "Hype Deck" mini-game --------------------------------
  // Replaces the old free/unlimited shillCrypto() click with a session-based
  // deck-draw mini-game (see CryptoModal.jsx). All per-run deck/draw state
  // lives in the modal's local component state, same convention as
  // VaultCrackModal's puzzle state - the store only holds the durable market
  // state (price/hype) plus the pumpSessionActive flag that gates the
  // ambient crash roll above.

  setPumpSessionActive: (active) =>
    set((state) => ({ world2: { ...state.world2, pumpSessionActive: active } })),

  // Called once per safe "Pump"/"Big Pump" draw. priceMultiplier compounds
  // onto the current price; hypeDelta adds onto (and clamps at 1 like
  // everywhere else in this file) the hype meter.
  applyCryptoPumpCard: ({ priceMultiplier, hypeDelta }) => {
    const state = get()
    set({
      world2: {
        ...state.world2,
        cryptoPrice: state.world2.cryptoPrice * priceMultiplier,
        cryptoHype: Math.min(1, state.world2.cryptoHype + hypeDelta),
      },
    })
  },

  // "Whale Dump" draw: an instant session-ending bust. Reuses the exact same
  // crash-reset shape as the ambient crash roll (crashResetCrypto) so the two
  // can never drift out of sync, and always clears pumpSessionActive since a
  // Whale Dump unconditionally ends the session.
  applyCryptoWhaleDump: () => {
    const state = get()
    set({
      world2: { ...state.world2, ...crashResetCrypto(), pumpSessionActive: false },
    })
    get().addReputation(-5)
  },

  buyRealEstate: (listing) => {
    const state = get()
    const milestones = state.world2.netWorthMilestones || []
    if (listing.requiresMilestone && !milestones.includes(listing.requiresMilestone)) return false
    if (state.cash < listing.price || state.world2.realEstate.includes(listing.id)) return false
    set({
      cash: state.cash - listing.price,
      world2: { ...state.world2, realEstate: [...state.world2.realEstate, listing.id] },
    })
    return true
  },

  buyCompany: (listing) => {
    const state = get()
    const milestones = state.world2.netWorthMilestones || []
    if (listing.requiresMilestone && !milestones.includes(listing.requiresMilestone)) return false
    if (state.cash < listing.price || state.world2.companies.includes(listing.id)) return false
    set({
      cash: state.cash - listing.price,
      world2: { ...state.world2, companies: [...state.world2.companies, listing.id] },
    })
    return true
  },

  // Highest JOB_TIERS entry the player currently qualifies for (INT + rep
  // gates), walked from the top down so a qualifying player always gets
  // their best tier rather than the first one just barely met.
  currentJobTier: () => {
    const state = get()
    const int = state.player.stats.INT
    const rep = state.reputation
    for (let i = JOB_TIERS.length - 1; i >= 0; i--) {
      const tier = JOB_TIERS[i]
      if (int >= tier.minInt && rep >= tier.minReputation) return tier
    }
    return JOB_TIERS[0]
  },

  // Previously gated on a 20-second real-time cooldown instead of a per-day
  // limit, which meant legit income was effectively unlimited for a patient
  // player - energy (a per-day resource) is now the only gate, so a day's
  // worth of shifts is naturally capped at a handful like every other
  // action instead of being spammable forever.
  workShift: () => {
    if (!get().spendEnergy(JOB_ENERGY_COST)) return false
    const tier = get().currentJobTier()
    set((state) => ({ cash: state.cash + tier.pay }))
    return true
  },

  // --- Bank: deposit/withdraw ----------------------------------------------
  // bankedAmount is a protected sub-bucket of `cash`, not a separate pool -
  // it never leaves `cash`, it just marks a portion of it as "safe" so a
  // future crime-against-the-player system can treat cash - bankedAmount as
  // the only at-risk pool without every existing cash consumer (buyStock,
  // buyRealEstate, casino games, ...) needing to be rewritten to read a
  // split balance.
  depositCash: (amount) => {
    const state = get()
    if (amount <= 0 || amount > state.cash - state.world2.bankedAmount) return false
    set({ world2: { ...state.world2, bankedAmount: state.world2.bankedAmount + amount } })
    return true
  },

  withdrawCash: (amount) => {
    const state = get()
    if (amount <= 0 || amount > state.world2.bankedAmount) return false
    set({ world2: { ...state.world2, bankedAmount: state.world2.bankedAmount - amount } })
    return true
  },

  // --- Bank: loans/credit ---------------------------------------------------
  // 0-100 scale to match every other stat in the game (reputation, hp,
  // energy) rather than a 300-850 FICO-style score - derived on read, not
  // stored, so it always reflects current standing instead of going stale.
  creditScore: () => {
    const state = get()
    const netWorth = get().computeNetWorth()
    return Math.max(0, Math.min(100,
      50 + state.reputation * 0.3 - state.wantedLevel * 10 + (netWorth > 50000 ? 10 : 0)
    ))
  },

  loanTier: () => {
    const state = get()
    const score = get().creditScore()
    const milestones = state.world2.netWorthMilestones || []
    // Filter out any tier the player hasn't earned the milestone gate for
    // yet (see LOAN_TIERS' comment in marketData.js), THEN pick the first
    // remaining match by credit score - this is what lets the milestone
    // tier sit ahead of the plain 70-score tier without being reachable
    // before "made_player" is actually earned.
    const eligibleTiers = LOAN_TIERS.filter(
      (t) => !t.requiresMilestone || milestones.includes(t.requiresMilestone)
    )
    return eligibleTiers.find((t) => score >= t.minCreditScore) || eligibleTiers[eligibleTiers.length - 1]
  },

  takeLoan: (amount) => {
    const state = get()
    const tier = get().loanTier()
    if (amount <= 0 || state.world2.loanBalance + amount > tier.maxLoan) return false
    set({
      cash: state.cash + amount,
      world2: { ...state.world2, loanBalance: state.world2.loanBalance + amount },
    })
    return true
  },

  repayLoan: (amount) => {
    const state = get()
    if (amount <= 0 || amount > state.cash || amount > state.world2.loanBalance) return false
    set({
      cash: state.cash - amount,
      world2: { ...state.world2, loanBalance: state.world2.loanBalance - amount },
    })
    return true
  },

  addNotoriety: (amount) => {
    set((state) => ({ notoriety: Math.max(0, Math.min(100, state.notoriety + amount)) }))
  },

  // See nearbyWitnesses' own comment above (initial state) for what this
  // feeds - OverworldScene is the only writer, applyCrimeOutcome the only
  // reader.
  setNearbyWitnesses: (count) => {
    set({ nearbyWitnesses: Math.max(0, count) })
  },

  // player.stats.luck was read by nothing until this pass. Every formula that
  // wants Luck must call this instead of reading player.stats.luck raw, so
  // the Chapel Blessing (a temporary bonus, added at read time - never
  // mutates the base stat, same pattern getInventoryStatBonus already uses
  // in RiftCombatModal.jsx) actually applies everywhere Luck matters.
  getEffectiveLuck: () => {
    const state = get()
    const blessing = state.world2.templeBlessing
    return state.player.stats.luck + (blessing?.active ? blessing.bonus : 0)
  },

  // Shared success/fail resolution for any crime-flavored action, extracted
  // out of executeCrime so actions that determine their own success (e.g.
  // VaultCrackModal's Mastermind puzzle - the player's guesses decide the
  // outcome, not a dice roll) can still apply the exact same
  // payout/notoriety/wanted/asset-seizure/jail consequences as the RNG-gated
  // crimes below. executeCrime (unchanged behavior) now just rolls its own
  // isSuccess and hands off to this.
  // syndicateId/inHomeTurf are OPTIONAL and additive: every pre-existing
  // crime action (LeverageMeter negotiations, VaultCrackModal, money
  // laundering, vehicle theft, etc.) doesn't know which of the 7 named
  // syndicates it belongs to, so it simply omits these and gets EXACTLY the
  // old behavior back. Only a caller that DOES know it's running a job for
  // one of the 7 canonical syndicates (see syndicateStandingEngine.js) opts
  // into the standing/territory effects below by passing them.
  //
  // checkWitnesses/excludeVictimWitness are the same kind of opt-in: only
  // the handful of crimes that physically happen out in the open overworld
  // (mugging, vehicle theft - see their call sites) pass checkWitnesses:
  // true, gating the caught-in-the-act consequences below on
  // nearbyWitnesses actually being > 0 at the moment of failure. Every other
  // crime (temple theft, crypto hacking, syndicate collude/extort, vault
  // cracking...) has no equivalent physical-bystander concept and omits it,
  // getting the exact old always-applies behavior. excludeVictimWitness
  // additionally discounts one witness - the mugging target themselves is
  // always within nearbyWitnesses' radius by definition of being
  // interactable, but the target knowing they got mugged isn't the same as
  // a BYSTANDER seeing it and reacting in the moment, which is what actually
  // drives an instant Wanted bump here.
  applyCrimeOutcome: ({ success, payout, notorietyIncreaseOnFail, wantedIncreaseOnFail, assetSeizureOnFail, jailChanceOnFail = 0, syndicateId = null, inHomeTurf = false, checkWitnesses = false, excludeVictimWitness = false }) => {
    const state = get()
    const effectiveLuck = get().getEffectiveLuck()
    const homeStanding = syndicateId ? get().getSyndicateStanding(syndicateId) : 0

    if (success) {
      // Home-turf payout multiplier: +50% max at standing 100. Never
      // applies off your own syndicate's turf.
      const finalPayout = syndicateId && inHomeTurf
        ? Math.round(payout * getHomeTurfPayoutMultiplier(homeStanding))
        : payout
      state.addCash(finalPayout)
      if (syndicateId) get().recordSyndicateJobOutcome(syndicateId, 'success')
      return { success: true, payout: finalPayout, message: `Success! You got away with $${finalPayout.toLocaleString()}.` }
    } else {
      // A failed street crime that literally nobody saw still means you
      // walked away with nothing, but there's no one to report it - same
      // "committed discreetly" house rule requested for this feature.
      if (checkWitnesses) {
        const witnessCount = Math.max(0, state.nearbyWitnesses - (excludeVictimWitness ? 1 : 0))
        if (witnessCount <= 0) {
          if (syndicateId) get().recordSyndicateJobOutcome(syndicateId, 'failNoJail')
          return { success: false, fine: 0, jailed: false, message: "You fumbled it, but no one was around to notice - you got away clean." }
        }
      }
      let failMsg = 'You were caught!'
      // CRITICAL BALANCE CONSTRAINT (see syndicateStandingEngine.js's
      // getHomeTurfJailChanceReduction comment for the full rationale):
      // syndicate standing is only ever allowed to touch payout multiplier,
      // bail cost, and jail *chance* elsewhere in this function. It must
      // NEVER discount the two lines below - heat keeps accumulating on
      // every failure no matter how friendly you are with the local
      // syndicate, or a maxed relationship becomes a risk-free money
      // printer that can also never gain a Wanted level. (checkWitnesses
      // above is a different, orthogonal gate - already-returned by this
      // point for any failure it applies to - not a second discount stacked
      // on top of standing.)
      if (notorietyIncreaseOnFail) state.addNotoriety(notorietyIncreaseOnFail)
      if (wantedIncreaseOnFail) state.addWantedLevel(wantedIncreaseOnFail)

      let fine = 0
      if (assetSeizureOnFail) {
        fine = Math.floor(state.cash * assetSeizureOnFail)
        if (fine > 0) {
          state.addCash(-fine)
          failMsg += ` Seized $${fine.toLocaleString()}.`
        }
      }

      // Jail roll happens after every other fail-path effect above, so it
      // reads wantedLevel AFTER this fail's own addWantedLevel call already
      // landed - re-read via get(), not the `state` snapshot from function
      // entry. Home-turf standing shaves up to -0.2 off this chance at
      // standing 100 (see getHomeTurfJailChanceReduction) - it only ever
      // reduces jail *chance*, never the heat added above.
      const wantedLevelAfterFail = get().wantedLevel
      const homeTurfJailReduction = syndicateId ? getHomeTurfJailChanceReduction(homeStanding, inHomeTurf) : 0
      const jailChance = Math.max(0, Math.min(0.9,
        jailChanceOnFail + wantedLevelAfterFail * 0.08 - (effectiveLuck - 5) * 0.015 - homeTurfJailReduction
      ))
      let jailed = false
      if (jailChance > 0 && Math.random() < jailChance) {
        get().sendToJail({
          bailDiscountMultiplier: syndicateId && inHomeTurf ? getHomeTurfBailDiscountMultiplier(homeStanding) : 1,
        })
        jailed = true
        failMsg += ' You were arrested and thrown in jail!'
      }

      if (syndicateId) {
        get().recordSyndicateJobOutcome(syndicateId, jailed ? 'failJail' : 'failNoJail')
      }

      return { success: false, fine, jailed, message: failMsg }
    }
  },

  // syndicateId/inHomeTurf/checkWitnesses/excludeVictimWitness just pass
  // straight through to applyCrimeOutcome (see its own comment) - optional,
  // so any existing caller that doesn't know which of the 7 named
  // syndicates a job belongs to, or has no physical-bystander concept, is
  // unaffected.
  executeCrime: ({ type, baseSuccessChance, payout, notorietyIncreaseOnFail, wantedIncreaseOnFail, energyCost, assetSeizureOnFail, jailChanceOnFail = 0, syndicateId = null, inHomeTurf = false, checkWitnesses = false, excludeVictimWitness = false }) => {
    const state = get()
    if (!state.spendEnergy(energyCost)) return { success: false, reason: 'Not enough energy' }

    // Streetwise increases success chance, Notoriety decreases it, Luck
    // (base 5, so a Luck of 5 is a no-op) nudges it either way.
    const streetwise = state.player.stats.streetwise || 5
    const effectiveLuck = get().getEffectiveLuck()
    const successProb = baseSuccessChance + (streetwise * 0.02) - (state.notoriety * 0.002) + (effectiveLuck - 5) * 0.01
    const clampedProb = Math.max(0.05, Math.min(0.95, successProb))

    const isSuccess = Math.random() < clampedProb

    return get().applyCrimeOutcome({
      success: isSuccess,
      payout,
      notorietyIncreaseOnFail,
      wantedIncreaseOnFail,
      assetSeizureOnFail,
      jailChanceOnFail,
      syndicateId,
      inHomeTurf,
      checkWitnesses,
      excludeVictimWitness,
    })
  },

  // --- Capital Syndicate: Per-Syndicate Standing ------------------------------
  // Thin call-throughs into syndicateStandingEngine.js's pure functions - see
  // that file for the full rivalry-graph/decay/balance-constraint reasoning.

  getSyndicateStanding: (syndicateId) => get().world2.syndicateStanding?.[syndicateId] || 0,

  // Exposes the 33/66 rank-gate thresholds through one selector instead of
  // scattering those magic numbers across every place that needs to know
  // whether Underboss/Boss content is unlocked for a given syndicate.
  getSyndicateRankTier: (syndicateId) => getUnlockedRankTier(get().getSyndicateStanding(syndicateId)),

  getSyndicateHomeTurfPayoutMultiplier: (syndicateId) => getHomeTurfPayoutMultiplier(get().getSyndicateStanding(syndicateId)),

  getSyndicateHomeTurfBailDiscount: (syndicateId) => getHomeTurfBailDiscountMultiplier(get().getSyndicateStanding(syndicateId)),

  getSyndicateIsHomeTurf: (syndicateId, currentLocation) => isHomeTurf(syndicateId, currentLocation),

  // Hostile-turf rival-encounter chance for running a job on `turfSyndicateId`'s
  // ground while working for `actingSyndicateId`. Returns 0 outside an actual
  // rivalry (own turf, or a syndicate with no beef with the turf owner) - see
  // the 3-pair rivalry graph in syndicateStandingEngine.js.
  getSyndicateRivalEncounterChance: (actingSyndicateId, turfSyndicateId) => {
    if (!turfSyndicateId || turfSyndicateId === actingSyndicateId) return 0
    if (!getRivalIds(actingSyndicateId).includes(turfSyndicateId)) return 0
    return getRivalEncounterChance(get().getSyndicateStanding(turfSyndicateId))
  },

  // Records one job outcome against `syndicateId`'s standing (+8/-3/-8, see
  // STANDING_DELTA), cascading the -4 rivalry hit to its rival(s) on any
  // completion (success or either failure flavor - NOT a walk-away). Also
  // stamps syndicateLastInteractionDay, which is what the endDay() decay
  // tick below reads. outcomeType is one of 'success' | 'failNoJail' |
  // 'failJail' | 'walkAway'.
  recordSyndicateJobOutcome: (syndicateId, outcomeType) => {
    if (!syndicateId || !SYNDICATE_IDS.includes(syndicateId)) return
    const state = get()
    const { standing, lastInteractionDay } = applyStandingEvent(
      state.world2.syndicateStanding || {},
      state.world2.syndicateLastInteractionDay || {},
      syndicateId,
      outcomeType,
      state.day
    )
    set({
      world2: { ...state.world2, syndicateStanding: standing, syndicateLastInteractionDay: lastInteractionDay },
    })
  },

  // Convenience wrapper for "accepted a syndicate job, then backed out
  // before resolving it" - the one outcome applyCrimeOutcome never produces
  // on its own, since it always rolls all the way to success/fail.
  declineSyndicateJob: (syndicateId) => get().recordSyndicateJobOutcome(syndicateId, 'walkAway'),

  // --- Capital Syndicate: Boss-tier job cooldown ------------------------------
  // Once-per-in-game-day-per-syndicate gate for the 3 Boss-tier signature jobs
  // (see world2.bossJobLastDay's own comment above for the full list/rationale).
  // Deliberately separate from the 33/66 standing gate (RANK_GATE.boss) -
  // standing decides WHETHER a job is ever offered, this decides whether
  // TODAY'S slot is still open. Both must pass before a job's briefing screen
  // lets the player commit (see BossJobGate.jsx).
  isBossJobAvailableToday: (syndicateId) => {
    const state = get()
    const lastDay = state.world2.bossJobLastDay?.[syndicateId]
    return lastDay == null || lastDay < state.day
  },

  // Stamped exactly once per job attempt, at the same "locked at start"
  // moment each job locks in its stat-derived budgets/attempts (mirrors
  // VaultCrackModal reading INT once via getState() at puzzle start) - win,
  // lose, soft-abort, and walk-away all consume today's one shot alike.
  // Retrying WITHIN the same open modal session after that (e.g. Offshore
  // Audit's "Try Again", Air-Drop's "Fly Another Route") is intentionally
  // NOT re-blocked here - it's bounded by the energy economy instead (each
  // retry re-spends the job's energyCost), the same soft limit VaultCrackModal's
  // own unlimited "Back to Tier Select" already relies on. What this cooldown
  // actually closes off is the real grind vector: close the modal (or end the
  // day) and reopen for a second free run at today's job.
  markBossJobAttempted: (syndicateId) => {
    const state = get()
    set({
      world2: {
        ...state.world2,
        bossJobLastDay: { ...(state.world2.bossJobLastDay || {}), [syndicateId]: state.day },
      },
    })
  },

  // --- Jail / Escape ---------------------------------------------------------

  // bailDiscountMultiplier defaults to 1 (no discount) so every existing
  // caller (jail escape flows, or applyCrimeOutcome when syndicateId is
  // omitted) is unaffected. Only applyCrimeOutcome's home-turf branch passes
  // anything else - see getHomeTurfBailDiscountMultiplier.
  sendToJail: ({ bailDiscountMultiplier = 1 } = {}) => {
    const state = get()
    const wantedLevelAfterFail = state.wantedLevel
    const rawBailCost = Math.min(
      calculateAtonementCost(state.wantedLevel, state.notoriety, state.cash) * 2,
      state.cash * 0.4
    ) * bailDiscountMultiplier
    set({
      jail: {
        inJail: true,
        sentenceDaysRemaining: 1 + Math.floor(wantedLevelAfterFail / 2),
        bailCost: Math.max(0, Math.round(rawBailCost)),
        bribeAttemptsToday: 0,
        mazeAttemptedToday: false,
        mazeProgress: 0,
      },
      player: { ...state.player, energy: 0 },
    })
  },

  payBail: () => {
    const state = get()
    if (state.cash < state.jail.bailCost) return false
    set({
      cash: state.cash - state.jail.bailCost,
      jail: { inJail: false, sentenceDaysRemaining: 0, bailCost: 0, bribeAttemptsToday: 0, mazeAttemptedToday: false, mazeProgress: 0 },
    })
    return true
  },

  // Replaces the old flat attemptJailEscape with two distinct resolution
  // paths (jail mini-map plan): a repeatable, cash-priced bribe roll at the
  // guard desk, and a free but one-shot multi-segment maze run. bribeAmount
  // is spent regardless of outcome - only the roll's success is at stake.
  // isFinalAttempt mirrors the old escape action's contract: the harsher
  // on-exhaustion penalty (extra sentence day + notoriety) is specifically a
  // "3rd failed round in one sitting" penalty, so the caller (JailEscapeModal)
  // still decides when a sitting is exhausted, using jail.bribeAttemptsToday
  // from the store instead of its own local round counter.
  attemptJailBribe: (bribeAmount, isFinalAttempt = false) => {
    const state = get()
    if (!state.jail?.inJail) return { success: false }
    if (state.jail.bribeAttemptsToday >= 3) return { success: false, exhausted: true }
    if (state.cash < bribeAmount) return { success: false, error: 'cash' }

    set({ cash: state.cash - bribeAmount })

    const streetwise = state.player.stats.streetwise || 5
    const effectiveLuck = get().getEffectiveLuck()
    const targetNumber = 8 + state.wantedLevel + Math.floor(state.notoriety / 25)
    const bribeRatio = Math.min(1, bribeAmount / Math.max(1, state.jail.bailCost))
    const bribeBonus = Math.round(bribeRatio * 4)
    const streetwiseBonus = Math.floor(streetwise / 10)
    const luckBonus = Math.floor((effectiveLuck - 5) / 2)
    const roll = (1 + Math.floor(Math.random() * 6)) + (1 + Math.floor(Math.random() * 6))
      + bribeBonus + streetwiseBonus + luckBonus

    if (roll >= targetNumber) {
      set({ jail: { inJail: false, sentenceDaysRemaining: 0, bailCost: 0, bribeAttemptsToday: 0, mazeAttemptedToday: false, mazeProgress: 0 } })
      get().addWantedLevel(-1)
      return { success: true }
    }

    const bribeAttemptsToday = state.jail.bribeAttemptsToday + 1
    if (isFinalAttempt) {
      set({
        jail: { ...state.jail, sentenceDaysRemaining: state.jail.sentenceDaysRemaining + 1, bribeAttemptsToday },
      })
      get().addNotoriety(5)
      return { success: false, exhausted: true }
    }
    set({ jail: { ...state.jail, bribeAttemptsToday } })
    return { success: false }
  },

  // Street-level bribe offered at a police stop (PoliceStopModal,
  // financePoliceEncounter), BEFORE an arrest ever happens - so unlike
  // attemptJailBribe there's no bailCost yet to price the roll's bribeRatio
  // against. Per the "real arrest pipeline" spec: reuse attemptJailBribe's
  // exact 2d6 + bonuses roll verbatim, but price the bribe off wantedLevel
  // (500 * wantedLevel^2) and compute bribeRatio against that same figure
  // instead of a bailCost snapshot. Cash is spent regardless of outcome -
  // same "the money's gone either way" contract as attemptJailBribe. On
  // success the encounter just ends (no Wanted change - they were never
  // caught on the books). On failure the caller escalates into combat; no
  // extra Wanted penalty is applied here since the player is already caught.
  attemptStreetBribe: (amount) => {
    const state = get()
    if (state.cash < amount) return { success: false, error: 'cash' }

    set({ cash: state.cash - amount })

    const cost = 500 * state.wantedLevel * state.wantedLevel
    const streetwise = state.player.stats.streetwise || 5
    const effectiveLuck = get().getEffectiveLuck()
    const targetNumber = 8 + state.wantedLevel + Math.floor(state.notoriety / 25)
    const bribeRatio = Math.min(1, amount / Math.max(1, cost))
    const bribeBonus = Math.round(bribeRatio * 4)
    const streetwiseBonus = Math.floor(streetwise / 10)
    const luckBonus = Math.floor((effectiveLuck - 5) / 2)
    const roll = (1 + Math.floor(Math.random() * 6)) + (1 + Math.floor(Math.random() * 6))
      + bribeBonus + streetwiseBonus + luckBonus

    return { success: roll >= targetNumber }
  },

  // Difficulty knob for the 4 jailMaze checkpoints' real input challenges
  // (see features/jail/JailMazeMinigame.jsx and its four segment
  // components). This computes EXACTLY the same evadeChance the old
  // coin-flip used - same AGI/streetwise/effective-Luck/wantedLevel inputs,
  // same rising per-segment difficulty - and just inverts it into a 0..1
  // "how hard should the minigame be" number (~0.15-0.85). That's it. The
  // number only ever feeds difficultyToParams() to size a sweep zone/pick a
  // sequence length/etc; it is never compared against Math.random()
  // anywhere downstream. The minigame's own pass/fail is what decides the
  // checkpoint now - see attemptMazeSegment's playerSucceeded param below.
  getMazeSegmentDifficulty: (segmentIndex) => {
    const state = get()
    const agi = state.player.stats.AGI || 5
    const streetwise = state.player.stats.streetwise || 5
    const effectiveLuck = get().getEffectiveLuck()
    const evadeChance = Math.max(0.15, Math.min(0.85,
      0.65 - segmentIndex * 0.08 + (agi - 5) * 0.03 + (streetwise - 5) * 0.01
        + (effectiveLuck - 5) * 0.02 - state.wantedLevel * 0.03
    ))
    return 1 - evadeChance
  },

  // Single committed run through 4 checkpoints (jailMaze zone), each now a
  // real input challenge (see JailMazeMinigame.jsx) - free (no cash cost,
  // unlike the bribe), highest variance, and the only jail-failure path
  // that raises wantedLevel. segmentIndex is 0-3; the caller (WorldScreen,
  // via each jailMaze checkpoint interactable) resolves that segment's
  // minigame FIRST and only then calls this with the minigame's own
  // pass/fail as playerSucceeded - this function no longer rolls anything
  // of its own, it purely applies consequences. Every branch below
  // (advance mazeProgress, pay out on the final segment, or the failure
  // penalty) is byte-identical to the old Math.random()-driven version;
  // only the source of the boolean changed. jail.mazeProgress is still the
  // store-authoritative "next expected segment" - an out-of-order call
  // (e.g. the player somehow reaching a later checkpoint's rect first) is
  // silently ignored rather than resolved, so checkpoints can't be skipped
  // or re-rolled out of sequence. mazeAttemptedToday locks out a second run
  // until the sentence ticks over (see the End Day handling below).
  attemptMazeSegment: (segmentIndex, playerSucceeded) => {
    const state = get()
    if (!state.jail?.inJail || state.jail.mazeAttemptedToday) return { success: false }
    if (segmentIndex !== (state.jail.mazeProgress || 0)) return { success: false, outOfOrder: true }

    if (playerSucceeded) {
      if (segmentIndex >= 3) {
        const cashReward = Math.min(Math.round(state.jail.bailCost * 0.5), 5000)
        set({
          cash: state.cash + cashReward,
          jail: { inJail: false, sentenceDaysRemaining: 0, bailCost: 0, bribeAttemptsToday: 0, mazeAttemptedToday: false, mazeProgress: 0 },
        })
        return { success: true, final: true, cashReward }
      }
      set({ jail: { ...state.jail, mazeProgress: segmentIndex + 1 } })
      return { success: true, segmentIndex, final: false }
    }

    set({
      jail: {
        ...state.jail,
        sentenceDaysRemaining: state.jail.sentenceDaysRemaining + 1,
        mazeAttemptedToday: true,
        mazeProgress: 0,
      },
    })
    get().addNotoriety(8)
    get().addWantedLevel(1)
    return { success: false, segmentIndex }
  },

  // Chapel Blessing: a flat-cost, non-stacking Luck buff (see world2.
  // templeBlessing / getEffectiveLuck). Buying again while already active
  // just refreshes the 2-day window rather than stacking bonuses.
  buyTempleBlessing: () => {
    const state = get()
    const cost = 3000
    if (state.cash < cost) return false
    set({
      cash: state.cash - cost,
      world2: {
        ...state.world2,
        templeBlessing: { active: true, bonus: 3, expiresOnDay: state.day + 2 },
      },
    })
    return true
  },

  // Energy's other relief valve alongside the Food Court snack
  // (restoreEnergy/interactiveLocations.js) - the "real" one, priced to
  // stay meaningful at every wealth level instead of fading into pocket
  // change (see calculateEnergyBlessingCost's own header comment). No cap
  // on repeat same-day purchases needed: since the cost is a percentage of
  // CURRENT cash, spending it repeatedly is self-limiting on its own
  // (each purchase shrinks the cash the next one's percentage is taken
  // from), unlike a flat price that a rich player could spam for free.
  buyEnergyBlessing: () => {
    const state = get()
    if (state.player.energy >= state.player.maxEnergy) return false
    const cost = calculateEnergyBlessingCost(state.cash)
    if (state.cash < cost) return false
    set({ cash: state.cash - cost })
    get().restoreEnergy(state.player.maxEnergy)
    return true
  },

  // --- Social/X: market sentiment posts -------------------------------------
  // Bounded preset-only "talk up/down" mechanic (see SocialApp.jsx - two-step
  // target+direction picker, no free text, so there's no content-moderation
  // surface). One post per day (lastPostDay guard below). The post itself
  // costs energy and shows an instant templated feed line, but its actual
  // market effect is deliberately NOT applied here - it's queued as
  // pendingPost and only resolved on a later endDay() tick (see that
  // function's pendingPost consumption), so a post can never be chained into
  // an instant same-day trade around its own guaranteed effect. Reputation
  // is read-only input to the magnitude here and is never written by this
  // action. Repeat posts about the same target decay geometrically
  // (0.6^postCount) via postCounts, so spamming one ticker/day quickly stops
  // moving the needle.
  postToMarket: ({ target, direction }) => {
    const state = get()
    if (!state.spendEnergy(20)) return { success: false, reason: 'Not enough energy' }
    const w2 = get().world2 // re-read post-spendEnergy (spendEnergy only touches player, but stay consistent with the rest of this file's re-get() pattern)
    if (w2.lastPostDay != null && state.day <= w2.lastPostDay) {
      return { success: false, reason: 'Already posted today' }
    }

    const reputation = state.reputation ?? 50
    const postCounts = w2.postCounts || {}
    const priorPosts = postCounts[target] || 0
    const decay = 0.6 ** priorPosts
    const isCrypto = target === 'CRYPTO'
    // Crypto: 0.04 at rep 0, 0.10 at rep 100 (a cryptoHype delta - hype is a
    // future-crash-probability multiplier, NOT a direct price lever, see
    // tickFinanceMarket()'s hype-driven crash roll - so 'down' here reduces
    // hype/crash-risk rather than "dumping the price").
    // Stocks: 0.03 at rep 0, 0.07 at rep 100 (a direct price %).
    const baseValue = isCrypto
      ? 0.04 + (reputation / 100) * 0.06
      : 0.03 + (reputation / 100) * 0.04
    const decayedValue = baseValue * decay

    const stock = isCrypto ? null : w2.stocks.find((s) => s.ticker === target)
    const targetName = isCrypto ? CRYPTO_NAME : (stock?.name || target)
    const bullish = direction === 'up'
    // $-prefixed cashtag (not bare parens) to read as an actual post, not a
    // form summary - SocialApp.jsx's composer preview mirrors this exact
    // string shape, keep them in sync if this ever changes.
    const templatedText = `You posted about ${targetName}${!isCrypto ? ` ($${target})` : ''} — sentiment turning ${bullish ? 'bullish' : 'bearish'}.`
    const feedId = `player_post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    set({
      world2: {
        ...w2,
        lastPostDay: state.day,
        pendingPost: { target, direction, pct: decayedValue, postedOnDay: state.day },
        agentEventFeed: [
          { id: feedId, title: '📱 Your Post', text: templatedText },
          ...(w2.agentEventFeed || []),
        ].slice(0, 40),
      },
    })

    // Fire-and-forget AI flavor rewrite of the templated line above - never
    // awaited (postToMarket already returned synchronously by the time this
    // resolves or fails), same contract as endDay()'s flagship-event
    // narration. Reuses enrichEventNarration verbatim, no new action.
    generateEventNarration({
      type: 'player_post',
      actorName: 'You',
      targetName,
      direction,
      fallbackText: templatedText,
    }).then((text) => {
      if (text) get().enrichEventNarration(feedId, text)
    })

    return { success: true }
  },

  financeNpcAction: (npcId, action) => {
    const state = get()
    const npc = FINANCE_NPCS.find((n) => n.id === npcId)
    if (!npc) return
    const status = state.world2.npcStatus[npcId] || 'alive'
    if (status === 'dead') return

    const ENERGY_COST = { workFor: 5, collude: 15, extort: 15 }
    if (ENERGY_COST[action] !== undefined && !get().spendEnergy(ENERGY_COST[action])) return

    if (action === 'workFor') {
      get().addCash(300)
    } else if (action === 'collude') {
      get().executeCrime({
        type: 'collude',
        baseSuccessChance: 0.7,
        payout: 2000,
        notorietyIncreaseOnFail: 10,
        wantedIncreaseOnFail: 2,
        energyCost: 0, // already spent in financeNpcAction check
        assetSeizureOnFail: 0,
        jailChanceOnFail: 0.10,
      })
    } else if (action === 'extort') {
      get().executeCrime({
        type: 'extort',
        baseSuccessChance: 0.5,
        payout: 5000,
        notorietyIncreaseOnFail: 20,
        wantedIncreaseOnFail: 4,
        energyCost: 0, // already spent in financeNpcAction check
        assetSeizureOnFail: 0,
        jailChanceOnFail: 0.20,
      })
    }
  },

  markFinanceNpcDead: (npcId) => {
    const state = get()
    set({
      world2: {
        ...state.world2,
        npcStatus: { ...state.world2.npcStatus, [npcId]: 'dead' },
      },
    })
    get().checkSoleSurvivor()
  },

  recordAmbientKill: () => {
    const state = get()
    set({
      world2: { ...state.world2, ambientKillCount: state.world2.ambientKillCount + 1 },
    })
    get().checkSoleSurvivor()
  },

  computeNetWorth: () => {
    const state = get()
    const w2 = state.world2
    const stockValue = Object.entries(w2.portfolio).reduce((sum, [ticker, holding]) => {
      const stock = w2.stocks.find((s) => s.ticker === ticker)
      return sum + (stock ? stock.price * holding.shares : 0)
    }, 0)
    const cryptoValue = w2.cryptoHoldings * w2.cryptoPrice
    // Open shorts are a liability, not free cash: the proceeds from opening
    // one already landed in `cash` above, but covering it back costs
    // whatever the stock is worth NOW, so that cost must be subtracted here
    // or the $1B win condition could be met by opening huge shorts and never
    // covering them.
    const shortLiability = Object.entries(w2.shortPositions || {}).reduce((sum, [ticker, short]) => {
      const stock = w2.stocks.find((s) => s.ticker === ticker)
      return sum + (stock ? stock.price * short.shares : 0)
    }, 0)
    return state.cash + stockValue + cryptoValue - shortLiability
  },

  isSoleSurvivor: () => {
    const state = get()
    const namedDead = FINANCE_NPCS.every((n) => state.world2.npcStatus[n.id] === 'dead')
    return namedDead && state.world2.ambientKillCount >= FINANCE_AMBIENT_NPC_COUNT
  },

  checkSoleSurvivor: () => {
    if (get().isSoleSurvivor()) {
      get().clearBlock('finance')
    }
  },

  // Sticky, one-way net worth milestone ladder (see NET_WORTH_MILESTONES in
  // marketData.js) - mirrors isSoleSurvivor()/checkSoleSurvivor()'s pattern
  // of a pure computeNetWorth()-driven check called from endDay(), except
  // this one has 5 permanent tiers instead of a single flag. Loops the
  // WHOLE ladder every call (not just the next unearned tier) so a single
  // big windfall between End Day presses can cross multiple tiers in one go.
  checkNetWorthMilestones: () => {
    const state = get()
    const netWorth = get().computeNetWorth()
    const earned = state.world2.netWorthMilestones || []
    const newlyEarned = NET_WORTH_MILESTONES.filter(
      (tier) => netWorth >= tier.threshold && !earned.includes(tier.id)
    )
    if (newlyEarned.length === 0) return

    const announcements = {
      first_comma: 'First Comma — your net worth just cracked $50,000.',
      made_player: "Made Player — you've broken a quarter million in net worth. The Syndicate Board is starting to notice.",
      conglomerate_threshold: 'Conglomerate Threshold — net worth tops $1,000,000. Skyscrapers and multinational acquisitions are now within reach.',
      titan_apprentice: 'Titan Apprentice — $5,000,000 net worth. Reputation surges as the industry titans start returning your calls.',
      true_tycoon: 'True Tycoon — $10,000,000 net worth. You could credibly declare yourself the richest person alive.',
    }
    const feedEntries = newlyEarned.map((tier) => ({
      id: `milestone_${tier.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: `Milestone: ${tier.name}`,
      text: announcements[tier.id] || `${tier.name} — your net worth just crossed $${tier.threshold.toLocaleString()}.`,
    }))

    set((s) => ({
      world2: {
        ...s.world2,
        netWorthMilestones: [...earned, ...newlyEarned.map((t) => t.id)],
        agentEventFeed: [...feedEntries, ...(s.world2.agentEventFeed || [])].slice(0, 40),
      },
    }))

    // Tier 4 (titan_apprentice) one-time Reputation bonus - guarded by
    // newlyEarned (this tick's "just crossed" set) rather than re-checking
    // membership in the ladder, so repeated endDay() calls after the tier is
    // already banked never re-fire it.
    if (newlyEarned.some((t) => t.id === 'titan_apprentice')) {
      get().addReputation(15)
    }

    // A milestone crossing draws the single most aggressive Titan not
    // already on the player's Board - they raid the player directly, hitting
    // whichever stock the player is holding the most value in. Reuses the
    // exact same mechanical clamp as the Titan-vs-Titan raid effect in
    // endDay() (raidImpact in the same $1,000-$9,000 range, capped at a 15%
    // price hit) - this is the ONLY player-facing reaction hook added here,
    // deliberately not a broader "Titans track player notoriety" system.
    const agentsState = state.world2.agentsState || {}
    const recruitedAdvisors = state.world2.recruitedAdvisors || []
    const raiderEntry = Object.entries(agentsState)
      .filter(([npcId]) => !recruitedAdvisors.includes(npcId))
      .sort((a, b) => (b[1]?.aggression || 0) - (a[1]?.aggression || 0))[0]

    if (raiderEntry) {
      const [raiderId] = raiderEntry
      const raiderNpc = FINANCE_NPCS.find((n) => n.id === raiderId)
      const portfolio = state.world2.portfolio || {}
      const stocks = state.world2.stocks || []
      let biggestTicker = null
      let biggestValue = 0
      for (const [ticker, holding] of Object.entries(portfolio)) {
        const stock = stocks.find((s) => s.ticker === ticker)
        const value = stock ? stock.price * holding.shares : 0
        if (value > biggestValue) {
          biggestValue = value
          biggestTicker = ticker
        }
      }

      if (raiderNpc && biggestTicker) {
        const raidImpact = Math.round(1000 + Math.random() * 9000)
        const pct = Math.min(0.15, raidImpact / 60000)
        const stockName = stocks.find((s) => s.ticker === biggestTicker)?.name || biggestTicker
        set((s) => ({
          world2: {
            ...s.world2,
            stocks: s.world2.stocks.map((st) =>
              st.ticker === biggestTicker ? { ...st, price: Math.max(0.01, st.price * (1 - pct)) } : st
            ),
            agentEventFeed: [
              {
                id: `player_raid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                title: '⚔️ Titan Raid',
                text: `${raiderNpc.name} moved against your position in ${stockName}, hitting it for $${raidImpact.toLocaleString()}!`,
              },
              ...(s.world2.agentEventFeed || []),
            ].slice(0, 40),
          },
        }))
      }
    }
  },

  // Live, reversible win-condition check (NOT a sticky milestone) - always
  // re-evaluated against current net worth, so it can flip back to false if
  // net worth dips back under the target after crossing it. FINANCE_VICTORY_
  // TARGET ($10M) is a different constant from NET_WORTH_WIN_TARGET ($1B,
  // kept as the flavor-only "Ascend as a Titan of Industry" flex goal - see
  // StockExchangeModal.jsx).
  financeNetWorthWinMet: () => get().computeNetWorth() >= FINANCE_VICTORY_TARGET,

  clearWorld2: () => {
    get().clearBlock('finance')
  },

  // Daily passive income (real estate rent + company income) vs. a daily
  // "burn rate" - a flat cost-of-living plus scaling legal/security overhead
  // tied directly to Heat (wantedLevel), so a hotter player visibly bleeds
  // more cash per day. Pure selector, no state change - the header reads
  // this every render, and endDay() doesn't need to duplicate the math.
  recruitFinanceNpc: (npcId) => {
    const state = get()
    const npc = FINANCE_NPCS.find((n) => n.id === npcId)
    if (!npc) return { success: false, reason: 'NPC not found' }
    const recruited = state.world2.recruitedAdvisors || []
    if (recruited.includes(npcId)) return { success: false, reason: 'Already recruited to Syndicate Board' }
    // Simons and Buffett are the two strongest passive-income advisors
    // (Buffett's 5%-of-cash/day compounding perk in particular can blow past
    // every other balance number given enough free endDay() presses), so
    // both are gated behind the Titan Apprentice milestone ($5M net worth)
    // in addition to the usual cash check below.
    const milestones = state.world2.netWorthMilestones || []
    if ((npcId === 'simons' || npcId === 'buffett') && !milestones.includes('titan_apprentice')) {
      return { success: false, reason: 'Requires the Titan Apprentice milestone ($5,000,000 net worth)' }
    }
    if (state.cash < npc.recruitCost) return { success: false, reason: `Need $${npc.recruitCost.toLocaleString()} cash` }

    const newRecruited = [...recruited, npcId]
    set({
      cash: state.cash - npc.recruitCost,
      world2: { ...state.world2, recruitedAdvisors: newRecruited },
    })

    // Instant recruitment perks
    if (npcId === 'carnegie') {
      get().addCash(5000)
    } else if (npcId === 'son') {
      get().addCash(15000)
    } else if (npcId === 'walker') {
      set((s) => ({ reputation: Math.min(100, s.reputation + 20) }))
    } else if (npcId === 'musk') {
      // cryptoHype is a 0-1 scale everywhere else (tickFinanceMarket,
      // crypto-hype-buy) - this used to jump it on a 0-100 scale, which was
      // a bug (see endDay()'s cryptoHypeDelta fix below for the same class
      // of bug). +0.25 preserves the same relative jump size on the
      // correct scale.
      set((s) => ({ world2: { ...s.world2, cryptoHype: Math.min(1, s.world2.cryptoHype + 0.25) } }))
    }

    return { success: true }
  },

  getDailyFinanceIncome: () => {
    const state = get()
    const w2 = state.world2
    const recruited = w2.recruitedAdvisors || []

    let rentIncome = w2.realEstate.reduce((sum, id) => {
      const listing = REAL_ESTATE_LISTINGS.find((l) => l.id === id)
      return sum + (listing?.rentPerTick || 0)
    }, 0)
    let companyIncome = w2.companies.reduce((sum, id) => {
      const listing = COMPANY_LISTINGS.find((l) => l.id === id)
      return sum + (listing?.incomePerTick || 0)
    }, 0)

    if (recruited.includes('rockefeller')) {
      rentIncome = Math.round(rentIncome * 1.35)
      companyIncome = Math.round(companyIncome * 1.35)
    }

    let advisorPassive = 0
    if (recruited.includes('ford')) advisorPassive += 500
    if (recruited.includes('fugger')) advisorPassive += 800
    if (recruited.includes('vanderbilt')) advisorPassive += 600
    if (recruited.includes('simons')) advisorPassive += 1000
    if (recruited.includes('gates')) advisorPassive += 850
    if (recruited.includes('bezos')) advisorPassive += 1200
    if (recruited.includes('walker')) advisorPassive += 300
    if (recruited.includes('mansamusa')) advisorPassive += Math.round((rentIncome + companyIncome) * 0.25)
    if (recruited.includes('buffett')) advisorPassive += Math.round(state.cash * 0.05)

    const income = rentIncome + companyIncome + advisorPassive
    const burn = 100 + state.wantedLevel * 150
    return { income, burn, net: income - burn, advisorPassive }
  },

  endDay: () => {
    const state = get()
    const recruited = state.world2.recruitedAdvisors || []
    const nextDay = state.day + 1

    // Advance the character-presence clock by exactly one time block per End
    // Day press (the only time-advancing action this world has). Wrapping
    // Midnight -> Morning rolls worldClock.day over, so a full 5-block cycle
    // always completes within one worldClock day instead of spanning 5
    // presses of the (unrelated, unchanged) economic `day` counter below -
    // see the house-rule comment above createDefaultState() for why these
    // two counters are deliberately separate.
    const prevClock = state.worldClock || { day: 1, timeBlockIndex: 0 }
    let nextTimeBlockIndex = prevClock.timeBlockIndex + 1
    let nextClockDay = prevClock.day
    if (nextTimeBlockIndex >= TIME_BLOCKS.length) {
      nextTimeBlockIndex = 0
      nextClockDay += 1
    }
    const worldClock = { day: nextClockDay, timeBlockIndex: nextTimeBlockIndex }

    // Loan interest accrues once per day tick, at whatever rate the
    // player's *current* credit tier carries - a variable rate rather than
    // one locked in at borrow time, so climbing/falling reputation and
    // wantedLevel actually move the needle on existing debt, not just new
    // borrowing.
    const loanBalance = state.world2.loanBalance || 0
    const accruedLoanBalance = loanBalance > 0
      ? Math.round(loanBalance * (1 + get().loanTier().interestPerDay))
      : 0

    // A jailed player's energy stays pinned at 0 through this tick - the
    // normal "refill to max" reset below is exactly what a day in jail is
    // supposed to deny them. Read before the set() below overwrites jail.
    const wasJailed = !!(state.jail && state.jail.inJail)

    // Chapel Blessing expiry: compared against nextDay (the day this endDay
    // call rolls into), so "+3 Luck for 2 days" covers the day it was bought
    // plus one more full day before lapsing the following End Day press.
    const blessing = state.world2.templeBlessing
    const templeBlessing = blessing?.active && nextDay >= blessing.expiresOnDay
      ? { active: false, bonus: 3, expiresOnDay: null }
      : blessing || { active: false, bonus: 3, expiresOnDay: null }

    // Syndicate Standing decay: -1 per 3 days of zero interaction with a
    // syndicate, floor 0, only for syndicates currently above 0 (see
    // applyStandingDecayTick in syndicateStandingEngine.js). Ticks against
    // nextDay (the day this endDay() call is advancing INTO), same
    // convention templeBlessing's expiry check above uses.
    const syndicateStanding = applyStandingDecayTick(
      state.world2.syndicateStanding || {},
      state.world2.syndicateLastInteractionDay || {},
      nextDay
    )

    set({
      day: nextDay,
      worldClock,
      newsHeadline: rollHeadline(),
      player: { ...state.player, energy: wasJailed ? 0 : state.player.maxEnergy },
      world2: { ...state.world2, loanBalance: accruedLoanBalance, templeBlessing, syndicateStanding },
    })
    get().tickFinanceMarket()

    if (state.wantedLevel > 0 && Math.random() < 0.4) {
      get().addWantedLevel(-1)
    }

    // Notoriety cools down slowly every day
    if (state.notoriety > 0) {
      get().addNotoriety(-5)
    }

    // Jail: sentence ticks down once per End Day, and Heat cools by an
    // ADDITIONAL guaranteed point on top of the probabilistic wanted-level
    // decay above (jail time is meant to visibly work off Heat faster than
    // staying free does). Auto-releases at no cost once the sentence hits 0.
    if (wasJailed) {
      const jailState = state.jail
      get().addWantedLevel(-1)
      const sentenceDaysRemaining = jailState.sentenceDaysRemaining - 1
      set({
        jail: sentenceDaysRemaining <= 0
          ? { inJail: false, sentenceDaysRemaining: 0, bailCost: 0, bribeAttemptsToday: 0, mazeAttemptedToday: false, mazeProgress: 0 }
          : { ...jailState, sentenceDaysRemaining, bribeAttemptsToday: 0, mazeAttemptedToday: false, mazeProgress: 0 },
      })
    }

    if (recruited.includes('hamilton') && nextDay % 2 === 0 && state.wantedLevel > 0) {
      get().addWantedLevel(-1)
    }
    if (recruited.includes('jpmorgan') && state.cash < 500) {
      get().addCash(10000)
    }

    // Simulate multi-agent titan interactions
    const { updatedAgents, eventFeed } = simulateDailyAgentInteractions(state.world2.agentsState || {}, nextDay)

    // Deterministic mechanical fallout from this tick's raid/hype titan
    // events - no AI, no network, entirely derived from eventFeed above.
    // Alliance events stay narrative-only by design (no mechanical effect).
    const raidEvents = eventFeed.filter((e) => e.type === 'raid')
    const hypeEvents = eventFeed.filter((e) => e.type === 'hype')

    // Simulate Government, Fed, FTC, and Crime Syndicates
    const currentGov = state.world2.governmentState || initializeGovernmentState()
    const { updatedGovState, cashDelta, wantedDelta, cryptoHypeDelta } = simulateGovernmentDailyTick(
      currentGov,
      nextDay,
      state.cash,
      state.wantedLevel,
      state.world2.portfolio,
      state.world2.stocks
    )

    if (cashDelta !== 0) get().addCash(cashDelta)
    if (wantedDelta !== 0) get().addWantedLevel(wantedDelta)

    // Per-character heat for worldPresenceEngine.js's crime/fugitive logic:
    // reuse each crime syndicate's own heatLevel (0-2, see
    // governmentEngine.js's initializeGovernmentState) rather than inventing
    // a parallel per-character tracker, normalized to the engine's 0..1
    // scale. Every boss/underboss/capo inherits their syndicate's heat.
    const heatByCharacter = {}
    for (const syndicate of updatedGovState.crimeSyndicatesState || []) {
      const heat = Math.max(0, Math.min(1, (syndicate.heatLevel || 0) / 2))
      for (const role of ['boss', 'underboss', 'capo']) {
        if (syndicate[role]?.id) heatByCharacter[syndicate[role].id] = heat
      }
    }

    // Simulate 76-Agent Dynamic AI Routines & Locations. worldClock.day (not
    // the economic `nextDay` above) is the day dimension fed to the presence
    // engine - see the house-rule comment above createDefaultState().
    const masterAgents = state.world2.masterAgents || buildMasterAgentRegistry()
    const { updatedAgents: updatedMasterAgents } = simulateDynamicSchedules(masterAgents, worldClock.day, updatedGovState, {
      timeBlockIndex: worldClock.timeBlockIndex,
      runSeed: state.runSeed,
      wantedLevel: get().wantedLevel,
      heatByCharacter,
    })

    // Simulate Town Migration across 4 Japanese Cities
    const { updatedAgents: finalMigratedAgents, migrationLogs } = simulateTownMigration(
      updatedMasterAgents,
      nextDay,
      updatedGovState,
      state.wantedLevel
    )

    // Simulate 5 Expanded Government Agencies (IRS, SEC, FBI, DOD, EPA) -
    // moved above the Butterfly Effect trigger below (it used to run after)
    // so its agencyLogs are available to derive fbiRaided from real data.
    // Safe to move: this only reads state.cash/state.wantedLevel, neither of
    // which is affected by anything between its old and new call sites.
    const { agencyLogs, cashPenalty, wantedChange } = simulateExpandedAgenciesTick(nextDay, state.cash, state.wantedLevel)
    if (cashPenalty !== 0) get().addCash(-cashPenalty)
    if (wantedChange !== 0) get().addWantedLevel(wantedChange)

    // Trigger Butterfly Effect Chain Reactions - previously hardcoded to a
    // `{ type: 'FED_RATE_TICK' }` event that no branch in
    // butterflyEffectEngine.js ever matched (it only checks FED_RATE_HIKE/
    // FBI_RAID/BUFFETT_BUY), so this never fired once in any playthrough.
    // Now derives up to 3 real booleans from data already computed above/this
    // tick and fires once per true one, chaining `updatedAgents` from each
    // call into the next so effects compose instead of overwrite.
    const rateHiked = updatedGovState.interestRate > currentGov.interestRate
    const fbiRaided = agencyLogs.some((l) => l.agency === 'FBI')
    const buffettBought = eventFeed.some((e) => e.type === 'alliance' && e.actorId === 'buffett')

    let butterflyAgents = finalMigratedAgents
    let butterflyLogs = []
    if (rateHiked) {
      const res = triggerButterflyEffect({ type: 'FED_RATE_HIKE' }, butterflyAgents, nextDay)
      butterflyAgents = res.updatedAgents
      butterflyLogs = butterflyLogs.concat(res.butterflyLogs)
    }
    if (fbiRaided) {
      const res = triggerButterflyEffect({ type: 'FBI_RAID' }, butterflyAgents, nextDay)
      butterflyAgents = res.updatedAgents
      butterflyLogs = butterflyLogs.concat(res.butterflyLogs)
    }
    if (buffettBought) {
      const res = triggerButterflyEffect({ type: 'BUFFETT_BUY' }, butterflyAgents, nextDay)
      butterflyAgents = res.updatedAgents
      butterflyLogs = butterflyLogs.concat(res.butterflyLogs)
    }
    const finalButterflyAgents = butterflyAgents

    const subLogs = simulateSubdepartmentsTick(nextDay)
    const scotusLogs = simulateScotusJudicialReview(nextDay)
    const congressLogs = simulateCongressTick(nextDay)

    // Trigger Autonomous Capital Accumulation & Asset Purchasing
    const { updatedAgents: finalAssetAgents, assetLogs } = simulateAgentAssetPurchasing(finalButterflyAgents, nextDay)

    // Street intel on characters who are lying low: the same presenceCtx is
    // reused verbatim so the feed reports where the engine actually put them
    // this block, rather than rolling a second, possibly-contradictory
    // location. Characters who aren't discoverable this tick either yield a
    // vague no-location rumor or nothing at all, which is what keeps a
    // hiding character a hunt rather than a dead end.
    const intelLogs = generateIntelReports([], {
      day: worldClock.day,
      timeBlockIndex: worldClock.timeBlockIndex,
      runSeed: state.runSeed,
      wantedLevel: get().wantedLevel,
      heatByCharacter,
    })

    const combinedEventLogs = [
      ...intelLogs.map((i) => ({ id: i.id, title: i.title, text: i.text })),
      ...scotusLogs.map((s) => ({ id: s.id, title: s.title, text: s.text })),
      ...congressLogs.map((c) => ({ id: c.id, title: c.title, text: c.text })),
      ...assetLogs.map((a) => ({ id: a.id, title: '💰 Asset Acquisition', text: a.text })),
      ...butterflyLogs.map((b) => ({ id: b.id, title: '🦋 Butterfly Effect', text: b.text })),
      ...migrationLogs.map((m) => ({ id: m.id, title: '✈️ Town Migration', text: m.text })),
      ...eventFeed,
    ]

    const finalGovState = {
      ...updatedGovState,
      agencyLogs: [...scotusLogs, ...congressLogs, ...subLogs, ...agencyLogs, ...(updatedGovState.agencyLogs || [])].slice(0, 30),
    }

    set((s) => {
      // Raid events hit a random stock's price, scaled by the raid's dollar
      // impact (~$1,000-$9,000 per agentEngine.js), capped at a 15% hit so a
      // single raid can't zero out a stock. Reads s.world2.stocks (the
      // post-tickFinanceMarket value from earlier in this same endDay()
      // call) rather than the stale `state` captured at the top of endDay().
      let stocks = s.world2.stocks
      for (const raid of raidEvents) {
        if (!stocks.length) break
        const idx = Math.floor(Math.random() * stocks.length)
        const pct = Math.min(0.15, raid.raidImpact / 60000)
        stocks = stocks.map((st, i) => (i === idx ? { ...st, price: Math.max(0.01, st.price * (1 - pct)) } : st))
      }

      // cryptoHype is a 0-1 scale everywhere in this codebase
      // (tickFinanceMarket, crypto-hype-buy, the musk perk above). This used
      // to add cryptoHypeDelta (a flat "+3" from simulateGovernmentDailyTick,
      // meant as "+3 percentage points") on a 0-100 scale via
      // Math.min(100, ...), which silently overshot the real 0-1 field by
      // 300% on every Fed rate cut - dividing by 100 here fixes the scale
      // without touching governmentEngine.js's own units.
      let cryptoHype = Math.max(0, Math.min(1, s.world2.cryptoHype + cryptoHypeDelta / 100))
      // Hype events (agentEngine.js's hypeDelta is a 5-20 range, meant as
      // "+5% to +20%") nudge cryptoHype up the same way.
      for (const hype of hypeEvents) {
        cryptoHype = Math.min(1, cryptoHype + hype.hypeDelta / 100)
      }

      // Player market-sentiment post (see postToMarket()) resolves here,
      // exactly once, on the first End Day press after it was made. Compared
      // against `nextDay` (the day this endDay() call is advancing INTO)
      // rather than the `state.day` captured at function entry (which still
      // equals pendingPost.postedOnDay on that first press, since posting
      // only ever happens earlier on the SAME day this endDay() call started
      // on) - using state.day here would mean a post made today never
      // resolves on tomorrow's first End Day press (only the one after,
      // since postToMarket's own lastPostDay guard would have already let a
      // second post overwrite the still-pending first one by then). nextDay
      // is what actually delivers "resolves the day after you post, not the
      // instant you post" without silently dropping posts.
      let pendingPost = s.world2.pendingPost
      let postCounts = s.world2.postCounts || {}
      const postResolutionFeed = []
      if (pendingPost && pendingPost.postedOnDay < nextDay) {
        const { target, direction, pct } = pendingPost
        const isCrypto = target === 'CRYPTO'
        if (isCrypto) {
          cryptoHype = Math.max(0, Math.min(1, cryptoHype + (direction === 'up' ? pct : -pct)))
          postResolutionFeed.push({
            id: `post_resolve_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            title: '📈 Sentiment Shift',
            text: `${CRYPTO_NAME}'s speculative buzz ${direction === 'up' ? 'rose' : 'cooled'} following your post.`,
          })
        } else {
          const idx = stocks.findIndex((st) => st.ticker === target)
          if (idx !== -1) {
            const stock = stocks[idx]
            const newPrice = Math.max(0.01, stock.price * (1 + (direction === 'up' ? pct : -pct)))
            stocks = stocks.map((st, i) => (i === idx ? { ...st, price: newPrice } : st))
            postResolutionFeed.push({
              id: `post_resolve_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              title: '📈 Sentiment Shift',
              text: `${stock.name} moved ${(pct * 100).toFixed(1)}% following your post.`,
            })
          }
        }
        postCounts = { ...postCounts, [target]: (postCounts[target] || 0) + 1 }
        pendingPost = null
      }

      return {
        world2: {
          ...s.world2,
          stocks,
          agentsState: updatedAgents,
          agentEventFeed: [...postResolutionFeed, ...combinedEventLogs, ...(s.world2.agentEventFeed || [])].slice(0, 40),
          governmentState: finalGovState,
          masterAgents: finalAssetAgents,
          cryptoHype,
          pendingPost,
          postCounts,
        },
      }
    })

    // Net worth milestone ladder check - once per End Day press, after every
    // other cash/portfolio-affecting effect above has already landed, so it
    // reads a fully-settled computeNetWorth() for this tick.
    get().checkNetWorthMilestones()

    // Fire-and-forget AI narration for exactly one "flagship" event this
    // tick - never awaited, so endDay() above has already fully resolved
    // synchronously with today's templated text visible instantly. If/when
    // this resolves, it may swap that one feed entry's text for a richer
    // AI-generated line (see enrichEventNarration below); on any failure (no
    // key, network, timeout, bad response) generateEventNarration resolves
    // to null and nothing happens - the templated text already on screen
    // stands as final. This does not affect the mechanical effects above,
    // which are already fully applied and independent of this call.
    const titanEvents = eventFeed.filter((e) => e.type === 'raid' || e.type === 'hype' || e.type === 'alliance')
    if (titanEvents.length) {
      const flagship = [...raidEvents].sort((a, b) => b.raidImpact - a.raidImpact)[0] || titanEvents[0]
      const actorNpc = FINANCE_NPCS.find((n) => n.id === flagship.actorId)
      const targetNpc = FINANCE_NPCS.find((n) => n.id === flagship.targetId)
      const archetypeDescription = actorNpc ? ARCHETYPE_PROFILES[actorNpc.archetype]?.description : null
      const amount = flagship.type === 'raid' ? flagship.raidImpact : flagship.type === 'hype' ? flagship.hypeDelta : null

      generateEventNarration({
        type: flagship.type,
        actorName: actorNpc?.name,
        targetName: targetNpc?.name,
        amount,
        archetypeDescription,
        fallbackText: flagship.text,
      }).then((text) => {
        if (text) get().enrichEventNarration(flagship.id, text)
      })
    }
  },

  // Swaps one agentEventFeed entry's `text` for a richer AI-generated
  // version (see aiNarrator.js / endDay()'s fire-and-forget call), if that
  // entry is still present - a slow response may arrive after the 40-entry
  // feed has already trimmed it off, in which case this is a silent no-op
  // (nothing else in the game depends on this entry; it's a pure narration
  // upgrade, never load-bearing for any mechanic).
  enrichEventNarration: (eventId, newText) => {
    set((s) => {
      const feed = s.world2.agentEventFeed || []
      const idx = feed.findIndex((e) => e.id === eventId)
      if (idx === -1) return {}
      const nextFeed = [...feed]
      nextFeed[idx] = { ...nextFeed[idx], text: newText }
      return { world2: { ...s.world2, agentEventFeed: nextFeed } }
    })
  },

  // Exposes the store's worldClock as the { index, key, label } shape UI
  // code actually wants, so callers don't need to know about
  // worldPresenceEngine.js's TIME_BLOCKS array themselves.
  getCurrentTimeBlock: () => {
    const worldClock = get().worldClock || { day: 1, timeBlockIndex: 0 }
    const block = TIME_BLOCKS[worldClock.timeBlockIndex] || TIME_BLOCKS[0]
    return { index: worldClock.timeBlockIndex, day: worldClock.day, key: block.key, label: block.label }
  },

  buyBondsAction: (amount) => {
    const state = get()
    const currentTreasury = state.world2.treasuryState || initializeTreasuryState()
    const res = buyTreasuryBonds(currentTreasury, amount, state.cash)
    if (res.success) {
      get().addCash(-amount)
      set((s) => ({
        world2: {
          ...s.world2,
          treasuryState: res.updatedTreasuryState,
        },
      }))
    }
    return res
  },

  setRomanceState: (updatedRomance) => {
    set((s) => ({
      world2: {
        ...s.world2,
        romanceState: updatedRomance,
      },
    }))
  },

  setVehicle: (vehicleName, speedMultiplier) => {
    const state = get()
    const currentTransit = state.world2.transitState || initializeTransportationState()
    const updatedTransit = purchaseVehicle(currentTransit, vehicleName, 0, speedMultiplier)
    set((s) => ({
      world2: {
        ...s.world2,
        transitState: updatedTransit,
      },
    }))
  },

  // Player-owned/drivable vehicles - separate from currentVehicle/
  // speedMultiplier above (the pre-existing rent/buy flow's fields).
  // Dedup by tierId so re-buying or re-stealing the same car tier is a
  // no-op instead of cluttering the list with duplicates.
  addOwnedVehicle: (vehicle) => {
    const state = get()
    const currentTransit = state.world2.transitState || initializeTransportationState()
    const owned = currentTransit.ownedVehicles || []
    if (owned.some((v) => v.tierId === vehicle.tierId)) return
    set((s) => ({
      world2: {
        ...s.world2,
        transitState: { ...currentTransit, ownedVehicles: [...owned, vehicle] },
      },
    }))
  },

  // Persists exactly where an owned vehicle was last parked (col/row), so
  // OverworldScene.spawnWorldVehicles can put it back in that EXACT spot on
  // the next 'overworld' load instead of an approximate "near the station"
  // guess - reported by the user: a stolen/bought car should stay wherever
  // it was left, not teleport, unless something else in the game actually
  // takes it (no such mechanic exists yet, so today that means "never,
  // until the player moves it again"). No-op if the tierId isn't owned
  // (e.g. a stray call racing a sale/repossession that hasn't landed yet).
  updateOwnedVehiclePosition: (tierId, col, row) => {
    const state = get()
    const currentTransit = state.world2.transitState || initializeTransportationState()
    const owned = currentTransit.ownedVehicles || []
    const idx = owned.findIndex((v) => v.tierId === tierId)
    if (idx === -1) return
    const updated = owned.slice()
    updated[idx] = { ...updated[idx], col, row }
    set((s) => ({
      world2: {
        ...s.world2,
        transitState: { ...currentTransit, ownedVehicles: updated },
      },
    }))
  },

  setDriving: (isDriving) => {
    const state = get()
    const currentTransit = state.world2.transitState || initializeTransportationState()
    set((s) => ({
      world2: {
        ...s.world2,
        transitState: { ...currentTransit, isDriving },
      },
    }))
  },

  // Car theft: reuses executeCrime's success-roll/fail-consequence pattern
  // (same one every other crime action in this store goes through) instead
  // of a bespoke RNG. payout is always 0 for both methods - the reward is
  // the car itself (addOwnedVehicle on success), not cash.
  stealVehicle: ({ method, vehicle }) => {
    const state = get()
    if (method === 'equipment') {
      // Slim Jim (THEFT_ITEM, src/game/vehicleGen.js) is a reusable tool,
      // not a consumable - it's never removed from inventory on use, so one
      // purchase covers every future equipment-method attempt.
      const hasTool = state.inventory.some((i) => i.id === 'slim_jim')
      if (!hasTool) return { success: false, reason: 'need tool' }
      const result = get().executeCrime({
        type: 'vehicleTheftEquipment',
        baseSuccessChance: 0.75,
        payout: 0,
        notorietyIncreaseOnFail: 5,
        wantedIncreaseOnFail: 1,
        energyCost: 10,
        assetSeizureOnFail: 0,
        jailChanceOnFail: 0.10,
        // Standing next to a physical parked car in the overworld - same
        // witness gate as mugging, no victim NPC to exclude here.
        checkWitnesses: true,
      })
      if (result.success) {
        get().addOwnedVehicle(vehicle)
        return { ...result, vehicle }
      }
      return result
    }

    // 'smash': smash-and-hotwire, no tool needed, meaningfully louder/
    // hotter than the equipment method on failure.
    const result = get().executeCrime({
      type: 'vehicleTheftSmash',
      baseSuccessChance: 0.45,
      payout: 0,
      notorietyIncreaseOnFail: 15,
      wantedIncreaseOnFail: 3,
      energyCost: 15,
      assetSeizureOnFail: 0,
      jailChanceOnFail: 0.20,
      checkWitnesses: true,
    })
    if (result.success) {
      get().addOwnedVehicle(vehicle)
      return { ...result, vehicle }
    }
    return result
  },

  castPresidentialVote: (candidateId) => {
    const state = get()
    const currentGov = state.world2.governmentState || initializeGovernmentState()
    const updatedGov = resolvePresidentialElection(currentGov, candidateId)
    set((s) => ({
      world2: {
        ...s.world2,
        governmentState: updatedGov,
      },
    }))
  },

  triggerElection: () => {
    const state = get()
    const currentGov = state.world2.governmentState || initializeGovernmentState()
    const updatedGov = triggerPresidentialElection(currentGov)
    set((s) => ({
      world2: {
        ...s.world2,
        governmentState: updatedGov,
      },
    }))
  },

  // --- World 3: King of Games ----------------------------------------------

  addCardsToDeck: (cards) =>
    set((state) => ({ world3: { ...state.world3, deck: [...state.world3.deck, ...cards] } })),

  removeCardFromDeck: (cardId) =>
    set((state) => ({
      world3: { ...state.world3, deck: state.world3.deck.filter((c) => c.id !== cardId) },
    })),

  buyBoosterPack: (cost, cards) => {
    const state = get()
    if (state.cash < cost) return false
    set({ cash: state.cash - cost })
    get().addCardsToDeck(cards)
    return true
  },

  buyKaibaCorp: (cost) => {
    const state = get()
    if (state.cash < cost || state.world3.ownsKaibaCorp) return false
    set({ cash: state.cash - cost, world3: { ...state.world3, ownsKaibaCorp: true } })
    return true
  },

  advanceTeaRelationship: (amount) =>
    set((state) => ({
      world3: { ...state.world3, teaRelationship: Math.min(100, state.world3.teaRelationship + amount) },
    })),

  marryTea: () =>
    set((state) => ({
      world3: { ...state.world3, teaMarried: true, yugiBrokenHeart: true },
    })),

  toggleKidnapNpc: (npcId, kidnapped) =>
    set((state) => ({
      world3: {
        ...state.world3,
        kidnappedNpcs: kidnapped
          ? [...new Set([...state.world3.kidnappedNpcs, npcId])]
          : state.world3.kidnappedNpcs.filter((id) => id !== npcId),
      },
    })),

  setTahTyrantSummoned: () =>
    set((state) => ({ world3: { ...state.world3, tahTyrantSummoned: true } })),

  setCynnRelationship: (status) =>
    set((state) => ({ world3: { ...state.world3, cynnRelationship: status } })),

  recordCynnDuelWin: () =>
    set((state) => ({ world3: { ...state.world3, cynnDuelsWon: state.world3.cynnDuelsWon + 1 } })),

  // Mirrors getPackUnlocks' milestone-threshold pattern (world4): the Card
  // Shop's pack tier climbs with world3 progress instead of being stuck at
  // tier 2 forever. Card power scales roughly as tier*400, so this needs to
  // reach tier ~6-7 for the shop to be able to produce cards competitive
  // with Yugi's 3000-ATK Blue-Eyes by the time the player is ready to duel
  // him seriously.
  getCardShopTier: () => {
    const w3 = get().world3
    const packsBought = w3.deck.length
    let tier = 2
    if (w3.cynnDuelsWon >= 1 || packsBought >= 6) tier = 3
    if (w3.ownsKaibaCorp || packsBought >= 12) tier = 4
    if (w3.cynnDuelsWon >= 3 || packsBought >= 18) tier = 5
    if (w3.teaMarried || packsBought >= 24) tier = 6
    if (packsBought >= 30) tier = 7
    return tier
  },

  clearWorld3: () => {
    set((state) => ({ world3: { ...state.world3, yugiDefeated: true } }))
    get().clearBlock('yugioh')
  },

  // --- World 4: Domino City (day/night calendar + duel economy) ------------

  setDominoZone: (zoneId) => set((state) => ({ world4: { ...state.world4, currentZone: zoneId } })),

  // Advances the calendar by N Time Blocks, rolling Day over at Night->
  // Morning and Week over at Sunday->Monday, per the GDD's Module 2.
  advanceTimeBlocks: (count) => {
    set((state) => {
      let { day, timeBlock, week } = state.world4.calendar
      for (let i = 0; i < count; i++) {
        timeBlock += 1
        if (timeBlock > 4) {
          timeBlock = 1
          day += 1
          if (day > 7) {
            day = 1
            week += 1
          }
        }
      }
      return { world4: { ...state.world4, calendar: { day, timeBlock, week } } }
    })
  },

  // "Sleep until Tomorrow Morning / this Evening / etc." - computes the
  // number of Time Blocks between now and the target block (always moving
  // forward, rolling into the next day if the target is at/before now).
  restUntilTimeBlock: (targetBlock) => {
    const state = get()
    const current = state.world4.calendar.timeBlock
    const blocksNeeded = targetBlock > current ? targetBlock - current : 4 - current + targetBlock
    get().advanceTimeBlocks(blocksNeeded || 4)
  },

  isDominoWeekend: () => {
    const day = get().world4.calendar.day
    return day === 6 || day === 7
  },

  // Completing a duel (win or lose) always advances the clock by 1 Time
  // Block, per Module 2.3.
  recordDominoDuelResult: ({ won, tier, quickVictory = false, flawless = false }) => {
    const state = get()
    const dp = won
      ? (tier <= 2 ? 100 : tier <= 4 ? 150 : 200) + (quickVictory ? 50 : 0) + (flawless ? 50 : 0)
      : 10
    const winsByTier = { ...state.world4.winsByTier }
    if (won) winsByTier[tier] = (winsByTier[tier] || 0) + 1
    // DP is a separate currency from cash, deliberately not merged.
    set({
      world4: {
        ...state.world4,
        dp: state.world4.dp + dp,
        totalWins: state.world4.totalWins + (won ? 1 : 0),
        winsByTier,
      },
    })
    get().advanceTimeBlocks(1)
    return dp
  },

  recordTier4Defeat: (npcId) =>
    set((state) => ({
      world4: {
        ...state.world4,
        tier4Defeated: state.world4.tier4Defeated.includes(npcId) ? state.world4.tier4Defeated : [...state.world4.tier4Defeated, npcId],
      },
    })),

  getPackUnlocks: () => {
    const w4 = get().world4
    return {
      beginner: true,
      advanced: w4.totalWins >= 10,
      expert: w4.tier4Defeated.length >= 3,
      tournamentPass: w4.totalWins >= 15,
    }
  },

  buyDominoPack: (cost, cardIds) => {
    const state = get()
    if (state.world4.dp < cost) return false
    set({ world4: { ...state.world4, dp: state.world4.dp - cost, trunk: [...state.world4.trunk, ...cardIds] } })
    return true
  },

  buyTournamentPass: () => {
    const state = get()
    const cost = 1000
    if (state.world4.dp < cost || state.world4.tournamentPassOwned) return false
    set({ world4: { ...state.world4, dp: state.world4.dp - cost, tournamentPassOwned: true } })
    return true
  },

  setDominoDeck: (cardIds) => set((state) => ({ world4: { ...state.world4, deck: cardIds } })),

  saveGame: () => {
    const state = get()
    const { screen, player, inventory, cash, wantedLevel, notoriety, jail, day, runSeed, worldClock, reputation, shadowMonarch, blocks, currentBlockId, world1, world2, world3, world4 } = state
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ screen: screen === 'world' ? 'world' : screen, player, inventory, cash, wantedLevel, notoriety, jail, day, runSeed, worldClock, reputation, shadowMonarch, blocks, currentBlockId, world1, world2, world3, world4 })
    )
  },

  hasSaveGame: () => localStorage.getItem(SAVE_KEY) !== null,

  loadGame: () => {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return false
    const saved = JSON.parse(raw)
    // Always true regardless of what (if anything) the save file itself
    // has for this field - resuming a save should never show the
    // new-game intro, including saves made before this field existed.
    set({ ...saved, hasSeenIntro: true })
    return true
  },
}))
