"use client"

import { create } from "zustand"
import { PART_IDS } from "./parts"
import { sound } from "./sound"
import { useEngineerState, useGarage, type CameraPreset } from "./store"
import { teamById } from "./teams"
import { BURNOUT, driveTourState, ENGINE_START } from "./drive"
import { voice } from "./voice"
import { lines } from "./voiceLines"

// A scripted reveal: the car comes apart piece by piece, goes back together,
// fires up, and drives off with camera cuts, narrated by Lena.
export const useShowcase = create<{ running: boolean }>(() => ({ running: false }))

let run = 0
const STAGGER_MS = PART_IDS.length * 200

export function stopShowcase() {
  run++
  useShowcase.setState({ running: false })
  sound.showcase = false
  voice.stop()
}

export async function startShowcase() {
  const me = ++run
  useShowcase.setState({ running: true })
  sound.showcase = true
  const alive = () => me === run
  const wait = (ms: number) => new Promise<boolean>((r) => setTimeout(() => r(alive()), ms))
  const g = useGarage.getState
  const team = teamById(g().teamId)
  // Each line plays to the end before the show moves on; `atLeast` keeps the
  // visuals on screen long enough even when she's quick.
  const say = async (text: string, atLeast = 0) => {
    useEngineerState.getState().setLesson(null)
    await Promise.all([voice.speak(text), wait(atLeast)])
    return alive()
  }
  const cut = (preset: CameraPreset) => g().setCamera(preset)
  // On track, wait on the car's own clock, not the wall clock: each line lands
  // on the moment it describes even when frames are slow.
  const atDrive = async (t: number) => {
    while (alive() && (g().mode !== "drive" || driveTourState.t < t)) await wait(80)
    return alive()
  }
  const launch = ENGINE_START + BURNOUT
  const L = lines.showcase(team.car)
  // Generate every line now, so each one plays the moment its shot comes up.
  voice.prefetch(L)

  g().select(null)
  g().setHighlights([])
  g().setTechnical(false)
  g().setFlow(false)
  g().setExploded(false)
  if (g().mode !== "studio") g().setMode("studio")
  cut("hero")
  sound.unlock()

  if (!(await say(L[0], 2500))) return

  g().setExploded(true, true)
  if (!(await say(L[1], STAGGER_MS + 1500))) return

  g().setTechnical(true)
  if (!(await say(L[2], 3500))) return

  g().setTechnical(false)
  g().setExploded(false, true)
  if (!(await say(L[3], STAGGER_MS + 800))) return

  if (!(await say(L[4]))) return

  g().setTrackCam("chase")
  g().setMode("drive")
  // Burnout as the rear tyres spin up, launch as the car pulls away.
  if (!(await atDrive(ENGINE_START + 0.2))) return
  if (!(await say(L[5]))) return
  if (!(await atDrive(launch + 0.2))) return
  if (!(await say(L[6]))) return
  // The wings follow the guided lap: open on the straight, closed from launch + 11 s.
  if (!(await atDrive(launch + 2.5))) return
  g().setTrackCam("tv")
  if (!(await say(L[7]))) return
  if (!(await atDrive(launch + 11.3))) return
  g().setTrackCam("onboard")
  if (!(await say(L[8]))) return
  if (!(await atDrive(launch + 16))) return
  g().setTrackCam("heli")
  if (!(await atDrive(launch + 19))) return
  // Back to the garage to finish, so the guided lap doesn't carry on talking.
  g().setMode("studio")
  cut("hero")
  await say(L[9], 2000)
  if (alive()) { useShowcase.setState({ running: false }); sound.showcase = false }
}
