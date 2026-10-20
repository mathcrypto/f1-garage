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
- **Race engineer.** The engineer can search fia.com, recent news, live timing and the standings, and it controls the 3D car while it explains: it takes parts off, highlights several with numbered labels, explodes the car or switches to drive mode. Fan/Engineer depth toggle, an optional Deep analysis mode, a collapsible view of the model's reasoning, and source chips on every answer.
- **Lena, your race engineer.** An illustrated character who wears the selected team's kit (shirt in the team's livery colours with its name on the chest) and a pit-wall headset in team colours. She changes kit and says hello when you switch team, appears on screen when she talks, speaks with a British English voice (browser speech, can be switched off), and shows live captions. She runs **six guided lessons** (downforce, ground effect, active aero, the power unit, tyres and brakes, suspension) that drive the 3D car step by step: taking parts off, highlighting, switching to drive mode, turning on the airflow.
- **Showcase.** One click plays a narrated reveal: the car comes apart piece by piece, shows its blueprint, reassembles with each part clunking into place, fires up (starter, catch, throttle blips), then launches from a standing start with camera cuts. The engine note is synthesized: V6 firing pulses, exhaust roar, turbo whistle, the hybrid's electric whine, 8-speed upshifts with ignition cuts, and overrun crackle under braking.
- **Drive.** A night circuit with floodlight towers. Every drive opens with a burnout: rear tyres spinning on the limiter and pouring out lit, billowing tyre smoke that drifts back with the track, then a standing start.
- **Technical view and airflow.** Red X-ray rendering with a scan sweep, glass bodywork and feature lines, FIA dimension lines (3400 mm wheelbase, 1900 mm width), spec tags on hover, labelled power-unit internals, and a spec sheet for every part with the 2026 figures. **Airflow** draws CFD-style streamlines coloured from slow (blue) to fast (red): over the wings, under the floor, through the diffuser and up behind the rear wing.
- **Liveries and sound.** Each team has its own painted livery (base colour, dark lower body, a signature stripe, gloss or satin finish) with its name on the sidepods, rear wing and wings and the car name on the nose and shark fin. The **Sound** menu plays the original **F1 Garage anthem** (synthesized in the browser: a 32-bar arrangement with a melody hook, brass hits, pumping pads and big-hall reverb) and a V6 hybrid engine note in Drive mode that climbs through 8 gears and drops on every upshift. No audio is streamed from third parties.
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

## Music and logos

- All audio is synthesized live in `lib/sound.ts`; nothing is streamed from third parties. To use another track, put a file you're licensed to use (for example a royalty-free one) at `public/audio/theme.mp3`; it replaces the built-in anthem automatically.
- Team and sponsor logos are trademarks, so none are bundled; the car shows generated wordmarks instead. If you have the rights, drop the files into `public/logos/` and list them in `public/logos/manifest.json` (see `public/logos/README.md`). They then replace the wordmarks on the sidepods, shark fin and wings.

## About the 3D model

The car is modelled in code so the project needs no paid assets. For photorealism, drop in a licensed glTF model and give its meshes the part ids from `lib/parts.ts`; `Part.tsx` works with any meshes. Liveries are generic designs in each team's colours. This is an unofficial fan project, not affiliated with Formula 1, the FIA or any team.
