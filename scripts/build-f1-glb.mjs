/**
 * Builds a multi-part open-wheel F1-style .glb for the garage.
 * Mesh names match lib/parts.ts so TeamCar / GltfCar pick them up.
 *
 * Run: node scripts/build-f1-glb.mjs
 *
 * Note: This machine has no CUDA GPU — Hunyuan3D / TRELLIS can't run here.
 * This script produces a game-ready stand-in you can replace with AI meshes later.
 */
import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { Document, NodeIO } from "@gltf-transform/core"

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, "../public/models/cars")
mkdirSync(outDir, { recursive: true })

const doc = new Document()
const buffer = doc.createBuffer()
const root = doc.createNode("f1-car")
const scene = doc.createScene("garage").addChild(root)

function box(w, h, d) {
  // 24 unique verts for a box centered at origin (GLTF expects indexed mesh).
  const hx = w / 2, hy = h / 2, hz = d / 2
  const positions = new Float32Array([
    -hx, -hy, hz, hx, -hy, hz, hx, hy, hz, -hx, hy, hz, // front
    hx, -hy, -hz, -hx, -hy, -hz, -hx, hy, -hz, hx, hy, -hz, // back
    -hx, hy, hz, hx, hy, hz, hx, hy, -hz, -hx, hy, -hz, // top
    -hx, -hy, -hz, hx, -hy, -hz, hx, -hy, hz, -hx, -hy, hz, // bottom
    -hx, -hy, -hz, -hx, -hy, hz, -hx, hy, hz, -hx, hy, -hz, // left
    hx, -hy, hz, hx, -hy, -hz, hx, hy, -hz, hx, hy, hz, // right
  ])
  const normals = new Float32Array([
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
    1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
  ])
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,
  ])
  return { positions, normals, indices }
}

function cyl(r, h, seg = 16) {
  const positions = []
  const normals = []
  const indices = []
  // side
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    positions.push(x, -h / 2, z, x, h / 2, z)
    normals.push(Math.cos(a), 0, Math.sin(a), Math.cos(a), 0, Math.sin(a))
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3
    indices.push(a, c, b, b, c, d)
  }
  // caps (simple fan)
  const topC = positions.length / 3
  positions.push(0, h / 2, 0)
  normals.push(0, 1, 0)
  const botC = positions.length / 3
  positions.push(0, -h / 2, 0)
  normals.push(0, -1, 0)
  for (let i = 0; i < seg; i++) {
    const t0 = i * 2 + 1
    const t1 = ((i + 1) % (seg + 1)) * 2 + 1
    indices.push(topC, t0, t1)
    const b0 = i * 2
    const b1 = ((i + 1) % (seg + 1)) * 2
    indices.push(botC, b1, b0)
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  }
}

const mats = {
  paint: doc.createMaterial("paint").setBaseColorFactor([0.82, 0.05, 0.08, 1]).setMetallicFactor(0.2).setRoughnessFactor(0.28),
  paint2: doc.createMaterial("paint2").setBaseColorFactor([0.08, 0.08, 0.1, 1]).setMetallicFactor(0.15).setRoughnessFactor(0.35),
  carbon: doc.createMaterial("carbon").setBaseColorFactor([0.12, 0.12, 0.14, 1]).setMetallicFactor(0.35).setRoughnessFactor(0.4),
  rubber: doc.createMaterial("rubber").setBaseColorFactor([0.06, 0.06, 0.07, 1]).setMetallicFactor(0.02).setRoughnessFactor(0.9),
  rim: doc.createMaterial("rim").setBaseColorFactor([0.55, 0.56, 0.6, 1]).setMetallicFactor(0.95).setRoughnessFactor(0.2),
  accent: doc.createMaterial("accent").setBaseColorFactor([0.95, 0.95, 0.97, 1]).setMetallicFactor(0.25).setRoughnessFactor(0.3),
}

let meshSeq = 0
function addMesh(partId, geo, material, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const posAcc = doc.createAccessor().setType("VEC3").setArray(geo.positions).setBuffer(buffer)
  const nrmAcc = doc.createAccessor().setType("VEC3").setArray(geo.normals).setBuffer(buffer)
  const idxAcc = doc.createAccessor().setType("SCALAR").setArray(geo.indices).setBuffer(buffer)
  const prim = doc.createPrimitive().setAttribute("POSITION", posAcc).setAttribute("NORMAL", nrmAcc).setIndices(idxAcc).setMaterial(material)
  const mesh = doc.createMesh(`${partId}_${meshSeq++}`).addPrimitive(prim)
  // Node name is the garage part id — GltfCar reads this for selection / explode.
  const node = doc.createNode(partId).setMesh(mesh).setTranslation(pos).setRotation(eulerToQuat(...rot))
  // Also stamp extras for loaders that prefer userData.part
  node.setExtras({ part: partId })
  root.addChild(node)
}

function eulerToQuat(x, y, z) {
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2)
  const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2)
  return [
    s1 * c2 * c3 - c1 * s2 * s3,
    c1 * s2 * c3 + s1 * c2 * s3,
    c1 * c2 * s3 - s1 * s2 * c3,
    c1 * c2 * c3 + s1 * s2 * s3,
  ]
}

// ── Parts (metres, nose +Z) ────────────────────────────────────────────────
addMesh("front-wing", box(1.9, 0.06, 0.55), mats.accent, [0, 0.12, 2.35])
addMesh("front-wing", box(0.08, 0.28, 0.5), mats.paint2, [0.95, 0.22, 2.35])
addMesh("front-wing", box(0.08, 0.28, 0.5), mats.paint2, [-0.95, 0.22, 2.35])
addMesh("front-wing", box(1.6, 0.04, 0.22), mats.paint, [0, 0.2, 2.15])

addMesh("nose", box(0.28, 0.22, 1.1), mats.paint, [0, 0.28, 1.7])
addMesh("nose", box(0.16, 0.12, 0.45), mats.paint, [0, 0.22, 2.35])

addMesh("front-suspension", box(0.55, 0.04, 0.04), mats.carbon, [0.4, 0.32, 1.55])
addMesh("front-suspension", box(0.55, 0.04, 0.04), mats.carbon, [-0.4, 0.32, 1.55])
addMesh("front-suspension", box(0.5, 0.03, 0.03), mats.carbon, [0.38, 0.22, 1.55])
addMesh("front-suspension", box(0.5, 0.03, 0.03), mats.carbon, [-0.38, 0.22, 1.55])

addMesh("cockpit", box(0.72, 0.42, 1.15), mats.paint, [0, 0.42, 0.15])
addMesh("cockpit", box(0.55, 0.08, 0.7), mats.carbon, [0, 0.66, 0.05]) // halo base
addMesh("cockpit", box(0.06, 0.28, 0.55), mats.rim, [0, 0.78, 0.2]) // halo pillar
addMesh("cockpit", box(0.5, 0.05, 0.05), mats.rim, [0, 0.92, 0.05])

addMesh("sidepods", box(0.55, 0.38, 1.35), mats.paint, [0.55, 0.35, -0.35])
addMesh("sidepods", box(0.55, 0.38, 1.35), mats.paint, [-0.55, 0.35, -0.35])
addMesh("sidepods", box(0.35, 0.22, 0.08), mats.carbon, [0.55, 0.4, 0.35])
addMesh("sidepods", box(0.35, 0.22, 0.08), mats.carbon, [-0.55, 0.4, 0.35])

addMesh("floor", box(1.55, 0.04, 3.6), mats.carbon, [0, 0.06, -0.1])
addMesh("floor", box(0.28, 0.03, 2.4), mats.paint2, [0, 0.03, -0.2]) // plank

addMesh("engine-cover", box(0.55, 0.48, 1.5), mats.paint, [0, 0.5, -1.15])
addMesh("engine-cover", box(0.22, 0.35, 0.7), mats.paint, [0, 0.78, -0.55]) // airbox
addMesh("engine-cover", box(0.04, 0.35, 1.1), mats.paint2, [0, 0.7, -1.2]) // fin

addMesh("power-unit", box(0.42, 0.32, 0.7), mats.carbon, [0, 0.35, -0.85])
addMesh("power-unit", box(0.36, 0.1, 0.28), mats.rim, [0, 0.22, -0.55]) // battery pack cue

addMesh("rear-suspension", box(0.55, 0.04, 0.04), mats.carbon, [0.38, 0.32, -1.55])
addMesh("rear-suspension", box(0.55, 0.04, 0.04), mats.carbon, [-0.38, 0.32, -1.55])
addMesh("rear-suspension", box(0.28, 0.22, 0.35), mats.carbon, [0, 0.32, -1.55]) // gearbox

addMesh("diffuser", box(1.1, 0.18, 0.55), mats.carbon, [0, 0.16, -2.15])
addMesh("diffuser", box(0.02, 0.16, 0.5), mats.carbon, [0.25, 0.22, -2.15])
addMesh("diffuser", box(0.02, 0.16, 0.5), mats.carbon, [-0.25, 0.22, -2.15])

addMesh("beam-wing", box(0.95, 0.04, 0.18), mats.carbon, [0, 0.38, -2.2])

addMesh("rear-wing", box(1.05, 0.08, 0.35), mats.accent, [0, 0.95, -2.35])
addMesh("rear-wing", box(0.95, 0.05, 0.22), mats.paint, [0, 1.08, -2.48])
addMesh("rear-wing", box(0.06, 0.55, 0.4), mats.paint2, [0.52, 0.85, -2.4])
addMesh("rear-wing", box(0.06, 0.55, 0.4), mats.paint2, [-0.52, 0.85, -2.4])

function wheel(name, x, z, wide = 0.32) {
  addMesh(name, cyl(0.33, wide, 20), mats.rubber, [x, 0.33, z], [0, 0, Math.PI / 2])
  addMesh(name, cyl(0.18, wide * 0.7, 16), mats.rim, [x, 0.33, z], [0, 0, Math.PI / 2])
}
wheel("front-tyres", 0.78, 1.55, 0.28)
wheel("front-tyres", -0.78, 1.55, 0.28)
wheel("rear-tyres", 0.78, -1.55, 0.36)
wheel("rear-tyres", -0.78, -1.55, 0.36)

const io = new NodeIO()
const bytes = await io.writeBinary(doc)
const out = join(outDir, "base.glb")
writeFileSync(out, bytes)
console.log(`Wrote ${out} (${(bytes.byteLength / 1024).toFixed(1)} KB)`)
