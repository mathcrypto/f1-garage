// The 2026 grid. Colours drive the car livery; they are approximations of each
// team's palette, not official brand values. `ui` is a variant bright enough
// to read as text and accents on the dark interface.
export type Team = {
  id: string
  name: string
  car: string
  powerUnit: string
  // Three-letter code for timing screens.
  code: string
  ui: string
  livery: { primary: string; secondary: string; accent: string }
}

export const TEAMS: Team[] = [
  { id: "ferrari", name: "Scuderia Ferrari", car: "SF-26", powerUnit: "Ferrari", code: "FER", ui: "#ff2b2b", livery: { primary: "#d10000", secondary: "#ffffff", accent: "#d10000" } },
  { id: "mercedes", name: "Mercedes-AMG", car: "W17", powerUnit: "Mercedes", code: "MER", ui: "#27f4d2", livery: { primary: "#0a0a0c", secondary: "#00a19c", accent: "#0a0a0c" } },
  { id: "redbull", name: "Red Bull Racing", car: "RB22", powerUnit: "Red Bull Ford", code: "RBR", ui: "#5b86ff", livery: { primary: "#1e2a52", secondary: "#e10600", accent: "#ffcc00" } },
  { id: "mclaren", name: "McLaren", car: "MCL40", powerUnit: "Mercedes", code: "MCL", ui: "#ff8000", livery: { primary: "#ff8000", secondary: "#2b2d31", accent: "#ff8000" } },
  { id: "astonmartin", name: "Aston Martin", car: "AMR26", powerUnit: "Honda", code: "AMR", ui: "#cedc00", livery: { primary: "#00594f", secondary: "#cedc00", accent: "#0b0b0b" } },
  { id: "alpine", name: "Alpine", car: "A526", powerUnit: "Mercedes", code: "ALP", ui: "#ff87bc", livery: { primary: "#0a1e5a", secondary: "#ff87bc", accent: "#2173b8" } },
  { id: "williams", name: "Williams", car: "FW48", powerUnit: "Mercedes", code: "WIL", ui: "#37bedd", livery: { primary: "#012564", secondary: "#00a0de", accent: "#ffffff" } },
  { id: "racingbulls", name: "Racing Bulls", car: "VCARB 03", powerUnit: "Red Bull Ford", code: "RCB", ui: "#6c98ff", livery: { primary: "#f5f5f5", secondary: "#1634cc", accent: "#1634cc" } },
  { id: "haas", name: "Haas", car: "VF-26", powerUnit: "Ferrari", code: "HAA", ui: "#ff4f4f", livery: { primary: "#f2f2f2", secondary: "#e10600", accent: "#1a1a1a" } },
  { id: "audi", name: "Audi", car: "R26", powerUnit: "Audi", code: "AUD", ui: "#ff3b30", livery: { primary: "#c8001e", secondary: "#a9adb3", accent: "#1d1e21" } },
  { id: "cadillac", name: "Cadillac", car: "2026 car", powerUnit: "Ferrari", code: "CAD", ui: "#d4af37", livery: { primary: "#0f0f0f", secondary: "#f0f0f0", accent: "#c9a14a" } },
]

export const teamById = (id: string) => TEAMS.find((t) => t.id === id) ?? TEAMS[0]
