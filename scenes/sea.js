import * as THREE from 'three';
import { camera, controls } from '../core.js';
import { makeSky, makeStars, palette, mixInto, toonRamp, cloudTexture, mulberry32 } from './common.js';

// 海邊潮汐: the sea level follows the breath — it draws back on the inhale and
// runs up the sand on the exhale, leaving a band of wet sand behind.
const scene = new THREE.Scene();
scene.background = new THREE.Color();

const C = palette({
  top: ['#8ec9ee', '#07122b'], horizon: ['#ffd9bd', '#26365f'], bottom: ['#b9d9e6', '#0d1a33'],
  sun: ['#fff1c9', '#e8eeff'],
  deep: ['#1f6f9c', '#0c2340'], shallow: ['#6fcfc6', '#1f4f6a'], foam: ['#ffffff', '#c9d6f0'],
  sand: ['#f0d9ad', '#5b5f7d'], wet: ['#c7a77b', '#3e4362'],
  rock: ['#9a97a6', '#3b3d55'], cloud: ['#ffffff', '#5d6c96'],
});
// kept near the centre so the glitter path shows on narrow phone screens too
const SUN_DAY = new THREE.Vector3(0.16, 0.12, -1).normalize();
const MOON = new THREE.Vector3(-0.1, 0.22, -1).normalize();

const sky = makeSky();
scene.add(sky.mesh);
const stars = makeStars(1600, 280, 5);
scene.add(stars.points);

const U = {
  uTime: { value: 0 }, uLevel: { value: 0 }, uAmp: { value: 1 }, uChop: { value: 0.4 }, uWet: { value: 0 },
  uSunDir: sky.U.uSunDir, uSunCol: sky.U.uSunCol,
  uDeep: { value: new THREE.Color() }, uShallow: { value: new THREE.Color() }, uFoam: { value: new THREE.Color() },
  uSand: { value: new THREE.Color() }, uWetCol: { value: new THREE.Color() }, uHorizon: sky.U.uHorizon,
  uNight: { value: 0 },
};

const SAND_GLSL = /* glsl */`
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
// beach rises gently toward the viewer (+z); shoreline near z = 1.5
float sandY(vec2 p) { return (p.y - 1.5) * 0.085 + (noise(p * 0.35) - 0.5) * 0.12 + sin(p.x * 0.21) * 0.05; }
`;

// ---------------------------------------------------------------- sand
const sandMat = new THREE.ShaderMaterial({
  uniforms: U,
  vertexShader: /* glsl */`
    ${SAND_GLSL}
    varying vec3 vP;
    void main() {
      vec3 p = position;
      p.y = sandY(p.xz);
      vP = p;
      gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
    }`,
  fragmentShader: /* glsl */`
    ${SAND_GLSL}
    uniform vec3 uSand, uWetCol;
    uniform float uWet, uLevel, uTime;
    varying vec3 vP;
    void main() {
      float n = noise(vP.xz * 3.0);
      vec3 c = uSand * (0.93 + 0.1 * n);
      float wet = 1.0 - smoothstep(uWet - 0.01, uWet + 0.03, vP.y);
      c = mix(c, uWetCol, wet * 0.9);
      // ripples drawn in the sand
      float rip = smoothstep(0.75, 1.0, sin(vP.z * 6.0 + noise(vP.xz * 0.8) * 5.0));
      c *= 1.0 - 0.05 * rip;
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }`,
});
const sand = new THREE.Mesh(new THREE.PlaneGeometry(120, 40, 240, 80).rotateX(-Math.PI / 2).translate(0, 0, 12), sandMat);
scene.add(sand);

// ---------------------------------------------------------------- water
const waterMat = new THREE.ShaderMaterial({
  uniforms: U, transparent: true,
  vertexShader: /* glsl */`
    ${SAND_GLSL}
    uniform float uTime, uLevel, uAmp, uChop;
    varying vec3 vP;
    varying vec3 vN;
    varying float vCrest;
    const vec2 D0 = vec2(0.05, 1.0), D1 = vec2(-0.25, 1.0), D2 = vec2(0.35, 1.0), D3 = vec2(0.0, 1.0);
    void wave(vec2 d, float k, float a, float off, vec2 p, inout float h, inout vec2 g) {
      d = normalize(d);
      float w = sqrt(9.8 * k) * 0.55;
      float ph = dot(d, p) * k - w * uTime + off;
      h += a * sin(ph);
      g += a * k * cos(ph) * d;
    }
    void main() {
      vec3 p = position;
      float depth = uLevel - sandY(p.xz);
      float far = 1.0 - smoothstep(40.0, 160.0, -p.z);
      float shoal = smoothstep(-0.2, 1.2, depth);
      float a = uAmp * far * shoal;
      float h = 0.0; vec2 g = vec2(0.0);
      wave(D0, 0.32, 0.16 * a, 0.0, p.xz, h, g);
      wave(D1, 0.55, 0.07 * a, 1.7, p.xz, h, g);
      wave(D2, 0.9, 0.04 * a * (0.6 + uChop), 3.1, p.xz, h, g);
      wave(D3, 1.6, 0.018 * a * (0.4 + uChop), 0.4, p.xz, h, g);
      p.y = uLevel + h;
      vP = p;
      vN = normalize(vec3(-g.x, 1.0, -g.y));
      vCrest = h / max(0.001, 0.25 * a + 0.001);
      gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
    }`,
  fragmentShader: /* glsl */`
    ${SAND_GLSL}
    uniform vec3 uDeep, uShallow, uFoam, uSunDir, uSunCol, uHorizon;
    uniform float uTime, uNight;
    varying vec3 vP;
    varying vec3 vN;
    varying float vCrest;
    void main() {
      float depth = vP.y - sandY(vP.xz);
      if (depth < 0.0) discard;
      vec3 c = mix(uShallow, uDeep, smoothstep(0.05, 2.2, depth));
      vec3 V = normalize(cameraPosition - vP);
      float diff = dot(vN, normalize(uSunDir + vec3(0.0, 0.6, 0.0))) * 0.5 + 0.5;
      c *= 0.82 + 0.25 * floor(diff * 3.0) / 3.0;
      // sun / moon glitter path: sparkles only where the reflection lines up and the noise peaks
      float g = dot(reflect(-V, vN), normalize(uSunDir));
      float path = smoothstep(0.96, 0.997, g);
      float tw = noise(vP.xz * vec2(6.0, 14.0) + vec2(uTime * 0.8, -uTime * 1.3));
      c += uSunCol * step(1.25, tw + path * 0.75) * 0.9;
      c += uSunCol * path * 0.12;
      // fresnel toward the horizon colour
      float fr = pow(1.0 - max(dot(V, vec3(0, 1, 0)), 0.0), 6.0);
      c = mix(c, uHorizon, fr * 0.55);
      // foam: along the shoreline and on wave crests
      float n = noise(vP.xz * 2.2 + vec2(0.0, uTime * 0.6)) + 0.5 * noise(vP.xz * 5.0 - uTime * 0.3);
      float shore = 1.0 - smoothstep(0.02, 0.09 + 0.07 * n, depth);
      float lace = step(1.12, n) * (1.0 - smoothstep(0.05, 0.3, depth));
      float crest = step(0.95, vCrest + 0.2 * n) * (1.0 - smoothstep(15.0, 45.0, -vP.z));
      c = mix(c, uFoam, max(max(shore, lace * 0.8), crest * 0.7));
      float alpha = mix(0.55, 1.0, smoothstep(0.0, 0.35, depth));
      alpha = max(alpha, shore);
      gl_FragColor = vec4(c, alpha);
      #include <colorspace_fragment>
    }`,
});
const water = new THREE.Mesh(new THREE.PlaneGeometry(320, 260, 220, 200).rotateX(-Math.PI / 2).translate(0, 0, -118), waterMat);
water.renderOrder = 1;
scene.add(water);

// ---------------------------------------------------------------- rocks, clouds, a far sailboat
const rockMat = new THREE.MeshToonMaterial({ color: new THREE.Color(), gradientMap: toonRamp });
{
  const rnd = mulberry32(21);
  for (const [x, z, s] of [[-7.5, 4.5, 1.1], [-6.2, 5.6, 0.6], [-11, 1.5, 1.6], [-12.5, 3.2, 0.8]]) {
    const g = new THREE.DodecahedronGeometry(s, 1);
    const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) pa.setY(i, pa.getY(i) * 0.6 + (rnd() - 0.5) * 0.08 * s);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, rockMat);
    m.position.set(x, (z - 1.5) * 0.085 + 0.1, z);
    m.rotation.y = rnd() * 6;
    scene.add(m);
  }
}

const hemi = new THREE.HemisphereLight(0xffffff, 0xb0a080, 0.9);
const sunLight = new THREE.DirectionalLight(0xffffff, 0.9);
sunLight.position.set(6, 6, -10);
scene.add(hemi, sunLight);

const clouds = [];
{
  const rnd = mulberry32(31);
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture(), transparent: true, depthWrite: false, opacity: 0.9 }));
    const w = 30 + rnd() * 40;
    m.scale.set(w, w * 0.4, 1);
    m.position.set((rnd() - 0.5) * 300, 22 + rnd() * 40, -150 - rnd() * 90);
    m.renderOrder = -8;
    clouds.push(m);
    scene.add(m);
  }
}

const boat = new THREE.Group();
{
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.5), new THREE.MeshToonMaterial({ color: 0x8a6650, gradientMap: toonRamp }));
  const sailShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(1.1, 0), new THREE.Vector2(0, 2.2)]);
  const sail = new THREE.Mesh(new THREE.ShapeGeometry(sailShape), new THREE.MeshToonMaterial({ color: 0xfff6ea, gradientMap: toonRamp, side: THREE.DoubleSide }));
  sail.position.set(-0.4, 0.15, 0);
  boat.add(hull, sail);
  boat.position.set(-30, 0.1, -70);
  boat.scale.setScalar(1.4);
  scene.add(boat);
}

// ---------------------------------------------------------------- frame
let t = 0, surge = 0, wet = 0;
const tmp = new THREE.Color();

function frame(dt, S) {
  t += dt;
  const n = S.night;
  U.uTime.value = t;
  U.uNight.value = n;

  // breath: inhale draws the water back, exhale lets it run up the beach
  surge = Math.max(0, surge - dt * 0.35);
  const level = 0.1 - 0.32 * S.breathShown + 0.18 * surge + 0.04 * Math.sin(t * 0.5);
  U.uLevel.value = level;
  wet = Math.max(level + 0.05, wet - dt * 0.015); // wet sand dries slowly
  U.uWet.value = wet;
  U.uAmp.value = (0.55 + 0.45 * S.fall) * (1 + surge * 0.8);
  U.uChop.value = S.windNow;

  mixInto(sky.U.uTop.value, C.top, n);
  mixInto(sky.U.uHorizon.value, C.horizon, n);
  mixInto(sky.U.uBottom.value, C.bottom, n);
  mixInto(sky.U.uSunCol.value, C.sun, n);
  sky.U.uSunDir.value.copy(SUN_DAY).lerp(MOON, n).normalize();
  sky.U.uSunSize.value = THREE.MathUtils.lerp(0.0016, 0.0007, n);
  scene.background.copy(sky.U.uHorizon.value);
  mixInto(U.uDeep.value, C.deep, n);
  mixInto(U.uShallow.value, C.shallow, n);
  mixInto(U.uFoam.value, C.foam, n);
  mixInto(U.uSand.value, C.sand, n);
  mixInto(U.uWetCol.value, C.wet, n);
  mixInto(rockMat.color, C.rock, n);
  hemi.intensity = 0.9 - 0.5 * n;
  sunLight.intensity = 0.9 - 0.6 * n;
  stars.U.uTime.value = t;
  stars.U.uAmt.value = n;

  mixInto(tmp, C.cloud, n);
  for (const c of clouds) {
    c.material.color.copy(tmp);
    c.position.x += dt * (0.4 + S.windNow * 1.5);
    if (c.position.x > 170) c.position.x = -170;
  }
  boat.position.x += dt * 0.25;
  if (boat.position.x > 60) boat.position.x = -60;
  boat.position.y = level + Math.sin(t * 0.9) * 0.06;
  boat.rotation.z = Math.sin(t * 0.7) * 0.05;
}

function fit() {
  camera.position.set(0, 2.3, camera.aspect < 1 ? 13 : 10.5);
  controls.target.set(0, 1.1, -2);
}

export default {
  scene, frame, fit,
  fov: 42,
  controls: { minDist: 7, maxDist: 18, minPolar: 1.2, maxPolar: 1.53, minAz: -0.6, maxAz: 0.6, autoRotate: false },
  gust() { surge = 1; },
  tap() { surge = Math.min(1.2, surge + 0.6); },
  drop() { surge = Math.min(1.2, surge + 0.3); },
  sound: night => (night ? { waves: 0.75, wind: 0.2, drone: 0.15 } : { waves: 0.8, wind: 0.3, birds: 0.08 }),
};
