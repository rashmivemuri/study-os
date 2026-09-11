// StudyOS Coursera Tracker — content script for coursera.org.
// Privacy: reads ONLY rendered video titles + durations (text already on the
// page). No video streams, no downloads, no credentials, no network calls.
// It answers one question when the popup asks: "what videos are listed here?"
"use strict";

function minsOf(text) {
  let m = text.match(/(\d+)\s*h(?:r|our)?s?\s*(\d+)?\s*m/i);
  if (m && /h/i.test(text)) return (+m[1]) * 60 + (m[2] ? +m[2] : 0);
  const times = [...text.matchAll(/(\d+):(\d{2})(?::(\d{2}))?/g)];
  if (times.length) {
    const t = times[times.length - 1];
    if (t[3] !== undefined) return (+t[1]) * 60 + (+t[2]) + (+t[3]) / 60;
    return (+t[1]) + (+t[2]) / 60;
  }
  m = text.match(/(\d+)\s*(?:min(?:ute)?s?|m)\b/i);
  if (m) return +m[1];
  return 0;
}

function scrapeModule() {
  const seen = new Set(), out = [];
  const durPat = /(\d{1,2}:\d{2}(?::\d{2})?|\d+\s*h(\s*\d+\s*m)?|\d+\s*min)/;
  document.querySelectorAll("a, span, div, li, p").forEach((el) => {
    const t = (el.innerText || "").replace(/\s+/g, " ").trim();
    if (!t || t.length > 140 || seen.has(t)) return;
    const m = t.match(durPat);
    if (!m) return;
    if (t.length < m[0].length + 3) return; // duration alone, no title
    if (/quiz|assignment|prompt|discussion|reading|lab\b/i.test(t) && !/video/i.test(t)) {
      // keep readings too — StudyOS tracks them; skip pure discussions
      if (/prompt|discussion/i.test(t)) return;
    }
    seen.add(t);
    const mins = minsOf(t);
    if (mins <= 0 || mins > 600) return;
    const label = t.replace(m[0], "").replace(/[—–\-|,;:.]+$/, "").trim().slice(0, 80);
    out.push({ label: label || "Video", minutes: Math.max(1, Math.round(mins)) });
  });
  let course = "";
  const h1 = document.querySelector("h1");
  if (h1 && h1.innerText.trim().length < 120) course = h1.innerText.trim();
  return { course, url: location.href, videos: out };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "STUDYOS_SCRAPE") {
    try { sendResponse({ ok: true, data: scrapeModule() }); }
    catch (e) { sendResponse({ ok: false, error: String(e) }); }
    return true;
  }
});
