"use client"

import { useEffect, useState } from "react"
import { startLesson } from "./EngineerCam"
import { LESSONS } from "@/lib/lessons"
import { SPEC_SOURCE, partById, type Part } from "@/lib/parts"
import { useProgress } from "@/lib/progress"
import { REGULATIONS_2026 } from "@/lib/regulations"
import { startShowcase } from "@/lib/showcase"
import { useEngineerState, useGarage } from "@/lib/store"
import { teamById } from "@/lib/teams"
import { upgradeMonth, upgradesForPart, upgradesForTeam, type UpgradePackage } from "@/lib/upgrades"

// Bite-sized learning: one idea on screen at a time, more on demand.

const LESSON_ICONS: Record<string, string> = {
  "aero-basics": "M3 14c4-6 14-6 18 0M5 18c3-3 11-3 14 0",
  "ground-effect": "M3 17h18M6 13l3-4h6l3 4",
  "active-aero": "M4 16l6-8M14 16l6-8M3 19h18",
  "power-unit": "M7 4h10v6l-5 10-5-10z",
  "tyres-brakes": "M12 3a9 9 0 1 0 .01 0M12 8a4 4 0 1 0 .01 0",
  suspension: "M5 18l7-12 7 12M8 13h8",
}

function FactCard() {
  const [i, setI] = useState(0)
  const fact = REGULATIONS_2026[i]
  const go = (d: number) => {
    const next = (i + d + REGULATIONS_2026.length) % REGULATIONS_2026.length
    setI(next)
    useProgress.getState().markReg(REGULATIONS_2026[next].title)
  }
  useEffect(() => {
    useProgress.getState().markReg(fact.title)
  }, [fact.title])
  return (
    <div className="fact">
      <div className="fact-head">
        <span className="eyebrow">Did you know?</span>
        <span className="fact-nav">
          <button onClick={() => go(-1)} aria-label="Previous fact">
            ‹
          </button>
          <small>
            {i + 1}/{REGULATIONS_2026.length}
          </small>
          <button onClick={() => go(1)} aria-label="Next fact">
            ›
          </button>
        </span>
      </div>
      <p key={i} className="fact-body">
        <strong>{fact.title}.</strong> {fact.body}
      </p>
      <button
        className="link"
        onClick={() => useGarage.getState().setHighlights(fact.parts.map((id) => ({ id, note: fact.title })))}
      >
        Show me on the car →
      </button>
    </div>
  )
}

/** Links to check an upgrade: the FIA document and/or the reports it came from. */
function UpgradeSources({ u }: { u: UpgradePackage }) {
  return (
    <span className="upgrade-sources">
      {u.sources.map((s) => (
        <a key={s.url} href={s.url} target="_blank" rel="noreferrer" title={s.title}>
          Check source: {s.title.split(":")[0]} ↗
        </a>
      ))}
    </span>
  )
}

/** The team's sourced 2026 upgrades as a timeline; tapping one lights it up on the car. */
function Upgrades() {
  const teamId = useGarage((s) => s.teamId)
  const highlights = useGarage((s) => s.highlights)
  const team = teamById(teamId)
  const list = upgradesForTeam(teamId)
  const [active, setActive] = useState<string | null>(null)
  useEffect(() => setActive(null), [teamId])
  // Something else (Lena, a lesson) replaced the highlights: drop the active state.
  useEffect(() => {
    if (!highlights.length) setActive(null)
  }, [highlights])
  if (!list.length) return null

  const toggle = (u: UpgradePackage) => {
    const on = active !== u.id
    setActive(on ? u.id : null)
    useGarage.getState().setHighlights(on ? u.parts : [])
  }

  return (
    <section className="upgrades" aria-label={`${team.name} upgrades`}>
      <header className="upgrades-head">
        <span className="eyebrow">Development</span>
        <h4>{team.name} upgrades</h4>
        <small>Declared to the FIA this season. Tap one to see it on the {team.car}.</small>
      </header>
      <ol className="upgrade-timeline">
        {list.map((u) => (
          <li key={u.id} className={active === u.id ? "on" : undefined}>
            <button type="button" className="upgrade-item" onClick={() => toggle(u)} aria-pressed={active === u.id}>
              <span className="upgrade-event">
                {u.event} GP
                <em>{upgradeMonth(u)}</em>
              </span>
              <b>{u.title}</b>
              <small>{u.summary}</small>
              <span className="upgrade-parts">
                {u.parts.map((p) => (
                  <span key={p.id} title={p.note}>
                    {partById(p.id)?.name ?? p.id}
                  </span>
                ))}
              </span>
            </button>
            <UpgradeSources u={u} />
          </li>
        ))}
      </ol>
    </section>
  )
}

export function Explore() {
  const teamId = useGarage((s) => s.teamId)
  const lesson = useEngineerState((s) => s.lesson)
  const team = teamById(teamId)

  useEffect(() => {
    useProgress.getState().hydrate()
  }, [])

  return (
    <div className="explore">
      <div className="hint-card">
        <span className="tap" aria-hidden>
          <i />
        </span>
        <div>
          <b>Tap any part of the car</b>
          <small>It comes off, and Lena explains it.</small>
        </div>
      </div>
      <button className="watch" onClick={() => startShowcase()}>
        <span className="watch-play" aria-hidden>
          ▶
        </span>
        <span>
          <b>Watch the {team.car} come apart</b>
          <small>Take-apart, X-ray, then out on track</small>
        </span>
      </button>

      <Upgrades />

      <h5>Learn with Lena</h5>
      <div className="lesson-rail">
        {LESSONS.map((l) => (
          <button
            key={l.id}
            className={lesson?.id === l.id ? "lesson-chip on" : "lesson-chip"}
            onClick={() => {
              startLesson(l.id)
              useProgress.getState().markLesson(l.id)
            }}
            title={l.summary}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
              <path d={LESSON_ICONS[l.id]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{l.title}</span>
          </button>
        ))}
      </div>


      <FactCard />
    </div>
  )
}

const STEPS: { key: keyof Pick<Part, "howItWorks" | "regulation2026" | "watchFor">; label: string }[] = [
  { key: "howItWorks", label: "How it works" },
  { key: "regulation2026", label: "2026 rules" },
  { key: "watchFor", label: "Upgrades" },
]

export function PartCard({ onAsk }: { onAsk: (q: string) => void }) {
  const selected = useGarage((s) => s.selected)
  const highlights = useGarage((s) => s.highlights)
  const teamId = useGarage((s) => s.teamId)
  const [step, setStep] = useState(0)
  useEffect(() => setStep(0), [selected])
  useEffect(() => {
    if (selected) useProgress.getState().markPart(selected)
  }, [selected])
  const part = selected ? partById(selected) : undefined
  if (!part) return <Explore />
  const team = teamById(teamId)
  const note = highlights.find((h) => h.id === part.id)?.note
  const current = STEPS[step]
  const teamPacks = upgradesForPart(teamId, part.id)

  return (
    <article className="part-card">
      <button className="back" onClick={() => useGarage.getState().select(null)}>
        ‹ All parts
      </button>
      <p className="eyebrow">{part.system}</p>
      <h3>{part.name}</h3>
      {note && <p className="lit-note">{note}</p>}
      <p className="lede">{part.summary}</p>

      <div className="key-specs">
        {part.specs.slice(0, 3).map(([k, v]) => (
          <div key={k}>
            <small>{k}</small>
            <b>{v}</b>
          </div>
        ))}
      </div>

      <div className="steps-card">
        <div className="step-tabs" role="tablist">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              role="tab"
              aria-selected={i === step}
              className={i === step ? "on" : i < step ? "seen" : ""}
              onClick={() => setStep(i)}
            >
              <i>{i + 1}</i>
              {s.label}
            </button>
          ))}
        </div>
        <p key={`${part.id}-${step}`} className="step-body">
          {part[current.key]}
        </p>
        {current.key === "watchFor" && teamPacks.length > 0 && (
          <div className="part-upgrades">
            <p className="eyebrow">{team.name} upgrades to this part</p>
            {teamPacks.map((u) => (
              <div key={u.id}>
                <button type="button" className="upgrade-row compact" onClick={() => useGarage.getState().setHighlights(u.parts)}>
                  <b>
                    {u.event} GP: {u.title}
                  </b>
                  <small>{u.parts.find((p) => p.id === part.id)?.note ?? u.summary}</small>
                </button>
                <UpgradeSources u={u} />
              </div>
            ))}
          </div>
        )}
        <div className="step-foot">
          {step < STEPS.length - 1 ? (
            <button className="link" onClick={() => setStep(step + 1)}>
              Next: {STEPS[step + 1].label} →
            </button>
          ) : (
            <button
              className="link"
              onClick={() =>
                onAsk(
                  `Explain the ${part.name.toLowerCase()} in depth: the physics, the trade-offs, and how it interacts with the rest of the car.`,
                )
              }
            >
              Go deeper with Lena →
            </button>
          )}
        </div>
      </div>

      <div className="part-cta">
        <button
          className="primary"
          onClick={() =>
            onAsk(
              `What has ${team.name} changed on the ${part.name.toLowerCase()}? Show the upgrade on the car.`,
            )
          }
        >
          {team.name}&apos;s upgrades
        </button>
        <button className="secondary" onClick={() => onAsk(`Explain the ${part.name.toLowerCase()} simply, like I'm new to F1.`)}>
          Ask Lena
        </button>
      </div>

      {part.specs.length > 3 && (
        <details className="all-specs">
          <summary>All specs</summary>
          <dl className="specs">
            {part.specs.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      <a className="source-link" href={SPEC_SOURCE.url} target="_blank" rel="noreferrer">
        Figures: {SPEC_SOURCE.label}
      </a>
    </article>
  )
}
