import type { AgentEvent } from "@/lib/agent/types"
import { runAgent } from "@/lib/server/agent/run"
import { parseAgentRequest } from "@/lib/server/agent/validate"

// POST /api/agent: Lena, the race-engineer agent. Streams AgentEvents as
// NDJSON (one JSON object per line). The model runs on Nebius Token Factory.
export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 })
  }
  const parsed = parseAgentRequest(body)
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AgentEvent) => {
        if (!req.signal.aborted) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }
      // req.signal aborts when the browser disconnects or cancels: the model
      // call and tools stop instead of running on for nobody.
      await runAgent(parsed.value, emit, req.signal)
      emit({ type: "done" })
      try { controller.close() } catch { /* already cancelled by the client */ }
    },
  })
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  })
}
