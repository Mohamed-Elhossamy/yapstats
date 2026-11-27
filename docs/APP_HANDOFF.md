# Handoff: turn Yapstats into an iOS and Android app

Written 26 Nov 2026 at the end of the web polish session. Read this first, then `README.md`.

## Current state on 27 Nov 2026 (read this first)

The sections further down describe the starting point. This section is the present.

Where things live:
- Branch `ios-app` has the app (`app/`, a Capacitor 8 iOS shell around the same `public/index.html`) and the newest docs. `main` is the live website and deploys on every push.
- The Xcode project Mohamed builds from is a copy on his Mac at `~/Downloads/Yapstats-iOS`. After changing `public/` or `app/ios`, copy the files there and check them before he archives.
- `docs/APP_STORE_LISTING.md` has the full App Store Connect status, IDs and listing text. `docs/IOS_APP_DESIGN.md` and `docs/TIKTOK_IMPORT.md` cover the app design and the app-only TikTok import.

App Store:
- Version 1.0 (build 1) and the Full recap purchase were submitted together on 26 Nov 2026 at 15:03. Both were "Waiting for Review". Release is manual.
- TestFlight: internal group "Me" works and Mohamed confirmed the sandbox purchase unlocks the full recap. External group "Friends" holds build 1 in beta review. The public link in the listing doc accepts testers only after that review passes.
- While either review is waiting, do not upload a build or edit the submission.
- If Apple rejects: read the cited guideline, fix that, then resubmit. Never resubmit unchanged.
- After release: change `TIKTOK_ON_WEB` in `public/index.html` to point at the App Store page (run `node tools/qa/hash.mjs` after), and check the purchase sheet shows the app icon.

Not yet confirmed by Mohamed on his phone:
- A hard swipe moves one card only, the last paid card fits without scrolling, and the lit card edge looks right. All three are in build 1.
- Restore purchases after deleting and reinstalling from TestFlight.
- Save to Photos, light mode, small iPhones, VoiceOver.

Ads (started 27 Nov 2026, nothing made and nothing bought):
- Budget is about 25 pounds and is not available yet.
- He wants talking-actor "UGC" style ads like the MakeUGC samples. Findings: its 1 dollar trial renews at full price (59, 79 or 149 dollars a month, or a yearly bill), trial credits are not published, and reviewers report charges after cancelling. If he takes the trial, he pays himself with a virtual card backed by about 2 pounds, picks monthly billing, and cancels the same night.
- Free routes found: photo slideshows made from the recap cards, screen recordings of the real app, Google Flow's free daily Veo clips, and real reactions from TestFlight friends. Pay-as-you-go actor tools start at about 5 dollars.
- Ad rules: scripts never claim a real customer experience (presenter lines, acted skits and challenge hooks are fine), AI actors are labelled as AI on the platform, no other company's brand, and no real chats.
- Offered but not built: three 15-second scripts, three slideshow sets and three demo videos from the sample chat.

Working with Mohamed, learned the hard way:
- He does not follow multi-step interface instructions. Do the clicking for him and give him one action at a time.
- Ask for a plain yes before a push to `main`, before pressing any submit button, and before anything that costs money. He types passwords, payment details and ID numbers himself.

## Goal

Ship Yapstats as a real app on the App Store and Google Play, at the same quality bar as the site. TikTok chat import was added on 26 Nov 2026 (see docs/TIKTOK_IMPORT.md; not yet checked against a real export). Snapchat import is rejected (its export only holds saved messages, so recaps would be near-empty).

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

## Decisions made on 26 Nov 2026

- **iOS only for now.** Android waits (it also needs a real Android phone and a 12-tester, 14-day closed test).
- **Build approach: Capacitor shell**, in `app/` on the `ios-app` branch. See `app/README.md` for status and `THIRD_PARTY_NOTICES.md` for what was added.
- No accounts created and nothing spent. The Apple Developer Program (about £79 a year) is needed only for TestFlight and submission.

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

1. Add the repo `Mohamed-Elhossamy/yapstats`, check out `ios-app`, and read "Current state" at the top of this file, then `docs/APP_STORE_LISTING.md`.
2. Ask Mohamed what has changed since 27 Nov 2026: any email from Apple, and whether he took an ads trial.
3. Carry on from whichever is live: the review result, or the ads work.
