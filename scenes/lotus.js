import * as THREE from 'three';
import { camera, controls } from '../core.js';
import { makeSky, makeStars, makeMotes, palette, mixInto, toonRamp, mulberry32, tapOnPlane } from './common.js';

// 蓮花池: the lotus opens on the inhale and closes on the exhale, sending a
// ripple across the pond. Rain and taps ripple the water too; koi drift below.
const scene = new THREE.Scene();
scene.background = new THREE.Color();

const C = palette({
  top: ['#a9dcd6', '#081a26'], horizon: ['#f3e7d2', '#1d3a45'], bottom: ['#9cc7bf', '#0a1a22'],
  sun: ['#fff6dc', '#e8f0ff'],
  water: ['#5fa9a0', '#0f2e36'], waterDeep: ['#2f7a78', '#081c24'], glint: ['#ffffff', '#cfe0ff'],
  pad: ['#4f9a55', '#1d4a3a'], pad2: ['#7cbf5a', '#2b5a40'], petal: ['#ff9ec2', '#b46a9a'], petalBase: ['#fff4f6', '#c6b8d6'],
  pod: ['#e7d35a', '#8a8450'], treeLine: ['#5b8f6e', '#0d2a2a'], reed: ['#7aa860', '#1e3d32'],
});

const sky = makeSky();
sky.U.uSunDir.value.set(-0.4, 0.35, -1).normalize();
scene.add(sky.mesh);
const stars = makeStars(1400, 280, 8);
scene.add(stars.points);

const hemi = new THREE.HemisphereLight(0xffffff, 0x6f9a8a, 1.0);
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(-4, 8, 3);
scene.add(hemi, sun);

// ---------------------------------------------------------------- water with ripples
const MAX_RIP = 24;
const U = {
  uTime: { value: 0 }, uRip: { value: Array.from({ length: MAX_RIP }, () => new THREE.Vector4(0, 0, -99, 0)) },
  uWater: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() }, uGlint: { value: new THREE.Color() },
  uHorizon: sky.U.uHorizon, uSunDir: sky.U.uSunDir, uWind: { value: 0.4 },
};
const waterMat = new THREE.ShaderMaterial({
  uniforms: U, transparent: true, depthWrite: false,
  vertexShader: /* glsl */`
    varying vec3 vP;
    void main() {
      vP = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * viewMatrix * vec4(vP, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform float uTime, uWind;
    uniform vec4 uRip[${MAX_RIP}];
    uniform vec3 uWater, uDeep, uGlint, uHorizon, uSunDir;
    varying vec3 vP;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    void main() {
      vec2 p = vP.xz;
      // ripple rings: x, z, start time, strength
      float h = 0.0;
      for (int i = 0; i < ${MAX_RIP}; i++) {
        vec4 r = uRip[i];
        float age = uTime - r.z;
        if (age < 0.0 || age > 6.0) continue;
        float d = length(p - r.xy);
        float rad = age * (0.9 + 0.5 * r.w);
        float env = exp(-pow((d - rad) * 3.0, 2.0)) * exp(-age * 0.7) * r.w;
        h += sin((d - rad) * 18.0) * env;
      }
      float n = noise(p * 1.4 + uTime * 0.15) + 0.5 * noise(p * 3.1 - uTime * (0.2 + uWind * 0.4));
      vec3 V = normalize(cameraPosition - vP);
      float fr = pow(1.0 - max(V.y, 0.0), 3.0);
      vec3 c = mix(uDeep, uWater, 0.55 + 0.25 * n);
      c = mix(c, uHorizon, fr * 0.7);
      c += uGlint * (smoothstep(0.25, 0.6, h) * 0.45 - smoothstep(0.25, 0.6, -h) * 0.12);
      // soft sky glints that move with the breeze
      c += uGlint * step(1.3, n + 0.25 * h) * 0.12;
      float a = mix(0.82, 0.97, fr);
      gl_FragColor = vec4(c, a);
      #include <colorspace_fragment>
    }`,
});
const water = new THREE.Mesh(new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2), waterMat);
water.renderOrder = 2;
scene.add(water);

let ripI = 0, t = 0;
function ripple(x, z, strength = 1) {
  U.uRip.value[ripI].set(x, z, t, strength);
  ripI = (ripI + 1) % MAX_RIP;
}

// ---------------------------------------------------------------- lily pads
function padGeometry(r) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.absarc(0, 0, r, 0.25, Math.PI * 2 - 0.05, false);
  s.lineTo(0, 0);
  return new THREE.ShapeGeometry(s, 24).rotateX(-Math.PI / 2);
}
const padMat = new THREE.MeshToonMaterial({ color: new THREE.Color(), gradientMap: toonRamp, side: THREE.DoubleSide });
const padMat2 = new THREE.MeshToonMaterial({ color: new THREE.Color(), gradientMap: toonRamp, side: THREE.DoubleSide });
const pads = [];
{
  const rnd = mulberry32(17);
  for (let i = 0; i < 46; i++) {
    let x, z;
    do { const a = rnd() * Math.PI * 2, r = 2.6 + Math.pow(rnd(), 0.7) * 13; x = Math.cos(a) * r; z = Math.sin(a) * r; } while (z > 6 && Math.abs(x) < 3);
    const m = new THREE.Mesh(padGeometry(0.35 + rnd() * 0.5), rnd() < 0.6 ? padMat : padMat2);
    m.position.set(x, 0.02, z);
    m.rotation.y = rnd() * Math.PI * 2;
    m.userData.ph = rnd() * 10;
    pads.push(m);
    scene.add(m);
  }
  const under = new THREE.Mesh(padGeometry(1.8), padMat);
  under.position.y = 0.015;
  under.rotation.y = 0.7;
  scene.add(under);
}

// ---------------------------------------------------------------- the lotus
function petalGeometry(len, wid) {
  const g = new THREE.PlaneGeometry(1, 1, 6, 10);
  const pa = g.attributes.position;
  const col = new Float32Array(pa.count * 3);
  for (let i = 0; i < pa.count; i++) {
    const u = pa.getX(i), v = pa.getY(i) + 0.5;          // u -0.5..0.5, v 0..1
    const w = Math.pow(Math.sin(Math.PI * Math.min(1, v * 0.92 + 0.04)), 0.75) * (1 - 0.35 * v) * wid;
    const x = u * w * 2;
    const y = v * len;
    const z = -(u * u) * w * 1.6 + Math.sin(v * Math.PI * 0.9) * 0.08 * len; // cupped, curling in
    pa.setXYZ(i, x, y, z);
    col.set([v, v, v], i * 3); // used as a tip-blend factor in the shader below
  }
  g.setAttribute('aTip', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
const petalU = { uBase: { value: new THREE.Color() }, uTip: { value: new THREE.Color() } };
const petalMat = new THREE.MeshToonMaterial({ gradientMap: toonRamp, side: THREE.DoubleSide });
petalMat.onBeforeCompile = sh => {
  Object.assign(sh.uniforms, petalU);
  sh.vertexShader = 'attribute vec3 aTip;\nvarying float vTip;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvTip = aTip.x;');
  sh.fragmentShader = 'uniform vec3 uBase, uTip;\nvarying float vTip;\n' + sh.fragmentShader.replace(
    'vec4 diffuseColor = vec4( diffuse, opacity );',
    'vec4 diffuseColor = vec4( mix(uBase, uTip, smoothstep(0.25, 1.0, vTip)), opacity );');
};

const lotus = new THREE.Group();
const rings = [
  { n: 7, len: 0.62, wid: 0.26, closed: 0.12, open: 0.55, petals: [] },
  { n: 9, len: 0.86, wid: 0.33, closed: 0.2, open: 0.95, petals: [] },
  { n: 11, len: 1.02, wid: 0.36, closed: 0.32, open: 1.32, petals: [] },
];
rings.forEach((r, ri) => {
  const g = petalGeometry(r.len, r.wid);
  for (let i = 0; i < r.n; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / r.n) * Math.PI * 2 + ri * 0.35;
    const petal = new THREE.Mesh(g, petalMat);
    petal.position.z = 0.05 + ri * 0.05;
    pivot.add(petal);
    lotus.add(pivot);
    r.petals.push(petal);
  }
});
const podMat = new THREE.MeshToonMaterial({ color: new THREE.Color(), gradientMap: toonRamp });
const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.16, 20), podMat);
pod.position.y = 0.16;
lotus.add(pod);
{
  const st = new THREE.CylinderGeometry(0.008, 0.008, 0.16, 4);
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(st, podMat);
    const a = i / 26 * Math.PI * 2;
    m.position.set(Math.cos(a) * 0.23, 0.13, Math.sin(a) * 0.23);
    m.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
    lotus.add(m);
  }
}
lotus.position.y = 0.04;
lotus.scale.setScalar(1.5);
scene.add(lotus);

// ---------------------------------------------------------------- koi under the surface
const koi = [];
{
  const body = new THREE.IcosahedronGeometry(1, 0).scale(0.42, 0.1, 0.16); // low poly koi
  const tail = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-0.28, 0.16), new THREE.Vector2(-0.28, -0.16)]))
    .rotateX(-Math.PI / 2);
  for (const [col, r, sp, ph] of [[0xff7a3c, 4.2, 0.18, 0], [0xfff4ea, 5.5, -0.13, 2], [0xf2b134, 3.4, 0.22, 4]]) {
    const mat = new THREE.MeshLambertMaterial({ color: col, flatShading: true, side: THREE.DoubleSide });
    const g = new THREE.Group();
    const b = new THREE.Mesh(body, mat);
    const tl = new THREE.Mesh(tail, mat);
    tl.position.x = -0.38;
    g.add(b, tl);
    g.position.y = -0.28;
    g.userData = { r, sp, ph, tail: tl };
    koi.push(g);
    scene.add(g);
  }
}

// ---------------------------------------------------------------- shoreline: tree line and reeds
const treeMat = new THREE.MeshToonMaterial({ color: new THREE.Color(), gradientMap: toonRamp });
const reedMat = new THREE.MeshToonMaterial({ color: new THREE.Color(), gradientMap: toonRamp });
{
  const rnd = mulberry32(5);
  const ball = new THREE.SphereGeometry(1, 12, 8);
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2, r = 46 + rnd() * 10;
    const m = new THREE.Mesh(ball, treeMat);
    const s = 4 + rnd() * 6;
    m.scale.set(s * 1.3, s, s * 1.3);
    m.position.set(Math.cos(a) * r, s * 0.35, Math.sin(a) * r);
    scene.add(m);
  }
  const blade = new THREE.ConeGeometry(0.03, 1, 4).translate(0, 0.5, 0);
  for (let c = 0; c < 9; c++) {
    const a = rnd() * Math.PI * 2, r = 9 + rnd() * 6, cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    if (cz > 5) continue;
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(blade, reedMat);
      m.position.set(cx + (rnd() - 0.5) * 1.2, -0.1, cz + (rnd() - 0.5) * 1.2);
      m.scale.y = 0.8 + rnd() * 1.4;
      m.rotation.set((rnd() - 0.5) * 0.3, 0, (rnd() - 0.5) * 0.3);
      scene.add(m);
    }
  }
}

const fireflies = makeMotes({ count: 70, box: [16, 2.5, 14], center: [0, 1.4, -1], size: 70, seed: 23 });
scene.add(fireflies.points);

// ---------------------------------------------------------------- frame
let rainAcc = 0, lastB = 0, rising = false;
const tmp = new THREE.Color();

function frame(dt, S) {
  t += dt;
  const n = S.night;
  U.uTime.value = t;
  U.uWind.value = S.windNow;

  // lotus: half open at rest, opens fully on the inhale, closes on the exhale
  const b = S.breathShown;
  const open = 0.35 + 0.65 * b + 0.04 * Math.sin(t * 0.6);
  for (const r of rings) {
    const a = THREE.MathUtils.lerp(r.closed, r.open, open);
    for (const p of r.petals) p.rotation.x = a;
  }
  lotus.rotation.y += dt * 0.03;
  lotus.position.y = 0.04 + Math.sin(t * 0.8) * 0.01;
  // a ripple leaves the flower each time the breath turns from in to out
  if (b > lastB + 1e-4) rising = true;
  else if (rising && b < lastB - 1e-4) { rising = false; if (b > 0.5) ripple(0, 0, 1.2); }
  lastB = b;

  // rain ripples
  rainAcc += dt * S.fall * 3.5;
  while (rainAcc >= 1) {
    rainAcc -= 1;
    ripple((Math.random() - 0.5) * 24, (Math.random() - 0.6) * 20, 0.35 + Math.random() * 0.3);
  }

  for (const m of pads) m.position.y = 0.02 + Math.sin(t * 0.9 + m.userData.ph) * 0.008;
  for (const k of koi) {
    const { r, sp, ph, tail } = k.userData;
    const a = t * sp + ph;
    k.position.x = Math.cos(a) * r;
    k.position.z = Math.sin(a) * r * 0.8;
    // face along the velocity (the body's nose is local +x)
    const vx = -Math.sin(a) * sp, vz = Math.cos(a) * 0.8 * sp;
    k.rotation.y = Math.atan2(-vz, vx);
    tail.rotation.y = Math.sin(t * 5 + ph) * 0.35;
  }

  mixInto(sky.U.uTop.value, C.top, n);
  mixInto(sky.U.uHorizon.value, C.horizon, n);
  mixInto(sky.U.uBottom.value, C.bottom, n);
  mixInto(sky.U.uSunCol.value, C.sun, n);
  sky.U.uGlow.value = 1 - 0.5 * n;
  scene.background.copy(sky.U.uHorizon.value);
  mixInto(U.uWater.value, C.water, n);
  mixInto(U.uDeep.value, C.waterDeep, n);
  mixInto(U.uGlint.value, C.glint, n);
  mixInto(padMat.color, C.pad, n);
  mixInto(padMat2.color, C.pad2, n);
  mixInto(petalU.uTip.value, C.petal, n);
  mixInto(petalU.uBase.value, C.petalBase, n);
  mixInto(podMat.color, C.pod, n);
  mixInto(treeMat.color, C.treeLine, n);
  mixInto(reedMat.color, C.reed, n);
  hemi.intensity = 1.0 - 0.55 * n;
  sun.intensity = 1.1 - 0.75 * n;
  stars.U.uTime.value = t;
  stars.U.uAmt.value = n;
  fireflies.U.uTime.value = t;
  fireflies.U.uAmt.value = n;
}

function fit() {
  const far = camera.aspect < 1 ? 1.4 : 1;
  camera.position.set(0, 3.1 * far, 9 * far);
  controls.target.set(0, camera.aspect < 1 ? -0.9 : -0.4, 0);
}

export default {
  scene, frame, fit,
  fov: 40,
  controls: { minDist: 5, maxDist: 18, minPolar: 0.55, maxPolar: 1.3 },
  tap(ndc) {
    const p = tapOnPlane(ndc, camera, 0);
    if (p && p.length() < 60) ripple(p.x, p.z, 1);
  },
  drop(n) { for (let i = 0; i < Math.min(6, n); i++) ripple((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, 0.8); },
  gust() { for (let i = 0; i < 5; i++) ripple((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 8, 0.9); },
  sound: night => (night ? { crickets: 0.65, stream: 0.45, windchime: 0.3 } : { stream: 0.55, birds: 0.45, windchime: 0.35 }),
};
