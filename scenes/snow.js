import * as THREE from 'three';
import { camera, controls, renderer } from '../core.js';
import { makeSky, makeStars, palette, mixInto, toonRamp, mulberry32, cloudTexture, makePine } from './common.js';

// 雪夜小屋: a log cabin in falling snow. On the inhale the flakes slow almost to
// a stop and hang in the air; on the exhale they drift down again. The windows
// glow warmer as you breathe in.
const scene = new THREE.Scene();
scene.background = new THREE.Color();
scene.fog = new THREE.Fog('#c8d4e6', 25, 110);

const C = palette({
  top: ['#9fb7d6', '#050c20'], horizon: ['#dfe6f0', '#1b2a4c'], bottom: ['#c9d5e6', '#0b1530'],
  sun: ['#fff6e8', '#e6eeff'], snow: ['#eef3fb', '#7d8fb8'], pine: ['#355a4b', '#0f2228'],
  wood: ['#7a5038', '#3a2a28'], fog: ['#d2dcea', '#16223f'],
});

const sky = makeSky();
sky.U.uSunDir.value.set(-0.5, 0.35, -1).normalize();
scene.add(sky.mesh);
const stars = makeStars(1500, 280, 21);
scene.add(stars.points);

const hemi = new THREE.HemisphereLight('#dfe8ff', '#8090b0', 1.1);
const sun = new THREE.DirectionalLight('#ffffff', 0.9);
sun.position.set(-10, 14, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 50 });
scene.add(hemi, sun, sun.target);

// ---------------------------------------------------------------- ground
const snowMat = new THREE.MeshToonMaterial({ color: new THREE.Color(), gradientMap: toonRamp });
const groundH = (x, z) => Math.sin(x * 0.08) * 0.8 + Math.cos(z * 0.06 + 1) * 0.9 + Math.sin((x + z) * 0.15) * 0.25 - 0.6 * Math.exp(-(x * x + z * z) / 60);
{
  const g = new THREE.PlaneGeometry(240, 240, 120, 120).rotateX(-Math.PI / 2);
  const pa = g.attributes.position;
  for (let i = 0; i < pa.count; i++) pa.setY(i, groundH(pa.getX(i), pa.getZ(i)));
  g.computeVertexNormals();
  const ground = new THREE.Mesh(g, snowMat);
  ground.receiveShadow = true;
  scene.add(ground);
}

// ---------------------------------------------------------------- cabin
const woodMat = new THREE.MeshToonMaterial({ color: new THREE.Color(), gradientMap: toonRamp });
const darkWood = new THREE.MeshToonMaterial({ color: '#4b3326', gradientMap: toonRamp });
const cabin = new THREE.Group();
{
  const base = groundH(0, 0);
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 2.6), woodMat);
  body.position.y = 1.1;
  body.castShadow = body.receiveShadow = true;
  cabin.add(body);
  for (let i = 0; i < 6; i++) { // log lines
    const l = new THREE.Mesh(new THREE.BoxGeometry(3.46, 0.04, 2.66), darkWood);
    l.position.y = 0.3 + i * 0.36;
    cabin.add(l);
  }
  for (const s of [-1, 1]) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.16, 1.85), darkWood);
    roof.position.set(0, 2.75, s * 0.72);
    roof.rotation.x = s * 0.62;
    roof.castShadow = true;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.2, 1.9), snowMat);
    cap.position.set(0, 2.88, s * 0.76);
    cap.rotation.x = s * 0.62;
    cap.castShadow = true;
    cabin.add(roof, cap);
  }
  const gable = new THREE.Shape([new THREE.Vector2(-1.3, 0), new THREE.Vector2(1.3, 0), new THREE.Vector2(0, 1.05)]);
  for (const x of [-1.7, 1.7]) {
    const g = new THREE.Mesh(new THREE.ShapeGeometry(gable), woodMat);
    g.position.set(x, 2.2, 0);
    g.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2;
    cabin.add(g);
  }
  const chim = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.2, 0.45), new THREE.MeshToonMaterial({ color: '#8a7f7a', gradientMap: toonRamp }));
  chim.position.set(1.0, 3.2, -0.5);
  cabin.add(chim);
  cabin.position.y = base;
  scene.add(cabin);
}
const glowMat = new THREE.MeshBasicMaterial({ color: '#ffcf7a' });
for (const x of [-0.95, 0.95]) {
  const w = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.6), glowMat);
  w.position.set(x, cabin.position.y + 1.35, 1.31);
  const fr = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.04), darkWood);
  fr.position.set(x, cabin.position.y + 1.35, 1.33);
  const fr2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.04), darkWood);
  fr2.position.set(x, cabin.position.y + 1.35, 1.33);
  scene.add(w, fr, fr2);
}
const door = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.4), darkWood);
door.position.set(0, cabin.position.y + 0.7, 1.31);
scene.add(door);
const windowLight = new THREE.PointLight('#ffb867', 4, 9, 1.6);
windowLight.position.set(0, cabin.position.y + 1.3, 2.2);
scene.add(windowLight);

// ---------------------------------------------------------------- pines
const pineMat = new THREE.MeshToonMaterial({ color: new THREE.Color(), gradientMap: toonRamp });
{
  const rnd = mulberry32(14);
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2, r = 7 + rnd() * 45;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z > 3 && Math.abs(x) < 9) continue; // keep the view to the cabin open
    const p = makePine(pineMat, 0.8 + rnd() * 1.1, snowMat);
    p.position.set(x, groundH(x, z) - 0.2, z);
    p.rotation.y = rnd() * 6;
    p.traverse(o => { o.castShadow = true; });
    scene.add(p);
  }
}

// ---------------------------------------------------------------- snowfall (shader-driven points)
const FLAKES = 3500;
const SU = { uOff: { value: 0 }, uWind: { value: 0 }, uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() }, uColor: { value: new THREE.Color('#ffffff') } };
{
  const rnd = mulberry32(3);
  const p = new Float32Array(FLAKES * 3), r = new Float32Array(FLAKES);
  for (let i = 0; i < FLAKES; i++) { p.set([(rnd() - 0.5) * 50, rnd() * 20, (rnd() - 0.5) * 50], i * 3); r[i] = rnd(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('aR', new THREE.BufferAttribute(r, 1));
  const flakes = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: SU, transparent: true, depthWrite: false,
    vertexShader: /* glsl */`
      uniform float uOff, uWind, uTime, uPx;
      attribute float aR;
      varying float vA;
      void main() {
        vec3 p = position;
        p.y = mod(p.y - uOff * (0.6 + 0.8 * aR), 20.0) - 1.0;
        p.x = mod(p.x + uWind * (0.5 + aR) + sin(uTime * 0.7 + aR * 30.0) * 0.6 + 25.0, 50.0) - 25.0;
        p.z += cos(uTime * 0.5 + aR * 20.0) * 0.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = 0.55 + 0.45 * aR;
        gl_PointSize = (2.0 + 4.0 * aR) * uPx * 17.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        gl_FragColor = vec4(uColor, smoothstep(0.5, 0.15, d) * vA);
      }`,
  }));
  flakes.frustumCulled = false;
  scene.add(flakes);
}

// chimney smoke
const smoke = [];
for (let i = 0; i < 6; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture(), transparent: true, depthWrite: false, opacity: 0 }));
  s.userData.ph = i / 6;
  smoke.push(s);
  scene.add(s);
}

// ---------------------------------------------------------------- frame
let t = 0, gust = 0, windOff = 0;
const tmp = new THREE.Color();

function frame(dt, S) {
  t += dt;
  const n = S.night, b = S.breathShown;
  // inhale: the snow hangs in the air; exhale: it falls
  const speed = (0.12 + 0.88 * (1 - b)) * (0.5 + 0.5 * S.fall) * 0.9;
  SU.uOff.value += dt * speed;
  gust = Math.max(0, gust - dt * 0.4);
  windOff += dt * (S.windNow * 0.8 + gust * 6);
  SU.uWind.value = windOff;
  SU.uTime.value = t;

  mixInto(sky.U.uTop.value, C.top, n);
  mixInto(sky.U.uHorizon.value, C.horizon, n);
  mixInto(sky.U.uBottom.value, C.bottom, n);
  mixInto(sky.U.uSunCol.value, C.sun, n);
  sky.U.uSunSize.value = THREE.MathUtils.lerp(0.002, 0.0008, n);
  scene.background.copy(sky.U.uHorizon.value);
  mixInto(scene.fog.color, C.fog, n);
  mixInto(snowMat.color, C.snow, n);
  mixInto(pineMat.color, C.pine, n);
  mixInto(woodMat.color, C.wood, n);
  hemi.intensity = 1.1 - 0.7 * n;
  sun.intensity = 0.9 - 0.65 * n;
  stars.U.uTime.value = t;
  stars.U.uAmt.value = n;
  const warm = 0.85 + 0.25 * b + 0.04 * Math.sin(t * 7) * Math.sin(t * 3);
  glowMat.color.set('#ffcf7a').multiplyScalar(0.75 + 0.4 * n * warm);
  windowLight.intensity = (1.5 + 5 * n) * warm;

  for (const s of smoke) {
    const k = (t * 0.08 + s.userData.ph) % 1;
    s.position.set(1.0 + k * (1.5 + S.windNow * 3), cabin.position.y + 3.9 + k * 4, -0.5);
    s.scale.setScalar(0.6 + k * 2.4);
    s.material.opacity = 0.45 * Math.sin(k * Math.PI);
    s.material.color.copy(tmp.set('#d9dde6').lerp(new THREE.Color('#556080'), n));
  }
}

function fit() {
  const far = camera.aspect < 1 ? 1.45 : 1;
  camera.position.set(5 * far, 3.8, 13 * far);
  controls.target.set(0, camera.aspect < 1 ? 0.4 : 0.9, 0);
}

export default {
  scene, frame, fit,
  fov: 40,
  controls: { minDist: 7, maxDist: 32, minPolar: 0.95, maxPolar: 1.48 },
  tap() { gust = Math.min(2, gust + 1); },
  drop() { gust = Math.min(2, gust + 0.5); },
  gust() { gust = 2; },
  sound: night => (night ? { wind: 0.3, fire: 0.15, drone: 0.25 } : { wind: 0.4, windchime: 0.15 }),
};
