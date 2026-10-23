// Headline FIA rule changes plus short chapters for Lena's handbook.
// Anything newer (TDs, Document-38) still comes from fia.com via web_search.

export type Regulation = {
  id: string
  title: string
  body: string
  detail: string
  parts: string[]
}

export const REGULATIONS_2026: Regulation[] = [
  {
    id: "active-aero",
    title: "Active aerodynamics replace DRS",
    body: "Front and rear wing flaps switch between a high-downforce cornering mode and a low-drag straight-line mode.",
    detail:
      "In Z-mode (corners) the flaps stay closed for grip. In X-mode (straights) they open to cut drag. Unlike old DRS, both cars can use the system when the rules allow — overtaking help now comes more from energy (overtake mode) than from a one-car rear-wing slot. Teams spend a lot of development time on how fast the flaps move and how the car feels at the switch.",
    parts: ["front-wing", "rear-wing"],
  },
  {
    id: "power-split",
    title: "Roughly 50/50 power split",
    body: "The MGU-H is removed, the MGU-K rises to 350 kW, and electric power makes up about half of the total output.",
    detail:
      "The combustion engine is still a 1.6 L V6 turbo, but without the MGU-H the hybrid is simpler and much more electric. Drivers feel a big hit of torque from the MGU-K; race engineers manage battery charge like a second fuel tank. Deployment maps and harvest under braking decide both lap time and how long you can attack.",
    parts: ["power-unit"],
  },
  {
    id: "overtake-mode",
    title: "Overtake mode",
    body: "A car close behind gets extra electrical energy to deploy, the new overtaking aid.",
    detail:
      "When you are within the activation window of the car ahead, the rules give you extra deployable energy for a push. It replaces the old DRS 'free pass' idea with a hybrid boost. From the pit wall you hear 'overtake mode available' — then it is down to battery state, slipstream and bravery into the braking zone.",
    parts: ["power-unit", "rear-wing"],
  },
  {
    id: "smaller-cars",
    title: "Smaller, lighter cars",
    body: "Shorter wheelbase, narrower body and narrower tyres, with a lower minimum weight than 2025.",
    detail:
      "Maximum wheelbase drops to about 3400 mm and overall width to 1900 mm. Narrower 18-inch tyres cut grip and visual bulk. The aim is cars that are easier to follow and more agile in traffic, at the cost of some absolute corner speed versus the 2022–2025 ground-effect generation.",
    parts: ["cockpit", "front-tyres", "rear-tyres"],
  },
  {
    id: "less-ground-effect",
    title: "Less ground effect",
    body: "Flatter floor and smaller diffuser cut downforce and reduce the 'porpoising' sensitivity of 2022–2025 cars.",
    detail:
      "The deep tunnels of the previous era are dialled back. Floors still matter hugely, but ride-height sensitivity falls, so cars should bounce less and follow more closely. Teams still fight over millimetres of edge fence and seal — just with a different starting point.",
    parts: ["floor", "diffuser"],
  },
  {
    id: "sustainable-fuel",
    title: "100% sustainable fuel",
    body: "Power units run on fully sustainable fuel.",
    detail:
      "The fuel must meet FIA sustainability criteria while still delivering the energy density a V6 turbo needs. Combustion maps, knock limits and reliability all shift slightly versus fossil fuels — another reason early-season PU software updates matter.",
    parts: ["power-unit"],
  },
  {
    id: "safety",
    title: "Stronger safety structures",
    body: "Tougher front impact, side intrusion and roll hoop tests.",
    detail:
      "The nose uses a two-stage front impact structure so it is less likely to detach in a heavy shunt. Halo and roll-hoop load tests are tougher. Safety upgrades rarely look dramatic on camera, but they constrain how nose and cockpit aero can be shaped.",
    parts: ["nose", "cockpit"],
  },
  {
    id: "movable-aero-rules",
    title: "When active aero may move",
    body: "Flap movement is controlled by the sporting and technical regulations — not free whenever the driver wants.",
    detail:
      "X-mode and Z-mode switch under defined conditions (straight-line zones, speed, and safety overrides). Race control can force a mode for wet or incident cover. Engineers brief drivers on where the car will open and close so braking points stay consistent.",
    parts: ["front-wing", "rear-wing"],
  },
  {
    id: "energy-budget",
    title: "Energy budget per lap",
    body: "How much electrical energy you can harvest and deploy each lap is capped — managing it is a core race skill.",
    detail:
      "With a much stronger MGU-K, the limit is less 'can we make power?' and more 'when do we spend it?'. Lift-and-coast, overtake mode, and defending all burn the same budget. Lena’s race radio often comes down to battery percent and mode calls.",
    parts: ["power-unit", "rear-tyres"],
  },
  {
    id: "following",
    title: "Easier following, still hard racing",
    body: "Less dirty air from reduced downforce and active aero should help cars stay closer — strategy and battery still decide the pass.",
    detail:
      "The regulation package aims at closer racing: smaller wakes, overtake mode, and cars that lose less load in dirty air. It does not remove skill — tyre prep, traffic, and hybrid discipline still separate a good lap from a great one.",
    parts: ["floor", "rear-wing", "power-unit"],
  },
]

export const regulationById = (id: string) => REGULATIONS_2026.find((r) => r.id === id || r.title === id)

export function formatRegulation(r: Regulation): string {
  return `**${r.title}** (${r.id})\n${r.body}\n\nDetail: ${r.detail}\nLinked parts: ${r.parts.join(", ")}`
}
