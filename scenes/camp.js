import * as THREE from 'three';
import { camera, controls } from '../core.js';
import { makeSky, makeStars, toonRamp, mulberry32, flameMaterial, glowTexture, makeSparks, makePine, cloudTexture } from './common.js';

// 營火: a campfire in a forest clearing under the stars. The fire swells on the
// inhale and throws up a burst of sparks as the exhale begins.
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0c1428');

const sky = makeSky();
sky.U.uTop.value.set('#040817');
sky.U.uHorizon.value.set('#1c2846');
sky.U.uBottom.value.set('#070b18');
sky.U.uSunDir.value.set(0.45, 0.5, -1).normalize();
sky.U.uSunCol.value.set('#e6ecff');
sky.U.uSunSize.value = 0.0006;
sky.U.uGlow.value = 0.4;
scene.add(sky.mesh);
const stars = makeStars(2200, 280, 17);
stars.U.uAmt.value = 1;
scene.add(stars.points);

const hemi = new THREE.HemisphereLight('#3a4a78', '#1a1410', 0.55);
scene.add(hemi);

// ---------------------------------------------------------------- ground
const grassMat = new THREE.MeshLambertMaterial({ color: '#3a3128' }); // warm earth: green grass looked green-tinted in the firelight
const ground = new THREE.Mesh(new THREE.CircleGeometry(80, 64).rotateX(-Math.PI / 2), grassMat);
ground.receiveShadow = true;
scene.add(ground);
const dirt = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#4b3a2c' }));
dirt.position.y = 0.01;
dirt.receiveShadow = true;
scene.add(dirt);

const stoneMat = new THREE.MeshLambertMaterial({ color: '#7d7a80' });
const logMat = new THREE.MeshLambertMaterial({ color: '#5a3b26' });
const charMat = new THREE.MeshLambertMaterial({ color: '#3a281e', emissive: '#ff5a1a', emissiveIntensity: 0.1 });
{
  const rnd = mulberry32(4);
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + rnd() * 0.06, 0), stoneMat);
    s.position.set(Math.cos(a) * 0.95, 0.1, Math.sin(a) * 0.95);
    s.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    s.castShadow = s.receiveShadow = true;
    scene.add(s);
  }
  for (let i = 0; i < 5; i++) { // burning logs leaning into a cone
    const a = i / 5 * Math.PI * 2 + 0.3;
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.1, 8), charMat);
    l.position.set(Math.cos(a) * 0.3, 0.45, Math.sin(a) * 0.3);
    l.rotation.set(-Math.sin(a) * 0.55, 0, Math.cos(a) * 0.55); // tops lean in over the fire
    scene.add(l);
  }
  for (const [x, z, ry] of [[-2.3, 1.0, 0.4], [2.2, 1.3, -0.5], [0.3, -2.4, 1.5]]) { // logs to sit on
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 1.8, 12), logMat);
    l.position.set(x, 0.2, z);
    l.rotation.set(0, ry, Math.PI / 2);
    l.castShadow = l.receiveShadow = true;
    scene.add(l);
  }
}

// tent: a triangular prism, apex up, door facing the fire
{
  const tentMat = new THREE.MeshLambertMaterial({ color: '#d98b4b', side: THREE.DoubleSide });
  const tri = new THREE.Shape([new THREE.Vector2(-1.1, 0), new THREE.Vector2(1.1, 0), new THREE.Vector2(0, 1.45)]);
  const tent = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 2.6, bevelEnabled: false }).translate(0, 0, -1.3), tentMat);
  const door = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.45, 0), new THREE.Vector2(0.45, 0), new THREE.Vector2(0, 1.0)])),
    new THREE.MeshLambertMaterial({ color: '#3a2a22', side: THREE.DoubleSide }));
  door.position.z = 1.31;
  const g = new THREE.Group();
  g.add(tent, door);
  g.position.set(-3.4, 0, -2.6);
  g.rotation.y = 0.9;
  g.traverse(o => { o.castShadow = o.receiveShadow = true; });
  scene.add(g);
}

// forest ring
{
  const pineMat = new THREE.MeshLambertMaterial({ color: '#1c3026' });
  const rnd = mulberry32(9);
  for (let i = 0; i < 90; i++) {
    const a = rnd() * Math.PI * 2, r = 9 + rnd() * 30;
    const p = makePine(pineMat, 1.2 + rnd() * 1.6);
    p.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    p.rotation.y = rnd() * 6;
    p.traverse(o => { o.castShadow = true; });
    scene.add(p);
  }
}

// ---------------------------------------------------------------- fire
const timeU = { value: 0 };
const tongues = [];
for (const [x, z, h, w] of [[0, 0, 1.5, 0.95], [0.14, 0.08, 1.05, 0.7], [-0.15, 0.05, 1.15, 0.75], [0.05, -0.15, 0.9, 0.6], [-0.05, -0.08, 1.25, 0.8]]) {
  const f = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), flameMaterial(timeU));
  f.position.set(x, 0.18, z);
  f.renderOrder = 5;
  f.frustumCulled = false;
  f.userData = { h, w, seed: Math.random() * 10 };
  tongues.push(f);
  scene.add(f);
}
const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
glow.position.set(0, 0.7, 0);
glow.renderOrder = 4;
scene.add(glow);
const fireLight = new THREE.PointLight('#ff9a4a', 14, 28, 1.6);
fireLight.position.set(0, 0.9, 0);
fireLight.castShadow = true;
fireLight.shadow.mapSize.set(512, 512);
fireLight.shadow.bias = -0.004;
scene.add(fireLight);

const sparks = makeSparks({ count: 200, size: 30, origin: () => [(Math.random() - 0.5) * 0.4, 0.9, (Math.random() - 0.5) * 0.4], spread: 0.2, rise: [0.9, 2.0] });
scene.add(sparks.points);

const smoke = [];
for (let i = 0; i < 5; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture(), transparent: true, depthWrite: false, opacity: 0, color: '#3a3f55' }));
  s.userData.ph = i / 5;
  smoke.push(s);
  scene.add(s);
}

// ---------------------------------------------------------------- frame
let t = 0, sparkAcc = 0, lastB = 0, flare = 0;

function frame(dt, S) {
  t += dt;
  timeU.value = t;
  stars.U.uTime.value = t;
  const b = S.breathShown;
  flare = Math.max(0, flare - dt * 0.8);
  const sway = (S.windNow - 0.2) * 0.3;
  const flick = 0.9 + 0.06 * Math.sin(t * 11) + 0.05 * Math.sin(t * 17.3 + 1) + 0.04 * Math.sin(t * 5.1);
  const size = (1.1 + 0.5 * b + flare * 0.3) * flick;
  for (const f of tongues) {
    const u = f.userData;
    f.scale.set(u.w * size, u.h * size * (0.9 + 0.12 * Math.sin(t * 3 + u.seed)), 1);
    f.material.uniforms.uSway.value = sway + Math.sin(t * 1.7 + u.seed) * 0.05;
    f.material.uniforms.uBright.value = 0.95 + 0.25 * b;
  }
  glow.scale.setScalar(5.5 * size);
  glow.material.opacity = 0.5 + 0.25 * b;
  fireLight.intensity = 11 * size;
  charMat.emissiveIntensity = 0.06 + 0.1 * flick * size;

  sparkAcc += dt * S.fall * 4 * size;
  if (lastB - b > 0.004 && lastB > 0.85) { sparkAcc += 12; flare = 1; } // exhale begins: a burst
  lastB = b;
  while (sparkAcc >= 1) { sparkAcc -= 1; sparks.spawn(); }
  sparks.update(dt, t, S.windNow - 0.2);

  for (const s of smoke) {
    const k = (t * 0.1 + s.userData.ph) % 1;
    s.position.set(sway * k * 4, 1.6 + k * 5, 0);
    s.scale.setScalar(0.8 + k * 3);
    s.material.opacity = 0.3 * Math.sin(k * Math.PI);
  }
}

function fit() {
  const far = camera.aspect < 1 ? 1.4 : 1;
  camera.position.set(1.2 * far, 2.6, 7.2 * far);
  controls.target.set(0, camera.aspect < 1 ? -0.4 : 0.1, 0);
}

export default {
  scene, frame, fit,
  fov: 42,
  controls: { minDist: 3.5, maxDist: 16, minPolar: 0.9, maxPolar: 1.48 },
  tap() { flare = 1; for (let i = 0; i < 14; i++) sparks.spawn(); },
  drop(n) { for (let i = 0; i < Math.min(20, n); i++) sparks.spawn(); },
  gust() { flare = 1; },
  sound: () => ({ campfire: 0.7, crickets: 0.35, wind: 0.12 }),
};
