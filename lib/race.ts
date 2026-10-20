import { create } from "zustand"
import { newMotion, type Motion } from "./motion"
import { teamById } from "./teams"
import { track } from "./track"

const L = track.length
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

// ── Shared driving model ────────────────────────────────────────────────────
// Follows the track's speed profile with traction and braking limits, and
// fills in the motion the car model animates from (wheels, flaps, brakes).
export type Driven = { s: number; v: number; motion: Motion }

export function drive(c: Driven, dt: number, pace = 1, cap = Infinity) {
  const prev = c.v
  const target = Math.min(track.targetSpeed(c.s + c.v * 0.3) * pace, cap)
  if (c.v < target) c.v = Math.min(target, c.v + track.accel(c.v) * pace * dt)
  else c.v = Math.max(target, c.v - track.brake * dt)
  c.s += c.v * dt
  const m = c.motion
  const accelerating = c.v > prev + 0.01
  m.speed = c.v * 3.6
  m.braking = clamp((prev - c.v) / dt / track.brake, 0, 1)
  m.steer = clamp(-track.curvature(c.s) * 2.6, -0.3, 0.3)
  m.aero = target >= track.vmax * 0.95 * pace && !m.braking ? "straight" : "corner"
  m.ers = accelerating ? 0.55 + 0.45 * (c.v / track.vmax) : 0
}

// ── Race state ──────────────────────────────────────────────────────────────
export type RaceCar = Driven & {
  teamId: string
  grid: number
  lat: number
  latTarget: number
  pace: number
  seed: number
  reaction: number
  finished: boolean
  finishTime: number | null
  lastCp: number
  lastCpTime: number
  moment: number // seconds left of a driver mistake (lock-up, wide moment)
}
export type Phase = "idle" | "grid" | "lights" | "racing" | "finished"
export type Row = { teamId: string; code: string; pos: number; gap: string; finished: boolean }
type Events = {
  light?: (n: number) => void
  lightsOut?: () => void
  position?: (teamId: string, from: number, to: number) => void
  finalLap?: () => void
  finish?: (teamId: string, pos: number) => void
  end?: () => void
}

const CP = 20 // timing checkpoint every 20 m

export const race = {
  phase: "idle" as Phase,
  cars: [] as RaceCar[],
  laps: 3,
  lights: 0,
  time: 0, // seconds since lights out
  phaseTime: 0,
  holdFor: 1.5,
  reached: new Map<number, number>(), // first time any car reached each checkpoint
  order: [] as RaceCar[],
  follow: "ferrari",
  finalLapCalled: false,
  leaderFinishedAt: null as number | null,
  events: {} as Events,
}

export const useRace = create<{ id: number; phase: Phase; lights: number; lap: number; laps: number; rows: Row[]; follow: string; time: number }>(() => ({
  id: 0,
  phase: "idle",
  lights: 0,
  lap: 0,
  laps: 3,
  rows: [],
  follow: "ferrari",
  time: 0,
}))

export const gridSlot = (g: number) => ({ s: -8 - g * 8, lat: g % 2 ? -2.4 : 2.4 })

export function setupRace(order: string[], laps: number, follow: string, events: Events) {
  race.cars = order.map((teamId, g) => {
    const slot = gridSlot(g)
    return {
      teamId,
      grid: g,
      s: slot.s,
      v: 0,
      lat: slot.lat,
      latTarget: slot.lat,
      // Grid order roughly reflects pace, with enough spread for overtakes.
      pace: clamp(1 - 0.0022 * g + (Math.random() - 0.5) * 0.022, 0.955, 1.012),
      seed: Math.random() * 100,
      reaction: 0.16 + Math.random() * 0.18,
      finished: false,
      finishTime: null,
      lastCp: Math.floor(slot.s / CP),
      lastCpTime: 0,
      motion: newMotion(),
      moment: 0,
    }
  })
  Object.assign(race, { phase: "grid", laps, lights: 0, time: 0, phaseTime: 0, holdFor: 0.6 + Math.random() * 1.8, follow, finalLapCalled: false, leaderFinishedAt: null, events })
  race.reached = new Map()
  race.order = [...race.cars]
  useRace.setState((s) => ({ id: s.id + 1 }))
  snapshot()
}

export function stopRace() {
  race.phase = "idle"
  race.cars = []
  snapshot()
}

export function setFollow(teamId: string) {
  race.follow = teamId
  useRace.setState({ follow: teamId })
}

const gapText = (c: RaceCar, leader: RaceCar) => {
  if (c === leader) return c.finished ? "WINNER" : "LEADER"
  const lapsDown = Math.floor((leader.s - c.s) / L)
  if (lapsDown >= 1 && !c.finished) return `+${lapsDown} LAP${lapsDown > 1 ? "S" : ""}`
  if (c.finished && leader.finishTime !== null && c.finishTime !== null) return `+${(c.finishTime - leader.finishTime).toFixed(3)}`
  const ref = race.reached.get(c.lastCp)
  return ref === undefined ? "" : `+${Math.max(0, c.lastCpTime - ref).toFixed(3)}`
}

let sinceSnap = 0
function snapshot() {
  const leader = race.order[0]
  useRace.setState({
    phase: race.phase,
    lights: race.lights,
    laps: race.laps,
    lap: leader ? clamp(Math.floor(leader.s / L) + 1, 1, race.laps) : 0,
    time: race.time,
    follow: race.follow,
    rows: race.order.map((c, i) => ({ teamId: c.teamId, code: teamById(c.teamId).code, pos: i + 1, gap: leader ? gapText(c, leader) : "", finished: c.finished })),
  })
}

function rank() {
  const prev = new Map(race.order.map((c, i) => [c, i]))
  race.order = [...race.cars].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime! - b.finishTime!
    if (a.finished !== b.finished) return a.finished ? -1 : 1
    return b.s - a.s
  })
  if (race.phase !== "racing") return
  race.order.forEach((c, i) => {
    const from = prev.get(c)
    if (from !== undefined && from !== i) race.events.position?.(c.teamId, from + 1, i + 1)
  })
}

export function stepRace(dt: number) {
  if (race.phase === "idle") return
  race.phaseTime += dt

  if (race.phase === "grid") {
    for (const c of race.cars) { c.motion.wheelspin = 0; c.motion.speed = 0 }
    if (race.phaseTime > 2.5) { race.phase = "lights"; race.phaseTime = 0 }
  } else if (race.phase === "lights") {
    // One light per second, then a random hold before they all go out.
    const want = Math.min(5, Math.floor(race.phaseTime) + 1)
    if (want > race.lights) { race.lights = want; race.events.light?.(want) }
    if (race.phaseTime > 5 + race.holdFor) {
      race.lights = 0
      race.phase = "racing"
      race.phaseTime = 0
      race.time = 0
      race.events.lightsOut?.()
    }
    for (const c of race.cars) c.motion.wheelspin = 0.15 // revs up, holding the clutch
  } else {
    race.time += dt
    stepCars(dt)
    rank()
    const leader = race.order[0]
    if (!race.finalLapCalled && leader && leader.s >= (race.laps - 1) * L) { race.finalLapCalled = true; race.events.finalLap?.() }
    if (race.phase === "racing" && race.cars.every((c) => c.finished || (race.leaderFinishedAt !== null && race.time > race.leaderFinishedAt + 14))) {
      race.phase = "finished"
      race.events.end?.()
    }
  }

  sinceSnap += dt
  if (sinceSnap > 0.12) { sinceSnap = 0; snapshot() }
}

function stepCars(dt: number) {
  const cars = race.cars
  for (const c of cars) {
    const m = c.motion
    if (race.time < c.reaction) { c.v = 0; m.wheelspin = 0.3; m.speed = 0; continue }
    const launch = race.time - c.reaction
    m.wheelspin = launch < 1 ? 0.75 * (1 - launch) : 0

    // Traffic: look for the car directly ahead in roughly the same line.
    let cap = Infinity
    let pace = c.pace + Math.sin(race.time * 0.35 + c.seed) * 0.002
    let ahead: RaceCar | null = null
    let aheadGap = Infinity
    for (const o of cars) {
      if (o === c) continue
      const ds = o.s - c.s
      if (ds > 0 && ds < aheadGap && Math.abs(o.lat - c.lat) < 2.1) { ahead = o; aheadGap = ds }
    }
    if (ahead) {
      // Slipstream on the straights.
      if (aheadGap < 30 && track.targetSpeed(c.s) > 80) pace *= 1.012
      if (aheadGap < 14 && (pace > ahead.pace + 0.002 || c.v > ahead.v + 0.5 || ahead.moment > 0)) {
        // Pull out to the side with room, else sit behind.
        const side = ahead.lat >= 0 ? -3 : 3
        const blocked = cars.some((o) => o !== c && Math.abs(o.s - c.s) < 9 && Math.abs(o.lat - side) < 2)
        if (!blocked) c.latTarget = side
        else if (aheadGap < 7.5) cap = Math.max(0, ahead.v - 0.4)
      } else if (aheadGap < 7.5) cap = Math.max(0, ahead.v - 0.2)
    } else {
      // Clear road: drift back onto the racing line when nobody is alongside.
      const alongside = cars.some((o) => o !== c && Math.abs(o.s - c.s) < 7 && Math.abs(o.lat) < 2)
      if (!alongside) c.latTarget *= Math.exp(-0.6 * dt)
    }
    // Now and then a driver makes a small mistake in a braking zone.
    if (c.moment > 0) { c.moment -= dt; cap = Math.min(cap, c.v * 0.97) }
    else if (m.braking > 0.5 && Math.random() < 0.12 * dt) c.moment = 0.5 + Math.random() * 0.6
    if (c.finished) cap = Math.min(cap, 42) // cool-down lap
    const before = c.s
    drive(c, dt, pace, cap)
    // Lateral movement, never off the asphalt.
    c.latTarget = clamp(c.latTarget, -4.6, 4.6)
    c.lat += clamp(c.latTarget - c.lat, -2.4 * dt, 2.4 * dt)

    // Timing checkpoints.
    const cp = Math.floor(c.s / CP)
    if (cp > c.lastCp) {
      const t = race.time - ((c.s - cp * CP) / Math.max(1, c.v))
      c.lastCp = cp
      c.lastCpTime = t
      if (!race.reached.has(cp)) race.reached.set(cp, t)
    }
    if (!c.finished && before < race.laps * L && c.s >= race.laps * L) {
      c.finished = true
      c.finishTime = race.time
      if (race.leaderFinishedAt === null) race.leaderFinishedAt = race.time
      const pos = cars.filter((o) => o.finished).length
      race.events.finish?.(c.teamId, pos)
    }
  }
}
