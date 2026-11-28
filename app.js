/* Module ES, chargé par src/main.js (issue #49). Il se vide domaine par
   domaine : il importe ce que les modules sortis de lui fournissent, et
   n'exporte que ce que la météo et la flotte cible lui empruntent (liste en
   fin de fichier). */
import { COL_SHIP_COST, colonyCandidates } from './src/colonisation/colonisation.js';
import { KEY, EXPO_FRET, sample, newPlanet, S, remplaceEtat } from './src/core/etat.js';
import {
  nf, fmt, esc, num, costHtml, planetRef, PLANET_COLORS, planetHue,
  qHtml, nf1, fmtCourt
} from './src/core/format.js';
import { B, levelCost, crawlerMax, CRAWLER_COST, POS } from './src/core/formules.js';
import { IS_EXT, poseApi, ecoSpeed, buildTime } from './src/core/serveur.js';
import {
  dur, LOCAL_TZ, srvOffSec, clockParts, p2, timeSeen, formatTime,
  timeTitle
} from './src/core/temps.js';
import {
  DEF, DEF_ORDER, DEF_MODELES, DEF_RATIO, DEF_PALIERS, DEF_SOURCE,
  DEF_ABR, defModele, defAncreRecette, defRecette, packCost, defLigne,
  defsOf, defRatio, DEF_DUREES, DEF_PLANCHERS, computeDefenseGap
} from './src/defense/defense.js';
import {
  LF_READ_TTL, labPlanet, parseProdPanel, prodOf, bridage, production,
  mse, NOM_RES, stockNow
} from './src/economie/production.js';
import { EXPO_LOG_MAX, EXPO_PREP_MAX, EXPO_EVTS, expoJournal, expoMessages } from './src/flotte/expeditions.js';
import {
  SHIPS, parseC, shipStats, flight, SHIP_PLURAL, SHIP_ONE, shipList
} from './src/flotte/vaisseaux.js';
import {
  lfMetEnCommun, lfMerge, lfCost, lfCandidates, raceDeSerie, lfNomConnu,
  lfNomsRetiens, LIFEFORMS, speciesOfPlanet, lfIds, LF_ROLE
} from './src/formes-de-vie/formes-de-vie.js';
import { BUILD_ID, fleetUrl, actGo, missionGo, goAttr, goNote, planHints, prioHints } from './src/jeu/liens.js';
import { profilSain } from './src/plan/profil.js';
import { meteoVoit, renderMeteo, meteoBind } from './src/meteo.js';
import { unlockAudio, alertQueue, ackFinished, stopFlash, clock, mirrorAlerts } from './src/minuteurs/minuteurs.js';
import { raidTargets, exploreSystems, REPORT_WORDS, SE_BAT, applyReport, raidPlan } from './src/pillage/pillage.js';
import { casesSaines, casesLibres, dayValue, whyLead, cardKey, refused } from './src/plan/journee.js';
import { energyOptions, energyLine, dailyMissions, NO_KINDS, actKey, noLabel } from './src/plan/missions.js';
import {
  prios, priosLf, prioClean, prioRecoit, lfCle, poseKind, FOCUS,
  FOCUS_VAISSEAU
} from './src/plan/priorites.js';
import { besoinEmpire, mseW } from './src/plan/vocations.js';
import {
  REGLES_ERR, aSoi, NIVEAU_SEV, regleActive, regleParam, regleSaine,
  constatsDe, HANGARS, ignClean, publieCritiques
} from './src/regles/moteur.js';
import { FS_RAPPEL_ON, poseRappel, armeRappel } from './src/securite/securite.js';
import { occupied, myScore } from './src/univers/univers.js';
import { VIEWS_AUJOURDHUI, REFRESH_AUJOURDHUI } from './src/vues/aujourdhui.js';
import { VIEWS_DEFENSE } from './src/vues/defense.js';
import { VIEWS_EMPIRE, REFRESH_EMPIRE } from './src/vues/empire.js';
import { releveLu, header, enScan, setTimeMode, finDeNuit, VIEWS_RELEVE } from './src/vues/entete.js';
import { bind, brancheEcoutes } from './src/vues/evenements.js';
import {
  view, tab, UI, uiPurge, uiEcrit, uiOuvert, uiVu, fold, cardMode,
  VUES_ONGLETS, cartesSection, cartesSync, carteEnHaut, cardLue,
  lierRenvois, setCardMode, cartesSain, garderVue
} from './src/vues/navigation.js';
import { VIEWS_OUTILS, REFRESH_OUTILS } from './src/vues/outils.js';
import { VIEWS_REGLAGES, REFRESH_REGLAGES } from './src/vues/reglages.js';
/* Les constats d'économie s'inscrivent dans EVAL au chargement : rien d'autre
   n'en est importé. */
import './src/plan/constats.js';

const APP_VERSION = '2.20.0';
/** L'historique tel que ./pack.sh l'écrit : [version, date, empreinte, sujet]. */
let VERSIONS = [];
/** La version du dépôt, quand on a pu la lire. */
let MAJ = null;

document.getElementById('appVer').textContent = 'v' + APP_VERSION;

/* Le chantier sort trois choses qui ne se rangent pas au même endroit : des
   vaisseaux, des foreuses que production() compte à part, et de la défense,
   comptée par type et par total. Chaque file le réinventait ; un seul endroit
   le dit, sinon un lot de lanceurs finit dans p.ships et ne défend rien. */
function addBuilt(p, ships){
  for(const [k,n] of Object.entries(ships||{})){
    if(k==='crawl') p.crawlers=(p.crawlers||0)+n;
    /* Le détail part du relevé, pas de rien : sur une planète dont on ne
       connaissait que le total, poser {ll:2} effacerait les lanceurs déjà au
       sol et le plan les redemanderait un par un. */
    else if(DEF[k]){ const d = Object.assign({}, defsOf(p)); d[k] = (d[k]||0)+n; p.def=(p.def||0)+n; p.defs = d; }
    else { p.ships=p.ships||{}; p.ships[k]=(p.ships[k]||0)+n; }
  }
}

migratePlanetIds();
/* Une sauvegarde d'avant un bâtiment ne connaît pas sa clé : sans ce comblement
   la case du volet Empire afficherait « undefined » et le joueur l'y saisirait. */
for(const p of S.planets || []) p.b = Object.assign(Object.fromEntries(Object.keys(B).map(k=>[k,0])), p.b);
S.daily = Object.assign(sample().daily, S.daily);
/* Fichier illisible : on ne sait pas ce qui s'écarte de lui. Nettoyer ici
   effacerait tous les réglages de règles du joueur, et save() les retirerait
   de chrome.storage.sync. On les garde pour le jour où le fichier se relit. */
if(!REGLES_ERR) regleSaine();
/* Le cache des noms de forme de vie : sur ce poste, hors de la synchro. */
if(!S.lfNoms || typeof S.lfNoms !== 'object' || Array.isArray(S.lfNoms)) S.lfNoms = {};
/* Le profil indexe des tables par ses propres clés : une clé inconnue y lève,
   et `sainEtat` ne passe qu'à l'import d'une sauvegarde ou au retour d'une
   synchro. Il se remet donc d'aplomb ici aussi, au démarrage. */
profilSain();
expoSain();
/* Une sauvegarde perdue en silence est pire qu'une erreur : l'écran montre la
   case cochée, et le rechargement suivant l'a oubliée. */
function saveFailed(e){ console.error('Copilote : sauvegarde impossible', e); try{ toast('Sauvegarde impossible : recharge le panneau'); }catch(err){} }
window.__saveFailed = saveFailed;
function save(){ try{ LS.setItem(KEY, JSON.stringify(S)); }catch(e){ saveFailed(e); } syncPush(); }

/* L'identité d'une planète est son id. Le rang change dès que le jeu
   réordonne, le nom se répète d'une colonie à l'autre, le gid n'existe qu'une
   fois le jeu lu : aucun des trois ne la désigne. Un id qui ne répond plus ne
   désigne aucune planète, et l'appelant le traite comme tel — il ne se rabat
   jamais sur une voisine, ce qui était la vieille faute du rang. */
function planetById(id){ return S.planets.find(p => p.id === id) || null; }
function planetIndexById(id){ return S.planets.findIndex(p => p.id === id); }
/** L'identifiant du jeu d'une planète locale, ou null : ce qui voyage entre postes voyage en gid. */
const gidDe = pid => { const p = planetById(pid); return p && p.gid != null ? String(p.gid) : null; };

/* Ce que le joueur retire, il le retire vraiment : ici l'absence est une
   certitude et non un défaut d'appariement, donc ce qui visait cette planète
   s'en va avec elle. Ailleurs, un id muet laisse les choses en place. */
function forgetPlanet(id){
  S.planets = S.planets.filter(p => p.id !== id);
  S.timers = (S.timers || []).filter(t => t.pid !== id);
  if(S.colo.fromId === id) S.colo.fromId = null;
  if(S.centre === id) S.centre = null;
}
/* Le nom d'une case. Celui du relevé d'abord : il vient de la partie en cours,
   et le jeu peut le traduire autrement que notre table. */
function lfNom(p, id){
  return lfNomConnu(p, id) || ('Forme de vie ' + id);
}
/* La case de cette planète à ce rang, ou rien : l'espèce diffère d'une planète
   à l'autre, et le jeu n'ouvre pas tous les rangs d'un coup. */
function lfIdPour(p, cle){ return lfIds(p).find(id => lfCle(id) === cle); }
/* Les rangs que l'empire a relevés, les bâtiments avant les recherches —
   'lfbuilding' passe avant 'lfresearch' dans l'ordre des lettres. */
function poseLfCles(){
  return [...new Set(S.planets.flatMap(p => lfIds(p).map(lfCle)))]
    .sort((a, b) => a.split(':')[0].localeCompare(b.split(':')[0]) || +a.split(':')[1] - +b.split(':')[1]);
}
/* Ce que la liste écrit sur un rang : les noms que le relevé lui connaît, une
   fois chacun — « Secteur résidentiel / Enclave de méditation » pour un empire
   à deux espèces. Pas de nom de rôle à la place : au-delà du logement et de la
   nourriture, documentés chez les quatre espèces, le jeu ne donne pas le même
   rôle au même rang, et un intitulé inventé ferait croire le contraire. */
function poseNom(k){
  if(poseKind(k) === 'b') return B[k].n;
  const noms = new Set();
  for(const p of S.planets) for(const id of lfIds(p)) if(lfCle(id) === k) noms.add(lfNom(p, id));
  const vus = [...noms].join(' / ') || k;
  /* Les trois rôles communs devant les noms, quand le rang en a un. Les
     recherches n'en ont pas : leur rang 1 est « Ambassadeurs intergalactiques »,
     pas l'hébergement. */
  const role = k.startsWith('lfbuilding:') ? LF_ROLE[+k.split(':')[1]] : null;
  return role ? `${role} — ${vus}` : vus;
}
/* Ce qu'une ligne de forme de vie dit d'elle-même. Cinq états, et aucun ne se
   confond avec un autre : le relevé n'a jamais vu la case (le joueur a posé
   avant que la page de sa forme de vie soit parcourue), elle est verrouillée,
   elle n'est pas encore chiffrée (état normal juste après la pose : le prix ne
   vient qu'en ouvrant la case dans le jeu), elle est en tête de sa file, ou
   elle attend son tour. Dans les deux derniers, le réglage des formes de vie
   est nommé : c'est lui qui décide du moment, et le taire laisserait croire
   à une priorité ignorée. Un sixième, la population trop faible, dit où aller
   la chercher : rien d'autre dans le panneau ne relie cette case au bouton des
   paliers. */
function prioLfEtat(p, x, nuit){
  const v = (p.lf || {})[x.k];
  if(!v) return 'Le relevé n\'a jamais vu cette case : ouvre la page de ta forme de vie dans le jeu pour qu\'elle apparaisse.';
  if(v.state === 'locked') return 'Verrouillée : un prérequis manque dans le jeu.';
  if(v.state === 'pop') return 'La population de la planète est trop faible : le jeu refuse de la construire, et le plan ne sait pas dire quand ça changera. Monte la nourriture puis le logement — le bouton « Poser les paliers de population », sous les niveaux de cette planète, pose les deux.';
  const l = lfCandidates(p, lfQueue(x.k));
  if(!l.some(c => c.id === x.k)) return 'Pas encore chiffrée : ouvre-la dans le jeu pour que le plan connaisse son prix.';
  if(nuit) return '';
  const reglage = `Formes de vie : « ${LF_MODE[lfMode()]} », à changer dans Réglages › Plan du jour`;
  if(lfMode() === 'off') return `${reglage} — le plan n'y touche pas.`;
  /* Le planificateur saute une file de forme de vie tant qu'un chantier y
     tourne (même lecture que simulateDay : minuteur de jeu 'x', file, pas fini) :
     annoncer « servie » par-dessus serait promettre ce qu'il ne fait pas. */
  const fin = (S.timers || []).reduce((m, t) => t.kind === 'x' && t.queue === lfQueue(x.k) && t.pid === p.id && !t.done && t.end > Date.now() ? Math.max(m, t.end) : m, 0);
  if(fin) return `Sa file de forme de vie est occupée : le plan la lancera quand le chantier en cours finira, dans ${dur((fin - Date.now())/1000)}. ${reglage}.`;
  if(l[0].id !== x.k) return `Attend son tour dans sa file : une case posée avant elle passe d'abord. ${reglage}.`;
  return lfMode() === 'first' ? `En tête de sa file : le plan la sert avant les bâtiments. ${reglage}.`
    : `En tête de sa file, mais le réglage la fait passer après les bâtiments. ${reglage}.`;
}

/* Les rangs enregistrés deviennent des identités. Un rang écrit hier ne
   désigne plus la même planète après un réordonnancement : il désigne la
   voisine, sans rien dire. La conversion se décide sur le type — un nombre est
   encore un rang — donc elle se rejoue sans dommage sur un état déjà converti.
   S.v ne pouvait pas servir de repère : sample() écrit v:1 et le fusionne dans
   tout état relu, converti ou non. */
function migratePlanetIds(){
  for(const p of S.planets) if(!p.id) p.id = Math.random().toString(36).slice(2,9);
  const idAt = i => (S.planets[i] || {}).id || null;
  const mue = x => { if(typeof x.p !== 'number') return x; const y = Object.assign({}, x, {pid: idAt(x.p)}); delete y.p; return y; };
  S.timers = (S.timers || []).map(mue);
  // La liste d'objectifs a disparu : rien ne la lisait. Ce qu'elle a laissé
  // dans les sauvegardes s'en va au premier chargement.
  delete S.plan;
  // Le rôle par planète aussi : il n'était lu que par son propre menu, et le
  // centre le remplace. Rien n'est perdu, puisque rien ne s'en servait.
  delete S.roles;
  if(typeof S.colo.from === 'number'){ S.colo.fromId = idAt(S.colo.from); delete S.colo.from; }
  S.v = 2;
}
/* ---------- le message éphémère ---------- */
function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>t.hidden=true,1800); }
/**
 * Ce que la page du jeu doit savoir des autres planètes pour proposer une
 * tournée : leur nom, le niveau de chaque tuile, le prix du niveau suivant, la
 * fin de leur file et leur stock. Rangé par planète du jeu, comme les indices :
 * une planète que le jeu n'a pas encore nommée n'a pas d'identifiant à mettre
 * dans un lien, donc elle n'est pas d'une tournée.
 * La fin de file est publiée telle quelle, passée ou non : c'est la page qui la
 * compare à l'instant où le joueur la regarde.
 * @returns {object} { [planetId]: { n, b, cost, bq, lfq, st } }
 */
function tourData(){
  const out = {};
  const fin = (p, q) => (S.timers || []).reduce((a,t)=> t.queue===q && t.pid===p.id && !t.done && t.end>a ? t.end : a, 0);
  for(const p of S.planets){
    // même garde que pour les relevés de production : « __proto__ » & co ne
    // sont jamais une planète du jeu
    if(!/^\d+$/.test(String(p.gid || ''))) continue;
    const b = {}, cost = {};
    /* Le jeu nomme toutes les planètes dès la première page lue, mais ne dit
       les niveaux que de celle qu'on regarde : les autres sont à zéro par
       défaut. Publier ce zéro enverrait monter ce qui est peut-être au niveau
       huit. Tant que rien n'a été lu ni saisi, cette planète n'a pas de niveau
       à donner — la page sait le dire. */
    if(!p.bNeuve) for(const k of Object.keys(B)){
      const id = BUILD_ID[k];
      if(!id) continue; // une clé de B sans tuile du jeu : rien à montrer
      b[id] = p.b[k] || 0;
      cost[id] = levelCost(B[k], b[id] + 1);
    }
    for(const [id, v] of Object.entries(p.lf || {})){
      const lvl = (v && v.lvl) || 0;
      b[id] = lvl;
      /* Un prix de forme de vie ne s'invente pas : il se lit sur le jeu. Un
         prix estimé reste au panneau, qui l'étiquette — une pastille qui
         grise sur une estimation ferait manquer ce qui ne manque pas. */
      const c = lfCost(v, lvl + 1);
      if(c && c.src === 'lu') cost[id] = c.cost;
    }
    out[p.gid] = {n: planetRef(p), b, cost, bq: fin(p, 'building'), lfq: fin(p, 'lfbuilding'),
                  lfr: fin(p, 'lfresearch'), at: Date.now(),
                  st: stockNow(p).map(x=>Math.round(x))};
  }
  return out;
}
/**
 * Qui peut livrer cette planète, et en combien de temps. La production locale
 * n'est pas la seule sortie : une autre planète qui a déjà le stock et des
 * transporteurs arrive souvent avant, et une livraison ignore le hangar.
 * Le temps de vol ne dépend que du vaisseau le plus lent, donc deux durées
 * suffisent — la page choisit la flotte selon ce qui manque.
 * Une mission part toujours de là où sont les vaisseaux : la colonie qui a le
 * stock n'a presque jamais de transporteur à quai, et il faut d'abord les y
 * amener à vide. C'est le cas courant, pas l'exception, donc ce vol-là compte
 * dans la durée annoncée.
 * ponytail: les vaisseaux datent de la dernière visite de leur planète, et le
 * deutérium du vol n'est pas déduit ; ajouter si ça trompe à l'usage.
 * @returns {object} { [planetId destination]: [{n, st, lc, sc, sec, out, base, cp, vers, mission}] }
 */
function donorsOf(){
  const cargoOf = p => { const sh = p.ships || {}; return (sh.lc||0)*25000 + (sh.sc||0)*5000; };
  const base = S.planets.reduce((a,p)=>(cargoOf(p) > (a ? cargoOf(a) : 0) ? p : a), null);
  if(!base || !base.coords || !cargoOf(base)) return {};
  const out = {};
  for(const dst of S.planets){
    if(!dst.gid || !dst.coords) continue;
    const list = [];
    for(const src of S.planets){
      if(src === dst || !src.coords) continue;
      const sh = src.ships || {}, own = (sh.lc||0) + (sh.sc||0) > 0;
      const from = own ? src : base;
      if(from === src && !own) continue;
      const f = from.ships || {};
      const vol = (a, b, k) => { const x = flight(a, b, {[k]:1}, 100); return x ? x.secs : 0; };
      // `cp` et la destination décrivent le premier trajet à faire : la
      // livraison elle-même quand les vaisseaux sont déjà sur place, sinon
      // l'aller à vide qui les y amène. Le jeu remplit son formulaire à
      // partir de là ; le second trajet se lance depuis la planète donneuse,
      // une fois les vaisseaux posés.
      list.push({n:src.name, st:stockNow(src).map(Math.floor), lc:f.lc||0, sc:f.sc||0,
        sec:[vol(src.coords, dst.coords, 'lc'), vol(src.coords, dst.coords, 'sc')],
        out:own ? [0,0] : [vol(from.coords, src.coords, 'lc'), vol(from.coords, src.coords, 'sc')],
        base:own ? null : from.name,
        cp:from.gid || null, vers:own ? dst.coords : src.coords, mission:own ? 3 : 4});
    }
    if(list.length) out[dst.gid] = list;
  }
  return out;
}
/**
 * Ce que la page du jeu doit afficher de notre part : les repères, les débits
 * de chaque planète, de quoi annoncer une livraison, et si le joueur a demandé
 * qu'on allège sa mise en page.
 * @param {object[]} acts actions de la session en cours
 * @returns {object} charge utile pour le script de page
 */
/**
 * Ce que le copilote a à dire sur chaque page du jeu, rangé par composant.
 * Le panneau est déjà à côté du joueur : répéter ses minuteurs et ses alertes
 * en bas de page ne lui apprend rien. Ce qu'il ne peut pas dire, c'est ce qui
 * se fait **ici**, sur la page ouverte — et c'est ce que la bande porte.
 * Le rangement se lit dans les liens que le plan produit déjà : une action qui
 * ouvre `component=defenses` est une action de la page Défense. Rien à tenir à
 * jour quand une action nouvelle apparaît.
 * Ce que le plan ne peut pas encore payer compte autant que ce qu'il lance :
 * un empire dont rien n'est payable n'a aucune action lançable, et la bande
 * serait vide partout. Ces lignes-là se grisent et portent leur date.
 * @param {object[]} acts actions de la session en cours
 * @param {object[]} [missions] missions du jour restantes
 * @param {object[]} [waits] ce que le plan attend faute de ressources
 * @returns {object} { pages: { [composant]: [{what, ou, quand, why, url, gris}] } }
 */
function bandData(acts, missions, waits){
  const pages = {};
  const pose = (url, what, ou, why, quand, gris) => {
    const c = /[?&]component=([a-z]+)/.exec(url || '');
    if(!c || !what) return;
    const l = pages[c[1]] = pages[c[1]] || [];
    // quatre lignes au plus : au-delà, la bande redevient une liste à lire
    if(l.length < 4) l.push({what, ou: ou || '', quand: quand || '', why: why || '', url,
      gris: !!gris, pc: ou ? planetHue(ou) : null});
  };
  const RES_B = ['métal', 'cristal', 'deutérium'];
  const manque = w => (w.miss || []).map((x,j)=>x>0 ? `${fmt(Math.ceil(x))} ${RES_B[j]}` : '').filter(Boolean).join(' · ');
  // le lançable d'abord, l'attendu ensuite : c'est l'ordre dans lequel on agit
  for(const a of acts || []) pose(actGo(a), a.what, (a.q || '').split(' · ')[1], a.why);
  for(const m of (missions || []).filter(x=>!x.info)) pose(missionGo(m), m.what, (m.tags || [])[0], m.why);
  for(const w of waits || []){
    const m = manque(w);
    pose(actGo(w), w.what, (w.q || '').split(' · ')[1], m ? 'Il manque ' + m : '',
      isFinite(w.eta) ? 'vers ' + formatTime(Date.now() + w.eta*1000) : 'à faire livrer', true);
  }
  return {pages};
}
/* La surcouche entière se recalcule avec le plan, sur Aujourd'hui. Mais deux
   réglages ne changent que l'allure de la page du jeu : les attendre là-bas
   laissait croire qu'ils ne marchaient pas. On republie donc ces deux champs
   seuls, sans toucher au reste de ce que la page a déjà. */
function pushLook(){
  if(!IS_EXT) return;
  try{ chrome.storage.local.get('skin', v => chrome.storage.local.set({
    skin: Object.assign({}, (v && v.skin) || {}, {lean: !!S.settings.lean, noshop: !!S.settings.noshop, large: !!S.settings.large,
      peau: !!S.settings.peau, clair: !!S.settings.clair, panneau: habillage()})
  })); }catch(e){}
}
/* Ce que le panneau sait, mis à plat pour la colonne de droite de la page :
   les mêmes lignes qu'Aujourd'hui, sans leur mise en page. La bande, elle,
   range par page ; ici on garde l'ordre du plan — le lançable d'abord. */
function colonneData(acts, missions, waits){
  const l = [];
  const RES_B = ['métal', 'cristal', 'deutérium'];
  const manque = w => (w.miss || []).map((x,j)=>x>0 ? `${fmt(Math.ceil(x))} ${RES_B[j]}` : '').filter(Boolean).join(' · ');
  const pose = (url, what, ou, why, quand, gris) => {
    // douze lignes au plus : au-delà, la colonne redevient une liste à lire
    if(!what || l.length >= 12) return;
    l.push({what, ou: ou || '', quand: quand || '', why: why || '', url: url || '',
      gris: !!gris, pc: ou ? planetHue(ou) : null});
  };
  for(const a of acts || []) pose(actGo(a), a.what, (a.q || '').split(' · ')[1], a.why);
  for(const m of (missions || []).filter(x=>!x.info)) pose(missionGo(m), m.what, (m.tags || [])[0], m.why);
  for(const w of waits || []){
    const m = manque(w);
    pose(actGo(w), w.what, (w.q || '').split(' · ')[1], m ? 'Il manque ' + m : '',
      isFinite(w.eta) ? 'vers ' + formatTime(Date.now() + w.eta*1000) : 'à faire livrer', true);
  }
  return l;
}
function gameSkin(acts, missions, waits){
  // Les débits suivent les indices : la page du jeu sait lire un coût et un
  // stock, mais pas à quelle vitesse une planète produit.
  const rates = {};
  for(const p of S.planets){ if(!p.gid) continue; const pr = production(p); rates[p.gid] = [pr.m, pr.c, pr.d]; }
  /* Le nom de chaque planète et sa teinte : une action nomme souvent ses
     planètes dans sa phrase — « Ramène 34 grands transporteurs de Tarpin land
     vers Caribou Land » — et la page doit pouvoir les y reconnaître. */
  const teintes = {};
  for(const [i, p] of S.planets.entries()){
    const c = i % PLANET_COLORS;
    if(p.name) teintes[p.name] = c;
    teintes[planetRef(p)] = c;
  }
  /* Une seule recherche pour tout l'empire, et le jeu refuse de monter un
     laboratoire tant qu'elle tourne, où qu'il soit. La page en a besoin : sans
     elle, une tournée de labos annonce « prête » une tuile qui ne partira pas.
     Une file sans planète se publie à part de la tournée, rangée par planète. */
  const rq = (S.timers || []).reduce((a,t)=> t.queue==='research' && !t.done && t.end>a ? t.end : a, 0);
  return {hints: planHints(acts), prio: prioHints(), rates, donors: donorsOf(), tour: tourData(), rq, teintes,
          band: bandData(acts, missions, waits),
          colonne: colonneData(acts, missions, waits),
          cargo: [shipStats('lc').cargoEff, shipStats('sc').cargoEff],
          lean: !!S.settings.lean, noshop: !!S.settings.noshop, large: !!S.settings.large,
          peau: !!S.settings.peau, clair: !!S.settings.clair, panneau: habillage()};
}
/** Ranks next building upgrades and crawlers on a planet by payback time. */
function rankUpgrades(p){
  const base = production(p), baseV = mse(base.m, base.c, base.d), out=[];
  /* Deux lectures du même pas. `payback` reste au cours du ratio : c'est le
     chiffre que la carte affiche et que le joueur peut refaire de tête, et il
     ne doit pas bouger parce qu'une autre planète a monté une mine. `score`
     est le même calcul au prix que ces ressources ont dans CET empire, et
     c'est lui qui classe. Les séparer est tout l'objet : le classement suit
     le besoin, l'affichage reste vérifiable. */
  const w = besoinEmpire(), baseW = mseW(base.m, base.c, base.d, w);
  const scoreOf = (pr, cost, gain) => {
    const g = mseW(pr.m, pr.c, pr.d, w) - baseW;
    return (gain > 0 && g > 0) ? mseW(...cost, w)/g : Infinity;
  };
  for(const k of ['metal','crystal','deut']){
    const ov = {[k]:p.b[k]+1}; let cost = levelCost(B[k], p.b[k]+1), extra=0;
    let pr = production(p, ov);
    while(pr.factor<1 && extra<15){ extra++; ov.solar = p.b.solar+extra; const sc=levelCost(B.solar, p.b.solar+extra); cost=cost.map((x,i)=>x+sc[i]); pr=production(p,ov); }
    const gain = mse(pr.m,pr.c,pr.d)-baseV;
    out.push({key:k, lvl:p.b[k]+1, extraSolar:extra, cost, gain, payback: gain>0 ? mse(...cost)/gain : Infinity, score:scoreOf(pr,cost,gain), time:buildTime(k,p.b[k]+1,p)});
  }
  if(base.factor<1){
    const pr = production(p,{solar:p.b.solar+1}), cost=levelCost(B.solar,p.b.solar+1), gain=mse(pr.m,pr.c,pr.d)-baseV;
    out.push({key:'solar', lvl:p.b.solar+1, extraSolar:0, cost, gain, payback: gain>0?mse(...cost)/gain:Infinity, score:scoreOf(pr,cost,gain), time:buildTime('solar',p.b.solar+1,p)});
  }
  /* Les foreuses sont une dépense productive comme une autre : elles se classent
     par amortissement, à côté des mines. Aujourd'hui loin derrière ; elles
     passeront devant quand un niveau de mine coûtera assez cher. */
  const cmax = crawlerMax(p.b.metal, p.b.crystal, p.b.deut), have = p.crawlers||0;
  if(have < cmax && shipReqOk('crawl', p)){
    const n = Math.max(1, Math.min(cmax-have, Math.ceil(cmax/10)));
    // Cinquante d'énergie par foreuse : comme pour une mine, la centrale qu'elles
    // obligent à monter fait partie de leur prix.
    const ov = {crawlers:have+n}; let cost = CRAWLER_COST.map(x=>x*n), extra = 0;
    let pr = production(p, ov);
    while(pr.factor<1 && extra<15){ extra++; ov.solar = p.b.solar+extra; const sc=levelCost(B.solar, p.b.solar+extra); cost=cost.map((x,i)=>x+sc[i]); pr=production(p,ov); }
    const gain = mse(pr.m,pr.c,pr.d)-baseV;
    out.push({key:'crawl', n, lvl:have+n, extraSolar:extra, cost, gain,
              payback: gain>0 ? mse(...cost)/gain : Infinity, score:scoreOf(pr,cost,gain), time:shipTime('crawl', n, p)});
  }
  return out.sort((a,b)=>a.score-b.score);
}
(function uiCharge(){
  const e = window.__uiState, v = window.__uiSeen;
  if(e && typeof e === 'object') for(const [k, x] of Object.entries(e)) if(x === 'open' || x === 'closed') UI.etats[k] = x;
  if(v && typeof v === 'object') for(const [k, x] of Object.entries(v)) if(isFinite(Date.parse(x))) UI.vus[k] = x;
  /* Les replis d'avant ce store vivaient dans S.ui.fold, en booléens : ils
     passent ici une fois, puis S les oublie. */
  const vieux = S.ui && S.ui.fold;
  let migre = false;
  if(vieux && typeof vieux === 'object'){
    for(const [k, x] of Object.entries(vieux)) if(!(k in UI.etats) && typeof x === 'boolean'){ UI.etats[k] = x ? 'open' : 'closed'; migre = true; }
    delete S.ui.fold;
  }
  if(uiPurge(Date.now()) || migre) uiEcrit();
})();
/* Le minuteur qui attend que le défilement se pose, avant de noter `cardLue`. */
var cardLueT = 0;
if(typeof window !== 'undefined' && window.addEventListener) window.addEventListener('scroll', ()=>{
  clearTimeout(cardLueT);
  cardLueT = setTimeout(()=>{
    const sec = cardMode === 'stacked' ? cartesSection() : null;
    if(sec && !VUES_ONGLETS.has(sec.dataset.disposition)){ const id = carteEnHaut(sec); if(id) cardLue[sec.dataset.disposition] = id; }
  }, 800);
}, {passive:true});
/* Au démarrage, ici et non avec les autres gardes plus haut : les tables
   ci-dessus sont des `const`, et les lire avant leur ligne lèverait. */
cartesSain();

function render(){ prioClean(); ignClean(); garderVue(()=>{ header(); view.innerHTML = enScan() ? VIEWS.scan() : VIEWS[tab](); bind(); refresh(); }); }
/* Pendant le relevé, les REFRESH écriraient dans des éléments que l'écran du
   relevé n'a pas : ils ne rafraîchissent que ce qui est à l'écran. */
function refresh(){ garderVue(()=>{ if(!enScan()){ (REFRESH[tab]||(()=>{}))(); cartesSync(); lierRenvois(view); } header(); renderMeteo(); }); }
/* ---------- la race d'une planète ---------- */
/**
 * La race d'une planète : posée à la main, sinon déduite des identifiants de
 * ses cases, sinon du nom d'un bâtiment du tableau de production. Identifiants
 * et nom qui se contredisent ne font pas une race : un conseil sur la mauvaise
 * espèce serait pire que pas de conseil.
 * @returns {{race:string|null, src:string, conflit:boolean, ids?:string[], nom?:string}}
 */
function raceDe(p){
  if(p && p.race && aSoi(LIFEFORMS, p.race)) return {race:p.race, src:'main', conflit:false};
  const ids = [...new Set(lfIds(p).map(raceDeSerie).filter(Boolean))], nom = p ? speciesOfPlanet(p) : null;
  if(ids.length > 1 || (ids.length && nom && nom !== ids[0])) return {race:null, src:'ids', conflit:true, ids, nom};
  if(ids.length) return {race:ids[0], src:'ids', conflit:false};
  if(nom) return {race:nom, src:'nom', conflit:false};
  return {race:null, src:'', conflit:false};
}

/* ---------- les règles du moteur : ignorer, compter ---------- */
/** La clé d'« Ignorer » : la règle, la planète en identifiant du jeu (`daily`
    voyage), et la valeur de la condition. */
function ignKey(c){
  // planetById et non gidDe : celle-là est une const posée en fin de fichier, après le premier rendu
  const p = planetById(c.pid), gid = p && p.gid != null ? String(p.gid) : null;
  return `${c.regle}|${gid || c.pid}|${c.valeur}`;
}

function planetAlerts(p){
  const out = [], pr = production(p);
  const where = S.planets.length>1 ? ` sur ${p.name}` : '';
  const deRegle = id => constatsDe(p, id).map(c => ({sev:NIVEAU_SEV[c.niveau], what:c.what, why:c.why, regle:c.regle, valeur:c.valeur, domaine:c.domaine, c}));
  out.push(...deRegle('RES_ENERGY_NEGATIVE'));
  if(pr.factor<1 && regleActive('RES_ENERGY_NEGATIVE')){
    const opts = energyOptions(p), ok = opts.filter(o=>o.prete), best = ok[0];
    /* Une option écartée ne se dit que si elle aurait été la moins chère :
       sinon l'avertissement ferait regretter un réglage qui ne changeait rien. */
    for(const o of opts)
      if(!o.prete && (!best || o.perPoint < best.perPoint))
        out.push({sev:'warn', domaine:'ressources', what:`${o.kind==='sats' ? 'Satellites écartés' : 'Fusion écartée'}${where}`,
          why:`${energyLine(o)} : moins cher par point d'énergie que ${best ? best.label.toLowerCase() : 'la centrale'}, mais ${o.pourquoiPas}.${o.kind==='sats' ? ' Un satellite part en débris au premier raid, et l\'énergie retombe avec lui.' : ''}`});
  }
  /* Le jeu dit son énergie libre mines bridées ; le moteur les compte à 100 %.
     La marge est donc ce qui resterait une fois le bridage levé. */
  const br = bridage(p);
  if(br){
    const marge = Math.round(pr.eBal - br.extra);
    if(marge >= 0) out.push({sev:'good', domaine:'ressources', what:`Remonter les mines à 100 %${where}`, why:`Tu les as bridées à ${br.min} %. L'énergie suffit de nouveau : il en resterait ${marge} de libre une fois les mines remontées.`});
    else if(pr.factor>=1) out.push({sev:'warn', domaine:'ressources', what:`Mines bridées à ${br.min} %${where}`, why:`Il manque ${-marge} d'énergie pour les remonter à 100 %. Monte la centrale solaire, je te dirai quand les remonter.`});
  }
  /* Chaque niveau de bâtiment occupe un emplacement, et le Terraformeur est un
     bâtiment comme un autre : il lui en faut un de libre pour être posé. Le
     classement par amortissement ne compte pas les emplacements — il proposait
     donc le dernier sans un mot, et le joueur ne l'apprenait que dans la fenêtre
     du jeu, au moment de lancer. */
  const libres = casesLibres(p);
  if(libres === 0) out.push({sev:'bad', domaine:'installations', what:`Plus un emplacement libre${where}`, why:`${p.cases.max} emplacements, tous pris. Le jeu refuse toute construction ici, Terraformeur compris. Démolis un bâtiment que tu ne sers pas — un hangar surdimensionné, le Dépôt de ravitaillement — pour en rendre un.`});
  else if(libres === 1) out.push({sev:'warn', domaine:'installations', what:`Un seul emplacement libre${where}`, why:`${p.cases.pris} sur ${p.cases.max}. La prochaine construction prend le dernier, et plus rien ne se posera ensuite. Le Terraformeur en agrandit la planète, mais il lui faut cet emplacement-là pour être construit : garde-le-lui si tu le vises.`});
  /* Le hangar, plein ou bientôt : deux règles du moteur (RES_STORAGE_FULL,
     RES_STORAGE_SOON). Au plafond, le hangar arrive trop tard — il met des
     heures à sortir — et ce qui relance la production est le plus gros
     chantier payable ici ; avant, le hangar, assez tôt pour être monté. Une
     ressource à la fois, dans l'ordre métal, cristal, deutérium. */
  out.push(...deRegle('RES_STORAGE_FULL').concat(deRegle('RES_STORAGE_SOON')).sort((a, b) => a.valeur - b.valeur));
  return out;
}
/* Un seul vocabulaire de niveau dans tout le panneau : celui des règles du
   moteur. « Urgent » ici et « Critique » là se liraient comme deux échelles. */
const SEV_LABEL = {bad:'Critique', warn:'Important', info:'Conseil', good:'Prêt'};

/* ---------- timers ---------- */
S.timers = S.timers || [];
document.getElementById('bigAlertOk').addEventListener('click', ()=>{ alertQueue.length = 0; document.getElementById('bigAlert').hidden = true; stopFlash(); ackFinished(); });
window.addEventListener('focus', stopFlash);
document.addEventListener('pointerdown', ()=>{ unlockAudio(); stopFlash(); });
/* ---------- réglages du plan ---------- */
/* Place des formes de vie dans la journée. Par défaut elles passent après les
   bâtiments et s'effacent devant ce qu'un chantier proche épargne. */
/* « Avant tout le reste » laissait entendre que les cases passent aussi devant
   la recherche : vrai quand la recherche est « À son tour », faux dès qu'elle
   est « Avant les bâtiments », où le plan la sert d'abord. Les deux menus
   parlent de la même chose — la place par rapport aux bâtiments — et un seul
   des deux le disait. */
const LF_MODE = {after:'Après les bâtiments', first:'Avant les bâtiments', off:'Ne pas s\'en occuper'};
function lfMode(){ return LF_MODE[S.day.lf] ? S.day.lf : 'after'; }
/* Les quatre habillages du panneau. La peau ne change que des couleurs et des
   formes dans `panel.css` : aucune vue n'en sait rien, donc les quatre valent
   pour toutes les pages, écran de relevé et bandeaux compris. */
const HABILLAGES = {relief:'Relief — sobre (par défaut)', domaine:'Une couleur par page', hud:'Console de bord', arcade:'Arcade'};
const habillage = () => HABILLAGES[S.settings.skin] ? S.settings.skin : 'relief';
/* ---------- masquer des morceaux de la page du jeu ----------
   Trois interrupteurs indépendants — Masquer la pub, la bannière, le
   chat — rangés dans chrome.storage.sync sous `masque`. C'est masque.js, dans
   la page, qui les applique : il écoute la même clé, donc un changement ici
   se voit dans chaque onglet ouvert, sans recharger. Le panneau n'en garde
   qu'un miroir pour se dessiner.
   Par défaut les trois sont masqués : un choix jamais fait (clé absente)
   vaut « masqué ». Un choix enregistré, lui, n'est jamais réécrit. masque.js
   applique la même règle, sans quoi la page et le panneau se contrediraient. */
const MASQUE_CLES = ['pub', 'bandeau', 'chat'];
/** Les trois choix ramenés à des booléens : ce qui manque vaut « masqué ». */
function masqueNorme(m){ const o = {}; for(const k of MASQUE_CLES) o[k] = !m || m[k] === undefined ? true : !!m[k]; return o; }
/* `var` : header() peut s'exécuter avant que cette ligne soit atteinte. */
var masque = masqueNorme(typeof window !== 'undefined' ? window.__masque : null);
/** Vrai quand les trois sont masqués : le raccourci dit alors « Tout afficher ». */
function toutMasque(){ return MASQUE_CLES.every(k=>masque[k]); }
/** Ce que fait « Tout masquer » : tout cacher, ou tout rendre si tout l'est déjà. */
function masqueBascule(m){ const tout = MASQUE_CLES.every(k=>m[k]); return masqueNorme({pub:!tout, bandeau:!tout, chat:!tout}); }
/** Pose un nouveau choix, le retient, et redessine ce qui le montre. */
function setMasque(m, retenir){
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
/* Ce que le stockage partagé garde d'une version d'avant. La campagne du mode
   lune (`sy:lune`) n'a plus de lecteur depuis le retrait du mode : on l'efface
   une fois, plutôt que de la laisser occuper le quota. Rien d'autre n'est
   touché — un choix du joueur ne se réécrit pas. */
function syncNettoie(d){
  if(!d || d['sy:lune'] === undefined) return;
  try{ const r = chrome.storage.sync.remove('sy:lune'); if(r && r.catch) r.catch(syncFailed); }catch(e){ syncFailed(e); }
}
/* L'infobulle se pose après coup, sur ce qui est déjà dans la page : les heures
   vivent dans des phrases que esc() traverse, un balisage glissé par
   formatTime y serait échappé. On cherche donc dans les textes les écritures
   que formatTime vient de produire, et on les entoure d'un <time>. */
function tagTimes(root){
  if(!root || typeof document.createTreeWalker !== 'function' || !timeSeen.size) return;
  const keys = [...timeSeen.keys()].sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'));
  const re = new RegExp('(?<![\\w:])(' + keys.join('|') + ')(?![\\d:])', 'g');
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {acceptNode: n =>
    n.parentElement && !n.parentElement.closest('time.hr,script,style,textarea,input,select,option') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT});
  const todo = [];
  for(let n; (n = w.nextNode());){ re.lastIndex = 0; if(re.test(n.nodeValue)) todo.push(n); }
  for(const n of todo){
    const f = document.createDocumentFragment(), s = n.nodeValue; let i = 0; re.lastIndex = 0;
    for(let m; (m = re.exec(s));){
      if(m.index > i) f.appendChild(document.createTextNode(s.slice(i, m.index)));
      const el = document.createElement('time'); el.className = 'hr';
      const ms = timeSeen.get(m[1]); el.dateTime = new Date(ms).toISOString(); el.title = timeTitle(ms);
      el.textContent = m[1]; f.appendChild(el); i = m.index + m[1].length;
    }
    if(i < s.length) f.appendChild(document.createTextNode(s.slice(i)));
    n.parentNode.replaceChild(f, n);
  }
}
if(typeof MutationObserver !== 'undefined' && typeof Node !== 'undefined' && document.body instanceof Node){
  /* Directement dans le rappel, pas dans une image d'animation : un panneau
     caché n'en dessine pas, et ses heures restaient sans infobulle. Nos
     propres <time> relancent l'observateur une fois, qui n'y trouve plus rien. */
  new MutationObserver(() => {
    try{ tagTimes(document.querySelector('.wrap')); tagTimes(document.querySelector('.alertes')); }
    catch(e){ console.error('Copilote : infobulle des heures', e); }
  }).observe(document.body, {childList: true, subtree: true, characterData: true});
}
/** Les quatre champs horaires de l'export : les deux heures, toujours, quel que soit le mode. */
function timeExport(ms){
  const off = srvOffSec(), loc = new Date(ms);
  const full = c => `${c.y}-${p2(c.mo+1)}-${p2(c.d)} ${p2(c.h)}:${p2(c.mi)}:${p2(c.s)}`;
  return {
    serverTime: off == null ? null : full(clockParts(ms, 'server')),
    localTime: full(clockParts(ms, 'local')),
    localTimeZone: LOCAL_TZ,
    // heure serveur − heure locale, en minutes : les fuseaux vont par quart d'heure
    serverOffsetMinutes: off == null ? null : Math.round((off/60 + loc.getTimezoneOffset()) / 15) * 15
  };
}
/* ---------- le rendu d'une action ---------- */
/* Les valeurs à retaper dans le jeu, en pastilles cliquables. Le presse-papier
   reste du côté du joueur : c'est lui qui colle, l'extension ne remplit aucun
   champ — ce serait jouer à sa place, et c'est ce qui fait bannir un compte.
   Les coordonnées sont découpées comme les trois champs du jeu. */
function copyChips(a){
  const out = [];
  // Ce que le lien fait remplir par le jeu n'a pas à être retapé ; les
  // ressources, elles, restent à saisir à la main.
  if(!fleetUrl(a)){
    for(const [k,n] of Object.entries((a && a.ships) || {})) if(n>0) out.push([SHIPS[k] ? SHIPS[k].n : SHIP_PLURAL[k] || k, String(n)]);
    const c = a && a.dest ? parseC(a.dest) : null;
    if(c) [['galaxie',c[0]],['système',c[1]],['position',c[2]]].forEach(x=>out.push([x[0], String(x[1])]));
  }
  const RES = ['métal','cristal','deutérium'];
  ((a && a.res) || []).forEach((x,j)=>{ if(x>0) out.push([RES[j], String(Math.floor(x))]); });
  if(!out.length) return '';
  return `<div class="cp"><span class="cpl">À recopier</span>` + out.map(([l,v])=>`<button class="chip" data-copy="${esc(v)}" aria-label="Copier ${esc(v)}" title="Copier ${esc(v)}">${esc(l)} <b>${esc(v)}</b><span class="ci" aria-hidden="true">⧉</span></button>`).join('') + `</div>`;
}
/* Une carte dit d'abord quoi faire, ce que ça coûte et quand c'est fini : le
   reste — pourquoi cette action, d'où viennent les chiffres, ce que le lien
   fait vraiment — se lit à la demande derrière le ⓘ. Ces phrases restent
   vraies et atteignables ; les empiler sur la carte les rendait illisibles.
   Le ⓘ se pose sur la ligne du type de carte, son texte s'ouvre sous la carte :
   un <details> ne sait pas séparer son résumé de son corps, d'où ce repli à la
   main. `button` est déjà exclu du clic qui ouvre le jeu : le ⓘ ne navigue pas. */
let whyN = 0;
/**
 * @param {string[]} parts les pourquoi, le premier porte la raison
 * @param {string} [key] la carte qui les porte : le ⓘ ouvert le reste au rendu suivant
 * @returns {string[]} [le bouton ⓘ, le texte replié, la raison en une phrase].
 */
function whyParts(parts, key){
  const p = parts.filter(Boolean);
  if(!p.length) return ['', '', ''];
  const lead = whyLead(p[0]);
  // Un ⓘ qui rouvrirait la phrase déjà lue sur la carte ne sert à rien.
  if(p.length === 1 && lead === p[0]) return ['', '', lead];
  const id = 'why' + (++whyN);
  /* Le repli ne redit pas la phrase que la carte porte déjà : il reprend le
     premier pourquoi à partir d'où elle s'arrête. Sans ça, ouvrir le ⓘ relit
     la même ligne avant d'arriver aux chiffres, et c'est pour les chiffres
     qu'on l'ouvre. */
  const reste = p[0].startsWith(lead) ? p[0].slice(lead.length).replace(/^[\s·.]+/, '') : p[0];
  const corps = (reste ? [reste] : []).concat(p.slice(1));
  /* L'identifiant du DOM reste un compteur : la même carte peut se dessiner
     deux fois (maintenant et plus tard dans la journée). L'état, lui, suit la
     carte. */
  const sec = key ? key + '.pourquoi' : '', ouvert = sec && uiOuvert(sec, false);
  return [`<button class="i" type="button" aria-expanded="${ouvert ? 'true' : 'false'}" aria-controls="${id}"${sec ? ` data-ui="${esc(sec)}"` : ''} aria-label="Pourquoi cette action">ⓘ</button>`,
    `<div class="why" id="${id}"${ouvert ? '' : ' hidden'}>${corps.map(x=>`<p>${esc(x)}</p>`).join('')}</div>`,
    lead];
}
function actHtml(a, withBtn){
  const ck = actKey(a); uiVu(ck);
  const [wi, wb, lead] = whyParts([a.why,
    a.src==='estimé' ? 'Prix et durée estimés d\'après les niveaux déjà vus, pas lus sur le jeu ; la durée est probablement sous-estimée.' : a.src==='lu' && a.at ? `Prix lu à ${formatTime(a.at)}.` : '',
    goNote(a)], ck);
  const m = [a.cost ? costHtml(a.cost) : '', a.dur ? `<span class="mono">${dur(a.dur)}</span>` : '', a.end ? `<span>fin ${formatTime(a.end)}</span>` : '', copyChips(a)].filter(Boolean).join('');
  let btn = '';
  if(withBtn && a.kind==='fleet') btn = `<button class="btn sm" data-sent="1">Envoyé</button>`;
  else if(withBtn) btn = `<button class="btn sm primary" data-launch='${esc(JSON.stringify({kind:a.kind,k:a.k,lvl:a.lvl,pid:(S.planets[a.p]||{}).id,n:a.n,id:a.id,ships:a.ships,cost:a.cost,coords:a.coords,dur:Math.round(a.dur),what:a.what}))}'>Lancé</button>`;
  if(withBtn && NO_KINDS[a.kind]) btn = `<span class="btns">${btn}${noBtn(actKey(a))}</span>`;
  /* Le niveau qu'un constat a donné à la carte : la carte du plan est la
     réponse à la règle, c'est donc sur elle qu'il se lit. */
  const niv = a.niveau ? `<span class="pill ${NIVEAU_SEV[a.niveau]}">${SEV_LABEL[NIVEAU_SEV[a.niveau]]}</span> ` : '';
  return `<li data-ck="${esc(ck)}"${goAttr(actGo(a))}><div><div class="q">${niv}${qHtml(a.q)}${wi}</div><div class="w">${esc(a.what)}</div>${lead?`<div class="but">${esc(lead)}</div>`:''}</div>${btn||'<span></span>'}${m?`<div class="m">${m}</div>`:''}${wb}</li>`;
}

/** Le compte à rebours, « 1 h 02 min 05 s », relu chaque seconde. */
function rebours(ms){ const s = Math.max(0, Math.round((ms - Date.now()) / 1000)); return clock(s); }
function majRebours(){
  try{ document.querySelectorAll('[data-impact]').forEach(el => { el.textContent = rebours(+el.dataset.impact); }); }catch(e){}
}
function noBtn(key){ return `<button class="btn sm ghost" data-no="${esc(key)}" title="Ne plus proposer ça">Non</button>`; }
/**
 * Ce qui est de côté, une ligne par carte, avec son propre « Remettre ».
 * Un seul bouton en bloc obligeait à tout reprendre pour récupérer une carte —
 * et surtout il ne disait pas ce qui était écarté : un compte, pas une liste.
 * @returns {string} vide quand rien n'est de côté
 */
function noListe(){
  const keys = Object.keys(S.daily.no);
  if(!keys.length) return '';
  // Les missions ne se nomment qu'en les recalculant : on ne le fait que s'il
  // y en a une de côté.
  const miss = keys.some(k=>k.slice(0,2) === 'm:') ? dailyMissions() : [];
  const lignes = keys.map(k=>`<div class="row"><span class="note grow">${esc(noLabel(k, miss))}</span><button class="btn sm ghost" data-noone="${esc(k)}">Remettre</button></div>`).join('');
  return `<details class="volet"${fold('refus', false)}><summary class="note" data-fold="refus">Cartes mises de côté (${keys.length})</summary>
    <div class="mt-2">${lignes}</div>
    <p class="note">Un « Non » met la carte de côté jusqu'à ce que tu la remettes : rien ne la ramène tout seul.</p>
    ${keys.length>1 ? `<div class="row"><button class="btn sm ghost" data-noclear="1">Tout remettre</button></div>` : ''}
  </details>`;
}
/** La même recette, chaque abréviation dans un <abbr> qui dit son nom et son prix. */
function defRecetteHtml(m, o){
  const d = defRecette(m, o);
  if(!d) return o && o.per === 'PL' ? '' : 'Aucune pièce';
  const u = k => `<abbr title="${esc(defUniteTitre(k))}">${DEF_ABR[k][0]}</abbr>`;
  return `Pour ${nf1.format(d.q)} ${u(d.ancre)} : ${d.items.length ? d.items.map(i=>`${nf1.format(i.n)} ${u(i.k)}`).join(' / ') : 'rien d\'autre'}`;
}
/** « Artillerie laser lourde : 6 000 M / 2 000 C » — les ressources nulles se taisent. */
function defUniteTitre(k){
  return `${DEF_ABR[k][1]} : ${DEF[k].c.map((x,i)=>x > 0 ? `${nf.format(x)} ${'MCD'[i]}` : '').filter(Boolean).join(' / ')}`;
}
/** La carte du modèle choisi : la recette, sa version à 1 PL, le pack, la source. */
function defModeleCarte(k){
  const m = defModele(k), a = defAncreRecette(m), parPL = !(a === 'pt' && m.r.pt === 1) ? defRecetteHtml(m, {per:'PL'}) : '';
  const c = packCost(m);
  return `<div class="defmod" id="defModCarte" data-k="${esc(k)}">
      <p><b>${esc(m.n)}</b></p>
      <p class="mono">${defRecetteHtml(m)}</p>
      ${parPL ? `<p class="note mono">${parPL}</p>` : ''}
      <p class="note">Un pack : <span class="mono"><span class="c-m">${fmtCourt(c[0])} M</span> / <span class="c-c">${fmtCourt(c[1])} C</span> / <span class="c-d">${fmtCourt(c[2])} D</span></span></p>
      <p class="note">${m.perso ? 'Ton propre ratio, saisi ci-dessous.' : `Source : <a href="${DEF_SOURCE}" target="_blank" rel="noopener noreferrer">wiki OGame, Defense Build Strategies</a>`}</p>
    </div>`;
}
/**
 * Le sélecteur de modèle : un volet qui liste chaque modèle avec sa recette et
 * son pack sous le nom. Un <select> ne sait pas écrire deux lignes par option,
 * d'où ces boutons. `dp` vide = le réglage global ; sinon la planète, qui
 * garde son choix « Comme les réglages ».
 * @param {string} actuel la clé choisie, '' pour « Comme les réglages »
 * @param {string} [dp] l'id de la planète
 */
function defPicker(actuel, dp){
  const opt = (k, nom, ligne) => `<button type="button" class="defopt" data-defpick="${esc(k)}"${dp ? ` data-dp="${esc(dp)}"` : ''} aria-pressed="${actuel === k}">
      <b>${esc(nom)}</b>${ligne ? `<span class="note" title="${esc(ligne)}" data-defligne="${esc(k)}">${esc(ligne)}</span>` : ''}</button>`;
  const nom = actuel ? (DEF_MODELES[actuel] || {}).n : 'Comme les réglages';
  return `<details class="defpick"><summary>${esc(nom || '')}</summary><div class="defopts">
      ${dp ? opt('', 'Comme les réglages', '') : ''}
      ${Object.keys(DEF_MODELES).map(k=>opt(k, DEF_MODELES[k].n, defLigne(defModele(k)))).join('')}
    </div></details>`;
}
/** Le ratio perso a changé sous les doigts du joueur : la carte et la ligne
    du menu suivent sans redessiner la vue, pour ne pas lui voler le focus. */
function defPersoLive(){
  const carte = document.getElementById('defModCarte');
  if(carte && carte.dataset.k === 'perso') carte.outerHTML = defModeleCarte('perso');
  const ligne = defLigne(defModele('perso'));
  document.querySelectorAll('[data-defligne="perso"]').forEach(el=>{ el.textContent = ligne; el.title = ligne; });
}

/* Le copilote ne proposera jamais de construire une coque de combat — le wiki
   dit le marché mauvais des deux côtés, et la demande de flotte l'a écrit une
   fois pour toutes. Leurs coûts sont ici pour une seule raison : le tir de lune
   les lit. Les débris valent 30 % du métal et du cristal détruits, donc chiffrer
   un tir demande le coût de ce qui meurt, et rien d'autre ne les lit. */
const SHIP_COST = {
  sc:[2000,2000,0],   lc:[6000,6000,0],      pr:[0,1000,0],         pf:[8000,15000,8000],
  lf:[3000,1000,0],   hf:[6000,4000,0],      cr:[20000,7000,2000],  bs:[45000,15000,0],
  bc:[30000,40000,15000], bb:[50000,25000,15000], ds:[60000,50000,15000],
  rp:[85000,55000,20000], rec:[10000,6000,2000], col:COL_SHIP_COST,
  crawl:CRAWLER_COST};
const SHIP_REQ = {sc:{b:{shipyard:2}, t:{combustion:2}}, lc:{b:{shipyard:4}, t:{combustion:6}}, pr:{b:{shipyard:3}, t:{combustion:3, espionage:2}}, pf:{b:{shipyard:5}, t:{hyperdrive:2}}, crawl:{b:{shipyard:5}, t:{combustion:4, armour:4, laser:4}}};
/* La défense passe par le même chantier, la même file et les mêmes wants que
   les vaisseaux : un seul endroit la nomme et la tarife. */
for(const [k,d] of Object.entries(DEF)){ SHIP_COST[k] = d.c; SHIP_REQ[k] = d.r; SHIP_PLURAL[k] = d.p; SHIP_ONE[k] = d.o; }
for(const k of Object.values(REPORT_WORDS)) SE_BAT[k] = true;
for(const k of ['sat','crawl','pr','abm','ipm']) delete SE_BAT[k];
function shipReqOk(k, p){ const r = SHIP_REQ[k]; return Object.entries(r.b).every(([b,l])=>p.b[b]>=l) && Object.entries(r.t).every(([t,l])=>S.tech[t]>=l); }
function shipTime(k, n, p){ const c = SHIP_COST[k]; return n*(c[0]+c[1])/(2500*(1+p.b.shipyard)*Math.pow(2,p.b.nanite)*ecoSpeed())*3600; }
/* Le niveau sous lequel un surplus est résorbé : assez bas pour que le plafond
   ne revienne pas à la tournée suivante, assez haut pour ne pas vider le stock. */
const DEF_SURPLUS_VISE = 0.9;
/**
 * Le palier tenu, la défense ne monte plus que pour ne pas perdre de
 * production. Une ressource au plafond (règle RES_STORAGE_FULL) ou qui va
 * l'atteindre (RES_STORAGE_SOON) part en packs du modèle — la recette à son
 * ancre, au ratio du modèle, jamais une pièce qu'il ne nomme pas.
 *
 *   packs = min(ce qui ramène la ressource sous 90 % du hangar,
 *               ce que les autres ressources paient, réserves du plan déduites)
 *
 * Moins d'un pack payable : la pièce de la recette qui mange le plus la
 * ressource en trop (les lanceurs pour le métal), seule.
 * Lecture seule : la fonction propose, l'appelant décide.
 *
 * @param {object} p planète (réelle ou simulée)
 * @param {{st?:number[], res?:number[], servies?:boolean[]}} [o] le stock,
 *   les réserves du plan, et les ressources qu'un chantier ou une recherche de
 *   la session consomme déjà (celles-là ne déclenchent rien)
 * @returns {{k:string, ships:object, n:number, pack:boolean, j:number,
 *   plein:boolean, why:string}|null}
 */
function defSurplus(p, o = {}){
  const g = computeDefenseGap(p);
  /* Sous le palier, c'est le manque qui parle, pas le surplus. */
  if(!g || g.lignes.some(l=>l.manque > 0)) return null;
  const r = defRatio(g.modele) || {};
  const recette = DEF_ORDER.filter(k=>!DEF[k].un && num(r[k], 0) > 0);
  if(!recette.length) return null;
  const pr = production(p), st = o.st || stockNow(p), res = o.res || [0,0,0], servies = o.servies || [];
  const rates = [pr.m, pr.c, pr.d];
  const seuil = regleParam('RES_STORAGE_FULL', 'seuil', .98), heures = regleParam('RES_STORAGE_SOON', 'heures', 8);
  /* Active sur la planète : allumée dans les réglages, et pas coupée ici. */
  const on = id => regleActive(id) && !(p.regOff || {})[id];
  const pleinOn = on('RES_STORAGE_FULL'), bientotOn = on('RES_STORAGE_SOON');
  const cands = [];
  for(let j = 0; j < 3; j++){
    const cap = pr.cap[j];
    if(!(cap > 0) || servies[j]) continue;
    const plein = pleinOn && st[j] >= cap * seuil;
    let bientot = false;
    if(!plein && bientotOn && rates[j] > 0){
      const bk = HANGARS[j][1];
      bientot = (cap - st[j]) / rates[j] < Math.max(heures, buildTime(bk, num(p.b[bk], 0) + 1, p) / 3600);
    }
    const exces = st[j] - cap * DEF_SURPLUS_VISE;
    if((plein || bientot) && exces > 0) cands.push({j, plein, exces, taux:st[j] / cap});
  }
  cands.sort((a, b)=>(b.plein - a.plein) || (b.taux - a.taux));
  const libre = j => [0,1,2].map(i=>Math.max(0, st[i] - (i === j ? 0 : res[i])));
  const paie = (c, L) => Math.min(...c.map((x, i)=>x > 0 ? Math.floor(L[i] / x) : Infinity));
  const nom = p.name || planetRef(p);
  const Res = j => NOM_RES[j][0].toUpperCase() + NOM_RES[j].slice(1);
  const recetteTxt = shipList(Object.fromEntries(recette.map(k=>[k, r[k]])));
  for(const c of cands){
    const j = c.j, L = libre(j), etat = c.plein ? 'au plafond' : 'bientôt au plafond';
    const cadre = `${g.nom}, palier ${fmt(g.palier)} tenu`;
    const packC = [0,1,2].map(i=>recette.reduce((a, k)=>a + r[k] * DEF[k].c[i], 0));
    if(packC[j] > 0 && recette.every(k=>shipReqOk(k, p)) && !refused(cardKey('def', p.id, 'pack'))){
      const n = Math.min(Math.ceil(c.exces / packC[j]), paie(packC, L));
      if(n >= 1){
        const ships = Object.fromEntries(recette.map(k=>[k, r[k] * n]));
        return {k:'pack', ships, n, pack:true, j, plein:c.plein,
          why:`${Res(j)} ${etat} sur ${nom} : ${fmt(n)} pack${n > 1 ? 's' : ''} du modèle pour ne pas perdre la production (${cadre} ; un pack = ${recetteTxt}).`};
      }
    }
    /* Pas un pack entier : la pièce qui mange le plus cette ressource dans la
       recette, et à égalité la plus pure — elle ne touche pas aux autres. */
    const part = k => DEF[k].c[j] / mse(...DEF[k].c);
    const pieces = recette.filter(k=>DEF[k].c[j] > 0 && shipReqOk(k, p) && !refused(cardKey('def', p.id, k)))
      .sort((a, b)=>(r[b] * DEF[b].c[j] - r[a] * DEF[a].c[j]) || (part(b) - part(a)));
    for(const k of pieces){
      const n = Math.min(Math.ceil(c.exces / DEF[k].c[j]), paie(DEF[k].c, L));
      if(n < 1) continue;
      return {k, ships:{[k]:n}, n, pack:false, j, plein:c.plein,
        why:`${Res(j)} ${etat} sur ${nom} : pas de quoi payer un pack du modèle, ${shipList({[k]:n})} pour ne pas perdre la production (${cadre}).`};
    }
  }
  return null;
}

/** Ce que cette planète produit entre deux connexions, en métal. */
function tournee(p){ const r = production(p); return mse(r.m, r.c, r.d) * Math.max(15,+S.day.interval||90)/60; }
function hubIndex(){ let best=0; S.planets.forEach((p,i)=>{ if(p.b.lab+p.b.shipyard > S.planets[best].b.lab+S.planets[best].b.shipyard) best=i; }); return best; }
/* ---------- le centre ---------- */
/* La planète où vivent le labo et le chantier. Le wiki l'appelle Vault Planet
   et dit ce qu'on y fait : « should build most of your fleets, defenses, and
   do most of the research ». Il en donne aussi les trois règles, et ce sont
   elles qu'on applique ici : c'est la plus grande planète ; ce n'est pas la
   planète mère, dont le nombre de cases est borné ; et un joueur de flotte
   n'en veut pas, ses planètes devant rester dispersées.
   Ce que ça corrige : `labP` prenait la planète au plus haut labo, donc, sur
   un empire neuf où toutes sont à zéro, la première de la liste — la mère.
   Le premier labo de la partie atterrissait par accident et y restait, la
   règle se nourrissant d'elle-même. */
/** L'index du centre dans S.planets, ou -1 quand l'empire n'en a pas. */
function centreIndex(auto){
  const P = S.planets;
  /* Une planète seule n'est le centre de rien, et le joueur de flotte n'en
     veut pas : dans les deux cas tout le reste retombe sur l'ancien
     comportement. */
  if(P.length < 2 || FOCUS_VAISSEAU[S.day.focus]) return -1;
  if(!auto && S.centre){ const i = planetIndexById(S.centre); if(i >= 0) return i; }
  /* Les cases décident tant que rien n'est bâti, le bâti décide ensuite : un
     bâtiment payé est payé, et en déplacer un coûterait tout ce qu'il a déjà
     coûté. Le centre ne bouge donc jamais de lui-même. */
  /* Seul le labo décide. Le chantier n'a aucune prétention sur le centre : le
     laisser derrière ne coûte rien, puisqu'une colonie monte le sien dès
     qu'elle en a besoin. Le labo, lui, est suivi par `labP` et `labLevel()` :
     un centre posé ailleurs ferait repayer un labo déjà payé, et c'est le pire
     conseil que le copilote puisse donner. Le faire décider par le chantier
     faisait exactement ça — une colonie au chantier plus haut que le labo de
     la mère emportait la recherche — et faisait bouger le centre tout seul au
     premier chantier de transporteur. */
  const cases = p => ((POS[(parseC(p.coords)||[])[2]] || {}).avg) || 0;
  const pose = P.some(p => (p.b.lab||0) > 0);
  const note = p => pose ? (p.b.lab||0) : cases(p);
  const valeur = p => { const r = production(p); return mse(r.m, r.c, r.d); };
  let best = 0;
  for(let i = 1; i < P.length; i++){
    const a = note(P[i]), b = note(P[best]);
    /* À note égale la production départage ; à production égale, l'index le
       plus grand l'emporte, c'est-à-dire une colonie plutôt que la mère. */
    if(a > b || (a === b && valeur(P[i]) >= valeur(P[best]))) best = i;
  }
  return best;
}
/** L'index du centre, ou celui que `hubIndex` désignait avant lui : les liens
    de page n'ont besoin que d'une planète, et sans centre rien ne change. */
function centreOrHub(){ const i = centreIndex(); return i >= 0 ? i : hubIndex(); }
/** L'index de la planète qui porte la plus grosse soute — la même mesure que
    `donorsOf` pour choisir sa base. 0 quand aucune n'a de transporteur. */
function cargoHomeIndex(){
  const cargo = p => (((p.ships||{}).lc)||0)*25000 + (((p.ships||{}).sc)||0)*5000;
  let best = 0;
  S.planets.forEach((p,i)=>{ if(cargo(p) > cargo(S.planets[best])) best = i; });
  return best;
}
/** Ce qu'on ajoute à la raison d'un bâtiment d'empire : pourquoi là et pas
    ailleurs. Vide quand l'empire n'a pas de centre. */
/* La même phrase sur la carte du plan et sur celle de pickBuildings : écrite
   deux fois, elles auraient dérivé. */
const POURQUOI_LABO = 'Débloque la recherche suivante.';
function centreNote(){ return centreIndex() >= 0 ? ' Ton centre : c\'est de là que partent tes recherches et tes vaisseaux.' : ''; }
/** Le centre, ou null. */
function centrePlanet(){ const i = centreIndex(); return i >= 0 ? S.planets[i] : null; }
/** Pourquoi le copilote a désigné cette planète, ou '' quand c'est le joueur
    qui l'a désignée : une raison qu'on n'a pas donnée ne se conteste pas. */
function centreWhy(){
  const i = centreIndex();
  /* Elle ne se tait que si le joueur a choisi autrement que le conseil :
     confirmer le conseil ne doit pas faire disparaître sa raison au moment
     même où il est d'accord avec elle. */
  if(i < 0 || i !== centreIndex(true)) return '';
  const p = S.planets[i];
  if((p.b.lab||0) > 0) return `elle porte déjà le labo ${p.b.lab} : le déplacer coûterait tout ce qu'il a coûté`;
  const pos = (parseC(p.coords) || [])[2], avg = ((POS[pos] || {}).avg) || 0;
  return avg ? `position ${pos}, ${avg} cases en moyenne : un centre est d'abord de la place` : '';
}

/* Un outil retiré laisse son nom dans les réglages du joueur : on ne demande à
   VIEWS que ce qu'il sait encore dessiner. */
const TOOLS = [['explore','Cibles'],['colony','Colonie'],['fleet','Flotte'],['defense','Défense'],['moon','Lune'],['server','Serveur']];
/* Oui/Non : une bascule, pas une liste déroulante. Deux états se lisent d'un
   coup d'œil et tiennent sur une ligne, là où le select coûtait un titre, une
   ligne de plus et un clic pour voir ce qu'on savait déjà. */
const bascule = (id, attr, label, on, note='') =>
  `<label class="f bascule"><span>${label}</span><input type="checkbox" id="${id}" ${attr} ${on?'checked':''}>${note?`<span class="note">${note}</span>`:''}</label>`;
/* ENH-54 : une carte de réglages ne montre qu'une phrase d'aide ; le reste
   attend derrière « En savoir plus », replié, ouvert ou fermé comme le joueur
   l'a laissé (même store que les volets). Rien n'est retiré : une partie de
   ces textes protège d'une erreur, elle reste à un clic. */
const aide = (id, html) =>
  `<details class="aide"${fold('aide:' + id, false)}><summary data-fold="aide:${id}">En savoir plus</summary>${html}</details>`;

const VIEWS = {...VIEWS_AUJOURDHUI, ...VIEWS_RELEVE, ...VIEWS_EMPIRE, ...VIEWS_OUTILS, ...VIEWS_DEFENSE, ...VIEWS_REGLAGES};

const gauge = (k,cls,label,v,sub) => `<div class="gauge"><span class="k"><i class="bg-${cls}"></i>${label}</span><span class="v c-${cls}">${v}</span>${sub?`<span class="s">${sub}</span>`:''}</div>`;

/**
 * Ce que le panneau DESSINE d'une connexion.
 *
 * L'expédition n'en fait plus partie : elle a son bloc, qui la compte, la
 * compose, la classe et la prépare. La montrer aussi dans la liste des actions
 * la faisait lire deux fois — et parfois avec deux planètes différentes, le
 * plan comptant les transporteurs qu'un convoi aura quittés là où le bloc lit
 * la flotte au sol d'aujourd'hui.
 *
 * Le plan, lui, la garde dans `acts` : il lui réserve son deutérium, sort ses
 * vaisseaux de la flotte au sol pour le reste de la journée, et la colonne
 * posée sur les pages du jeu la porte toujours — c'est là, sur l'écran de
 * flotte, qu'elle sert encore.
 */
/* Sous le filtre de la météo, seules les cartes de la planète choisie restent. */
function actsVus(x){ return x.acts.filter(a=>a.kind !== 'expo' && meteoVoit(a)); }
const REFRESH = {...REFRESH_AUJOURDHUI, ...REFRESH_EMPIRE, ...REFRESH_OUTILS, ...REFRESH_REGLAGES};
/* Les écoutes déléguées du panneau : à leur place d'avant, pour garder leur ordre. */
brancheEcoutes();
function on(id,ev,fn){ const el=document.getElementById(id); if(el) el.addEventListener(ev,fn); }
function msg(t){ const m=document.getElementById('ioMsg'); if(m) m.textContent=t; }
/* Le texte collé et le fichier choisi arrivent par deux chemins : un seul dit
   ce qu'est une sauvegarde, sinon l'un des deux accepterait un JSON quelconque
   et remplacerait l'empire par du vide. */
function appliqueSauvegarde(txt){
  let d; try{ d = JSON.parse(txt); }catch(e){ return false; }
  if(!d || !Array.isArray(d.planets) || !d.settings) return false;
  /* Un identifiant — de planète, de minuteur — part dans une quinzaine
     d'attributs interpolés bruts : `id="pn-${p.id}"`, `data-centre`,
     `data-fold`, `data-tmrm`, les `<option value>`. Bruts parce qu'un
     identifiant est un jeton engendré ici, jamais une saisie. Une sauvegarde
     venue d'ailleurs peut mentir là-dessus, et le réécrire obligerait à suivre
     toutes les références qui le citent (centre, colonie, priorités, minuteurs).
     Le fichier est donc refusé en entier : une sauvegarde honnête n'a que des
     jetons, ou pas d'identifiant du tout. */
  const jeton = x => x == null || /^[a-z0-9]{1,24}$/i.test(String(x));
  if(!d.planets.every(q => !q || jeton(q.id))) return false;
  if(Array.isArray(d.timers) && !d.timers.every(x => !x || jeton(x.id))) return false;
  // l'heure de l'enregistrement le date, elle n'est pas un état
  for(const k of ['serverTime','localTime','localTimeZone','serverOffsetMinutes']) delete d[k];
  if(d.srvTz && !Number.isFinite(d.srvTz.off)) delete d.srvTz;
  remplaceEtat(Object.assign(sample(), d)); S.sample = false; sainEtat(); save(); render(); return true;
}
/**
 * Remet d'aplomb les champs de l'état qui viennent d'ailleurs.
 *
 * Deux entrées ne sont pas de la saisie : un fichier de sauvegarde rendu par
 * `appliqueSauvegarde`, et `chrome.storage.sync`. Ni l'une ni l'autre ne
 * garantit la forme de ce qu'elles posent dans `S` — seuls les champs des
 * Réglages la vérifiaient, et ils ne sont pas sur ces chemins.
 *
 * Les textes sont déjà couverts : ce dépôt échappe au point d'affichage
 * (`esc(p.name)`, `esc(a.what)`, `esc(x)` dans `whyParts`). Ce qui restait à
 * découvert, ce sont les champs tenus pour des nombres et donc interpolés
 * bruts : le ratio dans l'onglet Empire et l'attribut `value` des Réglages,
 * l'intervalle et les heures de nuit dans la carte « Plan du jour ». Une
 * sauvegarde reçue d'un autre joueur pouvait y glisser du balisage, dans un
 * panneau qui a les droits de l'extension.
 *
 * Normaliser à l'entrée plutôt qu'échapper à chaque affichage : un seul garde,
 * et tous ces affichages redeviennent justes par construction.
 *
 * Les bornes sont larges à dessein : elles écartent l'absurde sans rejeter ce
 * que les menus des Réglages proposent.
 *
 * ponytail: la liste des champs est tenue à la main, pas dérivée d'un schéma.
 * Le critère d'entrée est « interpolé sans `esc` dans un gabarit » ; `research`
 * et `lf` n'y sont pas parce qu'ils ne servent qu'en comparaison (`=== k`). À
 * relire si un nouveau champ de `S` rejoint un gabarit.
 */
/**
 * Remet d'aplomb ce que le framework d'expédition lit du stockage.
 *
 * À part, et appelée aux deux endroits — au démarrage et dans `sainEtat` —
 * parce que le démarrage n'appelle pas `sainEtat` : une clé validée seulement
 * là arrive telle quelle au premier `render()`. Un facteur de fret absurde
 * envoie deux cents transporteurs, une réserve négative en rend plus qu'il
 * n'y en a, et `expoHold` borne une boucle de durées.
 */
function expoSain(){
  const nb = (v, d, min, max) => { const x = Number(v); return Number.isFinite(x) && x >= min && x <= max ? x : d; };
  if(!S.settings || typeof S.settings !== 'object') return;
  S.settings.expoFret = nb(S.settings.expoFret, EXPO_FRET, 1, 1e5);
  S.settings.expoRes  = Math.round(nb(S.settings.expoRes, 0, 0, 1e5));
  S.settings.expoHold = Math.round(nb(S.settings.expoHold, 1, 1, 24));
  for(const q of S.planets || []) if(q.expoRes != null) q.expoRes = Math.round(nb(q.expoRes, 0, 0, 1e5));
  /* L'historique vient aussi d'une sauvegarde et de l'autre poste : il sert de
     compteur, donc ce doit être une liste de dates, bornée. */
  S.expoLog = Array.isArray(S.expoLog)
    ? S.expoLog.filter(e=>e && typeof e === 'object' && typeof e.sys === 'string' && Number.isFinite(+e.at)).map(expoEntreeSaine).slice(-EXPO_LOG_MAX)
    : [];
  S.expoPrep = Array.isArray(S.expoPrep)
    ? S.expoPrep.filter(x=>x && typeof x.de === 'string' && typeof x.dest === 'string' && Number.isFinite(+x.at) && x.ships && typeof x.ships === 'object').slice(-EXPO_PREP_MAX)
    : [];
}
/** Une entrée du journal relue d'une sauvegarde : ce qui n'a pas la forme
    attendue tombe, pour qu'un champ corrompu ne casse pas les statistiques. */
function expoEntreeSaine(e){
  const flotte = o => o && typeof o === 'object' && !Array.isArray(o)
    ? Object.fromEntries(Object.entries(o).filter(([k,n])=>SHIPS[k] && Number.isFinite(+n) && +n > 0).map(([k,n])=>[k, +n])) : null;
  const res = c => Array.isArray(c) && c.length === 3 ? c.map(x => Math.max(0, +x || 0)) : null;
  e.at = +e.at;
  if(e.envoi != null) e.envoi = e.envoi && typeof e.envoi === 'object' && flotte(e.envoi.ships) ? {ships:flotte(e.envoi.ships), at:+e.envoi.at||0, src:e.envoi.src === 'aller' ? 'aller' : 'prep'} : null;
  if(e.retour != null) e.retour = e.retour && typeof e.retour === 'object' && Number.isFinite(+e.retour.at)
    ? {at:+e.retour.at, ships:flotte(e.retour.ships), cargo:res(e.retour.cargo), lu:+e.retour.lu||0, final:!!e.retour.final} : null;
  for(const k of ['trouves','pertes']) if(e[k] != null) e[k] = flotte(e[k]);
  if(e.cargaison != null) e.cargaison = res(e.cargaison);
  for(const k of ['carburant','duree','aller']) if(e[k] != null && !Number.isFinite(+e[k])) e[k] = null;
  if(e.evenement != null && !EXPO_EVTS[e.evenement]) e.evenement = 'autre';
  return e;
}
function sainEtat(){
  const def = sample();
  const nb = (v, d, min, max) => { const x = Number(v); return Number.isFinite(x) && x >= min && x <= max ? x : d; };

  if(!S.settings || typeof S.settings !== 'object') S.settings = def.settings;
  const r = Array.isArray(S.settings.ratio) ? S.settings.ratio.map(Number) : [];
  S.settings.ratio = (r.length === 3 && r.every(x => Number.isFinite(x) && x > 0)) ? r : def.settings.ratio;

  /* Le modèle de défense : la clé vient d'un menu, mais aussi d'une
     sauvegarde ou de l'autre poste, et le ratio perso est le seul endroit du
     panneau où le joueur écrit des nombres qui repartent dans un `value=""`. */
  if(!(S.settings.defModele in DEF_MODELES)) S.settings.defModele = def.settings.defModele;
  if(S.settings.defPalier !== 'fill' && !DEF_PALIERS.includes(num(S.settings.defPalier, -1))) S.settings.defPalier = def.settings.defPalier;
  const perso = S.settings.defPerso;
  S.settings.defPerso = perso && typeof perso === 'object'
    ? Object.fromEntries(DEF_RATIO.map(k=>[k, nb(Math.round(num(perso[k], 0)), 0, 0, 1e7)]))
    : def.settings.defPerso;
  if(S.settings.defPlancher != null && !DEF_PLANCHERS.includes(num(S.settings.defPlancher, -1))) S.settings.defPlancher = null;
  if(!DEF_DUREES.includes(num(S.settings.defDuree, -1))) S.settings.defDuree = def.settings.defDuree;
  for(const q of S.planets || []){
    if(q.defModele != null && !(q.defModele in DEF_MODELES)) delete q.defModele;
    if(q.defPalier != null && q.defPalier !== 'fill' && !DEF_PALIERS.includes(num(q.defPalier, -1))) delete q.defPalier;
  }

  expoSain();
  cartesSain();

  if(!S.day || typeof S.day !== 'object') S.day = def.day;
  S.day.interval   = nb(S.day.interval,   def.day.interval,   1, 24*60);
  S.day.horizon    = nb(S.day.horizon,    def.day.horizon,    1, 24*30);
  S.day.nightStart = Math.round(nb(S.day.nightStart, def.day.nightStart, 0, 24 - 1/60) * 60) / 60;
  S.day.nightEnd   = Math.round(nb(S.day.nightEnd, def.day.nightEnd, 0, 24 - 1/60) * 60) / 60;
  if(!(S.day.focus in FOCUS)) S.day.focus = def.day.focus;
  S.day.night = !!S.day.night;
  S.day.focusSet = !!S.day.focusSet;
  /* `backHour` est interpolé dans un `value=""` sans esc : une sauvegarde ou
     une synchro peut y mettre n'importe quoi. Null et chaîne vide sont les seules absences. */
  S.day.backHour = S.day.backHour == null || S.day.backHour === '' ? null : nb(S.day.backHour, null, 0, 23);
  /* Un `until` truqué garderait le plan en veille pour toujours, ou le
     rallumerait à chaque battement. */
  S.day.until = Number.isFinite(Number(S.day.until)) ? Math.max(0, +S.day.until) : 0;

  profilSain();

  /* Une sauvegarde d'avant les identifiants n'en porte pas : sans ça, tout
     l'onglet Planètes s'affiche en `pn-undefined`. Même jeton que
     `migratePlanetIds`. */
  for(const q of S.planets || []){
    if(!q.id) q.id = Math.random().toString(36).slice(2,9);
    if(q.satsOk != null) q.satsOk = !!q.satsOk;
  }
}
/** Recalcule le plan du jour pour la page du jeu, sans rien afficher.
    `today` le publie en se dessinant ; ailleurs, c'est à nous de le faire.
    Le dessin qui suit la publication écrit dans des éléments de l'onglet
    Aujourd'hui, absents : il échoue, et c'est sans conséquence — la page a
    déjà reçu ce qu'elle attendait. */
function publieLePlan(){
  if(!IS_EXT || tab === 'today') return;
  try{ REFRESH.today(); }catch(e){}
}


/**
 * Cale une planète sur ce que le panneau de production affiche : d'abord son
 * solde d'énergie (eAdj), puis sa production horaire (pAdj). Même mesure dans
 * les deux cas — on remet l'écart à zéro pour que production() rende le chiffre
 * du moteur seul, et ce qui reste est ce qu'il ne sait pas expliquer : la
 * consommation des formes de vie déjà bâties, une mine bridée à la main, un
 * bonus que la formule ignore.
 * Sans effet si la planète est inconnue, la lecture a plus de sept jours ou
 * l'énergie libre est illisible. Une lecture ne cale qu'une fois (eAdjAt) : le
 * panneau et les niveaux viennent de la même visite, et une relecture plus tard
 * effacerait le coût des niveaux montés depuis.
 * @param {object|undefined} p planète de S.planets
 */
function calePlanete(p){
  const r = prodOf(p);
  const free = r && r.energy && r.energy.free;
  if(!Number.isFinite(free) || !(Date.now() - r.at < LF_READ_TTL) || p.eAdjAt === r.at) return;
  const borne = x => Math.min(Math.max(x, -1e9), 1e9);
  p.eAdjAt = r.at;
  p.eAdj = 0;
  p.eAdj = borne(free) - production(p).eBal;
  /* Puis les trois ressources, sur « Total par heure » — le chiffre que le
     joueur a sous les yeux. L'énergie d'abord : elle décide du facteur, donc
     de la production. La formule connaît les niveaux, le plasma, la classe et
     les formes de vie ; elle ignore le reste, et c'est ce reste qu'on mesure.
     Comme pour l'énergie, la mesure se fait à écart nul, et une seule fois par
     lecture — sinon la relecture d'un vieux panneau effacerait la mine montée
     depuis. */
  const t = r.perHour;
  if(!Array.isArray(t) || !t.every(x => Number.isFinite(x))) return;
  p.pAdj = [0,0,0];
  const f = production(p);
  p.pAdj = [borne(t[0]) - f.m, borne(t[1]) - f.c, borne(t[2]) - f.d];
}

/* ---------- live sync from the extension ---------- */
/** Merges the game state collected by the content script into the panel state. */
function applyGame(g){
  if(!g) return;
  const m = g.meta || {};
  if(m.playerId) S.me = m.playerId;
  if(m.host) S.host = m.host;
  S.explored = g.explored || S.explored || {};
  // le décalage du serveur, relu à chaque page : formatTime en tire l'heure serveur
  if(g.srvTz && Number.isFinite(g.srvTz.off)) S.srvTz = {off: g.srvTz.off, at: g.srvTz.at || 0, ok: g.srvTz.ok !== false};
  if(m.eco) S.settings.eco = m.eco;
  if(m.fleet) S.settings.fleet = m.fleet;
  if(m.cls) S.settings.cls = m.cls;
  Object.assign(S.tech, g.tech || {});
  const ids = (g.order && g.order.length) ? g.order : Object.keys(g.planets || {});
  const kept = [];
  for(const id of ids){
    const gp = (g.planets || {})[id]; if(!gp) continue;
    let p = S.planets.find(x=>x.gid===id) || S.planets.find(x=>!x.gid && x.coords===gp.coords);
    if(!p){
      p = (S.sample && kept.length===0) ? S.planets[0] : newPlanet(gp.name||'Planète', gp.coords||'', gp.tmax ?? 20, {});
      // révélée par la liste du jeu : elle a un nom, pas encore de niveaux
      if(p !== S.planets[0]) p.bNeuve = 1;
    }
    p.gid = id;
    if(gp.name) p.name = gp.name;
    if(gp.coords) p.coords = gp.coords;
    if(gp.lf){ const lf = Object.assign({}, p.lf); for(const [k,v] of Object.entries(gp.lf)) lf[k] = lfMerge(lf[k], v); p.lf = lf; }
    if(gp.lfSeen) p.lfSeen = Object.assign({}, p.lfSeen, gp.lfSeen);
    if(gp.tmax != null) p.tmax = gp.tmax;
    if(casesSaines(gp.cases)) p.cases = { pris: gp.cases.pris, max: gp.cases.max };
    Object.assign(p.b, gp.b || {});
    /* `bLu` est posé ici et nulle part ailleurs : c'est le seul endroit où le
       jeu rend une grille de niveaux. Un `gid` ne dit que le nom, et `bNeuve`
       s'efface à la première frappe du joueur — ni l'un ni l'autre ne peut
       servir de preuve que ces niveaux viennent du jeu. */
    if(gp.b && Object.keys(gp.b).length){ delete p.bNeuve; p.bLu = 1; }
    if(gp.sats != null) p.sats = gp.sats;
    if(gp.crawlers != null) p.crawlers = gp.crawlers;
    if(gp.def != null) p.def = gp.def;
    if(gp.defs) p.defs = Object.assign({}, gp.defs);
    if(gp.defsAt) p.defsAt = gp.defsAt;
    if(gp.energy != null){ p.eAdj = 0; p.eAdj = gp.energy - production(p).eBal; }
    if(gp.ships){ p.ships = Object.assign({}, gp.ships); p.shipsAt = gp.shipsAt || 0; }
    if(gp.stock && gp.stock.m != null && gp.stock.at !== p.stockGameAt){ p.stock = {...gp.stock}; p.stockGameAt = gp.stock.at; }
    kept.push(p);
  }
  if(kept.length) S.planets = kept;
  lfMetEnCommun();
  /* Une priorité reçue d'un autre poste attendait sa planète : le relevé vient
     de la nommer, elle peut enfin désigner la planète d'ici. */
  S.prio = prioIn(S.prio);
  S.timers = (S.timers || []).filter(t=>!t.game);
  for(const t of (g.timers || [])){
    const tm = {id:'g'+t.end+(t.techId||t.type)+(t.planetId||''), game:true, queue:t.type, end:t.end*1000, done:t.end*1000 <= Date.now()};
    const pi = S.planets.findIndex(p=>p.gid===t.planetId);
    if(OG_TECH[t.techId]){ tm.kind='t'; tm.k=OG_TECH[t.techId]; tm.lvl=S.tech[tm.k]+1; if(pi>=0){ tm.pid=S.planets[pi].id; if(!tm.done) S.rechPid = tm.pid; } }
    else if(OG_BUILD[t.techId] && pi>=0){ tm.kind='b'; tm.pid=S.planets[pi].id; tm.k=OG_BUILD[t.techId]; tm.lvl=S.planets[pi].b[tm.k]+1; }
    else if(t.type==='fleet'){ tm.kind='x'; tm.k = /exp/i.test(t.label) ? 'expo' : 'fleet'; tm.label = t.label; }
    else {
      tm.kind='x'; tm.k = t.type!=='shipyard' ? 'other' : +t.techId===212 ? 'sats' : 'shipyard';
      tm.techId = t.techId || null;
      tm.pid = (S.planets[pi]||{}).id;
      tm.label = t.label + (pi>=0 && S.planets.length>1 ? ` · ${S.planets[pi].name}` : '');
      /* Le jeu nomme ce que son chantier sort, jamais combien : « Grand
         transporteur » peut en valoir un ou cent, et sa file enchaîne les lots
         sans annoncer les suivants. On retient donc l'heure du lot : le compte
         au sol ne vaut que jusque-là, et `chantierFlou` fait taire ce chantier
         jusqu'à ce que la page le redise. Sans ça, le copilote reproposait ce
         qui était déjà en construction, et la carte disparaissait au clic — au
         moment où la page relue lui apprenait la vérité. */
      if(t.type==='shipyard' && S.planets[pi]){
        const q = S.planets[pi], id = +t.techId || 0, def = id>=400 && id<500;
        if(!def) q.flotteFloue = Math.max(q.flotteFloue||0, tm.end);
        if(def || !id) q.defFloue = Math.max(q.defFloue||0, tm.end);
      }
    }
    S.timers.push(tm);
  }
  S.timers = S.timers.filter(t=>t.game || !t.manual || !S.timers.some(g=>g.game && !g.done && g.kind===t.kind && g.k===t.k && (g.kind!=='b' || g.pid===t.pid)));
  S.moves = g.moves || [];
  S.arrived = g.arrived || [];
  /* Une sonde en vol vaut un « Fait » : la cible sort de la liste sans clic.
     Mission 6 = espionnage ; le jeu la montre tant qu'elle n'est pas rentrée. */
  for(const m of S.moves) if(m.mission===6 && !m.ret && m.dest) S.raids[m.dest] = {at:Date.now(), probe:true};
  /* L'historique des expéditions, pris sur les mouvements du jeu plutôt que
     sur un clic : le joueur envoie depuis l'écran Flotte, et le copilote ne le
     voit pas partir. L'aller ouvre l'entrée quand il est vu ; le retour la
     complète — c'est lui qui dit ce que l'expédition a ramené, et lui seul est
     sûr d'être vu : l'aller ne vole que quelques minutes. L'heure du retour
     date l'entrée : un système reste « sollicité » tant que la flotte y est.
     Les rapports de la messagerie, quand le joueur l'a ouverte, disent le
     type d'événement. */
  try {
    expoJournal(S.moves, Date.now(), +g.listeVue || 0);
    expoMessages(g.expoMsgs);
  } catch(e){ console.error('Copilote : journal des expéditions', e); }
  if(g.artefacts != null) S.artefacts = g.artefacts;
  if(g.slots) S.slots = g.slots;
  if(g.prod && typeof g.prod === 'object'){
    S.prod = S.prod || {};
    for(const [gid, e] of Object.entries(g.prod)){
      if(!/^\d+$/.test(gid)) continue; // « __proto__ » & co : jamais une clé
      const r = e && parseProdPanel(e.text);
      if(r){ r.at = +e.at || 0; S.prod[gid] = r; calePlanete(S.planets.find(x=>x.gid===gid)); }
    }
  }
  if(g.prodUrl) S.prodUrl = g.prodUrl;
  if(g.lfMenu != null) S.lfMenu = g.lfMenu;
  if(g.cur) S.cur = g.cur;
  S.page = g.page || null;
  S.sample = false;
  S.syncAt = g.at || Date.now();
  lfNomsRetiens(g.lfNoms); // les noms lus sur une planète servent à toutes
  prioRecoit(); // une planète vient peut-être d'être relevée
  save();
  const a = document.activeElement;
  const typing = a && view.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName);
  typing ? refresh() : render();
  releveLu();
  // render() ne publie le plan que sur Aujourd'hui : une demande placée ici resterait muette sur la tuile
  publieLePlan();
  // L'icône compte les critiques à chaque mise à jour des données, quel que soit l'onglet ouvert.
  publieCritiques();
}
meteoBind();
render();
/* Et à l'ouverture du panneau : le réglage peut avoir été posé avant que la
   page sache l'écouter, auquel cas aucun changement de sélecteur ne viendra
   plus jamais le lui dire. */
pushLook();
/* Ce que la page du jeu affiche vient du plan, et le plan ne se publie que
   depuis l'onglet Aujourd'hui. Un panneau rouvert sur Réglages laissait donc
   la page avec le plan d'avant — et rien ne le disait. On le recalcule pour
   elle, même quand on regarde ailleurs : le dessin ne doit pas dépendre de
   l'onglet ouvert. */
publieLePlan();
publieCritiques();
if(window.__game) applyGame(window.__game);
/* Demandes déposées pendant que le panneau était fermé. boot.js ne transmet que
   les clés « ls: » et game/api : sans lui, la clé resterait dans le stockage. */
prioAccueille(window.__prioAsk);
/* Appliquer, puis effacer la clé, sauvegarder, redessiner : la page ré-ajoute à
   une clé vide, et une demande rejouée poserait deux fois. */
function prioAccueille(liste){
  if(!Array.isArray(liste) || !liste.length) return;
  prioRecoit(liste);
  try{ chrome.storage.local.remove('prioAsk'); }catch(e){ console.error('Copilote : clé prioAsk non effacée, le prochain démarrage rejouera ce lot', e); }
  save();
  render();
  // render() ne publie le plan que sur Aujourd'hui : sans cela la tuile resterait muette
  publieLePlan();
}
chrome.storage.onChanged.addListener((ch, area)=>{ if(area==='local' && ch.prioAsk) prioAccueille(ch.prioAsk.newValue); if(area==='local' && ch.game) applyGame(ch.game.newValue); if(area==='local' && ch.api){ poseApi(ch.api.newValue); if(tab==='tools' && (S.ui.tool==='explore'||S.ui.tool==='server')) render(); } });

/* ---------- deux postes, un seul plan ---------- */
/* Le stockage local ne voyage pas : sur un deuxième ordinateur le panneau
   repart d'une copie à lui, et ne propose pas la même chose. Ce qui se
   redécouvre en jouant — niveaux, files, relevé de l'empire — reste local :
   chaque poste le relit des pages du jeu, et le partager donnerait au poste en
   retard le pouvoir d'écraser le poste à jour. Ce que le joueur décide, lui, ne
   se redécouvre pas : c'est cela qui voyage.
   Le pid est tiré au sort à la création de la planète, donc propre au poste ;
   le gid vient du jeu et vaut sur les deux. Même règle qu'à la frontière de la
   page du jeu : on traduit en sortie et en entrée, et S ne garde jamais de gid. */
const SYNC_KEYS = ['settings','day','expo','lf','raids','daily','profil'];
/* gidDe est déclarée plus haut, près de planetIndexById : le premier rendu la lit déjà (clé d'« Ignorer »). */
const pidDe = gid => { const p = (S.planets || []).find(x => x.gid != null && String(x.gid) === String(gid)); return p ? p.id : null; };
/* Une recherche ne porte pas de pid : elle voyage telle quelle.
   L'ordre des clés compte, et c'est tout sauf cosmétique : syncApply compare au
   JSON, et le stockage partagé nous renvoie notre propre écriture. Reconstruite
   clé par clé dans un autre ordre, elle revenait méconnaissable — S.prio était
   remplacé, chg passait à vrai, et render() repassait toutes les dix secondes.
   Le joueur voyait le volet qu'il venait d'ouvrir se refermer sous ses doigts.
   On rebâtit donc dans l'ordre exact où prioPose range. */
function prioOut(l){
  return (l || []).map(e => {
    if(!e || e.kind === 't' || !e.pid) return e;
    const gid = gidDe(e.pid); if(gid == null) return e;
    const o = {kind:e.kind, gid, k:e.k, lvl:e.lvl};
    if(Number.isInteger(e.puis)) o.puis = e.puis;
    return o;
  });
}
function prioIn(l){
  return (l || []).map(e => {
    if(!e || e.gid == null) return e;
    // planète pas encore relevée ici : l'entrée attend, applyGame repassera
    const pid = pidDe(e.gid); if(!pid) return e;
    const o = {kind:e.kind, pid, k:e.k, lvl:e.lvl};
    if(Number.isInteger(e.puis)) o.puis = e.puis;
    return o;
  });
}
function syncOut(){
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
/* `var` et non `let` : save() part dès le chargement, avant que cette ligne
   soit atteinte, et une liaison temporairement morte lèverait là. */
var syncT = 0;
/* Le stockage partagé compte les écritures à la minute : on groupe, plutôt que
   d'écrire à chaque clic. */
function syncPush(){
  if(typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.sync) return;
  clearTimeout(syncT);
  syncT = setTimeout(() => {
    try{ const r = chrome.storage.sync.set(syncOut()); if(r && r.catch) r.catch(syncFailed); }
    catch(e){ syncFailed(e); }
  }, 10000);
}
/* Le quota dépassé ou le navigateur déconnecté : le poste continue de jouer sur
   sa copie locale, mais le taire laisserait croire les deux postes d'accord. */
function syncFailed(e){ console.error('Copilote : synchro entre postes impossible', e); }
/* Ce que notre propre écriture nous renvoie est déjà dans S : comparer évite le
   rendu pour rien, et surtout le va-et-vient entre deux panneaux ouverts. */
function syncApply(d){
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
if(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync){
  chrome.storage.sync.get(null, d=>{ syncApply(d); syncNettoie(d); });
  chrome.storage.onChanged.addListener((ch, area)=>{
    if(area !== 'sync') return;
    // le mode des heures choisi dans un autre panneau ouvert
    if(ch.timeMode) setTimeMode(ch.timeMode.newValue);
    // le masquage changé ailleurs : on suit, sans réécrire ce qu'on reçoit
    if(ch.masque) setMasque(ch.masque.newValue, false);
    // et la disposition des cartes
    if(ch.cardLayout) setCardMode(ch.cardLayout.newValue, true);
    const d = {}; for(const k in ch) d[k] = ch[k].newValue;
    syncApply(d);
  });
}
document.getElementById('bigAlertOk').addEventListener('click', ()=>chrome.storage.local.set({pendingAlerts: []}));
chrome.storage.local.get('pendingAlerts', d=>mirrorAlerts(d.pendingAlerts));
chrome.storage.onChanged.addListener((ch, area)=>{ if(area==='local' && ch.pendingAlerts) mirrorAlerts(ch.pendingAlerts.newValue); });

finDeNuit();
armeRappel();
/* Le badge du rappel : allumé par le service worker, éteint quand le joueur
   ouvre le plan. Le panneau ouvert le suit pour mettre le plan en avant. */
if(IS_EXT) try{
  chrome.storage.local.get('fsRappelOn', d=>{ poseRappel(d && d.fsRappelOn || null); if(FS_RAPPEL_ON && tab==='today') refresh(); });
  chrome.storage.onChanged.addListener((ch, area)=>{ if(area==='local' && ch.fsRappelOn){ poseRappel(ch.fsRappelOn.newValue || null); if(tab==='today') refresh(); } });
}catch(e){}
setInterval(majRebours, 1000);

/* ---------- version, historique, mise à jour ---------- */

/* Deux choses que le dépôt sait et que le panneau ignorait : d'où il vient, et
   s'il est en retard. L'historique est écrit par ./pack.sh dans `versions.tsv`,
   une ligne par commit : c'est son empreinte qu'on passe à `git checkout` pour
   revenir en arrière. La version du dépôt se lit sur son manifeste public.
   Ni l'un ni l'autre n'installe quoi que ce soit : une extension ne peut pas
   écrire dans son propre dossier, et le manifeste v3 lui interdit d'exécuter du
   code distant. Le panneau dit donc quoi taper, et s'arrête là. */

const DEPOT_MANIFEST = 'https://raw.githubusercontent.com/WilfriedW/copilote-ogame-ext/main/manifest.json';
/** On ne redemande pas la version du dépôt plus souvent que ça. */
const MAJ_TTL = 6 * 3600e3;

/**
 * Vrai si `b` est une version plus récente que `a`. Nombre par nombre :
 * l'ordre des chaînes mettrait « 2.10.0 » avant « 2.9.0 ».
 * @param {string} a @param {string} b
 */
function plusRecente(a, b){
  const n = v => String(v).split('.').map(x => parseInt(x, 10) || 0);
  const x = n(a), y = n(b);
  for(let i = 0; i < Math.max(x.length, y.length); i++){
    const xi = x[i] || 0, yi = y[i] || 0;
    if(yi !== xi) return yi > xi;
  }
  return false;
}

/** Ce que la version du dépôt change à l'écran, qu'elle sorte du réseau ou du
    stockage. Le numéro vit dans l'en-tête, que le panneau étroit cache : sans
    le toast, une version neuve ne se verrait qu'en ouvrant les réglages. */
function annonceMaj(){
  if(plusRecente(APP_VERSION, MAJ)) toast(`v${MAJ} disponible`);
  if(tab === 'settings') render();
}

/* Les deux lectures se font une fois, à l'ouverture du panneau. Hors de
   l'extension — la page de démonstration, le harnais de test — `getURL`
   n'existe pas et il n'y a rien à lire. */
if(IS_EXT && chrome.runtime.getURL) (function(){
  fetch(chrome.runtime.getURL('versions.tsv')).then(r => r.ok ? r.text() : '').then(t => {
    VERSIONS = t.split('\n').map(l => l.split('\t')).filter(c => c.length >= 4);
    if(VERSIONS.length && tab === 'settings') render();
  }).catch(()=>{});
  /* Le fichier est public et demandé sans identifiant ni cookie, mais une
     requête à chaque ouverture du panneau dirait quand même à GitHub à quelle
     heure ce joueur joue, jour après jour. La réponse est donc gardée six
     heures, et le reste du temps le panneau affiche ce qu'il sait déjà. */
  chrome.storage.local.get(['majAt', 'majVer'], d => {
    if(d.majVer){ MAJ = d.majVer; annonceMaj(); }
    if(d.majAt && Date.now() - d.majAt < MAJ_TTL) return;
    fetch(DEPOT_MANIFEST, {credentials:'omit'}).then(r => r.ok ? r.json() : null).then(m => {
      if(!m || !m.version) return;
      MAJ = m.version;
      try{ chrome.storage.local.set({majAt: Date.now(), majVer: MAJ}); }catch(e){}
      annonceMaj();
    }).catch(()=>{});
  });
})();

/* Ce que les modules sortis d'app.js lui empruntent encore. Rien de plus :
   un nom ajouté ici sans module qui l'importe est un oubli. */
export {
  planetById, centreOrHub, centrePlanet, rankUpgrades, shipTime, shipReqOk,
  save, raceDe, ignKey, lfMode, on, SHIP_COST, lfNom, lfIdPour, poseLfCles,
  addBuilt, render, TOOLS, bascule, syncFailed, planetAlerts, cargoHomeIndex,
  planetIndexById, LF_MODE, defSurplus, tournee, hubIndex, centreIndex,
  POURQUOI_LABO, centreNote, aide, SEV_LABEL, prioLfEtat, gameSkin,
  copyChips, whyParts, actHtml, rebours, noBtn, noListe, actsVus,
  defRecetteHtml, defModeleCarte, defPicker, poseNom, centreWhy, VIEWS,
  gauge, REFRESH, toast, habillage, forgetPlanet, pushLook, refresh, masque,
  masqueBascule, setMasque, timeExport, defPersoLive, msg,
  appliqueSauvegarde, publieLePlan, APP_VERSION, VERSIONS, MAJ, HABILLAGES,
  MASQUE_CLES, toutMasque, plusRecente
};
