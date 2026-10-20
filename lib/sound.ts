"use client"

import { telemetry } from "./drive"
import { ENGINE_PROCESSOR, ENGINE_WORKLET } from "./engineWorklet"
import { useEngineerState, useGarage } from "./store"

// The garage soundtrack and engine note are synthesized in the browser, so no
// audio files ship with the site. The anthem is an original composition; a
// licensed track placed at public/audio/theme.mp3 replaces it automatically.

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
// The hook: [16th step, MIDI note, length in 16ths] for each of the eight bars.
const MELODY: [number, number, number][][] = [
  [[0, 74, 3], [3, 72, 1], [4, 74, 4], [8, 77, 4], [12, 76, 2], [14, 74, 2]],
  [[0, 70, 6], [6, 72, 2], [8, 74, 4], [12, 77, 4]],
  [[0, 72, 3], [3, 69, 1], [4, 72, 4], [8, 77, 3], [11, 76, 1], [12, 72, 4]],
  [[0, 76, 8], [8, 74, 4], [12, 72, 4]],
  [[0, 74, 3], [3, 72, 1], [4, 74, 4], [8, 79, 4], [12, 77, 4]],
  [[0, 77, 6], [6, 74, 2], [8, 77, 4], [12, 82, 4]],
  [[0, 81, 6], [6, 79, 2], [8, 77, 4], [12, 76, 4]],
  [[0, 76, 8], [8, 73, 4], [12, 76, 4]],
]
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12)

class SoundEngine {
  ctx: AudioContext | null = null
  master!: GainNode
  music!: GainNode
  engine!: GainNode
  private delay!: DelayNode
  private verb!: GainNode
  private padBus!: GainNode
  private noise!: AudioBuffer
  private timer: ReturnType<typeof setInterval> | null = null
  private raf = 0
  private step = 0
  private nextTime = 0
  private track: HTMLAudioElement | null = null
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

    // Big-hall reverb from a generated impulse response.
    const len = Math.floor(ctx.sampleRate * 3.2)
    const ir = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3.2
    }
    const conv = ctx.createConvolver()
    conv.buffer = ir
    this.verb = ctx.createGain()
    const verbWet = ctx.createGain()
    verbWet.gain.value = 0.45
    this.verb.connect(conv).connect(verbWet).connect(this.music)

    // Pads run through their own bus so the kick can pump them (sidechain).
    this.padBus = ctx.createGain()
    this.padBus.connect(this.music)
    this.padBus.connect(this.verb)
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
      void this.startEngine()
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
      this.step = (this.step + 1) % (16 * BARS.length * 4)
    }
  }

  // 32-bar arrangement in four sections: intro, build, full theme, breakdown.
  private playStep(step: number, t: number) {
    const s16 = step % 16
    const barAbs = Math.floor(step / 16)
    const bar = barAbs % BARS.length
    const section = Math.floor(barAbs / 8) % 4
    const chord = BARS[bar]
    const full = section === 2

    if (s16 === 0) {
      this.pad(chord, t, STEP * 16)
      if (bar === 0 && section !== 0) this.impact(t)
      if (full && bar % 2 === 0) this.brass(chord, t)
      if (full) this.tom(midi(chord[0] - 24), t, 0.4)
    }
    if (bar === 7 && s16 === 0 && section !== 3) this.riser(t, STEP * 16)

    if (section >= 1 && section <= 2) {
      if (s16 % 4 === 0) { this.kick(t); this.pump(t) }
      if (s16 === 4 || s16 === 12) this.snare(t)
      if (bar === 7 && s16 >= 8 && s16 % 2 === 0) this.snare(t, 0.35 + (s16 - 8) * 0.08) // build into the next section
      this.bass(midi(chord[0] - 24), t, s16 % 4 === 2 ? 0.36 : 0.2)
    } else if (section === 3 && s16 === 0) {
      this.kick(t)
    }
    if (section !== 3 && s16 % 2 === 1) this.hat(t, s16 % 4 === 3 ? 0.06 : 0.035)

    if (section === 1) {
      const i = LEAD[s16]
      this.pluck(midi(i === 3 ? chord[0] + 12 : chord[i]) * 2, t)
    }
    if (section >= 2) {
      for (const [at, note, length] of MELODY[bar]) if (at === s16) this.lead(midi(note), t, length * STEP, section === 3 ? 0.6 : 1)
    }
  }

  // Duck the pads on every kick for that pumping, driving feel.
  private pump(t: number) {
    const g = this.padBus.gain
    g.cancelScheduledValues(t)
    g.setValueAtTime(0.35, t)
    g.linearRampToValueAtTime(1, t + STEP * 3)
  }

  private lead(freq: number, t: number, len: number, level = 1) {
    const ctx = this.ctx!
    const f = ctx.createBiquadFilter()
    f.type = "lowpass"
    f.Q.value = 4
    f.frequency.setValueAtTime(900, t)
    f.frequency.exponentialRampToValueAtTime(4200, t + 0.08)
    f.frequency.exponentialRampToValueAtTime(1800, t + len)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.06 * level, t + 0.02)
    g.gain.setValueAtTime(0.05 * level, t + Math.max(0.03, len - 0.05))
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.25)
    f.connect(g)
    g.connect(this.music)
    g.connect(this.delay)
    g.connect(this.verb)
    for (const [type, detune] of [["sawtooth", -7], ["sawtooth", 7], ["square", 0]] as const) {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = freq
      o.detune.value = detune
      // Gentle vibrato on long notes.
      if (len > STEP * 3) {
        const lfo = ctx.createOscillator(), depth = ctx.createGain()
        lfo.frequency.value = 5.5
        depth.gain.setValueAtTime(0, t)
        depth.gain.linearRampToValueAtTime(freq * 0.006, t + len)
        lfo.connect(depth).connect(o.frequency)
        lfo.start(t)
        lfo.stop(t + len + 0.3)
      }
      o.connect(f)
      o.start(t)
      o.stop(t + len + 0.3)
    }
  }

  private tom(freq: number, t: number, peak: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(freq * 2, t)
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.25)
    const g = ctx.createGain()
    this.env(g, t, peak * 0.5, 0.004, 0.6)
    o.connect(g)
    g.connect(this.music)
    g.connect(this.verb)
    o.start(t)
    o.stop(t + 0.7)
  }

  // Low boom and a burst of noise at the top of a section.
  private impact(t: number) {
    this.tom(40, t, 1.2)
    this.noiseHit(t, "lowpass", 1800, 0.25, 1.2)
  }

  // White-noise sweep that builds into the next section.
  private riser(t: number, len: number) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const f = ctx.createBiquadFilter()
    f.type = "bandpass"
    f.Q.value = 2
    f.frequency.setValueAtTime(300, t)
    f.frequency.exponentialRampToValueAtTime(9000, t + len)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.09, t + len)
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.05)
    src.connect(f).connect(g)
    g.connect(this.music)
    g.connect(this.verb)
    src.start(t)
    src.stop(t + len + 0.1)
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
    f.connect(g).connect(this.padBus)
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
    g.connect(this.verb)
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
  // Only on track: the rpm comes from the car's speed through an 8-speed
  // gearbox and drives a physical model of the V6 (lib/engineWorklet.ts). A
  // licensed recording at public/audio/engine-loop.mp3 (a steady pass at about
  // 10,500 rpm) is used instead when present, pitched with the revs.
  private lastGear = 0
  private shiftUntil = 0
  private parts: {
    model: AudioWorkletNode | null
    loop: AudioBufferSourceNode | null
    body: GainNode
    tone: BiquadFilterNode
    rasp: BiquadFilterNode
    distance: BiquadFilterNode
    turbo: OscillatorNode
    turboGain: GainNode
    ers: OscillatorNode
    ersGain: GainNode
  } | null = null
  private starting = false

  private async startEngine() {
    if (this.parts || this.starting || !this.ctx) return
    this.starting = true
    const ctx = this.ctx
    const body = ctx.createGain()
    body.gain.value = 1
    // Tone shaping: some weight in the low mids, the rasp on top, and a
    // low-pass that stands for distance from the car (camera dependent).
    const tone = ctx.createBiquadFilter()
    tone.type = "peaking"; tone.frequency.value = 420; tone.Q.value = 0.8; tone.gain.value = 3
    const rasp = ctx.createBiquadFilter()
    rasp.type = "highshelf"; rasp.frequency.value = 2400; rasp.gain.value = 5
    const distance = ctx.createBiquadFilter()
    distance.type = "lowpass"; distance.frequency.value = 9000; distance.Q.value = 0.5
    body.connect(tone).connect(rasp).connect(distance).connect(this.engine)

    let loop: AudioBufferSourceNode | null = null
    let model: AudioWorkletNode | null = null
    const recording = await fetch("/audio/engine-loop.mp3")
      .then((r) => (r.ok && (r.headers.get("content-type") ?? "").startsWith("audio") ? r.arrayBuffer() : null))
      .then((b) => (b ? ctx.decodeAudioData(b) : null))
      .catch(() => null)
    if (recording) {
      loop = ctx.createBufferSource()
      loop.buffer = recording
      loop.loop = true
      loop.connect(body)
      loop.start()
    } else if (ctx.audioWorklet) {
      const url = URL.createObjectURL(new Blob([ENGINE_WORKLET], { type: "application/javascript" }))
      try {
        await ctx.audioWorklet.addModule(url)
        model = new AudioWorkletNode(ctx, ENGINE_PROCESSOR, { numberOfInputs: 0, outputChannelCount: [1] })
        const gain = ctx.createGain()
        gain.gain.value = 2.2
        model.connect(gain).connect(body)
      } catch {
        model = null
      } finally {
        URL.revokeObjectURL(url)
      }
    }

    // Turbo whistle and the 2026 hybrid's electric-motor whine.
    const tone2 = (gainNode: GainNode) => {
      const o = ctx.createOscillator()
      o.type = "sine"
      gainNode.gain.value = 0
      o.connect(gainNode).connect(distance)
      o.start()
      return o
    }
    const turboGain = ctx.createGain(), ersGain = ctx.createGain()
    const turbo = tone2(turboGain), ers = tone2(ersGain)
    this.parts = { model, loop, body, tone, rasp, distance, turbo, turboGain, ers, ersGain }
    this.starting = false
  }

  engineStop() {
    this.engineOn = false
    if (this.ctx) {
      const t = this.ctx.currentTime
      this.engine.gain.cancelScheduledValues(t)
      this.engine.gain.setTargetAtTime(0, t, 0.05)
      this.parts?.model?.parameters.get("rpm")!.setTargetAtTime(0, t, 0.1)
    }
    this.maybeSuspend()
  }

  // Start-light tone: one short beep per light.
  async beep(freq = 880, len = 0.18) {
    await this.ensure()
    const ctx = this.ctx!, t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = "square"
    o.frequency.value = freq
    const f = ctx.createBiquadFilter()
    f.type = "lowpass"
    f.frequency.value = 2400
    const g = ctx.createGain()
    this.env(g, t, 0.12, 0.005, len)
    o.connect(f).connect(g).connect(this.master)
    o.start(t)
    o.stop(t + len + 0.05)
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
    const garage = useGarage.getState()
    // The engine is only heard out on track, never in the garage.
    const on = this.engineOn && garage.mode !== "studio"
    const v = telemetry.speed
    let throttle = telemetry.braking > 0.2 ? 0.08 : 1

    // Shift points of a 2026 car: up at about 11,900 rpm, landing near 10,300.
    const tops = [95, 135, 170, 205, 240, 272, 302, 340]
    let gear = tops.findIndex((top) => v < top)
    if (gear < 0) gear = 7
    const lo = gear === 0 ? 0 : tops[gear - 1]
    const k = Math.min(1, Math.max(0, (v - lo) / (tops[gear] - lo)))
    let rpm = gear === 0 ? 4200 + k * 7700 : 10300 + k * 1600
    if (v < 2 && telemetry.wheelspin < 0.1) { rpm = 4200 + Math.sin(t * 9) * 90; throttle = 0.25 }
    // Burnout and launch: bouncing off the limiter with the rears spinning.
    if (telemetry.wheelspin > 0.5 && v < 80) rpm = 11600 + Math.sin(t * 29) * 300
    let cut = 0
    if (on && gear > this.lastGear) {
      // Upshift: a 30 ms ignition cut, the revs drop, a crack from the exhaust.
      this.shiftUntil = t + 0.03
      this.pop(t, 0.1)
    }
    if (on && gear < this.lastGear) {
      // Downshift: a throttle blip and overrun pops.
      this.pop(t + 0.02, 0.07)
      this.pop(t + 0.09, 0.05)
    }
    if (t < this.shiftUntil) cut = 1
    this.lastGear = gear
    if (on && telemetry.braking > 0.3 && Math.random() < 0.12) this.pop(t + Math.random() * 0.02, 0.03 + Math.random() * 0.04)

    if (p.model) {
      p.model.parameters.get("rpm")!.setTargetAtTime(on ? rpm : 0, t, 0.015)
      p.model.parameters.get("load")!.setTargetAtTime(throttle, t, 0.03)
      p.model.parameters.get("cut")!.setValueAtTime(cut, t)
    }
    if (p.loop) p.loop.playbackRate.setTargetAtTime(Math.max(0.3, rpm / 10500), t, 0.03)

    // Where we hear it from: onboard is loud and raw, the TV and helicopter
    // cameras hear a distant, duller car.
    const cam = garage.trackCam
    const near = cam === "onboard" ? 1 : cam === "chase" ? 0.9 : cam === "tv" ? 0.55 : 0.4
    p.distance.frequency.setTargetAtTime(cam === "onboard" ? 7000 : cam === "chase" ? 9000 : cam === "tv" ? 3200 : 2200, t, 0.2)
    p.rasp.gain.setTargetAtTime(2 + throttle * 4, t, 0.05)
    p.turbo.frequency.setTargetAtTime(2600 + rpm * 0.45, t, 0.1)
    p.turboGain.gain.setTargetAtTime(on ? 0.006 * throttle * (rpm / 12000) : 0, t, 0.15)
    p.ers.frequency.setTargetAtTime(500 + v * 8.5, t, 0.08)
    p.ersGain.gain.setTargetAtTime(on ? 0.004 + 0.008 * telemetry.ers : 0, t, 0.15)
    // Lena stays clear over the engine.
    const talking = useEngineerState.getState().status === "talking"
    const level = on ? (telemetry.braking > 0.2 ? 0.1 : 0.16) * near * (talking ? 0.4 : 1) : 0
    this.engine.gain.setTargetAtTime(level, t, 0.08)
    // Duck the music under the engine.
    this.music.gain.setTargetAtTime(on ? 0.4 : 1, t, 0.4)
  }
}

export const sound = new SoundEngine()
