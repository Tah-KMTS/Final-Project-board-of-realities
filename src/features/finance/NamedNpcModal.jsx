import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { getAnyCharacter } from '../agents/characterLookup'
import { getCharacterPortrait } from '../../data/characterPortraits'
import { getCharacterBiography } from '../agents/characterBiographies'
import { generateDynamicSpeech } from '../agents/dynamicDialogueEngine'
import { courtCharacter } from '../agents/romanceEngine'
import { sendNpcMessage } from '../../utils/npcChatClient'
import {
  FINANCE_NPC_LINES,
  CRIME_NPC_LINES,
  PRESIDENT_NPC_LINES,
  FED_NPC_LINES,
  FTC_NPC_LINES,
  AGENCY_NPC_LINES,
} from '../../data/financeDialogue'

// Resolve which dialogue bank this npcId belongs to
function resolveDialogueLines(npcId) {
  if (FINANCE_NPC_LINES[npcId]) return FINANCE_NPC_LINES[npcId]
  if (CRIME_NPC_LINES?.[npcId]) return CRIME_NPC_LINES[npcId]
  if (PRESIDENT_NPC_LINES?.[npcId]) return PRESIDENT_NPC_LINES[npcId]
  if (FED_NPC_LINES?.[npcId]) return FED_NPC_LINES[npcId]
  if (FTC_NPC_LINES?.[npcId]) return FTC_NPC_LINES[npcId]
  if (AGENCY_NPC_LINES?.[npcId]) return AGENCY_NPC_LINES[npcId]
  return null
}

// `embedded` (default false): every existing standalone call site
// (WorldScreen.jsx's interior-desk/namedRoamer branches) is unaffected.
// When true (BusinessCenterModal/GovernmentBuildingModal's per-NPC tabs, and
// UnderworldModal's Crime Alley tab folding in Luciano), skip the outer
// overlay + "Close Dialogue" button - the wrapping hub modal supplies both.
export default function NamedNpcModal({ npcId, onClose, onAttack, embedded = false }) {
  // getAnyCharacter resolves across every roster (titan/crime/president/fed/
  // ftc/agency-head) - previously this only ever checked FINANCE_NPCS, so
  // every non-titan character showed up as its raw id with a fake "Titan"/
  // $1B placeholder instead of their real name and title.
  const npc = getAnyCharacter(npcId) || { id: npcId, name: npcId, title: 'Unknown', netWorth: 1000000 }
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

  const bioRecord = getCharacterBiography(npcId)
  // Characters without a bespoke biography entry but with real roster data
  // (e.g. agency heads' `background` field) show that instead of the generic
  // "Prominent figure" placeholder.
  const bio = bioRecord.bio === 'Prominent figure in the Capital Syndicate.' && npc.bio
    ? { ...bioRecord, bio: npc.bio }
    : bioRecord
  const masterAgent = (world2.masterAgents || []).find((a) => a.id === npcId)
  // Merge (not short-circuit): masterAgent is populated for all 76
  // characters, so `masterAgent || agentsState[npcId] || {...}` used to mean
  // agentsState's Titan-specific fields (currentMood/aggression/memories,
  // written every endDay() by simulateDailyAgentInteractions/the raid
  // retaliation loop) could never win, even for the 25 Financial Titans who
  // actually have an agentsState entry. Merge order: fallback defaults are
  // the base, masterAgent's currentLocation/currentAction/thoughtProcess
  // apply on top for every character (including the 51 non-Titans who have
  // no agentsState entry at all), and agentsState's Titan-specific fields
  // win last when present.
  const agentState = {
    currentMood: 'Bullish Expansion',
    primaryRivalName: 'Competitor',
    aggression: 50,
    ...masterAgent,
    ...((world2.agentsState || {})[npcId] || {}),
  }

  const [feedbackMsg, setFeedbackMsg] = useState(null)
  const [showBio, setShowBio] = useState(false)
  const [lineIndex, setLineIndex] = useState(0)
  const [chatHistory, setChatHistory] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState(false)
  if (!npc) return null

  const portraitSrc = getCharacterPortrait(npcId)
  const scriptedLines = resolveDialogueLines(npcId) || []
  const currentLine = scriptedLines.length > 0 ? scriptedLines[lineIndex] : null
  const currentText = typeof currentLine === 'string' ? currentLine : currentLine?.text
  const currentAudio = typeof currentLine === 'object' ? currentLine?.audioSrc : null

  // Sent to the backend so it can build this character's persona from the
  // game's own real roster/biography data instead of a second hand-written
  // copy (see backend/main.py's build_character_persona). `bio`'s own text
  // field is kept separate under personalBio - agency leaders already carry
  // a `bio` field from FAMOUS_AGENCY_LEADERS (their role background) and
  // spreading biography.bio into the same key would silently clobber it.
  const characterPayload = {
    ...npc,
    age: bio.age,
    gender: bio.gender,
    orientation: bio.orientation,
    maritalStatus: bio.maritalStatus,
    fidelity: bio.fidelity,
    personalBio: bio.bio,
  }

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

  // Free-text persuasion chat: unlike the scripted carousel above, this is
  // a live LLM reply from backend/main.py, in character for THIS specific
  // person using their real roster/biography data. The model itself
  // decides `agreed` and `relationshipDelta` from that character's actual
  // personality - not scripted, not a coin flip - and we apply the delta
  // straight to the same relationship meter the dating actions use.
  // Degrades to a fallback line (sendNpcMessage never throws) if the local
  // FastAPI backend (npm run dev:backend) isn't running.
  const submitChat = async (e) => {
    e.preventDefault()
    const text = chatInput.trim()
    if (!text || chatLoading) return

    const historyForRequest = chatHistory.map((h) => ({ role: h.role, text: h.text }))
    setChatHistory((h) => [...h, { role: 'player', text }])
    setChatInput('')
    setChatLoading(true)
    setChatError(false)

    const { reply, ok, agreed, relationshipDelta } = await sendNpcMessage({
      npcId,
      playerText: text,
      relationshipTier: relationshipLevel,
      conversationHistory: historyForRequest,
      character: characterPayload,
    })

    setChatHistory((h) => [...h, { role: 'npc', text: reply, agreed: ok ? agreed : null }])
    setChatError(!ok)
    setChatLoading(false)

    if (ok && relationshipDelta) {
      const newLevel = Math.max(0, Math.min(100, relationshipLevel + relationshipDelta))
      setRomanceState({
        ...romanceState,
        relationships: { ...romanceState.relationships, [npcId]: newLevel },
      })
    }
  }

  const body = (
    <>
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-700 pb-3">
          <div className="flex items-center gap-3">
            <img src={portraitSrc} alt={npc.name} className="h-14 w-14 rounded-lg border-2 border-yellow-400 object-cover shadow-md" />
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-yellow-900/60 px-2 py-0.5 text-sm text-yellow-300 font-semibold">{npc.era || 'Titan'}</span>
                <h2 className="text-2xl font-bold text-yellow-400">{npc.name}</h2>
              </div>
              <p className="mt-1 text-sm text-gray-300">"{npc.title}" • Net worth: ${npc.netWorth.toLocaleString()}</p>
            </div>
          </div>
          {isRecruited && (
            <span className="rounded bg-emerald-900/80 px-2 py-1 text-sm font-bold text-emerald-300 border border-emerald-500">
              ✓ BOARD MEMBER
            </span>
          )}
        </div>

        {/* Biographical & Fidelity Metadata Badge */}
        <div className="my-3 grid grid-cols-4 divide-x divide-gray-800 rounded bg-[#161a38] py-2 text-center text-xs">
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

        {/* Bio/quotes/AI-response toggle - these three blocks are pure
            flavor (no gameplay action lives in them), and stacked always-
            visible they were the single biggest reason this modal ran
            taller than the viewport with nothing to scroll it. Collapsed
            by default; the always-visible stuff below (chat, relationship,
            action buttons) is what actually needs to be reachable without
            scrolling past a wall of text first. */}
        <button
          onClick={() => setShowBio((v) => !v)}
          className="my-2 w-full border border-yellow-500/40 bg-[#161a38] py-1.5 text-sm font-bold text-yellow-300 hover:bg-yellow-900/40"
        >
          {showBio ? '▾ Hide Bio & Dialogue' : `▸ Show Bio & Dialogue`}
        </button>

        {showBio && (
          <>
            {/* Character Portrait + Biography */}
            <div className="my-3 rounded border border-yellow-500/30 bg-[#0e1130] p-3 flex items-start gap-3">
              <img src={portraitSrc} alt={npc.name} className="h-20 w-20 shrink-0 rounded-lg border-2 border-yellow-400 object-contain bg-slate-900" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-yellow-300 mb-1">📜 Biography</div>
                <p className="text-sm text-gray-300 leading-relaxed">{bio.bio}</p>
                <div className="mt-1.5 text-xs text-gray-500">
                  {bio.orientation && <span className="mr-2">Orientation: <span className="text-cyan-400">{bio.orientation}</span></span>}
                  {bio.maritalStatus && <span>Status: <span className="text-emerald-400">{bio.maritalStatus}</span></span>}
                </div>
              </div>
            </div>

            {/* Scripted Dialogue Lines Carousel */}
            {scriptedLines.length > 0 && (
              <div className="my-3 rounded border border-cyan-500/40 bg-[#0c1a2e] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-cyan-300">💬 {npc.name}:</span>
                  {scriptedLines.length > 1 && (
                    <button
                      onClick={handleNextLine}
                      className="text-xs text-gray-400 border border-gray-700 px-2 py-0.5 rounded hover:bg-gray-800"
                    >
                      Next Quote ({lineIndex + 1}/{scriptedLines.length})
                    </button>
                  )}
                </div>
                <p className="text-sm text-cyan-100 italic leading-relaxed">
                  "{currentText}"
                </p>
              </div>
            )}

            {/* Dynamic AI Context-Aware Speech */}
            <div className="my-2 rounded border border-yellow-500/30 bg-[#171a38] p-3">
              <div className="text-sm font-bold text-yellow-300 mb-1">🤖 AI Situational Response:</div>
              <p className="text-sm text-gray-200 italic leading-relaxed">
                "{dynamicSpeech}"
              </p>
            </div>
          </>
        )}

        {/* Free-Text Persuasion Chat - real LLM conversation, not scripted.
            Try to convince this specific character (in their own words) to
            do something; whether it lands depends on their actual
            personality/bio, decided live by the model. */}
        <div className="my-3 rounded border border-cyan-400/40 bg-[#0c1a2e] p-3">
          <div className="mb-2 text-sm font-bold text-cyan-300">🗣️ Talk to {npc.name}</div>
          {chatHistory.length > 0 && (
            <div className="mb-2 max-h-32 overflow-y-auto pr-1">
              {chatHistory.map((turn, i) => (
                <div key={i} className="mb-1.5">
                  <p className={`text-sm ${turn.role === 'player' ? 'text-cyan-300' : 'text-gray-200'}`}>
                    <span className="font-bold uppercase">{turn.role === 'player' ? 'You' : npc.name}: </span>
                    {turn.text}
                  </p>
                  {turn.role === 'npc' && turn.agreed !== null && (
                    <p className={`text-xs ${turn.agreed ? 'text-emerald-400' : 'text-red-400'}`}>
                      {turn.agreed ? '✓ Convinced.' : '✗ Not convinced.'}
                    </p>
                  )}
                </div>
              ))}
              {chatError && (
                <p className="text-xs italic text-red-400">
                  (Couldn't reach the NPC chat backend - is it running? See backend/README.md.)
                </p>
              )}
            </div>
          )}
          <form onSubmit={submitChat} className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={`Try to convince ${npc.name}...`}
              disabled={chatLoading}
              maxLength={500}
              className="flex-1 border-2 border-cyan-400/60 bg-black/70 px-2 py-1 text-sm text-white placeholder:text-gray-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={chatLoading || !chatInput.trim()}
              className="border-2 border-cyan-400 px-3 py-1 text-sm font-bold text-cyan-300 hover:bg-cyan-400 hover:text-black disabled:opacity-30"
            >
              {chatLoading ? '...' : 'Send'}
            </button>
          </form>
        </div>

        {/* Relationship Tier Level Meter */}
        <div className="my-3 rounded border border-fuchsia-500/40 bg-[#1e1530] p-3 text-sm">
          <div className="flex justify-between items-center mb-1">
            <span className="text-fuchsia-300 font-bold">🌹 Relationship Level:</span>
            <b className="text-base text-yellow-300">{relationshipLevel}/100</b>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/50">
            <div className="h-full bg-fuchsia-500 transition-all duration-300" style={{ width: `${relationshipLevel}%` }} />
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div className="my-2 rounded border border-yellow-500 bg-yellow-950/60 p-2 text-center text-sm text-yellow-300">
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
                  className="border border-fuchsia-400 bg-fuchsia-950/50 py-2 text-sm font-bold text-fuchsia-300 hover:bg-fuchsia-500 hover:text-black transition-all"
                >
                  🍔 Invite to Diner Date
                </button>
                <button
                  onClick={() => handleCourt('proposal')}
                  className="border border-yellow-400 bg-yellow-950/50 py-2 text-sm font-bold text-yellow-300 hover:bg-yellow-500 hover:text-black transition-all"
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
                className="col-span-2 border border-red-500 bg-red-950/50 py-2 text-sm font-bold text-red-400 hover:bg-red-600 hover:text-white transition-all"
              >
                💔 Divorce (Settlement: 50% of your cash)
              </button>
            )}
          </div>

          {!isRecruited ? (
            <button
              onClick={handleRecruit}
              className="w-full border-2 border-yellow-400 bg-yellow-600/30 py-2 text-sm font-bold text-yellow-300 hover:bg-yellow-500 hover:text-black transition-all"
            >
              Recruit to Cabinet (Cost: ${(npc.recruitCost || 50000).toLocaleString()})
            </button>
          ) : (
            <div className="rounded bg-emerald-950/60 p-2 text-center text-sm font-bold text-emerald-400 border border-emerald-500">
              Active Member of your Board of Realities Cabinet
            </div>
          )}

          {/* Send their bodyguards after them - only offered when the caller
              wires up onAttack (the world-map named-tycoon interaction in
              WorldScreen.jsx). The embedded office-desk tabs (BusinessCenter/
              GovernmentBuilding/IndustrialZone/Underworld) don't pass it, so
              this stays hidden there, same as before. */}
          {onAttack && (
            <button
              onClick={onAttack}
              className="w-full border-2 border-red-600 bg-red-700 py-2 text-sm font-bold text-white hover:bg-red-600 transition-all"
            >
              Attack {npc.name}
            </button>
          )}

          {!embedded && (
            <button
              onClick={onClose}
              className="w-full border border-gray-600 bg-gray-800 py-1.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              Close Dialogue
            </button>
          )}
        </div>
    </>
  )

  if (embedded) return body

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 font-mono">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto border-4 border-yellow-500/70 bg-[#121429] p-6 text-white shadow-2xl">
        {body}
      </div>
    </div>
  )
}
