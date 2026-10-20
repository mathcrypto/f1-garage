"use client"

import { telemetry } from "./drive"
import { useGarage } from "./store"

// All audio is synthesized in the browser, so no audio files ship with the
// site. The anthem is an original composition; a licensed track placed at
// public/audio/theme.mp3 replaces it automatically.

const BPM = 126
const STEP = 60 / BPM / 4 // one 16th note, in seconds
const LOOKAHEAD = 0.12

// D minor anthem: four bars of verse, four bars of lift.
const BARS: number[][] = [
  [50, 53, 57], // Dm
  [46, 50, 53], // Bb
  [53, 57, 60], // F
  [48, 52, 55], // C
  [43, 46, 50], // Gm
  [46, 50, 53], // Bb
  [53, 57, 60], // F
  [45, 49, 52], // A
]
const LEAD = [0, 2, 1, 2, 0, 2, 1, 3, 0, 2, 1, 2, 3, 2, 1, 2] // chord-tone indices per 16th; 3 = octave root
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12)

class SoundEngine {
  ctx: AudioContext | null = null
  master!: GainNode
  music!: GainNode
  engine!: GainNode
  private delay!: DelayNode
  private noise!: AudioBuffer
  private timer: ReturnType<typeof setInterval> | null = null
  private raf = 0
  private step = 0
  private nextTime = 0
  private track: HTMLAudioElement | null = null
  private eng: { osc: OscillatorNode[]; filter: BiquadFilterNode } | null = null
  enabled = false

  private init() {
    if (this.ctx) return
    const ctx = new AudioContext()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0.7
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 4
    this.master.connect(comp).connect(ctx.destination)
    this.music = ctx.createGain()
    this.music.connect(this.master)
    this.engine = ctx.createGain()
    this.engine.gain.value = 0
    this.engine.connect(this.master)

    // Dotted-eighth echo gives the lead its stadium feel.
    this.delay = ctx.createDelay(1)
    this.delay.delayTime.value = STEP * 3
    const fb = ctx.createGain()
    fb.gain.value = 0.32
    const wet = ctx.createGain()
    wet.gain.value = 0.35
    this.delay.connect(fb).connect(this.delay)
    this.delay.connect(wet).connect(this.music)

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }

  async start() {
    this.init()
    const ctx = this.ctx!
    await ctx.resume()
    this.enabled = true
    this.master.gain.setTargetAtTime(0.7, ctx.currentTime, 0.1)

    if (this.track === null) {
      const ok = await fetch("/audio/theme.mp3", { method: "HEAD" }).then((r) => r.ok && (r.headers.get("content-type") ?? "").startsWith("audio")).catch(() => false)
      if (ok) {
        this.track = new Audio("/audio/theme.mp3")
        this.track.loop = true
        ctx.createMediaElementSource(this.track).connect(this.music)
      }
    }
    if (this.track) this.track.play().catch(() => {})
    else if (!this.timer) {
      this.nextTime = ctx.currentTime + 0.05
      this.timer = setInterval(() => this.schedule(), 25)
    }
    this.startEngine()
    const tick = () => { this.updateEngine(); this.raf = requestAnimationFrame(tick) }
    this.raf = requestAnimationFrame(tick)
  }

  stop() {
    if (!this.ctx) return
    this.enabled = false
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08)
    if (this.timer) { clearInterval(this.timer); this.timer = null }
    this.track?.pause()
    cancelAnimationFrame(this.raf)
    setTimeout(() => { if (!this.enabled) this.ctx?.suspend() }, 400)
  }

  setVolume(v: number) {
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05)
  }

  // ── Anthem ────────────────────────────────────────────────────────────────
  private schedule() {
    const ctx = this.ctx!
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      this.playStep(this.step, this.nextTime)
      this.nextTime += STEP
      this.step = (this.step + 1) % (16 * BARS.length * 2)
    }
  }

  private playStep(step: number, t: number) {
    const s16 = step % 16
    const bar = Math.floor(step / 16) % BARS.length
    const pass = Math.floor(step / (16 * BARS.length)) // second time round adds the lead
    const chord = BARS[bar]

    if (s16 === 0) {
      this.pad(chord, t, STEP * 16)
      if (bar % 4 === 0) this.brass(chord, t)
    }
    if (s16 % 2 === 0) this.bass(midi(chord[0] - 24), t, s16 % 4 === 0 ? 0.32 : 0.2)
    if (s16 % 4 === 0) this.kick(t)
    if (s16 === 4 || s16 === 12) this.snare(t)
    if (s16 % 2 === 1) this.hat(t, 0.05)
    if (bar === BARS.length - 1 && s16 >= 12) this.snare(t, 0.5) // fill into the loop
    if (pass === 1 || bar >= 4) {
      const i = LEAD[s16]
      this.pluck(midi(i === 3 ? chord[0] + 12 : chord[i]) * 2, t)
    }
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  }

  private pad(chord: number[], t: number, len: number) {
    const ctx = this.ctx!
    const f = ctx.createBiquadFilter()
    f.type = "lowpass"
    f.frequency.setValueAtTime(900, t)
    f.frequency.linearRampToValueAtTime(2200, t + len * 0.6)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.25)
    g.gain.setValueAtTime(0.05, t + len - 0.2)
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.3)
    f.connect(g).connect(this.music)
    for (const n of chord) for (const detune of [-8, 8]) {
      const o = ctx.createOscillator()
      o.type = "sawtooth"
      o.frequency.value = midi(n)
      o.detune.value = detune
      o.connect(f)
      o.start(t)
      o.stop(t + len + 0.35)
    }
  }

  private brass(chord: number[], t: number) {
    const ctx = this.ctx!
    const f = ctx.createBiquadFilter()
    f.type = "lowpass"
    f.Q.value = 6
    f.frequency.setValueAtTime(300, t)
    f.frequency.exponentialRampToValueAtTime(3200, t + 0.18)
    f.frequency.exponentialRampToValueAtTime(800, t + 1.2)
    const g = ctx.createGain()
    this.env(g, t, 0.09, 0.03, 1.3)
    f.connect(g).connect(this.music)
    for (const n of [chord[0] - 12, ...chord]) {
      const o = ctx.createOscillator()
      o.type = "sawtooth"
      o.frequency.value = midi(n)
      o.connect(f)
      o.start(t)
      o.stop(t + 1.5)
    }
  }

  private bass(freq: number, t: number, peak: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = "square"
    o.frequency.value = freq
    const f = ctx.createBiquadFilter()
    f.type = "lowpass"
    f.frequency.setValueAtTime(1400, t)
    f.frequency.exponentialRampToValueAtTime(220, t + STEP * 1.8)
    const g = ctx.createGain()
    this.env(g, t, peak * 0.35, 0.005, STEP * 1.8)
    o.connect(f).connect(g).connect(this.music)
    o.start(t)
    o.stop(t + STEP * 2)
  }

  private pluck(freq: number, t: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = "sawtooth"
    o.frequency.value = freq
    const f = ctx.createBiquadFilter()
    f.type = "lowpass"
    f.frequency.setValueAtTime(5000, t)
    f.frequency.exponentialRampToValueAtTime(700, t + 0.15)
    const g = ctx.createGain()
    this.env(g, t, 0.035, 0.004, 0.18)
    o.connect(f).connect(g)
    g.connect(this.music)
    g.connect(this.delay)
    o.start(t)
    o.stop(t + 0.25)
  }

  private kick(t: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(150, t)
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12)
    const g = ctx.createGain()
    this.env(g, t, 0.5, 0.002, 0.28)
    o.connect(g).connect(this.music)
    o.start(t)
    o.stop(t + 0.32)
  }

  private noiseHit(t: number, type: BiquadFilterType, freq: number, peak: number, decay: number) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    const g = ctx.createGain()
    this.env(g, t, peak, 0.002, decay)
    src.connect(f).connect(g).connect(this.music)
    src.start(t, Math.random() * 0.5)
    src.stop(t + decay + 0.05)
  }

  private snare(t: number, level = 1) {
    this.noiseHit(t, "bandpass", 1900, 0.22 * level, 0.18)
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(220, t)
    o.frequency.exponentialRampToValueAtTime(160, t + 0.08)
    const g = ctx.createGain()
    this.env(g, t, 0.12 * level, 0.002, 0.1)
    o.connect(g).connect(this.music)
    o.start(t)
    o.stop(t + 0.15)
  }

  private hat(t: number, peak: number) {
    this.noiseHit(t, "highpass", 8000, peak, 0.04)
  }

  // ── Engine (drive mode) ───────────────────────────────────────────────────
  private startEngine() {
    if (this.eng || !this.ctx) return
    const ctx = this.ctx
    const shaper = ctx.createWaveShaper()
    const curve = new Float32Array(1024)
    for (let i = 0; i < curve.length; i++) { const x = (i / 512) - 1; curve[i] = Math.tanh(x * 3) }
    shaper.curve = curve
    const filter = ctx.createBiquadFilter()
    filter.type = "lowpass"
    filter.Q.value = 3
    const osc = [0.5, 1, 2, 3].map((mult, i) => {
      const o = ctx.createOscillator()
      o.type = i === 0 ? "square" : "sawtooth"
      const g = ctx.createGain()
      g.gain.value = [0.5, 0.6, 0.3, 0.12][i]
      o.connect(g).connect(shaper)
      o.start()
      ;(o as OscillatorNode & { mult: number }).mult = mult
      return o
    })
    shaper.connect(filter).connect(this.engine)
    this.eng = { osc, filter }
  }

  // 8-speed gearbox: rpm climbs through each gear's speed band, so upshifts
  // drop the pitch the way a real onboard does.
  private updateEngine() {
    if (!this.ctx || !this.eng) return
    const t = this.ctx.currentTime
    const driving = useGarage.getState().mode === "drive"
    const v = telemetry.speed
    const tops = [95, 135, 170, 205, 240, 272, 302, 340]
    let gear = tops.findIndex((top) => v < top)
    if (gear < 0) gear = 7
    const lo = gear === 0 ? 0 : tops[gear - 1]
    const k = Math.min(1, Math.max(0, (v - lo) / (tops[gear] - lo)))
    const rpm = 7200 + k * 4600
    const base = (rpm / 60) * 1.5 // V6, three firing pulses per revolution, voiced an octave down
    for (const o of this.eng.osc) o.frequency.setTargetAtTime(base * (o as OscillatorNode & { mult: number }).mult, t, 0.03)
    this.eng.filter.frequency.setTargetAtTime(600 + rpm * 0.22 * (telemetry.braking > 0.2 ? 0.5 : 1), t, 0.05)
    const level = driving ? (telemetry.braking > 0.2 ? 0.05 : 0.11) : 0
    this.engine.gain.setTargetAtTime(level, t, 0.15)
    // Duck the music under the engine.
    this.music.gain.setTargetAtTime(driving ? 0.45 : 1, t, 0.4)
  }
}

export const sound = new SoundEngine()
