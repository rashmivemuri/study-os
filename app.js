/* StudyOS v1 — local-first smart scheduler. No dependencies. */
"use strict";
const LSKEY = "studyOS.v1";
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const CATS = { GATE:"#5aa2ff", CP:"#3ecf8e", SAI:"#c792ea", IIT:"#ffb020", OSS:"#ff7ab2", REV:"#8be9fd" };

/* Hardcoded recurring program (realistic ~5h wkday / 7h wkend self-study).
   Your call of "1 neetcode daily mandatory + alternate CF" is softened on purpose:
   daily NeetCode keeps the streak alive; CF 3x/wk + Sunday contest builds rating
   faster than strict alternation (which kills both streaks). */
const TEMPLATES = [
  { id:"nc",   title:"NeetCode — 1 problem + write-up", cat:"CP",   min:45, days:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], pri:5 },
  { id:"cf",   title:"Codeforces practice set",         cat:"CP",   min:60, days:["Tue","Thu","Sat"], pri:4 },
  { id:"cfcon",title:"CF contest / virtual + upsolve",  cat:"CP",   min:90, days:["Sun"], pri:4 },
  { id:"algo", title:"GATE Algo (primary focus)",       cat:"GATE", min:75, days:["Mon","Tue","Thu","Sat"], pri:5 },
  { id:"dbms", title:"GATE DBMS (primary focus)",       cat:"GATE", min:75, days:["Wed","Fri","Sun"], pri:5 },
  { id:"sai",  title:"Sai coursework rotation",         cat:"SAI",  min:60, days:["Mon","Tue","Wed","Thu","Fri","Sat"], pri:4, rotating:["DAA","Found. Data Engg","Web Tech","Emerging Tools","Intel. Embedded Sys","Calculus"] },
  { id:"saiw", title:"Sai weekend catch-up / assign.",  cat:"SAI",  min:90, days:["Sun"], pri:4 },
  { id:"oss",  title:"OWASP/OpenCRE — assigned issue → PR", cat:"OSS", min:90, days:["Tue","Thu","Sun"], pri:3 },
  { id:"rev",  title:"Spaced revision + flashcards",    cat:"REV",  min:20, days:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], pri:3 },
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
function defState(){ return { checks:{}, backlog:[], modules:[], custom:[], tests:[], college:{}, collegeSeeded:false, log:[], seeded:false, speed:1.25, catchup:false, cap:{Mon:300,Tue:270,Wed:300,Thu:240,Fri:300,Sat:420,Sun:420}, weekOffset:0, seq:1 }; }
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
function buildWeek(offset){
  const dates=weekDates(offset);
  const days=dates.map(d=>({ date:dstr(d), wd:wd(d), cap:S.cap[wd(d)]||300, college:collegeFor(wd(d)), tasks:[] }));
  const CUT=S.catchup?{oss:45,cf:30,cfcon:60,saiw:60}:{}; // catch-up mode lightens flexible load
  const cutMin=t=>CUT[t.id]||t.min;
  // 1) recurring + custom one-offs
  days.forEach((day,di)=>{
    TEMPLATES.forEach(t=>{
      if(!t.days.includes(day.wd)) return;
      let title=t.title, extra="";
      if(t.rotating) extra=" · "+t.rotating[di % t.rotating.length];
      day.tasks.push({ key:`${day.date}::${t.id}`, title:title+extra, cat:t.cat, min:cutMin(t), pri:t.pri, kind:"rec", fixed:true });
    });
    S.custom.filter(c=>c.date===day.date).forEach(c=>{
      day.tasks.push({ key:`custom:${c.id}`, title:c.title, cat:c.cat||"SAI", min:c.min, pri:c.pri||3, kind:"custom", fixed:true });
    });
  });
  // 1b) tests: exam-day blocks + type-based prep, date-fixed right after recurring
  // so core subjects are never displaced — IIT videos absorb the squeeze and auto-carry.
  const byDate={}; days.forEach(d=>byDate[d.date]=d);
  (S.tests||[]).forEach(ts=>{
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
  // 2) IIT chunks → days with most free space (scaled by playback speed)
  const free = day => day.cap - day.tasks.reduce((a,t)=>a+t.min,0);
  const spd = S.speed||1;
  const effMin = m => Math.max(5, Math.round(m/spd));
  iitVideosLeft().forEach(({mod,v})=>{
    splitChunk(`${mod.course} W${mod.week}: ${v.label}`, effMin(v.minutes)).forEach(ch=>{
      days.slice().sort((a,b)=>free(b)-free(a))
        .find(d=>true); // pick max-free day
      const target = days.slice().sort((a,b)=>free(b)-free(a))[0];
      target.tasks.push({ key:`iit:${mod.id}:${v.label}:${ch.label}`, title:"▶ "+ch.label, cat:"IIT", min:ch.minutes, pri:5, kind:"iit", modId:mod.id, vlabel:v.label, chunk:ch.label });
    });
  });
  // 3) backlog → leftover free slots, most-overdue first (cap 2 per day to avoid piling)
  const sorted=[...S.backlog].sort((a,b)=>(b.overdue||0)-(a.overdue||0) || b.pri-a.pri);
  sorted.forEach(b=>{
    const cands=days.filter(d=>free(d)>=Math.min(b.min,30) && d.tasks.filter(t=>t.kind==="carry").length<2)
      .sort((a,b2)=>free(a)-free(b2)); // tightest fit that still fits
    const t=(cands[0]||days.slice().sort((a,b2)=>free(b2)-free(a))[0]);
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
    if(t.kind==="iit") return; // IIT auto-carries via undone videos
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
      if(x.kind==="iit") return;
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
    const nDays=DAYS.filter(d=>collegeFor(d).length).length, thu=collegeMin("Thu");
    res.push([(nDays>=5&&thu>200)?"✓":"✗",`college blocks: ${nDays} days guarded (Thu ${thu}m), never scheduled over`]);
  }catch(e){ res.push(["✗","college threw: "+e.message]); }
  save(); renderAll();
  $("selfOut").innerHTML=res.map(r=>`<div>${r[0]} ${r[1]}</div>`).join("");
}

/* ---------- render ---------- */
const $=id=>document.getElementById(id);
function renderAll(){ renderToday(); renderWeek(); renderModules(); renderTests(); renderGoals(); renderSettings(); renderDiag(); }
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
    const checked = x.kind==="iit"? iitChunkDone(x) : isDone(t,x.key);
    const carry=x.kind==="carry"?'<span class="badge carry">carryover</span>':"";
    const iit=x.kind==="iit"?'<span class="badge iit">IIT</span>':"";
    const test=x.kind==="test"?'<span class="badge testb">test</span>':"";
    return { checked, html:`<li class="task ${checked?"done":""}"><span class="dot" style="background:${CATS[x.cat]||"#555"}"></span><input type="checkbox" data-d="${t}" data-k="${x.key.replace(/"/g,"&quot;")}" data-iit="${x.kind==="iit"?x.modId+"||"+x.vlabel:""}" ${checked?"checked":""}>
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
  // backlog
  $("backlogCount").textContent=S.backlog.length+" open";
  $("backlogList").innerHTML=S.backlog.length? S.backlog.map(b=>
    `<li class="task"><div><div class="t">↩ ${b.title}</div><div class="meta">${catBadge(b.cat)} ${b.min} min · overdue ${b.overdue||0}d · from ${b.fromDate}</div></div>
     <span style="margin-left:auto"></span><button class="btn" data-done="${b.id}">Done</button><button class="btn danger" data-del="${b.id}">✕</button></div></li>`).join("")
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
    const dn=day.tasks.filter(x=>x.kind==="iit"?iitChunkDone(x):isDone(d,x.key)).length;
    if(dn/day.tasks.length>=0.8) s++; else if(i===0) continue; else break;
  } return s;
}
function weekPct(){
  const days=buildWeek(S.weekOffset); let a=0,b=0;
  days.forEach(d=>d.tasks.forEach(t=>{ b++; if(t.kind==="iit"?iitChunkDone(t):isDone(d.date,t.key)) a++; }));
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
      ${d.tasks.map(t=>{const dn=t.kind==="iit"?iitChunkDone(t):isDone(d.date,t.key);
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
    const spd=S.speed||1, eff=Math.round(tot/spd);
    return `<div class="mod"><b>${m.course} · Week ${m.week}</b> ${m.title?"· "+m.title:""} — ${dn}/${m.videos.length} videos · ${tot} min raw (~${eff} at ${spd}×)
      <div>${m.videos.map(v=>`<label style="display:block"><input type="checkbox" data-m="${m.id}" data-v="${v.label.replace(/"/g,"&quot;")}" ${v.done?"checked":""}> ${v.label} <span class="muted">(${v.minutes}m)</span></label>`).join("")}</div>
      <button class="btn danger" data-delmod="${m.id}">Delete module</button></div>`;
  }).join("") : `<p class="muted small">No modules yet. Paste Week 1 for Java / Statistics / RDBMS to generate this week's IIT blocks.</p>`;
  $("moduleList").querySelectorAll("input[type=checkbox]").forEach(cb=>cb.onchange=()=>toggleIit(cb.dataset.m,cb.dataset.v,cb.checked));
  $("moduleList").querySelectorAll("[data-delmod]").forEach(b=>b.onclick=()=>{ S.modules=S.modules.filter(m=>String(m.id)!==b.dataset.delmod); save(); renderAll(); });
}

function renderTests(){
  if(!$("testList")) return;
  const list=[...(S.tests||[])].sort((a,b)=>a.date<b.date?-1:1);
  $("testList").innerHTML=list.length? list.map(t=>{
    const p=t.type==="proctored"?"120m exam + 90m + 60m prep":"60m exam + 45m prep";
    return `<div class="mod"><b>${t.date}</b> · ${t.type==="proctored"?"📝 Proctored":"📝 Non-proctored"} · <b>${t.course}</b> <span class="muted">(${p})</span> <button class="btn danger" data-deltest="${t.id}">✕</button></div>`;
  }).join("") : `<p class="muted small">No tests scheduled. Add your alternating IITG series below — prep blocks appear automatically on fixed dates.</p>`;
  $("testList").querySelectorAll("[data-deltest]").forEach(b=>b.onclick=()=>{ S.tests=S.tests.filter(t=>String(t.id)!==b.dataset.deltest); save(); renderAll(); });
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
  const M=(course,week,title,rows)=>({ id:S.seq++, course, week, title, seed:true,
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
  if(S.collegeSeeded) return; S.collegeSeeded=true;
  if(!S.college||!Object.keys(S.college).length){
    const C=(s,e,t)=>({s,e,t});
    S.college={
      Mon:[C('09:15','10:10','Linear Algebra Sec 3 (?)'),C('10:15','11:10','Linear Algebra Sec 3 (?)'),C('15:00','15:55','Emerging Tools Sec 2 (Sonar)'),C('16:00','16:55','Web Tech Sec 3 (Rupam)')],
      Tue:[C('11:15','12:10','DAA Sec 3 (David)'),C('12:15','13:10','DAA Sec 3 (David)'),C('14:00','14:55','Web Tech Sec 3 (Rupam)')],
      Wed:[C('09:15','10:10','Data Engg Sec 3 (Mariya)'),C('12:15','13:10','Linear Algebra Sec 3 (?)')],
      Thu:[C('09:15','10:10','Emerging Tools Sec 2 (Sonar)'),C('10:15','11:10','Web Tech Sec 3 (Rupam)'),C('11:15','12:10','DAA Sec 3 (David)'),C('13:00','13:55','Data Engg Sec 3 (Mariya)'),C('14:00','14:55','Data Engg Sec 3 (Mariya)')],
      Fri:[C('10:15','11:10','Web Tech Sec 3 (Rupam)'),C('11:15','12:10','Linear Algebra Sec 3 (?)'),C('13:00','13:55','Emerging Tools Sec 2 (Sonar)')],
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
  S.tests.push({ id:S.seq++, course:$("tCourse").value, type:$("tFirst").value, date:d });
  save(); renderAll();
};
$("addAltTests").onclick=()=>{
  const course=$("tCourse").value, start=$("tStart").value||todayStr();
  let type=$("tFirst").value;
  const n=Math.max(1,Math.min(16,+$("tWeeks").value||8));
  for(let i=0;i<n;i++){ S.tests.push({ id:S.seq++, course, type, date:dstr(addD(parseD(start),i*7)) }); type=(type==="proctored")?"nonproctored":"proctored"; }
  save(); renderAll();
  alert(`${n} alternating tests added starting ${start} — prep blocks placed on fixed dates.`);
};
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
  if(!S.installed){ S.installed=todayStr(); save(); } // anchor: only relocate days tracked after install
  seedWeek1(); // one-time Week-1 module seed
  seedCollege(); // one-time college timetable seed
  const moved=autoRelocate(); // intelligent relocation runs on every start
  renderAll();
  if(moved>0 && $("autoNotice")) $("autoNotice").innerHTML=`<div class="warn" style="border-color:var(--warn);color:#ffe1a8;background:#241c08">⟳ Auto-relocated <b>${moved}</b> unfinished task(s) from past days into your backlog — already fitted into your next free slots. Details in the Relocation log.</div>`;
})();
