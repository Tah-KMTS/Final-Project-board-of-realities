import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { sendNpcMessage } from '../../utils/npcChatClient'
import { getAnyCharacter } from '../agents/characterLookup'
import { getCharacterBiography } from '../agents/characterBiographies'
import { courtCharacter } from '../agents/romanceEngine'

// Warren Buffett - a real FINANCE_NPCS roster member (financeNpcs.js, id
// 'buffett'), same VN-style treatment piloted on Lisa (LisaModal.jsx):
// portrait + scene backdrop composited behind a chat panel whose choices are
// generated fresh each turn by the backend (see sendNpcMessage's
// suggestedReplies) instead of a static menu. Unlike Lisa, his dialogue
// keeps running through the ROSTER-driven persona (build_character_persona
// in backend/main.py, fed by characterPayload below) - that's what's
// already live for him today via the generic NamedNpcModal this replaces,
// and swapping him onto a hand-authored persona instead would be a
// personality change nobody asked for, not just a visual one. Recruit-to-
// Cabinet/Date/Propose/Divorce/Attack are the exact same actions
// NamedNpcModal already exposes for every roster character - tucked into
// the collapsible Manage panel here so the main screen stays the
// conversation, matching what this pass was actually asked to change.
const PORTRAITS = '/assets/packs/Warren/portraits'
// Explicitly reusing Lisa's background pack (packs/Lisa/scenes) rather than
// generating a new one - there is no Warren-specific scene art, and the
// request was to reuse hers.
const SCENES = '/assets/packs/Lisa/scenes'

const SCENE_FOR_BUILDING = {
  businessCenter: 'cafe_exterior',
  bank: 'street',
  realEstateAgency: 'street',
  stockExchange: 'street',
}
const DEFAULT_SCENE = 'cafe'

const INTRO_LINE = "Well now. Don't get many visitors who aren't after a stock tip. What can I do for you?"

// Opening move only - after this, every set of choices comes straight from
// the backend's own suggestedReplies (see submitText/currentChoices), the
// same "choices evolve with the conversation" fix built for Lisa.
const PRESET_CHOICES = [
  { key: 'smalltalk', label: 'What does a normal day look like for you these days?' },
  { key: 'curious', label: 'What’s the one rule you’ve never broken in fifty years of investing?' },
  { key: 'pitch', label: 'I’ve got a venture that could use a legend’s backing - interested?' },
  { key: 'hustle', label: 'This is a sure thing - no risk, guaranteed return. You in?' },
]

const STAGE_LABEL = (level) => {
  if (level >= 70) return 'Trusted'
  if (level >= 35) return 'Acquainted'
  return 'Stranger'
}

export default function WarrenModal({ onClose, buildingId, onAttack }) {
  const npc = getAnyCharacter('buffett') || { id: 'buffett', name: 'Warren Buffett', title: 'The Oracle of Omaha', netWorth: 130000000000 }
  const bio = getCharacterBiography('buffett')
  const world2 = useGameStore((s) => s.world2)
  const cash = useGameStore((s) => s.cash)
  const recruitFinanceNpc = useGameStore((s) => s.recruitFinanceNpc)
  const setRomanceState = useGameStore((s) => s.setRomanceState)
  const spendEnergy = useGameStore((s) => s.spendEnergy)

  const romanceState = world2.romanceState || { relationships: {}, spouses: [] }
  const relationshipLevel = (romanceState.relationships || {}).buffett || 0
  const isSpouse = (romanceState.spouses || []).includes('buffett')
  const recruitedAdvisors = world2.recruitedAdvisors || []
  const isRecruited = recruitedAdvisors.includes('buffett')

  // 'talk' <-> 'manage' (Bio/Recruit/Date/Attack) - same phase-toggle shape
  // LisaModal's 'gift' screen uses, just holding the roster-management
  // actions instead of a Lisa-specific mechanic.
  const [phase, setPhase] = useState('talk')
  const [mood, setMood] = useState('neutral')
  const [chatHistory, setChatHistory] = useState([])
  const [dynamicChoices, setDynamicChoices] = useState(null)
  const [inputMode, setInputMode] = useState('choice')
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState(null)

  // Sent to the backend so build_character_persona works from the game's
  // own real roster/biography data - identical shape to NamedNpcModal's
  // own characterPayload, since this is the same persona path he already
  // uses there.
  const characterPayload = {
    ...npc,
    age: bio.age,
    gender: bio.gender,
    orientation: bio.orientation,
    maritalStatus: bio.maritalStatus,
    fidelity: bio.fidelity,
    personalBio: bio.bio,
  }

  const submitText = async (text) => {
    if (!text.trim() || chatLoading) return
    const historyForRequest = chatHistory.map((h) => ({ role: h.role, text: h.text }))
    setChatHistory((h) => [...h, { role: 'player', text }])
    setChatInput('')
    setChatLoading(true)
    setChatError(false)

    const { reply, ok, agreed, relationshipDelta, suggestedReplies } = await sendNpcMessage({
      npcId: 'buffett',
      playerText: text,
      relationshipTier: relationshipLevel,
      conversationHistory: historyForRequest,
      character: characterPayload,
    })

    setChatHistory((h) => [...h, { role: 'npc', text: reply, agreed: ok ? agreed : null }])
    setChatError(!ok)
    setChatLoading(false)
    if (ok && suggestedReplies.length) setDynamicChoices(suggestedReplies)

    let delta = 0
    if (ok && typeof relationshipDelta === 'number') {
      const newLevel = Math.max(0, Math.min(100, relationshipLevel + relationshipDelta))
      setRomanceState({ ...romanceState, relationships: { ...romanceState.relationships, buffett: newLevel } })
      delta = relationshipDelta
    }
    if (delta >= 2) setMood('pleased')
    else if (delta < 0) setMood('unimpressed')
    else setMood('neutral')
  }

  const handlePreset = (choice) => submitText(choice.label)
  const handleFreeSubmit = (e) => {
    e.preventDefault()
    submitText(chatInput)
  }

  const handleRecruit = () => {
    const res = recruitFinanceNpc('buffett')
    if (res.success) {
      setMood('dealmaking')
      setFeedbackMsg(`Recruited ${npc.name} to your Board of Realities.`)
    } else {
      setFeedbackMsg(res.reason)
    }
  }

  const handleCourt = (actionType) => {
    if (!spendEnergy(10)) {
      setFeedbackMsg('Too tired for that right now - rest up and try again tomorrow.')
      return
    }
    const res = courtCharacter(romanceState, 'buffett', npc.name, actionType)
    if (res.success) {
      setRomanceState(res.updatedRomance)
      setMood('pleased')
      setFeedbackMsg(`Relationship level is now ${res.newLevel}/100.`)
    } else {
      setFeedbackMsg(res.reason)
    }
  }

  const handleDivorce = () => {
    const settlement = Math.floor(cash * 0.5)
    useGameStore.getState().addCash(-settlement)
    setRomanceState({
      ...romanceState,
      spouses: (romanceState.spouses || []).filter((id) => id !== 'buffett'),
      relationships: { ...romanceState.relationships, buffett: 0 },
    })
    setFeedbackMsg(`Divorced. Settlement: $${settlement.toLocaleString()}.`)
  }

  const lastNpcLine = [...chatHistory].reverse().find((h) => h.role === 'npc')
  const dialogueText = lastNpcLine ? lastNpcLine.text : INTRO_LINE
  const currentChoices = dynamicChoices
    ? dynamicChoices.map((label, i) => ({ key: `dyn-${i}`, label }))
    : PRESET_CHOICES

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 font-mono">
      <div className="flex max-h-[94vh] w-[720px] max-w-full flex-col border-4 border-amber-500/80 bg-[#1c1a12] shadow-2xl">
        <div className="flex items-center justify-between border-b-[3px] border-amber-500/50 bg-[#241f14] px-3 py-2">
          <div>
            <span className="text-sm font-bold text-amber-300">{npc.name}</span>
            <span className="ml-2 text-xs text-amber-400/70">"{npc.title}"</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs">
              <div className="text-amber-300">{isSpouse ? 'Married' : STAGE_LABEL(relationshipLevel)}</div>
              <div className="font-bold text-yellow-200">🤝 {relationshipLevel}/100</div>
            </div>
            <button onClick={onClose} className="border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700">
              Leave
            </button>
          </div>
        </div>

        <div className="relative h-[260px] shrink-0 overflow-hidden [@media(min-height:750px)]:h-[330px]">
          <img
            src={`${SCENES}/${SCENE_FOR_BUILDING[buildingId] || DEFAULT_SCENE}.jpg`}
            alt=""
            className="absolute inset-0 h-full w-full scale-105 object-cover blur-[2px] brightness-[0.72]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/25" />
          <img
            key={mood}
            src={`${PORTRAITS}/warren_${mood}.png`}
            alt=""
            className="animate-portrait-swap absolute bottom-0 left-1/2 h-[104%] w-auto -translate-x-1/2 drop-shadow-[0_6px_18px_rgba(0,0,0,0.55)]"
          />
        </div>

        {phase === 'manage' && (
          <div className="border-t-[3px] border-amber-500/50 bg-[#0f0d08] p-4 text-sm text-gray-200">
            <p className="mb-2 text-xs font-bold text-amber-300">📜 Biography</p>
            <p className="mb-3 text-xs leading-relaxed text-gray-300">{bio.bio}</p>
            <div className="mb-3 grid grid-cols-4 divide-x divide-gray-800 rounded bg-[#161a38]/40 py-2 text-center text-xs">
              <div>
                <div className="text-gray-400">Age</div>
                <div className="font-bold text-cyan-300">{bio.age}</div>
              </div>
              <div>
                <div className="text-gray-400">Gender</div>
                <div className="font-bold text-yellow-300">{bio.gender}</div>
              </div>
              <div>
                <div className="text-gray-400">Status</div>
                <div className="font-bold text-emerald-300">{bio.maritalStatus}</div>
              </div>
              <div>
                <div className="text-gray-400">Net Worth</div>
                <div className="font-bold text-amber-300">${npc.netWorth.toLocaleString()}</div>
              </div>
            </div>

            {!isRecruited ? (
              <button
                onClick={handleRecruit}
                className="mb-2 w-full border-2 border-yellow-400 bg-yellow-600/30 py-2 text-xs font-bold text-yellow-300 hover:bg-yellow-500 hover:text-black"
              >
                Recruit to Cabinet (${(npc.recruitCost || 50000).toLocaleString()})
              </button>
            ) : (
              <div className="mb-2 rounded bg-emerald-950/60 p-2 text-center text-xs font-bold text-emerald-400 border border-emerald-500">
                Active Member of your Board of Realities Cabinet
              </div>
            )}

            {!isSpouse ? (
              <div className="mb-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleCourt('date_diner')}
                  className="border border-fuchsia-400 bg-fuchsia-950/50 py-1.5 text-xs font-bold text-fuchsia-300 hover:bg-fuchsia-500 hover:text-black"
                >
                  🍔 Invite to Diner Date
                </button>
                <button
                  onClick={() => handleCourt('proposal')}
                  className="border border-yellow-400 bg-yellow-950/50 py-1.5 text-xs font-bold text-yellow-300 hover:bg-yellow-500 hover:text-black"
                >
                  💍 Propose Syndicate Marriage
                </button>
              </div>
            ) : (
              <button
                onClick={handleDivorce}
                className="mb-2 w-full border border-red-500 bg-red-950/50 py-1.5 text-xs font-bold text-red-400 hover:bg-red-600 hover:text-white"
              >
                💔 Divorce (Settlement: 50% of your cash)
              </button>
            )}

            {onAttack && (
              <button
                onClick={onAttack}
                className="mb-2 w-full border-2 border-red-600 bg-red-700 py-1.5 text-xs font-bold text-white hover:bg-red-600"
              >
                Attack {npc.name}
              </button>
            )}

            {feedbackMsg && (
              <p className="mb-2 rounded border border-yellow-500/50 bg-yellow-950/40 p-2 text-center text-xs text-yellow-300">
                {feedbackMsg}
              </p>
            )}

            <button
              onClick={() => setPhase('talk')}
              className="w-full border border-gray-600 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
            >
              Back to conversation
            </button>
          </div>
        )}

        {phase === 'talk' && (
          <>
            <div className="min-h-[80px] flex-1 border-t-[3px] border-amber-500/50 bg-[#f6f2e8] px-3 py-2">
              <p className="text-xs font-bold text-amber-700">{npc.name}</p>
              <p className="text-sm leading-snug text-[#22222a]">{dialogueText}</p>
              {lastNpcLine && lastNpcLine.agreed !== null && (
                <p className={`mt-1 text-xs font-bold ${lastNpcLine.agreed ? 'text-emerald-600' : 'text-red-600'}`}>
                  {lastNpcLine.agreed ? '✓ He goes for it.' : '✗ Not convinced.'}
                </p>
              )}
              {chatError && (
                <p className="mt-1 text-xs italic text-red-500">
                  (Couldn't reach the NPC chat backend - is it running? See backend/README.md.)
                </p>
              )}
            </div>

            <div className="border-t-[3px] border-amber-500/50 bg-[#1c1a12] p-3">
              <div className="mb-2 flex gap-2 text-xs">
                <button
                  onClick={() => setInputMode('choice')}
                  className={`border px-2 py-1 ${inputMode === 'choice' ? 'border-amber-400 bg-amber-900/50 text-amber-200' : 'border-gray-700 text-gray-400'}`}
                >
                  Choices
                </button>
                <button
                  onClick={() => setInputMode('free')}
                  className={`border px-2 py-1 ${inputMode === 'free' ? 'border-amber-400 bg-amber-900/50 text-amber-200' : 'border-gray-700 text-gray-400'}`}
                >
                  Type your own
                </button>
              </div>

              {inputMode === 'choice' ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {currentChoices.map((choice) => (
                    <button
                      key={choice.key}
                      onClick={() => handlePreset(choice)}
                      disabled={chatLoading}
                      className="border border-amber-500/50 bg-[#241f14] px-2 py-2 text-left text-xs text-amber-100 hover:bg-amber-900/50 disabled:opacity-40"
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              ) : (
                <form onSubmit={handleFreeSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={`Say something to ${npc.name}...`}
                    disabled={chatLoading}
                    maxLength={500}
                    className="flex-1 border-2 border-amber-500/60 bg-black/70 px-2 py-1 text-sm text-white placeholder:text-gray-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={chatLoading || !chatInput.trim()}
                    className="border-2 border-amber-400 px-3 py-1 text-sm font-bold text-amber-300 hover:bg-amber-400 hover:text-black disabled:opacity-30"
                  >
                    {chatLoading ? '...' : 'Send'}
                  </button>
                </form>
              )}

              {feedbackMsg && (
                <p className="mt-2 rounded border border-yellow-500/50 bg-yellow-950/40 p-2 text-center text-xs text-yellow-300">
                  {feedbackMsg}
                </p>
              )}

              <button
                onClick={() => setPhase('manage')}
                className="mt-2 w-full border border-amber-400/70 bg-amber-950/40 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-900/60"
              >
                📋 Bio & Cabinet Actions
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
