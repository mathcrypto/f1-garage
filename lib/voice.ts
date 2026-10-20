"use client"

import { useEngineerState } from "./store"

// Lena's voice, using the browser's built-in speech synthesis. Answers are
// spoken sentence by sentence as they stream in.

// British English voices, best first. Lena always speaks en-GB.
const PREFERRED = ["Microsoft Sonia Online", "Microsoft Libby Online", "Microsoft Maisie Online", "Google UK English Female", "Microsoft Libby", "Microsoft Sonia", "Microsoft Hazel", "Microsoft Susan", "Serena", "Kate", "Stephanie", "Martha"]
const MALE = /\b(Daniel|Arthur|Oliver|George|Ryan|Thomas|Male|Google UK English Male)\b/i

const clean = (text: string) =>
  text
    .replace(/\*\*|__|`/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/^[-*•]\s+/gm, "")
    .replace(/km\/h/g, "kilometres per hour")
    .replace(/\bkW\b/g, "kilowatts")
    .replace(/\bMJ\b/g, "megajoules")
    .replace(/\bmm\b/g, "millimetres")
    .replace(/\bERS\b/g, "E R S")
    .replace(/\bMGU-K\b/g, "M G U K")
    .replace(/\bFIA\b/g, "F I A")
    .replace(/\s+/g, " ")
    .trim()

class Voice {
  enabled = false
  private buffer = ""
  private pending = 0
  private onIdle: (() => void) | null = null

  get supported() {
    return typeof window !== "undefined" && "speechSynthesis" in window
  }

  private pickVoice() {
    const voices = window.speechSynthesis.getVoices()
    for (const name of PREFERRED) {
      const v = voices.find((x) => x.name.startsWith(name))
      if (v) return v
    }
    const gb = voices.filter((v) => v.lang.replace("_", "-").startsWith("en-GB"))
    return gb.find((v) => !MALE.test(v.name)) ?? gb[0] ?? null
  }

  setEnabled(on: boolean) {
    this.enabled = on
    if (!on) this.stop()
  }

  // Speak a full line now (lessons). Calls `done` once it finishes.
  say(text: string, done?: () => void) {
    this.stop()
    if (!this.enabled || !this.supported) { done?.(); return }
    // If speech fails or ends instantly (no voices installed), still give
    // people time to read the line before moving on.
    const started = Date.now()
    const minMs = 1200 + text.split(/\s+/).length * 300
    this.onIdle = done ? () => setTimeout(done, Math.max(0, minMs - (Date.now() - started) - 2000)) : null
    this.queue(text)
    // Show her talking right away, even if the voice is slow to start or missing.
    const st = useEngineerState.getState()
    st.setCaption(clean(text))
    st.setStatus("talking")
  }

  // Streaming: feed answer text as it arrives; complete sentences are spoken.
  feed(delta: string) {
    if (!this.enabled || !this.supported) return
    this.buffer += delta
    const re = /^([\s\S]*?[.!?:])(\s+|\n)/
    let m: RegExpExecArray | null
    while ((m = re.exec(this.buffer))) {
      this.queue(m[1])
      this.buffer = this.buffer.slice(m[0].length)
    }
  }

  flush() {
    if (this.buffer.trim()) this.queue(this.buffer)
    this.buffer = ""
  }

  stop() {
    this.buffer = ""
    this.pending = 0
    this.onIdle = null
    if (this.supported) window.speechSynthesis.cancel()
    const s = useEngineerState.getState()
    if (s.status === "talking") s.setStatus("idle")
  }

  private queue(raw: string) {
    const text = clean(raw)
    if (!text) return
    const u = new SpeechSynthesisUtterance(text)
    const v = this.pickVoice()
    if (v) u.voice = v
    u.lang = "en-GB"
    u.rate = 1.02
    u.pitch = 1.05
    const st = useEngineerState.getState
    u.onstart = () => { st().setStatus("talking"); st().setCaption(text) }
    u.onboundary = () => st().bumpMouth()
    u.onend = u.onerror = () => {
      this.pending = Math.max(0, this.pending - 1)
      if (this.pending === 0) {
        st().setStatus("idle")
        const cb = this.onIdle
        this.onIdle = null
        cb?.()
      }
    }
    this.pending++
    window.speechSynthesis.speak(u)
  }
}

export const voice = new Voice()
