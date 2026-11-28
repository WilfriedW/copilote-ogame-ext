/* ---------- l'onglet Aujourd'hui ----------
   Ce que l'onglet dessine (`VIEWS_AUJOURDHUI`) et ce qu'il rafraîchit sans
   tout redessiner (`REFRESH_AUJOURDHUI`) : la carte Maintenant, la journée
   qui vient, les priorités, l'expédition, la sécurité, les ressources en
   trop, le profil de jeu et les minuteurs.

   Module des vues (issue #49), calé sur l'issue #72. app.js réassemble `VIEWS` et
   `REFRESH` à partir des morceaux de chaque onglet. Ce module emprunte encore
   à app.js le rendu et les calculs qui n'ont pas de module : ce cycle-là est
   toléré tant qu'app.js existe, et rien n'y est lu au chargement. */
import { EXPO_FRET, S } from '../core/etat.js';
import {
  fmtLigne, fmt, esc, num, costHtml, planetRef, planetTag, qHtml, fmtK,
  majus
} from '../core/format.js';
import { B, B_SHORT, T } from '../core/formules.js';
import { IS_EXT } from '../core/serveur.js';
import { dur, formatTime } from '../core/temps.js';
import { surplusNote, surplusCompte } from '../economie/debordements.js';
import { NOM_RES } from '../economie/production.js';
import { flotteCible, flotteAjout } from '../flotte/cible.js';
import { EXPO_LABELS, top1Tier, expoPts, expoRes, expoPropose, expoEtat } from '../flotte/expeditions.js';
import { shipList, shipCourt, mcd, mouvements, aQuai } from '../flotte/vaisseaux.js';
import { LF_NAMES } from '../formes-de-vie/formes-de-vie.js';
import { fleetUrl, missionGo, coordLink, goAttr } from '../jeu/liens.js';
import { meteoVoit } from '../meteo.js';
import { renderTimers } from '../minuteurs/minuteurs.js';
import {
  MILESTONES, milestoneDone, milestoneLabel, milestoneMissing,
  simulateDay, statutFinancement, refused
} from '../plan/journee.js';
import { dailyMissions, missionKey, missionDone } from '../plan/missions.js';
import { poseHeure, heureTxt } from '../plan/nuit.js';
import {
  prios, priosLf, PRIO_ATTENTE, prioDemandes, prioAttend, prioOrdre,
  prioSuite, prioRef, FOCUS
} from '../plan/priorites.js';
import {
  classeSuggeree, classeEcart, catActe, catMission, profilLigne,
  profilFocusHtml, profilEtape
} from '../plan/profil.js';
import { surplusListe } from '../plan/surplus.js';
import { NIVEAU_SEV, regleParam, publieCritiques } from '../regles/moteur.js';
import { FS_MISSION, secu, espionnagesEntrants, planSecurite, fsRappelActif } from '../securite/securite.js';
import { copyChips, whyParts, actHtml, rebours, noBtn, noListe } from './carte-action.js';
import { conseilLignes, conseilsHtml } from './conseils.js';
import {
  uiVu, fold, RESUMES, resumeDe, cardLayout, cartesMenu, listeCartes
} from './navigation.js';
import { gameSkin } from './page-du-jeu.js';
import { planetById, prioLfEtat, ignKey, SEV_LABEL, aide, actsVus, on } from '../../app.js';
const prioRangHtml = (kind, pid, k) => { const r = prioOrdre(kind, pid, k); return r ? ` <span class="note">rang ${r.i + 1} sur ${r.n}</span>` : ''; };
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
function timerOptions(){
  const r = Object.keys(T).map(k=>`<option value="t:${k}">${T[k].n} ${num(S.tech[k])+1}</option>`).join('');
  const b = S.planets.map(p=>`<optgroup label="Bâtiments · ${esc(p.name)}">${Object.keys(B).map(k=>`<option value="b:${p.id}:${k}">${B[k].n} ${num(p.b[k])+1}</option>`).join('')}</optgroup>`).join('');
  return `<optgroup label="Recherche">${r}</optgroup>${b}<optgroup label="Autre"><option value="x:fleet">Retour de flotte</option><option value="x:expo">Retour d'expédition</option><option value="x:other">Autre</option></optgroup>`;
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

  const r = planSecurite('routine', now, acts);
  const on = fsRappelActif();
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

export const VIEWS_AUJOURDHUI = {
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
};

export const REFRESH_AUJOURDHUI = {
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
};
