// Builds the public website into site/: copies what .assetsignore allows, then minifies our own JS with esbuild
// file by file (no bundling), so the import map and every relative path keep working exactly as in the repo.
// Cloudflare runs this through wrangler.jsonc "build"; locally: node scripts/build-site.mjs
import { cpSync, rmSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, relative } from 'node:path';

const OUT = 'site';
const ESBUILD = 'esbuild@0.28.2';
const NEVER = [OUT, 'scripts', 'dist', 'node_modules']; // build tooling and old APKs are never published
const NO_MINIFY = /(^|\/)vendor\//;                    // third-party code is already minified

const glob = p => new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
const rules = [...NEVER, ...(existsSync('.assetsignore') ? readFileSync('.assetsignore', 'utf8').split(/\r?\n/) : [])]
  .map(l => l.trim().replace(/^\/+|\/+$/g, '')).filter(l => l && !l.startsWith('#'))
  .map(p => ({ re: glob(p), path: p.includes('/') }));

function skipped(rel) {
  const parts = rel.split('/');
  if (parts.some(s => s.startsWith('.') && s !== '.well-known')) return true;
  return rules.some(r => r.path ? parts.some((_, i) => r.re.test(parts.slice(0, i + 1).join('/'))) : parts.some(s => r.re.test(s)));
}

rmSync(OUT, { recursive: true, force: true });
// copied entry by entry: Node refuses to copy a folder into its own subfolder
const keep = src => !skipped(relative('.', src).replace(/\\/g, '/'));
for (const name of readdirSync('.')) if (keep(name)) cpSync(name, join(OUT, name), { recursive: true, filter: keep });
if (!existsSync(join(OUT, 'index.html'))) throw new Error('site/index.html missing');

const js = [];
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p);
    else if (/\.m?js$/.test(e.name) && !NO_MINIFY.test(p)) js.push(p);
  }
})(OUT);

// a few files per call keeps the command line short enough for Windows
for (let i = 0; i < js.length; i += 40) {
  execSync(`npx --yes ${ESBUILD} ${js.slice(i, i + 40).map(f => `"${f}"`).join(' ')} --minify --legal-comments=none --charset=utf8 `
    + `--outbase=${OUT} --outdir=${OUT} --allow-overwrite --log-level=warning`, { stdio: 'inherit' });
}
console.log(`${OUT}/ ready: ${js.length} JS files minified`);
