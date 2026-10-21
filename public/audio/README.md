# Audio

Everything here is free to use on this site. Sources and licences:

## Music

| File | Track | Artist | Licence | Source |
| --- | --- | --- | --- | --- |
| `theme.mp3` (garage, while you explore the car) | Limit 70 | Kevin MacLeod | Public domain (CC0) | [FreePD](https://freepd.com) |
| `grid.mp3` (race grid, before lights out; first 75 s with a fade) | Apex | Alexander Nakarada | Public domain (CC0) | [FreePD](https://freepd.com) |

Both were taken from the [SoundSafari CC0-1.0 Music](https://github.com/SoundSafari/CC0-1.0-Music) collection of FreePD's public-domain catalogue, loudness-normalised and re-encoded at 112 kbps. No attribution is required; it's given here anyway.

The official Formula 1 theme and the F1 film soundtrack are copyrighted and are not used.

## Engine

| File | What | Recording | Licence |
| --- | --- | --- | --- |
| `engine/ferrari-458.m4a` + `engine/engine.json` | Engine loops from idle to 9,000 rpm, on and off throttle, plus exhaust pops, crackles and a gear shift | Ferrari 458 (2013, 4.5-litre flat-plane V8), intake mic, by Pole Position Production | Sonniss GDC 2020 Game Audio Bundle licence |
| `engine-start.m4a` | Start-up: starter, catch, flare, idle | Ferrari 812 Superfast (2018, 6.5-litre V12), onboard, by Pole Position Production | Sonniss GDC 2020 Game Audio Bundle licence |

The [Sonniss #GameAudioGDC bundles](https://sonniss.com/gdc-bundle-license/) are free and royalty-free: commercial use is allowed, no attribution is required, and the sounds may be distributed as part of a production (not sold as-is or used to train AI). The loops were cut, levelled and made seamless by Yassin Soliman in [yassinsolim/personal-portfolio](https://github.com/yassinsolim/personal-portfolio) (MIT); this site uses that sprite unchanged (both the AAC `.m4a` and Opus `.webm` encodings, for browsers that can only decode one of them) and maps its revs (1,015–9,000 rpm) onto the car's range (4,300–11,900 rpm), so the top of each gear is the 458's scream.

No freely licensed recording of a current F1 car exists that can be shipped, so the closest high-revving licensed engine is used. To swap it, replace the files and keep the format of `engine/engine.json`: either `{"sprite": "file.m4a", "layers": [{"start", "dur", "rpm", "load": "on"|"off"}], "shots": {"pop": [...], "crackle": [...], "shift": [...]}}`, or one file per layer with `{"layers": [{"file", "rpm", "load"}]}`.

### MIT notice for the cut loops

Copyright 2024 Henry Heffernan, Copyright 2025-2026 Yassin Soliman. Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
