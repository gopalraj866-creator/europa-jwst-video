import * as THREE from 'three';
import { TAU, lerp, seg, sstep, mulberry32, easeIO } from '../lib/util.js';
import { makeSky } from '../lib/assets.js';
import { T, COL, panel, lowerThird } from '../lib/hud.js';

export default function create(ctx) {
  const { assets } = ctx;
  const scene = new THREE.Scene();
  const sky = makeSky(assets, { u: ctx.u, stars: 5000, seed: 66 }); scene.add(sky);
  const key = new THREE.DirectionalLight(0xfff4e6, 2.4); key.position.set(-4, 8, 6); scene.add(key);
  scene.add(new THREE.AmbientLight(0x405888, 0.7));

  const W = 12, Dp = 4.2;
  const box = (h, y, color, opacity = 1, emissive = 0x000000) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(W, h, Dp), new THREE.MeshStandardMaterial({ color, roughness: 0.8, transparent: opacity < 1, opacity, emissive }));
    m.position.y = y; scene.add(m); return m;
  };
  const rock = box(0.7, -3.35, 0x3a2a24, 1, 0x1a0800);
  const ocean = box(2.6, -1.7, 0x1e78d6, 0.78, 0x062a60);
  const ice = box(3.2, 1.2, 0xcfe6ff, 0.97, 0x0a1830);
  // fissure through the ice (dark slot) and disrupted surface blocks
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.32, 3.3, Dp + 0.02), new THREE.MeshBasicMaterial({ color: 0x07263a })); slot.position.set(1.0, 1.15, 0); scene.add(slot);
  const rnd = mulberry32(8);
  for (let i = 0; i < 9; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.5 + rnd() * 0.5, 0.18 + rnd() * 0.2, 0.9 + rnd() * 1.2), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.09, 0.3, 0.55 + rnd() * 0.3), roughness: 0.9 }));
    b.position.set(0.1 + rnd() * 2.0, 2.9 + rnd() * 0.1, (rnd() - 0.5) * 2.8); b.rotation.set((rnd() - 0.5) * 0.4, rnd() * 3, (rnd() - 0.5) * 0.4); scene.add(b);
  }
  // seafloor vents
  const vents = [0.6, 1.0, 1.5].map((x) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.2, 0.3), toneMapped: false })); m.position.set(x, -3.0, (x - 1) * 0.8); scene.add(m); return m; });

  // CO2 particles rising from the vents, through the fissure
  const N = 520, pos = new Float32Array(N * 3), seeds = Array.from({ length: N }, () => ({ o: rnd(), s: 0.5 + rnd() * 0.5, a: rnd() * TAU, r: rnd() }));
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pm = new THREE.PointsMaterial({ color: new THREE.Color(0.45, 3.0, 1.9), size: 5 * ctx.u, sizeAttenuation: false, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, depthTest: false });
  const pts = new THREE.Points(pg, pm); pts.frustumCulled = false; pts.renderOrder = 20; scene.add(pts);
  // meteorite streaks (hypothesis A)
  const met = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.09, 1.2, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.6, 0.6), toneMapped: false })); scene.add(met);

  const camera = new THREE.PerspectiveCamera(32, ctx.aspect, 0.1, 100);
  return {
    scene, camera, sky, bloom: { strength: 0.7, radius: 0.6, threshold: 0.9 }, exposure: 1.0,
    update(p, lt) {
      const flow = sstep(0.38, 0.52, p);                       // ocean-source flow turns on
      const arr = pg.attributes.position.array;
      for (let i = 0; i < N; i++) {
        const s = seeds[i]; const u = ((lt * 0.18 * s.s + s.o) % 1);
        const y = lerp(-3.0, 3.1, u); const wob = (1 - Math.abs(u - 0.5) * 0.6);
        const x = 1.0 + Math.sin(u * 14 + s.a) * 0.10 * (u > 0.55 ? 1 : 0) + (u < 0.55 ? (s.r - 0.5) * 1.6 * (1 - u / 0.55) : 0);
        const z = (u < 0.55 ? (s.r - 0.5) * 1.4 * (1 - u / 0.55) : (s.a / TAU - 0.5) * 0.15) + (u > 0.9 ? (s.a / TAU - 0.5) * 2.4 : 0);
        const show = i < N * (0.08 + 0.92 * flow);
        arr[i * 3] = show ? x + (u > 0.9 ? (s.r - 0.5) * 1.6 : 0) : 99; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
      }
      pg.attributes.position.needsUpdate = true;
      const m = (lt * 0.35) % 1; met.visible = p > 0.34 && p < 0.58;
      met.position.set(lerp(-4.5, -3.0, m), lerp(7, 3.2, m), 0.3); met.rotation.z = 0.5;
      vents.forEach((v, i) => v.scale.setScalar(0.8 + 0.4 * Math.sin(lt * 3 + i)));
      const az = lerp(-20, 14, easeIO(p)) * Math.PI / 180, d = ctx.D(lerp(26, 22, p));
      camera.position.set(Math.sin(az) * d, 4.5, Math.cos(az) * d); camera.lookAt(ctx.portrait ? 0 : 2.3, ctx.portrait ? 0 : -0.2, 0);
    },
    hud(g, V, p, lt, dur, opts) {
      const out = 1 - sstep(0.95, 0.99, p);
      T(g, V, 'WHERE DID THE CARBON COME FROM?', V.w / 2, V.portrait ? 120 : 96, { size: V.portrait ? 32 : 38, weight: 700, align: 'center', alpha: sstep(0.0, 0.08, p) * out, track: 2 });
      const rows = [
        { t: 'Delivered by meteorites', s: 'less likely', p0: 0.34, c: COL.dim, x: false },
        { t: 'Made on the surface by radiation', s: 'less likely: no complex organics seen', p0: 0.44, c: COL.dim, x: false },
        { t: 'Rising from the ocean', s: 'best fit to the evidence', p0: 0.55, c: COL.co2, x: true }
      ];
      const x0 = V.portrait ? 60 : 80, y0 = V.portrait ? V.h * 0.62 : 250, w = V.portrait ? V.w - 120 : 640;
      rows.forEach((r, i) => {
        const a = sstep(r.p0, r.p0 + 0.07, p) * out, y = y0 + i * 112;
        panel(g, V, x0, y, w, 92, { alpha: a, stroke: r.x ? 'rgba(109,255,194,0.8)' : 'rgba(150,170,200,0.3)', fill: r.x ? 'rgba(10,50,40,0.7)' : 'rgba(6,12,22,0.62)' });
        T(g, V, r.t, x0 + 24, y + 40, { size: 28, weight: 700, alpha: a, color: r.x ? COL.white : 'rgba(235,240,250,0.75)' });
        T(g, V, r.s, x0 + 24, y + 70, { size: 20, font: 'body', color: r.x ? COL.co2 : COL.dim, alpha: a });
      });
      T(g, V, 'CO₂ is unstable on the surface  →  recently supplied', x0, y0 - 28, { size: 21, color: COL.gold, weight: 600, alpha: sstep(0.18, 0.26, p) * out, font: 'body' });
      const b = sstep(0.82, 0.9, p) * out;
      panel(g, V, x0, V.portrait ? V.h - 230 : V.h - 190, w, 96, { alpha: b });
      T(g, V, 'Hubble, 2019', x0 + 24, (V.portrait ? V.h - 230 : V.h - 190) + 40, { size: 18, color: COL.ice, weight: 700, track: 3, alpha: b });
      T(g, V, 'Table salt (NaCl) in Tara Regio', x0 + 24, (V.portrait ? V.h - 230 : V.h - 190) + 74, { size: 28, weight: 700, alpha: b });
      // labels on the 3D diagram
      if (!V.portrait) {
        T(g, V, 'ICE SHELL', V.w - 90, 420, { size: 16, color: COL.ice, align: 'right', track: 3, weight: 700, alpha: sstep(0.1, 0.2, p) * out });
        T(g, V, 'OCEAN', V.w - 90, 640, { size: 16, color: '#58b4ff', align: 'right', track: 3, weight: 700, alpha: sstep(0.1, 0.2, p) * out });
        T(g, V, 'SEAFLOOR', V.w - 90, 790, { size: 16, color: '#e0a070', align: 'right', track: 3, weight: 700, alpha: sstep(0.1, 0.2, p) * out });
      }
      T(g, V, 'SCHEMATIC · NOT TO SCALE', V.w / 2, V.h - 40, { size: 14, color: COL.dim, align: 'center', track: 3, alpha: 0.7, weight: 600 });
    }
  };
}
