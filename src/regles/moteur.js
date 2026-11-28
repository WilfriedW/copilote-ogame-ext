/* ---------- le moteur de règles ----------
   Les règles viennent de rules.json (lu par boot.js dans `window.__rules`),
   complétées des règles de secours ; chacune s'active, se règle et se
   vérifie ici (`regle`, `regleActive`, `regleParam`, `regleSaine`), et les
   évaluateurs d'EVAL en tirent des constats par planète (`constatsDe`,
   `constats`). Ce que le joueur ignore se retient ici aussi, sous la clé
   d'« Ignorer » (`ignKey`).

   Module de domaine (issue #49). Les évaluateurs propres à un domaine —
   ressources en trop, formes de vie — s'inscrivent dans EVAL depuis leur
   domaine, qui l'importe. En attendant que ces domaines quittent app.js,
   ce module emprunte encore à app.js ce qu'il lit (production, stocks,
   style de jeu…) : ce cycle-là est toléré tant qu'app.js existe. */
import { planetById } from '../core/planetes.js';
import { S } from '../core/etat.js';
import { IS_EXT } from '../core/serveur.js';
import { lfMode } from '../plan/place-formes-de-vie.js';
import { poidsCat } from '../plan/profil.js';
import { save } from '../synchro/synchro.js';
import { raceDe, on } from '../../app.js';

/* ---------- les règles du moteur ----------
   Décrites dans rules.json, que boot.js lit avant ce fichier et pose dans
   `window.__rules`. Une règle ne fait pas qu'écrire une phrase à côté du plan :
   ce qu'elle trouve — un constat — pousse un candidat que la simulation paie,
   marque une carte que le plan sort déjà, suspend ce qui dépend d'une donnée
   manquante, ou se signale quand le plan n'a rien à y répondre.
   Voir docs/superpowers/specs/2026-11-26-regles-du-moteur-design.md. */
const REGLES_VIDE = () => ({version:0, regles:[], mineBalance:{byStyle:{}, byPosition:{}}, lifeforms:{}});
/* Un fichier illisible ne bloque rien : le moteur d'avant tourne, ses secours et
   ses cartes existent sans rules.json, ils perdent seulement leurs réglages. */
export const REGLES_ERR = (()=>{ const r = window.__rules; return r && typeof r === 'object' && Array.isArray(r.regles) ? '' : 'règles illisibles : le moteur tourne sans réglages'; })();
export const REGLES = REGLES_ERR ? REGLES_VIDE() : Object.assign(REGLES_VIDE(), window.__rules);
export const aSoi = (o, k) => !!o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
export const REGLES_PAR_ID = {};
REGLES.regles.forEach((r, i) => { if(r && typeof r.id === 'string' && !aSoi(REGLES_PAR_ID, r.id)) REGLES_PAR_ID[r.id] = Object.assign({}, r, {rang:i}); });
/* Le repli : les règles qui ont remplacé une alerte du moteur d'avant. Sans
   elles, un rules.json illisible — ou plus ancien que le code — taisait
   l'énergie négative et le hangar plein. Le fichier passe devant : ces
   définitions ne servent qu'aux identifiants qu'il ne connaît pas. Un test
   vérifie qu'elles disent la même chose que rules.json. */
const REGLES_SECOURS = {};
[
  {id:'RES_STORAGE_FULL', nom:'Stockage plein', domaine:'ressources', cat:'stock', niveau:'critique', condition:'storageRatio', parametres:{seuil:0.98, recurrence:3}, effet:'pousser',
    message:'{Ressource} au plafond{sur} : {pertes} perdus',
    raison:'{excedent}. La production de {ressource} est arrêtée tant que le stock ne redescend pas. {depense}',
    action:'{quoi}', source:'https://ogame.fandom.com/wiki/Buildings', statut:'valide'},
  {id:'RES_STORAGE_SOON', nom:'Stockage bientôt plein', domaine:'ressources', cat:'stock', niveau:'important', condition:'storageEta', parametres:{heures:8}, effet:'pousser',
    message:'{Ressource} au plafond dans {dans}{sur}',
    raison:'{cause}Au plafond, la production de {ressource} s\'arrête : {pertes} perdus. {depense}',
    action:'{quoi}', source:'https://ogame.fandom.com/wiki/Buildings', statut:'valide'},
  {id:'RES_ENERGY_NEGATIVE', nom:'Énergie négative', domaine:'ressources', cat:'mines', niveau:'critique', condition:'energyBalance', parametres:{}, effet:'pousser',
    message:'Rétablir l\'énergie{sur}',
    raison:'Tes mines tournent à {pct} %. {options}',
    action:'{quoi}', source:'https://ogame.fandom.com/wiki/Buildings', statut:'valide'},
].forEach((r, i) => { if(!aSoi(REGLES_PAR_ID, r.id)) REGLES_SECOURS[r.id] = Object.assign({actif_par_defaut:true}, r,{rang:REGLES.regles.length + i}); });
/** La définition d'une règle : le fichier, sinon le repli, sinon null. */
const regleDef = id => aSoi(REGLES_PAR_ID, id) ? REGLES_PAR_ID[id] : aSoi(REGLES_SECOURS, id) ? REGLES_SECOURS[id] : null;
/** Une fonction par type de condition : (planète, paramètres, ctx) → constats bruts. */
export const EVAL = {};
export const NIVEAUX = ['critique', 'important', 'conseil'];
export const NIVEAU_SEV = {critique:'bad', important:'warn', conseil:'info'};
export const SEV_NIVEAU = {bad:'critique', warn:'important', info:'conseil'};
export const DOMAINES = {ressources:'Ressources', installations:'Installations', recherche:'Recherche', formes_de_vie:'Formes de vie'};
/* ---------- les règles du moteur : lecture, constats ---------- */
/**
 * La règle telle qu'elle s'applique : le fichier, puis ce que le joueur a
 * changé. Une règle à verrou reste allumée quoi qu'il ait écrit : la
 * simulation en a besoin pour rester vraie.
 * @param {string} id
 * @returns {object|null} null si le fichier ne la connaît pas
 */
export function regle(id){
  const r = regleDef(id), reg = S.settings && S.settings.regles;
  if(!r) return null;
  const j = aSoi(reg, id) ? reg[id] : null;
  const on = r.verrou ? true : (j && typeof j.on === 'boolean' ? j.on : r.actif_par_defaut !== false);
  const parametres = Object.assign({}, r.parametres);
  if(j && j.p && typeof j.p === 'object')
    for(const k of Object.keys(parametres)) if(aSoi(j.p, k) && Number.isFinite(j.p[k])) parametres[k] = j.p[k];
  return Object.assign({}, r, {on, parametres});
}
/* Une règle que le fichier ne connaît pas — fichier illisible, ou plus ancien
   que le code — laisse le moteur faire ce qu'il faisait avant elle : allumée,
   avec la valeur d'avant. Le moteur ne s'éteint pas faute de réglage. */
export function regleActive(id){
  const r = regle(id);
  return !r || (r.on && !(r.cat && poidsCat(r.cat) === 0));
}
export function regleParam(id, k, defaut){
  const r = regle(id);
  return r && Number.isFinite(r.parametres[k]) ? r.parametres[k] : defaut;
}
export function regleTexte(id, champ, defaut, vars){
  const r = regle(id);
  return gabarit(r && typeof r[champ] === 'string' ? r[champ] : defaut, vars || {});
}
/** Remet `S.settings.regles` d'aplomb : n'y reste que ce qui s'écarte du fichier. */
export function regleSaine(){
  const src = S.settings && S.settings.regles, out = {};
  if(src && typeof src === 'object') for(const id of Object.keys(src)){
    const r = regleDef(id), j = src[id];
    if(!r) continue;
    if(!j || typeof j !== 'object') continue;
    const e = {};
    if(!r.verrou && typeof j.on === 'boolean' && j.on !== (r.actif_par_defaut !== false)) e.on = j.on;
    if(j.p && typeof j.p === 'object'){
      const p = {};
      for(const k of Object.keys(r.parametres || {}))
        if(aSoi(j.p, k) && Number.isFinite(j.p[k]) && j.p[k] !== r.parametres[k]) p[k] = j.p[k];
      if(Object.keys(p).length) e.p = p;
    }
    if(Object.keys(e).length) out[id] = e;
  }
  if(S.settings) S.settings.regles = out;
}
/** Ce que le joueur change sur une règle, fusionné à ce qu'il avait déjà écrit. */
export function reglePose(id, ecart){
  if(!aSoi(REGLES_PAR_ID, id) || !ecart) return;
  const reg = S.settings.regles || (S.settings.regles = {});
  const avant = aSoi(reg, id) ? reg[id] : {};
  const neuf = Object.assign({}, avant);
  if(typeof ecart.on === 'boolean') neuf.on = ecart.on;
  if(ecart.p && typeof ecart.p === 'object') neuf.p = Object.assign({}, avant.p, ecart.p);
  reg[id] = neuf;
  regleSaine();
}
/**
 * Un texte de règle, ses variables remplies : `{x}` et `{x+1}`, rien d'autre.
 * Une variable inconnue reste écrite : un trou visible vaut mieux qu'une phrase
 * qui ment.
 */
function gabarit(txt, vars){
  return String(txt == null ? '' : txt).replace(/\{(\w+)(\+1)?\}/g, (m, k, plus) =>
    aSoi(vars, k) && vars[k] != null ? (plus ? String((+vars[k] || 0) + 1) : String(vars[k])) : m);
}
export const rangNiveau = n => { const i = NIVEAUX.indexOf(n); return i < 0 ? NIVEAUX.length : i; };
/* Une règle cassée ne le dit qu'une fois : rendue toutes les trente secondes,
   elle noierait la console. */
const _regleTue = new Set();
function regleTue(id, quoi, e){
  if(_regleTue.has(id)) return; _regleTue.add(id);
  console.error(`Copilote : règle ${id} — ${quoi}`, e || '');
}
/**
 * Les constats d'une règle sur une planète. Une règle éteinte, d'une catégorie
 * que le profil met à 0, ou coupée pour cette planète n'en rend aucun : le
 * poids 0 coupe la règle avant la simulation, jamais une carte qu'elle a payée.
 */
export function constatsDe(p, id){
  const r = regle(id);
  if(!r || !r.on || !p) return [];
  if(r.cat && poidsCat(r.cat) === 0) return [];
  if(p.regOff && p.regOff[id] === true) return [];
  /* Les formes de vie suivent leur propre réglage : « Ne pas s'en occuper »
     les fait taire. Sauf ce qui dit un manque — il ne conseille rien. */
  if(r.domaine === 'formes_de_vie' && r.effet !== 'suspendre' && lfMode() === 'off') return [];
  /* Une règle propre à une race ne s'évalue que sur une planète de cette race. */
  if(Array.isArray(r.races) && r.races.length && !r.races.includes(raceDe(p).race)) return [];
  const ev = aSoi(EVAL, r.condition) ? EVAL[r.condition] : null;
  if(typeof ev !== 'function'){ regleTue(id, `aucun évaluateur pour « ${r.condition} »`); return []; }
  let bruts;
  try{ bruts = ev(p, r.parametres, r) || []; }catch(e){ regleTue(id, 'évaluation impossible', e); return []; }
  return bruts.map(b => {
    const vars = Object.assign({planete:p.name, sur:S.planets.length > 1 ? ` sur ${p.name}` : ''}, b.vars);
    return {regle:id, pid:p.id, niveau:r.niveau, effet:r.effet, domaine:r.domaine, cat:r.cat || '',
      rang:r.rang, statut:r.statut, source:r.source || '', valeur:b.valeur == null ? 0 : b.valeur, vars,
      what:gabarit(r.message, vars), why:gabarit(r.raison, vars), action:r.action ? gabarit(r.action, vars) : '',
      cost:b.cost || null, repond:b.repond || null, servi:false};
  });
}
/**
 * Tous les constats de l'empire, sur l'état réel : niveau, puis poids du
 * profil, puis ordre du fichier, puis ordre des planètes. N'écrit rien — comme
 * `prios()`, elle est lue pendant que la simulation tient la place de l'état.
 * @returns {object[]}
 */
export function constats(){
  const out = [], ps = S.planets || [];
  for(const id of Object.keys(REGLES_PAR_ID).concat(Object.keys(REGLES_SECOURS))) for(const p of ps) out.push(...constatsDe(p, id));
  const pi = new Map(ps.map((p, i) => [p.id, i]));
  return out.sort((a, b) => rangNiveau(a.niveau) - rangNiveau(b.niveau)
    || poidsCat(b.cat) - poidsCat(a.cat) || a.rang - b.rang || pi.get(a.pid) - pi.get(b.pid));
}
/** La carte du plan qui répond à ce constat, ou undefined. */
export function repondA(c, a, i){
  const r = c.repond;
  return !!r && r.kinds.includes(a.kind) && (r.partout || a.p === i)
    && (!r.ks || a.kind !== 'b' || r.ks.includes(a.k)) && (!r.tk || a.k === r.tk)
    && (!r.lfq || lfQueue(a.id) === r.lfq) && (!r.ids || r.ids.includes(a.id));
}

/* ---------- les règles du moteur : évaluateurs ---------- */
export const HANGARS = [['Hangar de métal', 'smetal'], ['Hangar de cristal', 'scrystal'], ['Réservoir de deutérium', 'sdeut']];
const IGN_MS = 24 * 3600e3;
export function ignores(){ return S.daily && S.daily.ign && typeof S.daily.ign === 'object' ? S.daily.ign : {}; }
function ignore(c){ if(!c) return; S.daily.ign = Object.assign({}, ignores(), {[ignKey(c)]: Date.now()}); }
function estIgnore(c){ const t = ignores()[ignKey(c)]; return Number.isFinite(t) && Date.now() - t < IGN_MS; }
/** Les constats que le joueur n'a pas mis de côté. Ignorer ne change rien au
    plan : un constat ignoré pousse et suspend comme avant. */
export function constatsVus(cs){ return (cs || constats()).filter(c => !estIgnore(c)); }
/* « Jusqu'à ce que la condition change » se lit au sens propre : une entrée
   dont aucun constat de ce rendu ne porte la clé tombe, et toutes tombent au
   bout de 24 h. Seulement sur un vrai relevé : sur les données d'exemple
   aucun constat n'existe, et tout serait effacé. */
export function ignClean(){
  if(!IS_EXT || S.sample || !S.daily || !S.daily.ign) return;
  const vivantes = new Set(constats().map(ignKey)), avant = S.daily.ign, apres = {};
  for(const k of Object.keys(avant)) if(vivantes.has(k) && Number.isFinite(avant[k]) && Date.now() - avant[k] < IGN_MS) apres[k] = avant[k];
  if(Object.keys(apres).length !== Object.keys(avant).length){ S.daily.ign = apres; save(); }
}
/* Le compte des critiques, pour l'icône. Le service worker compose le badge :
   le panneau ne fait que dire ce qu'il voit, et quand. */
let _critPub = null;
export function publieCritiques(cs){
  if(!IS_EXT) return;
  const n = constatsVus(cs).filter(c => c.niveau === 'critique').length;
  if(_critPub && _critPub.n === n && Date.now() - _critPub.at < 5 * 60e3) return;
  _critPub = {n, at:Date.now()};
  try{ chrome.storage.local.set({critiques:_critPub}); }catch(e){}
}
/** La clé d'« Ignorer » : la règle, la planète en identifiant du jeu (`daily`
    voyage), et la valeur de la condition. */
export function ignKey(c){
  const p = planetById(c.pid), gid = p && p.gid != null ? String(p.gid) : null;
  return `${c.regle}|${gid || c.pid}|${c.valeur}`;
}
