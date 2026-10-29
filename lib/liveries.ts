// Livery designs painted onto the car as a side-projected texture.
// Colours and graphic layout follow each team's 2026 look (approximations —
// not official brand values). Used by the code-built car; the licensed model
// uses lib/zoneLiveries.ts.
export type LiveryDesign = {
  // band: base + sweeping stripes; split: front/rear colour break;
  // fade: longitudinal colour blend; sides: different left/right flanks.
  style: "band" | "split" | "fade" | "sides"
  base: string
  rear?: string
  right?: string
  rightLower?: string
  rightStripe?: string
  lower: string
  stripe: string
  pin: string
  // Extra graphic colours for a richer wrap.
  flash?: string
  halo?: string
  finish: "gloss" | "matte" | "satin"
  wordmark: string
  wordmarkColor: string
}

const LIVERIES: Record<string, LiveryDesign> = {
  // 2026 show-car cue: rosso nose/sidepods, white engine cover, carbon lower, black halo.
  ferrari: {
    style: "split",
    base: "#c8102e",
    rear: "#f2f2f4",
    lower: "#141518",
    stripe: "#ffffff",
    pin: "#ffcc00",
    flash: "#e01830",
    halo: "#121316",
    finish: "gloss",
    wordmark: "FERRARI",
    wordmarkColor: "#c8102e",
  },
  // Petronas teal flow over silver→obsidian fade (W-car silhouette).
  mercedes: {
    style: "fade",
    base: "#d0d5da",
    lower: "#050608",
    stripe: "#00d2be",
    pin: "#00a19b",
    flash: "#8a9299",
    halo: "#f2f2f4",
    finish: "satin",
    wordmark: "MERCEDES",
    wordmarkColor: "#00d2be",
  },
  // Matte navy with scarlet + gold streaks.
  redbull: {
    style: "band",
    base: "#121a3a",
    lower: "#070b1a",
    stripe: "#e10600",
    pin: "#f4c400",
    flash: "#1e3a8a",
    halo: "#f2f2f4",
    finish: "matte",
    wordmark: "RED BULL",
    wordmarkColor: "#f4c400",
  },
  // Papaya with anthracite lower and sky-blue pin (classic McLaren contrast).
  mclaren: {
    style: "band",
    base: "#ff8700",
    lower: "#1c1e22",
    stripe: "#1c1e22",
    pin: "#47c7fc",
    flash: "#ffb347",
    halo: "#f2f2f4",
    finish: "satin",
    wordmark: "McLAREN",
    wordmarkColor: "#1c1e22",
  },
  // British racing green + lime limewire.
  astonmartin: {
    style: "band",
    base: "#003d36",
    lower: "#050807",
    stripe: "#d4e100",
    pin: "#d4e100",
    flash: "#0a6b5c",
    halo: "#f2f2f4",
    finish: "satin",
    wordmark: "ASTON MARTIN",
    wordmarkColor: "#d4e100",
  },
  // Deep alpine blue into BWT pink rear.
  alpine: {
    style: "split",
    base: "#06153f",
    rear: "#ff4f9a",
    lower: "#03060f",
    stripe: "#2a8fd6",
    pin: "#ffffff",
    flash: "#0c2a6e",
    halo: "#f2f2f4",
    finish: "satin",
    wordmark: "ALPINE",
    wordmarkColor: "#ffffff",
  },
  // Royal blue with cyan streak and white pin.
  williams: {
    style: "band",
    base: "#001a4d",
    lower: "#000714",
    stripe: "#00b0e8",
    pin: "#ffffff",
    flash: "#003a7a",
    halo: "#f2f2f4",
    finish: "satin",
    wordmark: "WILLIAMS",
    wordmarkColor: "#ffffff",
  },
  // White upper, Visa-blue lower, scarlet pin.
  racingbulls: {
    style: "band",
    base: "#f7f7f7",
    lower: "#0e2bb8",
    stripe: "#0e2bb8",
    pin: "#e30613",
    flash: "#dfe6ff",
    halo: "#f2f2f4",
    finish: "satin",
    wordmark: "RACING BULLS",
    wordmarkColor: "#0e2bb8",
  },
  // Clean white / black / Toyota-red.
  haas: {
    style: "band",
    base: "#f4f4f4",
    lower: "#111111",
    stripe: "#e10600",
    pin: "#e10600",
    flash: "#ffffff",
    halo: "#f2f2f4",
    finish: "satin",
    wordmark: "HAAS",
    wordmarkColor: "#111111",
  },
  // Titanium silver nose into Audi red rear.
  audi: {
    style: "split",
    base: "#b8bcc2",
    rear: "#bb0a1e",
    lower: "#141516",
    stripe: "#bb0a1e",
    pin: "#ffffff",
    flash: "#8e9399",
    halo: "#f2f2f4",
    finish: "satin",
    wordmark: "AUDI",
    wordmarkColor: "#bb0a1e",
  },
  // Two-tone Cadillac: light left / black right, gold pin.
  cadillac: {
    style: "sides",
    base: "#e8e6e0",
    right: "#0a0a0a",
    lower: "#1c1c1c",
    rightLower: "#050505",
    stripe: "#1a1a1a",
    rightStripe: "#e8e6e0",
    pin: "#c9a227",
    flash: "#f2f0ea",
    halo: "#f2f2f4",
    finish: "satin",
    wordmark: "CADILLAC",
    wordmarkColor: "#c9a227",
  },
}

export const liveryFor = (teamId: string) => LIVERIES[teamId] ?? LIVERIES.ferrari
