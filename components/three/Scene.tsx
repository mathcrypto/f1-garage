"use client"

import { CameraControls, ContactShadows, Environment, Lightformer, MeshReflectorMaterial } from "@react-three/drei"
import { Canvas, useFrame } from "@react-three/fiber"
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing"
import { Suspense, useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { stepTelemetry, telemetry } from "@/lib/drive"
import { partCentres, useGarage, type CameraPreset } from "@/lib/store"
import { teamById } from "@/lib/teams"
import { Car } from "./Car"
import { Smoke } from "./Smoke"
import { Airflow, Blueprint } from "./Technical"

const PRESETS: Record<CameraPreset, [number, number, number, number, number, number]> = {
  hero: [7.2, 2.9, 7.6, 0, 0.3, -0.2],
  front: [0, 1.3, 9.4, 0, 0.4, 0],
  side: [10, 1.4, 0, 0, 0.4, 0],
  top: [0, 12.5, 0.01, 0, 0, 0],
  rear: [0, 1.8, -9.4, 0, 0.5, 0],
  chase: [5.4, 1.4, 6.6, 0, 0.4, 0.2],
  low: [2.6, 0.32, 5.4, 0, 0.35, 0.6],
}

function CameraRig({ reducedMotion }: { reducedMotion: boolean }) {
  const controls = useRef<CameraControls>(null!)
  const camera = useGarage((s) => s.camera)
  const selected = useGarage((s) => s.selected)
  const exploded = useGarage((s) => s.exploded)
  // Wall-clock seconds of the last orbit/zoom; auto-rotate waits 5 s after it.
  const lastInput = useRef(0)

  useEffect(() => {
    const [x, y, z, tx, ty, tz] = PRESETS[camera.preset]
    controls.current?.setLookAt(x, y, z, tx, ty, tz, true)
  }, [camera])

  // Fly to the selected part, framed from the side it slides out towards.
  useEffect(() => {
    if (!selected) return
    const c = partCentres.get(selected)
    if (!c) return
    const centre = new THREE.Vector3(...c)
    const dir = new THREE.Vector3(centre.x === 0 ? 1.2 : Math.sign(centre.x) * 1.6, 0.9, centre.z >= 0 ? 1.2 : -1.2).normalize()
    const dist = selected === "front-wing" || selected === "rear-wing" || selected === "floor" ? 7 : 6
    const target = centre.clone().add(new THREE.Vector3(0, selected === "engine-cover" ? 0.5 : 0.15, 0))
    const eye = target.clone().add(dir.multiplyScalar(dist))
    controls.current?.setLookAt(eye.x, eye.y, eye.z, target.x, target.y, target.z, true)
  }, [selected])

  useEffect(() => {
    if (exploded) controls.current?.setLookAt(9.2, 8.4, 10.2, 0, 0.3, -0.1, true)
  }, [exploded])

  useFrame((_, dt) => {
    const s = useGarage.getState()
    const idle = performance.now() / 1000 - lastInput.current > 5
    if (!reducedMotion && idle && !s.selected && controls.current) {
      controls.current.azimuthAngle += dt * (s.mode === "drive" ? 0.04 : 0.1)
    }
  })

  return (
    <CameraControls
      ref={controls}
      makeDefault
      minDistance={2.2}
      maxDistance={18}
      maxPolarAngle={Math.PI / 2 - 0.04}
      smoothTime={0.6}
      onStart={() => { lastInput.current = Infinity }}
      onEnd={() => { lastInput.current = performance.now() / 1000 }}
    />
  )
}

function roadTexture() {
  const c = document.createElement("canvas")
  c.width = 512
  c.height = 1024
  const g = c.getContext("2d")!
  g.fillStyle = "#1a1b1e"
  g.fillRect(0, 0, 512, 1024)
  for (let i = 0; i < 9000; i++) {
    const v = 20 + Math.random() * 30
    g.fillStyle = `rgb(${v},${v},${v + 2})`
    g.fillRect(Math.random() * 512, Math.random() * 1024, 2, 2)
  }
  g.fillStyle = "#e9e9e9"
  g.fillRect(36, 0, 8, 1024)
  g.fillRect(468, 0, 8, 1024)
  // Red and white kerbs
  for (let y = 0; y < 1024; y += 64) {
    g.fillStyle = (y / 64) % 2 ? "#d81e1e" : "#f2f2f2"
    g.fillRect(0, y, 34, 64)
    g.fillRect(478, y, 34, 64)
  }
  // Rubbered-in racing line
  const grad = g.createLinearGradient(160, 0, 352, 0)
  grad.addColorStop(0, "rgba(0,0,0,0)")
  grad.addColorStop(0.5, "rgba(0,0,0,0.35)")
  grad.addColorStop(1, "rgba(0,0,0,0)")
  g.fillStyle = grad
  g.fillRect(160, 0, 192, 1024)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1, 6)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

const ROAD_LENGTH = 140
const TOWERS = 6
const FENCE_POSTS = 36

// Wraps a track-relative position into the visible stretch, so objects stream
// past the car toward the rear (-z) as distance grows.
const wrap = (z: number, span: number) => ((((z % span) + span) % span) - span / 2)

function lampTexture() {
  const c = document.createElement("canvas")
  c.width = 256
  c.height = 160
  const g = c.getContext("2d")!
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
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// Night circuit: asphalt with kerbs, floodlight towers and catch fencing
// streaming past, plus speed streaks close to the car.
function Road() {
  const tex = useMemo(roadTexture, [])
  const lamp = useMemo(lampTexture, [])
  const poles = useRef<THREE.InstancedMesh>(null!)
  const lamps = useRef<THREE.InstancedMesh>(null!)
  const fence = useRef<THREE.InstancedMesh>(null!)
  const streaks = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const streakSeeds = useMemo(() => Array.from({ length: 40 }, () => [Math.random() * 2 - 1, Math.random(), Math.random()]), [])

  useFrame(() => {
    const d = telemetry.distance
    // The texture repeats every ROAD_LENGTH / 6 metres along the plane.
    tex.offset.y = -((d / (ROAD_LENGTH / 6)) % 1)
    const towerGap = ROAD_LENGTH / TOWERS
    for (let i = 0; i < TOWERS * 2; i++) {
      const side = i % 2 ? 1 : -1
      const z = wrap(Math.floor(i / 2) * towerGap + (side > 0 ? towerGap / 2 : 0) - d, ROAD_LENGTH)
      dummy.position.set(side * 11.5, 3.5, z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      poles.current.setMatrixAt(i, dummy.matrix)
      dummy.position.set(side * 11.2, 7.4, z)
      dummy.rotation.set(0, -side * Math.PI / 2, 0)
      dummy.rotateX(-0.35)
      dummy.updateMatrix()
      lamps.current.setMatrixAt(i, dummy.matrix)
    }
    poles.current.instanceMatrix.needsUpdate = true
    lamps.current.instanceMatrix.needsUpdate = true
    const postGap = ROAD_LENGTH / (FENCE_POSTS / 2)
    for (let i = 0; i < FENCE_POSTS; i++) {
      const side = i % 2 ? 1 : -1
      dummy.position.set(side * 8.4, 1.6, wrap(Math.floor(i / 2) * postGap - d, ROAD_LENGTH))
      dummy.rotation.set(0, 0, side * 0.12)
      dummy.updateMatrix()
      fence.current.setMatrixAt(i, dummy.matrix)
    }
    fence.current.instanceMatrix.needsUpdate = true
    const len = 1 + telemetry.speed / 60
    streakSeeds.forEach(([x, y, o], i) => {
      dummy.position.set(x * 4.5 + Math.sign(x) * 1.5, 0.05 + y * 1.2, wrap(o * 40 - d * 1.4, 40))
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, len)
      dummy.updateMatrix()
      streaks.current.setMatrixAt(i, dummy.matrix)
    })
    streaks.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, ROAD_LENGTH]} />
        <meshStandardMaterial map={tex} roughness={0.78} metalness={0.08} envMapIntensity={0.2} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#030405" roughness={1} envMapIntensity={0} />
      </mesh>
      <instancedMesh ref={fence} args={[undefined, undefined, FENCE_POSTS]}>
        <boxGeometry args={[0.06, 3.2, 0.06]} />
        <meshStandardMaterial color="#5b626c" metalness={0.8} roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={poles} args={[undefined, undefined, TOWERS * 2]}>
        <boxGeometry args={[0.28, 7, 0.28]} />
        <meshStandardMaterial color="#2a2e35" metalness={0.7} roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={lamps} args={[undefined, undefined, TOWERS * 2]}>
        <boxGeometry args={[3.2, 2, 0.2]} />
        <meshStandardMaterial color="#15171b" emissive="#ffffff" emissiveMap={lamp} emissiveIntensity={1.9} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={streaks} args={[undefined, undefined, 40]}>
        <boxGeometry args={[0.01, 0.01, 1]} />
        <meshBasicMaterial color="#9fb7ff" transparent opacity={0.35} />
      </instancedMesh>
    </group>
  )
}

function Studio() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[14, 64]} />
        <MeshReflectorMaterial
          blur={[400, 120]}
          resolution={1024}
          mixBlur={1}
          mixStrength={18}
          roughness={0.85}
          depthScale={1.1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.3}
          color="#101115"
          metalness={0.6}
          mirror={0.6}
        />
      </mesh>
    </>
  )
}

function Ring({ color }: { color: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
      <ringGeometry args={[3.5, 3.54, 160]} />
      <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.85} />
    </mesh>
  )
}

function Director() {
  useFrame((state, dt) => {
    if (useGarage.getState().mode === "drive") stepTelemetry(Math.min(dt, 0.05))
    else { telemetry.speed = 0; telemetry.driveTime = 0; telemetry.braking = 0; telemetry.ers = 0 }
  })
  return null
}

export default function Scene() {
  const teamId = useGarage((s) => s.teamId)
  const mode = useGarage((s) => s.mode)
  const technical = useGarage((s) => s.technical)
  const team = teamById(teamId)
  const reducedMotion = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, [])

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [7.2, 2.9, 7.6], fov: 32, near: 0.1, far: 300 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onPointerMissed={() => useGarage.getState().select(null)}
    >
      <color attach="background" args={[technical ? "#0b0303" : mode === "drive" ? "#040507" : "#08090c"]} />
      <fog attach="fog" args={[technical ? "#0b0303" : mode === "drive" ? "#020203" : "#08090c", mode === "drive" ? 22 : 16, mode === "drive" ? 75 : 32]} />
      <Director />
      <ambientLight intensity={mode === "drive" ? 0.1 : 0.25} />
      <directionalLight position={[5, 9, 4]} intensity={mode === "drive" ? 1.5 : 2.2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} />
      <spotLight position={[-6, 5, -6]} intensity={40} angle={0.5} penumbra={1} color={team.livery.primary} />

      {/* Studio softboxes, used only for reflections on the paint */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={3} position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={2} position={[-6, 2, 0]} rotation={[0, Math.PI / 2, 0]} scale={[12, 2, 1]} />
        <Lightformer form="rect" intensity={2} position={[6, 2, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[12, 2, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[0, 2, 7]} scale={[10, 2, 1]} />
        <Lightformer form="ring" intensity={1.5} color={team.livery.primary} position={[0, 3, -8]} scale={4} />
      </Environment>

      <Suspense fallback={null}>
        <Car team={team} />
        {mode === "drive" ? <Road /> : <><Studio /><Ring color={team.livery.primary} /></>}
        <Smoke />
        <Airflow />
        <Blueprint />
        <ContactShadows position={[0, 0.004, 0]} opacity={0.75} scale={9} blur={2.2} far={1.4} resolution={512} />
      </Suspense>

      <CameraRig reducedMotion={reducedMotion} />

      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.7} radius={0.55} luminanceThreshold={0.9} luminanceSmoothing={0.15} />
        <Vignette offset={0.25} darkness={0.75} />
      </EffectComposer>
    </Canvas>
  )
}
