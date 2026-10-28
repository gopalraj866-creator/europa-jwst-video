# Europa × JWST — 8-minute Three.js science film

**"JWST detected carbon dioxide on Europa"** — a fully procedural, WebGL (Three.js) film: 15 scenes, 8:00 long, 16:9 and a 9:16 Short,
rendered frame-by-frame in **GitHub Actions** (software WebGL, no GPU needed), with narration, generated music and YouTube-loudness mastering.

## Quick start (GitHub)
1. Create a new GitHub repo and push this folder (`git init && git add . && git commit -m init && git push`).
2. Edit `src/data/config.json` → set `channelName` (shown in the end card).
3. **Actions → "Render Europa × JWST video" → Run workflow**, choose:
   | input | meaning |
   |---|---|
   | `format` | `1080p`, `4k` (3840×2160), `shorts` (1080×1920, ~62 s), or `all` |
   | `fps` | 24 / 30 / 60 |
   | `parallel` | render jobs per format (1–20). Same total CPU, less wall-clock time |
   | `quality` | `standard` (JPEG frames, CRF 16) or `max` (PNG frames, CRF 12, slow preset) |
   | `captions` | burn captions into the 16:9 video (Shorts always burn them in; an `.srt` is always produced) |
   | `voice` | any edge-tts voice, e.g. `en-US-AndrewNeural`, `en-GB-RyanNeural`, `en-IN-PrabhatNeural` |
4. Download the `FINAL-europa_jwst_*` artifact(s): `.mp4` (H.264 + AAC 320 kbps, −14 LUFS), `*_master.flac`, `*_captions.srt`, `*_chapters.txt`, `thumbnail.jpg` (16:9).

**Cost note.** Rendering is CPU-only: roughly 1080p ≈ 2–4 CPU-hours, 4K ≈ 10–20 CPU-hours in total (spread across the parallel jobs).
Public repos get free Actions minutes; private repos on the free plan (2,000 min/month) can do 1080p/Shorts but not 4K.

## Best possible sound
* **Narration**: default is a neural TTS voice (edge-tts, needs internet – available on GitHub runners). For the *best* result record your own voice:
  put one file per scene in `assets/narration/<sceneId>.wav` (ids are in `src/data/timeline.json`, e.g. `hook.wav`, `discovery.wav`). They replace TTS automatically.
* **Music** is synthesised (pads, sub drone, FM bells, soft arpeggio, risers, impacts) and follows each scene's `energy`; it is sidechain-ducked under the voice.
* Voice chain: HPF, EQ, compression, light room reverb → mix → two-pass `loudnorm` (−14 LUFS, −1.5 dBTP) → AAC 320 kbps / 48 kHz.
* Narration timing is checked per scene (`build/audio/<mode>/…` log prints `OK/OVERFLOW`). Edit text or scene `dur` in `timeline.json`.

## Run locally
```bash
npm install            # needs Node 20+ ; downloads Chromium
pip install -r requirements.txt && sudo apt install ffmpeg
npm run dev            # live preview in your browser (GPU) → http://localhost:5173/src/index.html?preview=1
npm run audio          # builds soundtrack (build/audio/full)
node scripts/snap.mjs --scene discovery --p 0.6            # still frame → build/snap
node scripts/render.mjs --mode full --res 1920x1080 --chunks 1 --out build/segments/seg_000.mp4
npm run assemble       # → build/final/
```

## What's in the film (all scenes are procedural; nothing is NASA imagery)
Hook · Meet Europa · Scale (Earth/Moon/Europa) · Cutaway of the interior · Tidal heating (Io-Europa-Ganymede 4:2:1 resonance) · Why carbon ·
JWST model (18 mirror segments, 5-layer sunshield) · L2 orbit · How NIRSpec reads a spectrum (Europa at ~10 pixels) · **The CO₂ discovery at Tara Regio** ·
Chaos-terrain flyover · Where did the carbon come from? · Caveats · Europa Clipper & Juice · End card.
Everything on screen that is not measured data (textures, spectrum shape, CO₂ map, terrain) is labelled illustrative / artist's visualisation.

## Facts used (verify before you publish)
* Two independent teams (Villanueva et al., NASA Goddard; Trumbo & Brown, Cornell/Caltech) reported CO₂ ice on Europa, concentrated in **Tara Regio** (~1,800 km chaos terrain), weaker in Powys Regio. *Science* 381, 1305 & 1308, 21 Sep 2023. Detected with NIRSpec IFU near 4.25–4.27 µm. Interpreted as ocean-derived carbon; no plumes detected (does not rule them out).
* Hubble 2019: irradiated NaCl in Tara Regio (Trumbo et al., *Science Advances* 5, eaaw7123).
* Ice shell ~15–30 km, ocean ~60–150 km deep, ~2× Earth's ocean water (NASA/JPL). Webb: 6.5 m, 18 segments, L2 ~1.5 million km.
* Europa Clipper: launched 14 Oct 2024, Earth flyby 3 Dec 2026, Jupiter arrival Apr 2030. Juice: launched Apr 2023, two Europa flybys Jul 2032.
* 2026 follow-up (Yoffe et al., arXiv preprint) suggests CO₂ extends across more chaos terrain.

## YouTube tips
Upload the 4K file as 4K (YouTube gives it a better codec). Paste `*_chapters.txt` into the description; upload the `.srt` as captions; add the sources above.
Upload `…_shorts.mp4` separately (vertical, with burned captions).

## Layout
`src/` Three.js app (`main.js` engine, `scenes/*`, `lib/*`, `data/timeline.json` script+timing) · `scripts/` render/audio/assemble · `.github/workflows/render.yml`
