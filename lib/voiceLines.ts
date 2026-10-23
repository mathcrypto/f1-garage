import { LESSONS } from "./lessons"
import { TEAMS } from "./teams"

// Lena's fixed lines. Race radio stays short and flat — information, not hype.
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
    "Burnout. Heat in the rears.",
    "Launch. Good start.",
    "Straight-line mode. Wings open, full deployment.",
    "Corner mode. Wings closed. Hit your marks.",
    "That's the car. Over to you.",
  ],
  gridCheck: (slot: number) => `Radio check. ${P(slot)} on the grid. Hold for the lights.`,
  gridWatch: (cars: number) => `Radio check. ${cars} cars on the grid.`,
  // Start: factual, not a cheer.
  lightsOut: (driving: boolean) => (driving ? "Lights out. Mode race." : "Lights out. They're away."),
  gained: (pos: number) => (pos === 1 ? `You're ${P(1)}. Nice move.` : `Good move. ${P(pos)}.`),
  lost: (pos: number) => `${P(pos)}. Keep your head down.`,
  finalLap: "Last lap. Bring it home.",
  driveCheck: "Radio check. Engine's live. Out-lap: aero, battery, Overtake.",
  tyresIn: "Tyres are in the window. You can push.",
  tips: [
    "Later on the brakes into the hairpin. You've got margin.",
    "Carry more speed through the esses. The car will take it.",
    "Early on the throttle out of the last corner. Long straight.",
    "Use all the exit kerb. Free lap time.",
    "Save the battery for the fight. Don't dump it lap one.",
    "X-mode on the straight, Z before turn-in.",
  ],
  cornerSlow: "Hairpin. Big stop. Brake on the marker.",
  cornerMedium: "Medium coming. Brake early, prioritise exit.",
  cornerFast: "Fast one. Trust the downforce.",
  batteryLow: "Battery's low. Lift and coast to harvest.",
  trackLimits: "Track limits. Mind the exits.",
  penalty: "Five second penalty. Build a gap.",
  fastest: "Purple. Fastest lap.",
  // On-track crossing (ignores time penalties). Classified result comes after when needed.
  crossed: (pos: number) =>
    pos === 1
      ? "Chequered flag. You finished P1."
      : pos <= 3
        ? `Chequered flag. You finished ${P(pos)}. That's a podium crossing.`
        : `Chequered flag. You finished ${P(pos)}.`,
  finish: (pos: number) =>
    pos === 1
      ? "Chequered flag. P1. Job done."
      : pos <= 3
        ? `Chequered flag. ${P(pos)}. That's a podium.`
        : `Chequered flag. ${P(pos)}. Good effort.`,
  classifiedPenalty: (pos: number, seconds: number) => {
    const pen = seconds === 1 ? "one second" : `${seconds} second`
    return `Final result ${P(pos)}. ${pen} track limits penalty.`
  },
}

export function fixedLines(): string[] {
  const out: string[] = [
    lines.copy, lines.checking, lines.driveCheck, lines.finalLap, lines.lightsOut(true), lines.lightsOut(false),
    lines.cornerSlow, lines.cornerMedium, lines.cornerFast, lines.batteryLow, lines.trackLimits, lines.penalty, lines.fastest,
  ]
  for (const t of TEAMS) out.push(lines.greeting(t.name, t.car), ...lines.showcase(t.car))
  for (const l of LESSONS) for (const s of l.steps) out.push(s.say)
  for (let p = 1; p <= TEAMS.length; p++) {
    out.push(lines.gridCheck(p), lines.gridWatch(p), lines.gained(p), lines.lost(p), lines.finish(p), lines.crossed(p))
    for (const s of [5, 10]) out.push(lines.classifiedPenalty(p, s))
  }
  return [...new Set(out)]
}
