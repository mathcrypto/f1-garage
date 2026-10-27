"use client"

import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { TEAMS, teamById, type Team } from "@/lib/teams"

/** Side-on F1 silhouette painted in a team's livery colours. */
function CarSilhouette({ team }: { team: Team }) {
  const id = useId().replace(/:/g, "")
  const { primary, secondary, accent } = team.livery
  return (
    <svg className="picker-car" viewBox="0 0 200 52" aria-hidden>
      <defs>
        <linearGradient id={`b${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={primary} />
          <stop offset="0.62" stopColor={primary} />
          <stop offset="0.62" stopColor={secondary} />
          <stop offset="1" stopColor={secondary} />
        </linearGradient>
      </defs>
      {/* Rear wing */}
      <path d="M4 9h24v5H18v20h-4V14H4z" fill="#3a3d45" />
      <path d="M4 9h24v2H4z" fill={accent} />
      {/* Floor */}
      <path d="M18 40h158v3H18z" fill="#0d0e11" />
      {/* Body: engine cover, cockpit, nose */}
      <path d="M16 39 21 24l26 1 18-8h20l7 7h16l14 3 46 4 22 4 2 4z" fill={`url(#b${id})`} />
      <path d="M60 30h56l-4 3H63z" fill={accent} opacity="0.9" />
      {/* Halo */}
      <path d="M90 24q8-10 22 0" fill="none" stroke="#1b1d22" strokeWidth="3" strokeLinecap="round" />
      {/* Front wing */}
      <path d="M166 41h30v3h-30z" fill="#3a3d45" />
      {/* Wheels */}
      {[42, 150].map((x) => (
        <g key={x}>
          <circle cx={x} cy={38} r={12} fill="#0b0b0d" />
          <circle cx={x} cy={38} r={6.5} fill="none" stroke="#3a3d44" strokeWidth="1.5" />
        </g>
      ))}
    </svg>
  )
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
                    <CarSilhouette team={t} />
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
