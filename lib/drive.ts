// Shared telemetry for drive mode. The 3D scene writes it every frame and the
// HUD reads it on a timer, so neither re-renders React on every frame.
export type AeroMode = "straight" | "corner"

export const telemetry = {
  speed: 0, // km/h
  aero: "corner" as AeroMode,
  ers: 0, // 0..1 electrical deployment
  braking: 0, // 0..1
  steer: 0, // radians at the front wheels
  distance: 0, // metres travelled, drives the road scroll
}

const LAP = 9 // seconds: a straight, a braking zone, a corner, then repeat

// A scripted lap segment that shows off 2026 active aero: low-drag straight-line
// mode with full electrical deployment, then high-downforce corner mode.
export function stepTelemetry(t: number, dt: number) {
  const phase = t % LAP
  let speed: number
  if (phase < 4.5) {
    telemetry.aero = "straight"
    speed = 190 + (330 - 190) * Math.min(1, phase / 4.5) ** 0.7
    telemetry.ers = 0.75 + 0.25 * Math.sin(t * 9) * 0.2
    telemetry.braking = 0
    telemetry.steer = 0
  } else if (phase < 5.7) {
    telemetry.aero = "corner"
    const k = (phase - 4.5) / 1.2
    speed = 330 - (330 - 120) * k
    telemetry.ers = 0
    telemetry.braking = 1 - k * 0.4
    telemetry.steer = 0.05 * k
  } else {
    telemetry.aero = "corner"
    const k = (phase - 5.7) / (LAP - 5.7)
    speed = 120 + 70 * k
    telemetry.ers = 0.2 * k
    telemetry.braking = 0
    telemetry.steer = 0.16 * Math.sin(Math.PI * Math.min(1, k * 1.3))
  }
  telemetry.speed = speed
  telemetry.distance += (speed / 3.6) * dt
}
