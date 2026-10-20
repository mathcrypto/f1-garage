import { teamById } from "@/lib/teams"

// Real photos of each team's car from Wikimedia Commons, which only hosts
// freely licensed images. Every photo comes back with its author, licence and
// file page so the site can credit it as the licence requires.
export const runtime = "nodejs"

type Info = {
  url: string
  thumburl?: string
  thumbwidth?: number
  descriptionurl: string
  width: number
  extmetadata?: Record<string, { value?: string }>
}
type Page = { title: string; imageinfo?: Info[] }

const strip = (html?: string) => (html ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()

// Previous cars as a fallback while the current one has few photos yet.
const PREVIOUS: Record<string, string[]> = {
  ferrari: ["Ferrari SF-25", "Ferrari SF-24"],
  mercedes: ["Mercedes W16", "Mercedes W15"],
  redbull: ["Red Bull RB21", "Red Bull RB20"],
  mclaren: ["McLaren MCL39", "McLaren MCL38"],
  astonmartin: ["Aston Martin AMR25", "Aston Martin AMR24"],
  alpine: ["Alpine A525", "Alpine A524"],
  williams: ["Williams FW47", "Williams FW46"],
  racingbulls: ["Racing Bulls VCARB 02", "RB VCARB 01"],
  haas: ["Haas VF-25", "Haas VF-24"],
  audi: ["Audi R26 Formula One", "Sauber C45"],
  cadillac: ["Cadillac Formula 1 car", "Cadillac F1"],
}

async function search(query: string) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: "12",
    gsrsearch: `filetype:bitmap ${query}`,
    prop: "imageinfo",
    iiprop: "url|extmetadata|size",
    iiurlwidth: "1280",
  })
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { "User-Agent": "F1Garage/1.0 (unofficial fan project)" },
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) return []
  const data = (await res.json()) as { query?: { pages?: Record<string, Page> } }
  return Object.values(data.query?.pages ?? {})
}

export async function GET(req: Request) {
  const team = teamById(new URL(req.url).searchParams.get("team") ?? "ferrari")
  const queries = [`${team.name.split(" ").pop()} ${team.car}`, ...(PREVIOUS[team.id] ?? [])]
  const photos: { src: string; page: string; title: string; author: string; license: string; car: string }[] = []
  try {
    for (const q of queries) {
      // The model code (e.g. "sf-26", "mcl40") must appear in the file name.
      const key = q.toLowerCase().split(" ").find((w) => /\d/.test(w) && w.length >= 3) ?? ""
      for (const p of await search(q)) {
        const info = p.imageinfo?.[0]
        if (!info || info.width < 900 || !p.title.toLowerCase().includes(key)) continue
        const meta = info.extmetadata ?? {}
        photos.push({
          src: info.thumburl ?? info.url,
          page: info.descriptionurl,
          title: strip(meta.ObjectName?.value) || p.title.replace(/^File:/, "").replace(/\.[a-z]+$/i, ""),
          author: strip(meta.Artist?.value) || "Unknown author",
          license: strip(meta.LicenseShortName?.value) || "See file page",
          car: q,
        })
        if (photos.length >= 6) break
      }
      if (photos.length >= 3) break
    }
  } catch {
    // Commons unreachable: the client shows nothing rather than an error.
  }
  return Response.json({ photos }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } })
}
