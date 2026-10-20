"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { liveryFor } from "@/lib/liveries"
import { TEAMS, teamById } from "@/lib/teams"

// One button with the current team; the full grid opens on demand.
export function TeamPicker({ teamId, onPick, firstVisit }: { teamId: string; onPick: (id: string) => void; firstVisit: boolean }) {
  const [open, setOpen] = useState(false)
  const team = teamById(teamId)
  const kit = liveryFor(teamId)

  useEffect(() => { if (firstVisit) setOpen(true) }, [firstVisit])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <>
      <button className="team-current" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <i style={{ background: `linear-gradient(135deg, ${kit.base} 50%, ${kit.stripe} 50%)` }} aria-hidden />
        <span><small>Your team</small><b>{team.name}</b></span>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
      {open && createPortal(
        <div className="picker" role="dialog" aria-modal="true" aria-label="Choose your team" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="picker-sheet">
            <header>
              <div><p className="eyebrow">2026 grid · 11 teams</p><h2>Choose your team</h2></div>
              <button className="cam-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
            </header>
            <ul className="picker-grid">
              {TEAMS.map((t) => {
                const k = liveryFor(t.id)
                return (
                  <li key={t.id}>
                    <button
                      className={t.id === teamId ? "picker-card on" : "picker-card"}
                      style={{ ["--a" as string]: k.base, ["--b" as string]: k.stripe, ["--c" as string]: k.lower }}
                      onClick={() => { onPick(t.id); setOpen(false) }}
                    >
                      <span className="picker-livery" aria-hidden><i /><i /><i /></span>
                      <b>{t.name}</b>
                      <small>{t.car} · {t.powerUnit}</small>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
