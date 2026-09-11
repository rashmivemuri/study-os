# StudyOS Coursera Tracker (private extension)

One-click upgrade over the console snippet: while a Coursera module page is open,
press **Read**, check the preview, press **Send** — the module lands in StudyOS
scheduled across your week. No video is ever touched, downloaded, or shared.

## What it can and cannot access
- READS: video/reading titles + durations (plain text already rendered on the page), page title for the course guess.
- NEVER: video streams, downloads, your password, grades, or anything off the module list. No network calls except the browser's own messaging between your two tabs. Nothing leaves your machine.

## Install (Chrome/Edge, 2 min)
1. Open `chrome://extensions`, enable **Developer mode** (top right).
2. **Load unpacked** → select this `extension` folder.
3. Pin the 📚 icon to your toolbar.

## Use
1. Open your IIT module page on Coursera.
2. Click 📚 → **Read this module page** → confirm the count.
3. Set course + week → **Send to StudyOS tab** (needs your StudyOS live link or localhost open in another tab).
4. No StudyOS tab handy? **Copy as paste-text** → paste into StudyOS → IIT Modules → Add week's module.

## Files
- `manifest.json` — permissions (coursera.org read, StudyOS tabs, clipboard).
- `content-coursera.js` — title+duration scraper.
- `content-studyos.js` — writes into the app's own localStorage on your StudyOS pages only.
- `background.js` — relay between the two tabs.
- `popup.html/js` — the popup UI with preview + fallbacks.
