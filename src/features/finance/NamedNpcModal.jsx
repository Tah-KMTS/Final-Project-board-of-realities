import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { getFinanceNpc } from './financeNpcs'
import { getCharacterPortrait } from '../../data/characterPortraits'
import { getCharacterBiography } from '../agents/characterBiographies'
import { generateDynamicSpeech } from '../agents/dynamicDialogueEngine'
import { courtCharacter } from '../agents/romanceEngine'
import {
  FINANCE_NPC_LINES,
  CRIME_NPC_LINES,
  PRESIDENT_NPC_LINES,
  FED_NPC_LINES,
  FTC_NPC_LINES,
} from '../../data/financeDialogue'

// Resolve which dialogue bank this npcId belongs to
function resolveDialogueLines(npcId) {
  if (FINANCE_NPC_LINES[npcId]) return FINANCE_NPC_LINES[npcId]
  if (CRIME_NPC_LINES?.[npcId]) return CRIME_NPC_LINES[npcId]
  if (PRESIDENT_NPC_LINES?.[npcId]) return PRESIDENT_NPC_LINES[npcId]
  if (FED_NPC_LINES?.[npcId]) return FED_NPC_LINES[npcId]
  if (FTC_NPC_LINES?.[npcId]) return FTC_NPC_LINES[npcId]
  return null
}

export default function NamedNpcModal({ npcId, onClose }) {
  const npc = getFinanceNpc(npcId) || { id: npcId, name: npcId, title: 'Titan', netWorth: 1000000000 }
  const world2 = useGameStore((s) => s.world2)
  const cash = useGameStore((s) => s.cash)
  const recruitFinanceNpc = useGameStore((s) => s.recruitFinanceNpc)
  const setRomanceState = useGameStore((s) => s.setRomanceState)
  const spendEnergy = useGameStore((s) => s.spendEnergy)
  
  const recruitedAdvisors = world2.recruitedAdvisors || []
  const isRecruited = recruitedAdvisors.includes(npcId)
  const romanceState = world2.romanceState || { relationships: {}, spouses: [] }
  const relationshipLevel = (romanceState.relationships || {})[npcId] || 0
  const isSpouse = (romanceState.spouses || []).includes(npcId)

  const bio = getCharacterBiography(npcId)
  const masterAgent = (world2.masterAgents || []).find((a) => a.id === npcId)
  const agentState = masterAgent || (world2.agentsState || {})[npcId] || {
    currentMood: 'Bullish Expansion',
    primaryRivalName: 'Competitor',
    aggression: 50,
  }

  const [feedbackMsg, setFeedbackMsg] = useState(null)
  const [lineIndex, setLineIndex] = useState(0)
  if (!npc) return null

  const portraitSrc = getCharacterPortrait(npcId)
  const scriptedLines = resolveDialogueLines(npcId) || []
  const currentLine = scriptedLines.length > 0 ? scriptedLines[lineIndex] : null
  const currentText = typeof currentLine === 'string' ? currentLine : currentLine?.text
  const currentAudio = typeof currentLine === 'object' ? currentLine?.audioSrc : null

  // AI dynamic speech for context-aware situational dialogue
  const dynamicSpeech = generateDynamicSpeech(
    { id: npcId, name: npc.name, ...agentState },
    relationshipLevel,
    null,
    'Midday'
  )

  const handleNextLine = () => {
    if (scriptedLines.length > 1) {
      setLineIndex((prev) => (prev + 1) % scriptedLines.length)
      // Attempt audio playback if audioSrc is present
      if (currentAudio && typeof window !== 'undefined') {
        const audio = new Audio(currentAudio)
        audio.volume = 0.6
        audio.play().catch(() => {}) // Silently fail if file not found
      }
    }
  }

  const handleRecruit = () => {
    const res = recruitFinanceNpc(npcId)
    if (res.success) {
      setFeedbackMsg(`Successfully recruited ${npc.name} to your Board of Realities!`)
    } else {
      setFeedbackMsg(res.reason)
    }
  }

  const handleCourt = (actionType) => {
    if (!spendEnergy(10)) {
      setFeedbackMsg('Too tired for that right now - rest up and try again tomorrow.')
      return
    }
    const res = courtCharacter(romanceState, npcId, npc.name, actionType)
    if (res.success) {
      setRomanceState(res.updatedRomance)
      setFeedbackMsg(`Dating action successful! ${npc.name} relationship level is now ${res.newLevel}/100.`)
    } else {
      setFeedbackMsg(res.reason)
    }
  }

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

        {/* Biographical & Fidelity Metadata Badge */}
        <div className="my-3 grid grid-cols-4 divide-x divide-gray-800 rounded bg-[#161a38] py-2 text-center text-[11px]">
          <div>
            <div className="text-gray-400">Age</div>
            <div className="font-bold text-cyan-300">{bio.age} Yrs</div>
          </div>
          <div>
            <div className="text-gray-400">Gender</div>
            <div className="font-bold text-yellow-300">{bio.gender}</div>
          </div>
          <div>
            <div className="text-gray-400">Marital Status</div>
            <div className="font-bold text-emerald-300">{bio.maritalStatus}</div>
          </div>
          <div>
            <div className="text-gray-400">Fidelity</div>
            <div className="font-bold text-fuchsia-300">{bio.fidelity}</div>
          </div>
        </div>

        {/* Character Portrait + Biography */}
        <div className="my-3 rounded border border-yellow-500/30 bg-[#0e1130] p-3 flex items-start gap-3">
          <img src={portraitSrc} alt={npc.name} className="h-20 w-20 shrink-0 rounded-lg border-2 border-yellow-400 object-contain bg-slate-900" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-yellow-300 mb-1">📜 Biography</div>
            <p className="text-[11px] text-gray-300 leading-relaxed">{bio.bio}</p>
            <div className="mt-1.5 text-[10px] text-gray-500">
              {bio.orientation && <span className="mr-2">Orientation: <span className="text-cyan-400">{bio.orientation}</span></span>}
              {bio.maritalStatus && <span>Status: <span className="text-emerald-400">{bio.maritalStatus}</span></span>}
            </div>
          </div>
        </div>

        {/* Scripted Dialogue Lines Carousel */}
        {scriptedLines.length > 0 && (
          <div className="my-3 rounded border border-cyan-500/40 bg-[#0c1a2e] p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-cyan-300">💬 {npc.name}:</span>
              {scriptedLines.length > 1 && (
                <button
                  onClick={handleNextLine}
                  className="text-[10px] text-gray-400 border border-gray-700 px-2 py-0.5 rounded hover:bg-gray-800"
                >
                  Next Quote ({lineIndex + 1}/{scriptedLines.length})
                </button>
              )}
            </div>
            <p className="text-xs text-cyan-100 italic leading-relaxed">
              "{currentText}"
            </p>
          </div>
        )}

        {/* Dynamic AI Context-Aware Speech */}
        <div className="my-2 rounded border border-yellow-500/30 bg-[#171a38] p-3">
          <div className="text-xs font-bold text-yellow-300 mb-1">🤖 AI Situational Response:</div>
          <p className="text-[11px] text-gray-200 italic leading-relaxed">
            "{dynamicSpeech}"
          </p>
        </div>

        {/* Relationship Tier Level Meter */}
        <div className="my-3 rounded border border-fuchsia-500/40 bg-[#1e1530] p-3 text-xs">
          <div className="flex justify-between items-center mb-1">
            <span className="text-fuchsia-300 font-bold">🌹 Relationship Level:</span>
            <b className="text-yellow-300">{relationshipLevel}/100</b>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/50">
            <div className="h-full bg-fuchsia-500 transition-all duration-300" style={{ width: `${relationshipLevel}%` }} />
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div className="my-2 rounded border border-yellow-500 bg-yellow-950/60 p-2 text-center text-xs text-yellow-300">
            {feedbackMsg}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-4 flex flex-col gap-2">
          {/* Dating & Romance Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            {!isSpouse ? (
              <>
                <button
                  onClick={() => handleCourt('date_diner')}
                  className="border border-fuchsia-400 bg-fuchsia-950/50 py-2 text-xs font-bold text-fuchsia-300 hover:bg-fuchsia-500 hover:text-black transition-all"
                >
                  🍔 Invite to Diner Date
                </button>
                <button
                  onClick={() => handleCourt('proposal')}
                  className="border border-yellow-400 bg-yellow-950/50 py-2 text-xs font-bold text-yellow-300 hover:bg-yellow-500 hover:text-black transition-all"
                >
                  💍 Propose Syndicate Marriage
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  const settlement = Math.floor(cash * 0.5)
                  useGameStore.getState().addCash(-settlement)
                  
                  const updatedSpouses = romanceState.spouses.filter((id) => id !== npcId)
                  setRomanceState({
                    ...romanceState,
                    spouses: updatedSpouses,
                    relationships: {
                      ...romanceState.relationships,
                      [npcId]: 0,
                    },
                  })
                  setFeedbackMsg(`Divorced ${npc.name}. They took 50% of your cash ($${settlement.toLocaleString()}).`)
                }}
                className="col-span-2 border border-red-500 bg-red-950/50 py-2 text-xs font-bold text-red-400 hover:bg-red-600 hover:text-white transition-all"
              >
                💔 Divorce (Settlement: 50% of your cash)
              </button>
            )}
          </div>

          {!isRecruited ? (
            <button
              onClick={handleRecruit}
              className="w-full border-2 border-yellow-400 bg-yellow-600/30 py-2 text-xs font-bold text-yellow-300 hover:bg-yellow-500 hover:text-black transition-all"
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
            className="w-full border border-gray-600 bg-gray-800 py-1.5 text-xs text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            Close Dialogue
          </button>
        </div>
      </div>
    </div>
  )
}
