// Makes the App Store screenshots in docs/store-screenshots: the app (browser render, made-up sample chat) under a
// headline, at 1320x2868 and 1206x2622. No other company's brand, no prices, no emoji card.
//
// Run from app/:  node tools/make-screenshots.mjs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
const here = import.meta.dirname;
const site = resolve(here, '../../public');
const out = resolve(here, '../../docs/store-screenshots');
mkdirSync(out, { recursive: true });
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

// 1. The app itself, at iPhone 16 Pro page size and 3x.
const app = await browser.newContext({ viewport: { width: 402, height: 778 }, hasTouch: true, isMobile: true, colorScheme: 'dark', deviceScaleFactor: 3 });
const page = await app.newPage();
await page.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true }; });
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.waitForTimeout(2500);
await page.evaluate(() => window.yapstatsPurchase({ owned: true })); // the full recap, so a personal card can be shown
const shots = {};
const grab = async name => { shots[name] = (await page.screenshot()).toString('base64'); };
await page.click('#trySample');
await page.waitForTimeout(950); await grab('loading');
await page.waitForSelector('#result:not([hidden])'); await page.waitForTimeout(1500);
const next = async () => { await page.touchscreen.tap(340, 380); await page.waitForTimeout(650); };
const title = () => page.textContent('#storyCount');
const wanted = { talkers: /Top talkers/, hour: /Busiest hour/, words: /Most-used words/ };
for (let i = 0; i < 26 && Object.keys(shots).length < 5; i++) {
  await next();
  const now = await title();
  for (const [name, pattern] of Object.entries(wanted)) if (!shots[name] && pattern.test(now)) await grab(name);
  if (!shots.personal && /^(?:19|2\d) of /.test(now)) await grab('personal'); // the personal cards come after the rankings
}
await app.close();

// 2. Each screenshot: a headline over the app screen.
const slides = [
  ['talkers', 'Who really runs', 'the group chat?'],
  ['hour', 'Find your', 'busiest hour'],
  ['words', 'The words your', 'group wears out'],
  ['personal', 'A card for', 'everyone'],
  ['loading', 'Your chat stays', 'on your iPhone'],
];
for (const [width, height] of [[1320, 2868], [1206, 2622]]) {
  const frame = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const sheet = await frame.newPage();
  for (const [index, [name, first, second]] of slides.entries()) {
    if (!shots[name]) throw new Error(`no screen for ${name}`);
    await sheet.setContent(`<style>
      html, body { margin: 0; height: 100%; }
      body { background: radial-gradient(90% 40% at 50% 0%, #2c2812, #131317 70%); color: #f3f5f2; font-family: Inter, system-ui, sans-serif; overflow: hidden; }
      h1 { margin: 0; padding: 7.2vw 6vw 0; font-size: 9.6vw; line-height: 1.08; letter-spacing: -.045em; font-weight: 800; }
      mark { background: #ffd92e; color: #17171c; padding: 0 1.6vw .6vw; border-radius: 2.2vw; box-decoration-break: clone; }
      .phone { position: absolute; left: 9vw; right: 9vw; top: 36vw; border-radius: 7vw; overflow: hidden; border: .9vw solid #2d2d36; box-shadow: 0 0 12vw #ffd92e2e, 0 4vw 8vw #000a; background: #131317; }
      .phone img { display: block; width: 100%; }
    </style><h1>${first}<br><mark>${second}</mark></h1><div class="phone"><img src="data:image/png;base64,${shots[name]}"></div>`);
    await sheet.waitForTimeout(250);
    await sheet.screenshot({ path: join(out, `${index + 1}-${name}-${width}x${height}.png`), omitBackground: false });
  }
  await frame.close();
}
await browser.close(); server.close();
console.log('wrote', slides.length * 2, 'screenshots to', out);
