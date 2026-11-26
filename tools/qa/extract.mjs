// Pull the DOM-free core out of public/index.html so Node can run it.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
export function core(file = new URL('../../public/index.html', import.meta.url).pathname) {
  const page = readFileSync(file, 'utf8');
  const start = page.indexOf("'use strict';");
  const end = page.indexOf('/* ---------- page ---------- */');
  const code = page.slice(start, end) + '\n({ parseChat, computeStats, demoChat, STOP });';
  return vm.runInNewContext(code, { console, TextEncoder, TextDecoder, Blob, URL, Intl, Date, Math });
}
