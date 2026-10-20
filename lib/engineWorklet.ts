// A physically informed model of the 1.6-litre V6 turbo hybrid, run as an
// AudioWorklet. Each cylinder fires every 720° of crank rotation (120° apart)
// and pushes a pressure pulse into the exhaust; the pipe's reflections give
// the note its resonance, and cycle-to-cycle variation in every combustion
// gives the raw, raspy texture of a real engine instead of a clean tone.
// Based on Baldan, Lachambre, Delle Monache & Boussard, "Physically informed
// car engine sound synthesis for virtual and augmented environments" (2015).
export const ENGINE_PROCESSOR = "v6-engine"

export const ENGINE_WORKLET = /* js */ `
const CYL = 6
const TAU = Math.PI * 2

class Delay {
  constructor(n) { this.b = new Float32Array(n); this.i = 0 }
  read(d) { const n = this.b.length; return this.b[(this.i - d + n) % n] }
  write(v) { this.b[this.i] = v; this.i = (this.i + 1) % this.b.length }
}

// A pipe: pressure travels to the open end, part of it reflects back
// inverted and slightly dulled. Returns what radiates from the open end.
class Pipe {
  constructor(len, reflect, damp) {
    this.len = len; this.reflect = reflect; this.damp = damp
    this.out = new Delay(len + 2); this.back = new Delay(len + 2); this.lp = 0
  }
  step(input) {
    const atEnd = this.out.read(this.len)
    this.lp += (atEnd - this.lp) * this.damp
    const returned = this.back.read(this.len)
    this.out.write(input + returned * 0.55)
    this.back.write(-this.reflect * this.lp)
    return atEnd * (1 - this.reflect * 0.5)
  }
}

class V6 extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "rpm", defaultValue: 0, minValue: 0, maxValue: 16000, automationRate: "k-rate" },
      { name: "load", defaultValue: 0.3, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "cut", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
    ]
  }
  constructor() {
    super()
    const sr = sampleRate
    this.crank = 0 // in cycles (one cycle = 720°)
    this.amp = new Float32Array(CYL).fill(1)
    this.last = new Float32Array(CYL).fill(1)
    this.seed = 12345
    // Exhaust primaries of slightly different lengths merge into a short tail
    // pipe; the intake is a short trumpet in the airbox above the driver.
    const m = (metres) => Math.max(8, Math.round((metres / 343) * sr))
    this.primaries = [0.62, 0.66, 0.7, 0.64, 0.68, 0.72].map((l) => new Pipe(m(l), 0.62, 0.55))
    this.tail = new Pipe(m(0.55), 0.5, 0.35)
    this.intake = new Pipe(m(0.24), 0.7, 0.6)
    this.hp = 0; this.hpIn = 0; this.block = 0; this.rpm = 0; this.load = 0.3
  }
  rand() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296 }
  gauss() { return (this.rand() + this.rand() + this.rand() - 1.5) * 1.15 }
  process(_in, outputs, params) {
    const out = outputs[0][0]
    if (!out) return true
    const targetRpm = params.rpm[0], targetLoad = params.load[0], cut = params.cut[0]
    const sr = sampleRate
    for (let n = 0; n < out.length; n++) {
      this.rpm += (targetRpm - this.rpm) * 0.004
      this.load += (targetLoad - this.load) * 0.002
      const rpm = this.rpm
      if (rpm < 50) { out[n] = 0; continue }
      const prev = this.crank
      this.crank += rpm / 120 / sr
      const wrapped = this.crank >= 1
      if (wrapped) this.crank -= 1
      let exhaust = 0, intake = 0, mech = 0
      for (let c = 0; c < CYL; c++) {
        // Even firing every 120° of crank.
        let a = this.crank - c / CYL
        if (a < 0) a += 1
        let pa = prev - c / CYL
        if (pa < 0) pa += 1
        if (a < pa) {
          // New combustion: its strength varies a little every cycle.
          const fired = cut > 0.5 ? 0.04 : 1
          this.last[c] = this.amp[c]
          this.amp[c] = fired * (0.25 + 0.75 * this.load) * (1 + 0.07 * this.gauss())
        }
        const amp = this.amp[c]
        // Exhaust valve open for ~250°: sharp blowdown, then a decaying push.
        const w = 250 / 720
        if (a < w) {
          const x = a / w
          const pulse = Math.pow(x, 0.25) * Math.pow(1 - x, 2.2) * 2.6
          const blow = Math.exp(-x * 26) * (this.rand() * 2 - 1) * 0.5
          exhaust += this.primaries[c].step(amp * (pulse + blow))
        } else exhaust += this.primaries[c].step(0)
        // Intake valve open for ~240°, a quarter-cycle later: a gentler suck.
        const ia = a - 0.4 < 0 ? a + 0.6 : a - 0.4
        if (ia < 0.33) intake -= Math.sin((ia / 0.33) * Math.PI) * (0.3 + 0.7 * this.load) * 0.35
        // Combustion knock through the block.
        if (a < 0.02) mech += amp * (1 - a / 0.02)
      }
      let y = this.tail.step(exhaust * 0.4)
      const ia = this.intake.step(intake * 0.5 + (this.rand() - 0.5) * 0.05 * this.load)
      this.block += (mech - this.block) * 0.08
      // Radiation from an open pipe end: the high end comes through.
      const mix = y * 1.0 + ia * 0.45 + this.block * 0.25
      this.hp = 0.995 * (this.hp + mix - this.hpIn)
      this.hpIn = mix
      out[n] = Math.tanh(this.hp * 1.15) * 0.85
    }
    for (let ch = 1; ch < outputs[0].length; ch++) outputs[0][ch].set(out)
    return true
  }
}
registerProcessor("${"v6-engine"}", V6)
`
