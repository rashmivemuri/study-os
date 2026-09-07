# StudyOS — personal command center

## How to run
Option A (easiest): open File Explorer → `C:\Users\Administrator\.gemini\study-os` → double-click `index.html`.
Option B: in that folder run `python -m http.server 8000`, then open `http://localhost:8000`.

## How to check it's working
1. **Settings → Run self-test** — expect 5 ✓ lines (parser, schedule, backlog placement, tests, relocate idempotent).
2. **IIT Modules → Preview parse** with the example text — expect "3 videos · total ~78 min".
3. **Today**: tick a box → progress bar moves → reload the page → tick persists.
4. **Relocation proof**: leave a task unticked → next day open the app → orange banner "Auto-relocated N unfinished task(s)" + entry in the Relocation log + `↩` item in a future day (Week tab).
5. Open browser console (F12) on the app page — expect zero red errors from StudyOS.

Local-first planner. Double-click `index.html` (or serve with `python -m http.server`).

## What it does
- **Today tab**: daily checklist with progress, overload warning, backlog queue, streak + week stats, smart tip, quick-add.
- **Week tab**: Mon–Sun auto-schedule. Recurring load placed first, IIT video chunks poured into freest days (≤50-min splits), backlog fitted into leftover slots (max 2/day, most-overdue first). Red = overloaded.
- **IIT Modules tab**: paste each week's video list per course (Java / Statistics / RDBMS). Parser accepts `mm:ss`, `h:mm:ss`, `12 min`, `1h 20m`, one per line. Includes a Coursera console snippet to semi-auto copy durations.
- **Goals tab**: hardcoded short / mid / long-term goals from your list.
- **Settings**: daily self-study capacity (default 300 wkday / 420 wkend mins). Scheduler rebuilds automatically.

## Smart rules
- Missed non-IIT tasks → "End day" moves them to backlog with overdue+1; they auto-fill next free slots instead of piling up.
- IIT videos auto-carry (undone videos reschedule every rebuild).
- Completing a carryover item removes it from backlog.

## Data
Stays in browser `localStorage` key `studyOS.v1`. No login, no server.
