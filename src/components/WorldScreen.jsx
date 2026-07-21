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
import StockExchangeModal from '../features/finance/StockExchangeModal'
import BankModal from '../features/finance/BankModal'
import CorporateModal from '../features/finance/CorporateModal'
import CryptoModal from '../features/finance/CryptoModal'
import NamedNpcModal from '../features/finance/NamedNpcModal'
import AmbientNpcModal from '../features/finance/AmbientNpcModal'
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
            : 'You are teleported to a new, uncleared block. Everything you own carries over.'}
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

  const bridgeRef = useRef(createEventBridge())
  const [activeModal, setActiveModal] = useState(null)
  const [worldCleared, setWorldCleared] = useState(null)
  const prevBlockIdRef = useRef(currentBlockId)

  const currentBlock = blocks.find((b) => b.id === currentBlockId)

  useEffect(() => {
    assignStartingProfession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Detects ANY block-clear transition (explicit victory buttons, or the
  // store's own autonomous triggers like Sole Survivor) and surfaces it,
  // instead of every world's win handler needing to remember to show this.
  useEffect(() => {
    if (prevBlockIdRef.current !== currentBlockId) {
      const clearedBlock = blocks.find((b) => b.id === prevBlockIdRef.current)
      if (clearedBlock) setWorldCleared({ name: clearedBlock.name })
      prevBlockIdRef.current = currentBlockId
    }
  }, [currentBlockId, blocks])

  useEffect(() => {
    const bridge = bridgeRef.current
    const offInteract = bridge.on('interact', (payload) => setActiveModal(payload))
    const offCriminal = bridge.on('criminalEncounter', () =>
      setActiveModal({ type: 'criminalEncounter' })
    )
    const offPolice = bridge.on('policeEncounter', (payload) =>
      setActiveModal({ type: 'policeEncounter', ...payload })
    )
    const offFinancePolice = bridge.on('financePoliceEncounter', (payload) =>
      setActiveModal({ type: 'financePoliceEncounter', ...payload })
    )
    return () => {
      offInteract()
      offCriminal()
      offPolice()
      offFinancePolice()
    }
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
        <div className="text-gray-400">{currentBlock?.name}</div>
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

      {!worldCleared && <GameCanvas blockId={currentBlockId} bridge={bridgeRef.current} />}

      <p className="text-xs text-gray-500">
        Move with WASD/Arrows • E to interact{currentBlockId === 'hunter' ? ' • R to commit crime' : ''}
      </p>

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
