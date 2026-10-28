import { Vector3 } from 'three';

export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t) => t * t * t;
/** normalised sub-progress of p inside [a,b] */
export const seg = (p, a, b) => clamp((p - a) / (b - a));
/** 0->1->0 pulse: in at a, hold until b, out at c */
export const window3 = (p, a, b, c, d) => sstep(a, b, p) * (1 - sstep(c, d, p));

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** screen position (px) of a world point. Returns [x, y, ndcDepth, visible] */
export function project(v, camera, W, H) {
  const p = v.clone().project(camera);
  return [(p.x * 0.5 + 0.5) * W, (1 - (p.y * 0.5 + 0.5)) * H, p.z, p.z > -1 && p.z < 1];
}

/**
 * Direction on a unit sphere for the same (azimuth, latitude) convention that the
 * baked textures use. THREE.SphereGeometry: x=-cos(phi)sin(theta), y=cos(theta), z=sin(phi)sin(theta)
 */
export function dirAzLat(azDeg, latDeg) {
  const phi = (azDeg * Math.PI) / 180;
  const theta = ((90 - latDeg) * Math.PI) / 180;
  return new Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
}

/** Named surface regions (illustrative placement, used consistently by textures + camera). */
export const REGIONS = {
  tara: { az: 250, lat: -8, radius: 0.46 },
  powys: { az: 330, lat: 4, radius: 0.2 },
  leading: { az: 250, lat: 0 }
};

export const fmt = (n, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
