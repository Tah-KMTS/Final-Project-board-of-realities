import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { sendNpcMessage } from '../../utils/npcChatClient'

// Lisa Manobal - the Capital Syndicate roster's first entertainment-world
// titan. She IS a real FINANCE_NPCS roster member (financeNpcs.js) - that's
// what makes spawnNamedRoamers() walk her around the map and
// characterHomeBuildings.js generate her a real, findable home building
// (home_lisa, "Starlight Media HQ") - the same mechanism every other named
// character uses. Her dialogue still runs through a hand-authored backend
// persona (backend/main.py's NPC_PERSONAS['lisa'], the same simple pattern
// 'tea'/'marriageCandidate' use) rather than the roster-driven
// build_character_persona path, since her personality is bespoke, not
// generated from FINANCE_NPCS' stat fields.
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
// back to the cafe interior, the most "having a conversation" of the set -
// that fallback is also what covers home_lisa (her own residence has no
// dedicated backdrop art of its own).
const SCENE_FOR_BUILDING = {
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

// --- Relationship tiers ------------------------------------------------
// Same 35/70 breakpoints STAGE_LABEL always displayed, now wired to actually
// gate content instead of just relabeling text - see LisaModal brainstorm
// notes: the meter didn't "feel meaningful" because nothing actually changed
// as it rose. These three tiers are the single source of truth every
// gate below (bonus openers, bonus gifts, Ask Her Out, Pickpocket) reads.
function getTier(affection) {
  if (affection >= 70) return 'close'
  if (affection >= 35) return 'warmingUp'
  return 'stranger'
}
const STAGE_LABEL = (affection) => {
  const tier = getTier(affection)
  if (tier === 'close') return 'Close'
  if (tier === 'warmingUp') return 'Warming Up'
  return 'Stranger'
}

// The OPENING move only - there's no conversation yet for the model to
// react to, so this is the one fixed menu in the whole flow. Every turn
// after this one shows the backend's own suggestedReplies instead (see
// submitText/currentChoices below), so the options actually evolve with
// where the conversation goes rather than repeating this same set forever.
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

// Extra openers that unlock alongside PRESET_CHOICES once the tier's been
// reached, cumulative (Close keeps the Warming Up one too) - a small, real
// sign that she's let the player past the opening 4 categories, without
// touching the backend's own dynamic suggestedReplies for every turn after
// the opener.
const BONUS_OPENERS = [
  { minAffection: 35, key: 'callback', label: 'Been thinking about you since last time.', tone: 'smalltalk' },
  { minAffection: 70, key: 'backstage', label: 'Skip the show for a second - what’s actually on your mind lately?', tone: 'curious' },
]

// Gifts are a direct action (spend cash, gain affection), not a chat message -
// no existing gift mechanic to reuse anywhere in this codebase (checked), so
// this is new, minimal, and modeled on the genre-standard "cost buys a flat
// relationship gain" convention already implied by courtCharacter.js's own
// date-tier gains (15/25/35 for diner/opera/proposal). The two tier-gated
// entries below deliberately have a BETTER cost-to-gain ratio than 'nice' -
// they read as "I know you" rather than "I can outspend the last gift",
// which only makes sense once she's actually let the player see that far.
const GIFTS = [
  { key: 'small', label: 'Coffee run', cost: 150, gain: 4 },
  { key: 'nice', label: 'Designer scarf', cost: 1200, gain: 10 },
  { key: 'lavish', label: 'Rare vinyl press of her first album', cost: 6000, gain: 20, memorable: true },
  { key: 'personal', label: 'Mixtape of songs from before she was famous', cost: 400, gain: 14, minAffection: 35 },
  { key: 'intimate', label: 'Framed photo from her very first show', cost: 2500, gain: 22, minAffection: 70, memorable: true },
]

// --- Date mini-game ------------------------------------------------------
// Deliberately its own (slower, more forgiving) timing check than
// PoliceStopModal's Flee bar or the Pickpocket sweep below - a date's "catch
// the moment" beat should feel like a payoff for reaching Warming Up, not
// another tense skill check. Separate constants/refs from the pickpocket
// ones on purpose so the two minigames can be tuned independently even
// though they share the same sine-sweep-timing-bar mechanic.
const DATE_SWEEP_PERIOD_MS = 1100
const DATE_ZONE_WIDTH = 0.16
const DATE_HIT_GAIN = 25 // matches courtCharacter.js's date_opera tier
const DATE_MISS_GAIN = 8 // still a net positive - a so-so date isn't a punishment

const DATE_BEATS = [
  'You clear your evening and actually ask her out - properly, not a "grab coffee sometime." She looks surprised for half a second, then genuinely pleased.',
  'The café’s quiet enough to actually talk. A few numbers get thrown around, a few old stories come out, and for a while neither of you is performing for anyone.',
]

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
  const day = useGameStore((s) => s.day)
  const cash = useGameStore((s) => s.cash)
  const addCash = useGameStore((s) => s.addCash)
  const addWantedLevel = useGameStore((s) => s.addWantedLevel)
  const setRomanceState = useGameStore((s) => s.setRomanceState)

  const romanceState = world2.romanceState || { relationships: {}, spouses: [], datingHistory: [], chatLog: {}, lastDateDay: {} }
  const affection = (romanceState.relationships || {}).lisa || 0
  const isSpouse = (romanceState.spouses || []).includes('lisa')
  const tier = getTier(affection)
  const lastDateDay = (romanceState.lastDateDay || {}).lisa
  const dateAvailableToday = lastDateDay == null || lastDateDay < day

  // 'talk' -> 'gift' | 'pickpocketAiming' -> 'pickpocketResolved' -> back to
  // 'talk'; 'dateIntro' -> 'dateGame' -> 'dateResult' -> back to 'talk';
  // 'history' -> back to 'talk'. Same phase-state-machine shape as
  // PoliceStopModal.jsx, just with more branches.
  const [phase, setPhase] = useState('talk')
  const [mood, setMood] = useState('neutral')
  // Lazy-init straight from the persisted transcript (romanceState.chatLog.lisa)
  // instead of always starting empty - see the sync effect below for the
  // write-back half of this. This is what makes reopening the modal (or a
  // fresh session) pick the conversation back up instead of resetting to
  // INTRO_LINE every time.
  const [chatHistory, setChatHistory] = useState(() => (world2.romanceState?.chatLog?.lisa) || [])
  // null until the first real reply lands, then holds the LLM's own 4
  // contextual next-lines (see backend/main.py's SUGGESTED_REPLIES_
  // INSTRUCTIONS) - PRESET_CHOICES below is only ever shown as the opening
  // move, before there's any conversation for the model to react to.
  // Without this the "Choices" tab showed the exact same 4 buttons forever
  // regardless of what was actually said, which read as no progression at
  // all - every subsequent turn now gets a fresh set shaped by what she just
  // said and how the exchange is going.
  const [dynamicChoices, setDynamicChoices] = useState(null)
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

  const [dateStep, setDateStep] = useState(0)
  const [dateZone, setDateZone] = useState(() => randomZone(DATE_ZONE_WIDTH))
  const [dateMarkerPos, setDateMarkerPos] = useState(0.5)
  const dateMarkerPosRef = useRef(0.5)
  const dateStartTimeRef = useRef(0)
  const dateRafRef = useRef(null)
  const [dateResult, setDateResult] = useState(null)

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

  useEffect(() => {
    if (phase !== 'dateGame') return
    dateStartTimeRef.current = performance.now()
    const tick = (now) => {
      const elapsed = now - dateStartTimeRef.current
      const pos = (Math.sin((elapsed / DATE_SWEEP_PERIOD_MS) * Math.PI * 2) + 1) / 2
      dateMarkerPosRef.current = pos
      setDateMarkerPos(pos)
      dateRafRef.current = requestAnimationFrame(tick)
    }
    dateRafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(dateRafRef.current)
  }, [phase])

  // Write-back half of chatHistory's lazy-init read above: every time the
  // transcript changes (a player message lands, a reply lands), persist it
  // into romanceState.chatLog.lisa so History survives closing the modal -
  // and reading useGameStore.getState() fresh here (rather than the
  // `romanceState` closure) avoids clobbering a lastDateDay/datingHistory
  // write that a different handler made moments earlier in the same tick.
  useEffect(() => {
    if (chatHistory.length === 0) return
    const rs = useGameStore.getState().world2.romanceState || {}
    const chatLog = { ...(rs.chatLog || {}) }
    chatLog.lisa = chatHistory.slice(-80)
    setRomanceState({ ...rs, chatLog })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatHistory])

  const applyAffectionDelta = (delta) => {
    const rels = { ...(romanceState.relationships || {}) }
    const newLevel = Math.max(0, Math.min(100, (rels.lisa || 0) + delta))
    rels.lisa = newLevel
    setRomanceState({ ...romanceState, relationships: rels })
    return newLevel
  }

  // Shared by anything that should leave a trace she can bring up later
  // (a big gift, a completed date, a proposal) - reads/writes the store
  // directly in one shot rather than composing the `romanceState` closure
  // with applyAffectionDelta, since some callers (the date outcome) also
  // need to touch lastDateDay in the same write. `extra` can be a function
  // of the just-read state so it never works off a stale snapshot.
  const pushMemoryAndDelta = ({ deltaAffection = 0, memoryText = null, extra = null }) => {
    const rs = useGameStore.getState().world2.romanceState || { relationships: {}, spouses: [], datingHistory: [], chatLog: {}, lastDateDay: {} }
    const rels = { ...(rs.relationships || {}) }
    const newLevel = Math.max(0, Math.min(100, (rels.lisa || 0) + deltaAffection))
    rels.lisa = newLevel
    const datingHistory = memoryText
      ? [{ id: `lisa_mem_${Date.now()}`, npcId: 'lisa', text: memoryText }, ...(rs.datingHistory || [])].slice(0, 20)
      : rs.datingHistory || []
    const extraFields = typeof extra === 'function' ? extra(rs) : extra || {}
    setRomanceState({ ...rs, relationships: rels, datingHistory, ...extraFields })
    return newLevel
  }

  // A short, most-recent-first digest of what's actually happened between
  // them (gifts, dates, the proposal) - passed as `situationContext`
  // (npcChatClient.js's existing free-text scene-state field, already wired
  // through to the backend prompt's "=== CURRENT SITUATION ===" block, no
  // backend changes needed) so she can reference real history instead of
  // greeting the player like a stranger every visit.
  const buildMemoryContext = () => {
    const memories = (romanceState.datingHistory || []).filter((m) => m.npcId === 'lisa').slice(0, 5)
    if (!memories.length) return null
    return 'What has actually happened between you and the player so far, most recent first:\n' + memories.map((m) => `- ${m.text}`).join('\n')
  }

  const submitText = async (text, tone) => {
    if (!text.trim() || chatLoading) return
    const historyForRequest = chatHistory.map((h) => ({ role: h.role, text: h.text }))
    setChatHistory((h) => [...h, { role: 'player', text }])
    setChatInput('')
    setChatLoading(true)
    setChatError(false)

    const { reply, ok, agreed, relationshipDelta, suggestedReplies } = await sendNpcMessage({
      npcId: 'lisa',
      playerText: text,
      relationshipTier: affection,
      conversationHistory: historyForRequest,
      character: null,
      situationContext: buildMemoryContext(),
    })

    setChatHistory((h) => [...h, { role: 'npc', text: reply, agreed: ok ? agreed : null }])
    setChatError(!ok)
    setChatLoading(false)
    // On failure just leave whatever choices were already showing in place
    // (nothing new to react to) rather than overwriting them with an empty
    // list - a dropped request shouldn't strand the player with no options.
    if (ok && suggestedReplies.length) setDynamicChoices(suggestedReplies)

    let delta = 0
    if (ok && typeof relationshipDelta === 'number') {
      applyAffectionDelta(relationshipDelta)
      delta = relationshipDelta
    }
    // Reaction reads off BOTH how much she liked it and what kind of thing
    // was said - a big win to a flirty line looks different from a big win
    // to a business pitch, and a failed hustle should look put-off rather
    // than merely neutral. 'flirty'/'giddy' are the two big-win reactions
    // that are specifically about HER warming up to the player personally
    // (smalltalk/curious) rather than being impressed by a pitch, and
    // 'fierce' is a sharper, more pointed reaction than plain 'annoyed' -
    // reserved for when the player's message actually cost real ground
    // (delta <= -2), not just a lukewarm miss.
    if (delta >= 2) {
      if (tone === 'pitch') setMood('business')
      else if (tone === 'smalltalk') setMood('flirty')
      else if (tone === 'curious') setMood('giddy')
      else setMood('delighted')
    } else if (delta > 0) setMood(tone === 'smalltalk' ? 'amused' : 'happy')
    else if (delta <= -2) setMood('fierce')
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
    if (gift.memorable) {
      pushMemoryAndDelta({ deltaAffection: gift.gain, memoryText: `Gave her the ${gift.label.toLowerCase()} - she was genuinely moved.` })
    } else {
      applyAffectionDelta(gift.gain)
    }
    // The lavish/intimate gifts (genuinely personal, high-effort picks) get
    // the swept-up 'giddy' reaction instead of the flatter default 'happy'
    // the smaller, more casual gifts still use.
    setMood(gift.key === 'lavish' || gift.key === 'intimate' ? 'giddy' : 'happy')
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

  // --- Date flow ---------------------------------------------------------
  const handleAskOut = () => {
    if (!dateAvailableToday) return
    setDateStep(0)
    setPhase('dateIntro')
  }

  const handleDateContinue = () => {
    if (dateStep < DATE_BEATS.length - 1) {
      setDateStep((s) => s + 1)
      return
    }
    setDateZone(randomZone(DATE_ZONE_WIDTH))
    setPhase('dateGame')
  }

  const handleDateMoment = () => {
    const pos = dateMarkerPosRef.current
    const hit = pos >= dateZone.start && pos <= dateZone.start + DATE_ZONE_WIDTH
    const gain = hit ? DATE_HIT_GAIN : DATE_MISS_GAIN
    const currentDay = day
    pushMemoryAndDelta({
      deltaAffection: gain,
      memoryText: hit
        ? 'Took her out to the café and caught the moment exactly right - she was delighted.'
        : 'Took her out to the café - a little clumsy, but still a good night.',
      extra: (rs) => ({ lastDateDay: { ...(rs.lastDateDay || {}), lisa: currentDay } }),
    })
    setMood(hit ? 'giddy' : 'happy')
    setDateResult({
      success: hit,
      text: hit
        ? 'You catch the moment exactly right. She laughs - actually laughs - and for a second it doesn’t feel like a stage persona at all.'
        : 'It’s a beat too early, a little clumsy - but she doesn’t seem to mind. Still a good night.',
      gain,
    })
    setPhase('dateResult')
  }

  const handleDateResultContinue = () => {
    setDateResult(null)
    setPhase('talk')
  }

  const handlePropose = () => {
    const rs = useGameStore.getState().world2.romanceState || {}
    const spouses = [...new Set([...(rs.spouses || []), 'lisa'])]
    const datingHistory = [{ id: `lisa_mem_${Date.now()}`, npcId: 'lisa', text: 'You proposed. She said yes.' }, ...(rs.datingHistory || [])].slice(0, 20)
    setRomanceState({ ...rs, spouses, datingHistory })
    setFeedbackMsg('She says yes. You two are married.')
  }

  const handleDivorce = () => {
    const settlement = Math.floor(useGameStore.getState().cash * 0.5)
    useGameStore.getState().addCash(-settlement)
    const rs = useGameStore.getState().world2.romanceState || {}
    const datingHistory = [{ id: `lisa_mem_${Date.now()}`, npcId: 'lisa', text: 'The marriage ended in divorce.' }, ...(rs.datingHistory || [])].slice(0, 20)
    setRomanceState({
      ...rs,
      spouses: (rs.spouses || []).filter((id) => id !== 'lisa'),
      relationships: { ...(rs.relationships || {}), lisa: 0 },
      datingHistory,
    })
    setFeedbackMsg(`Divorced. Settlement: $${settlement.toLocaleString()}.`)
  }

  const lastNpcLine = [...chatHistory].reverse().find((h) => h.role === 'npc')
  const dialogueText = lastNpcLine ? lastNpcLine.text : INTRO_LINE
  // Static PRESET_CHOICES + whatever bonus openers this tier has unlocked
  // only ever cover the opening move, before there's a real conversation
  // for the model to react to - every choice after that comes straight
  // from the reply that just landed (see submitText).
  const unlockedBonusOpeners = BONUS_OPENERS.filter((b) => affection >= b.minAffection)
  const openingChoices = [...PRESET_CHOICES, ...unlockedBonusOpeners]
  const currentChoices = dynamicChoices
    ? dynamicChoices.map((label, i) => ({ key: `dyn-${i}`, label, tone: 'free' }))
    : openingChoices
  const visibleGifts = GIFTS.filter((g) => affection >= (g.minAffection || 0))

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
            <button
              onClick={() => setPhase('history')}
              className="border border-fuchsia-500/50 px-2 py-1 text-xs text-fuchsia-300 hover:bg-fuchsia-900/50"
            >
              {'\u{1F4DC}'} History
            </button>
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
            images use, reproduced here so it works with any scene/mood pair.
            Hidden during History since that panel needs the vertical room. */}
        {phase !== 'history' && (
          <div className="relative h-[260px] shrink-0 overflow-hidden [@media(min-height:750px)]:h-[330px]">
            <img
              src={`${SCENES}/${phase === 'dateIntro' || phase === 'dateGame' || phase === 'dateResult' ? DEFAULT_SCENE : SCENE_FOR_BUILDING[buildingId] || DEFAULT_SCENE}.jpg`}
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
        )}

        {/* full chat transcript - what you said and what she said, in order,
            newest at the bottom. Persisted via romanceState.chatLog.lisa (see
            the sync effect above) so it's still here next time the modal opens. */}
        {phase === 'history' && (
          <div className="flex max-h-[420px] flex-1 flex-col overflow-y-auto border-t-[3px] border-fuchsia-500/50 bg-[#0f1020] p-3">
            <p className="mb-2 text-xs text-gray-400">Everything you two have said, oldest first.</p>
            {chatHistory.length === 0 ? (
              <p className="text-sm italic text-gray-500">Nothing yet - say something to her first.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {chatHistory.map((h, i) => (
                  <div key={i} className={h.role === 'player' ? 'text-right' : 'text-left'}>
                    <p className={`text-[10px] font-bold ${h.role === 'player' ? 'text-cyan-300' : 'text-fuchsia-300'}`}>
                      {h.role === 'player' ? 'You' : 'Lisa'}
                    </p>
                    <p
                      className={`inline-block max-w-[85%] rounded px-2 py-1 text-sm ${
                        h.role === 'player' ? 'bg-cyan-950/50 text-cyan-100' : 'bg-fuchsia-950/50 text-fuchsia-100'
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

        {/* date: 2 narrative beats, then the "catch the moment" mini-game,
            then the outcome - unlocked at Warming Up (35+), once per
            in-game day (see dateAvailableToday, mirrors world2.bossJobLastDay's
            cooldown pattern in useGameStore.js). */}
        {phase === 'dateIntro' && (
          <div className="border-t-[3px] border-fuchsia-500/50 bg-[#0f1020] p-4">
            <p className="mb-3 text-sm leading-snug text-gray-200">{DATE_BEATS[dateStep]}</p>
            <button
              onClick={handleDateContinue}
              className="w-full border-4 border-pink-400 bg-pink-500/80 py-2 font-bold text-black hover:bg-pink-400"
            >
              Continue
            </button>
          </div>
        )}

        {phase === 'dateGame' && (
          <div className="border-t-[3px] border-fuchsia-500/50 bg-[#0f1020] p-4">
            <p className="mb-2 text-sm text-gray-300">There's a pause - the kind where what you say next actually matters. Time it right.</p>
            <div className="relative mb-3 h-5 w-full border border-gray-600 bg-black">
              <div
                className="absolute top-0 h-full bg-pink-600/50"
                style={{ left: `${dateZone.start * 100}%`, width: `${DATE_ZONE_WIDTH * 100}%` }}
              />
              <div className="absolute top-0 h-full w-[3px] bg-yellow-300" style={{ left: `${dateMarkerPos * 100}%` }} />
            </div>
            <button
              onClick={handleDateMoment}
              className="w-full border-4 border-pink-300 bg-pink-400 py-2 font-bold text-black hover:bg-pink-300"
            >
              Say It
            </button>
          </div>
        )}

        {phase === 'dateResult' && dateResult && (
          <div className="border-t-[3px] border-fuchsia-500/50 bg-[#0f1020] p-4 text-center">
            <p className={`mb-2 text-sm ${dateResult.success ? 'text-pink-300' : 'text-gray-300'}`}>{dateResult.text}</p>
            <p className="mb-3 text-xs font-bold text-pink-200">+{dateResult.gain} affection</p>
            <button
              onClick={handleDateResultContinue}
              className="border-4 border-gray-500 px-6 py-2 font-bold text-white hover:bg-gray-700"
            >
              Continue
            </button>
          </div>
        )}

        {/* pickpocket timing bar - hidden once she's Close (70+); doesn't fit
            "you're basically together" anymore. */}
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
              {visibleGifts.map((gift) => (
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
                  {currentChoices.map((choice) => (
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

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => setPhase('gift')}
                  className="flex-1 border border-fuchsia-400/70 bg-fuchsia-950/40 py-1.5 text-xs font-bold text-fuchsia-200 hover:bg-fuchsia-900/60"
                >
                  {'\u{1F381}'} Give Gift
                </button>
                {tier !== 'stranger' && !isSpouse && (
                  <button
                    onClick={handleAskOut}
                    disabled={!dateAvailableToday}
                    title={dateAvailableToday ? undefined : 'Already spent time with her today - come back tomorrow.'}
                    className="flex-1 border border-pink-400/70 bg-pink-950/40 py-1.5 text-xs font-bold text-pink-200 hover:bg-pink-900/60 disabled:opacity-30"
                  >
                    {'\u{1F495}'} {dateAvailableToday ? 'Ask Her Out' : 'Already Done Today'}
                  </button>
                )}
                {tier !== 'close' && (
                  <button
                    onClick={handleStartPickpocket}
                    className="flex-1 border border-red-600/70 bg-red-950/40 py-1.5 text-xs font-bold text-red-300 hover:bg-red-900/60"
                  >
                    {'\u{1F575}️'} Pickpocket
                  </button>
                )}
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
