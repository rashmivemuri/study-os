// Popup logic: read active Coursera tab, preview, send to StudyOS tab or copy.
"use strict";
let stash = null;
const $ = (id) => document.getElementById(id);

$("read").onclick = async () => {
  $("out").textContent = "Reading page…";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/coursera\.org/.test(tab.url || "")) {
    $("out").innerHTML = `<span class="warn">Open a Coursera module page first, then press Read.</span>`;
    return;
  }
  let res;
  try { res = await chrome.tabs.sendMessage(tab.id, { type: "STUDYOS_SCRAPE" }); }
  catch (e) { $("out").textContent = "Could not read the page (try reloading it): " + e.message; return; }
  if (!res || !res.ok) { $("out").textContent = "Read failed: " + ((res && res.error) || "unknown"); return; }
  stash = res.data;
  if (!stash.videos.length) { $("out").textContent = "No video durations found on this page. Scroll the module list into view and try again."; return; }
  if (!$("course").value && stash.course) $("course").value = stash.course.slice(0, 40);
  const tot = stash.videos.reduce((a, v) => a + v.minutes, 0);
  $("out").textContent = `Found ${stash.videos.length} items · ~${tot} min\n` +
    stash.videos.slice(0, 12).map((v) => `• ${v.label} — ${v.minutes}m`).join("\n") +
    (stash.videos.length > 12 ? `\n…+${stash.videos.length - 12} more` : "");
  $("send").disabled = false;
  $("copy").disabled = false;
};

$("send").onclick = async () => {
  if (!stash) return;
  const payload = {
    type: "STUDYOS_DELIVER",
    course: $("course").value.trim() || "RDBMS",
    week: $("week").value || "1",
    title: $("title").value.trim(),
    videos: stash.videos,
  };
  const res = await chrome.runtime.sendMessage(payload);
  if (res && res.ok) {
    $("out").innerHTML = res.added
      ? `<span class="ok">✓ Sent ${res.added} videos — reload your StudyOS tab to see them scheduled.</span>`
      : `<span class="warn">Already imported (${res.skipped}). Open StudyOS to view.</span>`;
  } else if (res && res.error === "no-studyos-tab") {
    $("out").innerHTML = `<span class="warn">No StudyOS tab open — open your live link (or localhost), then press Send again. Or use Copy.</span>`;
  } else {
    $("out").textContent = "Send failed: " + ((res && res.error) || "unknown") + " — use Copy instead.";
  }
};

$("copy").onclick = async () => {
  if (!stash) return;
  const text = stash.videos.map((v) => `${v.label} — ${v.minutes} min`).join("\n");
  await navigator.clipboard.writeText(text);
  $("out").innerHTML = `<span class="ok">✓ Copied ${stash.videos.length} lines — paste into StudyOS → IIT Modules → Add week's module.</span>`;
};
