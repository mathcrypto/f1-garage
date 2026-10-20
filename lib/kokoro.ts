// Free, keyless natural voice: Kokoro-82M (Apache-2.0) running on the server
// with the British female voice "Emma". The model (about 90 MB) downloads from
// Hugging Face on first use and is cached on disk after that.
const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX"
export const KOKORO_VOICE = process.env.KOKORO_VOICE ?? "bf_emma"
const SPEED = Number(process.env.KOKORO_SPEED) || 1

type Tts = { generate: (text: string, o: { voice: string; speed: number }) => Promise<{ audio: Float32Array; sampling_rate: number }> }
let loading: Promise<Tts> | null = null
let failedAt = 0
let chain: Promise<unknown> = Promise.resolve()

export function loadKokoro() {
  // After a failed download, don't retry on every sentence.
  if (!loading && Date.now() - failedAt < 60_000) return Promise.reject(new Error("Kokoro voice unavailable"))
  loading ??= import("kokoro-js")
    .then(({ KokoroTTS }) => KokoroTTS.from_pretrained(MODEL_ID, { dtype: "q8", device: "cpu" }) as unknown as Promise<Tts>)
    .catch((error) => { loading = null; failedAt = Date.now(); throw error })
  return loading
}

// 16-bit PCM WAV, which every browser plays.
function wav(samples: Float32Array, rate: number) {
  const out = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(out)
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  str(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); str(8, "WAVE")
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  str(36, "data"); v.setUint32(40, samples.length * 2, true)
  // Trim the model's silent tail and fade the edges to avoid clicks.
  const fade = Math.floor(rate * 0.004)
  for (let i = 0; i < samples.length; i++) {
    const edge = Math.min(1, i / fade, (samples.length - 1 - i) / fade)
    v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i] * 0.95 * edge)) * 0x7fff, true)
  }
  return out
}

// One sentence at a time: the CPU is the bottleneck, and requests arrive in
// the order Lena speaks them.
export function kokoro(text: string): Promise<ArrayBuffer> {
  const job = chain.then(async () => {
    const tts = await loadKokoro()
    const { audio, sampling_rate } = await tts.generate(text, { voice: KOKORO_VOICE, speed: SPEED })
    let end = audio.length
    while (end > 0 && Math.abs(audio[end - 1]) < 0.002) end--
    return wav(audio.subarray(0, Math.min(audio.length, end + Math.floor(sampling_rate * 0.08))), sampling_rate)
  })
  chain = job.catch(() => {})
  return job
}
