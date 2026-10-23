import { edgeSpeak, LENA_VOICE, type LenaTone } from "@/lib/edgeVoice"

// Lena: en-GB-LibbyNeural only. `tone` changes delivery, never the voice.
export const runtime = "nodejs"

const cache = new Map<string, ArrayBuffer>()
const remember = (key: string, audio: ArrayBuffer) => {
  cache.set(key, audio)
  if (cache.size > 300) cache.delete(cache.keys().next().value!)
}

export async function GET() {
  return Response.json({ provider: "edge", voice: LENA_VOICE })
}

export async function POST(req: Request) {
  const { text, tone } = (await req.json()) as { text?: string; tone?: LenaTone }
  const clean = (text ?? "").trim().slice(0, 800)
  if (!clean) return Response.json({ error: "Empty text" }, { status: 400 })
  const delivery: LenaTone = tone === "race" ? "race" : "calm"
  const key = `${delivery}:${clean}`
  try {
    const hit = cache.get(key)
    if (hit) return new Response(hit, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400" } })
    const audio = await edgeSpeak(clean, delivery)
    remember(key, audio)
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400" } })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "TTS failed" }, { status: 502 })
  }
}
