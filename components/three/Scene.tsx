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
    if (exploded) controls.current?.setLookAt(10.2, 8.8, 11.4, 0, 0.4, -0.1, true)
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

/** Studio colours the floor and fog fade into, so the stage has no visible edge. */
const STUDIO_BG = "#07080a"
const XRAY_BG = "#0b0303"

/**
 * The reflective floor ignores fog, so its edge would show as a hard line.
 * This disc sits just above it: clear around the car, fading to the studio
 * colour further out, so the floor melts into the backdrop.
 */
function FloorFade({ color }: { color: string }) {
  const texture = useMemo(() => {
    const size = 512
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = size
    const ctx = canvas.getContext("2d")!
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    const [r, gr, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
    g.addColorStop(0, `rgba(${r},${gr},${b},0)`)
    g.addColorStop(0.16, `rgba(${r},${gr},${b},0)`)
    g.addColorStop(0.42, `rgba(${r},${gr},${b},1)`)
    g.addColorStop(1, `rgba(${r},${gr},${b},1)`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [color])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} renderOrder={1}>
      <circleGeometry args={[30, 96]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} fog={false} />
    </mesh>
  )
}

/** Radial white-to-clear texture for the light pool and beam. */
function useGlowTexture(vertical: boolean) {
  const texture = useMemo(() => {
    const size = 256
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = size
    const ctx = canvas.getContext("2d")!
    const g = vertical
      ? ctx.createLinearGradient(0, 0, 0, size)
      : ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    if (vertical) {
      g.addColorStop(0, "rgba(255,255,255,1)")
      g.addColorStop(0.6, "rgba(255,255,255,0.25)")
      g.addColorStop(1, "rgba(255,255,255,0)")
    } else {
      g.addColorStop(0, "rgba(255,255,255,1)")
      g.addColorStop(0.55, "rgba(255,255,255,0.55)")
      g.addColorStop(1, "rgba(255,255,255,0)")
    }
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [vertical])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

/**
 * The film-set look: one light straight above the car. A soft pool of light
 * on the floor and a faint beam through the air; the rest falls off to black.
 */
function OverheadLight({ wide }: { wide: boolean }) {
  const pool = useGlowTexture(false)
  const beam = useGlowTexture(true)
  const radius = wide ? 6.5 : 4.6
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} renderOrder={2}>
        <circleGeometry args={[radius, 96]} />
        <meshBasicMaterial map={pool} color="#fff6ea" transparent opacity={0.08} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
      <mesh position={[0, 5.5, 0]} renderOrder={3}>
        <cylinderGeometry args={[0.9, radius * 0.95, 11, 64, 1, true]} />
        <meshBasicMaterial map={beam} color="#fff3e0" transparent opacity={0.018} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
    </>
  )
}

function Studio({ background, wide, beam }: { background: string; wide: boolean; beam: boolean }) {
  return (
    <>
      {beam && <OverheadLight wide={wide} />}
      <FloorFade color={background} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[14, 96]} />
        <MeshReflectorMaterial
          blur={[300, 90]}
          resolution={1024}
          mixBlur={0.8}
          mixStrength={3.5}
          roughness={0.85}
          depthScale={1.1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.3}
          color="#0a0b0e"
          metalness={0.5}
          mirror={0.5}
          envMapIntensity={0.05}
        />
      </mesh>
    </>
  )
}

/**
 * What the car reflects in the garage: a dim studio HDR and one big softbox
 * overhead, so highlights run along the top of the bodywork and the sides fall
 * off into shadow.
 */
function StudioReflections({ bright }: { bright: boolean }) {
  return (
    <Environment files="/models/studio.hdr" resolution={512} background={false} environmentIntensity={bright ? 0.6 : 0.4}>
      <Lightformer form="rect" intensity={4} color="#fff8ee" position={[0, 7, 0]} rotation-x={Math.PI / 2} scale={[9, 4, 1]} />
      <Lightformer form="rect" intensity={0.5} color="#ffffff" position={[0, 5, -6]} rotation-x={Math.PI / 3} scale={[10, 1.2, 1]} />
      <Lightformer form="rect" intensity={0.35} color="#e8eeff" position={[-7, 2, 0]} rotation-y={Math.PI / 2} scale={[14, 1.5, 1]} />
      <Lightformer form="rect" intensity={0.35} color="#fff2e4" position={[7, 2, 0]} rotation-y={-Math.PI / 2} scale={[14, 1.5, 1]} />
    </Environment>
  )
}

function Ring({ color }: { color: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
      <ringGeometry args={[3.5, 3.53, 160]} />
      <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.5} />
    </mesh>
  )
}

export default function Scene() {
  const teamId = useGarage((s) => s.teamId)
  const mode = useGarage((s) => s.mode)
  const technical = useGarage((s) => s.technical)
  // Taken apart: brighter studio so every piece reads against the background.
  const exploded = useGarage((s) => s.exploded)
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
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onPointerMissed={() => useGarage.getState().select(null)}
    >
      <color attach="background" args={[technical ? XRAY_BG : onTrack ? "#87b5d9" : STUDIO_BG]} />
      <fog attach="fog" args={[technical ? XRAY_BG : onTrack ? "#a8c8e0" : STUDIO_BG, onTrack ? 140 : 11, onTrack ? 1100 : 30]} />
      <ambientLight intensity={onTrack ? 0.55 : exploded ? 0.22 : 0.08} />
      {/* Track: daylight sun + sky. */}
      {onTrack && <directionalLight position={[60, 90, 40]} intensity={1.85} color="#fff4e0" />}
      {/* Studio: one spotlight straight above the car, a faint fill and a cool rim. */}
      {!onTrack && (
        <spotLight
          position={[0, 10, 0.3]}
          angle={exploded ? 0.6 : 0.46}
          penumbra={0.95}
          decay={0}
          intensity={technical ? 1.2 : 3}
          color="#fff6ea"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0002}
        />
      )}
      {!onTrack && <directionalLight position={[3, 3, 8]} intensity={exploded ? 0.45 : 0.2} color="#dfe6f2" />}
      {!onTrack && <directionalLight position={[-2, 2.5, -8]} intensity={0.35} color="#cfdcf0" />}
      {onTrack && <hemisphereLight args={["#cfe6ff", "#6b8f4e", 0.55]} />}
      {onTrack && <directionalLight position={[-40, 30, -50]} intensity={0.35} color="#a8c4e0" />}
      <spotLight position={[-6, 4, -6]} intensity={onTrack ? 0 : 6} angle={0.5} penumbra={1} color={team.livery.primary} />

      <Suspense fallback={null}>
        {onTrack ? (
          <Environment files="/models/studio.hdr" resolution={512} background={false} blur={0.85} environmentIntensity={0.45} />
        ) : (
          <StudioReflections bright={exploded} />
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
            <Studio background={technical ? XRAY_BG : STUDIO_BG} wide={exploded} beam={!technical} />
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
        <Vignette offset={0.25} darkness={onTrack ? 0.28 : 0.6} />
      </EffectComposer>
    </Canvas>
  )
}
