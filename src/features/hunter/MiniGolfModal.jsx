import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { COURSES, CANVAS_W, CANVAS_H, BALL_RADIUS, HOLE_RADIUS, simulateTanStroke } from './golfCourses'
import DialogueBox from '../../components/Dialogue/DialogueBox'
import { TAN_INTRO_LINES, TAN_WIN_LINES, TAN_LOSE_LINES } from '../../data/hunterDialogue'
import { playQuestCompleteSound, playClickSound } from '../../audio/sfx'

const FRICTION = 0.985
const STOP_SPEED = 0.06
const MAX_DRAG = 110
const MAX_STROKES_PER_HOLE = 8

export default function MiniGolfModal({ onClose }) {
  const completeTanQuest = useGameStore((s) => s.completeTanQuest)
  const hasSpringOfNazarick = useGameStore((s) => s.world1.hasSpringOfNazarick)

  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const ballRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, moving: false })
  const dragRef = useRef(null)
  const strokesRef = useRef(0)

  const [holeIndex, setHoleIndex] = useState(0)
  const [playerStrokes, setPlayerStrokes] = useState([])
  const [tanStrokes, setTanStrokes] = useState([])
  const [currentStrokes, setCurrentStrokes] = useState(0)
  const [holeResult, setHoleResult] = useState(null) // null | 'holed' | 'maxedOut'
  const [matchResult, setMatchResult] = useState(null) // null | 'win' | 'lose'
  const [introDone, setIntroDone] = useState(false)

  const course = COURSES[holeIndex]

  useEffect(() => {
    ballRef.current = { x: course.start.x, y: course.start.y, vx: 0, vy: 0, moving: false }
    strokesRef.current = 0
    setCurrentStrokes(0)
    setHoleResult(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holeIndex])

  useEffect(() => {
    if (hasSpringOfNazarick) return
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holeIndex, holeResult, hasSpringOfNazarick])

  const tick = () => {
    render()
    physicsStep()
    rafRef.current = requestAnimationFrame(tick)
  }

  const physicsStep = () => {
    const ball = ballRef.current
    if (!ball.moving) return

    ball.x += ball.vx
    ball.y += ball.vy
    ball.vx *= FRICTION
    ball.vy *= FRICTION

    if (ball.x - BALL_RADIUS < 0) { ball.x = BALL_RADIUS; ball.vx *= -0.7 }
    if (ball.x + BALL_RADIUS > CANVAS_W) { ball.x = CANVAS_W - BALL_RADIUS; ball.vx *= -0.7 }
    if (ball.y - BALL_RADIUS < 0) { ball.y = BALL_RADIUS; ball.vy *= -0.7 }
    if (ball.y + BALL_RADIUS > CANVAS_H) { ball.y = CANVAS_H - BALL_RADIUS; ball.vy *= -0.7 }

    for (const wall of course.walls) {
      const closestX = Math.max(wall.x, Math.min(ball.x, wall.x + wall.w))
      const closestY = Math.max(wall.y, Math.min(ball.y, wall.y + wall.h))
      const dx = ball.x - closestX
      const dy = ball.y - closestY
      const dist = Math.hypot(dx, dy)
      if (dist < BALL_RADIUS && dist > 0) {
        const nx = dx / dist
        const ny = dy / dist
        const overlap = BALL_RADIUS - dist
        ball.x += nx * overlap
        ball.y += ny * overlap
        const dot = ball.vx * nx + ball.vy * ny
        ball.vx -= 2 * dot * nx
        ball.vy -= 2 * dot * ny
        ball.vx *= 0.7
        ball.vy *= 0.7
      }
    }

    const speed = Math.hypot(ball.vx, ball.vy)
    const distToHole = Math.hypot(ball.x - course.hole.x, ball.y - course.hole.y)

    if (distToHole < HOLE_RADIUS && speed < 2.5) {
      ball.moving = false
      ball.vx = 0
      ball.vy = 0
      handleHoled()
      return
    }

    if (speed < STOP_SPEED) {
      ball.vx = 0
      ball.vy = 0
      ball.moving = false
      if (strokesRef.current >= MAX_STROKES_PER_HOLE) {
        handleMaxedOut()
      }
    }
  }

  const handleHoled = () => {
    const strokeCount = strokesRef.current
    setPlayerStrokes((prev) => {
      const next = [...prev]
      next[holeIndex] = strokeCount
      return next
    })
    setHoleResult('holed')
    const tanScore = simulateTanStroke(course)
    setTanStrokes((prev) => {
      const next = [...prev]
      next[holeIndex] = tanScore
      return next
    })
  }

  const handleMaxedOut = () => {
    const strokeCount = strokesRef.current
    setPlayerStrokes((prev) => {
      const next = [...prev]
      next[holeIndex] = strokeCount
      return next
    })
    setHoleResult('maxedOut')
    const tanScore = simulateTanStroke(course)
    setTanStrokes((prev) => {
      const next = [...prev]
      next[holeIndex] = tanScore
      return next
    })
  }

  const handleStroke = (vx, vy) => {
    if (ballRef.current.moving || holeResult) return
    ballRef.current.vx = vx
    ballRef.current.vy = vy
    ballRef.current.moving = true
    strokesRef.current += 1
    setCurrentStrokes(strokesRef.current)
    playClickSound()
  }

  const handleNextHole = () => {
    if (holeIndex + 1 < COURSES.length) {
      setHoleIndex(holeIndex + 1)
    } else {
      const playerTotal = playerStrokes.reduce((a, b) => a + (b || 0), 0)
      const tanTotal = tanStrokes.reduce((a, b) => a + (b || 0), 0)
      if (playerTotal <= tanTotal) {
        completeTanQuest()
        playQuestCompleteSound()
        setMatchResult('win')
      } else {
        setMatchResult('lose')
      }
    }
  }

  const render = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#2f9e44'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    ctx.fillStyle = '#5b4636'
    for (const wall of course.walls) ctx.fillRect(wall.x, wall.y, wall.w, wall.h)

    ctx.fillStyle = '#111'
    ctx.beginPath()
    ctx.arc(course.hole.x, course.hole.y, HOLE_RADIUS, 0, Math.PI * 2)
    ctx.fill()

    const ball = ballRef.current
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#333'
    ctx.stroke()

    if (dragRef.current && !ball.moving && !holeResult) {
      ctx.strokeStyle = '#ffcc00'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(ball.x, ball.y)
      ctx.lineTo(dragRef.current.x, dragRef.current.y)
      ctx.stroke()
    }
  }

  const getMousePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handleMouseDown = (e) => {
    if (ballRef.current.moving || holeResult) return
    dragRef.current = getMousePos(e)
  }

  const handleMouseMove = (e) => {
    if (!dragRef.current) return
    dragRef.current = getMousePos(e)
  }

  const handleMouseUp = () => {
    if (!dragRef.current || ballRef.current.moving || holeResult) {
      dragRef.current = null
      return
    }
    const ball = ballRef.current
    const dx = dragRef.current.x - ball.x
    const dy = dragRef.current.y - ball.y
    const dist = Math.min(MAX_DRAG, Math.hypot(dx, dy))
    if (dist > 5) {
      const angle = Math.atan2(dy, dx)
      const power = (dist / MAX_DRAG) * 9
      handleStroke(Math.cos(angle) * power, Math.sin(angle) * power)
    }
    dragRef.current = null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="border-4 border-green-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-2 text-xl font-bold text-green-300">Mini-Golf vs. Tan</h2>

        {hasSpringOfNazarick ? (
          <div className="flex flex-col items-center gap-4 p-4 text-center">
            <p className="text-sm text-gray-300">
              "You've already got a Spring of Nazarick. What do you want, a rematch?"
            </p>
            <button
              onClick={onClose}
              className="border-4 border-gray-500 px-6 py-2 font-bold hover:bg-gray-500"
            >
              Leave
            </button>
          </div>
        ) : !introDone ? (
          <div className="flex flex-col gap-4">
            <DialogueBox speaker="Tan" portrait="🏌️" voiceId="tan" lines={TAN_INTRO_LINES} onDone={() => setIntroDone(true)} />
            <button
              onClick={onClose}
              className="w-full border-2 border-gray-600 py-1 text-xs text-gray-400 hover:bg-gray-700"
            >
              Not Now
            </button>
          </div>
        ) : (
          <>
        {!matchResult && (
          <>
            <div className="mb-2 flex justify-between text-sm">
              <span>{course.name}</span>
              <span>Strokes: {currentStrokes}</span>
            </div>
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="border-2 border-gray-700"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => (dragRef.current = null)}
            />
            <p className="mt-2 text-xs text-gray-400">
              Click and drag away from the ball, release to putt.
            </p>

            {holeResult && (
              <div className="mt-3 flex flex-col items-center gap-2 border-2 border-gray-600 bg-black p-3 text-center">
                <p>
                  {holeResult === 'holed' ? `Holed in ${currentStrokes}!` : `Max strokes reached (${currentStrokes}).`}
                </p>
                <p className="text-sm text-gray-400">Tan scored {tanStrokes[holeIndex]} on this hole.</p>
                <button
                  onClick={handleNextHole}
                  className="border-4 border-green-400 bg-green-500 px-4 py-1 font-bold text-black hover:bg-green-400"
                >
                  {holeIndex + 1 < COURSES.length ? 'Next Hole' : 'See Final Result'}
                </button>
              </div>
            )}
          </>
        )}

        {matchResult && (
          <div className="flex flex-col items-center gap-3 p-4 text-center">
            <p className="text-lg font-bold">
              Final: You {playerStrokes.reduce((a, b) => a + (b || 0), 0)} - Tan{' '}
              {tanStrokes.reduce((a, b) => a + (b || 0), 0)}
            </p>
            <div className="w-full text-left">
              <DialogueBox
                speaker="Tan"
                portrait="🏌️"
                voiceId="tan"
                lines={matchResult === 'win' ? TAN_WIN_LINES : TAN_LOSE_LINES}
                onDone={() => {}}
              />
            </div>
            <button
              onClick={onClose}
              className="border-4 border-gray-500 px-6 py-2 font-bold hover:bg-gray-500"
            >
              Close
            </button>
          </div>
        )}

        {!matchResult && (
          <button
            onClick={onClose}
            className="mt-3 w-full border-2 border-gray-600 py-1 text-xs text-gray-400 hover:bg-gray-700"
          >
            Forfeit Match
          </button>
        )}
          </>
        )}
      </div>
    </div>
  )
}
