import * as THREE from 'three';
import { lerp, seg, sstep, easeIO, project } from '../lib/util.js';
import { makeSky } from '../lib/assets.js';
import { makeCapMaterial, fixSphereUV } from '../lib/models.js';
import { SUN_DIR } from '../lib/stage.js';
import { callout, T, COL, lowerThird } from '../lib/hud.js';

const L = { ice: 0.92, ocean: 0.70, mantle: 0.32 };          // radii of layer tops (exaggerated outer layers)

export default function create(ctx) {
  const { assets } = ctx;
  const scene = new THREE.Scene();
  const sky = makeSky(assets, { u: ctx.u, stars: 5000, seed: 3 }); scene.add(sky);
  const sun = new THREE.DirectionalLight(0xfff4e6, 3.2); sun.position.copy(new THREE.Vector3(1, 0.7, 0.9)).multiplyScalar(50); scene.add(sun);
  scene.add(new THREE.AmbientLight(0x3a4a70, 0.35));

  const a = assets.europa;
  const mat = new THREE.MeshStandardMaterial({ map: a.map, bumpMap: a.bump, bumpScale: 1.6, roughness: 0.8 });
  const globe = new THREE.Group();
  const up = fixSphereUV(new THREE.SphereGeometry(1, 128, 40, Math.PI, Math.PI * 1.5, 0, Math.PI / 2), Math.PI, Math.PI * 1.5, 0, Math.PI / 2);
  const lo = fixSphereUV(new THREE.SphereGeometry(1, 128, 40, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  globe.add(new THREE.Mesh(up, mat), new THREE.Mesh(lo, mat));

  const capMat = makeCapMaterial({ ice: L.ice, ocean: L.ocean, mantle: L.mantle, core: 0 });
  const quarter = new THREE.CircleGeometry(1, 96, 0, Math.PI / 2);
  const c1 = new THREE.Mesh(quarter, capMat);                                    // z=0 plane
  const c2 = new THREE.Mesh(quarter, capMat); c2.rotation.x = Math.PI / 2;        // y=0 plane
  const c3 = new THREE.Mesh(quarter, capMat); c3.rotation.y = -Math.PI / 2;       // x=0 plane
  // shell between L.ice and 1.0 is rendered by the ice colour of the cap (radius > L.ice region uses ice); extend cap to r=1
  globe.add(c1, c2, c3);
  scene.add(globe);

  // glow at the core
  const coreGlow = new THREE.Mesh(new THREE.SphereGeometry(0.30, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.4, 0.4), toneMapped: false }));
  coreGlow.visible = false; scene.add(coreGlow);

  const camera = new THREE.PerspectiveCamera(30, ctx.aspect, 0.05, 100);
  const tmp = new THREE.Vector3();
  return {
    scene, camera, sky, bloom: { strength: 0.5, radius: 0.6, threshold: 0.9 }, exposure: 1.05,
    update(p, lt) {
      const az = (45 + 30 * Math.sin(p * Math.PI * 1.2 - 0.4)) * Math.PI / 180, el = (28 + 6 * Math.sin(p * 4)) * Math.PI / 180;
      const d = ctx.D(lerp(6.2, 5.0, easeIO(p)));
      camera.position.set(d * Math.cos(el) * Math.sin(az), d * Math.sin(el), d * Math.cos(el) * Math.cos(az));
      camera.lookAt(0.12, 0.1, 0.12);
      capMat.uniforms.uTime.value = lt;
      capMat.uniforms.uHeat.value = 0.5 + 0.5 * Math.sin(lt * 2);
      globe.rotation.y = 0;
    },
    hud(g, V, p, lt, dur, opts) {
      camera.updateMatrixWorld(true);
      const ang = 38 * Math.PI / 180;
      const useX = camera.position.x > camera.position.z;
      const pt = (r) => project(useX ? tmp.set(0, r * Math.sin(ang), r * Math.cos(ang)) : tmp.set(r * Math.cos(ang), r * Math.sin(ang), 0), camera, V.W, V.H).map((v, i) => (i < 2 ? v / V.u : v));
      const rows = [
        { r: 0.96, t: 'Ice shell', s: '≈ 15–30 km thick', p0: 0.20, c: COL.ice },
        { r: 0.80, t: 'Global ocean', s: '≈ 60–150 km deep', p0: 0.36, c: '#58b4ff' },
        { r: 0.50, t: 'Rocky mantle', s: 'silicate rock', p0: 0.55, c: '#e0a070' },
        { r: 0.12, t: 'Metallic core', s: 'iron-rich', p0: 0.68, c: COL.gold }
      ];
      const x0 = V.portrait ? 70 : V.w - 520;
      rows.forEach((o, i) => {
        if (opts.short && i === 3) return;
        const [ax, ay] = pt(o.r);
        const ty = V.portrait ? V.h * 0.64 + i * 92 : 250 + i * 150;
        callout(g, V, { ax, ay, tx: x0, ty, title: o.t, sub: o.s, p: seg(p, o.p0, o.p0 + 0.1), color: o.c, side: 'r', alpha: 1 - sstep(0.95, 0.99, p) });
      });
      T(g, V, 'LAYER THICKNESSES NOT TO SCALE', V.w / 2, V.portrait ? V.h - 70 : V.h - 56, { size: 15, color: COL.dim, align: 'center', track: 3, alpha: sstep(0.45, 0.55, p), weight: 600 });
      lowerThird(g, V, { kicker: 'Inside Europa', head: 'A hidden global ocean', p: seg(p, 0.03, 0.12), alpha: 1 - sstep(0.18, 0.24, p) });
      const w = seg(p, 0.80, 0.90) * (1 - sstep(0.96, 0.99, p));
      T(g, V, '2× the water of all Earth’s oceans', V.w / 2, V.portrait ? V.h * 0.17 : 120, { size: V.portrait ? 40 : 44, weight: 700, align: 'center', alpha: w });
    }
  };
}
