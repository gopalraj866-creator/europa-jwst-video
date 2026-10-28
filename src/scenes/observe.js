import * as THREE from 'three';
import { seg, sstep, lerp, easeIO } from '../lib/util.js';
import { makeJovianStage, orbitCam, screenDisc } from '../lib/stage.js';
import { T, COL, panel, spectrum, lowerThird, line } from '../lib/hud.js';

const off = typeof document !== 'undefined' ? document.createElement('canvas') : null;

export default function create(ctx) {
  const st = makeJovianStage(ctx, { jupiter: false, stars: 3000 });
  st.sun.position.set(0.5, 0.35, 1).multiplyScalar(100);
  const camera = new THREE.PerspectiveCamera(30, ctx.aspect, 0.05, 6000);
  const zero = new THREE.Vector3();
  const N = 10;
  return {
    scene: st.scene, camera, sky: st.sky, bloom: { strength: 0.3, radius: 0.5, threshold: 0.95 }, exposure: 1.1,
    update(p, lt) {
      st.europa.rotation.y = 2.2 + lt * 0.03;
      orbitCam(camera, zero, ctx.D(5.2), 0, 8);
      // shift the framing so Europa sits left (landscape) or top (portrait)
      camera.lookAt(ctx.portrait ? 0 : 1.2, ctx.portrait ? -1.0 : 0, 0);
    },
    hud(g, V, p, lt) {
      const d = screenDisc(camera, zero, 1, V);
      const out = 1 - sstep(0.95, 0.99, p);
      // true pixelation of the already-rendered frame: Europa at ~10x10 detector pixels
      const px = sstep(0.22, 0.34, p);
      if (px > 0.01) {
        const sx = (d.x - d.r) * V.u, sy = (d.y - d.r) * V.u, sw = d.r * 2 * V.u;
        off.width = N; off.height = N;
        const o = off.getContext('2d'); o.imageSmoothingEnabled = true; o.imageSmoothingQuality = 'high';
        o.fillStyle = '#000'; o.fillRect(0, 0, N, N);
        o.drawImage(g.canvas, sx, sy, sw, sw, 0, 0, N, N);
        g.save(); g.globalAlpha = px; g.imageSmoothingEnabled = false;
        g.beginPath(); g.rect(sx, sy, sw, sw); g.clip();
        g.fillStyle = '#000'; g.fillRect(sx, sy, sw, sw);
        g.drawImage(off, sx, sy, sw, sw);
        g.restore();
        // grid
        g.save(); g.globalAlpha = px * 0.55; g.strokeStyle = COL.ice; g.lineWidth = 1.2 * V.u;
        for (let i = 0; i <= N; i++) { const t = (i / N) * sw; g.beginPath(); g.moveTo(sx + t, sy); g.lineTo(sx + t, sy + sw); g.stroke(); g.beginPath(); g.moveTo(sx, sy + t); g.lineTo(sx + sw, sy + t); g.stroke(); }
        g.restore();
        // scanning pixel
        const k = seg(p, 0.40, 0.86), idx = Math.min(N * N - 1, Math.floor(k * N * N));
        const cx = idx % N, cy = Math.floor(idx / N), cs = sw / N;
        g.save(); g.globalAlpha = px; g.strokeStyle = COL.co2; g.lineWidth = 3 * V.u; g.strokeRect(sx + cx * cs, sy + cy * cs, cs, cs); g.restore();
        T(g, V, `PIXEL ${String(idx + 1).padStart(2, '0')} / ${N * N}`, d.x, d.y + d.r + 52, { size: 18, font: 'mono', color: COL.co2, align: 'center', alpha: px * sstep(0.40, 0.46, p) * out, track: 2 });
        T(g, V, '≈ 300 km per pixel', d.x, d.y - d.r - 22, { size: 22, align: 'center', alpha: px * out, font: 'body', weight: 600 });
      }
      // spectrum panel
      const sp = sstep(0.36, 0.46, p) * out;
      const cw = V.portrait ? V.w - 120 : 820, ch = V.portrait ? 500 : 460;
      const cx0 = V.portrait ? 60 : V.w - cw - 90, cy0 = V.portrait ? V.h - ch - 330 : V.h / 2 - ch / 2 - 20;
      if (sp > 0.01) {
        g.save(); g.globalAlpha = sp;
        const k = seg(p, 0.40, 0.86), sub = (k * 100) % 1;
        const hot = sstep(0.80, 0.88, p);                                  // last pixels land on Tara Regio
        spectrum(g, V, cx0, cy0, cw, ch, { p: Math.min(1, 0.15 + sub * 1.3), co2: 0.12 + 0.88 * hot, hi: hot, noise: 1.0, seed: Math.floor(k * 100) + 3 });
        g.restore();
        T(g, V, 'SPECTRUM OF THE SELECTED PIXEL', cx0 + 20, cy0 - 18, { size: 15, color: COL.dim, weight: 600, track: 3, alpha: sp });
      }
      T(g, V, 'NIRSpec · integral field unit', V.w / 2, V.portrait ? 110 : 92, { size: 22, color: COL.ice, weight: 600, align: 'center', track: 4, alpha: sstep(0.04, 0.12, p) * out });
      lowerThird(g, V, { kicker: 'Webb · Near-Infrared Spectrograph', head: 'One spectrum per pixel', p: seg(p, 0.04, 0.14), alpha: (1 - sstep(0.30, 0.38, p)), y: V.portrait ? V.h - 180 : V.h - 150 });
    }
  };
}
