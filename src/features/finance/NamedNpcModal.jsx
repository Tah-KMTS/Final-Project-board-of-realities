import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { getFinanceNpc } from './financeNpcs'
import { FINANCE_NPC_LINES } from '../../data/financeDialogue'
import { getCharacterPortrait } from '../../data/characterPortraits'

export default function NamedNpcModal({ npcId, onClose }) {
  const npc = getFinanceNpc(npcId)
  const world2 = useGameStore((s) => s.world2)
  const cash = useGameStore((s) => s.cash)
  const recruitFinanceNpc = useGameStore((s) => s.recruitFinanceNpc)
  const recruitedAdvisors = world2.recruitedAdvisors || []
  const isRecruited = recruitedAdvisors.includes(npcId)

  const agentState = (world2.agentsState || {})[npcId] || {
    currentMood: 'Bullish Expansion',
    primaryRivalName: 'Competitor',
    aggression: 50,
    memoryLog: [],
  }

  const [recruitMsg, setRecruitMsg] = useState(null)
  const [dialogueStep, setDialogueStep] = useState(0)
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

  const portraitSrc = getCharacterPortrait(npcId, npc.name, npc.era)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 font-mono">
      <div className="w-full max-w-xl border-4 border-yellow-500/70 bg-[#121429] p-6 text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-700 pb-3">
          <div className="flex items-center gap-3">
            <img src={portraitSrc} alt={npc.name} className="h-14 w-14 rounded-lg border-2 border-yellow-400 object-cover shadow-md" />
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-yellow-900/60 px-2 py-0.5 text-xs text-yellow-300 font-semibold">{npc.era || 'Titan'}</span>
                <h2 className="text-xl font-bold text-yellow-400">{npc.name}</h2>
              </div>
              <p className="mt-1 text-xs text-gray-300">"{npc.title}" • Net worth: ${npc.netWorth.toLocaleString()}</p>
            </div>
          </div>
          {isRecruited && (
            <span className="rounded bg-emerald-900/80 px-2 py-1 text-xs font-bold text-emerald-300 border border-emerald-500">
              ✓ BOARD MEMBER
            </span>
          )}
        </div>

        {/* Dialogue Box with Character Portrait */}
        <div className="my-4 rounded border border-yellow-500/40 bg-[#171a38] p-4">
          <div className="flex items-start gap-4">
            <img src={portraitSrc} alt={npc.name} className="h-16 w-16 shrink-0 rounded border border-yellow-400 bg-slate-900" />
            <div>
              <div className="text-xs font-bold text-yellow-300 mb-1">{npc.name} Says:</div>
              <p className="text-xs text-gray-200 italic leading-relaxed">
                "{npcLines ? npcLines[dialogueStep % npcLines.length] : npc.description}"
              </p>
            </div>
          </div>
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
              <b className="text-red-400">{agentState.primaryRivalName}</b>
            </div>
            <div>
              <span className="text-gray-400">Aggression Index:</span>{' '}
              <b className="text-yellow-300">{agentState.aggression}%</b>
            </div>
            <div>
              <span className="text-gray-400">Advisor Perk:</span>{' '}
              <b className="text-emerald-300">{npc.advisorPerk || 'Yield Bonus'}</b>
            </div>
          </div>
        )}

        {/* Recruitment Status */}
        {recruitMsg && (
          <div className="my-2 rounded border border-yellow-500 bg-yellow-950/60 p-2 text-center text-xs text-yellow-300">
            {recruitMsg}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-4 flex flex-col gap-2">
          {!isRecruited ? (
            <button
              onClick={handleRecruit}
              className="w-full border-2 border-yellow-400 bg-yellow-600/30 py-2.5 text-xs font-bold text-yellow-300 hover:bg-yellow-500 hover:text-black transition-all"
            >
              Recruit to Cabinet (Cost: ${(npc.recruitCost || 50000).toLocaleString()})
            </button>
          ) : (
            <div className="rounded bg-emerald-950/60 p-2 text-center text-xs font-bold text-emerald-400 border border-emerald-500">
              Active Member of your Board of Realities Cabinet
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full border border-gray-600 bg-gray-800 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            Close Dialogue
          </button>
        </div>
      </div>
    </div>
  )
}
