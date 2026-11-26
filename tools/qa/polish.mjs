// Website polish shared with the app: sample chat, the loading cards, landing on the first new card after an unlock,
// and no TikTok wording on the website. Needs the site on :8788 (see README).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const code = readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8').match(/UNLOCK_CODE = '([^']+)'/)[1];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const errors = []; let n = 0; const ok = name => { n++; console.log('ok', name); };
const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage(); page.on('pageerror', e => errors.push(String(e)));
const site = 'http://127.0.0.1:8788';
await page.goto(site + '/'); await page.waitForTimeout(700);

for (const path of ['/', '/about/', '/privacy/', '/terms/', '/export-whatsapp-chat/', '/export-instagram-messages/']) {
  const sub = await ctx.newPage(); await sub.goto(site + path);
  assert.doesNotMatch(await sub.evaluate(() => document.body.innerText), /tiktok/i, path); await sub.close();
}
ok('no page on the website names TikTok');

await page.click('.file-note .sample-link');
await page.waitForFunction(() => /\d/.test(document.querySelector('.loader-art span:last-child').dataset.count || ''), null, { timeout: 5000 });
ok('loading screen counts the messages read on its front card');
await page.waitForSelector('#result:not([hidden])', { timeout: 30000 });
const free = Number((await page.textContent('#storyCount')).match(/^1 of (\d+)/)[1]);
assert.match(await page.evaluate(() => document.body.innerText), /Flat 12 \(sample\)/); ok(`the sample chat opens a ${free}-card recap`);
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); ok('recap has no sideways overflow');

// Paid in another tab while the recap is open: the new cards start where the free ones ended, not back at card 1.
await page.waitForTimeout(3200);
for (let i = 0; i < 3; i++) { await page.focus('#cards'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(700); }
assert.match(await page.textContent('#storyCount'), new RegExp(`^4 of ${free}\\b`));
const pay = await ctx.newPage(); await pay.goto(`${site}/?unlock=${code}`); await pay.waitForTimeout(400); await pay.close();
await page.waitForFunction(free => { const [, at, of] = document.getElementById('storyCount').textContent.match(/^(\d+) of (\d+)/) || []; return Number(at) === free && Number(of) > free; }, free, { timeout: 15000 });
const seen = await page.evaluate(() => document.querySelectorAll('#progress .seen').length);
assert.ok(seen >= 3, `seen ${seen}`); ok(`unlock mid-recap lands on the first new card (${(await page.textContent('#storyCount')).split(' — ')[0]}), earlier cards stay seen`);

assert.deepEqual(errors, []); ok('no page errors');
console.log(`${n} checks passed, ${errors.length} page errors`);
await browser.close();
