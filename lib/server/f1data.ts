import "server-only"

// Live and reference data from public F1 APIs (Jolpica-F1, OpenF1). Responses
// are cached by Next's fetch cache with per-endpoint revalidation. Every
// function resolves to null on failure, so a slow or unavailable API never
// breaks a page or the agent.

const JOLPICA = "https://api.jolpi.ca/ergast/f1"
const OPENF1 = "https://api.openf1.org/v1"

async function getJson<T>(url: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch (error) {
    console.error(`[f1data] ${url} failed:`, error instanceof Error ? error.message : error)
    return null
  }
}

type JolpicaRace = {
  round: string
  raceName: string
  date: string
  time?: string
  Circuit: { circuitName: string; Location: { locality: string; country: string } }
  Results?: { position: string; Driver: { givenName: string; familyName: string }; Constructor: { name: string } }[]
}

export async function getCalendar() {
  const data = await getJson<{ MRData: { RaceTable: { season: string; Races: JolpicaRace[] } } }>(`${JOLPICA}/current.json`, 3600)
  const races = data?.MRData.RaceTable.Races
  if (!races) return null
  const now = Date.now()
  const toEvent = (r: JolpicaRace) => ({
    round: Number(r.round),
    name: r.raceName,
    circuit: r.Circuit.circuitName,
    place: `${r.Circuit.Location.locality}, ${r.Circuit.Location.country}`,
    start: `${r.date}T${r.time ?? "12:00:00Z"}`,
  })
  const upcoming = races.filter((r) => new Date(`${r.date}T${r.time ?? "23:59:59Z"}`).getTime() > now).map(toEvent)
  const past = races.filter((r) => new Date(`${r.date}T${r.time ?? "23:59:59Z"}`).getTime() <= now).map(toEvent)
  return { season: data.MRData.RaceTable.season, next: upcoming.slice(0, 3), last: past.at(-1) ?? null, totalRounds: races.length }
}

type Podium = { position: number; driver: string; team: string }[]
type LastResult = { name: string; date: string; podium: Podium; source: "Jolpica-F1" | "OpenF1" }

/** Last race podium from Jolpica-F1 (community-maintained; can lag a few days). */
async function jolpicaLastResult(): Promise<LastResult | null> {
  const data = await getJson<{ MRData: { RaceTable: { Races: JolpicaRace[] } } }>(`${JOLPICA}/current/last/results.json`, 900)
  const race = data?.MRData.RaceTable.Races[0]
  if (!race?.Results) return null
  return {
    name: race.raceName,
    date: race.date,
    podium: race.Results.slice(0, 3).map((r) => ({ position: Number(r.position), driver: `${r.Driver.givenName} ${r.Driver.familyName}`, team: r.Constructor.name })),
    source: "Jolpica-F1",
  }
}

/** Last race podium from OpenF1, which publishes classifications soon after each session. */
async function openF1LastResult(): Promise<LastResult | null> {
  type Session = { session_key: number; meeting_key: number; date_start: string; date_end: string }
  type Result = { position: number | null; driver_number: number }
  type Driver = { driver_number: number; first_name?: string; last_name?: string; full_name?: string; team_name?: string }
  const year = new Date().getUTCFullYear()
  const sessions = await getJson<Session[]>(`${OPENF1}/sessions?year=${year}&session_name=Race`, 600)
  const now = Date.now()
  const last = (sessions ?? [])
    .filter((s) => new Date(s.date_end).getTime() < now)
    .sort((a, b) => a.date_start.localeCompare(b.date_start))
    .at(-1)
  if (!last) return null
  const [results, drivers, meetings] = await Promise.all([
    getJson<Result[]>(`${OPENF1}/session_result?session_key=${last.session_key}`, 600),
    getJson<Driver[]>(`${OPENF1}/drivers?session_key=${last.session_key}`, 3600),
    getJson<{ meeting_name: string }[]>(`${OPENF1}/meetings?meeting_key=${last.meeting_key}`, 3600),
  ])
  const top = (results ?? []).filter((r) => r.position && r.position <= 3).sort((a, b) => a.position! - b.position!)
  const name = meetings?.[0]?.meeting_name
  if (top.length < 3 || !name) return null // not classified yet
  const who = (n: number) => drivers?.find((d) => d.driver_number === n)
  return {
    name,
    date: last.date_start.slice(0, 10),
    podium: top.map((r) => {
      const d = who(r.driver_number)
      const driver = d?.first_name && d.last_name ? `${d.first_name} ${d.last_name}` : (d?.full_name ?? `Car ${r.driver_number}`)
      return { position: r.position!, driver, team: d?.team_name ?? "" }
    }),
    source: "OpenF1",
  }
}

/** The most recent race podium either source has published. */
export async function getLastResult(): Promise<LastResult | null> {
  const [jolpica, openf1] = await Promise.all([jolpicaLastResult(), openF1LastResult()])
  if (!jolpica || !openf1) return jolpica ?? openf1
  return openf1.date > jolpica.date ? openf1 : jolpica
}

/** Season path segment for Jolpica: a year like 2025, or "current". */
export function standingsSeasonPath(season?: number | string | null): string {
  if (season == null || season === "" || season === "current") return "current"
  const y = Number(season)
  if (Number.isFinite(y) && y >= 1950 && y <= 2100) return String(y)
  return "current"
}

export async function getStandings(season?: number | string | null) {
  type C = { position?: string; positionText: string; points: string; wins: string; Constructor: { name: string; constructorId: string } }
  type D = { position?: string; positionText: string; points: string; Driver: { givenName: string; familyName: string; code?: string }; Constructors: { name: string }[] }
  const path = standingsSeasonPath(season)
  const [c, d] = await Promise.all([
    getJson<{ MRData: { StandingsTable: { season: string; StandingsLists: { round: string; ConstructorStandings: C[] }[] } } }>(`${JOLPICA}/${path}/constructorStandings.json`, 900),
    getJson<{ MRData: { StandingsTable: { season: string; StandingsLists: { DriverStandings: D[] }[] } } }>(`${JOLPICA}/${path}/driverStandings.json`, 900),
  ])
  const cl = c?.MRData.StandingsTable.StandingsLists[0]
  const dl = d?.MRData.StandingsTable.StandingsLists[0]
  if (!cl && !dl) return null
  const seasonYear = c?.MRData.StandingsTable.season ?? d?.MRData.StandingsTable.season ?? (path === "current" ? null : path)
  return {
    season: seasonYear ? Number(seasonYear) : null,
    afterRound: cl ? Number(cl.round) : null,
    constructors: (cl?.ConstructorStandings ?? []).map((s) => ({ position: s.positionText, team: s.Constructor.name, id: s.Constructor.constructorId, points: Number(s.points), wins: Number(s.wins) })),
    drivers: (dl?.DriverStandings ?? []).slice(0, 10).map((s) => ({ position: s.positionText, driver: `${s.Driver.givenName} ${s.Driver.familyName}`, code: s.Driver.code, team: s.Constructors[0]?.name, points: Number(s.points) })),
  }
}

export async function getLiveSession() {
  type Session = { session_key: number; session_name: string; session_type: string; date_start: string; date_end: string; location: string; country_name: string; circuit_short_name: string; year: number }
  type RaceControl = { date: string; category: string; flag: string | null; message: string; lap_number: number | null }
  const sessions = await getJson<Session[]>(`${OPENF1}/sessions?session_key=latest`, 60)
  const s = sessions?.[0]
  if (!s) return null
  const now = Date.now()
  const live = now >= new Date(s.date_start).getTime() && now <= new Date(s.date_end).getTime() + 30 * 60_000
  const rc = await getJson<RaceControl[]>(`${OPENF1}/race_control?session_key=${s.session_key}`, live ? 15 : 600)
  return {
    live,
    session: `${s.session_name}`,
    event: `${s.location}, ${s.country_name}`,
    circuit: s.circuit_short_name,
    start: s.date_start,
    end: s.date_end,
    raceControl: (rc ?? []).slice(-8).reverse().map((m) => ({ time: m.date, flag: m.flag, category: m.category, message: m.message, lap: m.lap_number })),
  }
}
