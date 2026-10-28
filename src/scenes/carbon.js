import * as THREE from 'three';
import { seg, sstep, easeOut } from '../lib/util.js';
import { makeSky } from '../lib/assets.js';
import { makeCO2 } from '../lib/models.js';
import { T, COL, panel, line } from '../lib/hud.js';

export default function create(ctx) {
  const { assets } = ctx;
  const scene = new THREE.Scene(); scene.environment = assets.env;
  const sky = makeSky(assets, { u: ctx.u, stars: 5000, seed: 21 }); scene.add(sky);
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 4, 5); scene.add(key);
  scene.add(new THREE.AmbientLight(0x405080, 0.5));
  const mol = makeCO2(); scene.add(mol);
  const camera = new THREE.PerspectiveCamera(30, ctx.aspect, 0.1, 100);
  return {
    scene, camera, sky, bloom: { strength: 0.6, radius: 0.6, threshold: 0.85 }, exposure: 1.1,
    update(p, lt) {
      mol.rotation.y = lt * 0.5; mol.rotation.x = 0.35 + 0.1 * Math.sin(lt * 0.4);
      const grow = 0.75 + 0.25 * easeOut(seg(p, 0.55, 0.9));
      mol.scale.setScalar(grow);
      if (ctx.portrait) { mol.position.set(0, 3.6, 0); camera.position.set(0, 1.2, 15); camera.lookAt(0, 1.2, 0); }
      else { mol.position.set(-3.6, 0, 0); camera.position.set(0, 0, 14); camera.lookAt(0, 0, 0); }
      const glow = sstep(0.6, 0.8, p) * (0.5 + 0.5 * Math.sin(lt * 3)) * 0.2;
      mol.userData.glow.forEach((m) => (m.emissiveIntensity = glow));
    },
    hud(g, V, p, lt) {
      const x = V.portrait ? 80 : V.w * 0.55, y0 = V.portrait ? V.h * 0.52 : 330, w = V.portrait ? V.w - 160 : 740;
      T(g, V, 'WHAT LIFE NEEDS', x, y0 - 50, { size: 17, color: COL.ice, weight: 600, track: 4, alpha: sstep(0.04, 0.12, p) });
      const rows = [
        { n: 'Liquid water', s: 'very likely, a global ocean', p0: 0.10, ok: true },
        { n: 'Energy', s: 'tidal heating could supply it', p0: 0.30, ok: true },
        { n: 'Carbon', s: 'never traced to the ocean', p0: 0.52, ok: false }
      ];
      rows.forEach((r, i) => {
        const y = y0 + i * 118, a = sstep(r.p0, r.p0 + 0.08, p) * (1 - sstep(0.95, 0.99, p));
        panel(g, V, x, y, w, 92, { alpha: a, stroke: r.ok ? 'rgba(109,255,194,0.45)' : 'rgba(255,193,90,0.6)' });
        T(g, V, r.n, x + 100, y + 42, { size: 34, weight: 700, alpha: a });
        T(g, V, r.s, x + 100, y + 72, { size: 21, color: COL.dim, font: 'body', weight: 400, alpha: a });
        const t = sstep(r.p0 + 0.08, r.p0 + 0.16, p);
        if (r.ok) T(g, V, '✓', x + 48, y + 62, { size: 50, color: COL.co2, weight: 700, align: 'center', alpha: a * t });
        else T(g, V, '?', x + 48, y + 64, { size: 56, color: COL.gold, weight: 700, align: 'center', alpha: a * (0.55 + 0.45 * Math.sin(lt * 4)) });
      });
      const c = sstep(0.70, 0.80, p) * (1 - sstep(0.95, 0.99, p));
      const cx = V.portrait ? V.w / 2 : V.w * 0.27, cy = V.portrait ? V.h * 0.36 : V.h - 190;
      T(g, V, 'CO₂', cx, cy, { size: 64, weight: 700, align: 'center', alpha: c, track: 4, color: COL.co2 });
      T(g, V, 'carbon dioxide', cx, cy + 34, { size: 22, align: 'center', alpha: c, font: 'body', color: COL.dim });
    }
  };
}
