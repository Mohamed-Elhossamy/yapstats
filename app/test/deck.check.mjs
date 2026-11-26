// Checks the app's home screen and story deck in headless Chrome: fast flicks and taps move exactly one card,
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
let passed = 0; const ok = name => { passed++; console.log('ok', name); };
await page.waitForTimeout(2300); // the startup animation takes about 1.3s
assert.deepEqual(await page.evaluate(() => [!document.getElementById('intro'), document.documentElement.scrollWidth <= innerWidth, document.documentElement.scrollHeight <= innerHeight]), [true, true, true]);
ok('the startup animation ends and the home screen fits with no scrolling either way');
let gap = { title: Infinity, button: Infinity };
for (let i = 0; i < 3; i++) {
  await page.evaluate(i => document.getElementById('fan').children[i].click(), i); // bring each sample to the front
  for (let frame = 0; frame < 10; frame++) {
    await page.waitForTimeout(120);
    const now = await page.evaluate(i => {
      const card = document.getElementById('fan').children[i].querySelector('img').getBoundingClientRect();
      return { title: card.top - document.querySelector('#landing h1').getBoundingClientRect().bottom, button: document.querySelector('#landing .actions .btn.primary').getBoundingClientRect().top - card.bottom };
    }, i);
    gap = { title: Math.min(gap.title, now.title), button: Math.min(gap.button, now.button) };
  }
}
assert.ok(gap.title >= 6 && gap.button >= 8, JSON.stringify(gap)); ok(`a sample in front stays clear of the title (${Math.round(gap.title)}px) and of the main button (${Math.round(gap.button)}px)`);
await page.setInputFiles('#file', join(work, 'flat7-chat.txt'));
await page.waitForSelector('#result:not([hidden])'); await page.waitForTimeout(900);
assert.match(await page.getAttribute('.loader-art span:last-child', 'data-count'), /^[1-9][\d,]*$/); ok('the loading screen counted the messages on its front card');

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

// The native side reports purchases through window.yapstatsPurchase. Stand in for it here.
const slidesBefore = await page.evaluate(() => document.getElementById('cards').children.length);
await page.evaluate(() => window.yapstatsPurchase({ owned: false, price: '£2.99', error: 'The purchase didn’t go through. You haven’t been charged.' }));
assert.equal(await page.evaluate(() => document.getElementById('cards').children.length), slidesBefore);
assert.match(await page.textContent('#buyStatus'), /haven’t been charged/); ok('a failed purchase changes nothing and says so');
await page.evaluate(() => window.yapstatsPurchase({ owned: true, price: '£2.99' })); await page.waitForTimeout(1500);
const slidesAfter = await page.evaluate(() => document.getElementById('cards').children.length);
assert.ok(slidesAfter > slidesBefore, `${slidesBefore} -> ${slidesAfter}`);
assert.equal(await page.evaluate(() => Boolean(document.querySelector('.pack--slide'))), false); ok(`buying unlocks the paid cards (${slidesBefore} slides become ${slidesAfter}) and removes the offer`);
const landed = await page.evaluate(() => [...document.getElementById('progress').children].findIndex(segment => segment.classList.contains('current')));
assert.equal(landed, slidesBefore - 3); // free cards, then highlights and the offer: the first new card replaces the last free one
assert.match(await page.textContent('#storyCount'), new RegExp(`^${landed + 1} of `)); ok(`after buying, the deck opens on the first new card (card ${landed + 1}), not card 1`);

await page.click('#backHome'); await page.waitForTimeout(400);
assert.deepEqual(await page.evaluate(() => [document.getElementById('appBuy').hidden, document.getElementById('unlocked').hidden]), [true, false]); ok('home shows the full recap as unlocked instead of the buy button');
assert.equal(await page.isVisible('#landing'), true); assert.equal(await page.isVisible('#result'), false); ok('the back button returns to the home screen');

assert.deepEqual(errors, []); ok('no page errors');
console.log(`${passed} checks passed`);
await browser.close(); server.close();
