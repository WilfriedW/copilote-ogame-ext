/* ---------- ce que le serveur sait mieux que nous ----------
   Le panneau tourne-t-il dans l'extension (`IS_EXT`) ; les faits publiés
   par l'API du serveur (`API`, `srv`) et ce qu'on en tire : vitesses,
   carburant, recherche, soute (`ecoSpeed`, `fleetSpeed`, `fuelFactor`,
   `researchDiv`, `hyperCargoPct`), et la durée d'une construction
   (`buildTime`).

   Module du noyau (issue #49) : il n'importe que le noyau. `API` se
   remplace par `poseApi`, un import ne se réassignant pas. */
import { S } from './etat.js';
import { B, levelCost } from './formules.js';

export const IS_EXT = !!(window.chrome && window.chrome.runtime && window.chrome.runtime.id);
export let API = window.__api || null;
/** Le seul moyen, hors de ce module, de remplacer API : un import ne se réassigne pas. */
export function poseApi(v){ API = v; }

/* ---------- ce que le serveur sait mieux que nous ---------- */

/** Un fait publié par le serveur, ou la valeur de secours. Le panneau tourne
    aussi hors extension et avant la première réponse de l'API : le secours est
    ce que le copilote savait faire avant de la lire. */
export function srv(cle, secours){ const v = API && API.server ? API.server[cle] : null; return v == null ? secours : v; }

/** Vitesse économie : production, constructions, recherches, expéditions.
    Le serveur la publie ; la page du jeu la pose aussi dans les réglages, et
    c'est elle qui sert tant que l'API n'a pas répondu. */
export function ecoSpeed(){ return Math.max(1, srv('speed', S.settings.eco) || 1); }

/** Vitesse des missions pacifiques : transport, colonisation, expédition,
    recyclage. Le copilote ne chiffre pas de vol d'attaque, dont le serveur
    publie la vitesse à part (`speedFleetWar`). */
export function fleetSpeed(){ return Math.max(1, srv('speedFleetPeaceful', S.settings.fleet) || 1); }

/** Ce que le serveur fait payer en deutérium, par rapport à la formule de
    base. Un univers à 0,6 brûle 40 % de moins que ce que la formule annonce :
    sans ce facteur, chaque vol était surévalué et le copilote renonçait à des
    livraisons rentables. */
export function fuelFactor(){ return Math.max(0, srv('globalDeuteriumSaveFactor', 1)); }

/** Diviseur des durées de recherche, en plus de la vitesse économie. Il vaut
    1 là où le serveur ne dit rien : la formule d'avant, inchangée. */
export function researchDiv(){ return Math.max(1, srv('researchDurationDivisor', 1)); }

/** Soute gagnée par niveau d'Hyperespace, en pourcent. */
export function hyperCargoPct(){ return srv('cargoHyperspaceTechMultiplier', 5); }

/* ---------- game formulas ---------- */
/** Building time in seconds for a level on a given planet. */
export function buildTime(key, L, p){
  const c = levelCost(B[key], L);
  const lowLvl = (key==='nanite') ? 1 : Math.max(4 - L/2, 1);
  const h = (c[0]+c[1]) / (2500 * lowLvl * (1+p.b.robot) * Math.pow(2,p.b.nanite) * ecoSpeed());
  return Math.max(1, h*3600);
}
