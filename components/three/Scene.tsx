/**
 * @file Scene.tsx
 * @description The main scene component that renders the 3D garage and track circuit.
 */
"use client"

import { CameraControls, ContactShadows, Environment, Lightformer, MeshReflectorMaterial } from "@react-three/drei"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Bloom, EffectComposer, SSAO, Vignette } from "@react-three/postprocessing"
import { BlendFunction } from "postprocessing"
import { Suspense, useCallback, useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { race, useRace } from "@/lib/race"
import { partCentres, useGarage, type CameraPreset } from "@/lib/store"
import { teamById } from "@/lib/teams"
import { TeamCar } from "./car/TeamCar"
import { Circuit } from "./track/Circuit"
import { DriveSession, RaceSession, TrackCamera } from "./track/OnTrack"
import { Smoke } from "./fx/Smoke"
import { Airflow, Blueprint } from "./fx/Technical"

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
          blur={[300, 90]}
          resolution={1024}
          mixBlur={0.8}
          mixStrength={14}
          roughness={0.78}
          depthScale={1.1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.3}
          color="#030304"
          metalness={0.5}
          mirror={0.45}
          envMapIntensity={0.05}
        />
      </mesh>
    </>
  )
}

/**
 * What the car reflects in the garage: the studio HDR plus large softboxes, the
 * way car product shots are lit. The long overhead strip and side panels draw
 * the smooth highlights along the bodywork; the rim light outlines the car.
 */
function StudioReflections() {
  return (
    <Environment files="/models/studio.hdr" resolution={512} background={false} environmentIntensity={0.55}>
      <Lightformer form="rect" intensity={1.5} color="#ffffff" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[12, 3, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#ffffff" position={[0, 5, -6]} rotation-x={Math.PI / 3} scale={[10, 1.2, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#f2f5ff" position={[-7, 2, 0]} rotation-y={Math.PI / 2} scale={[14, 2, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#fff6ec" position={[7, 2, 0]} rotation-y={-Math.PI / 2} scale={[14, 2, 1]} />
      <Lightformer form="ring" intensity={0.8} color="#ffffff" position={[0, 3, 9]} scale={4} />
    </Environment>
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
      camera={{ position: [7.2, 2.9, 7.6], fov: 32, near: 0.1, far: 2800 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
      onPointerMissed={() => useGarage.getState().select(null)}
    >
      <color attach="background" args={[technical ? "#0b0303" : onTrack ? "#87b5d9" : "#08090c"]} />
      <fog attach="fog" args={[technical ? "#0b0303" : onTrack ? "#a8c8e0" : "#08090c", onTrack ? 140 : 16, onTrack ? 1100 : 32]} />
      <ambientLight intensity={onTrack ? 0.55 : 0.12} />
      {/* Studio: soft key/fill. Track: daylight sun + sky. */}
      <directionalLight
        position={onTrack ? [60, 90, 40] : [4, 10, 3]}
        intensity={onTrack ? 1.85 : 1}
        color={onTrack ? "#fff4e0" : "#ffffff"}
        castShadow={!onTrack}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
      />
      {!onTrack && <directionalLight position={[-6, 5, -2]} intensity={0.5} color="#d0d8e8" />}
      {!onTrack && <directionalLight position={[1, 3, -7]} intensity={0.35} color="#ffe8d0" />}
      {onTrack && <hemisphereLight args={["#cfe6ff", "#6b8f4e", 0.55]} />}
      {onTrack && <directionalLight position={[-40, 30, -50]} intensity={0.35} color="#a8c4e0" />}
      <spotLight position={[-6, 5, -6]} intensity={onTrack ? 0 : 8} angle={0.55} penumbra={1} color={team.livery.primary} />
      {!onTrack && <spotLight position={[4, 8, 5]} intensity={5} angle={0.65} penumbra={1} color="#f4f6fa" />}

      <Suspense fallback={null}>
        {onTrack ? (
          <Environment files="/models/studio.hdr" resolution={512} background={false} blur={0.85} environmentIntensity={0.45} />
        ) : (
          <StudioReflections />
        )}
        {/* key forces a clean remount if HMR left stale scenery in the scene graph. */}
        <group visible={onTrack}><Circuit key="circuit-monza-no-trees" /></group>
        {onTrack ? (
          <>
            {mode === "drive" ? <DriveSession onTarget={setFollowed} /> : <RaceSession key={raceId} onTarget={setFollowed} />}
            <TrackCamera target={getFollowed} overview={mode === "race" ? gridView : undefined} />
          </>
        ) : (
          <>
            <TeamCar team={team} />
            <Studio />
            <Ring color={team.livery.primary} />
            <Airflow />
            <Blueprint />
            <ContactShadows position={[0, 0.004, 0]} opacity={0.8} scale={10} blur={2.4} far={1.6} resolution={1024} frames={1} />
          </>
        )}
        <Smoke />
      </Suspense>

      {!onTrack && <CameraRig reducedMotion={reducedMotion} />}

      <EffectComposer multisampling={4} enableNormalPass={!onTrack}>
        {!onTrack && (
          <SSAO
            blendFunction={BlendFunction.MULTIPLY}
            samples={24}
            radius={0.14}
            intensity={22}
            luminanceInfluence={0.35}
            worldDistanceThreshold={12}
            worldDistanceFalloff={4}
            worldProximityThreshold={0.4}
            worldProximityFalloff={0.15}
          />
        )}
        <Bloom mipmapBlur intensity={onTrack ? 0.06 : 0.12} radius={0.3} luminanceThreshold={1.25} luminanceSmoothing={0.35} />
        <Vignette offset={0.28} darkness={onTrack ? 0.28 : 0.5} />
      </EffectComposer>
    </Canvas>
  )
}
