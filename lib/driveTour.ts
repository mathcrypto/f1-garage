import { BURNOUT, DRIVE_TOUR, ENGINE_START } from "./drive"

// Guided systems lap — HUD change and Lena’s line land together.
export { DRIVE_TOUR }

export type HudFocus = "aero" | "ers" | "battery" | "brake" | null

export type TourPhase = {
  until: number
  aero?: "straight" | "corner"
  ers?: number
  batteryRate?: number
  boosting?: boolean
  /** Big on-screen lesson title (e.g. "1 · Straight Mode"). */
  title?: string
  /** Plain hint under the title. */
  hint?: string
  /** Which HUD row to pulse. */
  focus?: HudFocus
  /** Spoken the moment this phase starts (same beat as the HUD). */
  say?: string
  /** Prefer a camera that shows the wings / car clearly. */
  cam?: "chase" | "tv" | "heli" | "onboard"
}

const L = ENGINE_START + BURNOUT

/**
 * Each mode: show it + say it immediately, then hold so you can watch.
 * No silent “look first” gap — that made the radio feel late.
 */
export const TOUR_PHASES: TourPhase[] = [
  {
    until: ENGINE_START,
    ers: 0,
    title: "Systems lap",
    hint: "Watch the car and the panel — one idea at a time",
    say: "Systems lap. Watch the car and the panel. One idea at a time.",
    cam: "chase",
  },
  {
    until: L,
    aero: "straight",
    ers: 0.1,
    batteryRate: 0,
    title: "Tyre heat",
    hint: "Rears spinning up before the launch",
    say: "Burnout. Heat in the rear tyres.",
    cam: "chase",
  },

  // ── 1. Straight Mode — wings OPEN ───────────────────────────────────────────────
  {
    until: L + 11,
    aero: "straight",
    ers: 0.4,
    batteryRate: -0.015,
    title: "1 · Straight Mode",
    hint: "Wings opening on the car — less drag, more top speed",
    focus: "aero",
    say: "Straight Mode. Watch the wings open. Less drag on the straight.",
    cam: "tv",
  },

  // ── 2. Corner Mode — wings CLOSED ─────────────────────────────────────────────
  {
    until: L + 22,
    aero: "corner",
    ers: 0.08,
    batteryRate: 0.025,
    title: "2 · Corner Mode",
    hint: "Wings closing — more downforce, more grip",
    focus: "aero",
    say: "Corner Mode. Watch the wings close. More grip for the corner.",
    cam: "tv",
  },

  // ── 3. Battery harvest ───────────────────────────────────────────────────
  {
    until: L + 33,
    aero: "corner",
    ers: 0.05,
    batteryRate: 0.065,
    title: "3 · Battery",
    hint: "Battery climbing — energy harvested under braking",
    focus: "battery",
    say: "Battery. Braking puts energy back in. That's harvest.",
    cam: "chase",
  },

  // ── 4. Overtake ──────────────────────────────────────────────────────────
  {
    until: L + 44,
    aero: "straight",
    ers: 1,
    batteryRate: -0.085,
    boosting: true,
    title: "4 · Overtake",
    hint: "Spending battery for a burst — Space in a race",
    focus: "ers",
    say: "Overtake. We spend that battery for a burst of speed. In a race, hold Space.",
    cam: "heli",
  },

  {
    until: DRIVE_TOUR - 5,
    aero: "corner",
    ers: 0.2,
    batteryRate: 0.02,
    title: "Recap",
    hint: "X/Z = wings · Battery = harvest · Overtake = spend",
    say: "So: X and Z are the wings. The battery stores energy. Overtake spends it.",
    cam: "chase",
  },
  {
    until: DRIVE_TOUR,
    aero: "corner",
    ers: 0.15,
    title: "Done",
    hint: "Ask Lena in the garage if you want any of that again",
    say: "Back to the garage. Ask me if you want any of that again.",
    cam: "chase",
  },
]

export function phaseAt(t: number): TourPhase | null {
  for (const p of TOUR_PHASES) if (t < p.until) return p
  return null
}

export function phaseIndex(t: number): number {
  return TOUR_PHASES.findIndex((p) => t < p.until)
}

/** Lines to prefetch so speech starts with the HUD, not after a TTS wait. */
export const TOUR_LINES = TOUR_PHASES.map((p) => p.say).filter(Boolean) as string[]
