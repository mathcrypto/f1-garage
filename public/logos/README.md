# Team logos

Team and sponsor logos are trademarks, so none are bundled. If you have the right to use them, add them here and they appear on the car automatically.

1. Put transparent PNGs (or SVGs) in a folder per team, e.g. `ferrari/main.png`. Wide images work best, about 4:1.
2. List them in `manifest.json` using the team ids from `lib/teams.ts`:

```json
{
  "ferrari": { "main": "ferrari/main.png", "sponsor": "ferrari/sponsor.png" },
  "mclaren": { "main": "mclaren/main.png" }
}
```

- `main` replaces the team wordmark on the sidepods and both sides of the shark fin.
- `sponsor` goes on the front-wing and rear-wing main planes.

Teams without an entry keep the generated wordmarks.
