/* ---------- deux postes, un seul plan ----------
   Le stockage local ne voyage pas : sur un deuxième ordinateur le panneau
   repart d'une copie à lui, et ne propose pas la même chose. Ce qui se
   redécouvre en jouant — niveaux, files, relevé de l'empire — reste local :
   chaque poste le relit des pages du jeu, et le partager donnerait au poste en
   retard le pouvoir d'écraser le poste à jour. Ce que le joueur décide, lui, ne
   se redécouvre pas : c'est cela qui voyage.
   Le pid est tiré au sort à la création de la planète, donc propre au poste ;
   le gid vient du jeu et vaut sur les deux. Même règle qu'à la frontière de la
   page du jeu : on traduit en sortie et en entrée, et S ne garde jamais de gid.

   Domaine de l'issue #49 : ce qui voyage (`syncOut`, `syncPush`), ce qui
   revient (`syncApply`) et le ménage des clés d'avant (`syncNettoie`). Les
   écoutes du stockage partagé restent dans app.js, à leur place dans l'ordre
   du démarrage. */
import { KEY, S } from '../core/etat.js';
import { gidDe } from '../core/planetes.js';
import { saveFailed, render, sainEtat, publieLePlan } from '../../app.js';
export const SYNC_KEYS = ['settings','day','expo','lf','raids','daily','profil'];
/* gidDe, l'aller, vit dans src/core/planetes.js ; le retour, qui ne sert qu'ici, reste ici. */
export const pidDe = gid => { const p = (S.planets || []).find(x => x.gid != null && String(x.gid) === String(gid)); return p ? p.id : null; };
/* Une recherche ne porte pas de pid : elle voyage telle quelle.
   L'ordre des clés compte, et c'est tout sauf cosmétique : syncApply compare au
   JSON, et le stockage partagé nous renvoie notre propre écriture. Reconstruite
   clé par clé dans un autre ordre, elle revenait méconnaissable — S.prio était
   remplacé, chg passait à vrai, et render() repassait toutes les dix secondes.
   Le joueur voyait le volet qu'il venait d'ouvrir se refermer sous ses doigts.
   On rebâtit donc dans l'ordre exact où prioPose range. */
export function prioOut(l){
  return (l || []).map(e => {
    if(!e || e.kind === 't' || !e.pid) return e;
    const gid = gidDe(e.pid); if(gid == null) return e;
    const o = {kind:e.kind, gid, k:e.k, lvl:e.lvl};
    if(Number.isInteger(e.puis)) o.puis = e.puis;
    return o;
  });
}
export function prioIn(l){
  return (l || []).map(e => {
    if(!e || e.gid == null) return e;
    // planète pas encore relevée ici : l'entrée attend, applyGame repassera
    const pid = pidDe(e.gid); if(!pid) return e;
    const o = {kind:e.kind, pid, k:e.k, lvl:e.lvl};
    if(Number.isInteger(e.puis)) o.puis = e.puis;
    return o;
  });
}
export function syncOut(){
  const out = {};
  for(const k of SYNC_KEYS) out['sy:' + k] = S[k];
  /* Une priorité posée sur une planète que le jeu ne nomme pas n'a pas de gid :
     l'envoyer la ferait disparaître au retour, puisque l'autre poste renverrait
     la liste sans elle. On n'envoie pas la liste, voilà tout. */
  const prio = prioOut(S.prio);
  if(prio.every(e => !e || e.kind === 't' || e.gid != null)) out['sy:prio'] = prio;
  const centre = gidDe(S.centre); if(centre != null) out['sy:centre'] = centre;
  return out;
}
/* save() part dès le chargement d'app.js : ce module est évalué avant lui,
   la minuterie existe donc déjà. */
let syncT = 0;
/* Le stockage partagé compte les écritures à la minute : on groupe, plutôt que
   d'écrire à chaque clic. */
export function syncPush(){
  if(typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.sync) return;
  clearTimeout(syncT);
  syncT = setTimeout(() => {
    try{ const r = chrome.storage.sync.set(syncOut()); if(r && r.catch) r.catch(syncFailed); }
    catch(e){ syncFailed(e); }
  }, 10000);
}
/* Le quota dépassé ou le navigateur déconnecté : le poste continue de jouer sur
   sa copie locale, mais le taire laisserait croire les deux postes d'accord. */
export function syncFailed(e){ console.error('Copilote : synchro entre postes impossible', e); }
/* Ce que notre propre écriture nous renvoie est déjà dans S : comparer évite le
   rendu pour rien, et surtout le va-et-vient entre deux panneaux ouverts. */
export function syncApply(d){
  if(!d) return;
  let chg = false;
  const met = (k, v) => { if(v === undefined || JSON.stringify(S[k]) === JSON.stringify(v)) return; S[k] = v; chg = true; };
  for(const k of SYNC_KEYS) met(k, d['sy:' + k]);
  sainEtat();
  if(d['sy:prio'] !== undefined) met('prio', prioIn(d['sy:prio']));
  if(d['sy:centre'] != null){ const pid = pidDe(d['sy:centre']); if(pid && pid !== S.centre){ S.centre = pid; chg = true; } }
  if(!chg) return;
  /* On enregistre sans repasser par save() : renvoyer ce qu'on vient de recevoir
     n'apprendrait rien à personne. */
  try{ LS.setItem(KEY, JSON.stringify(S)); }catch(e){ saveFailed(e); }
  render();
  publieLePlan();
}
/* Ce que le stockage partagé garde d'une version d'avant. La campagne du mode
   lune (`sy:lune`) n'a plus de lecteur depuis le retrait du mode : on l'efface
   une fois, plutôt que de la laisser occuper le quota. Rien d'autre n'est
   touché — un choix du joueur ne se réécrit pas. */
export function syncNettoie(d){
  if(!d || d['sy:lune'] === undefined) return;
  try{ const r = chrome.storage.sync.remove('sy:lune'); if(r && r.catch) r.catch(syncFailed); }catch(e){ syncFailed(e); }
}
