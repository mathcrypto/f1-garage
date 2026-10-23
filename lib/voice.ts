"use client"

import { cleanSpeech, endSentence, GROUP_WORDS, MAX_WORDS, speechChunks, splitLong, wordCount } from "./speech"
import { sound } from "./sound"
import { useEngineerState } from "./store"

// Lena: Edge en-GB-LibbyNeural only. No browser TTS. Tone (calm/race) changes delivery, not voice.

const OVERLAP = 0.06

const clean = cleanSpeech

type LenaTone = "calm" | "race"
type Line = { text: string; audio: Promise<AudioBuffer | null>; tone: LenaTone }

class Voice {
  enabled = true
  /** Race / on-track = punchier Libby take. Same voice. */
  tone: LenaTone = "calm"
  private neural: boolean | null = null
  private queue: Line[] = []
  private playing = false
  private buffer = ""
  private pending = ""
  private gen = 0
  private waiters: (() => void)[] = []
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private sources = new Set<AudioBufferSourceNode>()
  private raf = 0
  private current = { text: "", at: 0 }
  private streaming = false
  private fresh = true
  private needRadio = true
  private prefetched = new Map<string, Promise<AudioBuffer | null>>()

  get supported() {
    return typeof window !== "undefined" && typeof AudioContext !== "undefined"
  }

  setEnabled(on: boolean) {
    this.enabled = on
    if (!on) this.stop()
  }

  setTone(tone: LenaTone) {
    this.tone = tone
  }

  unlock() {
    if (!this.enabled || typeof window === "undefined") return
    void this.context().resume()
    void this.hasNeural().then((ok) => {
      if (ok) void fetch("/api/voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "Stand by.", tone: "calm" }) }).catch(() => {})
    })
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

  say(text: string, done?: () => void) {
    const line = clean(text)
    if (line === this.current.text && this.busy && performance.now() - this.current.at < 15000) {
      this.whenIdle(done)
      return
    }
    this.stop()
    this.needRadio = true
    this.current = { text: line, at: performance.now() }
    if (!this.enabled || !this.supported) {
      const st = useEngineerState.getState()
      st.setCaption(line)
      st.setStatus("talking")
      const g = this.gen
      const t = setTimeout(() => { if (g === this.gen) { useEngineerState.getState().setStatus("idle"); done?.() } }, 1200 + line.split(/\s+/).length * 300)
      this.waiters.push(() => clearTimeout(t))
      return
    }
    this.fresh = false
    for (const chunk of speechChunks(text)) this.push(chunk)
    this.whenIdle(done)
  }

  prefetch(texts: string[]) {
    if (!this.enabled || !this.supported) return
    for (const t of texts) for (const chunk of speechChunks(t)) void this.audioFor(chunk, this.tone)
  }

  speak(text: string) {
    return new Promise<void>((resolve) => this.say(text, resolve))
  }

  add(text: string) {
    if (!this.enabled || !this.supported) { useEngineerState.getState().setCaption(clean(text)); return }
    if (!this.busy) this.needRadio = true
    for (const chunk of speechChunks(text)) this.push(chunk)
  }

  feed(delta: string) {
    if (!this.enabled || !this.supported) return
    if (!this.streaming) this.needRadio = true
    this.streaming = true
    this.buffer += delta
    const re = /^([\s\S]*?(?:[.!?:](?=\s)|\n))\s*/
    let m: RegExpExecArray | null
    while ((m = re.exec(this.buffer))) {
      this.enqueue(m[1])
      this.buffer = this.buffer.slice(m[0].length)
    }
  }

  flush() {
    this.enqueue(this.buffer)
    this.release()
    this.buffer = ""
    this.streaming = false
  }

  stop() {
    this.gen++
    this.buffer = ""
    this.pending = ""
    this.queue = []
    this.playing = false
    this.streaming = false
    this.fresh = true
    this.needRadio = true
    this.current = { text: "", at: 0 }
    const w = this.waiters
    this.waiters = []
    w.forEach((f) => f())
    for (const src of this.sources) {
      try { src.stop() } catch {}
    }
    this.sources.clear()
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

  private cacheKey(text: string, tone: LenaTone) {
    return `${tone}:${text}`
  }

  private audioFor(text: string, tone = this.tone) {
    const key = this.cacheKey(text, tone)
    let p = this.prefetched.get(key)
    if (!p) {
      p = this.synth(text, tone)
      this.prefetched.set(key, p)
      void p.then((a) => { if (!a) this.prefetched.delete(key) })
      if (this.prefetched.size > 150) this.prefetched.delete(this.prefetched.keys().next().value!)
    }
    return p
  }

  private async synth(text: string, tone: LenaTone): Promise<AudioBuffer | null> {
    if (!(await this.hasNeural())) return null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, tone }),
        })
        if (r.ok) return await this.context().decodeAudioData(await r.arrayBuffer())
        if (r.status === 429 || r.status >= 500) await new Promise((r) => setTimeout(r, 200 * (attempt + 1)))
      } catch {}
    }
    return null
  }

  private enqueue(raw: string) {
    const text = endSentence(clean(raw))
    if (!text) return
    if (this.fresh) {
      this.fresh = false
      if (wordCount(text) <= MAX_WORDS) {
        this.push(text)
        return
      }
      const [first, ...rest] = splitLong(text, MAX_WORDS)
      this.push(first)
      this.pending = rest.join(" ")
      return
    }
    this.pending = this.pending ? `${this.pending} ${text}` : text
    if (wordCount(this.pending) >= GROUP_WORDS || !this.busy) this.release()
  }

  private release() {
    if (this.pending) for (const chunk of splitLong(this.pending, MAX_WORDS)) this.push(chunk)
    this.pending = ""
  }

  private push(chunk: string) {
    const tone = this.tone
    this.queue.push({ text: chunk, audio: this.audioFor(chunk, tone), tone })
    if (!this.playing) void this.pump(this.gen)
  }

  private async pump(g: number): Promise<void> {
    this.playing = true
    if (this.needRadio) {
      this.needRadio = false
      await sound.radioChirp()
      if (g !== this.gen) return
    }
    while (this.queue.length && g === this.gen) {
      const line = this.queue.shift()!
      if (!this.queue.length) this.release()
      const audio = await line.audio
      if (g !== this.gen) return
      const st = useEngineerState.getState()
      st.setStatus("talking")
      st.setCaption(line.text)
      // Edge only — if synth failed, caption stays; never swap to another voice.
      if (audio) {
        const moreComing = this.queue.length > 0 || Boolean(this.pending) || this.streaming
        await this.play(audio, g, moreComing)
      } else {
        await new Promise((r) => setTimeout(r, 400 + line.text.split(/\s+/).length * 80))
      }
      if (!this.queue.length) this.release()
      if (!this.queue.length && this.streaming && g === this.gen) await new Promise((r) => setTimeout(r, 200))
      if (!this.queue.length) this.release()
    }
    if (g !== this.gen) return
    this.playing = false
    this.needRadio = true
    this.current = { text: "", at: 0 }
    useEngineerState.getState().setStatus("idle")
    const w = this.waiters
    this.waiters = []
    w.forEach((f) => f())
  }

  private trim(buf: AudioBuffer): AudioBuffer {
    const data = buf.getChannelData(0)
    const thr = 0.01
    let start = 0
    let end = data.length - 1
    while (start < end && Math.abs(data[start]!) < thr) start++
    while (end > start && Math.abs(data[end]!) < thr) end--
    const pad = Math.floor(buf.sampleRate * 0.008)
    start = Math.max(0, start - pad)
    end = Math.min(data.length - 1, end + pad)
    const len = end - start + 1
    if (len >= data.length - buf.sampleRate * 0.02) return buf
    const out = this.context().createBuffer(buf.numberOfChannels, len, buf.sampleRate)
    for (let c = 0; c < buf.numberOfChannels; c++) {
      out.copyToChannel(buf.getChannelData(c).subarray(start, end + 1), c)
    }
    return out
  }

  private play(audio: AudioBuffer, g: number, overlapNext: boolean) {
    const ctx = this.context()
    return new Promise<void>((resolve) => {
      void ctx.resume().then(() => {
        if (g !== this.gen) return resolve()
        const trimmed = this.trim(audio)
        const src = ctx.createBufferSource()
        const gain = ctx.createGain()
        src.buffer = trimmed
        src.connect(gain)
        gain.connect(this.analyser!)
        this.sources.add(src)

        const t0 = ctx.currentTime
        const dur = trimmed.duration
        const fade = overlapNext ? Math.min(OVERLAP, dur * 0.2) : 0
        gain.gain.setValueAtTime(1, t0)
        if (fade > 0) {
          gain.gain.setValueAtTime(1, t0 + dur - fade)
          gain.gain.linearRampToValueAtTime(0.001, t0 + dur)
        }

        let settled = false
        const finish = () => {
          if (settled) return
          settled = true
          this.sources.delete(src)
          cancelAnimationFrame(this.raf)
          resolve()
        }

        src.onended = finish
        src.start(t0)
        if (fade > 0) {
          const earlyMs = Math.max(0, (dur - fade) * 1000)
          setTimeout(() => { if (g === this.gen) finish() }, earlyMs)
        }

        const time = new Uint8Array(this.analyser!.fftSize)
        const freq = new Uint8Array(this.analyser!.frequencyBinCount)
        const tick = () => {
          if (g !== this.gen || settled) return
          const a = this.analyser!
          a.getByteTimeDomainData(time)
          a.getByteFrequencyData(freq)
          let sum = 0
          for (const v of time) sum += (v - 128) ** 2
          const level = Math.min(1, Math.sqrt(sum / time.length) / 40)
          const n = freq.length
          let low = 0, mid = 0, high = 0
          for (let i = 0; i < n; i++) {
            const v = freq[i]!
            if (i < n * 0.2) low += v
            else if (i < n * 0.55) mid += v
            else high += v
          }
          const shape: 0 | 1 | 2 | 3 =
            level < 0.06 ? 0 : high > mid && high > low ? 1 : mid >= low ? 2 : 3
          useEngineerState.getState().setMouth(level < 0.04 ? 0 : level, shape)
          this.raf = requestAnimationFrame(tick)
        }
        this.raf = requestAnimationFrame(tick)
      }).catch(() => resolve())
    })
  }
}

export const voice = new Voice()
