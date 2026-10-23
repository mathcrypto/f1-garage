import { tavily } from "@tavily/core"
import { isRelevantTeamArticle, newsScore } from "./teamRelevance"
import { STORY_MEDIA_DOMAINS, teamSite } from "./teamSites"
import { TEAMS, teamById } from "./teams"

const PREFERRED_DOMAINS = [...STORY_MEDIA_DOMAINS]

export type SearchScope = "fia" | "news" | "any"

export type SearchHit = {
  title: string
  url: string
  publishedDate?: string
  content?: string
  summary?: string
}

export const searchAvailable = () => Boolean(process.env.TAVILY_API_KEY)

const TTL_MS: Record<SearchScope, number> = {
  news: 15 * 60_000,
  fia: 2 * 60 * 60_000,
  any: 60 * 60_000,
}
const MAX_ENTRIES = 80

type Entry = { at: number; ttl: number; hits: SearchHit[] }
const cache = new Map<string, Entry>()

const keyOf = (query: string, scope: SearchScope) =>
  `${scope}:${query.toLowerCase().replace(/\s+/g, " ").trim()}`

function read(key: string): SearchHit[] | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > hit.ttl) {
    cache.delete(key)
    return null
  }
  cache.delete(key)
  cache.set(key, hit)
  return hit.hits
}

function write(key: string, hits: SearchHit[], ttl: number) {
  cache.set(key, { at: Date.now(), ttl, hits })
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!)
}

export async function searchWeb(query: string, scope: SearchScope = "any") {
  const key = keyOf(query, scope)
  const cached = read(key)
  if (cached) return cached

  const client = tavily({ apiKey: process.env.TAVILY_API_KEY })
  const { results } = await client.search(query, {
    searchDepth: "advanced",
    maxResults: 6,
    ...(scope === "fia"
      ? { includeDomains: ["fia.com"], includeDomainsMode: "restrict" as const }
      : { includeDomains: PREFERRED_DOMAINS, includeDomainsMode: "prefer" as const }),
    ...(scope === "news" ? { topic: "news" as const, timeRange: "month" as const } : {}),
  })
  const hits: SearchHit[] = results.map((r) => ({
    title: r.title || r.url,
    url: r.url,
    publishedDate: r.publishedDate,
    content: r.content,
  }))
  write(key, hits, TTL_MS[scope])
  return hits
}

function resolveTeam(teamIdOrName: string) {
  const exact = TEAMS.find((t) => t.id === teamIdOrName || t.name === teamIdOrName)
  return exact ?? teamById(teamIdOrName)
}

function toHit(r: { title?: string; url: string; publishedDate?: string; content?: string }): SearchHit {
  const title = (r.title || r.url).trim()
  const content = r.content ?? ""
  return {
    title,
    url: r.url,
    publishedDate: r.publishedDate,
    content,
    // Prefer a clean title-led summary for the list UI.
    summary: content.replace(/\s+/g, " ").trim().slice(0, 180) || title,
  }
}

/**
 * Paddock team news — last month, media-first (F1.com / Autosport / Motorsport / …).
 * Team marketing/video pages are dropped.
 */
export async function teamNews(teamIdOrName: string) {
  if (!searchAvailable()) return null
  const team = resolveTeam(teamIdOrName)
  const site = teamSite(team.id)
  const label = site?.searchAs ?? `${team.name} Formula 1`
  const shortName = team.name.replace(/^Scuderia /, "")
  const key = keyOf(`paddock-v7:${team.id}:month`, "news")
  const cached = read(key)
  if (cached) {
    return cached.map((r) => ({
      title: r.title,
      url: r.url,
      publishedDate: r.publishedDate,
      summary: (r.summary ?? r.content ?? "").slice(0, 220),
    }))
  }
  try {
    const client = tavily({ apiKey: process.env.TAVILY_API_KEY })
    // Media first — more reliable articles than team homepage scrapes.
    const mediaDomains = [...PREFERRED_DOMAINS]
    const queries = [
      {
        q: `${shortName} Formula 1 upgrade OR "tech weekly" OR chassis OR aero OR "Grand Prix"`,
        domains: mediaDomains,
      },
      {
        q: `"${label}" OR "${shortName}" F1 (upgrade OR qualifying OR practice OR preview OR development)`,
        domains: mediaDomains,
      },
      // Official site only as a backfill, still filtered.
      ...(site
        ? [{ q: `${shortName} upgrade OR "Grand Prix" OR preview OR practice -video -shop`, domains: [site.domain] }]
        : []),
    ]

    const batches = await Promise.all(
      queries.map(({ q, domains }) =>
        client
          .search(q, {
            topic: "news",
            timeRange: "month",
            maxResults: 8,
            searchDepth: "advanced",
            includeDomains: domains,
            includeDomainsMode: "restrict",
          })
          .then((r) => r.results)
          .catch(() => []),
      ),
    )

    const seen = new Set<string>()
    const scored: { hit: SearchHit; score: number }[] = []
    for (const r of batches.flat()) {
      if (!r.url || seen.has(r.url)) continue
      seen.add(r.url)
      const h = toHit(r)
      if (!isRelevantTeamArticle(h.title, h.content ?? "", team.id, h.url)) continue
      scored.push({ hit: h, score: newsScore(h.title, h.content ?? "", h.url) })
    }
    scored.sort((a, b) => b.score - a.score)
    const hits = scored.slice(0, 8).map((s) => s.hit)

    write(key, hits, TTL_MS.news)
    return hits.map((r) => ({ title: r.title, url: r.url, publishedDate: r.publishedDate, summary: r.summary! }))
  } catch {
    return null
  }
}
