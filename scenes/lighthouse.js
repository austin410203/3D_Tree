import * as THREE from 'three';
import { camera, controls } from '../core.js';
import { makeSky, makeStars, makeOcean, makeGulls, palette, mixInto, toonRamp, mulberry32, glowTexture } from './common.js';

// 燈塔: a striped lighthouse on a rocky islet. Its beam sweeps slowly around
// and brightens on the inhale; waves break white against the rocks.
const scene = new THREE.Scene();
scene.background = new THREE.Color();

const C = palette({
  top: ['#86b9e0', '#040b1f'], horizon: ['#f8d6bf', '#1f2e55'], bottom: ['#a3c7d9', '#08122a'],
  sun: ['#fff0d0', '#e8eeff'], deep: ['#236a92', '#0a1f3c'], shallow: ['#5cb5bd', '#1c4864'],
  rock: ['#8a8590', '#2e3045'], white: ['#f6f3ee', '#9aa0b8'], red: ['#d9534f', '#6a2e3a'], roof: ['#c0443f', '#5a2632'],
});
const SUN_DAY = new THREE.Vector3(-0.45, 0.14, -1).normalize();
const MOON = new THREE.Vector3(0.62, 0.4, -1).normalize();

const sky = makeSky();
scene.add(sky.mesh);
const stars = makeStars(1800, 280, 44);
scene.add(stars.points);
const ocean = makeOcean({ y: 0 });
ocean.U.uHorizon.value = sky.U.uHorizon.value;
ocean.U.uSunDir = sky.U.uSunDir;
ocean.U.uSunCol = sky.U.uSunCol;
scene.add(ocean.mesh);

const hemi = new THREE.HemisphereLight('#ffffff', '#6a7088', 1.1);
const sun = new THREE.DirectionalLight('#ffffff', 1.0);
sun.position.set(-12, 10, -8);
scene.add(hemi, sun);

// ---------------------------------------------------------------- islet, lighthouse, keeper's house
const rockMat = new THREE.MeshToonMaterial({ color: new THREE.Color(), gradientMap: toonRamp });
const whiteMat = new THREE.MeshToonMaterial({ color: new THREE.Color(), gradientMap: toonRamp });
const roofMat = new THREE.MeshToonMaterial({ color: new THREE.Color(), gradientMap: toonRamp });
const ISLE = new THREE.Vector3(0, 0, -6);
{
  const rnd = mulberry32(19);
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, r = rnd() * 4.5, s = 1.2 + rnd() * 2.2;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
    m.position.set(ISLE.x + Math.cos(a) * r, -0.6 + rnd() * 0.8, ISLE.z + Math.sin(a) * r * 0.8);
    m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    scene.add(m);
  }
  const top = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.2, 1.6, 12), rockMat);
  top.position.set(ISLE.x, 0.6, ISLE.z);
  scene.add(top);
}
const tower = new THREE.Group();
const stripeU = { uRed: { value: new THREE.Color() }, uWhite: { value: new THREE.Color() } };
{
  const H = 11;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.35, H, 28, 1), new THREE.MeshToonMaterial({ gradientMap: toonRamp }));
  body.material.onBeforeCompile = sh => { // red and white bands by height
    Object.assign(sh.uniforms, stripeU);
    sh.vertexShader = 'varying float vH;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = position.y;');
    sh.fragmentShader = 'uniform vec3 uRed, uWhite;\nvarying float vH;\n' + sh.fragmentShader.replace(
      'vec4 diffuseColor = vec4( diffuse, opacity );',
      `vec4 diffuseColor = vec4(mix(uWhite, uRed, step(0.5, fract(vH / ${(H / 5).toFixed(2)}))), opacity);`);
  };
  body.position.y = H / 2 + 1.4;
  tower.add(body);
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.18, 24), roofMat);
  gallery.position.y = H + 1.5;
  tower.add(gallery);
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), roofMat);
    p.position.set(Math.cos(a) * 1.18, H + 1.85, Math.sin(a) * 1.18);
    tower.add(p);
  }
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.1, 16), new THREE.MeshBasicMaterial({ color: '#fff3c4' }));
  lantern.position.y = H + 2.15;
  tower.add(lantern);
  const dome = new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.9, 16), roofMat);
  dome.position.y = H + 3.15;
  tower.add(dome);
  tower.position.copy(ISLE);
  scene.add(tower);

  const house = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 1.8), whiteMat);
  house.position.set(ISLE.x + 2.3, 2.1, ISLE.z + 0.8);
  const hroof = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.0, 4), roofMat);
  hroof.rotation.y = Math.PI / 4;
  hroof.position.set(ISLE.x + 2.3, 3.3, ISLE.z + 0.8);
  scene.add(house, hroof);
}
const LAMP_Y = 13.15;

// ---------------------------------------------------------------- the beam
const beamU = { uAmt: { value: 1 } };
const beamMat = new THREE.ShaderMaterial({
  uniforms: beamU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: /* glsl */`
    uniform float uAmt;
    varying vec2 vUv;
    void main() {
      float along = 1.0 - vUv.y;                       // 0 at the lamp, 1 at the far end
      float a = pow(1.0 - along, 1.6) * (0.35 + 0.65 * smoothstep(0.0, 0.15, along));
      gl_FragColor = vec4(vec3(1.0, 0.95, 0.75) * a * uAmt * 0.5, 1.0);
    }`,
});
const beam = new THREE.Group();
for (const s of [1, -1]) {
  const cone = new THREE.Mesh(new THREE.ConeGeometry(4.5, 60, 24, 1, true).translate(0, -30, 0), beamMat);
  cone.rotation.z = s * Math.PI / 2;
  beam.add(cone);
}
beam.position.set(ISLE.x, LAMP_Y, ISLE.z);
scene.add(beam);
const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: '#fff4cc' }));
lampGlow.position.set(ISLE.x, LAMP_Y, ISLE.z);
scene.add(lampGlow);

// surf breaking on the rocks
const surfMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false });
const surf = new THREE.Mesh(new THREE.RingGeometry(4.3, 5.4, 48).rotateX(-Math.PI / 2), surfMat);
surf.position.set(ISLE.x, 0.15, ISLE.z);
surf.scale.z = 0.85;
scene.add(surf);

const gulls = makeGulls({ count: 5, center: [ISLE.x, 6, ISLE.z], radius: [5, 14], height: [2, 8], seed: 31 });
scene.add(gulls.group);

// ---------------------------------------------------------------- frame
let t = 0;
const camDir = new THREE.Vector3(), beamDir = new THREE.Vector3();

function frame(dt, S) {
  t += dt;
  const n = S.night, b = S.breathShown;
  ocean.U.uTime.value = t;
  ocean.U.uChop.value = S.windNow;
  ocean.U.uAmp.value = 0.5 + 0.6 * S.fall;
  mixInto(sky.U.uTop.value, C.top, n);
  mixInto(sky.U.uHorizon.value, C.horizon, n);
  mixInto(sky.U.uBottom.value, C.bottom, n);
  mixInto(sky.U.uSunCol.value, C.sun, n);
  sky.U.uSunDir.value.copy(SUN_DAY).lerp(MOON, n).normalize();
  sky.U.uSunSize.value = THREE.MathUtils.lerp(0.0015, 0.0008, n);
  scene.background.copy(sky.U.uHorizon.value);
  mixInto(ocean.U.uDeep.value, C.deep, n);
  mixInto(ocean.U.uShallow.value, C.shallow, n);
  mixInto(rockMat.color, C.rock, n);
  mixInto(whiteMat.color, C.white, n);
  mixInto(roofMat.color, C.roof, n);
  mixInto(stripeU.uRed.value, C.red, n);
  mixInto(stripeU.uWhite.value, C.white, n);
  hemi.intensity = 1.1 - 0.7 * n;
  sun.intensity = 1.0 - 0.75 * n;
  stars.U.uTime.value = t;
  stars.U.uAmt.value = n;

  // the beam sweeps once every ~12 s; the lamp flashes as it faces us
  beam.rotation.y = t * 0.52;
  const strength = (0.15 + 0.85 * n) * (0.7 + 0.5 * b);
  beamU.uAmt.value = strength;
  camDir.subVectors(camera.position, beam.position).setY(0).normalize();
  beamDir.set(Math.cos(beam.rotation.y), 0, -Math.sin(beam.rotation.y));
  const facing = Math.pow(Math.abs(camDir.dot(beamDir)), 30);
  lampGlow.scale.setScalar(3 + 14 * facing * (0.4 + n));
  lampGlow.material.opacity = 0.5 + 0.5 * facing;

  const k = (t * 0.3) % 1;
  surf.scale.set(1 + k * 0.15, 1, 0.85 + k * 0.12);
  surfMat.opacity = 0.55 * (1 - k) * (0.6 + 0.4 * S.fall);
  gulls.group.visible = n < 0.6;
  gulls.update(t);
}

function fit() {
  const far = camera.aspect < 1 ? 1.5 : 1;
  camera.position.set(-6 * far, 4, 26 * far);
  controls.target.set(0, 6.5, -6);
}

export default {
  scene, frame, fit,
  fov: 45,
  controls: { minDist: 14, maxDist: 60, minPolar: 1.1, maxPolar: 1.62 },
  tap() {},
  drop() {},
  gust() {},
  sound: night => (night ? { waves: 0.5, wind: 0.3, foghorn: 0.35 } : { waves: 0.5, gulls: 0.3, wind: 0.25 }),
};
