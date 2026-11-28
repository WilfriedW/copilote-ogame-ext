/* ---------- l'en-tête ----------
   La fraîcheur du relevé et le bouton « Actualiser » (`releveAge`,
   `FRAIS_MS`, `majBouton`, `boutonMaj`), le relevé page par page qu'il lance
   (`releveEtapes`, `faitLeReleve`), l'en-tête lui-même (`header`), le choix
   heure locale ou serveur (`setTimeMode`) et le mode nuit (`modeNuit`,
   `finDeNuit`).

   Module des vues (issue #49), calé sur ENH-77. `scanEcran` se change par
   `poseScanEcran`, un import ne se réassignant pas. Ce module emprunte encore
   à app.js le rendu et la sauvegarde : ce cycle-là est toléré tant qu'app.js
   existe, et rien n'y est lu au chargement. */
import { S } from '../core/etat.js';
import { esc } from '../core/format.js';
import { dur, LOCAL_TZ, timeMode, srvOffSec, formatTime, poseModeHeure } from '../core/temps.js';
import { lfBloquee, lfCost } from '../formes-de-vie/formes-de-vie.js';
import { goUrl } from '../jeu/liens.js';
import { wakeTime } from '../plan/nuit.js';
import { REGLES_ERR } from '../regles/moteur.js';
import { syncFailed } from '../synchro/synchro.js';
import { tab, view, habillage } from './navigation.js';
import { save, toast, render, on } from '../../app.js';

/* ---------- fraîcheur du relevé ---------- */
/* Le copilote ne requête jamais le jeu : il lit la page que le joueur a sous
   les yeux. Les autres planètes datent donc de sa dernière visite, et un plan
   bâti sur un stock d'il y a une heure propose des choses qui ne sont plus
   payables — c'est ce qui faisait « disparaître » une carte au clic, quand la
   page enfin relue disait la vérité.
   Au-delà de dix minutes, le panneau ne fait plus semblant : il montre le
   bouton. En dessous, il se tait et se redessine tout seul. */
const FRAIS_MS = 10*60e3;
/**
 * L'âge du relevé le plus vieux de l'empire, en ms.
 * Une planète que la liste du jeu vient de révéler porte `bNeuve` : son stock
 * est daté de maintenant, mais ses 500/500/0 sont inventés et aucun de ses
 * niveaux n'est lu. La compter comme fraîche cachait le bouton au moment où il
 * sert le plus — juste après une colonisation.
 * @returns {number} ms depuis la lecture la plus ancienne, énorme si rien n'est lu
 */
function releveAge(){
  /* Seules les planètes que le jeu nomme comptent : une planète que le panneau
     connaît seul ne fait pas étape du relevé, et la compter laissait le bouton
     rouge en permanence — il proposait une relecture qui ne l'aurait jamais
     rajeunie. */
  const ats = S.planets.filter(p => p.gid).map(p => p.bNeuve ? 0 : (p.stock && p.stock.at) || 0);
  return ats.length ? Date.now() - Math.min(...ats) : 0;
}
/* Le relevé ne lit que les tuiles de la page affichée : chaque domaine demande
   donc son arrêt. Le panneau enchaîne les mêmes liens qu'un clic du joueur —
   rien n'est requêté, rien n'est cliqué dans la page du jeu.
   L'ordre est par page et non par planète : le relevé qu'on arrête à moitié
   rend alors un empire cohérent sur ce qu'il a déjà lu — tous les stocks, puis
   toutes les flottes — au lieu de deux planètes complètes et six muettes. Les
   pages viennent donc de la plus volatile à la plus stable. */
/* « resourcesettings » est le paramétrage de la production. Sans cet arrêt, le
   facteur, le revenu de base, le bonus des formes de vie et le compte de
   foreuses ne se rafraîchissaient qu'en ouvrant la page à la main : la carte
   d'une planète annonçait une production bâtie sur une lecture d'il y a des
   jours. */
const RELEVE_PAGES = ['supplies', 'resourcesettings', 'shipyard', 'defenses', 'facilities', 'lfbuildings', 'lfresearch'];
/* Ce qui ne dépend pas de la planète se lit une fois, à la fin, sur la planète
   de départ — ainsi le dernier arrêt est déjà celui du retour. */
const RELEVE_GLOBAL = ['research', 'movement'];
/* Ce que le coucher demande, et rien d'autre : ce qu'il y a au sol, ce qui peut
   le lever, et ce qui est déjà en vol. Le relevé complet fait une cinquantaine
   d'arrêts de quatre secondes — trois minutes devant un joueur qui veut aller
   dormir, dont les trois quarts pour des niveaux de bâtiments que la nuit ne
   regarde pas. Celui-ci en fait deux par planète, plus un. */
export const RELEVE_NUIT = ['supplies', 'shipyard', 'movement'];
/**
 * La planète d'où part le relevé, et où il ramène : celle que le joueur regarde.
 * `S.cur` se teste avant de chercher — sans lui, l'égalité trouvait la première
 * planète que le jeu ne nomme pas, et le relevé finissait sur une planète sans
 * identifiant, incapable de dire qu'elle était arrivée.
 * @returns {number} un rang de S.planets, celui du départ ou le premier nommé
 */
/**
 * L'adresse du paramétrage de la production, pour une planète.
 * Cette page est la seule du jeu que le copilote ne sait pas nommer : selon la
 * version, elle s'ouvre par `component=` ou par `page=`. On ne devine donc
 * pas — on reprend le lien que la page des ressources affiche et on n'y change
 * que la planète. Tant qu'aucune page ne l'a montré, la forme commune aux
 * autres pages sert de repli.
 * @param {number} pi rang dans S.planets
 * @returns {string|null}
 */
function prodUrl(pi){
  const gid = (S.planets[pi] || {}).gid, repli = () => goUrl('resourcesettings', pi);
  if(!S.prodUrl || !gid) return repli();
  try{ const u = new URL(S.prodUrl); u.searchParams.set('cp', gid); return u.href; }
  catch(e){ return repli(); }
}
function releveDepart(){
  const i = S.cur ? S.planets.findIndex(p=>p.gid===S.cur) : -1;
  if(i>=0) return i;
  return Math.max(0, S.planets.findIndex(p=>p.gid));
}
/* La page de forme de vie et la file qu'elle montre. */
const LF_FILE = {lfbuildings:'lfbuilding', lfresearch:'lfresearch'};
/**
 * La case de cette file que le relevé a le plus besoin d'ouvrir : la première
 * que le panneau ne sait pas encore chiffrer.
 * Le jeu ne donne le prix et la durée que dans le panneau de détail — et il
 * accepte `openTech` dans ses URL, comme le montrent ses propres encadrés de
 * production. Le relevé ouvre donc la case par un lien, sans rien cliquer dans
 * la page. Une seule par passage : la suivante viendra au relevé d'après, et
 * une case chiffrée suffit à faire taire le rappel du panneau.
 * Les cases ne sont connues qu'une fois la page lue : sur un poste neuf, le
 * premier relevé découvre la liste et le deuxième ouvre.
 * @param {object} p planète de S.planets
 * @param {string} file 'lfbuilding' ou 'lfresearch'
 * @returns {string|null} l'identifiant de la case, ou null si tout est chiffré
 */
function lfAOuvrir(p, file){
  const e = Object.entries(p.lf || {}).find(([id,v]) =>
    lfQueue(id) === file && !lfBloquee(v)
    && (!(v.secs > 0) || !lfCost(v, (v.lvl||0)+1)));
  return e ? e[0] : null;
}
/**
 * Le second arrêt d'une page de forme de vie, quand ses cases viennent juste
 * d'être lues. La liste des arrêts se fige avant que le relevé commence : sur
 * une installation neuve, aucune case n'est encore connue, donc aucun arrêt ne
 * demandait de prix — le relevé entier passait sans en lire un seul, et il
 * fallait cliquer « Actualiser » une deuxième fois pour que les cartes
 * « Clique une case » s'en aillent. Une fois la page lue, la case à ouvrir est
 * là : on y retourne tout de suite.
 * @param {object} e arrêt qui vient d'être fait
 * @returns {object|null} l'arrêt de rattrapage, ou null s'il n'y a rien à ouvrir
 */
function lfRelance(e){
  if(!LF_FILE[e.page] || e.tuile) return null;
  const p = S.planets.find(x => String(x.gid) === String(e.gid));
  const tuile = p && lfAOuvrir(p, LF_FILE[e.page]);
  return tuile ? Object.assign({}, e, {tuile, url: e.url + '&openTech=' + encodeURIComponent(tuile)}) : null;
}
/** Les arrêts du relevé complet : {gid, page, url}, dans l'ordre. */
function releveEtapes(filtre){
  /* Les pages de formes de vie n'existent que pour qui en a : sans jamais en
     avoir lu une, le relevé irait attendre quatre secondes devant une page qui
     ne se nomme pas, deux fois par planète. Le panneau demande déjà d'en
     ouvrir une à la main ; après ça, le relevé les prend. */
  /* Deux façons de savoir que ces pages existent, et il suffit de l'une : le
     menu du jeu, qui le dit dès la première page lue — c'est ce qui manquait à
     un second ordinateur, où rien n'a encore été vu — ou une de ces pages déjà
     relevée ici. Le menu ne fait qu'ajouter : s'il changeait de forme un jour,
     le relevé retomberait sur ce qu'il a vu plutôt que de s'arrêter. */
  const avecLf = !!S.lfMenu
    || S.planets.some(p=>Object.keys(p.lfSeen||{}).length || Object.keys(p.lf||{}).length);
  const garde = c => !filtre || filtre.includes(c);
  const pages = (avecLf ? RELEVE_PAGES : RELEVE_PAGES.filter(c=>!c.startsWith('lf'))).filter(garde);
  const out = [];
  for(const page of pages) S.planets.forEach((p,i)=>{
    let url = p.gid ? (page === 'resourcesettings' ? prodUrl(i) : goUrl(page, i)) : null;
    let tuile = null;
    if(url && LF_FILE[page]){
      tuile = lfAOuvrir(p, LF_FILE[page]);
      if(tuile) url += '&openTech=' + encodeURIComponent(tuile);
    }
    if(url) out.push({gid:p.gid, page, url, tuile});
  });
  if(!out.length) return out;
  const i = releveDepart(), gid = (S.planets[i]||{}).gid;
  for(const page of RELEVE_GLOBAL.filter(garde)){ const url = goUrl(page, i); if(url) out.push({gid, page, url, global:true}); }
  return out;
}
/**
 * L'état d'un arrêt du relevé, pour l'écran.
 * Une page muette a coûté le délai entier sans rien apprendre : c'est elle qui
 * fait traîner un relevé, et elle ne se distingue pas d'une page lue si on ne
 * les sépare pas ici.
 * @param {number} i rang de l'arrêt
 * @param {number} fait nombre d'arrêts terminés
 * @param {object} etat compte rendu de l'arrêt, {muet, ms}
 * @returns {'attente'|'encours'|'muet'|'lu'}
 */
export function scanEtat(i, fait, etat){
  if(i === fait) return 'encours';
  if(i > fait) return 'attente';
  return etat && etat.muet ? 'muet' : 'lu';
}
/* Ce que chaque page du relevé rapporte, dit au joueur. */
export const RELEVE_NOMS = {
  supplies:'ressources', resourcesettings:'production', facilities:'installations',
  shipyard:'chantier', defenses:'défense', lfbuildings:'formes de vie',
  lfresearch:'recherche de forme de vie', research:'recherche', movement:'flotte',
  overview: 'retour'
};
/* Vrai pendant que l'écran du relevé tient la place du contenu. Un clic sur un
   onglet le baisse : le joueur reprend la main sans attendre la fin. */
export let scanEcran = false;
export function poseScanEcran(v){ scanEcran = v; }
/* Le temps qu'on laisse à une page pour se dire relevée. */
const RELEVE_DELAI = 4000;
/* Un arrêt qui va chercher le prix d'une case attend deux choses du jeu, pas
   une : la page, puis le panneau de détail qu'il charge à part. Le délai d'une
   page simple ne lui laisse pas le temps — c'est ce qui faisait échouer les
   planètes les plus lentes alors que les autres passaient. */
const RELEVE_DELAI_CASE = 9000;
export let releveEnCours = false;
export let releveFin = null;
/** Réveille le relevé dès que la page visitée a été lue. */
export function releveLu(){ if(releveFin) releveFin(); }
/* Le relevé arrive toutes les cinq secondes depuis la page ouverte : un relevé
   qui tombe pendant la navigation parle encore de la page d'avant. On n'avance
   donc que sur un relevé qui nomme la planète où l'on vient d'aller — et, à
   défaut, au bout de quatre secondes, pour qu'une page muette n'arrête rien. */
/**
 * Cette case est-elle chiffrée, maintenant, sur cette planète ?
 * @param {string} gid planète du jeu
 * @param {string|null} tuile identifiant de case, ou null si l'arrêt n'en demandait pas
 */
function lfChiffree(gid, tuile){
  if(!tuile) return true;
  const p = S.planets.find(x=>x.gid === gid);
  const v = p && (p.lf || {})[tuile];
  return !!(v && v.secs > 0 && lfCost(v, (v.lvl||0)+1));
}
function relevePas(gid, page, tuile){
  return new Promise(res=>{
    /* Ce que l'arrêt a donné : la page a parlé, ou le délai l'a emporté. Un
       relevé lent n'a pas la même cause selon le cas — des pages lentes à
       charger, ou des pages que le copilote attend pour rien — et l'écran le
       montre plutôt que de laisser deviner. */
    const t0 = Date.now();
    const fin = muet=>{ clearTimeout(t); releveFin = null; res({muet, ms:Date.now()-t0}); };
    const t = setTimeout(()=>fin(true), tuile ? RELEVE_DELAI_CASE : RELEVE_DELAI);
    /* La planète seule ne suffit pas : six arrêts de suite la gardent, et le
       battement de la page d'avant ferait avancer le relevé sans rien lire. */
    /* Le prix d'une case arrive après la page : le jeu le charge à part. Un
       arrêt qui part chercher une case attend donc de l'avoir — sinon on
       repartait sur le premier instantané, celui d'avant le prix, et aucune
       case n'était jamais chiffrée. Le délai borne l'attente comme ailleurs. */
    releveFin = ()=>{ if(String(S.cur) === String(gid) && S.page === page && lfChiffree(gid, tuile)) fin(false); };
  });
}
/** Le relevé complet : passe sur chaque page de chaque planète, puis ramène l'onglet. */
export async function faitLeReleve(filtre){
  const etapes = releveEtapes(filtre);
  if(releveEnCours || !etapes.length) return;
  /* Le point de départ se note avant le relevé : chaque page visitée déplace la
     planète courante, et à la fin S.cur serait le dernier arrêt. */
  const depart = releveDepart();
  releveEnCours = {fait:0, total:etapes.length, etapes, etats:[], debut:Date.now()}; scanEcran = true; render();
  try{
    for(const e of etapes){
      if(!releveEnCours) break; // le joueur a rappuyé sur le bouton
      /* Le relevé a son propre onglet : l'onglet du joueur ne bouge pas, et il
         n'a plus sa page de jeu qui clignote sous les yeux. */
      chrome.runtime.sendMessage({type:'scan', url:e.url});
      const r = await relevePas(e.gid, e.page, e.tuile);
      if(releveEnCours){ releveEnCours.etats.push(r); releveEnCours.fait++; render(); }
      const rat = releveEnCours && lfRelance(e);
      if(rat){
        releveEnCours.total++; render();
        chrome.runtime.sendMessage({type:'scan', url:rat.url});
        const r2 = await relevePas(rat.gid, rat.page, rat.tuile);
        if(releveEnCours){ releveEnCours.etats.push(r2); releveEnCours.fait++; render(); }
      }
    }
    /* Chaque page visitée déplace la planète courante du côté du jeu, pour
       l'onglet du joueur aussi : le dernier arrêt le remet où il était. */
    const retour = goUrl('overview', depart);
    if(retour){ chrome.runtime.sendMessage({type:'scan', url:retour}); await relevePas((S.planets[depart]||{}).gid, 'overview'); }
  } catch(e){ console.error('Copilote : relevé interrompu', e); }
  finally{
    chrome.runtime.sendMessage({type:'scanFin'});
    releveEnCours = null; scanEcran = false; header(); render();
  }
}
/** Le bouton : lance le relevé, ou l'arrête s'il tourne. */
export function boutonMaj(){
  if(releveEnCours){ releveEnCours = null; scanEcran = false; render(); return; }
  faitLeReleve();
}
/* Le bouton du haut : caché tant que le relevé est frais, et le seul moyen
   d'arrêter un relevé en route — à huit planètes il y a cinquante arrêts, et
   le joueur qui change d'avis ne doit pas attendre la fin. */
function majBouton(){
  const b = document.getElementById('majBtn'); if(!b) return 0;
  const n = releveEtapes().length, age = releveAge();
  b.hidden = !n || (!releveEnCours && age <= FRAIS_MS);
  /* Rouge tant qu'il est là : ce bouton ne sort que quand le plan se fie à des
     chiffres périmés, et un bouton de la couleur des autres se regarde sans se
     voir. Il n'a rien à signaler le reste du temps — il est caché. */
  b.classList.toggle('bad', !b.hidden);
  if(releveEnCours){
    b.textContent = `Arrêter (${releveEnCours.fait}/${releveEnCours.total})`;
    b.title = "Le relevé passe par chaque page de chaque planète, puis te ramène où tu étais.";
  } else {
    b.textContent = 'Actualiser';
    /* Une planète jamais relevée a un stock daté de zéro : « vieux de 20778j »
       au lieu de dire simplement que rien n'a encore été lu. */
    const vieux = age > 7*864e5 ? 'Relevé jamais fait' : `Relevé vieux de ${dur(age/1000)}`;
    b.title = `${vieux} : ${n} page${n>1?'s':''} à relire pour tout savoir.`;
  }
  /* L'âge que le bouton signale, pour l'en-tête — 0 quand il n'a rien à dire. */
  return (b.hidden || releveEnCours) ? 0 : age;
}
export function header(){
  const s=S.settings;
  const perime = majBouton();
  /* L'heure de la dernière lecture et la classe, rien de plus : les deux
     vitesses se lisent dans Outils › Serveur, qui les tient du serveur.
     Sauf quand le bouton est sorti : « synchro 19:58 » à côté d'un bouton rouge
     se lisait comme une contradiction — la synchro date de la page sous les
     yeux, le bouton parle de la planète la moins souvent vue. Tant qu'il est
     là, l'en-tête annonce donc ce qu'il corrige. */
  const quand = perime
    ? (perime > 7*864e5 ? 'jamais relevé' : 'relevé ' + formatTime(Date.now() - perime))
    : (S.syncAt ? 'synchro ' + formatTime(S.syncAt) : 'en attente du jeu');
  const cls = ({collector:'Collecteur',general:'Général',explorer:'Explorateur',none:'Sans classe'})[s.cls];
  const ub = document.getElementById('uniBadge');
  /* Un rules.json illisible ne bloque rien, mais il change ce que le panneau
     sait dire : l'en-tête le dit, à côté de la fraîcheur du relevé. */
  ub.innerHTML = `${esc(quand)}<span class="cls"> · ${esc(cls)}</span>${REGLES_ERR ? `<span class="cls"> · ${esc(REGLES_ERR)}</span>` : ''}`;
  ub.title = `${quand} · ${cls}${REGLES_ERR ? ' · ' + REGLES_ERR : ''}`;
  /* Le mode nuit vit dans l'en-tête, à côté de l'engrenage : il tient en une
     icône, et la carte Maintenant n'a plus à le porter. */
  const nb = document.getElementById('nightBtn'), nuit = !!S.day.night;
  nb.textContent = nuit ? '☀️' : '🌙';
  nb.title = nb.ariaLabel = nuit ? 'Mode jour' : 'Mode nuit';
  nb.classList.toggle('primary', nuit);
  nb.classList.toggle('ghost', !nuit);
  /* L'interrupteur des heures : coché = heure locale. Son libellé dit le mode
     choisi ; s'il dit « serveur ? », aucune page du jeu n'a encore donné
     l'heure du serveur et le panneau montre la locale en attendant. */
  const tz = document.getElementById('tzBtn'), tzl = document.getElementById('tzLbl');
  const inconnu = timeMode === 'server' && srvOffSec() == null;
  tz.setAttribute('aria-checked', String(timeMode === 'local'));
  /* Les deux avertissements du libellé — heure serveur pas encore lue, ou
     décalage non vérifié sur la dernière page — sont aussi copiés dans
     l'infobulle de l'interrupteur et dans son nom accessible : en panneau
     étroit, le libellé est masqué (panel.css), donc ni vu ni lu. */
  const avert = inconnu ? 'Heure serveur pas encore lue : les heures restent en heure locale jusqu\'à la prochaine page du jeu'
    : (S.srvTz && S.srvTz.ok === false ? 'Décalage du serveur non vérifié sur la dernière page : le dernier connu sert' : '');
  tz.title = tz.ariaLabel = (timeMode === 'local' ? 'Afficher les heures en heure serveur' : 'Afficher les heures en heure locale')
    + (avert ? ' — ' + avert.charAt(0).toLowerCase() + avert.slice(1) : '');
  tzl.textContent = timeMode === 'local' ? 'Heures : locale' : (inconnu ? 'Heures : serveur ?' : 'Heures : serveur');
  tzl.title = avert || (LOCAL_TZ ? 'Fuseau local : ' + LOCAL_TZ : '');
  /* Le masquage de la page du jeu et la disposition des cartes se règlent une
     fois pour toutes : ils vivent dans les Réglages, plus dans l'en-tête. */
  /* L'engrenage est un onglet comme les autres, hors de la barre : il porte le
     même `data-tab`, donc le même état sélectionné. */
  document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected', String(b.dataset.tab===tab)));
  /* L'habillage et l'onglet courant vivent sur <html> : « une couleur par
     page » lit le second, les trois autres peaux l'ignorent. */
  const r = document.documentElement;
  r.dataset.skin = habillage();
  r.dataset.page = tab;
}
/** Vrai tant que l'écran du relevé tient la place du contenu. */
export function enScan(){ return !!(scanEcran && releveEnCours); }
/** Change de mode, le retient, et redessine sans recharger. */
export function setTimeMode(m){
  m = m === 'local' ? 'local' : 'server';
  if(m === timeMode) return;
  poseModeHeure(m);
  try{ if(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync){ const r = chrome.storage.sync.set({timeMode: m}); if(r && r.catch) r.catch(syncFailed); } }catch(e){ syncFailed(e); }
  render();
}

/* ---------- le mode nuit ---------- */
/* La question du coucher — alarme « nuit », notification et bandeau — a laissé
   la place au rappel de mise à l'abri (Réglages › Sécurité), qui ne fait
   qu'allumer l'icône. Le mode nuit, lui, reste : il s'allume à la main. */

/**
 * Allume ou éteint la mise à l'abri, et retient jusqu'à quand elle vaut.
 *
 * Sans cet instant, le mode nuit ne s'éteignait qu'au clic : au matin le joueur
 * retrouvait un plan vide et croyait le copilote en panne. Il ne se devine pas
 * au réveil — « il est 7 h » ne distingue pas un réveil d'une absence qui
 * commence, et l'heure de nuit ne dit rien d'une absence de jour. C'est donc
 * l'allumage qui dit sa propre fin, avec le même `wakeTime` qui choisit la
 * vitesse de la flotte : le plan revient quand la flotte revient.
 *
 * Éteindre efface l'heure de retour : elle appartenait à cette absence-là.
 * @param {boolean} on
 */
export function modeNuit(on){
  S.day.night = !!on;
  if(!on) S.day.backHour = null;
  S.day.until = on ? (wakeTime(Date.now()) || 0) : 0;
}

/**
 * Rend le mode jour quand l'instant que la mise à l'abri s'était donné est
 * passé. Appelée au chargement et à chaque battement.
 * @returns {boolean} vrai si le plan vient de revenir
 */
export function finDeNuit(){
  if(!S.day.night) return false;
  /* Une sauvegarde d'avant `until` n'en porte pas : lui en donner un vaut mieux
     que de la laisser en veille pour toujours. */
  if(!S.day.until){ S.day.until = wakeTime(Date.now()) || 0; save(); return false; }
  if(Date.now() < S.day.until) return false;
  modeNuit(false);
  save(); render();
  toast('Mode jour : le plan est revenu');
  return true;
}
export const VIEWS_RELEVE = {
/* L'écran du relevé. Il tient la place du contenu tant qu'il tourne : ce que
   le joueur regardait est en train d'être relu, et le voir se recomposer carte
   par carte ne lui apprend rien. Ici il voit ce qui reste à lire. */
scan(){
  const r = releveEnCours || {fait:0, total:0, etapes:[], etats:[], debut:Date.now()};
  const etats = r.etats || [];
  const groupes = new Map();
  (r.etapes || []).forEach((e, i) => {
    const cle = e.global ? '' : e.gid;
    if(!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push({e, i});
  });
  const lignes = [...groupes].map(([cle, pas]) => {
    const p = cle ? S.planets.find(x => x.gid === cle) : null;
    const cases = pas.map(({e, i}) => {
      const nom = esc(RELEVE_NOMS[e.page] || e.page), et = etats[i] || {};
      return ({
        attente: () => `<span class="pill">${nom}</span>`,
        encours: () => `<span class="pill info">\u2026 ${nom}</span>`,
        muet: () => `<span class="pill warn" title="Cette page n'a rien renvoyé : ${Math.round((et.ms||0)/1000)} s d'attente pour rien.">\u231b ${nom}</span>`,
        lu: () => `<span class="pill good" title="${Math.round(et.ms || 0)} ms">\u2713 ${nom}</span>`
      })[scanEtat(i, r.fait, et)]();
    }).join(' ');
    return `<tr><td>${esc(p ? p.name : 'Empire')}</td><td>${cases}</td></tr>`;
  }).join('');
  const muets = etats.filter(x => x && x.muet).length;
  const ecoule = Math.max(0, Date.now() - (r.debut || Date.now())) / 1000;
  const reste = r.fait ? ` · encore ~${dur(ecoule / r.fait * (r.total - r.fait))}` : '';
  return `<section class="panel"><div class="card">
    <div class="row spread"><h2>Relevé en cours</h2><span class="pill info">${r.fait} / ${r.total}</span></div>
    <p class="note">Le relevé lit chaque page dans un onglet à lui, ouvert en arrière-plan : ta page de jeu ne bouge pas, tu peux continuer à jouer. Il se referme tout seul à la fin.</p>
    <p class="note">${dur(ecoule)} écoulées${reste}${muets ? ` · <b>${muets} page${muets>1?'s':''} muette${muets>1?'s':''}</b> : rien n'en est revenu` : ''}</p>
    <div class="tbl-wrap"><table><tbody>${lignes}</tbody></table></div>
    <div class="row mt-2"><button class="btn sm" id="scanStop">Arrêter</button><span class="note">Ce qui est déjà lu reste acquis.</span></div>
  </div></section>`;
},
};
/* ---------- masquer des morceaux de la page du jeu ----------
   Trois interrupteurs indépendants — Masquer la pub, la bannière, le
   chat — rangés dans chrome.storage.sync sous `masque`. C'est masque.js, dans
   la page, qui les applique : il écoute la même clé, donc un changement ici
   se voit dans chaque onglet ouvert, sans recharger. Le panneau n'en garde
   qu'un miroir pour se dessiner.
   Par défaut les trois sont masqués : un choix jamais fait (clé absente)
   vaut « masqué ». Un choix enregistré, lui, n'est jamais réécrit. masque.js
   applique la même règle, sans quoi la page et le panneau se contrediraient. */
export const MASQUE_CLES = ['pub', 'bandeau', 'chat'];
/** Les trois choix ramenés à des booléens : ce qui manque vaut « masqué ». */
export function masqueNorme(m){ const o = {}; for(const k of MASQUE_CLES) o[k] = !m || m[k] === undefined ? true : !!m[k]; return o; }
/* Lu au chargement du module, avant le premier header() : boot.js a posé
   `window.__masque` avant de charger le panneau. */
export let masque = masqueNorme(typeof window !== 'undefined' ? window.__masque : null);
/** Vrai quand les trois sont masqués : le raccourci dit alors « Tout afficher ». */
export function toutMasque(){ return MASQUE_CLES.every(k=>masque[k]); }
/** Ce que fait « Tout masquer » : tout cacher, ou tout rendre si tout l'est déjà. */
export function masqueBascule(m){ const tout = MASQUE_CLES.every(k=>m[k]); return masqueNorme({pub:!tout, bandeau:!tout, chat:!tout}); }
/** Pose un nouveau choix, le retient, et redessine ce qui le montre. */
export function setMasque(m, retenir){
  m = masqueNorme(m);
  if(MASQUE_CLES.every(k=>m[k] === masque[k])) return;
  masque = m;
  if(retenir !== false){
    try{ if(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync){ const r = chrome.storage.sync.set({masque: m}); if(r && r.catch) r.catch(syncFailed); } }catch(e){ syncFailed(e); }
  }
  header();
  // la carte des Réglages porte les cases : elles ne doivent pas mentir
  if(tab === 'settings') view.querySelectorAll('[data-masque]').forEach(el=>{ el.checked = !!masque[el.dataset.masque]; });
  const tb = view.querySelector('[data-masque-tout]');
  if(tb) tb.textContent = toutMasque() ? 'Tout afficher' : 'Tout masquer';
}
