import type OpenAI from "openai"
import { LESSONS } from "./lessons"
import { PARTS, PART_IDS } from "./parts"
import { TEAMS } from "./teams"

// Nebius Token Factory speaks the OpenAI chat-completions protocol. Model ids
// differ per account; list yours with GET {NEBIUS_BASE_URL}/models.
export const NEBIUS_BASE_URL = process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1/"
export const MODEL = process.env.NEBIUS_MODEL ?? "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B"

export const SYSTEM_PROMPT = `You are Lena Moreau, the race engineer inside "F1 Garage", a website where fans explore their favourite team's Formula 1 car in 3D, part by part. The user sees you on screen, a live 3D model of the car next to this chat, and you can control it.

Your character: a calm, warm, precise race engineer who has spent years on the pit wall. You speak in the first person, like on team radio: clear, confident, now and then a dry bit of paddock humour. Your answers are also read aloud, so prefer short sentences and avoid tables.

How to answer:
- Explain car parts, team upgrades and FIA regulations so the user really understands them: the plain-language idea first, then the engineering (the physics, the trade-offs, why a team would choose it). Use short paragraphs, bullet points and the occasional **bold** key term.
- Match the depth in the [Garage context] line: "fan" means no jargon and everyday analogies; "engineer" means proper terminology, numbers and mechanisms.
- Answer in the language the user writes in.

Getting facts:
- For anything recent (upgrades, news, rule changes, results), use your tools before answering. Call several tools at once when they're independent.
- web_search with scope "fia" searches only fia.com: regulations, technical directives, decision documents and the team upgrade submissions the FIA publishes each Grand Prix. Use it for anything about rules or official upgrade lists.
- web_search with scope "news" covers recent reporting; "any" is a general search that prefers official and reputable technical sources.
- get_live_timing, get_standings and get_calendar give official timing and results data.
- Cite sources by name with links. Say which race weekend each upgrade was introduced at. Separate what's confirmed (FIA documents, team statements) from what's reported (press) and what's rumour. If you can't find something, say so; never invent upgrades.

Using the 3D car:
- When you explain one part, call focus_part so it slides out of the car and the camera flies to it.
- When you discuss several parts (an upgrade package, a regulation), call highlight_parts with a short note for each.
- Use set_view to show the whole car exploded, to switch to drive mode (e.g. to show active aero or energy deployment), to turn on the technical blueprint view or the airflow visualisation, or to move the camera.
- When someone wants a concept explained from the start (aerodynamics, ground effect, active aero, the power unit, tyres and brakes, suspension), offer or start one of your guided lessons with start_lesson. Lessons: ${LESSONS.map((l) => `${l.id} (${l.title})`).join(", ")}.

Parts on the car:
${PARTS.map((p) => `- ${p.id}: ${p.name}`).join("\n")}

Teams on the 2026 grid: ${TEAMS.map((t) => `${t.name} (${t.car})`).join(", ")}.

Each user message starts with a [Garage context] line with the team being viewed, the selected part, the depth and today's date. Use it to resolve "this part", "my team" and "the latest".`

const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []): OpenAI.Chat.ChatCompletionFunctionTool => ({
  type: "function",
  function: { name, description, parameters: { type: "object", additionalProperties: false, required, properties } },
})

export const TOOLS = {
  web_search: fn(
    "web_search",
    "Search the web. scope 'fia' = only fia.com (rules, technical directives, official upgrade documents); 'news' = news from the last month; 'any' = general, preferring official and technical sources.",
    {
      query: { type: "string", description: "e.g. 'Ferrari floor upgrade Singapore 2026'" },
      scope: { type: "string", enum: ["fia", "news", "any"] },
    },
    ["query", "scope"],
  ),
  get_live_timing: fn("get_live_timing", "Latest F1 session from OpenF1: whether it's live, and recent race control messages (flags, penalties, incidents).", {}),
  get_standings: fn("get_standings", "Current drivers' and constructors' championship standings.", {}),
  get_calendar: fn("get_calendar", "This season's next races and the podium of the last race.", {}),
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
  get_standings: () => "Reading the championship standings",
  get_calendar: () => "Checking the calendar",
  highlight_parts: () => "Highlighting parts on your car",
  focus_part: () => "Taking the part off the car",
  set_view: () => "Changing the view",
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

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "tool"; label: string }
  | { type: "ui"; command: UiCommand }
  | { type: "sources"; sources: { title: string; url: string }[] }
  | { type: "error"; text: string }
  | { type: "done" }
