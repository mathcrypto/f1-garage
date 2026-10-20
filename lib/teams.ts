// The 2026 grid. Colours drive the car livery; they are approximations of each
// team's palette, not official brand values.
export type Team = {
  id: string
  name: string
  car: string
  powerUnit: string
  livery: { primary: string; secondary: string; accent: string }
}

export const TEAMS: Team[] = [
  { id: "ferrari", name: "Scuderia Ferrari", car: "SF-26", powerUnit: "Ferrari", livery: { primary: "#dc0000", secondary: "#ffffff", accent: "#1a1a1a" } },
  { id: "mercedes", name: "Mercedes-AMG", car: "W17", powerUnit: "Mercedes", livery: { primary: "#c8ccce", secondary: "#00a19c", accent: "#111111" } },
  { id: "redbull", name: "Red Bull Racing", car: "RB22", powerUnit: "Red Bull Ford", livery: { primary: "#1e2a52", secondary: "#e10600", accent: "#ffcc00" } },
  { id: "mclaren", name: "McLaren", car: "MCL40", powerUnit: "Mercedes", livery: { primary: "#ff8000", secondary: "#1b1b1b", accent: "#47c7fc" } },
  { id: "astonmartin", name: "Aston Martin", car: "AMR26", powerUnit: "Honda", livery: { primary: "#00594f", secondary: "#cedc00", accent: "#0b0b0b" } },
  { id: "alpine", name: "Alpine", car: "A526", powerUnit: "Mercedes", livery: { primary: "#0a1e5a", secondary: "#ff87bc", accent: "#2173b8" } },
  { id: "williams", name: "Williams", car: "FW48", powerUnit: "Mercedes", livery: { primary: "#012564", secondary: "#00a0de", accent: "#ffffff" } },
  { id: "racingbulls", name: "Racing Bulls", car: "VCARB 03", powerUnit: "Red Bull Ford", livery: { primary: "#f5f5f5", secondary: "#1634cc", accent: "#e30613" } },
  { id: "haas", name: "Haas", car: "VF-26", powerUnit: "Ferrari", livery: { primary: "#f2f2f2", secondary: "#e10600", accent: "#1a1a1a" } },
  { id: "audi", name: "Audi", car: "R26", powerUnit: "Audi", livery: { primary: "#2b2b2b", secondary: "#c0c0c0", accent: "#ff1e1e" } },
  { id: "cadillac", name: "Cadillac", car: "2026 car", powerUnit: "Ferrari", livery: { primary: "#0f0f0f", secondary: "#f0f0f0", accent: "#c9a14a" } },
]

export const teamById = (id: string) => TEAMS.find((t) => t.id === id) ?? TEAMS[0]
