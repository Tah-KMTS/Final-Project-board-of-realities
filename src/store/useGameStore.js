import { create } from 'zustand'
import {
  rollStartingProfession,
  rankForExp,
  rollShadowMonarchCondition,
  getShadowMonarchCondition,
} from '../features/hunter/professions'
import {
  STOCKS,
  CRYPTO_BASE_PRICE,
  randomWalk,
  NET_WORTH_WIN_TARGET,
  REAL_ESTATE_LISTINGS,
  COMPANY_LISTINGS,
} from '../features/finance/marketData'
import { FINANCE_NPCS } from '../features/finance/financeNpcs'

const SAVE_KEY = 'board-of-realities-save'
export const FINANCE_AMBIENT_NPC_COUNT = 8
const FINANCE_TOTAL_NPCS = FINANCE_NPCS.length + FINANCE_AMBIENT_NPC_COUNT

const BLOCKS = [
  { id: 'hunter', name: "The Hunter's Rift", difficulty: 8, survivalRate: 20 },
  { id: 'finance', name: 'Financial Anarchy', difficulty: 5, survivalRate: 55 },
  { id: 'yugioh', name: 'King of Games', difficulty: 4, survivalRate: 65 },
]

function rollD6() {
  return 1 + Math.floor(Math.random() * 6)
}

function createDefaultState() {
  return {
    screen: 'welcome', // welcome | characterCreator | diceRoll | world
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
    shadowMonarch: { unlocked: false, used: false, conditionId: null },
    blocks: BLOCKS.map((b) => ({ ...b, cleared: false })),
    currentBlockId: null,
    diceRoll: null,
    world1: {
      hunterRank: 'E',
      married: false,
      marriageCandidateMet: false,
      children: 0,
      hasSpringOfNazarick: false,
      finalRaidUnlocked: false,
      professionAssigned: false,
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
      tahRpsVetoAvailable: false,
      tahTyrantSummoned: false,
      cynnRelationship: 'neutral',
      cynnDuelsWon: 0,
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

  startNewGame: (playerConfig) => {
    const fresh = createDefaultState()
    set({
      ...fresh,
      player: { ...fresh.player, ...playerConfig },
      shadowMonarch: { ...fresh.shadowMonarch, conditionId: rollShadowMonarchCondition() },
      screen: 'diceRoll',
    })
  },

  rollStartingBlock: () => {
    const die1 = rollD6()
    const die2 = rollD6()
    const total = die1 + die2
    const state = get()
    const uncleared = state.blocks.filter((b) => !b.cleared)
    const index = (total - 2) % uncleared.length
    const chosenBlock = uncleared[index]
    set({
      diceRoll: { die1, die2, total },
      currentBlockId: chosenBlock.id,
    })
    return chosenBlock
  },

  enterWorld: () => set({ screen: 'world' }),

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

  addItem: (item) =>
    set((state) => ({ inventory: [...state.inventory, item] })),

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

  completePoomQuest: (itemId) => {
    const state = get()
    set({
      inventory: [...state.inventory, { id: itemId }],
      world1: { ...state.world1, poomQuestComplete: true, poomRewardItemId: itemId },
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

  buyStock: (ticker, shares) => {
    const state = get()
    const stock = state.world2.stocks.find((s) => s.ticker === ticker)
    if (!stock) return false
    const cost = stock.price * shares
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

  sellStock: (ticker, shares) => {
    const state = get()
    const stock = state.world2.stocks.find((s) => s.ticker === ticker)
    const holding = state.world2.portfolio[ticker]
    if (!stock || !holding || holding.shares < shares) return false
    const proceeds = stock.price * shares
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

  setTahRpsVeto: (available) =>
    set((state) => ({ world3: { ...state.world3, tahRpsVetoAvailable: available } })),

  setTahTyrantSummoned: () =>
    set((state) => ({ world3: { ...state.world3, tahTyrantSummoned: true } })),

  setCynnRelationship: (status) =>
    set((state) => ({ world3: { ...state.world3, cynnRelationship: status } })),

  recordCynnDuelWin: () =>
    set((state) => ({ world3: { ...state.world3, cynnDuelsWon: state.world3.cynnDuelsWon + 1 } })),

  clearWorld3: () => {
    set((state) => ({ world3: { ...state.world3, yugiDefeated: true } }))
    get().clearBlock('yugioh')
  },

  saveGame: () => {
    const state = get()
    const { screen, player, inventory, cash, wantedLevel, shadowMonarch, blocks, currentBlockId, world1, world2, world3 } = state
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ screen: screen === 'world' ? 'world' : screen, player, inventory, cash, wantedLevel, shadowMonarch, blocks, currentBlockId, world1, world2, world3 })
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
