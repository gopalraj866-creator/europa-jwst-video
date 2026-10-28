import * as THREE from 'three';
import { TAU, lerp, seg, sstep } from '../lib/util.js';
import { makeSky } from '../lib/assets.js';
import { makeEuropa } from '../lib/stage.js';
import { T, COL, lowerThird, panel } from '../lib/hud.js';
import { screenDisc } from '../lib/stage.js';

export default function create(ctx) {
  const { assets } = ctx;
  const scene = new THREE.Scene();
  const sky = makeSky(assets, { u: ctx.u, stars: 4000, seed: 9 }); scene.add(sky);
  const sun = new THREE.DirectionalLight(0xfff4e6, 3.0); sun.position.set(-1, 0.6, 0.5).multiplyScalar(40); scene.add(sun);
  scene.add(new THREE.AmbientLight(0x3a4a70, 0.3));
  const jup = new THREE.Mesh(new THREE.SphereGeometry(0.62, 64, 32), new THREE.MeshStandardMaterial({ map: assets.jupiter, roughness: 1 }));
  scene.add(jup);
  const orbits = [{ n: 'IO', r: 3.0, per: 1.769, s: 0.17, col: 0xe8c64a }, { n: 'EUROPA', r: 4.77, per: 3.551, s: 0.22, col: 0xcfe8ff }, { n: 'GANYMEDE', r: 7.61, per: 7.155, s: 0.30, col: 0x9a9388 }];
  const moons = orbits.map((o, i) => {
    let m;
    if (i === 1) m = makeEuropa(assets, { segs: 64 });
    else m = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.MeshStandardMaterial({ color: o.col, roughness: 0.9, emissive: new THREE.Color(o.col).multiplyScalar(0.08) }));
    m.scale.setScalar(o.s); scene.add(m);
    const pts = []; for (let k = 0; k <= 256; k++) pts.push(new THREE.Vector3(Math.cos((k / 256) * TAU) * o.r, 0, Math.sin((k / 256) * TAU) * o.r));
    scene.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x6aa8ff, transparent: true, opacity: 0.35 })));
    return m;
  });
  const eu = moons[1];
  const camera = new THREE.PerspectiveCamera(32, ctx.aspect, 0.1, 200);
  const DAYS_PER_S = 0.8;
  const angle = (o, lt) => (lt * DAYS_PER_S / o.per) * TAU;

  return {
    scene, camera, sky, bloom: { strength: 0.5, radius: 0.5, threshold: 0.9 }, exposure: 1.1,
    update(p, lt) {
      orbits.forEach((o, i) => { const a = angle(o, lt); moons[i].position.set(Math.cos(a) * o.r, 0, Math.sin(a) * o.r); if (i !== 1) moons[i].rotation.y = lt * 0.2; });
      // tidal flex of Europa (exaggerated): stretched along the line to Jupiter, strongest when closest
      const toJ = eu.position.clone().negate().normalize();
      eu.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), toJ);
      const flex = 0.5 + 0.5 * Math.sin(lt * 1.6);
      eu.scale.set(0.22 * (1 + 0.28 * flex), 0.22 * (1 - 0.10 * flex), 0.22 * (1 - 0.10 * flex));
      eu.material.emissive.set(0xff6a1a); eu.material.emissiveIntensity = sstep(0.35, 0.6, p) * 0.9 * flex * flex;
      const k = sstep(0, 1, p), d = ctx.D(lerp(21, 15, k));
      const az = lerp(-30, 25, p) * Math.PI / 180, el = lerp(58, 40, p) * Math.PI / 180;
      camera.position.set(d * Math.cos(el) * Math.sin(az), d * Math.sin(el), d * Math.cos(el) * Math.cos(az));
      camera.lookAt(0, 0, 0);
      jup.rotation.y = lt * 0.3;
    },
    hud(g, V, p, lt) {
      camera.updateMatrixWorld(true);
      orbits.forEach((o, i) => {
        const d = screenDisc(camera, moons[i].position, 0.25, V);
        const a = sstep(0.12, 0.22, p) * (1 - sstep(0.95, 0.99, p));
        T(g, V, o.n, d.x, d.y - 40, { size: 16, color: i === 1 ? COL.co2 : COL.ice, weight: 700, align: 'center', track: 3, alpha: a });
        const n = Math.floor(angle(o, lt) / TAU);
        T(g, V, `${n}`, d.x, d.y - 62, { size: 22, weight: 700, align: 'center', alpha: a * 0.0 });
      });
      // orbit counters
      const x = V.portrait ? 70 : 90, y0 = V.portrait ? V.h - 330 : V.h - 290;
      const a = sstep(0.30, 0.42, p) * (1 - sstep(0.95, 0.99, p));
      panel(g, V, x - 24, y0 - 44, 380, 190, { alpha: a });
      T(g, V, 'ORBITS COMPLETED', x, y0 - 14, { size: 14, color: COL.dim, weight: 600, track: 3, alpha: a });
      orbits.forEach((o, i) => {
        const n = Math.floor(angle(o, lt) / TAU);
        T(g, V, o.n, x, y0 + 30 + i * 42, { size: 19, color: i === 1 ? COL.co2 : COL.white, weight: 600, track: 2, alpha: a });
        T(g, V, String(n), x + 330, y0 + 30 + i * 42, { size: 26, weight: 700, align: 'right', font: 'mono', alpha: a });
      });
      const b = sstep(0.62, 0.74, p) * (1 - sstep(0.95, 0.99, p));
      T(g, V, 'RESONANCE   4 : 2 : 1', V.w / 2, V.portrait ? 200 : 110, { size: V.portrait ? 40 : 46, weight: 700, align: 'center', alpha: b, track: 3 });
      T(g, V, 'tidal flexing  →  friction  →  heat', V.w / 2, V.portrait ? 250 : 156, { size: 26, color: '#ffb07a', align: 'center', alpha: b, font: 'body', weight: 600 });
      lowerThird(g, V, { kicker: 'Why isn’t it frozen?', head: 'Tidal heating', p: sstep(0.02, 0.12, p), alpha: 1 - sstep(0.24, 0.30, p) });
    }
  };
}
