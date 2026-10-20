import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { speechChunks } from "./speech"
import { fixedLines } from "./voiceLines"

// Free, keyless natural voice: Kokoro-82M (Apache-2.0) running on the server
// with the British female voice "Emma". The full-precision model (about
// 330 MB) downloads from Hugging Face on first use; on a CPU it generates
// speech about 2.5x faster than real time, twice as fast as the quantized one.
// Every line is cached on disk, and Lena's fixed lines are generated in the
// background as soon as the model is ready, so they play instantly.
const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX"
export const KOKORO_VOICE = process.env.KOKORO_VOICE ?? "bf_emma"
const SPEED = Number(process.env.KOKORO_SPEED) || 1.05
const DTYPE = (process.env.KOKORO_DTYPE ?? "fp32") as "fp32" | "q8"
const CACHE_DIR = path.join(process.cwd(), ".cache", "voice", `${KOKORO_VOICE}-${DTYPE}-${SPEED}`)

// The model runs in a worker thread: generating speech keeps a CPU busy
// (the phonemizer is synchronous), and the server must stay free to answer
// cached lines and other requests instantly.
const WORKER = `
const { parentPort, workerData } = require("node:worker_threads")
const { createRequire } = require("node:module")
const req = createRequire(workerData.cwd + "/")
let tts
async function load() {
  const { KokoroTTS } = req("kokoro-js")
  tts = await KokoroTTS.from_pretrained(workerData.model, { dtype: workerData.dtype, device: "cpu" })
  await tts.generate("Ready.", { voice: workerData.voice, speed: workerData.speed })
}
const ready = load()
parentPort.on("message", async ({ id, text }) => {
  try {
    await ready
    const { audio, sampling_rate } = await tts.generate(text, { voice: workerData.voice, speed: workerData.speed })
    parentPort.postMessage({ id, audio, rate: sampling_rate }, [audio.buffer])
  } catch (error) {
    parentPort.postMessage({ id, error: String(error && error.message || error) })
  }
})
ready.then(() => parentPort.postMessage({ ready: true }), (e) => parentPort.postMessage({ fatal: String(e && e.message || e) }))
`

type Reply = { id?: number; audio?: Float32Array; rate?: number; error?: string; ready?: boolean; fatal?: string }
let worker: import("node:worker_threads").Worker | null = null
let loading: Promise<void> | null = null
let failedAt = 0
let nextId = 0
const waiting = new Map<number, { resolve: (r: { audio: Float32Array; rate: number }) => void; reject: (e: Error) => void }>()

export function loadKokoro() {
  // After a failed download, don't retry on every sentence.
  if (!loading && Date.now() - failedAt < 60_000) return Promise.reject(new Error("Kokoro voice unavailable"))
  loading ??= import("node:worker_threads").then(({ Worker }) => new Promise<void>((resolve, reject) => {
    const w = new Worker(WORKER, { eval: true, workerData: { cwd: process.cwd(), model: MODEL_ID, dtype: DTYPE, voice: KOKORO_VOICE, speed: SPEED } })
    w.on("message", (m: Reply) => {
      if (m.ready) { worker = w; resolve(); void prewarm(); return }
      if (m.fatal) { reject(new Error(m.fatal)); return }
      const job = m.id === undefined ? undefined : waiting.get(m.id)
      if (!job) return
      waiting.delete(m.id!)
      if (m.error || !m.audio) job.reject(new Error(m.error ?? "no audio"))
      else job.resolve({ audio: m.audio, rate: m.rate! })
    })
    w.on("error", reject)
    w.on("exit", () => { worker = null; loading = null; for (const j of waiting.values()) j.reject(new Error("voice worker stopped")); waiting.clear() })
  })).catch((error) => { loading = null; failedAt = Date.now(); throw error })
  return loading
}

async function generate(text: string) {
  await loadKokoro()
  const id = nextId++
  return new Promise<{ audio: Float32Array; rate: number }>((resolve, reject) => {
    waiting.set(id, { resolve, reject })
    worker!.postMessage({ id, text })
  })
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
  // Fade the edges to avoid clicks.
  const fade = Math.floor(rate * 0.004)
  for (let i = 0; i < samples.length; i++) {
    const edge = Math.min(1, i / fade, (samples.length - 1 - i) / fade)
    v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i] * 0.95 * edge)) * 0x7fff, true)
  }
  return out
}

const memory = new Map<string, ArrayBuffer>()
const fileFor = (text: string) => path.join(CACHE_DIR, `${createHash("sha1").update(text).digest("hex")}.wav`)

async function cached(text: string) {
  const hit = memory.get(text)
  if (hit) return hit
  const file = await readFile(fileFor(text)).catch(() => null)
  if (!file) return null
  const audio = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer
  memory.set(text, audio)
  return audio
}

async function synthesize(text: string) {
  const { audio, rate: sampling_rate } = await generate(text)
  // Trim the model's silent tail, keeping a short natural pause.
  let end = audio.length
  while (end > 0 && Math.abs(audio[end - 1]) < 0.002) end--
  const out = wav(audio.subarray(0, Math.min(audio.length, end + Math.floor(sampling_rate * 0.06))), sampling_rate)
  memory.set(text, out)
  if (memory.size > 600) memory.delete(memory.keys().next().value!)
  await mkdir(CACHE_DIR, { recursive: true }).then(() => writeFile(fileFor(text), new Uint8Array(out))).catch(() => {})
  return out
}

// One generation at a time (the CPU is the bottleneck). What Lena is about to
// say always goes before background pre-generation.
type Job = { text: string; resolve: (a: ArrayBuffer) => void; reject: (e: unknown) => void }
const live: Job[] = []
const background: Job[] = []
let working = false

async function work() {
  if (working) return
  working = true
  for (let job = live.shift() ?? background.shift(); job; job = live.shift() ?? background.shift()) {
    try {
      job.resolve((await cached(job.text)) ?? (await synthesize(job.text)))
    } catch (error) {
      job.reject(error)
    }
  }
  working = false
}

const pending = new Map<string, Promise<ArrayBuffer>>()
function enqueue(text: string, priority: "live" | "background") {
  const existing = pending.get(text)
  if (existing) {
    // Already queued in the background but needed now: move it to the front.
    if (priority === "live") {
      const i = background.findIndex((j) => j.text === text)
      if (i >= 0) live.push(...background.splice(i, 1))
    }
    return existing
  }
  const job = new Promise<ArrayBuffer>((resolve, reject) => (priority === "live" ? live : background).push({ text, resolve, reject }))
  pending.set(text, job)
  void job.finally(() => pending.delete(text)).catch(() => {})
  void work()
  return job
}

export async function kokoro(text: string): Promise<ArrayBuffer> {
  return (await cached(text)) ?? enqueue(text, "live")
}

let warmed = false
async function prewarm() {
  if (warmed) return
  warmed = true
  for (const line of fixedLines()) for (const chunk of speechChunks(line)) if (!(await cached(chunk))) enqueue(chunk, "background").catch(() => {})
}
