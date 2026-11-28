/* ---------- le fichier des règles ----------
   Ce que boot.js a lu de rules.json (`window.__rules`), complété d'un fichier
   vide quand il est illisible (`REGLES`, `REGLES_ERR`), et le test de clé
   propre que tout lecteur du fichier emploie (`aSoi`).

   Module de domaine (issue #49), sous le moteur : les formes de vie y lisent
   leurs espèces, et le moteur lit la race d'une planète. Logé dans le
   moteur, le fichier fermait un cycle entre les deux. */

const REGLES_VIDE = () => ({version:0, regles:[], mineBalance:{byStyle:{}, byPosition:{}}, lifeforms:{}});
/* Un fichier illisible ne bloque rien : le moteur d'avant tourne, ses secours et
   ses cartes existent sans rules.json, ils perdent seulement leurs réglages. */
export const REGLES_ERR = (()=>{ const r = window.__rules; return r && typeof r === 'object' && Array.isArray(r.regles) ? '' : 'règles illisibles : le moteur tourne sans réglages'; })();
export const REGLES = REGLES_ERR ? REGLES_VIDE() : Object.assign(REGLES_VIDE(), window.__rules);
export const aSoi = (o, k) => !!o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
