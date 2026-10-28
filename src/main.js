import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Assets } from './lib/assets.js';
import { makeView, caption, disclaimer, T } from './lib/hud.js';
import { clamp, sstep } from './lib/util.js';

const q = new URLSearchParams(location.search);
const MODE = q.get('mode') === 'short' ? 'short' : 'full';
const W = +q.get('w') || (MODE === 'short' ? 1080 : 1920);
const H = +q.get('h') || (MODE === 'short' ? 1920 : 1080);
const BAKE = +(q.get('bake') || 1);
const SAMPLES = q.has('samples') ? +q.get('samples') : (W * H > 4e6 ? 2 : 4);
const CAPTIONS = q.has('captions') ? q.get('captions') === '1' : MODE === 'short';
const FMT = q.get('format') === 'png' ? 'png' : 'jpeg';
const JPEG_Q = +(q.get('jpegq') || 0.97);
const PREVIEW = q.has('preview');

const [timeline, config] = await Promise.all([
  fetch('/src/data/timeline.json').then((r) => r.json()),
  fetch('/src/data/config.json').then((r) => r.json())
]);
const entries = [];
let acc = 0;
for (const e of timeline[MODE]) { entries.push({ ...e, start: acc }); acc += e.dur; }
const DURATION = acc;

let cues = [];
if (CAPTIONS) {
  try { cues = await fetch(`/build/audio/${MODE}/cues.json`).then((r) => (r.ok ? r.json() : [])); } catch { cues = []; }
}

await Promise.all(['500 20px "Space Grotesk"', '700 20px "Space Grotesk"', '400 20px Inter', '600 20px Inter'].map((f) => document.fonts.load(f)));

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.setClearColor(0x000000, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const V = makeView(W, H);
const assets = new Assets(renderer, { bakeScale: BAKE });
const ctx = {
  THREE, renderer, assets, W, H, V, u: V.u, portrait: V.portrait, aspect: W / H, mode: MODE, short: MODE === 'short', config,
  D: (d) => (V.portrait ? d * 1.6 : d)       // camera distance helper: keep subjects inside narrow frames
};

const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: SAMPLES });
const composer = new EffectComposer(renderer, rt);
const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
const bloomRes = W * H > 4e6 ? new THREE.Vector2(W / 2, H / 2) : new THREE.Vector2(W, H);
const bloom = new UnrealBloomPass(bloomRes, 0.6, 0.6, 0.85);
composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(new OutputPass());
composer.setSize(W, H);

const out = document.createElement('canvas');
out.width = W; out.height = H;
const g = out.getContext('2d', { alpha: false });

const sceneCache = {};
async function getScene(name) {
  if (!sceneCache[name]) {
    const mod = await import(`./scenes/${name}.js`);
    sceneCache[name] = await mod.default(ctx);
  }
  return sceneCache[name];
}

function entryAt(t) {
  for (let i = entries.length - 1; i >= 0; i--) if (t >= entries[i].start) return entries[i];
  return entries[0];
}

async function drawFrame(t, forced = null) {
  t = clamp(t, 0, DURATION - 1e-4);
  const e = forced || entryAt(t);
  const lt = forced ? t : t - e.start, p = lt / e.dur, opts = e.opts || {};
  const S = await getScene(e.scene);

  S.update?.(p, lt, e.dur, opts, t);
  S.camera.aspect = W / H; S.camera.updateProjectionMatrix(); S.camera.updateMatrixWorld(true);
  S.sky?.userData.follow(S.camera);

  renderPass.scene = S.scene; renderPass.camera = S.camera;
  const b = S.bloom || {};
  bloom.strength = b.strength ?? 0.55; bloom.radius = b.radius ?? 0.6; bloom.threshold = b.threshold ?? 0.85;
  renderer.toneMappingExposure = S.exposure ?? 1;
  composer.render();

  g.globalAlpha = 1;
  g.drawImage(renderer.domElement, 0, 0);
  S.hud?.(g, V, p, lt, e.dur, opts, t);

  if (CAPTIONS) {
    const c = cues.find((c) => t >= c.t0 && t <= c.t1);
    if (c) caption(g, V, c.text, sstep(c.t0, c.t0 + 0.15, t) * (1 - sstep(c.t1 - 0.15, c.t1, t)));
  }
  if (config.showWatermark) T(g, V, config.channelName, V.w - 40, 46, { size: 18, align: 'right', alpha: 0.5, weight: 600, track: 3 });

  // scene fades (to/from black)
  const last = e === entries[entries.length - 1], first = e === entries[0];
  const fi = sstep(0, first ? 1.2 : 0.7, lt);
  const fo = 1 - sstep(e.dur - (last ? 1.8 : 0.7), e.dur, lt);
  const dark = 1 - fi * fo;
  if (dark > 0.002) { g.globalAlpha = dark; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
}

window.__info = { duration: DURATION, mode: MODE, width: W, height: H, entries: entries.map(({ id, scene, start, dur }) => ({ id, scene, start, dur })) };
window.renderFrame = async (t) => {
  await drawFrame(t);
  return out.toDataURL(FMT === 'png' ? 'image/png' : 'image/jpeg', JPEG_Q);
};
window.renderDebug = async (scene, p, dur = 10, opts = {}) => { await drawFrame(p * dur, { id: scene, scene, start: 0, dur, opts }); return out.toDataURL('image/jpeg', 0.95); };
window.renderFrameRaw = drawFrame;           // for preview / snapshots
window.__canvas = out;

// ---------------------------------------------------------------- live preview (npm run dev)
if (PREVIEW) {
  document.getElementById('wrap').appendChild(out);
  const ui = document.getElementById('ui'); ui.style.display = 'flex';
  const seek = document.getElementById('seek'), play = document.getElementById('play'), clock = document.getElementById('clock');
  const sel = document.getElementById('modeSel'); sel.value = MODE;
  sel.onchange = () => { const u = new URL(location.href); u.searchParams.set('mode', sel.value); u.searchParams.delete('w'); u.searchParams.delete('h'); location.href = u; };
  let playing = false, cur = +(q.get('t') || 0), last = performance.now(), busy = false;
  const audio = new Audio(`/build/audio/${MODE}/mix.m4a`);
  const tick = async (now) => {
    if (playing) { cur += (now - last) / 1000; if (cur >= DURATION) { cur = 0; audio.currentTime = 0; } }
    last = now;
    if (!busy) { busy = true; await drawFrame(cur); busy = false; seek.value = cur / DURATION; clock.textContent = `${Math.floor(cur / 60)}:${String(Math.floor(cur % 60)).padStart(2, '0')}`; }
    requestAnimationFrame(tick);
  };
  play.onclick = () => { playing = !playing; play.textContent = playing ? '❚❚ Pause' : '▶ Play'; if (playing) { audio.currentTime = cur; audio.play().catch(() => {}); } else audio.pause(); };
  seek.oninput = () => { cur = seek.value * DURATION; audio.currentTime = cur; };
  requestAnimationFrame(tick);
}

window.__ready = true;
