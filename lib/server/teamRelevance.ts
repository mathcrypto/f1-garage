import "server-only"
import { teamById } from "../teams"
import { teamSite, STORY_MEDIA_DOMAINS } from "./teamSites"

/**
 * Keep hits about THIS Formula 1 team’s racing / car development only.
 * Prefer real articles over team-site video / merch pages.
 */

const RACE_TECH =
  /\b(upgrade|upgrades|specification|spec split|aero|aerodynam|floor|wing|chassis|sidepod|diffuser|power unit|\bpu\b|mgu|ers|battery|practice|\bfp[123]\b|qualifying|grand prix|\bgp\b|preview|race report|lap time|downforce|set-?up|balance|porpois|technical directive|\btd\b|document\s*38|development|pace|tyre|tire|brake|suspension|active aero|x-?mode|z-?mode|paddock|pit wall|race weekend|podium|fastest lap|constructors?|championship|finish(?:ed|ing)?|grid|sprint|breakthrough|tech weekly)\b/i

const FLUFF =
  /\b(sponsor|sponsorship|partners? with|signs with|signed with|global sports|adweek|advertising|campaign debut|merchandise|asking price|auction|sell(?:ing|s)?\b.*\bcars?\b|historic (f1 )?cars?|heritage|museum|singing toilet|liquid i\.?v|abbvie|sports business journal|fan zone giveaway|apparel|capsule collection|esports collaboration|memento exclusives|collaboration extension|best seats in the house|show car|talking bull|presented by|vip trip|win a\b|fan1\b)\b/i

const ROAD =
  /\b(suv|crossover|gle|gla|gls|eqe|eqs|maybach|wlTP|kwh\/100|road car|street[- ]legal|affalterbach)\b/i

/** Team marketing / video URLs — not usable as news. */
const JUNK_PATH =
  /\/(videos?|projects?|shop|store|gaming|esports|exclusives?|merchandise|apparel)\b|memento|best-seats|talking-bull|oracle-strategy-series/i

function teamAliases(teamId: string): string[] {
  const t = teamById(teamId)
  const site = teamSite(teamId)
  const base = [t.name, t.name.replace(/^Scuderia /, ""), t.car, t.code, site?.searchAs]
    .filter(Boolean)
    .map((s) => s!.toLowerCase())

  const extra: Record<string, string[]> = {
    ferrari: ["scuderia ferrari", "sf-26", "ferrari f1", "ferrari team", "ferrari"],
    mercedes: ["mercedes-amg petronas", "mercedes f1", "mercedes team", "mercedes", "w17"],
    redbull: ["red bull racing", "oracle red bull", "red bull", "rb22", "red bull team"],
    mclaren: ["mclaren racing", "mclaren formula", "mclaren team", "mclaren", "mcl40"],
    astonmartin: ["aston martin f1", "aston martin aramco", "aston martin team", "aston martin", "amr26"],
    alpine: ["alpine f1", "bwt alpine", "alpine team", "alpine"],
    williams: ["williams racing", "williams f1", "williams team", "williams", "fw48"],
    racingbulls: ["racing bulls", "visa cash app rb", "visa cash app racing", "vcarb", "vcarb 03"],
    haas: ["haas f1", "haas team", "haas", "vf-26"],
    audi: ["audi f1", "audi revolut", "audi team", "audi", "r26"],
    cadillac: ["cadillac f1", "cadillac formula", "cadillac team", "cadillac"],
  }
  return [...new Set([...base, ...(extra[teamId] ?? [])])].filter((a) => a.length >= 3)
}

function includesAlias(text: string, aliases: string[]): boolean {
  const t = text.toLowerCase()
  return aliases.some((a) => t.includes(a))
}

/** Headline must name this team (avoids hub pages and rival articles). */
function aboutThisTeam(title: string, teamId: string): boolean {
  return includesAlias(title.toLowerCase(), teamAliases(teamId))
}

function isJunkNewsUrl(url: string): boolean {
  try {
    return JUNK_PATH.test(new URL(url).pathname + new URL(url).href)
  } catch {
    return true
  }
}

/** Content scrape looks like a page shell, not an article. */
export function isJunkSnippet(title: string, content: string): boolean {
  const body = content.replace(/\s+/g, " ").trim()
  if (/^#{1,6}\s|©\s*getty|^\d+:\d+\s*min\s*f1/i.test(body)) return true
  if ((body.match(/#{2,}/g) ?? []).length >= 2) return true
  // Title is usable even if body is junk — only flag body.
  void title
  return false
}

function isMediaHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "")
    return STORY_MEDIA_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))
  } catch {
    return false
  }
}

/** Race / car development for this team — not ads, auctions, videos, or other teams. */
export function isRelevantTeamArticle(title: string, content: string, teamId: string, url = ""): boolean {
  if (url && isJunkNewsUrl(url)) return false
  const blob = `${title}\n${content}`
  if (FLUFF.test(blob)) return false
  if (ROAD.test(blob) && !RACE_TECH.test(blob)) return false
  if (!aboutThisTeam(title, teamId)) return false
  // Title alone can carry race/tech signal when body is a messy scrape.
  if (!RACE_TECH.test(blob) && !RACE_TECH.test(title)) return false
  return true
}

/** Higher = better for the news list (media race articles first). */
export function newsScore(title: string, content: string, url: string): number {
  let score = 0
  if (isMediaHost(url)) score += 40
  if (/\b(upgrade|tech weekly|specification|aero|floor|chassis)\b/i.test(title)) score += 25
  if (/\b(grand prix|qualifying|practice|preview|race report)\b/i.test(title)) score += 15
  if (isJunkNewsUrl(url)) score -= 80
  if (FLUFF.test(`${title} ${content}`)) score -= 50
  if (isJunkSnippet(title, content)) score -= 10
  return score
}
