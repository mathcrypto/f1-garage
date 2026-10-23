/**
 * @file Technical.tsx
 * @description The technical effect component that renders the technical information.
 */
"use client"

import { Html, Line } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { useMemo, useRef } from "react"
import * as THREE from "three"
import { useGarage } from "@/lib/store"

// ── Airflow ─────────────────────────────────────────────────────────────────
// Hand-shaped streamlines around the car, coloured like a CFD plot: blue is
// slow air, red is fast. Each point carries a relative speed (0..1).
type Stream = [number, number, number, number][] // x, y, z, speed

const mirror = (s: Stream): Stream => s.map(([x, y, z, v]) => [-x, y, z, v])
const BASE: Stream[] = [
  // Over the nose, cockpit and airbox, then upwash behind the rear wing.
  [[0, 0.32, 4.6, 0.45], [0, 0.26, 2.9, 0.15], [0, 0.56, 1.6, 0.55], [0, 0.92, 0.6, 0.6], [0, 1.13, -0.4, 0.5], [0, 1.12, -1.6, 0.6], [0, 1.3, -2.6, 0.75], [0, 1.65, -3.6, 0.55], [0, 1.95, -4.6, 0.45]],
  // Over the sidepods and down the coke bottle.
  [[0.5, 0.46, 4.6, 0.45], [0.5, 0.4, 2.9, 0.4], [0.56, 0.66, 0.5, 0.35], [0.48, 0.6, -0.6, 0.6], [0.32, 0.48, -1.8, 0.75], [0.22, 0.58, -2.6, 0.7], [0.2, 0.95, -3.6, 0.5], [0.2, 1.25, -4.6, 0.45]],
  // Under the floor: the fastest air on the car, then out through the diffuser.
  [[0.25, 0.14, 4.6, 0.45], [0.25, 0.1, 2.9, 0.55], [0.25, 0.055, 1.2, 0.85], [0.25, 0.04, 0, 1], [0.25, 0.04, -1.4, 0.95], [0.25, 0.12, -2.1, 0.7], [0.25, 0.38, -2.8, 0.55], [0.25, 0.78, -3.8, 0.45], [0.25, 1.02, -4.6, 0.4]],
  [[0.62, 0.15, 4.6, 0.45], [0.62, 0.11, 2.9, 0.55], [0.64, 0.06, 1.0, 0.8], [0.7, 0.045, -0.2, 0.92], [0.6, 0.05, -1.4, 0.88], [0.45, 0.16, -2.15, 0.65], [0.4, 0.42, -2.9, 0.5], [0.38, 0.8, -3.9, 0.45]],
  // Front wing outwash around the front tyre.
  [[0.72, 0.26, 4.6, 0.45], [0.72, 0.22, 3.0, 0.5], [0.78, 0.4, 2.3, 0.8], [1.12, 0.44, 1.75, 0.55], [1.1, 0.36, 0.5, 0.45], [1.02, 0.3, -1.0, 0.5], [1.06, 0.32, -1.65, 0.4], [1.0, 0.36, -3, 0.45], [0.92, 0.4, -4.6, 0.45]],
  // Over the rear wing: accelerated over the flap, thrown upward.
  [[0.36, 1.04, 4.6, 0.45], [0.36, 1.04, 0.5, 0.45], [0.36, 1.06, -1.8, 0.5], [0.36, 1.24, -2.5, 0.9], [0.36, 1.5, -3.3, 0.7], [0.36, 1.82, -4.6, 0.5]],
  // Free stream well outside the car.
  [[1.45, 0.62, 4.6, 0.45], [1.5, 0.64, 1.75, 0.5], [1.45, 0.62, -1.65, 0.5], [1.4, 0.6, -4.6, 0.45]],
]
const STREAMS: Stream[] = [BASE[0], ...BASE.slice(1).flatMap((s) => [s, mirror(s)])]

const SLOW = new THREE.Color("#2563eb"), MID = new THREE.Color("#22d3ee"), WARM = new THREE.Color("#facc15"), FAST = new THREE.Color("#ef4444")
function speedColor(v: number, out = new THREE.Color()) {
  if (v < 0.4) return out.copy(SLOW).lerp(MID, v / 0.4)
  if (v < 0.7) return out.copy(MID).lerp(WARM, (v - 0.4) / 0.3)
  return out.copy(WARM).lerp(FAST, (v - 0.7) / 0.3)
}

function dotTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 64
  const g = c.getContext("2d")!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, "rgba(255,255,255,1)")
  grad.addColorStop(0.35, "rgba(255,255,255,0.6)")
  grad.addColorStop(1, "rgba(255,255,255,0)")
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

const PER_STREAM = 46

export function Airflow() {
  const flow = useGarage((s) => s.flow)
  const curves = useMemo(
    () =>
      STREAMS.map((s) => {
        const curve = new THREE.CatmullRomCurve3(s.map(([x, y, z]) => new THREE.Vector3(x, y, z)))
        const speeds = s.map((p) => p[3])
        const speedAt = (t: number) => {
          const f = t * (speeds.length - 1)
          const i = Math.min(speeds.length - 2, Math.floor(f))
          return speeds[i] + (speeds[i + 1] - speeds[i]) * (f - i)
        }
        const pts = curve.getPoints(90)
        const colors = pts.map((_, i) => speedColor(speedAt(i / 90)).toArray() as [number, number, number])
        return { curve, speedAt, pts, colors }
      }),
    [],
  )
  const count = curves.length * PER_STREAM
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    return g
  }, [count])
  const phase = useMemo(() => Float32Array.from({ length: count }, (_, i) => (i % PER_STREAM) / PER_STREAM + Math.random() * 0.01), [count])
  const tex = useMemo(dotTexture, [])
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), c: new THREE.Color() }), [])
  const group = useRef<THREE.Group>(null!)

  useFrame((_, dt) => {
    group.current.visible = useGarage.getState().flow
    if (!group.current.visible) return
    const pos = geom.attributes.position as THREE.BufferAttribute
    const col = geom.attributes.color as THREE.BufferAttribute
    curves.forEach((c, s) => {
      for (let k = 0; k < PER_STREAM; k++) {
        const i = s * PER_STREAM + k
        const v = c.speedAt(phase[i])
        phase[i] = (phase[i] + dt * (0.06 + v * 0.16)) % 1
        c.curve.getPointAt(phase[i], tmp.v)
        pos.setXYZ(i, tmp.v.x, tmp.v.y, tmp.v.z)
        speedColor(v, tmp.c)
        col.setXYZ(i, tmp.c.r, tmp.c.g, tmp.c.b)
      }
    })
    pos.needsUpdate = true
    col.needsUpdate = true
  })

  return (
    <group ref={group} visible={flow}>
      {curves.map((c, i) => (
        <Line key={i} points={c.pts} vertexColors={c.colors} lineWidth={1} transparent opacity={0.28} depthWrite={false} toneMapped={false} />
      ))}
      <points geometry={geom}>
        <pointsMaterial size={0.07} map={tex} vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} sizeAttenuation />
      </points>
      {flow && (
        <Html position={[0, 2.2, -3.6]} center className="flow-legend-wrap">
          <div className="flow-legend"><span>Air speed</span><i /><small>slow</small><small>fast</small></div>
        </Html>
      )}
    </group>
  )
}

// ── Dimensions ──────────────────────────────────────────────────────────────
function Dimension({ from, to, label, tick = 0.08 }: { from: THREE.Vector3Tuple; to: THREE.Vector3Tuple; label: string; tick?: number }) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to)
  const dir = b.clone().sub(a).normalize()
  const side = new THREE.Vector3(0, 1, 0).cross(dir).normalize().multiplyScalar(tick)
  const mid = a.clone().add(b).multiplyScalar(0.5)
  return (
    <group>
      <Line points={[a, b]} color="#ff6a4d" lineWidth={1.2} dashed dashSize={0.06} gapSize={0.04} toneMapped={false} />
      <Line points={[a.clone().add(side), a.clone().sub(side)]} color="#ff6a4d" lineWidth={1.5} toneMapped={false} />
      <Line points={[b.clone().add(side), b.clone().sub(side)]} color="#ff6a4d" lineWidth={1.5} toneMapped={false} />
      <Html position={mid.toArray()} center className="dim-wrap"><div className="dim">{label}</div></Html>
    </group>
  )
}

function scanTexture() {
  const c = document.createElement("canvas")
  c.width = 256
  c.height = 16
  const g = c.getContext("2d")!
  const grad = g.createLinearGradient(0, 0, 256, 0)
  grad.addColorStop(0, "rgba(255,60,20,0)")
  grad.addColorStop(0.75, "rgba(255,80,30,0.35)")
  grad.addColorStop(0.97, "rgba(255,220,200,1)")
  grad.addColorStop(1, "rgba(255,220,200,0)")
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 16)
  return new THREE.CanvasTexture(c)
}

// A glowing scan plane that sweeps nose to tail as the X-ray view switches on.
function ScanSweep() {
  const ref = useRef<THREE.Mesh>(null!)
  const tex = useMemo(scanTexture, [])
  const start = useRef(performance.now())
  useFrame(() => {
    const k = (performance.now() - start.current) / 1300
    ref.current.visible = k < 1
    ref.current.position.z = 3.4 - k * 6.8
  })
  return (
    <mesh ref={ref} rotation={[0, Math.PI / 2, 0]} position={[0, 0.7, 3.4]}>
      <planeGeometry args={[1.6, 1.8]} />
      <meshBasicMaterial map={tex} transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  )
}

export function Blueprint() {
  const technical = useGarage((s) => s.technical)
  if (!technical) return null
  return (
    <group>
      <gridHelper args={[14, 56, "#5a1a10", "#2a0c08"]} position={[0, 0.003, 0]} />
      <ScanSweep />
      <Dimension from={[1.25, 0.02, 1.75]} to={[1.25, 0.02, -1.65]} label="Wheelbase 3400 mm (max)" />
      <Dimension from={[-0.95, 0.02, 3.05]} to={[0.95, 0.02, 3.05]} label="Width 1900 mm (max)" />
      <Dimension from={[-1.25, 0, 1.75]} to={[-1.25, 0.72, 1.75]} label="18-inch rim" tick={0.06} />
      <Html position={[0, 1.5, 0.2]} center className="dim-wrap"><div className="dim strong">Min. mass 768 kg · −30% downforce · −55% drag</div></Html>
    </group>
  )
}
