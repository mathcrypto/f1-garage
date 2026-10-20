"use client"

import { CameraControls, ContactShadows, Environment, Lightformer, MeshReflectorMaterial } from "@react-three/drei"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing"
import { Suspense, useCallback, useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { race, useRace } from "@/lib/race"
import { partCentres, useGarage, type CameraPreset } from "@/lib/store"
import { teamById } from "@/lib/teams"
import { Car } from "./Car"
import { Circuit } from "./Circuit"
import { DriveSession, RaceSession, TrackCamera } from "./OnTrack"
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
  const cam = useThree((s) => s.camera) as THREE.PerspectiveCamera

  // Back from the track: restore the studio lens.
  useEffect(() => {
    cam.fov = 32
    cam.updateProjectionMatrix()
  }, [cam])

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
      controls.current.azimuthAngle += dt * 0.1
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

export default function Scene() {
  const teamId = useGarage((s) => s.teamId)
  const mode = useGarage((s) => s.mode)
  const technical = useGarage((s) => s.technical)
  const team = teamById(teamId)
  const reducedMotion = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, [])
  const onTrack = mode !== "studio"
  const raceId = useRace((s) => s.id)
  // The car the track camera follows, set by the drive or race session.
  const followed = useRef<{ s: number; lat: number } | null>(null)
  const setFollowed = useCallback((t: { s: number; lat: number }) => { followed.current = t }, [])
  const getFollowed = useCallback(() => followed.current, [])
  // Watching a race: a high shot of the grid during the lights. Driving: stay in the car.
  const gridView = useCallback(() => !race.player && (race.phase === "grid" || race.phase === "lights"), [])

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [7.2, 2.9, 7.6], fov: 32, near: 0.1, far: 900 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onPointerMissed={() => useGarage.getState().select(null)}
    >
      <color attach="background" args={[technical ? "#0b0303" : onTrack ? "#020305" : "#08090c"]} />
      <fog attach="fog" args={[technical ? "#0b0303" : onTrack ? "#020305" : "#08090c", onTrack ? 60 : 16, onTrack ? 420 : 32]} />
      <ambientLight intensity={onTrack ? 0.35 : 0.25} />
      {/* Studio key light with shadows; on track the floodlights' wash, shadows drawn per car */}
      <directionalLight position={[5, 9, 4]} intensity={onTrack ? 1.4 : 2.2} castShadow={!onTrack} shadow-mapSize={[2048, 2048]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} />
      {onTrack && <hemisphereLight args={["#c9d6ff", "#0b0c10", 0.35]} />}
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
        {onTrack ? (
          <>
            <Circuit />
            {mode === "drive" ? <DriveSession onTarget={setFollowed} /> : <RaceSession key={raceId} onTarget={setFollowed} />}
            <TrackCamera target={getFollowed} overview={mode === "race" ? gridView : undefined} />
          </>
        ) : (
          <>
            <Car team={team} />
            <Studio />
            <Ring color={team.livery.primary} />
            <Airflow />
            <Blueprint />
            <ContactShadows position={[0, 0.004, 0]} opacity={0.75} scale={9} blur={2.2} far={1.4} resolution={512} />
          </>
        )}
        <Smoke />
      </Suspense>

      {!onTrack && <CameraRig reducedMotion={reducedMotion} />}

      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.7} radius={0.55} luminanceThreshold={0.9} luminanceSmoothing={0.15} />
        <Vignette offset={0.25} darkness={0.75} />
      </EffectComposer>
    </Canvas>
  )
}
