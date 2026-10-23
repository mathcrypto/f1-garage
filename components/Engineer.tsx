"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { LessonList, startLesson } from "./EngineerCam"
import { ENGINEER, Lena } from "./Lena"
import { Markdown } from "./Markdown"
import { openRaceSetup } from "./RaceUI"
import type { AgentEvent, ChatTurn, UiCommand } from "@/lib/agent"
import { partById } from "@/lib/parts"
import { nextLearningStep, useProgress } from "@/lib/progress"
import { race, useRace } from "@/lib/race"
import { useEngineerState, useGarage } from "@/lib/store"
import { formatTeamUpgradeDiary } from "@/lib/upgrades"
import { voice } from "@/lib/voice"
import { lines as said } from "@/lib/voiceLines"
import { teamById } from "@/lib/teams"

type Message = ChatTurn & {
  sources?: { title: string; url: string }[]
  steps?: string[]
  reasoning?: string
  error?: string
}

const CHAT_KEY = "f1-garage:chat"

function loadChat(): Message[] {
  try {
    const raw = localStorage.getItem(CHAT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Message[]
    return Array.isArray(parsed) ? parsed.filter((m) => m.role === "user" || m.role === "assistant") : []
  } catch {
    return []
  }
}

function saveChat(messages: Message[]) {
  try {
    // Drop empty streaming shells; keep a reasonable history.
    const trim = messages.filter((m) => m.content || m.error).slice(-40)
    localStorage.setItem(CHAT_KEY, JSON.stringify(trim))
  } catch {}
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

function raceContextLine(): string | null {
  const phase = useRace.getState().phase
  if (phase === "idle") return null
  const player = race.cars.find((c) => c.player)
  if (!player) return `race phase: ${phase}; spectating`
  const row = useRace.getState().rows.find((r) => r.player)
  return [
    `race phase: ${phase}`,
    row ? `position: P${row.pos}` : null,
    row?.gap ? `gap ahead: ${row.gap}` : null,
    `battery: ${Math.round(player.battery * 100)}%`,
    `lap: ${player.lap}/${race.laps}`,
  ]
    .filter(Boolean)
    .join(", ")
}

export function useEngineer() {
  const [messages, setMessages] = useState<Message[]>([])
  const [busy, setBusy] = useState(false)
  const [deep, setDeep] = useState(false)
  const hydrated = useRef(false)

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
    const team = teamById(s.teamId)
    const part = s.selected ? partById(s.selected) : undefined
    const progress = useProgress.getState()
    const next = progress.suggestNext()
    const raceLine = raceContextLine()
    const diary = formatTeamUpgradeDiary(s.teamId)
      .split("\n")
      .slice(0, 6)
      .join(" ")
    const context = [
      `team: ${team.name} (${team.id}, ${team.car}, ${team.powerUnit} power unit)`,
      `selected part: ${part ? `${part.name} (${part.id}) — ${part.summary}` : "none"}`,
      `mode: ${s.mode}`,
      `deep analysis: ${deep ? "on — full technical briefing" : "off — explain for someone new to F1, plain language first"}`,
      `today: ${new Date().toISOString().slice(0, 10)}`,
      `learning progress: parts seen ${progress.parts.length}, lessons ${progress.lessons.length}/6, regs ${progress.regs.length}`,
      next ? `suggested next: ${next.kind} "${next.label}"` : "suggested next: none — garage tour complete",
      `diary snapshot: ${diary.slice(0, 280)}`,
      raceLine,
      s.mode === "studio"
        ? "style: garage briefing — connected paragraphs, not tiny one-liners"
        : "style: pit-wall radio — terse calls only, no teaching",
      "live-check by default; handbook only for static how-the-car-works / diary / lesson questions",
    ]
      .filter(Boolean)
      .join("; ")
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

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deep,
          teamId: s.teamId,
          turns: history
            .filter((m) => m.content)
            .map((m): ChatTurn => (m.role === "user" ? { role: "user", content: m.content, context: m.context } : { role: "assistant", content: m.content })),
        }),
      })
      if (!res.body) throw new Error("No response")
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
          if (e.type === "text") {
            update((m) => ({ ...m, content: m.content + e.text }))
            answer += e.text
            // Caption while she thinks/writes; full voice plays once the answer is complete
            // (avoids /api/voice 502 storms from sentence-by-sentence streaming).
            lena.setStatus("talking")
            const sentences = answer.replace(/[*#`]/g, "").split(/(?<=[.!?])\s+/).filter(Boolean)
            lena.setCaption(sentences.at(-1)?.slice(0, 220) ?? "")
          } else if (e.type === "reasoning") {
            reasoningBuf += e.text
            update((m) => ({ ...m, reasoning: (m.reasoning ?? "") + e.text }))
          } else if (e.type === "tool") {
            update((m) => ({ ...m, steps: [...(m.steps ?? []), e.label] }))
            if (!answer && !standingBy) {
              standingBy = true
              lena.setCaption(said.checking)
              // One short stand-by line only — the full briefing is spoken in `finally`.
              if (voice.enabled && voice.supported) voice.add(said.checking)
            }
          }
          else if (e.type === "sources")
            update((m) => {
              const seen = new Map((m.sources ?? []).map((x) => [x.url, x]))
              for (const x of e.sources) seen.set(x.url, x)
              return { ...m, sources: [...seen.values()] }
            })
          else if (e.type === "ui") applyUi(e.command)
          else if (e.type === "error") update((m) => ({ ...m, error: e.text }))
        }
      }
    } catch {
      update((m) => ({ ...m, error: "Couldn't reach the engineer. Check your connection and try again." }))
    } finally {
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
      setMessages([])
      try {
        localStorage.removeItem(CHAT_KEY)
      } catch {}
    },
  }
}

export function EngineerPanel({ engineer }: { engineer: ReturnType<typeof useEngineer> }) {
  const { messages, busy, ask, deep, setDeep, clear } = engineer
  const [input, setInput] = useState("")
  const logRef = useRef<HTMLDivElement>(null)
  const teamId = useGarage((s) => s.teamId)
  const selected = useGarage((s) => s.selected)
  const team = teamById(teamId)
  const part = selected ? partById(selected) : undefined
  const partsSeen = useProgress((s) => s.parts)
  const lessonsSeen = useProgress((s) => s.lessons)
  const regsSeen = useProgress((s) => s.regs)
  const suggest = useMemo(() => nextLearningStep(partsSeen, lessonsSeen, regsSeen), [partsSeen, lessonsSeen, regsSeen])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  const quick = [
    `Walk me through ${team.name}'s latest upgrade package on the car`,
    part ? `Take apart the ${part.name.toLowerCase()} and explain it` : "Show me how active aero works",
    "Explain the 2026 power split regulation and highlight it on the car",
    "Open the race lobby — I want to race",
  ]

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
                <p className="empty-title">Hi, I&apos;m Lena.</p>
                <p>
                  Ask about parts, {team.name}&apos;s development diary, or 2026 rules — I&apos;ll show it on the car. Turn on Deep analysis for the full
                  technical brief, or ask me to open a race when you&apos;re ready to play.
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
                <ol className="steps">
                  {(m.steps ?? []).map((s, k) => (
                    <li key={k} className="done">
                      {s}
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

      <div className="quick">
        {quick.map((q) => (
          <button key={q} className="chip" disabled={busy} onClick={() => ask(q)}>
            {q}
          </button>
        ))}
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
