// TikTok import in the app, in headless Chrome: the data file (JSON, and the same file inside a ZIP) lists its chats,
// a picked group becomes a recap, and the TXT format is refused with a clear message.
//
// Run from app/:  node test/tiktok.check.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const here = import.meta.dirname;
const site = resolve(here, '../../public');
const work = mkdtempSync(join(tmpdir(), 'yapstats-tiktok-'));
execFileSync('node', [resolve(here, '../../tools/qa/mktiktok.mjs')], { cwd: work }); // synthetic export, all made up
execFileSync('python3', ['-c', "import zipfile; z = zipfile.ZipFile('tiktok-data.zip', 'w', zipfile.ZIP_DEFLATED); z.write('tiktok-data.json', 'user_data_tiktok.json'); z.close()"], { cwd: work });

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
const context = await browser.newContext({ viewport: { width: 402, height: 778 }, hasTouch: true, isMobile: true });
const page = await context.newPage();
const errors = []; page.on('pageerror', error => errors.push(String(error)));
await page.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true }; });
await page.goto(`http://127.0.0.1:${server.address().port}/`);
let passed = 0; const ok = name => { passed++; console.log('ok', name); };
await page.waitForTimeout(2300);

await page.click('#exportLink'); await page.waitForTimeout(300);
assert.equal(await page.isVisible('.tiktok-guide'), true); ok('the export guide shows the TikTok steps');
await page.click('#exportLink'); await page.waitForTimeout(300);

const options = () => page.$$eval('#threadSelect option', list => list.map(option => option.textContent));
await page.setInputFiles('#file', join(work, 'tiktok-data.json')); await page.waitForSelector('#threads:not([hidden])');
assert.equal(await page.textContent('#threadTitle'), 'Choose a TikTok chat');
assert.deepEqual((await options()).slice(1), ['Flat 7 (group, 1,500 messages)', '5-a-side (group, 240 messages)', 'dev_patel (320 messages)', 'chloe.w (90 messages)', 'finn_ok (12 messages)']);
ok('the data file lists its chats: groups first, then the busiest');

await page.selectOption('#threadSelect', { index: 1 }); await page.click('#openThread');
await page.waitForSelector('#result:not([hidden])'); await page.waitForTimeout(800);
assert.equal(await page.textContent('#groupTitle'), 'Flat 7');
assert.match(await page.textContent('#storyCount'), /^1 of \d+ — Messages sent$/); ok('picking a group makes its recap');

await page.click('#backHome'); await page.waitForTimeout(500);
await page.setInputFiles('#file', join(work, 'tiktok-data.zip')); await page.waitForSelector('#threads:not([hidden])');
assert.equal((await options()).length, 6); ok('the same file inside the downloaded ZIP works too');

await page.click('#changeExport'); await page.waitForTimeout(400);
await page.setInputFiles('#file', join(work, 'tiktok-direct-messages.txt')); await page.waitForSelector('#error:not([hidden])');
assert.match(await page.textContent('#error'), /TXT format.*choose JSON/); ok('the TXT format is refused with a clear message');

assert.deepEqual(errors, []); ok('no page errors');
console.log(`${passed} checks passed`);
await browser.close(); server.close();
