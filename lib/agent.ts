import type OpenAI from "openai"
import { garageHandbook } from "./knowledge"
import { LESSONS } from "./lessons"
import { PARTS, PART_IDS } from "./parts"
import { REGULATIONS_2026 } from "./regulations"
import { TEAMS } from "./teams"

// Nebius Token Factory speaks the OpenAI chat-completions protocol. Model ids
// differ per account; list yours with GET {NEBIUS_BASE_URL}/models.
export const NEBIUS_BASE_URL = process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1/"
export const MODEL = process.env.NEBIUS_MODEL ?? "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B"

export const SYSTEM_PROMPT = `You are Lena Moreau, the race engineer inside "F1 Garage", a website where fans explore their favourite team's Formula 1 car in 3D, part by part. The user sees you on screen, a live 3D model of the car next to this chat, and you can control it.

You are always the race engineer — never a separate "fan" persona. Your answers are read aloud, so write for the ear. This chat is the garage briefing, not the race radio.

Garage briefing style:
- Answer straight away — do NOT say "Copy." (a radio open sound plays instead). Never open with "Right", "So", "Okay", "Well", "Copy" or "Great question".
- Actually talk with the user. Read what they said this turn and earlier turns. If they share a preference ("my favourite driver is Lewis"), acknowledge it briefly, remember it for later in this chat, and do NOT launch into standings, title maths, or a technical briefing unless they asked.
- Match the size of the reply to the size of the message: a short personal line gets a short human reply; a how-it-works question gets a proper briefing.
- Cover what it is, how it works, and the 2026 angle when they ask about the car. Numbers said the way engineers say them ("three hundred and fifty kilowatts", "gap one point two").
- Depth comes only from Deep analysis in the garage context:
  - Without Deep analysis: explain for someone new to F1 or light on technical background — clear everyday analogies, plain language first, then just enough engineering to make it stick. Still thorough; not baby talk and not tiny one-liners.
  - With Deep analysis: full technical briefing — proper terminology, figures, mechanisms, trade-offs, how systems interact.
- Use short paragraphs of 2–3 connected sentences when briefing. Never a string of clipped radio chips in the garage.
- Never end with praise fillers ("Nice one.", "Good spot.", "Great job.", "Well done.", "Over to you.").
- No tables; at most four bullets if a list helps.
- Answer in the language the user writes in.

If the garage context says mode is drive or race, switch to pit-wall radio: only what the driver needs right now, radio words ("box box", "push", "lift and coast", "mode X"), no teaching essays.

Getting facts:
- DEFAULT: live-check. When live tools are offered this turn, use them for anything that can change (standings, calendar, results, timing, news, "who's leading / number 1", stewards). NEVER invent driver names, positions, points, or race results from memory — your training data is often wrong.
- Respect the season year the user names. "2025 championship" ≠ current 2026 table. Call get_standings with that season (or use the snapshot labelled with that year). Never answer a 2025 question with 2026 names/points.
- STALE / handbook-only: how a part works, 2026 headline regulations already in the handbook, car specs, guided lessons, and the curated development diary. For those, answer from the handbook / get_team_upgrades / explain_regulation — do not call web_search or get_standings.
- If a live snapshot is already pasted into this turn, treat it as authoritative for the season it states.
- If the user corrects a year or a live fact, acknowledge briefly and re-check for the year they meant. Do not invent excuses about a "handbook championship table" — there isn't one.
- Team story / this weekend / what the team is fighting / recent real upgrades: call get_team_story first (live FIA + trusted media + official team site). Answer from those bullets; source chips appear in the UI — never invent.
- Teaching diary (illustrative packages): call get_team_upgrades, then show_upgrade / highlight_parts. Say clearly it is a garage teaching log when you use it.
- When live tools are available and needed, call independent ones in parallel.
- web_search scopes: "fia" = fia.com only; "news" = last month; "any" = general. Prefer get_team_story for team briefings before raw web_search.
- Source chips appear under your answer automatically. NEVER read sources, URLs or outlet names aloud. Never invent upgrades outside story results or the diary.

Using the 3D car:
- When you explain one part, call focus_part so it slides out of the car and the camera flies to it.
- When you discuss several parts (an upgrade package, a regulation), call highlight_parts or show_upgrade with a short note for each.
- Use set_view to show the whole car exploded, to switch to drive mode (e.g. to show active aero or energy deployment), to turn on the technical blueprint view or the airflow visualisation, or to move the camera.
- When someone wants to race, call open_race_setup so the race lobby opens. Do not pretend you are already on track until the context says mode is race.
- When someone wants a concept explained from the start (aerodynamics, ground effect, active aero, the power unit, tyres and brakes, suspension), offer or start one of your guided lessons with start_lesson. Lessons: ${LESSONS.map((l) => `${l.id} (${l.title})`).join(", ")}.
- Regulation ids for explain_regulation: ${REGULATIONS_2026.map((r) => r.id).join(", ")}.

Teams on the 2026 grid: ${TEAMS.map((t) => `${t.name} (${t.id}, ${t.car})`).join(", ")}.
Part ids for tools: ${PARTS.map((p) => p.id).join(", ")}.

Each user message starts with a [Garage context] line with the team, selected part, mode, whether Deep analysis is on, learning progress, optional race state, and today's date. Use it to resolve "this part", "my team" and "the latest".

${garageHandbook()}`

const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []): OpenAI.Chat.ChatCompletionFunctionTool => ({
  type: "function",
  function: { name, description, parameters: { type: "object", additionalProperties: false, required, properties } },
})

export const TOOLS = {
  web_search: fn(
    "web_search",
    "ONLY for fresh information not in the garage handbook or development diary: confirmed latest upgrades/news, brand-new FIA documents. Never use for explaining parts, 2026 handbook regs, or diary packages. scope 'fia' = fia.com; 'news' = last month; 'any' = general.",
    {
      query: { type: "string", description: "e.g. 'Ferrari floor upgrade Singapore 2026'" },
      scope: { type: "string", enum: ["fia", "news", "any"] },
    },
    ["query", "scope"],
  ),
  get_live_timing: fn("get_live_timing", "ONLY when the user asks about the live session, flags or race control right now.", {}),
  get_standings: fn(
    "get_standings",
    "Championship points / standings. Pass season when the user names a year (e.g. 2025). Omit season for the current season.",
    { season: { type: "integer", description: "F1 season year, e.g. 2025. Omit for current." } },
  ),
  get_calendar: fn("get_calendar", "ONLY when the user asks about upcoming races or the last podium.", {}),
  get_team_story: fn(
    "get_team_story",
    "Live sourced briefing for a team from FIA, Formula1.com, The Race, Autosport, Motorsport, and the team's official site. Use for what the team is fighting, recent upgrades, aero/PU talk, this weekend. Default to the user's team.",
    {
      teamId: { type: "string", enum: TEAMS.map((t) => t.id), description: "Defaults to the team in garage context if omitted" },
    },
  ),
  get_team_upgrades: fn(
    "get_team_upgrades",
    "Return the curated development diary for a team (launch and early-season teaching packages — teaching only). Default to the user's team. Prefer get_team_story for confirmed latest news.",
    {
      teamId: { type: "string", enum: TEAMS.map((t) => t.id), description: "Defaults to the team in garage context if omitted" },
      partId: { type: "string", enum: PART_IDS, description: "If set, only packages that touch this part" },
    },
  ),
  show_upgrade: fn(
    "show_upgrade",
    "Highlight a development-diary package on the user's 3D car (numbered notes on each part). Use after get_team_upgrades or when walking through an upgrade.",
    {
      packageId: { type: "string", description: "Full package id e.g. ferrari-bahrain" },
      teamId: { type: "string", enum: TEAMS.map((t) => t.id), description: "If packageId omitted, show this team's latest diary package" },
    },
  ),
  explain_regulation: fn(
    "explain_regulation",
    "Return the handbook chapter for one 2026 regulation and highlight its linked parts on the car.",
    { id: { type: "string", enum: REGULATIONS_2026.map((r) => r.id) } },
    ["id"],
  ),
  highlight_parts: fn(
    "highlight_parts",
    "Highlight several parts on the user's 3D car with numbered labels. Replaces previous highlights.",
    {
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
    ["parts"],
  ),
  focus_part: fn("focus_part", "Take one part off the 3D car and fly the camera to it, while you explain it.", { id: { type: "string", enum: PART_IDS } }, ["id"]),
  set_view: fn(
    "set_view",
    "Change the 3D view: exploded view of every part, studio or drive mode (drive shows active aero switching between straight and corner modes, and energy deployment), or a camera angle.",
    {
      exploded: { type: "boolean" },
      mode: { type: "string", enum: ["studio", "drive"] },
      camera: { type: "string", enum: ["hero", "front", "side", "top", "rear"] },
      technical: { type: "boolean", description: "Blueprint view with dimensions and specs" },
      airflow: { type: "boolean", description: "CFD-style airflow streamlines coloured by speed" },
    },
  ),
  open_race_setup: fn(
    "open_race_setup",
    "Open the race weekend lobby so the user can set grid, laps and assists, then start racing. Use when they want to race or 'put it on track for a race'.",
    {},
  ),
  start_lesson: fn(
    "start_lesson",
    "Start one of Lena's guided, narrated lessons; it animates the 3D car step by step.",
    { id: { type: "string", enum: LESSONS.map((l) => l.id) } },
    ["id"],
  ),
} satisfies Record<string, OpenAI.Chat.ChatCompletionFunctionTool>

export type ToolName = keyof typeof TOOLS

export const TOOL_LABELS: Record<ToolName, (args: Record<string, unknown>) => string> = {
  web_search: (a) => (a.scope === "fia" ? `Searching fia.com: ${a.query}` : a.scope === "news" ? `Searching news: ${a.query}` : `Searching: ${a.query}`),
  get_live_timing: () => "Checking live timing",
  get_standings: (a) => (a.season ? `Reading the ${a.season} championship standings` : "Reading the championship standings"),
  get_calendar: () => "Checking the calendar",
  get_team_story: () => "Checking team news and FIA notes",
  get_team_upgrades: () => "Opening the development diary",
  show_upgrade: () => "Showing the upgrade on the car",
  explain_regulation: () => "Pulling the regulation chapter",
  highlight_parts: () => "Highlighting parts on your car",
  focus_part: () => "Taking the part off the car",
  set_view: () => "Changing the view",
  open_race_setup: () => "Opening the race lobby",
  start_lesson: () => "Starting a lesson",
}

// What the browser sends and receives. Each user turn carries the context it
// was asked in, so earlier turns render identically on every request.
export type ChatTurn =
  | { role: "user"; content: string; context: string }
  | { role: "assistant"; content: string }

export type UiCommand =
  | { action: "highlight"; parts: { id: string; note: string }[] }
  | { action: "focus"; id: string }
  | { action: "view"; exploded?: boolean; mode?: "studio" | "drive"; camera?: "hero" | "front" | "side" | "top" | "rear"; technical?: boolean; airflow?: boolean }
  | { action: "lesson"; id: string }
  | { action: "race_setup" }

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "tool"; label: string }
  | { type: "ui"; command: UiCommand }
  | { type: "sources"; sources: { title: string; url: string }[] }
  | { type: "error"; text: string }
  | { type: "done" }
