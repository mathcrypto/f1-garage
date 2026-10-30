/**
 * Sponsor wordmarks painted onto the licensed car, drawn as canvas text.
 *
 * `z` runs nose (+) to tail, `y` is height, `w` is width in metres along the
 * car. Positions follow 2026 launch side photos using the wheel centres.
 */
export type SponsorDecal = {
  /** Text drawn onto the atlas (Titillium italic). */
  label: string
  z: number
  y: number
  w: number
  /** 0 both flanks, 1 car-left, -1 car-right, 2 top surface. */
  side?: 0 | 1 | -1 | 2
  /** Force white ink for dark paint. */
  ink?: "white"
  /** Fill colour when not forced white (default #ffffff). */
  color?: string
}

const W = "white" as const
const FRONT_END = { z: 2.28, y: 0.25 }
const REAR_END = { z: -2.43, y: 0.74 }

const SPONSORS: Record<string, SponsorDecal[]> = {
  redbull: [
    { label: "AT&T", z: 2.15, y: 0.26, w: 0.42 },
    { label: "Carlyle", z: 0.62, y: 0.58, w: 0.5 },
    { label: "1Password", z: 0.78, y: 0.38, w: 0.38 },
    { label: "Hard Rock", z: 0.22, y: 0.64, w: 0.28 },
    { label: "ORACLE", z: -0.05, y: 0.4, w: 1.05 },
    { label: "Red Bull", z: -0.55, y: 0.78, w: 0.85, ink: W },
    { label: "ROKiT", z: 0.18, y: 0.78, w: 0.28 },
    { label: "Ford", z: -0.5, y: 0.96, w: 0.28, side: 2 },
    { label: "Mobil 1", z: -2.4, y: 0.7, w: 0.42 },
  ],
  ferrari: [
    { label: "UniCredit", z: -0.2, y: 0.36, w: 0.78 },
    { label: "Shell", z: 0.05, y: 0.62, w: 0.32, color: "#FFD500" },
    { label: "CEVA", z: 0.45, y: 0.46, w: 0.34 },
    { label: "Richard Mille", z: 0.98, y: 0.42, w: 0.5, ink: W },
    { label: "SF", z: 0.8, y: 0.58, w: 0.18, color: "#FFD500" },
    { label: "Ferrari", z: -1.05, y: 0.6, w: 0.5, color: "#d0091a" },
    { label: "PUMA", z: -0.95, y: 0.5, w: 0.32 },
    { label: "HP", z: -1.45, y: 0.86, w: 0.28 },
    { label: "aws", ...FRONT_END, w: 0.38 },
    { label: "UniCredit", ...REAR_END, w: 0.38 },
  ],
  mercedes: [
    { label: "PETRONAS", z: -0.78, y: 0.45, w: 0.95, color: "#00D2BE" },
    { label: "IWC", z: 0.55, y: 0.4, w: 0.32 },
    { label: "Einhell", z: 1.05, y: 0.45, w: 0.3 },
    { label: "Microsoft", z: -0.9, y: 0.92, w: 0.42 },
    { label: "Solera", z: -1.25, y: 0.85, w: 0.36 },
    { label: "TeamViewer", z: -1.55, y: 0.72, w: 0.4 },
    { label: "INEOS", ...FRONT_END, w: 0.4 },
    { label: "PETRONAS", ...REAR_END, w: 0.38, color: "#00D2BE" },
  ],
  mclaren: [
    { label: "McLaren", z: -0.6, y: 0.4, w: 0.75, ink: W },
    { label: "Dell", z: 0.35, y: 0.5, w: 0.5 },
    { label: "Gemini", z: -0.15, y: 0.62, w: 0.3 },
    { label: "Gemini", z: -1.6, y: 0.85, w: 0.28 },
    { label: "Dropbox", z: -1.1, y: 0.75, w: 0.45, ink: W },
    { label: "DHL", ...REAR_END, w: 0.4, color: "#FFCC00" },
  ],
  astonmartin: [
    { label: "Aramco", z: -0.53, y: 0.54, w: 0.8 },
    { label: "Cognizant", z: 0.36, y: 0.33, w: 0.36, ink: W },
    { label: "BOSS", z: 0.1, y: 0.64, w: 0.26, ink: W },
    { label: "Aston Martin", z: 0.9, y: 0.62, w: 0.4 },
    { label: "Pepperstone", z: 1.15, y: 0.35, w: 0.34, ink: W },
    { label: "Maaden", z: -0.9, y: 0.82, w: 0.32, ink: W },
    { label: "Honda", z: -1.3, y: 0.84, w: 0.36 },
    { label: "Valvoline", z: -1.4, y: 0.62, w: 0.36, ink: W },
    { label: "Coinbase", ...REAR_END, w: 0.42 },
    { label: "Glenfiddich", z: 2.3, y: 0.22, w: 0.26, ink: W },
  ],
  alpine: [
    { label: "BWT", z: -0.65, y: 0.42, w: 0.9, ink: W },
    { label: "MSC", z: 0.12, y: 0.5, w: 0.28 },
    { label: "eToro", ...FRONT_END, w: 0.38 },
    { label: "BWT", ...REAR_END, w: 0.38, ink: W },
  ],
  williams: [
    { label: "Atlassian", z: -0.5, y: 0.42, w: 0.85 },
    { label: "Gulf", z: 0.25, y: 0.5, w: 0.28, color: "#FF6600" },
    { label: "Komatsu", z: -1.0, y: 0.38, w: 0.42 },
    { label: "Duracell", z: 1.1, y: 0.4, w: 0.4 },
  ],
  racingbulls: [
    { label: "VISA", z: -0.47, y: 0.4, w: 0.65, color: "#1A1F71" },
    { label: "Cash App", z: 0.1, y: 0.62, w: 0.4, color: "#00D632" },
    { label: "HUGO", z: 0.78, y: 0.6, w: 0.28 },
    { label: "Mobil 1", z: 0.62, y: 0.38, w: 0.28 },
    { label: "Red Bull", z: -0.98, y: 0.78, w: 0.46 },
    { label: "Ford", z: -1.32, y: 0.6, w: 0.28 },
    { label: "Cash App", ...FRONT_END, w: 0.35, ink: W },
    { label: "VISA", ...REAR_END, w: 0.35, ink: W },
  ],
  haas: [
    { label: "HAAS", z: -0.45, y: 0.5, w: 0.75, color: "#111111" },
    { label: "Zoomex", z: 0.5, y: 0.32, w: 0.28 },
    { label: "Play'n GO", ...REAR_END, w: 0.38 },
    { label: "Singha", z: -2.43, y: 0.45, w: 0.28 },
  ],
  audi: [
    { label: "Revolut", z: -0.5, y: 0.42, w: 0.75 },
    { label: "Audi", z: -1.25, y: 0.82, w: 0.45, ink: W },
    { label: "Revolut", ...FRONT_END, w: 0.4, ink: W },
    { label: "bp", z: -2.43, y: 0.45, w: 0.22, color: "#00A651" },
  ],
  cadillac: [
    { label: "TWG", z: -0.45, y: 0.42, w: 0.85, side: 1 },
    { label: "TWG", z: -0.45, y: 0.42, w: 0.85, side: -1, ink: W },
    { label: "Cadillac", z: 0.95, y: 0.5, w: 0.42, side: 1 },
    { label: "Cadillac", z: 0.95, y: 0.5, w: 0.42, side: -1, ink: W },
    { label: "Jim Beam", z: 0.6, y: 0.3, w: 0.28, side: 1 },
    { label: "Jim Beam", z: 0.6, y: 0.3, w: 0.28, side: -1, ink: W },
    { label: "Claro", z: 0.8, y: 0.55, w: 0.24 },
    { label: "IFS", ...REAR_END, w: 0.36 },
  ],
}

export function sponsorsFor(teamId: string): SponsorDecal[] {
  return SPONSORS[teamId] ?? []
}
