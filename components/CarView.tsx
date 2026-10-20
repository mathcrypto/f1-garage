"use client"

import type { Team } from "@/lib/teams"
import { partById } from "@/lib/parts"

// Plan view of the car, nose up, drawn in a 420×960 box. Each part is its own
// shape so it can be hovered, selected and highlighted independently.
type Shape = { id: string; d: string; fill: (t: Team) => string; stroke?: boolean }

const mirror = (d: string) => d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${420 - Number(x)},${y}`)

const SIDEPOD = "M152,380 L118,412 L104,600 L132,700 L170,712 L172,392 Z"
const CARBON = "#1d1f24"
const TYRE = "#121316"

const SHAPES: Shape[] = [
  { id: "floor", d: "M150,288 L270,288 L328,360 L346,700 L322,792 L98,792 L74,700 L92,360 Z", fill: () => CARBON },
  { id: "diffuser", d: "M118,792 L302,792 L292,842 L128,842 Z", fill: () => "#2a2d33" },
  { id: "front-suspension", d: "M186,196 L100,186 M186,252 L100,244 M234,196 L320,186 M234,252 L320,244", fill: () => "none", stroke: true },
  { id: "rear-suspension", d: "M178,690 L100,684 M178,748 L100,744 M242,690 L320,684 M242,748 L320,744", fill: () => "none", stroke: true },
  { id: "front-tyres", d: "M44,156 h56 a10,10 0 0 1 10,10 v104 a10,10 0 0 1 -10,10 h-56 a10,10 0 0 1 -10,-10 v-104 a10,10 0 0 1 10,-10 Z " + "M320,156 h56 a10,10 0 0 1 10,10 v104 a10,10 0 0 1 -10,10 h-56 a10,10 0 0 1 -10,-10 v-104 a10,10 0 0 1 10,-10 Z", fill: () => TYRE },
  { id: "rear-tyres", d: "M36,642 h68 a10,10 0 0 1 10,10 v146 a10,10 0 0 1 -10,10 h-68 a10,10 0 0 1 -10,-10 v-146 a10,10 0 0 1 10,-10 Z " + "M316,642 h68 a10,10 0 0 1 10,10 v146 a10,10 0 0 1 -10,10 h-68 a10,10 0 0 1 -10,-10 v-146 a10,10 0 0 1 10,-10 Z", fill: () => TYRE },
  { id: "front-wing", d: "M40,58 L380,58 L384,96 L336,114 L84,114 L36,96 Z", fill: (t) => t.livery.accent },
  { id: "nose", d: "M194,66 L226,66 L242,300 L178,300 Z", fill: (t) => t.livery.primary },
  { id: "sidepods", d: `${SIDEPOD} ${mirror(SIDEPOD)}`, fill: (t) => t.livery.primary },
  { id: "cockpit", d: "M178,300 L242,300 L254,476 L166,476 Z", fill: (t) => t.livery.primary },
  { id: "engine-cover", d: "M166,476 L254,476 L248,620 L228,770 L192,770 L172,620 Z", fill: (t) => t.livery.primary },
  { id: "power-unit", d: "M186,512 L234,512 L232,650 L188,650 Z", fill: () => "transparent" },
  { id: "beam-wing", d: "M138,850 L282,850 L282,864 L138,864 Z", fill: () => "#2a2d33" },
  { id: "rear-wing", d: "M84,872 L336,872 L336,920 L84,920 Z", fill: (t) => t.livery.accent },
]

// Where the numbered highlight marker sits for each part.
const ANCHORS: Record<string, [number, number]> = {
  "front-wing": [380, 70], nose: [226, 150], "front-suspension": [300, 200], cockpit: [250, 380],
  sidepods: [330, 520], floor: [348, 640], "engine-cover": [246, 700], "power-unit": [232, 560],
  "rear-suspension": [300, 720], diffuser: [296, 830], "beam-wing": [282, 857], "rear-wing": [336, 896],
  "front-tyres": [384, 236], "rear-tyres": [394, 760],
}

export function CarView({
  team,
  selected,
  highlights,
  onSelect,
}: {
  team: Team
  selected: string | null
  highlights: { id: string; note: string }[]
  onSelect: (id: string) => void
}) {
  const lit = new Set(highlights.map((h) => h.id))

  return (
    <svg className="car" viewBox="0 0 470 980" role="group" aria-label={`${team.name} ${team.car}, plan view`}>
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20,0 L0,0 0,20" fill="none" stroke="var(--grid)" strokeWidth="1" />
        </pattern>
        <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width="470" height="980" fill="url(#grid)" />

      {SHAPES.map((s) => {
        const part = partById(s.id)
        const cls = ["part", s.stroke && "part-line", selected === s.id && "is-selected", lit.has(s.id) && "is-lit", s.id === "power-unit" && "part-xray"]
          .filter(Boolean)
          .join(" ")
        return (
          <path
            key={s.id}
            d={s.d}
            className={cls}
            fill={s.fill(team)}
            stroke={s.stroke ? team.livery.secondary : undefined}
            filter={lit.has(s.id) ? "url(#glow)" : undefined}
            tabIndex={0}
            role="button"
            aria-pressed={selected === s.id}
            aria-label={part?.name}
            onClick={() => onSelect(s.id)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(s.id))}
          >
            <title>{part?.name}</title>
          </path>
        )
      })}

      {/* Livery details, purely decorative */}
      <g pointerEvents="none">
        <path d="M204,80 L216,80 L224,296 L196,296 Z" fill={team.livery.secondary} opacity="0.9" />
        <path d="M204,480 L216,480 L214,760 L206,760 Z" fill={team.livery.secondary} opacity="0.9" />
        <ellipse cx="210" cy="410" rx="20" ry="44" fill="#0b0c0e" />
        <path d="M188,372 Q210,340 232,372 M210,352 L210,334" fill="none" stroke="#3a3d44" strokeWidth="6" strokeLinecap="round" />
        <ellipse cx="210" cy="486" rx="14" ry="10" fill="#0b0c0e" />
        <path d="M44,96 L376,96 M60,106 L360,106" stroke={team.livery.secondary} strokeWidth="3" opacity="0.8" />
        <path d="M84,894 L336,894" stroke={team.livery.secondary} strokeWidth="4" opacity="0.8" />
        <text x="232" y="580" className="xray-label">PU</text>
      </g>

      {highlights.map((h, i) => {
        const a = ANCHORS[h.id]
        if (!a) return null
        const [x, y] = a
        return (
          <g key={h.id} className="marker" onClick={() => onSelect(h.id)}>
            <line x1={x} y1={y} x2={x + 26} y2={y - 18} />
            <circle cx={x + 34} cy={y - 24} r="13" />
            <text x={x + 34} y={y - 20}>{i + 1}</text>
          </g>
        )
      })}
    </svg>
  )
}
