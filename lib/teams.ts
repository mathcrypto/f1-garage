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
  { id: "ferrari", name: "Scuderia Ferrari", car: "SF-26", powerUnit: "Ferrari", code: "FER", ui: "#ff2b2b", livery: { primary: "#c40000", secondary: "#f5f5f5", accent: "#ffcc00" } },
  { id: "mercedes", name: "Mercedes-AMG", car: "W17", powerUnit: "Mercedes", code: "MER", ui: "#27f4d2", livery: { primary: "#d0d5da", secondary: "#00d2be", accent: "#050608" } },
  { id: "redbull", name: "Red Bull Racing", car: "RB22", powerUnit: "Red Bull Ford", code: "RBR", ui: "#5b86ff", livery: { primary: "#121a3a", secondary: "#e10600", accent: "#f4c400" } },
  { id: "mclaren", name: "McLaren", car: "MCL40", powerUnit: "Mercedes", code: "MCL", ui: "#ff8000", livery: { primary: "#ff8700", secondary: "#1c1e22", accent: "#47c7fc" } },
  { id: "astonmartin", name: "Aston Martin", car: "AMR26", powerUnit: "Honda", code: "AMR", ui: "#cedc00", livery: { primary: "#003d36", secondary: "#d4e100", accent: "#050807" } },
  { id: "alpine", name: "Alpine", car: "A526", powerUnit: "Mercedes", code: "ALP", ui: "#ff87bc", livery: { primary: "#06153f", secondary: "#ff4f9a", accent: "#2a8fd6" } },
  { id: "williams", name: "Williams", car: "FW48", powerUnit: "Mercedes", code: "WIL", ui: "#37bedd", livery: { primary: "#001a4d", secondary: "#00b0e8", accent: "#ffffff" } },
  { id: "racingbulls", name: "Racing Bulls", car: "VCARB 03", powerUnit: "Red Bull Ford", code: "RCB", ui: "#6c98ff", livery: { primary: "#f7f7f7", secondary: "#0e2bb8", accent: "#e30613" } },
  { id: "haas", name: "Haas", car: "VF-26", powerUnit: "Ferrari", code: "HAA", ui: "#ff4f4f", livery: { primary: "#f4f4f4", secondary: "#e10600", accent: "#111111" } },
  { id: "audi", name: "Audi", car: "R26", powerUnit: "Audi", code: "AUD", ui: "#ff3b30", livery: { primary: "#bb0a1e", secondary: "#b8bcc2", accent: "#141516" } },
  { id: "cadillac", name: "Cadillac", car: "2026 car", powerUnit: "Ferrari", code: "CAD", ui: "#d4af37", livery: { primary: "#0a0a0a", secondary: "#e8e6e0", accent: "#c9a227" } },
]

export const teamById = (id: string) => TEAMS.find((t) => t.id === id) ?? TEAMS[0]
