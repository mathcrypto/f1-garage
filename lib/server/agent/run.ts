import "server-only"
import OpenAI from "openai"
import { LIMITS, type AgentEvent, type ChatTurn } from "../../agent/types"
import { findUpgrade, latestUpgrade, narrateUpgrade, upgradeById } from "../../upgrades"
import { env } from "../env"
import { getStandings } from "../f1data"
import { isChampionshipQuestion, isConversationalShare, needsFreshData, requestedSeason } from "./knowledge"
import { contextLine, SYSTEM_PROMPT } from "./prompt"
import { openingFilter, thinkSplitter } from "./text"
import { isToolName, runTool, ToolError, toolDefinitions, toolLabel, type ToolContext } from "./tools"

// Lena is a single agent with tools: one model (NVIDIA Nemotron on Nebius
// Token Factory) that plans, calls tools in parallel and answers. For a chat
// with a 3D car, one agent with well-described tools is faster and more
// predictable than an orchestrator with sub-agents.
//
// Loop: stream a step → run any tool calls in parallel → feed results back →
// repeat, up to MAX_TOOL_STEPS. After that the model must answer in text.

const MAX_TOOL_STEPS = 2
const TOOL_TIMEOUT_MS = 15_000
const MAX_TOOL_RESULT = 6_000 // characters per tool result sent back to the model

type Emit = (event: AgentEvent) => void
type Message = OpenAI.Chat.ChatCompletionMessageParam

let client: OpenAI | null = null
const nebius = () => (client ??= new OpenAI({ baseURL: env.nebius.baseUrl, apiKey: env.nebius.apiKey ?? "missing" }))

function withTimeout<T>(promise: Promise<T>, ms: number, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms / 1000}s`)), ms)
    const onAbort = () => reject(new Error("aborted"))
    signal.addEventListener("abort", onAbort, { once: true })
    promise.then(resolve, reject).finally(() => {
      clearTimeout(timer)
      signal.removeEventListener("abort", onAbort)
    })
  })
}

/** Championship snapshot pasted into the turn when the user asks about the table. */
async function standingsNote(lastUser: string, priorUser: string, fresh: boolean, season: number | null) {
  const asks =
    !isConversationalShare(lastUser) &&
    (isChampionshipQuestion(lastUser) ||
      (fresh && /\b(standings?|championship|leader|leading|ranking|points|who('s| is)|number\s*1|#1|won|champion)\b/i.test(lastUser)) ||
      (Boolean(priorUser) &&
        isChampionshipQuestion(priorUser) &&
        /\b(wrong|incorrect|actually|still|who|what|which|again|really|currently|now|points|position|rank|name|won|leader|leading)\b/i.test(lastUser)))
  if (!asks) return null
  const standings = await getStandings(season)
  if (!standings?.drivers?.length) return null
  const year = standings.season ?? season ?? "current"
  const drivers = standings.drivers.slice(0, 8).map((d) => `P${d.position} ${d.driver} (${d.team ?? "?"}) ${d.points} pts`).join("; ")
  const teams = standings.constructors.slice(0, 5).map((c) => `P${c.position} ${c.team} ${c.points}`).join("; ")
  return `Live snapshot. ${year} drivers' championship after round ${standings.afterRound ?? "?"}: ${drivers}. Constructors: ${teams}. Authoritative for the ${year} season only.`
}

/** A spoken answer when the model only called tools (common with show_upgrade). */
function fallbackAnswer(teamId: string, question: string, toolResults: string[]): string {
  const shown = toolResults.find((t) => t.startsWith("Shown on the car:"))
  const match = shown && /\[([^\]]+)\]\s+([^\n(]+)/.exec(shown)
  const pack =
    (match && findUpgrade(teamId, match[2])) ||
    (shown && upgradeById(`${teamId}-launch`)) ||
    findUpgrade(teamId, question) ||
    (/\bupgrade|package|diary\b/i.test(question) ? latestUpgrade(teamId) : undefined)
  if (pack) return narrateUpgrade(pack)
  if (toolResults.length) return "I've updated the car for you. Ask me to walk you through it if you want the full briefing."
  return ""
}

function friendlyError(error: unknown): string {
  if (error instanceof OpenAI.AuthenticationError) return "The server's NEBIUS_API_KEY is missing or invalid."
  if (error instanceof OpenAI.RateLimitError) return "Too many requests right now. Try again in a moment."
  if (error instanceof OpenAI.NotFoundError) return `Model "${env.nebius.model}" isn't available on Nebius. Set NEBIUS_MODEL to an id from GET /v1/models.`
  if (error instanceof OpenAI.APIError) return `The model service returned an error (${error.status}). Try again in a moment.`
  return "Something went wrong talking to the engineer."
}

export async function runAgent(turns: ChatTurn[], emit: Emit, signal: AbortSignal) {
  const history = turns.slice(-LIMITS.turns)
  const users = history.filter((t) => t.role === "user")
  const last = users.at(-1)
  if (!last) return
  const lastUser = last.content
  const priorUser = users.slice(0, -1).slice(-4).map((t) => t.content).join("\n")

  // Live tools only when the question can change race to race; static car
  // questions are answered from the handbook (faster, and no stale web noise).
  const live = needsFreshData(lastUser, priorUser)
  const season = requestedSeason(lastUser, priorUser)
  const tools = toolDefinitions({ live })
  const deep = last.context.deep
  const ctx: ToolContext = { teamId: last.context.teamId, season, emit }

  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((t): Message =>
      t.role === "user" ? { role: "user", content: `[Garage context] ${contextLine(t.context)}\n\n${t.content}` } : { role: "assistant", content: t.content },
    ),
  ]
  const snapshot = await standingsNote(lastUser, priorUser, live, season)
  if (snapshot) messages.push({ role: "system", content: snapshot })

  let thinking = deep
  const step = async (final: boolean) => {
    // Answer steps don't use thinking: Nemotron can put the whole reply in
    // reasoning_content, which would never reach the voice.
    const useThinking = thinking && !final
    const body = {
      model: env.nebius.model,
      messages,
      ...(final ? { tool_choice: "none" as const } : { tools, parallel_tool_calls: true }),
      max_tokens: deep ? 16000 : 8000,
      temperature: deep ? 0.5 : 0.6,
      stream: true as const,
      ...(useThinking ? { chat_template_kwargs: { enable_thinking: true } } : {}),
    }
    try {
      return await nebius().chat.completions.create(body, { signal })
    } catch (error) {
      // Not every deployment accepts the thinking switch; retry once without it.
      if (!useThinking || !(error instanceof OpenAI.BadRequestError)) throw error
      thinking = false
      const { chat_template_kwargs: _ignored, ...plain } = body as typeof body & { chat_template_kwargs?: unknown }
      return nebius().chat.completions.create(plain, { signal })
    }
  }

  const opening = openingFilter()
  const say = (text: string) => {
    const out = opening.push(text)
    if (out) emit({ type: "text", text: out })
  }
  const toolResults: string[] = []
  const memo = new Map<string, Promise<string>>() // identical calls within one turn run once
  let callCount = 0

  try {
    for (let toolSteps = 0; ; toolSteps++) {
      const final = toolSteps >= MAX_TOOL_STEPS
      if (final) messages.push({ role: "system", content: "Tool budget used. Answer now from the results above, in plain text." })
      const stream = await step(final)
      const split = thinkSplitter()
      let content = ""
      let reasoning = ""
      const calls: { id: string; name: string; args: string }[] = []

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta as (OpenAI.Chat.ChatCompletionChunk.Choice.Delta & { reasoning_content?: string; reasoning?: string }) | undefined
        if (!delta) continue
        const separate = delta.reasoning_content ?? delta.reasoning
        if (separate) { reasoning += separate; emit({ type: "reasoning", text: separate }) }
        if (delta.content) {
          const part = split(delta.content)
          if (part.reasoning) { reasoning += part.reasoning; emit({ type: "reasoning", text: part.reasoning }) }
          if (part.answer) { content += part.answer; say(part.answer) }
        }
        if (!final) {
          for (const tc of delta.tool_calls ?? []) {
            const call = (calls[tc.index] ??= { id: "", name: "", args: "" })
            if (tc.id) call.id = tc.id
            if (tc.function?.name) call.name += tc.function.name
            if (tc.function?.arguments) call.args += tc.function.arguments
          }
        }
      }
      const tail = split.flush()
      if (tail.answer) { content += tail.answer; say(tail.answer) }

      if (!calls.length) {
        // The answer ended up in the thinking channel: speak it.
        if (!content.trim() && reasoning.trim().length > 60) say(reasoning.trim())
        break
      }

      messages.push({
        role: "assistant",
        content: content || null,
        tool_calls: calls.map((c) => {
          c.id ||= `call_${callCount++}`
          return { id: c.id, type: "function" as const, function: { name: c.name, arguments: c.args || "{}" } }
        }),
      })
      const results = await Promise.all(
        calls.map(async (c) => {
          const started = Date.now()
          if (!isToolName(c.name)) return { id: c.id, content: JSON.stringify({ error: `Unknown tool "${c.name}".` }) }
          let args: Record<string, unknown>
          try {
            args = JSON.parse(c.args || "{}") as Record<string, unknown>
          } catch {
            return { id: c.id, content: JSON.stringify({ error: "Arguments were not valid JSON." }) }
          }
          emit({ type: "tool_start", id: c.id, name: c.name, label: toolLabel(c.name, args) })
          const key = `${c.name}:${JSON.stringify(args)}`
          let ok = true
          let result: string
          try {
            if (!memo.has(key)) memo.set(key, withTimeout(runTool(c.name, args, ctx), TOOL_TIMEOUT_MS, signal))
            result = await memo.get(key)!
          } catch (error) {
            ok = false
            if (!(error instanceof ToolError)) console.error(`[agent] tool ${c.name} failed:`, error)
            result = JSON.stringify({ error: error instanceof Error ? error.message : "Tool failed." })
          }
          emit({ type: "tool_end", id: c.id, ok, ms: Date.now() - started })
          if (ok) toolResults.push(result)
          return { id: c.id, content: result.length > MAX_TOOL_RESULT ? `${result.slice(0, MAX_TOOL_RESULT)}… (truncated)` : result }
        }),
      )
      for (const r of results) messages.push({ role: "tool", tool_call_id: r.id, content: r.content })
      if (content) say("\n\n")
    }
    const rest = opening.flush()
    if (rest) emit({ type: "text", text: rest })
  } catch (error) {
    if (signal.aborted) return
    console.error("[agent]", error)
    emit({ type: "error", text: friendlyError(error) })
  }

  if (!opening.hasSpoken()) {
    const fallback = fallbackAnswer(ctx.teamId, lastUser, toolResults)
    if (fallback) emit({ type: "text", text: fallback })
  }
}
