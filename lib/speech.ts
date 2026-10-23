// Text preparation shared by the browser (what Lena says) and the server
// (pre-generating her fixed lines), so both produce exactly the same chunks.

export const cleanSpeech = (text: string) =>
  text
    .replace(/\*\*|__|`/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/^[-*•]\s+/gm, "")
    .replace(/^\s*Copy(?: that)?[.!]?\s*/i, "")
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

/** Only split very long briefings — each Edge request is one continuous take. */
export const GROUP_WORDS = 70
export const MAX_WORDS = 90

export function splitLong(text: string, maxWords = MAX_WORDS): string[] {
  if (words(text) <= maxWords) return [text]
  const pieces = text.split(/(?<=[.!?])\s+/)
  const parts: string[] = []
  let current = ""
  for (const piece of pieces) {
    const next = current ? `${current} ${piece}` : piece
    if (current && words(next) > maxWords) {
      parts.push(current)
      current = piece
    } else current = next
  }
  if (current) parts.push(current)
  return parts
}

/** Prefer a single TTS take so there are no joins mid-sentence. */
export function speechChunks(text: string): string[] {
  const cleaned = cleanSpeech(text)
  if (!cleaned) return []
  const joined = sentences(cleaned).join(" ")
  if (words(joined) <= MAX_WORDS) return [joined]
  return splitLong(joined, MAX_WORDS)
}

export const wordCount = words
