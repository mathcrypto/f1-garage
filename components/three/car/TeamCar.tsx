"use client"

import { Suspense, useEffect, useState } from "react"
import { findCarModelUrl } from "@/lib/carAssets"
import type { Team } from "@/lib/teams"
import { Car } from "./Car"
import { GltfCar, preloadCarModel } from "./GltfCar"

/**
 * The car in the garage and on track: the licensed 3D model (see
 * public/models/README.md) in the team livery. The code-built car is only a
 * fallback when no model file is available (e.g. a clone of the public repo)
 * or NEXT_PUBLIC_CAR_MODEL=0.
 */
export function TeamCar({ team }: { team: Team }) {
  const modelEnabled = process.env.NEXT_PUBLIC_CAR_MODEL !== "0"
  // undefined while probing for the file, null when there is none.
  const [url, setUrl] = useState<string | null | undefined>(modelEnabled ? undefined : null)

  useEffect(() => {
    if (!modelEnabled) {
      setUrl(null)
      return
    }
    let alive = true
    findCarModelUrl(team.id).then((found) => {
      if (!alive) return
      const next = found ? `${found}${found.includes("?") ? "&" : "?"}v=livery` : null
      if (next) preloadCarModel(next)
      setUrl(next)
    })
    return () => {
      alive = false
    }
  }, [team.id, modelEnabled])

  if (url === undefined) return null
  if (url === null) return <Car team={team} />

  return (
    <Suspense fallback={null}>
      <GltfCar url={url} team={team} />
    </Suspense>
  )
}
