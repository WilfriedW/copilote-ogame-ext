/* ---------- l'onglet Outils ----------
   Les sous-onglets Cibles, Colonie, Flotte, Lune et Serveur (`VIEWS_OUTILS`,
   `REFRESH_OUTILS`, `TOOLS` en tête de la barre), avec ce qu'ils affichent
   seuls : les faits du serveur mis en forme, le calculateur de lune, le
   calibrage des expéditions. La Défense a son module.

   Module des vues (issue #49). app.js réassemble `VIEWS` et `REFRESH` à
   partir des morceaux de chaque onglet. Ce module emprunte encore à app.js le
   rendu et les calculs qui n'ont pas de module : ce cycle-là est toléré tant
   qu'app.js existe, et rien n'y est lu au chargement. */
import {
  KITS, OBJECTIVES, colShipAt, colBuilt, maxPlanets, coloFrom,
  rankPositions, coloTarget, coloFleet, COLO_HORIZON_H, colonyPayback,
  coloVerdict, colonyCandidates
} from '../colonisation/colonisation.js';
import { EXPO_FRET, S } from '../core/etat.js';
import { nf, fmt, esc, num, costHtml, planetRef } from '../core/format.js';
import { B, B_SHORT, T, rangeCost } from '../core/formules.js';
import { planetById } from '../core/planetes.js';
import { IS_EXT, API, srv, ecoSpeed } from '../core/serveur.js';
import { dur, formatTime } from '../core/temps.js';
import { centreIndex, cargoHomeIndex, centrePlanet, researchTime } from '../economie/centre.js';
import { storageNote } from '../economie/production.js';
import { flotteCibleHtml } from '../flotte/cible.js';
import {
  EXPO_LABELS, EXPO_STATS_N, EXPO_CALIB_MIN, EXPO_EVTS, top1Tier,
  expoFind, expoPts, expoFret, expoRes, expoCap, expoStats,
  expoFretPropose
} from '../flotte/expeditions.js';
import { luneTir, luneVaisseaux, luneFacture, luneFlotteAuSol, moonDf, luneMorts } from '../flotte/lune.js';
import {
  SHIPS, parseC, shipStats, flight, SHIP_PLURAL, shipList, planeteEn
} from '../flotte/vaisseaux.js';
import { lfPourPos, lfRaisonPos } from '../formes-de-vie/formes-de-vie.js';
import { LIFEFORMS } from '../formes-de-vie/cases.js';
import { raidTargets, exploreSystems, raidPlan } from '../pillage/pillage.js';
import { myScore } from '../univers/univers.js';
import { actHtml } from './carte-action.js';
import { renderTimers } from '../minuteurs/minuteurs.js';
import { bascule, gauge } from './commun.js';
import { fold, segTabs, TOOLS, aide } from './navigation.js';
import { VIEWS, REFRESH } from '../../app.js';
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

/** Le vaisseau choisi, ramené à un vaisseau qui existe. */
function moonShip(){ return SHIPS[S.moonCalc.ship] ? S.moonCalc.ship : 'lf'; }

/** Le nom du vaisseau au bon nombre, avec les tables qui l'écrivent déjà. */
function moonNom(k, n){ return n > 1 ? SHIP_PLURAL[k] : (SHIPS[k] || {n:''}).n.toLowerCase(); }

/** Une chance en pourcent, lisible : un chiffre après la virgule sous 10 %. */
function moonPct(x){
  return String(x >= 10 ? Math.round(x) : Math.round(x * 10) / 10).replace('.', ',') + ' %';
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
function timerOptions(){
  const r = Object.keys(T).map(k=>`<option value="t:${k}">${T[k].n} ${num(S.tech[k])+1}</option>`).join('');
  const b = S.planets.map(p=>`<optgroup label="Bâtiments · ${esc(p.name)}">${Object.keys(B).map(k=>`<option value="b:${p.id}:${k}">${B[k].n} ${num(p.b[k])+1}</option>`).join('')}</optgroup>`).join('');
  return `<optgroup label="Recherche">${r}</optgroup>${b}<optgroup label="Autre"><option value="x:fleet">Retour de flotte</option><option value="x:expo">Retour d'expédition</option><option value="x:other">Autre</option></optgroup>`;
}
function toolTab(){ return TOOLS.some(([k])=>k===S.ui.tool) ? S.ui.tool : 'colony'; }
export const VIEWS_OUTILS = {
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
timers(){
  return `<section class="panel"><div class="card"><h2>Minuteurs <span class="note" id="tmSum"></span></h2>
      <ul class="timers" id="tmList"></ul>
      <details class="volet"${fold('minuteurs.ajout', false)}><summary class="note" data-fold="minuteurs.ajout">Ajouter un minuteur à la main</summary>
        <div class="timer-form mt-2">
          <label class="f">Quoi<select id="tmWhat">${timerOptions()}</select></label>
          <label class="f">Temps restant (copié du jeu)<input id="tmLeft" placeholder="2h 13m 05s"></label>
          <button class="btn primary" id="tmAdd">Lancer</button>
        </div>
      </details>
      <div class="row"><button class="btn sm ghost" id="tmSound">Tester le son</button></div>
    </div></section>`;
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
};
export const REFRESH_OUTILS = {
tools(){ (REFRESH[toolTab()]||(()=>{}))(); },
timers(){ renderTimers(); },
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
