"use client"

import { Html } from "@react-three/drei"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import * as THREE from "three"
import { PART_IDS, partById } from "@/lib/parts"
import { sound } from "@/lib/sound"
import { partCentres, useGarage } from "@/lib/store"

const LIT = new THREE.Color("#a78bfa")
const BLUEPRINT = new THREE.Color("#ff2a10")
// Shared line materials for the X-ray (technical) view.
const EDGE = new THREE.LineBasicMaterial({ color: "#ff5a36", transparent: true, opacity: 0.85, depthWrite: false })
const EDGE_ACTIVE = new THREE.LineBasicMaterial({ color: "#ffe1d6", transparent: true, opacity: 1, depthWrite: false })
const HOVER = new THREE.Color("#ffffff")
const boxes = new Map<string, THREE.Box3>()

type Mat = THREE.MeshStandardMaterial & {
  userData: { source: THREE.MeshStandardMaterial; baseEmissive: THREE.Color; baseIntensity: number; baseOpacity: number; baseTransparent: boolean; keepEmissive?: boolean }
}

// One selectable component. Several <Part>s can share an id (left and right
// sidepods); they move together but each slides along its own direction.
export function Part({ id, explode, children, label = true }: { id: string; explode: THREE.Vector3Tuple; children: ReactNode; label?: boolean }) {
  const group = useRef<THREE.Group>(null!)
  const mats = useRef<Mat[]>([])
  const teamId = useGarage((s) => s.teamId)
  const highlights = useGarage((s) => s.highlights)
  const technical = useGarage((s) => s.technical)
  const selected = useGarage((s) => s.selected)
  const edges = useRef<THREE.LineSegments[]>([])
  const wasActive = useRef(false)
  const [centre, setCentre] = useState<THREE.Vector3Tuple>([0, 0, 0])

  // Give this part its own material copies so it can fade and glow alone.
  useLayoutEffect(() => {
    const list: Mat[] = []
    group.current.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      // mesh.material may still be our clone from before a team change, if
      // React kept the same material and only updated its texture.
      const current = mesh.material as Mat
      const source = (current.userData?.source ?? current) as THREE.MeshStandardMaterial
      const m = source.clone() as Mat
      m.userData = {
        source,
        baseEmissive: m.emissive.clone(),
        baseIntensity: m.emissiveIntensity,
        baseOpacity: m.opacity,
        baseTransparent: m.transparent,
        keepEmissive: Boolean(mesh.userData.keepEmissive),
      }
      mesh.material = m
      mesh.castShadow = true
      mesh.receiveShadow = true
      list.push(m)
    })
    mats.current = list

    // Feature lines for the blueprint view: creases and silhouettes only.
    const lines: THREE.LineSegments[] = []
    group.current.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh || (mesh.parent as THREE.Mesh)?.isMesh) return // skip decals
      let line = mesh.children.find((c) => c.userData.edges) as THREE.LineSegments | undefined
      if (!line) {
        line = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 14), EDGE)
        line.userData.edges = true
        line.raycast = () => {}
        mesh.add(line)
      }
      line.visible = false
      lines.push(line)
    })
    edges.current = lines

    group.current.updateWorldMatrix(true, true)
    const box = new THREE.Box3().setFromObject(group.current)
    const all = boxes.get(id)?.clone().union(box) ?? box
    boxes.set(id, all)
    partCentres.set(id, all.getCenter(new THREE.Vector3()).toArray())
    setCentre(group.current.worldToLocal(box.getCenter(new THREE.Vector3())).toArray())
    return () => list.forEach((m) => m.dispose())
  }, [teamId, id])

  useFrame((state, dt) => {
    const s = useGarage.getState()
    // Staggered: parts leave in order and come back in reverse.
    let exploded = s.exploded
    if (s.explodeStagger) {
      const order = PART_IDS.indexOf(id)
      const since = performance.now() / 1000 - s.explodeChangedAt
      exploded = s.exploded ? since > order * 0.2 : since < (PART_IDS.length - 1 - order) * 0.2
    }
    const active = exploded || s.selected === id || (s.selected === "power-unit" && id === "engine-cover")
    if (label && s.explodeStagger && !s.exploded && wasActive.current && !active) setTimeout(() => sound.clunk(), 380)
    wasActive.current = active
    const p = group.current.position
    p.x = THREE.MathUtils.damp(p.x, active ? explode[0] : 0, 5, dt)
    p.y = THREE.MathUtils.damp(p.y, active ? explode[1] : 0, 5, dt)
    p.z = THREE.MathUtils.damp(p.z, active ? explode[2] : 0, 5, dt)

    const ghost = Boolean(s.selected) && !s.exploded && s.selected !== id
    const focus = s.selected === id || s.hovered === id
    for (const l of edges.current) {
      l.visible = s.technical
      l.material = focus ? EDGE_ACTIVE : EDGE
    }
    const lit = s.highlights.some((h) => h.id === id)
    const hovered = s.hovered === id
    const pulse = 0.35 + 0.25 * Math.sin(state.clock.elapsedTime * 4)
    for (const m of mats.current) {
      // Decal textures load after the clone was made (fonts, team logos).
      if (m.map !== m.userData.source.map) { m.map = m.userData.source.map; m.needsUpdate = true }
      // Blueprint: bodywork turns to tinted glass so the structure shows through.
      const target = s.technical ? (focus ? 0.55 : 0.16) : ghost ? 0.1 : m.userData.baseOpacity
      m.opacity = THREE.MathUtils.damp(m.opacity, target, 8, dt)
      const transparent = m.userData.baseTransparent || m.opacity < 0.98
      if (transparent !== m.transparent) { m.transparent = transparent; m.needsUpdate = true }
      m.depthWrite = m.opacity > 0.5
      if (m.userData.keepEmissive) continue
      if (lit) { m.emissive.copy(LIT); m.emissiveIntensity = pulse }
      else if (s.technical) { m.emissive.copy(BLUEPRINT); m.emissiveIntensity = focus ? 0.35 : 0.18 }
      else if (hovered) { m.emissive.copy(HOVER); m.emissiveIntensity = 0.12 }
      else { m.emissive.copy(m.userData.baseEmissive); m.emissiveIntensity = m.userData.baseIntensity }
    }
  })

  const onOver = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); useGarage.getState().hover(id); document.body.style.cursor = "pointer" }
  const onOut = () => { useGarage.getState().hover(null); document.body.style.cursor = "" }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const s = useGarage.getState()
    s.select(s.selected === id && !s.exploded ? null : id)
    if (s.exploded) s.setExploded(false)
  }

  const index = highlights.findIndex((h) => h.id === id)
  const part = partById(id)
  const hovered = useGarage((s) => s.hovered === id)
  // Blueprint tags only for the part under the cursor or in focus, to keep the drawing readable.
  const showSpec = label && technical && index < 0 && (selected ? selected === id : hovered)
  return (
    <group ref={group} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
      {children}
      {label && index >= 0 && (
        <Html position={centre} center zIndexRange={[20, 0]} className="car-label-wrap">
          <div className="car-label">
            <span className="car-label-num">{index + 1}</span>
            <span><strong>{part?.name}</strong>{highlights[index].note}</span>
          </div>
        </Html>
      )}
      {showSpec && part && (
        <Html position={centre} zIndexRange={[15, 0]} className="spec-tag-wrap">
          <div className="spec-tag">
            <b>{part.name}</b>
            {part.specs.slice(0, selected === id ? 6 : 1).map(([k, v]) => <span key={k}><i>{k}</i>{v}</span>)}
          </div>
        </Html>
      )}
    </group>
  )
}
