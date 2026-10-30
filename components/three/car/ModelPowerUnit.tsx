"use client"

import { useFrame } from "@react-three/fiber"
import { useMemo, useRef } from "react"
import * as THREE from "three"
import { useGarage } from "@/lib/store"
import { PuLabels } from "./Car"
import { useMotion } from "./CarMotion"

/**
 * The licensed model is a shell with no engine inside, so selecting the power
 * unit would only show its exhaust pipe. This draws the same schematic power
 * unit as the code-built car (V6, turbo, compressor, MGU-K, energy store,
 * control electronics) where it sits under the engine cover, shown when the
 * power unit is selected or in the X-ray view, with its labels.
 */
export function ModelPowerUnit() {
  const show = useGarage((s) => s.selected === "power-unit" || s.technical)
  const battery = useRef<THREE.Mesh>(null!)
  const motion = useMotion()
  const m = useMemo(
    () => ({
      titanium: new THREE.MeshStandardMaterial({ color: "#9aa0a8", metalness: 0.85, roughness: 0.35 }),
      metal: new THREE.MeshStandardMaterial({ color: "#7a808a", metalness: 0.9, roughness: 0.3 }),
      brass: new THREE.MeshStandardMaterial({ color: "#b8893a", metalness: 0.9, roughness: 0.35 }),
      matte: new THREE.MeshStandardMaterial({ color: "#1c1e22", roughness: 0.8 }),
      ers: new THREE.MeshStandardMaterial({ color: "#0b2a33", roughness: 0.45, emissive: "#22d3ee", emissiveIntensity: 0.35 }),
    }),
    [],
  )
  useFrame((state) => {
    if (!battery.current) return
    const mat = battery.current.material as THREE.MeshStandardMaterial
    mat.emissiveIntensity = motion ? 0.4 + motion.ers * 2.5 : 0.35 + 0.15 * Math.sin(state.clock.elapsedTime * 2)
  })
  return (
    <group visible={show}>
      <mesh material={m.titanium} position={[0, 0.4, -0.95]}><boxGeometry args={[0.32, 0.24, 0.62]} /></mesh>
      {[1, -1].map((s) => (
        <mesh key={s} material={m.metal} position={[0.14 * s, 0.55, -0.95]} rotation={[0, 0, -0.6 * s]}><boxGeometry args={[0.1, 0.12, 0.58]} /></mesh>
      ))}
      <mesh material={m.brass} position={[0, 0.52, -1.38]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.09, 0.09, 0.14, 28]} /></mesh>
      <mesh material={m.titanium} position={[0.2, 0.3, -0.62]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.07, 0.07, 0.16, 24]} /></mesh>
      <mesh ref={battery} material={m.ers} position={[0, 0.3, -0.55]} userData={{ keepEmissive: true }}><boxGeometry args={[0.42, 0.1, 0.3]} /></mesh>
      <mesh material={m.brass} position={[0, 0.52, -0.6]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.07, 0.06, 0.1, 24]} /></mesh>
      <mesh material={m.metal} position={[0, 0.52, -1.0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.018, 0.018, 0.78, 12]} /></mesh>
      <mesh material={m.matte} position={[-0.17, 0.3, -1.2]}><boxGeometry args={[0.1, 0.08, 0.2]} /></mesh>
      {show && <PuLabels />}
    </group>
  )
}
