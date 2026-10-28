import * as THREE from 'three';
import { mulberry32 } from './util.js';

const hexShape = (R) => {
  const s = new THREE.Shape();
  for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; const x = R * Math.cos(a), y = R * Math.sin(a); i ? s.lineTo(x, y) : s.moveTo(x, y); }
  s.closePath(); return s;
};

/**
 * Procedural James Webb Space Telescope (metres). Mirror boresight = +Z, Sun side = -Y.
 * userData: segMats (18 mirror materials), shieldLayers (5 meshes)
 */
export function makeWebb() {
  const g = new THREE.Group();
  const rnd = mulberry32(5);

  const goldBase = { color: new THREE.Color(1.0, 0.56, 0.16), metalness: 1.0, roughness: 0.12, envMapIntensity: 2.2 };
  const segGeo = new THREE.ExtrudeGeometry(hexShape(0.762), { depth: 0.07, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1 });
  const d = 1.345, e1 = [d * Math.cos(Math.PI / 6), d * 0.5], e2 = [0, d];
  const segMats = [];
  const mirror = new THREE.Group();
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) {
    const s = -q - r; const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
    if (dist < 1 || dist > 2) continue;
    const m = new THREE.MeshStandardMaterial({ ...goldBase, emissive: new THREE.Color(1, 0.55, 0.1), emissiveIntensity: 0 });
    const mesh = new THREE.Mesh(segGeo, m);
    const x = q * e1[0] + r * e2[0], y = q * e1[1] + r * e2[1];
    mesh.position.set(x, y, 0.1 * Math.hypot(x, y) ** 2 * 0.06);
    mesh.rotation.set((rnd() - 0.5) * 0.03 - y * 0.012, (rnd() - 0.5) * 0.03 + x * 0.012, 0);
    mirror.add(mesh); segMats.push({ m, ang: Math.atan2(y, x) });
  }
  segMats.sort((a, b) => a.ang - b.ang);
  g.add(mirror);

  // backplane + instrument module
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2e36, metalness: 0.6, roughness: 0.55 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(6.4, 6.0, 1.6), dark); back.position.set(0, 0, -1.0); g.add(back);
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(1.9, 4.6, 0.5), dark); wingL.position.set(-4.1, 0, -0.5); wingL.rotation.y = 0.35;
  const wingR = wingL.clone(); wingR.position.x = 4.1; wingR.rotation.y = -0.35; g.add(wingL, wingR);

  // secondary mirror boom
  const strutM = new THREE.MeshStandardMaterial({ color: 0x8a8d96, metalness: 0.8, roughness: 0.35 });
  const apex = new THREE.Vector3(0, 0.0, 7.4);
  [90, 210, 330].forEach((deg) => {
    const a = (deg * Math.PI) / 180; const base = new THREE.Vector3(3.0 * Math.cos(a), 3.0 * Math.sin(a), 0.1);
    const dir = apex.clone().sub(base); const len = dir.length();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 8), strutM);
    c.position.copy(base).addScaledVector(dir, 0.5); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); g.add(c);
  });
  const sec = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.08, 40), new THREE.MeshStandardMaterial({ ...goldBase }));
  sec.rotation.x = Math.PI / 2; sec.position.copy(apex); g.add(sec);

  // sunshield: 5 layers, kite-like outline, in the XZ plane below the telescope
  const shape = new THREE.Shape();
  [[-10.5, 0.2], [-3.2, -6.8], [3.2, -6.8], [10.5, 0.2], [3.2, 6.8], [-3.2, 6.8]].forEach(([x, z], i) => (i ? shape.lineTo(x, z) : shape.moveTo(x, z)));
  shape.closePath();
  const shGeo = new THREE.ShapeGeometry(shape);
  const layers = [];
  for (let i = 0; i < 5; i++) {
    const tint = new THREE.Color().setHSL(0.76 - i * 0.02, 0.35, 0.40 + i * 0.03);
    const m = new THREE.MeshStandardMaterial({ color: tint, metalness: 0.25, roughness: 0.5, side: THREE.DoubleSide, transparent: true, opacity: 0.97, envMapIntensity: 0.35 });
    const mesh = new THREE.Mesh(shGeo, m);
    mesh.rotation.x = Math.PI / 2;                                  // shape XY -> XZ plane
    mesh.position.set(0, -5.6 + i * 0.36, -0.4);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(shGeo), new THREE.LineBasicMaterial({ color: 0xd9c6ff, transparent: true, opacity: 0.55 }));
    edge.rotation.copy(mesh.rotation); edge.position.copy(mesh.position);
    g.add(mesh, edge); layers.push(mesh);
  }
  // spacecraft bus (sun side) + thin pylons joining it to the telescope
  const foil = new THREE.MeshStandardMaterial({ color: 0xb08a3a, metalness: 0.9, roughness: 0.35, envMapIntensity: 1.2 });
  const bus = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.4, 3.4), foil); bus.position.set(0, -7.4, -0.4); g.add(bus);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.06, 2.2), new THREE.MeshStandardMaterial({ color: 0x1a2a55, metalness: 0.4, roughness: 0.4 }));
  panel.position.set(0, -6.1, 2.4); g.add(panel);
  const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3.6, 12), dark); pylon.position.set(0, -3.6, -0.6); g.add(pylon);

  g.userData = { segMats: segMats.map((s) => s.m), shieldLayers: layers };
  return g;
}

/** Europa Clipper (not to scale when placed next to Europa). Local +Z = nose, solar arrays along X. */
export function makeClipper() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xc89a3c, metalness: 0.9, roughness: 0.4, envMapIntensity: 1.2 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe9edf2, metalness: 0.2, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 2.4), gold); g.add(body);
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.2, 0.35, 40), white); dish.rotation.x = Math.PI / 2; dish.position.z = 1.55; g.add(dish);
  const tex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    x.fillStyle = '#16275c'; x.fillRect(0, 0, 256, 64); x.strokeStyle = 'rgba(160,190,255,0.55)'; x.lineWidth = 2;
    for (let i = 0; i <= 256; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 64); x.stroke(); }
    for (let j = 0; j <= 64; j += 32) { x.beginPath(); x.moveTo(0, j); x.lineTo(256, j); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  })();
  const pm = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.5, roughness: 0.35 });
  [-1, 1].forEach((s) => { const w = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.05, 2.2), pm); w.position.set(s * 4.0, 0, -0.2); g.add(w); });
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.4, 8), white); boom.rotation.x = Math.PI / 2; boom.position.set(0.9, 0.7, -2.6); g.add(boom);
  return g;
}

/** O=C=O ball-and-stick. Returns group; userData.glow = materials to pulse. */
export function makeCO2() {
  const g = new THREE.Group();
  const C = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, metalness: 0.2, roughness: 0.3, emissive: new THREE.Color(0.2, 1.0, 0.7), emissiveIntensity: 0 });
  const O = new THREE.MeshStandardMaterial({ color: 0xd63a3a, metalness: 0.1, roughness: 0.25, emissive: new THREE.Color(1, 0.2, 0.2), emissiveIntensity: 0 });
  const B = new THREE.MeshStandardMaterial({ color: 0xcfd6e2, metalness: 0.3, roughness: 0.3 });
  const c = new THREE.Mesh(new THREE.SphereGeometry(0.62, 48, 32), C); g.add(c);
  [-1, 1].forEach((s) => {
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.56, 48, 32), O); o.position.x = s * 1.85; g.add(o);
    [-0.13, 0.13].forEach((y) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.4, 12), B); b.rotation.z = Math.PI / 2; b.position.set(s * 0.93, y, 0); g.add(b); });
  });
  g.userData.glow = [C, O];
  return g;
}

/** Quarter-disc "cut face" shader for the cutaway globe: layered interior look. */
export function makeCapMaterial(radii) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uR: { value: new THREE.Vector4(radii.ice, radii.ocean, radii.mantle, radii.core) }, uHeat: { value: 0.0 }, uPl: { value: 0 } },
    vertexShader: `varying vec2 vP; varying vec3 vN; void main(){ vP=position.xy; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vP; varying vec3 vN; uniform float uTime,uHeat,uPl; uniform vec4 uR;
      float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
      void main(){
        float r=length(vP); vec3 col; float edge=0.0;
        float ang=atan(vP.y,vP.x+1e-4);
        if(r>uR.x){ // ice shell
          float s=n(vec2(ang*9.0,r*70.0)); col=mix(vec3(0.70,0.84,0.97),vec3(0.95,0.98,1.0),s);
        } else if(r>uR.y){ // ocean
          float depth=(uR.x-r)/(uR.x-uR.y);
          float c1=n(vP*vec2(14.0,14.0)+vec2(uTime*0.6,uTime*0.3)); float c2=n(vP*26.0-vec2(uTime*0.4,0.0));
          float caus=pow(abs(sin((c1+c2)*6.2831)),6.0);
          col=mix(vec3(0.05,0.42,0.85),vec3(0.01,0.10,0.34),depth)+caus*vec3(0.10,0.30,0.35)*(1.0-depth*0.6);
        } else if(r>uR.z){ // rocky mantle
          float s=n(vP*40.0); col=mix(vec3(0.34,0.22,0.17),vec3(0.58,0.40,0.30),s)*(0.9+0.2*n(vP*9.0));
          col+=vec3(1.0,0.4,0.1)*uHeat*(1.0-smoothstep(uR.z,uR.z+0.16,r))*0.55;
        } else { // core
          float k=clamp(r/max(uR.z*0.5,0.01),0.0,1.0); col=mix(vec3(1.0,0.85,0.4),vec3(0.95,0.40,0.10),k)*(0.9+0.15*n(vP*30.0+uTime));
        }
        float b1=(1.0-smoothstep(0.0,0.006,abs(r-uR.x))); float b2=(1.0-smoothstep(0.0,0.006,abs(r-uR.y))); float b3=(1.0-smoothstep(0.0,0.006,abs(r-uR.z)));
        col=mix(col,vec3(1.0),max(b1,max(b2,b3))*0.85);
        float lit=0.82+0.18*abs(vN.z);
        col=clamp(col*lit,0.0,2.0); if(!(col.r==col.r)) col=vec3(0.0); gl_FragColor=vec4(col,1.0);
      }`
  });
}

/** Rebuild UVs of a partial SphereGeometry so a full equirect texture maps correctly (u may exceed 1: repeat wrap). */
export function fixSphereUV(geo, phiStart, phiLen, thetaStart, thetaLen) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    uv.setXY(i, (phiStart + u * phiLen) / (Math.PI * 2), 1 - (thetaStart + (1 - v) * thetaLen) / Math.PI);
  }
  uv.needsUpdate = true;
  return geo;
}
