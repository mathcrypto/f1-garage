import { Fragment, type ReactNode } from "react"

// Just enough markdown for the engineer's answers: headings, bullets, bold,
// links and paragraphs. Never renders raw HTML.
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(m[1] ? <strong key={m.index}>{m[1]}</strong> : <a key={m.index} href={m[3]} target="_blank" rel="noreferrer">{m[2]}</a>)
    last = m.index + m[0].length
  }
  out.push(text.slice(last))
  return out
}

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length) blocks.push(<ul key={blocks.length}>{list.map((li, i) => <li key={i}>{inline(li)}</li>)}</ul>)
    list = []
  }
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    const bullet = line.match(/^[-*•]\s+(.*)$/) ?? line.match(/^\d+\.\s+(.*)$/)
    if (bullet) { list.push(bullet[1]); continue }
    flush()
    if (!line) continue
    const heading = line.match(/^#{1,4}\s+(.*)$/)
    blocks.push(heading ? <h4 key={blocks.length}>{inline(heading[1])}</h4> : <p key={blocks.length}>{inline(line)}</p>)
  }
  flush()
  return <Fragment>{blocks}</Fragment>
}
