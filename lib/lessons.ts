import type { CameraPreset, Highlight, ViewMode } from "./store"

// Guided explanations. Each step is something Lena says plus what the 3D car
// should do while she says it. Figures are from the FIA's 2026 regulations.
export type LessonStep = {
  say: string
  part?: string | null
  highlights?: Highlight[]
  mode?: ViewMode
  exploded?: boolean
  camera?: CameraPreset
  flow?: boolean
  technical?: boolean
}
export type Lesson = { id: string; title: string; summary: string; steps: LessonStep[] }

export const LESSONS: Lesson[] = [
  {
    id: "aero-basics",
    title: "How an F1 car makes downforce",
    summary: "Wings, the floor, and why grip costs drag.",
    steps: [
      { say: "Let's talk aerodynamics. An F1 car is an upside-down aeroplane: instead of lifting off, it uses the air to push itself into the track. That push is called downforce.", part: null, camera: "side", flow: true, mode: "studio", exploded: false },
      { say: "Watch the airflow. Blue is slow air, red is fast. Where air speeds up, its pressure drops, and the car is sucked toward that low pressure.", flow: true, camera: "hero" },
      { say: "The front wing is the first thing the air meets. Its stacked elements make front downforce, and just as importantly they steer the air around the front tyres, whose wake would ruin the airflow behind.", part: "front-wing", highlights: [{ id: "front-wing", note: "First contact: front downforce and wake control" }] },
      { say: "The biggest contributor is hidden underneath: the floor. Air is accelerated under the car, pressure drops, and the whole car is pulled down without needing a big wing.", part: "floor", highlights: [{ id: "floor", note: "Largest share of downforce" }] },
      { say: "At the back, the rear wing and beam wing add rear grip and help pull air out of the diffuser. More wing angle means more grip in corners, but more drag on the straights.", part: "rear-wing", highlights: [{ id: "rear-wing", note: "Rear grip and stability" }, { id: "beam-wing", note: "Links diffuser and rear wing flow" }, { id: "diffuser", note: "Expands the underfloor flow" }] },
      { say: "That trade-off is the whole game. For 2026 the FIA cut downforce by about thirty percent and drag by about fifty-five percent, so the cars are lighter on aero and quicker on the straights.", part: null, highlights: [], technical: true, camera: "top" },
      { say: "That's aerodynamics in one lap. Ask me about any part and I'll take it off the car for you.", technical: false, flow: false, camera: "hero" },
    ],
  },
  {
    id: "ground-effect",
    title: "Ground effect and the floor",
    summary: "Venturi tunnels, sealing the edges, porpoising.",
    steps: [
      { say: "Ground effect is the floor working like a venturi: a channel that narrows, so the air flowing through it speeds up and its pressure drops.", part: "floor", flow: true, camera: "side" },
      { say: "The closer the floor runs to the track, the stronger the effect. That's why teams want the car low and stiff, and why ride height is so critical.", part: "floor", highlights: [{ id: "floor", note: "Ride height sensitive" }] },
      { say: "The floor edges are cut and curled to create vortices that seal the underfloor, keeping outside air from leaking in and spoiling the low pressure.", part: "floor", highlights: [{ id: "floor", note: "Edges seal the underfloor" }] },
      { say: "At the back, the diffuser lets that fast air slow down and expand smoothly, which keeps the pressure under the car low.", part: "diffuser", highlights: [{ id: "diffuser", note: "Controlled expansion" }] },
      { say: "Run too low and the flow can stall, the car lifts, the flow reattaches, and it slams down again. That bouncing is porpoising, the headache of the 2022 to 2025 cars.", part: null, highlights: [{ id: "floor", note: "Stall, lift, repeat: porpoising" }] },
      { say: "For 2026 the floor is flatter with a smaller diffuser, so it makes less of its downforce from ground effect and the cars are less sensitive to ride height.", highlights: [], flow: false, camera: "hero" },
    ],
  },
  {
    id: "active-aero",
    title: "Active aero: X-mode and Z-mode",
    summary: "Moving wings replace DRS in 2026.",
    steps: [
      { say: "In 2026 both wings move. Let's go for a drive so you can see it.", mode: "drive", part: null, camera: "chase" },
      { say: "In the corners the car runs in Z-mode: the wing flaps are closed for maximum downforce and grip.", highlights: [{ id: "front-wing", note: "Z-mode: flaps closed" }, { id: "rear-wing", note: "Z-mode: flaps closed" }] },
      { say: "On the straights the driver switches to X-mode: the flaps open, drag drops, and top speed goes up. Watch the HUD flip between the two.", highlights: [{ id: "front-wing", note: "X-mode: flaps open" }, { id: "rear-wing", note: "X-mode: flaps open" }] },
      { say: "This replaces DRS. Instead of a wing slot only for the attacking car, every driver uses low-drag mode on the straights. To help overtaking, a car close behind gets extra electrical energy in overtake mode.", highlights: [{ id: "power-unit", note: "Overtake mode: extra energy" }] },
      { say: "So the 2026 overtake is less about a wing flap and more about energy management.", highlights: [], mode: "studio", camera: "hero" },
    ],
  },
  {
    id: "power-unit",
    title: "The 2026 power unit",
    summary: "V6 turbo, 350 kW MGU-K, and a 50/50 split.",
    steps: [
      { say: "Let me lift the engine cover. Under here is the power unit: a one point six litre V6 turbo hybrid.", part: "power-unit", camera: "hero" },
      { say: "The big change for 2026: the MGU-H, which recovered energy from the turbo, is gone. In its place, the MGU-K on the crankshaft is almost three times stronger, up to three hundred and fifty kilowatts.", part: "power-unit", highlights: [{ id: "power-unit", note: "MGU-K up to 350 kW, no MGU-H" }] },
      { say: "That makes the power split roughly fifty-fifty between the combustion engine and electricity. The battery can recover up to eight point five megajoules per lap under braking.", part: "power-unit", highlights: [{ id: "power-unit", note: "≈50/50 electric and combustion" }] },
      { say: "Watch the energy bar while we drive: harvesting in the braking zones, deploying on the straights. Managing that energy now decides lap times and overtakes.", mode: "drive", part: null, highlights: [], camera: "chase" },
      { say: "And the fuel is one hundred percent sustainable. Same noise, new chemistry.", mode: "studio", camera: "hero" },
    ],
  },
  {
    id: "tyres-brakes",
    title: "Tyres and brakes",
    summary: "Narrower 18-inch tyres and 1000 °C carbon brakes.",
    steps: [
      { say: "The tyres are the only thing touching the track. For 2026 they're still on eighteen inch rims, but the fronts are twenty-five millimetres narrower and the rears thirty.", part: "front-tyres", highlights: [{ id: "front-tyres", note: "25 mm narrower" }, { id: "rear-tyres", note: "30 mm narrower" }] },
      { say: "A tyre only grips inside a narrow temperature window. Too cold and it slides, too hot and it degrades. Most of a race engineer's radio calls are about that window.", part: "rear-tyres" },
      { say: "Inside each wheel are carbon brake discs that run at over a thousand degrees. The brake ducts cool them, and also blow heat into the rim to manage tyre temperature.", part: "front-tyres", highlights: [{ id: "front-tyres", note: "Ducts cool brakes and tune tyre temps" }] },
      { say: "At the rear, braking is shared with the MGU-K, which recovers energy while slowing the car. Brake-by-wire blends the two so the driver feels a consistent pedal.", part: "rear-tyres", highlights: [{ id: "rear-tyres", note: "Shared with energy recovery" }], mode: "drive", camera: "chase" },
      { say: "See the discs glowing in the braking zones? That's a few hundred kilowatts turning into heat and electricity.", mode: "studio", part: null, highlights: [], camera: "hero" },
    ],
  },
  {
    id: "suspension",
    title: "Suspension and the aero platform",
    summary: "Why the suspension is really an aero part.",
    steps: [
      { say: "F1 suspension isn't mainly about comfort. Its real job is to hold the car at the right height and attitude so the aerodynamics work. We call that the aero platform.", part: "front-suspension", camera: "front" },
      { say: "Wishbones locate the wheel, and a push rod or pull rod transfers the load to springs and dampers inside the chassis.", part: "front-suspension", highlights: [{ id: "front-suspension", note: "Wishbones and push rod" }] },
      { say: "The arms are shaped like small wings, so they also guide the airflow. At the back, the suspension mounts on the gearbox casing.", part: "rear-suspension", highlights: [{ id: "rear-suspension", note: "Mounted on the gearbox" }] },
      { say: "Teams tune anti-dive and anti-squat geometry so the nose doesn't drop too much under braking. Too much movement and the floor loses its seal.", part: null, highlights: [{ id: "floor", note: "Needs a stable platform" }], camera: "side" },
      { say: "So when someone says a car has a great platform, they mean the suspension keeps the aero happy.", highlights: [], camera: "hero" },
    ],
  },
]

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id)
