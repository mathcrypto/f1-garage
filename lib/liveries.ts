// Livery designs, painted onto the car as a side-projected texture, following
// each team's 2026 launch livery (colours and where they sit). Official logos
// aren't bundled; a team's own logo files can be dropped into public/logos.
export type LiveryDesign = {
  // band: one base colour with a sweeping stripe; split: front and rear halves
  // in two colours; fade: base colour fading to the lower colour toward the
  // rear; sides: a different colour on each flank (base left, right right).
  style: "band" | "split" | "fade" | "sides"
  base: string
  rear?: string
  right?: string
  rightLower?: string
  rightStripe?: string
  lower: string
  stripe: string
  pin: string
  finish: "gloss" | "matte"
  wordmark: string
  wordmarkColor: string
}

export const LIVERIES: Record<string, LiveryDesign> = {
  // Nearly all Rosso Corsa, black accents dropped, white touches as in 2016, thin yellow pinstripes.
  ferrari: { style: "band", base: "#d10000", lower: "#9e0000", stripe: "#ffffff", pin: "#ffd200", finish: "gloss", wordmark: "FERRARI", wordmarkColor: "#ffffff" },
  // Silver into deep black, joined by a Petronas green flow line.
  mercedes: { style: "fade", base: "#c4c9ce", lower: "#0a0a0c", stripe: "#00a19b", pin: "#00a19b", finish: "gloss", wordmark: "MERCEDES", wordmarkColor: "#00a19b" },
  // Matte navy with red and yellow streaks.
  redbull: { style: "band", base: "#1b2650", lower: "#0f1630", stripe: "#e10600", pin: "#ffcc00", finish: "matte", wordmark: "RED BULL", wordmarkColor: "#ffcc00" },
  // Papaya and anthracite.
  mclaren: { style: "band", base: "#ff8000", lower: "#2b2d31", stripe: "#2b2d31", pin: "#47c7fc", finish: "gloss", wordmark: "McLAREN", wordmarkColor: "#2b2d31" },
  // British racing green with lime.
  astonmartin: { style: "band", base: "#00594f", lower: "#0b0b0b", stripe: "#cedc00", pin: "#cedc00", finish: "gloss", wordmark: "ASTON MARTIN", wordmarkColor: "#cedc00" },
  // Midnight blue washed into BWT pink.
  alpine: { style: "split", base: "#0b1b4d", rear: "#ff5fa2", lower: "#0b0b0b", stripe: "#2173b8", pin: "#ffffff", finish: "gloss", wordmark: "ALPINE", wordmarkColor: "#ffffff" },
  williams: { style: "band", base: "#012564", lower: "#000d26", stripe: "#00a0de", pin: "#ffffff", finish: "gloss", wordmark: "WILLIAMS", wordmarkColor: "#ffffff" },
  // Mostly white with blue accents along the chassis.
  racingbulls: { style: "band", base: "#f4f4f4", lower: "#1634cc", stripe: "#1634cc", pin: "#e30613", finish: "gloss", wordmark: "RACING BULLS", wordmarkColor: "#1634cc" },
  // White, black and red, with more Toyota red.
  haas: { style: "band", base: "#f2f2f2", lower: "#151515", stripe: "#e10600", pin: "#e10600", finish: "gloss", wordmark: "HAAS", wordmarkColor: "#151515" },
  // Titanium silver and red.
  audi: { style: "split", base: "#a9adb3", rear: "#c8001e", lower: "#1d1e21", stripe: "#c8001e", pin: "#ffffff", finish: "matte", wordmark: "AUDI", wordmarkColor: "#c8001e" },
  // Two-sided: greyish white on the left flank, black on the right.
  cadillac: { style: "sides", base: "#e4e4e1", right: "#0d0d0d", lower: "#1a1a1a", rightLower: "#0d0d0d", stripe: "#0d0d0d", rightStripe: "#e4e4e1", pin: "#c9a14a", finish: "gloss", wordmark: "CADILLAC", wordmarkColor: "#c9a14a" },
}

export const liveryFor = (teamId: string) => LIVERIES[teamId] ?? LIVERIES.ferrari
