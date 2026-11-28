/* ---------- la place des formes de vie dans le plan ----------
   Le réglage qui dit si le plan du jour sert les formes de vie avant les
   bâtiments, après, ou pas du tout (`LF_MODE`, `lfMode`).

   Module de domaine (issue #49). Il ne lit que l'état : le moteur de règles
   s'en sert pour taire les règles des formes de vie, et le loger avec les
   cases fermerait un cycle avec le moteur, dont les cases lisent les noms. */
import { S } from '../core/etat.js';

/* Place des formes de vie dans la journée. Par défaut elles passent après les
   bâtiments et s'effacent devant ce qu'un chantier proche épargne. */
/* « Avant tout le reste » laissait entendre que les cases passent aussi devant
   la recherche : vrai quand la recherche est « À son tour », faux dès qu'elle
   est « Avant les bâtiments », où le plan la sert d'abord. Les deux menus
   parlent de la même chose — la place par rapport aux bâtiments — et un seul
   des deux le disait. */
export const LF_MODE = {after:'Après les bâtiments', first:'Avant les bâtiments', off:'Ne pas s\'en occuper'};
export function lfMode(){ return LF_MODE[S.day.lf] ? S.day.lf : 'after'; }
