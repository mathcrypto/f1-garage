"use client"

import { Decal, Html } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { useLayoutEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import type { Team } from "@/lib/teams"
import { liveryFor } from "@/lib/liveries"
import { useGarage } from "@/lib/store"
import { airfoil, loft, plate, profile, rod, tube, tyre, type Section } from "./geometry"
import { paintLivery, sideUV, useWordmark } from "./livery"
import { IDLE, useMotion } from "./CarMotion"
import { Part } from "./Part"

// ── Materials ────────────────────────────────────────────────────────────────

function carbonTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const g = c.getContext("2d")!
  g.fillStyle = "#16171a"
  g.fillRect(0, 0, 128, 128)
  // Finer 2×2 twill with a slight highlight thread.
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const on = (x + y) % 4 < 2
      g.fillStyle = on ? "#2c2e34" : "#121316"
      g.fillRect(x * 8, y * 8, 8, 8)
      g.fillStyle = on ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.12)"
      g.fillRect(x * 8, y * 8, 8, 1)
    }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(14, 14)
  t.anisotropy = 8
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Twill bump for carbon — reads as weave under studio light. */
function carbonNormalMap() {
  const s = 128
  const c = document.createElement("canvas")
  c.width = c.height = s
  const g = c.getContext("2d")!
  const img = g.createImageData(s, s)
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const on = ((x >> 3) + (y >> 3)) % 4 < 2
      const h = on ? 170 : 90
      const i = (y * s + x) * 4
      img.data[i] = h
      img.data[i + 1] = h
      img.data[i + 2] = 255
      img.data[i + 3] = 255
    }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(18, 18)
  t.anisotropy = 8
  return t
}

/** Soft orange-peel noise on paint so clearcoat isn’t a flat mirror. */
function paintNormalMap() {
  const s = 256
  const c = document.createElement("canvas")
  c.width = c.height = s
  const g = c.getContext("2d")!
  const img = g.createImageData(s, s)
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const n = (Math.sin(x * 0.37) * Math.cos(y * 0.29) + Math.sin((x + y) * 0.11)) * 0.5 + 0.5
      const h = 118 + Math.floor(n * 28)
      const i = (y * s + x) * 4
      img.data[i] = h
      img.data[i + 1] = h
      img.data[i + 2] = 255
      img.data[i + 3] = 255
    }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(6, 6)
  t.anisotropy = 4
  return t
}

const liveryCache = new Map<string, THREE.Texture>()
function cachedLivery(id: string, design: ReturnType<typeof liveryFor>) {
  const key = `${id}:${design.style}:${design.base}:${design.rear ?? ""}:${design.lower}:${design.stripe}:${design.finish}`
  let t = liveryCache.get(key)
  if (!t) { t = paintLivery(design); liveryCache.set(key, t) }
  return t
}

function finishParams(finish: "gloss" | "matte" | "satin") {
  // Automotive paint: a coloured base under a clear coat that catches the
  // studio softboxes. Matte liveries keep a little sheen but no mirror.
  if (finish === "matte") {
    return {
      metalness: 0.04,
      roughness: 0.62,
      clearcoat: 0.15,
      clearcoatRoughness: 0.5,
      reflectivity: 0.2,
      envMapIntensity: 0.55,
      sheen: 0.2,
      sheenRoughness: 0.8,
      sheenColor: new THREE.Color("#b8b8bc"),
    }
  }
  if (finish === "satin") {
    return {
      metalness: 0.08,
      roughness: 0.42,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
      reflectivity: 0.35,
      envMapIntensity: 0.8,
      sheen: 0.06,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color("#b8b8bc"),
    }
  }
  return {
    metalness: 0.1,
    roughness: 0.34,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    reflectivity: 0.45,
    envMapIntensity: 1,
    sheen: 0,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color("#b8b8bc"),
  }
}

function useMaterials(team: Team) {
  const carbonMap = useMemo(() => (typeof document === "undefined" ? null : carbonTexture()), [])
  const carbonNormal = useMemo(() => (typeof document === "undefined" ? null : carbonNormalMap()), [])
  const paintNormal = useMemo(() => (typeof document === "undefined" ? null : paintNormalMap()), [])
  const design = liveryFor(team.id)
  // Painted once per team and kept, so switching teams or modes is instant.
  const liveryMap = useMemo(() => cachedLivery(team.id, design), [team.id, design])
  return useMemo(() => {
    const finish = finishParams(design.finish)
    const paint = (color: string) =>
      new THREE.MeshPhysicalMaterial({
        color,
        metalness: finish.metalness,
        roughness: finish.roughness,
        clearcoat: finish.clearcoat,
        clearcoatRoughness: finish.clearcoatRoughness,
        reflectivity: finish.reflectivity,
        envMapIntensity: finish.envMapIntensity,
        sheen: finish.sheen,
        sheenRoughness: finish.sheenRoughness,
        sheenColor: finish.sheenColor,
        normalMap: paintNormal,
        normalScale: new THREE.Vector2(0.18, 0.18),
      })
    return {
      // Bodywork: full-side wrap with clearcoat matching the team's finish.
      livery: new THREE.MeshPhysicalMaterial({
        map: liveryMap,
        metalness: finish.metalness,
        roughness: finish.roughness * 0.95,
        clearcoat: finish.clearcoat,
        clearcoatRoughness: finish.clearcoatRoughness,
        reflectivity: finish.reflectivity,
        envMapIntensity: finish.envMapIntensity,
        sheen: finish.sheen,
        sheenRoughness: finish.sheenRoughness,
        sheenColor: finish.sheenColor,
        normalMap: paintNormal,
        normalScale: new THREE.Vector2(0.14, 0.14),
      }),
      paint: paint(design.base),
      paint2: paint(design.lower),
      accent: paint(design.stripe),
      carbon: new THREE.MeshPhysicalMaterial({
        color: "#1a1b1f",
        map: carbonMap,
        normalMap: carbonNormal,
        normalScale: new THREE.Vector2(0.55, 0.55),
        roughness: 0.42,
        metalness: 0.28,
        clearcoat: 0.85,
        clearcoatRoughness: 0.1,
        envMapIntensity: 0.75,
      }),
      floorCarbon: new THREE.MeshPhysicalMaterial({
        color: "#121316",
        map: carbonMap,
        normalMap: carbonNormal,
        normalScale: new THREE.Vector2(0.4, 0.4),
        roughness: 0.7,
        metalness: 0.15,
        clearcoat: 0.2,
        clearcoatRoughness: 0.5,
        envMapIntensity: 0.25,
      }),
      // Thin dark seams between panels — sell the volume.
      seam: new THREE.MeshStandardMaterial({ color: "#050506", roughness: 0.95, metalness: 0 }),
      // Wings / floor / suspension — matte carbon like the reference renders.
      aeroCarbon: new THREE.MeshPhysicalMaterial({
        color: "#141518",
        map: carbonMap,
        normalMap: carbonNormal,
        normalScale: new THREE.Vector2(0.7, 0.7),
        roughness: 0.6,
        metalness: 0.15,
        clearcoat: 0.45,
        clearcoatRoughness: 0.25,
        envMapIntensity: 0.5,
      }),
      // Halo colour from livery (Ferrari 2026 show car = black; others often white).
      halo: new THREE.MeshPhysicalMaterial({
        color: design.halo ?? "#f2f2f4",
        roughness: 0.4,
        metalness: 0.12,
        clearcoat: 0.7,
        clearcoatRoughness: 0.12,
        envMapIntensity: 0.75,
      }),
      matte: new THREE.MeshStandardMaterial({ color: "#121316", roughness: 0.78, metalness: 0.06 }),
      inlet: new THREE.MeshStandardMaterial({ color: "#030304", roughness: 0.95, metalness: 0 }),
      rubber: new THREE.MeshPhysicalMaterial({
        color: "#0e0e10",
        roughness: 0.92,
        metalness: 0.02,
        clearcoat: 0.06,
        clearcoatRoughness: 0.75,
        sheen: 0.25,
        sheenRoughness: 0.9,
        sheenColor: new THREE.Color("#2a2a2e"),
        envMapIntensity: 0.2,
      }),
      rim: new THREE.MeshPhysicalMaterial({ color: "#3a3d44", roughness: 0.26, metalness: 0.9, clearcoat: 0.5, clearcoatRoughness: 0.15, envMapIntensity: 0.9 }),
      metal: new THREE.MeshStandardMaterial({ color: "#b0b5bc", roughness: 0.32, metalness: 0.9, envMapIntensity: 0.55 }),
      titanium: new THREE.MeshPhysicalMaterial({ color: "#6a6e75", roughness: 0.35, metalness: 0.85, clearcoat: 0.25, clearcoatRoughness: 0.35 }),
      brass: new THREE.MeshStandardMaterial({ color: "#b8925a", roughness: 0.35, metalness: 0.9 }),
      plank: new THREE.MeshStandardMaterial({ color: "#8a6a43", roughness: 0.85 }),
      pirelli: new THREE.MeshStandardMaterial({ color: "#e4002b", roughness: 0.55, emissive: "#e4002b", emissiveIntensity: 0.08 }),
      brake: new THREE.MeshStandardMaterial({ color: "#2a1a12", roughness: 0.6, emissive: "#ff6a1a", emissiveIntensity: 0, envMapIntensity: 0.35 }),
      ers: new THREE.MeshStandardMaterial({ color: "#0b2a33", roughness: 0.45, emissive: "#22d3ee", emissiveIntensity: 0.25 }),
      rain: new THREE.MeshStandardMaterial({ color: "#300", emissive: "#ff1a1a", emissiveIntensity: 0.35 }),
      helmet: paint(design.stripe),
      visor: new THREE.MeshPhysicalMaterial({
        color: "#050508",
        roughness: 0.15,
        metalness: 0.7,
        clearcoat: 0.5,
        clearcoatRoughness: 0.12,
        envMapIntensity: 0.6,
      }),
    }
  }, [team, carbonMap, carbonNormal, paintNormal, liveryMap, design])
}
type Mats = ReturnType<typeof useMaterials>

// ── Geometry, built once ─────────────────────────────────────────────────────

const mirrorX = (s: Section[]) => s.map((p) => ({ ...p, x: -(p.x ?? 0) }))
// 2026 show-car undercut: tall inlet lip, then deep carve toward the coke-bottle.
const SIDEPOD: Section[] = [
  { z: 0.52, x: 0.4, w: 0.34, h: 0.38, y: 0.52, n: 5 },
  { z: 0.3, x: 0.52, w: 0.52, h: 0.42, y: 0.5, n: 5 },
  { z: 0.0, x: 0.54, w: 0.5, h: 0.28, y: 0.38, n: 4.5 },
  { z: -0.5, x: 0.42, w: 0.34, h: 0.18, y: 0.3, n: 4 },
  { z: -1.0, x: 0.28, w: 0.22, h: 0.14, y: 0.26, n: 3.5 },
  { z: -1.55, x: 0.16, w: 0.1, h: 0.09, y: 0.22, n: 3 },
]

function useGeometry() {
  return useMemo(() => {
    const frontRods = (s: 1 | -1) => [
      rod([0.18 * s, 0.52, 1.95], [0.64 * s, 0.48, 1.76]),
      rod([0.18 * s, 0.52, 1.52], [0.64 * s, 0.48, 1.74]),
      rod([0.16 * s, 0.34, 1.98], [0.66 * s, 0.26, 1.76]),
      rod([0.16 * s, 0.34, 1.5], [0.66 * s, 0.26, 1.74]),
      rod([0.2 * s, 0.62, 1.6], [0.6 * s, 0.28, 1.72], 0.011),
      rod([0.18 * s, 0.42, 1.88], [0.64 * s, 0.38, 1.88], 0.009),
    ]
    const rearRods = (s: 1 | -1) => [
      rod([0.1 * s, 0.44, -1.5], [0.62 * s, 0.47, -1.64]),
      rod([0.1 * s, 0.44, -1.9], [0.62 * s, 0.47, -1.66]),
      rod([0.1 * s, 0.28, -1.48], [0.64 * s, 0.26, -1.64]),
      rod([0.1 * s, 0.28, -1.92], [0.64 * s, 0.26, -1.66]),
      rod([0.14 * s, 0.56, -1.7], [0.58 * s, 0.28, -1.66], 0.011),
    ]
    return {
      nose: sideUV(loft([
        { z: 2.62, w: 0.08, h: 0.06, y: 0.18, n: 2.2 },
        { z: 2.35, w: 0.16, h: 0.12, y: 0.22 },
        { z: 1.95, w: 0.26, h: 0.2, y: 0.3 },
        { z: 1.5, w: 0.34, h: 0.28, y: 0.38 },
        { z: 1.12, w: 0.4, h: 0.34, y: 0.45, n: 3 },
      ])),
      chassis: sideUV(loft([
        { z: 1.15, w: 0.4, h: 0.34, y: 0.45, n: 3 },
        { z: 0.7, w: 0.52, h: 0.44, y: 0.48, n: 3 },
        { z: 0.15, w: 0.66, h: 0.5, y: 0.48, n: 3.2 },
        { z: -0.42, w: 0.7, h: 0.52, y: 0.48, n: 3.4 },
      ])),
      cover: sideUV(loft([
        { z: -0.36, w: 0.7, h: 0.52, y: 0.48, n: 3.4 },
        { z: -0.85, w: 0.55, h: 0.54, y: 0.5, n: 3 },
        { z: -1.4, w: 0.32, h: 0.4, y: 0.46, n: 2.6 },
        { z: -1.95, w: 0.16, h: 0.24, y: 0.42 },
        { z: -2.28, w: 0.08, h: 0.12, y: 0.4 },
      ])),
      airbox: sideUV(loft([
        { z: -0.22, w: 0.2, h: 0.18, y: 0.95 },
        { z: -0.48, w: 0.24, h: 0.26, y: 0.92 },
        { z: -0.95, w: 0.16, h: 0.24, y: 0.84 },
        { z: -1.5, w: 0.05, h: 0.1, y: 0.72 },
      ])),
      fin: sideUV(profile([[-0.65, 1.0], [-2.05, 0.68], [-2.05, 0.54], [-0.95, 0.82]], 0.012)),
      sidepodL: sideUV(loft(SIDEPOD)),
      sidepodR: sideUV(loft(mirrorX(SIDEPOD))),
      floor: plate([[0.22, 1.32], [0.5, 0.98], [0.84, 0.62], [0.93, 0.2], [0.93, -1.05], [0.8, -1.35], [0.56, -1.5], [0.53, -2.05]], 0.022),
      halo: tube([[-0.28, 0.76, -0.38], [-0.26, 0.94, -0.08], [-0.14, 0.99, 0.16], [0, 0.99, 0.26], [0.14, 0.99, 0.16], [0.26, 0.94, -0.08], [0.28, 0.76, -0.38]], 0.034),
      haloPillar: tube([[0, 0.99, 0.26], [0, 0.9, 0.38], [0, 0.76, 0.48]], 0.03, 16),
      fwMain: airfoil(1.8, 0.36, 0.09),
      fwFlap1: airfoil(1.62, 0.22, 0.1),
      fwFlap2: airfoil(1.5, 0.16, 0.12),
      fwEndplate: sideUV(profile([[2.74, 0.04], [2.74, 0.2], [2.46, 0.31], [2.12, 0.31], [2.12, 0.05]], 0.015)),
      rwMain: airfoil(1.0, 0.32, 0.1),
      rwFlap: airfoil(1.0, 0.24, 0.1),
      rwEndplate: sideUV(profile([[-2.36, 0.74], [-2.4, 1.1], [-2.94, 1.12], [-2.9, 0.82]], 0.016)),
      swanNeck: profile([[-2.28, 0.42], [-2.36, 0.9], [-2.5, 0.9], [-2.44, 0.42]], 0.022),
      gearbox: loft([{ z: -1.55, w: 0.27, h: 0.26, y: 0.36 }, { z: -2.32, w: 0.15, h: 0.17, y: 0.37 }]),
      frontRodsL: frontRods(1), frontRodsR: frontRods(-1),
      rearRodsL: rearRods(1), rearRodsR: rearRods(-1),
      exhaust: tube([[0, 0.55, -1.42], [0, 0.56, -1.9], [0, 0.5, -2.36]], 0.04, 24),
      ersCable: tube([[0.12, 0.3, -0.55], [0.22, 0.34, -0.7], [0.2, 0.3, -0.62]], 0.012, 16),
      fwFlap3: airfoil(1.24, 0.12, 0.12),
      haloFin: airfoil(0.2, 0.07, 0.12),
      pitot: rod([0, 0.235, 2.56], [0, 0.24, 2.86], 0.006),
      tyreFront: tyre(0.36, 0.23, 0.3),
      tyreRear: tyre(0.36, 0.23, 0.38),
    }
  }, [])
}
type Geo = ReturnType<typeof useGeometry>

// ── Components ───────────────────────────────────────────────────────────────

function Wheel({ geo, m, side, front }: { geo: Geo; m: Mats; side: 1 | -1; front: boolean }) {
  const steer = useRef<THREE.Group>(null!)
  const spin = useRef<THREE.Group>(null!)
  const brake = useRef<THREE.Mesh>(null!)
  const motion = useMotion()
  const width = front ? 0.3 : 0.38
  const half = width / 2

  useFrame((_, dt) => {
    const m = motion ?? IDLE
    const driving = motion !== null
    const speed = m.speed / 3.6
    // Rear tyres spin far faster than the car moves during the burnout. On
    // screen the spin is capped: above that a real wheel just looks blurred,
    // and faster rotation strobes (the wheels seem to shake or run backwards).
    const spinBoost = !front ? m.wheelspin * 70 : 0
    spin.current.rotation.x += Math.min(speed / 0.36 + spinBoost, 14) * dt
    if (front) steer.current.rotation.y = THREE.MathUtils.damp(steer.current.rotation.y, m.steer, 4, dt)
    const mat = brake.current.material as THREE.MeshStandardMaterial
    mat.emissiveIntensity = THREE.MathUtils.damp(mat.emissiveIntensity, driving ? m.braking * 6 : 0, 4, dt)
  })

  return (
    <group position={[(front ? 0.8 : 0.76) * side, 0.36, front ? 1.75 : -1.65]}>
      <group ref={steer}>
        <group ref={spin}>
          <mesh geometry={front ? geo.tyreFront : geo.tyreRear} material={m.rubber} />
          <mesh material={m.rim} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.232, 0.232, width * 0.85, 48]} />
          </mesh>
          {/* 2026-style flat aero wheel covers (show-car look) */}
          <mesh material={m.aeroCarbon} rotation={[0, 0, Math.PI / 2]} position={[side * (half - 0.008), 0, 0]}>
            <cylinderGeometry args={[0.215, 0.215, 0.014, 48]} />
          </mesh>
          <mesh material={m.rim} rotation={[0, 0, Math.PI / 2]} position={[side * (half + 0.002), 0, 0]}>
            <cylinderGeometry args={[0.048, 0.048, 0.028, 20]} />
          </mesh>
          <mesh material={m.rim} rotation={[0, Math.PI / 2, 0]} position={[side * (half - 0.004), 0, 0]}>
            <torusGeometry args={[0.222, 0.011, 10, 64]} />
          </mesh>
          <mesh material={m.pirelli} rotation={[0, Math.PI / 2, 0]} position={[side * (half + 0.004), 0, 0]}>
            <torusGeometry args={[0.295, 0.008, 8, 64]} />
          </mesh>
          {/* Carbon brake disc: glows under heavy braking in drive mode */}
          <mesh ref={brake} material={m.brake} rotation={[0, Math.PI / 2, 0]} position={[-side * (half - 0.03), 0, 0]} userData={{ keepEmissive: true }}>
            <torusGeometry args={[0.14, 0.03, 10, 48]} />
          </mesh>
        </group>
        <mesh material={m.carbon} rotation={[0, 0, Math.PI / 2]} position={[-side * (half + 0.04), 0, 0]}>
          <cylinderGeometry args={[0.19, 0.17, 0.08, 32]} />
        </mesh>
        {/* Brake duct: cooling scoop and the little winglets mounted on the drum */}
        <mesh material={m.inlet} position={[-side * (half + 0.07), -0.1, front ? 0.17 : 0.16]}><boxGeometry args={[0.06, 0.07, 0.03]} /></mesh>
        <mesh material={m.carbon} position={[-side * (half + 0.11), 0.2, 0.06]} rotation={[0.15, 0, 0]}><boxGeometry args={[0.1, 0.007, 0.16]} /></mesh>
        <mesh material={m.carbon} position={[-side * (half + 0.11), 0.26, -0.04]} rotation={[0.25, 0, 0]}><boxGeometry args={[0.09, 0.007, 0.12]} /></mesh>
      </group>
    </group>
  )
}

function Flap({ geometry, material, position, corner, straight }: { geometry: THREE.BufferGeometry; material: THREE.Material; position: THREE.Vector3Tuple; corner: number; straight: number }) {
  const ref = useRef<THREE.Mesh>(null!)
  const motion = useMotion()
  useFrame((_, dt) => {
    // Straight Mode (straight) = flaps open/flat; Corner Mode (corner) = flaps up for downforce.
    const open = motion !== null && motion.aero === "straight"
    ref.current.rotation.x = THREE.MathUtils.damp(ref.current.rotation.x, open ? straight : corner, 14, dt)
  })
  return <mesh ref={ref} geometry={geometry} material={material} position={position} rotation={[corner, 0, 0]} />
}

function PowerUnit({ geo, m }: { geo: Geo; m: Mats }) {
  const battery = useRef<THREE.Mesh>(null!)
  const motion = useMotion()
  useFrame((state) => {
    const mat = battery.current.material as THREE.MeshStandardMaterial
    mat.emissiveIntensity = motion ? 0.4 + motion.ers * 2.5 : 0.35 + 0.15 * Math.sin(state.clock.elapsedTime * 2)
  })
  return (
    <>
      <mesh material={m.titanium} position={[0, 0.4, -0.95]}><boxGeometry args={[0.32, 0.24, 0.62]} /></mesh>
      {[1, -1].map((s) => (
        <mesh key={s} material={m.metal} position={[0.14 * s, 0.55, -0.95]} rotation={[0, 0, -0.6 * s]}><boxGeometry args={[0.1, 0.12, 0.58]} /></mesh>
      ))}
      <mesh material={m.brass} position={[0, 0.52, -1.38]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.09, 0.09, 0.14, 28]} /></mesh>
      <mesh material={m.metal} geometry={geo.exhaust} />
      <mesh material={m.titanium} position={[0.2, 0.3, -0.62]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.07, 0.07, 0.16, 24]} /></mesh>
      <mesh ref={battery} material={m.ers} position={[0, 0.3, -0.55]} userData={{ keepEmissive: true }}><boxGeometry args={[0.42, 0.1, 0.3]} /></mesh>
      <mesh material={m.ers} geometry={geo.ersCable} userData={{ keepEmissive: true }} />
      {/* Compressor and intercooler feed */}
      <mesh material={m.brass} position={[0, 0.52, -0.6]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.07, 0.06, 0.1, 24]} /></mesh>
      <mesh material={m.metal} position={[0, 0.52, -1.0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.018, 0.018, 0.78, 12]} /></mesh>
      {/* Control electronics */}
      <mesh material={m.matte} position={[-0.17, 0.3, -1.2]}><boxGeometry args={[0.1, 0.08, 0.2]} /></mesh>
      <PuLabels />
    </>
  )
}

const PU_LABELS: [string, THREE.Vector3Tuple][] = [
  ["ICE · 1.6 L V6", [0, 0.82, -1.0]],
  ["Turbocharger", [0, 0.68, -1.55]],
  ["Compressor", [0, 0.68, -0.42]],
  ["MGU-K · up to 350 kW", [0.38, 0.2, -0.72]],
  ["Energy store", [-0.34, 0.18, -0.42]],
  ["Control electronics", [-0.38, 0.32, -1.3]],
  ["Exhaust", [0, 0.6, -2.2]],
]

// Labels the power unit's internals when it's selected or in blueprint view.
export function PuLabels() {
  const show = useGarage((s) => s.selected === "power-unit" || (s.technical && s.exploded))
  if (!show) return null
  return (
    <>
      {PU_LABELS.map(([text, pos]) => (
        <Html key={text} position={pos} center zIndexRange={[18, 0]} className="spec-tag-wrap">
          <div className="pu-tag">{text}</div>
        </Html>
      ))}
    </>
  )
}

// A sticker projected onto the parent mesh's surface.
function Badge({ map, position, rotation, scale }: { map: THREE.Texture; position: THREE.Vector3Tuple; rotation: THREE.Vector3Tuple; scale: THREE.Vector3Tuple }) {
  return (
    <Decal position={position} rotation={rotation} scale={scale}>
      <meshPhysicalMaterial map={map} transparent polygonOffset polygonOffsetFactor={-6} depthWrite={false} roughness={0.4} clearcoat={0.45} clearcoatRoughness={0.2} metalness={0.06} envMapIntensity={0.5} />
    </Decal>
  )
}

export function Car({ team }: { team: Team }) {
  const m = useMaterials(team)
  const geo = useGeometry()
  const design = liveryFor(team.id)
  const word = useWordmark(design.wordmark, design.wordmarkColor)
  const carName = useWordmark(team.car, design.wordmarkColor)
  const body = useRef<THREE.Group>(null!)

  // Real-time shadows need cast/receive on every mesh (groups don’t inherit).
  useLayoutEffect(() => {
    body.current?.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
    })
  }, [team.id, m])

  return (
    <group ref={body}>
      {/* Panel gaps — catch SSAO / soft light so the body doesn’t read as one blob */}
      <mesh material={m.seam} position={[0, 0.52, 0.35]}><boxGeometry args={[0.72, 0.006, 0.01]} /></mesh>
      <mesh material={m.seam} position={[0, 0.48, -0.38]}><boxGeometry args={[0.7, 0.006, 0.01]} /></mesh>
      <mesh material={m.seam} position={[0.52, 0.42, -0.2]} rotation={[0, 0, 0.05]}><boxGeometry args={[0.008, 0.28, 1.0]} /></mesh>
      <mesh material={m.seam} position={[-0.52, 0.42, -0.2]} rotation={[0, 0, -0.05]}><boxGeometry args={[0.008, 0.28, 1.0]} /></mesh>
      <mesh material={m.seam} position={[0, 0.62, -0.9]}><boxGeometry args={[0.4, 0.005, 0.01]} /></mesh>

      <Part id="front-wing" explode={[0, 0.07, 1.38]}>
        <mesh geometry={geo.fwMain} material={m.aeroCarbon} position={[0, 0.08, 2.72]} rotation={[0.1, 0, 0]} />
        <Flap geometry={geo.fwFlap1} material={m.aeroCarbon} position={[0, 0.125, 2.44]} corner={0.72} straight={0.02} />
        <Flap geometry={geo.fwFlap2} material={m.aeroCarbon} position={[0, 0.185, 2.28]} corner={0.95} straight={0.06} />
        <Flap geometry={geo.fwFlap3} material={m.aeroCarbon} position={[0, 0.255, 2.16]} corner={1.18} straight={0.12} />
        {[1, -1].map((s) => <mesh key={s} geometry={geo.fwEndplate} material={m.aeroCarbon} position={[0.92 * s, 0, 0]} />)}
        {[1, -1].map((s) => (
          <mesh key={s} material={m.aeroCarbon} position={[0.06 * s, 0.15, 2.46]}><boxGeometry args={[0.012, 0.1, 0.12]} /></mesh>
        ))}
      </Part>

      <Part id="nose" explode={[0, 0.58, 1.09]}>
        <mesh geometry={geo.nose} material={m.livery}>
          <Badge map={carName} position={[0, 0.5, 1.72]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.26, 0.065, 0.3]} />
        </mesh>
        <mesh geometry={geo.pitot} material={m.metal} />
        {[1, -1].map((s) => (
          <mesh key={s} material={m.matte} position={[0.13 * s, 0.43, 1.62]} rotation={[Math.PI / 2, 0, 0]}><capsuleGeometry args={[0.018, 0.07, 4, 10]} /></mesh>
        ))}
      </Part>

      <Part id="front-suspension" explode={[0.65, 0.51, 0.29]}>
        {geo.frontRodsL.map((g, i) => <mesh key={i} geometry={g} material={m.aeroCarbon} />)}
      </Part>
      <Part id="front-suspension" explode={[-0.65, 0.51, 0.29]} label={false}>
        {geo.frontRodsR.map((g, i) => <mesh key={i} geometry={g} material={m.aeroCarbon} />)}
      </Part>

      <Part id="cockpit" explode={[0, 0.8, 0.22]}>
        <mesh geometry={geo.chassis} material={m.livery} />
        <mesh material={m.inlet} position={[0, 0.77, -0.06]} scale={[0.22, 0.05, 0.4]}><sphereGeometry args={[1, 32, 16]} /></mesh>
        <mesh material={m.helmet} position={[0, 0.84, -0.2]}><sphereGeometry args={[0.11, 32, 24]} /></mesh>
        <mesh material={m.visor} position={[0, 0.85, -0.13]} scale={[0.85, 0.35, 0.6]}><sphereGeometry args={[0.1, 24, 12]} /></mesh>
        <mesh geometry={geo.halo} material={m.halo} />
        <mesh geometry={geo.haloPillar} material={m.halo} />
        <mesh geometry={geo.haloFin} material={m.aeroCarbon} position={[0, 0.995, 0.24]} rotation={[0.1, 0, 0]} />
        {[1, -1].map((s) => (
          <group key={s}>
            <mesh material={m.aeroCarbon} position={[0.37 * s, 0.8, 0.28]}><boxGeometry args={[0.13, 0.05, 0.03]} /></mesh>
            <mesh material={m.aeroCarbon} geometry={rodCache(s)} />
          </group>
        ))}
      </Part>

      <Part id="sidepods" explode={[0.94, 0.07, 0]}>
        <mesh geometry={geo.sidepodL} material={m.livery}>
          <Badge map={word} position={[0.7, 0.43, -0.32]} rotation={[0, Math.PI / 2, 0]} scale={[0.82, 0.2, 0.25]} />
        </mesh>
        <mesh material={m.inlet} position={[0.5, 0.5, 0.48]} scale={[0.15, 0.14, 0.012]}><sphereGeometry args={[1, 24, 12]} /></mesh>
      </Part>
      <Part id="sidepods" explode={[-0.94, 0.07, 0]} label={false}>
        <mesh geometry={geo.sidepodR} material={m.livery}>
          <Badge map={word} position={[-0.7, 0.43, -0.32]} rotation={[0, -Math.PI / 2, 0]} scale={[0.82, 0.2, 0.25]} />
        </mesh>
        <mesh material={m.inlet} position={[-0.5, 0.5, 0.48]} scale={[0.15, 0.14, 0.012]}><sphereGeometry args={[1, 24, 12]} /></mesh>
      </Part>

      <Part id="floor" explode={[1.9, 0, 0]}>
        <mesh geometry={geo.floor} material={m.floorCarbon} position={[0, 0.075, 0]} />
        <mesh material={m.plank} position={[0, 0.046, -0.4]}><boxGeometry args={[0.3, 0.008, 2.6]} /></mesh>
        {[0.32, 0.45, 0.58].flatMap((x) => [x, -x]).map((x) => (
          <mesh key={x} material={m.aeroCarbon} position={[x, 0.04, 1.0]} rotation={[0, x * 0.25, 0]}><boxGeometry args={[0.01, 0.07, 0.42]} /></mesh>
        ))}
        {[1, -1].map((s) => (
          <group key={s}>
            <mesh material={m.aeroCarbon} position={[0.97 * s, 0.11, -0.45]} rotation={[0, 0, -0.35 * s]}><boxGeometry args={[0.09, 0.006, 0.55]} /></mesh>
            <mesh material={m.aeroCarbon} position={[0.93 * s, 0.055, -0.4]}><boxGeometry args={[0.006, 0.05, 1.25]} /></mesh>
            <mesh material={m.inlet} position={[0.42 * s, 0.05, 1.18]}><boxGeometry args={[0.2, 0.045, 0.02]} /></mesh>
          </group>
        ))}
      </Part>

      <Part id="engine-cover" explode={[0, 1.52, -0.22]}>
        <mesh geometry={geo.cover} material={m.livery} />
        <mesh geometry={geo.airbox} material={m.livery} />
        <mesh material={m.inlet} position={[0, 0.93, -0.25]} scale={[0.09, 0.08, 0.02]}><sphereGeometry args={[1, 24, 12]} /></mesh>
        <mesh geometry={geo.fin} material={m.livery}>
          <Badge map={carName} position={[0.007, 0.76, -1.45]} rotation={[0, Math.PI / 2, 0]} scale={[0.62, 0.15, 0.008]} />
          <Badge map={carName} position={[-0.007, 0.76, -1.45]} rotation={[0, -Math.PI / 2, 0]} scale={[0.62, 0.15, 0.008]} />
        </mesh>
        <mesh material={m.inlet} position={[0, 0.44, -2.33]} scale={[0.05, 0.06, 0.01]}><sphereGeometry args={[1, 16, 8]} /></mesh>
        {[1, -1].flatMap((s) => [0, 1, 2, 3, 4].map((i) => (
          <mesh key={`${s}${i}`} material={m.inlet} position={[0.24 * s, 0.73 - i * 0.012, -0.98 - i * 0.07]} rotation={[0, 0, 0.55 * s]}><boxGeometry args={[0.12, 0.006, 0.014]} /></mesh>
        )))}
        <mesh material={m.matte} position={[0, 1.065, -0.36]}><boxGeometry args={[0.09, 0.035, 0.06]} /></mesh>
        {[1, -1].map((s) => (
          <mesh key={s} material={m.matte} position={[0.13 * s, 0.95, -0.45]} rotation={[Math.PI / 2, 0, 0]}><capsuleGeometry args={[0.016, 0.06, 4, 10]} /></mesh>
        ))}
      </Part>

      <Part id="power-unit" explode={[0, 0.51, 0]}>
        <PowerUnit geo={geo} m={m} />
      </Part>

      <Part id="rear-suspension" explode={[0, 0.43, -0.8]}>
        <mesh geometry={geo.gearbox} material={m.aeroCarbon} />
        {[...geo.rearRodsL, ...geo.rearRodsR].map((g, i) => <mesh key={i} geometry={g} material={m.aeroCarbon} />)}
      </Part>

      <Part id="diffuser" explode={[0, 0.05, -1.25]}>
        <mesh material={m.aeroCarbon} position={[0, 0.18, -2.1]} rotation={[0.38, 0, 0]}><boxGeometry args={[1.04, 0.015, 0.66]} /></mesh>
        {[-0.4, -0.18, 0.18, 0.4].map((x) => (
          <mesh key={x} material={m.aeroCarbon} position={[x, 0.22, -2.12]} rotation={[0.38, 0, 0]}><boxGeometry args={[0.01, 0.12, 0.6]} /></mesh>
        ))}
        <mesh material={m.rain} position={[0, 0.36, -2.42]} userData={{ keepEmissive: true }}><boxGeometry args={[0.12, 0.05, 0.02]} /></mesh>
      </Part>


      <Part id="rear-wing" explode={[0, 0.87, -1.45]}>
        <mesh geometry={geo.rwMain} material={m.aeroCarbon} position={[0, 0.88, -2.42]} rotation={[0.18, 0, 0]} />
        <Flap geometry={geo.rwFlap} material={m.aeroCarbon} position={[0, 0.98, -2.68]} corner={1.05} straight={-0.12} />
        {[1, -1].map((s) => (
          <mesh key={s} geometry={geo.rwEndplate} material={m.aeroCarbon} position={[0.51 * s, 0, 0]} />
        ))}
        <mesh geometry={geo.swanNeck} material={m.aeroCarbon} />
        <mesh material={m.matte} position={[0, 0.93, -2.56]} rotation={[Math.PI / 2, 0, 0]}><capsuleGeometry args={[0.024, 0.18, 4, 12]} /></mesh>
        {[1, -1].flatMap((s) => [0, 1, 2].map((i) => (
          <mesh key={`${s}${i}`} material={m.inlet} position={[0.52 * s, 0.82 + i * 0.035, -2.5]}><boxGeometry args={[0.02, 0.008, 0.16]} /></mesh>
        )))}
      </Part>

      <Part id="front-tyres" explode={[0.87, 0, 0.22]}>
        <Wheel geo={geo} m={m} side={1} front />
      </Part>
      <Part id="front-tyres" explode={[-0.87, 0, 0.22]} label={false}>
        <Wheel geo={geo} m={m} side={-1} front />
      </Part>
      <Part id="rear-tyres" explode={[0.87, 0, -0.22]}>
        <Wheel geo={geo} m={m} side={1} front={false} />
      </Part>
      <Part id="rear-tyres" explode={[-0.87, 0, -0.22]} label={false}>
        <Wheel geo={geo} m={m} side={-1} front={false} />
      </Part>
    </group>
  )
}

// Mirror stalks, cached so they're not rebuilt on every render.
const stalks = new Map<number, THREE.BufferGeometry>()
function rodCache(s: number) {
  if (!stalks.has(s)) stalks.set(s, rod([0.31 * s, 0.8, 0.28], [0.3 * s, 0.68, 0.2], 0.008))
  return stalks.get(s)!
}
