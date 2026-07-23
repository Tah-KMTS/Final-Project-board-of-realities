import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { getFinanceNpc } from './financeNpcs'
import DialogueBox from '../../components/Dialogue/DialogueBox'
import { FINANCE_NPC_LINES } from '../../data/financeDialogue'

export default function NamedNpcModal({ npcId, onClose, onAttack }) {
  const world2 = useGameStore((s) => s.world2)
  const cash = useGameStore((s) => s.cash)
  const financeNpcAction = useGameStore((s) => s.financeNpcAction)
  const recruitFinanceNpc = useGameStore((s) => s.recruitFinanceNpc)
  const [recruitMsg, setRecruitMsg] = useState(null)

  const npc = getFinanceNpc(npcId)
  const isDead = world2.npcStatus[npcId] === 'dead'
  const isRecruited = (world2.recruitedAdvisors || []).includes(npcId)
  const agentState = (world2.agentsState || {})[npcId] || {}
  const rivalNpc = getFinanceNpc(agentState.rivalId)

  const [dialogueDone, setDialogueDone] = useState(false)
  const npcLines = FINANCE_NPC_LINES[npcId]

  if (!npc) return null

  const handleRecruit = () => {
    const res = recruitFinanceNpc(npcId)
    if (res.success) {
      setRecruitMsg(`Successfully recruited ${npc.name} to your Board of Realities!`)
    } else {
      setRecruitMsg(res.reason)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg border-4 border-yellow-500/70 bg-[#121429] p-6 font-mono text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-700 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-yellow-900/60 px-2 py-0.5 text-xs text-yellow-300 font-semibold">{npc.era || 'Titan'}</span>
              <h2 className="text-xl font-bold text-yellow-400">{npc.name}</h2>
            </div>
            <p className="mt-1 text-xs text-gray-300">"{npc.title}" • Net worth: ${npc.netWorth.toLocaleString()}</p>
          </div>
          {isRecruited && (
            <span className="rounded bg-emerald-900/80 px-2 py-1 text-xs font-bold text-emerald-300 border border-emerald-500">
              ✓ BOARD MEMBER
            </span>
          )}
        </div>

        {/* Dynamic Procedural Agent Intelligence */}
        {agentState.currentMood && (
          <div className="my-3 grid grid-cols-2 gap-2 rounded border border-indigo-500/40 bg-[#1a1d3d] p-2.5 text-xs">
            <div>
              <span className="text-gray-400">Current Strategy Mood:</span>{' '}
              <b className="text-cyan-300">{agentState.currentMood}</b>
            </div>
            <div>
              <span className="text-gray-400">Primary Rival:</span>{' '}
              <b className="text-red-400">{rivalNpc ? rivalNpc.name : 'None'}</b>
            </div>
            <div>
              <span className="text-gray-400">Aggression Score:</span>{' '}
              <b className="text-orange-400">{Math.round((agentState.aggression || 0.5) * 100)}%</b>
            </div>
            <div>
              <span className="text-gray-400">Risk Tolerance:</span>{' '}
              <b className="text-purple-300">{Math.round((agentState.riskTolerance || 0.5) * 100)}%</b>
            </div>
          </div>
        )}

        {/* Unique Advisor Perk Box */}
        <div className="mb-3 rounded border border-emerald-500/40 bg-emerald-950/30 p-2.5 text-xs">
          <div className="font-bold text-emerald-400">⚡ Advisor Perk: {npc.perkTitle}</div>
          <div className="text-gray-300 mt-0.5">{npc.perkDescription}</div>
        </div>

        {/* Agent Memory Log */}
        {agentState.memories && agentState.memories.length > 0 && (
          <div className="mb-3 rounded border border-gray-700 bg-gray-900/60 p-2 text-[11px] text-gray-300">
            <div className="font-bold text-gray-400 text-[10px] uppercase tracking-wider mb-1">📜 Recent Titan Memory Log:</div>
            <div className="italic text-cyan-200">{agentState.memories[0]}</div>
          </div>
        )}

        {!isDead && npcLines && (
          <DialogueBox
            speaker={npc.name}
            portrait="💼"
            lines={npcLines}
            onDone={() => setDialogueDone(true)}
            npcId={npcId}
            relationshipTier={20}
          />
        )}

        {recruitMsg && (
          <div className={`mb-3 rounded p-2 text-xs font-bold text-center border ${recruitMsg.includes('Successfully') ? 'bg-emerald-900/50 border-emerald-500 text-emerald-300' : 'bg-red-900/50 border-red-500 text-red-300'}`}>
            {recruitMsg}
          </div>
        )}

        {isDead ? (
          <p className="mb-4 text-sm text-red-400">This titan has been eliminated.</p>
        ) : (
          <div className="mb-4 flex flex-col gap-2">
            {!isRecruited ? (
              <button
                onClick={handleRecruit}
                disabled={cash < npc.recruitCost}
                className={`border-2 py-2 text-xs font-bold transition-all ${cash >= npc.recruitCost ? 'border-yellow-400 bg-yellow-600/30 text-yellow-300 hover:bg-yellow-500 hover:text-black' : 'border-gray-600 bg-gray-800 text-gray-500 cursor-not-allowed'}`}
              >
                👔 Recruit to Syndicate Board (${npc.recruitCost.toLocaleString()})
              </button>
            ) : (
              <div className="text-center py-1 text-xs text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-600/40 rounded">
                Active Board Advisor — Passive Perk Enabled
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                onClick={() => financeNpcAction(npcId, 'workFor')}
                className="border border-blue-400/80 py-1.5 text-xs hover:bg-blue-500 hover:text-black transition-colors"
              >
                Work For ($300)
              </button>
              <button
                onClick={() => financeNpcAction(npcId, 'collude')}
                className="border border-amber-400/80 py-1.5 text-xs hover:bg-amber-500 hover:text-black transition-colors"
              >
                Collude ($2,000, Heat +1)
              </button>
              <button
                onClick={() => financeNpcAction(npcId, 'mug')}
                className="border border-orange-500/80 py-1.5 text-xs hover:bg-orange-500 hover:text-black transition-colors"
              >
                Mug ($1,500, Heat +2)
              </button>
              <button
                onClick={() => financeNpcAction(npcId, 'extort')}
                className="border border-red-500/80 py-1.5 text-xs hover:bg-red-500 hover:text-black transition-colors"
              >
                Extort ($5,000, Heat +3)
              </button>
            </div>

            <button
              onClick={onAttack}
              className="mt-1 border-2 border-red-600 bg-red-900/60 py-2 text-xs font-bold text-red-200 hover:bg-red-600 hover:text-white transition-colors"
            >
              ⚔️ Battle Retainer Bodyguards (Power Level: {npc.bodyguardPower})
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full border-2 border-gray-600 py-2 font-bold hover:bg-gray-700 transition-colors"
        >
          Leave
        </button>
      </div>
    </div>
  )
}
