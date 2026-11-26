// TikTok import is an app feature. On the website a TikTok data file is recognised and refused with a clear message,
// and the export guide does not show TikTok steps. Run mktiktok.mjs first. The import itself is checked in app/test.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const errors = []; let n = 0; const ok = name => { n++; console.log('ok', name); };
const ctx = await browser.newContext({ viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage(); page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://127.0.0.1:8788/'); await page.waitForTimeout(600);
for (const file of ['tiktok-data.json', 'tiktok-direct-messages.txt']) {
  await page.setInputFiles('#file', file); await page.waitForSelector('#error:not([hidden])');
  assert.match(await page.textContent('#error'), /TikTok chats are not read on the website/);
  assert.equal(await page.isVisible('#hero'), true);
  await page.reload(); await page.waitForTimeout(400);
}
ok('the website refuses a TikTok file (JSON or TXT) and says so');
assert.equal(await page.isVisible('.tiktok-guide'), false);
assert.doesNotMatch(await page.textContent('.file-note'), /TikTok/); ok('the website does not offer TikTok steps');
assert.deepEqual(errors, []); ok('no page errors');
console.log(`${n} checks passed, ${errors.length} page errors`);
await browser.close();
