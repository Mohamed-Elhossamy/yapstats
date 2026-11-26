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
await page.addInitScript(() => {
  window.Capacitor = { isNativePlatform: () => true };
  window.sent = []; // what the page asks the native side to do
  window.webkit = { messageHandlers: { yapstats: { postMessage: message => window.sent.push(message) } } };
});
await page.goto(`http://127.0.0.1:${server.address().port}/`);
let passed = 0; const ok = name => { passed++; console.log('ok', name); };
await page.waitForTimeout(2300); // the startup animation takes about 1.3s
assert.deepEqual(await page.evaluate(() => [!document.getElementById('intro'), document.documentElement.scrollWidth <= innerWidth, document.documentElement.scrollHeight <= innerHeight]), [true, true, true]);
ok('the startup animation ends and the home screen fits with no scrolling either way');
assert.equal(await page.evaluate(() => window.sent.filter(message => message.type === 'intro').length), 1); ok('the startup sound is asked for once');
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
// One card at a time, however hard or often the swipe: a second flick 100ms later, while the card is still turning,
// cannot reach past the next card. Nor can a finger dragged across the whole screen.
const quick = async (from, to) => { await touch('touchStart', from, 420); await touch('touchMove', (from + to) / 2, 423); await touch('touchMove', to, 425); await touch('touchEnd'); };
await quick(330, 110); await page.waitForTimeout(100); await quick(330, 110); await page.waitForTimeout(900); state = await deck();
assert.deepEqual([state.index, state.aligned], [3, true], 'two flicks 100ms apart');
await quick(330, 110); await page.waitForTimeout(100); await quick(90, 320); await page.waitForTimeout(900); state = await deck();
assert.ok(state.index === 3 || state.index === 2 || state.index === 4, `forward then back ended on ${state.index}`);
if (state.index !== 3) { await flick(state.index < 3 ? 330 : 90, state.index < 3 ? 110 : 320); state = await deck(); }
await touch('touchStart', 390, 420); for (const x of [300, 200, 100, 0, -200, -500]) await touch('touchMove', x, 422); await touch('touchEnd'); await page.waitForTimeout(900); state = await deck();
assert.deepEqual([state.index, state.aligned], [4, true], 'one long hard drag');
await flick(90, 320); await flick(90, 320); state = await deck();
assert.deepEqual([state.index, state.aligned], [2, true]); ok('a second flick mid-turn or a very long drag still moves one card only');

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

// The app sells through Apple only: no website checkout, tip or long-guide link may be left in the page.
assert.equal(await page.evaluate(() => document.querySelectorAll('.checkout-link, #tipLink, .guide-links, a[href*="polar.sh"], a[href*="ko-fi"], a[href*="/export-"]').length), 0);
ok('no website checkout, tip or web-guide links exist in the app');

// The sample chat lets anyone (App Review included) see the whole app without an export.
await page.click('#trySample'); await page.waitForSelector('#result:not([hidden])'); await page.waitForTimeout(900);
assert.equal(await page.textContent('#groupTitle'), 'Flat 12 (sample)');
assert.equal(await page.evaluate(() => Boolean(document.querySelector('.pack--slide'))), false); // already unlocked by the purchase above
await page.click('#backHome'); await page.waitForTimeout(400); ok('Try a sample chat opens a made-up recap');

// About, Privacy and Terms inside the app: the native side marks them as in-app, which hides the website-only parts.
for (const path of ['/about/', '/privacy/', '/terms/']) {
  const sub = await context.newPage();
  await sub.addInitScript(() => document.addEventListener('DOMContentLoaded', () => document.documentElement.classList.add('is-app'))); // WKUserScript does this at document start
  await sub.goto(`http://127.0.0.1:${server.address().port}${path}`);
  assert.equal(await sub.evaluate(() => [...document.querySelectorAll('.web-only')].some(element => element.offsetParent)), false, path);
  assert.doesNotMatch(await sub.evaluate(() => document.body.innerText), /Polar|Ko-fi|Android|export guide/i, path);
  await sub.close();
}
ok('About, Privacy and Terms hide their website-only parts in the app');

// Save to Photos: the page hands the card to the native side as a PNG and shows what came back.
await page.setInputFiles('#file', join(work, 'flat7-chat.txt')); await page.waitForSelector('#result:not([hidden])'); await page.waitForTimeout(900);
await page.click('#savePhoto'); await page.waitForFunction(() => window.sent.some(message => message.type === 'save'));
assert.match(await page.evaluate(() => window.sent.find(message => message.type === 'save').data.slice(0, 11)), /^iVBORw0KGgo/); // base64 PNG
await page.evaluate(() => window.yapstatsSaved({ ok: true }));
assert.equal(await page.textContent('#savePhoto'), 'Saved'); assert.equal(await page.isVisible('#toast'), false);
await page.waitForTimeout(2100); assert.equal(await page.textContent('#savePhoto'), 'Save');
await page.click('#savePhoto'); await page.waitForFunction(() => window.sent.filter(message => message.type === 'save').length === 2);
await page.evaluate(() => window.yapstatsSaved({ ok: false, error: 'Yapstats can’t add to Photos.' }));
assert.match(await page.textContent('#toast'), /can’t add to Photos/); ok('Save sends the card as a PNG, confirms a save and explains a refusal');
await page.touchscreen.tap(330, 400); await page.waitForTimeout(700); // card 2, where All cards is offered
await page.click('#openGallery'); await page.waitForSelector('#gallery:not([hidden])'); await page.waitForTimeout(900);
await page.evaluate(() => { window.sent.length = 0; });
await page.click('.gallery-item:nth-child(3) figcaption a'); await page.waitForFunction(() => window.sent.some(message => message.type === 'save'));
await page.evaluate(() => window.yapstatsSaved({ ok: true }));
assert.equal(await page.textContent('.gallery-item:nth-child(3) figcaption a'), 'Saved'); ok('the save links under All cards save to Photos too');
await page.click('#backHome'); await page.waitForTimeout(400);

// Coming back to the front (the native side calls yapstatsIntro): the animation and its sound play again, over whatever
// screen is showing, and leave it as it was.
await page.setInputFiles('#file', join(work, 'flat7-chat.txt')); await page.waitForSelector('#result:not([hidden])'); await page.waitForTimeout(900);
await page.touchscreen.tap(330, 400); await page.waitForTimeout(700);
const before = await page.textContent('#storyCount');
await page.evaluate(() => { window.sent.length = 0; window.yapstatsIntro(); });
assert.deepEqual(await page.evaluate(() => [Boolean(document.getElementById('intro')), window.sent.filter(message => message.type === 'intro').length]), [true, 1]);
await page.waitForTimeout(2000);
assert.deepEqual(await page.evaluate(() => [Boolean(document.getElementById('intro')), document.getElementById('result').hidden]), [false, false]);
assert.equal(await page.textContent('#storyCount'), before);
await page.click('#backHome'); await page.waitForTimeout(400);
await page.evaluate(() => { window.sent.length = 0; window.yapstatsIntro(); }); await page.waitForTimeout(300);
assert.equal(await page.evaluate(() => Boolean(document.getElementById('intro')) && !document.getElementById('landing').hidden), true);
await page.waitForTimeout(1800);
assert.equal(await page.evaluate(() => Boolean(document.getElementById('intro'))), false);
ok('every return to the app replays the startup animation and sound, and leaves the screen as it was');

// Coming back to the home screen later in the same launch (from Privacy or Terms) must not replay the intro or its sound.
await page.reload(); await page.waitForTimeout(400);
assert.deepEqual(await page.evaluate(() => [Boolean(document.getElementById('intro')), window.sent.some(message => message.type === 'intro')]), [false, false]); ok('a page reload inside the app does not replay the intro');

// A second import: the loading bar must start empty and only ever grow (it used to start full and run backwards).
await page.evaluate(() => {
  window.fills = [];
  const frame = () => {
    if (!document.getElementById('loading').hidden) {
      const hidden = getComputedStyle(document.getElementById('loadingFill'), '::before').clipPath.match(/inset\(0px ([\d.]+)(px|%)/);
      const track = document.querySelector('.load-track').getBoundingClientRect().width;
      window.fills.push(1 - (hidden[2] === '%' ? hidden[1] / 100 : hidden[1] / track));
    }
    requestAnimationFrame(frame);
  };
  frame();
});
await page.setInputFiles('#file', join(work, 'flat7-chat.txt'));
await page.waitForSelector('#result:not([hidden])');
const fills = await page.evaluate(() => window.fills);
assert.ok(fills.length > 20 && fills[0] < .05 && fills.at(-1) > .95, `${fills.length} frames, ${fills[0]} to ${fills.at(-1)}`);
assert.ok(fills.every((fill, i) => i === 0 || fill >= fills[i - 1] - .002)); ok('on a second import the loading bar starts empty and never runs backwards');

// Every supported iPhone size: the visible page (screen minus status bar and home indicator) must hold the home screen
// and a card without scrolling, and the three card buttons must show their whole labels.
for (const [name, width, height] of [['SE', 375, 647], ['mini', 375, 728], ['16', 393, 759], ['16 Pro Max', 440, 860]]) {
  const small = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true });
  const phone = await small.newPage();
  await phone.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true }; });
  await phone.goto(`http://127.0.0.1:${server.address().port}/`); await phone.waitForTimeout(2300);
  const fits = () => phone.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth);
  assert.equal(await fits(), true, `${name} home`);
  await phone.setInputFiles('#file', join(work, 'flat7-chat.txt')); await phone.waitForSelector('#result:not([hidden])'); await phone.waitForTimeout(900);
  assert.equal(await fits(), true, `${name} card`);
  assert.deepEqual(await phone.evaluate(() => [...document.querySelectorAll('#storyTools .btn')].filter(b => b.offsetParent).map(b => b.scrollWidth <= b.clientWidth + 1)), [true, true, true], `${name} buttons`);
  // Paid: the last card has a line of text under it (or, once every card is seen, a second row of buttons) and still must not scroll.
  await phone.evaluate(() => yapstatsPurchase({ owned: true }));
  await phone.waitForFunction(() => /^12 of 2\d/.test(document.getElementById('storyCount').textContent)); await phone.waitForTimeout(700); // the redraw lands on the first new card
  await phone.focus('#cards'); await phone.keyboard.press('End'); await phone.waitForTimeout(1300);
  assert.deepEqual(await phone.evaluate(() => [document.getElementById('storyCount').textContent, document.getElementById('storyHint').hidden]), ['Chat highlights', false], `${name} last card`);
  assert.equal(await fits(), true, `${name} last card with its hint`);
  if (name === '16') {
    await phone.keyboard.press('Home'); await phone.waitForTimeout(700);
    for (let i = 0; i < 30 && await phone.textContent('#storyCount') !== 'Chat highlights'; i++) { await phone.keyboard.press('ArrowRight'); await phone.waitForTimeout(420); }
    await phone.waitForTimeout(900);
    assert.equal(await phone.isVisible('#bulkActions'), true, 'end actions show once every card is seen');
    assert.equal(await fits(), true, `${name} last card with its end actions`);
    await phone.keyboard.press('ArrowLeft'); await phone.waitForTimeout(900);
    assert.equal(await phone.evaluate(() => document.getElementById('result').style.getPropertyValue('--story-extra')), '', 'cards get their full height back on other cards');
  }
  await small.close();
}
ok('home and cards fit, with whole button labels, on SE, mini, 16 and 16 Pro Max screens; the paid last card fits with its extra row');

assert.deepEqual(errors, []); ok('no page errors');
console.log(`${passed} checks passed`);
await browser.close(); server.close();
