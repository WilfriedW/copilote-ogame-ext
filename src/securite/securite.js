/* ---------- la sécurité ----------
   Ce qui menace une planète et ce qu'on y oppose : la mise à l'abri de la
   nuit (`fsFor`, `fleetsavePlan`, `cargoGaps`), les attaques et espionnages
   entrants lus dans le jeu (`attaquesEntrantes`, `espionnagesEntrants`), le
   coffre-fort et le transport à lancer avant l'impact (`coffreFortPour`,
   `transportSuggere`), le plan de sécurité qui les assemble
   (`planSecurite`), et le rappel de mise à l'abri (`armeRappel`).

   Module de domaine (issue #49). Le rendu (`securiteHtml`, `secuCard`…), la
   nuit et l'heure de réveil (`wakeTime`) et la projection des ressources
   (`projectResources`) restent dans app.js jusqu'à leurs étapes. Ce module
   leur emprunte encore ces noms : ce cycle-là est toléré tant qu'app.js
   existe, et rien n'y est lu au chargement. */
import { S } from '../core/etat.js';
import { planetById } from '../core/planetes.js';
import { IS_EXT } from '../core/serveur.js';
import { formatTime } from '../core/temps.js';
import { fileDe, enCours, fileBat } from '../economie/chantiers.js';
import { debordeTexte } from '../economie/debordements.js';
import { stockNow } from '../economie/production.js';
import { labPlanet } from '../economie/centre.js';
import {
  parseC, distance, souteUtile, shipStats, flight, planeteEn, mouvements,
  aQuai
} from '../flotte/vaisseaux.js';
import { depensesPayables, projectResources } from '../plan/journee.js';
import { hhmmDe, wakeTime } from '../plan/nuit.js';
import { debordeA, autreCibleAvecPlace } from '../plan/surplus.js';

/* ---------- mise à l'abri ---------- */
/* Vitesses proposées par le jeu, de la plus rapide à la plus lente. */
const FS_SPEEDS = [100,90,80,70,60,50,40,30,20,10];
/* En dessous, un vol coûte plus qu'il ne protège. */
const FS_MIN = 10000;

/**
 * Ce qu'il faut envoyer en l'air avant de dormir.
 * Charge la planète la plus exposée dans ses transporteurs et choisit la
 * vitesse la plus rapide qui fait quand même rentrer la flotte après ton
 * réveil : plus c'est lent, plus c'est sûr, mais plus tu attends au matin.
 * @param {number} now horodatage courant
 * @returns {object|null} {from, ships, dest, mission, pct, back, fuel, load, cargo}
 */
/** Ce qu'une planète a au sol, en soute. */
function cargoCap(p){ return ['lc','sc'].reduce((a,k)=>a + ((p.ships||{})[k]||0)*shipStats(k).cargoEff, 0); }
/** Ce qui dort sur une planète, les trois ressources additionnées. */
function fsLoad(p){ const st = stockNow(p); return st[0]+st[1]+st[2]; }
/**
 * Les transporteurs à prendre sur cette planète pour lever `amount` de soute.
 * Les grands d'abord : moins de vaisseaux, un seul temps de vol.
 * @returns {object} {ships, cargo} — cargo plafonné par ce qui est au sol
 */
export function pickCargo(p, amount){
  const ships = {}; let cargo = 0;
  for(const k of ['lc','sc']){
    const have = (p.ships||{})[k] || 0, unit = shipStats(k).cargoEff;
    if(!have || !unit || cargo >= amount) continue;
    const n = Math.min(have, Math.ceil((amount-cargo)/unit));
    if(n>0){ ships[k] = n; cargo += n*unit; }
  }
  return {ships, cargo};
}

/* Codes de mission du jeu, et leur nom dans le client français. */
export const FS_MISSION = {transport:3, deployment:4, expedition:15};
export const FS_MISSION_N = {transport:'Transport', deployment:'Stationner', expedition:'Expédition'};

/**
 * Ce qu'on charge de chaque ressource quand la soute ne prend pas tout.
 *
 * Le jeu demande trois nombres, pas un total : sans eux le joueur répartit au
 * jugé, et le plus souvent il clique « tout » sur le métal, qui est ce qu'il a
 * en plus grande quantité et ce qui vaut le moins. Le deutérium passe donc en
 * premier — trois métaux au taux par défaut — puis le cristal. Le plein de la
 * flotte reste au sol : chargé, il manquerait au départ.
 * @param {number[]} st stock sur place [m, c, d]
 * @param {number} cap ce que la soute peut lever
 * @param {number} fuel deutérium que le vol coûte
 * @returns {number[]} [m, c, d] à charger
 */
export function partAbri(st, cap, fuel){
  const dispo = [st[0], st[1], Math.max(0, st[2] - fuel)], out = [0,0,0];
  let reste = cap;
  for(const j of [2,1,0]){ out[j] = Math.floor(Math.max(0, Math.min(dispo[j], reste))); reste -= out[j]; }
  return out;
}
/**
 * La mise à l'abri d'une seule planète, avec ce qu'elle a sur place.
 *
 * Mission TRANSPORT, la préférence du joueur : la flotte revient d'elle-même à
 * sa planète, et rien ne reste stationné ailleurs. Le wiki préfère le
 * déploiement — un Transport se voit à la phalange et, une fois le retour
 * commencé, ne se rappelle plus — et la carte le dit, mais le choix est fait.
 *
 * Un Transport décharge à l'arrivée : la vitesse se cale donc pour qu'il
 * ARRIVE après le réveil quand il vise une planète ordinaire : les ressources
 * passent la nuit en vol et se posent quand le joueur est là. Vers un
 * coffre-fort, fait pour garder un stock, il suffit que la flotte rentre après
 * le réveil. Coffre-fort d'abord, sinon une autre de tes planètes.
 *
 * Sans Transport qui tienne : un aller-retour vers la position 16, d'où les
 * ressources reviennent avec la flotte. La 16 n'accepte que l'EXPÉDITION. Un
 * Espionner vers elle, que l'extension proposait dès qu'une sonde traînait au
 * sol, n'est pas un ordre que le jeu prend : la carte envoyait le joueur se
 * faire refuser le départ. Le wiki ne compte pas l'expédition parmi les mises
 * à l'abri et un mauvais événement peut coûter la cargaison, mais elle vaut
 * mieux que laisser le stock au sol. Une sonde embarquée double ses gains.
 *
 * ponytail: pas de lune, pas de champ de débris, pas de portée de phalange —
 * l'extension n'en lit aucun. Le déploiement de lune à lune, que le wiki met
 * en tête, demanderait d'abord que le modèle connaisse les lunes.
 */
function fsFor(p, now, wake){
  const need = fsLoad(p);
  if(need < FS_MIN) return null;
  const {ships, cargo} = pickCargo(p, need);
  if(!Object.keys(ships).length) return null;
  const c = parseC(p.coords); if(!c) return null;

  /* Les candidats : un Transport vers un coffre-fort (à défaut, une autre de
     tes planètes) d'abord, puis la position 16 d'un système choisi pour son
     temps de vol — « choose the system according to flight time ». Le système
     d'à côté ne suffit pas : entre deux planètes voisines, même à 10 %, un
     Transport se pose avant le réveil, et un aller-retour sur place garde la
     flotte en l'air jusqu'au milieu de la matinée. */
  const essais = [];
  const coffres = secu().vaults.map(planetById).filter(q => q && q !== p && q.coords);
  for(const q of (coffres.length ? coffres : S.planets)) if(q !== p && q.coords) essais.push({mode:'transport', dest:q.coords});
  for(const d of [0, 20, 50, 100, 200, 300]) essais.push({mode:'expedition', dest:`${c[0]}:${((c[1] - 1 + d) % 499) + 1}:16`});

  /* Pour une destination donnée, plus lent veut dire plus tard : les crans qui
     tiennent forment la fin de la liste. On s'arrête donc aux trois premiers,
     ce qui borne aussi le nombre d'appels à flight(). */
  const bons = [];
  for(const e of essais){
    /* La flotte est en l'air de toute façon : une sonde à bord double ce que
       l'expédition rapporte, et ne coûte qu'elle-même si l'événement tourne mal. */
    const flotte = e.mode === 'expedition' && (p.ships||{}).pr > 0 ? Object.assign({pr:1}, ships) : ships;
    const hold = e.mode === 'expedition' ? 3600e3 : 0;
    let pris = 0;
    for(const pct of FS_SPEEDS){
      if(pct === 100 || pris >= 3) continue;   // 100 % : le vol le plus court, donc le plus facile à chronométrer
      const fl = flight(p.coords, e.dest, flotte, pct); if(!fl) continue;
      /* Ce qui doit tomber après le réveil. Un Transport décharge à
         l'arrivée : vers un coffre-fort, fait pour garder un stock, il suffit
         que la flotte rentre après le réveil ; vers une planète ordinaire, la
         cargaison ne doit s'y poser qu'une fois le joueur là. Une expédition
         rapporte tout au retour. */
      const back = now + 2*fl.secs*1000 + hold;
      const fin = e.mode === 'transport' && !coffres.length ? now + fl.secs*1000 : back;
      if(fin > wake){ bons.push({mode:e.mode, dest:e.dest, ships:flotte, pct, fl, fin, back, oneWay:false}); pris++; }
    }
  }
  if(!bons.length) return null;

  /* On veut revenir le plus tôt possible APRÈS le réveil : plus tôt veut dire
     moins de matinée sans flotte, et un système proche veut dire moins de
     deutérium. Six heures de battement au-delà du réveil, sinon le « plus sûr »
     devient une flotte indisponible toute la journée. */
  const tot = x => x.fin;
  const serre = bons.filter(x=>x.fin < wake + 6*3600e3);
  const pool = serre.length ? serre : bons;
  /* Un Transport décharge à l'arrivée : une planète qui n'a pas la place
     passe après celles qui l'ont — la livraison n'est pas plafonnée, la
     production si, et la mine d'arrivée resterait arrêtée au matin. */
  const stp = stockNow(p);
  for(const x of pool) if(x.mode==='transport'){
    const q = planeteEn(x.dest), ch = partAbri(stp, souteUtile(cargo, 2*x.fl.fuel), 2*x.fl.fuel);
    x.deborde = debordeA(q, ch, now + x.fl.secs*1000);
  }
  const dep = pool.filter(x=>x.mode==='transport').sort((a,b)=>(a.deborde.length>0)-(b.deborde.length>0) || tot(a)-tot(b));
  const alt = pool.filter(x=>x.mode!=='transport').sort((a,b)=>tot(a)-tot(b));
  /* Le Transport d'abord dès qu'il tient : la ressource se pose chez toi, la
     flotte rentre seule. L'expédition n'est qu'un pis-aller. */
  const depOk = dep.filter(x=>!x.deborde.length);
  const choix = depOk.length ? depOk : dep.length ? dep : alt;
  // « Avoid using the same speed each time you fleetsave » : le cran change avec
  // le jour, pas à chaque rafraîchissement, sinon le plan se contredirait.
  const ch = choix[new Date(now).getDate() % Math.min(3, choix.length)];
  return {from:p, ships:ch.ships, dest:ch.dest, mission:ch.mode, oneWay:ch.oneWay, pct:ch.pct,
          arrive: now + ch.fl.secs*1000, back: ch.back, fuel:ch.fl.fuel*2,
          load:need, cargo:souteUtile(cargo, ch.fl.fuel*2), deborde:ch.deborde || []};
}

/**
 * Ce qu'il faut envoyer en l'air avant de dormir, planète par planète.
 * Ne regardait que la planète la plus chargée, et n'utilisait que SES
 * vaisseaux : à force de rapatriements les transporteurs finissent stationnés
 * sur les colonies, la principale se retrouvait pleine et sans soute, et la
 * fonction rendait null — la carte du soir retombait sur un conseil général
 * pendant que la planète la plus riche passait la nuit à découvert.
 * Chaque planète part donc avec ce qu'elle a ; `rest` porte les autres lots,
 * et cargoGaps() dit où est la flotte quand elle manque.
 * @returns {object|null} le plus gros lot protégeable, plus `rest`
 */
export function fleetsavePlan(now){
  const wake = wakeTime(now);
  if(!wake) return null;
  const lots = S.planets.map(p=>fsFor(p, now, wake)).filter(Boolean)
    .sort((a,b)=>Math.min(b.load,b.cargo) - Math.min(a.load,a.cargo));
  if(!lots.length) return null;
  return Object.assign({}, lots[0], {rest:lots.slice(1)});
}

/**
 * Les planètes dont la soute au sol ne lèvera pas ce qui dort dessus, et où
 * sont les transporteurs qui manquent. C'est l'inventaire : sans lui, « mes
 * grands transporteurs sont tous sur les colonies » reste invisible.
 * @returns {Array<object>} {p, load, cargo, manque, ailleurs:[{p, dispo}]}
 */
export function cargoGaps(){
  /* Un donneur ne prête que son surplus : ce qu'il a en soute moins ce qu'il
     devra lever lui-même le soir. Sinon le conseil déplace le trou. */
  const dispo = S.planets.map(p=>({p, cargo:cargoCap(p), dispo:Math.max(0, cargoCap(p) - pickCargo(p, fsLoad(p)).cargo)}));
  const out = [];
  for(const {p, cargo} of dispo){
    const load = fsLoad(p);
    if(load < FS_MIN || cargo >= load) continue;
    const manque = load - cargo;
    const libres = dispo.filter(x=>x.p!==p && x.dispo>0).sort((a,b)=>b.dispo-a.dispo);
    /* Le surplus d'un donneur ne se prête qu'une fois. Compté en entier pour
       chaque colonie, il promettait la même soute à toutes : cinq cartes
       « Ramène 1 grand transporteur de la même planète », et dès le premier
       rapatriement lancé les autres s'évanouissaient, sans que rien ne dise
       que le besoin, lui, restait. Ce qui est promis ici est donc retenu là. */
    out.push({p, load, cargo, manque, ailleurs: libres.map(x=>({p:x.p, dispo:x.dispo}))});
    if(libres[0]) libres[0].dispo = Math.max(0, libres[0].dispo - manque);
  }
  return out;
}
/* ---------- les missions qui frappent ---------- */
/** Missions qui frappent la planète visée. */
const MISSIONS_ATTAQUE = [1, 2, 9];

/** Mes réglages de sécurité, toujours complets : une sauvegarde d'avant ne les porte pas. */
export function secu(){
  const d = {vaults:[], rappel:'22:00', jours:[0,1,2,3,4,5,6]};
  const s = S.settings.secu && typeof S.settings.secu === 'object' ? S.settings.secu : {};
  const hhmm = v => /^\d{1,2}:\d{2}$/.test(String(v)) ? String(v).padStart(5, '0') : null;
  return {
    vaults: Array.isArray(s.vaults) ? s.vaults.filter(id => planetById(id)) : d.vaults,
    rappel: hhmm(s.rappel) || d.rappel,
    jours: Array.isArray(s.jours) ? s.jours.filter(j => Number.isInteger(j) && j >= 0 && j <= 6) : d.jours,
    /* Le réveil n'a qu'une source : la fin de nuit du plan du jour. Deux
       champs pour la même heure finissent par se contredire — le plan de la
       nuit visait 7 h pendant que le mode nuit visait 6 h. À la minute près. */
    reveil: hhmmDe(S.day.nightEnd)
  };
}
/** Le prochain instant, en heure locale, où l'horloge marque `hhmm`, après `apres`. */
export function prochaineHeure(hhmm, apres){
  const [h, m] = String(hhmm).split(':').map(Number), d = new Date(apres);
  d.setHours(h, m, 0, 0);
  if(d.getTime() <= apres) d.setDate(d.getDate() + 1);
  return d.getTime();
}

/* ---------- menaces ---------- */
/** Les attaques hostiles qui visent l'une de mes planètes, la plus proche d'abord. */
export function attaquesEntrantes(now){
  return mouvements().filter(v => v.hostile && v.sens === 'aller' && MISSIONS_ATTAQUE.includes(v.mission) && v.arrivee > now)
    .map(v => ({v, p: planeteEn(v.cible.coords), impact: v.arrivee})).filter(x => x.p);
}
/** Les espionnages hostiles en route vers moi. */
export function espionnagesEntrants(now){
  return mouvements().filter(v => v.hostile && v.sens === 'aller' && v.mission === 6 && v.arrivee > now)
    .map(v => ({v, p: planeteEn(v.cible.coords)})).filter(x => x.p);
}

/* ---------- coffres-forts ---------- */
/**
 * Où mettre à l'abri ce qui part de `p`.
 * Le coffre-fort le plus proche, même galaxie d'abord — `distance()` seule
 * mettrait une galaxie voisine (20 000) devant un système lointain de la même
 * (jusqu'à 50 000). Jamais un coffre-fort qu'une attaque vise. Aucun d'utilisable :
 * le plus lointain, pour que la flotte reste en vol le plus longtemps.
 * Sans coffre-fort déclaré, mes autres planètes en tiennent lieu, et le plan le dit.
 * @param {Set<string>} visees ids des planètes attaquées
 * @returns {{q:object, pourquoi:string}|null}
 */
function coffreFortPour(p, visees, cargo, at){
  const c = parseC(p.coords); if(!c) return null;
  const declares = secu().vaults.map(planetById).filter(Boolean);
  const pool = (declares.length ? declares : S.planets).filter(q => q !== p && q.id !== p.id && parseC(q.coords));
  if(!pool.length) return null;
  const cle = q => { const d = parseC(q.coords); return [d[0] === c[0] ? 0 : 1, distance(c, d)]; };
  const tri = (a, b) => { const x = cle(a), y = cle(b); return x[0] - y[0] || x[1] - y[1]; };
  /* Une cargaison qui ferait déborder le coffre-fort y arrête la mine : à
     galaxie égale, celui qui a la place passe devant (debordeA). */
  const trop = q => cargo && at ? (debordeA(q, cargo, at).length > 0 ? 1 : 0) : 0;
  const sauf = pool.filter(q => !visees.has(q.id)).sort((a, b) => { const x = cle(a), y = cle(b); return x[0] - y[0] || trop(a) - trop(b) || x[1] - y[1]; });
  const sans = declares.length ? '' : ' Aucun coffre-fort déclaré (Réglages › Sécurité) : ta planète la plus proche en tient lieu.';
  if(sauf.length) return {q: sauf[0], pourquoi: (declares.length ? 'coffre-fort le plus proche' : 'planète la plus proche') + (pool.length > sauf.length ? ', les autres sont attaqués' : '') + '.' + sans};
  const loin = pool.slice().sort((a, b) => distance(c, parseC(b.coords)) - distance(c, parseC(a.coords)))[0];
  return {q: loin, pourquoi: 'Aucun coffre-fort à l\'abri : le plus lointain, pour garder la flotte en vol le plus longtemps.' + sans};
}

/** Les crans de vitesse que le jeu propose : par 5 % au Général, par 10 % sinon. */
function crans(){ const pas = S.settings.cls === 'general' ? 5 : 10, out = []; for(let v = 100; v >= pas; v -= pas) out.push(v); return out; }

/**
 * Le transport qui met à l'abri ce qui est sur `p`.
 *
 * Routine : la vitesse la plus lente qui arrive au coffre-fort au plus tard à
 * l'heure de réveil, et un départ retardé d'autant s'il reste de la marge — les
 * crans de 10 % ne tombent pas tout seuls à dix minutes près, l'heure de départ
 * si. Attaque : en Transport, la flotte revient à sa planète ; elle doit donc
 * rentrer APRÈS l'impact, dix minutes de marge.
 * @param {object} o {mode:'attaque'|'routine', now, impact, wake, visees}
 */
export function transportSuggere(p, o){
  const ships = aQuai(p); if(!Object.keys(ships).length) return null;
  const soute0 = Object.entries(ships).reduce((a, [k, n]) => a + n*shipStats(k).cargoEff, 0);
  const vise = partAbri(projectResources(p, o.now), soute0, 0);
  const dest = coffreFortPour(p, o.visees || new Set(), vise, o.mode === 'attaque' ? o.impact : o.wake); if(!dest) return null;
  /* Toujours en Transport : c'est la préférence du joueur, et la bascule
     « Préférer Stationner » n'existe plus. Seules les cartes qui déplacent
     durablement des vaisseaux partent en Stationner, et elles le disent. */
  const mission = 3, trajets = 2;
  const now = o.now, vols = crans().map(pct => ({pct, fl: flight(p.coords, dest.q.coords, ships, pct)})).filter(x => x.fl);
  if(!vols.length) return null;
  let choix = null, depart = now, note = '';
  if(o.mode === 'attaque'){
    const apres = o.impact + 10*60e3;
    choix = vols.find(x => now + 2*x.fl.secs*1000 >= apres);
    if(!choix){ choix = vols[vols.length - 1]; depart = apres - 2*choix.fl.secs*1000;
      note = `Pars à ${formatTime(depart)} au plus tôt : plus tôt, la flotte rentrerait avant l'impact.`; }
  } else {
    const W = o.wake;
    const tient = vols.filter(x => now + x.fl.secs*1000 <= W);
    if(tient.length){ choix = tient[tient.length - 1]; const d = W - choix.fl.secs*1000; if(d - now > 10*60e3){ depart = d; note = `Pars à ${formatTime(depart)} : à ${choix.pct} % la flotte se pose à ton réveil.`; } }
    else { choix = vols[0]; note = 'Même à 100 % la flotte arrive après ton réveil.'; }
  }
  const fuel = choix.fl.fuel * trajets;
  const soute = Object.entries(ships).reduce((a, [k, n]) => a + n*shipStats(k).cargoEff, 0);
  const st = projectResources(p, now);
  const charge = partAbri(st, souteUtile(soute, fuel), fuel);
  /* Les grands transporteurs qu'il faudrait pour tout lever, arrondis au-dessus :
     la flotte part entière, mais ce chiffre dit si la soute suffit. */
  const lc = shipStats('lc').cargoEff, total = st[0] + st[1] + Math.max(0, st[2] - fuel);
  const gt = lc > 0 ? Math.ceil(total / lc) : 0;
  const arrivee = depart + choix.fl.secs*1000;
  /* Le transport dépose sa cargaison au coffre-fort : s'il le fait déborder,
     la carte le dit avant l'envoi, avec une planète qui a la place. */
  const deborde = debordeA(dest.q, charge, arrivee);
  if(deborde.length){
    const alt = autreCibleAvecPlace(p, charge, arrivee, [dest.q].concat(S.planets.filter(q => (o.visees || new Set()).has(q.id))));
    note = [note, debordeTexte(dest.q.name, deborde), alt ? `Autre cible avec la place : ${alt.name}.` : ''].filter(Boolean).join(' ');
  }
  return {p, pi: S.planets.indexOf(p), ships, dest: dest.q, pourquoi: dest.pourquoi, deborde, mission, missionNom: mission === 4 ? 'Stationner' : 'Transport',
    pct: choix.pct, depart, arrivee, retour: trajets === 2 ? arrivee + choix.fl.secs*1000 : null, fuel, charge, soute, gt, note,
    resteSol: st.map((x, j) => Math.max(0, x - charge[j] - (j === 2 ? fuel : 0)))};
}

/**
 * Ce qui se dépense tout de suite sur `p` : les conseils finançables
 * maintenant du plan, puis ce que le stock paie encore, triés par montant.
 * Le stock ne paie pas tout à la fois : on garde ceux qui tiennent ensemble.
 */
function depensesAttaque(p, acts){
  const st = projectResources(p, Date.now()), out = [], vus = new Set();
  const pi = S.planets.indexOf(p);
  const cands = (acts || []).filter(a => a.p === pi && a.cost && !['fleet', 'expo'].includes(a.kind)).map(a => ({what: a.what, cost: a.cost, kind: a.kind}))
    .concat([0, 1, 2].flatMap(j => depensesPayables(p, j, st)).map(d => ({what: d.what, cost: d.cost, kind: d.kind})));
  cands.sort((a, b) => (b.cost[0] + b.cost[1] + b.cost[2]) - (a.cost[0] + a.cost[1] + a.cost[2]));
  const reste = st.slice();
  for(const c of cands){
    if(vus.has(c.what) || !c.cost.every((x, j) => x <= reste[j] + 1e-6)) continue;
    vus.add(c.what); c.cost.forEach((x, j) => reste[j] -= x); out.push(c);
    if(out.length >= 6) break;
  }
  return out;
}

/** Mes flottes qui se posent sur `p` entre `de` et `a` (ms). */
function convoisVers(p, de, a){
  return mouvements().filter(v => !v.hostile && v.pose === p.coords && v.arrivee >= de && v.arrivee <= a);
}

/**
 * Le plan de sécurité.
 * - `attaque` : une entrée par planète visée — compte à rebours, ressources
 *   exposées à l'impact, de quoi dépenser, la flotte à sortir, les convois qui
 *   arriveraient dans la bataille.
 * - `routine` : une entrée par planète — exposé, à quai, files qui se vident
 *   avant le réveil, convois de nuit, transport vers un coffre-fort.
 * @param {'attaque'|'routine'} kind
 * @param {number} now
 * @param {Array} [acts] les conseils finançables maintenant du plan
 */
export function planSecurite(kind, now, acts){
  const att = attaquesEntrantes(now), visees = new Set(att.map(x => x.p.id));
  if(kind === 'attaque'){
    const par = new Map();
    for(const a of att){ const e = par.get(a.p.id); if(!e || a.impact < e.impact) par.set(a.p.id, a); }
    return [...par.values()].sort((a, b) => a.impact - b.impact).map(a => ({
      p: a.p, impact: a.impact, groupee: a.v.mission === 2, nb: att.filter(x => x.p.id === a.p.id).length,
      expose: projectResources(a.p, a.impact),
      depenses: depensesAttaque(a.p, acts),
      transport: transportSuggere(a.p, {mode: 'attaque', now, impact: a.impact, visees}),
      aRisque: convoisVers(a.p, now, a.impact + 10*60e3)
    }));
  }
  /* Le réveil qui vient, et le rappel qui le précède : à 3 h, la nuit a
     commencé hier soir ; à 8 h, elle commence ce soir. */
  const cfg = secu(), wake = prochaineHeure(cfg.reveil, now), rappel = prochaineHeure(cfg.rappel, wake - 864e5);
  const coffres = new Set(cfg.vaults);
  return S.planets.map(p => {
    const pi = S.planets.indexOf(p);
    const files = [];
    const bat = fileDe(p, t => enCours(t) && fileBat(t)).sort((a, b) => b.end - a.end)[0];
    if(!bat || bat.end < wake){
      const lance = (acts || []).find(a => a.p === pi && a.kind === 'b') || depensesPayables(p, 0, projectResources(p, now)).find(d => d.kind === 'b');
      files.push({file: 'Bâtiments', libre: bat ? bat.end : now, lance: lance ? lance.what : null});
    }
    const lab = labPlanet();
    if(lab && lab.id === p.id){
      const r = (S.timers || []).filter(t => enCours(t) && (t.kind === 't' || t.queue === 'research')).sort((a, b) => b.end - a.end)[0];
      if(!r || r.end < wake){ const lance = (acts || []).find(a => a.kind === 't') || depensesPayables(p, 0, projectResources(p, now)).concat(depensesPayables(p, 1, projectResources(p, now))).find(d => d.kind === 't'); files.push({file: 'Recherche', libre: r ? r.end : now, lance: lance ? lance.what : null}); }
    }
    return {p, coffre: coffres.has(p.id), expose: projectResources(p, now), aQuai: aQuai(p), files,
      nuit: convoisVers(p, rappel, wake), wake, rappel,
      transport: coffres.has(p.id) ? null : transportSuggere(p, {mode: 'routine', now, wake, visees})};
  });
}

/* ---------- le rappel de mise à l'abri ---------- */
/** Le badge du rappel est-il allumé ? Lu dans le stockage par `boot`, tenu à jour par l'écoute plus bas. */
export let FS_RAPPEL_ON = null;
/** Le seul moyen, hors de ce module, de changer FS_RAPPEL_ON : un import ne se réassigne pas. */
export function poseRappel(v){ FS_RAPPEL_ON = v; }
export function fsRappelActif(){ return !!(FS_RAPPEL_ON && Date.now() - (+FS_RAPPEL_ON.at || 0) < 24*3600e3); }
/** Le joueur a ouvert le plan : le badge s'éteint. */
export function fsRappelVu(){
  if(!FS_RAPPEL_ON) return;
  FS_RAPPEL_ON = null;
  if(IS_EXT) try{ chrome.storage.local.remove('fsRappelOn'); }catch(e){}
}
/**
 * Pose l'alarme du rappel, à l'heure choisie, chaque jour. Le service worker la
 * fait sonner panneau fermé et ne retient que les jours actifs, qu'on lui
 * recopie : il ne lit pas les réglages du panneau. Aucun jour actif : pas d'alarme.
 */
export function armeRappel(){
  if(!IS_EXT || typeof chrome === 'undefined' || !chrome.alarms) return;
  const c = secu();
  try{ chrome.storage.local.set({fsRappelCfg: {jours: c.jours, rappel: c.rappel}}); }catch(e){}
  if(!c.jours.length){ chrome.alarms.clear('fsRappel'); return; }
  chrome.alarms.create('fsRappel', {when: prochaineHeure(c.rappel, Date.now()), periodInMinutes: 1440});
}
