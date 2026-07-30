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
  randomWalk,
  NET_WORTH_WIN_TARGET,
  REAL_ESTATE_LISTINGS,
  COMPANY_LISTINGS,
  JOB_TIERS,
  JOB_ENERGY_COST,
  LOAN_TIERS,
} from '../features/finance/marketData'
import { FINANCE_NPCS } from '../features/finance/financeNpcs'
import { rollHeadline } from '../features/finance/newsHeadlines'
import { initializeAgentsState, simulateDailyAgentInteractions } from '../features/finance/agentEngine'
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

function createDefaultState() {
  return {
    screen: 'welcome', // welcome | world | gameOver
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
    cash: 100,
    wantedLevel: 0,
    notoriety: 0, // 0-100 stat for crime visibility
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
      realEstate: [],
      companies: [],
      npcStatus: {},
      ambientKillCount: 0,
      // bankedAmount is a protected sub-bucket of `cash`, not a separate
      // pool - deposit/withdraw move value in and out of it. loanBalance is
      // real debt, added to cash when borrowed and accruing interest each
      // endDay() tick until repaid.
      bankedAmount: 0,
      loanBalance: 0,
      recruitedAdvisors: [],
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
    if (state.player.energy < amount) return false
    set({ player: { ...state.player, energy: state.player.energy - amount } })
    return true
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
    if (cryptoHype > 0 && Math.random() < cryptoHype * 0.15) {
      cryptoPrice = CRYPTO_BASE_PRICE
      cryptoHype = 0
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

  buyRealEstate: (listing) => {
    const state = get()
    if (state.cash < listing.price || state.world2.realEstate.includes(listing.id)) return false
    set({
      cash: state.cash - listing.price,
      world2: { ...state.world2, realEstate: [...state.world2.realEstate, listing.id] },
    })
    return true
  },

  buyCompany: (listing) => {
    const state = get()
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
    const score = get().creditScore()
    return LOAN_TIERS.find((t) => score >= t.minCreditScore) || LOAN_TIERS[LOAN_TIERS.length - 1]
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

  executeCrime: ({ type, baseSuccessChance, payout, notorietyIncreaseOnFail, wantedIncreaseOnFail, energyCost, assetSeizureOnFail }) => {
    const state = get()
    if (!state.spendEnergy(energyCost)) return { success: false, reason: 'Not enough energy' }

    // Streetwise increases success chance, Notoriety decreases it.
    const streetwise = state.player.stats.streetwise || 5
    const successProb = baseSuccessChance + (streetwise * 0.02) - (state.notoriety * 0.002)
    const clampedProb = Math.max(0.05, Math.min(0.95, successProb))

    const isSuccess = Math.random() < clampedProb

    if (isSuccess) {
      state.addCash(payout)
      return { success: true, payout, message: `Success! You got away with $${payout.toLocaleString()}.` }
    } else {
      let failMsg = 'You were caught!'
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
      return { success: false, fine, message: failMsg }
    }
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
        assetSeizureOnFail: 0
      })
    } else if (action === 'extort') {
      get().executeCrime({
        type: 'extort',
        baseSuccessChance: 0.5,
        payout: 5000,
        notorietyIncreaseOnFail: 20,
        wantedIncreaseOnFail: 4,
        energyCost: 0, // already spent in financeNpcAction check
        assetSeizureOnFail: 0
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

  financeNetWorthWinMet: () => get().computeNetWorth() >= NET_WORTH_WIN_TARGET,

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
      set((s) => ({ world2: { ...s.world2, cryptoHype: Math.min(100, s.world2.cryptoHype + 25) } }))
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

    set({
      day: nextDay,
      worldClock,
      newsHeadline: rollHeadline(),
      player: { ...state.player, energy: state.player.maxEnergy },
      world2: { ...state.world2, loanBalance: accruedLoanBalance },
    })
    get().tickFinanceMarket()

    if (state.wantedLevel > 0 && Math.random() < 0.4) {
      get().addWantedLevel(-1)
    }
    
    // Notoriety cools down slowly every day
    if (state.notoriety > 0) {
      get().addNotoriety(-5)
    }

    if (recruited.includes('hamilton') && nextDay % 2 === 0 && state.wantedLevel > 0) {
      get().addWantedLevel(-1)
    }
    if (recruited.includes('jpmorgan') && state.cash < 500) {
      get().addCash(10000)
    }

    // Simulate multi-agent titan interactions
    const { updatedAgents, eventFeed } = simulateDailyAgentInteractions(state.world2.agentsState || {}, nextDay)
    
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

    // Trigger Butterfly Effect Chain Reactions
    const { updatedAgents: finalButterflyAgents, butterflyLogs } = triggerButterflyEffect(
      { type: 'FED_RATE_TICK' },
      finalMigratedAgents,
      nextDay
    )

    // Simulate 5 Expanded Government Agencies (IRS, SEC, FBI, DOD, EPA) & Subdepartments
    const { agencyLogs, cashPenalty, wantedChange } = simulateExpandedAgenciesTick(nextDay, state.cash, state.wantedLevel)
    const subLogs = simulateSubdepartmentsTick(nextDay)
    const scotusLogs = simulateScotusJudicialReview(nextDay)
    const congressLogs = simulateCongressTick(nextDay)

    if (cashPenalty !== 0) get().addCash(-cashPenalty)
    if (wantedChange !== 0) get().addWantedLevel(wantedChange)

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

    set((s) => ({
      world2: {
        ...s.world2,
        agentsState: updatedAgents,
        agentEventFeed: [...combinedEventLogs, ...(s.world2.agentEventFeed || [])].slice(0, 40),
        governmentState: finalGovState,
        masterAgents: finalAssetAgents,
        cryptoHype: Math.max(0, Math.min(100, s.world2.cryptoHype + cryptoHypeDelta)),
      },
    }))
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
    const { screen, player, inventory, cash, wantedLevel, day, runSeed, worldClock, reputation, shadowMonarch, blocks, currentBlockId, world1, world2, world3, world4 } = state
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ screen: screen === 'world' ? 'world' : screen, player, inventory, cash, wantedLevel, day, runSeed, worldClock, reputation, shadowMonarch, blocks, currentBlockId, world1, world2, world3, world4 })
    )
  },

  hasSaveGame: () => localStorage.getItem(SAVE_KEY) !== null,

  loadGame: () => {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return false
    const saved = JSON.parse(raw)
    set({ ...saved })
    return true
  },
}))
