import { tavily } from "@tavily/core"

// Ranked first when relevant, but other sites can still come back.
const PREFERRED_DOMAINS = ["fia.com", "formula1.com", "the-race.com", "autosport.com", "motorsport.com"]

export type SearchScope = "fia" | "news" | "any"

export const searchAvailable = () => Boolean(process.env.TAVILY_API_KEY)

export async function searchWeb(query: string, scope: SearchScope = "any") {
  const client = tavily({ apiKey: process.env.TAVILY_API_KEY })
  const { results } = await client.search(query, {
    searchDepth: "advanced",
    maxResults: 6,
    // "fia" stays on the FIA's own site: regulations, technical directives, upgrade documents.
    ...(scope === "fia"
      ? { includeDomains: ["fia.com"], includeDomainsMode: "restrict" as const }
      : { includeDomains: PREFERRED_DOMAINS, includeDomainsMode: "prefer" as const }),
    ...(scope === "news" ? { topic: "news" as const, timeRange: "month" as const } : {}),
  })
  return results.map((r) => ({
    title: r.title || r.url,
    url: r.url,
    publishedDate: r.publishedDate,
    content: r.content,
  }))
}

export async function teamNews(teamName: string) {
  if (!searchAvailable()) return null
  try {
    const client = tavily({ apiKey: process.env.TAVILY_API_KEY })
    const { results } = await client.search(`${teamName} Formula 1 upgrade OR news`, {
      topic: "news",
      timeRange: "week",
      maxResults: 8,
      includeDomains: PREFERRED_DOMAINS,
      includeDomainsMode: "prefer",
    })
    return results.map((r) => ({ title: r.title || r.url, url: r.url, publishedDate: r.publishedDate, summary: r.content.slice(0, 220) }))
  } catch {
    return null
  }
}
