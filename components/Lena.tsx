"use client"

import { liveryFor } from "@/lib/liveries"
import { useEngineerState } from "@/lib/store"
import { teamById } from "@/lib/teams"

export const ENGINEER = { name: "Lena Moreau", role: "Race engineer" }

// Lena, drawn in SVG. She wears the selected team's kit and a pit-wall
// headset, blinks, sways a little, looks up while thinking, and her mouth
// follows the words she speaks. The kit animates in on every team change.
export function Lena({ size = 120, teamId }: { size?: number; teamId: string }) {
  const status = useEngineerState((s) => s.status)
  const mouthOpen = useEngineerState((s) => s.mouthOpen)
  const mouthShape = useEngineerState((s) => s.mouthShape)
  const team = teamById(teamId)
  const kit = liveryFor(teamId)
  const shirt = kit.base
  const panel = kit.stripe
  const trim = kit.lower
  const ink = kit.wordmarkColor === kit.base ? kit.lower : kit.wordmarkColor

  // Audio2Face-style drive: continuous jaw from voice analyser (store.mouthOpen).
  const talking = status === "talking"
  const open = talking ? mouthOpen : 0
  const shape = talking ? mouthShape : 0

  const look = status === "thinking" ? { x: 2.2, y: -2.2 } : { x: 0, y: 0 }
  const skin = "#e9b994"
  const skinShade = "#d59f7b"
  const hair = "#2a1912"
  const clip = `lena-frame-${size}`

  return (
    <svg className={`lena lena-${status}`} viewBox="0 0 200 220" width={size} height={size * 1.1} role="img" aria-label={`${ENGINEER.name}, ${ENGINEER.role}, ${team.name}`}>
      <defs>
        <clipPath id={clip}><rect width="200" height="220" rx="18" /></clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        {/* Ponytail and back hair */}
        <path d="M128 70 C160 80 166 130 150 168 C146 150 140 130 132 118 Z" fill={hair} />
        <path d="M60 92 C56 60 76 44 100 44 C126 44 146 60 140 96 L140 120 L60 120 Z" fill={hair} />

        {/* Team shirt: base colour, a sweep across the shoulders, collar, name on the chest */}
        <g key={teamId} className="lena-kit">
          <path d="M8 220 C12 190 36 178 70 172 L130 172 C164 178 188 190 192 220 Z" fill={shirt} />
          <path d="M8 220 C12 196 30 184 52 178 L64 200 C40 204 22 212 18 220 Z" fill={panel} />
          <path d="M192 220 C188 196 170 184 148 178 L136 200 C160 204 178 212 182 220 Z" fill={panel} />
          <path d="M30 206 C70 194 130 194 170 206" stroke={kit.pin} strokeWidth="2" fill="none" opacity="0.8" />
          <path d="M72 172 L100 196 L128 172 L118 170 L100 186 L82 170 Z" fill={trim} />
          <text x="62" y="207" fontFamily="'Titillium Web', sans-serif" fontWeight="900" fontStyle="italic" fontSize={kit.wordmark.length > 8 ? 7.5 : 10} fill={ink}>{kit.wordmark}</text>
          <rect x="122" y="198" width="22" height="9" rx="1.5" fill={trim} opacity="0.85" />
          <rect x="125" y="201" width="16" height="3" rx="1" fill={panel} />
        </g>

        {/* Neck */}
        <path d="M86 140 L86 174 C92 182 108 182 114 174 L114 140 Z" fill={skinShade} />

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

          {/* Mouth — jaw + viseme from live audio (A2F-style) */}
          {open < 0.06 ? (
            <path d={status === "thinking" ? "M90 130 Q100 131 109 128" : "M88 128 Q100 137 112 128"} stroke="#a2453f" strokeWidth="3" fill="none" strokeLinecap="round" />
          ) : (
            <g>
              <ellipse
                cx="100"
                cy={130.5 + open * 2}
                rx={shape === 1 ? 5.5 + open * 2 : shape === 2 ? 9 + open * 3 : 7.5 + open * 4}
                ry={2.2 + open * (shape === 3 ? 7.5 : shape === 1 ? 3.5 : 5.5)}
                fill="#6e2622"
              />
              <rect x={100 - (5 + open * 3)} y={126.5 + open} width={10 + open * 6} height={2.2 + open} rx="1.2" fill="#fff" opacity="0.9" />
            </g>
          )}

          {/* Pit-wall headset: padded band, big closed-back cups in team colours, boom mic */}
          <path d="M54 100 C48 40 152 40 146 100" stroke="#141519" strokeWidth="11" fill="none" strokeLinecap="round" />
          <path d="M60 78 C70 50 130 50 140 78" stroke={panel} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.9" />
          <g key={`cups-${teamId}`} className="lena-kit">
            {[52, 148].map((cx) => (
              <g key={cx}>
                <rect x={cx - 13} y="86" width="26" height="40" rx="12" fill="#141519" />
                <rect x={cx - 9} y="91" width="18" height="30" rx="8" fill={shirt} />
                <rect x={cx - 9} y="103" width="18" height="5" fill={panel} />
                <circle cx={cx} cy="96" r="1.6" fill="#7cf29b" />
              </g>
            ))}
          </g>
          <path d="M56 122 C58 140 68 146 80 142" stroke="#141519" strokeWidth="4" fill="none" strokeLinecap="round" />
          <ellipse cx="84" cy="141" rx="6.5" ry="4.6" fill="#2b2d33" />
          <ellipse cx="84" cy="141" rx="4.5" ry="3" fill="#3a3d45" />
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
