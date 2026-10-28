"use client"

import { useGLTF } from "@react-three/drei"
import { useMemo } from "react"
import * as THREE from "three"
import { resolvePartId } from "@/lib/carAssets"
import { classifyPoint, splitMeshByParts } from "@/lib/partitionCar"
import { liveryFor } from "@/lib/liveries"
import type { Team } from "@/lib/teams"
import { applySideUVs, paintLivery } from "./livery"
import { Part } from "./Part"

type Bucket = { partId: string; objects: THREE.Object3D[] }

/**
 * AI mesh (NVIDIA PartPacker · Hunyuan3D · TRELLIS): fit to studio, team livery wrap.
 * Named meshes explode by id; unnamed pieces are filed by position; one fused
 * mesh is sliced into parts by region.
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
    const rubber = solidMat("#1a1a1e", 0.9, 0.02)
    const carbon = solidMat("#2a2c32", 0.55, 0.2)

    const materialFor = (partId: string | null, nameHint: string) => {
      const n = nameHint.toLowerCase()
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

    if (named.size > 0) {
      for (const [partId, meshes] of named) {
        for (const mesh of meshes) {
          applyLiveryUVs(mesh)
          mesh.material = materialFor(partId, mesh.name)
        }
        parts.push({
          partId,
          objects: meshes.map((mesh) => detachWorld(mesh)),
        })
      }
      return { root, parts, mode: "named" as const }
    }

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
        mesh.material = materialFor(partId, mesh.name)
        const bucket = parts.find((p) => p.partId === partId)
        if (bucket) bucket.objects.push(detachWorld(mesh))
        else parts.push({ partId, objects: [detachWorld(mesh)] })
      }
      return { root, parts, mode: "pieces" as const }
    }

    // One fused mesh (Hunyuan, TRELLIS): slice it into parts by region.
    for (const mesh of unlabeled) {
      const slices = splitMeshByParts(mesh)
      mesh.visible = false
      for (const [partId, geometry] of slices) {
        applyLiveryUVsToGeometry(geometry)
        const piece = new THREE.Mesh(geometry, materialFor(partId, partId))
        piece.castShadow = true
        piece.receiveShadow = true
        piece.name = partId
        const bucket = parts.find((p) => p.partId === partId)
        if (bucket) bucket.objects.push(piece)
        else parts.push({ partId, objects: [piece] })
      }
    }

    // If partition failed, still show the fitted whole mesh with paint.
    if (parts.length === 0) {
      for (const mesh of unlabeled) {
        mesh.visible = true
        applyLiveryUVs(mesh)
        mesh.material = paint
      }
      return { root, parts: [], mode: "whole" as const }
    }

    return { root, parts, mode: "spatial" as const }
  }, [gltf.scene, design, team.id])

  if (prepared.mode === "whole" || prepared.parts.length === 0) {
    return <primitive key={team.id} object={prepared.root} />
  }

  return (
    <group key={`${team.id}-${prepared.mode}`}>
      {prepared.parts.map(({ partId, objects }) => (
        <Part key={partId} id={partId} explode={explodeFor(partId)}>
          {objects.map((obj) => (
            <primitive key={obj.uuid} object={obj} />
          ))}
        </Part>
      ))}
      {prepared.mode === "named" ? <primitive object={prepared.root} /> : null}
    </group>
  )
}

function solidMat(color: string, roughness: number, metalness: number) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness,
    clearcoat: 0.2,
    clearcoatRoughness: 0.4,
    envMapIntensity: 0.7,
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
