/* ---------- la nuit et le réveil ----------
   La fenêtre de nuit du joueur (`nightLen`, `isNight`), une absence de jour
   (`absenceJour`), l'heure de réveil qui borne la mise à l'abri et les
   expéditions (`wakeTime`), et la lecture des heures saisies (`poseHeure`,
   `heureMin`, `hhmmDe`, `heureTxt`).

   Module du plan du jour (issue #49). Il ne dépend que du noyau, pour que
   la sécurité, les expéditions et le plan puissent tous l'importer sans
   cycle. */
import { S } from '../core/etat.js';
import { p2 } from '../core/temps.js';
/* Le début et la fin de nuit — le coucher et le réveil — se règlent à la minute. Elle reste un
   nombre d'heures, décimal (7,5 pour 7 h 30) : une sauvegarde ou une synchro
   d'avant, qui porte 7, se lit telle quelle. Arrondie à la minute partout où
   elle devient un instant. */
/** [heures, minutes] d'une heure décimale. */
function heureMin(h){ const m = Math.round((+h || 0) * 60); return [Math.floor(m / 60) % 24, m % 60]; }
/** Pose l'heure décimale `h` sur la date `d`, secondes à zéro. */
export function poseHeure(d, h){ const [H, M] = heureMin(h); d.setHours(H, M, 0, 0); return d; }
/** « 07:30 » : la valeur d'un champ `type=time`. */
export function hhmmDe(h){ const [H, M] = heureMin(h); return `${p2(H)}:${p2(M)}`; }
/** « 7h », « 7h30 » : l'heure dans une phrase. */
export function heureTxt(h){ const [H, M] = heureMin(h); return M ? `${H}h${p2(M)}` : `${H}h`; }
export function isNight(ms){ const d=new Date(ms), h=d.getHours()+d.getMinutes()/60, a=+S.day.nightStart, b=+S.day.nightEnd; if(a===b) return false; return a>b ? (h>=a || h<b) : (h>=a && h<b); }

/* ---------- la nuit et le réveil ---------- */
/** Longueur de la fenêtre de nuit, en heures ; huit quand elle est vide. */
export function nightLen(){ return (+S.day.nightEnd - +S.day.nightStart + 24) % 24 || 8; }
/**
 * Le mode nuit lancé loin de la nuit : une absence de jour, pas un coucher.
 *
 * Une heure de retour donnée tranche toute seule — le joueur sait mieux que le
 * réglage quand il rentre. Sans heure, c'est la distance au coucher qui dit
 * laquelle des deux lectures tient : plus près qu'une nuit, c'est un coucher, et
 * la fenêtre de nuit répond mieux qu'une durée inventée ; plus loin, le joueur
 * s'absente. Le bandeau du coucher sort une heure avant la nuit, et un « oui »
 * y veut dire « je vais dormir » : sans ce seuil il aurait voulu dire « je
 * m'absente huit heures », soit un retour à six heures au lieu de sept.
 */
export function absenceJour(now){
  if(!S.day.night || isNight(now)) return false;
  if(S.day.backHour != null) return true;
  const d = poseHeure(new Date(now), +S.day.nightStart);
  if(d.getTime() <= now) d.setDate(d.getDate()+1);
  return d.getTime() - now > nightLen()*3600e3;
}

/**
 * Quand le joueur revient, et donc quand la flotte peut se reposer.
 *
 * La fin de la nuit ne répond que pour la nuit. Le mode nuit sert aussi à
 * partir la journée, et là elle répondait le matin SUIVANT : à 9 h, `wake`
 * tombait au lendemain 7 h, et fsFor() ne gardait que des vols de vingt-deux
 * heures — ou rien du tout. L'absence de jour se cale donc sur l'heure de
 * retour donnée dans les Réglages, et à défaut sur la longueur d'une nuit :
 * une absence sans heure reste une absence, pas une nuit de plus.
 * @returns {number|null} l'instant du retour, null si aucune nuit n'est réglée
 */
export function wakeTime(now){
  if(absenceJour(now)){
    const h = S.day.backHour;
    if(h == null) return now + nightLen()*3600e3;
    const d = new Date(now); d.setHours(+h, 0, 0, 0);
    if(d.getTime() <= now) d.setDate(d.getDate()+1);
    return d.getTime();
  }
  const a = +S.day.nightStart, b = +S.day.nightEnd;
  if(a === b) return null;
  /* Déjà dans la nuit : elle a commencé la veille, et la ligne d'en dessous
     visait la nuit SUIVANTE — à minuit et demi, `wake` tombait au matin
     d'après, et la carte conseillait un vol de trente heures pour couvrir une
     nuit qui finissait dans six. Le mode nuit restant allumé toute la nuit,
     c'est le cas ordinaire dès que le panneau se redessine après le coucher. */
  if(isNight(now)){
    const e = poseHeure(new Date(now), b);
    if(e.getTime() <= now) e.setDate(e.getDate()+1);
    return e.getTime();
  }
  const s = poseHeure(new Date(now), a); if(s.getTime() <= now) s.setDate(s.getDate()+1);
  const e = poseHeure(new Date(s), b); if(e.getTime() <= s.getTime()) e.setDate(e.getDate()+1);
  return e.getTime();
}
