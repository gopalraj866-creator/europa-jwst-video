import * as THREE from 'three';
import { makeSky, makeCo2Overlay, makeAtmosphere } from './assets.js';
import { dirAzLat, REGIONS } from './util.js';

export const SUN_DIR = new THREE.Vector3(0.92, 0.26, 0.12).normalize();
export const JUPITER_POS = new THREE.Vector3(-120, 45, -410);
export const JUPITER_R = 45.8;                 // Europa radii (71,492 km / 1,560.8 km)

export function makeEuropa(assets, { segs = 160, bump = 2.2 } = {}) {
  const a = assets.europa;
  const mat = new THREE.MeshStandardMaterial({ map: a.map, bumpMap: a.bump, bumpScale: bump, roughness: 0.78, metalness: 0, envMapIntensity: 0 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, segs, segs / 2), mat);
  return mesh;
}

/**
 * Europa at the origin, Jupiter looming behind, a distant Sun and a starry sky.
 * Real relative scale: Jupiter's disc spans ~12 degrees from Europa.
 */
export function makeJovianStage(ctx, { co2 = false, jupiter = true, stars = 7000 } = {}) {
  const { assets, u } = ctx;
  const scene = new THREE.Scene();
  const sky = makeSky(assets, { u, stars });
  scene.add(sky);

  const sun = new THREE.DirectionalLight(0xfff4e6, 3.4);
  sun.position.copy(SUN_DIR).multiplyScalar(100);
  scene.add(sun);
  const jshine = new THREE.DirectionalLight(0xffcf9c, 0.10);
  jshine.position.copy(JUPITER_POS.clone().normalize()).multiplyScalar(100);
  scene.add(jshine);
  scene.add(new THREE.AmbientLight(0x2a3550, 0.16));

  const europa = makeEuropa(assets);
  europa.rotation.y = 0;
  scene.add(europa);

  let overlay = null;
  if (co2) { overlay = makeCo2Overlay(assets.europa.co2); europa.add(overlay); }

  let jup = null;
  if (jupiter) {
    jup = new THREE.Mesh(new THREE.SphereGeometry(JUPITER_R, 128, 64), new THREE.MeshStandardMaterial({ map: assets.jupiter, roughness: 1, metalness: 0 }));
    jup.position.copy(JUPITER_POS);
    const atm = makeAtmosphere(JUPITER_R * 1.025, [0.95, 0.78, 0.6], 2.6, 0.55);
    atm.position.copy(JUPITER_POS);
    scene.add(jup, atm);
  }
  // a distant, very bright Sun (blooms into a star-like glint)
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 8.4, 7.2), toneMapped: false }));
  sunDisc.position.copy(SUN_DIR).multiplyScalar(2600);
  scene.add(sunDisc);

  const tara = dirAzLat(REGIONS.tara.az, REGIONS.tara.lat);
  const powys = dirAzLat(REGIONS.powys.az, REGIONS.powys.lat);
  return { scene, sky, europa, overlay, jupiter: jup, sun, tara, powys };
}

/** spherical camera helper: place camera around `target` */
export function orbitCam(camera, target, dist, azDeg, elDeg) {
  const az = (azDeg * Math.PI) / 180, el = (elDeg * Math.PI) / 180;
  camera.position.set(
    target.x + dist * Math.cos(el) * Math.sin(az),
    target.y + dist * Math.sin(el),
    target.z + dist * Math.cos(el) * Math.cos(az)
  );
  camera.lookAt(target);
}

/** screen-space disc of a sphere (centre + radius in design units) */
export function screenDisc(camera, center, radius, V) {
  const c = center.clone().project(camera);
  const cx = (c.x * 0.5 + 0.5) * V.W, cy = (1 - (c.y * 0.5 + 0.5)) * V.H;
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(radius).add(center).project(camera);
  const rx = (right.x * 0.5 + 0.5) * V.W;
  return { x: cx / V.u, y: cy / V.u, r: Math.abs(rx - cx) / V.u };
}

/** Four callout slots around a disc (landscape: left/right; portrait: top/bottom bands). */
export function slots(V, d) {
  if (!V.portrait) {
    return [
      { tx: d.x + d.r + 170, ty: d.y - d.r * 0.55, side: 'r' },
      { tx: d.x - d.r - 170, ty: d.y - d.r * 0.10, side: 'l' },
      { tx: d.x + d.r + 170, ty: d.y + d.r * 0.40, side: 'r' },
      { tx: d.x - d.r - 170, ty: d.y + d.r * 0.70, side: 'l' }
    ];
  }
  return [
    { tx: 70, ty: Math.max(210, d.y - d.r - 190), side: 'r' },
    { tx: 70, ty: Math.max(300, d.y - d.r - 100), side: 'r' },
    { tx: 70, ty: Math.min(V.h - 330, d.y + d.r + 120), side: 'r' },
    { tx: 70, ty: Math.min(V.h - 240, d.y + d.r + 210), side: 'r' }
  ];
}
