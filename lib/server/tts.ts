import "server-only"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { EdgeTTS } from "node-edge-tts"
import { LruCache } from "./cache"

/** Lena = Libby only. Same voice ID forever; `tone` only changes rate/pitch/volume. */
export const LENA_VOICE = "en-GB-LibbyNeural"
export const LENA_LANG = "en-GB"

export type LenaTone = "calm" | "race"

const TONE: Record<LenaTone, { rate: string; pitch: string; volume: string }> = {
  calm: { rate: "+5%", pitch: "default", volume: "default" },
  race: { rate: "+12%", pitch: "+2Hz", volume: "+8%" },
}

const clients = new Map<LenaTone, EdgeTTS>()

function client(tone: LenaTone) {
  let tts = clients.get(tone)
  if (!tts) {
    const p = TONE[tone]
    tts = new EdgeTTS({
      voice: LENA_VOICE,
      lang: LENA_LANG,
      rate: p.rate,
      pitch: p.pitch,
      volume: p.volume,
      outputFormat: "audio-24khz-48kbitrate-mono-mp3",
      timeout: 35000,
    })
    clients.set(tone, tts)
  }
  return tts
}

async function synthesize(text: string, tone: LenaTone): Promise<ArrayBuffer> {
  const dir = await mkdtemp(join(tmpdir(), "lena-tts-"))
  const file = join(dir, "line.mp3")
  try {
    await client(tone).ttsPromise(text, file)
    const buf = await readFile(file)
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

// Lena repeats many lines (greetings, lessons, radio calls). Keep recent audio
// per server instance, up to 32 MB, and share concurrent identical requests.
const audioCache = new LruCache<ArrayBuffer>(32 * 1024 * 1024, (a) => a.byteLength)
const inFlight = new Map<string, Promise<ArrayBuffer>>()

/** Speak one line in Lena's voice as MP3 audio. */
export function speak(text: string, tone: LenaTone = "calm"): Promise<ArrayBuffer> {
  const key = `${tone}:${text}`
  const hit = audioCache.get(key)
  if (hit) return Promise.resolve(hit)
  const running = inFlight.get(key)
  if (running) return running
  const job = synthesize(text, tone)
    .then((audio) => { audioCache.set(key, audio); return audio })
    .finally(() => inFlight.delete(key))
  inFlight.set(key, job)
  return job
}
