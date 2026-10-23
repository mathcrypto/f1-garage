import "server-only"
import { CAR_SPECS, PARTS } from "../../parts"
import { REGULATIONS_2026 } from "../../regulations"
import { upgradeDiaryIndex } from "../../upgrades"

// Static garage handbook — shipped with the app. Only pre-written car-tech
// topics are "stale". Everything else gets live data tools by default.

export function garageHandbook(): string {
  const parts = PARTS.map(
    (p) =>
      `### ${p.name} (${p.id}) — ${p.system}\n` +
      `${p.summary}\n` +
      `How it works: ${p.howItWorks}\n` +
      `2026 rules: ${p.regulation2026}\n` +
      `Upgrades to watch: ${p.watchFor}\n` +
      `Specs: ${p.specs.map(([k, v]) => `${k}: ${v}`).join("; ")}`,
  ).join("\n\n")

  const regs = REGULATIONS_2026.map(
    (r) => `- **${r.title}** (${r.id}): ${r.body}\n  Detail: ${r.detail} (parts: ${r.parts.join(", ")})`,
  ).join("\n")
  const car = CAR_SPECS.map(([k, v]) => `- ${k}: ${v}`).join("\n")

  return `## Garage handbook (authoritative for how the car works — answer from here for parts, specs and 2026 headline regs; do not invent live championship or race results)

### Whole-car 2026 figures
${car}

### 2026 regulations (headlines + short chapters)
${regs}

### Team upgrades (curated packages, not a live feed)
Index of packages (call get_team_upgrades for full text; show_upgrade to highlight on the car):
${upgradeDiaryIndex()}
For confirmed race-weekend / team news, call get_team_story (FIA + trusted media + official team site). Use web_search only for narrower follow-ups.

### Parts
${parts}`
}

// Subjects that live in the pre-written handbook (do not change race-to-race).
const CAR_TECH =
  /\b(ground effect|downforce|diffuser|front[- ]?wing|rear[- ]?wing|nose|halo|sidepods?|floor|beam[- ]?wing|engine.?cover|airbox|cockpit|chassis|suspension|wishbone|tyres?|tires?|brakes?|brake duct|power unit|\bpu\b|mgu-?k|mgu-?h|\bice\b|turbo(?:charger)?|energy store|battery|ers|plank|skid|active aero|x-?mode|z-?mode|straight mode|corner mode|overtake mode|\bdrs\b|gearbox|diffuser|bargeboard|endplate|swan.?neck|pitot|carbon fibre|aerodynamics?|lesson|walk\s*me\s*through|2026 (rules?|regulations?|car)|technical regulations?|development diary|upgrade (package|diary|path)|show (me )?(the )?upgrade|how (does|do) (the |a |an )?(car|part|system|floor|wing|halo|pu|power)|what (is|are) (the |a |an )?(floor|wing|halo|diffuser|sidepod|power unit|mgu|drs|active aero))\b/i

const LIVE_SIGNAL =
  /\b(latest|recent|today|yesterday|this (week|weekend|race|gp|season)|last (race|gp|weekend)|breaking|rumour|rumor|reported|news|headline|standings?|championship|world\s*champion|leader(?:board)?|leading|ranked|ranking|table|number\s*1|no\.?\s*1|#1|who('s| is) (leading|first|top|ahead)|points|podium|result|results|qualifying|practice|fp[123]|sprint|live|timing|penalty|penalties|dsq|disqualif|stewards?|technical directive|\btd\b|brought (to|for) (this|the last)|introduced at|what did .+ bring|currently|right now|this year)\b/i

const LIVE_TABLE =
  /\b(standings?|championship|world\s*champion(?:ship)?|\bwdc\b|\bwcc\b|leader(?:board)?|leading|ranked|ranking|table|points?\s*(table|standing|leader)|number\s*1|no\.?\s*1|#1|top of (the )?(table|championship|standings|ranking)|who('s| is) (leading|first|top|ahead)|drivers?'?\s*(champ|title|standing)|constructors?'?\s*(champ|title|standing))\b/i

export function isChampionshipQuestion(question: string): boolean {
  return LIVE_TABLE.test(question.trim())
}

/** Personal / social lines — acknowledge and remember; do not dump standings. */
export function isConversationalShare(question: string): boolean {
  const q = question.trim()
  if (!q) return false
  if (/[?]/.test(q)) return false
  if (LIVE_TABLE.test(q) || LIVE_SIGNAL.test(q)) return false
  if (CAR_TECH.test(q)) return false
  return /\b(my (favourite|favorite)|i (like|love|support|prefer|root for|am a|i'm a)|favourite|favorite)\b|\b(hi|hello|hey|thanks|thank you|cheers|bye|good (morning|afternoon|evening))\b/i.test(q)
}

/** Explicit F1 season year from the user text (e.g. 2025). Null → use current season. */
export function requestedSeason(question: string, priorUserText = ""): number | null {
  const blob = `${priorUserText}\n${question}`
  // Prefer the year attached to championship / season wording in the latest ask.
  const near = question.match(/\b(19|20)\d{2}\b(?=[^.]{0,40}\b(championship|standings?|season|title|wdc|wcc|leader|leading|points)\b)|\b(?:championship|standings?|season|title|wdc|wcc|leader|leading|points)\b[^.]{0,40}\b((?:19|20)\d{2})\b/i)
  if (near) {
    const y = Number((near[0].match(/\b(?:19|20)\d{2}\b/) ?? [])[0])
    if (y >= 1950 && y <= 2100) return y
  }
  // Corrections like "i said 2025 not 2026" or bare "2025".
  const years = [...blob.matchAll(/\b((?:19|20)\d{2})\b/g)].map((m) => Number(m[1])).filter((y) => y >= 1950 && y <= 2100)
  if (!years.length) return null
  // Last mentioned year wins (user correcting "not 2026" after "2025" → 2025 if they said 2025 later, etc.)
  // Prefer years that appear with "not" as the rejected one: drop "not 2026".
  const rejected = new Set([...blob.matchAll(/\bnot\s+((?:19|20)\d{2})\b/gi)].map((m) => Number(m[1])))
  const kept = years.filter((y) => !rejected.has(y))
  return (kept.length ? kept : years).at(-1) ?? null
}

/** Live tools by default. False for car-tech handbook asks and pure conversational shares. */
export function needsFreshData(question: string, priorUserText = ""): boolean {
  const q = question.trim()
  if (!q) return true
  // "my favourite driver is Lewis" is chat, not a standings request — even mid-thread.
  if (isConversationalShare(q)) return false

  if (isChampionshipQuestion(q) || LIVE_SIGNAL.test(q)) return true
  // Fact follow-ups after a live thread (corrections / "who then?") still need tools.
  if (
    priorUserText &&
    (LIVE_SIGNAL.test(priorUserText) || isChampionshipQuestion(priorUserText)) &&
    /\b(wrong|incorrect|actually|still|who|what|which|how many|again|really|currently|now|points|position|rank|name|won|leader|leading)\b/i.test(q)
  ) {
    return true
  }

  // Live team briefing whenever they ask what the team is doing / fighting / bringing.
  if (/\b(this weekend|fighting|team (story|briefing|news)|what .+ (bringing|fighting)|document.?38)\b/i.test(q)) return true

  // Diary upgrades without "latest/news" → get_team_upgrades only (no web/standings).
  if (/\bupgrades?\b/i.test(q) && !/\b(latest|recent|news|this weekend|this race|brought)\b/i.test(q)) return false

  // Only car-tech handbook subjects are stale.
  if (CAR_TECH.test(q) && !LIVE_SIGNAL.test(q)) return false

  return true
}
