"use client"

import { telemetry } from "./drive"
import { useGarage } from "./store"

// The garage soundtrack and engine note are synthesized in the browser, so no
// audio files ship with the site. The anthem is an original composition; a
// licensed track placed at public/audio/theme.mp3 replaces it automatically.
// The official F1 theme plays through its official players (see SoundMenu).

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

  musicOn = false
  engineOn = false

  // Opens the audio context; must be called from a click.
  private async ensure() {
    this.init()
    const ctx = this.ctx!
    await ctx.resume()
    if (!this.enabled) {
      this.enabled = true
      this.master.gain.setTargetAtTime(this.volume, ctx.currentTime, 0.1)
      this.startEngine()
      const tick = () => { this.updateEngine(); this.raf = requestAnimationFrame(tick) }
      this.raf = requestAnimationFrame(tick)
    }
  }

  async setMusic(on: boolean) {
    this.musicOn = on
    if (!on) {
      if (this.timer) { clearInterval(this.timer); this.timer = null }
      this.track?.pause()
      this.maybeSuspend()
      return
    }
    await this.ensure()
    const ctx = this.ctx!
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
  }

  async setEngine(on: boolean) {
    this.engineOn = on
    if (on) await this.ensure()
    else this.maybeSuspend()
  }

  private maybeSuspend() {
    if (this.musicOn || this.engineOn || !this.ctx) return
    this.enabled = false
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08)
    cancelAnimationFrame(this.raf)
    setTimeout(() => { if (!this.enabled) this.ctx?.suspend() }, 400)
  }

  stop() {
    this.musicOn = false
    this.engineOn = false
    if (this.timer) { clearInterval(this.timer); this.timer = null }
    this.track?.pause()
    this.maybeSuspend()
  }

  private volume = 0.7
  setVolume(v: number) {
    this.volume = v
    if (this.ctx && this.enabled) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05)
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

  // ── Engine ────────────────────────────────────────────────────────────────
  // Off, or running on the stand (idle and scripted revs). In drive mode the
  // rpm comes from telemetry through an 8-speed gearbox.
  private running = false
  private script: { t0: number; points: [number, number][] } | null = null
  private lastGear = 0
  private parts: {
    osc: OscillatorNode[]
    mults: number[]
    body: GainNode
    filter: BiquadFilterNode
    exhaust: BiquadFilterNode
    exhaustGain: GainNode
    turbo: OscillatorNode
    turboGain: GainNode
    ers: OscillatorNode
    ersGain: GainNode
  } | null = null

  private startEngine() {
    if (this.parts || !this.ctx) return
    const ctx = this.ctx
    // Firing-pulse waveform: strong low harmonics with a raspy top end.
    const n = 40
    const real = new Float32Array(n), imag = new Float32Array(n)
    for (let k = 1; k < n; k++) imag[k] = ((k % 3 === 0 ? 1.6 : k % 2 ? 1 : 0.6) / k ** 0.85) * (k > 18 ? 0.5 : 1)
    const wave = ctx.createPeriodicWave(real, imag)
    const shaper = ctx.createWaveShaper()
    const curve = new Float32Array(2048)
    for (let i = 0; i < curve.length; i++) { const x = i / 1024 - 1; curve[i] = Math.tanh(x * 2.4) }
    shaper.curve = curve
    shaper.oversample = "2x"
    const filter = ctx.createBiquadFilter()
    filter.type = "lowpass"
    filter.Q.value = 2.2
    const body = ctx.createGain()
    const mults = [1, 1.004, 0.5, 2]
    const levels = [0.55, 0.35, 0.45, 0.12]
    const osc = mults.map((_, i) => {
      const o = ctx.createOscillator()
      if (i === 2) o.type = "sine"
      else if (i === 3) o.type = "sawtooth"
      else o.setPeriodicWave(wave)
      const g = ctx.createGain()
      g.gain.value = levels[i]
      o.connect(g).connect(shaper)
      o.start()
      return o
    })
    shaper.connect(filter).connect(body).connect(this.engine)

    // Exhaust and intake roar: noise shaped around the firing frequency.
    const noise = ctx.createBufferSource()
    noise.buffer = this.noise
    noise.loop = true
    const exhaust = ctx.createBiquadFilter()
    exhaust.type = "bandpass"
    exhaust.Q.value = 1.4
    const exhaustGain = ctx.createGain()
    exhaustGain.gain.value = 0
    noise.connect(exhaust).connect(exhaustGain).connect(this.engine)
    noise.start()

    // Turbo whistle and the 2026 hybrid's electric-motor whine.
    const tone = (gainNode: GainNode) => {
      const o = ctx.createOscillator()
      o.type = "sine"
      gainNode.gain.value = 0
      o.connect(gainNode).connect(this.engine)
      o.start()
      return o
    }
    const turboGain = ctx.createGain(), ersGain = ctx.createGain()
    const turbo = tone(turboGain), ers = tone(ersGain)
    this.parts = { osc, mults, body, filter, exhaust, exhaustGain, turbo, turboGain, ers, ersGain }
  }

  // Starter motor, catch, a flare of revs, then a lumpy idle.
  async engineStart() {
    await this.setEngine(true)
    this.running = true
    this.script = { t0: this.ctx!.currentTime, points: [[0, 0], [0.15, 900], [0.8, 1400], [0.95, 7600], [1.35, 5200], [2.0, 4300]] }
  }

  revBlip(peak = 11500) {
    if (!this.ctx || !this.running) return
    this.script = { t0: this.ctx.currentTime, points: [[0, 4300], [0.22, peak], [0.45, peak - 600], [1.1, 4300]] }
  }

  engineStop() {
    this.running = false
    this.script = null
  }

  // Heavy carbon part seating into place.
  async clunk() {
    if (!this.enabled || !this.ctx) return
    const ctx = this.ctx, t = ctx.currentTime
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(140, t)
    o.frequency.exponentialRampToValueAtTime(55, t + 0.12)
    const g = ctx.createGain()
    this.env(g, t, 0.35, 0.003, 0.16)
    o.connect(g).connect(this.master)
    o.start(t)
    o.stop(t + 0.2)
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = "bandpass"
    f.frequency.value = 2400
    const ng = ctx.createGain()
    this.env(ng, t, 0.12, 0.001, 0.05)
    src.connect(f).connect(ng).connect(this.master)
    src.start(t, Math.random())
    src.stop(t + 0.08)
  }

  private scriptedRpm(now: number) {
    if (!this.script) return null
    const e = now - this.script.t0
    const pts = this.script.points
    if (e >= pts[pts.length - 1][0]) { this.script = null; return null }
    for (let i = 1; i < pts.length; i++) {
      if (e <= pts[i][0]) {
        const [t0, r0] = pts[i - 1], [t1, r1] = pts[i]
        return r0 + (r1 - r0) * ((e - t0) / (t1 - t0))
      }
    }
    return null
  }

  private pop(t: number, peak: number) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = "highpass"
    f.frequency.value = 1200
    const g = ctx.createGain()
    this.env(g, t, peak, 0.001, 0.035)
    src.connect(f).connect(g).connect(this.engine)
    src.start(t, Math.random() * 0.8)
    src.stop(t + 0.05)
  }

  private updateEngine() {
    if (!this.ctx || !this.parts) return
    const p = this.parts
    const t = this.ctx.currentTime
    const driving = useGarage.getState().mode === "drive"
    const on = this.engineOn && (driving || this.running)
    let rpm = 0
    let throttle = 0.35
    const v = telemetry.speed

    if (driving) {
      const tops = [95, 135, 170, 205, 240, 272, 302, 340]
      let gear = tops.findIndex((top) => v < top)
      if (gear < 0) gear = 7
      const lo = gear === 0 ? 0 : tops[gear - 1]
      const k = Math.min(1, Math.max(0, (v - lo) / (tops[gear] - lo)))
      rpm = (gear === 0 ? 6000 : 7600) + k * (gear === 0 ? 5600 : 4300)
      throttle = telemetry.braking > 0.2 ? 0.15 : 1
      // Upshift: a 40 ms ignition cut and a crack from the exhaust.
      if (on && gear > this.lastGear) {
        p.body.gain.cancelScheduledValues(t)
        p.body.gain.setValueAtTime(0.25, t)
        p.body.gain.linearRampToValueAtTime(1, t + 0.06)
        this.pop(t, 0.12)
      }
      this.lastGear = gear
      // Overrun crackle while braking.
      if (on && telemetry.braking > 0.3 && Math.random() < 0.18) this.pop(t + Math.random() * 0.02, 0.05 + Math.random() * 0.05)
    } else {
      this.lastGear = 0
      const scripted = this.scriptedRpm(t)
      rpm = scripted ?? 4300 + Math.sin(t * 9) * 120 + Math.sin(t * 23) * 60
      throttle = scripted && scripted > 6000 ? 1 : 0.35
    }

    const f = (rpm / 60) * 1.5 // V6: three firing pulses per revolution, voiced an octave down
    p.osc.forEach((o, i) => o.frequency.setTargetAtTime(Math.max(20, f * p.mults[i]), t, 0.02))
    p.filter.frequency.setTargetAtTime(350 + rpm * 0.3 * (0.45 + throttle * 0.55), t, 0.04)
    p.exhaust.frequency.setTargetAtTime(250 + rpm * 0.14, t, 0.04)
    p.exhaustGain.gain.setTargetAtTime(on ? 0.05 * (0.3 + throttle * 0.7) : 0, t, 0.06)
    p.turbo.frequency.setTargetAtTime(2200 + rpm * 0.42, t, 0.1)
    p.turboGain.gain.setTargetAtTime(on ? 0.007 * throttle * (rpm / 12000) : 0, t, 0.15)
    p.ers.frequency.setTargetAtTime(500 + v * 8.5, t, 0.08)
    p.ersGain.gain.setTargetAtTime(on && driving ? 0.006 + 0.01 * telemetry.ers : 0, t, 0.15)
    const level = on ? (driving ? (telemetry.braking > 0.2 ? 0.07 : 0.13) : 0.1) : 0
    this.engine.gain.setTargetAtTime(level, t, 0.1)
    // Duck the music under the engine.
    this.music.gain.setTargetAtTime(on ? 0.4 : 1, t, 0.4)
  }
}

export const sound = new SoundEngine()
