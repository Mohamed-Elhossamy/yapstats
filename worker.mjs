const prefix = '/recap-email/';
const minute = 60_000;
const day = 24 * 60 * minute;
const maxZip = 16 * 1024 * 1024;
const partSize = 1024 * 1024;
const idPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const keyPattern = /^[0-9a-f]{64}$/;
const privateHeaders = {
  'cache-control': 'private, no-store',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-robots-tag': 'noindex, nofollow',
};
const json = (data, status = 200) => Response.json(data, { status, headers: privateHeaders });

function configured(env) {
  return Boolean(env.RECAP_EMAIL_ENABLED === 'true' && idPattern.test(env.POLAR_PRODUCT_ID) &&
    env.POLAR_ACCESS_TOKEN && env.RESEND_API_KEY && env.EMAIL_FROM);
}

function randomKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('');
}

async function readBounded(request, limit) {
  if (!request.body || Number(request.headers.get('content-length')) > limit) return null;
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function validArchive(bytes) {
  if (bytes.length < 22) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = offset => view.getUint16(offset, true);
  const u32 = offset => view.getUint32(offset, true);
  const end = bytes.length - 22;
  if (u32(end) !== 0x06054b50 || u16(end + 4) || u16(end + 6) || u16(end + 20)) return false;
  const entries = u16(end + 10);
  if (entries < 2 || entries > 100 || u16(end + 8) !== entries) return false;
  const directory = u32(end + 16);
  if (directory + u32(end + 12) !== end) return false;
  let central = directory;
  let local = 0;
  const decoder = new TextDecoder();
  const names = new Set();
  for (let i = 0; i < entries; i++) {
    if (central + 46 > end || local + 30 > directory) return false;
    if (u32(central) !== 0x02014b50 || u32(local) !== 0x04034b50 || u32(central + 42) !== local) return false;
    const nameLength = u16(central + 28);
    const size = u32(central + 24);
    if (!nameLength || nameLength > 50 || u16(central + 30) || u16(central + 32) || u16(central + 34) ||
        u16(central + 8) || u16(central + 10) || u32(central + 20) !== size || u16(local + 6) ||
        u16(local + 8) || u32(local + 14) !== u32(central + 16) || u32(local + 18) !== size ||
        u32(local + 22) !== size || u16(local + 26) !== nameLength || u16(local + 28)) return false;
    const start = local + 30 + nameLength;
    if (size < 45 || start + size > directory || central + 46 + nameLength > end) return false;
    const name = decoder.decode(bytes.subarray(local + 30, start));
    const centralName = decoder.decode(bytes.subarray(central + 46, central + 46 + nameLength));
    if (name !== centralName || !/^(recap-\d{2}\.png|chat-highlights\.png)$/.test(name) || names.has(name)) return false;
    names.add(name);
    if (view.getUint32(start) !== 0x89504e47 || view.getUint32(start + 4) !== 0x0d0a1a0a ||
        view.getUint32(start + 12) !== 0x49484452 || view.getUint32(start + size - 8) !== 0x49454e44) return false;
    central += 46 + nameLength;
    local = start + size;
  }
  return central === end && local === directory && names.has('chat-highlights.png');
}

function stub(env, id) {
  return env.DELIVERIES.get(env.DELIVERIES.idFromName(id));
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith(prefix)) return env.ASSETS.fetch(request);
    const route = pathname.slice(prefix.length);
    if (request.method === 'GET' && route === 'available') return json({ enabled: configured(env) });
    if (request.method === 'GET' && route === 'download') {
      const page = await env.ASSETS.fetch(new Request(new URL('/email-download/', request.url)));
      return new Response(page.body, { status: page.status, headers: {
        ...privateHeaders, 'content-type': 'text/html; charset=UTF-8',
      } });
    }
    if (request.method !== 'POST' || request.headers.get('origin') !== env.SITE_ORIGIN) return json({}, 403);
    try {
      if (route === 'start') {
        if (!configured(env)) return json({ error: 'Email delivery is temporarily unavailable.' }, 503);
        const ip = request.headers.get('cf-connecting-ip') || 'unknown';
        if (!(await env.RECAP_UPLOAD_LIMIT.limit({ key: ip })).success) {
          return json({ error: 'Too many attempts. Try again in a minute.' }, 429);
        }
        if (request.headers.get('content-type') !== 'application/zip') return json({}, 415);
        const bytes = await readBounded(request, maxZip);
        if (!bytes) return json({ error: 'This recap is too large for email delivery.' }, 413);
        if (!validArchive(bytes)) return json({ error: 'Could not prepare the recap images.' }, 400);
        const id = crypto.randomUUID();
        return await stub(env, id).fetch('https://delivery.internal/start', {
          method: 'POST', headers: { 'recap-id': id }, body: bytes,
        });
      }
      if (route !== 'status' && route !== 'file') return json({}, 404);
      const bytes = await readBounded(request, 256);
      if (!bytes) return json({}, 400);
      const data = new URLSearchParams(new TextDecoder().decode(bytes));
      const id = data.get('id') || '';
      const key = data.get('key') || '';
      if (!idPattern.test(id) || !keyPattern.test(key)) return json({}, 404);
      return await stub(env, id).fetch(`https://delivery.internal/${route}`, {
        method: 'POST', headers: { 'recap-key': key },
      });
    } catch {
      return json({ error: 'The recap service could not complete that request. Try again shortly.' }, 502);
    }
  },
};

export class RecapDelivery {
  constructor(ctx, env) {
    this.storage = ctx.storage;
    this.env = env;
    this.queue = Promise.resolve();
  }

  serial(action) {
    const result = this.queue.then(action);
    this.queue = result.catch(() => {});
    return result;
  }

  async polar(path, body) {
    const api = this.env.POLAR_SANDBOX === 'true' ? 'https://sandbox-api.polar.sh' : 'https://api.polar.sh';
    const response = await fetch(`${api}/v1/checkouts${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { authorization: `Bearer ${this.env.POLAR_ACCESS_TOKEN}`, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Polar returned ${response.status}`);
    return response.json();
  }

  async start(id, archive) {
    const env = this.env;
    const now = Date.now();
    const delivery = { id, claim: randomKey(), download: randomKey(), created: now,
      size: archive.byteLength, productId: env.POLAR_PRODUCT_ID, state: 'preparing' };
    await this.storage.setAlarm(now + 5 * minute);
    await this.storage.put('delivery', delivery);
    const chunks = {};
    for (let start = 0; start < archive.byteLength; start += partSize) {
      chunks[`part:${start / partSize}`] = archive.slice(start, start + partSize);
    }
    await this.storage.put(chunks);
    const checkout = await this.polar('/', {
      products: [env.POLAR_PRODUCT_ID],
      metadata: { yapstats_delivery: id },
      success_url: `${env.SITE_ORIGIN}/?recap-email=return#${id}.${delivery.claim}`,
      return_url: env.SITE_ORIGIN,
      allow_trial: false,
    });
    const expires = Date.parse(checkout.expires_at);
    const url = new URL(checkout.url);
    const checkoutHosts = env.POLAR_SANDBOX === 'true'
      ? ['sandbox.polar.sh', 'sandbox-buy.polar.sh'] : ['buy.polar.sh', 'polar.sh'];
    if (!idPattern.test(checkout.id) || checkout.product_id !== env.POLAR_PRODUCT_ID || !Number.isFinite(expires) ||
        expires <= now || url.protocol !== 'https:' || !checkoutHosts.includes(url.hostname) || url.username || url.password) {
      throw new Error('Unexpected Polar checkout response');
    }
    await this.storage.put('delivery', { ...delivery, state: 'pending', checkoutId: checkout.id, expires, nextCheck: now + 20_000 });
    await this.storage.setAlarm(now + minute);
    return json({ checkoutUrl: url.href });
  }

  async check(delivery, now) {
    const checkout = await this.polar(`/${delivery.checkoutId}`);
    if (checkout.id !== delivery.checkoutId || checkout.product_id !== delivery.productId ||
        checkout.metadata?.yapstats_delivery !== delivery.id) throw new Error('Checkout identity mismatch');
    if (checkout.status === 'succeeded') {
      const email = checkout.customer_email;
      const validEmail = typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      const paid = { ...delivery, state: 'paid', paidAt: now, downloadUntil: now + 7 * day,
        email: validEmail ? email : undefined, mail: validEmail ? 'pending' : 'unavailable' };
      // Persist the alarm before the transition so an interruption cannot orphan the archive.
      await this.storage.setAlarm(now + 1000);
      await this.storage.put('delivery', paid);
      return paid;
    }
    if (['failed', 'expired'].includes(checkout.status) || now >= delivery.expires + day) {
      await this.clear();
      return null;
    }
    const age = now - delivery.created;
    const interval = age < 10 * minute ? minute : age < 60 * minute ? 5 * minute : 15 * minute;
    const next = { ...delivery, nextCheck: now + interval };
    await this.storage.setAlarm(next.nextCheck);
    await this.storage.put('delivery', next);
    return next;
  }

  async send(delivery, now) {
    if (now - delivery.paidAt >= 23 * 60 * minute) {
      await this.storage.put('delivery', { ...delivery, email: undefined, mail: 'unavailable' });
      await this.storage.setAlarm(delivery.downloadUntil);
      return;
    }
    const link = `${this.env.SITE_ORIGIN}${prefix}download#${delivery.id}.${delivery.download}`;
    // Retry with the same provider key if the send result is lost or temporarily rejected.
    await this.storage.setAlarm(now + 5 * minute);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.env.RESEND_API_KEY}`, 'content-type': 'application/json',
        'idempotency-key': `yapstats-recap/${delivery.checkoutId}` },
      body: JSON.stringify({ from: this.env.EMAIL_FROM, to: [delivery.email], reply_to: 'hello@yapstats.tech',
        subject: 'Your Yapstats Full Recap is ready',
        text: `Download all your Yapstats cards: ${link}\n\nThis private link expires seven days after your purchase. Save the ZIP to keep the cards.\n\nNeed help? Reply to this email.` }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Email service returned ${response.status}`);
    await this.storage.put('delivery', { ...delivery, email: undefined, mail: 'sent' });
    await this.storage.setAlarm(delivery.downloadUntil);
  }

  async clear() {
    await this.storage.deleteAll();
    await this.storage.deleteAlarm();
  }

  fetch(request) {
    return this.serial(async () => {
      const { pathname } = new URL(request.url);
      if (pathname === '/start') return this.start(request.headers.get('recap-id'), await request.arrayBuffer());
      let delivery = await this.storage.get('delivery');
      const key = request.headers.get('recap-key');
      if (!delivery || (pathname === '/status' ? key !== delivery.claim : key !== delivery.download)) return json({}, 404);
      const now = Date.now();
      if (pathname === '/status') {
        if (delivery.state === 'pending' && now >= delivery.nextCheck) {
          try { delivery = await this.check(delivery, now); }
          catch {
            await this.storage.setAlarm(now + minute);
            await this.storage.put('delivery', { ...delivery, nextCheck: now + minute });
          }
        }
        if (!delivery) return json({ state: 'expired' }, 404);
        if (delivery.state !== 'paid') return json({ state: 'pending' });
        return json({ state: 'paid', mail: delivery.mail,
          downloadUrl: now < delivery.downloadUntil ? `${prefix}download#${delivery.id}.${delivery.download}` : null });
      }
      if (pathname !== '/file' || delivery.state !== 'paid' || now >= delivery.downloadUntil) return json({}, 404);
      const { storage } = this;
      let offset = 0;
      const body = new ReadableStream({
        async pull(controller) {
          if (offset >= delivery.size) return controller.close();
          const part = await storage.get(`part:${offset / partSize}`);
          if (!part) return controller.error(new Error('Missing archive data'));
          offset += part.byteLength;
          controller.enqueue(new Uint8Array(part));
        },
      });
      return new Response(body, { headers: { ...privateHeaders, 'content-type': 'application/zip',
        'content-disposition': 'attachment; filename="yapstats-full-recap.zip"', 'content-length': String(delivery.size) } });
    });
  }

  alarm() {
    return this.serial(async () => {
      const delivery = await this.storage.get('delivery');
      if (!delivery) return;
      const now = Date.now();
      if (delivery.state === 'preparing' || (delivery.state === 'paid' && now >= delivery.downloadUntil)) {
        await this.clear();
        return;
      }
      if (delivery.state === 'paid') {
        if (delivery.mail !== 'pending') await this.storage.setAlarm(delivery.downloadUntil);
        else await this.send(delivery, now);
        return;
      }
      if (now >= delivery.expires + day) {
        // Stop retaining abandoned checkouts even if Polar is temporarily unreachable.
        try { await this.check(delivery, now); } catch { await this.clear(); }
        return;
      }
      await this.storage.setAlarm(now + 5 * minute);
      await this.check(delivery, now);
    });
  }
}
