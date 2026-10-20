import * as THREE from "three"

// A closed night circuit: a long main straight (start/finish at s = 0, heading
// +z), a hairpin, a fast esses section and a long sweeper back onto the
// straight. Everything is sampled every metre with a speed profile computed
// from curvature, so any car can drive it with realistic braking points.

const SCALE = 0.8
const CONTROL: [number, number][] = [
  [0, -260], [0, 0], [0, 260], [25, 330], [90, 352], [140, 312], [150, 240], [205, 172], [262, 150],
  [302, 90], [292, 10], [332, -60], [352, -150], [300, -232], [210, -252], [150, -322], [70, -346], [14, -318],
]

export const ROAD_WIDTH = 14
const VMAX = 92 // m/s, about 330 km/h
const A_LAT = 42 // m/s² cornering
const A_BRAKE = 48 // m/s² braking
const accel = (v: number) => 4 + 12 * (1 - v / VMAX) // m/s² traction-limited at low speed, drag-limited at high

const curve = new THREE.CatmullRomCurve3(
  CONTROL.map(([x, z]) => new THREE.Vector3(x * SCALE, 0, z * SCALE)),
  true,
  "centripetal",
)
export const LENGTH = Math.round(curve.getLength())
const N = LENGTH // one sample per metre

const pos: THREE.Vector3[] = []
const tan: THREE.Vector3[] = []
const kappa = new Float32Array(N) // signed curvature, 1/m
const vmax = new Float32Array(N)

// Start/finish on the main straight at z = 0.
const startU = (() => {
  let best = 0, bestD = Infinity
  for (let i = 0; i < 4000; i++) {
    const p = curve.getPointAt(i / 4000)
    const d = Math.abs(p.z) + Math.abs(p.x) * 4
    if (p.z > -50 && p.z < 50 && d < bestD) { bestD = d; best = i / 4000 }
  }
  return best
})()

for (let i = 0; i < N; i++) {
  const u = (startU + i / N) % 1
  pos.push(curve.getPointAt(u))
  tan.push(curve.getTangentAt(u).normalize())
}
for (let i = 0; i < N; i++) {
  const a = tan[(i - 3 + N) % N], b = tan[(i + 3) % N]
  const cross = a.x * b.z - a.z * b.x
  kappa[i] = Math.asin(Math.max(-1, Math.min(1, cross))) / 6
}
// Smooth curvature, then speed limits: corner speed, then braking (backward) and traction (forward) passes.
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
  length: LENGTH,
  vmax: VMAX,
  accel,
  brake: A_BRAKE,
  curvature: (s: number) => smooth[idx(s)],
  targetSpeed: (s: number) => vmax[idx(s)],
  // The fastest a car can take the curve at s, ignoring braking zones.
  grip: (s: number) => Math.min(VMAX, Math.sqrt(A_LAT / Math.max(1e-5, Math.abs(smooth[idx(s)])))),
  point(s: number, out = new THREE.Vector3()) {
    const { i, j, f } = lerpIdx(s)
    return out.copy(pos[i]).lerp(pos[j], f)
  },
  tangent(s: number, out = new THREE.Vector3()) {
    const { i, j, f } = lerpIdx(s)
    return out.copy(tan[i]).lerp(tan[j], f).normalize()
  },
  // Unit vector to the left of the direction of travel.
  left(s: number, out = new THREE.Vector3()) {
    const t = this.tangent(s, out)
    return out.set(t.z, 0, -t.x)
  },
  samples: { pos, tan, curvature: smooth },
}

// Place an object on the track at distance s with a lateral offset.
const tmpT = new THREE.Vector3(), tmpL = new THREE.Vector3()
export function placeOnTrack(obj: THREE.Object3D, s: number, lateral: number, y = 0) {
  track.point(s, obj.position)
  track.left(s, tmpL)
  obj.position.addScaledVector(tmpL, lateral)
  obj.position.y = y
  track.tangent(s, tmpT)
  obj.rotation.set(0, Math.atan2(tmpT.x, tmpT.z), 0)
}
