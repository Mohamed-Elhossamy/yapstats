# Yapstats

Turn an exported WhatsApp or Instagram group chat into shareable recap cards: who talks most, when the chat wakes up, the most-used emoji, reply times, and an award for every member.

Live at **[yapstats.tech](https://yapstats.tech)**.

## How it works

- The chat export is parsed and analysed entirely in the browser. No account, no app, and the chat never leaves the device.
- Cards are drawn on `<canvas>` and exported as PNG images ready for stories.
- Supports WhatsApp `.txt`/`.zip` exports and Instagram message exports.
- Counting rules: messages are counted per sender; a new conversation starts after 6+ hours of quiet; reply time is the median time to answer someone else (minimum 10 replies); common English words are excluded from word counts. If the export cannot prove a number, that card is left out.

## Stack

- Plain HTML, CSS and JavaScript, no framework or build step
- Hosted on **Cloudflare Workers** with static assets (`public/`)
- `worker.mjs`: optional Full Recap email delivery using a Durable Object, Polar checkout status checks and Resend, with rate limiting and seven-day private download links
- Tests with the Node.js built-in test runner

## Run locally

```sh
npx wrangler dev           # serves public/ and the worker
node --test test/          # run the tests
```

Secrets (`POLAR_ACCESS_TOKEN`, `RESEND_API_KEY`) are set as Cloudflare Worker secrets and are never stored in this repo. Email delivery is switched by `RECAP_EMAIL_ENABLED` in `wrangler.jsonc` (`"true"` in production; set it to `"false"` to turn delivery off). See [docs/EMAIL_DELIVERY.md](docs/EMAIL_DELIVERY.md) for setup.

Not affiliated with, endorsed by or connected to WhatsApp, Instagram or Meta.
