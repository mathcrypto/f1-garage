"use client"

import * as THREE from "three"
import type { SponsorDecal } from "@/lib/sponsors"
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

const NO_ATLAS = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1)
NO_ATLAS.needsUpdate = true
const MAX_DECALS = 12

type DecalRect = { u: number; v: number; su: number; sv: number; aspect: number }
export type SponsorAtlas = { texture: THREE.Texture; rects: DecalRect[] }

type DecalUniforms = {
  uAtlas: { value: THREE.Texture }
  uBox: { value: THREE.Vector4[] }
  uUv: { value: THREE.Vector4[] }
  uFlag: { value: THREE.Vector4[] }
}

function decalUniforms(): DecalUniforms {
  return {
    uAtlas: { value: NO_ATLAS },
    uBox: { value: Array.from({ length: MAX_DECALS }, () => new THREE.Vector4()) },
    uUv: { value: Array.from({ length: MAX_DECALS }, () => new THREE.Vector4()) },
    uFlag: { value: Array.from({ length: MAX_DECALS }, () => new THREE.Vector4()) },
  }
}

const DECAL_GLSL = `
uniform sampler2D uAtlas;
uniform vec4 uBox[${MAX_DECALS}];
uniform vec4 uUv[${MAX_DECALS}];
uniform vec4 uFlag[${MAX_DECALS}];
// Logos are sampled with explicit gradients (textureGrad) built from the
// car-position derivatives taken once, before the loop. Implicit derivatives
// are undefined after a per-pixel \`continue\`, which picks the wrong mip and
// breaks the lettering up. Masks fade gently, so a word wraps curved
// bodywork instead of being cut off where the panel turns.
vec3 applyDecals(vec3 c, vec3 p, vec3 n) {
  vec3 dpx = dFdx(p);
  vec3 dpy = dFdy(p);
  if (p.y < 0.12) return c;
  for (int i = 0; i < ${MAX_DECALS}; i++) {
    vec4 b = uBox[i];
    if (b.z <= 0.0 || b.w <= 0.0) continue;
    float side = uFlag[i].x;
    bool top = side > 1.5;
    float facing = top
      ? abs(n.y)
      : side > 0.5
        ? n.x
        : side < -0.5
          ? -n.x
          // Outward-facing only: an inward face (inside of an endplate) would
          // show the word mirrored.
          : n.x * sign(p.x);
    if (top && abs(p.y - b.y) > 0.18) continue;
    float mask = top
      ? smoothstep(0.3, 0.55, facing)
      : smoothstep(0.04, 0.18, facing)
        // Fade only on faces that look mostly forward or back (nose and tail
        // ends), where a side projection would smear the word.
        * (1.0 - smoothstep(1.4, 2.6, abs(n.z) / max(abs(n.x), 1e-3)))
        * smoothstep(0.16, 0.22, abs(p.x));
    if (mask <= 0.0) continue;
    // Flanks are the side view (z, y). Top surfaces are the plan view (z, x).
    // Flip from car position so curved pods don't reverse the word mid-letter.
    float flip = p.x > 0.0 ? -1.0 : 1.0;
    float along = (p.z - b.x) / b.z;
    vec2 uv = vec2(0.5 + flip * along, top ? p.x / b.w + 0.5 : (p.y - b.y) / b.w + 0.5);
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) continue;
    vec4 r = uUv[i];
    vec2 gx = vec2(flip * dpx.z / b.z, (top ? dpx.x : dpx.y) / b.w) * r.zw;
    vec2 gy = vec2(flip * dpy.z / b.z, (top ? dpy.x : dpy.y) / b.w) * r.zw;
    vec4 e = textureGrad(uAtlas, r.xy + uv * r.zw, gx, gy);
    // The atlas is premultiplied: blend colour and coverage together.
    c = c * (1.0 - e.a * mask) + e.rgb * mask;
  }
  return c;
}`

/** Keep the compiled livery/decal shader when a part clones its material. */
function keepShader(material: THREE.MeshPhysicalMaterial) {
  const compile = material.onBeforeCompile
  const key = material.customProgramCacheKey
  material.clone = function (this: THREE.MeshPhysicalMaterial) {
    const copy = THREE.MeshPhysicalMaterial.prototype.clone.call(this)
    copy.onBeforeCompile = compile
    copy.customProgramCacheKey = key
    copy.clone = this.clone
    return copy
  }
}

function applySponsorAtlas(uniforms: DecalUniforms, placements: SponsorDecal[], atlas: SponsorAtlas | null) {
  const rects = atlas?.rects ?? []
  uniforms.uAtlas.value = atlas?.texture ?? NO_ATLAS
  uniforms.uBox.value.forEach((box, i) => {
    const place = atlas ? placements[i] : undefined
    const rect = rects[i]
    const h = place && rect && rect.aspect > 0 ? place.w * rect.aspect : 0
    box.set(place?.z ?? 0, place?.y ?? 0, h > 0 ? place!.w : 0, h)
    uniforms.uUv.value[i].set(rect?.u ?? 0, rect?.v ?? 0, rect?.su ?? 0, rect?.sv ?? 0)
    uniforms.uFlag.value[i].set(place?.side ?? 0, 0, 0, 0)
  })
}

/** Project the same sponsor atlas onto a solid material (wings, endplates). */
export function attachDecals(material: THREE.MeshPhysicalMaterial, uniforms: DecalUniforms) {
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
      .replace("#include <common>", `#include <common>\nvarying vec3 vCarPos;\nvarying vec3 vCarNormal;\n${DECAL_GLSL}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
diffuseColor.rgb = applyDecals(diffuseColor.rgb, vCarPos, normalize(vCarNormal));`,
      )
  }
  material.customProgramCacheKey = () => "solid-decals-v13"
  keepShader(material)
}

export function zonePaint(d: ZoneLivery, placements: SponsorDecal[] = []) {
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
    uFlank: { value: color(d.flank, d.base) },
    uFlankOn: { value: d.flank ? 1 : 0 },
    uRearFlash: { value: color(d.rearFlash, d.base) },
    uRearFlashOn: { value: d.rearFlash ? 1 : 0 },
    uHalo: { value: color(d.halo, d.base) },
    uHaloOn: { value: d.halo ? 1 : 0 },
    uNoseTipZ: { value: d.noseTipFrom ?? 2.1 },
    uLowerRise: { value: d.lowerRise ?? 0 },
  }
  const decals = decalUniforms()
  const spots = placements.slice(0, MAX_DECALS)
  material.userData.decals = decals
  material.userData.spots = spots
  material.userData.setSponsors = (atlas: SponsorAtlas | null) => applySponsorAtlas(decals, spots, atlas)

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, decals)
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
uniform vec3 uFlank, uRearFlash, uHalo;
uniform float uFlankOn, uRearFlashOn, uHaloOn, uNoseTipZ, uLowerRise;
${DECAL_GLSL}

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
  c = mix(c, uSpeckle, uOn[6] * smoothstep(0.62, 0.82, sp) * 0.18);

  // Sidepod sides in a second colour, below the pod shoulder; tops keep the base.
  float flank = smoothstep(0.35, 0.6, abs(n.x)) * lvIn(-1.7, 0.65, p.z) * smoothstep(0.7, 0.64, p.y) * smoothstep(0.3, 0.38, ax);
  c = mix(c, uFlank, uFlankOn * flank);

  // Flash low on the rear flank, ahead of the rear wheel.
  float rearFlash = side * lvIn(-2.45, -1.15, p.z) * lvIn(0.3, mix(0.62, 0.5, (p.z + 2.45) / 1.3), p.y);
  c = mix(c, uRearFlash, uRearFlashOn * rearFlash);

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
  float tip = smoothstep(uNoseTipZ, uNoseTipZ + 0.04, p.z + 0.25 * (p.y - 0.4));
  c = mix(c, uNoseTip, uOn[0] * tip);

  // Halo: the hoop over the cockpit, ahead of the airbox.
  float halo = lvIn(-0.2, 0.78, p.z) * smoothstep(0.8, 0.84, p.y);
  c = mix(c, uHalo, uHaloOn * halo);

  // Flow line along the flanks.
  float stripe = side * (1.0 - smoothstep(uStripeWidth, uStripeWidth + 0.01, abs(p.y - lvFlowLine(p.z))));
  stripe *= lvIn(-2.4, 2.5, p.z);
  c = mix(c, uStripe, uOn[5] * stripe);

  // Lower body: underside of the nose and below the sidepod line.
  float lowerLine = p.z > 0.9 ? 0.0 : (p.z > -1.4 ? 0.3 + uLowerRise * clamp((0.6 - p.z) / 2.0, 0.0, 1.0) : 0.36 + uLowerRise);
  float lower = max(smoothstep(-0.2, -0.4, n.y) * step(0.1, p.y), smoothstep(lowerLine + 0.01, lowerLine - 0.01, p.y));
  c = mix(c, uLower, lower);

  // Floor edge and plank stay carbon.
  c = mix(c, uCarbon, smoothstep(0.13, 0.1, p.y));

  return applyDecals(c, p, n);
}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
diffuseColor.rgb *= liveryColor(vCarPos, normalize(vCarNormal));`,
      )
  }
  material.customProgramCacheKey = () => "zone-livery-decals-v13"
  keepShader(material)
  return material
}
