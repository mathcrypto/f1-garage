import "server-only"
import { LIMITS, type ChatTurn, type GarageContext } from "../../agent/types"
import { PART_IDS } from "../../parts"
import { TEAMS } from "../../teams"

// Validates the chat request body. Anything the browser sends is untrusted:
// we check shapes and ids, clamp numbers and cut long text before it reaches
// the prompt.

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)
const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(999, Math.round(v))) : 0)
const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")

function parseContext(v: unknown): GarageContext | null {
  if (!isObject(v)) return null
  if (!TEAMS.some((t) => t.id === v.teamId)) return null
  const mode = v.mode === "drive" || v.mode === "race" ? v.mode : "studio"
  const progress = isObject(v.progress) ? v.progress : {}
  const next = isObject(v.suggestedNext) && ["lesson", "part", "reg"].includes(v.suggestedNext.kind as string) ? v.suggestedNext : null
  const race = isObject(v.race) ? v.race : null
  return {
    teamId: v.teamId as string,
    selectedPartId: PART_IDS.includes(v.selectedPartId as string) ? (v.selectedPartId as string) : null,
    mode,
    deep: v.deep === true,
    progress: { parts: count(progress.parts), lessons: count(progress.lessons), regs: count(progress.regs) },
    suggestedNext: next ? { kind: next.kind as "lesson" | "part" | "reg", label: text(next.label, 80) } : null,
    race: race
      ? {
          phase: text(race.phase, 20),
          position: numOrNull(race.position),
          gap: race.gap == null ? null : text(race.gap, 20),
          battery: numOrNull(race.battery),
          lap: numOrNull(race.lap),
          laps: numOrNull(race.laps),
        }
      : null,
  }
}

export function parseAgentRequest(body: unknown): Result<ChatTurn[]> {
  if (!isObject(body) || !Array.isArray(body.turns)) return { ok: false, error: "Expected { turns: ChatTurn[] }." }
  const raw = body.turns.slice(-LIMITS.turns)
  const turns: ChatTurn[] = []
  for (const t of raw) {
    if (!isObject(t)) return { ok: false, error: "Each turn must be an object." }
    const content = text(t.content, LIMITS.message)
    if (t.role === "assistant") {
      if (content) turns.push({ role: "assistant", content })
      continue
    }
    if (t.role !== "user") return { ok: false, error: "Turn role must be user or assistant." }
    if (!content) return { ok: false, error: "User turns need content." }
    const context = parseContext(t.context)
    if (!context) return { ok: false, error: "User turns need a valid context (unknown team?)." }
    turns.push({ role: "user", content, context })
  }
  if (turns.at(-1)?.role !== "user") return { ok: false, error: "The last turn must be the user's question." }
  return { ok: true, value: turns }
}
