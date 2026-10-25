import * as THREE from 'three';
import { camera, controls, renderer } from '../core.js';
import { makeSky, toonRamp, mulberry32 } from './common.js';

// 深海鯨歌: drifting in blue water while a humpback and her calf glide past.
// Light shafts brighten on the inhale; the exhale sends up a stream of bubbles.
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b3556');
scene.fog = new THREE.FogExp2('#0d3a5e', 0.022);

const sky = makeSky(260);
sky.U.uTop.value.set('#5fc2d8');
sky.U.uHorizon.value.set('#0f4a72');
sky.U.uBottom.value.set('#041526');
sky.U.uSunDir.value.set(0.1, 1, 0.1).normalize();
sky.U.uSunCol.value.set('#c9f4ff');
sky.U.uSunSize.value = 0.02;
sky.U.uGlow.value = 1.2;
sky.mesh.material.fog = false;
scene.add(sky.mesh);

const hemi = new THREE.HemisphereLight('#8fe0f0', '#06263e', 1.4);
const sunDown = new THREE.DirectionalLight('#bfefff', 0.8);
sunDown.position.set(3, 20, 4);
scene.add(hemi, sunDown);

// ---------------------------------------------------------------- surface seen from below
const surfU = { uTime: { value: 0 } };
const surface = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(Math.PI / 2), new THREE.ShaderMaterial({
  uniforms: surfU, transparent: true, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vP; void main(){ vP = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vP,1.0); }',
  fragmentShader: /* glsl */`
    uniform float uTime;
    varying vec3 vP;
    void main() {
      vec2 p = vP.xz * 0.12;
      float c = sin(p.x * 3.0 + uTime * 0.6 + sin(p.y * 2.0 + uTime * 0.4)) * sin(p.y * 3.3 - uTime * 0.5 + sin(p.x * 1.7));
      float caustic = smoothstep(0.55, 0.95, c);
      float fade = 1.0 - smoothstep(30.0, 140.0, length(vP.xz - cameraPosition.xz));
      gl_FragColor = vec4(vec3(0.75, 0.95, 1.0) * (0.35 + 0.65 * caustic), (0.25 + 0.2 * caustic) * fade);
      #include <colorspace_fragment>
    }`,
}));
surface.position.y = 18;
scene.add(surface);

// light shafts slanting down from the surface
const rayU = { uTime: { value: 0 }, uAmt: { value: 0.5 } };
const rayMat = new THREE.ShaderMaterial({
  uniforms: rayU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: /* glsl */`
    uniform float uTime, uAmt;
    varying vec2 vUv;
    void main() {
      float edge = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x);
      float fall = smoothstep(0.0, 0.9, vUv.y);
      float flick = 0.7 + 0.3 * sin(uTime * 0.8 + vUv.x * 6.0);
      gl_FragColor = vec4(vec3(0.6, 0.9, 1.0) * edge * fall * flick * uAmt * 0.22, 1.0);
    }`,
});
{
  const rnd = mulberry32(6);
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2 + rnd() * 3, 40), rayMat);
    m.position.set(-18 + i * 4.5 + rnd() * 2, 0, -10 - rnd() * 25);
    m.rotation.set(0, (rnd() - 0.5) * 0.6, 0.25 + (rnd() - 0.5) * 0.15);
    m.renderOrder = 3;
    scene.add(m);
  }
}

// sea floor far below
const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400, 60, 60).rotateX(-Math.PI / 2),
  new THREE.MeshLambertMaterial({ color: '#2a5a6a' }));
{
  const pa = floor.geometry.attributes.position;
  for (let i = 0; i < pa.count; i++) pa.setY(i, Math.sin(pa.getX(i) * 0.05) * 2 + Math.cos(pa.getZ(i) * 0.07) * 2);
  floor.geometry.computeVertexNormals();
}
floor.position.y = -22;
scene.add(floor);

// ---------------------------------------------------------------- whales
function whaleGeometry() {
  const g = new THREE.SphereGeometry(1, 48, 24);
  const pa = g.attributes.position;
  const col = new Float32Array(pa.count * 3);
  const top = new THREE.Color('#2f4f6e'), belly = new THREE.Color('#c9d8e2'), c = new THREE.Color();
  for (let i = 0; i < pa.count; i++) {
    let x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
    // long body: blunt head (+x), tapering to a narrow tail stock (-x)
    const taper = x < 0 ? 1 - 0.62 * Math.pow(-x, 2.2) : 1 - 0.18 * x * x;
    pa.setXYZ(i, x * (x < 0 ? 4.2 : 5.0), y * 1.15 * taper - (x < 0 ? 0.25 * x * x : 0), z * 1.35 * taper);
    c.copy(belly).lerp(top, THREE.MathUtils.smoothstep(y, -0.35, 0.15));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
const whaleGeo = whaleGeometry();
const whaleMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp });
const finMat = new THREE.MeshToonMaterial({ color: '#3d5f7e', gradientMap: toonRamp, side: THREE.DoubleSide });
const flukeShape = new THREE.Shape();
flukeShape.moveTo(0, 0);
flukeShape.bezierCurveTo(-0.6, 0.6, -1.6, 1.9, -1.2, 2.3);
flukeShape.bezierCurveTo(-0.6, 1.6, -0.2, 0.6, 0, 0.25);
flukeShape.bezierCurveTo(-0.2, -0.6, -0.6, -1.6, -1.2, -2.3);
flukeShape.bezierCurveTo(-1.6, -1.9, -0.6, -0.6, 0, 0);
const flukeGeo = new THREE.ShapeGeometry(flukeShape, 16).rotateX(-Math.PI / 2);

function makeWhale(scale) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(whaleGeo, whaleMat));
  const tail = new THREE.Group();
  tail.position.x = -4.1;
  const fluke = new THREE.Mesh(flukeGeo, finMat);
  fluke.scale.setScalar(1.35);
  tail.add(fluke);
  g.add(tail);
  const fins = [];
  for (const s of [-1, 1]) { // long humpback pectoral fins
    const f = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8).scale(1.6, 0.08, 0.35), finMat);
    f.position.set(1.6, -0.5, s * 1.2);
    f.rotation.set(s * 0.5, s * 0.6, -0.3);
    g.add(f);
    fins.push(f);
  }
  g.scale.setScalar(scale);
  g.userData = { tail, fins };
  scene.add(g);
  return g;
}
const mother = makeWhale(1);
const calf = makeWhale(0.45);

// a small school of silver fish circling
const FISH = 70;
const fishMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(0.08, 0.35, 5).rotateZ(-Math.PI / 2),
  new THREE.MeshToonMaterial({ color: '#cfe6ef', gradientMap: toonRamp }), FISH);
scene.add(fishMesh);
const fishR = Array.from({ length: FISH }, (_, i) => [Math.random(), Math.random(), Math.random()]);

// ---------------------------------------------------------------- particles: marine snow and bubbles
const SNOW = 900;
const snowU = { uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() } };
{
  const rnd = mulberry32(2);
  const p = new Float32Array(SNOW * 3), r = new Float32Array(SNOW);
  for (let i = 0; i < SNOW; i++) { p.set([(rnd() - 0.5) * 50, (rnd() - 0.5) * 30, (rnd() - 0.5) * 50], i * 3); r[i] = rnd(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('aR', new THREE.BufferAttribute(r, 1));
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: snowU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uTime, uPx;
      attribute float aR;
      varying float vA;
      void main() {
        vec3 p = position;
        p.y = mod(p.y - uTime * (0.05 + 0.1 * aR) + 15.0, 30.0) - 15.0;
        p.x += sin(uTime * 0.2 + aR * 40.0) * 0.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = (0.25 + 0.5 * aR) * (1.0 - smoothstep(10.0, 35.0, -mv.z));
        gl_PointSize = (1.0 + 2.0 * aR) * uPx * 8.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord-0.5); gl_FragColor = vec4(vec3(0.8,0.95,1.0)*smoothstep(0.5,0.1,d)*vA,1.0); }',
  }));
  pts.frustumCulled = false;
  scene.add(pts);
}

const BUB = 160;
const bubPos = new Float32Array(BUB * 3), bubLife = new Float32Array(BUB), bubA = new Float32Array(BUB);
const bubGeo = new THREE.BufferGeometry();
bubGeo.setAttribute('position', new THREE.BufferAttribute(bubPos, 3));
bubGeo.setAttribute('aA', new THREE.BufferAttribute(bubA, 1));
const bubbles = new THREE.Points(bubGeo, new THREE.ShaderMaterial({
  uniforms: { uPx: snowU.uPx }, transparent: true, depthWrite: false,
  vertexShader: 'uniform float uPx; attribute float aA; varying float vA; void main(){ vA = aA; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = 70.0*uPx/-mv.z; gl_Position = projectionMatrix*mv; }',
  fragmentShader: /* glsl */`
    varying float vA;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float ring = smoothstep(0.5, 0.42, d) * smoothstep(0.25, 0.42, d);
      float hi = smoothstep(0.14, 0.0, length(gl_PointCoord - vec2(0.36, 0.34)));
      gl_FragColor = vec4(vec3(0.85, 0.97, 1.0), (ring * 0.8 + hi) * vA);
    }`,
}));
bubbles.frustumCulled = false;
scene.add(bubbles);
let bubI = 0;
function bubble(x = (Math.random() - 0.5) * 3, z = 4 + Math.random() * 2) {
  const i = bubI; bubI = (bubI + 1) % BUB;
  bubPos.set([x, -4 + Math.random(), z], i * 3);
  bubLife[i] = 6;
}

// ---------------------------------------------------------------- frame
let t = 0, lastB = 0;

function frame(dt, S) {
  t += dt;
  const b = S.breathShown;
  surfU.uTime.value = t;
  rayU.uTime.value = t;
  snowU.uTime.value = t;
  rayU.uAmt.value = 0.45 + 0.75 * b;
  hemi.intensity = 1.2 + 0.4 * b;

  // the mother glides on a long slow loop; the calf keeps close above her
  const a = t * 0.035;
  const mx = Math.sin(a) * 22, mz = -16 + Math.cos(a * 2) * 6, my = 1.5 + Math.sin(t * 0.15) * 1.5;
  const vx = Math.cos(a) * 22 * 0.035, vz = -Math.sin(a * 2) * 12 * 0.035;
  mother.position.set(mx, my, mz);
  mother.rotation.set(0, Math.atan2(-vz, vx), Math.sin(t * 0.3) * 0.06);
  mother.userData.tail.rotation.z = Math.sin(t * 0.9) * 0.35;
  for (const f of mother.userData.fins) f.rotation.z = -0.3 + Math.sin(t * 0.5) * 0.15;
  const ca = a - 0.06;
  calf.position.set(Math.sin(ca) * 22 + 1.5, my + 2.6 + Math.sin(t * 0.4) * 0.4, -16 + Math.cos(ca * 2) * 6 + 1.2);
  calf.rotation.set(0, mother.rotation.y, Math.sin(t * 0.5) * 0.08);
  calf.userData.tail.rotation.z = Math.sin(t * 1.6) * 0.45;

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < FISH; i++) {
    const [r1, r2, r3] = fishR[i];
    const fa = t * (0.25 + 0.05 * r1) + r2 * Math.PI * 2;
    const rad = 4 + r1 * 2;
    p.set(8 + Math.cos(fa) * rad, -1 + (r3 - 0.5) * 2.5 + Math.sin(t + r2 * 9) * 0.3, -6 + Math.sin(fa) * rad * 0.6);
    e.set(0, Math.atan2(-Math.cos(fa) * 0.6, -Math.sin(fa)), 0);
    fishMesh.setMatrixAt(i, m.compose(p, q.setFromEuler(e), one));
  }
  fishMesh.instanceMatrix.needsUpdate = true;

  // bubbles: a trickle, plus a stream as each exhale begins
  if (lastB - b > 0.004 && lastB > 0.85) for (let k = 0; k < 18; k++) bubble();
  lastB = b;
  if (Math.random() < dt * S.fall * 1.5) bubble((Math.random() - 0.5) * 20, -5 - Math.random() * 15);
  for (let i = 0; i < BUB; i++) {
    if (bubLife[i] <= 0) { bubA[i] = 0; continue; }
    bubLife[i] -= dt;
    bubPos[i * 3 + 1] += dt * (1.1 + (i % 5) * 0.12);
    bubPos[i * 3] += Math.sin(t * 3 + i) * dt * 0.2;
    bubA[i] = Math.min(1, bubLife[i] / 2) * 0.9;
  }
  bubGeo.attributes.position.needsUpdate = true;
  bubGeo.attributes.aA.needsUpdate = true;
}

function fit() {
  const far = camera.aspect < 1 ? 1.4 : 1;
  camera.position.set(0, -1, 13 * far);
  controls.target.set(0, 0.5, -6);
}

export default {
  scene, frame, fit,
  fov: 50,
  controls: { minDist: 10, maxDist: 34, minPolar: 1.2, maxPolar: 1.9, minAz: -0.8, maxAz: 0.8, autoRotate: false },
  tap(ndc) { for (let i = 0; i < 10; i++) bubble(ndc.x * 6 + (Math.random() - 0.5), 3); },
  drop(n) { for (let i = 0; i < Math.min(20, n); i++) bubble(); },
  gust() { for (let i = 0; i < 20; i++) bubble(); },
  sound: () => ({ whale: 0.6, drone: 0.25, brown: 0.12 }),
};
