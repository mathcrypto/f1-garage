# 3D assets

## Two cars

- **The licensed 3D car** is used everywhere (garage, take-apart, X-ray, track), painted in each team's livery. Taking it apart moves the model's own separate pieces (wings, suspension, wheels, halo, cockpit parts…); its one-piece bodywork stays whole and stands for the nose, sidepods, engine cover and floor.
- **The code-built car** is only a fallback when no model file is found.

## The showroom car (not in this repo)

The model is a paid, licensed asset ("F1 2026 Generic Formula 1 Car", CGTrader), so it is never committed: anyone cloning the public repo gets the code-built car.

The app looks for, in order:

1. `NEXT_PUBLIC_CAR_MODEL_URL`: the model hosted outside the repo (for a deployed site, e.g. a Vercel Blob URL).
2. `cars/f1-2026.glb`: the same file locally. It is git-ignored.
3. `cars/{teamId}.glb`, `cars/ai.glb`: optional team-specific or AI-generated meshes.

`NEXT_PUBLIC_CAR_MODEL=0` always uses the code-built car.

### Preparing the file from the purchase

The web file is exported from the `.blend` with Blender's Python module (`pip install bpy`): modifiers applied, the heaviest pieces decimated, and each object tagged with a `part` extra (an id from `lib/parts.ts`, or `"split"` for the one-piece bodywork, which the app keeps whole). Then compress the geometry:

```bash
npx @gltf-transform/cli optimize f1-2026-raw.glb f1-2026.glb --compress meshopt --texture-compress false --simplify false --join false --flatten false --instance false
```

Result: about 300k triangles, 1.6 MB. The app paints its own materials (carbon, rubber, metal) and each team's 2026 livery by zone (nose tip, cockpit, airbox, engine cover, sidepods, flow line, lower body; see `lib/zoneLiveries.ts` and `components/three/car/zonePaint.ts`), so the model's textures are not needed. Sponsor and team logos are not reproduced.

## Optional: an AI-generated car

[NVIDIA PartPacker](https://huggingface.co/nvidia/PartPacker) turns one image into a 3D object already split into parts; [Hunyuan3D](https://huggingface.co/spaces/tencent/Hunyuan3D-2.1) produces one fused mesh. Save either as `cars/ai.glb`. `GltfCar` files separate pieces under the part they sit in and slices a fused mesh by region. PartPacker is under the NVIDIA Non-Commercial License.

| File | Source |
|------|--------|
| `studio.hdr` | Poly Haven Studio Small 09 (CC0) |
| `cars/refs/` | Reference images for AI generation |

## Lena lip-sync: NVIDIA Audio2Face

Live path (wired): TTS → Web Audio analyser → `mouthOpen` / `mouthShape`.

Offline bake: [Audio2Face open models](https://developer.nvidia.com/blog/nvidia-open-sources-audio2face-animation-model/) → optional `public/models/lena/visemes.json`.
