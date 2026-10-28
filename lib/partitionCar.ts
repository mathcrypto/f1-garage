import * as THREE from "three"
import { PART_IDS } from "./parts"

/**
 * Spatial part labels for a fused Hunyuan/TRELLIS mesh (after fitToStudio).
 * Car faces +Z (nose), sits on y≈0, length ≈ 5.4 m.
 */
export function classifyPoint(x: number, y: number, z: number): string {
  const ax = Math.abs(x)

  if (y < 0.11 && z < 1.4) return "floor"
  if (z > 2.05 && y < 0.5) return "front-wing"
  if (z < -2.05 && y > 0.55) return "rear-wing"
  if (z < -1.85 && y < 0.45) return "diffuser"
  if (z < -2.15 && y > 0.25 && y < 0.55) return "rear-wing" // no beam wing in 2026: rear wing supports

  if (ax > 0.55 && z > 1.15 && z < 2.15) return "front-tyres"
  if (ax > 0.55 && z < -1.15 && z > -2.15) return "rear-tyres"

  if (ax > 0.28 && ax < 0.75 && z > 1.25 && z < 2.05 && y < 0.62) return "front-suspension"
  if (ax > 0.22 && ax < 0.72 && z < -1.2 && z > -2.05 && y < 0.58) return "rear-suspension"

  if (z > 1.05 && z < 2.35 && ax < 0.48 && y > 0.12) return "nose"
  if (y > 0.62 && z > -0.55 && z < 0.55 && ax < 0.55) return "cockpit"
  if (ax > 0.32 && z > -1.1 && z < 0.65 && y > 0.12 && y < 0.62) return "sidepods"
  if (z < -0.15 && z > -1.95 && y > 0.38 && ax < 0.55) return "engine-cover"
  if (z < -0.9 && z > -1.85 && y > 0.2 && y < 0.5 && ax < 0.35) return "power-unit"

  if (z > 0.8) return "nose"
  if (z < -1.6) return y > 0.5 ? "rear-wing" : "diffuser"
  if (ax > 0.4) return "sidepods"
  if (y > 0.55) return "cockpit"
  return "engine-cover"
}

/** Split a fitted mesh into garage part geometries by triangle centroid (world space). */
export function splitMeshByParts(mesh: THREE.Mesh): Map<string, THREE.BufferGeometry> {
  const out = new Map<string, THREE.BufferGeometry>()
  mesh.updateWorldMatrix(true, false)
  const geom = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
  const pos = geom.attributes.position
  if (!pos || pos.count < 3) return out

  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)
  const buckets = new Map<string, number[]>()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const mid = new THREE.Vector3()

  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)
    b.fromBufferAttribute(pos, i + 1).applyMatrix4(mesh.matrixWorld)
    c.fromBufferAttribute(pos, i + 2).applyMatrix4(mesh.matrixWorld)
    mid.copy(a).add(b).add(c).multiplyScalar(1 / 3)
    const id = classifyPoint(mid.x, mid.y, mid.z)
    let list = buckets.get(id)
    if (!list) {
      list = []
      buckets.set(id, list)
    }
    list.push(i, i + 1, i + 2)
  }

  const srcNormal = geom.attributes.normal
  const nrm = new THREE.Vector3()
  const tmp = new THREE.Vector3()

  for (const [id, indices] of buckets) {
    if (indices.length < 9) continue
    const positions = new Float32Array(indices.length * 3)
    const normals = new Float32Array(indices.length * 3)
    for (let n = 0; n < indices.length; n++) {
      const vi = indices[n]
      // Bake WORLD positions (must match classification space).
      tmp.fromBufferAttribute(pos, vi).applyMatrix4(mesh.matrixWorld)
      positions[n * 3] = tmp.x
      positions[n * 3 + 1] = tmp.y
      positions[n * 3 + 2] = tmp.z
      if (srcNormal) {
        nrm.fromBufferAttribute(srcNormal, vi).applyMatrix3(normalMatrix).normalize()
        normals[n * 3] = nrm.x
        normals[n * 3 + 1] = nrm.y
        normals[n * 3 + 2] = nrm.z
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    // Keep the model's own (smooth) normals; recomputing on unindexed triangles
    // would facet the surface.
    if (srcNormal) g.setAttribute("normal", new THREE.BufferAttribute(normals, 3))
    else g.computeVertexNormals()
    out.set(id, g)
  }

  return out
}

export function isKnownPartId(id: string) {
  return PART_IDS.includes(id)
}
