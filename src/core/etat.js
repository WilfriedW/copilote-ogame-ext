/* ---------- l'état du panneau ----------
   `S` est tout ce que le copilote sait et retient : réglages, planètes,
   plan, journal. Il se lit dans le stockage de page (`LS`, posé par
   boot.js) sous la clé KEY, se complète de `sample()` pour les clés qu'une
   vieille sauvegarde ne porte pas, et se sauvegarde depuis app.js (`save`,
   qui pousse aussi la synchro entre postes).

   Module du noyau (issue #49) : il n'importe que les formules. Un module
   qui importe `S` en lit la valeur courante mais ne peut pas le réassigner ;
   remplacer l'état entier (réinitialisation, import d'une sauvegarde) passe
   par `remplaceEtat`. Les réparations qui demandent un domaine (identités
   de planètes, règles, profil, expéditions) restent dans app.js, juste
   après l'import, dans le même ordre qu'avant. */
import { B, T } from './formules.js';

export const KEY = 'ogame-copilot-v1';

/* Le taux de débris par défaut, en pourcent. Déclaré ici parce que sample()
   le lit au chargement, bien avant le bloc du tir de lune. */
export const LUNE_DF = 30;

/* Ressources ramenées par point d'expédition. Valeur de départ, à calibrer sur
   les retours réels : c'est le réglage « facteur de fret ». */
export const EXPO_FRET = 200;

export function sample(){
  return {
    v:1, sample:true,
    settings:{eco:1, fleet:1, cls:'collector', geo:false, eng:false, ratio:[3,2,1], top1:0, colCargo:true, crawlerOverload:false, sats:false, muet:false, debris:LUNE_DF, skin:'relief', releveFrais:60,
      /* Le modèle de défense visé, son palier, et le ratio que le joueur
         écrit lui-même. Le ratio par défaut recopie celui du Framework mineur,
         en clair plutôt que par référence : sample() tourne au chargement,
         bien avant la table DEF_MODELES. */
      defModele:'framework', defPalier:20, defPerso:{rl:40, ll:25, hl:10, ic:0, gc:4, pt:1},
      /* Le plancher (en packs du modèle) que le profil impose tant que le
         palier n'est pas atteint : null = celui du profil. Et la durée de
         chantier, en heures, au-delà de laquelle une carte Défense se coupe. */
      defPlancher:null, defDuree:4,
      /* Combien de cartes chaque liste montre d'office : une valeur pour
         toutes, et celles que le joueur a posées liste par liste. */
      cartesMax:3, cartesListe:{},
      /* Le framework d'expédition. `expoFret` est le nombre de ressources
         ramenées par point de flotte, à calibrer sur les retours réels ;
         `expoRes` les grands transporteurs qu'une expédition ne touche pas,
         à zéro tant que le joueur n'en réserve pas — en réserver d'office
         ferait taire le bloc chez qui n'en a que vingt ; `expoHold` la durée
         d'exploration par défaut, celle qui rapporte le plus à l'heure. */
      expoFret:EXPO_FRET, expoRes:0, expoHold:1,
      /* La sécurité : planètes coffres-forts (ids du copilote), rappel de mise
         à l'abri (heure locale, jours actifs 0 = dimanche), heure de réveil.
         Les transports suggérés partent toujours en Transport. Lu par `secu()`. */
      secu:{vaults:[], rappel:'22:00', jours:[0,1,2,3,4,5,6]}},
    tech:Object.fromEntries(Object.keys(T).map(k=>[k,0])),
    planets:[newPlanet('Planète mère','1:1:8',40,{metal:1})],
    fleetCalc:{from:'1:1:8', to:'1:2:8', pct:100, ships:{sc:1}},
    moonCalc:{pid:'', ship:'lf', n:0, bou:null, viser:12},
    expo:{pf:true},
    ui:{tool:'colony', pose:{k:'metal', lvl:'', hors:{}}},
    day:{interval:90, nightStart:23, nightEnd:7, horizon:24, focus:'equi', night:false, livraison:'palier', nuitAuto:true, nuitAvance:1,
      /* Le joueur a-t-il dit comment il joue. Faux tant qu'il ne l'a pas dit :
         `focus` vaut alors « Équilibré » parce qu'il faut bien viser quelque
         chose, pas parce qu'on le lui a demandé — et c'est la différence que
         la carte d'ouverture a besoin de lire. */
      focusSet:false,
      /* Absence de jour : l'heure de retour du joueur, null quand il n'en a pas
         donné. Et le jour civil où la question du coucher a été répondue, pour
         ne la poser qu'une fois par nuit. */
      /* Et l'instant où la mise à l'abri cesse de valoir : c'est l'allumage qui
         dit sa propre fin, parce qu'au matin rien ne distingue un réveil d'une
         absence qui commence. Zéro quand le mode jour est en place. */
      backHour:null, until:0},
    /* Comment le joueur joue : son style, la classe qu'il vise, sa présence,
       et les focus ponctuels posés par-dessus. Tout vide tant qu'il n'a pas
       répondu — et vide veut dire « ne pondère rien », pas « mineur ». */
    profil:{style:'', classe:'', activite:'regulier', focus:[], set:false},
    lf:{found:['humans','rocktal']},
    centre:null, raid:null, raids:{}, prio:[], prioAsk:[],
    daily:{done:{}, no:{}},
    /* Les minuteurs : vides au départ. Sans la clé, « Réinitialiser » rendait
       un état que renderTimers ne savait pas filtrer, et le panneau levait
       au redessin ; le chargement, lui, la comblait dans app.js. */
    timers:[],
    colo:{fromId:null, objective:'balanced', bonus:0, target:'', kit:'std', tr:'sc', built:false, fields:'', fpos:''},
  };
}

export function newPlanet(name, coords, tmax, b){
  const lv = Object.fromEntries(Object.keys(B).map(k=>[k,0]));
  return {id:Math.random().toString(36).slice(2,9), name, coords, tmax, b:Object.assign(lv,b||{}), sats:0, stock:{m:500,c:500,d:0,at:Date.now()}};
}

export let S;
try{ S = JSON.parse(LS.getItem(KEY)) || sample(); }catch(e){ S = sample(); }
S = Object.assign(sample(), S);
/* Les réglages se fusionnent comme `tech` et `day` juste en dessous :
   `Object.assign` ne descend pas d'un niveau, et une sauvegarde d'avant un
   réglage ne porte pas sa clé — le menu se serait affiché vide et le calcul
   aurait lu `undefined`. */
S.settings = Object.assign(sample().settings, S.settings);
S.tech = Object.assign(sample().tech, S.tech);
S.day = Object.assign(sample().day, S.day);
S.ui = Object.assign(sample().ui, S.ui);
S.lf = Object.assign(sample().lf, S.lf);
/* `moonCalc` rejoint les clés fusionnées : une sauvegarde abîmée ou venue d'une
   autre version le laissait nul ou amputé, et `moonPlanete()` levait — ce qui
   faisait taire toute la synchro, priorités et centre compris. */
S.moonCalc = Object.assign(sample().moonCalc, S.moonCalc);
/* Le mode lune (la campagne de tirs croisés) a été retiré : sa campagne ne se
   garde plus. Le calculateur d'Outils › Lune, lui, reste dans `moonCalc`. */
delete S.lune;
S.raids = S.raids || {};
S.prio = Array.isArray(S.prio) ? S.prio : [];
S.prioAsk = Array.isArray(S.prioAsk) ? S.prioAsk : [];

/**
 * Remplace l'état entier : réinitialisation, import d'une sauvegarde. Seul
 * ce module peut réassigner `S` ; les autres en lisent la valeur courante.
 * @param {object} v le nouvel état, déjà complété
 */
export function remplaceEtat(v){ S = v; }
