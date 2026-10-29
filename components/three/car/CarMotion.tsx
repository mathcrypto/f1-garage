"use client"

import { createContext, useContext } from "react"
import type { Motion } from "@/lib/motion"

export { IDLE, type Motion } from "@/lib/motion"

export const MotionContext = createContext<Motion | null>(null)
// Inside this, <Part> renders a plain group: no picking, explode or labels.
export const PlainParts = createContext(false)

export const useMotion = () => useContext(MotionContext)
