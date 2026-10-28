"use client"

import * as THREE from "three"
import type { ZoneLivery } from "@/lib/zoneLiveries"

/**
 * Team livery for the licensed car, painted per pixel from where a point sits
 * on the car (nose tip, cockpit, airbox, engine cover, sidepods, flow line,
 * lower body). Zones are measured on the model, fitted to the studio:
 * car length runs along z (nose at +z ≈ 2.7, gearbox at -z), y is height,
 * x is width (x > 0 is the car's left side).
 *
 * Positions and normals are stored per vertex in car space (see
 * `applyCarSpace`), so the paint stays put when pieces fly apart.
 */

/** Store car-space position and normal on the geometry for the livery shader. */
export function applyCarSpace(geometry: THREE.BufferGeometry, worldMatrix?: THREE.Matrix4) {
  const pos = geometry.attributes.position
  const nor = geometry.attributes.normal
  if (!pos) return
  const carPos = new Float32Array(pos.count * 3)
  const carNor = new Float32Array(pos.count * 3)
  const p = new THREE.Vector3()
  const n = new THREE.Vector3()
  const normalMatrix = worldMatrix ? new THREE.Matrix3().getNormalMatrix(worldMatrix) : null
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    if (worldMatrix) p.applyMatrix4(worldMatrix)
    p.toArray(carPos, i * 3)
    if (nor) {
      n.fromBufferAttribute(nor, i)
      if (normalMatrix) n.applyMatrix3(normalMatrix)
      n.normalize()
    } else {
      n.set(0, 1, 0)
    }
    n.toArray(carNor, i * 3)
  }
  geometry.setAttribute("carPos", new THREE.BufferAttribute(carPos, 3))
  geometry.setAttribute("carNormal", new THREE.BufferAttribute(carNor, 3))
}

const FINISH = {
  gloss: { roughness: 0.26, clearcoat: 0.9, clearcoatRoughness: 0.08 },
  satin: { roughness: 0.4, clearcoat: 0.45, clearcoatRoughness: 0.25 },
  matte: { roughness: 0.62, clearcoat: 0.12, clearcoatRoughness: 0.5 },
} as const

const color = (hex: string | undefined, fallback: string) => new THREE.Color(hex ?? fallback)

const NO_EMBLEM = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1)
NO_EMBLEM.needsUpdate = true
const MAX_EMBLEMS = 3

/** Show the team emblem image (or none) on a material from `zonePaint`. */
export function setEmblem(material: THREE.Material, texture: THREE.Texture | null) {
  const set = material.userData.setEmblem as ((t: THREE.Texture | null) => void) | undefined
  set?.(texture)
}

export function zonePaint(d: ZoneLivery) {
  const material = new THREE.MeshPhysicalMaterial({
    color: "#ffffff",
    metalness: 0.06,
    envMapIntensity: 0.9,
    side: THREE.DoubleSide,
    ...FINISH[d.finish],
  })

  const uniforms = {
    uBase: { value: color(d.base, d.base) },
    uRight: { value: color(d.right, d.base) },
    uFadeTo: { value: color(d.fadeTo, d.base) },
    uLower: { value: color(d.lower, d.lower) },
    uNoseTip: { value: color(d.noseTip, d.base) },
    uCockpit: { value: color(d.cockpit, d.base) },
    uAirbox: { value: color(d.airbox, d.base) },
    uCover: { value: color(d.cover, d.base) },
    uSidepod: { value: color(d.sidepod, d.base) },
    uStripe: { value: color(d.stripe, d.base) },
    uSpeckle: { value: color(d.speckle, d.base) },
    uTiger: { value: color(d.tiger, d.base) },
    uCarbon: { value: new THREE.Color("#111215") },
    // 0/1 switches for the optional zones.
    uOn: {
      value: [
        d.noseTip ? 1 : 0,
        d.cockpit ? 1 : 0,
        d.airbox ? 1 : 0,
        d.cover ? 1 : 0,
        d.sidepod ? 1 : 0,
        d.stripe ? 1 : 0,
        d.speckle ? 1 : 0,
        d.tiger ? 1 : 0,
        d.fadeTo ? 1 : 0,
        d.right ? 1 : 0,
        d.coverSides ? 1 : 0,
      ],
    },
    uStripeWidth: { value: d.stripeWidth ?? 0.03 },
    uEmblem: { value: NO_EMBLEM as THREE.Texture },
    // Per placement: centre z, centre y, width, height (0 = unused).
    uEmblemBox: { value: Array.from({ length: MAX_EMBLEMS }, () => new THREE.Vector4(0, 0, 0, 0)) },
  }
  const placements = (d.emblems ?? []).slice(0, MAX_EMBLEMS)
  material.userData.setEmblem = (texture: THREE.Texture | null) => {
    const image = texture?.image as { width?: number; height?: number } | undefined
    const aspect = image?.width && image?.height ? image.height / image.width : 0.5
    uniforms.uEmblem.value = texture ?? NO_EMBLEM
    uniforms.uEmblemBox.value.forEach((box, i) => {
      const p = texture ? placements[i] : undefined
      box.set(p?.z ?? 0, p?.y ?? 0, p?.w ?? 0, p ? p.w * aspect : 0)
    })
  }

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec3 carPos;
attribute vec3 carNormal;
varying vec3 vCarPos;
varying vec3 vCarNormal;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vCarPos = carPos;
vCarNormal = carNormal;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vCarPos;
varying vec3 vCarNormal;
uniform vec3 uBase, uRight, uFadeTo, uLower, uNoseTip, uCockpit, uAirbox, uCover, uSidepod, uStripe, uSpeckle, uTiger, uCarbon;
uniform float uOn[11];
uniform float uStripeWidth;
uniform sampler2D uEmblem;
uniform vec4 uEmblemBox[${MAX_EMBLEMS}];

float lvHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float lvNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(lvHash(i), lvHash(i + vec3(1,0,0)), f.x), mix(lvHash(i + vec3(0,1,0)), lvHash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(lvHash(i + vec3(0,0,1)), lvHash(i + vec3(1,0,1)), f.x), mix(lvHash(i + vec3(0,1,1)), lvHash(i + vec3(1,1,1)), f.x), f.y),
    f.z);
}
// Soft 0..1 step over a few millimetres so zone edges are crisp but not aliased.
float lvIn(float lo, float hi, float v) { return smoothstep(lo - 0.012, lo + 0.012, v) * (1.0 - smoothstep(hi - 0.012, hi + 0.012, v)); }

/** Height of the flank flow line along the car. */
float lvFlowLine(float z) {
  if (z > 1.2) return mix(0.55, 0.30, (z - 1.2) / 1.4);
  if (z > 0.6) return mix(0.62, 0.55, (z - 0.6) / 0.6);
  if (z > -0.8) return mix(0.74, 0.62, (z + 0.8) / 1.4);
  return mix(0.52, 0.74, (z + 2.4) / 1.6);
}

vec3 liveryColor(vec3 p, vec3 n) {
  float ax = abs(p.x);
  float side = smoothstep(0.25, 0.55, abs(n.x));

  // Base, with the optional second flank and front-to-rear fade.
  vec3 c = mix(uBase, uRight, uOn[9] * smoothstep(0.004, -0.004, p.x));
  c = mix(c, uFadeTo, uOn[8] * smoothstep(0.55, -0.55, p.z));

  // Mottled jacquard over the base.
  float sp = lvNoise(p * 26.0) * 0.6 + lvNoise(p * 70.0) * 0.4;
  c = mix(c, uSpeckle, uOn[6] * smoothstep(0.55, 0.7, sp) * 0.5);

  // Sidepods (inlet to the coke-bottle), between the floor and the pod top.
  float pod = lvIn(-1.3, 0.62, p.z) * smoothstep(0.3, 0.36, ax) * lvIn(0.18, 0.7, p.y);
  c = mix(c, uSidepod, uOn[4] * pod);
  float tiger = step(0.7, sin((p.z * 1.0 - p.y * 1.7) * 34.0)) * pod * side * smoothstep(0.55, 0.3, p.y);
  c = mix(c, uTiger, uOn[7] * tiger * 0.5);

  // Engine cover behind the cockpit, above the sidepods.
  float cover = smoothstep(-0.2, -0.32, p.z) * smoothstep(-2.5, -2.3, p.z) * smoothstep(0.62, 0.68, p.y) * smoothstep(0.5, 0.42, ax);
  c = mix(c, uCover, uOn[3] * cover * mix(1.0, side, uOn[10]));

  // Cockpit surround: the chassis top from the nose root back to the airbox.
  float cockpit = lvIn(-0.35, 0.98, p.z) * smoothstep(0.6, 0.66, p.y) * smoothstep(0.36, 0.3, ax);
  c = mix(c, uCockpit, uOn[1] * cockpit);

  // Airbox / roll hoop above and behind the driver's head.
  float airbox = lvIn(-1.0, -0.22, p.z) * smoothstep(0.82, 0.86, p.y) * smoothstep(0.3, 0.24, ax);
  c = mix(c, uAirbox, uOn[2] * airbox);

  // Nose tip.
  float tip = smoothstep(2.1, 2.14, p.z + 0.25 * (p.y - 0.4));
  c = mix(c, uNoseTip, uOn[0] * tip);

  // Flow line along the flanks.
  float stripe = side * (1.0 - smoothstep(uStripeWidth, uStripeWidth + 0.01, abs(p.y - lvFlowLine(p.z))));
  stripe *= lvIn(-2.4, 2.5, p.z);
  c = mix(c, uStripe, uOn[5] * stripe);

  // Lower body: underside of the nose and below the sidepod line.
  float lowerLine = p.z > 0.9 ? 0.0 : (p.z > -1.4 ? 0.3 : 0.36);
  float lower = max(smoothstep(-0.2, -0.4, n.y) * step(0.1, p.y), smoothstep(lowerLine + 0.01, lowerLine - 0.01, p.y));
  c = mix(c, uLower, lower);

  // Floor edge and plank stay carbon.
  c = mix(c, uCarbon, smoothstep(0.13, 0.1, p.y));

  // Team emblem, projected onto both flanks facing forward.
  for (int i = 0; i < ${MAX_EMBLEMS}; i++) {
    vec4 b = uEmblemBox[i];
    if (b.z <= 0.0) continue;
    vec2 uv = vec2(0.5 - (p.z - b.x) / b.z, (p.y - b.y) / b.w + 0.5);
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) continue;
    vec4 e = texture2D(uEmblem, uv);
    c = mix(c, e.rgb, e.a * smoothstep(0.15, 0.35, abs(n.x)));
  }
  return c;
}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
diffuseColor.rgb *= liveryColor(vCarPos, normalize(vCarNormal));`,
      )
  }
  material.customProgramCacheKey = () => "zone-livery"
  // Part clones materials per piece; a plain clone would drop the shader hook.
  material.clone = function (this: THREE.MeshPhysicalMaterial) {
    const copy = THREE.MeshPhysicalMaterial.prototype.clone.call(this)
    copy.onBeforeCompile = this.onBeforeCompile
    copy.customProgramCacheKey = this.customProgramCacheKey
    copy.clone = this.clone
    return copy
  }
  return material
}
