import { getCalendar, getLastResult, getStandings } from "@/lib/server/f1data"
import { teamNews } from "@/lib/server/search"
import { TEAMS } from "@/lib/teams"

// GET /api/paddock?team=<id>: everything the Paddock tab shows for one team,
// fetched in parallel. Each block is null when its source is unavailable.
// Upstream data is cached server-side (fetch revalidation, Data Cache); the
// response is cacheable by CDNs for a minute.
export const runtime = "nodejs"

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("team")
  const team = TEAMS.find((t) => t.id === id)
  if (!team) return Response.json({ error: "Unknown or missing team." }, { status: 400 })
  const [calendar, lastResult, standings, news] = await Promise.all([getCalendar(), getLastResult(), getStandings(), teamNews(team.id)])
  return Response.json(
    { calendar, lastResult, standings, news },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  )
}
