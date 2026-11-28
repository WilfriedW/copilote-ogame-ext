/* ---------- l'itinéraire d'une carte de flotte (ENH-83) ----------
   D'où, vers où, quoi, quand : quatre lignes que toutes les cartes qui
   déplacent des vaisseaux d'une planète à l'autre dessinent de la même façon.
   Le rapatriement du plan, le transfert d'excédent, la mise à l'abri et le
   rééquilibrage avaient chacun la leur, et le joueur décodait la source dans
   une pastille, la destination dans le titre et la cargaison au milieu. */
import { esc, fmtLigne, planetRef, planetTag } from '../core/format.js';
import { dur, formatTime } from '../core/temps.js';
import { SHIP_COURT, planeteEn } from '../flotte/vaisseaux.js';

const NOMS = ['Métal', 'Cristal', 'Deutérium'];

/** « Cristal 1 725 693 · Deutérium 64 556 » : un seul format, les zéros omis. */
export function chargeTexte(res){
  return (res || []).map((x, j) => x > 0 ? `${NOMS[j]} ${fmtLigne(x)}` : '').filter(Boolean).join(' · ');
}
/** « 12 GT · 3 PT » */
export function vaisseauxTexte(ships){
  return Object.entries(ships || {}).filter(([, n]) => n > 0).map(([k, n]) => `${fmtLigne(n)} ${SHIP_COURT[k] || k}`).join(' · ');
}
/** Une planète du joueur en pastille, ses coordonnées à côté ; une cible hors empire, ses coordonnées seules. */
function bout(p, coords){
  const c = (p && p.coords) || coords || '';
  return `<span class="bout">${p ? planetTag(planetRef(p)) + ' ' : ''}<span class="mono">${esc(c)}</span></span>`;
}

/**
 * Le bloc d'itinéraire d'une carte de flotte.
 * @param {{src:object, dest:string, ships?:object, res?:number[], dur?:number, end?:number, retour?:number, suite?:string, mission?:string}} r
 *   `dur` en secondes, `end` et `retour` en millisecondes ; `suite` annonce
 *   une seconde étape (le Transporter chargé après un Stationner à vide) ;
 *   `mission` se nomme quand le titre de la carte ne le fait pas.
 * @returns {string}
 */
export function routeHtml(r){
  if(!r || !r.src || !r.dest) return '';
  const charge = chargeTexte(r.res), vx = vaisseauxTexte(r.ships);
  const temps = [r.mission || '', r.dur ? `Vol ${dur(r.dur)}` : '', r.end ? `arrivée ${formatTime(r.end)}` : '', r.retour ? `retour ${formatTime(r.retour)}` : ''].filter(Boolean).join(' · ');
  return `<div class="route"><div class="iti">${bout(r.src)}<span class="fleche" aria-label="vers">→</span>${bout(planeteEn(r.dest), r.dest)}</div>`
    + (charge || vx ? `<div class="cargo">${charge ? `<span>${esc(charge)}</span>` : ''}${vx ? `<span class="vx">${esc(vx)}</span>` : ''}</div>` : '')
    + (temps ? `<div class="temps">${esc(temps)}</div>` : '')
    + (r.suite ? `<div class="note">${esc(r.suite)}</div>` : '') + `</div>`;
}
