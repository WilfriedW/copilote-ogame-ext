/* ---------- les chantiers ----------
   Les files de construction d'une planète (`fileDe`, `enCours`, `fileBat`),
   et ce qui dit qu'une partie de l'empire a pris du retard : les mines
   déséquilibrées (`cibleMines`, `mineEnRetard`), les nanites et les robots
   (`naniteRetard`, `robotsOuNanites`), le labo (`laboEnRetard`, `labOkPour`),
   les recherches que le style de jeu vise (`profilVise`, `reglesRecherche`),
   et ce qu'un chantier fini dépose sur la planète (`addBuilt`).

   Domaine de l'issue #49. Il ne lit que le noyau, la production, la défense
   et le moteur de règles : le plan du jour l'importe, il n'importe pas le
   plan. */
import { DEF, defsOf } from '../defense/defense.js';
import { S } from '../core/etat.js';
import { B, T } from '../core/formules.js';
import { labPlanet, reqOk } from './centre.js';
import { parseC } from '../flotte/vaisseaux.js';
import { REGLES_PAR_ID, regle, regleActive, regleParam } from '../regles/moteur.js';
import { REGLES, aSoi } from '../regles/fichier.js';
/* Une file est occupée quand le jeu y montre un chantier, nommé ou non : même
   lecture que simulateDay. */
export const fileDe = (p, test) => (S.timers || []).filter(t => t && t.pid === p.id && test(t));
export const enCours = t => !t.done && t.end > Date.now();
export const fileBat = t => t.kind === 'b' || (t.kind === 'x' && t.queue === 'building');

/* La cible d'écart entre la mine de métal et celle de cristal : le style du
   profil, ajusté par la position. Lue dans rules.json, jamais saisie. Rien sans
   style ni position lisible : une cible inventée serait pire que pas de cible. */
function cibleMines(p){
  const st = S.profil && S.profil.style, mb = REGLES.mineBalance || {};
  if(!st || !aSoi(mb.byStyle, st) || !Number.isFinite(+mb.byStyle[st])) return null;
  const c = parseC(p && p.coords); if(!c) return null;
  let adj = null;
  for(const [k, v] of Object.entries(mb.byPosition || {})){
    const m = /^(\d+)-(\d+)$/.exec(k);
    if(m && c[2] >= +m[1] && c[2] <= +m[2] && Number.isFinite(+v)){ adj = +v; break; }
  }
  if(adj == null) return null;
  return {cible:+mb.byStyle[st] + adj, actuel:(p.b.metal || 0) - (p.b.crystal || 0), position:c[2]};
}
/* La mine en retard sur la cible. Une tolérance d'un niveau au-dessus évite que
   la planète oscille d'une mine à l'autre à chaque session. */
export function mineEnRetard(p){
  const r = cibleMines(p); if(!r) return null;
  const k = r.actuel < r.cible ? 'metal' : r.actuel > r.cible + regleParam('RES_MINE_BALANCE', 'tolerance', 1) ? 'crystal' : null;
  return k ? Object.assign({k}, r) : null;
}
export const signe = n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
/* Ce qu'une règle d'installation pousse dans pickBuildings, calculé au même
   endroit pour le constat et pour le plan : sinon les deux finiraient par ne
   plus dire la même chose. */
export function naniteRetard(p){
  const max = Math.max(0, ...S.planets.map(x => x.b.nanite || 0)), n = p.b.nanite || 0;
  return n < max - regleParam('INST_NANITES_LAGGING', 'ecart', 2) && !reqOk(B.nanite.req, p).length ? {n, max} : null;
}
/* Le plan ne propose jamais de robots au-delà de 10 : ce cas ne naît que d'une
   priorité du joueur. Le copilote la sert, et chiffre l'autre chemin. */
export function robotsOuNanites(p, lvl){
  if(!(lvl > 10) || (p.b.robot || 0) < 10 || reqOk(B.nanite.req, p).length) return null;
  return {robots:lvl, nanite:(p.b.nanite || 0) + 1, gain:((lvl + 1) / lvl).toFixed(2).replace('.', ',')};
}
/* Les labos que le Réseau fait compter : celui du centre, et les N meilleurs
   des autres planètes, N étant le niveau du Réseau (labEffectif). */
export function laboEnRetard(p){
  const n = S.tech.irn || 0, c = labPlanet();
  if(!n || !c || c.id === p.id || !((p.b.lab || 0) >= 1)) return null;
  const comptes = S.planets.filter(x => x.id !== c.id).sort((a, b) => (b.b.lab || 0) - (a.b.lab || 0)).slice(0, n);
  return comptes.some(x => x.id === p.id) && p.b.lab <= (c.b.lab || 0) - regleParam('INST_LAB_NETWORK', 'ecart', 3)
    ? {niveau:p.b.lab, centre:c.b.lab || 0} : null;
}
/* Le prérequis de labo d'une recherche, sur CETTE planète. `reqOk` lit le labo
   du centre (labLevel) : juste pour ce qui est débloqué, faux pour dire d'où on
   peut la lancer — un prérequis est une propriété de la planète. Les
   prérequis de technologie, eux, sont ceux de l'empire, et nextResearch ne rend
   que des pas déjà débloqués. */
export const labOkPour = (k, p) => (p.b.lab || 0) >= ((T[k].req || {}).lab || 0) && (p.b.lab || 0) >= 1;
/* Une recherche que le profil réclame : le style, ou un focus. */
export const profilVise = r => (Array.isArray(r.styles) && r.styles.includes(S.profil.style))
  || (Array.isArray(r.focus) && r.focus.some(f => (S.profil.focus || []).includes(f)));
/* Les pas de recherche que les règles poussent en tête de la feuille de route,
   derrière les priorités du joueur. Toute règle de condition techBelow y entre :
   en ajouter une au fichier ne demande pas de code. */
export function reglesRecherche(){
  const out = [];
  for(const id of Object.keys(REGLES_PAR_ID)){
    const r = regle(id);
    if(r.condition !== 'techBelow' || !regleActive(id) || !aSoi(T, r.tech) || !profilVise(r)) continue;
    if((S.tech[r.tech] || 0) < r.parametres.niveauCible) out.push([r.tech, r.parametres.niveauCible, '', id]);
  }
  return out;
}
/* Le chantier sort trois choses qui ne se rangent pas au même endroit : des
   vaisseaux, des foreuses que production() compte à part, et de la défense,
   comptée par type et par total. Chaque file le réinventait ; un seul endroit
   le dit, sinon un lot de lanceurs finit dans p.ships et ne défend rien. */
export function addBuilt(p, ships){
  for(const [k,n] of Object.entries(ships||{})){
    if(k==='crawl') p.crawlers=(p.crawlers||0)+n;
    /* Le détail part du relevé, pas de rien : sur une planète dont on ne
       connaissait que le total, poser {ll:2} effacerait les lanceurs déjà au
       sol et le plan les redemanderait un par un. */
    else if(DEF[k]){ const d = Object.assign({}, defsOf(p)); d[k] = (d[k]||0)+n; p.def=(p.def||0)+n; p.defs = d; }
    else { p.ships=p.ships||{}; p.ships[k]=(p.ships[k]||0)+n; }
  }
}
