/* ---------- le temps du panneau ----------
   Les heures (serveur ou locale) et les durées, telles que le panneau les
   écrit. Module du noyau (issue #49) : il n'importe que l'état, pour le
   décalage du serveur que le script de page relève (`S.srvTz`).

   Le mode des heures (`timeMode`) vit ici ; un autre module le lit mais ne
   le réassigne pas : setTimeMode (app.js), qui enregistre le choix et
   redessine, passe par poseModeHeure. */
import { S } from './etat.js';

export function dur(sec){ if(!isFinite(sec)) return 'jamais'; sec=Math.max(0,Math.round(sec)); const d=Math.floor(sec/86400), h=Math.floor(sec%86400/3600), m=Math.floor(sec%3600/60), s=sec%60; if(d) return `${d}j ${h}h`; if(h) return `${h}h ${String(m).padStart(2,'0')}m`; if(m) return `${m}m ${String(s).padStart(2,'0')}s`; return `${s}s`; }

/* ---------- les heures du panneau : serveur ou locale ----------

   Le jeu vit à l'heure de son serveur, le joueur à la sienne, et l'écart
   bouge deux fois l'an — l'Europe et l'Amérique ne changent pas d'heure le
   même dimanche. Les instants restent donc partout des millisecondes UTC ;
   seul `formatTime` choisit un fuseau, au moment d'écrire. Tout le panneau
   passe par lui : le mode s'applique partout ou nulle part.

   L'heure locale est celle du navigateur, que `Date` connaît déjà avec ses
   changements d'heure. L'heure serveur se déduit du décalage du serveur sur
   UTC, relu par le script de page à chaque page du jeu (`S.srvTz`). Tant
   qu'aucune page ne l'a donné, il n'y a pas d'heure serveur à montrer : on
   montre la locale et l'infobulle le dit. */
export const LOCAL_TZ = (()=>{ try{ return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; }catch(e){ return ''; } })();

/* `var` : header() peut s'exécuter avant que cette ligne soit atteinte. */
export var timeMode = (typeof window !== 'undefined' && window.__timeMode === 'local') ? 'local' : 'server';

/** Le décalage du serveur sur UTC en secondes, ou null s'il n'a jamais été lu. */
export function srvOffSec(){ const z = S && S.srvTz; return z && Number.isFinite(z.off) ? z.off : null; }

/** Le fuseau réellement affiché : le serveur demandé mais inconnu retombe sur la locale. */
export function timeZoneShown(){ return timeMode === 'server' && srvOffSec() != null ? 'server' : 'local'; }

/** Jour, heure, minute d'un instant, dans le fuseau dit. */
export function clockParts(ms, zone){
  const off = zone === 'server' ? srvOffSec() : null;
  if(off != null){ const d = new Date(ms + off*1000); return {y:d.getUTCFullYear(), mo:d.getUTCMonth(), d:d.getUTCDate(), h:d.getUTCHours(), mi:d.getUTCMinutes(), s:d.getUTCSeconds(), wd:d.getUTCDay()}; }
  const d = new Date(ms); return {y:d.getFullYear(), mo:d.getMonth(), d:d.getDate(), h:d.getHours(), mi:d.getMinutes(), s:d.getSeconds(), wd:d.getDay()};
}

export const JOURS_COURTS = ['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'];

export const p2 = n => String(n).padStart(2, '0');

/** L'heure d'un instant dans un fuseau : « 18:29 », « demain 04:12 », « jeu. 07:00 ». */
export function clockText(ms, zone, opts){
  const c = clockParts(ms, zone), n = clockParts(Date.now(), zone);
  const t = p2(c.h) + ':' + p2(c.mi);
  // l'écart en jours civils du fuseau, pas en tranches de 24 h : un changement d'heure ne le fausse pas
  const ecart = Math.round((Date.UTC(c.y, c.mo, c.d) - Date.UTC(n.y, n.mo, n.d)) / 864e5);
  if(ecart === 0) return t;
  if(opts && opts.date) return `${t} le ${p2(c.d)}/${p2(c.mo+1)}/${c.y}`;
  if(ecart === 1) return 'demain ' + t;
  if(Math.abs(ecart) < 7) return JOURS_COURTS[c.wd] + ' ' + t;
  return `${p2(c.d)}/${p2(c.mo+1)} ${t}`;
}

/* Ce que formatTime a écrit, et pour quel instant : l'infobulle s'en sert
   pour retrouver l'instant derrière un texte déjà posé dans la page — même
   quand ce texte a traversé esc() au milieu d'une phrase. Deux instants qui
   s'écrivent pareil tombent à la même minute : leur autre fuseau aussi. */
export var timeSeen = new Map();

/**
 * La seule façon d'écrire une heure dans le panneau.
 * @param {number} timestampUtc instant en millisecondes UTC
 * @param {{date?:boolean}} [opts] `date` : la date en entier hors du jour même
 * @returns {string} l'heure dans le mode choisi (serveur ou locale)
 */
export function formatTime(timestampUtc, opts){
  const txt = clockText(timestampUtc, timeZoneShown(), opts);
  if(timeSeen.size > 600) timeSeen.clear();
  timeSeen.set(txt, timestampUtc);
  return txt;
}

/** Ce que dit l'infobulle d'une heure : la même dans l'autre fuseau. */
export function timeTitle(ms){
  if(srvOffSec() == null) return 'heure locale · heure serveur pas encore lue : ouvre une page du jeu';
  const autre = timeZoneShown() === 'server' ? 'local' : 'server';
  const verif = S.srvTz && S.srvTz.ok === false ? ' · décalage non vérifié' : '';
  return clockText(ms, autre) + (autre === 'server' ? ' heure serveur' : ' heure locale') + verif;
}

/** Change le mode des heures (déjà normalisé) et oublie les heures écrites dans l'ancien. */
export function poseModeHeure(m){ timeMode = m; timeSeen.clear(); }
