import { tavily } from "@tavily/core"

// Ranked first when relevant, but other sites can still come back.
const PREFERRED_DOMAINS = ["fia.com", "formula1.com", "the-race.com", "autosport.com", "motorsport.com"]

export const searchAvailable = () => Boolean(process.env.TAVILY_API_KEY)

export async function searchWeb(query: string) {
  const client = tavily({ apiKey: process.env.TAVILY_API_KEY })
  const { results } = await client.search(query, {
    searchDepth: "advanced",
    maxResults: 6,
    includeDomains: PREFERRED_DOMAINS,
    includeDomainsMode: "prefer",
  })
  return results.map((r) => ({
    title: r.title || r.url,
    url: r.url,
    publishedDate: r.publishedDate,
    content: r.content,
  }))
}
