import OpenAI from "openai"
import { HIGHLIGHT_TOOL, MODEL, NEBIUS_BASE_URL, SYSTEM_PROMPT, WEB_SEARCH_TOOL, type AgentEvent, type ChatTurn } from "@/lib/agent"
import { searchAvailable, searchWeb } from "@/lib/search"

export const runtime = "nodejs"

const MAX_ITERATIONS = 8

// Nemotron reasoning models may inline their chain of thought as <think>…</think>.
// This drops it from the visible stream, including tags split across chunks.
function thinkFilter() {
  let inThink = false
  let buffer = ""
  return (chunk: string) => {
    buffer += chunk
    let out = ""
    while (buffer) {
      const tag = inThink ? "</think>" : "<think>"
      const at = buffer.indexOf(tag)
      if (at >= 0) {
        if (!inThink) out += buffer.slice(0, at)
        buffer = buffer.slice(at + tag.length)
        inThink = !inThink
        continue
      }
      // Hold back a possible partial tag at the end of the chunk.
      let keep = 0
      for (let k = Math.min(tag.length - 1, buffer.length); k > 0; k--) {
        if (tag.startsWith(buffer.slice(-k))) { keep = k; break }
      }
      if (!inThink) out += buffer.slice(0, buffer.length - keep)
      buffer = buffer.slice(buffer.length - keep)
      break
    }
    return out
  }
}

// Streams newline-delimited AgentEvent JSON. Both tools run here on the
// server: web_search calls Exa, highlight_parts only tells the browser which
// parts to light up.
export async function POST(req: Request) {
  const { turns } = (await req.json()) as { turns: ChatTurn[] }

  const client = new OpenAI({ baseURL: NEBIUS_BASE_URL, apiKey: process.env.NEBIUS_API_KEY })
  const tools = searchAvailable() ? [WEB_SEARCH_TOOL, HIGHLIGHT_TOOL] : [HIGHLIGHT_TOOL]

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...turns.map((t): OpenAI.Chat.ChatCompletionMessageParam =>
      t.role === "user"
        ? { role: "user", content: `[Garage context] ${t.context}\n\n${t.content}` }
        : { role: "assistant", content: t.content },
    ),
  ]

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (event: AgentEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"))

      try {
        for (let i = 0; i < MAX_ITERATIONS; i++) {
          const stream = await client.chat.completions.create({
            model: MODEL,
            messages,
            tools,
            max_tokens: 8000,
            temperature: 0.6,
            stream: true,
          })

          const visible = thinkFilter()
          let content = ""
          const calls: { id: string; name: string; args: string }[] = []

          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta
            if (!delta) continue
            if (delta.content) {
              const text = visible(delta.content)
              content += text
              if (text) send({ type: "text", text })
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
            tool_calls: calls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.args } })),
          })

          for (const call of calls) {
            let result: string
            try {
              const input = JSON.parse(call.args || "{}")
              if (call.name === HIGHLIGHT_TOOL.function.name && Array.isArray(input.parts)) {
                send({ type: "highlight", parts: input.parts })
                result = "Highlighted on the user's car."
              } else if (call.name === WEB_SEARCH_TOOL.function.name && typeof input.query === "string") {
                send({ type: "status", text: `Searching: ${input.query}` })
                const hits = await searchWeb(input.query)
                send({ type: "sources", sources: hits.map((h) => ({ title: h.title, url: h.url })) })
                result = JSON.stringify(hits)
              } else {
                result = `Error: unknown tool "${call.name}" or missing arguments.`
              }
            } catch (error) {
              result = `Error: ${error instanceof Error ? error.message : "tool failed"}`
            }
            messages.push({ role: "tool", tool_call_id: call.id, content: result })
          }
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
