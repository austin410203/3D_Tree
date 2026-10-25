import * as THREE from 'three';
import { camera, controls } from '../core.js';
import { makeMotes, toonRamp, mulberry32 } from './common.js';

// 燭光: a candle on a low table in a dark room. The flame stretches and brightens
// on the inhale and settles on the exhale; sparks drift up from the wick.
const scene = new THREE.Scene();
scene.background = new THREE.Color('#140d16');

const ambient = new THREE.HemisphereLight(0x6a5070, 0x2a1a18, 1.0);
const fill = new THREE.DirectionalLight('#ffcf9e', 0.45);
fill.position.set(1.5, 3, 6);
scene.add(ambient, fill);

// ---------------------------------------------------------------- room
const wallMat = new THREE.MeshLambertMaterial({ color: '#3a2a35' });
const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), wallMat);
wall.position.set(0, 5, -4.5);
wall.receiveShadow = true;
scene.add(wall);
{ // vertical wooden slats on the wall
  const slatMat = new THREE.MeshLambertMaterial({ color: '#4a3540' });
  for (let i = -14; i <= 14; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.08, 14, 0.05), slatMat);
    s.position.set(i * 0.9, 5, -4.45);
    s.receiveShadow = true;
    scene.add(s);
  }
}
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), new THREE.MeshLambertMaterial({ color: '#241820' }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.6;
floor.receiveShadow = true;
scene.add(floor);

const tableMat = new THREE.MeshLambertMaterial({ color: '#6b4636' });
const table = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.18, 64), tableMat);
table.position.y = -0.09;
table.receiveShadow = true;
scene.add(table);

// ---------------------------------------------------------------- candles
const waxMat = new THREE.MeshLambertMaterial({ color: '#f4e4c6', emissive: '#ffb066', emissiveIntensity: 0.0 });
// wax glows a little just under the melted top, as if the flame shines through it
waxMat.onBeforeCompile = sh => {
  sh.uniforms.uTopY = { value: 1 };
  waxMat.userData.sh = sh;
  sh.vertexShader = 'varying float vH;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = position.y;');
  sh.fragmentShader = 'uniform float uTopY;\nvarying float vH;\n' + sh.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    '#include <emissivemap_fragment>\ntotalEmissiveRadiance = vec3(1.0, 0.62, 0.32) * (0.12 + 0.45 * smoothstep(uTopY - 0.9, uTopY, vH));');
};

function candleGeometry(r, h) {
  const pts = [[0, 0], [r, 0], [r, h - 0.06], [r * 0.97, h], [r * 0.8, h - 0.02], [r * 0.45, h - 0.07], [0, h - 0.08]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 40);
}

const flames = [];
const flameU = { uTime: { value: 0 } };
const flameMat = () => new THREE.ShaderMaterial({
  uniforms: { uTime: flameU.uTime, uSway: { value: 0 }, uSeed: { value: Math.random() * 10 }, uBright: { value: 1 } },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = vec2(position.x, position.y + 0.5);
      // billboard: quad stays upright but always faces the camera
      vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      vec3 sx = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), 1.0);
      mv.xy += vec2(position.x * sx.x, (position.y + 0.5) * sx.y);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    uniform float uTime, uSway, uSeed, uBright;
    varying vec2 vUv;
    void main() {
      float y = vUv.y;
      float wob = sin(uTime * 2.3 + uSeed) * 0.5 + sin(uTime * 5.1 + uSeed * 2.0) * 0.25;
      float x = vUv.x - (uSway + wob * 0.12) * y * y;
      float w = 0.36 * sqrt(clamp(y * 3.0, 0.0, 1.0)) * pow(max(1.0 - y, 0.0), 0.85);
      float d = abs(x) / max(w, 1e-3);
      if (d > 1.0 || y < 0.0) discard;
      float edge = 1.0 - smoothstep(0.55, 1.0, d);
      vec3 hot = vec3(1.0, 0.97, 0.85), mid = vec3(1.0, 0.72, 0.28), rim = vec3(0.95, 0.35, 0.12);
      vec3 c = mix(hot, mid, smoothstep(0.15, 0.6, d + y * 0.5));
      c = mix(c, rim, smoothstep(0.65, 1.0, d + y * 0.35));
      c = mix(c, vec3(0.35, 0.5, 1.0), (1.0 - smoothstep(0.0, 0.16, y)) * 0.7); // blue base
      float a = edge * smoothstep(0.0, 0.05, y) * (1.0 - smoothstep(0.85, 1.0, y));
      gl_FragColor = vec4(c * a * uBright, 1.0);
    }`,
});

let glowTex;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,200,120,1)'); gr.addColorStop(0.25, 'rgba(255,150,70,0.45)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

function addCandle(x, z, r, h, flameH, light) {
  const body = new THREE.Mesh(candleGeometry(r, h), waxMat);
  body.position.set(x, 0, z);
  body.castShadow = true;
  body.receiveShadow = true;
  scene.add(body);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 6), new THREE.MeshBasicMaterial({ color: '#1a1210' }));
  wick.position.set(x, h - 0.02, z);
  wick.rotation.z = 0.12;
  scene.add(wick);
  const flame = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), flameMat());
  flame.position.set(x, h + 0.03, z);
  flame.scale.set(flameH * 0.55, flameH, 1);
  flame.renderOrder = 5;
  flame.frustumCulled = false;
  scene.add(flame);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.position.set(x, h + flameH * 0.4, z);
  glow.scale.setScalar(flameH * 6);
  glow.renderOrder = 4;
  scene.add(glow);
  let pl = null;
  if (light) {
    pl = new THREE.PointLight('#ffb36b', 6, 14, 1.6);
    pl.position.set(x, h + flameH * 0.45, z);
    pl.castShadow = true;
    pl.shadow.mapSize.set(512, 512);
    pl.shadow.bias = -0.004;
    scene.add(pl);
  } else {
    pl = new THREE.PointLight('#ffb36b', 1.2, 5, 2);
    pl.position.set(x, h + flameH * 0.45, z);
    scene.add(pl);
  }
  flames.push({ flame, glow, pl, h, flameH, base: light ? 6 : 1.2, seed: Math.random() * 10, main: light });
}
addCandle(0, 0, 0.42, 1.7, 0.62, true);
addCandle(-1.35, -0.7, 0.32, 1.05, 0.42, false);
addCandle(1.15, -0.95, 0.28, 0.62, 0.38, false);

// ---------------------------------------------------------------- singing bowl and stacked stones
{
  const pts = [[0, 0.02], [0.32, 0.03], [0.55, 0.2], [0.62, 0.42], [0.6, 0.44], [0.53, 0.24], [0.3, 0.09], [0, 0.08]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 48),
    new THREE.MeshToonMaterial({ color: '#b98a3e', gradientMap: toonRamp, side: THREE.DoubleSide }));
  bowl.position.set(1.7, 0, 0.75);
  bowl.castShadow = bowl.receiveShadow = true;
  scene.add(bowl);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 10), new THREE.MeshToonMaterial({ color: '#7a4d2e', gradientMap: toonRamp }));
  stick.position.set(1.0, 0.05, 1.15);
  stick.rotation.set(Math.PI / 2, 0, 0.9);
  stick.castShadow = true;
  scene.add(stick);

  const stoneMat = new THREE.MeshToonMaterial({ color: '#8d8794', gradientMap: toonRamp });
  const rnd = mulberry32(12);
  let y = 0;
  for (const s of [0.36, 0.3, 0.24, 0.17]) {
    const g = new THREE.SphereGeometry(s, 20, 12);
    g.scale(1, 0.42, 0.9);
    const m = new THREE.Mesh(g, stoneMat);
    y += s * 0.42;
    m.position.set(-1.75 + (rnd() - 0.5) * 0.06, y, 0.8);
    m.rotation.y = rnd() * 3;
    y += s * 0.4;
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  }
}

// ---------------------------------------------------------------- sparks and dust
const SPARKS = 90;
const sparkPos = new Float32Array(SPARKS * 3), sparkA = new Float32Array(SPARKS);
const sparkV = new Float32Array(SPARKS * 3), sparkLife = new Float32Array(SPARKS);
const sparkGeo = new THREE.BufferGeometry();
sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
sparkGeo.setAttribute('aA', new THREE.BufferAttribute(sparkA, 1));
const sparks = new THREE.Points(sparkGeo, new THREE.ShaderMaterial({
  uniforms: { uPx: { value: Math.min(devicePixelRatio, 2) } },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */`
    uniform float uPx;
    attribute float aA;
    varying float vA;
    void main() {
      vA = aA;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = 26.0 * uPx / -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    varying float vA;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      gl_FragColor = vec4(vec3(1.0, 0.7, 0.35) * smoothstep(0.5, 0.0, d) * vA, 1.0);
    }`,
}));
sparks.frustumCulled = false;
scene.add(sparks);
let sparkI = 0;
function spark() {
  const f = flames[0], i = sparkI; sparkI = (sparkI + 1) % SPARKS;
  sparkPos.set([f.flame.position.x + (Math.random() - 0.5) * 0.05, f.h + f.flameH * 0.8, f.flame.position.z], i * 3);
  sparkV.set([(Math.random() - 0.5) * 0.15, 0.35 + Math.random() * 0.35, (Math.random() - 0.5) * 0.1], i * 3);
  sparkLife[i] = 1.5 + Math.random() * 2;
}

const dust = makeMotes({ count: 60, box: [6, 4, 4], center: [0, 2, 0], color: [1, 0.8, 0.55], size: 22, seed: 4 });
dust.U.uAmt.value = 0.5;
scene.add(dust.points);

// ---------------------------------------------------------------- frame
let t = 0, flick = 0, sparkAcc = 0, lastB = 0;

function frame(dt, S) {
  t += dt;
  flameU.uTime.value = t;
  dust.U.uTime.value = t;
  const b = S.breathShown;
  flick = Math.max(0, flick - dt * 1.5);
  const sway = (S.windNow - 0.2) * 0.25 + flick * Math.sin(t * 23) * 0.3;

  for (const f of flames) {
    const n = 0.92 + 0.05 * Math.sin(t * 9.7 + f.seed) + 0.04 * Math.sin(t * 17.3 + f.seed * 3) + flick * 0.2 * Math.sin(t * 31);
    const grow = f.main ? 0.82 + 0.5 * b : 0.95 + 0.12 * b;
    f.flame.scale.set(f.flameH * 0.55 * (1 - 0.1 * b), f.flameH * grow * n, 1);
    f.flame.material.uniforms.uSway.value = sway;
    f.flame.material.uniforms.uBright.value = 0.9 + 0.25 * b;
    f.glow.scale.setScalar(f.flameH * (f.main ? 5.5 + 2.5 * b : 5) * n);
    f.glow.material.opacity = (f.main ? 0.55 + 0.3 * b : 0.5) * n;
    f.pl.intensity = f.base * (0.85 + 0.35 * b) * n;
    f.pl.position.x = f.flame.position.x + sway * 0.15;
  }
  if (waxMat.userData.sh) waxMat.userData.sh.uniforms.uTopY.value = 1.7;

  // sparks: a slow trickle (slider) plus a few as each exhale begins
  sparkAcc += dt * S.fall * 1.2;
  if (lastB - b > 0.004 && lastB > 0.85) sparkAcc += 0.5;
  lastB = b;
  while (sparkAcc >= 1) { sparkAcc -= 1; spark(); }
  for (let i = 0; i < SPARKS; i++) {
    if (sparkLife[i] <= 0) { sparkA[i] = 0; continue; }
    sparkLife[i] -= dt;
    sparkV[i * 3] += Math.sin(t * 3 + i) * 0.02 * dt + (S.windNow - 0.2) * 0.05 * dt;
    for (let k = 0; k < 3; k++) sparkPos[i * 3 + k] += sparkV[i * 3 + k] * dt;
    sparkA[i] = Math.min(1, sparkLife[i]) * (0.6 + 0.4 * Math.sin(t * 20 + i));
  }
  sparkGeo.attributes.position.needsUpdate = true;
  sparkGeo.attributes.aA.needsUpdate = true;
}

function fit() {
  const far = camera.aspect < 1 ? 1.5 : 1;
  camera.position.set(0, 2.5, 7.2 * far);
  controls.target.set(0, camera.aspect < 1 ? 0.8 : 1.05, 0);
}

export default {
  scene, frame, fit,
  fov: 40,
  controls: { minDist: 4, maxDist: 13, minPolar: 1.1, maxPolar: 1.62, minAz: -0.8, maxAz: 0.8, autoRotate: false },
  tap() { flick = 1; for (let i = 0; i < 6; i++) spark(); },
  drop(n) { for (let i = 0; i < Math.min(10, n); i++) spark(); },
  gust() { flick = 1.2; },
  sound: () => ({ fire: 0.4, drone: 0.3, brown: 0.12 }),
};
