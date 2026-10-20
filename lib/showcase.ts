"use client"

import { create } from "zustand"
import { PART_IDS } from "./parts"
import { sound } from "./sound"
import { useEngineerState, useGarage, type CameraPreset } from "./store"
import { teamById } from "./teams"
import { voice } from "./voice"

// A scripted reveal: the car comes apart piece by piece, goes back together,
// fires up, and drives off with camera cuts, narrated by Lena.
export const useShowcase = create<{ running: boolean }>(() => ({ running: false }))

let run = 0
const STAGGER_MS = PART_IDS.length * 200

export function stopShowcase() {
  run++
  useShowcase.setState({ running: false })
  sound.engineStop()
  voice.stop()
}

export async function startShowcase() {
  const me = ++run
  useShowcase.setState({ running: true })
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

  g().select(null)
  g().setHighlights([])
  g().setTechnical(false)
  g().setFlow(false)
  g().setExploded(false)
  if (g().mode !== "studio") g().setMode("studio")
  cut("hero")
  // Engine sound is part of the show; this click is the user gesture browsers need.
  await sound.setEngine(true)

  if (!(await say(`Radio check. This is the ${team.car}. Let's take her apart.`, 2500))) return

  g().setExploded(true, true)
  if (!(await say("Front wing, nose, suspension. Bodywork, floor, power unit. All off, all accounted for.", STAGGER_MS + 1500))) return

  g().setTechnical(true)
  if (!(await say("X-ray. Wheelbase thirty-four hundred, width nineteen hundred. Right on the limits.", 3500))) return

  g().setTechnical(false)
  g().setExploded(false, true)
  if (!(await say("Putting her back together.", STAGGER_MS + 800))) return

  if (!(await say("Engine fire-up in three, two, one."))) return
  await sound.engineStart()
  if (!(await wait(2300))) return
  sound.revBlip()
  if (!(await wait(1300))) return
  sound.revBlip(12200)
  if (!(await wait(1500))) return

  g().setTrackCam("chase")
  g().setMode("drive")
  if (!(await say("Burnout. Get some heat in those rears.", 1800))) return
  if (!(await say("Launch, launch! Good start.", 2500))) return
  g().setTrackCam("tv")
  if (!(await say("Straight-line mode. Wings open, full deployment.", 3500))) return
  g().setTrackCam("onboard")
  if (!(await say("Corner mode. Wings closed. Hit your marks.", 3500))) return
  g().setTrackCam("heli")
  if (!(await wait(3500))) return
  g().setTrackCam("chase")
  await say("Good job. That's the car. Over to you.", 2500)
  if (alive()) useShowcase.setState({ running: false })
}
