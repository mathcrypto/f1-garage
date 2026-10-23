"use client"

import { useEffect } from "react"
import { driveLaps } from "./drive"
import { race } from "./race"
import { useShowcase } from "./showcase"
import { useGarage } from "./store"
import { teamById } from "./teams"
import { voice } from "./voice"
import { lines } from "./voiceLines"

// Real pit-wall radio: mostly quiet. Speak only when it changes the lap —
// lights out, a fight, a penalty, purple, last lap, the flag.

/** soft = drop if busy / recent · hard = short gap · critical = always */
export type RadioPriority = "soft" | "hard" | "critical"

let lastCall = 0
const GAP = { soft: 16000, hard: 7000, critical: 0 } as const

export function radio(text: string, priority: RadioPriority | boolean = "soft") {
  const p: RadioPriority = priority === true ? "hard" : priority === false ? "soft" : priority
  const now = performance.now()
  if (p !== "critical") {
    if (now - lastCall < GAP[p]) return
    if (p === "soft" && voice.busy) return
  }
  lastCall = now
  voice.add(text)
}

const secs = (t: number) => (t >= 60 ? `${Math.floor(t / 60)} minute ${(t % 60).toFixed(1)}` : t.toFixed(1))
const name = (teamId: string) => teamById(teamId).name.replace(/^Scuderia /, "").replace(/ Racing$/, "")

export function useEngineerRadio() {
  const mode = useGarage((s) => s.mode)
  useEffect(() => {
    if (mode === "studio") {
      voice.setTone("calm")
      return
    }
    voice.setTone("race")
    if (!useShowcase.getState().running) voice.stop()
    voice.unlock()
    let lastLap = 0
    let lastRaceLap = 0
    let batteryCalled = false
    const warned = new Map<string, number>()
    const once = (key: string, every: number) => {
      const now = performance.now()
      if ((warned.get(key) ?? -Infinity) > now - every) return false
      warned.set(key, now)
      return true
    }

    const id = setInterval(() => {
      if (!voice.enabled || useShowcase.getState().running) return

      if (mode === "drive") {
        // Guided tour owns most talk; only call a completed lap if it's notable.
        if (driveLaps.lap > lastLap && driveLaps.last !== null) {
          lastLap = driveLaps.lap
          const last = driveLaps.last, best = driveLaps.best!
          if (driveLaps.lap === 1) radio(`Lap time ${secs(last)}. ${lines.tyresIn}`, "hard")
          else if (last <= best + 0.001) radio(`Lap time ${secs(last)}. Purple.`, "hard")
          // Otherwise stay quiet — tips every lap feels like chatter.
        }
        return
      }

      if (race.phase !== "racing") return
      const me = race.cars.find((c) => c.teamId === race.follow)
      if (!me || me.finished) return
      const i = race.order.indexOf(me)
      const ahead = race.order[i - 1], behind = race.order[i + 1]
      const gapTo = (o: typeof me) => Math.abs(o.s - me.s) / Math.max(25, me.v)

      // End of lap: only purple, or a short gap call when you're in a fight.
      if (me.lap > lastRaceLap && me.lastLap !== null) {
        lastRaceLap = me.lap
        if (me.lap === race.laps - 1) return // final-lap call owns this moment
        const pb = me.bestLap !== null && me.lastLap <= me.bestLap + 0.001
        if (pb) {
          radio(`Lap time ${secs(me.lastLap)}. Purple.`, "hard")
          return
        }
        const fighting = (ahead && gapTo(ahead) < 1.2) || (behind && gapTo(behind) < 1.2)
        if (fighting && ahead) {
          radio(`Gap ${gapTo(ahead).toFixed(1)} to ${name(ahead.teamId)}.`, "soft")
        }
        return
      }

      // Under a second — once in a while, not every poll.
      if (behind && gapTo(behind) < 0.8 && me.v > 40 && once(`behind-${behind.teamId}`, 35000)) {
        radio(`${name(behind.teamId)} at ${gapTo(behind).toFixed(1)}. Cover the inside.`, "hard")
        return
      }
      if (ahead && gapTo(ahead) < 0.8 && me.battery > 0.25 && me.player && once(`ahead-${ahead.teamId}`, 35000)) {
        radio(`Gap ${gapTo(ahead).toFixed(1)} to ${name(ahead.teamId)}. Overtake is armed.`, "hard")
        return
      }
      if (me.player && me.battery < 0.1 && !batteryCalled) {
        batteryCalled = true
        radio(lines.batteryLow, "hard")
      }
    }, 500)
    return () => {
      clearInterval(id)
      voice.setTone("calm")
    }
  }, [mode])
}
