/* ---------- la météo de l'empire ----------
   Un coup d'œil, sans lire : une icône pour l'empire, et pour chaque planète
   une icône et quatre pastilles — Sécurité, Activité, Économie, Défense.

   La météo n'a AUCUNE règle à elle. Elle ne fait que relire les niveaux que les
   autres modules ont déjà posés : les constats du moteur de règles (rules.json),
   les alertes de planetAlerts qui ne viennent pas d'une règle, les mouvements
   de flotte hostiles que le jeu affiche, et le palier du modèle de défense
   (defPlan). Un seuil changé dans rules.json change la météo sans une ligne
   ici ; une règle de météo qui dirait autre chose que le reste du panneau
   ferait lire deux copilotes qui se contredisent.

   Module ES, importé par app.js et important d'app.js (S, constatsVus,
   planetAlerts, defPlan…) : ce cycle tient parce que les fonctions n'y
   touchent qu'à l'appel, jamais au chargement — le module s'évalue avant
   app.js, comme quand il était un script chargé avant lui.
   Lecture seule : rien ici ne navigue, ne remplit ni n'envoie quoi que ce soit. */

import { S } from './core/etat.js';
import { fmt, esc, planetRef } from './core/format.js';
import { planetById } from './core/planetes.js';
import { formatTime } from './core/temps.js';
import { DEF, DEF_ABR, defPlan } from './defense/defense.js';
import { poidsCat } from './plan/profil.js';
import { SEV_NIVEAU, constatsVus } from './regles/moteur.js';
import { render, planetAlerts } from '../app.js';

/** Les quatre domaines, dans l'ordre des colonnes. */
const METEO_DOM = [
  {k:'sec', court:'Séc', n:'Sécurité'},
  {k:'act', court:'Act', n:'Activité'},
  {k:'eco', court:'Éco', n:'Économie'},
  {k:'def', court:'Déf', n:'Défense'},
];
/* Le domaine d'une règle (rules.json) vers le domaine de la météo. Une règle
   d'un domaine inconnu ne colore rien plutôt que de colorer au hasard. */
const METEO_DE_REGLE = {ressources:'eco', installations:'act', recherche:'act', formes_de_vie:'act'};
/* Les missions d'une flotte qui vient chez soi pour nuire : attaquer (1),
   attaque groupée (2), détruire une lune (9) ; espionner (6) n'est qu'un
   avertissement. */
const METEO_ATTAQUE = new Set([1, 2, 9]), METEO_ESPION = 6;

/* Les quatre états, du meilleur au pire. Le rang sert de comparaison. Les
   icônes sont en SVG intégré, en `currentColor` : elles prennent la couleur
   du thème, clair ou sombre, sans une couleur en dur. */
const METEO_SVG = {
  soleil: '<circle cx="12" cy="12" r="4.2" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></g>',
  nuageux: '<path d="M7 18.5h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.4A3.3 3.3 0 0 0 7 18.5z" fill="currentColor"/>',
  orage: '<path d="M7 15.5h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.4A3.3 3.3 0 0 0 7 15.5z" fill="currentColor"/><path d="M12.8 14.5l-2.6 4.2h2.4l-1.4 3.8 4-5.2h-2.5l1.6-2.8z" fill="currentColor"/>',
  tempete: '<g stroke="currentColor" stroke-width="2.1" stroke-linecap="round" fill="none"><path d="M3.5 5h17"/><path d="M5.5 9h13"/><path d="M8 13h9"/><path d="M10 17h5.5"/><path d="M12 21h2"/></g>',
};
const METEO_ETATS = [
  {k:'soleil',  n:'Soleil',  sev:'good'},
  {k:'nuageux', n:'Nuageux', sev:'warn'},
  {k:'orage',   n:'Orage',   sev:'bad'},
  {k:'tempete', n:'Tempête', sev:'bad'},
];
const meteoIcone = (rang, cls) => { const e = METEO_ETATS[rang] || METEO_ETATS[0];
  return `<svg class="mt-ico mt-${e.k}${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">${METEO_SVG[e.k]}</svg>`; };

/* ---------- le calcul : des fonctions pures ----------
   Un élément est {pid, dom, niveau, txt, tempete?}. Les trois fonctions ne
   lisent que la liste qu'on leur donne : le harnais les teste sans DOM, et le
   même empire donne toujours la même météo. */

/** La couleur d'une pastille : 'bad' si un Critique, 'warn' si un Important,
    'good' sinon — un simple Conseil ne dégrade pas la météo. */
function domainColor(elems, pid, dom){
  let c = 'good';
  for(const e of elems || []){
    if(e.pid !== pid || e.dom !== dom) continue;
    if(e.niveau === 'critique') return 'bad';
    if(e.niveau === 'important') c = 'warn';
  }
  return c;
}
/** Le rang de la météo d'une planète : 3 Tempête (attaque hostile entrante),
    2 Orage (une pastille rouge), 1 Nuageux (une orange), 0 Soleil. */
function planetWeather(elems, pid){
  if((elems || []).some(e => e.pid === pid && e.tempete)) return 3;
  const cs = METEO_DOM.map(d => domainColor(elems, pid, d.k));
  return cs.includes('bad') ? 2 : cs.includes('warn') ? 1 : 0;
}
/** La pire météo des planètes : Tempête > Orage > Nuageux > Soleil. */
function empireWeather(elems, pids){
  return (pids || []).reduce((m, pid) => Math.max(m, planetWeather(elems, pid)), 0);
}
/** Les causes d'une planète, par domaine : « Activité : file vide · Économie :
    deut plein », ou « Tout va bien ». Seuls Critique et Important s'y lisent :
    ce sont eux qui colorent. */
function meteoCauses(elems, pid){
  const parts = [];
  for(const d of METEO_DOM){
    const l = (elems || []).filter(e => e.pid === pid && e.dom === d.k && (e.niveau === 'critique' || e.niveau === 'important'));
    if(l.length) parts.push(`${d.n} : ${[...new Set(l.map(e => e.txt))].join(', ')}`);
  }
  return parts.length ? parts.join(' · ') : 'Tout va bien';
}

/* ---------- la collecte : ce que les autres modules ont déjà dit ---------- */

/* La cause en quelques mots : la phrase du constat sans le « sur Erablis »
   qu'elle porte quand l'empire a plusieurs planètes — la ligne le dit déjà. */
function meteoCourt(txt, sur){
  let t = String(txt || '');
  if(sur && t.endsWith(sur)) t = t.slice(0, -sur.length);
  t = t.trim();
  return t ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}
/** Les flottes hostiles en route vers une planète, d'après les mouvements de
    flotte du jeu : arrivée à venir, partie d'ailleurs que de chez soi. */
function meteoHostiles(){
  const mes = new Set((S.planets || []).map(p => p.coords).filter(Boolean)), now = Date.now();
  return (S.moves || []).filter(m => m && !m.ret && m.dest && mes.has(m.dest) && !mes.has(m.origin)
    && (METEO_ATTAQUE.has(m.mission) || m.mission === METEO_ESPION) && +m.arrival * 1000 > now);
}
/**
 * Tout ce qui colore la météo, sur l'état réel. Les éléments ignorés
 * (« Ignorer ») n'y sont pas ; ceux qu'une liste coupe à l'affichage, si.
 * @returns {Array<{pid:string, dom:string, niveau:string, txt:string, tempete?:boolean}>}
 */
function meteoElements(){
  const out = [], ps = S.planets || [];
  // 1. Les constats du moteur de règles, ignorés retirés.
  try{
    for(const c of constatsVus()){
      const dom = METEO_DE_REGLE[c.domaine];
      if(dom) out.push({pid:c.pid, dom, niveau:c.niveau, txt:meteoCourt(c.what, c.vars && c.vars.sur)});
    }
  }catch(e){ meteoErreur('constats', e); }
  // 2. Les alertes qui ne viennent pas d'une règle (emplacements, bridage…).
  for(const p of ps){
    let al = [];
    try{ al = planetAlerts(p); }catch(e){ meteoErreur('alertes', e); }
    for(const a of al){
      const niveau = SEV_NIVEAU[a.sev];
      if(a.regle || !niveau || !a.domaine) continue;
      const dom = METEO_DE_REGLE[a.domaine];
      if(dom) out.push({pid:p.id, dom, niveau, txt:meteoCourt(a.what, S.planets.length > 1 ? ` sur ${p.name}` : '')});
    }
  }
  // 3. La sécurité : ce que les mouvements de flotte du jeu montrent venir.
  for(const m of meteoHostiles()){
    const p = ps.find(x => x.coords === m.dest);
    if(!p) continue;
    const at = typeof formatTime === 'function' ? formatTime(m.arrival * 1000) : '';
    const att = METEO_ATTAQUE.has(m.mission);
    out.push({pid:p.id, dom:'sec', niveau:att ? 'critique' : 'important', tempete:att,
      txt:`${att ? 'attaque' : 'espionnage'} entrant${at ? ' à ' + at : ''}`});
  }
  // 4. La défense : le palier du modèle choisi. Un style qui met la défense à 0
  //    n'en veut pas, et une défense jamais relevée ne dit rien.
  try{
    if(poidsCat('def') !== 0) for(const p of ps){
      const d = defPlan(p);
      if(!d || !(d.palier > 0)) continue;
      const vise = d.lignes.filter(l => l.cible > 0);
      /* Sous 50 % de sa cible : rouge — sauf une pièce que les prérequis
         bloquent encore, que le joueur ne peut pas construire. Elle laisse le
         palier incomplet, donc orange, sans crier. */
      const bas = vise.find(l => l.n < l.cible * .5 && !l.req);
      const abr = k => (typeof DEF_ABR !== 'undefined' && DEF_ABR[k]) ? DEF_ABR[k][0] : (DEF[k] && DEF[k].o) || k;
      const anc = d.lignes.find(l => l.k === d.ancre);
      if(bas) out.push({pid:p.id, dom:'def', niveau:'critique', txt:`${abr(bas.k)} sous la moitié (${fmt(bas.n)} / ${fmt(bas.cible)})`});
      else if(vise.some(l => l.manque > 0)) out.push({pid:p.id, dom:'def', niveau:'important',
        txt:`palier incomplet${anc ? ` (${fmt(anc.n)} / ${fmt(anc.cible)} ${abr(d.ancre)})` : ''}`});
    }
  }catch(e){ meteoErreur('défense', e); }
  return out;
}
/* Une source cassée ne casse pas la météo : elle le dit une fois, et les
   autres continuent de colorer. */
const _meteoErr = new Set();
function meteoErreur(quoi, e){ if(_meteoErr.has(quoi)) return; _meteoErr.add(quoi); console.error(`Copilote : météo, ${quoi} illisible`, e); }

/* ---------- le filtre par planète ----------
   Un état de session : il ne s'écrit nulle part, et un rechargement du panneau
   le retire. Il ne change rien dans le jeu — aucune navigation. */
let filterPlanet = null;
/** La planète filtrée, si elle existe encore. */
export function meteoFiltre(){ const p = filterPlanet && planetById(filterPlanet); if(filterPlanet && !p) filterPlanet = null; return p || null; }
/**
 * Vrai si l'élément du panneau (carte, attente, alerte, mission) concerne la
 * planète filtrée, ou s'il n'y a pas de filtre. Un élément qui ne dit pas sa
 * planète (l'empire entier) se cache sous le filtre : seules les cartes de la
 * planète restent.
 */
export function meteoVoit(x){
  const p = meteoFiltre();
  if(!p) return true;
  return carteSur(x, p);
}
/**
 * Vrai si l'élément (carte, attente, alerte, mission) concerne la planète p :
 * par son identifiant, son rang, ou ses étiquettes. Le filtre de la météo et
 * la fraîcheur du relevé (ENH-77) se posent la même question.
 */
export function carteSur(x, p){
  if(!x || !p) return false;
  if(typeof x === 'string') return x === p.id;
  if(x.pid) return x.pid === p.id;
  if(Number.isInteger(x.p)) return S.planets[x.p] === p;
  if(Array.isArray(x.tags)) return x.tags.some(t => t === p.name || t === planetRef(p));
  return false;
}

/* ---------- le dessin ---------- */
const METEO_CLS = {good:'mt-good', warn:'mt-warn', bad:'mt-bad'};
function meteoHtml(elems){
  const ps = S.planets || [], rang = empireWeather(elems, ps.map(p => p.id)), e = METEO_ETATS[rang];
  /* Un panneau volant ne se retient pas : rouvert au chargement, il
     couvrirait les cartes que le joueur vient lire (ENH-77). */
  const ouvert = meteoOuvert;
  const ligne = p => {
    const r = planetWeather(elems, p.id), causes = meteoCauses(elems, p.id), f = filterPlanet === p.id;
    return `<tr data-meteo-p="${esc(p.id)}" title="${esc(causes)}" class="${f ? 'mt-on' : ''}" tabindex="0" aria-label="${esc(`${p.name} : ${METEO_ETATS[r].n}. ${causes}`)}">
      <td class="mt-w ${METEO_CLS[METEO_ETATS[r].sev]}">${meteoIcone(r)}</td><td class="mt-n">${esc(planetRef(p))}</td>
      ${METEO_DOM.map(d => { const c = domainColor(elems, p.id, d.k); return `<td class="mt-d"><i class="mt-dot ${METEO_CLS[c]}" title="${esc(d.n)}"></i></td>`; }).join('')}</tr>`;
  };
  /* L'icône seule dans l'en-tête, à la couleur de la pire planète ; son nom
     et l'état se lisent au survol et par le lecteur d'écran. */
  return `<button type="button" class="mt-band" data-meteo-tog="1" aria-expanded="${ouvert}" aria-haspopup="true" aria-label="${esc(`Météo de l'empire : ${e.n}`)}" title="${esc(`Météo : ${e.n} — ${ouvert ? 'fermer' : 'voir les planètes'}`)}">
      <span class="${METEO_CLS[e.sev]}">${meteoIcone(rang, 'mt-big')}</span></button>
    <div class="mt-grid mt-pop"${ouvert ? '' : ' hidden'}>
      <table><thead><tr><th></th><th>Planète</th>${METEO_DOM.map(d => `<th><abbr title="${d.n}">${d.court}</abbr></th>`).join('')}</tr></thead>
      <tbody>${ps.map(ligne).join('')}</tbody></table>
      <p class="mt-leg">${METEO_ETATS.map((x, i) => `<span class="${METEO_CLS[x.sev]}">${meteoIcone(i)}</span>${x.n}`).join(' ')}</p>
    </div>`;
}
/** La puce du filtre, en haut des cartes. */
function meteoPuceHtml(){
  const p = meteoFiltre();
  return p ? `<span class="mt-puce">Filtré : ${esc(planetRef(p))}<button type="button" data-meteo-off="1" aria-label="Retirer le filtre" title="Retirer le filtre">✕</button></span>` : '';
}
/** Redessine le bandeau, la grille et la puce. Appelée à chaque recalcul. */
export function renderMeteo(){
  const box = document.getElementById('meteo'), puce = document.getElementById('meteoFiltre');
  if(box){ let el = []; try{ el = meteoElements(); }catch(e){ meteoErreur('calcul', e); } box.innerHTML = meteoHtml(el); }
  if(puce){ puce.innerHTML = meteoPuceHtml(); puce.hidden = !filterPlanet; }
}
/* Le panneau de la météo, ouvert ou non : en mémoire seulement. */
let meteoOuvert = false;
/** Ouvre le panneau accroché à l'icône. */
export function meteoOuvre(){ meteoOuvert = true; renderMeteo(); }
/** Le ferme ; `focus` rend la main à l'icône, comme après un Échap. */
export function meteoFerme(focus){
  if(!meteoOuvert) return;
  meteoOuvert = false; renderMeteo();
  if(focus){ const b = document.getElementById('meteo'), t = b && b.querySelector && b.querySelector('[data-meteo-tog]'); if(t && t.focus) t.focus(); }
}
/** Un clic n'importe où dans le panneau latéral : hors de la météo, il la ferme. */
export function meteoDehors(cible){
  if(meteoOuvert && !(cible && cible.closest && cible.closest('#meteo'))) meteoFerme(false);
}
/** Une touche : Échap ferme. */
export function meteoTouche(e){
  if(meteoOuvert && e && e.key === 'Escape') meteoFerme(true);
}
/* Les clics vivent hors de #view : l'icône, le panneau et la puce ne sont pas
   redessinés par render(), ils ont donc leur propre écoute, posée une fois. */
export function meteoBind(){
  const box = document.getElementById('meteo'), puce = document.getElementById('meteoFiltre');
  /* Choisir une planète la montre : le panneau se ferme sur les cartes filtrées. */
  const choisir = tr => { const pid = tr.dataset.meteoP; filterPlanet = filterPlanet === pid ? null : pid; meteoOuvert = false; render(); };
  if(box && box.addEventListener){
    box.addEventListener('click', e => {
      const t = e.target && e.target.closest ? e.target : null; if(!t) return;
      if(t.closest('[data-meteo-tog]')){ meteoOuvert ? meteoFerme(false) : meteoOuvre(); return; }
      const tr = t.closest('[data-meteo-p]'); if(tr) choisir(tr);
    });
    box.addEventListener('keydown', e => {
      const tr = e.target && e.target.closest && e.target.closest('[data-meteo-p]');
      if(tr && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault && e.preventDefault(); choisir(tr); }
    });
  }
  if(document.addEventListener){
    document.addEventListener('click', e => meteoDehors(e.target));
    document.addEventListener('keydown', meteoTouche);
  }
  if(puce && puce.addEventListener) puce.addEventListener('click', e => {
    if(e.target && e.target.closest && e.target.closest('[data-meteo-off]')){ filterPlanet = null; render(); }
  });
}
