import * as THREE from 'three';
import { camera, controls } from '../core.js';
import { makeSky, makeStars, toonRamp, mulberry32 } from './common.js';

// 極光星空: aurora curtains over a frozen lake. They brighten and lift on the
// inhale and fade on the exhale; the lake mirrors them. Taps send a meteor.
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0a1836');

const sky = makeSky();
sky.U.uTop.value.set('#030818');
sky.U.uHorizon.value.set('#14315c');
sky.U.uBottom.value.set('#081430');
sky.U.uSunDir.value.set(0.55, 0.42, -1).normalize();
sky.U.uSunCol.value.set('#dfe8ff');
sky.U.uSunSize.value = 0.0005;
sky.U.uGlow.value = 0.5;
scene.add(sky.mesh);
const stars = makeStars(2600, 280, 13);
stars.U.uAmt.value = 1;
scene.add(stars.points);

// ---------------------------------------------------------------- aurora curtains
const AU = { uTime: { value: 0 }, uAmt: { value: 0.8 }, uLift: { value: 0 } };
function curtain({ z, y0, h, w, k1, k2, a1, a2, speed, hue, seed }) {
  const geo = new THREE.PlaneGeometry(w, h, 260, 1);
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...AU, uZ: { value: z }, uK: { value: new THREE.Vector4(k1, k2, a1, a2) }, uSpeed: { value: speed },
      uHue: { value: hue }, uSeed: { value: seed }, uY0: { value: y0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      uniform float uTime, uZ, uSpeed, uSeed, uY0, uLift;
      uniform vec4 uK;
      varying vec2 vUv;
      varying float vU;
      void main() {
        vUv = uv;
        vec3 p = position;
        float u = p.x;
        vU = u;
        p.z = uZ + sin(u * uK.x + uTime * uSpeed + uSeed) * uK.z + sin(u * uK.y - uTime * uSpeed * 0.7 + uSeed * 2.0) * uK.w;
        p.y = uY0 + uLift * 3.0 + uv.y * ${h.toFixed(2)};
        p.y += sin(u * 0.05 + uTime * 0.2 + uSeed) * 2.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uAmt, uHue, uSeed;
      varying vec2 vUv;
      varying float vU;
      float hash(float n) { return fract(sin(n) * 43758.5453); }
      float noise(float x) { float i = floor(x), f = fract(x); return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f)); }
      void main() {
        float y = vUv.y;
        // vertical rays drifting sideways
        float rays = noise(vU * 0.9 + uTime * 0.4 + uSeed) * 0.6 + noise(vU * 2.7 - uTime * 0.7) * 0.4;
        rays = pow(rays, 1.6);
        float base = smoothstep(0.0, 0.06, y) * (1.0 - smoothstep(0.08, 1.0, y));
        float band = noise(vU * 0.08 + uTime * 0.05 + uSeed) * 0.7 + 0.3;
        vec3 green = vec3(0.25, 1.0, 0.62), teal = vec3(0.2, 0.75, 0.95), violet = vec3(0.72, 0.42, 1.0);
        vec3 c = mix(mix(green, teal, uHue), violet, smoothstep(0.25, 0.9, y));
        float edge = 1.0 - smoothstep(0.42, 0.5, abs(vUv.x - 0.5)); // fade the ribbon ends
        float a = base * (0.35 + 0.9 * rays) * band * edge * uAmt;
        gl_FragColor = vec4(c * a, 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = -5;
  return m;
}
const curtains = [
  curtain({ z: -95, y0: 14, h: 34, w: 260, k1: 0.035, k2: 0.09, a1: 18, a2: 6, speed: 0.12, hue: 0.0, seed: 1 }),
  curtain({ z: -125, y0: 20, h: 40, w: 300, k1: 0.025, k2: 0.07, a1: 24, a2: 8, speed: 0.09, hue: 0.45, seed: 4 }),
  curtain({ z: -75, y0: 18, h: 22, w: 180, k1: 0.05, k2: 0.12, a1: 10, a2: 4, speed: 0.15, hue: 0.2, seed: 7 }),
];
const reflections = curtains.map(c => {
  const r = c.clone();
  r.scale.y = -1;      // mirrored below the ice; the lake's tint dims it
  r.position.y = -0.2;
  r.renderOrder = -4;
  return r;
});
scene.add(...curtains, ...reflections);

// ---------------------------------------------------------------- frozen lake, snowy hills, pines
const lake = new THREE.Mesh(new THREE.CircleGeometry(150, 64).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
  uniforms: { uTime: AU.uTime },
  transparent: true, depthWrite: true,
  vertexShader: /* glsl */`
    varying vec3 vP;
    void main() { vP = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vP, 1.0); }`,
  fragmentShader: /* glsl */`
    varying vec3 vP;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec3 V = normalize(cameraPosition - vP);
      float fr = pow(1.0 - max(V.y, 0.0), 2.5);
      // ice cracks and frost speckle
      float crack = step(0.985, hash(floor(vP.xz * 3.0))) * 0.15;
      vec3 c = vec3(0.04, 0.09, 0.18) + crack;
      gl_FragColor = vec4(c, mix(0.72, 0.45, fr));
      #include <colorspace_fragment>
    }`,
}));
lake.position.y = 0;
lake.renderOrder = 1;
scene.add(lake);

const snowMat = new THREE.MeshToonMaterial({ color: '#c9d8f2', gradientMap: toonRamp });
{
  // a ring of snowy hills around the lake, taller toward the back
  const geo = new THREE.RingGeometry(40, 220, 96, 24).rotateX(-Math.PI / 2);
  const pa = geo.attributes.position;
  const rnd = mulberry32(2);
  const ph = [rnd() * 6, rnd() * 6, rnd() * 6];
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i), z = pa.getZ(i), r = Math.hypot(x, z), a = Math.atan2(z, x);
    const back = 0.6 + 0.4 * Math.max(0, -z / r);
    const hgt = Math.max(0, (r - 40)) * 0.14 * back * (1 + 0.35 * Math.sin(a * 5 + ph[0]) + 0.2 * Math.sin(a * 11 + ph[1]));
    pa.setY(i, Math.min(hgt, 16 * back) + Math.sin(x * 0.3 + ph[2]) * 0.2);
  }
  geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, snowMat));
  // near shore bank so the camera stands on snow
  const bank = new THREE.Mesh(new THREE.CircleGeometry(24, 48).rotateX(-Math.PI / 2), snowMat);
  bank.position.set(0, 0.05, 50);
  scene.add(bank);

  const pineMat = new THREE.MeshToonMaterial({ color: '#0f1d33', gradientMap: toonRamp });
  const cone = new THREE.ConeGeometry(1, 2.2, 7);
  for (let i = 0; i < 140; i++) {
    const a = rnd() * Math.PI * 2, r = 42 + rnd() * 30;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z > -6) continue; // only behind the lake, so the ice stays open
    const s = 1.4 + rnd() * 2.2;
    const back = 0.6 + 0.4 * Math.max(0, -z / r);
    const ground = Math.min(Math.max(0, (r - 40)) * 0.14 * back, 16 * back);
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(cone, pineMat);
      m.scale.set(s * (1 - k * 0.25), s * 0.9, s * (1 - k * 0.25));
      m.position.set(x, ground + s * (0.9 + k * 0.9), z);
      scene.add(m);
    }
  }
}
const auroraLight = new THREE.HemisphereLight('#7affc4', '#0a1430', 0.6);
scene.add(auroraLight);
const moon = new THREE.DirectionalLight('#b9c8ff', 0.5);
moon.position.set(30, 25, -60);
scene.add(moon);

// ---------------------------------------------------------------- meteors
const meteors = [];
for (let i = 0; i < 4; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: { uA: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: /* glsl */`
      uniform float uA;
      varying vec2 vUv;
      void main() {
        float a = pow(vUv.x, 3.0) * (1.0 - smoothstep(0.0, 0.5, abs(vUv.y - 0.5)));
        gl_FragColor = vec4(vec3(0.85, 0.92, 1.0) * a * uA, 1.0);
      }`,
  }));
  m.visible = false;
  m.frustumCulled = false;
  m.renderOrder = -3;
  m.userData = { life: 0 };
  meteors.push(m);
  scene.add(m);
}
function meteor(x = (Math.random() - 0.5) * 140, y = 40 + Math.random() * 30) {
  const m = meteors.find(k => k.userData.life <= 0);
  if (!m) return;
  const ang = -0.35 - Math.random() * 0.4;
  m.userData = { life: 1.1, x, y, z: -150, vx: Math.cos(ang) * (Math.random() < 0.5 ? -1 : 1), vy: Math.sin(ang), ang };
  m.visible = true;
}

// ---------------------------------------------------------------- frame
let t = 0, meteorAcc = 0;
function frame(dt, S) {
  t += dt;
  AU.uTime.value = t;
  stars.U.uTime.value = t;
  const b = S.breathShown;
  AU.uAmt.value = 0.55 + 0.75 * b + 0.08 * Math.sin(t * 0.4);
  AU.uLift.value = b;
  stars.U.uBoost.value = 1 - b;
  auroraLight.intensity = 0.35 + 0.5 * b;

  meteorAcc += dt * S.fall * 0.12;
  if (meteorAcc >= 1) { meteorAcc = 0; meteor(); }
  for (const m of meteors) {
    const u = m.userData;
    if (u.life <= 0) { m.visible = false; continue; }
    u.life -= dt;
    const k = 1.1 - u.life;
    m.position.set(u.x + u.vx * k * 70, u.y + u.vy * k * 70, u.z);
    m.rotation.z = Math.atan2(u.vy, u.vx);
    m.scale.set(22, 0.35, 1);
    m.material.uniforms.uA.value = Math.sin(Math.min(1, u.life / 1.1) * Math.PI);
  }
}

function fit() {
  const far = camera.aspect < 1 ? 1.35 : 1;
  camera.position.set(0, 3.4, 36 * far);
  controls.target.set(0, 6, 0);
}

export default {
  scene, frame, fit,
  fov: 50,
  controls: { minDist: 26, maxDist: 52, minPolar: 1.38, maxPolar: 1.75, minAz: -0.7, maxAz: 0.7, autoRotate: false },
  tap(ndc) { meteor(ndc.x * 70, 35 + ndc.y * 30); },
  drop() { meteor(); },
  gust() { meteor(); meteor(); },
  sound: () => ({ drone: 0.35, wind: 0.25, windchime: 0.12 }),
};
