import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"
import { TEAMS } from "@/lib/teams"

// The link preview: brand on the left, the 2026 grid in team colours on the
// right (not an order or ranking). Generated at build time.

export const alt = "F1 Garage: explore every 2026 Formula 1 car in 3D"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const font = (weight: number) =>
  readFile(join(process.cwd(), `node_modules/@fontsource/titillium-web/files/titillium-web-latin-${weight}-normal.woff`))

export default async function Image() {
  const [regular, black] = await Promise.all([font(400), font(900)])
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#07080b", color: "#f1f3f7", fontFamily: "Titillium", padding: 64 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg viewBox="0 0 32 20" width="64" height="40">
              <path d="M2 18 L14 2 H30 L18 18 Z" fill="#ff2b2b" />
              <path d="M10 18 L16 10 H22 L16 18 Z" fill="#07080b" />
            </svg>
            <span style={{ fontSize: 30, fontWeight: 900, letterSpacing: 6 }}>F1 GARAGE</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <span style={{ fontSize: 22, letterSpacing: 6, color: "#ff2b2b", fontWeight: 900 }}>2026 GRID · {TEAMS.length} TEAMS</span>
            <span style={{ fontSize: 76, fontWeight: 900, lineHeight: 0.98, maxWidth: 640 }}>Take every 2026 car apart in 3D</span>
            <span style={{ fontSize: 28, color: "#8d94a3", maxWidth: 600, lineHeight: 1.3 }}>Pick your team, explore each part and ask your race engineer.</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 7, width: 300 }}>
          {TEAMS.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 14, height: 38, padding: "0 16px", borderRadius: 8, background: "rgba(255,255,255,0.05)" }}>
              <span style={{ width: 6, height: 22, borderRadius: 3, background: t.ui }} />
              <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: 3 }}>{t.code}</span>
              <span style={{ fontSize: 18, color: "#8d94a3", marginLeft: "auto" }}>{t.car}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Titillium", data: regular, weight: 400, style: "normal" },
        { name: "Titillium", data: black, weight: 900, style: "normal" },
      ],
    },
  )
}
