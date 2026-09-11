// StudyOS Coursera Tracker — background service worker.
// Pure relay: popup → Coursera tab (scrape) → StudyOS tab (import).
// No data is stored, logged, or sent anywhere else.
"use strict";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;
  if (msg.type === "STUDYOS_DELIVER") {
    (async () => {
      const tabs = await chrome.tabs.query({ url: ["https://rashmivemuri.github.io/study-os/*", "http://localhost:*/*"] });
      if (!tabs.length) { sendResponse({ ok: false, error: "no-studyos-tab" }); return; }
      try {
        const res = await chrome.tabs.sendMessage(tabs[0].id, {
          type: "STUDYOS_IMPORT", course: msg.course, week: msg.week,
          title: msg.title, videos: msg.videos,
        });
        sendResponse(res);
      } catch (e) { sendResponse({ ok: false, error: String(e) }); }
    })();
    return true;
  }
});
