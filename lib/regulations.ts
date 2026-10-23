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
      "In Corner Mode the flaps stay closed for grip. In Straight Mode, on the straights, they open to cut drag. Unlike old DRS, both cars can use the system when the rules allow — overtaking help now comes more from energy (overtake mode) than from a one-car rear-wing slot.",
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
      "A driver can use Overtake Mode when they are within one second of the car ahead at the detection point. It gives extra electrical deployment instead of the old DRS rear-wing slot. Whether the pass sticks then comes down to battery charge, slipstream and braking.",
    parts: ["power-unit", "rear-wing"],
  },
  {
    id: "smaller-cars",
    title: "Smaller, lighter cars",
    body: "Shorter wheelbase, narrower body and narrower tyres, with a lower minimum weight than 2025.",
    detail:
      "Maximum wheelbase drops from 3600 mm to 3400 mm and overall width from 2000 mm to 1900 mm. The floor is 150 mm narrower and the front wing 100 mm narrower. The tyres stay on 18-inch rims but are 25 mm narrower at the front and 30 mm at the rear. The minimum mass is 724 kg plus the tyres, about 770 kg, down from 800 kg.",
    parts: ["cockpit", "front-tyres", "rear-tyres"],
  },
  {
    id: "less-ground-effect",
    title: "Less ground effect",
    body: "Flatter floor and smaller diffuser cut downforce and reduce the 'porpoising' sensitivity of 2022–2025 cars.",
    detail:
      "The 2026 rules reduce ground effect with a flatter floor than the 2022–2025 cars. The floor is still the most upgraded part on the grid this season: almost every team has declared floor changes to the FIA.",
    parts: ["floor", "diffuser"],
  },
  {
    id: "sustainable-fuel",
    title: "100% sustainable fuel",
    body: "Power units run on fully sustainable fuel.",
    detail:
      "From 2026 the power units run on 100% sustainable fuel that must meet the FIA's sustainability criteria.",
    parts: ["power-unit"],
  },
  {
    id: "safety",
    title: "Stronger safety structures",
    body: "Two-stage front impact structure, stronger roll hoop and side intrusion protection.",
    detail:
      "The nose uses a two-stage front impact structure so it is less likely to detach in a heavy crash. Roll hoop loads rise from 16g to 20g, side intrusion protection around the cockpit increases, and the protection beside the fuel cell more than doubles.",
    parts: ["nose", "cockpit"],
  },
  {
    id: "movable-aero-rules",
    title: "When active aero may move",
    body: "Flap movement is controlled by the sporting and technical regulations — not free whenever the driver wants.",
    detail:
      "Straight Mode and Corner Mode switch under defined conditions (straight-line zones, speed, and safety overrides). Race control can force a mode for wet or incident cover. Engineers brief drivers on where the car will open and close so braking points stay consistent.",
    parts: ["front-wing", "rear-wing"],
  },
  {
    id: "energy-budget",
    title: "Energy budget per lap",
    body: "How much electrical energy you can harvest and deploy each lap is capped — managing it is a core race skill.",
    detail:
      "The battery can recover up to 8.5 MJ per lap, and the MGU-K deploys up to 350 kW. Attacking with Overtake Mode and defending use the same energy, so when to spend it matters as much as how much there is.",
    parts: ["power-unit", "rear-tyres"],
  },
  {
    id: "following",
    title: "Easier following, still hard racing",
    body: "The FIA designed the rules for closer racing: less downforce, active aero and Overtake Mode.",
    detail:
      "The FIA's aim is cars that lose less performance when following another car, combining reduced downforce, active aero and Overtake Mode's extra energy within one second of the car ahead.",
    parts: ["floor", "rear-wing", "power-unit"],
  },
]

export const regulationById = (id: string) => REGULATIONS_2026.find((r) => r.id === id || r.title === id)

export function formatRegulation(r: Regulation): string {
  return `**${r.title}** (${r.id})\n${r.body}\n\nDetail: ${r.detail}\nLinked parts: ${r.parts.join(", ")}`
}
