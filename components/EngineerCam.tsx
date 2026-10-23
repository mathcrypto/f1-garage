"use client"

import { useEffect, useRef, useState } from "react"
import { Lena, ENGINEER } from "./Lena"
import { LESSONS, lessonById, type LessonStep } from "@/lib/lessons"
import { useProgress } from "@/lib/progress"
import { useEngineerState, useGarage } from "@/lib/store"
import { voice } from "@/lib/voice"

export function applyStep(step: LessonStep) {
  const g = useGarage.getState()
  if (step.mode && step.mode !== g.mode) g.setMode(step.mode)
  if (step.exploded !== undefined) g.setExploded(step.exploded)
  if (step.flow !== undefined) g.setFlow(step.flow)
  if (step.technical !== undefined) g.setTechnical(step.technical)
  if (step.highlights) g.setHighlights(step.highlights)
  // A camera preset clears the selection, so apply it before choosing a part.
  if (step.camera && !step.part) g.setCamera(step.camera)
  if (step.part !== undefined) {
    if (useGarage.getState().exploded) g.setExploded(false)
    g.select(step.part)
  }
}

export function startLesson(id: string) {
  if (!lessonById(id)) return
  useEngineerState.getState().setLesson({ id, step: 0, playing: true })
  useProgress.getState().markLesson(id)
}

// Plays the active lesson: applies each step to the car, speaks it (or waits
// a reading-time pause without voice), then moves on.
function useLessonRunner() {
  const lesson = useEngineerState((s) => s.lesson)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!lesson) return
    const data = lessonById(lesson.id)
    const step = data?.steps[lesson.step]
    if (!data || !step) return
    applyStep(step)
    const st = useEngineerState.getState()
    // With her voice on, the caption appears when she starts saying it.
    if (!(voice.enabled && voice.supported) || !lesson.playing) st.setCaption(step.say)
    if (!lesson.playing) { voice.stop(); return }

    const next = () => {
      const cur = useEngineerState.getState().lesson
      if (!cur || cur.id !== lesson.id || cur.step !== lesson.step || !cur.playing) return
      if (cur.step + 1 < data.steps.length) useEngineerState.getState().setLesson({ ...cur, step: cur.step + 1 })
      else {
        useEngineerState.getState().setLesson({ ...cur, playing: false })
        useProgress.getState().markLesson(cur.id)
      }
    }
    if (voice.enabled && voice.supported) {
      voice.unlock()
      // Have the next steps ready before they're needed.
      voice.prefetch(data.steps.slice(lesson.step + 1, lesson.step + 3).map((s) => s.say))
      voice.say(step.say, () => { timer.current = setTimeout(next, 250) })
    } else {
      st.setStatus("talking")
      const words = step.say.split(/\s+/).length
      timer.current = setTimeout(() => { useEngineerState.getState().setStatus("idle"); next() }, 1500 + words * 330)
    }
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [lesson])
}

export function LessonList({ compact = false }: { compact?: boolean }) {
  const active = useEngineerState((s) => s.lesson)
  return (
    <ul className={compact ? "lessons compact" : "lessons"}>
      {LESSONS.map((l, i) => (
        <li key={l.id}>
          <button className={active?.id === l.id ? "on" : ""} onClick={() => startLesson(l.id)}>
            <span className="lesson-num">{String(i + 1).padStart(2, "0")}</span>
            <span><strong>{l.title}</strong>{!compact && <small>{l.summary}</small>}</span>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function EngineerCam() {
  useLessonRunner()
  const teamId = useGarage((s) => s.teamId)
  const { status, caption, lesson, setLesson, setCaption } = useEngineerState()
  const [hidden, setHidden] = useState(false)
  const [lingering, setLingering] = useState(false)
  const data = lesson ? lessonById(lesson.id) : undefined

  // Show every new line, and keep it on screen for a moment after she stops.
  useEffect(() => {
    if (!caption && status === "idle") return
    setLingering(true)
    setHidden(false)
    if (status !== "idle") return
    const t = setTimeout(() => setLingering(false), 6000)
    return () => clearTimeout(t)
  }, [status, caption])

  const visible = !hidden && (status !== "idle" || lesson || lingering) && (caption || status === "thinking" || lesson)
  if (!visible) return null

  const go = (step: number) => lesson && data && setLesson({ ...lesson, step: Math.max(0, Math.min(data.steps.length - 1, step)), playing: true })
  const close = () => {
    voice.stop()
    setLesson(null)
    setCaption("")
    setHidden(true)
    const g = useGarage.getState()
    if (lesson) { g.setFlow(false); g.setTechnical(false); g.setHighlights([]); g.select(null) }
  }

  return (
    <section className="cam" aria-live="polite" aria-label={`${ENGINEER.name} explains`}>
      <div className="cam-portrait">
        <Lena size={84} teamId={teamId} />
        <span className={`cam-status ${status}`}>{status === "thinking" ? "Thinking" : status === "talking" ? "On radio" : "Standing by"}</span>
      </div>
      <div className="cam-body">
        <header>
          <div><strong>{ENGINEER.name}</strong><small>{data ? data.title : ENGINEER.role}</small></div>
          <button className="cam-close" onClick={close} aria-label="Close">×</button>
        </header>
        <p className="cam-caption">{status === "thinking" && !caption ? "Let me check the data…" : caption}</p>
        {lesson && data && (
          <div className="cam-controls">
            <div className="cam-progress">{data.steps.map((_, i) => <i key={i} className={i < lesson.step ? "done" : i === lesson.step ? "now" : ""} />)}</div>
            <button onClick={() => go(lesson.step - 1)} disabled={lesson.step === 0} aria-label="Previous">‹</button>
            <button onClick={() => (lesson.playing ? (voice.stop(), setLesson({ ...lesson, playing: false })) : setLesson({ ...lesson, playing: true }))} aria-label={lesson.playing ? "Pause" : "Play"}>
              {lesson.playing ? "❚❚" : "▶"}
            </button>
            <button onClick={() => go(lesson.step + 1)} disabled={lesson.step >= data.steps.length - 1} aria-label="Next">›</button>
          </div>
        )}
      </div>
    </section>
  )
}
