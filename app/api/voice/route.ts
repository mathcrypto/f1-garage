import { LENA_VOICE, speak, type LenaTone } from "@/lib/server/tts"

// GET /api/voice: Lena's voice (Microsoft neural voice en-GB-LibbyNeural).
//   no query            → { provider, voice }
//   ?text=…&tone=calm   → MP3 audio. The same text always gives the same audio,
//                         so it's served with a long immutable cache lifetime.
export const runtime = "nodejs"

const MAX_TEXT = 800

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const text = params.get("text")?.trim()
  if (!text) return Response.json({ provider: "edge", voice: LENA_VOICE })
  if (text.length > MAX_TEXT) return Response.json({ error: `Text is limited to ${MAX_TEXT} characters.` }, { status: 400 })
  const tone: LenaTone = params.get("tone") === "race" ? "race" : "calm"
  try {
    const audio = await speak(text, tone)
    return new Response(audio, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=31536000, immutable" },
    })
  } catch (error) {
    console.error("[voice]", error instanceof Error ? error.message : error)
    return Response.json({ error: "Speech synthesis failed." }, { status: 502 })
  }
}
