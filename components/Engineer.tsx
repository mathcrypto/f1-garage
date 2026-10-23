"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { LessonList, startLesson } from "./EngineerCam"
import { ENGINEER, Lena } from "./Lena"
import { Markdown } from "./Markdown"
import { openRaceSetup } from "./RaceUI"
import type { AgentEvent, ChatTurn, GarageContext, UiCommand } from "@/lib/agent/types"
import { partById } from "@/lib/parts"
import { nextLearningStep, useProgress } from "@/lib/progress"
import { race, useRace } from "@/lib/race"
import { useEngineerState, useGarage } from "@/lib/store"
import { readJson, remove, STORAGE_KEYS, write } from "@/lib/storage"
import { voice } from "@/lib/voice"
import { lines as said } from "@/lib/voiceLines"
import { teamById } from "@/lib/teams"

/** One agent step as shown in the chat: a tool the agent called. */
type Step = { id: string; label: string; status: "running" | "done" | "failed" }

type Message = ChatTurn & {
  sources?: { title: string; url: string }[]
  steps?: Step[]
  reasoning?: string
  error?: string
}

function loadChat(): Message[] {
  const parsed = readJson<Message[]>(STORAGE_KEYS.chat)
  if (!Array.isArray(parsed)) return []
  // Older saves stored steps as plain strings; drop those.
  return parsed
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ ...m, steps: Array.isArray(m.steps) ? m.steps.filter((x) => typeof x === "object") : undefined }))
}

function saveChat(messages: Message[]) {
  // Drop empty streaming shells; keep a reasonable history.
  write(STORAGE_KEYS.chat, messages.filter((m) => m.content || m.error).slice(-40))
}

function applyUi(c: UiCommand) {
  const s = useGarage.getState()
  if (c.action === "lesson") {
    startLesson(c.id)
    useProgress.getState().markLesson(c.id)
    return
  }
  if (c.action === "race_setup") {
    openRaceSetup()
    return
  }
  if (c.action === "highlight") s.setHighlights(c.parts)
  else if (c.action === "focus") {
    if (s.exploded) s.setExploded(false)
    s.select(c.id)
    useProgress.getState().markPart(c.id)
  } else {
    if (c.mode) s.setMode(c.mode)
    if (c.exploded !== undefined) s.setExploded(c.exploded)
    if (c.camera) s.setCamera(c.camera)
    if (c.technical !== undefined) s.setTechnical(c.technical)
    if (c.airflow !== undefined) s.setFlow(c.airflow)
  }
}

function raceContext(): GarageContext["race"] {
  const phase = useRace.getState().phase
  if (phase === "idle") return null
  const player = race.cars.find((c) => c.player)
  const row = useRace.getState().rows.find((r) => r.player)
  return {
    phase: player ? phase : `${phase} (spectating)`,
    position: row?.pos ?? null,
    gap: row?.gap ?? null,
    battery: player ? player.battery : null,
    lap: player ? player.lap : null,
    laps: player ? race.laps : null,
  }
}

/** What the user is looking at, sent with each question. The server turns it into prompt text. */
function garageContext(deep: boolean): GarageContext {
  const s = useGarage.getState()
  const progress = useProgress.getState()
  const next = progress.suggestNext()
  return {
    teamId: s.teamId,
    selectedPartId: s.selected,
    mode: s.mode,
    deep,
    progress: { parts: progress.parts.length, lessons: progress.lessons.length, regs: progress.regs.length },
    suggestedNext: next ? { kind: next.kind, label: next.label } : null,
    race: raceContext(),
  }
}

export function useEngineer() {
  const [messages, setMessages] = useState<Message[]>([])
  const [busy, setBusy] = useState(false)
  const [deep, setDeep] = useState(false)
  const hydrated = useRef(false)
  const controllerRef = useRef<AbortController | null>(null)

  // Leaving the page cancels an answer in progress.
  useEffect(() => () => controllerRef.current?.abort(), [])

  useEffect(() => {
    useProgress.getState().hydrate()
    const saved = loadChat()
    if (saved.length) setMessages(saved)
    hydrated.current = true
  }, [])

  useEffect(() => {
    if (hydrated.current) saveChat(messages)
  }, [messages])

  async function ask(question: string) {
    if (!question.trim() || busy) return
    // Every ask must be hearable: unlock audio and keep Lena's voice on.
    voice.setEnabled(true)
    voice.unlock()
    const s = useGarage.getState()
    const part = s.selected ? partById(s.selected) : undefined
    const progress = useProgress.getState()
    const context = garageContext(deep)
    const history: Message[] = [...messages, { role: "user", content: question.trim(), context }]
    setMessages([...history, { role: "assistant", content: "" }])
    setBusy(true)
    const lena = useEngineerState.getState()
    voice.stop()
    lena.setLesson(null)
    lena.setStatus("thinking")
    lena.setCaption("")
    let answer = ""
    let reasoningBuf = ""
    let standingBy = false

    if (part) progress.markPart(part.id)

    const update = (fn: (m: Message) => Message) => setMessages((all) => [...all.slice(0, -1), fn(all[all.length - 1])])

    // A new question, clearing the chat or leaving the page cancels the request;
    // the server stops the model and tools too.
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          turns: history
            .filter((m) => m.content)
            // Chats saved before context became structured use the current context.
            .map((m): ChatTurn => (m.role === "user" ? { role: "user", content: m.content, context: typeof m.context === "object" ? m.context : context } : { role: "assistant", content: m.content })),
        }),
      })
      if (!res.ok || !res.body) {
        const detail = await res.json().then((d: { error?: string }) => d.error).catch(() => null)
        throw new Error(detail ?? `Request failed (${res.status})`)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let pending = ""
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        pending += decoder.decode(value, { stream: true })
        const lines = pending.split("\n")
        pending = lines.pop() ?? ""
        for (const line of lines) {
          if (!line) continue
          const e = JSON.parse(line) as AgentEvent
          switch (e.type) {
            case "text": {
              update((m) => ({ ...m, content: m.content + e.text }))
              answer += e.text
              // Caption while she writes; the full answer is spoken once it's complete.
              lena.setStatus("talking")
              const sentences = answer.replace(/[*#`]/g, "").split(/(?<=[.!?])\s+/).filter(Boolean)
              lena.setCaption(sentences.at(-1)?.slice(0, 220) ?? "")
              break
            }
            case "reasoning":
              reasoningBuf += e.text
              update((m) => ({ ...m, reasoning: (m.reasoning ?? "") + e.text }))
              break
            case "tool_start":
              update((m) => ({ ...m, steps: [...(m.steps ?? []), { id: e.id, label: e.label, status: "running" }] }))
              if (!answer && !standingBy) {
                standingBy = true
                lena.setCaption(said.checking)
                // One short stand-by line only; the full briefing is spoken at the end.
                if (voice.enabled && voice.supported) voice.add(said.checking)
              }
              break
            case "tool_end":
              update((m) => ({ ...m, steps: m.steps?.map((st) => (st.id === e.id ? { ...st, status: e.ok ? "done" : "failed" } : st)) }))
              break
            case "sources":
              update((m) => {
                const seen = new Map((m.sources ?? []).map((x) => [x.url, x]))
                for (const x of e.sources) seen.set(x.url, x)
                return { ...m, sources: [...seen.values()] }
              })
              break
            case "ui":
              applyUi(e.command)
              break
            case "error":
              update((m) => ({ ...m, error: e.text }))
              break
          }
        }
      }
    } catch (error) {
      if (controller.signal.aborted) return
      update((m) => ({ ...m, error: error instanceof Error && error.message !== "Failed to fetch" ? error.message : "Couldn't reach the engineer. Check your connection and try again." }))
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
      let spoken = answer.trim()
      if (!spoken && reasoningBuf.trim().length > 60) spoken = reasoningBuf.trim()
      update((m) => ({ ...m, content: (m.content.trim() || spoken) }))
      setBusy(false)
      if (spoken) {
        answer = spoken
        // One full speak per ask — neural if healthy, browser TTS if /api/voice fails.
        voice.setEnabled(true)
        voice.unlock()
        voice.say(spoken)
      } else {
        useEngineerState.getState().setStatus("idle")
      }
    }
  }

  return {
    messages,
    busy,
    ask,
    deep,
    setDeep,
    clear: () => {
      controllerRef.current?.abort()
      setBusy(false)
      setMessages([])
      remove(STORAGE_KEYS.chat)
    },
  }
}

export function EngineerPanel({ engineer }: { engineer: ReturnType<typeof useEngineer> }) {
  const { messages, busy, ask, deep, setDeep, clear } = engineer
  const [input, setInput] = useState("")
  const logRef = useRef<HTMLDivElement>(null)
  const teamId = useGarage((s) => s.teamId)
  const team = teamById(teamId)
  const partsSeen = useProgress((s) => s.parts)
  const lessonsSeen = useProgress((s) => s.lessons)
  const regsSeen = useProgress((s) => s.regs)
  const suggest = useMemo(() => nextLearningStep(partsSeen, lessonsSeen, regsSeen), [partsSeen, lessonsSeen, regsSeen])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  return (
    <div className="engineer">
      <div className="engineer-id">
        <Lena size={44} teamId={teamId} />
        <div>
          <strong>{ENGINEER.name}</strong>
          <small>
            {ENGINEER.role} · {team.name}
          </small>
        </div>
        {messages.length > 0 && (
          <button className="link" style={{ marginLeft: "auto", fontSize: 12 }} onClick={clear} type="button">
            Clear chat
          </button>
        )}
      </div>
      <div className="engineer-controls">
        <p className="muted small" style={{ margin: 0, flex: 1 }}>
          {deep ? "Technical briefing" : "Plain-language briefing for newcomers"}
        </p>
        <label className="toggle" title={deep ? "Full technical detail" : "Clear explanations for someone new to F1"}>
          <input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} />
          <span className="toggle-track" aria-hidden />
          Deep analysis
        </label>
      </div>

      <div className="log" ref={logRef} aria-live="polite">
        {messages.length === 0 && (
          <div className="empty">
            <div className="empty-hero">
              <Lena size={96} teamId={teamId} />
              <div>
                <p className="empty-title">Hi, I&apos;m Lena, your race engineer at {team.name}.</p>
                <p>
                  Ask me how any part of the {team.car} works, what {team.name}&apos;s latest upgrades changed, or what the 2026 rules mean for the car.
                  I&apos;ll show you on the car as I explain. Switch on Deep analysis when you want the full technical briefing.
                </p>
                {suggest && (
                  <button
                    className="link"
                    type="button"
                    onClick={() => {
                      if (suggest.kind === "lesson") ask(`Start the ${suggest.label} lesson`)
                      else if (suggest.kind === "part") ask(`Explain the ${suggest.label.toLowerCase()} simply`)
                      else ask(`Explain the 2026 regulation: ${suggest.label}`)
                    }}
                  >
                    Suggested next: {suggest.label} →
                  </button>
                )}
              </div>
            </div>
            <p className="eyebrow" style={{ margin: "16px 0 8px" }}>
              Or let me walk you through
            </p>
            <LessonList compact />
          </div>
        )}
        {messages.map((m, i) => {
          const last = i === messages.length - 1
          return (
            <div key={i} className={`msg ${m.role}`}>
              {m.role === "assistant" && (m.steps?.length || (busy && last)) ? (
                <ol className="steps" aria-label="Agent steps">
                  {(m.steps ?? []).map((st) => (
                    <li key={st.id} className={st.status === "running" ? "live" : st.status}>
                      {st.label}
                    </li>
                  ))}
                  {busy && last && <li className="live">{m.content ? "Writing" : m.reasoning ? "Reasoning" : "Thinking"}…</li>}
                </ol>
              ) : null}
              {m.reasoning && (
                <details className="reasoning">
                  <summary>Engineer&apos;s reasoning</summary>
                  <p>{m.reasoning.trim()}</p>
                </details>
              )}
              {m.role === "assistant" ? <Markdown text={m.content} /> : <p>{m.content}</p>}
              {m.error && <p className="error">{m.error}</p>}
              {m.sources && m.sources.length > 0 && (
                <div className="sources">
                  {m.sources.slice(0, 8).map((s) => {
                    const host = (() => {
                      try {
                        return new URL(s.url).hostname.replace(/^www\./, "")
                      } catch {
                        return s.url
                      }
                    })()
                    return (
                      <a key={s.url} href={s.url} target="_blank" rel="noreferrer" title={s.title} className="source">
                        <img src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`} alt="" width={14} height={14} />
                        {host}
                      </a>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault()
          ask(input)
          setInput("")
        }}
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Ask about the ${team.car}…`} aria-label="Your question" />
        <button className="send" disabled={busy || !input.trim()} aria-label="Send">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
            <path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
    </div>
  )
}
