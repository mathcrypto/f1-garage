"use client"

import { Suspense, useEffect, useState } from "react"
import { findCarModelUrl } from "@/lib/carAssets"
import type { Team } from "@/lib/teams"
import { Car } from "./Car"
import { GltfCar, preloadCarModel } from "./GltfCar"

/**
 * Default: procedural car (sharp parts, liveries, X/Z flaps, clean dismantle).
 * Hunyuan/TRELLIS GLBs are optional experiments — fused AI meshes usually look
 * worse than procedural until remeshed in Blender with named parts.
 * Opt in: NEXT_PUBLIC_AI_CAR=1 + public/models/cars/base.glb
 */
export function TeamCar({ team }: { team: Team }) {
  const aiEnabled = process.env.NEXT_PUBLIC_AI_CAR === "1"
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!aiEnabled) {
      setUrl(null)
      return
    }
    let alive = true
    findCarModelUrl(team.id).then((found) => {
      if (!alive) return
      const next = found ? `${found}?v=livery` : null
      if (next) preloadCarModel(next)
      setUrl(next)
    })
    return () => {
      alive = false
    }
  }, [team.id, aiEnabled])

  if (!aiEnabled || !url) return <Car team={team} />

  return (
    <Suspense fallback={<Car team={team} />}>
      <GltfCar url={url} team={team} />
    </Suspense>
  )
}
