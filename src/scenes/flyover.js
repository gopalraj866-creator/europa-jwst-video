import * as THREE from 'three';
import { lerp, seg, sstep, easeIO } from '../lib/util.js';
import { makeSky, makeAtmosphere } from '../lib/assets.js';
import { NOISE } from '../lib/glsl.js';
import { T, COL, lowerThird, disclaimer } from '../lib/hud.js';

// Artist's visualisation of chaos terrain: raft-like ice blocks, GPU-displaced, lit at a low sun angle.
const HEIGHT = /* glsl */ `
float hgt(vec2 p){
  vec3 v = voro(vec3(p*0.8, 0.0));
  float id = v.z;
  float edge = v.y - v.x;
  float plateau = (id-0.5)*0.6;
  float h = plateau + 0.07*snoise(vec3(p*3.5,id*9.0));
  h -= smoothstep(0.18,0.0,edge)*0.14;
  h += 0.9*snoise(vec3(p*0.07,3.0));
  h -= 0.06*smoothstep(0.92,1.0,1.0-abs(snoise(vec3(p*1.6,id*5.0))));
  return h;
}`;

export default function create(ctx) {
  const { assets } = ctx;
  const scene = new THREE.Scene();
  const sky = makeSky(assets, { u: ctx.u, stars: 6000, seed: 55 }); scene.add(sky);
  const SUN = new THREE.Vector3(0.75, 0.22, -0.35).normalize();
  const uniforms = { uSun: { value: SUN }, uTime: { value: 0 }, uCam: { value: new THREE.Vector3() } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: NOISE + HEIGHT + `
      varying vec3 vN; varying vec3 vW; varying float vId; varying float vH; varying float vEdge;
      void main(){
        vec2 p = position.xz; float e = 0.05;
        float h0 = hgt(p), hx = hgt(p+vec2(e,0.0)), hz = hgt(p+vec2(0.0,e));
        vec3 n = normalize(vec3(h0-hx, e, h0-hz));
        vec3 v = voro(vec3(p*0.8,0.0)); vId = v.z; vEdge = v.y - v.x; vH = h0; vN = n;
        vec4 w = modelMatrix*vec4(p.x,h0,p.y,1.0); vW = w.xyz;
        gl_Position = projectionMatrix*viewMatrix*w;
      }`,
    fragmentShader: `
      varying vec3 vN; varying vec3 vW; varying float vId; varying float vH; varying float vEdge;
      uniform vec3 uSun, uCam;
      float hs(float n){ return fract(sin(n*127.1)*43758.5453); }
      void main(){
        vec3 base = mix(vec3(0.62,0.46,0.34), vec3(0.93,0.88,0.80), hs(vId*13.0));
        base = mix(base, vec3(0.86,0.68,0.40), 0.35*hs(vId*7.7));
        base = mix(base, vec3(0.78,0.84,0.92), smoothstep(0.1,0.6,hs(vId*3.1))*0.4);
        base = mix(base, vec3(0.16,0.10,0.08), smoothstep(0.14,0.0,vEdge)*0.85);
        base = pow(base, vec3(2.2));
        float ndl = max(dot(normalize(vN), uSun), 0.0);
        vec3 col = base*(ndl*2.6 + 0.045) + base*vec3(1.0,0.75,0.55)*0.06;
        float dist = length(vW-uCam);
        float fog = 1.0 - exp(-pow(dist/34.0, 2.0));
        gl_FragColor = vec4(mix(col, vec3(0.0), fog), 1.0);
      }`
  });
  const geo = new THREE.PlaneGeometry(70, 80, 520, 600); geo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(geo, mat); ground.frustumCulled = false; scene.add(ground);

  const jup = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), new THREE.MeshStandardMaterial({ map: assets.jupiter, roughness: 1 }));
  scene.add(jup);
  const atm = makeAtmosphere(1.03, [0.95, 0.78, 0.6], 2.6, 0.5); scene.add(atm);
  const key = new THREE.DirectionalLight(0xfff4e6, 3.2); key.position.copy(SUN).multiplyScalar(50); scene.add(key);
  scene.add(new THREE.AmbientLight(0x202840, 0.12));

  const camera = new THREE.PerspectiveCamera(42, ctx.aspect, 0.05, 400);
  return {
    scene, camera, sky, bloom: { strength: 0.3, radius: 0.5, threshold: 0.95 }, exposure: 1.15,
    update(p, lt, dur) {
      const z = lerp(14, -22, easeIO(p));
      const alt = 1.5 + 0.3 * Math.sin(p * 5) + (ctx.portrait ? 0.4 : 0);
      camera.position.set(lerp(-1.5, 1.5, p), 0, z);
      // keep the camera above the local surface (cheap approximation: sample is done on GPU, so use generous altitude)
      camera.position.y = alt + 1.8;
      camera.lookAt(camera.position.x + 0.8, 0.6, z - 14);
      ground.position.set(0, 0, 0);
      uniforms.uCam.value.copy(camera.position);
      jup.scale.setScalar(ctx.portrait ? 30 : 24);
      jup.position.set(camera.position.x - 34, 36, z - 150);
      jup.rotation.y = lt * 0.01;
      atm.scale.copy(jup.scale); atm.position.copy(jup.position);
    },
    hud(g, V, p, lt, dur, opts) {
      const out = 1 - sstep(0.94, 0.99, p);
      lowerThird(g, V, { kicker: 'Chaos terrain', head: 'Rafts of broken ice', p: seg(p, 0.06, 0.16), alpha: (1 - sstep(0.55, 0.65, p)) });
      const a = sstep(0.04, 0.12, p) * out;
      T(g, V, "ARTIST'S VISUALISATION  ·  NOT A PHOTOGRAPH", V.w / 2, V.portrait ? V.h - 120 : V.h - 60, { size: 17, color: COL.gold, weight: 700, align: 'center', track: 3, alpha: a });
    }
  };
}
