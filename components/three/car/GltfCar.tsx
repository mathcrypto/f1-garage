"use client"

import { useGLTF } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { useMemo } from "react"
import * as THREE from "three"
import { resolvePartId } from "@/lib/carAssets"
import { classifyPoint, splitMeshByParts } from "@/lib/partitionCar"
import { liveryFor } from "@/lib/liveries"
import type { Team } from "@/lib/teams"
import { IDLE, useMotion } from "./CarMotion"
import { applySideUVs, paintLivery } from "./livery"
import { Part } from "./Part"

type Bucket = { partId: string; objects: THREE.Object3D[]; also?: string[]; explode?: THREE.Vector3Tuple }

/**
 * A modelled one-piece bodywork (tagged `part: "split"`) is kept whole: it is
 * the nose, sidepods, engine cover and floor at once, and stays in place when
 * the car is taken apart while the model's separate pieces come off around it.
 */
const BODYWORK = { partId: "sidepods", also: ["nose", "engine-cover", "floor"], explode: [0, 0, 0] as THREE.Vector3Tuple }
/** One road wheel: `steer` turns about the vertical axis, `spin` about the axle. */
type Wheel = { steer: THREE.Group; spin: THREE.Group; front: boolean }

const CORNERS = ["front_left", "front_right", "rear_left", "rear_right"] as const

/** "front_left" etc. from a mesh's own name, else its parent's (exporters move shapes into unnamed children). */
function cornerOf(mesh: THREE.Mesh): (typeof CORNERS)[number] | null {
  for (const name of [mesh.name, mesh.parent?.name ?? ""]) {
    const n = name.toLowerCase()
    const axle = n.includes("front") ? "front" : n.includes("rear") ? "rear" : null
    const side = n.includes("left") ? "left" : n.includes("right") ? "right" : null
    if (axle && side) return `${axle}_${side}`
  }
  return null
}

/**
 * Groups each corner's tyre, rim and wheel nuts so they can spin and steer.
 * Wheel covers are left out: on 2026 cars they don't rotate.
 */
function buildWheels(parts: Bucket[], hintOf: (mesh: THREE.Mesh) => string): Wheel[] {
  const wheels: Wheel[] = []
  for (const bucket of parts) {
    if (bucket.partId !== "front-tyres" && bucket.partId !== "rear-tyres") continue
    const byCorner = new Map<string, THREE.Mesh[]>()
    const rest: THREE.Object3D[] = []
    for (const obj of bucket.objects) {
      const mesh = obj as THREE.Mesh
      const corner = mesh.isMesh && !/cover/i.test(hintOf(mesh)) ? cornerOf(mesh) : null
      if (!corner) { rest.push(obj); continue }
      byCorner.set(corner, [...(byCorner.get(corner) ?? []), mesh])
    }
    for (const [corner, meshes] of byCorner) {
      const box = new THREE.Box3()
      for (const m of meshes) { m.updateMatrixWorld(true); box.expandByObject(m) }
      const steer = new THREE.Group()
      const spin = new THREE.Group()
      box.getCenter(steer.position)
      steer.add(spin)
      steer.updateMatrixWorld(true)
      for (const m of meshes) spin.attach(m)
      rest.push(steer)
      wheels.push({ steer, spin, front: corner.startsWith("front") })
    }
    bucket.objects = rest
  }
  return wheels
}

/**
 * A 3D car model, fitted to the studio and painted in the team livery. Tagged or
 * named meshes are filed under their part; unnamed pieces by position; a
 * one-piece body or fused AI mesh is sliced into parts by region.
 */
export function GltfCar({ url, team }: { url: string; team: Team }) {
  const gltf = useGLTF(url)
  const design = liveryFor(team.id)

  const prepared = useMemo(() => {
    const root = gltf.scene.clone(true)
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      if (Array.isArray(mesh.material)) mesh.material = mesh.material.map((m) => m.clone())
      else if (mesh.material) mesh.material = mesh.material.clone()
    })

    fitToStudio(root)

    const liveryMap = paintLivery(design)
    const paint = teamPaint(design, liveryMap)
    // Lifted a little from true black so the parts read against the dark studio.
    const rubber = solidMat("#26272c", 0.82, 0.02)
    const carbon = solidMat("#4a4f59", 0.4, 0.25, 0.8)
    const metal = solidMat("#7a808a", 0.28, 0.9)

    /** Material by what the piece is; null keeps the model's own (e.g. glowing LEDs). */
    const materialFor = (partId: string | null, nameHint: string): THREE.Material | null => {
      const n = nameHint.toLowerCase()
      if (/\bled|led_/.test(n)) return null
      if (/rim|nut/.test(n)) return metal
      if (/cover|seat|steering|halo|mirror|tpod|antenna|cam|barge|rips|exhaust/.test(n)) return carbon
      if (partId === "front-tyres" || partId === "rear-tyres" || /tyre|tire|rubber|wheel/.test(n)) return rubber
      if (
        partId === "floor" ||
        partId === "diffuser" ||
        partId === "front-wing" ||
        partId === "rear-wing" ||
        partId === "front-suspension" ||
        partId === "rear-suspension" ||
        /floor|diffuser|plank|carbon|wing|wishbone/.test(n)
      ) {
        return carbon
      }
      return paint
    }

    const named = new Map<string, THREE.Mesh[]>()
    const unlabeled: THREE.Mesh[] = []
    // Pieces tagged "split": a one-piece bodywork (kept whole, see BODYWORK).
    const bodywork: THREE.Mesh[] = []
    const hintOf = (mesh: THREE.Mesh) => `${mesh.parent?.name ?? ""}/${mesh.name}`

    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      if (mesh.geometry && !mesh.geometry.getAttribute("normal")) {
        mesh.geometry.computeVertexNormals()
      }

      const parentPart = typeof mesh.parent?.userData?.part === "string" ? mesh.parent.userData.part : null
      const fromData = typeof mesh.userData?.part === "string" ? mesh.userData.part : parentPart
      if (fromData === "split") {
        bodywork.push(mesh)
        return
      }
      const partId = resolvePartId(fromData) ?? resolvePartId(mesh.name) ?? resolvePartId(mesh.parent?.name)
      if (partId) {
        const list = named.get(partId) ?? []
        list.push(mesh)
        named.set(partId, list)
      } else {
        unlabeled.push(mesh)
      }
    })

    const parts: Bucket[] = []

    // A fused AI mesh has no parts of its own: slice it by region.
    const addSlices = (mesh: THREE.Mesh) => {
      mesh.visible = false
      for (const [partId, geometry] of splitMeshByParts(mesh)) {
        applyLiveryUVsToGeometry(geometry)
        const piece = new THREE.Mesh(geometry, materialFor(partId, partId) ?? paint)
        piece.castShadow = true
        piece.receiveShadow = true
        piece.name = partId
        const bucket = parts.find((p) => p.partId === partId)
        if (bucket) bucket.objects.push(piece)
        else parts.push({ partId, objects: [piece] })
      }
    }

    if (named.size > 0) {
      for (const [partId, meshes] of named) {
        for (const mesh of meshes) {
          applyLiveryUVs(mesh)
          const material = materialFor(partId, hintOf(mesh))
          if (material) mesh.material = material
        }
        parts.push({
          partId,
          objects: meshes.map((mesh) => detachWorld(mesh)),
        })
      }
      if (bodywork.length) {
        for (const mesh of bodywork) {
          applyLiveryUVs(mesh)
          mesh.material = paint
        }
        parts.push({ ...BODYWORK, objects: bodywork.map((mesh) => detachWorld(mesh)) })
      }
      return { root, parts, wheels: buildWheels(parts, hintOf), mode: "named" as const }
    }
    unlabeled.push(...bodywork)

    // Several unnamed pieces (PartPacker generates the car already split into
    // parts): keep each piece whole and file it under the part it sits in.
    if (unlabeled.length > 1) {
      const centre = new THREE.Vector3()
      for (const mesh of unlabeled) {
        mesh.updateWorldMatrix(true, false)
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
        mesh.geometry.boundingBox!.getCenter(centre).applyMatrix4(mesh.matrixWorld)
        const partId = classifyPoint(centre.x, centre.y, centre.z)
        applyLiveryUVs(mesh)
        mesh.material = materialFor(partId, hintOf(mesh)) ?? mesh.material
        const bucket = parts.find((p) => p.partId === partId)
        if (bucket) bucket.objects.push(detachWorld(mesh))
        else parts.push({ partId, objects: [detachWorld(mesh)] })
      }
      return { root, parts, wheels: [] as Wheel[], mode: "pieces" as const }
    }

    // One fused mesh (Hunyuan, TRELLIS): slice it into parts by region.
    unlabeled.forEach((mesh) => addSlices(mesh))

    // If partition failed, still show the fitted whole mesh with paint.
    if (parts.length === 0) {
      for (const mesh of unlabeled) {
        mesh.visible = true
        applyLiveryUVs(mesh)
        mesh.material = paint
      }
      return { root, parts: [], wheels: [] as Wheel[], mode: "whole" as const }
    }

    return { root, parts, wheels: [] as Wheel[], mode: "spatial" as const }
  }, [gltf.scene, design, team.id])

  // On track the wheels turn with the car's speed and the fronts steer (same
  // limits as the code-built car, so fast spins don't strobe).
  const motion = useMotion()
  useFrame((_, dt) => {
    const m = motion ?? IDLE
    const spinBoost = m.wheelspin * 70
    for (const w of prepared.wheels) {
      w.spin.rotation.x += Math.min(m.speed / 3.6 / 0.36 + (w.front ? 0 : spinBoost), 14) * dt
      if (w.front) w.steer.rotation.y = THREE.MathUtils.damp(w.steer.rotation.y, m.steer, 4, dt)
    }
  })

  // Taking it apart: every piece gets its own <Part> and moves along its own
  // direction (its part's offset, mirrored to its side, plus a spread away from
  // the car's centre), like an exploded diagram. One label per part.
  const pieces = useMemo(() => {
    const centre = new THREE.Vector3()
    return prepared.parts.flatMap(({ partId, objects, also, explode }) =>
      objects.map((obj, i) => {
        if (explode) return { partId, obj, also, explode, label: i === 0 }
        obj.updateMatrixWorld(true)
        new THREE.Box3().setFromObject(obj).getCenter(centre)
        // Classic exploded diagram: each piece moves out in proportion to its
        // distance from the car's centre, plus half its part's offset (mirrored
        // to its side) so neighbouring pieces separate clearly.
        const [bx, by, bz] = explodeFor(partId)
        const side = Math.abs(centre.x) < 0.08 ? 0 : Math.sign(centre.x)
        const spread: THREE.Vector3Tuple = [
          (bx === 0 ? 0 : Math.abs(bx) * side) * 0.5 + centre.x * 1.1,
          by * 0.5 + (centre.y - 0.4) * 1.4 + 0.15,
          bz * 0.5 + centre.z * 0.55,
        ]
        return { partId, obj, also, explode: spread, label: i === 0 }
      }),
    )
  }, [prepared])

  if (prepared.mode === "whole" || prepared.parts.length === 0) {
    return <primitive key={team.id} object={prepared.root} />
  }

  return (
    <group key={`${team.id}-${prepared.mode}`}>
      {pieces.map(({ partId, obj, also, explode, label }) => (
        <Part key={obj.uuid} id={partId} also={also} explode={explode} label={label}>
          <primitive object={obj} />
        </Part>
      ))}
      {prepared.mode === "named" ? <primitive object={prepared.root} /> : null}
    </group>
  )
}

function solidMat(color: string, roughness: number, metalness: number, clearcoat = 0.2) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness,
    clearcoat,
    clearcoatRoughness: 0.25,
    envMapIntensity: 1,
    side: THREE.DoubleSide,
  })
}

function teamPaint(design: ReturnType<typeof liveryFor>, map: THREE.Texture) {
  const gloss = design.finish === "matte" ? 0.2 : design.finish === "satin" ? 0.35 : 0.55
  const rough = design.finish === "matte" ? 0.55 : design.finish === "satin" ? 0.38 : 0.28
  return new THREE.MeshPhysicalMaterial({
    map,
    color: "#ffffff",
    metalness: 0.08,
    roughness: rough,
    clearcoat: gloss,
    clearcoatRoughness: design.finish === "gloss" ? 0.12 : 0.3,
    envMapIntensity: 0.85,
    side: THREE.DoubleSide,
  })
}

function applyLiveryUVs(mesh: THREE.Mesh) {
  mesh.updateWorldMatrix(true, false)
  applySideUVs(mesh.geometry, mesh.matrixWorld)
}

function applyLiveryUVsToGeometry(geometry: THREE.BufferGeometry) {
  applySideUVs(geometry)
}

function fitToStudio(root: THREE.Object3D) {
  root.updateMatrixWorld(true)
  let box = new THREE.Box3().setFromObject(root)
  let size = box.getSize(new THREE.Vector3())
  const longest = Math.max(size.x, size.y, size.z, 0.01)
  const length = size.z >= size.x * 0.85 ? size.z : longest
  const scale = 5.4 / length
  const center = box.getCenter(new THREE.Vector3())
  root.scale.setScalar(scale)
  root.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale)
  root.updateMatrixWorld(true)

  box = new THREE.Box3().setFromObject(root)
  size = box.getSize(new THREE.Vector3())
  if (size.y > size.z * 1.2 && size.y > size.x * 1.2) {
    root.rotation.x = -Math.PI / 2
    root.updateMatrixWorld(true)
  } else if (size.x > size.z * 1.25) {
    root.rotation.y = Math.PI / 2
    root.updateMatrixWorld(true)
  }

  box = new THREE.Box3().setFromObject(root)
  root.position.y -= box.min.y
  root.position.y += 0.01
  root.updateMatrixWorld(true)
}

function detachWorld(mesh: THREE.Mesh) {
  mesh.updateWorldMatrix(true, false)
  const pos = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  const scl = new THREE.Vector3()
  mesh.matrixWorld.decompose(pos, quat, scl)
  mesh.parent?.remove(mesh)
  mesh.position.copy(pos)
  mesh.quaternion.copy(quat)
  mesh.scale.copy(scl)
  return mesh
}

function explodeFor(id: string): [number, number, number] {
  const map: Record<string, [number, number, number]> = {
    "front-wing": [0, 0.07, 1.38],
    nose: [0, 0.58, 1.09],
    "front-suspension": [0.65, 0.51, 0.29],
    cockpit: [0, 0.8, 0.22],
    sidepods: [0.94, 0.07, 0],
    floor: [1.9, 0, 0],
    "engine-cover": [0, 1.52, -0.22],
    "power-unit": [0, 0.51, 0],
    "rear-suspension": [0, 0.43, -0.8],
    diffuser: [0, 0.05, -1.25],
    "rear-wing": [0, 0.87, -1.45],
    "front-tyres": [0.87, 0, 0.22],
    "rear-tyres": [0.87, 0, -0.22],
  }
  return map[id] ?? [0, 0.4, 0]
}

export function preloadCarModel(url: string) {
  useGLTF.preload(url)
}
