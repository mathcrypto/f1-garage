// Natural text-to-speech for Lena. Azure Neural TTS (en-GB-SoniaNeural by
// default) or ElevenLabs, whichever has a key; the browser's own voice is the
// fallback when neither is configured.
export const runtime = "nodejs"

const AZURE_KEY = process.env.AZURE_SPEECH_KEY
const AZURE_REGION = process.env.AZURE_SPEECH_REGION ?? "uksouth"
const AZURE_VOICE = process.env.AZURE_SPEECH_VOICE ?? "en-GB-SoniaNeural"
const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY
const ELEVEN_VOICE = process.env.ELEVENLABS_VOICE_ID

const provider = AZURE_KEY ? "azure" : ELEVEN_KEY && ELEVEN_VOICE ? "elevenlabs" : null

// Lessons and the showcase repeat the same lines, so keep recent audio.
const cache = new Map<string, ArrayBuffer>()
const remember = (key: string, audio: ArrayBuffer) => {
  cache.set(key, audio)
  if (cache.size > 300) cache.delete(cache.keys().next().value!)
}

const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!)

async function azure(text: string) {
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-GB"><voice name="${AZURE_VOICE}"><prosody rate="+3%">${escapeXml(text)}</prosody></voice></speak>`
  const res = await fetch(`https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": AZURE_KEY!,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "f1-garage",
    },
    body: ssml,
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Azure TTS ${res.status}`)
  return res.arrayBuffer()
}

async function elevenlabs(text: string) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": ELEVEN_KEY!, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}`)
  return res.arrayBuffer()
}

export async function GET() {
  return Response.json({ provider })
}

export async function POST(req: Request) {
  if (!provider) return Response.json({ error: "No TTS provider configured" }, { status: 501 })
  const { text } = (await req.json()) as { text?: string }
  const clean = (text ?? "").trim().slice(0, 600)
  if (!clean) return Response.json({ error: "Empty text" }, { status: 400 })
  try {
    const audio = cache.get(clean) ?? (await (provider === "azure" ? azure(clean) : elevenlabs(clean)))
    remember(clean, audio)
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400" } })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "TTS failed" }, { status: 502 })
  }
}
