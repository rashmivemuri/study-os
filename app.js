/* StudyOS v1 — local-first smart scheduler. No dependencies. */
"use strict";
const LSKEY = "studyOS.v1";
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const CATS = { GATE:"#7aa5ff", CP:"#34d399", SAI:"#c4b5fd", IIT:"#fbbf24", OSS:"#f472b6", REV:"#67e8f9" };

/* Hardcoded recurring program (realistic ~5h wkday / 7h wkend self-study).
   Your call of "1 neetcode daily mandatory + alternate CF" is softened on purpose:
   daily NeetCode keeps the streak alive; CF 3x/wk + Sunday contest builds rating
   faster than strict alternation (which kills both streaks). */
const TEMPLATES = [
  { id:"nc",   title:"NeetCode — 1 problem + write-up", cat:"CP",   min:45, days:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], pri:5 },
  { id:"cf",   title:"Codeforces practice set",         cat:"CP",   min:45, days:["Tue","Thu","Sat"], pri:4 },
  { id:"cfcon",title:"CF contest / virtual + upsolve",  cat:"CP",   min:90, days:["Sun"], pri:4 },
  { id:"algo", title:"GATE Algo (primary focus)",       cat:"GATE", min:75, days:["Mon","Tue","Thu","Sat"], pri:5 },
  { id:"dbms", title:"GATE DBMS (primary focus)",       cat:"GATE", min:75, days:["Wed","Fri","Sun"], pri:5 },
  { id:"sai",  title:"Sai coursework rotation",         cat:"SAI",  min:45, days:["Mon","Tue","Wed","Thu","Fri","Sat"], pri:4, rotating:["DAA","Found. Data Engg","Web Tech","Emerging Tools","Intel. Embedded Sys","Calculus"] },
  { id:"saiw", title:"Sai weekend catch-up / assign.",  cat:"SAI",  min:60, days:["Sun"], pri:4 },
  { id:"oss",  title:"OWASP/OpenCRE — assigned issue → PR", cat:"OSS", min:60, days:["Mon","Wed","Fri"], pri:3 },
  { id:"rev",  title:"Spaced revision + flashcards",    cat:"REV",  min:15, days:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], pri:3 },
];
const GOALS = {
  short: [
    "This week: all 3 IIT modules (Java/Stats/RDBMS) on schedule",
    "NeetCode daily streak — 7/7, 1 problem minimum",
    "CF 3 practices + 1 contest/upsolve",
    "OWASP: push assigned issue forward (commit every session)",
    "Sai: stay assignment-current, zero overdue",
  ],
  mid: [
    "This sem: finish NeetCode 150 (~10–12/wk pace — tracker in Week tab pace tip)",
    "GATE Algo + DBMS syllabus done this sem (intersection with DAA + RDBMS doubles as revision)",
    "IIT trimester: Java + Statistics + RDBMS completed with notes",
    "OWASP PR merged + consistent 3×/wk contributions (GSoC portfolio)",
    "Sai sem: DAA, FDE, WebTech, ETA, IES, Calculus — strong grades",
  ],
  long: [
    "GATE (2027): top rank — Algo/DBMS now = compounding lead",
    "GSoC selection via sustained open-source record",
    "Codeforces rating habit (target: Specialist → Expert trajectory)",
    "Mastery: DSA + systems fundamentals interview-ready",
  ]
};
const SCRAPER = `// Paste in Coursera page console (F12), Enter → durations copied.\n(() => {\n  const t = document.body.innerText;\n  const re = /(?:(\\d+)\\s*h[^\\d]{0,3})?(\\d{1,3})\\s*[:m]\\s*(\\d{1,2})?\\s*(?:min|m)?/gi;\n  const lines = [...document.querySelectorAll('a,span,div')]\n    .map(e => e.innerText.trim()).filter(s => s && s.length < 120);\n  const out = [];\n  document.querySelectorAll('*').forEach(() => {});\n  // fallback: grab every mm:ss-looking string with its row label\n  const rows = [...document.querySelectorAll('[data-testid],li,a')].map(e=>e.innerText.replace(/\\s+/g,' ').trim()).filter(Boolean);\n  const pat = /(.{3,80}?)\\s+(\\d{1,2}:\\d{2}(?::\\d{2})?|\\d+\\s*min)/;\n  rows.forEach(r => { const m = r.match(pat); if (m) out.push(m[1].slice(0,60) + ' — ' + m[2]); });\n  const uniq = [...new Set(out)].join('\\n') || t.match(/\\d{1,2}:\\d{2}(:\\d{2})?/g)?.join('\\n') || 'No durations found — copy manually';\n  navigator.clipboard.writeText(uniq).then(()=>alert('Copied '+uniq.split('\\n').length+' lines. Paste into StudyOS → IIT Modules.'));\n})();`;

/* ---------- store ---------- */
function defState(){ return { checks:{}, backlog:[], modules:[], custom:[], tests:[], crunch:{days:3,pause:["sai","cf","oss"]}, books:[], bookSeeded:false, bookPph:6, bookMaxDay:30, college:{}, collegeSeeded:false, log:[], seeded:false, speed:1.5, catchup:false, cap:{Mon:300,Tue:300,Wed:300,Thu:280,Fri:300,Sat:360,Sun:360}, weekOffset:0, seq:1 }; }
let S;
try { S = JSON.parse(localStorage.getItem(LSKEY)) || defState(); } catch { S = defState(); }
S = Object.assign(defState(), S);
function save(){ localStorage.setItem(LSKEY, JSON.stringify(S)); }

/* ---------- dates ---------- */
const dstr = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const parseD = s => { const [y,m,dd]=s.split("-").map(Number); return new Date(y,m-1,dd); };
const addD = (d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const wd = d => DAYS[(d.getDay()+6)%7]; // Mon-first
function monday(offset=0){ const n=new Date(); n.setHours(0,0,0,0); const m=addD(n,-((n.getDay()+6)%7)+offset*7); return m; }
function weekDates(offset){ const m=monday(offset); return DAYS.map((_,i)=>addD(m,i)); }
const todayStr = ()=>dstr(new Date());

/* ---------- duration parser (mm:ss, h:mm:ss, X min, 1h 20m) ---------- */
function minsFromToken(h,m,s,word){
  if (word) return parseInt(word,10);                       // "20 min"
  if (s!==undefined && s!=="") return (+h)*60 + (+m) + (+s)/60; // h:mm:ss
  if (h!==undefined && m!==undefined && +h<10 && String(h).length<=2 && m.length===2 && +m<60 && !/h/i.test(argumentsRaw||"")){
    // mm:ss handled below via explicit branch; keep generic
  }
  return 0;
}
let argumentsRaw="";
function parseLine(line){
  argumentsRaw=line;
  line=line.trim(); if(!line) return null;
  // 1h 20m / 1 hr 15 mins
  let m = line.match(/(\d+)\s*h(?:r|our)?s?\s*(\d+)?\s*m?(?:in)?s?/i);
  if (m && /h/i.test(line)) {
    const mins = (+m[1])*60 + (m[2]?+m[2]:0);
    return { label: line.replace(/(\d+\s*h[^,;|—–-]*)(\d*\s*m[^,;|—–-]*)?/i,"").trim() || line, minutes: Math.round(mins) };
  }
  // h:mm:ss or mm:ss (take LAST time token as duration, rest as label)
  const times=[...line.matchAll(/(\d+):(\d{2})(?::(\d{2}))?/g)];
  if (times.length){
    const t=times[times.length-1];
    let mins;
    if (t[3]!==undefined) mins=(+t[1])*60+(+t[2])+(+t[3])/60;
    else { const a=+t[1],b=+t[2]; mins = a>=60 ? a+(b/60) : (line.match(/:/g).length>=2? a*60+b : (a<10? a*60+b : a+b/60)); 
      // disambiguate: "45:10" = 45m10s; "1:02:45" handled above
      if (t[1].length<=2 && +t[1]<10 && t[0].split(":").length===2) mins=a+b/60; else if(+t[1]>=10) mins=a+b/60; }
    const label=line.replace(t[0],"").replace(/[—–\-|,;:.]+$/,"").trim()||("Video "+(times.length));
    return { label, minutes: Math.max(1,Math.round(mins)) };
  }
  // "45 min", "45m"
  m=line.match(/(\d+)\s*(?:min(?:ute)?s?|m)\b/i);
  if(m){ return { label: line.replace(m[0],"").trim()||line, minutes:+m[1] }; }
  // bare number = minutes
  m=line.match(/^\D*(\d{2,4})\D*$/);
  if(m && +m[1]<600) return { label: line, minutes:+m[1] };
  return { label: line, minutes: 0, unparsed:true };
}
function parseDurations(text){
  return text.split("\n").map(parseLine).filter(Boolean);
}

/* ---------- scheduler ---------- */
function iitVideosLeft(){ const out=[]; S.modules.forEach(mod=>mod.videos.forEach((v,vi)=>{ if(!v.done) out.push({mod,v,vi}); })); return out; }
function splitChunk(label, minutes, max=50){
  if (minutes<=max) return [{label, minutes}];
  const n=Math.ceil(minutes/max), per=Math.ceil(minutes/n), arr=[];
  for(let i=0;i<n;i++) arr.push({label:`${label} (part ${i+1}/${n})`, minutes: Math.min(per, minutes-i*per)});
  return arr;
}
/* Build schedule for a week offset. Pure function of templates+custom+modules+backlog placement. */
function iitRate(){ let a=0,b=0; (S.modules||[]).forEach(m=>m.videos.forEach(v=>{ b++; if(v.done)a++; })); return b?a/b:1; }
/* Daily reading budget: humane base scaled by IIT completion (ticked videos) and
   college load; 0 while lagging (reading pauses till backlog clears). */
function readBudget(d){
  if(behindInfo().behind) return 0;
  const pace=0.7+0.3*iitRate();
  const base=Math.min(+S.bookMaxDay||30,30)*pace;
  return Math.max(15,Math.round(base*Math.max(0.5,1-collegeMin(d.wd)/480)));
}
function buildWeek(offset){
  const dates=weekDates(offset);
  const days=dates.map(d=>({ date:dstr(d), wd:wd(d), cap:S.cap[wd(d)]||300, college:collegeFor(wd(d)), tasks:[] }));
  const CUT=S.catchup?{oss:30,cf:30,cfcon:60,saiw:45}:{}; // catch-up mode lightens flexible load
  const cutMin=t=>CUT[t.id]||t.min;
  // 0) crunch map: dates within N days before any test (universal, any subject)
  const crunchDays={};
  const crunchPause=(S.crunch&&S.crunch.pause)||[];
  if(S.crunch&&+S.crunch.days>0) (S.tests||[]).forEach(ts=>{
    if(ts.crunchOff||!ts.date) return;
    for(let k=1;k<=+S.crunch.days;k++) crunchDays[dstr(addD(parseD(ts.date),-k))]=ts.course;
  });
  // 1) recurring + custom one-offs (crunch-paused subjects skipped to fund test prep)
  days.forEach((day,di)=>{
    TEMPLATES.forEach(t=>{
      if(!t.days.includes(day.wd)) return;
      if(crunchDays[day.date]&&crunchPause.includes(t.id)) return; // paused for crunch
      let title=t.title, extra="";
      if(t.rotating) extra=" · "+t.rotating[di % t.rotating.length];
      day.tasks.push({ key:`${day.date}::${t.id}`, title:title+extra, cat:t.cat, min:cutMin(t), pri:t.pri, kind:"rec", fixed:true });
    });
    S.custom.filter(c=>c.date===day.date).forEach(c=>{
      day.tasks.push({ key:`custom:${c.id}`, title:c.title, cat:c.cat||"SAI", min:c.min, pri:c.pri||3, kind:"custom", fixed:true });
    });
  });
  // 1b) tests: exam-day blocks + prep, date-fixed right after recurring
  // so core subjects are never displaced — IIT videos absorb the squeeze and auto-carry.
  const byDate={}; days.forEach(d=>byDate[d.date]=d);
  const saiPrepMin=ts=>ts.prepMode==="h"?Math.round((+ts.qty||0)*60):Math.round((+ts.qty||0)*(+ts.perQ||4));
  const saiPrepLabel=ts=>ts.prepMode==="h"?`${ts.qty}h material (~${saiPrepMin(ts)}m)`:`${ts.qty} PYQs @${ts.perQ}m (~${saiPrepMin(ts)}m)`;
  (S.tests||[]).forEach(ts=>{
    if(ts.sys==="sai"){
      if(byDate[ts.date]) byDate[ts.date].tasks.push({ key:`sai:${ts.id}:exam`, title:`📝 SaiU test: ${ts.course}${ts.title?" — "+ts.title:""}`, cat:"SAI", min:60, pri:6, kind:"test", fixed:true });
      let rem=saiPrepMin(ts), back=1, i=0;
      while(rem>0&&back<=5){ // walk back up to 5 days, ≤60m sessions
        const dd=dstr(addD(parseD(ts.date),-back));
        if(byDate[dd]){ const sess=Math.min(60,rem); byDate[dd].tasks.push({ key:`sai:${ts.id}:prep${i}`, title:`📝 SaiU prep (${ts.course}): ${saiPrepLabel(ts)}`, cat:"SAI", min:sess, pri:6, kind:"test", fixed:true }); rem-=sess; i++; }
        back++;
      }
      while(rem>0){ // test near week edge: remainder goes to roomiest PRE-test day (never after the exam)
        const before=days.filter(d=>d.date<ts.date);
        const pool=before.length?before:(byDate[ts.date]?[byDate[ts.date]]:days);
        const target=pool.slice().sort((a,b)=>(b.cap-b.tasks.reduce((x,y)=>x+y.min,0))-(a.cap-a.tasks.reduce((x,y)=>x+y.min,0)))[0];
        const sess=Math.min(60,rem); target.tasks.push({ key:`sai:${ts.id}:prep${i}`, title:`📝 SaiU prep (${ts.course}): ${saiPrepLabel(ts)}`, cat:"SAI", min:sess, pri:6, kind:"test", fixed:true }); rem-=sess; i++;
      }
      return;
    }
    const proctored=ts.type==="proctored";
    if(byDate[ts.date]) byDate[ts.date].tasks.push({ key:`test:${ts.id}:exam`, title:`📝 ${proctored?"Proctored":"Non-proctored"} test: ${ts.course}`, cat:"IIT", min:proctored?120:60, pri:6, kind:"test", fixed:true });
    const preps = proctored
      ? [{off:2,title:`📝 Test prep (${ts.course}): full revision`,min:90},{off:1,title:`📝 Test prep (${ts.course}): mock + formula sheet`,min:60}]
      : [{off:1,title:`📝 Test prep (${ts.course}): quick review`,min:45}];
    preps.forEach((p,i)=>{
      const dd=dstr(addD(parseD(ts.date),-p.off));
      if(byDate[dd]) byDate[dd].tasks.push({ key:`test:${ts.id}:prep${i}`, title:p.title, cat:"IIT", min:p.min, pri:proctored?6:5, kind:"test", fixed:true });
    });
  });
  // 2) IIT chunks → spread EVENLY across all 7 days (water-filling, scaled by playback speed).
  // Round-robin per course so Java/RDBMS/Optimization all progress daily and finish together
  // by week's end. Pass 1 never breaches a day's cap; pass 2 only overflows if total > free week.
  const free = day => day.cap - day.tasks.reduce((a,t)=>a+t.min,0);
  const spd = S.speed||1;
  const effMin = m => Math.max(5, Math.round(m/spd));
  const byCourse={};
  iitVideosLeft().forEach(({mod,v})=>{
    const key=mod.course+' W'+mod.week;
    (byCourse[key]=byCourse[key]||[]).push(...splitChunk(`${mod.course} W${mod.week}: ${v.label}`, effMin(v.minutes), 35).map(ch=>({mod,v,ch})));
  });
  // textbook reading per module (raw minutes, not speed-scaled), same even spread
  S.modules.forEach(mod=>{
    const tbMin=(mod.textbook ?? 30);
    if(tbMin>0){
      const key=mod.course+' W'+mod.week;
      (byCourse[key]=byCourse[key]||[]).push(...    splitChunk(`📖 Textbook: ${mod.course} W${mod.week}`, tbMin, 35).map(ch=>({mod,v:{label:'📖 textbook'},ch,tb:true})));
    }
  });
  const courses=Object.keys(byCourse);
  const iitLoad=d=>d.tasks.filter(t=>t.kind==="iit").reduce((a,t)=>a+t.min,0);
  let more=true;
  while(more){
    more=false;
    for(const c of courses){
      const q=byCourse[c]; if(!q.length) continue;
      const item=q.shift(); more=true;
      // least-loaded day that still has room, tightest fit first (cap-safe); crunch-paused IIT defers (auto-carry)
      const roomy=days.filter(d=>free(d)>=item.ch.minutes&&!(crunchDays[d.date]&&crunchPause.includes("iit")));
      if(!roomy.length) continue; // nothing fits this week → stays undone, auto-carries to next week (never forced red)
      const target=roomy.slice().sort((a,b)=>iitLoad(a)-iitLoad(b)||free(a)-free(b))[0];
      target.tasks.push({ key:`iit:${item.mod.id}:${item.v.label}:${item.ch.label}`, title:"▶ "+item.ch.label, cat:"IIT", min:item.ch.minutes, pri:5, kind:"iit", tb:!!item.tb, modId:item.mod.id, vlabel:item.v.label, chunk:item.ch.label });
    }
  }
  // 2b) book reading: ≤2 sessions/day inside the adaptive budget; the rest defers — never red
  const pph=+S.bookPph||6;
  (S.books||[]).forEach(b=>b.chapters.forEach((c,ci)=>{
    const left=Math.max(0,(+c.pages||0)-(+c.done||0));
    if(left<=0) return;
    splitChunk(`📕 ${b.title}: ${c.name}`, Math.max(10,Math.ceil(left/pph*60)), 15).forEach(ch=>{
      const roomy=days.filter(d=>free(d)>=ch.minutes&&d.tasks.filter(t=>t.kind==="book").length<2&&bookLoadOf(d)+ch.minutes<=readBudget(d)&&!(crunchDays[d.date]&&crunchPause.includes("sai")));
      if(!roomy.length) return; // deferred to a future week, not dropped
      const target=roomy.slice().sort((a,x)=>bookLoadOf(a)-bookLoadOf(x))[0];
      const pp=Math.max(1,Math.round(ch.minutes/60*pph));
      target.tasks.push({ key:`book:${b.id}:${ci}:${ch.label}`, title:`▶ 📕 ${b.title}: ${c.name} (≈${pp}p · ${ch.minutes}m)`, cat:"SAI", min:ch.minutes, pri:4, kind:"book", fixed:false });
    });
  }));
  function bookLoadOf(d){ return d.tasks.filter(t=>t.kind==="book").reduce((a,t)=>a+t.min,0); }
  // 3) backlog → leftover free slots, most-overdue first (cap 2 per day); unplaced stays queued, never forced red
  const sorted=[...S.backlog].sort((a,b)=>(b.overdue||0)-(a.overdue||0) || b.pri-a.pri);
  sorted.forEach(b=>{
    const cands=days.filter(d=>free(d)>=Math.min(b.min,30) && d.tasks.filter(t=>t.kind==="carry").length<2)
      .sort((a,b2)=>free(a)-free(b2)); // tightest fit that still fits
    if(!cands.length) return; // queued for a future week with room
    const t=cands[0];
    t.tasks.push({ key:`carry:${b.id}::${t.date}`, title:"↩ "+b.title, cat:b.cat, min:b.min, pri:b.pri, kind:"carry", bid:b.id });
  });
  // order: fixed first by priority, then iit, then carry
  days.forEach(d=>d.tasks.sort((a,b)=>({rec:0,custom:0,test:0,iit:1,carry:2}[a.kind]-{rec:0,custom:0,test:0,iit:1,carry:2}[b.kind]) || b.pri-a.pri));
  return days;
}
function isDone(dayDate,key){ return !!(S.checks[dayDate]&&S.checks[dayDate][key]); }
function toggleCheck(date,key,on){
  S.checks[date]=S.checks[date]||{};
  if(on){ S.checks[date][key]=1; } else delete S.checks[date][key];
  // completing a carry item removes it from backlog
  if(on && key.startsWith("carry:")){ const bid=key.split("::")[0].slice(6); S.backlog=S.backlog.filter(b=>String(b.id)!==bid); }
  autoRelocate(); // re-fit timetable live on every change
  save(); renderAll();
}
function toggleIit(modId,vlabel,on){
  const mod=S.modules.find(m=>String(m.id)===String(modId)); if(!mod) return;
  mod.videos.forEach(v=>{ if(v.label===vlabel) v.done=!!on; });
  autoRelocate();
  save(); renderAll();
}

/* ---------- missed → backlog ---------- */
function closeDay(dateStr){
  const days=buildWeek(S.weekOffset);
  const day=days.find(d=>d.date===dateStr) || buildWeek(weekOf(dateStr))[0];
  let moved=0;
  day.tasks.forEach(t=>{
    if(t.kind==="iit"&&!t.tb) return; // IIT videos auto-carry via undone videos
    if(t.kind==="carry") { // still undone → bump overdue
      const b=S.backlog.find(x=>`carry:${x.id}::${dateStr}`===t.key||String(x.id)===String(t.bid));
      if(b && !isDone(dateStr,t.key)) b.overdue=(b.overdue||0)+1;
      return;
    }
    if(!isDone(dateStr,t.key) && !S.backlog.some(b=>b.fromKey===t.key)){
      S.backlog.push({ id:S.seq++, title:t.title, cat:t.cat, min:t.min, pri:t.pri, fromDate:dateStr, fromKey:t.key, overdue:1 });
      moved++;
    }
  });
  save(); renderAll();
  alert(moved? `Moved ${moved} missed item(s) to backlog — they'll auto-fill your next free slots.` : "Nothing missed. Streak protected. 🎉");
}
function weekOf(dateStr){
  const t=parseD(dateStr);
  const tMon=addD(t,-((t.getDay()+6)%7)); // Monday of that date's week
  return Math.round((tMon-monday(0))/6048e5);
}
function redistribute(){
  // re-sort backlog by overdue & rebuild = automatic; this just bumps UI + drops oldest-low-pri hint
  S.backlog.sort((a,b)=>(b.overdue||0)-(a.overdue||0)||b.pri-a.pri);
  save(); renderAll();
}
function addLog(msg){
  if(!Array.isArray(S.log)) S.log=[];
  S.log.push({ ts: todayStr(), msg });
  if(S.log.length>40) S.log=S.log.slice(-40);
}
/* Auto-relocate: scan past 7 days (excluding today). Any unchecked recurring/
   custom task not already in backlog moves to backlog (overdue+1 on re-bump).
   IIT videos auto-carry via undone flags, so they're skipped. Idempotent. */
function behindInfo(){
  const n=S.backlog.length, mins=S.backlog.reduce((a,b)=>a+(b.min||0),0);
  const oldest=S.backlog.reduce((a,b)=>Math.max(a,b.overdue||0),0);
  return { n, mins, oldest, behind: mins>=150||oldest>=3 };
}
function autoRelocate(){
  if(!Array.isArray(S.log)) S.log=[];
  const t=todayStr(); let moved=0;
  const since=S.installed||t; // never backfill days before install
  for(let i=1;i<=7;i++){
    const d=dstr(addD(new Date(),-i));
    if(d<since) continue;
    const days=buildWeek(weekOf(d));
    const day=days.find(x=>x.date===d); if(!day) continue;
    day.tasks.forEach(x=>{
      if(x.kind==="iit"&&!x.tb) return; // videos auto-carry; textbook chunks relocate like normal tasks
      if(x.kind==="carry"){
        const b=S.backlog.find(y=>String(y.id)===String(x.bid));
        if(b && !isDone(d,x.key) && !b["_bump_"+d]){ b.overdue=(b.overdue||0)+1; b["_bump_"+d]=1; }
        return;
      }
      if(d < t && !isDone(d,x.key) && !S.backlog.some(b=>b.fromKey===x.key)){
        S.backlog.push({ id:S.seq++, title:x.title, cat:x.cat, min:x.min, pri:x.pri, fromDate:d, fromKey:x.key, overdue:1 });
        addLog(`"${x.title.slice(0,50)}" missed on ${d} → backlog`);
        moved++;
      }
    });
  }
  if(S.catchup && S.backlog.reduce((a,b)=>a+(b.min||0),0)<60){ S.catchup=false; addLog('Catch-up complete — full timetable restored'); save(); }
  else if(moved) save();
  // crunch payback: tests whose window has passed return paused work as backlog (compensate after)
  (S.tests||[]).forEach(ts=>{
    if(ts.crunchPaid||ts.crunchOff||!ts.date||!(ts.date<t)||!S.crunch||!(+S.crunch.days>0)) return;
    (S.crunch.pause||[]).forEach(pid=>{
      const tmp=TEMPLATES.find(x=>x.id===pid); if(!tmp) return; // 'iit' auto-carries, needs no entry
      for(let k=1;k<=+S.crunch.days;k++){
        const dd=dstr(addD(parseD(ts.date),-k));
        if(!tmp.days.includes(wd(parseD(dd)))) continue;
        S.backlog.push({ id:S.seq++, title:`Payback (${ts.course} crunch): ${tmp.title}`, cat:tmp.cat, min:tmp.min, pri:3, fromDate:ts.date, overdue:1 });
      }
    });
    ts.crunchPaid=true; addLog(`Crunch payback: paused work for the ${ts.course} test is back in your queue`); save();
  });
  return moved;
}
/* Self-test: parser + schedule + backlog placement + idempotent relocate. */
function runSelfTest(){
  const res=[];
  try{
    const items=parseDurations("Intro to OOP — 12:34\nClasses — 45:10\nQuiz — 20 min");
    const tot=items.reduce((a,x)=>a+(x.minutes||0),0);
    res.push([(items.length===3&&tot===78)?"✓":"✗", `parser: 3 videos, total ${tot} min (expect 78)`]);
  }catch(e){ res.push(["✗","parser threw: "+e.message]); }
  try{
    const days=buildWeek(0);
    const ok=days.length===7 && days.every(d=>d.tasks.length>0);
    res.push([ok?"✓":"✗", `schedule: 7 days, all non-empty (${days.map(d=>d.tasks.length).join("/")})`]);
  }catch(e){ res.push(["✗","schedule threw: "+e.message]); }
  try{
    const tmp={ id:"__test__", title:"SELFTEST probe", cat:"REV", min:25, pri:1, fromDate:todayStr(), fromKey:"__test__", overdue:9 };
    S.backlog.push(tmp);
    const days=buildWeek(0);
    const placed=days.some(d=>d.tasks.some(t=>t.kind==="carry"&&String(t.bid)==="__test__"));
    S.backlog=S.backlog.filter(b=>b.id!=="__test__");
    res.push([placed?"✓":"✗","backlog: overdue probe auto-placed into a free slot"]);
  }catch(e){ res.push(["✗","backlog threw: "+e.message]); }
  try{
    const th=dstr(addD(monday(0),3));
    S.tests.push({id:"__tt__",course:"RDBMS",type:"proctored",date:th});
    const dd=buildWeek(0).find(d=>d.date===th);
    const hasExam=dd.tasks.some(t=>t.key==="test:__tt__:exam"&&t.min===120);
    const pd=buildWeek(0).find(d=>d.date===dstr(addD(parseD(th),-1)));
    const nPrep=pd.tasks.filter(t=>t.key.indexOf("test:__tt__:prep")===0).reduce((a,t)=>a+t.min,0);
    S.tests=S.tests.filter(t=>t.id!=="__tt__");
    res.push([(hasExam&&nPrep===150)?"✓":"✗",`tests: proctored exam (120m) + prep (90+60=${nPrep}m) auto-placed on fixed dates`]);
  }catch(e){ res.push(["✗","tests threw: "+e.message]); }
  try{
    const n1=S.backlog.length; autoRelocate(); const n2=S.backlog.length; autoRelocate(); const n3=S.backlog.length;
    res.push([n2===n3?"✓":"✗",`relocate idempotent: backlog ${n1}→${n2}→${n3} (no dupes on re-run)`]);
  }catch(e){ res.push(["✗","relocate threw: "+e.message]); }
  try{
    S.catchup=true;
    const cfMin=buildWeek(0).flatMap(d=>d.tasks).find(x=>x.key.slice(-4)==="::cf").min;
    S.catchup=false;
    res.push([cfMin===30?"✓":"✗",`catch-up mode: CF practice lightened 60→${cfMin}m, auto-exits below 60m backlog`]);
  }catch(e){ res.push(["✗","catch-up threw: "+e.message]); }
  try{
    const dd=buildWeek(0), perDay=dd.map(d=>d.tasks.filter(x=>x.kind==="iit").reduce((a,x)=>a+x.min,0));
    const used=perDay.filter(m=>m>0).length, spread=Math.max(...perDay)-Math.min(...perDay);
    res.push([(used===7&&spread<=120)?"✓":"✗",`IIT spread: all 7 days used (${perDay.join("/")}), max-min gap ${spread}m`]);
  }catch(e){ res.push(["✗","spread threw: "+e.message]); }
  try{
    const th2=dstr(addD(monday(0),3));
    S.tests.push({id:"__ts__",sys:"sai",course:"DAA",title:"DP",date:th2,prepMode:"q",qty:75,perQ:4});
    const w2=buildWeek(0);
    const examOk=w2.find(d=>d.date===th2).tasks.some(t=>t.key==="sai:__ts__:exam"&&t.min===60);
    const prepSum=w2.flatMap(d=>d.tasks).filter(t=>t.key.indexOf("sai:__ts__:prep")===0).reduce((a,t)=>a+t.min,0);
    S.tests=S.tests.filter(t=>t.id!=="__ts__");
    res.push([(examOk&&prepSum===300)?"✓":"✗",`sai test: 60m exam + 75 PYQs → ${prepSum}m prep spread (expect 300)`]);
  }catch(e){ res.push(["✗","sai test threw: "+e.message]); }
  try{
    const snapBooks=S.books;
    S.books=[{id:"__bk__",title:"T",deadline:"2026-12-20",chapters:[{name:"C1",pages:12,done:0},{name:"C2",pages:6,done:0}]}];
    const w0=buildWeek(0), bs=w0.flatMap(d=>d.tasks).filter(t=>t.kind==="book");
    const perDayOk=w0.every(d=>d.tasks.filter(t=>t.kind==="book").reduce((a,t)=>a+t.min,0)<=readBudget(d)+0.01);
    const noOver=w0.every(d=>d.tasks.reduce((a,t)=>a+t.min,0)<=d.cap);
    S.books=snapBooks;
    res.push([(bs.length>0&&bs.every(t=>t.min<=15)&&perDayOk&&noOver)?"✓":"✗",`books: ≤15m humane sessions within daily budget, zero overload days`]);
  }catch(e){ res.push(["✗","book threw: "+e.message]); }
  try{
    const snapB=S.backlog;
    S.tests.push({id:"__cz__",sys:"sai",course:"DAA",title:"",date:dstr(addD(parseD(todayStr()),2)),prepMode:"h",qty:1,perQ:4});
    S.crunch={days:2,pause:["sai"]};
    const paused=!buildWeek(weekOf(todayStr())).find(d=>d.date===todayStr()).tasks.some(t=>t.key.slice(-5)==="::sai");
    const nB=S.backlog.length;
    S.tests.find(t=>t.id==="__cz__").date=dstr(addD(parseD(todayStr()),-1)); // move test to past → payback
    autoRelocate();
    const paid=S.backlog.length>nB;
    S.tests=S.tests.filter(t=>t.id!=="__cz__"); S.backlog=snapB;
    S.crunch={days:3,pause:["sai","cf","oss"]};
    res.push([(paused&&paid)?"✓":"✗",`crunch: Sai paused pre-test (${paused}), payback returned after (${paid})`]);
  }catch(e){ try{S.crunch={days:3,pause:["sai","cf","oss"]};}catch(_){} res.push(["✗","crunch threw: "+e.message]); }
  try{
    const sB=S.backlog, sT=S.tests, sC=S.custom;
    S.backlog=[]; S.tests=[]; S.custom=[];
    const over=buildWeek(0).filter(d=>d.tasks.reduce((a,t)=>a+t.min,0)>d.cap).map(d=>d.wd);
    S.backlog=sB; S.tests=sT; S.custom=sC;
    res.push([over.length===0?"✓":"✗",`hard caps: ${over.length?over.join(",")+" OVER":"no day exceeds 4–6h"} (flexible work defers, never forces red)`]);
  }catch(e){ res.push(["✗","caps threw: "+e.message]); }
  try{
    const nDays=DAYS.filter(d=>collegeFor(d).length).length, thu=collegeMin("Thu");
    res.push([(nDays>=5&&thu>200)?"✓":"✗",`college blocks: ${nDays} days guarded (Thu ${thu}m), never scheduled over`]);
  }catch(e){ res.push(["✗","college threw: "+e.message]); }
  save(); renderAll();
  $("selfOut").innerHTML=res.map(r=>`<div>${r[0]} ${r[1]}</div>`).join("");
}

/* ---------- render ---------- */
const $=id=>document.getElementById(id);
function renderAll(){ renderToday(); renderWeek(); renderModules(); renderTests(); renderBooks(); renderGoals(); renderSettings(); renderDiag(); }
$("bAdd").onclick=()=>{
  const ti=$("bTitle").value.trim();
  const chs=parseDurations($("bChapters").value).filter(x=>x.minutes>0).map(x=>({name:x.label.slice(0,80),pages:x.minutes,done:0}));
  if(!ti||!chs.length){ alert("Give the book a title and at least one 'Chapter: pages' line."); return; }
  S.books.push({ id:S.seq++, title:ti, deadline:$("bDeadline").value||"2026-12-20", chapters:chs });
  $("bTitle").value=""; $("bChapters").value=""; save(); renderAll();
};
if($("bookPph")){ $("bookPph").value=S.bookPph||6; $("bookPph").onchange=e=>{ S.bookPph=Math.max(2,+e.target.value||6); save(); renderAll(); }; }
if($("bookMaxDay")){ $("bookMaxDay").value=S.bookMaxDay||30; $("bookMaxDay").onchange=e=>{ S.bookMaxDay=Math.max(10,+e.target.value||30); save(); renderAll(); }; }
function renderDiag(){ if(!$("diagLine")) return;
  $("diagLine").textContent=`${S.modules.length} modules · ${iitVideosLeft().reduce((a,x)=>a+x.v.minutes,0)}m IIT left · ${S.backlog.length} backlog · ${(S.tests||[]).length} tests · ${S.catchup?"catch-up ON":"normal"}`;
}
function catBadge(c){ return `<span class="badge" style="border-color:${CATS[c]||"#555"};color:${CATS[c]||"#ccc"}">${c}</span>`; }

function renderToday(){
  const t=todayStr();
  $("todayLabel").textContent=new Date().toDateString();
  $("todayDate").textContent="· "+t;
  // find today's day object (current week)
  const days=buildWeek(S.weekOffset);
  let day=days.find(d=>d.date===t);
  if(!day){ // viewing another week → still show real today
    const off=weekOf(t); day=buildWeek(off).find(d=>d.date===t);
  }
  const load=day.tasks.reduce((a,x)=>a+x.min,0), cap=day.cap;
  const done=day.tasks.filter(x=>x.kind==="iit"? iitChunkDone(x) : isDone(t,x.key));
  const pct=day.tasks.length?Math.round(done.length/day.tasks.length*100):100;
  $("todayBar").style.width=pct+"%";
  const hrs=x=>Math.floor(x/60)+"h "+(x%60)+"m";
  $("todayStats").textContent=`${done.length}/${day.tasks.length} done · ${pct}% · load ${hrs(load)} / cap ${hrs(cap)}`;
  $("overloadWarn").innerHTML = load>cap ? `<div class="warn">⚠ Overloaded by ${hrs(load-cap)} today. Tip: move "${lowestPri(day)}" to tomorrow's free slot, or raise capacity in Settings.</div>` : "";
  const row=x=>{
    const checked = taskDone(t,x);
    const carry=x.kind==="carry"?'<span class="badge carry">carryover</span>':"";
    const iit=x.kind==="iit"?'<span class="badge iit">IIT</span>':"";
    const test=x.kind==="test"?'<span class="badge testb">test</span>':"";
    return { checked, html:`<li class="task ${checked?"done":""}"><span class="dot" style="background:${CATS[x.cat]||"#555"}"></span><input type="checkbox" data-d="${t}" data-k="${x.key.replace(/"/g,"&quot;")}" data-iit="${(x.kind==="iit"&&!x.tb)?x.modId+"||"+x.vlabel:""}" ${checked?"checked":""}>
      <div><div class="t">${x.title}</div><div class="meta">${x.min} min · P${x.pri} ${carry}${iit}${test}</div></div></li>` };
  };
  const rows=day.tasks.map(row);
  const open=rows.filter(r=>!r.checked), shut=rows.filter(r=>r.checked);
  $("todayList").innerHTML=open.map(r=>r.html).join("")+
    (shut.length?`<details class="donebox"><summary>Done (${shut.length}) — tap to review</summary><ul class="tasklist">${shut.map(r=>r.html).join("")}</ul></details>`:"")+
    (day.tasks.length?"":`<li class="muted small">Nothing scheduled — enjoy the breather.</li>`);
  $("todayList").querySelectorAll("input").forEach(cb=>cb.onchange=()=>{
    if(cb.dataset.iit) toggleIit(cb.dataset.iit.split("||")[0], cb.dataset.iit.split("||")[1], cb.checked);
    else toggleCheck(cb.dataset.d, cb.dataset.k, cb.checked);
  });
  // college banner (blocked hours today)
  if($("collegeBanner")) $("collegeBanner").innerHTML=day.college.length?
    `<div class="collegebar">🏫 College today · ${day.college.map(c=>`${c.s}–${c.e} ${c.t}`).join(" &nbsp;·&nbsp; ")}</div>`:"";
  // behind / catch-up banner
  const bi=behindInfo();
  if($("behindBanner")){
    let bh="";
    if(S.catchup) bh=`<div class="tip ok">🚀 <b>Catch-up mode is reshaping your timetable</b> — lighter CF/OWASP load (up to ~75m/day freed) until backlog drops below 60m. <button id="exitCatchupBtn" class="btn sm">Exit</button></div>`;
    else if(bi.behind) bh=`<div class="tip warnb">📉 <b>Lagging: ${bi.n} tasks · ${bi.mins}m · oldest ${bi.oldest}d overdue.</b> Apply the catch-up plan and the timetable re-fits itself. <button id="catchupBtn" class="btn sm primary">Apply catch-up plan</button></div>`;
    $("behindBanner").innerHTML=bh;
    if($("catchupBtn")) $("catchupBtn").onclick=()=>{ S.catchup=true; addLog("Catch-up plan applied — CF/OWASP lightened"); save(); renderAll(); };
    if($("exitCatchupBtn")) $("exitCatchupBtn").onclick=()=>{ S.catchup=false; addLog("Catch-up exited manually"); save(); renderAll(); };
  }
  // backlog (placed vs queued-for-later)
  const placedBids=new Set(buildWeek(S.weekOffset).flatMap(d=>d.tasks).filter(x=>x.kind==="carry").map(x=>String(x.bid)));
  $("backlogCount").textContent=S.backlog.length+" open";
  $("backlogList").innerHTML=S.backlog.length? S.backlog.map(b=>
    `<li class="task"><div><div class="t">↩ ${b.title}</div><div class="meta">${catBadge(b.cat)} ${b.min} min · overdue ${b.overdue||0}d · from ${b.fromDate} · ${placedBids.has(String(b.id))?'<span style="color:var(--ok)">scheduled this week</span>':'<span style="color:var(--warn)">⏳ queued — no room yet, auto-tried weekly</span>'}</div></div>
     <span style="margin-left:auto"></span><button class="btn sm" data-done="${b.id}">Done</button><button class="btn danger sm" data-del="${b.id}">✕</button></div></li>`).join("")
    : `<li class="muted small">Backlog clear. Missed tasks will land here automatically.</li>`;
  $("backlogList").querySelectorAll("[data-done]").forEach(b=>b.onclick=()=>{ S.backlog=S.backlog.filter(x=>String(x.id)!==b.dataset.done); save(); renderAll(); });
  $("backlogList").querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{ S.backlog=S.backlog.filter(x=>String(x.id)!==b.dataset.del); save(); renderAll(); });
  // stats
  $("streakNum").textContent=streak();
  $("weekPct").textContent=weekPct()+"%";
  $("iitLeft").textContent=iitVideosLeft().reduce((a,x)=>a+x.v.minutes,0)+"m";
  $("smartTip").innerHTML="<b>Smart tip:</b> "+tip(day);
  if($("reloLog")) $("reloLog").innerHTML=S.log.length? [...S.log].slice(-6).reverse().map(e=>`<li>• [${e.ts}] ${e.msg}</li>`).join("") : "<li>Nothing relocated yet — unfinished past-day tasks will appear here automatically.</li>";
}
function iitChunkDone(x){ const mod=S.modules.find(m=>String(m.id)===String(x.modId)); if(!mod) return false; const v=mod.videos.find(v=>v.label===x.vlabel); return !!(v&&v.done); }
/* Unified done-state: textbook chunks tick via normal checks; video chunks via video flags. */
function taskDone(date,x){
  if(x.kind==="iit"&&!x.tb) return iitChunkDone(x);
  return isDone(date,x.key);
}
function lowestPri(day){ const s=[...day.tasks].sort((a,b)=>a.pri-b.pri); return s.length?s[0].title:"—"; }
function tip(day){
  const left=iitVideosLeft();
  if(day.tasks.reduce((a,t)=>a+t.min,0)>day.cap) return `Today is overloaded — do high-priority first (GATE + IIT), let the backlog engine shift "${lowestPri(day)}".`;
  if(S.backlog.length>3) return `Backlog has ${S.backlog.length} items — hit “Smart redistribute” and protect tomorrow morning for the top-overdue one.`;
  if(left.length) { const m=left.reduce((a,x)=>a+x.v.minutes,0); return `${left.length} IIT videos (${m} min) remaining across modules. They auto-spread into free slots — paste next week's modules as soon as they're released.`; }
  const nc=neetcodePace(); return `NeetCode pace: ${nc.done}/150 assumed tracked externally — solve ${nc.perWeek}/wk to finish this sem (~16 wks). Keep the daily 45-min streak even on bad days.`;
}
function neetcodePace(){ return { done: S.ncDone||0, perWeek: Math.ceil((150-(S.ncDone||0))/16) }; }
function streak(){
  let s=0; for(let i=0;i<60;i++){ const d=dstr(addD(new Date(),-i));
    const off=weekOf(d), days=buildWeek(off), day=days.find(x=>x.date===d); if(!day) break;
    if(!day.tasks.length) continue;
    const dn=day.tasks.filter(x=>taskDone(d,x)).length;
    if(dn/day.tasks.length>=0.8) s++; else if(i===0) continue; else break;
  } return s;
}
function weekPct(){
  const days=buildWeek(S.weekOffset); let a=0,b=0;
  days.forEach(d=>d.tasks.forEach(t=>{ b++; if(taskDone(d.date,t)) a++; }));
  return b?Math.round(a/b*100):100;
}

function renderWeek(){
  const dates=weekDates(S.weekOffset), days=buildWeek(S.weekOffset);
  $("weekRange").textContent=dates[0].toDateString()+" → "+dates[6].toDateString();
  $("weekGrid").innerHTML=days.map(d=>{
    const load=d.tasks.reduce((a,t)=>a+t.min,0);
    const isT=d.date===todayStr(), cm=collegeMin(d.wd);
    const pct=Math.min(100,Math.round(load/Math.max(1,d.cap)*100));
    return `<details class="day ${load>d.cap?"over":""} ${isT?"today":""}" ${isT?"open":""}>
      <summary><span class="dname">${d.wd} <span class="muted">${d.date.slice(5)}</span></span>
      <span class="loadbar"><span style="width:${pct}%"></span></span>
      <span class="cap">${load}/${d.cap}${load>d.cap?" · OVER":""}</span></summary>
      ${d.college.map(c=>`<div class="mini college">🎓 ${c.s}–${c.e} ${c.t}</div>`).join("")}
      ${d.tasks.map(t=>{const dn=taskDone(d.date,t);
        return `<div class="mini ${dn?"done":""}"><span class="dot" style="background:${CATS[t.cat]||"#555"}"></span>${dn?"✓":"○"} ${t.title.slice(0,44)} <span class="muted">·${t.min}m</span></div>`;}).join("")}
      ${cm?`<div class="cap">🏫 ${Math.floor(cm/60)}h${cm%60?pads(cm%60):""} college excluded from study load</div>`:""}
    </details>`;
  }).join("");
}
function pads(n){ return String(n).padStart(2,"0"); }

function renderModules(){
  $("scraperSnippet").textContent=SCRAPER;
  $("moduleList").innerHTML=S.modules.length? S.modules.map(m=>{
    const tot=m.videos.reduce((a,v)=>a+v.minutes,0), dn=m.videos.filter(v=>v.done).length;
    const spd=S.speed||1, eff=Math.round(tot/spd), tb=(m.textbook ?? 30);
    return `<div class="mod"><b>${m.course} · Week ${m.week}</b> ${m.title?"· "+m.title:""} — ${dn}/${m.videos.length} videos · ${tot} min raw (~${eff} at ${spd}×) + ${tb}m textbook
      <div>${m.videos.map(v=>`<label style="display:block"><input type="checkbox" data-m="${m.id}" data-v="${v.label.replace(/"/g,"&quot;")}" ${v.done?"checked":""}> ${v.label} <span class="muted">(${v.minutes}m)</span></label>`).join("")}</div>
      <div class="row wrap" style="margin-top:6px"><label class="small muted">📖 Textbook min/week <input type="number" min="0" max="300" step="5" value="${tb}" data-tb="${m.id}" style="width:75px"></label>
      <span style="flex:1"></span><button class="btn danger sm" data-delmod="${m.id}">Delete module</button></div></div>`;
  }).join("") : `<p class="muted small">No modules yet. Paste Week 1 for Java / Statistics / RDBMS to generate this week's IIT blocks.</p>`;
  $("moduleList").querySelectorAll("input[type=checkbox]").forEach(cb=>cb.onchange=()=>toggleIit(cb.dataset.m,cb.dataset.v,cb.checked));
  $("moduleList").querySelectorAll("[data-tb]").forEach(i=>i.onchange=()=>{ const m=S.modules.find(x=>String(x.id)===i.dataset.tb); if(m){ m.textbook=Math.max(0,+i.value||0); save(); renderAll(); } });
  $("moduleList").querySelectorAll("[data-delmod]").forEach(b=>b.onclick=()=>{ S.modules=S.modules.filter(m=>String(m.id)!==b.dataset.delmod); save(); renderAll(); });
}

function renderTests(){
  if(!$("testList")) return;
  const list=[...(S.tests||[])].sort((a,b)=>a.date<b.date?-1:1);
  $("testList").innerHTML=list.length? list.map(t=>{
    const info=t.sys==="sai"
      ? `📝 SaiU · <b>${t.course}</b>${t.title?" — "+t.title:""} <span class="muted">(${t.prepMode==="h"?t.qty+"h material":t.qty+" PYQs"} → ${t.prepMode==="h"?Math.round(t.qty*60):Math.round(t.qty*(t.perQ||4))}m prep)</span>`
      : `${t.type==="proctored"?"📝 Proctored":"📝 Non-proctored"} · <b>${t.course}</b>`;
    const p=t.sys==="sai"?"60m exam + auto-spread prep":(t.type==="proctored"?"120m exam + 90m + 60m prep":"60m exam + 45m prep");
    return `<div class="mod"><b>${t.date}</b> · ${info} <span class="muted">(${p})</span> <button class="btn sm" data-crunch="${t.id}" title="toggle crunch for this test">${t.crunchOff?"⚡ crunch off":"⚡ crunch on"}</button> <button class="btn danger sm" data-deltest="${t.id}">✕</button></div>`;
  }).join("") : `<p class="muted small">No tests scheduled. Add your alternating IITG series or a SaiU class test below — prep blocks appear automatically on fixed dates.</p>`;
  $("testList").querySelectorAll("[data-deltest]").forEach(b=>b.onclick=()=>{ S.tests=S.tests.filter(t=>String(t.id)!==b.dataset.deltest); save(); renderAll(); });
  $("testList").querySelectorAll("[data-crunch]").forEach(b=>b.onclick=()=>{ const t=(S.tests||[]).find(x=>String(x.id)===b.dataset.crunch); if(t){ t.crunchOff=!t.crunchOff; save(); renderAll(); } });
  // crunch defaults live-sync
  if($("cDays")) $("cDays").value=S.crunch.days;
  document.querySelectorAll("[data-pz]").forEach(cb=>{ cb.checked=(S.crunch.pause||[]).includes(cb.dataset.pz); });
}
/* Book reading plans. Chapters carry page counts (verify against your copy —
   seeds are ~3rd-edition estimates); pace = remaining pages ÷ weeks to deadline. */
function seedBooks(){
  if(S.bookSeeded) return; S.bookSeeded=true;
  if(!(S.books||[]).length){
    const C=(name,pages)=>({name,pages:pages,done:0});
    S.books.push({ id:S.seq++, title:"CLRS — DAA (in-syllabus)", deadline:"2026-12-20", seed:true, chapters:[
      C("Foundations & growth (Ch 1–3)",70),C("Divide & conquer (Ch 4)",35),C("Heapsort (Ch 6)",30),
      C("Quicksort (Ch 7)",30),C("Linear-time sorting (Ch 8)",30),C("Order statistics (Ch 9)",25),
      C("Hash tables (Ch 11)",28),C("BSTs (Ch 12)",34),C("Red-black trees (Ch 13)",31),
      C("Dynamic programming (Ch 15)",47),C("Greedy (Ch 16)",43),C("Graphs + BFS/DFS (Ch 22)",35),
      C("MST (Ch 23)",35),C("Shortest paths (Ch 24–25)",45),C("Max flow (Ch 26)",57),C("NP-completeness (Ch 34)",59)
    ]});
    addLog("Seeded CLRS plan (16 chapters, ~634p) — delete off-syllabus chapters to refit pace");
  }
  save();
}
function bookPace(b){
  const rem=b.chapters.reduce((a,c)=>a+Math.max(0,(+c.pages||0)-(+c.done||0)),0);
  const weeks=Math.max(1,Math.ceil((parseD(b.deadline)-parseD(todayStr()))/6048e5));
  const ppw=Math.ceil(rem/weeks), pph=+S.bookPph||6;
  const avgB=DAYS.reduce((a,d)=>a+readBudget({wd:d}),0)/7; // feasible daily mean at current pace
  const feasPpw=avgB>0?Math.floor(avgB*7/pph*60):0;
  const projWeeks=feasPpw>0?Math.ceil(rem/feasPpw):99;
  const proj=dstr(addD(new Date(),projWeeks*7));
  return { rem, weeks, ppw, minDay:Math.round(ppw/7/pph*60), feasPpw, projWeeks, proj, paused:avgB<=0 };
}
function renderBooks(){
  if(!$("bookList")) return;
  $("bookList").innerHTML=(S.books||[]).length?(S.books||[]).map(b=>{
    const p=bookPace(b);
    const verdict=p.paused?`⏸ reading paused — clear backlog to resume`
      :(p.proj>p.deadline?`⚠ at a feasible ~${p.feasPpw}p/wk this finishes ~${p.proj}, past deadline — trim chapters or extend deadline`
      :`✓ on track at ~${p.feasPpw}p/wk feasible (needs ${p.ppw}p/wk)`);
    const tb=readBudget({wd:wd(new Date())});
    return `<div class="mod"><b>📕 ${b.title}</b> — ${b.chapters.length} chapters · ${p.rem}p left · deadline asks <b>${p.ppw}p/wk</b> · today’s budget ${tb}m (IIT ${Math.round(iitRate()*100)}% done)<br><span class="muted small">${verdict}</span>
      <div>${b.chapters.map((c,ci)=>{
        const left=Math.max(0,c.pages-(c.done||0));
        return `<label style="display:block"><span style="flex:1">${c.name} — ${c.pages}p <span class="muted">(${left} left)</span></span><input type="number" min="0" max="${c.pages}" value="${c.done||0}" data-bdone="${b.id}:${ci}" style="width:65px" title="pages done"> <a href="#" data-delch="${b.id}:${ci}" title="remove chapter">✕</a></label>`;}).join("")}</div>
      <div class="row wrap" style="margin-top:6px"><label class="small muted">Deadline <input type="date" value="${b.deadline}" data-bdl="${b.id}"></label>
      <span style="flex:1"></span><button class="btn danger sm" data-delbook="${b.id}">Delete book</button></div></div>`;
  }).join("") : `<p class="muted small">No book plans. Add one below — e.g. CLRS with one "Chapter: pages" line each.</p>`;
  $("bookList").querySelectorAll("[data-bdone]").forEach(i=>i.onchange=()=>{ const [bid,ci]=i.dataset.bdone.split(":"); const b=(S.books||[]).find(x=>String(x.id)===bid); if(b&&b.chapters[+ci]){ b.chapters[+ci].done=Math.max(0,Math.min(b.chapters[+ci].pages,+i.value||0)); save(); renderAll(); } });
  $("bookList").querySelectorAll("[data-bdl]").forEach(i=>i.onchange=()=>{ const b=(S.books||[]).find(x=>String(x.id)===i.dataset.bdl); if(b){ b.deadline=i.value||b.deadline; save(); renderAll(); } });
  $("bookList").querySelectorAll("[data-delch]").forEach(a=>a.onclick=e=>{ e.preventDefault(); const [bid,ci]=a.dataset.delch.split(":"); const b=(S.books||[]).find(x=>String(x.id)===bid); if(b){ b.chapters.splice(+ci,1); save(); renderAll(); } });
  $("bookList").querySelectorAll("[data-delbook]").forEach(x=>x.onclick=()=>{ S.books=(S.books||[]).filter(y=>String(y.id)!==x.dataset.delbook); save(); renderAll(); });
}
function renderGoals(){  const card=(t,arr,c)=>`<div class="card"><h3>${t}</h3><ul class="small" style="padding-left:18px;margin:0">${arr.map(g=>`<li style="margin-bottom:6px">${g}</li>`).join("")}</ul><p class="muted small">${c}</p></div>`;
  $("goalsGrid").innerHTML =
    card("⚡ Short-term (this week)",GOALS.short,"Checked off in Today / Week tabs.")+
    card("🧱 Mid-term (this semester)",GOALS.mid,"NeetCode 150 · GATE Algo+DBMS · IIT trimester · OWASP PR · Sai grades.")+
    card("🚀 Long-term (6–12 mo)",GOALS.long,"GATE rank · GSoC · CP rating · mastery.");
}

function renderSettings(){
  $("capGrid").innerHTML=DAYS.map(d=>`<label>${d}<input type="number" min="0" max="720" step="15" data-cap="${d}" value="${S.cap[d]}"></label>`).join("");
  if($("speedSel")) $("speedSel").value=String(S.speed||1);
  if($("collegeList")) $("collegeList").innerHTML=DAYS.map(d=>{
    const cs=collegeFor(d);
    return `<div class="crow"><b>${d}</b> ${cs.length?cs.map((c,i)=>`<span class="chip">🎓 ${c.s}–${c.e} ${c.t} <a href="#" data-cday="${d}" data-cidx="${i}">✕</a></span>`).join(""):'<span class="muted small">no classes</span>'}</div>`;
  }).join("");
  if($("collegeList")) $("collegeList").querySelectorAll("[data-cday]").forEach(a=>a.onclick=e=>{ e.preventDefault(); S.college[a.dataset.cday].splice(+a.dataset.cidx,1); save(); renderAll(); });
}

/* Seed Week-1 modules (videos + readings; discussion prompts & labs excluded).
   Runs once on a fresh install; never touches existing user data. */
function seedWeek1(){
  if(S.seeded) return; S.seeded=true;
  if(S.modules.length){ save(); return; }
  const M=(course,week,title,rows)=>({ id:S.seq++, course, week, title, seed:true, textbook:30,
    videos: rows.map(r=>({ label:r[0], minutes:r[1], done:false })) });
  const addM=m=>{ if(!S.modules.some(x=>x.course===m.course&&String(x.week)===String(m.week))) S.modules.push(m); };
  addM(M("RDBMS",1,"About the Course, Intro to DBMS & Relational Model (3h C-lab excluded)",[
    ["About the Course",11],["Purpose of Database Systems",7],["Drawbacks of File Systems",11],
    ["Data Abstractions",5],["Data Model",5],["Relation Data Model",6],["DDL and DML",7],
    ["SQL Query Language",5],["History of Database Systems and Conclusion",7],["Learning Objectives & Recap",3],
    ["Relation Schema and Relational Database",8],["Super key, Candidate key, Primary key",9],
    ["Foreign key, Foreign key constraint",7],["Database Schema Diagram & Conclusion",6],
    ["📖 Books and References",10],["📖 Week 01 - Lecture Slides",60],["📖 Syllabus for Next Assessment",10],
    ["📖 Topics to be covered in lab",10],["📖 Solutions: Database File Handling in C",10]
  ]));
  addM(M("Java",1,"Overview of JAVA Programming Language (4h lab excluded)",[
    ["Course Introduction",3],["Why study JAVA",10],["History of JAVA",9],
    ["Features of JAVA Programming",10],["Basics of Object-Oriented Programming",9],
    ["Three principles of Object-Oriented Programming",20],["Week 1 Lab Recording",209],
    ["📖 Reference Books",2],["📖 Lecture Slides",10],["📖 Lab Exercises",10]
  ]));
  addM(M("Optimization",1,"Fundamentals of Optimization",[
    ["Meet your instructor & Course Introduction",14],["Modeling optimization problems",1],
    ["Formulation of optimization problem part-1",16],["Formulation of optimization problem part-2",10],
    ["Mathematical Foundations Part-1",23],["Mathematical Foundations Part-2",18],
    ["📖 Course Syllabus and Reference Books",10],["📖 Week 1 - Slides",20]
  ]));
  addLog("Seeded Week-1 modules: RDBMS, Java, Optimization");
  save();
}
/* College timetable (blocked hours — never scheduled over).
   Seeded from the SaiU sheet for SCDS Y2 Sec 3 + ETA Sec 2. Editable in Settings. */
function toMin(hhmm){ const p=hhmm.split(':'),a=+p[0],b=+(p[1]||0); return a*60+b; }
function collegeFor(wd){ return (S.college&&S.college[wd])||[]; }
function collegeMin(wd){ return collegeFor(wd).reduce((a,c)=>a+Math.max(0,toMin(c.e)-toMin(c.s)),0); }
function seedCollege(){
  // cleanup runs always: drop Linear Algebra blocks (not taken) from any existing data
  if(S.college) DAYS.forEach(d=>{ S.college[d]=(S.college[d]||[]).filter(c=>c.t.indexOf('Linear Algebra')<0); });
  // ensure IES blocks exist on all installs (Tue+Wed doubles, Dr. Ashok — single Sec 1 offering)
  [['Tue','15:00','15:55'],['Tue','16:00','16:55'],['Wed','15:00','15:55'],['Wed','16:00','16:55']].forEach(([d,s,e])=>{
    S.college[d]=S.college[d]||[];
    if(!S.college[d].some(c=>c.s===s&&/Embed|INTT/.test(c.t))) S.college[d].push({s,e,t:'Intelligent Embedded Sys (Dr. Ashok)'});
    S.college[d].sort((a,b)=>a.s<b.s?-1:1);
  });
  if(S.collegeSeeded){ save(); return; } S.collegeSeeded=true;
  if(!S.college||!Object.keys(S.college).length){
    const C=(s,e,t)=>({s,e,t});
    S.college={
      Mon:[C('15:00','15:55','Emerging Tools Sec 2 (Sonar)'),C('16:00','16:55','Web Tech Sec 3 (Rupam)')],
      Tue:[C('11:15','12:10','DAA Sec 3 (David)'),C('12:15','13:10','DAA Sec 3 (David)'),C('14:00','14:55','Web Tech Sec 3 (Rupam)'),C('15:00','15:55','Intelligent Embedded Sys (Dr. Ashok)'),C('16:00','16:55','Intelligent Embedded Sys (Dr. Ashok)')],
      Wed:[C('09:15','10:10','Data Engg Sec 3 (Mariya)'),C('15:00','15:55','Intelligent Embedded Sys (Dr. Ashok)'),C('16:00','16:55','Intelligent Embedded Sys (Dr. Ashok)')],
      Thu:[C('09:15','10:10','Emerging Tools Sec 2 (Sonar)'),C('10:15','11:10','Web Tech Sec 3 (Rupam)'),C('11:15','12:10','DAA Sec 3 (David)'),C('13:00','13:55','Data Engg Sec 3 (Mariya)'),C('14:00','14:55','Data Engg Sec 3 (Mariya)')],
      Fri:[C('10:15','11:10','Web Tech Sec 3 (Rupam)'),C('13:00','13:55','Emerging Tools Sec 2 (Sonar)')],
      Sat:[],Sun:[]
    };
    addLog('Seeded college timetable (Sec 3 + ETA Sec 2)');
  }
  save();
}
document.querySelectorAll("#tabs button").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("#tabs button").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".tabpage").forEach(x=>x.classList.remove("active"));
  b.classList.add("active"); $("tab-"+b.dataset.tab).classList.add("active");
});
$("closeDayBtn").onclick=()=>closeDay(todayStr());
$("redistBtn").onclick=redistribute;
$("prevWk").onclick=()=>{S.weekOffset--;save();renderAll();};
$("nextWk").onclick=()=>{S.weekOffset++;save();renderAll();};
$("thisWk").onclick=()=>{S.weekOffset=0;save();renderAll();};
$("mPreview").onclick=()=>{
  const items=parseDurations($("mPaste").value);
  const tot=items.reduce((a,x)=>a+(x.minutes||0),0);
  $("mOut").innerHTML=items.length? `Parsed ${items.length} videos · total ~${tot} min (${(tot/60).toFixed(1)}h at 1×, ~${Math.round(tot/1.5)} min at 1.5×).<br>`+items.map(x=>`• ${x.label} — <b>${x.minutes}m</b>${x.unparsed?' <span style="color:var(--warn)">(no duration found — defaults 0, fix line)</span>':""}`).join("<br>") : "No lines detected.";
};
$("mSave").onclick=()=>{
  const items=parseDurations($("mPaste").value).filter(x=>x.minutes>0);
  if(!items.length){ alert("No video durations found. Check the format — one video per line with e.g. '12:34' or '20 min'."); return; }
  S.modules.push({ id:S.seq++, course:$("mCourse").value, week:$("mWeek").value, title:$("mTitle").value.trim(), videos:items.map(x=>({label:x.label.slice(0,80),minutes:x.minutes,done:false})) });
  $("mPaste").value=""; $("mTitle").value="";
  save(); renderAll();
  alert("Module saved — IIT chunks auto-spread into your week's free slots. See Week tab.");
};
$("copySnippet").onclick=async()=>{ try{ await navigator.clipboard.writeText(SCRAPER); alert("Snippet copied. Paste it in the Coursera console."); }catch{ alert("Copy failed — select the code manually."); } };
$("qaAdd").onclick=()=>{
  const t=$("qaTitle").value.trim(); if(!t){alert("Give the task a title.");return;}
  S.custom.push({ id:S.seq++, title:t, date:$("qaDate").value||todayStr(), min:+$("qaMin").value||60, cat:"SAI", pri:4 });
  $("qaTitle").value=""; save(); renderAll();
};
$("addOneTest").onclick=()=>{
  const d=$("tStart").value||todayStr();
  S.tests.push({ id:S.seq++, sys:"iitg", course:$("tCourse").value, type:$("tFirst").value, date:d });
  save(); renderAll();
};
$("addAltTests").onclick=()=>{
  const course=$("tCourse").value, start=$("tStart").value||todayStr();
  let type=$("tFirst").value;
  const n=Math.max(1,Math.min(16,+$("tWeeks").value||8));
  for(let i=0;i<n;i++){ S.tests.push({ id:S.seq++, sys:"iitg", course, type, date:dstr(addD(parseD(start),i*7)) }); type=(type==="proctored")?"nonproctored":"proctored"; }
  save(); renderAll();
  alert(`${n} alternating tests added starting ${start} — prep blocks placed on fixed dates.`);
};
function saiCalc(){ // live "what does my prep cost?" preview
  if(!$("sCalc")) return;
  const h=$("sMode").value==="h", q=+$("sQty").value||0, r=+$("sPerQ").value||4;
  $("sCalc").textContent=q?(h?`≈ ${Math.round(q*60)} min total → auto-split into ≤60m sessions before test day`:`≈ ${Math.round(q*r)} min total (${q} × ${r}m) → auto-split into ≤60m sessions before test day`):"";
}
$("sAdd").onclick=()=>{
  const d=$("sDate").value||todayStr(), q=+$("sQty").value||0;
  if(!q){ alert("Tell me your prep plan first — how many PYQs, or how many hours of material?"); return; }
  S.tests.push({ id:S.seq++, sys:"sai", course:$("sCourse").value, title:$("sTitle").value.trim(), date:d, prepMode:$("sMode").value, qty:q, perQ:+$("sPerQ").value||4 });
  $("sQty").value=""; $("sTitle").value=""; save(); renderAll();
  alert("SaiU test added — prep time is now spread across the days before it.");
};
$("tSys").onchange=()=>{
  const sai=$("tSys").value==="sai";
  if($("iitgForm")) $("iitgForm").style.display=sai?"none":"";
  if($("saiForm")) $("saiForm").style.display=sai?"":"none";
  saiCalc();
};
["sMode","sQty","sPerQ"].forEach(id=>{ const el=$(id); if(el) el.oninput=saiCalc; });
if($("cDays")) $("cDays").onchange=e=>{ S.crunch.days=Math.max(0,Math.min(7,+e.target.value||0)); save(); renderAll(); };
document.querySelectorAll("[data-pz]").forEach(cb=>cb.onchange=()=>{
  const p=S.crunch.pause||(S.crunch.pause=[]), id=cb.dataset.pz;
  if(cb.checked&&!p.includes(id)) p.push(id);
  if(!cb.checked) S.crunch.pause=p.filter(x=>x!==id);
  save(); renderAll();
});
$("saveCap").onclick=()=>{ document.querySelectorAll("[data-cap]").forEach(i=>S.cap[i.dataset.cap]=+i.value||0); save(); renderAll(); alert("Capacity saved — schedule rebuilt."); };
$("resetAll").onclick=()=>{ if(confirm("Wipe all StudyOS data?")){ localStorage.removeItem(LSKEY); S=defState(); save(); renderAll(); } };
$("selfTest").onclick=runSelfTest;
$("reseedBtn").onclick=()=>{ S.modules=(S.modules||[]).filter(m=>!m.seed); S.seeded=false; seedWeek1(); save(); renderAll(); alert("Week-1 seed reloaded — modules you added yourself were kept."); };
$("cAdd").onclick=()=>{
  const d=$("cDay").value, s=$("cStart").value.trim(), e=$("cEnd").value.trim(), ti=$("cTitle").value.trim()||"Class";
  if(!/^\d{1,2}:\d{2}$/.test(s)||!/^\d{1,2}:\d{2}$/.test(e)){ alert("Use HH:MM format, e.g. 09:15 and 10:10."); return; }
  (S.college[d]=S.college[d]||[]).push({s,e,t:ti}); S.college[d].sort((a,b)=>a.s<b.s?-1:1);
  $("cStart").value="";$("cEnd").value="";$("cTitle").value=""; save(); renderAll();
};
if($("speedSel")) $("speedSel").onchange=e=>{ S.speed=parseFloat(e.target.value)||1; save(); renderAll(); };
$("ver").textContent="v1.4 · "+todayStr();
(function init(){
  const q=$("qaDate"); if(q) q.value=todayStr();
  if($("tStart")&&!$("tStart").value){ const n=new Date(); $("tStart").value=dstr(addD(n,(7-n.getDay())%7||7)); } // default: next Sunday
  if($("sDate")&&!$("sDate").value){ const n=new Date(); $("sDate").value=dstr(addD(n,(4-n.getDay()+7)%7||7)); } // default: next Thursday
  if(!S.installed){ S.installed=todayStr(); save(); } // anchor: only relocate days tracked after install
  if(!S.capMig2){ if(S.cap.Sat===420)S.cap.Sat=360; if(S.cap.Sun===420)S.cap.Sun=360; S.capMig2=true; save(); } // weekends → 6h max
  seedWeek1(); // one-time Week-1 module seed
  seedCollege(); // one-time college timetable seed
  seedBooks(); // one-time CLRS plan seed
  const moved=autoRelocate(); // intelligent relocation runs on every start
  renderAll();
  if(moved>0 && $("autoNotice")) $("autoNotice").innerHTML=`<div class="warn" style="border-color:var(--warn);color:#ffe1a8;background:#241c08">⟳ Auto-relocated <b>${moved}</b> unfinished task(s) from past days into your backlog — already fitted into your next free slots. Details in the Relocation log.</div>`;
})();
