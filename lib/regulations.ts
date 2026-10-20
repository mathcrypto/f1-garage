// Headline FIA rule changes. The agent fetches anything newer from fia.com.
export type Regulation = { title: string; body: string; parts: string[] }

export const REGULATIONS_2026: Regulation[] = [
  {
    title: "Active aerodynamics replace DRS",
    body: "Front and rear wing flaps switch between a high-downforce cornering mode and a low-drag straight-line mode.",
    parts: ["front-wing", "rear-wing"],
  },
  {
    title: "Roughly 50/50 power split",
    body: "The MGU-H is removed, the MGU-K rises to 350 kW, and electric power makes up about half of the total output.",
    parts: ["power-unit"],
  },
  {
    title: "Overtake mode",
    body: "A car close behind gets extra electrical energy to deploy, the new overtaking aid.",
    parts: ["power-unit", "rear-wing"],
  },
  {
    title: "Smaller, lighter cars",
    body: "Shorter wheelbase, narrower body and narrower tyres, with a lower minimum weight than 2025.",
    parts: ["cockpit", "front-tyres", "rear-tyres"],
  },
  {
    title: "Less ground effect",
    body: "Flatter floor and smaller diffuser cut downforce and reduce the 'porpoising' sensitivity of 2022–2025 cars.",
    parts: ["floor", "diffuser"],
  },
  {
    title: "100% sustainable fuel",
    body: "Power units run on fully sustainable fuel.",
    parts: ["power-unit"],
  },
  {
    title: "Stronger safety structures",
    body: "Tougher front impact, side intrusion and roll hoop tests.",
    parts: ["nose", "cockpit"],
  },
]
