"use client"

import { useEngineerState } from "./store"

// Lena's voice: natural neural speech from /api/voice (Kokoro on the server,
// or Azure / ElevenLabs with a key), the browser's own voice only when no
// neural voice is available at all.
// Sentences are generated ahead and played back to back through Web Audio,
// so there are no gaps between them, they always finish in order, and the
// same line is never started twice.

// Browser fallback: British English female voices, best first.
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

const sentences = (text: string) => text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? []

type Line = { text: string; audio: Promise<AudioBuffer | null> }

class Voice {
  enabled = true
  private neural: boolean | null = null
  private queue: Line[] = []
  private playing = false
  private buffer = ""
  private pending = ""
  private gen = 0
  private waiters: (() => void)[] = []
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: AudioBufferSourceNode | null = null
  private raf = 0
  private current = { text: "", at: 0 }

  get supported() {
    return typeof window !== "undefined" && (typeof AudioContext !== "undefined" || "speechSynthesis" in window)
  }

  setEnabled(on: boolean) {
    this.enabled = on
    if (!on) this.stop()
  }

  async provider() {
    await this.hasNeural()
    return this.neural
  }

  private async hasNeural() {
    if (this.neural === null) {
      this.neural = await fetch("/api/voice").then((r) => r.json()).then((d) => Boolean(d.provider)).catch(() => false)
    }
    return this.neural
  }

  get busy() {
    return this.playing || this.queue.length > 0
  }

  // Speak a full line now (lessons, showcase, greetings), replacing whatever
  // she was saying. Calls `done` when the whole line has been spoken.
  say(text: string, done?: () => void) {
    const line = clean(text)
    // The same line asked for again while it's still playing (a re-render,
    // a double click): let it carry on rather than restarting it.
    if (line === this.current.text && this.busy && performance.now() - this.current.at < 15000) {
      this.whenIdle(done)
      return
    }
    this.stop()
    this.current = { text: line, at: performance.now() }
    const st = useEngineerState.getState()
    st.setCaption(line)
    st.setStatus("talking")
    if (!this.enabled || !this.supported) {
      const g = this.gen
      const t = setTimeout(() => { if (g === this.gen) { useEngineerState.getState().setStatus("idle"); done?.() } }, 1200 + line.split(/\s+/).length * 300)
      this.waiters.push(() => clearTimeout(t))
      return
    }
    for (const s of sentences(text)) this.enqueue(s)
    this.enqueue("", true)
    this.whenIdle(done)
  }

  speak(text: string) {
    return new Promise<void>((resolve) => this.say(text, resolve))
  }

  // Add a line after whatever she's saying, without interrupting (race radio).
  add(text: string) {
    if (!this.enabled || !this.supported) { useEngineerState.getState().setCaption(clean(text)); return }
    for (const s of sentences(text)) this.enqueue(s)
    this.enqueue("", true)
  }

  // Streaming: feed answer text as it arrives; complete sentences are queued.
  feed(delta: string) {
    if (!this.enabled || !this.supported) return
    this.buffer += delta
    const re = /^([\s\S]*?[.!?:])(\s+|\n)/
    let m: RegExpExecArray | null
    while ((m = re.exec(this.buffer))) {
      this.enqueue(m[1])
      this.buffer = this.buffer.slice(m[0].length)
    }
  }

  flush() {
    this.enqueue(this.buffer, true)
    this.buffer = ""
  }

  stop() {
    this.gen++
    this.buffer = ""
    this.pending = ""
    this.queue = []
    this.playing = false
    this.current = { text: "", at: 0 }
    const w = this.waiters
    this.waiters = []
    w.forEach((f) => f())
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel()
    try { this.source?.stop() } catch {}
    this.source = null
    cancelAnimationFrame(this.raf)
    const s = useEngineerState.getState()
    if (s.status === "talking") s.setStatus("idle")
  }

  private whenIdle(done?: () => void) {
    if (!done) return
    const g = this.gen
    this.waiters.push(() => { if (g === this.gen) done() })
  }

  private context() {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.analyser = this.ctx.createAnalyser()
      this.analyser.fftSize = 512
      this.analyser.connect(this.ctx.destination)
    }
    return this.ctx
  }

  // Generate one sentence; one retry if the server hiccups.
  private async synth(text: string, g: number): Promise<AudioBuffer | null> {
    if (!(await this.hasNeural())) return null
    for (let attempt = 0; attempt < 2 && g === this.gen; attempt++) {
      try {
        const r = await fetch("/api/voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) })
        if (r.ok) return await this.context().decodeAudioData(await r.arrayBuffer())
      } catch {}
    }
    return null
  }

  // Very short sentences ("Copy.") ride along with the next one, so the
  // voice keeps its natural flow instead of stopping after every word.
  private enqueue(raw: string, last = false) {
    let text = clean(raw)
    if (this.pending) { text = `${this.pending} ${text}`.trim(); this.pending = "" }
    if (!text) return
    if (!last && text.split(/\s+/).length < 4) { this.pending = text; return }
    const g = this.gen
    // Request audio straight away so the next sentence is ready when this one ends.
    this.queue.push({ text, audio: this.synth(text, g) })
    if (!this.playing) void this.pump(g)
  }

  private async pump(g: number): Promise<void> {
    this.playing = true
    while (this.queue.length && g === this.gen) {
      const line = this.queue.shift()!
      const st = useEngineerState.getState()
      st.setStatus("talking")
      st.setCaption(line.text)
      const audio = await line.audio
      if (g !== this.gen) return
      if (audio) await this.play(audio, g)
      else if (this.neural === false) await this.speakBrowser(line.text)
      // Neural voice failed twice for this sentence: leave it as a caption only.
      else await new Promise((r) => setTimeout(r, 400 + line.text.split(/\s+/).length * 250))
      // A streamed answer may still be producing its next sentence.
      if (!this.queue.length && g === this.gen) await new Promise((r) => setTimeout(r, 350))
    }
    if (g !== this.gen) return
    this.playing = false
    this.current = { text: "", at: 0 }
    useEngineerState.getState().setStatus("idle")
    const w = this.waiters
    this.waiters = []
    w.forEach((f) => f())
  }

  private play(audio: AudioBuffer, g: number) {
    const ctx = this.context()
    return new Promise<void>((resolve) => {
      void ctx.resume().then(() => {
        if (g !== this.gen) return resolve()
        const src = ctx.createBufferSource()
        src.buffer = audio
        src.connect(this.analyser!)
        this.source = src
        src.onended = () => { cancelAnimationFrame(this.raf); if (this.source === src) this.source = null; resolve() }
        src.start()
        // Mouth follows the loudness of the voice.
        const data = new Uint8Array(this.analyser!.fftSize)
        let last = 0
        const tick = (now: number) => {
          if (g !== this.gen) return
          this.analyser!.getByteTimeDomainData(data)
          let sum = 0
          for (const v of data) sum += (v - 128) ** 2
          const level = Math.sqrt(sum / data.length) / 128
          if (level > 0.045 && now - last > 90) { last = now; useEngineerState.getState().bumpMouth() }
          this.raf = requestAnimationFrame(tick)
        }
        this.raf = requestAnimationFrame(tick)
      }).catch(() => resolve())
    })
  }

  // ── Browser speech fallback ───────────────────────────────────────────────
  private pickVoice() {
    const voices = window.speechSynthesis.getVoices()
    for (const name of PREFERRED) {
      const v = voices.find((x) => x.name.startsWith(name))
      if (v) return v
    }
    const gb = voices.filter((v) => v.lang.replace("_", "-").startsWith("en-GB"))
    return gb.find((v) => !MALE.test(v.name)) ?? gb[0] ?? null
  }

  private speakBrowser(text: string) {
    return new Promise<void>((resolve) => {
      if (!("speechSynthesis" in window)) { setTimeout(resolve, 1200 + text.split(/\s+/).length * 300); return }
      const started = Date.now()
      const minMs = 600 + text.split(/\s+/).length * 260
      const u = new SpeechSynthesisUtterance(text)
      const v = this.pickVoice()
      if (v) u.voice = v
      u.lang = "en-GB"
      u.onboundary = () => useEngineerState.getState().bumpMouth()
      u.onend = u.onerror = () => setTimeout(resolve, Math.max(0, minMs - (Date.now() - started)))
      window.speechSynthesis.speak(u)
    })
  }
}

export const voice = new Voice()
