/* ---------- les formes de vie ----------
   Les espèces et leurs bâtiments (`LIFEFORMS`, `LF_BUILDINGS`), ce que le
   jeu en a montré sur chaque planète (`speciesOfPlanet`, `raceDe`), le coût
   d'un niveau et ce qu'on en retient (`lfCost`, `lfRemember`, `lfMerge`),
   les bâtiments à proposer (`lfCandidates`), l'espèce conseillée par
   position (`lfPourPos`, `bestLifeform`), les paliers de population, et les
   règles du moteur propres aux formes de vie, qui s'inscrivent dans EVAL.

   Module de domaine (issue #49). Le rendu (`raceRows`, `lfRows`, `lfBloc`,
   `lfSettingsHtml`), le relevé des pages du jeu (`lfRelance`) et le bonus de
   production (`lfBonusOf`) restent dans app.js jusqu'à leurs étapes. Ce
   module emprunte encore à app.js les priorités, les files et la page du
   jeu : ce cycle-là est toléré tant qu'app.js existe, et rien n'y est lu au
   chargement. */
import { S } from '../core/etat.js';
import { satEnergy } from '../core/formules.js';
import { fileDe, enCours } from '../economie/chantiers.js';
import { LF_READ_TTL, prodOf, mse } from '../economie/production.js';
import { parseC } from '../flotte/vaisseaux.js';
import { priosLf, prioPalier, FOCUS_VAISSEAU } from '../plan/priorites.js';
import {
  REGLES, aSoi, REGLES_PAR_ID, EVAL, regle, regleActive, regleTexte
} from '../regles/moteur.js';
import { lfNom, goUrl, raceDe, POS } from '../../app.js';
/* Noms relevés sur le jeu ; le panneau de détail en apporte d'autres au fil
   des visites, et ceux-là priment puisqu'ils viennent de la partie en cours. */
/* Les noms par défaut viennent de rules.json, toutes races confondues : un nom
   lu dans le jeu les remplace (lfNom), et le fichier corrige ce qui a changé
   sans toucher au code. */
export const LF_NAMES = Object.assign({}, ...Object.values(REGLES.lifeforms || {})
  .flatMap(r => [r && r.buildings, r && r.research]).filter(x => x && typeof x === 'object'));

/**
 * Le prix relevé vaut-il encore ? Il a été lu pour un niveau précis ; dès que
 * la case monte, il décrit un palier déjà franchi. La liste donne le niveau
 * courant à chaque visite, le panneau de détail ne se rouvre pas tout seul :
 * c'est la comparaison des deux qui dit si le chiffre est encore bon.
 * @param {object} v case relevée
 * @returns {boolean}
 */
function lfPriced(v){
  return !!(v && v.cost && v.cost.some(x=>x>0) && v.secs > 0
    && v.next === (v.lvl || 0) + 1);
}

/* Une case que le jeu refuse de construire, et que le plan ne sait pas
   débloquer : prérequis absent, ou population trop faible. Un seul garde, parce
   que trois appelants l'oubliaient chacun de leur côté — le plan, le relevé qui
   va ouvrir une case pour la chiffrer, et la carte qui réclame un prix — et
   qu'un état de plus devait les corriger tous les trois d'un coup.
   Le manque de ressources, lui, n'est pas un mur : le plan sait quand le stock
   sera là, c'est tout son intérêt. La population, il ne la modélise pas. */
export const lfBloquee = v => !v || v.state === 'locked' || v.state === 'pop';

/* Bornes de bon sens sur ce que le jeu publie : un niveau de case et un prix
   lus sur une page ne doivent jamais faire grossir la mémoire ni les calculs. */
const LF_LVL_MAX = 1000;
const LF_COST_MAX = 1e15;
/* Les coûts montent d'un niveau à l'autre. Un facteur hors de [1, 5] veut dire
   que les deux prix vus ne peuvent pas être justes ensemble (un bonus de coût a
   changé entre les deux) : on ne chiffre pas, plutôt que de chiffrer faux. */
const LF_FACTOR_MAX = 5;
/* Niveaux de prix gardés par case : deux suffisent au facteur, dix laissent de
   quoi le vérifier sans que le stockage grossisse. */
const LF_SEEN_KEEP = 10;

/**
 * Un coût lu, ramené à trois nombres finis entre 0 et LF_COST_MAX.
 * @param {number[]} c coût brut
 * @returns {number[]} [métal, cristal, deutérium]
 */
function lfClampCost(c){
  return [0,1,2].map(i => { const x = +(c || [])[i]; return Number.isFinite(x) ? Math.min(Math.max(x, 0), LF_COST_MAX) : 0; });
}

/**
 * Mémoire des prix vus d'une case : ajoute celui que vient de lire le panneau
 * de détail (prix du niveau `next`, avec l'heure de lecture) et ne garde que
 * les dix niveaux les plus hauts.
 * @param {object} prev case déjà connue (seen, seenAt), ou undefined
 * @param {object} v lecture de la case
 * @returns {{seen:object, seenAt:object}} prix {niveau:[m,c,d]} et heures {niveau:ms}
 */
function lfRemember(prev, v){
  const seen = Object.assign({}, prev && prev.seen), seenAt = Object.assign({}, prev && prev.seenAt);
  const n = Math.floor(+v.next);
  if(n >= 1 && n <= LF_LVL_MAX && Array.isArray(v.cost) && v.cost.some(x=>x>0)){ const c = lfClampCost(v.cost); /* l'heure ne bouge que si le prix est nouveau ou change */ if(!seen[n] || !seen[n].every((x,i)=>x===c[i])) seenAt[n] = Date.now(); seen[n] = c; }
  Object.keys(seen).map(Number).sort((a,b)=>b-a).slice(LF_SEEN_KEEP).forEach(k=>{ delete seen[k]; delete seenAt[k]; });
  return {seen, seenAt};
}

/**
 * Met en commun, entre planètes, ce que chaque case de forme de vie a coûté.
 *
 * Le prix d'une case ne dépend pas de la planète : l'identifiant porte déjà
 * l'espèce, donc la même case coûte la même chose partout où elle existe. Tant
 * que chaque planète ne se fiait qu'à ses propres lectures, le copilote ne
 * comparait que la case qu'on venait d'ouvrir — et la désignait donc
 * forcément, quelle qu'elle soit. En commun, un relevé apprend autant de cases
 * que le joueur a de planètes, et les niveaux différents d'une planète à
 * l'autre donnent enfin de quoi extrapoler le facteur.
 *
 * La durée, elle, est empruntée faute de mieux : elle dépend du chantier de la
 * planète autant que de la case. On ne la prête qu'à une planète qui n'en a
 * aucune, et la première lecture locale la remplace — comme pour le prix, le
 * local prime toujours.
 */
export function lfMetEnCommun(){
  const pool = {};
  const sac = id => (pool[id] = pool[id] || {niveaux:{}, secs:0});
  const pose = (id, n, cost, at) => {
    if(!(n >= 1 && n <= LF_LVL_MAX) || !Array.isArray(cost) || !cost.some(x=>x>0)) return;
    const b = sac(id), vu = b.niveaux[n];
    // deux planètes peuvent diverger après une mise à jour du jeu : la plus récente gagne
    if(!vu || (at || 0) > (vu.at || 0)) b.niveaux[n] = {cost: lfClampCost(cost), at: at || 0};
  };
  for(const p of S.planets) for(const [id, v] of Object.entries(p.lf || {})){
    if(!v) continue;
    for(const [n, c] of Object.entries(v.seen || {})) pose(id, +n, c, (v.seenAt || {})[n]);
    if(lfPriced(v)) pose(id, v.next, v.cost, (v.seenAt || {})[v.next]);
    if(v.secs > 0) sac(id).secs = Math.max(sac(id).secs, v.secs);
  }
  for(const p of S.planets) for(const [id, v] of Object.entries(p.lf || {})){
    const b = pool[id];
    if(!b || !v) continue;
    const seen = {}, seenAt = {};
    for(const [n, e] of Object.entries(b.niveaux)){ seen[n] = e.cost; seenAt[n] = e.at; }
    Object.assign(seen, v.seen || {});
    Object.assign(seenAt, v.seenAt || {});
    // même borne qu'une lecture seule : les dix niveaux les plus hauts
    Object.keys(seen).map(Number).sort((a, b2) => b2 - a).slice(LF_SEEN_KEEP)
      .forEach(k => { delete seen[k]; delete seenAt[k]; });
    v.seen = seen; v.seenAt = seenAt;
    if(!(v.secs > 0) && b.secs > 0) v.secs = b.secs;
  }
}

/**
 * Adopte la lecture d'une case sans perdre ce que les lectures précédentes
 * avaient appris : les prix vus, et la durée quand la liste n'en porte pas.
 * @param {object} prev case déjà connue, ou undefined
 * @param {object} cur lecture du jour
 * @returns {object} case fusionnée
 */
export function lfMerge(prev, cur){
  const out = Object.assign({}, cur, lfRemember(prev, cur));
  if(!cur.cost && prev && prev.secs > 0 && !(cur.secs > 0)) out.secs = prev.secs;
  /* Le nom se garde : une page relue depuis une version qui ne le relevait pas,
     ou un relevé partiel, rendrait la case anonyme alors qu'on la connaît. */
  const nom = cur.nom || cur.name || (prev && (prev.nom || prev.name));
  /* Replafonné ici aussi : une sauvegarde d'avant le plafond, ou un relevé
     d'une version plus ancienne, porterait un nom sans bornes. */
  if(typeof nom === 'string' && nom) out.nom = nom.slice(0, 80); else delete out.nom;
  /* L'effet ne se lit que sur le panneau de détail, que le joueur n'ouvre
     qu'une fois : une lecture de la liste l'effacerait. */
  const eff = [0,1,2].includes(cur.eff) ? cur.eff : ([0,1,2].includes(prev && prev.eff) ? prev.eff : null);
  if(eff === null) delete out.eff; else out.eff = eff;
  return out;
}

/**
 * Prix d'une case de forme de vie à un niveau donné, lu ou estimé. Les coûts
 * suivent base × facteur^(n−1) : deux niveaux vus donnent le facteur, projeté
 * depuis le plus haut. Un prix lu à ce niveau prime toujours.
 * @param {object} v case relevée (lvl, next, cost, secs, seen)
 * @param {number} niveau niveau visé
 * @returns {{cost:number[], src:'lu'|'estimé', at?:number}|null} `at` : heure de lecture d'un prix lu ;
 *   null quand rien ne permet de chiffrer
 */
export function lfCost(v, niveau){
  const n = Math.floor(+niveau);
  if(!v || !(n >= 1)) return null;
  if(lfPriced(v) && v.next === n) return {cost: lfClampCost(v.cost), src:'lu', at:(v.seenAt || {})[n]};
  const seen = v.seen || {};
  const nv = Object.keys(seen).map(Number).filter(k=>Number.isInteger(k) && k >= 1 && k <= LF_LVL_MAX).sort((a,b)=>a-b);
  if(seen[n] && lfClampCost(seen[n]).some(x=>x>0)) return {cost: lfClampCost(seen[n]), src:'lu', at:(v.seenAt || {})[n]};
  if(nv.length < 2) return null;
  const n1 = nv[nv.length-2], n2 = nv[nv.length-1];
  const c1 = lfClampCost(seen[n1]), c2 = lfClampCost(seen[n2]);
  const j = [0,1,2].find(i=>c1[i] > 0 && c2[i] > 0);
  if(j === undefined) return null;
  const f = Math.pow(c2[j]/c1[j], 1/(n2-n1));
  if(!(f >= 1 && f <= LF_FACTOR_MAX)) return null;
  const raw = c2.map(x=>Math.round(x * Math.pow(f, n-n2)));
  return raw.every(x=>Number.isFinite(x) && x <= LF_COST_MAX) ? {cost: raw, src:'estimé'} : null;
}

const LF_RES_NOM = ['métal', 'cristal', 'deutérium'];
/**
 * Cases de forme de vie proposables sur une planète : celles qui augmentent une
 * production d'abord, la moins chère ensuite.
 * Une case n'est proposable que si le jeu l'a dite constructible ET qu'on sait
 * en chiffrer le prochain niveau, lu ou estimé (`src`), avec une durée connue :
 * sans cela, on ne sait pas quand elle sera payable. À prix égal, le prix lu
 * passe devant l'estimé.
 * Une case que le joueur a mise en priorité prend la tête de sa file, à condition
 * d'être chiffrable et non verrouillée ; la première posée sur la planète agit.
 * @param {object} p planète simulée
 * @param {string} queue lfbuilding | lfresearch
 * @returns {object[]} candidats triés
 */
export function lfCandidates(p, queue){
  const libres = Object.entries(p.lf || {}).filter(([id,v]) => lfQueue(id) === queue && !lfBloquee(v));
  const out = libres.flatMap(([id,v]) => {
    const next = (v.lvl||0) + 1, c = lfCost(v, next);
    if(!c || !(v.secs > 0)) return [];
    return [{id:+id, cost:c.cost, src:c.src, at:c.at, secs:v.secs, next,
      eff: [0,1,2].includes(v.eff) ? v.eff : null,
      nom: lfNomConnu(p, id) || 'Forme de vie'}];
  /* Une case qui produit passe devant, quel que soit son prix : son gain porte
     sur toutes les planètes et dure toute la partie, quand une case qui ne
     produit rien ne rembourse jamais. Le prix ne départage plus qu'à effet
     égal. */
  }).sort((a,b)=>(a.eff===null)-(b.eff===null) || mse(...a.cost)-mse(...b.cost) || (a.src==='lu' ? 0 : 1)-(b.src==='lu' ? 0 : 1));
  const n = out.length, u = libres.length - n;
  const reste = (u ? ` ${u} case${u>1?'s':''} pas encore chiffrée${u>1?'s':''}, non comparée${u>1?'s':''} : ouvre-${u>1?'les':'la'} dans le jeu.` : '');
  const moinsChere = `La moins chère des ${n} case${n>1?'s':''} chiffrée${n>1?'s':''} de cette file.`;
  const liste = out.map(c => Object.assign(c, {why: (c.eff === null ? moinsChere
    : `Augmente la production de ${LF_RES_NOM[c.eff]} sur toutes les planètes : elle passe devant les cases qui ne produisent rien.`) + reste}));
  /* La case que le joueur a choisie prend la tête, mais seulement si elle est
     déjà dans la liste : sans prix lu ni durée, ou verrouillée, elle n'est pas
     candidate, priorité ou non. Ce que « en tête » coûte : l'appelant ne lit
     que lfCandidates(p, q)[0], donc une case plus chère que ce que le prix
     aurait choisi fait attendre toute la file jusqu'à ce qu'elle soit payable,
     et l'attente pose une réserve molle. C'est voulu : retomber sur la
     suivante rendrait la priorité inerte dans le cas qui l'a motivée, une
     habitation chère contre un bâtiment de nourriture bon marché, où le prix
     gagnerait toujours. Les mines n'en pâtissent pas : leur chemin ne compte
     pas la réserve molle. */
  /* Si la première posée n'est pas candidate (le plus souvent : pas encore
     chiffrée), la suivante de la même file passe : servir une priorité qu'on
     sait chiffrer vaut mieux que ne rien faire. */
  /* Les règles de forme de vie (FDV_POP_LIMIT, FDV_BASE_FIRST) mettent la base
     en tête, dans leur ordre ; une priorité du joueur passe encore devant. */
  for(const pz of lfPousses(p, queue)){
    const tetes = pz.ids.map(id => liste.find(c => c.id === id)).filter(Boolean);
    if(!tetes.length) continue;
    const pourquoi = regleTexte(pz.regle, 'raison', '', {bloquees:casesPop(p).map(id => lfNom(p, id)).join(', '),
      base:tetes.map(c => `${c.nom} ${c.next - 1}`).join(' et ')});
    for(const c of tetes) c.why = pourquoi + reste;
    liste.splice(0, liste.length, ...tetes, ...liste.filter(c => !tetes.includes(c)));
    break;
  }
  const voulue = priosLf().find(x => x.pid === p.id && liste.some(c => c.id === x.k));
  if(!voulue) return liste;
  const tete = liste.find(c => c.id === voulue.k);
  const fait = tete.eff === null ? '' : ` Elle augmente la production de ${LF_RES_NOM[tete.eff]} sur toutes les planètes.`;
  tete.why = 'Tu l\'as mise en priorité.' + fait + reste;
  return [tete].concat(liste.filter(c => c !== tete));
}

/* ---------- les règles du moteur : formes de vie ---------- */
const LF_RACES = REGLES.lifeforms && typeof REGLES.lifeforms === 'object' ? REGLES.lifeforms : {};
/* La race d'une case, d'après sa série : le chiffre des milliers est la race,
   la centaine impaire construit, la paire cherche (121xx et 122xx, Rock'tal). */
export function raceDeSerie(id){
  const s = Math.floor(+id / 100);
  return Object.keys(LF_RACES).find(r => { const pre = +(LF_RACES[r] || {}).idPrefix; return pre > 0 && (s === pre || s === pre + 1); }) || null;
}
export const RACE_SRC = {main:'posée à la main', ids:'déduite des identifiants', nom:'lue dans le tableau de production'};
export const nomRace = r => (LIFEFORMS[r] || {}).n || r;
/** L'habitat et la nourriture de la race de cette planète, ou null. */
function baseDe(p){
  const r = raceDe(p).race, b = r && (LF_RACES[r] || {}).base;
  return b && +b.habitat > 0 && +b.nourriture > 0 ? {habitat:+b.habitat, nourriture:+b.nourriture} : null;
}
/** Le nom d'une case quand quelqu'un le connaît : le jeu, puis le cache, puis le fichier. */
export function lfNomConnu(p, id){
  const v = ((p || {}).lf || {})[id] || {};
  return v.nom || v.name || (aSoi(S.lfNoms, id) ? S.lfNoms[id] : null) || LF_NAMES[id] || null;
}
/**
 * Ce qui manque pour conseiller sur les formes de vie de cette planète, du plus
 * bloquant au moins bloquant. Vide quand tout est là, ou quand la planète n'a
 * pas encore d'espèce : c'est alors un choix à faire, pas une donnée à relire.
 * @returns {{quoi:string, detail:string, page:string, ids?:number[]}[]}
 */
function lfManques(p){
  const ids = lfIds(p);
  if(!p || (!ids.length && !p.race)) return [];
  const r = raceDe(p);
  if(r.conflit) return [{quoi:'conflit', page:'lfbuildings',
    detail:`Race contradictoire : les identifiants disent ${r.ids.map(nomRace).join(' et ')}${r.nom ? `, le tableau de production ${nomRace(r.nom)}` : ''}`}];
  if(!r.race) return [{quoi:'race', page:'lfbuildings', detail:'Race inconnue'}];
  const out = [], nr = nomRace(r.race);
  const sansNom = ids.filter(id => !lfNomConnu(p, id));
  if(sansNom.length){
    const bat = sansNom.some(id => lfQueue(id) === 'lfbuilding'), rech = sansNom.some(id => lfQueue(id) === 'lfresearch');
    out.push({quoi:'noms', page:bat ? 'lfbuildings' : 'lfresearch', ids:sansNom,
      detail:`Noms ${bat && rech ? 'des bâtiments et des recherches' : bat ? 'des bâtiments' : 'des recherches'} ${nr} inconnus (${sansNom.length})`});
  } else if(!ids.length && !Object.keys((LF_RACES[r.race] || {}).buildings || {}).length)
    out.push({quoi:'noms', page:'encyclopedie', detail:`Noms ${nr} inconnus`});
  const sansNiv = ids.filter(id => !Number.isFinite(+((p.lf || {})[id] || {}).lvl));
  if(sansNiv.length) out.push({quoi:'niveau', page:lfQueue(sansNiv[0]) === 'lfresearch' ? 'lfresearch' : 'lfbuildings', ids:sansNiv,
    detail:`Niveau illisible pour ${sansNiv.length} case${sansNiv.length > 1 ? 's' : ''}`});
  return out;
}
/* Ce que FDV_DATA_MISSING suspend : toute la planète sans race, les seules
   cases concernées sans nom ou sans niveau. Un conseil sur une case qu'on ne
   sait pas nommer serait un conseil à l'aveugle. */
export function lfSuspendu(p){
  if(!regleActive('FDV_DATA_MISSING')) return {tout:false, ids:new Set()};
  const m = lfManques(p);
  return {tout:m.some(x => x.quoi === 'race' || x.quoi === 'conflit'), ids:new Set(m.flatMap(x => x.ids || []))};
}
EVAL.lifeformDataComplete = p => {
  const m = lfManques(p); if(!m.length) return [];
  const i = S.planets.indexOf(p), page = m[0].page;
  const url = page === 'encyclopedie' ? null : goUrl(page, i);
  return [{valeur:m.map(x => `${x.quoi}:${(x.ids || []).length}`).join(','),
    vars:{detail:m.map(x => x.detail).join(' · '), url,
      scanner:url ? 'Ouvre la page dans le jeu : le copilote la lit à son chargement' : 'Ouvre l\'Encyclopédie de cette race dans le jeu : le copilote y lira les noms'}}];
};
/* Une file de forme de vie vide. La recherche n'existe qu'une fois une case
   de bâtiment lue : avant, l'arbre n'est pas ouvert. */
EVAL.lfQueueEmpty = (p, prm, r) => {
  const ids = lfIds(p);
  if(!ids.some(id => lfQueue(id) === 'lfbuilding') || lfManques(p).length) return [];
  const l = fileDe(p, t => t.kind === 'x' && t.queue === r.file);
  if(l.some(enCours)) return [];
  return [{valeur:l.reduce((m, t) => Math.max(m, +t.end || 0), 0), repond:{kinds:['lf'], lfq:r.file}, vars:{}}];
};
/* Les cases que la population bloque : le jeu ne dit pas si c'est la
   nourriture ou le logement, la nourriture passe donc d'abord (lfPousses). */
const casesPop = p => Object.entries((p && p.lf) || {}).filter(([, v]) => v && v.state === 'pop').map(([id]) => +id);
EVAL.lifeformPop = p => {
  const b = baseDe(p), pop = casesPop(p);
  if(!b || !pop.length || lfManques(p).length) return [];
  return [{valeur:pop.join(','), repond:{kinds:['lf'], ids:[b.nourriture, b.habitat]},
    vars:{bloquees:pop.map(id => lfNom(p, id)).join(', '), nourriture:lfNom(p, b.nourriture), habitat:lfNom(p, b.habitat)}}];
};
/* La base sous son palier alors qu'une case avancée (rang 6 et plus) attend. */
function baseEnRetard(p){
  const b = baseDe(p); if(!b) return null;
  const n = id => +(((p.lf || {})[id] || {}).lvl) || 0;
  const prm = (regle('FDV_BASE_FIRST') || {}).parametres || {};
  const sous = [[b.nourriture, prm.nourriture], [b.habitat, prm.habitat]].filter(([id, x]) => Number.isFinite(x) && n(id) < x).map(([id]) => id);
  const avancee = lfIds(p).some(id => lfQueue(id) === 'lfbuilding' && id % 100 >= 6 && !lfBloquee(p.lf[id]));
  return sous.length && avancee ? sous : null;
}
EVAL.lifeformBase = p => {
  const sous = !lfManques(p).length && baseEnRetard(p); if(!sous) return [];
  return [{valeur:sous.map(id => `${id}:${+(p.lf[id] || {}).lvl || 0}`).join(','), repond:{kinds:['lf'], ids:sous},
    vars:{base:sous.map(id => `${lfNom(p, id)} ${+(p.lf[id] || {}).lvl || 0}`).join(' et ')}}];
};
/* Les cases que les règles de forme de vie mettent en tête de la file des
   bâtiments, dans l'ordre : la population bloquée d'abord, la base ensuite. */
function lfPousses(p, queue){
  if(queue !== 'lfbuilding') return [];
  const b = baseDe(p); if(!b) return [];
  if(regleActive('FDV_POP_LIMIT') && casesPop(p).length) return [{ids:[b.nourriture, b.habitat], regle:'FDV_POP_LIMIT'}];
  const sous = regleActive('FDV_BASE_FIRST') && baseEnRetard(p);
  return sous ? [{ids:sous, regle:'FDV_BASE_FIRST'}] : [];
}
/** Vide le cache des noms : utile après une mise à jour du jeu. La race posée
    à la main reste — c'est une décision du joueur, pas une lecture. */
export function rescanner(){
  S.lfNoms = {};
  for(const p of S.planets || []) for(const v of Object.values(p.lf || {})) if(v){ delete v.nom; delete v.name; }
}
/* Les noms lus sur n'importe quelle planète servent à toutes : la même case
   porte le même nom partout. Bornés : une page abîmée ne fait pas grossir le
   stockage. */
export function lfNomsRetiens(extra){
  const c = S.lfNoms && typeof S.lfNoms === 'object' ? S.lfNoms : (S.lfNoms = {});
  const pose = (id, nom) => { if(Number.isInteger(+id) && +id >= 11000 && +id < 100000 && typeof nom === 'string' && nom.trim() && nom.length <= 80) c[+id] = nom.trim(); };
  for(const p of S.planets || []) for(const [id, v] of Object.entries(p.lf || {})) if(v) pose(id, v.nom || v.name);
  if(extra && typeof extra === 'object') for(const [id, nom] of Object.entries(extra)) pose(id, nom);
}

/* ---------- les espèces lues dans le jeu ---------- */
export const LIFEFORMS = {humans:{n:'Humains', why:'polyvalents'}, rocktal:{n:'Roctas', why:'mineurs : production et bâtiments moins chers'}, mechas:{n:'Mécas', why:'vaisseaux et chantier spatial'}, kaelesh:{n:'Kaeleshs', why:'expéditions et recherche'}};
/* Bâtiments de forme de vie, par espèce. Relevé sur la partie du joueur le
   12 novembre 2026 ; un seul bâtiment reconnu nomme l'espèce, et un bâtiment
   au niveau 0 figure quand même dans le panneau. À compléter au fil des relevés. */
const LF_BUILDINGS = {
  humans: ['Centre de recherche'],
  rocktal: ['Centre technologique runique'],
  mechas: ['Centre de recherche en robotique']
};
/**
 * Espèce d'une planète déduite des libellés de bâtiments d'un relevé de panneau
 * ("Nom (Niveau N)"). La présence du bâtiment suffit, son niveau n'y change rien.
 * @param {object} r relevé de prodOf
 * @returns {string|null} clé de LIFEFORMS, null si aucun bâtiment connu
 */
function speciesOf(r){
  const rows = r && Array.isArray(r.rows) ? r.rows : [];
  const names = rows.map(x => String((x && x.label) || '').replace(/\s*\(Niveau\s*\d+\)\s*$/i, '').trim().toLowerCase());
  return Object.keys(LF_BUILDINGS).find(k => LF_BUILDINGS[k].some(n => names.includes(n.toLowerCase()))) || null;
}
/**
 * Espèce d'une planète d'après son relevé, s'il a moins de sept jours.
 * @param {object} p planète de S.planets
 * @returns {string|null}
 */
export function speciesOfPlanet(p){
  const r = prodOf(p);
  return r && Date.now() - r.at < LF_READ_TTL ? speciesOf(r) : null;
}
/**
 * Espèces installées sur au moins une planète, d'après les relevés récents.
 * @returns {string[]}
 */
export function readLifeforms(){
  return [...new Set(S.planets.map(speciesOfPlanet).filter(Boolean))];
}
/**
 * Espèces connues du compte : celles cochées dans les réglages (découvertes)
 * plus celles lues sur les planètes (installées, donc découvertes). Une lecture
 * s'ajoute à la coche, elle n'en retire jamais.
 * @returns {string[]}
 */
export function foundLifeforms(){
  return [...new Set([...(S.lf.found || ['humans']), ...readLifeforms()])];
}
/**
 * Race conseillée pour un emplacement, parmi celles que le compte a trouvées.
 * Deux faits suffisent, et le panneau les tient de l'emplacement seul, sans
 * avoir rien lu sur place : le bonus de production (POS), et la température,
 * qui décide du rendement d'un satellite — donc du prix de l'énergie que
 * mangent les bâtiments de forme de vie. Les emplacements froids tirent leur
 * valeur du deutérium, que les Mécas augmentent ; partout ailleurs c'est métal
 * et cristal, et les bâtiments roctas, gourmands, trouvent là l'énergie la
 * moins chère. Lune et expéditions ne se déduisent d'aucun chiffre : elles
 * tiennent au rôle que le joueur donne à la planète, et la carte le lui dit en
 * clair plutôt que de le deviner à sa place.
 * @param {number} pos emplacement 1 à 15, 0 s'il est inconnu
 * @returns {string} clé de LIFEFORMS
 */
export function lfPourPos(pos){
  const f = foundLifeforms();
  const ordre = pos >= 13 || FOCUS_VAISSEAU[S.day.focus] ? ['mechas','kaelesh','rocktal','humans'] : ['rocktal','humans','mechas','kaelesh'];
  return ordre.find(k=>f.includes(k)) || 'humans';
}
/**
 * Ce que l'emplacement dit de la planète, en clair.
 * @param {number} pos emplacement 1 à 15
 * @returns {string} bonus, température et énergie d'un satellite
 */
export function lfRaisonPos(pos){
  const P = POS[pos];
  return P ? `emplacement ${pos}, ${P.bonus || 'sans bonus de production'}, ${P.t} °C — un satellite y rend ${satEnergy(P.t)} d'énergie`
           : 'emplacement inconnu';
}
/**
 * La race conseillée pour une planète, et pourquoi.
 * @param {object} p planète de S.planets
 * @returns {{n:string, why:string}}
 */
export function lfConseilPlanete(p){
  const pos = (parseC(p.coords) || [])[2] || 0;
  return {n: LIFEFORMS[lfPourPos(pos)].n, why: lfRaisonPos(pos)};
}
/** La race conseillée quand on ne sait rien de l'emplacement. */
function bestLifeform(){ return lfPourPos(0); }
/** Les identifiants de case de forme de vie relevés sur une planète. Pas de
    tri : une clé entière s'énumère déjà en ordre croissant, et c'est l'ordre
    du jeu — les trier à nouveau serait une ligne qui ne fait rien. */
export function lfIds(p){
  return Object.keys((p || {}).lf || {}).map(Number).filter(id=>Number.isInteger(id) && id >= 11000);
}
/* Les cinq premiers rangs ont le même rôle chez les quatre espèces. Les
   suivants, non — et ça se vérifie, ça ne se suppose pas.

   Deux sources, apportées par le joueur le 26/11/2026. Le guide d'Always For
   Keyboard (27/02/2024) nomme les trois premiers rôles et donne les quatre
   noms de chacun :
     Hébergement  — Secteur résidentiel (Humains) / Enclave stoïque (Roctas) /
                    Refugium (Kaeleshs) / Chaîne de production (Mécas)
     Nourriture   — Ferme biosphérique / Culture du cristal /
                    Condensateur d'antimatière / Usine de fusion de cellules
     Technologies — Centre de recherche / Centre technologique runique /
                    Salle à vortex / Centre de recherche en robotique
   La page officielle de Gameforge (gameforge.com/fr-FR/games/ogame-formes-vie)
   donne les douze bâtiments des Mécas et des Kaeleshs dans l'ordre, chacun
   avec ce qu'il fait. Alignés rang par rang, les rangs 4 et 5 disent la même
   chose des deux : « entraîne les T1 en T2 », puis « entraîne les T2 en T3 »
   (Update Network / Halls of Realisation, puis Quantum Computer Centre /
   Forum of Transcendence). Chez les Humains ce sont l'Académie des sciences
   et le Centre de neurocalibrage, aux mêmes rangs.

   À partir du rang 6, les deux listes divergent : le rang 6 réduit le temps de
   construction des navires chez les Mécas et la consommation de nourriture
   chez les Kaeleshs ; le rang 9 augmente la population chez les premiers et le
   nombre de cases de la planète chez les seconds. Il n'y a donc pas de rôle
   commun à nommer au-delà de 5, et ces rangs gardent les noms que le relevé
   leur connaît — ne pas « compléter » cette table de mémoire.

   Le rang ne se devine pas plus que les rôles : il se lit du nom humain dans
   OG_LF_BUILD, que le relevé a posé — « Secteur résidentiel » y est 11101,
   donc le rang 1. */
export const LF_ROLE = {1:'Hébergement', 2:'Nourriture', 3:'Technologies',
                 4:'Population T1 → T2', 5:'Population T2 → T3'};
/* Les paliers de population. Le wiki dit la même chose des quatre espèces :
   « each race has a building that generates population and another that
   generates food », et chez chacune ce sont les deux premières cases — Secteur
   résidentiel puis Ferme biosphérique chez les Humains, Enclave stoïque puis
   Culture du cristal chez les Roctas. Le rôle ne se devine donc pas, il est
   documenté. Les identifiants, eux, ne le sont pas : on ne les invente pas, on
   prend ceux que le relevé a vus ici et on exige qu'ils finissent par 01 et 02
   dans la même série. Si ce n'est pas le cas, on ne propose rien plutôt que de
   viser la mauvaise case.
   Les niveaux viennent du joueur, pas du jeu : le wiki ne documente aucun
   palier de population. Ils sont écrits ici pour être relus et changés. */
/* Les deux premiers paliers se lisent dans rules.json (FDV_BASE_FIRST) : la
   règle qui pousse la base et le bouton qui la pose visent le même niveau. */
export const LF_PALIER = (()=>{ const pr = (REGLES_PAR_ID.FDV_BASE_FIRST || {}).parametres || {};
  return {nourriture:Number.isFinite(pr.nourriture) ? pr.nourriture : 21, population:[Number.isFinite(pr.habitat) ? pr.habitat : 21, 41]}; })();
export function lfPopNourriture(p){
  const ids = lfIds(p);
  if(!ids.length) return null;
  /* La race d'abord : posée à la main, elle déplace l'habitat et la nourriture. */
  const b = baseDe(p);
  if(b && ids.includes(b.habitat) && ids.includes(b.nourriture)) return {pop:b.habitat, nour:b.nourriture};
  const serie = Math.floor(ids[0] / 100), pop = serie * 100 + 1, nour = serie * 100 + 2;
  return ids.includes(pop) && ids.includes(nour) ? {pop, nour} : null;
}
/* La nourriture d'abord : l'ordre de pose arbitre la précédence, et une
   population qu'on loge sans la nourrir ne tient pas. La population part donc
   en second, avec son palier — elle ne repartira vers le niveau haut qu'une
   fois le premier atteint. */
export function lfPosePaliers(p){
  const r = lfPopNourriture(p); if(!r) return false;
  prioPalier('lf', p.id, r.nour, LF_PALIER.nourriture, null);
  prioPalier('lf', p.id, r.pop, LF_PALIER.population[0], LF_PALIER.population[1]);
  return true;
}
