/* ---------- la défense ----------
   Ce qu'il faut au sol d'une planète : les pièces de défense (`DEF`), les
   modèles de défense et leur recette (`DEF_MODELES`, `defModele`,
   `defRecette`), puis le manque face au modèle choisi (`computeDefenseGap`)
   et ce qu'on propose de lancer (`defPropositions`, `defPlan`).

   Module de domaine (issue #49). Le rendu (cartes, sélecteur de modèle) et
   l'évaluateur des ressources en trop restent dans app.js jusqu'à leurs
   étapes. Ce module emprunte encore à app.js quelques outils (nombres,
   stocks, production, liste de vaisseaux) : ce cycle-là est toléré tant
   qu'app.js existe, et rien n'y est lu au chargement. */
import { S } from '../core/etat.js';
import { B, T } from '../core/formules.js';
import { shipList } from '../flotte/vaisseaux.js';
import {
  IS_EXT, fmt, num, mse, stockNow, nf1, fmtCourt, shipReqOk
} from '../../app.js';

/* Un tas d'un seul type ne défend rien, quelle que soit la somme dépensée :
   le croiseur tire dix fois par lanceur de missiles et pas une fois par laser
   léger, le destructeur l'inverse. Les deux ensemble, et aucune des deux
   flottes ne fait l'affaire. Au-dessus, les gros canons sont la seule chose
   qui abîme un gros vaisseau, et le bouclier est le point de bouclier le
   moins cher du jeu, sans tir rapide de personne contre lui.
   Les proportions sont celles des stratégies de début de partie du wiki
   OGame, rapportées à une unité de chair à canon (`per`) ; `un` marque ce qui
   ne se construit qu'une fois, à partir de tant de chair à canon au sol.
   Coûts, prérequis et tirs rapides relevés sur le wiki.
   ponytail: pas de missiles — ils demandent un silo que le copilote ne lit
   pas ; et les proportions restent celles du début de partie, celles de la fin
   supposeraient que le joueur voie passer des étoiles de la mort. */
export const DEF = {
  rl: {n:'Lanceur de missiles', o:'lanceur de missiles',   p:'lanceurs de missiles',  c:[2000,0,0], a:80,    per:'fodder', r:{b:{shipyard:1}, t:{}}},
  ll: {n:'Laser léger',         o:'laser léger',           p:'lasers légers',         c:[1500,500,0], a:100, per:'fodder', r:{b:{shipyard:2}, t:{laser:3}}},
  sd: {n:'Petit bouclier',      o:'petit bouclier',        p:'petits boucliers',      c:[10000,10000,0], a:1, un:20,        r:{b:{shipyard:1}, t:{shielding:2}}},
  hl: {n:'Laser lourd',         o:'laser lourd',           p:'lasers lourds',         c:[6000,2000,0], a:250, per:1/10,     r:{b:{shipyard:4}, t:{energy:3, laser:6}}},
  ic: {n:'Artillerie à ions',   o:'artillerie à ions',     p:'artilleries à ions',    c:[5000,3000,0], a:150, per:1/20,     r:{b:{shipyard:4}, t:{ion:4}}},
  gc: {n:'Canon de Gauss',      o:'canon de Gauss',        p:'canons de Gauss',       c:[20000,15000,2000], a:1100, per:1/50,     r:{b:{shipyard:6}, t:{weapons:3, energy:6, shielding:1}}},
  ld: {n:'Grand bouclier',      o:'grand bouclier',        p:'grands boucliers',      c:[50000,50000,0], a:1, un:100,       r:{b:{shipyard:6}, t:{shielding:6}}},
  pt: {n:'Lanceur de plasma',   o:'lanceur de plasma',     p:'lanceurs de plasma',    c:[50000,50000,30000], a:3000, per:1/100,    r:{b:{shipyard:8}, t:{plasma:7}}},
};
/* L'ordre de construction : la chair à canon d'abord, elle protège le reste et
   c'est elle que la masse rend dissuasive ; les canons ensuite, du moins cher
   au plus cher. Le même ordre que le wiki fait suivre au joueur. */
export const DEF_ORDER = ['rl','ll','sd','hl','ic','gc','ld','pt'];
/* ---------- les modèles de défense ---------- */

/* Chaque joueur suit un ratio différent selon son style, et le wiki OGame en
   recense plusieurs sous « Defense Build Strategies ». Les voici, ramenés à une
   seule lecture : le nombre de pièces qu'il faut par lanceur de plasma. Le
   palier que le joueur vise se compte alors en lanceurs de plasma, et tout le
   reste suit — ce que le wiki écrit « 100 lasers légers » ou « 40 PL » dit la
   même proportion sous une autre ancre.
   Les deux boucliers n'y sont pas : le wiki en veut un de chaque, pas une
   proportion, et `defPlan` les pose hors ratio.
   Ces modèles sont la seule source des cartes Défense du plan : une pièce
   que le modèle actif ne nomme pas n'en reçoit jamais (`computeDefenseGap`).
   ponytail: une table dans le code, pas un fichier de config à charger. Un
   modèle de plus, c'est une ligne de plus, et rien à empaqueter ni à lire au
   démarrage. */
/* `a` est l'ancre que le wiki donne à la recette : « pour 100 LL », « pour
   40 PL ». Elle ne sert qu'à l'affichage — le palier, lui, se compte toujours
   par `defAncre`. */
export const DEF_MODELES = {
  framework: {n:'Framework mineur',           a:'pt', r:{rl:40,   ll:25,   hl:10,  ic:0,   gc:4,   pt:1}},
  balanced:  {n:'Balanced Defense',           a:'ll', r:{rl:20,   ll:100,  hl:10,  ic:20,  gc:10,  pt:5}},
  vetter:    {n:'Ryan A. Vetter',             a:'pt', r:{rl:270,  ll:180,  hl:45,  ic:15,  gc:5,   pt:1}},
  turtle:    {n:'Late Game Turtle',           a:'pt', r:{rl:1000, ll:1000, hl:400, ic:100, gc:100, pt:40}},
  fodder:    {n:'Fodder build-up',            a:'pt', r:{rl:900,  ll:300,  hl:50,  ic:30,  gc:18,  pt:9}},
  plasma:    {n:'Plasma pur et chair à canon', a:'pt', r:{rl:50,  ll:0,    hl:0,   ic:0,   gc:0,   pt:1}},
  /* Le ratio du joueur vit dans ses réglages, pas ici : la table reste ce que
     le wiki dit, et `defRatio` sait où chercher le sien. */
  perso:     {n:'Personnalisé', r:null},
};
/* Les pièces qu'un ratio nomme : tout sauf les deux boucliers. */
export const DEF_RATIO = DEF_ORDER.filter(k=>!DEF[k].un);
/* Les paliers proposés. Une liste fermée, et pas un champ libre : le menu dit
   ce que le joueur peut viser, et `sainEtat` n'a qu'elle à vérifier. */
export const DEF_PALIERS = [10, 20, 40, 60];

/* ---------- la recette d'un modèle, en clair ---------- */

/* Le menu ne montrait que des noms : « Balanced » ne dit pas ce qu'il coûte ni
   ce qu'il demande, et il fallait aller sur le wiki pour comparer. La recette
   s'écrit donc comme le wiki l'écrit, dans l'ordre et avec les abréviations
   des joueurs, et le coût d'un pack se calcule sur la table `DEF` : aucun prix
   n'est recopié ici. Lecture seule, rien ne part vers le jeu. */
export const DEF_SOURCE = 'https://ogame.fandom.com/wiki/Defense_Build_Strategies';
/* L'ordre de lecture, qui n'est pas celui de construction : le wiki nomme le
   Gauss avant les ions. */
const DEF_RECETTE = ['rl','ll','hl','gc','ic','pt'];
export const DEF_ABR = {rl:['LM','Lanceur de missiles'], ll:['LL','Artillerie laser légère'], hl:['LLo','Artillerie laser lourde'],
  gc:['Gauss','Canon de Gauss'], ic:['Ions','Artillerie à ions'], pt:['PL','Lanceur de plasma']};
/* Si aucune ancre n'est donnée, la pièce la plus chère que le modèle nomme :
   c'est elle que les joueurs comptent. */
const DEF_PAR_VALEUR = ['pt','gc','hl','ic','ll','rl'];

/** Un modèle sous la forme que lisent les fonctions de recette : `{n, a, r}`.
    Le perso prend le ratio des réglages et n'a pas d'ancre à lui. */
export function defModele(k){ const m = DEF_MODELES[k] || DEF_MODELES.framework; return {n:m.n, a:m.a, r:defRatio(k) || {}, perso: k === 'perso'}; }
/** L'ancre d'affichage : celle du modèle si son ratio la contient, sinon la
    pièce la plus chère présente. Une table sans ancre se signale en
    développement — le perso n'en a jamais, ce n'est pas une erreur. */
export function defAncreRecette(m){
  const r = m.r || {};
  if(m.a && r[m.a] > 0) return m.a;
  if(!m.perso && !IS_EXT) console.warn(`modèle de défense sans ancre : ${m.n}`);
  return DEF_PAR_VALEUR.find(k=>r[k] > 0) || null;
}
/**
 * La recette d'un modèle, pièce par pièce, dans son ancre ou ramenée à 1 PL.
 * @param {{a?:string, r:object}} m
 * @param {{per?:'native'|'PL'}} [o]
 * @returns {{ancre:string, q:number, items:Array<{k:string, n:number}>}|null}
 *   null quand le modèle est vide, ou sans PL pour `per:'PL'`
 */
export function defRecette(m, o = {}){
  const r = m.r || {};
  if(o.per === 'PL'){
    if(!(r.pt > 0)) return null;
    return {ancre:'pt', q:1, items: DEF_RECETTE.filter(k=>k !== 'pt' && r[k] > 0).map(k=>({k, n: Math.round(r[k] / r.pt * 10) / 10}))};
  }
  const a = defAncreRecette(m);
  if(!a) return null;
  return {ancre:a, q:r[a], items: DEF_RECETTE.filter(k=>k !== a && r[k] > 0).map(k=>({k, n:r[k]}))};
}
/** « Pour 100 LL : 20 LM / 10 LLo / … ». */
function formatRecipe(m, o){
  const d = defRecette(m, o);
  if(!d) return o && o.per === 'PL' ? '' : 'Aucune pièce';
  return `Pour ${nf1.format(d.q)} ${DEF_ABR[d.ancre][0]} : ${d.items.length ? d.items.map(i=>`${nf1.format(i.n)} ${DEF_ABR[i.k][0]}`).join(' / ') : 'rien d\'autre'}`;
}
/** Ce que coûte une fois la recette native : [métal, cristal, deutérium]. */
export function packCost(m){ const r = m.r || {}; return [0,1,2].map(i=>DEF_RECETTE.reduce((a,k)=>a + num(r[k], 0) * DEF[k].c[i], 0)); }
/** « 307,5 k M / 142,5 k C / 38 k D ». */
function packText(c){ return `${fmtCourt(c[0])} M / ${fmtCourt(c[1])} C / ${fmtCourt(c[2])} D`; }
/** La ligne du menu : recette native et coût d'un pack, sur une ligne. */
export function defLigne(m){ return `${formatRecipe(m)} · ${packText(packCost(m))}`; }
/* Le relevé d'avant ne donnait qu'un total et le comptait en lanceurs : on lui
   laisse ce sens plutôt que de le jeter, sinon une défense déjà construite
   disparaît le jour de la mise à jour et le plan la redemande. */
export const defsOf = p => p.defs || (p.def == null ? null : {rl:p.def});
/** Le modèle que cette planète suit : le sien d'abord, celui des réglages
    ensuite. @returns {string} une clé de DEF_MODELES */
/* Un réglage venu d'ailleurs (sauvegarde, autre poste) peut nommer un modèle
   que la table n'a plus : le framework répond, plutôt qu'un rendu qui casse. */
function defModeleK(p){ const k = p && p.defModele; return k && DEF_MODELES[k] ? k : (DEF_MODELES[S.settings.defModele] ? S.settings.defModele : 'framework'); }
/** Le modèle actif d'une planète : le sien s'il est posé, sinon celui des
    réglages, que le profil a posé au questionnaire. Un seul endroit tranche,
    pour qu'Outils › Défense et le plan ne suivent jamais deux modèles. */
const resolveActiveModel = p => defModeleK(p);
/** Le ratio d'un modèle. Celui du joueur sort de ses réglages. */
export function defRatio(k){ return k === 'perso' ? S.settings.defPerso : (DEF_MODELES[k] || {}).r; }
/** La pièce qui compte le palier : le lanceur de plasma, ou, si le modèle n'en
    veut aucun, la première que son ratio nomme. Sans elle, un ratio perso sans
    plasma ferait diviser par zéro. */
export function defAncre(r){ return r && r.pt > 0 ? 'pt' : (DEF_RATIO.find(k=>r && r[k] > 0) || 'pt'); }
/** Le palier visé sur cette planète : le sien d'abord. `'fill'` veut dire
    « compléter autour de ce qui est déjà au sol ». */
export function defPalierDe(p){ const v = p && p.defPalier != null ? p.defPalier : S.settings.defPalier; return v === 'fill' ? 'fill' : num(v, 20); }
/* Les plafonds proposés pour la taille d'une carte, en heures de chantier. */
export const DEF_DUREES = [1, 2, 4, 8, 12];
/* Les planchers proposés, en packs du modèle. */
export const DEF_PLANCHERS = [0, 1, 2, 3, 5];
/** Le plancher de défense du profil, en packs du modèle : 0 quand le style
    n'en a pas. Le réglage du joueur passe devant la valeur du profil. */
function defPlancherDe(){
  const st = S.profil && S.profil.set ? PROFILS.styles[S.profil.style] : null;
  if(!st || st.plancher == null) return 0;
  const v = S.settings.defPlancher;
  return v == null || v === '' ? st.plancher : Math.max(0, num(v, st.plancher));
}
/** La défense déjà en file sur cette planète : ce que le joueur a lancé depuis
    une carte et dont le chantier n'a pas encore rendu la main. Sans elle, la
    carte suivante redemanderait le lot en cours. */
function defEnFile(p, now = Date.now()){
  const out = {};
  for(const t of S.timers || []){
    if(t.done || t.end <= now || t.pid !== p.id || !t.ships) continue;
    for(const [k, n] of Object.entries(t.ships)) if(DEF[k]) out[k] = (out[k] || 0) + num(n, 0);
  }
  return out;
}
/**
 * La seule source de vérité de la défense : ce que le modèle actif demande à
 * cette planète, type par type, et ce qui lui manque. Outils › Défense et les
 * cartes du plan passent tous deux par ici.
 *
 *   cible(type) = ratio(type) × palier / ratio(ancre)
 *   manque(type) = max(0, cible − au sol − en file)
 *
 * Un type que le modèle ne nomme pas — l'artillerie à ions du Framework
 * mineur, les deux boucliers dans tous les modèles — n'a jamais de manque :
 * s'il est au sol, il compte « hors modèle », sans rien réclamer.
 *
 * @param {object} p planète (réelle ou simulée)
 * @param {{modele?:string, palier?:number|'fill', have?:object, enFile?:object}} [o]
 * @returns {{modele:string, nom:string, ancre:string, palier:number,
 *   lignes:Array<{k:string, n:number, file:number, cible:number, manque:number,
 *   exces:number, hors:boolean, ok:boolean, req:string}>}|null}
 *   null quand la défense n'a jamais été relevée : zéro et inconnu diffèrent.
 */
export function computeDefenseGap(p, o = {}){
  const have = o.have || (p && defsOf(p));
  if(!have) return null;
  const enFile = o.enFile || {};
  const k = o.modele || resolveActiveModel(p), r = defRatio(k) || {}, ancre = defAncre(r);
  const vise = o.palier != null ? o.palier : defPalierDe(p);
  /* « Compléter » : c'est ce qui est au sol, ou en route, qui fixe la taille.
     Sans une seule unité d'ancrage, compléter autour de zéro ne demanderait
     rien : la planète resterait nue sans conseil. Le plus petit palier
     proposé prend le relais. */
  const ancres = num(have[ancre], 0) + num(enFile[ancre], 0);
  const palier = vise === 'fill' ? (ancres > 0 ? ancres : DEF_PALIERS[0]) : Math.max(0, num(vise, 0));
  const f = r[ancre] > 0 ? palier / r[ancre] : 0;
  const lignes = DEF_ORDER.map(j=>{
    const dedans = !DEF[j].un && num(r[j], 0) > 0;
    const cible = dedans ? Math.ceil(r[j] * f) : 0;
    const n = Math.max(0, num(have[j], 0)), file = Math.max(0, num(enFile[j], 0));
    const manque = dedans ? Math.max(0, cible - n - file) : 0, ok = shipReqOk(j, p);
    return {k:j, n, file, cible, manque, exces: dedans ? Math.max(0, n + file - cible) : 0,
      hors: !dedans && n + file > 0, ok,
      /* Le prérequis ne se dit que s'il bloque une pièce que le modèle demande. */
      req: manque > 0 && !ok ? defPrereq(j, p) : ''};
  }).filter(l=>l.cible > 0 || l.n > 0 || l.file > 0);
  return {modele:k, nom:(DEF_MODELES[k] || {}).n || k, ancre, palier, lignes};
}
/**
 * Ce que le plan propose sur cette planète, dans l'ordre : d'abord le
 * plancher du profil s'il n'est pas tenu, ensuite le palier visé. Seuls les
 * types débloqués sortent ; à l'intérieur, le moins complet d'abord
 * (au sol / cible), et à égalité le moins cher à l'unité.
 * @param {object} p planète
 * @param {object} [o] passé à computeDefenseGap
 * @returns {{phase:'plancher'|'palier', gap:object, vise:object, plancher:number,
 *   ordre:object[], bloques:object[]}|null}
 */
export function defPropositions(p, o = {}){
  const vise = computeDefenseGap(p, o);
  if(!vise) return null;
  const r = defRatio(vise.modele) || {}, plancher = defPlancherDe() * num(r[vise.ancre], 0);
  const utile = g => g.lignes.filter(l=>l.manque > 0 && l.ok);
  let gap = vise, phase = 'palier';
  if(plancher > 0 && plancher < vise.palier){
    const g = computeDefenseGap(p, Object.assign({}, o, {modele:vise.modele, palier:plancher}));
    if(utile(g).length){ gap = g; phase = 'plancher'; }
  }
  const taux = l => (l.n + l.file) / l.cible;
  const ordre = utile(gap).sort((a, b)=>taux(a) - taux(b) || mse(...DEF[a.k].c) - mse(...DEF[b.k].c));
  return {phase, gap, vise, plancher, ordre, bloques: vise.lignes.filter(l=>l.req)};
}
/** « 12 lanceurs de missiles sur 800 visés pour le modèle Framework mineur (palier 20) ». */
export function defPhrase(l, gap, phase, vise){
  const d = DEF[l.k], x = l.n + l.file;
  const quoi = phase === 'plancher' ? `plancher ${fmt(gap.palier)}, avant le palier ${fmt(vise.palier)}` : `palier ${fmt(gap.palier)}`;
  return `${fmt(x)} ${x > 1 ? d.p : d.o} sur ${fmt(l.cible)} vis${l.cible > 1 ? 'és' : 'é'} pour le modèle ${gap.nom} (${quoi})`;
}
/** « Gauss : nécessite Chantier spatial 6, Technologie Armes 3 ». */
export const defBloqueTexte = l => `${DEF_ABR[l.k] ? DEF_ABR[l.k][0] : DEF[l.k].n} : nécessite ${l.req}`;
/** Le mélange visé en clair : « 800 lanceurs de missiles, 500 lasers légers… ». */
export function defMixList(p){ const g = computeDefenseGap(p); if(!g) return ''; const c = {}; for(const l of g.lignes) if(l.cible > 0) c[l.k] = l.cible; return shipList(c); }

/**
 * Ce qu'il manque à une planète pour tenir son modèle, pièce par pièce, et ce
 * que ça coûte. Lecture seule : rien n'est construit, aucune file n'est ouverte.
 * Le calcul est celui de `computeDefenseGap`, avec la file du chantier.
 *
 * @param {object} p planète
 * @returns {object|null} le gap, plus `cout`, `stock`, `payable` et le plancher
 */
export function defPlan(p){
  if(!p || !defsOf(p)) return null;
  const pr = defPropositions(p, {enFile: defEnFile(p)}), d = pr.vise;
  for(const l of d.lignes) l.cout = DEF[l.k].c.map(x=>x * l.manque);
  const cout = [0,1,2].map(i=>d.lignes.reduce((a,l)=>a + l.cout[i], 0)), stock = stockNow(p);
  return Object.assign(d, {cout, stock, payable: cout.every((x,i)=>x <= stock[i]),
    phase: pr.phase, plancher: pr.plancher, plancherGap: pr.phase === 'plancher' ? pr.gap : null});
}
/** Ce qui bloque une pièce, en clair : « Chantier spatial 8, Technologie Plasma 7 ». */
function defPrereq(j, p){
  const r = DEF[j].r;
  return Object.entries(r.b).filter(([b,l])=>num(p.b[b]) < l).map(([b,l])=>`${B[b].n} ${l}`)
    .concat(Object.entries(r.t).filter(([t,l])=>num(S.tech[t]) < l).map(([t,l])=>`${T[t].n} ${l}`))
    .join(', ');
}
/** Les paliers d'un menu, le choisi marqué. */
export function defPalierOpts(v){
  return DEF_PALIERS.map(x=>`<option value="${x}" ${+v===x?'selected':''}>${x}</option>`).join('')
    + `<option value="fill" ${v==='fill'?'selected':''}>Compléter l'existant</option>`;
}
