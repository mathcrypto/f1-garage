"use client"

import { useEffect, useMemo, useState } from "react"
import { startLesson } from "./EngineerCam"
import { LESSONS } from "@/lib/lessons"
import { SPEC_SOURCE, partById, type Part } from "@/lib/parts"
import { nextLearningStep, useProgress } from "@/lib/progress"
import { REGULATIONS_2026 } from "@/lib/regulations"
import { startShowcase } from "@/lib/showcase"
import { useEngineerState, useGarage } from "@/lib/store"
import { teamById } from "@/lib/teams"
import type { TeamStory } from "@/lib/server/teamStory"
import { latestUpgrade, upgradesForPart, upgradesForTeam, type UpgradePackage } from "@/lib/upgrades"

// Bite-sized learning: one idea on screen at a time, more on demand.

const STATS = [
  { value: "768 kg", label: "minimum mass", back: "722 kg for car and driver, plus 46 kg of tyres." },
  { value: "−30%", label: "downforce", back: "Less ground effect and smaller wings, with about 55% less drag too." },
  { value: "350 kW", label: "electric power", back: "The MGU-K is almost three times stronger: roughly a 50/50 split with the engine." },
]

const LESSON_ICONS: Record<string, string> = {
  "aero-basics": "M3 14c4-6 14-6 18 0M5 18c3-3 11-3 14 0",
  "ground-effect": "M3 17h18M6 13l3-4h6l3 4",
  "active-aero": "M4 16l6-8M14 16l6-8M3 19h18",
  "power-unit": "M7 4h10v6l-5 10-5-10z",
  "tyres-brakes": "M12 3a9 9 0 1 0 .01 0M12 8a4 4 0 1 0 .01 0",
  suspension: "M5 18l7-12 7 12M8 13h8",
}

function FlipTile({ value, label, back }: (typeof STATS)[number]) {
  const [flipped, setFlipped] = useState(false)
  return (
    <button className={flipped ? "tile flipped" : "tile"} onClick={() => setFlipped(!flipped)} aria-pressed={flipped}>
      <span className="tile-front">
        <b>{value}</b>
        <small>{label}</small>
      </span>
      <span className="tile-back">{back}</span>
    </button>
  )
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

const KIND_LABEL: Record<string, string> = {
  weekend: "Weekend",
  upgrade: "Upgrade",
  aero: "Aero",
  power: "Power unit",
  general: "Note",
}

function TeamBriefing({ onAsk }: { onAsk?: (q: string) => void }) {
  const teamId = useGarage((s) => s.teamId)
  const team = teamById(teamId)
  const [story, setStory] = useState<TeamStory | null>(null)
  const [loading, setLoading] = useState(true)
  const [openSrc, setOpenSrc] = useState(false)

  useEffect(() => {
    // Switching team cancels the previous request.
    const controller = new AbortController()
    setLoading(true)
    setOpenSrc(false)
    setStory(null)
    fetch(`/api/team-story?team=${encodeURIComponent(teamId)}`, { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<TeamStory>) : null))
      .then((data) => setStory(data))
      .catch(() => { if (!controller.signal.aborted) setStory(null) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [teamId])

  return (
    <section className="team-brief">
      <div className="team-brief-head">
        <div>
          <span className="eyebrow">From the paddock</span>
          <h5>
            {team.name} <small>live briefing</small>
          </h5>
        </div>
        {story?.cached && <span className="pill muted">Cached</span>}
      </div>

      {loading && <p className="muted small">Gathering FIA, media and team notes…</p>}

      {!loading && story && !story.available && (
        <p className="muted small">Live team news isn’t available right now. The upgrades below still show what changed on the car.</p>
      )}

      {!loading && story?.available && !story.bullets.length && (
        <p className="muted small">
          Nothing new on {team.name} in the trusted F1 sources right now — we won’t fill this with other teams or sponsor noise.
          The upgrades below still show what changed on the car.
        </p>
      )}

      {!loading && story && story.bullets.length > 0 && (
        <>
          <ul className="team-brief-list">
            {story.bullets.map((b, i) => {
              const src = story.sources[b.sourceIndex]
              return (
                <li key={`${b.sourceIndex}-${i}`}>
                  <span className="kind">{KIND_LABEL[b.kind] ?? "Note"}</span>
                  <p>{b.text}</p>
                  {src && (
                    <a className="src-line" href={src.url} target="_blank" rel="noreferrer">
                      {src.outlet}
                    </a>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="team-brief-actions">
            {onAsk && (
              <button
                type="button"
                className="link"
                onClick={() => onAsk(`What is ${team.name} fighting this weekend, and what upgrades are they talking about? Use live sources.`)}
              >
                Ask Lena about this →
              </button>
            )}
            {story.sources.length > 0 && (
              <button type="button" className="link muted" onClick={() => setOpenSrc((v) => !v)}>
                {openSrc ? "Hide sources" : `Sources (${story.sources.length})`}
              </button>
            )}
            {story.officialSite && (
              <a className="link muted" href={story.officialSite} target="_blank" rel="noreferrer">
                Official site
              </a>
            )}
          </div>

          {openSrc && (
            <div className="sources team-brief-sources">
              {story.sources.map((s) => (
                <a key={s.url} className="source" href={s.url} target="_blank" rel="noreferrer" title={s.title}>
                  <span className="source-dot" aria-hidden />
                  {s.outlet}
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function Upgrades() {
  const teamId = useGarage((s) => s.teamId)
  const team = teamById(teamId)
  const list = upgradesForTeam(teamId)
  const show = (u: UpgradePackage) => {
    useGarage.getState().setHighlights(u.parts)
  }
  return (
    <div className="upgrade-diary">
      <h5>
        {team.name} upgrades
      </h5>
      <ul className="upgrade-list">
        {list.map((u) => (
          <li key={u.id}>
            <button type="button" className="upgrade-row" onClick={() => show(u)}>
              <b>
                {u.event} · {u.title}
              </b>
              <small>{u.summary}</small>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Explore({ onAsk }: { onAsk?: (q: string) => void }) {
  const teamId = useGarage((s) => s.teamId)
  const lesson = useEngineerState((s) => s.lesson)
  const team = teamById(teamId)
  const partsSeen = useProgress((s) => s.parts)
  const lessonsSeen = useProgress((s) => s.lessons)
  const regsSeen = useProgress((s) => s.regs)
  const suggest = useMemo(() => nextLearningStep(partsSeen, lessonsSeen, regsSeen), [partsSeen, lessonsSeen, regsSeen])
  const latest = latestUpgrade(teamId)

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

      {latest && onAsk && (
        <button
          className="watch diary-cta"
          onClick={() => onAsk(`Walk me through ${team.name}'s latest upgrade package on the car`)}
        >
          <span className="watch-play" aria-hidden>
            ◆
          </span>
          <span>
            <b>Latest upgrade: {latest.event}</b>
            <small>{latest.title}</small>
          </span>
        </button>
      )}

      {suggest && onAsk && (
        <p className="muted small">
          Keep learning:{" "}
          <button
            className="link"
            type="button"
            onClick={() => {
              if (suggest.kind === "lesson") startLesson(suggest.id)
              else if (suggest.kind === "part") {
                useGarage.getState().select(suggest.id)
                onAsk(`Explain the ${suggest.label.toLowerCase()} simply`)
              } else onAsk(`Explain the 2026 regulation: ${suggest.label}`)
            }}
          >
            {suggest.label} →
          </button>
        </p>
      )}

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

      <h5>
        2026 in three numbers <small>tap to flip</small>
      </h5>
      <div className="tiles">{STATS.map((s) => <FlipTile key={s.label} {...s} />)}</div>

      <FactCard />
      <TeamBriefing onAsk={onAsk} />
      <Upgrades />
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
  if (!part) return <Explore onAsk={onAsk} />
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
          <div key={k} className={v.length > 18 ? "long" : ""}>
            <b>{v}</b>
            <small>{k}</small>
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
              <button
                key={u.id}
                type="button"
                className="upgrade-row compact"
                onClick={() => useGarage.getState().setHighlights(u.parts)}
              >
                <b>
                  {u.event}: {u.title}
                </b>
                <small>{u.parts.find((p) => p.id === part.id)?.note ?? u.summary}</small>
              </button>
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
