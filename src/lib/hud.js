// 2D HUD helpers. Everything is drawn on a canvas on top of the WebGL frame, sized in "design units"
// (1 unit = V.u pixels; 1080p landscape or 1080-wide portrait = 1 px per unit).
import { clamp, sstep, easeOut } from './util.js';

export const COL = {
  ice: '#7fd8ff', gold: '#ffc15a', co2: '#6dffc2', warn: '#ff8a65', white: '#f4f8ff', dim: 'rgba(210,225,245,0.62)', line: 'rgba(160,210,255,0.55)'
};
export const FONT = {
  head: '"Space Grotesk", "Inter", system-ui, sans-serif',
  body: '"Inter", system-ui, sans-serif',
  mono: 'ui-monospace, "JetBrains Mono", "DejaVu Sans Mono", Menlo, monospace'
};

export function makeView(W, H) {
  const portrait = H > W;
  const u = portrait ? W / 1080 : H / 1080;
  return { W, H, u, portrait, w: W / u, h: H / u };   // w,h = size in design units
}

/** text in design units. o: size, color, weight, align, alpha, track, font, base */
export function T(g, V, str, x, y, o = {}) {
  const { size = 28, color = COL.white, weight = 500, align = 'left', alpha = 1, track = 0, font = 'head', base = 'alphabetic', shadow = true } = o;
  if (alpha <= 0.003) return;
  g.save();
  g.globalAlpha = clamp(alpha);
  g.font = `${weight} ${size * V.u}px ${FONT[font] || font}`;
  g.textAlign = align; g.textBaseline = base;
  try { g.letterSpacing = `${track * V.u}px`; } catch (e) { /* older engines */ }
  if (shadow) { g.shadowColor = 'rgba(0,0,0,0.65)'; g.shadowBlur = 10 * V.u; g.shadowOffsetY = 2 * V.u; }
  g.fillStyle = color;
  g.fillText(str, x * V.u, y * V.u);
  g.restore();
}

export function measure(g, V, str, o = {}) {
  const { size = 28, weight = 500, track = 0, font = 'head' } = o;
  g.save(); g.font = `${weight} ${size * V.u}px ${FONT[font] || font}`;
  try { g.letterSpacing = `${track * V.u}px`; } catch (e) {}
  const w = g.measureText(str).width / V.u; g.restore(); return w;
}

export function wrap(g, V, str, maxW, o = {}) {
  const words = str.split(' '); const lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (measure(g, V, t, o) > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function panel(g, V, x, y, w, h, { alpha = 1, r = 10, fill = 'rgba(6,12,22,0.62)', stroke = 'rgba(150,200,255,0.35)' } = {}) {
  if (alpha <= 0.003) return;
  g.save(); g.globalAlpha = clamp(alpha);
  const X = x * V.u, Y = y * V.u, Wd = w * V.u, Ht = h * V.u, R = r * V.u;
  g.beginPath(); g.roundRect(X, Y, Wd, Ht, R);
  g.fillStyle = fill; g.fill(); g.lineWidth = 1.2 * V.u; g.strokeStyle = stroke; g.stroke();
  g.restore();
}

export function line(g, V, pts, { color = COL.line, width = 1.6, alpha = 1, p = 1 } = {}) {
  if (p <= 0 || alpha <= 0) return;
  // draw polyline up to fraction p of its total length
  let total = 0; const segs = [];
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); total += l; }
  let rem = total * clamp(p);
  g.save(); g.globalAlpha = clamp(alpha); g.strokeStyle = color; g.lineWidth = width * V.u; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(pts[0][0] * V.u, pts[0][1] * V.u);
  for (let i = 1; i < pts.length && rem > 0; i++) {
    const f = Math.min(1, rem / segs[i - 1]);
    g.lineTo((pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f) * V.u, (pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f) * V.u);
    rem -= segs[i - 1];
  }
  g.stroke(); g.restore();
}

export function dot(g, V, x, y, { r = 5, color = COL.white, alpha = 1, ring = true } = {}) {
  g.save(); g.globalAlpha = clamp(alpha);
  g.fillStyle = color; g.beginPath(); g.arc(x * V.u, y * V.u, r * V.u, 0, 7); g.fill();
  if (ring) { g.strokeStyle = color; g.globalAlpha = clamp(alpha) * 0.45; g.lineWidth = 1.4 * V.u; g.beginPath(); g.arc(x * V.u, y * V.u, r * 2.3 * V.u, 0, 7); g.stroke(); }
  g.restore();
}

/**
 * Callout: dot on target (ax,ay) -> leader line -> text block at (tx,ty).
 * All in design units. p = 0..1 appear progress, side = 'l'|'r' text alignment relative to the leader.
 */
export function callout(g, V, { ax, ay, tx, ty, title, sub, p = 1, color = COL.ice, side = 'r', big = null, alpha = 1 }) {
  p = easeOut(clamp(p)); if (p <= 0.001) return;
  const a = alpha * clamp(p * 1.4);
  const elbowX = tx;
  line(g, V, [[ax, ay], [elbowX, ty], [tx + (side === 'r' ? 160 : -160), ty]], { color, width: 1.6, alpha: 0.9 * a, p });
  dot(g, V, ax, ay, { color, alpha: a });
  const ta = clamp((p - 0.35) / 0.65) * alpha;
  const align = side === 'r' ? 'left' : 'right';
  const x0 = tx + (side === 'r' ? 10 : -10);
  if (big) {
    T(g, V, big, x0, ty - 12, { size: 44, color: COL.white, weight: 700, align, alpha: ta });
    T(g, V, title.toUpperCase(), x0, ty + 14, { size: 17, color, weight: 600, align, alpha: ta, track: 2.5 });
    if (sub) T(g, V, sub, x0, ty + 38, { size: 18, color: COL.dim, weight: 400, font: 'body', align, alpha: ta });
  } else {
    T(g, V, title.toUpperCase(), x0, ty - 10, { size: 17, color, weight: 600, align, alpha: ta, track: 2.5 });
    if (sub) T(g, V, sub, x0, ty + 16, { size: 22, color: COL.white, weight: 500, align, alpha: ta });
  }
}

/** small all-caps kicker + big headline, bottom-left (landscape) or upper area (portrait). */
export function lowerThird(g, V, { kicker, head, p = 1, alpha = 1, x = 90, y = null }) {
  const a = easeOut(clamp(p)) * alpha; if (a <= 0.01) return;
  const yy = y ?? (V.portrait ? 230 : V.h - 150);
  const off = (1 - easeOut(clamp(p))) * 22;
  g.save(); g.globalAlpha = a;
  g.fillStyle = COL.ice; g.fillRect(x * V.u, (yy - 52 + off) * V.u, 4 * V.u, 78 * V.u);
  g.restore();
  T(g, V, kicker.toUpperCase(), x + 20, yy - 30 + off, { size: 17, color: COL.ice, weight: 600, track: 3.5, alpha: a });
  T(g, V, head, x + 20, yy + 16 + off, { size: V.portrait ? 44 : 50, weight: 700, alpha: a });
}

export function titleCard(g, V, { kicker, big, small, p, color = COL.white }) {
  // p: 0..1 over the whole card lifetime (fade in 0-.2, hold, out .8-1)
  const a = sstep(0, 0.22, p) * (1 - sstep(0.8, 1, p));
  if (a <= 0.003) return;
  const cx = V.w / 2, cy = V.h / 2 + (V.portrait ? -120 : 0);
  const trk = 24 - 16 * easeOut(clamp(p / 0.5));
  if (kicker) T(g, V, kicker.toUpperCase(), cx, cy - 92, { size: 20, color: COL.ice, weight: 600, align: 'center', track: 6, alpha: a });
  T(g, V, big, cx, cy + 10, { size: V.portrait ? 96 : 150, weight: 700, align: 'center', alpha: a, track: trk, color });
  if (small) T(g, V, small, cx, cy + 74, { size: V.portrait ? 30 : 34, weight: 400, align: 'center', alpha: a * 0.9, font: 'body', color: COL.dim });
}

/** burned-in captions */
export function caption(g, V, text, alpha = 1) {
  if (!text || alpha <= 0.01) return;
  const size = V.portrait ? 40 : 34;
  const maxW = V.portrait ? V.w * 0.86 : V.w * 0.7;
  const lines = wrap(g, V, text, maxW, { size, weight: 600, font: 'body' });
  const lh = size * 1.32, boxH = lines.length * lh + 22;
  const y0 = V.portrait ? V.h * 0.80 - boxH : V.h - 70 - boxH;
  let wmax = 0; for (const l of lines) wmax = Math.max(wmax, measure(g, V, l, { size, weight: 600, font: 'body' }));
  panel(g, V, V.w / 2 - wmax / 2 - 22, y0, wmax + 44, boxH, { alpha, fill: 'rgba(0,0,0,0.55)', stroke: 'rgba(0,0,0,0)', r: 12 });
  lines.forEach((l, i) => T(g, V, l, V.w / 2, y0 + 12 + size * 0.95 + i * lh, { size, weight: 600, font: 'body', align: 'center', alpha, shadow: false }));
}

// ------------------------------------------------------------------------------------ spectrum chart
const gauss = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) ** 2);
/** Illustrative near-IR reflectance of icy Europa 2.4-5.2 um. co2: 0..1 strength of the CO2 features. */
export function spectrumAt(w, co2 = 1, ice = 1) {
  let r = 0.62 - 0.05 * (w - 2.4);
  r *= 1 - ice * (0.92 * gauss(w, 3.05, 0.22) + 0.4 * gauss(w, 3.0, 0.55));
  r *= 1 + 0.25 * sstep(3.5, 4.0, w) * (1 - sstep(4.1, 4.6, w));
  r *= 1 - sstep(4.45, 5.1, w) * 0.55;
  r *= 1 - co2 * (0.55 * gauss(w, 4.268, 0.035) + 0.30 * gauss(w, 4.25, 0.06) + 0.18 * gauss(w, 2.70, 0.025) + 0.16 * gauss(w, 4.38, 0.02));
  return Math.max(0.01, r);
}

export function spectrum(g, V, x, y, w, h, { p = 1, co2 = 1, hi = 0, color = COL.ice, noise = 0, seed = 1, label = true } = {}) {
  panel(g, V, x, y, w, h, { alpha: 1 });
  const px = x + 54, py = y + 36, pw = w - 80, ph = h - 96;
  const X = (wl) => px + ((wl - 2.4) / (5.2 - 2.4)) * pw;
  const Y = (v) => py + ph - v * ph * 1.35;
  // grid + axis
  g.save(); g.strokeStyle = 'rgba(160,200,255,0.18)'; g.lineWidth = 1 * V.u;
  for (let wl = 2.5; wl <= 5.0; wl += 0.5) { g.beginPath(); g.moveTo(X(wl) * V.u, py * V.u); g.lineTo(X(wl) * V.u, (py + ph) * V.u); g.stroke(); }
  g.strokeStyle = 'rgba(190,225,255,0.55)'; g.beginPath(); g.moveTo(px * V.u, (py + ph) * V.u); g.lineTo((px + pw) * V.u, (py + ph) * V.u); g.stroke();
  g.restore();
  for (let wl = 2.5; wl <= 5.0; wl += 0.5) T(g, V, wl.toFixed(1), X(wl), py + ph + 24, { size: 15, align: 'center', color: COL.dim, font: 'mono', shadow: false });
  T(g, V, 'WAVELENGTH (µm)', px + pw / 2, py + ph + 48, { size: 13, align: 'center', color: COL.dim, weight: 600, track: 2.5, shadow: false });
  T(g, V, 'REFLECTANCE', x + 16, y + 24, { size: 13, color: COL.dim, weight: 600, track: 2.5, shadow: false });
  // highlight band at 4.27
  if (hi > 0.01) {
    g.save(); const gx = X(4.27) * V.u, bw = 0.09 / 2.8 * pw * V.u;
    const gr = g.createLinearGradient(0, py * V.u, 0, (py + ph) * V.u);
    gr.addColorStop(0, `rgba(109,255,194,${0.28 * hi})`); gr.addColorStop(1, `rgba(109,255,194,${0.02 * hi})`);
    g.fillStyle = gr; g.fillRect(gx - bw, py * V.u, bw * 2, ph * V.u); g.restore();
    T(g, V, 'CO₂  4.27 µm', X(4.27), py - 8 + (1 - hi) * 8, { size: 19, color: COL.co2, weight: 700, align: 'center', alpha: hi });
  }
  // curve
  const N = 360; const pts = [];
  let s = seed * 9301;
  for (let i = 0; i <= N; i++) {
    const wl = 2.4 + (i / N) * 2.8;
    s = (s * 16807) % 2147483647; const n = (s / 2147483647 - 0.5) * noise;
    pts.push([X(wl), Y(spectrumAt(wl, co2) + n * 0.03)]);
  }
  const last = Math.max(1, Math.floor(N * clamp(p)));
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
  for (const [lw, al] of [[8, 0.10], [4, 0.2], [2.2, 1]]) {
    g.beginPath(); g.lineWidth = lw * V.u; g.strokeStyle = color; g.globalAlpha = al;
    for (let i = 0; i <= last; i++) { const q = pts[i]; if (i === 0) g.moveTo(q[0] * V.u, q[1] * V.u); else g.lineTo(q[0] * V.u, q[1] * V.u); }
    g.stroke();
  }
  g.restore();
  if (p < 1) dot(g, V, pts[last][0], pts[last][1], { r: 4, color: COL.white, ring: false });
  if (label) T(g, V, 'ILLUSTRATIVE SPECTRUM', x + w - 16, y + 24, { size: 12, color: COL.dim, weight: 600, align: 'right', track: 2, shadow: false });
}

export function disclaimer(g, V, text, alpha = 0.55) {
  T(g, V, text, V.w / 2, V.h - (V.portrait ? 40 : 22), { size: 13, color: COL.dim, align: 'center', alpha, font: 'body', shadow: false });
}
