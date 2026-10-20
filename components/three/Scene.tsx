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
import { Airflow, Blueprint } from "./Technical"

const PRESETS: Record<CameraPreset, [number, number, number, number, number, number]> = {
  hero: [7.2, 2.9, 7.6, 0, 0.3, -0.2],
  front: [0, 1.3, 9.4, 0, 0.4, 0],
  side: [10, 1.4, 0, 0, 0.4, 0],
  top: [0, 12.5, 0.01, 0, 0, 0],
  rear: [0, 1.8, -9.4, 0, 0.5, 0],
  chase: [5.4, 1.4, 6.6, 0, 0.4, 0.2],
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

const ROAD_LENGTH = 120
const POSTS = 16

function Road() {
  const tex = useMemo(roadTexture, [])
  const posts = useRef<THREE.InstancedMesh>(null!)
  const streaks = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const streakSeeds = useMemo(() => Array.from({ length: 40 }, () => [Math.random() * 2 - 1, Math.random(), Math.random()]), [])

  useFrame(() => {
    // The road texture repeats every ROAD_LENGTH / 6 metres.
    tex.offset.y = (telemetry.distance / (ROAD_LENGTH / 6)) % 1
    const spacing = ROAD_LENGTH / POSTS
    for (let i = 0; i < POSTS * 2; i++) {
      const side = i % 2 ? 1 : -1
      const z = ((((Math.floor(i / 2) * spacing - telemetry.distance) % ROAD_LENGTH) + ROAD_LENGTH) % ROAD_LENGTH) - ROAD_LENGTH / 2
      dummy.position.set(side * 10, 1.4, -z)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      posts.current.setMatrixAt(i, dummy.matrix)
    }
    posts.current.instanceMatrix.needsUpdate = true
    const len = 1 + telemetry.speed / 60
    streakSeeds.forEach(([x, y, o], i) => {
      const z = ((((o * ROAD_LENGTH - telemetry.distance * 1.4) % 40) + 40) % 40) - 20
      dummy.position.set(x * 4.5 + Math.sign(x) * 1.5, 0.05 + y * 1.2, -z)
      dummy.scale.set(1, 1, len)
      dummy.updateMatrix()
      streaks.current.setMatrixAt(i, dummy.matrix)
    })
    streaks.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[14, ROAD_LENGTH]} />
        <meshStandardMaterial map={tex} roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#0d1410" roughness={1} />
      </mesh>
      <instancedMesh ref={posts} args={[undefined, undefined, POSTS * 2]}>
        <boxGeometry args={[0.12, 2.8, 0.12]} />
        <meshStandardMaterial color="#cfd3da" emissive="#ffffff" emissiveIntensity={0.6} />
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
    if (useGarage.getState().mode === "drive") stepTelemetry(state.clock.elapsedTime, Math.min(dt, 0.05))
    else telemetry.speed = 0
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
      <color attach="background" args={[technical ? "#06101c" : mode === "drive" ? "#0a0e16" : "#08090c"]} />
      <fog attach="fog" args={[mode === "drive" ? "#0a0e16" : "#08090c", 16, mode === "drive" ? 70 : 32]} />
      <Director />
      <ambientLight intensity={0.25} />
      <directionalLight position={[5, 9, 4]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} />
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
        <Airflow />
        <Blueprint />
        <ContactShadows position={[0, 0.004, 0]} opacity={0.75} scale={9} blur={2.2} far={1.4} resolution={512} />
      </Suspense>

      <CameraRig reducedMotion={reducedMotion} />

      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.7} luminanceThreshold={0.85} luminanceSmoothing={0.2} />
        <Vignette offset={0.25} darkness={0.75} />
      </EffectComposer>
    </Canvas>
  )
}
