"use client"

import { useEffect, useState } from "react"
import { create } from "zustand"
import { liveryFor } from "@/lib/liveries"
import { race, setFollow, setupRace, stopRace, useRace } from "@/lib/race"
import { sound } from "@/lib/sound"
import { useEngineerState, useGarage } from "@/lib/store"
import { TEAMS, teamById } from "@/lib/teams"
import { voice } from "@/lib/voice"

export const useRaceSetup = create<{ open: boolean; last: { order: string[]; laps: number } | null }>(() => ({ open: false, last: null }))
export const openRaceSetup = () => useRaceSetup.setState({ open: true })

// Lena on the radio during the race: only about the car you follow, and
// minor calls give way when she's already talking.
let lastCall = 0
function radio(text: string, important = false) {
  const now = performance.now()
  const busy = useEngineerState.getState().status === "talking"
  if (!important && (busy || now - lastCall < 5000)) return
  lastCall = now
  voice.say(text)
}

const ordinal = (n: number) => `P${n}`

export function startRace(order: string[], laps: number) {
  const g = useGarage.getState()
  const follow = order.includes(g.teamId) ? g.teamId : order[0]
  useRaceSetup.setState({ open: false, last: { order, laps } })
  setupRace(order, laps, follow, {
    light: (n) => void sound.beep(n === 5 ? 990 : 880, 0.2),
    lightsOut: () => radio("Lights out! Go, go, go!", true),
    position: (teamId, from, to) => {
      if (teamId !== race.follow || from === to) return
      if (to < from) radio(to === 1 ? "Great move. You're leading the race. P1." : `Nice move. ${ordinal(to)}.`)
      else radio(`${ordinal(to)}. Stay calm, we'll get it back.`)
    },
    finalLap: () => radio("Final lap. Final lap. Bring it home.", true),
    finish: (teamId, pos) => {
      if (teamId !== race.follow) return
      radio(pos === 1 ? "Chequered flag. P1! Get in there! What a drive." : pos <= 3 ? `${ordinal(pos)}, that's a podium. Great job.` : `${ordinal(pos)}. Good effort today. We go again.`, true)
    },
  })
  g.setTrackCam("chase")
  g.setMode("race")
  void sound.setEngine(true)
  // Races run to the anthem.
  void sound.setMusic(true)
  const slot = order.indexOf(follow) + 1
  setTimeout(() => radio(`Radio check. ${ordinal(slot)} on the grid. Clutch in, wait for the lights.`, true), 400)
}

export function endRace() {
  stopRace()
  sound.engineStop()
  useGarage.getState().setMode("studio")
}

function Swatch({ teamId }: { teamId: string }) {
  const k = liveryFor(teamId)
  return <i className="swatch" style={{ background: `linear-gradient(135deg, ${k.base} 55%, ${k.stripe} 55%)` }} aria-hidden />
}

export function RaceSetup() {
  const open = useRaceSetup((s) => s.open)
  const last = useRaceSetup((s) => s.last)
  const teamId = useGarage((s) => s.teamId)
  const [order, setOrder] = useState<string[]>(() => TEAMS.map((t) => t.id))
  const [out, setOut] = useState<Set<string>>(new Set())
  const [laps, setLaps] = useState(3)

  useEffect(() => {
    if (!open) return
    if (last) { setOrder([...last.order, ...TEAMS.map((t) => t.id).filter((id) => !last.order.includes(id))]); setLaps(last.laps); setOut(new Set(TEAMS.map((t) => t.id).filter((id) => !last.order.includes(id)))) }
  }, [open, last])

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
    else if (order.length - next.size > 2) next.add(id)
    setOut(next)
  }
  const grid = order.filter((id) => !out.has(id))

  return (
    <div className="picker" role="dialog" aria-modal="true" aria-label="Race setup" onClick={(e) => e.target === e.currentTarget && useRaceSetup.setState({ open: false })}>
      <div className="picker-sheet race-sheet">
        <header>
          <div><p className="eyebrow">Night race · {grid.length} cars</p><h2>Set the grid</h2></div>
          <button className="cam-close" onClick={() => useRaceSetup.setState({ open: false })} aria-label="Close">×</button>
        </header>
        <div className="race-presets">
          <button onClick={() => setOrder([...order].sort(() => Math.random() - 0.5))}>Shuffle</button>
          <button onClick={() => setOrder([...order].reverse())}>Reverse</button>
          <button onClick={() => setOrder([teamId, ...order.filter((id) => id !== teamId)])}>{teamById(teamId).name} on pole</button>
          <span className="race-laps" role="group" aria-label="Laps">
            {[2, 3, 5].map((n) => <button key={n} className={laps === n ? "on" : ""} onClick={() => setLaps(n)}>{n} laps</button>)}
          </span>
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
                <span className="grid-name"><b>{t.name}</b><small>{t.car}</small></span>
                <span className="grid-actions">
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${t.name} up`}>▲</button>
                  <button onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={`Move ${t.name} down`}>▼</button>
                  <button onClick={() => toggle(id)} aria-pressed={!off}>{off ? "Add" : "In"}</button>
                </span>
              </li>
            )
          })}
        </ol>
        <button className="primary race-go" onClick={() => startRace(grid, laps)}>Line up on the grid</button>
      </div>
    </div>
  )
}

export function RaceHud() {
  const { phase, lights, lap, laps, rows, follow, time } = useRace()
  const [flash, setFlash] = useState(false)
  // "LIGHTS OUT" for a moment after the start.
  const justStarted = phase === "racing" && time < 0.6
  useEffect(() => { if (justStarted) setFlash(true) }, [justStarted])
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(false), 1800)
    return () => clearTimeout(t)
  }, [flash])
  if (phase === "idle") return null
  const last = useRaceSetup.getState().last

  return (
    <>
      {(phase === "grid" || phase === "lights" || flash) && (
        <div className="start-lights" aria-live="polite">
          <div className="pods">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="pod"><i className={i < lights ? "on" : ""} /><i className={i < lights ? "on" : ""} /></span>
            ))}
          </div>
          <b>{flash ? "LIGHTS OUT" : phase === "grid" ? "Formation complete" : "Wait for the lights…"}</b>
        </div>
      )}

      <aside className="tower" aria-label="Timing">
        <header><span>LAP</span><b>{Math.max(1, lap)}<small>/{laps}</small></b></header>
        <ol>
          {rows.map((r) => (
            <li key={r.teamId} className={r.teamId === follow ? "follow" : ""}>
              <button onClick={() => setFollow(r.teamId)} title={`Follow ${teamById(r.teamId).name}`}>
                <span className="pos">{r.pos}</span>
                <Swatch teamId={r.teamId} />
                <span className="code">{r.code}</span>
                <span className="gap">{phase === "grid" || phase === "lights" ? "" : r.gap}</span>
              </button>
            </li>
          ))}
        </ol>
        <footer>Click a team to follow it</footer>
      </aside>

      {phase === "finished" && (
        <div className="results">
          <p className="eyebrow">Chequered flag</p>
          <h2>Race results</h2>
          <div className="podium-row">
            {[1, 0, 2].map((i) => rows[i] && (
              <div key={rows[i].teamId} className={`step p${i + 1}`}>
                <Swatch teamId={rows[i].teamId} />
                <b>{teamById(rows[i].teamId).name}</b>
                <span>P{i + 1}</span>
              </div>
            ))}
          </div>
          <ol className="classification">
            {rows.slice(3).map((r) => <li key={r.teamId}><span>P{r.pos}</span><Swatch teamId={r.teamId} />{teamById(r.teamId).name}<small>{r.gap}</small></li>)}
          </ol>
          <div className="results-actions">
            {last && <button className="primary" onClick={() => startRace(last.order, last.laps)}>Race again</button>}
            <button className="secondary" onClick={() => { endRace(); openRaceSetup() }}>Change the grid</button>
            <button className="secondary" onClick={endRace}>Back to the garage</button>
          </div>
        </div>
      )}
    </>
  )
}
