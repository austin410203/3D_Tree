import * as THREE from 'three';
import { camera, controls } from '../core.js';
import { makeSky, makeStars, makeOcean, makeGulls, palette, mixInto, toonRamp, mulberry32, cloudTexture } from './common.js';

// 海邊觀景台: a wooden lookout on a sea cliff. Gulls wheel below the rail; as
// each exhale begins one glides past close by.
const scene = new THREE.Scene();
scene.background = new THREE.Color();

const C = palette({
  top: ['#7fc0ea', '#06112a'], horizon: ['#fde3c6', '#28385f'], bottom: ['#a9d3e6', '#0b1630'],
  sun: ['#fff3d2', '#e8eeff'], deep: ['#1d6a98', '#0b2140'], shallow: ['#56b8c4', '#1d4c68'],
  cliff: ['#a58c72', '#3c3d52'], grass: ['#8bbf6a', '#2b4a3c'], deck: ['#b98a5e', '#4d4250'], cloud: ['#ffffff', '#56658f'],
});
const SUN_DAY = new THREE.Vector3(0.25, 0.16, -1).normalize();
const MOON = new THREE.Vector3(-0.15, 0.3, -1).normalize();
const SEA_Y = -26;

const sky = makeSky();
scene.add(sky.mesh);
const stars = makeStars(1500, 280, 33);
scene.add(stars.points);
const ocean = makeOcean({ y: SEA_Y });
ocean.U.uHorizon.value = sky.U.uHorizon.value;
ocean.U.uSunDir = sky.U.uSunDir;
ocean.U.uSunCol = sky.U.uSunCol;
ocean.mesh.material.uniforms = ocean.U;
scene.add(ocean.mesh);

const hemi = new THREE.HemisphereLight('#ffffff', '#8a7a68', 1.1);
const sun = new THREE.DirectionalLight('#ffffff', 1.0);
sun.position.set(6, 10, -12);
scene.add(hemi, sun);

// ---------------------------------------------------------------- cliff, headlands, deck
const cliffMat = new THREE.MeshToonMaterial({ color: new THREE.Color(), gradientMap: toonRamp });
const grassMat = new THREE.MeshToonMaterial({ color: new THREE.Color(), gradientMap: toonRamp });
const deckMat = new THREE.MeshToonMaterial({ color: new THREE.Color(), gradientMap: toonRamp });
{
  // the cliff top we stand on, dropping away just past the rail
  const top = new THREE.Mesh(new THREE.BoxGeometry(60, 1, 28), grassMat);
  top.position.set(0, -0.6, 16.1);
  scene.add(top);
  const face = new THREE.Mesh(new THREE.BoxGeometry(60, 30, 3), cliffMat);
  face.position.set(0, -15.5, 3.6);
  scene.add(face);
  // rounded headlands far out along the coast
  for (const [x, z, sx, sy] of [[-70, -95, 40, 16], [-120, -180, 55, 22], [80, -120, 45, 18], [140, -220, 60, 26], [10, -260, 50, 12]]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), cliffMat);
    m.scale.set(sx, sy, sx * 0.55);
    m.position.set(x, SEA_Y - 1, z);
    scene.add(m);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, 0.55), grassMat);
    cap.scale.set(sx * 0.92, sy * 1.02, sx * 0.52);
    cap.position.set(x, SEA_Y - 1, z);
    scene.add(cap);
  }
  // deck planks, posts and rail
  for (let i = 0; i < 12; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(7, 0.12, 0.42), deckMat);
    p.position.set(0, 0, 2.2 + i * 0.46);
    scene.add(p);
  }
  for (let i = 0; i <= 7; i++) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.2, 0.14), deckMat);
    post.position.set(-3.4 + i * (6.8 / 7), 0.6, 2.1);
    scene.add(post);
  }
  for (const y of [1.15, 0.65]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(7, 0.1, 0.12), deckMat);
    rail.position.set(0, y, 2.1);
    scene.add(rail);
  }
  // a coin-operated viewer at the rail
  const metal = new THREE.MeshToonMaterial({ color: '#4f7a8a', gradientMap: toonRamp });
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.1, 10), metal);
  stand.position.set(3.0, 0.55, 2.6);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.3), metal);
  head.position.set(3.0, 1.2, 2.6);
  head.rotation.x = 0.15;
  scene.add(stand, head);
}

const clouds = [];
{
  const rnd = mulberry32(41);
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture(), transparent: true, depthWrite: false, opacity: 0.92 }));
    const w = 30 + rnd() * 45;
    m.scale.set(w, w * 0.4, 1);
    m.position.set((rnd() - 0.5) * 320, 18 + rnd() * 40, -150 - rnd() * 100);
    m.renderOrder = -8;
    clouds.push(m);
    scene.add(m);
  }
}

const gulls = makeGulls({ count: 9, center: [0, -12, -24], radius: [8, 26], height: [0, 13], seed: 9 });
gulls.group.children.forEach(g => g.scale.multiplyScalar(1.8));
scene.add(gulls.group);
// one gull that sweeps past the rail at each exhale
const passer = makeGulls({ count: 1, seed: 77 });
const passBird = passer.group.children[0];
passBird.visible = false;
scene.add(passer.group);
let passT = -1;

// ---------------------------------------------------------------- frame
let t = 0, lastB = 0;
const tmp = new THREE.Color();

function frame(dt, S) {
  t += dt;
  const n = S.night, b = S.breathShown;
  ocean.U.uTime.value = t;
  ocean.U.uChop.value = S.windNow;
  ocean.U.uAmp.value = 0.6 + 0.6 * S.fall;
  mixInto(sky.U.uTop.value, C.top, n);
  mixInto(sky.U.uHorizon.value, C.horizon, n);
  mixInto(sky.U.uBottom.value, C.bottom, n);
  mixInto(sky.U.uSunCol.value, C.sun, n);
  sky.U.uSunDir.value.copy(SUN_DAY).lerp(MOON, n).normalize();
  sky.U.uSunSize.value = THREE.MathUtils.lerp(0.0016, 0.0008, n);
  scene.background.copy(sky.U.uHorizon.value);
  mixInto(ocean.U.uDeep.value, C.deep, n);
  mixInto(ocean.U.uShallow.value, C.shallow, n);
  mixInto(cliffMat.color, C.cliff, n);
  mixInto(grassMat.color, C.grass, n);
  mixInto(deckMat.color, C.deck, n);
  hemi.intensity = 1.1 - 0.7 * n;
  sun.intensity = 1.0 - 0.75 * n;
  stars.U.uTime.value = t;
  stars.U.uAmt.value = n;
  mixInto(tmp, C.cloud, n);
  for (const c of clouds) {
    c.material.color.copy(tmp);
    c.position.x += dt * (0.5 + S.windNow * 1.5);
    if (c.position.x > 170) c.position.x = -170;
  }
  gulls.group.visible = n < 0.6;
  gulls.update(t);

  if (lastB - b > 0.004 && lastB > 0.85 && passT < 0 && n < 0.6) passT = 0;
  lastB = b;
  if (passT >= 0) {
    passT += dt;
    const k = passT / 5;
    passBird.visible = true;
    passBird.position.set(-14 + k * 28, 2.2 + Math.sin(k * Math.PI) * 1.5, -2 - Math.sin(k * Math.PI) * 3);
    passBird.rotation.set(0, Math.atan2(Math.cos(k * Math.PI) * 0.4, 1), -0.2);
    const ang = 0.15 + Math.sin(t * 1.4) * 0.05;
    passBird.userData.wl.rotation.x = ang;
    passBird.userData.wr.rotation.x = -ang;
    if (k >= 1) { passT = -1; passBird.visible = false; }
  }
}

function fit() {
  const far = camera.aspect < 1 ? 1.25 : 1;
  camera.position.set(0, 2.1, 4.4 * far);
  controls.target.set(0, camera.aspect < 1 ? -3.6 : -3, -8);
}

export default {
  scene, frame, fit,
  fov: 50,
  controls: { minDist: 4, maxDist: 14, minPolar: 1.15, maxPolar: 1.7, minAz: -0.75, maxAz: 0.75, autoRotate: false },
  tap() { if (passT < 0) passT = 0; },
  drop() {},
  gust() { if (passT < 0) passT = 0; },
  sound: night => (night ? { waves: 0.4, wind: 0.35, drone: 0.12 } : { gulls: 0.55, waves: 0.35, wind: 0.3 }),
};
