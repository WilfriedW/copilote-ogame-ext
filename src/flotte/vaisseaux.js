/* ---------- les vaisseaux ----------
   Ce qu'est un vaisseau (`SHIPS`), ce qu'il emporte et ce qu'il consomme
   (`shipStats`, `souteUtile`), le temps et le carburant d'un vol (`distance`,
   `flight`), les noms à l'écran (`shipList`, `shipCourt`), et les flottes
   en vol relevées sur la page du jeu (`mouvements`, `flotteEnVol`).

   Module de domaine (issue #49). Les coûts du chantier (`SHIP_COST`,
   `SHIP_REQ`) sont dans coques.js ; la défense y recopie ses noms et ses
   prix à son chargement. Ce module emprunte encore à app.js les facteurs du serveur
   et quelques formats : ce cycle-là est toléré tant qu'app.js existe, et rien
   n'y est lu au chargement. */
import { S } from '../core/etat.js';
import { fmtLigne } from '../core/format.js';
import { API, fleetSpeed, fuelFactor, hyperCargoPct } from '../core/serveur.js';

export const SHIPS = {
  sc:  {n:'Petit transporteur', cargo:5000, speed:5000, drive:'combustion', fuel:10, transporter:true, bou:10},
  lc:  {n:'Grand transporteur', cargo:25000, speed:7500, drive:'combustion', fuel:50, transporter:true, bou:25},
  pf:  {n:'Éclaireur', cargo:10000, speed:12000, drive:'hyperdrive', fuel:300, bou:100},
  lf:  {n:'Chasseur léger', cargo:50, speed:12500, drive:'combustion', fuel:20, bou:10},
  hf:  {n:'Chasseur lourd', cargo:100, speed:10000, drive:'impulse', fuel:75, bou:25},
  cr:  {n:'Croiseur', cargo:800, speed:15000, drive:'impulse', fuel:300, bou:50},
  bs:  {n:'Vaisseau de bataille', cargo:1500, speed:10000, drive:'hyperdrive', fuel:500, bou:200},
  bc:  {n:'Traqueur', cargo:750, speed:10000, drive:'hyperdrive', fuel:250, bou:400},
  bb:  {n:'Bombardier', cargo:500, speed:4000, drive:'impulse', fuel:700, bou:500},
  ds:  {n:'Destructeur', cargo:2000, speed:5000, drive:'hyperdrive', fuel:1000, bou:500},
  rp:  {n:'Faucheur', cargo:10000, speed:7000, drive:'hyperdrive', fuel:1100, bou:700},
  rec: {n:'Recycleur', cargo:20000, speed:2000, drive:'combustion', fuel:300, bou:10},
  col: {n:'Vaisseau de colonisation', cargo:7500, speed:2500, drive:'impulse', fuel:1000, bou:100},
  pr:  {n:'Sonde d\'espionnage', cargo:0, speed:100000000, drive:'combustion', fuel:1, bou:0.01},
};
const DRIVE_BONUS = {combustion:.1, impulse:.2, hyperdrive:.3};

/* ---------- fleet formulas ---------- */
export function parseC(s){ const m=String(s).trim().match(/^(\d+)\s*:\s*(\d+)\s*:\s*(\d+)$/); return m ? m.slice(1).map(Number) : null; }
export function distance(a,b){
  if(a[0]!==b[0]) return 20000*Math.abs(a[0]-b[0]);
  if(a[1]!==b[1]){ let d = Math.abs(a[1]-b[1]); const sv = API && API.server; if(sv && sv.donutSystem) d = Math.min(d, sv.systems - d); return 2700 + 95*d; }
  if(a[2]!==b[2]) return 1000 + 5*Math.abs(a[2]-b[2]);
  return 5;
}
/**
 * Ce qu'une flotte peut vraiment emporter : le carburant voyage dans la soute,
 * donc il en sort. Sans ça le copilote annonce un butin, une mise à l'abri ou
 * un kit de colonie que la flotte ne peut pas charger.
 * @param {number} cargo soute brute
 * @param {number} fuel plein du trajet, aller-retour compris quand il y en a un
 * @returns {number}
 */
export const souteUtile = (cargo, fuel) => Math.max(0, cargo - fuel);
/** Effective drive, speed and fuel of a ship given current research. */
export function shipStats(k){
  const sh = Object.assign({}, SHIPS[k]), t=S.tech;
  if(k==='sc' && t.impulse>=5){ sh.speed=10000; sh.drive='impulse'; sh.fuel=20; }
  if(k==='bb' && t.hyperdrive>=8){ sh.speed=5000; sh.drive='hyperdrive'; sh.fuel=1000; }
  if(k==='rec'){ if(t.hyperdrive>=15){ sh.speed=6000; sh.drive='hyperdrive'; sh.fuel=900; } else if(t.impulse>=17){ sh.speed=4000; sh.drive='impulse'; sh.fuel=600; } }
  sh.speedEff = sh.speed*(1 + t[sh.drive]*DRIVE_BONUS[sh.drive] + ((sh.transporter && S.settings.cls==='collector') ? 1 : 0));
  sh.cargoEff = Math.floor(sh.cargo*(1 + hyperCargoPct()/100*t.hyper + ((sh.transporter && S.settings.cls==='collector' && S.settings.colCargo) ? .25 : 0)));
  return sh;
}
export function flight(from, to, ships, pct){
  const a=parseC(from), b=parseC(to); if(!a||!b) return null;
  const list = Object.entries(ships).filter(([,n])=>n>0).map(([k,n])=>({...shipStats(k),k,n}));
  if(!list.length) return null;
  const D = distance(a,b), V = Math.min(...list.map(s=>s.speedEff)), fs=fleetSpeed();
  const secs = (10 + 35000/(pct/10)*Math.sqrt(10*D/V))/fs;
  let cons = 0;
  for(const s of list){ const spd = 35000/(secs*fs - 10)*Math.sqrt(D*10/s.speedEff); cons += s.n*s.fuel*D/35000*Math.pow(spd/10+1,2); }
  const fuel = Math.round(cons * fuelFactor())+1;
  return {D, V, secs:Math.round(secs), fuel, cargo:souteUtile(list.reduce((x,s)=>x+s.n*s.cargoEff,0), fuel), slowest:SHIPS[list.find(s=>s.speedEff===V).k].n};
}

export const SHIP_PLURAL = {crawl:'foreuses', sc:'petits transporteurs', lc:'grands transporteurs', pf:'éclaireurs', lf:'chasseurs légers', hf:'chasseurs lourds', cr:'croiseurs', bs:'vaisseaux de bataille', bc:'traqueurs', bb:'bombardiers', ds:'destructeurs', rp:'faucheurs', rec:'recycleurs', col:'vaisseaux de colonisation', pr:"sondes d'espionnage"};
/* DEF complète ces deux tables avec les noms de la défense. */
export const SHIP_ONE = {crawl:'foreuse'};
export function shipList(ships){ return Object.entries(ships||{}).filter(([,n])=>n>0).map(([k,n])=>`${n} ${n>1 ? SHIP_PLURAL[k] : SHIPS[k] ? SHIPS[k].n.toLowerCase() : SHIP_ONE[k] || SHIP_PLURAL[k]}`).join(', '); }

/* ---------- flottes en mouvement ---------- */
/* Les flottes qui volent, miennes et hostiles, telles que le jeu les a déjà
   affichées au joueur (encart des événements, page Mouvements de flotte). Le
   copilote n'en demande aucune au serveur : ce qu'il n'a pas vu, il ne le sait
   pas — et le plan le dit plutôt que de l'inventer.

   Deux usages :
   - la projection des ressources : une construction que le convoi de 7 h 12
     rendra finançable s'annonce « Finançable à 07:12 (convoi …) » au lieu d'un
     « dans 9 h » qui ne regardait que la production ;
   - le plan de sécurité : sur une attaque entrante, et chaque soir à l'heure
     de mise à l'abri choisie. Le plan liste, il ne lance rien : « Préparer »
     ouvre le formulaire de flotte du jeu, l'envoi reste le clic du joueur. */

/* Le nom court qu'emploient les joueurs francophones. « 30 GT » se lit d'un
   coup d'œil dans un tableau ; « 30 grands transporteurs » non. */
export const SHIP_COURT = {sc:'PT', lc:'GT', lf:'CLE', hf:'CLO', cr:'CR', bs:'VB', bc:'TRA', bb:'BMD', ds:'DST', rip:'EDLM', rp:'FAU', pf:'ECL', rec:'REC', col:'VC', pr:'SE', sat:'SAT', crawl:'FOR'};
/** « 30 GT, 2 SE » : la flotte, en abrégé. */
export function shipCourt(ships){ return Object.entries(ships||{}).filter(([,n])=>n>0).map(([k,n])=>`${fmtLigne(n)} ${SHIP_COURT[k] || k}`).join(', ') || '—'; }
/** « 1 237 500 / 0 / 0 » : le format du tableau, en entier, sans arrondi. */
export const mcd = c => (c || [0,0,0]).map(x=>fmtLigne(Math.max(0, x||0))).join(' / ');

/** Ma planète à ces coordonnées, ou null. Les coordonnées ne désignent pas
    une planète de façon sûre (ADR 0001) : elles ne servent ici qu'à relier un
    mouvement que le jeu décrit par ses coordonnées, et rien n'est enregistré. */
export function planeteEn(coords){ return coords ? S.planets.find(p => p.coords === coords) || null : null; }

/**
 * Les mouvements, normalisés : un objet par trajet, aller ou retour, avec où
 * il se pose. Le retour d'un aller est rattaché quand le jeu l'affiche.
 * @returns {Array<{id, mission, sens, hostile, camp, origine, cible, arrivee, retour, vaisseaux, cargaison, pose, m}>}
 */
export function mouvements(){
  const out = (S.moves || []).filter(m => m && Number.isFinite(+m.arrival)).map(m => ({
    id: m.id || null, mission: +m.mission, sens: m.ret ? 'retour' : 'aller',
    hostile: !!m.hostile, camp: m.camp || (m.hostile ? 'hostile' : 'own'),
    origine: {coords: m.origin || '', nom: m.originName || (planeteEn(m.origin)||{}).name || ''},
    cible: {coords: m.dest || '', nom: m.destName || (planeteEn(m.dest)||{}).name || ''},
    arrivee: m.arrival * 1000, retour: null,
    vaisseaux: m.ships || {}, cargaison: Array.isArray(m.cargo) ? m.cargo.map(x => +x || 0) : null,
    /* Où la flotte se pose : la cible à l'aller, l'origine au retour. */
    pose: m.ret ? m.origin : m.dest, m}));
  for(const a of out) if(a.sens === 'aller'){
    const r = out.find(x => x.sens === 'retour' && x.mission === a.mission && x.origine.coords === a.origine.coords && x.cible.coords === a.cible.coords && x.arrivee > a.arrivee);
    if(r) a.retour = r.arrivee;
  }
  return out.sort((a, b) => a.arrivee - b.arrivee);
}

/** Les vaisseaux à quai qui peuvent voler (satellites et foreuses restent au sol). */
export function aQuai(p){ return Object.fromEntries(Object.entries(p.ships || {}).filter(([k, n]) => SHIPS[k] && n > 0)); }
/**
 * Fleet slots [used, max] from the last sync, or null.
 * Le chiffre lu date de la dernière page de flotte ouverte ; une mission
 * lancée depuis occupe un emplacement que ce chiffre ignore. Le copilote la
 * connaît — c'est son minuteur —, alors il la compte. La prochaine lecture la
 * contient à son tour : le dédoublonnage se fait sur l'heure.
 */
export function fleetSlots(){
  if(!(S.slots && S.slots.fleet && S.syncAt && Date.now()-(S.slots.at||S.syncAt) < 3*3600e3)) return null;
  const [pris, max] = S.slots.fleet, lu = S.slots.at || S.syncAt, now = Date.now();
  const depuis = (S.timers||[]).filter(t=>t.kind==='x' && (t.k==='fleet' || t.k==='expo')
    && t.manual && !t.done && t.end>now && t.at>lu).length;
  return [Math.min(max, pris+depuis), max];
}

/* Une carte de flotte dit d'envoyer des vaisseaux quelque part. Quand le
   joueur l'a fait dans le jeu, le mouvement est là, dans les mouvements de
   flotte : le lui faire confirmer d'un clic, c'est lui demander de répéter ce
   que le copilote voit déjà. Même règle que la sonde d'espionnage posée par
   applyGame.
   Transporter et Stationner se valent ici : tous deux livrent la soute là où
   elle manque, et le joueur qui prend l'un pour l'autre a fait le geste.
   L'expédition est hors du compte : rien ne distingue une mise à l'abri d'une
   expédition ordinaire — même mission, même position 16 — et la confondre
   éteindrait la carte du soir tous les jours sans que rien ne soit à l'abri. */
export function flotteEnVol(m){
  if(!m.dest || !m.mission || m.mission === 15) return false;
  const vaut = (a, b) => a === b || ((a === 3 || a === 4) && (b === 3 || b === 4));
  /* Les mouvements de flotte du jeu portent aussi ceux des autres : un
     transport d'allié vers chez soi éteindrait une carte que personne n'a
     honorée. Un geste du joueur part d'une de ses planètes. */
  /* Depuis que chaque planète a sa carte, deux lots peuvent viser la même
     destination : sans regarder d'où part le mouvement, un seul envoi éteignait
     les cartes des voisines, et leur stock passait la nuit au sol. */
  const de = S.planets[m.p];
  return (S.moves || []).some(v => !v.ret && v.dest === m.dest && vaut(v.mission, m.mission)
    && (de && de.coords ? v.origin === de.coords : S.planets.some(p => p.coords === v.origin)));
}
