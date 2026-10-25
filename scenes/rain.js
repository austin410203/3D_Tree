import * as THREE from 'three';
import { camera, controls } from '../core.js';
import { toonRamp, mulberry32, cloudTexture } from './common.js';

// 雨窗: looking out of a window on a rainy day. Drops bead and run down the
// glass; each exhale fogs the pane like breathing on a window, and a tap
// wipes a clear patch that slowly mists over again.
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1a1416');

const W = 4.2, H = 3.0;
const MAX_WIPE = 8;
const U = {
  uTime: { value: 0 }, uRain: { value: 1 }, uFog: { value: 0 }, uNight: { value: 0 }, uAspect: { value: W / H },
  uWipe: { value: Array.from({ length: MAX_WIPE }, () => new THREE.Vector3(0, 0, -99)) },
};
const glass = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.ShaderMaterial({
  uniforms: U,
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform float uTime, uRain, uFog, uNight, uAspect;
    uniform vec3 uWipe[${MAX_WIPE}];
    varying vec2 vUv;
    float h11(float n) { return fract(sin(n * 127.1) * 43758.5453); }
    vec2 h22(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }

    // the street / garden outside, out of focus; blur widens every light
    vec3 outside(vec2 uv, float blur) {
      vec3 c = mix(mix(vec3(0.40, 0.48, 0.52), vec3(0.66, 0.72, 0.77), uv.y),
                   mix(vec3(0.07, 0.08, 0.15), vec3(0.03, 0.05, 0.12), uv.y), uNight);
      float ridge = 0.36 + 0.07 * sin(uv.x * 7.0 + 1.0) + 0.04 * sin(uv.x * 19.0);
      float sil = smoothstep(ridge + 0.03 + blur * 0.06, ridge - 0.03 - blur * 0.06, uv.y);
      c = mix(c, mix(vec3(0.20, 0.30, 0.27), vec3(0.03, 0.04, 0.07), uNight), sil * 0.85);
      for (int i = 0; i < 20; i++) {
        float fi = float(i);
        vec2 p = vec2(h11(fi * 1.7), 0.06 + 0.42 * h11(fi * 3.1));
        float r = 0.012 + 0.022 * h11(fi * 5.3) + blur * 0.04;
        float d = length((uv - p) * vec2(uAspect, 1.0));
        float a = smoothstep(r, r * 0.5, d) * (0.45 + 0.55 * h11(fi * 7.7));
        vec3 lc = mix(vec3(1.0, 0.72, 0.38), vec3(1.0, 0.92, 0.75), h11(fi * 9.1));
        c += lc * a * mix(0.18, 1.0, uNight) / (1.0 + blur * 2.5);
      }
      return c;
    }
    // static beads that come and go: returns normal.xy and mask
    vec3 beads(vec2 uv) {
      vec2 g = uv * vec2(uAspect, 1.0) * 26.0;
      vec2 id = floor(g), f = fract(g) - 0.5, h = h22(id);
      float on = step(1.0 - 0.5 * uRain, h.x);
      vec2 d = f - (h - 0.5) * 0.6;
      float r = 0.1 + 0.16 * h.y;
      float life = fract(uTime * 0.04 + h.y * 7.0);
      float m = smoothstep(r, r * 0.65, length(d)) * on * smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.85, 1.0, life));
      return vec3(d / r, m);
    }
    // a drop sliding down each tall cell, leaving a clear trail: normal.xy, drop mask, trail mask
    vec4 runner(vec2 uv, float scale, float seed) {
      vec2 g = uv * vec2(uAspect, 1.0) * vec2(scale, scale * 0.22);
      vec2 id = floor(g), f = fract(g);
      float h = h11(id.x * 13.0 + id.y * 7.0 + seed);
      if (h < 1.0 - 0.55 * uRain) return vec4(0.0);
      float t = fract(uTime * (0.08 + 0.18 * h) * (0.5 + uRain) + h * 5.0);
      float y = 1.0 - t * t * 0.4 - t * 0.6;   // starts slow, speeds up
      float wig = 0.25 * sin(f.y * 10.0 + h * 30.0) * 0.4;
      float x = 0.5 + wig;
      vec2 d = (f - vec2(0.5 + 0.25 * sin(y * 10.0 + h * 30.0) * 0.4, y)) * vec2(1.0, 4.5);
      float r = 0.17;
      float drop = smoothstep(r, r * 0.7, length(d));
      float above = step(y, f.y) * (1.0 - smoothstep(0.0, 1.0 - y, f.y - y));
      float trail = smoothstep(0.1, 0.03, abs(f.x - x)) * above;
      vec2 td = vec2(f.x - x, (fract(f.y * 9.0) - 0.5) / 9.0 * 4.5);
      float bits = smoothstep(0.05, 0.025, length(td)) * trail * step(0.5, h11(floor(f.y * 9.0) + id.x));
      return vec4(d / r, max(drop, bits), trail);
    }
    void main() {
      vec2 uv = vUv;
      vec3 b = beads(uv);
      vec4 r1 = runner(uv, 7.0, 1.0);
      vec4 r2 = runner(uv + vec2(0.37, 0.21), 11.0, 4.0);
      float drop = max(b.z, max(r1.z, r2.z * 0.9));
      vec2 n = b.xy * b.z + r1.xy * r1.z + r2.xy * r2.z;
      float trail = max(r1.w, r2.w);
      // breath fog: thickest in the middle, cleared by running drops and by wipes
      float fog = uFog * (0.55 + 0.45 * smoothstep(0.95, 0.15, length((uv - 0.5) * vec2(uAspect, 1.0))));
      for (int i = 0; i < ${MAX_WIPE}; i++) {
        float age = uTime - uWipe[i].z;
        if (age < 0.0 || age > 14.0) continue;
        float d = length((uv - uWipe[i].xy) * vec2(uAspect, 1.0));
        fog *= 1.0 - (1.0 - smoothstep(0.12, 0.22, d)) * (1.0 - smoothstep(4.0, 14.0, age));
      }
      fog *= 1.0 - 0.85 * trail;
      vec3 c = outside(uv, 0.35 + 0.7 * fog);
      c = mix(c, mix(vec3(0.78, 0.82, 0.86), vec3(0.22, 0.24, 0.32), uNight), fog * 0.5);
      // each drop is a little lens: the view is flipped and sharper inside it
      vec3 dc = outside(uv - n * 0.05, 0.1) * 1.05;
      dc += 0.35 * smoothstep(0.55, 0.95, dot(normalize(vec3(n, 0.7)), normalize(vec3(-0.5, 0.6, 0.6))));
      c = mix(c, dc, drop);
      c *= 1.0 - 0.3 * drop * smoothstep(0.5, 1.0, length(n));
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }`,
}));
scene.add(glass);

// ---------------------------------------------------------------- room: wall, frame, sill, mug, plant
const wallShape = new THREE.Shape([new THREE.Vector2(-15, -10), new THREE.Vector2(15, -10), new THREE.Vector2(15, 10), new THREE.Vector2(-15, 10)]);
wallShape.holes.push(new THREE.Path([new THREE.Vector2(-W / 2, -H / 2), new THREE.Vector2(-W / 2, H / 2), new THREE.Vector2(W / 2, H / 2), new THREE.Vector2(W / 2, -H / 2)]));
const wallMat = new THREE.MeshLambertMaterial({ color: '#6b5650' });
const wall = new THREE.Mesh(new THREE.ShapeGeometry(wallShape), wallMat);
wall.position.z = 0.12;
scene.add(wall);

const wood = new THREE.MeshToonMaterial({ color: '#8a5a3c', gradientMap: toonRamp });
const T = 0.16;
for (const [w, h, x, y] of [[W + 2 * T, T, 0, H / 2 + T / 2], [W + 2 * T, T, 0, -H / 2 - T / 2], [T, H, -W / 2 - T / 2, 0], [T, H, W / 2 + T / 2, 0],
  [0.07, H, 0, 0], [W, 0.07, 0, 0.25]]) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.22), wood);
  m.position.set(x, y, 0.08);
  scene.add(m);
}
const sill = new THREE.Mesh(new THREE.BoxGeometry(W + 0.9, 0.12, 0.7), wood);
sill.position.set(0, -H / 2 - 0.22, 0.4);
scene.add(sill);

const sillY = -H / 2 - 0.16;
const mugMat = new THREE.MeshToonMaterial({ color: '#e9dccb', gradientMap: toonRamp });
const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.32, 24), mugMat);
mug.position.set(1.35, sillY + 0.16, 0.45);
const handle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 8, 16), mugMat);
handle.position.set(1.54, sillY + 0.17, 0.45);
scene.add(mug, handle);
const tea = new THREE.Mesh(new THREE.CircleGeometry(0.15, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#7a4a2a' }));
tea.position.set(1.35, sillY + 0.3, 0.45);
scene.add(tea);
const steam = [];
for (let i = 0; i < 4; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture(), transparent: true, depthWrite: false, opacity: 0 }));
  s.userData.ph = i / 4;
  steam.push(s);
  scene.add(s);
}

const potMat = new THREE.MeshToonMaterial({ color: '#c97b5a', gradientMap: toonRamp });
const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 20), potMat);
pot.position.set(-1.4, sillY + 0.15, 0.45);
scene.add(pot);
const leafMat = new THREE.MeshToonMaterial({ color: '#5f9a5a', gradientMap: toonRamp });
{
  const rnd = mulberry32(8);
  for (let i = 0; i < 7; i++) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8).scale(0.07, 0.22, 0.03), leafMat);
    const a = i / 7 * Math.PI * 2;
    l.position.set(-1.4 + Math.cos(a) * 0.08, sillY + 0.48 + rnd() * 0.08, 0.45 + Math.sin(a) * 0.08);
    l.rotation.set(Math.sin(a) * 0.5, a, Math.cos(a) * 0.5);
    scene.add(l);
  }
}

const roomLight = new THREE.PointLight('#ffc98a', 2.2, 12, 1.5);
roomLight.position.set(0.5, 1.2, 3.2);
const ambient = new THREE.HemisphereLight('#c9d3e8', '#3a2c28', 0.8);
scene.add(roomLight, ambient);

// ---------------------------------------------------------------- frame
let t = 0, fog = 0, lastB = 0, wipeI = 0;
const ray = new THREE.Raycaster();

function frame(dt, S) {
  t += dt;
  U.uTime.value = t;
  U.uRain.value = Math.min(1, 0.25 + 0.55 * S.fall);
  U.uNight.value = S.night;
  // breathing out mists the glass; it clears slowly while breathing in or resting
  const b = S.breathShown;
  if (b < lastB) fog = Math.min(1, fog + (lastB - b) * 0.85);
  fog = Math.max(0, fog - dt * 0.07);
  lastB = b;
  U.uFog.value = fog;
  wallMat.color.set('#6b5650').lerp(new THREE.Color('#3a2e30'), S.night);
  roomLight.intensity = 1.6 + 1.2 * S.night;
  ambient.intensity = 0.9 - 0.5 * S.night;
  for (const s of steam) {
    const k = (t * 0.25 + s.userData.ph) % 1;
    s.position.set(1.35 + Math.sin(t + s.userData.ph * 6) * 0.05, sillY + 0.4 + k * 0.6, 0.45);
    s.scale.setScalar(0.12 + k * 0.25);
    s.material.opacity = 0.35 * Math.sin(k * Math.PI);
  }
}

function fit() {
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const needW = (W + 1.0) / 2 / (Math.tan(vfov / 2) * camera.aspect), needH = (H + 1.4) / 2 / Math.tan(vfov / 2);
  camera.position.set(0, 0.15, Math.max(needW, needH, 4.2));
  controls.target.set(0, camera.aspect < 1 ? -0.35 : -0.1, 0);
}

export default {
  scene, frame, fit,
  fov: 42,
  controls: { minDist: 3.2, maxDist: 12, minPolar: 1.32, maxPolar: 1.78, minAz: -0.35, maxAz: 0.35, autoRotate: false },
  tap(ndc) {
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(glass)[0];
    if (hit) { U.uWipe.value[wipeI].set(hit.uv.x, hit.uv.y, t); wipeI = (wipeI + 1) % MAX_WIPE; }
  },
  drop() {},
  gust() { fog = Math.min(1, fog + 0.4); },
  sound: night => (night ? { rain: 0.75, thunder: 0.35, drone: 0.12 } : { rain: 0.8, thunder: 0.2 }),
};
