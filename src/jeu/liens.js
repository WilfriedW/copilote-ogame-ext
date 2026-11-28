/* ---------- les liens vers le jeu ----------
   Ce qui mène le joueur à la bonne page du jeu quand il clique : l'URL d'une
   page (`goUrl`), d'une action du plan (`actGo`), d'une mission (`missionGo`),
   d'un système (`galaxyUrl`, `coordLink`), le formulaire de flotte que le jeu
   remplit lui-même (`fleetUrl`), et la note qui dit ce qu'un lien ne peut pas
   faire (`goNote`). Aussi les indices que la page du jeu surligne
   (`planHints`, `prioHints`).

   Domaine de l'issue #49. Le centre (`centreOrHub`) reste emprunté à app.js. */
import { S } from '../core/etat.js';
import { esc, planetRef } from '../core/format.js';
import { labPlanet } from '../economie/production.js';
import { parseC } from '../flotte/vaisseaux.js';
import { prios, priosLf } from '../plan/priorites.js';
import { planetById, centreOrHub } from '../../app.js';
/* Le copilote n'ouvre que des pages du jeu : il ne remplit aucun formulaire,
   ne clique sur rien et ne lance rien à ta place. Un lien, pas un robot. */
export const GO_KIND = {t:'research', ship:'shipyard', shipbuild:'shipyard', sats:'shipyard', def:'defenses',
  transfer:'fleetdispatch', fleet:'fleetdispatch', expo:'fleetdispatch', raid:'galaxy'};
export const GO_MISSION = {lfb:'lfbuildings', lfr:'lfresearch', artefacts:'lfresearch',
  discovery:'galaxy', raid:'galaxy', inactive:'galaxy', 'raid-go':'galaxy', 'colo-taken':'galaxy',
  expomax:'research', expocargo:'shipyard', fleetslots:'movement', 'colo-fly':'movement', 'colo-eval':'overview', night:'fleetdispatch', defseen:'defenses', chantierlu:'shipyard'};
/* Les bâtiments se répartissent sur deux pages ; les hangars sont côté Ressources. */
export const GO_FACILITIES = new Set(['robot','shipyard','lab','nanite']);

/** URL d'une page du jeu sur une planète, ou null tant que le serveur est inconnu. */
export function goUrl(comp, pi){
  if(!S.host || !comp) return null;
  const gid = (S.planets[pi] || {}).gid;
  return `https://${S.host}/game/index.php?page=ingame&component=${comp}${gid ? `&cp=${gid}` : ''}`;
}
/** URL où se fait une action du plan, ou null. */
export const SHIP_ID = Object.fromEntries(Object.entries(OG_SHIPS).map(([id,k])=>[k,id]));
/* Le jeu remplit lui-même son formulaire de flotte quand on arrive par un lien
   qui porte les paramètres — c'est ce que fait sa propre page Galaxie quand on
   clique l'icône d'attaque. L'extension n'écrit donc rien dans la page : elle
   ouvre un lien, le jeu fait le reste. Sans destination ni mission, rien à
   préparer, on retombe sur la page nue. */
export function fleetUrl(a){
  const c = a && a.dest ? parseC(a.dest) : null;
  if(!S.host || !c || !a.mission) return null;
  const gid = (S.planets[a.p] || {}).gid;
  const q = ['page=ingame', 'component=fleetdispatch'];
  if(gid) q.push('cp='+gid);
  q.push('galaxy='+c[0], 'system='+c[1], 'position='+c[2], 'type=1', 'mission='+a.mission);
  for(const [k,n] of Object.entries(a.ships||{})) if(n>0 && SHIP_ID[k]) q.push('am'+SHIP_ID[k]+'='+n);
  return `https://${S.host}/game/index.php?${q.join('&')}`;
}
export function actGo(a){
  if(!a) return null;
  const prep = fleetUrl(a); if(prep) return prep;
  if(a.kind === 'b') return goUrl(GO_FACILITIES.has(a.k) ? 'facilities' : 'supplies', a.p);
  if(a.kind === 'lf') return goUrl(lfQueue(a.id) === 'lfresearch' ? 'lfresearch' : 'lfbuildings', a.p);
  // une recherche se lance depuis la planète qui porte le laboratoire
  const pi = a.kind === 't' ? S.planets.indexOf(labPlanet()) : a.p;
  return goUrl(GO_KIND[a.kind], pi);
}
/** URL où se fait une mission du jour, ou null. */
export function missionGo(m){
  if(!m) return null;
  const tag = (m.tags || [])[0];
  const prep = fleetUrl(m); if(prep) return prep;
  const url = goUrl(GO_MISSION[m.id], tag ? S.planets.findIndex(p=>planetRef(p) === tag) : centreOrHub());
  /* La page Galaxie accepte les mêmes paramètres que la page de flotte. Une
     carte qui nomme des coordonnées peut donc y mener directement, au lieu de
     déposer le joueur sur son propre système et de le laisser naviguer. Sans
     coordonnées, rien n'est ajouté : on n'invente pas une destination. */
  const c = m.coords ? parseC(m.coords) : null;
  return url && c && GO_MISSION[m.id] === 'galaxy' ? `${url}&galaxy=${c[0]}&system=${c[1]}` : url;
}
/** URL de la page Galaxie ouverte sur un système, ou null. */
export function galaxyUrl(coords){
  const c = parseC(coords), url = goUrl('galaxy', centreOrHub());
  return url && c ? `${url}&galaxy=${c[0]}&system=${c[1]}` : null;
}
/* Une carte qui nomme plusieurs systèmes n'en ouvrait qu'un : le clic sur le
   corps mène au premier, et les autres coordonnées n'étaient que du texte à
   retaper. Chacune porte donc son propre lien. Serveur inconnu : la
   coordonnée reste du texte, échappé comme avant. */
export function coordLink(coords){
  const url = galaxyUrl(coords);
  return url ? `<span class="go" data-go="${esc(url)}" title="Ouvrir la galaxie ${esc(coords)}">${esc(coords)}</span>` : esc(coords);
}
/** Attribut de lien pour une carte, vide quand on ne sait pas où l'envoyer. */
export function goAttr(url){ return url ? ` data-go="${esc(url)}"` : ''; }
/* OGame n'accepte de paramètres d'URL que sur la page de flotte — c'est ce dont
   sa propre page Galaxie a besoin. Il n'existe aucun équivalent pour « monte
   Métal 21 » : le lien d'un bâtiment, d'une recherche, d'une case de forme de
   vie ou d'un chantier ouvre la bonne page, et s'arrête là. Le dire est la
   seule chose à faire ; se taire laisse attendre un formulaire rempli qui ne
   viendra jamais.

   Et il ouvre la bonne planète seulement quand l'URL porte `cp=`. Une planète
   que le jeu ne nous a pas encore nommée n'a pas d'identifiant à y mettre : le
   lien tombe alors sur celle que le jeu avait en tête. Promettre « la bonne
   planète » dans ce cas enverrait construire ailleurs un joueur qui en a
   plusieurs — le mensonge exact que cette note est censée supprimer. */
/**
 * Why a card's link cannot carry the action itself, when it cannot.
 * @param {object} a planned action
 * @returns {string} the note, empty when the game fills its own form or when
 *   there is no link at all
 */
export function goNote(a){
  const url = a && !fleetUrl(a) && actGo(a);
  if(!url) return '';
  return /[?&]cp=/.test(url)
    ? 'Le lien ouvre la page sur la bonne planète : OGame ne permet pas de pré-remplir cette action.'
    : 'Le lien ouvre la page : OGame ne permet pas de pré-remplir cette action, ni de choisir la planète tant que le jeu ne l\'a pas nommée.';
}
/* Identifiants de tuile du jeu, dans l'autre sens : le plan raisonne en clés
   (« metal »), la page du jeu en numéros (« 1 »). */
export const BUILD_ID = Object.fromEntries(Object.entries(OG_BUILD).map(([id,k])=>[k,id]));
export const TECH_ID = Object.fromEntries(Object.entries(OG_TECH).map(([id,k])=>[k,id]));

/**
 * Traduit les actions du plan en indices à surligner dans la page du jeu.
 * Rangés par planète du jeu, puis par identifiant de tuile, la valeur étant
 * le niveau visé — la page du jeu décide comment l'écrire. Une action sans
 * tuile — une expédition, un rapatriement — n'en produit aucun, et une
 * planète que le jeu ne nous a pas encore nommée non plus : surligner au
 * hasard serait pire que ne rien surligner.
 * @param {object[]} acts actions de la session en cours
 * @returns {object} { [planetId]: { [technologyId]: niveau visé } }
 */
export function planHints(acts){
  const out = {};
  const put = (p, tech, lvl)=>{
    const gid = p && p.gid;
    if(!gid || !tech || !lvl) return;
    (out[gid] = out[gid] || {})[tech] = lvl;
  };
  for(const a of acts || []){
    const p = S.planets[a.p];
    if(a.kind === 'b') put(p, BUILD_ID[a.k], a.lvl);
    else if(a.kind === 't') put(p, TECH_ID[a.k], a.lvl);
    else if(a.kind === 'lf') put(p, a.id, a.lvl);
  }
  return out;
}
/**
 * Ce que le joueur a posé, rangé comme `planHints` : { [planète du jeu]: { [tuile]: niveau visé } }.
 * Ce canal existe à côté de `hints` et ne s'y réduit pas : `hints` vient des
 * actions de la session en cours, or une priorité qui épargne sans être encore
 * payable tombe dans les attentes, pas dans les actions — la pastille
 * disparaîtrait et le joueur ne verrait rien de ce qu'il a déclaré. Fusionner
 * les deux ferait de nouveau dépendre la déclaration du plan.
 * Une recherche se montre sur la planète du labo, où l'épargne se fait ; sa
 * priorité porte déjà ce pid (voir prios()).
 * @returns {object} { [planetId]: { [tuileId]: niveau visé } }
 */
export function prioHints(){
  const out = {};
  const put = (pid, tuile, lvl) => {
    const p = planetById(pid);
    // même garde que tourData : sert de clé d'objet, « __proto__ » n'est jamais une planète du jeu
    // le saut est voulu : une clé sans tuile du jeu ne doit jamais publier un identifiant bancal
    if(!p || !tuile || !/^\d+$/.test(String(p.gid || ''))) return;
    const l = out[p.gid] = out[p.gid] || {};
    // la première posée gagne : c'est celle que le plan sert, la pastille doit montrer la même
    if(!(tuile in l)) l[tuile] = lvl;
  };
  for(const e of prios()) put(e.pid, e.kind === 'b' ? BUILD_ID[e.k] : TECH_ID[e.k], e.lvl);
  for(const e of priosLf()) put(e.pid, e.k, e.lvl);
  return out;
}
