// Live and reference data from public F1 APIs. Every function resolves to
// null on failure so a slow or unavailable API never breaks a page or the agent.

const JOLPICA = "https://api.jolpi.ca/ergast/f1"
const OPENF1 = "https://api.openf1.org/v1"

async function getJson<T>(url: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
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

export async function getLastResult() {
  const data = await getJson<{ MRData: { RaceTable: { Races: JolpicaRace[] } } }>(`${JOLPICA}/current/last/results.json`, 900)
  const race = data?.MRData.RaceTable.Races[0]
  if (!race?.Results) return null
  return {
    name: race.raceName,
    podium: race.Results.slice(0, 3).map((r) => ({ position: Number(r.position), driver: `${r.Driver.givenName} ${r.Driver.familyName}`, team: r.Constructor.name })),
  }
}

export async function getStandings() {
  type C = { position?: string; positionText: string; points: string; wins: string; Constructor: { name: string; constructorId: string } }
  type D = { position?: string; positionText: string; points: string; Driver: { givenName: string; familyName: string; code?: string }; Constructors: { name: string }[] }
  const [c, d] = await Promise.all([
    getJson<{ MRData: { StandingsTable: { StandingsLists: { round: string; ConstructorStandings: C[] }[] } } }>(`${JOLPICA}/current/constructorStandings.json`, 900),
    getJson<{ MRData: { StandingsTable: { StandingsLists: { DriverStandings: D[] }[] } } }>(`${JOLPICA}/current/driverStandings.json`, 900),
  ])
  const cl = c?.MRData.StandingsTable.StandingsLists[0]
  const dl = d?.MRData.StandingsTable.StandingsLists[0]
  if (!cl && !dl) return null
  return {
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
