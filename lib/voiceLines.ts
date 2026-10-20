import { LESSONS } from "./lessons"
import { TEAMS } from "./teams"

// Lena's fixed lines in one place. The server generates all of them ahead of
// time, so they play the instant they're needed.
const P = (n: number) => `P${n}`

export const lines = {
  copy: "Copy.",
  checking: "Stand by, checking that.",
  greeting: (team: string, car: string) => `${team} pit wall, radio check. Let's have a look at the ${car}.`,
  showcase: (car: string) => [
    `Radio check. This is the ${car}. Let's take her apart.`,
    "Front wing, nose, suspension. Bodywork, floor, power unit. All off, all accounted for.",
    "X-ray. Wheelbase thirty-four hundred, width nineteen hundred. Bang on the limits.",
    "Putting her back together.",
    "Car's ready. Out on track.",
    "Burnout. Get some heat in those rears.",
    "Launch, launch! Good start.",
    "Straight-line mode. Wings open, full deployment.",
    "Corner mode. Wings closed. Hit your marks.",
    "Good job. That's the car. Over to you.",
  ],
  gridCheck: (slot: number) => `Radio check. ${P(slot)} on the grid. Wait for the lights, then go.`,
  gridWatch: (cars: number) => `Radio check. ${cars} cars on the grid.`,
  lightsOut: (driving: boolean) => (driving ? "Lights out. Go, go, go!" : "Lights out and away we go!"),
  gained: (pos: number) => (pos === 1 ? "P1. You're leading the race." : `Good move. ${P(pos)}.`),
  lost: (pos: number) => `${P(pos)}. Stay calm, we go again.`,
  finalLap: "Final lap. Bring it home.",
  driveCheck: "Radio check. Engine's running, all temperatures good. Build the tyre temperature on this out-lap.",
  tyresIn: "Tyres are in the window now. Push this lap.",
  tips: [
    "Brake a touch later into the hairpin, you've got margin there.",
    "Carry more speed through the esses, the car will take it.",
    "Early on the throttle out of the last corner, it's a long straight.",
    "Use all the kerb on the exit, it's free lap time.",
  ],
  cornerSlow: "Hairpin coming. Big stop, brake on the marker, and be patient on the exit.",
  cornerMedium: "Medium-speed corner next. Brake early, get it turned, good exit.",
  cornerFast: "Fast one coming. Trust the downforce, keep your foot in.",
  batteryLow: "Battery's low. Lift and coast into the braking zones to harvest.",
  trackLimits: "Track limits warning. Watch the exit kerbs.",
  penalty: "That's a five second penalty. We need to build a gap to the car behind.",
  fastest: "Fastest lap. Purple. Great job.",
  finish: (pos: number) => (pos === 1 ? "Chequered flag. P1! Get in there!" : pos <= 3 ? `${P(pos)}. That's a podium. Great job.` : `${P(pos)}. Good effort. We go again.`),
}

export function fixedLines(): string[] {
  const out: string[] = [
    lines.copy, lines.checking, lines.driveCheck, lines.finalLap, lines.lightsOut(true), lines.lightsOut(false),
    lines.cornerSlow, lines.cornerMedium, lines.cornerFast, lines.batteryLow, lines.trackLimits, lines.penalty, lines.fastest,
  ]
  for (const t of TEAMS) out.push(lines.greeting(t.name, t.car), ...lines.showcase(t.car))
  for (const l of LESSONS) for (const s of l.steps) out.push(s.say)
  for (let p = 1; p <= TEAMS.length; p++) out.push(lines.gridCheck(p), lines.gridWatch(p), lines.gained(p), lines.lost(p), lines.finish(p))
  return [...new Set(out)]
}
