# Hunyuan3D-2.1 → garage cars (all teams + dismantle)

Use **one good mesh** for every team. Liveries are painted in-app; you do **not** need 11 separate GLBs.

## Space

[tencent/Hunyuan3D-2.1](https://huggingface.co/spaces/tencent/Hunyuan3D-2.1) (ZeroGPU)

Also fine: [tencent/Hunyuan3D-2](https://huggingface.co/spaces/tencent/Hunyuan3D-2), [microsoft/TRELLIS.2](https://huggingface.co/spaces/microsoft/TRELLIS.2)

## Best inputs (this folder)

| File | Use |
|------|-----|
| `f1-ref-threequarter.jpg` | **Primary** — upload first |
| `ferrari-2026/side.jpg` | Strong side silhouette (optional 2nd view if Space allows) |
| `f1-ref-front.jpg` / `f1-ref-side.jpg` | Multi-view companions |
| `ferrari-2026/*` | Shape inspiration only (logos not required) |

Tips for a clean mesh:

- Plain / studio background, car filling most of the frame  
- Prefer the **blank** red refs over busy sponsor liveries when the Space melts logos into geometry  
- Generate once → download **GLB** (or OBJ → Blender → GLB)

## Drop into the app (all teams)

1. Save the export as **`public/models/cars/base.glb`**  
   (optional: `ferrari.glb`, `mclaren.glb`, … only if you want different shapes per team)
2. In `.env` / `.env.local`:
   ```bash
   NEXT_PUBLIC_AI_CAR=1
   ```
3. Restart `npm run dev`
4. Switch teams — each gets the same mesh with that team's wrap

Loader order: `{teamId}.glb` → `base.glb` → `white_mesh.glb`

## Dismantle / Explore

| Mesh type | What happens |
|-----------|----------------|
| **Fused Hunyuan blob** (typical) | Auto-split by space into garage part ids (front-wing, nose, …) so explode / select works |
| **Blender-named parts** (best) | Name each mesh exactly: `front-wing`, `nose`, `front-suspension`, `cockpit`, `sidepods`, `floor`, `engine-cover`, `power-unit`, `rear-suspension`, `diffuser`, `beam-wing`, `rear-wing`, `front-tyres`, `rear-tyres` |

Blender naming beats spatial split (cleaner cuts, flaps, tyres). Spatial split is the zero-Blender path so dismantle still works after a raw HF download.

## Quality checklist

- [ ] Car sits on the garage floor (loader grounds it)
- [ ] Length ~5–6 m before export (or trust auto-scale)
- [ ] Body reads as paint (not chrome) — materials are toned in `GltfCar`
- [ ] Explore mode: parts highlight and slide apart
- [ ] X/Z active aero: still **procedural-only** — AI mesh has no separate flaps unless you name them

## When to stay procedural

Keep `NEXT_PUBLIC_AI_CAR` unset if the Hunyuan mesh looks melted, or you need crisp X/Z flaps and selectable PU labels. Procedural remains the default for teaching.
