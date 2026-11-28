/* ---------- les débordements ----------
   Ce qu'un hangar plein fait perdre à l'heure (`pertesParHeure`), le journal
   des débordements sur sept jours glissants (`SURPLUS_LOG`, `surplusNote`,
   `surplusCompte`), le hangar qu'il justifie (`hangarSiJustifie`) et la
   phrase qui le dit (`debordeTexte`).

   Domaine de l'issue #49. Il ne lit que le noyau, la production et le moteur
   de règles, plus `planetById` et `rankUpgrades` d'app.js, appelés et jamais
   lus au chargement : le plan du jour l'importe, il n'importe pas le plan. */
import { S } from '../core/etat.js';
import { B, levelCost } from '../core/formules.js';
import { planetById } from '../core/planetes.js';
import { buildTime } from '../core/serveur.js';
import { production, NOM_RES, stockNow, upLabel } from './production.js';
import { regleParam, HANGARS } from '../regles/moteur.js';
import { rankUpgrades } from '../../app.js';

/* ---------- ressources en trop ---------- */
/**
 * Ce qu'un plafond coûte : la production horaire arrêtée, et sa valeur en
 * métal au ratio du joueur — c'est elle qui classe les débordements entre eux,
 * un cristal arrêté valant plus qu'autant de métal.
 * @returns {{res:number, eqM:number}}
 */
export function pertesParHeure(p, k, pr){
  pr = pr || production(p);
  const r = Math.max(0, [pr.m, pr.c, pr.d][k] || 0), ratio = S.settings.ratio || [3, 2, 1];
  return {res:r, eqM:r * ratio[0] / ratio[k]};
}

/* L'historique des débordements, propre au poste (chrome.storage.local, hors
   de S et de la synchro). Une entrée par débordement : planète, ressource,
   début, fin — fin vide tant qu'il dure. Sept jours glissants : c'est ce qui
   dit si le hangar est trop petit pour de bon, ou si une livraison ponctuelle
   l'a rempli une fois. `var` : un rendu peut passer avant cette ligne. */
var SURPLUS_GARDE_MS = 7 * 864e5;
var SURPLUS_LOG = (() => {
  const v = typeof window !== 'undefined' ? window.__surplusLog : null;
  return Array.isArray(v) ? v.filter(e => e && typeof e.pid === 'string' && [0, 1, 2].includes(e.k) && Number.isFinite(e.d)) : [];
})();
/**
 * Note les débordements de l'instant : en ouvre un pour chaque ressource au
 * plafond qui n'en a pas, ferme ceux qui sont redescendus, oublie ce qui a
 * plus de sept jours. N'écrit que si quelque chose a changé.
 * @returns {boolean} vrai si l'historique a changé
 */
export function surplusNote(now){
  if(S.sample) return false;
  const seuil = regleParam('RES_STORAGE_FULL', 'seuil', .98);
  let change = false;
  for(const p of S.planets || []){
    if(!p || !p.stock) continue;
    const pr = production(p), st = stockNow(p);
    for(let k = 0; k < 3; k++){
      const ouvert = SURPLUS_LOG.find(e => e.pid === p.id && e.k === k && e.f == null), plein = st[k] >= pr.cap[k] * seuil;
      if(plein && !ouvert){ SURPLUS_LOG.push({pid:p.id, k, d:now, f:null}); change = true; }
      else if(!plein && ouvert){ ouvert.f = now; change = true; }
    }
  }
  const garde = SURPLUS_LOG.filter(e => (e.f == null ? now : e.f) >= now - SURPLUS_GARDE_MS && planetById(e.pid));
  if(garde.length !== SURPLUS_LOG.length){ SURPLUS_LOG = garde; change = true; }
  if(change && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local)
    try{ const r = chrome.storage.local.set({surplusLog: SURPLUS_LOG.map(e => Object.assign({}, e))}); if(r && r.catch) r.catch(e => console.error('Copilote : historique des débordements non enregistré', e)); }
    catch(e){ console.error('Copilote : historique des débordements non enregistré', e); }
  return change;
}
/** Combien de fois cette ressource a débordé sur cette planète en sept jours, celui en cours compris. */
export function surplusCompte(pid, k, now){
  now = now == null ? Date.now() : now;
  return SURPLUS_LOG.filter(e => e.pid === pid && e.k === k && (e.f == null ? now : e.f) >= now - SURPLUS_GARDE_MS).length;
}
/**
 * Le hangar, en dernier recours : seulement si la ressource a débordé au
 * moins `recurrence` fois en sept jours, ou si la prochaine mine coûte plus
 * que le hangar ne contient (RES_MINE_BLOCKED_BY_STORAGE). Un débordement de
 * livraison ponctuelle ne le justifie pas : il coûte cher, met des heures, et
 * ne sert plus une fois le stock redescendu.
 */
export function hangarSiJustifie(p, k){
  const pr = production(p), n = surplusCompte(p.id, k), seuil = regleParam('RES_STORAGE_FULL', 'recurrence', 3);
  const best = rankUpgrades(p).filter(u => u.payback < Infinity && B[u.key])[0];
  const bc = best ? (best.extraSolar ? levelCost(B.solar, p.b.solar + 1) : levelCost(B[best.key], best.lvl)) : null;
  const bloque = !!bc && bc[k] > pr.cap[k];
  if(n < seuil && !bloque) return null;
  const [name, bk] = HANGARS[k], lvl = (p.b[bk] || 0) + 1, duree = buildTime(bk, lvl, p);
  return {type:'hangar', what:`${name} ${lvl}`, k:bk, lvl, cost:levelCost(B[bk], lvl), duree,
    pourquoi:bloque ? `${upLabel(best)} coûte plus que la capacité actuelle` : `${n} débordements de ${NOM_RES[k]} en 7 jours`};
}
/** « À l'arrivée, Erablis dépassera sa capacité en cristal : la mine s'arrêtera. » */
export function debordeTexte(nom, js){
  if(!js || !js.length) return '';
  const mines = js.filter(j => j < 2).length, synth = js.includes(2);
  const sujet = [mines > 1 ? 'les mines' : mines ? 'la mine' : '', synth ? 'le synthétiseur' : ''].filter(Boolean);
  return `À l'arrivée, ${nom} dépassera sa capacité en ${js.map(j => NOM_RES[j]).join(' et ')} : ${sujet.join(' et ')} s'arrêter${sujet.length > 1 || mines > 1 ? 'ont' : 'a'}.`;
}
