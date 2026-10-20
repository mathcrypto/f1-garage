"use client"

import { useEffect, useRef, useState } from "react"
import { sound } from "@/lib/sound"
import { voice } from "@/lib/voice"

// Everything you hear is made in the browser: the anthem, the engine and
// Lena's voice. Nothing streams from a third-party service.

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
  const [radio, setRadio] = useState(true)
  const [natural, setNatural] = useState<boolean | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const v = load("f1-garage:voice", "on") === "on"
    setLena(v)
    voice.setEnabled(v)
    const r = load("f1-garage:radio", "on") === "on"
    setRadio(r)
    voice.setRadio(r)
    void voice.provider().then((p) => setNatural(Boolean(p)))
    const vol = Number(load("f1-garage:volume", "0.7"))
    if (vol > 0) { setVolume(vol); sound.setVolume(vol) }
    return () => sound.stop()
  }, [])

  // The showcase and Drive can switch sounds on by themselves; reflect that when opening.
  useEffect(() => {
    if (open) { setMusic(sound.musicOn); setEngine(sound.engineOn) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener("pointerdown", close)
    return () => window.removeEventListener("pointerdown", close)
  }, [open])

  const anyOn = music || engine

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
          <p className="eyebrow">Sound</p>
          <Switch label="F1 Garage anthem" hint="Original soundtrack made for this site" on={music} onChange={(v) => { setMusic(v); sound.setMusic(v) }} />
          <Switch label="Engine sound" hint="V6 hybrid in Drive mode" on={engine} onChange={(v) => { setEngine(v); sound.setEngine(v) }} />
          <Switch
            label="Lena's voice"
            hint={natural ? "Natural British voice" : natural === false ? "Browser voice · add a TTS key for a natural one" : "British English"}
            on={lena}
            onChange={(v) => { setLena(v); voice.setEnabled(v); save("f1-garage:voice", v ? "on" : "off") }}
          />
          <Switch label="Team radio effect" hint="Radio filter and beeps on her voice" on={radio} onChange={(v) => { setRadio(v); voice.setRadio(v); save("f1-garage:radio", v ? "on" : "off") }} />
          <label className="sm-row volume">
            <span><b>Volume</b><small>Anthem and engine</small></span>
            <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => { const v = Number(e.target.value); setVolume(v); sound.setVolume(v); save("f1-garage:volume", String(v)) }} aria-label="Volume" />
          </label>
        </div>
      )}
    </div>
  )
}
