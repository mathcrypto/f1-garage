"use client"

import { useEffect } from "react"
import { driveLaps, ENGINE_START } from "./drive"
import { race } from "./race"
import { useShowcase } from "./showcase"
import { useGarage } from "./store"
import { teamById } from "./teams"
import { track } from "./track"
import { voice } from "./voice"
import { lines } from "./voiceLines"

// Lena on the radio while a car is on track, the way a race engineer talks
// to a driver: short, calm, one piece of information per call, timed to
// where the car is (before a braking zone, at the end of a lap).

let lastCall = 0
// Important calls always queue (after what she's saying, never cutting her
// off); minor ones are dropped when she's busy or has just spoken.
export function radio(text: string, important = false) {
  const now = performance.now()
  if (!important && (voice.busy || now - lastCall < 6000)) return
  lastCall = now
  voice.add(text)
}

// Numbers the way engineers say them: "26.8", "0.4".
const secs = (t: number) => (t >= 60 ? `${Math.floor(t / 60)} minute ${(t % 60).toFixed(1)}` : t.toFixed(1))
const name = (teamId: string) => teamById(teamId).name.replace(/^Scuderia /, "").replace(/ Racing$/, "")

// Braking zones: where the speed profile drops into a corner, with the
// corner's minimum speed. A call is made shortly before each one.
type Corner = { brakeAt: number; minSpeed: number }
const CORNERS: Corner[] = (() => {
  const out: Corner[] = []
  const L = track.length
  for (let s = 0; s < L; s++) {
    const v = track.targetSpeed(s), prev = track.targetSpeed(s - 1), next = track.targetSpeed(s + 1)
    if (v <= prev && v < next && v < track.vmax * 0.8) {
      let b = s
      while (track.targetSpeed(b - 1) > track.targetSpeed(b) + 0.01 && s - b < 400) b--
      if (!out.some((c) => Math.abs(c.brakeAt - b) < 120)) out.push({ brakeAt: b, minSpeed: v })
    }
  }
  return out
})()

export const cornerCall = (minSpeed: number) =>
  minSpeed < 42 ? lines.cornerSlow : minSpeed < 60 ? lines.cornerMedium : lines.cornerFast

export function useEngineerRadio() {
  const mode = useGarage((s) => s.mode)
  useEffect(() => {
    if (mode === "studio") return
    // Out on track she switches to radio: the garage explanation stops.
    if (!useShowcase.getState().running) voice.stop()
    const started = performance.now()
    let greeted = false
    let lastLap = 0
    let lastRaceLap = 0
    let cornerLap = -1
    const warned = new Map<string, number>()
    const once = (key: string, every: number) => {
      const now = performance.now()
      if ((warned.get(key) ?? -Infinity) > now - every) return false
      warned.set(key, now)
      return true
    }

    const id = setInterval(() => {
      if (!voice.enabled || useShowcase.getState().running) return
      const now = performance.now()

      if (mode === "drive") {
        if (!greeted && now - started > ENGINE_START * 1000 + 300) { greeted = true; radio(lines.driveCheck, true) }
        if (driveLaps.lap > lastLap && driveLaps.last !== null) {
          lastLap = driveLaps.lap
          const last = driveLaps.last, best = driveLaps.best!
          if (driveLaps.lap === 1) radio(`Lap time ${secs(last)}. ${lines.tyresIn}`, true)
          else if (last <= best + 0.001) radio(`Lap time ${secs(last)}. Personal best, purple. Keep it coming.`, true)
          else radio(`Lap time ${secs(last)}, ${(last - best).toFixed(1)} off your best. ${lines.tips[driveLaps.lap % lines.tips.length]}`, true)
          return
        }
        // One corner call per lap, picked in turn, just before its braking zone.
        const lap = Math.floor(Math.max(0, driveLaps.s) / track.length)
        const pos = ((driveLaps.s % track.length) + track.length) % track.length
        const corner = CORNERS[lap % Math.max(1, CORNERS.length)]
        if (corner && lap !== cornerLap && pos > corner.brakeAt - 260 && pos < corner.brakeAt - 120) {
          cornerLap = lap
          radio(cornerCall(corner.minSpeed))
        }
        return
      }

      // Race: calls about the car you drive (or follow).
      if (race.phase !== "racing") return
      const me = race.cars.find((c) => c.teamId === race.follow)
      if (!me || me.finished) return
      const i = race.order.indexOf(me)
      const ahead = race.order[i - 1], behind = race.order[i + 1]
      const gapTo = (o: typeof me) => Math.abs(o.s - me.s) / Math.max(25, me.v)

      if (me.lap > lastRaceLap && me.lastLap !== null) {
        lastRaceLap = me.lap
        const bits = [`Lap time ${secs(me.lastLap)}.`]
        if (ahead) bits.push(`Gap to ${name(ahead.teamId)} ahead, ${gapTo(ahead).toFixed(1)}.`)
        if (behind) bits.push(`${name(behind.teamId)} behind, ${gapTo(behind).toFixed(1)}.`)
        if (me.lap === race.laps - 1) return // the final-lap call takes over
        radio(bits.join(" "), true)
        return
      }
      if (behind && gapTo(behind) < 1 && me.v > 40 && once(`behind-${behind.teamId}`, 20000)) {
        radio(`${name(behind.teamId)} within a second behind. They have Overtake. Defend the inside.`)
        return
      }
      if (ahead && gapTo(ahead) < 1 && me.battery > 0.3 && me.player && once(`ahead-${ahead.teamId}`, 20000)) {
        radio(`You're within a second of ${name(ahead.teamId)}. Overtake is available, use it on the straight.`)
        return
      }
      if (me.player && me.battery < 0.12 && once("battery", 25000)) {
        radio(lines.batteryLow)
      }
    }, 400)
    return () => clearInterval(id)
  }, [mode])
}
