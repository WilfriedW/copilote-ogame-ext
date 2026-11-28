/* ---------- le palier d'une cible d'installation (ENH-70) ----------
   Une cible « Robots 10 » posée sur une planète à Robots 6 se payait niveau
   par niveau : un rapatriement pour Robots 7, un autre pour Robots 8, quatre
   emplacements de flotte et quatre trajets de deutérium là où un seul convoi
   suffisait. Ce module chiffre le palier entier et choisit qui l'apporte ;
   `simulateDay` pose ensuite les cartes. Rien ici ne lit l'état : tout arrive
   en arguments, pour que le calcul se vérifie sans simulation. */

import { B, rangeCost } from '../core/formules.js';
import { expoRes, expoFleet } from '../flotte/expeditions.js';
import { shipStats } from '../flotte/vaisseaux.js';

/** Les deux façons de livrer une cible, au choix du joueur (Réglages › Profil et plan du jour). */
export const LIVRAISON = {palier:'Le palier entier, jusqu\'au niveau visé', niveau:'Le niveau suivant seulement'};
/** Le mode de livraison, `palier` quand rien ou n'importe quoi d'autre n'est écrit. */
export function livraisonMode(day){ return day && day.livraison === 'niveau' ? 'niveau' : 'palier'; }

/**
 * Ce qu'il reste à payer de la cible : du niveau en cours jusqu'au niveau visé.
 * Un niveau déjà en chantier est payé : le palier repart du suivant, sans quoi
 * le convoi porterait deux fois le même niveau.
 * @param {number} actuel niveau construit
 * @param {boolean} enChantier le niveau suivant est en construction
 * @param {string} k bâtiment
 * @param {number} vise niveau visé par le joueur (ou le prérequis du moment)
 * @param {'palier'|'niveau'} mode
 * @returns {{k:string, de:number, a:number, vise:number, cost:number[]}|null} null quand il ne reste rien
 */
export function palierDe(actuel, enChantier, k, vise, mode){
  const de = (actuel || 0) + (enChantier ? 1 : 0);
  if(!B[k] || !(vise > de)) return null;
  const a = mode === 'niveau' ? de + 1 : vise;
  return {k, de, a, vise, cost:rangeCost(B[k], de, a)};
}

/**
 * Le manque à livrer, ressource par ressource : le coût du palier moins ce que
 * la destination a déjà de libre, ce qui est en route vers elle, et ce qu'elle
 * produira d'ici l'arrivée. En mode palier, plafonné à ce que ses hangars
 * peuvent loger : une livraison n'est pas plafonnée par le jeu, mais ce qui
 * dépasse arrête la mine.
 * @param {number[]} cost coût du palier
 * @param {number[]} libre stock libre de la destination
 * @param {number[]} enRoute cargaisons déjà en vol vers elle
 * @param {number[]} prodH production horaire de la destination
 * @param {number} heures délai jusqu'à l'arrivée
 * @param {number[]|null} cap capacité des hangars, null pour ne pas plafonner
 * @returns {{besoin:number[], plafond:number[]}} `plafond` : les ressources rabotées
 */
export function besoinPalier(cost, libre, enRoute, prodH, heures, cap){
  const besoin = [0, 0, 0], plafond = [];
  for(let j = 0; j < 3; j++){
    const deja = Math.max(0, libre[j]) + (enRoute[j] || 0) + Math.max(0, prodH[j] || 0) * heures;
    besoin[j] = Math.max(0, Math.ceil(cost[j] - deja));
    if(cap && besoin[j] > 0){
      const place = Math.max(0, Math.floor(cap[j] - deja));
      if(besoin[j] > place){ besoin[j] = place; plafond.push(j); }
    }
  }
  return {besoin, plafond};
}

/** Ce qu'une source apporte d'un besoin : sa part libre, rabotée à sa soute. */
function partDe(c, besoin){
  const x = besoin.map((b, j) => Math.max(0, Math.min(b, c.libre[j])));
  const s = x[0] + x[1] + x[2];
  if(s <= c.soute || s <= 0) return x;
  const k = c.soute / s;
  return x.map(v => Math.floor(v * k));
}
const sommeDe = x => x[0] + x[1] + x[2];

/**
 * Qui apporte le palier : le moins de convois possible, le deutérium ensuite.
 * 1. Une source qui couvre seule tout le besoin, la plus proche, puis la moins
 *    chère en carburant.
 * 2. Sinon deux au plus : la paire qui couvre le plus (au ratio du joueur), à
 *    couverture égale le moins de carburant ; la plus grosse part en premier.
 * @param {number[]} besoin
 * @param {{q:object, libre:number[], soute:number, dist:number, fuel:number}[]} cands
 * @param {(x:number[])=>number} valeur la valeur d'une cargaison, en équivalent métal
 * @returns {{q:object, charge:number[]}[]} vide quand personne n'apporte rien
 */
export function choisirSources(besoin, cands, valeur){
  if(!(sommeDe(besoin) > 0)) return [];
  const seules = cands.filter(c => c.soute >= sommeDe(besoin) && besoin.every((b, j) => c.libre[j] >= b))
    .sort((a, b) => a.dist - b.dist || a.fuel - b.fuel);
  if(seules.length) return [{q:seules[0].q, charge:besoin.slice()}];
  let mieux = null;
  const essai = (liste, fuel) => {
    const v = valeur(liste.reduce((t, s) => t.map((x, j) => x + s.charge[j]), [0, 0, 0]));
    if(v <= 0) return;
    /* Un convoi de moins vaut mieux qu'un peu plus de cargaison : la paire ne
       l'emporte sur une source seule que si elle apporte réellement plus. */
    if(!mieux || v > mieux.v + 1e-6 || (Math.abs(v - mieux.v) <= 1e-6 && (liste.length < mieux.liste.length || (liste.length === mieux.liste.length && fuel < mieux.fuel)))) mieux = {v, fuel, liste};
  };
  for(const a of cands){
    const pa = partDe(a, besoin);
    essai([{q:a.q, charge:pa}], a.fuel);
    for(const b of cands){
      if(b === a) continue;
      const pb = partDe(b, besoin.map((x, j) => x - pa[j]));
      if(!(sommeDe(pb) > 0)) continue;
      const liste = [{q:a.q, charge:pa}, {q:b.q, charge:pb}].sort((x, y) => valeur(y.charge) - valeur(x.charge));
      essai(liste, a.fuel + b.fuel);
    }
  }
  return mieux ? mieux.liste.filter(s => sommeDe(s.charge) > 0) : [];
}

/* Les transporteurs d'une source, partagés avec les ressources en trop (#44, #46). */
/** Les transporteurs que `p` peut prêter : ni le kit d'expédition, ni la réserve de GT (expoRes). */
export function flotteLibre(p){
  const sh = {lc:(p.ships || {}).lc || 0, sc:(p.ships || {}).sc || 0};
  sh.lc = Math.max(0, sh.lc - expoRes(p));
  const kit = expoFleet(p.ships, p);
  if(kit) for(const k of ['lc', 'sc']) sh[k] = Math.max(0, sh[k] - (kit.ships[k] || 0));
  return sh;
}
/** Les transporteurs libres pour lever `amount`, les grands d'abord. */
export function soutePour(libres, amount){
  const ships = {};
  let cargo = 0;
  for(const k of ['lc', 'sc']){
    const u = shipStats(k).cargoEff, n = Math.min(libres[k] || 0, u ? Math.ceil(Math.max(0, amount - cargo) / u) : 0);
    if(n > 0){ ships[k] = n; cargo += n * u; }
  }
  return ships;
}
/** Le moins qu'un transfert vaille : sous ce tonnage, le vol coûte plus d'attention qu'il ne rend. */
export var SURPLUS_MIN = 5000;
