/* ---------- la production ----------
   Ce que rapporte une planète à l'heure (`production`, `prodOf`), ce que
   retirent le bridage et ce qu'ajoute la forme de vie (`bridage`,
   `lfBonusOf`, `LF_READ_TTL`), sa valeur en métal (`mse`, `NOM_RES`), le
   stock au moment présent et l'attente avant de pouvoir payer (`stockNow`,
   `waitFor`, `storageShort`, `storageNote`, `reqOk`, `upLabel`), le labo et
   la durée d'une recherche (`labPlanet`, `labLevel`, `labEffectif`,
   `researchTime`).

   Domaine de l'issue #49. Il n'importe que le noyau, la flotte pour lire des
   coordonnées, et deux noms d'app.js (`planetById`, `centrePlanet`), lus à
   l'appel et jamais au chargement : ce cycle-là est toléré tant qu'app.js
   existe. `LF_READ_TTL` vit ici et non dans les formes de vie, qui emploient
   la production : l'inverse fermerait une boucle. */
import { S } from '../core/etat.js';
import { num } from '../core/format.js';
import {
  B_SHORT, T, levelCost, storageCap, storageLevelFor, crawlerMax,
  crawlerBonus, CRAWLER_ENERGY, MINES_PCT, POS_BONUS_M, POS_BONUS_C,
  satEnergy
} from '../core/formules.js';
import { ecoSpeed, researchDiv } from '../core/serveur.js';
import { parseC } from '../flotte/vaisseaux.js';
import { planetById, centrePlanet } from '../../app.js';
/* Le bonus de forme de vie lu dans le panneau décrit les niveaux du moment :
   au-delà de sept jours on le laisse, mieux vaut sous-estimer que décrire un
   empire qui n'existe plus. */
export const LF_READ_TTL = 7*86400e3;
/* Le centre d'abord : une recherche se lance depuis une planète, et c'est son
   labo à elle qui en fixe la durée et les prérequis. Sans centre — joueur de
   flotte, planète unique — on retombe sur le plus haut labo de l'empire,
   c'est-à-dire sur le comportement d'avant. */
/** La planète de recherche habituelle : celle d'où la dernière recherche est
    partie, sinon le centre. C'est à elle que « recherche à l'arrêt » se rattache. */
export function planeteRecherche(){ return planetById(S.rechPid) || labPlanet(); }
export function labPlanet(){ return centrePlanet() || S.planets.reduce((a,p)=>(!a || p.b.lab>a.b.lab) ? p : a, null); }
/* Le labo du centre, et non plus le maximum de l'empire : les deux
   coïncidaient tant que le centre était par construction la planète du plus
   haut labo, et ils divergent dès que le joueur reprend la main. Annoncer le
   maximum ferait promettre une durée que le jeu ne tiendra pas, et lancer une
   recherche depuis un labo trop petit. */
export function labLevel(){ const p = labPlanet(); return p ? (p.b.lab || 0) : 0; }
/**
 * Le niveau de labo qui décide de la VITESSE d'une recherche, Réseau compris.
 * Le Réseau de recherche intergalactique relie les N meilleurs labos des autres
 * planètes à celui d'où part la recherche, N étant son niveau : la durée se
 * calcule sur la somme. Page officielle de Gameforge : « Effective Lab Level =
 * Main Lab Level + Sum of N highest Colony Lab Levels (N = IRN Level) », avec
 * l'exemple 15 + 4×12 = 63.
 *
 * Il ne faut pas confondre avec `labLevel()`, qui décide de ce qui est
 * DÉBLOQUÉ : un prérequis est une propriété de la planète, et le Réseau n'aide
 * jamais à le remplir. Les deux questions passaient par la même fonction, donc
 * les labos des autres planètes ne servaient à rien.
 *
 * ponytail: aucune source lisible ne donne de niveau minimum pour qu'un labo
 * compte, ni le sort des lunes (le wiki fandom répond 402) ; on somme les N
 * plus hauts tels quels. À reprendre si le jeu dit autre chose.
 * Lit `S.planets`, donc marche aussi sur l'empire simulé que `simulateDay`
 * met à la place : ses copies portent `b`, le seul champ touché ici.
 * @returns {number} niveau de labo effectif
 */
export function labEffectif(){
  const p = labPlanet(); if(!p) return 0;
  const mien = p.b.lab || 0;
  const n = Math.max(0, Math.trunc(+S.tech.irn) || 0);
  if(!n) return mien;
  const autres = S.planets.filter(x => x !== p).map(x => x.b.lab || 0).sort((a,b) => b-a);
  return mien + autres.slice(0, n).reduce((a,b) => a+b, 0);
}
/** Research time in seconds. */
export function researchTime(key, L){
  const c = levelCost(T[key], L);
  let h = (c[0]+c[1]) / (1000 * (1+labEffectif()) * ecoSpeed() * researchDiv());
  if(S.settings.cls==='explorer') h *= .75;
  return Math.max(1, h*3600);
}
/**
 * Lit le texte du panneau « Paramétrage de la production » publié par content.js.
 * Le texte vient de la page : tout nombre qui pourrait borner une boucle ou
 * dimensionner quoi que ce soit est borné ici (comptes à 1e6, niveaux à 999).
 * @param {string} text texte brut du panneau, une ligne par rangée, cellules séparées par des tabulations
 * @returns {object|null} la forme de S.prod[gid] (sans `at`), ou null si « Total par heure » est absent
 */
export function parseProdPanel(text){
  if(typeof text !== 'string' || text.length > 20000) return null;
  const clamp = (n, hi) => Math.max(0, Math.min(hi, n));
  // « 37.297 » → 37297, « -1.554 » → -1554 ; « 2M » (troncature du jeu) et tout le reste → null
  const num = c => /^-?\d{1,3}(\.\d{3})*$|^-?\d{1,12}$/.test(c || '') ? +c.replace(/\./g, '') : null;
  const out = {at:0, factor:1, base:[0,0,0], lfBonus:[0,0,0,0], caps:[null,null,null], crawlerMax:0, energy:null, rows:[]};
  const fm = text.match(/Facteur de production\s*:\s*(\d{1,4})\s*%/i);
  if(fm) out.factor = clamp(+fm[1] / 100, 10);
  for(const line of text.split('\n').slice(0, 200)){
    const cells = line.split(/\t|\s{2,}/).map(c => c.trim()).filter(Boolean);
    if(cells.length < 2) continue;
    const label = cells[0], v = cells.slice(1, 5).map(num);
    if(/^Total par heure/i.test(label)){
      const em = (cells[4] || '').match(/^(-?[\d.]+)\/([\d.]+)$/);
      if(em) out.energy = {free:num(em[1]), prod:num(em[2])};
      // Ce que le jeu annonce vraiment par heure : la mesure contre laquelle le moteur se cale.
      out.perHour = v.slice(0, 3);
      out.total = true;
    }else if(/^Revenu de base/i.test(label)) out.base = v.slice(0, 3).map(x => x || 0);
    else if(/^Bonus technologique/i.test(label)) out.lfBonus = v.map(x => x || 0);
    else if(/^Capacit/i.test(label)) out.caps = v.slice(0, 3);
    else{
      const lv = label.match(/\(Niveau\s*(\d{1,4})\)/i), nb = label.match(/\(Nombre\s*:\s*(\d{1,9})(?:\s*\/\s*(\d{1,9}))?\)/i);
      const pct = (cells[5] || '').match(/^(\d{1,4})\s*%$/);
      const max = nb && nb[2] != null ? clamp(+nb[2], 1e6) : null;
      if(/^Foreuse/i.test(label) && max != null) out.crawlerMax = max;
      out.rows.push({label, lvl: lv ? clamp(+lv[1], 999) : null, n: nb ? clamp(+nb[1], 1e6) : null, max,
        v: v.map(x => x == null ? 0 : x), pct: pct ? clamp(+pct[1], 1000) : null});
    }
  }
  if(!out.total || !out.energy) return null;
  delete out.total;
  return out;
}

/**
 * Relevé du panneau de production d'une planète, clé stricte sur son gid.
 * @param {object} p planète de S.planets
 * @returns {object|undefined} undefined si cette planète n'a jamais ouvert le panneau
 */
export function prodOf(p){
  const k = p && p.gid;
  return k && S.prod && Object.prototype.hasOwnProperty.call(S.prod, k) ? S.prod[k] : undefined;
}


/**
 * Bonus de forme de vie lu dans le panneau de production, tel que le jeu l'affiche :
 * un montant horaire fixe [m, c, d, énergie]. Rien si la lecture manque ou a plus
 * de sept jours ; chaque valeur est ramenée à un nombre fini et positif.
 * @param {object} p planète de S.planets
 * @returns {number[]|null}
 */
function lfBonusOf(p){
  const r = prodOf(p);
  if(!r || !Array.isArray(r.lfBonus) || !(Date.now() - r.at < LF_READ_TTL)) return null;
  return [0,1,2,3].map(i => { const v = Number(r.lfBonus[i]); return Number.isFinite(v) ? Math.min(Math.max(v, 0), 1e9) : 0; });
}

/**
 * Mines bridées à la main dans le jeu, d'après le dernier relevé du panneau de
 * production : le pourcentage le plus bas, et l'énergie qu'il faudrait en plus
 * pour les remettre toutes à 100 %. Cette énergie est l'écart entre la
 * consommation pleine d'une mine (10 ou 20 × N × 1,1^N) et celle que sa ligne
 * affiche, bridage compris.
 * @param {object} p planète de S.planets
 * @returns {{min:number, extra:number}|null} null sans relevé récent ou si rien n'est bridé
 *
 * ponytail: le bridage sert à avertir, pas à chiffrer : production() compte
 * toujours les mines à 100 %, donc les débits annoncés sont optimistes tant
 * qu'elles sont bridées. À brancher sur production() si le bridage dure.
 */
export function bridage(p){
  const r = prodOf(p);
  if(!r || !(Date.now() - r.at < LF_READ_TTL)) return null;
  let min = 100, extra = 0;
  for(const row of r.rows || []){
    const coef = (MINES_PCT.find(x => x[0].test(row.label)) || [])[1];
    const e = Number((row.v || [])[3]);
    // e est la consommation affichée, négative ; une ligne sans colonne énergie
    // lisible ne dit rien du bridage et ne compte pas.
    if(coef == null || row.lvl == null || !(row.pct < 100) || !Number.isFinite(e) || e > 0) continue;
    min = Math.min(min, row.pct);
    extra += Math.max(0, Math.ceil(coef*row.lvl*Math.pow(1.1, row.lvl)) + e);
  }
  return min < 100 ? {min, extra} : null;
}

/** Hourly production and energy balance for a planet, with optional level overrides. */
export function production(p, ov){
  const b = Object.assign({}, p.b, ov||{}), s=S.settings, e=ecoSpeed(), t=S.tech;
  const g = L => L*Math.pow(1.1,L);
  /* Une foreuse produit et consomme comme une mine : elle entre dans le même
     bilan, sinon son bonus serait gratuit et le classement la mettrait en tête
     pour de mauvaises raisons. */
  const nCraw = Math.min(Math.max(0, (ov && ov.crawlers != null) ? ov.crawlers : (p.crawlers||0)),
                         crawlerMax(b.metal, b.crystal, b.deut));
  const surcharge = p.overload != null ? p.overload : !!s.crawlerOverload;
  const craw = crawlerBonus(nCraw, s.cls, surcharge);
  let eProd = Math.floor(20*g(b.solar)) + Math.floor(30*b.fusion*Math.pow(1.05+0.01*t.energy, b.fusion)) + p.sats*satEnergy(p.tmax);
  let eBonus = 1 + (s.cls==='collector'?.1:0) + (s.eng?.1:0);
  eProd = Math.floor(eProd*eBonus) + (p.eAdj||0);
  const lf = lfBonusOf(p) || [0,0,0,0];
  eProd += Math.floor(lf[3]);
  const eCons = Math.ceil(10*g(b.metal)) + Math.ceil(10*g(b.crystal)) + Math.ceil(20*g(b.deut)) + nCraw*CRAWLER_ENERGY*(surcharge?2:1);
  const factor = eCons===0 ? 1 : Math.max(0, Math.min(1, eProd/eCons));
  const common = (s.cls==='collector'?.25:0) + (s.geo?.1:0) + craw;
  const pos = (parseC(p.coords)||[])[2]||0, posM = POS_BONUS_M[pos]||0, posC = POS_BONUS_C[pos]||0;
  /* L'écart que le jeu a mesuré et que la formule n'explique pas : bridage
     d'une mine à la main, bonus d'officier, tout ce qui ne se lit pas dans les
     niveaux. Additif, donc il survit à une montée simulée — c'est ce qui permet
     de comparer deux montées entre elles sans que la calibration les fausse. */
  const adj = Array.isArray(p.pAdj) ? p.pAdj : [0,0,0];
  const m = 30*e + 30*g(b.metal)*e*factor*(1 + .01*t.plasma + common + posM) + lf[0] + (+adj[0]||0);
  const c = 15*e + 20*g(b.crystal)*e*factor*(1 + .0066*t.plasma + common + posC) + lf[1] + (+adj[1]||0);
  const dRaw = 10*g(b.deut)*(1.44 - .004*p.tmax)*e*factor*(1 + .0033*t.plasma + common);
  const dFus = 10*g(b.fusion)*e;
  return {m, c, d:dRaw - dFus + lf[2] + (+adj[2]||0), eProd, eCons, eBal:eProd-eCons, factor,
          cap:[storageCap(b.smetal), storageCap(b.scrystal), storageCap(b.sdeut)]};
}
export function mse(m,c,d){ const r=S.settings.ratio; return m + c*r[0]/r[1] + d*r[0]/r[2]; }

/* ---------- ce qui manque à l'empire ---------- */
export const NOM_RES = ['métal', 'cristal', 'deutérium'];
/* ---------- les stocks et l'attente ---------- */
export function stockNow(p){
  const pr = production(p), h = (Date.now()-p.stock.at)/36e5;
  return [Math.min(Math.max(p.stock.m, pr.cap[0]), p.stock.m + pr.m*h),
          Math.min(Math.max(p.stock.c, pr.cap[1]), p.stock.c + pr.c*h),
          Math.min(Math.max(p.stock.d, pr.cap[2]), p.stock.d + pr.d*h)];
}
/**
 * Délai avant que `cost` soit payable sur la planète p.
 * Un coût plus grand qu'un hangar n'est pas impossible : la production locale
 * s'y arrête, pas une livraison. `small` nomme alors les deux sorties — le
 * niveau de hangar qui logerait le montant, ou un transport calé juste avant.
 * @returns {{sec:number, storage?:number, small?:object[]}}
 */
export function waitFor(p, cost){
  const st = stockNow(p), pr = production(p), rates=[pr.m,pr.c,pr.d], sk=['smetal','scrystal','sdeut'];
  let w = 0; const small = [];
  for(let i=0;i<3;i++){
    if(cost[i] > pr.cap[i]) small.push({res:i, k:sk[i], lvl:storageLevelFor(cost[i])});
    const miss = cost[i]-st[i];
    if(miss>0) w = Math.max(w, rates[i]>0 ? miss/rates[i]*3600 : Infinity);
  }
  return small.length ? {sec:Infinity, storage:small[0].res, small} : {sec:w};
}
/** Les hangars à atteindre, nommés : « Hangar C 5 ». */
function storageShort(w){ return (w.small||[]).map(x=>`${B_SHORT[x.k]} ${x.lvl}`).join(' et '); }
/** La phrase complète, avec l'autre sortie. */
export function storageNote(w){
  const l = storageShort(w);
  return l ? `Hangar trop petit : ${l}, ou fais arriver le transport juste avant de lancer — une livraison n'est pas plafonnée.`
           : 'Hangar trop petit pour ce coût.';
}
export function reqOk(req, p){
  const miss=[];
  if(!req) return miss;
  if(req.lab && labLevel()<req.lab) miss.push(`Labo ${req.lab}`);
  if(req.b) for(const [k,v] of Object.entries(req.b)) if(!p || p.b[k]<v) miss.push(`${B_SHORT[k]} ${v}`);
  if(req.t) for(const [k,v] of Object.entries(req.t)) if(S.tech[k]<v) miss.push(`${T[k].n.replace('Technologie ','')} ${v}`);
  return miss;
}

/** Le libellé d'une option du classement : une mine a un niveau, les foreuses un nombre. */
export function upLabel(u){ return u.key==='crawl' ? `${u.n} foreuse${u.n>1?'s':''} (${u.lvl} en tout)` : `${B_SHORT[u.key]} ${u.lvl}`; }
