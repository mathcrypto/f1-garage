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
- **Race, like the F1 games.** A race-weekend lobby: drive your team's car or watch, set the starting grid (shuffle, reverse, pole, back of the grid, or move cars up and down), 3/5/10 laps, AI difficulty 0–110 and assists (Full: the car brakes and accelerates, you steer and attack; Braking: it brakes for corners; Off: all yours). Drive with ↑/W throttle, ↓/S brake, ←/→ steer, Space for Overtake mode, C for camera, Esc to pause (on-screen pedals on touch screens). Five red lights, your reaction time, a braking line on the road (green, yellow, red), a dashboard with rev lights, gear, speed, battery and Overtake mode, gaps to the cars ahead and behind, last and best laps, a timing tower with intervals, a minimap, race-control messages (track limits warnings, 5 s penalties, fastest lap, final lap), a pause menu and a full classification with best laps and penalties. Lena calls your race on the radio.
- **Real 2026 liveries.** Each 3D car is painted after its team's 2026 launch livery, including two-sided designs like Cadillac's.
- **Technical view and airflow.** Red X-ray rendering with a scan sweep, glass bodywork and feature lines, FIA dimension lines (3400 mm wheelbase, 1900 mm width), spec tags on hover, labelled power-unit internals, and a spec sheet for every part with the 2026 figures. **Airflow** draws CFD-style streamlines coloured from slow (blue) to fast (red): over the wings, under the floor, through the diffuser and up behind the rear wing.
- **Liveries and sound.** Each 3D car is painted after its team's 2026 livery with its name on the sidepods, wings and nose. Sound is one button (on or off): the engine plays by itself when a car is on track, Lena when she talks, and music only if you supply a licensed track.
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

Lena speaks with a natural neural voice, no key needed: by default the server runs **[Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M)** (Apache-2.0) through [kokoro-js](https://www.npmjs.com/package/kokoro-js) with its British female voice **Emma** (`bf_emma`), in a worker thread so the server stays responsive. The full-precision model (about 330 MB) downloads from Hugging Face the first time and is cached; on a laptop CPU it speaks about 2.5 times faster than real time (`KOKORO_DTYPE=q8` uses the smaller, slower quantized model).

How she stays in sync with no waiting:
- Every fixed line (greetings, the showcase, all lessons, race radio calls) is generated in the background as soon as the server starts and cached on disk in `.cache/voice`, so those play within milliseconds.
- When you ask a question, "Copy." plays at once, and "Stand by, checking that." if she needs to look something up, while the model writes the answer.
- The first sentence of anything she says is generated on its own so it's heard quickly; after that sentences are grouped into fuller chunks so explanations flow naturally, and the next chunk is generated while the current one plays.
- Lessons and the showcase fetch their next lines ahead. Her caption, mouth and the engine ducking start exactly when the sound does.

For an even more natural voice, set a key for **Azure Speech** (`en-GB-SoniaNeural`; free tier 500,000 characters a month) or **ElevenLabs** in `.env.local` (see `.env.example`); either takes priority over Kokoro. `KOKORO=off` falls back to the browser's own speech. Kokoro needs a Node server with native onnxruntime (`npm run dev` or `npm start`); serverless hosts with small bundle limits should use Azure or ElevenLabs.

On track she talks like a race engineer: a radio check once the engine's running, a call before each braking zone, lap times with the delta to your best, gaps to the cars ahead and behind, warnings when someone's within a second, Overtake and battery advice, track limits and penalties, position changes, the final lap and the flag. Leaving the garage ends any explanation she was giving.

## Engine sound

The engine is only heard on track (Drive and Race), never in the garage. It's a physically informed model of the 1.6-litre V6 turbo hybrid running in an AudioWorklet (`lib/engineWorklet.ts`): six cylinders fire 120° apart, every combustion varies a little, and each pressure pulse travels through modelled exhaust primaries, a tail pipe and the airbox intake, after the approach in Baldan et al., *Physically informed car engine sound synthesis for virtual and augmented environments* (2015). The revs come from the car's speed through an 8-speed gearbox (up at about 11,900 rpm, landing near 10,300), with ignition-cut upshifts, downshift blips, overrun pops, the turbo whistle and the MGU-K whine. Onboard is loud and raw; the TV and helicopter cameras hear a distant car.

Every time a car rolls out on track the engine is started first: the starter motor turns it over, it catches, flares and settles to idle. A recording of a real start-up at `public/audio/engine-start.mp3` replaces the synthesized one; Freesound has a pack of real F1 start-ups recorded at the Brazilian GP ([rfhache, "Formula1 StartingEngines"](https://freesound.org/people/rfhache/packs/2834/)), free with an account; check each file's licence and credit the recordist as it requires.

Real recordings sound best, and none ships with the site because recordings of real F1 and Ferrari cars are copyrighted. Two ways to add one you're allowed to use:

- **One loop:** a seamless loop of a steady engine at about 10,500 rpm at `public/audio/engine-loop.mp3`. It's pitched with the revs.
- **Game-style layers:** several loops recorded at different revs, on and off throttle, in `public/audio/engine/` with an `engine.json` such as `{"layers":[{"file":"on_low.mp3","rpm":7000,"load":"on"},{"file":"on_high.mp3","rpm":11000,"load":"on"},{"file":"off_low.mp3","rpm":7000,"load":"off"},{"file":"off_high.mp3","rpm":11000,"load":"off"}]}`. They're crossfaded by rpm and throttle, the way racing games do it.

Her style follows how race engineers actually talk to drivers: information first in the fewest words, calm under pressure, clear radio words ("copy", "box, box", "lift and coast"), and only what's needed right now ([Mercedes](https://www.mercedesamgf1.com/news/how-f1-teams-talk-to-drivers-on-track), [Red Bull](https://www.redbullracing.com/int-en/bulls-guide-to-team-radio), [Porsche](https://newsroom.porsche.com/EN/Motorsports/Tests-in-Monza.html)).

## Music and logos

- No music ships with the site: the official F1 theme and the F1 movie soundtrack are copyrighted. If you have a licence for a track, put it at `public/audio/theme.mp3`; it plays in the garage and on the grid and fades out once the cars are moving.
- Team and sponsor logos are trademarks, so none are bundled; the car shows generated wordmarks instead. If you have the rights, drop the files into `public/logos/` and list them in `public/logos/manifest.json` (see `public/logos/README.md`). They then replace the wordmarks on the sidepods, shark fin and wings.

## About the 3D model

The car is modelled in code so the project needs no paid assets. For photorealism, drop in a licensed glTF model and give its meshes the part ids from `lib/parts.ts`; `Part.tsx` works with any meshes. Liveries are generic designs in each team's colours. This is an unofficial fan project, not affiliated with Formula 1, the FIA or any team.
