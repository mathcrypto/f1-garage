"use client"

import { useEffect, useState } from "react"
import { useGarage } from "@/lib/store"
import { teamById } from "@/lib/teams"

type Paddock = {
  calendar: { season: string; next: { round: number; name: string; circuit: string; place: string; start: string }[]; totalRounds: number } | null
  lastResult: { name: string; podium: { position: number; driver: string; team: string }[] } | null
  standings: { afterRound: number | null; constructors: { position: string; team: string; points: number; wins: number }[] } | null
  live: { live: boolean; session: string; event: string; raceControl: { time: string; flag: string | null; message: string; lap: number | null }[] } | null
  news: { title: string; url: string; publishedDate: string; summary: string }[] | null
}

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" })
}

function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const ms = Math.max(0, new Date(to).getTime() - now)
  const d = Math.floor(ms / 86_400_000), h = Math.floor(ms / 3_600_000) % 24, m = Math.floor(ms / 60_000) % 60, s = Math.floor(ms / 1000) % 60
  return (
    <div className="countdown" aria-label="Time to lights out">
      {[[d, "days"], [h, "hrs"], [m, "min"], [s, "sec"]].map(([v, l]) => (
        <div key={l as string}><span>{String(v).padStart(2, "0")}</span><small>{l}</small></div>
      ))}
    </div>
  )
}

// Matches a Jolpica constructor name to the team being viewed.
const sameTeam = (name: string, teamName: string) => {
  const a = name.toLowerCase(), b = teamName.toLowerCase()
  return a.split(" ").some((w) => w.length > 3 && b.includes(w)) || b.split(" ").some((w) => w.length > 3 && a.includes(w))
}

export function PaddockPanel() {
  const teamId = useGarage((s) => s.teamId)
  const team = teamById(teamId)
  const [data, setData] = useState<Paddock | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/paddock?team=${teamId}`)
      .then((r) => r.json())
      .then((d: Paddock) => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setData(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [teamId])

  if (loading) return <div className="paddock"><div className="skeleton" /><div className="skeleton" /><div className="skeleton short" /></div>

  const next = data?.calendar?.next[0]
  return (
    <div className="paddock">
      {data?.live && (
        <section className="pcard">
          <header><h4>{data.live.live ? <><span className="live-dot" /> Live now</> : "Latest session"}</h4><span className="muted">{data.live.session} · {data.live.event}</span></header>
          {data.live.raceControl.length > 0 ? (
            <ul className="rc">
              {data.live.raceControl.slice(0, 5).map((m, i) => (
                <li key={i}><span className={`flag flag-${(m.flag ?? "none").toLowerCase().replace(/\s+/g, "-")}`} />{m.lap ? <b>L{m.lap}</b> : null} {m.message}</li>
              ))}
            </ul>
          ) : <p className="muted">No race control messages.</p>}
        </section>
      )}

      {next && (
        <section className="pcard">
          <header><h4>Next race · Round {next.round}</h4><span className="muted">{fmtDate(next.start)}</span></header>
          <p className="race-name">{next.name}</p>
          <p className="muted">{next.circuit} · {next.place}</p>
          <Countdown to={next.start} />
        </section>
      )}

      {data?.lastResult && (
        <section className="pcard">
          <header><h4>Last race</h4><span className="muted">{data.lastResult.name}</span></header>
          <ol className="podium">
            {data.lastResult.podium.map((p) => <li key={p.position}><b>P{p.position}</b> {p.driver} <span className="muted">{p.team}</span></li>)}
          </ol>
        </section>
      )}

      {data?.standings && data.standings.constructors.length > 0 && (
        <section className="pcard">
          <header><h4>Constructors</h4>{data.standings.afterRound ? <span className="muted">after round {data.standings.afterRound}</span> : null}</header>
          <ol className="standings">
            {data.standings.constructors.map((c) => (
              <li key={c.team} className={sameTeam(c.team, team.name) ? "mine" : ""}>
                <span className="pos">{c.position}</span><span className="name">{c.team}</span><span className="pts">{c.points}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="pcard">
        <header><h4>{team.name} news</h4><span className="muted">last 7 days</span></header>
        {data?.news?.length ? (
          <ul className="news">
            {data.news.map((n) => (
              <li key={n.url}>
                <a href={n.url} target="_blank" rel="noreferrer">{n.title}</a>
                <span className="muted">{(() => { try { return new URL(n.url).hostname.replace(/^www\./, "") } catch { return "" } })()}{n.publishedDate ? ` · ${fmtDate(n.publishedDate)}` : ""}</span>
              </li>
            ))}
          </ul>
        ) : <p className="muted">{data?.news === null ? "Add TAVILY_API_KEY to load team news." : "No news this week."}</p>}
      </section>

      {!data?.calendar && !data?.standings && !data?.live && (
        <p className="muted small">Live timing and results come from OpenF1 and Jolpica-F1. They're unreachable right now; try again shortly.</p>
      )}
      <p className="muted small">Sources: OpenF1 (live timing), Jolpica-F1 (calendar and standings), Tavily (news).</p>
    </div>
  )
}
