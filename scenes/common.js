import * as THREE from 'three';
import { renderer } from '../core.js';

export function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export const toonRamp = (() => {
  const t = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

// a palette entry {day, night} of hex strings → {day: Color, night: Color}
export function palette(def) {
  const out = {};
  for (const [k, [d, n]] of Object.entries(def)) out[k] = { day: new THREE.Color(d), night: new THREE.Color(n) };
  return out;
}
export const mixInto = (out, pair, n) => out.copy(pair.day).lerp(pair.night, n);

// gradient sky dome with a soft sun / moon disc
export function makeSky(radius = 300) {
  const U = {
    uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 0.2, -1).normalize() }, uSunCol: { value: new THREE.Color() },
    uSunSize: { value: 0.0012 }, uGlow: { value: 1 },
  };
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide, depthWrite: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTop, uHorizon, uBottom, uSunDir, uSunCol;
      uniform float uSunSize, uGlow;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = h > 0.0 ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.55, h), 0.75))
                         : mix(uHorizon, uBottom, smoothstep(0.0, -0.15, h));
        float s = dot(d, normalize(uSunDir));
        float disc = smoothstep(1.0 - uSunSize, 1.0 - uSunSize * 0.6, s);
        c = mix(c, uSunCol, disc);
        c += uSunCol * uGlow * (pow(max(s, 0.0), 90.0) * 0.45 + pow(max(s, 0.0), 10.0) * 0.12);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return { mesh, U };
}

// twinkling stars on the upper sky; uAmt fades them in at night
export function makeStars(count = 1500, radius = 280, seed = 3) {
  const rnd = mulberry32(seed);
  const pos = new Float32Array(count * 3), r = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2;
    const y = Math.abs(u) * 0.95 + 0.03, k = Math.sqrt(1 - y * y);
    pos.set([Math.cos(a) * k * radius, y * radius, Math.sin(a) * k * radius], i * 3);
    r[i] = rnd();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aR', new THREE.BufferAttribute(r, 1));
  const U = { uTime: { value: 0 }, uAmt: { value: 0 }, uPx: { value: renderer.getPixelRatio() }, uBoost: { value: 0 } };
  const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uTime, uAmt, uPx, uBoost;
      attribute float aR;
      varying float vA;
      void main() {
        vA = uAmt * (0.35 + 0.65 * aR) * (0.75 + 0.25 * sin(uTime * (1.0 + aR * 3.0) + aR * 50.0)) * (1.0 + uBoost * 0.5);
        gl_PointSize = (1.2 + 2.6 * aR * aR) * uPx;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(vec3(0.9, 0.95, 1.0) * smoothstep(0.5, 0.1, d) * vA, 1.0);
      }`,
  }));
  pts.frustumCulled = false;
  pts.renderOrder = -9;
  return { points: pts, U };
}

// glowing drifting motes (fireflies / embers); uAmt scales brightness
export function makeMotes({ count = 80, box = [8, 4, 8], center = [0, 2, 0], color = [1, 0.92, 0.55], size = 80, seed = 11 }) {
  const rnd = mulberry32(seed);
  const pos = new Float32Array(count * 3), r = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos.set([center[0] + (rnd() - 0.5) * box[0], center[1] + (rnd() - 0.5) * box[1], center[2] + (rnd() - 0.5) * box[2]], i * 3);
    r[i] = rnd();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aR', new THREE.BufferAttribute(r, 1));
  const U = { uTime: { value: 0 }, uAmt: { value: 0 }, uPx: { value: renderer.getPixelRatio() },
    uColor: { value: new THREE.Color(...color) }, uSize: { value: size }, uRise: { value: 0 } };
  const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uTime, uAmt, uPx, uSize, uRise;
      attribute float aR;
      varying float vA;
      void main() {
        float ph = aR * 60.0;
        vec3 p = position + vec3(sin(uTime * 0.31 + ph), sin(uTime * 0.47 + ph * 1.7) * 0.4, cos(uTime * 0.27 + ph * 1.3)) * 0.8;
        p.y += mod(uTime * uRise * (0.5 + aR) + aR * 7.0, 7.0) * sign(uRise);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = uAmt * pow(sin(uTime * (0.6 + aR) + ph) * 0.5 + 0.5, 2.0);
        gl_PointSize = uSize * uPx / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float g = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(uColor * (g * g + 0.6 * smoothstep(0.12, 0.0, d)) * vA, 1.0);
      }`,
  }));
  pts.frustumCulled = false;
  return { points: pts, U };
}

// soft cloud texture drawn once on a canvas
let cloudTex = null;
export function cloudTexture() {
  if (cloudTex) return cloudTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const rnd = mulberry32(9);
  for (let i = 0; i < 14; i++) {
    const x = 50 + rnd() * 156, y = 58 + (rnd() - 0.5) * 30 - Math.sin((x - 50) / 156 * Math.PI) * 18, r = 22 + rnd() * 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  cloudTex = new THREE.CanvasTexture(c);
  cloudTex.colorSpace = THREE.SRGBColorSpace;
  return cloudTex;
}

// ndc tap → point on the horizontal plane y = h (or null)
const ray = new THREE.Raycaster();
export function tapOnPlane(ndc, camera, h = 0) {
  ray.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -h), p) ? p : null;
}
