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
}

// Drive mode opens with a burnout: car held on the brakes, rear tyres spinning
// up and smoking, then a standing start.
export const BURNOUT = 2.2
