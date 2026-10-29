import { PART_IDS } from "./parts"
import { TEAMS, teamById } from "./teams"

// Real 2026 upgrades, one entry per declared package. Every entry comes from
// the FIA's per-event "car presentation submissions" document or from F1
// media reporting it, and links its sources. Nothing here is invented: when a
// report doesn't say which part changed, the entry is left out. Lena uses
// get_team_story / web_search for anything newer than this list.

type UpgradeSource = { title: string; url: string }

export type UpgradePackage = {
  id: string
  teamId: string
  event: string
  /** First day of the event weekend (YYYY-MM-DD), for ordering. */
  date: string
  title: string
  summary: string
  parts: { id: string; note: string }[]
  /** Where to check it: the FIA document and/or the reports it came from. */
  sources: UpgradeSource[]
}

const fia = (event: string, slug: string): UpgradeSource => ({
  title: `FIA: ${event} car presentation submissions`,
  url: `https://www.fia.com/system/files/decision-document/2026_${slug}_grand_prix_-_car_presentation_submissions.pdf`,
})

const RACER_MONZA = { title: "RACER: Technical updates, 2026 Italian GP", url: "https://racer.com/2026/09/04/technical-updates-2026-italian-grand-prix" }
const PLANETF1_MIAMI = { title: "PlanetF1: Miami GP upgrades", url: "https://www.planetf1.com/news/f1-miami-upgrades-ferrari-11-red-bull-mclaren" }

function pkg(
  teamId: string,
  key: string,
  event: string,
  date: string,
  title: string,
  summary: string,
  parts: [string, string][],
  source: UpgradeSource | UpgradeSource[],
): UpgradePackage {
  return {
    id: `${teamId}-${key}`,
    teamId,
    event,
    date,
    title,
    summary,
    parts: parts.filter(([pid]) => PART_IDS.includes(pid)).map(([pid, note]) => ({ id: pid, note })),
    sources: Array.isArray(source) ? source : [source],
  }
}

const UPGRADES: UpgradePackage[] = [
  // Ferrari
  pkg("ferrari", "japan", "Japanese", "2026-03-27", "Front floor stay fairing",
    "A reprofiled fairing on the front floor stay.",
    [["floor", "Floor stay fairing reprofiled"]],
    fia("Japanese GP", "japanese")),
  pkg("ferrari", "miami", "Miami", "2026-05-01", "Eleven-part package",
    "Eleven declared updates across the front wing, front suspension, floor, diffuser, rear wing and endplates.",
    [["front-wing", "Updated"], ["front-suspension", "Updated"], ["floor", "Updated"], ["diffuser", "Updated"], ["rear-wing", "Wing and endplates updated"]],
    PLANETF1_MIAMI),
  pkg("ferrari", "dutch", "Dutch", "2026-08-21", "New floor",
    "A new floor, one of the two biggest floor packages declared at Zandvoort.",
    [["floor", "New floor"]],
    { title: "Grande Prêmio: Ferrari and Alpine debut new floors", url: "https://grandepremio.com/en/f1/ferrari-and-alpine-debut-new-floors-team-updates-at-the-2026-dutch-grand-prix/" }),
  pkg("ferrari", "italy", "Italian", "2026-09-04", "Monza drag package",
    "Drag-saving changes to the floor board, mirror stay, rear brake ducts and tailpipe.",
    [["floor", "Floor board"], ["cockpit", "Mirror stay"], ["rear-tyres", "Rear brake ducts"], ["engine-cover", "Tailpipe"]],
    RACER_MONZA),

  // Mercedes
  pkg("mercedes", "miami", "Miami", "2026-05-01", "Tailpipe and front drum lip",
    "The tailpipe was rotated away from the rear wing's upper element and the front brake drum lip was lengthened to reduce local losses.",
    [["engine-cover", "Tailpipe rotated"], ["front-tyres", "Longer drum lip"]],
    PLANETF1_MIAMI),
  pkg("mercedes", "italy", "Italian", "2026-09-04", "Monza low-drag trim",
    "Rear wing winglets and extensions removed and mirror stays trimmed to cut drag, keeping the gurney flap for stability.",
    [["rear-wing", "Winglets and extensions removed"], ["cockpit", "Mirror stays trimmed"]],
    RACER_MONZA),
  pkg("mercedes", "singapore", "Singapore", "2026-10-09", "New front wing",
    "A new front wing with a revised chord distribution across its elements, plus an adjusted endplate and footplate.",
    [["front-wing", "New wing, endplate and footplate"]],
    fia("Singapore GP", "singapore")),

  // Red Bull
  pkg("redbull", "miami", "Miami", "2026-05-01", "Rotating rear-wing element",
    "Six performance changes, including revised sidepods, new front and rear wings with a rotating top element on the rear wing, and changes to the floor, rear suspension and bodywork.",
    [["rear-wing", "Rotating top element"], ["front-wing", "New wing"], ["sidepods", "Revised"], ["floor", "Updated"], ["rear-suspension", "Updated"]],
    PLANETF1_MIAMI),
  pkg("redbull", "austria", "Austrian", "2026-06-26", "Diffuser trailing edge",
    "Refined devices on the diffuser's trailing edge.",
    [["diffuser", "Trailing-edge devices"]],
    fia("Austrian GP", "austrian")),
  pkg("redbull", "britain", "British", "2026-07-03", "Rear wheel winglets",
    "Revised winglets on the rear wheel bodywork.",
    [["rear-tyres", "Wheel bodywork winglets"]],
    fia("British GP", "british")),
  pkg("redbull", "singapore", "Singapore", "2026-10-09", "Front wing and rear brake duct",
    "Front wing endplate and flap geometry revised for more local load, and an enlarged rear brake exit duct for Singapore's braking demands.",
    [["front-wing", "Endplate and flap geometry"], ["rear-tyres", "Bigger brake exit duct"]],
    fia("Singapore GP", "singapore")),

  // McLaren
  pkg("mclaren", "miami", "Miami", "2026-05-01", "New floor",
    "Seven changes centred on a new floor, with a new rear wing with revised endplates and an optional sidepod louvre for extra cooling.",
    [["floor", "New floor"], ["rear-wing", "Revised endplates"], ["sidepods", "Optional cooling louvre"]],
    PLANETF1_MIAMI),
  pkg("mclaren", "britain", "British", "2026-07-03", "Front brake duct",
    "A new front brake duct.",
    [["front-tyres", "New brake duct"]],
    fia("British GP", "british")),
  pkg("mclaren", "italy", "Italian", "2026-09-04", "Low-drag rear wing",
    "A new low-drag rear wing for Monza's long straights.",
    [["rear-wing", "Low-drag wing"]],
    RACER_MONZA),
  pkg("mclaren", "singapore", "Singapore", "2026-10-09", "Front brake duct cooling",
    "A new front brake duct for Singapore's higher cooling needs, the team's only change that weekend.",
    [["front-tyres", "More brake cooling"]],
    fia("Singapore GP", "singapore")),

  // Aston Martin
  pkg("astonmartin", "japan", "Japanese", "2026-03-27", "Front wing change",
    "A revised front wing.",
    [["front-wing", "Revised"]],
    fia("Japanese GP", "japanese")),
  pkg("astonmartin", "hungary", "Hungarian", "2026-07-24", "Sixteen-part B-spec",
    "Sixteen declared updates, including a much slimmer nose, front wing changes and revised floor surfaces, aimed at giving the diffuser a more robust airflow.",
    [["front-wing", "Revised"], ["nose", "Much slimmer nose"], ["floor", "Revised floor surfaces"], ["diffuser", "More robust airflow"]],
    [
      { title: "Formula1.com: A closer look at Aston Martin's major upgrades", url: "https://www.formula1.com/en/latest/article/a-closer-look-at-aston-martins-major-upgrades-and-the-overall-theme-they-are-chasing.6Ob4CsAvJA3H4ZoB7YYRlk" },
      { title: "Motorsport Week: Aston Martin B-spec AMR26 in Budapest", url: "https://www.motorsportweek.com/2026/07/24/aston-martin-f1-upgrades/" },
    ]),

  // Alpine
  pkg("alpine", "dutch", "Dutch", "2026-08-21", "First major package",
    "Floor body, floor board, floor edge, diffuser, sidepod and coke bodywork, rear corner, rear impact structure and rear wing.",
    [["floor", "Body, board and edge"], ["diffuser", "Updated"], ["sidepods", "Sidepod and coke bodywork"], ["rear-wing", "Updated"]],
    { title: "Motorsport Week: Alpine's first major upgrade at Zandvoort", url: "https://www.motorsportweek.com/2026/08/21/f1-upgrades-sheet-alpine-brings-first-major-upgrade-package-of-2026-to-zandvoort/" }),
  pkg("alpine", "italy", "Italian", "2026-09-04", "Folding rear wing returns",
    "The folding rear wing, shelved after the first three races, came back with a low-downforce setup.",
    [["rear-wing", "Folding wing"]],
    { title: "Motorsport.com: Alpine brings back folding rear wing", url: "https://www.motorsport.com/f1/news/f1-alpine-brought-back-collapsing-reverse-opening-rear-wing-for-gaslys-monza-pole/10852905/" }),

  // Williams
  pkg("williams", "canada", "Canadian", "2026-05-22", "Floor and rear corner",
    "A reworked floor and rear corner devices.",
    [["floor", "Reworked"], ["rear-suspension", "Rear corner devices"]],
    fia("Canadian GP", "canadian")),
  pkg("williams", "baku", "Azerbaijan", "2026-09-24", "New floor package",
    "Five items led by a new floor, with reprofiled front brake duct flow conditioners, realigned rear suspension cladding and new rear brake duct features.",
    [["floor", "New floor"], ["front-tyres", "Brake duct flow conditioners"], ["rear-suspension", "Realigned cladding"], ["rear-tyres", "Brake duct features"]],
    { title: "PlanetF1: McLaren and Williams upgrade details for Baku", url: "https://www.planetf1.com/news/first-mclaren-and-williams-upgrade-details-revealed-in-fia-submission" }),

  // Racing Bulls
  pkg("racingbulls", "australia", "Australian", "2026-03-06", "Melbourne trial parts",
    "A new deflector array, updated keel, floor leading edge and rear floor, and a new engine cover.",
    [["floor", "Leading edge and rear floor"], ["engine-cover", "New cover"]],
    { title: "PlanetF1: Re-engineered VCARB 03", url: "https://www.planetf1.com/features/f1-2026-uncovered-racing-bulls-quick-out-the-block-with-updates" }),
  pkg("racingbulls", "hungary", "Hungarian", "2026-07-24", "Airbox fins",
    "Two fins added to the airbox.",
    [["engine-cover", "Two airbox fins"]],
    { title: "Motorsport.com: VCARB 03 adds two fins to airbox", url: "https://www.motorsport.com/f1/news/f1-racing-bulls-also-sprouts-wings-two-fins-have-appeared-on-the-new-airbox/10841317/" }),
  pkg("racingbulls", "italy", "Italian", "2026-09-04", "Straight Mode mechanism",
    "An updated rear wing Straight Mode mechanism and a relocated exhaust tailpipe.",
    [["rear-wing", "Straight Mode mechanism"], ["engine-cover", "Tailpipe moved"]],
    RACER_MONZA),

  // Haas
  pkg("haas", "canada", "Canadian", "2026-05-22", "Biggest package of 2026",
    "A new floor, revised sidepod inlets, a reshaped engine cover and several smaller refinements.",
    [["floor", "New floor"], ["sidepods", "Revised inlets"], ["engine-cover", "Reshaped"]],
    { title: "F1technical: Haas's biggest upgrade of 2026 in Montreal", url: "https://www.f1technical.net/news/28611" }),
  pkg("haas", "austria", "Austrian", "2026-06-26", "Sidepod apertures",
    "Two added sidepod apertures.",
    [["sidepods", "Two new apertures"]],
    fia("Austrian GP", "austrian")),

  // Audi
  pkg("audi", "baku", "Azerbaijan", "2026-09-24", "Fourteen-part package",
    "The largest single-race package of the season: a new floor body, leading-edge devices and diffuser, plus changes to the front wing, nose, front suspension, bodywork, rear wing and rear suspension.",
    [["floor", "New floor body"], ["diffuser", "New"], ["front-wing", "Updated"], ["nose", "Updated"], ["front-suspension", "Updated"], ["engine-cover", "Bodywork"], ["rear-wing", "Updated"], ["rear-suspension", "Updated"]],
    { title: "Motorsport Week: Audi leads F1 Baku upgrade push", url: "https://www.motorsportweek.com/2026/09/24/f1-baku-upgrades/" }),

  // Cadillac
  pkg("cadillac", "miami", "Miami", "2026-05-01", "First major package",
    "Nine aero items: front wing endplate and flap, mirror stay, forward floorboard, floor body, diffuser, rear suspension, rear corner and exhaust tailpipe bracket.",
    [["front-wing", "Endplate and flap"], ["cockpit", "Mirror stay"], ["floor", "Floorboard and floor body"], ["diffuser", "Updated"], ["rear-suspension", "Updated"]],
    { title: "The Race: Cadillac's first F1 upgrade explained", url: "https://www.the-race.com/formula-1/cadillacs-first-ever-f1-upgrade-package-explained/" }),
  pkg("cadillac", "canada", "Canadian", "2026-05-22", "Brakes, diffuser and torsion bars",
    "New front brake drums, diffuser trim and winglets, and new front torsion bars.",
    [["front-tyres", "New brake drums"], ["diffuser", "Trim and winglets"], ["front-suspension", "Torsion bars"]],
    { title: "Yahoo Sports: Cadillac details Canadian GP upgrade", url: "https://sports.yahoo.com/articles/cadillac-details-f1-upgrade-package-142828564.html" }),
].sort((a, b) => a.date.localeCompare(b.date))

export function upgradesForTeam(teamId: string): UpgradePackage[] {
  const id = teamById(teamId).id
  return UPGRADES.filter((u) => u.teamId === id)
}

export function upgradeById(id: string): UpgradePackage | undefined {
  return UPGRADES.find((u) => u.id === id)
}

/** The most recent package in this list (not necessarily the team's newest part). */
export function latestUpgrade(teamId: string): UpgradePackage | undefined {
  return upgradesForTeam(teamId).at(-1)
}

export function upgradesForPart(teamId: string, partId: string): UpgradePackage[] {
  return upgradesForTeam(teamId).filter((u) => u.parts.some((p) => p.id === partId))
}

/** Month and year of the event, e.g. "May 2026". */
export function upgradeMonth(u: UpgradePackage): string {
  return new Date(`${u.date}T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" })
}

export function formatUpgrade(u: UpgradePackage): string {
  const team = teamById(u.teamId)
  const parts = u.parts.map((p) => `${p.id}: ${p.note}`).join("; ")
  return `[${u.id}] ${u.event} GP, ${upgradeMonth(u)}: ${u.title} (${team.name})\n${u.summary}\nParts: ${parts}\nSources: ${u.sources.map((s) => `${s.title} (${s.url})`).join("; ")}`
}

/** Spoken briefing if the model highlights but never writes an answer. */
export function narrateUpgrade(u: UpgradePackage): string {
  const team = teamById(u.teamId)
  return `At the ${u.event} Grand Prix, ${team.name} brought this: ${u.summary} I've lit up the parts on the car.`
}

export function findUpgrade(teamId: string, hint: string): UpgradePackage | undefined {
  const list = upgradesForTeam(teamId)
  const q = hint.toLowerCase()
  return (
    list.find((u) => q.includes(u.id) || q.includes(u.title.toLowerCase()) || q.includes(u.event.toLowerCase())) ??
    (/\blatest\b/i.test(hint) ? latestUpgrade(teamId) : undefined)
  )
}

export function formatTeamUpgrades(teamId: string): string {
  const team = teamById(teamId)
  const list = upgradesForTeam(teamId)
  if (!list.length) return `${team.name}: no sourced upgrades in the list. Use get_team_story for the latest.`
  return `${team.name} (${team.car}) declared 2026 upgrades, oldest first:\n\n` + list.map(formatUpgrade).join("\n\n")
}

export function upgradesIndex(): string {
  return TEAMS.map((t) => {
    const titles = upgradesForTeam(t.id).map((u) => `${u.id} (${u.event}: ${u.title})`).join("; ")
    return `- ${t.name} (${t.id}): ${titles || "none listed"}`
  }).join("\n")
}

/** Source links for a list of packages, shown as Lena's source chips. */
export const upgradeSources = (list: UpgradePackage[]) => list.flatMap((u) => u.sources)
