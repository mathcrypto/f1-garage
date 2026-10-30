// Team colours painted onto the licensed 3D car by zone (nose tip, cockpit,
// airbox, engine cover, sidepods, flow line, lower body).
//
// Each design follows the team's 2026 launch livery as described at launch
// (Sky Sports, Crash.net, Autosport, Red Bull, Motorsport.com, Top Gear) and,
// for Red Bull, the team's launch photo. Only placements a source describes are
// painted; everything else stays in the base colour or carbon. Hex values are
// approximations, not official brand colours. Sponsor wordmarks are placed by
// lib/sponsors.ts.

export type ZoneLivery = {
  finish: "gloss" | "satin" | "matte"
  /** Main body colour. */
  base: string
  /** Lower bodywork below the sidepod line (often carbon or a darker tone). */
  lower: string
  /** Second flank colour: left side uses `base`, right side this. */
  right?: string
  /** Body colour at the rear: `base` at the nose fades to this at the gearbox. */
  fadeTo?: string
  noseTip?: string
  cockpit?: string
  airbox?: string
  cover?: string
  /** Paint `cover` on the engine cover's flanks only, not its spine. */
  coverSides?: boolean
  sidepod?: string
  /** Sweeping line along the flank from nose to tail. */
  stripe?: string
  stripeWidth?: number
  /** Mottled pattern over the base (Red Bull's 2026 jacquard). */
  speckle?: string
  /** Darker strakes over the sidepods (McLaren's tiger-stripe carbon). */
  tiger?: string
  /** Side-facing surfaces behind the nose in this colour; tops keep `base`. */
  flank?: string
  /** Flash low on the rear flank, ahead of the rear wheel. */
  rearFlash?: string
  halo?: string
  /** Where the nose-tip colour starts along the car (default 2.1; tip at 2.7). */
  noseTipFrom?: number
  /** Raise the lower-body line towards the rear (metres). */
  lowerRise?: number
  /** Wing endplates in livery colour; carbon when unset. */
  wings?: string
}

const CARBON = "#111215"

const ZONE_LIVERIES: Record<string, ZoneLivery> = {
  // Gloss royal blue (a return to gloss) with a darker navy jacquard pattern; yellow
  // nose tip and airbox, red on the engine-cover flanks, black halo, carbon lower
  // sidepods, blue endplates. Yellow, red and navy sampled from the launch photo.
  redbull: {
    finish: "gloss",
    base: "#1a2f8a",
    lower: CARBON,
    lowerRise: 0.14,
    noseTip: "#fca608",
    noseTipFrom: 1.95,
    airbox: "#fca608",
    cover: "#d6080a",
    coverSides: true,
    halo: CARBON,
    speckle: "#081b5a",
    wings: "#1a2f8a",
  },
  // Almost all red, black accents removed, extra white around the cockpit and
  // airbox running back over the engine cover, subtle yellow pinstripes.
  ferrari: {
    finish: "gloss",
    base: "#d0091a",
    lower: "#b30716",
    cockpit: "#f4f4f2",
    airbox: "#f4f4f2",
    cover: "#f4f4f2",
    stripe: "#ffd400",
    stripeWidth: 0.012,
  },
  // Silver at the front flowing to black at the rear, with a turquoise
  // (Petronas) line from nose to tail.
  mercedes: {
    finish: "satin",
    base: "#c7ccd1",
    fadeTo: "#0c0d10",
    lower: "#0c0d10",
    stripe: "#00d2be",
    stripeWidth: 0.03,
  },
  // Papaya with anthracite sidepod sides, a papaya flash low on the rear flank,
  // black nose tip, airbox and halo, papaya endplates. Papaya sampled from the
  // launch photo.
  mclaren: {
    finish: "gloss",
    base: "#f78d01",
    lower: "#151619",
    flank: "#1c1d21",
    rearFlash: "#f78d01",
    noseTip: "#151619",
    noseTipFrom: 2.5,
    airbox: "#151619",
    halo: "#151619",
    wings: "#f78d01",
  },
  // British Racing Green, satin finish.
  // From the AMR26 launch photo: green body, black sidepod flanks, a thin lime
  // line along the sidepod shoulder, black airbox and halo, green endplates.
  astonmartin: {
    finish: "satin",
    base: "#075a4b",
    lower: "#0b0d0e",
    flank: "#0d0f10",
    stripe: "#c8e400",
    stripeWidth: 0.012,
    airbox: "#0d0f10",
    halo: "#0d0f10",
    wings: "#075a4b",
  },
  // Blue and pink as in recent seasons; BWT pink on the sidepods.
  // From photos of the A526: bright blue body; BWT pink on the nose, halo,
  // sidepod block and wing endplates.
  alpine: {
    finish: "gloss",
    base: "#1d63d6",
    lower: CARBON,
    sidepod: "#f59ac8",
    noseTip: "#f59ac8",
    noseTipFrom: 1.3,
    halo: "#f59ac8",
    wings: "#f59ac8",
  },
  // Dark blue and black, light blue and white on the sidepods, white on the
  // engine cover and wings.
  williams: {
    finish: "gloss",
    base: "#0a1f5c",
    lower: CARBON,
    sidepod: "#3fa9f5",
    cover: "#f4f6f8",
    stripe: "#f4f6f8",
    stripeWidth: 0.025,
    wings: "#f4f6f8",
  },
  // Matt white base with sharper blue detailing along the bodywork.
  racingbulls: {
    finish: "matte",
    base: "#f2f3f5",
    lower: "#1534c8",
    stripe: "#1534c8",
    stripeWidth: 0.035,
  },
  // White and red (Toyota Gazoo Racing partnership), black lower body.
  // From the VF-26 side photo: white, a bold red flash along the sidepod top,
  // red airbox, black lower sidepods, white endplates.
  haas: {
    finish: "gloss",
    base: "#f4f4f4",
    lower: "#121212",
    lowerRise: 0.1,
    stripe: "#e5141b",
    stripeWidth: 0.05,
    airbox: "#e5141b",
    wings: "#f4f4f4",
  },
  // Titanium silver, black engine cover, red detailing underneath.
  // From R26 photos: titanium silver front, red sidepods, rear flank and nose
  // tip, black engine cover, airbox and halo, red endplates.
  audi: {
    finish: "satin",
    base: "#c4c7cb",
    lower: "#0f1012",
    sidepod: "#e0112b",
    rearFlash: "#e0112b",
    noseTip: "#e0112b",
    noseTipFrom: 2.35,
    cover: "#141516",
    airbox: "#141516",
    halo: "#141516",
    wings: "#e0112b",
  },
  // Two-sided: black on the left flank, white on the right.
  cadillac: {
    finish: "gloss",
    base: "#0d0d0e",
    right: "#f0efeb",
    lower: CARBON,
  },
}

export function zoneLiveryFor(teamId: string): ZoneLivery {
  return ZONE_LIVERIES[teamId] ?? ZONE_LIVERIES.redbull
}
