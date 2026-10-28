import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { NOISE, BAKE_VERT, EUROPA_FRAG, JUPITER_FRAG, EARTH_FRAG, MOON_FRAG, SKY_FRAG } from './glsl.js';
import { dirAzLat, REGIONS, mulberry32 } from './util.js';

/** Bake a procedural shader into (MRT) render-target textures. Done once per page, resolution independent of the screen. */
function bake(renderer, { w, h, frag, count = 1, uniforms = {}, spaces = [THREE.SRGBColorSpace] }) {
  const rt = new THREE.WebGLRenderTarget(w, h, {
    count, type: THREE.UnsignedByteType, format: THREE.RGBAFormat, depthBuffer: false,
    minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true,
    wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping, anisotropy: 8
  });
  rt.textures.forEach((t, i) => {
    t.colorSpace = spaces[i] ?? THREE.NoColorSpace;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8;
  });
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: BAKE_VERT, fragmentShader: 'layout(location = 0) out highp vec4 gColor;\n' + NOISE + frag,
    uniforms, depthTest: false, depthWrite: false
  });
  const scene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  scene.add(quad);
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(rt);
  renderer.render(scene, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
  renderer.setRenderTarget(prev);
  quad.geometry.dispose(); mat.dispose();
  return rt;
}

export class Assets {
  constructor(renderer, { bakeScale = 1, anisotropy = 8 } = {}) {
    this.r = renderer; this.s = bakeScale; this.cache = {};
    this.anisotropy = Math.min(anisotropy, renderer.capabilities.getMaxAnisotropy());
  }
  _memo(k, f) { return (this.cache[k] ??= f()); }
  sz(w, h) { return [Math.max(256, Math.round(w * this.s)), Math.max(128, Math.round(h * this.s))]; }

  /** { map, bump, co2 } for Europa */
  get europa() {
    return this._memo('europa', () => {
      const rnd = mulberry32(42);
      const lines = Array.from({ length: 9 }, () => new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize());
      const [w, h] = this.sz(4096, 2048);
      const rt = bake(this.r, {
        w, h, frag: EUROPA_FRAG, count: 3,
        spaces: [THREE.SRGBColorSpace, THREE.NoColorSpace, THREE.NoColorSpace],
        uniforms: {
          uLines: { value: lines },
          uTara: { value: dirAzLat(REGIONS.tara.az, REGIONS.tara.lat) },
          uPowys: { value: dirAzLat(REGIONS.powys.az, REGIONS.powys.lat) },
          uLead: { value: dirAzLat(REGIONS.leading.az, REGIONS.leading.lat) },
          uTaraR: { value: REGIONS.tara.radius }, uPowysR: { value: REGIONS.powys.radius }
        }
      });
      return { map: rt.textures[0], bump: rt.textures[1], co2: rt.textures[2] };
    });
  }
  get jupiter() {
    return this._memo('jupiter', () => {
      const [w, h] = this.sz(2048, 1024);
      return bake(this.r, { w, h, frag: JUPITER_FRAG, uniforms: { uGRS: { value: dirAzLat(120, -22) } } }).texture;
    });
  }
  get earth() { return this._memo('earth', () => { const [w, h] = this.sz(1024, 512); return bake(this.r, { w, h, frag: EARTH_FRAG }).texture; }); }
  get moon() { return this._memo('moon', () => { const [w, h] = this.sz(1024, 512); return bake(this.r, { w, h, frag: MOON_FRAG }).texture; }); }
  get sky() {
    return this._memo('sky', () => {
      const [w, h] = this.sz(2048, 1024);
      const tex = bake(this.r, { w, h, frag: SKY_FRAG, spaces: [THREE.SRGBColorSpace] }).texture;
      tex.mapping = THREE.EquirectangularReflectionMapping;
      return tex;
    });
  }
  /** studio-style reflections for the metallic spacecraft models */
  get env() {
    return this._memo('env', () => {
      const pm = new THREE.PMREMGenerator(this.r);
      const t = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      pm.dispose();
      return t;
    });
  }
}

/** Soft round stars that follow the camera (infinitely far). */
export function makeStars({ count = 7000, seed = 7, size = 1.0, u = 1 } = {}) {
  const rnd = mulberry32(seed);
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), sz = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const z = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z);
    pos.set([r * Math.cos(a), z, r * Math.sin(a)], i * 3);
    const t = rnd();
    const c = t < 0.15 ? [0.7, 0.8, 1.0] : t < 0.8 ? [1, 1, 1] : [1.0, 0.85, 0.7];
    const b = Math.pow(rnd(), 3.2) * 0.95 + 0.05;
    col.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
    sz[i] = (0.9 + Math.pow(rnd(), 6) * 3.2) * size;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('size', new THREE.BufferAttribute(sz, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: { uScale: { value: u } },
    vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC; uniform float uScale;
      void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=size*uScale*2.0; }`,
    fragmentShader: `varying vec3 vC; void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d)*2.0; float a=smoothstep(1.0,0.0,r); a=a*a; gl_FragColor=vec4(vC*a*1.6,a); }`
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false; pts.renderOrder = -90;
  return pts;
}

/** Backdrop: nebula sphere + stars, pinned to the camera each frame. */
export function makeSky(assets, { u = 1, seed = 7, stars = 7000 } = {}) {
  const grp = new THREE.Group();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 24),
    new THREE.MeshBasicMaterial({ map: assets.sky, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false })
  );
  dome.renderOrder = -100; dome.frustumCulled = false;
  grp.add(dome, makeStars({ u, seed, count: stars }));
  grp.userData.follow = (camera) => { grp.position.copy(camera.position); grp.scale.setScalar(camera.far * 0.45); };
  return grp;
}

/** Pixelated (NIRSpec-IFU-like) CO2 map overlay on a unit sphere. Uses Europa's baked mask. */
export function makeCo2Overlay(maskTex) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.FrontSide,
    uniforms: {
      uMask: { value: maskTex }, uAmount: { value: 0 }, uPixel: { value: 1 }, uGrid: { value: 0 },
      uCells: { value: new THREE.Vector2(32, 16) }, uTime: { value: 0 }, uScan: { value: -1 }
    },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv=uv; vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      uniform sampler2D uMask; uniform float uAmount,uPixel,uGrid,uTime,uScan; uniform vec2 uCells;
      void main(){
        vec2 cell=floor(vUv*uCells); vec2 cuv=(cell+0.5)/uCells;
        vec2 uv=mix(vUv,cuv,uPixel);
        float m=texture2D(uMask,uv).r;
        float tw=0.85+0.15*sin(uTime*3.0+cell.x*1.7+cell.y*2.3);
        float a=smoothstep(0.06,0.55,m*uAmount);
        vec3 c=mix(vec3(0.03,0.75,0.62),vec3(0.80,1.0,0.88),smoothstep(0.35,1.0,m));
        float fr=pow(1.0-abs(dot(normalize(vN),normalize(vV))),1.5);
        vec2 f=fract(vUv*uCells);
        float line=(step(f.x,0.045)+step(f.y,0.07))*uGrid;
        float scan=uScan<0.0?0.0:smoothstep(0.06,0.0,abs(vUv.x*uCells.x/uCells.x-uScan))*uGrid*1.5;
        float alpha=clamp(a*0.62*tw+line*0.12*(0.35+a)+scan*0.2,0.0,0.7);
        gl_FragColor=vec4(c*(0.62+0.25*fr)+line*0.12,alpha);
      }`
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1.004, 128, 64), mat);
  mesh.renderOrder = 5;
  return mesh;
}

/** Planet with soft atmosphere shell. */
export function makeAtmosphere(radius, color = [0.55, 0.7, 1.0], power = 3.0, strength = 1.0) {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    uniforms: { uC: { value: new THREE.Vector3(...color) }, uP: { value: power }, uS: { value: strength }, uL: { value: new THREE.Vector3(1, 0.3, 0.5).normalize() } },
    vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vW; uniform vec3 uC,uL; uniform float uP,uS;
      void main(){ vec3 v=normalize(cameraPosition-vW); float f=pow(clamp(dot(-vN,v)*1.0,0.0,1.0),uP); float lit=0.35+0.65*smoothstep(-0.4,0.6,dot(normalize(-vN*-1.0),uL)); gl_FragColor=vec4(uC*f*uS*lit,f*uS*lit); }`
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 32), m);
}
