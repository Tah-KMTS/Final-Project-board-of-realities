import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { sendNpcMessage } from '../../utils/npcChatClient'

// Nova Chase ("The Icon") - a fictional global-pop-idol-turned-media-mogul,
// the Capital Syndicate roster's first entertainment-world titan. Deliberately
// NOT part of the 90-character finance/crime/government roster
// (characterLookup.js) - see backend/main.py's NPC_PERSONAS['nova'] for why:
// she's a hand-authored persona, same simple pattern 'tea'/'marriageCandidate'
// already use, not the roster-driven build_character_persona path.
//
// A bespoke full-bleed VN-style screen (not NamedNpcModal's business-panel
// layout, and not DialogueBox's carousel-plus-chat-box) - reference was a
// Pokemon-style/dating-sim battle screen: big mood portrait, dialogue box,
// a grid of choices. Calls sendNpcMessage() directly for full layout control,
// but it's the SAME backend call NamedNpcModal.jsx's free-text chat uses -
// zero new backend logic beyond the one persona entry, so she inherits the
// hard kiss-ceiling content boundary and tier-gated consent for free.
//
// Portraits are cropped from the character's own stylized walk-cycle sheet
// (public/assets/packs/Lisa/lisa character.png), not the real press-photo
// files sitting alongside it in that same folder - see this feature's plan
// doc for why those photos are deliberately unused anywhere in this game.

const PORTRAITS = '/assets/packs/Lisa/portraits'

const INTRO_LINE =
  "Oh - hey. Don't see a lot of new faces around here who aren't already holding a phone up at me."

// Tone varies the preset's flavor; agreed/relationshipDelta are still decided
// live by the backend from Nova's own persona (see PERSUASION_INSTRUCTIONS in
// backend/main.py) - a preset is just a canned phrasing, not a shortcut that
// skips her judgment. 'hustle' is the hidden-agenda option: a barely-dressed-up
// ask, evaluated the same as anything the player might type themselves.
const PRESET_CHOICES = [
  { key: 'friendly', label: 'So what’s it actually like being you?', tone: 'friendly' },
  { key: 'flirty', label: 'I have to say, the pictures don’t do you justice.', tone: 'flirty' },
  { key: 'business', label: 'Word is your empire’s bigger than your discography now.', tone: 'business' },
  { key: 'hustle', label: 'I’ve got a can’t-miss investment - you in?', tone: 'hustle' },
]

const STAGE_LABEL = (affection) => {
  if (affection >= 70) return 'Close'
  if (affection >= 35) return 'Warming Up'
  return 'Stranger'
}

// Deliberately its own (tighter, faster) timing check than PoliceStopModal's
// Flee bar, not a shared constant - a pickpocket attempt is a much shorter,
// more precise window than breaking someone's line of sight in a chase.
const PICKPOCKET_SWEEP_PERIOD_MS = 850
const PICKPOCKET_ZONE_WIDTH = 0.12

function randomZone(width) {
  return { start: Math.random() * (1 - width) }
}

export default function NovaModal({ onClose }) {
  const world2 = useGameStore((s) => s.world2)
  const addCash = useGameStore((s) => s.addCash)
  const addWantedLevel = useGameStore((s) => s.addWantedLevel)
  const setRomanceState = useGameStore((s) => s.setRomanceState)

  const romanceState = world2.romanceState || { relationships: {}, spouses: [] }
  const affection = (romanceState.relationships || {}).nova || 0
  const isSpouse = (romanceState.spouses || []).includes('nova')

  // 'talk' -> 'pickpocketAiming' -> 'pickpocketResolved' -> back to 'talk'.
  // Same phase-state-machine shape as PoliceStopModal.jsx.
  const [phase, setPhase] = useState('talk')
  const [mood, setMood] = useState('neutral')
  const [chatHistory, setChatHistory] = useState([])
  const [inputMode, setInputMode] = useState('choice') // 'choice' | 'free'
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState(null)

  const [pickpocketZone] = useState(() => randomZone(PICKPOCKET_ZONE_WIDTH))
  const [markerPos, setMarkerPos] = useState(0.5)
  const markerPosRef = useRef(0.5)
  const startTimeRef = useRef(0)
  const rafRef = useRef(null)
  const [pickpocketResult, setPickpocketResult] = useState(null)

  useEffect(() => {
    if (phase !== 'pickpocketAiming') return
    startTimeRef.current = performance.now()
    const tick = (now) => {
      const elapsed = now - startTimeRef.current
      const pos = (Math.sin((elapsed / PICKPOCKET_SWEEP_PERIOD_MS) * Math.PI * 2) + 1) / 2
      markerPosRef.current = pos
      setMarkerPos(pos)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase])

  const applyAffectionDelta = (delta) => {
    const rels = { ...(romanceState.relationships || {}) }
    const newLevel = Math.max(0, Math.min(100, (rels.nova || 0) + delta))
    rels.nova = newLevel
    setRomanceState({ ...romanceState, relationships: rels })
    return newLevel
  }

  const submitText = async (text, tone) => {
    if (!text.trim() || chatLoading) return
    const historyForRequest = chatHistory.map((h) => ({ role: h.role, text: h.text }))
    setChatHistory((h) => [...h, { role: 'player', text }])
    setChatInput('')
    setChatLoading(true)
    setChatError(false)

    const { reply, ok, agreed, relationshipDelta } = await sendNpcMessage({
      npcId: 'nova',
      playerText: text,
      relationshipTier: affection,
      conversationHistory: historyForRequest,
      character: null,
    })

    setChatHistory((h) => [...h, { role: 'npc', text: reply, agreed: ok ? agreed : null }])
    setChatError(!ok)
    setChatLoading(false)

    let delta = 0
    if (ok && typeof relationshipDelta === 'number') {
      applyAffectionDelta(relationshipDelta)
      delta = relationshipDelta
    }
    // Flirty presets show her flirty portrait when they land; otherwise mood
    // tracks the actual outcome, not just the tone the player tried.
    if (tone === 'flirty' && delta >= 0) setMood('flirty')
    else if (delta > 0) setMood('happy')
    else if (delta < 0) setMood('business')
    else setMood('neutral')
  }

  const handlePreset = (choice) => submitText(choice.label, choice.tone)
  const handleFreeSubmit = (e) => {
    e.preventDefault()
    submitText(chatInput, 'free')
  }

  const handleStartPickpocket = () => setPhase('pickpocketAiming')

  const handlePickpocketAttempt = () => {
    const pos = markerPosRef.current
    const hit = pos >= pickpocketZone.start && pos <= pickpocketZone.start + PICKPOCKET_ZONE_WIDTH
    if (hit) {
      const take = 200 + Math.floor(Math.random() * 600)
      addCash(take)
      setPickpocketResult({ success: true, text: `Smooth. You lift $${take.toLocaleString()} and she never notices.` })
    } else {
      addWantedLevel(1)
      applyAffectionDelta(-25)
      setMood('business')
      setPickpocketResult({ success: false, text: 'She catches your hand mid-reach and is NOT amused. Security is already looking your way.' })
    }
    setPhase('pickpocketResolved')
  }

  const handlePickpocketContinue = () => {
    setPickpocketResult(null)
    setPhase('talk')
  }

  const handlePropose = () => {
    setRomanceState({
      ...romanceState,
      spouses: [...new Set([...(romanceState.spouses || []), 'nova'])],
    })
    setFeedbackMsg('Nova says yes. You two are married.')
  }

  const handleDivorce = () => {
    const cash = useGameStore.getState().cash
    const settlement = Math.floor(cash * 0.5)
    useGameStore.getState().addCash(-settlement)
    setRomanceState({
      ...romanceState,
      spouses: (romanceState.spouses || []).filter((id) => id !== 'nova'),
      relationships: { ...(romanceState.relationships || {}), nova: 0 },
    })
    setFeedbackMsg(`Divorced Nova. Settlement: $${settlement.toLocaleString()}.`)
  }

  const lastNpcLine = [...chatHistory].reverse().find((h) => h.role === 'npc')
  const dialogueText = lastNpcLine ? lastNpcLine.text : INTRO_LINE

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 font-mono">
      <div className="flex max-h-[94vh] w-[720px] max-w-full flex-col border-4 border-fuchsia-500/80 bg-[#1c1229] shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b-[3px] border-fuchsia-500/50 bg-[#241533] px-3 py-2">
          <div>
            <span className="text-sm font-bold text-fuchsia-300">Nova Chase</span>
            <span className="ml-2 text-xs text-fuchsia-400/70">"The Icon"</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs">
              <div className="text-fuchsia-300">{isSpouse ? 'Married' : STAGE_LABEL(affection)}</div>
              <div className="font-bold text-pink-200">{'\u{1F49D}'} {affection}/100</div>
            </div>
            <button onClick={onClose} className="border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700">
              Leave
            </button>
          </div>
        </div>

        {/* portrait arena */}
        <div
          className="relative flex h-[260px] shrink-0 items-end justify-center overflow-hidden [@media(min-height:750px)]:h-[320px]"
          style={{ background: 'linear-gradient(180deg,#3a1f4a 0%,#5a2a5f 55%,#7a3a6a 100%)' }}
        >
          <img
            src={`${PORTRAITS}/nova_${mood}.png`}
            alt=""
            className="h-[92%] w-auto"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>

        {/* pickpocket timing bar */}
        {phase === 'pickpocketAiming' && (
          <div className="border-t-[3px] border-fuchsia-500/50 bg-[#0f1020] p-4">
            <p className="mb-2 text-sm text-gray-300">Time it right to lift her wallet unnoticed.</p>
            <div className="relative mb-3 h-5 w-full border border-gray-600 bg-black">
              <div
                className="absolute top-0 h-full bg-green-700/50"
                style={{ left: `${pickpocketZone.start * 100}%`, width: `${PICKPOCKET_ZONE_WIDTH * 100}%` }}
              />
              <div className="absolute top-0 h-full w-[3px] bg-yellow-300" style={{ left: `${markerPos * 100}%` }} />
            </div>
            <button
              onClick={handlePickpocketAttempt}
              className="w-full border-4 border-yellow-300 bg-yellow-400 py-2 font-bold text-black hover:bg-yellow-300"
            >
              Go For It
            </button>
          </div>
        )}

        {phase === 'pickpocketResolved' && pickpocketResult && (
          <div className="border-t-[3px] border-fuchsia-500/50 bg-[#0f1020] p-4 text-center">
            <p className={`mb-3 text-sm ${pickpocketResult.success ? 'text-green-400' : 'text-red-400'}`}>
              {pickpocketResult.text}
            </p>
            <button
              onClick={handlePickpocketContinue}
              className="border-4 border-gray-500 px-6 py-2 font-bold text-white hover:bg-gray-700"
            >
              Continue
            </button>
          </div>
        )}

        {/* dialogue + input */}
        {phase === 'talk' && (
          <>
            <div className="min-h-[80px] flex-1 border-t-[3px] border-fuchsia-500/50 bg-[#f6f0f4] px-3 py-2">
              <p className="text-xs font-bold text-fuchsia-700">Nova</p>
              <p className="text-sm leading-snug text-[#22222a]">{dialogueText}</p>
              {lastNpcLine && lastNpcLine.agreed !== null && (
                <p className={`mt-1 text-xs font-bold ${lastNpcLine.agreed ? 'text-emerald-600' : 'text-red-600'}`}>
                  {lastNpcLine.agreed ? '✓ She goes for it.' : '✗ Not buying it.'}
                </p>
              )}
              {chatError && (
                <p className="mt-1 text-xs italic text-red-500">
                  (Couldn't reach the NPC chat backend - is it running? See backend/README.md.)
                </p>
              )}
            </div>

            <div className="border-t-[3px] border-fuchsia-500/50 bg-[#1c1229] p-3">
              <div className="mb-2 flex gap-2 text-xs">
                <button
                  onClick={() => setInputMode('choice')}
                  className={`border px-2 py-1 ${inputMode === 'choice' ? 'border-fuchsia-400 bg-fuchsia-900/50 text-fuchsia-200' : 'border-gray-700 text-gray-400'}`}
                >
                  Choices
                </button>
                <button
                  onClick={() => setInputMode('free')}
                  className={`border px-2 py-1 ${inputMode === 'free' ? 'border-fuchsia-400 bg-fuchsia-900/50 text-fuchsia-200' : 'border-gray-700 text-gray-400'}`}
                >
                  Type your own
                </button>
              </div>

              {inputMode === 'choice' ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {PRESET_CHOICES.map((choice) => (
                    <button
                      key={choice.key}
                      onClick={() => handlePreset(choice)}
                      disabled={chatLoading}
                      className="border border-fuchsia-500/50 bg-[#241533] px-2 py-2 text-left text-xs text-fuchsia-100 hover:bg-fuchsia-900/50 disabled:opacity-40"
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
                    placeholder="Say something to Nova..."
                    disabled={chatLoading}
                    maxLength={500}
                    className="flex-1 border-2 border-fuchsia-500/60 bg-black/70 px-2 py-1 text-sm text-white placeholder:text-gray-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={chatLoading || !chatInput.trim()}
                    className="border-2 border-fuchsia-400 px-3 py-1 text-sm font-bold text-fuchsia-300 hover:bg-fuchsia-400 hover:text-black disabled:opacity-30"
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

              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleStartPickpocket}
                  className="flex-1 border border-red-600/70 bg-red-950/40 py-1.5 text-xs font-bold text-red-300 hover:bg-red-900/60"
                >
                  {'\u{1F575}️'} Pickpocket
                </button>
                {!isSpouse && affection >= 100 && (
                  <button
                    onClick={handlePropose}
                    className="flex-1 border border-yellow-400 bg-yellow-950/40 py-1.5 text-xs font-bold text-yellow-300 hover:bg-yellow-900/60"
                  >
                    {'\u{1F48D}'} Propose
                  </button>
                )}
                {isSpouse && (
                  <button
                    onClick={handleDivorce}
                    className="flex-1 border border-red-500 bg-red-950/40 py-1.5 text-xs font-bold text-red-300 hover:bg-red-900/60"
                  >
                    {'\u{1F494}'} Divorce
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
