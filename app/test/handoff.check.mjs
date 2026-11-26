// Checks the web half of the iOS share-sheet import in headless Chrome.
// It runs the exact hand-off script from SceneDelegate.swift against the bundled page,
// with Capacitor's local file URL stubbed. The native half needs a real iPhone.
//
// Run from app/:  npm run sync && node test/handoff.check.mjs
// Assumes Playwright at /opt/npm-tools/node_modules/ and Chrome at /usr/bin/google-chrome (as tools/qa does).
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';

const here = import.meta.dirname;
const bundle = resolve(here, '../ios/App/App/public');
const swift = readFileSync(resolve(here, '../ios/App/App/SceneDelegate.swift'), 'utf8');
const body = swift.match(/handOffScript = #"""\n([\s\S]*?)\n\s*"""#/)?.[1];
assert.ok(body, 'hand-off script not found in SceneDelegate.swift');

// Synthetic export, all made up: the repo's generator, plus the same chat zipped the way an iPhone export is.
const work = mkdtempSync(join(tmpdir(), 'yapstats-handoff-'));
execFileSync('node', [resolve(here, '../../tools/qa/mkchat.mjs')], { cwd: work });
execFileSync('cp', ['flat7-chat.txt', '_chat.txt'], { cwd: work });
execFileSync('zip', ['-q', 'Chat - Flat 7.zip', '_chat.txt'], { cwd: work });

const types = { '.html': 'text/html', '.png': 'image/png', '.txt': 'text/plain', '.zip': 'application/zip' };
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  // Stand-in for Capacitor's /_capacitor_file_/<absolute path> handler.
  let file = path.startsWith('/_capacitor_file_/') ? path.slice('/_capacitor_file_'.length) : join(bundle, path);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }).end(readFileSync(file));
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;

const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true });
const page = await context.newPage();
const errors = []; page.on('pageerror', error => errors.push(String(error)));
let passed = 0; const ok = name => { passed++; console.log('ok', name); };

const stubCapacitor = () => page.evaluate(() => { window.Capacitor = { convertFileSrc: path => '/_capacitor_file_' + path }; });
// The same call the app makes: an async function body with path, name and type in scope.
const handOff = (name, type) => page.evaluate(`(async (path, name, type) => {\n${body}\n})(${JSON.stringify(join(work, name))}, ${JSON.stringify(name)}, ${JSON.stringify(type)})`);
const untilDelivered = async (name, type) => {
  for (let attempt = 0; attempt < 60; attempt++) {
    let status = 'wait';
    try { await stubCapacitor(); status = await handOff(name, type); } catch { /* page is reloading, as on the phone */ }
    if (status !== 'wait') return status;
    await page.waitForTimeout(250);
  }
  return 'gave up';
};

await page.goto(origin + '/'); await page.waitForLoadState('load');
assert.equal(await handOff('Chat - Flat 7.zip', 'application/zip'), 'wait'); ok('waits while the native bridge is not there yet');

assert.equal(await untilDelivered('Chat - Flat 7.zip', 'application/zip'), 'ok');
await page.waitForSelector('#result:not([hidden])', { timeout: 20000 });
const cards = await page.evaluate(() => document.getElementById('cards').children.length);
assert.ok(cards > 3, `cards: ${cards}`); ok(`zip export opens a recap (${cards} cards)`);

assert.equal(await untilDelivered('flat7-chat.txt', 'text/plain'), 'ok');
await page.waitForSelector('#result:not([hidden])', { timeout: 20000 });
ok('a second export replaces an open recap (page restarts first)');

await page.goto(origin + '/'); await page.waitForLoadState('load'); await stubCapacitor();
assert.equal(await handOff('missing.zip', 'application/zip'), 'unreadable');
assert.equal(await page.isVisible('#landing'), true); ok('a file that has gone reports unreadable and stays on the landing page');

assert.deepEqual(errors, []); ok('no page errors');
console.log(`${passed} checks passed`);
await browser.close(); server.close();
