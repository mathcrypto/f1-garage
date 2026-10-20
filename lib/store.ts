import { create } from "zustand"

export type ViewMode = "studio" | "drive"
export type CameraPreset = "hero" | "front" | "side" | "top" | "rear" | "chase"
export type Highlight = { id: string; note: string }

type GarageState = {
  teamId: string
  selected: string | null
  hovered: string | null
  exploded: boolean
  mode: ViewMode
  highlights: Highlight[]
  // Bumped on every request so the same preset can be re-applied.
  camera: { preset: CameraPreset; nonce: number }
  setTeam: (id: string) => void
  select: (id: string | null) => void
  hover: (id: string | null) => void
  setExploded: (v: boolean) => void
  setMode: (m: ViewMode) => void
  setHighlights: (h: Highlight[]) => void
  setCamera: (preset: CameraPreset) => void
}

export const useGarage = create<GarageState>((set) => ({
  teamId: "ferrari",
  selected: null,
  hovered: null,
  exploded: false,
  mode: "studio",
  highlights: [],
  camera: { preset: "hero", nonce: 0 },
  setTeam: (teamId) => set({ teamId, highlights: [] }),
  select: (selected) => set({ selected }),
  hover: (hovered) => set({ hovered }),
  setExploded: (exploded) => set(exploded ? { exploded, selected: null } : { exploded }),
  setMode: (mode) => set((s) => ({ mode, camera: { preset: mode === "drive" ? "chase" : "hero", nonce: s.camera.nonce + 1 } })),
  setHighlights: (highlights) => set({ highlights }),
  setCamera: (preset) => set((s) => ({ camera: { preset, nonce: s.camera.nonce + 1 }, selected: null })),
}))

// World-space centre of each part at rest, filled in by the 3D scene so the
// camera and labels know where to aim.
export const partCentres = new Map<string, [number, number, number]>()
