# `components/three` — React Three Fiber scene

Three.js / R3F code only (meshes, canvas, camera). DOM UI stays in `components/`.

| Path | Role |
|------|------|
| `Scene.tsx` | Canvas entry: lights, HDR, postprocessing, garage vs track |
| `car/` | Procedural + optional GLB car, parts, livery, geometry helpers |
| `track/` | Circuit mesh, drive/race sessions, track camera |
| `lib/track.ts` + `lib/circuits/` | Path math; Monza ~5.8 km (bacinger/f1-circuits) |
| `fx/` | Smoke, airflow / blueprint overlays |

Import the canvas from the UI with `dynamic(() => import("./three/Scene"), { ssr: false })`.
