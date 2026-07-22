import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import DialogueBox from '../../components/Dialogue/DialogueBox'
import { MARRIAGE_CANDIDATE_FIRST_MEET_LINES, MARRIAGE_CANDIDATE_RETURN_LINES } from '../../data/hunterDialogue'

export default function FamilyModal({ onClose }) {
  const world1 = useGameStore((s) => s.world1)
  const marry = useGameStore((s) => s.marry)
  const haveChild = useGameStore((s) => s.haveChild)
  const meetMarriageCandidate = useGameStore((s) => s.meetMarriageCandidate)
  const wasFirstMeeting = useRef(!world1.marriageCandidateMet)
  const [dialogueDone, setDialogueDone] = useState(false)

  useEffect(() => {
    if (!world1.marriageCandidateMet) meetMarriageCandidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[420px] border-4 border-pink-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-3 text-xl font-bold text-pink-300">A Familiar Face</h2>
        <DialogueBox
          speaker="???"
          portrait="💗"
          voiceId="marriageCandidate"
          lines={wasFirstMeeting.current ? MARRIAGE_CANDIDATE_FIRST_MEET_LINES : MARRIAGE_CANDIDATE_RETURN_LINES}
          onDone={() => setDialogueDone(true)}
          npcId="marriageCandidate"
          relationshipTier={world1.married ? 100 : 20}
        />

        {!world1.married ? (
          <button
            onClick={marry}
            className="mb-3 w-full border-4 border-pink-400 bg-pink-500 py-2 font-bold text-black hover:bg-pink-400"
          >
            Propose Marriage
          </button>
        ) : (
          <>
            <p className="mb-3 text-sm text-green-400">You are married. Children: {world1.children}</p>
            <button
              onClick={haveChild}
              className="mb-3 w-full border-4 border-pink-400 bg-pink-500 py-2 font-bold text-black hover:bg-pink-400"
            >
              Start a Family
            </button>
          </>
        )}

        <button
          onClick={onClose}
          className="w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500"
        >
          Leave
        </button>
      </div>
    </div>
  )
}
