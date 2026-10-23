"use client"

import { create } from "zustand"
import { LESSONS } from "./lessons"
import { PARTS } from "./parts"
import { REGULATIONS_2026 } from "./regulations"

const KEY = "f1-garage:progress"

export type LearningHint = { kind: "lesson" | "part" | "reg"; id: string; label: string }

export type Progress = {
  parts: string[]
  lessons: string[]
  regs: string[]
  markPart: (id: string) => void
  markLesson: (id: string) => void
  markReg: (title: string) => void
  /** Prefer `nextLearningStep(parts, lessons, regs)` in React selectors — this returns a new object each call. */
  suggestNext: () => LearningHint | null
  hydrate: () => void
}

function load(): Pick<Progress, "parts" | "lessons" | "regs"> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { parts: [], lessons: [], regs: [] }
    const j = JSON.parse(raw) as { parts?: string[]; lessons?: string[]; regs?: string[] }
    return {
      parts: Array.isArray(j.parts) ? j.parts : [],
      lessons: Array.isArray(j.lessons) ? j.lessons : [],
      regs: Array.isArray(j.regs) ? j.regs : [],
    }
  } catch {
    return { parts: [], lessons: [], regs: [] }
  }
}

function save(s: Pick<Progress, "parts" | "lessons" | "regs">) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ parts: s.parts, lessons: s.lessons, regs: s.regs }))
  } catch {}
}

/** Stable for React: call from useMemo on parts/lessons/regs, never as a Zustand selector result. */
export function nextLearningStep(parts: string[], lessons: string[], regs: string[]): LearningHint | null {
  const lesson = LESSONS.find((l) => !lessons.includes(l.id))
  if (lesson) return { kind: "lesson", id: lesson.id, label: lesson.title }
  const part = PARTS.find((p) => !parts.includes(p.id))
  if (part) return { kind: "part", id: part.id, label: part.name }
  const reg = REGULATIONS_2026.find((r) => !regs.includes(r.title))
  if (reg) return { kind: "reg", id: reg.title, label: reg.title }
  return null
}

export const useProgress = create<Progress>((set, get) => ({
  parts: [],
  lessons: [],
  regs: [],
  hydrate: () => {
    const data = load()
    const cur = get()
    if (
      data.parts.length === cur.parts.length &&
      data.lessons.length === cur.lessons.length &&
      data.regs.length === cur.regs.length &&
      data.parts.every((id, i) => id === cur.parts[i]) &&
      data.lessons.every((id, i) => id === cur.lessons[i]) &&
      data.regs.every((id, i) => id === cur.regs[i])
    ) {
      return
    }
    set(data)
  },
  markPart: (id) => {
    if (get().parts.includes(id)) return
    const parts = [...get().parts, id]
    save({ ...get(), parts })
    set({ parts })
  },
  markLesson: (id) => {
    if (get().lessons.includes(id)) return
    const lessons = [...get().lessons, id]
    save({ ...get(), lessons })
    set({ lessons })
  },
  markReg: (title) => {
    if (get().regs.includes(title)) return
    const regs = [...get().regs, title]
    save({ ...get(), regs })
    set({ regs })
  },
  suggestNext: () => nextLearningStep(get().parts, get().lessons, get().regs),
}))
