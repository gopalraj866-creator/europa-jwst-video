import * as THREE from 'three';
import { lerp, seg, sstep, easeIO } from '../lib/util.js';
import { makeJovianStage, orbitCam, screenDisc, slots } from '../lib/stage.js';
import { callout, line, T, COL, lowerThird } from '../lib/hud.js';

export default function create(ctx) {
  const st = makeJovianStage(ctx);
  const camera = new THREE.PerspectiveCamera(30, ctx.aspect, 0.01, 6000);
  const zero = new THREE.Vector3();

  return {
    scene: st.scene, camera, sky: st.sky, bloom: { strength: 0.45, radius: 0.7, threshold: 0.9 }, exposure: 1.05,
    update(p, lt) {
      orbitCam(camera, zero, ctx.D(lerp(5.8, 4.9, easeIO(p))), lerp(35, 125, p), lerp(9, 16, p));
      st.europa.rotation.y = lt * 0.04;
      st.jupiter.rotation.y = lt * 0.01;
    },
    hud(g, V, p) {
      const d = screenDisc(camera, zero, 1, V);
      const S = slots(V, d);
      // diameter bracket
      const a = seg(p, 0.05, 0.16) * (1 - sstep(0.30, 0.34, p));
      if (a > 0.01) {
        const y = d.y + d.r + 34;
        line(g, V, [[d.x - d.r, y], [d.x + d.r, y]], { color: COL.ice, width: 1.8, alpha: a, p: a });
        line(g, V, [[d.x - d.r, y - 10], [d.x - d.r, y + 10]], { color: COL.ice, width: 1.8, alpha: a });
        line(g, V, [[d.x + d.r, y - 10], [d.x + d.r, y + 10]], { color: COL.ice, width: 1.8, alpha: a });
        T(g, V, '3,122 km', d.x, y + 42, { size: 34, weight: 700, align: 'center', alpha: a });
        T(g, V, 'DIAMETER', d.x, y + 66, { size: 15, color: COL.ice, weight: 600, align: 'center', track: 3, alpha: a });
      }
      const anchor = (deg, k) => [d.x + d.r * k * Math.cos((deg * Math.PI) / 180), d.y - d.r * k * Math.sin((deg * Math.PI) / 180)];
      const items = [
        { t: 'Surface', s: 'Water ice, cracked and ridged', deg: 40, k: 0.55, p0: 0.30, c: COL.ice },
        { t: 'Temperature', s: '−220 °C to −130 °C', deg: 170, k: 0.5, p0: 0.46, c: COL.ice },
        { t: 'Radiation', s: 'Lethal dose within hours', deg: -35, k: 0.6, p0: 0.62, c: COL.warn }
      ];
      items.forEach((it, i) => {
        const [ax, ay] = anchor(it.deg, it.k); const s = S[i];
        callout(g, V, { ax, ay, tx: s.tx, ty: s.ty, title: it.t, sub: it.s, p: seg(p, it.p0, it.p0 + 0.09), color: it.c, side: s.side, alpha: 1 - sstep(0.94, 0.99, p) });
      });
      lowerThird(g, V, { kicker: 'Europa', head: 'Ice-covered ocean world', p: seg(p, 0.02, 0.10), alpha: 1 - sstep(0.22, 0.28, p) });
    }
  };
}
