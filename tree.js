import * as THREE from 'three';
import { renderer, camera, controls } from './core.js';
import { sceneMix } from './audio.js';

// ---------------------------------------------------------------- seasons
const SEASONS = [
  { name: '春', bg: '#f7dce8', nightBg: '#2b2648', leaves: ['#c24f7c', '#ec8db0', '#ffd4e3'], shape: 1, trunk: '#8a9cc0',
    ground: '#7cc78f', grassBase: '#3f9a6a', grassTip: '#b4e58a', shadow: '#9a6f9a', rate: 18, size: 1.0 },
  { name: '夏', bg: '#cde8f4', nightBg: '#142a44', leaves: ['#1c6450', '#3a9a5c', '#a6d75c'], shape: 0, trunk: '#6b5040',
    ground: '#58b173', grassBase: '#2f8257', grassTip: '#9fdc6a', shadow: '#3f6f80', rate: 3, size: 1.0 },
  { name: '秋', bg: '#f6e4c8', nightBg: '#2a2340', leaves: ['#a3301d', '#e26f2a', '#f5c246'], shape: 0, trunk: '#5c4033',
    ground: '#c7b25c', grassBase: '#8c7a32', grassTip: '#e8c96a', shadow: '#8a5a3a', rate: 30, size: 1.0 },
  { name: '冬', bg: '#4d8ed8', nightBg: '#0f244c', leaves: ['#9ab2d8', '#e1ebf7', '#ffffff'], shape: 2, trunk: '#3d3946',
    ground: '#eef3fa', grassBase: '#bfcfe6', grassTip: '#ffffff', shadow: '#1f4c8c', rate: 7, size: 1.15 },
];
for (const s of SEASONS) {
  for (const k of ['bg', 'nightBg', 'trunk', 'ground', 'grassBase', 'grassTip', 'shadow']) s[k] = new THREE.Color(s[k]);
  s.leaves = s.leaves.map(c => new THREE.Color(c));
}

const LEAF_COUNT = 16000;
const MAX_PARTICLES = 7000;
const TRANSITION = 4.5; // seconds for a full season change
const WIN = 0.12;       // per-leaf change window inside the 0..1 progress

const scene = new THREE.Scene();
scene.background = new THREE.Color();

const LIGHT_DIR = new THREE.Vector3(7, 3.6, 2.6).normalize();
const sun = new THREE.DirectionalLight(0xffffff, 2.0);
sun.position.copy(LIGHT_DIR).multiplyScalar(25);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 14, bottom: -14, near: 1, far: 70 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xffffff, 0x9aa3b8, 1.2);
scene.add(hemi);

const toonRamp = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
toonRamp.minFilter = toonRamp.magFilter = THREE.NearestFilter;
toonRamp.needsUpdate = true;

// ---------------------------------------------------------------- shared uniforms
const U = {
  uTime: { value: 0 },
  uWind: { value: 0.45 },
  uWindDir: { value: new THREE.Vector3(-1, 0, 0.25).normalize() },
  uLightDir: { value: LIGHT_DIR },
  uProg: { value: 0 },
  uGrow: { value: 0 },
  uFA: { value: new THREE.Color() }, uFB: { value: new THREE.Color() }, uFC: { value: new THREE.Color() },
  uTA: { value: new THREE.Color() }, uTB: { value: new THREE.Color() }, uTC: { value: new THREE.Color() },
  uFShape: { value: 0 }, uTShape: { value: 0 },
  uFSize: { value: 1 }, uTSize: { value: 1 },
  uGrassBase: { value: new THREE.Color() }, uGrassTip: { value: new THREE.Color() },
  uNight: { value: 0 },
  uBreath: { value: 0 },
  uCanopyC: { value: new THREE.Vector3(0, 5, 0) },
};
const NIGHT_GLSL = 'vec3(0.30, 0.36, 0.62)';

const SHAPE_GLSL = /* glsl */`
float leafMask(vec2 p, float shape) {
  if (shape < 0.5) {            // pointed leaf
    float w = 0.62 * sqrt(max(1.0 - p.y * p.y, 0.0)) * (1.0 - 0.22 * p.y);
    return step(abs(p.x), w);
  } else if (shape < 1.5) {     // blossom petal with a notch
    float d = length(p * vec2(1.0, 1.08) + vec2(0.0, 0.08));
    float notch = step(0.5, p.y) * step(abs(p.x), (p.y - 0.5) * 0.55);
    return step(d, 0.86) * (1.0 - notch);
  }
  float a = atan(p.y, p.x);     // lumpy snow clump
  return step(length(p), 0.8 + 0.1 * sin(a * 5.0) + 0.05 * sin(a * 9.0));
}`;

const WIND_GLSL = /* glsl */`
uniform float uTime, uWind;
uniform vec3 uWindDir;
vec3 windOffset(vec3 p, float r) {
  float h = max(p.y - 1.5, 0.0);
  float sway = sin(uTime * 1.3 + p.x * 0.35 + p.z * 0.2) * 0.5 + 0.5;
  vec3 o = uWindDir * uWind * 0.05 * h * (0.4 + 0.6 * sway);
  o += vec3(sin(uTime * 3.1 + r * 40.0), cos(uTime * 2.7 + r * 31.0), sin(uTime * 3.4 + r * 17.0))
       * 0.025 * (0.25 + uWind);
  return o;
}`;

// ---------------------------------------------------------------- canopy leaves
const LEAF_VERT = /* glsl */`
${WIND_GLSL}
uniform float uProg, uGrow, uFShape, uTShape, uFSize, uTSize;
uniform vec3 uLightDir, uFA, uFB, uFC, uTA, uTB, uTC, uCanopyC;
uniform float uNight, uBreath;
attribute vec3 aOffset;
attribute vec3 aNrm;
attribute vec4 aRand;   // size, rotation, colour jitter, season threshold
attribute vec2 aMeta;   // depth in cluster (0 inner .. 1 surface), grow threshold
varying vec2 vUv;
varying vec3 vCol;
varying float vShape;
void main() {
  float k = clamp((uProg - aRand.w) / ${WIN.toFixed(3)}, 0.0, 1.0);
  bool isNew = k >= 0.5;
  // the old leaf shrinks away, the new one pops back in
  float pop = isNew ? smoothstep(0.5, 1.0, k) : 1.0 - smoothstep(0.0, 0.5, k);
  float grow = smoothstep(aMeta.y, aMeta.y + 0.15, uGrow);
  float size = aRand.x * pop * grow * (isNew ? uTSize : uFSize);

  vec3 wp = (modelMatrix * vec4(aOffset, 1.0)).xyz;
  wp = uCanopyC + (wp - uCanopyC) * (1.0 + 0.035 * uBreath); // the canopy breathes
  wp += windOffset(wp, aRand.z);
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  float c = cos(aRand.y), s = sin(aRand.y);
  vec2 q = position.xy;
  mv.xy += vec2(c * q.x - s * q.y, s * q.x + c * q.y) * size;
  gl_Position = projectionMatrix * mv;
  vUv = position.xy * 2.0;
  vShape = isNew ? uTShape : uFShape;

  float shade = dot(normalize(aNrm), uLightDir) * 0.5 + 0.5;
  shade = shade * 0.72 + aMeta.x * 0.42 - 0.16 + (aRand.z - 0.5) * 0.24;
  vec3 A = isNew ? uTA : uFA, B = isNew ? uTB : uFB, C = isNew ? uTC : uFC;
  vCol = shade < 0.42 ? A : (shade < 0.7 ? B : C);
  vCol *= (0.9 + 0.2 * fract(aRand.z * 7.31)) * (1.0 + 0.12 * uBreath);
  vCol = mix(vCol, vCol * ${NIGHT_GLSL}, uNight);
}`;

const LEAF_FRAG = /* glsl */`
varying vec2 vUv;
varying vec3 vCol;
varying float vShape;
${SHAPE_GLSL}
void main() {
  if (leafMask(vUv, vShape) < 0.5) discard;
  gl_FragColor = vec4(vCol, 1.0);
  #include <colorspace_fragment>
}`;

const LEAF_DEPTH_FRAG = /* glsl */`
#include <packing>
varying vec2 vUv;
varying float vShape;
${SHAPE_GLSL}
void main() {
  if (leafMask(vUv, vShape) < 0.5) discard;
  gl_FragColor = packDepthToRGBA(gl_FragCoord.z);
}`;

const leafMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: LEAF_VERT, fragmentShader: LEAF_FRAG, side: THREE.DoubleSide });
const leafDepthMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: LEAF_VERT, fragmentShader: LEAF_DEPTH_FRAG, side: THREE.DoubleSide });

// ---------------------------------------------------------------- tree builder
function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function buildTree(seed) {
  const rnd = mulberry32(seed);
  const V = THREE.Vector3;
  const branches = [], clusters = [];
  const MAXD = 3;

  function grow(start, dir, len, r, depth) {
    const pts = [start.clone()];
    let p = start.clone();
    const d = dir.clone();
    const jit = depth === 0 ? 0.1 : 0.35;
    for (let i = 1; i <= 4; i++) {
      d.add(new V((rnd() - 0.5) * jit, (rnd() - 0.5) * jit * 0.4 + 0.03, (rnd() - 0.5) * jit)).normalize();
      p = p.clone().addScaledVector(d, len / 4);
      pts.push(p);
    }
    const r1 = r * 0.6;
    branches.push({ pts, r0: r, r1, depth });
    if (depth >= 1) clusters.push({ c: p.clone().add(new V(0, 0.3, 0)), r: (depth === MAXD ? 1.15 : 1.45) * (0.85 + rnd() * 0.3) });
    if (depth >= MAXD) return;
    const n = depth === 0 ? 3 : (rnd() < 0.55 ? 2 : 3);
    const base = rnd() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const ang = base + i / n * Math.PI * 2 + (rnd() - 0.5) * 0.8;
      const tilt = (depth === 0 ? 0.95 : 0.75) + (rnd() - 0.5) * 0.4;
      const nd = new V(Math.cos(ang) * Math.sin(tilt), Math.cos(tilt), Math.sin(ang) * Math.sin(tilt)).lerp(d, 0.3).normalize();
      grow(p, nd, len * (0.6 + rnd() * 0.15), r1, depth + 1);
    }
  }
  grow(new V(0, 0, 0), new V(0, 1, 0), 3.0, 0.34, 0);

  // tapered tubes, merged
  const pos = [], nor = [], idx = [];
  for (const b of branches) {
    const curve = new THREE.CatmullRomCurve3(b.pts);
    const segs = 10, rad = b.depth < 2 ? 10 : 6;
    const frames = curve.computeFrenetFrames(segs, false);
    const base = pos.length / 3;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const P = curve.getPointAt(t);
      let r = THREE.MathUtils.lerp(b.r0, b.r1, t);
      if (b.depth === 0) r *= 1 + 0.7 * Math.exp(-t * 14);
      const N = frames.normals[i], B = frames.binormals[i];
      for (let j = 0; j <= rad; j++) {
        const a = j / rad * Math.PI * 2;
        const n = new V().addScaledVector(N, Math.cos(a)).addScaledVector(B, Math.sin(a));
        pos.push(P.x + n.x * r, P.y + n.y * r, P.z + n.z * r);
        nor.push(n.x, n.y, n.z);
      }
    }
    for (let i = 0; i < segs; i++) for (let j = 0; j < rad; j++) {
      const a = base + i * (rad + 1) + j, c = a + rad + 1;
      idx.push(a, a + 1, c, a + 1, c + 1, c);
    }
  }
  const trunkGeo = new THREE.BufferGeometry();
  trunkGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  trunkGeo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  trunkGeo.setIndex(idx);

  // leaves scattered through the cluster spheres
  const cc = new V(); let wsum = 0;
  const cum = clusters.map(c => { const w = c.r * c.r; cc.addScaledVector(c.c, w); return wsum += w; });
  cc.divideScalar(wsum);

  const N = LEAF_COUNT;
  const offs = new Float32Array(N * 3), nrm = new Float32Array(N * 3);
  const rand = new Float32Array(N * 4), meta = new Float32Array(N * 2);
  const ys = new Float32Array(N);
  const p = new V(), dir = new V(), out = new V();
  let ymin = Infinity, ymax = -Infinity;
  for (let i = 0; i < N; i++) {
    let rr, c;
    do {
      const pick = rnd() * wsum;
      c = clusters[cum.findIndex(v => v >= pick)];
      dir.set(gauss(rnd), gauss(rnd), gauss(rnd)).normalize();
      rr = c.r * (0.45 + 0.55 * Math.pow(rnd(), 0.4));
      if (dir.y < -0.2) rr *= 0.8;
      p.copy(c.c).addScaledVector(dir, rr);
    } while (p.y < 2.4);
    out.subVectors(p, cc).normalize();
    const n = dir.clone().multiplyScalar(0.65).addScaledVector(out, 0.6).normalize();
    offs.set([p.x, p.y, p.z], i * 3);
    nrm.set([n.x, n.y, n.z], i * 3);
    rand.set([0.17 + rnd() * 0.13, rnd() * Math.PI * 2, rnd(), 0], i * 4);
    meta[i * 2] = (rr / c.r - 0.45) / 0.55;
    ys[i] = p.y;
    ymin = Math.min(ymin, p.y); ymax = Math.max(ymax, p.y);
  }
  const th = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const hN = (ys[i] - ymin) / (ymax - ymin);
    th[i] = (1 - WIN - 0.02) * (0.6 * rnd() + 0.4 * (1 - hN)); // top changes first, cascading down
    rand[i * 4 + 3] = th[i];
    meta[i * 2 + 1] = 0.82 * (0.55 * hN + 0.45 * rnd());       // grows bottom-up
  }

  const plane = new THREE.PlaneGeometry(1, 1);
  const leafGeo = new THREE.InstancedBufferGeometry();
  leafGeo.index = plane.index;
  leafGeo.setAttribute('position', plane.getAttribute('position'));
  leafGeo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offs, 3));
  leafGeo.setAttribute('aNrm', new THREE.InstancedBufferAttribute(nrm, 3));
  leafGeo.setAttribute('aRand', new THREE.InstancedBufferAttribute(rand, 4));
  leafGeo.setAttribute('aMeta', new THREE.InstancedBufferAttribute(meta, 2));
  leafGeo.instanceCount = N;

  const box = new THREE.Box3().setFromArray(offs);
  return { trunkGeo, leafGeo, offs, th, rand, box };
}

function gauss(rnd) {
  return Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
}

// ---------------------------------------------------------------- ground
const DISC_R = a => 3.6 + 0.35 * Math.sin(a * 3 + 1) + 0.2 * Math.sin(a * 5 + 2) + 0.12 * Math.sin(a * 9);
const GROUND_Y = 0.12;

const shadowMat = new THREE.ShadowMaterial({ opacity: 0.32, color: new THREE.Color() });
const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), shadowMat);
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);

const discShape = new THREE.Shape();
for (let i = 0; i <= 96; i++) {
  const a = i / 96 * Math.PI * 2, r = DISC_R(a);
  // shape lives in XY and is rotated onto XZ, so y maps to -z
  i ? discShape.lineTo(Math.cos(a) * r, -Math.sin(a) * r) : discShape.moveTo(Math.cos(a) * r, -Math.sin(a) * r);
}
const discGeo = new THREE.ExtrudeGeometry(discShape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.06, bevelSegments: 2, curveSegments: 4 });
discGeo.rotateX(-Math.PI / 2);
const groundMat = new THREE.MeshToonMaterial({ color: new THREE.Color(), gradientMap: toonRamp });
const disc = new THREE.Mesh(discGeo, groundMat);
disc.position.y = 0.0;
disc.receiveShadow = true;
scene.add(disc);

// grass tufts
{
  const blade = new THREE.BufferGeometry();
  blade.setAttribute('position', new THREE.Float32BufferAttribute([-0.04, 0, 0, 0.04, 0, 0, 0, 1, 0], 3));
  const G = 7000, rnd = mulberry32(7);
  const gp = new Float32Array(G * 3), gr = new Float32Array(G * 2);
  for (let i = 0; i < G; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * (DISC_R(a) - 0.1);
    gp.set([Math.cos(a) * r, GROUND_Y - 0.01, Math.sin(a) * r], i * 3);
    gr.set([0.1 + rnd() * 0.16 * (1 - 0.5 * r / 3.6), rnd()], i * 2);
  }
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', blade.getAttribute('position'));
  geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(gp, 3));
  geo.setAttribute('aR', new THREE.InstancedBufferAttribute(gr, 2));
  geo.instanceCount = G;
  const mat = new THREE.ShaderMaterial({
    uniforms: U, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      ${WIND_GLSL}
      uniform vec3 uGrassBase, uGrassTip;
      uniform float uNight;
      attribute vec3 aPos;
      attribute vec2 aR;
      varying vec3 vCol;
      void main() {
        float h = position.y;
        float c = cos(aR.y * 6.2832), s = sin(aR.y * 6.2832);
        vec3 p = vec3(c * position.x, h * aR.x, s * position.x);
        vec3 wp = aPos + p;
        wp += uWindDir * h * h * (0.03 + 0.08 * uWind) * (sin(uTime * 2.2 + aPos.x * 1.7 + aPos.z) * 0.5 + 0.8);
        vCol = mix(uGrassBase, uGrassTip, h) * (0.92 + 0.16 * fract(aR.y * 13.7));
        vCol = mix(vCol, vCol * ${NIGHT_GLSL}, uNight);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vCol;
      void main() {
        gl_FragColor = vec4(vCol, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const grass = new THREE.Mesh(geo, mat);
  grass.frustumCulled = false;
  scene.add(grass);
}

// ---------------------------------------------------------------- tree instance
const trunkMat = new THREE.MeshToonMaterial({ color: new THREE.Color(), gradientMap: toonRamp });
let tree = null, trunkMesh = null, leafMesh = null;
let seed = 1 + Math.floor(Math.random() * 1e6);

function plantTree() {
  if (tree) {
    scene.remove(trunkMesh, leafMesh);
    trunkMesh.geometry.dispose();
    leafMesh.geometry.dispose();
  }
  tree = buildTree(seed);
  trunkMesh = new THREE.Mesh(tree.trunkGeo, trunkMat);
  trunkMesh.castShadow = trunkMesh.receiveShadow = true;
  leafMesh = new THREE.Mesh(tree.leafGeo, leafMat);
  leafMesh.customDepthMaterial = leafDepthMat;
  leafMesh.castShadow = true;
  leafMesh.frustumCulled = false;
  scene.add(trunkMesh, leafMesh);
  tree.box.getCenter(U.uCanopyC.value);
  growT = 0;
  fitCamera();
}

function fitCamera() {
  const b = tree.box, size = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  // aim low so the tree sits in the upper part of the screen, clear of the bottom controls
  const target = new THREE.Vector3(c.x * 0.6, c.y * 0.42, c.z * 0.6);
  const span = Math.max(size.x, size.z, 7.5) * 1.15;
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const distV = (b.max.y - target.y) * 1.1 / Math.tan(vfov / 2);
  const distH = (span / 2) / (Math.tan(vfov / 2) * camera.aspect);
  const dist = Math.max(distV, distH) * (camera.aspect < 1 ? 1.3 : 1.25);
  const dir = camera.position.clone().sub(controls.target);
  if (dir.lengthSq() < 1e-4) dir.set(0.25, 0.22, 1);
  camera.position.copy(target).addScaledVector(dir.normalize(), dist);
  controls.target.copy(target);
  controls.maxDistance = dist * 2.2;
}

// ---------------------------------------------------------------- falling particles
const pMat = new THREE.ShaderMaterial({
  uniforms: U, side: THREE.DoubleSide,
  vertexShader: /* glsl */`
    uniform vec3 uLightDir;
    uniform float uNight;
    attribute float aShape;
    varying vec2 vUv;
    varying vec3 vCol;
    varying float vShape;
    void main() {
      vUv = position.xy * 2.0;
      vShape = aShape;
      vec3 n = normalize(mat3(modelMatrix * instanceMatrix) * vec3(0.0, 0.0, 1.0));
      vCol = instanceColor * (0.72 + 0.38 * abs(dot(n, uLightDir)));
      vCol = mix(vCol, vCol * ${NIGHT_GLSL}, uNight);
      gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: LEAF_FRAG,
});
const pGeo = new THREE.PlaneGeometry(1, 1);
const pShape = new Float32Array(MAX_PARTICLES);
pGeo.setAttribute('aShape', new THREE.InstancedBufferAttribute(pShape, 1));
const pMesh = new THREE.InstancedMesh(pGeo, pMat, MAX_PARTICLES);
pMesh.frustumCulled = false;
pMesh.setColorAt(0, new THREE.Color());
scene.add(pMesh);

const P = {
  pos: new Float32Array(MAX_PARTICLES * 3), vel: new Float32Array(MAX_PARTICLES * 3),
  rot: new Float32Array(MAX_PARTICLES * 3), spin: new Float32Array(MAX_PARTICLES * 3),
  state: new Uint8Array(MAX_PARTICLES), life: new Float32Array(MAX_PARTICLES),
  size: new Float32Array(MAX_PARTICLES), phase: new Float32Array(MAX_PARTICLES),
  fallSpeed: new Float32Array(MAX_PARTICLES), next: 0,
};
const zero = new THREE.Matrix4().makeScale(0, 0, 0);
for (let i = 0; i < MAX_PARTICLES; i++) pMesh.setMatrixAt(i, zero);

function spawn(x, y, z, color, shape, size, burst = 0) {
  const i = P.next; P.next = (P.next + 1) % MAX_PARTICLES;
  P.pos.set([x, y, z], i * 3);
  const r = Math.random;
  P.vel.set([(r() - 0.5) * 0.6 + U.uWindDir.value.x * burst, (r() - 0.3) * 0.4, (r() - 0.5) * 0.6], i * 3);
  P.rot.set([r() * 6.3, r() * 6.3, r() * 6.3], i * 3);
  P.spin.set([(r() - 0.5) * 6, (r() - 0.5) * 6, (r() - 0.5) * 4], i * 3);
  P.state[i] = 1;
  P.life[i] = 5 + r() * 5;
  P.size[i] = size;
  P.phase[i] = r() * 100;
  P.fallSpeed[i] = shape === 2 ? 0.85 + r() * 0.3 : shape === 1 ? 0.6 + r() * 0.3 : 0.75 + r() * 0.4;
  pShape[i] = shape;
  pMesh.setColorAt(i, color);
}

const dummy = new THREE.Object3D();
function updateParticles(dt, t, windNow) {
  const wd = U.uWindDir.value;
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const st = P.state[i];
    if (!st) continue;
    const o = i * 3;
    let scale = P.size[i];
    if (st === 1) {
      const ph = P.phase[i];
      const fx = Math.sin(t * 2.3 + ph) * 0.7, fz = Math.cos(t * 1.9 + ph * 1.3) * 0.5;
      const k = Math.min(1, 1.8 * dt);
      P.vel[o] += (wd.x * windNow + fx - P.vel[o]) * k;
      P.vel[o + 2] += (wd.z * windNow + fz - P.vel[o + 2]) * k;
      P.vel[o + 1] += (-P.fallSpeed[i] + Math.sin(t * 3.1 + ph) * 0.35 - P.vel[o + 1]) * k;
      for (let a = 0; a < 3; a++) {
        P.pos[o + a] += P.vel[o + a] * dt;
        P.rot[o + a] += P.spin[o + a] * dt * (0.4 + windNow * 0.3);
      }
      const x = P.pos[o], z = P.pos[o + 2];
      const onDisc = Math.hypot(x, z) < DISC_R(Math.atan2(-z, x));
      const floor = onDisc ? GROUND_Y + 0.02 + Math.random() * 0.01 : 0.01;
      if (P.pos[o + 1] <= floor) {
        P.pos[o + 1] = floor;
        P.state[i] = 2;
        P.rot[o] = -Math.PI / 2; P.rot[o + 1] = 0;
      }
      if (Math.abs(x) > 60 || Math.abs(z) > 60) P.state[i] = 0;
    } else {
      // leaves resting off the island keep tumbling downwind instead of piling up
      if (P.pos[o + 1] < GROUND_Y && windNow > 0.3) {
        const slide = (windNow - 0.3) * 0.5 * dt;
        P.pos[o] += wd.x * slide; P.pos[o + 2] += wd.z * slide;
        P.rot[o + 2] += slide * 3;
      }
      P.life[i] -= dt;
      if (P.life[i] <= 0) P.state[i] = 0;
      scale *= Math.min(1, P.life[i] / 1.5);
    }
    if (!P.state[i]) { pMesh.setMatrixAt(i, zero); continue; }
    dummy.position.set(P.pos[o], P.pos[o + 1], P.pos[o + 2]);
    dummy.rotation.set(P.rot[o], P.rot[o + 1], P.rot[o + 2]);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    pMesh.setMatrixAt(i, dummy.matrix);
  }
  pMesh.instanceMatrix.needsUpdate = true;
  pMesh.instanceColor.needsUpdate = true;
  pMesh.geometry.attributes.aShape.needsUpdate = true;
}

// ---------------------------------------------------------------- season state
let cur = 0, from = 0, to = 0, prog = 1, queued = -1;
let growT = 0;
const tmpC = new THREE.Color();
const MOON = new THREE.Color(0x8fa6ff);

function applyPalette(dstA, dstB, dstC, s) {
  dstA.copy(s.leaves[0]); dstB.copy(s.leaves[1]); dstC.copy(s.leaves[2]);
}
function setSeason(i) {
  if (prog < 1) { queued = i; return; }
  if (i === to) return;
  from = to; to = i; prog = 0;
  const F = SEASONS[from], T = SEASONS[to];
  applyPalette(U.uFA.value, U.uFB.value, U.uFC.value, F);
  applyPalette(U.uTA.value, U.uTB.value, U.uTC.value, T);
  U.uFShape.value = F.shape; U.uTShape.value = T.shape;
  U.uFSize.value = F.size; U.uTSize.value = T.size;
  seasons.onChange?.(to);
}
function snapSeason(i) {
  from = to = cur = i; prog = 1;
  const S = SEASONS[i];
  applyPalette(U.uFA.value, U.uFB.value, U.uFC.value, S);
  applyPalette(U.uTA.value, U.uTB.value, U.uTC.value, S);
  U.uFShape.value = U.uTShape.value = S.shape;
  U.uFSize.value = U.uTSize.value = S.size;
  U.uProg.value = 0;
  seasons.onChange?.(to);
}

function pickLeafColor(s) {
  const r = Math.random();
  return s.leaves[r < 0.25 ? 0 : r < 0.65 ? 1 : 2];
}

function updateSeason(dt) {
  if (prog < 1) {
    const prev = prog;
    prog = Math.min(1, prog + dt / TRANSITION);
    // leaves whose swap moment (k = 0.5) was crossed this frame drop off in the old colour
    const F = SEASONS[from], th = tree.th, offs = tree.offs, half = WIN * 0.5;
    for (let i = 0; i < th.length; i++) {
      const m = th[i] + half;
      if (m > prev && m <= prog && Math.random() < 0.22) {
        spawn(offs[i * 3], offs[i * 3 + 1], offs[i * 3 + 2], pickLeafColor(F), F.shape, tree.rand[i * 4] * 1.1 * F.size, 1.2);
      }
    }
    U.uProg.value = prog;
    if (prog >= 1) {
      cur = to;
      snapSeason(to);
      if (queued >= 0) { const q = queued; queued = -1; setSeason(q); }
    }
  }
  const e = prog >= 1 ? 1 : THREE.MathUtils.smootherstep(prog, 0, 1);
  const F = SEASONS[from], T = SEASONS[to];
  const n = U.uNight.value;
  scene.background.copy(F.bg).lerp(T.bg, e);
  scene.background.lerp(tmpC.copy(F.nightBg).lerp(T.nightBg, e), n);
  trunkMat.color.copy(F.trunk).lerp(T.trunk, e);
  groundMat.color.copy(F.ground).lerp(T.ground, e);
  shadowMat.color.copy(F.shadow).lerp(T.shadow, e).lerp(tmpC.set(0x0b1530), n);
  sun.intensity = 2.0 - 1.45 * n;
  sun.color.setRGB(1, 1, 1).lerp(MOON, n);
  hemi.intensity = 1.2 - 0.75 * n;
  hemi.color.setRGB(1, 1, 1).lerp(MOON, n);
  U.uGrassBase.value.copy(F.grassBase).lerp(T.grassBase, e);
  U.uGrassTip.value.copy(F.grassTip).lerp(T.grassTip, e);
  return { F, T, e };
}

// ---------------------------------------------------------------- fireflies (night)
const FIRE = 90;
const fireGeo = new THREE.BufferGeometry();
{
  const fp = new Float32Array(FIRE * 3), fr = new Float32Array(FIRE), rnd = mulberry32(11);
  for (let i = 0; i < FIRE; i++) {
    const a = rnd() * Math.PI * 2, r = 1 + rnd() * 6;
    fp.set([Math.cos(a) * r, 0.3 + rnd() * 4.5, Math.sin(a) * r], i * 3);
    fr[i] = rnd();
  }
  fireGeo.setAttribute('position', new THREE.BufferAttribute(fp, 3));
  fireGeo.setAttribute('aR', new THREE.BufferAttribute(fr, 1));
}
const fireU = { uTime: U.uTime, uAmt: { value: 0 }, uPx: { value: 1 } };
const fireflies = new THREE.Points(fireGeo, new THREE.ShaderMaterial({
  uniforms: fireU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */`
    uniform float uTime, uAmt, uPx;
    attribute float aR;
    varying float vA;
    void main() {
      float ph = aR * 60.0;
      vec3 p = position + vec3(sin(uTime * 0.31 + ph), sin(uTime * 0.47 + ph * 1.7) * 0.4, cos(uTime * 0.27 + ph * 1.3)) * 0.9;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vA = uAmt * pow(sin(uTime * (0.6 + aR) + ph) * 0.5 + 0.5, 3.0);
      gl_PointSize = 90.0 * uPx / -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    varying float vA;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float g = smoothstep(0.5, 0.0, d);
      gl_FragColor = vec4(vec3(1.0, 0.92, 0.55) * (g * g + 0.6 * smoothstep(0.12, 0.0, d)) * vA, 1.0);
    }`,
}));
fireflies.frustumCulled = false;
scene.add(fireflies);

// ---------------------------------------------------------------- scene API
let auto = false, autoT = 0;

function dropLeaves(n, push = 0.6) {
  if (!tree || growT < 1) return;
  const T = SEASONS[to];
  for (let k = 0; k < n; k++) {
    const i = Math.floor(Math.random() * LEAF_COUNT), o = i * 3;
    spawn(tree.offs[o], tree.offs[o + 1], tree.offs[o + 2], pickLeafColor(T), T.shape, tree.rand[i * 4] * T.size, push);
  }
}

const seasons = {
  onChange: null,
  get season() { return to; },
  get auto() { return auto; },
  set(i) { auto = false; setSeason(i); },
  snap(i) { auto = false; queued = -1; snapSeason(i); },
  setAuto(on) { auto = on; autoT = 0; if (on) setSeason((to + 1) % 4); },
};

// ---------------------------------------------------------------- loop
let simT = 0, spawnAcc = 0, snowAcc = 0;

function frame(dt, S) {
  simT += dt;
  U.uTime.value = simT;
  const wind = S.windNow;
  U.uWind.value = wind;

  if (growT < 1) { growT = Math.min(1, growT + dt / 2.6); U.uGrow.value = growT; }
  if (auto) { autoT += dt; if (autoT > 12 && prog >= 1) { autoT = 0; setSeason((to + 1) % 4); } }

  U.uNight.value = S.night;
  U.uBreath.value = S.breathShown;
  fireU.uAmt.value = S.night * (to === 3 ? 0.15 : 1);
  fireU.uPx.value = renderer.getPixelRatio();

  const { T, e } = updateSeason(dt);

  // ambient falling from the canopy
  if (growT >= 1) {
    spawnAcc += dt * T.rate * S.fall * (0.3 + wind * 1.4) * (prog < 1 ? e : 1);
    while (spawnAcc >= 1) {
      spawnAcc -= 1;
      const i = Math.floor(Math.random() * LEAF_COUNT), o = i * 3;
      spawn(tree.offs[o], tree.offs[o + 1], tree.offs[o + 2], pickLeafColor(T), T.shape, tree.rand[i * 4] * T.size, wind);
    }
  }
  // snowfall from the sky in winter
  const winter = (to === 3 ? e : 0) + (from === 3 && prog < 1 ? 1 - e : 0);
  snowAcc += dt * 90 * winter * (0.4 + S.fall * 0.6);
  while (snowAcc >= 1) {
    snowAcc -= 1;
    spawn((Math.random() - 0.3) * 30, 10 + Math.random() * 4, (Math.random() - 0.5) * 22,
      SEASONS[3].leaves[2], 2, 0.06 + Math.random() * 0.06);
  }

  updateParticles(dt, simT, wind * 3.4);
}

plantTree();
snapSeason(0);

export default {
  scene,
  frame,
  fit: fitCamera,
  controls: { minDist: 7 },
  seasons,
  drop: dropLeaves,
  tap() { dropLeaves(8, 0.5); },
  regrow() { seed = 1 + Math.floor(Math.random() * 1e6); plantTree(); },
  sound: night => sceneMix(to, night),
};

// debug hook
window.__tree = {
  U, P,
  get state() { return { from, to, prog, growT, alive: P.state.reduce((a, s) => a + (s ? 1 : 0), 0) }; },
};
