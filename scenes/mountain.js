import * as THREE from 'three';
import { camera, controls } from '../core.js';
import { makeSky, makeStars, makeGulls, palette, mixInto, toonRamp, mulberry32, makePine } from './common.js';

// 山間雲海: layered ridges fading into the haze with a sea of cloud flowing
// between them. The clouds lift on the inhale and settle on the exhale.
const scene = new THREE.Scene();
scene.background = new THREE.Color();

const C = palette({
  top: ['#8fb7e6', '#050b22'], horizon: ['#ffd8c4', '#2a3866'], bottom: ['#c7d3ea', '#0c1534'],
  sun: ['#fff1cf', '#e8eeff'], ridge: ['#4a5a8c', '#141c3c'], cloud: ['#fff6f2', '#7d8bb5'], cloudShade: ['#d9d3e8', '#3a4670'],
  rock: ['#6f6a73', '#272a3c'], pine: ['#2f4f43', '#0f1f22'], wood: ['#8a3f2e', '#3a1f22'], roof: ['#3d3a44', '#16161f'],
});

const sky = makeSky();
sky.U.uSunDir.value.set(0.08, 0.1, -1).normalize();
scene.add(sky.mesh);
const stars = makeStars(1600, 280, 52);
scene.add(stars.points);

// ---------------------------------------------------------------- ridges, near to far
const ridgeMats = [];
{
  const rnd = mulberry32(8);
  const layers = [[-35, -6, 10], [-70, -3, 18], [-120, 2, 28], [-190, 8, 40], [-280, 16, 55], [-380, 26, 70]];
  layers.forEach(([z, base, amp], li) => {
    const seg = 220, w = 900;
    const pos = [], idx = [], hgt = [];
    const ph = [rnd() * 9, rnd() * 9, rnd() * 9];
    for (let i = 0; i <= seg; i++) {
      const x = -w / 2 + (i / seg) * w, u = x / w;
      // sharp ridged peaks: 1 - |sin| makes pointed crests
      const peaks = Math.pow(1 - Math.abs(Math.sin(u * 6 + ph[0])), 2.2) * 0.75 + Math.pow(1 - Math.abs(Math.sin(u * 15 + ph[1])), 2) * 0.3 + Math.sin(u * 43 + ph[2]) * 0.05;
      const top = base + amp * peaks;
      pos.push(x, top, z, x, -90, z);
      hgt.push(1, 0);
    }
    for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aTop', new THREE.Float32BufferAttribute(hgt, 1));
    g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color() }, uHaze: { value: new THREE.Color() }, uDepth: { value: li / (layers.length - 1) } },
      vertexShader: /* glsl */`
        attribute float aTop;
        varying float vTop;
        void main() { vTop = aTop; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform vec3 uColor, uHaze;
        uniform float uDepth;
        varying float vTop;
        void main() {
          // far ridges melt into the haze; each ridge is lighter at its crest
          vec3 c = mix(uColor, uHaze, 0.05 + uDepth * 0.6);
          c = mix(c, uHaze, smoothstep(0.6, 1.0, vTop) * 0.12);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    ridgeMats.push(mat);
    const m = new THREE.Mesh(g, mat);
    m.renderOrder = -2 - li;
    scene.add(m);
  });
}

// ---------------------------------------------------------------- the sea of cloud
const CU = { uTime: { value: 0 }, uColor: { value: new THREE.Color() }, uShade: { value: new THREE.Color() }, uDensity: { value: 1 }, uFlow: { value: 0 } };
const cloudMat = new THREE.ShaderMaterial({
  uniforms: CU, transparent: true, depthWrite: false,
  vertexShader: /* glsl */`
    varying vec3 vP;
    void main() { vP = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vP, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform float uTime, uDensity, uFlow;
    uniform vec3 uColor, uShade;
    varying vec3 vP;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
    void main() {
      vec2 p = vP.xz * 0.018 + vec2(uFlow, uTime * 0.004);
      float n = fbm(p);
      float a = smoothstep(0.46 - 0.16 * uDensity, 0.68, n);
      float near = smoothstep(4.0, 30.0, length(vP.xz - cameraPosition.xz));
      float far = 1.0 - smoothstep(260.0, 420.0, length(vP.xz - cameraPosition.xz));
      vec3 c = mix(uShade, uColor, smoothstep(0.5, 0.9, n));
      gl_FragColor = vec4(c, a * near * far * 0.92);
      #include <colorspace_fragment>
    }`,
});
const clouds = [];
for (const [y, z] of [[-4, -60], [1.5, -150], [8, -240]]) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1000, 260).rotateX(-Math.PI / 2), cloudMat);
  m.position.set(0, y, z);
  m.userData.y = y;
  m.renderOrder = 1;
  clouds.push(m);
  scene.add(m);
}

// ---------------------------------------------------------------- foreground ledge, pines, pavilion
const rockMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(), flatShading: true });
const pineMat = new THREE.MeshToonMaterial({ color: new THREE.Color(), gradientMap: toonRamp });
const woodMat = new THREE.MeshToonMaterial({ color: new THREE.Color(), gradientMap: toonRamp });
const roofMat = new THREE.MeshToonMaterial({ color: new THREE.Color(), gradientMap: toonRamp });
{
  const rnd = mulberry32(31);
  for (const [x, y, z, s] of [[-9, -3.2, -2, 5], [9, -3.5, -1, 5.5], [-15, -4, -8, 6], [16, -4.5, -8, 6], [0, -6.8, 3, 6]]) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
    r.position.set(x, y, z);
    r.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    r.scale.y = 0.6;
    scene.add(r);
  }
  for (const [x, z, s] of [[-11, -3, 1.6], [-13, -6, 2.2], [8.2, -1.5, 1.8], [10.5, -4.5, 1.4], [12.5, -2, 1.1]]) {
    const p = makePine(pineMat, s);
    p.position.set(x, 0.3, z);
    p.rotation.z = (rnd() - 0.5) * 0.15;
    scene.add(p);
  }
  // small pavilion (亭) on the left rock
  const pav = new THREE.Group();
  for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6), woodMat);
    post.position.set(x, 0.8, z);
    pav.add(post);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.75, 0.9, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 2.0;
  const eave = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.08, 4), roofMat);
  eave.rotation.y = Math.PI / 4;
  eave.position.y = 1.6;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), woodMat);
  tip.position.y = 2.5;
  pav.add(roof, eave, tip);
  pav.position.set(-7, -0.2, -4);
  pav.rotation.y = 0.3;
  scene.add(pav);
}
const hemi = new THREE.HemisphereLight('#ffffff', '#5a5a70', 1.1);
const sun = new THREE.DirectionalLight('#ffe2c8', 1.0);
sun.position.set(2, 6, -10);
scene.add(hemi, sun);

const birds = makeGulls({ count: 4, center: [0, 6, -70], radius: [15, 40], height: [0, 10], seed: 61 });
scene.add(birds.group);

// ---------------------------------------------------------------- frame
let t = 0, flow = 0, gust = 0;
const haze = new THREE.Color(), ridgeCol = new THREE.Color();

function frame(dt, S) {
  t += dt;
  const n = S.night, b = S.breathShown;
  gust = Math.max(0, gust - dt * 0.3);
  flow += dt * (0.004 + S.windNow * 0.01 + gust * 0.05);
  CU.uTime.value = t;
  CU.uFlow.value = flow;
  CU.uDensity.value = 0.4 + 0.6 * S.fall;
  // inhale: the cloud sea rises a little; exhale: it settles
  for (const c of clouds) c.position.y = c.userData.y - 1.2 + 2.6 * b + Math.sin(t * 0.2 + c.userData.y) * 0.3;

  mixInto(sky.U.uTop.value, C.top, n);
  mixInto(sky.U.uHorizon.value, C.horizon, n);
  mixInto(sky.U.uBottom.value, C.bottom, n);
  mixInto(sky.U.uSunCol.value, C.sun, n);
  sky.U.uSunSize.value = THREE.MathUtils.lerp(0.0018, 0.0008, n);
  sky.U.uGlow.value = 1 + 0.4 * b;
  scene.background.copy(sky.U.uHorizon.value);
  mixInto(haze, C.horizon, n);
  mixInto(ridgeCol, C.ridge, n);
  for (const m of ridgeMats) { m.uniforms.uColor.value.copy(ridgeCol); m.uniforms.uHaze.value.copy(haze); }
  mixInto(CU.uColor.value, C.cloud, n);
  mixInto(CU.uShade.value, C.cloudShade, n);
  mixInto(rockMat.color, C.rock, n);
  mixInto(pineMat.color, C.pine, n);
  mixInto(woodMat.color, C.wood, n);
  mixInto(roofMat.color, C.roof, n);
  hemi.intensity = 1.1 - 0.7 * n;
  sun.intensity = 1.0 - 0.75 * n;
  stars.U.uTime.value = t;
  stars.U.uAmt.value = n;
  birds.group.visible = n < 0.6;
  birds.update(t);
}

function fit() {
  const far = camera.aspect < 1 ? 1.3 : 1;
  camera.position.set(0, 3.2, 11 * far);
  controls.target.set(0, camera.aspect < 1 ? 1.5 : 2.5, -40);
}

export default {
  scene, frame, fit,
  fov: 50,
  controls: { minDist: 30, maxDist: 70, minPolar: 1.4, maxPolar: 1.66, minAz: -0.5, maxAz: 0.5, autoRotate: false },
  tap() { gust = 1; },
  drop() { gust = Math.min(1, gust + 0.4); },
  gust() { gust = 1; },
  sound: night => (night ? { wind: 0.5, templebell: 0.45, crickets: 0.45, drone: 0.3 } : { wind: 0.55, birds: 0.45, templebell: 0.5 }),
};
