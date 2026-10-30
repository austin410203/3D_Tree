// Free vs 完整版 (full version). Free: four scenes plus every sound, breathing pattern and sleep mode.
// On the web the full version is a Lemon Squeezy licence key checked by the worker (/api/license/*).
// The iOS app sells it as an App Store in-app purchase (StoreKit 2, ios/App/App/NativePlugins.swift) and
// never shows web checkout or licence keys (App Review 3.1.1). For now the Android app takes the same
// web keys (sideloaded test builds only); before Google Play it must switch to Play billing (docs/MONETIZATION.md).
import { isNative, platform } from './native.js';

// Lemon Squeezy checkout. While the store is in test mode the button only works with ?lstest in the address,
// so ordinary visitors can't unlock with a test card; set LIVE = true when the store goes live.
const LIVE = true;
const CHECKOUT = 'https://emptyofficex.lemonsqueezy.com/checkout/buy/6863cdcc-24a1-4e5a-b922-380909e08c90';
const testing = (() => { try { return new URLSearchParams(location.search).has('lstest'); } catch { return false; } })();
export const PASS = {
  checkoutUrl: LIVE || testing || platform === 'android' ? CHECKOUT : '', // empty: the buy button says 「即將開放」
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

// ---- iOS: App Store in-app purchase
export const usesAppStore = platform === 'ios';
export const IAP_ID = 'com.austin410203.seasontree.full';
const IAP_KEY = 'seasontree.iap';
const Store = usesAppStore ? window.Capacitor.Plugins.Store : null;
let iapOwned = (() => { try { return localStorage.getItem(IAP_KEY) === '1'; } catch { return false; } })();
function setOwned(ids) {
  const owned = (ids || []).includes(IAP_ID);
  const changed = owned !== iapOwned;
  iapOwned = owned;
  try { owned ? localStorage.setItem(IAP_KEY, '1') : localStorage.removeItem(IAP_KEY); } catch { /* storage blocked */ }
  return changed;
}
// localized price from the App Store, e.g. "NT$30" or "$0.99"; null when the store can't be reached
export async function iapPrice() {
  try { return (await Store.getProducts({ productIds: [IAP_ID] })).products[0]?.displayPrice || null; } catch { return null; }
}
// resolves 'purchased' | 'cancelled' | 'pending' | 'failed'
export async function iapBuy() {
  let status = 'failed';
  try { status = (await Store.purchase({ productId: IAP_ID })).status; } catch { /* product missing or offline */ }
  if (status === 'purchased') setOwned((await Store.getEntitlements()).productIds);
  return status;
}
// resolves true when the full version is owned after syncing with the App Store
export async function iapRestore() {
  try { setOwned((await Store.restore()).productIds); } catch { /* offline */ }
  return iapOwned;
}
// purchases made elsewhere (family approval, refunds, another device) reload the page so locks update
Store?.addListener('entitlementsChanged', e => { if (setOwned(e.productIds)) location.reload(); });

// ---- ad-earned trials: one rewarded ad opens a locked scene for 24 hours (ads.js)
const TRIAL_KEY = 'seasontree.trials';
export const TRIAL_MS = 24 * 3600e3;
const readTrials = () => { try { return JSON.parse(localStorage.getItem(TRIAL_KEY) || '{}'); } catch { return {}; } };
// end of the scene's trial (ms) while it runs, else 0
export const trialUntil = (id) => { const u = readTrials()[id] || 0; return u > Date.now() ? u : 0; };
export function startTrial(id) {
  const now = Date.now(), tr = readTrials();
  for (const k of Object.keys(tr)) if (tr[k] <= now) delete tr[k];
  tr[id] = now + TRIAL_MS;
  try { localStorage.setItem(TRIAL_KEY, JSON.stringify(tr)); } catch { /* storage blocked */ }
}

let pass = read();
export const hasPass = () => !paywallOn || (usesAppStore ? iapOwned : !!(pass && pass.ok));
export const isSceneLocked = (id) => !hasPass() && !FREE_SCENES.includes(id) && !trialUntil(id);
export const passInfo = () => (usesAppStore ? (iapOwned ? { store: true } : null)
  : pass && pass.ok ? { key: pass.key.slice(0, 8) + '…', since: pass.since } : null);

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

// re-check the key now and then, so a refunded or disabled key locks again; network errors keep the pass.
// On iOS StoreKit answers from its cache, so the App Store entitlement is read on every launch.
export async function recheck() {
  if (usesAppStore) {
    try { if (setOwned((await Store.getEntitlements()).productIds)) location.reload(); } catch { /* keep the cached answer */ }
    return;
  }
  if (!pass || !pass.ok || Date.now() - (pass.checked || 0) < RECHECK) return;
  try {
    const j = await call('validate', { key: pass.key, instance: pass.instance });
    if (j.valid) { pass.checked = Date.now(); write(pass); } else { pass = null; write(null); location.reload(); }
  } catch { /* offline: try again next time */ }
}
