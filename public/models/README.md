# AI 3D assets (Hunyuan3D-2.1 · TRELLIS · Audio2Face)

## Two cars

- **Showroom:** the AI mesh in `cars/` (when present), painted in each team's livery. It is a single outer surface: realistic whole, but hollow if sliced.
- **Engineering:** the code-built car with solid parts and moving Straight/Corner Mode flaps. Used whenever the car is taken apart, a part is selected or the X-ray is on, and whenever no mesh file is present.

## Optional: NVIDIA PartPacker car (recommended AI option)

[PartPacker](https://huggingface.co/nvidia/PartPacker) (NVIDIA research) turns one image into a 3D object that is already split into parts, which suits taking the car apart.

1. Open NVIDIA's demo: https://huggingface.co/spaces/nvidia/PartPacker
2. Upload one image of a modern F1 car: three-quarter front view, the whole car in frame, plain background, no people or other cars.
3. Generate, then download the GLB.
4. Save it as `cars/partpacker.glb`.
5. Restart or redeploy. The file is used automatically (`NEXT_PUBLIC_AI_CAR=0` turns AI cars off).

`GltfCar` keeps each generated piece whole and files it under the car part it sits in (nose, sidepods, floor, wings, wheels), paints the bodywork in the team livery and the aero parts in carbon. Without the file or the variable, the code-built car is used.

**Licence:** the PartPacker model is under the NVIDIA Non-Commercial License. Fine for the hackathon; replace this file with a commercially licensed model before any commercial use.

## Optional: one Hunyuan mesh for every team

1. Generate on [Hunyuan3D-2.1](https://huggingface.co/spaces/tencent/Hunyuan3D-2.1) using refs in `cars/refs/` (see `cars/refs/UPLOAD.md`).
2. Save as `cars/base.glb`.
3. Restart the dev server. It is used automatically (`NEXT_PUBLIC_AI_CAR=0` turns AI cars off).

`TeamCar` loads `{teamId}.glb` → `base.glb` → `white_mesh.glb`. **One `base.glb` is enough** — each team gets that team's livery wrap.

### Dismantle

- **Named meshes** (Blender): use part ids from `lib/parts.ts`.
- **Fused blob** (raw Hunyuan): `GltfCar` auto-partitions by spatial regions so Explore / explode still works.

| File | Source |
|------|--------|
| `cars/base.glb` / `white_mesh.glb` | HF Hunyuan / TRELLIS export |
| `studio.hdr` | Poly Haven Studio Small 09 (CC0) |
| `cars/refs/` | Upload images + Ferrari 2026 inspiration |

## Lena lip-sync — NVIDIA Audio2Face

Live path (wired): TTS → Web Audio analyser → `mouthOpen` / `mouthShape`.

Offline bake: [Audio2Face open models](https://developer.nvidia.com/blog/nvidia-open-sources-audio2face-animation-model/) → optional `public/models/lena/visemes.json`.
