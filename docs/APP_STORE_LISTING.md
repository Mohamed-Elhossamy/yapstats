# App Store listing

Written 26 Nov 2026. Mohamed joined the Apple Developer Program that day (individual, team `3RQ7N785AC`) and the listing below was entered in App Store Connect.

## Status in App Store Connect (26 Nov 2026)

Submitted for review on 26 Nov 2026 at 15:03: iOS version 1.0 (build 1) and the Full recap purchase, in one submission. Both show "Waiting for Review". Release is manual, so the app goes live only when Mohamed releases it.

- App record: Yapstats, Apple ID `6839611903`, SKU `yapstats-ios`, bundle ID `tech.yapstats.app`, primary language English (U.K.).
- App Information: subtitle, categories, content rights (no third-party content), age rating (calculated 4+).
- Version 1.0: promotional text, description, keywords, support and marketing URLs, copyright, review notes and contact, sign-in not required, manual release, build 1.0 (1) attached.
- Screenshots: the five 1320 x 2868 pictures are in the Asset Library and on the large iPhone slot, in order 1 to 5. The required medium slot uses the same pictures, scaled by Apple.
- Pricing: free (base United Kingdom). Availability: 174 countries and regions. China mainland is left out because it needs a security assessment and an AI-content filing.
- App Privacy: policy URL and "Data Not Collected" published.
- In-app purchase: Full recap, Apple ID `6839620033`, non-consumable, GBP 2.99 (base United Kingdom), display name, description, review note and review screenshot. Submitted together with version 1.0.
- Business: Paid Apps Agreement, bank account, both US tax forms, Digital Services Act trader status and MRDP are all Active.
- TestFlight: build 1.0 (1) uploaded; internal group "Me" with Mohamed as tester. The sandbox purchase sheet shows the real price.
- TestFlight public testing: test information saved; external group "Friends" holds build 1.0 (1), sent to beta review on 26 Nov 2026 ("Waiting for Review"). Public link, open to anyone: https://testflight.apple.com/join/XPMn1mXe. It accepts testers only after the build is approved. Purchases are free for testers.

Still open:
- Wait for Apple's review email (up to 48 hours). If approved, Mohamed presses Release. If rejected, read the cited guideline and fix before resubmitting.
- After release: point the website's TikTok note at the App Store page.

The listing follows the project rule that no other company's brand appears in the name, text or pictures.

## App information

| Field | Value | Limit |
|---|---|---|
| Name | Yapstats | 30 |
| Subtitle | Group chat recap cards | 30 |
| Bundle ID | tech.yapstats.app | |
| Primary category | Entertainment | |
| Secondary category | Social Networking | |
| Price | Free, with one in-app purchase | |
| Devices | iPhone (iOS 16.4 or later) | |
| Privacy Policy URL | https://yapstats.tech/privacy/ | |
| Support URL | https://yapstats.tech/about/ | |
| Marketing URL | https://yapstats.tech/ | |
| Copyright | 2026 Mohamed Elhossamy | |

## Promotional text (170)

Find out who really runs your group chat. Turn a chat export into cards you can share. Read on your iPhone and never uploaded.

## Description (4,000)

Who sends the most messages? Who is up at 3am? Which word has your group worn out?

Yapstats turns a group chat export into a set of recap cards: clean, colourful and made to send straight back to the group.

HOW IT WORKS
1. Export a chat from your messaging app (the app shows you how).
2. Open the file in Yapstats.
3. Swipe through your cards, then share or save the ones you like.

No export to hand? Tap "Try a sample chat" to see a made-up recap first.

YOUR CARDS
• Messages sent, days you chatted and your busiest day
• Top talkers
• Your busiest hour and the group's night owl
• Favourite emojis and most-used words
• Longest streak and biggest burst of messages
• Group awards for everyone

PRIVATE BY DESIGN
• Your chat is read on your iPhone. It is never uploaded.
• No account, no sign-up, no ads, no tracking.
• Yapstats collects no data.

THE FULL RECAP
The recap is free. The Full recap is an optional one-off purchase that adds a personal card for each person and extra rankings. It is not a subscription, and Restore purchase brings it back on a new iPhone.

Yapstats is an independent app. It is not affiliated with, endorsed by or connected to any messaging service.

## Keywords (100)

group chat,recap,stats,chat stats,cards,messages,friends,year in review,emoji,share,analyser,export

(99 characters. No brand names, no competitor names, no repeats of the app name.)

## What's New (version 1.0)

First release.

## In-app purchase

| Field | Value |
|---|---|
| Type | Non-consumable |
| Reference name | Full recap |
| Product ID | tech.yapstats.app.fullrecap (must match the code exactly) |
| Price | £2.99 (choose the matching tier; other countries follow Apple's equivalents) |
| Display name | Full recap |
| Description | A personal card for everyone, plus bonus rankings. |
| Family Sharing | Off |
| Review screenshot | The "Unlock … more cards" card, taken on the iPhone |
| Review note | Open the app, tap "Try a sample chat", swipe to the last card and tap "Unlock full recap". |

The purchase must be submitted for review together with version 1.0.

## App Privacy answers

- Data collection: **No, we do not collect data from this app.** (Label: Data Not Collected.)
- Tracking: No.

Why this is true: the app has no account, no analytics, no ads and no third-party code beyond Capacitor (which collects nothing). The chat file is read on the device. The app makes no network requests of its own; purchases go through Apple.

## Age rating

Answer "None" or "No" to every content question. Points that need care:

- User-generated content: **No.** The app shows the user's own chat to that user. It has no feed, posting or messaging.
- Messaging and chat: No.
- Unrestricted web access: No.
- In-app purchases: Yes (declared automatically).

Expected result: 4+. Check the result App Store Connect shows before saving.

## Export compliance

`ITSAppUsesNonExemptEncryption` is `false` in Info.plist: the app uses no encryption of its own.

## Notes for App Review

```
Yapstats makes recap cards from a group chat export. Everything runs on the device: the app has no account, no server and collects no data.

To review without a chat export:
1. Open the app and tap "Try a sample chat" (under the buttons on the home screen). This loads a made-up chat.
2. Swipe through the cards. "Save" adds a card to Photos (add-only access). "Share" opens the share sheet.
3. Swipe to the last card to see the in-app purchase "Full recap" (non-consumable, tech.yapstats.app.fullrecap). "Restore purchase" is on that card and on the home screen.

Native features: the app registers as a handler for chat export files, so a chat can be sent to Yapstats from another app's share sheet or opened from Files. It uses StoreKit 2 for the purchase, adds cards to Photos, and uses haptics.

The cards are drawn on the device from the user's own chat. The app names messaging services only in its export instructions. It is not affiliated with them.
```

## Screenshots

Ready-made set in `docs/store-screenshots/` (5 pictures at 1320 × 2868 and 5 at 1206 × 2622, no alpha). They are browser renders of the app with the made-up sample chat. Replace any of them with real screenshots from the iPhone if you prefer: the iPhone 16 Pro produces 1206 × 2622, which App Store Connect accepts for the medium-display group.

Rules followed: the app in use (no splash or title-only screens), no other company's brand, no prices, no emoji artwork.
