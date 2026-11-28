/* ---------- profil de jeu ----------
   Un mineur, un raideur et un explorateur regardent la même liste de cartes
   et n'y cherchent pas la même chose. Le profil dit laquelle passe devant et
   laquelle ne sort pas du tout ; les poids, eux, sont dans `profils.js`, pour
   qu'on puisse les discuter sans relire le code qui les applique.

   Le style sert deux fois : il pèse les cartes, et il pose « Ce que le plan
   vise » — la question était déjà là, au troisième menu des Réglages, où
   personne n'allait. Elle se pose donc une fois, en tête de la page que le
   joueur regarde, avec les deux qui la complètent ; les Réglages restent
   l'endroit où en changer ensuite.

   Domaine de l'issue #49 : le profil, le poids qu'il donne aux cartes et
   l'étape du questionnaire (`poseProfilEtape`, puisqu'un import ne se
   réassigne pas). Les réglages que le style pose
   (`styleRepose`) vivent dans journee.js, à côté de `dayValue` qu'ils
   relisent : ici, ils fermeraient un cycle avec la journée, qui pèse ses
   cartes par le profil. */
import { S } from '../core/etat.js';
import { esc } from '../core/format.js';

/** La clé si la table la porte en propre, sinon null : sans ce garde-fou, une
    sauvegarde truquée ferait passer `__proto__` pour un style. */
export function profilConnu(t, k){ return Object.prototype.hasOwnProperty.call(t, String(k)) ? String(k) : null; }
/* Le profil remis d'aplomb : chaque clé relue dans sa table, le reste jeté.
   Une sauvegarde d'une autre version, une synchro abîmée ou un fichier bricolé
   à la main y mettraient sinon de quoi faire lever la ligne du profil. */
export function profilSain(){
  const def = {style:'', classe:'', activite:'regulier', focus:[], set:false};
  if(!S.profil || typeof S.profil !== 'object') S.profil = def;
  S.profil.style    = profilConnu(PROFILS.styles, S.profil.style) || def.style;
  S.profil.classe   = profilConnu(PROFILS.classes, S.profil.classe) || def.classe;
  S.profil.activite = profilConnu(PROFILS.activites, S.profil.activite) || def.activite;
  S.profil.focus = (Array.isArray(S.profil.focus) ? S.profil.focus : [])
    .map(k => profilConnu(PROFILS.focus, k)).filter(Boolean);
  // Répondu sans style : le questionnaire n'a pas abouti, il se repose.
  S.profil.set = !!S.profil.set && !!S.profil.style;
}
/* Le réglage « Ce que le plan vise » est posé par le style, mais le joueur peut
   en changer : tant qu'il ne l'a pas fait, le dire sur place vaut mieux qu'un
   paragraphe qui renvoie à une autre carte. C'est la même annotation que pour
   le modèle de défense, et la même règle que `styleRepose` applique. */
/** @returns {boolean} vrai si le plan en place est encore celui du style. */
export function planPoseParLeStyle(){
  const st = PROFILS.styles[S.profil.style];
  return !!(S.profil.set && st && S.day.focus === st.plan);
}
/** La classe que le style conseille, vide tant qu'aucun style n'est choisi. */
export function classeSuggeree(){ const s = PROFILS.styles[S.profil.style]; return s ? s.classe : ''; }
/** La classe que le profil vise : celle demandée, ou celle que le style conseille. */
export function classeVoulue(){ return S.profil.classe || classeSuggeree(); }
/* Le copilote ne change pas de classe dans le jeu, et il ne calcule pas sur une
   classe que le compte n'a pas : ce qu'il peut faire, c'est le dire. */
/** L'écart entre la classe lue dans le jeu et celle que le profil vise, ou ''. */
export function classeEcart(){
  const v = classeVoulue();
  if(!v || v === S.settings.cls) return '';
  return `Ton compte joue ${PROFILS.classes[S.settings.cls] || 'sans classe'}, ton profil vise ${PROFILS.classes[v]}. Rien n'est bloqué : les calculs suivent la classe lue dans le jeu, le profil ne décide que de l'ordre des cartes.`;
}
/**
 * Ce que vaut une catégorie pour le profil en place : 3 passe devant, 0 ne
 * sort pas. Une catégorie que la table ne nomme pas garde la place qu'elle
 * avait avant le profil — et tant que le questionnaire n'a pas de réponse,
 * c'est le cas de toutes.
 * @param {string} cat clé de `PROFILS.cats`, ou '' pour « sans catégorie »
 * @returns {number} 0 à 4
 */
/** @param {string[]} [focus] liste de focus à supposer, celle du profil par défaut */
export function poidsCat(cat, focus){
  if(!cat) return PROFILS.neutre;
  const pr = S.profil, mis = focus || pr.focus;
  /* La mise à l'abri ne se pondère pas, elle se place : chez qui passe peu,
     elle passe devant tout le reste. */
  if(cat === 'abri') return PROFILS.abri[pr.activite] || 3;
  let w = (PROFILS.poids[pr.style] || {})[cat];
  if(w == null) return PROFILS.neutre;
  // Un focus ajoute +2 une fois, pas +2 par focus qui le réclame.
  if(mis.some(f => (PROFILS.focus[f] || {cats:[]}).cats.indexOf(cat) >= 0)) w = Math.min(3, w + 2);
  const cap = (PROFILS.plafonds[pr.activite] || {})[cat];
  return cap == null ? w : Math.min(w, cap);
}
/* Un focus qui ne peut rien remonter doit le dire. Pour un explorateur, cocher
   « Expéditions » n'ajoute rien : sa catégorie vaut déjà 3 pour ce style, et le
   +2 est plafonné là. Même chose sous « Peu présent », où un plafond d'activité
   retient la catégorie plus bas que le focus ne la pousserait. Une case qui ne
   peut pas agir et qui n'en dit rien est un mensonge par omission — c'est ce
   que le joueur a trouvé en la cochant, et en ne voyant rien bouger. */
/** @returns {boolean} vrai si cocher ce focus ne changerait aucun poids. */
export function focusInerte(k){
  const f = PROFILS.focus[k]; if(!f) return false;
  const sans = S.profil.focus.filter(x => x !== k), avec = sans.concat(k);
  return f.cats.every(c => poidsCat(c, sans) === poidsCat(c, avec));
}
/** La catégorie d'une carte du plan, '' quand elle sert tous les styles. */
export function catActe(a){
  const t = PROFILS.actes;
  if(a.kind === 'b') return t.bat[a.k] || '';
  if(a.kind === 't') return t.tech[a.k] || '';
  // Un chantier vaut ce qu'il sort : c'est le vaisseau qui décide, pas la file.
  if(a.kind === 'shipbuild') return t.vaisseaux[Object.keys(a.ships || {})[0]] || '';
  return t.kinds[a.kind] || '';
}
/** La catégorie d'une carte à faire : sa rubrique, sauf les quelques exceptions. */
export function catMission(m){ return PROFILS.missions.id[m.id] || PROFILS.missions.q[m.q] || ''; }
/** Le profil en une ligne : « Turtle · Collecteur · Régulier · + Expéditions ». */
export function profilLigne(){
  const p = S.profil, st = PROFILS.styles[p.style];
  if(!st) return '';
  // Le nom court quand il existe : la ligne doit rester une ligne.
  const f = p.focus.map(k => PROFILS.focus[k].court || PROFILS.focus[k].n);
  return [st.n, PROFILS.classes[classeVoulue()], PROFILS.activites[p.activite].n]
    .concat(f.length ? '+ ' + f.join(', ') : []).join(' · ');
}
/** Les six focus ponctuels en cases à cocher. */
export function profilFocusHtml(){
  return Object.entries(PROFILS.focus).map(([k,f]) => {
    const mis = S.profil.focus.indexOf(k) >= 0, inerte = focusInerte(k);
    return `<label class="pill ${mis?'good':'info'} choix" title="${inerte?'Ton style met déjà cette catégorie au maximum : la cocher ne changerait rien.':''}"><input type="checkbox" data-pfocus="${k}" ${mis?'checked':''} class="w-auto mr-2">${esc(f.n)}${inerte?' <span class="note">· déjà au max</span>':''}</label>`;
  }).join('');
}
/* Trois questions, une par écran : la deuxième dépend de la première, puisque
   la classe conseillée n'existe qu'une fois le style choisi. L'assistant
   s'ouvre tant que la réponse manque, et « Refaire le questionnaire » le
   relance avec les réponses en place — un clic change un choix, pas trois. */
export let profilEtape = 0;
/* Un import ne se réassigne pas : les clics du questionnaire passent par ici. */
export function poseProfilEtape(v){ profilEtape = v; }
