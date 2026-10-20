// Every clickable component of the car. `id` is shared by the SVG, the side
// panel and the agent's highlight_parts tool, so keep it stable.
export type Part = {
  id: string
  name: string
  system: "Aerodynamics" | "Chassis" | "Suspension" | "Power unit" | "Tyres & brakes"
  summary: string
  howItWorks: string
  regulation2026: string
  watchFor: string
  // Key figures, from the FIA 2026 technical regulations where a rule sets them.
  specs: [string, string][]
}

export const PARTS: Part[] = [
  {
    id: "front-wing",
    name: "Front wing",
    system: "Aerodynamics",
    summary: "The first surface the air meets. It makes front downforce and sets up the airflow for the rest of the car.",
    howItWorks:
      "Stacked elements turn air upward so the wing is pushed down. Just as important is the wake: the endplates and flap tips steer air around the front tyres, whose turbulent wake would otherwise pollute the floor.",
    regulation2026:
      "2026 wings are narrower and use active aerodynamics: the flaps open on straights (low-drag mode) and close for corners (high-downforce mode), replacing DRS as the drag-reduction tool.",
    watchFor: "New endplate shapes and flap profiles are the most common upgrade. Teams tune them to change balance between front and rear.",
    specs: [["Elements", "Multi-element, with active flaps"], ["Modes", "Z-mode (corner) / X-mode (straight)"], ["Replaces", "DRS as the drag-reduction tool"]],
  },
  {
    id: "nose",
    name: "Nose & crash structure",
    system: "Chassis",
    summary: "Holds the front wing and absorbs energy in a frontal crash.",
    howItWorks:
      "The nose is a homologated crash structure. Its length and height decide how much air reaches the floor and how the front wing is mounted.",
    regulation2026: "Crash tests got tougher for 2026, with a two-stage front impact structure to reduce the chance of the nose detaching.",
    watchFor: "A new nose means a new crash test, so teams change it rarely and usually with a big aero package.",
    specs: [["Structure", "Homologated front impact structure"], ["2026 change", "Two-stage crash structure"], ["Materials", "Carbon-fibre composite"]],
  },
  {
    id: "front-suspension",
    name: "Front suspension",
    system: "Suspension",
    summary: "Links the wheels to the chassis and controls ride height, which the floor is very sensitive to.",
    howItWorks:
      "Wishbones locate the wheel; push-rod or pull-rod layouts send loads to springs and dampers inside the chassis. The arms are shaped like small wings, so they also guide air.",
    regulation2026: "Wishbone fairings and suspension geometry rules were reworked alongside the smaller 2026 car.",
    watchFor: "Changes to anti-dive geometry or arm fairings: they affect both handling under braking and aero stability.",
    specs: [["Layout", "Double wishbone, push or pull rod"], ["Arms", "Aerofoil-section carbon wishbones"], ["Job", "Holds the aero platform steady"]],
  },
  {
    id: "cockpit",
    name: "Cockpit & halo",
    system: "Chassis",
    summary: "The survival cell around the driver, topped by the titanium halo.",
    howItWorks:
      "The monocoque is a carbon-fibre tub that every other part bolts to. The halo protects the driver's head from debris and impacts and can carry the weight of a double-decker bus.",
    regulation2026: "The halo and roll hoop load tests were strengthened for 2026.",
    watchFor: "Small aero fairings on the halo and mirror stays are frequent, cheap upgrades.",
    specs: [["Survival cell", "Carbon-fibre monocoque"], ["Halo", "Titanium, strengthened for 2026"], ["Car + driver mass", "722 kg minimum"]],
  },
  {
    id: "sidepods",
    name: "Sidepods & radiators",
    system: "Aerodynamics",
    summary: "House the radiators and shape the airflow along the side of the car toward the rear.",
    howItWorks:
      "The inlet feeds the cooling system; the external shape (downwash, undercut) guides air to the back of the floor and the beam wing. Cooling and aero always trade off.",
    regulation2026: "The 2026 power unit rejects more heat into the electrical system, so cooling layouts were reshuffled across the grid.",
    watchFor: "Sidepod reshapes are among the biggest visible upgrades, often paired with a new floor.",
    specs: [["Contents", "Radiators and coolers"], ["Shaping", "Downwash and undercut to the floor"], ["Trade-off", "Cooling versus drag"]],
  },
  {
    id: "floor",
    name: "Floor & edges",
    system: "Aerodynamics",
    summary: "Makes a large share of the car's downforce from the air moving underneath it.",
    howItWorks:
      "Air accelerated under the car drops in pressure, sucking the car to the track. The edges are cut and curled to seal the underfloor from outside air.",
    regulation2026:
      "2026 moves away from the full ground-effect tunnels of 2022–2025 toward a flatter floor with a smaller diffuser, cutting downforce and making the cars less ride-height sensitive.",
    watchFor: "Floor edges change almost every few races: they are the most powerful and most frequently updated aero part.",
    specs: [["Concept", "Flatter floor, less ground effect"], ["Downforce (whole car)", "≈30% less than 2025"], ["Ride height", "Less sensitive than 2022–2025"]],
  },
  {
    id: "engine-cover",
    name: "Engine cover & airbox",
    system: "Aerodynamics",
    summary: "Covers the power unit and feeds air to the engine through the inlet above the driver's head.",
    howItWorks:
      "The airbox delivers air to the combustion engine. The cover's shape and cooling exits change how much drag the car makes and how clean the air is that reaches the rear wing.",
    regulation2026: "Packaging changed with the new power unit and its bigger battery.",
    watchFor: "Tighter 'coke-bottle' tapering at the rear and new cooling gills or louvres.",
    specs: [["Covers", "Power unit and energy store"], ["Airbox", "Feeds the combustion engine"], ["Exits", "Cooling louvres and tail outlet"]],
  },
  {
    id: "power-unit",
    name: "Power unit",
    system: "Power unit",
    summary: "The 1.6 L V6 turbo hybrid. From 2026, power is split roughly 50/50 between combustion and electric.",
    howItWorks:
      "The combustion engine runs on fuel; the MGU-K recovers energy under braking into the battery and redeploys it as up to 350 kW of electric power.",
    regulation2026:
      "The MGU-H is gone, the MGU-K is almost three times stronger, and the fuel is 100% sustainable. Energy management now decides lap times and overtakes.",
    watchFor: "Power units are homologated, so upgrades are rare and tightly regulated; reliability fixes and software are where most gains come from.",
    specs: [["Engine", "1.6 L V6 turbo hybrid"], ["MGU-K", "Up to 350 kW (was 120 kW)"], ["MGU-H", "Removed for 2026"], ["Power split", "≈50% electric, 50% combustion"], ["Energy recovery", "Up to 8.5 MJ per lap"], ["Fuel", "100% sustainable"]],
  },
  {
    id: "rear-suspension",
    name: "Rear suspension & gearbox",
    system: "Suspension",
    summary: "Carries the rear wheels and transmits power through the 8-speed gearbox.",
    howItWorks:
      "The gearbox casing doubles as the mounting point for the rear suspension. Its geometry controls how the car squats under acceleration, which matters for the floor and diffuser.",
    regulation2026: "Gearboxes remain 8-speed, with a constrained design cycle to limit costs.",
    watchFor: "Suspension fairings that help guide air to the diffuser.",
    specs: [["Mounting", "On the gearbox casing"], ["Gearbox", "8 forward gears"], ["Tuning", "Anti-squat geometry"]],
  },
  {
    id: "diffuser",
    name: "Diffuser",
    system: "Aerodynamics",
    summary: "The upswept exit at the back of the floor that expands the airflow and helps extract downforce.",
    howItWorks: "By slowing and expanding the air leaving the floor, the diffuser keeps underfloor pressure low.",
    regulation2026: "Smaller and simpler for 2026, part of the overall downforce reduction.",
    watchFor: "Usually updated together with the floor.",
    specs: [["Job", "Expands the underfloor flow"], ["2026 change", "Smaller than 2022–2025"], ["Works with", "Floor and beam wing"]],
  },
  {
    id: "beam-wing",
    name: "Beam wing",
    system: "Aerodynamics",
    summary: "The small wing between the diffuser and rear wing.",
    howItWorks: "It links the diffuser and rear wing flows, helping both work harder. Teams swap it for low or high downforce tracks.",
    regulation2026: "The 2026 rear-end rules change the beam wing's role in the overall package.",
    watchFor: "Track-specific beam wing choices, especially for high-speed circuits like Monza or Las Vegas.",
    specs: [["Position", "Between diffuser and rear wing"], ["Job", "Links diffuser and rear wing flow"], ["Swapped for", "Low- or high-downforce tracks"]],
  },
  {
    id: "rear-wing",
    name: "Rear wing (active aero)",
    system: "Aerodynamics",
    summary: "Makes rear downforce for cornering stability and, in 2026, opens on straights to cut drag.",
    howItWorks: "Like the front wing, it turns air upward. More angle means more grip in corners but more drag on straights.",
    regulation2026:
      "DRS is replaced by active aero: front and rear wing flaps move between a cornering mode and a low-drag straight-line mode. A separate 'overtake mode' gives the following car extra electrical energy.",
    watchFor: "Low-drag 'skinny' rear wings for fast tracks and the mechanisms that actuate the flaps.",
    specs: [["Modes", "Z-mode (corner) / X-mode (straight)"], ["Drag (whole car)", "≈55% less than 2025"], ["Overtaking", "Overtake mode gives extra energy"]],
  },
  {
    id: "front-tyres",
    name: "Front tyres & brakes",
    system: "Tyres & brakes",
    summary: "Pirelli 18-inch tyres and carbon brakes. The brake ducts also manage tyre temperature.",
    howItWorks:
      "Carbon discs work at over 1000 °C. Brake ducts cool them and blow heat into the wheel rim to keep the tyres in their working window.",
    regulation2026: "Tyres stay 18-inch but are narrower in 2026 to match the lighter, smaller car.",
    watchFor: "New brake duct and drum designs: small, but they change tyre warm-up and degradation.",
    specs: [["Rim", "18-inch"], ["Width", "25 mm narrower than 2025"], ["Diameter", "≈15 mm smaller"], ["Brakes", "Carbon-carbon, over 1000 °C"]],
  },
  {
    id: "rear-tyres",
    name: "Rear tyres & brakes",
    system: "Tyres & brakes",
    summary: "The driven wheels. Rear brakes are shared with the MGU-K, which recovers energy while slowing the car.",
    howItWorks: "A brake-by-wire system balances friction braking and energy recovery so the driver feels a consistent pedal.",
    regulation2026: "With much stronger energy recovery, brake-by-wire calibration is a bigger engineering focus.",
    watchFor: "Rear brake duct and rim upgrades aimed at tyre temperature control.",
    specs: [["Rim", "18-inch"], ["Width", "30 mm narrower than 2025"], ["Diameter", "≈10 mm smaller"], ["Braking", "Shared with MGU-K recovery"]],
  },
]

export const partById = (id: string) => PARTS.find((p) => p.id === id)
export const PART_IDS = PARTS.map((p) => p.id)

// Whole-car figures from the FIA's 2026 regulations.
export const CAR_SPECS: [string, string][] = [
  ["Wheelbase", "3400 mm max (was 3600)"],
  ["Width", "1900 mm max (was 2000)"],
  ["Minimum mass", "768 kg (722 kg car + driver, 46 kg tyres)"],
  ["Downforce", "≈30% less than 2025"],
  ["Drag", "≈55% less than 2025"],
  ["Wheels", "18-inch, narrower tyres"],
]
export const SPEC_SOURCE = { label: "FIA: 2026 Formula 1 regulations", url: "https://fia.com/node/51855" }
