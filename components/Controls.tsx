"use client"

import { useEffect, useState, type ReactNode } from "react"
import { partById } from "@/lib/parts"
import { startShowcase, stopShowcase, useShowcase } from "@/lib/showcase"
import { sound } from "@/lib/sound"
import { useGarage, type CameraPreset } from "@/lib/store"

const ICONS = {
  play: <path d="M8 5l11 7-11 7z" fill="currentColor" />,
  stop: <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" />,
  drive: <><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="2.2" fill="currentColor" /><path d="M4.5 10.5h5M14.5 10.5h5M12 14v6" stroke="currentColor" strokeWidth="2" /></>,
  explode: <path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  xray: <><rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M4 12h16M12 4v16" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 2" /></>,
  wind: <path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  camera: <><rect x="3" y="7" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="13" r="3.2" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M8 7l1.5-2.5h5L16 7" fill="none" stroke="currentColor" strokeWidth="2" /></>,
  clear: <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
}

function RailButton({ icon, label, on, primary, onClick }: { icon: keyof typeof ICONS; label: string; on?: boolean; primary?: boolean; onClick: () => void }) {
  return (
    <button className={["rail-btn", on && "on", primary && "primary-rail"].filter(Boolean).join(" ")} onClick={onClick} aria-pressed={on} aria-label={label}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>{ICONS[icon]}</svg>
      <span className="rail-tip">{label}</span>
    </button>
  )
}

const CAMS: CameraPreset[] = ["hero", "side", "front", "top", "rear"]

// One compact rail of icon buttons; labels appear on hover or focus.
export function ToolRail() {
  const { mode, setMode, exploded, setExploded, technical, setTechnical, flow, setFlow, selected, highlights, select, setHighlights, setCamera } = useGarage()
  const showcase = useShowcase((s) => s.running)
  const [cam, setCam] = useState(0)
  return (
    <div className="rail" role="toolbar" aria-label="View controls">
      <RailButton icon={showcase ? "stop" : "play"} label={showcase ? "Stop showcase" : "Showcase"} primary on={showcase} onClick={() => (showcase ? stopShowcase() : startShowcase())} />
      <RailButton
        icon="drive"
        label={mode === "drive" ? "Back to the garage" : "Drive (burnout and launch)"}
        on={mode === "drive"}
        onClick={() => {
          if (mode === "drive") { if (showcase) stopShowcase(); sound.engineStop(); setMode("studio") }
          else { sound.setEngine(true); setMode("drive") }
        }}
      />
      <RailButton icon="explode" label={exploded ? "Put it back together" : "Take it apart"} on={exploded} onClick={() => setExploded(!exploded)} />
      <RailButton icon="xray" label="X-ray view" on={technical} onClick={() => setTechnical(!technical)} />
      <RailButton icon="wind" label="Airflow" on={flow} onClick={() => setFlow(!flow)} />
      <RailButton icon="camera" label={`Camera: ${CAMS[(cam + 1) % CAMS.length]}`} onClick={() => { const n = (cam + 1) % CAMS.length; setCam(n); setCamera(CAMS[n]) }} />
      {(selected || highlights.length > 0) && <RailButton icon="clear" label="Clear selection" onClick={() => { select(null); setHighlights([]) }} />}
    </div>
  )
}

// Small label that follows the cursor over the car.
export function HoverChip({ children }: { children?: ReactNode }) {
  const hovered = useGarage((s) => s.hovered)
  const selected = useGarage((s) => s.selected)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  useEffect(() => {
    const move = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY })
    window.addEventListener("pointermove", move)
    return () => window.removeEventListener("pointermove", move)
  }, [])
  const part = hovered ? partById(hovered) : undefined
  if (!part) return <>{children}</>
  return (
    <>
      {children}
      <div className="hover-chip" style={{ left: pos.x + 16, top: pos.y + 14 }}>
        <b>{part.name}</b>
        <small>{selected === part.id ? "Click to put it back" : "Click to take it off"}</small>
      </div>
    </>
  )
}
