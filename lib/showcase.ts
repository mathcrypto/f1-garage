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
  const say = (text: string) => {
    const lena = useEngineerState.getState()
    lena.setLesson(null)
    lena.setCaption(text)
    if (voice.enabled && voice.supported) voice.say(text)
    else lena.setStatus("talking")
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

  say(`This is the ${team.car}. Let me show you how it all fits together.`)
  if (!(await wait(3400))) return

  g().setExploded(true, true)
  say("Front wing, nose, suspension, bodywork, the floor, the power unit. Every major component comes off.")
  if (!(await wait(STAGGER_MS + 3600))) return

  g().setTechnical(true)
  say("In blueprint view you can see the structure, and the FIA's limits: a maximum wheelbase of 3400 millimetres and 1900 wide.")
  if (!(await wait(5200))) return

  g().setTechnical(false)
  g().setExploded(false, true)
  say("And back together.")
  if (!(await wait(STAGGER_MS + 1400))) return

  say("Fire it up.")
  await sound.engineStart()
  if (!(await wait(2300))) return
  sound.revBlip()
  if (!(await wait(1300))) return
  sound.revBlip(12200)
  if (!(await wait(1700))) return

  g().setMode("drive")
  say("Lights out, and away we go!")
  if (!(await wait(4200))) return
  cut("side")
  say("On the straights it runs X-mode: the wings open, drag drops and the electric motor gives everything it has.")
  if (!(await wait(4600))) return
  cut("low")
  say("Into the corner, Z-mode: wings closed for downforce, and the brakes glowing at over a thousand degrees.")
  if (!(await wait(4600))) return
  cut("front")
  if (!(await wait(3800))) return
  cut("chase")
  say("That's the car. Click any part, or ask me anything.")
  await wait(4000)
  if (alive()) useShowcase.setState({ running: false })
}
