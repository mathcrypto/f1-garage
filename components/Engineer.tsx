"use client"

import { useEffect, useRef, useState } from "react"
import { LessonList, startLesson } from "./EngineerCam"
import { ENGINEER, Lena } from "./Lena"
import { Markdown } from "./Markdown"
import type { AgentEvent, ChatTurn, UiCommand } from "@/lib/agent"
import { partById } from "@/lib/parts"
import { useEngineerState, useGarage } from "@/lib/store"
import { voice } from "@/lib/voice"
import { teamById } from "@/lib/teams"

type Message = ChatTurn & {
  sources?: { title: string; url: string }[]
  steps?: string[]
  reasoning?: string
  error?: string
}

function applyUi(c: UiCommand) {
  const s = useGarage.getState()
  if (c.action === "lesson") { startLesson(c.id); return }
  if (c.action === "highlight") s.setHighlights(c.parts)
  else if (c.action === "focus") { if (s.exploded) s.setExploded(false); s.select(c.id) }
  else {
    if (c.mode) s.setMode(c.mode)
    if (c.exploded !== undefined) s.setExploded(c.exploded)
    if (c.camera) s.setCamera(c.camera)
    if (c.technical !== undefined) s.setTechnical(c.technical)
    if (c.airflow !== undefined) s.setFlow(c.airflow)
  }
}

export function useEngineer() {
  const [messages, setMessages] = useState<Message[]>([])
  const [busy, setBusy] = useState(false)
  const [depth, setDepth] = useState<"fan" | "engineer">("fan")
  const [deep, setDeep] = useState(false)

  async function ask(question: string) {
    if (!question.trim() || busy) return
    const s = useGarage.getState()
    const team = teamById(s.teamId)
    const part = s.selected ? partById(s.selected) : undefined
    const context = [
      `team: ${team.name} (${team.car}, ${team.powerUnit} power unit)`,
      `selected part: ${part ? part.name : "none"}`,
      `depth: ${depth}`,
      `today: ${new Date().toISOString().slice(0, 10)}`,
    ].join("; ")
    const history: Message[] = [...messages, { role: "user", content: question.trim(), context }]
    setMessages([...history, { role: "assistant", content: "" }])
    setBusy(true)
    const lena = useEngineerState.getState()
    voice.stop()
    lena.setLesson(null)
    lena.setStatus("thinking")
    lena.setCaption("")
    let answer = ""

    const update = (fn: (m: Message) => Message) => setMessages((all) => [...all.slice(0, -1), fn(all[all.length - 1])])

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deep,
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
            if (voice.enabled && voice.supported) voice.feed(e.text)
            else {
              // No voice: show the sentence being written as her caption.
              lena.setStatus("talking")
              const sentences = answer.replace(/[*#`]/g, "").split(/(?<=[.!?])\s+/).filter(Boolean)
              lena.setCaption(sentences.at(-1)?.slice(0, 220) ?? "")
            }
          }
          else if (e.type === "reasoning") update((m) => ({ ...m, reasoning: (m.reasoning ?? "") + e.text }))
          else if (e.type === "tool") update((m) => ({ ...m, steps: [...(m.steps ?? []), e.label] }))
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
      update((m) => ({ ...m, content: m.content.trim() }))
      setBusy(false)
      if (voice.enabled && voice.supported) voice.flush()
      if (!(voice.enabled && voice.supported) || !answer) useEngineerState.getState().setStatus("idle")
    }
  }

  return { messages, busy, ask, depth, setDepth, deep, setDeep, clear: () => setMessages([]) }
}

export function EngineerPanel({ engineer }: { engineer: ReturnType<typeof useEngineer> }) {
  const { messages, busy, ask, depth, setDepth, deep, setDeep } = engineer
  const [input, setInput] = useState("")
  const logRef = useRef<HTMLDivElement>(null)
  const teamId = useGarage((s) => s.teamId)
  const selected = useGarage((s) => s.selected)
  const team = teamById(teamId)
  const part = selected ? partById(selected) : undefined

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  const quick = [
    `What upgrades has ${team.name} brought recently?`,
    part ? `Take apart the ${part.name.toLowerCase()} and explain it` : "Show me how active aero works",
    "What changed in the 2026 FIA regulations?",
    "What's happening in F1 this weekend?",
  ]

  return (
    <div className="engineer">
      <div className="engineer-id">
        <Lena size={44} team={team.ui} team2={team.livery.secondary} />
        <div><strong>{ENGINEER.name}</strong><small>{ENGINEER.role} · {team.name}</small></div>
      </div>
      <div className="engineer-controls">
        <div className="seg" role="group" aria-label="Explanation depth">
          <button className={depth === "fan" ? "on" : ""} onClick={() => setDepth("fan")}>Fan</button>
          <button className={depth === "engineer" ? "on" : ""} onClick={() => setDepth("engineer")}>Engineer</button>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} />
          <span className="toggle-track" aria-hidden />
          Deep analysis
        </label>
      </div>

      <div className="log" ref={logRef} aria-live="polite">
        {messages.length === 0 && (
          <div className="empty">
            <div className="empty-hero">
              <Lena size={96} team={team.ui} team2={team.livery.secondary} />
              <div>
                <p className="empty-title">Hi, I'm Lena.</p>
                <p>I'm your race engineer. Ask me about any part, upgrade or rule. I'll check fia.com, live timing and the news, and take parts off the car to show you.</p>
              </div>
            </div>
            <p className="eyebrow" style={{ margin: "16px 0 8px" }}>Or let me walk you through</p>
            <LessonList compact />
          </div>
        )}
        {messages.map((m, i) => {
          const last = i === messages.length - 1
          return (
            <div key={i} className={`msg ${m.role}`}>
              {m.role === "assistant" && (m.steps?.length || (busy && last)) ? (
                <ol className="steps">
                  {(m.steps ?? []).map((s, k) => <li key={k} className="done">{s}</li>)}
                  {busy && last && <li className="live">{m.content ? "Writing" : m.reasoning ? "Reasoning" : "Thinking"}…</li>}
                </ol>
              ) : null}
              {m.reasoning && (
                <details className="reasoning">
                  <summary>Engineer's reasoning</summary>
                  <p>{m.reasoning.trim()}</p>
                </details>
              )}
              {m.role === "assistant" ? <Markdown text={m.content} /> : <p>{m.content}</p>}
              {m.error && <p className="error">{m.error}</p>}
              {m.sources && m.sources.length > 0 && (
                <div className="sources">
                  {m.sources.slice(0, 8).map((s) => {
                    const host = (() => { try { return new URL(s.url).hostname.replace(/^www\./, "") } catch { return s.url } })()
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
        {quick.map((q) => <button key={q} className="chip" disabled={busy} onClick={() => ask(q)}>{q}</button>)}
      </div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); ask(input); setInput("") }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Ask about the ${team.car}…`} aria-label="Your question" />
        <button className="send" disabled={busy || !input.trim()} aria-label="Send">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </form>
    </div>
  )
}
