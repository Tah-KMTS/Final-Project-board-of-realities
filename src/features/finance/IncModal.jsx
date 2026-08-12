import { useEffect, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { sendNpcMessage } from '../../utils/npcChatClient'

// Ince - one of the 6 procedurally-generated "ambient" finance-district NPCs
// (npcGenerator.js), not a FINANCE_NPCS roster member. id 'finance_ambient_2'
// deterministically hashes to "Ince" every run (see npcGenerator.js's
// FIRST_NAMES pool), which is how WorldScreen.jsx picks her out of the 6 for
// this bespoke treatment while the other 5 keep the plain AmbientNpcModal.
// Same VN-style treatment as Lisa/Warren (portrait + scene backdrop, chat
// choices generated fresh each turn - see sendNpcMessage's suggestedReplies)
// with a hand-authored backend persona (backend/main.py's NPC_PERSONAS
// ['ince'], written around her existing generated personality/trait tags)
// since she has no roster biography to build one from.
//
// Deliberately NOT romanceable/no romance meter - unlike Lisa/Warren, her
// art (school-uniform-style outfit) reads as plausibly a student, and this
// project already only makes exceptions to "no romance" for characters
// where that's unambiguous. Chat here uses a plain 0-100 rapport meter for
// conversation flavor only - it doesn't gate anything, matching how the
// majority of the non-romanceable roster already works. Mug/Attack are her
// pre-existing ambient-NPC mechanics (WorldScreen.jsx), kept as secondary
// actions here exactly as before - only the interaction SCREEN changed.
// These 7 files (see MOOD_POOL below) are the approved art - don't swap them
// for different photos/renders without checking with the project owner
// first (it's happened once already and was reverted). The
// `ince-portraits-golden` git tag pins the approved bytes;
// `node production/restoreIncePortraits.mjs` instantly restores them from it
// if they're ever changed.
//
// Conversation persistence matches LisaModal.jsx exactly, on the user's
// explicit request ("what I can do with Lisa I can also do it with Ince"):
// the transcript and rapport score are read from/written back to
// world2.romanceState (chatLog.ince / relationships.ince - both already
// generic npcId-keyed maps, see romanceEngine.js's initializeRomanceState),
// so leaving and reopening the modal - or a full session reload - picks the
// conversation back up instead of resetting to INTRO_LINE, and there's a
// History viewer for the full transcript. Only the conversation layer is
// shared; gifts/dates/propose stay Lisa/Warren-only, since those are
// specifically romance mechanics and Ince is deliberately not romanceable
// (see above) - reusing `relationships` here is just this shared map's
// existing plain-number-per-npcId shape, not a romance flag.
const PORTRAITS = '/assets/packs/Ince/portraits'
// No Ince-specific scene art - explicitly reusing Lisa's background pack.
const SCENES = '/assets/packs/Lisa/scenes'
const DEFAULT_SCENE = 'street'

const INTRO_LINE = "Oh, hey! Don't think I've seen you around here before - what's up?"

// 3 more source photos (pic 2/3/4 in the raw pack - see
// production/process_ince_new_portraits.py) turned up alongside the original
// 4, giving each reaction tier a small pool instead of one static image -
// picked fresh per reply so a long conversation doesn't keep showing the
// exact same frame. 'curious' (previously cropped but never actually wired
// to any mood trigger) now doubles as her opening expression - a raised-
// eyebrow "who's this?" look fits the intro line better than flat neutral.
const MOOD_POOL = {
  neutral: ['neutral'],
  cheerful: ['cheerful', 'amused'],
  delighted: ['delighted', 'laughing', 'playful'],
}
const pickMood = (tier) => {
  const pool = MOOD_POOL[tier]
  return pool[Math.floor(Math.random() * pool.length)]
}

const PRESET_CHOICES = [
  { key: 'smalltalk', label: 'Rough day, or is it just me?' },
  { key: 'curious', label: "What's with the camera - you into photography?" },
  { key: 'pitch', label: 'You seem like you know everything that happens around here - anything I should know?' },
  { key: 'hustle', label: 'I need something done quietly - you in, no questions asked?' },
]

// mugProfile is per-npc (see npcGenerator.js's getMugProfile) - a tougher
// mark is a lower success chance but a bigger payout if it lands, same as
// the plain AmbientNpcModal (WorldScreen.jsx computes it once and passes it
// to both).
export default function IncModal({ onClose, onMug, onAttack, feedback, mugProfile }) {
  const world2 = useGameStore((s) => s.world2)
  const setRomanceState = useGameStore((s) => s.setRomanceState)
  const romanceState = world2.romanceState || { relationships: {}, chatLog: {} }

  // Lazy-init from the persisted rapport/transcript, same as LisaModal.jsx -
  // see this file's header comment for why reusing romanceState is safe
  // here even though Ince isn't romanceable. Mood still starts at 'curious'
  // (her opening raised-eyebrow look, see MOOD_POOL above) regardless of a
  // resumed conversation - it's a per-render reaction shot, not part of the
  // persisted state.
  const [mood, setMood] = useState('curious')
  const [rapport, setRapport] = useState(() => (romanceState.relationships || {}).ince || 0)
  const [chatHistory, setChatHistory] = useState(() => (romanceState.chatLog || {}).ince || [])
  const [dynamicChoices, setDynamicChoices] = useState(null)
  const [inputMode, setInputMode] = useState('choice')
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState(false)
  // 'talk' -> 'history' -> back to 'talk', same shape as LisaModal.jsx.
  const [phase, setPhase] = useState('talk')

  // Write-back half of the lazy-inits above: persist the transcript and
  // rapport into world2.romanceState any time either changes, so they
  // survive closing the modal or a full session reload. Reads
  // useGameStore.getState() fresh (not the `romanceState` closure) for the
  // same reason LisaModal.jsx does - avoids clobbering a write another
  // handler made moments earlier in the same tick.
  useEffect(() => {
    if (chatHistory.length === 0) return
    const rs = useGameStore.getState().world2.romanceState || {}
    const chatLog = { ...(rs.chatLog || {}) }
    chatLog.ince = chatHistory.slice(-80)
    setRomanceState({ ...rs, chatLog })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatHistory])

  useEffect(() => {
    const rs = useGameStore.getState().world2.romanceState || {}
    const relationships = { ...(rs.relationships || {}) }
    if (relationships.ince === rapport) return
    relationships.ince = rapport
    setRomanceState({ ...rs, relationships })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rapport])

  const submitText = async (text) => {
    if (!text.trim() || chatLoading) return
    const historyForRequest = chatHistory.map((h) => ({ role: h.role, text: h.text }))
    setChatHistory((h) => [...h, { role: 'player', text }])
    setChatInput('')
    setChatLoading(true)
    setChatError(false)

    const { reply, ok, agreed, relationshipDelta, suggestedReplies } = await sendNpcMessage({
      npcId: 'ince',
      playerText: text,
      relationshipTier: rapport,
      conversationHistory: historyForRequest,
      character: null,
    })

    setChatHistory((h) => [...h, { role: 'npc', text: reply, agreed: ok ? agreed : null }])
    setChatError(!ok)
    setChatLoading(false)
    if (ok && suggestedReplies.length) setDynamicChoices(suggestedReplies)

    let delta = 0
    if (ok && typeof relationshipDelta === 'number') {
      setRapport((r) => Math.max(0, Math.min(100, r + relationshipDelta)))
      delta = relationshipDelta
    }
    // No clearly "annoyed" expression exists among her source photos (see
    // the build notes for why) - a cold reception still shows a neutral
    // face rather than forcing an expression that isn't actually in the art.
    if (delta >= 2) setMood(pickMood('delighted'))
    else if (delta > 0) setMood(pickMood('cheerful'))
    else setMood('neutral')
  }

  const handlePreset = (choice) => submitText(choice.label)
  const handleFreeSubmit = (e) => {
    e.preventDefault()
    submitText(chatInput)
  }

  const lastNpcLine = [...chatHistory].reverse().find((h) => h.role === 'npc')
  const dialogueText = lastNpcLine ? lastNpcLine.text : INTRO_LINE
  const currentChoices = dynamicChoices
    ? dynamicChoices.map((label, i) => ({ key: `dyn-${i}`, label }))
    : PRESET_CHOICES

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 font-mono">
      <div className="flex max-h-[94vh] w-[720px] max-w-full flex-col border-4 border-cyan-500/80 bg-[#101a1c] shadow-2xl">
        <div className="flex items-center justify-between border-b-[3px] border-cyan-500/50 bg-[#132226] px-3 py-2">
          <span className="text-sm font-bold text-cyan-300">Ince</span>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs">
              <div className="font-bold text-cyan-200">🙂 {rapport}/100</div>
            </div>
            <button
              onClick={() => setPhase('history')}
              className="border border-cyan-500/50 px-2 py-1 text-xs text-cyan-300 hover:bg-cyan-900/50"
            >
              {'\u{1F4DC}'} History
            </button>
            <button onClick={onClose} className="border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700">
              Leave
            </button>
          </div>
        </div>

        {phase !== 'history' && (
          <div className="relative h-[260px] shrink-0 overflow-hidden [@media(min-height:750px)]:h-[330px]">
            <img
              src={`${SCENES}/${DEFAULT_SCENE}.jpg`}
              alt=""
              className="absolute inset-0 h-full w-full scale-105 object-cover blur-[2px] brightness-[0.72]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/25" />
            <img
              key={mood}
              src={`${PORTRAITS}/ince_${mood}.png`}
              alt=""
              className="animate-portrait-swap absolute bottom-0 left-1/2 h-[104%] w-auto -translate-x-1/2 drop-shadow-[0_6px_18px_rgba(0,0,0,0.55)]"
            />
          </div>
        )}

        {/* full chat transcript, same shape as LisaModal.jsx's own History
            panel - persisted via romanceState.chatLog.ince (see the sync
            effect above) so it's still here next time the modal opens. */}
        {phase === 'history' && (
          <div className="flex max-h-[420px] flex-1 flex-col overflow-y-auto border-t-[3px] border-cyan-500/50 bg-[#0a1113] p-3">
            <p className="mb-2 text-xs text-gray-400">Everything you two have said, oldest first.</p>
            {chatHistory.length === 0 ? (
              <p className="text-sm italic text-gray-500">Nothing yet - say something to her first.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {chatHistory.map((h, i) => (
                  <div key={i} className={h.role === 'player' ? 'text-right' : 'text-left'}>
                    <p className={`text-[10px] font-bold ${h.role === 'player' ? 'text-fuchsia-300' : 'text-cyan-300'}`}>
                      {h.role === 'player' ? 'You' : 'Ince'}
                    </p>
                    <p
                      className={`inline-block max-w-[85%] rounded px-2 py-1 text-sm ${
                        h.role === 'player' ? 'bg-fuchsia-950/50 text-fuchsia-100' : 'bg-cyan-950/50 text-cyan-100'
                      }`}
                    >
                      {h.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setPhase('talk')}
              className="mt-3 w-full shrink-0 border border-gray-600 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
            >
              Back
            </button>
          </div>
        )}

        {phase === 'talk' && (
          <>
            <div className="min-h-[80px] flex-1 border-t-[3px] border-cyan-500/50 bg-[#eef8f8] px-3 py-2">
              <p className="text-xs font-bold text-cyan-700">Ince</p>
              <p className="text-sm leading-snug text-[#22222a]">{dialogueText}</p>
              {lastNpcLine && lastNpcLine.agreed !== null && (
                <p className={`mt-1 text-xs font-bold ${lastNpcLine.agreed ? 'text-emerald-600' : 'text-red-600'}`}>
                  {lastNpcLine.agreed ? '✓ She goes for it.' : '✗ Not convinced.'}
                </p>
              )}
              {chatError && (
                <p className="mt-1 text-xs italic text-red-500">
                  (Couldn't reach the NPC chat backend - is it running? See backend/README.md.)
                </p>
              )}
            </div>

            <div className="border-t-[3px] border-cyan-500/50 bg-[#101a1c] p-3">
              <div className="mb-2 flex gap-2 text-xs">
                <button
                  onClick={() => setInputMode('choice')}
                  className={`border px-2 py-1 ${inputMode === 'choice' ? 'border-cyan-400 bg-cyan-900/50 text-cyan-200' : 'border-gray-700 text-gray-400'}`}
                >
                  Choices
                </button>
                <button
                  onClick={() => setInputMode('free')}
                  className={`border px-2 py-1 ${inputMode === 'free' ? 'border-cyan-400 bg-cyan-900/50 text-cyan-200' : 'border-gray-700 text-gray-400'}`}
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
                      className="border border-cyan-500/50 bg-[#132226] px-2 py-2 text-left text-xs text-cyan-100 hover:bg-cyan-900/50 disabled:opacity-40"
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
                    placeholder="Say something to Ince..."
                    disabled={chatLoading}
                    maxLength={500}
                    className="flex-1 border-2 border-cyan-500/60 bg-black/70 px-2 py-1 text-sm text-white placeholder:text-gray-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={chatLoading || !chatInput.trim()}
                    className="border-2 border-cyan-400 px-3 py-1 text-sm font-bold text-cyan-300 hover:bg-cyan-400 hover:text-black disabled:opacity-30"
                  >
                    {chatLoading ? '...' : 'Send'}
                  </button>
                </form>
              )}

              {feedback && (
                <div className="mb-2 border border-orange-500/70 bg-orange-950/50 p-2 text-xs font-bold text-orange-200">
                  {feedback}
                </div>
              )}
              <div className="mt-2 flex gap-2">
                <button
                  onClick={onMug}
                  className="flex-1 border border-orange-500/70 bg-orange-950/40 py-1.5 text-xs font-bold text-orange-300 hover:bg-orange-900/60"
                >
                  Mug Them ({mugProfile ? `${mugProfile.label} - ` : ''}
                  +${mugProfile?.payout ?? 50}, {Math.round((mugProfile?.baseSuccessChance ?? 0.8) * 100)}% odds,
                  Wanted +{mugProfile?.wantedIncreaseOnFail ?? 1} on fail)
                </button>
                <button
                  onClick={onAttack}
                  className="flex-1 border border-red-600/70 bg-red-950/40 py-1.5 text-xs font-bold text-red-300 hover:bg-red-900/60"
                >
                  Attack Them
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
