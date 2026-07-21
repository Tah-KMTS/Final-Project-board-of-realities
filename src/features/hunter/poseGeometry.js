// BlazePose landmark indices (33-point model used by MediaPipe Pose Landmarker)
export const LANDMARK = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
}

function angleBetween(a, b, c) {
  // angle at point b, formed by rays b->a and b->c, in degrees
  const abx = a.x - b.x
  const aby = a.y - b.y
  const cbx = c.x - b.x
  const cby = c.y - b.y
  const dot = abx * cbx + aby * cby
  const magA = Math.hypot(abx, aby)
  const magC = Math.hypot(cbx, cby)
  if (magA === 0 || magC === 0) return 180
  const cos = Math.min(1, Math.max(-1, dot / (magA * magC)))
  return (Math.acos(cos) * 180) / Math.PI
}

export function analyzeSquatForm(landmarks) {
  if (!landmarks || landmarks.length < 29) return null

  const lHip = landmarks[LANDMARK.LEFT_HIP]
  const rHip = landmarks[LANDMARK.RIGHT_HIP]
  const lKnee = landmarks[LANDMARK.LEFT_KNEE]
  const rKnee = landmarks[LANDMARK.RIGHT_KNEE]
  const lAnkle = landmarks[LANDMARK.LEFT_ANKLE]
  const rAnkle = landmarks[LANDMARK.RIGHT_ANKLE]
  const lShoulder = landmarks[LANDMARK.LEFT_SHOULDER]
  const rShoulder = landmarks[LANDMARK.RIGHT_SHOULDER]

  const leftKneeAngle = angleBetween(lHip, lKnee, lAnkle)
  const rightKneeAngle = angleBetween(rHip, rKnee, rAnkle)
  const kneeAngle = (leftKneeAngle + rightKneeAngle) / 2

  const shoulderMid = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 }
  const hipMid = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 }
  const kneeMid = { x: (lKnee.x + rKnee.x) / 2, y: (lKnee.y + rKnee.y) / 2 }
  const backAngle = angleBetween(shoulderMid, hipMid, kneeMid)

  // Knee valgus check: knees should stay roughly above/behind the ankles,
  // not caving inward past them (normalized x-coordinates, mirrored camera).
  const kneeCaveLeft = Math.abs(lKnee.x - lAnkle.x)
  const kneeCaveRight = Math.abs(rKnee.x - rAnkle.x)
  const kneeCaveOk = kneeCaveLeft < 0.12 && kneeCaveRight < 0.12

  return { kneeAngle, backAngle, kneeCaveOk }
}

export const SQUAT_DOWN_THRESHOLD = 100 // knee angle below this = "down" position
export const SQUAT_UP_THRESHOLD = 160 // knee angle above this = "standing" position
export const SQUAT_MIN_DEPTH_ANGLE = 75 // must reach at least this depth to count
export const BACK_ANGLE_MIN = 60 // torso must stay within this range relative to hip-knee line
