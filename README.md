# StudyOS — personal command center

## How to run
Option A (easiest): open File Explorer → `C:\Users\Administrator\.gemini\study-os` → double-click `index.html`.
Option B: in that folder run `python -m http.server 8000`, then open `http://localhost:8000`.

## How to check it's working
1. **Settings → Run self-test** — expect 22 ✓ lines.
2. **IIT Modules → Preview parse** with the example text — expect "3 videos · total ~78 min".
3. **Today**: tick a box → progress bar moves → reload the page → tick persists.
4. **Relocation proof**: leave a task unticked → next day open the app → orange banner "Auto-relocated N unfinished task(s)" + entry in the Relocation log + `↩` item in a future day (Week tab).
5. Open browser console (F12) on the app page — expect zero red errors from StudyOS.

Local-first planner. Double-click `index.html` (or serve with `python -m http.server`).

## What it does
- **Today tab**: daily checklist with progress, overload warning, backlog queue, streak + week stats, smart tip, quick-add.
- **Week tab**: Mon–Sun auto-schedule. Recurring load placed first, IIT video chunks poured into freest days (≤50-min splits), backlog fitted into leftover slots (max 2/day, most-overdue first). Red = overloaded.
- **IIT Modules tab**: full trimester dataset with release gating + sequential frontier (finish a module to unlock the next) + per-video scheduled-day badges + **search box to find any video instantly**. Parser accepts `mm:ss`, `h:mm:ss`, `12 min`, `1h 20m`. Test prep sessions name real videos (one tickable session each + a single revise remainder, two-way synced, never double-booked).
- **Goals tab**: hardcoded short / mid / long-term goals from your list.
- **Settings**: daily self-study capacity (default 300 wkday / 420 wkend mins). Scheduler rebuilds automatically.

## Smart rules
- Missed work → <b>only SaiU + IITG carries over</b> (Sai rotation, SaiU tests/prep, customs, IIT videos/textbook). Book pages persist so reading sessions regenerate (no backlog copy). Everyday must-tasks (NeetCode, CF, GATE, OWASP, revision) lapse — streak takes the hit, no flood. Carried items are auto-moved on every start/tick and take the earliest fitting free slots (most-overdue first, max 2/day). When a week ends, leftovers stay visible (scheduled or ⏳ queued) and Today always snaps back to the current week. Anything without room stays visibly **⏳ queued** and is retried weekly — days never exceed their 4–6h cap for flexible work; red only means fixed commitments overflowed and need trims or catch-up mode.
- IIT videos auto-carry (undone videos reschedule every rebuild).
- Lagging (150m+ backlog or 3d overdue) → one-click **catch-up plan** lightens CF/OWASP until backlog < 60m, then auto-exits.
- **College hours** (seeded from the SaiU sheet: Sec 3 + ETA Sec 2) are blocked and never scheduled over; edit them in Settings.
- **SaiU tests**: give the date + your prep plan (N PYQs or H hours) — time auto-spreads over prior days in ≤60m sessions.
- **Book plans** (CLRS): chapters + deadline → pages/week pace + ≤15m daily sessions inside an adaptive budget (scales with IIT completion + college load, pauses while lagging); log pages read to shrink them. Finishing the whole book in-sem is optional — the card shows the honest projected finish date.
- **Crunch mode** (universal): within N days of any test, chosen subjects pause to fund prep; paused work returns as payback backlog after the test (per-test ⚡ toggle to exempt).
- **IITG tests**: Proctored (120m exam) / Non-Proctored (30m) labels everywhere. Each test declares which modules it covers (auto: PT → its week + previous, NPT → previous week — your Module-2-NPT case). Prep sessions name those videos one-per-session with two-way ticking, plus a single revise block, never double-booked. Morning exams skip same-day cram. Exam days auto-lighten (Sai/CF paused).
- **Proctored two-slot rule**: miss slot 1 and the test shifts to the course's same-weekend backup slot (official Slot B: RDBMS Sat 19:30, Java Sat 20:30, Optimization Sun 19:30 — editable per course); prep, crunch, and backlog rebuild around it. Each course's videos spread Mon→exam-eve only, so material finishes before its exam.
- **Evening trim**: as the 9:30 PM–1 AM window burns down, one tap keeps only the top-priority ~hours-left worth; the rest defers by policy (no silent drops).
- **IIT-first governor**: video demand vs free room is measured weekly — lagging auto-pauses CF → Sai → weekend extras → NeetCode (extremes only) to fit more IIT; everything restores on catch-up, logged.
- **Priority law (tests non-negotiable)**: tests/exams (IITG + SaiU) > IIT videos > routine. Tests are date-fixed and room-ignoring — they always land whole; videos defer, routine lapses or queues. Governor/crunch/holds may pause routine subjects but never a test.
- **Calendar tab**: month grid (🎓 college · 📝 tests · 🎯 events). Click any future date → see everything on it → mark an event with syllabus + estimated prep hours. The fit engine spreads prep over prior days; if it can't fit, it asks which subjects to hold (paused work returns after the event).
- **Coursera extension** (`extension/`): private Chrome/Edge add-on that reads only titles+durations from open module pages and sends them to your StudyOS tab (or copies paste-text). See its README to install.
- Completing a carryover item removes it from backlog.

## Troubleshooting
- IIT modules missing? Hard-refresh (`Ctrl+Shift+R`), then IIT tab → **Reload Week-1 seed data**. The footer always shows live counts — if it says "0 modules", reseed.
- Red console banner in the app? Copy its exact text to me.

## Data
Stays in browser `localStorage` key `studyOS.v1`. No login, no server.

## Deploy (live link, no local server needed)
Using the app needs no server at all — just double-click `index.html`. Deployment is only so you can open it from your phone/anywhere via a link.
One-time setup (~5 min):
1. On github.com create a repo named `study-os` (**Private** needs a Pro plan for a live link; **Public** works on Free), **without** ticking "Add a README".
2. In the `study-os` folder, run once: `git remote add origin https://github.com/YOUR-USERNAME/study-os.git` — then double-click **`push.bat`** (a browser login popup handles auth; approve once, it stays signed in).
3. Repo page → **Settings → Pages** → Deploy from branch → `main`, `/(root)` → Save. Live in ~1 min at `https://YOUR-USERNAME.github.io/study-os/`.
After that, every change flows automatically: each fix is committed here, and either it gets pushed directly (works once step 2's login persists) or you double-click **`push.bat`** — no typing, and the link refreshes in ~1 min.
