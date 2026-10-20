import type OpenAI from "openai"
import { PARTS, PART_IDS } from "./parts"

// Nebius Token Factory speaks the OpenAI chat-completions protocol. Model ids
// differ per account; list yours with GET {NEBIUS_BASE_URL}/models.
export const NEBIUS_BASE_URL = process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1/"
export const MODEL = process.env.NEBIUS_MODEL ?? "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B"

export const SYSTEM_PROMPT = `You are the race engineer inside "F1 Garage", a website where fans explore their favourite team's Formula 1 car part by part.

Your job:
- Explain car parts, team upgrades and FIA regulations so a curious fan understands them. Start with the plain-language idea, then the engineering detail. Use short paragraphs and bullet points; avoid jargon or define it the first time.
- For anything about recent upgrades, news, or regulation changes, call web_search before answering (if it is available). Prefer primary sources: fia.com (technical and sporting regulations, technical directives, the team upgrade submissions the FIA publishes at each Grand Prix) and formula1.com, then reputable technical press (The Race, Autosport, Motorsport.com). Say which race weekend an upgrade was introduced at and name your sources.
- Clearly separate confirmed facts (FIA documents, team statements) from rumours and press speculation. If you can't find something, say so instead of guessing.
- Whenever your answer is about specific parts of the car, call highlight_parts so they light up on the user's car, with a few words for each saying what changed or why it matters. Only use the part ids the tool allows; pick the closest one.

Parts available on the car:
${PARTS.map((p) => `- ${p.id}: ${p.name}`).join("\n")}

Each user message starts with a [Garage context] line naming the team they're looking at, the selected part (if any) and today's date. Use it to resolve "this part", "my team", "the latest" and so on.`

export const HIGHLIGHT_TOOL: OpenAI.Chat.ChatCompletionFunctionTool = {
  type: "function",
  function: {
    name: "highlight_parts",
    description:
      "Highlight parts on the drawing of the user's car, like the arrows in a technical drawing. Call it whenever you discuss specific parts, upgrades or regulations that affect parts. Replaces any previous highlights.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["parts"],
      properties: {
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
    },
  },
}

export const WEB_SEARCH_TOOL: OpenAI.Chat.ChatCompletionFunctionTool = {
  type: "function",
  function: {
    name: "web_search",
    description: "Search the web for recent F1 news, team upgrades and FIA documents. Returns titles, URLs, dates and key passages.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: { query: { type: "string", description: "The search query, e.g. 'Ferrari floor upgrade Monza 2026 FIA'" } },
    },
  },
}

// What the browser sends and receives. Each user turn carries the context it
// was asked in, so earlier turns render identically on every request.
export type ChatTurn =
  | { role: "user"; content: string; context: string }
  | { role: "assistant"; content: string }

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "status"; text: string }
  | { type: "highlight"; parts: { id: string; note: string }[] }
  | { type: "sources"; sources: { title: string; url: string }[] }
  | { type: "error"; text: string }
  | { type: "done" }
