import * as THREE from 'three';
import { camera, controls } from '../core.js';
import { makeMotes, makeSparks, mulberry32, glowTexture, makePine } from './common.js';

// 森林靈鹿: a silver, faceted spirit deer with a pale blue glow bounds through a
// moonlit forest. Its glow swells and its stride slows on the inhale; the
// exhale scatters blue sparks from its hooves.
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0e2a40');
scene.fog = new THREE.FogExp2('#12324a', 0.04);

const hemi = new THREE.HemisphereLight('#6f9fd0', '#0c1c26', 1.3);
const moon = new THREE.DirectionalLight('#9fc4ff', 0.9);
moon.position.set(-6, 14, 4);
scene.add(hemi, moon);

// ---------------------------------------------------------------- forest
const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#132b2a' }));
scene.add(ground);
{
  const rnd = mulberry32(17);
  const pineMat = new THREE.MeshLambertMaterial({ color: '#163a3a', flatShading: true });
  const trunkMat = new THREE.MeshLambertMaterial({ color: '#1d2a30', flatShading: true });
  for (let i = 0; i < 110; i++) {
    const x = (rnd() - 0.5) * 70, z = -4 - rnd() * 45;
    if (Math.abs(x) < 10 && z > -11) continue; // keep a clearing for the deer
    const s = 1.6 + rnd() * 2.2;
    const p = makePine(pineMat, s);
    p.position.set(x, 0, z);
    p.rotation.y = rnd() * 6;
    scene.add(p);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.2 * s, 6 * s, 5), trunkMat);
    tr.position.set(x, 1.5 * s, z);
    scene.add(tr);
  }
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { // a few near trunks framing the view
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 14, 6), trunkMat);
    tr.position.set(s * (6 + rnd() * 6), 7, 2 - rnd() * 6);
    scene.add(tr);
  }
}

// moonbeams slanting between the trees
const beamU = { uTime: { value: 0 }, uAmt: { value: 0.6 } };
const beamMat = new THREE.ShaderMaterial({
  uniforms: beamU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: /* glsl */`
    uniform float uTime, uAmt;
    varying vec2 vUv;
    void main() {
      float edge = smoothstep(0.0, 0.4, vUv.x) * smoothstep(1.0, 0.6, vUv.x);
      float fall = smoothstep(0.0, 0.8, vUv.y);
      gl_FragColor = vec4(vec3(0.45, 0.7, 1.0) * edge * fall * (0.8 + 0.2 * sin(uTime * 0.6 + vUv.x * 5.0)) * uAmt * 0.16, 1.0);
    }`,
});
{
  const rnd = mulberry32(5);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6 + rnd() * 2, 26), beamMat);
    m.position.set(-10 + i * 4 + rnd() * 2, 9, -8 - rnd() * 14);
    m.rotation.set(0, (rnd() - 0.5) * 0.5, -0.35);
    scene.add(m);
  }
}

// low mist over the forest floor
const mistU = { uTime: { value: 0 } };
const mist = new THREE.Mesh(new THREE.PlaneGeometry(80, 60).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
  uniforms: mistU, transparent: true, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vP; void main(){ vP = (modelMatrix*vec4(position,1.0)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vP,1.0); }',
  fragmentShader: /* glsl */`
    uniform float uTime;
    varying vec3 vP;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
    void main() {
      float n = noise(vP.xz * 0.15 + vec2(uTime * 0.03, 0.0)) * 0.6 + noise(vP.xz * 0.4 - uTime * 0.05) * 0.4;
      gl_FragColor = vec4(vec3(0.55, 0.75, 0.95), smoothstep(0.35, 0.85, n) * 0.22);
    }`,
}));
mist.position.y = 0.35;
scene.add(mist);

const motes = makeMotes({ count: 90, box: [24, 5, 20], center: [0, 2, -8], color: [0.5, 0.8, 1], size: 60, seed: 29 });
motes.U.uAmt.value = 0.9;
scene.add(motes.points);

// ---------------------------------------------------------------- the deer
const silver = new THREE.MeshStandardMaterial({ color: '#f3f6fa', flatShading: true, metalness: 0.55, roughness: 0.35, emissive: '#9fc9ff', emissiveIntensity: 0.12 });
const auraU = { uColor: { value: new THREE.Color('#7fc4ff') }, uAmt: { value: 1 } };
const aura = new THREE.ShaderMaterial({ // blue rim light so the deer seems lit from within
  uniforms: auraU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  vertexShader: /* glsl */`
    varying vec3 vN; varying vec3 vV;
    void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: /* glsl */`
    uniform vec3 uColor; uniform float uAmt;
    varying vec3 vN; varying vec3 vV;
    void main() { float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0); gl_FragColor = vec4(uColor * f * uAmt, 1.0); }`,
});
const deer = new THREE.Group();
function part(geo, x, y, z, rx = 0, rz = 0, parent = deer) {
  const m = new THREE.Mesh(geo, silver);
  m.position.set(x, y, z);
  m.rotation.set(rx, 0, rz);
  const glow = new THREE.Mesh(geo, aura);
  glow.scale.setScalar(1.12);
  m.add(glow);
  parent.add(m);
  return m;
}
part(new THREE.IcosahedronGeometry(0.5, 0).scale(1.45, 0.72, 0.62), 0, 1.15, 0);
part(new THREE.CylinderGeometry(0.12, 0.2, 0.75, 5), 0.62, 1.55, 0, 0, -0.65);
const head = part(new THREE.ConeGeometry(0.17, 0.5, 5).rotateZ(Math.PI / 2), 0.98, 1.9, 0, 0, -0.35);
for (const s of [-1, 1]) {
  part(new THREE.ConeGeometry(0.06, 0.2, 3), -0.05, 0.13, s * 0.1, s * 0.6, 0.2, head); // ears
  // antlers: a main beam with two tines
  const beam = part(new THREE.CylinderGeometry(0.018, 0.028, 0.6, 4).translate(0, 0.3, 0), -0.08, 0.1, s * 0.07, s * 0.35, 0.5, head);
  part(new THREE.CylinderGeometry(0.012, 0.018, 0.3, 4).translate(0, 0.15, 0), 0, 0.28, 0, s * 0.5, -0.6, beam);
  part(new THREE.CylinderGeometry(0.01, 0.016, 0.25, 4).translate(0, 0.12, 0), 0, 0.5, 0, s * 0.3, 0.6, beam);
}
part(new THREE.ConeGeometry(0.07, 0.22, 4), -0.72, 1.32, 0, 0, 1.2); // tail
const legs = [];
for (const [x, z, front] of [[0.48, 0.2, 1], [0.48, -0.2, 1], [-0.48, 0.2, 0], [-0.48, -0.2, 0]]) {
  const hip = new THREE.Group();
  hip.position.set(x, 1.0, z);
  part(new THREE.CylinderGeometry(0.06, 0.05, 0.5, 4).translate(0, -0.25, 0), 0, 0, 0, 0, 0, hip);
  const knee = new THREE.Group();
  knee.position.y = -0.5;
  part(new THREE.CylinderGeometry(0.045, 0.03, 0.48, 4).translate(0, -0.24, 0), 0, 0, 0, 0, 0, knee);
  hip.add(knee);
  deer.add(hip);
  legs.push({ hip, knee, front });
}
scene.add(deer);
const deerGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#6fb8ff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
deerGlow.scale.setScalar(4);
scene.add(deerGlow);
const deerLight = new THREE.PointLight('#7fc4ff', 3, 7, 1.8);
scene.add(deerLight);

const sparks = makeSparks({ count: 220, size: 22, color: [0.55, 0.85, 1], origin: () => [deer.position.x, deer.position.y + 0.25, deer.position.z], spread: 0.6, rise: [0.1, 0.6] });
scene.add(sparks.points);

// ---------------------------------------------------------------- frame
let t = 0, gait = 0, along = 0, leap = 0, lastB = 0, sparkAcc = 0;
const A = 5.5, B = 2.2, CZ = -5; // running path: an ellipse in front of the camera

function frame(dt, S) {
  t += dt;
  const b = S.breathShown;
  beamU.uTime.value = t;
  beamU.uAmt.value = 0.5 + 0.6 * b;
  mistU.uTime.value = t;
  motes.U.uTime.value = t;

  // stride slows on the inhale; a tap makes it bound higher
  leap = Math.max(0, leap - dt * 0.6);
  const speed = 2.4 * (1 - 0.45 * b) * (1 + leap * 0.4);
  along += dt * speed / (Math.PI * (A + B));
  gait += dt * speed * 2.1;
  const a = along * Math.PI * 2;
  const x = Math.cos(a) * A, z = CZ + Math.sin(a) * B;
  const vx = -Math.sin(a) * A, vz = Math.cos(a) * B;
  const hop = Math.abs(Math.sin(gait)) * (0.35 + leap * 0.9);
  deer.position.set(x, hop, z);
  deer.rotation.set(0, Math.atan2(-vz, vx), Math.cos(gait) * 0.15);
  for (const l of legs) {
    const ph = gait + (l.front ? 0 : Math.PI * 0.85);
    l.hip.rotation.z = Math.sin(ph) * 0.65;
    l.knee.rotation.z = -Math.max(0, Math.sin(ph + 0.8)) * 0.9;
  }
  deerGlow.position.set(x, 1.2 + hop, z);
  deerGlow.material.opacity = 0.45 + 0.4 * b;
  deerGlow.scale.setScalar(3.5 + 1.5 * b);
  deerLight.position.set(x, 1.4 + hop, z);
  deerLight.intensity = 2 + 3 * b;
  auraU.uAmt.value = 0.35 + 0.5 * b;
  silver.emissiveIntensity = 0.1 + 0.2 * b;

  // a trail of sparks, plus a burst as each exhale begins
  sparkAcc += dt * S.fall * 14;
  if (lastB - b > 0.004 && lastB > 0.85) sparkAcc += 25;
  lastB = b;
  while (sparkAcc >= 1) { sparkAcc -= 1; sparks.spawn(); }
  sparks.update(dt, t, 0);
}

function fit() {
  const far = camera.aspect < 1 ? 1.5 : 1;
  camera.position.set(0, 2.2, 8 * far);
  controls.target.set(0, camera.aspect < 1 ? 0.6 : 1.1, -6);
}

export default {
  scene, frame, fit,
  fov: 48,
  controls: { minDist: 8, maxDist: 24, minPolar: 1.2, maxPolar: 1.6, minAz: -0.7, maxAz: 0.7, autoRotate: false },
  tap() { leap = 1; for (let i = 0; i < 30; i++) sparks.spawn(); },
  drop(n) { for (let i = 0; i < Math.min(30, n); i++) sparks.spawn(); },
  gust() { leap = 1; },
  sound: () => ({ drone: 0.5, windchime: 0.45, crickets: 0.35, wind: 0.25 }),
};
