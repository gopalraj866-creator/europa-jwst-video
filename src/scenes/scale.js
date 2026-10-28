import * as THREE from 'three';
import { seg, sstep, lerp } from '../lib/util.js';
import { makeSky, makeAtmosphere } from '../lib/assets.js';
import { makeEuropa, SUN_DIR, screenDisc } from '../lib/stage.js';
import { T, COL, line } from '../lib/hud.js';

export default function create(ctx) {
  const { assets } = ctx;
  const scene = new THREE.Scene();
  const sky = makeSky(assets, { u: ctx.u, stars: 4000, seed: 11 });
  scene.add(sky);
  const sun = new THREE.DirectionalLight(0xfff4e6, 3.2); sun.position.set(-1, 0.4, 1.2).multiplyScalar(50); scene.add(sun);
  scene.add(new THREE.AmbientLight(0x2a3550, 0.2));

  const rE = 4.08, rM = 1.113, rEu = 1.0;
  const earth = new THREE.Mesh(new THREE.SphereGeometry(rE, 96, 48), new THREE.MeshStandardMaterial({ map: assets.earth, roughness: 0.8 }));
  const atm = makeAtmosphere(rE * 1.03, [0.35, 0.6, 1.0], 2.2, 1.1);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(rM, 64, 32), new THREE.MeshStandardMaterial({ map: assets.moon, roughness: 1 }));
  const europa = makeEuropa(assets, { segs: 96 });
  const portrait = ctx.portrait;
  const pos = portrait ? [[0, 7.4, 0], [0, -0.6, 0], [0, -5.2, 0]] : [[-6.4, 0, 0], [0.9, 0, 0], [4.6, 0, 0]];
  earth.position.set(...pos[0]); atm.position.copy(earth.position); moon.position.set(...pos[1]); europa.position.set(...pos[2]);
  scene.add(earth, atm, moon, europa);

  const camera = new THREE.PerspectiveCamera(30, ctx.aspect, 0.1, 500);
  const cam0 = new THREE.Vector3(0, 0, 1);
  return {
    scene, camera, sky, bloom: { strength: 0.3, radius: 0.6, threshold: 0.95 }, exposure: 1.1,
    update(p, lt) {
      const z = portrait ? 40 : 27;
      camera.position.set(lerp(-0.6, 0.6, p), portrait ? 1.0 : 0.4, z); camera.lookAt(0, portrait ? 1.2 : 0, 0);
      earth.rotation.y = lt * 0.12; moon.rotation.y = lt * 0.03; europa.rotation.y = lt * 0.05;
    },
    hud(g, V, p) {
      const rows = [
        { m: earth, r: rE, n: 'EARTH', d: '12,742 km', c: COL.ice, p0: 0.05 },
        { m: moon, r: rM, n: 'MOON', d: '3,474 km', c: COL.dim, p0: 0.30 },
        { m: europa, r: rEu, n: 'EUROPA', d: '3,122 km', c: COL.co2, p0: 0.50 }
      ];
      rows.forEach((o) => {
        const d = screenDisc(camera, o.m.position, o.r, V);
        const a = seg(p, o.p0, o.p0 + 0.12) * (1 - sstep(0.94, 0.99, p));
        const y = d.y + d.r + (V.portrait ? 60 : 70);
        T(g, V, o.n, d.x, y, { size: 18, color: o.c, weight: 700, align: 'center', track: 4, alpha: a });
        T(g, V, o.d, d.x, y + 38, { size: 34, weight: 700, align: 'center', alpha: a });
      });
      const a2 = seg(p, 0.62, 0.78) * (1 - sstep(0.94, 0.99, p));
      T(g, V, 'Europa ≈ 90% of the Moon’s diameter  ·  ≈ ¼ of Earth’s', V.w / 2, V.portrait ? V.h - 130 : 110, { size: V.portrait ? 30 : 30, align: 'center', alpha: a2, font: 'body', weight: 600 });
    }
  };
}
