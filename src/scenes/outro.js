import * as THREE from 'three';
import { lerp, seg, sstep } from '../lib/util.js';
import { makeJovianStage, orbitCam } from '../lib/stage.js';
import { T, COL, panel, disclaimer } from '../lib/hud.js';

export default function create(ctx) {
  const st = makeJovianStage(ctx, { co2: true });
  const u = st.overlay.material.uniforms; u.uAmount.value = 1; u.uPixel.value = 0.0; u.uGrid.value = 0;
  const camera = new THREE.PerspectiveCamera(30, ctx.aspect, 0.01, 6000);
  const zero = new THREE.Vector3();
  return {
    scene: st.scene, camera, sky: st.sky, bloom: { strength: 0.5, radius: 0.7, threshold: 0.88 }, exposure: 1.05,
    update(p, lt) {
      st.europa.rotation.y = 4.0 + lt * 0.045; u.uTime.value = lt; st.jupiter.rotation.y = lt * 0.01;
      orbitCam(camera, zero, ctx.D(lerp(5.4, 6.2, p)), lerp(25, 50, p), 8);
      camera.lookAt(ctx.portrait ? 0 : -1.9, ctx.portrait ? -1.5 : 0, 0);
    },
    hud(g, V, p, lt) {
      const out = 1 - sstep(0.93, 0.995, p);
      const x = V.portrait ? V.w / 2 : 110, al = V.portrait ? 'center' : 'left';
      T(g, V, 'NOT LIFE. A MAP.', x, V.portrait ? 230 : 300, { size: V.portrait ? 62 : 84, weight: 700, align: al, alpha: sstep(0.04, 0.16, p) * out });
      T(g, V, 'Webb showed where Europa’s ocean may reach the surface.', x, V.portrait ? 290 : 360, { size: V.portrait ? 26 : 30, color: COL.dim, align: al, font: 'body', alpha: sstep(0.14, 0.26, p) * out, weight: 600 });
      const b = sstep(0.46, 0.58, p) * out;
      const by = V.portrait ? V.h - 560 : 470;
      panel(g, V, V.portrait ? 60 : 110, by, V.portrait ? V.w - 120 : 760, 120, { alpha: b, stroke: 'rgba(109,255,194,0.6)' });
      T(g, V, 'Would you be surprised if there is life under that ice?', V.portrait ? V.w / 2 : 140, by + 50, { size: V.portrait ? 27 : 31, weight: 700, align: V.portrait ? 'center' : 'left', alpha: b });
      T(g, V, 'Tell me in the comments  ·  Subscribe for more', V.portrait ? V.w / 2 : 140, by + 90, { size: 22, color: COL.co2, align: V.portrait ? 'center' : 'left', alpha: b, font: 'body', weight: 600 });
      const c = sstep(0.62, 0.74, p) * out;
      const src = ['NASA / ESA / CSA James Webb Space Telescope', 'Villanueva et al. 2023, Science 381, 1305', 'Trumbo & Brown 2023, Science 381, 1308', 'Trumbo et al. 2019, Science Advances 5, eaaw7123', 'NASA JPL Europa Clipper · ESA Juice'];
      T(g, V, 'SOURCES', V.portrait ? 70 : 110, V.portrait ? V.h - 360 : 680, { size: 14, color: COL.ice, weight: 700, track: 4, alpha: c });
      src.forEach((s, i) => T(g, V, s, V.portrait ? 70 : 110, (V.portrait ? V.h - 328 : 712) + i * 28, { size: 20, color: COL.dim, font: 'body', alpha: c }));
      T(g, V, ctx.config.channelName, V.w - (V.portrait ? V.w / 2 : 110), V.portrait ? V.h - 110 : V.h - 80, { size: 30, weight: 700, align: V.portrait ? 'center' : 'right', track: 6, alpha: sstep(0.5, 0.6, p) * out });
      disclaimer(g, V, ctx.config.disclaimer, 0.7 * out);
    }
  };
}
