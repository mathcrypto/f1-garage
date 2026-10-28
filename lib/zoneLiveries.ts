// Team colours painted onto the licensed 3D car by zone (nose tip, cockpit,
// airbox, engine cover, sidepods, flow line, lower body).
//
// Each design follows the team's 2026 launch livery as described at launch
// (Sky Sports, Crash.net, Autosport, Red Bull, Motorsport.com, Top Gear) and,
// for Red Bull, the team's launch photo. Only placements a source describes are
// painted; everything else stays in the base colour or carbon. Hex values are
// approximations, not official brand colours. Sponsor and team logos are not
// reproduced.

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
  /** Lighter mottled pattern over the base (Red Bull's 2026 jacquard). */
  speckle?: string
  /** Darker strakes over the sidepods (McLaren's tiger-stripe carbon). */
  tiger?: string
  /** Wing endplates in livery colour; carbon when unset. */
  wings?: string
}

const CARBON = "#111215"

export const ZONE_LIVERIES: Record<string, ZoneLivery> = {
  // Gloss blue (a return to gloss) with a lighter blue jacquard pattern; yellow
  // nose tip and airbox, red bull graphic on the engine cover, blue endplates.
  redbull: {
    finish: "gloss",
    base: "#1b2a6e",
    lower: CARBON,
    noseTip: "#f5b414",
    airbox: "#f5b414",
    cover: "#c8102e",
    coverSides: true,
    speckle: "#3d5fd6",
    wings: "#1b2a6e",
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
  // Papaya over anthracite, papaya wrapping round the cockpit, tiger-stripe
  // carbon effect on the sidepods.
  mclaren: {
    finish: "gloss",
    base: "#ff8000",
    lower: "#26292e",
    cockpit: "#ff8000",
    tiger: "#26292e",
  },
  // British Racing Green, satin finish.
  astonmartin: {
    finish: "satin",
    base: "#00463c",
    lower: "#0b100f",
  },
  // Blue and pink as in recent seasons; BWT pink on the sidepods.
  alpine: {
    finish: "gloss",
    base: "#0b2c8c",
    lower: CARBON,
    sidepod: "#ff5aa5",
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
  haas: {
    finish: "gloss",
    base: "#f2f2f2",
    lower: "#141414",
    stripe: "#e10600",
    stripeWidth: 0.04,
  },
  // Titanium silver, black engine cover, red detailing underneath.
  audi: {
    finish: "satin",
    base: "#a9adb3",
    lower: "#c8102e",
    cover: "#141516",
  },
  // Two-sided black and white.
  cadillac: {
    finish: "gloss",
    base: "#f0efeb",
    right: "#0d0d0e",
    lower: CARBON,
  },
}

export function zoneLiveryFor(teamId: string): ZoneLivery {
  return ZONE_LIVERIES[teamId] ?? ZONE_LIVERIES.redbull
}
