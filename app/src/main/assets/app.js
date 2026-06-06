/* =========================================================================
   Azkar TV Display — Rev08
   Two master types (Dua, Azkar) · mode-based rotation from content_index.json
   Swipe + long-press favourites · search · themes · prayer times · tajweed
   ========================================================================= */
'use strict';
const $ = id => document.getElementById(id);
const MODE = (new URLSearchParams(location.search).get('mode') || 'app');
const SCREENSAVER = MODE === 'screensaver';
if (SCREENSAVER) document.body.classList.add('screensaver');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------------- settings ---------------- */
const DEFAULTS = { theme:'light', timerSec:60, ar:1, tr:1, en:1, autoRotate:true, showSalah:true, showTranslit:true, tajweed:true, mode:'mixed' };
let S = (() => { try { const c = JSON.parse(localStorage.getItem('azkar_settings_v3')); if (c) return Object.assign({}, DEFAULTS, c); } catch(e){} return Object.assign({}, DEFAULTS); })();
function saveSettings(){ try { localStorage.setItem('azkar_settings_v3', JSON.stringify(S)); } catch(e){} }
const TOGNAMES = { autoRotate:'Auto-rotate', showSalah:'Salah strip', showTranslit:'Transliteration', tajweed:'Tajweed colours' };
function applySettings(){
  document.documentElement.setAttribute('data-theme', S.theme);
  document.documentElement.style.setProperty('--ar-scale', S.ar);
  document.documentElement.style.setProperty('--tr-scale', S.tr);
  document.documentElement.style.setProperty('--en-scale', S.en);
  document.body.classList.toggle('hide-tr', !S.showTranslit);
  document.body.classList.toggle('hide-salah', !S.showSalah);
  saveSettings(); if (PLAY) render(); startRotate(); syncSettingsUI();
}

/* ---------------- favourites ---------------- */
let favs = (() => { try { return new Set(JSON.parse(localStorage.getItem('azkar_favs')) || []); } catch(e){ return new Set(); } })();
function saveFavs(){ try { localStorage.setItem('azkar_favs', JSON.stringify([...favs])); } catch(e){} }
function toggleFav(id){
  id = id || (PLAY && PLAY[idx] && PLAY[idx].id); if (!id) return;
  if (favs.has(id)) { favs.delete(id); toast('Removed from favourites'); }
  else { favs.add(id); toast('Added to favourites'); }
  saveFavs(); updateFavUI();
  if (currentMode === 'favorites') { const keep = PLAY[idx] && PLAY[idx].id; setMode('favorites', keep); }
}
function updateFavUI(){
  $('fav-count').textContent = favs.size;
  const it = PLAY && PLAY[idx];
  $('fav-star').classList.toggle('on', !!(it && favs.has(it.id)));
}

/* ---------------- toast ---------------- */
let toastTimer = null;
function toast(msg){ const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800); }

/* ---------------- location + prayer math (Umm al-Qura) ---------------- */
const DEFAULT_GEO = { lat:24.7136, lng:46.6753, tz:null, city:'', country:'' };
let GEO = (() => { try { const c = JSON.parse(localStorage.getItem('azkar_geo')); if (c && c.lat) return c; } catch(e){} return Object.assign({}, DEFAULT_GEO); })();
function saveGeo(g){ try { localStorage.setItem('azkar_geo', JSON.stringify(g)); } catch(e){} }
function setNet(on){ const d=$('net-dot'), l=$('net-label'); d.className='dot '+(on?'online':'offline'); l.textContent=on?'Online':'Offline'; }
function withTimeout(p, ms){ return Promise.race([p, new Promise((_,r)=>setTimeout(()=>r(new Error('t')), ms))]); }
function parseUtc(s){ if(!s) return null; const m=/([+-])(\d{2})(\d{2})/.exec(s); if(!m) return null; return (m[1]==='-'?-1:1)*(+m[2]+(+m[3])/60); }
async function detectLocation(){
  try { const r=await withTimeout(fetch('https://ipapi.co/json/'),6000); const j=await r.json();
    if(j&&j.latitude) return {lat:+j.latitude,lng:+j.longitude,tz:parseUtc(j.utc_offset),city:j.city||'',country:j.country_name||''}; } catch(e){}
  try { const r=await withTimeout(fetch('http://ip-api.com/json/'),6000); const j=await r.json();
    if(j&&j.lat) return {lat:+j.lat,lng:+j.lon,tz:(j.offset!=null?j.offset/3600:null),city:j.city||'',country:j.country||''}; } catch(e){}
  return null;
}
const FAJR_ANGLE=18.5, ISHA_INTERVAL=90, ASR_FACTOR=1;
const PT=(function(){
  const D2R=Math.PI/180,R2D=180/Math.PI;
  const dsin=d=>Math.sin(d*D2R),dcos=d=>Math.cos(d*D2R),dtan=d=>Math.tan(d*D2R);
  const darcsin=x=>R2D*Math.asin(x),darccos=x=>R2D*Math.acos(x),darctan2=(y,x)=>R2D*Math.atan2(y,x),darccot=x=>R2D*Math.atan(1/x);
  const fix=(a,b)=>{a-=b*Math.floor(a/b);return a<0?a+b:a;}; const fixAngle=a=>fix(a,360),fixHour=a=>fix(a,24);
  function julian(y,m,d){ if(m<=2){y-=1;m+=12;} const A=Math.floor(y/100),B=2-A+Math.floor(A/4); return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(m+1))+d+B-1524.5; }
  function sun(jd){ const D=jd-2451545.0; const g=fixAngle(357.529+0.98560028*D); const q=fixAngle(280.459+0.98564736*D);
    const L=fixAngle(q+1.915*dsin(g)+0.020*dsin(2*g)); const e=23.439-0.00000036*D; const RA=darctan2(dcos(e)*dsin(L),dcos(L))/15;
    return {decl:darcsin(dsin(e)*dsin(L)),eqt:q/15-fixHour(RA)}; }
  function times(date,lat,lng,tz){ const jd=julian(date.getFullYear(),date.getMonth()+1,date.getDate())-lng/(15*24);
    const midDay=t=>fixHour(12-sun(jd+t).eqt);
    const angleTime=(a,t,ccw)=>{ const decl=sun(jd+t).decl; const v=(-dsin(a)-dsin(decl)*dsin(lat))/(dcos(decl)*dcos(lat)); return midDay(t)+(ccw?-1:1)*darccos(v)/15; };
    const asr=(f,t)=>{ const decl=sun(jd+t).decl; return angleTime(-darccot(f+dtan(Math.abs(lat-decl))),t,false); };
    const adj=h=>h+tz-lng/15; const mg=angleTime(0.833,18/24,false);
    return {Fajr:adj(angleTime(FAJR_ANGLE,5/24,true)),Dhuhr:adj(midDay(12/24)),Asr:adj(asr(ASR_FACTOR,13/24)),Maghrib:adj(mg),Isha:adj(mg+ISHA_INTERVAL/60)}; }
  return {times};
})();
const SALAH=[{key:'Fajr',ic:'🌅'},{key:'Dhuhr',ic:'☀️'},{key:'Asr',ic:'🌤️'},{key:'Maghrib',ic:'🌇'},{key:'Isha',ic:'🌙'}];
const SALAH_AR={Fajr:'الفجر',Dhuhr:'الظهر',Asr:'العصر',Maghrib:'المغرب',Isha:'العشاء'};
let prayerHours={}; const RING_C=2*Math.PI*44;
function fix24(h){h%=24;return h<0?h+24:h;}
function fmt12(hf){ hf=fix24(hf); let h=Math.floor(hf),m=Math.round((hf-h)*60); if(m===60){m=0;h=(h+1)%24;} const ap=h>=12?'pm':'am'; let hh=h%12; if(hh===0)hh=12; return hh+':'+String(m).padStart(2,'0')+' '+ap; }
function computeTimes(){ const tz=(GEO.tz!=null)?GEO.tz:-new Date().getTimezoneOffset()/60; prayerHours=PT.times(new Date(),GEO.lat,GEO.lng,tz); renderStrip();
  $('loc-label').textContent=GEO.city?(GEO.city+(GEO.country?', '+GEO.country:'')):'Current Time'; }
function renderStrip(){ const list=$('salah-list'); list.innerHTML=''; SALAH.forEach(p=>{ const el=document.createElement('div'); el.className='salah-item'; el.dataset.key=p.key;
  el.innerHTML=`<div class="ic">${p.ic}</div><div class="s-name">${p.key}</div><div class="s-time">${fmt12(prayerHours[p.key])}</div>`; list.appendChild(el); }); }
let alertedToday={};
function tickClock(){ const now=new Date(); const h=now.getHours(),m=now.getMinutes(),s=now.getSeconds();
  const ap=h>=12?'pm':'am'; let hh=h%12; if(hh===0)hh=12;
  $('now-time').innerHTML=`${hh}:${String(m).padStart(2,'0')}<span class="ap"> ${ap}</span>`;
  $('hdr-date').textContent=now.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'short',year:'numeric'});
  $('hdr-time').textContent=`${hh}:${String(m).padStart(2,'0')} ${ap}`;
  const nowH=h+m/60+s/3600; const order=SALAH.map(p=>prayerHours[p.key]); let k=-1; for(let i=0;i<5;i++) if(order[i]>nowH){k=i;break;}
  let nextKey,nextH,prevH; if(k===-1){nextKey='Fajr';nextH=order[0]+24;prevH=order[4];} else {nextKey=SALAH[k].key;nextH=order[k];prevH=(k===0)?order[4]-24:order[k-1];}
  document.querySelectorAll('.salah-item').forEach(e=>e.classList.toggle('next',e.dataset.key===nextKey));
  $('next-name').textContent=nextKey;
  let diff=Math.max(0,Math.round((nextH-nowH)*3600)); const dh=Math.floor(diff/3600); diff-=dh*3600; const dm=Math.floor(diff/60),ds=diff-dm*60;
  $('countdown').textContent=[dh,dm,ds].map(x=>String(x).padStart(2,'0')).join(':');
  $('ring-fg').style.strokeDashoffset=RING_C*(1-clamp((nowH-prevH)/(nextH-prevH),0,1));
  const today=now.toDateString(); if(alertedToday.day!==today) alertedToday={day:today};
  for(const p of SALAH){ const sec=Math.round(prayerHours[p.key]*3600),nowSec=Math.round(nowH*3600);
    if(!alertedToday[p.key]&&nowSec>=sec&&nowSec-sec<=2){ alertedToday[p.key]=true; firePrayerAlert(p); } }
}
let alertTimer=null;
function firePrayerAlert(p){ $('alert-name').textContent=p.key; $('alert-ar').textContent=SALAH_AR[p.key]; $('alert').classList.add('show'); chime(); clearTimeout(alertTimer); alertTimer=setTimeout(dismissAlert,60000); }
function dismissAlert(){ $('alert').classList.remove('show'); }
function alertOpen(){ return $('alert').classList.contains('show'); }
let audioCtx=null;
function chime(){ try{ audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)(); if(audioCtx.state==='suspended')audioCtx.resume();
  [523.25,659.25,783.99,1046.5].forEach((f,i)=>{ const o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.type='sine'; o.frequency.value=f;
    const t=audioCtx.currentTime+i*0.45; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.25,t+0.05); g.gain.exponentialRampToValueAtTime(0.001,t+0.6);
    o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t+0.65); }); }catch(e){} }

/* ---------------- tajweed (heuristic; applied to Quran only) ---------------- */
const TJ=(function(){
  const COMB=c=>(c>=0x064B&&c<=0x0655)||c===0x0670||(c>=0x06D6&&c<=0x06ED);
  const SHADDA=0x0651,SUKUN=0x0652,MADDAH=0x0653,TANWIN=[0x064B,0x064C,0x064D];
  const isLetter=c=>c>=0x0621&&c<=0x064A;
  const QALQ='\u0642\u0637\u0628\u062C\u062F',IDGHAM='\u064A\u0631\u0645\u0644\u0648\u0646',IQLAB='\u0628',
        IZHAR='\u0621\u0647\u0639\u062D\u063A\u062E\u0623\u0625\u0622\u0627',LONG='\u0627\u0648\u064A';
  function units(t){ const u=[]; let cur=null; for(const ch of t){ const c=ch.codePointAt(0);
    if(COMB(c)&&cur){cur.s+=ch;cur.marks.push(c);} else {cur={base:c,s:ch,marks:[]};u.push(cur);} } return u; }
  function nextLetter(u,i){ for(let j=i+1;j<u.length;j++) if(isLetter(u[j].base)) return u[j].base; return 0; }
  function cls(u,i){ const it=u[i],b=it.base,mk=it.marks,has=c=>mk.indexOf(c)>=0,tan=TANWIN.some(t=>has(t));
    if(has(SHADDA)&&(b===0x0646||b===0x0645)) return 'ghunnah';
    if((b===0x0646&&has(SUKUN))||tan){ const s=String.fromCodePoint(nextLetter(u,i)); if(IQLAB.indexOf(s)>=0)return'iqlab'; if(IDGHAM.indexOf(s)>=0)return'idgham'; if(IZHAR.indexOf(s)>=0)return null; return 'ikhfa'; }
    if(QALQ.indexOf(String.fromCodePoint(b))>=0&&has(SUKUN)) return 'qalqalah';
    if(b===0x0622||has(MADDAH)) return 'madd';
    if(LONG.indexOf(String.fromCodePoint(b))>=0&&mk.length===0) return 'madd';
    return null; }
  function colour(t){ const u=units(t); let o=''; for(let i=0;i<u.length;i++){ const c=cls(u,i); o+=c?`<span style="color:var(--tj-${c})">${u[i].s}</span>`:u[i].s; } return o; }
  return {colour};
})();
function arHtml(it){ if(it.tajweed_html) return it.tajweed_html; if(it.source_type==='quran'&&S.tajweed) return TJ.colour(it.arabic); return it.arabic; }

/* ---------------- content + modes ---------------- */
let ITEMS=[], BYID={}, MODES=[], CATS=null;
let currentMode='mixed', PLAY=null, idx=0, customLabel=null;
function loadJSON(u){ return fetch(u).then(r=>r.json()).catch(()=>new Promise((res,rej)=>{ const x=new XMLHttpRequest(); x.open('GET',u,true);
  x.onreadystatechange=()=>{ if(x.readyState===4){ try{res(JSON.parse(x.responseText));}catch(e){rej(e);} } }; x.send(); })); }
function matchMode(it,f){
  if(f.special==='favorites') return favs.has(it.id);
  if(f.type&&it.type!==f.type) return false;
  if(f.source_type&&it.source_type!==f.source_type) return false;
  if(f.tag&&!it.usage_tags.includes(f.tag)) return false;
  if(f.tags&&!f.tags.some(t=>it.usage_tags.includes(t))) return false;
  return true;
}
function modeCount(m){ return ITEMS.filter(it=>matchMode(it,m.filter)).length; }
function buildPlaylist(modeId){ const m=MODES.find(x=>x.id===modeId)||MODES[0];
  const list=ITEMS.filter(it=>matchMode(it,m.filter)); list.sort((a,b)=>(a.display_priority||2)-(b.display_priority||2)); return list; }
function setMode(modeId, keepId){ currentMode=modeId; customLabel=null; PLAY=buildPlaylist(modeId);
  idx = keepId ? Math.max(0, PLAY.findIndex(x=>x.id===keepId)) : 0; if(idx<0) idx=0;
  S.mode=modeId; saveSettings();
  const m=MODES.find(x=>x.id===modeId); $('mode-label').textContent=m?m.label:'Mixed';
  render(); startRotate();
}
function setCustomPlaylist(list,label){ currentMode='__search'; customLabel=label; PLAY=list; idx=0; $('mode-label').textContent=label; render(); startRotate(); }

function render(){
  const it=PLAY&&PLAY[idx];
  const card=$('card');
  if(!it){ $('card-title').textContent='Nothing here yet'; $('card-sub').textContent='';
    $('body').innerHTML=`<div class="en">${currentMode==='favorites'?'Long-press or press OK on any item to add favourites.':'No items in this mode.'}</div>`;
    $('card-meta').innerHTML=''; updateFavUI(); return; }
  card.dataset.type=it.type;
  $('card-ic').textContent = it.type==='dua' ? '🤲' : '📿';
  $('card-title').textContent=it.title;
  $('card-sub').textContent=(it.category||'')+(it.sub_category?' · '+it.sub_category:'');
  $('body').innerHTML=`<div class="ar">${arHtml(it)}</div><div class="tr">${it.transliteration}</div><div class="en">${it.translation}</div>`;
  const rep=(it.repeat_count&&it.repeat_count!=1&&it.repeat_count!=='1')?`<span class="meta-rep">repeat ×${it.repeat_count}</span>`:'';
  const review=it.authenticity==='needs_review'?'<span class="badge-review">needs review</span>':'';
  $('card-meta').innerHTML=`<span>${it.source_reference||''}</span>${rep}${review}`;
  $('body').scrollTop=0; updateFavUI(); fitArabic();
}
function fitArabic(){ if(window.innerWidth<=900||window.matchMedia('(orientation:portrait)').matches) return;
  const b=$('body'),ar=b.querySelector('.ar'); if(!ar) return; ar.style.fontSize=''; let size=parseFloat(getComputedStyle(ar).fontSize); let g=90;
  while(b.scrollHeight>b.clientHeight+1&&size>16&&g-->0){ size-=2; ar.style.fontSize=size+'px'; } }
function nextItem(){ if(!PLAY||!PLAY.length) return; idx=(idx+1)%PLAY.length; render(); }
function prevItem(){ if(!PLAY||!PLAY.length) return; idx=(idx-1+PLAY.length)%PLAY.length; render(); }

/* ---------------- rotation timer ---------------- */
let rotTimer=null;
function busy(){ return alertOpen()||$('settings').classList.contains('show')||$('modemenu').classList.contains('show')||$('searchpanel').classList.contains('show'); }
function startRotate(){ clearInterval(rotTimer); const run=(S.autoRotate||SCREENSAVER); if(!run) return; let sec=S.timerSec; if(SCREENSAVER)sec=Math.min(sec,30);
  rotTimer=setInterval(()=>{ if(!busy()) nextItem(); }, sec*1000); }

/* ---------------- mode menu ---------------- */
function openModeMenu(){ const grid=$('mode-grid'); grid.innerHTML='';
  MODES.forEach(m=>{ const n=m.filter.special==='favorites'?favs.size:modeCount(m); const b=document.createElement('button');
    b.className='mode-opt focusable'+(m.id===currentMode?' on':''); b.innerHTML=`${m.label}<span class="mc">${n}</span>`;
    b.onclick=()=>{ closeOverlays(); setMode(m.id); toast(m.label); }; grid.appendChild(b); });
  showOverlay('modemenu'); }

/* ---------------- search ---------------- */
function runSearch(q){ q=q.trim().toLowerCase(); const res=$('search-results'); res.innerHTML='';
  if(!q){ return; } const norm=s=>(s||'').toLowerCase();
  const hits=ITEMS.filter(it=> norm(it.title).includes(q)||norm(it.translation).includes(q)||norm(it.transliteration).includes(q)||it.arabic.includes(q)||it.usage_tags.some(t=>t.includes(q))||norm(it.category).includes(q)).slice(0,80);
  hits.forEach(it=>{ const d=document.createElement('div'); d.className='res-item focusable'; d.tabIndex=0;
    d.innerHTML=`<div class="res-ar">${it.arabic}</div><div class="res-en">${it.title} — ${it.translation}</div>`;
    d.onclick=()=>{ closeOverlays(); setCustomPlaylist(hits, 'Search: '+q); }; res.appendChild(d); });
  if(!hits.length) res.innerHTML='<div class="res-en">No matches.</div>';
}

/* ---------------- settings ---------------- */
function syncSettingsUI(){
  document.querySelectorAll('#theme-row .opt').forEach(o=>o.classList.toggle('on',o.dataset.theme===S.theme));
  document.querySelectorAll('#timer-presets .opt').forEach(o=>o.classList.toggle('on',+o.dataset.min*60===S.timerSec));
  $('cust-val').textContent=S.timerSec; $('ar-pct').textContent=Math.round(S.ar*100)+'%';
  $('tr-pct').textContent=Math.round(S.tr*100)+'%'; $('en-pct').textContent=Math.round(S.en*100)+'%';
  document.querySelectorAll('.toggle').forEach(t=>{ const k=t.dataset.tog; t.textContent=`${TOGNAMES[k]}: ${S[k]?'On':'Off'}`; t.classList.toggle('on',!!S[k]); });
}
function initSettings(){
  $('gear').onclick=()=>{ syncSettingsUI(); showOverlay('settings'); };
  $('set-close').onclick=closeOverlays; $('mode-close').onclick=closeOverlays; $('search-close').onclick=closeOverlays;
  $('mode-btn').onclick=openModeMenu; $('fav-ind').onclick=()=>{ setMode('favorites'); toast('Favourites'); };
  $('search-btn').onclick=()=>{ $('search-input').value=''; $('search-results').innerHTML=''; showOverlay('searchpanel'); setTimeout(()=>$('search-input').focus(),50); };
  $('search-input').oninput=e=>runSearch(e.target.value);
  $('fav-star').onclick=()=>toggleFav();
  document.querySelectorAll('#timer-presets .opt').forEach(o=>o.onclick=()=>{ S.timerSec=+o.dataset.min*60; applySettings(); });
  $('cust-dn').onclick=()=>{ S.timerSec=clamp(S.timerSec-15,10,3600); applySettings(); };
  $('cust-up').onclick=()=>{ S.timerSec=clamp(S.timerSec+15,10,3600); applySettings(); };
  $('cust-apply').onclick=()=>applySettings();
  document.querySelectorAll('#theme-row .opt').forEach(o=>o.onclick=()=>{ S.theme=o.dataset.theme; applySettings(); });
  document.querySelectorAll('[data-font]').forEach(b=>b.onclick=()=>{ const f=b.dataset.font; S[f]=clamp(+(S[f]+(+b.dataset.d)*0.1).toFixed(2),0.6,2.0); applySettings(); });
  document.querySelectorAll('.toggle').forEach(t=>t.onclick=()=>{ S[t.dataset.tog]=!S[t.dataset.tog]; applySettings(); });
}

/* ---------------- overlays + focus ---------------- */
function showOverlay(id){ ['settings','modemenu','searchpanel'].forEach(o=>$(o).classList.toggle('show',o===id)); curFocus=null; setFocus(visibleFocusables()[0]); startRotate(); }
function closeOverlays(){ ['settings','modemenu','searchpanel'].forEach(o=>$(o).classList.remove('show')); setFocus($('card')); startRotate(); }
function anyOverlay(){ return $('settings').classList.contains('show')||$('modemenu').classList.contains('show')||$('searchpanel').classList.contains('show'); }
let curFocus=null;
function visibleFocusables(){ let scope=$('shift');
  if($('settings').classList.contains('show')) scope=$('settings');
  else if($('modemenu').classList.contains('show')) scope=$('modemenu');
  else if($('searchpanel').classList.contains('show')) scope=$('searchpanel');
  return [...scope.querySelectorAll('.focusable')].filter(el=>{ if(el.offsetParent===null) return false; const r=el.getBoundingClientRect(); return r.width>0&&r.height>0; }); }
function setFocus(el){ if(!el) return; document.querySelectorAll('.focusable.focused').forEach(e=>e.classList.remove('focused')); el.classList.add('focused'); curFocus=el; if(el.scrollIntoView) el.scrollIntoView({block:'nearest'}); }
function ctr(el){ const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; }
function move(dir){ const list=visibleFocusables(); if(!list.length) return; if(!curFocus||list.indexOf(curFocus)<0){ setFocus(list[0]); return; }
  const c=ctr(curFocus); let best=null,score=Infinity;
  for(const el of list){ if(el===curFocus) continue; const t=ctr(el); const dx=t.x-c.x,dy=t.y-c.y; let ok,pri,sec;
    if(dir==='right'){ok=dx>6;pri=dx;sec=Math.abs(dy);} else if(dir==='left'){ok=dx<-6;pri=-dx;sec=Math.abs(dy);}
    else if(dir==='down'){ok=dy>6;pri=dy;sec=Math.abs(dx);} else {ok=dy<-6;pri=-dy;sec=Math.abs(dx);}
    if(!ok) continue; const s=pri+sec*2; if(s<score){score=s;best=el;} }
  if(best) setFocus(best); }
function onBack(){ if(alertOpen()){dismissAlert();return true;} if(anyOverlay()){closeOverlays();return true;} return false; }
window.onTvBack=onBack;

document.addEventListener('keydown',e=>{
  if(alertOpen()){ dismissAlert(); e.preventDefault(); return; }
  const k=e.key;
  if(anyOverlay()){
    if(k==='ArrowRight'){move('right');e.preventDefault();} else if(k==='ArrowLeft'){move('left');e.preventDefault();}
    else if(k==='ArrowDown'){move('down');e.preventDefault();} else if(k==='ArrowUp'){move('up');e.preventDefault();}
    else if(k==='Enter'){ if(curFocus)curFocus.click(); e.preventDefault(); }
    else if(k==='Escape'||k==='Backspace'){ onBack(); e.preventDefault(); }
    return;
  }
  const onCard = !curFocus || curFocus===$('card');
  if(onCard){
    const b=$('body');
    switch(k){
      case 'ArrowLeft': prevItem(); e.preventDefault(); break;
      case 'ArrowRight': nextItem(); e.preventDefault(); break;
      case 'Enter': toggleFav(); e.preventDefault(); break;
      case 'ArrowUp': if(b.scrollTop>4){ b.scrollTop-=b.clientHeight*0.5; } else { openModeMenu(); } e.preventDefault(); break;
      case 'ArrowDown': if(b.scrollHeight-b.scrollTop-b.clientHeight>4){ b.scrollTop+=b.clientHeight*0.5; } else { setFocus($('gear')); } e.preventDefault(); break;
    }
  } else {
    switch(k){
      case 'ArrowRight': move('right'); e.preventDefault(); break;
      case 'ArrowLeft': move('left'); e.preventDefault(); break;
      case 'ArrowDown': move('down'); e.preventDefault(); break;
      case 'ArrowUp': move('up'); e.preventDefault(); break;
      case 'Enter': if(curFocus)curFocus.click(); e.preventDefault(); break;
      case 'Escape': case 'Backspace': setFocus($('card')); e.preventDefault(); break;
    }
  }
});

/* ---------------- gestures: swipe + long-press ---------------- */
function initGestures(){
  const el=$('card'); let sx=0,sy=0,st=0,moved=false,activeId=null,lp=null;
  function start(x,y,id,target){ sx=x;sy=y;st=Date.now();moved=false;activeId=id;
    lp=setTimeout(()=>{ if(activeId!=null&&!moved){ toggleFav(); if(navigator.vibrate)navigator.vibrate(20); activeId=null; } },550); }
  function moveh(x,y){ if(activeId==null) return; if(Math.abs(x-sx)>10||Math.abs(y-sy)>10){ moved=true; clearTimeout(lp); } }
  function end(x,y){ if(activeId==null){ clearTimeout(lp); return; } clearTimeout(lp); const dx=x-sx,dy=y-sy,dt=Date.now()-st; activeId=null;
    if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.3){ if(dx<0) nextItem(); else prevItem(); }
    else if(!moved&&dt<250){ setFocus(el); } }
  if(window.PointerEvent){
    el.addEventListener('pointerdown',e=>{ try{el.setPointerCapture(e.pointerId);}catch(_){}; start(e.clientX,e.clientY,e.pointerId); });
    el.addEventListener('pointermove',e=>moveh(e.clientX,e.clientY));
    el.addEventListener('pointerup',e=>{ end(e.clientX,e.clientY); try{el.releasePointerCapture(e.pointerId);}catch(_){}}); 
    el.addEventListener('pointercancel',()=>{ clearTimeout(lp); activeId=null; });
  } else {
    el.addEventListener('touchstart',e=>{ const t=e.changedTouches[0]; start(t.clientX,t.clientY,1); },{passive:true});
    el.addEventListener('touchmove',e=>{ const t=e.changedTouches[0]; moveh(t.clientX,t.clientY); },{passive:true});
    el.addEventListener('touchend',e=>{ const t=e.changedTouches[0]; end(t.clientX,t.clientY); });
  }
}

/* ---------------- burn-in ---------------- */
const SHIFTS=[[0,0],[8,4],[-6,8],[6,-6],[-8,-4],[4,6]]; let shiftIdx=0;
function burnInShift(){ shiftIdx=(shiftIdx+1)%SHIFTS.length; const [x,y]=SHIFTS[shiftIdx]; $('shift').style.transform=`translate(${x}px,${y}px)`; }

/* ---------------- boot ---------------- */
function start(){
  applySettings(); setNet(navigator.onLine);
  computeTimes(); tickClock(); setInterval(tickClock,1000); setInterval(computeTimes,30*60*1000);
  initSettings(); initGestures();
  Promise.all([loadJSON('content/dua.json'),loadJSON('content/azkar.json'),loadJSON('content/content_index.json'),loadJSON('content/categories.json')])
    .then(([d,a,ci,cats])=>{ ITEMS=d.concat(a); ITEMS.forEach(it=>BYID[it.id]=it); MODES=ci.rotation_modes||[]; CATS=cats;
      updateFavUI(); const startMode=MODES.find(m=>m.id===S.mode)?S.mode:'mixed'; setMode(startMode); setFocus($('card')); })
    .catch(err=>{ $('body').innerHTML='<div class="en" style="color:#b00">Content failed to load: '+err+'</div>'; });
  setInterval(burnInShift,SCREENSAVER?20000:30000);
  window.addEventListener('resize',fitArabic);
  detectLocation().then(g=>{ if(g){GEO=g;saveGeo(g);setNet(true);computeTimes();} else setNet(false); }).catch(()=>setNet(false));
  window.addEventListener('online',()=>{ setNet(true); detectLocation().then(g=>{ if(g){GEO=g;saveGeo(g);computeTimes();} }); });
  window.addEventListener('offline',()=>setNet(false));
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
