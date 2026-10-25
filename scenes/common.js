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

// billboard candle/camp flame; uSway bends the tip, uBright scales it
export const flameMaterial = timeU => new THREE.ShaderMaterial({
  uniforms: { uTime: timeU, uSway: { value: 0 }, uSeed: { value: Math.random() * 10 }, uBright: { value: 1 } },
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
export function glowTexture() {
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

// open ocean (no beach): gentle travelling waves, crest foam, sun/moon glitter, horizon fresnel
export function makeOcean({ size = 900, seg = 220, y = 0 } = {}) {
  const U = {
    uTime: { value: 0 }, uAmp: { value: 1 }, uChop: { value: 0.4 },
    uDeep: { value: new THREE.Color('#1f6f9c') }, uShallow: { value: new THREE.Color('#5fc4c4') },
    uFoam: { value: new THREE.Color('#ffffff') }, uHorizon: { value: new THREE.Color('#ffd9bd') },
    uSunDir: { value: new THREE.Vector3(0, 0.2, -1).normalize() }, uSunCol: { value: new THREE.Color('#fff1c9') },
    uY: { value: y },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: /* glsl */`
      uniform float uTime, uAmp, uChop, uY;
      varying vec3 vP;
      varying vec3 vN;
      varying float vCrest;
      void wave(vec2 d, float k, float a, float off, vec2 p, inout float h, inout vec2 g) {
        d = normalize(d);
        float ph = dot(d, p) * k - sqrt(9.8 * k) * 0.55 * uTime + off;
        h += a * sin(ph);
        g += a * k * cos(ph) * d;
      }
      void main() {
        vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
        float far = 1.0 - smoothstep(60.0, 260.0, length(p.xz - cameraPosition.xz));
        float a = uAmp * far;
        float h = 0.0; vec2 g = vec2(0.0);
        wave(vec2(0.1, 1.0), 0.18, 0.35 * a, 0.0, p.xz, h, g);
        wave(vec2(-0.4, 1.0), 0.33, 0.16 * a, 1.7, p.xz, h, g);
        wave(vec2(0.6, 1.0), 0.6, 0.08 * a * (0.6 + uChop), 3.1, p.xz, h, g);
        wave(vec2(-0.1, 1.0), 1.2, 0.035 * a * (0.4 + uChop), 0.4, p.xz, h, g);
        p.y = uY + h;
        vP = p;
        vN = normalize(vec3(-g.x, 1.0, -g.y));
        vCrest = h / max(0.001, 0.5 * a + 0.001);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uDeep, uShallow, uFoam, uSunDir, uSunCol, uHorizon;
      uniform float uTime;
      varying vec3 vP;
      varying vec3 vN;
      varying float vCrest;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        vec3 V = normalize(cameraPosition - vP);
        vec3 c = mix(uDeep, uShallow, smoothstep(0.2, 1.0, vCrest) * 0.6);
        float diff = dot(vN, normalize(uSunDir + vec3(0.0, 0.6, 0.0))) * 0.5 + 0.5;
        c *= 0.82 + 0.25 * floor(diff * 3.0) / 3.0;
        float gl = dot(reflect(-V, vN), normalize(uSunDir));
        float path = smoothstep(0.96, 0.997, gl);
        float tw = noise(vP.xz * vec2(1.5, 3.5) + vec2(uTime * 0.6, -uTime * 0.9));
        c += uSunCol * (step(1.25, tw + path * 0.75) * 0.9 + path * 0.12);
        float fr = pow(1.0 - max(V.y, 0.0), 5.0);
        c = mix(c, uHorizon, fr * 0.6);
        float n = noise(vP.xz * 0.6 + uTime * 0.2);
        c = mix(c, uFoam, step(0.92, vCrest + 0.25 * n) * 0.65 * (1.0 - smoothstep(30.0, 90.0, length(vP.xz - cameraPosition.xz))));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2), mat);
  mesh.frustumCulled = false;
  return { mesh, U };
}

// a flock of gulls circling; returns {group, update(t)}
export function makeGulls({ count = 7, center = [0, 6, -20], radius = [8, 22], height = [3, 9], seed = 5 } = {}) {
  const rnd = mulberry32(seed);
  const group = new THREE.Group();
  const white = new THREE.MeshToonMaterial({ color: '#f7f7f4', gradientMap: toonRamp, side: THREE.DoubleSide });
  const grey = new THREE.MeshToonMaterial({ color: '#9aa3ad', gradientMap: toonRamp, side: THREE.DoubleSide });
  const body = new THREE.SphereGeometry(1, 12, 8).scale(0.32, 0.09, 0.09);
  const wingShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.1, 0.55), new THREE.Vector2(-0.05, 0.75),
    new THREE.Vector2(-0.16, 0.5), new THREE.Vector2(-0.14, 0)]);
  const wing = new THREE.ShapeGeometry(wingShape).rotateX(-Math.PI / 2);
  const birds = [];
  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(body, white));
    const wl = new THREE.Mesh(wing, white), wr = new THREE.Mesh(wing, grey);
    wl.scale.z = -1; // mirrored: one wing to each side
    g.add(wl, wr);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 5).rotateZ(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f2b234' }));
    beak.position.x = 0.36;
    g.add(beak);
    g.scale.setScalar(1.6 + rnd() * 0.6);
    g.userData = { r: radius[0] + rnd() * (radius[1] - radius[0]), h: height[0] + rnd() * (height[1] - height[0]),
      sp: (0.08 + rnd() * 0.07) * (rnd() < 0.5 ? 1 : -1), ph: rnd() * 6.28, wl, wr, glide: rnd() * 10 };
    birds.push(g);
    group.add(g);
  }
  function update(t) {
    for (const b of birds) {
      const u = b.userData;
      const a = t * u.sp + u.ph;
      const x = center[0] + Math.cos(a) * u.r, z = center[2] + Math.sin(a) * u.r * 0.6;
      const y = center[1] + u.h + Math.sin(t * 0.5 + u.ph) * 0.8;
      const vx = -Math.sin(a) * u.sp, vz = Math.cos(a) * 0.6 * u.sp;
      b.position.set(x, y, z);
      b.rotation.set(0, Math.atan2(-vz, vx), -Math.sign(u.sp) * 0.25);
      // flap in bursts, then glide with the wings held slightly up
      const flapping = Math.sin(t * 0.35 + u.glide) > 0.3;
      const ang = flapping ? Math.sin(t * 9 + u.ph) * 0.6 : 0.12 + Math.sin(t * 1.3 + u.ph) * 0.05;
      u.wl.rotation.x = ang;
      u.wr.rotation.x = -ang;
    }
  }
  return { group, update };
}

// rising sparks / embers; spawn() adds one, update() moves them
export function makeSparks({ count = 120, size = 26, color = [1, 0.7, 0.35], origin = () => [0, 1, 0], spread = 0.08, rise = [0.35, 0.7] } = {}) {
  const pos = new Float32Array(count * 3), a = new Float32Array(count);
  const vel = new Float32Array(count * 3), life = new Float32Array(count);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aA', new THREE.BufferAttribute(a, 1));
  const points = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: { uPx: { value: renderer.getPixelRatio() }, uSize: { value: size }, uColor: { value: new THREE.Color(...color) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uPx, uSize;
      attribute float aA;
      varying float vA;
      void main() {
        vA = aA;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize * uPx / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(uColor * smoothstep(0.5, 0.0, d) * vA, 1.0);
      }`,
  }));
  points.frustumCulled = false;
  let next = 0;
  function spawn() {
    const i = next; next = (next + 1) % count;
    const [x, y, z] = origin();
    pos.set([x + (Math.random() - 0.5) * spread, y, z + (Math.random() - 0.5) * spread], i * 3);
    vel.set([(Math.random() - 0.5) * 0.3, rise[0] + Math.random() * (rise[1] - rise[0]), (Math.random() - 0.5) * 0.25], i * 3);
    life[i] = 1.5 + Math.random() * 2;
  }
  function update(dt, t, wind = 0) {
    for (let i = 0; i < count; i++) {
      if (life[i] <= 0) { a[i] = 0; continue; }
      life[i] -= dt;
      vel[i * 3] += (Math.sin(t * 3 + i) * 0.05 + wind * 0.08) * dt;
      for (let k = 0; k < 3; k++) pos[i * 3 + k] += vel[i * 3 + k] * dt;
      a[i] = Math.min(1, life[i]) * (0.6 + 0.4 * Math.sin(t * 20 + i));
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aA.needsUpdate = true;
  }
  return { points, spawn, update };
}

// stacked-cone pine; pass snowMat for white caps
const pineCone = new THREE.ConeGeometry(1, 1.6, 8);
const pineTrunkMat = new THREE.MeshToonMaterial({ color: '#4a3426', gradientMap: toonRamp });
export function makePine(mat, s = 1, snowMat = null) {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const r = (1 - k * 0.25) * s;
    const m = new THREE.Mesh(pineCone, mat);
    m.scale.set(r, s, r);
    m.position.y = s * (0.9 + k * 0.85);
    g.add(m);
    if (snowMat) {
      const cap = new THREE.Mesh(pineCone, snowMat);
      cap.scale.set(r * 0.55, s * 0.45, r * 0.55);
      cap.position.y = m.position.y + s * 0.5;
      g.add(cap);
    }
  }
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 0.9 * s, 6), pineTrunkMat);
  trunk.position.y = 0.3 * s;
  g.add(trunk);
  return g;
}
