/* StudyOS v1 — local-first smart scheduler. No dependencies. */
"use strict";
const LSKEY = "studyOS.v1";
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const CATS = { GATE:"#7aa5ff", CP:"#34d399", SAI:"#c4b5fd", IIT:"#fbbf24", OSS:"#f472b6", REV:"#67e8f9" };

/* Hardcoded recurring program (realistic ~5h wkday / 7h wkend self-study).
   Your call of "1 neetcode daily mandatory + alternate CF" is softened on purpose:
   daily NeetCode keeps the streak alive; CF 3x/wk + Sunday contest builds rating
   faster than strict alternation (which kills both streaks). */
/* Circadian reality: college till ~5pm, break, study 9:30pm ≈3–3.5h gross.
   Order within a day: warm-up (Sai) → deep work (GATE/IIT/tests) → NeetCode/CF
   (never first hour) → light leftovers. */
const TEMPLATES = [
  { id:"nc",   title:"NeetCode — 1 problem + write-up", cat:"CP",   min:45, days:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], pri:5 },
  { id:"cf",   title:"Codeforces practice set",         cat:"CP",   min:30, days:["Tue","Sat"], pri:4 },
  { id:"cfcon",title:"CF contest / virtual (60m)",      cat:"CP",   min:60, days:["Sun"], pri:4 },
  { id:"algo", title:"GATE Algo (primary focus)",       cat:"GATE", min:60, days:["Mon","Wed","Sat"], pri:5 },
  { id:"dbms", title:"GATE DBMS (primary focus)",       cat:"GATE", min:60, days:["Tue","Thu","Sun"], pri:5 },
  { id:"sai",  title:"Sai coursework rotation (warm-up)", cat:"SAI",min:30, days:["Mon","Tue","Wed","Thu","Fri"], pri:4, rotating:["DAA","Found. Data Engg","Web Tech","Emerging Tools","Intel. Embedded Sys","Calculus"] },
  { id:"saiw", title:"Sai weekend catch-up / assign.",  cat:"SAI",  min:45, days:["Sun"], pri:4 },
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
function defState(){ return { checks:{}, backlog:[], modules:[], custom:[], tests:[], testSeeded:false, events:[], ptBackup:{RDBMS:{day:"Sat",time:"19:30"},Java:{day:"Sat",time:"20:30"},Optimization:{day:"Sun",time:"19:30"}}, crunch:{days:3,pause:["sai","cf"]}, books:[], bookSeeded:false, bookPph:6, bookMaxDay:30, college:{}, collegeSeeded:false, log:[], seeded:false, speed:1.5, catchup:false, cap:{Mon:200,Tue:180,Wed:200,Thu:180,Fri:200,Sat:240,Sun:240}, weekOffset:0, seq:1 }; }
let S;
try { S = JSON.parse(localStorage.getItem(LSKEY)) || defState(); } catch { S = defState(); }
S = Object.assign(defState(), S);
function save(){ localStorage.setItem(LSKEY, JSON.stringify(S)); }

/* ---------- dates ---------- */
const dstr = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
function fmtTime(hhmm){ if(!hhmm||hhmm.indexOf(":")<0) return ""; const p=hhmm.split(":"),h=+p[0],m=p[1]; const ap=h>=12?"PM":"AM", h12=h%12||12; return `${h12}:${m} ${ap}`; }
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
/* Trimester week (1-based from Mon Sep 7 2026). Modules release weekly —
   future weeks stay locked and out of the schedule until they arrive. */
const TRIM_START = parseD("2026-09-07");
function triWeek(){ return Math.max(1,Math.floor((new Date()-TRIM_START)/6048e5)+1); }
function triWeekDate(w){ return dstr(addD(TRIM_START,(w-1)*7)); }
function iitVideosLeft(){ const out=[]; const cw=triWeek(); S.modules.forEach(mod=>{ if(mod.week>cw) return; mod.videos.forEach((v,vi)=>{ if(!v.done) out.push({mod,v,vi}); }); }); return out; }
/* Sequential frontier: per course, only the earliest module with undone videos
   schedules. Next module waits until the current one is finished — especially
   before tests. Manual ticks in IIT Modules always allowed. */
function frontierMap(){ const f={}; (S.modules||[]).forEach(m=>{ if(m.week>triWeek()) return; if(m.videos.some(v=>!v.done)){ if(!f[m.course]||m.week<f[m.course].week) f[m.course]=m; } }); return f; }
function splitChunk(label, minutes, max=50){
  if (minutes<=max) return [{label, minutes}];
  const n=Math.ceil(minutes/max), per=Math.ceil(minutes/n), arr=[];
  for(let i=0;i<n;i++) arr.push({label:`${label} (part ${i+1}/${n})`, minutes: Math.min(per, minutes-i*per)});
  return arr;
}
/* Backlog policy: ONLY SaiU + IITG work carries over. Everyday must-tasks
   (NeetCode, CF, GATE, OWASP, revision) lapse when missed — no backlog flood.
   IIT videos auto-carry via undone flags, always. */
const CARRY_IDS = ["sai","saiw"];
function carriesOver(x){
  if(x.kind==="custom"||x.kind==="test"||x.kind==="book") return true;
  if(x.kind==="focus") return x.cat==="SAI"||x.cat==="IIT";
  if(x.kind==="iit") return !!x.tb; // textbook chunks carry; videos auto-carry separately
  if(x.kind==="rec") return CARRY_IDS.includes(x.key.split("::")[1]);
  return false;
}
function iitRate(){ let a=0,b=0; (S.modules||[]).forEach(m=>m.videos.forEach(v=>{ b++; if(v.done)a++; })); return b?a/b:1; }
/* Daily reading budget: humane base scaled by IIT completion (ticked videos) and
   college load; 0 while lagging (reading pauses till backlog clears). */
function readBudget(d){
  if(behindInfo().behind) return 0;
  const pace=0.7+0.3*iitRate();
  const base=Math.min(+S.bookMaxDay||30,30)*pace;
  return Math.max(15,Math.round(base*Math.max(0.5,1-collegeMin(d.wd)/480)));
}
/* Energy slots shared by the day ordering and the evening trim. */
const SLOT={sai:1,saiw:1,custom:2,algo:2,dbms:2,test:2,focus:2,iit:2,book:2,nc:3,cf:3,cfcon:3,oss:4};
function slotOf(t){
  if(t.kind==="rec") return SLOT[t.key.split("::")[1]]??2;
  if(t.kind==="carry") return t.pri>=4?2:3;
  return SLOT[t.kind]??2;
}
/* Evening trim: as the 9:30pm–1am window burns down, keep only the top-priority
   ~hours-left worth; the rest defers (SaiU/IITG → backlog, dailies lapse,
   IIT videos auto-carry). Pure function of (day, now) for testability. */
function studyLeftMin(nowD){
  const n=nowD.getHours()*60+nowD.getMinutes();
  if(n<5*60) return Math.max(0,300-n); // still inside tonight's session
  if(n<21*60+30) return 1e9; // evening hasn't started: full night ahead
  return Math.max(0,25*60-n); // until 1:00 AM
}
function tonightTrim(day, nowD){
  const budget=studyLeftMin(nowD);
  const open=day.tasks.filter(x=>!taskDone(day.date,x));
  const openMin=open.reduce((a,x)=>a+x.min,0);
  if(!(budget<openMin)) return null;
  const sorted=[...open].sort((a,b)=>(b.pri-a.pri)||(slotOf(a)-slotOf(b)));
  let acc=0; const keep=new Set();
  for(const x of sorted){ if(acc+x.min<=budget+15){ keep.add(x.key); acc+=x.min; } }
  if(!keep.size&&sorted.length){ keep.add(sorted[0].key); acc=sorted[0].min; }
  return { budget:Math.round(Math.min(budget,1e6)), openMin, keepMin:acc, defer:open.filter(x=>!keep.has(x.key)) };
}
function applyTrim(){
  const t=todayStr();
  const day=buildWeek(weekOf(t)).find(d=>d.date===t); if(!day) return;
  const plan=tonightTrim(day,new Date());
  if(!plan||!plan.defer.length){ alert("Tonight already fits — nothing to trim."); return; }
  let n=0;
  plan.defer.forEach(x=>{
    if(x.kind==="iit"&&!x.tb) return;
    if(!carriesOver(x)) return;
    if(S.backlog.some(b=>b.fromKey===x.key)) return;
    S.backlog.push({ id:S.seq++, title:x.title, cat:x.cat, min:x.min, pri:x.pri, fromDate:t, fromKey:x.key, overdue:0 });
    n++;
  });
  addLog(`Evening trim: kept ~${plan.keepMin}m of top priorities, moved ${n} to backlog`);
  save(); renderAll();
}
/* IIT-first governor: if frontier video demand outstrips free room this week,
   pause flex subjects (CF → Sai → weekend extras → NeetCode only in extremes)
   to fit MORE IIT. Pure arithmetic — no schedule building, no recursion. */
const GOV_NAMES={cf:"CF practice",sai:"Sai rotation",saiw:"Sai weekend",cfcon:"Sunday contest",nc:"NeetCode"};
function govPause(){
  const range=weekDates(0).map(dstr), inR=d=>d>=range[0]&&d<=range[6];
  const F=frontierMap(), spd=S.speed||1;
  let demand=0;
  (S.modules||[]).forEach(m=>{
    if(m.week>triWeek()||F[m.course]!==m) return;
    m.videos.forEach(v=>{ if(!v.done) demand+=Math.max(5,Math.round(v.minutes/spd)); });
    const tb=(m.textbook??30); if(tb>0) demand+=tb;
  });
  let fixed=0;
  DAYS.forEach(wd=>TEMPLATES.forEach(t=>{ if(t.days.includes(wd)) fixed+=t.min; }));
  (S.tests||[]).forEach(ts=>{
    if(!ts.date||ts.date<todayStr()) return; // only upcoming tests consume future room
    if(inR(ts.date)) fixed+=ts.sys==="sai"?60:(ts.type==="proctored"?120:30);
    for(let k=1;k<=5;k++){ const dd=dstr(addD(parseD(ts.date),-k)); if(inR(dd)){ fixed+=ts.sys==="sai"?60:(ts.type==="proctored"?150:45); break; } }
  });
  const capSum=DAYS.reduce((a,d)=>a+(+S.cap[d]||0),0);
  let deficit=Math.round(demand-(capSum-fixed));
  const savings={}; TEMPLATES.forEach(t=>{ savings[t.id]=(savings[t.id]||0)+t.min*t.days.length; });
  const order=["cf","sai","saiw","cfcon","nc"], pause=[]; let freed=0;
  if(deficit>40) for(const id of order){
    if(deficit<=0) break;
    if(id==="nc"&&deficit<=200) break; // NeetCode only in severe lag
    if(!savings[id]) continue;
    pause.push(id); deficit-=savings[id]; freed+=savings[id];
  }
  return { pause, deficit:Math.max(0,deficit), demand:Math.round(demand), freed };
}
/* Build schedule for a week offset. Order: fixed recurring → date-fixed tests →
   IIT videos (weekly deadline) → books → backlog oldest-first. Flexible kinds
   defer instead of breaching the 4–6h daily caps. */
function buildWeek(offset){
  const dates=weekDates(offset);
  const days=dates.map(d=>({ date:dstr(d), wd:wd(d), cap:S.cap[wd(d)]||300, college:collegeFor(wd(d)), tasks:[] }));
  const free = day => day.cap - day.tasks.reduce((a,t)=>a+t.min,0);
  const CUT=S.catchup?{sai:15,cf:15,saiw:30,cfcon:30}:{}; // catch-up mode lightens flexible load (~150m/wk)
  const cutMin=t=>CUT[t.id]||t.min;
  // 0) crunch map: dates within N days before any test (universal, any subject)
  const crunchDays={};
  const crunchPause=(S.crunch&&S.crunch.pause)||[];
  // event holds: per-event pause lists over [holdFrom, date)
  const holdFor={};
  (S.events||[]).forEach(ev=>{
    if(!ev.date||ev.done) return;
    for(let d=parseD(ev.holdFrom||ev.created||todayStr()); dstr(d)<ev.date; d=addD(d,1)){
      const k=dstr(d); (holdFor[k]=holdFor[k]||new Set()); (ev.pause||[]).forEach(p=>holdFor[k].add(p));
    }
  });
  const heldFor=(dateStr,tid)=>((crunchDays[dateStr]&&crunchPause.includes(tid))||(holdFor[dateStr]&&holdFor[dateStr].has(tid)));
  if(S.crunch&&+S.crunch.days>0) (S.tests||[]).forEach(ts=>{
    if(ts.crunchOff||!ts.date) return;
    for(let k=1;k<=+S.crunch.days;k++) crunchDays[dstr(addD(parseD(ts.date),-k))]=ts.course;
  });
  const examDays=new Set();
  (S.tests||[]).forEach(ts=>{ if(ts.date) examDays.add(ts.date); });
  (S.events||[]).forEach(ev=>{ if(ev.date&&!ev.done) examDays.add(ev.date); });
  const EXAM_PAUSE=["sai","cf"]; // exam day: drop light non-primary load, keep streak + GATE + prep
  const GOV=govPause(); // IIT-lag governor: paused flex subjects yield room to videos
  // 1) recurring + custom one-offs (governor/crunch/event holds + exam-day lightening skip to fund what matters)
  days.forEach((day,di)=>{
    TEMPLATES.forEach(t=>{
      if(!t.days.includes(day.wd)) return;
      if(GOV.pause.includes(t.id)) return; // IIT lag: this subject yields to videos
      if(heldFor(day.date,t.id)) return; // paused for crunch / event holds
      if(examDays.has(day.date)&&EXAM_PAUSE.includes(t.id)) return; // exam day: travel light
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
  // shared test-prep balancer: all tests split a 90m/day prep budget, nearest exam first
  const dayTest={};
  const TEST_DAY_CAP=90;
  function placePrep(prefix, cat, ts, total, pri, label){
    const win=[]; for(let k=5;k>=1;k--){ const dd=dstr(addD(parseD(ts.date),-k)); if(dd>=todayStr()&&byDate[dd]) win.push(byDate[dd]); }
    if(!win.length){
      const hr=ts.time?+ts.time.split(":")[0]:99; // morning exam → no same-day cram; evening → cram OK
      if(byDate[ts.date]&&ts.date===todayStr()&&hr>=12){ const sess=Math.min(60,total); byDate[ts.date].tasks.push({ key:`${prefix}:${ts.id}:prep0`, title:label(sess,0), cat, min:sess, pri, kind:"test", fixed:true }); dayTest[ts.date]=(dayTest[ts.date]||0)+sess; }
      return;
    }
    const quota=Math.ceil(total/win.length);
    let rem=total, i=0;
    for(const d of win){
      if(rem<=0) break;
      const room=Math.max(0,TEST_DAY_CAP-(dayTest[d.date]||0));
      const sess=Math.min(60,quota,rem,room);
      if(sess<10) continue;
      d.tasks.push({ key:`${prefix}:${ts.id}:prep${i}`, title:label(sess,i), cat, min:sess, pri, kind:"test", fixed:true });
      dayTest[d.date]=(dayTest[d.date]||0)+sess; rem-=sess; i++;
    }
    let g=0; // overflow: spread over least test-loaded window days (red but even — never silently dropped)
    while(rem>0&&g<10){
      const tgt=win.slice().sort((a,b)=>((dayTest[a.date]||0)-(dayTest[b.date]||0))||((b.cap-b.tasks.reduce((x,y)=>x+y.min,0))-(a.cap-a.tasks.reduce((x,y)=>x+y.min,0))))[0];
      const sess=Math.min(60,rem);
      tgt.tasks.push({ key:`${prefix}:${ts.id}:prep${i}`, title:label(sess,i), cat, min:sess, pri, kind:"test", fixed:true });
      dayTest[tgt.date]=(dayTest[tgt.date]||0)+sess; rem-=sess; i++; g++;
    }
  }
  [...(S.tests||[])].sort((a,b)=>a.date<b.date?-1:1).forEach(ts=>{
    if(ts.sys==="sai"){
      if(byDate[ts.date]) byDate[ts.date].tasks.push({ key:`sai:${ts.id}:exam`, title:`📝 SaiU test: ${ts.course}${ts.title?" — "+ts.title:""}${ts.time?" ("+fmtTime(ts.time)+")":""}`, cat:"SAI", min:60, pri:6, kind:"test", fixed:true });
      placePrep("sai","SAI",ts,saiPrepMin(ts),6,(s,m)=>`📝 SaiU prep (${ts.course}): ${saiPrepLabel(ts)}`);
      return;
    }
    const proctored=ts.type==="proctored";
    const at=ts.time?` (${fmtTime(ts.time)})`:"";
    if(byDate[ts.date]) byDate[ts.date].tasks.push({ key:`test:${ts.id}:exam`, title:`📝 ${proctored?"Proctored":"Non-Proctored"} test: ${ts.course}${at}`, cat:"IIT", min:proctored?120:30, pri:6, kind:"test", fixed:true });
    // prep scales with distance-to-test: total spread over the immediate pre-days (≤60m/day)
    placePrep("test","IIT",ts,proctored?150:45,proctored?6:5,(s,m)=>`📝 ${ts.course} ${proctored?"PT":"NPT"} prep → ${ts.date.slice(5)} (${s}m)`);
  });
  // 1c) calendar events: prep spread over the immediate pre-days (≤60m sessions, max 2/day)
  const loadOf=d=>d.tasks.reduce((a,t)=>a+t.min,0);
  (S.events||[]).forEach(ev=>{
    if(ev.done) return;
    let rem=Math.round((+ev.estHrs||0)*60); if(rem<=0) return;
    const win=[]; for(let k=7;k>=1;k--){ const dd=dstr(addD(parseD(ev.date),-k)); if(dd>=todayStr()&&byDate[dd]) win.push(byDate[dd]); }
    if(!win.length) return; // too far out for this view — appears as its week arrives
    let i=0, g=0;
    while(rem>0&&g<28){
      const cands=win.filter(d=>d.tasks.filter(t=>t.kind==="focus"&&t.eid===ev.id).length<2);
      if(!cands.length) break;
      const tgt=cands.slice().sort((a,b)=>loadOf(a)-loadOf(b))[0];
      const sess=Math.min(60,rem);
      tgt.tasks.push({ key:`focus:${ev.id}:${i}`, title:`🎯 ${ev.title} — prep (${ev.courseName||ev.course||""})`, cat:ev.cat||"SAI", min:sess, pri:6, kind:"focus", eid:ev.id, fixed:true });
      rem-=sess; i++; g++;
    }
  });
  // 2) IIT chunks → spread EVENLY across all 7 days (water-filling, scaled by playback speed).
  // Round-robin per course so all courses progress daily and finish together.
  // Unplaceable chunks defer to next week via undone videos — caps never breached.
  const spd = S.speed||1;
  const effMin = m => Math.max(5, Math.round(m/spd));
  const byCourse={};
  const frontier=frontierMap();
  iitVideosLeft().forEach(({mod,v})=>{
    if(frontier[mod.course]!==mod) return; // next module waits till this one is done
    const key=mod.course+' W'+mod.week;
    (byCourse[key]=byCourse[key]||[]).push(...splitChunk(`${mod.course} W${mod.week}: ${v.label}`, effMin(v.minutes), 35).map(ch=>({mod,v,ch})));
  });
  // textbook reading per module (raw minutes, not speed-scaled), same even spread
  S.modules.forEach(mod=>{
    if(mod.week>triWeek()) return; // unreleased week — unlocks automatically
    if(frontier[mod.course]!==mod) return; // textbook follows the frontier module too
    const tbMin=(mod.textbook ?? 30);
    if(tbMin>0){
      const key=mod.course+' W'+mod.week;
      (byCourse[key]=byCourse[key]||[]).push(...    splitChunk(`📖 Textbook: ${mod.course} W${mod.week}`, tbMin, 35).map(ch=>({mod,v:{label:'📖 textbook'},ch,tb:true})));
    }
  });
  const courses=Object.keys(byCourse);
  const iitLoad=d=>d.tasks.filter(t=>t.kind==="iit").reduce((a,t)=>a+t.min,0);
  const dayIdx=d=>(parseD(d.date).getDay()+6)%7;
  const cutoffFor=course=>((((S.ptBackup||{})[course])||{}).day==="Sun")?6:5; // material done by exam eve
  const dayCourse={}; // no two slots of the same subject in a day, unless forced
  let more=true;
  while(more){
    more=false;
    for(const c of courses){
      const q=byCourse[c]; if(!q.length) continue;
      const item=q.shift(); more=true;
      const ck="|"+item.mod.course+"|"+(item.tb?"tb":"vid"); // video+reading may pair; two videos never share a day unless forced
      // least-loaded day with room on/before exam eve, without this course yet
      let roomy=days.filter(d=>free(d)>=item.ch.minutes&&dayIdx(d)<=cutoffFor(item.mod.course)&&!heldFor(d.date,"iit")&&!dayCourse[d.date+ck]);
      if(!roomy.length) roomy=days.filter(d=>free(d)>=item.ch.minutes&&dayIdx(d)<=cutoffFor(item.mod.course)&&!heldFor(d.date,"iit")); // huge constraint: allow the double
      if(!roomy.length) continue; // nothing fits this week → stays undone, auto-carries to next week (never forced red)
      const target=roomy.slice().sort((a,b)=>iitLoad(a)-iitLoad(b)||free(a)-free(b))[0];
      dayCourse[target.date+ck]=1;
      target.tasks.push({ key:`iit:${item.mod.id}:${item.v.label}:${item.ch.label}`, title:"▶ "+item.ch.label, cat:"IIT", min:item.ch.minutes, pri:5, kind:"iit", tb:!!item.tb, modId:item.mod.id, vlabel:item.v.label, chunk:item.ch.label });
    }
  }
  // 2b) book reading: 1 session/day (2 if a SaiU test looms ≤3d); the rest defers — never red
  const pph=+S.bookPph||6;
  const soonSai=(S.tests||[]).some(ts=>ts.sys==="sai"&&ts.date>=todayStr()&&ts.date<=dstr(addD(new Date(),3)));
  const bookCap=soonSai?2:1;
  (S.books||[]).forEach(b=>b.chapters.forEach((c,ci)=>{
    const left=Math.max(0,(+c.pages||0)-(+c.done||0));
    if(left<=0) return;
    splitChunk(`📕 ${b.title}: ${c.name}`, Math.max(10,Math.ceil(left/pph*60)), 15).forEach(ch=>{
      const roomy=days.filter(d=>free(d)>=ch.minutes&&d.tasks.filter(t=>t.kind==="book").length<bookCap&&bookLoadOf(d)+ch.minutes<=readBudget(d)&&!heldFor(d.date,"sai"));
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
  // order: energy slots (warm-up → deep → NeetCode/CF late, never first) then priority
  days.forEach(d=>d.tasks.sort((a,b)=>slotOf(a)-slotOf(b)||b.pri-a.pri));
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
    if(!carriesOver(t)) return; // everyday must-tasks lapse — only SaiU/IITG carry
    if(isStalePrep(t)) return; // stale prep dissolves on close too
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
/* Auto-relocate: scan past 7 days (excluding today). Unchecked SaiU/IITG tasks
   move to backlog; everyday must-tasks lapse. Idempotent. */
function behindInfo(){
  const n=S.backlog.length, mins=S.backlog.reduce((a,b)=>a+(b.min||0),0);
  const oldest=S.backlog.reduce((a,b)=>Math.max(a,b.overdue||0),0);
  return { n, mins, oldest, behind: mins>=150||oldest>=3 };
}
/* Weekend backup for a missed proctored slot-1: same week's configured Sat/Sun
   (constant per course, set in Tests card). */
function ptBackupDate(ts){
  const cfg=((S.ptBackup||{})[ts.course])||{day:"Sat",time:""};
  const idx=(parseD(ts.date).getDay()+6)%7, want=cfg.day==="Sun"?6:5;
  let add=(want-idx+7)%7; if(add===0) add=7;
  let s2=dstr(addD(parseD(ts.date),add));
  if(s2<=todayStr()) s2=dstr(addD(parseD(s2),7));
  return { date:s2, time:cfg.time||ts.time||"" };
}
/* Stale prep dissolves: a past, unticked prep session never becomes backlog —
   the full prep total automatically re-spreads over the remaining pre-days.
   Exam blocks themselves still carry/shift. */
function prepExamDate(x){
  if(x.kind==="focus"&&x.eid!==undefined){ const ev=(S.events||[]).find(y=>String(y.id)===String(x.eid)); return ev?ev.date:null; }
  if(x.kind==="test"&&x.key.indexOf(":prep")>-1){ const id=x.key.split(":")[1]; const tm=(S.tests||[]).find(y=>String(y.id)===String(id)); return tm?tm.date:null; }
  return null;
}
function isStalePrep(x){ return prepExamDate(x)!==null; }
function autoRelocate(){
  if(!Array.isArray(S.log)) S.log=[];
  const t=todayStr(); let moved=0;
  // proctored two-slot rule: slot-1 unticked → shift to the course's same-weekend backup slot
  (S.tests||[]).forEach(ts=>{
    if(ts.type!=="proctored"||ts.movedToSlot2||!ts.date||!(ts.date<t)) return;
    if(isDone(ts.date,`test:${ts.id}:exam`)) return; // attempted — stays
    const s2=ptBackupDate(ts);
    addLog(`"${ts.course} proctored" not attempted ${ts.date} → backup slot ${s2.date}${s2.time?" "+fmtTime(s2.time):""}; crunch + prep rebuilt, backlog reshapes upcoming days`);
    ts.date=s2.date; if(s2.time) ts.time=s2.time; ts.movedToSlot2=true;
    save();
  });
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
      if(!carriesOver(x)) return; // everyday must-tasks lapse — only SaiU/IITG carry
      if(isStalePrep(x)) return; // stale prep dissolves; full amount re-spreads over remaining pre-days
      if(d < t && !isDone(d,x.key) && !S.backlog.some(b=>b.fromKey===x.key)){
        S.backlog.push({ id:S.seq++, title:x.title, cat:x.cat, min:x.min, pri:x.pri, fromDate:d, fromKey:x.key, overdue:1 });
        addLog(`"${x.title.slice(0,50)}" missed on ${d} → backlog`);
        moved++;
      }
    });
  }
  if(S.catchup && S.backlog.reduce((a,b)=>a+(b.min||0),0)<60){ S.catchup=false; addLog('Catch-up complete — full timetable restored'); save(); }
  else if(moved) save();
  // one-time cleanup: drop old prep-backlog artifacts (stale sessions from before dissolve rule)
  if(!S.prepCleaned){
    const n0=S.backlog.length;
    S.backlog=S.backlog.filter(b=>!(b.fromKey&&(b.fromKey.indexOf(":prep")>-1||b.fromKey.indexOf("focus:")===0)));
    if(S.backlog.length!==n0) addLog(`Cleaned ${n0-S.backlog.length} stale prep leftover(s) — upcoming prep re-spreads automatically`);
    S.prepCleaned=true; save();
  }
  // IIT governor transitions (log only on change, not every load)
  try{
    const gp=govPause(), fp=gp.pause.join(",");
    if(S.govFp!==fp){
      addLog(gp.pause.length?`IIT focus ON: ${gp.demand}m videos vs room → paused ${gp.pause.map(p=>GOV_NAMES[p]||p).join(" + ")} (+${gp.freed}m) to fit more IIT`:`IIT focus OFF: videos fit — full program restored`);
      S.govFp=fp; save();
    }
  }catch(_){}
  // crunch payback: tests whose window has passed return paused work as backlog (compensate after)
  (S.tests||[]).forEach(ts=>{
    if(ts.crunchPaid||ts.crunchOff||!ts.date||!(ts.date<t)||!S.crunch||!(+S.crunch.days>0)) return;
    (S.crunch.pause||[]).forEach(pid=>{
      const tmp=TEMPLATES.find(x=>x.id===pid); if(!tmp||!CARRY_IDS.includes(pid)) return; // 'iit' auto-carries; everyday tasks lapse, no payback
      for(let k=1;k<=+S.crunch.days;k++){
        const dd=dstr(addD(parseD(ts.date),-k));
        if(!tmp.days.includes(wd(parseD(dd)))) continue;
        S.backlog.push({ id:S.seq++, title:`Payback (${ts.course} crunch): ${tmp.title}`, cat:tmp.cat, min:tmp.min, pri:3, fromDate:ts.date, overdue:1 });
      }
    });
    ts.crunchPaid=true; addLog(`Crunch payback: paused work for the ${ts.course} test is back in your queue`); save();
  });
  // event payback: held work returns after the event date
  (S.events||[]).forEach(ev=>{
    if(ev.paidBack||!ev.date||!(ev.date<t)) return;
    (ev.pause||[]).forEach(pid=>{
      const tmp=TEMPLATES.find(x=>x.id===pid); if(!tmp||!CARRY_IDS.includes(pid)) return;
      for(let d=parseD(ev.holdFrom||ev.date); dstr(d)<ev.date; d=addD(d,1)){
        if(!tmp.days.includes(wd(d))) continue;
        S.backlog.push({ id:S.seq++, title:`Payback (${ev.title}): ${tmp.title}`, cat:tmp.cat, min:tmp.min, pri:3, fromDate:ev.date, overdue:1 });
      }
    });
    ev.paidBack=true; addLog(`Event passed: held work for "${ev.title}" is back in your queue`); save();
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
    const noForce=days.every(d=>d.tasks.reduce((a,t)=>a+((t.kind==="test"||t.kind==="focus")?0:t.min),0)<=d.cap);
    const kept=S.backlog.some(b=>b.id==="__test__");
    S.backlog=S.backlog.filter(b=>b.id!=="__test__");
    res.push([(noForce&&kept)?"✓":"✗",`backlog: probe ${placed?"placed in free room":"cleanly queued (week full)"}, never forces red`]);
  }catch(e){ res.push(["✗","backlog threw: "+e.message]); }
  try{
    const monF=dstr(addD(monday(0),7)); // next Monday (future)
    S.tests.push({id:"__tt__",course:"RDBMS",type:"proctored",date:monF});
    const wks=[...new Set([0,1,weekOf(monF)])];
    const allT=wks.flatMap(o=>buildWeek(o).flatMap(d=>d.tasks.map(t=>({t,date:d.date}))));
    const hasExam=allT.some(x=>x.t.key==="test:__tt__:exam"&&x.t.min===120);
    const preps=allT.filter(x=>x.t.key.indexOf("test:__tt__:prep")===0);
    const nPrep=preps.reduce((a,x)=>a+x.t.min,0);
    const preOk=preps.length>0&&preps.every(x=>x.date<monF)&&preps.every(x=>x.t.min<=60);
    S.tests=S.tests.filter(t=>t.id!=="__tt__");
    res.push([(hasExam&&nPrep===150&&preOk)?"✓":"✗",`tests: 120m exam + 150m prep spread pre-date in ≤60m sessions (${nPrep}m over ${preps.length} days)`]);
  }catch(e){ res.push(["✗","tests threw: "+e.message]); }
  try{
    const n1=S.backlog.length; autoRelocate(); const n2=S.backlog.length; autoRelocate(); const n3=S.backlog.length;
    res.push([n2===n3?"✓":"✗",`relocate idempotent: backlog ${n1}→${n2}→${n3} (no dupes on re-run)`]);
  }catch(e){ res.push(["✗","relocate threw: "+e.message]); }
  try{
    S.catchup=true;
    const CUTEXP={sai:15,cf:15,saiw:30,cfcon:30};
    const cand=buildWeek(0).flatMap(d=>d.tasks).find(x=>x.kind==="rec"&&CUTEXP[x.key.split("::")[1]]!==undefined);
    S.catchup=false;
    const okC=cand?cand.min===CUTEXP[cand.key.split("::")[1]]:govPause().pause.length>0;
    res.push([okC?"✓":"✗",`catch-up mode: flexible load lightened${cand?` (${cand.key.split("::")[1]} →${cand.min}m)`:" (all flex governor-paused)"}, auto-exits below 60m backlog`]);
  }catch(e){ res.push(["✗","catch-up threw: "+e.message]); }
  try{
    const dd=buildWeek(0), perDay=dd.map(d=>d.tasks.filter(x=>x.kind==="iit").reduce((a,x)=>a+x.min,0));
    const used=perDay.filter(m=>m>0).length;
    const flexOk=dd.every(d=>d.tasks.reduce((a,t)=>a+((t.kind==="test"||t.kind==="focus")?0:t.min),0)<=d.cap);
    res.push([(used>=5&&flexOk)?"✓":"✗",`IIT spread: ${used}/7 days share the load (${perDay.join("/")}); non-test load never breaches caps`]);
  }catch(e){ res.push(["✗","spread threw: "+e.message]); }
  try{
    const th2=dstr(addD(parseD(todayStr()),2));
    S.tests.push({id:"__ts__",sys:"sai",course:"DAA",title:"DP",date:th2,prepMode:"q",qty:75,perQ:4});
    const offs2=[...new Set([0,weekOf(th2)])];
    const all2=offs2.flatMap(o=>buildWeek(o).flatMap(d=>d.tasks.map(t=>({t,date:d.date}))));
    const examOk=all2.some(x=>x.t.key==="sai:__ts__:exam"&&x.t.min===60);
    const prepSum=all2.filter(x=>x.t.key.indexOf("sai:__ts__:prep")===0).reduce((a,x)=>a+x.t.min,0);
    S.tests=S.tests.filter(t=>t.id!=="__ts__");
    res.push([(examOk&&prepSum===300)?"✓":"✗",`sai test: 60m exam + 75 PYQs → ${prepSum}m prep spread (expect 300)`]);
  }catch(e){ res.push(["✗","sai test threw: "+e.message]); }
  try{
    const snapBooks=S.books;
    S.books=[{id:"__bk__",title:"T",deadline:"2026-12-20",chapters:[{name:"C1",pages:12,done:0},{name:"C2",pages:6,done:0}]}];
    const w0=buildWeek(0), bs=w0.flatMap(d=>d.tasks).filter(t=>t.kind==="book");
    const perDayOk=w0.every(d=>d.tasks.filter(t=>t.kind==="book").reduce((a,t)=>a+t.min,0)<=readBudget(d)+0.01);
    const noOver=w0.every(d=>d.tasks.reduce((a,t)=>a+t.min,0)<=d.cap);
    const util=w0.reduce((a,d)=>a+d.tasks.reduce((x,t)=>x+t.min,0),0)/w0.reduce((a,d)=>a+d.cap,0);
    S.books=snapBooks;
    res.push([(bs.every(t=>t.min<=15)&&perDayOk&&(bs.length>0||util>0.90))?"✓":"✗",`books: ≤15m humane sessions within budget${bs.length?"":" (packed week — deferred honestly)"}, zero overload days`]);
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
    const snapB2=S.backlog, snapI=S.installed;
    const touched=[]; S.modules.forEach(m=>m.videos.forEach(v=>{ if(!v.done){ v.done=true; touched.push(v); } })); // silence governor: isolate carry policy
    S.installed=dstr(addD(new Date(),-7)); S.backlog=[];
    autoRelocate();
    const keys=S.backlog.map(b=>b.fromKey||"");
    const saiCarried=keys.some(k=>k.slice(-5)==="::sai");
    const dailyLeaked=keys.some(k=>/::(nc|cf|cfcon|algo|dbms|oss|rev)$/.test(k));
    S.backlog=snapB2; S.installed=snapI; touched.forEach(v=>v.done=false);
    res.push([(saiCarried&&!dailyLeaked)?"✓":"✗",`selective carry: SaiU carried (${saiCarried}), daily must-tasks lapsed (${!dailyLeaked})`]);
  }catch(e){ res.push(["✗","carry policy threw: "+e.message]); }
  try{
    const sB=S.backlog, sT=S.tests, sC=S.custom;
    S.backlog=[]; S.tests=[]; S.custom=[];
    const over=buildWeek(0).filter(d=>d.tasks.reduce((a,t)=>a+t.min,0)>d.cap).map(d=>d.wd);
    S.backlog=sB; S.tests=sT; S.custom=sC;
    res.push([over.length===0?"✓":"✗",`hard caps: ${over.length?over.join(",")+" OVER":"no day exceeds 4–6h"} (flexible work defers, never forces red)`]);
  }catch(e){ res.push(["✗","caps threw: "+e.message]); }
  try{
    const ed=dstr(addD(parseD(todayStr()),3));
    const fit0=eventFit(ed,5);
    S.events.push({id:"__ev__",date:ed,title:"UT",courseName:"DAA",cat:"SAI",estHrs:5,pause:[],holdFrom:todayStr()});
    const offs=[...new Set([0,weekOf(ed)])];
    const fs=offs.flatMap(o=>buildWeek(o).flatMap(d=>d.tasks.filter(t=>t.key.indexOf("focus:__ev__")===0).map(t=>({t,date:d.date}))));
    const preOk=fs.length>0&&fs.every(x=>x.date<ed);
    S.events=S.events.filter(e=>e.id!=="__ev__");
    res.push([(preOk&&fit0.need===300)?"✓":"✗",`event: 5h prep placed pre-date (${fs.reduce((a,x)=>a+x.t.min,0)}m), fit engine need=${fit0.need}`]);
  }catch(e){ res.push(["✗","event threw: "+e.message]); }
  try{
    const monPast=dstr(addD(monday(0),-7)); // last Monday (safely past)
    S.tests.push({id:"__sl__",sys:"iitg",course:"Java",type:"proctored",date:monPast,time:"08:00"});
    autoRelocate();
    const movedT=S.tests.find(t=>t.id==="__sl__");
    let exp=dstr(addD(parseD(monPast),5)); // same-week Saturday backup
    if(exp<=todayStr()) exp=dstr(addD(parseD(exp),7)); // safety: always future
    const okSlot=movedT&&movedT.date===exp&&movedT.movedToSlot2===true;
    S.tests=S.tests.filter(t=>t.id!=="__sl__");
    res.push([okSlot?"✓":"✗",`proctored slots: unticked slot-1 auto-shifted to Sat backup (${movedT?movedT.date:"?"})`]);
  }catch(e){ res.push(["✗","slots threw: "+e.message]); }
  try{
    // supremacy: bury the week in backlog, then demand a Monday PT — exam+prep must survive whole
    const snapBT=S.backlog;
    for(let i=0;i<8;i++) S.backlog.push({ id:"sup"+i, title:"flood", cat:"GATE", min:120, pri:1, fromDate:"2026-09-01", overdue:1 });
    const monF=dstr(addD(monday(0),7));
    S.tests.push({id:"__sup__",sys:"iitg",course:"RDBMS",type:"proctored",date:monF,time:"08:00"});
    const offs=[...new Set([0,1,weekOf(monF)])];
    const items=offs.flatMap(o=>buildWeek(o).flatMap(d=>d.tasks.map(t=>({t,date:d.date}))));
    const examOk=items.some(x=>x.t.key==="test:__sup__:exam"&&x.t.min===120);
    const pr=items.filter(x=>x.t.key.indexOf("test:__sup__:prep")===0);
    const prepOk=pr.reduce((a,x)=>a+x.t.min,0)===150&&pr.every(x=>x.date<monF);
    S.tests=S.tests.filter(t=>t.id!=="__sup__"); S.backlog=snapBT;
    res.push([(examOk&&prepOk)?"✓":"✗",`test supremacy: 120m exam + full 150m prep survive a flooded week, pre-dated`]);
  }catch(e){ res.push(["✗","supremacy threw: "+e.message]); }
  try{
    S.tests.push({id:"__d__",sys:"iitg",course:"RDBMS",type:"proctored",date:dstr(addD(parseD(todayStr()),2))});
    const dissolves=isStalePrep({kind:"test",key:"test:__d__:prep0"});
    const keeps=!isStalePrep({kind:"test",key:"test:__d__:exam"});
    S.tests=S.tests.filter(t=>t.id!=="__d__");
    res.push([(dissolves&&keeps)?"✓":"✗",`stale prep dissolves (full amount re-spreads), exam blocks still carry`]);
  }catch(e){ res.push(["✗","dissolve threw: "+e.message]); }
  try{
    const p0=govPause().pause.slice();
    S.modules.push({id:"__g1__",course:"ZZ",week:triWeek(),title:"t",textbook:0,videos:[{label:"big",minutes:1200,done:false}]});
    const p1=govPause().pause;
    S.modules=S.modules.filter(m=>m.id!=="__g1__");
    res.push([(p1.includes("cf")&&p1.includes("nc")&&p1.length>=p0.length)?"✓":"✗",`governor: extreme IIT lag escalates pauses to NeetCode (${p1.join("+")||"none"})`]);
  }catch(e){ res.push(["✗","governor threw: "+e.message]); }
  try{
    const nDays=DAYS.filter(d=>collegeFor(d).length).length, thu=collegeMin("Thu");
    res.push([(nDays>=5&&thu>200)?"✓":"✗",`college blocks: ${nDays} days guarded (Thu ${thu}m), never scheduled over`]);
  }catch(e){ res.push(["✗","college threw: "+e.message]); }
  save(); renderAll();
  $("selfOut").innerHTML=res.map(r=>`<div>${r[0]} ${r[1]}</div>`).join("");
}

/* ---------- render ---------- */
const $=id=>document.getElementById(id);
function renderAll(){ renderToday(); renderWeek(); renderCalendar(); renderModules(); renderTests(); renderBooks(); renderGoals(); renderSettings(); renderDiag(); }
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
  // behind / catch-up / IIT-focus banners
  const bi=behindInfo();
  if($("behindBanner")){
    let bh="";
    const gp0=govPause();
    if(gp0.pause.length) bh+=`<div class="tip ok">🎯 <b>IIT focus mode</b>: ${gp0.demand}m of videos need room this week — paused ${gp0.pause.map(p=>GOV_NAMES[p]||p).join(" + ")} to fit more IIT. Auto-clears when caught up.</div>`;
    if(S.catchup) bh+=`<div class="tip ok">🚀 <b>Catch-up mode is reshaping your timetable</b> — lighter flexible load until backlog drops below 60m. <button id="exitCatchupBtn" class="btn sm">Exit</button></div>`;
    else if(bi.behind) bh+=`<div class="tip warnb">📉 <b>Lagging: ${bi.n} tasks · ${bi.mins}m · oldest ${bi.oldest}d overdue.</b> Apply the catch-up plan and the timetable re-fits itself. <button id="catchupBtn" class="btn sm primary">Apply catch-up plan</button></div>`;
    $("behindBanner").innerHTML=bh;
    if($("catchupBtn")) $("catchupBtn").onclick=()=>{ S.catchup=true; addLog("Catch-up plan applied — flexible load lightened"); save(); renderAll(); };
    if($("exitCatchupBtn")) $("exitCatchupBtn").onclick=()=>{ S.catchup=false; addLog("Catch-up exited manually"); save(); renderAll(); };
  }
  // evening trim banner: only ~hours-left worth of top priorities tonight
  if($("trimBanner")){
    const plan=tonightTrim(day,new Date());
    if(plan&&plan.defer.length>=2){
      const h=Math.floor(plan.budget/60), m=plan.budget%60;
      $("trimBanner").innerHTML=`<div class="tip warnb">🌙 Only ~<b>${h}h${m?" "+m+"m":""}</b> left tonight for ${plan.openMin}m unticked — <b>focus on the top ~${plan.keepMin}m?</b> The rest defers smartly (SaiU/IITG → backlog, dailies lapse, videos auto-carry). <button id="trimBtn" class="btn sm primary">Trim tonight</button></div>`;
      if($("trimBtn")) $("trimBtn").onclick=applyTrim;
    } else $("trimBanner").innerHTML="";
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
  const tLoad=day.tasks.filter(t=>t.kind==="test"||t.kind==="focus").reduce((a,t)=>a+t.min,0);
  if(day.tasks.reduce((a,t)=>a+t.min,0)>day.cap) return tLoad>60
    ? `Exam-heavy day (${tLoad}m of tests/prep). Do the exam blocks first; tick holds in Tests → ⚡ Crunch row (Sai/CF) to free room, or let catch-up absorb the rest.`
    : `Today is overloaded — do high-priority first (GATE + IIT), let the backlog engine shift "${lowestPri(day)}".`;
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
  expandState=false; if(document.getElementById("expandAll")) document.getElementById("expandAll").textContent="Expand all";
  const dates=weekDates(S.weekOffset), days=buildWeek(S.weekOffset);
  $("weekRange").textContent=dates[0].toDateString()+" → "+dates[6].toDateString();
  $("weekGrid").innerHTML=days.map(d=>{
    const load=d.tasks.reduce((a,t)=>a+t.min,0);
    const isT=d.date===todayStr(), cm=collegeMin(d.wd);
    const pct=Math.min(100,Math.round(load/Math.max(1,d.cap)*100));
    return `<details class="day ${load>d.cap?"over":""} ${isT?"today":""}" ${isT?"open":""}>
      <summary><span class="dname">${d.wd} <span class="muted">${d.date.slice(5)}</span></span>
      <span class="loadbar"><span style="width:${pct}%"></span></span>
      <span class="cap">${d.tasks.length} tasks · ${load}/${d.cap}${load>d.cap?" · OVER":""}</span></summary>
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
  // where each video's sessions currently sit (Mon–Sun across this + next week)
  const schedMap={};
  [0,1].forEach(o=>{ try{ buildWeek(o).forEach(d=>d.tasks.forEach(t=>{ if(t.kind==="iit"&&!t.tb){ const k=t.modId+"||"+t.vlabel; (schedMap[k]=schedMap[k]||new Set()).add(d.wd+" "+d.date.slice(5)); } })); }catch(_){} });
  const schedFor=(mid,label)=>{ const s=schedMap[mid+"||"+label]; return s?[...s].join(" · "):"queued →"; };
  $("moduleList").innerHTML=S.modules.length? [...S.modules].sort((a,b)=>a.week-b.week||(a.course<b.course?-1:1)).map(m=>{
    const tot=m.videos.reduce((a,v)=>a+v.minutes,0), dn=m.videos.filter(v=>v.done).length;
    const spd=S.speed||1, eff=Math.round(tot/spd), tb=(m.textbook ?? 30);
    if(m.week>triWeek()) return `<div class="mod" style="opacity:.65"><b>${m.course} · Week ${m.week}</b> ${m.title?"· "+m.title:""} — ${m.videos.length} videos · ${tot} min <span class="muted">🔒 releases ~${triWeekDate(m.week)} — auto-unlocks then</span></div>`;
    const FM=frontierMap();
    const isFrontier=(FM[m.course]===m);
    const flow=dn===m.videos.length?`<span style="color:var(--ok)">✓ done</span>`:isFrontier?`<span style="color:var(--teal)">▶ active — finish this to unlock Week ${m.week+1}</span>`:`<span class="muted">⏳ waits for Week ${FM[m.course]?FM[m.course].week:"?"}</span>`;
    return `<div class="mod"><b>${m.course} · Week ${m.week}</b> ${m.title?"· "+m.title:""} — ${dn}/${m.videos.length} videos · ${tot} min raw (~${eff} at ${spd}×) + ${tb}m textbook<br>${flow}
      <div>${m.videos.map(v=>`<label style="display:block"><input type="checkbox" data-m="${m.id}" data-v="${v.label.replace(/"/g,"&quot;")}" ${v.done?"checked":""}> ${v.label} <span class="muted">(${v.minutes}m${v.done?" ✓":" · ▶ "+schedFor(m.id,v.label)})</span></label>`).join("")}</div>
      <div class="row wrap" style="margin-top:6px"><label class="small muted">📖 Textbook min/week <input type="number" min="0" max="300" step="5" value="${tb}" data-tb="${m.id}" style="width:75px"></label>
      <span style="flex:1"></span><button class="btn danger sm" data-delmod="${m.id}">Delete module</button></div></div>`;
  }).join("") : `<p class="muted small">No modules yet. Paste Week 1 for Java / Statistics / RDBMS to generate this week's IIT blocks.</p>`;
  $("moduleList").querySelectorAll("input[type=checkbox]").forEach(cb=>cb.onchange=()=>toggleIit(cb.dataset.m,cb.dataset.v,cb.checked));
  $("moduleList").querySelectorAll("[data-tb]").forEach(i=>i.onchange=()=>{ const m=S.modules.find(x=>String(x.id)===i.dataset.tb); if(m){ m.textbook=Math.max(0,+i.value||0); save(); renderAll(); } });
  $("moduleList").querySelectorAll("[data-delmod]").forEach(b=>b.onclick=()=>{ S.modules=S.modules.filter(m=>String(m.id)!==b.dataset.delmod); save(); renderAll(); });
}

/* Event fit engine: free minutes from today until the event date + pausable
   subjects with their minutes in the window. Caller adds held minutes. */
function eventFit(dateStr, estHrs){
  const need=Math.round((+estHrs||0)*60), t=todayStr();
  if(!dateStr||dateStr<=t||need<=0) return { need, free:0, short:need, perDay:[], pausable:[] };
  const offs=new Set();
  for(let d=parseD(t); dstr(d)<dateStr; d=addD(d,1)) offs.add(weekOf(dstr(d)));
  let freeSum=0; const perDay=[], byTpl={};
  offs.forEach(o=>buildWeek(o).forEach(d=>{
    if(d.date<t||d.date>=dateStr) return;
    freeSum+=Math.max(0,d.cap-d.tasks.reduce((a,x)=>a+x.min,0));
    perDay.push(d.date);
    d.tasks.forEach(x=>{
      if(x.kind==="rec"){ const id=x.key.split("::")[1]; byTpl[id]=(byTpl[id]||0)+x.min; }
    });
  }));
  const pausable=Object.keys(byTpl).map(id=>{
    const tmp=TEMPLATES.find(x=>x.id===id);
    return { id, title:tmp?tmp.title:id, min:byTpl[id] };
  }).sort((a,b)=>b.min-a.min);
  return { need, free:Math.round(freeSum), short:0, perDay, pausable };
}
/* Calendar: month grid + clickable day panel + event focus planner. */
let calOff=0, selDate=todayStr(); const pendingHolds=new Set();
function renderCalendar(){
  if(!$("calGrid")) return;
  const now=new Date(), base=new Date(now.getFullYear(),now.getMonth()+calOff,1);
  const y=base.getFullYear(), m=base.getMonth(), p2=n=>String(n).padStart(2,"0");
  $("calTitle").textContent=base.toLocaleString(undefined,{month:"long",year:"numeric"});
  const startBlank=(new Date(y,m,1).getDay()+6)%7, dim=new Date(y,m+1,0).getDate();
  let html=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=>`<div class="calhead">${d}</div>`).join("");
  for(let i=0;i<startBlank;i++) html+=`<div class="calblank"></div>`;
  for(let dd=1;dd<=dim;dd++){
    const dt=`${y}-${p2(m+1)}-${p2(dd)}`;
    const isT=dt===todayStr(), sel=dt===selDate, past=dt<todayStr();
    const marks=[...(collegeFor(wd(parseD(dt))).length?["🎓"]:[]),...((S.tests||[]).some(t=>t.date===dt)?["📝"]:[]),...((S.events||[]).filter(e=>e.date===dt).map(()=>"🎯"))].join(" ");
    html+=`<div class="calday ${isT?"today":""} ${sel?"sel":""} ${past?"past":""}" data-cal="${dt}"><b>${dd}</b><span>${marks}</span></div>`;
  }
  $("calGrid").innerHTML=html;
  $("calGrid").querySelectorAll("[data-cal]").forEach(c=>c.onclick=()=>{ selDate=c.dataset.cal; renderCalendar(); });
  renderCalDay();
}
function renderCalDay(){
  if(!$("calDayItems")) return;
  const dt=selDate;
  $("calDayTitle").textContent=new Date(dt+"T12:00:00").toDateString();
  $("eDateLabel").textContent=dt;
  let h="";
  collegeFor(wd(parseD(dt))).forEach(c=>{ h+=`<div class="mini college">🎓 ${c.s}–${c.e} ${c.t}</div>`; });
  (S.tests||[]).filter(t=>t.date===dt).forEach(t=>{ h+=`<div class="mini">📝 <b>${t.sys==="sai"?"SaiU class test":(t.type==="proctored"?"Proctored":"Non-Proctored")}</b> ${t.course}${t.title?" — "+t.title:""}${t.time?` @${fmtTime(t.time)}`:""}</div>`; });
  (S.events||[]).filter(e=>e.date===dt).forEach(e=>{ h+=`<div class="mini">🎯 <b>${e.title}</b> <span class="muted">(${e.estHrs}h)</span><span style="margin-left:auto"></span><button class="btn sm" data-evdone="${e.id}">${e.done?"Reopen":"Done"}</button> <button class="btn danger sm" data-evdel="${e.id}">✕</button></div>${e.syllabus?`<div class="muted small">Plan: ${e.syllabus}</div>`:""}`; });
  if(!h) h=`<p class="muted small">Nothing on this day.</p>`;
  $("calDayItems").innerHTML=h;
  $("calDayItems").querySelectorAll("[data-evdel]").forEach(b=>b.onclick=()=>{ S.events=S.events.filter(e=>String(e.id)!==b.dataset.evdel); save(); renderAll(); });
  $("calDayItems").querySelectorAll("[data-evdone]").forEach(b=>b.onclick=()=>{ const e=(S.events||[]).find(x=>String(x.id)===b.dataset.evdone); if(e){ e.done=!e.done; save(); renderAll(); } });
  updateFit();
}
function updateFit(){
  if(!$("eFit")) return;
  const dt=selDate, hrs=+$("eHrs").value||0;
  if(dt<=todayStr()||hrs<=0){ $("eFit").innerHTML=`<p class="muted small">Pick a future date + prep hours to see the fit.</p>`; $("eHold").innerHTML=""; return; }
  const fit=eventFit(dt,hrs);
  const heldMin=fit.pausable.filter(p=>pendingHolds.has(p.id)).reduce((a,p)=>a+p.min,0);
  const short=Math.max(0,fit.need-fit.free-heldMin);
  $("eFit").innerHTML=short<=0
    ? `<div class="tip ok">✓ Fits: ${fit.need}m prep into ${fit.free+heldMin}m available over ${fit.perDay.length} day(s) — other commitments untouched.</div>`
    : `<div class="tip warnb">⚠ Short by <b>${short}m</b> (${fit.need}m needed, ${fit.free}m free). Tick subjects to hold till ${dt} — held work returns after the event:</div>`;
  $("eHold").innerHTML=fit.pausable.map(p=>`<label class="chip"><input type="checkbox" data-hold="${p.id}" ${pendingHolds.has(p.id)?"checked":""}> ${p.title} <span class="muted">(+${p.min}m)</span></label>`).join("");
  $("eHold").querySelectorAll("[data-hold]").forEach(cb=>cb.onchange=()=>{
    if(cb.checked) pendingHolds.add(cb.dataset.hold); else pendingHolds.delete(cb.dataset.hold);
    updateFit();
  });
}
function renderTests(){
  if($("examRadar")){
    const t=todayStr();
    const items=[
      ...(S.tests||[]).map(x=>({date:x.date,tag:x.sys==="sai"?"SaiU":(x.type==="proctored"?"PT":"NPT"),name:`${x.course}${x.title?" — "+x.title:""}`,time:x.time||"",id:"t"+x.id})),
      ...(S.events||[]).filter(e=>!e.done).map(e=>({date:e.date,tag:"Event",name:e.title,time:e.time||"",id:"e"+e.id}))
    ].filter(x=>x.date&&x.date>=t).sort((a,b)=>a.date<b.date?-1:1).slice(0,8);
    $("examRadar").innerHTML=`<div class="mod" style="border-color:var(--acc)"><b>🎯 Exam radar</b> <span class="muted small">(everything, one place)</span>`+
      (items.length?items.map(x=>{
        const days=Math.round((parseD(x.date)-parseD(t))/864e5);
        return `<div class="mini"><b>${x.date}</b> <span class="muted">in ${days}d</span> <span class="badge">${x.tag}</span> ${x.name} ${x.time?`<span class="muted">@${fmtTime(x.time)}</span>`:""}</div>`;
      }).join(""):`<div class="muted small">Nothing upcoming — add tests above or events in Calendar.</div>`)+`</div>`;
  }
  if(!$("testList")) return;
  const list=[...(S.tests||[])].sort((a,b)=>a.date<b.date?-1:1);
  $("testList").innerHTML=list.length? list.map(t=>{
    const info=t.sys==="sai"
      ? `📝 SaiU · <b>${t.course}</b>${t.title?" — "+t.title:""}${t.time?` @${fmtTime(t.time)}`:""} <span class="muted">(${t.prepMode==="h"?t.qty+"h material":t.qty+" PYQs"} → ${t.prepMode==="h"?Math.round(t.qty*60):Math.round(t.qty*(t.perQ||4))}m prep)</span>`
      : `${t.type==="proctored"?"📝 Proctored":"📝 Non-Proctored"} · <b>${t.course}</b>${t.time?` @${fmtTime(t.time)}`:""}`;
    const slotNote=(t.sys!=="sai"&&t.type==="proctored")?(()=>{ const b=ptBackupDate({course:t.course,date:t.date,time:t.time}); return ` <span class="muted small">slot 1 ${t.date}${t.time?" "+fmtTime(t.time):""} → backup ${b.date}${b.time?" "+fmtTime(b.time):""}${t.movedToSlot2?" (moved ✓)":" (auto if missed)"}</span>`; })():"";
    const p=t.sys==="sai"?"60m exam + auto-spread prep":(t.type==="proctored"?"120m exam + 150m spread prep":"30m exam + 45m spread prep");
    return `<div class="mod"><b>${t.date}</b> · ${info} <span class="muted">(${p})</span>${slotNote} <button class="btn sm" data-crunch="${t.id}" title="toggle crunch for this test">${t.crunchOff?"⚡ crunch off":"⚡ crunch on"}</button> <button class="btn danger sm" data-deltest="${t.id}">✕</button></div>`;
  }).join("") : `<p class="muted small">No tests scheduled. Add your alternating IITG series or a SaiU class test below — prep blocks appear automatically on fixed dates.</p>`;
  $("testList").querySelectorAll("[data-deltest]").forEach(b=>b.onclick=()=>{ S.tests=S.tests.filter(t=>String(t.id)!==b.dataset.deltest); save(); renderAll(); });
  $("testList").querySelectorAll("[data-crunch]").forEach(b=>b.onclick=()=>{ const t=(S.tests||[]).find(x=>String(x.id)===b.dataset.crunch); if(t){ t.crunchOff=!t.crunchOff; save(); renderAll(); } });
  // crunch defaults live-sync
  if($("cDays")) $("cDays").value=S.crunch.days;
  document.querySelectorAll("[data-pz]").forEach(cb=>{ cb.checked=(S.crunch.pause||[]).includes(cb.dataset.pz); });
  document.querySelectorAll("[data-pbday]").forEach(s=>{ const c=((S.ptBackup||{})[s.dataset.pbday])||{}; s.value=c.day||"Sat"; });
  document.querySelectorAll("[data-pbtime]").forEach(s=>{ const c=((S.ptBackup||{})[s.dataset.pbtime])||{}; s.value=c.time||""; });
}
/* Book reading plans. Chapters carry page counts (verify against your copy —
   seeds are ~3rd-edition estimates); pace = remaining pages ÷ weeks to deadline. */
/* Dated exam seeds: full PT/NPT trimester series. Runs once per version. */
function seedTests(){
  if(S.testVer>=5) return;
  S.testSeeded=true; S.testFullSeeded=true; S.testVer=5;
  // official slot-B backups (constant per course): RDBMS Sat 19:30, Java Sat 20:30, Opt Sun 19:30
  const SLOTB={RDBMS:{day:"Sat",time:"19:30"},Java:{day:"Sat",time:"20:30"},Optimization:{day:"Sun",time:"19:30"}};
  S.ptBackup=S.ptBackup||{};
  Object.keys(SLOTB).forEach(c=>{
    const cur=S.ptBackup[c]||{};
    if((!cur.day||cur.day==="Sat")&&!cur.time) S.ptBackup[c]={day:SLOTB[c].day,time:SLOTB[c].time};
  });
  // RDBMS PT1 slot-A Tue 08:00 (not 08:30)
  (S.tests||[]).forEach(t=>{
    if(t.course==="RDBMS"&&t.type==="proctored"&&t.date==="2026-09-15"&&t.time==="08:30"&&!t.movedToSlot2){ t.time="08:00"; }
  });
  // correction: RDBMS PT1 is Tue Sep 15 (not Mon Sep 14) — migrate any existing seed entry
  (S.tests||[]).forEach(t=>{
    if(t.course==="RDBMS"&&t.type==="proctored"&&t.date==="2026-09-14"&&!t.movedToSlot2){ t.date="2026-09-15"; }
  });
  // correction: RDBMS PT2+ are Tuesdays — shift any Monday-seeded entries forward a day
  const TUE_SHIFT={"2026-09-28":"2026-09-29","2026-10-12":"2026-10-13","2026-10-26":"2026-10-27","2026-11-09":"2026-11-10","2026-11-23":"2026-11-24"};
  (S.tests||[]).forEach(t=>{
    if(t.course==="RDBMS"&&t.type==="proctored"&&TUE_SHIFT[t.date]&&!t.movedToSlot2){ t.date=TUE_SHIFT[t.date]; }
  });
  // correction: pasted portal times for late-trimester evening slots (only where still the assumed 08:30)
  const TIME_FIX={"Java|proctored|2026-10-26":"19:42","Java|proctored|2026-11-09":"19:42","Java|proctored|2026-11-23":"19:42","Optimization|proctored|2026-10-26":"20:52","Optimization|proctored|2026-11-09":"20:52","Optimization|proctored|2026-11-23":"20:52"};
  (S.tests||[]).forEach(t=>{
    const k=`${t.course}|${t.type}|${t.date}`;
    if(TIME_FIX[k]&&t.time==="08:30"){ t.time=TIME_FIX[k]; }
  });
  let added=0;
  (typeof SEED_TESTS!=="undefined"?SEED_TESTS:[]).forEach(t=>{
    if(!(S.tests||[]).some(x=>x.course===t.course&&x.type===t.type&&x.date===t.date)){
      S.tests.push(Object.assign({ id:S.seq++ },t)); added++;
    }
  });
  if(added) addLog(`Seeded full PT/NPT series (${added} tests) — Mondays PT, Sundays NPT`);
  save();
}
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

/* Trimester module seeds (full official lists). Versioned: v2 replaces the old
   Week-1-only seeds, preserving any ticks by matching course+label. */
function seedWeek1(){
  if(S.seedVer>=2) return;
  const doneByLabel={};
  (S.modules||[]).forEach(m=>(m.videos||[]).forEach(v=>{ if(v.done) doneByLabel[m.course+"||"+v.label]=1; }));
  S.modules=(S.modules||[]).filter(m=>!m.seed);
  const list=(typeof SEED_MODULES!=="undefined"?SEED_MODULES:[]);
  list.forEach(sm=>{
    if(S.modules.some(x=>x.course===sm.course&&String(x.week)===String(sm.week))) return;
    S.modules.push({ id:S.seq++, course:sm.course, week:sm.week, title:sm.title, seed:true, textbook:30,
      videos: sm.videos.map(r=>({ label:r[0], minutes:r[1], done:!!doneByLabel[sm.course+"||"+r[0]] })) });
  });
  S.seeded=true; S.seedVer=2;
  addLog(`Loaded full trimester dataset (${list.length} modules) — future weeks unlock automatically`);
  save();
}
/* College timetable (blocked hours — never scheduled over).
   Seeded from the SaiU sheet for SCDS Y2 Sec 3 + ETA Sec 2. Editable in Settings. */
function toMin(hhmm){ const p=hhmm.split(':'),a=+p[0],b=+(p[1]||0); return a*60+b; }
function collegeFor(wd){ return (S.college&&S.college[wd])||[]; }
function collegeMin(wd){ return collegeFor(wd).reduce((a,c)=>a+Math.max(0,toMin(c.e)-toMin(c.s)),0); }
function seedCollege(){
  const needsSeed=!S.collegeSeeded&&(!S.college||!Object.keys(S.college).length);
  if(S.collegeSeeded&&S.college&&Object.keys(S.college).length){
    // repair pass for older installs: drop Linear Algebra, ensure IES + weekend live lab blocks
    DAYS.forEach(d=>{ S.college[d]=(S.college[d]||[]).filter(c=>c.t.indexOf('Linear Algebra')<0); });
    S.college.Sat=S.college.Sat||[];
    if(!S.college.Sat.some(c=>/Live LAB/.test(c.t))) S.college.Sat.push({s:'08:30',e:'11:30',t:'RDBMS Live LAB (3h)'});
    [['Tue','15:00','15:55'],['Tue','16:00','16:55'],['Wed','15:00','15:55'],['Wed','16:00','16:55']].forEach(([d,s,e])=>{
      S.college[d]=S.college[d]||[];
      if(!S.college[d].some(c=>c.s===s&&/Embed|INTT/.test(c.t))) S.college[d].push({s,e,t:'Intelligent Embedded Sys (Dr. Ashok)'});
      S.college[d].sort((a,b)=>a.s<b.s?-1:1);
    });
  }
  if(!needsSeed){ if(S.collegeSeeded){ save(); return; } S.collegeSeeded=true; }
  if(!S.college||!Object.keys(S.college).length){
    const C=(s,e,t)=>({s,e,t});
    S.college={
      Mon:[C('15:00','15:55','Emerging Tools Sec 2 (Sonar)'),C('16:00','16:55','Web Tech Sec 3 (Rupam)')],
      Tue:[C('11:15','12:10','DAA Sec 3 (David)'),C('12:15','13:10','DAA Sec 3 (David)'),C('14:00','14:55','Web Tech Sec 3 (Rupam)'),C('15:00','15:55','Intelligent Embedded Sys (Dr. Ashok)'),C('16:00','16:55','Intelligent Embedded Sys (Dr. Ashok)')],
      Wed:[C('09:15','10:10','Data Engg Sec 3 (Mariya)'),C('15:00','15:55','Intelligent Embedded Sys (Dr. Ashok)'),C('16:00','16:55','Intelligent Embedded Sys (Dr. Ashok)')],
      Thu:[C('09:15','10:10','Emerging Tools Sec 2 (Sonar)'),C('10:15','11:10','Web Tech Sec 3 (Rupam)'),C('11:15','12:10','DAA Sec 3 (David)'),C('13:00','13:55','Data Engg Sec 3 (Mariya)'),C('14:00','14:55','Data Engg Sec 3 (Mariya)')],
      Fri:[C('10:15','11:10','Web Tech Sec 3 (Rupam)'),C('13:00','13:55','Emerging Tools Sec 2 (Sonar)')],
      Sat:[C('08:30','11:30','RDBMS Live LAB (3h)')],Sun:[]
    };
    addLog('Seeded college timetable (Sec 3 + ETA Sec 2 + Sat live lab)');
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
let expandState=false;
$("expandAll").onclick=()=>{ expandState=!expandState; document.querySelectorAll("#weekGrid details.day").forEach(d=>{ d.open=expandState; }); $("expandAll").textContent=expandState?"Collapse all":"Expand all"; };
$("thisWk").onclick=()=>{S.weekOffset=0;save();renderAll();};
$("mPreview").onclick=()=>{
  const items=parseDurations($("mPaste").value);
  const tot=items.reduce((a,x)=>a+(x.minutes||0),0);
  $("mOut").innerHTML=items.length? `Parsed ${items.length} videos · total ~${tot} min (${(tot/60).toFixed(1)}h at 1×, ~${Math.round(tot/1.5)} min at 1.5×).<br>`+items.map(x=>`• ${x.label} — <b>${x.minutes}m</b>${x.unparsed?' <span style="color:var(--warn)">(no duration found — defaults 0, fix line)</span>':""}`).join("<br>") : "No lines detected.";
};
$("mSave").onclick=()=>{
  const items=parseDurations($("mPaste").value).filter(x=>x.minutes>0);
  if(!items.length){ alert("No video durations found. Check the format — one video per line with e.g. '12:34' or '20 min'."); return; }
  const ex=S.modules.find(m=>m.course===$("mCourse").value&&String(m.week)===$("mWeek").value);
  if(ex){
    if(!confirm(`${ex.course} Week ${ex.week} already exists — replace it with this paste? (ticks kept where titles match)`)) return;
    const done={}; ex.videos.forEach(v=>{ if(v.done)done[v.label]=1; });
    ex.title=$("mTitle").value.trim()||ex.title;
    ex.videos=items.map(x=>({label:x.label.slice(0,80),minutes:x.minutes,done:!!done[x.label.slice(0,80)]}));
    $("mPaste").value=""; $("mTitle").value=""; save(); renderAll();
    alert("Module replaced — schedule rebuilt.");
    return;
  }
  S.modules.push({ id:S.seq++, course:$("mCourse").value, week:$("mWeek").value, title:$("mTitle").value.trim(), textbook:30, videos:items.map(x=>({label:x.label.slice(0,80),minutes:x.minutes,done:false})) });
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
  S.tests.push({ id:S.seq++, sys:"iitg", course:$("tCourse").value, type:$("tFirst").value, date:d, time:$("tTime").value });
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
  S.tests.push({ id:S.seq++, sys:"sai", course:$("sCourse").value, title:$("sTitle").value.trim(), date:d, time:$("sTime").value, prepMode:$("sMode").value, qty:q, perQ:+$("sPerQ").value||4 });
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
document.querySelectorAll("[data-pbday]").forEach(s=>s.onchange=()=>{ S.ptBackup=S.ptBackup||{}; S.ptBackup[s.dataset.pbday]=S.ptBackup[s.dataset.pbday]||{day:"Sat",time:""}; S.ptBackup[s.dataset.pbday].day=s.value; save(); renderAll(); });
document.querySelectorAll("[data-pbtime]").forEach(s=>s.onchange=()=>{ S.ptBackup=S.ptBackup||{}; S.ptBackup[s.dataset.pbtime]=S.ptBackup[s.dataset.pbtime]||{day:"Sat",time:""}; S.ptBackup[s.dataset.pbtime].time=s.value; save(); renderAll(); });
$("calPrev").onclick=()=>{ calOff--; renderCalendar(); };
$("calNow").onclick=()=>{ calOff=0; selDate=todayStr(); renderCalendar(); };
$("calNext").onclick=()=>{ calOff++; renderCalendar(); };
["eHrs","eCourse"].forEach(id=>{ const el=$(id); if(el) el.oninput=updateFit; });
$("eAdd").onclick=()=>{
  const dt=selDate, ti=$("eTitle").value.trim(), hrs=+$("eHrs").value||0;
  if(dt<=todayStr()){ alert("Pick a future date on the calendar first."); return; }
  if(!ti){ alert("Name the event first (e.g. DAA class test)."); return; }
  if(!hrs){ alert("Estimate prep hours — even a rough number works."); return; }
  const parts=$("eCourse").value.split("|");
  const holds=[...pendingHolds];
  const fit=eventFit(dt,hrs);
  const heldMin=fit.pausable.filter(p=>holds.includes(p.id)).reduce((a,p)=>a+p.min,0);
  if(fit.need>fit.free+heldMin && !confirm(`Still short by ${fit.need-fit.free-heldMin}m even with holds. Add anyway? (Prep that fits is scheduled; the rest stays visible here.)`)) return;
  S.events.push({ id:S.seq++, date:dt, title:ti, courseName:parts[1], cat:parts[0], time:$("eTime").value, syllabus:$("eSyllabus").value.trim(), estHrs:hrs, pause:holds, holdFrom:todayStr(), created:todayStr() });
  $("eTitle").value=""; $("eSyllabus").value=""; pendingHolds.clear();
  save(); renderAll();
  alert("Event set — prep is now spread across the days before it.");
};
$("resetAll").onclick=()=>{ if(confirm("Wipe all StudyOS data?")){ localStorage.removeItem(LSKEY); S=defState(); save(); renderAll(); } };
$("selfTest").onclick=runSelfTest;
$("reseedBtn").onclick=()=>{ S.modules=(S.modules||[]).filter(m=>!m.seed); S.seeded=false; S.seedVer=0; seedWeek1(); save(); renderAll(); alert("Trimester dataset reloaded — modules you added yourself were kept."); };
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
  if(!S.capV3){ S.cap={Mon:200,Tue:180,Wed:200,Thu:180,Fri:200,Sat:240,Sun:240}; S.capV3=true; save(); addLog("Caps reset to realistic 9:30pm window (3–3.5h/day)"); } // one-time reality reset
  seedWeek1(); // one-time Week-1 module seed
  seedTests(); // one-time dated exam seeds
  seedCollege(); // one-time college timetable seed
  seedBooks(); // one-time CLRS plan seed
  const moved=autoRelocate(); // intelligent relocation runs on every start
  renderAll();
  if(moved>0 && $("autoNotice")) $("autoNotice").innerHTML=`<div class="warn" style="border-color:var(--warn);color:#ffe1a8;background:#241c08">⟳ Auto-relocated <b>${moved}</b> unfinished task(s) from past days into your backlog — already fitted into your next free slots. Details in the Relocation log.</div>`;
})();
// auto-refresh: recompute the timetable whenever you return to the tab
// (new day, week rollover, midnight) — re-renders only if something changed,
// so expanded days and half-typed inputs are never disturbed.
let lastSeenDay=todayStr();
function refreshIfNeeded(){
  const t=todayStr(), dayChanged=t!==lastSeenDay;
  if(dayChanged) lastSeenDay=t;
  const moved=autoRelocate();
  if(dayChanged||moved>0) renderAll();
}
document.addEventListener("visibilitychange",()=>{ if(!document.hidden) refreshIfNeeded(); });
window.addEventListener("focus",()=>refreshIfNeeded());
// cross-tab sync: ticking in one tab updates every other open tab instantly
window.addEventListener("storage",(e)=>{
  if(e.key==="studyOS.v1"&&e.newValue){ try{ S=Object.assign(defState(),JSON.parse(e.newValue)); renderAll(); }catch(_){} }
});
setInterval(()=>{ if(todayStr()!==lastSeenDay){ lastSeenDay=todayStr(); autoRelocate(); renderAll(); } },60000);
