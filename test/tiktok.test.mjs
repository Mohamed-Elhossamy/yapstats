import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

// The reader lives in the page. Run the part before the DOM code, as the page itself would.
const page = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const core = page.slice(page.indexOf("'use strict';"), page.indexOf('/* ---------- page ---------- */'));
const { tiktokExport, computeStats, ChatError } = vm.runInNewContext(core + '\n({ tiktokExport, computeStats, ChatError });', { TextDecoder, TextEncoder, Blob, URL });

const row = (Date, From, Content) => ({ Date, From, Content });
const flat = [
  row('2026-03-01 21:15:09', 'bilal.k', 'pizza tonight'),
  row('2026-03-01 21:14:00', 'amara.k', 'https://www.tiktokv.com/share/video/7300000000000000001/'),
  row('2026-03-01 21:16:30', 'amara.k', 'pizza and football'),
  row('not a date', 'amara.k', 'skipped'),
  row('2026-03-01 21:17:00', '', 'skipped too'),
];
const file = {
  Profile: { 'Profile Information': { ProfileMap: { userName: 'amara.k' } } },
  Activity: { 'Video Browsing History': { VideoList: [{ Date: '2026-01-01 00:00:00', Link: 'https://example.com' }] } },
  'Direct Message': {
    'Direct Messages': { ChatHistory: { 'Chat History with dev_patel:': [row('2026-01-05 10:00:00', 'dev_patel', 'hi'), row('2026-01-05 10:01:00', 'amara.k', 'hello')], 'Chat History with nobody:': [] } },
    'Group Chat': { GroupChat: { 'Group Chat with Flat 7:': flat } },
  },
};

test('a TikTok data file lists its chats, groups first, and skips empty ones', () => {
  const result = tiktokExport(JSON.stringify(file));
  assert.equal(result.source, 'TikTok');
  assert.deepEqual(Array.from(result.threads, thread => thread.label), ['Flat 7 (group, 5 messages)', 'dev_patel (2 messages)']);
});

test('a chat is read in time order, in UTC, with link-only messages counted as media', () => {
  const result = tiktokExport(JSON.stringify(file));
  const { chat, group } = result.openThread(result.threads[0]);
  assert.equal(group, 'Flat 7');
  assert.equal(chat.localTime, true);
  assert.deepEqual(Array.from(chat.messages, m => [m.a, m.type, m.text]), [['amara.k', 'media', ''], ['bilal.k', 'text', 'pizza tonight'], ['amara.k', 'text', 'pizza and football']]);
  assert.equal(chat.messages[0].t, Date.UTC(2026, 2, 1, 21, 14, 0));
  const words = Array.from(computeStats(chat.messages, 0, true).words, ([word]) => word);
  assert.deepEqual(words, ['pizza', 'tonight', 'football']);
});

test('older section names and a file with one chat are read too', () => {
  const older = { 'Direct Messages': { 'Chat History': { ChatHistory: { 'Chat History with dev_patel:': [row('2026-01-05 10:00:00', 'dev_patel', 'hi')] } } } };
  const result = tiktokExport(JSON.stringify(older));
  assert.equal(result.group, 'dev_patel');
  assert.equal(result.chat.messages.length, 1);
});

test('other JSON is left for the other readers, and a TikTok file with no chats says so', () => {
  assert.equal(tiktokExport('not json'), null);
  assert.equal(tiktokExport(JSON.stringify({ participants: [], messages: [] })), null); // Instagram
  assert.equal(tiktokExport(JSON.stringify({ hello: 'world' })), null);
  assert.throws(() => tiktokExport(JSON.stringify({ Profile: {}, 'Direct Message': {} })), error => error instanceof ChatError && /no chats/.test(error.message));
});
