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

## Status, 26 Nov 2026

Tested on an iPhone 16 Pro (iOS 27.2.1, Xcode 27.2, free Personal Team signing), driven through iPhone Mirroring with a synthetic export:

- The Swift code compiles and the app launches. The landing page renders in dark mode, clear of the status bar.
- **Share-sheet import works.** Files > long-press a `.zip` > Share > Yapstats opens a 12-card recap with year chips.
- **Share this card works.** `navigator.share` opens the system share sheet with the PNG, including Save Image.

Not tested yet: WhatsApp's own "Export chat" sheet (Mohamed tests real chats himself), Save Image and the Photos prompt, "Save this card", the sub-pages, the Instagram picker, the guess game, the gallery, light mode, a cold start from the share sheet, VoiceOver.

Known gaps: the status-bar strip is black while the page is dark grey; the app icon and launch screen are Capacitor defaults; the web checkout, unlock code and tip link are still present.

- The working Xcode project is at `~/Downloads/Yapstats-iOS` on his Mac (connected folder). Its `project.pbxproj` also holds his signing team; this repo's copy does not.
- Changes go on the `ios-app` branch. A push to `main` deploys the website.
