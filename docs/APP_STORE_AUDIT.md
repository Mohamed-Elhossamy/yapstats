# App Store compliance audit

Run on 26 Nov 2026 against Apple's App Review Guidelines, App Store Connect screenshot specifications and Apple's submission requirements, all read from developer.apple.com that day. Method: the `app-store-compliance` checklist by hand (its scanner script is not in the installed copy), plus a read of the Swift code, Info.plist, the bundled pages and the listing draft.

## Verdict

**Blocked: not ready to submit.** The code issues found are fixed. What remains needs an Apple Developer Program membership, one website deploy and a few checks on a real iPhone. Numbered list at the end.

## Findings

| # | Guideline | Severity | Finding | Status |
|---|---|---|---|---|
| 1 | 2.1 App completeness | Critical | App Review could not use the app without a chat export of their own, so they could not see the cards or reach the purchase. | **Fixed:** "Try a sample chat" on the home screen loads a made-up chat. Review notes point to it. |
| 2 | 3.1.1 In-app purchase | Critical | The bundled page still held the website's checkout link, tip link and unlock-code path. Apps may not unlock features with their own keys or point to other ways to pay. | **Fixed:** in the app those links are removed from the page, the unlock code is never read, and website payment text is hidden on Privacy and Terms. A check fails if any such link exists. |
| 3 | 3.1.1 Restore | Critical | Restorable purchases need a restore mechanism. | **Met:** "Restore purchase" on the home screen and on the unlock card. Tested on device with Xcode's test store. |
| 4 | 2.3.10 Other platforms | High | The WhatsApp export guide page shipped inside the app mentions Android. | **Fixed:** the web export guides and email page are no longer bundled or linked. The in-app guide hides the Android steps. |
| 5 | 5.1.1 Privacy policy | High | A privacy policy must be linked in the app and in App Store Connect, and must cover the app. | **Half met:** linked in the app; the page now has an "iPhone app" section. **The updated page is not on yapstats.tech yet** (see item 3 below). |
| 6 | 5.1.1 Purpose strings | Medium | The Photos permission text named a "Save Image" button that does not exist. | **Fixed:** it now says the app only adds the cards you choose and never reads the library. Access requested is add-only. |
| 7 | Privacy manifest | Medium | No `PrivacyInfo.xcprivacy` in the app target. | **Fixed:** added. No tracking, no collected data, no required-reason APIs in the app's own code (Capacitor ships its own manifest). |
| 8 | 4.2 Minimum functionality | Medium | A web page in a native shell can be rejected as a repackaged website. | **Mitigated, not removable:** the app opens chat files from other apps' share sheets, sells through StoreKit, saves to Photos, uses haptics, works offline and has its own layout. Review notes list these. Residual risk stays with the reviewer's judgement. |
| 9 | 2.3.3 / 2.3.7 Metadata | Medium | Screenshots must show the app in use; names and keywords must be accurate and free of other brands. | **Met in the draft:** five in-use screenshots, no brands, no prices. |
| 10 | 5.2.1 Third-party marks | Medium | The app names WhatsApp, Instagram and TikTok. | **Accepted risk:** names appear only in export instructions and the not-affiliated line, never in the app name, icon, listing or screenshots. |
| 11 | 5.2.5 Apple emoji | Low | Apps may not include Apple emoji as artwork. Cards draw emoji as text with the system font, which is normal text rendering; nothing is bundled as an image. | **Accepted risk:** keep emoji cards out of store screenshots and the icon. One screenshot shows a single small emoji tile (browser-rendered, not Apple's artwork). |
| 12 | 2.5.2 Self-contained | Low | Apps may not download or run new code. | **Met:** the page is bundled; the app loads nothing from the network. |
| 13 | SDK and target | Low | Uploads must be built with a current Xcode and SDK, and target a supported iOS. | **Met today:** Xcode 27.2, iOS 16.4 target. Re-check Apple's "Upcoming Requirements" page before uploading. |
| 14 | Device capability | Low | Info.plist required `armv7`, a leftover from the template. | **Fixed:** now `arm64`. |
| 15 | 5.6 Manipulation | Low | Paywalls must not trick people. | **Met:** one price, "one-off, no subscription" stated at each buy button, no countdowns or fake scarcity. |
| 16 | Export compliance | Low | Encryption declaration. | **Met:** `ITSAppUsesNonExemptEncryption` is false. |

## Not checked

- Anything in App Store Connect (no account yet): agreements, tax and banking forms, the age-rating questionnaire as it appears today, price tiers.
- The archive (Release) build and TestFlight. Only Debug builds from Xcode have run.
- VoiceOver on a device. Labels were read in code only.
- iPad. The app is iPhone-only but Apple may run it on an iPad in iPhone mode; the small-iPhone layout work should cover that, untested.
- Legal review of the privacy and terms wording. They state what the code does; a lawyer has not read them.

## What still blocks submission

1. **Apple Developer Program** (about £79 a year). Needs your yes and your own sign-up. It unlocks App Store Connect, TestFlight and the real purchase.
2. **Create the purchase in App Store Connect** with the exact product ID `tech.yapstats.app.fullrecap`, and submit it with version 1.0. Fill in tax and banking, or paid purchases will not load.
3. **Put the updated Privacy and Terms pages on yapstats.tech.** Apple checks that URL. This is a push to `main`; say the word. It can go without TikTok import, which stays app-only either way.
4. **On the iPhone, confirm:** Save to Photos (the permission prompt and a saved card), the startup sound, "Try a sample chat", and the About, Privacy and Terms pages.
5. **Archive, upload and run through TestFlight once**, including a sandbox purchase and a restore.
6. **Enter the listing** from `docs/APP_STORE_LISTING.md` and upload the screenshots in `docs/store-screenshots/`.

## Sources

- App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Screenshot specifications: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
- Submission requirements: https://developer.apple.com/ios/submit/ and https://developer.apple.com/news/upcoming-requirements/
