import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import {
  analyzeSquatForm,
  SQUAT_DOWN_THRESHOLD,
  SQUAT_UP_THRESHOLD,
  SQUAT_MIN_DEPTH_ANGLE,
} from './poseGeometry'
import { USED_TAMPON, WEIRD_UMBRELLA } from './items'
import DialogueBox from '../../components/Dialogue/DialogueBox'
import { POOM_INTRO_LINES, POOM_COMPLETE_LINES } from '../../data/hunterDialogue'
import { playQuestCompleteSound } from '../../audio/sfx'

const TARGET_REPS = 15
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task'

export default function PoomQuestModal({ onClose }) {
  const completePoomQuest = useGameStore((s) => s.completePoomQuest)
  const poomQuestComplete = useGameStore((s) => s.world1.poomQuestComplete)

  const [phase, setPhase] = useState(poomQuestComplete ? 'alreadyDone' : 'intro')
  const [errorMessage, setErrorMessage] = useState('')
  const [reps, setReps] = useState(0)
  const [poomMessage, setPoomMessage] = useState("Alright. Let's see your squats. Full depth. No cheating.")
  const [rewardItem, setRewardItem] = useState(null)

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const landmarkerRef = useRef(null)
  const rafRef = useRef(null)
  const repStateRef = useRef({ phase: 'up', minKneeAngle: 180, formBroken: false })
  const repsRef = useRef(0)

  useEffect(() => {
    return () => cleanup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cleanup = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
    if (landmarkerRef.current) landmarkerRef.current.close()
  }

  const startQuest = async () => {
    setPhase('loading')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 360 } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision')
      const vision = await FilesetResolver.forVisionTasks(WASM_URL)
      landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
      })

      setPhase('tracking')
      loop()
    } catch (err) {
      setErrorMessage(
        err?.message?.includes('Permission')
          ? 'Camera permission denied. Poom needs to see your form.'
          : `Could not start pose tracking: ${err?.message || err}`
      )
      setPhase('error')
    }
  }

  const loop = () => {
    const video = videoRef.current
    const landmarker = landmarkerRef.current
    if (!video || !landmarker) return

    const now = performance.now()
    const result = landmarker.detectForVideo(video, now)
    const landmarks = result?.landmarks?.[0]
    if (landmarks) {
      processFrame(landmarks)
    }
    rafRef.current = requestAnimationFrame(loop)
  }

  const processFrame = (landmarks) => {
    const form = analyzeSquatForm(landmarks)
    if (!form) return
    const st = repStateRef.current

    if (st.phase === 'up' && form.kneeAngle < SQUAT_DOWN_THRESHOLD) {
      st.phase = 'down'
      st.minKneeAngle = form.kneeAngle
      st.formBroken = !form.kneeCaveOk
    } else if (st.phase === 'down') {
      st.minKneeAngle = Math.min(st.minKneeAngle, form.kneeAngle)
      if (!form.kneeCaveOk) st.formBroken = true

      if (form.kneeAngle > SQUAT_UP_THRESHOLD) {
        const deepEnough = st.minKneeAngle <= SQUAT_MIN_DEPTH_ANGLE
        if (deepEnough && !st.formBroken) {
          repsRef.current += 1
          setReps(repsRef.current)
          setPoomMessage(
            repsRef.current >= TARGET_REPS
              ? "...Fine. That's enough."
              : `${repsRef.current}/${TARGET_REPS}. Keep going.`
          )
          if (repsRef.current >= TARGET_REPS) {
            finishQuest()
          }
        } else {
          repsRef.current = 0
          setReps(0)
          setPoomMessage(
            !deepEnough
              ? "Not deep enough. That doesn't count. Back to zero."
              : "Your knees caved in. Sloppy. Back to zero."
          )
        }
        st.phase = 'up'
        st.minKneeAngle = 180
        st.formBroken = false
      }
    }
  }

  const finishQuest = () => {
    cleanup()
    const item = Math.random() < 0.5 ? USED_TAMPON : WEIRD_UMBRELLA
    setRewardItem(item)
    completePoomQuest(item)
    playQuestCompleteSound()
    setPhase('complete')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[520px] border-4 border-purple-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-3 text-xl font-bold text-purple-300">Poom's Exercise Quest</h2>

        {phase === 'alreadyDone' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-sm text-gray-300">"You already earned your reward. Get out of here."</p>
            <button
              onClick={onClose}
              className="border-4 border-gray-500 px-6 py-2 font-bold hover:bg-gray-500"
            >
              Leave
            </button>
          </div>
        )}

        {phase === 'intro' && (
          <div className="flex flex-col gap-4">
            <DialogueBox speaker="Poom" portrait="💪" voiceId="poom" lines={POOM_INTRO_LINES} onDone={() => {}} />
            <p className="text-xs text-gray-500">{TARGET_REPS} full-depth squats, form checked live.</p>
            <div className="flex gap-3">
              <button
                onClick={startQuest}
                className="flex-1 border-4 border-purple-400 bg-purple-500 py-2 font-bold text-black hover:bg-purple-400"
              >
                Enable Camera & Begin
              </button>
              <button
                onClick={onClose}
                className="border-4 border-gray-500 px-4 py-2 font-bold hover:bg-gray-500"
              >
                Not Now
              </button>
            </div>
          </div>
        )}

        {phase === 'loading' && <p className="text-sm text-gray-400">Loading pose tracker…</p>}

        {phase === 'error' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-red-400">{errorMessage}</p>
            <button
              onClick={onClose}
              className="border-4 border-gray-500 px-4 py-2 font-bold hover:bg-gray-500"
            >
              Close
            </button>
          </div>
        )}

        {phase === 'tracking' && (
          <div className="flex flex-col gap-3">
            <video ref={videoRef} className="w-full border-2 border-gray-600" muted playsInline />
            <div className="flex items-center justify-between border-2 border-gray-700 bg-black px-3 py-2 text-sm">
              <span className="font-bold text-yellow-300">
                {reps} / {TARGET_REPS} reps
              </span>
              <span className="text-gray-300">{poomMessage}</span>
            </div>
            <button
              onClick={() => {
                cleanup()
                onClose()
              }}
              className="border-4 border-gray-500 px-4 py-2 font-bold hover:bg-gray-500"
            >
              Give Up
            </button>
          </div>
        )}

        {phase === 'complete' && rewardItem && (
          <div className="flex flex-col items-center gap-3 text-center">
            <DialogueBox speaker="Poom" portrait="💪" voiceId="poom" lines={POOM_COMPLETE_LINES} onDone={() => {}} />
            <p className="text-lg font-bold text-yellow-300">{rewardItem.name}</p>
            <p className="text-xs text-gray-400">{rewardItem.description}</p>
            <button
              onClick={onClose}
              className="mt-2 border-4 border-green-400 bg-green-500 px-6 py-2 font-bold text-black hover:bg-green-400"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
