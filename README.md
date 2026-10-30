<div align="center">

# 🏎️ F1 Garage

### Take a 2026 Formula 1 car apart, piece by piece, while an AI race engineer explains it all.

**Explode the car. X-ray it. Watch the air flow. Race it at Monza.**
And ask Lena anything until it finally clicks.

[![Nebius Global AI Hackathon](https://img.shields.io/badge/Nebius-Global%20AI%20Hackathon-ff4f00)](#)
[![NVIDIA Nemotron](https://img.shields.io/badge/NVIDIA-Nemotron-76b900?logo=nvidia&logoColor=white)](#where-ai-is-used)
[![Nebius Token Factory](https://img.shields.io/badge/Nebius-Token%20Factory-1a1a1a)](#where-ai-is-used)
[![Next.js](https://img.shields.io/badge/Next.js-000?logo=nextdotjs&logoColor=white)](#run-it)
[![React Three Fiber](https://img.shields.io/badge/React%20Three%20Fiber-3D-049ef4?logo=threedotjs&logoColor=white)](#run-it)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

<img src="docs/screenshots/hero.png" alt="The Ferrari SF-26 in the F1 Garage" width="900">

<!-- Tip: replace the hero image with a 5–10 s GIF of the car exploding apart. It's the single biggest upgrade for this README. -->

</div>

---

## 🔥 2026 changed everything. Most fans got left behind.

The 2026 regulations are the biggest shake-up in a generation:

- ⚡ **Nearly half the power is now electric**
- 🪽 **Active aerodynamics**: wings that change shape on the straights
- 🚀 **Overtake mode** replacing DRS
- 🔋 **Energy management on every single lap**

Even commentators and drivers admit the new cars are hard to follow. If you don't have an engineering degree, good luck.

**F1 Garage fixes that.** Open up any 2026 car, see how it actually works, and ask questions in plain words until it makes sense. Every number comes from a real source (FIA regulations, team declarations, F1 media), and the app shows you exactly where.

---

## 🎧 Meet Lena, your AI race engineer

> **You:** "What did Ferrari bring to Miami?"
>
> **Lena:** *pulls the declared upgrade list, lights up the front wing, floor, diffuser and rear wing on the SF-26, and walks you through the eleven-part package, with sources.*

Lena doesn't just answer. **She shows you.**

| | |
|---|---|
| 🧠 **Thinks for herself** | Picks her own tools: FIA rules, team upgrades, live timing, standings, news |
| 🔧 **Drives the 3D car** | Pulls parts off, highlights them, switches to X-ray or airflow as she talks |
| 📚 **Cites everything** | Every claim links back to its source |
| 🎚️ **Speaks your language** | *Fan* mode for one-liners, *Engineer* mode for the full detail |
| 🎓 **Teaches** | Six guided lessons from zero to "I get it now" |
| 🗣️ **Talks back** | Natural voice with live captions |

Try asking:
- *"What's in Ferrari's Monza drag package?"*
- *"Why does the SF-26 have active aero?"*
- *"How does Overtake mode actually work?"*

---

## 🛠️ The garage

- 🏁 **All 11 teams** of the 2026 grid, each in its 2026 livery
- 💥 **Take any part off**, or explode the whole car into pieces
- 🩻 **X-ray view** with official FIA dimensions
- 🌬️ **Airflow streamlines** to see the aero at work
- ⚙️ **Power-unit cutaway** to look inside the hybrid heart

<div align="center">

| Choose your team | Take it apart |
|:---:|:---:|
| <img src="docs/screenshots/choose-team.png" width="420"> | <img src="docs/screenshots/mclaren-exploded.png" width="420"> |
| **Power-unit cutaway** | **X-ray view** |
| <img src="docs/screenshots/ferrari-power-unit.png" width="420"> | <img src="docs/screenshots/mercedes-xray.png" width="420"> |

</div>

---

## 🏆 The fun part

### 🎬 Showcase
A narrated reveal: the car blows apart, rebuilds itself, and launches.

### 🚦 Race weekend at Monza
Five red lights. A live timing tower. Overtake mode. Lena on the radio. Just like the F1 games.

### 🔄 Guided lap
Watch the 2026 systems come alive: aero modes flipping, the battery harvesting and deploying, corner by corner.

<div align="center">

| Race setup | Racing at Monza |
|:---:|:---:|
| <img src="docs/screenshots/race-setup.png" width="420"> | <img src="docs/screenshots/monza.png" width="420"> |

</div>

---

## 🤖 Where AI is used

Lena runs on an **NVIDIA Nemotron** open model (default `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`, any tool-calling Nemotron works), served by **Nebius Token Factory** through its OpenAI-compatible API (`https://api.tokenfactory.nebius.com/v1/`).

**One Nemotron agent does everything:**

| What Nemotron does | Example (Ferrari fan) | Code |
|---|---|---|
| 🧭 Understands the question and plans which tools to call | "What did Ferrari bring to Miami?" → calls `get_team_upgrades` for Ferrari | `lib/server/agent/run.ts` |
| ⚡ Calls tools **in parallel** for live facts: FIA rules, declared upgrades, live timing, standings, news | Finds the eleven-part Miami package and its source | `lib/server/agent/tools.ts` |
| 🎮 **Drives the 3D car** while it explains | Lights up the front wing, floor, diffuser and rear wing on the SF-26 | `focus_part`, `highlight_parts`, `set_view` |
| 🎚️ Explains at your level | One line for a fan, full detail for an engineer | `lib/server/agent/prompt.ts` |
| 🧠 **Deep analysis** with Nemotron's reasoning mode, shown in a collapsible block | "Why did Ferrari need a drag package for Monza?" | `chat_template_kwargs: { enable_thinking: true }` |

**Not Nemotron:** Lena's voice is Microsoft neural text-to-speech, and team news is plain web search (Tavily) quoting FIA, F1 media and team sites. Lessons, the showcase and race radio are written lines.

---

## 🚀 Run it

```bash
cp .env.example .env.local   # add NEBIUS_API_KEY, NEBIUS_MODEL and TAVILY_API_KEY
npm install
npm run dev                  # → http://localhost:3002
```

> The licensed 3D car isn't in the repository. Without it, a car modelled in code is shown. See [`docs/TECHNICAL.md`](docs/TECHNICAL.md).

**Under the hood:** the agent's design, tools, code map, caching, sound and 3D model are all in [`docs/TECHNICAL.md`](docs/TECHNICAL.md).

---

## 💭 Why I built this

I'm a huge Formula 1 fan, and the sport gets more technical every year. I wanted every fan, not just the engineers, to be able to look at a 2026 car and understand what they're seeing.

---

<div align="center">

**Built for the Nebius Global AI Hackathon** · NVIDIA Nemotron on Nebius Token Factory · Next.js · React Three Fiber

Code under the [MIT License](LICENSE). Third-party assets keep their own licences ([THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)).
*An unofficial fan project, not affiliated with Formula 1, the FIA or any team.*

</div>
