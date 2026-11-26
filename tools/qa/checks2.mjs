import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const errors = []; let n = 0; const ok = name => { n++; console.log('ok', name); };
const ctx = await browser.newContext({ viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage(); page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://127.0.0.1:8788/'); await page.waitForTimeout(600);
assert.equal(await page.isVisible('#inApp'), false); ok('no in-app notice in a normal browser');
// phone order: upload button, then sample cards, then the paid offer
const order = await page.evaluate(() => ['file', 'fan', 'heroOffer'].map(id => Math.round((id === 'file' ? document.querySelector('label[for=file]') : document.getElementById(id)).getBoundingClientRect().top)));
assert.ok(order[0] < order[1] && order[1] < order[2], String(order)); ok('phone: sample cards sit between the upload button and the offer');
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); ok('landing has no sideways overflow');
// a file that is not a chat gives a readable error and stays on the landing page
await page.setInputFiles('#file', 'junk.txt'); await page.waitForSelector('#error:not([hidden])', { timeout: 15000 });
console.log('   error text:', await page.textContent('#error')); assert.equal(await page.isVisible('#hero'), true); ok('junk file: error shown on the landing page');
await page.click('.file-note a'); await page.waitForTimeout(500);
assert.ok(await page.evaluate(() => document.getElementById('export-guide').getBoundingClientRect().top < innerHeight)); ok('export help link jumps to the guide');
// recap
await page.setInputFiles('#file', 'flat7-chat.txt'); await page.waitForSelector('#result:not([hidden])'); await page.waitForTimeout(2600);
assert.equal(await page.isVisible('#packCue'), false); ok('no price cue on the first card');
const total = await page.evaluate(() => document.getElementById('cards').children.length);
for (let i = 0; i < total - 3; i++) { await page.click('#next'); await page.waitForTimeout(430); }
assert.match(await page.textContent('#storyCount'), /^12 of 12/); assert.equal(await page.isVisible('#packCue'), true);
assert.equal((await page.textContent('#packCueText')).trim(), 'Get this card for 5 others too · £2.99'); ok('price cue appears on the free sample personal card');
await page.click('#packCue'); await page.waitForTimeout(900);
assert.equal(await page.textContent('#storyCount'), 'Full recap'); assert.equal(await page.isVisible('#packCue'), false); ok('cue opens the offer slide');
assert.match(await page.textContent('#cards .pack-note'), /Polar/); assert.match(await page.textContent('#emailRecapTitle'), /£2\.99/); ok('offer names the payment company and the price');
// view the highlights too, then the end actions appear with a way to start again
await page.click('#prev'); await page.waitForTimeout(600); await page.click('#next'); await page.waitForTimeout(600);
assert.equal(await page.isVisible('#another'), true); await page.click('#another'); await page.waitForTimeout(400);
assert.equal(await page.isVisible('#hero'), true); assert.equal(await page.isVisible('#result'), false); ok('Recap another chat returns to upload');
// unlocked browser: no cue, no offer, all cards
await page.goto('http://127.0.0.1:8788/?unlock=yap-1e656267c3'); await page.waitForTimeout(500);
await page.setInputFiles('#file', 'flat7-chat.txt'); await page.waitForSelector('#result:not([hidden])'); await page.waitForTimeout(2600);
const full = await page.evaluate(() => ({ slides: document.getElementById('cards').children.length, pack: !document.getElementById('pack').hidden, offer: !!document.querySelector('.slide--offer') }));
assert.ok(full.slides > total && !full.pack && !full.offer, JSON.stringify(full)); ok(`unlocked: ${full.slides} slides, no offer shown`);
await page.keyboard.press('End'); await page.focus('#cards'); await page.keyboard.press('End'); await page.waitForTimeout(900);
assert.equal(await page.isVisible('#packCue'), false); ok('unlocked: no price cue anywhere at the end');
await ctx.close(); await browser.close();
assert.deepEqual(errors, []); console.log(n, 'checks passed, 0 page errors');
