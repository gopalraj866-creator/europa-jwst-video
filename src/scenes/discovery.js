import * as THREE from 'three';
import { seg, sstep, lerp, easeIO, easeOut, REGIONS, dirAzLat } from '../lib/util.js';
import { makeJovianStage, orbitCam, screenDisc } from '../lib/stage.js';
import { T, COL, panel, spectrum, lowerThird, callout, line } from '../lib/hud.js';

export default function create(ctx) {
  const st = makeJovianStage(ctx, { co2: true, jupiter: false, stars: 3500 });
  st.sun.position.set(0.45, 0.3, 1).multiplyScalar(100);
  const camera = new THREE.PerspectiveCamera(30, ctx.aspect, 0.02, 6000);
  const zero = new THREE.Vector3();
  const tv = dirAzLat(REGIONS.tara.az, REGIONS.tara.lat), pv = dirAzLat(REGIONS.powys.az, REGIONS.powys.lat);
  const faceYaw = (v) => -Math.atan2(v.x, v.z);
  const ov = st.overlay.material.uniforms;

  return {
    scene: st.scene, camera, sky: st.sky, bloom: { strength: 0.35, radius: 0.6, threshold: 0.95 }, exposure: 1.1,
    update(p, lt, dur, opts) {
      // spin Europa so Tara Regio faces us, later swing round to Powys Regio
      const yaw = lerp(faceYaw(tv) - 1.2, faceYaw(tv), easeOut(seg(p, 0, 0.30)));
      const toPowys = lerp(0, faceYaw(pv) - faceYaw(tv), easeIO(seg(p, 0.62, 0.74)));
      st.europa.rotation.y = yaw + toPowys;
      const zoom = easeIO(seg(p, 0.28, 0.58)) - 0.45 * easeIO(seg(p, 0.60, 0.74)) + 0.45 * easeIO(seg(p, 0.60, 0.74)) * 0;
      const dist = ctx.D(lerp(5.2, 3.7, zoom));
      orbitCam(camera, zero, dist, 0, lerp(2, -6, p));
      camera.lookAt(ctx.portrait ? 0 : 0.9, ctx.portrait ? -0.8 : 0, 0);
      ov.uTime.value = lt;
      ov.uAmount.value = easeOut(seg(p, 0.26, 0.42));
      ov.uPixel.value = 1 - 0.6 * sstep(0.50, 0.62, p);
      ov.uGrid.value = 1 - sstep(0.52, 0.62, p);
      ov.uScan.value = p > 0.24 && p < 0.42 ? seg(p, 0.24, 0.42) : -1;
    },
    hud(g, V, p, lt, dur, opts) {
      const out = 1 - sstep(0.96, 0.995, p);
      const d = screenDisc(camera, zero, 1, V);
      const cw = V.portrait ? V.w - 120 : 760, ch = V.portrait ? 440 : 400;
      const cx0 = V.portrait ? 60 : V.w - cw - 80, cy0 = V.portrait ? V.h - ch - 190 : 150;
      const sp = sstep(0.04, 0.14, p) * (1 - sstep(0.60, 0.68, p)) * out;
      if (sp > 0.01) {
        g.save(); g.globalAlpha = sp;
        spectrum(g, V, cx0, cy0, cw, ch, { p: seg(p, 0.05, 0.20), co2: 1, hi: sstep(0.16, 0.24, p), noise: 0.6, seed: 5 });
        g.restore();
        T(g, V, 'CARBON DIOXIDE ICE · 4.27 µm', cx0 + 20, cy0 - 18, { size: 15, color: COL.co2, weight: 700, track: 3, alpha: sp });
      }
      T(g, V, 'SEPTEMBER 2023', V.w / 2, V.portrait ? 120 : 100, { size: 22, color: COL.ice, weight: 600, align: 'center', track: 6, alpha: sstep(0.0, 0.06, p) * (1 - sstep(0.16, 0.22, p)) });
      // Tara Regio call-out
      const ax = d.x - d.r * 0.2, ay = d.y + d.r * 0.08;
      if (!opts.short) {
        callout(g, V, { ax, ay, tx: V.portrait ? 70 : V.w - 780, ty: V.portrait ? 240 : 640, big: '≈ 1,800 km', title: 'Tara Regio', sub: 'CO₂ concentrated here', p: seg(p, 0.40, 0.50), color: COL.co2, side: 'r', alpha: (1 - sstep(0.60, 0.66, p)) * out });
        callout(g, V, { ax: d.x - d.r * 0.1, ay: d.y + d.r * 0.2, tx: V.portrait ? 70 : V.w - 780, ty: V.portrait ? 360 : 790, title: 'Chaos terrain', sub: 'shattered, re-frozen ice rafts', p: seg(p, 0.52, 0.60), color: '#ffcf8a', side: 'r', alpha: (1 - sstep(0.68, 0.74, p)) * out });
        callout(g, V, { ax: d.x, ay: d.y, tx: V.portrait ? 70 : V.w - 780, ty: V.portrait ? 250 : 640, title: 'Powys Regio', sub: 'weaker CO₂ signal', p: seg(p, 0.72, 0.80), color: COL.co2, side: 'r', alpha: out * (1 - sstep(0.80, 0.84, p)) });
      } else {
        callout(g, V, { ax, ay, tx: 70, ty: 250, big: 'Tara Regio', title: 'CO₂ concentrated here', p: seg(p, 0.35, 0.5), color: COL.co2, side: 'r', alpha: out });
      }
      // paper cards
      if (!opts.short) {
        const items = [['Villanueva et al.', 'NASA Goddard · Science'], ['Trumbo & Brown', 'Cornell / Caltech · Science']];
        items.forEach((it, i) => {
          const a = sstep(0.80 + i * 0.05, 0.86 + i * 0.05, p) * out; if (a < 0.01) return;
          const x = V.portrait ? 70 : V.w - 620, y = (V.portrait ? V.h - 330 : V.h - 250) + i * 92;
          panel(g, V, x, y, 520, 76, { alpha: a, stroke: 'rgba(109,255,194,0.4)' });
          T(g, V, it[0], x + 22, y + 34, { size: 28, weight: 700, alpha: a });
          T(g, V, it[1], x + 22, y + 60, { size: 18, color: COL.dim, font: 'body', alpha: a });
        });
        T(g, V, '21 SEPTEMBER 2023', V.portrait ? 70 : V.w - 620, (V.portrait ? V.h - 360 : V.h - 280), { size: 15, color: COL.ice, weight: 600, track: 4, alpha: sstep(0.80, 0.86, p) * out });
      } else {
        T(g, V, 'Published in Science · 2023', V.w / 2, V.h - 330, { size: 28, weight: 600, align: 'center', font: 'body', alpha: sstep(0.78, 0.86, p) * out });
      }
      // legend
      const la = sstep(0.30, 0.38, p) * out;
      const lx = V.portrait ? 70 : 90, ly = V.portrait ? V.h - 150 : V.h - 90;
      const gr = g.createLinearGradient(lx * V.u, 0, (lx + 220) * V.u, 0); gr.addColorStop(0, 'rgba(8,190,160,0.15)'); gr.addColorStop(1, 'rgba(210,255,225,1)');
      g.save(); g.globalAlpha = la; g.fillStyle = gr; g.fillRect(lx * V.u, ly * V.u, 220 * V.u, 14 * V.u); g.restore();
      T(g, V, 'CO₂ ICE  low → high  (illustrative)', lx, ly - 12, { size: 14, color: COL.dim, weight: 600, track: 2, alpha: la, shadow: false });
    }
  };
}
