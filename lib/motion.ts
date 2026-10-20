import type { AeroMode } from "./drive"

// How a car is moving right now. The studio car has none (it stands still);
// the driven car and every race car provide their own.
export type Motion = {
  speed: number // km/h
  wheelspin: number // 0..1
  braking: number // 0..1
  steer: number // radians at the front wheels
  aero: AeroMode
  ers: number // 0..1
}

export const IDLE: Motion = { speed: 0, wheelspin: 0, braking: 0, steer: 0, aero: "corner", ers: 0 }
export const newMotion = (): Motion => ({ ...IDLE })
