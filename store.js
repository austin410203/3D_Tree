// Free vs 完整版 (full version). Free: four scenes plus every sound, breathing pattern and sleep mode.
// On the web the full version is a Lemon Squeezy licence key checked by the worker (/api/license/*).
// For now the Android app takes the same web keys (sideloaded test builds only). Before the app goes on
// Google Play / the App Store it must switch to store billing and drop web checkout (docs/MONETIZATION.md).
import { isNative } from './native.js';

// Lemon Squeezy checkout. While the store is in test mode the button only works with ?lstest in the address,
// so ordinary visitors can't unlock with a test card; set LIVE = true when the store goes live.
const LIVE = false;
const CHECKOUT = 'https://emptyofficex.lemonsqueezy.com/checkout/buy/c8ce6018-0b8b-469e-9c32-5215b1b7d7b5';
const testing = (() => { try { return new URLSearchParams(location.search).has('lstest'); } catch { return false; } })();
export const PASS = {
  checkoutUrl: LIVE || testing || isNative ? CHECKOUT : '', // empty: the buy button says 「即將開放」
  price: 'NT$30',
};
export const FREE_SCENES = ['tree', 'sea', 'rain', 'candle'];

const KEY = 'seasontree.pass';
// the app is served from https://localhost, so it calls the site's worker by its full address (CORS allowed there)
const API = (isNative ? 'https://calm.emptyoffice.app' : '') + '/api/license/';
const RECHECK = 7 * 86400e3;
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
const write = (v) => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch { /* storage blocked */ } };

export const paywallOn = true;

let pass = read();
export const hasPass = () => !paywallOn || !!(pass && pass.ok);
export const isSceneLocked = (id) => !hasPass() && !FREE_SCENES.includes(id);
export const passInfo = () => (pass && pass.ok ? { key: pass.key.slice(0, 8) + '…', since: pass.since } : null);

async function call(path, body) {
  const r = await fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || String(r.status));
  return j;
}
const deviceName = () => `${isNative ? 'app' : 'web'} ${navigator.platform || ''} ${new Date().toISOString().slice(0, 10)}`.trim();

// activate a licence key on this browser; resolves true or throws with a reason ('invalid', 'limit', …)
export async function activate(key) {
  key = String(key || '').trim();
  if (!key) throw new Error('empty');
  const j = await call('activate', { key, name: deviceName() });
  pass = { ok: true, key, instance: j.instance, since: new Date().toISOString().slice(0, 10), checked: Date.now() };
  write(pass);
  return true;
}

// re-check the key now and then, so a refunded or disabled key locks again; network errors keep the pass
export async function recheck() {
  if (!pass || !pass.ok || Date.now() - (pass.checked || 0) < RECHECK) return;
  try {
    const j = await call('validate', { key: pass.key, instance: pass.instance });
    if (j.valid) { pass.checked = Date.now(); write(pass); } else { pass = null; write(null); location.reload(); }
  } catch { /* offline: try again next time */ }
}
