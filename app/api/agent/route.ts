import OpenAI from "openai"
import { MODEL, NEBIUS_BASE_URL, SYSTEM_PROMPT, TOOL_LABELS, TOOLS, type AgentEvent, type ChatTurn, type ToolName, type UiCommand } from "@/lib/agent"
import { getCalendar, getLastResult, getLiveSession, getStandings } from "@/lib/f1data"
import { isChampionshipQuestion, isConversationalShare, needsFreshData, requestedSeason } from "@/lib/knowledge"
import { LESSONS } from "@/lib/lessons"
import { PART_IDS } from "@/lib/parts"
import { formatRegulation, regulationById } from "@/lib/regulations"
import { searchAvailable, searchWeb, type SearchScope } from "@/lib/search"
import { TEAMS } from "@/lib/teams"
import { fetchTeamStory, formatTeamStory } from "@/lib/teamStory"
import {
  findUpgrade,
  formatTeamUpgradeDiary,
  formatUpgrade,
  latestUpgrade,
  narrateUpgrade,
  upgradeById,
  upgradesForPart,
} from "@/lib/upgrades"

export const runtime = "nodejs"
export const maxDuration = 120

const MAX_ITERATIONS = 5
// After one tool round, force a spoken answer (models often loop tools / only reason).
const MAX_TOOL_ROUNDS = 1

// Nemotron reasoning models may inline their chain of thought as <think>…</think>.
// This splits it from the answer, including tags split across chunks.
function thinkSplitter() {
  let inThink = false
  let buffer = ""
  const step = (chunk: string) => {
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
      let keep = 0
      for (let k = Math.min(tag.length - 1, buffer.length); k > 0; k--) {
        if (tag.startsWith(buffer.slice(-k))) {
          keep = k
          break
        }
      }
      const out = buffer.slice(0, buffer.length - keep)
      if (inThink) reasoning += out
      else answer += out
      buffer = buffer.slice(buffer.length - keep)
      break
    }
    return { answer, reasoning }
  }
  // Unclosed <think> often contains the real answer on some deployments — promote it.
  const flush = () => {
    if (!buffer) return { answer: "", reasoning: "" }
    if (inThink) return { answer: buffer, reasoning: "" }
    return { answer: buffer, reasoning: "" }
  }
  return Object.assign(step, { flush })
}

type Send = (event: AgentEvent) => void

async function runTool(
  name: string,
  args: Record<string, unknown>,
  send: Send,
  defaultTeamId: string,
  seasonHint: number | null,
): Promise<string> {
  const ui = (command: UiCommand) => send({ type: "ui", command })
  const resolveTeam = () => {
    const raw = String(args.teamId ?? defaultTeamId)
    return TEAMS.some((t) => t.id === raw) ? raw : defaultTeamId
  }
  switch (name as ToolName) {
    case "web_search": {
      const hits = await searchWeb(String(args.query ?? ""), (args.scope as SearchScope) ?? "any")
      send({ type: "sources", sources: hits.map((h) => ({ title: h.title, url: h.url })) })
      return JSON.stringify(hits)
    }
    case "get_live_timing":
      return JSON.stringify((await getLiveSession()) ?? { error: "Live timing unavailable right now." })
    case "get_standings": {
      const season = args.season != null ? Number(args.season) : seasonHint
      const data = await getStandings(Number.isFinite(season as number) ? season : null)
      return JSON.stringify(data ?? { error: "Standings unavailable right now." })
    }
    case "get_calendar": {
      const [calendar, lastResult] = await Promise.all([getCalendar(), getLastResult()])
      return JSON.stringify(calendar || lastResult ? { calendar, lastResult } : { error: "Calendar unavailable right now." })
    }
    case "get_team_story": {
      const id = resolveTeam()
      const story = await fetchTeamStory(id)
      if (story.sources.length) {
        send({ type: "sources", sources: story.sources.map((s) => ({ title: `${s.outlet}: ${s.title}`, url: s.url })) })
      }
      return formatTeamStory(story) + "\n\nNow brief the user from these notes in 2–3 short paragraphs. Offer to show related parts on the car if useful. Do not invent. Do not call more tools."
    }
    case "get_team_upgrades": {
      const id = resolveTeam()
      const partId = args.partId ? String(args.partId) : ""
      if (partId && PART_IDS.includes(partId)) {
        const list = upgradesForPart(id, partId)
        if (!list.length) return `No diary packages for part ${partId} on that team.`
        return list.map(formatUpgrade).join("\n\n") + "\n\nNow narrate the relevant package to the user. Do not call more tools."
      }
      return formatTeamUpgradeDiary(id) + "\n\nNow narrate the package they asked about and call show_upgrade once, then stop tools."
    }
    case "show_upgrade": {
      const byId = args.packageId ? upgradeById(String(args.packageId)) : undefined
      const pack = byId ?? latestUpgrade(resolveTeam())
      if (!pack) return "Error: unknown upgrade package. Call get_team_upgrades first."
      ui({ action: "highlight", parts: pack.parts })
      return `Showing on car: ${formatUpgrade(pack)}\n\nNow give the garage briefing for this package in 2–3 short paragraphs. Do not call more tools.`
    }
    case "explain_regulation": {
      const reg = regulationById(String(args.id ?? ""))
      if (!reg) return `Error: unknown regulation id "${args.id}".`
      ui({ action: "highlight", parts: reg.parts.map((id) => ({ id, note: reg.title })) })
      return formatRegulation(reg) + "\n\nNow explain this to the user. Do not call more tools."
    }
    case "highlight_parts": {
      const parts = (Array.isArray(args.parts) ? args.parts : []).filter((p: { id?: string }) => PART_IDS.includes(String(p?.id)))
      ui({ action: "highlight", parts })
      const detail = parts.map((p: { id: string; note?: string }) => `${p.id}: ${p.note ?? ""}`).join("; ")
      return `Highlighted on the car: ${detail || parts.length + " part(s)"}. Now explain what these highlights mean. Do not call more tools.`
    }
    case "focus_part": {
      if (!PART_IDS.includes(String(args.id))) return `Error: unknown part id "${args.id}".`
      ui({ action: "focus", id: String(args.id) })
      return "The part is now off the car and in focus. Explain it to the user."
    }
    case "set_view":
      ui({
        action: "view",
        exploded: args.exploded as boolean | undefined,
        mode: args.mode as "studio" | "drive" | undefined,
        camera: args.camera as "hero" | undefined,
        technical: args.technical as boolean | undefined,
        airflow: args.airflow as boolean | undefined,
      })
      return "View updated."
    case "open_race_setup":
      ui({ action: "race_setup" })
      return "Race lobby opened on the user's screen. Keep your reply to one short line inviting them to set laps and go."
    case "start_lesson":
      if (!LESSONS.some((l) => l.id === args.id)) return `Error: unknown lesson "${args.id}".`
      ui({ action: "lesson", id: String(args.id) })
      return "The lesson is playing on the user's screen; Lena narrates it. Keep your reply to one short line."
    default:
      return `Error: unknown tool "${name}".`
  }
}

const FILLER = /^(?:right|okay|ok|alright|all right|so|well|now|sure|great|good question|nice one|copy(?: that)?)\b[\s,.!:;—–-]*/i

function opener() {
  let buffer = ""
  let done = false
  let spoken = false
  const finish = () => {
    done = true
    let text = buffer.replace(/^\s+/, "")
    for (let i = 0; i < 3 && FILLER.test(text); i++) text = text.replace(FILLER, "")
    if (!text) return ""
    spoken = true
    return `${text.charAt(0).toUpperCase()}${text.slice(1)}`
  }
  return {
    push(text: string) {
      if (done) {
        if (text.trim()) spoken = true
        return text
      }
      buffer += text
      return buffer.trim().length >= 24 ? finish() : ""
    },
    flush: () => (done ? "" : finish()),
    hasSpeech: () => spoken,
  }
}

function fallbackBriefing(teamId: string, question: string, toolTexts: string[]): string {
  const shown = toolTexts.find((t) => t.includes("Showing on car:"))
  if (shown) {
    const idMatch = /\[([^\]]+)\]\s+([^\n(]+)/.exec(shown)
    const pack =
      (idMatch && findUpgrade(teamId, idMatch[2])) ||
      upgradeById(`${teamId}-launch`) ||
      findUpgrade(teamId, question) ||
      latestUpgrade(teamId)
    if (pack) return narrateUpgrade(pack)
  }
  const pack = findUpgrade(teamId, question) ?? (/\bupgrade|package|diary\b/i.test(question) ? latestUpgrade(teamId) : undefined)
  if (pack) return narrateUpgrade(pack)
  const highlighted = toolTexts.find((t) => t.startsWith("Highlighted on the car:"))
  if (highlighted) {
    return `I've marked those parts on the car. ${highlighted.replace(/^Highlighted on the car:\s*/, "").slice(0, 280)}`
  }
  return ""
}

const DATA_TOOLS = new Set(["web_search", "get_team_story", "get_live_timing", "get_standings", "get_calendar"])

export async function POST(req: Request) {
  const { turns, deep, teamId: bodyTeam } = (await req.json()) as { turns: ChatTurn[]; deep?: boolean; teamId?: string }
  const defaultTeamId = TEAMS.some((t) => t.id === bodyTeam) ? String(bodyTeam) : "ferrari"

  const client = new OpenAI({ baseURL: NEBIUS_BASE_URL, apiKey: process.env.NEBIUS_API_KEY })
  const userTurns = turns.filter((t) => t.role === "user")
  const lastUser = userTurns.at(-1)?.content ?? ""
  const priorUserText = userTurns.slice(0, -1).slice(-4).map((t) => t.content).join("\n")
  // Live tools for almost every question; handbook-only for static car-tech asks.
  const fresh = needsFreshData(lastUser, priorUserText)
  const season = requestedSeason(lastUser, priorUserText)
  // Never inject a standings dump over "my favourite driver is…".
  const wantStandings =
    !isConversationalShare(lastUser) &&
    (isChampionshipQuestion(lastUser) ||
      (fresh && /\b(standings?|championship|leader|leading|ranking|points|who('s| is)|number\s*1|#1|won|champion)\b/i.test(lastUser)) ||
      (Boolean(priorUserText) &&
        isChampionshipQuestion(priorUserText) &&
        /\b(wrong|incorrect|actually|still|who|what|which|again|really|currently|now|points|position|rank|name|won|leader|leading)\b/i.test(lastUser)))
  const tools = Object.values(TOOLS).filter((t) => {
    const name = t.function.name
    if (name === "web_search" || name === "get_team_story") return fresh && searchAvailable()
    if (DATA_TOOLS.has(name)) return fresh
    return true
  })

  // Prefetch the season the user named (e.g. 2025 ≠ current 2026 table).
  let liveStandingsNote = ""
  if (wantStandings) {
    const standings = await getStandings(season)
    if (standings?.drivers?.length) {
      const year = standings.season ?? season ?? "current"
      const top = standings.drivers
        .slice(0, 8)
        .map((d) => `P${d.position} ${d.driver} (${d.team ?? "?"}) ${d.points} pts`)
        .join("; ")
      liveStandingsNote =
        `${year} drivers' championship after round ${standings.afterRound ?? "?"}: ${top}. ` +
        `Constructors: ${(standings.constructors ?? []).slice(0, 5).map((c) => `P${c.position} ${c.team} ${c.points}`).join("; ")}. ` +
        `Authoritative for the ${year} season only — if the user asked for another year, do not reuse these names.`
    }
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...turns.map((t): OpenAI.Chat.ChatCompletionMessageParam =>
      t.role === "user"
        ? { role: "user", content: `[Garage context] ${t.context}\n\n${t.content}` }
        : { role: "assistant", content: t.content },
    ),
  ]
  if (liveStandingsNote) {
    messages.push({ role: "system", content: liveStandingsNote })
  }

  let thinking = Boolean(deep)
  const create = async (opts?: { forceText?: boolean }) => {
    // Spoken answer rounds must not use thinking — Nemotron often puts the
    // whole briefing in reasoning_content, which never reaches the voice.
    const useThinking = thinking && !opts?.forceText
    const body = {
      model: MODEL,
      messages,
      ...(opts?.forceText
        ? { tool_choice: "none" as const }
        : { tools, parallel_tool_calls: true }),
      max_tokens: deep ? 16000 : 8000,
      temperature: deep ? 0.5 : 0.6,
      stream: true as const,
      ...(useThinking ? { chat_template_kwargs: { enable_thinking: true } } : {}),
    }
    try {
      return await client.chat.completions.create(body)
    } catch (error) {
      if (useThinking && error instanceof OpenAI.BadRequestError) {
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

      const opening = opener()
      const say = (text: string) => {
        const out = opening.push(text)
        if (out) send({ type: "text", text: out })
      }

      const toolTexts: string[] = []
      let toolRounds = 0

      try {
        for (let i = 0; i < MAX_ITERATIONS; i++) {
          const forceText = toolRounds >= MAX_TOOL_ROUNDS
          const stream = await create({ forceText })
          const split = thinkSplitter()
          let content = ""
          let roundReasoning = ""
          const calls: { id: string; name: string; args: string }[] = []

          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta as
              | (OpenAI.Chat.ChatCompletionChunk.Choice.Delta & { reasoning_content?: string; reasoning?: string })
              | undefined
            if (!delta) continue
            const separate = delta.reasoning_content ?? delta.reasoning
            if (separate) {
              roundReasoning += separate
              send({ type: "reasoning", text: separate })
            }
            if (delta.content) {
              const { answer, reasoning } = split(delta.content)
              if (reasoning) {
                roundReasoning += reasoning
                send({ type: "reasoning", text: reasoning })
              }
              if (answer) {
                content += answer
                say(answer)
              }
            }
            if (!forceText) {
              for (const tc of delta.tool_calls ?? []) {
                const call = (calls[tc.index] ??= { id: "", name: "", args: "" })
                if (tc.id) call.id = tc.id
                if (tc.function?.name) call.name += tc.function.name
                if (tc.function?.arguments) call.args += tc.function.arguments
              }
            }
          }

          const tail = split.flush()
          if (tail.reasoning) {
            roundReasoning += tail.reasoning
            send({ type: "reasoning", text: tail.reasoning })
          }
          if (tail.answer) {
            content += tail.answer
            say(tail.answer)
          }

          // Final answer stuck in the thinking channel (common after show_upgrade) → speak it.
          if ((forceText || calls.length === 0) && !content.trim() && roundReasoning.trim().length > 60) {
            const spoken = roundReasoning.trim()
            content = spoken
            say(spoken)
          }

          if (forceText || calls.length === 0) break

          toolRounds++
          messages.push({
            role: "assistant",
            content: content || null,
            tool_calls: calls.map((c, n) => ({
              id: c.id || `call_${i}_${n}`,
              type: "function",
              function: { name: c.name, arguments: c.args || "{}" },
            })),
          })

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
                const content = await runTool(c.name, args, send, defaultTeamId, season)
                toolTexts.push(content)
                return { id: c.id || `call_${i}_${n}`, content }
              } catch (error) {
                return { id: c.id || `call_${i}_${n}`, content: `Error: ${error instanceof Error ? error.message : "tool failed"}` }
              }
            }),
          )
          for (const r of results) messages.push({ role: "tool", tool_call_id: r.id, content: r.content })
          messages.push({
            role: "user",
            content:
              "Tool results are on the car / in context. Give the garage briefing now as plain spoken answer text only — not inside thinking tags. Two or three short paragraphs. Do not call any more tools.",
          })
          if (content) say("\n\n")
        }

        const rest = opening.flush()
        if (rest) send({ type: "text", text: rest })
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

      // If the model only reasoned / only called tools, still speak the diary package.
      if (!opening.hasSpeech()) {
        const fallback = fallbackBriefing(defaultTeamId, lastUser, toolTexts)
        if (fallback) send({ type: "text", text: fallback })
        else if (toolTexts.length) {
          send({
            type: "text",
            text: "I've updated the car for you. Ask me to walk through that package again if you want the full briefing.",
          })
        }
      }

      send({ type: "done" })
      controller.close()
    },
  })

  return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } })
}
