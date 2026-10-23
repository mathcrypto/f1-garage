import { fetchTeamStory } from "@/lib/teamStory"
import { teamById } from "@/lib/teams"

export const runtime = "nodejs"

/** Live sourced briefing for Explore (FIA + trusted media + team site). Cached ~45 min. */
export async function GET(req: Request) {
  const team = teamById(new URL(req.url).searchParams.get("team") ?? "ferrari")
  const story = await fetchTeamStory(team.id)
  return Response.json(story, {
    headers: {
      "Cache-Control": story.available
        ? "public, s-maxage=900, stale-while-revalidate=1800"
        : "public, s-maxage=60, stale-while-revalidate=120",
    },
  })
}
