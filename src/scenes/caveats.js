import * as THREE from 'three';
import { lerp, seg, sstep } from '../lib/util.js';
import { makeJovianStage, orbitCam } from '../lib/stage.js';
import { T, COL, panel, lowerThird } from '../lib/hud.js';

export default function create(ctx) {
  const st = makeJovianStage(ctx, { co2: true });
  st.overlay.material.uniforms.uAmount.value = 1; st.overlay.material.uniforms.uPixel.value = 0.25; st.overlay.material.uniforms.uGrid.value = 0;
  const camera = new THREE.PerspectiveCamera(30, ctx.aspect, 0.01, 6000);
  const zero = new THREE.Vector3();
  return {
    scene: st.scene, camera, sky: st.sky, bloom: { strength: 0.4, radius: 0.6, threshold: 0.9 }, exposure: 1.05,
    update(p, lt) {
      st.europa.rotation.y = lt * 0.05; st.jupiter.rotation.y = lt * 0.01; st.overlay.material.uniforms.uTime.value = lt;
      orbitCam(camera, zero, ctx.D(5.6), lerp(15, 60, p), 8);
      camera.lookAt(ctx.portrait ? 0 : 1.5, ctx.portrait ? -1.2 : 0, 0);
    },
    hud(g, V, p) {
      const out = 1 - sstep(0.95, 0.99, p);
      const x = V.portrait ? 60 : V.w - 800, w = V.portrait ? V.w - 120 : 720, y0 = V.portrait ? V.h * 0.58 : 280;
      const rows = [
        { h: 'No plumes detected', s: 'but that does not rule them out', c: COL.gold, p0: 0.10 },
        { h: 'CO₂ ≠ biology', s: 'carbon dioxide alone says nothing about life', c: COL.warn, p0: 0.38 },
        { h: 'More CO₂ than expected', s: '2026 analysis: beyond Tara Regio', c: COL.co2, p0: 0.66 }
      ];
      rows.forEach((r, i) => {
        const a = sstep(r.p0, r.p0 + 0.08, p) * out, y = y0 + i * 124;
        panel(g, V, x, y, w, 100, { alpha: a, stroke: r.c + '99' });
        g.save(); g.globalAlpha = a; g.fillStyle = r.c; g.fillRect((x) * V.u, (y + 14) * V.u, 5 * V.u, 72 * V.u); g.restore();
        T(g, V, r.h, x + 28, y + 44, { size: 32, weight: 700, alpha: a });
        T(g, V, r.s, x + 28, y + 77, { size: 21, color: COL.dim, font: 'body', alpha: a });
      });
      lowerThird(g, V, { kicker: 'Reality check', head: 'What we do not know yet', p: seg(p, 0.02, 0.1), alpha: 1 - sstep(0.16, 0.22, p), y: V.portrait ? 230 : V.h - 150 });
    }
  };
}
