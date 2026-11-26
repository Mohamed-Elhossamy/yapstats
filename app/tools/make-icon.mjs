// Renders the three Yapstats app icons (light, dark, tinted) at 1024x1024 from one SVG drawing.
import { createRequire } from 'node:module';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
// A speech bubble holding three bars: a chat, counted. Filled shapes so it reads at 60px.
const bubble = 'M276 214h472a96 96 0 0 1 96 96v300a96 96 0 0 1-96 96H470L322 842a14 14 0 0 1-24-10V706h-22a96 96 0 0 1-96-96V310a96 96 0 0 1 96-96z';
const bars = [[352, 404, 180], [476, 330, 260], [600, 384, 200]].map(([x, y, h]) => `<rect x="${x}" y="${y}" width="72" height="${h}" rx="36"/>`).join('');
const icon = ({ from, to, glyph, cut, shadow }) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
  <rect width="1024" height="1024" fill="url(#g)"/>
  <path d="${bubble}" fill="${shadow}" transform="translate(30 34)"/>
  <path d="${bubble}" fill="${glyph}"/>
  <g fill="${cut}">${bars}</g>
</svg>`;
const variants = {
  'AppIcon-512@2x': { from: '#ffe357', to: '#ffd01f', glyph: '#17171c', cut: '#ffd92e', shadow: '#c9980a' },
  'AppIcon-dark': { from: '#22222b', to: '#131317', glyph: '#ffd92e', cut: '#17171c', shadow: '#000000' },
  'AppIcon-tinted': { from: '#000000', to: '#000000', glyph: '#ffffff', cut: '#000000', shadow: '#4d4d4d' },
};
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
for (const [name, colours] of Object.entries(variants)) {
  await page.setContent(`<style>html,body{margin:0}svg{display:block}</style>${icon(colours)}`);
  await page.screenshot({ path: `${name}.png`, omitBackground: false });
}
await browser.close();
