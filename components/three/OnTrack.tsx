"use client"

import { useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { BURNOUT, driveLaps, ENGINE_START, telemetry } from "@/lib/drive"
import { newMotion, type Motion } from "@/lib/motion"
import { drive, race, stepRace, type Driven } from "@/lib/race"
import { useGarage, type TrackCam } from "@/lib/store"
import { teamById } from "@/lib/teams"
import { placeOnTrack, track } from "@/lib/track"
import { Car } from "./Car"
import { MotionContext, PlainParts } from "./CarMotion"
import { smokeSources } from "./Smoke"

function shadowTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const g = c.getContext("2d")!
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64)
  grad.addColorStop(0, "rgba(0,0,0,0.85)")
  grad.addColorStop(1, "rgba(0,0,0,0)")
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}
let shadowTex: THREE.Texture | null = null

// Frame order: simulate, then place the cars, then move the camera.
const SIMULATE = -3, PLACE = -2, CAMERA = -1

// Testing aid: ?timescale=10 runs the simulation faster (for slow headless browsers).
const TIMESCALE = typeof window === "undefined" ? 1 : Math.min(40, Number(new URLSearchParams(window.location.search).get("timescale")) || 1)
const step = (raw: number) => Math.min(raw, 0.05) * TIMESCALE

// One car placed on the track every frame from its simulated state.
export function TrackCar({ teamId, car }: { teamId: string; car: Driven & { lat?: number } }) {
  const group = useRef<THREE.Group>(null!)
  const team = teamById(teamId)
  shadowTex ??= typeof document === "undefined" ? null : shadowTexture()
  useEffect(() => {
    const src = { obj: group.current, motion: car.motion }
    smokeSources.add(src)
    return () => { smokeSources.delete(src) }
  }, [car])
  // Runs after the simulation step and before the camera, so car and camera
  // always agree on where the car is this frame (no jitter).
  useFrame(() => placeOnTrack(group.current, car.s, car.lat ?? 0, 0), PLACE)
  return (
    <group ref={group}>
      <PlainParts.Provider value={true}>
        <MotionContext.Provider value={car.motion}>
          <Car team={team} />
        </MotionContext.Provider>
      </PlainParts.Provider>
      {/* Soft contact shadow that travels with the car */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -0.1]} scale={[2.4, 6, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} opacity={0.9} />
      </mesh>
    </group>
  )
}

const copyToTelemetry = (m: Motion) => {
  telemetry.speed = m.speed
  telemetry.aero = m.aero
  telemetry.ers = m.ers
  telemetry.braking = m.braking
  telemetry.steer = m.steer
  telemetry.wheelspin = m.wheelspin
  telemetry.throttle = m.throttle
}

// Free drive: a burnout on the grid, a launch, then flying laps.
export function DriveSession({ onTarget }: { onTarget: (t: { s: number; lat: number }) => void }) {
  const teamId = useGarage((s) => s.teamId)
  const car = useMemo(() => ({ s: -8, v: 0, lat: 0, motion: newMotion(), t: 0 }), [])
  useEffect(() => { Object.assign(driveLaps, { lap: 0, last: null, best: null, start: null, s: -8 }) }, [car])
  useEffect(() => onTarget(car), [car, onTarget])
  useFrame((_, raw) => {
    const dt = step(raw)
    car.t += dt
    if (car.t < ENGINE_START) {
      // Standing still while the engine is fired up.
      car.motion.wheelspin = 0
      car.motion.speed = 0
      car.motion.throttle = 0
    } else if (car.t < ENGINE_START + BURNOUT) {
      car.motion.wheelspin = Math.min(1, (car.t - ENGINE_START) / 0.3)
      car.motion.speed = 0
      car.motion.throttle = 1
      car.motion.aero = "straight"
    } else {
      const before = car.s
      drive(car, dt)
      const launch = car.t - ENGINE_START - BURNOUT
      car.motion.wheelspin = launch < 1.3 ? 1 - launch / 1.3 : 0
      // Lap timing for the engineer's radio calls.
      if (driveLaps.start === null) driveLaps.start = car.t
      if (Math.floor(car.s / track.length) > Math.floor(before / track.length) && car.s > 0) {
        const time = car.t - driveLaps.start
        driveLaps.start = car.t
        driveLaps.lap++
        driveLaps.last = time
        driveLaps.best = driveLaps.best === null ? time : Math.min(driveLaps.best, time)
      }
    }
    driveLaps.s = car.s
    copyToTelemetry(car.motion)
  }, SIMULATE)
  return <TrackCar teamId={teamId} car={car} />
}

// Race: steps the simulation and draws every car.
export function RaceSession({ onTarget }: { onTarget: (t: { s: number; lat: number }) => void }) {
  const cars = race.cars
  useFrame((_, raw) => {
    const dt = step(raw)
    stepRace(dt)
    const followed = race.cars.find((c) => c.teamId === race.follow) ?? race.cars[0]
    if (followed) { onTarget(followed); copyToTelemetry(followed.motion) }
  }, SIMULATE)
  return (
    <>
      {cars.map((c) => <TrackCar key={c.teamId} teamId={c.teamId} car={c} />)}
      {race.player && race.assist !== "full" && <RacingLine />}
    </>
  )
}

// The F1-game braking line: painted on the road ahead of your car, green
// where you can accelerate, yellow to lift, red where you need to brake now.
const LINE_SEGMENTS = 46
const LINE_STEP = 3.2
const GREEN = new THREE.Color("#2bd96b"), YELLOW = new THREE.Color("#ffd23f"), RED = new THREE.Color("#ff2a2a")
function RacingLine() {
  const mesh = useRef<THREE.InstancedMesh>(null!)
  const tmp = useMemo(() => ({ o: new THREE.Object3D(), c: new THREE.Color() }), [])
  useFrame(() => {
    const me = race.cars.find((c) => c.player)
    if (!me || !mesh.current) return
    const { o, c } = tmp
    for (let i = 0; i < LINE_SEGMENTS; i++) {
      const d = 6 + i * LINE_STEP
      const s = me.s + d
      // Fade the line from the car's line toward the ideal line further ahead.
      const k = track.curvature(s)
      const ideal = Math.max(-4, Math.min(4, -Math.sign(k) * Math.min(4, Math.abs(k) * 700)))
      const lat = me.lat + (ideal - me.lat) * Math.min(1, d / 60)
      placeOnTrack(o, s, lat, 0.035)
      o.rotation.x = -Math.PI / 2
      o.rotation.order = "YXZ"
      o.scale.set(0.55, LINE_STEP * 0.8, 1)
      o.updateMatrix()
      mesh.current.setMatrixAt(i, o.matrix)
      const target = track.targetSpeed(s)
      const mustBrake = me.v * me.v > target * target + 2 * track.brake * d * 0.8
      c.copy(mustBrake ? RED : me.v > target * 0.97 ? YELLOW : GREEN)
      mesh.current.setColorAt(i, c)
    }
    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
  }, PLACE)
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, LINE_SEGMENTS]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial transparent opacity={0.55} toneMapped={false} depthWrite={false} />
    </instancedMesh>
  )
}

// ── Cameras ─────────────────────────────────────────────────────────────────
const FOV: Record<TrackCam, number> = { chase: 50, tv: 28, heli: 38, onboard: 62 }
const TV_SPACING = 130

export function TrackCamera({ target, overview }: { target: () => { s: number; lat: number } | null; overview?: () => boolean }) {
  const look = useRef(new THREE.Vector3())
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), t: new THREE.Vector3(), l: new THREE.Vector3(), d: new THREE.Vector3(), a: new THREE.Vector3() }), [])
  const first = useRef(true)
  // The camera turns with a smoothed heading, so it glides through corners
  // instead of picking up every small change in the car's direction.
  const heading = useRef(new THREE.Vector3(0, 0, 1))

  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05)
    const cam = state.camera as THREE.PerspectiveCamera
    const tg = target()
    if (!tg) return
    let mode: TrackCam | "grid" = useGarage.getState().trackCam
    if (overview?.()) mode = "grid"
    const { p, t, l, d, a } = tmp
    track.point(tg.s, p)
    track.tangent(tg.s, t)
    track.left(tg.s, l)
    p.addScaledVector(l, tg.lat)
    heading.current.lerp(t, first.current ? 1 : 1 - Math.exp(-dt * 7)).normalize()
    const h = heading.current

    let snap = false
    if (mode === "grid") {
      // High behind the grid, looking down the straight at the lights.
      track.point(-95, d).addScaledVector(track.left(-95, a), 9)
      d.y = 15
      a.copy(track.point(10, a))
      a.y = 2
    } else if (mode === "chase") {
      // Rigid T-cam behind the car, as in the F1 games.
      d.copy(p).addScaledVector(h, -7.2).setY(2.5)
      a.copy(p).addScaledVector(h, 12).setY(0.8)
      snap = true
    } else if (mode === "heli") {
      d.copy(p).addScaledVector(h, -26).addScaledVector(l, 20).setY(32)
      a.copy(p)
    } else if (mode === "onboard") {
      d.copy(p).addScaledVector(h, -0.4).setY(1.22)
      a.copy(p).addScaledVector(h, 40).setY(0.7)
      snap = true
    } else {
      // Fixed trackside TV camera: the next one down the road pans with the car.
      const next = (Math.floor(tg.s / TV_SPACING) + 1) * TV_SPACING
      track.point(next, d)
      track.left(next, a)
      const side = Math.floor(next / TV_SPACING) % 2 ? 1 : -1
      d.addScaledVector(a, side * 22).setY(5)
      a.copy(p).setY(0.6)
      snap = true
    }
    const fov = mode === "grid" ? 40 : FOV[mode]
    if (Math.abs(cam.fov - fov) > 0.1) { cam.fov = THREE.MathUtils.damp(cam.fov, fov, 6, dt); cam.updateProjectionMatrix() }
    const k = snap || first.current ? 1 : 1 - Math.exp(-dt * 3)
    cam.position.lerp(d, k)
    look.current.lerp(a, snap || first.current ? 1 : 1 - Math.exp(-dt * 10))
    cam.lookAt(look.current)
    first.current = false
  }, CAMERA)
  return null
}
