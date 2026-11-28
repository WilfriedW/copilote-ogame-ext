/* ---------- la journée ----------
   Le moteur du plan du jour : la journée simulée session par session
   (`simulateDay`), les bâtiments choisis (`pickBuildings`, `mineWhy`), la
   prochaine recherche et ce qu'elle rapporte (`nextResearch`, `techWhy`,
   `ROADMAPS`), ce qu'une priorité demande (`prioStep`, `prioBloque`), la
   projection des ressources et le moment où une dépense devient payable
   (`projectResources`, `whenAffordable`, `depensesPayables`), et les jalons
   du début de partie (`MILESTONES`).

   Module du plan du jour (issue #49). Le rendu des actions (`actHtml`,
   `whyParts`, `copyChips`) reste dans app.js jusqu'à l'étape des vues. Ce
   module emprunte encore à app.js la production, les stocks, les liens vers
   le jeu et le profil : ce cycle-là est toléré tant qu'app.js existe, et
   rien n'y est lu au chargement. */
import {
  COL_SHIP_COST, KITS, colShipAt, colSentNow, colBuilt, maxPlanets,
  coloTarget, coloFleet
} from '../colonisation/colonisation.js';
import { S, sample } from '../core/etat.js';
import { fmt, num, planetRef, majus } from '../core/format.js';
import {
  B, B_SHORT, T, levelCost, rangeCost, storageLevelFor, SAT_COST,
  satEnergy
} from '../core/formules.js';
import { ecoSpeed, hyperCargoPct, buildTime } from '../core/serveur.js';
import { dur, formatTime } from '../core/temps.js';
import { DEF, defPropositions, defPhrase, defBloqueTexte } from '../defense/defense.js';
import {
  mineEnRetard, signe, naniteRetard, robotsOuNanites, laboEnRetard,
  labOkPour, reglesRecherche
} from '../economie/chantiers.js';
import { hangarSiJustifie, debordeTexte } from '../economie/debordements.js';
import {
  labPlanet, labLevel, researchTime, production, mse, NOM_RES,
  storageNote, reqOk, upLabel
} from '../economie/production.js';
import {
  expoFind, expoFleet, EXPO_READ_TTL, expoInFlight, expoCap,
  astroForExpo, expoWanted, expoTgt, expoSys, expoDuree, expoScore
} from '../flotte/expeditions.js';
import { shipStats, flight, shipList, shipCourt, mouvements, fleetSlots } from '../flotte/vaisseaux.js';
import { lfCandidates, lfSuspendu } from '../formes-de-vie/formes-de-vie.js';
import { timerLabel } from '../minuteurs/minuteurs.js';
import { poseHeure, isNight } from './nuit.js';
import { prios, prioOf, prioDevant, FOCUS, FOCUS_FLOTTE } from './priorites.js';
import { poidsCat, catActe } from './profil.js';
import { besoinEmpire, VOC_KEYS, VOC_NOM, vocations } from './vocations.js';
import { regleActive, regleParam, regleTexte, rangNiveau, constats, repondA } from '../regles/moteur.js';
import {
  addBuilt, planetIndexById, rankUpgrades, planetAlerts, LF_MODE, lfMode,
  SHIP_COST, shipReqOk, shipTime, defSurplus, tournee, hubIndex, centreIndex,
  POURQUOI_LABO, centreNote
} from '../../app.js';

/* ---------- advice ---------- */
export const MILESTONES = [
  {t:'b', k:'lab', lvl:1, why:'Débloque toutes les recherches.'},
  {t:'t', k:'energy', lvl:1, why:'Premier prérequis de presque tout l\'arbre technologique.'},
  {t:'b', k:'robot', lvl:2, why:'Accélère les constructions et débloque le chantier spatial.'},
  {t:'b', k:'shipyard', lvl:2, why:'Nécessaire au petit transporteur.'},
  {t:'t', k:'combustion', lvl:2, why:'Débloque le petit transporteur : fleetsave et pillage.'},
  {t:'t', k:'espionage', lvl:2, why:'Sondes d\'espionnage pour repérer les joueurs inactifs.'},
  {t:'t', k:'computer', lvl:2, why:'Un slot de flotte supplémentaire par niveau.'},
  {t:'b', k:'lab', lvl:3, why:'Requis pour Astrophysique.'},
  {t:'t', k:'impulse', lvl:3, why:'Requis pour Astrophysique.'},
  {t:'t', k:'espionage', lvl:4, why:'Requis pour Astrophysique.'},
  {t:'t', k:'astro', lvl:1, why:'Première colonie et premières expéditions.'},
];
export function milestoneDone(m){ return m.t==='t' ? S.tech[m.k]>=m.lvl : S.planets[0] && S.planets[0].b[m.k]>=m.lvl; }
export function milestoneLabel(m){ return m.t==='t' ? `${T[m.k].n} ${m.lvl}` : `${B[m.k].n} ${m.lvl}`; }
export function milestoneMissing(m){ return m.t==='t' ? reqOk(T[m.k].req, null) : reqOk(B[m.k].req, S.planets[0]); }

/* Les emplacements d'une planète, quand le relevé les a vus et qu'ils tiennent
   debout. Un chiffre aberrant — une parenthèse attrapée ailleurs dans
   l'infobulle — déclarerait une planète pleine et ferait taire le plan dessus :
   on préfère ne rien savoir. Aucune planète d'OGame n'a moins de vingt
   emplacements. */
export function casesSaines(c){
  return !!c && Number.isFinite(c.pris) && Number.isFinite(c.max)
    && c.max >= 20 && c.max <= 1000 && c.pris >= 0 && c.pris <= c.max;
}
/** Emplacements libres, ou null si on ne sait pas. */
export function casesLibres(p){
  return casesSaines(p && p.cases) ? p.cases.max - p.cases.pris : null;
}

/** Ce qui ne va pas sur une planète, maintenant, quoi que fassent ses files.
    Volontairement séparée de pickBuildings : celle-là choisit quoi construire
    et se tait dès qu'une file est occupée ou que des satellites arrivent, ce
    qui est juste pour choisir et faux pour avertir. */
/* Les quatre bâtiments qui engloutissent des ressources sans rien produire, et
   que le classement par amortissement ne proposera donc jamais. Ils sont les
   bons puits pour vider un hangar : chacun sert à quelque chose plus tard — le
   labo aux recherches, les robots et les nanites à la vitesse des chantiers, le
   chantier spatial aux vaisseaux.
   Le Dépôt, le Silo, le Dock et le Terraformeur n'y sont pas : ils coûtent cher
   mais ne servent qu'à un usage précis, et les proposer pour vider un hangar
   ferait dépenser un emplacement de planète pour rien. La Fusion non plus : elle
   mange du deutérium tous les jours, et ce choix-là ne se prend pas pour
   désaturer un stock. Les hangars eux-mêmes sont écartés : c'est eux qu'on
   contourne. */
const PUITS = ['lab', 'robot', 'shipyard', 'nanite'];
/** Une recherche tourne-t-elle en ce moment ? Le jeu n'en permet qu'une. */
export function rechercheEnCours(){
  return (S.timers || []).some(t => t.kind === 't' && !t.done && t.end > Date.now());
}
/**
 * Ce qui vide le plus vite la ressource `j` ici, parmi ce qui est payable tout
 * de suite. La plus grosse dépense d'abord.
 *
 * Un hangar plus grand n'est pas la réponse quand le stock est DÉJÀ au plafond.
 * Il met des heures à monter, et la production reste à l'arrêt tout ce
 * temps-là : le hangar se prévoit avant la saturation, il ne la répare pas.
 * Ce qui redémarre la production, c'est dépenser — et dépenser gros, pour que
 * le plafond ne revienne pas dans l'heure.
 *
 * Quatre familles, et chacune a sa raison d'être traitée à part :
 *  - les mines et la centrale passent par `rankUpgrades`, qui sait ce qu'une
 *    montée oblige à payer en centrale ; celles qui en demandent une
 *    (`extraSolar`) sont écartées, le pas réel étant la centrale, pas la mine ;
 *  - les quatre puits de `PUITS` se lisent en direct : aucun ne consomme
 *    d'énergie, donc rien à arbitrer ;
 *  - les cases de forme de vie, par `lfCandidates`, qui tient déjà leurs prix ;
 *  - les recherches, mais seulement depuis la planète du labo — le jeu les paie
 *    là — et seulement si aucune ne tourne, puisqu'il n'en permet qu'une.
 * @param {object} p planète, réelle ou simulée
 * @param {number} j 0 métal, 1 cristal, 2 deutérium
 * @param {number[]} st le stock au sol — `stockNow(p)` sur une vraie planète,
 *   `p.st` sur une copie simulée
 * @returns {{kind:string, what:string, cost:number[], k?:string, lvl?:number}[]}
 *   la plus grosse dépense en premier ; vide quand rien n'est payable
 */
export function depensesPayables(p, j, st){
  const payable = c => c[j] > 0 && [0,1,2].every(i => c[i] <= st[i]);
  const out = [];
  /* Chaque niveau de bâtiment prend un emplacement : sur une planète pleine le
     jeu refuse tout, et un chantier proposé là serait un mensonge. Sans relevé
     des emplacements, `casesLibres` rend null et rien ne change. */
  if(casesLibres(p) !== 0){
    for(const u of rankUpgrades(p))
      if(B[u.key] && !u.extraSolar && payable(u.cost))
        out.push({kind:'b', what:`${B_SHORT[u.key]} ${u.lvl}`, k:u.key, lvl:u.lvl, cost:u.cost});
    for(const k of PUITS){
      if(reqOk(B[k].req, p).length) continue;
      const lvl = (p.b[k] || 0) + 1, c = levelCost(B[k], lvl);
      if(payable(c)) out.push({kind:'b', puits:true, what:`${B_SHORT[k]} ${lvl}`, k, lvl, cost:c});
    }
  }
  for(const q of ['lfbuilding','lfresearch'])
    for(const c of lfCandidates(p, q))
      if(payable(c.cost)) out.push({kind:'lf', what:`${c.nom} ${c.next}`, cost:c.cost});
  const lab = labPlanet();
  if(lab && lab.id === p.id && !rechercheEnCours())
    for(const k of Object.keys(T)){
      if(reqOk(T[k].req, p).length) continue;
      const lvl = (S.tech[k] || 0) + 1, c = levelCost(T[k], lvl);
      if(payable(c)) out.push({kind:'t', what:`${T[k].n} ${lvl}`, k, lvl, cost:c});
    }
  return out.sort((a,b)=>b.cost[j]-a.cost[j]);
}

/* ---------- daily planner ---------- */
/* Ce que chaque recherche rapporte, en une proposition qui se compose : « …, qui
   ajoute 1 % de métal… ». Le joueur voyait « Technologie Énergie 8 » sans rien
   d'autre, donc sans moyen de savoir que c'est un péage ni vers quoi il mène. */
const T_EFFET = {
  energy:    'ouvre les recherches suivantes',
  laser:     'ouvre les recherches suivantes',
  ion:       'ouvre les recherches suivantes',
  hyper:     'ouvre la propulsion hyperespace',
  plasma:    'ajoute 1 % de métal, 0,66 % de cristal et 0,33 % de deutérium sur toutes tes planètes à la fois',
  // Un niveau d'Astrophysique n'ajoute pas une expédition : il faut un carré
  // parfait. Le dire, parce que c'est exactement ce que le joueur croit.
  astro:     'ouvre une planète de plus un palier sur deux ; les expéditions simultanées, elles, n\'augmentent qu\'aux carrés parfaits (9, 16…)',
  computer:  'ajoute un emplacement de flotte par niveau',
  espionage: 'rend les rapports d\'espionnage plus complets',
  combustion:'ajoute 10 % de vitesse aux vaisseaux à combustion, transporteurs compris',
  impulse:   'ajoute 20 % de vitesse aux vaisseaux à impulsion',
  hyperdrive:'ajoute 30 % de vitesse aux vaisseaux à hyperespace',
  irn:       'ajoute les laboratoires de tes autres planètes à la vitesse de recherche',
};
/* Celles-ci ne font rien par elles-mêmes. On les traverse pour trouver la
   destination réelle d'un péage, au lieu de renvoyer le joueur vers un autre
   péage. */
const T_PEAGE = {energy:1, laser:1, ion:1, hyper:1};

/** Vrai si `k` exige `need`, directement ou par ses prérequis. */
function requiresTech(k, need, d){
  const rt = (T[k].req || {}).t || {};
  if(rt[need]) return true;
  return d < 6 && Object.keys(rt).some(x => requiresTech(x, need, d+1));
}
/** Première recherche utile, plus loin dans la feuille de route, qui exige `k`. */
function roadmapGoal(rm, i){
  for(let j = i+1; j < rm.length; j++)
    if(!T_PEAGE[rm[j][0]] && requiresTech(rm[j][0], rm[i][0], 0)) return rm[j];
  return null;
}
/**
 * Amortissement d'un niveau de recherche, en heures, ou null si la recherche ne
 * produit rien. Les bâtiments annoncent le leur depuis toujours ; la recherche,
 * jamais, alors que le modèle connaît déjà le bonus de Plasma. Les guides
 * répètent « Plasma d'abord » ; seul le chiffre dit si c'est vrai ici.
 * @param {string} k clé de recherche
 * @param {number} lvl niveau visé
 * @returns {number|null} heures de production pour rembourser le niveau
 */
function techPayback(k, lvl){
  if(k !== 'plasma' || !S.planets.length) return null;
  // Le gain est linéaire en Plasma : on le mesure sur un niveau, à bâtiments
  // égaux. `production` ne sait pas surcharger la recherche, d'où l'aller-retour.
  const garde = S.tech.plasma;
  const total = t => { S.tech.plasma = t; let m=0,c=0,d=0;
    for(const p of S.planets){ const pr = production(p); m+=pr.m; c+=pr.c; d+=pr.d; }
    return mse(m, c, d); };
  let gain;
  try { gain = total(garde + 1) - total(garde); } finally { S.tech.plasma = garde; }
  return gain > 0 ? mse(...levelCost(T[k], lvl)) / gain : null;
}
/** Niveau d'Astrophysique qui autorisera une planète de plus. */
export function astroForPlanet(){ return S.tech.astro + (S.tech.astro % 2 ? 2 : 1); }

const ROADMAPS = {
  /* Ne pas prioriser ne veut pas dire tout mener de front : le joueur n'a
     qu'un labo, qu'une file par planète et qu'une poignée d'emplacements de
     flotte. L'équilibre se fait donc sur les paliers qui servent deux piliers
     à la fois, et nulle part ailleurs. Espionnage ouvre le pillage et
     Astrophysique ; Ordinateur donne les emplacements que se partagent
     pillages et expéditions ; Astrophysique ajoute une planète, et une
     expédition simultanée aux carrés parfaits ; Combustion ramène les
     transporteurs plus vite, donc fait tourner les deux ; Plasma porte sur
     toutes les planètes à la fois. Peu de paliers critiques : ce sont eux qui
     mettent les ressources de côté, et un plan qui épargne tout le temps ne
     construit plus de mines ni de formes de vie. */
  equi:[['espionage',4,'c'],['impulse',3,'c'],['astro',3,'c'],['computer',4],['combustion',6],['astro',5,'c'],['energy',8],['laser',10],['ion',5],['plasma',4],['computer',6],['astro',7,'c'],['plasma',8],['astro',9]],
  /* Une planète de plus bat n'importe quelle recherche à ce stade : Astrophysique
     5 coûte 262 500 éq. et ouvre une production entière, quand la chaîne vers
     Plasma 4 coûte 785 800 pour 4 020/h. Plasma reste l'objectif de long terme,
     et chaque colonie le rend plus rentable — son bonus porte sur toutes les
     planètes. D'où le rythme : Astro 5 puis colonie, Astro 6 et 7 puis colonie,
     Astro 8 et 9 puis colonie. */
  ecocol:[['impulse',3,'c'],['astro',3,'c'],['computer',2],['espionage',4],['astro',5,'c'],['astro',7,'c'],['energy',8],['laser',10],['ion',5],['plasma',4],['astro',9],['computer',6],['plasma',8]],
  eco:[['energy',8],['laser',10],['ion',5],['plasma',6],['impulse',3],['astro',3],['computer',4],['plasma',10]],
  /* Le pillage que le copilote sait planifier est celui de l'onglet Cibles :
     des transporteurs sur un inactif, et `raidPlan` refuse la cible dès qu'une
     défense ou une flotte y tire. La feuille de route sert donc ce raid-là et
     pas le combat — Armes, Bouclier et Protection n'y sont pas, parce que rien
     dans le panneau ne saurait quoi en faire et qu'un palier qu'on ne sait pas
     exploiter n'est qu'un détour.
     Ce qui compte pour piller : voir les cibles (Espionnage), y aller vite
     (Combustion sur les transporteurs, puis Impulsion 5, où le petit
     transporteur change de moteur et double sa vitesse — 5 000 à 10 000), et
     en mener plusieurs de front (Ordinateur, un emplacement de flotte par
     niveau). L'économie vient après : un raideur a des mines comme tout le
     monde, elles ne sont simplement plus ce qui décide de sa journée. */
  /* Astrophysique n'est pas dans la liste, et c'est voulu : tant qu'il reste
     une case de planète libre la feuille de route la saute de toute façon, et
     dès qu'elles sont prises le plafond la remet en tête de lui-même. L'y
     écrire ne changeait qu'une chose — `roadmapGoal` faisait d'elle la
     destination d'Espionnage, et le pilleur lisait « prérequis de
     Astrophysique » là où la vraie raison est de voir ses cibles. */
  raid:[['espionage',4,'c'],['combustion',6,'c'],['computer',4],['impulse',5,'c'],['computer',6],['espionage',8],['energy',8],['laser',10],['ion',5],['plasma',4]],
  fleet:[['combustion',6,'c'],['impulse',3,'c'],['espionage',4],['computer',6],['astro',4],['hyper',3],['hyperdrive',2],['impulse',5],['astro',6],['energy',8]],
};
export const RESEARCH_MODE = {normal:'À son tour', first:'Avant les bâtiments'};
export function researchMode(){ return RESEARCH_MODE[S.day.research] ? S.day.research : 'normal'; }
/**
 * Ce qu'un réglage de journée vaut, d'après son contrôle. Les modes sont des
 * mots d'une liste fermée, tout le reste est un nombre d'heures ou de minutes.
 * La liste des modes se lit dans les tables : un mode ajouté à l'écran sans
 * être ajouté ici était converti en nombre, donc en 0, et le réglage ne
 * prenait jamais — en silence.
 * @param {string} k clé du réglage
 * @param {string} v valeur lue dans le contrôle
 * @param {*} prev valeur en place, gardée si le mot n'est pas de la liste
 */
export function dayValue(k, v, prev){
  if(k === 'night') return v === '1' || v === true;
  /* Vide veut dire « je n'ai pas d'heure de retour » : le plan retombe alors
     sur la longueur de la nuit. Zéro est une heure, pas une absence. */
  if(k === 'backHour'){ const x = parseInt(v); return Number.isFinite(x) && x >= 0 && x <= 23 ? x : null; }
  /* Le coucher et le réveil, à la minute : « 07:30 » d'un champ horaire, ou un nombre
     d'heures. Rien d'autre ne passe — l'ancienne valeur reste. */
  if(k === 'nightEnd' || k === 'nightStart'){
    const m = String(v).trim().match(/^(\d{1,2}):(\d{2})$/);
    const x = m ? +m[1] + +m[2] / 60 : String(v).trim() === '' ? NaN : Number(v);
    return Number.isFinite(x) && x >= 0 && x < 24 && (!m || +m[2] < 60) ? Math.round(x * 60) / 60 : prev;
  }
  const t = {focus:FOCUS, lf:LF_MODE, research:RESEARCH_MODE}[k];
  return t ? (t[v] ? v : prev) : Math.max(0, parseInt(v) || 0);
}
/* Les deux réglages que le style pose, et qu'il ne reprend jamais : ce que le
   plan vise, et le modèle de défense. Un turtle vise la tortue de fin de
   partie et les mines, un raideur le pillage et rien qui fortifie.

   Aucun des deux ne s'impose. Le réglage ne dit pas qui l'a écrit, alors le
   copilote s'en tient à ce qu'il peut savoir : tant que la valeur en place est
   celle du style d'avant — ou celle d'usine, pour qui n'a jamais répondu —
   elle suit ; dès qu'elle s'en écarte, c'est un choix du joueur et l'assistant
   n'y touche plus. Les deux ensemble, parce que c'est la même règle : l'avoir
   écrite pour le modèle de défense et oubliée pour le plan du jour est
   exactement ce que la relecture a trouvé.

   Ça compte d'autant plus pour le plan que deux de ses cinq valeurs —
   « Équilibré » et « Économie pure » — ne sont atteignables que par le menu
   des Réglages : aucun style ne les vise, donc ce sont précisément celles que
   l'assistant écraserait sans jamais pouvoir les rendre. */
/** @param {string} avant le style d'avant, vide s'il n'y en avait pas
    @param {string} apres le style qu'on vient de choisir */
export function styleRepose(avant, apres){
  const neuf = PROFILS.styles[apres]; if(!neuf) return;
  const vieux = PROFILS.styles[avant], def = sample();
  // `dayValue` relit la clé dans FOCUS, comme pour le menu des Réglages.
  if(S.day.focus === (vieux ? vieux.plan : def.day.focus))
    S.day.focus = dayValue('focus', neuf.plan, S.day.focus);
  if(S.settings.defModele === (vieux ? vieux.defense : def.settings.defModele))
    S.settings.defModele = neuf.defense;
}
/** Connection times over the planning horizon, skipping the night window. */
function sessionTimes(now){
  const out=[now], end=now+(+S.day.horizon||24)*3600e3, step=Math.max(15,+S.day.interval||90)*60e3;
  let t=now;
  while(out.length<80){
    t+=step;
    /* En pleine nuit, la connexion suivante est le réveil lui-même, à la
       minute : avancer d'heure en heure faisait d'un réveil à 7 h 30 une
       première connexion à 8 h. */
    if(isNight(t)){ const d = poseHeure(new Date(t), +S.day.nightEnd); if(d.getTime() <= t) d.setDate(d.getDate()+1); t = d.getTime(); }
    if(t>end) break;
    out.push(t);
  }
  return out;
}
/** Next actionable step toward a research target, or the lab level it waits for. */
function resolveTech(k, lvl, depth){
  if(S.tech[k]>=lvl || depth>6) return null;
  const req = T[k].req || {};
  if(req.t) for(const [rk,rl] of Object.entries(req.t)){ const r = resolveTech(rk, rl, depth+1); if(r) return r; }
  if(req.lab && labLevel()<req.lab) return {lab:req.lab};
  return {k, lvl:S.tech[k]+1};
}
/**
 * Pourquoi lancer ce niveau : l'étape, la destination du péage, l'effet qu'on
 * finira par toucher et, quand il se chiffre, l'amortissement.
 * @param {{k:string,lvl:number}} r prochain niveau réellement lançable
 * @param {string} k recherche visée par la feuille de route
 * @param {number} l niveau visé par la feuille de route
 * @param {Array|null} goal entrée de feuille de route que ce péage dessert
 * @returns {string}
 */
function techWhy(r, k, l, goal){
  const bouts = [];
  if(r.k !== k) bouts.push(`Prérequis pour ${T[k].n} ${l}`);
  else if(r.lvl < l) bouts.push(`Étape vers ${T[k].n} ${l}`);
  if(goal) bouts.push(`${bouts.length ? 'prérequis' : 'Prérequis'} de ${T[goal[0]].n} ${goal[1]}`);
  const effet = T_EFFET[goal ? goal[0] : k];
  let out = bouts.join(', ');
  out = out ? (effet ? `${out}, qui ${effet}.` : out+'.') : (effet ? majus(effet)+'.' : '');
  /* L'amortissement de l'étape en cours quand elle produit ; sinon celui du
     premier niveau de la destination, qui est la seule raison de payer le
     péage. Sans ce chiffre, « Énergie 8 » ne se compare à aucune mine. */
  const pb = techPayback(r.k, r.lvl);
  if(pb) return `${out} Amorti en ${dur(pb*3600)}.`.trim();
  const g = goal && goal[0] !== r.k ? techPayback(goal[0], S.tech[goal[0]]+1) : null;
  return g ? `${out} Son premier niveau s'amortira en ${dur(g*3600)}.`.trim() : out;
}
export function nextResearch(){
  let labNeed = 0, prioLab = 0; const list = [];
  /* La priorité du joueur se glisse en tête d'une copie de la feuille de route,
     avec le drapeau critique, et tout le reste suit tout seul : `resolveTech`
     remonte les prérequis et le labo qui manque, `crit` met l'épargne en route
     par le chemin que `tryResearch` a déjà. Une copie, jamais la table
     elle-même : `ROADMAPS` est lue à chaque session de chaque prévision.
     C'est `prioOf` qui arbitre, pas le `kind` : une priorité de bâtiment posée
     avant sur le centre tient le rang, et la recherche attend son tour. */
  const mienne = prioOf((labPlanet() || {}).id);
  const prio = mienne && mienne.kind === 't' ? mienne : null;
  /* Les pas que les règles du moteur poussent (RECH_PLASMA_MINER…) passent
     derrière la priorité du joueur et devant la feuille de route, sans drapeau
     critique : ils n'épargnent pas, ils passent à leur tour, en premier. */
  const pousses = reglesRecherche();
  const rm = (prio ? [[prio.k, prio.lvl, 'c']] : []).concat(pousses, ROADMAPS[S.day.focus] || ROADMAPS.ecocol);
  rm.forEach(([k,l,flag,rid], i)=>{
    const mien = !!prio && i === 0;
    /* Ordre de priorité : un emplacement de planète libre se colonise avant de
       payer le palier suivant. Tant qu'il en reste un, Astrophysique n'ajoute
       rien que la colonie n'apporte déjà — c'est quand ils sont tous pris que
       le palier passe en tête, plus bas. Une Astrophysique que le joueur a
       posée, elle, ne se saute pas : le copilote obéit sans juger, et une
       priorité sautée serait muette. */
    if(!mien && k==='astro' && S.tech.astro >= 1 && S.day.focus !== 'eco' && S.planets.length < maxPlanets()) return;
    const r = resolveTech(k, l, 0); if(!r) return;
    /* `prioLab` : le labo manque pour la priorité du joueur, et elle n'entre
       alors dans aucune liste. Sans ce chiffre rendu, la seule carte du jour
       est « Laboratoire 6 · Débloque la recherche suivante », que rien ne relie
       à ce que le joueur a posé — la priorité est muette. */
    if(r.lab){ labNeed = Math.max(labNeed, r.lab); if(mien) prioLab = r.lab; return; }
    const pourquoi = techWhy(r, k, l, roadmapGoal(rm, i));
    const deRegle = rid ? regleTexte(rid, 'raison', '', {style:(PROFILS.styles[S.profil.style] || {}).n || '', pct:hyperCargoPct(), cible:l}) : '';
    if(!list.some(x=>x.k===r.k)) list.push({k:r.k, lvl:r.lvl, crit:flag==='c', prio:mien, regle:rid || undefined,
      why:mien ? `Tu as mis ${T[k].n} ${l} en priorité. ${pourquoi}`.trim() : deRegle ? `${deRegle} ${pourquoi}`.trim() : pourquoi});
  });
  /* Les deux plafonds que le joueur touche tous les jours ont chacun leur
     recherche. La feuille de route cesse de parler d'Astrophysique dès qu'on l'a
     dépassée : plus rien ne dit alors comment envoyer une expédition de plus. */
  const plafonds = [];
  /* Le plafond des planètes vient en premier : passé le dernier palier
     d'Astrophysique de la feuille de route, plus rien ne disait comment en
     gagner une, et une colonie vaut plus que n'importe quelle recherche. Son
     texte remplace l'effet générique ; les plafonds suivants le complètent. En
     économie pure le plan ne colonise pas, donc ne rien promettre ici : le
     conseil s'en charge, sans engager le plan. */
  if(S.day.focus !== 'eco' && S.tech.astro && S.planets.length >= maxPlanets())
    plafonds.push(['astro', `Autorisera une ${maxPlanets()+1}ᵉ planète : une production complète, soit des dizaines de fois ce qu'ajoute un niveau de Plasma, pour trois fois moins cher. D'où sa place en tête. Les expéditions simultanées, elles, n'augmenteront qu'au niveau ${astroForExpo()}.`, true]);
  if(expoWanted() > expoCap()){
    const cap = expoCap(), need = astroForExpo();
    plafonds.push(['astro', need === S.tech.astro+1
      ? `Fait passer de ${cap} à ${cap+1} expéditions simultanées.`
      : `Étape vers Astrophysique ${need}, qui donnera une ${cap+1}ᵉ expédition simultanée.`]);
  }
  const fsl = fleetSlots();
  if(fsl && fsl[0] >= fsl[1]) plafonds.push(['computer', 'Un emplacement de flotte de plus : tes missions se marchent dessus.']);
  /* `tete` : ce plafond ne se range pas derrière la feuille de route, il la
     double. Une planète de plus vaut une production entière, quand les
     recherches qu'elle doublait ne font que grossir les mines existantes —
     attendre la fin de la chaîne vers Plasma revenait à payer trois fois le
     prix pour dix fois moins. */
  /* `garde` : la place que le joueur a prise. Un plafond « tête » double la
     feuille de route, mais pas une priorité — `tryResearch` ne regarde que
     `list[0]`, donc l'unshift de l'Astrophysique rendait la priorité inerte, et
     muette. Le copilote obéit, et il chiffre : ce que le plafond écarté coûte se
     dit sur la carte de la priorité, parce que la recherche repoussée n'a aucune
     ligne à elle — au-delà de `list[0]`, rien ne s'affiche. */
  const garde = (list[0] || {}).prio ? 1 : 0;
  for(const [k, why, tete] of plafonds){
    const r = resolveTech(k, S.tech[k]+1, 0); if(!r) continue;
    if(r.lab){ labNeed = Math.max(labNeed, r.lab); continue; }
    const w = r.k === k ? why : `Prérequis pour ${T[k].n}.`;
    const deja = list.find(x=>x.k===r.k);
    // Aujourd'hui le seul plafond « tête » est celui des planètes : son prix,
    // c'est la planète de plus qui attend.
    if(tete && garde && !(deja && deja.prio))
      list[0].why += ` Une planète de plus attend : tu as mis ${T[prio.k].n} ${prio.lvl} devant.`;
    // Les deux raisons sont vraies : le plafond s'ajoute à celle de la feuille
    // de route au lieu de l'écraser ou d'être perdu.
    if(deja){
      // Un plafond « tête » dit déjà, en plus précis, ce que disait l'effet
      // générique de la feuille de route : il le remplace au lieu de le répéter.
      // Sauf sur la carte de la priorité, qui dit d'abord qu'elle en est une.
      deja.why = tete && !deja.prio ? w : (deja.why ? deja.why+' '+w : w);
      const at = list.indexOf(deja);
      if(tete && at > garde){ deja.crit = true; list.splice(at, 1); list.splice(garde, 0, deja); }
      continue;
    }
    // Derrière ce que la feuille de route juge critique, et devant le reste
    // seulement quand les expéditions sont la stratégie choisie.
    const i = tete ? garde : (FOCUS_FLOTTE[S.day.focus] ? list.findIndex(x=>!x.crit) : -1);
    list.splice(i<0 ? list.length : i, 0, {k:r.k, lvl:r.lvl, crit:!!tete, why:w});
  }
  /* Les recherches mises de côté sortent de la liste, jamais une priorité du
     joueur : `tryResearch` ne regarde que `list[0]`, donc une recherche écartée
     laisse la place à la suivante au lieu de taire la file entière. */
  for(let i=list.length-1; i>=0; i--) if(!list[i].prio && refused(cardKey('t', '', list[i].k))) list.splice(i, 1);
  if(researchMode()==='first' && list[0]) list[0].crit = true;
  return {list, labNeed, prioLab, k:list[0]&&list[0].k, lvl:list[0]&&list[0].lvl};
}
/**
 * Une colonie qui déborde et n'a aucun transporteur doit pouvoir en construire.
 * Sinon chaque rapatriement commence par un vol à vide depuis la planète
 * d'accueil. Ne s'emploie que sur les planètes simulées, qui portent `st`.
 * @param {object} p planète simulée
 * @param {object} hub planète d'accueil
 * @returns {boolean}
 */
function needsOwnCargo(p, hub){
  if(!hub || p === hub) return false;
  if(((p.ships||{}).lc||0) + ((p.ships||{}).sc||0) > 0) return false;
  // `transferAt` est posé dès qu'un rapatriement part de cette planète : c'est
  // le fait durable. Le stock, lui, vient d'être vidé par ce rapatriement —
  // le tester seul ne renverrait jamais vrai.
  if(p.transferAt) return true;
  const cap = production(p).cap;
  return [0,1,2].some(j => p.st[j] > cap[j]*0.7);
}
/**
 * Un chantier qui a sorti un lot que le copilote n'a pas relu : il ne connaît
 * plus ni la flotte au sol, ni la défense, ni les satellites de cette planète,
 * et la file peut encore tourner derrière le lot qu'il a vu — le jeu n'annonce
 * que le premier. Tant que la page ne l'a pas redit, on ne propose rien à ce
 * chantier plutôt que de doubler ce qui existe déjà.
 * Une planète dont aucun lot n'a jamais été vu reste claire : le compte peut
 * être vieux, rien ne dit qu'il est faux.
 * @param {object} p planète
 * @returns {boolean}
 */
function chantierFlou(p){
  if(!p || (p.b||{}).shipyard < 1) return false;
  return (p.flotteFloue||0) > (p.shipsAt||0) || (p.defFloue||0) > (p.defsAt||0);
}
/**
 * Ce chantier flou vaut-il qu'on aille relire sa page, maintenant ?
 * Non tant que son lot est en route : la page dirait le même compte qu'avant,
 * le copilote resterait aveugle, et la carte reviendrait au prochain tour —
 * on demandait au joueur un geste qui ne pouvait rien changer. Oui dès que le
 * lot est au sol et que la page ne l'a pas encore redit.
 * @param {object} p planète
 * @returns {boolean}
 */
export function chantierARelire(p){
  if(!chantierFlou(p)) return false;
  const now = Date.now();
  return ((p.flotteFloue||0) > (p.shipsAt||0) && (p.flotteFloue||0) <= now)
      || ((p.defFloue||0) > (p.defsAt||0) && (p.defFloue||0) <= now);
}
/* ---------- ce qu'une priorité demande à une planète ---------- */
/* Le copilote obéit, et il chiffre. Une priorité que rien n'empêche devient un
   objectif ; une priorité qui ne peut rien faire doit le dire, parce qu'une
   priorité muette est exactement ce qui a tué le plan manuel. Ces trois
   fonctions sont les trois phrases qu'elle a le droit de prononcer. */
/**
 * Les prérequis qui manquent, mis en mots. Résoudre la chaîne n'est pas le
 * travail d'une priorité : « Nanites 1 » demande Robots 10, elle le dit et
 * elle attend, elle ne décide pas de monter Robots pour autant.
 * Ne lit que `p.b` et `S.tech` : elle sert aussi bien sur une planète réelle
 * que sur une copie de simulateDay, et les deux ne portent pas le stock sous
 * le même nom.
 * @param {object} p planète, réelle ou simulée
 * @param {string} k bâtiment visé
 * @returns {string} la phrase, ou '' quand la priorité est jouable
 */
function prioBloque(p, k){
  const miss = reqOk((B[k]||{}).req, p);
  return miss.length ? `${B[k].n} demande ${miss.join(' et ')} : ta priorité attend que ce soit là.` : '';
}
/**
 * Le bâtiment à monter avant celui-là, quand un prérequis manque.
 * Un prérequis bâtiment n'est pas une impasse, c'est le pas à faire : « Nanites 1 »
 * demande Robots 10, et c'est Robots que la priorité doit monter. La chaîne se
 * remonte — Terraformeur demande Nanites 1, qui demande Robots 10 — pour rendre
 * le premier niveau réellement constructible, jamais un palier intermédiaire
 * que le jeu refuserait encore.
 * Les prérequis de recherche ne sortent pas d'ici : une recherche ne se monte
 * pas sur une planète, et c'est `prioBloque` qui continue de les dire.
 * @param {object} p planète, réelle ou simulée
 * @param {string} k bâtiment visé
 * @param {number} [depth] profondeur, garde-fou contre une table abîmée
 * @returns {{k:string, lvl:number}|null} null quand aucun bâtiment ne manque
 */
function prioAvant(p, k, depth){
  const req = (B[k]||{}).req;
  if(!req || !req.b || (depth||0) > 6) return null;
  for(const [rk, rl] of Object.entries(req.b)){
    if((p.b[rk]||0) >= rl) continue;
    return prioAvant(p, rk, (depth||0)+1) || {k:rk, lvl:rl};
  }
  return null;
}
/**
 * Ce qu'il faut construire sur `p` maintenant pour cette priorité.
 * Le coût du prochain niveau peut dépasser ce qu'un hangar de la planète peut
 * loger : la production s'y arrête, l'attente devient infinie et `setGoal`
 * rendrait `null` — la priorité disparaîtrait sans un mot. Elle ne disparaît
 * pas, elle fait un pas de côté et commence par le hangar.
 * Le test ne peut pas passer par `waitFor`, qui lit `p.stock` : les copies de
 * `simulateDay` portent `st`. Il se fait donc sur `production(p).cap`, et le
 * `{small:[…]}` qu'attend `storageNote` se reconstruit avec `storageLevelFor`.
 * Une recherche y passe aussi : Plasma 12 coûte 8,2 M de cristal, soit un
 * Hangar C 11, et le silence de `setGoal` serait le même. Son pas, lui, n'est
 * pas « le niveau suivant du bâtiment » mais celui que `resolveTech` a choisi,
 * donc son coût est donné de l'extérieur.
 * @param {object} p planète simulée
 * @param {{kind:string, k:string, lvl:number}} pr la priorité du joueur ; `lvl`
 *   est le niveau visé, celui qui se dit sur la carte
 * @param {number[]} [cost] coût du pas à payer, quand ce n'est pas celui du
 *   niveau suivant du bâtiment visé
 * @returns {{k:string, lvl:number, why:string}|null} null pour une recherche
 *   qui tient dans les hangars : elle suit alors son propre chemin, la feuille
 *   de route, et n'a rien à construire ici.
 */
function prioStep(p, pr, cost){
  const cap = production(p).cap, sk = ['smetal','scrystal','sdeut'], bat = pr.kind === 'b';
  const suivant = (p.b[pr.k]||0)+1, c = bat ? levelCost(B[pr.k], suivant) : cost;
  /* `pr.vise` : la phrase toute faite d'un pas qui n'est pas la cible elle-même
     — un prérequis. Sans elle, la carte annonçait « Tu as mis Robots 10 en
     priorité » sur une priorité que le joueur avait posée sur les Nanites. */
  const vise = pr.vise || `Tu as mis ${bat ? B_SHORT[pr.k] : T[pr.k].n} ${pr.lvl} en priorité.`;
  for(let j=0;j<3;j++) if(c[j] > cap[j]){
    /* Le niveau qui logerait le coût est la destination, pas le pas : le jeu ne
       construit un hangar qu'un niveau à la fois, et viser le niveau 8 depuis le
       3 émettait une carte impossible, payait un seul niveau pour en poser
       trois, et surtout coûtait plus que le plafond du moment — `setGoal`
       rendait alors `null`, et la priorité n'épargnait jamais. Un niveau par
       session : la cible est atteignable, et les suivantes le deviennent. */
    const L = Math.min(storageLevelFor(c[j]), (p.b[sk[j]]||0)+1);
    return {k:sk[j], lvl:L, why:`${vise} ${storageNote({small:[{res:j, k:sk[j], lvl:L}]})}`};
  }
  return bat ? {k:pr.k, lvl:suivant, why:vise} : null;
}
/**
 * Laquelle des trois ressources n'arrivera jamais ici, et pourquoi. C'est ce
 * que `setGoal` tait quand il rend `null` : soit la planète ne produit pas
 * cette ressource et n'en a pas en réserve, soit le montant est plus grand que
 * ce que ses hangars peuvent loger — et un hangar ne se remplit pas au-delà de
 * son plafond, seule une livraison n'est pas plafonnée.
 * @param {object} p planète simulée
 * @param {number[]} cost le coût que personne ne pourra réunir
 * @returns {string}
 */
function prioRien(p, cost){
  const pr = production(p), r = [pr.m, pr.c, pr.d], noms = ['métal','cristal','deutérium'];
  for(let j=0;j<3;j++){
    if(cost[j] <= p.st[j]) continue;
    if(cost[j] > pr.cap[j]) return `Il en faut ${fmt(cost[j])} de ${noms[j]} d'un seul coup, plus que ${planetRef(p)} ne peut en loger : seule une livraison par transport, calée juste avant, les y amènera.`;
    if(r[j] <= 0) return `${planetRef(p)} ne produit pas de ${noms[j]} et n'en a pas en réserve : rien ne l'y amènera tout seul.`;
  }
  return '';
}

/**
 * Ce qui met cette mine-là devant, au-delà de son amortissement : le mélange de
 * l'empire, et ce que le sol de cette planète donne de mieux.
 *
 * Les deux entrent déjà dans le calcul — le besoin par `besoinEmpire`, le sol
 * par le bonus de position dans `production`. Ici ils se disent seulement, parce
 * qu'une carte dont la raison ne se lit pas se fait ignorer, et c'est ce qui
 * arrivait : « amorti en 567 h » sur une mine de métal ne dit pas pourquoi le
 * métal, et surtout pas pourquoi pas le cristal.
 * @param {object} p la planète
 * @param {string} k 'metal', 'crystal' ou 'deut'
 * @returns {string} un bout de phrase à coller derrière l'amortissement, ou ''
 */
function mineWhy(p, k){
  const i = VOC_KEYS.indexOf(k);
  if(i < 0) return '';
  const w = besoinEmpire(), bouts = [];
  /* Dire aussi le cas gênant — « tu en produis déjà trop, et c'est quand même
     le meilleur pas » — est le seul moyen que le joueur distingue un classement
     qui a vu son mélange d'un classement qui l'ignore. */
  if(w[i] >= 1.05) bouts.push(`ton empire manque de ${NOM_RES[i]}`);
  else if(w[i] <= .95) bouts.push(`tu produis déjà plus que ta part de ${NOM_RES[i]}`);
  const v = vocations()[p.id], vi = v ? v.keys.indexOf(k) : -1;
  if(vi >= 0){
    /* `why` est le `join(' · ')` des raisons dans l'ordre de `keys` : on reprend
       celle de CETTE ressource. Citer tout `why` collait la température de la
       vocation deutérium derrière une mine de cristal. */
    const sienne = String(v.why || '').split(' · ')[vi];
    bouts.push(`c'est ta planète à ${VOC_NOM[k].toLowerCase()}${sienne ? ` (${sienne})` : ''}`);
  }
  return bouts.length ? ` — ${bouts.join(', et ')}` : '';
}

/** Building candidates for a simulated planet, most urgent first. */
function pickBuildings(p, ctx){
  /* Planète pleine : le jeu refuse tout, y compris la montée d'une mine — un
     niveau de plus est un emplacement de plus. Proposer quand même serait la
     même faute que la case de forme de vie que la population bloque. Sans
     relevé des emplacements, `casesLibres` rend null et rien ne change. */
  if(casesLibres(p) === 0) return [];
  const pr = production(p), iv = ctx.iv, rates=[pr.m,pr.c,pr.d], sk=['smetal','scrystal','sdeut'], out=[];
  /* `libre` : ce candidat-là ne se voit pas opposer la réserve de la priorité.
     Les deux chantiers de secours protègent la production qui paie la
     priorité, et la priorité ne peut pas s'interdire à elle-même de dépenser
     ce qu'elle a mis de côté. */
  /* Un « Non » se pose ici, avant le choix : écarté de la liste des candidats,
     le bâtiment laisse la place au pas suivant au lieu de laisser un trou — ce
     que le joueur attend quand il met le hangar de côté pour monter son usine.
     La priorité du joueur, plus bas, ne passe pas par `add` : elle ne peut pas
     s'écarter elle-même. */
  const add = (k, why, libre)=>{ if(!out.some(o=>o.k===k) && !refused(cardKey('b', p.id, k))) out.push({k, lvl:p.b[k]+1, why, libre:!!libre}); };
  const ranked = rankUpgrades(p).filter(u=>u.payback<Infinity && B[u.key]);
  const satsSoon = p.satPending && p.satPending > ctx.T;
  if(pr.factor<1 && !satsSoon && regleActive('RES_ENERGY_NEGATIVE')) add('solar', 'Énergie négative : tes mines tournent au ralenti', true);
  const plafond = regleParam('RES_STORAGE_FULL', 'seuil', .98), plafondOn = regleActive('RES_STORAGE_FULL'), bientotOn = regleActive('RES_STORAGE_SOON');
  /* Deux régimes, deux gestes. Avant la saturation, le hangar — mais assez tôt
     pour être MONTÉ avant le plafond : son propre temps de construction fait
     partie du délai, sinon la carte sortait le jour où il était déjà trop tard.
     Au plafond, le hangar n'y peut plus rien (voir depensesPayables) : on
     dépense, et le plus gros chantier payable passe devant. */
  for(let j=0;j<3;j++){
    if(!(rates[j]>0)) continue;
    if(plafondOn && p.st[j] >= pr.cap[j]*plafond){
      /* Le plan ne pose ici que des chantiers : une recherche ou une case de
         forme de vie suit sa propre file, et l'alerte de la planète, elle, les
         nomme toutes.
         Et il ne pose qu'une montée productive — une mine, la centrale : elle
         vide le stock ET produit davantage, donc le plafond met plus longtemps
         à revenir. Les puits de `PUITS` sont écartés ici, même quand ils sont
         plus chers. Deux raisons, et la seconde est la vraie :
           — classer sur le seul prix faisait monter « Chantier spatial 8 » tous
             les deux tours sur une planète sans vaisseaux à construire, et la
             défense n'avait plus rien ;
           — quand aucune mine n'est payable, c'est que le hangar plafonne le
             stock SOUS le prix du niveau suivant. Le hangar est alors la bonne
             réponse, et la seule : il relève le plafond jusqu'à ce que la mine
             devienne payable. Un puits payé à sa place reporte le problème d'un
             tour. On laisse donc le hangar sortir — l'alerte de la planète, qui
             conseille et ne pose rien, nomme le puits et la recherche en plus. */
      const d = depensesPayables(p, j, p.st).find(x => x.kind === 'b' && !x.puits);
      /* Même garde que le secours d'énergie juste au-dessus : des satellites
         déjà en chantier apportent l'énergie, et une centrale de plus serait
         payée pour rien — même pour vider un hangar. */
      if(d && d.k && !(d.k === 'solar' && satsSoon)){ add(d.k, `Le ${NOM_RES[j]} est au plafond : ta production est arrêtée, et c'est le plus gros chantier payable tout de suite`, true); continue; }
    }
    /* Le hangar ne passe qu'en dernier, et seulement quand le débordement
       revient (RES_STORAGE_FULL.recurrence fois en sept jours) ou que la mine
       suivante ne tient plus dedans : une livraison ponctuelle qui remplit le
       hangar une fois ne justifie pas des heures de chantier et des millions
       de métal. Le reste du temps, la carte Ressources en trop dit où dépenser
       ou envoyer l'excédent. */
    const mont = buildTime(sk[j], (p.b[sk[j]]||0)+1, p), lead = Math.max(iv*2, iv + mont/3600);
    if(bientotOn && p.st[j]+rates[j]*lead >= pr.cap[j]*plafond && hangarSiJustifie(p, j)) add(sk[j], `Hangar plein dans moins de ${dur(lead*3600)}, et il met ${dur(mont)} à sortir`, true);
  }
  /* La priorité du joueur passe ici : derrière les deux secours — une mine au
     ralenti coûte de la production à chaque heure, une priorité repoussée ne
     coûte que du temps — et devant tout le classement par amortissement, qui
     est tout l'objet de la manœuvre. Le labo, lui, n'a aucun amortissement en
     production et n'entre dans aucun classement : un candidat forcé est le
     seul chemin par lequel « Labo 10 » peut sortir. */
  /* `ctx.prio` est le pas que la priorité a retenu, déjà calculé par
     `prioStep` : la boucle des priorités l'a choisi avant toute cette session,
     et pour une recherche l'appelant est le seul à connaître le coût du niveau
     à payer. */
  if(ctx.prio){
    /* Robots au-delà de 10, posés par le joueur : il est servi, et la carte
       chiffre ce que les nanites feraient à la place (INST_NANITES_OVER_ROBOTS). */
    const rn = ctx.prio.k === 'robot' && regleActive('INST_NANITES_OVER_ROBOTS') && robotsOuNanites(p, ctx.prio.lvl);
    const pas = rn ? Object.assign({}, ctx.prio, {why:`${ctx.prio.why} Usine de nanites ${rn.nanite} diviserait le temps des chantiers par 2, Robots ${rn.robots} le divise par ${rn.gain}.`}) : ctx.prio;
    const deja = out.find(o=>o.k===pas.k);
    // Un secours qui vise déjà ce bâtiment y va un niveau à la fois, et c'est
    // le même pas : les deux raisons sont vraies, elles s'ajoutent.
    if(deja){ deja.why = deja.why ? `${deja.why}. ${pas.why}` : pas.why; deja.prio = true; }
    else out.push({k:pas.k, lvl:pas.lvl, why:pas.why, libre:true, prio:true});
  }
  const best = ranked[0];
  if(best){ const bc = best.extraSolar ? levelCost(B.solar,p.b.solar+1) : levelCost(B[best.key],best.lvl); for(let j=0;j<3;j++) if(bc[j]>pr.cap[j]) add(sk[j], regleTexte('RES_MINE_BLOCKED_BY_STORAGE', 'raison', 'Hangar trop petit pour la suite', {mine:upLabel(best)})); }
  for(const g of ctx.goals||[]) if(g.p===p) for(let j=0;j<3;j++) if(g.cost[j]>pr.cap[j]) add(sk[j], `Hangar trop petit pour ${g.label}`);
  if(ctx.wantColony && p===ctx.dep && p.b.shipyard<4){
    if(p.b.robot<2) add('robot', 'Prérequis du chantier spatial.' + centreNote());
    else add('shipyard', 'Prérequis du vaisseau de colonisation.' + centreNote());
  }
  if(ctx.labNeed && p===ctx.labP && p.b.lab<ctx.labNeed && !ctx.researchRunning) add('lab', POURQUOI_LABO + centreNote());
  if(needsOwnCargo(p, ctx.hub) && p.b.shipyard < 2){
    if(p.b.robot < 2) add('robot', 'Prérequis du chantier spatial');
    else add('shipyard', 'Pour que cette colonie ait ses propres transporteurs');
  }
  /* Les règles d'installation et l'équilibre des mines entrent comme les robots
     juste en dessous : des candidats forcés, avant le classement par
     amortissement, mais bornés en prix par rapport à son meilleur pas — sans
     cette borne, une règle « conseil » réécrirait le classement que le
     copilote a construit pour juger. Le Terraformeur n'a pas de borne : une
     planète pleine refuse tout, et lui seul la rouvre. */
  const borne = (c, f) => !!best && mse(...c) <= f * mse(...best.cost);
  if(regleActive('INST_FIELDS_LOW') && !(p.regOff || {}).INST_FIELDS_LOW && casesBasses(p) != null && !reqOk(B.terra.req, p).length)
    add('terra', `Plus que ${casesBasses(p)} cases libres : le Terraformeur en ajoute`);
  const nr8 = regleActive('INST_NANITES_LAGGING') && naniteRetard(p);
  if(nr8 && borne(levelCost(B.nanite, nr8.n + 1), regleParam('INST_NANITES_LAGGING', 'facteurCout', 5)))
    add('nanite', `Nanites ${nr8.n} ici, ${nr8.max} ailleurs : chaque niveau divise par deux le temps des chantiers de la planète`);
  const lr = regleActive('INST_LAB_NETWORK') && !ctx.researchRunning && laboEnRetard(p);
  if(lr && borne(levelCost(B.lab, lr.niveau + 1), 3))
    add('lab', `Laboratoire ${lr.niveau} pour ${lr.centre} au centre : avec le Réseau, ce labo compte dans la vitesse de tes recherches`);
  const eq = regleActive('RES_MINE_BALANCE') && mineEnRetard(p);
  if(eq && !(ranked.find(u => u.key === eq.k) || {}).extraSolar && borne(levelCost(B[eq.k], p.b[eq.k] + 1), regleParam('RES_MINE_BALANCE', 'facteurCout', 2)))
    add(eq.k, `Cible métal − cristal : ${signe(eq.cible)}, actuel : ${signe(eq.actuel)}${mineWhy(p, eq.k)}`);
  const robotTarget = Math.min(10, Math.floor(Math.max(p.b.metal,p.b.crystal)/2));
  if(p.b.robot < robotTarget && best){ const rc = levelCost(B.robot,p.b.robot+1); if(mse(...rc) <= 3*mse(...best.cost)) add('robot', 'Accélère toutes les constructions'); }
  for(const u of ranked.slice(0,2)){
    if(u.extraSolar && satsSoon) add(u.key, `Meilleur rendement, énergie fournie par les satellites`);
    else if(u.extraSolar) add('solar', regleTexte('RES_ENERGY_NEXT_MINE', 'raison', 'Énergie pour {mine}', {mine:`${B_SHORT[u.key]} ${u.lvl}`}));
    else add(u.key, `Meilleur rendement : amorti en ${dur(u.payback*3600)}${mineWhy(p, u.key)}`);
  }
  return out;
}
/** Simulates the day: production, queues, and what to launch at each connection. */
export function simulateDay(){
  /* La copie porte l'id de sa planète : plus bas, `S.planets` est remplacé par
     cette liste, et sans id le centre choisi par le joueur devenait
     introuvable — `centreIndex()` retombait en silence sur le choix
     automatique pour tout le reste de la journée simulée. */
  const now = Date.now(), real = {tech:S.tech, planets:S.planets};
  const target = coloTarget(), colFlight = (coloFleet().leg1||{}).secs || 0;
  const P = S.planets.map((p,i)=>({i, id:p.id, name:p.name, coords:p.coords, tmax:p.tmax, cases:p.cases, sats:p.sats, b:Object.assign({},p.b), ships:Object.assign({},p.ships||{}), st:projectResources(p, now), liv:livraisons(p).filter(l=>l.at>now), bq:now, bqKey:null, sq:now, flou:chantierFlou(p), lf:Object.assign({},p.lf||{}), lfq:{lfbuilding:now, lfresearch:now}, gid:p.gid, crawlers:p.crawlers, overload:p.overload, satsOk:p.satsOk, def:p.def, defs:p.defs ? Object.assign({},p.defs) : p.defs, defModele:p.defModele, defPalier:p.defPalier, regOff:p.regOff, race:p.race}));
  const expoBusy = [], expoDeja = {};
  const fleetReturns = (S.timers||[]).filter(t=>t.kind==='x' && (t.k==='fleet'||t.k==='expo') && !t.done && t.end>now).map(t=>t.end).sort((a,b)=>a-b);
  const sim = {tech:Object.assign({},S.tech), rq:now, ev:[], colShip:colBuilt(), colReady:colBuilt()?now:Infinity, colSent:colSentNow(), rSince:{}, away:{}};
  const busy = [];
  for(const t of S.timers||[]){
    if(t.done || t.end<=now) continue;
    const pi = planetIndexById(t.pid);
    if(t.kind==='t' && T[t.k]){ sim.rq=Math.max(sim.rq,t.end); busy.push({q:'Recherche · '+planetRef(labPlanet()), what:timerLabel(t), end:t.end, p:pi}); sim.ev.push({at:t.end, fn:()=>{ sim.tech[t.k]=Math.max(sim.tech[t.k],t.lvl); }}); }
    else if(t.kind==='b' && P[pi]){ const p=P[pi]; p.bq=Math.max(p.bq,t.end); p.bqKey=t.k; busy.push({q:'Bâtiment · '+planetRef(p), what:timerLabel(t), end:t.end, p:pi}); sim.ev.push({at:t.end, fn:()=>{ p.b[t.k]=Math.max(p.b[t.k],t.lvl); }}); }
    else if(t.kind==='x' && t.k==='expo'){ expoBusy.push(t.end); busy.push({q:'Flotte', what:timerLabel(t), end:t.end, p:pi}); if(t.manual && t.ships && P[pi]){ const p=P[pi]; for(const [k,n] of Object.entries(t.ships)) p.ships[k]=Math.max(0,(p.ships[k]||0)-n); sim.ev.push({at:t.end, fn:()=>{ for(const [k,n] of Object.entries(t.ships)) p.ships[k]=(p.ships[k]||0)+n; }}); } }
    else if(t.kind==='x' && t.k==='fleet'){ busy.push({q:'Flotte', what:timerLabel(t), end:t.end, p:pi}); if(t.manual && t.ships && P[pi]){ const p=P[pi]; for(const [k,n] of Object.entries(t.ships)) p.ships[k]=Math.max(0,(p.ships[k]||0)-n); sim.ev.push({at:t.end, fn:()=>{ for(const [k,n] of Object.entries(t.ships)) p.ships[k]=(p.ships[k]||0)+n; }}); } }
    else if(t.kind==='x' && t.k!=='sats' && (t.k==='shipyard' || t.queue==='shipyard') && P[pi]){ const p=P[pi]; p.sq=Math.max(p.sq,t.end); busy.push({q:'Chantier spatial · '+planetRef(p), what:timerLabel(t), end:t.end, p:pi}); if(t.manual && t.ships) sim.ev.push({at:t.end, fn:()=>addBuilt(p, t.ships)}); }
    else if(t.kind==='x' && (t.queue==='lfbuilding' || t.queue==='lfresearch') && P[pi]){ const p=P[pi]; p.lfq[t.queue]=Math.max(p.lfq[t.queue],t.end); busy.push({q:'Forme de vie · '+planetRef(p), what:timerLabel(t), end:t.end, p:pi}); }
    else if(t.kind==='x' && t.k==='sats' && P[pi]){ const p=P[pi]; p.sq=Math.max(p.sq,t.end); p.satPending=t.end; busy.push({q:'Chantier spatial · '+planetRef(p), what:timerLabel(t), end:t.end, p:pi}); sim.ev.push({at:t.end, fn:()=>{ p.sats+=t.n||0; p.satPending=0; }}); }
    else if(t.kind==='x' && t.k==='colship'){ const p=P[planetIndexById(S.colo.fromId)]||P[0]; p.sq=t.end; sim.colShip=true; sim.colReady=t.end; busy.push({q:'Chantier spatial', what:'Vaisseau de colonisation', end:t.end, p:pi}); }
    /* Un chantier que le relevé n'a pas su nommer : le jeu n'écrit pas toujours
       l'identifiant de ce qu'il construit, et le minuteur arrive alors sans
       technologie. Il ne vaut plus que par sa file — et sa file suffit. Sans
       ces deux lignes il n'existait que pour les tuiles du jeu, qui se fient à
       `queue`, pendant que le plan, qui se fiait à `kind`, relançait sur une
       planète déjà prise. On ne sait pas ce qui monte : la file est occupée,
       aucun niveau ne s'ajoute à la fin. */
    else if(t.kind==='x' && t.queue==='building' && P[pi]){ const p=P[pi]; p.bq=Math.max(p.bq,t.end); busy.push({q:'Bâtiment · '+planetRef(p), what:timerLabel(t), end:t.end, p:pi}); }
    else if(t.kind==='x' && t.queue==='research'){ sim.rq=Math.max(sim.rq,t.end); busy.push({q:'Recherche · '+planetRef(labPlanet()), what:timerLabel(t), end:t.end, p:pi}); }
  }
  /* Les expéditions en vol, prises sur les mouvements de flotte du jeu
     (mission 15, trajet de retour). Les compter sur les seuls minuteurs les
     sous-comptait : un retour sans minuteur et le plan voyait un emplacement
     libre là où le jeu affichait « Expéditions 2/2 », donc proposait une
     expédition de plus qu'il n'en existe. Le minuteur du jeu porte l'heure
     d'arrivée du mouvement, d'où le dédoublonnage — après la boucle, pour que
     ce que les minuteurs ont posé soit déjà là. */
  for(const m of S.moves||[]){
    if(m.mission !== 15 || !m.ret) continue;
    const fin = m.arrival*1000;
    if(fin > now && !expoBusy.includes(fin)) expoBusy.push(fin);
  }
  /* Un rapatriement parti dans le jeu sans passer par « Lancé » : le plan n'en
     savait rien et reproposait la même carte à chaque passage, comme si le
     joueur n'avait rien fait. Les mouvements de flotte le disent — Transporter
     et Stationner, trajet aller ou retour — et la planète d'où partent les
     vaisseaux n'a plus de rapatriement à faire tant qu'ils volent.
     Les mouvements ne disent pas combien de vaisseaux partent : la flotte à
     quai reste donc comptée comme présente. C'est la carte qui cesse de
     revenir, pas la soute qui se déduit. */
  for(const m of S.moves||[]){
    if(m.mission !== 3 && m.mission !== 4) continue;
    const fin = m.arrival*1000; if(fin <= now) continue;
    const depart = m.ret ? m.dest : m.origin;
    const i = S.planets.findIndex(p => p.coords === depart);
    if(i >= 0 && P[i]) P[i].transferAt = Math.max(P[i].transferAt||0, fin);
  }
  /* Le chiffre que le jeu affiche lui-même — « Expéditions 2/2 » — complète ce
     que les minuteurs et les mouvements ont donné. Eux connaissent l'heure de
     retour, lui ne connaît qu'un nombre : il passe donc en dernier, et ses
     entrées expirent quand la lecture cesse d'être fiable. Sans ça, le plan
     proposait une expédition de plus que le jeu n'en accepte dès que le joueur
     n'ouvrait pas la page Mouvements de flotte. */
  const expoRead = expoInFlight();
  if(expoRead) while(expoBusy.length < expoRead.n) expoBusy.push(expoRead.at + EXPO_READ_TTL);
  /* Les cargaisons en vol se posent dans la journée simulée à leur heure
     d'arrivée, sans plafond : une livraison peut dépasser le hangar, seule la
     production s'y arrête (`accrue`). Une construction qu'un convoi finance
     tombe donc à la première connexion après son arrivée. */
  for(const q of P) for(const l of q.liv) sim.ev.push({at:l.at, fn:()=>{ l.cargo.forEach((x,j)=>{ q.st[j] += x; }); q.liv = q.liv.filter(e=>e!==l); }});
  const iv = Math.max(15,+S.day.interval||90)/60;
  // Les alertes se lisent sur l'état réel, avant que la simulation ne prenne
  // la place de S.planets : ce sont les ennuis d'aujourd'hui, pas ceux prévus.
  // Trié par sévérité, l'ordre des planètes conservé à sévérité égale : sans
  // cela un Urgent de la deuxième planète se lit sous un Attention de la
  // première, et le joueur à quatre planètes balaie la carte de travers.
  const alerts = S.planets.flatMap(p=>planetAlerts(p).map(a=>Object.assign({pid:p.id}, a))).sort((a,b)=>(a.sev==='bad'?0:1)-(b.sev==='bad'?0:1));
  /* Les constats des règles, sur le même état réel et pour la même raison. Ils
     marquent plus bas les cartes de la première connexion qui leur répondent. */
  const cs = constats();
  const lfSusp = new Map(S.planets.map(p => [p.id, lfSuspendu(p)]));
  S.tech = sim.tech; S.planets = P;
  try{
    const startV = P.reduce((a,p)=>{ const r=production(p); return a+mse(r.m,r.c,r.d); },0);
    const accrue = (a,b)=>{ if(b<=a) return; const h=(b-a)/36e5; for(const p of P){ const pr=production(p); [pr.m,pr.c,pr.d].forEach((r,j)=>{ if(r>0 && p.st[j]>=pr.cap[j]) return; p.st[j] = r>0 ? Math.min(pr.cap[j], p.st[j]+r*h) : Math.max(0, p.st[j]+r*h); }); } };
    let cur = now;
    const advance = to=>{ sim.ev.sort((x,y)=>x.at-y.at); while(sim.ev.length && sim.ev[0].at<=to){ const e=sim.ev.shift(); accrue(cur, Math.max(cur,e.at)); cur=Math.max(cur,e.at); e.fn(); } accrue(cur,to); cur=Math.max(cur,to); };
    const can = (p,c,res)=>c.every((x,j)=>p.st[j]-x >= (res?res[j]:0)-1e-6);
    const pay = (p,c)=>c.forEach((x,j)=>p.st[j]-=x);
    const missOf = (p,c)=>c.map((x,j)=>Math.max(0,Math.ceil(x-p.st[j])));
    /* Le délai compte les convois encore en vol vers la planète : ceux que la
       simulation n'a pas encore posés. Sans horizon ici — la borne des 24 h
       est celle de l'affichage, pas celle des objectifs. */
    const wait = (p,c)=>whenAffordable(p, c, {st:p.st, at:cur, evs:p.liv||[], horizon:1e7}).secs;
    const finance = (p,c)=>whenAffordable(p, c, {st:p.st, at:cur, evs:p.liv||[]});
    const sessions = [];
    let goals = [];
    /* Le rang de pose, par clé d'objectif : c'est lui qui arbitre où vont les
       rapatriements de l'empire. L'ordre du tableau `goals` ne pouvait pas le
       dire — la clé d'une priorité change dès que son pas avance, et le nouvel
       objectif part en fin de tableau, si bien que la destination tournait
       d'une session à l'autre. La boucle des priorités le réécrit à chaque
       session depuis la liste du joueur, qui en est la seule source — et un
       objectif le garde depuis sa pose : une priorité qui s'accomplit en cours
       de journée fait descendre les suivantes sans changer leur ordre. */
    let prioRang = new Map();
    const RES = ['métal','cristal','deutérium'];
    const reserveOf = (p, Tm, skip, only)=>{ const pr=production(p), r=[pr.m,pr.c,pr.d], out=[0,0,0]; for(const g of goals){ if(g.p!==p || g===skip || (only && g!==only)) continue; const h=Math.max(0,(g.deadline-Tm)/3600e3); g.cost.forEach((x,j)=>out[j]+=Math.max(0, x - r[j]*h)); } return out; };
    /* Les objectifs qui retiennent quelque chose sur la planète, nommés : le
       joueur qui voit une carte attendre doit pouvoir lire pour quoi la
       planète épargne. `skip` est celui que la carte sert elle-même, qui ne
       la retient pas. */
    const heldByOf = (p, Tm, skip)=>goals.filter(g=>g.p===p && g!==skip && reserveOf(p,Tm,null,g).some(x=>x>0)).map(g=>g.label).join(' et ');
    const setGoal = (key, label, cost, p, Tm)=>{
      let g = goals.find(x=>x.key===key);
      if(g) return g;
      const w = wait(p, cost); if(!isFinite(w)) return null;
      const pr=production(p), r=[pr.m,pr.c,pr.d];
      let bott=0, worst=-1; cost.forEach((x,j)=>{ const t = x>p.st[j] ? (x-p.st[j])/Math.max(r[j],1e-9) : 0; if(t>worst){ worst=t; bott=j; } });
      g = {key, label, cost, p, deadline: Tm + w*1000 + iv*3600e3, res:RES[bott], since:Tm,
        rang: prioRang.has(key) ? prioRang.get(key) : Infinity};
      goals.push(g); return g;
    };
    const dropGoal = key=>{ goals = goals.filter(g=>g.key!==key); };
    /* `reserveOf` somme les objectifs d'une même planète : deux réserves la
       gèlent entière, jusqu'à ce que les deux soient payables. Tant qu'une
       priorité du joueur épargne ici, le moteur ne s'en donne donc pas un
       second de son propre chef — la recherche critique et le vaisseau de
       colonisation attendent leur tour, et leur ligne d'attente le dit. */
    const epargnePrio = p => goals.some(g=>g.p===p && g.key.startsWith('prio:'));
    for(const Tm of sessionTimes(now)){
      advance(Tm);
      const acts=[], waits=[], soft=[];
      /* Tout ce qu'un bâtiment de cette planète est en train de réunir, sans
         limite de délai : ce que la production n'aura pas couvert d'ici là. */
      const softAll = p=>{ const pr=production(p), r=[pr.m,pr.c,pr.d], out=[0,0,0]; for(const x of soft){ if(x.p!==p) continue; x.cost.forEach((c,j)=>out[j]+=Math.max(0, c - r[j]*(x.eta/3600+iv))); } return out; };
      const softRes = p=>{ const pr=production(p), r=[pr.m,pr.c,pr.d], out=[0,0,0]; for(const x of soft){ if(x.p!==p || !(x.eta<=3*3600)) continue; x.cost.forEach((c,j)=>out[j]+=Math.max(0, c - r[j]*(x.eta/3600+iv))); } return out; };
      const labP = P[centreIndex()] || P.reduce((a,p)=>p.b.lab>a.b.lab?p:a, P[0]);
      /* D'où part la colonie : un vaisseau déjà à quai est un fait et passe
         devant tout ; sinon c'est le centre, parce que c'est lui qui porte le
         chantier de l'empire. `S.colo.fromId` garde ses autres usages — le
         classement des positions part toujours de là — mais il ne décide plus
         où le vaisseau se construit : le centre est désormais le seul levier,
         au lieu de deux qui pouvaient se contredire. */
      const dep = P[colShipAt()>=0 ? colShipAt() : centreIndex()] || P[planetIndexById(S.colo.fromId)] || P[0];
      const wantColony = S.day.focus!=='eco' && P.length < maxPlanets() && !sim.colSent;
      const nr = nextResearch();
      if(nr.labNeed && labP.b.lab<nr.labNeed && labP.bq<=Tm && sim.rq<=Tm){
        const c = levelCost(B.lab, labP.b.lab+1);
        if(can(labP,c,reserveOf(labP,Tm))){ pay(labP,c); const d=buildTime('lab',labP.b.lab+1,labP), L=labP.b.lab+1, pp=labP, fin=Tm+d*1000; pp.bq=fin; pp.bqKey='lab'; sim.ev.push({at:fin, fn:()=>{ pp.b.lab=Math.max(pp.b.lab,L); }}); acts.push({q:'Bâtiment · '+planetRef(pp), what:`${B.lab.n} ${L}`, why:POURQUOI_LABO + centreNote(), cost:c, dur:d, end:fin, kind:'b', k:'lab', lvl:L, p:pp.i}); }
      }
      const labBusy = labP.bq>Tm && labP.bqKey==='lab';
      /* « Devant, seule » : rien ne s'empile sur une planète où une priorité du
         joueur épargne. L'objectif d'une priorité de recherche porte la clé
         `t:`, comme n'importe quelle recherche, donc `epargnePrio` ne le
         reconnaît pas à sa clé — et un labo occupé peut retarder sa pose d'une
         session ou deux, le temps qu'un objectif spontané s'installe et n'en
         reparte plus, puisque rien ne le lâche avant qu'il soit payé. La
         question se pose donc à la priorité elle-même. `tryResearch`, lui,
         continue de n'interroger que `epargnePrio` : c'est lui qui pose
         l'objectif de cette priorité, il ne peut pas se l'interdire. */
      const prioDevant = p => epargnePrio(p) || (p === labP && !!(nr.list[0] || {}).prio);
      const launchR = (R, why, payeur)=>{ const pp = payeur || labP, c=levelCost(T[R.k],R.lvl); pay(pp,c); const d=researchTime(R.k,R.lvl), k=R.k, L=R.lvl, fin=Tm+d*1000; sim.rq=fin; sim.ev.push({at:fin, fn:()=>{ sim.tech[k]=Math.max(sim.tech[k],L); }}); acts.push({q:'Recherche · '+planetRef(pp), what:`${T[k].n} ${L}`, why: [why, R.why].filter(Boolean).join(' '), cost:c, dur:d, end:fin, kind:'t', k, lvl:L, p:pp.i}); };
      const tryResearch = phase=>{
        if(sim.rq>Tm || !nr.k || labBusy) return;
        const R = nr.list[0], key='t:'+R.k+R.lvl, c = levelCost(T[R.k],R.lvl), mine = goals.find(g=>g.key===key);
        if(phase==='pre' && !R.crit && !mine) return;
        const sr = phase==='post' ? softRes(labP) : [0,0,0], rr = reserveOf(labP,Tm,mine).map((x,j)=>x+sr[j]);
        if(can(labP,c,rr)){ launchR(R, mine ? `Économisée depuis ${formatTime(mine.since)}` : ''); dropGoal(key); delete sim.rSince[key]; return; }
        /* RECH_FUND_ELSEWHERE : le centre ne peut pas, une autre planète le
           peut, avec un labo qui remplit le prérequis et qui n'est pas en
           chantier. Elle paie ; la durée reste celle du centre, à défaut de
           mieux, et la carte le dit. */
        if(phase==='post' && regleActive('RECH_FUND_ELSEWHERE')){
          const q = P.find(x => x !== labP && !(x.bq>Tm && x.bqKey==='lab') && labOkPour(R.k, x) && can(x, c, reserveOf(x,Tm)));
          if(q){ launchR(R, `Depuis ${q.name} : le centre ne peut pas la payer maintenant, ${q.name} le peut. Durée estimée sur le labo du centre, celui de ${q.name} peut la changer.`, q); dropGoal(key); delete sim.rSince[key]; return; }
        }
        if(!sim.rSince[key]) sim.rSince[key] = Tm;
        const starving = Tm - sim.rSince[key] >= Math.max(4, 4*iv)*3600e3;
        /* `mine` d'abord : un objectif déjà posé se retrouve, même sous une
           priorité — et c'est lui que pose une priorité de recherche, qu'une
           règle lue trop largement tuerait. */
        const g = (mine || ((R.crit || starving) && !epargnePrio(labP))) ? setGoal(key, `${T[R.k].n} ${R.lvl}`, c, labP, Tm) : null;
        if(phase==='pre') return;
        const held = heldByOf(labP, Tm, g);
        // `R.why` porte le « tu l'as mise en priorité » quand c'est le joueur
        // qui a posé cette recherche : sans lui, la seule ligne de sa journée
        // ne dit que l'heure à laquelle les ressources seront réunies.
        waits.push({q:'Recherche · '+planetRef(labP), what:`${T[R.k].n} ${R.lvl}`, why:R.why, eta:wait(labP,c), cost:c, held:!!held, heldBy:held, miss:missOf(labP,c), kind:'t', k:R.k, p:labP.i});
        for(const F of nr.list.slice(1)){
          const fd = researchTime(F.k,F.lvl);
          if(g && Tm+fd*1000 > g.deadline) continue;
          if(can(labP, levelCost(T[F.k],F.lvl), reserveOf(labP,Tm).map((x,j)=>x+sr[j]))){ launchR(F, `En attendant ${T[R.k].n} ${R.lvl}`); break; }
        }
      };
      /* Les priorités du joueur, avant tout le reste de la session. Avant,
         parce que `reserveOf` fait ensuite le travail tout seul : la recherche
         et le chantier ne partiront que s'il reste de quoi les payer au-delà
         de ce que la priorité met de côté.
         Dans l'ordre de pose, et pas dans celui de `P` : cet ordre décide qui,
         de deux planètes qui épargnent, reçoit les rapatriements de l'empire.
         Il était sans conséquence tant que les deux seuls objectifs vivaient au
         même endroit ; il devient l'arbitre, et c'est `prioRang` qui le porte.
         `prios()` lit ici l'empire simulé — S.planets est P : une priorité que
         la journée a déjà atteinte cesse d'elle-même d'épargner, au lieu de
         geler la planète jusqu'au bout de l'horizon. */
      /* `prioPas` : le pas que la boucle a retenu, par planète, pour que la
         boucle des bâtiments en fasse un candidat forcé sans le recalculer —
         elle n'a pas de quoi le faire pour une recherche, dont le coût ne se
         lit pas dans `B`. Rien ne bouge entre les deux : `prioStep` ne lit que
         les niveaux de la planète, et aucun chantier n'aboutit d'ici là. */
      /* `prioEtat` : ce que le plan fait de chaque priorité à cette session, et
         rien d'autre. Le bloc du panneau le lit au lieu de déduire l'état du
         rang dans la liste : dire « elle passe en premier » d'une priorité que
         rien ne sert est pire que le silence, c'est le contraire du vrai.
         L'identité d'une ligne est le trio genre/planète/cible, celui que
         `prios()` rend au rendu. */
      const prioVus = new Map(), prioClefs = new Set(), prioPas = new Map(), prioEtat = [];
      prioRang = new Map();
      for(const [rang, pr] of prios().entries()){
        const id = `${pr.kind}:${pr.pid}:${pr.k}`;
        const cible = `${pr.kind === 'b' ? B_SHORT[pr.k] : T[pr.k].n} ${pr.lvl}`;
        // La première posée sur la planète agit, les suivantes attendent leur
        // tour : deux réserves sur une planète ne s'ajouteraient que pour la
        // geler deux fois plus longtemps. La règle ignore les `kind`.
        if(prioVus.has(pr.pid)){ prioEtat.push({id, etat:`Elle attend son tour, derrière ${prioVus.get(pr.pid)}.`}); continue; }
        prioVus.set(pr.pid, cible);
        const pp = P.find(x=>x.id===pr.pid); if(!pp) continue;
        /* Une priorité de recherche part par la feuille de route, et ne vient ici
           que pour le hangar : son coût peut dépasser ce que le centre loge, et
           alors `setGoal` rendrait null — l'épargne ne commencerait jamais et
           rien ne le dirait. Le pas qu'elle paie est celui que `nextResearch` a
           résolu, prérequis compris, et pas le niveau que le joueur a visé :
           épargner pour Plasma 12 quand il reste Laser 1 à faire demanderait un
           hangar des mois trop tôt. */
        const R = pr.kind === 't' ? nr.list[0] : null;
        if(pr.kind === 't' && !(R && R.prio)){
          /* La recherche n'est entrée dans aucune liste : son labo manque, et
             `nextResearch` est le seul à l'avoir su. Sans cette ligne, la seule
             carte du jour est le laboratoire, que rien ne relie à la priorité —
             pendant que le bloc, lui, affirmait qu'elle passait en premier. */
          const dit = nr.prioLab
            ? `${B.lab.n} ${nr.prioLab} manque : ta priorité attend que ce soit là.`
            : `Le plan ne trouve aucun palier à lancer pour elle.`;
          waits.push({q:'Recherche · '+planetRef(pp), what:cible, why:`Tu as mis ${cible} en priorité. ${dit}`, eta:Infinity, miss:[0,0,0], kind:'t', k:pr.k, p:pp.i});
          prioEtat.push({id, etat:dit});
          continue;
        }
        // Les prérequis d'une recherche ne sont pas une impasse : `resolveTech`
        // les remonte et le pas lançable est l'un d'eux.
        /* Un prérequis bâtiment non plus : la priorité vise alors ce prérequis.
           Elle épargne pour lui, sort ses cartes et reçoit les rapatriements de
           l'empire comme n'importe quel objectif — au lieu d'attendre, muette,
           un niveau que personne ne construisait. La cible du joueur ne bouge
           pas : c'est le pas du moment qui change, et la phrase le dit. */
        const avant = pr.kind === 'b' ? prioAvant(pp, pr.k) : null;
        const but = avant ? {kind:'b', pid:pr.pid, k:avant.k, lvl:avant.lvl,
          vise:`Tu as mis ${cible} en priorité : ${B[pr.k].n} demande ${reqOk(B[pr.k].req, pp).join(' et ')}. On commence par ${B_SHORT[avant.k]} ${avant.lvl}.`} : pr;
        // Ce qui reste bloquant après ce détour est une recherche ou un labo :
        // rien que cette planète puisse construire, donc elle attend vraiment.
        const bloque = but.kind === 'b' ? prioBloque(pp, but.k) : '';
        if(bloque){
          waits.push({q:'Bâtiment · '+planetRef(pp), what:`${B[but.k].n} ${(pp.b[but.k]||0)+1}`, why:avant ? `${but.vise} ${bloque}` : bloque, eta:Infinity, miss:[0,0,0], kind:'b', k:but.k, p:pp.i});
          prioEtat.push({id, etat:avant ? `${but.vise} ${bloque}` : bloque});
          continue;
        }
        const pas = prioStep(pp, but, R ? levelCost(T[R.k], R.lvl) : null);
        if(!pas){
          /* Une recherche qui tient dans les hangars n'a rien à construire ici :
             c'est `tryResearch` qui posera son objectif, sous la clé de la
             recherche. Son rang de pose la suit quand même — le joueur l'a mise
             devant une autre planète, pas devant une autre file. */
          const sien = `t:${R.k}${R.lvl}`;
          prioRang.set(sien, rang);
          prioEtat.push({id, key:sien, pi:pp.i, tk:R.k});
          continue;
        }
        /* Une seule file de recherche pour tout l'empire, et le jeu refuse de
           monter un laboratoire — n'importe lequel, pas seulement celui d'où
           l'on cherche — tant qu'elle tourne : la tuile affiche « Une
           recherche est en cours ! ». Le plan ne connaissait cette règle que
           du labo qu'il choisit lui-même (`researchRunning`, plus bas dans
           `pickBuildings`). Depuis qu'une priorité se pose sur toutes les
           planètes d'un coup, il envoyait le joueur se heurter au jeu, planète
           après planète. C'est le pas qu'on retient, pas la priorité : quand
           `prioStep` a fait un détour par un hangar, le hangar part. */
        if(pas.k === 'lab' && sim.rq > Tm){
          const dit = `Le jeu ne monte aucun laboratoire tant qu'une recherche tourne : celle-ci finit à ${formatTime(sim.rq)}.`;
          waits.push({q:'Bâtiment · '+planetRef(pp), what:`${B.lab.n} ${pas.lvl}`, why:`${pas.why} ${dit}`,
            eta:(sim.rq-Tm)/1000, miss:[0,0,0], kind:'b', k:'lab', p:pp.i});
          prioEtat.push({id, etat:dit});
          continue;
        }
        prioPas.set(pp.id, pas);
        const c = levelCost(B[pas.k], pas.lvl);
        /* La clé porte le pas, comme celle d'une recherche porte son niveau :
           quand la cible du moment avance, l'objectif d'hier est remplacé au
           lieu de tenir une réserve calculée pour un prix qui n'est plus. */
        const key = `prio:${pr.pid}:${pas.k}${pas.lvl}`;
        prioRang.set(key, rang);
        const g = setGoal(key, `${B_SHORT[pas.k]} ${pas.lvl}`, c, pp, Tm);
        if(g){
          prioClefs.add(key);
          prioEtat.push({id, key, pi:pp.i, bk:pas.k});
          /* Une échéance dit « quand on pense pouvoir payer », et `setGoal` ne
             la calcule qu'à la première pose. Une priorité vit des jours : la
             nuit passe, l'échéance expire, `h` retombe à zéro et `reserveOf`
             retient d'un coup le coût entier, pour tout le reste de l'horizon.
             La planète gèle alors pour une cible qui n'a pas bougé. L'échéance
             se recalcule donc à chaque session, comme au premier passage.
             `since`, lui, ne bouge pas : c'est depuis là qu'on économise.
             Les autres genres d'objectifs vivent une session ou deux et sont
             lâchés au lancement : ils gardent leur échéance d'origine. */
          const w = wait(pp, c);
          if(isFinite(w)) g.deadline = Tm + w*1000 + iv*3600e3;
        }
        else {
          waits.push({q:'Bâtiment · '+planetRef(pp), what:`${B[pas.k].n} ${pas.lvl}`, why:prioRien(pp, c), eta:Infinity, miss:missOf(pp,c), kind:'b', k:pas.k, p:pp.i});
          prioEtat.push({id, etat:prioRien(pp, c)});
        }
      }
      // Ce que le joueur a retiré, ou que la journée a atteint, ne doit plus
      // rien retenir : sans ce ménage la réserve survivrait à sa cible.
      for(const g of goals.slice()) if(g.key.startsWith('prio:') && !prioClefs.has(g.key)) dropGoal(g.key);
      tryResearch('pre');
      if(wantColony && !sim.colShip && sim.tech.impulse>=3 && dep.b.shipyard>=4 && dep.sq<=Tm && !(dep.bq>Tm && dep.bqKey==='shipyard')){
        const c = COL_SHIP_COST, key='ship:col', mine = goals.find(g=>g.key===key);
        if(can(dep,c,reserveOf(dep,Tm,mine))){ pay(dep,c); dropGoal(key); const d=(c[0]+c[1])/(2500*(1+dep.b.shipyard)*Math.pow(2,dep.b.nanite)*ecoSpeed())*3600, fin=Tm+d*1000; dep.sq=fin; sim.colShip=true; sim.colReady=fin; acts.push({q:'Chantier spatial · '+planetRef(dep), what:'1 Vaisseau de colonisation', why:'Sans lui, pas de planète de plus : il porte la colonie choisie dans Outils › Colonie.', cost:c, dur:d, end:fin, kind:'ship', p:dep.i}); }
        else {
          /* La carte que la priorité écarte le plus souvent : sans `heldBy`,
             le vaisseau n'était jamais construit et sa ligne ne disait pas un
             mot de l'épargne qui le repoussait — un chantier gelé toute la
             journée en silence. */
          const g = prioDevant(dep) ? null : setGoal(key, 'le vaisseau de colonisation', c, dep, Tm);
          const held = heldByOf(dep, Tm, g || mine);
          waits.push({q:'Chantier spatial', what:'Vaisseau de colonisation', eta:wait(dep,c), cost:c, held:!!held, heldBy:held, miss:missOf(dep,c), kind:'ship', p:dep.i});
        }
      }
      if(wantColony && sim.colShip && sim.colReady<=Tm && !refused(cardKey('fleet', (real.planets[dep.i]||{}).id, target))){ sim.colSent=true; acts.push({q:'Flotte · '+planetRef(dep), what:`Envoyer le vaisseau de colonisation vers ${target}`, why:`Kit ${KITS[S.colo.kit]?KITS[S.colo.kit].n.toLowerCase():''} : détail dans Outils › Colonie`, dur:colFlight, end:Tm+colFlight*1000, kind:'fleet', p:dep.i, dest:target, mission:7, ships:{col:1}}); }
      const hubP = P[centreIndex()] || P[Math.min(hubIndex(), P.length-1)];
      /* Ce qu'il manque à chaque planète pour son prochain chantier, relevé une
         fois avant le premier envoi : c'est ce manque qui fait d'elle une
         destination. */
      const manqueDe = new Map(P.map(d=>{ const c = pickBuildings(d, {T:Tm, iv, goals:[]})[0]; return [d, c ? levelCost(B[c.k],c.lvl).map((x,j)=>Math.max(0, x-d.st[j])) : [0,0,0]]; }));
      /* Une planète bridée faute d'énergie et sans de quoi payer sa centrale
         perd de la production à chaque heure, et rien ne l'en sortait : les
         objectifs ne naissent que de la recherche et du vaisseau de
         colonisation, tous deux sur la principale, donc tout transport
         remontait vers elle. Une colonie qui vient de perdre ses centrales
         n'attirait rien et le joueur devait y penser seul. Elle passe devant
         un objectif d'épargne : une recherche repoussée ne coûte que du temps,
         une mine au ralenti coûte de la production à chaque heure. Pas de
         manque, pas de livraison — une planète bridée qui a le cristal
         reconstruit toute seule. */
      const bridees = P.filter(d=>production(d).factor<1 && mse(...manqueDe.get(d))>0)
        .sort((a,b)=>mse(...manqueDe.get(b))-mse(...manqueDe.get(a)));
      /* Un transport va sinon vers la planète qui attend : celle qui porte un
         objectif, le hub seulement à défaut. Viser le hub en dur laissait la
         planète du meilleur labo épargner pour une recherche sans jamais rien
         recevoir dès qu'elle n'était pas aussi celle du meilleur chantier :
         `hubIndex` classe sur labo + chantier, la recherche se paie sur le
         labo seul. */
      /* Et entre deux priorités, c'est l'ordre de pose qui tranche. Sans cela
         deux planètes qui épargnent chacune pour la sienne devenaient la
         destination l'une de l'autre : des vols croisés dans la même session,
         deux emplacements de flotte, du deutérium brûlé, et l'épargne des deux
         vidée. Le rang de pose est un ordre strict, donc une seule direction
         survit : la première posée reçoit, les suivantes ne nourrissent que
         celles d'avant elles et n'avancent, pour le reste, que sur leur
         production locale. Ce qui part est leur surplus — `keep` leur garde
         leur propre réserve. Le secours d'une planète bridée, lui, garde sa
         précédence : elle perd de la production à chaque heure. */
      const rangDe = p => Math.min(Infinity, ...goals.filter(g=>g.p===p).map(g=>g.rang));
      const croise = (q, d) => isFinite(rangDe(q)) && rangDe(d) > rangDe(q);
      const destOf = q => {
        const secours = bridees.find(d=>d!==q);
        if(secours) return secours;
        const g = goals.filter(x=>x.p!==q && !croise(q, x.p)).sort((a,b)=>a.rang-b.rang)[0];
        return g ? g.p : (croise(q, hubP) ? null : hubP);
      };
      /* Un rapatriement occupe un emplacement de flotte, exactement comme une
         expédition : les deux puisent dans le même compte. Le laisser hors du
         compte faisait proposer un envoi que le jeu refuse d'un « Nombre
         maximal de flottes atteint », alors que le copilote connaît les
         flottes déjà en vol. Les retours connus rendent la place le moment
         venu ; emplacements inconnus, on en suppose assez, comme avant. */
      const fsl = fleetSlots();
      let libres = fsl ? Math.max(0, fsl[1]-fsl[0]) + fleetReturns.filter(e=>e<=Tm).length : 3;
      const maxExpo = expoCap(sim.tech.astro);
      /* Une expédition rapporte plus qu'un rapatriement, qui ne fait que
         déplacer ce qu'on a déjà : tant qu'une expédition est possible, le
         dernier emplacement lui revient. */
      const garde = expoBusy.filter(e=>e>Tm).length < maxExpo && P.some(p=>expoFleet(p.ships)) ? 1 : 0;
      if(P.length>1) for(const q of P){
        const dst = destOf(q);
        if(libres-garde<=0) break;
        if(!dst || q===dst || (q.transferAt||0)>Tm) continue;
        const pr = production(q), want = [0,0,0];
        /* Les objectifs servis sont nommés : sans eux la carte annonçait un
           tonnage sans dire à quoi il allait. */
        const pour = [];
        for(const g of goals) if(g.p===dst){
          let utile = false;
          g.cost.forEach((x,j)=>{ const d = x-dst.st[j]; if(d>0) utile = true; want[j]=Math.max(want[j], d); });
          if(utile) pour.push(g.label);
        }
        /* Le manque d'une planète bridée est un besoin comme un objectif : sans
           lui ici, la destination changeait et rien ne partait. */
        const secours = bridees.includes(dst);
        if(secours) manqueDe.get(dst).forEach((x,j)=>want[j]=Math.max(want[j], x));
        pr.cap.forEach((cap,j)=>{ if(q.st[j] > cap*.7) want[j] = Math.max(want[j], q.st[j]-cap*.3); });
        /* Ce que la planète garde : son prochain chantier, et ce qu'elle met
           elle-même de côté. `pickBuildings` est appelé ici sans les objectifs,
           donc il ignore l'épargne — un rapatriement vidait la réserve de la
           priorité qu'il était censé servir. */
        const mise = reserveOf(q, Tm);
        const keep = (()=>{ const c = pickBuildings(q, {T:Tm, iv, goals:[]})[0]; return c ? levelCost(B[c.k],c.lvl) : [0,0,0]; })()
          .map((x,j)=>x+mise[j]);
        const amt = want.map((w,j)=>Math.max(0, Math.min(w, q.st[j]-keep[j])));
        const sum = amt[0]+amt[1]+amt[2]; if(sum < 5000) continue;
        const own = (q.ships.lc||0)+(q.ships.sc||0) > 0, src = own ? q : hubP, lcC = shipStats('lc').cargoEff, scC = shipStats('sc').cargoEff;
        if(refused(cardKey('transfer', (real.planets[src.i]||{}).id, (own?dst:q).coords))) continue;
        let left = sum; const lc = Math.min(src.ships.lc||0, Math.ceil(left/lcC)); left -= lc*lcC; const sc = left>0 ? Math.min(src.ships.sc||0, Math.ceil(left/scC)) : 0;
        if(!lc && !sc) continue;
        const ships = {}; if(lc) ships.lc=lc; if(sc) ships.sc=sc;
        const fl = flight(q.coords, dst.coords, ships, 100); if(!fl) continue;
        // L'aller à vide part du chantier, pas de la destination : les deux
        // trajets cessent d'être symétriques dès que la cible n'est pas le hub.
        const flOut = own ? null : flight(src.coords, q.coords, ships, 100);
        if(!own && !flOut) continue;
        const cap = lc*lcC + sc*scC, k = Math.min(1, cap/sum), sent = amt.map(x=>Math.floor(x*k));
        // Un Transporter revient toujours à son point de départ, donc un trajet
        // de plus que l'aller chargé — et après un Stationner ce point de départ
        // est la colonie : les vaisseaux y restent, la principale ne les revoit pas.
        const aller = Tm + (own ? 0 : flOut.secs*1000);
        const arrive = aller + fl.secs*1000, back = arrive + fl.secs*1000;
        sent.forEach((x,j)=>q.st[j]-=x); q.st[2] = Math.max(0, q.st[2]-fl.fuel); q.transferAt = back;
        for(const [kk,n] of Object.entries(ships)) src.ships[kk]-=n;
        sim.ev.push({at:arrive, fn:()=>{ sent.forEach((x,j)=>dst.st[j]+=x); }});
        sim.ev.push({at:back, fn:()=>{ for(const [kk,n] of Object.entries(ships)) q.ships[kk]=(q.ships[kk]||0)+n; }});
        // Une mission part toujours de la planète où est la flotte. Sans
        // transporteur sur la colonie, il faut d'abord l'y amener À VIDE — en
        // Stationner, pas en Transporter : Transporter repartirait tout seul
        // et les vaisseaux ne seraient plus là pour charger. C'est ce premier
        // trajet qu'on annonce, et le minuteur prévient quand ils se posent.
        const charge = `${fmt(sent[0])} M, ${fmt(sent[1])} C, ${fmt(sent[2])} D`;
        /* Une livraison n'est pas plafonnée, la production si : une cargaison
           qui fait déborder la destination y arrête la mine. La carte le dit
           avant l'envoi, et nomme une planète qui a la place quand il y en a. */
        const capD = production(dst).cap, trop = [0,1,2].filter(j=>sent[j]>0 && dst.st[j]+sent[j] > capD[j]);
        const alt = trop.length ? P.find(x=>x!==dst && x!==q && x.coords && [0,1,2].every(j=>!(sent[j]>0) || x.st[j]+sent[j] <= production(x).cap[j]*.95)) : null;
        const avert = trop.length ? ' ' + debordeTexte(planetRef(dst), trop) + (alt ? ` Autre cible avec la place : ${planetRef(alt)}.` : '') : '';
        /* Trois raisons possibles d'un rapatriement, dans l'ordre où elles
           priment : le secours d'une planète à l'arrêt, un objectif qui épargne
           à destination, et sinon des hangars qui se remplissent ici. L'une des
           trois est vraie, sans quoi `want` serait vide et rien ne partirait. */
        const motif = (secours ? `${planetRef(dst)} tourne au ralenti faute d'énergie et n'a pas de quoi payer sa centrale.`
          : pour.length ? `${planetRef(dst)} épargne pour ${pour.join(' et ')} et n'y arrive pas seule.`
          : `Les hangars de ${planetRef(q)} se remplissent : ces ressources travaillent mieux sur ${planetRef(dst)}.`) + ' ';
        acts.push(own
          ? {q:'Flotte · '+planetRef(q), what:`Rapatrier vers ${planetRef(dst)} : ${charge}`,
             why:`${motif}${shipList(ships)} déjà sur place · mission Transporter · arrivée vers ${formatTime(arrive)}${avert}`,
             dur:(arrive-Tm)/1000, end:arrive, kind:'transfer', ships, p:src.i, dest:dst.coords, res:sent, mission:3}
          : {q:'Flotte · '+planetRef(src), what:`Envoie ${shipList(ships)} vers ${planetRef(q)}`,
             why:`${motif}À vide : il n'y a aucun transporteur sur ${planetRef(q)}. Mission Stationner, arrivée vers ${formatTime(aller)}. Tu lances ensuite depuis ${planetRef(q)} un Transporter chargé de ${charge} vers ${planetRef(dst)}, arrivée vers ${formatTime(arrive)} — il repart à vide, ces vaisseaux restent basés sur ${planetRef(q)}.${avert}`,
             dur:(aller-Tm)/1000, end:aller, kind:'transfer', ships, p:src.i, dest:q.coords, mission:4});
        libres--;
      }
      for(let lance=0; lance<Math.min(3, libres) && expoBusy.filter(e=>e>Tm).length < maxExpo; lance++){
        /* Le même classement que le bloc Expéditions, sur les planètes
           simulées : `expoCandidats` lit S.planets, qui n'est pas encore à
           jour ici. `expoDeja` fait que deux lancements du même passage ne
           visent pas deux fois le même système. */
        /* Plus de filtre sur un refus : la carte d'expédition ne se dessine
           plus dans le panneau, donc plus personne ne peut poser ce « Non ».
           Un vieux refus en stockage écartait une planète ici pendant que le
           bloc la proposait à côté, sans que rien ne le dise. */
        const cands = P.map(p=>({p, f:expoFleet(p.ships, p), tgt:expoTgt(p)}))
          .filter(x=>x.f && x.tgt)
          .map(x=>Object.assign(x, expoScore(x.f, x.p.coords, Tm, expoDeja)))
          .sort((a,b)=>b.score-a.score || b.f.cargo-a.f.cargo);
        if(!cands.length) break;
        const {p, f, tgt} = cands[0];
        const fl = flight(p.coords, tgt, f.ships, 100); if(!fl) break;
        expoDeja[expoSys(p)] = (expoDeja[expoSys(p)]||0) + 1;
        const total = 2*fl.secs + expoDuree(fl.secs, Tm)*3600, fuel = fl.fuel*2, c=[0,0,fuel];
        const dRate = Math.max(1, production(p).d), smallFuel = p.st[2] >= fuel && fuel/dRate*3600 <= 15*60;
        if(!smallFuel && !can(p,c,reserveOf(p,Tm))){ waits.push({q:'Flotte · '+planetRef(p), what:'Expédition', eta:wait(p,c), cost:c, miss:missOf(p,c), kind:'expo', p:p.i}); break; }
        pay(p,c);
        for(const [k,n] of Object.entries(f.ships)){ p.ships[k]-=n; sim.away[k]=(sim.away[k]||0)+n; }
        const ret = Tm + total*1000, out = Object.assign({}, f.ships);
        expoBusy.push(ret);
        sim.ev.push({at:ret, fn:()=>{ for(const [k,n] of Object.entries(out)){ p.ships[k]=(p.ships[k]||0)+n; sim.away[k]-=n; } }});
        acts.push({q:'Flotte · '+planetRef(p), what:'Expédition : '+shipList(f.ships), why:`Ramène des ressources, parfois des vaisseaux, pour ${fmt(fuel)} deut de carburant · vers ${tgt}, retour vers ${formatTime(ret)} · soute ${fmt(f.cargo)} pour ${fmt(f.cap)} max`, cost:c, dur:total, end:ret, kind:'expo', ships:out, p:p.i, dest:tgt, mission:15});
      }
      for(const p of P){
        if(p.b.shipyard<1 || p.sq>Tm) continue;
        /* Un lot sorti du chantier sans être relu : on ne sait plus combien de
           satellites tournent, donc on n'en propose pas d'autres. */
        if(p.flou) continue;
        /* Le prix n'est pas le seul critère : un satellite ne se répare pas, il
           part en débris au premier raid et l'énergie retombe le jour où on en a
           le plus besoin. Ce risque-là ne se calcule pas — il se choisit, dans
           les Réglages. planetAlerts dit pourquoi quand le choix est non. */
        if(!satsOk(p)) continue;
        if(refused(cardKey('sats', p.id, ''))) continue;
        if(wantColony && p===dep && !sim.colShip && sim.tech.impulse>=3 && p.b.shipyard>=4) continue;
        const pr = production(p), best = rankUpgrades(p).find(u=>u.payback<Infinity);
        const satE = satEnergy(p.tmax) * (1 + (S.settings.cls==='collector'?.1:0) + (S.settings.eng?.1:0));
        let need = pr.factor<1 ? pr.eCons-pr.eProd : 0;
        if(best && best.extraSolar){ const after = production(p,{[best.key]:best.lvl}); need = Math.max(need, after.eCons-after.eProd); }
        if(need<=0) continue;
        const n = Math.ceil(need/satE) + 1, c = SAT_COST.map(x=>x*n);
        const solarAlt = rangeCost(B.solar, p.b.solar, p.b.solar + Math.max(1, best ? best.extraSolar : 1));
        if(mse(...c) >= mse(...solarAlt)) continue;
        if(can(p,c,reserveOf(p,Tm))){
          pay(p,c); const d = n*2000/(2500*(1+p.b.shipyard)*Math.pow(2,p.b.nanite)*ecoSpeed())*3600, pp=p, fin=Tm+d*1000;
          pp.sq=fin; pp.satPending=fin; sim.ev.push({at:fin, fn:()=>{ pp.sats+=n; pp.satPending=0; }});
          acts.push({q:'Chantier spatial · '+planetRef(p), what:`${n} Satellites solaires`, why:`+${Math.round(n*satE)} énergie, ${Math.round(mse(...solarAlt)/Math.max(1,mse(...c)))}x moins cher que la centrale${p.def ? '' : ' · aucune défense vue ici : un raid les emporte tous'}`, cost:c, dur:d, end:fin, kind:'sats', n, p:p.i});
        } else { const e=wait(p,c); soft.push({p, cost:c, eta:e}); waits.push({q:'Chantier spatial · '+planetRef(p), what:`${n} Satellites solaires`, eta:e, cost:c, miss:missOf(p,c), kind:'sats', p:p.i}); }
      }
      // Les deux files de forme de vie sont indépendantes de la file des
      // bâtiments : elles tournent en parallèle, mais puisent au même stock.
      // Passées avant, elles servent les premières et ignorent ce qu'un
      // bâtiment épargne ; passées après, elles s'effacent devant lui.
      const lfPass = devant=>{
        /* ponytail: le coût en énergie d'une case non encore construite n'est pas
           lu sur la page du jeu ; on se contente du bilan actuel. À remplacer par
           la consommation lue dans l'infobulle quand le lecteur la relèvera. */
        if(lfMode()==='off') return;
        for(const p of P) for(const q of ['lfbuilding','lfresearch']){
          if(p.lfq[q]>Tm) continue;
          /* FDV_DATA_MISSING : une planète sans race ne reçoit rien, une case
             sans nom ni niveau lisible non plus — pas de conseil à l'aveugle. */
          const susp = lfSusp.get(p.id); if(susp && susp.tout) continue;
          const liste = lfCandidates(p, q).filter(c=>!refused(cardKey('lf', p.id, c.id)) && !(susp && susp.ids.has(c.id))); if(!liste.length) continue;
          /* Au plafond, cette file sert à vider le stock : la case la plus
             chère qu'on peut payer tout de suite y fait plus que la moins
             chère, qui laisse le plafond en place. Hors plafond, le tri de
             lfCandidates garde la main. */
          const prLf = production(p), plein = [0,1,2].find(j => [prLf.m,prLf.c,prLf.d][j] > 0 && p.st[j] >= prLf.cap[j]*.98);
          const ch = plein == null ? liste[0]
            : (liste.filter(c => c.cost[plein] > 0 && can(p, c.cost, null)).sort((a,b)=>b.cost[plein]-a.cost[plein])[0] || liste[0]);
          // softRes ne retient que les chantiers de moins de trois heures : c'est
          // le bon arbitrage pour la flotte, qui part et revient. Pour les
          // formes de vie, « après les bâtiments » doit valoir aussi pour une
          // centrale à six heures, sinon le réglage ne protège presque rien.
          const res = devant ? reserveOf(p,Tm)
            : reserveOf(p,Tm).map((x,j)=>x+softAll(p)[j]);
          if(can(p, ch.cost, res)){
            pay(p, ch.cost); p.lfq[q] = Tm + ch.secs*1000;
            const id = ch.id, lvl = ch.next;
            sim.ev.push({at:Tm + ch.secs*1000, fn:()=>{ if(p.lf[id]) p.lf[id] = Object.assign({}, p.lf[id], {lvl, cost:null}); }});
            acts.push({q:'Forme de vie · '+planetRef(p), what:`${ch.nom} ${ch.next}`, why:ch.why, src:ch.src, at:ch.at, cost:ch.cost, dur:ch.secs, end:Tm+ch.secs*1000, kind:'lf', id:ch.id, lvl:ch.next, p:p.i});
          } else {
            const eta = wait(p, ch.cost);
            waits.push({q:'Forme de vie · '+planetRef(p), what:`${ch.nom} ${ch.next}${ch.src==='estimé' ? ' (prix et durée estimés)' : ''}`, src:ch.src, eta, cost:ch.cost, held:res.some(x=>x>0), heldBy:heldByOf(p,Tm), miss:missOf(p, ch.cost), kind:'lf', id:ch.id, p:p.i});
            soft.push({p, cost:ch.cost, eta});
          }
        }
      };
      /* Une case de forme de vie consomme de l'énergie comme une mine. Tant que
         la planète est en négatif, la passer devant revient à payer un bâtiment
         dont la production est déjà bridée : la centrale d'abord. */
      if(lfMode()==='first') lfPass(true);
      for(const p of P){
        if(p.bq>Tm) continue;
        const gPrio = goals.find(g=>g.p===p && g.key.startsWith('prio:'));
        const cands = pickBuildings(p, {T:Tm, iv, wantColony, dep, labNeed:nr.labNeed, labP, researchRunning:sim.rq>Tm, goals, hub:hubP, prio:gPrio ? prioPas.get(p.id) : null});
        if(!cands.length) continue;
        const res = reserveOf(p,Tm);
        /* La réserve se calcule par candidat, et pas une fois pour la liste :
           une réserve unique opposerait l'épargne de la priorité à la priorité
           elle-même, et aux deux chantiers de secours qui protègent la
           production qui la paie — la planète ne construirait plus rien du
           tout, et pour aussi longtemps que l'épargne dure. C'est à quoi sert
           `libre`. Ce que la réserve retient, ce sont les mines du classement. */
        const ch = cands.find(x=>can(p, levelCost(B[x.k],x.lvl), x.libre ? reserveOf(p,Tm,gPrio) : res));
        if(ch){ const c=levelCost(B[ch.k],ch.lvl); pay(p,c); const d=buildTime(ch.k,ch.lvl,p), k=ch.k, L=ch.lvl, fin=Tm+d*1000; p.bq=fin; p.bqKey=k; sim.ev.push({at:fin, fn:()=>{ p.b[k]=Math.max(p.b[k],L); }}); acts.push({q:'Bâtiment · '+planetRef(p), what:`${B[k].n} ${L}`, why:ch.why, cost:c, dur:d, end:fin, kind:'b', k, lvl:L, p:p.i}); }
        else { const w=cands.map(x=>({x, eta:wait(p,levelCost(B[x.k],x.lvl))})).sort((a,b)=>a.eta-b.eta)[0];
          // `held` dira un jour « retenu : tu épargnes pour Labo 10 », et un
          // candidat que la réserve ne regarde pas ne doit pas le dire à tort.
          waits.push({q:'Bâtiment · '+planetRef(p), what:`${B[w.x.k].n} ${w.x.lvl}`, eta:w.eta, cost:levelCost(B[w.x.k],w.x.lvl), held:(w.x.libre ? reserveOf(p,Tm,gPrio) : res).some(x=>x>0), heldBy:heldByOf(p,Tm,w.x.libre ? gPrio : null), miss:missOf(p,levelCost(B[w.x.k],w.x.lvl)), kind:'b', k:w.x.k, p:p.i}); soft.push({p, cost:levelCost(B[w.x.k],w.x.lvl), eta:w.eta}); }
        /* Une priorité qui n'a pas été servie cette session le dit elle-même.
           Elle n'est que le troisième candidat : un secours payable à chaque
           session la mangeait l'une après l'autre sans qu'une seule ligne le
           dise, et la ligne d'attente ci-dessus ne parle que du candidat le
           plus proche, qui n'est pas elle. L'attente se mesure après le
           paiement du chantier retenu : c'est de là que le joueur repart. */
        const lePas = cands.find(x=>x.prio);
        if(lePas && lePas !== ch && !waits.some(x=>x.p===p.i && x.k===lePas.k)){
          const c = levelCost(B[lePas.k], lePas.lvl);
          waits.push({q:'Bâtiment · '+planetRef(p), what:`${B[lePas.k].n} ${lePas.lvl}`, why:lePas.why, eta:wait(p,c), cost:c, held:reserveOf(p,Tm,gPrio).some(x=>x>0), heldBy:heldByOf(p,Tm,gPrio), miss:missOf(p,c), kind:'b', k:lePas.k, p:p.i});
        }
      }
      if(lfMode()==='after') lfPass(false);
      // Chaque planète qui a un chantier peut construire : le hub pour la soute
      // de l'empire, une colonie pour ses propres transporteurs.
      /* Les planètes au palier dont le chantier reste libre : le surplus de
         stock y passe en défense, mais seulement après la recherche. */
      const surplusApres = [];
      for(const p of P){
        const estHub = p === hubP;
        /* `flou` : le chantier a sorti un lot dont le jeu n'a pas dit le
           nombre. Proposer ici reviendrait à compter sur une flotte et une
           défense d'avant le lot — c'est ce qui faisait revenir « 10 grands
           transporteurs » à chaque plan. */
        if(p.b.shipyard>=1 && p.sq<=Tm && !p.flou){
          const total = k=>P.reduce((a,q)=>a+(q.ships[k]||0),0) + (sim.away[k]||0);
          const pr = P.reduce((a,q)=>{ const r=production(q); return a+mse(r.m,r.c,r.d); },0);
          const cap = expoFind(total('pf')>0);
          const cargoTarget = Math.min(cap, pr*6), lcC = shipStats('lc').cargoEff, scC = shipStats('sc').cargoEff;
          const cargoNow = total('lc')*lcC + total('sc')*scC;
          const big = shipReqOk('lc',p) ? 'lc' : 'sc', unitC = big==='lc'?lcC:scC;
          const wants = [];
          if(estHub && shipReqOk('pr',p) && total('pr')<5) wants.push({k:'pr', n:5-total('pr'), why:'Sondes pour espionner les inactifs avant de les piller'});
          /* Les foreuses ne passent par le chantier que si le classement les met
             devant les mines : sinon elles prendraient la place d'un niveau de
             mine moins cher au gain. */
          /* Classement calculé une fois, et comparé par clé : deux appels à
             rankUpgrades rendent deux jeux d'objets neufs, donc l'égalité de
             référence qui gardait cette ligne n'était jamais vraie et aucune
             foreuse n'a jamais été proposée. */
          const rk = rankUpgrades(p), cw = rk[0] && rk[0].key==='crawl' ? rk[0] : null;
          if(cw) wants.unshift({k:'crawl', n:cw.n, why:`Meilleur amortissement de cette planète : ${dur(cw.payback*3600)}`});
          if(estHub && shipReqOk(big,p) && cargoNow < cargoTarget){ const miss = Math.ceil((cargoTarget-cargoNow)/unitC); wants.push({k:big, n:Math.max(1, Math.ceil(miss/4)), why:`Soute pour expéditions et pillages : ${fmt(cargoNow)} sur ${fmt(cargoTarget)} visés`}); }
          /* L'Éclaireur est donné pour exclusif à l'Explorateur par les pages
             Gameforge : le proposer à un Collectionneur envoyait vers un
             chantier qui ne l'affiche pas. */
          if(estHub && S.settings.cls==='explorer' && shipReqOk('pf',p) && total('pf')<1) wants.push({k:'pf', n:1, why:'Un éclaireur double les gains des expéditions (bonus communautaire, à vérifier en jeu)'});
          // Une colonie compte SA soute, pas celle de l'empire : sinon la flotte
          // du hub suffit toujours et aucune colonie ne s'équipe jamais.
          if(needsOwnCargo(p, hubP) && shipReqOk(big,p)){
            const mien = (p.ships.lc||0)*lcC + (p.ships.sc||0)*scC;
            const r = production(p), besoin = (r.m + r.c + r.d) * 6;
            if(mien < besoin){
              const miss = Math.min(10, Math.max(1, Math.ceil((besoin-mien)/unitC)));
              wants.unshift({k:big, n:miss, why:`Transporteurs à demeure : cette colonie rapatrie sans attendre une flotte venue d'ailleurs`});
            }
          }
          /* La défense passe par le même chantier et la même file que les
             vaisseaux, donc par les mêmes wants. Elle ne sort que du modèle
             actif de la planète (le sien, sinon celui des réglages) : une
             pièce que le modèle ne nomme pas ne reçoit jamais de carte, même
             si elle est déjà au sol. Les quantités sont l'écart au modèle,
             `computeDefenseGap`, le même calcul qu'Outils › Défense.
             Le plancher du profil passe devant tout le chantier ; une planète
             nue aussi, c'est le cas où le raid est gratuit. Au-dessus, la
             croissance vers le palier se fait avec ce que le chantier a de
             libre. Le chantier occupé bloque déjà la planète (`p.sq`), et son
             lot rejoint `p.defs` à la fin : la file est comptée.
             def valant null, la page Défense n'a jamais été lue : proposer
             reviendrait à doubler ce qui existe déjà. dailyMissions le réclame. */
          const props = defPropositions(p);
          if(props && props.ordre.length){
            const dureeMax = Math.max(1, num(S.settings.defDuree, 4)) * 3600;
            const attente = props.bloques.length ? ` En attente : ${props.bloques.map(defBloqueTexte).join(' · ')}.` : '';
            const nue = !p.def;
            const dw = props.ordre.map(l=>({k:l.k, n:l.manque,
              /* Une carte ne dépasse pas la durée de chantier réglée : le reste
                 sort sur la carte suivante. */
              nMax: Math.max(1, Math.floor(dureeMax / Math.max(1e-9, shipTime(l.k, 1, p)))),
              why:`${defPhrase(l, props.gap, props.phase, props.vise)}.`
                + (nue ? ' Aucune défense : le premier pilleur repart avec la moitié de ton stock sans rien perdre.' : '')
                + attente}));
            if(props.phase === 'plancher' || nue) wants.unshift(...dw); else wants.push(...dw);
          }
          const res = reserveOf(p,Tm).map((x,j)=>x+softRes(p)[j]);
          for(const w of wants){
            if(refused(cardKey(DEF[w.k] ? 'def' : 'shipbuild', p.id, w.k))) continue;
            const c = SHIP_COST[w.k], afford = Math.min(...c.map((x,j)=>x>0 ? Math.floor((p.st[j]-res[j])/x) : Infinity));
            const n = Math.min(w.n, afford, w.nMax || Infinity); if(n<1) continue;
            const cost = c.map(x=>x*n), d = shipTime(w.k,n,p), k=w.k;
            /* Un lot plus petit qu'une tournée de production ne vaut pas la
               connexion : personne ne revient toutes les vingt secondes pour un
               laser. Le reliquat reste au stock et sort en paquet la fois
               d'après. Un lot qui termine ce qui était visé passe quand même. */
            /* La défense se mesure au hangar, pas à la tournée : un hangar
               plein peut payer moins qu'une tournée de production, et la carte
               ne sortirait jamais. Un lot vaut alors au moins la moitié de ce
               qu'un hangar plein paierait. */
            const plein = DEF[k] ? Math.min(...c.map((x,j)=>x>0 ? Math.floor(production(p).cap[j]/x) : Infinity)) : 0;
            if(DEF[k] ? n < Math.min(w.n, Math.ceil(plein/2)) : (n < w.n && mse(...cost) < tournee(p))) continue;
            // La foreuse se compte à part, comme le fait la lecture du jeu :
            // production() et rankUpgrades() lisent p.crawlers, jamais la flotte.
            pay(p,cost); const fin = Tm+d*1000; p.sq = fin; sim.ev.push({at:fin, fn:()=>addBuilt(p, {[k]:n})});
            const estDef = !!DEF[k];
            acts.push({q:(estDef?'Défense · ':'Chantier spatial · ')+planetRef(p), what:'Construire '+shipList({[k]:n}), why:w.why, cost, dur:d, end:fin, kind:estDef?'def':'shipbuild', ships:{[k]:n}, p:p.i});
            break;
          }
          if(p.sq<=Tm && props && !props.vise.lignes.some(l=>l.manque>0)) surplusApres.push(p);
        }
      }
      tryResearch('post');
      /* Le palier tenu, la défense ne sert plus qu'à ne pas perdre de
         production : une ressource au plafond, ou qui va l'atteindre, que rien
         de cette session ne dépense sur la planète — ni chantier, ni
         recherche, ni forme de vie — part en packs du modèle. En dernier, pour
         ne jamais passer devant ce qui fait grandir l'empire. */
      for(const p of surplusApres){
        if(p.sq>Tm) continue;
        const servies = [0,1,2].map(j=>acts.some(a=>a.p===p.i && a.kind!=='def' && a.kind!=='shipbuild' && a.cost && a.cost[j]>0));
        const s = defSurplus(p, {st:p.st, res:reserveOf(p,Tm).map((x,j)=>x+softRes(p)[j]), servies});
        if(!s) continue;
        const ships = s.ships, cost = [0,1,2].map(i=>Object.entries(ships).reduce((a,[k,n])=>a+DEF[k].c[i]*n, 0));
        const d = Object.entries(ships).reduce((a,[k,n])=>a+shipTime(k,n,p), 0), fin = Tm+d*1000;
        pay(p,cost); p.sq = fin; sim.ev.push({at:fin, fn:()=>addBuilt(p, ships)});
        acts.push({q:'Défense · '+planetRef(p), what:'Construire '+shipList(ships), why:s.why, cost, dur:d, end:fin, kind:'def', k:s.k, ships, p:p.i});
      }
      /* L'état d'une priorité ne se connaît qu'ici : son objectif peut naître
         dans `tryResearch`, et son chantier partir au milieu de la session.
         Trois sorts possibles, et le bloc les dit tels quels — une priorité qui
         ne fait rien doit le dire, c'est tout ce que `S.plan` n'a jamais su
         faire. */
      for(const e of prioEtat){
        if(e.etat != null) continue;
        const parti = acts.find(a => (e.bk && a.kind==='b' && a.k===e.bk && a.p===e.pi) || (e.tk && a.kind==='t' && a.k===e.tk));
        const g = goals.find(x=>x.key===e.key);
        e.etat = parti ? `Elle avance : ${parti.what} part maintenant.`
          : g ? `Elle épargne pour ${g.label}.`
          : `Rien ne part pour elle à cette session.`;
      }
      /* Les rapatriements de l'empire vont à la première posée qui épargne :
         la seconde moitié de la promesse de `destOf`, dite là où le joueur
         relit ses priorités. */
      const recoit = prioEtat.find(e => e.key && goals.some(g => g.key === e.key));
      /* Le statut de chaque conseil en attente : finançable à quelle heure, et
         grâce à quoi — un convoi, ou la production. */
      for(const w of waits) if(w.cost && P[w.p]) w.fin = finance(P[w.p], w.cost);
      sessions.push({T:Tm, acts, waits,
        prio:prioEtat.map(e=>({id:e.id, etat:e.etat, recoit:e === recoit})),
        goals:goals.map(g=>({key:g.key, label:g.label, deadline:g.deadline, res:g.res, rang:g.rang, p:g.p.i, cost:g.cost.slice()}))});
    }
    const end = now + (+S.day.horizon||24)*3600e3;
    advance(end);
    const endV = P.reduce((a,p)=>{ const r=production(p); return a+mse(r.m,r.c,r.d); },0);
    const ups = [];
    P.forEach((p,i)=>{ for(const k of Object.keys(B)){ const a=real.planets[i].b[k], b=p.b[k]; if(b>a) ups.push(`${B_SHORT[k]} ${a}→${b}${P.length>1?' ('+p.name+')':''}`); } });
    for(const k of Object.keys(T)){ const a=real.tech[k], b=sim.tech[k]; if(b>a) ups.push(`${T[k].n.replace('Technologie ','')} ${a}→${b}`); }
    /* Le profil décide de l'ordre des cartes d'une même connexion : à
       ressources égales, ce qu'il met en avant se lit d'abord. Aucune n'est
       retirée — une étape cachée serait une étape que le plan a pourtant
       payée, et ses chiffres ne tomberaient plus. */
    /* Un constat que la première connexion sert a trouvé sa réponse : la carte
       prend son niveau, et le constat ne se répète pas dans le bloc des
       conseils. Sans carte, il garde l'heure de la ligne d'attente qui lui
       répond — « ressources réunies vers 14 h 10 » vaut mieux qu'un rouge muet. */
    const s0 = sessions[0];
    if(s0) for(const c of cs){
      const i = P.findIndex(x => x.id === c.pid);
      const a = s0.acts.find(x => repondA(c, x, i));
      if(a){
        c.servi = true;
        if(rangNiveau(c.niveau) < rangNiveau(a.niveau)){ a.niveau = c.niveau; a.regle = c.regle; }
        continue;
      }
      const w = s0.waits.find(x => repondA(c, x, i));
      if(w){ c.vars.attenteQuoi = w.what; if(isFinite(w.eta)) c.vars.attente = formatTime(now + w.eta*1000); }
    }
    /* Le niveau se lit sur la carte, il ne la déplace pas : l'ordre des cartes
       d'une connexion dit déjà ce que le joueur a réglé — « recherche avant les
       bâtiments », « formes de vie avant tout » — et une file vide, critique sur
       presque toutes les cartes de bâtiment, renverserait ces deux réglages. */
    for(const x of sessions) x.acts.sort((a, b) => poidsCat(catActe(b)) - poidsCat(catActe(a)));
    return {now, sessions, busy, startV, endV, ups, alerts, constats:cs};
  } finally { S.tech = real.tech; S.planets = real.planets; }
}
/* La raison tient en une phrase : c'est elle que la carte montre, sous le quoi
   faire. Le reste — les chiffres, le détail du trajet, ce que le lien fait —
   attend toujours derrière le ⓘ. Chaque `why` commence donc par sa raison,
   et `whyLead` n'en garde que la première phrase, jamais plus d'une ligne. */
/** @returns {string} la première phrase d'un pourquoi, vide s'il n'y en a pas. */
export function whyLead(s){
  const t = String(s||'').trim(); if(!t) return '';
  const i = t.search(/(?:[.!?](?=\s)|\s·\s)/);
  let out = i > 0 ? t.slice(0, i+1).trim() : t;
  if(out.length > 120) out = out.slice(0, 119).replace(/\s+\S*$/, '') + '…';
  return out.replace(/[\s·]+$/, '');
}

/* ---------- projection des ressources ---------- */
/**
 * Les cargaisons qui se posent sur cette planète, arrivées depuis la dernière
 * lecture de son stock ou encore en vol. Une flotte hostile ne livre rien ; une
 * attaque ou une expédition, à l'aller, ne se pose pas chez moi. Un retour, lui,
 * rapporte ce qu'il porte — butin, trouvaille, débris.
 *
 * Les flottes arrivées viennent de `S.arrived` : le jeu ne les montre plus, mais
 * tant qu'aucune page n'a relu le stock, il ne les porte pas.
 * @returns {Array<{at:number, cargo:number[], mv:object}>} triées par heure
 */
export function livraisons(p){
  if(!p || !p.coords) return [];
  const depuis = (p.stock && p.stock.at) || 0, vus = new Set(), out = [];
  const lus = mouvements().concat((S.arrived || []).filter(m => m && Number.isFinite(+m.arrival)).map(m => ({
    mission: +m.mission, sens: m.ret ? 'retour' : 'aller', hostile: !!m.hostile, camp: m.camp || 'own',
    origine: {coords: m.origin || '', nom: m.originName || ''}, cible: {coords: m.dest || '', nom: m.destName || ''},
    arrivee: m.arrival * 1000, vaisseaux: m.ships || {}, cargaison: Array.isArray(m.cargo) ? m.cargo.map(x => +x || 0) : null,
    pose: m.ret ? m.origin : m.dest, m})));
  for(const v of lus){
    if(v.hostile || v.pose !== p.coords || !v.cargaison || !v.cargaison.some(x => x > 0)) continue;
    if(v.sens === 'aller' && ![3, 4, 5].includes(v.mission)) continue;
    if(v.arrivee <= depuis) continue;           // déjà dans le stock lu
    const k = `${v.mission}|${v.arrivee}|${v.sens}|${v.origine.coords}`;
    if(vus.has(k)) continue; vus.add(k);
    out.push({at: v.arrivee, cargo: v.cargaison, mv: v});
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * Le stock qui avance de t0 à t1 : la production s'arrête au hangar, une
 * livraison non — elle peut le dépasser, et la production reste alors arrêtée
 * tant que le stock est au-dessus.
 * @param {number[]} st0 stock à t0
 * @param {object} pr production(p) : débits horaires et capacités
 * @param {Array<{at, cargo}>} evs livraisons entre t0 et t1, triées
 */
function stockAvance(st0, t0, t1, pr, evs){
  const st = st0.slice(), r = [pr.m, pr.c, pr.d];
  const accrue = (a, b) => { if(b <= a) return; const h = (b - a) / 36e5; for(let j = 0; j < 3; j++){
    if(r[j] > 0){ if(st[j] < pr.cap[j]) st[j] = Math.min(pr.cap[j], st[j] + r[j]*h); }
    else st[j] = Math.max(0, st[j] + r[j]*h); } };
  let cur = t0;
  for(const e of evs || []){ if(e.at > t1) break; if(e.at < t0) continue; accrue(cur, e.at); cur = e.at; e.cargo.forEach((x, j) => st[j] += x); }
  accrue(cur, t1);
  return st;
}

/**
 * Les ressources d'une planète à l'instant t : stock lu, production jusqu'à t
 * (arrêtée au hangar), cargaisons posées avant t (jamais plafonnées).
 * @returns {number[]} [m, c, d]
 */
export function projectResources(p, t){
  const at = (p.stock && p.stock.at) || Date.now(), st0 = [+p.stock.m || 0, +p.stock.c || 0, +p.stock.d || 0];
  const depart = Math.min(at, t);
  return stockAvance(st0, depart, Math.max(t, depart), production(p), livraisons(p));
}

/** Secondes pour que la seule production couvre `cost`, Infinity si le hangar l'en empêche. */
function tempsProd(st, cost, pr){
  const r = [pr.m, pr.c, pr.d]; let w = 0;
  for(let j = 0; j < 3; j++){
    const miss = cost[j] - st[j];
    if(miss <= 1e-6) continue;
    if(r[j] <= 0 || cost[j] > pr.cap[j]) return Infinity;   // la production s'arrête au hangar
    w = Math.max(w, miss / r[j] * 3600);
  }
  return w;
}

/**
 * Quand `cost` devient finançable, et grâce à quoi.
 *
 * Deux calculs : avec les convois, et sans. Le convoi n'est nommé que s'il
 * avance vraiment l'heure — une livraison de cristal ne « finance » pas une
 * mine qui n'attendait que du métal. Il est alors celui, parmi les convois
 * posés avant l'heure trouvée, qui apporte la ressource qui manquait encore.
 * @param {object} p planète (réelle ou simulée : `st`, `at` remplacent le stock lu)
 * @param {number[]} cost
 * @param {object} [o] {st, at, evs, horizon} pour la simulation
 * @returns {{statut:'maintenant'|'convoi'|'production'|'jamais', at:number, secs:number, convoi:object|null}}
 */
function whenAffordable(p, cost, o){
  o = o || {};
  const now = o.at != null ? o.at : Date.now(), horizon = now + (o.horizon || 24) * 3600e3, pr = production(p);
  const st0 = o.st ? o.st.slice() : projectResources(p, now);
  const evs = (o.evs || livraisons(p)).filter(e => e.at > now);
  const ok = st => cost.every((x, j) => st[j] + 1e-6 >= x);
  if(ok(st0)) return {statut:'maintenant', at:now, secs:0, convoi:null};
  const finProd = now + tempsProd(st0, cost, pr) * 1000;
  let st = st0, cur = now, at = Infinity;
  for(const e of evs.concat([{at: Infinity, cargo: [0,0,0], fin: true}])){
    const t = cur + tempsProd(st, cost, pr) * 1000;
    if(t <= e.at){ at = t; break; }
    if(e.fin) break;
    st = stockAvance(st, cur, e.at, pr, [e]); cur = e.at;
    if(ok(st)){ at = e.at; break; }
  }
  if(!(at <= horizon)) return {statut:'jamais', at:Infinity, secs:Infinity, convoi:null};
  const secs = Math.max(0, (at - now) / 1000);
  if(at < finProd - 60e3){
    const manque = cost.map((x, j) => x > st0[j]);
    const avant = evs.filter(e => e.at <= at);
    const convoi = avant.slice().reverse().find(e => e.cargo.some((x, j) => x > 0 && manque[j])) || avant[avant.length - 1] || null;
    return {statut:'convoi', at, secs, convoi};
  }
  return {statut:'production', at, secs, convoi:null};
}

/** « Finançable à 07:12 (convoi Tourtierion, 30 GT) » : le statut d'un conseil. */
export function statutFinancement(f){
  if(!f) return '';
  if(f.statut === 'maintenant') return 'Finançable maintenant';
  if(f.statut === 'jamais') return 'Non finançable sous 24 h';
  if(f.statut === 'convoi' && f.convoi){
    const v = f.convoi.mv || {}, de = (v.sens === 'retour' ? v.cible : v.origine) || {};
    const nom = de.nom || de.coords || 'en vol';
    return `Finançable à ${formatTime(f.at)} (convoi ${nom}, ${shipCourt(v.vaisseaux)})`;
  }
  return `Finançable à ${formatTime(f.at)} (production)`;
}
/**
 * Le joueur accepte-t-il des satellites solaires ici ?
 *
 * Ce n'est pas un calcul, c'est un choix. Un satellite ne se répare pas : il
 * part en débris au premier raid, il grossit le butin de l'attaquant, et
 * l'énergie retombe avec lui le jour où elle manque le plus. D'autres joueurs
 * les posent volontiers, surtout sur une planète chaude où ils rendent le
 * double. Le réglage de la planète prime donc sur celui du compte, et le compte
 * dit non par défaut.
 *
 * Les satellites DÉJÀ posés ne passent pas par là : `production` les compte
 * toujours, quel que soit le réglage. Refuser d'en proposer n'est pas refuser
 * de voir ceux qui tournent.
 * @param {object} p planète, réelle ou copie simulée
 * @returns {boolean}
 */
export function satsOk(p){ return p && p.satsOk != null ? !!p.satsOk : !!S.settings.sats; }
/* Ce qui identifie une carte d'un plan au suivant : son genre, sa planète, et
   ce qu'elle vise — une destination, un bâtiment, une case de forme de vie.
   L'identifiant de la planète, pas son rang : le rang change dès qu'on
   oublie une planète, et la simulation échange S.planets contre ses copies, qui
   n'en portent aucun — d'où l'identifiant passé par l'appelant. */
export function cardKey(kind, pid, quoi){ return `${kind}:${pid||''}:${quoi||''}`; }
export function refused(key){ return !!S.daily.no[key]; }
/* À 0 et 1 case libre, planetAlerts dit déjà le mur ; la règle parle avant. */
export function casesBasses(p){
  const l = casesLibres(p), seuil = regleParam('INST_FIELDS_LOW', 'seuil', 10);
  return l != null && l >= 2 && l < seuil ? l : null;
}
