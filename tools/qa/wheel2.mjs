import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://127.0.0.1:8788/');
await page.setInputFiles('#file', 'flat7-chat.txt');
await page.waitForSelector('#result:not([hidden])'); await page.waitForTimeout(2600);
const b = await page.locator('#cards').boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
const count = async () => (await page.textContent('#storyCount')).split(' ')[0];
const rest = () => page.evaluate(() => { const s = document.getElementById('cards'); const i = Math.round(s.scrollLeft / s.clientWidth); return { exact: s.scrollLeft === i * s.clientWidth, flat: s.children[i].firstElementChild.style.transform === '', settling: s.classList.contains('settling') }; });
const swipe = [4, 9, 18, 30, 42, 50, 46, 40, 34, 28, 23, 19, 15, 12, 10, 8, 6, 5, 4, 3, 2, 2, 1, 1];
const send = async (list, sign = 1, x = true) => { for (const d of list) { await page.mouse.wheel(x ? sign * d : 0, x ? 0 : sign * d); await page.waitForTimeout(16); } };
let n = 0; const ok = name => { n++; console.log('ok', name); };
await send(swipe); await page.waitForTimeout(700);
assert.equal(await count(), '2'); assert.deepEqual(await rest(), { exact: true, flat: true, settling: false }); ok('one swipe with a long momentum tail turns exactly one card and lands flat');
await send(swipe); await page.waitForTimeout(700); assert.equal(await count(), '3'); ok('second swipe after a pause turns one more');
await send(swipe, -1); await page.waitForTimeout(700); assert.equal(await count(), '2'); ok('swipe the other way goes back one');
// three quick swipes, each starting while the last one's momentum is still fading
await send(swipe.slice(0, 14)); await send(swipe.slice(0, 14)); await send(swipe); await page.waitForTimeout(900);
assert.equal(await count(), '5'); assert.deepEqual(await rest(), { exact: true, flat: true, settling: false }); ok('three quick swipes turn three cards');
// a slow, long drag of the fingers is still one card
await send(Array(40).fill(12)); await page.waitForTimeout(700); assert.equal(await count(), '6'); ok('long slow swipe turns one card');
// mouse wheel notches (shift+wheel): one notch, one card
await page.waitForTimeout(200); await page.mouse.wheel(100, 0); await page.waitForTimeout(700); assert.equal(await count(), '7'); ok('one horizontal wheel notch turns one card');
// vertical scrolling over the cards still scrolls the page
const y0 = await page.evaluate(() => scrollY); await send([40, 60, 80, 60, 40], 1, false); await page.waitForTimeout(400);
assert.ok(await page.evaluate(() => scrollY) > y0); assert.equal(await count(), '7'); ok('vertical scroll still scrolls the page, cards stay put');
// swipe back past the start does nothing odd
await page.keyboard.press('Home'); await page.focus('#cards'); await page.keyboard.press('Home'); await page.waitForTimeout(800);
await send(swipe, -1); await page.waitForTimeout(700); assert.equal(await count(), '1'); assert.deepEqual(await rest(), { exact: true, flat: true, settling: false }); ok('swiping back on the first card stays on the first card');
// A hard swipe: big movement and a tail that lasts over a second. However it arrives, it turns exactly one card.
const tail = []; for (let v = 300; v >= 1; v *= .955) tail.push(Math.round(v));
const hard = [20, 80, 180, 280, 330, ...tail];
const uneven = hard.flatMap((d, i) => i > 6 && i % 9 === 0 ? [Math.round(d * .45), Math.round(d * 1.55)] : [d]); // one event delivered as two unequal ones
const sendHard = async (list, stallAt = -1) => { for (const [i, d] of list.entries()) { await page.mouse.wheel(d, 0); await page.waitForTimeout(i === stallAt ? 190 : 12); } };
for (const [name, list, stallAt] of [['smooth', hard], ['with uneven events', uneven], ['with a stall in its tail', hard, 12], ['uneven with a stall', uneven, 20]]) {
  await page.keyboard.press('Home'); await page.waitForTimeout(800);
  await sendHard(list, stallAt); await page.waitForTimeout(800);
  assert.equal(await count(), '2', `hard swipe ${name}`);
}
ok('a hard swipe turns exactly one card: smooth, uneven, stalled, or both');
// wheel notches a fifth of a second apart: each one still counts
await page.waitForTimeout(300); for (let i = 0; i < 3; i++) { await page.mouse.wheel(100, 0); await page.waitForTimeout(200); } await page.waitForTimeout(900);
assert.equal(await count(), '5'); ok('three wheel notches turn three cards');
assert.deepEqual(errors, []); console.log(n, 'trackpad checks passed');
await browser.close();
