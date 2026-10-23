import "server-only"

/**
 * Nemotron reasoning models may inline their chain of thought as
 * <think>…</think> in the content stream. Splits it from the answer, including
 * tags split across chunks. On flush, an unclosed <think> is treated as answer
 * (some deployments put the whole reply there).
 */
export function thinkSplitter() {
  let inThink = false
  let buffer = ""
  const step = (chunk: string) => {
    buffer += chunk
    let answer = ""
    let reasoning = ""
    while (buffer) {
      const tag = inThink ? "</think>" : "<think>"
      const at = buffer.indexOf(tag)
      if (at >= 0) {
        if (inThink) reasoning += buffer.slice(0, at)
        else answer += buffer.slice(0, at)
        buffer = buffer.slice(at + tag.length)
        inThink = !inThink
        continue
      }
      // Hold back a possible partial tag at the end.
      let keep = 0
      for (let k = Math.min(tag.length - 1, buffer.length); k > 0; k--) {
        if (tag.startsWith(buffer.slice(-k))) { keep = k; break }
      }
      const out = buffer.slice(0, buffer.length - keep)
      if (inThink) reasoning += out
      else answer += out
      buffer = buffer.slice(buffer.length - keep)
      break
    }
    return { answer, reasoning }
  }
  const flush = () => {
    const answer = buffer
    buffer = ""
    return { answer, reasoning: "" }
  }
  return Object.assign(step, { flush })
}

const FILLER = /^(?:right|okay|ok|alright|all right|so|well|now|sure|great|good question|nice one|copy(?: that)?)\b[\s,.!:;—–-]*/i

/**
 * Holds back the first words of the answer to drop filler openers ("Right,",
 * "So,", "Copy.") that the prompt forbids but models still produce.
 */
export function openingFilter() {
  let buffer = ""
  let done = false
  let spoken = false
  const finish = () => {
    done = true
    let text = buffer.replace(/^\s+/, "")
    for (let i = 0; i < 3 && FILLER.test(text); i++) text = text.replace(FILLER, "")
    if (!text) return ""
    spoken = true
    return `${text.charAt(0).toUpperCase()}${text.slice(1)}`
  }
  return {
    push(text: string) {
      if (done) {
        if (text.trim()) spoken = true
        return text
      }
      buffer += text
      return buffer.trim().length >= 24 ? finish() : ""
    },
    flush: () => (done ? "" : finish()),
    hasSpoken: () => spoken,
  }
}
