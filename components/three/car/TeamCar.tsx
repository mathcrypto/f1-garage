"use client"

import { Suspense, useEffect, useState } from "react"
import { findCarModelUrl } from "@/lib/carAssets"
import { useGarage } from "@/lib/store"
import type { Team } from "@/lib/teams"
import { Car } from "./Car"
import { GltfCar, preloadCarModel } from "./GltfCar"

/**
 * Two cars, each where it looks best:
 * - Showroom: the AI-generated mesh (public/models/cars/, see README there) in
 *   the team livery. It is a single outer surface, so it looks realistic whole
 *   but would come apart as hollow shells.
 * - Engineering: the code-built car with solid parts, used whenever the car is
 *   taken apart, a part is selected or the X-ray is on.
 * Opt out of the AI mesh with NEXT_PUBLIC_AI_CAR=0; without a mesh file the
 * code-built car is always used.
 */
export function TeamCar({ team }: { team: Team }) {
  const aiEnabled = process.env.NEXT_PUBLIC_AI_CAR !== "0"
  const [url, setUrl] = useState<string | null>(null)
  const engineering = useGarage((s) => s.exploded || s.selected !== null || s.technical)

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

  if (!url || engineering) return <Car team={team} />

  return (
    <Suspense fallback={<Car team={team} />}>
      <GltfCar url={url} team={team} />
    </Suspense>
  )
}
