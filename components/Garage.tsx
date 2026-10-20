"use client"

import { useEffect, useRef, useState } from "react"
import { CarView } from "./CarView"
import { Markdown } from "./Markdown"
import { TEAMS, teamById } from "@/lib/teams"
import { PARTS, partById } from "@/lib/parts"
import { REGULATIONS_2026 } from "@/lib/regulations"
import type { AgentEvent, ChatTurn } from "@/lib/agent"

type Message = ChatTurn & { sources?: { title: string; url: string }[]; status?: string; error?: string }

export function Garage() {
  const [teamId, setTeamId] = useState("ferrari")
  const [selected, setSelected] = useState<string | null>("floor")
  const [highlights, setHighlights] = useState<{ id: string; note: string }[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  const team = teamById(teamId)
  const part = selected ? partById(selected) : undefined
  const relatedRules = REGULATIONS_2026.filter((r) => selected && r.parts.includes(selected))
  const highlightNote = highlights.find((h) => h.id === selected)?.note

  useEffect(() => {
    try {
      const saved = localStorage.getItem("f1-garage:team")
      if (saved && TEAMS.some((t) => t.id === saved)) setTeamId(saved)
    } catch {}
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [messages])

  const pickTeam = (id: string) => {
    setTeamId(id)
    setHighlights([])
    try { localStorage.setItem("f1-garage:team", id) } catch {}
  }

  async function ask(question: string) {
    if (!question.trim() || busy) return
    const context = [
      `team: ${team.name} (${team.car}, ${team.powerUnit} power unit)`,
      `selected part: ${part ? part.name : "none"}`,
      `today: ${new Date().toISOString().slice(0, 10)}`,
    ].join("; ")
    const userTurn: Message = { role: "user", content: question.trim(), context }
    const history = [...messages, userTurn]
    setMessages([...history, { role: "assistant", content: "" }])
    setInput("")
    setBusy(true)

    const update = (fn: (m: Message) => Message) =>
      setMessages((all) => [...all.slice(0, -1), fn(all[all.length - 1])])

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
          const event = JSON.parse(line) as AgentEvent
          if (event.type === "text") update((m) => ({ ...m, content: m.content + event.text, status: undefined }))
          else if (event.type === "status") update((m) => ({ ...m, status: event.text }))
          else if (event.type === "sources")
            update((m) => {
              const seen = new Map((m.sources ?? []).map((s) => [s.url, s]))
              for (const s of event.sources) seen.set(s.url, s)
              return { ...m, sources: [...seen.values()] }
            })
          else if (event.type === "highlight") {
            setHighlights(event.parts)
            if (event.parts[0]) setSelected(event.parts[0].id)
          } else if (event.type === "error") update((m) => ({ ...m, error: event.text, status: undefined }))
        }
      }
    } catch {
      update((m) => ({ ...m, error: "Couldn't reach the engineer. Check your connection and try again.", status: undefined }))
    } finally {
      update((m) => ({ ...m, content: m.content.trim(), status: undefined }))
      setBusy(false)
    }
  }

  const quick = [
    `What are the latest upgrades on the ${team.car}?`,
    part ? `Explain the ${part.name.toLowerCase()} like I'm new to F1` : "How does a Formula 1 car make downforce?",
    "What changed in the 2026 FIA regulations?",
    "Any new FIA technical directives or rule changes this month?",
  ]

  return (
    <div className="garage" style={{ ["--team" as string]: team.livery.primary, ["--team-2" as string]: team.livery.secondary }}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>▲</span>
          <div>
            <h1>F1 Garage</h1>
            <p>Explore your team's car, its upgrades and the FIA rules behind them</p>
          </div>
        </div>
        <nav className="teams" aria-label="Choose a team">
          {TEAMS.map((t) => (
            <button key={t.id} className={t.id === teamId ? "team is-active" : "team"} onClick={() => pickTeam(t.id)} aria-pressed={t.id === teamId}>
              <span className="swatch" style={{ background: `linear-gradient(135deg, ${t.livery.primary} 55%, ${t.livery.secondary} 55%)` }} />
              {t.name}
            </button>
          ))}
        </nav>
      </header>

      <main className="layout">
        <section className="stage" aria-label="Car">
          <div className="stage-head">
            <div>
              <h2>{team.car}</h2>
              <p>{team.name} · {team.powerUnit} power unit · plan view</p>
            </div>
            {highlights.length > 0 && (
              <button className="ghost" onClick={() => setHighlights([])}>Clear highlights</button>
            )}
          </div>
          <CarView team={team} selected={selected} highlights={highlights} onSelect={setSelected} />
          <div className="part-chips" aria-label="All parts">
            {PARTS.map((p) => (
              <button key={p.id} className={p.id === selected ? "chip is-active" : "chip"} onClick={() => setSelected(p.id)}>
                {highlights.some((h) => h.id === p.id) && <span className="dot" aria-label="highlighted" />}
                {p.name}
              </button>
            ))}
          </div>
        </section>

        <aside className="side">
          {part && (
            <section className="card part-card" aria-live="polite">
              <div className="eyebrow">{part.system}</div>
              <h3>{part.name}</h3>
              {highlightNote && <p className="lit-note">Engineer's note: {highlightNote}</p>}
              <p>{part.summary}</p>
              <h4>How it works</h4>
              <p>{part.howItWorks}</p>
              <h4>2026 regulations</h4>
              <p>{part.regulation2026}</p>
              {relatedRules.length > 0 && (
                <ul className="rules">
                  {relatedRules.map((r) => <li key={r.title}><strong>{r.title}.</strong> {r.body}</li>)}
                </ul>
              )}
              <h4>What upgrades look like</h4>
              <p>{part.watchFor}</p>
              <button className="primary" disabled={busy} onClick={() => ask(`What has ${team.name} changed on the ${part.name.toLowerCase()} this season, and why?`)}>
                Ask about {team.name}'s {part.name.toLowerCase()} upgrades
              </button>
            </section>
          )}

          <section className="card chat" aria-label="Race engineer">
            <div className="chat-head">
              <h3>Race engineer</h3>
              <span className="badge">Nemotron · Nebius</span>
            </div>
            <div className="log" ref={logRef}>
              {messages.length === 0 && (
                <p className="empty">Ask about upgrades, a part, or the FIA rules. The engineer searches the latest news and points at parts on your car.</p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`msg ${m.role}`}>
                  {m.role === "assistant" ? <Markdown text={m.content} /> : <p>{m.content}</p>}
                  {m.status && <p className="status">{m.status}</p>}
                  {m.role === "assistant" && !m.content && !m.status && !m.error && busy && i === messages.length - 1 && (
                    <p className="status">Thinking…</p>
                  )}
                  {m.error && <p className="error">{m.error}</p>}
                  {m.sources && m.sources.length > 0 && (
                    <ol className="sources">
                      {m.sources.slice(0, 6).map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}
                    </ol>
                  )}
                </div>
              ))}
            </div>
            <div className="quick">
              {quick.map((q) => <button key={q} className="chip" disabled={busy} onClick={() => ask(q)}>{q}</button>)}
            </div>
            <form className="composer" onSubmit={(e) => { e.preventDefault(); ask(input) }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Ask about the ${team.car}…`} aria-label="Your question" />
              <button className="primary" disabled={busy || !input.trim()}>Send</button>
            </form>
          </section>
        </aside>
      </main>
    </div>
  )
}
