import "server-only"
import type { Team } from "../teams"

/**
 * Official F1 team sites only (not parent road-car brands).
 * Media + FIA stay in STORY_MEDIA_DOMAINS.
 */
export type TeamSite = {
  domain: string
  home: string
  /** Phrases that keep Tavily on the F1 team, not the road-car brand. */
  searchAs: string
  /** If set, team-domain hits must match this path prefix (e.g. Ferrari.com road pages). */
  pathIncludes?: string[]
}

const TEAM_SITES: Record<string, TeamSite> = {
  ferrari: {
    domain: "ferrari.com",
    home: "https://www.ferrari.com/en-EN/formula1",
    searchAs: "Scuderia Ferrari Formula 1",
    pathIncludes: ["/formula1", "/en-EN/formula1"],
  },
  mercedes: {
    domain: "mercedesamgf1.com",
    home: "https://www.mercedesamgf1.com/",
    searchAs: "Mercedes-AMG PETRONAS Formula 1",
  },
  redbull: {
    domain: "redbullracing.com",
    home: "https://www.redbullracing.com/int-en",
    searchAs: "Oracle Red Bull Racing Formula 1",
  },
  mclaren: {
    domain: "mclaren.com",
    home: "https://www.mclaren.com/racing/formula-1/",
    searchAs: "McLaren Formula 1 Racing",
    pathIncludes: ["/racing"],
  },
  astonmartin: {
    domain: "astonmartinf1.com",
    home: "https://www.astonmartinf1.com/en-GB",
    searchAs: "Aston Martin Aramco Formula 1",
  },
  alpine: {
    domain: "alpinef1.com",
    home: "https://www.alpinef1.com/",
    searchAs: "BWT Alpine Formula 1",
  },
  williams: {
    domain: "williamsf1.com",
    home: "https://www.williamsf1.com/",
    searchAs: "Williams Racing Formula 1",
  },
  racingbulls: {
    domain: "visacashapprb.com",
    home: "https://www.visacashapprb.com/int-en",
    searchAs: "Visa Cash App Racing Bulls Formula 1",
  },
  haas: {
    domain: "haasf1team.com",
    home: "https://www.haasf1team.com/",
    searchAs: "Haas F1 Team",
  },
  audi: {
    domain: "audif1.com",
    home: "https://www.audif1.com/en/home",
    searchAs: "Audi Formula 1 Team",
  },
  cadillac: {
    domain: "cadillacf1team.com",
    home: "https://www.cadillacf1team.com/",
    searchAs: "Cadillac Formula 1 Team",
  },
}

/** Trusted F1 media + FIA — stories are restricted to these (+ the team's F1 site). */
export const STORY_MEDIA_DOMAINS = [
  "fia.com",
  "formula1.com",
  "the-race.com",
  "autosport.com",
  "motorsport.com",
  "racefans.net",
  "planetf1.com",
] as const

export function teamSite(team: Team | string): TeamSite | undefined {
  const id = typeof team === "string" ? team : team.id
  return TEAM_SITES[id]
}

/** Domains allowed for a team briefing (hard allowlist). */
export function storyAllowDomains(teamId: string): string[] {
  const site = TEAM_SITES[teamId]
  return site ? [...STORY_MEDIA_DOMAINS, site.domain] : [...STORY_MEDIA_DOMAINS]
}
