// Shared by the browser and the agent route. Client-safe: types and limits only.

/** What the user was looking at when they asked. The server turns this into the
 *  model's context line; the client never sends prompt text. */
export type GarageContext = {
  teamId: string
  selectedPartId: string | null
  mode: "studio" | "drive" | "race"
  deep: boolean
  progress: { parts: number; lessons: number; regs: number }
  suggestedNext: { kind: "lesson" | "part" | "reg"; label: string } | null
  race: { phase: string; position: number | null; gap: string | null; battery: number | null; lap: number | null; laps: number | null } | null
}

export type ChatTurn =
  | { role: "user"; content: string; context: GarageContext }
  | { role: "assistant"; content: string }

export type AgentRequest = { turns: ChatTurn[] }

/** Commands the agent sends to drive the 3D car. */
export type UiCommand =
  | { action: "highlight"; parts: { id: string; note: string }[] }
  | { action: "focus"; id: string }
  | { action: "view"; exploded?: boolean; camera?: "hero" | "front" | "side" | "top" | "rear"; technical?: boolean; airflow?: boolean }
  | { action: "lesson"; id: string }
  | { action: "race_setup" }

export type Source = { title: string; url: string }

/** The agent's response stream, one JSON object per line (NDJSON). */
export type AgentEvent =
  | { type: "tool_start"; id: string; name: string; label: string }
  | { type: "tool_end"; id: string; ok: boolean; ms: number }
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "ui"; command: UiCommand }
  | { type: "sources"; sources: Source[] }
  | { type: "error"; text: string }
  | { type: "done" }

export const LIMITS = {
  /** Most recent turns sent to the model. */
  turns: 16,
  /** Characters per message. */
  message: 4000,
} as const
