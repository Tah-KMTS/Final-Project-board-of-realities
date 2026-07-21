export const CANVAS_W = 480
export const CANVAS_H = 320
export const BALL_RADIUS = 6
export const HOLE_RADIUS = 10

// Each course: ball start position, hole position, rectangular wall obstacles.
export const COURSES = [
  {
    name: 'Hole 1 - The Straightaway',
    start: { x: 60, y: 160 },
    hole: { x: 420, y: 160 },
    walls: [],
    tanSkill: { min: 2, max: 3 },
  },
  {
    name: 'Hole 2 - The Corner Pocket',
    start: { x: 60, y: 60 },
    hole: { x: 420, y: 260 },
    walls: [{ x: 220, y: 0, w: 20, h: 200 }],
    tanSkill: { min: 3, max: 4 },
  },
  {
    name: 'Hole 3 - The Gauntlet',
    start: { x: 40, y: 160 },
    hole: { x: 440, y: 160 },
    walls: [
      { x: 150, y: 0, w: 20, h: 210 },
      { x: 300, y: 110, w: 20, h: 210 },
    ],
    tanSkill: { min: 3, max: 5 },
  },
]

export function simulateTanStroke(course) {
  const { min, max } = course.tanSkill
  return min + Math.floor(Math.random() * (max - min + 1))
}
