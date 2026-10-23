"use client"

import { useEffect, useState } from "react"
import { useGarage } from "@/lib/store"
import { teamById } from "@/lib/teams"

type Paddock = {
  calendar: { season: string; next: { round: number; name: string; circuit: string; place: string; start: string }[]; totalRounds: number } | null
  lastResult: { name: string; podium: { position: number; driver: string; team: string }[] } | null
  standings: { afterRound: number | null; constructors: { position: string; team: string; id?: string; points: number; wins: number }[] } | null
  news: { title: string; url: string; publishedDate: string; summary: string }[] | null
}

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" })
}

const fmtRaceDay = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })
}

/** "United States Grand Prix" → short country-style label when possible. */
const raceHeadline = (name: string) =>
  name.replace(/\s+Grand Prix$/i, "").trim() || name

const raceCountry = (place: string) => {
  const parts = place.split(",").map((p) => p.trim()).filter(Boolean)
  return parts.at(-1) ?? place
}

function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const ms = Math.max(0, new Date(to).getTime() - now)
  const d = Math.floor(ms / 86_400_000), h = Math.floor(ms / 3_600_000) % 24, m = Math.floor(ms / 60_000) % 60, s = Math.floor(ms / 1000) % 60
  const gone = ms <= 0
  return (
    <div className="countdown" aria-label="Time to lights out">
      {(gone ? [[0, "days"], [0, "hrs"], [0, "min"], [0, "sec"]] : [[d, "days"], [h, "hrs"], [m, "min"], [s, "sec"]]).map(([v, l]) => (
        <div key={l as string} className="countdown-cell">
          <span>{String(v).padStart(2, "0")}</span>
          <small>{l}</small>
        </div>
      ))}
    </div>
  )
}

/** Map Jolpica constructorId → our garage team id (exact, no fuzzy name colour bugs). */
const JOLPICA_TEAM: Record<string, string> = {
  ferrari: "ferrari",
  mercedes: "mercedes",
  red_bull: "redbull",
  mclaren: "mclaren",
  aston_martin: "astonmartin",
  alpine: "alpine",
  williams: "williams",
  rb: "racingbulls",
  racing_bulls: "racingbulls",
  haas: "haas",
  sauber: "audi",
  kick_sauber: "audi",
  audi: "audi",
  cadillac: "cadillac",
}

const isMine = (constructorId: string | undefined, teamId: string) =>
  Boolean(constructorId && JOLPICA_TEAM[constructorId] === teamId)

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
      {next && (
        <section className="pcard next-race" aria-label="Next race">
          <div className="next-race-top">
            <span className="next-race-round">Round {next.round}</span>
            <span className="next-race-tag">Next race</span>
          </div>
          <p className="next-race-country">{raceCountry(next.place)}</p>
          <h3 className="next-race-name">{raceHeadline(next.name)}</h3>
          <p className="next-race-meta">
            <span>{next.circuit}</span>
            <span aria-hidden>·</span>
            <span>{fmtRaceDay(next.start)}</span>
          </p>
          <p className="next-race-lights">Lights out in</p>
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
        <section className="pcard standings-card" aria-label="Constructors championship">
          <div className="standings-head">
            <div>
              <span className="standings-tag">2026 season</span>
              <h3 className="standings-title">Constructors</h3>
            </div>
            {data.standings.afterRound ? (
              <span className="standings-after">After round {data.standings.afterRound}</span>
            ) : null}
          </div>
          <div className="standings-cols" aria-hidden>
            <span>Pos</span>
            <span>Team</span>
            <span>Pts</span>
          </div>
          <ol className="standings">
            {data.standings.constructors.map((c) => {
              const mine = isMine(c.id, teamId)
              return (
                <li key={c.id ?? c.team} className={mine ? "mine" : undefined}>
                  <span className="pos">{c.position}</span>
                  <span className="name">
                    {c.team}
                    {mine && <em>Your team</em>}
                  </span>
                  <span className="pts">{c.points}</span>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      <section className="pcard news-card" aria-label={`${team.name} news`}>
        <div className="news-head">
          <div>
            <span className="news-tag">From trusted F1 sources</span>
            <h3 className="news-title">{team.name} news</h3>
          </div>
          <span className="muted small">Last month</span>
        </div>
        {data?.news?.length ? (
          <ul className="news">
            {data.news.map((n) => {
              let host = ""
              try { host = new URL(n.url).hostname.replace(/^www\./, "") } catch {}
              return (
                <li key={n.url}>
                  <a href={n.url} target="_blank" rel="noreferrer">{n.title}</a>
                  <span className="news-meta">{host}{n.publishedDate ? ` · ${fmtDate(n.publishedDate)}` : ""}</span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="muted">
            {data?.news === null
              ? "Team news isn’t available right now."
              : "No race/tech notes for this team in the last month."}
          </p>
        )}
      </section>

      {!data?.calendar && !data?.standings && (
        <p className="muted small">Calendar and standings aren’t available right now. Try again shortly.</p>
      )}
    </div>
  )
}
