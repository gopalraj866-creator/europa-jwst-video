import * as THREE from 'three';
import { TAU, seg, sstep, lerp } from '../lib/util.js';
import { makeSky } from '../lib/assets.js';
import { makeWebb } from '../lib/models.js';
import { screenDisc } from '../lib/stage.js';
import { T, COL, line, dot, lowerThird } from '../lib/hud.js';

export default function create(ctx) {
  const { assets } = ctx;
  const scene = new THREE.Scene(); scene.environment = assets.env; scene.environmentIntensity = 0.25;
  const sky = makeSky(assets, { u: ctx.u, stars: 5000, seed: 44 }); scene.add(sky);
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.6); sun.position.set(-1, 0.3, 0.2).multiplyScalar(30); scene.add(sun);
  scene.add(new THREE.AmbientLight(0x303a5c, 0.4));
  const earth = new THREE.Mesh(new THREE.SphereGeometry(0.32, 64, 32), new THREE.MeshStandardMaterial({ map: assets.earth, roughness: 0.8 })); scene.add(earth);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 32, 16), new THREE.MeshStandardMaterial({ map: assets.moon, roughness: 1 })); scene.add(moon);
  const ring = (r, col, op) => { const pts = []; for (let i = 0; i <= 200; i++) pts.push(new THREE.Vector3(Math.cos(i / 200 * TAU) * r, 0, Math.sin(i / 200 * TAU) * r)); return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: op })); };
  scene.add(ring(0.96, 0x88aaff, 0.35));
  const L2 = new THREE.Vector3(3.75, 0, 0);
  const halo = new THREE.Group(); halo.position.copy(L2);
  const hp = []; for (let i = 0; i <= 200; i++) hp.push(new THREE.Vector3(Math.sin(i / 200 * TAU) * 0.25, Math.cos(i / 200 * TAU) * 0.55 * 0.0, Math.cos(i / 200 * TAU) * 0.8));
  halo.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(hp), new THREE.LineBasicMaterial({ color: 0xffc15a, transparent: true, opacity: 0.7 })));
  scene.add(halo);
  const webb = makeWebb(); webb.scale.setScalar(0.028); scene.add(webb);
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffc15a })); marker.position.copy(L2); scene.add(marker);
  const camera = new THREE.PerspectiveCamera(32, ctx.aspect, 0.1, 200);
  const tmp = new THREE.Vector3();
  return {
    scene, camera, sky, bloom: { strength: 0.5, radius: 0.5, threshold: 0.9 }, exposure: 1.1,
    update(p, lt) {
      const a = lt * 0.5; moon.position.set(Math.cos(a) * 0.96, 0, Math.sin(a) * 0.96); earth.rotation.y = lt * 0.5;
      const w = lt * 0.35; webb.position.set(L2.x + Math.sin(w) * 0.25, 0.04, Math.cos(w) * 0.8); webb.rotation.y = Math.PI / 2;
      const k = sstep(0, 1, p); const d = ctx.D(lerp(11.5, 9.5, k));
      const cx = ctx.portrait ? 1.6 : 1.9;
      camera.position.set(cx, d * 0.5, d * 0.85); camera.lookAt(cx, 0, 0);
    },
    hud(g, V, p, lt) {
      camera.updateMatrixWorld(true);
      const out = 1 - sstep(0.94, 0.99, p);
      const e = screenDisc(camera, earth.position, 0.32, V), j = screenDisc(camera, webb.position, 0.3, V), l2 = screenDisc(camera, L2, 0.1, V);
      T(g, V, 'EARTH', e.x, e.y + e.r + 34, { size: 17, color: COL.ice, weight: 700, align: 'center', track: 3, alpha: sstep(0.05, 0.15, p) * out });
      const mo = screenDisc(camera, moon.position, 0.1, V);
      T(g, V, 'MOON ORBIT · 384,000 km', e.x + 20, e.y - e.r - 80 - (V.portrait ? 40 : 0), { size: 15, color: COL.dim, weight: 600, track: 2, alpha: sstep(0.10, 0.2, p) * out, align: 'left' });
      line(g, V, [[e.x + e.r + 14, e.y], [j.x - 22, j.y]], { color: 'rgba(255,255,255,0.5)', width: 1.4, alpha: out, p: seg(p, 0.30, 0.55) });
      T(g, V, 'JWST', j.x, j.y - 40, { size: 19, color: COL.gold, weight: 700, align: 'center', track: 3, alpha: sstep(0.25, 0.35, p) * out });
      T(g, V, 'L2 · 1.5 million km', l2.x, l2.y + 118, { size: 22, color: COL.white, weight: 600, align: 'center', alpha: sstep(0.35, 0.45, p) * out });
      T(g, V, 'radio signals take ≈ 5 seconds', (e.x + j.x) / 2, e.y - 22, { size: 18, color: COL.dim, font: 'body', align: 'center', alpha: sstep(0.55, 0.66, p) * out });
      T(g, V, '← SUN', 70, V.h / 2, { size: 26, color: '#ffd9a0', weight: 700, track: 4, alpha: sstep(0.04, 0.12, p) * out });
      T(g, V, 'NOT TO SCALE', V.w / 2, V.h - (V.portrait ? 70 : 50), { size: 14, color: COL.dim, align: 'center', track: 3, alpha: out * 0.8, weight: 600 });
      lowerThird(g, V, { kicker: 'Sun–Earth Lagrange point', head: 'Parked at L2', p: seg(p, 0.02, 0.1), alpha: 1 - sstep(0.18, 0.26, p), y: V.portrait ? 230 : 150 });
    }
  };
}
