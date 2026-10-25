// Copies the static web app into www/ for Capacitor. The web build itself
// (Vercel) serves the repo root directly, so there is no bundling step.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www');
const FILES = ['index.html', 'style.css', 'app.js', 'tree.js', 'audio.js', 'native.js',
  'manifest.webmanifest', 'sw.js', 'icons', 'vendor'];

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of FILES) cpSync(join(root, f), join(out, f), { recursive: true });
console.log(`www/ ready (${FILES.length} entries)`);
