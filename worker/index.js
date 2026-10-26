// Calm Moments worker: serves the static site and checks 完整版 licence keys.
// Static files never reach this code (assets.run_worker_first only routes /api/* here).
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

// 完整版 licence keys sold through Lemon Squeezy. The licence endpoints need no API secret; the worker
// only makes sure the key belongs to our product (LS_PRODUCT_ID, optionally LS_STORE_ID) before the page unlocks.
// LS_MOCK=1 (local .dev.vars only) accepts keys starting with TEST- so the flow can be tried offline.
async function license(action, req, env) {
  if (action !== 'activate' && action !== 'validate') return json({ error: 'not found' }, 404);
  const b = await req.json().catch(() => ({}));
  const key = String(b.key || '').trim().slice(0, 100);
  if (!key) return json({ error: 'empty' }, 400);
  if (env.LS_MOCK === '1' && key.startsWith('TEST-')) {
    return json(action === 'activate' ? { instance: 'mock-' + key } : { valid: !key.includes('REFUND') });
  }
  if (!env.LS_PRODUCT_ID) return json({ error: 'not configured' }, 503);
  const form = new URLSearchParams({ license_key: key });
  if (action === 'activate') form.set('instance_name', String(b.name || 'web').slice(0, 60));
  else if (b.instance) form.set('instance_id', String(b.instance).slice(0, 60));
  const r = await fetch(`https://api.lemonsqueezy.com/v1/licenses/${action}`, {
    method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' }, body: form,
  });
  if (r.status >= 500) return json({ error: 'upstream' }, 502); // Lemon Squeezy down: the page keeps its pass
  const j = await r.json().catch(() => ({}));
  const m = j.meta || {};
  const ours = String(m.product_id) === String(env.LS_PRODUCT_ID) && (!env.LS_STORE_ID || String(m.store_id) === String(env.LS_STORE_ID));
  const testKey = !!((j.license_key && j.license_key.test_mode) || m.test_mode);
  if (env.LS_LIVE === '1' && testKey) return json({ error: 'invalid' }, 400); // test-mode keys stop working once live
  if (action === 'activate') {
    if (!j.activated) return json({ error: /limit/i.test(j.error || '') ? 'limit' : 'invalid' }, 400);
    if (!ours) return json({ error: 'invalid' }, 400);
    return json({ instance: j.instance && j.instance.id });
  }
  const status = j.license_key && j.license_key.status;
  return json({ valid: !!j.valid && ours && status !== 'disabled' && status !== 'expired' });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/license/') && req.method === 'POST') return license(url.pathname.slice(13), req, env);
    if (url.pathname.startsWith('/api/')) return json({ error: 'not found' }, 404);
    return env.ASSETS.fetch(req);
  },
};
