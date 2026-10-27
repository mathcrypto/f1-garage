import "server-only"
import { tavily } from "@tavily/core"
import { cachedLoader } from "./cache"
import { env, searchAvailable } from "./env"
import { isRelevantTeamArticle, newsScore } from "./teamRelevance"
import { STORY_MEDIA_DOMAINS, teamSite } from "./teamSites"
import { teamById } from "../teams"

// Web search through Tavily. Results are cached in Next's Data Cache: news
// for 15 minutes, FIA documents for 2 hours, general searches for an hour.

export type SearchScope = "fia" | "news" | "any"

export type SearchHit = {
  title: string
  url: string
  publishedDate?: string
  content?: string
}

export type NewsItem = { title: string; url: string; publishedDate?: string; summary: string }

const PREFERRED_DOMAINS = [...STORY_MEDIA_DOMAINS]
const MAX_CONTENT = 1200 // per hit, keeps tool results and cache entries small

export function tavilyClient() {
  return tavily({ apiKey: env.tavilyApiKey })
}

const normalise = (query: string) => query.toLowerCase().replace(/\s+/g, " ").trim()

const toHit = (r: { title?: string; url: string; publishedDate?: string; content?: string }): SearchHit => ({
  title: (r.title || r.url).trim(),
  url: r.url,
  publishedDate: r.publishedDate,
  content: r.content?.slice(0, MAX_CONTENT),
})

async function search(query: string, scope: SearchScope): Promise<SearchHit[] | null> {
  if (!searchAvailable()) return null
  try {
    const { results } = await tavilyClient().search(query, {
      searchDepth: "advanced",
      maxResults: 6,
      ...(scope === "fia"
        ? { includeDomains: ["fia.com"], includeDomainsMode: "restrict" as const }
        : { includeDomains: PREFERRED_DOMAINS, includeDomainsMode: "prefer" as const }),
      ...(scope === "news" ? { topic: "news" as const, timeRange: "month" as const } : {}),
    })
    return results.map(toHit)
  } catch (error) {
    console.error("[search] Tavily search failed:", error instanceof Error ? error.message : error)
    return null
  }
}

const searchByScope: Record<SearchScope, (query: string) => Promise<SearchHit[] | null>> = {
  news: cachedLoader((q: string) => search(q, "news"), ["search", "news", "v1"], { revalidate: 900, tags: ["search"] }),
  fia: cachedLoader((q: string) => search(q, "fia"), ["search", "fia", "v1"], { revalidate: 7200, tags: ["search"] }),
  any: cachedLoader((q: string) => search(q, "any"), ["search", "any", "v1"], { revalidate: 3600, tags: ["search"] }),
}

/** Search the web. Returns [] when search is unavailable or fails. */
export async function searchWeb(query: string, scope: SearchScope = "any"): Promise<SearchHit[]> {
  const q = normalise(query)
  if (!q) return []
  return (await searchByScope[scope](q)) ?? []
}

/**
 * Paddock team news: the last month, media first (F1.com, Autosport,
 * Motorsport, …), the team's own site only as a backfill, filtered to
 * articles actually about this team.
 */
async function loadTeamNews(teamId: string): Promise<NewsItem[] | null> {
  if (!searchAvailable()) return null
  const team = teamById(teamId)
  const site = teamSite(team.id)
  const label = site?.searchAs ?? `${team.name} Formula 1`
  const shortName = team.name.replace(/^Scuderia /, "")
  const queries = [
    { q: `${shortName} Formula 1 upgrade OR "tech weekly" OR chassis OR aero OR "Grand Prix"`, domains: PREFERRED_DOMAINS },
    { q: `"${label}" OR "${shortName}" F1 (upgrade OR qualifying OR practice OR preview OR development)`, domains: PREFERRED_DOMAINS },
    ...(site ? [{ q: `${shortName} upgrade OR "Grand Prix" OR preview OR practice -video -shop`, domains: [site.domain] }] : []),
  ]
  const client = tavilyClient()
  const batches = await Promise.all(
    queries.map(({ q, domains }) =>
      client
        .search(q, { topic: "news", timeRange: "month", maxResults: 8, searchDepth: "advanced", includeDomains: domains, includeDomainsMode: "restrict" })
        .then((r) => r.results)
        .catch(() => null),
    ),
  )
  if (batches.every((b) => b === null)) return null // every query failed: don't cache

  const seen = new Set<string>()
  const scored: { hit: SearchHit; score: number }[] = []
  for (const r of batches.flat()) {
    if (!r?.url || seen.has(r.url)) continue
    seen.add(r.url)
    const hit = toHit(r)
    if (!isRelevantTeamArticle(hit.title, hit.content ?? "", team.id, hit.url)) continue
    scored.push({ hit, score: newsScore(hit.title, hit.content ?? "", hit.url) })
  }
  // Newest first: a relevant article from yesterday beats a better match from
  // three weeks ago. Undated hits go last.
  const time = (d?: string) => (d ? Date.parse(d) || 0 : 0)
  scored.sort((a, b) => time(b.hit.publishedDate) - time(a.hit.publishedDate) || b.score - a.score)
  return scored.slice(0, 8).map(({ hit }) => ({
    title: hit.title,
    url: hit.url,
    publishedDate: hit.publishedDate,
    summary: (hit.content ?? "").replace(/\s+/g, " ").trim().slice(0, 220) || hit.title,
  }))
}

export const teamNews = cachedLoader(loadTeamNews, ["team-news", "v9"], { revalidate: 900, tags: ["team-news"] })
