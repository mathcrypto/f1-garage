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
- **Bite-sized learning.** Nothing is shown all at once: the Explore tab offers a hint, a showcase button, lesson chips, three flip-cards with headline numbers and one "did you know" fact at a time. A selected part shows a one-line summary, three key specs and a three-step card (how it works, 2026 rules, upgrades), with full specs tucked away. Controls live in an icon rail with tooltips, part names appear on hover, and the side panel can be hidden.
- **Live team briefing.** Explore shows a paddock card for your team from FIA docs, Formula1.com, The Race, Autosport, Motorsport and the team's official site (Tavily, ~45 min cache). Each note links to its outlet; Lena’s `get_team_story` tool uses the same feed. The development diary below stays a labelled teaching log.
- **Race engineer.** The engineer can search fia.com, recent news, live timing and the standings, and it controls the 3D car while it explains: it takes parts off, highlights several with numbered labels, explodes the car or switches to drive mode. Fan/Engineer depth toggle, an optional Deep analysis mode, a collapsible view of the model's reasoning, and source chips on every answer.
- **Lena, your race engineer.** An illustrated character who wears the selected team's kit (shirt in the team's livery colours with its name on the chest) and a pit-wall headset in team colours. She changes kit and says hello when you switch team, appears on screen when she talks, speaks with a natural British voice (see below; can be switched off), and shows live captions. She runs **six guided lessons** (downforce, ground effect, active aero, the power unit, tyres and brakes, suspension) that drive the 3D car step by step: taking parts off, highlighting, switching to drive mode, turning on the airflow.
- **Showcase.** One click plays a narrated reveal: the car comes apart piece by piece, shows its blueprint, reassembles with each part clunking into place, fires up (starter, catch, throttle blips), then launches from a standing start with camera cuts. The engine note is synthesized: V6 firing pulses, exhaust roar, turbo whistle, the hybrid's electric whine, 8-speed upshifts with ignition cuts, and overrun crackle under braking.
- **Drive.** The car laps a **Monza-shaped** night circuit (~3.2 km scaled layout from open F1 centerline data: long main straight, Lesmo, Ascari, Parabolica) with kerbs, barriers, floodlights and a grandstand. Speed follows the track: braking zones, corner speeds, X-mode on the straights. Every drive opens with a burnout and lit, billowing tyre smoke, then a standing start. Cameras: chase, trackside TV, onboard T-cam, helicopter.
- **Race, like the F1 games.** A race-weekend lobby: drive your team's car or watch, set the starting grid (shuffle, reverse, pole, back of the grid, or move cars up and down), 3/5/10 laps, AI difficulty 0–110 and assists (Full: the car brakes and accelerates, you steer and attack; Braking: it brakes for corners; Off: all yours). Drive with ↑/W throttle, ↓/S brake, ←/→ steer, Space for Overtake mode, C for camera, Esc to pause (on-screen pedals on touch screens). Five red lights, your reaction time, a braking line on the road (green, yellow, red), a dashboard with rev lights, gear, speed, battery and Overtake mode, gaps to the cars ahead and behind, last and best laps, a timing tower with intervals, a minimap, race-control messages (track limits warnings, 5 s penalties, fastest lap, final lap), a pause menu and a full classification with best laps and penalties. Lena calls your race on the radio.
- **Real 2026 liveries.** Each 3D car is painted after its team's 2026 launch livery, including two-sided designs like Cadillac's.
- **Technical view and airflow.** Red X-ray rendering with a scan sweep, glass bodywork and feature lines, FIA dimension lines (3400 mm wheelbase, 1900 mm width), spec tags on hover, labelled power-unit internals, and a spec sheet for every part with the 2026 figures. **Airflow** draws CFD-style streamlines coloured from slow (blue) to fast (red): over the wings, under the floor, through the diffuser and up behind the rear wing.
- **Liveries and sound.** Each 3D car is painted after its team's 2026 livery with its name on the sidepods, wings and nose. Sound is one button (on or off). In the garage you hear "Limit 70" (Kevin MacLeod) and on the race grid "Apex" (Alexander Nakarada), both public domain. On track the engine is a real Ferrari: a recorded Ferrari 812 V12 start-up, then recorded Ferrari 458 loops from idle to 9,000 rpm crossfaded by revs and throttle, with real exhaust pops and gear shifts. Lena's voice dips the music and engine. Sources and licences: `public/audio/README.md`.
- **Paddock.** Next race with a countdown, last podium and constructors' standings (Jolpica-F1), and the selected team's news from the last week (Tavily).

## Code map

| Path | What |
|------|------|
| `components/three/Scene.tsx` | Canvas entry: studio lighting, track, camera, bloom. |
| `components/three/car/` | Procedural car, parts, livery, geometry; optional Hunyuan `GltfCar`. |
| `components/three/track/` | Circuit mesh, drive/race sessions, track camera. |
| `components/three/fx/` | Smoke, airflow / blueprint overlays. |
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
| `get_team_story` | Live team briefing (FIA + trusted media + official team site). Same feed as the Explore paddock card. |
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

## Lena's voice

Lena uses one voice only: Microsoft Edge **`en-GB-LibbyNeural`** via `/api/voice` — free, no API key (`lib/edgeVoice.ts`). There is no browser TTS fallback. Garage uses a calm take; on track the same voice uses a race tone (slightly faster / brighter). Lines are spoken in longer takes, silence-trimmed and crossfaded so joins don’t chop.

On track she talks like a real race engineer — mostly quiet. She calls the grid and lights out, then only when it matters: a fight under a second, purple lap, penalty, P1 / podium moves, last lap, and the flag. Routine lap chatter and every track-limits ping stay off the radio (HUD still shows them). Leaving the garage ends any explanation she was giving.

## Engine sound

The engine is only heard on track (Drive and Race). It uses real recordings from the free [Sonniss GDC Game Audio bundles](https://sonniss.com/gdc-bundle-license/) (royalty-free, no attribution needed): a Ferrari 812 Superfast V12 start-up every time a car rolls out, then Ferrari 458 engine loops recorded from idle to 9,000 rpm, on and off throttle, crossfaded by revs and throttle the way racing games do it, mapped so the top of each gear on our car is the 458's scream. Gear shifts, exhaust pops and crackles are recorded too; the turbo whistle is added live. Onboard is loud and raw; the TV and helicopter cameras hear a distant car. Details and licences are in `public/audio/README.md`. If the recordings can't load, a physical model of the V6 (`lib/engineWorklet.ts`) takes over.

## Music and logos

- Music is public domain: "Limit 70" by Kevin MacLeod in the garage (`public/audio/theme.mp3`) and "Apex" by Alexander Nakarada on the race grid (`public/audio/grid.mp3`), both from FreePD. The garage track plays while you explore and through the showcase; it stops whenever Lena speaks and picks up where it left off a moment after she's finished. The grid track fades out once the cars are moving. The official F1 theme and the F1 film soundtrack are copyrighted and aren't used; replace either file with a track you're licensed to use if you like.
- Team and sponsor logos are trademarks, so none are bundled; the car shows generated wordmarks instead. If you have the rights, drop the files into `public/logos/` and list them in `public/logos/manifest.json` (see `public/logos/README.md`). They then replace the wordmarks on the sidepods, shark fin and wings.

## About the 3D model

The car is modelled in code so the project needs no paid assets. For photorealism, drop a Hunyuan3D / TRELLIS / High3DGen `.glb` into `public/models/cars/` (see `public/models/README.md`); `TeamCar` loads it automatically and maps mesh names to `lib/parts.ts` ids. Lena’s mouth follows live TTS audio (Audio2Face-style jaw + visemes); bake higher-fidelity curves with [NVIDIA Audio2Face](https://developer.nvidia.com/blog/nvidia-open-sources-audio2face-animation-model/) when you want offline ARKit weights. Liveries are generic designs in each team's colours. This is an unofficial fan project, not affiliated with Formula 1, the FIA or any team.
