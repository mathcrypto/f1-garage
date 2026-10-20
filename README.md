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
- **Lena, your race engineer.** An illustrated character who wears the selected team's kit (shirt in the team's livery colours with its name on the chest) and a pit-wall headset in team colours. She changes kit and says hello when you switch team, appears on screen when she talks, speaks with a natural British voice (see below; can be switched off), and shows live captions. She runs **six guided lessons** (downforce, ground effect, active aero, the power unit, tyres and brakes, suspension) that drive the 3D car step by step: taking parts off, highlighting, switching to drive mode, turning on the airflow.
- **Showcase.** One click plays a narrated reveal: the car comes apart piece by piece, shows its blueprint, reassembles with each part clunking into place, fires up (starter, catch, throttle blips), then launches from a standing start with camera cuts. The engine note is synthesized: V6 firing pulses, exhaust roar, turbo whistle, the hybrid's electric whine, 8-speed upshifts with ignition cuts, and overrun crackle under braking.
- **Drive.** The car laps a real night circuit (1.4 km: main straight, hairpin, esses, sweeper) with kerbs, barriers, floodlights and a grandstand. Speed follows the track: braking zones, corner speeds, X-mode on the straights. Every drive opens with a burnout and lit, billowing tyre smoke, then a standing start. Cameras: chase, trackside TV, onboard T-cam, helicopter.
- **Race.** Choose which teams race, set the grid (shuffle, reverse, your team on pole, or move cars up and down) and the laps. Five red lights come on one per second with a beep each, hold, then go out. Cars launch with their own reaction times, slipstream, make the odd mistake and overtake. Live timing tower with gaps (click a team to follow it), the anthem, Lena calling your team's race on the radio, chequered flag and podium.
- **Real cars.** Freely licensed photos of each team's actual car from Wikimedia Commons, credited to their photographers.
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

## Lena's voice

Lena speaks with a natural neural voice, no key needed: by default the server runs **[Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M)** (Apache-2.0) through [kokoro-js](https://www.npmjs.com/package/kokoro-js) with its British female voice **Emma** (`bf_emma`). The model (about 90 MB) downloads from Hugging Face the first time she speaks and is cached after that; on a laptop CPU a sentence takes roughly as long to generate as to say, and the next sentence is generated while the current one plays.

For an even more natural voice, set a key for **Azure Speech** (`en-GB-SoniaNeural` by default; free tier 500,000 characters a month) or **ElevenLabs** in `.env.local` (see `.env.example`); either takes priority over Kokoro. `KOKORO=off` falls back to the browser's own speech.

Audio is generated per sentence and played strictly in order (she always finishes a line). Very short sentences ("Copy.") are joined to the next one so her delivery flows. Her answers to questions open with "Copy." and never with filler like "Right" or "So". Her mouth follows the audio's loudness, and the engine ducks while she talks. The team-radio effect (radio filter and beeps) is off by default and can be switched on in the Sound menu.

Kokoro needs a Node server with native onnxruntime (`npm run dev` or `npm start`); serverless hosts with small bundle limits should use Azure or ElevenLabs instead.

## Engine sound

The engine is only heard on track (Drive and Race), never in the garage. It's a physically informed model of the 1.6-litre V6 turbo hybrid running in an AudioWorklet (`lib/engineWorklet.ts`): six cylinders fire 120° apart, every combustion varies a little, and each pressure pulse travels through modelled exhaust primaries, a tail pipe and the airbox intake, after the approach in Baldan et al., *Physically informed car engine sound synthesis for virtual and augmented environments* (2015). The revs come from the car's speed through an 8-speed gearbox (up at about 11,900 rpm, landing near 10,300), with ignition-cut upshifts, downshift blips, overrun pops, the turbo whistle and the MGU-K whine. Onboard is loud and raw; the TV and helicopter cameras hear a distant car.

Have a licensed recording of a real F1 car? Put a seamless loop of a steady pass at about 10,500 rpm at `public/audio/engine-loop.mp3` and it's used instead, pitched with the revs. (Recordings of real F1 cars are copyrighted, so none ships with the site.)

Her style follows how race engineers actually talk to drivers: information first in the fewest words, calm under pressure, clear radio words ("copy", "box, box", "lift and coast"), and only what's needed right now ([Mercedes](https://www.mercedesamgf1.com/news/how-f1-teams-talk-to-drivers-on-track), [Red Bull](https://www.redbullracing.com/int-en/bulls-guide-to-team-radio), [Porsche](https://newsroom.porsche.com/EN/Motorsports/Tests-in-Monza.html)).

## Music and logos

- All audio is synthesized live in `lib/sound.ts`; nothing is streamed from third parties. To use another track, put a file you're licensed to use (for example a royalty-free one) at `public/audio/theme.mp3`; it replaces the built-in anthem automatically.
- Team and sponsor logos are trademarks, so none are bundled; the car shows generated wordmarks instead. If you have the rights, drop the files into `public/logos/` and list them in `public/logos/manifest.json` (see `public/logos/README.md`). They then replace the wordmarks on the sidepods, shark fin and wings.

## About the 3D model

The car is modelled in code so the project needs no paid assets. For photorealism, drop in a licensed glTF model and give its meshes the part ids from `lib/parts.ts`; `Part.tsx` works with any meshes. Liveries are generic designs in each team's colours. This is an unofficial fan project, not affiliated with Formula 1, the FIA or any team.
