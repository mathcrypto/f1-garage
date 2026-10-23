import { fetchTeamStory } from "@/lib/server/teamStory"
import { TEAMS } from "@/lib/teams"

// GET /api/team-story?team=<id>: the live, sourced team briefing for Explore.
// Built from search results (not AI-written); cached server-side for 45 min.
export const runtime = "nodejs"

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("team")
  const team = TEAMS.find((t) => t.id === id)
  if (!team) return Response.json({ error: "Unknown or missing team." }, { status: 400 })
  const story = await fetchTeamStory(team.id)
  return Response.json(story, {
    headers: {
      "Cache-Control": story.available ? "public, s-maxage=900, stale-while-revalidate=1800" : "public, s-maxage=60, stale-while-revalidate=120",
    },
  })
}
