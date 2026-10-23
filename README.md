# F1 Garage

Pick any of the 11 teams on the 2026 grid, explore its car in 3D, take it apart part by part, and ask an AI race engineer about upgrades and FIA regulations.
The engineer runs on an **NVIDIA Nemotron** model served by **Nebius Token Factory**.

```bash
cp .env.example .env.local   # add NEBIUS_API_KEY, NEBIUS_MODEL and TAVILY_API_KEY
npm install
npm run dev                  # http://localhost:3002
```

## What you can do

- **3D car in every team's colours.** Studio turntable with reflections, or **Drive** mode: the car runs on a track with spinning wheels, suspension movement, glowing brakes, and the 2026 active aero switching between Straight Mode (straight, wings open) and Corner Mode (corner, wings closed). A HUD shows speed, aero mode, ERS deployment and braking.
- **Take it apart.** Click any of the 13 parts and it slides off the car while the rest turns see-through and the camera flies to it. **Exploded view** separates everything; **Reassemble** or Esc puts it back.
- **Bite-sized learning.** Nothing is shown all at once: the Explore tab offers a hint, a showcase button, your team's upgrades, lesson chips and one "did you know" fact at a time. A selected part shows a one-line summary, three key specs and a three-step card (how it works, 2026 rules, upgrades), with full specs tucked away. Controls live in an icon rail with tooltips, part names appear on hover, and the side panel can be hidden.
- **Team upgrades.** Explore shows your team's real 2026 upgrades as declared to the FIA, each with its source; tap one to light up the parts it changed on the car.
- **Live team briefing.** Lena's `get_team_story` tool builds a team briefing from FIA docs, Formula1.com, The Race, Autosport, Motorsport and the team's official site (Tavily, ~45 min cache).
- **Race engineer.** The engineer can search fia.com, recent news, live timing and the standings, and it controls the 3D car while it explains: it takes parts off, highlights several with numbered labels, explodes the car or switches to blueprint and airflow views. The car only goes on track when you press Showcase, Drive or Race. Fan/Engineer depth toggle, an optional Deep analysis mode, a collapsible view of the model's reasoning, and source chips on every answer.
- **Lena, your race engineer.** An illustrated character who wears the selected team's kit (shirt in the team's livery colours with its name on the chest) and a pit-wall headset in team colours. She changes kit and says hello when you switch team, appears on screen when she talks, speaks with a natural British voice (see below; can be switched off), and shows live captions. She runs **six guided lessons** (downforce, ground effect, active aero, the power unit, tyres and brakes, suspension) that drive the 3D car step by step: taking parts off, highlighting, moving the camera, turning on the airflow.
- **Showcase.** One click plays a narrated reveal: the car comes apart piece by piece, shows its blueprint, reassembles with each part clunking into place, fires up (starter, catch, throttle blips), then launches from a standing start with camera cuts. The engine note is synthesized: V6 firing pulses, exhaust roar, turbo whistle, the hybrid's electric whine, 8-speed upshifts with ignition cuts, and overrun crackle under braking.
- **Drive.** The car laps a **Monza-shaped** night circuit (~3.2 km scaled layout from open F1 centerline data: long main straight, Lesmo, Ascari, Parabolica) with kerbs, barriers, floodlights and a grandstand. Speed follows the track: braking zones, corner speeds, Straight Mode on the straights. Every drive opens with a burnout and lit, billowing tyre smoke, then a standing start. Cameras: chase, trackside TV, onboard T-cam, helicopter.
- **Race, like the F1 games.** A race-weekend lobby: drive your team's car or watch, set the starting grid (shuffle, reverse, pole, back of the grid, or move cars up and down), 3/5/10 laps, AI difficulty 0–110 and assists (Full: the car brakes and accelerates, you steer and attack; Braking: it brakes for corners; Off: all yours). Drive with ↑/W throttle, ↓/S brake, ←/→ steer, Space for Overtake mode, C for camera, Esc to pause (on-screen pedals on touch screens). Five red lights, your reaction time, a braking line on the road (green, yellow, red), a dashboard with rev lights, gear, speed, battery and Overtake mode, gaps to the cars ahead and behind, last and best laps, a timing tower with intervals, a minimap, race-control messages (track limits warnings, 5 s penalties, fastest lap, final lap), a pause menu and a full classification with best laps and penalties. Lena calls your race on the radio.
- **Real 2026 liveries.** Each 3D car is painted after its team's 2026 launch livery, including two-sided designs like Cadillac's.
- **Technical view and airflow.** Red X-ray rendering with a scan sweep, glass bodywork and feature lines, FIA dimension lines (3400 mm wheelbase, 1900 mm width), spec tags on hover, labelled power-unit internals, and a spec sheet for every part with the 2026 figures. **Airflow** draws CFD-style streamlines coloured from slow (blue) to fast (red): over the wings, under the floor, through the diffuser and up behind the rear wing.
- **Liveries and sound.** Each 3D car is painted after its team's 2026 livery with its name on the sidepods, wings and nose. Sound is one button (on or off). In the garage you hear "Limit 70" (Kevin MacLeod) and on the race grid "Apex" (Alexander Nakarada), both public domain. On track the engine is a real Ferrari: a recorded Ferrari 812 V12 start-up, then recorded Ferrari 458 loops from idle to 9,000 rpm crossfaded by revs and throttle, with real exhaust pops and gear shifts. Lena's voice dips the music and engine. Sources and licences: `public/audio/README.md`.
- **Paddock.** Next race with a countdown, last podium and constructors' standings (Jolpica-F1), and the selected team's news from the last week (Tavily).

## Where AI is used

| Feature | What generates it |
|---------|-------------------|
| Lena's chat answers | NVIDIA Nemotron (open model) on Nebius Token Factory, as a tool-using agent (`lib/server/agent/`) |
| Lena controlling the 3D car | The same agent, through tools (`focus_part`, `highlight_parts`, `set_view`, `start_lesson`, …) |
| Lena's voice | Microsoft neural text-to-speech, `en-GB-LibbyNeural` (`lib/server/tts.ts`) |
| Team briefing and Paddock news | Not AI: Tavily web search, quoted from FIA, F1 media and team sites |
| Lessons, showcase and race radio calls | Not AI: written lines, spoken in Lena's voice |

## The agent

Lena is a **single agent with tools**, not an orchestrator with sub-agents: one Nemotron model plans, calls tools and answers. For a chat that drives a 3D car this is faster and more predictable, and every step is visible.

1. The browser sends the conversation plus a structured **garage context** (team, selected part, mode, Deep analysis, learning progress, race state). The server validates it and builds the prompt text; the browser never sends prompt text.
2. The server decides whether the question needs live data. Static car questions get only the garage tools and answer from the built-in handbook; anything that changes race to race also gets the live tools. Championship questions get a live standings snapshot pasted in.
3. The model streams a step. Tool calls in a step run **in parallel**, each with a 15-second timeout; identical calls in one turn run once; results are capped in size. Up to two tool steps, then the model must answer in text.
4. Everything streams to the browser as NDJSON events: `tool_start`/`tool_end`, `text`, `reasoning`, `ui` (car commands), `sources`, `error`, `done`. Cancelling (a new question, clearing the chat, leaving the page) aborts the model call and tools on the server.

Tool results are data. All behaviour rules (when to use which tool, how to answer after) are in the system prompt (`lib/server/agent/prompt.ts`).

| Tool | Kind | Does |
|------|------|------|
| `get_team_story` | live | Team briefing from the FIA, trusted media and the team's site (Tavily). Needs `TAVILY_API_KEY`. |
| `web_search` | live | Tavily. Scope `fia` = fia.com only, `news` = last month, `any` = general. Needs `TAVILY_API_KEY`. |
| `get_live_timing` | live | OpenF1: latest session and race control messages. |
| `get_standings`, `get_calendar` | live | Jolpica-F1: championships (any season), next races, last podium. |
| `get_team_upgrades`, `show_upgrade` | garage | A team's FIA-declared 2026 upgrades with sources; highlights one on the car. |
| `explain_regulation` | garage | A 2026 regulation chapter, highlighted on the car. |
| `focus_part`, `highlight_parts`, `set_view`, `start_lesson`, `open_race_setup` | garage | Control the 3D car, lessons and the race lobby. |

Nemotron reasoning models return their reasoning separately (`reasoning_content`) or inline as `<think>…</think>`; both are shown in a collapsible "Engineer's reasoning" block. Deep analysis sends `chat_template_kwargs: { enable_thinking: true }`, retried without it if the deployment rejects it.

## Code map

| Path | What |
|------|------|
| `app/api/agent/route.ts` | `POST`: validates the request and streams the agent's events. |
| `app/api/paddock/route.ts` | `GET ?team=<id>`: Paddock data (400 for unknown teams). |
| `app/api/voice/route.ts` | `GET ?text=…&tone=calm\|race`: Lena's voice as MP3, cacheable forever. |
| `lib/server/` | **Server only** (every module starts with `import "server-only"`). |
| `lib/server/env.ts` | The only place that reads `process.env`. |
| `lib/server/agent/` | `run.ts` agent loop, `tools.ts` tool registry, `prompt.ts` system prompt and context line, `validate.ts` request validation, `knowledge.ts` handbook, `text.ts` stream helpers. |
| `lib/server/f1data.ts`, `search.ts`, `teamStory.ts`, `tts.ts` | OpenF1 / Jolpica-F1, Tavily search, team briefings, text-to-speech. |
| `lib/server/cache.ts` | Caching helpers (below). |
| `lib/agent/types.ts` | Types shared by browser and server: garage context, chat turns, agent events. |
| `lib/storage.ts` | Every localStorage key, with guarded access. |
| `lib/parts.ts`, `teams.ts`, `regulations.ts`, `upgrades.ts`, `lessons.ts` | Shared content: parts, the 2026 grid, rules, sourced team upgrades, lessons. |
| `components/Engineer.tsx` | The chat: sends questions, renders steps, AI attribution, sources. |
| `components/three/` | The 3D scene: car, track, effects. |

## Caching and stored data

| What | Where | How long |
|------|-------|----------|
| OpenF1 / Jolpica-F1 responses | Next's fetch cache (`next: { revalidate }`) | 15 s live timing … 1 h calendar |
| Tavily searches and Paddock news | Next's Data Cache (`unstable_cache` in `lib/server/cache.ts`) | news 15 min, FIA 2 h, general 1 h |
| Team briefings | Next's Data Cache | 45 min |
| Lena's voice audio | Browser HTTP cache (immutable GET URLs) and a 32 MB per-server LRU | indefinitely / until evicted |
| `/api/paddock` responses | CDN (`Cache-Control: s-maxage`) | 1 min |
| Agent responses | Never cached (`no-store`) | |
| Team, mute setting, chat history, learning progress | The user's browser (localStorage, `lib/storage.ts`) | until cleared |

Failed lookups are never cached, so a temporary outage doesn't stick, and concurrent identical requests share one upstream call. Chat history stays in the user's browser; the server keeps no conversations.

## Choosing the model

Model ids vary by account, so list yours and pick a Nemotron that supports tool calling:

```bash
curl -s https://api.tokenfactory.nebius.com/v1/models -H "Authorization: Bearer $NEBIUS_API_KEY" | grep -i nemotron
```

Set it as `NEBIUS_MODEL`. For the best explanations and tool use, pick the largest Nemotron your account lists (for example Nemotron 3 Super or Nemotron Ultra).

## Lena's voice

Lena uses one voice only: Microsoft Edge **`en-GB-LibbyNeural`** via `/api/voice` — free, no API key (`lib/server/tts.ts`). There is no browser TTS fallback. Garage uses a calm take; on track the same voice uses a race tone (slightly faster / brighter). Lines are spoken in longer takes, silence-trimmed and crossfaded so joins don’t chop.

On track she talks like a real race engineer — mostly quiet. She calls the grid and lights out, then only when it matters: a fight under a second, purple lap, penalty, P1 / podium moves, last lap, and the flag. Routine lap chatter and every track-limits ping stay off the radio (HUD still shows them). Leaving the garage ends any explanation she was giving.

## Engine sound

The engine is only heard on track (Drive and Race). It uses real recordings from the free [Sonniss GDC Game Audio bundles](https://sonniss.com/gdc-bundle-license/) (royalty-free, no attribution needed): a Ferrari 812 Superfast V12 start-up every time a car rolls out, then Ferrari 458 engine loops recorded from idle to 9,000 rpm, on and off throttle, crossfaded by revs and throttle the way racing games do it, mapped so the top of each gear on our car is the 458's scream. Gear shifts, exhaust pops and crackles are recorded too; the turbo whistle is added live. Onboard is loud and raw; the TV and helicopter cameras hear a distant car. Details and licences are in `public/audio/README.md`. If the recordings can't load, a physical model of the V6 (`lib/engineWorklet.ts`) takes over.

## Music and logos

- Music is public domain: "Limit 70" by Kevin MacLeod in the garage (`public/audio/theme.mp3`) and "Apex" by Alexander Nakarada on the race grid (`public/audio/grid.mp3`), both from FreePD. The garage track plays while you explore and through the showcase; it stops whenever Lena speaks and picks up where it left off a moment after she's finished. The grid track fades out once the cars are moving. The official F1 theme and the F1 film soundtrack are copyrighted and aren't used; replace either file with a track you're licensed to use if you like.
- Team and sponsor logos are trademarks, so none are bundled; the car shows generated wordmarks instead. If you have the rights, drop the files into `public/logos/` and list them in `public/logos/manifest.json` (see `public/logos/README.md`). They then replace the wordmarks on the sidepods, shark fin and wings.

## About the 3D model

The car is modelled in code so the project needs no paid assets. For photorealism, drop a Hunyuan3D / TRELLIS / High3DGen `.glb` into `public/models/cars/` (see `public/models/README.md`); `TeamCar` loads it automatically and maps mesh names to `lib/parts.ts` ids. Lena’s mouth follows live TTS audio (Audio2Face-style jaw + visemes); bake higher-fidelity curves with [NVIDIA Audio2Face](https://developer.nvidia.com/blog/nvidia-open-sources-audio2face-animation-model/) when you want offline ARKit weights. Liveries are generic designs in each team's colours. This is an unofficial fan project, not affiliated with Formula 1, the FIA or any team.
