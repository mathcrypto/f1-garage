"use client"

import { useFrame } from "@react-three/fiber"
import { useLayoutEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { gridSlot, race } from "@/lib/race"
import { ROAD_WIDTH, WALL_LAT, placeOnTrack, track } from "@/lib/track"

const L = track.length
const HALF = ROAD_WIDTH / 2

// Builds a flat strip that follows the track between two lateral offsets.
function ribbon(from: number, to: number, opts: { y?: number; vRepeat?: number; filter?: (s: number) => boolean; step?: number } = {}) {
  const { y = 0.01, vRepeat = 10, filter, step = 2 } = opts
  const pos: number[] = [], uv: number[] = [], index: number[] = []
  const p = new THREE.Vector3(), left = new THREE.Vector3()
  let run = -1
  for (let s = 0; s <= L; s += step) {
    if (filter && !filter(s)) { run = -1; continue }
    track.point(s, p)
    track.left(s, left)
    const base = pos.length / 3
    const h = p.y + y
    pos.push(p.x + left.x * from, h, p.z + left.z * from, p.x + left.x * to, h, p.z + left.z * to)
    uv.push(0, s / vRepeat, 1, s / vRepeat)
    if (run >= 0) index.push(run, run + 1, base, run + 1, base + 1, base)
    run = base
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(index)
  // Keep normals skyward so the road stays lit from above on undulating sections.
  g.setAttribute("normal", new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3))
  return g
}

/** Vertical Armco face at a lateral offset. */
function wallFace(lat: number, height = 1.05, step = 0.9) {
  const pos: number[] = [], index: number[] = []
  const p = new THREE.Vector3(), left = new THREE.Vector3()
  let run = -1
  for (let s = 0; s <= L; s += step) {
    track.point(s, p)
    track.left(s, left)
    const base = pos.length / 3
    pos.push(
      p.x + left.x * lat, p.y, p.z + left.z * lat,
      p.x + left.x * lat, p.y + height, p.z + left.z * lat,
    )
    if (run >= 0) index.push(run, run + 1, base, run + 1, base + 1, base)
    run = base
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(index)
  g.computeVertexNormals()
  return g
}

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = true) {
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  draw(c.getContext("2d")!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  return t
}

const asphalt = () =>
  canvasTexture(256, 512, (g) => {
    g.fillStyle = "#1b1c1f"
    g.fillRect(0, 0, 256, 512)
    for (let i = 0; i < 9000; i++) {
      const v = 18 + Math.random() * 30
      g.fillStyle = `rgb(${v},${v},${v + 2})`
      g.fillRect(Math.random() * 256, Math.random() * 512, 1.5, 1.5)
    }
    // White edge lines and a darker, rubbered-in racing line.
    g.fillStyle = "#e8e8e8"
    g.fillRect(6, 0, 5, 512)
    g.fillRect(245, 0, 5, 512)
    const grad = g.createLinearGradient(70, 0, 186, 0)
    grad.addColorStop(0, "rgba(0,0,0,0)")
    grad.addColorStop(0.5, "rgba(0,0,0,0.35)")
    grad.addColorStop(1, "rgba(0,0,0,0)")
    g.fillStyle = grad
    g.fillRect(70, 0, 116, 512)
  })

const kerb = () =>
  canvasTexture(16, 64, (g) => {
    g.fillStyle = "#d81e1e"
    g.fillRect(0, 0, 16, 32)
    g.fillStyle = "#f2f2f2"
    g.fillRect(0, 32, 16, 32)
  })

/** Heavy braking — gravel traps outside the Armco. */
const gravelZone = (s: number) => track.targetSpeed(s) < 58
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

const grass = () =>
  canvasTexture(256, 256, (g) => {
    g.fillStyle = "#3f6a32"
    g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 12000; i++) {
      const v = 40 + Math.random() * 50
      g.fillStyle = `rgb(${v * 0.45},${v},${v * 0.35})`
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2)
    }
  })

const gravel = () =>
  canvasTexture(128, 128, (g) => {
    g.fillStyle = "#8a8478"
    g.fillRect(0, 0, 128, 128)
    for (let i = 0; i < 4000; i++) {
      const v = 110 + Math.random() * 50
      g.fillStyle = `rgb(${v},${v - 4},${v - 12})`
      g.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 1.5)
    }
  })

// Five pods of four lamps across the start line. They light one by one and
// all go out together for the start.
export function Gantry() {
  const lamps = useRef<THREE.Mesh[]>([])
  const group = useRef<THREE.Group>(null!)
  useLayoutEffect(() => placeOnTrack(group.current, 18, 0), [])
  const off = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1a0606", emissive: "#ff1a1a", emissiveIntensity: 0 }), [])
  useFrame(() => {
    lamps.current.forEach((m, i) => {
      const pod = Math.floor(i / 4)
      const mat = m.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = pod < race.lights ? 6 : 0
    })
  })
  return (
    <group ref={group}>
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * (HALF + 1.2), 3.5, 0]}><boxGeometry args={[0.35, 7, 0.35]} /><meshStandardMaterial color="#30343b" metalness={0.6} roughness={0.5} /></mesh>
      ))}
      <mesh position={[0, 6.6, 0]}><boxGeometry args={[ROAD_WIDTH + 2.8, 0.8, 0.5]} /><meshStandardMaterial color="#1c1f24" metalness={0.5} roughness={0.5} /></mesh>
      {Array.from({ length: 5 }, (_, pod) => (
        <group key={pod} position={[(pod - 2) * 1.5, 6.6, -0.3]}>
          <mesh><boxGeometry args={[1.0, 1.9, 0.3]} /><meshStandardMaterial color="#0c0d10" /></mesh>
          {[0, 1, 2, 3].map((k) => (
            <mesh
              key={k}
              ref={(m) => { if (m) lamps.current[pod * 4 + k] = m }}
              position={[(k % 2) * 0.44 - 0.22, Math.floor(k / 2) * -0.5 + 0.5, -0.16]}
              rotation={[Math.PI / 2, 0, 0]}
              material={off.clone()}
            >
              <cylinderGeometry args={[0.17, 0.17, 0.05, 20]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

export function Circuit() {
  const textures = useMemo(() => {
    const g = grass()
    g.repeat.set(120, 120)
    return { asphalt: asphalt(), kerb: kerb(), grass: g, gravel: gravel() }
  }, [])
  const RUN = WALL_LAT
  const geo = useMemo(() => {
    const kerbOpts = { y: 0.045, vRepeat: 2.2, step: 1.0 }
    // Grass runoff (not sandy highway shoulder).
    const runoffOpts = { y: 0.004, vRepeat: 70, step: 1.5 }
    const gravelOpts = { y: 0.007, vRepeat: 40, filter: gravelZone, step: 1.5 }
    return {
      road: ribbon(HALF, -HALF, { vRepeat: 55, step: 1.5 }),
      sides: ([1, -1] as const).map((side) => ({
        side,
        kerb: side > 0
          ? ribbon(HALF + 1.35, HALF - 0.08, kerbOpts)
          : ribbon(-(HALF - 0.08), -(HALF + 1.35), kerbOpts),
        runoff: side > 0
          ? ribbon(RUN, HALF, runoffOpts)
          : ribbon(-HALF, -RUN, runoffOpts),
        gravel: side > 0
          ? ribbon(RUN + 11, RUN, gravelOpts)
          : ribbon(-RUN, -(RUN + 11), gravelOpts),
        wall: wallFace(side * RUN, 1.05),
      })),
    }
  }, [])

  const marks = useMemo(() => {
    const out: { s: number; lat: number; w: number; d: number }[] = [{ s: 0, lat: 0, w: ROAD_WIDTH, d: 0.6 }]
    for (let i = 0; i < 12; i++) { const g = gridSlot(i); out.push({ s: g.s + 2.9, lat: g.lat, w: 2.6, d: 0.18 }) }
    return out
  }, [])

  const posts = useMemo(() => {
    const out: { s: number; lat: number }[] = []
    for (let s = 0; s < L; s += 7) {
      out.push({ s, lat: RUN })
      out.push({ s, lat: -RUN })
    }
    return out
  }, [RUN])

  const fences = useMemo(() => {
    const out: { s: number; lat: number }[] = []
    for (let s = 0; s < L; s += 10) {
      if (track.targetSpeed(s) < 70) continue
      out.push({ s, lat: RUN + 0.35 })
      if (hash(s) > 0.4) out.push({ s, lat: -(RUN + 0.35) })
    }
    return out
  }, [RUN])

  const hoardings = useMemo(() => {
    const colors = ["#e10600", "#ffffff", "#1a1a1a", "#0066ff", "#ff8700"]
    const out: { s: number; lat: number; color: string }[] = []
    for (let s = 30; s < L; s += 55) {
      if (Math.abs(track.curvature(s)) > 0.008) continue
      const side = hash(s) > 0.45 ? 1 : -1
      out.push({ s, lat: side * (RUN + 2.4), color: colors[Math.floor(hash(s + 2) * colors.length)] })
    }
    return out
  }, [RUN])

  const boards = useMemo(() => {
    const out: { s: number; lat: number; label: string }[] = []
    for (let s = 40; s < L; s += 8) {
      if (track.targetSpeed(s) > 55 || track.targetSpeed(s - 30) < 70) continue
      out.push({ s: s - 100, lat: RUN + 3.5, label: "100" })
      out.push({ s: s - 200, lat: RUN + 3.5, label: "200" })
      s += 180
    }
    return out.filter((b) => b.s > 0 && b.s < L)
  }, [RUN])

  const tires = useMemo(() => {
    const out: { s: number; lat: number }[] = []
    for (let s = 0; s < L; s += 12) {
      if (Math.abs(track.curvature(s)) < 0.015) continue
      out.push({ s, lat: Math.sign(track.curvature(s) || 1) * (RUN + 1.15) })
    }
    return out
  }, [RUN])

  // Simple spectator bank on the main straight only (well clear of the racing line).
  const stands = useMemo(() => {
    const out: { s: number; lat: number }[] = []
    for (let s = 80; s < 420; s += 55) out.push({ s, lat: RUN + 38 })
    return out
  }, [RUN])

  return (
    <group>
      <mesh geometry={geo.road} receiveShadow><meshStandardMaterial map={textures.asphalt} roughness={0.78} metalness={0.05} envMapIntensity={0.25} side={THREE.DoubleSide} /></mesh>
      {geo.sides.map(({ side, kerb: kerbGeo, runoff, gravel: gravelGeo, wall }) => (
        <group key={side}>
          <mesh geometry={kerbGeo} receiveShadow><meshStandardMaterial map={textures.kerb} roughness={0.55} side={THREE.DoubleSide} /></mesh>
          <mesh geometry={runoff}><meshStandardMaterial color="#4d6b3e" roughness={0.95} envMapIntensity={0.1} side={THREE.DoubleSide} /></mesh>
          <mesh geometry={gravelGeo}><meshStandardMaterial map={textures.gravel} roughness={1} side={THREE.DoubleSide} /></mesh>
          <mesh geometry={wall}><meshStandardMaterial color="#c5c9d0" roughness={0.55} metalness={0.35} side={THREE.DoubleSide} /></mesh>
        </group>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -4, 0]}>
        <planeGeometry args={[3200, 3200]} />
        <meshStandardMaterial map={textures.grass} roughness={1} envMapIntensity={0.12} />
      </mesh>
      {marks.map((m, i) => <Mark key={i} {...m} />)}
      {posts.map((p, i) => <ArmcoPost key={i} {...p} />)}
      {fences.map((f, i) => <CatchFence key={i} {...f} />)}
      {hoardings.map((h, i) => <Hoarding key={i} {...h} />)}
      {boards.map((b, i) => <DistanceBoard key={i} {...b} />)}
      {tires.map((t, i) => <TireStack key={i} {...t} />)}
      {stands.map((st, i) => <SpectatorBank key={i} {...st} />)}
      <Gantry />
    </group>
  )
}

function ArmcoPost({ s, lat }: { s: number; lat: number }) {
  const ref = useRef<THREE.Mesh>(null!)
  useLayoutEffect(() => { placeOnTrack(ref.current, s, lat, 0.55) }, [s, lat])
  return (
    <mesh ref={ref}>
      <boxGeometry args={[0.12, 1.1, 0.12]} />
      <meshStandardMaterial color="#8a9098" metalness={0.5} roughness={0.4} />
    </mesh>
  )
}

function CatchFence({ s, lat }: { s: number; lat: number }) {
  const ref = useRef<THREE.Group>(null!)
  useLayoutEffect(() => { placeOnTrack(ref.current, s, lat, 0) }, [s, lat])
  return (
    <group ref={ref}>
      <mesh position={[0, 2.2, 0]}><boxGeometry args={[0.06, 4.4, 0.06]} /><meshStandardMaterial color="#2a2e34" metalness={0.4} roughness={0.55} /></mesh>
      <mesh position={[0, 3.4, 0]}><planeGeometry args={[9.5, 2.6]} /><meshStandardMaterial color="#9aa0a8" transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} /></mesh>
    </group>
  )
}

function Hoarding({ s, lat, color }: { s: number; lat: number; color: string }) {
  const ref = useRef<THREE.Group>(null!)
  useLayoutEffect(() => { placeOnTrack(ref.current, s, lat, 0) }, [s, lat])
  return (
    <group ref={ref}>
      <mesh position={[0, 0.9, 0]}><boxGeometry args={[0.08, 1.8, 0.08]} /><meshStandardMaterial color="#222" /></mesh>
      <mesh position={[0, 1.55, 0]}><boxGeometry args={[0.12, 1.35, 6.5]} /><meshStandardMaterial color={color} roughness={0.65} /></mesh>
    </group>
  )
}

function SpectatorBank({ s, lat }: { s: number; lat: number }) {
  const ref = useRef<THREE.Group>(null!)
  useLayoutEffect(() => { placeOnTrack(ref.current, s, lat, 0) }, [s, lat])
  return (
    <group ref={ref}>
      <mesh position={[0, 0.5, 0]}><boxGeometry args={[10, 1, 48]} /><meshStandardMaterial color="#b8bcc4" roughness={0.85} /></mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[2.2 + i * 2, 1.4 + i * 1.5, 0]} rotation={[0, 0, -0.14]}>
          <boxGeometry args={[2.2, 1.5, 46]} />
          <meshStandardMaterial color={i % 2 ? "#3a4550" : "#2e3842"} roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

function DistanceBoard({ s, lat, label }: { s: number; lat: number; label: string }) {
  const ref = useRef<THREE.Group>(null!)
  const tex = useMemo(() => canvasTexture(128, 64, (g) => {
    g.fillStyle = "#111"
    g.fillRect(0, 0, 128, 64)
    g.fillStyle = "#f2f2f2"
    g.font = "bold 36px sans-serif"
    g.textAlign = "center"
    g.textBaseline = "middle"
    g.fillText(label, 64, 34)
  }, false), [label])
  useLayoutEffect(() => { placeOnTrack(ref.current, s, lat, 0) }, [s, lat])
  return (
    <group ref={ref}>
      <mesh position={[0, 1.1, 0]}><boxGeometry args={[0.08, 2.2, 0.08]} /><meshStandardMaterial color="#222" /></mesh>
      <mesh position={[0, 2.35, 0]}><planeGeometry args={[1.4, 0.7]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
    </group>
  )
}

function TireStack({ s, lat }: { s: number; lat: number }) {
  const ref = useRef<THREE.Group>(null!)
  useLayoutEffect(() => { placeOnTrack(ref.current, s, lat, 0) }, [s, lat])
  return (
    <group ref={ref}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.28 + i * 0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.32, 0.14, 8, 12]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.85} />
        </mesh>
      ))}
    </group>
  )
}

function Mark({ s, lat, w, d }: { s: number; lat: number; w: number; d: number }) {
  const ref = useRef<THREE.Mesh>(null!)
  useLayoutEffect(() => {
    placeOnTrack(ref.current, s, lat, 0.025)
    ref.current.rotateX(-Math.PI / 2)
  }, [s, lat])
  return (
    <mesh ref={ref}>
      <planeGeometry args={[w, d]} />
      <meshBasicMaterial color="#f2f2f2" toneMapped={false} />
    </mesh>
  )
}
