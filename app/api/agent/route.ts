import OpenAI from "openai"
import { MODEL, NEBIUS_BASE_URL, SYSTEM_PROMPT, TOOL_LABELS, TOOLS, type AgentEvent, type ChatTurn, type ToolName, type UiCommand } from "@/lib/agent"
import { getCalendar, getLastResult, getLiveSession, getStandings } from "@/lib/f1data"
import { PART_IDS } from "@/lib/parts"
import { searchAvailable, searchWeb, type SearchScope } from "@/lib/search"

export const runtime = "nodejs"
export const maxDuration = 120

const MAX_ITERATIONS = 10

// Nemotron reasoning models may inline their chain of thought as <think>…</think>.
// This splits it from the answer, including tags split across chunks.
function thinkSplitter() {
  let inThink = false
  let buffer = ""
  return (chunk: string) => {
    buffer += chunk
    let answer = ""
    let reasoning = ""
    while (buffer) {
      const tag = inThink ? "</think>" : "<think>"
      const at = buffer.indexOf(tag)
      if (at >= 0) {
        if (inThink) reasoning += buffer.slice(0, at)
        else answer += buffer.slice(0, at)
        buffer = buffer.slice(at + tag.length)
        inThink = !inThink
        continue
      }
      // Hold back a possible partial tag at the end of the chunk.
      let keep = 0
      for (let k = Math.min(tag.length - 1, buffer.length); k > 0; k--) {
        if (tag.startsWith(buffer.slice(-k))) { keep = k; break }
      }
      const out = buffer.slice(0, buffer.length - keep)
      if (inThink) reasoning += out
      else answer += out
      buffer = buffer.slice(buffer.length - keep)
      break
    }
    return { answer, reasoning }
  }
}

type Send = (event: AgentEvent) => void

async function runTool(name: string, args: Record<string, unknown>, send: Send): Promise<string> {
  const ui = (command: UiCommand) => send({ type: "ui", command })
  switch (name as ToolName) {
    case "web_search": {
      const hits = await searchWeb(String(args.query ?? ""), (args.scope as SearchScope) ?? "any")
      send({ type: "sources", sources: hits.map((h) => ({ title: h.title, url: h.url })) })
      return JSON.stringify(hits)
    }
    case "get_live_timing":
      return JSON.stringify((await getLiveSession()) ?? { error: "Live timing unavailable right now." })
    case "get_standings":
      return JSON.stringify((await getStandings()) ?? { error: "Standings unavailable right now." })
    case "get_calendar": {
      const [calendar, lastResult] = await Promise.all([getCalendar(), getLastResult()])
      return JSON.stringify(calendar || lastResult ? { calendar, lastResult } : { error: "Calendar unavailable right now." })
    }
    case "highlight_parts": {
      const parts = (Array.isArray(args.parts) ? args.parts : []).filter((p: { id?: string }) => PART_IDS.includes(String(p?.id)))
      ui({ action: "highlight", parts })
      return `Highlighted ${parts.length} part(s) on the user's car.`
    }
    case "focus_part": {
      if (!PART_IDS.includes(String(args.id))) return `Error: unknown part id "${args.id}".`
      ui({ action: "focus", id: String(args.id) })
      return "The part is now off the car and in focus."
    }
    case "set_view":
      ui({ action: "view", exploded: args.exploded as boolean | undefined, mode: args.mode as "studio" | "drive" | undefined, camera: args.camera as "hero" | undefined })
      return "View updated."
    default:
      return `Error: unknown tool "${name}".`
  }
}

// Streams newline-delimited AgentEvent JSON. All tools run here on the server;
// the UI tools just forward a command to the browser's 3D view.
export async function POST(req: Request) {
  const { turns, deep } = (await req.json()) as { turns: ChatTurn[]; deep?: boolean }

  const client = new OpenAI({ baseURL: NEBIUS_BASE_URL, apiKey: process.env.NEBIUS_API_KEY })
  const tools = Object.values(TOOLS).filter((t) => t.function.name !== "web_search" || searchAvailable())

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...turns.map((t): OpenAI.Chat.ChatCompletionMessageParam =>
      t.role === "user"
        ? { role: "user", content: `[Garage context] ${t.context}\n\n${t.content}` }
        : { role: "assistant", content: t.content },
    ),
  ]

  // "Deep analysis" asks Nemotron to reason before answering. Not every
  // deployment accepts the template switch, so fall back without it once.
  let thinking = Boolean(deep)
  const create = async () => {
    const body = {
      model: MODEL,
      messages,
      tools,
      parallel_tool_calls: true,
      max_tokens: deep ? 16000 : 8000,
      temperature: deep ? 0.5 : 0.6,
      stream: true as const,
      ...(thinking ? { chat_template_kwargs: { enable_thinking: true } } : {}),
    }
    try {
      return await client.chat.completions.create(body)
    } catch (error) {
      if (thinking && error instanceof OpenAI.BadRequestError) {
        thinking = false
        const { chat_template_kwargs: _, ...plain } = body as typeof body & { chat_template_kwargs?: unknown }
        return client.chat.completions.create(plain)
      }
      throw error
    }
  }

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder()
      const send: Send = (event) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"))

      try {
        for (let i = 0; i < MAX_ITERATIONS; i++) {
          const stream = await create()
          const split = thinkSplitter()
          let content = ""
          const calls: { id: string; name: string; args: string }[] = []

          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta as (OpenAI.Chat.ChatCompletionChunk.Choice.Delta & { reasoning_content?: string; reasoning?: string }) | undefined
            if (!delta) continue
            const separate = delta.reasoning_content ?? delta.reasoning
            if (separate) send({ type: "reasoning", text: separate })
            if (delta.content) {
              const { answer, reasoning } = split(delta.content)
              if (reasoning) send({ type: "reasoning", text: reasoning })
              if (answer) { content += answer; send({ type: "text", text: answer }) }
            }
            for (const tc of delta.tool_calls ?? []) {
              const call = (calls[tc.index] ??= { id: "", name: "", args: "" })
              if (tc.id) call.id = tc.id
              if (tc.function?.name) call.name += tc.function.name
              if (tc.function?.arguments) call.args += tc.function.arguments
            }
          }

          if (calls.length === 0) break

          messages.push({
            role: "assistant",
            content: content || null,
            tool_calls: calls.map((c, n) => ({ id: c.id || `call_${i}_${n}`, type: "function", function: { name: c.name, arguments: c.args || "{}" } })),
          })

          // Independent tools run in parallel; results go back in call order.
          const results = await Promise.all(
            calls.map(async (c, n) => {
              let args: Record<string, unknown> = {}
              try {
                args = JSON.parse(c.args || "{}")
              } catch {
                return { id: c.id || `call_${i}_${n}`, content: "Error: arguments were not valid JSON." }
              }
              const label = TOOL_LABELS[c.name as ToolName]?.(args)
              if (label) send({ type: "tool", label })
              try {
                return { id: c.id || `call_${i}_${n}`, content: await runTool(c.name, args, send) }
              } catch (error) {
                return { id: c.id || `call_${i}_${n}`, content: `Error: ${error instanceof Error ? error.message : "tool failed"}` }
              }
            }),
          )
          for (const r of results) messages.push({ role: "tool", tool_call_id: r.id, content: r.content })
          if (content) send({ type: "text", text: "\n\n" })
        }
      } catch (error) {
        const text =
          error instanceof OpenAI.AuthenticationError
            ? "Missing or invalid NEBIUS_API_KEY on the server."
            : error instanceof OpenAI.RateLimitError
              ? "Too many requests right now. Try again in a moment."
              : error instanceof OpenAI.NotFoundError
                ? `Model "${MODEL}" not found on Nebius. Set NEBIUS_MODEL to an id from GET /v1/models.`
                : error instanceof OpenAI.APIError
                  ? `API error ${error.status}: ${error.message}`
                  : "Something went wrong talking to the engineer."
        send({ type: "error", text })
      }
      send({ type: "done" })
      controller.close()
    },
  })

  return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } })
}
