import { PART_IDS } from "./parts"
import { TEAMS, teamById } from "./teams"

// Curated garage development diary: teaching packages that show how 2026 cars
// typically evolve (launch → early races). Not a live Document-38 feed —
// Lena still uses web_search when the user wants confirmed latest news.

export type UpgradePackage = {
  id: string
  teamId: string
  event: string
  title: string
  summary: string
  why: string
  parts: { id: string; note: string }[]
}

function pkg(
  teamId: string,
  id: string,
  event: string,
  title: string,
  summary: string,
  why: string,
  parts: [string, string][],
): UpgradePackage {
  return {
    id: `${teamId}-${id}`,
    teamId,
    event,
    title,
    summary,
    why,
    parts: parts
      .filter(([pid]) => PART_IDS.includes(pid))
      .map(([pid, note]) => ({ id: pid, note })),
  }
}

// Shared patterns every team faces under the 2026 rules, varied by team theme.
const DIARY: UpgradePackage[] = [
  // Ferrari
  pkg("ferrari", "launch", "Launch", "SF-26 launch package",
    "Conservative floor edges with a deep undercut sidepod, aimed at a stable aero platform while the new hybrid map settles in.",
    "Ferrari usually chase a predictable car first, then unlock peak downforce once tyre warm-up and cooling are understood.",
    [["floor", "Sealed edge, stable ride height"], ["sidepods", "Deep undercut for rear"], ["front-wing", "Balanced flap map"]]),
  pkg("ferrari", "bahrain", "Bahrain", "Cooling & floor edge trim",
    "Extra louvres in the engine cover and a trimmed floor fence to free rear grip in hot night races.",
    "Desert heat forces cooling open — Ferrari trade a little drag for tyre life and hybrid reliability.",
    [["engine-cover", "More cooling exits"], ["floor", "Trimmed edge fence"], ["rear-wing", "Slightly taller for traction"]]),
  pkg("ferrari", "imid", "Imola", "Front-wing / floor coupling",
    "New front-wing endplate and matching floor inlet to clean the wake into the sidepod undercut.",
    "Once the rear is stable they add front load without upsetting the diffuser.",
    [["front-wing", "New endplate wake"], ["floor", "Inlet fence tweak"], ["sidepods", "Undercut reshaped"]]),

  // Mercedes
  pkg("mercedes", "launch", "Launch", "W17 slim-sidepod launch",
    "Very tight sidepods and a high-rake-friendly floor philosophy, betting on active-aero efficiency on straights.",
    "Mercedes lean on power-unit energy management and low drag — the package starts skinny and adds load where needed.",
    [["sidepods", "Extreme taper"], ["floor", "Efficiency tunnels"], ["power-unit", "Aggressive deploy map"]]),
  pkg("mercedes", "jeddah", "Jeddah", "Low-drag beam & rear wing",
    "Skinny beam wing and reduced rear-wing chord for the long straights, with brake duct heat management for the fronts.",
    "Street-circuit speed traps punish drag; they give up a little corner load to protect battery and top speed.",
    [["beam-wing", "Low-drag element"], ["rear-wing", "Shorter chord"], ["front-tyres", "Duct heat trim"]]),
  pkg("mercedes", "barcelona", "Barcelona", "Floor fence & suspension fairing",
    "Revised floor edge and front wishbone fairings after Spain’s aero tests, aimed at mid-corner platform.",
    "Barcelona is the classic aero exam — they harden the car for European flyaways.",
    [["floor", "New edge fence"], ["front-suspension", "Arm fairings"], ["diffuser", "Exit strakes"]]),

  // Red Bull
  pkg("redbull", "launch", "Launch", "RB22 aggressive floor launch",
    "Strong floor-edge sealing and a compact coke-bottle rear, chasing peak corner speed from day one.",
    "Red Bull typically bring a sharp aero concept early and refine cooling and tyre windows later.",
    [["floor", "Aggressive edge seal"], ["diffuser", "High extraction"], ["engine-cover", "Tight coke bottle"]]),
  pkg("redbull", "suzuka", "Suzuka", "High-downforce rear package",
    "Taller rear wing, thicker beam wing, and floor fences for the flowing high-speed corners.",
    "Suzuka rewards committed rear load — they accept drag to keep the platform planted.",
    [["rear-wing", "High DF flap"], ["beam-wing", "Thicker element"], ["floor", "Extra fences"]]),
  pkg("redbull", "singapore", "Singapore", "Cooling & front wing for streets",
    "Opened sidepod inlets and a higher-downforce front wing for stop-start street heat.",
    "Singapore is a cooling and traction circuit; peak efficiency packages get shelved.",
    [["sidepods", "Opened inlets"], ["front-wing", "More flap angle"], ["rear-tyres", "Brake duct heat"]]),

  // McLaren
  pkg("mclaren", "launch", "Launch", "MCL40 balanced launch",
    "Even front-rear load with flexible floor edges and a driver-friendly hybrid map.",
    "McLaren’s 2020s pattern: a friendly base car, then big aero steps when correlation is proven.",
    [["floor", "Flexible edge concept"], ["front-wing", "Driver-friendly balance"], ["power-unit", "Smooth deploy"]]),
  pkg("mclaren", "miami", "Miami", "Sidepod & floor step",
    "Reshaped sidepod undercut and a new floor fence package that became the season’s baseline.",
    "Once the tunnel matches the track, they freeze a strong aero step and roll it out everywhere.",
    [["sidepods", "New undercut"], ["floor", "Baseline fence pack"], ["diffuser", "Matched exit"]]),
  pkg("mclaren", "silverstone", "Silverstone", "Low-drag active-aero map",
    "Revised X-mode flap schedule and a thinner rear wing for the Hangar Straight.",
    "Home race: protect top speed while keeping Maggotts–Becketts confidence.",
    [["rear-wing", "Thinner main plane"], ["front-wing", "X-mode schedule"], ["beam-wing", "Low-drag trim"]]),

  // Aston Martin
  pkg("astonmartin", "launch", "Launch", "AMR26 sidepod concept",
    "Distinctive downwash sidepods feeding a wide floor, with Honda hybrid calibration still maturing.",
    "Aston chase a unique airflow path; early races are often about cooling the idea into a raceable car.",
    [["sidepods", "Downwash concept"], ["floor", "Wide inlet"], ["power-unit", "Honda map v1"]]),
  pkg("astonmartin", "monaco", "Monaco", "Max downforce street kit",
    "Largest rear wing of the year, opened cooling, and soft brake ducts for traction out of tight hairpins.",
    "Monaco is a one-off kit — almost every surface goes high-load.",
    [["rear-wing", "Max DF"], ["front-wing", "High flap"], ["sidepods", "Cooling open"]]),
  pkg("astonmartin", "spa", "Spa", "Efficiency floor update",
    "Floor edge and diffuser trim aimed at Eau Rouge stability without killing Kemmel top speed.",
    "Spa forces an honesty check on drag versus high-speed load.",
    [["floor", "Edge for high speed"], ["diffuser", "Stability trim"], ["rear-wing", "Compromise wing"]]),

  // Alpine
  pkg("alpine", "launch", "Launch", "A526 Mercedes-PU integration",
    "New sidepod packaging around the Mercedes power unit, with a simple floor to get kilometres in.",
    "A PU switch year is about reliability and cooling before clever aero.",
    [["sidepods", "PU packaging"], ["power-unit", "Mercedes install"], ["engine-cover", "Cooling first"]]),
  pkg("alpine", "hungar", "Hungary", "High-downforce aero step",
    "Bigger wings and a sealed floor edge for the twisty, low-speed Hungaroring.",
    "Hungary rewards mechanical grip and rear load — a natural second aero step.",
    [["floor", "Sealed edges"], ["rear-wing", "High DF"], ["front-suspension", "Anti-dive tweak"]]),

  // Williams
  pkg("williams", "launch", "Launch", "FW48 clean-sheet aero",
    "Long-sidepod concept with emphasis on straight-line efficiency and a friendly front axle.",
    "Williams build confidence with a predictable nose and wing before chasing peak floor load.",
    [["sidepods", "Long cooling body"], ["front-wing", "Friendly balance"], ["nose", "Stable crash structure"]]),
  pkg("williams", "austin", "Austin", "Floor & beam wing update",
    "New floor fences and beam wing after the Americas flyaway, targeting midfield race pace.",
    "COTA’s mix of sectors is a good proving ground for a second aero kit.",
    [["floor", "New fences"], ["beam-wing", "Race-pace element"], ["diffuser", "Exit clean-up"]]),

  // Racing Bulls
  pkg("racingbulls", "launch", "Launch", "VCARB 03 Red Bull family parts",
    "Shared crash structures and a similar floor philosophy to Red Bull, with its own sidepod surface.",
    "Sister-team years often start close, then diverge once Token / upgrade budgets allow.",
    [["floor", "Family concept"], ["sidepods", "Own surface"], ["nose", "Shared structure"]]),
  pkg("racingbulls", "imola", "Imola", "Front wing divergence",
    "Own front-wing cascade and endplate, stepping away from the early shared spec.",
    "Imola is where they often prove an independent aero direction.",
    [["front-wing", "Own cascade"], ["floor", "Inlet match"], ["sidepods", "Wake tidy"]]),

  // Haas
  pkg("haas", "launch", "Launch", "VF-26 Ferrari-aided launch",
    "Ferrari-linked rear end and a cost-efficient floor, prioritising reliability and tyre warm-up.",
    "Haas typically buy pace through clever correlation and timely, smaller upgrades.",
    [["floor", "Efficient baseline"], ["power-unit", "Ferrari PU"], ["rear-wing", "Shared family cues"]]),
  pkg("haas", "china", "China", "Brake duct & floor edge",
    "New front brake drums and a modest floor edge for the Shanghai layout.",
    "Small, high-ROI parts — classic Haas development rhythm.",
    [["front-tyres", "New drums"], ["floor", "Edge trim"], ["front-wing", "Minor flap"]]),

  // Audi
  pkg("audi", "launch", "Launch", "R26 works-team debut",
    "Conservative aero with heavy instrumentation, learning the 2026 tyre and hybrid window as a new works team.",
    "First year: understand correlation and reliability before chasing radical concepts.",
    [["sidepods", "Instrumented cooling"], ["floor", "Safe platform"], ["power-unit", "Audi hybrid v1"]]),
  pkg("audi", "barcelona", "Barcelona", "First major aero kit",
    "Sidepod undercut and floor package after European testing lessons, the first ‘real’ Audi look.",
    "Once data matches the tunnel, they commit to a visible identity on the car.",
    [["sidepods", "Undercut identity"], ["floor", "First big step"], ["engine-cover", "Tighter rear"]]),

  // Cadillac
  pkg("cadillac", "launch", "Launch", "Cadillac 2026 entry package",
    "Ferrari power unit in a clean American works chassis, with bold livery surfaces and a simple floor.",
    "New team priority: finish races, learn tyre prep, and keep the hybrid healthy.",
    [["power-unit", "Ferrari supply"], ["floor", "Simple reliable floor"], ["sidepods", "Cooling margin"]]),
  pkg("cadillac", "miami", "Miami", "Home-race cooling & wing",
    "Opened bodywork and a stiffer front wing for the Miami heat and kerbs.",
    "Home event: bring a practical kit that protects the PU and gives the drivers confidence.",
    [["engine-cover", "Extra exits"], ["front-wing", "Stiffer flaps"], ["sidepods", "Inlet open"]]),
]

export function upgradesForTeam(teamId: string): UpgradePackage[] {
  const id = teamById(teamId).id
  return DIARY.filter((u) => u.teamId === id)
}

export function upgradeById(id: string): UpgradePackage | undefined {
  return DIARY.find((u) => u.id === id)
}

export function latestUpgrade(teamId: string): UpgradePackage | undefined {
  const list = upgradesForTeam(teamId)
  return list[list.length - 1]
}

export function upgradesForPart(teamId: string, partId: string): UpgradePackage[] {
  return upgradesForTeam(teamId).filter((u) => u.parts.some((p) => p.id === partId))
}

export function formatUpgrade(u: UpgradePackage): string {
  const team = teamById(u.teamId)
  const parts = u.parts.map((p) => `${p.id}: ${p.note}`).join("; ")
  return `[${u.event}] ${u.title} (${team.name})\n${u.summary}\nWhy: ${u.why}\nParts: ${parts}`
}

/** Spoken garage briefing if the model highlights but never writes an answer. */
export function narrateUpgrade(u: UpgradePackage): string {
  const team = teamById(u.teamId)
  const parts = u.parts.map((p) => p.note).join("; ")
  return (
    `This is the ${u.title} for ${team.name} — the ${u.event} entry in our development diary. ` +
    `${u.summary} ${u.why} ` +
    `On the car I've lit up the package: ${parts}. ` +
    `This is a teaching diary, not a live Document thirty-eight — ask if you want me to check the latest confirmed news.`
  )
}

export function findUpgrade(teamId: string, hint: string): UpgradePackage | undefined {
  const list = upgradesForTeam(teamId)
  const q = hint.toLowerCase()
  return (
    list.find((u) => q.includes(u.id.toLowerCase()) || q.includes(u.title.toLowerCase()) || q.includes(u.event.toLowerCase())) ??
    list.find((u) => u.id.endsWith("-launch") && /\blaunch\b/i.test(hint)) ??
    (/\blatest\b/i.test(hint) ? latestUpgrade(teamId) : undefined)
  )
}

export function formatTeamUpgradeDiary(teamId: string): string {
  const team = teamById(teamId)
  const list = upgradesForTeam(teamId)
  if (!list.length) return `${team.name}: no diary entries yet.`
  return `${team.name} (${team.car}) development diary:\n\n` + list.map(formatUpgrade).join("\n\n")
}

export function upgradeDiaryIndex(): string {
  return TEAMS.map((t) => {
    const list = upgradesForTeam(t.id)
    const titles = list.map((u) => `${u.event}: ${u.title}`).join("; ")
    return `- ${t.name} (${t.id}): ${titles || "none"}`
  }).join("\n")
}
