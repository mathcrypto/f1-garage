import { getCalendar, getLastResult, getLiveSession, getStandings } from "@/lib/f1data"
import { teamNews } from "@/lib/search"
import { teamById } from "@/lib/teams"

export const runtime = "nodejs"

// Everything the Paddock tab shows for one team, fetched in parallel.
// Each block is null when its source is unavailable.
export async function GET(req: Request) {
  const team = teamById(new URL(req.url).searchParams.get("team") ?? "ferrari")
  const [calendar, lastResult, standings, live, news] = await Promise.all([
    getCalendar(),
    getLastResult(),
    getStandings(),
    getLiveSession(),
    teamNews(team.name),
  ])
  return Response.json(
    { calendar, lastResult, standings, live, news },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  )
}
