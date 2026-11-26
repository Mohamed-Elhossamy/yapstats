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

- **Home:** one screen. Short pitch, sample cards, one large button low on the screen, the price in one line. The export guide opens as its own screen.
- **Story:** no header and no arrow buttons (they stay for VoiceOver). Progress bar, a "Swipe" cue on the first card, tap zones, a haptic tick per card.
- **Unlock slide:** the last slide, card-sized, dark with a lit border. Its button sends `{ type: 'buy' }` to the native side, which does nothing yet.
- **Off in the app:** web checkout, unlock link, tip link, email delivery, Save buttons (the share sheet has Save Image), Android steps.

Do not name the flag class `in-app`: that class already styles the in-app-browser notice and shrinks the whole page.

## Status, 26 Nov 2026

Tested on an iPhone 16 Pro (iOS 27.2.1, Xcode 27.2, free Personal Team signing), driven through iPhone Mirroring with a synthetic export:

- Builds and launches. Home fills the screen in dark mode without scrolling.
- **Share-sheet import works.** Files > long-press a `.zip` > Share > Yapstats opens a 12-card recap.
- **The file picker works** ("Choose a chat export").
- **Story:** taps move one card at a time through all 12 cards, the highlights and the unlock slide.
- **Share this card works.** `navigator.share` opens the system share sheet with the PNG, including Save Image.

Not tested yet: a real finger swipe and the haptics (mirroring cannot show them), WhatsApp's own "Export chat" sheet, Save Image and the Photos prompt, the sub-pages, the Instagram picker, the guess game, the gallery, light mode on the device, a cold start from the share sheet, VoiceOver, smaller iPhones.

Known gaps: the unlock button does nothing until the StoreKit step; the app icon is Capacitor's default; `--story-chrome` is tuned for Face ID iPhones.

- The working Xcode project is at `~/Downloads/Yapstats-iOS` on his Mac (connected folder). Its `project.pbxproj` also holds his signing team; this repo's copy does not. After writing a file there, compare checksums: a staged file can lag by a few seconds.
- Changes go on the `ios-app` branch. A push to `main` deploys the website.
