"use client"

import { useEffect, useState } from "react"
import { useEngineerState } from "@/lib/store"

export const ENGINEER = { name: "Lena Moreau", role: "Race engineer" }

// Lena, drawn in SVG. She wears the team's colours, blinks, sways a little,
// looks up while thinking, and her mouth follows the words she speaks.
export function Lena({ size = 120, team, team2 }: { size?: number; team: string; team2: string }) {
  const status = useEngineerState((s) => s.status)
  const mouth = useEngineerState((s) => s.mouth)
  const [open, setOpen] = useState(0)

  // Each spoken word opens the mouth briefly; a light flutter keeps it alive
  // on voices that don't report word boundaries.
  useEffect(() => {
    if (status !== "talking") { setOpen(0); return }
    setOpen(1 + (mouth % 2))
    const t = setTimeout(() => setOpen(0), 130)
    return () => clearTimeout(t)
  }, [mouth, status])
  useEffect(() => {
    if (status !== "talking") return
    const id = setInterval(() => setOpen((o) => (o ? 0 : 1 + Math.round(Math.random()))), 150)
    return () => clearInterval(id)
  }, [status])

  const look = status === "thinking" ? { x: 2.2, y: -2.2 } : { x: 0, y: 0 }
  const skin = "#e9b994"
  const skinShade = "#d59f7b"
  const hair = "#2a1912"

  return (
    <svg className={`lena lena-${status}`} viewBox="0 0 200 220" width={size} height={size * 1.1} role="img" aria-label={`${ENGINEER.name}, ${ENGINEER.role}`}>
      <defs>
        <linearGradient id="lena-polo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={team} />
          <stop offset="1" stopColor={team} stopOpacity="0.75" />
        </linearGradient>
        <clipPath id="lena-frame"><rect width="200" height="220" rx="18" /></clipPath>
      </defs>
      <g clipPath="url(#lena-frame)">
        {/* Ponytail and back hair */}
        <path d="M128 70 C160 80 166 130 150 168 C146 150 140 130 132 118 Z" fill={hair} />
        <path d="M60 92 C56 60 76 44 100 44 C126 44 146 60 140 96 L140 120 L60 120 Z" fill={hair} />

        {/* Shoulders: team polo with collar and piping */}
        <path d="M14 220 C18 192 40 180 70 174 L130 174 C160 180 182 192 186 220 Z" fill="url(#lena-polo)" />
        <path d="M70 174 L100 202 L130 174 L120 172 L100 190 L80 172 Z" fill={team2} />
        <path d="M30 196 C50 186 64 182 72 180" stroke={team2} strokeWidth="3" fill="none" opacity="0.7" />
        <path d="M170 196 C150 186 136 182 128 180" stroke={team2} strokeWidth="3" fill="none" opacity="0.7" />
        <rect x="138" y="190" width="22" height="12" rx="2" fill={team2} opacity="0.85" />

        {/* Neck */}
        <path d="M86 140 L86 176 C92 184 108 184 114 176 L114 140 Z" fill={skinShade} />

        <g className="lena-head">
          {/* Ears and face */}
          <ellipse cx="62" cy="104" rx="6" ry="9" fill={skinShade} />
          <ellipse cx="138" cy="104" rx="6" ry="9" fill={skinShade} />
          <ellipse cx="100" cy="102" rx="38" ry="46" fill={skin} />
          <ellipse cx="80" cy="120" rx="7" ry="4" fill="#e88a7a" opacity="0.22" />
          <ellipse cx="120" cy="120" rx="7" ry="4" fill="#e88a7a" opacity="0.22" />

          {/* Front hair: side-swept fringe */}
          <path d="M62 96 C60 62 82 50 104 52 C128 54 142 70 138 96 C130 78 118 70 104 68 C92 82 74 88 62 96 Z" fill={hair} />

          {/* Brows */}
          <path d={status === "thinking" ? "M74 84 Q84 77 93 82" : "M74 85 Q84 80 93 84"} stroke={hair} strokeWidth="3.2" strokeLinecap="round" fill="none" />
          <path d={status === "thinking" ? "M107 81 Q116 76 126 83" : "M107 84 Q116 80 126 85"} stroke={hair} strokeWidth="3.2" strokeLinecap="round" fill="none" />

          {/* Eyes, with a blinking lid */}
          {[84, 116].map((cx) => (
            <g key={cx}>
              <ellipse cx={cx} cy="98" rx="8" ry="5.6" fill="#fff" />
              <circle cx={cx + look.x} cy={98 + look.y} r="4.1" fill="#5a3b28" />
              <circle cx={cx + look.x} cy={98 + look.y} r="2" fill="#120c08" />
              <circle cx={cx + look.x + 1.4} cy={96.6 + look.y} r="1.1" fill="#fff" />
              <path d={`M${cx - 9} 96 Q${cx} 89 ${cx + 9} 96`} stroke="#2a1912" strokeWidth="1.8" fill="none" />
              <ellipse className="lena-lid" cx={cx} cy="97.5" rx="8.6" ry="6.2" fill={skin} />
            </g>
          ))}

          {/* Nose */}
          <path d="M100 102 Q97 114 101 117 Q104 118 106 116" stroke={skinShade} strokeWidth="2.2" fill="none" strokeLinecap="round" />

          {/* Mouth */}
          {open === 0 ? (
            <path d={status === "thinking" ? "M90 130 Q100 131 109 128" : "M88 128 Q100 137 112 128"} stroke="#a2453f" strokeWidth="3" fill="none" strokeLinecap="round" />
          ) : (
            <g>
              <ellipse cx="100" cy="131" rx={open === 2 ? 10 : 8} ry={open === 2 ? 7 : 4.5} fill="#6e2622" />
              <rect x="93" y={open === 2 ? 125 : 127} width="14" height="3" rx="1.5" fill="#fff" opacity="0.9" />
            </g>
          )}

          {/* Headset: band, ear cups, boom mic */}
          <path d="M58 104 C54 52 146 52 142 104" stroke="#1b1c20" strokeWidth="6" fill="none" strokeLinecap="round" />
          <circle cx="58" cy="106" r="14" fill="#1b1c20" />
          <circle cx="58" cy="106" r="9" fill="none" stroke={team} strokeWidth="2.5" />
          <circle cx="142" cy="106" r="11" fill="#1b1c20" />
          <path d="M60 118 C64 136 72 140 82 138" stroke="#1b1c20" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <ellipse cx="85" cy="137.5" rx="5" ry="3.6" fill="#2b2d33" />
        </g>
      </g>
      {status === "thinking" && (
        <g className="lena-dots">
          <circle cx="160" cy="40" r="4" /><circle cx="172" cy="40" r="4" /><circle cx="184" cy="40" r="4" />
        </g>
      )}
    </svg>
  )
}
