# TikTok import

Added 26 Nov 2026. Reads the JSON data file from TikTok's "Download your data" and lists its group chats and one-to-one chats to pick from. The file is read on the device like every other export.

## App only

Mohamed's decision on 26 Nov 2026: TikTok import is an app feature, as a reason to get the app. The website recognises a TikTok file and replies "TikTok chats are not read on the website. The Yapstats iPhone app, coming soon, will read them." (change "coming soon" to a link to the App Store page once the app is live). No other page of the website names TikTok; inside the app the not-affiliated line adds it. The gate is `tiktokIfApp` in the page.

## Status

**Not yet checked against a real TikTok export.** Mohamed tests real exports himself; the checks here use a synthetic file (`tools/qa/mktiktok.mjs`). The layout below comes from TikTok's own documentation and from three open-source readers, read on 26 Nov 2026. None of their code was copied.

## What is known, and from where

| Fact | Source |
|---|---|
| Steps: Profile, Menu, Settings and privacy, Account, Download your data, choose what to include and a file format, Request data. Later: Download data, Download. | TikTok support, "Requesting your data" |
| The file can take a few days and is available for up to 4 days. | TikTok support, same page |
| Formats are TXT or JSON. Each message has `Date`, `From`, `Content`. | TikTok for Developers, Data Portability "Data Types" |
| One-to-one chats: `Direct Message` > `Direct Messages` > `ChatHistory` > `"Chat History with <name>:"`. Older files: `Direct Messages` > `Chat History` > `ChatHistory`. | abrignoni/RLEAPP `tikTokArchiveJson.py`; Lucent/merged-chat-timeline `social.py` |
| Group chats: `Direct Message` > `Group Chat` > `GroupChat` > `"Group Chat with <name>:"`. | nezjusz/nezjusz.github.io `tiktokdataorganiser`; McPolemic/dotfiles `tiktok_import.py` |
| Dates are `YYYY-MM-DD HH:MM:SS` in UTC. | Lucent/merged-chat-timeline (states UTC); msgvault docs (assumes UTC) |

TikTok's own pages do not describe group chats in the download at all. That part rests on the two open-source readers.

## How the page reads it

- Chats are found by key (`Chat History with …:` or `Group Chat with …:`) anywhere in the file, so a renamed section does not break the import.
- Group chats are listed first, then chats by number of messages.
- A message that is only a link is a shared video: it counts as a message (media), not as words.
- Names are TikTok usernames. People can be renamed in Settings, as with other exports.
- The TXT format is refused with a message asking for JSON. Its layout is less certain and one format is enough.

## To confirm with a real export

1. The group chat key and section names.
2. Whether dates are UTC (compare one message's time with the app).
3. What stickers, voice notes and photos look like in `Content`.
4. File size when "All data" is chosen (the whole file is parsed in memory; the limit is 300 MB).
