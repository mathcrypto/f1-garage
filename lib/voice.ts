"use client"

import { useEngineerState } from "./store"

// Lena's voice. A natural neural British voice from /api/voice when the
// server has a TTS key, otherwise the browser's built-in speech.
// Sentences queue up and always finish in order; nothing cuts a line short
// except an explicit stop(). Optional team-radio sound: band-limited voice
// with the classic beep at the start and end of each message.

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

type Line = { text: string; audio: Promise<Blob | null> | null }

class Voice {
  enabled = false
  radio = false
  private neural: boolean | null = null
  private queue: Line[] = []
  private playing = false
  private buffer = ""
  private pending = ""
  private gen = 0
  private waiters: (() => void)[] = []
  private ctx: AudioContext | null = null
  private el: HTMLAudioElement | null = null
  private analyser: AnalyserNode | null = null
  private dry: GainNode | null = null
  private wet: GainNode | null = null
  private raf = 0
  private lastEnd = 0

  get supported() {
    return typeof window !== "undefined" && ("speechSynthesis" in window || typeof Audio !== "undefined")
  }

  setEnabled(on: boolean) {
    this.enabled = on
    if (!on) this.stop()
  }

  setRadio(on: boolean) {
    this.radio = on
    if (this.dry && this.wet) { this.dry.gain.value = on ? 0 : 1; this.wet.gain.value = on ? 1 : 0 }
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

  // Speak a full line now (lessons, showcase, greetings). Resolves when the
  // whole line has been spoken, or after a reading-time pause without voice.
  say(text: string, done?: () => void) {
    this.stop()
    const st = useEngineerState.getState()
    st.setCaption(clean(text))
    st.setStatus("talking")
    if (!this.enabled || !this.supported) {
      const t = setTimeout(() => { useEngineerState.getState().setStatus("idle"); done?.() }, 1200 + text.split(/\s+/).length * 300)
      const g = this.gen
      this.waiters.push(() => { if (g !== this.gen) clearTimeout(t) })
      return
    }
    for (const s of sentences(text)) this.enqueue(s)
    this.enqueue("", true)
    this.whenIdle(done)
  }

  speak(text: string) {
    return new Promise<void>((resolve) => this.say(text, resolve))
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
    const w = this.waiters
    this.waiters = []
    w.forEach((f) => f())
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel()
    if (this.el) { this.el.pause(); this.el.removeAttribute("src") }
    cancelAnimationFrame(this.raf)
    const s = useEngineerState.getState()
    if (s.status === "talking") s.setStatus("idle")
  }

  private whenIdle(done?: () => void) {
    if (!done) return
    const g = this.gen
    this.waiters.push(() => { if (g === this.gen) done() })
  }

  // Very short sentences ("Copy.") ride along with the next one, so the
  // voice keeps its natural flow instead of stopping after every word.
  private enqueue(raw: string, last = false) {
    let text = clean(raw)
    if (this.pending) { text = `${this.pending} ${text}`.trim(); this.pending = "" }
    if (!text) return
    if (!last && text.split(/\s+/).length < 4) { this.pending = text; return }
    const g = this.gen
    const line: Line = { text, audio: null }
    // Request audio straight away so the next sentence is ready when this one ends.
    line.audio = this.hasNeural().then((ok) =>
      ok && g === this.gen
        ? fetch("/api/voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) })
            .then((r) => (r.ok ? r.blob() : null))
            .catch(() => null)
        : null,
    )
    this.queue.push(line)
    if (!this.playing) void this.pump(g)
  }

  private async pump(g: number): Promise<void> {
    this.playing = true
    let first = true
    while (this.queue.length && g === this.gen) {
      const line = this.queue.shift()!
      const st = useEngineerState.getState()
      st.setStatus("talking")
      st.setCaption(line.text)
      const blob = await line.audio
      if (g !== this.gen) return
      if (blob) {
        // One beep per radio message, not per pause in a streamed answer.
        if (first && this.radio && Date.now() - this.lastEnd > 2500) await this.beep(true)
        await this.playBlob(blob, g)
      } else {
        await this.speakBrowser(line.text)
      }
      first = false
    }
    if (g !== this.gen) return
    if (this.radio && this.el && !first) {
      // Wait a moment: a streamed answer may still have sentences coming.
      await new Promise((r) => setTimeout(r, 700))
      if (this.queue.length && g === this.gen) return this.pump(g)
      await this.beep(false)
    }
    this.lastEnd = Date.now()
    this.playing = false
    useEngineerState.getState().setStatus("idle")
    const w = this.waiters
    this.waiters = []
    w.forEach((f) => f())
  }

  // ── Neural playback with radio filter and lip-sync ─────────────────────────
  private graph() {
    if (this.ctx) return
    const ctx = new AudioContext()
    const el = new Audio()
    el.crossOrigin = "anonymous"
    const src = ctx.createMediaElementSource(el)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    // Team-radio colour: telephone band, a little grit.
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 320
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3600
    const shaper = ctx.createWaveShaper()
    const curve = new Float32Array(1024)
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 1.8) }
    shaper.curve = curve
    const wet = ctx.createGain(), dry = ctx.createGain()
    wet.gain.value = this.radio ? 1 : 0
    dry.gain.value = this.radio ? 0 : 1
    src.connect(analyser)
    analyser.connect(hp).connect(lp).connect(shaper).connect(wet).connect(ctx.destination)
    analyser.connect(dry).connect(ctx.destination)
    Object.assign(this, { ctx, el, analyser, wet, dry })
  }

  private async beep(start: boolean) {
    this.graph()
    const ctx = this.ctx!
    await ctx.resume()
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = "square"
    o.frequency.setValueAtTime(start ? 1400 : 1050, t)
    o.frequency.setValueAtTime(start ? 1750 : 800, t + 0.07)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3000
    o.connect(lp).connect(g).connect(ctx.destination)
    o.start(t)
    o.stop(t + 0.18)
    await new Promise((r) => setTimeout(r, 200))
  }

  private playBlob(blob: Blob, g: number) {
    this.graph()
    const el = this.el!
    const url = URL.createObjectURL(blob)
    return new Promise<void>((resolve) => {
      const finish = () => { cancelAnimationFrame(this.raf); URL.revokeObjectURL(url); resolve() }
      el.onended = finish
      el.onerror = finish
      el.src = url
      void this.ctx!.resume().then(() => el.play()).catch(finish)
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
      u.rate = 1
      u.pitch = 1.03
      u.onboundary = () => useEngineerState.getState().bumpMouth()
      // If speech fails or ends instantly (no voices installed), still give
      // people time to read the line before moving on.
      u.onend = u.onerror = () => setTimeout(resolve, Math.max(0, minMs - (Date.now() - started)))
      window.speechSynthesis.speak(u)
    })
  }
}

export const voice = new Voice()
