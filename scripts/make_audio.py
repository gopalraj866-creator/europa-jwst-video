#!/usr/bin/env python3
"""
Builds the complete soundtrack for the video:
  1. narration  - per-sentence TTS (edge-tts neural voice), or your own recordings in assets/narration/<sceneId>.wav|mp3
  2. music      - procedurally synthesised ambient score (pads, sub drone, bells, arpeggio, risers, impacts) that follows
                  the per-scene "energy" values in src/data/timeline.json
  3. mix        - sidechain-ducked music + EQ'd/compressed narration + convolution reverb, 48 kHz stereo float
  4. master     - ffmpeg two-pass loudnorm to -14 LUFS / -1.5 dBTP (YouTube target), AAC 320 kbps + 24-bit FLAC master
Outputs in build/audio/<mode>/ : mix.m4a, master.flac, narration.wav, music.wav, cues.json, captions.srt
Usage: python3 scripts/make_audio.py --mode full|short [--engine edge|espeak|silent]
"""
import argparse, asyncio, json, os, re, subprocess, sys, wave
from pathlib import Path
import numpy as np
from scipy import signal

SR = 48000
ROOT = Path(__file__).resolve().parent.parent

def run(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, **kw)

def load_audio(path):
    """any audio file -> float32 mono @ SR via ffmpeg"""
    out = run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"]).stdout
    return np.frombuffer(out, dtype=np.float32).copy()

def write_wav(path, data, sr=SR):
    d = np.atleast_2d(data) if data.ndim == 1 else data.T
    pcm = (np.clip(np.nan_to_num(d.T, nan=0.0, posinf=1.0, neginf=-1.0), -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1 if data.ndim == 1 else 2); w.setsampwidth(2); w.setframerate(sr); w.writeframes(pcm.T.tobytes() if data.ndim == 1 else pcm.tobytes())

# ------------------------------------------------------------------------------------------------ narration
async def tts_edge(text, voice, rate, pitch, out):
    import edge_tts
    last = None
    for attempt in range(4):
        try:
            await asyncio.wait_for(edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).save(str(out)), 60)
            if out.exists() and out.stat().st_size > 800:
                return
        except Exception as e:  # network hiccup / throttling
            last = e; await asyncio.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"edge-tts failed: {last}")

def tts_espeak(text, out):
    run(["espeak-ng", "-v", "en-us+m3", "-s", "150", "-p", "40", "-w", str(out), text])

def synth_sentence(text, idx, tmp, cfg, engine):
    f = tmp / f"s{idx:03d}"
    if engine == "silent":
        n = int(SR * max(1.2, len(text.split()) / 2.5)); return np.zeros(n, np.float32)
    if engine == "noise":   # offline test engine: speech-like modulated noise (exercises the real DSP path)
        n = int(SR * max(1.2, len(text.split()) / 2.5)); t = np.arange(n) / SR
        rng = np.random.default_rng(idx); am = 0.5 + 0.5 * np.sin(2 * np.pi * 3.2 * t) ** 2
        return (signal.sosfilt(signal.butter(2, [150, 3500], "band", fs=SR, output="sos"), rng.standard_normal(n)) * am * 0.12).astype(np.float32)
    if engine == "edge":
        try:
            mp3 = f.with_suffix(".mp3")
            asyncio.run(tts_edge(text, cfg["voice"], cfg["voiceRate"], cfg["voicePitch"], mp3)); return load_audio(mp3)
        except Exception as e:
            print(f"  ! edge-tts failed for sentence {idx} ({e}); falling back to espeak-ng", file=sys.stderr)
    wav = f.with_suffix(".wav"); tts_espeak(text, wav); return load_audio(wav)

def trim_silence(x, thr=0.004):
    idx = np.where(np.abs(x) > thr)[0]
    return x[max(0, idx[0] - int(0.03 * SR)): idx[-1] + int(0.06 * SR)] if len(idx) else x

def build_narration(entries, cfg, engine, tmp):
    total = int(sum(e["dur"] for e in entries) * SR)
    track = np.zeros(total, np.float32); cues = []; report = []
    n = 0
    for e in entries:
        t0 = e["start"]; budget = e["dur"] - cfg["narrationLeadIn"] - 0.7
        own = next((p for ext in ("wav", "mp3", "m4a", "flac") for p in [ROOT / "assets" / "narration" / f"{e['id']}.{ext}"] if p.exists()), None)
        parts = []
        if own:
            parts = [(" ".join(e["say"]), trim_silence(load_audio(own)))]
        else:
            for s in e["say"]:
                parts.append((s, trim_silence(synth_sentence(s, n, tmp, cfg, engine)))); n += 1
        gap = int(cfg["sentenceGap"] * SR)
        length = sum(len(a) for _, a in parts) + gap * (len(parts) - 1)
        tempo = 1.0
        if length / SR > budget:
            tempo = min(1.14, (length / SR) / budget)
            parts = [(s, time_stretch(a, tempo)) for s, a in parts]
            length = sum(len(a) for _, a in parts) + gap * (len(parts) - 1)
        status = "OK" if length / SR <= budget + 0.25 else "OVERFLOW"
        report.append(f"{e['id']:<10} narration {length/SR:5.1f}s / budget {budget:5.1f}s  tempo x{tempo:.2f}  {status}")
        pos = int((t0 + cfg["narrationLeadIn"]) * SR)
        if own:   # spread caption text proportionally over the recording
            words = parts[0][0].split(); sents = re.split(r"(?<=[.!?])\s+", parts[0][0])
            cum = 0; tot = max(1, sum(len(s) for s in sents))
            for s in sents:
                a = cum / tot; cum += len(s); b = cum / tot
                cues.append({"t0": round(t0 + cfg["narrationLeadIn"] + a * length / SR, 2), "t1": round(t0 + cfg["narrationLeadIn"] + b * length / SR, 2), "text": s})
        for s, a in parts:
            end = min(total, pos + len(a)); track[pos:end] += a[: end - pos]
            if not own: cues.append({"t0": round(pos / SR, 2), "t1": round(end / SR, 2), "text": s})
            pos += len(a) + gap
    return track, cues, report

def time_stretch(a, r):
    out = run(["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-filter:a", f"atempo={r:.4f}", "-f", "f32le", "-"], input=a.tobytes()).stdout
    return np.frombuffer(out, np.float32).copy()

def process_voice(x):
    """EQ + gentle compression + de-ess-ish via ffmpeg, then +limiting"""
    flt = ("highpass=f=80,equalizer=f=180:t=q:w=1.0:g=1.5,equalizer=f=3200:t=q:w=1.2:g=2.0,"
           "equalizer=f=7500:t=q:w=2:g=-2.0,acompressor=threshold=0.09:ratio=3:attack=8:release=140:makeup=3,alimiter=limit=0.92")
    out = run(["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-af", flt, "-f", "f32le", "-"], input=x.astype(np.float32).tobytes()).stdout
    return np.frombuffer(out, np.float32).copy()

# ------------------------------------------------------------------------------------------------ music
def midi(n): return 440.0 * 2 ** ((n - 69) / 12)

def rev_ir(seconds, seed, damp=6000):
    rng = np.random.default_rng(seed); n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-t * (6.9 / seconds))
    sos = signal.butter(2, damp, "low", fs=SR, output="sos"); ir = signal.sosfilt(sos, ir)
    ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    return (ir / np.sqrt(np.sum(ir ** 2))).astype(np.float32)

def reverb(x, wet=1.0, seconds=4.5):
    L = signal.oaconvolve(x, rev_ir(seconds, 1), mode="full")[: len(x)]
    R = signal.oaconvolve(x, rev_ir(seconds, 2), mode="full")[: len(x)]
    return np.stack([L, R]) * wet

def smooth_env(points, n, kind="cubic"):
    xs = np.array([p[0] for p in points]) * SR; ys = np.array([p[1] for p in points])
    return np.interp(np.arange(n), xs, ys)

def pad_note(freq, dur, bright):
    n = int(dur * SR); t = np.arange(n) / SR; y = np.zeros(n)
    for det in (-0.0035, 0.0, 0.0035):
        f = freq * (1 + det) ; K = max(2, min(14, int(bright * 14) + 2, int(5200 / f)))
        ph = 2 * np.pi * f * t + 0.6 * np.sin(2 * np.pi * 0.17 * t + det * 900)
        for k in range(1, K + 1): y += np.sin(k * ph) / (k ** 1.15) * (0.9 if k % 2 == 0 else 1.0)
    return y / 3.0

def adsr(n, a, r):
    e = np.ones(n); na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na) ** 1.5; e[-nr:] *= np.linspace(1, 0, nr) ** 1.5; return e

CHORDS = [  # D dorian-ish ambient progression: Dm9 | Bbmaj7 | Gm9 | A7sus4, bass root
    ([50, 53, 57, 60, 64], 26), ([46, 53, 57, 62, 65], 22), ([43, 55, 58, 62, 65, 69], 19), ([45, 52, 57, 62, 64, 67], 21)]
SCALE = [62, 64, 65, 67, 69, 72, 74, 76, 77, 81]

def compose(entries, duration, seed=11):
    rng = np.random.default_rng(seed); N = int(duration * SR)
    centers = [(e["start"] + e["dur"] / 2, e.get("energy", 0.4)) for e in entries]
    energy = np.interp(np.arange(N) / SR, [c[0] for c in centers], [c[1] for c in centers])
    energy = signal.sosfiltfilt(signal.butter(1, 0.15, "low", fs=SR, output="sos"), energy)
    bright_lo, bright_hi = 0.15, 0.8
    L = np.zeros(N); R = np.zeros(N)

    # --- pads: 8 s chords with 2 s overlap
    cl = 8.0; t = 0.0; ci = 0
    while t < duration:
        notes, bass = CHORDS[ci % len(CHORDS)]; n = int((cl + 3) * SR); env = adsr(n, 3.2, 3.5)
        e_mid = float(energy[min(N - 1, int((t + cl / 2) * SR))])
        mix = np.zeros(n)
        for j, m in enumerate(notes): mix += pad_note(midi(m), cl + 3, bright_lo + (bright_hi - bright_lo) * e_mid) * (0.9 - 0.08 * j)
        mix *= env * 0.10
        pan = rng.uniform(-0.3, 0.3)
        a = int(t * SR); b = min(N, a + n)
        L[a:b] += mix[: b - a] * (1 - pan) ; R[a:b] += mix[: b - a] * (1 + pan)
        # sub drone
        sub = np.sin(2 * np.pi * midi(bass) * np.arange(n) / SR) * adsr(n, 2.5, 3.5) * (0.07 + 0.05 * e_mid)
        sub += 0.3 * np.sin(2 * np.pi * midi(bass + 12) * np.arange(n) / SR) * adsr(n, 2.5, 3.5) * 0.05
        L[a:b] += sub[: b - a]; R[a:b] += sub[: b - a]
        t += cl; ci += 1

    # --- bells (FM), denser with energy
    t = 3.0
    while t < duration - 3:
        e = float(energy[int(t * SR)]); 
        if rng.random() < 0.25 + 0.7 * e:
            f = midi(int(rng.choice(SCALE))); d = 5.0; n = int(d * SR); tt = np.arange(n) / SR
            idx = 1.8 * np.exp(-tt * 2.2)
            y = np.sin(2 * np.pi * f * tt + idx * np.sin(2 * np.pi * f * 3.5 * tt)) * np.exp(-tt * 0.95) * (0.035 + 0.05 * e)
            y *= np.linspace(0, 1, n) ** 0.05 * np.minimum(1, tt * 200)
            pan = rng.uniform(-0.8, 0.8); a = int(t * SR); b = min(N, a + n)
            L[a:b] += y[: b - a] * (1 - pan); R[a:b] += y[: b - a] * (1 + pan)
        t += float(rng.choice([2.0, 3.0, 4.0]))

    # --- soft arpeggio pulse (energy > 0.5)
    step = 0.5; t = 0.0; arp = [50, 57, 60, 64, 62, 60, 57, 53]; k = 0
    chord_roots = [50, 46, 43, 45]
    while t < duration:
        e = float(energy[min(N - 1, int(t * SR))]); g = max(0.0, (e - 0.5) / 0.5)
        if g > 0.02:
            root = chord_roots[int(t // cl) % 4]; note = root + 12 + [0, 7, 12, 16, 14, 12, 7, 3][k % 8] + (12 if (k // 8) % 2 else 0)
            f = midi(note); n = int(1.4 * SR); tt = np.arange(n) / SR
            y = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * 2 * f * tt)) * np.exp(-tt * 5.5) * np.minimum(1, tt * 400) * 0.07 * g
            a = int(t * SR); b = min(N, a + n); pan = np.sin(k * 0.9) * 0.5
            L[a:b] += y[: b - a] * (1 - pan); R[a:b] += y[: b - a] * (1 + pan)
        t += step; k += 1

    dry = np.stack([L, R])
    wet = reverb((L + R) * 0.5, 1.0) * 0.55
    music = dry * 0.75 + wet
    return music, energy

def noise_swell(dur, rise=True, f0=300, f1=7000, seed=0):
    rng = np.random.default_rng(seed); n = int(dur * SR); x = rng.standard_normal(n); out = np.zeros(n)
    chunks = 24
    for i in range(chunks):
        a, b = n * i // chunks, n * (i + 1) // chunks
        fc = f0 * (f1 / f0) ** (i / (chunks - 1)); sos = signal.butter(2, [fc * 0.7, min(fc * 1.3, SR / 2 - 100)], "band", fs=SR, output="sos")
        out[a:b] = signal.sosfilt(sos, x[a:b])
    env = (np.linspace(0, 1, n) ** 2.2) if rise else np.exp(-np.linspace(0, 6, n))
    return out * env

def boom(dur=3.5):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 48 * np.exp(-t * 0.9) + 26
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.5)
    rng = np.random.default_rng(3); nz = signal.sosfilt(signal.butter(2, 900, "low", fs=SR, output="sos"), rng.standard_normal(n)) * np.exp(-t * 6)
    return (y * 0.9 + nz * 0.25)

def sfx_layer(entries, N):
    L = np.zeros(N); R = np.zeros(N)
    def add(x, at, g=1.0, pan=0.0):
        a = int(at * SR); b = min(N, a + len(x))
        if a < 0 or a >= N: return
        L[a:b] += x[: b - a] * g * (1 - pan); R[a:b] += x[: b - a] * g * (1 + pan)
    for i, e in enumerate(entries):
        if i > 0: add(noise_swell(1.1, rise=False, f0=500, f1=2500, seed=i), e["start"] - 0.1, 0.05)     # soft transition whoosh
        for s in e.get("sfx", []):
            kind, at = s.split("@"); t = e["start"] + float(at)
            if kind == "boom": add(boom(), t, 0.55)
            if kind == "riser": add(noise_swell(5.5, True, 250, 9000, seed=7), t, 0.09)
    return np.stack([L, R])

def duck_envelope(voice, depth_db):
    env = np.abs(voice); win = int(0.05 * SR)
    # FFT convolution can return tiny negative values -> sqrt() gives NaN, which poisons the whole mix. Clamp first.
    env = np.sqrt(np.maximum(signal.oaconvolve(env ** 2, np.ones(win) / win, mode="same"), 0.0))
    env = np.nan_to_num(env, nan=0.0, posinf=0.0, neginf=0.0)
    env = np.clip(env / 0.08, 0, 1)
    atk = signal.sosfiltfilt(signal.butter(1, 4.0, "low", fs=SR, output="sos"), env)    # smooth attack/release
    return 10 ** ((depth_db * np.clip(atk, 0, 1)) / 20)

# ------------------------------------------------------------------------------------------------ main
def srt_time(t):
    h, rem = divmod(t, 3600); m, s = divmod(rem, 60); return f"{int(h):02}:{int(m):02}:{int(s):02},{int((s % 1) * 1000):03}"

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--mode", default="full"); ap.add_argument("--engine", default=os.environ.get("TTS_ENGINE", "edge"))
    ap.add_argument("--no-master", action="store_true"); args = ap.parse_args()
    tl = json.loads((ROOT / "src/data/timeline.json").read_text()); cfg = json.loads((ROOT / "src/data/config.json").read_text())
    if os.environ.get("VOICE"): cfg["voice"] = os.environ["VOICE"]
    entries = []; acc = 0
    for e in tl[args.mode]: entries.append({**e, "start": acc}); acc += e["dur"]
    duration = acc; N = int(duration * SR)
    out = ROOT / "build" / "audio" / args.mode; tmp = out / "tmp"; tmp.mkdir(parents=True, exist_ok=True)
    print(f"[audio] mode={args.mode} duration={duration}s engine={args.engine}")

    voice, cues, report = build_narration(entries, cfg, args.engine, tmp)
    print("\n".join(report))
    if any("OVERFLOW" in r for r in report): print("  ! some narration overflows its scene; shorten the text or lengthen the scene in timeline.json", file=sys.stderr)
    voice = process_voice(voice)
    write_wav(out / "narration.wav", voice)

    print("[audio] composing music ..."); music, energy = compose(entries, duration)
    sfx = sfx_layer(entries, N)
    duck = duck_envelope(voice, cfg["musicDuckDb"])
    bed = (music * duck) + sfx
    for nm, a in (("voice", voice), ("music", music), ("duck", duck), ("sfx", sfx)):
        if not np.all(np.isfinite(a)): print(f"  ! non-finite samples in {nm}; sanitising", file=sys.stderr)
    voice = np.nan_to_num(voice); bed = np.nan_to_num(bed)
    vrev = reverb(voice, 1.0, 1.4) * 0.07
    vstereo = np.stack([voice, voice]) * 1.0 + vrev
    mix = bed * 0.9 + vstereo * 1.0
    fade = np.ones(N); fade[: int(0.8 * SR)] = np.linspace(0, 1, int(0.8 * SR)); fade[-int(2.5 * SR):] = np.linspace(1, 0, int(2.5 * SR)) ** 1.5
    mix = np.nan_to_num(mix) * fade
    if np.max(np.abs(mix)) < 1e-6: raise SystemExit("[audio] mix is silent - aborting (check narration / music stages)")
    mix /= max(1.0, np.max(np.abs(mix)) / 0.89)
    write_wav(out / "music.wav", (music * fade).T.T if False else (music * fade))
    raw = out / "mix_raw.wav"; write_wav(raw, mix)

    (out / "cues.json").write_text(json.dumps(cues, indent=1))
    (out / "captions.srt").write_text("\n".join(f"{i+1}\n{srt_time(c['t0'])} --> {srt_time(c['t1'])}\n{c['text']}\n" for i, c in enumerate(cues)))

    if not args.no_master:
        target = cfg["targetLUFS"]
        p1 = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(raw), "-af", f"loudnorm=I={target}:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
        js = json.loads(p1.stderr[p1.stderr.rindex("{"): p1.stderr.rindex("}") + 1])
        if not all(np.isfinite(float(js[k])) for k in ("input_i", "input_tp", "input_lra", "input_thresh", "target_offset")):
            raise SystemExit(f"[audio] loudnorm could not measure the mix (silent or invalid audio): {js}")
        ln = (f"loudnorm=I={target}:TP=-1.5:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:measured_LRA={js['input_lra']}:"
              f"measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true")
        run(["ffmpeg", "-y", "-v", "error", "-i", str(raw), "-af", ln + ",aresample=48000", "-c:a", "flac", "-sample_fmt", "s32", str(out / "master.flac")])
        run(["ffmpeg", "-y", "-v", "error", "-i", str(out / "master.flac"), "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-movflags", "+faststart", str(out / "mix.m4a")])
        print(f"[audio] measured {js['input_i']} LUFS -> mastered to {target} LUFS; wrote {out/'mix.m4a'}")
    print("[audio] done")

if __name__ == "__main__":
    main()
