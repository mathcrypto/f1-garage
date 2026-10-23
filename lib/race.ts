import { create } from "zustand"
import { newMotion, type Motion } from "./motion"
import { teamById } from "./teams"
import { ROAD_WIDTH, WALL_LAT, WALL_THICK, track } from "./track"

const L = track.length
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const EDGE = ROAD_WIDTH / 2 - 1.1 // car centre at the white line
/** Hitbox in track space (metres along s / across lat). */
const CAR_LEN = 4.6
const CAR_WID = 2.05
/** Inner face of Armco, then car half-width — body never crosses the slab. */
const WALL_INNER = WALL_LAT - WALL_THICK / 2
const WALL_HIT = WALL_INNER - CAR_WID / 2 - 0.08

/** Ideal racing-line lateral offset from curvature (shared with OnTrack guide line). */
export function idealLat(curvature: number) {
  return clamp(-Math.sign(curvature) * Math.min(4, Math.abs(curvature) * 700), -4, 4)
}

/** Battery delta for one frame: overtake drain, brake harvest, or idle trickle. */
export function batteryStep(dt: number, boosting: boolean, braking: boolean) {
  return (boosting ? -0.2 : braking ? 0.1 : 0.012) * dt
}

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
  fillMotion(c, prev, dt, target >= track.vmax * 0.95 * pace)
}

// Signals are smoothed so the brakes, wings and wheels never flicker from
// one frame to the next.
function fillMotion(c: Driven, prev: number, dt: number, straight: boolean, steerInput = 0) {
  const m = c.motion
  const ease = (from: number, to: number, rate: number) => from + (to - from) * (1 - Math.exp(-rate * dt))
  const accelerating = c.v > prev + 0.01
  m.speed = c.v * 3.6
  m.braking = ease(m.braking, clamp((prev - c.v) / dt / track.brake, 0, 1), 8)
  m.steer = ease(m.steer, clamp(-track.curvature(c.s) * 2.6 + steerInput * 0.12, -0.32, 0.32), 6)
  // Wings open on a clear straight and close the moment braking starts, with
  // hysteresis so they don't flap.
  if (m.aero === "corner" && straight && m.braking < 0.05) m.aero = "straight"
  else if (m.aero === "straight" && (!straight || m.braking > 0.25)) m.aero = "corner"
  m.ers = ease(m.ers, accelerating ? 0.55 + 0.45 * (c.v / track.vmax) : 0, 6)
  m.throttle = ease(m.throttle, m.braking > 0.15 ? 0 : accelerating ? 1 : 0.3, 10)
}

// ── Race state ──────────────────────────────────────────────────────────────
export type Assist = "full" | "braking" | "off"
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
  player: boolean
  battery: number // 0..1, electrical energy for Overtake mode
  boosting: boolean
  lap: number // completed laps
  lapStart: number
  lastLap: number | null
  bestLap: number | null
  offTrack: boolean
  warnings: number
  penalty: number // seconds added at the finish
}
export type Phase = "idle" | "grid" | "lights" | "racing" | "finished"
export type Row = { teamId: string; code: string; pos: number; gap: string; interval: string; finished: boolean; player: boolean; bestLap: number | null; penalty: number; time: number | null }
export type Tone = "info" | "warn" | "purple"
type Events = {
  light?: (n: number) => void
  lightsOut?: () => void
  position?: (teamId: string, from: number, to: number) => void
  finalLap?: () => void
  finish?: (teamId: string, pos: number) => void
  message?: (text: string, tone: Tone) => void
  end?: () => void
}

// What the player is pressing; written by the keyboard and touch controls.
export const input = { throttle: 0, brake: 0, steer: 0, overtake: false }

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
  player: null as string | null,
  assist: "braking" as Assist,
  difficulty: 85, // AI difficulty 0..110, as in the F1 games
  paused: false,
  reaction: null as number | null,
  fastest: null as { teamId: string; time: number } | null,
  finalLapCalled: false,
  leaderFinishedAt: null as number | null,
  events: {} as Events,
}

export const useRace = create<{
  id: number
  phase: Phase
  lights: number
  lap: number
  laps: number
  rows: Row[]
  follow: string
  player: string | null
  time: number
  paused: boolean
  reaction: number | null
  fastest: { teamId: string; time: number } | null
}>(() => ({ id: 0, phase: "idle", lights: 0, lap: 0, laps: 3, rows: [], follow: "ferrari", player: null, time: 0, paused: false, reaction: null, fastest: null }))

export const gridSlot = (g: number) => ({ s: -8 - g * 8, lat: g % 2 ? -2.4 : 2.4 })

export type RaceOptions = { order: string[]; laps: number; player: string | null; assist: Assist; difficulty: number }

export function setupRace(o: RaceOptions, events: Events) {
  // AI pace from the difficulty slider; the player's car is always at full pace.
  const aiPace = 0.935 + (o.difficulty / 110) * 0.07
  race.cars = o.order.map((teamId, g) => {
    const slot = gridSlot(g)
    const player = teamId === o.player
    return {
      teamId,
      grid: g,
      s: slot.s,
      v: 0,
      lat: slot.lat,
      latTarget: slot.lat,
      // Grid order roughly reflects pace, with enough spread for overtakes.
      pace: player ? 1 : clamp(aiPace - 0.0022 * g + (Math.random() - 0.5) * 0.02, 0.9, 1.012),
      seed: Math.random() * 100,
      reaction: 0.16 + Math.random() * 0.18,
      finished: false,
      finishTime: null,
      lastCp: Math.floor(slot.s / CP),
      lastCpTime: 0,
      motion: newMotion(),
      moment: 0,
      player,
      battery: 1,
      boosting: false,
      lap: 0,
      lapStart: 0,
      lastLap: null,
      bestLap: null,
      offTrack: false,
      warnings: 0,
      penalty: 0,
    }
  })
  Object.assign(race, {
    phase: "grid", laps: o.laps, lights: 0, time: 0, phaseTime: 0, holdFor: 0.6 + Math.random() * 1.8,
    follow: o.player ?? o.order[0], player: o.player, assist: o.assist, difficulty: o.difficulty,
    paused: false, reaction: null, fastest: null, finalLapCalled: false, leaderFinishedAt: null, events,
  })
  Object.assign(input, { throttle: 0, brake: 0, steer: 0, overtake: false })
  race.reached = new Map()
  race.order = [...race.cars]
  useRace.setState((s) => ({ id: s.id + 1 }))
  snapshot()
}

export function stopRace() {
  race.phase = "idle"
  race.cars = []
  race.paused = false
  snapshot()
}

export function setPaused(p: boolean) {
  race.paused = p
  useRace.setState({ paused: p })
}

export function setFollow(teamId: string) {
  if (race.player) return // you always watch your own car
  race.follow = teamId
  useRace.setState({ follow: teamId })
}

export const lapTime = (t: number) => {
  const m = Math.floor(t / 60)
  const s = t - m * 60
  return `${m}:${s.toFixed(3).padStart(6, "0")}`
}

// Gap to the leader in seconds, from the timing checkpoints.
const gapSeconds = (c: RaceCar) => {
  const ref = race.reached.get(c.lastCp)
  return ref === undefined ? 0 : Math.max(0, c.lastCpTime - ref)
}
const totalTime = (c: RaceCar) => (c.finishTime ?? 0) + c.penalty

/** Mark a car classified once past race distance. Idempotent — safe after contacts push `s`. */
function tryFinish(c: RaceCar) {
  if (c.finished || race.phase !== "racing") return
  const line = race.laps * L
  if (c.s < line) return
  // Backdate the exact crossing if we overshot (drive step or contact shove).
  const finishTime = Math.max(0, race.time - (c.s - line) / Math.max(1, c.v))
  c.finished = true
  c.finishTime = finishTime
  if (race.leaderFinishedAt === null) race.leaderFinishedAt = finishTime
  const pos = race.cars.filter((o) => o.finished).sort((a, b) => totalTime(a) - totalTime(b)).indexOf(c) + 1
  race.events.finish?.(c.teamId, pos)
}

const gapText = (c: RaceCar, leader: RaceCar) => {
  if (c === leader) return c.finished ? lapTime(totalTime(c)) : "LEADER"
  const lapsDown = Math.floor((leader.s - c.s) / L)
  if (lapsDown >= 1 && !c.finished) return `+${lapsDown} LAP${lapsDown > 1 ? "S" : ""}`
  if (c.finished && leader.finishTime !== null && c.finishTime !== null) return `+${(totalTime(c) - totalTime(leader)).toFixed(3)}`
  return `+${gapSeconds(c).toFixed(3)}`
}

let sinceSnap = 0
function snapshot() {
  const leader = race.order[0]
  useRace.setState({
    phase: race.phase,
    lights: race.lights,
    laps: race.laps,
    lap: leader ? clamp(Math.floor(Math.max(0, leader.s) / L) + 1, 1, race.laps) : 0,
    time: race.time,
    follow: race.follow,
    player: race.player,
    paused: race.paused,
    reaction: race.reaction,
    fastest: race.fastest,
    rows: race.order.map((c, i) => {
      const ahead = race.order[i - 1]
      const interval = !ahead || c.finished || ahead.finished ? "" : Math.floor((ahead.s - c.s) / L) >= 1 ? "LAP" : `+${Math.max(0, gapSeconds(c) - gapSeconds(ahead)).toFixed(1)}`
      return {
        teamId: c.teamId, code: teamById(c.teamId).code, pos: i + 1, gap: leader ? gapText(c, leader) : "", interval,
        finished: c.finished, player: c.player, bestLap: c.bestLap, penalty: c.penalty, time: c.finished ? totalTime(c) : null,
      }
    }),
  })
}

function rank() {
  const prev = new Map(race.order.map((c, i) => [c, i]))
  race.order = [...race.cars].sort((a, b) => {
    if (a.finished && b.finished) return totalTime(a) - totalTime(b)
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
  if (race.phase === "idle" || race.paused) return
  race.phaseTime += dt

  if (race.phase === "grid") {
    for (const c of race.cars) { c.motion.wheelspin = 0; c.motion.speed = 0; c.motion.throttle = c.player ? input.throttle : 0 }
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
    // Revs up on the clutch; the player can blip the throttle.
    for (const c of race.cars) { c.motion.wheelspin = 0; c.motion.throttle = c.player ? input.throttle : 0.6 }
  } else if (race.phase === "racing") {
    race.time += dt
    stepCars(dt)
    rank()
    const leader = race.order[0]
    // Single-lap races are already the "last lap" — don't call it at lights out.
    if (!race.finalLapCalled && race.laps > 1 && leader && leader.s >= (race.laps - 1) * L) {
      race.finalLapCalled = true
      race.events.finalLap?.()
    }
    if (race.cars.every((c) => c.finished || (race.leaderFinishedAt !== null && race.time > race.leaderFinishedAt + 14))) {
      // Anyone still running when the cars are called in is classified where they are.
      for (const c of race.cars) {
        if (c.finished) continue
        if (c.s >= race.laps * L) tryFinish(c)
        else {
          c.finished = true
          c.finishTime = race.time + (race.laps * L - c.s) / Math.max(20, c.v)
        }
      }
      rank()
      race.phase = "finished"
      race.events.end?.()
    }
  } else {
    // Cool-down lap behind the results.
    race.time += dt
    stepCars(dt)
  }

  sinceSnap += dt
  if (sinceSnap > 0.12) { sinceSnap = 0; snapshot() }
}

// The player's car: throttle, brake and steering from the controls, with
// the chosen assists. Too fast for a corner and the car runs wide.
function drivePlayer(c: RaceCar, dt: number, cap: number) {
  const prev = c.v
  const auto = race.assist === "full" || c.finished
  let throttle = input.throttle
  let brake = input.brake
  const target = track.targetSpeed(c.s + c.v * 0.3)
  if (auto) {
    // Full assist: the car handles throttle and brakes; you choose the line and when to attack.
    throttle = clamp((target - c.v) / 2, 0, 1)
    brake = clamp((c.v - target) / 2, 0, 1)
  } else if (race.assist === "braking" && c.v > target) {
    // Braking assist: the car brakes for corners (progressively); the throttle is yours.
    brake = Math.max(brake, clamp((c.v - target) / 2, 0.3, 1))
    throttle = 0
  }
  c.boosting = input.overtake && c.battery > 0.02 && throttle > 0 && !c.finished
  if (brake > 0) c.v = Math.max(0, c.v - track.brake * brake * dt)
  else if (throttle > 0) c.v = Math.min(track.vmax * (c.boosting ? 1.03 : 1), c.v + track.accel(c.v) * (c.boosting ? 1.07 : 1) * throttle * dt)
  else c.v = Math.max(0, c.v - (1.5 + c.v * 0.03) * dt) // lift and coast: engine braking and drag
  if (c.offTrack) c.v -= Math.min(16 * dt, Math.max(0, c.v - 24)) // gravel and grass scrub speed
  c.v = Math.min(c.v, cap)

  // Cornering: over the limit the tyres slide and the car drifts to the outside.
  const grip = track.grip(c.s)
  const k = track.curvature(c.s)
  if (c.v > grip * 1.01) {
    const over = c.v - grip
    c.latTarget = c.lat + Math.sign(k || 1) * over * 0.9
    c.lat += Math.sign(k || 1) * over * 0.55 * dt
    c.v = Math.min(c.v, grip * 1.12)
  }
  // Steering moves the car across the track; full assist also follows the racing line.
  if (input.steer) c.latTarget = c.lat + input.steer * 3
  else if (auto) c.latTarget = idealLat(k)
  c.s += c.v * dt
  fillMotion(c, prev, dt, c.v > track.vmax * 0.85 && throttle > 0, input.steer)
  // The engine note follows your foot, smoothed.
  c.motion.throttle += ((brake > 0 ? 0 : throttle) - c.motion.throttle) * (1 - Math.exp(-14 * dt))

  // Overtake mode drains the battery; braking harvests energy back.
  c.battery = clamp(c.battery + batteryStep(dt, c.boosting, brake > 0), 0, 1)
  if (c.boosting) c.motion.ers = 1
}

function stepCars(dt: number) {
  const cars = race.cars
  for (const c of cars) {
    const m = c.motion
    if (c.player && race.reaction === null && (input.throttle > 0 || race.assist === "full")) {
      // The player's launch: reaction time from lights out.
      race.reaction = race.assist === "full" ? 0.2 + Math.random() * 0.1 : race.time
      race.events.message?.(`Reaction ${race.reaction.toFixed(3)} s`, "info")
    }
    const reaction = c.player ? (race.reaction ?? Infinity) : c.reaction
    if (race.time < reaction) { c.v = 0; m.wheelspin = 0; m.speed = 0; m.throttle = c.player ? input.throttle : 0.7; continue }
    const launch = race.time - reaction
    m.wheelspin = launch < 1 ? 0.75 * (1 - launch) : 0

    // Traffic: car ahead in an overlapping lane (same racing line or side-by-side).
    let cap = Infinity
    let pace = c.pace + Math.sin(race.time * 0.35 + c.seed) * 0.002
    let ahead: RaceCar | null = null
    let aheadGap = Infinity
    for (const o of cars) {
      if (o === c) continue
      const ds = o.s - c.s
      if (ds > 0 && ds < aheadGap && Math.abs(o.lat - c.lat) < CAR_WID) {
        ahead = o
        aheadGap = ds
      }
    }
    if (c.player) {
      // Hold behind overlapping traffic — hard contacts are resolved after the move.
      if (ahead && aheadGap < CAR_LEN + 1.2) {
        const bump = aheadGap < CAR_LEN ? 4 : aheadGap < CAR_LEN + 0.6 ? 2 : 0.4
        cap = Math.max(0, ahead.v - bump)
      }
    } else if (ahead) {
      // Slipstream on the straights, and Overtake mode when close.
      const straight = track.targetSpeed(c.s) > 80
      if (aheadGap < 30 && straight) pace *= 1.012
      c.boosting = aheadGap < 30 && c.battery > 0.3 && straight
      if (c.boosting) pace *= 1.01
      if (aheadGap < 14 && (pace > ahead.pace + 0.002 || c.v > ahead.v + 0.5 || ahead.moment > 0 || ahead.offTrack)) {
        // Pull out to the side with room, else sit behind.
        const side = ahead.lat >= 0 ? -3.2 : 3.2
        const blocked = cars.some((o) => o !== c && Math.abs(o.s - c.s) < CAR_LEN + 4 && Math.abs(o.lat - side) < CAR_WID)
        if (!blocked) c.latTarget = side
        else if (aheadGap < CAR_LEN + 2.5) cap = Math.max(0, ahead.v - 0.5)
      } else if (aheadGap < CAR_LEN + 2.5) cap = Math.max(0, ahead.v - 0.25)
    } else {
      c.boosting = false
      const alongside = cars.some((o) => o !== c && Math.abs(o.s - c.s) < CAR_LEN + 2 && Math.abs(o.lat - c.lat) < CAR_WID)
      if (!alongside) c.latTarget *= Math.exp(-0.6 * dt)
    }
    if (c.player) {
      drivePlayer(c, dt, c.finished ? Math.min(cap, 42) : cap)
    } else {
      // Now and then a driver makes a small mistake in a braking zone.
      if (c.moment > 0) { c.moment -= dt; cap = Math.min(cap, c.v * 0.97) }
      else if (m.braking > 0.5 && Math.random() < 0.1 * dt) c.moment = 0.5 + Math.random() * 0.6
      if (c.finished) cap = Math.min(cap, 42) // cool-down lap
      drive(c, dt, pace, cap)
      c.battery = clamp(c.battery + batteryStep(dt, c.boosting, m.braking > 0), 0, 1)
    }
    // Lateral movement (hard stop at Armco — see resolveWallContacts).
    const latMax = c.player ? WALL_HIT : 4.6
    c.latTarget = clamp(c.latTarget, -latMax, latMax)
    const rate = (c.player ? 6 : 2.4) * dt
    c.lat = clamp(c.lat + clamp(c.latTarget - c.lat, -rate, rate), -WALL_HIT, WALL_HIT)

    // Track limits for the player: all four wheels over the white line.
    if (c.player) {
      const off = Math.abs(c.lat) > EDGE + 0.9
      if (off && !c.offTrack && race.phase === "racing" && !c.finished) {
        c.warnings++
        if (c.warnings % 3 === 0) {
          c.penalty += 5
          race.events.message?.("5 second time penalty · track limits", "warn")
        } else race.events.message?.(`Track limits · warning ${c.warnings % 3} of 3`, "warn")
      }
      c.offTrack = off
    }

    // Timing checkpoints.
    const cp = Math.floor(c.s / CP)
    if (cp > c.lastCp) {
      const t = race.time - ((c.s - cp * CP) / Math.max(1, c.v))
      c.lastCp = cp
      c.lastCpTime = t
      if (!race.reached.has(cp)) race.reached.set(cp, t)
    }
    // Lap times.
    const lap = Math.floor(Math.max(0, c.s) / L)
    if (lap > c.lap && !c.finished) {
      const t = race.time - ((c.s - lap * L) / Math.max(1, c.v))
      const time = t - c.lapStart
      c.lap = lap
      c.lapStart = t
      c.lastLap = time
      if (c.bestLap === null || time < c.bestLap) c.bestLap = time
      if (!race.fastest || time < race.fastest.time) {
        race.fastest = { teamId: c.teamId, time }
        if (lap > 1) race.events.message?.(`Fastest lap · ${teamById(c.teamId).code} ${lapTime(time)}`, "purple")
      }
    }
    // Finish is also checked after contacts — a shove can push you over the line.
    tryFinish(c)
  }

  // Solid bodies: push cars apart so you can't drive through someone.
  resolveCarContacts()
  // Armco — keep cars inside the barriers.
  resolveWallContacts()
  // Contacts can shove a car past race distance after the drive-step check.
  for (const c of cars) tryFinish(c)
}

/** Keep car centres inside the Armco; scrub speed and bounce inward on impact. */
function resolveWallContacts() {
  for (const c of race.cars) {
    if (Math.abs(c.lat) <= WALL_HIT) continue
    const sign = Math.sign(c.lat)
    const pen = Math.abs(c.lat) - WALL_HIT
    c.lat = sign * WALL_HIT
    c.latTarget = sign * (WALL_HIT - Math.min(1.2, 0.4 + pen))
    c.v *= Math.max(0.45, 1 - 0.55 * Math.min(1, pen + 0.2))
    c.motion.braking = Math.max(c.motion.braking, 0.7)
  }
}

/** AABB resolve in (s, lat) — stops ghosting through during overtakes. */
function resolveCarContacts() {
  const cars = race.cars
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j]
      const ds = a.s - b.s
      const dLat = a.lat - b.lat
      const overlapS = CAR_LEN - Math.abs(ds)
      const overlapLat = CAR_WID - Math.abs(dLat)
      if (overlapS <= 0 || overlapLat <= 0) continue

      // Separate on the shallow axis (side-swipe vs rear-end).
      if (overlapLat <= overlapS) {
        const sign = dLat === 0 ? (a.teamId > b.teamId ? 1 : -1) : Math.sign(dLat)
        const push = overlapLat * 0.5 + 0.04
        a.lat += sign * push
        b.lat -= sign * push
        a.latTarget = a.lat
        b.latTarget = b.lat
        // Scrub a bit of speed on a side contact.
        a.v *= 0.98
        b.v *= 0.98
      } else {
        const sign = ds === 0 ? 1 : Math.sign(ds)
        const push = overlapS * 0.5 + 0.06
        a.s += sign * push
        b.s -= sign * push
        // Rear-end: trailing car loses speed, lead car gets a small shove.
        const behind = a.s < b.s ? a : b
        const lead = a.s < b.s ? b : a
        const share = (behind.v + lead.v) * 0.5
        behind.v = Math.min(behind.v, share * 0.88)
        lead.v = Math.min(track.vmax, Math.max(lead.v, share * 0.96))
      }

      a.lat = clamp(a.lat, -WALL_HIT, WALL_HIT)
      b.lat = clamp(b.lat, -WALL_HIT, WALL_HIT)
    }
  }
}
