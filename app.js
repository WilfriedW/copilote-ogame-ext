/* Module ES, chargé par src/main.js (issue #49). Il se vide domaine par
   domaine : il importe ce que les modules sortis de lui fournissent, et
   n'exporte que ce que la météo et la flotte cible lui empruntent (liste en
   fin de fichier). */
import {
  KEY, LUNE_DF, EXPO_FRET, sample, newPlanet, S, remplaceEtat
} from './src/core/etat.js';
import {
  nf, fmtLigne, fmt, esc, num, costHtml, planetRef, PLANET_COLORS,
  planetTag, planetHue, qHtml, fmtK, majus, nf1, fmtCourt
} from './src/core/format.js';
import {
  B, B_SHORT, T, levelCost, rangeCost, storageCap, storageLevelFor,
  crawlerMax, crawlerBonus, CRAWLER_COST, CRAWLER_ENERGY, MINES_PCT,
  POS_BONUS_M, POS_BONUS_C, satEnergy
} from './src/core/formules.js';
import {
  IS_EXT, API, poseApi, srv, ecoSpeed, researchDiv, hyperCargoPct,
  buildTime
} from './src/core/serveur.js';
import {
  dur, LOCAL_TZ, timeMode, srvOffSec, clockParts, p2, timeSeen,
  formatTime, timeTitle
} from './src/core/temps.js';
import {
  DEF, DEF_ORDER, DEF_MODELES, DEF_RATIO, DEF_PALIERS, DEF_SOURCE,
  DEF_ABR, defModele, defAncreRecette, defRecette, packCost, defLigne,
  defsOf, defRatio, defAncre, defPalierDe, DEF_DUREES, DEF_PLANCHERS,
  computeDefenseGap, defPropositions, defBloqueTexte, defPlan,
  defPalierOpts
} from './src/defense/defense.js';
import { flotteCible, flotteCibleHtml, flotteAjout } from './src/flotte/cible.js';
import {
  EXPO_LABELS, EXPO_LOG_MAX, EXPO_STATS_N, EXPO_CALIB_MIN, EXPO_PREP_MAX,
  EXPO_PREP_TTL, EXPO_EVTS, top1Tier, expoFind, expoPts, expoFret,
  expoRes, expoFleet, expoCap, expoJournal, expoMessages, expoStats,
  expoFretPropose, expoPropose, expoEtat
} from './src/flotte/expeditions.js';
import {
  SHIPS, parseC, distance, souteUtile, shipStats, flight, SHIP_PLURAL,
  SHIP_ONE, shipList, shipCourt, mcd, planeteEn, mouvements, aQuai
} from './src/flotte/vaisseaux.js';
import {
  LF_NAMES, lfMetEnCommun, lfMerge, lfCost, lfCandidates, raceDeSerie,
  RACE_SRC, nomRace, lfNomConnu, rescanner, lfNomsRetiens, LIFEFORMS,
  speciesOfPlanet, readLifeforms, lfPourPos, lfRaisonPos, LF_READ_TTL,
  lfIds, LF_ROLE, LF_PALIER, lfPopNourriture, lfPosePaliers
} from './src/formes-de-vie/formes-de-vie.js';
import { meteoFiltre, meteoVoit, renderMeteo, meteoBind } from './src/meteo.js';
import {
  MILESTONES, milestoneDone, milestoneLabel, milestoneMissing,
  casesSaines, casesLibres, rechercheEnCours, depensesPayables,
  RESEARCH_MODE, researchMode, dayValue, nextResearch, simulateDay,
  whyLead, livraisons, projectResources, statutFinancement, cardKey,
  refused
} from './src/plan/journee.js';
import {
  energyOptions, energyLine, dailyMissions, NO_KINDS, actKey, missionKey,
  noLabel, missionDone
} from './src/plan/missions.js';
import { poseHeure, hhmmDe, heureTxt, nightLen, absenceJour } from './src/plan/nuit.js';
import {
  prios, priosLf, prioClean, PRIO_ATTENTE, prioDemandes, prioAttend,
  prioRecoit, lvLu, prioCount, prioLvl, prioPose, poseK, lfCle, poseKind,
  poseVise, poseLignes, posePartout, poseRetireTout, poseRien, poseCoche,
  poseChamp, prioOrdre, prioDevant, prioSuite, prioRef, prioRetire,
  FOCUS, FOCUS_VAISSEAU
} from './src/plan/priorites.js';
import { besoinEmpire, mseW, VOC_NOM, vocations } from './src/plan/vocations.js';
import {
  REGLES_ERR, REGLES, aSoi, REGLES_PAR_ID, EVAL, NIVEAUX, NIVEAU_SEV,
  SEV_NIVEAU, DOMAINES, regle, regleActive, regleParam, regleSaine,
  reglePose, rangNiveau, constatsDe, HANGARS, ignores, constatsVus,
  ignClean, publieCritiques
} from './src/regles/moteur.js';
import {
  FS_MISSION, secu, espionnagesEntrants, planSecurite, FS_RAPPEL_ON,
  poseRappel, fsRappelActif, fsRappelVu, armeRappel
} from './src/securite/securite.js';
import {
  RELEVE_NUIT, scanEtat, RELEVE_NOMS, poseScanEcran, releveEnCours,
  releveLu, faitLeReleve, boutonMaj, header, enScan, setTimeMode,
  modeNuit, finDeNuit
} from './src/vues/entete.js';
import {
  view, tab, poseOnglet, UI, uiPurge, uiEcrit, uiOuvert, uiNote, uiVu,
  uiReset, fold, cardMode, cardTabs, cardForce, RESUMES, resumeDe,
  CARTES, VUES_ONGLETS, segTabs, cardLayout, cartesSection, cartesSync,
  carteDetails, carteChoisie, carteRetiens, carteEnHaut, cardLue,
  lierRenvois, setCardMode, CARTES_DEF, cartesVal, cartesSain,
  voirPlusCle, voirPlusOuvert, cartesMenu, listeCartes, affichageCard,
  garderVue
} from './src/vues/navigation.js';

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
const prioRangHtml = (kind, pid, k) => { const r = prioOrdre(kind, pid, k); return r ? ` <span class="note">rang ${r.i + 1} sur ${r.n}</span>` : ''; };
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
/* L'état d'une ligne est celui que le plan lui a donné à la première session,
   jamais son rang dans la liste : une priorité que rien ne sert — labo
   manquant, prérequis absent, tour pas venu — l'annonçait quand même en
   premier, ce qui est le contraire de ce que ce bloc doit dire.
   Le bloc ne promet rien la nuit : le plan du jour ne tourne pas. */
/* Le bloc reste là même vide. Les deux champs où l'on pose vivent dans des
   volets repliés — « Niveaux des bâtiments » sur la carte d'une planète,
   « Recherches » plus bas — et un panneau fraîchement ouvert ne montrait donc
   rien de cette fonctionnalité, nulle part : ni champ, ni bloc, ni mot. Dire
   où aller coûte trois lignes ; un joueur qui ne trouve pas le champ ne pose
   jamais rien, et tout le reste de ce travail ne sert à personne. */
function prioHtml(plan){
  const l = prios(), lf = priosLf(), at = prioDemandes(), loin = prioAttend();
  if(!l.length && !lf.length && !at.length && !loin.length) return `<div class="card"><h2>Tes priorités</h2><p class="note">Aucune pour l'instant. Dans le jeu, fais un <b>clic droit</b> sur la case d'un bâtiment, d'une recherche ou d'une forme de vie : elle devient une priorité, et le plan la sert. Ici, dans <b>Empire</b>, déplie les niveaux d'une planète — ou les recherches — et écris le niveau que tu vises dans le petit champ <b>→</b>, à droite du niveau actuel. Le plan épargnera pour l'atteindre, et le dira sur ses cartes.</p></div>`;
  const nuit = !!S.day.night;
  const dits = new Map((((plan || simulateDay()).sessions[0] || {}).prio || []).map(e => [e.id, e]));
  /* « Passer devant » n'apparaît que sur une ligne qui attend : sur la
     première de sa file, il ne ferait rien, et un bouton qui ne fait rien est
     un bouton qu'on essaie une fois puis qu'on cesse de croire. */
  const li = (pill, what, why, ref, attend) => `<li><span class="pill">${pill}</span><span class="what">${what}</span>${why ? `<span class="why">${esc(why)}</span>` : ''}<span class="actes">${attend ? `<button class="btn sm ghost" data-prio-up="${esc(ref)}" title="Met cette priorité en tête de la file de sa planète. Celle qui épargnait aujourd'hui lui cède la place et passe derrière.">En tête</button>` : ''}<button class="btn sm ghost" data-prio-del="${esc(ref)}">Retirer</button></span></li>`;
  const attendSonTour = (kind, pid, k) => ((prioOrdre(kind, pid, k) || {}).i || 0) > 0;
  const lignes = l.map(x => {
    const p = planetById(x.pid), d = dits.get(`${x.kind}:${x.pid}:${x.k}`) || {};
    const nom = x.kind === 'b' ? B_SHORT[x.k] : T[x.k].n;
    const etat = nuit ? '' : [d.etat, d.recoit ? 'Les rapatriements de l\'empire vont vers elle.' : ''].filter(Boolean).join(' ');
    return li(x.kind === 'b' ? esc(p.name) : 'Recherche', `${esc(nom)} ${x.lvl}${prioSuite(x.kind, x.pid, x.k, x.lvl)}${prioRangHtml(x.kind, x.pid, x.k)}`, etat, x.kind === 'b' ? prioRef('b', x.pid, x.k) : prioRef('t', x.k), attendSonTour(x.kind, x.pid, x.k));
  }).concat(lf.map(x => {
    const p = planetById(x.pid), v = (p.lf || {})[x.k] || {};
    const nom = v.nom || v.name || LF_NAMES[x.k] || `Forme de vie ${x.k}`;
    return li(esc(p.name), `${esc(nom)} ${x.lvl}${prioSuite('lf', x.pid, x.k, x.lvl)}${prioRangHtml('lf', x.pid, x.k)}`, prioLfEtat(p, x, nuit), prioRef('lf', x.pid, x.k), attendSonTour('lf', x.pid, x.k));
  }), at.map(d => {
    /* nom est du texte lu dans le DOM du jeu : il passe par esc, comme tout ce qui vient de là. */
    const quoi = d.lvl === 0 ? 'Retrait demandé' : `Niveau ${d.lvl} demandé`;
    return li('En attente', esc(d.nom || `Case ${d.tech}`), `${quoi}, mais aucune de tes planètes relevées ne porte cette case. Si c'est une colonie jamais parcourue, ouvre-la dans le jeu : la demande sera placée alors. Si c'est une lune, le panneau n'en gère pas : la demande n'aboutira pas. Sinon elle s'efface dans ${dur((d.at + PRIO_ATTENTE - Date.now())/1000)}.`, prioRef('ask', d.gid, d.tech));
  }), loin.map(e => {
    const nom = e.kind === 'b' ? (B_SHORT[e.k] || e.k) : e.kind === 'lf' ? (LF_NAMES[e.k] || `Forme de vie ${e.k}`) : ((T[e.k] || {}).n || e.k);
    return li('Autre poste', `${esc(String(nom))} ${e.lvl}`, `Posée sur ton autre ordinateur, sur une planète que celui-ci n'a pas encore relevée. Ouvre-la dans le jeu : elle rejoindra la liste et le plan la servira.`, prioRef('gid', e.gid, e.k));
  }));
  return `<div class="card"><h2>Tes priorités</h2><ul class="advice prios">${lignes.join('')}</ul></div>`;
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
/* ---------- game formulas ---------- */
/* Le copilote n'ouvre que des pages du jeu : il ne remplit aucun formulaire,
   ne clique sur rien et ne lance rien à ta place. Un lien, pas un robot. */
const GO_KIND = {t:'research', ship:'shipyard', shipbuild:'shipyard', sats:'shipyard', def:'defenses',
  transfer:'fleetdispatch', fleet:'fleetdispatch', expo:'fleetdispatch', raid:'galaxy'};
const GO_MISSION = {lfb:'lfbuildings', lfr:'lfresearch', artefacts:'lfresearch',
  discovery:'galaxy', raid:'galaxy', inactive:'galaxy', 'raid-go':'galaxy', 'colo-taken':'galaxy',
  expomax:'research', expocargo:'shipyard', fleetslots:'movement', 'colo-fly':'movement', 'colo-eval':'overview', night:'fleetdispatch', defseen:'defenses', chantierlu:'shipyard'};
/* Les bâtiments se répartissent sur deux pages ; les hangars sont côté Ressources. */
const GO_FACILITIES = new Set(['robot','shipyard','lab','nanite']);

/** URL d'une page du jeu sur une planète, ou null tant que le serveur est inconnu. */
function goUrl(comp, pi){
  if(!S.host || !comp) return null;
  const gid = (S.planets[pi] || {}).gid;
  return `https://${S.host}/game/index.php?page=ingame&component=${comp}${gid ? `&cp=${gid}` : ''}`;
}
/** URL où se fait une action du plan, ou null. */
const SHIP_ID = Object.fromEntries(Object.entries(OG_SHIPS).map(([id,k])=>[k,id]));
/* Le jeu remplit lui-même son formulaire de flotte quand on arrive par un lien
   qui porte les paramètres — c'est ce que fait sa propre page Galaxie quand on
   clique l'icône d'attaque. L'extension n'écrit donc rien dans la page : elle
   ouvre un lien, le jeu fait le reste. Sans destination ni mission, rien à
   préparer, on retombe sur la page nue. */
function fleetUrl(a){
  const c = a && a.dest ? parseC(a.dest) : null;
  if(!S.host || !c || !a.mission) return null;
  const gid = (S.planets[a.p] || {}).gid;
  const q = ['page=ingame', 'component=fleetdispatch'];
  if(gid) q.push('cp='+gid);
  q.push('galaxy='+c[0], 'system='+c[1], 'position='+c[2], 'type=1', 'mission='+a.mission);
  for(const [k,n] of Object.entries(a.ships||{})) if(n>0 && SHIP_ID[k]) q.push('am'+SHIP_ID[k]+'='+n);
  return `https://${S.host}/game/index.php?${q.join('&')}`;
}
function actGo(a){
  if(!a) return null;
  const prep = fleetUrl(a); if(prep) return prep;
  if(a.kind === 'b') return goUrl(GO_FACILITIES.has(a.k) ? 'facilities' : 'supplies', a.p);
  if(a.kind === 'lf') return goUrl(lfQueue(a.id) === 'lfresearch' ? 'lfresearch' : 'lfbuildings', a.p);
  // une recherche se lance depuis la planète qui porte le laboratoire
  const pi = a.kind === 't' ? S.planets.indexOf(labPlanet()) : a.p;
  return goUrl(GO_KIND[a.kind], pi);
}
/** URL où se fait une mission du jour, ou null. */
function missionGo(m){
  if(!m) return null;
  const tag = (m.tags || [])[0];
  const prep = fleetUrl(m); if(prep) return prep;
  const url = goUrl(GO_MISSION[m.id], tag ? S.planets.findIndex(p=>planetRef(p) === tag) : centreOrHub());
  /* La page Galaxie accepte les mêmes paramètres que la page de flotte. Une
     carte qui nomme des coordonnées peut donc y mener directement, au lieu de
     déposer le joueur sur son propre système et de le laisser naviguer. Sans
     coordonnées, rien n'est ajouté : on n'invente pas une destination. */
  const c = m.coords ? parseC(m.coords) : null;
  return url && c && GO_MISSION[m.id] === 'galaxy' ? `${url}&galaxy=${c[0]}&system=${c[1]}` : url;
}
/** URL de la page Galaxie ouverte sur un système, ou null. */
function galaxyUrl(coords){
  const c = parseC(coords), url = goUrl('galaxy', centreOrHub());
  return url && c ? `${url}&galaxy=${c[0]}&system=${c[1]}` : null;
}
/* Une carte qui nomme plusieurs systèmes n'en ouvrait qu'un : le clic sur le
   corps mène au premier, et les autres coordonnées n'étaient que du texte à
   retaper. Chacune porte donc son propre lien. Serveur inconnu : la
   coordonnée reste du texte, échappé comme avant. */
function coordLink(coords){
  const url = galaxyUrl(coords);
  return url ? `<span class="go" data-go="${esc(url)}" title="Ouvrir la galaxie ${esc(coords)}">${esc(coords)}</span>` : esc(coords);
}
/** Le niveau d'Ordinateur qui ajouterait un emplacement de flotte. */
function leverFlotte(){ return `Technologie Ordinateur ${S.tech.computer+1} ajoute un emplacement de flotte.`; }
/** Attribut de lien pour une carte, vide quand on ne sait pas où l'envoyer. */
function goAttr(url){ return url ? ` data-go="${esc(url)}"` : ''; }
/* OGame n'accepte de paramètres d'URL que sur la page de flotte — c'est ce dont
   sa propre page Galaxie a besoin. Il n'existe aucun équivalent pour « monte
   Métal 21 » : le lien d'un bâtiment, d'une recherche, d'une case de forme de
   vie ou d'un chantier ouvre la bonne page, et s'arrête là. Le dire est la
   seule chose à faire ; se taire laisse attendre un formulaire rempli qui ne
   viendra jamais.

   Et il ouvre la bonne planète seulement quand l'URL porte `cp=`. Une planète
   que le jeu ne nous a pas encore nommée n'a pas d'identifiant à y mettre : le
   lien tombe alors sur celle que le jeu avait en tête. Promettre « la bonne
   planète » dans ce cas enverrait construire ailleurs un joueur qui en a
   plusieurs — le mensonge exact que cette note est censée supprimer. */
/**
 * Why a card's link cannot carry the action itself, when it cannot.
 * @param {object} a planned action
 * @returns {string} the note, empty when the game fills its own form or when
 *   there is no link at all
 */
function goNote(a){
  const url = a && !fleetUrl(a) && actGo(a);
  if(!url) return '';
  return /[?&]cp=/.test(url)
    ? 'Le lien ouvre la page sur la bonne planète : OGame ne permet pas de pré-remplir cette action.'
    : 'Le lien ouvre la page : OGame ne permet pas de pré-remplir cette action, ni de choisir la planète tant que le jeu ne l\'a pas nommée.';
}
/* Identifiants de tuile du jeu, dans l'autre sens : le plan raisonne en clés
   (« metal »), la page du jeu en numéros (« 1 »). */
const BUILD_ID = Object.fromEntries(Object.entries(OG_BUILD).map(([id,k])=>[k,id]));
const TECH_ID = Object.fromEntries(Object.entries(OG_TECH).map(([id,k])=>[k,id]));

/**
 * Traduit les actions du plan en indices à surligner dans la page du jeu.
 * Rangés par planète du jeu, puis par identifiant de tuile, la valeur étant
 * le niveau visé — la page du jeu décide comment l'écrire. Une action sans
 * tuile — une expédition, un rapatriement — n'en produit aucun, et une
 * planète que le jeu ne nous a pas encore nommée non plus : surligner au
 * hasard serait pire que ne rien surligner.
 * @param {object[]} acts actions de la session en cours
 * @returns {object} { [planetId]: { [technologyId]: niveau visé } }
 */
function planHints(acts){
  const out = {};
  const put = (p, tech, lvl)=>{
    const gid = p && p.gid;
    if(!gid || !tech || !lvl) return;
    (out[gid] = out[gid] || {})[tech] = lvl;
  };
  for(const a of acts || []){
    const p = S.planets[a.p];
    if(a.kind === 'b') put(p, BUILD_ID[a.k], a.lvl);
    else if(a.kind === 't') put(p, TECH_ID[a.k], a.lvl);
    else if(a.kind === 'lf') put(p, a.id, a.lvl);
  }
  return out;
}
/**
 * Ce que le joueur a posé, rangé comme `planHints` : { [planète du jeu]: { [tuile]: niveau visé } }.
 * Ce canal existe à côté de `hints` et ne s'y réduit pas : `hints` vient des
 * actions de la session en cours, or une priorité qui épargne sans être encore
 * payable tombe dans les attentes, pas dans les actions — la pastille
 * disparaîtrait et le joueur ne verrait rien de ce qu'il a déclaré. Fusionner
 * les deux ferait de nouveau dépendre la déclaration du plan.
 * Une recherche se montre sur la planète du labo, où l'épargne se fait ; sa
 * priorité porte déjà ce pid (voir prios()).
 * @returns {object} { [planetId]: { [tuileId]: niveau visé } }
 */
function prioHints(){
  const out = {};
  const put = (pid, tuile, lvl) => {
    const p = planetById(pid);
    // même garde que tourData : sert de clé d'objet, « __proto__ » n'est jamais une planète du jeu
    // le saut est voulu : une clé sans tuile du jeu ne doit jamais publier un identifiant bancal
    if(!p || !tuile || !/^\d+$/.test(String(p.gid || ''))) return;
    const l = out[p.gid] = out[p.gid] || {};
    // la première posée gagne : c'est celle que le plan sert, la pastille doit montrer la même
    if(!(tuile in l)) l[tuile] = lvl;
  };
  for(const e of prios()) put(e.pid, e.kind === 'b' ? BUILD_ID[e.k] : TECH_ID[e.k], e.lvl);
  for(const e of priosLf()) put(e.pid, e.k, e.lvl);
  return out;
}
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
/* Le centre d'abord : une recherche se lance depuis une planète, et c'est son
   labo à elle qui en fixe la durée et les prérequis. Sans centre — joueur de
   flotte, planète unique — on retombe sur le plus haut labo de l'empire,
   c'est-à-dire sur le comportement d'avant. */
/** La planète de recherche habituelle : celle d'où la dernière recherche est
    partie, sinon le centre. C'est à elle que « recherche à l'arrêt » se rattache. */
function planeteRecherche(){ return planetById(S.rechPid) || labPlanet(); }
function labPlanet(){ return centrePlanet() || S.planets.reduce((a,p)=>(!a || p.b.lab>a.b.lab) ? p : a, null); }
/* Le labo du centre, et non plus le maximum de l'empire : les deux
   coïncidaient tant que le centre était par construction la planète du plus
   haut labo, et ils divergent dès que le joueur reprend la main. Annoncer le
   maximum ferait promettre une durée que le jeu ne tiendra pas, et lancer une
   recherche depuis un labo trop petit. */
function labLevel(){ const p = labPlanet(); return p ? (p.b.lab || 0) : 0; }
/**
 * Le niveau de labo qui décide de la VITESSE d'une recherche, Réseau compris.
 * Le Réseau de recherche intergalactique relie les N meilleurs labos des autres
 * planètes à celui d'où part la recherche, N étant son niveau : la durée se
 * calcule sur la somme. Page officielle de Gameforge : « Effective Lab Level =
 * Main Lab Level + Sum of N highest Colony Lab Levels (N = IRN Level) », avec
 * l'exemple 15 + 4×12 = 63.
 *
 * Il ne faut pas confondre avec `labLevel()`, qui décide de ce qui est
 * DÉBLOQUÉ : un prérequis est une propriété de la planète, et le Réseau n'aide
 * jamais à le remplir. Les deux questions passaient par la même fonction, donc
 * les labos des autres planètes ne servaient à rien.
 *
 * ponytail: aucune source lisible ne donne de niveau minimum pour qu'un labo
 * compte, ni le sort des lunes (le wiki fandom répond 402) ; on somme les N
 * plus hauts tels quels. À reprendre si le jeu dit autre chose.
 * Lit `S.planets`, donc marche aussi sur l'empire simulé que `simulateDay`
 * met à la place : ses copies portent `b`, le seul champ touché ici.
 * @returns {number} niveau de labo effectif
 */
function labEffectif(){
  const p = labPlanet(); if(!p) return 0;
  const mien = p.b.lab || 0;
  const n = Math.max(0, Math.trunc(+S.tech.irn) || 0);
  if(!n) return mien;
  const autres = S.planets.filter(x => x !== p).map(x => x.b.lab || 0).sort((a,b) => b-a);
  return mien + autres.slice(0, n).reduce((a,b) => a+b, 0);
}
/** Research time in seconds. */
function researchTime(key, L){
  const c = levelCost(T[key], L);
  let h = (c[0]+c[1]) / (1000 * (1+labEffectif()) * ecoSpeed() * researchDiv());
  if(S.settings.cls==='explorer') h *= .75;
  return Math.max(1, h*3600);
}
/**
 * Lit le texte du panneau « Paramétrage de la production » publié par content.js.
 * Le texte vient de la page : tout nombre qui pourrait borner une boucle ou
 * dimensionner quoi que ce soit est borné ici (comptes à 1e6, niveaux à 999).
 * @param {string} text texte brut du panneau, une ligne par rangée, cellules séparées par des tabulations
 * @returns {object|null} la forme de S.prod[gid] (sans `at`), ou null si « Total par heure » est absent
 */
function parseProdPanel(text){
  if(typeof text !== 'string' || text.length > 20000) return null;
  const clamp = (n, hi) => Math.max(0, Math.min(hi, n));
  // « 37.297 » → 37297, « -1.554 » → -1554 ; « 2M » (troncature du jeu) et tout le reste → null
  const num = c => /^-?\d{1,3}(\.\d{3})*$|^-?\d{1,12}$/.test(c || '') ? +c.replace(/\./g, '') : null;
  const out = {at:0, factor:1, base:[0,0,0], lfBonus:[0,0,0,0], caps:[null,null,null], crawlerMax:0, energy:null, rows:[]};
  const fm = text.match(/Facteur de production\s*:\s*(\d{1,4})\s*%/i);
  if(fm) out.factor = clamp(+fm[1] / 100, 10);
  for(const line of text.split('\n').slice(0, 200)){
    const cells = line.split(/\t|\s{2,}/).map(c => c.trim()).filter(Boolean);
    if(cells.length < 2) continue;
    const label = cells[0], v = cells.slice(1, 5).map(num);
    if(/^Total par heure/i.test(label)){
      const em = (cells[4] || '').match(/^(-?[\d.]+)\/([\d.]+)$/);
      if(em) out.energy = {free:num(em[1]), prod:num(em[2])};
      // Ce que le jeu annonce vraiment par heure : la mesure contre laquelle le moteur se cale.
      out.perHour = v.slice(0, 3);
      out.total = true;
    }else if(/^Revenu de base/i.test(label)) out.base = v.slice(0, 3).map(x => x || 0);
    else if(/^Bonus technologique/i.test(label)) out.lfBonus = v.map(x => x || 0);
    else if(/^Capacit/i.test(label)) out.caps = v.slice(0, 3);
    else{
      const lv = label.match(/\(Niveau\s*(\d{1,4})\)/i), nb = label.match(/\(Nombre\s*:\s*(\d{1,9})(?:\s*\/\s*(\d{1,9}))?\)/i);
      const pct = (cells[5] || '').match(/^(\d{1,4})\s*%$/);
      const max = nb && nb[2] != null ? clamp(+nb[2], 1e6) : null;
      if(/^Foreuse/i.test(label) && max != null) out.crawlerMax = max;
      out.rows.push({label, lvl: lv ? clamp(+lv[1], 999) : null, n: nb ? clamp(+nb[1], 1e6) : null, max,
        v: v.map(x => x == null ? 0 : x), pct: pct ? clamp(+pct[1], 1000) : null});
    }
  }
  if(!out.total || !out.energy) return null;
  delete out.total;
  return out;
}

/**
 * Relevé du panneau de production d'une planète, clé stricte sur son gid.
 * @param {object} p planète de S.planets
 * @returns {object|undefined} undefined si cette planète n'a jamais ouvert le panneau
 */
function prodOf(p){
  const k = p && p.gid;
  return k && S.prod && Object.prototype.hasOwnProperty.call(S.prod, k) ? S.prod[k] : undefined;
}


/**
 * Bonus de forme de vie lu dans le panneau de production, tel que le jeu l'affiche :
 * un montant horaire fixe [m, c, d, énergie]. Rien si la lecture manque ou a plus
 * de sept jours ; chaque valeur est ramenée à un nombre fini et positif.
 * @param {object} p planète de S.planets
 * @returns {number[]|null}
 */
function lfBonusOf(p){
  const r = prodOf(p);
  if(!r || !Array.isArray(r.lfBonus) || !(Date.now() - r.at < LF_READ_TTL)) return null;
  return [0,1,2,3].map(i => { const v = Number(r.lfBonus[i]); return Number.isFinite(v) ? Math.min(Math.max(v, 0), 1e9) : 0; });
}

/**
 * Mines bridées à la main dans le jeu, d'après le dernier relevé du panneau de
 * production : le pourcentage le plus bas, et l'énergie qu'il faudrait en plus
 * pour les remettre toutes à 100 %. Cette énergie est l'écart entre la
 * consommation pleine d'une mine (10 ou 20 × N × 1,1^N) et celle que sa ligne
 * affiche, bridage compris.
 * @param {object} p planète de S.planets
 * @returns {{min:number, extra:number}|null} null sans relevé récent ou si rien n'est bridé
 *
 * ponytail: le bridage sert à avertir, pas à chiffrer : production() compte
 * toujours les mines à 100 %, donc les débits annoncés sont optimistes tant
 * qu'elles sont bridées. À brancher sur production() si le bridage dure.
 */
function bridage(p){
  const r = prodOf(p);
  if(!r || !(Date.now() - r.at < LF_READ_TTL)) return null;
  let min = 100, extra = 0;
  for(const row of r.rows || []){
    const coef = (MINES_PCT.find(x => x[0].test(row.label)) || [])[1];
    const e = Number((row.v || [])[3]);
    // e est la consommation affichée, négative ; une ligne sans colonne énergie
    // lisible ne dit rien du bridage et ne compte pas.
    if(coef == null || row.lvl == null || !(row.pct < 100) || !Number.isFinite(e) || e > 0) continue;
    min = Math.min(min, row.pct);
    extra += Math.max(0, Math.ceil(coef*row.lvl*Math.pow(1.1, row.lvl)) + e);
  }
  return min < 100 ? {min, extra} : null;
}

/** Hourly production and energy balance for a planet, with optional level overrides. */
function production(p, ov){
  const b = Object.assign({}, p.b, ov||{}), s=S.settings, e=ecoSpeed(), t=S.tech;
  const g = L => L*Math.pow(1.1,L);
  /* Une foreuse produit et consomme comme une mine : elle entre dans le même
     bilan, sinon son bonus serait gratuit et le classement la mettrait en tête
     pour de mauvaises raisons. */
  const nCraw = Math.min(Math.max(0, (ov && ov.crawlers != null) ? ov.crawlers : (p.crawlers||0)),
                         crawlerMax(b.metal, b.crystal, b.deut));
  const surcharge = p.overload != null ? p.overload : !!s.crawlerOverload;
  const craw = crawlerBonus(nCraw, s.cls, surcharge);
  let eProd = Math.floor(20*g(b.solar)) + Math.floor(30*b.fusion*Math.pow(1.05+0.01*t.energy, b.fusion)) + p.sats*satEnergy(p.tmax);
  let eBonus = 1 + (s.cls==='collector'?.1:0) + (s.eng?.1:0);
  eProd = Math.floor(eProd*eBonus) + (p.eAdj||0);
  const lf = lfBonusOf(p) || [0,0,0,0];
  eProd += Math.floor(lf[3]);
  const eCons = Math.ceil(10*g(b.metal)) + Math.ceil(10*g(b.crystal)) + Math.ceil(20*g(b.deut)) + nCraw*CRAWLER_ENERGY*(surcharge?2:1);
  const factor = eCons===0 ? 1 : Math.max(0, Math.min(1, eProd/eCons));
  const common = (s.cls==='collector'?.25:0) + (s.geo?.1:0) + craw;
  const pos = (parseC(p.coords)||[])[2]||0, posM = POS_BONUS_M[pos]||0, posC = POS_BONUS_C[pos]||0;
  /* L'écart que le jeu a mesuré et que la formule n'explique pas : bridage
     d'une mine à la main, bonus d'officier, tout ce qui ne se lit pas dans les
     niveaux. Additif, donc il survit à une montée simulée — c'est ce qui permet
     de comparer deux montées entre elles sans que la calibration les fausse. */
  const adj = Array.isArray(p.pAdj) ? p.pAdj : [0,0,0];
  const m = 30*e + 30*g(b.metal)*e*factor*(1 + .01*t.plasma + common + posM) + lf[0] + (+adj[0]||0);
  const c = 15*e + 20*g(b.crystal)*e*factor*(1 + .0066*t.plasma + common + posC) + lf[1] + (+adj[1]||0);
  const dRaw = 10*g(b.deut)*(1.44 - .004*p.tmax)*e*factor*(1 + .0033*t.plasma + common);
  const dFus = 10*g(b.fusion)*e;
  return {m, c, d:dRaw - dFus + lf[2] + (+adj[2]||0), eProd, eCons, eBal:eProd-eCons, factor,
          cap:[storageCap(b.smetal), storageCap(b.scrystal), storageCap(b.sdeut)]};
}
function mse(m,c,d){ const r=S.settings.ratio; return m + c*r[0]/r[1] + d*r[0]/r[2]; }

/* ---------- ce qui manque à l'empire ---------- */
const NOM_RES = ['métal', 'cristal', 'deutérium'];
/* ---------- les stocks et l'attente ---------- */
function stockNow(p){
  const pr = production(p), h = (Date.now()-p.stock.at)/36e5;
  return [Math.min(Math.max(p.stock.m, pr.cap[0]), p.stock.m + pr.m*h),
          Math.min(Math.max(p.stock.c, pr.cap[1]), p.stock.c + pr.c*h),
          Math.min(Math.max(p.stock.d, pr.cap[2]), p.stock.d + pr.d*h)];
}
/**
 * Délai avant que `cost` soit payable sur la planète p.
 * Un coût plus grand qu'un hangar n'est pas impossible : la production locale
 * s'y arrête, pas une livraison. `small` nomme alors les deux sorties — le
 * niveau de hangar qui logerait le montant, ou un transport calé juste avant.
 * @returns {{sec:number, storage?:number, small?:object[]}}
 */
function waitFor(p, cost){
  const st = stockNow(p), pr = production(p), rates=[pr.m,pr.c,pr.d], sk=['smetal','scrystal','sdeut'];
  let w = 0; const small = [];
  for(let i=0;i<3;i++){
    if(cost[i] > pr.cap[i]) small.push({res:i, k:sk[i], lvl:storageLevelFor(cost[i])});
    const miss = cost[i]-st[i];
    if(miss>0) w = Math.max(w, rates[i]>0 ? miss/rates[i]*3600 : Infinity);
  }
  return small.length ? {sec:Infinity, storage:small[0].res, small} : {sec:w};
}
/** Les hangars à atteindre, nommés : « Hangar C 5 ». */
function storageShort(w){ return (w.small||[]).map(x=>`${B_SHORT[x.k]} ${x.lvl}`).join(' et '); }
/** La phrase complète, avec l'autre sortie. */
function storageNote(w){
  const l = storageShort(w);
  return l ? `Hangar trop petit : ${l}, ou fais arriver le transport juste avant de lancer — une livraison n'est pas plafonnée.`
           : 'Hangar trop petit pour ce coût.';
}
function reqOk(req, p){
  const miss=[];
  if(!req) return miss;
  if(req.lab && labLevel()<req.lab) miss.push(`Labo ${req.lab}`);
  if(req.b) for(const [k,v] of Object.entries(req.b)) if(!p || p.b[k]<v) miss.push(`${B_SHORT[k]} ${v}`);
  if(req.t) for(const [k,v] of Object.entries(req.t)) if(S.tech[k]<v) miss.push(`${T[k].n.replace('Technologie ','')} ${v}`);
  return miss;
}

/** Le libellé d'une option du classement : une mine a un niveau, les foreuses un nombre. */
function upLabel(u){ return u.key==='crawl' ? `${u.n} foreuse${u.n>1?'s':''} (${u.lvl} en tout)` : `${B_SHORT[u.key]} ${u.lvl}`; }
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
/* ---------- les règles du moteur : stockage ---------- */
/* Au plafond, la production s'arrête. Ce qui la relance, dans l'ordre :
   dépenser sur place ce que le plan juge déjà utile, sinon envoyer l'excédent
   là où il manque, sinon — et seulement si le débordement revient — monter le
   hangar (solutionsSurplus). Baisser la production n'est jamais une réponse :
   c'est la perte même qu'on cherche à éviter. */
EVAL.storageRatio = (p, prm) => {
  const pr = production(p), st = stockNow(p), out = [];
  for(let k = 0; k < 3; k++){
    if(!(st[k] >= pr.cap[k] * prm.seuil)) continue;
    const [name, bk] = HANGARS[k], sol = solutionsSurplus(p, k, null)[0] || null;
    out.push({valeur:k, cost:sol && sol.cost ? sol.cost : null,
      repond:sol && sol.type === 'hangar' ? {kinds:['b'], ks:[bk]} : {kinds:['b']},
      vars:Object.assign(surplusVars(p, k, st, pr), {hangar:name, niveau:p.b[bk], montee:dur(buildTime(bk, p.b[bk] + 1, p)),
        quoi:sol ? sol.what : 'Un transport', depense:solutionPhrase(sol, k)})});
  }
  return out;
};
/* Le plafond qui approche : par la production, avec un délai qui couvre au
   moins `heures` ; ou par une livraison — un retour d'expédition ne se
   détourne pas, et il peut remplir le hangar d'un coup. Les livraisons
   comptent sur 24 h : la plus lointaine est celle qu'on peut encore préparer. */
EVAL.storageEta = (p, prm) => {
  const pr = production(p), st = stockNow(p), rates = [pr.m, pr.c, pr.d], out = [];
  const plein = regleParam('RES_STORAGE_FULL', 'seuil', .98), now = Date.now();
  const livs = livraisons(p).filter(l => l.at > now && l.at <= now + 24 * 3600e3);
  for(let k = 0; k < 3; k++){
    if(st[k] >= pr.cap[k] * plein) continue;
    const [name, bk] = HANGARS[k], mont = buildTime(bk, p.b[bk] + 1, p);
    let dans = rates[k] > 0 ? (pr.cap[k] - st[k]) / rates[k] * 3600 : Infinity, cause = '';
    if(!(dans < Math.max(prm.heures, mont / 3600) * 3600)) dans = Infinity;
    const l = livs.find(x => x.cargo[k] > 0 && projectResources(p, x.at)[k] >= pr.cap[k] * plein);
    if(l && (l.at - now) / 1000 < dans){
      dans = (l.at - now) / 1000;
      const v = l.mv || {}, de = (v.sens === 'retour' ? v.cible : v.origine) || {};
      cause = (v.mission === 15 ? `Retour d'expédition à ${formatTime(l.at)}` : `Convoi ${de.nom || de.coords || ''} à ${formatTime(l.at)}`.replace('  ', ' '))
        + ` : +${fmt(l.cargo[k])} ${NOM_RES[k]}. `;
    }
    if(!isFinite(dans)) continue;
    const sol = solutionsSurplus(p, k, null)[0] || null;
    out.push({valeur:k, cost:sol && sol.cost ? sol.cost : null,
      repond:sol && sol.type === 'hangar' ? {kinds:['b'], ks:[bk]} : null,
      vars:Object.assign(surplusVars(p, k, st, pr), {hangar:name, niveau:p.b[bk], dans:dur(dans), montee:dur(mont), cause,
        quoi:sol ? sol.what : 'Un transport', depense:solutionPhrase(sol, k), secs:dans})});
  }
  return out;
};

/* ---------- ressources en trop ---------- */
/**
 * Ce qu'un plafond coûte : la production horaire arrêtée, et sa valeur en
 * métal au ratio du joueur — c'est elle qui classe les débordements entre eux,
 * un cristal arrêté valant plus qu'autant de métal.
 * @returns {{res:number, eqM:number}}
 */
function pertesParHeure(p, k, pr){
  pr = pr || production(p);
  const r = Math.max(0, [pr.m, pr.c, pr.d][k] || 0), ratio = S.settings.ratio || [3, 2, 1];
  return {res:r, eqM:r * ratio[0] / ratio[k]};
}
/** Les variables communes aux deux règles de hangar. */
function surplusVars(p, k, st, pr){
  const l = pertesParHeure(p, k, pr), e = st[k] - pr.cap[k];
  return {ressource:NOM_RES[k], Ressource:majus(NOM_RES[k]), pertes:`${fmtK(l.res)} ${NOM_RES[k]}/h`,
    excedent:e > 0 ? `${fmt(e)} au-dessus de la capacité (${fmt(pr.cap[k])})` : `${Math.floor(st[k] / pr.cap[k] * 100)} % de la capacité (${fmt(pr.cap[k])})`};
}
/** La première solution en une phrase, pour le texte de la règle. */
function solutionPhrase(s, k){
  if(!s) return `Rien d'utile n'est finançable ici avec le ${NOM_RES[k]} : envoie-le là où il manque.`;
  if(s.type === 'depense') return `${s.what} : ${fmt(s.cost[k])} de ${NOM_RES[k]} d'un coup, pour une dépense utile — pas un achat pour vider.`;
  if(s.type === 'transfert') return `Envoie ${fmt(s.charge[k])} de ${NOM_RES[k]} à ${s.dest.name} : ${s.pour}.`;
  return `${s.what} : ${s.pourquoi}.`;
}

/* L'historique des débordements, propre au poste (chrome.storage.local, hors
   de S et de la synchro). Une entrée par débordement : planète, ressource,
   début, fin — fin vide tant qu'il dure. Sept jours glissants : c'est ce qui
   dit si le hangar est trop petit pour de bon, ou si une livraison ponctuelle
   l'a rempli une fois. `var` : un rendu peut passer avant cette ligne. */
var SURPLUS_GARDE_MS = 7 * 864e5;
var SURPLUS_REGLES = ['RES_STORAGE_FULL', 'RES_STORAGE_SOON'];
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
function surplusNote(now){
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
function surplusCompte(pid, k, now){
  now = now == null ? Date.now() : now;
  return SURPLUS_LOG.filter(e => e.pid === pid && e.k === k && (e.f == null ? now : e.f) >= now - SURPLUS_GARDE_MS).length;
}

/**
 * Ce que le plan met de côté sur `p` au début de la journée : la même règle
 * que `reserveOf` dans simulateDay — le coût d'un objectif, moins ce que la
 * production y apporte d'ici son échéance.
 */
function reservePlan(plan, p){
  const s0 = plan && plan.sessions && plan.sessions[0], out = [0, 0, 0], pi = S.planets.indexOf(p);
  if(!s0 || pi < 0) return out;
  const pr = production(p), r = [pr.m, pr.c, pr.d];
  for(const g of s0.goals || []){
    if(g.p !== pi || !g.cost) continue;
    const h = Math.max(0, (g.deadline - s0.T) / 3600e3);
    g.cost.forEach((x, j) => { out[j] += Math.max(0, x - r[j] * h); });
  }
  return out;
}
/**
 * Ce qui, sur `p`, est déjà utile au plan : ses chantiers, cases de forme de
 * vie, vaisseaux et défenses, qu'ils partent aujourd'hui ou attendent ; les
 * recherches du plan quand cette planète peut les payer (son labo est le
 * centre, ou RECH_FUND_ELSEWHERE la laisse payer) ; les pièces que le modèle
 * de défense réclame. Sans plan — une règle se lit avant lui — les mines,
 * centrales, cases de forme de vie et recherches payables ici.
 * Jamais un achat « pour vider » : les puits de PUITS n'y sont pas.
 * @returns {{kind:string, what:string, cost:number[], depuis?:boolean}[]}
 */
function utilesSurPlace(p, plan, dispo, k){
  const out = [], pi = S.planets.indexOf(p), lab = labPlanet(), rech = rechercheEnCours();
  const ici = lab && lab.id === p.id, ailleurs = !ici && regleActive('RECH_FUND_ELSEWHERE');
  const rechOk = t => !rech && T[t] && (ici || (ailleurs && labOkPour(t, p)));
  if(plan){
    for(const x of plan.sessions || []) for(const a of (x.acts || []).concat(x.waits || [])){
      if(!a || !Array.isArray(a.cost)) continue;
      if(a.kind === 't'){ if(rechOk(a.k)) out.push({kind:'t', what:a.what, cost:a.cost, depuis:!ici}); }
      else if(a.p === pi && ['b', 'lf', 'def', 'shipbuild'].includes(a.kind)) out.push({kind:a.kind, what:a.what, cost:a.cost});
    }
  } else {
    for(const d of depensesPayables(p, k, dispo)) if(!d.puits && d.kind !== 't') out.push(d);
    if(!rech) for(const t of (nextResearch().list || []).slice(0, 3)) if(rechOk(t.k)) out.push({kind:'t', what:`${T[t.k].n} ${t.lvl}`, cost:levelCost(T[t.k], t.lvl), depuis:!ici});
  }
  /* Un lot de défense du modèle : autant de pièces que le stock libre en
     paie, jamais plus que ce qui manque au palier. Page Défense jamais lue :
     rien, on doublerait ce qui existe. */
  const props = defsOf(p) ? defPropositions(p) : null;
  for(const l of (props && props.ordre) || []){
    const u = DEF[l.k].c, n = Math.min(l.manque, ...u.map((x, j) => x > 0 ? Math.floor(Math.max(0, dispo[j]) / x) : Infinity));
    if(n >= 1 && !refused(cardKey('def', p.id, l.k))) out.push({kind:'def', what:`Construire ${shipList({[l.k]:n})}`, cost:u.map(x => x * n)});
  }
  return out;
}
/**
 * La dépense utile qui vide le plus la ressource en trop, payable maintenant
 * sur `p` après les réserves du plan. Le choix se fait sur la part de la
 * ressource dans le prix (au ratio du joueur) : on veut vider le cristal, pas
 * le métal qui manque peut-être ailleurs.
 */
function depenseSurPlace(p, k, plan){
  const st = stockNow(p), res = reservePlan(plan, p), dispo = st.map((x, j) => x - res[j]), ratio = S.settings.ratio || [3, 2, 1];
  const part = c => c[k] * ratio[0] / ratio[k] / Math.max(1e-9, mse(...c));
  const vus = new Set(), cands = [];
  for(const c of utilesSurPlace(p, plan, dispo, k)){
    if(vus.has(c.what) || !(c.cost[k] > 0) || !c.cost.every((x, j) => x <= dispo[j] + 1e-6)) continue;
    vus.add(c.what); cands.push(c);
  }
  /* La part décide, mais pas seule : 1 000 de cristal dans une sonde, c'est
     du cristal pur et ça ne vide rien quand 2 M dépassent. Une dépense qui
     absorbe au moins un dixième de l'excédent (au-dessus de 90 %) passe
     devant ; sous le plafond, toutes se valent. */
  const exces = Math.max(0, st[k] - 0.9 * production(p).cap[k]), pese = c => c.cost[k] >= 0.1 * exces ? 1 : 0;
  cands.sort((a, b) => pese(b) - pese(a) || part(b.cost) - part(a.cost) || b.cost[k] - a.cost[k]);
  const c = cands[0];
  if(!c) return null;
  const quoi = c.kind === 't' ? `Lancer ${c.what}${c.depuis && S.planets.length > 1 ? ` depuis ${p.name}` : ''}` : c.kind === 'def' || /^Construire /.test(c.what) ? c.what : `Lancer ${c.what}`;
  return {type:'depense', kind:c.kind, what:quoi, cost:c.cost};
}

/** Les transporteurs que `p` peut prêter : ni le kit d'expédition, ni la réserve de GT (expoRes). */
function flotteLibre(p){
  const sh = {lc:(p.ships || {}).lc || 0, sc:(p.ships || {}).sc || 0};
  sh.lc = Math.max(0, sh.lc - expoRes(p));
  const kit = expoFleet(p.ships, p);
  if(kit) for(const k of ['lc', 'sc']) sh[k] = Math.max(0, sh[k] - (kit.ships[k] || 0));
  return sh;
}
/** Les transporteurs libres pour lever `amount`, les grands d'abord. */
function soutePour(libres, amount){
  const ships = {};
  let cargo = 0;
  for(const k of ['lc', 'sc']){
    const u = shipStats(k).cargoEff, n = Math.min(libres[k] || 0, u ? Math.ceil(Math.max(0, amount - cargo) / u) : 0);
    if(n > 0){ ships[k] = n; cargo += n * u; }
  }
  return ships;
}
/** Le moins qu'un transfert vaille : sous ce tonnage, le vol coûte plus d'attention qu'il ne rend. */
var SURPLUS_MIN = 5000;
/**
 * Ce que chaque planète attend de cette ressource : ce qui manque aux
 * éléments du plan qu'elle bloque (« En attente de ressources »), et à ses
 * objectifs. La planète de recherche y est par ses recherches en attente.
 * @returns {Map<number, {besoin:number, pour:string[]}>} par indice de planète
 */
function besoinsDe(plan, k){
  const out = new Map(), s0 = plan && plan.sessions && plan.sessions[0];
  if(!s0) return out;
  const note = (i, x, what) => {
    if(!(x > 0) || !S.planets[i]) return;
    const e = out.get(i) || {besoin:0, pour:[]};
    e.besoin = Math.max(e.besoin, x);
    if(what && !e.pour.includes(what)) e.pour.push(what);
    out.set(i, e);
  };
  for(const w of s0.waits || []) if(w.miss) note(w.p, w.miss[k], w.what);
  for(const g of s0.goals || []) if(g.cost && S.planets[g.p]) note(g.p, g.cost[k] - stockNow(S.planets[g.p])[k], g.label);
  return out;
}
/** Ce qui se pose encore sur `q` après `at` : la place d'aujourd'hui est la place de toute la journée. */
function livreApres(q, at, k){ return livraisons(q).filter(l => l.at > at).reduce((a, l) => a + (l.cargo[k] || 0), 0); }
/**
 * L'excédent de `p` envoyé à une planète qui en manque et qui a la place.
 * La quantité est le plus petit de : ce qui ramène `p` sous 90 %, le besoin
 * de la cible, sa place libre jusqu'à 95 %, la soute des transporteurs libres.
 * Cible : le plus gros besoin, puis la plus proche.
 * @returns {object|null} au format de transportHtml, plus `pour` et `besoin`
 */
function transfertVersBesoin(p, k, plan){
  const pr = production(p), st = stockNow(p), cp = parseC(p.coords), pi = S.planets.indexOf(p);
  const exces = st[k] - 0.9 * pr.cap[k];
  if(!cp || !(exces >= SURPLUS_MIN)) return null;
  const libres = flotteLibre(p);
  if(!libres.lc && !libres.sc) return null;
  const now = Date.now(), cands = [];
  for(const [i, b] of besoinsDe(plan, k)){
    const q = S.planets[i];
    if(i === pi || !q || !parseC(q.coords) || refused(cardKey('transfer', p.id, q.coords))) continue;
    let ships = soutePour(libres, Math.min(exces, b.besoin)), fl = flight(p.coords, q.coords, ships, 100);
    if(!fl) continue;
    const arrivee = now + fl.secs * 1000, cq = production(q).cap[k];
    const place = 0.95 * cq - projectResources(q, arrivee)[k] - livreApres(q, arrivee, k);
    const qte = Math.floor(Math.min(exces, b.besoin, place, fl.cargo, k === 2 ? st[2] - fl.fuel : Infinity));
    if(qte < SURPLUS_MIN) continue;
    /* La flotte retaillée à la quantité : moins de vaisseaux, moins de deutérium. */
    ships = soutePour(libres, qte); fl = flight(p.coords, q.coords, ships, 100) || fl;
    const charge = [0, 0, 0]; charge[k] = Math.min(qte, fl.cargo);
    cands.push({q, b, ships, fl, charge, arrivee:now + fl.secs * 1000, d:distance(cp, parseC(q.coords))});
  }
  cands.sort((a, b) => b.b.besoin - a.b.besoin || a.d - b.d);
  const c = cands[0];
  if(!c) return null;
  const pour = `${c.b.pour.slice(0, 2).join(', ')} y attend${c.b.pour.length > 1 ? 'ent' : ''} ${fmt(c.b.besoin)} de ${NOM_RES[k]}`;
  return {type:'transfert', what:`Transférer ${fmt(c.charge[k])} de ${NOM_RES[k]} vers ${c.q.name}`, p, pi, ships:c.ships, dest:c.q,
    mission:3, missionNom:'Transport', pct:100, depart:now, arrivee:c.arrivee, retour:c.arrivee + c.fl.secs * 1000, fuel:c.fl.fuel,
    charge:c.charge, pour, besoin:c.b.besoin, pourquoi:`${majus(pour)}, et la place pour la recevoir.`, note:'Kit d\'expédition et réserve de GT laissés à quai.', gt:0};
}
/**
 * Le hangar, en dernier recours : seulement si la ressource a débordé au
 * moins `recurrence` fois en sept jours, ou si la prochaine mine coûte plus
 * que le hangar ne contient (RES_MINE_BLOCKED_BY_STORAGE). Un débordement de
 * livraison ponctuelle ne le justifie pas : il coûte cher, met des heures, et
 * ne sert plus une fois le stock redescendu.
 */
function hangarSiJustifie(p, k){
  const pr = production(p), n = surplusCompte(p.id, k), seuil = regleParam('RES_STORAGE_FULL', 'recurrence', 3);
  const best = rankUpgrades(p).filter(u => u.payback < Infinity && B[u.key])[0];
  const bc = best ? (best.extraSolar ? levelCost(B.solar, p.b.solar + 1) : levelCost(B[best.key], best.lvl)) : null;
  const bloque = !!bc && bc[k] > pr.cap[k];
  if(n < seuil && !bloque) return null;
  const [name, bk] = HANGARS[k], lvl = (p.b[bk] || 0) + 1, duree = buildTime(bk, lvl, p);
  return {type:'hangar', what:`${name} ${lvl}`, k:bk, lvl, cost:levelCost(B[bk], lvl), duree,
    pourquoi:bloque ? `${upLabel(best)} coûte plus que la capacité actuelle` : `${n} débordements de ${NOM_RES[k]} en 7 jours`};
}
/**
 * Jusqu'à trois solutions pour une ressource au plafond, dans l'ordre :
 * dépenser sur place, transférer vers un besoin, monter le hangar. Sans plan
 * (une règle se lit avant lui), pas de transfert : les besoins sont ceux du plan.
 */
function solutionsSurplus(p, k, plan){
  const out = [], d = depenseSurPlace(p, k, plan);
  if(d) out.push(d);
  const t = plan ? transfertVersBesoin(p, k, plan) : null;
  if(t) out.push(t);
  const h = hangarSiJustifie(p, k);
  if(h) out.push(h);
  return out.slice(0, 3);
}

/**
 * Les ressources qu'une cargaison ferait passer au-dessus du hangar de `q` à
 * son arrivée : la livraison n'est pas plafonnée, la production si — elle
 * s'arrête tant que le stock reste au-dessus.
 * @returns {number[]} indices de ressource
 */
function debordeA(q, cargo, at){
  if(!q || !q.stock || !cargo) return [];
  const pr = production(q), proj = projectResources(q, at);
  return [0, 1, 2].filter(j => cargo[j] > 0 && proj[j] + cargo[j] > pr.cap[j]);
}
/** « À l'arrivée, Erablis dépassera sa capacité en cristal : la mine s'arrêtera. » */
function debordeTexte(nom, js){
  if(!js || !js.length) return '';
  const mines = js.filter(j => j < 2).length, synth = js.includes(2);
  const sujet = [mines > 1 ? 'les mines' : mines ? 'la mine' : '', synth ? 'le synthétiseur' : ''].filter(Boolean);
  return `À l'arrivée, ${nom} dépassera sa capacité en ${js.map(j => NOM_RES[j]).join(' et ')} : ${sujet.join(' et ')} s'arrêter${sujet.length > 1 || mines > 1 ? 'ont' : 'a'}.`;
}
/** Une autre de mes planètes qui prendrait cette cargaison sous 95 % de ses hangars, la plus proche. */
function autreCibleAvecPlace(from, cargo, at, exclus){
  const c = parseC(from && from.coords);
  if(!c) return null;
  return S.planets.filter(q => q !== from && !(exclus || []).includes(q) && q.stock && parseC(q.coords)).filter(q => {
    const pr = production(q), proj = projectResources(q, at);
    return [0, 1, 2].every(j => !(cargo[j] > 0) || proj[j] + cargo[j] <= 0.95 * pr.cap[j]);
  }).sort((a, b) => distance(c, parseC(a.coords)) - distance(c, parseC(b.coords)))[0] || null;
}

/**
 * Les ressources au plafond, ou qui vont l'atteindre, une ligne par planète et
 * ressource, la plus coûteuse en production perdue d'abord (en équivalent
 * métal au ratio du joueur). Lit les constats du plan : une règle éteinte ou
 * un constat ignoré n'y est pas.
 */
function surplusListe(plan){
  const cs = constatsVus((plan && plan.constats) || []).filter(c => c.regle === 'RES_STORAGE_FULL' || c.regle === 'RES_STORAGE_SOON');
  const vus = new Set(), out = [];
  for(const c of cs){
    const p = planetById(c.pid), k = c.valeur, cle = `${c.pid}:${k}`;
    if(!p || ![0, 1, 2].includes(k) || vus.has(cle)) continue;
    vus.add(cle);
    const pr = production(p), st = stockNow(p), l = pertesParHeure(p, k, pr);
    out.push({c, p, k, plein:c.regle === 'RES_STORAGE_FULL', st, cap:pr.cap[k], pertes:l, solutions:solutionsSurplus(p, k, plan)});
  }
  /* Un plafond atteint passe devant un plafond à venir ; à état égal, la
     perte horaire décide. */
  return out.sort((a, b) => (b.plein - a.plein) || b.pertes.eqM - a.pertes.eqM);
}
/**
 * La carte Ressources en trop : une entrée par ressource au plafond ou qui va
 * l'atteindre, la production perdue en tête, puis jusqu'à trois solutions
 * dans l'ordre — dépenser sur place, transférer, monter le hangar. Rien ne
 * part tout seul : « Préparer » ouvre le formulaire du jeu, l'envoi reste le
 * clic du joueur. Baisser la production n'y figure jamais.
 * @returns {{html:string, items:{sev:string, key:string}[]}}
 */
function surplusHtml(plan){
  const l = surplusListe(plan).filter(x => typeof meteoVoit !== 'function' || meteoVoit({pid:x.p.id}));
  if(!l.length) return {html:'', items:[]};
  const solHtml = (s, x) => {
    if(s.type === 'depense') return `<li><b>Dépenser sur place</b> · ${esc(s.what)} ${costHtml(s.cost)} <span class="note">${fmt(s.cost[x.k])} de ${NOM_RES[x.k]} d'un coup, déjà dans ton plan.</span></li>`;
    if(s.type === 'transfert') return `<li><b>Transférer vers un besoin</b> · ${esc(s.what)}${transportHtml(s)}</li>`;
    return `<li><b>Monter le hangar</b> · ${esc(s.what)} ${costHtml(s.cost)} <span class="note">${dur(s.duree)} de chantier · ${esc(s.pourquoi)}.</span></li>`;
  };
  const ligne = x => {
    const c = x.c, sev = NIVEAU_SEV[c.niveau] || 'warn', where = S.planets.length > 1 ? ` sur ${x.p.name}` : '';
    const titre = x.plein ? `${majus(NOM_RES[x.k])} au plafond${where} : ${fmtK(x.pertes.res)} ${NOM_RES[x.k]}/h perdus`
      : `${majus(NOM_RES[x.k])} au plafond dans ${c.vars.dans}${where} : ${fmtK(x.pertes.res)} ${NOM_RES[x.k]}/h en jeu`;
    const e = x.st[x.k] - x.cap;
    const detail = (e > 0 ? `${fmt(e)} au-dessus de la capacité (${fmt(x.cap)})` : `${Math.floor(x.st[x.k] / x.cap * 100)} % de la capacité (${fmt(x.cap)})`)
      + (x.k ? ` · ≈ ${fmtK(x.pertes.eqM)} métal/h au ratio` : '') + '.';
    const n = surplusCompte(x.p.id, x.k), recur = regleParam('RES_STORAGE_FULL', 'recurrence', 3);
    const sols = x.solutions.length ? `<ol class="surplus-sol">${x.solutions.map(s => solHtml(s, x)).join('')}</ol>`
      : `<p class="note">Rien d'utile à financer ici, et aucune planète qui en manque n'a la place. Le hangar ne se propose qu'après ${recur} débordements en 7 jours (${n} pour l'instant) : un plafond ponctuel redescend avec la prochaine dépense.</p>`;
    return `<li><span class="pill ${sev}">${SEV_LABEL[sev] || ''}</span><span class="what">${esc(titre)}</span>`
      + `<span class="why">${c.vars.cause ? esc(c.vars.cause) : ''}${esc(detail)}${sols}`
      + ` <button class="btn sm ghost" data-ign="${esc(ignKey(c))}" title="Masqué jusqu'à ce que la situation change, ou 24 h">Ignorer</button></span></li>`;
  };
  return {items:l.map(x => ({sev:NIVEAU_SEV[x.c.niveau] || 'warn', key:x.c.what})),
    html:`<div class="card"><h2>Ressources en trop <span class="note">${l.length}</span></h2>`
      + `<p class="note mb-2">Au plafond, la mine ou le synthétiseur s'arrête tant que le stock ne redescend pas. Dans l'ordre : le dépenser ici, sinon l'envoyer où il manque, et le hangar seulement si ça revient.</p>`
      + `<ul class="advice">${l.map(ligne).join('')}</ul></div>`};
}
/* L'option satellites est respectée par energyOptions : un satellite écarté
   ne sort pas comme la solution, il se dit à part dans planetAlerts. */
EVAL.energyBalance = p => {
  const pr = production(p);
  if(!(pr.factor < 1)) return [];
  const ok = energyOptions(p).filter(o => o.prete), best = ok[0];
  return [{valeur:0, repond:{kinds:['b', 'sats'], ks:['solar', 'fusion']},
    vars:{pct:Math.round(pr.factor * 100), quoi:best ? best.label : B.solar.n,
      options:best ? `Le moins cher par point d'énergie : ${energyLine(best)}.${ok.length > 1 ? ` Sinon ${ok.slice(1).map(energyLine).join(', ')}.` : ''}`
        : 'Monte la centrale solaire.'}}];
};
/* Le meilleur pas du classement ne tient pas dans le hangar : le plan monte le
   hangar d'abord (pickBuildings). Sans cette règle l'attente serait infinie et
   setGoal la tairait, d'où son verrou. */
EVAL.nextLevelCost = p => {
  const best = rankUpgrades(p).filter(u => u.payback < Infinity && B[u.key])[0];
  if(!best) return [];
  const pr = production(p), bc = best.extraSolar ? levelCost(B.solar, p.b.solar + 1) : levelCost(B[best.key], best.lvl), out = [];
  for(let j = 0; j < 3; j++) if(bc[j] > pr.cap[j]){
    const [name, bk] = HANGARS[j];
    out.push({valeur:`${best.key}${best.lvl}:${j}`, cost:levelCost(B[bk], p.b[bk] + 1), repond:{kinds:['b'], ks:[bk]},
      vars:{mine:upLabel(best), hangar:name, niveau:p.b[bk]}});
  }
  return out;
};
/* La mine conseillée ferait passer l'énergie en négatif : la centrale d'abord,
   et son prix est compté dans celui de la mine (rankUpgrades). */
EVAL.nextMineEnergy = p => {
  const u = rankUpgrades(p).filter(x => x.payback < Infinity && B[x.key]).slice(0, 2).find(x => x.extraSolar);
  if(!u || p.satPending) return [];
  return [{valeur:`${u.key}${u.lvl}`, cost:levelCost(B.solar, p.b.solar + 1), repond:{kinds:['b', 'sats'], ks:['solar']},
    vars:{mine:`${B_SHORT[u.key]} ${u.lvl}`, niveau:p.b.solar}}];
};
/* Une file est occupée quand le jeu y montre un chantier, nommé ou non : même
   lecture que simulateDay. */
const fileDe = (p, test) => (S.timers || []).filter(t => t && t.pid === p.id && test(t));
const enCours = t => !t.done && t.end > Date.now();
const fileBat = t => t.kind === 'b' || (t.kind === 'x' && t.queue === 'building');
/* La valeur du constat est la fin du dernier chantier connu : une file revidée
   plus tard est une autre occurrence, et un « Ignorer » d'hier ne la cache pas. */
EVAL.queueEmpty = p => {
  const l = fileDe(p, fileBat);
  if(l.some(enCours)) return [];
  return [{valeur:l.reduce((m, t) => Math.max(m, +t.end || 0), 0), repond:{kinds:['b']}, vars:{}}];
};
EVAL.researchIdle = p => {
  const lab = planeteRecherche();
  if(!lab || lab.id !== p.id || !(p.b.lab >= 1)) return [];
  const l = (S.timers || []).filter(t => t && (t.kind === 't' || (t.kind === 'x' && t.queue === 'research')));
  if(l.some(enCours)) return [];
  return [{valeur:l.reduce((m, t) => Math.max(m, +t.end || 0), 0), repond:{kinds:['t'], partout:true}, vars:{}}];
};

/* La cible d'écart entre la mine de métal et celle de cristal : le style du
   profil, ajusté par la position. Lue dans rules.json, jamais saisie. Rien sans
   style ni position lisible : une cible inventée serait pire que pas de cible. */
function cibleMines(p){
  const st = S.profil && S.profil.style, mb = REGLES.mineBalance || {};
  if(!st || !aSoi(mb.byStyle, st) || !Number.isFinite(+mb.byStyle[st])) return null;
  const c = parseC(p && p.coords); if(!c) return null;
  let adj = null;
  for(const [k, v] of Object.entries(mb.byPosition || {})){
    const m = /^(\d+)-(\d+)$/.exec(k);
    if(m && c[2] >= +m[1] && c[2] <= +m[2] && Number.isFinite(+v)){ adj = +v; break; }
  }
  if(adj == null) return null;
  return {cible:+mb.byStyle[st] + adj, actuel:(p.b.metal || 0) - (p.b.crystal || 0), position:c[2]};
}
/* La mine en retard sur la cible. Une tolérance d'un niveau au-dessus évite que
   la planète oscille d'une mine à l'autre à chaque session. */
function mineEnRetard(p){
  const r = cibleMines(p); if(!r) return null;
  const k = r.actuel < r.cible ? 'metal' : r.actuel > r.cible + regleParam('RES_MINE_BALANCE', 'tolerance', 1) ? 'crystal' : null;
  return k ? Object.assign({k}, r) : null;
}
const signe = n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
EVAL.mineBalanceTarget = p => {
  const r = mineEnRetard(p); if(!r) return [];
  return [{valeur:`${r.k}:${r.cible}:${r.actuel}`, cost:levelCost(B[r.k], p.b[r.k] + 1), repond:{kinds:['b'], ks:[r.k]},
    vars:{cible:signe(r.cible), actuel:signe(r.actuel), mine:B[r.k].n, niveau:p.b[r.k], position:r.position,
      style:(PROFILS.styles[S.profil.style] || {}).n || ''}}];
};
/* Ce qu'une règle d'installation pousse dans pickBuildings, calculé au même
   endroit pour le constat et pour le plan : sinon les deux finiraient par ne
   plus dire la même chose. */
function naniteRetard(p){
  const max = Math.max(0, ...S.planets.map(x => x.b.nanite || 0)), n = p.b.nanite || 0;
  return n < max - regleParam('INST_NANITES_LAGGING', 'ecart', 2) && !reqOk(B.nanite.req, p).length ? {n, max} : null;
}
EVAL.nanitesLagging = p => {
  const r = naniteRetard(p); if(!r) return [];
  return [{valeur:`${r.n}:${r.max}`, cost:levelCost(B.nanite, r.n + 1), repond:{kinds:['b'], ks:['nanite']}, vars:{niveau:r.n, max:r.max}}];
};
/* Le plan ne propose jamais de robots au-delà de 10 : ce cas ne naît que d'une
   priorité du joueur. Le copilote la sert, et chiffre l'autre chemin. */
function robotsOuNanites(p, lvl){
  if(!(lvl > 10) || (p.b.robot || 0) < 10 || reqOk(B.nanite.req, p).length) return null;
  return {robots:lvl, nanite:(p.b.nanite || 0) + 1, gain:((lvl + 1) / lvl).toFixed(2).replace('.', ',')};
}
EVAL.nanitesOverRobots = p => {
  const pr = prios().find(x => x.kind === 'b' && x.pid === p.id && x.k === 'robot');
  const r = pr && robotsOuNanites(p, (p.b.robot || 0) + 1);
  return r ? [{valeur:`${r.robots}:${r.nanite}`, cost:levelCost(B.nanite, r.nanite), vars:r}] : [];
};
/* À 0 et 1 case libre, planetAlerts dit déjà le mur ; la règle parle avant. */
function casesBasses(p){
  const l = casesLibres(p), seuil = regleParam('INST_FIELDS_LOW', 'seuil', 10);
  return l != null && l >= 2 && l < seuil ? l : null;
}
EVAL.fieldsFree = p => {
  const l = casesBasses(p); if(l == null) return [];
  const manque = reqOk(B.terra.req, p);
  return [{valeur:l, cost:manque.length ? null : levelCost(B.terra, (p.b.terra || 0) + 1), repond:{kinds:['b'], ks:['terra']},
    vars:{libres:l, pris:p.cases.pris, max:p.cases.max, niveau:p.b.terra || 0,
      terra:manque.length ? `Le Terraformeur en ajouterait, mais il demande ${manque.join(', ')}.` : 'Le Terraformeur en ajoute à chaque niveau.'}}];
};
/* Les labos que le Réseau fait compter : celui du centre, et les N meilleurs
   des autres planètes, N étant le niveau du Réseau (labEffectif). */
function laboEnRetard(p){
  const n = S.tech.irn || 0, c = labPlanet();
  if(!n || !c || c.id === p.id || !((p.b.lab || 0) >= 1)) return null;
  const comptes = S.planets.filter(x => x.id !== c.id).sort((a, b) => (b.b.lab || 0) - (a.b.lab || 0)).slice(0, n);
  return comptes.some(x => x.id === p.id) && p.b.lab <= (c.b.lab || 0) - regleParam('INST_LAB_NETWORK', 'ecart', 3)
    ? {niveau:p.b.lab, centre:c.b.lab || 0} : null;
}
EVAL.labNetworkGap = p => {
  if(rechercheEnCours()) return [];
  const r = laboEnRetard(p); if(!r) return [];
  return [{valeur:`${r.niveau}:${r.centre}`, cost:levelCost(B.lab, r.niveau + 1), repond:{kinds:['b'], ks:['lab']}, vars:r}];
};
EVAL.colonySlotFree = p => {
  const f = coloFrom();
  if(!f || f.id !== p.id || S.planets.length >= maxPlanets() || colSentNow()) return [];
  return [{valeur:`${S.planets.length}/${maxPlanets()}`, repond:{kinds:['ship', 'fleet'], partout:true},
    vars:{planetes:S.planets.length, max:maxPlanets(), astro:S.tech.astro,
      note:S.day.focus === 'eco' ? ' Avec « Économie pure », le plan ne colonise pas de lui-même : c\'est à toi de lancer le vaisseau.' : ''}}];
};
/* La recherche de tête, impayable au centre, payable ici avec un labo qui
   remplit le prérequis. Une seule planète le dit : la première qui peut. */
function rechercheAilleurs(){
  const lab = labPlanet(); if(!lab || rechercheEnCours()) return null;
  const R = nextResearch().list[0]; if(!R) return null;
  const c = levelCost(T[R.k], R.lvl), peut = q => { const st = stockNow(q); return c.every((x, j) => x <= st[j]); };
  if(peut(lab)) return null;
  const q = S.planets.find(x => x.id !== lab.id && labOkPour(R.k, x) && peut(x));
  return q ? {R, c, q} : null;
}
/* Le prérequis de labo d'une recherche, sur CETTE planète. `reqOk` lit le labo
   du centre (labLevel) : juste pour ce qui est débloqué, faux pour dire d'où on
   peut la lancer — un prérequis est une propriété de la planète. Les
   prérequis de technologie, eux, sont ceux de l'empire, et nextResearch ne rend
   que des pas déjà débloqués. */
const labOkPour = (k, p) => (p.b.lab || 0) >= ((T[k].req || {}).lab || 0) && (p.b.lab || 0) >= 1;
EVAL.researchElsewhere = p => {
  const r = rechercheAilleurs(); if(!r || r.q.id !== p.id) return [];
  return [{valeur:`${r.R.k}${r.R.lvl}`, cost:r.c, repond:{kinds:['t'], partout:true},
    vars:{recherche:`${T[r.R.k].n} ${r.R.lvl}`, depuis:p.name}}];
};
/* Une recherche que le profil réclame : le style, ou un focus. */
const profilVise = r => (Array.isArray(r.styles) && r.styles.includes(S.profil.style))
  || (Array.isArray(r.focus) && r.focus.some(f => (S.profil.focus || []).includes(f)));
EVAL.techBelow = (p, prm, r) => {
  const lab = labPlanet();
  if(!lab || lab.id !== p.id || !aSoi(T, r.tech) || !profilVise(r)) return [];
  const n = S.tech[r.tech] || 0;
  if(!(n < prm.niveauCible)) return [];
  return [{valeur:String(n), cost:levelCost(T[r.tech], n + 1), repond:{kinds:['t'], partout:true, tk:r.tech},
    vars:{niveau:n, cible:prm.niveauCible, style:(PROFILS.styles[S.profil.style] || {}).n || '', pct:hyperCargoPct()}}];
};
/* Les pas de recherche que les règles poussent en tête de la feuille de route,
   derrière les priorités du joueur. Toute règle de condition techBelow y entre :
   en ajouter une au fichier ne demande pas de code. */
function reglesRecherche(){
  const out = [];
  for(const id of Object.keys(REGLES_PAR_ID)){
    const r = regle(id);
    if(r.condition !== 'techBelow' || !regleActive(id) || !aSoi(T, r.tech) || !profilVise(r)) continue;
    if((S.tech[r.tech] || 0) < r.parametres.niveauCible) out.push([r.tech, r.parametres.niveauCible, '', id]);
  }
  return out;
}
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
/** Réglages › Formes de vie : la race de chaque planète, d'où elle vient, et de quoi la corriger. */
function raceRows(){
  const ps = (S.planets || []).filter(p => lfIds(p).length || p.race);
  if(!ps.length) return '';
  return `<p class="note mt-2 mb-1"><b>Race par planète</b> — corrige-la si la lecture se trompe : la valeur posée à la main l'emporte.</p><ul class="list">${ps.map(p => {
    const r = raceDe(p), etat = r.conflit ? 'contradictoire' : r.race ? `${nomRace(r.race)} · ${RACE_SRC[r.src] || ''}` : 'inconnue';
    return `<li><span><b>${esc(p.name)}</b> <span class="note">${esc(etat)}</span></span><select data-race="${esc(p.id)}" class="w-auto"><option value="">Lire dans le jeu</option>${Object.entries(LIFEFORMS).map(([k, l]) => `<option value="${k}" ${p.race === k ? 'selected' : ''}>${esc(l.n)}</option>`).join('')}</select></li>`;
  }).join('')}</ul><div class="row mt-2"><button class="btn sm ghost" data-rescan="1" title="Oublie les noms lus et relance les conseils : utile après une mise à jour du jeu">Rescanner</button><span class="note">Les noms se relisent à la prochaine visite des pages Formes de vie.</span></div>`;
}

/* ---------- les règles du moteur : ignorer, compter ---------- */
/** La clé d'« Ignorer » : la règle, la planète en identifiant du jeu (`daily`
    voyage), et la valeur de la condition. */
function ignKey(c){
  // planetById et non gidDe : celle-là est une const posée en fin de fichier, après le premier rendu
  const p = planetById(c.pid), gid = p && p.gid != null ? String(p.gid) : null;
  return `${c.regle}|${gid || c.pid}|${c.valeur}`;
}

/* ---------- les règles du moteur : le bloc des conseils ---------- */
/**
 * Les lignes du bloc : les constats que le plan ne sert pas et que le joueur
 * n'a pas ignorés, puis les alertes qui ne sont pas des règles (bridage,
 * emplacements). Un constat servi n'y est pas : la carte du plan est sa
 * réponse, et le bloc n'est pas une seconde liste des mêmes choses.
 */
function conseilLignes(plan){
  /* Les débordements ont leur carte, Ressources en trop, qui dit la perte et
     les solutions : les répéter ici ferait deux listes des mêmes choses. */
  const cs = constatsVus(plan.constats || []).filter(c => !c.servi && !SURPLUS_REGLES.includes(c.regle));
  const autres = (plan.alerts || []).filter(a => !a.regle).map(a => ({
    niveau:SEV_NIVEAU[a.sev] || 'conseil', sev:a.sev, what:a.what, why:a.why, pid:a.pid, domaine:'', cat:'', rang:Infinity}));
  const pi = new Map((S.planets || []).map((p, i) => [p.id, i]));
  return cs.map(c => Object.assign({sev:NIVEAU_SEV[c.niveau]}, c)).concat(autres)
    .sort((a, b) => rangNiveau(a.niveau) - rangNiveau(b.niveau) || poidsCat(b.cat) - poidsCat(a.cat)
      || a.rang - b.rang || (pi.get(a.pid) || 0) - (pi.get(b.pid) || 0));
}
/** La planète ouverte dans le jeu : `S.cur` est le gid que chaque instantané reprend. */
function planeteOuverte(){
  const ps = S.planets || [];
  return ps.find(p => S.cur != null && p.gid != null && String(p.gid) === String(S.cur)) || ps[0] || null;
}
function conseilHtml(l, avecPlanete){
  const p = planetById(l.pid);
  const st = p ? stockNow(p) : null;
  const cout = l.cost ? ` ${costHtml(l.cost)} <span class="note">${st && l.cost.every((x, j) => x <= st[j]) ? 'payable maintenant' : 'pas encore payable'}</span>` : '';
  const quand = l.vars && l.vars.attente ? ` <span class="note">ressources réunies vers ${esc(l.vars.attente)}</span>` : '';
  const tete = [l.domaine ? DOMAINES[l.domaine] || l.domaine : '', avecPlanete && p && S.planets.length > 1 ? p.name : ''].filter(Boolean).join(' · ');
  return `<li><span class="pill ${l.sev}">${SEV_LABEL[l.sev] || ''}</span><span class="what">${tete ? `<span class="note">${esc(tete)}</span> ` : ''}${esc(l.what)}${l.statut === 'a_valider' ? ' <span class="pill info">à valider</span>' : ''}</span>`
    + `<span class="why">${esc(l.why)}${l.action ? `<br>→ <b>${esc(l.action)}</b>${cout}${quand}` : quand}`
    /* « Scanner » ouvre la page à relire, d'un clic du joueur, comme toutes les
       cartes : le copilote ne navigue jamais seul. */
    + `${l.vars && l.vars.url ? ` <button class="btn sm" data-prep="${esc(l.vars.url)}">Scanner</button>` : ''}`
    + `${l.source ? ` <a href="${esc(l.source)}" target="_blank" rel="noopener">source</a>` : ''}`
    + `${l.regle ? ` <button class="btn sm ghost" data-ign="${esc(ignKey(l))}" title="Masqué jusqu'à ce que la situation change, ou 24 h">Ignorer</button>` : ''}</span></li>`;
}
/**
 * Le bloc des conseils d'Aujourd'hui : trois lignes de la planète ouverte dans
 * le jeu, puis l'empire entier, filtrable. Rien quand il n'y a rien à dire.
 */
function conseilsHtml(plan){
  /* Le filtre de la météo vaut ici comme ailleurs : une planète choisie dans la
     grille, et le bloc ne parle plus que d'elle. */
  const mf = typeof meteoFiltre === 'function' ? meteoFiltre() : null;
  const l = conseilLignes(plan).filter(x => typeof meteoVoit !== 'function' || meteoVoit(x));
  if(!l.length) return '';
  const cur = mf || planeteOuverte(), f = (S.ui && S.ui.cf) || {};
  const tete = cur ? l.filter(x => x.pid === cur.id).slice(0, 3) : [];
  /* Un critique qui n'est pas dans les trois lignes de tête ouvre « Voir tout »
     de force, sans toucher au choix enregistré : passé, le volet revient comme
     le joueur l'avait laissé. */
  const critique = l.some(x => x.sev === 'bad' && !tete.includes(x));
  const tri = l.filter(x => (!f.domaine || x.domaine === f.domaine) && (!f.niveau || x.niveau === f.niveau)
    && (!f.planete || x.pid === f.planete) && (!f.manque || x.regle === 'FDV_DATA_MISSING'));
  const sel = (k, vide, opts) => `<select data-cf="${k}" class="w-auto"><option value="">${esc(vide)}</option>${opts.map(([v, n]) => `<option value="${esc(v)}" ${f[k] === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
  const filtres = `<div class="row gap-2 m-0 mt-2 mb-2">`
    + sel('domaine', 'Tous les domaines', Object.entries(DOMAINES))
    + sel('niveau', 'Tous les niveaux', NIVEAUX.map(n => [n, SEV_LABEL[NIVEAU_SEV[n]]]))
    + (S.planets.length > 1 && !mf ? sel('planete', 'Toutes les planètes', S.planets.map(p => [p.id, p.name])) : '')
    + `<label class="note row gap-1"><input type="checkbox" data-cf="manque" ${f.manque ? 'checked' : ''} class="interrupteur">Données manquantes</label></div>`;
  return `<div class="card"><h2>Conseils${cur && S.planets.length > 1 ? ` <span class="note">${esc(cur.name)}</span>` : ''}</h2>`
    + (tete.length ? `<ul class="advice">${tete.map(x => conseilHtml(x, false)).join('')}</ul>`
      : `<p class="note">Rien à signaler${cur ? ` sur ${esc(cur.name)}` : ''}.</p>`)
    + `<details class="volet"${fold('conseils', false, critique)}><summary class="note" data-fold="conseils">Voir tout (${l.length})</summary>${filtres}`
    + (tri.length ? `<ul class="advice">${tri.map(x => conseilHtml(x, true)).join('')}</ul>` : '<p class="note">Aucun conseil pour ces filtres.</p>')
    + `</details></div>`;
}

/**
 * Réglages › Règles : une ligne par règle, groupées par domaine, dans l'ordre
 * du fichier. Une règle à verrou garde sa case grisée et dit pourquoi : une case
 * qui ne fait rien sans le dire est un mensonge par omission.
 */
function reglesCard(){
  const ids = Object.keys(REGLES_PAR_ID);
  if(REGLES_ERR || !ids.length) return `<div class="card"><h2>Règles du moteur</h2><p class="note">${esc(REGLES_ERR || 'Aucune règle dans rules.json.')}</p></div>`;
  const ligne = id => {
    const r = regle(id);
    const champs = Object.keys(r.parametres || {}).map(k => `<label class="note row gap-1">${esc(k)}<input type="number" step="any" data-rg-p="${esc(id)}:${esc(k)}" value="${esc(r.parametres[k])}" class="court"></label>`).join('');
    return `<li><label class="ligne-interrupteur"><input type="checkbox" data-rg-on="${esc(id)}" ${r.on ? 'checked' : ''} ${r.verrou ? 'disabled' : ''} class="interrupteur">`
      + `<span><span class="pill ${NIVEAU_SEV[r.niveau] || 'info'}">${esc(SEV_LABEL[NIVEAU_SEV[r.niveau]] || r.niveau)}</span> <b>${esc(r.nom || id)}</b> <span class="note mono">${esc(id)}</span>`
      + `${r.statut === 'a_valider' ? ' <span class="pill info">à valider</span>' : ''}`
      + `${r.verrou ? `<br><span class="note">Toujours active : ${esc(r.pourquoi_verrou || 'la simulation en a besoin.')}</span>` : ''}</span></label>`
      + `${champs ? `<span class="row gap-2">${champs}</span>` : ''}</li>`;
  };
  const groupes = Object.entries(DOMAINES).map(([d, n]) => {
    const l = ids.filter(id => REGLES_PAR_ID[id].domaine === d);
    return l.length ? `<h3 class="note mt-2 mb-1">${esc(n)}</h3><ul class="list">${l.map(ligne).join('')}</ul>` : '';
  }).join('');
  return `<details class="card"${fold('regles', false)}><summary data-fold="regles">Règles du moteur <span class="note">${ids.filter(id => regle(id).on).length} sur ${ids.length} actives</span></summary>
    <p class="note mt-2">Ce que le copilote surveille sur chaque planète, et ce que le plan en fait.</p>
    ${aide('regles', '<p class="note">Décocher une règle l\'éteint : sa carte ne sort plus, et elle ne compte plus sur l\'icône. Les seuils se changent ici ; le reste vit dans <code>rules.json</code>.</p>')}
    ${groupes}</details>`;
}

/* Les règles qu'on coupe pour une planète seulement — « pas de Terraformeur
   sur mon coffre-fort ». Sur la planète, donc sur ce poste : un id local ne
   voyage pas, comme le modèle de défense par planète. */
function regOffHtml(p){
  const ids = Object.keys(REGLES_PAR_ID).filter(id => REGLES_PAR_ID[id].parPlanete);
  if(!ids.length) return '';
  return `<p class="note mt-2"><b>Règles du moteur</b> — décoche celles qui ne valent pas pour cette planète.</p><div class="row gap-2">${ids.map(id =>
    `<label class="note row gap-1"><input type="checkbox" data-regoff="${esc(p.id)}|${esc(id)}" ${(p.regOff || {})[id] ? '' : 'checked'} class="interrupteur">${esc(REGLES_PAR_ID[id].nom || id)}</label>`).join('')}</div>`;
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
/** Parses an OGame countdown like "1j 2h 13m 5s", "2h13m", "01:13:05" into seconds. */
function parseLeft(txt){
  const t = norm(txt).replace(/,/g,' ');
  if(/^\s*\d+(:\d{1,2}){1,2}\s*$/.test(t)){ const p=t.trim().split(':').map(Number); return p.length===3 ? p[0]*3600+p[1]*60+p[2] : p[0]*60+p[1]; }
  let sec=0, hit=false;
  const re=/(\d+)\s*(sem|w|j|d|h|m(?!s)|min|s)/g; let m;
  while((m=re.exec(t))){ hit=true; const v=+m[1]; sec += v*({sem:604800,w:604800,j:86400,d:86400,h:3600,m:60,min:60,s:1}[m[2]]); }
  if(!hit && /^\s*\d+\s*$/.test(t)) return +t*60;
  return hit ? sec : null;
}
function timerOptions(){
  const r = Object.keys(T).map(k=>`<option value="t:${k}">${T[k].n} ${num(S.tech[k])+1}</option>`).join('');
  const b = S.planets.map(p=>`<optgroup label="Bâtiments · ${esc(p.name)}">${Object.keys(B).map(k=>`<option value="b:${p.id}:${k}">${B[k].n} ${num(p.b[k])+1}</option>`).join('')}</optgroup>`).join('');
  return `<optgroup label="Recherche">${r}</optgroup>${b}<optgroup label="Autre"><option value="x:fleet">Retour de flotte</option><option value="x:expo">Retour d'expédition</option><option value="x:other">Autre</option></optgroup>`;
}
function timerLabel(tm){
  if(tm.kind==='t') return `${T[tm.k].n} ${tm.lvl}`;
  if(tm.kind==='b'){ const p=planetById(tm.pid); return `${B[tm.k].n} ${tm.lvl}${p&&S.planets.length>1?` · ${p.name}`:''}`; }
  return tm.label || ({fleet:'Retour de flotte',expo:'Retour d\'expédition',other:'Minuteur'})[tm.k];
}
let audioCtx = null;
function unlockAudio(){ try{ audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)(); if(audioCtx.state==='suspended') audioCtx.resume(); }catch(e){} }
function chime(){
  if(!audioCtx || S.settings.muet) return;
  try{ const t0=audioCtx.currentTime; [0,.22,.44,.9,1.12,1.34].forEach((d,i)=>{ const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.type='sine'; o.frequency.value=[660,880,1100][i%3]; g.gain.setValueAtTime(.0001,t0+d); g.gain.exponentialRampToValueAtTime(.25,t0+d+.02); g.gain.exponentialRampToValueAtTime(.0001,t0+d+.2); o.connect(g).connect(audioCtx.destination); o.start(t0+d); o.stop(t0+d+.22); }); }catch(e){}
}
const baseTitle = document.title;
let flashT = null;
function flashTitle(msg){ clearInterval(flashT); let on=false; flashT=setInterval(()=>{ document.title = (on=!on) ? `Terminé : ${msg}` : baseTitle; },1000); }
const alertQueue = [];
/* showBigAlert est déclarée plus bas (« one alert, one acknowledgment ») :
   elle passe par le service worker. La version locale qui vivait ici n'a
   jamais servi — en script classique, la dernière déclaration l'emportait —
   et un module ES refuse de charger un nom déclaré deux fois. */
/** Hides every finished timer up to now. */
function ackFinished(){ S.ackBefore = Date.now(); save(); renderTimers(); }
document.getElementById('bigAlertOk').addEventListener('click', ()=>{ alertQueue.length = 0; document.getElementById('bigAlert').hidden = true; stopFlash(); ackFinished(); });
function stopFlash(){ clearInterval(flashT); flashT=null; document.title=baseTitle; }
window.addEventListener('focus', stopFlash);
document.addEventListener('pointerdown', ()=>{ unlockAudio(); stopFlash(); });
/** Completes a timer: bumps the matching level, rings and notifies. */
function finishTimer(tm){
  tm.done = true;
  if(tm.kind==='t' && S.tech[tm.k] < tm.lvl) S.tech[tm.k] = tm.lvl;
  if(tm.kind==='x' && tm.k==='colship') S.colo.built = true;
  /* Un id muet — la planète n'a pas été appariée au dernier relevé : le
     minuteur sonne et prévient, mais rien ne se crédite. Un niveau à ressaisir
     se rattrape ; un niveau posé sur la voisine, non. */
  const cible = planetById(tm.pid);
  if(tm.kind==='x' && tm.k==='sats' && cible && !tm.game) cible.sats += tm.n||0;
  if(tm.kind==='x' && tm.k==='shipyard' && tm.ships && cible && !tm.game) addBuilt(cible, tm.ships);
  if(tm.kind==='b' && cible && cible.b[tm.k] < tm.lvl) cible.b[tm.k] = tm.lvl;
  save(); chime(); flashTitle(timerLabel(tm));
  const extHandles = tm.game && window.chrome && chrome.runtime && chrome.runtime.id;
  if(!extHandles) showBigAlert(timerLabel(tm));
}
function tickTimers(){
  const now = Date.now(); let changed=false;
  for(const tm of S.timers){ if(!tm.done && tm.end<=now){ finishTimer(tm); changed=true; } }
  const list = document.getElementById('tmList');
  if(list){
    if(changed || list.dataset.count !== String(visibleTimers().length)) renderTimers();
    else S.timers.forEach(tm=>{ const el=document.getElementById('cd-'+tm.id); if(el && !tm.done) el.textContent = clock((tm.end-now)/1000); });
  }
  if(changed && tab==='today') garderVue(()=>{ REFRESH.today(); cartesSync(); });
}
function clock(sec){ sec=Math.max(0,Math.round(sec)); const d=Math.floor(sec/86400), h=Math.floor(sec%86400/3600), m=Math.floor(sec%3600/60), s=sec%60; return (d?d+'j ':'') + `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
/** Timers still worth showing: running, or finished but not yet acknowledged. */
function visibleTimers(){ return S.timers.filter(t=>!(t.done || t.end<=Date.now()) || t.end > (S.ackBefore||0)); }
function renderTimers(){
  const list = document.getElementById('tmList'); if(!list) return;
  const sorted = visibleTimers().sort((a,b)=>(a.done-b.done)||(a.end-b.end));
  list.dataset.count = String(sorted.length);
  /* Replié, le titre tient tout ce qu'on venait vérifier : combien tournent et
     lequel finit le premier. */
  const sum = document.getElementById('tmSum');
  if(sum){
    const fini = sorted.filter(t=>t.done).length, cours = sorted.filter(t=>!t.done);
    sum.textContent = fini ? `${fini} terminé${fini>1?'s':''}`
      : cours.length ? `${cours.length} en cours · le premier dans ${dur((cours[0].end-Date.now())/1000)}`
      : 'aucun';
  }
  list.innerHTML = sorted.length ? sorted.map(tm=>`<li class="${tm.done?'done':''}"><div><div>${esc(timerLabel(tm))}</div><div class="note">fin à ${formatTime(tm.end, {date: true})}</div></div>
    <div class="row gap-2"><span class="cd" id="cd-${tm.id}">${tm.done?'Terminé':clock((tm.end-Date.now())/1000)}</span><button class="btn sm ghost" data-tmrm="${tm.id}">${tm.done?'OK':'Annuler'}</button></div></li>`).join('')
    : `<li><div class="note">Aucun minuteur. Copie le compte à rebours affiché dans le jeu, colle-le ici et lance.</div></li>`;
}

/* ---------- colonization ---------- */
const POS = [null,
  {min:96, avg:134, max:172, t:240, bonus:'+40 % cristal', astro:8},
  {min:104,avg:140, max:176, t:190, bonus:'+30 % cristal', astro:6},
  {min:112,avg:147, max:182, t:140, bonus:'+20 % cristal', astro:4},
  {min:118,avg:163, max:208, t:90,  bonus:'', astro:1},
  {min:133,avg:182, max:232, t:80,  bonus:'', astro:1},
  {min:146,avg:194, max:242, t:70,  bonus:'+17 % métal', astro:1},
  {min:152,avg:200, max:248, t:60,  bonus:'+23 % métal', astro:1},
  {min:156,avg:204, max:252, t:50,  bonus:'+35 % métal', astro:1},
  {min:150,avg:198, max:246, t:40,  bonus:'+23 % métal', astro:1},
  {min:142,avg:187, max:232, t:30,  bonus:'+17 % métal', astro:1},
  {min:136,avg:173, max:210, t:20,  bonus:'', astro:1},
  {min:125,avg:156, max:186, t:10,  bonus:'', astro:1},
  {min:114,avg:143, max:172, t:-30, bonus:'', astro:4},
  {min:100,avg:134, max:168, t:-70, bonus:'', astro:6},
  {min:90, avg:127, max:164, t:-110,bonus:'', astro:8},
];
const COL_SHIP_COST = [10000, 20000, 10000];
const KITS = {
  none: {n:'Aucun', lv:{}},
  light:{n:'Léger', lv:{metal:5, crystal:4, deut:2, solar:5}},
  std:  {n:'Standard', lv:{metal:8, crystal:6, deut:4, solar:8, robot:2}},
  fast: {n:'Rapide', lv:{metal:12, crystal:10, deut:6, solar:12, robot:4, shipyard:2}},
  big:  {n:'Avancé', lv:{metal:15, crystal:13, deut:9, solar:15, robot:6, shipyard:4}},
};
const OBJECTIVES = {
  balanced:{n:'Équilibré', w:{prod:.5, fields:.5}},
  metal:   {n:'Métal', w:{metal:.75, fields:.25}},
  crystal: {n:'Cristal', w:{crystal:.75, fields:.25}},
  deut:    {n:'Deutérium', w:{deut:.7, fields:.3}},
  big:     {n:'Grande planète', w:{fields:.8, prod:.2}},
};
/** Index of a planet that already has a colony ship docked, or -1. */
function colShipAt(){ return S.planets.findIndex(p=>((p.ships||{}).col||0)>0); }
/** True when a colonize mission is already flying or was marked as sent. */
function colSentNow(){ return (S.moves||[]).some(m=>m.mission===7 && !m.ret && m.arrival*1000>Date.now()) || !!(S.colo.sentAt && Date.now()-S.colo.sentAt<48*3600e3 && !S.planets.some(p=>((p.ships||{}).col||0)>0 && (p.shipsAt||0)>S.colo.sentAt)); }
function colBuilt(){ return !!S.colo.built || colShipAt()>=0; }
function maxPlanets(){ return 1 + Math.floor((S.tech.astro+1)/2); }
/* Un vaisseau déjà à quai est un fait et passe devant tout ; sinon la colonie
   part du centre, puisque c'est lui que le plan fait construire. Deux leviers
   se contredisaient : le plan sortait le vaisseau du centre et annonçait la
   durée de vol de la planète du select, cent systèmes plus loin. */
function coloFrom(){ const i = colShipAt(); return (i>=0 ? S.planets[i] : centrePlanet() || planetById(S.colo.fromId)) || S.planets[0]; }
function coloSystem(){ const c = parseC(coloFrom().coords) || [1,1,8]; return c; }
/** Simulated hourly output of a colony at each position, using the departure planet's mine levels. */
function rankPositions(){
  const dp = coloFrom(), [g,sy] = coloSystem(), o = OBJECTIVES[S.colo.objective] || OBJECTIVES.balanced, bonus = +S.colo.bonus || (API && API.server && API.server.bonusFields) || 0;
  const rows = [];
  for(let pos=1; pos<=15; pos++){
    const P = POS[pos];
    const fake = {coords:`${g}:${sy}:${pos}`, tmax:P.t, sats:0, b:Object.assign({}, dp.b)};
    const pr = production(fake);
    rows.push({pos, P, fields:P.avg+bonus, min:P.min+bonus, max:P.max+bonus, m:pr.m, c:pr.c, d:pr.d, v:mse(pr.m,pr.c,pr.d), ok:S.tech.astro>=P.astro});
  }
  const mx = k => Math.max(...rows.map(r=>r[k]), 1);
  const M = {prod:mx('v'), metal:mx('m'), crystal:mx('c'), deut:mx('d'), fields:mx('fields')};
  for(const r of rows){
    r.score = (o.w.prod||0)*r.v/M.prod + (o.w.metal||0)*r.m/M.metal + (o.w.crystal||0)*r.c/M.crystal + (o.w.deut||0)*r.d/M.deut + (o.w.fields||0)*r.fields/M.fields;
  }
  const ranked = rows.filter(r=>r.ok).sort((a,b)=>b.score-a.score);
  ranked.forEach((r,i)=>r.rank=i+1);
  return rows;
}
function bestPosition(){ const r = rankPositions().filter(x=>x.ok).sort((a,b)=>b.score-a.score)[0]; return r ? r.pos : 8; }
function coloTarget(){ if(parseC(S.colo.target)) return S.colo.target; const c = API && API.planets ? colonyCandidates()[0] : null; if(c) return c.coords; const [g,sy] = coloSystem(); return `${g}:${sy}:${bestPosition()}`; }
/** Starter kit cost and the fleet that delivers it. */
function coloFleet(){
  const dp = coloFrom(), kit = KITS[S.colo.kit] || KITS.std, target = coloTarget();
  const kitCost = [0,0,0];
  for(const [k,L] of Object.entries(kit.lv)){ const c = rangeCost(B[k], 0, L); kitCost[0]+=c[0]; kitCost[1]+=c[1]; kitCost[2]+=c[2]; }
  const col = shipStats('col'), tr = shipStats(S.colo.tr);
  const total = kitCost[0]+kitCost[1]+kitCost[2];
  const inCol = Math.min(total, col.cargoEff);
  const f = total ? inCol/total : 0;
  const colLoad = kitCost.map(x=>Math.floor(x*f));
  const rest = kitCost.map((x,i)=>x-colLoad[i]);
  const restSum = rest[0]+rest[1]+rest[2];
  const n = restSum>0 ? Math.ceil(restSum/tr.cargoEff) : 0;
  const leg1 = flight(dp.coords, target, {col:1}, 100);
  const leg2 = n ? flight(dp.coords, target, {[S.colo.tr]:n}, 100) : null;
  const fuel = (leg1 ? leg1.fuel : 0) + (leg2 ? leg2.fuel*2 : 0);
  const ship = colBuilt() ? [0,0,0] : COL_SHIP_COST;
  const need = [ship[0]+kitCost[0], ship[1]+kitCost[1], ship[2]+kitCost[2]+fuel];
  const shipTime = colBuilt() ? 0 : (COL_SHIP_COST[0]+COL_SHIP_COST[1]) / (2500*(1+dp.b.shipyard)*Math.pow(2,dp.b.nanite)*ecoSpeed()) * 3600;
  return {dp, kit, kitCost, colLoad, rest, n, tr, col, leg1, leg2, fuel, need, shipTime, target, wait:waitFor(dp, need)};
}
/** Verdict on a freshly colonized planet's size. */
/* Tant qu'on ignore le vaisseau, le trajet et les semaines de mines qu'il faut
   pour qu'une colonie produise, « amorti en moins d'un jour » est un slogan.
   Au-delà de cet horizon un niveau de mine n'est plus ce que la colonie a de
   plus pressé : elle commence à rendre ce qu'elle a coûté. */
const COLO_HORIZON_H = 7*24;
/**
 * Délai de retour d'une colonie, en heures, simulé au lieu d'être supposé :
 * construction du vaisseau, trajet, puis montée des mines au même classement
 * que pour une planète existante, et enfin le temps qu'il faut à sa production
 * pour rendre la mise de départ.
 * @param {number} [pos] position visée ; par défaut celle de la cible choisie
 * @returns {{hours:number, ramp:number, upfront:number, rate:number, b:object}|null}
 */
function colonyPayback(pos){
  const F = coloFleet();
  const p = pos || (parseC(F.target) || [])[2] || bestPosition();
  const P = POS[p]; if(!P) return null;
  const b = Object.assign(Object.fromEntries(Object.keys(B).map(k=>[k,0])), F.kit.lv);
  const colo = {coords:`1:1:${p}`, tmax:P.t, sats:0, b};
  const upfront = mse(...F.need);
  // Avant la première ressource : le vaisseau se construit, puis il vole.
  let h = (F.shipTime + (F.leg1 ? F.leg1.secs : 0)) / 3600;
  for(let step = 0; step < 200; step++){
    const pr = production(colo), rate = mse(pr.m, pr.c, pr.d);
    if(rate <= 0) return null;
    /* Au cours du ratio, pas au besoin de l'empire : cette simulation sert à
       comparer des POSITIONS entre elles, et une comparaison demande une règle
       fixe. Pondérer la montée par un mélange que cette colonie n'a pas encore
       changé mesurerait chaque position avec une règle différente — la plus
       froide gagnerait pour la seule raison qu'il manque du deutérium ailleurs. */
    const u = rankUpgrades(colo).sort((a,b) => a.payback - b.payback)
      .find(x => B[x.key] && x.payback < COLO_HORIZON_H);
    if(!u) break;
    // Elle paie son niveau suivant avec sa propre production, puis le monte.
    h += mse(...u.cost)/rate + u.time/3600;
    colo.b[u.key] = u.lvl;
    if(u.extraSolar) colo.b.solar += u.extraSolar;
  }
  const pr = production(colo), rate = mse(pr.m, pr.c, pr.d);
  if(rate <= 0) return null;
  return {hours: h + upfront/rate, ramp: h, upfront, rate, b:colo.b};
}
/** Le délai de retour d'une colonie, dit en une phrase, ou rien si incalculable. */
function coloPaybackTxt(){
  const cp = colonyPayback(); if(!cp) return '';
  return `Simulé : ${fmt(cp.upfront)} éq. de mise (vaisseau, kit, carburant), `
    + `${dur(cp.ramp*3600)} pour que ses mines montent toutes seules jusqu'à ${fmt(cp.rate)} éq./h, `
    + `et la mise est rendue en ${dur(cp.hours*3600)} en tout.`;
}
function coloVerdict(fields, pos){
  const P = POS[pos]; if(!P || !fields) return null;
  const avg = P.avg + (+S.colo.bonus||0), r = fields/avg;
  if(r >= 1) return {sev:'good', t:'Garde-la', why:`${fields} cases, au-dessus de la moyenne de la position ${pos} (${avg}).`};
  if(r >= .88) return {sev:'warn', t:'Correcte', why:`${fields} cases pour une moyenne de ${avg}. Garde-la si tu ne veux pas perdre de temps.`};
  return {sev:'bad', t:'Trop petite : recolonise', why:`${fields} cases pour une moyenne de ${avg}. Abandonne-la avant d'y construire et renvoie un vaisseau (coût ${fmt(COL_SHIP_COST[0])} M, ${fmt(COL_SHIP_COST[1])} C, ${fmt(COL_SHIP_COST[2])} D).`};
}
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
/* Les trois menus du haut se ressemblent et ne disent pas la même chose : le
   premier dit ce que le plan vise, les deux autres seulement quand la recherche
   et les formes de vie passent dans la journée. Rien à l'écran ne le disait, et
   on cherchait la recherche dans la priorité. Chaque menu porte donc, sous lui,
   ce que le choix en place fait vraiment — c'est la phrase, pas l'étiquette,
   qui répond à « c'est quoi ce réglage ». */
const AIDE_JOUR = {
  focus: {t:'Ce que le plan vise', v:{
    equi: 'Les paliers qui servent l\'économie et la flotte à la fois, et d\'abord les plafonds que tu touches tous les jours : expéditions, emplacements de flotte.',
    ecocol: 'Des mines, et une planète de plus dès qu\'Astrophysique l\'autorise : une colonie rapporte alors plus qu\'un niveau de recherche.',
    eco: 'Des mines, rien d\'autre : le plan ne colonise pas, et la recherche vise la production — Énergie, Laser, Ion, Plasma.',
    fleet: 'Combustion, Impulsion, Ordinateur, Hyperespace : de quoi faire voler plus d\'expéditions et de pillages. Le plan colonise encore.',
    raid: 'Espionnage, Combustion, Impulsion 5 et Ordinateur : voir les inactifs, y aller vite, en mener plusieurs à la fois. Pas de technologie de combat — l\'onglet Cibles ne pille que ce qui ne tire pas. Le plan colonise encore.',
  }},
  research: {t:'Place de la recherche', v:{
    normal: 'La recherche attend son tour : le plan n\'épargne pour elle que si la feuille de route la juge critique.',
    first: 'La prochaine recherche passe devant les chantiers : les bâtiments de la planète du labo attendent.',
  }},
  lf: {t:'Place des formes de vie', v:{
    after: 'Les formes de vie passent après les bâtiments, et s\'effacent devant un chantier proche.',
    first: 'Les formes de vie passent avant les bâtiments. La recherche garde sa place : réglée « Avant les bâtiments », elle est servie avant elles.',
    off: 'Le plan ne propose aucune forme de vie.',
  }},
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
const MASQUE_CLES = ['pub', 'bandeau', 'chat'];
const MASQUE_NOMS = {pub: 'Masquer la pub', bandeau: 'Masquer la bannière', chat: 'Masquer le chat'};
const MASQUE_NOTES = {
  pub: 'Bannières publicitaires et encarts promotionnels.',
  bandeau: 'La barre Gameforge en haut de page : compte, lobby, liens externes.',
  chat: 'La barre de chat et ses fenêtres repliées. Un nouveau message fait sortir une pastille dans le coin ; un clic dessus rouvre le chat jusqu\'à la page suivante.'
};
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
/** Les trois cases, telles que les Réglages les montrent. */
function masqueCases(prefixe){
  return MASQUE_CLES.map(k=>bascule(prefixe + k, `data-masque="${k}"`, MASQUE_NOMS[k], masque[k], MASQUE_NOTES[k])).join('');
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

/* ---------- la sécurité : réglages ---------- */
/** Réglages › Sécurité : coffres-forts, rappel de mise à l'abri, mission. */
function secuCard(){
  const c = secu(), J = ['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'];
  return `<div class="card"><h2>Sécurité et mise à l'abri</h2>
    <p class="note">Coffres-forts : les planètes où mettre ta flotte à l'abri. Le plan choisit le plus proche, même galaxie d'abord, jamais un coffre-fort attaqué.</p>
    <div class="chips">${S.planets.map(p=>`<label class="chip"><input type="checkbox" data-secu-vault="${esc(p.id)}" ${c.vaults.includes(p.id)?'checked':''}> ${esc(p.name)} <span class="note">${esc(p.coords||'')}</span></label>`).join('')}</div>
    <div class="grid mt-2">
      <label class="f">Heure du rappel<input type="time" data-secu="rappel" value="${esc(c.rappel)}"></label>
      <label class="f">Réveil = fin de nuit (heure)<input type="time" data-day="nightEnd" value="${hhmmDe(S.day.nightEnd)}"><span class="note">La même que « Nuit : à » du plan du jour.</span></label>
    </div>
    <div class="chips mt-2">${[1,2,3,4,5,6,0].map(j=>`<label class="chip"><input type="checkbox" data-secu-jour="${j}" ${c.jours.includes(j)?'checked':''}> ${J[j]}</label>`).join('')}</div>
    ${aide('secu', '<p class="note">À l\'heure du rappel, les jours cochés, l\'icône du Copilote affiche « FS » jusqu\'à ce que tu ouvres le plan de la nuit. Aucune notification. Heures en heure locale du navigateur.</p>')}
  </div>`;
}

/* ---------- la sécurité : le bloc ---------- */
/** Le tableau Source / Vaisseaux / Cible / Mission / M-C-D, sa ligne d'arrivée et « Préparer ». */
function transportHtml(t){
  if(!t) return '';
  const url = fleetUrl({dest: t.dest.coords, mission: t.mission, ships: t.ships, p: t.pi});
  const chips = copyChips({res: t.charge});
  return `<table class="fs-tab"><thead><tr><th>Source</th><th>Vaisseaux</th><th>Cible</th><th>Mission</th><th>M / C / D</th></tr></thead>
    <tbody><tr><td>${esc(t.p.name)}</td><td>${esc(shipCourt(t.ships))}</td><td>${esc(t.dest.name)}</td><td>${t.missionNom}</td><td class="mono">${mcd(t.charge)}</td></tr></tbody></table>
    <p class="note">Arrivée ${formatTime(t.arrivee)} à ${t.pct} %${t.retour ? ` · retour ${formatTime(t.retour)}` : ''} · ${fmt(t.fuel)} deutérium · ${esc(t.pourquoi)}${t.note ? ' ' + esc(t.note) : ''}${t.gt ? ` Il faut ${fmtLigne(t.gt)} GT pour tout lever.` : ''}</p>
    ${url ? `<div class="row"><button class="btn sm primary" data-prep="${esc(url)}">Préparer</button><span class="note">Ouvre le formulaire du jeu avec vaisseaux, cible et mission. Ressources et vitesse à régler, l'envoi reste ton clic.</span></div>` : ''}${chips}`;
}

/** Une flotte en vol, en une ligne. */
function mouvementLigne(v){
  const camp = v.hostile ? '<span class="pill bad">Hostile</span>' : v.camp === 'neutral' ? '<span class="pill info">Autre joueur</span>' : '';
  const nom = OG_MISSIONS[v.mission] || `mission ${v.mission}`;
  const carg = v.cargaison && v.cargaison.some(x => x > 0) ? ` · ${mcd(v.cargaison)}` : '';
  return `<li>${camp}<span class="what">${esc(majus(nom))} ${v.sens === 'retour' ? '(retour)' : ''} · ${esc(v.origine.nom || v.origine.coords)} → ${esc(v.cible.nom || v.cible.coords)}</span><span class="why">Arrivée ${formatTime(v.arrivee)}${v.retour ? `, retour ${formatTime(v.retour)}` : ''} · ${esc(shipCourt(v.vaisseaux))}${carg}</span></li>`;
}

/** Le compte à rebours, « 1 h 02 min 05 s », relu chaque seconde. */
function rebours(ms){ const s = Math.max(0, Math.round((ms - Date.now()) / 1000)); return clock(s); }
function majRebours(){
  try{ document.querySelectorAll('[data-impact]').forEach(el => { el.textContent = rebours(+el.dataset.impact); }); }catch(e){}
}

/**
 * Le bloc Sécurité d'Aujourd'hui : l'alerte d'attaque en tête, l'espionnage,
 * le plan de la nuit, et les flottes en vol.
 * @returns {{alerte:string, bloc:string, sum:string}}
 */
function securiteHtml(acts){
  const now = Date.now();
  const att = planSecurite('attaque', now, acts), esp = espionnagesEntrants(now);
  const alerte = att.map(a => `<div class="card secu-crit"><h2><span class="pill bad">Critique</span> Attaque sur ${esc(a.p.name)} <span class="mono" data-impact="${a.impact}">${rebours(a.impact)}</span></h2>
    <p class="note">Impact ${formatTime(a.impact)}${a.groupee ? ' · attaque groupée' : ''}${a.nb > 1 ? ` · ${a.nb} flottes` : ''}.</p>
    <h3>Ressources exposées</h3><p class="mono">${mcd(a.expose)}</p>
    <h3>Constructions à lancer pour dépenser</h3>${a.depenses.length ? `<ul class="advice">${a.depenses.map(d => `<li><span class="pill good">Finançable maintenant</span><span class="what">${esc(d.what)}</span><span class="why">${costHtml(d.cost)}</span></li>`).join('')}</ul>` : '<p class="note">Rien de finançable avec le stock présent.</p>'}
    <h3>Vaisseaux à mettre à l'abri</h3>${a.transport ? transportHtml(a.transport) : `<p class="note">${Object.keys(aQuai(a.p)).length ? 'Aucune destination : il faut une autre planète.' : 'Aucun vaisseau à quai.'}</p>`}
    ${a.aRisque.length ? `<h3>Convois entrants à risque</h3><ul class="advice">${a.aRisque.map(v => `<li><span class="pill warn">À rappeler ou à laisser</span>${mouvementLigne(v).replace(/^<li>|<\/li>$/g, '')}</li>`).join('')}</ul><p class="note">Ils arrivent entre maintenant et dix minutes après l'impact. La décision te revient.</p>` : ''}
  </div>`).join('') + esp.map(e => `<div class="card"><p><span class="pill warn">Important</span> Espionnage en cours sur ${esc(e.p.name)}, attaque possible <span class="note">(arrivée ${formatTime(e.v.arrivee)})</span>.</p></div>`).join('');

  const r = planSecurite('routine', now, acts), on = fsRappelActif();
  const ligne = x => {
    const parts = [];
    parts.push(`<li><span class="what">${esc(x.p.name)}${x.coffre ? ' <span class="pill info">coffre-fort</span>' : ''}</span><span class="why">Exposé ${mcd(x.expose)} · à quai ${esc(shipCourt(x.aQuai))}</span></li>`);
    for(const f of x.files) parts.push(`<li><span class="pill warn">File libre</span><span class="what">${f.file} · ${f.libre <= now ? 'vide maintenant' : `se vide à ${formatTime(f.libre)}`}</span><span class="why">${f.lance ? `À lancer : ${esc(f.lance)}` : 'Rien de finançable à y mettre.'}</span></li>`);
    for(const v of x.nuit) parts.push(`<li><span class="pill info">Convoi de nuit</span>${mouvementLigne(v).replace(/^<li>|<\/li>$/g, '')}</li>`);
    return `<ul class="advice">${parts.join('')}</ul>${x.transport ? transportHtml(x.transport) : ''}`;
  };
  const w = r[0] ? r[0].wake : null;
  const routine = `<details class="card${on ? ' secu-on' : ''}"${on ? ' open' : fold('secu', false)}><summary data-fold="secu" data-fsvu="1">Plan de la nuit ${on ? '<span class="pill warn">Rappel</span>' : ''}<span class="note">${w ? `réveil ${formatTime(w)}` : ''}</span></summary>
    <p class="note">Rappel ${esc(secu().rappel)} · réveil ${esc(secu().reveil)} · ${secu().vaults.length ? 'coffres-forts : ' + secu().vaults.map(id => esc((planetById(id)||{}).name || '')).join(', ') : 'aucun coffre-fort déclaré'} <button class="btn sm ghost" data-goto="settings:defense">Modifier</button></p>
    ${r.map(ligne).join('')}</details>`;
  const mv = mouvements().filter(v => v.arrivee > now);
  const vol = `<details class="card"${fold('vols', false)}><summary data-fold="vols">Flottes en vol <span class="note">${mv.length}</span></summary>${mv.length ? `<ul class="advice">${mv.map(mouvementLigne).join('')}</ul>` : '<p class="note">Aucune flotte en vol vue. Ouvre l\'encart des événements ou la page Mouvements de flotte : le copilote ne lit que ce que le jeu affiche.</p>'}</details>`;
  /* Pour l'onglet : chaque attaque est critique, chaque espionnage important. */
  const items = att.map(a => ({sev:'bad', key:`Attaque sur ${a.p.name} ${a.impact}`})).concat(esp.map(e => ({sev:'warn', key:`Espionnage ${e.p.name}`})));
  return {alerte, bloc: routine + vol, items, rappel: on};
}
/* ---------- daily missions ---------- */
/**
 * Pastilles des réglages : une espèce lue sur une planète s'affiche sans case,
 * les autres restent à cocher.
 * @returns {string}
 */
function lfSettingsHtml(){
  const lues = readLifeforms();
  return Object.entries(LIFEFORMS).map(([k,l]) => lues.includes(k)
    ? `<span class="pill good choix"><input type="checkbox" checked disabled class="w-auto mr-2">${l.n} · lue sur tes planètes</span>`
    : `<label class="pill ${S.lf.found.includes(k)?'good':'info'} choix"><input type="checkbox" data-lf="${k}" ${S.lf.found.includes(k)?'checked':''} class="w-auto mr-2">${l.n}</label>`).join('');
}
/** La carte de calibrage, ou rien. */
function expoCalibHtml(){
  const p = expoFretPropose(S.expoLog, S.settings.expoFret);
  if(!p.montre) return '';
  return `<div class="card" data-ck="expo-calib"><h2>Facteur de fret calibré</h2>
    <p>Tes ${p.n} dernières expéditions à ressources suggèrent un facteur de <b>${fmt(p.prop)}</b> (réglage actuel : ${fmt(p.cur)}).</p>
    ${p.pleines ? `<p class="note">⚠ Plus de la moitié de ces soutes sont revenues pleines : ${fmt(p.prop)} est une <b>borne basse</b>, le vrai gain est peut-être plus haut.</p>` : ''}
    <p class="note">Médiane de (ressources ramenées ÷ points envoyés ÷ vitesse éco), sur les ${EXPO_STATS_N} dernières au plus. Rien ne change sans ton clic.</p>
    <span class="btns"><button class="btn sm primary" data-fretapply="${p.prop}">Appliquer</button><button class="btn sm" data-fretignore="${p.prop}">Ignorer</button></span>
  </div>`;
}
/** Le bloc « Expéditions : résultats ». */
function expoStatsHtml(){
  const st = expoStats(S.expoLog);
  if(!st.n) return `<div class="card"><h2>Expéditions : résultats</h2><p class="note">Aucun retour d'expédition lu pour l'instant. Le copilote les enregistre quand tu ouvres la vue d'ensemble ou les mouvements de flotte pendant le vol retour, et lit le type d'événement des rapports que tu ouvres dans ta messagerie.</p></div>`;
  const r = (S.settings.ratio || [3,2,1]).join(' / ');
  const rend = x => x == null ? '–' : `${fmt(x)}/h`;
  const evts = Object.entries(st.evts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${esc(EXPO_EVTS[k]||k)} ${Math.round(100*v/st.n)} %`).join(' · ');
  const ligne = (nom, a) => `<tr><td>${nom}</td><td class="n">${a.n}</td><td class="n">${fmt(a.res[0])} / ${fmt(a.res[1])} / ${fmt(a.res[2])}</td><td class="n">${rend(a.rendement)}</td></tr>`;
  const pl = Object.entries(st.parPlanete).map(([c,a]) => { const p = planeteEn(c); return ligne(p ? esc(planetRef(p)) : `<span class="mono">${esc(c)}</span>`, a); }).join('');
  const so = Object.entries(st.parSollicitation).sort((a,b)=>a[0]-b[0]).map(([k,a]) => ligne(+k >= 3 ? '3 ou plus' : +k === 0 ? 'aucune' : `${k}`, a)).join('');
  const tete = `<thead><tr><th></th><th class="n">Exp.</th><th class="n">M / C / D moyens</th><th class="n">Rendement</th></tr></thead>`;
  return `<div class="card"><h2>Expéditions : résultats</h2>
    <p class="note">Sur <b>${st.n} expédition${st.n>1?'s':''}</b> au résultat connu (les ${EXPO_STATS_N} dernières au plus).</p>
    <div class="res">
      ${gauge('m','m','Métal moyen',fmt(st.res[0]))}${gauge('c','c','Cristal moyen',fmt(st.res[1]))}${gauge('d','d','Deut. moyen',fmt(st.res[2]))}
      ${gauge('e','e','Soute utilisée', st.soute == null ? '–' : `${Math.round(st.soute*100)} %`, st.nSoute ? `sur ${st.nSoute} envois connus` : 'envoi inconnu')}
    </div>
    <p>Événements : ${evts}</p>
    <p>Vaisseaux trouvés : <b>${st.trouves == null ? '–' : fmt(st.trouves)}</b> en moyenne · pertes : <b>${st.pertes == null ? '–' : fmt(st.pertes)}</b> en moyenne <span class="note">(coût de construction M+C+D, sur ${st.nSus} expédition${st.nSus>1?'s':''} à l'envoi connu)</span></p>
    <p>Rendement : <b>${rend(st.rendement)}</b> en équivalent métal (ratio ${esc(r)}), ressources et vaisseaux trouvés moins carburant et pertes, par heure de mission.</p>
    <h3>Par planète de départ</h3><div class="tbl-wrap"><table>${tete}<tbody>${pl}</tbody></table></div>
    <h3>Selon les expéditions vers le même système dans les 24 h précédentes</h3><div class="tbl-wrap"><table>${tete}<tbody>${so}</tbody></table></div>
    <p class="note"><b>Estimation.</b> Carburant et durée supposent un vol à 100 % de vitesse. Sans aller vu ni composition préparée, les vaisseaux trouvés et perdus restent inconnus. Le type d'événement vient du rapport quand tu l'as ouvert, sinon des mouvements.</p>
  </div>`;
}

/**
 * Le bloc Expéditions : combien d'emplacements sont pris, quand le prochain se
 * libère, et pour chacun de ceux qui sont libres d'où partir et avec quoi.
 *
 * Le bouton Préparer ouvre le formulaire du jeu avec la planète, les
 * vaisseaux, la destination et la mission déjà posés — c'est ce que la page
 * Galaxie du jeu fait elle-même avec ses propres liens. L'envoi reste un clic
 * du joueur : le copilote ne clique jamais à sa place.
 *
 * La durée d'exploration, elle, s'annonce comme ce que le plan VISE, et non
 * comme un champ que le lien aurait rempli. Les champs existent bien sur la
 * page de flotte — `expeditiontime`, `holdingtime` — mais sur une page ouverte
 * par un lien qui porte déjà la mission, l'état interne du jeu garde une durée
 * à zéro pendant que le menu affiche 1, et c'est lui qui part dans la requête.
 * Promettre un réglage qui n'a pas pris, c'est faire envoyer une expédition
 * d'une heure quand le joueur en voulait quatre — ou pire, lui faire cliquer
 * sur un envoi que le jeu refuse. La forme exacte du lien est l'affaire de
 * `fleetUrl` : ce bloc l'appelle et héritera de sa correction.
 * @returns {{sum:string, html:string}} le résumé du titre replié, et le corps
 */
function expoHtml(){
  const now = Date.now(), e = expoEtat(now);
  if(!S.tech.astro) return {sum:'Astrophysique 1 les débloque',
    html:'<p class="note">Aucune expédition avant <b>Astrophysique 1</b>.</p>'};
  const quand = e.prochain ? `Prochain retour dans ${dur((e.prochain-now)/1000)}` : '';
  const etat = e.flotteBloquee ? `Emplacements de flotte pleins (${e.fs[0]}/${e.fs[1]})`
    : !e.libres ? (quand || 'Tous les emplacements sont pris')
    : 'Prête maintenant';
  const bon = e.lancables > 0;
  const parts = [`<p class="note">Emplacements : <b>${e.pris} utilisé${e.pris>1?'s':''} / ${e.max} disponible${e.max>1?'s':''}</b> · <span class="pill ${bon?'good':'info'}">${esc(etat)}</span>${bon && quand ? ` ${esc(quand)}` : ''}</p>`];

  if(e.flotteBloquee) parts.push(`<p class="note">Chaque mission en vol, découvertes comprises, prend un emplacement de flotte : le jeu refuse le départ tant qu'aucune ne rentre. Technologie Ordinateur ${S.tech.computer+1} en ajoute un.</p>`);
  else if(!e.libres) parts.push('<p class="note">Rien à lancer : le jeu refuse une expédition de plus tant qu\'un emplacement ne se libère pas.</p>');

  const props = e.lancables > 0 ? expoPropose(now, e.lancables) : [];
  if(e.lancables > 0 && !props.length) parts.push('<p class="note">Aucune planète ne peut composer une expédition : il faut au moins un transporteur au sol, hors réserve.</p>');

  const ligne = x => {
    const url = fleetUrl({dest:x.tgt, mission:FS_MISSION.expedition, ships:x.f.ships, p:x.i});
    /* « Lancé » pose le minuteur du retour et débite le carburant, comme le
       faisait la carte du plan. C'est la seule façon pour le panneau de savoir
       qu'un emplacement vient d'être pris quand le joueur n'ouvre pas la page
       des mouvements de flotte. */
    const lance = {kind:'expo', pid:x.p.id, ships:x.f.ships, cost:[0,0,x.fuel],
      dur:Math.round(2*x.fl.secs + x.heures*3600), what:`Expédition depuis ${planetRef(x.p)}`};
    const ennuis = [];
    if(!x.f.plein) ennuis.push(`plafond non atteint : ${fmt(x.f.pts)} points sur ${fmt(x.f.ptsCap)}, il manque des vaisseaux au sol`);
    if(!x.deut) ennuis.push(`deutérium trop juste : ${fmt(x.fuel)} demandés pour l'aller-retour`);
    const alts = x.alts.map(a=>`${esc(planetRef(a.p))} (${fmt(a.f.pts)} pts, soute ${fmt(a.f.cargo)})`).join(', ');
    return `<li class="task" data-ck="expo:${esc(x.p.id)}">
      <div>
        <div class="q">${qHtml('Expédition · '+planetRef(x.p))}</div>
        <div class="w">${esc(shipList(x.f.ships))}</div>
      </div>
      <span class="btns">${url ? `<button class="btn sm primary" data-prep="${esc(url)}" data-expoprep="${esc(JSON.stringify({de:x.p.coords, dest:x.tgt, ships:x.f.ships}))}">Préparer</button>` : ''}<button class="btn sm" data-launch='${esc(JSON.stringify(lance))}'>Lancé</button></span>
      <div class="m"><span>vers ${coordLink(x.tgt)}</span><span>exploration visée ${x.heures} h</span><span>retour vers ${formatTime(x.retour)}</span></div>
      <div class="m"><span>${fmt(x.f.pts)} / ${fmt(x.f.ptsCap)} points</span><span>fret ${fmt(x.f.cargo)} pour ${fmt(x.f.fret)} visés</span><span>carburant ${fmt(x.fuel)} deutérium</span></div>
      ${ennuis.length ? `<div class="m">⚠ ${esc(ennuis.join(' · '))}</div>` : ''}
      ${x.pourquoi.length ? `<div class="m">${esc(x.pourquoi.join(' · '))}</div>` : ''}
      ${alts ? `<div class="m">Sinon ${alts}</div>` : ''}
    </li>`;
  };
  /* Une expédition n'est jamais une urgence : elle se range à la limite comme
     un conseil. */
  if(props.length) parts.push(cartesMenu('expeditions') + listeCartes('expeditions', props.map(x=>({html: ligne(x), crit: false})), 'acts'));
  /* La durée, le fret et la réserve se règlent ailleurs : le dire ici évite
     de chercher, et rappelle que ces chiffres sont des réglages, pas des lois
     du jeu. */
  parts.push(`<p class="note">L'envoi reste à toi : Préparer ouvre le formulaire du jeu avec la planète, les vaisseaux, la destination et la mission, et <b>la durée d'exploration est à choisir dans le jeu</b>. Plafond de points calé sur le n°1 de l'univers (${esc(EXPO_LABELS[top1Tier()])}) : <b>${fmt(expoPts())}</b>. Facteur de fret ${fmt(num(S.settings.expoFret, EXPO_FRET))} ressources par point, réserve de ${fmt(expoRes(null))} grands transporteurs par planète, durée par défaut ${Math.max(1, Math.round(num(S.settings.expoHold,1)))} h — tout cela se change dans <b>Outils › Flotte</b>.</p>`);
  const sum = `${e.pris}/${e.max} · ${etat}`;
  return {sum, html: parts.join(''), n: props.length};
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

/* ---------- targets from the official OGame API ---------- */
function sysDiff(a, b){ let d = Math.abs(a-b); const sv = API && API.server; if(sv && sv.donutSystem) d = Math.min(d, sv.systems - d); return d; }
function wrapSys(x){ const n = (API && API.server && API.server.systems) || 499; return ((x-1)%n+n)%n+1; }
let _occ = null, _occKey = null;
function occupied(){ const k = API && API.at && API.at.universe; if(_occKey!==k){ _occ = new Map((API.planets||[]).map(([c,pl])=>[c,pl])); _occKey = k; } return _occ; }
function myScore(){ return S.me && API && API.scores && API.scores[S.me] ? API.scores[S.me][0] : null; }
function isInactive(st){ return /[iI]/.test(st||'') && !/[vb]/.test(st||''); }
function isActive(st){ return !/[iIvb]/.test(st||''); }
/** Free colony slots near home, ranked by position value, distance and neighbourhood. */
function colonyCandidates(){
  if(!API || !API.planets) return [];
  const home = parseC(coloFrom().coords); if(!home) return [];
  const occ = occupied(), me = myScore() || 0, R = 15;
  const posScore = {}; rankPositions().forEach(r=>posScore[r.pos]=r);
  const maxScore = Math.max(...Object.values(posScore).map(r=>r.score), 1e-9);
  const out = [];
  for(let d=-R; d<=R; d++){
    const sys = wrapSys(home[1]+d), neigh = {strong:0, active:0, inactive:0};
    for(let q=1;q<=15;q++){ const pl = occ.get(`${home[0]}:${sys}:${q}`); if(!pl || pl===S.me) continue; const P = API.players[pl]||['','']; const sc = (API.scores[pl]||[0])[0]; if(isInactive(P[1])) neigh.inactive++; else if(isActive(P[1])){ neigh.active++; if(sc > Math.max(me*5, 10000)) neigh.strong++; } }
    for(let pos=1; pos<=15; pos++){
      const r = posScore[pos]; if(!r || !r.ok) continue;
      const coords = `${home[0]}:${sys}:${pos}`; if(occ.has(coords)) continue;
      const dist = Math.abs(d), score = .75*r.score/maxScore + .25*(1-dist/R) - .04*neigh.strong + .02*Math.min(neigh.inactive,3);
      out.push({coords, pos, dist, fields:r.fields, bonus:r.P.bonus, v:r.v, neigh, score});
    }
  }
  return out.sort((a,b)=>b.score-a.score);
}
/* Le tableau des positions libres sert deux onglets : Cibles le montre parmi
   les cibles, Colonie en a besoin pour que « choisir la position » désigne une
   case qui existe. Le classement théorique des quinze positions ne dit que ce
   que vaudrait la case ; seul l'univers téléchargé dit laquelle est libre, et
   renvoyer le joueur dans Galaxie pour le vérifier à la main, c'était lui
   laisser le seul travail que le copilote sait faire. */
function coloCandHtml(){
  if(!API || !API.planets) return `<p class="note">La liste des planètes de l'univers n'est pas encore téléchargée${API && API.error ? ` (${esc(API.error)})` : ''}. Ouvre le jeu une fois : le copilote la récupère, puis classe ici les positions libres autour de toi.</p>`;
  const cand = colonyCandidates().slice(0,8), tgt = coloTarget(), home = coloFrom().coords;
  if(!cand.length) return '<p class="note">Aucune position libre trouvée à proximité.</p>';
  return `<div class="tbl-wrap"><table><thead><tr><th>#</th><th>Coordonnées</th><th>Cases</th><th>Bonus</th><th class="n">Éq. métal/h</th><th class="n">Vol</th><th>Voisins</th><th></th></tr></thead><tbody>${cand.map((c,i)=>{ const f = flight(home, c.coords, {col:1}, 100); return `<tr><td class="rank">${i<3?i+1:''}</td><td class="mono">${c.coords}</td><td class="mono">~${c.fields}</td><td>${c.bonus?`<span class="pill ${/métal/.test(c.bonus)?'info':'good'}">${c.bonus}</span>`:''}</td><td class="n">${fmt(c.v)}</td><td class="n">${f?dur(f.secs):'–'}</td><td class="note">${c.neigh.strong?`<span class="pill warn">${c.neigh.strong} fort${c.neigh.strong>1?'s':''}</span> `:''}${c.neigh.active} actif${c.neigh.active>1?'s':''}${c.neigh.inactive?` · ${c.neigh.inactive} inactif${c.neigh.inactive>1?'s':''}`:''}</td><td><button class="btn sm ${c.coords===tgt?'primary':''}" data-cotarget="${c.coords}">${c.coords===tgt?'Choisie':'Choisir'}</button></td></tr>`; }).join('')}</tbody></table></div><p class="note">Positions <b>libres</b> accessibles avec ton Astrophysique, à 15 systèmes au plus. Classement : valeur de la position (${esc((OBJECTIVES[S.colo.objective]||OBJECTIVES.balanced).n.toLowerCase())}), distance, puis voisinage (moins de joueurs forts, des inactifs à piller). Production simulée avec les mines de ta planète de départ.</p>`;
}
/** Inactive planets near home, attackable first, then the ones that would trigger the outlaw warning. */
function raidTargets(){
  if(!API || !API.planets || !API.players) return [];
  const home = parseC(coloFrom().coords); if(!home) return [];
  /* Le statut hors-la-loi appartient à la protection débutant, et la page
     Outlaw du wiki dit où elle s'arrête : « the status has no effect after
     500,000 points ». Passé ce score, écarter les inactifs plus forts ne
     protège plus de rien — ça ne fait que cacher les cibles les plus
     riches, c'est-à-dire exactement celles qu'on cherche. */
  const me = myScore(), risque = me != null && me < 5e5, out = [];
  for(const [coords, pl] of API.planets){
    const c = parseC(coords); if(!c || c[0]!==home[0]) continue;
    const P = API.players[pl]; if(!P || !isInactive(P[1])) continue;
    const dist = sysDiff(c[1], home[1]); if(dist>30) continue;
    const sc = (API.scores && API.scores[pl] || [0])[0], outlaw = risque && sc > me;
    out.push({coords, name:P[0], status:P[1], score:sc, dist, outlaw, longInactive:/I/.test(P[1]), value: sc*(/I/.test(P[1])?1.3:1)/(1+dist/8)});
  }
  return out.sort((a,b)=>(a.outlaw-b.outlaw) || (b.value-a.value));
}
/** Nearby systems ranked by how many positions were not explored in the last week. */
function exploreSystems(){
  const home = parseC(coloFrom().coords); if(!home) return [];
  const ex = S.explored || {}, now = Date.now(), out = [];
  for(let d=0; d<=6; d++) for(const sgn of d ? [-1,1] : [1]){
    const sys = wrapSys(home[1]+sgn*d); let left = 0;
    for(let q=1;q<=15;q++){ const t = ex[`${home[0]}:${sys}:${q}`]; if(!t || now-t > 7*864e5) left++; }
    out.push({sys:`${home[0]}:${sys}`, left, dist:d});
  }
  return out.filter(x=>x.left>0).slice(0,6);
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

/* ---------- le tir de lune ---------- */

/* Un tir de lune se chiffre avant de partir, et il se chiffre exactement : la
   chance est linéaire en débris, donc 1 % coûte le même poids de vaisseaux que
   le tir soit gros ou petit. Les débris valent 30 % du métal et du cristal des
   vaisseaux détruits — jamais le deutérium, et la défense détruite n'en produit
   aucun. Chaque 100 000 de débris donne 1 % de chance, jusqu'à 20 % à 2 M.

   Le plancher est dur, et c'est la règle, pas une prudence de notre part :
   « Any time a large battle occurs leaving more than 100k debris behind, the
   owner of the planet where the battle took place receives a moonchance »
   (wiki/Moonchance). Sous 100 000, le combat ne tire rien du tout.

   Le taux de débris, lui, est un réglage d'univers : le wiki donne des univers
   à 30, 40, 50, 60 et 70 %, et à 70 % il faut 715 chasseurs légers au lieu de
   1 667. Le coder en dur surestimerait la facture jusqu'à 2,3 fois, ce qu'aucune
   note ne rattrape — d'où le `df`, en pourcent, que la carte demande au joueur.

   L'arithmétique reste entière : `pct * 1e7 / (df * v)` plutôt que de passer
   par `df / 100`, qui n'est pas exact en binaire et ferait monter un plafond
   d'une unité au mauvais moment. */

/** La coque d'un vaisseau : son métal plus son cristal. Les seize lignes du
    wiki le vérifient sans exception, donc aucune table ne la porte. */
function luneCoque(k){ const c = SHIP_COST[k] || [0, 0, 0]; return c[0] + c[1]; }

/** Ce qu'un tir de `n` vaisseaux `k` laisse derrière lui, et ce qu'il vaut. */
function luneTir(k, n, df = LUNE_DF){
  const v = luneCoque(k), debris = df * Math.max(0, n) * v / 100;
  /* « more than 100k debris » : 100 000 pile ne donne rien. Le plafond, lui,
     est atteint à 2 M pile — le tableau du wiki y pose 5 000 sondes. */
  return {v, debris, chance: debris <= 1e5 ? 0 : Math.min(20, debris / 1e5)};
}

/** Le nombre de vaisseaux `k` qu'il faut faire mourir pour viser `pct`. */
function luneVaisseaux(k, pct, df = LUNE_DF){
  const v = luneCoque(k);
  if(!v) return 0;
  let n = Math.ceil(Math.min(20, Math.max(1, pct)) * 1e7 / (df * v));
  /* Tomber pile sur 100 000 ne donne rien : il en faut un de plus. */
  if(df * n * v / 100 <= 1e5) n++;
  return n;
}

/** Ce qu'une lune coûte en espérance, et ce que le recyclage des tirs ratés
    rend. Le tir qui réussit consomme son champ de débris, d'où `tirs - 1`.
    Elle refait le tir elle-même : une chance et un nombre de vaisseaux passés
    séparément pourraient ne pas parler du même tir. */
function luneFacture(k, n, df = LUNE_DF){
  const t = luneTir(k, n, df);
  if(!t.chance) return null;
  const tirs = Math.ceil(100 / t.chance), c = SHIP_COST[k] || [0, 0, 0];
  return {chance: t.chance, tirs, m: tirs * n * c[0], c: tirs * n * c[1],
          deut: tirs * n * c[2], recupere: (tirs - 1) * t.debris};
}

/** Ce que la flotte posée sur une planète vaut en métal et en cristal, pour
    l'avertissement : elle mourrait avec le tir, et à la charge du joueur.
    `null` quand la flotte n'a jamais été relevée — un zéro inventé ferait
    passer pour sûr un tir qui coûte des millions. */
function luneFlotteAuSol(p){
  const sh = (p || {}).ships;
  if(!sh) return null;
  let m = 0, c = 0;
  for(const k of Object.keys(SHIPS)){
    const n = Math.max(0, sh[k] || 0), cost = SHIP_COST[k] || [0, 0, 0];
    m += n * cost[0];
    c += n * cost[1];
  }
  return {m, c};
}

/** La planète que la carte Lune vise : celle que le joueur a choisie, sinon
    son centre, sinon la première. */
function moonPlanete(){
  return planetById(S.moonCalc.pid)
      || (centreIndex() >= 0 ? S.planets[centreIndex()] : null)
      || S.planets[0];
}

/** Le niveau de Bouclier du camarade. Par défaut celui du joueur : un camarade
    de guilde est d'ordinaire comparable, et un chiffre demandé vaut mieux
    qu'une hypothèse muette. */
function moonBou(){
  const b = S.moonCalc.bou;
  return b == null ? Math.max(0, S.tech.shielding || 0) : Math.max(0, +b || 0);
}

/** Le taux de débris de l'univers, en pourcent. Le serveur le publie, donc
    c'est lui qui tranche : le réglage manuel ne sert plus qu'en secours, hors
    extension ou avant la première réponse de l'API. Il reste dans S.settings à
    côté des vitesses, et passe ainsi d'un poste à l'autre par la synchro. */
function moonDf(){ const d = srv('debrisFactor', null); return d != null ? Math.max(1, d*100) : Math.max(1, +(S.settings.debris) || LUNE_DF); }

/** Le vaisseau choisi, ramené à un vaisseau qui existe. */
function moonShip(){ return SHIPS[S.moonCalc.ship] ? S.moonCalc.ship : 'lf'; }

/** Le nom du vaisseau au bon nombre, avec les tables qui l'écrivent déjà. */
function moonNom(k, n){ return n > 1 ? SHIP_PLURAL[k] : (SHIPS[k] || {n:''}).n.toLowerCase(); }

/** Ce qui meurt vraiment d'un envoi de `n` vaisseaux `k` sur la planète `p` :
    les survivants rentrent chez l'attaquant et ne font pas de débris. `tues`
    vaut `null` quand la défense n'a jamais été relevée — on suppose alors que
    tout meurt, et l'appelant le dit plutôt que d'inventer un plafond.

    La carte Lune passe par ici : c'est la combinaison qui décide de la
    chance, et elle n'avait pas à vivre en ligne dans un rafraîchissement
    d'affichage. */
function luneMorts(p, k, n, bouLvl = 0){
  const d = luneDefense(p, k, bouLvl), v = luneCoque(k);
  const tues = d && v ? Math.floor(d.tue / v) : null;
  return {tues, morts: tues == null ? n : Math.min(n, tues)};
}

/** Une chance en pourcent, lisible : un chiffre après la virgule sous 10 %. */
function moonPct(x){
  return String(x >= 10 ? Math.round(x) : Math.round(x * 10) / 10).replace('.', ',') + ' %';
}

/** Ce que la défense d'une planète tue en six manches, en métal+cristal, donc
    directement comparable à ce qu'un tir fait mourir. C'est le seul chiffre
    estimé de la carte Lune, et la note le nomme comme tel.

    Deux écarts assumés, qui tirent en sens contraires. La règle d'explosion
    n'est pas comptée — dès que la coque passe sous 70 %, chaque tir reçu a une
    chance de faire sauter la pièce, ce qui tue plus vite que la somme des
    dégâts : on sous-estime. Le rebond non plus — un tir sous 1 % du bouclier
    de la cible ne fait rien : on surestime, mais sans portée ici, où le plus
    faible des tirs vaut 80 contre des boucliers de 10 à 700.

    Les clés se lisent sur DEF, jamais sur p.defs : une clé venue du stockage
    ne doit pas pouvoir compter. Et p.defs == null veut dire « jamais relevée »,
    jamais zéro — on passe par defsOf lui-même, qui sait aussi lire l'ancienne
    forme où seul p.def existe, et pour la même raison : annoncer
    qu'une défense inconnue tue mille chasseurs ferait brûler une flotte.

    Le +5 % par niveau d'Armes et de Bouclier vient du wiki, pas de la revue. */
function luneDefense(p, k, bouLvl = 0){
  const have = p && defsOf(p);
  if(!have) return null;
  let brut = 0, tirs = 0;
  for(const j of Object.keys(DEF)){
    const n = Math.max(0, have[j] || 0);
    brut += n * DEF[j].a;
    tirs += n;
  }
  const puissance = brut * (1 + .05 * Math.max(0, S.tech.weapons || 0));
  const bou = ((SHIPS[k] || {}).bou || 0) * (1 + .05 * Math.max(0, bouLvl));
  return {puissance, tirs, tue: Math.max(0, 6 * puissance - 6 * tirs * bou)};
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

/* ---------- le vocabulaire d'un rapport d'espionnage ---------- */
/* Relevé sur un rapport du jeu le 18 novembre 2026 (test/rapports/README.md).
   Deux choses s'y voient qu'on ne devinerait pas : le jeu écrit tous les titres
   de section, même celles qu'il n'a pas pu lire, et il avoue l'absence par une
   phrase plutôt que par un vide. L'inconnu se reconnaît donc à ce qui est
   écrit, pas à ce qui manque. Et son apostrophe est un accent grave. */
const REPORT_RIEN = 'aucune donnee fiable';
/**
 * Forme comparable d'un libellé : minuscules, sans accent, apostrophes
 * ramenées à une seule, espaces tassés. Sans ça « Défense » et « defense »
 * seraient deux sections différentes, et l'accent grave du jeu ferait rater
 * « sonde d'espionnage ».
 * @param {string} s
 * @returns {string}
 */
function repKey(s){
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[`’']/g, "'").replace(/\s+/g, ' ').trim().replace(/\s*:$/, '');
}
/* Les titres connus. Ceux qui valent 'skip' sont lus et jetés : sans eux, les
   lignes d'un bâtiment tomberaient dans la défense qui précède et la rendraient
   inconnue pour rien. Un titre qu'on ne connaît pas n'en est pas un — il compte
   comme une ligne non reconnue, donc il rend sa section inconnue, ce qui est le
   sens prudent. */
const REPORT_HEADS = {
  'ressources':'res', 'flottes':'fleet', 'defense':'def',
  'reparations en cours':'skip', 'batiment':'skip', 'batiments':'skip',
  'batiments des formes de vie':'skip', 'recherche':'skip',
  'recherche des formes de vie':'skip', 'commentaires':'skip'
};
/* Chaque libellé que le rapport peut porter, vers sa clé. Les noms viennent des
   tables déjà relevées sur le jeu plutôt que d'être recopiés ; seul ce qu'elles
   ne nomment pas s'ajoute à la main. */
const REPORT_WORDS = {};
{
  const add = (k, ...noms) => { for(const n of noms) if(n) REPORT_WORDS[repKey(n)] = k; };
  for(const k of Object.keys(SHIPS)) add(k, SHIPS[k].n, SHIP_PLURAL[k], SHIP_ONE[k]);
  for(const k of Object.keys(DEF)) add(k, DEF[k].n, DEF[k].o, DEF[k].p);
  add('sat', 'Satellite solaire', 'Satellites solaires');
  add('crawl', 'Foreuse', 'Foreuses');
  add('abm', 'Missile d\'interception', 'Missiles d\'interception');
  add('ipm', 'Missile interplanétaire', 'Missiles interplanétaires');
}
/* Ce qui tire. Les cinq autres ne défendent rien : le satellite et la foreuse
   ont 1 d'attaque, la sonde 0,01, contre 4 000 de coque à un petit transporteur,
   et les deux missiles ne visent pas une flotte. Leur présence n'empêche donc
   pas un pillage — l'exiger ramènerait le joueur à cocher sa case à la main,
   parce qu'un inactif traîne presque toujours des satellites. Tout le reste,
   petit transporteur compris, veut dire combat, et le copilote n'en simule
   aucun : il se tait et laisse le joueur trancher. */
const SE_BAT = {};
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
/** Une planète dans l'onglet Défense : son modèle, ses pièces, son manque.
    Les deux menus portent `data-dp` : c'est lui qui distingue la surcharge
    d'une planète du réglage global, qui n'en a pas. */
function defCarte(p){
  const tete = `<div class="row spread"><h2>${esc(p.name)} <span class="note">${esc(p.coords)}</span></h2></div>`;
  const menus = `<div class="grid">
      <div class="f"><span>Modèle</span>${defPicker(p.defModele && DEF_MODELES[p.defModele] ? p.defModele : '', p.id)}</div>
      <label class="f">Palier<select data-def="palier" data-dp="${p.id}"><option value="">Comme les réglages</option>${defPalierOpts(p.defPalier)}</select></label>
    </div>`;
  const d = defPlan(p);
  if(!d) return `<div class="card">${tete}${menus}<p class="note">Défense jamais relevée ici : ouvre la page Défense de cette planète dans le jeu, ou clique Actualiser. Tant qu'elle est inconnue, annoncer un manque reviendrait à faire reconstruire ce qui est déjà au sol.</p></div>`;
  const exces = d.lignes.filter(l=>l.exces > 0), hors = d.lignes.filter(l=>l.hors), bloques = d.lignes.filter(l=>l.req);
  const enFile = d.lignes.some(l=>l.file > 0);
  return `<div class="card">${tete}${menus}
    <p class="note">${esc(d.nom)} · ${d.palier} ${esc(DEF[d.ancre].p)}${defPalierDe(p)==='fill' ? (d.lignes.some(l=>l.k===d.ancre && l.n + l.file > 0) ? ' déjà au sol' : ' : rien à compléter, le plus petit palier sert de départ') : ''}</p>
    ${p.defModele ? `<p class="note mono">${defRecetteHtml(defModele(d.modele))}</p>` : ''}
    ${d.plancherGap ? `<p class="pill warn">Sous le plancher de ton profil (${fmt(d.plancher)} ${esc(DEF[d.ancre].p)}) : ses cartes passent avant celles du palier.</p>` : ''}
    <div class="tbl-wrap"><table><thead><tr><th>Pièce</th><th class="n">Au sol</th>${enFile ? '<th class="n">En file</th>' : ''}<th class="n">Cible</th><th class="n">Manque</th><th>Coût du manque</th></tr></thead><tbody>
      ${d.lignes.map(l=>`<tr><td>${esc(DEF[l.k].n)}</td><td class="n">${fmt(l.n)}</td>${enFile ? `<td class="n">${l.file ? fmt(l.file) : '—'}</td>` : ''}<td class="n">${l.hors ? '<span class="note">hors modèle</span>' : fmt(l.cible)}</td><td class="n">${l.manque ? fmt(l.manque) : l.exces ? `<span class="note">+${fmt(l.exces)}</span>` : '—'}</td><td>${l.manque ? costHtml(l.cout) : ''}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="row gap-2 mt-2">${d.cout.some(x=>x > 0)
      ? `<span class="pill ${d.payable ? 'good' : 'warn'}">${d.payable ? 'Payable avec son stock' : 'Plus que son stock'}</span>${costHtml(d.cout)}`
      : `<span class="pill good">Le modèle est tenu</span>`}</div>
    ${exces.length ? `<p class="note">Au-dessus du modèle, et ça compte quand même : ${exces.map(l=>`${fmt(l.exces)} ${esc(DEF[l.k].p)}`).join(', ')}.</p>` : ''}
    ${hors.length ? `<p class="note">Hors modèle, au sol et compté, mais jamais redemandé : ${hors.map(l=>`${fmt(l.n + l.file)} ${esc(l.n + l.file > 1 ? DEF[l.k].p : DEF[l.k].o)}`).join(', ')}.</p>` : ''}
    ${bloques.length ? `<p class="pill warn mt-2">Pas encore débloqué, aucune carte en attendant : ${bloques.map(l=>esc(defBloqueTexte(l))).join(' · ')}</p>` : ''}
  </div>`;
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
/**
 * Ce qu'un rapport d'espionnage collé veut dire.
 *
 * `null` veut dire « le rapport ne le dit pas », et jamais zéro — c'est le
 * partage que `defsOf` fait déjà sur les planètes du joueur, pour la même
 * raison : un espionnage trop faible n'affiche pas la section, et confondre
 * les deux enverrait la flotte contre une défense.
 *
 * Le repli va toujours vers l'inconnu. Une ligne qu'on ne sait pas lire rend
 * sa section inconnue plutôt que vide, parce que « vide » autorise un pillage
 * et « inconnu » ne fait que se taire. Un vocabulaire incomplet rend donc le
 * copilote muet, jamais menteur.
 *
 * @param {string} txt le rapport, tel que le joueur l'a collé
 * @returns {{res:number[]|null, fleet:object|null, def:object|null, loot:number|null}}
 */
function parseReport(txt){
  const brut = String(txt);
  const num = label=>{ const m = brut.match(new RegExp(label+'\\s*:?\\s*(\\d[\\d.,]*)\\s*(Mn|M|k|K)?', 'i')); if(!m) return null; const suf = m[2]||''; if(/m/i.test(suf)) return Math.round(parseFloat(m[1].replace(/\./g,'').replace(',','.'))*1e6); if(/k/i.test(suf)) return Math.round(parseFloat(m[1].replace(/\./g,'').replace(',','.'))*1e3); return +m[1].replace(/[.,]/g,'') || 0; };
  /* Les ressources gardent leur lecture d'avant : elles ne dépendent d'aucune
     section, pour que coller la seule partie Ressources continue de marcher. */
  const res = [num('M[ée]tal'), num('Cristal'), num('Deut[ée]rium')];
  const butin = brut.match(/butin\s*:?\s*(\d+)\s*%/i);

  const st = {fleet:{vue:false, floue:false, n:{}}, def:{vue:false, floue:false, n:{}}};
  const compte = (s, k, v)=>{ s.n[k] = (s.n[k]||0) + v; };
  const chiffre = s=>{ const v = +String(s).replace(/[.,\s]/g,''); return isFinite(v) ? v : null; };
  let sec = null, attend = null;
  /* Un libellé reconnu dont le compte n'arrive jamais est le cas qui mord : il
     laissait la section « lue et vide », donc la cible « nue », alors que le
     mot était sous les yeux du joueur. Perdre une attente rend donc la section
     inconnue — c'est le seul sens de repli qui ne mente pas. */
  const perdu = ()=>{ if(attend && sec) sec.floue = true; attend = null; };
  for(const ligne of brut.split(/\r?\n/)){
    const l = ligne.trim(); if(!l) continue;
    const cle = repKey(l), tete = REPORT_HEADS[cle];
    if(tete){ perdu(); sec = (tete==='fleet'||tete==='def') ? st[tete] : null; if(sec) sec.vue = true; continue; }
    if(!sec) continue;
    // Le jeu avoue lui-même ce qu'il n'a pas pu lire : c'est le signal le plus sûr.
    if(cle.startsWith(REPORT_RIEN)){ sec.floue = true; attend = null; continue; }
    if(REPORT_WORDS[cle]){ perdu(); attend = REPORT_WORDS[cle]; continue; }
    /* Le libellé et son nombre peuvent tenir sur une ligne ou sur deux, selon
       la façon dont le joueur copie : les deux se lisent, parce que deviner
       laquelle coûterait un rapport mal lu sur une mise en page légitime. */
    const m = l.match(/^(.*?)[\s.:]*(\d[\d.,\s]*)$/);
    const k2 = m && REPORT_WORDS[repKey(m[1])];
    const v = m ? chiffre(m[2]) : null;
    if(k2 && v != null){ perdu(); compte(sec, k2, v); continue; }
    if(attend && v != null && m && !m[1].trim()){ compte(sec, attend, v); attend = null; continue; }
    sec.floue = true; attend = null;
  }
  perdu();
  const rendu = s => (!s.vue || s.floue) ? null : s.n;
  return {
    res: res.some(x=>x!=null) ? res.map(x=>x||0) : null,
    fleet: rendu(st.fleet), def: rendu(st.def),
    loot: butin ? +butin[1]/100 : null
  };
}
/** Une section lue où rien ne tire. Inconnue (`null`) n'est pas nue. */
function seNue(n){ return !!n && !Object.keys(n).some(k=>SE_BAT[k] && n[k]>0); }
/**
 * Pose sur la cible ce qu'un rapport collé vient de dire.
 *
 * `S.raid.safe` garde le sens qu'il a toujours eu — le joueur affirme que la
 * cible est nue, et c'est lui qui engage sa flotte — mais le collage le
 * pré-remplit au lieu de le laisser à une case qu'on coche sans avoir lu. Le
 * joueur peut recocher : il a pu lire le rapport mieux que l'analyseur, et le
 * copilote ne refuse pas un choix du joueur.
 *
 * @param {string} txt le rapport collé
 */
function applyReport(txt){
  if(!S.raid) return;
  /* Le rapport porte les coordonnées de la planète espionnée. Coller celui
     d'une autre cible pré-cocherait « sans défense » pour celle-ci, et c'est
     une erreur de manipulation banale dès qu'on espionne plusieurs cibles :
     elle coûte le même prix que le mensonge qu'on cherche à éviter. */
  const c = String(txt).match(/\[(\d+:\d+:\d+)\]/);
  if(c && S.raid.coords && c[1] !== S.raid.coords){ S.raid.mismatch = c[1]; return; }
  S.raid.mismatch = null;
  const r = parseReport(txt);
  /* La flotte et la défense repartent à chaque collage, y compris vers
     l'inconnu : gardées, celles d'hier décriraient la cible d'hier. Les trois
     ressources, elles, survivent à un collage qui ne les contient pas — le
     joueur a pu les taper, et une ressource périmée ne fait rater qu'un butin
     quand une défense périmée fait perdre une flotte. */
  S.raid.fleet = r.fleet;
  S.raid.def = r.def;
  S.raid.lootSeen = r.loot;
  /* La date suit les ressources, et elles seules : c'est le stock qui vieillit.
     Posée à chaque frappe dans la zone de collage, elle rajeunissait un rapport
     de cinq heures sans que personne ait réespionné. */
  if(r.res){ S.raid.m = r.res[0]; S.raid.c = r.res[1]; S.raid.d = r.res[2]; S.raid.at = Date.now(); }
  S.raid.safe = seNue(r.fleet) && seNue(r.def);
}
/** Fleet and outcome for a raid on the selected target. */
function raidPlan(){
  const r = S.raid; if(!r) return null;
  /* Un rapport vieillit : la cible produit, et surtout elle peut avoir été
     pillée entre-temps. Au-delà de deux heures il ne décrit plus rien. */
  const stale = !r.at || Date.now()-r.at > 2*3600e3;
  /* Un raid se compose avec les transporteurs posés sur la planète de départ :
     la bonne planète est donc celle qui les a, pas celle qui porte une charge.
     Un centre désigné à la main sur une colonie neuve donnerait sinon un plan
     de raid sans vaisseaux, et il le dirait en silence. */
  const home = S.planets[cargoHomeIndex()], res = [+r.m||0, +r.c||0, +r.d||0];
  /* Le rapport affiche lui-même le taux de butin, et il est juste : la
     déduction par la classe ignore le statut d'honneur de la cible, que le
     jeu, lui, a déjà appliqué. Lu, on le prend ; sinon on déduit, et la carte
     dit laquelle des deux elle montre. */
  const rateSeen = typeof r.lootSeen === 'number';
  const rate = rateSeen ? r.lootSeen : (S.settings.cls==='explorer' ? .75 : .5);
  const loot = res.map(x=>Math.floor(x*rate)), need = loot[0]+loot[1]+loot[2];
  /* Ce que la défense lue vaut, au prix que le copilote emploie pour décider
     de celle du joueur. Deux nombres lus posés côte à côte : aucune simulation,
     aucun seuil inventé, et c'est le joueur qui tranche.
     Les missiles n'y entrent pas, comme les satellites n'entrent pas dans la
     flotte : ils ne tirent pas sur une flotte, donc ils ne pèsent sur aucune
     décision. Ils restent reconnus, pour que leur présence ne rende pas la
     section illisible. */
  const defVue = r.def ? Object.entries(r.def).filter(([k,n])=>DEF[k] && n>0) : null;
  const defValue = defVue ? mse(...[0,1,2].map(j=>defVue.reduce((a,[k,n])=>a+DEF[k].c[j]*n, 0))) : null;
  const defList = defVue && defVue.length ? shipList(Object.fromEntries(defVue)) : null;
  const flotteVue = r.fleet ? Object.entries(r.fleet).filter(([k,n])=>SE_BAT[k] && n>0) : null;
  /* Nommée, jamais chiffrée : une flotte qui tire suffit à dire non, et la
     chiffrer demanderait les coûts des coques de combat — une table entière
     pour une phrase qui ne changerait aucune décision. */
  const fleetList = flotteVue && flotteVue.length ? shipList(Object.fromEntries(flotteVue)) : null;
  const av = home.ships||{}, lcC = shipStats('lc').cargoEff, scC = shipStats('sc').cargoEff;
  let left = need; const lc = Math.min(av.lc||0, Math.ceil(left/lcC)); left -= lc*lcC; const sc = left>0 ? Math.min(av.sc||0, Math.ceil(left/scC)) : 0; left -= sc*scC;
  const ships = {}; if(lc) ships.lc = lc; if(sc) ships.sc = sc;
  const fl = (lc||sc) ? flight(home.coords, r.coords, ships, 100) : null;
  const fuel = fl ? fl.fuel*2 : 0, cargo = souteUtile(lc*lcC + sc*scC, fuel), got = Math.min(need, cargo);
  return {home, loot, need, ships, fl, cargo, got, fuel, stale, short: Math.max(0,left), net: got - fuel*S.settings.ratio[0]/S.settings.ratio[2],
    rate, rateSeen, defValue, defList, fleetList, defKnown: r.def != null, fleetKnown: r.fleet != null,
    /* Le butin dans la même unité que la défense : `need` est une somme brute,
       et la comparer à un équivalent métal inversait le verdict sur une cible
       riche en cristal ou en deutérium. */
    lootValue: mse(...loot)};
}

/* ---------- les faits du serveur ---------- */

/** Un fait du serveur se lit comme le jeu l'écrit : un pourcent reste un
    pourcent, un multiplicateur garde son ×, un oui/non ne redevient pas 1. */
const srvPct = v => (Math.round(v*1000)/10).toString().replace('.',',')+' %';
const srvX = v => '×'+String(v).replace('.',',');

/* La carte Serveur, déclarée plutôt qu'écrite : quatre groupes, dans l'ordre
   où le joueur cherche. `[clé, libellé, format, note, mien]` — `mien` rend ce
   que les réglages du copilote disent du même fait, dans la même unité, et un
   écart se signale au lieu de fausser les calculs en silence. Une clé que le
   serveur ne publie pas disparaît de la liste. */
/* Les quatre premières lignes de chaque groupe sont celles dont le copilote se
   sert pour calculer ; le reste est vrai mais ne change rien au plan, et se
   replie. L'ordre est donc porteur : déplacer une ligne, c'est décider si elle
   s'affiche d'emblée. */
const SRV_ROWS = [
  ['L\'univers', [
    ['galaxies', 'Galaxies'],
    ['systems', 'Systèmes par galaxie'],
    ['bonusFields', 'Cases bonus', null, 'Ajoutées à chaque planète en plus de sa taille.'],
    ['topScore', 'Points du n°1', null, 'Fixe le plafond des expéditions.'],
    ['donutGalaxy', 'Galaxies en anneau', null, 'La première galaxie touche la dernière : les temps de vol en tiennent compte.'],
    ['donutSystem', 'Systèmes en anneau', null, 'Le système 1 touche le dernier.'],
    ['name', 'Nom', esc],
    ['number', 'Numéro', v=>String(v)],
    ['version', 'Version du jeu', esc],
    ['language', 'Langue', esc],
    ['domain', 'Adresse', esc],
    ['timezone', 'Fuseau horaire', (v,sv)=>esc(v+(sv.timezoneOffset?` (${sv.timezoneOffset})`:''))],
  ]],
  ['Vitesses', [
    ['speed', 'Économie', srvX, 'Production, constructions, recherches, expéditions : le copilote calcule avec.'],
    ['speedFleetPeaceful', 'Flotte pacifique', srvX, 'Transport, colonisation, expédition, recyclage : le copilote calcule avec.'],
    ['researchDurationDivisor', 'Recherche', v=>'÷'+String(v).replace('.',','), 'Diviseur des durées de recherche, en plus de la vitesse éco : le copilote calcule avec.'],
    ['globalDeuteriumSaveFactor', 'Carburant', srvX, 'Multiplie le deutérium brûlé par chaque vol : le copilote calcule avec.'],
    ['speedFleetWar', 'Flotte de guerre', srvX, 'Attaque et espionnage.'],
    ['speedFleetHolding', 'Stationnement', srvX, 'Durée des missions qui attendent sur place.'],
  ]],
  ['Combat, débris et lune', [
    ['debrisFactor', 'Débris des vaisseaux', srvPct, 'Part de la coque détruite qui tombe dans le champ de ruines : la carte Lune calcule avec.'],
    ['debrisFactorDef', 'Débris de la défense', srvPct],
    ['defToTF', 'Défense dans le champ de ruines'],
    ['repairFactor', 'Défense réparée', srvPct, 'Part de la défense détruite qui se relève après le combat.'],
    ['deuteriumInDebris', 'Deutérium dans les débris'],
    ['combatDebrisFieldLimit', 'Plafond du champ de ruines', srvPct],
    ['wfEnabled', 'Champ d\'épaves'],
    ['wfMinimumRessLost', 'Épaves : pertes minimales'],
    ['wfBasicPercentageRepairable', 'Épaves réparables', v=>String(v).replace('.',',')+' %'],
    ['rapidFire', 'Feu rapide'],
    ['acs', 'Attaque groupée'],
    ['bashingSystemEnabled', 'Limite anti-bash'],
    ['bashlimit', 'Attaques permises', null, 'Par cible et par vague, avant l\'avertissement.'],
  ]],
  ['Règles du serveur', [
    ['cargoHyperspaceTechMultiplier', 'Soute par niveau d\'Hyperespace', v=>String(v).replace('.',',')+' %', 'Compté dans chaque soute annoncée par le copilote.'],
    ['probeCargo', 'Soute des sondes'],
    ['characterClassesEnabled', 'Classes de personnage'],
    ['newbieProtectionLimit', 'Protection débutant'],
    ['newbieProtectionHigh', 'Seuil des gros joueurs'],
    ['marketplaceEnabled', 'Place de marché'],
    ['darkMatterNewAcount', 'Matière noire de départ'],
  ]],
];

/* Un outil retiré laisse son nom dans les réglages du joueur : on ne demande à
   VIEWS que ce qu'il sait encore dessiner. */
const TOOLS = [['explore','Cibles'],['colony','Colonie'],['fleet','Flotte'],['defense','Défense'],['moon','Lune'],['server','Serveur']];
function toolTab(){ return TOOLS.some(([k])=>k===S.ui.tool) ? S.ui.tool : 'colony'; }

/** Ce que la carte du centre dit sous la case : le risque que le wiki nomme,
    et ce qu'un centre sans labo laisse derrière lui. Vide ailleurs. */
function centreNoteHtml(p, i, ci){
  return i === ci ? `Un espionnage montre où tu bases ta flotte : mets-la à l'abri comme ailleurs.${labLaisse(p)}` : '';
}
/** La vocation d'une planète, en une pastille et sa raison. Rien à dire est
    aussi une information : rien ne distingue cette planète des autres. */
function vocPill(v){
  if(!v) return `<span class="note">${S.planets.length < 2
    ? 'Une seule planète : rien à comparer pour l\'instant.'
    : 'Pas de vocation marquée : son sol ne la distingue d\'aucune autre.'}</span>`;
  const nom = v.keys.length ? v.keys.map(k=>VOC_NOM[k]).join(' et ') : 'Vocation inconnue';
  return `<span class="pill info">${nom}</span>`;
}
/** La raison de la vocation. Elle vit dans le volet des raisons : le joueur
    vient lire une production et poser des objectifs, pas relire pourquoi son
    sol est ce qu'il est — mais il doit pouvoir y revenir. */
function vocRaison(v){ return v && v.why ? `<span class="note">${esc(v.why)}</span>` : ''; }
/** Ce qu'un centre sans labo laisse derrière lui. Le copilote obéit au joueur,
    mais il ne lui cache pas qu'un labo déjà payé ne suivra pas. */
function labLaisse(p){
  const autre = S.planets.filter(x=>x!==p).reduce((a,x)=>(!a || (x.b.lab||0)>(a.b.lab||0)) ? x : a, null);
  if(!autre || (autre.b.lab||0) <= (p.b.lab||0)) return '';
  return ` Le labo ${autre.b.lab} de ${esc(planetRef(autre))} ne suit pas : repartir d'un labo 1 ici coûterait ${fmt(mse(...rangeCost(B.lab, 0, autre.b.lab)))} en équivalent métal.`;
}
/** Les cases de forme de vie dans la grille des niveaux. Elles ne sont pas
    dans B — qui ne porte que des prix fixes, alors que ceux d'une case changent
    d'une espèce à l'autre et s'apprennent au relevé —, d'où leur absence de
    cette grille jusqu'ici. Leur niveau vient du jeu et ne se tape pas : seul
    l'objectif s'écrit, comme pour un bâtiment. */
function lfRows(p){
  return lfIds(p).map(id=>{
    const v = (p.lf || {})[id] || {}, nom = lfNom(p, id);
    return `<label class="f">${esc(nom)}<span class="lv"><input type="number" value="${num(v.lvl)}" readonly tabindex="-1" aria-label="${esc(nom)} : niveau relevé"><input class="prio" type="number" min="${num(v.lvl)+1}" data-pid="${p.id}" data-prio="${id}" data-kind="lf" value="${prioLvl('lf', p.id, id)}" placeholder="→" title="Niveau visé : le plan épargne pour l'atteindre" aria-label="${esc(nom)} : niveau visé"></span></label>`;
  }).join('');
}
/** La carte qui pose le même niveau visé sur plusieurs planètes à la fois.
    Chaque ligne dit ce que la pose ferait avant qu'on clique : le joueur ne
    pose pas en aveugle sur dix planètes, et une planète qui vise déjà plus
    haut le montre plutôt que de se faire écraser sans un mot.
    Repliée par défaut, comme la carte des recherches : elle ne sert que par
    moments, et dépliée elle pousserait l'empire hors de l'écran. */
function poseBloc(){
  const k = poseK(), l = poseLignes(), n = l.filter(x => x.agit).length, vise = poseVise();
  /* Le bouton de retrait n'apparaît que s'il a de quoi faire : sur une case
     vierge, il ne serait qu'un bouton mort de plus à côté de l'autre. */
  const d = l.filter(x => x.retire).length;
  const vies = poseLfCles();
  /* Les formes de vie dans leurs propres groupes, à la suite des bâtiments :
     mêlées à eux elles seraient présentes sans être trouvables — le reproche
     qui leur a déjà valu leur bloc à elles dans la grille des niveaux. */
  const groupe = (titre, cles) => cles.length
    ? `<optgroup label="${esc(titre)}">${cles.map(c => `<option value="${esc(c)}" ${c===k?'selected':''}>${esc(poseNom(c))}</option>`).join('')}</optgroup>` : '';
  const options = Object.keys(B).map(j => `<option value="${j}" ${j===k?'selected':''}>${esc(B[j].n)}</option>`).join('')
    + groupe('Formes de vie · bâtiments', vies.filter(c => c.startsWith('lfbuilding')))
    + groupe('Formes de vie · recherches', vies.filter(c => c.startsWith('lfresearch')));
  /* Une seule pastille par ligne, et elle dit pourquoi. Deux pastilles
     indépendantes — le niveau déjà visé d'un côté, la flèche de l'autre — se
     lisaient comme deux faits séparés, jamais comme « ton 50 va devenir 43 ».
     Tant qu'aucun niveau n'est tapé, pas de pastille du tout : « déjà à 14 »
     sur chaque ligne ne répétait que le nombre d'à côté. */
  const lignes = l.map(x => {
    const etat = !x.coche ? '<span class="note">décochée</span>'
      : !x.ici ? '<span class="note">pas relevée ici</span>'
      : !(vise > 0) ? ''
      : x.agit ? `<b class="mono">→ ${vise}</b>`
      : x.deja != null && x.deja >= vise ? `<span class="note">déjà visé ${x.deja}</span>`
      : `<span class="note">déjà à ${x.actuel}</span>`;
    return `<li><label class="row gap-2"><input type="checkbox" data-posep="${esc(x.pid)}" ${x.coche?'checked':''} class="w-auto">
      <span><b>${esc(x.name)}</b> <span class="note">${esc(x.coords)}</span></span></label>
      <span class="row gap-2"><span class="mono note">${esc(x.quoi || poseNom(k))} ${x.ici ? x.actuel : '—'}</span>${etat}</span></li>`;
  }).join('');
  return `<details class="card"${fold('pose', false)}><summary data-fold="pose">Poser sur toutes les planètes <span class="note">${n} planète${n>1?'s':''}</span></summary>
    <p class="note mt-2">Le même niveau visé sur toutes les planètes cochées, d'un coup. Chaque planète garde ensuite sa priorité à elle : le clic droit dans le jeu la corrige comme avant. Les planètes décochées le restent pour cette case-là.</p>
    <div class="grid mt-2">
      <label class="f">Bâtiment ou forme de vie<select data-pose="k">${options}</select></label>
      <label class="f">Niveau visé<input type="number" min="1" data-pose="lvl" value="${vise > 0 ? vise : ''}" placeholder="43"></label>
    </div>
    <ul class="list mt-2">${lignes}</ul>
    <div class="row mt-2"><button class="btn" data-posego="1" ${n?'':'disabled'}>Poser sur ${n} planète${n>1?'s':''}</button>${
      d ? `<button class="btn ghost" data-posedel="1" title="Enlève le niveau visé de cette case sur les planètes cochées. Le plan cesse d'épargner pour elle ; les niveaux déjà construits ne bougent pas.">Retirer sur ${d} planète${d>1?'s':''}</button>` : ''
    }${(()=>{ const r = poseRien(); return r ? `<span class="note">${esc(r)}</span>` : ''; })()}</div>
  </details>`;
}
/** Les formes de vie sous leur nom, et non mêlées aux bâtiments : posées à la
    suite du Dock et des Satellites, elles étaient présentes sans être
    trouvables. Rien de relevé n'est pas rien à dire non plus — sans cette
    ligne, le joueur cherche dans une grille qui ne les nomme même pas. */
function lfBloc(p){
  const r = lfPopNourriture(p);
  /* Le bouton sur sa propre ligne : au bout d'une phrase longue, au fond d'un
     volet, il ne se voyait pas — c'est exactement le reproche qui a valu son
     cadre au volet lui-même. */
  const bouton = r ? `<div class="row mt-2"><button class="btn sm" data-lfpaliers="${p.id}" title="Pose deux priorités : la nourriture au niveau ${LF_PALIER.nourriture}, puis la population au niveau ${LF_PALIER.population[0]} et enfin ${LF_PALIER.population[1]}. Les niveaux se corrigent ensuite dans les champs.">Poser les paliers de population</button><span class="note">nourriture ${LF_PALIER.nourriture}, population ${LF_PALIER.population[0]} puis ${LF_PALIER.population[1]}</span></div>` : '';
  const titre = `<p class="note mt-2"><b>Formes de vie</b> — niveaux relevés sur la page de ton espèce dans le jeu, à droite le niveau visé.</p>${bouton}`;
  if(!lfIds(p).length) return `<p class="note mt-2"><b>Formes de vie</b> — aucune case de forme de vie relevée ici : ouvre la page de ta forme de vie dans le jeu pour qu'elles apparaissent.</p>`;
  return `${titre}<div class="grid tight mt-2">${lfRows(p)}</div>`;
}
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

/* ---------- profil de jeu ---------- */
/* Un mineur, un raideur et un explorateur regardent la même liste de cartes
   et n'y cherchent pas la même chose. Le profil dit laquelle passe devant et
   laquelle ne sort pas du tout ; les poids, eux, sont dans `profils.js`, pour
   qu'on puisse les discuter sans relire le code qui les applique.

   Le style sert deux fois : il pèse les cartes, et il pose « Ce que le plan
   vise » — la question était déjà là, au troisième menu des Réglages, où
   personne n'allait. Elle se pose donc une fois, en tête de la page que le
   joueur regarde, avec les deux qui la complètent ; les Réglages restent
   l'endroit où en changer ensuite. */

/** La clé si la table la porte en propre, sinon null : sans ce garde-fou, une
    sauvegarde truquée ferait passer `__proto__` pour un style. */
function profilConnu(t, k){ return Object.prototype.hasOwnProperty.call(t, String(k)) ? String(k) : null; }
/* Le profil remis d'aplomb : chaque clé relue dans sa table, le reste jeté.
   Une sauvegarde d'une autre version, une synchro abîmée ou un fichier bricolé
   à la main y mettraient sinon de quoi faire lever la ligne du profil. */
function profilSain(){
  const def = {style:'', classe:'', activite:'regulier', focus:[], set:false};
  if(!S.profil || typeof S.profil !== 'object') S.profil = def;
  S.profil.style    = profilConnu(PROFILS.styles, S.profil.style) || def.style;
  S.profil.classe   = profilConnu(PROFILS.classes, S.profil.classe) || def.classe;
  S.profil.activite = profilConnu(PROFILS.activites, S.profil.activite) || def.activite;
  S.profil.focus = (Array.isArray(S.profil.focus) ? S.profil.focus : [])
    .map(k => profilConnu(PROFILS.focus, k)).filter(Boolean);
  // Répondu sans style : le questionnaire n'a pas abouti, il se repose.
  S.profil.set = !!S.profil.set && !!S.profil.style;
}
/* Les deux réglages que le style pose, et qu'il ne reprend jamais : ce que le
   plan vise, et le modèle de défense. Un turtle vise la tortue de fin de
   partie et les mines, un raideur le pillage et rien qui fortifie.

   Aucun des deux ne s'impose. Le réglage ne dit pas qui l'a écrit, alors le
   copilote s'en tient à ce qu'il peut savoir : tant que la valeur en place est
   celle du style d'avant — ou celle d'usine, pour qui n'a jamais répondu —
   elle suit ; dès qu'elle s'en écarte, c'est un choix du joueur et l'assistant
   n'y touche plus. Les deux ensemble, parce que c'est la même règle : l'avoir
   écrite pour le modèle de défense et oubliée pour le plan du jour est
   exactement ce que la relecture a trouvé.

   Ça compte d'autant plus pour le plan que deux de ses cinq valeurs —
   « Équilibré » et « Économie pure » — ne sont atteignables que par le menu
   des Réglages : aucun style ne les vise, donc ce sont précisément celles que
   l'assistant écraserait sans jamais pouvoir les rendre. */
/** @param {string} avant le style d'avant, vide s'il n'y en avait pas
    @param {string} apres le style qu'on vient de choisir */
function styleRepose(avant, apres){
  const neuf = PROFILS.styles[apres]; if(!neuf) return;
  const vieux = PROFILS.styles[avant], def = sample();
  // `dayValue` relit la clé dans FOCUS, comme pour le menu des Réglages.
  if(S.day.focus === (vieux ? vieux.plan : def.day.focus))
    S.day.focus = dayValue('focus', neuf.plan, S.day.focus);
  if(S.settings.defModele === (vieux ? vieux.defense : def.settings.defModele))
    S.settings.defModele = neuf.defense;
}
/* Le réglage « Ce que le plan vise » est posé par le style, mais le joueur peut
   en changer : tant qu'il ne l'a pas fait, le dire sur place vaut mieux qu'un
   paragraphe qui renvoie à une autre carte. C'est la même annotation que pour
   le modèle de défense, et la même règle que `styleRepose` applique. */
/** @returns {boolean} vrai si le plan en place est encore celui du style. */
function planPoseParLeStyle(){
  const st = PROFILS.styles[S.profil.style];
  return !!(S.profil.set && st && S.day.focus === st.plan);
}
/** La classe que le style conseille, vide tant qu'aucun style n'est choisi. */
function classeSuggeree(){ const s = PROFILS.styles[S.profil.style]; return s ? s.classe : ''; }
/** La classe que le profil vise : celle demandée, ou celle que le style conseille. */
function classeVoulue(){ return S.profil.classe || classeSuggeree(); }
/* Le copilote ne change pas de classe dans le jeu, et il ne calcule pas sur une
   classe que le compte n'a pas : ce qu'il peut faire, c'est le dire. */
/** L'écart entre la classe lue dans le jeu et celle que le profil vise, ou ''. */
function classeEcart(){
  const v = classeVoulue();
  if(!v || v === S.settings.cls) return '';
  return `Ton compte joue ${PROFILS.classes[S.settings.cls] || 'sans classe'}, ton profil vise ${PROFILS.classes[v]}. Rien n'est bloqué : les calculs suivent la classe lue dans le jeu, le profil ne décide que de l'ordre des cartes.`;
}
/**
 * Ce que vaut une catégorie pour le profil en place : 3 passe devant, 0 ne
 * sort pas. Une catégorie que la table ne nomme pas garde la place qu'elle
 * avait avant le profil — et tant que le questionnaire n'a pas de réponse,
 * c'est le cas de toutes.
 * @param {string} cat clé de `PROFILS.cats`, ou '' pour « sans catégorie »
 * @returns {number} 0 à 4
 */
/** @param {string[]} [focus] liste de focus à supposer, celle du profil par défaut */
function poidsCat(cat, focus){
  if(!cat) return PROFILS.neutre;
  const pr = S.profil, mis = focus || pr.focus;
  /* La mise à l'abri ne se pondère pas, elle se place : chez qui passe peu,
     elle passe devant tout le reste. */
  if(cat === 'abri') return PROFILS.abri[pr.activite] || 3;
  let w = (PROFILS.poids[pr.style] || {})[cat];
  if(w == null) return PROFILS.neutre;
  // Un focus ajoute +2 une fois, pas +2 par focus qui le réclame.
  if(mis.some(f => (PROFILS.focus[f] || {cats:[]}).cats.indexOf(cat) >= 0)) w = Math.min(3, w + 2);
  const cap = (PROFILS.plafonds[pr.activite] || {})[cat];
  return cap == null ? w : Math.min(w, cap);
}
/* Un focus qui ne peut rien remonter doit le dire. Pour un explorateur, cocher
   « Expéditions » n'ajoute rien : sa catégorie vaut déjà 3 pour ce style, et le
   +2 est plafonné là. Même chose sous « Peu présent », où un plafond d'activité
   retient la catégorie plus bas que le focus ne la pousserait. Une case qui ne
   peut pas agir et qui n'en dit rien est un mensonge par omission — c'est ce
   que le joueur a trouvé en la cochant, et en ne voyant rien bouger. */
/** @returns {boolean} vrai si cocher ce focus ne changerait aucun poids. */
function focusInerte(k){
  const f = PROFILS.focus[k]; if(!f) return false;
  const sans = S.profil.focus.filter(x => x !== k), avec = sans.concat(k);
  return f.cats.every(c => poidsCat(c, sans) === poidsCat(c, avec));
}
/** La catégorie d'une carte du plan, '' quand elle sert tous les styles. */
function catActe(a){
  const t = PROFILS.actes;
  if(a.kind === 'b') return t.bat[a.k] || '';
  if(a.kind === 't') return t.tech[a.k] || '';
  // Un chantier vaut ce qu'il sort : c'est le vaisseau qui décide, pas la file.
  if(a.kind === 'shipbuild') return t.vaisseaux[Object.keys(a.ships || {})[0]] || '';
  return t.kinds[a.kind] || '';
}
/** La catégorie d'une carte à faire : sa rubrique, sauf les quelques exceptions. */
function catMission(m){ return PROFILS.missions.id[m.id] || PROFILS.missions.q[m.q] || ''; }
/** Le profil en une ligne : « Turtle · Collecteur · Régulier · + Expéditions ». */
function profilLigne(){
  const p = S.profil, st = PROFILS.styles[p.style];
  if(!st) return '';
  // Le nom court quand il existe : la ligne doit rester une ligne.
  const f = p.focus.map(k => PROFILS.focus[k].court || PROFILS.focus[k].n);
  return [st.n, PROFILS.classes[classeVoulue()], PROFILS.activites[p.activite].n]
    .concat(f.length ? '+ ' + f.join(', ') : []).join(' · ');
}
/** Les six focus ponctuels en cases à cocher. */
function profilFocusHtml(){
  return Object.entries(PROFILS.focus).map(([k,f]) => {
    const mis = S.profil.focus.indexOf(k) >= 0, inerte = focusInerte(k);
    return `<label class="pill ${mis?'good':'info'} choix" title="${inerte?'Ton style met déjà cette catégorie au maximum : la cocher ne changerait rien.':''}"><input type="checkbox" data-pfocus="${k}" ${mis?'checked':''} class="w-auto mr-2">${esc(f.n)}${inerte?' <span class="note">· déjà au max</span>':''}</label>`;
  }).join('');
}
/* Trois questions, une par écran : la deuxième dépend de la première, puisque
   la classe conseillée n'existe qu'une fois le style choisi. L'assistant
   s'ouvre tant que la réponse manque, et « Refaire le questionnaire » le
   relance avec les réponses en place — un clic change un choix, pas trois. */
let profilEtape = 0;
/** @param {number} [etape] 0 à 2 ; l'étape en cours par défaut. */
function profilCard(etape){
  if(S.profil.set) return '';
  const p = S.profil, e = Math.max(0, Math.min(2, etape == null ? profilEtape : etape));
  const titres = ['Tu joues comment ?', 'Quelle classe veux-tu viser ?', 'Tu passes souvent ?'];
  const notes = [
    'Le plan ne vise pas la même chose selon ta façon de jouer, et les cartes ne se rangent pas dans le même ordre. Tu pourras en changer dans Réglages.',
    `${PROFILS.styles[p.style] ? `Pour un ${esc(PROFILS.styles[p.style].n)}, la classe conseillée est <b>${esc(PROFILS.classes[classeSuggeree()])}</b>. ` : ''}Tu peux en viser une autre : le copilote le dira, il ne t'en empêchera pas.`,
    'Ta présence décide de ce qui passe devant : qui passe peu met ses ressources à l\'abri avant tout le reste.',
  ];
  const ligne = (attr, k, lib, aide, actif) =>
    `<li><button class="btn sm ${k===actif?'primary':'ghost'} choix" data-${attr}="${k}">${esc(lib)}</button><span class="why">${aide}</span></li>`;
  const corps = e === 0
    ? Object.entries(PROFILS.styles).map(([k,s]) => ligne('pstyle', k, s.n, esc(s.aide), p.style)).join('')
    : e === 1
    ? Object.entries(PROFILS.classes).map(([k,l]) => ligne('pclasse', k, l,
        k === classeSuggeree() ? '<b>Conseillée pour ton style.</b>' : k === '' ? 'Le copilote prendra celle que ton style conseille.' : '', p.classe)).join('')
    : Object.entries(PROFILS.activites).map(([k,a]) => ligne('pactivite', k, a.n, esc(a.aide), p.activite)).join('');
  // L'écart de classe se dit là où le joueur choisit la classe, pas ailleurs.
  const ecart = e === 1 ? classeEcart() : '';
  return `<div class="card"><div class="row spread"><h2>${esc(titres[e])}</h2><span class="pill info">Étape ${e+1} sur 3</span></div>
    <p class="note">${notes[e]}</p>
    <ul class="advice mt-2">${corps}</ul>
    ${ecart ? `<p class="note">${esc(ecart)}</p>` : ''}
    ${e || p.style ? `<div class="row">${e ? `<button class="btn sm ghost" data-petape="${e-1}">Revenir</button>` : ''}${p.style
      ? `<button class="btn sm ghost" data-pferme="1">Fermer</button>` : ''}</div>` : ''}
  </div>`;
}
/* Le profil en place, là où le joueur lit ses cartes : la ligne se voit sans
   rien ouvrir, et les focus sont à un clic — c'est l'ordre des cartes qu'il
   vient vérifier en les cochant. */
function profilBloc(){
  if(!S.profil.set) return '';
  const ec = classeEcart();
  return `<details class="card ligne"${fold('profil', false)}><summary data-fold="profil"><b>Ton profil</b> <span class="note">${esc(profilLigne())}</span></summary>
    <div class="chips mt-2">${profilFocusHtml()}</div>
    <p class="note mt-2">Un focus remonte ses cartes sans remplacer ton style, et il y reste tant que tu ne le décoches pas. Les formes de vie n'en relèvent pas : leur place se règle dans Réglages.${ec ? ' ' + esc(ec) : ''}</p>
    <p class="note" id="pfMuets"></p>
    <div class="row mt-2"><button class="btn sm ghost" data-refaire="1">Refaire le questionnaire</button></div>
  </details>`;
}

const VIEWS = {
/* Ce que le joueur vient chercher, c'est la carte à suivre maintenant : elle
   seule reste dépliée. Le reste — la journée qui vient, les minuteurs — se
   replie, en disant dans son titre ce qu'il contient, pour qu'on sache s'il
   vaut la peine d'être ouvert. */
today(){
  const d=S.day;
  /* Chaque carte se déclare dans CARTES.today ; le conteneur les empile ou
     les range en onglets, elles n'en savent rien. */
  return cardLayout('today', {
    profil: profilCard() + profilBloc(),
    attaque: `<div id="tdSecuAlerte"></div>`,
    maintenant: `<div class="card"><div class="row spread liste-tete"><h2>Maintenant <span class="note" id="tdNowN"></span></h2>${cartesMenu('maintenant')}</div><div id="tdNow"></div></div>`,
    surplus: `<div id="tdSurplus"></div>`,
    alertes: `<div id="tdAlerts"></div>`,
    securite: `<div id="tdSecu"></div>`,
    expeditions: `<details class="card"${fold('expeditions', false)}><summary data-fold="expeditions">Expéditions <span class="note" id="expoSum"></span></summary>
      <div id="expoBloc"></div>
    </details>`,
    journee: `<details class="card"${fold('journee', false)}><summary data-fold="journee">Ta journée <span class="note" id="tdDaySum"></span></summary>
      <p class="note">${esc(FOCUS[d.focus]||'')} · toutes les ${d.interval} min · nuit ${heureTxt(d.nightStart)}–${heureTxt(d.nightEnd)} <button class="btn sm ghost" data-goto="settings:jeu">Modifier</button></p>
      <div id="tdDay"></div>
    </details>`,
    minuteurs: `<details class="card"${fold('minuteurs', false)}><summary data-fold="minuteurs">Minuteurs <span class="note" id="tmSum"></span></summary>
      <ul class="timers" id="tmList"></ul>
      <details class="volet"${fold('minuteurs.ajout', false)}><summary class="note" data-fold="minuteurs.ajout">Ajouter un minuteur à la main</summary>
        <div class="timer-form mt-2">
          <label class="f">Quoi<select id="tmWhat">${timerOptions()}</select></label>
          <label class="f">Temps restant (copié du jeu)<input id="tmLeft" placeholder="2h 13m 05s"></label>
          <button class="btn primary" id="tmAdd">Lancer</button>
        </div>
      </details>
      <div class="row"><button class="btn sm ghost" id="tmSound">Tester le son</button></div>
    </details>`,
  });
},
empire(){ return cardLayout('empire', {planetes: VIEWS.planets(), recherche: VIEWS.research()}); },
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
explore(){
  if(!IS_EXT) return `<div class="card"><h2>Cibles</h2><p class="note">Cette partie utilise les données publiques officielles d'OGame. Elle ne fonctionne que dans l'extension Copilote.</p></div>`;
  const a = API, ok = a && a.planets && a.players;
  const age = k => a && a.at && a.at[k] ? formatTime(a.at[k]) : '–';
  return `<section class="panel">
    <div class="card"><div class="row spread"><h2>Données de l'univers</h2><button class="btn sm ghost" data-apirefresh="1">Actualiser</button></div>
      <p class="note">${ok ? `${fmt(a.planets.length)} planètes, ${fmt(Object.keys(a.players).length)} joueurs. Classement mis à jour à ${age('scores')}, univers à ${age('universe')}. Les positions libres peuvent dater de quelques jours : vérifie toujours dans Galaxie.` : (a && a.error ? `Erreur de téléchargement : ${esc(a.error)}.` : 'Téléchargement en cours… ouvre une page du jeu si rien ne vient.')}${myScore()!=null ? ` Tes points : <b>${fmt(myScore())}</b>.` : ''}</p>
    </div>
    <div class="card"><h2>Où coloniser</h2><div id="exColo"></div></div>
    ${S.raid ? `<div class="card"><div class="row spread"><h2>Pillage de ${esc(S.raid.coords)}</h2><button class="btn sm ghost" data-raidclose="1">Fermer</button></div>
      <p class="note">${esc(S.raid.name||'')} · 1. Espionne la cible depuis Galaxie. 2. Colle le rapport <b>en entier</b> ici : flotte et défense comprises, pas seulement les ressources. Ce que le rapport ne montre pas, le copilote le dira comme manquant plutôt que de le prendre pour zéro.</p>
      <textarea id="rdPaste" data-raid="paste" placeholder="Colle ici le rapport d'espionnage entier (texte)"></textarea>
      <div class="grid tight">
        <label class="f">Métal<input id="rdM" type="number" min="0" data-raid="m" value="${num(S.raid.m)}"></label>
        <label class="f">Cristal<input id="rdC" type="number" min="0" data-raid="c" value="${num(S.raid.c)}"></label>
        <label class="f">Deutérium<input id="rdD" type="number" min="0" data-raid="d" value="${num(S.raid.d)}"></label>
      </div>
      <label class="row gap-2"><input id="rdSafe" type="checkbox" data-raid="safe" ${S.raid.safe?'checked':''} class="interrupteur"> <span>Le rapport ne montre ni flotte ni défense</span></label>
      <div id="rdPlan"></div>
    </div>` : ''}
    <div class="card"><h2>Qui piller</h2><div id="exRaid"></div></div>
    <div class="card"><h2>Où explorer</h2><div id="exExplore"></div></div>
  </section>`;
},
server(){
  const sv = API && API.server, at = API && API.at && API.at.server;
  if(!sv) return `<section class="panel"><div class="card"><h2>Ton serveur</h2>
    <p class="note">${!IS_EXT ? 'Cette carte lit les paramètres publics officiels du serveur. Elle ne fonctionne que dans l\'extension Copilote.'
      : API && API.error ? `Erreur de téléchargement : ${esc(API.error)}.`
      : 'Rien encore : ouvre une page du jeu, le copilote lira les paramètres publics du serveur.'}</p>
    ${IS_EXT ? '<div class="row"><button class="btn sm ghost" data-apirefresh="1">Actualiser</button></div>' : ''}
  </div></section>`;
  const cards = SRV_ROWS.map(([titre, lignes])=>{
    const li = lignes.map(([k, lib, f, note, mien])=>{
      const v = sv[k]; if(v == null) return '';
      const dit = x => typeof x === 'boolean' ? (x ? 'Oui' : 'Non') : f ? f(x, sv) : fmt(x);
      const m = mien ? mien() : null;
      const ecart = m != null && Math.abs(m - v) > 1e-9 ? `<span class="pill warn">tes réglages : ${dit(m)}</span>` : '';
      const bas = [note || '', ecart].filter(Boolean).join(' ');
      return `<li><div>${lib}${bas?`<div class="note">${bas}</div>`:''}</div><b class="mono">${dit(v)}</b></li>`;
    }).filter(Boolean);
    /* Quatre lignes montrées, le reste replié : la carte disait vingt faits
       d'affilée, et les quatre qui changent le plan s'y perdaient. */
    const vues = li.slice(0, 4), reste = li.slice(4);
    return vues.length ? `<div class="card"><h2>${titre}</h2><ul class="list">${vues.join('')}</ul>${reste.length ? `<details class="volet"${fold('srv:'+titre, false)}><summary class="note" data-fold="${esc('srv:'+titre)}">Le reste (${reste.length})</summary><ul class="list mt-2">${reste.join('')}</ul></details>` : ''}</div>` : '';
  }).join('');
  return `<section class="panel">
    <div class="card"><div class="row spread"><h2>Ton serveur</h2><button class="btn sm ghost" data-apirefresh="1">Actualiser</button></div>
      <p class="note">Les paramètres publics de <b>${esc(sv.name||'ton univers')}</b>${sv.number?` (n°${esc(String(sv.number))})`:''}, lus dans <span class="mono">serverData.xml</span>${at?` à ${formatTime(at)}`:''}. Ce sont des faits du serveur, pas des réglages : ce que le copilote calcule en part — vitesses, carburant, débris, soute — sans que tu aies à le recopier nulle part.</p>
    </div>
    ${cards}
  </section>`;
},
tools(){
  const sub = toolTab();
  return `<section class="panel"><div class="seg" role="tablist">${segTabs(TOOLS, 'data-tool', sub)}</div>${VIEWS[sub]()}</section>`;
},
planets(){
  return `<section class="panel">
    ${S.sample ? `<div class="example">Données d'exemple : remplace-les par tes niveaux réels (planète mère, mine de métal 1). Les cases se sauvegardent dans ce navigateur.</div>` : ''}
    <div class="card"><div class="row spread"><h2>Empire · production / heure</h2><span id="empireFactor"></span></div><div class="res" id="empireRes"></div><details class="volet"${fold('mix', false)}><summary data-fold="mix">Pourquoi ce classement</summary><p class="note mt-2" id="empireMix"></p></details></div>
    ${poseBloc()}
    ${(()=>{ const voc = vocations(), ci = centreIndex(), auto = centreIndex(true); return S.planets.map((p,i)=>`
    <details class="card ligne" data-pi="${i}"${fold('pl:' + p.id, false)}${meteoVoit(p.id) ? '' : ' hidden'}>
      <summary data-fold="pl:${p.id}" class="plsum"><b>${esc(p.name)}</b> <span class="note">${esc(p.coords)}</span><span class="mono" id="psum-${i}"></span></summary>
      <div class="planet-head">
        <input id="pn-${p.id}" data-p="name" value="${esc(p.name)}" aria-label="Nom de la planète">
        <input id="pc-${p.id}" class="coords" data-p="coords" value="${esc(p.coords)}" aria-label="Coordonnées" placeholder="1:1:8">
        <input id="pt-${p.id}" class="temp" type="number" data-p="tmax" value="${num(p.tmax)}" aria-label="Température max (°C)" title="Température max en °C (vue d'ensemble)">
        <span class="note">°C max</span>
        ${S.planets.length>1?`<button class="btn sm ghost" data-del="${i}">Retirer</button>`:''}
      </div>
      <div class="res" id="pres-${i}"></div>
      <div class="row gap-2"><span class="voc" id="pvoc-${i}">${vocPill(voc[p.id])}</span>${ci<0
        ? `<span class="note">${FOCUS_VAISSEAU[S.day.focus]
            ? `${esc(FOCUS[S.day.focus])} : pas de centre, tes planètes doivent rester dispersées.`
            : 'Un centre se choisit entre plusieurs planètes.'}</span>`
        : `<label class="f coche"><input id="pcentre-${p.id}" type="checkbox" data-centre="${p.id}" ${i===ci?'checked':''} class="interrupteur"> Centre${auto===i?' (conseillé)':''}</label>`}</div>
      <p class="note" id="pfleet-${i}"></p>
      <details class="volet" id="pq-${i}"${fold('pq:' + p.id, false)}><summary data-fold="pq:${p.id}">Pourquoi cette planète</summary>
      <div class="col-notes mt-2">
        <span id="pvocw-${i}">${vocRaison(voc[p.id])}</span>
        ${ci>=0&&i===ci&&centreWhy()?`<p class="note">${esc(centreWhy())}</p>`:''}
        <p class="note" id="pctrn-${i}">${centreNoteHtml(p, i, ci)}</p>
      </div>
      </details>
      <details class="volet"${fold('niv:' + p.id, false)}><summary data-fold="niv:${p.id}">Bâtiments et niveaux visés <span class="note" id="pobj-${i}"></span></summary>
      <div class="grid tight mt-2">
        ${Object.keys(B).map(k=>`<label class="f">${B_SHORT[k]}<span class="lv"><input id="pb-${p.id}-${k}" type="number" min="0" data-b="${k}" value="${num(p.b[k])}"${lvLu(p) ? ' readonly tabindex="-1"' : ''}><input class="prio" type="number" min="${num(p.b[k])+1}" data-pid="${p.id}" data-prio="${k}" value="${prioLvl('b', p.id, k)}" placeholder="→" title="Niveau visé : le plan épargne pour l'atteindre" aria-label="${B_SHORT[k]} : niveau visé"></span></label>`).join('')}
        <label class="f">Satellites<input id="ps-${p.id}" type="number" min="0" data-p="sats" value="${num(p.sats)}"${lvLu(p) ? ' readonly tabindex="-1"' : ''}></label>
        <label class="f">Satellites autorisés<select data-satsok="${p.id}"><option value="">Hériter (${S.settings.sats ? 'oui' : 'non'})</option><option value="1" ${p.satsOk === true ? 'selected' : ''}>Oui</option><option value="0" ${p.satsOk === false ? 'selected' : ''}>Non</option></select></label>
      </div>
      ${lfBloc(p)}
      ${regOffHtml(p)}
      </details>
      <details class="volet"${fold('stock:' + p.id, false)}><summary data-fold="stock:${p.id}">Stock <span class="mono note" id="pstk-${i}"></span></summary>
      <p class="note mt-2">Ce que cette planète a en magasin. Il avance tout seul avec ta production ; recale-le quand tu dépenses.</p>
      <div class="grid tight mt-2">
          <label class="f">Métal<input id="sm-${p.id}" type="number" data-s="m" value="${Math.round(stockNow(p)[0])}"></label>
          <label class="f">Cristal<input id="sc-${p.id}" type="number" data-s="c" value="${Math.round(stockNow(p)[1])}"></label>
          <label class="f">Deutérium<input id="sd-${p.id}" type="number" data-s="d" value="${Math.round(stockNow(p)[2])}"></label>
      </div>
      </details>
    </details>`).join(''); })()}
    <div class="row"><button class="btn" id="addPlanet">Ajouter une colonie</button>
    <span class="note" id="colonyNote"></span></div>
  </section>`;
},
research(){
  return `<details class="card"${fold('recherches', false)}><summary data-fold="recherches">Recherches et niveaux visés <span class="note">labo niveau <b id="labLv"></b></span></summary>
    <div class="tbl-wrap"><table class="tech"><thead><tr><th>Technologie</th><th class="n">Niv.</th><th class="n">Visé</th><th>Coût prochain niv.</th><th class="n">Durée</th><th>État</th></tr></thead><tbody>
    ${Object.keys(T).map(k=>`<tr><td>${T[k].n}</td><td class="n"><input id="t-${k}" type="number" min="0" data-t="${k}" value="${num(S.tech[k])}"></td><td class="n"><input class="prio" type="number" min="${num(S.tech[k])+1}" data-prio="${k}" value="${prioLvl('t', null, k)}" placeholder="→" title="Niveau visé : le plan épargne pour l'atteindre" aria-label="${T[k].n} : niveau visé"></td><td id="tc-${k}"></td><td class="n" id="tt-${k}"></td><td id="ts-${k}"></td></tr>`).join('')}
    </tbody></table></div>
  </details>`;
},
moon(){
  const m = S.moonCalc, p = moonPlanete(), k = moonShip();
  /* ponytail: un seul type de vaisseau à la fois, parce qu'un tir de lune se
     fait d'un seul type. Une flotte mélangée demanderait la grille de quatorze
     champs de la carte Flotte ; le jour où quelqu'un en envoie une, elle est là
     à copier. */
  return `<section class="panel">
    <div class="card"><h2>Tir de lune</h2>
      <p class="note">Ton camarade envoie une flotte sur ta planète, ta défense la détruit, et les débris de <b>ses</b> vaisseaux tombent chez toi. Cette carte chiffre le tir avant qu'il parte.</p>
      <div class="grid">
        <label class="f">Planète visée<select id="mnP" data-mc="pid">${S.planets.map(q=>`<option value="${q.id}" ${p && p.id===q.id?'selected':''}>${esc(q.name)} [${esc(q.coords)}]</option>`).join('')}</select></label>
        <label class="f">Ce qu'il envoie<select id="mnShip" data-mc="ship">${Object.keys(SHIPS).map(j=>`<option value="${j}" ${k===j?'selected':''}>${SHIPS[j].n}</option>`).join('')}</select></label>
        <label class="f">Combien<input id="mnN" type="number" min="0" data-mc="n" step="1" value="${Math.floor(Math.max(0,+m.n||0))}"></label>
      </div>
      <div class="grid">
        <label class="f">Chance visée<input id="mnVise" type="number" min="1" max="20" data-mc="viser" step="1" value="${Math.min(20,Math.max(1,Math.round(+m.viser||12)))}"><span class="note">En pourcent, 20 au plus : c'est le plafond du jeu.</span></label>
        <label class="f">Son niveau de Bouclier<input id="mnBou" type="number" min="0" data-mc="bou" step="1" value="${moonBou()}"><span class="note">Celui de ton camarade. Proposé au tien.</span></label>
        ${srv('debrisFactor', null) != null
          ? `<label class="f">Débris de ton univers<b class="mono">${moonDf()} %</b><span class="note">Lu sur le serveur : rien à régler.</span></label>`
          : `<label class="f">Débris de ton univers<select id="mnDf" data-set="debris">${[30,40,50,60,70].map(v=>`<option ${moonDf()===v?'selected':''}>${v}</option>`).join('')}</select><span class="note">En pourcent, dans les paramètres de ton univers. Le copilote le lira tout seul dès que le serveur aura répondu.</span></label>`}
      </div>
      <div class="res" id="moonOut"></div>
      <p class="note" id="moonNote"></p>
    </div>
  </section>`;
},
/* Le modèle se choisit dans les Réglages, une fois pour tout l'empire ; ici
   chaque planète dit ce qu'il lui manque pour le tenir, et peut en prendre un
   autre. Les deux endroits lisent le même réglage, personne ne le recopie. */
defense(){
  const s = S.settings, anc = defAncre(defRatio(s.defModele) || {});
  return `<section class="panel">
    <div class="card"><h2>Modèle de défense</h2>
      <p class="note"><b>${esc(DEF_MODELES[s.defModele].n)}</b> · ${s.defPalier === 'fill' ? 'compléter l\'existant' : `${s.defPalier} ${esc(DEF[anc].p)}`} <button class="btn sm ghost" data-goto="settings:defense">Modifier</button></p>
      ${defModeleCarte(s.defModele)}
      <p class="note">Le modèle donne la proportion entre les pièces, le palier la taille. Rien ne se construit ici, et le plan du jour garde son propre budget : la moitié d'une nuit de production, de quoi rendre le pillage non rentable.</p>
    </div>
    ${S.planets.map(defCarte).join('')}
  </section>`;
},
fleet(){
  const ex=S.expo, fc=S.fleetCalc;
  return `<section class="panel">
    ${flotteCibleHtml()}
    <div class="card"><h2>Taille d'expédition</h2>
      <div class="grid">
        <label class="f">Points du n°1 de l'univers<select id="top1" data-set="top1">${EXPO_LABELS.map((l,i)=>`<option value="${i}" ${S.settings.top1==i?'selected':''}>${l}</option>`).join('')}</select>${API && API.scores ? `<span class="note">Lu dans le classement public : ${EXPO_LABELS[top1Tier()]}. Ce réglage ne sert plus.</span>` : '<span class="note">Sera lu dans le classement public dès que l\'extension aura joint l\'API du serveur.</span>'}</label>
      </div>
      <div class="grid">
        <label class="f">Facteur de fret<input id="expoFret" type="number" min="1" step="10" data-set="expoFret" value="${num(S.settings.expoFret, EXPO_FRET)}"><span class="note">Ressources ramenées par point de flotte. Le fret visé en découle : ${fmt(expoPts())} points × ce facteur × éco x${ecoSpeed()} = <b>${fmt(expoFret())}</b>. ${(p=>p.prop ? `Tes ${p.n} dernières expéditions à ressources suggèrent ${fmt(p.prop)}${p.pleines ? ' (borne basse : soutes souvent pleines)' : ''}.` : `Calibré sur tes retours réels à partir de ${EXPO_CALIB_MIN} expéditions à ressources (${p.n} pour l'instant).`)(expoFretPropose(S.expoLog, S.settings.expoFret))}</span></label>
        <label class="f">Réserve de grands transporteurs<input id="expoRes" type="number" min="0" data-set="expoRes" value="${expoRes(null)}"><span class="note">Par planète, jamais pris par une expédition : ce sont ceux des convois et de la mise à l'abri du soir.</span></label>
        <label class="f">Durée d'exploration par défaut (h)<input id="expoHold" type="number" min="1" max="24" data-set="expoHold" value="${Math.max(1, Math.round(num(S.settings.expoHold,1)))}"><span class="note">Une heure rapporte le plus à l'heure passée en l'air. En mode nuit, le plan allonge de lui-même pour que la flotte rentre à ton retour.</span></label>
      </div>
      <div class="bascules">
        ${bascule('expoPf','data-expo="pf"','Éclaireur dans la flotte', ex.pf)}
      </div>
      <div class="res" id="expoOut"></div>
      <p class="note" id="expoNote"></p>
    </div>
    ${expoCalibHtml()}
    ${expoStatsHtml()}
    <div class="card"><h2>Temps de vol et carburant</h2>
      <div class="grid">
        <label class="f">Départ<input id="fFrom" data-fc="from" value="${esc(fc.from)}" placeholder="1:1:8"></label>
        <label class="f">Arrivée<input id="fTo" data-fc="to" value="${esc(fc.to)}" placeholder="1:2:8"></label>
        <label class="f">Vitesse<select id="fPct" data-fc="pct">${[100,90,80,70,60,50,40,30,20,10].map(v=>`<option ${fc.pct==v?'selected':''}>${v}</option>`).join('')}</select></label>
      </div>
      <div class="grid tight">${Object.keys(SHIPS).map(k=>`<label class="f">${SHIPS[k].n}<input id="fs-${k}" type="number" min="0" data-ship="${k}" value="${num(fc.ships[k])}"></label>`).join('')}</div>
      <div class="res" id="flightOut"></div>
      <p class="note">Pour un aller-retour, double la durée et le carburant. Une expédition ajoute son temps de stationnement (1 h par défaut) et un peu de carburant de maintien non compté ici.</p>
    </div>
    <div class="card"><h2>Vaisseaux avec tes technologies</h2><div class="tbl-wrap"><table><thead><tr><th>Vaisseau</th><th>Propulsion</th><th class="n">Vitesse</th><th class="n">Soute</th></tr></thead><tbody id="shipTbl"></tbody></table></div></div>
  </section>`;
},
colony(){
  const c = S.colo;
  /* La planète de départ ne se choisit que quand elle se choisit vraiment : un
     vaisseau déjà à quai décide, et sinon c'est le centre de l'empire. Le menu
     restait affiché par-dessus sa propre note qui disait qu'il ne servait à
     rien — deux lignes pour un réglage inerte, au-dessus de la seule question
     de la page. */
  const choixDep = colShipAt()<0 && !centrePlanet() && S.planets.length>1;
  return `<section class="panel">
    <div class="card"><div class="row spread"><h2>Choisir la position</h2><span id="coSlots"></span></div>
      <ul class="advice" id="coReq"></ul>
      <div class="grid">
        <label class="f">Objectif<select id="coObj" data-colo="objective">${Object.entries(OBJECTIVES).map(([k,o])=>`<option value="${k}" ${c.objective===k?'selected':''}>${o.n}</option>`).join('')}</select></label>
        <label class="f">Cases bonus de l'univers<input id="coBonus" type="number" min="0" data-colo="bonus" value="${+c.bonus?num(c.bonus):''}" placeholder="${(API&&API.server&&API.server.bonusFields)||0}"></label>
      </div>
      <div id="coCand"></div>
      <details class="volet mt-3"${fold('cobareme', false)}><summary data-fold="cobareme">Ce que vaut chaque emplacement d'un système</summary>
      <p class="note mt-2">Dans OGame, chaque système porte <b>quinze emplacements numérotés de 1 à 15</b>, et ce numéro décide de tout : la taille de la planète, sa température, son bonus de production. Le tableau dit ce que vaudrait ta colonie à chaque numéro, dans n'importe quel système — c'est un barème, pas une liste de cases libres : celle-là est au-dessus. Les trois meilleurs numéros pour ton objectif portent leur rang.</p>
      <div class="tbl-wrap mt-2"><table><thead><tr><th>#</th><th class="n">Pos.</th><th>Cases (min–max)</th><th class="n">Temp.</th><th>Bonus</th><th class="n">Éq. métal/h</th><th class="n">Deut/h</th><th></th></tr></thead><tbody id="coPos"></tbody></table></div>
      <p class="note">Production simulée avec les niveaux de mines de ta planète de départ, à la température moyenne de l'emplacement ; les cases réelles varient dans la fourchette indiquée. Les lignes grisées demandent plus d'Astrophysique. « Choisir » prend la meilleure case <b>libre</b> à ce numéro autour de toi.</p></details>
    </div>
    <div class="card"><h2>Flotte et ressources à emporter</h2>
      <div class="grid">
        ${choixDep?`<label class="f">Planète de départ<select id="coFrom" data-colo="fromId">${S.planets.map(p=>`<option value="${p.id}" ${c.fromId===p.id?'selected':''}>${esc(p.name)} [${esc(p.coords)}]</option>`).join('')}</select></label>`:''}
        <label class="f">Vaisseau de colonisation<select id="coBuilt" data-colo="built"><option value="0" ${!colBuilt()?'selected':''}>À construire</option><option value="1" ${colBuilt()?'selected':''}>Déjà construit${colShipAt()>=0?' (vu dans ta flotte)':''}</option></select></label>
        <label class="f">Destination<input id="coTarget" data-colo="target" value="${esc(c.target)}" placeholder="${esc(coloTarget())}"></label>
        <label class="f">Kit de démarrage<select id="coKit" data-colo="kit">${Object.entries(KITS).map(([k,o])=>`<option value="${k}" ${c.kit===k?'selected':''}>${o.n}</option>`).join('')}</select></label>
        <label class="f">Transporteurs<select id="coTr" data-colo="tr"><option value="sc" ${c.tr==='sc'?'selected':''}>Petits</option><option value="lc" ${c.tr==='lc'?'selected':''}>Grands</option></select></label>
      </div>
      <div id="coFleet"></div>
    </div>
    <div class="card"><h2>Après l'arrivée</h2>
      <div class="grid">
        <label class="f">Cases de la nouvelle planète<input id="coFields" type="number" min="1" data-colo="fields" value="${esc(c.fields)}" placeholder="ex. 187"></label>
        <label class="f">Position<input id="coFpos" type="number" min="1" max="15" data-colo="fpos" value="${esc(c.fpos)}" placeholder="${(parseC(coloTarget())||[])[2]||''}"></label>
      </div>
      <div id="coEval"></div>
      <ol class="note etapes">
        <li>Choisis la forme de vie de la colonie : <b>${esc(LIFEFORMS[lfPourPos((parseC(c.target || coloTarget())||[])[2]||0)].n)}</b> — ${esc(lfRaisonPos((parseC(c.target || coloTarget())||[])[2]||0))}.</li>
        <li>Envoie les transporteurs du kit en mission <b>Transporter</b>, une fois la colonie créée.</li>
        <li>Ordre de construction : solaire, puis métal et cristal en alternance, deutérium ensuite, robots 2 dès que possible.</li>
        <li>L'extension ajoute la colonie toute seule dès que tu la visites dans le jeu.</li>
      </ol>
    </div>
  </section>`;
},
settings(){
  const s=S.settings, d=S.day;
  const ecart = classeEcart();
  /* ENH-54 : treize cartes empilées faisaient une page de 5 800 px. Elles se
     rangent en cinq onglets (CARTES.settings) ; toutes restent dans le DOM,
     masquées, pour que REFRESH.settings et bind() les trouvent. */
  return cardLayout('settings', {
    jeu: `
    <div class="card"><h2>Profil et plan du jour</h2>
      <p class="note">${S.profil.set ? `Ton profil : <b>${esc(profilLigne())}</b>.` : 'Pas encore renseigné : l\'assistant t\'attend en tête d\'Aujourd\'hui.'}</p>
      ${S.profil.set ? `<div class="chips mt-2">${profilFocusHtml()}</div>
      ${aide('focus', '<p class="note">Les focus ponctuels remontent leurs cartes sans remplacer ton style. Les poids de chaque catégorie sont dans <code>profils.js</code>.</p>')}` : ''}
      ${ecart ? `<p class="note">${esc(ecart)}</p>` : ''}
      <div class="row mb-3"><button class="btn sm ghost" data-refaire="1">Refaire le questionnaire</button></div>
      <div class="grid">
        <label class="f">Ce que le plan vise<select id="dFocus" data-day="focus">${Object.entries(FOCUS).map(([k,l])=>`<option value="${k}" ${d.focus===k?'selected':''}>${l}</option>`).join('')}</select>${planPoseParLeStyle() ? `<span class="note">Posé par ton style (${esc(PROFILS.styles[S.profil.style].n)}).</span>` : ''}</label>
        <label class="f">Place de la recherche<select id="dRes" data-day="research">${Object.entries(RESEARCH_MODE).map(([k,l])=>`<option value="${k}" ${researchMode()===k?'selected':''}>${l}</option>`).join('')}</select></label>
        <label class="f">Place des formes de vie<select id="dLf" data-day="lf">${Object.entries(LF_MODE).map(([k,l])=>`<option value="${k}" ${lfMode()===k?'selected':''}>${l}</option>`).join('')}</select></label>
        <label class="f">Je me connecte toutes les<select id="dInt" data-day="interval">${[30,60,90,120,180].map(v=>`<option value="${v}" ${+d.interval===v?'selected':''}>${v} min</option>`).join('')}</select></label>
        <label class="f">Horizon<select id="dHz" data-day="horizon">${[12,24,48].map(v=>`<option value="${v}" ${+d.horizon===v?'selected':''}>${v} h</option>`).join('')}</select></label>
        <label class="f">Nuit : de (heure) — coucher<input id="dNs" type="time" data-day="nightStart" value="${hhmmDe(d.nightStart)}"></label>
        <label class="f">à (heure) — réveil<input id="dNe" type="time" data-day="nightEnd" value="${hhmmDe(d.nightEnd)}"></label>
      </div>
      <div class="bascules">
        ${bascule('dNight', 'data-day="night"', 'Mise à l\'abri (nuit, absence)', d.night)}
      </div>
      <div class="grid">
        <label class="f">Retour vers (heure)<input id="dBack" type="time" step="3600" data-day="backHour" value="${d.backHour==null?'':hhmmDe(d.backHour)}"><span class="note">Vide : retour dans ${nightLen()} h, la durée de la nuit.</span></label>
      </div>
      <p class="note" id="daySum"></p>
      ${aide('jour', '<p class="note" id="aideJour"></p>')}
    </div>
    <div class="card"><h2>Formes de vie découvertes</h2>
      <div class="chips">${lfSettingsHtml()}</div>
      <p class="note">Copilote s'en sert pour te conseiller la forme de vie de tes colonies.</p>
      ${raceRows()}
    </div>
    <div class="card"><h2>Bonus</h2>
      <div class="bascules">
        ${bascule('sGeo','data-set="geo"','Géologue (+10 % production)', s.geo)}
        ${bascule('sEng','data-set="eng"','Ingénieur (+10 % énergie)', s.eng)}
        ${bascule('sOver','data-set="crawlerOverload"','Foreuses en surcharge 150 %', s.crawlerOverload, 'Moitié plus de bonus, énergie doublée. À régler comme dans le jeu.')}
        ${bascule('sColCargo','data-set="colCargo"','Collecteur : +25 % soute transporteurs', s.colCargo)}
      </div>
      <div class="grid">
        <label class="f">Ratio d'échange M:C:D<input id="sRatio" data-set="ratio" value="${s.ratio.join(':')}"></label>
      </div>
    </div>
    <div class="card"><h2>Énergie</h2>
      <div class="bascules">
        ${bascule('sSats','data-set="sats"','Autoriser les satellites solaires dans les recommandations', s.sats, 'Moins chers que la centrale sur une planète chaude, mais un satellite part en débris au premier raid, grossit le butin de l\'attaquant, et l\'énergie retombe avec lui. Ceux que tu as déjà posés comptent dans ta production, réglage ou non.')}
      </div>
      ${aide('energie', '<p class="note">Sans cette case, le copilote ne propose que la centrale solaire et la centrale de fusion. Planète par planète, le réglage se surcharge dans l\'onglet Planètes.</p>')}
    </div>`,
    defense: `
    <div class="card"><h2>Modèle de défense</h2>
      <div class="grid">
        <div class="f"><span>Modèle</span>${defPicker(s.defModele)}</div>
        <label class="f">Palier visé<select id="sDefP" data-def="palier">${defPalierOpts(s.defPalier)}</select><span class="note">En ${esc(DEF[defAncre(defRatio(s.defModele) || {})].p)}. « Compléter » part de ce que la planète a déjà.</span></label>
        ${(()=>{ const st = S.profil.set ? PROFILS.styles[S.profil.style] : null; if(!st || st.plancher == null) return '';
          const v = s.defPlancher == null ? '' : String(s.defPlancher);
          return `<label class="f">Plancher<select id="sDefF" data-def="plancher"><option value="" ${v===''?'selected':''}>Comme le profil (${st.plancher})</option>${DEF_PLANCHERS.map(x=>`<option value="${x}" ${v===String(x)?'selected':''}>${x === 0 ? 'Aucun' : x}</option>`).join('')}</select><span class="note">En packs du modèle. Profil ${esc(st.n)} : tant que le palier n'est pas atteint, ses cartes passent d'abord.</span></label>`; })()}
        <label class="f">Durée max d'une carte<select id="sDefD" data-def="duree">${DEF_DUREES.map(x=>`<option value="${x}" ${num(s.defDuree,4)===x?'selected':''}>${x} h de chantier</option>`).join('')}</select><span class="note">Au-delà, le reste sort sur la carte suivante.</span></label>
      </div>
      ${defModeleCarte(s.defModele)}
      ${s.defModele === 'perso' ? `<div class="grid tight">${DEF_RATIO.map(k=>`<label class="f">${esc(DEF[k].n)}<input id="sDefR-${k}" type="number" min="0" step="1" data-def="${k}" value="${num(S.settings.defPerso[k])}"></label>`).join('')}</div>
      <p class="note">Combien de pièces par lanceur de plasma. Les deux boucliers restent hors modèle.</p>` : ''}
      ${S.profil.set && s.defModele === (PROFILS.styles[S.profil.style] || {}).defense
        ? `<p class="note">Posé par ton profil (<b>${esc(PROFILS.styles[S.profil.style].n)}</b>). En choisir un autre ici le détache du profil : refaire le questionnaire ne le remettra plus.</p>` : ''}
      ${aide('defense', '<p class="note">Les cartes Défense du plan ne proposent que les pièces de ce modèle, dans ses proportions. Outils › Défense dit, planète par planète, ce qui manque et ce que ça coûte ; une planète peut y prendre un autre modèle que celui-ci.</p>')}
    </div>
    ${secuCard()}`,
    affichage: `
    <div class="card"><h2>Allure du panneau</h2>
      <div class="grid">
        <label class="f">Thème<select id="sSkin" data-set="skin">${Object.entries(HABILLAGES).map(([k,l])=>`<option value="${k}" ${habillage()===k?'selected':''}>${l}</option>`).join('')}</select></label>
      </div>
      <div class="bascules">
        ${bascule('sMuet','data-set="muet"','Couper le son', s.muet, 'Plus de carillon à la fin d\'un minuteur, et les notifications du navigateur arrivent sans bruit.')}
      </div>
      <div class="row"><button class="btn ghost" id="uiReset">Réinitialiser l'affichage des cartes</button></div>
      ${aide('allure', '<p class="note">Relief suit le clair ou le sombre de ton système ; les trois autres sont sombres. Le changement se voit tout de suite, sur toutes les pages.</p><p class="note mt-2">Les cartes et les sections que tu as ouvertes ou fermées le restent, sur ce poste, d\'une page et d\'une session à l\'autre. « Réinitialiser l\'affichage des cartes » les remet comme au premier jour : alertes ouvertes, le reste fermé.</p>')}
    </div>
    ${affichageCard()}
    <div class="card"><h2>Page du jeu</h2>
      <div class="bascules">
        ${masqueCases('sMq')}
        ${bascule('sLean','data-set="lean"','Épurer la page du jeu', s.lean, 'En-tête et pied de page en moins ; fond sombre, menu plus grand.')}
        ${bascule('sNoShop','data-set="noshop"','Masquer les menus payants', s.noshop, 'Marchand, Mess des officiers, boutiques.')}
      </div>
      <div class="row"><button class="btn" type="button" data-masque-tout>${toutMasque() ? 'Tout afficher' : 'Tout masquer'}</button></div>
      <p class="note">Allure seulement : la page du jeu, pas ce panneau, ni les calculs.</p>
      ${aide('page', '<p class="note">Masqué, pas supprimé : les éléments restent dans la page et le jeu marche comme avant. La barre de ressources, les planètes, le menu et les alertes du jeu ne se masquent jamais. Chaque choix s\'applique tout de suite, dans tous les onglets ouverts, et se retrouve au prochain lancement.</p>')}
    </div>`,
    moteur: `
    ${reglesCard()}
    <div class="card"><h2>Fiabilité des calculs</h2>
      <p class="note">Formules communautaires (wiki OGame, forum officiel) : compare une fois avec ton jeu et ajuste les réglages si besoin.</p>
      ${aide('fiabilite', '<p class="note">Production, coûts et temps de vol sont stables depuis des années. Moins sûrs : la production de deutérium (formule des univers récents, dépend de la température max), la durée des bâtiments de niveau 1 à 5, et les plafonds d\'expédition.</p>')}
    </div>`,
    donnees: `
    <div class="card"><h2>Sauvegarde</h2>
      <p class="note">Tes données restent dans ce navigateur.</p>
      <div class="row"><button class="btn" id="ioSave">Enregistrer dans un fichier</button><button class="btn" id="ioLoad">Charger un fichier…</button><input type="file" id="ioFile" accept="application/json,.json" hidden><button class="btn ghost" id="ioReset">Réinitialiser…</button><span class="note" id="ioMsg"></span></div>
      <textarea id="ioText" aria-label="Données JSON" placeholder="Ou colle ici une sauvegarde pour l'importer"></textarea>
      <div class="row"><button class="btn" id="ioImport">Importer le texte collé</button></div>
      ${aide('sauvegarde', '<p class="note">« Enregistrer » écrit un fichier <code>save.json</code> : mets-le dans le dossier du dépôt et pousse-le, puis « Charger » le relit sur l\'autre poste.</p>')}
      ${noListe()}
    </div>
    ${versionCard()}`,
  });
},
};

const gauge = (k,cls,label,v,sub) => `<div class="gauge"><span class="k"><i class="bg-${cls}"></i>${label}</span><span class="v c-${cls}">${v}</span>${sub?`<span class="s">${sub}</span>`:''}</div>`;
function factorPill(f){ return f>=1 ? `<span class="pill good">Énergie OK</span>` : `<span class="pill ${f<.8?'bad':'warn'}">Rendement ${Math.round(f*100)} %</span>`; }
/* Les foreuses sont invisibles dans le jeu une fois posées : cette pastille est
   le seul endroit qui dise combien en profitent encore, et ce qu'elles ajoutent.
   La surcharge se lit sur la planète quand elle y est connue, comme le fait
   production() — sinon le pourcentage contredirait les jauges d'à côté. */
function crawlerPill(p){
  const max = crawlerMax(p.b.metal, p.b.crystal, p.b.deut); if(!max) return '';
  const have = p.crawlers||0, over = p.overload != null ? p.overload : S.settings.crawlerOverload;
  const pct = (crawlerBonus(Math.min(have,max), S.settings.cls, over)*100).toFixed(1).replace('.',',');
  return `<div class="wide"><span class="pill ${have>=max?'good':'info'}">Foreuses ${fmt(have)} / ${fmt(max)} utiles · +${pct} %</span></div>`;
}

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

const REFRESH = {
today(){
  /* L'historique des débordements avance avec le relevé : c'est lui qui dit,
     plus bas, si le hangar se justifie (sept jours glissants). */
  try{ surplusNote(Date.now()); }catch(e){ console.error('Copilote : historique des débordements', e); }
  const plan = simulateDay(), s0 = plan.sessions[0], night = !!S.day.night;
  /* Mode nuit : ni construction ni recherche à lancer, le panneau ne doit
     montrer que la mise à l'abri. Le plan est recalculé à chaque passage,
     le vider ici ne perd rien. */
  if(night) for(const x of plan.sessions){ x.acts = []; x.waits = []; }
  const nowParts = [], a0 = actsVus(s0);
  /* Un rapatriement proposé dit aussi quels vaisseaux faire suivre pour
     rapprocher l'arrivée de sa flotte cible. Copie de l'acte : le plan le garde tel quel. */
  if(!night && a0.some(a=>a.kind==='transfer')){
    const fcR = flotteCible(plan.now);
    a0.forEach((a, i) => { if(a.kind !== 'transfer') return;
      const dst = S.planets.find(p => p.coords === a.dest), aj = flotteAjout(fcR, S.planets[a.p], dst);
      if(aj) a0[i] = Object.assign({}, a, {why: [a.why, aj].filter(Boolean).join(' ')}); });
  }
  const missions = dailyMissions().filter(m=>!missionDone(m) && !refused('m:'+m.id));
  /* La page du jeu surligne ce que le plan recommande et pose la bande du bas.
     Elle n'en fait rien d'autre : aucun clic, aucun envoi, ce sont des repères.
     Publié ici, après les missions, parce que la bande les porte. */
  if(IS_EXT) try{ chrome.storage.local.set({skin: gameSkin(s0.acts, missions, s0.waits)}); }catch(e){}
  /* Les focus qui n'ont rien à déplacer en ce moment : leur catégorie existe,
     mais aucune carte à l'écran ne la porte. C'est dit ici et non à la
     composition de la carte, parce que seul le rafraîchissement connaît le
     plan — et dit, parce qu'une case qui ne peut rien faire sans l'annoncer
     laisse croire que le panneau ne répond pas. Le poids, lui, reste juste :
     la catégorie est bien poussée, il n'y a simplement rien à pousser. */
  const pfMuets = document.getElementById('pfMuets');
  if(pfMuets){
    const portees = new Set(missions.map(catMission)
      .concat([].concat(...plan.sessions.map(x=>x.acts.map(catActe)))).filter(Boolean));
    const muets = Object.values(PROFILS.focus)
      .filter(f=>f.cats.every(c=>!portees.has(c))).map(f=>f.court || f.n);
    pfMuets.textContent = muets.length
      ? `Rien à déplacer pour l'instant, aucune carte n'en relève : ${muets.join(', ')}.` : '';
  }
  const timed = missions.filter(meteoVoit).filter(m=>m.at && m.at > plan.now), slotMs = new Map();
  for(const m of timed){ let host = null; for(const x of plan.sessions) if(x.T <= m.at) host = x; if(host && host!==s0){ if(!slotMs.has(host)) slotMs.set(host, []); slotMs.get(host).push(m); } else m.at = 0; }
  const nowMs = missions.filter(meteoVoit).filter(m=>!m.info && !(m.at && m.at > plan.now && [...slotMs.values()].some(l=>l.includes(m))));
  const infoMs = missions.filter(meteoVoit).filter(m=>m.info);
  const taskHtml = m=>{
    const ck = missionKey(m), how = ck + '.comment-faire'; uiVu(ck);
    const [wi, wb] = whyParts([m.why], ck);
    const meta = (m.tags||[]).map(planetTag).join('') + (m.sol ? `<span>${esc(m.sol)}</span>` : '') + copyChips(m);
    const btns = `<button class="btn sm" data-done="${m.id}"${m.mark?` data-mark="${m.mark.join(',')}"`:''}>Fait</button>${noBtn('m:'+m.id)}`;
    return `<li class="task" data-ck="${esc(ck)}"${goAttr(missionGo(m))}><div><div class="q">${qHtml(m.q||'À faire')}${wi}</div><div class="w">${m.whatHtml || esc(m.what)}</div></div><span class="btns">${btns}</span>${meta?`<div class="m">${meta}</div>`:''}${wb}<details class="how"${fold(how, false)}><summary data-fold="${esc(how)}">Comment faire</summary><ol>${m.how.map(x=>`<li>${x}</li>`).join('')}</ol></details></li>`;
  };
  /* Une carte « Urgent » passe la limite. */
  const tache = m => ({html: taskHtml(m), crit: m.sev === 'bad'});
  const cartesNow = a0.map(a=>({html: actHtml(a,true), crit: false})).concat(nowMs.map(tache));
  /* Le compteur dit tout ce que la liste porte, cartes masquées comprises. */
  const nN = document.getElementById('tdNowN'); if(nN) nN.textContent = cartesNow.length ? `(${cartesNow.length})` : '';
  if(cartesNow.length) nowParts.push(listeCartes('maintenant', cartesNow, 'acts'));
  const RN = ['métal','cristal','deutérium'];
  const missTxt = w => { const parts = (w.miss||[]).map((x,j)=>x>0?`${fmt(x)} ${RN[j]}`:'').filter(Boolean); return parts.length ? 'Il manque '+parts.join(' · ') : ''; };
  /* Les conseils finançables plus tôt passent devant : ceux de maintenant sont
     déjà en tête, comme actions ; puis les attentes, de la plus courte à la
     plus longue. Un tri stable garde l'ordre du moteur à heure égale. */
  s0.waits.sort((x,y)=>(isFinite(x.eta)?x.eta:Infinity) - (isFinite(y.eta)?y.eta:Infinity) || 0);
  const waits0 = s0.waits.filter(meteoVoit), busy0 = plan.busy.filter(meteoVoit);
  if(waits0.length) nowParts.push(`<details class="volet"${fold('attente', false)}><summary class="note" data-fold="attente">En attente de ressources (${waits0.length})</summary>${cartesMenu('attente')}${listeCartes('attente', waits0.map(w=>({crit:false, html:`<li class="wait"><div><div class="q">${qHtml(w.q)}</div><div class="w">${esc(w.what)}</div></div><span class="pill ${w.fin && w.fin.statut==='jamais' ? 'bad' : 'warn'}">${w.fin ? esc(statutFinancement(w.fin)) : isFinite(w.eta)?'ressources réunies vers '+formatTime(plan.now+w.eta*1000):'à faire livrer, ou agrandir le hangar'}</span><div class="m">${esc(missTxt(w))}${isFinite(w.eta)?` <span>(dans ${dur(w.eta)})</span>`:''}</div>${w.why?`<div class="m">${esc(w.why)}</div>`:''}${w.heldBy?`<div class="m">Retenu : tu épargnes pour ${esc(w.heldBy)}.</div>`:''}</li>`})), 'acts')}</details>`);
  if(busy0.length || infoMs.length) nowParts.push(`<details class="volet"${fold('encours', false)}><summary class="note" data-fold="encours">Déjà en cours (${busy0.length + infoMs.length})</summary>${cartesMenu('encours')}${listeCartes('encours', busy0.map(b=>({crit:false, html:`<li class="busy"><div><div class="q">${qHtml(b.q)} · en cours</div><div class="w">${esc(b.what)}</div></div><span class="mono note">fin ${formatTime(b.end)}</span></li>`})).concat(infoMs.map(m=>({crit:false, html:`<li class="busy"><div><div class="q">${qHtml(m.q)} · info</div><div class="w">${esc(m.what)}</div></div><span></span><div class="m">${(m.tags||[]).map(planetTag).join('')}${esc(m.why)}</div></li>`}))), 'acts')}</details>`);
  const nextS = plan.sessions.slice(1).find(x=>actsVus(x).length);
  if(!a0.length && !nowMs.length) nowParts.unshift(`<p class="note">Rien à lancer pour l'instant.${nextS?` Prochaine action à <b>${formatTime(nextS.T)}</b>.`:''}</p>`);
  const aide = `<details class="volet"${fold('aide', false)}><summary class="note" data-fold="aide">Comment lire ces cartes</summary><p class="note mt-2"><b>Lancé</b> ou <b>Fait</b> quand c'est fait dans le jeu : le plan se recalcule. <b>Non</b> met la carte de côté jusqu'à ce que tu la remettes. Une carte de flotte ouvre le formulaire du jeu déjà préparé ; les valeurs marquées ⧉ se copient d'un clic.${IS_EXT?'':' Si une file est déjà occupée dans le jeu, ajoute son minuteur.'}</p></details>`;
  const remets = noListe();
  document.getElementById('tdNow').innerHTML = nowParts.join('') + aide + prioHtml(plan) + remets;
  /* Ce que chaque carte contient, pour le compteur de son onglet : les
     chantiers sont des conseils, les missions portent leur gravité. */
  RESUMES.maintenant = resumeDe(a0.map(()=>({sev:'info'})).concat(nowMs.map(m=>({sev:m.sev, key:'m:'+m.id}))), 'maintenant');
  /* Le bloc Expéditions se recalcule à chaque passage, comme le reste : un
     emplacement qui se libère — retour de flotte, échec, annulation — fait
     apparaître sa recommandation sans que le joueur recharge la page. */
  const eb = document.getElementById('expoBloc');
  if(eb){ const r = expoHtml(); eb.innerHTML = r.html; document.getElementById('expoSum').textContent = r.sum;
    RESUMES.expeditions = resumeDe(Array.from({length:r.n || 0}, ()=>({sev:'info'})), 'expeditions'); }
  /* La sécurité se calcule même en mode nuit : une attaque ne dort pas. Les
     conseils finançables maintenant, ceux de la première connexion, nourrissent
     les dépenses d'urgence ; vidés en mode nuit, le plan retombe sur le stock. */
  try{ const sc = securiteHtml(s0.acts); document.getElementById('tdSecuAlerte').innerHTML = sc.alerte; document.getElementById('tdSecu').innerHTML = sc.bloc;
    /* Une attaque est critique : son onglet prend la main, une fois. */
    RESUMES.attaque = resumeDe(sc.items, 'attaque');
    RESUMES.securite = sc.rappel ? {count:1, maxLevel:'imp', critiques:[]} : null; }
  catch(e){ console.error('Copilote : plan de sécurité', e); }
  /* Le bloc des conseils du moteur tient la place de l'ancienne carte
     Alertes : les constats non servis et non ignorés, puis les alertes qui ne
     sont pas des règles. Le compteur de l'onglet compte les mêmes lignes. */
  try{ const sp = surplusHtml(plan); RESUMES.surplus = resumeDe(sp.items, 'surplus'); document.getElementById('tdSurplus').innerHTML = sp.html; }
  catch(e){ console.error('Copilote : ressources en trop', e); }
  RESUMES.alertes = resumeDe(conseilLignes(plan).filter(meteoVoit).map(a=>({sev:a.sev, key:a.what})), 'alertes');
  document.getElementById('tdAlerts').innerHTML = conseilsHtml(plan);
  publieCritiques(plan.constats);
  const later = plan.sessions.slice(1).filter(x=>actsVus(x).length || slotMs.has(x));
  const slot = x=>`<div class="slot"><div class="time">${formatTime(x.T)}<small>dans ${dur((x.T-plan.now)/1000)}</small></div><ul class="acts">${actsVus(x).map(a=>actHtml(a,false)).join('')}${(slotMs.get(x)||[]).map(taskHtml).join('')}</ul></div>`;
  const gain = plan.startV>0 ? (plan.endV/plan.startV-1)*100 : 0;
  const phases = [], horizonEnd = plan.now + (+S.day.horizon||24)*3600e3;
  for(const x of plan.sessions){ const key = x.goals.map(g=>g.key).join('|') || 'free'; const last = phases[phases.length-1]; if(last && last.key===key) continue; if(last) last.to = x.T; phases.push({key, from:x.T, to:horizonEnd, goals:x.goals}); }
  const nightStartAfter = t=>{ const d = poseHeure(new Date(t), +S.day.nightStart); if(d.getTime() <= t) d.setDate(d.getDate()+1); return d.getTime(); };
  for(const ph of phases){ const n = nightStartAfter(ph.from); if(n < ph.to) ph.to = n; }
  const launchedAt = label => { for(const x of plan.sessions) if(x.acts.some(a=>a.what===label || (label==='le vaisseau de colonisation' && a.kind==='ship'))) return x.T; return null; };
  const phaseHtml = ph => {
    if(ph.key==='free') return `<li><span class="pill good">Soutenu</span><span class="what">${formatTime(ph.from)} → ${formatTime(ph.to)}</span><span class="why">Rien de gros à financer : dépense tout à chaque connexion, mines et bâtiments à la chaîne.</span></li>`;
    const txt = ph.goals.map(g=>{ const at = launchedAt(g.label); return `on garde le ${g.res} pour ${g.label}${at?`, lancement vers ${formatTime(at)}`:''}`; }).join(' ; ');
    return `<li><span class="pill warn">Tempo</span><span class="what">${formatTime(ph.from)} → ${formatTime(ph.to)}</span><span class="why">${esc(txt.charAt(0).toUpperCase()+txt.slice(1))}. Les bâtiments n'utilisent que le surplus. Bon moment pour la flotte : expéditions, espionnage d'inactifs.</span></li>`;
  };
  const strategy = `<ul class="advice mb-3">${phases.slice(0,5).map(phaseHtml).join('')}</ul>`;
  /* Où en est le début de partie. Le compte est le nombre de jalons franchis,
     qui peuvent l'être dans le désordre : on peut tenir Astrophysique sans
     Ordinateur 2. « Prochaine étape » est le premier non franchi dans l'ordre
     de la liste, celui qui ouvre la suite. Le bloc s'efface de lui-même une
     fois les onze acquis. */
  const mDone = MILESTONES.filter(m=>milestoneDone(m)).length, mNext = MILESTONES.find(m=>!milestoneDone(m));
  const mMiss = mNext ? milestoneMissing(mNext) : [];
  const debut = mNext ? `<ul class="advice mb-3"><li><span class="pill info">Début de partie · ${mDone} / ${MILESTONES.length}</span><span class="what">Prochaine étape : ${esc(milestoneLabel(mNext))}</span><span class="why">${mMiss.length?`Il manque : ${esc(mMiss.join(', '))}. `:''}${esc(mNext.why)}</span></li></ul>` : '';
  document.getElementById('tdDay').innerHTML = night ? `<p class="note">Mode nuit : seule la mise à l'abri compte. Le plan du jour revient dès que tu repasses en mode jour.</p>` : debut + strategy + (later.length
    ? `<div class="tl">${later.slice(0,6).map(slot).join('')}</div>${later.length>6?`<details class="volet mt-3"${fold('journee.suite', false)}><summary class="note" data-fold="journee.suite">Voir les ${later.length-6} connexions suivantes</summary><div class="tl mt-3">${later.slice(6).map(slot).join('')}</div></details>`:''}`
    : `<p class="note">Aucune action prévue sur la période : tes files sont occupées ou tes ressources trop faibles.</p>`)
    + `<div class="sumline mt-3"><span class="pill good">Production ${gain>=0?'+':''}${gain.toFixed(1).replace('.',',')} %</span><span class="note">en ${S.day.horizon} h, de ${fmt(plan.startV)} à ${fmt(plan.endV)} éq. métal/h</span></div>`
    + (plan.ups.length ? `<p class="note mt-2">${esc(plan.ups.join(' · '))}</p>` : '')
    + `<p class="note mt-2">Connexions sans action masquées. Avant une longue absence, dépense ou mets tes ressources à l'abri.</p>`;
  renderTimers();
  document.getElementById('tdDaySum').textContent = night ? 'mode nuit'
    : `${later.length} connexion${later.length>1?'s':''} à venir · production ${gain>=0?'+':''}${gain.toFixed(1).replace('.',',')} % en ${S.day.horizon} h`;
},
empire(){ REFRESH.planets(); REFRESH.research(); },
/* Le seul retour de l'écran Réglages. Sans lui, changer la priorité, l'horizon
   ou l'intervalle n'affichait rien du tout : la valeur partait bien au
   stockage et le plan s'en servait, mais il fallait passer sur Aujourd'hui
   pour savoir si le choix avait pris. Un réglage muet est un réglage dont on
   doute — et le badge du haut, lui, ne parle que de l'univers. */
settings(){
  const el = document.getElementById('daySum'); if(!el) return;
  const d = S.day;
  /* Avant le retour du mode nuit : les menus restent à l'écran la nuit, et une
     phrase qui disparaît quand le plan dort n'explique plus rien. */
  const choix = {focus: [d.focus, FOCUS], research: [researchMode(), RESEARCH_MODE], lf: [lfMode(), LF_MODE]};
  const aide = document.getElementById('aideJour');
  if(aide) aide.innerHTML = Object.keys(AIDE_JOUR).map(k=>{
    const [v, table] = choix[k];
    return `<b>${esc(AIDE_JOUR[k].t)}</b> · ${esc(table[v] || '')} — ${esc(AIDE_JOUR[k].v[v] || '')}`;
  }).join('<br>');
  if(d.night){ el.textContent = 'Mode nuit : le plan est en pause, seule la mise à l\'abri compte.'; return; }
  const plan = simulateDay();
  /* Les connexions qui portent quelque chose, dites comme telles : le résumé
     d'Aujourd'hui compte aussi les missions, et deux lignes qui annoncent le
     même mot avec deux chiffres différents est le pire des deux mondes. */
  const n = plan.sessions.slice(1).filter(x=>actsVus(x).length).length;
  const gain = plan.startV>0 ? (plan.endV/plan.startV-1)*100 : 0;
  // Deux heures égales ne font pas une nuit de zéro heure : elles n'en font aucune.
  const nuit = +d.nightStart === +d.nightEnd ? 'aucune nuit' : `nuit ${heureTxt(d.nightStart)}–${heureTxt(d.nightEnd)}`;
  el.textContent = `${FOCUS[d.focus]||''} · toutes les ${d.interval} min · ${nuit} · `
    + `${n} connexion${n>1?'s':''} avec quelque chose à lancer · `
    + `production ${gain>=0?'+':''}${gain.toFixed(1).replace('.',',')} % en ${d.horizon} h`;
},
tools(){ (REFRESH[toolTab()]||(()=>{}))(); },
explore(){
  const el = document.getElementById('exColo'); if(!el || !API || !API.planets) return;
  const home = coloFrom().coords;
  el.innerHTML = coloCandHtml();

  const raids = raidTargets(), safe = raids.filter(r=>!r.outlaw).slice(0,8), risky = raids.filter(r=>r.outlaw).slice(0,4);
  const sc = shipStats('sc');
  const row = r=>{ const f = flight(home, r.coords, {sc:1}, 100), last = S.raids[r.coords]; return `<tr><td class="mono">${r.coords}</td><td>${esc(r.name)} <span class="note">(${esc(r.status)})</span></td><td class="n">${fmt(r.score)}</td><td class="n">${f?dur(f.secs):'–'}</td><td>${r.outlaw?'<span class="pill bad">plus fort que toi</span>':r.longInactive?'<span class="pill good">inactif longue durée</span>':'<span class="pill info">inactif</span>'}${last?` <span class="note">${last.probe?'espionné':'pillé'} ${formatTime(last.at)}</span>`:''}</td><td>${r.outlaw?'':`<button class="btn sm" data-raidprep="${r.coords}" data-raidname="${esc(r.name)}">Préparer</button>`}</td></tr>`; };
  document.getElementById('exRaid').innerHTML = (safe.length||risky.length) ? `<div class="tbl-wrap"><table><thead><tr><th>Coordonnées</th><th>Joueur</th><th class="n">Points</th><th class="n">Vol PT</th><th></th><th></th></tr></thead><tbody>${safe.map(row).join('')}${risky.length?`<tr><td colspan="6" class="note">À éviter tant que tu as ta protection (avertissement « joueur plus puissant ») :</td></tr>${risky.map(row).join('')}`:''}</tbody></table></div><p class="note">Points = taille de son économie, donc ce que tu peux espérer piller. Espionne avant d'attaquer : il faut ni flotte ni défense. Si le jeu refuse l'attaque, c'est la protection débutant.</p>` : '<p class="note">Aucun inactif repéré dans un rayon de 30 systèmes.</p>';

  const rp = raidPlan(), rpEl = document.getElementById('rdPlan');
  if(rp && rpEl){
    const okShips = Object.keys(rp.ships).length>0;
    /* Les jauges ne valent que s'il y a un butin, mais les avertissements, eux,
       valent toujours : sur une cible à zéro ressource le joueur ne voyait que
       « Saisis les ressources » après avoir collé un rapport entier, et croyait
       que le collage avait échoué. */
    const jauges = rp.need<=0 ? '<p class="note">Saisis les ressources du rapport, ou colle-le, pour calculer la flotte.</p>' : `<div class="res">${gauge('m','m','Butin possible',fmt(rp.need),`${Math.round(rp.rate*100)} % du stock, ${rp.rateSeen ? 'lu dans le rapport' : 'd\'après ta classe'}`)}${gauge('c','c','Ramené',fmt(rp.got),okShips?shipList(rp.ships):'aucun transporteur')}${gauge('d','d','Carburant',fmt(rp.fuel),'aller-retour')}${gauge('e','e','Vol',rp.fl?dur(rp.fl.secs):'–','aller')}</div>`;
    rpEl.innerHTML = `${jauges}
      ${S.raid.mismatch ? `<p class="pill bad mt-2">Ce rapport parle de ${esc(S.raid.mismatch)}, pas de ${esc(S.raid.coords)}. Rien n'a été pris : colle celui de la bonne cible, ou ouvre celle-là.</p>` : ''}
      ${rp.defList ? `<p class="pill warn mt-2">Défense lue : ${esc(rp.defList)} — ${fmt(rp.defValue)} en équivalent métal, contre ${fmt(rp.lootValue)} de butin dans la même unité. ${rp.defValue >= rp.lootValue ? 'Percer coûte plus cher que ce que ça rapporte.' : 'À toi de juger si ça vaut la flotte que tu y perdras.'} Sa défense repousse à 70 % gratuitement et ne laisse aucun débris : tu paies ton écran, lui récupère la sienne. Le copilote ne le compose pas — dimensionner un combat demande un simulateur, et sa sortie serait une fourchette, pas un chiffre.</p>` : ''}
      ${rp.fleetList ? `<p class="pill warn mt-2">Flotte au sol : ${esc(rp.fleetList)}. Ça tire, donc c'est un combat, et le copilote n'en simule aucun.</p>` : ''}
      ${!rp.defKnown || !rp.fleetKnown ? `<p class="pill bad mt-2">Ton rapport ne montre pas ${!rp.defKnown && !rp.fleetKnown ? 'sa défense ni sa flotte' : (!rp.defKnown ? 'sa défense' : 'sa flotte')}. Envoie plus de sondes, ou monte ton Espionnage : le rapport s'étoffe avec les deux. Tant qu'on ne l'a pas lu, « il n'a rien » et « on n'a rien vu » se ressemblent trop pour y envoyer une flotte.</p>` : ''}
      ${!S.raid.safe ? '<p class="pill warn mt-2">Coche la case seulement si le rapport ne montre ni flotte ni défense. Sinon, ne l\'attaque pas.</p>' : ''}
      ${rp.stale && rp.need>0 ? '<p class="pill bad mt-2">Rapport périmé (plus de 2 h) : réespionne avant d\'attaquer, le stock a changé.</p>' : ''}
      ${rp.short>0 ? `<p class="note">Il te manque ${fmt(rp.short)} de soute à ${esc(rp.home.name)} : le reste attendra un second passage.</p>` : ''}
      ${S.raid.safe && !rp.stale && okShips && rp.net>0 ? `<ul class="acts mt-2">${actHtml({q:'Flotte · '+rp.home.name, what:`Attaquer ${S.raid.coords} avec ${shipList(rp.ships)}`, why:`Galaxie ou Flotte → ${S.raid.coords} → mission Attaquer · retour vers ${formatTime(Date.now()+2*rp.fl.secs*1000)}`, cost:[0,0,rp.fuel], dur:2*rp.fl.secs, end:Date.now()+2*rp.fl.secs*1000, kind:'raid', ships:rp.ships, p:cargoHomeIndex(), coords:S.raid.coords, dest:S.raid.coords, mission:1}, true)}</ul>` : ''}`;
  }
  const ex = exploreSystems();
  document.getElementById('exExplore').innerHTML = `<ul class="advice">${ex.map(x=>`<li><span class="pill info">${x.left} pos.</span><span class="what">Système ${x.sys}</span><span class="why">${x.dist===0?'Ton système':`À ${x.dist} système${x.dist>1?'s':''}`} : ${x.left} position${x.left>1?'s':''} pas explorée${x.left>1?'s':''} depuis 7 jours.</span></li>`).join('')}</ul><p class="note">Missions de découverte : bouton Découverte dans Galaxie. Copilote retient les positions explorées quand il voit tes missions dans Mouvements de flotte. Pour les expéditions, alterne la position 16 de systèmes voisins si les résultats baissent.</p>`;
},
planets(){
  let tm=0,tc=0,td=0, worst=1;
  const voc = vocations(), ci = centreIndex();
  S.planets.forEach((p,i)=>{
    const pr=production(p); tm+=pr.m; tc+=pr.c; td+=pr.d; worst=Math.min(worst,pr.factor);
    const st=stockNow(p), full = i2 => { const r=[pr.m,pr.c,pr.d][i2]; return r>0 && st[i2]<pr.cap[i2] ? `plein dans ${dur((pr.cap[i2]-st[i2])/r*3600)}` : (st[i2]>=pr.cap[i2]?'hangar plein':''); };
    document.getElementById('pres-'+i).innerHTML =
      gauge('m','m','Métal',fmt(pr.m),full(0)) + gauge('c','c','Cristal',fmt(pr.c),full(1)) + gauge('d','d','Deutérium',fmt(pr.d),full(2)) +
      gauge('e','e','Énergie',(pr.eBal>=0?'+':'')+fmt(pr.eBal), `${fmt(pr.eProd)} produits / ${fmt(pr.eCons)}${p.eAdj<0?` · dont ${fmt(p.eAdj)} formes de vie`:''}`) +
      crawlerPill(p);
    /* Les trois chiffres dans le résumé : c'est ce qu'on vient lire, et la
       carte reste fermée pour le lire. */
    const ps = document.getElementById('psum-'+i); if(ps) ps.innerHTML = [pr.m, pr.c, pr.d].map(fmtLigne).join(' · ');
    /* Le stock ne se lit en chiffres nulle part ailleurs — les jauges au-dessus
       disent la production. Son résumé le rend lisible sans ouvrir le volet,
       qui ne sert qu'à le recaler. */
    const pk = document.getElementById('pstk-'+i); if(pk) pk.innerHTML = st.map(fmtLigne).join(' · ');
    const fl = document.getElementById('pfleet-'+i); if(fl){ const l = shipList(p.ships); fl.innerHTML = l ? `<b>Flotte à quai :</b> ${esc(l)}` : (IS_EXT ? 'Flotte inconnue : ouvre la page Flotte du jeu sur cette planète.' : ''); }
    /* La vocation et la note du centre suivent les coordonnées, la température
       et les niveaux qu'on tape dans la carte : sans ça elles restaient
       périmées jusqu'au prochain rendu complet. On ne réécrit que du texte —
       la case du centre garde son écouteur, qu'un innerHTML emporterait. */
    const vq = document.getElementById('pvoc-'+i); if(vq) vq.innerHTML = vocPill(voc[p.id]);
    const vw = document.getElementById('pvocw-'+i); if(vw) vw.innerHTML = vocRaison(voc[p.id]);
    const nb = prioCount(p.id);
    const po = document.getElementById('pobj-'+i); if(po) po.textContent = nb ? `${nb} priorité${nb > 1 ? 's' : ''}` : '';
    /* Un volet qui promet une explication et s'ouvre sur du vide est du bruit
       de plus, pas de moins. Il se cache quand les trois raisons sont muettes. */
    const pq = document.getElementById('pq-'+i);
    if(pq) pq.hidden = !(vocRaison(voc[p.id]) || (i === ci && centreWhy()) || centreNoteHtml(p, i, ci));
    const cn = document.getElementById('pctrn-'+i); if(cn) cn.innerHTML = centreNoteHtml(p, i, ci);
  });
  document.getElementById('empireRes').innerHTML = gauge('m','m','Métal',fmt(tm),fmt(tm*24)+' / jour')+gauge('c','c','Cristal',fmt(tc),fmt(tc*24)+' / jour')+gauge('d','d','Deutérium',fmt(td),fmt(td*24)+' / jour')+gauge('e','e','Planètes',S.planets.length,`max ${1+Math.ceil(S.tech.astro/2)} (Astro ${S.tech.astro})`);
  document.getElementById('empireFactor').innerHTML = factorPill(worst);
  /* Le mélange, en clair : c'est lui qui décide quelle mine passe devant, et
     tant qu'il ne se lisait nulle part le classement avait l'air arbitraire. */
  const mix = document.getElementById('empireMix');
  if(mix){
    const w = besoinEmpire(), r = S.settings.ratio, som = r[0]+r[1]+r[2];
    const tot = Math.max(0,tm)+Math.max(0,tc)+Math.max(0,td);
    const part = tot > 0 ? [tm,tc,td].map(x=>Math.round(Math.max(0,x)/tot*100)) : null;
    mix.innerHTML = part
      ? `Mélange produit <b>${part.join(' / ')} %</b> de métal / cristal / deutérium, pour une cible de <b>${[0,1,2].map(i=>Math.round(r[i]/som*100)).join(' / ')} %</b> — ton ratio d'échange ${r.join(':')} lu comme des quantités. Le classement des mines en tient compte : ${[0,1,2].map(i=>`${NOM_RES[i]} ×${w[i].toFixed(2)}`).join(', ')}. Un facteur sous 1 veut dire que tu en produis déjà plus que ta part, donc qu'un niveau de plus vaut moins qu'au cours.`
      : 'Aucune production : rien à mélanger pour l\'instant.';
  }
  document.getElementById('colonyNote').textContent = S.tech.astro ? '' : 'Les colonies demandent Astrophysique 1.';
},
research(){
  /* Le labo de la planète, et ce que le Réseau en fait quand il y en a un :
     c'est le premier qui débloque, le second qui donne les durées de la
     colonne d'à côté. Les afficher ensemble évite de lire l'un pour l'autre. */
  const lv = labLevel(), eff = labEffectif();
  document.getElementById('labLv').textContent = eff > lv ? `${lv} · réseau ${eff}` : lv;
  for(const k of Object.keys(T)){
    const L=S.tech[k]+1, miss=reqOk(T[k].req, null);
    document.getElementById('tc-'+k).innerHTML = costHtml(levelCost(T[k],L));
    document.getElementById('tt-'+k).textContent = dur(researchTime(k,L));
    document.getElementById('ts-'+k).innerHTML = miss.length?`<span class="pill bad">${miss.join(', ')}</span>`:`<span class="pill good">disponible</span>`;
  }
},
moon(){
  const m = S.moonCalc, p = moonPlanete(), k = moonShip();
  const n = Math.floor(Math.max(0, +m.n || 0)), df = moonDf();
  const out = document.getElementById('moonOut'), noteEl = document.getElementById('moonNote');
  if(!n){
    out.innerHTML = `<p class="note span-all">Dis combien de vaisseaux il envoie, et la carte chiffre le tir.</p>`;
    noteEl.innerHTML = '';
    return;
  }
  /* Ce qui compte n'est pas ce qu'il envoie, c'est ce qui meurt : les débris
     viennent des coques détruites, et les survivants rentrent chez lui. Sans
     ça la carte promettait 20 % à qui envoie 1 667 chasseurs sur une défense
     qui n'en tue que mille — et une facture en dizaines de millions avec.
     Défense jamais relevée : on suppose que tout meurt, et la jauge le dit. */
  const { tues, morts } = luneMorts(p, k, n, moonBou());
  const t = luneTir(k, morts, df);
  const rec = ((p || {}).ships || {}).rec || 0, soute = shipStats('rec').cargoEff;
  const vise = Math.min(20, Math.max(1, Math.round(+m.viser || 12)));
  const pour = luneVaisseaux(k, vise, df);
  out.innerHTML =
    gauge('m','m','Débris', fmt(t.debris), 'par tir') +
    gauge('c','c','Chance', moonPct(t.chance), 'par tir') +
    (tues == null ? gauge('e','e','Ta défense', '?', 'jamais relevée')
                  : gauge('e','e','Ta défense tue', fmt(tues), moonNom(k, tues))) +
    gauge('d','d','Pour ' + moonPct(vise), fmt(pour), moonNom(k, pour)) +
    (rec && soute && t.debris ? gauge('m','m','Ramasser', fmt(Math.ceil(t.debris / (rec * soute))), 'voyages, après le tir') : '');

  const f = luneFacture(k, morts, df), sol = luneFlotteAuSol(p), av = [];
  if(tues === 0)
    av.push(`Ta défense <b>n'en tue aucun</b> : la flotte repart entière, il n'y a aucun débris, et il te pille au passage.`);
  else if(tues != null && tues < n)
    av.push(`Ta défense n'en tue que <b>${fmt(tues)}</b> sur ${fmt(n)} : les survivants rentrent chez lui, et <b>pillent ton stock au passage</b>. Les chiffres ci-dessus ne comptent que les morts.`);
  if(tues != null && tues > 0 && pour > tues)
    av.push(`Pour ${moonPct(vise)} il faudrait ${fmt(pour)} ${moonNom(k, pour)} morts, mais ta défense n'en tue que ${fmt(tues)} : c'est elle qui <b>plafonne</b> ta chance, à ${moonPct(luneTir(k, tues, df).chance)} par tir.`);
  if(t.debris > 2e6)
    av.push(`Au-delà de <b>2 M</b> de débris le surplus est perdu : ${fmt(luneVaisseaux(k, 20, df))} morts suffisent pour les 20 %.`);
  if(!t.chance && tues !== 0)
    av.push(`Sous <b>100 000</b> de débris, le combat ne tire rien du tout : il faut ${fmt(luneVaisseaux(k, 1, df))} morts au moins.`);
  if(sol && sol.m + sol.c > 0)
    /* Le relevé vieillit, et c'est une flotte qu'on engage : on dit de quand il
       date plutôt que de laisser croire que c'est l'état d'aujourd'hui. */
    av.push(`Sors ta flotte de ${esc(planetRef(p))} avant le tir : ${shipList(p.ships)} au sol mourraient avec, ${fmt(sol.m)} métal et ${fmt(sol.c)} cristal à ta charge${p.shipsAt ? `, flotte relevée il y a ${dur((Date.now() - p.shipsAt) / 1000)}` : ''}.`);

  noteEl.innerHTML =
    (f ? `Facture espérée d'une lune : <b>${f.tirs} tirs</b>, ${fmt(f.m)} métal, ${fmt(f.c)} cristal${f.deut ? ` et ${fmt(f.deut)} deutérium` : ''} chez lui. Tu ramasses ${fmt(f.recupere)} de débris sur les tirs ratés. C'est une <b>moyenne, pas une promesse</b> : environ un joueur sur sept n'a toujours pas sa lune après le double de tirs. ` : '')
    + (av.length ? av.map(x=>`<br>⚠ ${x}`).join('') + '<br>' : '')
    + ` Les débris de <b>ses</b> vaisseaux tombent chez <b>toi</b>. Si tu es le <b>mieux classé</b> de vous deux, tu ne peux pas les garder : les ramasser ferait monter ses ressources vers toi, et c'est du pushing — préviens un <b>Game Operator</b> avant. S'il est mieux classé que toi, ils sont à toi.`
    + ` <b>Estimation.</b> Seule la ligne « ta défense tue » est estimée : elle ne compte pas la règle d'explosion sous 70 % de coque, qui tue plus vite, et elle suppose le niveau de Bouclier saisi ci-dessus. La chance, elle, se déduit exactement des débris. Le copilote ne connaît pas les lunes : il ne peut pas savoir si cette position en porte déjà une.`;
},
fleet(){
  const s=S.settings, cap = expoFind(S.expo.pf);
  const lc=shipStats('lc'), sc=shipStats('sc'), pf=shipStats('pf');
  const need = Math.max(0, cap - (S.expo.pf?pf.cargoEff:0));
  const nExp = expoCap();
  document.getElementById('expoOut').innerHTML =
    gauge('m','m','Métal max',fmt(cap)) + gauge('c','c','Cristal max',fmt(cap*2/3)) + gauge('d','d','Deut. max',fmt(cap/3)) +
    gauge('e','e','Grands transp.',nf.format(Math.ceil(need/lc.cargoEff)),`ou ${nf.format(Math.ceil(need/sc.cargoEff))} petits`);
  document.getElementById('expoNote').innerHTML = `<b>Estimation.</b> Les seuils publiés datent d'avant la version 7 du jeu ; le plafond ci-dessus est une borne haute, pas une promesse. Une expédition ne rapporte jamais plus que la soute envoyée. Plafond calé sur les points du n°1 (${EXPO_LABELS[top1Tier()]}${API && API.scores ? ', lus dans le classement public' : ', réglage manuel'}). Expéditions simultanées : <b>${nExp}</b>${S.tech.astro?'':' (il faut Astrophysique 1)'}. Les bonus Éclaireur (×2) et Explorateur (×1,5) viennent de sources communautaires.`;
  const fc=S.fleetCalc, f=flight(fc.from, fc.to, fc.ships, fc.pct);
  document.getElementById('flightOut').innerHTML = f ?
    gauge('e','e','Aller',dur(f.secs),`distance ${fmt(f.D)}`) + gauge('d','d','Carburant',fmt(f.fuel),'deutérium, aller') + gauge('c','c','Soute',fmt(f.cargo)) + gauge('m','m','Vitesse',fmt(f.V),'vaisseau le plus lent')
    : `<p class="note span-all">Coordonnées au format 1:234:8 et au moins un vaisseau.</p>`;
  document.getElementById('shipTbl').innerHTML = Object.keys(SHIPS).map(k=>{ const x=shipStats(k); return `<tr><td>${x.n}</td><td>${({combustion:'Combustion',impulse:'Impulsion',hyperdrive:'Hyperespace'})[x.drive]}</td><td class="n">${fmt(x.speedEff)}</td><td class="n">${fmt(x.cargoEff)}</td></tr>`; }).join('');
},
colony(){
  const dp = coloFrom(), maxPl = maxPlanets(), free = S.planets.length < maxPl;
  document.getElementById('coSlots').innerHTML = `<span class="pill ${free?'good':'bad'}">${S.planets.length}/${maxPl} planètes</span>`;
  const F = coloFleet(), req = [];
  const nextAstro = S.tech.astro + (S.tech.astro%2===0 ? 1 : 2);
  req.push(free ? {sev:'good', what:'Emplacement libre', why:`Astrophysique ${S.tech.astro} : ${maxPl} planètes possibles.`}
                : {sev:'bad', what:`Rechercher Astrophysique ${nextAstro}`, why:'Toutes tes planètes sont utilisées.'});
  if(S.tech.impulse>=3) req.push({sev:'good', what:'Réacteur à impulsion 3', why:'Prérequis du vaisseau de colonisation.'});
  else { let t=0; for(let L=S.tech.impulse+1; L<=3; L++) t+=researchTime('impulse',L); req.push({sev:'bad', what:`Réacteur à impulsion ${S.tech.impulse} → 3`, why:`Coût ${fmt(rangeCost(T.impulse,S.tech.impulse,3).reduce((a,b)=>a+b,0))} au total, environ ${dur(t)} de recherche.`}); }
  if(dp.b.shipyard>=4) req.push({sev:'good', what:`Chantier spatial 4 sur ${dp.name}`, why:'Prérequis du vaisseau de colonisation.'});
  else req.push({sev:'bad', what:`Chantier spatial ${dp.b.shipyard} → 4 sur ${dp.name}`, why:`Coût total : ${fmt(rangeCost(B.shipyard,dp.b.shipyard,4).reduce((a,b)=>a+b,0))} ressources.`});
  const w = F.wait;
  req.push({sev: w.sec===0 ? 'good' : w.storage!=null ? 'bad' : 'warn',
    what: colBuilt() ? 'Ressources du kit et carburant' : 'Ressources du vaisseau, du kit et carburant',
    why: `${w.sec===0 ? 'Disponibles maintenant.' : w.storage!=null ? storageNote(w) : `Disponibles dans ${dur(w.sec)}.`}${colBuilt() ? '' : ` Construction du vaisseau : ${dur(F.shipTime)}.`}`});
  /* Quatre lignes vertes ne disent rien : le plan du jour met déjà l'impulsion,
     le chantier et les robots dans ses priorités, et la colonie part toute
     seule quand ils tombent. Ne reste ici que ce qui bloque, et quand plus rien
     ne bloque, une ligne qui dit où en est le vaisseau. */
  const bloque = req.filter(r=>r.sev!=='good');
  const pris = S.day.focus==='eco'
    ? 'En « Économie pure » le plan ne colonise pas : passe en « Économie + colonie » dans les réglages pour qu\'il s\'en charge.'
    : 'Le plan du jour s\'en charge : ces niveaux sont déjà dans ses priorités.';
  document.getElementById('coReq').innerHTML = bloque.length
    ? bloque.map(r=>`<li><span class="pill ${r.sev==='info'?'info':r.sev}">${({warn:'Bientôt',bad:'À faire'})[r.sev]}</span><span class="what">${esc(r.what)}</span><span class="why">${esc(r.why)}</span></li>`).join('')
      + `<li><span class="pill info">Plan</span><span class="what">Rien à lancer à la main</span><span class="why">${esc(pris)}</span></li>`
    : `<li><span class="pill good">OK</span><span class="what">Tout est prêt</span><span class="why">${esc(S.day.focus==='eco' ? pris : `Le plan sort le vaisseau de ${planetRef(dp)}${colShipAt()>=0 ? ' (il y est déjà)' : centrePlanet()===dp ? ' (ton centre)' : ''} et te dira quand l'envoyer vers ${coloTarget()}.`)}</span></li>`;

  const cc = document.getElementById('coCand'); if(cc) cc.innerHTML = coloCandHtml();
  const rows = rankPositions(), tgtPos = (parseC(coloTarget())||[])[2];
  document.getElementById('coPos').innerHTML = rows.map(r=>`<tr${r.ok?'':' class="terne"'}>
    <td class="rank">${r.ok && r.rank<=3 ? r.rank : ''}</td><td class="n">${r.pos}</td>
    <td class="mono">${r.fields} <span class="note">(${r.min}–${r.max})</span></td><td class="n">${r.P.t} °C</td>
    <td>${r.P.bonus?`<span class="pill ${/métal/.test(r.P.bonus)?'info':'good'}">${r.P.bonus}</span>`:''}</td>
    <td class="n">${fmt(r.v)}</td><td class="n">${fmt(r.d)}</td>
    <td>${r.ok ? `<button class="btn sm ${r.pos===tgtPos?'primary':''}" data-copos="${r.pos}">${r.pos===tgtPos?'Choisie':'Choisir'}</button>` : `<span class="note">Astro ${r.P.astro}</span>`}</td></tr>`).join('');

  const L1 = F.leg1, L2 = F.leg2;
  document.getElementById('coFleet').innerHTML = `
    <div class="res">
      ${gauge('m','m','Métal du kit',fmt(F.kitCost[0]))}${gauge('c','c','Cristal du kit',fmt(F.kitCost[1]))}${gauge('d','d','Deut. du kit',fmt(F.kitCost[2]),`+ ${fmt(F.fuel)} de carburant`)}
      ${gauge('e','e','Arrivée du kit', L1 ? dur(L1.secs + (L2?L2.secs:0)) : '–', 'après le départ')}
    </div>
    ${(()=>{ const cp = colonyPayback(); return cp ? `<p class="note">Délai de retour simulé : <b>${dur(cp.hours*3600)}</b>. ${fmt(cp.upfront)} éq. de mise, ${dur(cp.ramp*3600)} pour que ses mines montent toutes seules jusqu'à ${fmt(cp.rate)} éq./h, puis ce temps-là pour rendre la mise. La montée s'arrête quand plus aucun niveau ne s'amortit en moins de ${dur(COLO_HORIZON_H*3600)}.</p>` : ''; })()}
    <ul class="list">
      <li><div><div><b>1. Vaisseau de colonisation</b> vers ${esc(F.target)}, mission Coloniser</div>
        <div class="row gap-2"><span class="note">Charge :</span>${costHtml(F.colLoad)}<span class="note mono">vol ${L1?dur(L1.secs):'–'} · ${L1?fmt(L1.fuel):'–'} deut</span></div></div></li>
      ${F.n ? `<li><div><div><b>2. ${F.n} ${F.n>1?F.tr.n.toLowerCase().replace('transporteur','transporteurs'):F.tr.n.toLowerCase()}</b>, mission Transporter, dès que la colonie existe</div>
        <div class="row gap-2"><span class="note">Charge :</span>${costHtml(F.rest)}<span class="note mono">vol ${L2?dur(L2.secs):'–'} · ${L2?fmt(L2.fuel*2):'–'} deut aller-retour</span></div></div></li>`
        : `<li><div class="note">Tout le kit tient dans le vaisseau de colonisation (soute ${fmt(F.col.cargoEff)}).</div></li>`}
    </ul>
    <p class="note">Le kit ${esc(F.kit.n.toLowerCase())} couvre ${Object.entries(F.kit.lv).map(([k,l])=>`${B_SHORT[k]} ${l}`).join(', ') || 'aucun bâtiment'}. Carburant estimé.</p>
    ${aide('cotransport', '<p class="note">Les transporteurs partent après l\'arrivée du vaisseau : on ne peut pas transporter vers une position encore vide.</p>')}`;

  const fpos = +S.colo.fpos || (parseC(coloTarget())||[])[2], v = coloVerdict(+S.colo.fields, fpos);
  document.getElementById('coEval').innerHTML = v ? `<ul class="advice"><li><span class="pill ${v.sev}">${v.t}</span><span class="what">Position ${fpos}</span><span class="why">${esc(v.why)}</span></li></ul>` : '';
},
};

/* ---------- events ---------- */
function bind(){
  /* Un centre et un seul : cocher ici décoche ailleurs, et comme le choix
     déplace le « (conseillé) » des autres cartes et tout le plan, la vue se
     redessine au lieu de se rafraîchir. */
  view.querySelectorAll('[data-centre]').forEach(el=>el.addEventListener('change',()=>{ S.centre = el.checked ? el.dataset.centre : null; save(); render(); }));
  view.querySelectorAll('[data-raid]').forEach(el=>el.addEventListener(el.type==='checkbox'?'change':'input',()=>{ if(!S.raid) return; const k=el.dataset.raid; if(k==='paste'){ applyReport(el.value); save(); render(); return; } S.raid[k] = el.type==='checkbox' ? el.checked : (+el.value||0); if(k!=='safe') S.raid.at=Date.now(); save(); REFRESH.explore(); }));
  view.querySelectorAll('[data-empile]').forEach(el=>el.addEventListener('change',()=>setCardMode(el.checked ? 'stacked' : 'tabs')));
  view.querySelectorAll('[data-lf]').forEach(el=>el.addEventListener('change',()=>{ const k=el.dataset.lf, f=new Set(S.lf.found); el.checked ? f.add(k) : f.delete(k); S.lf.found=[...f]; save(); render(); }));
  /* Répondre, c'est à la fois choisir et passer à la suite : le plan entier
     change, donc la vue se redessine — et l'assistant disparaît à la dernière
     réponse. Chaque clé est relue dans sa table avant d'être posée. */
  view.querySelectorAll('[data-pstyle]').forEach(el=>el.addEventListener('click',()=>{
    const k = profilConnu(PROFILS.styles, el.dataset.pstyle); if(!k) return;
    /* Avant d'écraser le style : la règle a besoin de celui d'avant pour savoir
       si le plan et le modèle de défense en place venaient de lui ou du joueur. */
    styleRepose(S.profil.style, k);
    S.profil.style = k;
    // La question a été posée, quoi qu'il advienne des réglages qu'elle propose.
    S.day.focusSet = true;
    profilEtape = 1; save(); render();
  }));
  view.querySelectorAll('[data-pclasse]').forEach(el=>el.addEventListener('click',()=>{
    S.profil.classe = profilConnu(PROFILS.classes, el.dataset.pclasse) || '';
    profilEtape = 2; save(); render();
  }));
  view.querySelectorAll('[data-pactivite]').forEach(el=>el.addEventListener('click',()=>{
    const k = profilConnu(PROFILS.activites, el.dataset.pactivite); if(!k) return;
    S.profil.activite = k; S.profil.set = true; profilEtape = 0; save(); render();
  }));
  view.querySelectorAll('[data-petape]').forEach(el=>el.addEventListener('click',()=>{
    profilEtape = Math.max(0, Math.min(2, parseInt(el.dataset.petape) || 0)); render();
  }));
  /* Qui ouvre l'assistant pour voir doit pouvoir en sortir : sans ça, « Refaire
     le questionnaire » laissait la carte en tête d'Aujourd'hui, au-dessus de ce
     que le joueur vient lire, jusqu'à ce qu'il reclique les trois réponses.
     « Fermer » ne défait rien — ce qui a déjà été cliqué est déjà posé — il
     referme, et le bouton n'existe pas tant qu'aucun style n'a été choisi. */
  view.querySelectorAll('[data-pferme]').forEach(el=>el.addEventListener('click',()=>{
    if(!S.profil.style) return;
    S.profil.set = true; profilEtape = 0; save(); render();
  }));
  /* Un focus se coche là où le joueur lit ses cartes : l'ordre change à
     l'instant, c'est ce qu'il vient vérifier. */
  view.querySelectorAll('[data-pfocus]').forEach(el=>el.addEventListener('change',()=>{
    const k = profilConnu(PROFILS.focus, el.dataset.pfocus); if(!k) return;
    const f = new Set(S.profil.focus); el.checked ? f.add(k) : f.delete(k);
    S.profil.focus = [...f]; save(); render();
  }));
  /* Refaire le questionnaire, c'est le rouvrir là où il s'ouvre : en tête
     d'Aujourd'hui, avec les réponses en place. */
  view.querySelectorAll('[data-refaire]').forEach(el=>el.addEventListener('click',()=>{
    S.profil.set = false; profilEtape = 0; save(); allerOnglet('today');
  }));
  view.querySelectorAll('[data-day]').forEach(el=>el.addEventListener(el.tagName==='SELECT' || el.type==='checkbox' ? 'change' : 'input',()=>{
    // la mise à l'abri est une bascule (ENH-54) : sa valeur est cochée ou non
    const k = el.dataset.day; S.day[k] = dayValue(k, el.type==='checkbox' ? (el.checked ? '1' : '0') : el.value, S.day[k]);
    /* Allumer la mise à l'abri, ou déplacer l'heure de retour, déplace l'instant
       où elle s'éteindra : `modeNuit` le recalcule, le champ ne fait que poser
       la valeur. */
    if(k === 'night') modeNuit(S.day.night);
    if(k === 'backHour' && S.day.night) modeNuit(true);
    save();
    /* Le mode nuit filtre les cartes et change l'en-tête : il faut tout
       redessiner, pas seulement rafraîchir le volet. */
    k === 'night' ? render() : refresh();
  }));
  view.querySelectorAll('[data-colo]').forEach(el=>el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{
    const k = el.dataset.colo;
    S.colo[k] = k==='built' ? el.value==='1' : k==='bonus' ? (+el.value||0) : el.value.trim();
    save(); refresh();
  }));

  view.querySelectorAll('[data-pi]').forEach(card=>{
    const p = S.planets[+card.dataset.pi];
    card.querySelectorAll('input[data-b]').forEach(el=>el.addEventListener('input',()=>{ p.b[el.dataset.b]=Math.max(0,parseInt(el.value)||0); delete p.bNeuve; changed(); }));
    card.querySelectorAll('input[data-p]').forEach(el=>el.addEventListener('input',()=>{ const k=el.dataset.p; p[k] = (k==='tmax'||k==='sats') ? (parseInt(el.value)||0) : el.value; changed(); }));
    card.querySelectorAll('input[data-s]').forEach(el=>el.addEventListener('input',()=>{ const st=stockNow(p); p.stock={m:st[0],c:st[1],d:st[2],at:Date.now()}; p.stock[el.dataset.s]=parseFloat(el.value)||0; changed(); }));
    /* Trois états, et le vide en est un : hériter du compte n'est pas la même
       chose que dire non ici. */
    card.querySelectorAll('[data-satsok]').forEach(el=>el.addEventListener('change',()=>{ p.satsOk = el.value === '' ? null : el.value === '1'; changed(); }));
  });
  view.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{ const p=S.planets[+b.dataset.del]; if(p) forgetPlanet(p.id); save(); render(); }));
  on('addPlanet','click',()=>{ S.planets.push(newPlanet('Colonie '+S.planets.length,'1:1:'+(S.planets.length+4),20,{})); S.sample=false; save(); render(); });
  /* « change » et non « input » comme les niveaux voisins : sur un labo 5,
     taper « 10 » passe par « 1 », que prioPose jugerait atteint avant de
     recréer la priorité en fin de liste — et le joueur perdrait son rang. */
  view.querySelectorAll('input[data-prio]').forEach(el=>el.addEventListener('change',()=>{ const kind = el.dataset.kind || (el.dataset.pid ? 'b' : 't');
    /* Une case de forme de vie se range sous un identifiant entier, et
       l'attribut le donne en chaîne : prioLvl ne la retrouverait pas au relire. */
    const cle = kind === 'lf' ? +el.dataset.prio : el.dataset.prio;
    prioPose(kind, el.dataset.pid, cle, el.value);
    /* Pas de render() : il refermerait le volet qui porte le champ, et le
       joueur qui en pose deux de suite devrait le rouvrir à chaque fois. Le
       champ dit ce que la priorité est devenue — vide si elle a été retirée. */
    el.value = prioLvl(kind, el.dataset.pid, cle);
    save(); refresh();
    // refresh() sur Empire ne publie pas le plan : la tuile ne saurait rien de ce qu'on vient de poser
    publieLePlan();
  }));
  /* La carte de pose en masse. « change » pour la même raison que les champs de
     priorité juste au-dessus : un rendu au milieu de la frappe reprendrait la
     main sur le champ. render() et non refresh() : chaque ligne porte un état
     que le bâtiment ou le niveau change, et la carte se replie sur son état
     enregistré, pas sur celui du gabarit. */
  view.querySelectorAll('[data-pose]').forEach(el=>el.addEventListener('change',()=>{
    poseChamp(el.dataset.pose, el.value); save(); render();
  }));
  view.querySelectorAll('[data-posep]').forEach(el=>el.addEventListener('change',()=>{
    poseCoche(el.dataset.posep, el.checked); save(); render();
  }));
  view.querySelectorAll('input[data-t]').forEach(el=>el.addEventListener('input',()=>{ S.tech[el.dataset.t]=Math.max(0,parseInt(el.value)||0); changed(); }));
  /* La sécurité vit dans `S.settings.secu`, toujours réécrite entière depuis
     `secu()` : une sauvegarde abîmée en sort complète. Tout changement réarme
     le rappel, dont l'heure et les jours vivent aussi côté service worker. */
  const secuPose = f => { const c = secu(); f(c); S.settings.secu = c; changed(); armeRappel(); };
  view.querySelectorAll('[data-secu-vault]').forEach(el=>el.addEventListener('change',()=>secuPose(c=>{
    const id = el.dataset.secuVault; c.vaults = c.vaults.filter(x=>x!==id); if(el.checked) c.vaults.push(id); })));
  view.querySelectorAll('[data-secu-jour]').forEach(el=>el.addEventListener('change',()=>secuPose(c=>{
    const j = +el.dataset.secuJour; c.jours = c.jours.filter(x=>x!==j); if(el.checked) c.jours.push(j); c.jours.sort(); })));
  view.querySelectorAll('[data-secu]').forEach(el=>el.addEventListener('change',()=>secuPose(c=>{
    const k = el.dataset.secu;
    if(/^\d{1,2}:\d{2}$/.test(el.value)) c[k] = el.value;
  })));
  view.querySelectorAll('[data-set]').forEach(el=>el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{
    const k=el.dataset.set, s=S.settings;
    if(k==='ratio'){ const r=el.value.split(':').map(Number); if(r.length===3 && r.every(x=>x>0)) s.ratio=r; }
    else if(['geo','eng','colCargo','lean','noshop','large','peau','clair','crawlerOverload','muet','sats'].includes(k)) s[k]=el.checked;
    else if(k==='skin') s.skin=el.value;
    else s[k]=Math.max(k==='top1'||k==='expoRes'?0:1, parseFloat(el.value)||0);
    changed();
    /* Le worker sonne panneau fermé : il ne lit pas les réglages, on lui pose
       donc ce seul bit là où il regarde. */
    if(k==='muet' && IS_EXT) try{ chrome.storage.local.set({muet: s.muet}); }catch(e){}
    /* `changed()` ne redessine pas : la peau se pose sur <html>, pas dans la vue. */
    if(k==='skin') header();
    if(k==='lean' || k==='noshop' || k==='large' || k==='peau' || k==='clair' || k==='skin') pushLook();
  }));
  view.querySelectorAll('[data-masque]').forEach(el=>el.addEventListener('change',()=>{
    setMasque(Object.assign({}, masque, {[el.dataset.masque]: el.checked}));
  }));
  view.querySelectorAll('[data-masque-tout]').forEach(el=>el.addEventListener('click',()=>setMasque(masqueBascule(masque))));
  view.querySelectorAll('[data-expo]').forEach(el=>el.addEventListener('change',()=>{ S.expo.pf=el.checked; changed(); }));
  view.querySelectorAll('[data-mc]').forEach(el=>el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{ const k=el.dataset.mc; S.moonCalc[k] = (k==='pid'||k==='ship') ? el.value : Math.max(0, parseInt(el.value, 10)||0); changed(); }));
  /* Le modèle de défense passe tout entier par ici : le réglage global, le
     palier, chaque pièce du ratio perso, et la surcharge d'une planète, que
     `data-dp` distingue. Un menu vide retire la surcharge plutôt que de poser
     une valeur : sans ça le joueur ne pourrait plus revenir aux réglages.
     `render()` et pas `refresh()` : le choix du modèle fait apparaître ou
     disparaître les cases du ratio, et la carte entière change. */
  const defPose = (q, v) => {
    if(!q) S.settings.defModele = DEF_MODELES[v] ? v : 'framework';
    else if(DEF_MODELES[v]) q.defModele = v; else delete q.defModele;
  };
  /* Le sélecteur de modèle est un volet de boutons : un clic pose le modèle
     comme le faisait le menu, et le rendu referme le volet. */
  view.querySelectorAll('[data-defpick]').forEach(el=>el.addEventListener('click',()=>{
    defPose(el.dataset.dp ? planetById(el.dataset.dp) : null, el.dataset.defpick);
    S.sample = false; save(); render();
  }));
  /* Le ratio perso se relit à chaque frappe : la recette et le pack suivent
     en direct, et le `change` d'après redessine comme avant. */
  view.querySelectorAll('[data-def]').forEach(el=>{ if(DEF_RATIO.includes(el.dataset.def)) el.addEventListener('input',()=>{
    S.settings.defPerso[el.dataset.def] = Math.max(0, Math.round(num(el.value, 0)));
    defPersoLive();
  }); });
  view.querySelectorAll('[data-def]').forEach(el=>el.addEventListener('change',()=>{
    const k = el.dataset.def, q = el.dataset.dp ? planetById(el.dataset.dp) : null, v = el.value;
    if(k === 'modele') defPose(q, v);
    else if(k === 'palier'){
      const n = v === 'fill' ? 'fill' : DEF_PALIERS.includes(+v) ? +v : null;
      if(!q) S.settings.defPalier = n == null ? 20 : n;
      else if(n == null) delete q.defPalier; else q.defPalier = n;
    /* Le ratio du joueur : des nombres entiers, jamais négatifs. C'est la seule
       valeur de ce bloc qu'il écrit lui-même, donc la seule à borner. */
    }else if(k === 'plancher') S.settings.defPlancher = DEF_PLANCHERS.includes(+v) && v !== '' ? +v : null;
    else if(k === 'duree') S.settings.defDuree = DEF_DUREES.includes(+v) ? +v : 4;
    else if(DEF_RATIO.includes(k)) S.settings.defPerso[k] = Math.max(0, Math.round(num(v, 0)));
    S.sample = false; save(); render();
  }));
  view.querySelectorAll('[data-fc]').forEach(el=>el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{ S.fleetCalc[el.dataset.fc] = el.dataset.fc==='pct'?+el.value:el.value.trim(); changed(); }));
  view.querySelectorAll('[data-ship]').forEach(el=>el.addEventListener('input',()=>{ S.fleetCalc.ships[el.dataset.ship]=Math.max(0,parseInt(el.value)||0); changed(); }));
  /* Le presse-papiers du panneau latéral refuse l'écriture dès que le focus est
     ailleurs, et la sauvegarde partait alors en silence : un fichier, lui,
     atterrit dans le dépôt, qui est le seul endroit que les deux postes
     partagent. `saveAs` pour pouvoir viser ce dossier plutôt que
     Téléchargements. L'URL n'est pas révoquée : le téléchargement démarre après
     le retour, et le panneau fermé la libère de toute façon. */
  on('ioSave','click',()=>{
    // les deux heures de l'enregistrement, quel que soit le mode d'affichage
    const url = URL.createObjectURL(new Blob([JSON.stringify(Object.assign({}, S, timeExport(Date.now())))], {type:'application/json'}));
    if(typeof chrome!=='undefined' && chrome.downloads){
      chrome.downloads.download({url, filename:'save.json', saveAs:true}, ()=>msg('Enregistre-le dans le dépôt, puis pousse-le'));
    } else {
      const a=document.createElement('a'); a.href=url; a.download='save.json'; a.click(); msg('Enregistré dans tes téléchargements');
    }
  });
  on('ioLoad','click',()=>document.getElementById('ioFile').click());
  on('ioFile','change',e=>{ const f=e.target.files && e.target.files[0]; e.target.value=''; if(!f) return;
    f.text().then(t=>{ if(appliqueSauvegarde(t)) toast('Données importées'); else msg('Fichier invalide : choisis le save.json du dépôt'); })
      .catch(()=>msg('Lecture du fichier impossible')); });
  on('ioImport','click',()=>{ if(appliqueSauvegarde(document.getElementById('ioText').value)) toast('Données importées'); else msg('Texte invalide : colle une sauvegarde complète'); });
  on('uiReset','click',()=>{ uiReset(); render(); toast('Affichage des cartes réinitialisé'); });
  on('ioReset','click',e=>{ const b=e.currentTarget; if(b.dataset.armed){ remplaceEtat(sample()); save(); render(); toast('Réinitialisé'); } else { b.dataset.armed='1'; b.textContent='Confirmer la réinitialisation'; b.classList.remove('ghost'); } });
}
// Un clic sur la carte ouvre la page du jeu. Les boutons gardent leur rôle :
// « Lancé » et « Fait » ne doivent jamais faire changer de page par surprise.
/* Les menus de limite sont délégués : ceux d'Aujourd'hui vivent dans des
   blocs que le rafraîchissement réécrit, sans repasser par bind(). Le choix
   s'applique tout de suite : le rafraîchissement relit la limite, rien à
   recharger. Changer l'en-tête crée une valeur propre à la liste, comme le
   tableau de Réglages — c'est la même clé, donc les deux restent d'accord. */
view.addEventListener('change', e=>{
  const el = e.target;
  if(!el || !el.dataset) return;
  if(el.dataset.cartes != null || el.dataset.cartesl != null){
    const id = el.dataset.cartes != null ? el.dataset.cartes : el.dataset.cartesl, v = cartesVal(el.value);
    const l = S.settings.cartesListe = S.settings.cartesListe || {};
    if(v == null) delete l[id]; else l[id] = v;
    save(); tab === 'settings' ? render() : refresh();
  } else if(el.dataset.cartesg != null){
    S.settings.cartesMax = cartesVal(el.value) || CARTES_DEF;
    save(); render();
  }
});
/* « Voir plus » déplie sur place : les cartes masquées sont déjà écrites, on
   ne fait que lever le `hidden`. L'état est noté comme celui d'un volet, donc
   le prochain rafraîchissement, et le prochain démarrage, le retrouvent. */
view.addEventListener('click', e=>{
  /* Un renvoi d'abord : posé dans une carte d'action, il ne doit pas ouvrir
     la page du jeu que la carte ouvre au clic. */
  const rv = e.target.closest('[data-aller]'); if(rv){ e.preventDefault(); e.stopPropagation(); allerVers(rv.dataset.aller); return; }
  const vp = e.target.closest('[data-voirplus]');
  if(vp){
    const id = vp.dataset.voirplus, ouvert = !voirPlusOuvert(id);
    uiNote(voirPlusCle(id), ouvert);
    const box = vp.parentElement && [...vp.parentElement.querySelectorAll('[data-masquees]')].find(x => x.dataset.masquees === id);
    if(box) box.hidden = !ouvert;
    vp.textContent = ouvert ? 'Voir moins' : `Voir ${vp.dataset.n} de plus`;
    vp.setAttribute('aria-expanded', String(ouvert));
    return;
  }
  if(e.target.closest('[data-cartesreset]')){
    S.settings.cartesListe = {};
    save(); render(); toast('Toutes les listes suivent la valeur globale');
  }
});
view.addEventListener('click', e=>{
  // « Comment faire » se lit sans partir : seul le corps de la carte navigue.
  if(e.target.closest('button, a, summary, input, select, .how')) return;
  // `closest` rend le plus proche : une coordonnée liée l'emporte sur la carte.
  const li = e.target.closest('[data-go]'); if(!li) return;
  const url = li.dataset.go;
  if(IS_EXT) chrome.runtime.sendMessage({type:'go', url});
  else window.open(url, '_blank', 'noopener');
});
/* Les filtres du bloc des conseils vivent dans #tdAlerts, que REFRESH réécrit
   sans repasser par bind() : ils passent par la délégation. Sur ce poste
   seulement — `ui` ne voyage pas. */
view.addEventListener('change', e=>{
  /* Réglages › Règles : n'est écrit que ce qui s'écarte du fichier. */
  /* La race posée à la main l'emporte sur la lecture ; vide, la lecture reprend. */
  const rc = e.target.closest && e.target.closest('[data-race]');
  if(rc){ const p = planetById(rc.dataset.race);
    if(p){ if(aSoi(LIFEFORMS, rc.value)) p.race = rc.value; else delete p.race; save(); render(); }
    return; }
  const off = e.target.closest && e.target.closest('[data-regoff]');
  if(off){ const [pid, id] = off.dataset.regoff.split('|'), p = planetById(pid);
    if(p && aSoi(REGLES_PAR_ID, id)){ const o = Object.assign({}, p.regOff); if(off.checked) delete o[id]; else o[id] = true; p.regOff = o; save(); render(); }
    return; }
  const ro = e.target.closest && e.target.closest('[data-rg-on]');
  if(ro){ reglePose(ro.dataset.rgOn, {on:!!ro.checked}); save(); render(); return; }
  const rp = e.target.closest && e.target.closest('[data-rg-p]');
  if(rp){ const [id, k] = rp.dataset.rgP.split(':'), v = parseFloat(rp.value);
    if(Number.isFinite(v)) reglePose(id, {p:{[k]: v}}); save(); render(); return; }
  const f = e.target.closest && e.target.closest('[data-cf]'); if(!f) return;
  S.ui.cf = Object.assign({}, S.ui.cf, {[f.dataset.cf]: f.type === 'checkbox' ? !!f.checked : f.value});
  save(); refresh();
});
view.addEventListener('click', e=>{
  /* « Préparer » ouvre le formulaire de flotte du jeu, déjà rempli. Un bouton
     et non la carte entière : le clic de carte ignore les boutons exprès, pour
     que « Lancé » et « Fait » ne fassent jamais changer de page par surprise. */
  if(e.target.closest('[data-fsvu]')) fsRappelVu();
  const pr = e.target.closest('[data-prep]');
  if(pr){
    const url = pr.dataset.prep;
    /* Une expédition préparée garde sa composition : si l'aller n'est jamais
       vu, c'est elle qui dira ce qui est parti. */
    if(pr.dataset.expoprep){
      try{
        const x = JSON.parse(pr.dataset.expoprep);
        if(x && typeof x.de === 'string' && typeof x.dest === 'string' && x.ships && typeof x.ships === 'object'){
          const now = Date.now();
          S.expoPrep = (S.expoPrep||[]).filter(y => now - y.at < EXPO_PREP_TTL).concat([{de:x.de, dest:x.dest, ships:x.ships, at:now}]).slice(-EXPO_PREP_MAX);
          save();
        }
      }catch(err){}
    }
    if(IS_EXT) chrome.runtime.sendMessage({type:'go', url});
    else window.open(url, '_blank', 'noopener');
    return;
  }
  /* Le calibrage du fret ne s'applique que sur ce clic. Ignorer retient la
     valeur proposée : la carte revient quand la proposition s'en écarte de
     plus de dix pour cent. */
  const fa = e.target.closest('[data-fretapply]');
  if(fa){ const v = Math.round(+fa.dataset.fretapply); if(v >= 1 && v <= 1e5){ S.settings.expoFret = v; S.expo.fretIgnore = null; save(); render(); toast(`Facteur de fret : ${fmt(v)}`); } return; }
  const fi = e.target.closest('[data-fretignore]');
  if(fi){ const v = +fi.dataset.fretignore; if(v > 0){ S.expo.fretIgnore = v; save(); render(); } return; }
  const cp = e.target.closest('[data-copos]');
  if(cp){ const pos = +cp.dataset.copos, libre = (API && API.planets ? colonyCandidates() : []).find(c=>c.pos===pos), [g,sy] = coloSystem();
    S.colo.target = libre ? libre.coords : `${g}:${sy}:${pos}`; save(); render(); return; }
});
view.addEventListener('click', e=>{
  // Le ⓘ de la ligne du type ouvre son texte, posé plus bas dans la carte.
  const wq = e.target.closest('button.i');
  if(wq){
    const body = document.getElementById(wq.getAttribute('aria-controls'));
    if(body){ body.hidden = !body.hidden; wq.setAttribute('aria-expanded', String(!body.hidden)); if(wq.dataset.ui) uiNote(wq.dataset.ui, !body.hidden); }
    return;
  }
  const cp = e.target.closest('[data-copy]');
  if(cp){
    const v = cp.dataset.copy;
    // Le presse-papier, pas le champ : c'est le joueur qui colle.
    (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject())
      .then(()=>toast('Copié : '+v)).catch(()=>toast('Copie impossible : '+v));
    return;
  }
  const dn = e.target.closest('[data-done]'); if(dn){ S.daily.done[dn.dataset.done] = Date.now();
    // Fait sur un espionnage : les cibles nommées sortent de la liste pour un jour.
    if(dn.dataset.mark) dn.dataset.mark.split(',').forEach(c=>{ S.raids[c] = {at:Date.now(), probe:true}; }); save(); refresh(); toast('Bien joué'); return; }
  const no = e.target.closest('[data-no]'); if(no){ S.daily.no[no.dataset.no] = Date.now(); save(); refresh(); toast('Mis de côté'); return; }
  /* « Ignorer » ne vit que jusqu'à ce que la situation change, ou 24 h : ce
     n'est pas « Non », qui oublie une carte du plan pour toujours. */
  const rs = e.target.closest('[data-rescan]'); if(rs){ rescanner(); save(); render(); toast('Noms oubliés : ouvre les pages Formes de vie pour les relire'); return; }
  const ig = e.target.closest('[data-ign]'); if(ig){ S.daily.ign = Object.assign({}, ignores(), {[ig.dataset.ign]: Date.now()}); save(); refresh(); toast('Masqué jusqu\'à ce que ça change'); return; }
  const pu = e.target.closest('[data-prio-up]'); if(pu){ prioDevant(pu.dataset.prioUp); save(); render(); publieLePlan(); return; }
  const pd = e.target.closest('[data-prio-del]'); if(pd){ prioRetire(pd.dataset.prioDel); save(); render(); return; }
  /* publieLePlan() comme après un champ de priorité : sans lui, les tuiles du
     jeu ignoreraient ce qu'on vient de poser sur dix planètes d'un coup. */
  const pg = e.target.closest('[data-posego]');
  if(pg){ const n = posePartout();
    if(n){ save(); render(); publieLePlan(); toast(`Posé sur ${n} planète${n>1?'s':''}`); }
    return; }
  const pdel = e.target.closest('[data-posedel]');
  if(pdel){ const n = poseRetireTout();
    if(n){ save(); render(); publieLePlan(); toast(`Retiré sur ${n} planète${n>1?'s':''}`); }
    return; }
  const lp = e.target.closest('[data-lfpaliers]');
  if(lp){ const p = planetById(lp.dataset.lfpaliers);
    if(p && lfPosePaliers(p)){ save(); render(); publieLePlan(); toast('Paliers de population posés'); }
    return; }
  const n1 = e.target.closest('[data-noone]'); if(n1){ delete S.daily.no[n1.dataset.noone]; save(); render(); toast('Carte remise'); return; }
  const nc = e.target.closest('[data-noclear]'); if(nc){ S.daily.no = {}; save(); render(); toast('Cartes refusées remises'); return; }
  const ctb = e.target.closest('[data-carte-tab]'); if(ctb){ carteChoisie(ctb.dataset.carteTab); return; }
  const sm = e.target.closest('summary[data-fold]');
  /* En onglets, la carte affichée reste dépliée : son titre ne la replie pas,
     et l'état enregistré pour le mode empilé ne bouge pas. */
  if(sm && cardMode === 'tabs'){ const w = sm.parentElement.closest('.en-onglets > .carte'); if(w && carteDetails(w) === sm.parentElement){ e.preventDefault(); return; } }
  // Le repli bascule tout seul : on ne note que l'état où il va.
  if(sm){ uiNote(sm.dataset.fold, !sm.parentElement.open); return; }
  const rpp = e.target.closest('[data-raidprep]'); if(rpp){ S.raid = {coords:rpp.dataset.raidprep, name:rpp.dataset.raidname, m:0, c:0, d:0, safe:false}; save(); render(); return; }
  const rpc = e.target.closest('[data-raidclose]'); if(rpc){ S.raid = null; save(); render(); return; }
  const ct = e.target.closest('[data-cotarget]'); if(ct){ S.colo.target = ct.dataset.cotarget; save(); render(); toast('Destination de colonie mise à jour'); return; }
  const ar = e.target.closest('[data-apirefresh]'); if(ar){ try{ chrome.runtime.sendMessage({type:'apiRefresh', force:true}); }catch(err){} toast('Actualisation demandée'); return; }
  const tl = e.target.closest('[data-tool]'); if(tl){ S.ui.tool = tl.dataset.tool; save(); render(); return; }
  const go = e.target.closest('[data-goto]'); if(go){ allerVers(go.dataset.goto); return; }
  const sent = e.target.closest('[data-sent]'); if(sent){ S.colo.sentAt = Date.now(); S.colo.built = false; save(); refresh(); toast('Colonisation en route'); return; }
  const la = e.target.closest('[data-launch]');
  if(la){
    const a = JSON.parse(la.dataset.launch), tm = {id:Math.random().toString(36).slice(2,8), manual:true, at:Date.now(), end:Date.now()+a.dur*1000, done:false};
    if(a.kind==='t'){ tm.kind='t'; tm.k=a.k; tm.lvl=a.lvl; if(a.pid){ tm.pid=a.pid; S.rechPid=a.pid; } }
    else if(a.kind==='b'){ tm.kind='b'; tm.pid=a.pid; tm.k=a.k; tm.lvl=a.lvl; }
    else if(a.kind==='shipbuild' || a.kind==='def'){ tm.kind='x'; tm.k='shipyard'; tm.ships=a.ships; tm.pid=a.pid; tm.label=a.what; }
    else if(a.kind==='transfer' || a.kind==='raid'){ tm.kind='x'; tm.k='fleet'; tm.ships=a.ships; tm.pid=a.pid; tm.label=a.kind==='raid' ? `Retour du pillage ${a.coords}` : 'Arrivée du rapatriement'; }
    else if(a.kind==='expo'){ tm.kind='x'; tm.k='expo'; tm.ships=a.ships; tm.pid=a.pid; tm.label="Retour d'expédition"; }
    else if(a.kind==='sats'){ tm.kind='x'; tm.k='sats'; tm.n=a.n; tm.pid=a.pid; tm.label=a.what; }
    else if(a.kind==='lf'){ tm.kind='x'; tm.k='other'; tm.queue=lfQueue(a.id); tm.pid=a.pid; tm.label=a.what; }
    else { tm.kind='x'; tm.k='colship'; tm.label='Vaisseau de colonisation'; }
    /* Sans planète identifiée, personne n'est débité : c'était le dernier
       endroit où un rang périmé faisait payer la voisine. Le minuteur part
       quand même — le joueur a bien lancé quelque chose. */
    const p = planetById(a.pid);
    const cost = a.cost || COL_SHIP_COST;
    if(p){ const st = stockNow(p); p.stock = {m:Math.max(0,st[0]-cost[0]), c:Math.max(0,st[1]-cost[1]), d:Math.max(0,st[2]-cost[2]), at:Date.now()}; }
    if(a.kind==='raid'){ S.raids[a.coords] = {at:Date.now()}; S.raid = null; }
    S.timers.push(tm); save(); a.kind==='raid' ? render() : refresh(); toast(`Suivi : ${a.what}`);
  }
});
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
function changed(){ S.sample=false; save(); refresh(); }

const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');

view.addEventListener('click', e=>{ if(e.target.id==='scanStop') boutonMaj(); });
document.getElementById('majBtn').addEventListener('click', boutonMaj);
/* L'âge du relevé vieillit tout seul : sans ce battement, le bouton n'apparaîtrait
   qu'au prochain clic du joueur — au moment où il se fie déjà au plan. */
setInterval(header, 60000);
function allerOnglet(k){ poseScanEcran(false); poseOnglet(k); try{ LS.setItem(KEY+'-tab',k); }catch(err){} render(); }
/**
 * Ouvre une page et, s'il est donné, son sous-onglet : « settings:affichage »,
 * « tools:defense ». Le sous-onglet devient le choix retenu du joueur, comme
 * s'il l'avait cliqué : c'est bien lui qui a cliqué le renvoi.
 * @param {string} cible « page » ou « page:sous-onglet »
 */
function allerVers(cible){
  const [t, sous] = String(cible || '').split(':');
  if(!VIEWS[t]) return;
  if(sous){
    if(t === 'tools'){ if(TOOLS.some(([k])=>k===sous)){ S.ui.tool = sous; save(); } }
    else if(CARTES[t] && CARTES[t].some(c=>c.cardId===sous)){ cardTabs[t] = sous; delete cardForce[t]; carteRetiens(); }
  }
  allerOnglet(t);
  if(typeof window !== 'undefined' && typeof window.scrollTo === 'function') window.scrollTo(0, 0);
}
document.getElementById('tabs').addEventListener('click',e=>{ const b=e.target.closest('button[data-tab]'); if(!b) return; allerOnglet(b.dataset.tab); });
/* Les deux boutons de l'en-tête sont posés une fois pour toutes : ils ne sont
   pas refaits à chaque dessin, et `bind()` les doublerait. */
document.getElementById('gearBtn').addEventListener('click',()=>allerOnglet('settings'));
document.getElementById('nightBtn').addEventListener('click',()=>{
  const allume = !S.day.night;
  modeNuit(allume); save(); render();
  /* La carte du coucher chiffre ce qui part et ce qui reste : sur un stock lu
     il y a deux heures, elle charge des transporteurs sur des ressources
     dépensées depuis, et oublie celles qui se sont accumulées. Le coucher est
     justement le moment où le joueur accepte d'attendre une relecture. */
  if(allume && IS_EXT) faitLeReleve(RELEVE_NUIT);
  /* Allumé en pleine journée, le bouton vaut « je m'absente » : sans ce mot le
     joueur ne sait pas sur quelle heure de retour le plan vient de se caler. */
  if(absenceJour(Date.now())) toast(S.day.backHour == null
    ? `Absence de ${nightLen()} h supposée — Réglages pour l'heure de retour`
    : `Absence jusqu'à ${S.day.backHour} h`);
});
document.getElementById('tzBtn').addEventListener('click',()=>setTimeMode(timeMode === 'local' ? 'server' : 'local'));
view.addEventListener('click', e=>{
  if(e.target.id==='tmSound'){ unlockAudio(); chime(); }
  if(e.target.id==='tmAdd'){
    unlockAudio();
    const sec = parseLeft(document.getElementById('tmLeft').value);
    if(sec==null || sec<=0){ toast('Durée non reconnue : colle par exemple 2h 13m 05s'); return; }
    const [kind,a,b] = document.getElementById('tmWhat').value.split(':');
    const tm = {id:Math.random().toString(36).slice(2,8), kind, end:Date.now()+sec*1000, done:false};
    if(kind==='t'){ tm.k=a; tm.lvl=S.tech[a]+1; }
    else if(kind==='b'){ const p=planetById(a); if(!p) return; tm.pid=a; tm.k=b; tm.lvl=p.b[b]+1; }
    else tm.k=a;
    S.timers.push(tm); save(); document.getElementById('tmLeft').value=''; renderTimers(); toast(`Minuteur lancé : ${clock(sec)}`);
  }
  const rmT = e.target.closest('[data-tmrm]');
  if(rmT){ S.timers = S.timers.filter(t=>t.id!==rmT.dataset.tmrm); save(); stopFlash(); renderTimers(); }
});
setInterval(tickTimers, 1000);
/* publieLePlan est sans effet sur Aujourd'hui, qui se publie en se dessinant ;
   sur Empire, REFRESH.empire ne publie rien : sans cet appel la tuile resterait muette. */
setInterval(()=>{ if(tab==='today'||tab==='empire') garderVue(()=>{ REFRESH[tab](); cartesSync(); }); publieLePlan(); finDeNuit(); }, 30000);
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

/* ---------- one alert, one acknowledgment ---------- */
/** In the extension, every alert goes through the background so a single "OK" clears them all. */
function showBigAlert(label){
  try { chrome.runtime.sendMessage({type:'alert', text:label}); } catch(e) {}
}
function mirrorAlerts(items){
  const box = document.getElementById('bigAlert');
  if(!items || !items.length){ if(!box.hidden) ackFinished(); box.hidden = true; stopFlash(); return; }
  document.getElementById('bigAlertMsg').innerHTML = items.map(esc).join('<br>');
  box.hidden = false;
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

/**
 * La carte Réglages › Version : où en est ce panneau, et quoi taper pour le
 * déplacer. Les deux lectures sont passées en argument pour que le test puisse
 * poser un dépôt en avance sans attendre le réseau.
 */
function versionCard(maj = MAJ, vers = VERSIONS){
  const retard = maj && plusRecente(APP_VERSION, maj);
  const etat = retard ? `Le dépôt est en <b>v${esc(maj)}</b>.`
    : maj ? 'C\'est la dernière du dépôt.'
    : 'La version du dépôt n\'a pas pu être lue.';
  return `<div class="card"><h2>Version</h2>
    <p class="note">Ce panneau tourne en <b>v${esc(APP_VERSION)}</b>. ${etat}</p>
    ${retard ? `<p class="pill warn">v${esc(maj)} disponible</p>
    <p class="note">Depuis le dépôt : <code>git pull &amp;&amp; ./pack.sh</code>. Depuis le zip : retélécharge-le et remplace le dossier. Puis « Recharger » sur <code>chrome://extensions</code>.</p>` : ''}
    ${vers.length ? `<details class="volet"${fold('vers', false)}><summary class="note" data-fold="vers">Historique des versions (${vers.length})</summary>
      <ul class="list mt-2">${vers.map(([v,d,h,s])=>`<li><div><b>v${esc(v)}</b> <span class="note">${esc(d)}</span><br><span class="note">${esc(s)}</span></div><code>${esc(h)}</code></li>`).join('')}</ul>
      <p class="note mt-2">Revenir à l'une d'elles : <code>git checkout <i>empreinte</i> &amp;&amp; ./pack.sh</code>, puis « Recharger ». Une version plus ancienne relit un stockage écrit par la nouvelle : garde un <code>save.json</code> d'avant sous la main.</p>` : `<p class="note">L'historique arrive au prochain <code>./pack.sh</code>.</p>`}
  </div>`;
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
  mse, stockNow, shipReqOk, save, raceDe, ignKey, lfMode, poidsCat, on,
  SHIP_COST, planetById, lfNom, lfIdPour, poseLfCles, labPlanet, goUrl,
  prodOf, fileDe, enCours, POS, production, addBuilt, planetIndexById,
  labLevel, researchTime, NOM_RES, storageNote, reqOk, upLabel, rankUpgrades,
  hangarSiJustifie, debordeTexte, mineEnRetard, signe, naniteRetard,
  robotsOuNanites, casesBasses, laboEnRetard, labOkPour, reglesRecherche,
  planetAlerts, timerLabel, COL_SHIP_COST, KITS, colShipAt, colSentNow,
  colBuilt, maxPlanets, coloTarget, coloFleet, LF_MODE, shipTime, defSurplus,
  tournee, hubIndex, centreIndex, POURQUOI_LABO, centreNote, catActe,
  debordeA, autreCibleAvecPlace, fileBat, render, visibleTimers, TOOLS,
  bascule, syncFailed, aide, coordLink, leverFlotte, coloPaybackTxt,
  occupied, colonyCandidates, raidTargets, raidPlan, catMission, toast,
  habillage
};
