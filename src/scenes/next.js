import * as THREE from 'three';
import { lerp, seg, sstep, easeIO } from '../lib/util.js';
import { makeJovianStage, orbitCam } from '../lib/stage.js';
import { makeClipper } from '../lib/models.js';
import { T, COL, panel, line, dot, lowerThird } from '../lib/hud.js';

export default function create(ctx) {
  const st = makeJovianStage(ctx, { co2: true });
  st.scene.environment = ctx.assets.env; st.scene.environmentIntensity = 0.5;
  const u = st.overlay.material.uniforms; u.uAmount.value = 1; u.uPixel.value = 0.2; u.uGrid.value = 0;
  const clipper = makeClipper(); clipper.scale.setScalar(0.12); st.scene.add(clipper);
  const camera = new THREE.PerspectiveCamera(30, ctx.aspect, 0.005, 6000);
  const zero = new THREE.Vector3();
  const trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 2 }, () => new THREE.Vector3())), new THREE.LineBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.6 }));
  st.scene.add(trail);
  return {
    scene: st.scene, camera, sky: st.sky, bloom: { strength: 0.35, radius: 0.5, threshold: 0.95 }, exposure: 1.05,
    update(p, lt, dur, opts) {
      st.europa.rotation.y = 4.2 + lt * 0.03; u.uTime.value = lt;
      orbitCam(camera, zero, ctx.D(7.8), 20, 10);
      camera.lookAt(ctx.portrait ? 0 : -0.8, ctx.portrait ? -0.6 : 0, 0);
      // flyby arc, right -> left, passing close to the limb
      const k = easeIO(seg(p, 0.12, 0.85));
      const x = lerp(3.6, -2.6, k), y = lerp(1.6, -0.4, k) + 0.25 * Math.sin(k * Math.PI), z = lerp(0.5, 2.6, k);
      clipper.position.set(x, y, z); clipper.rotation.set(0.2, Math.PI * 0.5 + 0.35, 0.1);
      const pts = []; for (let i = 0; i <= 40; i++) { const kk = easeIO(seg(p, 0.12, 0.85)) * (i / 40); pts.push(new THREE.Vector3(lerp(3.6, -2.6, kk), lerp(1.6, -0.4, kk) + 0.25 * Math.sin(kk * Math.PI), lerp(0.5, 2.6, kk))); }
      trail.geometry.setFromPoints(pts);
    },
    hud(g, V, p, lt, dur, opts) {
      const out = 1 - sstep(0.96, 0.995, p);
      if (opts.short) {
        T(g, V, 'EUROPA CLIPPER', V.w / 2, V.h * 0.2, { size: 54, weight: 700, align: 'center', track: 4, alpha: sstep(0.05, 0.2, p) * out });
        T(g, V, 'ARRIVES AT JUPITER · APRIL 2030', V.w / 2, V.h * 0.2 + 48, { size: 24, color: COL.ice, weight: 600, align: 'center', track: 3, alpha: sstep(0.15, 0.3, p) * out });
        const b = sstep(0.55, 0.7, p) * out;
        panel(g, V, V.w / 2 - 260, V.h - 360, 520, 110, { alpha: b, stroke: 'rgba(109,255,194,0.7)' });
        T(g, V, 'FOLLOW FOR MORE', V.w / 2, V.h - 292, { size: 40, weight: 700, align: 'center', alpha: b, track: 3, color: COL.co2 });
        return;
      }
      const ev = [
        ['OCT 2024', 'Clipper launches', 0.18], ['MAR 2025', 'Mars flyby', 0.30], ['DEC 2026', 'Earth flyby', 0.44], ['APR 2030', 'Jupiter arrival', 0.58], ['2030 →', '≈ 49 Europa flybys', 0.70], ['JUL 2032', 'Juice: 2 Europa flybys', 0.84]
      ];
      const x0 = 110, x1 = V.w - 110, y = V.portrait ? V.h - 330 : V.h - 190;
      line(g, V, [[x0, y], [x1, y]], { color: COL.line, width: 2, alpha: out, p: seg(p, 0.08, 0.30) });
      ev.forEach((e, i) => {
        const a = sstep(e[2], e[2] + 0.06, p) * out, x = lerp(x0 + 30, x1 - 30, i / (ev.length - 1));
        dot(g, V, x, y, { r: 7, color: i === 5 ? '#c9a8ff' : COL.ice, alpha: a });
        const up = V.portrait && i % 2 === 1;
        const ty = up ? y - 80 : y + 56;
        T(g, V, e[0], x, ty, { size: V.portrait ? 18 : 20, color: i === 5 ? '#c9a8ff' : COL.ice, weight: 700, align: 'center', track: 2, alpha: a });
        T(g, V, e[1], x, ty + 28, { size: V.portrait ? 18 : 22, align: 'center', alpha: a, font: 'body', weight: 600 });
      });
      lowerThird(g, V, { kicker: 'NASA · ESA', head: 'Europa Clipper and Juice', p: seg(p, 0.02, 0.12), alpha: 1 - sstep(0.20, 0.28, p), y: V.portrait ? 230 : 150 });
    }
  };
}
