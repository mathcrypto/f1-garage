import { PART_IDS } from "./parts"

/**
 * 3D car models for the showroom view; the code-built `Car` handles taking it
 * apart. Used when a file is found (NEXT_PUBLIC_CAR_MODEL=0 turns it off).
 * Tag meshes with a `part` extra (or name them) using ids from `lib/parts.ts`;
 * `part: "split"` marks a one-piece bodywork, kept whole (see GltfCar).
 */

export const CAR_MODEL_BASE = "/models/cars"

const ALIASES: Record<string, string> = {
  frontwing: "front-wing",
  front_wing: "front-wing",
  fw: "front-wing",
  rearwing: "rear-wing",
  rear_wing: "rear-wing",
  rw: "rear-wing",
  enginecover: "engine-cover",
  engine_cover: "engine-cover",
  powerunit: "power-unit",
  power_unit: "power-unit",
  pu: "power-unit",
  frontsuspension: "front-suspension",
  front_suspension: "front-suspension",
  rearsuspension: "rear-suspension",
  rear_suspension: "rear-suspension",
  beamwing: "rear-wing",
  beam_wing: "rear-wing",
  fronttyres: "front-tyres",
  front_tyres: "front-tyres",
  front_tires: "front-tyres",
  reartyres: "rear-tyres",
  rear_tyres: "rear-tyres",
  rear_tires: "rear-tyres",
  sidepod: "sidepods",
  side_pod: "sidepods",
}

export function resolvePartId(raw: string | undefined | null): string | null {
  if (!raw) return null
  const key = raw.trim().toLowerCase().replace(/\s+/g, "-")
  if (PART_IDS.includes(key)) return key
  const compact = key.replace(/-/g, "_")
  const aliased = ALIASES[key] ?? ALIASES[compact] ?? ALIASES[key.replace(/-/g, "")]
  if (aliased) return aliased
  // Exporters often prefix: "Car_front-wing_LOD0"
  for (const id of PART_IDS) {
    if (key.includes(id) || key.includes(id.replace(/-/g, "_"))) return id
  }
  return null
}

/**
 * Candidate URLs to probe for a team (first hit wins). One shared file covers
 * every team via the livery wrap.
 * - NEXT_PUBLIC_CAR_MODEL_URL: the licensed car hosted outside the public repo.
 * - f1-2026.glb: the same file locally (git-ignored, never committed).
 * - {teamId}.glb, ai.glb: optional team-specific or AI-generated meshes.
 */
export function carModelCandidates(teamId: string): string[] {
  const hosted = process.env.NEXT_PUBLIC_CAR_MODEL_URL
  return [
    ...(hosted ? [hosted] : []),
    `${CAR_MODEL_BASE}/f1-2026.glb`,
    `${CAR_MODEL_BASE}/${teamId}.glb`,
    `${CAR_MODEL_BASE}/ai.glb`,
  ]
}

/** HEAD/GET probe — returns the first existing glTF URL, or null. */
export async function findCarModelUrl(teamId: string): Promise<string | null> {
  for (const url of carModelCandidates(teamId)) {
    try {
      const r = await fetch(url, { method: "HEAD" })
      if (r.ok) return url
      // Some static hosts reject HEAD — try a tiny ranged GET.
      if (r.status === 405 || r.status === 501) {
        const g = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" } })
        if (g.ok || g.status === 206) return url
      }
    } catch {
      /* try next */
    }
  }
  return null
}
