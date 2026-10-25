import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Shared renderer / camera / state for every meditation scene. A scene module's
// default export is { scene, frame(dt, S), fit(), controls?, seasons?, drop?,
// tap?, gust?, regrow?, sound(night) } and is loaded on first use.
export const SCENES = [
  { id: 'tree', name: '四季之樹', icon: '🌳', follow: '樹', desc: '樹冠隨呼吸起伏，落葉隨吐氣飄下', seasons: true, dayNight: true,
    fall: '落葉', regrow: '重新長一棵樹', load: () => import('./tree.js') },
  { id: 'sea', name: '海邊潮汐', icon: '🌊', follow: '海浪', desc: '吸氣時浪退，吐氣時浪湧上沙灘', dayNight: true,
    fall: '浪高', load: () => import('./scenes/sea.js') },
  { id: 'overlook', name: '海邊觀景台', icon: '🕊️', follow: '海風', desc: '懸崖觀景台上看海，海鷗盤旋', dayNight: true,
    fall: '浪高', load: () => import('./scenes/overlook.js') },
  { id: 'lighthouse', name: '燈塔', icon: '🗼', follow: '燈塔的光', desc: '燈塔光束緩緩旋轉，吸氣時更亮', dayNight: true,
    fall: '浪高', load: () => import('./scenes/lighthouse.js') },
  { id: 'whale', name: '深海鯨歌', icon: '🐋', follow: '鯨魚', desc: '鯨魚低鳴游過，吐氣時冒出氣泡', dayNight: false,
    fall: '氣泡', load: () => import('./scenes/whale.js') },
  { id: 'mountain', name: '山間雲海', icon: '⛰️', follow: '雲海', desc: '雲海在山谷間流動，吸氣時雲層升起', dayNight: true,
    fall: '雲量', load: () => import('./scenes/mountain.js') },
  { id: 'deer', name: '森林靈鹿', icon: '🦌', follow: '靈鹿', desc: '銀白幾何鹿帶著藍光在林間跳躍', dayNight: false,
    fall: '光點', load: () => import('./scenes/deer.js') },
  { id: 'lotus', name: '蓮花池', icon: '🌸', follow: '蓮花', desc: '吸氣時蓮花綻放，吐氣時漣漪散開；點水面會起漣漪', dayNight: true,
    fall: '雨量', load: () => import('./scenes/lotus.js') },
  { id: 'rain', name: '雨窗', icon: '🌧️', follow: '雨', desc: '雨滴滑過窗玻璃，吐氣時玻璃起霧；點玻璃可擦亮', dayNight: true, darkUI: true,
    fall: '雨量', load: () => import('./scenes/rain.js') },
  { id: 'snow', name: '雪夜小屋', icon: '❄️', follow: '雪', desc: '雪花飄落，吸氣時雪花停在空中', dayNight: true,
    fall: '雪量', load: () => import('./scenes/snow.js') },
  { id: 'candle', name: '燭光', icon: '🕯️', follow: '燭火', desc: '凝視燭火，火焰隨呼吸伸長、收短', dayNight: false,
    fall: '火星', load: () => import('./scenes/candle.js') },
  { id: 'camp', name: '營火', icon: '🔥', follow: '營火', desc: '林間營火，吸氣時火焰變大，吐氣時火星飛揚', dayNight: false,
    fall: '火星', load: () => import('./scenes/camp.js') },
  { id: 'aurora', name: '極光星空', icon: '🌌', follow: '極光', desc: '極光隨呼吸亮起、流動；點天空會劃過流星', dayNight: false,
    fall: '流星', load: () => import('./scenes/aurora.js') },
];

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

export const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 400);
camera.position.set(3, 5, 16);
export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
renderer.domElement.addEventListener('pointerdown', () => { controls.autoRotate = false; });

// state the app layer drives; scenes read it every frame
export const S = {
  t: 0, wind: 0.45, windNow: 0.45, fall: 1, gustT: 0,
  night: 0, nightTarget: 0, breath: 0, breathShown: 0,
};

const fade = document.createElement('div');
fade.style.cssText = 'position:fixed;inset:0;pointer-events:none;opacity:0;transition:opacity .45s ease';
document.getElementById('app').after(fade);

let active = null, activeId = null, baseFov = 35, autoRotateSpeed = 0.3;
const cache = {};
const wait = ms => new Promise(r => setTimeout(r, ms));

function applyControls(c = {}) {
  controls.minDistance = c.minDist ?? 7;
  controls.maxDistance = c.maxDist ?? 45;
  controls.minPolarAngle = c.minPolar ?? 0;
  controls.maxPolarAngle = c.maxPolar ?? Math.PI * 0.495;
  controls.minAzimuthAngle = c.minAz ?? -Infinity;
  controls.maxAzimuthAngle = c.maxAz ?? Infinity;
  controls.autoRotate = autoRotateSpeed > 0 && c.autoRotate !== false;
  controls.autoRotateSpeed = autoRotateSpeed;
}

async function setScene(id, instant = false) {
  const meta = SCENES.find(s => s.id === id) || SCENES[0];
  if (meta.id === activeId) return;
  const mod = cache[meta.id] ??= (await meta.load()).default;
  if (active && !instant) {
    fade.style.background = '#' + (active.scene.background?.getHexString?.() || '000000');
    fade.style.opacity = 1;
    await wait(460);
  }
  active?.exit?.();
  active = mod; activeId = meta.id;
  baseFov = mod.fov ?? 35;
  camera.fov = baseFov;
  camera.updateProjectionMatrix();
  applyControls(mod.controls);
  if (mod.seasons) mod.seasons.onChange = i => world.onSeason?.(i);
  mod.enter?.();
  mod.fit();
  controls.update();
  frame(0);
  fade.style.opacity = 0;
  world.onScene?.(meta.id);
}

export const world = {
  SCENES,
  onSeason: null,
  onScene: null,
  setScene,
  get scene() { return activeId; },
  get info() { return SCENES.find(s => s.id === activeId); },
  get season() { return active?.seasons?.season ?? 0; },
  setSeason(i) { active?.seasons?.set(i); },
  snapSeason(i) { active?.seasons?.snap(i); },
  setAuto(on) { active?.seasons?.setAuto(on); },
  get auto() { return !!active?.seasons?.auto; },
  setWind(v) { S.wind = v; },
  get wind() { return S.wind; },
  get windNow() { return S.windNow; },
  setFall(v) { S.fall = v; },
  setNight(v, instant = false) { S.nightTarget = v; if (instant) S.night = v; },
  setBreath(v) { S.breath = v; },
  setInteractive(on) { controls.enabled = on; },
  setAutoRotate(speed) {
    autoRotateSpeed = speed;
    controls.autoRotate = speed > 0 && active?.controls?.autoRotate !== false;
    controls.autoRotateSpeed = speed;
  },
  gust() { S.gustT = 3.5; active?.gust?.(); },
  dropLeaves(n, push) { active?.drop?.(n, push); },
  // tap at normalised device coords (-1..1)
  tap(x, y) { active?.tap ? active.tap(new THREE.Vector2(x, y)) : active?.drop?.(8, 0.5); },
  regrow() { active?.regrow?.(); },
  // stop drawing (sleep mode: nothing to look at, save the battery)
  setPaused(on) { renderer.setAnimationLoop(on ? null : () => frame(clock.getDelta())); if (!on) clock.getDelta(); },
  sceneMix(night) { return active?.sound?.(night) ?? {}; },
};

let bgFrame = 0;
export function frame(dt) {
  if (!active) return;
  dt = Math.min(dt, 0.05);
  S.t += dt;

  // wind with gusts
  S.gustT = Math.max(0, S.gustT - dt);
  const g = S.gustT;
  const gust = g > 0 ? Math.sin(Math.min(1, (3.5 - g) / 0.6) * Math.PI / 2) * Math.min(1, g / 1.2) : 0;
  const wobble = 0.8 + 0.25 * Math.sin(S.t * 0.7) + 0.15 * Math.sin(S.t * 1.9 + 1);
  S.windNow = Math.min(1.6, S.wind * wobble + gust * 1.1);

  // day/night and breathing ease toward their targets
  S.night += (S.nightTarget - S.night) * Math.min(1, dt * 0.8);
  S.breathShown += (S.breath - S.breathShown) * Math.min(1, dt * 6);
  const fov = baseFov - 1.6 * S.breathShown;
  if (Math.abs(camera.fov - fov) > 1e-3) { camera.fov = fov; camera.updateProjectionMatrix(); }

  active.frame(dt, S);
  controls.update();
  renderer.render(active.scene, camera);
  if (++bgFrame % 15 === 0 && active.scene.background?.isColor) {
    document.body.style.background = '#' + active.scene.background.getHexString();
  }
}

function resize() {
  const w = innerWidth || 1, h = innerHeight || 1;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  active?.fit();
}
addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => frame(clock.getDelta()));

// debug hook: the hidden preview pane throttles rAF, so tests pump frames by hand
window.__core = { frame(dt = 1 / 60, n = 1) { for (let i = 0; i < n; i++) frame(dt); }, S, world, camera, controls };
