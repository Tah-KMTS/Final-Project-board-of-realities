import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { sendNpcMessage } from '../../utils/npcChatClient'
import PoliceFightModal from './PoliceFightModal'

// The "real arrest pipeline" - the choice screen shown first when a chased-
// down police/FBI encounter (OverworldScene.js's triggerPoliceArrestEncounter)
// or a witnessed-crime jail roll opens this modal. Four top-level options,
// each its own committed branch (none loop back to this screen):
//   - Fight: PoliceFightModal (Punch/Kick/Use Weapon/Special Move)
//   - Escape: the existing timing-bar Flee minigame
//   - Bribe: the existing flat-cost bribe attempt
//   - Talk: free-text/preset dialogue with a real LLM-backed officer persona
//     (backend/main.py's NPC_PERSONAS['police']) that can end the stop
//     immediately, for better or worse - see TALK_MAX_ATTEMPTS below.
// Bribe/Escape failing still drops into Fight (the player gets a chance to
// throw hands); Talk failing arrests the player directly, no fight chance -
// a real officer doesn't offer a do-over once they've decided you're lying
// or being hostile, which is also the more severe, more distinct-from-
// Bribe/Escape outcome the "let you go or arrest you right away" request
// specifically asked for.
//
// bailDiscountMultiplier: only ever non-1 on the witnessed-crime path
// (applyCrimeOutcome's home-turf syndicate discount, carried on
// useGameStore's pendingCrimeArrest request since this modal only knows
// wantedLevel/isFBI, not which syndicate job it came from). Threaded
// straight through to every sendToJail() call in this file so that discount
// still applies on a Fight loss or an arrested Talk outcome, same as it
// always did when applyCrimeOutcome called sendToJail directly.

const FLEE_SWEEP_PERIOD_MS = 1200

function randomFleeZone(width) {
  return { start: Math.random() * (1 - width) }
}

// Up to 3 exchanges to talk your way out. A single reply landing at or below
// TALK_ARREST_DELTA_THRESHOLD ends it immediately (visibly hostile, an
// obvious lie, attempted bribery in conversation) rather than making the
// player burn through all 3 attempts first - matching how a real officer
// would react to one clearly bad answer, not just a slow accumulation of
// mediocre ones.
const TALK_MAX_ATTEMPTS = 3
const TALK_ARREST_DELTA_THRESHOLD = -2

const TALK_PRESET_CHOICES = [
  { key: 'calm', label: "Is there a problem, officer? I haven't done anything wrong." },
  { key: 'cooperate', label: "Look, I don't want any trouble. What do you need from me?" },
  { key: 'deflect', label: "You've got the wrong person - check again." },
  { key: 'dismiss', label: "Come on, we both know this is a waste of your time." },
]

export default function PoliceStopModal({ wantedLevel, isFBI: isFBIProp, bailDiscountMultiplier = 1, caughtRedHanded = false, onClose }) {
  const cash = useGameStore((s) => s.cash)
  const attemptStreetBribe = useGameStore((s) => s.attemptStreetBribe)
  const addWantedLevel = useGameStore((s) => s.addWantedLevel)
  const sendToJail = useGameStore((s) => s.sendToJail)

  // OverworldScene's chaser-contact path always sends isFBI; anything else
  // that still opens this modal (a jail roll from a witnessed crime, say)
  // won't, so fall back to the same wantedLevel>=4 threshold
  // generateSwatSquad already uses rather than defaulting to false.
  const isFBI = typeof isFBIProp === 'boolean' ? isFBIProp : wantedLevel >= 4
  const unitLabel = isFBI ? 'FBI Tactical Unit' : 'local patrol'

  // 'choice' -> 'bribeResolved' | 'fleeAiming' -> 'fleeResolved' | 'talk' -> 'combat'
  const [phase, setPhase] = useState('choice')
  const [resultText, setResultText] = useState('')
  const [resultSuccess, setResultSuccess] = useState(false)

  const [markerPos, setMarkerPos] = useState(0.5)
  const markerPosRef = useRef(0.5)
  const startTimeRef = useRef(0)
  const rafRef = useRef(null)

  const bribeCost = 500 * wantedLevel * wantedLevel
  const canAffordBribe = cash >= bribeCost
  const fleeZoneWidth = Math.max(0.08, 0.2 - wantedLevel * 0.02)
  const [fleeZone] = useState(() => randomFleeZone(fleeZoneWidth))

  // --- Talk state ---
  const [talkHistory, setTalkHistory] = useState([])
  const [talkInputMode, setTalkInputMode] = useState('choice') // 'choice' | 'free'
  const [talkInput, setTalkInput] = useState('')
  const [talkLoading, setTalkLoading] = useState(false)
  const [talkError, setTalkError] = useState(false)
  const [talkAttempts, setTalkAttempts] = useState(0)
  const [talkOutcome, setTalkOutcome] = useState(null) // null | 'released' | 'arrested'
  const talkScrollRef = useRef(null)

  useEffect(() => {
    if (talkScrollRef.current) talkScrollRef.current.scrollTop = talkScrollRef.current.scrollHeight
  }, [talkHistory])

  useEffect(() => {
    if (phase !== 'fleeAiming') return
    startTimeRef.current = performance.now()
    const tick = (now) => {
      const elapsed = now - startTimeRef.current
      const pos = (Math.sin((elapsed / FLEE_SWEEP_PERIOD_MS) * Math.PI * 2) + 1) / 2
      markerPosRef.current = pos
      setMarkerPos(pos)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase])

  const handleBribe = () => {
    if (!canAffordBribe) return
    const { success } = attemptStreetBribe(bribeCost)
    setResultSuccess(success)
    setResultText(
      success
        ? `The officer pockets the $${bribeCost.toLocaleString()} and waves you off. Nothing happened here.`
        : `The officer takes your $${bribeCost.toLocaleString()} anyway and calls it in as a bribery attempt. Cuffs come out.`
    )
    setPhase('bribeResolved')
  }

  const handleStartFlee = () => setPhase('fleeAiming')

  const handleFleeAttempt = () => {
    const pos = markerPosRef.current
    const hit = pos >= fleeZone.start && pos <= fleeZone.start + fleeZoneWidth
    if (hit) addWantedLevel(-1)
    setResultSuccess(hit)
    setResultText(
      hit
        ? 'You cut through an alley and lose them in the crowd. Your Wanted Level drops.'
        : "You clip a trash can and go down hard. They're on you before you can get up."
    )
    setPhase('fleeResolved')
  }

  const handleResolvedContinue = () => {
    if (resultSuccess) {
      onClose()
    } else {
      // Bribe/flee failure - straight into Fight, same as before: caught,
      // but still a chance to throw hands rather than an automatic loss.
      setPhase('combat')
    }
  }

  const submitTalk = async (text) => {
    if (!text.trim() || talkLoading || talkOutcome) return
    const attemptNumber = talkAttempts + 1
    const historyForRequest = talkHistory.map((h) => ({ role: h.role, text: h.text }))
    setTalkHistory((h) => [...h, { role: 'player', text }])
    setTalkInput('')
    setTalkLoading(true)
    setTalkError(false)
    setTalkAttempts(attemptNumber)

    const situationContext =
      `Wanted Level: ${wantedLevel}/5. Unit: ${unitLabel}. ` +
      `This is the player's attempt ${attemptNumber} of ${TALK_MAX_ATTEMPTS} to talk their way out of this stop. ` +
      (attemptNumber >= TALK_MAX_ATTEMPTS
        ? 'This is their LAST chance - if this answer does not genuinely convince you, arrest them.'
        : '')

    const { reply, ok, agreed, relationshipDelta } = await sendNpcMessage({
      npcId: 'police',
      playerText: text,
      conversationHistory: historyForRequest,
      character: null,
      situationContext,
    })

    setTalkHistory((h) => [...h, { role: 'npc', text: reply, agreed: ok ? agreed : null }])
    setTalkError(!ok)
    setTalkLoading(false)

    if (ok && agreed) {
      addWantedLevel(-1)
      setTalkOutcome('released')
      return
    }
    // A clearly bad answer, or the last of 3 attempts with no yes yet, ends
    // it right there - no fight chance, matching a real officer's actual
    // last resort.
    const severelyBad = ok && relationshipDelta <= TALK_ARREST_DELTA_THRESHOLD
    if (severelyBad || attemptNumber >= TALK_MAX_ATTEMPTS) {
      setTalkOutcome('arrested')
    }
  }

  const handleTalkPreset = (choice) => submitTalk(choice.label)
  const handleTalkFreeSubmit = (e) => {
    e.preventDefault()
    submitTalk(talkInput)
  }

  const handleTalkContinue = () => {
    if (talkOutcome === 'arrested') {
      sendToJail({ bailDiscountMultiplier })
    }
    onClose()
  }

  if (phase === 'combat') {
    return (
      <PoliceFightModal
        wantedLevel={wantedLevel}
        isFBI={isFBI}
        onClose={onClose}
        onVictory={() => addWantedLevel(-1)}
        onDefeat={() => sendToJail({ bailDiscountMultiplier })}
        onRetreat={() => addWantedLevel(1)}
        retreatLabel="Break and Run (+1 Wanted)"
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[480px] border-4 border-blue-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-2 text-xl font-bold text-blue-300">{isFBI ? 'FBI Stop' : 'Police Stop'}</h2>

        {phase === 'choice' && (
          <>
            {caughtRedHanded ? (
              <p className="mb-4 text-sm text-gray-300">
                <span className="font-bold text-red-400">You've been caught red-handed.</span> A patrol was already
                close enough to see it happen - there was no time to run. {'★'.repeat(wantedLevel)}
              </p>
            ) : (
              <p className="mb-4 text-sm text-gray-300">
                {isFBI ? 'Federal agents box you in.' : 'Sirens. A patrol car pulls up on you'} - your heat finally
                caught up. {'★'.repeat(wantedLevel)}
              </p>
            )}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setPhase('combat')}
                className="border-2 border-red-500 p-2 text-left font-bold hover:bg-red-500 hover:text-black"
              >
                Fight
              </button>
              <button
                onClick={handleStartFlee}
                className="border-2 border-green-400 p-2 text-left font-bold hover:bg-green-400 hover:text-black"
              >
                Escape
              </button>
              <button
                onClick={handleBribe}
                disabled={!canAffordBribe}
                className="flex flex-col items-start border-2 border-yellow-400 p-2 text-left hover:bg-yellow-400 hover:text-black disabled:opacity-30"
              >
                <span className="font-bold">Bribe</span>
                <span className="text-xs">
                  ${bribeCost.toLocaleString()}{!canAffordBribe ? ' — not enough cash' : ''}
                </span>
              </button>
              <button
                onClick={() => setPhase('talk')}
                className="border-2 border-cyan-400 p-2 text-left font-bold hover:bg-cyan-400 hover:text-black"
              >
                Talk
              </button>
            </div>
          </>
        )}

        {phase === 'fleeAiming' && (
          <>
            <p className="mb-2 text-sm text-gray-300">Time it right to break their line of sight.</p>
            <div className="relative mb-3 h-5 w-full border border-gray-600 bg-black">
              <div
                className="absolute top-0 h-full bg-green-700/50"
                style={{ left: `${fleeZone.start * 100}%`, width: `${fleeZoneWidth * 100}%` }}
              />
              <div className="absolute top-0 h-full w-[3px] bg-yellow-300" style={{ left: `${markerPos * 100}%` }} />
            </div>
            <button
              onClick={handleFleeAttempt}
              className="w-full border-4 border-yellow-300 bg-yellow-400 py-2 font-bold text-black hover:bg-yellow-300"
            >
              Break Away Now!
            </button>
          </>
        )}

        {(phase === 'bribeResolved' || phase === 'fleeResolved') && (
          <div className="text-center">
            <p className={`mb-4 text-sm ${resultSuccess ? 'text-green-400' : 'text-red-400'}`}>{resultText}</p>
            <button
              onClick={handleResolvedContinue}
              className={`border-4 px-6 py-2 font-bold ${
                resultSuccess
                  ? 'border-green-400 bg-green-500 text-black hover:bg-green-400'
                  : 'border-red-500 bg-red-600 text-white hover:bg-red-500'
              }`}
            >
              {resultSuccess ? 'Continue' : 'Face Them'}
            </button>
          </div>
        )}

        {phase === 'talk' && (
          <>
            {/* Full back-and-forth, not just the officer's latest line - the
                old version discarded the player's own submitted lines
                entirely and scrolled every earlier exchange off screen,
                which made a 3-attempt conversation impossible to actually
                follow. Auto-scrolls to the newest line via the ref below. */}
            <div
              ref={talkScrollRef}
              className="mb-3 max-h-48 min-h-[70px] space-y-2 overflow-y-auto border-2 border-gray-700 bg-[#0f1020] p-2 text-sm"
            >
              <div>
                <p className="mb-0.5 text-xs font-bold text-cyan-400">{isFBI ? 'Agent' : 'Officer'}</p>
                <p className="text-gray-200">"Stay right there. I need to ask you a few questions."</p>
              </div>
              {talkHistory.map((line, i) => (
                <div key={i}>
                  <p className={`mb-0.5 text-xs font-bold ${line.role === 'player' ? 'text-emerald-400' : 'text-cyan-400'}`}>
                    {line.role === 'player' ? 'You' : isFBI ? 'Agent' : 'Officer'}
                  </p>
                  <p className="text-gray-200">{line.text}</p>
                </div>
              ))}
              {talkError && (
                <p className="text-xs italic text-red-500">
                  (Couldn't reach the NPC chat backend - is it running? See backend/README.md.)
                </p>
              )}
            </div>

            {talkOutcome ? (
              <div className="text-center">
                <p className={`mb-4 text-sm font-bold ${talkOutcome === 'released' ? 'text-green-400' : 'text-red-400'}`}>
                  {talkOutcome === 'released'
                    ? 'They buy it. You are clear to go.'
                    : "They've heard enough. You're under arrest."}
                </p>
                <button
                  onClick={handleTalkContinue}
                  className={`border-4 px-6 py-2 font-bold ${
                    talkOutcome === 'released'
                      ? 'border-green-400 bg-green-500 text-black hover:bg-green-400'
                      : 'border-red-500 bg-red-600 text-white hover:bg-red-500'
                  }`}
                >
                  Continue
                </button>
              </div>
            ) : (
              <>
                <p className="mb-2 text-xs text-gray-400">Attempt {talkAttempts + 1} of {TALK_MAX_ATTEMPTS}</p>
                <div className="mb-2 flex gap-2 text-xs">
                  <button
                    onClick={() => setTalkInputMode('choice')}
                    className={`border px-2 py-1 ${talkInputMode === 'choice' ? 'border-cyan-400 bg-cyan-900/50 text-cyan-200' : 'border-gray-700 text-gray-400'}`}
                  >
                    Choices
                  </button>
                  <button
                    onClick={() => setTalkInputMode('free')}
                    className={`border px-2 py-1 ${talkInputMode === 'free' ? 'border-cyan-400 bg-cyan-900/50 text-cyan-200' : 'border-gray-700 text-gray-400'}`}
                  >
                    Type your own
                  </button>
                </div>

                {talkInputMode === 'choice' ? (
                  <div className="flex flex-col gap-1.5">
                    {TALK_PRESET_CHOICES.map((choice) => (
                      <button
                        key={choice.key}
                        onClick={() => handleTalkPreset(choice)}
                        disabled={talkLoading}
                        className="border border-cyan-500/50 bg-[#141530] px-2 py-2 text-left text-xs text-cyan-100 hover:bg-cyan-900/50 disabled:opacity-40"
                      >
                        {choice.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <form onSubmit={handleTalkFreeSubmit} className="flex gap-2">
                    <input
                      type="text"
                      value={talkInput}
                      onChange={(e) => setTalkInput(e.target.value)}
                      placeholder="Say something to the officer..."
                      disabled={talkLoading}
                      maxLength={500}
                      className="flex-1 border-2 border-cyan-500/60 bg-black/70 px-2 py-1 text-sm text-white placeholder:text-gray-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={talkLoading || !talkInput.trim()}
                      className="border-2 border-cyan-400 px-3 py-1 text-sm font-bold text-cyan-300 hover:bg-cyan-400 hover:text-black disabled:opacity-30"
                    >
                      {talkLoading ? '...' : 'Send'}
                    </button>
                  </form>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
