"use client"

import { useEffect, useMemo, useState } from "react"
import type { SponsorAtlas } from "./zonePaint"
import * as THREE from "three"
import type { LiveryDesign } from "@/lib/liveries"

// Side-projected wrap: canvas x = car length (z), canvas y = height.
// Both flanks live in one texture (left lower half, right mirrored upper half).
const Z_MIN = -3, Z_LEN = 6, Y_MAX = 1.25
const W = 2048, H = 512

/** Map a car-space point to livery UV (u along length, v half-height per flank). */
function sideUvAt(x: number, y: number, z: number): [number, number] {
  const h = Math.min(1, Math.max(0, y / Y_MAX)) * 0.5
  return [(z - Z_MIN) / Z_LEN, x >= 0 ? h : 1 - h]
}

/** Write side-projected UVs from local positions (procedural car). */
export function sideUV(geometry: THREE.BufferGeometry) {
  const pos = geometry.attributes.position
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const [u, v] = sideUvAt(pos.getX(i), pos.getY(i), pos.getZ(i))
    uv[i * 2] = u
    uv[i * 2 + 1] = v
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2))
  return geometry
}

const X = (z: number) => ((z - Z_MIN) / Z_LEN) * W
const Y = (y: number) => (1 - y / Y_MAX) * H

function hexRgb(hex: string) {
  const h = hex.replace("#", "")
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function mixHex(a: string, b: string, t: number) {
  const A = hexRgb(a), B = hexRgb(b)
  const r = Math.round(A.r + (B.r - A.r) * t)
  const g = Math.round(A.g + (B.g - A.g) * t)
  const bl = Math.round(A.b + (B.b - A.b) * t)
  return `rgb(${r},${g},${bl})`
}

export function paintLivery(d: LiveryDesign) {
  const c = document.createElement("canvas")
  c.width = W
  c.height = H * 2
  const g = c.getContext("2d")!
  g.setTransform(1, 0, 0, 1, 0, H)
  paintSide(g, d)
  g.setTransform(1, 0, 0, -1, 0, H)
  paintSide(g, d.style === "sides" && d.right
    ? { ...d, base: d.right, lower: d.rightLower ?? d.lower, stripe: d.rightStripe ?? d.stripe, flash: d.flash }
    : d)
  g.setTransform(1, 0, 0, 1, 0, 0)

  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 16
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  return t
}

function paintSide(g: CanvasRenderingContext2D, d: LiveryDesign) {
  const flash = d.flash ?? d.base
  const halo = d.halo ?? d.lower

  // ── Base coat with subtle vertical pearlescent shift ──────────────────────
  if (d.style === "split" && d.rear) {
    // Front/sidepods in base; engine-cover spine in rear (Ferrari 2026 white top).
    const frontGrad = g.createLinearGradient(0, 0, 0, H)
    frontGrad.addColorStop(0, mixHex(d.base, "#ffffff", 0.1))
    frontGrad.addColorStop(0.5, d.base)
    frontGrad.addColorStop(1, mixHex(d.base, "#000000", 0.18))
    g.fillStyle = frontGrad
    g.fillRect(0, 0, W, H)

    const rearGrad = g.createLinearGradient(0, 0, 0, H)
    rearGrad.addColorStop(0, mixHex(d.rear, "#ffffff", 0.12))
    rearGrad.addColorStop(0.55, d.rear)
    rearGrad.addColorStop(1, mixHex(d.rear, "#000000", 0.12))
    g.fillStyle = rearGrad
    g.beginPath()
    g.moveTo(X(-0.15), 0)
    g.bezierCurveTo(X(-0.55), Y(0.35), X(-0.85), Y(0.55), X(-1.15), Y(0.72))
    g.bezierCurveTo(X(-1.55), Y(0.88), X(-2.0), Y(0.95), X(-2.85), Y(0.98))
    g.lineTo(X(-2.85), 0)
    g.closePath()
    g.fill()

    // Soft blueprint hatch on the white spine (show-car tech graphic).
    if (d.rear.toLowerCase().startsWith("#f") || d.rear.toLowerCase().startsWith("#e")) {
      g.save()
      g.beginPath()
      g.moveTo(X(-0.2), 0)
      g.bezierCurveTo(X(-0.6), Y(0.4), X(-1.2), Y(0.7), X(-2.85), Y(0.95))
      g.lineTo(X(-2.85), 0)
      g.closePath()
      g.clip()
      g.strokeStyle = "rgba(40,90,160,0.14)"
      g.lineWidth = 1
      for (let i = 0; i < 28; i++) {
        const z = -0.3 - i * 0.09
        g.beginPath()
        g.moveTo(X(z), Y(0.15))
        g.lineTo(X(z - 0.35), Y(1.05))
        g.stroke()
      }
      g.strokeStyle = "rgba(40,90,160,0.08)"
      for (let i = 0; i < 12; i++) {
        const y = 0.2 + i * 0.07
        g.beginPath()
        g.moveTo(X(-0.25), Y(y))
        g.lineTo(X(-2.8), Y(y + 0.05))
        g.stroke()
      }
      g.restore()
    }
  } else if (d.style === "fade") {
    const grad = g.createLinearGradient(X(2.2), 0, X(-2.2), 0)
    grad.addColorStop(0, mixHex(d.base, "#ffffff", 0.12))
    grad.addColorStop(0.35, d.base)
    grad.addColorStop(0.7, mixHex(d.base, d.lower, 0.55))
    grad.addColorStop(1, d.lower)
    g.fillStyle = grad
    g.fillRect(0, 0, W, H)
  } else {
    const grad = g.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, mixHex(d.base, "#ffffff", 0.12))
    grad.addColorStop(0.35, flash)
    grad.addColorStop(0.7, d.base)
    grad.addColorStop(1, mixHex(d.base, "#000000", 0.2))
    g.fillStyle = grad
    g.fillRect(0, 0, W, H)
  }

  // Soft metallic flake (tiny noise dots).
  g.globalAlpha = d.finish === "matte" ? 0.04 : 0.07
  g.fillStyle = "#ffffff"
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * W
    const y = Math.random() * H
    g.fillRect(x, y, 1.2, 1.2)
  }
  g.globalAlpha = 1

  // Dark lower body — rises at the bargeboard / dips to the diffuser.
  const lowerGrad = g.createLinearGradient(0, Y(0.55), 0, H)
  lowerGrad.addColorStop(0, mixHex(d.lower, d.base, 0.15))
  lowerGrad.addColorStop(0.4, d.lower)
  lowerGrad.addColorStop(1, mixHex(d.lower, "#000000", 0.35))
  g.fillStyle = lowerGrad
  g.beginPath()
  g.moveTo(X(2.85), Y(0.22))
  g.bezierCurveTo(X(1.8), Y(0.26), X(1.0), Y(0.32), X(0.35), Y(0.38))
  g.bezierCurveTo(X(-0.5), Y(0.44), X(-1.35), Y(0.4), X(-2.55), Y(0.3))
  g.lineTo(X(-2.85), H)
  g.lineTo(X(2.85), H)
  g.closePath()
  g.fill()

  // Halo / cockpit dark band.
  g.fillStyle = halo
  g.beginPath()
  g.moveTo(X(1.05), Y(0.98))
  g.bezierCurveTo(X(0.7), Y(1.05), X(0.15), Y(1.08), X(-0.35), Y(1.02))
  g.bezierCurveTo(X(-0.55), Y(0.88), X(-0.45), Y(0.72), X(-0.15), Y(0.68))
  g.bezierCurveTo(X(0.35), Y(0.7), X(0.85), Y(0.72), X(1.05), Y(0.78))
  g.closePath()
  g.fill()

  // Signature aero sweep (main stripe + pin).
  const sweep = (offset: number, width: number, color: string, alpha = 1) => {
    g.save()
    g.globalAlpha = alpha
    g.strokeStyle = color
    g.lineWidth = width
    g.lineCap = "round"
    g.lineJoin = "round"
    g.beginPath()
    g.moveTo(X(2.6), Y(0.24 + offset))
    g.bezierCurveTo(X(1.55), Y(0.34 + offset), X(0.75), Y(0.48 + offset), X(-0.05), Y(0.58 + offset))
    g.bezierCurveTo(X(-0.85), Y(0.66 + offset), X(-1.55), Y(0.72 + offset), X(-2.35), Y(0.6 + offset))
    g.stroke()
    g.restore()
  }
  sweep(0.02, 34, mixHex(d.stripe, "#000000", 0.35), 0.55)
  sweep(0, 20, d.stripe)
  sweep(-0.035, 4.5, d.pin)
  // Secondary thinner flash line above the main stripe.
  sweep(0.09, 3, mixHex(d.pin, "#ffffff", 0.4), 0.7)

  // Sharp sidepod “chevron” graphic near the inlet.
  g.fillStyle = d.stripe
  g.globalAlpha = 0.85
  g.beginPath()
  g.moveTo(X(0.55), Y(0.55))
  g.lineTo(X(0.15), Y(0.62))
  g.lineTo(X(0.2), Y(0.48))
  g.closePath()
  g.fill()
  g.globalAlpha = 1

  // Nose tip highlight.
  const nose = g.createLinearGradient(X(2.9), 0, X(2.1), 0)
  nose.addColorStop(0, mixHex(d.base, "#ffffff", 0.25))
  nose.addColorStop(1, "rgba(255,255,255,0)")
  g.fillStyle = nose
  g.fillRect(X(2.1), Y(0.55), X(2.9) - X(2.1), Y(0.1) - Y(0.55))

  // Floor / skirt ambient occlusion.
  const ao = g.createLinearGradient(0, Y(0.45), 0, Y(0.08))
  ao.addColorStop(0, "rgba(0,0,0,0)")
  ao.addColorStop(0.55, "rgba(0,0,0,0.18)")
  ao.addColorStop(1, "rgba(0,0,0,0.5)")
  g.fillStyle = ao
  g.fillRect(0, Y(0.45), W, Y(0.08) - Y(0.45))

  // Top edge soft highlight (studio reflection cue baked in).
  const top = g.createLinearGradient(0, 0, 0, Y(0.85))
  top.addColorStop(0, "rgba(255,255,255,0.14)")
  top.addColorStop(1, "rgba(255,255,255,0)")
  g.fillStyle = top
  g.fillRect(0, 0, W, Y(0.85))

  // Panel / fastener lines.
  g.strokeStyle = "rgba(0,0,0,0.28)"
  g.lineWidth = 1.5
  for (const z of [1.2, 0.55, 0.05, -0.42, -1.15]) {
    g.beginPath()
    g.moveTo(X(z), Y(0.98))
    g.bezierCurveTo(X(z - 0.02), Y(0.7), X(z + 0.02), Y(0.4), X(z), Y(0.18))
    g.stroke()
  }
  g.strokeStyle = "rgba(255,255,255,0.08)"
  g.lineWidth = 1
  for (const z of [1.2, 0.55, -0.42]) {
    g.beginPath()
    g.moveTo(X(z) + 1.5, Y(0.95))
    g.lineTo(X(z) + 1.5, Y(0.22))
    g.stroke()
  }

  // Tiny rivet row along the sidepod shoulder.
  g.fillStyle = "rgba(0,0,0,0.35)"
  for (let z = 0.9; z > -1.6; z -= 0.12) {
    g.beginPath()
    g.arc(X(z), Y(0.52), 1.4, 0, Math.PI * 2)
    g.fill()
  }
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
  g.textAlign = "center"
  g.textBaseline = "middle"
  // Soft shadow so the mark sits in the paint.
  g.fillStyle = "rgba(0,0,0,0.35)"
  g.fillText(text, 514, (sub ? 108 : 128) + 2)
  g.fillStyle = color
  g.fillText(text, 512, sub ? 108 : 128)
  if (sub) {
    g.font = `700 48px "Titillium Web", sans-serif`
    g.globalAlpha = 0.85
    g.fillText(sub, 512, 210)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 16
  return t
}

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

export type SponsorSlot = { label: string; ink?: "white"; color?: string }

const MARK_FONT = `italic 700 110px "Titillium Web", sans-serif`

/** Draw one crisp wordmark tile (transparent backdrop). */
function drawWordmarkTile(label: string, ink?: "white", color?: string) {
  const h = 160
  const probe = document.createElement("canvas")
  const pg = probe.getContext("2d")!
  pg.font = MARK_FONT
  const textW = Math.max(24, pg.measureText(label).width)
  const w = Math.ceil(textW + 40)
  const tile = document.createElement("canvas")
  tile.width = w
  tile.height = h
  const g = tile.getContext("2d")!
  g.clearRect(0, 0, w, h)
  g.font = MARK_FONT
  g.textAlign = "center"
  g.textBaseline = "middle"
  const cx = w / 2
  const cy = h / 2
  const fill = ink === "white" ? "#ffffff" : (color ?? "#ffffff")
  // Dark outline keeps light marks readable on white paint.
  g.lineJoin = "round"
  g.miterLimit = 2
  g.lineWidth = 10
  g.strokeStyle = "rgba(0,0,0,0.55)"
  g.strokeText(label, cx, cy)
  g.fillStyle = "rgba(0,0,0,0.4)"
  g.fillText(label, cx + 2, cy + 2)
  g.fillStyle = fill
  g.fillText(label, cx, cy)
  return tile
}

/** Pack drawn sponsor wordmarks into one texture. `rects` lines up with `slots`. */
export function useSponsorAtlas(slots: SponsorSlot[]) {
  const key = slots.map((s) => `${s.label}:${s.ink ?? ""}:${s.color ?? ""}`).join("|")
  const [atlas, setAtlas] = useState<SponsorAtlas | null>(null)
  const [fontReady, setFontReady] = useState(false)
  useEffect(() => {
    let alive = true
    const ready = () => alive && setFontReady(true)
    if (document.fonts?.load) document.fonts.load(MARK_FONT).then(ready, ready)
    else ready()
    return () => {
      alive = false
    }
  }, [])
  useEffect(() => {
    if (!slots.length) {
      setAtlas(null)
      return
    }
    if (!fontReady) return
    const tiles = slots.map((s) => drawWordmarkTile(s.label, s.ink, s.color))
    const height = 160
    const gap = 10
    const widths = tiles.map((t) => t.width)
    const total = widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, widths.length - 1)
    if (!total) {
      setAtlas(null)
      return
    }
    const canvas = document.createElement("canvas")
    canvas.width = total
    canvas.height = height
    const ctx = canvas.getContext("2d")!
    let x = 0
    const rects = tiles.map((tile, i) => {
      const w = widths[i]
      ctx.drawImage(tile, x, 0)
      const rect = {
        u: x / total,
        v: 0,
        su: w / total,
        sv: 1,
        aspect: height / w,
      }
      x += w + gap
      return rect
    })
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 16
    texture.generateMipmaps = false
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping
    texture.needsUpdate = true
    setAtlas({ texture, rects })
  }, [key, fontReady])
  useEffect(() => () => atlas?.texture.dispose(), [atlas])
  return atlas
}
