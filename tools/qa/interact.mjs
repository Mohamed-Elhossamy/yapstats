import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const errors = [];
async function open(opts, chat = 'flat7-chat.txt') {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); });
  await page.goto('http://127.0.0.1:8788/');
  await page.setInputFiles('#file', chat);
  await page.waitForSelector('#result:not([hidden])', { timeout: 30000 });
  return page;
}
const count = page => page.textContent('#storyCount');
const idle = page => page.waitForFunction(() => !document.getElementById('cards').classList.contains('settling'), null, { timeout: 5000 });
const box = async page => page.locator('#cards').boundingBox();
let pass = 0; const ok = (name) => { pass++; console.log('ok', name); };

// ---------- phone ----------
let page = await open({ viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
assert.match(await count(page), /^1 of 12/); 
// nudge runs once and returns to rest
await page.waitForTimeout(1750);
assert.ok(await page.evaluate(() => document.getElementById('cards').scrollLeft > 5), 'nudge moved the strip');
await page.waitForTimeout(900); await idle(page);
assert.equal(await page.evaluate(() => document.getElementById('cards').scrollLeft), 0); ok('nudge plays and returns to rest');
// resting deck: current card untransformed, next card peeks from the right edge of the current one
const rest = await page.evaluate(() => { const [a, b] = [...document.querySelectorAll('.slide .card')].map(e => e.getBoundingClientRect()); const s = document.getElementById('cards').getBoundingClientRect(); return { a: [a.left, a.right], b: [b.left, b.right], s: [s.left, s.right], t: document.querySelector('.slide .card').style.transform }; });
assert.equal(rest.t, ''); assert.ok(rest.b[1] - rest.a[1] > 10 && rest.b[1] - rest.a[1] < 22, JSON.stringify(rest)); assert.ok(rest.b[1] <= rest.s[1] + 1); ok(`next card peeks ${Math.round(rest.b[1] - rest.a[1])}px`);
// tap zones: right two thirds forward, left third back
let b = await box(page);
await page.touchscreen.tap(b.x + b.width * .5, b.y + b.height / 2); await page.waitForTimeout(600); await idle(page);
assert.match(await count(page), /^2 of 12/); ok('tap centre goes forward');
await page.touchscreen.tap(b.x + b.width * .9, b.y + b.height / 2); await page.waitForTimeout(600); await idle(page);
assert.match(await count(page), /^3 of 12/); ok('tap right goes forward');
await page.touchscreen.tap(b.x + b.width * .2, b.y + b.height / 2); await page.waitForTimeout(600); await idle(page);
assert.match(await count(page), /^2 of 12/); ok('tap left third goes back');
// share is the highlighted action off the first card
assert.notEqual(await page.evaluate(() => getComputedStyle(document.getElementById('shareCard')).backgroundColor), 'rgba(0, 0, 0, 0)'); ok('share highlighted after first card');
// drag follows 1:1 and the deck stacks correctly mid-drag
const y = b.y + b.height / 2;
await page.mouse.move(b.x + 300, y); await page.mouse.down(); await page.mouse.move(b.x + 280, y, { steps: 2 }); await page.mouse.move(b.x + 200, y, { steps: 4 });
const mid = await page.evaluate(() => { const s = document.getElementById('cards'); const z = [...s.children].map(c => +c.style.zIndex); return { left: s.scrollLeft, w: s.clientWidth, z: z.slice(0, 4), t1: s.children[1].firstElementChild.style.transform, t2: s.children[2].firstElementChild.style.transform }; });
assert.equal(Math.round(mid.left - mid.w), 100, JSON.stringify(mid)); assert.match(mid.t1, /^rotate\(-/); assert.match(mid.t2, /^translateX\(-.*scale/); assert.ok(mid.z[1] > mid.z[2] && mid.z[2] > mid.z[3]); ok('drag tracks the pointer 1:1, leaving card on top');
await page.mouse.up(); await page.waitForTimeout(700); await idle(page);
assert.match(await count(page), /^3 of 12/); ok('drag past threshold advances');
// short drag snaps back
await page.mouse.move(b.x + 300, y); await page.mouse.down(); await page.mouse.move(b.x + 285, y, { steps: 3 }); await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(700); await idle(page);
assert.match(await count(page), /^3 of 12/); assert.equal(await page.evaluate(() => document.querySelectorAll('.slide .card')[2].style.transform), ''); ok('short drag snaps back, card settles flat');
// keyboard
await page.focus('#cards'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(600); await idle(page);
assert.match(await count(page), /^4 of 12/); await page.keyboard.press('End'); await page.waitForTimeout(800); await idle(page);
assert.equal(await count(page), 'Full recap'); await page.keyboard.press('Home'); await page.waitForTimeout(800); await idle(page);
assert.match(await count(page), /^1 of 12/); ok('keyboard arrows, End, Home');
// years
const chips = await page.$$eval('.year span', els => els.map(e => e.textContent));
assert.deepEqual(chips, ['All time', '2026', '2025', '2024']); assert.equal(await page.$eval('.year input:checked', e => e.value), '2026');
assert.equal(await page.isVisible('#years'), true); assert.equal(await page.evaluate(() => document.getElementById('groupTitle').classList.contains('vh')), true); ok('year chips visible, current year selected');
const heights = await page.$$eval('.year', els => els.map(e => Math.round(e.getBoundingClientRect().height)));
assert.ok(heights.every(h => h >= 44), String(heights)); ok('chip tap targets are 44px');
const before = await page.getAttribute('.slide .card', 'alt');
await page.locator('.year', { hasText: '2025' }).tap(); await page.waitForFunction(old => document.querySelector('.slide .card')?.alt !== old, before, { timeout: 15000 });
assert.match(await page.getAttribute('.slide .card', 'alt'), /in 2025/); assert.match(await count(page), /^1 of/); assert.equal(await page.evaluate(() => document.getElementById('viewer').classList.contains('updating')), false); ok('tapping 2025 rebuilds the recap for 2025');
await page.locator('.year', { hasText: 'All time' }).tap(); await page.waitForFunction(() => /in this export/.test(document.querySelector('.slide .card')?.alt), null, { timeout: 15000 }); ok('All time works');
// arrow keys move between chips (native radios)
await page.focus('.year input:checked'); await page.keyboard.press('ArrowRight'); await page.waitForFunction(() => /in 2026/.test(document.querySelector('.slide .card')?.alt), null, { timeout: 15000 }); ok('chips work from the keyboard');
// gallery round trip still works
await page.click('#next'); await page.waitForTimeout(600); await page.click('#openGallery'); await page.waitForSelector('#gallery:not([hidden])'); await page.click('#backToStory'); await page.waitForTimeout(900);
assert.equal(await page.isVisible('#cards'), true); assert.match(await count(page), /^2 of 12/); ok('gallery and back');
// no sideways page scroll
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); ok('no horizontal page overflow');
await page.context().close();

// ---------- single-year chat keeps its title, no chips ----------
page = await open({ viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true }, 'demo-chat.txt');
assert.equal(await page.isVisible('#years'), false); assert.equal(await page.isVisible('#groupTitle'), true); ok('single-year chat shows the title, no chips');
// tap during the nudge is not swallowed
await page.waitForTimeout(1800); b = await box(page);
await page.touchscreen.tap(b.x + b.width * .7, b.y + b.height / 2); await page.waitForTimeout(800); await idle(page);
assert.match(await count(page), /^2 of/); ok('tap during the nudge still advances');
await page.context().close();

// ---------- reduced motion: no transforms, no nudge ----------
page = await open({ viewport: { width: 390, height: 700 }, reducedMotion: 'reduce' });
await page.waitForTimeout(2000);
assert.equal(await page.evaluate(() => [...document.querySelectorAll('.slide .card')].every(c => !c.style.transform) && document.getElementById('cards').scrollLeft === 0), true); ok('reduced motion: flat cards, no nudge');
await page.click('#next'); await page.waitForTimeout(200); assert.match(await count(page), /^2 of/); ok('reduced motion: navigation works');
await page.context().close();

// ---------- desktop resize keeps the deck aligned ----------
page = await open({ viewport: { width: 1280, height: 800 } });
await page.waitForTimeout(2600); await page.click('#next'); await page.waitForTimeout(600);
await page.setViewportSize({ width: 800, height: 600 }); await page.waitForTimeout(400);
const after = await page.evaluate(() => { const s = document.getElementById('cards'); const c = s.children[1].firstElementChild.getBoundingClientRect(), r = s.getBoundingClientRect(); return { centred: Math.abs((c.left + c.right) / 2 - (r.left + r.right) / 2) < 2, t: s.children[1].firstElementChild.style.transform, left: s.scrollLeft, w: s.clientWidth }; });
assert.ok(after.centred && after.t === '' && after.left === after.w, JSON.stringify(after)); ok('resize keeps the current card centred');
await page.context().close();

await browser.close();
assert.deepEqual(errors, []); console.log(`\n${pass} checks passed, 0 page errors`);
