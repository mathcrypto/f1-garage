"use client"

import { gearbox, telemetry } from "./drive"
import { ENGINE_PROCESSOR, ENGINE_WORKLET } from "./engineWorklet"
import { useEngineerState, useGarage } from "./store"

// Every sound plays only when it belongs: the engine when a car is on track,
// Lena when she talks, music only if a licensed track is supplied. One mute
// button silences everything.
//
// Engine recordings (optional, like racing games use): either
//   public/audio/engine-loop.mp3  a seamless loop at about 10,500 rpm, or
//   public/audio/engine/engine.json  a set of loops recorded at several rpm,
//   on and off throttle: { "layers": [{ "file": "on_high.mp3", "rpm": 11000, "load": "on" }, ...] }
// Without recordings a physical model of the V6 runs in an AudioWorklet.
// Start-up (optional): public/audio/engine-start.mp3, a recording of the car
// being fired up; otherwise the starter, catch and flare are synthesized.
// Music (optional): public/audio/theme.mp3, a track you have the rights to.

type Layer = { rpm: number; on: boolean; src: AudioBufferSourceNode; gain: GainNode }

const fetchAudio = (ctx: AudioContext, url: string) =>
  fetch(url)
    .then((r) => (r.ok && (r.headers.get("content-type") ?? "").startsWith("audio") ? r.arrayBuffer() : null))
    .then((b) => (b ? ctx.decodeAudioData(b) : null))
    .catch(() => null)

class SoundEngine {
  ctx: AudioContext | null = null
  muted = false
  private master!: GainNode
  private engine!: GainNode
  private music!: GainNode
  private noise!: AudioBuffer
  private theme: HTMLAudioElement | null | undefined
  private raf = 0
  private listeners = new Set<() => void>()

  // Called from the first click anywhere: browsers only allow audio after a gesture.
  unlock() {
    if (!this.ctx) {
      const ctx = new AudioContext()
      this.ctx = ctx
      this.master = ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.8
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -12
      comp.ratio.value = 3
      this.master.connect(comp).connect(ctx.destination)
      this.engine = ctx.createGain()
      this.engine.gain.value = 0
      this.engine.connect(this.master)
      this.music = ctx.createGain()
      this.music.gain.value = 0
      this.music.connect(this.master)
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
      const d = this.noise.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
      void this.startEngine()
      void this.loadTheme()
      const tick = () => { this.update(); this.raf = requestAnimationFrame(tick) }
      this.raf = requestAnimationFrame(tick)
    }
    void this.ctx.resume()
  }

  setMuted(m: boolean) {
    this.muted = m
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05)
    if (this.theme && m) this.theme.pause()
    this.listeners.forEach((f) => f())
  }

  subscribe(f: () => void) {
    this.listeners.add(f)
    return () => { this.listeners.delete(f) }
  }

  // ── Music ─────────────────────────────────────────────────────────────────
  private async loadTheme() {
    const ok = await fetch("/audio/theme.mp3", { method: "HEAD" }).then((r) => r.ok && (r.headers.get("content-type") ?? "").startsWith("audio")).catch(() => false)
    if (!ok || !this.ctx) { this.theme = null; return }
    const el = new Audio("/audio/theme.mp3")
    el.loop = true
    this.ctx.createMediaElementSource(el).connect(this.music)
    this.theme = el
  }

  // ── Engine ────────────────────────────────────────────────────────────────
  private model: AudioWorkletNode | null = null
  private layers: Layer[] = []
  private distance: BiquadFilterNode | null = null
  private turboGain: GainNode | null = null
  private turbo: OscillatorNode | null = null
  private lastGear = 0
  private shiftUntil = 0
  private startClip: AudioBuffer | null = null
  private startAt = -Infinity
  private startLen = 2.4
  private wasOnTrack = false

  private async startEngine() {
    const ctx = this.ctx!
    const body = ctx.createGain()
    const distance = ctx.createBiquadFilter()
    distance.type = "lowpass"
    distance.frequency.value = 8000
    distance.Q.value = 0.4
    body.connect(distance).connect(this.engine)

    // Turbo whistle, very faint.
    const turbo = ctx.createOscillator()
    turbo.type = "sine"
    const turboGain = ctx.createGain()
    turboGain.gain.value = 0
    turbo.connect(turboGain).connect(distance)
    turbo.start()
    Object.assign(this, { distance, turbo, turboGain })

    this.startClip = await fetchAudio(ctx, "/audio/engine-start.mp3")
    const loaded = await this.loadRecordings(ctx, body)
    if (loaded || !ctx.audioWorklet) return
    const url = URL.createObjectURL(new Blob([ENGINE_WORKLET], { type: "application/javascript" }))
    try {
      await ctx.audioWorklet.addModule(url)
      const model = new AudioWorkletNode(ctx, ENGINE_PROCESSOR, { numberOfInputs: 0, outputChannelCount: [1] })
      // Smooth the model's top end: warm and full rather than buzzy.
      const warm = ctx.createBiquadFilter()
      warm.type = "lowpass"; warm.frequency.value = 4200; warm.Q.value = 0.5
      const mids = ctx.createBiquadFilter()
      mids.type = "peaking"; mids.frequency.value = 650; mids.Q.value = 0.9; mids.gain.value = 3
      const gain = ctx.createGain()
      gain.gain.value = 2
      model.connect(warm).connect(mids).connect(gain).connect(body)
      this.model = model
    } catch {
      this.model = null
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  private async loadRecordings(ctx: AudioContext, out: AudioNode) {
    const add = (buffer: AudioBuffer, rpm: number, on: boolean) => {
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.loop = true
      const gain = ctx.createGain()
      gain.gain.value = 0
      src.connect(gain).connect(out)
      src.start(0, Math.random() * buffer.duration)
      this.layers.push({ rpm, on, src, gain })
    }
    const manifest = (await fetch("/audio/engine/engine.json").then((r) => (r.ok ? r.json() : null)).catch(() => null)) as { layers?: { file: string; rpm: number; load?: string }[] } | null
    if (manifest?.layers?.length) {
      const buffers = await Promise.all(manifest.layers.map((l) => fetchAudio(ctx, `/audio/engine/${l.file}`)))
      manifest.layers.forEach((l, i) => { const b = buffers[i]; if (b) add(b, l.rpm, l.load !== "off") })
    }
    if (!this.layers.length) {
      const single = await fetchAudio(ctx, "/audio/engine-loop.mp3")
      if (single) add(single, 10500, true)
    }
    return this.layers.length > 0
  }

  // Fire the engine up: the starter motor turns it over, it catches, flares
  // and settles to idle. Played whenever a car rolls out on track.
  private engineStart(t: number) {
    const ctx = this.ctx!
    this.startAt = t
    if (this.startClip) {
      const src = ctx.createBufferSource()
      src.buffer = this.startClip
      const g = ctx.createGain()
      g.gain.value = 0.9
      src.connect(g).connect(this.master)
      src.start(t)
      this.startLen = this.startClip.duration
      return
    }
    this.startLen = 2.4
    // Starter motor: a geared electric whine with the engine's compression pulses.
    const o = ctx.createOscillator()
    o.type = "sawtooth"
    o.frequency.setValueAtTime(70, t)
    o.frequency.linearRampToValueAtTime(150, t + 0.35)
    o.frequency.setValueAtTime(150, t + 0.95)
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 9
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.35
    const f = ctx.createBiquadFilter()
    f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 0.9
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.08)
    g.gain.setValueAtTime(0.09, t + 0.95)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1)
    lfo.connect(lfoGain).connect(g.gain)
    o.connect(f).connect(g).connect(this.engine)
    o.start(t); lfo.start(t)
    o.stop(t + 1.15); lfo.stop(t + 1.15)
  }

  // Revs during the synthesized start: cranking, catch, flare, idle.
  private startRpm(e: number) {
    const pts: [number, number][] = [[0, 0], [0.95, 0], [1.05, 1500], [1.3, 9200], [1.6, 7000], [2.4, 4300]]
    for (let i = 1; i < pts.length; i++) if (e <= pts[i][0]) { const [t0, r0] = pts[i - 1], [t1, r1] = pts[i]; return r0 + ((r1 - r0) * (e - t0)) / (t1 - t0) }
    return null
  }

  private pop(t: number, peak: number) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = "bandpass"
    f.frequency.value = 900
    f.Q.value = 0.8
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
    src.connect(f).connect(g).connect(this.distance!)
    src.start(t, Math.random() * 0.8)
    src.stop(t + 0.07)
  }

  // Equal-power crossfade between the recordings nearest the current revs,
  // and between on-throttle and off-throttle recordings.
  private mixLayers(rpm: number, throttle: number, t: number) {
    const hasOff = this.layers.some((l) => !l.on)
    for (const on of [true, false]) {
      const set = this.layers.filter((l) => l.on === on).sort((a, b) => a.rpm - b.rpm)
      if (!set.length) continue
      const loadW = hasOff ? (on ? throttle : 1 - throttle) : 0.55 + 0.45 * throttle
      let i = set.findIndex((l) => l.rpm >= rpm)
      if (i < 0) i = set.length - 1
      const hi = set[i], lo = set[Math.max(0, i - 1)]
      const k = hi === lo ? 1 : Math.min(1, Math.max(0, (rpm - lo.rpm) / (hi.rpm - lo.rpm)))
      for (const l of set) {
        const w = l === hi ? Math.sin((k * Math.PI) / 2) : l === lo ? Math.cos((k * Math.PI) / 2) : 0
        l.gain.gain.setTargetAtTime(w * loadW, t, 0.04)
        l.src.playbackRate.setTargetAtTime(Math.max(0.25, rpm / l.rpm), t, 0.03)
      }
    }
  }

  private update() {
    if (!this.ctx || !this.distance) return
    const t = this.ctx.currentTime
    const garage = useGarage.getState()
    const onTrack = garage.mode !== "studio"
    const talking = useEngineerState.getState().status === "talking"
    const v = telemetry.speed

    // Music: the garage and the grid; it fades out once the cars are moving.
    if (this.theme) {
      const want = !this.muted && !(onTrack && v > 1)
      this.music.gain.setTargetAtTime(want ? (talking ? 0.1 : 0.32) : 0, t, 0.6)
      if (want && this.theme.paused) void this.theme.play().catch(() => {})
      if (!want && !this.theme.paused && this.music.gain.value < 0.01) this.theme.pause()
    }

    if (onTrack && !this.wasOnTrack) this.engineStart(t)
    this.wasOnTrack = onTrack

    let throttle = telemetry.throttle
    const box = gearbox(v, telemetry.wheelspin, telemetry.throttle, t)
    let rpm = box.rpm
    const gear = box.index
    if (box.idle) throttle = 0.2 + telemetry.throttle * 0.8
    // While the engine is being started, the start-up sets the revs.
    const sinceStart = t - this.startAt
    const starting = onTrack && sinceStart < this.startLen && box.idle
    if (starting) {
      const scripted = this.startClip ? 0 : this.startRpm(sinceStart)
      if (scripted !== null) { rpm = scripted; throttle = sinceStart > 1.05 && sinceStart < 1.4 ? 1 : 0.25 }
    }

    if (onTrack && gear > this.lastGear) { this.shiftUntil = t + 0.03; this.pop(t, 0.05) }
    if (onTrack && gear < this.lastGear) this.pop(t + 0.03, 0.035)
    this.lastGear = gear
    const cut = t < this.shiftUntil

    if (this.model) {
      this.model.parameters.get("rpm")!.setTargetAtTime(onTrack ? rpm : 0, t, 0.015)
      this.model.parameters.get("load")!.setTargetAtTime(cut ? 0 : throttle, t, 0.03)
      this.model.parameters.get("cut")!.setValueAtTime(cut ? 1 : 0, t)
    }
    if (this.layers.length) this.mixLayers(rpm, cut ? 0 : throttle, t)

    // Onboard is close and loud; the TV and helicopter cameras hear a distant car.
    const cam = garage.trackCam
    const near = cam === "onboard" ? 1 : cam === "chase" ? 0.85 : cam === "tv" ? 0.5 : 0.35
    this.distance.frequency.setTargetAtTime(cam === "onboard" || cam === "chase" ? 8000 : 2600, t, 0.2)
    this.turbo!.frequency.setTargetAtTime(2800 + rpm * 0.4, t, 0.1)
    this.turboGain!.gain.setTargetAtTime(onTrack ? 0.003 * throttle : 0, t, 0.15)
    // Lena stays clear over the engine.
    // A recorded start-up plays on its own; the running engine fades in after it.
    const recordingStart = starting && this.startClip !== null && sinceStart < this.startLen - 0.3
    const level = onTrack && !recordingStart ? 0.22 * near * (talking ? 0.35 : 1) * (0.6 + 0.4 * throttle) : 0
    this.engine.gain.setTargetAtTime(level, t, 0.08)
  }
}

export const sound = new SoundEngine()
