"use client"

import { useEffect, useState } from "react"
import { sound } from "@/lib/sound"
import { voice } from "@/lib/voice"

// One button: sound on or off. Each sound plays by itself when it belongs
// (the engine on track, Lena when she talks, music if a track is supplied).
const load = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d } catch { return d } }
const save = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch {} }

export function SoundMenu() {
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    const m = load("f1-garage:muted", "off") === "on"
    setMuted(m)
    sound.setMuted(m)
    voice.setEnabled(!m)
    // Browsers only allow audio after a user gesture: the first click unlocks it.
    const unlock = () => { if (!sound.muted) sound.unlock() }
    window.addEventListener("pointerdown", unlock)
    window.addEventListener("keydown", unlock)
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock) }
  }, [])

  const toggle = () => {
    const m = !muted
    setMuted(m)
    sound.setMuted(m)
    voice.setEnabled(!m)
    if (!m) sound.unlock()
    save("f1-garage:muted", m ? "on" : "off")
  }

  return (
    <button className={muted ? "sm-button" : "sm-button on"} onClick={toggle} aria-pressed={!muted} aria-label={muted ? "Unmute" : "Mute"} title={muted ? "Sound off" : "Sound on"}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {muted
          ? <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          : <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
      </svg>
      <span>{muted ? "Sound off" : "Sound on"}</span>
    </button>
  )
}
