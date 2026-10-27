"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { create } from "zustand"
import { gearbox } from "@/lib/drive"
import { liveryFor } from "@/lib/liveries"
import { input, lapTime, race, setFollow, setPaused, setupRace, stopRace, useRace, type Assist, type RaceOptions, type Tone } from "@/lib/race"
import { sound } from "@/lib/sound"
import { useEngineerState, useGarage, type TrackCam } from "@/lib/store"
import { TEAMS, teamById } from "@/lib/teams"
import { track } from "@/lib/track"
import { voice } from "@/lib/voice"
import { lines } from "@/lib/voiceLines"
import { radio } from "@/lib/engineerRadio"

export const useRaceSetup = create<{ open: boolean; last: RaceOptions | null }>(() => ({ open: false, last: null }))
export const openRaceSetup = () => useRaceSetup.setState({ open: true })

// Race-control messages across the top of the screen, as in the F1 games.
const useMessages = create<{ items: { id: number; text: string; tone: Tone }[] }>(() => ({ items: [] }))
let msgId = 0
function message(text: string, tone: Tone = "info") {
  const id = ++msgId
  useMessages.setState((s) => ({ items: [...s.items.slice(-2), { id, text, tone }] }))
  setTimeout(() => useMessages.setState((s) => ({ items: s.items.filter((m) => m.id !== id) })), 3200)
}

const P = (n: number) => `P${n}`

export function startRace(o: RaceOptions) {
  const g = useGarage.getState()
  useRaceSetup.setState({ open: false, last: o })
  useMessages.setState({ items: [] })
  voice.stop()
  setupRace(o, {
    light: (n) => sound.lightBeep(n),
    lightsOut: () => {
      sound.lightsOut()
      radio(lines.lightsOut(Boolean(o.player)), "critical")
    },
    position: (teamId, from, to) => {
      if (teamId !== race.follow || from === to) return
      // Call overtakes; stay quiet on small losses (HUD already shows position).
      if (to < from) radio(lines.gained(to), to === 1 ? "critical" : "hard")
      else if (to <= 3) radio(lines.lost(to), "soft")
    },
    finalLap: () => { message("Final lap", "info"); radio(lines.finalLap, "critical") },
    finish: () => {},
    end: () => {
      if (!o.player) return
      const me = race.cars.find((c) => c.teamId === o.player)
      if (!me || me.finishTime === null) return
      // Crossing order ignores time penalties; classification adds them.
      const byCrossing = [...race.cars]
        .filter((c) => c.finishTime !== null)
        .sort((a, b) => a.finishTime! - b.finishTime!)
      const trackPos = byCrossing.findIndex((c) => c.teamId === o.player) + 1
      const finalPos = race.order.findIndex((c) => c.teamId === o.player) + 1
      if (trackPos <= 0 || finalPos <= 0) return
      if (me.penalty > 0 && trackPos !== finalPos) {
        radio(lines.crossed(trackPos), "critical")
        radio(lines.classifiedPenalty(finalPos, me.penalty), "critical")
      } else {
        radio(lines.finish(finalPos), "critical")
      }
    },
    message: (text, tone) => {
      message(text, tone)
      if (!race.player) return
      // Track limits: HUD only the first few times; voice once in a while.
      if (text.startsWith("Track limits")) radio(lines.trackLimits, "soft")
      else if (text.startsWith("5 second")) radio(lines.penalty, "critical")
      else if (tone === "purple" && text.includes(teamById(race.player).code)) radio(lines.fastest, "hard")
    },
  })
  g.setTrackCam("chase")
  g.setMode("race")
  sound.unlock()
  voice.unlock()
  const slot = o.order.indexOf(o.player ?? o.order[0]) + 1
  setTimeout(() => radio(o.player ? lines.gridCheck(slot) : lines.gridWatch(o.order.length), "hard"), 400)
}

export function endRace() {
  stopRace()
  voice.stop()
  useGarage.getState().setMode("studio")
}

function Swatch({ teamId }: { teamId: string }) {
  const k = liveryFor(teamId)
  return <i className="swatch" style={{ background: k.style === "sides" && k.right ? `linear-gradient(90deg, ${k.base} 50%, ${k.right} 50%)` : k.base }} aria-hidden />
}

// ── Lobby ───────────────────────────────────────────────────────────────────
const ASSISTS: { id: Assist; label: string; hint: string }[] = [
  { id: "full", label: "Full", hint: "Car brakes and accelerates; you steer and attack" },
  { id: "braking", label: "Braking", hint: "Car brakes for corners; throttle is yours" },
  { id: "off", label: "Off", hint: "Throttle and brakes are all yours" },
]
const difficultyName = (d: number) => (d < 40 ? "Casual" : d < 70 ? "Amateur" : d < 90 ? "Pro" : d < 105 ? "Expert" : "Legend")

export function RaceSetup() {
  const open = useRaceSetup((s) => s.open)
  const last = useRaceSetup((s) => s.last)
  const teamId = useGarage((s) => s.teamId)
  const all = useMemo(() => TEAMS.map((t) => t.id), [])
  const [order, setOrder] = useState<string[]>(all)
  const [out, setOut] = useState<Set<string>>(new Set())
  const [laps, setLaps] = useState(3)
  const [driving, setDriving] = useState(true)
  const [assist, setAssist] = useState<Assist>("braking")
  const [difficulty, setDifficulty] = useState(80)

  useEffect(() => {
    if (!open) return
    if (last) {
      setOrder([...last.order, ...all.filter((id) => !last.order.includes(id))])
      setOut(new Set(all.filter((id) => !last.order.includes(id))))
      setLaps(last.laps); setAssist(last.assist); setDifficulty(last.difficulty); setDriving(last.player !== null)
    } else {
      // Like a career race: start mid-pack.
      const others = all.filter((id) => id !== teamId)
      setOrder([...others.slice(0, 5), teamId, ...others.slice(5)])
    }
  }, [open, last, all, teamId])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && useRaceSetup.setState({ open: false })
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  if (!open) return null
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[i], next[j]] = [next[j], next[i]]
    setOrder(next)
  }
  const toggle = (id: string) => {
    const next = new Set(out)
    if (next.has(id)) next.delete(id)
    else if (order.length - next.size > 2 && !(driving && id === teamId)) next.add(id)
    setOut(next)
  }
  const grid = order.filter((id) => !out.has(id))
  const go = () => startRace({ order: grid, laps, player: driving ? teamId : null, assist, difficulty })

  return (
    <div className="picker" role="dialog" aria-modal="true" aria-label="Race setup" onClick={(e) => e.target === e.currentTarget && useRaceSetup.setState({ open: false })}>
      <div className="picker-sheet race-sheet lobby">
        <header>
          <div><p className="eyebrow">{track.name} · {grid.length} cars</p><h2>Race weekend</h2></div>
          <button className="cam-close" onClick={() => useRaceSetup.setState({ open: false })} aria-label="Close">×</button>
        </header>

        <div className="lobby-cols">
          <section className="lobby-options">
            <div className="opt">
              <span className="opt-label">Mode</span>
              <div className="seg">
                <button className={driving ? "on" : ""} onClick={() => setDriving(true)}>Drive the {teamById(teamId).car}</button>
                <button className={!driving ? "on" : ""} onClick={() => setDriving(false)}>Watch</button>
              </div>
            </div>
            <div className="opt">
              <span className="opt-label">Race distance</span>
              <div className="seg">{[1, 3, 5, 10].map((n) => <button key={n} className={laps === n ? "on" : ""} onClick={() => setLaps(n)}>{n} {n === 1 ? "lap" : "laps"}</button>)}</div>
            </div>
            <div className="opt">
              <span className="opt-label">AI difficulty <b>{difficulty} · {difficultyName(difficulty)}</b></span>
              <input type="range" min={0} max={110} value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))} aria-label="AI difficulty" />
            </div>
            {driving && (
              <div className="opt">
                <span className="opt-label">Assists</span>
                <div className="seg">{ASSISTS.map((a) => <button key={a.id} className={assist === a.id ? "on" : ""} onClick={() => setAssist(a.id)} title={a.hint}>{a.label}</button>)}</div>
                <small className="opt-hint">{ASSISTS.find((a) => a.id === assist)!.hint}</small>
              </div>
            )}
            {driving && (
              <div className="keys">
                <span><kbd>↑</kbd><kbd>W</kbd> Throttle</span>
                <span><kbd>↓</kbd><kbd>S</kbd> Brake</span>
                <span><kbd>←</kbd><kbd>→</kbd> Steer</span>
                <span><kbd>Space</kbd> Overtake mode</span>
                <span><kbd>C</kbd> Camera</span>
                <span><kbd>Esc</kbd> Pause</span>
              </div>
            )}
          </section>

          <section className="lobby-grid">
            <div className="race-presets">
              <span className="opt-label">Starting grid</span>
              <button onClick={() => setOrder([...order].sort(() => Math.random() - 0.5))}>Shuffle</button>
              <button onClick={() => setOrder([...order].reverse())}>Reverse</button>
              <button onClick={() => setOrder([teamId, ...order.filter((id) => id !== teamId)])}>Pole</button>
              <button onClick={() => setOrder([...order.filter((id) => id !== teamId), teamId])}>Back of the grid</button>
            </div>
            <ol className="grid-list">
              {order.map((id, i) => {
                const t = teamById(id)
                const off = out.has(id)
                const slot = off ? null : grid.indexOf(id) + 1
                return (
                  <li key={id} className={[off && "off", id === teamId && "mine"].filter(Boolean).join(" ")}>
                    <span className="slot">{slot ? `P${slot}` : "–"}</span>
                    <Swatch teamId={id} />
                    <span className="grid-name"><b>{t.name}</b><small>{id === teamId && driving ? "You" : t.car}</small></span>
                    <span className="grid-actions">
                      <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${t.name} up`}>▲</button>
                      <button onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={`Move ${t.name} down`}>▼</button>
                      <button onClick={() => toggle(id)} aria-label={off ? `Add ${teamById(id).name} to the grid` : `Remove ${teamById(id).name} from the grid`}>{off ? "Add" : "Remove"}</button>
                    </span>
                  </li>
                )
              })}
            </ol>
          </section>
        </div>
        <button className="primary race-go" onClick={go}>Start race</button>
      </div>
    </div>
  )
}

// ── Controls ────────────────────────────────────────────────────────────────
const CAMS: TrackCam[] = ["chase", "onboard", "tv", "heli"]
const nextCam = () => { const g = useGarage.getState(); g.setTrackCam(CAMS[(CAMS.indexOf(g.trackCam) + 1) % CAMS.length]) }

function useRaceKeys(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const held = new Set<string>()
    const apply = () => {
      input.throttle = held.has("ArrowUp") || held.has("KeyW") ? 1 : 0
      input.brake = held.has("ArrowDown") || held.has("KeyS") ? 1 : 0
      input.steer = (held.has("ArrowLeft") || held.has("KeyA") ? 1 : 0) - (held.has("ArrowRight") || held.has("KeyD") ? 1 : 0)
      input.overtake = held.has("Space") || held.has("ShiftLeft") || held.has("ShiftRight")
    }
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault()
      if (e.code === "Escape") { if (race.phase !== "finished") setPaused(!race.paused); return }
      if (e.code === "KeyC" && !e.repeat) nextCam()
      held.add(e.code)
      apply()
    }
    const up = (e: KeyboardEvent) => { held.delete(e.code); apply() }
    const blur = () => { held.clear(); apply() }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", blur)
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); blur() }
  }, [enabled])
}

// On-screen pedals and steering for touch screens.
function TouchControls() {
  const hold = (key: "throttle" | "brake" | "left" | "right" | "overtake") => ({
    onPointerDown: (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId)
      if (key === "left") input.steer = 1
      else if (key === "right") input.steer = -1
      else if (key === "overtake") input.overtake = true
      else input[key] = 1
    },
    onPointerUp: () => {
      if (key === "left" || key === "right") input.steer = 0
      else if (key === "overtake") input.overtake = false
      else input[key] = 0
    },
  })
  return (
    <div className="touch-controls" aria-hidden>
      <div className="tc-steer"><button {...hold("left")}>◀</button><button {...hold("right")}>▶</button></div>
      <div className="tc-pedals"><button className="ot" {...hold("overtake")}>OT</button><button className="brk" {...hold("brake")}>Brake</button><button className="thr" {...hold("throttle")}>Throttle</button></div>
    </div>
  )
}

// ── HUD ─────────────────────────────────────────────────────────────────────
function StartLights({ lights, label }: { lights: number; label: string }) {
  return (
    <div className="start-lights" aria-live="polite">
      <div className="pods">
        {[0, 1, 2, 3, 4].map((i) => <span key={i} className="pod"><i className={i < lights ? "on" : ""} /><i className={i < lights ? "on" : ""} /></span>)}
      </div>
      <b>{label}</b>
    </div>
  )
}

// Track outline and every car, from above.
function MiniMap({ follow }: { follow: string }) {
  const [, tick] = useState(0)
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 100); return () => clearInterval(id) }, [])
  const { path, map } = useMemo(() => {
    const pts = track.samples.pos
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z) }
    const size = Math.max(maxX - minX, maxZ - minZ)
    const map = (x: number, z: number) => [8 + ((maxX - x) / size) * 144, 8 + ((maxZ - z) / size) * 144] as const
    let d = ""
    for (let i = 0; i < pts.length; i += 8) { const [x, y] = map(pts[i].x, pts[i].z); d += `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}` }
    return { path: d + "Z", map }
  }, [])
  const start = track.point(0)
  const [sx, sy] = map(start.x, start.z)
  return (
    <svg className="minimap" viewBox="0 0 160 160" aria-hidden>
      <path d={path} />
      <circle cx={sx} cy={sy} r="2" className="sf" />
      {race.cars.map((c) => {
        const q = track.point(c.s)
        const [x, y] = map(q.x, q.z)
        const me = c.teamId === follow
        return <circle key={c.teamId} cx={x} cy={y} r={me ? 4.5 : 3} fill={liveryFor(c.teamId).base} className={me ? "me" : ""} />
      })}
    </svg>
  )
}

// Steering-wheel style dashboard: rev lights, gear, speed, battery, gaps.
function Dashboard() {
  const [d, setD] = useState({ speed: 0, gear: 0, rpm: 0, battery: 1, boosting: false, ahead: "", behind: "", last: null as number | null, best: null as number | null, otReady: false })
  useEffect(() => {
    const id = setInterval(() => {
      const me = race.cars.find((c) => c.teamId === race.follow)
      if (!me) return
      const box = gearbox(me.motion.speed, me.motion.wheelspin, me.motion.throttle, performance.now() / 1000)
      const i = race.order.indexOf(me)
      const gap = (o: (typeof race.cars)[number] | undefined, sign: 1 | -1) =>
        o ? `${sign > 0 ? "−" : "+"}${(Math.abs(o.s - me.s) / Math.max(20, me.v)).toFixed(1)} ${teamById(o.teamId).code}` : ""
      const ahead = race.order[i - 1]
      const aheadSec = ahead ? (ahead.s - me.s) / Math.max(20, me.v) : Infinity
      setD({ speed: me.motion.speed, gear: box.gear, rpm: box.rpm, battery: me.battery, boosting: me.boosting, ahead: gap(ahead, 1), behind: gap(race.order[i + 1], -1), last: me.lastLap, best: me.bestLap, otReady: aheadSec < 1 })
    }, 60)
    return () => clearInterval(id)
  }, [])
  const lit = Math.round(Math.max(0, Math.min(1, (d.rpm - 9800) / 2100)) * 15)
  return (
    <div className="dash" aria-hidden>
      <div className="revs">{Array.from({ length: 15 }, (_, i) => <i key={i} className={i < lit ? (i < 5 ? "g" : i < 10 ? "r" : "b") : ""} />)}</div>
      <div className="dash-main">
        <div className="dash-delta"><small>Ahead</small><b>{d.ahead || "—"}</b><small>Behind</small><b>{d.behind || "—"}</b></div>
        <div className="dash-gear"><b>{d.gear === 0 ? "N" : d.gear}</b><span>{Math.round(d.speed)}<small> km/h</small></span></div>
        <div className="dash-ers">
          <small>Battery {Math.round(d.battery * 100)}%</small>
          <div className="ers-bar"><i style={{ width: `${d.battery * 100}%` }} /></div>
          <span className={d.boosting ? "ot on" : d.otReady ? "ot ready" : "ot"}>OVERTAKE</span>
        </div>
      </div>
      <div className="dash-laps"><span>Last <b>{d.last ? lapTime(d.last) : "—"}</b></span><span>Best <b>{d.best ? lapTime(d.best) : "—"}</b></span></div>
    </div>
  )
}

export function RaceHud() {
  const { phase, lights, lap, laps, rows, follow, player, paused, fastest, time } = useRace()
  const items = useMessages((s) => s.items)
  const [flash, setFlash] = useState(false)
  const justStarted = phase === "racing" && time < 0.6
  const coarse = useRef(typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches)
  useEffect(() => { if (justStarted) setFlash(true) }, [justStarted])
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(false), 1500)
    return () => clearTimeout(t)
  }, [flash])
  useRaceKeys(phase !== "idle")
  if (phase === "idle") return null
  const last = useRaceSetup.getState().last
  const me = rows.find((r) => r.teamId === follow)

  return (
    <>
      {(phase === "grid" || phase === "lights" || flash) && (
        <StartLights lights={lights} label={flash ? "LIGHTS OUT" : phase === "grid" ? "Formation complete" : player ? "Hold… throttle when the lights go out" : "Wait for the lights…"} />
      )}

      <div className="race-msgs" aria-live="polite">
        {items.map((m) => <div key={m.id} className={`race-msg ${m.tone}`}>{m.text}</div>)}
      </div>

      {phase !== "finished" && (
        <>
          <div className="pos-box">
            <div><small>POS</small><b>{me?.pos ?? "–"}<span>/{rows.length}</span></b></div>
            <div><small>LAP</small><b>{Math.max(1, lap)}<span>/{laps}</span></b></div>
          </div>

          <aside className="tower" aria-label="Timing">
            <ol>
              {rows.map((r) => (
                <li key={r.teamId} className={[r.teamId === follow && "follow", fastest?.teamId === r.teamId && "fastest"].filter(Boolean).join(" ")}>
                  <button onClick={() => setFollow(r.teamId)} title={player ? teamById(r.teamId).name : `Follow ${teamById(r.teamId).name}`}>
                    <span className="pos">{r.pos}</span>
                    <Swatch teamId={r.teamId} />
                    <span className="code">{r.code}</span>
                    <span className="gap">{phase === "grid" || phase === "lights" ? "" : r.pos === 1 ? "Interval" : r.interval}</span>
                  </button>
                </li>
              ))}
            </ol>
          </aside>

          <MiniMap follow={follow} />
          <Dashboard />
          <div className="race-corner">
            <button onClick={nextCam} aria-label="Change camera">Camera</button>
            <button onClick={() => setPaused(true)} aria-label="Pause">Pause</button>
          </div>
          {player && coarse.current && <TouchControls />}
        </>
      )}

      {paused && phase !== "finished" && (
        <div className="pause-menu" role="dialog" aria-label="Paused">
          <h2>Paused</h2>
          <button className="primary" onClick={() => setPaused(false)}>Resume</button>
          {last && <button className="secondary" onClick={() => startRace(last)}>Restart race</button>}
          <button className="secondary" onClick={() => { endRace(); openRaceSetup() }}>Race settings</button>
          <button className="secondary" onClick={endRace}>Quit to garage</button>
          <p className="muted small">↑ throttle · ↓ brake · ←→ steer · Space overtake · C camera</p>
        </div>
      )}

      {phase === "finished" && (
        <div className="results">
          <p className="eyebrow">Chequered flag</p>
          <h2>{me && player ? (me.pos === 1 ? "Victory!" : `You finished ${P(me.pos)}`) : "Race results"}</h2>
          <div className="podium-row">
            {[1, 0, 2].map((i) => rows[i] && (
              <div key={rows[i].teamId} className={`step p${i + 1}`}>
                <Swatch teamId={rows[i].teamId} />
                <b>{teamById(rows[i].teamId).name}</b>
                <span>P{i + 1}</span>
              </div>
            ))}
          </div>
          <table className="classification">
            <thead><tr><th>Pos</th><th>Team</th><th>Time</th><th>Best lap</th><th>Pen.</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.teamId} className={r.player ? "mine" : ""}>
                  <td>{r.pos}</td>
                  <td><Swatch teamId={r.teamId} />{teamById(r.teamId).name}</td>
                  <td>{r.gap}</td>
                  <td className={fastest?.teamId === r.teamId ? "purple" : ""}>{r.bestLap ? lapTime(r.bestLap) : "—"}</td>
                  <td>{r.penalty ? `+${r.penalty}s` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="results-actions">
            {last && <button className="primary" onClick={() => startRace(last)}>Race again</button>}
            <button className="secondary" onClick={() => { endRace(); openRaceSetup() }}>Change settings</button>
            <button className="secondary" onClick={endRace}>Back to the garage</button>
          </div>
        </div>
      )}
    </>
  )
}
