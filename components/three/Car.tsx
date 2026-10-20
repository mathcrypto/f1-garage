"use client"

import { useFrame } from "@react-three/fiber"
import { useMemo, useRef } from "react"
import * as THREE from "three"
import type { Team } from "@/lib/teams"
import { telemetry } from "@/lib/drive"
import { useGarage } from "@/lib/store"
import { airfoil, loft, plate, profile, rod, tube, tyre, type Section } from "./geometry"
import { Part } from "./Part"

// ── Materials ────────────────────────────────────────────────────────────────

function carbonTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 64
  const g = c.getContext("2d")!
  g.fillStyle = "#18191c"
  g.fillRect(0, 0, 64, 64)
  // 2×2 twill weave
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const on = (x + y) % 4 < 2
      g.fillStyle = on ? "#2a2c31" : "#141518"
      g.fillRect(x * 8, y * 8, 8, 8)
    }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(10, 10)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function useMaterials(team: Team) {
  const carbonMap = useMemo(() => (typeof document === "undefined" ? null : carbonTexture()), [])
  return useMemo(() => {
    const paint = (color: string) =>
      new THREE.MeshPhysicalMaterial({ color, metalness: 0.35, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 })
    return {
      paint: paint(team.livery.primary),
      paint2: paint(team.livery.secondary),
      accent: paint(team.livery.accent),
      carbon: new THREE.MeshPhysicalMaterial({ color: "#1b1c20", map: carbonMap, roughness: 0.42, metalness: 0.25, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
      // Satin carbon for big flat surfaces, which would mirror the studio lights.
      floorCarbon: new THREE.MeshStandardMaterial({ color: "#141518", map: carbonMap, roughness: 0.7, metalness: 0.15 }),
      matte: new THREE.MeshStandardMaterial({ color: "#121316", roughness: 0.7, metalness: 0.1 }),
      inlet: new THREE.MeshStandardMaterial({ color: "#040405", roughness: 0.9 }),
      rubber: new THREE.MeshStandardMaterial({ color: "#151517", roughness: 0.88, metalness: 0 }),
      rim: new THREE.MeshStandardMaterial({ color: "#2c2e33", roughness: 0.3, metalness: 0.9 }),
      metal: new THREE.MeshStandardMaterial({ color: "#a8adb4", roughness: 0.25, metalness: 1 }),
      titanium: new THREE.MeshStandardMaterial({ color: "#5d6066", roughness: 0.35, metalness: 0.9 }),
      brass: new THREE.MeshStandardMaterial({ color: "#b8925a", roughness: 0.3, metalness: 1 }),
      plank: new THREE.MeshStandardMaterial({ color: "#8a6a43", roughness: 0.8 }),
      pirelli: new THREE.MeshStandardMaterial({ color: "#e4002b", roughness: 0.5, emissive: "#e4002b", emissiveIntensity: 0.15 }),
      brake: new THREE.MeshStandardMaterial({ color: "#2a1a12", roughness: 0.6, emissive: "#ff6a1a", emissiveIntensity: 0 }),
      ers: new THREE.MeshStandardMaterial({ color: "#0b2a33", roughness: 0.4, emissive: "#22d3ee", emissiveIntensity: 0.4 }),
      rain: new THREE.MeshStandardMaterial({ color: "#300", emissive: "#ff1a1a", emissiveIntensity: 0.6 }),
      helmet: paint(team.livery.secondary),
      visor: new THREE.MeshPhysicalMaterial({ color: "#0a0a0c", roughness: 0.05, metalness: 0.6, clearcoat: 1 }),
    }
  }, [team, carbonMap])
}
type Mats = ReturnType<typeof useMaterials>

// ── Geometry, built once ─────────────────────────────────────────────────────

const mirrorX = (s: Section[]) => s.map((p) => ({ ...p, x: -(p.x ?? 0) }))
// Wide, boxy inlet that sweeps down and in toward the floor (downwash).
const SIDEPOD: Section[] = [
  { z: 0.42, x: 0.47, w: 0.4, h: 0.32, y: 0.47, n: 5 },
  { z: 0.3, x: 0.48, w: 0.46, h: 0.38, y: 0.46, n: 5 },
  { z: -0.2, x: 0.46, w: 0.48, h: 0.34, y: 0.42, n: 4.5 },
  { z: -0.8, x: 0.4, w: 0.4, h: 0.24, y: 0.34, n: 4 },
  { z: -1.3, x: 0.3, w: 0.26, h: 0.16, y: 0.27, n: 3.5 },
  { z: -1.65, x: 0.22, w: 0.1, h: 0.08, y: 0.23, n: 3 },
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
      nose: loft([
        { z: 2.55, w: 0.1, h: 0.07, y: 0.2, n: 2.2 },
        { z: 2.3, w: 0.18, h: 0.13, y: 0.24 },
        { z: 1.9, w: 0.28, h: 0.22, y: 0.32 },
        { z: 1.5, w: 0.36, h: 0.3, y: 0.4 },
        { z: 1.12, w: 0.42, h: 0.36, y: 0.46, n: 3 },
      ]),
      chassis: loft([
        { z: 1.15, w: 0.42, h: 0.36, y: 0.46, n: 3 },
        { z: 0.7, w: 0.56, h: 0.46, y: 0.5, n: 3 },
        { z: 0.2, w: 0.7, h: 0.52, y: 0.5, n: 3.2 },
        { z: -0.42, w: 0.76, h: 0.56, y: 0.5, n: 3.4 },
      ]),
      cover: loft([
        { z: -0.36, w: 0.76, h: 0.56, y: 0.5, n: 3.4 },
        { z: -0.9, w: 0.62, h: 0.58, y: 0.52, n: 3 },
        { z: -1.5, w: 0.38, h: 0.44, y: 0.48, n: 2.6 },
        { z: -2.0, w: 0.2, h: 0.28, y: 0.44 },
        { z: -2.32, w: 0.09, h: 0.13, y: 0.42 },
      ]),
      airbox: loft([
        { z: -0.26, w: 0.22, h: 0.2, y: 0.93 },
        { z: -0.5, w: 0.25, h: 0.26, y: 0.9 },
        { z: -0.95, w: 0.17, h: 0.24, y: 0.82 },
        { z: -1.45, w: 0.05, h: 0.1, y: 0.7 },
      ]),
      fin: profile([[-0.7, 0.98], [-2.1, 0.66], [-2.1, 0.52], [-1.0, 0.8]], 0.012),
      sidepodL: loft(SIDEPOD),
      sidepodR: loft(mirrorX(SIDEPOD)),
      floor: plate([[0.22, 1.32], [0.5, 0.98], [0.84, 0.62], [0.93, 0.2], [0.93, -1.05], [0.8, -1.35], [0.56, -1.5], [0.53, -2.05]], 0.022),
      halo: tube([[-0.27, 0.78, -0.36], [-0.25, 0.93, -0.08], [-0.13, 0.97, 0.16], [0, 0.97, 0.24], [0.13, 0.97, 0.16], [0.25, 0.93, -0.08], [0.27, 0.78, -0.36]], 0.03),
      haloPillar: tube([[0, 0.97, 0.24], [0, 0.9, 0.36], [0, 0.78, 0.46]], 0.026, 16),
      fwMain: airfoil(1.8, 0.36, 0.09),
      fwFlap1: airfoil(1.62, 0.22, 0.1),
      fwFlap2: airfoil(1.5, 0.16, 0.12),
      fwEndplate: profile([[2.74, 0.04], [2.74, 0.2], [2.46, 0.31], [2.12, 0.31], [2.12, 0.05]], 0.015),
      rwMain: airfoil(1.0, 0.32, 0.1),
      rwFlap: airfoil(1.0, 0.24, 0.1),
      rwEndplate: profile([[-2.36, 0.74], [-2.4, 1.1], [-2.94, 1.12], [-2.9, 0.82]], 0.016),
      swanNeck: profile([[-2.28, 0.42], [-2.36, 0.9], [-2.5, 0.9], [-2.44, 0.42]], 0.022),
      beam1: airfoil(0.8, 0.16, 0.12),
      beam2: airfoil(0.8, 0.15, 0.12),
      gearbox: loft([{ z: -1.55, w: 0.27, h: 0.26, y: 0.36 }, { z: -2.32, w: 0.15, h: 0.17, y: 0.37 }]),
      frontRodsL: frontRods(1), frontRodsR: frontRods(-1),
      rearRodsL: rearRods(1), rearRodsR: rearRods(-1),
      exhaust: tube([[0, 0.55, -1.42], [0, 0.56, -1.9], [0, 0.5, -2.36]], 0.04, 24),
      ersCable: tube([[0.12, 0.3, -0.55], [0.22, 0.34, -0.7], [0.2, 0.3, -0.62]], 0.012, 16),
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
  const width = front ? 0.3 : 0.38
  const half = width / 2

  useFrame((_, dt) => {
    const driving = useGarage.getState().mode === "drive"
    const speed = driving ? telemetry.speed / 3.6 : 0
    spin.current.rotation.x += (speed / 0.36) * dt
    if (front) steer.current.rotation.y = THREE.MathUtils.damp(steer.current.rotation.y, driving ? telemetry.steer : 0, 6, dt)
    const mat = brake.current.material as THREE.MeshStandardMaterial
    mat.emissiveIntensity = THREE.MathUtils.damp(mat.emissiveIntensity, driving ? telemetry.braking * 6 : 0, 4, dt)
  })

  return (
    <group position={[(front ? 0.8 : 0.78) * side, 0.36, front ? 1.75 : -1.65]}>
      <group ref={steer}>
        <group ref={spin}>
          <mesh geometry={front ? geo.tyreFront : geo.tyreRear} material={m.rubber} />
          <mesh material={m.rim} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.232, 0.232, width * 0.9, 40]} />
          </mesh>
          {/* Carbon wheel cover with a team-colour ring, and the Pirelli compound band */}
          <mesh material={m.floorCarbon} rotation={[0, 0, Math.PI / 2]} position={[side * (half - 0.01), 0, 0]}>
            <cylinderGeometry args={[0.218, 0.218, 0.012, 40]} />
          </mesh>
          <mesh material={m.paint} rotation={[0, Math.PI / 2, 0]} position={[side * (half - 0.002), 0, 0]}>
            <torusGeometry args={[0.2, 0.01, 8, 64]} />
          </mesh>
          <mesh material={m.rim} rotation={[0, 0, Math.PI / 2]} position={[side * (half - 0.002), 0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.03, 16]} />
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
      </group>
    </group>
  )
}

function Flap({ geometry, material, position, corner, straight }: { geometry: THREE.BufferGeometry; material: THREE.Material; position: THREE.Vector3Tuple; corner: number; straight: number }) {
  const ref = useRef<THREE.Mesh>(null!)
  useFrame((_, dt) => {
    const open = useGarage.getState().mode === "drive" && telemetry.aero === "straight"
    ref.current.rotation.x = THREE.MathUtils.damp(ref.current.rotation.x, open ? straight : corner, 7, dt)
  })
  return <mesh ref={ref} geometry={geometry} material={material} position={position} rotation={[corner, 0, 0]} />
}

function PowerUnit({ geo, m }: { geo: Geo; m: Mats }) {
  const battery = useRef<THREE.Mesh>(null!)
  useFrame((state) => {
    const driving = useGarage.getState().mode === "drive"
    const mat = battery.current.material as THREE.MeshStandardMaterial
    mat.emissiveIntensity = driving ? 0.4 + telemetry.ers * 2.5 : 0.35 + 0.15 * Math.sin(state.clock.elapsedTime * 2)
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
    </>
  )
}

export function Car({ team }: { team: Team }) {
  const m = useMaterials(team)
  const geo = useGeometry()
  const body = useRef<THREE.Group>(null!)

  // Ride the bumps, pitch under braking, roll into the corner.
  useFrame((state, dt) => {
    const driving = useGarage.getState().mode === "drive"
    const t = state.clock.elapsedTime
    const b = body.current
    b.position.y = THREE.MathUtils.damp(b.position.y, driving ? Math.sin(t * 31) * 0.003 + Math.sin(t * 7.3) * 0.004 : 0, 12, dt)
    b.rotation.x = THREE.MathUtils.damp(b.rotation.x, driving ? telemetry.braking * 0.012 : 0, 5, dt)
    b.rotation.z = THREE.MathUtils.damp(b.rotation.z, driving ? -telemetry.steer * 0.12 : 0, 4, dt)
  })

  return (
    <group ref={body}>
      <Part id="front-wing" explode={[0, 0.07, 1.38]}>
        <mesh geometry={geo.fwMain} material={m.accent} position={[0, 0.09, 2.7]} rotation={[0.08, 0, 0]} />
        <Flap geometry={geo.fwFlap1} material={m.accent} position={[0, 0.13, 2.42]} corner={0.38} straight={0.12} />
        <Flap geometry={geo.fwFlap2} material={m.paint2} position={[0, 0.19, 2.26]} corner={0.6} straight={0.2} />
        {[1, -1].map((s) => <mesh key={s} geometry={geo.fwEndplate} material={m.paint} position={[0.9 * s, 0, 0]} />)}
        {[1, -1].map((s) => (
          <mesh key={s} material={m.carbon} position={[0.06 * s, 0.15, 2.46]}><boxGeometry args={[0.012, 0.1, 0.12]} /></mesh>
        ))}
      </Part>

      <Part id="nose" explode={[0, 0.58, 1.09]}>
        <mesh geometry={geo.nose} material={m.paint} />
      </Part>

      <Part id="front-suspension" explode={[0.65, 0.51, 0.29]}>
        {geo.frontRodsL.map((g, i) => <mesh key={i} geometry={g} material={m.carbon} />)}
      </Part>
      <Part id="front-suspension" explode={[-0.65, 0.51, 0.29]} label={false}>
        {geo.frontRodsR.map((g, i) => <mesh key={i} geometry={g} material={m.carbon} />)}
      </Part>

      <Part id="cockpit" explode={[0, 0.8, 0.22]}>
        <mesh geometry={geo.chassis} material={m.paint} />
        <mesh material={m.inlet} position={[0, 0.77, -0.06]} scale={[0.22, 0.05, 0.4]}><sphereGeometry args={[1, 32, 16]} /></mesh>
        <mesh material={m.helmet} position={[0, 0.84, -0.2]}><sphereGeometry args={[0.11, 32, 24]} /></mesh>
        <mesh material={m.visor} position={[0, 0.85, -0.13]} scale={[0.85, 0.35, 0.6]}><sphereGeometry args={[0.1, 24, 12]} /></mesh>
        <mesh geometry={geo.halo} material={m.titanium} />
        <mesh geometry={geo.haloPillar} material={m.titanium} />
        {[1, -1].map((s) => (
          <group key={s}>
            <mesh material={m.carbon} position={[0.37 * s, 0.8, 0.28]}><boxGeometry args={[0.13, 0.05, 0.03]} /></mesh>
            <mesh material={m.carbon} geometry={rodCache(s)} />
          </group>
        ))}
      </Part>

      <Part id="sidepods" explode={[0.94, 0.07, 0]}>
        <mesh geometry={geo.sidepodL} material={m.paint} />
        <mesh material={m.inlet} position={[0.48, 0.47, 0.425]} scale={[0.17, 0.12, 0.012]}><sphereGeometry args={[1, 24, 12]} /></mesh>
      </Part>
      <Part id="sidepods" explode={[-0.94, 0.07, 0]} label={false}>
        <mesh geometry={geo.sidepodR} material={m.paint} />
        <mesh material={m.inlet} position={[-0.48, 0.47, 0.425]} scale={[0.17, 0.12, 0.012]}><sphereGeometry args={[1, 24, 12]} /></mesh>
      </Part>

      <Part id="floor" explode={[1.9, 0, 0]}>
        <mesh geometry={geo.floor} material={m.floorCarbon} position={[0, 0.075, 0]} />
        <mesh material={m.plank} position={[0, 0.046, -0.4]}><boxGeometry args={[0.3, 0.008, 2.6]} /></mesh>
        {[0.32, 0.45, 0.58].flatMap((x) => [x, -x]).map((x) => (
          <mesh key={x} material={m.carbon} position={[x, 0.04, 1.0]} rotation={[0, x * 0.25, 0]}><boxGeometry args={[0.01, 0.07, 0.42]} /></mesh>
        ))}
      </Part>

      <Part id="engine-cover" explode={[0, 1.52, -0.22]}>
        <mesh geometry={geo.cover} material={m.paint} />
        <mesh geometry={geo.airbox} material={m.paint} />
        <mesh material={m.inlet} position={[0, 0.93, -0.25]} scale={[0.09, 0.08, 0.02]}><sphereGeometry args={[1, 24, 12]} /></mesh>
        <mesh geometry={geo.fin} material={m.paint2} />
        <mesh material={m.inlet} position={[0, 0.44, -2.33]} scale={[0.05, 0.06, 0.01]}><sphereGeometry args={[1, 16, 8]} /></mesh>
      </Part>

      <Part id="power-unit" explode={[0, 0.51, 0]}>
        <PowerUnit geo={geo} m={m} />
      </Part>

      <Part id="rear-suspension" explode={[0, 0.43, -0.8]}>
        <mesh geometry={geo.gearbox} material={m.carbon} />
        {[...geo.rearRodsL, ...geo.rearRodsR].map((g, i) => <mesh key={i} geometry={g} material={m.carbon} />)}
      </Part>

      <Part id="diffuser" explode={[0, 0.05, -1.25]}>
        <mesh material={m.carbon} position={[0, 0.18, -2.1]} rotation={[0.38, 0, 0]}><boxGeometry args={[1.04, 0.015, 0.66]} /></mesh>
        {[-0.4, -0.18, 0.18, 0.4].map((x) => (
          <mesh key={x} material={m.carbon} position={[x, 0.22, -2.12]} rotation={[0.38, 0, 0]}><boxGeometry args={[0.01, 0.12, 0.6]} /></mesh>
        ))}
        <mesh material={m.rain} position={[0, 0.36, -2.42]} userData={{ keepEmissive: true }}><boxGeometry args={[0.12, 0.05, 0.02]} /></mesh>
      </Part>

      <Part id="beam-wing" explode={[0, 0.36, -1.23]}>
        <mesh geometry={geo.beam1} material={m.carbon} position={[0, 0.4, -2.28]} rotation={[0.3, 0, 0]} />
        <mesh geometry={geo.beam2} material={m.carbon} position={[0, 0.48, -2.42]} rotation={[0.45, 0, 0]} />
      </Part>

      <Part id="rear-wing" explode={[0, 0.87, -1.45]}>
        <mesh geometry={geo.rwMain} material={m.accent} position={[0, 0.88, -2.42]} rotation={[0.18, 0, 0]} />
        <Flap geometry={geo.rwFlap} material={m.paint} position={[0, 0.98, -2.68]} corner={0.65} straight={0.08} />
        {[1, -1].map((s) => <mesh key={s} geometry={geo.rwEndplate} material={m.paint} position={[0.51 * s, 0, 0]} />)}
        <mesh geometry={geo.swanNeck} material={m.carbon} />
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
