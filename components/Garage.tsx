"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import { HoverChip, ToolRail } from "./Controls"
import { RaceHud, RaceSetup } from "./RaceUI"
import { EngineerCam } from "./EngineerCam"
import { PartCard } from "./Learn"
import { EngineerPanel, useEngineer } from "./Engineer"
import { SoundMenu } from "./SoundMenu"
import { TeamPicker } from "./TeamPicker"
import { useShowcase } from "@/lib/showcase"
import { voice } from "@/lib/voice"
import { lines } from "@/lib/voiceLines"
import { useEngineerRadio } from "@/lib/engineerRadio"
import { PaddockPanel } from "./Paddock"
import { driveTourState, telemetry } from "@/lib/drive"
import { PARTS } from "@/lib/parts"
import { useEngineerState, useGarage } from "@/lib/store"
import { TEAMS, teamById } from "@/lib/teams"
import { readString, STORAGE_KEYS, write } from "@/lib/storage"

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

function DriveHud() {
  const [t, setT] = useState({
    speed: 0,
    aero: "corner" as string,
    ers: 0,
    braking: 0,
    battery: 1,
    boosting: false,
    title: "",
    hint: "",
    focus: null as null | "aero" | "ers" | "battery" | "brake",
  })
  useEffect(() => {
    const id = setInterval(() => setT({
      speed: telemetry.speed,
      aero: telemetry.aero,
      ers: telemetry.ers,
      braking: telemetry.braking,
      battery: driveTourState.battery,
      boosting: driveTourState.boosting,
      title: driveTourState.title,
      hint: driveTourState.hint,
      focus: driveTourState.focus,
    }), 70)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="hud" aria-hidden>
      <div className="hud-speed"><span>{Math.round(t.speed)}</span><small>km/h</small></div>
      <div className="hud-block">
        {t.title && (
          <div className="hud-lesson">
            <b>{t.title}</b>
            {t.hint ? <small>{t.hint}</small> : null}
          </div>
        )}
        <div className={`hud-aero ${t.aero}${t.boosting ? " boost" : ""}${t.focus === "aero" ? " focus" : ""}`}>
          <b>{t.boosting ? "OVERTAKE" : t.aero === "straight" ? "X-MODE" : "Z-MODE"}</b>
          <small>
            {t.boosting
              ? "Spending battery for speed"
              : t.aero === "straight"
                ? "Wings open · less drag"
                : "Wings closed · more grip"}
          </small>
        </div>
        <div className={`hud-bar${t.focus === "ers" ? " focus" : ""}`}>
          <small>Power from battery</small>
          <div><i style={{ width: `${Math.round(t.ers * 100)}%` }} /></div>
        </div>
        <div className={`hud-bar${t.focus === "battery" ? " focus" : ""}`}>
          <small>Battery {Math.round(t.battery * 100)}%</small>
          <div><i style={{ width: `${Math.round(t.battery * 100)}%` }} /></div>
        </div>
        <div className={`hud-bar brake${t.focus === "brake" ? " focus" : ""}`}>
          <small>Brake</small>
          <div><i style={{ width: `${Math.round(t.braking * 100)}%` }} /></div>
        </div>
      </div>
    </div>
  )
}

export function Garage() {
  const { teamId, setTeam, selected, select, exploded, setExploded, mode, highlights } = useGarage()
  const [tab, setTab] = useState<"part" | "engineer" | "paddock">("part")
  const [panelOpen, setPanelOpen] = useState(true)
  // The race takes the full screen, like a game; the panel comes back after.
  const panelBeforeRace = useRef<boolean | null>(null)
  useEffect(() => {
    if (mode === "race") setPanelOpen((open) => { panelBeforeRace.current ??= open; return false })
    else if (panelBeforeRace.current !== null) { setPanelOpen(panelBeforeRace.current); panelBeforeRace.current = null }
  }, [mode])
  const [webgl, setWebgl] = useState(true)
  const [firstVisit, setFirstVisit] = useState(false)
  const engineer = useEngineer()
  useEngineerRadio()
  const team = teamById(teamId)

  useEffect(() => {
    setWebgl(hasWebGL())
    const saved = readString(STORAGE_KEYS.team)
    if (saved && TEAMS.some((t) => t.id === saved)) setTeam(saved)
    else setFirstVisit(true)
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

  const showcase = useShowcase((s) => s.running)
  const pickTeam = (id: string) => {
    if (id !== teamId) {
      // Lena changes into the new team's kit and says hello.
      const next = teamById(id)
      const line = lines.greeting(next.name, next.car)
      const lena = useEngineerState.getState()
      if (!lena.lesson && !showcase) {
        // voice.say shows the caption itself, in sync with her voice.
        if (voice.enabled && voice.supported) voice.say(line)
        else {
          lena.setCaption(line)
          lena.setStatus("talking")
          setTimeout(() => useEngineerState.getState().setStatus("idle"), 3500)
        }
      }
    }
    setTeam(id)
    write(STORAGE_KEYS.team, id)
  }
  const ask = (q: string) => { setTab("engineer"); setPanelOpen(true); return engineer.ask(q) }

  return (
    <div className={panelOpen ? "app" : "app panel-closed"} style={{ ["--team" as string]: team.ui, ["--team-ink" as string]: inkOn(team.ui), ["--team-2" as string]: team.livery.secondary }}>
      <header className="topbar">
        <div className="brand">
          <svg viewBox="0 0 32 20" width="34" height="22" aria-hidden><path d="M2 18 L14 2 H30 L18 18 Z" fill="var(--team)" /><path d="M10 18 L16 10 H22 L16 18 Z" fill="var(--bg)" opacity=".85" /></svg>
          <div><strong>F1 GARAGE</strong></div>
        </div>
        <div className="top-spacer" />
        <TeamPicker teamId={teamId} onPick={pickTeam} firstVisit={firstVisit} />
        <SoundMenu />
      </header>

      <main className="stage">
        <div className="canvas-wrap">
          {webgl ? <Scene /> : <div className="scene-loading">3D needs WebGL, which this browser has turned off. Everything else still works.</div>}
        </div>

        <div className="stage-title" hidden={mode === "race"}>
          <p className="eyebrow">{team.name} · {team.powerUnit} power unit</p>
          <h1 key={team.id}>{team.car}</h1>
        </div>

        <ToolRail />
        <HoverChip />
        {!panelOpen && mode !== "race" && (
          <button className="panel-open" onClick={() => setPanelOpen(true)}>
            <span className="panel-open-dot" aria-hidden />Lena &amp; info
          </button>
        )}

        {mode === "drive" && <DriveHud />}
        {mode === "race" && <RaceHud />}
        <EngineerCam />

        <div className="dock" aria-label="Car parts" hidden={mode !== "studio"}>
          {PARTS.map((p) => (
            <button key={p.id} className={p.id === selected ? "dock-item on" : "dock-item"} data-system={p.system} title={p.system} onClick={() => { if (exploded) setExploded(false); select(p.id === selected ? null : p.id) }}>
              <i className="sys" aria-hidden />
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
              {t === "part" ? "Explore" : t === "engineer" ? <>Lena{engineer.busy && <i className="busy" />}</> : "Paddock"}
            </button>
          ))}
          <button className="panel-hide" onClick={() => setPanelOpen(false)} aria-label="Hide panel" title="Hide panel">›</button>
        </div>
        <div className="tab-body" hidden={tab !== "part"}><PartCard onAsk={ask} /></div>
        <div className="tab-body flush" hidden={tab !== "engineer"}><EngineerPanel engineer={{ ...engineer, ask }} /></div>
        <div className="tab-body" hidden={tab !== "paddock"}>{tab === "paddock" && <PaddockPanel />}</div>
      </aside>
      <RaceSetup />
    </div>
  )
}
