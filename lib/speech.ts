// Text preparation shared by the browser (what Lena says) and the server
// (pre-generating her fixed lines), so both produce exactly the same chunks.

export const cleanSpeech = (text: string) =>
  text
    .replace(/\*\*|__|`/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/^[-*•]\s+/gm, "")
    .replace(/km\/h/g, "kilometres per hour")
    .replace(/\bkW\b/g, "kilowatts")
    .replace(/\bMJ\b/g, "megajoules")
    .replace(/\bmm\b/g, "millimetres")
    .replace(/\bERS\b/g, "E R S")
    .replace(/\bMGU-K\b/g, "M G U K")
    .replace(/\bFIA\b/g, "F I A")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim()

// Split after . ! ? followed by a space, so "26.8" and "1.2 seconds" stay
// whole, and at line breaks (list items have no full stop).
export const sentences = (text: string) => text.split(/(?<=[.!?]["')\]]?)\s+|\n+/).map(endSentence).filter(Boolean)
// A list item gets a full stop, so the voice pauses after it.
export const endSentence = (s: string) => { const t = s.trim(); return !t || /[.!?:;,"')\]]$/.test(t) ? t : `${t}.` }

const words = (s: string) => s.split(/\s+/).filter(Boolean).length

// Text longer than maxWords is spoken in parts, split at sentence ends and
// commas and packed back together so each part is as full as it can be.
export function splitLong(text: string, maxWords = 14): string[] {
  if (words(text) <= maxWords) return [text]
  const pieces = text.split(/(?<=[,;:—.!?])\s+/)
  const parts: string[] = []
  let current = ""
  for (const piece of pieces) {
    const next = current ? `${current} ${piece}` : piece
    if (current && words(next) > maxWords && words(current) >= 4) { parts.push(current); current = piece }
    else current = next
  }
  if (current) parts.length && words(current) < 4 ? (parts[parts.length - 1] += ` ${current}`) : parts.push(current)
  return parts
}

// Every chunk the voice requests for a line of text. The first sentence goes
// out on its own (split at a comma if long) so she's heard at once; after
// that sentences are grouped into fuller chunks of about 18 words or more,
// so an explanation flows naturally instead of stopping after every sentence.
export const GROUP_WORDS = 18
export const MAX_WORDS = 34
export function speechChunks(text: string): string[] {
  const all = sentences(cleanSpeech(text))
  if (!all.length) return []
  const [head, ...rest] = all
  const first = splitLong(head, 12)
  const out = [first[0]]
  let group = first.slice(1).join(" ")
  for (const s of rest) {
    group = group ? `${group} ${s}` : s
    if (words(group) >= GROUP_WORDS) { out.push(...splitLong(group, MAX_WORDS)); group = "" }
  }
  // A short tail joins the chunk before it rather than trailing on its own.
  if (group) out.length > 1 && words(group) < 8 ? (out[out.length - 1] += ` ${group}`) : out.push(group)
  return out
}

export const wordCount = words
