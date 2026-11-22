import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import worker, { RecapDelivery } from '../worker.mjs';

const site = 'https://yapstats.tech';
const product = 'd3d54df7-8c45-4edd-81ae-f26c7c5503e2';
const checkout = '3188edbe-5c21-405e-890d-9c066980a798';
const day = 86_400_000;
const png = new Blob([await readFile(new URL('../public/og.png', import.meta.url))]);
const page = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const zipCode = page.slice(page.indexOf('async function recapZip('), page.indexOf('function openEmailRecap('));
const pack = vm.runInNewContext(zipCode + '\nrecapZip', { Blob, TextEncoder });
const zip = await pack([png, png]);

function mockStorage() {
  const values = new Map();
  return {
    values,
    alarm: null,
    async get(key) { return structuredClone(values.get(key)); },
    async put(key, value) {
      const entries = typeof key === 'object' ? Object.entries(key) : [[key, value]];
      for (const [name, data] of entries) values.set(name, structuredClone(data));
    },
    async setAlarm(time) { this.alarm = time; },
    async deleteAlarm() { this.alarm = null; },
    async deleteAll() { values.clear(); },
  };
}

function fixture(t) {
  const objects = new Map();
  const sent = [];
  let status = 'open', details, failMail = false;
  const env = {
    SITE_ORIGIN: site, RECAP_EMAIL_ENABLED: 'true', POLAR_PRODUCT_ID: product,
    POLAR_ACCESS_TOKEN: 'test-polar-token', RESEND_API_KEY: 'test-resend-key', EMAIL_FROM: 'recaps@send.yapstats.tech',
    ASSETS: { fetch: () => new Response('page') },
    RECAP_UPLOAD_LIMIT: { limit: async () => ({ success: true }) },
    DELIVERIES: {
      idFromName: id => id,
      get(id) {
        if (!objects.has(id)) {
          const storage = mockStorage();
          objects.set(id, { object: new RecapDelivery({ storage }, env), storage });
        }
        const { object } = objects.get(id);
        return { fetch: (url, init) => object.fetch(new Request(url, init)) };
      },
    },
  };
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    const url = new URL(input);
    if (url.hostname === 'api.resend.com') {
      sent.push({ key: init.headers['idempotency-key'], body: JSON.parse(init.body) });
      return new Response(null, { status: failMail ? 503 : 201 });
    }
    assert.equal(url.hostname, 'api.polar.sh');
    if (init.method === 'POST') details = JSON.parse(init.body);
    return Response.json({ id: checkout, product_id: product, status, metadata: details.metadata,
      url: 'https://buy.polar.sh/test', expires_at: new Date(Date.now() + day).toISOString(),
      customer_email: 'buyer@example.com' });
  });
  async function post(route, body, origin = site) {
    return worker.fetch(new Request(site + '/recap-email/' + route, {
      method: 'POST', headers: { origin }, body,
    }), env);
  }
  return {
    env, objects, sent, post,
    setStatus: value => { status = value; },
    failMail: value => { failMail = value; },
    async start() {
      const response = await post('start', zip);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).checkoutUrl, 'https://buy.polar.sh/test');
      const [id, key] = new URL(details.success_url).hash.slice(1).split('.');
      assert.equal(details.metadata.yapstats_delivery, id);
      assert.deepEqual(details.products, [product]);
      assert.equal(details.customer_email, undefined);
      return { id, key, ...objects.get(id) };
    },
  };
}

test('only confirmed checkout releases the exact original PNG ZIP and emails the Polar buyer', async t => {
  const f = fixture(t);
  const { id, key, object, storage } = await f.start();
  const claim = new URLSearchParams({ id, key });
  const mailKey = (await storage.get('delivery')).download;
  const download = new URLSearchParams({ id, key: mailKey });
  assert.equal((await f.post('file', download)).status, 404);
  assert.equal((await f.post('status', new URLSearchParams({ id, key: '0'.repeat(64) }))).status, 404);
  f.setStatus('confirmed');
  await object.alarm();
  assert.deepEqual(await (await f.post('status', claim)).json(), { state: 'pending' });
  assert.equal(f.sent.length, 0);
  f.setStatus('succeeded');
  await object.alarm();
  const paid = await (await f.post('status', claim)).json();
  assert.equal(paid.state, 'paid');
  assert.equal(paid.mail, 'pending');
  assert.match(paid.downloadUrl, /\/recap-email\/download#/);
  await Promise.all([object.alarm(), object.alarm()]);
  assert.equal(f.sent.length, 1);
  assert.deepEqual(f.sent[0].body.to, ['buyer@example.com']);
  assert.ok(f.sent[0].body.text.includes(site + paid.downloadUrl));
  assert.equal((await storage.get('delivery')).email, undefined);
  assert.equal((await f.post('file', claim)).status, 404);
  const file = await f.post('file', download);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()), new Uint8Array(await zip.arrayBuffer()));
});

test('retries transient email failure with the same idempotency key', async t => {
  const f = fixture(t);
  const { object, storage } = await f.start();
  f.setStatus('succeeded');
  await object.alarm();
  f.failMail(true);
  await assert.rejects(object.alarm(), /Email service returned 503/);
  assert.equal((await storage.get('delivery')).mail, 'pending');
  f.failMail(false);
  await object.alarm();
  assert.equal(f.sent[0].key, f.sent[1].key);
  assert.equal((await storage.get('delivery')).mail, 'sent');
});

test('cleans up abandoned and expired archives', async t => {
  const f = fixture(t);
  const first = await f.start();
  f.setStatus('expired');
  await first.object.alarm();
  assert.equal(first.storage.values.size, 0);
  assert.equal(first.storage.alarm, null);
  const second = await f.start();
  f.setStatus('succeeded');
  await second.object.alarm();
  const paid = await second.storage.get('delivery');
  await second.storage.put('delivery', { ...paid, downloadUntil: Date.now() - 1 });
  await second.object.alarm();
  assert.equal(second.storage.values.size, 0);
});

test('rejects wrong origin, malformed ZIP, oversize upload and disabled configuration', async t => {
  const f = fixture(t);
  assert.equal((await f.post('start', zip, 'https://other.example')).status, 403);
  const invalid = new Blob([new Uint8Array(300)], { type: 'application/zip' });
  assert.equal((await f.post('start', invalid)).status, 400);
  const oversized = new Blob([new Uint8Array(17 * 1024 * 1024)], { type: 'application/zip' });
  assert.equal((await f.post('start', oversized)).status, 413);
  f.env.RECAP_EMAIL_ENABLED = 'false';
  assert.equal((await f.post('start', zip)).status, 503);
  assert.equal(f.objects.size, 0);
});
