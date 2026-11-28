/* ---------- la flotte cible ----------
   Chaque planète devrait pouvoir lancer une expédition et lever son stock le
   soir, seule, sans calcul de répartition. Ce module dit, planète par planète,
   la flotte qui le permet — la « flotte cible » — et ce qu'il faut déplacer
   pour s'en rapprocher.

   L'ordre de calcul est celui de la demande, et il arbitre tous les manques :
   1. le kit noyau (sonde, Éclaireur, gros vaisseau) sur toutes les planètes,
      les plus productives servies d'abord ;
   2. autant de kits complets que d'emplacements d'expédition, composés par
      `expoFleet` — jamais par une copie de ses règles ;
   3. la soute du soir, au prorata des besoins quand elle manque ;
   4. le combat restant, à parts égales.

   Module ES, comme src/meteo.js : il importe d'app.js (S, expoFleet,
   shipStats, mouvements…), qui l'importe en retour, et n'y touche qu'à l'appel.
   Lecture seule : rien ici n'envoie ni ne clique. Les cartes passent par les
   liens « Préparer » du panneau, et l'envoi reste le clic du joueur. */

import { S } from '../core/etat.js';
import { fmtLigne, fmt, esc, num, planetRef, fmtCourt } from '../core/format.js';
import { dur, formatTime } from '../core/temps.js';
import { production, mse, stockNow } from '../economie/production.js';
import { EXPO_GROS, expoRes, expoFleet, expoCap } from './expeditions.js';
import {
  SHIPS, souteUtile, shipStats, flight, shipList, SHIP_COURT, shipCourt,
  mcd, planeteEn, mouvements, aQuai
} from './vaisseaux.js';
import { projectResources } from '../plan/journee.js';
import { secu, prochaineHeure, attaquesEntrantes, transportSuggere } from '../securite/securite.js';
import { tab, aide } from '../vues/navigation.js';

/** Les transporteurs : ce qui compte dans la soute du soir. */
const FC_SOUTE = ['lc', 'sc'];
/** Ce qui ne se répartit pas : un recycleur ou un vaisseau de colonisation sert là où il est. */
const FC_GARDE = ['rec', 'col'];
/** Seuil par défaut d'une carte Rééquilibrer : soute sous 80 % de sa cible. */
const FC_SEUIL = 80;

/** Le seuil réglé, en pourcent, borné à 1–100. */
function fcSeuil(){ return Math.min(100, Math.max(1, Math.round(num(S.settings.reeqSeuil, FC_SEUIL)))); }

/** a + b, type par type, sans les zéros. */
function fcPlus(a, b){ const o = Object.assign({}, a); for(const [k, n] of Object.entries(b || {})) if(n) o[k] = (o[k] || 0) + n; return fcNet(o); }
/** a − b, type par type, jamais sous zéro. */
function fcMoins(a, b){ const o = Object.assign({}, a); for(const [k, n] of Object.entries(b || {})) o[k] = Math.max(0, (o[k] || 0) - n); return fcNet(o); }
/** Sans les types à zéro. */
function fcNet(o){ return Object.fromEntries(Object.entries(o || {}).filter(([, n]) => n > 0)); }
/** La soute d'une flotte, transporteurs seulement, à leur capacité réelle. */
function fcSouteDe(ships){ return FC_SOUTE.reduce((a, k) => a + ((ships || {})[k] || 0) * shipStats(k).cargoEff, 0); }

/**
 * Répartit `n` unités selon des poids, à l'unité près (plus forts restes).
 * À reste égal, l'ordre de `rang` passe devant : la planète la plus productive.
 * Sans poids, à parts égales.
 */
function fcRepartit(n, poids, rang){
  const out = poids.map(() => 0); n = Math.max(0, Math.floor(n));
  if(!n || !poids.length) return out;
  const tot = poids.reduce((a, w) => a + Math.max(0, w), 0);
  const w = tot > 0 ? poids.map(x => Math.max(0, x) / tot) : poids.map(() => 1 / poids.length);
  const ex = w.map(x => x * n);
  ex.forEach((x, i) => out[i] = Math.floor(x + 1e-9));
  let reste = n - out.reduce((a, x) => a + x, 0);
  const ordre = ex.map((x, i) => i).sort((a, b) => (ex[b] - out[b]) - (ex[a] - out[a]) || rang[a] - rang[b]);
  for(let j = 0; reste > 0; j = (j + 1) % ordre.length, reste--) out[ordre[j]]++;
  return out;
}

/**
 * La flotte cible de l'empire. Fonction pure sur son entrée, à ceci près
 * qu'elle compose les expéditions avec `expoFleet` et lit la soute réelle des
 * transporteurs avec `shipStats` : la même composition que le bloc Expéditions.
 *
 * @param {object} empire
 * @param {Array<{id:string, ships:object, prod:number, besoin:number, reserve:number}>} empire.planets
 *   `ships` la flotte actuelle (au sol et en vol vers la planète), `prod` la
 *   production horaire en équivalent métal, `besoin` le stock prévu à l'heure
 *   de la mise à l'abri (M + C + D), `reserve` la réserve de grands transporteurs.
 * @param {number} empire.nKits emplacements d'expédition
 * @param {string} [empire.cls] la classe du joueur
 * @returns {{par:Object<string, object>, manqueGT:number, gros:string|null, nKits:number}}
 */
function fleetTarget(empire){
  const P = empire.planets || [], nKits = Math.max(0, Math.floor(empire.nKits || 0));
  const par = {};
  /* Le rang de production : il départage tous les manques. */
  const rangs = P.map((p, i) => i).sort((a, b) => (P[b].prod || 0) - (P[a].prod || 0) || a - b);
  const rang = P.map(() => 0); rangs.forEach((i, r) => rang[i] = r);
  let pool = {};
  for(const p of P) pool = fcPlus(pool, p.ships);
  const total = Object.assign({}, pool);
  for(const p of P) par[p.id] = {noyau:{ships:{}, manque:[]}, kits:[], kitComplet:false, soute:{}, combat:{}, cible:{}, autres:{}};

  /* 1. Kit noyau. Le gros vaisseau est le plus avancé que l'empire possède,
     dans l'ordre de expoFleet : un seul type pour toutes les planètes. */
  const gros = EXPO_GROS.find(k => (total[k] || 0) > 0) || null;
  const pfImpossible = empire.cls !== 'explorer';
  for(const i of rangs){
    const t = par[P[i].id];
    for(const k of ['pr', 'pf', gros || 'gros']){
      if(k !== 'gros' && (pool[k] || 0) > 0){ t.noyau.ships[k] = 1; pool[k]--; continue; }
      if(k === 'pr') t.noyau.manque.push('1 Sonde');
      else if(k === 'pf'){ t.noyau.manque.push('1 Éclaireur'); t.noyau.pfImpossible = pfImpossible; }
      else t.noyau.manque.push(gros ? `1 ${SHIPS[gros].n}` : '1 gros vaisseau');
    }
  }
  pool = fcNet(pool);

  /* 2. Kits complets : où ils demandent le moins de mouvements. La composition
     type sert au classement ; chaque kit est ensuite recomposé par expoFleet
     sur ce qui reste vraiment, plus le noyau de sa planète. La réserve n'est
     pas déduite ici (expoRes 0) : elle est comptée dans la soute, en plus. */
  const sansRes = {expoRes: 0};
  const unNoyau = fcNet({pr: total.pr ? 1 : 0, pf: total.pf ? 1 : 0, [gros || 'x']: gros ? 1 : 0});
  const type = expoFleet(fcPlus(pool, unNoyau), sansRes);
  const manqueKit = p => type ? Object.entries(type.ships).reduce((a, [k, n]) => a + Math.max(0, n - ((p.ships || {})[k] || 0)), 0) : 0;
  const ordreKits = P.map((p, i) => i).sort((a, b) => manqueKit(P[a]) - manqueKit(P[b]) || rang[a] - rang[b]);
  for(let j = 0; j < nKits && ordreKits.length; j++){
    const i = ordreKits[j % ordreKits.length], t = par[P[i].id];
    /* Le noyau de la planète entre dans son premier kit : ce sont les mêmes vaisseaux. */
    const avail = t.kits.length ? pool : fcPlus(pool, t.noyau.ships);
    const kit = expoFleet(avail, sansRes);
    if(!kit){ t.kits.push(null); continue; }
    pool = fcMoins(avail, kit.ships);
    t.kits.push(kit);
  }
  for(const p of P){
    const t = par[p.id];
    t.kitComplet = t.kits.length > 0 && t.kits.every(k => k && k.plein && k.cargo >= k.fret);
    t.kitShips = t.kits.reduce((a, k) => k ? fcPlus(a, k.ships) : a, {});
    t.noyauHorsKit = t.kits.length ? {} : t.noyau.ships;
  }

  /* 3. Soutes : ce qui reste de transporteurs. Le besoin de chaque planète est
     son stock du soir, et au moins sa réserve de grands transporteurs. */
  const lcC = shipStats('lc').cargoEff, scC = shipStats('sc').cargoEff;
  const besoin = P.map(p => Math.max(p.besoin || 0, (p.reserve || 0) * lcC));
  const sB = besoin.reduce((a, x) => a + x, 0);
  const C = (pool.lc || 0) * lcC + (pool.sc || 0) * scC;
  const sProd = P.reduce((a, p) => a + Math.max(0, p.prod || 0), 0);
  const capT = P.map((p, i) => sB > 0 ? besoin[i] * Math.min(1, C / sB) : 0)
    .map((x, i) => x + (C > sB ? (C - sB) * (sProd > 0 ? Math.max(0, P[i].prod || 0) / sProd : 1 / P.length) : 0));
  const manqueGT = sB > C && lcC > 0 ? Math.ceil((sB - C) / lcC) : 0;
  /* Les grands d'abord, au prorata de la cible ; les petits comblent ce qui
     reste à chacun. Un petit transporteur vaut sa soute, pas celle d'un grand. */
  const nLc = fcRepartit(pool.lc || 0, capT, rang);
  const resteSoute = capT.map((x, i) => Math.max(0, x - nLc[i] * lcC));
  const nSc = fcRepartit(pool.sc || 0, resteSoute.some(x => x > 0) ? resteSoute : capT, rang);
  P.forEach((p, i) => {
    const t = par[p.id];
    t.soute = {ships: fcNet({lc: nLc[i], sc: nSc[i]}), cible: Math.round(besoin[i]), besoin: Math.round(p.besoin || 0),
      couverte: Math.round(Math.min(besoin[i], nLc[i] * lcC + nSc[i] * scC))};
  });
  pool = fcMoins(pool, {lc: pool.lc || 0, sc: pool.sc || 0});

  /* 4. Le reste, type par type, à parts égales ; le reste de la division aux
     plus productives. Recycleurs et vaisseaux de colonisation ne bougent pas. */
  for(const [k, n] of Object.entries(pool)){
    if(FC_GARDE.includes(k)){
      for(const p of P){ const g = Math.min(n, (p.ships || {})[k] || 0); if(g) par[p.id].autres[k] = g; }
      continue;
    }
    const parts = fcRepartit(n, P.map(() => 1), rang);
    P.forEach((p, i) => { if(parts[i]) par[p.id].combat[k] = parts[i]; });
  }
  for(const p of P){
    const t = par[p.id];
    t.cible = [t.noyauHorsKit, t.kitShips, t.soute.ships, t.combat, t.autres].reduce(fcPlus, {});
    /* Ce qui part le soir : tout sauf le kit d'expédition, qui est en l'air. */
    t.soir = [t.noyauHorsKit, t.soute.ships, t.combat, t.autres].reduce(fcPlus, {});
  }
  return {par, manqueGT, gros, nKits};
}

/**
 * L'écart d'une planète à sa cible, type par type.
 * @returns {{plus:object, moins:object}} `plus` ce qui lui manque, `moins` ce qu'elle a en trop
 */
function fleetGap(cible, actuel){
  const plus = {}, moins = {};
  for(const k of new Set(Object.keys(cible || {}).concat(Object.keys(actuel || {})))){
    const d = ((cible || {})[k] || 0) - ((actuel || {})[k] || 0);
    if(d > 0) plus[k] = d; else if(d < 0) moins[k] = -d;
  }
  return {plus, moins};
}

/**
 * Les déplacements qui comblent les écarts : chaque manque se prend sur la
 * planète qui a le plus de ce type en trop, et les mouvements se regroupent
 * par paire source → cible, un vol par paire.
 * @param {Array<{id:string, plus:object, moins:object}>} gaps
 * @returns {Array<{de:string, vers:string, ships:object}>}
 */
function suggestMoves(gaps){
  const trop = gaps.map(g => ({id: g.id, m: Object.assign({}, g.moins)}));
  const paires = new Map();
  for(const g of gaps) for(const [k, n0] of Object.entries(g.plus)){
    let n = n0;
    while(n > 0){
      const src = trop.filter(x => x.id !== g.id && (x.m[k] || 0) > 0).sort((a, b) => b.m[k] - a.m[k])[0];
      if(!src) break;
      const q = Math.min(n, src.m[k]); src.m[k] -= q; n -= q;
      const cle = src.id + '>' + g.id;
      if(!paires.has(cle)) paires.set(cle, {de: src.id, vers: g.id, ships: {}});
      const e = paires.get(cle); e.ships[k] = (e.ships[k] || 0) + q;
    }
  }
  return [...paires.values()];
}

/* ---------- l'adaptateur : de l'état du panneau à l'entrée pure ---------- */

/**
 * La flotte de chaque planète, au sol et en vol : une flotte qui vole se
 * compte là où elle se posera. Un aller dont le retour est affiché se compte
 * au retour ; un Stationner se pose à destination ; le reste revient d'où il
 * est parti. Le relevé du jeu ne porte que ce qui est au sol, rien n'est donc
 * compté deux fois.
 */
function fcActuels(now){
  const out = new Map(S.planets.map(p => [p.id, Object.assign({}, aQuai(p))]));
  for(const v of mouvements()){
    if(v.hostile || v.camp !== 'own' || v.arrivee <= now) continue;
    let q;
    if(v.sens === 'retour') q = planeteEn(v.pose);
    else if(v.mission === 4) q = planeteEn(v.cible.coords);
    else if(v.retour) continue;
    else q = planeteEn(v.origine.coords);
    if(!q || !out.has(q.id)) continue;
    const ships = fcNet(Object.fromEntries(Object.entries(v.vaisseaux || {}).filter(([k]) => SHIPS[k]).map(([k, n]) => [k, +n || 0])));
    out.set(q.id, fcPlus(out.get(q.id), ships));
  }
  return out;
}

/** L'heure de la mise à l'abri qui vient, le réveil qui la suit, et si on est dedans. */
function fcFenetre(now){
  const c = secu(), wake = prochaineHeure(c.reveil, now), rappel = prochaineHeure(c.rappel, wake - 864e5);
  return {rappel, wake, dedans: now >= rappel || !!S.day.night, heure: Math.max(now, rappel)};
}

/**
 * La flotte cible de l'empire tel que le panneau le connaît, carburant compris.
 * @returns {{par:object, manqueGT:number, gros:string|null, nKits:number, actuels:Map, fen:object}}
 */
export function flotteCible(now){
  now = now || Date.now();
  const actuels = fcActuels(now), fen = fcFenetre(now);
  const planets = S.planets.map(p => {
    const pr = production(p), st = projectResources(p, fen.heure);
    return {id: p.id, ships: actuels.get(p.id) || {}, prod: mse(Math.max(0, pr.m), Math.max(0, pr.c), Math.max(0, pr.d)),
      besoin: st[0] + st[1] + st[2], reserve: expoRes(p)};
  });
  const r = fleetTarget({planets, nKits: S.tech.astro ? expoCap() : 0, cls: S.settings.cls});
  /* Carburant : la flotte du soir de chaque planète vers son coffre-fort, au
     cran que le plan de la nuit choisirait. Un coffre-fort ne part pas. */
  const coffres = new Set(secu().vaults);
  for(const p of S.planets){
    const t = r.par[p.id], dispo = Math.floor(projectResources(p, fen.heure)[2]);
    if(coffres.has(p.id) || !Object.keys(t.soir).length){ t.carburant = {ok: true, fuel: 0, dispo, coffre: coffres.has(p.id)}; continue; }
    const vol = transportSuggere(Object.assign({}, p, {ships: t.soir}), {mode: 'routine', now: fen.heure, wake: fen.wake, visees: new Set()});
    t.carburant = vol ? {ok: dispo >= vol.fuel, fuel: vol.fuel, dispo, vers: vol.dest, pct: vol.pct} : {ok: true, fuel: 0, dispo, sansDest: true};
  }
  for(const p of S.planets){
    const t = r.par[p.id], a = actuels.get(p.id) || {};
    t.actuel = a;
    t.gap = fleetGap(t.cible, a);
    /* La soute actuelle : les transporteurs de la planète, moins ceux que son kit emportera. */
    t.soute.actuelle = fcSouteDe(fcMoins(a, t.kitShips));
  }
  return Object.assign(r, {actuels, fen});
}

/* ---------- la vue Outils › Flotte ---------- */

/** « Faucheur : 1 cible, 0 actuel » : le détail d'une case, pour l'infobulle. */
function fcDetail(cible, actuel, types){
  const ks = types || [...new Set(Object.keys(cible || {}).concat(Object.keys(actuel || {})))];
  return ks.filter(k => ((cible || {})[k] || 0) || ((actuel || {})[k] || 0))
    .map(k => `${SHIPS[k] ? SHIPS[k].n : k} : ${fmtLigne((cible || {})[k] || 0)} visés, ${fmtLigne((actuel || {})[k] || 0)} actuels`).join('\n') || 'Rien';
}

/** Le tableau « Flotte cible », une ligne par planète. */
export function flotteCibleHtml(now){
  if(!S.planets.length) return '';
  const r = flotteCible(now);
  const lignes = S.planets.map(p => {
    const t = r.par[p.id], a = t.actuel;
    const noyau = t.noyau.manque.length ? `<span class="pill warn">kit incomplet : il manque ${esc(t.noyau.manque.join(', '))}</span>` : '<span class="pill good">ok</span>';
    const nk = t.kits.length;
    const kit = !nk ? 'non' : t.kitComplet ? `<span class="pill good">oui${nk > 1 ? ` ×${nk}` : ''}</span>` : `<span class="pill warn">incomplet</span>`;
    const kitTitre = t.kits.map((k, i) => k ? `Kit ${i + 1} : ${shipCourt(k.ships)} · ${fmtLigne(k.pts)}/${fmtLigne(k.ptsCap)} points · fret ${fmtLigne(k.cargo)}/${fmtLigne(k.fret)}` : `Kit ${i + 1} : aucun transporteur pour le composer`).join('\n') || 'Pas d\'emplacement d\'expédition pour cette planète';
    const sBas = t.soute.actuelle < t.soute.cible * fcSeuil() / 100;
    const soute = `<span class="${sBas ? 'c-bad' : ''}">${fmtCourt(t.soute.cible)} / ${fmtCourt(t.soute.actuelle)}</span>`;
    const souteTitre = `Stock prévu à ${formatTime(r.fen.heure)} : ${fmtLigne(t.soute.besoin)}${t.soute.cible > t.soute.besoin ? `\nRéserve de ${expoRes(p)} GT : ${fmtLigne(t.soute.cible)}` : ''}\n` + fcDetail(t.soute.ships, fcMoins(a, t.kitShips), FC_SOUTE);
    const combatTypes = Object.keys(SHIPS).filter(k => !FC_SOUTE.includes(k) && !FC_GARDE.includes(k));
    const ecart = combatTypes.map(k => [k, ((t.cible[k] || 0) - (a[k] || 0))]).filter(([, d]) => d)
      .map(([k, d]) => `${d > 0 ? '+' : ''}${fmtLigne(d)} ${SHIP_COURT[k] || k}`).join(', ') || '—';
    const c = t.carburant;
    const carb = c.coffre ? '<span class="note">coffre-fort</span>' : c.sansDest ? '<span class="note">—</span>' : c.ok ? '<span class="pill good">ok</span>'
      : `<span class="pill bad">manque ${fmtCourt(c.fuel - c.dispo)}</span>`;
    const carbTitre = c.coffre ? 'Coffre-fort : la flotte y reste.' : c.sansDest ? 'Aucune destination : il faut une autre planète.'
      : `Vers ${c.vers.name} à ${c.pct} % : ${fmtLigne(c.fuel)} deutérium, ${fmtLigne(c.dispo)} prévus à ${formatTime(r.fen.heure)}`;
    return `<tr><td>${esc(p.name)}</td><td title="${esc(fcDetail(t.cible, a, ['pr', 'pf', r.gros].filter(Boolean)))}">${noyau}</td><td title="${esc(kitTitre)}">${kit}</td><td class="n" title="${esc(souteTitre)}">${soute}</td><td title="${esc(fcDetail(t.cible, a, combatTypes))}">${esc(ecart)}</td><td title="${esc(carbTitre)}">${carb}</td></tr>`;
  }).join('');
  const notes = [];
  if(r.manqueGT) notes.push(`<p class="note"><span class="pill bad">Soute</span> Il manque <b>${fmtLigne(r.manqueGT)} GT</b> pour couvrir le stock du soir : les transporteurs sont répartis au prorata des besoins.</p>`);
  if(S.planets.some(p => r.par[p.id].noyau.pfImpossible)) notes.push('<p class="note">Ta classe ne construit pas d\'Éclaireur (réservé à l\'Explorateur) : les planètes sans Éclaireur ont un kit avec le gros vaisseau seul.</p>');
  if(!r.gros) notes.push('<p class="note">Aucun gros vaisseau dans l\'empire : les kits partent sans Faucheur, Destructeur, Traqueur ni Vaisseau de bataille.</p>');
  const carbBas = S.planets.filter(p => !r.par[p.id].carburant.ok);
  if(carbBas.length) notes.push(`<p class="note"><span class="pill bad">Carburant</span> ${carbBas.map(p => esc(p.name)).join(', ')} : pas assez de deutérium pour envoyer la flotte cible au coffre-fort ce soir.</p>`);
  return `<div class="card"><h2>Flotte cible</h2>
    <p class="note">Ce que chaque planète devrait avoir pour lancer une expédition et lever son stock seule le soir.</p>
    ${aide('flottecible', `<p class="note">${r.nKits} kit${r.nKits > 1 ? 's' : ''} complet${r.nKits > 1 ? 's' : ''} (un par emplacement d'expédition), soute calée sur le stock prévu à ${formatTime(r.fen.heure)}, combat restant à parts égales. Survole une case pour le détail.</p>`)}
    <div class="tbl-wrap"><table class="fc-tab"><thead><tr><th>Planète</th><th>Kit noyau</th><th>Kit complet</th><th class="n">Soute (cible / actuelle)</th><th>Combat (écart)</th><th>Carburant</th></tr></thead><tbody>${lignes}</tbody></table></div>
    ${notes.join('')}
    <div class="grid"><label class="f">Seuil de rééquilibrage (%)<input type="number" min="1" max="100" data-set="reeqSeuil" value="${fcSeuil()}"><span class="note">Une carte Rééquilibrer sort quand la soute d'une planète tombe sous ce pourcentage de sa cible, ou qu'il lui manque son kit noyau.</span></label></div>
  </div>`;
}

/* ---------- faire tendre vers la cible ---------- */

/**
 * Les cartes « Rééquilibrer » : une par planète loin de sa cible — kit noyau
 * manquant, ou soute sous le seuil — avec les vaisseaux à y faire stationner.
 * Jamais pendant la fenêtre de mise à l'abri ni sous une attaque : ce ne sont
 * pas des moments pour déplacer la flotte.
 * @returns {Array<object>} des missions du jour, au format de dailyMissions
 */
export function reequilibreCartes(now, r){
  now = now || Date.now();
  r = r || flotteCible(now);
  if(r.fen.dedans || attaquesEntrantes(now).length) return [];
  const seuil = fcSeuil() / 100, parId = id => S.planets.find(p => p.id === id);
  const loin = S.planets.filter(p => {
    const t = r.par[p.id];
    const noyauManque = ['pr', 'pf', r.gros].some(k => k && (t.cible[k] || 0) > ((t.actuel || {})[k] || 0) && (t.noyau.ships[k] || 0) > 0);
    return noyauManque || (t.soute.cible > 0 && t.soute.actuelle < t.soute.cible * seuil);
  });
  if(!loin.length) return [];
  const moves = suggestMoves(S.planets.map(p => ({id: p.id, plus: loin.includes(p) ? r.par[p.id].gap.plus : {}, moins: r.par[p.id].gap.moins})));
  const out = [];
  for(const mv of moves){
    const src = parId(mv.de), dst = parId(mv.vers); if(!src || !dst) continue;
    const fl = flight(src.coords, dst.coords, mv.ships, 100); if(!fl) continue;
    /* Les ressources utiles à l'arrivée : le deutérium qui manquerait à la
       planète cible pour partir ce soir, pris sur ce que la source n'a pas à
       garder pour sa propre mise à l'abri. */
    const tD = r.par[dst.id].carburant, tS = r.par[src.id].carburant;
    const manqueD = tD && !tD.ok ? tD.fuel - tD.dispo : 0;
    const libreD = Math.max(0, Math.floor(stockNow(src)[2]) - fl.fuel - (tS ? tS.fuel : 0));
    const charge = [0, 0, Math.min(manqueD, libreD, souteUtile(fcSouteDe(mv.ships), 0))];
    const t = r.par[dst.id];
    const raison = [];
    if(t.soute.actuelle < t.soute.cible * seuil) raison.push(`soute ${fmtCourt(t.soute.actuelle)} pour ${fmtCourt(t.soute.cible)} visés`);
    if(t.noyau.ships && ['pr', 'pf', r.gros].some(k => k && t.noyau.ships[k] && !(t.actuel[k] > 0))) raison.push('kit noyau incomplet');
    const tab = `<table class="fs-tab"><thead><tr><th>Source</th><th>Vaisseaux</th><th>Cible</th><th>Mission</th><th>M / C / D</th></tr></thead><tbody><tr><td>${esc(src.name)}</td><td>${esc(shipCourt(mv.ships))}</td><td>${esc(dst.name)}</td><td>Stationner</td><td class="mono">${mcd(charge)}</td></tr></tbody></table>`;
    out.push({id: 'reequilibre:' + src.id + '>' + dst.id, q: 'Flotte', every: 12, sev: 'warn', tags: [planetRef(dst)],
      what: `Rééquilibrer : ${shipList(mv.ships)} de ${planetRef(src)} vers ${planetRef(dst)}`,
      whatHtml: `Rééquilibrer : ${esc(shipList(mv.ships))} de ${esc(planetRef(src))} vers ${esc(planetRef(dst))}${tab}`,
      ships: mv.ships, dest: dst.coords, mission: 4, p: S.planets.indexOf(src), res: charge, dstId: dst.id,
      why: `${planetRef(dst)} est loin de sa flotte cible (${raison.join(', ') || 'écart'}). ${planetRef(src)} a ces vaisseaux en trop.`,
      how: ['<b>Stationner</b> : les vaisseaux restent sur la planète cible. En Transport, ils reviendraient à leur départ et l\'écart resterait.',
        `${dur(fl.secs)} de vol à 100 %, ${fmt(fl.fuel)} deutérium.`,
        charge[2] > 0 ? `Emporte ${fmt(charge[2])} deutérium : il manque à ${esc(planetRef(dst))} pour partir ce soir.` : 'Rien d\'utile à emporter : la planète cible a ce qu\'il lui faut pour partir ce soir.',
        'Le détail de la cible est dans Outils › Flotte.']});
  }
  return out;
}

/**
 * Sur un vol déjà proposé (rapatriement, convoi), les vaisseaux en trop sur la
 * source qui manquent à l'arrivée. Le vol lui-même reste en Transport : ce qui
 * doit rester là-bas part dans un second envoi, en Stationner, sur le même
 * trajet.
 * @returns {string} une phrase, vide s'il n'y a rien à ajouter
 */
export function flotteAjout(r, src, dst){
  if(!r || !src || !dst || src === dst || r.fen.dedans) return '';
  const a = r.par[src.id], b = r.par[dst.id]; if(!a || !b) return '';
  const add = {};
  for(const [k, n] of Object.entries(b.gap.plus)){ const q = Math.min(n, a.gap.moins[k] || 0); if(q > 0) add[k] = q; }
  if(!Object.keys(add).length) return '';
  return `Flotte cible : profite du trajet pour envoyer aussi ${shipList(add)} en Stationner vers ${planetRef(dst)} (un second envoi), ils y restent et rapprochent les deux planètes de leur cible.`;
}
