"use client"

import { useFrame } from "@react-three/fiber"
import { useMemo, useRef } from "react"
import * as THREE from "three"
import type { Motion } from "@/lib/motion"

// Tyre smoke: soft, lit billboards that pour off the rear tyres while they
// spin (burnouts and launches), then rise, swell, curl and hang in the air.
const MAX = 1400
const EMITTERS: THREE.Vector3Tuple[] = [[0.78, 0.1, -1.72], [-0.78, 0.1, -1.72]]

// Cars register here; each one smokes in proportion to its wheelspin.
export const smokeSources = new Set<{ obj: THREE.Object3D; motion: Motion; carry?: number }>()

function puffTexture() {
  const size = 256
  const c = document.createElement("canvas")
  c.width = c.height = size
  const g = c.getContext("2d")!
  // Overlapping soft blobs make an irregular, cauliflower-like puff.
  for (let i = 0; i < 26; i++) {
    const r = size * (0.12 + Math.random() * 0.22)
    const a = Math.random() * Math.PI * 2
    const d = Math.random() * size * 0.22
    const x = size / 2 + Math.cos(a) * d, y = size / 2 + Math.sin(a) * d
    const grad = g.createRadialGradient(x, y, 0, x, y, r)
    const v = 200 + Math.floor(Math.random() * 55)
    grad.addColorStop(0, `rgba(${v},${v},${v},0.32)`)
    grad.addColorStop(0.6, `rgba(${v},${v},${v},0.12)`)
    grad.addColorStop(1, `rgba(${v},${v},${v},0)`)
    g.fillStyle = grad
    g.fillRect(0, 0, size, size)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// Camera-facing quads (not GL points, whose size some GPUs cap).
const vertex = /* glsl */ `
  attribute vec3 offset;
  attribute float size;
  attribute float alpha;
  attribute float angle;
  varying float vAlpha;
  varying vec2 vUv;
  varying float vHeight;
  varying float vNear;
  void main() {
    float c = cos(angle), s = sin(angle);
    vec2 corner = vec2(c * position.x - s * position.y, s * position.x + c * position.y);
    vec4 mv = modelViewMatrix * vec4(offset, 1.0);
    mv.xy += corner * size;
    gl_Position = projectionMatrix * mv;
    vAlpha = alpha;
    vUv = uv;
    vHeight = offset.y;
    // Fade puffs that drift right up to the lens instead of whiting out the view.
    vNear = smoothstep(1.2, 5.0, -mv.z);
  }
`
const fragment = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 tint;
  varying float vAlpha;
  varying vec2 vUv;
  varying float vHeight;
  varying float vNear;
  void main() {
    vec4 tex = texture2D(map, vUv);
    // Lit from the floodlights above: brighter tops, shadowed undersides.
    float light = mix(0.55, 1.0, clamp(vHeight / 2.5, 0.0, 1.0));
    gl_FragColor = vec4(tint * tex.rgb * light, tex.a * vAlpha * vNear);
    if (gl_FragColor.a < 0.004) discard;
  }
`

export function Smoke() {
  const mesh = useRef<THREE.Mesh>(null!)
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), v: new THREE.Vector3() }), [])
  const state = useMemo(
    () => ({
      pos: new Float32Array(MAX * 3),
      vel: new Float32Array(MAX * 3),
      age: new Float32Array(MAX).fill(Infinity),
      life: new Float32Array(MAX),
      grow: new Float32Array(MAX),
      spin: new Float32Array(MAX),
      next: 0,
      carry: 0,
    }),
    [],
  )
  const geom = useMemo(() => {
    const quad = new THREE.PlaneGeometry(1, 1)
    const g = new THREE.InstancedBufferGeometry()
    g.index = quad.index
    g.setAttribute("position", quad.attributes.position)
    g.setAttribute("uv", quad.attributes.uv)
    const inst = (array: Float32Array, size: number) => new THREE.InstancedBufferAttribute(array, size).setUsage(THREE.DynamicDrawUsage)
    g.setAttribute("offset", inst(state.pos, 3))
    g.setAttribute("size", inst(new Float32Array(MAX), 1))
    g.setAttribute("alpha", inst(new Float32Array(MAX), 1))
    g.setAttribute("angle", inst(new Float32Array(MAX), 1))
    g.instanceCount = MAX
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, -6), 60)
    return g
  }, [state])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { map: { value: puffTexture() }, tint: { value: new THREE.Color("#dde1e7") } },
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
      }),
    [],
  )

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    // Emission: heavy in a burnout, thinning out through a launch.
    for (const src of smokeSources) {
      src.carry = (src.carry ?? 0) + src.motion.wheelspin * 260 * dt
      if (src.carry < 1) continue
      src.obj.updateWorldMatrix(true, false)
      while (src.carry >= 1) {
        src.carry -= 1
        const i = state.next
        state.next = (state.next + 1) % MAX
        const [ex, ey, ez] = EMITTERS[i % 2]
        const side = Math.sign(ex)
        tmp.p.set(ex + (Math.random() - 0.5) * 0.3, ey + Math.random() * 0.15, ez + (Math.random() - 0.5) * 0.3).applyMatrix4(src.obj.matrixWorld)
        // Thrown outward and backward by the spinning tyre, in the car's frame.
        tmp.v.set(side * (0.6 + Math.random() * 1.4), 0.25 + Math.random() * 0.7, -(2.5 + Math.random() * 3.5))
        const speed = tmp.v.length()
        tmp.v.transformDirection(src.obj.matrixWorld).multiplyScalar(speed)
        state.pos.set([tmp.p.x, tmp.p.y, tmp.p.z], i * 3)
        state.vel.set([tmp.v.x, tmp.v.y, tmp.v.z], i * 3)
        state.age[i] = 0
        state.life[i] = 2.4 + Math.random() * 2.0
        state.grow[i] = 1.4 + Math.random() * 1.4
        state.spin[i] = (Math.random() - 0.5) * 1.2
        ;(geom.attributes.angle.array as Float32Array)[i] = Math.random() * Math.PI * 2
      }
    }

    const size = geom.attributes.size.array as Float32Array
    const alpha = geom.attributes.alpha.array as Float32Array
    const angle = geom.attributes.angle.array as Float32Array
    for (let i = 0; i < MAX; i++) {
      if (!(state.age[i] < state.life[i])) { alpha[i] = 0; continue }
      const a = (state.age[i] += dt)
      const k = a / state.life[i]
      // Drag toward still air and a buoyant rise.
      const drag = Math.exp(-1.6 * dt)
      state.vel[i * 3] *= drag
      state.vel[i * 3 + 1] = state.vel[i * 3 + 1] * drag + 0.22 * dt
      state.vel[i * 3 + 2] *= drag
      state.pos[i * 3] += state.vel[i * 3] * dt
      state.pos[i * 3 + 1] = Math.max(0.05, state.pos[i * 3 + 1] + state.vel[i * 3 + 1] * dt)
      state.pos[i * 3 + 2] += state.vel[i * 3 + 2] * dt
      size[i] = 0.45 + state.grow[i] * Math.sqrt(k) * 1.3
      alpha[i] = Math.min(1, a / 0.15) * (1 - k) ** 2 * 0.48
      angle[i] += state.spin[i] * dt
    }
    geom.attributes.offset.needsUpdate = true
    geom.attributes.size.needsUpdate = true
    geom.attributes.alpha.needsUpdate = true
    geom.attributes.angle.needsUpdate = true
    mesh.current.visible = smokeSources.size > 0 || alpha.some((v) => v > 0)
  })

  return <mesh ref={mesh} geometry={geom} material={material} frustumCulled={false} renderOrder={5} />
}
