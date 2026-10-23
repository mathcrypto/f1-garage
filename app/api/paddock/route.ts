import { getCalendar, getLastResult, getStandings } from "@/lib/f1data"
import { teamNews } from "@/lib/search"
import { teamById } from "@/lib/teams"

export const runtime = "nodejs"

// Everything the Paddock tab shows for one team, fetched in parallel.
// Each block is null when its source is unavailable.
export async function GET(req: Request) {
  const team = teamById(new URL(req.url).searchParams.get("team") ?? "ferrari")
  const [calendar, lastResult, standings, news] = await Promise.all([
    getCalendar(),
    getLastResult(),
    getStandings(),
    teamNews(team.id),
  ])
  return Response.json(
    { calendar, lastResult, standings, news },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  )
}
