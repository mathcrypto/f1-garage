# Build prompt: F1 Garage v2

Paste everything below the line into a new coding-agent session that has this repository checked out.

---

You are building **F1 Garage v2**, a premium web app for Formula 1 fans. You're upgrading the existing `f1-garage` Next.js project in this repository. Keep what works (the Nebius/Nemotron agent loop in `app/api/agent/route.ts`, the part data in `lib/parts.ts`, Tavily search in `lib/search.ts`) and replace the flat SVG car and the basic UI.

Work in milestones. After each one, run the app, take screenshots at desktop (1440×900) and phone (390×844) sizes, look at them critically, and fix what looks cheap before moving on. Commit after each milestone.

## 1. What the fan gets

1. **Choose a team.** All 11 teams on the 2026 grid: Ferrari, Mercedes, Red Bull Racing, McLaren, Aston Martin, Alpine, Williams, Racing Bulls, Haas, Audi and Cadillac. The whole site re-themes to that team. Remember the choice between visits.
2. **See the car in realistic 3D.** It loads on a turntable in a studio scene, then you can orbit and zoom around it. It should feel alive:
   - wheels that spin
   - a "drive" mode where the car runs on a rolling road or a short track loop, with motion blur, tyre rotation, suspension movement and camera shake
   - an idle mode with a slow cinematic camera move
3. **Click a part to take it apart.** The part animates off the car along its own path (the front wing slides forward, sidepods move outward, the engine cover lifts up to reveal the power unit, and so on). The rest of the car fades to a translucent ghost. The camera flies to frame the part, and an explanation panel opens. Then add:
   - a **"Exploded view"** button that separates every part at once, like a technical poster
   - **"Reassemble"** to put it back together
   - **Esc** or clicking empty space to undo the last step
4. **Understand each part.** The panel shows:
   - what the part does, explained simply first and then in engineering terms
   - the 2026 FIA rules that apply to it, with article numbers and links
   - this team's upgrades to that part this season, as a timeline by race weekend, with sources
   - a button to ask the engineer about it
5. **Follow upgrades and news.**
   - An **Upgrades** page: a race-by-race timeline per team, filterable by part, built from the FIA's official upgrade documents.
   - A **Regulations** page: technical, sporting and financial rules, searchable, with plain-language summaries and "what changed" notes when the FIA revises them.
   - A **News** feed: team press releases, FIA decisions and reputable technical press.
   - A **Live** strip on race weekends: session status, timing and race control messages.
6. **Ask the race engineer.** A chat agent that answers questions, cites its sources, separates confirmed facts from rumours, and can take control of the 3D view to explode, highlight and fly to parts as it explains them.

## 2. The 3D car

Most of the realism comes from the 3D model file and the lighting, not from code. Handle it like this:

- **Model source.** Ask the user which option they want before starting this milestone:
  1. a licensed, game-ready 2026-style F1 car model (GLB or FBX, from Sketchfab, CGTrader or TurboSquid) whose licence allows web use and modification
  2. a commissioned model
  3. as a fallback, a procedural model you build in code from three.js shapes

  The procedural option will look clearly less realistic. Never take a model whose licence doesn't allow this use, and never extract models from games.
- **Pipeline.** Convert the model to glTF/GLB, split it into separately named meshes using the part ids from `lib/parts.ts` (`front-wing`, `nose`, `front-suspension`, `cockpit`, `sidepods`, `floor`, `engine-cover`, `power-unit`, `rear-suspension`, `diffuser`, `beam-wing`, `rear-wing`, `front-tyres`, `rear-tyres`), and set each pivot to the part's centre. Compress with `gltf-transform` (Draco or Meshopt geometry, KTX2 textures). Aim for under 8 MB on desktop, plus a lighter version for phones.
- **Rendering.** Use React Three Fiber, `@react-three/drei` and `@react-three/postprocessing`, with:
  - physically based materials: clear-coat paint, matte and woven carbon fibre, rubber with a sidewall normal map, metal for the brakes and suspension
  - an HDRI studio environment
  - soft contact shadows and a reflective floor
  - tone mapping, subtle bloom on the brake discs in drive mode, and depth-of-field when focused on a part
- **Liveries.** Each team gets body colours plus one livery texture. Use **generic** livery designs inspired by each team's colours. Don't use official team logos, sponsor logos, F1 or FIA marks, or copyrighted artwork unless the user confirms they have a licence. Show a "unofficial fan project" notice in the footer.
- **Taking parts apart.** Every part gets an explode direction and distance, and the animation runs on springs. Hovering a part outlines it; selecting it makes the others translucent. Build an annotation system that places labels with leader lines on the parts, like the arrows in technical drawings.
- **Animation.** Wheel spin speed follows the drive speed. Add a small suspension bounce, show the active-aero flap moving between cornering and straight-line modes, and add a camera rig with presets (hero, top, side, front, rear, close-up on each part).
- **Performance.** Hold 60 fps on a 2020 laptop and at least 30 fps on a mid-range phone. Load the 3D scene lazily with a branded loader. If WebGL isn't available, show a high-quality image render. Respect reduced-motion settings: no automatic camera moves or drive mode.

## 3. Data: legitimate sources only

Build a scheduled data pipeline. Never scrape live pages on every user request. Respect each site's terms, `robots.txt` and rate limits, keep a link back to every source, and never republish full paywalled articles (store a title, a short summary and the link).

| Data | Source | How to get it |
|---|---|---|
| Official upgrade lists for each team, every Grand Prix | FIA event documents at fia.com (the "car presentation" documents published each race weekend) | Poll each event's documents page; download new PDFs; extract them into structured data (team, race, part area, description, stated reason) |
| Technical, sporting and financial rules, technical directives, stewards' decisions | fia.com regulations and documents pages | Store each version; chunk by article; index for search; on a new version, generate a "what changed" summary |
| Live timing, session status, race control messages, car data | OpenF1 API (openf1.org) | Poll during sessions; cache; show the live strip |
| Results, standings, calendar | Jolpica-F1 API (the successor to Ergast) | Refresh daily, plus right after each session |
| Team news | Official team press pages and RSS feeds, formula1.com news | Use RSS where it exists, otherwise the Tavily search/extract API; store headline, summary, link and date |
| Technical analysis | Reputable press (The Race, Autosport, Motorsport.com) | Tavily, with source domains limited to these; links and summaries only |
| Anything else the engineer needs right now | Tavily search, preferring the domains above | Agent tool, called when needed |

- **Storage.** Use Postgres (Supabase or Neon) with `pgvector`. Tables: `teams`, `parts`, `events`, `upgrades` (team, event, part_id, description, reason, source_url, confidence), `regulations` (document, version, article, text, embedding), `news` (team, title, summary, url, published_at, source, type: official/press/rumour), `sources`.
- **Mapping upgrades to parts.** Use the model with a strict JSON schema to map each upgrade line to one of the part ids. Keep the original FIA wording next to the summary.
- **Scheduling.** Use Vercel Cron, GitHub Actions or Supabase scheduled functions. Poll every 30 minutes on race weekends and every 6 hours otherwise.

## 4. The agent

- **Model.** NVIDIA Nemotron on Nebius Token Factory, through the OpenAI-compatible API. The model id comes from `NEBIUS_MODEL`; pick the largest Nemotron the account lists that supports tool calling. Keep the existing step where hidden `<think>` reasoning is stripped from the stream.
- **Tools.** The server runs every tool and returns compact JSON:
  - `get_upgrades(team, event?, part_id?)`
  - `search_regulations(query, document?)`
  - `get_regulation_article(document, article)`
  - `get_news(team?, type?, since?)`
  - `web_search(query)` (Tavily, as a fallback)
  - `get_live_session()` (OpenF1)
  - `get_standings()` and `get_calendar()` (Jolpica)
  - `compare_teams(teams[], part_id)`
  - UI tools the browser carries out: `explode_part(part_id)`, `highlight_parts([{id, note}])`, `set_camera(preset)`, `reassemble()`
- **Behaviour.**
  - Answer from the database first, and use web search only when the database doesn't cover the question.
  - Cite every factual claim.
  - Label anything that isn't confirmed by the FIA or the team as press report or rumour.
  - Say the race weekend for every upgrade.
  - Match the depth of the answer to the user (beginner or engineer, with a toggle).
  - Answer in the language the user writes in.
- **Safety and cost.** Rate-limit by IP, limit the number of tool calls per question, cache answers to common questions, and never send API keys to the browser.
- **Evaluation.** Write 30 test questions with expected sources, for example "What did Ferrari bring to Monza?", "Explain overtake mode" and "Which teams updated their floor at the last race?". Run them in CI and report accuracy and citation coverage.

## 5. Design

Aim for the quality of a top motorsport broadcast graphics package or a car maker's configurator, not a dashboard template.

- **Look.** Dark-first, with a light theme too. The 3D scene fills the whole screen behind floating glass panels. Team colours are accents, never large flat backgrounds. Use thin technical lines, grid textures and spec-sheet details.
- **Type.** Use an open-licence display face (for example Titillium Web, Space Grotesk or Saira) with a clean body face. Use monospaced numbers for data. Don't use the official F1 fonts.
- **Motion.** Use Framer Motion for the interface and springs in 3D. Team switches get a short transition with a colour wash, a camera sweep and a livery swap. Panels slide, and nothing jumps.
- **Pages.**
  - **Garage:** the home page, with the 3D car, part dock, explanation panel and engineer drawer.
  - **Upgrades:** the timeline, with filters by team and part.
  - **Regulations:** the rules explorer.
  - **News:** the news feed.
  - **Live:** live timing on race weekends.
  - **Team page:** car specs, recent upgrades and news for one team.
- **Components.** Team switcher (logo-free cards: colour band, team name and car name), part dock (horizontal, scrollable, with an upgrade badge when a part changed recently), source chips with favicons, and a "confirmed / reported / rumour" badge.
- **Quality bar.**
  - It works on phones, with the 3D view as a swipeable stage and panels as bottom sheets.
  - Keyboard: Tab moves through parts and Enter takes them apart.
  - Colours meet WCAG AA contrast.
  - Lighthouse scores: performance 85 or more on desktop, accessibility 95 or more.

## 6. Technology

Next.js (App Router) with TypeScript, React Three Fiber, drei, postprocessing, three.js, Framer Motion, Tailwind CSS with design tokens, Zustand for 3D and interface state, Postgres with pgvector, the `openai` SDK pointed at Nebius, `@tavily/core`, and a PDF parser for FIA documents. Deploy on Vercel (or similar) with scheduled jobs. Keep secrets in environment variables: `NEBIUS_API_KEY`, `NEBIUS_MODEL`, `TAVILY_API_KEY` and `DATABASE_URL`.

## 7. Milestones

1. **Design system and app shell.** Tokens, typography, layout, team theming for all 11 teams, and every page created with placeholder content.
2. **3D stage.** Model loading, studio lighting, materials, turntable, camera presets and the image fallback when WebGL is missing.
3. **Interaction.** Hover, select, taking single parts apart, exploded view, reassembly, annotations and the explanation panel tied to `lib/parts.ts`.
4. **Motion.** Drive mode with spinning wheels, rolling road, motion blur, suspension movement and the active-aero animation.
5. **Data pipeline.** Database schema; importers for FIA documents, regulations, OpenF1, Jolpica and news; scheduling; mapping upgrades to parts.
6. **Agent v2.** New tools, UI tools driving the 3D view, citations, fact/rumour labels and the evaluation set.
7. **Pages.** Upgrades timeline, Regulations explorer, News, Live and Team pages.
8. **Polish.** Performance, accessibility, the phone layout, SEO and social preview images, the fan-project notice and the deployment.

## 8. Ask the user before you start

- Which source for the 3D model (licensed, commissioned or procedural), and the budget.
- Hosting and database (Vercel with Supabase is the default).
- Whether they have permission to use any official logos or liveries (the default is no; use generic liveries).
- Languages to support (the default is English only).

## 9. Definition of done

- All 11 teams can be chosen, and each one re-themes the car and the site.
- Clicking any of the 14 parts takes it apart with a smooth animation and opens its explanation; exploded view and reassemble both work.
- The car can drive with spinning wheels, and the scene holds the frame rates in section 2.
- The upgrade timeline shows real FIA upgrade data for at least the latest three Grands Prix, every entry with a source.
- The engineer answers the 30 evaluation questions with citations and takes control of the 3D view when it explains parts.
- Desktop and phone screenshots look like a premium product, with no layout bugs or horizontal scrolling.
