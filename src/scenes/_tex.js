// Debug scene: shows baked textures flat. Not part of the timeline.
import * as THREE from 'three';
export default function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-2, 2, 1, -1, 0.1, 10); camera.position.z = 3;
  const a = ctx.assets.europa;
  const mk = (tex, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); m.position.y = y; return m; };
  scene.add(mk(a.map, 0));
  camera.top = 1; camera.bottom = -1;
  return { scene, camera, update() { camera.left = -2; camera.right = 2; }, exposure: 1, bloom: { strength: 0 } };
}
