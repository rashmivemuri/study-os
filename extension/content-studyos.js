// StudyOS Coursera Tracker — content script for StudyOS pages (your github.io
// link and localhost). Writes imported modules into the app's own localStorage
// and reloads. Runs only when you press "Send to StudyOS" in the popup.
"use strict";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "STUDYOS_IMPORT") return;
  try {
    const LSKEY = "studyOS.v1";
    let S;
    try { S = JSON.parse(localStorage.getItem(LSKEY)) || null; } catch (_) { S = null; }
    if (!S) { sendResponse({ ok: false, error: "Open StudyOS once first so its storage exists." }); return true; }
    S.modules = S.modules || [];
    S.seq = S.seq || 1;
    if (!S.modules.some((m) => m.course === msg.course && String(m.week) === String(msg.week))) {
      S.modules.push({
        id: S.seq++, course: msg.course, week: msg.week,
        title: (msg.title || "") + " (via extension)",
        textbook: 30,
        videos: msg.videos.map((v) => ({ label: String(v.label).slice(0, 80), minutes: v.minutes, done: false })),
      });
      localStorage.setItem(LSKEY, JSON.stringify(S));
      sendResponse({ ok: true, added: msg.videos.length });
    } else {
      sendResponse({ ok: true, added: 0, skipped: "that course+week already exists" });
    }
  } catch (e) {
    sendResponse({ ok: false, error: String(e) });
  }
  return true;
});
