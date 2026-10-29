import * as THREE from "three"
import monza from "./circuits/monza.json"
import road from "./circuits/monza-road.json"

/**
 * Active circuit: Autodromo Nazionale Monza, raced clockwise.
 * The driving line is the centre of the visual asphalt (monza-road.json),
 * scaled so the lap is the official 5793 m. The outline is flat.
 */

type CircuitDef = {
  id: string
  name: string
  control: [number, number][]
}

/** Official lap length in metres (FIA; same as the source dataset). */
const OFFICIAL_LENGTH = monza.lengthTarget

const spline = (points: [number, number][]) =>
  new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, "centripetal")

// The road file is in the same metres as the circuit model. Spline smoothing
// changes the length slightly; this scale locks the lap to 5793 m. The model
// uses the same scale so the car stays on the asphalt.
const roadLine = road.control as [number, number][]
const scale = OFFICIAL_LENGTH / spline(roadLine).getLength()
export const CIRCUIT_SCALE = scale

const ACTIVE_CIRCUIT: CircuitDef = {
  id: monza.id,
  name: monza.name,
  control: roadLine.map(([x, z]) => [x * scale, z * scale]),
}

/** Asphalt width of the visual circuit, metres. */
export const ROAD_WIDTH = road.width
/** Armco just outside the white line — the car cannot drive past it. */
export const WALL_LAT = ROAD_WIDTH / 2 + 0.2
/** Wheels sit on the circuit mesh, which is slightly above y = 0. */
export const TRACK_SURFACE = 0.12
/** Armco slab thickness — Circuit walls and race hitbox must match. */
export const WALL_THICK = 0.55
const VMAX = 95 // m/s — Monza is a power circuit
const A_LAT = 40
const A_BRAKE = 48
const accel = (v: number) => 4 + 13 * (1 - v / VMAX)

const curve = spline(ACTIVE_CIRCUIT.control)
const LENGTH = Math.round(curve.getLength())
const N = LENGTH

const pos: THREE.Vector3[] = []
const tan: THREE.Vector3[] = []
const kappa = new Float32Array(N)
const vmax = new Float32Array(N)

// Start on the main straight near the origin, travelling +Z.
const startU = (() => {
  let best = 0, bestD = Infinity
  for (let i = 0; i < 4000; i++) {
    const u = i / 4000
    const p = curve.getPointAt(u)
    const t = curve.getTangentAt(u)
    const d = Math.hypot(p.x, p.z) * 0.35 + Math.abs(p.x) * 2.5 + (t.z > 0.75 ? 0 : 50)
    if (d < bestD) {
      bestD = d
      best = u
    }
  }
  return best
})()

for (let i = 0; i < N; i++) {
  const u = (startU + i / N) % 1
  const p = curve.getPointAt(u)
  pos.push(p)
  tan.push(curve.getTangentAt(u).normalize())
}
for (let i = 0; i < N; i++) {
  const a = tan[(i - 3 + N) % N], b = tan[(i + 3) % N]
  const cross = a.x * b.z - a.z * b.x
  kappa[i] = Math.asin(Math.max(-1, Math.min(1, cross))) / 6
}
const smooth = Float32Array.from(kappa, (_, i) => {
  let sum = 0
  for (let k = -6; k <= 6; k++) sum += kappa[(i + k + N) % N]
  return sum / 13
})
for (let i = 0; i < N; i++) vmax[i] = Math.min(VMAX, Math.sqrt(A_LAT / Math.max(1e-5, Math.abs(smooth[i]))))
for (let pass = 0; pass < 2; pass++) {
  for (let i = N - 1; i >= 0; i--) {
    const next = vmax[(i + 1) % N]
    vmax[i] = Math.min(vmax[i], Math.sqrt(next * next + 2 * A_BRAKE))
  }
  for (let i = 0; i < N; i++) {
    const prev = vmax[(i - 1 + N) % N]
    vmax[i] = Math.min(vmax[i], Math.sqrt(prev * prev + 2 * accel(prev)))
  }
}

const idx = (s: number) => ((Math.floor(s) % N) + N) % N
const lerpIdx = (s: number) => {
  const w = ((s % N) + N) % N
  const i = Math.floor(w)
  return { i, j: (i + 1) % N, f: w - i }
}

export const track = {
  id: ACTIVE_CIRCUIT.id,
  name: ACTIVE_CIRCUIT.name,
  length: LENGTH,
  vmax: VMAX,
  accel,
  brake: A_BRAKE,
  curvature: (s: number) => smooth[idx(s)],
  targetSpeed: (s: number) => vmax[idx(s)],
  grip: (s: number) => Math.min(VMAX, Math.sqrt(A_LAT / Math.max(1e-5, Math.abs(smooth[idx(s)])))),
  point(s: number, out = new THREE.Vector3()) {
    const { i, j, f } = lerpIdx(s)
    return out.copy(pos[i]).lerp(pos[j], f)
  },
  tangent(s: number, out = new THREE.Vector3()) {
    const { i, j, f } = lerpIdx(s)
    return out.copy(tan[i]).lerp(tan[j], f).normalize()
  },
  left(s: number, out = new THREE.Vector3()) {
    const t = this.tangent(s, out)
    return out.set(t.z, 0, -t.x)
  },
  samples: { pos, tan, curvature: smooth },
}

const tmpT = new THREE.Vector3(), tmpL = new THREE.Vector3()
export function placeOnTrack(obj: THREE.Object3D, s: number, lateral: number, y = 0) {
  track.point(s, obj.position)
  track.left(s, tmpL)
  obj.position.addScaledVector(tmpL, lateral)
  obj.position.y += y + TRACK_SURFACE
  track.tangent(s, tmpT)
  obj.rotation.set(0, Math.atan2(tmpT.x, tmpT.z), 0)
}
