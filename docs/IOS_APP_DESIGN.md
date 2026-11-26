# Yapstats iOS app: design

Written 26 Nov 2026. Scope is iOS only. Status of the code is in `app/README.md`; rules that must hold are in `docs/APP_HANDOFF.md`.

## Requirements

**Must do**

1. Open a chat export straight from another app's share sheet ("Export chat" in WhatsApp, a `.zip`/`.json` in Files).
2. Show the same recap cards as yapstats.tech, from the same code.
3. Sell the Full recap unlock for £2.99 through Apple in-app purchase, with Restore Purchases.
4. Save cards to Photos and share them through the system share sheet.

**Must hold**

- The chat never leaves the device. The app makes no network requests of its own; Apple's purchase system is the only thing that talks to a server.
- No analytics, no accounts, no third-party SDKs. One dependency: Capacitor.
- Works offline. iPhone only, portrait, iOS 16.4 or later.
- No "WhatsApp", "Wrapped" or other brand in the name, icon, subtitle or keywords.

**Left out of v1:** email delivery (Save to Photos replaces it), Android, iPad-specific layout. (TikTok import was added later: docs/TIKTOK_IMPORT.md.)

## Components

```
 WhatsApp / Files share sheet
            | "Open in Yapstats" (.zip .txt .json)
            v
 +------------------- Yapstats.app -------------------+
 | SceneDelegate.swift                                |
 |   ChatImport: private temp copy -> hand-off -> delete
 |   Purchases:  StoreKit 2 (one non-consumable)      |
 |        ^ bridge (Capacitor)                        |
 |        v                                           |
 | WKWebView  capacitor://localhost                   |
 |   public/index.html  (same file as the website)    |
 |   parser, stats, <canvas> cards, PNG export        |
 +----------------------------------------------------+
            | navigator.share({ files })
            v
     system share sheet -> Save Image / Messages / ...
```

## Data flows

- **Import.** iOS copies the shared file into the app's Inbox. `ChatImport` moves it to `tmp/chat-import/`, the page fetches it once through Capacitor's local file URL (same origin, so the page's `connect-src 'self'` policy allows it), builds a `File`, puts it in the page's own `#file` input, and the copy is deleted. Leftovers are deleted on every launch.
- **Unlock.** On launch the page asks the native side whether the purchase is owned. StoreKit 2 verifies the signed transaction on the device. Buying and restoring call StoreKit and report back. The website's unlock code and `localStorage` flag are switched off inside the app.
- **Save and share.** The page already calls `navigator.share({ files })`. The share sheet includes Save Image, which needs `NSPhotoLibraryAddUsageDescription` (added).

## Decisions and trade-offs

| Decision | Chosen | Why | Cost |
|---|---|---|---|
| Shell | Capacitor 8, no plugins | Reuses the parser and cards unchanged; 17k stars, MIT | Guideline 4.2 risk: must feel like an app, not a website |
| Share-sheet import | Document types + about 100 lines of Swift | No library reaches the 1k-star bar; no extension target or App Group needed | Proven from the Files share sheet. If WhatsApp's sheet does not list the app: a Share Extension |
| In-app purchase | StoreKit 2 written directly (about 60 lines) | One product; a purchase library would be a second dependency for a few lines | We own the code; test with a StoreKit configuration file in Xcode |
| Save and share | The page's existing Web Share call | Zero new code | Unproven in the web view. Fallback: a small native share call |
| App-only behaviour | One `inApp` flag inside the shared `index.html` | One page to maintain; website unaffected when the flag is off | Every script edit needs `node tools/qa/hash.mjs` |

## Website parity (checked by reading the code, 26 Nov 2026)

"Same code" is not "same behaviour": a web view differs from Safari. Status of every website function inside the app:

| Website function | In the app | Status |
|---|---|---|
| Pick an export with the file button (WhatsApp `.txt`/`.zip`, Instagram `.zip`/`.json`) | Same code | Check on phone |
| Open a `.zip` export | Needs `DecompressionStream`, so the minimum is iOS 16.4 | Fixed (was iOS 15) |
| Instagram conversation picker, year chips, card deck, guess game, gallery | Same code, no browser-only calls | Check on phone |
| Share one card or all cards | `navigator.share({ files })` | One card: works on iPhone. All cards: check |
| Save a card | Website falls back to a download link, which a web view ignores | Needs the share sheet's Save Image, or a native save |
| Privacy, Terms, About and the two export guides | Capacitor served the home page for all five | Fixed (`FolderRouter`) |
| Content clear of the status bar and home indicator | Page has no safe-area padding | Fixed (`contentInset: always`), check on phone |
| Full recap unlock (Polar link, unlock code) | Not allowed in the app | Built: StoreKit purchase and restore (device test pending) |
| Email delivery of the cards | Left out; the request fails quietly and the offer stays hidden | By design |
| Ko-fi tip link | Remove in the app | To build |
| Export guides text ("save to Files, then upload") | Wrong for the app, where you pick Yapstats in the share sheet | To write |
| Dark mode | Page follows the system setting | Check on phone |
| Drag and drop, in-app-browser notice, link previews | Browser-only | Not needed |

App-only items the website never needed: app icon, launch screen, portrait lock (set), iPhone-only (set), export-compliance answer (set), Photos permission text (set), back navigation from the sub-pages, long-press and pinch behaviour, VoiceOver pass.

## Security notes (audit of 26 Nov 2026)

- Checked: a static scan of the repo for secrets, risky calls and access-control gaps. No secrets in the working tree.
- Real finding, website only: the unlock code is a constant in the public page, so anyone who reads the source can unlock for free. Accepted trade-off of a no-backend site; the app does not inherit it because StoreKit verifies the purchase.
- The import accepts only `.zip`, `.txt` and `.json` file URLs, and passes the path to the page as an argument, never by building script text.
- Not checked: the live site and worker (email download links, rate limits), git history, the Cloudflare, Polar and Resend account settings.

## Before submission (blockers)

1. Remove or gate the Polar checkout, the unlock link and the Ko-fi link in the app (Guideline 3.1.1).
2. Restore Purchases button; price shown from StoreKit, not hard-coded.
3. Privacy: "Data Not Collected" label, privacy policy link inside the app, a privacy manifest check, export-compliance answer.
4. App icon, launch screen, screenshots that show the app in use, with no other company's logo.
5. Run the `app-store-compliance` audit and fix every critical finding.

## Build order

| Step | Estimate | Needs |
|---|---|---|
| 1. Share-sheet import on a real iPhone | Done 26 Nov (Files share sheet, synthetic zip). WhatsApp's own sheet still to confirm | |
| 2. App-only flag, hide web checkout and tip link | 1 to 2 hours | Step 1 |
| 3. StoreKit 2 purchase and restore | 2 to 3 hours | Step 2 |
| 4. Save and share check, native fallback if needed | 1 hour | Step 1 |
| 5. Icon, launch screen, screenshots, compliance audit | 2 to 3 hours | Steps 2 to 4 |
| 6. TestFlight and App Review | Days, not hours | Apple Developer Program (about £79 a year) |

## Revisit later

- Large exports with media: the page reads the whole zip into memory.
- If Apple rejects under 4.2: native import and paywall screens around the same card renderer.
- Android: reuse `public/` and this design; the import becomes an intent filter.
