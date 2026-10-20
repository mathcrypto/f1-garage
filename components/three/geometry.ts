import * as THREE from "three"

// The car is modelled in metres, nose toward +Z, ground at y = 0.

export type Section = { z: number; w: number; h: number; y: number; x?: number; n?: number }

// Lofts a smooth body through superellipse cross-sections. n = 2 is an
// ellipse; higher n gets boxier, which suits chassis and sidepods.
export function loft(sections: Section[], radial = 40): THREE.BufferGeometry {
  const pos: number[] = []
  const idx: number[] = []
  for (const s of sections) {
    const n = s.n ?? 2.6
    for (let i = 0; i < radial; i++) {
      const t = (i / radial) * Math.PI * 2
      const c = Math.cos(t), si = Math.sin(t)
      pos.push(
        (s.x ?? 0) + (s.w / 2) * Math.sign(c) * Math.abs(c) ** (2 / n),
        s.y + (s.h / 2) * Math.sign(si) * Math.abs(si) ** (2 / n),
        s.z,
      )
    }
  }
  for (let r = 0; r < sections.length - 1; r++) {
    for (let i = 0; i < radial; i++) {
      const a = r * radial + i, b = r * radial + ((i + 1) % radial)
      const c = a + radial, d = b + radial
      idx.push(a, c, b, b, c, d)
    }
  }
  // Close both ends with a centre fan.
  for (const [r, flip] of [[0, true], [sections.length - 1, false]] as const) {
    const s = sections[r]
    const centre = pos.length / 3
    pos.push(s.x ?? 0, s.y, s.z)
    for (let i = 0; i < radial; i++) {
      const a = r * radial + i, b = r * radial + ((i + 1) % radial)
      flip ? idx.push(centre, b, a) : idx.push(centre, a, b)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  // Lofts are drawn front (+z) to back, so flip winding if the first ring is behind.
  if (sections[0].z < sections[sections.length - 1].z) g.index!.array.reverse()
  g.computeVertexNormals()
  return g
}

// Inverted aerofoil spanning X, chord running back from z = 0 to z = -chord.
export function airfoil(span: number, chord: number, thickness = 0.1): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  const pts = 24
  const yt = (x: number) =>
    5 * thickness * chord * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x ** 2 + 0.2843 * x ** 3 - 0.1036 * x ** 4)
  const camber = (x: number) => -0.04 * chord * 4 * x * (1 - x)
  for (let i = 0; i <= pts; i++) {
    const x = i / pts
    i === 0 ? shape.moveTo(x * chord, camber(x) + yt(x)) : shape.lineTo(x * chord, camber(x) + yt(x))
  }
  for (let i = pts; i >= 0; i--) {
    const x = i / pts
    shape.lineTo(x * chord, camber(x) - yt(x))
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: span, bevelEnabled: false, curveSegments: 4 })
  g.translate(0, 0, -span / 2)
  g.rotateY(Math.PI / 2)
  g.computeVertexNormals()
  return g
}

// Flat plate from a 2D outline given in (x, z), mirrored about the centreline.
export function plate(halfOutline: [number, number][], thickness: number): THREE.BufferGeometry {
  const full = [...halfOutline, ...[...halfOutline].reverse().map(([x, z]) => [-x, z] as [number, number])]
  const shape = new THREE.Shape(full.map(([x, z]) => new THREE.Vector2(x, z)))
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.006, bevelSegments: 2 })
  g.rotateX(Math.PI / 2)
  g.computeVertexNormals()
  return g
}

// Side profile (z, y) extruded across a thickness in X, e.g. endplates and the shark fin.
export function profile(points: [number, number][], thickness: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)))
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false })
  g.translate(0, 0, -thickness / 2)
  g.rotateY(-Math.PI / 2)
  g.computeVertexNormals()
  return g
}

// Tyre as a lathe of a rounded sidewall profile; axle along X once rotated.
export function tyre(outer: number, inner: number, width: number): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = []
  const r = Math.min(0.07, width * 0.28)
  const half = width / 2
  pts.push(new THREE.Vector2(inner, -half * 0.92))
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * (Math.PI / 2)
    pts.push(new THREE.Vector2(outer - r + Math.cos(a) * r, -half + r + Math.sin(a) * r))
  }
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2)
    pts.push(new THREE.Vector2(outer - r + Math.cos(a) * r, half - r + Math.sin(a) * r))
  }
  pts.push(new THREE.Vector2(inner, half * 0.92))
  const g = new THREE.LatheGeometry(pts, 64)
  g.rotateZ(Math.PI / 2)
  g.computeVertexNormals()
  return g
}

export function rod(a: THREE.Vector3Tuple, b: THREE.Vector3Tuple, radius = 0.014) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b)
  const len = va.distanceTo(vb)
  const g = new THREE.CapsuleGeometry(radius, len, 4, 10)
  // Aerofoil-section wishbones: flatten the round tube.
  g.scale(1.8, 1, 0.7)
  const mid = va.clone().add(vb).multiplyScalar(0.5)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize())
  g.applyQuaternion(q)
  g.translate(mid.x, mid.y, mid.z)
  return g
}

export function tube(points: THREE.Vector3Tuple[], radius: number, segments = 64) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)))
  return new THREE.TubeGeometry(curve, segments, radius, 14, false)
}
