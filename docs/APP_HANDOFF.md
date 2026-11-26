# Handoff: turn Yapstats into an iOS and Android app

Written 26 Nov 2026 at the end of the web polish session. Read this first, then `README.md`.

## Goal

Ship Yapstats as a real app on the App Store and Google Play, at the same quality bar as the site. TikTok chat import comes after the app. Snapchat import is rejected (its export only holds saved messages, so recaps would be near-empty).

## What exists today

- **Site:** https://yapstats.tech. Turns a WhatsApp or Instagram chat export into shareable recap cards.
- **Repo:** `Mohamed-Elhossamy/yapstats`, branch `main`.
- **Stack:** one self-contained `public/index.html` (plain HTML, CSS, JS, no framework, no build step). Cards are drawn on `<canvas>` and exported as PNG. The chat is parsed in the browser.
- **Worker:** `worker.mjs` on Cloudflare Workers (static assets plus a Durable Object) handles optional paid email delivery of the finished cards through Polar and Resend. See `docs/EMAIL_DELIVERY.md`.
- **Money:** Full recap, £2.99 one-off, Polar checkout, unlocked per browser by a code in `localStorage`. Ko-fi tip link in the footer.

## How deploys work

- **A push to `main` goes live.** Cloudflare Workers Builds is linked to the repo and runs `npx wrangler deploy`. Preview builds are off.
- Check a build: `gh api repos/Mohamed-Elhossamy/yapstats/commits/main/check-runs --jq '.check_runs[]|[.name,.status,.conclusion]|@tsv'`
- `wrangler.jsonc` is the source of truth for production variables. `RECAP_EMAIL_ENABLED` is `"true"` in production. Secrets live in Cloudflare, never in the repo.
- After a deploy, confirm on the live site: the CSP hash matches the script, and `/recap-email/available` still returns `{"enabled":true}`.

## Rules that must hold

1. The chat export never leaves the device. Email delivery uploads only the finished cards.
2. No analytics, no third-party code, no new accounts and nothing that costs money without asking Mohamed first.
3. The price stays £2.99 unless he changes it.
4. The name, listing and design must not use "WhatsApp", "Wrapped" or another company's brand. Keep the "not affiliated with WhatsApp or Meta" line.
5. Never ask him to send a real chat. Use the synthetic generators in `tools/qa/`. He tests real exports himself.
6. Honest persuasion only: no fake scarcity, countdowns, invented reviews or counts.

## Traps

- **CSP hash.** `public/index.html` allows its inline script by SHA-256 hash. After any edit to that script run `node tools/qa/hash.mjs`, or the page loads with no JavaScript.
- **Stale local copy.** `~/Documents/Codex/2026-11-12/new-chat-3/work/recap-email` on his Mac is older than GitHub. Do not deploy from it.
- **Claude and his Mac.** Typing into Terminal is not possible through computer use, and the folder-access request was blocked in this session. Work from the GitHub repo. The Claude desktop app's browser pane was signed in to Cloudflare and GitHub.
- **Trackpad and native scroll.** The card strip is driven entirely by JavaScript (pointer drag, wheel handler, tap zones). Native sideways scrolling fights the deck transition, so do not re-enable it.

## Tests

- `node --test test/*.mjs`: 8 unit tests (email delivery, word filter).
- `tools/qa/`: 42 headless-Chrome checks. See `tools/qa/README.md` for how to run them.
- **Never tested:** a real phone, the TikTok or Instagram in-app browsers, a real Polar purchase.

## What changed on 26 Nov 2026

- Most-used words: larger grammar-word list; curly apostrophes, contractions without apostrophes and possessives handled; Instagram reaction notices ignored.
- Cards: deck-style swipe, 1:1 finger tracking, tap zones (left third back, rest forward), first-card nudge, trackpad swipes turn one card each.
- Year: visible chips replace the hidden select. A single-year chat keeps its title.
- Offer: price cue sits on the free sample personal card; shorter unlock dialog.
- Landing: export help link; on phones the sample cards come before the paid offer; notice for in-app browsers.
- Mohamed rejected a "See a sample recap" demo button: the three sample cards on the landing page are enough.

## Open decisions for the app (not made yet)

1. **Build approach.** Starting point to evaluate, not a decision: wrap the existing page in a native shell (Capacitor is the usual tool), because the parser and canvas card drawing already work and would be reused unchanged. Compare it with a native rewrite before choosing. His standing rule: search GitHub first for reusable open-source repos (1k+ stars, recent commits, permissive licence), report them and get approval before copying.
2. **The feature that justifies an app.** Receiving the export straight from the share sheet. On the web a user must export, save to Files, then upload. An app registered as a share target for `.zip` and `.txt` could be picked directly from WhatsApp's "Export chat" sheet. Confirm this works on both platforms early, because it is the main reason to install.
3. **Payments.** The site sells the unlock through Polar. Check the current App Store and Google Play rules for digital unlocks before designing the in-app purchase.
4. **Saving and sharing.** Save to Photos and the native share sheet instead of browser downloads.

## Verify from official sources before building or promising anything

Do not rely on memory for these; they change.

- Apple Developer Program: cost, age and identity requirements.
- Google Play Console: cost, and any testing requirement for new personal accounts before production access.
- In-app purchase rules for a one-off digital unlock on each store, and whether an external checkout link is allowed in the UK.
- App Review rules on apps that are mainly a wrapped website.
- Rules on naming another company's product (WhatsApp, Instagram) in a listing, keywords and screenshots.
- Privacy label and Data Safety answers for "chat processed on device, optional upload of finished cards".

He has an `app-store-compliance` skill. Run it before calling anything submission-ready.

## How Mohamed wants the work done

- Lead with the next action. Short answers. One concrete action for him at the end, doable in under two minutes.
- Do the work yourself where a tool allows it. He does not want Terminal steps.
- Verify before claiming. Say what was and was not tested.
- Ask before costs, accounts, third-party code or a price change. Do not ask about things already decided here.

## First steps for the new chat

1. Add the repo `Mohamed-Elhossamy/yapstats` and read this file and `README.md`.
2. Do the official-source checks above and the GitHub search, then give him one recommended approach, one fallback and the total cost in pounds.
3. Wait for his yes on approach and costs before creating accounts or projects.
4. Prototype the share-sheet import first on one platform, with a synthetic export.
