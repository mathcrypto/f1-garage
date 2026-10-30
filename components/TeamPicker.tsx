"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { TEAMS, teamById, type Team } from "@/lib/teams"

/**
 * The team's car as it looks in the garage: a side-on render of the 3D car in
 * its livery (public/teams/{id}.webp, rendered from the app's side camera).
 */
function CarRender({ team }: { team: Team }) {
  // eslint-disable-next-line @next/next/no-img-element -- small static render, no optimisation needed
  return <img className="picker-car" src={`/teams/${team.id}.webp`} alt="" width={640} height={182} loading="lazy" decoding="async" />
}

// One button with the current team; the grid of teams opens on demand.
export function TeamPicker({ teamId, onPick, firstVisit }: { teamId: string; onPick: (id: string) => void; firstVisit: boolean }) {
  const [open, setOpen] = useState(false)
  const current = useRef<HTMLButtonElement>(null)
  const team = teamById(teamId)

  useEffect(() => { if (firstVisit) setOpen(true) }, [firstVisit])
  useEffect(() => {
    if (!open) return
    current.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <>
      <button className="team-current" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <i className="team-swatch" style={{ background: team.ui }} aria-hidden />
        <span><small>Your team</small><b>{team.name}</b></span>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
      {open && createPortal(
        <div className="picker" role="dialog" aria-modal="true" aria-labelledby="picker-title" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="picker-sheet">
            <header>
              <div>
                <p className="eyebrow">2026 grid · {TEAMS.length} teams</p>
                <h2 id="picker-title">Choose your team</h2>
                <p className="picker-sub">Your garage, livery and race engineer follow the team you pick. Switch any time.</p>
              </div>
              <button className="cam-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
            </header>
            <ul className="picker-grid">
              {TEAMS.map((t) => (
                <li key={t.id}>
                  <button
                    ref={t.id === teamId ? current : undefined}
                    className={t.id === teamId ? "picker-card on" : "picker-card"}
                    style={{ ["--tc" as string]: t.ui }}
                    aria-pressed={t.id === teamId}
                    onClick={() => { onPick(t.id); setOpen(false) }}
                  >
                    <span className="picker-code">{t.code}</span>
                    <CarRender team={t} />
                    <span className="picker-name">{t.name}</span>
                    <span className="picker-meta">{t.car} · {t.powerUnit} power</span>
                    {t.id === teamId && <span className="picker-badge">Your team</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
