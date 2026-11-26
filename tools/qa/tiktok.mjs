// TikTok import, in headless Chrome: the data file (JSON, and the same file inside a ZIP) lists its chats, a picked
// group becomes a recap, and the TXT format is refused with a clear message. Run mktiktok.mjs first.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
execFileSync('python3', ['-c', "import zipfile; z = zipfile.ZipFile('tiktok-data.zip', 'w', zipfile.ZIP_DEFLATED); z.write('tiktok-data.json', 'user_data_tiktok.json'); z.close()"]);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const errors = []; let n = 0; const ok = name => { n++; console.log('ok', name); };
const ctx = await browser.newContext({ viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage(); page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://127.0.0.1:8788/'); await page.waitForTimeout(600);

const options = () => page.$$eval('#threadSelect option', list => list.map(option => option.textContent));
await page.setInputFiles('#file', 'tiktok-data.json'); await page.waitForSelector('#threads:not([hidden])');
assert.equal(await page.textContent('#threadTitle'), 'Choose a TikTok chat');
assert.deepEqual((await options()).slice(1), ['Flat 7 (group, 1,500 messages)', '5-a-side (group, 240 messages)', 'dev_patel (320 messages)', 'chloe.w (90 messages)', 'finn_ok (12 messages)']);
ok('the data file lists its chats: groups first, then the busiest');

await page.selectOption('#threadSelect', { index: 1 }); await page.click('#openThread');
await page.waitForSelector('#result:not([hidden])'); await page.waitForTimeout(800);
assert.equal(await page.textContent('#groupTitle'), 'Flat 7');
assert.match(await page.textContent('#storyCount'), /^1 of \d+ — Messages sent$/); ok('picking a group makes its recap');

await page.evaluate(() => [...document.querySelectorAll('#again,#another')].find(button => button.offsetParent).click()); await page.waitForTimeout(500);
await page.setInputFiles('#file', 'tiktok-data.zip'); await page.waitForSelector('#threads:not([hidden])');
assert.equal((await options()).length, 6); ok('the same file inside the downloaded ZIP works too');

await page.click('#changeExport'); await page.waitForTimeout(400);
await page.setInputFiles('#file', 'tiktok-direct-messages.txt'); await page.waitForSelector('#error:not([hidden])');
assert.match(await page.textContent('#error'), /TXT format.*choose JSON/); ok('the TXT format is refused with a clear message');

assert.deepEqual(errors, []); ok('no page errors');
console.log(`${n} checks passed, ${errors.length} page errors`);
await browser.close();
