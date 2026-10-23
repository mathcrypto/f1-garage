import "server-only"
import type OpenAI from "openai"
import type { AgentEvent, Source, UiCommand } from "../../agent/types"
import { LESSONS } from "../../lessons"
import { PART_IDS } from "../../parts"
import { formatRegulation, regulationById, REGULATIONS_2026 } from "../../regulations"
import { TEAMS } from "../../teams"
import { formatTeamUpgrades, formatUpgrade, latestUpgrade, upgradeById, upgradesForPart, upgradesForTeam, upgradeSources } from "../../upgrades"
import { searchAvailable } from "../env"
import { getCalendar, getLastResult, getLiveSession, getStandings } from "../f1data"
import { searchWeb, type SearchScope } from "../search"
import { fetchTeamStory, formatTeamStory } from "../teamStory"

// Lena's tools. Each one keeps its schema, the progress label shown in the
// chat, argument validation and the handler together. Handlers return data
// for the model (the system prompt says how to use it) and drive the 3D car
// through `emit`.

export type ToolContext = {
  /** Team in the garage context; used when the model omits teamId. */
  teamId: string
  /** Season the user named, if any. */
  season: number | null
  emit: (event: AgentEvent) => void
}

type Args = Record<string, unknown>

/** A tool refusing its arguments. Reported to the model, and shown as a failed step. */
export class ToolError extends Error {}
const fail = (message: string): never => { throw new ToolError(message) }
type Tool = {
  /** "live": calls an external API (gated per turn); "garage": local data or car control. */
  kind: "live" | "garage"
  description: string
  parameters: Record<string, unknown>
  required?: string[]
  label: (args: Args) => string
  run: (args: Args, ctx: ToolContext) => Promise<string>
}

const TEAM_IDS = TEAMS.map((t) => t.id)
const CAMERAS = ["hero", "front", "side", "top", "rear"] as const

// Argument helpers: models sometimes send wrong types or ids outside the enum.
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined => (allowed.includes(v as T) ? (v as T) : undefined)
const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined)
const teamOf = (args: Args, ctx: ToolContext) => oneOf(args.teamId, TEAM_IDS) ?? ctx.teamId
const json = (data: unknown) => JSON.stringify(data)
const ui = (ctx: ToolContext, command: UiCommand) => ctx.emit({ type: "ui", command })
const sources = (ctx: ToolContext, list: Source[]) => { if (list.length) ctx.emit({ type: "sources", sources: list }) }

const TOOLS = {
  web_search: {
    kind: "live",
    description: "Fresh information not in the handbook or the declared upgrades list: confirmed latest news and brand-new FIA documents. Not for explaining parts, 2026 headline rules or the curated upgrades. scope 'fia' = fia.com, 'news' = last month, 'any' = general.",
    parameters: {
      query: { type: "string", description: "e.g. 'Ferrari floor upgrade Singapore 2026'" },
      scope: { type: "string", enum: ["fia", "news", "any"] },
    },
    required: ["query", "scope"],
    label: (a) => (a.scope === "fia" ? `Searching fia.com: ${str(a.query)}` : a.scope === "news" ? `Searching the news: ${str(a.query)}` : `Searching the web: ${str(a.query)}`),
    async run(a, ctx) {
      const query = str(a.query)
      if (!query) fail("query is required")
      const hits = await searchWeb(query, oneOf<SearchScope>(a.scope, ["fia", "news", "any"]) ?? "any")
      sources(ctx, hits.map((h) => ({ title: h.title, url: h.url })))
      return json({ results: hits })
    },
  },
  get_live_timing: {
    kind: "live",
    description: "The live or latest session: flags and race control messages. Only when the user asks about what's happening on track right now.",
    parameters: {},
    label: () => "Checking live timing",
    run: async () => json((await getLiveSession()) ?? fail("Live timing is unavailable right now.")),
  },
  get_standings: {
    kind: "live",
    description: "Drivers' and constructors' championship standings. Pass season when the user names a year; omit it for the current season.",
    parameters: { season: { type: "integer", description: "Season year, e.g. 2025. Omit for the current season." } },
    label: (a) => (a.season ? `Reading the ${a.season} standings` : "Reading the championship standings"),
    async run(a, ctx) {
      const season = Number.isInteger(a.season) ? (a.season as number) : ctx.season
      return json((await getStandings(season)) ?? fail("Standings are unavailable right now."))
    },
  },
  get_calendar: {
    kind: "live",
    description: "Upcoming races and the last podium. Only when the user asks about the schedule or the last race.",
    parameters: {},
    label: () => "Checking the calendar",
    async run() {
      const [calendar, lastResult] = await Promise.all([getCalendar(), getLastResult()])
      return json(calendar || lastResult ? { calendar, lastResult } : fail("The calendar is unavailable right now."))
    },
  },
  get_team_story: {
    kind: "live",
    description: "Sourced briefing on one team from the FIA, Formula1.com, The Race, Autosport, Motorsport and the team's official site: what they're fighting, recent upgrades, this weekend. Defaults to the user's team.",
    parameters: { teamId: { type: "string", enum: TEAM_IDS, description: "Defaults to the team in the garage context" } },
    label: () => "Checking team news and FIA notes",
    async run(a, ctx) {
      const story = await fetchTeamStory(teamOf(a, ctx))
      sources(ctx, story.sources.map((s) => ({ title: `${s.outlet}: ${s.title}`, url: s.url })))
      return formatTeamStory(story)
    },
  },
  get_team_upgrades: {
    kind: "garage",
    description: "A team's real 2026 upgrades as declared to the FIA (event, parts changed, source). Defaults to the user's team. The list may not include the newest race: for that, use get_team_story.",
    parameters: {
      teamId: { type: "string", enum: TEAM_IDS, description: "Defaults to the team in the garage context" },
      partId: { type: "string", enum: PART_IDS, description: "Only packages that touch this part" },
    },
    label: () => "Looking up the upgrades",
    async run(a, ctx) {
      const team = teamOf(a, ctx)
      const part = oneOf(a.partId, PART_IDS)
      const list = part ? upgradesForPart(team, part) : upgradesForTeam(team)
      sources(ctx, upgradeSources(list))
      if (!part) return formatTeamUpgrades(team)
      return list.length ? list.map(formatUpgrade).join("\n\n") : json({ result: `No sourced upgrade to ${part} for this team in the list.` })
    },
  },
  show_upgrade: {
    kind: "garage",
    description: "Highlight an upgrade package on the user's 3D car, with a numbered note on each part.",
    parameters: {
      packageId: { type: "string", description: "Package id from get_team_upgrades, e.g. ferrari-miami" },
      teamId: { type: "string", enum: TEAM_IDS, description: "Without packageId, shows this team's latest package" },
    },
    label: () => "Showing the upgrade on the car",
    async run(a, ctx) {
      const pack = upgradeById(str(a.packageId)) ?? latestUpgrade(teamOf(a, ctx))
      if (!pack) return fail("Unknown package. Call get_team_upgrades to list them.")
      ui(ctx, { action: "highlight", parts: pack.parts })
      sources(ctx, upgradeSources([pack]))
      return `Shown on the car: ${formatUpgrade(pack)}`
    },
  },
  explain_regulation: {
    kind: "garage",
    description: "The handbook chapter for one 2026 regulation; also highlights its parts on the car.",
    parameters: { id: { type: "string", enum: REGULATIONS_2026.map((r) => r.id) } },
    required: ["id"],
    label: () => "Pulling the regulation chapter",
    async run(a, ctx) {
      const reg = regulationById(str(a.id))
      if (!reg) return fail(`Unknown regulation id "${str(a.id)}".`)
      ui(ctx, { action: "highlight", parts: reg.parts.map((id) => ({ id, note: reg.title })) })
      return formatRegulation(reg)
    },
  },
  highlight_parts: {
    kind: "garage",
    description: "Highlight several parts on the user's 3D car with numbered labels. Replaces earlier highlights.",
    parameters: {
      parts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "note"],
          properties: {
            id: { type: "string", enum: PART_IDS },
            note: { type: "string", description: "Under 12 words: what changed or why it matters." },
          },
        },
      },
    },
    required: ["parts"],
    label: () => "Highlighting parts on your car",
    async run(a, ctx) {
      const parts = (Array.isArray(a.parts) ? a.parts : [])
        .map((p: { id?: unknown; note?: unknown }) => ({ id: oneOf(p?.id, PART_IDS), note: str(p?.note).slice(0, 120) }))
        .filter((p): p is { id: string; note: string } => Boolean(p.id))
      if (!parts.length) return fail("No valid part ids.")
      ui(ctx, { action: "highlight", parts })
      return json({ highlighted: parts })
    },
  },
  focus_part: {
    kind: "garage",
    description: "Take one part off the 3D car and fly the camera to it while you explain it.",
    parameters: { id: { type: "string", enum: PART_IDS } },
    required: ["id"],
    label: () => "Taking the part off the car",
    async run(a, ctx) {
      const id = oneOf(a.id, PART_IDS)
      if (!id) return fail(`Unknown part id "${str(a.id)}".`)
      ui(ctx, { action: "focus", id })
      return json({ focused: id })
    },
  },
  set_view: {
    kind: "garage",
    description: "Change the 3D view in the garage: exploded view of every part, blueprint view, airflow, or a camera angle. The car only goes on track when the user starts the showcase, a drive or a race.",
    parameters: {
      exploded: { type: "boolean" },
      camera: { type: "string", enum: CAMERAS },
      technical: { type: "boolean", description: "Blueprint view with dimensions and specs" },
      airflow: { type: "boolean", description: "CFD-style airflow streamlines coloured by speed" },
    },
    label: () => "Changing the view",
    async run(a, ctx) {
      const command: UiCommand = {
        action: "view",
        exploded: bool(a.exploded),
        camera: oneOf(a.camera, CAMERAS),
        technical: bool(a.technical),
        airflow: bool(a.airflow),
      }
      ui(ctx, command)
      return json({ view: command })
    },
  },
  open_race_setup: {
    kind: "garage",
    description: "Open the race lobby so the user can set the grid, laps and assists, then race.",
    parameters: {},
    label: () => "Opening the race lobby",
    async run(_a, ctx) {
      ui(ctx, { action: "race_setup" })
      return json({ opened: "race lobby" })
    },
  },
  start_lesson: {
    kind: "garage",
    description: "Start one of Lena's guided, narrated lessons; it animates the 3D car step by step.",
    parameters: { id: { type: "string", enum: LESSONS.map((l) => l.id) } },
    required: ["id"],
    label: () => "Starting a lesson",
    async run(a, ctx) {
      const id = oneOf(a.id, LESSONS.map((l) => l.id))
      if (!id) return fail(`Unknown lesson "${str(a.id)}".`)
      ui(ctx, { action: "lesson", id })
      return json({ playing: id, note: "Lena narrates the lesson herself." })
    },
  },
} satisfies Record<string, Tool>

export type ToolName = keyof typeof TOOLS

export const isToolName = (name: string): name is ToolName => name in TOOLS

export const toolLabel = (name: ToolName, args: Args) => TOOLS[name].label(args)

/** Tool definitions for the model. Live tools only when this turn needs fresh data. */
export function toolDefinitions(options: { live: boolean }): OpenAI.Chat.ChatCompletionFunctionTool[] {
  return (Object.entries(TOOLS) as [ToolName, Tool][])
    .filter(([name, tool]) => {
      if (tool.kind === "garage") return true
      if (!options.live) return false
      return name === "web_search" || name === "get_team_story" ? searchAvailable() : true
    })
    .map(([name, tool]) => ({
      type: "function",
      function: {
        name,
        description: tool.description,
        parameters: { type: "object", additionalProperties: false, required: tool.required ?? [], properties: tool.parameters },
      },
    }))
}

export function runTool(name: ToolName, args: Args, ctx: ToolContext): Promise<string> {
  return TOOLS[name].run(args, ctx)
}
