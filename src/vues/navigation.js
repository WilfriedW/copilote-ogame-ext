/* ---------- la navigation ----------
   L'onglet affiché (`tab`) et la vue où l'on dessine (`view`) ; ce qui est
   ouvert ou fermé et pour combien de temps (`UI`, `uiOuvert`, `fold`) ; les
   cartes empilées ou en onglets, avec les onglets de chaque page (`CARTES`,
   `VUES_ONGLETS`, `cardLayout`, `cartesSync`) ; les renvois cliquables
   (`lierRenvois`) ; le nombre de cartes par liste (`LISTES`, `applyLimit`) ;
   et le dessin qui ne fait pas sauter la vue (`garderVue`).

   Module des vues (issue #49), calé sur ENH-75. `tab` se change par
   `poseOnglet`, un import ne se réassignant pas. Le contenu de chaque onglet
   (`VIEWS`, `REFRESH`), les événements, et `render` et `refresh`, qui
   appellent tous les modules de vue et que tous rappellent, restent dans app.js jusqu'aux PR
   suivantes : ce cycle-là est toléré tant qu'app.js existe, et rien n'y est
   lu au chargement. */
import { KEY, S } from '../core/etat.js';
import { esc } from '../core/format.js';
import { syncFailed } from '../synchro/synchro.js';
import { bascule } from './commun.js';
import { render, on } from '../../app.js';

/* ---------- views ---------- */
export const view = document.getElementById('view');
/* ---------- la barre principale (ENH-75) ----------
   Un onglet, un rôle : le quotidien, l'état des planètes, ce que le joueur
   vise, la défense, puis les outils. La barre est écrite d'ici, et nulle part
   ailleurs : sidepanel.html et le code ne peuvent plus diverger. */
export const ONGLETS = [['today',"Aujourd'hui"],['empire','Empire'],['niveaux','Recherche / Cibles'],['defense','Défense'],['tools','Outils']];
/**
 * Les onglets principaux dans l'ordre de la barre : Outils toujours le plus à
 * droite, quel que soit l'ordre où la liste est écrite. Un onglet ajouté demain
 * se range donc à sa gauche sans qu'on y pense.
 * @param {Array<[string,string]>} [liste]
 */
export function ongletsPrincipaux(liste = ONGLETS){ return [...liste.filter(([k])=>k!=='tools'), ...liste.filter(([k])=>k==='tools')]; }
/** Le HTML de la barre principale. */
export function barreHtml(liste){ return ongletsPrincipaux(liste).map(([k, l])=>`<button role="tab" data-tab="${esc(k)}">${esc(l)}</button>`).join(''); }
/** Un onglet retenu qui n'existe plus (une version d'avant, un autre poste) rouvre sur Aujourd'hui. */
export function ongletValide(k){ return k === 'settings' || ONGLETS.some(([x])=>x===k) ? k : 'today'; }
export let tab = 'today';
try{ tab = LS.getItem(KEY+'-tab') || 'today'; }catch(e){}
tab = ongletValide(tab);
export function poseOnglet(v){ tab = v; }
/* ---------- ce qui est ouvert, ce qui est fermé ----------
   Un panneau latéral est étroit : tout déplié, Aujourd'hui se lit en trois
   écrans de défilement. Les sections qui ne servent pas à chaque passage se
   replient donc, et se souviennent : le panneau se redessine en entier à chaque
   plan (innerHTML), et toute ouverture tenue par le seul DOM se perdait au
   passage suivant — c'est ce qui repliait « Comment faire » dès qu'une autre
   carte apparaissait.

   L'état vit donc ici, par identifiant stable, jamais par rang ni par texte :
   - carte fixe : son nom déclaré (`expeditions`, `journee`…), le même sur
     toutes les planètes ;
   - carte dynamique : `missionKey()`, ce qui définit la recommandation
     (type, règle, planète, cible) et rien de ce qui bouge sans elle ;
   - section : `{carte}.{section}`, ex. `…:2-430-16.comment-faire`.
   Le tout est propre au poste : chrome.storage.local, hors de S (qui part dans
   save.json) et hors de la synchro. boot.js le lit avant le premier rendu,
   sinon le panneau s'ouvrirait fermé puis se rouvrirait.
   Seul un clic du joueur écrit : une ouverture forcée par une alerte passe par
   `force`, qui ne touche pas au choix enregistré. */
const UI_GARDE_MS = 7*24*3600e3;
/* Une date de dernière apparition se réécrit au plus une fois l'heure : le
   panneau se redessine toutes les 30 s, et l'âge ne compte qu'en jours. */
const UI_VU_PAS_MS = 3600e3;
export const UI = {etats: {}, vus: {}};
var uiT = 0;
/**
 * Oublie les cartes dynamiques disparues depuis plus de sept jours, avec leurs
 * sections. Une carte revenue entre-temps a vu sa date rafraîchie : elle reste.
 * @returns {boolean} vrai si quelque chose a été effacé
 */
export function uiPurge(now){
  let n = 0;
  for(const [k, iso] of Object.entries(UI.vus)){
    if(now - Date.parse(iso) <= UI_GARDE_MS) continue;
    delete UI.vus[k]; n++;
    for(const e of Object.keys(UI.etats)) if(e === k || e.startsWith(k + '.')) delete UI.etats[e];
  }
  return n > 0;
}
/** Écrit le store tout de suite. */
export function uiEcrit(){
  clearTimeout(uiT); uiT = 0;
  if(typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
  try{ const r = chrome.storage.local.set({uiState: Object.assign({}, UI.etats), uiSeen: Object.assign({}, UI.vus)}); if(r && r.catch) r.catch(e=>console.error('Copilote : affichage des cartes non enregistré', e)); }
  catch(e){ console.error('Copilote : affichage des cartes non enregistré', e); }
}
/* Trois clics d'affilée ne font qu'une écriture. */
function uiPlusTard(){ clearTimeout(uiT); uiT = setTimeout(uiEcrit, 300); }
/**
 * Ouvert ou fermé, au moment du rendu.
 * @param {string} id identifiant stable de la carte ou de la section
 * @param {boolean} def l'état par défaut déclaré, pour une carte jamais touchée
 * @param {boolean} [force] une alerte critique l'ouvre, sans rien enregistrer
 */
export function uiOuvert(id, def, force){
  if(force) return true;
  const v = UI.etats[id];
  return v ? v === 'open' : !!def;
}
/** Le choix du joueur, au clic. */
export function uiNote(id, ouvert){ UI.etats[id] = ouvert ? 'open' : 'closed'; uiPlusTard(); }
/** Une carte dynamique vient d'être dessinée : sa date de dernière apparition avance. */
export function uiVu(key){
  const now = Date.now(), d = UI.vus[key];
  if(d && now - Date.parse(d) < UI_VU_PAS_MS) return;
  UI.vus[key] = new Date(now).toISOString(); uiPlusTard();
}
/** « Réinitialiser l'affichage des cartes » : chaque carte reprend son défaut. */
export function uiReset(){ UI.etats = {}; UI.vus = {}; uiEcrit(); }
/** L'attribut `open` d'un <details>, lu dans le store. */
export function fold(name, def, force){ return uiOuvert(name, def, force) ? ' open' : ''; }
/**
 * Une carte titrée, repliable (ENH-75) : le titre ouvre et ferme, l'état se
 * retient par `cle`. Une carte qui porte un critique ne part pas fermée, et
 * fermée elle montre son compteur, de la couleur du plus grave.
 * @param {string} cle clé de repli
 * @param {string} titre HTML du titre
 * @param {string} corps HTML du contenu
 * @param {{ouvert?:boolean, resume?:{count:number,maxLevel:string}|null, pliable?:boolean, note?:string}} [o]
 *   `pliable` : la carte reste repliable même quand elle est seule dans son onglet
 */
export function carteHtml(cle, titre, corps, o = {}){
  const r = o.resume, crit = r && r.maxLevel === 'crit';
  const cpt = r && r.count ? ` <span class="cpt ${r.maxLevel || 'info'}">(${r.count})</span>` : '';
  return `<details class="card${o.pliable ? ' pliable' : ''}"${fold(cle, !!o.ouvert || !!crit)}><summary data-fold="${esc(cle)}">${titre}${o.note || ''}${cpt}</summary>${corps}</details>`;
}

/* ---------- disposition des cartes : empilées ou en onglets ---------- */
/* Aujourd'hui empile ses cartes, et il faut défiler pour retrouver la bonne.
   Le joueur peut préférer les ranger en onglets — une carte à la fois, avec la
   barre de la section Outils. Les cartes, elles, ne savent pas comment elles
   sont montrées : chacune se déclare (identifiant, titre, fixe ou non, ce
   qu'elle contient) et c'est le conteneur qui les empile ou les range.
   Le mode suit le joueur d'un poste à l'autre (chrome.storage.sync) ; l'onglet
   choisi reste sur la machine (chrome.storage.local), comme l'état des volets. */
/* `var` : header() peut s'exécuter avant que ces lignes soient atteintes.
   ENH-54 : les onglets deviennent le défaut. Seul un joueur qui a choisi
   « empilé » (la valeur est alors écrite dans chrome.storage.sync) le garde ;
   qui n'avait jamais touché au réglage passe en onglets. */
export var cardMode = (typeof window !== 'undefined' && window.__cardLayout === 'stacked') ? 'stacked' : 'tabs';
/** Vue → onglet choisi par le joueur. Seul un clic l'écrit (ou le passage
    d'empilé à onglets, qui retient la carte qu'il lisait). */
export var cardTabs = (()=>{
  const w = typeof window !== 'undefined' ? window.__cardTab : null;
  if(w && typeof w === 'object') return {...w};
  try{ const v = JSON.parse(LS.getItem(KEY+'-cardTab') || 'null'); if(v && typeof v === 'object') return v; }catch(e){}
  return {};
})();
/** Vue → onglet où une alerte critique a fait basculer. Il passe devant le
    choix du joueur tant que sa carte existe, et s'efface au premier clic :
    l'alerte finie, le joueur retrouve son onglet, pas le premier venu. */
export var cardForce = {};
/** Vue → onglet réellement affiché au dernier passage. */
var cardAffiche = {};
/** Les alertes critiques déjà traitées dans cette session du panneau : une
    même alerte ne fait basculer qu'une fois, même si le joueur revient sur
    son onglet. */
var cardCritVus = new Set();
/** Ce que les cartes calculées au rafraîchissement disent contenir. */
export var RESUMES = {};
const NIVEAU_RANG = {crit:3, imp:2, info:1};
/** Le niveau d'un élément : rouge (critique), orange (important), gris (conseil). */
function niveauDe(sev){ return sev === 'bad' ? 'crit' : sev === 'warn' ? 'imp' : 'info'; }
/** Ce qui identifie une alerte sans ses montants : un stock qui grossit ne
    fait pas une nouvelle alerte. */
function critCle(s){ return String(s || '').replace(/[\d\s.,:%]+/g, ' ').trim(); }
/**
 * Le résumé d'une carte, pour son onglet.
 * @param {{sev?:string, key?:string}[]} items les éléments de la carte
 * @param {string} cardId la carte, préfixe des clés d'alerte critique
 * @returns {{count:number, maxLevel:string|null, critiques:string[]}}
 */
export function resumeDe(items, cardId){
  let max = null; const critiques = [];
  for(const x of items){
    const n = niveauDe(x.sev);
    if(!max || NIVEAU_RANG[n] > NIVEAU_RANG[max]) max = n;
    if(n === 'crit' && x.key) critiques.push(cardId + ':' + critCle(x.key));
  }
  return {count: items.length, maxLevel: max, critiques};
}
/* La déclaration des cartes, dans l'ordre de la pile. Une carte fixe a
   toujours son onglet ; une carte dynamique n'en a que si elle contient
   quelque chose. `getSummary` dit combien d'éléments et le plus grave. */
export const CARTES = {
  /* Le profil est un réglage : il vit dans l'onglet Mon jeu des Réglages (ENH-75), et
     Maintenant y renvoie tant qu'il n'est pas posé. */
  today: [
    /* Une attaque ou un espionnage entrants : la carte n'existe que tant qu'il y en a. */
    {cardId:'attaque', titre:'Attaque', fixe:false, getSummary:()=>RESUMES.attaque},
    {cardId:'maintenant', titre:'Maintenant', fixe:true, getSummary:()=>RESUMES.maintenant},
    /* Une ressource au plafond, ou qui va l'atteindre : la carte n'existe que tant qu'il y en a. */
    {cardId:'surplus', titre:'Ressources en trop', fixe:false, getSummary:()=>RESUMES.surplus},
    {cardId:'alertes', titre:'Alertes', fixe:false, getSummary:()=>RESUMES.alertes},
    {cardId:'securite', titre:'Sécurité', fixe:true, getSummary:()=>RESUMES.securite},
    {cardId:'expeditions', titre:'Expéditions', fixe:true, getSummary:()=>RESUMES.expeditions},
  ],
  /* Réglages (ENH-54) : cinq onglets, chacun un groupe de cartes. Toujours en
     onglets, quel que soit le choix d'Aujourd'hui (voir VUES_ONGLETS). */
  /* Empire : l'état des planètes, rien d'autre. La recherche et les niveaux
     visés ont leur onglet, Recherche / Cibles (ENH-75). */
  empire: [
    {cardId:'planetes', titre:'Planètes', fixe:true},
  ],
  settings: [
    {cardId:'jeu', titre:'Mon jeu', fixe:true},
    {cardId:'defense', titre:'Défense et sécurité', fixe:true},
    {cardId:'affichage', titre:'Affichage', fixe:true},
    {cardId:'moteur', titre:'Moteur', fixe:true},
    {cardId:'donnees', titre:'Données', fixe:true},
  ],
};
/* Les vues toujours rangées en onglets : « Empiler les sections » ne vaut que
   pour Aujourd'hui. Treize cartes de réglages empilées, c'est la page qu'on
   ne veut plus. */
export const VUES_ONGLETS = new Set(['settings']);
/* L'onglet ouvert quand le joueur n'en a choisi aucun. Pour Aujourd'hui, ce
   n'est pas le premier : une fois le profil posé, l'onglet Profil n'en montre
   que le résumé, et le joueur vient chercher Maintenant. */
const CARTE_DEFAUT = {today: ()=> 'maintenant'};
/** La vue se range-t-elle en onglets ? */
/* Une vue d'une seule carte n'a pas de barre : Empire n'a plus que Planètes (ENH-75). */
function enOnglets(vue){ return VUES_ONGLETS.has(vue) || (cardMode === 'tabs' && CARTES[vue] && CARTES[vue].length > 1); }
const CPT_TITRE = {crit:'dont au moins un urgent', imp:'dont au moins un important', info:'des conseils'};
/**
 * La barre d'onglets du panneau, la même partout (Outils, cartes en onglets) :
 * `.seg`, qui défile en largeur quand les onglets ne tiennent pas.
 * @param {Array<[string, string, {count:number, maxLevel:string}?]>} items clé, libellé, compteur
 * @param {string} attr l'attribut qui porte la clé (data-tool, data-carte-tab)
 * @param {string} sel la clé sélectionnée
 */
export function segTabs(items, attr, sel){
  return items.map(([k, l, n])=>{
    const cpt = n && n.count ? ` <span class="cpt ${n.maxLevel || 'info'}" title="${n.count} élément${n.count>1?'s':''}, ${CPT_TITRE[n.maxLevel || 'info']}">(${n.count})</span>` : '';
    return `<button role="tab" ${attr}="${esc(k)}" aria-selected="${sel===k}">${esc(l)}${cpt}</button>`;
  }).join('');
}
/**
 * Le conteneur des cartes : il les empile, ou les range en onglets.
 * @param {string} vue la vue, clé de CARTES
 * @param {Object<string,string>} html le HTML de chaque carte, par cardId
 */
export function cardLayout(vue, html){
  const tabs = enOnglets(vue);
  const corps = CARTES[vue].map(c=>`<div class="carte" data-carte="${c.cardId}">${html[c.cardId] || ''}</div>`).join('');
  return `<section class="panel${tabs ? ' en-onglets' : ''}" data-disposition="${vue}">${tabs ? '<div class="seg" role="tablist" id="carteTabs" aria-label="Sections"></div>' : ''}${corps}</section>`;
}
export function cartesSection(){ const s = view.querySelector('[data-disposition]'); return s && s.dataset && s.dataset.disposition && CARTES[s.dataset.disposition] ? s : null; }
/** Les cartes qui ont un onglet, avec leur résumé. */
function cartesPresentes(vue){
  return CARTES[vue].map(c=>({c, r:(c.getSummary && c.getSummary()) || null}))
    .filter(({c, r})=>c.fixe || (r && r.count > 0));
}
/**
 * La carte de la première alerte critique jamais vue, ou null. `vus` est
 * complété au passage : une alerte ne fait basculer qu'une fois par session.
 * Sorti de cartesSync, qui lit le DOM, pour se vérifier sans lui.
 */
function alerteNeuve(presentes, vus){
  let bascule = null;
  for(const {c, r} of presentes) for(const k of (r && r.critiques) || []){
    if(vus.has(k)) continue;
    vus.add(k); if(!bascule) bascule = c.cardId;
  }
  return bascule;
}
/** L'onglet à montrer : la bascule d'alerte d'abord, puis le choix du joueur, puis le défaut de la vue, puis le premier. */
function ongletAffiche(ids, force, choisi, defaut){
  const voulu = force && ids.includes(force) ? force : ids.includes(choisi) ? choisi : defaut;
  return ids.includes(voulu) ? voulu : ids[0];
}
/**
 * Pose l'onglet affiché, la barre et ses compteurs, après chaque rafraîchissement.
 * En mode empilé, elle ne fait que noter les alertes critiques déjà vues.
 */
export function cartesSync(){
  const sec = cartesSection(); if(!sec) return;
  const vue = sec.dataset.disposition, presentes = cartesPresentes(vue), ids = presentes.map(x=>x.c.cardId);
  /* Une alerte critique jamais vue fait basculer sur sa carte, une fois. Vue
     en mode empilé, elle est vue aussi : passer en onglets ne la rejoue pas. */
  const bascule = alerteNeuve(presentes, cardCritVus);
  if(!enOnglets(vue)){ delete cardAffiche[vue]; return; }
  if(bascule) cardForce[vue] = bascule;
  const affiche = ongletAffiche(ids, cardForce[vue], cardTabs[vue], CARTE_DEFAUT[vue] && CARTE_DEFAUT[vue]());
  cardAffiche[vue] = affiche;
  sec.querySelectorAll('.carte[data-carte]').forEach(w=>{
    const on = w.dataset.carte === affiche;
    w.hidden = !on;
    /* Le contenu de l'onglet est toujours déplié, sans toucher à l'état
       enregistré du volet : revenu en mode empilé, la carte retrouve le sien.
       Les sections internes, elles, gardent le leur. */
    const d = carteDetails(w);
    if(on && d && !d.open) d.open = true;
  });
  const bar = sec.querySelector('#carteTabs');
  if(bar){
    const h = segTabs(presentes.map(({c, r})=>[c.cardId, c.titre, r]), 'data-carte-tab', affiche);
    // réécrite seulement quand elle change : le focus clavier et le défilement de la barre restent
    if(bar.dataset.h !== h){ bar.innerHTML = h; bar.dataset.h = h; }
    if(bascule || bar.dataset.vu !== affiche){
      bar.dataset.vu = affiche;
      const b = bar.querySelector(`[data-carte-tab="${affiche}"]`);
      if(b && b.scrollIntoView) b.scrollIntoView({block:'nearest', inline:'nearest'});
    }
  }
}
/**
 * Le volet qui fait la carte : enfant direct de son enveloppe, ou un cran plus
 * bas quand la carte est dessinée dans un bloc rafraîchi — Alertes vit dans
 * #tdAlerts, que REFRESH réécrit sans toucher à l'enveloppe.
 */
export function carteDetails(w){
  const a = w && w.firstElementChild;
  /* Une carte pliable se replie même seule dans son onglet : Maintenant fermé
     laisse voir Tes priorités juste dessous (ENH-75). */
  if(a && a.tagName === 'DETAILS') return a.classList && a.classList.contains('pliable') ? null : a;
  const b = a && a.firstElementChild;
  return b && b.tagName === 'DETAILS' && b.classList && b.classList.contains('card') ? b : null;
}
/** Le joueur choisit un onglet : il est retenu, et la bascule d'alerte s'efface. */
export function carteChoisie(id){
  const sec = cartesSection(); if(!sec) return;
  const vue = sec.dataset.disposition;
  cardTabs[vue] = id; delete cardForce[vue];
  carteRetiens();
  cartesSync();
}
export function carteRetiens(){
  try{
    if(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local){ const r = chrome.storage.local.set({cardTab: cardTabs}); if(r && r.catch) r.catch(()=>{}); }
    else LS.setItem(KEY+'-cardTab', JSON.stringify(cardTabs));
  }catch(e){}
}
/** Le bas de la barre d'onglets collante : ce qui passe dessous n'est pas lu. */
function carteSeuil(){ const n = document.getElementById('tabs'); const r = n && n.getBoundingClientRect ? n.getBoundingClientRect() : null; return r ? r.bottom : 0; }
/** La carte que le joueur lit en mode empilé : la première visible sous la barre. */
export function carteEnHaut(sec){
  const seuil = carteSeuil() + 8;
  for(const w of sec.querySelectorAll('.carte[data-carte]')){
    const el = w.firstElementChild, r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    if(r && r.height > 0 && r.bottom > seuil) return w.dataset.carte;
  }
  return null;
}
/* La carte que le joueur lisait, notée quand le défilement se pose. L'en-tête
   ne colle pas en haut : pour atteindre l'interrupteur, le joueur remonte, et
   au moment du clic la carte du haut serait toujours la première. On garde
   donc celle où il s'est arrêté de défiler, pas celles qu'il a traversées. */
export var cardLue = {};
/* ---------- renvois cliquables (ENH-54) ----------
   Le texte du panneau renvoie souvent ailleurs : « Outils › Défense dit, planète
   par planète, ce qui manque », « à changer dans Réglages › Plan du jour ». Le
   joueur devait trouver l'onglet, puis le sous-onglet. Ces renvois deviennent
   des liens, posés sur le texte déjà affiché : une phrase écrite demain avec
   un renvoi sera cliquable sans qu'on y pense. */
const RENVOI_RE = /(Réglages|Outils) › (Plan du jour|Formes de vie|Page du jeu|[A-ZÀ-Ý][a-zà-ÿ]+)/g;
/**
 * La cible d'un renvoi, ou null s'il ne mène nulle part de connu.
 * @param {string} zone « Réglages » ou « Outils »
 * @param {string} nom le nom qui suit le ›
 * @returns {string|null} « settings:jeu », « tools:defense »…
 */
function renvoiCible(zone, nom){
  /* Les noms d'avant ENH-75 restent dans de vieux textes et de vieilles
     habitudes : Défense est devenu un onglet, Cibles s'appelle Pillage. */
  const ancien = {'Défense':'defense', 'Cibles':'tools:explore'};
  if(zone === 'Outils'){ const t = TOOLS.find(([, l])=>l === nom); return t ? 'tools:' + t[0] : ancien[nom] || null; }
  const g = {'Profil':'jeu', 'Plan du jour':'jeu', 'Formes de vie':'jeu', 'Bonus':'jeu', 'Énergie':'jeu',
    'Sécurité':'defense', 'Défense':'defense', 'Affichage':'affichage', 'Page du jeu':'affichage',
    'Règles':'moteur', 'Sauvegarde':'donnees', 'Version':'donnees'}[nom];
  return zone === 'Réglages' && g ? 'settings:' + g : null;
}
/** Pose les liens de renvoi dans le texte affiché sous `root`. */
export function lierRenvois(root){
  if(!root || typeof document === 'undefined' || typeof document.createTreeWalker !== 'function') return;
  const w = document.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  const nodes = [];
  for(let n = w.nextNode(); n; n = w.nextNode()){
    RENVOI_RE.lastIndex = 0;
    // Pas dans ce qui se clique déjà, ni dans un résumé de volet (le clic l'ouvrirait).
    if(RENVOI_RE.test(n.nodeValue) && !(n.parentElement && n.parentElement.closest('a,button,summary,option,select,textarea'))) nodes.push(n);
  }
  for(const n of nodes){
    const txt = n.nodeValue, frag = document.createDocumentFragment();
    let last = 0, m;
    RENVOI_RE.lastIndex = 0;
    while((m = RENVOI_RE.exec(txt))){
      const cible = renvoiCible(m[1], m[2]); if(!cible) continue;
      frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
      const a = document.createElement('a');
      a.href = '#'; a.className = 'renvoi'; a.dataset.aller = cible; a.textContent = m[0];
      frag.appendChild(a); last = m.index + m[0].length;
    }
    if(!last) continue;
    frag.appendChild(document.createTextNode(txt.slice(last)));
    n.parentNode.replaceChild(frag, n);
  }
}
/** Fait défiler la pile jusqu'à une carte, juste sous la barre collante. */
function carteDefile(id){
  const w = view.querySelector(`.carte[data-carte="${id}"]`), el = w && w.firstElementChild;
  const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
  if(r && r.height > 0 && typeof window.scrollBy === 'function') window.scrollBy(0, r.top - carteSeuil() - 8);
}
/**
 * Change de disposition, la retient, et redessine sans recharger. La carte
 * lue passe de l'un à l'autre : empilé → onglets, celle du haut devient
 * l'onglet actif ; onglets → empilé, la pile défile jusqu'à l'onglet actif.
 * @param {string} m 'tabs' ou 'stacked'
 * @param {boolean} [distant] venu d'un autre panneau : rien à réécrire
 */
export function setCardMode(m, distant){
  m = m === 'stacked' ? 'stacked' : 'tabs';
  if(m === cardMode) return;
  /* Une vue toujours en onglets (Réglages, d'où se règle ce choix) ne change
     pas : rien à retenir ni à faire défiler. */
  const sec = cartesSection(), dv = sec ? sec.dataset.disposition : null;
  const vue = dv && !VUES_ONGLETS.has(dv) ? dv : null;
  let cible = null;
  if(vue && m === 'tabs'){
    const haut = cardLue[vue] || carteEnHaut(sec);
    if(haut){ cardTabs[vue] = haut; delete cardForce[vue]; carteRetiens(); }
  } else if(vue) cible = cardAffiche[vue];
  cardMode = m;
  if(!distant) try{ if(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync){ const r = chrome.storage.sync.set({cardLayout: m}); if(r && r.catch) r.catch(syncFailed); } }catch(e){ syncFailed(e); }
  render();
  if(cible) carteDefile(cible);
}

/* ---------- combien de cartes par liste ---------- */
/* Une liste qui s'allonge repousse tout le reste sous le pli : le joueur
   choisit combien de cartes chacune montre d'office, une valeur pour toutes et,
   s'il veut, une valeur propre à l'une d'elles. La limite ne touche que
   l'affichage : les cartes masquées sont calculées comme les autres, leurs
   alertes et leurs compteurs aussi — on ne coupe que le HTML.
   Les urgences ne se comptent pas : une carte « Urgent » cachée derrière un
   « Voir plus », c'est exactement ce que la limite ne doit jamais faire.
   Les valeurs vivent dans S.settings, donc dans la synchro entre postes ;
   l'état « Voir plus » dans le store d'affichage (UI), comme les volets
   repliés, propre au poste. */
const CARTES_CHOIX = [1, 3, 5, 10, 'all'];
export const CARTES_DEF = 3;
/* Les listes du panneau, dans l'ordre où Aujourd'hui les montre. L'id est la
   clé de stockage : il ne change pas quand le libellé change. */
const LISTES = [
  ['maintenant', 'Maintenant'],
  ['alertes', 'Alertes'],
  ['expeditions', 'Expéditions'],
  ['attente', 'En attente de ressources'],
  ['encours', 'Déjà en cours'],
];
/** Une valeur de limite valide, ou null : elle vient d'un menu, mais aussi
    d'une sauvegarde ou de l'autre poste. */
export function cartesVal(v){
  if(v === 'all') return 'all';
  const n = typeof v === 'number' || (typeof v === 'string' && v.trim() !== '') ? +v : NaN;
  return CARTES_CHOIX.includes(n) ? n : null;
}
function cartesGlobal(){ return cartesVal((S.settings||{}).cartesMax) || CARTES_DEF; }
function cartesPropre(id){ return cartesVal(((S.settings||{}).cartesListe||{})[id]); }
/** La limite d'une liste : sa valeur propre l'emporte sur la valeur globale. */
function cartesMax(id){ return cartesPropre(id) || cartesGlobal(); }
function cartesLabel(v){ return v === 'all' ? 'Toutes' : String(v); }
/* Les clés inconnues restent : une version plus récente, sur l'autre poste,
   peut connaître une liste que celle-ci ignore, et la lui effacer au retour
   de la synchro serait perdre son réglage. */
export function cartesSain(){
  if(!S.settings || typeof S.settings !== 'object') return;
  S.settings.cartesMax = cartesVal(S.settings.cartesMax) || CARTES_DEF;
  const l = S.settings.cartesListe;
  S.settings.cartesListe = l && typeof l === 'object' && !Array.isArray(l)
    ? Object.fromEntries(Object.entries(l).filter(([k, v]) => /^[\w-]{1,40}$/.test(k) && cartesVal(v)).map(([k, v]) => [k, cartesVal(v)]))
    : {};
}
/**
 * Coupe une liste à sa limite. Chaque carte est `{crit, ...}`, dans l'ordre de
 * priorité existant. Les critiques passent d'abord, toutes, hors limite ; puis
 * les autres, dans leur ordre, jusqu'à la limite.
 */
function applyLimit(cartes, limite){
  const crit = cartes.filter(c => c.crit), autres = cartes.filter(c => !c.crit);
  const n = limite === 'all' ? autres.length : Math.max(0, +limite || 0);
  return {visibles: crit.concat(autres.slice(0, n)), masquees: autres.slice(n)};
}
export const voirPlusCle = id => id + '.voirPlus';
export function voirPlusOuvert(id){ return uiOuvert(voirPlusCle(id), false); }
/** Le menu « Afficher : N » d'en-tête de liste. */
export function cartesMenu(id){
  const v = cartesMax(id), propre = cartesPropre(id) != null;
  return `<label class="cartes-menu note" title="${propre ? 'Valeur propre à cette liste (Réglages › Affichage)' : 'Valeur globale (Réglages › Affichage)'}">Afficher :
    <select data-cartes="${esc(id)}" aria-label="Nombre de cartes affichées">${CARTES_CHOIX.map(c => `<option value="${c}"${c === v ? ' selected' : ''}>${cartesLabel(c)}</option>`).join('')}</select></label>`;
}
/**
 * Le HTML d'une liste limitée : les cartes visibles, le reste dans une seconde
 * liste repliée sur place, et le lien qui la déplie. `cartes` porte `{html,
 * crit}`. Toutes les cartes sont écrites : déplier ne recalcule rien.
 */
export function listeCartes(id, cartes, cls){
  const {visibles, masquees} = applyLimit(cartes, cartesMax(id));
  const ouvert = voirPlusOuvert(id), n = masquees.length;
  const ul = (l, extra, plus) => `<ul class="${cls}${plus || ''}"${extra || ''}>${l.map(c => c.html).join('')}</ul>`;
  if(!n) return ul(visibles);
  return ul(visibles)
    + ul(masquees, ` data-masquees="${esc(id)}"${ouvert ? '' : ' hidden'}`, ' mt-2')
    + `<button class="btn sm ghost voir-plus" data-voirplus="${esc(id)}" data-n="${n}" aria-expanded="${ouvert}">${ouvert ? 'Voir moins' : `Voir ${n} de plus`}</button>`;
}
/** Réglages › Affichage : la valeur globale, puis chaque liste. */
export function affichageCard(){
  const g = cartesGlobal();
  const opts = (v, avecGlobal) => (avecGlobal ? [`<option value=""${v == null ? ' selected' : ''}>Valeur globale (${cartesLabel(g)})</option>`] : [])
    .concat(CARTES_CHOIX.map(c => `<option value="${c}"${c === v ? ' selected' : ''}>${cartesLabel(c)}</option>`)).join('');
  const propres = LISTES.filter(([id]) => cartesPropre(id) != null).length;
  return `<div class="card"><h2>Affichage</h2>
      <div class="bascules">
        ${bascule('sEmpile','data-empile="1"','Empiler les sections', cardMode !== 'tabs', 'Les cartes d\'Aujourd\'hui s\'affichent les unes sous les autres. Décoché, elles se rangent en onglets, une seule affichée à la fois.')}
      </div>
      <div class="grid">
        <label class="f">Nombre de cartes par liste<select id="sCartes" data-cartesg="1">${opts(g, false)}</select><span class="note">Les cartes urgentes s'affichent toujours, en plus. Le reste se déplie avec « Voir plus ».</span></label>
      </div>
      <table class="cartes-table"><thead><tr><th>Liste</th><th>Afficher</th></tr></thead><tbody>
        ${LISTES.map(([id, n]) => `<tr><td>${esc(n)}</td><td><select id="sCartes-${id}" data-cartesl="${id}" aria-label="${esc(n)}">${opts(cartesPropre(id), true)}</select></td></tr>`).join('')}
      </tbody></table>
      <div class="row mt-2"><button class="btn sm ghost" data-cartesreset="1"${propres ? '' : ' disabled'}>Réinitialiser</button><span class="note">${propres ? `${propres} liste${propres > 1 ? 's ont leur' : ' a sa'} propre valeur.` : 'Toutes les listes suivent la valeur globale.'} Le menu « Afficher » en tête de chaque liste règle la même valeur.</span></div>
    </div>`;
}
/* ---------- la vue ne saute pas ----------
   Le rendu remplace les nœuds : l'ancrage de défilement du navigateur
   (overflow-anchor) perd son ancre avec eux et ne corrige rien. On le fait à la
   main : avant le dessin, la carte que le joueur lit — la plus profonde à
   chevaucher le haut de l'écran, sinon la première en dessous — et sa position ;
   après, la même carte, retrouvée par sa clé, et le défilement corrigé de
   l'écart. Tout en haut de la page on ne corrige rien : ce qui apparaît
   au-dessus doit se voir, comme le fait le navigateur. */
/* L'onglet du dernier dessin : un changement d'onglet n'a rien à garder. */
var vueOnglet = null;
function vueAncre(){
  if(vueOnglet !== tab) return null;
  if(typeof window.scrollBy !== 'function' || !(window.scrollY > 0)) return null;
  const nav = document.getElementById('tabs'), haut = nav && nav.getBoundingClientRect ? nav.getBoundingClientRect().bottom : 0;
  let pris = null;
  for(const el of view.querySelectorAll('[data-ck], details > summary[data-fold]')){
    const r = el.getBoundingClientRect(), id = el.dataset.ck || 'fold:' + el.dataset.fold;
    if(r.height === 0) continue;
    if(r.top <= haut && r.bottom > haut) pris = {id, top:r.top};
    else if(r.top > haut){ if(!pris) pris = {id, top:r.top}; break; }
  }
  return pris && Object.assign(pris, {tab});
}
function vueRecale(a){
  if(!a || a.tab !== tab) return;
  for(const el of view.querySelectorAll('[data-ck], details > summary[data-fold]')){
    if((el.dataset.ck || 'fold:' + el.dataset.fold) !== a.id) continue;
    const d = el.getBoundingClientRect().top - a.top;
    if(Math.abs(d) >= 1) window.scrollBy(0, d);
    return;
  }
}
/** Dessine sans faire bouger la carte lue. */
var vueN = 0;
export function garderVue(fn){
  // render() appelle refresh() : seul le dessin le plus extérieur mesure.
  if(vueN) return fn();
  vueN++;
  let a = null;
  try{ a = vueAncre(); }catch(e){}
  try{ fn(); }
  finally{ vueN--; try{ vueRecale(a); }catch(e){} vueOnglet = tab; }
}
/* Les quatre habillages du panneau. La peau ne change que des couleurs et des
   formes dans `panel.css` : aucune vue n'en sait rien, donc les quatre valent
   pour toutes les pages, écran de relevé et bandeaux compris. */
export const HABILLAGES = {relief:'Relief — sobre (par défaut)', domaine:'Une couleur par page', hud:'Console de bord', arcade:'Arcade'};
export const habillage = () => HABILLAGES[S.settings.skin] ? S.settings.skin : 'relief';
/* Un outil retiré laisse son nom dans les réglages du joueur : on ne demande à
   VIEWS que ce qu'il sait encore dessiner. */
/* Minuteurs (ISS-72) : sortis d'Aujourd'hui pour que la barre y tienne ;
   les alertes de fin, elles, ne dépendent pas de l'onglet ouvert. */
/* ENH-75 : la Défense est un onglet principal, et « Cibles » devient Pillage
   pour ne plus se confondre avec Recherche / Cibles. */
export const TOOLS = [['explore','Pillage'],['colony','Colonie'],['fleet','Flotte'],['moon','Lune'],['timers','Minuteurs'],['server','Serveur']];
/* ENH-54 : une carte de réglages ne montre qu'une phrase d'aide ; le reste
   attend derrière « En savoir plus », replié, ouvert ou fermé comme le joueur
   l'a laissé (même store que les volets). Rien n'est retiré : une partie de
   ces textes protège d'une erreur, elle reste à un clic. */
export const aide = (id, html) =>
  `<details class="aide"${fold('aide:' + id, false)}><summary data-fold="aide:${id}">En savoir plus</summary>${html}</details>`;
