// Synthetic multi-year WhatsApp export (iPhone style, curly apostrophes). Every name and line is made up.
import { writeFileSync } from 'node:fs';
let seed = 7; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
const people = ['Amara', 'Bilal K', 'Chloe', 'Dev', 'Ellie-Mae', 'Finn'];
const lines = [
  'if we’re going then I’ll book it', 'I don’t think that’s right though', 'it’s fine honestly, we’ll sort it',
  'who’s coming to football on Thursday?', 'can’t believe he didn’t show up again', 'what time are we meeting tonight',
  'I’m at the library if anyone wants to come', 'that’s so funny 😂😂', 'there’s pizza in the kitchen if you want some',
  'wouldn’t have done it if I’d known', 'they’re not gonna be there until about nine', 'she said she would but then she didnt',
  'football was class tonight', 'pizza again?? 🍕', 'bro the library is rammed', 'is anyone else doing the coursework',
  'coursework is due friday dont forget', 'haha no way', 'lol', 'where are you all', 'I think we should just go then',
  'because it was either that or nothing', 'has anyone seen my charger 🔌', 'you’ve got to be joking 💀',
  'let’s do pizza and football saturday', 'Im so tired', 'whats the plan', 'I’d rather not if that’s ok', 'WHO ATE MY PASTA',
];
const out = []; const pad = n => String(n).padStart(2, '0');
out.push('[03/09/2024, 18:00:00] Flat 7: ‎Messages and calls are end-to-end encrypted.');
let t = Date.UTC(2024, 8, 3, 18, 1);
const end = Date.UTC(2026, 10, 20);
while (t < end) {
  t += rnd() < .12 ? (7 + rnd() * 40) * 36e5 : rnd() * 9 * 6e4;
  const d = new Date(t), who = people[Math.min(people.length - 1, Math.floor(rnd() * rnd() * people.length * 1.3))];
  const roll = rnd();
  const body = roll < .04 ? '‎image omitted' : roll < .05 ? 'This message was deleted.' : pick(lines);
  out.push(`[${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}] ${who}: ${body}`);
}
writeFileSync('flat7-chat.txt', out.join('\n') + '\n'); console.log(out.length, 'lines');
