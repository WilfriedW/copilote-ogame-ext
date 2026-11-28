/* ---------- les expéditions ----------
   Le cadre d'une expédition (paliers de points, fret, durée), la flotte
   qu'on y envoie (`expoFleet`), les créneaux et les vols en cours
   (`expoInFlight`, `expoCap`, `expoWanted`), puis le journal : ce que chaque
   retour a rapporté, les statistiques qu'on en tire et la prochaine
   expédition proposée (`expoJournal`, `expoStats`, `expoPropose`), et la
   remise d'aplomb de ce qu'une sauvegarde ou l'autre poste y pose
   (`expoSain`).

   Module de domaine (issue #49). Le rendu (`expoHtml`, `expoStatsHtml`,
   `expoCalibHtml`) reste dans app.js jusqu'à l'étape des vues. Ce module
   emprunte encore à app.js les facteurs du serveur, les stocks et l'heure
   de réveil : ce cycle-là est toléré tant qu'app.js existe, et rien n'y est
   lu au chargement. */
import { EXPO_FRET, S } from '../core/etat.js';
import { num } from '../core/format.js';
import { API, ecoSpeed } from '../core/serveur.js';
import { stockNow } from '../economie/production.js';
import { SHIP_COST } from './coques.js';
import { SHIPS, parseC, shipStats, flight, fleetSlots } from './vaisseaux.js';
import { wakeTime } from '../plan/nuit.js';
import { regle } from '../regles/moteur.js';

const EXPO_CAPS = [[1e4,40000],[1e5,500000],[1e6,1200000],[5e6,1800000],[25e6,2400000],[50e6,3000000],[75e6,3600000],[1e8,4200000],[Infinity,5000000]];
export const EXPO_LABELS = ['< 10 000','< 100 000','< 1 M','< 5 M','< 25 M','< 50 M','< 75 M','< 100 M','≥ 100 M'];
/* ---------- le framework d'expédition ---------- */
/* Points d'expédition par vaisseau, et le plafond que la flotte envoyée ne doit
   pas dépasser. Les deux tables sont recopiées de l'énoncé de la demande — le
   framework d'expédition qui circule sur les forums — et non relues sur le
   wiki : l'usage tranchera. EXPO_PTS suit les tranches d'EXPO_CAPS, dont les
   deux premières partagent le même plafond, la table du framework ne
   distinguant pas « moins de 10 000 » de « moins de 100 000 ». */
const EXPO_XP = {lf:20, hf:50, cr:135, bs:300, bc:350, bb:375, ds:550, rp:700, pf:115, sc:20, lc:60, pr:5};
const EXPO_PTS = [2500, 2500, 6000, 9000, 12000, 15000, 18000, 21000, 25000];
/* Ce qu'une expédition peut trouver dépend du vaisseau le plus avancé envoyé :
   on en met un, le meilleur disponible, et un seul — le deuxième ne débloque
   plus rien et mange le plafond. */
export const EXPO_GROS = ['rp','ds','bc','bs'];
/* Ce qui complète jusqu'au plafond, du moins cher en carburant par point au
   plus cher : le plafond se remplit pour que les pirates et les aliens ne
   coûtent rien, pas pour brûler du deutérium.
   Les deux grosses coques passent en dernier, contre leur rang de carburant :
   un faucheur coûte 1,57 deut par point, moins qu'un vaisseau de bataille,
   mais le deuxième et le troisième ne débloquent plus aucune trouvaille —
   seul le plus avancé ENVOYÉ compte, et il est déjà parti. L'aperçu en
   proposait trois quand un seul servait. */
const EXPO_COMBAT = ['bc','lf','hf','bs','bb','cr','ds','rp'];
/* Au-delà de cinq pour cent, le plafond est dépassé pour rien. */
const EXPO_MARGE = 1.05;
/* Durées d'exploration que le jeu propose. ponytail: supposées 1 à 4 heures,
   jamais relues dans le jeu — un serveur qui en propose d'autres se rattrape
   par le réglage de la durée par défaut. */
const EXPO_DUREES = [1,2,3,4];
/* Ce qu'on garde d'historique : les deux cents dernières expéditions, une à
   trois semaines de jeu selon le rythme. Le malus de système ne regarde que
   vingt-quatre heures, les statistiques et la calibration les cinquante
   dernières ; l'âge maximal ne sert qu'à vider un historique abandonné. Il
   reste local au poste : il ne passe pas par la synchro. */
export const EXPO_LOG_MAX = 200;
const EXPO_LOG_TTL = 45*86400e3;
/* Les statistiques et le calibrage ne regardent que les plus récentes : une
   flotte, une classe ou un univers changent, et ce qu'ils rapportaient avec. */
export const EXPO_STATS_N = 50;
/* En dessous, une médiane ne dit rien : le calibrage se tait. */
export const EXPO_CALIB_MIN = 10;
/* Au-delà de dix pour cent d'écart, la proposition vaut un clic. */
const EXPO_CALIB_ECART = 0.1;
/* Une flotte qui n'est pas rentrée une heure après l'heure prévue. */
const EXPO_PERDUE_MS = 3600e3;
/* Les compositions préparées gardées pour combler un aller manqué. */
export const EXPO_PREP_MAX = 20;
export const EXPO_PREP_TTL = 24*3600e3;

export const EXPO_EVTS = {ressources:'Ressources', vaisseaux:'Vaisseaux', pirates:'Pirates', aliens:'Aliens',
  trounoir:'Trou noir', rien:'Rien', retard:'Retard', avance:'Avance', marchand:'Marchand', objet:'Objet',
  pertes:'Pertes', perdue:'Flotte perdue', autre:'Autre'};
/* Les mots d'un rapport d'expédition, dans l'ordre où ils tranchent : un trou
   noir l'emporte sur tout, un combat sur une trouvaille. Vocabulaire construit,
   pas relevé sur un vrai rapport (test/rapports/README.md) : ce qui ne se
   reconnaît pas devient « autre », jamais une supposition. */
const EXPO_MOTS = [
  ['trounoir', /trou noir/],
  ['pirates', /pirate|boucanier|flibustier/],
  ['aliens', /alien|extra-?terrestre/],
  ['marchand', /marchand/],
  ['objet', /\bobjet\b/],
  ['retard', /\bretard/],
  ['avance', /\ben avance\b|\bplus tot\b|\bavance\b/],
  ['vaisseaux', /vaisseaux?\b.{0,80}\b(rejoint|joint|abandonne|trouve|recupere)|(rejoint|rejoindre)\b.{0,40}\bflotte/],
  ['ressources', /(metal|cristal|deuterium)\b.{0,60}\b(collecte|recolte|trouve|recupere|ramasse)|(collecte|recolte|trouve|recupere|ramasse)\w*\b.{0,60}\b(metal|cristal|deuterium)/],
  ['rien', /\brien\b|\bvide\b|sans resultat|bredouille/]
];

/**
 * Tranche de plafond d'expédition. Elle dépend des points du n°1 de l'univers :
 * le classement public les donne, le réglage manuel ne sert plus que si
 * l'API n'a pas encore répondu.
 * @returns {number} indice dans EXPO_CAPS
 */
export function top1Tier(){
  const sc = API && API.scores ? Object.values(API.scores) : null;
  // Le réglage manuel est relu du stockage local : il peut être hors bornes.
  const regle = Math.min(Math.max(0, Math.trunc(+S.settings.top1) || 0), EXPO_CAPS.length-1);
  if(!sc || !sc.length) return regle;
  // `reduce` et pas un spread : le classement d'un univers plein compte des
  // dizaines de milliers de joueurs, assez pour casser la pile.
  const pts = sc.reduce((m,x)=>Math.max(m, (x && x[0]) || 0), 0);
  const i = EXPO_CAPS.findIndex(([lim])=>pts < lim);
  return i<0 ? EXPO_CAPS.length-1 : i;
}
/** Trouvaille maximale d'une expédition, en équivalent métal. Estimation. */
export function expoFind(pf){ return EXPO_CAPS[top1Tier()][1]*ecoSpeed()*(S.settings.cls==='explorer'?1.5:1)*(pf?2:1); }
/** Plafond de points d'une expédition, sur la tranche du n°1 de l'univers. */
export function expoPts(){ return EXPO_PTS[top1Tier()]; }
/** Points de la flotte envoyée. C'est ce chiffre que le plafond borne. */
function expoPoints(ships){ return Object.entries(ships||{}).reduce((a,[k,n])=>a+(EXPO_XP[k]||0)*(n||0), 0); }
/**
 * Fret visé : ce qu'on cherche à embarquer, déduit du plafond de points.
 *
 * Le framework ne passe pas par la table des trouvailles maximales — publiée
 * avant la version 7 du jeu, et que le panneau annonce lui-même comme une
 * borne haute — mais par un nombre de ressources par point, que les retours
 * réels calibrent. D'où le réglage : tant qu'il n'est pas calé, la soute part
 * trop grande ou trop petite, et c'est le joueur qui le voit avant nous.
 */
export function expoFret(){ return expoPts()*Math.max(1, num(S.settings.expoFret, EXPO_FRET))*ecoSpeed(); }
/** La réserve de grands transporteurs d'une planète : ceux que les convois et
    la mise à l'abri gardent, et qu'une expédition immobiliserait des heures. */
export function expoRes(p){ const v = p && p.expoRes != null ? p.expoRes : S.settings.expoRes; return Math.max(0, Math.round(num(v, 0))); }

/**
 * La flotte d'une expédition, composée dans l'ordre du framework : une sonde,
 * un éclaireur, un gros vaisseau, des grands transporteurs jusqu'au fret visé,
 * puis des vaisseaux de combat jusqu'au plafond de points.
 *
 * Le plafond de points est ce que le jeu regarde. En dessous, les pirates et
 * les aliens coûtent des vaisseaux à chaque mauvaise rencontre ; au-dessus,
 * l'expédition ne trouve rien de plus et le deutérium du vol est brûlé pour
 * rien. On le vise donc, à cinq pour cent près, et jamais plus.
 *
 * La réserve de grands transporteurs n'est jamais touchée : ce sont ceux des
 * convois et de la mise à l'abri du soir, et une expédition les garde en l'air
 * plusieurs heures.
 *
 * @param {object} avail vaisseaux au sol, par clé
 * @param {object} [p] la planète, pour sa réserve propre
 * @returns {{ships:object, cargo:number, cap:number, fret:number, pts:number,
 *   ptsCap:number, plein:boolean}|null} null sans transporteur disponible :
 *   sans soute, une expédition ne ramène rien, et le plafond de points ne
 *   remplace pas le fret.
 */
export function expoFleet(avail, p){
  avail = avail || {};
  const garde = expoRes(p), ships = {}, ptsCap = expoPts();
  const libre = k => Math.max(0, (avail[k]||0) - (k==='lc' ? garde : 0)) - (ships[k]||0);
  const prendre = (k, n) => { n = Math.min(n, libre(k)); if(n>0) ships[k] = (ships[k]||0) + n; return n>0; };
  const soute = () => Object.keys(ships).reduce((a,k)=>a+ships[k]*shipStats(k).cargoEff, 0);

  if(libre('pr') > 0) prendre('pr', 1);
  const pf = prendre('pf', 1) ? 1 : 0;
  const gros = EXPO_GROS.find(k => libre(k) > 0);
  if(gros) prendre(gros, 1);

  /* Le fret d'abord : c'est lui qui ramène. Le plafond de points ne le borne
     pas — au facteur par défaut, les transporteurs qu'il demande en consomment
     toujours moins que le plafond n'en offre.
     Ce qui le borne, c'est la trouvaille maximale : embarquer plus que ce
     qu'une expédition peut rapporter brûle du deutérium pour une soute qui
     revient à moitié vide. Les deux modèles tombent d'accord dès la deuxième
     tranche — 2,4 M pour 12 000 points, ce sont bien les 200 ressources par
     point du réglage — et ne divergent que dans un univers tout neuf, où la
     table des trouvailles est la plus basse. */
  const fret = Math.min(expoFret(), expoFind(pf));
  let cargo = soute();
  for(const k of ['lc','sc']){
    const u = shipStats(k).cargoEff;
    if(!u || cargo >= fret) continue;
    const n = Math.min(libre(k), Math.ceil((fret-cargo)/u));
    if(n>0 && prendre(k, n)) cargo += n*u;
  }
  if(!ships.lc && !ships.sc) return null;

  /* Puis le plafond, sans le dépasser : chaque type en prend autant qu'il en
     reste de place. Après cette boucle, l'écart qui reste est plus petit que
     tout ce qui pourrait encore partir. */
  let pts = expoPoints(ships);
  for(const k of EXPO_COMBAT){
    const place = Math.floor((ptsCap - pts)/EXPO_XP[k]);
    if(place > 0){ const n = Math.min(place, libre(k)); if(n>0 && prendre(k, n)) pts += n*EXPO_XP[k]; }
  }
  /* Et le dernier vaisseau, celui qui fait « atteindre le plafond » : le plus
     petit qui reste, pour que le dépassement tienne dans la marge. */
  if(pts < ptsCap){
    const k = EXPO_COMBAT.filter(k=>libre(k) > 0).sort((a,b)=>EXPO_XP[a]-EXPO_XP[b])
      .find(k=>pts + EXPO_XP[k] <= ptsCap*EXPO_MARGE);
    if(k && prendre(k, 1)) pts += EXPO_XP[k];
  }
  return {ships, cargo:soute(), cap:expoFind(pf), fret, pts, ptsCap, plein: pts >= ptsCap};
}
/* How long a reading of the in-flight expedition count stays trustworthy.
   The cap is never expired by expoCap(), because it only moves with
   Astrophysics; the number in flight does move on its own, so it needs its
   own guard. Never expiring it would silence the panel for the rest of the
   day after a single "2/2", which costs as much trust as the lie it fixes. */
export const EXPO_READ_TTL = 3*3600e3;
/* Le chiffre vient d'une expression régulière sur le texte d'une page du jeu,
   où s'affichent des chaînes écrites par d'autres joueurs, et il sert de borne
   de boucle. Un nombre absurde y gèlerait le panneau. Le jeu ne dépasse pas une
   poignée d'expéditions simultanées ; trente-deux laisse toute la marge utile
   et tient dans n'importe quel cas. */
const EXPO_MAX_READ = 32;
/**
 * Expeditions in flight, as last read on the game's fleet page.
 * @returns {{n:number, at:number}|null} count and reading time, or null when
 *   nothing fresh enough has been read.
 */
export function expoInFlight(){
  if(!(S.slots && S.slots.expo)) return null;
  /* L'heure de la lecture, et rien d'autre. Se rabattre sur `syncAt` comme le
     fait fleetSlots() rendrait éternellement frais un `slots` enregistré avant
     la 1.25, quand l'heure n'était pas estampillée : le panneau se tairait sur
     les expéditions jusqu'à la prochaine ouverture de la page de flotte. */
  const at = S.slots.at;
  const n = Math.min(Math.max(0, Math.floor(Number(S.slots.expo[0]) || 0)), EXPO_MAX_READ);
  return at && Date.now()-at < EXPO_READ_TTL ? {n, at} : null;
}
/* Expéditions simultanées. Le chiffre du jeu fait foi quand il est frais : la
   formule ne sert plus qu'à prévoir ce qu'un niveau d'Astrophysique y
   ajouterait. La prendre au maximum des deux faisait proposer une expédition
   que le jeu refusait. */
export function expoCap(astro){
  const f = a => Math.floor(Math.sqrt(Math.max(0, a))) + (S.settings.cls==='explorer' ? 2 : 0);
  /* Pas de péremption sur ce chiffre : le nombre d'expéditions simultanées ne
     bouge qu'avec Astrophysique. Seul le nombre d'expéditions en cours se périme,
     et il ne sert pas ici. Le jeter au bout de trois heures ramenait le plan à
     la formule dès que le joueur n'avait pas rouvert la page Flotte. */
  const lu = S.slots && S.slots.expo && S.slots.expo[1] > 0;
  const base = lu ? S.slots.expo[1] : f(S.tech.astro);
  return Math.max(0, base + f(astro == null ? S.tech.astro : astro) - f(S.tech.astro));
}
/** Niveau d'Astrophysique qui donnera une expédition simultanée de plus. */
export function astroForExpo(){ return Math.pow(Math.floor(Math.sqrt(Math.max(0, S.tech.astro)))+1, 2); }
/* Expéditions que la flotte au sol pourrait remplir, plafond ignoré. Comptées
   jusqu'à douze : au-delà, seul « plus que le plafond » compte. */
export function expoWanted(){
  let n = 0;
  for(const p of S.planets){
    const reste = Object.assign({}, p.ships);
    while(n < 12){
      const f = expoFleet(reste, p); if(!f) break;
      for(const [k,c] of Object.entries(f.ships)) reste[k] = (reste[k]||0) - c;
      n++;
    }
  }
  return n;
}
/* ---------- où relancer, depuis où, avec quoi ---------- */
/** Position 16 du système d'une planète : la seule destination d'une expédition. */
export function expoTgt(p){ const c = parseC(p && p.coords); return c ? `${c[0]}:${c[1]}:16` : null; }
/** Son système, « galaxie:système », tel que l'historique le range. */
export function expoSys(p){ const c = parseC(p && p.coords); return c ? `${c[0]}:${c[1]}` : null; }
/**
 * Expéditions parties vers un système ces vingt-quatre heures.
 *
 * Les résultats baisseraient quand un système est trop sollicité — c'est ce
 * que dit le framework, et ce que l'extension n'a pas de quoi vérifier. D'où
 * un malus de classement et non une exclusion : au pire le joueur part d'une
 * planète un peu plus lente, jamais de nulle part.
 * @param {object} [deja] expéditions déjà proposées dans ce même passage,
 *   par système : sans elles, trois emplacements libres proposaient trois
 *   fois le même système, chacun ignorant les deux autres.
 */
function expoVus(sys, now, deja){
  now = now || Date.now();
  const n = (S.expoLog||[]).filter(e=>e.sys===sys && now - e.at < 86400e3).length;
  return n + ((deja && deja[sys]) || 0);
}

/* ---------- le journal des expéditions ----------
   Ce que rapporte chaque expédition, lu sur les mouvements du jeu : l'aller
   dit ce qui part, le retour ce qui revient, et la différence ce qui a été
   trouvé ou perdu. Le même historique `S.expoLog` sert toujours au malus de
   système : ses champs `cle`, `at`, `sys` et `de` gardent leur sens, `at`
   restant l'heure du retour. Rien ici ne déclenche quoi que ce soit dans le
   jeu : tout se lit sur ce que le joueur a déjà ouvert. */

/** Le type d'événement que dit un rapport d'expédition, ou « autre ». */
function expoEvtDe(texte){
  const t = String(texte || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`]/g, "'");
  for(const [k, re] of EXPO_MOTS) if(re.test(t)) return k;
  return 'autre';
}

const expoSomme = c => Array.isArray(c) ? (+c[0]||0) + (+c[1]||0) + (+c[2]||0) : 0;
/** Soute d'une flotte, avec les technologies du joueur. */
function expoSoute(ships){ return Object.entries(ships||{}).reduce((a,[k,n])=>a + (SHIPS[k] ? shipStats(k).cargoEff*(n||0) : 0), 0); }
/** Coût de construction d'une flotte, [m, c, d]. */
function expoValeur(ships){
  const v = [0,0,0];
  for(const [k,n] of Object.entries(ships||{})){ const c = SHIP_COST[k]; if(c && n > 0) for(let j=0;j<3;j++) v[j] += c[j]*n; }
  return v;
}
/** Équivalent métal au ratio du joueur. */
function metalEq(v){
  const r = (S.settings && S.settings.ratio) || [3,2,1];
  return (+v[0]||0) + (+v[1]||0)*r[0]/r[1] + (+v[2]||0)*r[0]/r[2];
}
/** Vol simple, en secondes, à pleine vitesse : la seule que le copilote sait. */
function expoAller(e, ships){ const f = flight(e.de, e.dest, ships || {}, 100); return f ? f.secs : 0; }
const expoDest = e => e.dest || (String(e.cle||'').match(/(\d+:\d+:\d+)@/) || [])[1] || '';
const expoShips = e => (e.envoi && e.envoi.ships) || (e.retour && e.retour.ships) || {};
const expoHoldMs = () => Math.max(1, Math.round(num(S.settings.expoHold, 1)))*3600e3;
/** L'heure où l'événement a lieu : fin de l'exploration, avant le vol retour. */
function expoEvtAt(e){
  const ow = expoAller(e, expoShips(e))*1000;
  if(e.retour && e.retour.at) return e.retour.at - ow;
  return e.aller ? e.aller + expoHoldMs() : e.at;
}
/** Le retour attendu, lu ou estimé. */
function expoPrevu(e){
  if(e.retour && e.retour.at) return e.retour.at;
  return (e.aller || e.at) + expoHoldMs() + expoAller(e, expoShips(e))*1000;
}
/** Une expédition dont le résultat est su : retour lu après l'événement, ou flotte perdue. */
const expoConnue = e => !!(e && (e.perdue || (e.retour && e.retour.final && e.retour.ships)));

/** La composition que « Préparer » a proposée pour ce départ, faute d'aller vu. */
function expoPrepPour(e, avant){
  const l = (S.expoPrep||[]).filter(x => x.de === e.de && x.dest === expoDest(e) && x.at <= avant && avant - x.at < EXPO_PREP_TTL);
  return l.length ? l[l.length-1] : null;
}

/**
 * Recalcule ce qui se déduit d'une entrée : trouvés, pertes, carburant,
 * durée et type d'événement. Appelée à chaque changement, jamais devinée :
 * sans envoi connu, trouvés et pertes restent vides.
 */
function expoFinalise(e){
  if(!e.envoi){
    const p = expoPrepPour(e, e.aller || expoEvtAt(e));
    if(p) e.envoi = {ships: Object.assign({}, p.ships), at: p.at, src: 'prep'};
  }
  const env = e.envoi && e.envoi.ships, ret = e.retour && e.retour.ships;
  e.trouves = null; e.pertes = null;
  if(e.perdue){
    e.cargaison = [0,0,0];
    e.pertes = env ? Object.assign({}, env) : null;
  } else if(ret){
    e.cargaison = e.retour.cargo || null;
    if(env){
      e.trouves = {}; e.pertes = {};
      for(const k of new Set(Object.keys(env).concat(Object.keys(ret)))){
        const d = (ret[k]||0) - (env[k]||0);
        if(d > 0) e.trouves[k] = d; else if(d < 0) e.pertes[k] = -d;
      }
    }
  }
  const ships = env || ret;
  const f = ships && flight(e.de, expoDest(e), ships, 100);
  e.carburant = f ? Math.round(f.fuel*(e.perdue ? 1 : 2)) : null;
  const ow = f ? f.secs*1000 : 0;
  const depart = e.aller ? e.aller - ow : null;
  const fin = e.retour && e.retour.at ? e.retour.at : e.perdue ? expoPrevu(e) : null;
  e.duree = fin ? (depart ? fin - depart : 2*ow + expoHoldMs()) : null;
  e.dureeEst = !depart;
  if(e.evSrc !== 'msg'){
    e.evenement = e.perdue ? 'perdue'
      : !expoConnue(e) ? null
      : e.pertes && Object.keys(e.pertes).length ? 'pertes'
      : e.trouves && Object.keys(e.trouves).length ? 'vaisseaux'
      : expoSomme(e.cargaison) > 0 ? 'ressources' : 'rien';
  }
  e.at = expoPrevu(e);
  return e;
}

/**
 * Le journal se nourrit des mouvements lus. L'aller ouvre une entrée, le
 * retour la complète, et un retour lu AVANT l'événement — il porte encore la
 * flotte envoyée et une soute vide — ne compte pas comme résultat : il est
 * remplacé dès qu'une lecture plus tardive arrive.
 *
 * @param {object[]} moves les mouvements du jeu (S.moves), lus avec leur heure `lu`
 * @param {number} now
 * @param {number} [listeVue] heure de la dernière lecture de la liste complète
 *   des vols (encart des événements ou page Mouvements) : un retour absent de
 *   cette lecture, après l'événement, est un retour qui ne viendra pas.
 */
export function expoJournal(moves, now, listeVue){
  if(!Array.isArray(S.expoLog)) S.expoLog = [];
  const log = S.expoLog;
  const expos = (moves||[]).filter(m => m && +m.mission === 15 && m.dest && m.origin && (m.camp||'own') === 'own' && parseC(m.dest));
  const sysDe = d => { const c = parseC(d); return `${c[0]}:${c[1]}`; };
  const touche = new Set();
  // L'aller d'abord : il ouvre l'entrée que le retour viendra compléter.
  for(const m of expos.filter(m => !m.ret).sort((a,b)=>a.arrival-b.arrival)){
    const a = m.arrival*1000;
    let e = log.find(x => x.de === m.origin && expoDest(x) === m.dest && x.aller === a);
    /* Une même expédition peut se montrer en deux rangées avant son retour
       (arrivée, fin d'exploration) : la seconde rejoint la première. */
    if(!e) e = log.find(x => x.de === m.origin && expoDest(x) === m.dest && x.aller && !expoConnue(x) && Math.abs(x.aller - a) < 25*3600e3 && (!x.retour || x.retour.at > a));
    if(!e){ e = {cle:`${m.origin}>${m.dest}@${m.arrival}`, at:a, sys:sysDe(m.dest), de:m.origin, dest:m.dest, aller:a, envoi:null}; log.push(e); }
    if(!e.aller || a < e.aller) e.aller = a;
    const ships = m.ships && Object.keys(m.ships).length && m.detailConnu !== false ? m.ships : null;
    if(ships && (!e.envoi || e.envoi.src !== 'aller')) e.envoi = {ships: Object.assign({}, ships), at: a, src: 'aller'};
    touche.add(e);
  }
  for(const m of expos.filter(m => m.ret)){
    const r = m.arrival*1000;
    let e = log.find(x => x.de === m.origin && expoDest(x) === m.dest && x.retour && x.retour.at === r)
      || log.find(x => x.cle === `${m.dest}@${m.arrival}`);
    if(!e){
      /* Un retard ou une avance déplace l'heure du retour : l'entrée en vol
         vers ce système, partie avant, est la même expédition. */
      const enVol = log.filter(x => x.de === m.origin && expoDest(x) === m.dest && !x.perdue && !expoConnue(x)
        && (x.aller || 0) < r && (!x.retour || Math.abs(x.retour.at - r) < 24*3600e3));
      e = enVol.sort((x,y)=>(y.aller||0)-(x.aller||0))[0];
    }
    if(!e){ e = {cle:`${m.dest}@${m.arrival}`, at:r, sys:sysDe(m.dest), de:m.origin, dest:m.dest, envoi:null}; log.push(e); }
    if(!e.dest) e.dest = m.dest;
    e.retourVu = Math.max(e.retourVu || 0, +m.lu || 0);
    const connu = m.detailConnu !== false && m.ships && Object.keys(m.ships).length;
    const ships = connu ? Object.assign({}, m.ships) : null;
    const cargo = connu && Array.isArray(m.cargo) ? m.cargo.map(x => +x || 0) : null;
    /* Résolu : lu après l'heure de l'événement, ou portant déjà ce que
       l'expédition a changé — une soute pleine, une flotte différente. */
    const seuil = r - expoAller(e, ships || expoShips(e))*1000;
    // seule une flotte vue partir prouve un changement : une composition préparée a pu ne pas partir telle quelle
    const env = e.envoi && e.envoi.src === 'aller' && e.envoi.ships;
    const change = expoSomme(cargo) > 0 || (env && ships && JSON.stringify(Object.entries(env).filter(([,n])=>n>0).sort()) !== JSON.stringify(Object.entries(ships).filter(([,n])=>n>0).sort()));
    const final = !!ships && ((+m.lu || 0) >= seuil || !!change);
    if(e.retour && e.retour.final && !final) { touche.add(e); continue; }
    e.retour = {at:r, ships, cargo, lu:+m.lu || 0, final};
    if(e.perdue){ e.perdue = false; }
    touche.add(e);
  }
  // Les flottes qui ne reviendront pas.
  for(const e of log){
    if(!e.aller || e.perdue || expoConnue(e)) continue;
    const prevu = expoPrevu(e);
    if(listeVue && listeVue > expoEvtAt(e) && listeVue < prevu && (e.retourVu || 0) < listeVue - 60e3) e.manque = listeVue;
    if(now > prevu + EXPO_PERDUE_MS && (!e.retour || e.manque)){ e.perdue = true; touche.add(e); }
  }
  for(const e of touche) expoFinalise(e);
  expoTaille();
}
/** L'historique borné : les plus anciennes partent d'abord. */
function expoTaille(){
  if(!Array.isArray(S.expoLog)) return;
  const now = Date.now();
  S.expoLog = S.expoLog.filter(x => now - x.at < EXPO_LOG_TTL).sort((a,b)=>a.at-b.at).slice(-EXPO_LOG_MAX);
}

/**
 * Les rapports d'expédition lus dans la messagerie : chacun donne son type
 * d'événement à l'expédition du même système dont l'événement tombe le plus
 * près de son heure.
 */
export function expoMessages(msgs){
  if(!Array.isArray(msgs) || !Array.isArray(S.expoLog)) return 0;
  let n = 0;
  for(const m of msgs){
    if(!m || !m.id || !Number.isFinite(+m.at) || !parseC(m.coords)) continue;
    if(S.expoLog.some(e => e.msg === String(m.id))) continue;
    const c = parseC(m.coords), sys = `${c[0]}:${c[1]}`;
    const cands = S.expoLog.filter(e => e.sys === sys && !e.msg && Math.abs(expoEvtAt(e) - m.at) < 2*3600e3);
    if(!cands.length) continue;
    const e = cands.sort((a,b)=>Math.abs(expoEvtAt(a)-m.at) - Math.abs(expoEvtAt(b)-m.at))[0];
    e.msg = String(m.id); e.evSrc = 'msg'; e.evenement = expoEvtDe(m.texte);
    n++;
  }
  return n;
}

/** Les expéditions connues, leurs déductions faites : une entrée relue d'une
    sauvegarde ancienne peut porter un retour sans ses champs déduits. */
function expoPretes(log){
  return (log||[]).filter(expoConnue).map(e => e.cargaison === undefined ? expoFinalise(e) : e);
}
/** Ce que rapporte une expédition connue, en équivalent métal : ressources et
    vaisseaux trouvés, moins carburant et pertes. */
function expoGain(e){
  return metalEq(e.cargaison || [0,0,0]) + metalEq(expoValeur(e.trouves)) - metalEq([0,0,e.carburant||0]) - metalEq(expoValeur(e.pertes));
}
/** Agrège une liste d'expéditions connues. */
function expoAgrege(L){
  const avecCargo = L.filter(e => Array.isArray(e.cargaison));
  const res = [0,1,2].map(j => avecCargo.length ? avecCargo.reduce((a,e)=>a+(+e.cargaison[j]||0),0)/avecCargo.length : 0);
  const soutes = L.filter(e => e.envoi && Array.isArray(e.cargaison) && expoSoute(e.envoi.ships) > 0);
  const soute = soutes.length ? soutes.reduce((a,e)=>a+Math.min(1, expoSomme(e.cargaison)/expoSoute(e.envoi.ships)),0)/soutes.length : null;
  const evts = {};
  for(const e of L){ const k = e.evenement || 'autre'; evts[k] = (evts[k]||0) + 1; }
  const sus = L.filter(e => e.trouves);
  const trouves = sus.length ? sus.reduce((a,e)=>a+expoSomme(expoValeur(e.trouves)),0)/sus.length : null;
  const perd = L.filter(e => e.pertes);
  const pertes = perd.length ? perd.reduce((a,e)=>a+expoSomme(expoValeur(e.pertes)),0)/perd.length : null;
  const heures = L.reduce((a,e)=>a + (e.duree||0)/36e5, 0);
  const gain = L.reduce((a,e)=>a + expoGain(e), 0);
  return {n:L.length, res, soute, nSoute:soutes.length, evts, trouves, nSus:sus.length, pertes, nPerd:perd.length,
    rendement: heures > 0 ? gain/heures : null, heures};
}
/**
 * Statistiques des n dernières expéditions au résultat connu. Fonction pure
 * de l'historique (et des technologies, pour les soutes).
 * @returns {object} agrégat global, par planète de départ, et par nombre
 *   d'expéditions vers le même système dans les 24 h qui précèdent
 */
export function expoStats(log, n){
  n = n || EXPO_STATS_N;
  const tout = expoPretes(log).sort((a,b)=>a.at-b.at);
  const L = tout.slice(-n);
  const parPlanete = {};
  for(const e of L) (parPlanete[e.de || '?'] = parPlanete[e.de || '?'] || []).push(e);
  const parSollicitation = {};
  for(const e of L){
    const k = Math.min(3, (log||[]).filter(x => x !== e && x.sys === e.sys && x.at < e.at && e.at - x.at < 86400e3).length);
    (parSollicitation[k] = parSollicitation[k] || []).push(e);
  }
  const map = o => Object.fromEntries(Object.entries(o).map(([k,v])=>[k, expoAgrege(v)]));
  return Object.assign(expoAgrege(L), {parPlanete: map(parPlanete), parSollicitation: map(parSollicitation)});
}
const mediane = v => { const s = v.slice().sort((a,b)=>a-b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m-1]+s[m])/2; };
/**
 * Le facteur de fret que les retours réels suggèrent.
 *
 * Seules les expéditions qui ont ramené des ressources comptent : une
 * rencontre de pirates ou un retour à vide ne dit rien de la soute qu'il
 * fallait — les mêler mettrait la médiane à zéro dès qu'une expédition sur
 * deux ne trouve pas de ressources. Médiane et pas moyenne : une trouvaille
 * exceptionnelle ne déplace pas le réglage.
 *
 * @param {object[]} log l'historique
 * @param {number} cur le réglage actuel
 * @returns {{n:number, prop:number|null, cur:number, ecart:number|null,
 *   montre:boolean, pleines:boolean}}
 */
export function expoFretPropose(log, cur){
  cur = Math.max(1, num(cur, EXPO_FRET));
  const L = expoPretes(log).filter(e => !e.perdue && e.envoi && Array.isArray(e.cargaison) && expoSomme(e.cargaison) > 0 && expoPoints(e.envoi.ships) > 0)
    .sort((a,b)=>a.at-b.at).slice(-EXPO_STATS_N);
  const out = {n:L.length, prop:null, cur, ecart:null, montre:false, pleines:false};
  if(L.length < EXPO_CALIB_MIN) return out;
  const f = L.map(e => expoSomme(e.cargaison)/expoPoints(e.envoi.ships)/ecoSpeed()).filter(x => Number.isFinite(x) && x > 0);
  if(f.length < EXPO_CALIB_MIN) return out;
  out.prop = Math.max(10, Math.round(mediane(f)/10)*10);
  out.ecart = Math.abs(out.prop - cur)/cur;
  /* Une soute revenue pleine dit seulement qu'il y avait au moins ça : si
     c'est le cas le plus souvent, la médiane est une borne basse. */
  const pleines = L.filter(e => { const s = expoSoute(e.envoi.ships); return s > 0 && expoSomme(e.cargaison) >= 0.98*s; }).length;
  out.pleines = pleines > L.length/2;
  const ign = num(S.expo && S.expo.fretIgnore, 0);
  out.ignoree = ign > 0 && Math.abs(out.prop - ign)/ign <= EXPO_CALIB_ECART;
  out.montre = out.ecart > EXPO_CALIB_ECART && !out.ignoree;
  return out;
}
/**
 * Heures de retour des expéditions en vol, la plus proche d'abord.
 *
 * Deux sources, qui savent toutes deux QUAND : les minuteurs, puis les
 * mouvements de flotte du jeu — un retour sans minuteur ferait voir un
 * emplacement libre là où le jeu affiche « 2/2 ». Le compteur de la page de
 * flotte, lui, reste dehors : il ne connaît qu'un nombre, et le faire passer
 * pour une heure de retour annonçait « prochain retour dans 3 h », c'est-à-dire
 * la fin de sa péremption, sur une flotte qui rentrait quatre heures plus tard.
 * `expoEtat` le compte à part, là où un nombre suffit.
 */
function expoVols(now){
  now = now || Date.now();
  const fins = [];
  for(const t of S.timers||[]) if(!t.done && t.kind==='x' && t.k==='expo' && t.end>now) fins.push(t.end);
  for(const m of S.moves||[]){
    if(m.mission !== 15 || !m.ret) continue;
    const fin = m.arrival*1000;
    if(fin > now && !fins.includes(fin)) fins.push(fin);
  }
  return fins.sort((a,b)=>a-b);
}
/**
 * Durée d'exploration à proposer, en heures.
 *
 * Une heure par défaut : c'est elle qui rapporte le plus à l'heure passée en
 * l'air. Le joueur absent cherche autre chose — une flotte qui vole pendant
 * qu'il n'est pas là, plutôt qu'une flotte posée qui attend son retour. On
 * prend alors la plus longue durée qui rentre avant qu'il revienne, et à
 * défaut la plus longue tout court.
 *
 * ponytail: « absent » se lit sur le mode nuit et l'heure de retour, les deux
 * seules choses que le panneau sache de la présence du joueur. Un vrai niveau
 * d'activité de profil le dirait mieux.
 */
export function expoDuree(volSecs, now){
  now = now || Date.now();
  const def = Math.max(1, Math.round(num(S.settings.expoHold, 1)));
  if(!S.day.night) return def;
  const wake = wakeTime(now);
  if(!wake || wake <= now) return def;
  const tient = EXPO_DUREES.filter(h => now + (2*volSecs + h*3600)*1000 <= wake);
  return tient.length ? Math.max(...tient) : Math.max(def, ...EXPO_DUREES);
}
/**
 * Ce qui classe une planète de départ, et ce qui le justifie en clair.
 *
 * Le plan du jour et le bloc Expéditions trient par le même chiffre : deux
 * classements différents donneraient deux planètes différentes sur deux
 * écrans voisins, et c'est le panneau qui aurait l'air de se contredire.
 *
 * Trois points pour une soute qui atteint le fret visé — c'est elle qui
 * ramène ; jusqu'à deux pour la proximité de la position 16, qui raccourcit
 * le vol ; un pour l'éclaireur, qui double les gains ; un de moins par
 * expédition déjà partie vers ce système.
 * @returns {{score:number, pourquoi:string[]}}
 */
export function expoScore(f, coords, now, deja){
  const c = parseC(coords) || [0,0,16], sys = `${c[0]}:${c[1]}`;
  const vus = expoVus(sys, now, deja), pourquoi = [];
  let score = 2*(1 - Math.min(1, Math.abs(16-c[2])/15));
  if(f.cargo >= f.fret){ score += 3; pourquoi.push('soute au fret visé'); }
  if(f.ships.pf){ score += 1; pourquoi.push('éclaireur à bord'); }
  if(vus){ score -= vus; pourquoi.push(`${vus} expédition${vus>1?'s':''} déjà vers ${sys} en 24 h`); }
  return {score, pourquoi};
}
/**
 * Les planètes d'où partir, la meilleure d'abord.
 *
 * Deux conditions ne se négocient pas : le plafond de points atteint, et le
 * deutérium de l'aller-retour en caisse. Une planète qui manque l'une des deux
 * ne reste dans la liste que si aucune autre ne les tient — le joueur veut
 * alors savoir que son meilleur coup est imparfait, pas lire une liste vide.
 *
 * @param {object[]} [flottes] vaisseaux au sol à considérer, par rang de
 *   planète : le bloc en décompte ce qu'il vient de proposer avant de
 *   proposer l'emplacement suivant.
 */
function expoCandidats(now, flottes, deja){
  now = now || Date.now();
  const sol = flottes || expoAuSol(now), out = [];
  for(const [i,p] of S.planets.entries()){
    const tgt = expoTgt(p); if(!tgt) continue;
    const f = expoFleet(sol[i], p); if(!f) continue;
    const fl = flight(p.coords, tgt, f.ships, 100); if(!fl) continue;
    const heures = expoDuree(fl.secs, now), fuel = Math.round(fl.fuel*2);
    const sys = expoSys(p), pos = (parseC(p.coords)||[0,0,16])[2];
    const deut = stockNow(p)[2] >= fuel;
    const {score, pourquoi} = expoScore(f, p.coords, now, deja);
    out.push({p, i, f, fl, tgt, sys, fuel, heures, deut, score, pourquoi, pos,
      retour: now + (2*fl.secs + heures*3600)*1000});
  }
  const entiers = out.filter(x=>x.f.plein && x.deut), payables = out.filter(x=>x.deut);
  const choix = entiers.length ? entiers : payables.length ? payables : out;
  return choix.sort((a,b)=>b.score-a.score || b.f.cargo-a.f.cargo);
}
/**
 * La flotte au sol que le bloc peut engager, par rang de planète : celle du
 * relevé, moins ce qu'une expédition déjà lancée a emporté.
 *
 * Un « Lancé » pose un minuteur qui porte sa flotte. Sans le déduire, le bloc
 * reproposait les mêmes vaisseaux pour l'emplacement d'après — c'est ce que
 * le plan fait déjà de son côté quand il simule la journée.
 */
function expoAuSol(now){
  now = now || Date.now();
  const out = S.planets.map(p=>Object.assign({}, p.ships));
  for(const t of S.timers||[]){
    if(t.done || t.kind!=='x' || t.k!=='expo' || !t.manual || !t.ships || t.end<=now) continue;
    const i = S.planets.findIndex(p=>p.id === t.pid);
    if(i >= 0) for(const [k,n] of Object.entries(t.ships)) out[i][k] = Math.max(0, (out[i][k]||0) - n);
  }
  return out;
}

/** Une recommandation par emplacement libre, chacune avec ses deux suivantes. */
export function expoPropose(now, n){
  now = now || Date.now();
  const flottes = expoAuSol(now), deja = {}, out = [];
  for(let k=0; k<n; k++){
    const cands = expoCandidats(now, flottes, deja);
    if(!cands.length) break;
    const b = cands[0];
    out.push(Object.assign({alts: cands.slice(1,3)}, b));
    for(const [j,c] of Object.entries(b.f.ships)) flottes[b.i][j] = Math.max(0, (flottes[b.i][j]||0) - c);
    deja[b.sys] = (deja[b.sys]||0) + 1;
  }
  return out;
}
/** Emplacements d'expédition : pris, libres, et le prochain retour. */
export function expoEtat(now){
  now = now || Date.now();
  const max = expoCap(), vols = expoVols(now), lu = expoInFlight(), fs = fleetSlots();
  /* Le plus pessimiste des deux comptes : le jeu affiche « 2/2 » alors qu'un
     seul retour porte son minuteur, et proposer sur la foi des minuteurs seuls
     envoyait lancer une expédition que le jeu refuse. */
  const pris = Math.min(max, Math.max(vols.length, lu ? lu.n : 0));
  const libres = Math.max(0, max - pris);
  /* Une expédition prend aussi un emplacement de flotte : tous pris, le jeu
     refuse le départ, et proposer quand même envoie cliquer sur rien. D'où
     deux chiffres — `libres`, ce que le compteur annonce, et `lancables`, ce
     qui peut vraiment partir. Sans lecture fraîche des emplacements de flotte
     on ne borne pas : on ne sait pas, et se taire coûterait plus. */
  const fsLibres = fs ? Math.max(0, fs[1] - fs[0]) : libres;
  return {max, pris, libres, lancables: Math.min(libres, fsLibres), prochain: vols[0] || 0, fs,
    flotteBloquee: libres > 0 && fsLibres <= 0};
}
/**
 * Remet d'aplomb ce que le framework d'expédition lit du stockage.
 *
 * À part, et appelée aux deux endroits — au démarrage et dans `sainEtat` —
 * parce que le démarrage n'appelle pas `sainEtat` : une clé validée seulement
 * là arrive telle quelle au premier `render()`. Un facteur de fret absurde
 * envoie deux cents transporteurs, une réserve négative en rend plus qu'il
 * n'y en a, et `expoHold` borne une boucle de durées.
 */
export function expoSain(){
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
export function expoEntreeSaine(e){
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
