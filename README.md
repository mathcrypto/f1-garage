# F1 Garage

Pick any of the 11 teams on the 2026 grid, explore its car in 3D, take it apart part by part, and ask an AI race engineer about upgrades and FIA regulations.
The engineer runs on an **NVIDIA Nemotron** model served by **Nebius Token Factory**.

```bash
cp .env.example .env.local   # add NEBIUS_API_KEY, NEBIUS_MODEL and TAVILY_API_KEY
npm install
npm run dev                  # http://localhost:3002
```

## What you can do

- **3D car in every team's colours.** Studio turntable with reflections, or **Drive** mode: the car runs on a track with spinning wheels, suspension movement, glowing brakes, and the 2026 active aero switching between X-mode (straight, wings open) and Z-mode (corner, wings closed). A HUD shows speed, aero mode, ERS deployment and braking.
- **Take it apart.** Click any of the 14 parts and it slides off the car while the rest turns see-through and the camera flies to it. **Exploded view** separates everything; **Reassemble** or Esc puts it back.
- **Part panel.** What the part does, how it works, the 2026 rules for it and what its upgrades look like, with buttons to ask about the selected team's upgrades or for a deep dive.
- **Race engineer.** The engineer can search fia.com, recent news, live timing and the standings, and it controls the 3D car while it explains: it takes parts off, highlights several with numbered labels, explodes the car or switches to drive mode. Fan/Engineer depth toggle, an optional Deep analysis mode, a collapsible view of the model's reasoning, and source chips on every answer.
- **Paddock.** Live session and race control messages (OpenF1), next race with a countdown, last podium and constructors' standings (Jolpica-F1), and the selected team's news from the last week (Tavily).

## Code map

| Path | What |
|------|------|
| `components/three/Car.tsx` | The car, built in code: lofted bodywork, aerofoil wings, lathe-turned tyres, power unit. Materials take the team's livery. |
| `components/three/Part.tsx` | Makes a group of meshes one selectable part: hover, take apart, fade, highlight, 3D labels. |
| `components/three/Scene.tsx` | Canvas, studio lighting and reflections, drive-mode track, camera presets and fly-to, bloom. |
| `components/three/geometry.ts` | Geometry helpers: loft, aerofoil, plate, tyre, wishbone, tube. |
| `lib/drive.ts` | The scripted lap that drives speed, aero mode, ERS and braking in drive mode. |
| `lib/store.ts` | Shared state between the 3D view, the panels and the engineer (Zustand). |
| `components/Garage.tsx` | Page layout: team switcher, stage, part dock, HUD, tabs. |
| `components/Engineer.tsx` / `components/Paddock.tsx` | Engineer chat and live data panel. |
| `app/api/agent/route.ts` | Agent loop: streams NDJSON, runs tools in parallel, forwards 3D commands. |
| `app/api/paddock/route.ts` | Data for the Paddock tab. |
| `lib/agent.ts` | System prompt and tool definitions. |
| `lib/f1data.ts` / `lib/search.ts` | OpenF1 and Jolpica-F1 clients; Tavily search scoped to fia.com, news or the general web. |
| `lib/parts.ts` / `lib/teams.ts` / `lib/regulations.ts` | Part explanations, the 2026 grid and liveries, headline rule changes. |

## The engineer's tools

| Tool | Does |
|------|------|
| `web_search` | Tavily. Scope `fia` searches only fia.com (regulations, technical directives, the upgrade documents the FIA publishes each Grand Prix); `news` covers the last month; `any` prefers official and technical sources. Offered only when `TAVILY_API_KEY` is set. |
| `get_live_timing` | OpenF1: latest session and race control messages. |
| `get_standings`, `get_calendar` | Jolpica-F1: championships, next races, last podium. |
| `focus_part`, `highlight_parts`, `set_view` | Control the user's 3D car. |

Nemotron reasoning models can return their reasoning separately (`reasoning_content`) or inline as `<think>…</think>`. Both are shown in a collapsible "Engineer's reasoning" block. Deep analysis sends `chat_template_kwargs: { enable_thinking: true }`; if the deployment rejects it, the request is retried without it.

## Choosing the model

Model ids vary by account, so list yours and pick a Nemotron that supports tool calling:

```bash
curl -s https://api.tokenfactory.nebius.com/v1/models -H "Authorization: Bearer $NEBIUS_API_KEY" | grep -i nemotron
```

Set it as `NEBIUS_MODEL`. For the best explanations and tool use, pick the largest Nemotron your account lists (for example Nemotron 3 Super or Nemotron Ultra).

## About the 3D model

The car is modelled in code so the project needs no paid assets. For photorealism, drop in a licensed glTF model and give its meshes the part ids from `lib/parts.ts`; `Part.tsx` works with any meshes. Liveries are generic designs in each team's colours. This is an unofficial fan project, not affiliated with Formula 1, the FIA or any team.
