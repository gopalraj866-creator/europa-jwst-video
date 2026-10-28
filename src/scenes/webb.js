import * as THREE from 'three';
import { lerp, seg, sstep, easeIO, project } from '../lib/util.js';
import { makeSky } from '../lib/assets.js';
import { makeWebb } from '../lib/models.js';
import { callout, T, COL, lowerThird, panel } from '../lib/hud.js';

export default function create(ctx) {
  const { assets } = ctx;
  const scene = new THREE.Scene(); scene.environment = assets.env; scene.environmentIntensity = 0.8;
  const sky = makeSky(assets, { u: ctx.u, stars: 6000, seed: 33 }); scene.add(sky);
  const key = new THREE.DirectionalLight(0xfff1dc, 1.5); key.position.set(6, 10, 8); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fa8ff, 1.4); rim.position.set(-8, 2, -6); scene.add(rim);
  scene.add(new THREE.AmbientLight(0x303a5c, 0.5));
  const webb = makeWebb(); scene.add(webb);
  const { segMats, shieldLayers } = webb.userData;
  const camera = new THREE.PerspectiveCamera(32, ctx.aspect, 0.1, 400);
  const tmp = new THREE.Vector3();
  const anchor = (x, y, z, V) => { webb.updateMatrixWorld(true); const q = project(tmp.set(x, y, z).applyMatrix4(webb.matrixWorld), camera, V.W, V.H); return [q[0] / V.u, q[1] / V.u]; };

  return {
    scene, camera, sky, bloom: { strength: 0.22, radius: 0.4, threshold: 1.0 }, exposure: 1.0,
    update(p, lt, dur, opts) {
      webb.rotation.y = lerp(-0.7, 0.5, easeIO(p));
      const d = ctx.D(lerp(34, 27, easeIO(p)));
      camera.position.set(d * 0.35, d * 0.36, d * 0.85); camera.lookAt(0, -1.6, 1.0);
      // light the 18 mirror segments one after another
      const n = seg(p, 0.30, 0.62) * 18;
      segMats.forEach((m, i) => { m.emissiveIntensity = 0.55 * Math.max(0, 1 - Math.abs(n - i - 0.5) / 2.2) * (n > 0 && n < 19 ? 1 : 0); });
      shieldLayers.forEach((m, i) => { m.material.emissive = new THREE.Color(0x6a4cff); m.material.emissiveIntensity = 0.35 * Math.max(0, 1 - Math.abs(seg(p, 0.62, 0.88) * 6 - i - 0.5) / 1.4); });
    },
    hud(g, V, p, lt, dur, opts) {
      const out = 1 - sstep(0.94, 0.99, p);
      const [ax, ay] = anchor(2.2, 1.6, 0.2, V), [bx, by] = anchor(7.8, -4.8, -0.4, V), [cx, cy] = anchor(0, -7.4, -0.4, V);
      const L = V.portrait ? 70 : V.w - 560;
      callout(g, V, { ax, ay, tx: L, ty: V.portrait ? V.h * 0.60 : 270, title: 'Primary mirror', big: '6.5 m', sub: '18 gold-coated hexagonal segments', p: seg(p, 0.14, 0.26), color: COL.gold, side: 'r', alpha: out });
      if (!opts.short) {
        callout(g, V, { ax: bx, ay: by, tx: L, ty: V.portrait ? V.h * 0.72 : 470, title: 'Sunshield', big: '5 layers', sub: 'about the size of a tennis court', p: seg(p, 0.50, 0.62), color: '#c9a8ff', side: 'r', alpha: out });
        callout(g, V, { ax: cx, ay: cy, tx: V.portrait ? L : 560, ty: V.portrait ? V.h * 0.84 : 760, title: 'Instruments', big: '< −220 °C', sub: 'infrared, 0.6–28 µm', p: seg(p, 0.76, 0.88), color: COL.ice, side: V.portrait ? 'r' : 'l', alpha: out });
      }
      const n = Math.min(18, Math.floor(seg(p, 0.30, 0.62) * 18 + 0.0));
      const a = sstep(0.30, 0.36, p) * (1 - sstep(0.66, 0.72, p));
      T(g, V, `${n} / 18`, V.portrait ? V.w / 2 : 140, V.portrait ? 250 : 200, { size: 50, weight: 700, font: 'mono', align: V.portrait ? 'center' : 'left', alpha: a, color: COL.gold });
      T(g, V, 'MIRROR SEGMENTS', V.portrait ? V.w / 2 : 140, V.portrait ? 290 : 232, { size: 15, weight: 600, track: 3, align: V.portrait ? 'center' : 'left', alpha: a, color: COL.dim });
      lowerThird(g, V, { kicker: 'NASA · ESA · CSA', head: 'James Webb Space Telescope', p: seg(p, 0.02, 0.12), alpha: 1 - sstep(0.18, 0.26, p) });
    }
  };
}
