import * as THREE from 'three';
import { easeIO, lerp, seg, sstep, window3 } from '../lib/util.js';
import { makeJovianStage, orbitCam, JUPITER_POS } from '../lib/stage.js';
import { lowerThird, titleCard, T, COL } from '../lib/hud.js';

export default function create(ctx) {
  const st = makeJovianStage(ctx);
  const camera = new THREE.PerspectiveCamera(32, ctx.aspect, 0.01, 6000);
  const tgt = new THREE.Vector3();
  const eu = new THREE.Vector3();

  return {
    scene: st.scene, camera, sky: st.sky, bloom: { strength: 0.5, radius: 0.7, threshold: 0.9 }, exposure: 1.05,
    update(p, lt, dur, opts) {
      const k = easeIO(Math.pow(p, 0.9));
      const dist = Math.exp(lerp(Math.log(ctx.D(150)), Math.log(ctx.D(4.3)), k));
      const w = (1 - k) * 0.34;                         // keep Jupiter in frame while far away
      tgt.copy(JUPITER_POS).multiplyScalar(w);
      orbitCam(camera, tgt.set(tgt.x, tgt.y, tgt.z), dist, lerp(2, 30, k), lerp(3, 9, k));
      camera.lookAt(tgt);
      st.europa.rotation.y = lt * 0.035;
      st.jupiter.rotation.y = lt * 0.01;
    },
    hud(g, V, p, lt, dur, opts) {
      if (opts.short) {
        lowerThird(g, V, { kicker: 'Jupiter\'s moon', head: 'EUROPA', p: seg(p, 0.1, 0.3), alpha: 1 - sstep(0.85, 0.98, p) });
        return;
      }
      lowerThird(g, V, { kicker: 'Jovian system · about 5 AU from the Sun', head: 'Europa, moon of Jupiter', p: seg(p, 0.14, 0.26), alpha: 1 - sstep(0.52, 0.62, p) });
      titleCard(g, V, { kicker: 'JWST discovery', big: 'EUROPA', small: 'Carbon dioxide on an ocean world', p: seg(p, 0.76, 0.985) });
    }
  };
}
