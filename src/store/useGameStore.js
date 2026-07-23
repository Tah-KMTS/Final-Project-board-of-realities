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
} from '../features/finance/marketData'
import { FINANCE_NPCS } from '../features/finance/financeNpcs'
import { rollHeadline } from '../features/finance/newsHeadlines'
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

// world4.calendar: Time Block 1=Morning, 2=Afternoon, 3=Evening, 4=Night.
// Day 1=Monday..7=Sunday. Display names live in the domino UI components.

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
      stats: { STR: 5, AGI: 5, INT: 5, VIT: 5, PER: 5 },
      unallocatedPoints: 0,
      hp: 100,
      maxHp: 100,
      alive: true,
      professionId: null,
    },
    inventory: [],
    cash: 100,
    wantedLevel: 0,
    // Capital Syndicate core loop: a persistent day counter (advanced by the
    // "End Day" button), a rolling flavor headline, and Public Reputation/
    // Social Status (0-100). Police Heat/SEC Suspicion is deliberately NOT a
    // new field here - it's wantedLevel (already 0-5) read as a percentage,
    // per the brief's instruction to reuse the existing Wanted Level system
    // rather than build a parallel one.
    day: 1,
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
      cryptoPrice: CRYPTO_BASE_PRICE,
      cryptoHype: 0,
      cryptoHoldings: 0,
      realEstate: [],
      companies: [],
      npcStatus: {},
      ambientKillCount: 0,
      jobCooldownUntil: 0,
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
      const uncleared = blocks.filter((b) => !b.cleared)
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

  workShift: () => {
    const state = get()
    if (Date.now() < state.world2.jobCooldownUntil) return false
    set({
      cash: state.cash + 200,
      world2: { ...state.world2, jobCooldownUntil: Date.now() + 20000 },
    })
    return true
  },

  financeNpcAction: (npcId, action) => {
    const state = get()
    const npc = FINANCE_NPCS.find((n) => n.id === npcId)
    if (!npc) return
    const status = state.world2.npcStatus[npcId] || 'alive'
    if (status === 'dead') return

    if (action === 'workFor') {
      get().addCash(300)
    } else if (action === 'collude') {
      get().addCash(2000)
      get().addWantedLevel(1)
    } else if (action === 'mug') {
      get().addCash(1500)
      get().addWantedLevel(2)
    } else if (action === 'extort') {
      get().addCash(5000)
      get().addWantedLevel(3)
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
    return state.cash + stockValue + cryptoValue
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
  getDailyFinanceIncome: () => {
    const state = get()
    const w2 = state.world2
    const rentIncome = w2.realEstate.reduce((sum, id) => {
      const listing = REAL_ESTATE_LISTINGS.find((l) => l.id === id)
      return sum + (listing?.rentPerTick || 0)
    }, 0)
    const companyIncome = w2.companies.reduce((sum, id) => {
      const listing = COMPANY_LISTINGS.find((l) => l.id === id)
      return sum + (listing?.incomePerTick || 0)
    }, 0)
    const income = rentIncome + companyIncome
    const burn = 100 + state.wantedLevel * 150
    return { income, burn, net: income - burn }
  },

  // The "End Day" button: advances the persistent Day Counter, rolls a
  // flavor news headline, ticks the market (reusing tickFinanceMarket
  // rather than duplicating its price-walk/passive-income logic), and lets
  // Heat cool down a little day-over-day if the player didn't stay hot -
  // the closest thing to "NPC/police behavior" this pass needs, built
  // entirely on the existing Wanted Level mechanic.
  endDay: () => {
    const state = get()
    set({ day: state.day + 1, newsHeadline: rollHeadline() })
    get().tickFinanceMarket()
    if (state.wantedLevel > 0 && Math.random() < 0.4) {
      get().addWantedLevel(-1)
    }
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
    const { screen, player, inventory, cash, wantedLevel, day, reputation, shadowMonarch, blocks, currentBlockId, world1, world2, world3, world4 } = state
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ screen: screen === 'world' ? 'world' : screen, player, inventory, cash, wantedLevel, day, reputation, shadowMonarch, blocks, currentBlockId, world1, world2, world3, world4 })
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
