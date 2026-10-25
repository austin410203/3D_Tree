// Procedural ambience: every sound is synthesised with Web Audio, so the app
// works offline and carries no audio files or licences.

const NOISE_SECONDS = 8;
const FG_LOOKAHEAD = 0.25;
const BG_LOOKAHEAD = 75;

function noiseBuffer(ctx, kind) {
  const len = ctx.sampleRate * NOISE_SECONDS;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else if (kind === 'pink') { // Paul Kellet's refined filter
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else { // brown
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    // crossfade the loop seam
    const f = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < f; i++) {
      const k = i / f;
      d[len - f + i] = d[len - f + i] * (1 - k) + d[i] * k;
    }
  }
  return buf;
}

const rand = (a, b) => a + Math.random() * (b - a);

// Each track: build(eng, out) wires nodes into `out` (a gain the engine owns)
// and may return { update(p), tick(t) } for live modulation / event scheduling.
export const TRACKS = [
  { id: 'wind', name: '風聲', icon: '🌬️', build(e, out) {
    const src = e.loop('pink');
    const bp = e.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1; bp.frequency.value = 900;
    const cut = e.ctx.createBiquadFilter(); cut.type = 'highpass'; cut.frequency.value = 350;
    const g = e.ctx.createGain(); g.gain.value = 0.2;
    src.connect(cut).connect(bp).connect(g).connect(out);
    const rs = e.loop('white');
    const hp = e.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2600;
    const rg = e.ctx.createGain(); rg.gain.value = 0.02;
    rs.connect(hp).connect(rg).connect(out);
    return { update({ wind, t }) {
      const sway = 0.5 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.13 + 1);
      e.to(bp.frequency, 650 + 900 * Math.min(1, wind) * (0.5 + 0.5 * sway), 0.6);
      e.to(g.gain, (0.14 + 0.6 * Math.min(1.2, wind)) * (0.4 + 0.6 * sway), 0.8);
      e.to(rg.gain, 0.01 + 0.05 * Math.min(1.2, wind) * sway, 0.4);
    } };
  } },
  { id: 'rain', name: '雨聲', icon: '🌧️', build(e, out) {
    const hiss = e.loop('white');
    const hp = e.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    const lp = e.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500;
    const hg = e.ctx.createGain(); hg.gain.value = 0.16;
    hiss.connect(hp).connect(lp).connect(hg).connect(out);
    const rumble = e.loop('brown');
    const rl = e.ctx.createBiquadFilter(); rl.type = 'lowpass'; rl.frequency.value = 380;
    const rgain = e.ctx.createGain(); rgain.gain.value = 0.1;
    rumble.connect(rl).connect(rgain).connect(out);
    let next = 0;
    return { tick(now) { // individual drops on leaves and the roof
      if (next < now) next = now;
      while (next < now + e.lookahead) {
        next += rand(0.015, 0.07);
        const s = e.ctx.createBufferSource(); s.buffer = e.buf('white');
        const f = e.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = rand(1800, 7000); f.Q.value = rand(2, 6);
        const g = e.ctx.createGain(); const a = rand(0.05, 0.35);
        g.gain.setValueAtTime(0, next); g.gain.linearRampToValueAtTime(a, next + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, next + rand(0.02, 0.06));
        const p = e.ctx.createStereoPanner(); p.pan.value = rand(-0.9, 0.9);
        s.connect(f).connect(g).connect(p).connect(out);
        s.start(next, rand(0, NOISE_SECONDS - 0.2), 0.1);
      }
    } };
  } },
  { id: 'stream', name: '溪流', icon: '💧', build(e, out) {
    const src = e.loop('white');
    const bands = [0, 1, 2, 3].map(() => {
      const f = e.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = rand(3, 7); f.frequency.value = rand(500, 2000);
      const g = e.ctx.createGain(); g.gain.value = 0.25;
      src.connect(f).connect(g).connect(out);
      return { f, g, next: 0 };
    });
    const base = e.loop('brown');
    const bl = e.ctx.createBiquadFilter(); bl.type = 'lowpass'; bl.frequency.value = 700;
    const bg = e.ctx.createGain(); bg.gain.value = 0.06;
    base.connect(bl).connect(bg).connect(out);
    return { tick(now) { // babbling: band centres wander quickly
      for (const b of bands) {
        if (b.next < now) b.next = now;
        while (b.next < now + e.lookahead) {
          b.next += rand(0.06, 0.22);
          b.f.frequency.setTargetAtTime(rand(380, 2600), b.next, 0.05);
          b.g.gain.setTargetAtTime(rand(0.08, 0.45), b.next, 0.05);
        }
      }
    } };
  } },
  { id: 'waves', name: '海浪', icon: '🌊', build(e, out) {
    const src = e.loop('pink');
    const lp = e.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    const g = e.ctx.createGain(); g.gain.value = 0.2;
    src.connect(lp).connect(g).connect(out);
    return { update({ breath, breathing, t }) { // follows the breath in a session, else a slow swell
      const v = breathing ? breath : 0.5 - 0.5 * Math.cos(t * Math.PI * 2 / 9);
      e.to(lp.frequency, 300 + 1300 * v, 0.15);
      e.to(g.gain, 0.15 + 0.85 * v, 0.15);
    } };
  } },
  { id: 'birds', name: '鳥鳴', icon: '🐦', build(e, out) {
    let next = 0;
    return { tick(now) {
      if (next < now) next = now + rand(0.5, 2);
      while (next < now + e.lookahead) phrase();
    } };
    function phrase() {
      const t0 = next, n = Math.floor(rand(2, 7)), f0 = rand(2400, 4600), pan = rand(-0.85, 0.85);
      const p = e.ctx.createStereoPanner(); p.pan.value = pan; p.connect(out);
      let t = t0;
      for (let k = 0; k < n; k++) {
        const o = e.ctx.createOscillator(); o.type = 'sine';
        const d = rand(0.05, 0.14), f = f0 * rand(0.85, 1.15);
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * rand(0.65, 1.45), t + d);
        const g = e.ctx.createGain();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(rand(0.05, 0.12), t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(p); o.start(t); o.stop(t + d + 0.02);
        t += d + rand(0.03, 0.12);
      }
      next = t + rand(2.5, 9);
    }
  } },
  { id: 'crickets', name: '蟲鳴', icon: '🦗', build(e, out) {
    const voices = [0, 1, 2].map(() => ({ f: rand(3900, 4800), pan: rand(-0.8, 0.8), next: 0, gap: rand(0.5, 0.9) }));
    return { tick(now) {
      for (const v of voices) {
        if (v.next < now) v.next = now + rand(0, 0.5);
        while (v.next < now + e.lookahead) {
          const o = e.ctx.createOscillator(); o.frequency.value = v.f;
          const g = e.ctx.createGain(); g.gain.value = 0;
          const p = e.ctx.createStereoPanner(); p.pan.value = v.pan;
          o.connect(g).connect(p).connect(out);
          let t = v.next;
          for (let k = 0; k < 3; k++) { // three pulses per chirp
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.004);
            g.gain.linearRampToValueAtTime(0, t + 0.018); t += 0.03;
          }
          o.start(v.next); o.stop(t + 0.02);
          v.next += v.gap * rand(0.9, 1.1);
        }
      }
    } };
  } },
  { id: 'fire', name: '燭火', icon: '🔥', build(e, out) {
    const roar = e.loop('pink');
    const lp = e.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
    const rg = e.ctx.createGain(); rg.gain.value = 0.07;
    roar.connect(lp).connect(rg).connect(out);
    let next = 0;
    return { tick(now) { // soft crackles, sometimes in little clusters
      if (next < now) next = now;
      while (next < now + e.lookahead) {
        next += Math.random() < 0.25 ? rand(0.02, 0.08) : rand(0.15, 0.9);
        const s = e.ctx.createBufferSource(); s.buffer = e.buf('white');
        const f = e.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = rand(1200, 3500);
        const g = e.ctx.createGain(); const a = rand(0.05, 0.3), d = rand(0.003, 0.012);
        g.gain.setValueAtTime(a, next); g.gain.exponentialRampToValueAtTime(0.0001, next + d);
        s.connect(f).connect(g).connect(out);
        s.start(next, rand(0, NOISE_SECONDS - 0.1), d + 0.01);
      }
    } };
  } },
  { id: 'windchime', name: '風鈴', icon: '🔔', build(e, out) {
    const NOTES = [523.3, 587.3, 659.3, 784, 880, 1046.5];
    let next = 0;
    return { tick(now) {
      if (next < now) next = now + rand(0.5, 3);
      while (next < now + e.lookahead) {
        const strikes = 1 + Math.floor(Math.random() * 4);
        let t = next;
        for (let k = 0; k < strikes; k++) {
          const f = NOTES[Math.floor(Math.random() * NOTES.length)];
          const p = e.ctx.createStereoPanner(); p.pan.value = rand(-0.7, 0.7); p.connect(out);
          for (const [m, a, dur] of [[1, 0.09, 3.5], [2.76, 0.03, 1.6], [5.4, 0.012, 0.8]]) {
            const o = e.ctx.createOscillator(); o.frequency.value = f * m;
            const g = e.ctx.createGain();
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.005);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(g).connect(p); o.start(t); o.stop(t + dur + 0.05);
          }
          t += rand(0.15, 0.6);
        }
        next = t + rand(2.5, 9);
      }
    } };
  } },
  { id: 'campfire', name: '營火', icon: '🏕️', build(e, out) {
    const roar = e.loop('pink');
    const lp = e.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    const rg = e.ctx.createGain(); rg.gain.value = 0.2;
    roar.connect(lp).connect(rg).connect(out);
    let next = 0, pop = 0;
    return { update({ t }) { e.to(rg.gain, 0.16 + 0.08 * Math.sin(t * 0.7) * Math.sin(t * 1.9), 0.3); },
      tick(now) {
        if (next < now) next = now;
        while (next < now + e.lookahead) { // busy crackle of burning wood
          next += Math.random() < 0.35 ? rand(0.01, 0.05) : rand(0.06, 0.35);
          const s = e.ctx.createBufferSource(); s.buffer = e.buf('white');
          const f = e.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = rand(1500, 5000); f.Q.value = rand(0.8, 3);
          const g = e.ctx.createGain(); const a = rand(0.08, 0.5), d = rand(0.003, 0.02);
          g.gain.setValueAtTime(a, next); g.gain.exponentialRampToValueAtTime(0.0001, next + d);
          s.connect(f).connect(g).connect(out);
          s.start(next, rand(0, NOISE_SECONDS - 0.1), d + 0.01);
        }
        if (pop < now) pop = now + rand(1, 4);
        while (pop < now + e.lookahead) { // the odd deeper pop of a knot in the log
          const o = e.ctx.createOscillator(); o.frequency.setValueAtTime(rand(90, 160), pop);
          o.frequency.exponentialRampToValueAtTime(50, pop + 0.12);
          const g = e.ctx.createGain(); g.gain.setValueAtTime(0.25, pop); g.gain.exponentialRampToValueAtTime(0.0001, pop + 0.15);
          o.connect(g).connect(out); o.start(pop); o.stop(pop + 0.2);
          pop += rand(2, 7);
        }
      } };
  } },
  { id: 'thunder', name: '遠雷', icon: '⛈️', build(e, out) {
    let next = 0;
    return { tick(now) {
      if (next < now) next = now + rand(8, 25);
      while (next < now + e.lookahead) {
        const s = e.ctx.createBufferSource(); s.buffer = e.buf('brown');
        const f = e.ctx.createBiquadFilter(); f.type = 'lowpass';
        f.frequency.setValueAtTime(rand(250, 500), next); f.frequency.exponentialRampToValueAtTime(90, next + 5);
        const g = e.ctx.createGain(); const peak = rand(0.5, 1), rise = rand(0.3, 1.2), dur = rand(4, 7);
        g.gain.setValueAtTime(0.0001, next); g.gain.exponentialRampToValueAtTime(peak, next + rise);
        g.gain.exponentialRampToValueAtTime(peak * 0.4, next + rise + 0.8);
        g.gain.exponentialRampToValueAtTime(0.0001, next + dur);
        s.connect(f).connect(g).connect(out);
        s.start(next, rand(0, NOISE_SECONDS - dur), dur + 0.1);
        next += rand(25, 70);
      }
    } };
  } },
  { id: 'whale', name: '鯨歌', icon: '🐋', build(e, out) {
    // a long watery echo shared by every call
    const wet = e.ctx.createGain(); wet.gain.value = 0.55;
    const dl = e.ctx.createDelay(2); dl.delayTime.value = 0.7;
    const fb = e.ctx.createGain(); fb.gain.value = 0.5;
    const dlp = e.ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 700;
    wet.connect(dl).connect(dlp).connect(fb).connect(dl);
    dlp.connect(out);
    let next = 0;
    return { tick(now) {
      if (next < now) next = now + rand(1, 4);
      while (next < now + e.lookahead) {
        const notes = 1 + Math.floor(Math.random() * 3);
        let t = next;
        for (let k = 0; k < notes; k++) {
          const dur = rand(1.6, 4), f0 = rand(110, 360), f1 = f0 * rand(0.5, 1.9);
          const o = e.ctx.createOscillator(); o.type = 'sine';
          o.frequency.setValueAtTime(f0, t);
          o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
          o.frequency.exponentialRampToValueAtTime(f0 * rand(0.7, 1.2), t + dur);
          const o2 = e.ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 2; // gentle warble
          const vib = e.ctx.createGain(); vib.gain.value = f0 * 0.02;
          o2.connect(vib).connect(o.frequency);
          const lp = e.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
          const g = e.ctx.createGain();
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + dur * 0.3);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.connect(lp).connect(g); g.connect(out); g.connect(wet);
          o.start(t); o.stop(t + dur + 0.1); o2.start(t); o2.stop(t + dur + 0.1);
          t += dur * rand(0.7, 1.1);
        }
        next = t + rand(5, 14);
      }
    } };
  } },
  { id: 'gulls', name: '海鷗', icon: '🕊️', build(e, out) {
    let next = 0;
    return { tick(now) {
      if (next < now) next = now + rand(0.5, 3);
      while (next < now + e.lookahead) {
        const calls = 1 + Math.floor(Math.random() * 4), pan = rand(-0.8, 0.8), far = rand(0.35, 1);
        const p = e.ctx.createStereoPanner(); p.pan.value = pan; p.connect(out);
        let t = next;
        for (let k = 0; k < calls; k++) { // "kee-ow": a raspy rise then a long fall
          const d = rand(0.25, 0.5), f0 = rand(1300, 1800);
          const o = e.ctx.createOscillator(); o.type = 'sawtooth';
          o.frequency.setValueAtTime(f0, t);
          o.frequency.linearRampToValueAtTime(f0 * 1.35, t + d * 0.25);
          o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + d);
          const rasp = e.ctx.createOscillator(); rasp.frequency.value = rand(28, 45);
          const rg = e.ctx.createGain(); rg.gain.value = 60;
          rasp.connect(rg).connect(o.frequency);
          const bp = e.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 2.5;
          const g = e.ctx.createGain();
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16 * far, t + 0.03);
          g.gain.exponentialRampToValueAtTime(0.0001, t + d);
          o.connect(bp).connect(g).connect(p);
          o.start(t); o.stop(t + d + 0.05); rasp.start(t); rasp.stop(t + d + 0.05);
          t += d + rand(0.05, 0.25);
        }
        next = t + rand(2.5, 9);
      }
    } };
  } },
  { id: 'foghorn', name: '霧笛', icon: '📯', build(e, out) {
    const dl = e.ctx.createDelay(3); dl.delayTime.value = 1.4;
    const fb = e.ctx.createGain(); fb.gain.value = 0.35;
    const lpE = e.ctx.createBiquadFilter(); lpE.type = 'lowpass'; lpE.frequency.value = 300;
    dl.connect(lpE).connect(fb).connect(dl);
    lpE.connect(out);
    let next = 0;
    return { tick(now) {
      if (next < now) next = now + rand(3, 10);
      while (next < now + e.lookahead) {
        const t = next, dur = rand(2.2, 3.2);
        const lp = e.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
        const g = e.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.35);
        g.gain.setValueAtTime(0.3, t + dur - 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.8);
        lp.connect(g); g.connect(out); g.connect(dl);
        for (const f of [92, 92.7, 138]) {
          const o = e.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
          o.connect(lp); o.start(t); o.stop(t + dur + 0.9);
        }
        next = t + rand(22, 40);
      }
    } };
  } },
  { id: 'drone', name: '冥想音墊', icon: '🎐', build(e, out) {
    const lp = e.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = e.ctx.createGain(); g.gain.value = 0.5;
    lp.connect(g).connect(out);
    for (const [f, a] of [[110, 0.3], [110.6, 0.25], [164.8, 0.18], [220.3, 0.12], [329.6, 0.05]]) {
      const o = e.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const og = e.ctx.createGain(); og.gain.value = a;
      o.connect(og).connect(lp); o.start();
    }
    return { update({ t }) { e.to(g.gain, 0.35 + 0.15 * Math.sin(t * 0.21), 0.5); } };
  } },
  { id: 'white', name: '白噪音', icon: '⚪', build(e, out) {
    const lp = e.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000;
    const g = e.ctx.createGain(); g.gain.value = 0.18;
    e.loop('white').connect(lp).connect(g).connect(out);
  } },
  { id: 'pink', name: '粉紅噪音', icon: '🩷', build(e, out) {
    const g = e.ctx.createGain(); g.gain.value = 0.45;
    e.loop('pink').connect(g).connect(out);
  } },
  { id: 'brown', name: '棕噪音', icon: '🟤', build(e, out) {
    const g = e.ctx.createGain(); g.gain.value = 0.55;
    e.loop('brown').connect(g).connect(out);
  } },
];

export const PRESETS = [
  { id: 'scene', name: '跟著場景' },
  { id: 'forest', name: '森林午後', mix: { wind: 0.5, birds: 0.6, stream: 0.35 } },
  { id: 'rainnight', name: '雨夜', mix: { rain: 0.75, brown: 0.25, drone: 0.2 } },
  { id: 'summer', name: '夏夜', mix: { crickets: 0.55, wind: 0.3, stream: 0.25 } },
  { id: 'sea', name: '海邊', mix: { waves: 0.7, wind: 0.25 } },
  { id: 'candlelight', name: '燭光', mix: { fire: 0.45, drone: 0.3 } },
  { id: 'chimes', name: '風鈴', mix: { windchime: 0.5, wind: 0.3, birds: 0.15 } },
  { id: 'storm', name: '雷雨', mix: { rain: 0.8, thunder: 0.5 } },
  { id: 'camp', name: '營火', mix: { campfire: 0.65, crickets: 0.35 } },
  { id: 'deep', name: '深海', mix: { whale: 0.6, drone: 0.25, brown: 0.12 } },
  { id: 'focus', name: '專注', mix: { pink: 0.6 } },
  { id: 'sleep', name: '入睡', mix: { brown: 0.55, rain: 0.3, drone: 0.15 } },
  { id: 'off', name: '安靜', mix: {} },
];

// mix that matches what is on screen: season (0..3) and night flag
export function sceneMix(season, night) {
  if (night) return [
    { crickets: 0.4, windchime: 0.15, wind: 0.2 },
    { crickets: 0.55, stream: 0.25 },
    { crickets: 0.35, wind: 0.35 },
    { wind: 0.4, drone: 0.3, windchime: 0.1 },
  ][season];
  return [
    { birds: 0.6, windchime: 0.18, wind: 0.25 },
    { birds: 0.45, stream: 0.3, wind: 0.2 },
    { wind: 0.45, birds: 0.3, windchime: 0.1 },
    { wind: 0.45, windchime: 0.22, drone: 0.15 },
  ][season];
}

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.levels = Object.fromEntries(TRACKS.map(t => [t.id, 0]));
    this.master = 0.8;
    this.live = {};
    this.params = { wind: 0.4, breath: 0, breathing: false, t: 0 };
    this.lookahead = FG_LOOKAHEAD;
    this.at = null;          // audio time automation is written for (null = now)
    this.breathAt = null;    // optional (audioTime) => breath 0..1, lets waves follow the breath ahead of time
    this.onTick = null;      // (audioNow, lookahead) hook for app-side scheduling
  }

  // Hidden pages get their timers throttled (down to once a minute), so in the
  // background every track schedules ~75 s of events and automation in advance.
  setBackground(hidden) {
    this.lookahead = hidden ? BG_LOOKAHEAD : FG_LOOKAHEAD;
    this.tick();
  }

  // must be called from a user gesture the first time (autoplay policy)
  start() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.buffers = {};
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 3;
      this.out = this.ctx.createGain();
      this.out.gain.value = this.master;
      this.out.connect(comp).connect(this.ctx.destination);
      this.fx = this.ctx.createGain(); // one-shot bells bypass the track mixer
      this.fx.connect(comp);
      for (const [id, v] of Object.entries(this.levels)) if (v > 0) this.ensure(id);
      setInterval(() => this.tick(), 100);
    }
    if (this.ctx.state !== 'running') this.ctx.resume();
    return this.ctx;
  }
  get running() { return !!this.ctx && this.ctx.state === 'running'; }

  buf(kind) { return this.buffers[kind] ??= noiseBuffer(this.ctx, kind); }
  loop(kind) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.buf(kind); s.loop = true;
    s.start(0, Math.random() * NOISE_SECONDS);
    return s;
  }
  to(param, v, tc) {
    const at = this.at ?? this.ctx.currentTime;
    param.cancelScheduledValues(at); // drops automation queued while in the background
    param.setTargetAtTime(v, at, tc);
  }

  ensure(id) {
    if (this.live[id]) return this.live[id];
    const def = TRACKS.find(t => t.id === id);
    const gain = this.ctx.createGain(); gain.gain.value = 0;
    gain.connect(this.out);
    const api = def.build(this, gain) || {};
    return this.live[id] = { gain, api };
  }

  setLevel(id, v) {
    this.levels[id] = v;
    if (!this.ctx) return;
    const tr = v > 0 ? this.ensure(id) : this.live[id];
    if (tr) this.to(tr.gain.gain, v * v, 0.6);
  }
  setMix(mix) { for (const t of TRACKS) this.setLevel(t.id, mix[t.id] || 0); }
  setMaster(v) { this.master = v; if (this.ctx) this.to(this.out.gain, v, 0.2); }

  // sleep timer: the master fades to silence over `dur` seconds ending at audio time `end`.
  // Scheduled on the audio clock, so it happens on time even with the screen off.
  fadeOutAt(end, dur = 60) {
    if (!this.running) return;
    const g = this.out.gain, now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(this.master, now);
    g.setValueAtTime(this.master, Math.max(now, end - dur));
    g.linearRampToValueAtTime(0.0001, Math.max(now + 0.1, end));
  }
  cancelFade() {
    if (!this.running) return;
    const g = this.out.gain, now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(this.master, now, 0.3);
  }
  set(p) { Object.assign(this.params, p); }

  tick() {
    if (!this.running) return;
    const now = this.ctx.currentTime;
    this.params.t = now;
    const span = this.lookahead > 1 ? this.lookahead : 0;
    for (const [id, tr] of Object.entries(this.live)) {
      if (this.levels[id] <= 0) continue; // silent tracks schedule nothing
      if (tr.api.update) {
        for (let k = 0; k <= span; k += 0.5) {
          this.at = span ? now + k : null;
          this.params.t = now + k;
          if (this.breathAt) {
            const b = this.breathAt(now + k);
            this.params.breathing = b != null;
            if (b != null) this.params.breath = b;
          }
          tr.api.update(this.params);
        }
        this.at = null;
      }
      tr.api.tick?.(now);
    }
    this.onTick?.(now, this.lookahead);
  }

  get playing() { return this.running && Object.values(this.levels).some(v => v > 0); }

  // singing bowl: inharmonic partials with slow beating
  bowl(f = 196, vol = 0.5, when = 0) {
    if (!this.running) return null;
    const t = Math.max(when, this.ctx.currentTime + 0.02), oscs = [];
    [[1, 1, 9], [2.71, 0.5, 6], [5.12, 0.22, 4], [8.0, 0.1, 2.5]].forEach(([m, a, dur]) => {
      for (const det of [-0.6, 0.6]) {
        const o = this.ctx.createOscillator(); o.frequency.value = f * m + det;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a * vol * 0.5, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(this.fx); o.start(t); o.stop(t + dur + 0.1);
        oscs.push(o);
      }
    });
    return { at: t, cancel: () => oscs.forEach(o => { try { o.stop(); } catch { /* already ended */ } }) };
  }

  // soft cue at breath phase changes
  chime(up, when = 0) {
    if (!this.running) return null;
    const t = Math.max(when, this.ctx.currentTime + 0.01);
    const o = this.ctx.createOscillator(); o.frequency.value = up ? 528 : 396;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    o.connect(g).connect(this.fx); o.start(t); o.stop(t + 2.3);
    return { at: t, cancel: () => { try { o.stop(); } catch { /* already ended */ } } };
  }
}
