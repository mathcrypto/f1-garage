import { tavily } from "@tavily/core"
import { searchAvailable, type SearchHit } from "./search"
import { isJunkSnippet, isRelevantTeamArticle, newsScore } from "./teamRelevance"
import { teamById } from "./teams"
import { storyAllowDomains, STORY_MEDIA_DOMAINS, teamSite } from "./teamSites"

/** Live, sourced F1 team briefing for Explore + Lena. Cache ~45 min. */
export type StorySource = { title: string; url: string; outlet: string; publishedDate?: string }

export type StoryBullet = {
  text: string
  kind: "upgrade" | "aero" | "power" | "weekend" | "general"
  sourceIndex: number
}

export type TeamStory = {
  teamId: string
  teamName: string
  car: string
  fetchedAt: string
  cached: boolean
  available: boolean
  bullets: StoryBullet[]
  sources: StorySource[]
  officialSite?: string
}

const TTL_MS = 45 * 60_000
const MAX_CACHE = 24
const CACHE_VER = "f1-v6" // title must name this team

type CacheEntry = { at: number; story: TeamStory }
const cache = new Map<string, CacheEntry>()

function outletOf(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "")
    const rules: [RegExp, string][] = [
      [/fia\.com/, "FIA"],
      [/formula1\.com/, "Formula 1"],
      [/the-race\.com/, "The Race"],
      [/autosport\.com/, "Autosport"],
      [/motorsport\.com/, "Motorsport"],
      [/racefans\.net/, "RaceFans"],
      [/planetf1\.com/, "PlanetF1"],
      [/ferrari\.com/, "Ferrari"],
      [/mercedesamgf1/, "Mercedes"],
      [/redbullracing/, "Red Bull"],
      [/mclaren\.com/, "McLaren"],
      [/astonmartinf1/, "Aston Martin"],
      [/alpinef1/, "Alpine"],
      [/williamsf1/, "Williams"],
      [/visacashapprb|racingbulls/, "Racing Bulls"],
      [/haasf1team/, "Haas"],
      [/audif1/, "Audi"],
      [/cadillacf1/, "Cadillac"],
    ]
    for (const [re, label] of rules) if (re.test(host)) return label
    return host.split(".")[0] ?? host
  } catch {
    return "Source"
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

function allowedHost(url: string, allow: string[]): boolean {
  const host = hostOf(url)
  return allow.some((d) => host === d || host.endsWith(`.${d}`))
}

function teamPathOk(url: string, teamId: string): boolean {
  const site = teamSite(teamId)
  if (!site?.pathIncludes?.length) return true
  const host = hostOf(url)
  if (!host.endsWith(site.domain)) return true
  try {
    return site.pathIncludes.some((p) => new URL(url).pathname.includes(p))
  } catch {
    return false
  }
}

function isKeepHit(h: SearchHit, teamId: string, allow: string[]): boolean {
  if (!h.url || !allowedHost(h.url, allow)) return false
  if (!teamPathOk(h.url, teamId)) return false
  return isRelevantTeamArticle(h.title, h.content ?? "", teamId, h.url)
}

function kindOf(title: string, content: string): StoryBullet["kind"] {
  const t = `${title} ${content}`.toLowerCase()
  if (/\b(upgrade|new floor|new wing|package|brought|specification|spec split|tech weekly)\b/.test(t)) return "upgrade"
  if (/\b(aero|floor|wing|downforce|sidepod|diffuser|ground effect)\b/.test(t)) return "aero"
  if (/\b(power unit|\bpu\b|hybrid|mgu|ers|energy store)\b/.test(t)) return "power"
  if (/\b(preview|this weekend|grand prix|gp\b|practice|qualifying|race report)\b/.test(t)) return "weekend"
  return "general"
}

function cleanSnippet(title: string, content?: string): string {
  const body = (content ?? "").replace(/\s+/g, " ").trim()
  if (!body || isJunkSnippet(title, body) || body.length < 40) return title.trim()
  const cut = body.slice(0, 220)
  const end = cut.lastIndexOf(".")
  return end > 80 ? cut.slice(0, end + 1) : `${cut}${body.length > 220 ? "…" : ""}`
}

async function runQuery(query: string, domains: string[], opts?: { fiaOnly?: boolean; news?: boolean }): Promise<SearchHit[]> {
  const client = tavily({ apiKey: process.env.TAVILY_API_KEY })
  const include = opts?.fiaOnly ? ["fia.com"] : domains
  const { results } = await client.search(query, {
    searchDepth: "advanced",
    maxResults: 8,
    includeDomains: include,
    includeDomainsMode: "restrict",
    ...(opts?.news ? { topic: "news" as const, timeRange: "month" as const } : {}),
  })
  return results.map((r) => ({
    title: r.title || r.url,
    url: r.url,
    publishedDate: r.publishedDate,
    content: r.content,
  }))
}

function buildStory(teamId: string, hits: SearchHit[], cached: boolean): TeamStory {
  const team = teamById(teamId)
  const site = teamSite(teamId)
  const allow = storyAllowDomains(teamId)

  const scored = hits
    .filter((h) => h.url && isKeepHit(h, teamId, allow))
    .map((h) => ({ h, score: newsScore(h.title, h.content ?? "", h.url) }))
    .sort((a, b) => b.score - a.score)

  const seen = new Set<string>()
  const sources: StorySource[] = []
  const bullets: StoryBullet[] = []

  for (const { h } of scored) {
    if (seen.has(h.url)) continue
    seen.add(h.url)
    const sourceIndex = sources.length
    sources.push({
      title: h.title,
      url: h.url,
      outlet: outletOf(h.url),
      publishedDate: h.publishedDate,
    })
    const text = cleanSnippet(h.title, h.content)
    if (text.length < 12) continue
    bullets.push({ text, kind: kindOf(h.title, h.content ?? ""), sourceIndex })
    if (bullets.length >= 6) break
  }

  return {
    teamId: team.id,
    teamName: team.name,
    car: team.car,
    fetchedAt: new Date().toISOString(),
    cached,
    available: true,
    bullets,
    sources: sources.slice(0, 8),
    officialSite: site?.home,
  }
}

export async function fetchTeamStory(teamId: string): Promise<TeamStory> {
  const team = teamById(teamId)
  const id = team.id
  const cacheKey = `${CACHE_VER}:${id}`

  if (!searchAvailable()) {
    return {
      teamId: id,
      teamName: team.name,
      car: team.car,
      fetchedAt: new Date().toISOString(),
      cached: false,
      available: false,
      bullets: [],
      sources: [],
      officialSite: teamSite(id)?.home,
    }
  }

  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < TTL_MS) {
    return { ...hit.story, cached: true }
  }

  const site = teamSite(id)
  const label = site?.searchAs ?? `${team.name} Formula 1`
  const shortName = team.name.replace(/^Scuderia /, "")
  const car = team.car
  const media = [...STORY_MEDIA_DOMAINS]
  const guard = '-SUV -sponsor -video -shop -memento -"best seats"'

  try {
    const [fia, newsA, newsB] = await Promise.all([
      runQuery(`${shortName} Formula 1 upgrade OR technical directive ${guard}`, media, { fiaOnly: true }).catch(() => [] as SearchHit[]),
      runQuery(
        `${shortName} Formula 1 (upgrade OR "tech weekly" OR aero OR chassis OR preview OR qualifying) ${guard}`,
        media,
        { news: true },
      ).catch(() => [] as SearchHit[]),
      runQuery(
        `("${label}" OR "${car}") F1 (upgrade OR development OR Grand Prix) ${guard}`,
        media,
        { news: true },
      ).catch(() => [] as SearchHit[]),
    ])
    const story = buildStory(id, [...newsA, ...newsB, ...fia], false)
    cache.set(cacheKey, { at: Date.now(), story: { ...story, cached: false } })
    while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!)
    return story
  } catch {
    if (hit) return { ...hit.story, cached: true }
    return {
      teamId: id,
      teamName: team.name,
      car: team.car,
      fetchedAt: new Date().toISOString(),
      cached: false,
      available: false,
      bullets: [],
      sources: [],
      officialSite: teamSite(id)?.home,
    }
  }
}

export function formatTeamStory(story: TeamStory): string {
  if (!story.available) {
    return `Live team briefing unavailable (need TAVILY_API_KEY). Fall back to the development diary and say so briefly.`
  }
  if (!story.bullets.length) {
    return `No fresh Formula 1 race/tech notes specifically about ${story.teamName} right now. Do not invent or talk about other teams. Say the paddock is quiet on them and offer the teaching diary or a part explanation instead.`
  }
  const lines = story.bullets.map((b, i) => {
    const src = story.sources[b.sourceIndex]
    const tag = b.kind === "weekend" ? "Weekend" : b.kind === "upgrade" ? "Upgrade" : b.kind === "aero" ? "Aero" : b.kind === "power" ? "Power unit" : "Note"
    return `${i + 1}. [${tag}] ${b.text}${src ? ` (${src.outlet})` : ""}`
  })
  return (
    `Live Formula 1 briefing for ${story.teamName} only (${story.car}). Fetched ${story.fetchedAt}${story.cached ? " (cached)" : ""}.\n` +
    `Stay on this team. Do not pad with other teams, sponsors, or road cars. Cite only these notes. Source chips are in the UI — do not read URLs aloud.\n\n` +
    lines.join("\n")
  )
}
