"use client"

import { useFrame } from "@react-three/fiber"
import { useLayoutEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { gridSlot, race } from "@/lib/race"
import { ROAD_WIDTH, placeOnTrack, track } from "@/lib/track"

const L = track.length
const HALF = ROAD_WIDTH / 2

// Builds a flat or vertical strip that follows the track between two lateral offsets.
function ribbon(from: number, to: number, opts: { y?: number; height?: number; vRepeat?: number; filter?: (s: number) => boolean; step?: number } = {}) {
  const { y = 0.01, height = 0, vRepeat = 10, filter, step = 2 } = opts
  const pos: number[] = [], uv: number[] = [], index: number[] = []
  const p = new THREE.Vector3(), left = new THREE.Vector3()
  let run = -1
  for (let s = 0; s <= L; s += step) {
    if (filter && !filter(s)) { run = -1; continue }
    track.point(s, p)
    track.left(s, left)
    const base = pos.length / 3
    if (height) {
      // Vertical wall at lateral offset `from`.
      pos.push(p.x + left.x * from, y, p.z + left.z * from, p.x + left.x * from, y + height, p.z + left.z * from)
    } else {
      pos.push(p.x + left.x * from, y, p.z + left.z * from, p.x + left.x * to, y, p.z + left.z * to)
    }
    uv.push(0, s / vRepeat, 1, s / vRepeat)
    if (run >= 0) index.push(run, run + 1, base, run + 1, base + 1, base)
    run = base
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(index)
  if (height) g.computeVertexNormals()
  else g.setAttribute("normal", new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3))
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

const wall = () =>
  canvasTexture(64, 32, (g) => {
    g.fillStyle = "#2b2f36"
    g.fillRect(0, 0, 64, 32)
    g.fillStyle = "#3a3f48"
    g.fillRect(0, 22, 64, 4)
    g.fillStyle = "#c8ccd2"
    g.fillRect(0, 0, 64, 3)
  })

const crowd = () =>
  canvasTexture(512, 128, (g) => {
    g.fillStyle = "#07080a"
    g.fillRect(0, 0, 512, 128)
    for (let i = 0; i < 2600; i++) {
      const colors = ["#e11d48", "#f59e0b", "#e5e7eb", "#3b82f6", "#22c55e", "#f472b6"]
      g.fillStyle = colors[i % colors.length]
      g.globalAlpha = 0.25 + Math.random() * 0.6
      g.fillRect(Math.random() * 512, Math.random() * 128, 2, 2)
    }
  })

function lampTexture() {
  return canvasTexture(256, 160, (g) => {
    g.fillStyle = "#15171b"
    g.fillRect(0, 0, 256, 160)
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 6; x++) {
        const cx = 24 + x * 42, cy = 22 + y * 38
        const grad = g.createRadialGradient(cx, cy, 0, cx, cy, 16)
        grad.addColorStop(0, "#ffffff")
        grad.addColorStop(0.5, "#e8f0ff")
        grad.addColorStop(1, "#2a2f3a")
        g.fillStyle = grad
        g.beginPath()
        g.arc(cx, cy, 15, 0, Math.PI * 2)
        g.fill()
      }
  }, false)
}

const curved = (s: number) => Math.abs(track.curvature(s)) > 0.0045

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
  const textures = useMemo(() => ({ asphalt: asphalt(), kerb: kerb(), wall: wall(), crowd: crowd(), lamp: lampTexture() }), [])
  const geo = useMemo(
    () => ({
      road: ribbon(HALF, -HALF, { vRepeat: 24 }),
      kerbL: ribbon(HALF + 1.3, HALF - 0.1, { y: 0.02, vRepeat: 3, filter: curved, step: 1 }),
      kerbR: ribbon(-HALF + 0.1, -HALF - 1.3, { y: 0.02, vRepeat: 3, filter: curved, step: 1 }),
      runoffL: ribbon(HALF + 9, HALF, { y: 0.005, vRepeat: 40 }),
      runoffR: ribbon(-HALF, -HALF - 9, { y: 0.005, vRepeat: 40 }),
      wallL: ribbon(HALF + 9, 0, { height: 1.1, vRepeat: 4 }),
      wallR: ribbon(-HALF - 9, 0, { height: 1.1, vRepeat: 4 }),
    }),
    [],
  )

  // Floodlight towers every 70 m, alternating sides, aimed at the track.
  const towers = useMemo(() => {
    const out: { s: number; side: number }[] = []
    for (let s = 20, k = 0; s < L; s += 70, k++) out.push({ s, side: k % 2 ? 1 : -1 })
    return out
  }, [])
  const poles = useRef<THREE.InstancedMesh>(null!)
  const heads = useRef<THREE.InstancedMesh>(null!)
  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    towers.forEach(({ s, side }, i) => {
      placeOnTrack(o, s, side * (HALF + 12), 4)
      o.updateMatrix()
      poles.current.setMatrixAt(i, o.matrix)
      placeOnTrack(o, s, side * (HALF + 11.6), 8.4)
      o.rotateY((side * Math.PI) / 2)
      o.rotateX(-0.35)
      o.updateMatrix()
      heads.current.setMatrixAt(i, o.matrix)
    })
    poles.current.instanceMatrix.needsUpdate = true
    heads.current.instanceMatrix.needsUpdate = true
  }, [towers])

  // Start line and grid boxes.
  const marks = useMemo(() => {
    const out: { s: number; lat: number; w: number; d: number }[] = [{ s: 0, lat: 0, w: ROAD_WIDTH, d: 0.6 }]
    for (let i = 0; i < 12; i++) { const g = gridSlot(i); out.push({ s: g.s + 2.9, lat: g.lat, w: 2.6, d: 0.18 }) }
    return out
  }, [])

  return (
    <group>
      <mesh geometry={geo.road} receiveShadow><meshStandardMaterial map={textures.asphalt} roughness={0.78} metalness={0.05} envMapIntensity={0.15} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={geo.kerbL} receiveShadow><meshStandardMaterial map={textures.kerb} roughness={0.6} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={geo.kerbR} receiveShadow><meshStandardMaterial map={textures.kerb} roughness={0.6} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={geo.runoffL}><meshStandardMaterial color="#141619" roughness={1} envMapIntensity={0} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={geo.runoffR}><meshStandardMaterial color="#141619" roughness={1} envMapIntensity={0} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={geo.wallL}><meshStandardMaterial map={textures.wall} side={THREE.DoubleSide} roughness={0.7} /></mesh>
      <mesh geometry={geo.wallR}><meshStandardMaterial map={textures.wall} side={THREE.DoubleSide} roughness={0.7} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[160, -0.02, 0]}>
        <planeGeometry args={[900, 900]} />
        <meshStandardMaterial color="#040506" roughness={1} envMapIntensity={0} />
      </mesh>
      {marks.map((m, i) => <Mark key={i} {...m} />)}
      <instancedMesh ref={poles} args={[undefined, undefined, towers.length]}>
        <boxGeometry args={[0.3, 8, 0.3]} />
        <meshStandardMaterial color="#2a2e35" metalness={0.7} roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, towers.length]}>
        <boxGeometry args={[3.2, 2, 0.2]} />
        <meshStandardMaterial color="#15171b" emissive="#ffffff" emissiveMap={textures.lamp} emissiveIntensity={1.9} toneMapped={false} />
      </instancedMesh>
      {/* Main grandstand along the start/finish straight */}
      {[0, 1, 2].map((tier) => (
        <mesh key={tier} position={[HALF + 16 + tier * 3, 1.2 + tier * 2.2, 0]}>
          <boxGeometry args={[3, 2.2, 230]} />
          <meshStandardMaterial color="#0b0c0f" emissive="#ffffff" emissiveMap={textures.crowd} emissiveIntensity={0.55} />
        </mesh>
      ))}
      <Gantry />
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
