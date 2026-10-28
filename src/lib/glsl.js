// Shared GLSL snippets. Simplex noise: Ashima Arts / Ian McEwan (MIT licence).

export const NOISE = /* glsl */ `
const float PI = 3.14159265359;
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float hash11(float n){return fract(sin(n*127.1)*43758.5453123);}
float hash31(vec3 p){p=fract(p*0.3183099+0.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
vec3 hash33(vec3 p){
  p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));
  return fract(sin(p)*43758.5453123);
}
float fbm(vec3 p,int oct){
  float a=0.5,s=0.0;
  for(int i=0;i<8;i++){ if(i>=oct)break; s+=a*snoise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; }
  return s*0.5+0.5;
}
/** Worley noise: x=F1, y=F2, z=random id of nearest cell */
vec3 voro(vec3 p){
  vec3 ip=floor(p); vec3 fp=fract(p);
  float f1=8.0,f2=8.0,id=0.0;
  for(int k=-1;k<=1;k++)for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
    vec3 g=vec3(float(i),float(j),float(k));
    vec3 o=hash33(ip+g);
    vec3 d=g+o-fp; float dd=dot(d,d);
    if(dd<f1){f2=f1;f1=dd;id=hash31(ip+g+7.0);} else if(dd<f2){f2=dd;}
  }
  return vec3(sqrt(f1),sqrt(f2),id);
}
vec3 dirFromUv(vec2 uv){ float phi=uv.x*2.0*PI; float th=(1.0-uv.y)*PI; return vec3(-cos(phi)*sin(th),cos(th),sin(phi)*sin(th)); }
vec3 dirAzLat(float az,float lat){ float phi=radians(az); float th=radians(90.0-lat); return vec3(-cos(phi)*sin(th),cos(th),sin(phi)*sin(th)); }
`;

export const BAKE_VERT = /* glsl */ `
out vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// ---------------------------------------------------------------- Europa (MRT: colour, height, CO2 mask)
export const EUROPA_FRAG = /* glsl */ `
in vec2 vUv;
layout(location = 1) out highp vec4 gHeight;
layout(location = 2) out highp vec4 gMask;
uniform vec3 uLines[9];
uniform vec3 uTara; uniform vec3 uPowys; uniform vec3 uLead;
uniform float uTaraR; uniform float uPowysR;

void chaos(vec3 p, vec3 c, float rad, float seed, inout vec3 col, inout float h, out float m){
  float ang = acos(clamp(dot(p,c),-1.0,1.0));
  float edge = ang + 0.10*snoise(p*4.0+seed) + 0.045*snoise(p*11.0+seed);
  m = smoothstep(rad, rad*0.70, edge);
  if(m>0.001){
    vec3 v = voro(p*17.0 + seed);                       /* ice rafts */
    vec3 v2 = voro(p*52.0 + seed*2.0);                  /* finer breccia */
    float seam = smoothstep(0.10, 0.0, v.y - v.x);
    float seam2 = smoothstep(0.08, 0.0, v2.y - v2.x);
    float id = v.z;
    vec3 base = mix(vec3(0.66,0.47,0.33), vec3(0.88,0.74,0.58), hash11(id*17.0));
    base = mix(base, vec3(0.86,0.66,0.34), 0.45*hash11(id*5.1+seed));   /* yellowish: irradiated NaCl (Hubble 2019) */
    base *= 0.88 + 0.24*v2.z;
    vec3 cc = mix(base, vec3(0.20,0.12,0.09), clamp(seam*0.9 + seam2*0.35, 0.0, 1.0));
    col = mix(col, cc, m);
    h = mix(h, 0.50 + 0.32*id - seam*0.22 - seam2*0.05, m);
  }
}

void main(){
  vec3 p = dirFromUv(vUv);
  float lowf = fbm(p*2.6+1.7, 4);
  float mid  = fbm(p*7.0, 4);
  vec3 ice = mix(vec3(0.58,0.66,0.78), vec3(0.97,0.98,1.0), smoothstep(0.30,0.72,lowf));
  ice *= 0.90 + 0.18*mid;
  float trail = smoothstep(0.30,-0.80,dot(p,uLead));            /* trailing hemisphere: radiolytic sulfur tint */
  ice = mix(ice, vec3(0.70,0.56,0.46), trail*0.45);

  float lin=0.0, linH=0.0, broad=0.0;
  for(int i=0;i<9;i++){
    vec3 n = normalize(uLines[i]);
    float fi = float(i);
    float wob = 0.05*snoise(p*3.0+fi*7.3) + 0.012*snoise(p*14.0+fi);
    float d = abs(dot(p,n)+wob);
    float w = mix(0.006,0.016,hash11(fi+1.0));
    lin   = max(lin,   smoothstep(w,w*0.2,d)*(0.7+0.3*hash11(fi+3.0)));
    broad = max(broad, smoothstep(w*6.0,0.0,d)*(0.18+0.22*hash11(fi+8.0)));
    linH  = max(linH,  smoothstep(w*3.5,0.0,d));
  }
  vec3 q = p*11.0 + 0.8*vec3(snoise(p*4.0),snoise(p*4.0+9.1),snoise(p*4.0+3.3));
  float crack = smoothstep(0.945,1.0,1.0-abs(snoise(q)))*0.9;
  float cr2 = 1.0-abs(snoise(p*26.0+vec3(snoise(p*9.0))));
  crack = max(crack, smoothstep(0.960,1.0,cr2)*0.6);

  vec3 brown = vec3(0.44,0.24,0.15);
  vec3 col = mix(ice, mix(ice, vec3(0.60,0.40,0.30), 0.7), broad);
  col = mix(col, brown, clamp(lin*0.95+crack*0.6,0.0,1.0));
  float mott = smoothstep(0.52,0.78,fbm(p*4.0+5.0,4));
  col = mix(col, vec3(0.62,0.46,0.36), mott*0.38);
  float h = 0.45 + 0.07*(lowf-0.5) + 0.05*mid + linH*0.10 - lin*0.08 - crack*0.04;

  float mT, mP;
  chaos(p, uTara,  uTaraR,  3.0, col, h, mT);
  chaos(p, uPowys, uPowysR, 11.0, col, h, mP);

  /* CO2 concentration map (illustrative; shaped after the published Tara/Powys Regio maps) */
  float patchy = 0.65 + 0.35*fbm(p*14.0+2.0,3);
  float cT = smoothstep(0.30,0.95,mT) * patchy;
  float cP = smoothstep(0.30,0.95,mP) * patchy * 0.55;
  float co2 = max(cT,cP);

  gColor = vec4(pow(col, vec3(2.2)),1.0);              /* authored in sRGB, stored linear */
  gHeight = vec4(vec3(clamp(h,0.0,1.0)),1.0);
  gMask = vec4(co2,mT,mP,1.0);
}
`;

// ---------------------------------------------------------------- Jupiter
export const JUPITER_FRAG = /* glsl */ `
in vec2 vUv;
uniform vec3 uGRS;
void main(){
  vec3 p = dirFromUv(vUv);
  float lat = asin(clamp(p.y,-1.0,1.0));
  vec3 s = vec3(p.x*2.2, p.y*9.0, p.z*2.2);
  float turb = fbm(s+vec3(0.0,3.0,0.0),5);
  float turb2 = fbm(vec3(p.x*7.0,p.y*30.0,p.z*7.0),4);
  float band = sin(lat*17.0 + turb*3.2 + 0.6*sin(lat*43.0));
  float b2 = sin(lat*29.0 + turb2*2.4);
  vec3 cream = vec3(0.90,0.83,0.70), tan_ = vec3(0.80,0.62,0.44), brown = vec3(0.56,0.36,0.26), white = vec3(0.96,0.92,0.85);
  vec3 col = mix(tan_, cream, smoothstep(-0.7,0.7,band));
  col = mix(col, brown, smoothstep(0.55,1.0,-band)*0.7);
  col = mix(col, white, smoothstep(0.35,0.9,b2*band)*0.35);
  col *= 0.88 + 0.22*turb2;
  vec3 g = normalize(uGRS);
  float dphi = atan(p.z,-p.x) - atan(g.z,-g.x); dphi = atan(sin(dphi),cos(dphi));
  float dlat = lat - asin(g.y);
  float e = length(vec2(dphi*cos(lat)/0.20, dlat/0.085));
  float swirl = snoise(vec3(dphi*9.0+e*2.0, dlat*16.0, 1.0));
  vec3 spot = mix(vec3(0.74,0.30,0.20), vec3(0.88,0.55,0.40), 0.5+0.5*swirl);
  col = mix(col, spot, smoothstep(1.0,0.55,e));
  col = mix(col, col*0.85, smoothstep(1.15,1.0,e)*smoothstep(0.85,1.15,e)*0.7);
  col *= 1.0 - 0.28*pow(abs(p.y),4.0);
  gColor = vec4(pow(col,vec3(2.2)),1.0);
}
`;

// ---------------------------------------------------------------- Earth / Moon (only seen small)
export const EARTH_FRAG = /* glsl */ `
in vec2 vUv;
void main(){
  vec3 p = dirFromUv(vUv);
  float land = fbm(p*2.2+4.0,6);
  float lat = abs(p.y);
  float isLand = smoothstep(0.50,0.54,land);
  vec3 ocean = mix(vec3(0.02,0.08,0.25), vec3(0.04,0.22,0.5), smoothstep(0.2,0.5,land));
  vec3 ground = mix(vec3(0.20,0.40,0.14), vec3(0.62,0.52,0.32), smoothstep(0.55,0.75,fbm(p*5.0,4)));
  vec3 col = mix(ocean, ground, isLand);
  float ice = smoothstep(0.80,0.92,lat+0.05*snoise(p*8.0));
  col = mix(col, vec3(0.95), ice);
  float cloud = smoothstep(0.52,0.78,fbm(p*3.5+vec3(0.0,7.0,0.0),5));
  col = mix(col, vec3(1.0), cloud*0.75);
  gColor = vec4(pow(col,vec3(2.2)),1.0);
}
`;
export const MOON_FRAG = /* glsl */ `
in vec2 vUv;
void main(){
  vec3 p = dirFromUv(vUv);
  float mare = smoothstep(0.45,0.6,fbm(p*1.6+2.0,4));
  vec3 col = mix(vec3(0.62), vec3(0.30,0.30,0.32), mare);
  vec3 v = voro(p*9.0); float rim = smoothstep(0.30,0.24,v.x)*smoothstep(0.15,0.30,v.x);
  vec3 v2 = voro(p*22.0); float rim2 = smoothstep(0.32,0.26,v2.x)*smoothstep(0.12,0.3,v2.x);
  col *= 1.0 - 0.18*hash11(v.z*10.0)*smoothstep(0.3,0.0,v.x);
  col += 0.10*rim + 0.07*rim2;
  col *= 0.85 + 0.3*fbm(p*14.0,4);
  gColor = vec4(pow(col,vec3(2.2)),1.0);
}
`;

// ---------------------------------------------------------------- Sky (faint Milky-Way style nebulosity, equirect)
export const SKY_FRAG = /* glsl */ `
in vec2 vUv;
void main(){
  vec3 p = dirFromUv(vUv);
  vec3 axis = normalize(vec3(0.3,0.9,0.35));
  float b = dot(p,axis);
  float band = exp(-b*b*14.0);
  float n = fbm(p*3.2,6);
  float dust = smoothstep(0.45,0.7,fbm(p*6.0+9.0,5));
  float glow = band*(0.25+0.55*n)*(1.0-0.5*dust);
  vec3 col = vec3(0.0025,0.003,0.006) + glow*vec3(0.020,0.019,0.028);
  col += band*pow(n,3.0)*vec3(0.012,0.009,0.006);
  col += 0.003*fbm(p*1.3+3.0,3)*vec3(0.15,0.2,0.5);
  gColor = vec4(col,1.0);
}
`;
