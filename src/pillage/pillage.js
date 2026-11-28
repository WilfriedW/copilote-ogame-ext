/* ---------- le pillage ----------
   Outils › Cibles : les cibles à piller (`raidTargets`) et les systèmes à
   explorer (`exploreSystems`), puis le rapport d'espionnage collé par le
   joueur, son vocabulaire (`REPORT_HEADS`, `REPORT_WORDS`, `SE_BAT`), sa
   lecture (`parseReport`, `seNue`, `applyReport`) et la flotte qu'il faut
   pour emporter le butin (`raidPlan`).

   Domaine de l'issue #49. Il lit le noyau, l'univers, la flotte, la défense
   et la colonisation (le point de départ), et emprunte encore
   `cargoHomeIndex` à app.js, appelé et jamais lu au chargement. */
import { coloFrom } from '../colonisation/colonisation.js';
import { S } from '../core/etat.js';
import { num } from '../core/format.js';
import { API } from '../core/serveur.js';
import { DEF } from '../defense/defense.js';
import { mse } from '../economie/production.js';
import {
  SHIPS, parseC, souteUtile, shipStats, flight, SHIP_PLURAL, SHIP_ONE,
  shipList
} from '../flotte/vaisseaux.js';
import { sysDiff, wrapSys, myScore, isInactive } from '../univers/univers.js';
import { cargoHomeIndex } from '../../app.js';
/** Inactive planets near home, attackable first, then the ones that would trigger the outlaw warning. */
export function raidTargets(){
  if(!API || !API.planets || !API.players) return [];
  const home = parseC(coloFrom().coords); if(!home) return [];
  /* Le statut hors-la-loi appartient à la protection débutant, et la page
     Outlaw du wiki dit où elle s'arrête : « the status has no effect after
     500,000 points ». Passé ce score, écarter les inactifs plus forts ne
     protège plus de rien — ça ne fait que cacher les cibles les plus
     riches, c'est-à-dire exactement celles qu'on cherche. */
  const me = myScore(), risque = me != null && me < 5e5, out = [];
  for(const [coords, pl] of API.planets){
    const c = parseC(coords); if(!c || c[0]!==home[0]) continue;
    const P = API.players[pl]; if(!P || !isInactive(P[1])) continue;
    const dist = sysDiff(c[1], home[1]); if(dist>30) continue;
    const sc = (API.scores && API.scores[pl] || [0])[0], outlaw = risque && sc > me;
    out.push({coords, name:P[0], status:P[1], score:sc, dist, outlaw, longInactive:/I/.test(P[1]), value: sc*(/I/.test(P[1])?1.3:1)/(1+dist/8)});
  }
  return out.sort((a,b)=>(a.outlaw-b.outlaw) || (b.value-a.value));
}
/** Nearby systems ranked by how many positions were not explored in the last week. */
export function exploreSystems(){
  const home = parseC(coloFrom().coords); if(!home) return [];
  const ex = S.explored || {}, now = Date.now(), out = [];
  for(let d=0; d<=6; d++) for(const sgn of d ? [-1,1] : [1]){
    const sys = wrapSys(home[1]+sgn*d); let left = 0;
    for(let q=1;q<=15;q++){ const t = ex[`${home[0]}:${sys}:${q}`]; if(!t || now-t > 7*864e5) left++; }
    out.push({sys:`${home[0]}:${sys}`, left, dist:d});
  }
  return out.filter(x=>x.left>0).slice(0,6);
}

/* ---------- le vocabulaire d'un rapport d'espionnage ---------- */
/* Relevé sur un rapport du jeu le 18 novembre 2026 (test/rapports/README.md).
   Deux choses s'y voient qu'on ne devinerait pas : le jeu écrit tous les titres
   de section, même celles qu'il n'a pas pu lire, et il avoue l'absence par une
   phrase plutôt que par un vide. L'inconnu se reconnaît donc à ce qui est
   écrit, pas à ce qui manque. Et son apostrophe est un accent grave. */
const REPORT_RIEN = 'aucune donnee fiable';
/**
 * Forme comparable d'un libellé : minuscules, sans accent, apostrophes
 * ramenées à une seule, espaces tassés. Sans ça « Défense » et « defense »
 * seraient deux sections différentes, et l'accent grave du jeu ferait rater
 * « sonde d'espionnage ».
 * @param {string} s
 * @returns {string}
 */
function repKey(s){
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[`’']/g, "'").replace(/\s+/g, ' ').trim().replace(/\s*:$/, '');
}
/* Les titres connus. Ceux qui valent 'skip' sont lus et jetés : sans eux, les
   lignes d'un bâtiment tomberaient dans la défense qui précède et la rendraient
   inconnue pour rien. Un titre qu'on ne connaît pas n'en est pas un — il compte
   comme une ligne non reconnue, donc il rend sa section inconnue, ce qui est le
   sens prudent. */
const REPORT_HEADS = {
  'ressources':'res', 'flottes':'fleet', 'defense':'def',
  'reparations en cours':'skip', 'batiment':'skip', 'batiments':'skip',
  'batiments des formes de vie':'skip', 'recherche':'skip',
  'recherche des formes de vie':'skip', 'commentaires':'skip'
};
/* Chaque libellé que le rapport peut porter, vers sa clé. Les noms viennent des
   tables déjà relevées sur le jeu plutôt que d'être recopiés ; seul ce qu'elles
   ne nomment pas s'ajoute à la main. */
export const REPORT_WORDS = {};
{
  const add = (k, ...noms) => { for(const n of noms) if(n) REPORT_WORDS[repKey(n)] = k; };
  for(const k of Object.keys(SHIPS)) add(k, SHIPS[k].n, SHIP_PLURAL[k], SHIP_ONE[k]);
  for(const k of Object.keys(DEF)) add(k, DEF[k].n, DEF[k].o, DEF[k].p);
  add('sat', 'Satellite solaire', 'Satellites solaires');
  add('crawl', 'Foreuse', 'Foreuses');
  add('abm', 'Missile d\'interception', 'Missiles d\'interception');
  add('ipm', 'Missile interplanétaire', 'Missiles interplanétaires');
}
/* Ce qui tire. Les cinq autres ne défendent rien : le satellite et la foreuse
   ont 1 d'attaque, la sonde 0,01, contre 4 000 de coque à un petit transporteur,
   et les deux missiles ne visent pas une flotte. Leur présence n'empêche donc
   pas un pillage — l'exiger ramènerait le joueur à cocher sa case à la main,
   parce qu'un inactif traîne presque toujours des satellites. Tout le reste,
   petit transporteur compris, veut dire combat, et le copilote n'en simule
   aucun : il se tait et laisse le joueur trancher. */
export const SE_BAT = {};
/**
 * Ce qu'un rapport d'espionnage collé veut dire.
 *
 * `null` veut dire « le rapport ne le dit pas », et jamais zéro — c'est le
 * partage que `defsOf` fait déjà sur les planètes du joueur, pour la même
 * raison : un espionnage trop faible n'affiche pas la section, et confondre
 * les deux enverrait la flotte contre une défense.
 *
 * Le repli va toujours vers l'inconnu. Une ligne qu'on ne sait pas lire rend
 * sa section inconnue plutôt que vide, parce que « vide » autorise un pillage
 * et « inconnu » ne fait que se taire. Un vocabulaire incomplet rend donc le
 * copilote muet, jamais menteur.
 *
 * @param {string} txt le rapport, tel que le joueur l'a collé
 * @returns {{res:number[]|null, fleet:object|null, def:object|null, loot:number|null}}
 */
function parseReport(txt){
  const brut = String(txt);
  const num = label=>{ const m = brut.match(new RegExp(label+'\\s*:?\\s*(\\d[\\d.,]*)\\s*(Mn|M|k|K)?', 'i')); if(!m) return null; const suf = m[2]||''; if(/m/i.test(suf)) return Math.round(parseFloat(m[1].replace(/\./g,'').replace(',','.'))*1e6); if(/k/i.test(suf)) return Math.round(parseFloat(m[1].replace(/\./g,'').replace(',','.'))*1e3); return +m[1].replace(/[.,]/g,'') || 0; };
  /* Les ressources gardent leur lecture d'avant : elles ne dépendent d'aucune
     section, pour que coller la seule partie Ressources continue de marcher. */
  const res = [num('M[ée]tal'), num('Cristal'), num('Deut[ée]rium')];
  const butin = brut.match(/butin\s*:?\s*(\d+)\s*%/i);

  const st = {fleet:{vue:false, floue:false, n:{}}, def:{vue:false, floue:false, n:{}}};
  const compte = (s, k, v)=>{ s.n[k] = (s.n[k]||0) + v; };
  const chiffre = s=>{ const v = +String(s).replace(/[.,\s]/g,''); return isFinite(v) ? v : null; };
  let sec = null, attend = null;
  /* Un libellé reconnu dont le compte n'arrive jamais est le cas qui mord : il
     laissait la section « lue et vide », donc la cible « nue », alors que le
     mot était sous les yeux du joueur. Perdre une attente rend donc la section
     inconnue — c'est le seul sens de repli qui ne mente pas. */
  const perdu = ()=>{ if(attend && sec) sec.floue = true; attend = null; };
  for(const ligne of brut.split(/\r?\n/)){
    const l = ligne.trim(); if(!l) continue;
    const cle = repKey(l), tete = REPORT_HEADS[cle];
    if(tete){ perdu(); sec = (tete==='fleet'||tete==='def') ? st[tete] : null; if(sec) sec.vue = true; continue; }
    if(!sec) continue;
    // Le jeu avoue lui-même ce qu'il n'a pas pu lire : c'est le signal le plus sûr.
    if(cle.startsWith(REPORT_RIEN)){ sec.floue = true; attend = null; continue; }
    if(REPORT_WORDS[cle]){ perdu(); attend = REPORT_WORDS[cle]; continue; }
    /* Le libellé et son nombre peuvent tenir sur une ligne ou sur deux, selon
       la façon dont le joueur copie : les deux se lisent, parce que deviner
       laquelle coûterait un rapport mal lu sur une mise en page légitime. */
    const m = l.match(/^(.*?)[\s.:]*(\d[\d.,\s]*)$/);
    const k2 = m && REPORT_WORDS[repKey(m[1])];
    const v = m ? chiffre(m[2]) : null;
    if(k2 && v != null){ perdu(); compte(sec, k2, v); continue; }
    if(attend && v != null && m && !m[1].trim()){ compte(sec, attend, v); attend = null; continue; }
    sec.floue = true; attend = null;
  }
  perdu();
  const rendu = s => (!s.vue || s.floue) ? null : s.n;
  return {
    res: res.some(x=>x!=null) ? res.map(x=>x||0) : null,
    fleet: rendu(st.fleet), def: rendu(st.def),
    loot: butin ? +butin[1]/100 : null
  };
}
/** Une section lue où rien ne tire. Inconnue (`null`) n'est pas nue. */
function seNue(n){ return !!n && !Object.keys(n).some(k=>SE_BAT[k] && n[k]>0); }
/**
 * Pose sur la cible ce qu'un rapport collé vient de dire.
 *
 * `S.raid.safe` garde le sens qu'il a toujours eu — le joueur affirme que la
 * cible est nue, et c'est lui qui engage sa flotte — mais le collage le
 * pré-remplit au lieu de le laisser à une case qu'on coche sans avoir lu. Le
 * joueur peut recocher : il a pu lire le rapport mieux que l'analyseur, et le
 * copilote ne refuse pas un choix du joueur.
 *
 * @param {string} txt le rapport collé
 */
export function applyReport(txt){
  if(!S.raid) return;
  /* Le rapport porte les coordonnées de la planète espionnée. Coller celui
     d'une autre cible pré-cocherait « sans défense » pour celle-ci, et c'est
     une erreur de manipulation banale dès qu'on espionne plusieurs cibles :
     elle coûte le même prix que le mensonge qu'on cherche à éviter. */
  const c = String(txt).match(/\[(\d+:\d+:\d+)\]/);
  if(c && S.raid.coords && c[1] !== S.raid.coords){ S.raid.mismatch = c[1]; return; }
  S.raid.mismatch = null;
  const r = parseReport(txt);
  /* La flotte et la défense repartent à chaque collage, y compris vers
     l'inconnu : gardées, celles d'hier décriraient la cible d'hier. Les trois
     ressources, elles, survivent à un collage qui ne les contient pas — le
     joueur a pu les taper, et une ressource périmée ne fait rater qu'un butin
     quand une défense périmée fait perdre une flotte. */
  S.raid.fleet = r.fleet;
  S.raid.def = r.def;
  S.raid.lootSeen = r.loot;
  /* La date suit les ressources, et elles seules : c'est le stock qui vieillit.
     Posée à chaque frappe dans la zone de collage, elle rajeunissait un rapport
     de cinq heures sans que personne ait réespionné. */
  if(r.res){ S.raid.m = r.res[0]; S.raid.c = r.res[1]; S.raid.d = r.res[2]; S.raid.at = Date.now(); }
  S.raid.safe = seNue(r.fleet) && seNue(r.def);
}
/** Fleet and outcome for a raid on the selected target. */
export function raidPlan(){
  const r = S.raid; if(!r) return null;
  /* Un rapport vieillit : la cible produit, et surtout elle peut avoir été
     pillée entre-temps. Au-delà de deux heures il ne décrit plus rien. */
  const stale = !r.at || Date.now()-r.at > 2*3600e3;
  /* Un raid se compose avec les transporteurs posés sur la planète de départ :
     la bonne planète est donc celle qui les a, pas celle qui porte une charge.
     Un centre désigné à la main sur une colonie neuve donnerait sinon un plan
     de raid sans vaisseaux, et il le dirait en silence. */
  const home = S.planets[cargoHomeIndex()], res = [+r.m||0, +r.c||0, +r.d||0];
  /* Le rapport affiche lui-même le taux de butin, et il est juste : la
     déduction par la classe ignore le statut d'honneur de la cible, que le
     jeu, lui, a déjà appliqué. Lu, on le prend ; sinon on déduit, et la carte
     dit laquelle des deux elle montre. */
  const rateSeen = typeof r.lootSeen === 'number';
  const rate = rateSeen ? r.lootSeen : (S.settings.cls==='explorer' ? .75 : .5);
  const loot = res.map(x=>Math.floor(x*rate)), need = loot[0]+loot[1]+loot[2];
  /* Ce que la défense lue vaut, au prix que le copilote emploie pour décider
     de celle du joueur. Deux nombres lus posés côte à côte : aucune simulation,
     aucun seuil inventé, et c'est le joueur qui tranche.
     Les missiles n'y entrent pas, comme les satellites n'entrent pas dans la
     flotte : ils ne tirent pas sur une flotte, donc ils ne pèsent sur aucune
     décision. Ils restent reconnus, pour que leur présence ne rende pas la
     section illisible. */
  const defVue = r.def ? Object.entries(r.def).filter(([k,n])=>DEF[k] && n>0) : null;
  const defValue = defVue ? mse(...[0,1,2].map(j=>defVue.reduce((a,[k,n])=>a+DEF[k].c[j]*n, 0))) : null;
  const defList = defVue && defVue.length ? shipList(Object.fromEntries(defVue)) : null;
  const flotteVue = r.fleet ? Object.entries(r.fleet).filter(([k,n])=>SE_BAT[k] && n>0) : null;
  /* Nommée, jamais chiffrée : une flotte qui tire suffit à dire non, et la
     chiffrer demanderait les coûts des coques de combat — une table entière
     pour une phrase qui ne changerait aucune décision. */
  const fleetList = flotteVue && flotteVue.length ? shipList(Object.fromEntries(flotteVue)) : null;
  const av = home.ships||{}, lcC = shipStats('lc').cargoEff, scC = shipStats('sc').cargoEff;
  let left = need; const lc = Math.min(av.lc||0, Math.ceil(left/lcC)); left -= lc*lcC; const sc = left>0 ? Math.min(av.sc||0, Math.ceil(left/scC)) : 0; left -= sc*scC;
  const ships = {}; if(lc) ships.lc = lc; if(sc) ships.sc = sc;
  const fl = (lc||sc) ? flight(home.coords, r.coords, ships, 100) : null;
  const fuel = fl ? fl.fuel*2 : 0, cargo = souteUtile(lc*lcC + sc*scC, fuel), got = Math.min(need, cargo);
  return {home, loot, need, ships, fl, cargo, got, fuel, stale, short: Math.max(0,left), net: got - fuel*S.settings.ratio[0]/S.settings.ratio[2],
    rate, rateSeen, defValue, defList, fleetList, defKnown: r.def != null, fleetKnown: r.fleet != null,
    /* Le butin dans la même unité que la défense : `need` est une somme brute,
       et la comparer à un équivalent métal inversait le verdict sur une cible
       riche en cristal ou en deutérium. */
    lootValue: mse(...loot)};
}
