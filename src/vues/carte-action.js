/* ---------- le rendu d'une action ----------
   Vue de l'issue #49 : une carte d'action du plan (`actHtml`), ses pourquoi
   repliés (`whyParts`), ses pastilles à recopier (`copyChips`), son « Non »
   et la liste de ce qui est de côté (`noBtn`, `noListe`), le compte à rebours
   (`rebours`, `majRebours`), et les noms des niveaux (`SEV_LABEL`). */
import { S } from '../core/etat.js';
import { esc, costHtml, qHtml } from '../core/format.js';
import { dur, formatTime } from '../core/temps.js';
import { SHIPS, parseC, SHIP_PLURAL } from '../flotte/vaisseaux.js';
import { fleetUrl, actGo, goAttr, goNote } from '../jeu/liens.js';
import { clock } from '../minuteurs/minuteurs.js';
import { whyLead } from '../plan/journee.js';
import { dailyMissions, NO_KINDS, actKey, noLabel } from '../plan/missions.js';
import { NIVEAU_SEV } from '../regles/moteur.js';
import { uiOuvert, uiVu, fold } from './navigation.js';
import { routeHtml } from './itineraire.js';
/* Les valeurs à retaper dans le jeu, en pastilles cliquables. Le presse-papier
   reste du côté du joueur : c'est lui qui colle, l'extension ne remplit aucun
   champ — ce serait jouer à sa place, et c'est ce qui fait bannir un compte.
   Les coordonnées sont découpées comme les trois champs du jeu. */
export function copyChips(a){
  const out = [];
  // Ce que le lien fait remplir par le jeu n'a pas à être retapé ; les
  // ressources, elles, restent à saisir à la main.
  if(!fleetUrl(a)){
    for(const [k,n] of Object.entries((a && a.ships) || {})) if(n>0) out.push([SHIPS[k] ? SHIPS[k].n : SHIP_PLURAL[k] || k, String(n)]);
    const c = a && a.dest ? parseC(a.dest) : null;
    if(c) [['galaxie',c[0]],['système',c[1]],['position',c[2]]].forEach(x=>out.push([x[0], String(x[1])]));
  }
  const RES = ['métal','cristal','deutérium'];
  ((a && a.res) || []).forEach((x,j)=>{ if(x>0) out.push([RES[j], String(Math.floor(x))]); });
  if(!out.length) return '';
  return `<div class="cp"><span class="cpl">À recopier</span>` + out.map(([l,v])=>`<button class="chip" data-copy="${esc(v)}" aria-label="Copier ${esc(v)}" title="Copier ${esc(v)}">${esc(l)} <b>${esc(v)}</b><span class="ci" aria-hidden="true">⧉</span></button>`).join('') + `</div>`;
}
/* Une carte dit d'abord quoi faire, ce que ça coûte et quand c'est fini : le
   reste — pourquoi cette action, d'où viennent les chiffres, ce que le lien
   fait vraiment — se lit à la demande derrière le ⓘ. Ces phrases restent
   vraies et atteignables ; les empiler sur la carte les rendait illisibles.
   Le ⓘ se pose sur la ligne du type de carte, son texte s'ouvre sous la carte :
   un <details> ne sait pas séparer son résumé de son corps, d'où ce repli à la
   main. `button` est déjà exclu du clic qui ouvre le jeu : le ⓘ ne navigue pas. */
let whyN = 0;
/**
 * @param {string[]} parts les pourquoi, le premier porte la raison
 * @param {string} [key] la carte qui les porte : le ⓘ ouvert le reste au rendu suivant
 * @returns {string[]} [le bouton ⓘ, le texte replié, la raison en une phrase].
 */
export function whyParts(parts, key){
  const p = parts.filter(Boolean);
  if(!p.length) return ['', '', ''];
  const lead = whyLead(p[0]);
  // Un ⓘ qui rouvrirait la phrase déjà lue sur la carte ne sert à rien.
  if(p.length === 1 && lead === p[0]) return ['', '', lead];
  const id = 'why' + (++whyN);
  /* Le repli ne redit pas la phrase que la carte porte déjà : il reprend le
     premier pourquoi à partir d'où elle s'arrête. Sans ça, ouvrir le ⓘ relit
     la même ligne avant d'arriver aux chiffres, et c'est pour les chiffres
     qu'on l'ouvre. */
  const reste = p[0].startsWith(lead) ? p[0].slice(lead.length).replace(/^[\s·.]+/, '') : p[0];
  const corps = (reste ? [reste] : []).concat(p.slice(1));
  /* L'identifiant du DOM reste un compteur : la même carte peut se dessiner
     deux fois (maintenant et plus tard dans la journée). L'état, lui, suit la
     carte. */
  const sec = key ? key + '.pourquoi' : '', ouvert = sec && uiOuvert(sec, false);
  return [`<button class="i" type="button" aria-expanded="${ouvert ? 'true' : 'false'}" aria-controls="${id}"${sec ? ` data-ui="${esc(sec)}"` : ''} aria-label="Pourquoi cette action">ⓘ</button>`,
    `<div class="why" id="${id}"${ouvert ? '' : ' hidden'}>${corps.map(x=>`<p>${esc(x)}</p>`).join('')}</div>`,
    lead];
}
export function actHtml(a, withBtn){
  const ck = actKey(a); uiVu(ck);
  const [wi, wb, lead] = whyParts([a.why,
    a.src==='estimé' ? 'Prix et durée estimés d\'après les niveaux déjà vus, pas lus sur le jeu ; la durée est probablement sous-estimée.' : a.src==='lu' && a.at ? `Prix lu à ${formatTime(a.at)}.` : '',
    goNote(a)], ck);
  /* Une carte qui déplace des vaisseaux d'une planète à l'autre dit d'où,
     vers où, quoi et quand dans son itinéraire (ENH-83) : la durée et l'heure
     y sont libellées, la ligne du bas ne garde que les pastilles à recopier.
     Un Transporter revient à son départ, un Stationner non. */
  const route = a.kind === 'transfer' && a.dest ? routeHtml({src:S.planets[a.p], dest:a.dest, ships:a.ships, res:a.res, dur:a.dur, end:a.end,
    retour:a.mission === 3 && a.end && a.dur ? a.end + a.dur*1000 : 0, suite:a.suite}) : '';
  const m = [a.cost ? costHtml(a.cost) : '', a.dur && !route ? `<span class="mono">${dur(a.dur)}</span>` : '', a.end && !route ? `<span>fin ${formatTime(a.end)}</span>` : '', copyChips(a)].filter(Boolean).join('');
  let btn = '';
  if(withBtn && a.kind==='fleet') btn = `<button class="btn sm" data-sent="1">Envoyé</button>`;
  else if(withBtn) btn = `<button class="btn sm primary" data-launch='${esc(JSON.stringify({kind:a.kind,k:a.k,lvl:a.lvl,pid:(S.planets[a.p]||{}).id,n:a.n,id:a.id,ships:a.ships,cost:a.cost,coords:a.coords,dur:Math.round(a.dur),what:a.what}))}'>Lancé</button>`;
  if(withBtn && NO_KINDS[a.kind]) btn = `<span class="btns">${btn}${noBtn(actKey(a))}</span>`;
  /* Le niveau qu'un constat a donné à la carte : la carte du plan est la
     réponse à la règle, c'est donc sur elle qu'il se lit. */
  const niv = a.niveau ? `<span class="pill ${NIVEAU_SEV[a.niveau]}">${SEV_LABEL[NIVEAU_SEV[a.niveau]]}</span> ` : '';
  return `<li data-ck="${esc(ck)}"${goAttr(actGo(a))}><div><div class="q">${niv}${qHtml(a.q)}${wi}</div><div class="w">${esc(a.titre || a.what)}</div>${route}${lead?`<div class="but">${esc(lead)}</div>`:''}</div>${btn||'<span></span>'}${m?`<div class="m">${m}</div>`:''}${wb}</li>`;
}

/** Le compte à rebours, « 1 h 02 min 05 s », relu chaque seconde. */
export function rebours(ms){ const s = Math.max(0, Math.round((ms - Date.now()) / 1000)); return clock(s); }
export function majRebours(){
  try{ document.querySelectorAll('[data-impact]').forEach(el => { el.textContent = rebours(+el.dataset.impact); }); }catch(e){}
}
export function noBtn(key){ return `<button class="btn sm ghost" data-no="${esc(key)}" title="Ne plus proposer ça">Non</button>`; }
/**
 * Ce qui est de côté, une ligne par carte, avec son propre « Remettre ».
 * Un seul bouton en bloc obligeait à tout reprendre pour récupérer une carte —
 * et surtout il ne disait pas ce qui était écarté : un compte, pas une liste.
 * @returns {string} vide quand rien n'est de côté
 */
export function noListe(){
  const keys = Object.keys(S.daily.no);
  if(!keys.length) return '';
  // Les missions ne se nomment qu'en les recalculant : on ne le fait que s'il
  // y en a une de côté.
  const miss = keys.some(k=>k.slice(0,2) === 'm:') ? dailyMissions() : [];
  const lignes = keys.map(k=>`<div class="row"><span class="note grow">${esc(noLabel(k, miss))}</span><button class="btn sm ghost" data-noone="${esc(k)}">Remettre</button></div>`).join('');
  return `<details class="volet"${fold('refus', false)}><summary class="note" data-fold="refus">Cartes mises de côté (${keys.length})</summary>
    <div class="mt-2">${lignes}</div>
    <p class="note">Un « Non » met la carte de côté jusqu'à ce que tu la remettes : rien ne la ramène tout seul.</p>
    ${keys.length>1 ? `<div class="row"><button class="btn sm ghost" data-noclear="1">Tout remettre</button></div>` : ''}
  </details>`;
}
/* Un seul vocabulaire de niveau dans tout le panneau : celui des règles du
   moteur. « Urgent » ici et « Critique » là se liraient comme deux échelles. */
export const SEV_LABEL = {bad:'Critique', warn:'Important', info:'Conseil', good:'Prêt'};
