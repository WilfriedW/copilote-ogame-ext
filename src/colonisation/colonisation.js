/* ---------- la colonisation ----------
   Les kits du vaisseau de colonisation (`KITS`, `OBJECTIVES` ; le
   vaisseau lui-même, `COL_SHIP_COST`, est dans src/flotte/coques.js), le nombre de planètes permis (`maxPlanets`), d'où
   partir et où aller (`coloFrom`, `coloSystem`, `rankPositions`,
   `bestPosition`, `coloTarget`), la flotte qu'il faut (`coloFleet`,
   `colShipAt`, `colSentNow`, `colBuilt`), ce que la colonie rapporte et en
   combien de temps (`colonyPayback`, `coloPaybackTxt`, `COLO_HORIZON_H`), et
   le verdict sur une position (`coloVerdict`), et les positions libres que
   l'API publique propose (`colonyCandidates`).

   Domaine de l'issue #49. Il lit le noyau, l'univers, la flotte et la
   production, et emprunte encore à app.js `rankUpgrades`,
   appelés et jamais lus au chargement. */
import { S } from '../core/etat.js';
import { fmt } from '../core/format.js';
import { B, rangeCost, POS } from '../core/formules.js';
import { API, ecoSpeed } from '../core/serveur.js';
import { dur } from '../core/temps.js';
import { centrePlanet } from '../economie/centre.js';
import { production, mse, waitFor } from '../economie/production.js';
import { COL_SHIP_COST, shipTime } from '../flotte/coques.js';
import { parseC, shipStats, flight } from '../flotte/vaisseaux.js';
import { wrapSys, occupied, myScore, isInactive, isActive } from '../univers/univers.js';
import { planetById, rankUpgrades } from '../../app.js';

/* ---------- colonization ---------- */
export const KITS = {
  none: {n:'Aucun', lv:{}},
  light:{n:'Léger', lv:{metal:5, crystal:4, deut:2, solar:5}},
  std:  {n:'Standard', lv:{metal:8, crystal:6, deut:4, solar:8, robot:2}},
  fast: {n:'Rapide', lv:{metal:12, crystal:10, deut:6, solar:12, robot:4, shipyard:2}},
  big:  {n:'Avancé', lv:{metal:15, crystal:13, deut:9, solar:15, robot:6, shipyard:4}},
};
export const OBJECTIVES = {
  balanced:{n:'Équilibré', w:{prod:.5, fields:.5}},
  metal:   {n:'Métal', w:{metal:.75, fields:.25}},
  crystal: {n:'Cristal', w:{crystal:.75, fields:.25}},
  deut:    {n:'Deutérium', w:{deut:.7, fields:.3}},
  big:     {n:'Grande planète', w:{fields:.8, prod:.2}},
};
/** Index of a planet that already has a colony ship docked, or -1. */
export function colShipAt(){ return S.planets.findIndex(p=>((p.ships||{}).col||0)>0); }
/** True when a colonize mission is already flying or was marked as sent. */
export function colSentNow(){ return (S.moves||[]).some(m=>m.mission===7 && !m.ret && m.arrival*1000>Date.now()) || !!(S.colo.sentAt && Date.now()-S.colo.sentAt<48*3600e3 && !S.planets.some(p=>((p.ships||{}).col||0)>0 && (p.shipsAt||0)>S.colo.sentAt)); }
export function colBuilt(){ return !!S.colo.built || colShipAt()>=0; }
export function maxPlanets(){ return 1 + Math.floor((S.tech.astro+1)/2); }
/* Un vaisseau déjà à quai est un fait et passe devant tout ; sinon la colonie
   part du centre, puisque c'est lui que le plan fait construire. Deux leviers
   se contredisaient : le plan sortait le vaisseau du centre et annonçait la
   durée de vol de la planète du select, cent systèmes plus loin. */
export function coloFrom(){ const i = colShipAt(); return (i>=0 ? S.planets[i] : centrePlanet() || planetById(S.colo.fromId)) || S.planets[0]; }
export function coloSystem(){ const c = parseC(coloFrom().coords) || [1,1,8]; return c; }
/** Simulated hourly output of a colony at each position, using the departure planet's mine levels. */
export function rankPositions(){
  const dp = coloFrom(), [g,sy] = coloSystem(), o = OBJECTIVES[S.colo.objective] || OBJECTIVES.balanced, bonus = +S.colo.bonus || (API && API.server && API.server.bonusFields) || 0;
  const rows = [];
  for(let pos=1; pos<=15; pos++){
    const P = POS[pos];
    const fake = {coords:`${g}:${sy}:${pos}`, tmax:P.t, sats:0, b:Object.assign({}, dp.b)};
    const pr = production(fake);
    rows.push({pos, P, fields:P.avg+bonus, min:P.min+bonus, max:P.max+bonus, m:pr.m, c:pr.c, d:pr.d, v:mse(pr.m,pr.c,pr.d), ok:S.tech.astro>=P.astro});
  }
  const mx = k => Math.max(...rows.map(r=>r[k]), 1);
  const M = {prod:mx('v'), metal:mx('m'), crystal:mx('c'), deut:mx('d'), fields:mx('fields')};
  for(const r of rows){
    r.score = (o.w.prod||0)*r.v/M.prod + (o.w.metal||0)*r.m/M.metal + (o.w.crystal||0)*r.c/M.crystal + (o.w.deut||0)*r.d/M.deut + (o.w.fields||0)*r.fields/M.fields;
  }
  const ranked = rows.filter(r=>r.ok).sort((a,b)=>b.score-a.score);
  ranked.forEach((r,i)=>r.rank=i+1);
  return rows;
}
function bestPosition(){ const r = rankPositions().filter(x=>x.ok).sort((a,b)=>b.score-a.score)[0]; return r ? r.pos : 8; }
export function coloTarget(){ if(parseC(S.colo.target)) return S.colo.target; const c = API && API.planets ? colonyCandidates()[0] : null; if(c) return c.coords; const [g,sy] = coloSystem(); return `${g}:${sy}:${bestPosition()}`; }
/** Starter kit cost and the fleet that delivers it. */
export function coloFleet(){
  const dp = coloFrom(), kit = KITS[S.colo.kit] || KITS.std, target = coloTarget();
  const kitCost = [0,0,0];
  for(const [k,L] of Object.entries(kit.lv)){ const c = rangeCost(B[k], 0, L); kitCost[0]+=c[0]; kitCost[1]+=c[1]; kitCost[2]+=c[2]; }
  const col = shipStats('col'), tr = shipStats(S.colo.tr);
  const total = kitCost[0]+kitCost[1]+kitCost[2];
  const inCol = Math.min(total, col.cargoEff);
  const f = total ? inCol/total : 0;
  const colLoad = kitCost.map(x=>Math.floor(x*f));
  const rest = kitCost.map((x,i)=>x-colLoad[i]);
  const restSum = rest[0]+rest[1]+rest[2];
  const n = restSum>0 ? Math.ceil(restSum/tr.cargoEff) : 0;
  const leg1 = flight(dp.coords, target, {col:1}, 100);
  const leg2 = n ? flight(dp.coords, target, {[S.colo.tr]:n}, 100) : null;
  const fuel = (leg1 ? leg1.fuel : 0) + (leg2 ? leg2.fuel*2 : 0);
  const ship = colBuilt() ? [0,0,0] : COL_SHIP_COST;
  const need = [ship[0]+kitCost[0], ship[1]+kitCost[1], ship[2]+kitCost[2]+fuel];
  const shipTime = colBuilt() ? 0 : (COL_SHIP_COST[0]+COL_SHIP_COST[1]) / (2500*(1+dp.b.shipyard)*Math.pow(2,dp.b.nanite)*ecoSpeed()) * 3600;
  return {dp, kit, kitCost, colLoad, rest, n, tr, col, leg1, leg2, fuel, need, shipTime, target, wait:waitFor(dp, need)};
}
/** Verdict on a freshly colonized planet's size. */
/* Tant qu'on ignore le vaisseau, le trajet et les semaines de mines qu'il faut
   pour qu'une colonie produise, « amorti en moins d'un jour » est un slogan.
   Au-delà de cet horizon un niveau de mine n'est plus ce que la colonie a de
   plus pressé : elle commence à rendre ce qu'elle a coûté. */
export const COLO_HORIZON_H = 7*24;
/**
 * Délai de retour d'une colonie, en heures, simulé au lieu d'être supposé :
 * construction du vaisseau, trajet, puis montée des mines au même classement
 * que pour une planète existante, et enfin le temps qu'il faut à sa production
 * pour rendre la mise de départ.
 * @param {number} [pos] position visée ; par défaut celle de la cible choisie
 * @returns {{hours:number, ramp:number, upfront:number, rate:number, b:object}|null}
 */
export function colonyPayback(pos){
  const F = coloFleet();
  const p = pos || (parseC(F.target) || [])[2] || bestPosition();
  const P = POS[p]; if(!P) return null;
  const b = Object.assign(Object.fromEntries(Object.keys(B).map(k=>[k,0])), F.kit.lv);
  const colo = {coords:`1:1:${p}`, tmax:P.t, sats:0, b};
  const upfront = mse(...F.need);
  // Avant la première ressource : le vaisseau se construit, puis il vole.
  let h = (F.shipTime + (F.leg1 ? F.leg1.secs : 0)) / 3600;
  for(let step = 0; step < 200; step++){
    const pr = production(colo), rate = mse(pr.m, pr.c, pr.d);
    if(rate <= 0) return null;
    /* Au cours du ratio, pas au besoin de l'empire : cette simulation sert à
       comparer des POSITIONS entre elles, et une comparaison demande une règle
       fixe. Pondérer la montée par un mélange que cette colonie n'a pas encore
       changé mesurerait chaque position avec une règle différente — la plus
       froide gagnerait pour la seule raison qu'il manque du deutérium ailleurs. */
    const u = rankUpgrades(colo).sort((a,b) => a.payback - b.payback)
      .find(x => B[x.key] && x.payback < COLO_HORIZON_H);
    if(!u) break;
    // Elle paie son niveau suivant avec sa propre production, puis le monte.
    h += mse(...u.cost)/rate + u.time/3600;
    colo.b[u.key] = u.lvl;
    if(u.extraSolar) colo.b.solar += u.extraSolar;
  }
  const pr = production(colo), rate = mse(pr.m, pr.c, pr.d);
  if(rate <= 0) return null;
  return {hours: h + upfront/rate, ramp: h, upfront, rate, b:colo.b};
}
/** Le délai de retour d'une colonie, dit en une phrase, ou rien si incalculable. */
export function coloPaybackTxt(){
  const cp = colonyPayback(); if(!cp) return '';
  return `Simulé : ${fmt(cp.upfront)} éq. de mise (vaisseau, kit, carburant), `
    + `${dur(cp.ramp*3600)} pour que ses mines montent toutes seules jusqu'à ${fmt(cp.rate)} éq./h, `
    + `et la mise est rendue en ${dur(cp.hours*3600)} en tout.`;
}
export function coloVerdict(fields, pos){
  const P = POS[pos]; if(!P || !fields) return null;
  const avg = P.avg + (+S.colo.bonus||0), r = fields/avg;
  if(r >= 1) return {sev:'good', t:'Garde-la', why:`${fields} cases, au-dessus de la moyenne de la position ${pos} (${avg}).`};
  if(r >= .88) return {sev:'warn', t:'Correcte', why:`${fields} cases pour une moyenne de ${avg}. Garde-la si tu ne veux pas perdre de temps.`};
  return {sev:'bad', t:'Trop petite : recolonise', why:`${fields} cases pour une moyenne de ${avg}. Abandonne-la avant d'y construire et renvoie un vaisseau (coût ${fmt(COL_SHIP_COST[0])} M, ${fmt(COL_SHIP_COST[1])} C, ${fmt(COL_SHIP_COST[2])} D).`};
}
/** Free colony slots near home, ranked by position value, distance and neighbourhood. */
export function colonyCandidates(){
  if(!API || !API.planets) return [];
  const home = parseC(coloFrom().coords); if(!home) return [];
  const occ = occupied(), me = myScore() || 0, R = 15;
  const posScore = {}; rankPositions().forEach(r=>posScore[r.pos]=r);
  const maxScore = Math.max(...Object.values(posScore).map(r=>r.score), 1e-9);
  const out = [];
  for(let d=-R; d<=R; d++){
    const sys = wrapSys(home[1]+d), neigh = {strong:0, active:0, inactive:0};
    for(let q=1;q<=15;q++){ const pl = occ.get(`${home[0]}:${sys}:${q}`); if(!pl || pl===S.me) continue; const P = API.players[pl]||['','']; const sc = (API.scores[pl]||[0])[0]; if(isInactive(P[1])) neigh.inactive++; else if(isActive(P[1])){ neigh.active++; if(sc > Math.max(me*5, 10000)) neigh.strong++; } }
    for(let pos=1; pos<=15; pos++){
      const r = posScore[pos]; if(!r || !r.ok) continue;
      const coords = `${home[0]}:${sys}:${pos}`; if(occ.has(coords)) continue;
      const dist = Math.abs(d), score = .75*r.score/maxScore + .25*(1-dist/R) - .04*neigh.strong + .02*Math.min(neigh.inactive,3);
      out.push({coords, pos, dist, fields:r.fields, bonus:r.P.bonus, v:r.v, neigh, score});
    }
  }
  return out.sort((a,b)=>b.score-a.score);
}
