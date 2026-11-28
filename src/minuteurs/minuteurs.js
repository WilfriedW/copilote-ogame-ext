/* ---------- les minuteurs ----------
   Les minuteurs que le joueur pose ou que le relevé lit (`parseLeft`,
   `timerLabel`), la fin d'un chantier qu'ils annoncent (`finishTimer`), le
   son et le titre qui clignote (`chime`, `flashTitle`, `stopFlash`), la file
   des alertes à acquitter (`alertQueue`, `ackFinished`, `showBigAlert`,
   `mirrorAlerts`), et leur liste à l'écran (`visibleTimers`, `renderTimers`,
   `clock`).

   Domaine de l'issue #49. Il ne lit que le noyau, et emprunte à app.js
   `planetById`, `save` et `addBuilt`, appelés et jamais lus au chargement.
   Le tic d'une seconde, qui rafraîchit la vue, vit avec les événements. */
import { S } from '../core/etat.js';
import { esc, norm } from '../core/format.js';
import { B, T } from '../core/formules.js';
import { planetById } from '../core/planetes.js';
import { dur, formatTime } from '../core/temps.js';
import { addBuilt } from '../economie/chantiers.js';
import { save } from '../synchro/synchro.js';
/** Parses an OGame countdown like "1j 2h 13m 5s", "2h13m", "01:13:05" into seconds. */
export function parseLeft(txt){
  const t = norm(txt).replace(/,/g,' ');
  if(/^\s*\d+(:\d{1,2}){1,2}\s*$/.test(t)){ const p=t.trim().split(':').map(Number); return p.length===3 ? p[0]*3600+p[1]*60+p[2] : p[0]*60+p[1]; }
  let sec=0, hit=false;
  const re=/(\d+)\s*(sem|w|j|d|h|m(?!s)|min|s)/g; let m;
  while((m=re.exec(t))){ hit=true; const v=+m[1]; sec += v*({sem:604800,w:604800,j:86400,d:86400,h:3600,m:60,min:60,s:1}[m[2]]); }
  if(!hit && /^\s*\d+\s*$/.test(t)) return +t*60;
  return hit ? sec : null;
}
export function timerLabel(tm){
  if(tm.kind==='t') return `${T[tm.k].n} ${tm.lvl}`;
  if(tm.kind==='b'){ const p=planetById(tm.pid); return `${B[tm.k].n} ${tm.lvl}${p&&S.planets.length>1?` · ${p.name}`:''}`; }
  return tm.label || ({fleet:'Retour de flotte',expo:'Retour d\'expédition',other:'Minuteur'})[tm.k];
}
let audioCtx = null;
export function unlockAudio(){ try{ audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)(); if(audioCtx.state==='suspended') audioCtx.resume(); }catch(e){} }
export function chime(){
  if(!audioCtx || S.settings.muet) return;
  try{ const t0=audioCtx.currentTime; [0,.22,.44,.9,1.12,1.34].forEach((d,i)=>{ const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.type='sine'; o.frequency.value=[660,880,1100][i%3]; g.gain.setValueAtTime(.0001,t0+d); g.gain.exponentialRampToValueAtTime(.25,t0+d+.02); g.gain.exponentialRampToValueAtTime(.0001,t0+d+.2); o.connect(g).connect(audioCtx.destination); o.start(t0+d); o.stop(t0+d+.22); }); }catch(e){}
}
const baseTitle = document.title;
let flashT = null;
function flashTitle(quoi){ clearInterval(flashT); let allume=false; flashT=setInterval(()=>{ document.title = (allume=!allume) ? `Terminé : ${quoi}` : baseTitle; },1000); }
export const alertQueue = [];
/* showBigAlert est déclarée plus bas (« one alert, one acknowledgment ») :
   elle passe par le service worker. La version locale qui vivait ici n'a
   jamais servi — en script classique, la dernière déclaration l'emportait —
   et un module ES refuse de charger un nom déclaré deux fois. */
/** Hides every finished timer up to now. */
export function ackFinished(){ S.ackBefore = Date.now(); save(); renderTimers(); }
export function stopFlash(){ clearInterval(flashT); flashT=null; document.title=baseTitle; }
/** Completes a timer: bumps the matching level, rings and notifies. */
export function finishTimer(tm){
  tm.done = true;
  if(tm.kind==='t' && S.tech[tm.k] < tm.lvl) S.tech[tm.k] = tm.lvl;
  if(tm.kind==='x' && tm.k==='colship') S.colo.built = true;
  /* Un id muet — la planète n'a pas été appariée au dernier relevé : le
     minuteur sonne et prévient, mais rien ne se crédite. Un niveau à ressaisir
     se rattrape ; un niveau posé sur la voisine, non. */
  const cible = planetById(tm.pid);
  if(tm.kind==='x' && tm.k==='sats' && cible && !tm.game) cible.sats += tm.n||0;
  if(tm.kind==='x' && tm.k==='shipyard' && tm.ships && cible && !tm.game) addBuilt(cible, tm.ships);
  if(tm.kind==='b' && cible && cible.b[tm.k] < tm.lvl) cible.b[tm.k] = tm.lvl;
  save(); chime(); flashTitle(timerLabel(tm));
  const extHandles = tm.game && window.chrome && chrome.runtime && chrome.runtime.id;
  if(!extHandles) showBigAlert(timerLabel(tm));
}
export function clock(sec){ sec=Math.max(0,Math.round(sec)); const d=Math.floor(sec/86400), h=Math.floor(sec%86400/3600), m=Math.floor(sec%3600/60), s=sec%60; return (d?d+'j ':'') + `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
/** Timers still worth showing: running, or finished but not yet acknowledged. */
export function visibleTimers(){ return S.timers.filter(t=>!(t.done || t.end<=Date.now()) || t.end > (S.ackBefore||0)); }
export function renderTimers(){
  const list = document.getElementById('tmList'); if(!list) return;
  const sorted = visibleTimers().sort((a,b)=>(a.done-b.done)||(a.end-b.end));
  list.dataset.count = String(sorted.length);
  /* Replié, le titre tient tout ce qu'on venait vérifier : combien tournent et
     lequel finit le premier. */
  const sum = document.getElementById('tmSum');
  if(sum){
    const fini = sorted.filter(t=>t.done).length, cours = sorted.filter(t=>!t.done);
    sum.textContent = fini ? `${fini} terminé${fini>1?'s':''}`
      : cours.length ? `${cours.length} en cours · le premier dans ${dur((cours[0].end-Date.now())/1000)}`
      : 'aucun';
  }
  list.innerHTML = sorted.length ? sorted.map(tm=>`<li class="${tm.done?'done':''}"><div><div>${esc(timerLabel(tm))}</div><div class="note">fin à ${formatTime(tm.end, {date: true})}</div></div>
    <div class="row gap-2"><span class="cd" id="cd-${tm.id}">${tm.done?'Terminé':clock((tm.end-Date.now())/1000)}</span><button class="btn sm ghost" data-tmrm="${tm.id}">${tm.done?'OK':'Annuler'}</button></div></li>`).join('')
    : `<li><div class="note">Aucun minuteur. Copie le compte à rebours affiché dans le jeu, colle-le ici et lance.</div></li>`;
}

/* ---------- one alert, one acknowledgment ---------- */
/** In the extension, every alert goes through the background so a single "OK" clears them all. */
function showBigAlert(label){
  try { chrome.runtime.sendMessage({type:'alert', text:label}); } catch(e) {}
}
export function mirrorAlerts(items){
  const box = document.getElementById('bigAlert');
  if(!items || !items.length){ if(!box.hidden) ackFinished(); box.hidden = true; stopFlash(); return; }
  document.getElementById('bigAlertMsg').innerHTML = items.map(esc).join('<br>');
  box.hidden = false;
}
