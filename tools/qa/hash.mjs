// Recompute the CSP hash for the inline script after every edit, or the browser refuses to run it.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const file = new URL('../../public/index.html', import.meta.url).pathname;
const page = readFileSync(file, 'utf8');
const script = page.match(/<script>([\s\S]*?)<\/script>/)[1];
const hash = 'sha256-' + createHash('sha256').update(script).digest('base64');
const next = page.replace(/script-src 'sha256-[^']+'/, `script-src '${hash}'`);
if (next !== page) writeFileSync(file, next);
console.log(hash, next !== page ? 'updated' : 'unchanged');
