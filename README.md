# F1 Garage

Pick your team, explore its car part by part, and ask an AI race engineer about upgrades and FIA regulations.
The engineer runs on an **NVIDIA Nemotron** model served by **Nebius Token Factory**.

```bash
cd f1-garage
cp .env.example .env.local   # add NEBIUS_API_KEY (and EXA_API_KEY for live news)
npm install
npm run dev                  # http://localhost:3002
```

## What's here

| Path | What |
|------|------|
| `components/CarView.tsx` | Plan-view SVG of the car. Every part is its own clickable shape, painted in the team's livery. |
| `components/Garage.tsx` | Team picker, part explainer and the chat with the engineer. |
| `lib/parts.ts` | The 14 parts: what each one does, how it works, the 2026 rules for it, what upgrades look like. |
| `lib/teams.ts` / `lib/regulations.ts` | The 2026 grid with livery colours, and the headline FIA rule changes. |
| `app/api/agent/route.ts` | The agent loop. Streams NDJSON events to the browser. |
| `lib/agent.ts` | System prompt and the two tools. |

## How the agent works

Nebius exposes an OpenAI-compatible API, so the server uses the `openai` SDK with `baseURL` pointed at Nebius.
The model gets two function tools, and both run on the server:

- `web_search`: searches with [Exa](https://exa.ai) for recent upgrades, FIA documents and technical press. It's only offered when `EXA_API_KEY` is set. Without it, the engineer answers from what the model already knows.
- `highlight_parts`: lights up parts on the user's car with numbered markers and a short note, like the arrows in a technical drawing.

Each question carries a `[Garage context]` line (team, selected part, today's date), so "this part" and "the latest" resolve correctly.
Nemotron reasoning models can inline `<think>…</think>`. The route strips it from the stream.

## Choosing the model

Model ids vary by account, so list yours and pick a Nemotron that supports tool calling:

```bash
curl -s https://api.tokenfactory.nebius.com/v1/models -H "Authorization: Bearer $NEBIUS_API_KEY" | grep -i nemotron
```

Set it as `NEBIUS_MODEL`. The default, `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`, is cheap and fast.
For the best explanations, use the largest Nemotron your account lists (for example Nemotron 3 Super or Nemotron Ultra).
