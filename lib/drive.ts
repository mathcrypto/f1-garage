// Telemetry of the car being followed on track (drive or race). The 3D scene writes it every frame and the
// HUD reads it on a timer, so neither re-renders React on every frame.
export type AeroMode = "straight" | "corner"

export const telemetry = {
  speed: 0, // km/h
  aero: "corner" as AeroMode,
  ers: 0, // 0..1 electrical deployment
  braking: 0, // 0..1
  steer: 0, // radians at the front wheels
  wheelspin: 0, // 0..1 rear wheelspin: full during the burnout, fading through the launch
  throttle: 0, // 0..1
}

// Drive mode opens with a burnout: car held on the brakes, rear tyres spinning
// up and smoking, then a standing start.
export const BURNOUT = 2.2
// Free-drive lap timing, read by the engineer's radio.
export const driveLaps = { lap: 0, last: null as number | null, best: null as number | null, start: null as number | null, s: 0 }

// Before that, the engine is fired up with the car standing still.
export const ENGINE_START = 3.2

// 8-speed gearbox: up at about 11,900 rpm, landing near 10,300.
const TOPS = [95, 135, 170, 205, 240, 272, 302, 340] // km/h at the top of each gear
export function gearbox(speed: number, wheelspin: number, throttle: number, t: number) {
  let gear = TOPS.findIndex((top) => speed < top)
  if (gear < 0) gear = 7
  const lo = gear === 0 ? 0 : TOPS[gear - 1]
  const k = Math.min(1, Math.max(0, (speed - lo) / (TOPS[gear] - lo)))
  let rpm = gear === 0 ? 4500 + k * 7400 : 10300 + k * 1600
  const idle = speed < 7 && wheelspin < 0.1
  if (idle) rpm = 4300 + Math.sin(t * 9) * 80 + throttle * 6000
  if (wheelspin > 0.5 && speed < 80) rpm = 11500 + Math.sin(t * 29) * 250
  return { gear: idle ? 0 : gear + 1, rpm, idle, index: gear }
}
