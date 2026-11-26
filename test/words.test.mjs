import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

// The counting code lives in the page. Run the part before the DOM code, as the page itself would.
const page = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const core = page.slice(page.indexOf("'use strict';"), page.indexOf('/* ---------- page ---------- */'));
const { parseChat, computeStats } = vm.runInNewContext(core + '\n({ parseChat, computeStats });', { TextDecoder, TextEncoder, Blob, URL });

const chat = lines => lines.map((line, i) => `[01/03/2026, 10:${String(i % 60).padStart(2, '0')}:00] ${i % 2 ? 'Sam' : 'Jo'}: ${line}`).join('\n');
const topWords = lines => Array.from(computeStats(parseChat(chat(lines)).messages, 0).words, ([word]) => word); // Array.from: the page code runs in its own realm

test('grammar words stay out of Most-used words', () => {
  const words = topWords([
    'if we are going then I will book the pizza', 'because they would rather have pizza than anything',
    'then again there is football', 'football and pizza though', 'where was everyone during football',
  ]);
  assert.deepEqual(words.slice(0, 2), ['pizza', 'football']);
  for (const stop of ['then', 'because', 'they', 'would', 'there', 'though', 'where', 'everyone', 'during', 'going', 'rather']) {
    assert.ok(!words.includes(stop), stop);
  }
});

test('contractions are left out however they are typed', () => {
  // iPhone keyboards type a curly apostrophe; people also drop it altogether.
  const words = topWords(['I don’t think that’s right', "I don't think that's right", 'i dont think thats right', 'you’re late', 'youre late', 'I’m late pizza']);
  assert.deepEqual(words, ['late', 'pizza']);
});

test('possessives count with their word, and real words that look like contractions are kept', () => {
  const words = topWords(['mum’s car', "mum's car", 'mum said hell no', 'hell yes mum', 'what the hell']);
  assert.deepEqual(words.slice(0, 3), ['mum', 'hell', 'car']);
});

test('Instagram reaction and attachment notices are not counted as words', () => {
  const words = topWords(['Reacted 😂 to your message', 'Liked a message', 'Sam sent an attachment.', 'pizza tonight', 'pizza tonight', 'the message was about pizza']);
  assert.deepEqual(words, ['pizza', 'tonight', 'message']);
});
