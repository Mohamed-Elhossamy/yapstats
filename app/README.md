# Yapstats iOS app

A Capacitor shell around the website. `../public` is bundled unchanged, so the parser and card drawing are the same code as yapstats.tech. Nothing is loaded from the network.

## What the shell adds

- **Share-sheet import (prototype).** `Info.plist` registers the app for `.zip`, `.txt` and `.json`. When a chat export is opened in Yapstats, `SceneDelegate.swift` moves it to a private temporary folder, puts it into the page's own file input, then deletes it. The chat never leaves the device.

Still to build: Save to Photos. Email delivery is not part of the app.

## Work on it

```sh
npm install        # once
npm run sync       # copies ../public into the Xcode project; run after every website change
node test/handoff.check.mjs   # 5 browser checks of the import hand-off (needs Playwright and Chrome, see ../tools/qa/README.md)
```

Then open `ios/App/App.xcodeproj` in Xcode, choose your iPhone and press Run. Xcode downloads the Capacitor package the first time.

## App mode

`public/index.html` adds the class `is-app` to `<html>` when it runs inside the shell (`IN_APP`). That one flag gives the app its own layout on the same cards and colours:

- **Startup:** about 1.3s, once per launch: the logo lands, three cards in the brand colours deal out from it, and the home screen's own sample cards take their place. A haptic tick as they deal. Skipped with Reduce Motion and when a shared chat arrives.
- **Home:** one screen. Title, tilted sample cards that float, glow and take turns coming forward, one large glowing button low on the screen, a "Get the full recap" button under it, the one-line pitch and a one-line footer. The export guide opens as its own screen.
- **Story:** no header and no arrow buttons (they stay for VoiceOver). A back button to home, a lit progress bar whose new segment pops, a glow over the whole screen that grows and warms from yellow to pink as you go, a haptic tick per card. Until the first move, the deck tugs the top card aside to show the swipe; there is no text hint.
- **Unlock slide:** the last slide, as tall as a card and full width, dark with a turning gold border and gold light inside the edge (the strip clips anything drawn outside it). Its button and the home button send `{ type: 'buy' }` to the native side, which does nothing yet.
- **Off in the app:** web checkout, unlock link, tip link, email delivery, Save buttons (the share sheet has Save Image), Android steps.

Two traps found the hard way:

- Do not name the flag class `in-app`: that class already styles the in-app-browser notice and shrinks the whole page.
- `.cards` must stay `overflow-x: hidden`. With `auto`, a fast finger flick on a real iPhone starts a native pan: iOS sends `pointercancel` 30 to 80 ms in, the strip scrolls and snaps by itself, and the deck falls out of step (card stuck, cards behind moving, a flash on the next tap). `touch-action: pan-y` did not prevent it. Headless Chrome and slow drags never show this; an instant drag through iPhone Mirroring does (it jumped four cards).

## Status, 26 Nov 2026

Tested on an iPhone 16 Pro (iOS 27.2.1, Xcode 27.2, free Personal Team signing), driven through iPhone Mirroring with a synthetic export:

- Builds and launches. Home fills the screen in dark mode without scrolling.
- **Share-sheet import works** (Files > Share > Yapstats), and so does the file picker.
- **Swipes:** after the `overflow-x: hidden` fix, four instant flicks moved exactly one card each, forward and back. Before it, Mohamed's finger swipes were recorded as `pointercancel` with native scrolling.
- **Taps** move one card at a time through all 12 cards, the highlights and the unlock slide.
- **Share this card works** (system share sheet with the PNG, including Save Image).



Mohamed confirmed on 26 Nov that finger swipes work on the fixed build.

Not tested yet: the haptics, WhatsApp's own "Export chat" sheet, Save Image and the Photos prompt, the sub-pages, the Instagram picker, the guess game, the gallery, light mode on the device, a cold start from the share sheet, VoiceOver, smaller iPhones.

Purchase: one non-consumable, `tech.yapstats.app.fullrecap`. The page sends `buy`, `restore` or `purchase` (ask what is owned); `SceneDelegate.swift` calls StoreKit 2 and answers through `window.yapstatsPurchase({ owned, price, error })`. Ownership lives only in StoreKit: nothing is saved in the page. `App/Products.storekit` is a local test product and the shared `App` scheme points at it, so a build from Xcode buys with test data: no App Store Connect, no real money. An archive for the App Store ignores it and needs the same product id created in App Store Connect.

Tested on the iPhone with Xcode's test store (26 Nov 2026): cancel, buy from the unlock card (12 cards become 22), restore with nothing owned and with the purchase owned, and the unlock surviving a relaunch. Not tested on a device: landing on the first new card straight after buying (the browser check covers it; undoing a test purchase needs Xcode's Debug > StoreKit > Manage Transactions), refunds, Ask to Buy, and anything against the real App Store.

Third trap: on launch WebKit can leave the page resting under the status bar (scroll offset 0 where the top limit is -62) when the page's height changes while it loads. It showed up once the unlock was owned at startup. `YapstatsViewController` watches the scroll view and puts a resting position back inside its limits. Do not remove that guard without retesting a launch with the purchase owned.

Added on 26 Nov 2026: Save to Photos (`save` message, add-only access), the startup chime (`intro` message, `startup.m4a`, made by `tools/make-chime.py`), the icon (`tools/make-icon.mjs`), "Try a sample chat", app-only TikTok import, and layout that uses the real page height (`--app-h`, set from `innerHeight`) with `short` and `tiny` tiers for iPhone mini and SE. A native user script adds the `is-app` class to every page at document start, so About, Privacy and Terms can hide their website-only parts (`.web-only`).

`npm run sync` copies `../public` and then removes the website-only files (export guides, email page, og.png, sitemap, robots, _headers) from the bundle.

Store paperwork: `docs/APP_STORE_LISTING.md`, `docs/APP_STORE_AUDIT.md`, `docs/store-screenshots/` (made by `tools/make-screenshots.mjs`).

Checks from `app/`: `node test/handoff.check.mjs` (5), `node test/deck.check.mjs` (25), `node test/tiktok.check.mjs` (6).

Not yet confirmed on a device: the Photos prompt and a saved card, the chime, the sample chat, the sub-pages in the app.

- The working Xcode project is at `~/Downloads/Yapstats-iOS` on his Mac (connected folder). Its `project.pbxproj` also holds his signing team; this repo's copy does not. After writing a file there, compare checksums: a staged file can lag by a few seconds.
- Changes go on the `ios-app` branch. A push to `main` deploys the website.
