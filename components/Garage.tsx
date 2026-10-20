"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import { EngineerPanel, useEngineer } from "./Engineer"
import { PaddockPanel } from "./Paddock"
import { telemetry } from "@/lib/drive"
import { PARTS, partById } from "@/lib/parts"
import { REGULATIONS_2026 } from "@/lib/regulations"
import { sound } from "@/lib/sound"
import { useGarage, type CameraPreset } from "@/lib/store"
import { TEAMS, teamById } from "@/lib/teams"

const Scene = dynamic(() => import("./three/Scene"), {
  ssr: false,
  loading: () => <div className="scene-loading"><span className="spinner" />Building the car…</div>,
})

// Black or white text, whichever reads better on the team's colour.
function inkOn(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.35 ? "#0b0c0f" : "#ffffff"
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas")
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"))
  } catch {
    return false
  }
}

// Browsers only allow audio after a click, so sound starts off and the
// button remembers the choice for next time.
function SoundToggle() {
  const [on, setOn] = useState(false)
  const [volume, setVolume] = useState(0.7)
  const [hinted, setHinted] = useState(false)
  useEffect(() => {
    try {
      setHinted(localStorage.getItem("f1-garage:sound") === "on")
      const v = Number(localStorage.getItem("f1-garage:volume"))
      if (v > 0) setVolume(v)
    } catch {}
    return () => sound.stop()
  }, [])
  const toggle = async () => {
    const next = !on
    setOn(next)
    if (next) { await sound.start(); sound.setVolume(volume) } else sound.stop()
    try { localStorage.setItem("f1-garage:sound", next ? "on" : "off") } catch {}
  }
  return (
    <div className={on ? "sound on" : hinted ? "sound hint" : "sound"}>
      <button onClick={toggle} aria-pressed={on} aria-label={on ? "Turn sound off" : "Turn sound on"}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
          {on ? <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            : <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
        </svg>
        <span>{on ? "Sound on" : "Sound"}</span>
        {on && <i className="eq" aria-hidden><b /><b /><b /></i>}
      </button>
      {on && (
        <input
          type="range" min={0} max={1} step={0.05} value={volume} aria-label="Volume"
          onChange={(e) => { const v = Number(e.target.value); setVolume(v); sound.setVolume(v); try { localStorage.setItem("f1-garage:volume", String(v)) } catch {} }}
        />
      )}
    </div>
  )
}

function DriveHud() {
  const [t, setT] = useState({ speed: 0, aero: "corner", ers: 0, braking: 0 })
  useEffect(() => {
    const id = setInterval(() => setT({ speed: telemetry.speed, aero: telemetry.aero, ers: telemetry.ers, braking: telemetry.braking }), 70)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="hud" aria-hidden>
      <div className="hud-speed"><span>{Math.round(t.speed)}</span><small>km/h</small></div>
      <div className="hud-block">
        <div className={`hud-aero ${t.aero}`}>
          <b>{t.aero === "straight" ? "X-MODE" : "Z-MODE"}</b>
          <small>{t.aero === "straight" ? "Straight · wings open, low drag" : "Corner · wings closed, full downforce"}</small>
        </div>
        <div className="hud-bar"><small>ERS deploy</small><div><i style={{ width: `${Math.round(t.ers * 100)}%` }} /></div></div>
        <div className="hud-bar brake"><small>Brake</small><div><i style={{ width: `${Math.round(t.braking * 100)}%` }} /></div></div>
      </div>
    </div>
  )
}

function PartPanel({ onAsk }: { onAsk: (q: string) => void }) {
  const selected = useGarage((s) => s.selected)
  const highlights = useGarage((s) => s.highlights)
  const teamId = useGarage((s) => s.teamId)
  const team = teamById(teamId)
  const part = selected ? partById(selected) : undefined

  if (!part) {
    return (
      <div className="part-intro">
        <p className="eyebrow">How to explore</p>
        <h3>Click any part of the car</h3>
        <p className="muted">It slides off the car and the camera follows it. Drag to orbit, scroll to zoom, or open the exploded view to see everything at once.</p>
        <p className="eyebrow" style={{ marginTop: 24 }}>2026 regulations at a glance</p>
        <ul className="reg-list">
          {REGULATIONS_2026.map((r) => (
            <li key={r.title}>
              <button onClick={() => useGarage.getState().setHighlights(r.parts.map((id) => ({ id, note: r.title })))}>
                <strong>{r.title}</strong>
                <span>{r.body}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const note = highlights.find((h) => h.id === part.id)?.note
  const rules = REGULATIONS_2026.filter((r) => r.parts.includes(part.id))
  return (
    <article className="part">
      <p className="eyebrow">{part.system}</p>
      <h3>{part.name}</h3>
      {note && <p className="lit-note">{note}</p>}
      <p className="lede">{part.summary}</p>
      <section><h4>How it works</h4><p>{part.howItWorks}</p></section>
      <section><h4>2026 regulations</h4><p>{part.regulation2026}</p>
        {rules.length > 0 && <ul className="tags">{rules.map((r) => <li key={r.title}>{r.title}</li>)}</ul>}
      </section>
      <section><h4>What upgrades look like</h4><p>{part.watchFor}</p></section>
      <div className="part-actions">
        <button className="primary" onClick={() => onAsk(`What has ${team.name} changed on the ${part.name.toLowerCase()} of the ${team.car} this season, and why? Check the FIA upgrade documents.`)}>
          {team.name} upgrades to this part
        </button>
        <button className="secondary" onClick={() => onAsk(`Explain the ${part.name.toLowerCase()} in depth: the physics, the trade-offs, and how it interacts with the rest of the car.`)}>
          Deep dive
        </button>
      </div>
    </article>
  )
}

export function Garage() {
  const { teamId, setTeam, selected, select, exploded, setExploded, mode, setMode, setCamera, highlights, setHighlights } = useGarage()
  const [tab, setTab] = useState<"part" | "engineer" | "paddock">("part")
  const [webgl, setWebgl] = useState(true)
  const engineer = useEngineer()
  const team = teamById(teamId)

  useEffect(() => {
    setWebgl(hasWebGL())
    try {
      const saved = localStorage.getItem("f1-garage:team")
      if (saved && TEAMS.some((t) => t.id === saved)) setTeam(saved)
    } catch {}
  }, [setTeam])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      const s = useGarage.getState()
      if (s.selected) s.select(null)
      else if (s.exploded) s.setExploded(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Selecting a part on the car brings its explanation forward, unless the
  // engineer is mid-answer and drove the selection itself.
  const busyRef = useRef(false)
  busyRef.current = engineer.busy
  useEffect(() => {
    if (selected && !busyRef.current) setTab("part")
  }, [selected])

  const pickTeam = (id: string) => {
    setTeam(id)
    try { localStorage.setItem("f1-garage:team", id) } catch {}
  }
  const ask = (q: string) => { setTab("engineer"); return engineer.ask(q) }

  const cameras: CameraPreset[] = ["hero", "front", "side", "top", "rear"]

  return (
    <div className="app" style={{ ["--team" as string]: team.ui, ["--team-ink" as string]: inkOn(team.ui), ["--team-2" as string]: team.livery.secondary }}>
      <header className="topbar">
        <div className="brand">
          <svg viewBox="0 0 32 20" width="34" height="22" aria-hidden><path d="M2 18 L14 2 H30 L18 18 Z" fill="var(--team)" /><path d="M10 18 L16 10 H22 L16 18 Z" fill="var(--bg)" opacity=".85" /></svg>
          <div><strong>F1 GARAGE</strong><small>Unofficial fan project</small></div>
        </div>
        <nav className="teams" aria-label="Choose a team">
          {TEAMS.map((t) => (
            <button key={t.id} className={t.id === teamId ? "team on" : "team"} onClick={() => pickTeam(t.id)} aria-pressed={t.id === teamId} style={{ ["--c" as string]: t.livery.primary, ["--c2" as string]: t.livery.secondary }}>
              <i aria-hidden />
              <span>{t.name}</span>
            </button>
          ))}
        </nav>
        <SoundToggle />
      </header>

      <main className="stage">
        <div className="canvas-wrap">
          {webgl ? <Scene /> : <div className="scene-loading">3D needs WebGL, which this browser has turned off. Everything else still works.</div>}
        </div>

        <div className="stage-title">
          <p className="eyebrow">{team.name} · {team.powerUnit} power unit</p>
          <h1 key={team.id}>{team.car}</h1>
        </div>

        <div className="stage-tools">
          <div className="seg" role="group" aria-label="View mode">
            <button className={mode === "studio" ? "on" : ""} onClick={() => setMode("studio")}>Studio</button>
            <button className={mode === "drive" ? "on" : ""} onClick={() => setMode("drive")}>Drive</button>
          </div>
          <button className={exploded ? "tool on" : "tool"} onClick={() => setExploded(!exploded)}>
            {exploded ? "Reassemble" : "Exploded view"}
          </button>
          <div className="seg cams" role="group" aria-label="Camera">
            {cameras.map((c) => <button key={c} onClick={() => setCamera(c)}>{c}</button>)}
          </div>
          {(selected || highlights.length > 0) && (
            <button className="tool ghost" onClick={() => { select(null); setHighlights([]) }}>Clear</button>
          )}
        </div>

        {mode === "drive" && <DriveHud />}

        <div className="dock" aria-label="Car parts">
          {PARTS.map((p) => (
            <button key={p.id} className={p.id === selected ? "dock-item on" : "dock-item"} onClick={() => { if (exploded) setExploded(false); select(p.id === selected ? null : p.id) }}>
              <small>{p.system}</small>
              <span>{p.name}</span>
              {highlights.some((h) => h.id === p.id) && <i className="dot" aria-label="highlighted" />}
            </button>
          ))}
        </div>
      </main>

      <aside className="panel">
        <div className="tabs" role="tablist">
          {(["part", "engineer", "paddock"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
              {t === "part" ? "Part" : t === "engineer" ? <>Engineer{engineer.busy && <i className="busy" />}</> : "Paddock"}
            </button>
          ))}
        </div>
        <div className="tab-body" hidden={tab !== "part"}><PartPanel onAsk={ask} /></div>
        <div className="tab-body flush" hidden={tab !== "engineer"}><EngineerPanel engineer={{ ...engineer, ask }} /></div>
        <div className="tab-body" hidden={tab !== "paddock"}>{tab === "paddock" && <PaddockPanel />}</div>
        <p className="model-badge">Nemotron on Nebius · live data from FIA, OpenF1, Jolpica-F1</p>
      </aside>
    </div>
  )
}
