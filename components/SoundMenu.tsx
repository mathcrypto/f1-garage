"use client"

import { useEffect, useRef, useState } from "react"
import { create } from "zustand"
import { sound } from "@/lib/sound"
import { voice } from "@/lib/voice"

// The official F1 theme (Brian Tyler, © Formula 1) plays through the rights
// holders' own embeddable players, which is how they license it for the web.
const OFFICIAL = {
  spotify: "https://open.spotify.com/embed/album/7JHphIzsnmjRln1LrFdLRj?theme=0",
  apple: "https://embed.music.apple.com/us/album/formula-1-theme-single/1361376573?i=1361376912&theme=dark",
}
type Player = keyof typeof OFFICIAL | null

export const useThemePlayer = create<{ player: Player; setPlayer: (p: Player) => void }>((set) => ({
  player: null,
  setPlayer: (player) => set({ player }),
}))

function Switch({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="sm-row">
      <span><b>{label}</b>{hint && <small>{hint}</small>}</span>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden />
    </label>
  )
}

const load = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d } catch { return d } }
const save = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch {} }

export function SoundMenu() {
  const [open, setOpen] = useState(false)
  const [music, setMusic] = useState(false)
  const [engine, setEngine] = useState(false)
  const [lena, setLena] = useState(true)
  const [volume, setVolume] = useState(0.7)
  const { player, setPlayer } = useThemePlayer()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const v = load("f1-garage:voice", "on") === "on"
    setLena(v)
    voice.setEnabled(v)
    const vol = Number(load("f1-garage:volume", "0.7"))
    if (vol > 0) { setVolume(vol); sound.setVolume(vol) }
    return () => sound.stop()
  }, [])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener("pointerdown", close)
    return () => window.removeEventListener("pointerdown", close)
  }, [open])

  const anyOn = music || engine || player !== null
  const pickOfficial = (p: Player) => {
    setPlayer(player === p ? null : p)
    if (p && music) { setMusic(false); sound.setMusic(false) }
  }

  return (
    <div className="sound-menu" ref={ref}>
      <button className={anyOn ? "sm-button on" : "sm-button"} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <path d="M9 18V6l11-2v12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="6.5" cy="18" r="2.5" fill="currentColor" /><circle cx="17.5" cy="16" r="2.5" fill="currentColor" />
        </svg>
        <span>Sound</span>
        {anyOn && <i className="eq" aria-hidden><b /><b /><b /></i>}
      </button>
      {open && (
        <div className="sm-panel" role="dialog" aria-label="Sound settings">
          <p className="eyebrow">Official F1 theme</p>
          <p className="sm-note">Brian Tyler's Formula 1 theme, through its official player. Full track when you're signed in, otherwise a preview.</p>
          <div className="sm-choices">
            <button className={player === "spotify" ? "on" : ""} onClick={() => pickOfficial("spotify")}>Spotify</button>
            <button className={player === "apple" ? "on" : ""} onClick={() => pickOfficial("apple")}>Apple Music</button>
          </div>
          <hr />
          <Switch label="Garage soundtrack" hint="Original anthem made for this site" on={music} onChange={(v) => { setMusic(v); sound.setMusic(v); if (v) setPlayer(null) }} />
          <Switch label="Engine sound" hint="V6 hybrid in Drive mode" on={engine} onChange={(v) => { setEngine(v); sound.setEngine(v) }} />
          <Switch label="Lena's voice" hint={voice.supported ? "She reads her answers aloud" : "Not supported in this browser"} on={lena} onChange={(v) => { setLena(v); voice.setEnabled(v); save("f1-garage:voice", v ? "on" : "off") }} />
          <label className="sm-row volume">
            <span><b>Volume</b><small>Soundtrack and engine</small></span>
            <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => { const v = Number(e.target.value); setVolume(v); sound.setVolume(v); save("f1-garage:volume", String(v)) }} aria-label="Volume" />
          </label>
        </div>
      )}
    </div>
  )
}

// Docked official player, shown while the official theme is chosen.
export function ThemePlayer() {
  const { player, setPlayer } = useThemePlayer()
  if (!player) return null
  return (
    <div className="theme-player">
      <header><span>Official F1 Theme · Brian Tyler</span><button onClick={() => setPlayer(null)} aria-label="Close player">×</button></header>
      <iframe
        title="Official Formula 1 theme"
        src={OFFICIAL[player]}
        height={player === "spotify" ? 152 : 175}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    </div>
  )
}
