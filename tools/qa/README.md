# Browser checks

These scripts drive the real page in headless Chrome. They were written in a Claude cloud workspace and assume:

- Playwright at `/opt/npm-tools/node_modules/` and Chrome at `/usr/bin/google-chrome` (change the two lines at the top of each script elsewhere)
- the site served at `http://127.0.0.1:8788/`

Run from this folder:

```sh
(cd ../../public && python3 -m http.server 8788 --bind 127.0.0.1 &)
node mkchat.mjs && node demo.mjs && printf 'not a chat\n' > junk.txt   # synthetic test files, all made up
node hash.mjs        # REQUIRED after every edit to the inline script: updates the CSP hash in public/index.html
node interact.mjs    # 22 checks: taps, drags, keyboard, year chips, gallery, reduced motion, resize
node wheel2.mjs      # 8 checks: trackpad swipes
node checks2.mjs     # 12 checks: offer cue, phone layout, error state, end actions, unlocked state
node mktiktok.mjs && node tiktok.mjs   # 3 checks: the website refuses TikTok files (the import is app-only, checked in app/test)
node polish.mjs      # 6 checks: sample chat, loading cards, unlock lands on the first new card, no TikTok wording on the website
```

`*.txt` files and the TikTok test files here are generated and ignored by git.
