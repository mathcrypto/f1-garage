"use client"

import { useEffect, useMemo, useState } from "react"
import * as THREE from "three"
import type { LiveryDesign } from "@/lib/liveries"

// The livery is painted in side view: canvas x runs along the car (z) and
// canvas y is height (y). Body geometry gets matching planar UVs, so the same
// paint scheme flows continuously across nose, chassis, sidepods and cover.
const Z_MIN = -3, Z_LEN = 6, Y_MAX = 1.25
const W = 2048, H = 512

export function sideUV(geometry: THREE.BufferGeometry) {
  const pos = geometry.attributes.position
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getZ(i) - Z_MIN) / Z_LEN
    uv[i * 2 + 1] = pos.getY(i) / Y_MAX
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2))
  return geometry
}

const X = (z: number) => ((z - Z_MIN) / Z_LEN) * W
const Y = (y: number) => (1 - y / Y_MAX) * H

export function paintLivery(d: LiveryDesign) {
  const c = document.createElement("canvas")
  c.width = W
  c.height = H
  const g = c.getContext("2d")!

  // Base coat
  if (d.style === "split" && d.rear) {
    g.fillStyle = d.rear
    g.fillRect(0, 0, W, H)
    g.fillStyle = d.base
    g.beginPath()
    g.moveTo(W, 0)
    g.lineTo(X(0.1), 0)
    g.bezierCurveTo(X(-0.3), Y(0.6), X(-0.1), Y(0.45), X(0.3), Y(0))
    g.lineTo(W, H)
    g.closePath()
    g.fill()
  } else if (d.style === "fade") {
    const grad = g.createLinearGradient(X(1.6), 0, X(-1.6), 0)
    grad.addColorStop(0, d.base)
    grad.addColorStop(1, d.lower)
    g.fillStyle = grad
    g.fillRect(0, 0, W, H)
  } else {
    g.fillStyle = d.base
    g.fillRect(0, 0, W, H)
  }

  // Dark lower body: rises gently from the nose and dips toward the diffuser.
  g.fillStyle = d.lower
  g.beginPath()
  g.moveTo(X(2.8), Y(0.28))
  g.bezierCurveTo(X(1.6), Y(0.3), X(0.8), Y(0.34), X(0.3), Y(0.37))
  g.bezierCurveTo(X(-0.6), Y(0.41), X(-1.4), Y(0.36), X(-2.6), Y(0.32))
  g.lineTo(X(-2.6), H)
  g.lineTo(X(2.8), H)
  g.closePath()
  g.fill()

  // Signature sweep from the nose, over the sidepod, up the engine cover.
  const sweep = (offset: number, width: number, color: string) => {
    g.strokeStyle = color
    g.lineWidth = width
    g.lineCap = "round"
    g.beginPath()
    g.moveTo(X(2.55), Y(0.26 + offset))
    g.bezierCurveTo(X(1.4), Y(0.36 + offset), X(0.6), Y(0.5 + offset), X(-0.2), Y(0.58 + offset))
    g.bezierCurveTo(X(-0.9), Y(0.64 + offset), X(-1.6), Y(0.7 + offset), X(-2.2), Y(0.62 + offset))
    g.stroke()
  }
  sweep(0, 22, d.stripe)
  sweep(-0.04, 5, d.pin)

  // Painted-on ambient occlusion toward the floor, for depth.
  const ao = g.createLinearGradient(0, Y(0.42), 0, Y(0.12))
  ao.addColorStop(0, "rgba(0,0,0,0)")
  ao.addColorStop(1, "rgba(0,0,0,0.35)")
  g.fillStyle = ao
  g.fillRect(0, Y(0.42), W, Y(0.12) - Y(0.42))

  // Fine panel lines around the cockpit and sidepod inlet.
  g.strokeStyle = "rgba(0,0,0,0.25)"
  g.lineWidth = 2
  for (const z of [1.15, 0.42, -0.36]) {
    g.beginPath()
    g.moveTo(X(z), Y(0.95))
    g.lineTo(X(z), Y(0.2))
    g.stroke()
  }

  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function paintWordmark(text: string, color: string, sub?: string) {
  const c = document.createElement("canvas")
  c.width = 1024
  c.height = 256
  const g = c.getContext("2d")!
  g.clearRect(0, 0, c.width, c.height)
  let size = 170
  g.font = `italic 900 ${size}px "Titillium Web", sans-serif`
  const fit = 940 / g.measureText(text).width
  if (fit < 1) size = Math.floor(size * fit)
  g.font = `italic 900 ${size}px "Titillium Web", sans-serif`
  g.fillStyle = color
  g.textAlign = "center"
  g.textBaseline = "middle"
  g.fillText(text, 512, sub ? 108 : 128)
  if (sub) {
    g.font = `700 48px "Titillium Web", sans-serif`
    g.globalAlpha = 0.85
    g.fillText(sub, 512, 210)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// Wordmark texture, repainted once the display font has loaded.
export function useWordmark(text: string, color: string, sub?: string) {
  const [fontReady, setFontReady] = useState(false)
  useEffect(() => {
    let alive = true
    document.fonts?.load(`italic 900 100px "Titillium Web"`).finally(() => alive && setFontReady(true))
    return () => { alive = false }
  }, [])
  const tex = useMemo(() => paintWordmark(text, color, sub), [text, color, sub, fontReady])
  useEffect(() => () => tex.dispose(), [tex])
  return tex
}

type LogoManifest = Record<string, { main?: string; sponsor?: string }>
let manifest: Promise<LogoManifest> | null = null

// Optional team-supplied logos listed in public/logos/manifest.json.
export function useTeamLogos(teamId: string) {
  const [logos, setLogos] = useState<{ main?: THREE.Texture; sponsor?: THREE.Texture }>({})
  useEffect(() => {
    let alive = true
    setLogos({})
    manifest ??= fetch("/logos/manifest.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
    manifest.then((m: LogoManifest) => {
      const entry = m[teamId]
      if (!entry) return
      const loader = new THREE.TextureLoader()
      const load = (path?: string) =>
        path
          ? new Promise<THREE.Texture | undefined>((res) =>
              loader.load(`/logos/${path}`, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; res(t) }, undefined, () => res(undefined)),
            )
          : Promise.resolve(undefined)
      Promise.all([load(entry.main), load(entry.sponsor)]).then(([main, sponsor]) => alive && setLogos({ main, sponsor }))
    })
    return () => { alive = false }
  }, [teamId])
  return logos
}
