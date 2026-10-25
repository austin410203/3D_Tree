import { world, SCENES } from './core.js';
import { SoundEngine, TRACKS, PRESETS } from './audio.js';
import { native } from './native.js';

// ---------------------------------------------------------------- data
const PATTERNS = [
  { id: 'natural', name: '自然呼吸', desc: '吸 4 秒・吐 6 秒，最容易上手', steps: [['in', 4], ['out', 6]] },
  { id: 'resonant', name: '共振呼吸', desc: '吸 5.5・吐 5.5，每分鐘約 5.5 次', steps: [['in', 5.5], ['out', 5.5]] },
  { id: 'box', name: '方塊呼吸', desc: '吸 4・停 4・吐 4・停 4，幫助專注', steps: [['in', 4], ['hold', 4], ['out', 4], ['rest', 4]] },
  { id: '478', name: '4-7-8 放鬆', desc: '吸 4・停 7・吐 8，適合睡前', steps: [['in', 4], ['hold', 7], ['out', 8]] },
  { id: 'free', name: '不引導', desc: '只有計時與環境聲，自在呼吸', steps: null },
];
const PHASE_LABEL = { in: '吸氣', hold: '屏息', out: '吐氣', rest: '停' };
const SEASON_NAMES = ['春', '夏', '秋', '冬'];
const PREP = 5; // seconds of "準備" before the first breath

const store = {
  get(k, d) { try { return { ...d, ...JSON.parse(localStorage.getItem(k) || '{}') }; } catch { return { ...d }; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const settings = store.get('seasontree.settings', {
  minutes: 5, sleepMinutes: 30, pattern: 'natural', cue: true, bowl: true, haptic: false,
  scene: 'tree', season: 'auto', time: 'auto', wind: 0.4, fall: 1, preset: 'scene', mix: {}, master: 0.8,
  remind: false, remindTime: '21:30',
});
const stats = store.get('seasontree.stats', { days: {}, sessions: 0 });
const save = () => store.set('seasontree.settings', settings);

const $ = id => document.getElementById(id);
const engine = new SoundEngine();
engine.master = settings.master;

// ---------------------------------------------------------------- scene from date / time
const seasonFromDate = (d = new Date()) => [3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3][d.getMonth()];
function nightFromClock(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 6.5 && h < 17.5) return 0;
  if (h >= 19 || h < 5.5) return 1;
  return h < 12 ? 1 - (h - 5.5) : (h - 17.5) / 1.5; // dawn / dusk blend
}
let nightNow = 0;

function applyScene(instant = false) {
  const info = world.info;
  if (info.seasons) {
    if (settings.season === 'cycle') { if (!world.auto) world.setAuto(true); }
    else {
      const i = settings.season === 'auto' ? seasonFromDate() : settings.season;
      instant ? world.snapSeason(i) : world.setSeason(i);
    }
  }
  // candle and aurora are night scenes whatever the clock says
  nightNow = !info.dayNight ? 1 : settings.time === 'auto' ? nightFromClock() : settings.time === 'night' ? 1 : 0;
  world.setNight(nightNow, instant);
  document.body.classList.toggle('night', nightNow >= 0.5);
  native.statusBar(nightNow >= 0.5);
  world.setWind(sess.on ? Math.min(settings.wind, 0.3) : settings.wind);
  world.setFall(settings.fall);
  updateSubtitle();
  if (settings.preset === 'scene') applySound();
}
function updateSubtitle() {
  const info = world.info;
  $('sceneName').textContent = info.name;
  const parts = [];
  if (info.seasons) parts.push(SEASON_NAMES[world.season]);
  if (info.dayNight) parts.push(nightNow >= 0.5 ? '夜晚' : '白天');
  $('sub').textContent = parts.join('・') || '靜心場景';
}
// scene switch: sheet controls, subtitle and the "跟著場景" sound all follow it
world.onScene = () => { applyScene(true); refreshChips(); };
async function pickScene(id) {
  settings.scene = id; save();
  await world.setScene(id);
}
world.onSeason = () => { updateSubtitle(); if (settings.preset === 'scene') applySound(); refreshChips(); };
setInterval(() => { if (settings.time === 'auto' || settings.season === 'auto') applyScene(); }, 60000);

// ---------------------------------------------------------------- sound
function currentMix() {
  if (sleep.silenced) return {};
  if (settings.preset === 'scene') return world.sceneMix(nightNow >= 0.5);
  if (settings.preset === 'custom') return settings.mix;
  return PRESETS.find(p => p.id === settings.preset)?.mix || {};
}
function applySound() {
  engine.setMix(currentMix());
  syncMixer();
  syncBackgroundAudio();
}
let bgAudioText = '';
function syncBackgroundAudio() {
  const names = TRACKS.filter(t => engine.levels[t.id] > 0).map(t => t.name);
  const text = !engine.running || !names.length ? '' : (sess.on ? '靜心中・' : sleep.on ? '入睡中・' : '') + names.slice(0, 3).join('・');
  if (text === bgAudioText) return;
  bgAudioText = text;
  native.backgroundAudio(!!text, text);
}
native.onBackgroundStop(() => { settings.preset = 'off'; save(); applySound(); refreshChips(); if (sleep.on) endSleep(); });
document.addEventListener('visibilitychange', () => engine.setBackground(document.hidden));
// browsers only allow audio after a gesture: start on the first touch anywhere
addEventListener('pointerdown', () => { if (!engine.running) { engine.start(); applySound(); } }, { capture: true });

// ---------------------------------------------------------------- sleep: listen while falling asleep
const sleep = { on: false, end: 0, silenced: false, timer: 0 };
const SLEEP_TIMES = [15, 30, 45, 60, 90, 0];
const SLEEP_FADE = 60;

function startSleep() {
  closeSheets();
  if (sess.on) finishSession(false);
  engine.start();
  sleep.silenced = false;
  if (settings.preset === 'off') settings.preset = 'sleep';
  save();
  applySound();
  Object.assign(sleep, { on: true, end: settings.sleepMinutes ? engine.ctx.currentTime + settings.sleepMinutes * 60 : 0 });
  if (sleep.end) engine.fadeOutAt(sleep.end, Math.min(SLEEP_FADE, settings.sleepMinutes * 30));
  syncBackgroundAudio();
  native.keepAwake(false);          // let the screen turn off
  world.setPaused(true);
  $('sleepTitle').textContent = '入睡中';
  $('sleepNote').textContent = native.isNative ? '可以直接關掉螢幕，聲音會繼續播放' : '可以關掉螢幕；若瀏覽器停止聲音，請改用 App 版';
  $('sleep').classList.add('on');
  updateSleep();
  clearInterval(sleep.timer);
  sleep.timer = setInterval(updateSleep, 1000);
}

function updateSleep() {
  if (!sleep.on) return;
  if (!sleep.end) { $('sleepLeft').textContent = '不會自動停止'; return; }
  const left = sleep.end - engine.ctx.currentTime;
  if (left <= 0) {
    if (!sleep.silenced) {
      // the fade has already happened on the audio clock; now actually stop the tracks
      sleep.silenced = true;
      settings.preset = 'off'; save();
      engine.setMix({});
      engine.cancelFade();
      syncMixer(); syncBackgroundAudio(); refreshChips();
      $('sleepTitle').textContent = '晚安';
      $('sleepNote').textContent = '';
    }
    $('sleepLeft').textContent = '聲音已經停止';
    return;
  }
  const s = Math.ceil(left);
  $('sleepLeft').textContent = `還有 ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}，之後慢慢停止`;
}

function endSleep() {
  if (!sleep.on) return;
  sleep.on = false;
  clearInterval(sleep.timer);
  engine.cancelFade();
  sleep.silenced = false;
  $('sleep').classList.remove('on');
  world.setPaused(false);
  syncBackgroundAudio();
  poke();
}
$('sleepEnd').onclick = endSleep;
$('sleepStart').onclick = startSleep;
document.addEventListener('visibilitychange', () => { if (!document.hidden) updateSleep(); });

// ---------------------------------------------------------------- session
const sess = { on: false, t: 0, total: 0, pattern: null, idx: -1, quietT: 0,
  audioStart: 0, wallStart: 0, cuesUntil: 0, cues: [], endBowl: null };

// session time in seconds; the audio clock keeps running when the page is hidden
function sessClock() {
  return engine.running ? engine.ctx.currentTime - sess.audioStart : (performance.now() - sess.wallStart) / 1000;
}
// breathing phase at session time t (null while preparing or unguided)
function phaseAt(t) {
  const steps = sess.pattern?.steps;
  if (!steps || t < PREP) return null;
  const cycle = steps.reduce((a, s) => a + s[1], 0);
  const tt = t - PREP, n = Math.floor(tt / cycle);
  let r = tt - n * cycle, idx = 0;
  while (r >= steps[idx][1]) { r -= steps[idx][1]; idx++; }
  return { idx, kind: steps[idx][0], u: r / steps[idx][1], start: t - r, len: steps[idx][1] };
}
function breathAt(t) {
  const ph = phaseAt(t);
  if (!ph) return null;
  return ph.kind === 'in' ? ease(ph.u) : ph.kind === 'hold' ? 1 : ph.kind === 'out' ? 1 - ease(ph.u) : 0;
}
// chimes at every inhale/exhale up to the engine's lookahead (75 s when hidden)
engine.onTick = (now, ahead) => {
  if (!sess.on || !settings.cue || !sess.pattern.steps) return;
  const tEnd = now - sess.audioStart + ahead;
  let t = Math.max(sess.cuesUntil, PREP);
  while (t < tEnd && (!sess.total || t < sess.total + PREP)) {
    const ph = phaseAt(t + 1e-6);
    if (Math.abs(ph.start - t) < 1e-3 && (ph.kind === 'in' || ph.kind === 'out')) {
      const c = engine.chime(ph.kind === 'in', sess.audioStart + t);
      if (c) sess.cues.push(c);
    }
    t = ph.start + ph.len;
  }
  sess.cuesUntil = t;
  sess.cues = sess.cues.filter(c => c.at > now - 3);
};

function startSession() {
  closeSheets();
  engine.start();
  Object.assign(sess, { on: true, t: 0, total: settings.minutes * 60, idx: -1, quietT: 0,
    pattern: PATTERNS.find(p => p.id === settings.pattern) || PATTERNS[0],
    audioStart: engine.ctx.currentTime, wallStart: performance.now(), cuesUntil: 0, cues: [], endBowl: null });
  applySound();
  $('home').classList.add('hide');
  $('session').classList.add('on');
  $('session').classList.remove('quiet');
  $('breathText').textContent = '準備';
  $('breathHint').textContent = sess.pattern.steps ? `放鬆肩膀，跟著${world.info.follow}一起呼吸` : '放鬆肩膀，自在地呼吸';
  $('ring').style.opacity = sess.pattern.steps ? 1 : 0;
  world.setInteractive(false);
  world.setAutoRotate(0.12);
  world.setWind(Math.min(settings.wind, 0.3));
  if (settings.bowl) {
    engine.bowl(196, 0.55);
    if (sess.total) sess.endBowl = engine.bowl(220, 0.6, sess.audioStart + PREP + sess.total);
  }
  engine.breathAt = at => (sess.on ? breathAt(at - sess.audioStart) : null);
  engine.tick();
  native.keepAwake(true);
  updateTimer();
}

function finishSession(completed) {
  if (!sess.on) return;
  sess.on = false;
  const now = engine.running ? engine.ctx.currentTime : 0;
  sess.cues.forEach(c => c.at > now && c.cancel());
  if (!completed) {
    sess.endBowl?.cancel();
    if (settings.bowl) engine.bowl(196, 0.35);
  }
  engine.breathAt = null;
  engine.set({ breathing: false, breath: 0 });
  syncBackgroundAudio();
  world.setBreath(0);
  world.setWind(settings.wind);
  world.setInteractive(true);
  world.setAutoRotate(0.3);
  if (completed) { world.gust(); world.dropLeaves(70, 1.6); }
  native.keepAwake(false);
  $('session').classList.remove('on');

  const secs = Math.round(sess.t - Math.min(sess.t, PREP));
  if (secs >= 30) {
    const k = dayKey(new Date());
    stats.days[k] = (stats.days[k] || 0) + secs;
    stats.sessions++;
    store.set('seasontree.stats', stats);
  }
  if (secs >= 30) {
    const mins = Math.max(1, Math.round(secs / 60));
    $('doneTitle').textContent = completed ? `完成 ${mins} 分鐘靜心` : `靜心了 ${mins} 分鐘`;
    $('doneStats').textContent = `連續 ${streak()} 天・累計 ${totalMinutes()} 分鐘`;
    renderWeek($('doneWeek'));
    setTimeout(() => $('done').classList.add('on'), completed ? 1600 : 300);
  } else {
    $('home').classList.remove('hide');
  }
}
$('doneOk').onclick = () => { $('done').classList.remove('on'); $('home').classList.remove('hide'); poke(); };

const ease = u => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, u)));

function stepSession(dt) {
  sess.t = sessClock();
  sess.quietT += dt;
  $('session').classList.toggle('quiet', sess.quietT > 4);
  updateTimer();
  if (sess.total && sess.t >= sess.total + PREP) return finishSession(true);

  let b = 0, prog = 0, left = 0, hold = false;
  const steps = sess.pattern.steps;
  if (sess.t < PREP) {
    $('breathText').textContent = '準備';
    prog = sess.t / PREP;
    left = PREP - sess.t;
  } else if (!steps) {
    $('breathText').textContent = '';
  } else {
    const ph = phaseAt(sess.t);
    if (ph.idx !== sess.idx) {
      sess.idx = ph.idx;
      $('breathText').textContent = PHASE_LABEL[ph.kind];
      if (settings.haptic && ph.kind !== 'rest') native.haptic(ph.kind === 'out' ? 'double' : 'light');
      if (ph.kind === 'out') world.dropLeaves(5 + Math.floor(Math.random() * 6), 0.3);
    }
    b = breathAt(sess.t);
    prog = ph.u;
    left = ph.len * (1 - ph.u);
    hold = ph.kind === 'hold';
  }
  world.setBreath(b);
  $('orb').style.transform = `scale(${0.3 + 0.7 * b})`;
  $('arc').style.strokeDashoffset = 100 * (1 - prog);
  $('count').textContent = steps || sess.t < PREP ? Math.max(1, Math.ceil(left - 1e-3)) : '';
  $('ring').classList.toggle('hold', hold);
}

function updateTimer() {
  const t = Math.max(0, sess.t - PREP);
  const s = sess.total ? Math.max(0, Math.ceil(sess.total - t)) : Math.floor(t);
  $('timer').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

$('start').onclick = startSession;
$('stop').onclick = () => finishSession(false);

// ---------------------------------------------------------------- stats
const pad = n => String(n).padStart(2, '0');
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function streak() {
  const d = new Date();
  if (!stats.days[dayKey(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (stats.days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function longestStreak() {
  const keys = Object.keys(stats.days).sort();
  let best = 0, run = 0, prev = null;
  for (const k of keys) {
    const d = new Date(k + 'T00:00');
    run = prev && (d - prev) / 864e5 === 1 ? run + 1 : 1;
    best = Math.max(best, run); prev = d;
  }
  return best;
}
const totalMinutes = () => Math.round(Object.values(stats.days).reduce((a, s) => a + s, 0) / 60);
function renderWeek(el) {
  const names = ['日', '一', '二', '三', '四', '五', '六'];
  const today = new Date();
  el.innerHTML = '';
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const on = !!stats.days[dayKey(d)];
    el.insertAdjacentHTML('beforeend', `<div><b class="${on ? 'on' : ''} ${i === 0 ? 'today' : ''}"></b>${names[d.getDay()]}</div>`);
  }
}
function renderStats() {
  $('stats').innerHTML = [
    [streak(), '目前連續天數'], [longestStreak(), '最長連續天數'],
    [totalMinutes(), '累計分鐘'], [stats.sessions, '靜心次數'],
  ].map(([v, l]) => `<div><b>${v}</b><small>${l}</small></div>`).join('');
  renderWeek($('statsWeek'));
}

// ---------------------------------------------------------------- sheets & controls
function openSheet(name) {
  closeSheets();
  if (name === 'stats') renderStats();
  $('sheet-' + name).classList.add('on');
  $('scrim').classList.add('on');
}
function closeSheets() {
  document.querySelectorAll('.sheet.on').forEach(s => s.classList.remove('on'));
  $('scrim').classList.remove('on');
}
document.querySelectorAll('[data-sheet]').forEach(b => b.onclick = () => openSheet(b.dataset.sheet));
document.querySelectorAll('.sheet .close').forEach(b => b.onclick = closeSheets);
$('scrim').onclick = closeSheets;

function chips(el, items, isOn, onPick) {
  el.innerHTML = '';
  for (const it of items) {
    const b = document.createElement('button');
    b.textContent = it.name;
    b.classList.toggle('on', isOn(it));
    b.onclick = () => { onPick(it); refreshChips(); };
    el.appendChild(b);
  }
}
function refreshChips() {
  document.querySelectorAll('#durations button').forEach(b => b.classList.toggle('on', +b.dataset.min === settings.minutes));
  chips($('presets'), PRESETS, p => p.id === settings.preset, p => { settings.preset = p.id; save(); engine.start(); applySound(); });
  $('patterns').innerHTML = '';
  for (const p of PATTERNS) {
    const b = document.createElement('button');
    b.innerHTML = `<b>${p.name}</b><small>${p.desc}</small>`;
    b.classList.toggle('on', p.id === settings.pattern);
    b.onclick = () => { settings.pattern = p.id; save(); refreshChips(); };
    $('patterns').appendChild(b);
  }
  $('sceneList').innerHTML = '';
  for (const sc of SCENES) {
    const b = document.createElement('button');
    b.innerHTML = `<span>${sc.icon}</span><b>${sc.name}</b><small>${sc.desc}</small>`;
    b.classList.toggle('on', sc.id === world.scene);
    b.onclick = () => { pickScene(sc.id); closeSheets(); };
    $('sceneList').appendChild(b);
  }
  const info = world.info;
  $('seasonBox').hidden = !info.seasons;
  $('timeBox').hidden = !info.dayNight;
  $('fallLabel').textContent = info.fall;
  $('regrow').hidden = !info.regrow;
  $('regrow').textContent = info.regrow || '';
  const seasonItems = [{ id: 'auto', name: '跟著今天' }, ...SEASON_NAMES.map((n, i) => ({ id: i, name: n })), { id: 'cycle', name: '四季輪替' }];
  chips($('seasonChips'), seasonItems, it => it.id === settings.season, it => { settings.season = it.id; save(); applyScene(); });
  chips($('sleepTimes'), SLEEP_TIMES.map(m => ({ id: m, name: m ? `${m} 分鐘` : '不停止' })),
    it => it.id === settings.sleepMinutes, it => { settings.sleepMinutes = it.id; save(); });
  chips($('sleepSounds'), PRESETS.filter(p => p.id !== 'off' && p.id !== 'custom'), p => p.id === settings.preset,
    p => { settings.preset = p.id; save(); engine.start(); applySound(); });
  const timeItems = [{ id: 'auto', name: '跟著時間' }, { id: 'day', name: '白天' }, { id: 'night', name: '夜晚' }];
  chips($('timeChips'), timeItems, it => it.id === settings.time, it => { settings.time = it.id; save(); applyScene(); });
}
document.querySelectorAll('#durations button').forEach(b => b.onclick = () => { settings.minutes = +b.dataset.min; save(); refreshChips(); });

// mixer rows
const sliders = {};
for (const t of TRACKS) {
  const row = document.createElement('label');
  row.className = 'track';
  row.innerHTML = `<span>${t.icon}</span><b>${t.name}</b><input type="range" min="0" max="1" step="0.01">`;
  const input = row.querySelector('input');
  input.oninput = () => {
    engine.start();
    if (settings.preset !== 'custom') { settings.mix = { ...currentMix() }; settings.preset = 'custom'; refreshChips(); }
    settings.mix[t.id] = +input.value;
    engine.setLevel(t.id, +input.value);
    syncBackgroundAudio();
    save();
  };
  sliders[t.id] = input;
  $('mixer').appendChild(row);
}
function syncMixer() { for (const t of TRACKS) sliders[t.id].value = engine.levels[t.id] || 0; }

$('master').value = settings.master;
$('master').oninput = e => { settings.master = +e.target.value; engine.setMaster(settings.master); save(); };
for (const k of ['cue', 'bowl', 'haptic']) {
  $(k).checked = settings[k];
  $(k).onchange = e => { settings[k] = e.target.checked; save(); if (k === 'haptic' && settings.haptic) native.haptic('medium'); };
}
$('wind').value = settings.wind;
$('wind').oninput = e => { settings.wind = +e.target.value; world.setWind(settings.wind); save(); };
$('fall').value = settings.fall;
$('fall').oninput = e => { settings.fall = +e.target.value; world.setFall(settings.fall); save(); };
$('regrow').onclick = () => { world.regrow(); closeSheets(); };

// ---------------------------------------------------------------- idle fade + taps on the tree
let idleT = 0;
function poke() { idleT = 0; $('ui').classList.remove('faded'); sess.quietT = 0; }
let down = null;
const canvasHost = $('app');
canvasHost.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvasHost.addEventListener('pointerup', e => {
  if (!down) return;
  const tap = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8 && performance.now() - down.t < 350;
  down = null;
  if (!tap) return;
  const wasFaded = $('ui').classList.contains('faded') || (sess.on && sess.quietT > 4);
  poke();
  if (!wasFaded) {
    world.tap(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    if (settings.haptic) native.haptic('light');
  }
});
addEventListener('pointermove', () => { if (!sess.on) idleT = 0; });
addEventListener('keydown', e => {
  if (sleep.on) { if (e.key === 'Escape') endSleep(); return; }
  poke();
  if (e.key === ' ') { e.preventDefault(); sess.on ? finishSession(false) : $('done').classList.contains('on') ? $('doneOk').click() : startSession(); }
  else if (e.key >= '1' && e.key <= '4') { settings.season = +e.key - 1; save(); applyScene(); }
  else if (e.key === 'Escape') closeSheets();
});

// ---------------------------------------------------------------- loop
function step(dt) {
  dt = Math.min(dt, 0.1);
  if (sess.on) stepSession(dt);
  else {
    idleT += dt;
    const sheetOpen = !!document.querySelector('.sheet.on') || $('done').classList.contains('on');
    $('ui').classList.toggle('faded', idleT > 15 && !sheetOpen);
  }
  engine.set({ wind: world.windNow });
}
let last = performance.now();
(function raf(now) {
  step((now - last) / 1000); last = now;
  requestAnimationFrame(raf);
})(last);

// ---------------------------------------------------------------- daily reminder (app only)
const REMIND_LINES = ['今天也跟著樹呼吸幾分鐘吧 🍃', '樹在等你，來坐一下 🌳', '給自己五分鐘，慢慢吸氣、慢慢吐氣', '葉子落下之前，先放下肩膀 🍂'];
if (native.canRemind) {
  $('remindBox').hidden = false;
  $('remind').checked = settings.remind;
  $('remindTime').value = settings.remindTime;
  const apply = async () => {
    const [h, m] = settings.remindTime.split(':').map(Number);
    const body = REMIND_LINES[Math.floor(Math.random() * REMIND_LINES.length)];
    const ok = await native.setReminder(settings.remind, h, m, body);
    if (!ok && settings.remind) { settings.remind = false; $('remind').checked = false; }
    save();
  };
  $('remind').onchange = e => { settings.remind = e.target.checked; apply(); };
  $('remindTime').onchange = e => { settings.remindTime = e.target.value || '21:30'; if (settings.remind) apply(); else save(); };
}

native.onBack(() => {
  if (sleep.on) { endSleep(); return true; }
  if (document.querySelector('.sheet.on')) { closeSheets(); return true; }
  if (sess.on) { finishSession(false); return true; }
  if ($('done').classList.contains('on')) { $('doneOk').click(); return true; }
  return false;
});

// ---------------------------------------------------------------- boot
await world.setScene(SCENES.some(s => s.id === settings.scene) ? settings.scene : 'tree', true);
refreshChips();
applyScene(true);
world.setAutoRotate(0.3);

// the Android status bar overlays the page and WebView may report no safe-area inset
if (native.isNative) document.documentElement.style.setProperty('--sat', 'max(env(safe-area-inset-top, 0px), 26px)');
requestAnimationFrame(() => native.hideSplash());
if ('serviceWorker' in navigator && location.protocol === 'https:' && !native.isNative) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

window.__app = { step, settings, stats, engine, sess, sleep, startSleep, endSleep, startSession, finishSession, applyScene, openSheet, pickScene };
