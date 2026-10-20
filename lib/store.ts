import { create } from "zustand"

export type ViewMode = "studio" | "drive" | "race"
export type TrackCam = "chase" | "tv" | "heli" | "onboard"
export type CameraPreset = "hero" | "front" | "side" | "top" | "rear" | "chase" | "low"
export type Highlight = { id: string; note: string }

type GarageState = {
  teamId: string
  selected: string | null
  hovered: string | null
  exploded: boolean
  // Showcase mode takes parts off one after another instead of all at once.
  explodeStagger: boolean
  explodeChangedAt: number
  mode: ViewMode
  highlights: Highlight[]
  // Bumped on every request so the same preset can be re-applied.
  camera: { preset: CameraPreset; nonce: number }
  // Blueprint rendering with edges, dimensions and spec callouts.
  technical: boolean
  trackCam: TrackCam
  setTrackCam: (c: TrackCam) => void
  // CFD-style airflow streamlines around the car.
  flow: boolean
  setTechnical: (v: boolean) => void
  setFlow: (v: boolean) => void
  setTeam: (id: string) => void
  select: (id: string | null) => void
  hover: (id: string | null) => void
  setExploded: (v: boolean, stagger?: boolean) => void
  setMode: (m: ViewMode) => void
  setHighlights: (h: Highlight[]) => void
  setCamera: (preset: CameraPreset) => void
}

export const useGarage = create<GarageState>((set) => ({
  teamId: "ferrari",
  selected: null,
  hovered: null,
  exploded: false,
  explodeStagger: false,
  explodeChangedAt: 0,
  mode: "studio",
  highlights: [],
  camera: { preset: "hero", nonce: 0 },
  technical: false,
  trackCam: "chase",
  setTrackCam: (trackCam) => set({ trackCam }),
  flow: false,
  setTechnical: (technical) => set({ technical }),
  setFlow: (flow) => set({ flow }),
  setTeam: (teamId) => set({ teamId, highlights: [] }),
  select: (selected) => set({ selected }),
  hover: (hovered) => set({ hovered }),
  setExploded: (exploded, stagger = false) =>
    set({ exploded, explodeStagger: stagger, explodeChangedAt: performance.now() / 1000, ...(exploded ? { selected: null } : {}) }),
  setMode: (mode) =>
    set((s) => ({
      mode,
      // Leaving the garage: nothing selected, taken apart or in X-ray.
      ...(mode === "studio" ? {} : { selected: null, exploded: false, technical: false, flow: false, highlights: [] }),
      camera: { preset: "hero", nonce: s.camera.nonce + 1 },
    })),
  setHighlights: (highlights) => set({ highlights }),
  setCamera: (preset) => set((s) => ({ camera: { preset, nonce: s.camera.nonce + 1 }, selected: null })),
}))

// World-space centre of each part at rest, filled in by the 3D scene so the
// camera and labels know where to aim.
export const partCentres = new Map<string, [number, number, number]>()

// The race engineer character: what she's doing and the line she's saying.
type EngineerState = {
  status: "idle" | "thinking" | "talking"
  caption: string
  // Toggled by speech boundaries so the mouth moves with the words.
  mouth: number
  lesson: { id: string; step: number; playing: boolean } | null
  setStatus: (s: EngineerState["status"]) => void
  setCaption: (c: string) => void
  bumpMouth: () => void
  setLesson: (l: EngineerState["lesson"]) => void
}

export const useEngineerState = create<EngineerState>((set) => ({
  status: "idle",
  caption: "",
  mouth: 0,
  lesson: null,
  setStatus: (status) => set({ status }),
  setCaption: (caption) => set({ caption }),
  bumpMouth: () => set((s) => ({ mouth: s.mouth + 1 })),
  setLesson: (lesson) => set({ lesson }),
}))
