"use client"

import { Html } from "@react-three/drei"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import * as THREE from "three"
import { partById } from "@/lib/parts"
import { partCentres, useGarage } from "@/lib/store"

const LIT = new THREE.Color("#a78bfa")
const HOVER = new THREE.Color("#ffffff")
const boxes = new Map<string, THREE.Box3>()

type Mat = THREE.MeshStandardMaterial & {
  userData: { baseEmissive: THREE.Color; baseIntensity: number; baseOpacity: number; baseTransparent: boolean; keepEmissive?: boolean }
}

// One selectable component. Several <Part>s can share an id (left and right
// sidepods); they move together but each slides along its own direction.
export function Part({ id, explode, children, label = true }: { id: string; explode: THREE.Vector3Tuple; children: ReactNode; label?: boolean }) {
  const group = useRef<THREE.Group>(null!)
  const mats = useRef<Mat[]>([])
  const teamId = useGarage((s) => s.teamId)
  const highlights = useGarage((s) => s.highlights)
  const [centre, setCentre] = useState<THREE.Vector3Tuple>([0, 0, 0])

  // Give this part its own material copies so it can fade and glow alone.
  useLayoutEffect(() => {
    const list: Mat[] = []
    group.current.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const m = (mesh.material as THREE.MeshStandardMaterial).clone() as Mat
      m.userData = {
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
    const active = s.exploded || s.selected === id || (s.selected === "power-unit" && id === "engine-cover")
    const p = group.current.position
    p.x = THREE.MathUtils.damp(p.x, active ? explode[0] : 0, 5, dt)
    p.y = THREE.MathUtils.damp(p.y, active ? explode[1] : 0, 5, dt)
    p.z = THREE.MathUtils.damp(p.z, active ? explode[2] : 0, 5, dt)

    const ghost = Boolean(s.selected) && !s.exploded && s.selected !== id
    const lit = s.highlights.some((h) => h.id === id)
    const hovered = s.hovered === id
    const pulse = 0.35 + 0.25 * Math.sin(state.clock.elapsedTime * 4)
    for (const m of mats.current) {
      const target = ghost ? 0.1 : m.userData.baseOpacity
      m.opacity = THREE.MathUtils.damp(m.opacity, target, 8, dt)
      const transparent = m.userData.baseTransparent || m.opacity < 0.98
      if (transparent !== m.transparent) { m.transparent = transparent; m.needsUpdate = true }
      m.depthWrite = m.opacity > 0.5
      if (m.userData.keepEmissive) continue
      if (lit) { m.emissive.copy(LIT); m.emissiveIntensity = pulse }
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
  return (
    <group ref={group} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
      {children}
      {label && index >= 0 && (
        <Html position={centre} center zIndexRange={[20, 0]} className="car-label-wrap">
          <div className="car-label">
            <span className="car-label-num">{index + 1}</span>
            <span><strong>{partById(id)?.name}</strong>{highlights[index].note}</span>
          </div>
        </Html>
      )}
    </group>
  )
}
