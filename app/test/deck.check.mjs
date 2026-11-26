// Checks the story deck in app mode in headless Chrome: fast flicks and taps move exactly one card,
// the strip cannot scroll on its own, and a newly shown card is never see-through.
// Chrome is not an iPhone: the pointercancel that iOS sent on fast flicks only shows on a real device.
//
// Run from app/:  node test/deck.check.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const here = import.meta.dirname;
const site = resolve(here, '../../public');
const work = mkdtempSync(join(tmpdir(), 'yapstats-deck-'));
execFileSync('node', [resolve(here, '../../tools/qa/mkchat.mjs')], { cwd: work }); // synthetic chat, all made up

const server = createServer((request, response) => {
  let file = join(site, decodeURIComponent(new URL(request.url, 'http://x').pathname));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html' : 'application/octet-stream' }).end(readFileSync(file));
});
await new Promise(done => server.listen(0, '127.0.0.1', done));

const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 402, height: 874 }, hasTouch: true, isMobile: true });
const page = await context.newPage();
const errors = []; page.on('pageerror', error => errors.push(String(error)));
await page.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true }; });
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.setInputFiles('#file', join(work, 'flat7-chat.txt'));
await page.waitForSelector('#result:not([hidden])'); await page.waitForTimeout(900);
let passed = 0; const ok = name => { passed++; console.log('ok', name); };

const cdp = await context.newCDPSession(page);
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
const deck = () => page.evaluate(() => {
  const strip = document.getElementById('cards');
  const index = [...strip.children].findIndex(slide => !slide.hasAttribute('aria-hidden'));
  return { index, aligned: Math.abs(strip.scrollLeft - index * strip.clientWidth) < 1, overflow: getComputedStyle(strip).overflowX, touchAction: getComputedStyle(strip).touchAction };
});
const flick = async (from, to) => { // a quick finger: down, two moves and up inside about 50ms
  await touch('touchStart', from, 420); await touch('touchMove', (from + to) / 2, 423); await touch('touchMove', to, 425); await touch('touchEnd');
  await page.waitForTimeout(900);
};

let state = await deck();
assert.equal(state.overflow, 'hidden'); assert.equal(state.touchAction, 'none'); ok('the strip cannot scroll on its own and takes the whole touch');
assert.equal(state.index, 0);

await page.waitForTimeout(2600); // the invitation tug has run at least once by now
state = await deck(); assert.equal(state.index, 0); ok('the invitation tug leaves the first card in place');

await flick(330, 110); state = await deck();
assert.deepEqual([state.index, state.aligned], [1, true]); ok('a fast flick left moves forward exactly one card');
await flick(330, 110); await flick(330, 110); state = await deck();
assert.deepEqual([state.index, state.aligned], [3, true]); ok('two more flicks land on the fourth card, in step');
await flick(90, 320); state = await deck();
assert.deepEqual([state.index, state.aligned], [2, true]); ok('a fast flick right moves back exactly one card');

const opacities = [];
await page.evaluate(() => { window.seen = []; const read = () => { const card = document.querySelector('.slide:not([aria-hidden]) .card'); if (card) window.seen.push(Number(getComputedStyle(card).opacity)); if (window.seen.length < 90) requestAnimationFrame(read); }; requestAnimationFrame(read); });
await page.touchscreen.tap(330, 420); await page.waitForTimeout(1700);
opacities.push(...await page.evaluate(() => window.seen));
state = await deck();
assert.deepEqual([state.index, state.aligned], [3, true]); ok('a tap on the right moves forward one card');
assert.ok(opacities.length > 30 && Math.min(...opacities) === 1, `lowest opacity ${Math.min(...opacities)}`); ok('the card on top is never see-through while it arrives');

await page.click('#backHome'); await page.waitForTimeout(400);
assert.equal(await page.isVisible('#landing'), true); assert.equal(await page.isVisible('#result'), false); ok('the back button returns to the home screen');

assert.deepEqual(errors, []); ok('no page errors');
console.log(`${passed} checks passed`);
await browser.close(); server.close();
