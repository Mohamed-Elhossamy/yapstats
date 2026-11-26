# Yapstats iOS app

A Capacitor shell around the website. `../public` is bundled unchanged, so the parser and card drawing are the same code as yapstats.tech. Nothing is loaded from the network.

## What the shell adds

- **Share-sheet import (prototype).** `Info.plist` registers the app for `.zip`, `.txt` and `.json`. When a chat export is opened in Yapstats, `SceneDelegate.swift` moves it to a private temporary folder, puts it into the page's own file input, then deletes it. The chat never leaves the device.

Still to build: in-app purchase for the unlock, Save to Photos, hiding the web checkout and tip links. Email delivery is not part of the app.

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

Checks: `node test/handoff.check.mjs` (5) and `node test/deck.check.mjs` (10) from `app/`.

Mohamed confirmed on 26 Nov that finger swipes work on the fixed build.

Not tested yet: the haptics, WhatsApp's own "Export chat" sheet, Save Image and the Photos prompt, the sub-pages, the Instagram picker, the guess game, the gallery, light mode on the device, a cold start from the share sheet, VoiceOver, smaller iPhones.

Known gaps: the unlock buttons do nothing until the StoreKit step; the app icon is Capacitor's default; `--story-chrome` is tuned for Face ID iPhones.

- The working Xcode project is at `~/Downloads/Yapstats-iOS` on his Mac (connected folder). Its `project.pbxproj` also holds his signing team; this repo's copy does not. After writing a file there, compare checksums: a staged file can lag by a few seconds.
- Changes go on the `ios-app` branch. A push to `main` deploys the website.
