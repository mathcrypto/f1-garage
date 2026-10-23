// Smoother game-style V6 hybrid note: RPM-locked harmonics with a soft
// exhaust thump, heavily low-passed so it sits under Lena instead of
// buzzing. Not a studio recording — just less fatiguing than the old model.
export const ENGINE_PROCESSOR = "v6-engine"

export const ENGINE_WORKLET = /* js */ `
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
    this.phase = 0
    this.rpm = 0
    this.load = 0.3
    this.lp = 0
    this.lp2 = 0
    this.hp = 0
    this.seed = 1
  }
  rand() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296 }
  process(_in, outputs, params) {
    const out = outputs[0][0]
    if (!out) return true
    const targetRpm = params.rpm[0], targetLoad = params.load[0], cut = params.cut[0]
    const sr = sampleRate
    for (let n = 0; n < out.length; n++) {
      this.rpm += (targetRpm - this.rpm) * 0.003
      this.load += (targetLoad - this.load) * 0.002
      const rpm = this.rpm
      if (rpm < 80) { out[n] = 0; this.lp = this.lp2 = 0; continue }

      // Firing rate for a 4-stroke V6: 3 combustions per crank rev.
      const fireHz = (rpm / 60) * 3
      this.phase += fireHz / sr
      if (this.phase >= 1) this.phase -= 1
      const p = this.phase * Math.PI * 2

      const load = cut > 0.5 ? 0.05 : this.load
      // Soft harmonic stack (game engine), no pipe noise or crackle.
      const fund = Math.sin(p)
      const h2 = Math.sin(p * 2) * 0.55
      const h3 = Math.sin(p * 3) * 0.28
      const h4 = Math.sin(p * 4) * 0.12
      const thump = Math.pow(Math.max(0, Math.sin(p * 0.5)), 4) * 0.35
      // Very light grain so it isn't a pure synth tone.
      const grain = (this.rand() * 2 - 1) * 0.02 * load

      let y = (fund + h2 + h3 + h4 + thump) * (0.22 + 0.55 * load) + grain
      // Darken with RPM: high revs stay smooth, not screechy.
      const bright = 0.08 + Math.min(0.35, rpm / 28000)
      this.lp += (y - this.lp) * bright
      this.lp2 += (this.lp - this.lp2) * (bright * 0.85)
      // Gentle DC block.
      const hp = this.lp2 - this.hp
      this.hp += hp * 0.002
      out[n] = Math.tanh(hp * 1.4) * 0.55
    }
    for (let ch = 1; ch < outputs[0].length; ch++) outputs[0][ch].set(out)
    return true
  }
}
registerProcessor("${"v6-engine"}", V6)
`
