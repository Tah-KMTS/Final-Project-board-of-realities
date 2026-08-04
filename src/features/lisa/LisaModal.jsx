import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { sendNpcMessage } from '../../utils/npcChatClient'

// Lisa Manobal - the Capital Syndicate roster's first entertainment-world
// titan. Deliberately NOT part of the 90-character finance/crime/government
// roster (characterLookup.js) - see backend/main.py's NPC_PERSONAS['lisa'] for
// why: she's a hand-authored persona, same simple pattern 'tea'/
// 'marriageCandidate' already use, not the roster-driven
// build_character_persona path.
//
// This is a UI-polish pilot, not a new game mode: every action here (small
// talk, a gift, pitching an investment, a hidden-agenda hustle, a pickpocket
// attempt) is the same category of verb the other 90 NPCs already support via
// NamedNpcModal's free-text persuasion chat + relationship meter + recruit/
// date buttons - this is that same mechanic in a nicer full-bleed presentation,
// piloted on one character first. The "romanceable" flag and Propose/Divorce
// buttons are the same fields NamedNpcModal already exposes for the entire
// roster, not something new invented for her.
//
// Portraits are transparent cutouts (built from packs/Lisa/"Lisa no bg") so
// each mood can be composited over ANY scene background - the pre-composited
// "Lisa w bg" set would lock one emotion to one location. Backgrounds come
// from packs/Lisa/Background. Which scene shows depends on where she
// actually is when you talk to her (see SCENE_FOR_BUILDING), so catching her
// at the station looks different from catching her at her HQ.
const PORTRAITS = '/assets/packs/Lisa/portraits'
const SCENES = '/assets/packs/Lisa/scenes'

// Her worldPresenceEngine building -> the backdrop that matches it. Falls
// back to the cafe interior, the most "having a conversation" of the set.
const SCENE_FOR_BUILDING = {
  lisaHq: 'cafe',
  businessCenter: 'cafe_exterior',
  entertainmentComplex: 'street',
  trainStation: 'station',
  stockExchange: 'street',
  casino: 'street',
}
const DEFAULT_SCENE = 'cafe'

const DISCLAIMER =
  'Fictional characterization for a class project - not a real endorsement, and not a claim about the real person’s actual views or private life. Not for public distribution.'

const INTRO_LINE =
  "Oh - hey. Don't see a lot of new faces around here who aren't already holding a phone up at me."

// Tone varies the preset's flavor; agreed/relationshipDelta are still decided
// live by the backend from Lisa's own persona (see PERSUASION_INSTRUCTIONS in
// backend/main.py) - a preset is just a canned phrasing, not a shortcut that
// skips her judgment. 'hustle' is the hidden-agenda option: a barely-dressed-
// up ask, evaluated the same as anything the player might type themselves.
// Deliberately business/rapport-flavored, not romance-flavored - see this
// file's header on why this is a UI pilot for the existing interaction
// system, not a new romance-focused mode.
const PRESET_CHOICES = [
  { key: 'smalltalk', label: 'So what’s the day-to-day actually like?', tone: 'smalltalk' },
  { key: 'curious', label: 'What made you move from music into running a company?', tone: 'curious' },
  { key: 'pitch', label: 'Word is your empire’s bigger than your discography now - got room for one more investor?', tone: 'pitch' },
  { key: 'hustle', label: 'I’ve got a can’t-miss investment - you in?', tone: 'hustle' },
]

// Gifts are a direct action (spend cash, gain affection), not a chat message -
// no existing gift mechanic to reuse anywhere in this codebase (checked), so
// this is new, minimal, and modeled on the genre-standard "cost buys a flat
// relationship gain" convention already implied by courtCharacter.js's own
// date-tier gains (15/25/35 for diner/opera/proposal).
const GIFTS = [
  { key: 'small', label: 'Coffee run', cost: 150, gain: 4 },
  { key: 'nice', label: 'Designer scarf', cost: 1200, gain: 10 },
  { key: 'lavish', label: 'Rare vinyl press of her first album', cost: 6000, gain: 20 },
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

export default function LisaModal({ onClose, buildingId }) {
  const world2 = useGameStore((s) => s.world2)
  const cash = useGameStore((s) => s.cash)
  const addCash = useGameStore((s) => s.addCash)
  const addWantedLevel = useGameStore((s) => s.addWantedLevel)
  const setRomanceState = useGameStore((s) => s.setRomanceState)

  const romanceState = world2.romanceState || { relationships: {}, spouses: [] }
  const affection = (romanceState.relationships || {}).lisa || 0
  const isSpouse = (romanceState.spouses || []).includes('lisa')

  // 'talk' -> 'gift' | 'pickpocketAiming' -> 'pickpocketResolved' -> back to
  // 'talk'. Same phase-state-machine shape as PoliceStopModal.jsx.
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
    const newLevel = Math.max(0, Math.min(100, (rels.lisa || 0) + delta))
    rels.lisa = newLevel
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
      npcId: 'lisa',
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
    // Reaction reads off BOTH how much she liked it and what kind of thing
    // was said - a big win to a flirty line looks different from a big win
    // to a business pitch, and a failed hustle should look put-off rather
    // than merely neutral.
    if (delta >= 2) setMood(tone === 'pitch' ? 'business' : 'delighted')
    else if (delta > 0) setMood(tone === 'smalltalk' ? 'amused' : 'happy')
    else if (delta < 0) setMood('annoyed')
    else if (tone === 'hustle') setMood('annoyed')
    else if (tone === 'pitch') setMood('business')
    else if (tone === 'curious') setMood('playful')
    else setMood('neutral')
  }

  const handlePreset = (choice) => submitText(choice.label, choice.tone)
  const handleFreeSubmit = (e) => {
    e.preventDefault()
    submitText(chatInput, 'free')
  }

  const handleGift = (gift) => {
    if (cash < gift.cost) {
      setFeedbackMsg(`Not enough cash for that ($${gift.cost.toLocaleString()}).`)
      return
    }
    addCash(-gift.cost)
    applyAffectionDelta(gift.gain)
    setMood('happy')
    setFeedbackMsg(`She's genuinely pleased with the ${gift.label.toLowerCase()}. (+${gift.gain} affection)`)
    setPhase('talk')
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
      setMood('annoyed')
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
      spouses: [...new Set([...(romanceState.spouses || []), 'lisa'])],
    })
    setFeedbackMsg('She says yes. You two are married.')
  }

  const handleDivorce = () => {
    const settlement = Math.floor(useGameStore.getState().cash * 0.5)
    useGameStore.getState().addCash(-settlement)
    setRomanceState({
      ...romanceState,
      spouses: (romanceState.spouses || []).filter((id) => id !== 'lisa'),
      relationships: { ...(romanceState.relationships || {}), lisa: 0 },
    })
    setFeedbackMsg(`Divorced. Settlement: $${settlement.toLocaleString()}.`)
  }

  const lastNpcLine = [...chatHistory].reverse().find((h) => h.role === 'npc')
  const dialogueText = lastNpcLine ? lastNpcLine.text : INTRO_LINE

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 font-mono">
      <div className="flex max-h-[94vh] w-[720px] max-w-full flex-col border-4 border-fuchsia-500/80 bg-[#1c1229] shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b-[3px] border-fuchsia-500/50 bg-[#241533] px-3 py-2">
          <div>
            <span className="text-sm font-bold text-fuchsia-300">Lisa Manobal</span>
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

        {/* Always-visible disclaimer - not tucked in a tooltip, since this is
            the piece that matters most to get right: a fictional characterization,
            not a claim about the real person, and not for public distribution. */}
        <div className="border-b border-fuchsia-500/30 bg-black/40 px-3 py-1 text-center text-[10px] leading-tight text-fuchsia-300/70">
          {DISCLAIMER}
        </div>

        {/* Scene: location backdrop + her cutout composited on top. The
            backdrop is blurred and dimmed slightly so she reads as the
            in-focus subject rather than competing with a sharp photographic
            background - the same depth-of-field cue the "Lisa w bg" source
            images use, reproduced here so it works with any scene/mood pair. */}
        <div className="relative h-[260px] shrink-0 overflow-hidden [@media(min-height:750px)]:h-[330px]">
          <img
            src={`${SCENES}/${SCENE_FOR_BUILDING[buildingId] || DEFAULT_SCENE}.jpg`}
            alt=""
            className="absolute inset-0 h-full w-full scale-105 object-cover blur-[2px] brightness-[0.72]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/25" />
          <img
            key={mood}
            src={`${PORTRAITS}/lisa_${mood}.png`}
            alt=""
            className="animate-portrait-swap absolute bottom-0 left-1/2 h-[104%] w-auto -translate-x-1/2 drop-shadow-[0_6px_18px_rgba(0,0,0,0.55)]"
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

        {phase === 'gift' && (
          <div className="border-t-[3px] border-fuchsia-500/50 bg-[#0f1020] p-4">
            <p className="mb-2 text-sm text-gray-300">Pick something to give her.</p>
            <div className="flex flex-col gap-1.5">
              {GIFTS.map((gift) => (
                <button
                  key={gift.key}
                  onClick={() => handleGift(gift)}
                  disabled={cash < gift.cost}
                  className="flex items-center justify-between border border-fuchsia-500/50 bg-[#241533] px-3 py-2 text-left text-sm text-fuchsia-100 hover:bg-fuchsia-900/50 disabled:opacity-30"
                >
                  <span>{gift.label}</span>
                  <span className="text-xs text-fuchsia-300">${gift.cost.toLocaleString()} · +{gift.gain}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setPhase('talk')}
              className="mt-2 w-full border border-gray-600 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
            >
              Never mind
            </button>
          </div>
        )}

        {/* dialogue + input */}
        {phase === 'talk' && (
          <>
            <div className="min-h-[80px] flex-1 border-t-[3px] border-fuchsia-500/50 bg-[#f6f0f4] px-3 py-2">
              <p className="text-xs font-bold text-fuchsia-700">Lisa</p>
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
                    placeholder="Say something to Lisa..."
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
                  onClick={() => setPhase('gift')}
                  className="flex-1 border border-fuchsia-400/70 bg-fuchsia-950/40 py-1.5 text-xs font-bold text-fuchsia-200 hover:bg-fuchsia-900/60"
                >
                  {'\u{1F381}'} Give Gift
                </button>
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
