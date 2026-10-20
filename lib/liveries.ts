// Livery designs, painted onto the car as a side-projected texture. They're
// original designs in each team's colours. Official logos aren't bundled;
// a team's own logo files can be dropped into public/logos (see the README there).
export type LiveryDesign = {
  // band: one base colour with a sweeping stripe; split: front and rear halves
  // in two colours; fade: base colour fading to the lower colour toward the rear.
  style: "band" | "split" | "fade"
  base: string
  rear?: string
  lower: string
  stripe: string
  pin: string
  finish: "gloss" | "matte"
  wordmark: string
  wordmarkColor: string
}

export const LIVERIES: Record<string, LiveryDesign> = {
  ferrari: { style: "band", base: "#d40000", lower: "#141414", stripe: "#ffffff", pin: "#ffd200", finish: "gloss", wordmark: "FERRARI", wordmarkColor: "#ffffff" },
  mercedes: { style: "fade", base: "#c9ced3", lower: "#0b0b0d", stripe: "#00d2be", pin: "#00d2be", finish: "gloss", wordmark: "MERCEDES", wordmarkColor: "#00d2be" },
  redbull: { style: "band", base: "#1b2650", lower: "#0f1630", stripe: "#e10600", pin: "#ffcc00", finish: "matte", wordmark: "RED BULL", wordmarkColor: "#ffcc00" },
  mclaren: { style: "band", base: "#ff8000", lower: "#121212", stripe: "#121212", pin: "#47c7fc", finish: "gloss", wordmark: "McLAREN", wordmarkColor: "#121212" },
  astonmartin: { style: "band", base: "#00594f", lower: "#0b0b0b", stripe: "#cedc00", pin: "#cedc00", finish: "gloss", wordmark: "ASTON MARTIN", wordmarkColor: "#cedc00" },
  alpine: { style: "split", base: "#0a1e5a", rear: "#ff87bc", lower: "#0b0b0b", stripe: "#2173b8", pin: "#ffffff", finish: "gloss", wordmark: "ALPINE", wordmarkColor: "#ffffff" },
  williams: { style: "band", base: "#012564", lower: "#000d26", stripe: "#00a0de", pin: "#ffffff", finish: "gloss", wordmark: "WILLIAMS", wordmarkColor: "#ffffff" },
  racingbulls: { style: "band", base: "#f4f4f4", lower: "#1634cc", stripe: "#e30613", pin: "#1634cc", finish: "gloss", wordmark: "RACING BULLS", wordmarkColor: "#1634cc" },
  haas: { style: "band", base: "#f2f2f2", lower: "#151515", stripe: "#e10600", pin: "#e10600", finish: "gloss", wordmark: "HAAS", wordmarkColor: "#151515" },
  audi: { style: "fade", base: "#bfc3c8", lower: "#1d1e21", stripe: "#ff1e1e", pin: "#ff1e1e", finish: "matte", wordmark: "AUDI", wordmarkColor: "#ff1e1e" },
  cadillac: { style: "split", base: "#0f0f0f", rear: "#ededed", lower: "#0b0b0b", stripe: "#c9a14a", pin: "#c9a14a", finish: "gloss", wordmark: "CADILLAC", wordmarkColor: "#c9a14a" },
}

export const liveryFor = (teamId: string) => LIVERIES[teamId] ?? LIVERIES.ferrari
