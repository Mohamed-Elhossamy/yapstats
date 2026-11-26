// Synthetic TikTok data download (JSON format): two group chats, three one-to-one chats and unrelated sections.
// Every name and line is made up. Layout follows open-source readers of real exports; see docs/TIKTOK_IMPORT.md.
import { writeFileSync } from 'node:fs';
let seed = 11; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
const me = 'amara.k';
const lines = ['this is so us 😂', 'no way', 'who is coming to football on thursday', 'pizza after?', 'I am crying 💀', 'send the recipe', 'we need to try this', 'the library is rammed', 'coursework is due friday', 'that dog though', 'football was class tonight', 'pizza again?? 🍕', 'lol', 'stop it 😂😂'];
const pad = n => String(n).padStart(2, '0');
const stamp = t => { const d = new Date(t); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`; };
function chat(people, total, start) {
  const rows = []; let t = start;
  for (let i = 0; i < total; i++) {
    t += rnd() < .15 ? (5 + rnd() * 30) * 36e5 : rnd() * 8 * 6e4;
    const from = people[Math.min(people.length - 1, Math.floor(rnd() * rnd() * people.length * 1.3))];
    rows.push({ Date: stamp(t), From: from, Content: rnd() < .45 ? `https://www.tiktokv.com/share/video/${7300000000000000000n + BigInt(Math.floor(rnd() * 1e15))}/` : pick(lines) });
  }
  return rows.reverse(); // newest first: the reader must not rely on the file's order
}
const data = {
  Profile: { 'Profile Information': { ProfileMap: { userName: me, bioDescription: 'made up' } } },
  Activity: { 'Video Browsing History': { VideoList: Array.from({ length: 400 }, (_, i) => ({ Date: stamp(Date.UTC(2026, 0, 1) + i * 36e5), Link: `https://www.tiktokv.com/share/video/${7300000000000000000n + BigInt(i)}/` })) } },
  'Direct Message': {
    'Direct Messages': { ChatHistory: {
      'Chat History with dev_patel:': chat([me, 'dev_patel'], 320, Date.UTC(2025, 2, 1, 9)),
      'Chat History with chloe.w:': chat(['chloe.w', me], 90, Date.UTC(2026, 1, 3, 20)),
      'Chat History with finn_ok:': chat([me, 'finn_ok'], 12, Date.UTC(2026, 6, 9, 22)),
    } },
    'Group Chat': { GroupChat: {
      'Group Chat with 5-a-side:': chat(['finn_ok', me, 'dev_patel', 'bilal.k'], 240, Date.UTC(2026, 3, 2, 18)),
      'Group Chat with Flat 7:': chat([me, 'bilal.k', 'chloe.w', 'dev_patel', 'elliemae', 'finn_ok'], 1500, Date.UTC(2025, 8, 3, 18)),
    } },
  },
};
writeFileSync('tiktok-data.json', JSON.stringify(data));
// The TXT format is not supported: one file is enough to check that the page says so.
writeFileSync('tiktok-direct-messages.txt', '>>> Chat History with dev_patel:\n2026-01-01 10:00:00 dev_patel: made up line\n');
console.log('tiktok-data.json', Object.values(data['Direct Message']).flatMap(section => Object.values(Object.values(section)[0])).reduce((n, rows) => n + rows.length, 0), 'messages');
