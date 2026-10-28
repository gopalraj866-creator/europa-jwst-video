// Deterministic frame-by-frame render of the Three.js scene to an H.264 segment.
//   node scripts/render.mjs --mode full --res 3840x2160 --fps 30 --chunk 0 --chunks 12 --out build/segments/seg_00.mp4
// Every frame is a pure function of time, so chunks can render in parallel on different machines and be concatenated losslessly.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { startServer, PROJECT_ROOT } from './serve.mjs';
import { launch, openPage } from './browser.mjs';

const a = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, arr) => (x.startsWith('--') ? [...acc, [x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]] : acc), []));
const mode = a.mode || 'full';
const [W, H] = (a.res || '1920x1080').split('x').map(Number);
const fps = +(a.fps || 30);
const chunk = +(a.chunk || 0), chunks = +(a.chunks || 1);
const out = path.resolve(PROJECT_ROOT, a.out || `build/segments/seg_${String(chunk).padStart(3, '0')}.mp4`);
const format = a.format || 'jpeg';
const crf = a.crf || (W >= 3000 ? 17 : 16);
const preset = a.preset || 'medium';
const maxFrames = a['max-frames'] ? +a['max-frames'] : Infinity;
fs.mkdirSync(path.dirname(out), { recursive: true });

const timeline = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'src/data/timeline.json'), 'utf8'))[mode];
const duration = timeline.reduce((s, e) => s + e.dur, 0);
const total = Math.round(duration * fps);
const per = Math.ceil(total / chunks);
const f0 = chunk * per, f1 = Math.min(total, f0 + per, f0 + maxFrames);
if (f0 >= total) { console.log('nothing to render for this chunk'); process.exit(0); }
console.log(`[render] ${mode} ${W}x${H}@${fps} chunk ${chunk + 1}/${chunks}: frames ${f0}..${f1 - 1} of ${total}`);

const { server, port } = await startServer();
const browser = await launch();
const q = new URLSearchParams({ mode, w: W, h: H, format, captions: a.captions ?? (mode === 'short' ? '1' : '0'), bake: a.bake ?? '1', samples: a.samples ?? '', jpegq: a.jpegq ?? '0.97' });
if (a.samples === undefined) q.delete('samples');
const page = await openPage(browser, `http://127.0.0.1:${port}/src/index.html?${q}`, { width: W, height: H });

const ff = spawn('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(fps), '-c:v', format === 'png' ? 'png' : 'mjpeg', '-i', '-',
  '-vf', 'format=yuv420p,scale=in_range=full:out_range=tv:out_color_matrix=bt709:flags=lanczos',
  '-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-profile:v', 'high', '-level', W >= 3000 ? '5.1' : '4.2',
  '-g', String(fps * 2), '-keyint_min', String(fps * 2), '-sc_threshold', '0', '-bf', '2',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-r', String(fps), '-movflags', '+faststart', '-an', out
], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((res, rej) => { ff.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))); ff.stdin.on('error', () => {}); });

const t0 = Date.now();
for (let f = f0; f < f1; f++) {
  const data = await page.evaluate((t) => window.renderFrame(t), f / fps);
  const buf = Buffer.from(data.slice(data.indexOf(',') + 1), 'base64');
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  const n = f - f0 + 1;
  if (n % 25 === 0 || f === f1 - 1) {
    const el = (Date.now() - t0) / 1000, eta = (el / n) * (f1 - f0 - n);
    console.log(`[render] ${n}/${f1 - f0} frames  ${(n / el).toFixed(2)} fps  eta ${Math.round(eta / 60)} min`);
  }
}
ff.stdin.end();
await done;
await browser.close(); server.close();
console.log(`[render] wrote ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
