/* node test/run.js — vérifie la mise à l'abri.
   Pas de framework : le harnais évalue les scripts et les modules du panneau
   dans l'ordre du navigateur, avec un DOM factice (voir test/harness.js). */
/* Les heures se vérifient dans un fuseau choisi : Tahiti, onze heures
   derrière un serveur européen, l'écart du joueur de cette extension. */
process.env.TZ = 'Pacific/Tahiti';
const assert = require('assert');
const { loadApp, fixtureState } = require('./harness');
const { runPage } = require('./page');

/** Le HTML tel que le joueur le lit : les entités redeviennent des caractères.
    esc() échappe l'apostrophe depuis qu'un attribut à apostrophes s'y cassait. */
const lu = h => String(h).replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');

let passed = 0;
const failures = [];
function t(name, fn) {
  try { fn(); passed++; } catch (e) { failures.push([name, e]); }
}

/* 22 h 30 : la nuit commence à 23 h et finit à 7 h dans l'état de test. */
const SOIR = new Date(2026, 10, 8, 22, 30, 0).getTime();
const REVEIL = new Date(2026, 10, 9, 7, 0, 0).getTime();

/** Charge l'application avec un état modifié à la volée. */
function app(modifier, now, api, ext, prioAsk, rules) {
  const s = fixtureState();
  // le stock avance tout seul depuis sa date : on le cale sur l'instant du test
  s.planets.forEach(p => { p.stock.at = now == null ? SOIR : now; });
  if (modifier) modifier(s);
  return loadApp(s, now == null ? SOIR : now, ['fleetsavePlan', 'dailyMissions', 'missionDone', 'S', 'shipList', 'flight', 'REFRESH', 'simulateDay', 'planetRef', 'qHtml', 'actGo', 'goUrl', 'lfSecs', 'lfRes', 'lfQueue', 'lfState', 'lfBloquee', 'casesTuile', 'casesLibres', 'planHints', 'prioHints', 'gameSkin', 'header', 'etaSecs', 'hms', 'copyChips', 'missionGo', 'nextResearch', 'techPayback', 'maxPlanets', 'finishTimer', 'planetAlerts', 'depensesPayables', 'storageCap', 'storageLevelFor', 'crawlerMax', 'crawlerBonus', 'levelCost', 'rangeCost', 'mse', 'T', 'POS_BONUS_M', 'expoCap', 'expoInFlight', 'goNote', 'actHtml', 'waitFor', 'raidPlan', 'production', 'rankUpgrades', 'colonyPayback', 'coloFleet', 'parseProdPanel', 'prodOf', 'bridage', 'applyGame', 'lfCost', 'lfCandidates', 'speciesOf', 'speciesOfPlanet', 'foundLifeforms', 'bestLifeform', 'lfPourPos', 'lfRaisonPos', 'lfConseilPlanete', 'satEnergy', 'satsOk', 'energyOptions', 'lfSettingsHtml', 'lfMerge', 'lfEffect', 'dayValue', 'computeDefenseGap', 'resolveActiveModel', 'defSurplus', 'defPropositions', 'defPlancherDe', 'defEnFile', 'defMixList', 'cargoGaps', 'cargoCap', 'pickCargo', 'planetById', 'forgetPlanet', 'migratePlanetIds', 'tourData', 'B', 'B_SHORT', 'terrainRates', 'vocations', 'besoinEmpire', 'mineWhy', 'centreIndex', 'centrePlanet', 'centreWhy', 'labLevel', 'labPlanet', 'labEffectif', 'researchTime', 'reqOk', 'galaxyUrl', 'cargoHomeIndex', 'VIEWS', 'coloFrom', 'raidTargets', 'parseReport', 'applyReport', 'prios', 'prioOf', 'prioClean', 'prioStep', 'prioBloque', 'prioAvant', 'prioRien', 'pickBuildings', 'prioHtml', 'prioPose', 'prioRetire', 'prioDevant', 'prioLvl', 'priosLf', 'prioDrain', 'prioDemandes', 'esc', 'poseK', 'poseLignes', 'posePartout', 'poseRetireTout', 'poseBloc', 'poseCoche', 'prioPalier', 'prioCible', 'lfPosePaliers', 'lfPopNourriture', 'LF_PALIER', 'syncOut', 'syncApply', 'releveAge', 'releveEtapes', 'lfRelance', 'RELEVE_NUIT', 'FRAIS_MS', 'scanEtat', 'lfChiffree', 'lfMetEnCommun', 'chantierFlou', 'chantierARelire', 'view', 'bind', 'appliqueSauvegarde', 'SHIPS', 'DEF', 'SHIP_COST', 'COL_SHIP_COST', 'luneTir', 'luneVaisseaux', 'luneFacture', 'luneDefense', 'luneFlotteAuSol', 'wakeTime', 'nightLen', 'absenceJour', 'dayValue', 'modeNuit', 'finDeNuit', 'fmt', 'fmtLigne', 'luneMorts', 'gidDe', 'DEF_MODELES', 'DEF_PALIERS', 'DEF_RATIO', 'defPlan', 'defModele', 'formatRecipe', 'packCost', 'packText', 'defModeleCarte', 'defUniteTitre', 'defRecetteHtml', 'defCarte', 'defModeleK', 'defRatio', 'defAncre', 'defPalierDe', 'defPrereq', 'sainEtat', 'syncOut', 'render', 'plusRecente', 'versionCard', 'whyLead', 'whyParts', 'PROFILS', 'profilCard', 'profilBloc', 'profilLigne', 'profilFocusHtml', 'poidsCat', 'catActe', 'catMission', 'classeSuggeree', 'classeVoulue', 'classeEcart', 'profilConnu', 'styleRepose', 'focusInerte', 'planPoseParLeStyle', 'expoFleet', 'expoPoints', 'expoPts', 'expoFret', 'expoRes', 'expoTgt', 'expoSys', 'expoScore', 'expoVus', 'expoVols', 'expoDuree', 'expoCandidats', 'expoPropose', 'expoEtat', 'expoHtml', 'expoSain', 'expoWanted', 'fleetUrl', 'top1Tier', 'EXPO_XP', 'EXPO_PTS', 'EXPO_MARGE', 'EXPO_DUREES', 'coordLink', 'expoAuSol', 'actsVus', 'colonneData', 'cardKey', 'actKey', 'noLabel', 'noListe', 'applyLimit', 'cartesMax', 'cartesGlobal', 'cartesPropre', 'cartesSain', 'cartesVal', 'listeCartes', 'cartesMenu', 'affichageCard', 'LISTES', 'missionKey', 'UI', 'uiOuvert', 'uiNote', 'uiVu', 'uiPurge', 'uiReset', 'uiEcrit', 'fold', 'garderVue', 'carteDetails', 'REGLES', 'REGLES_ERR', 'EVAL', 'regle', 'regleSaine', 'reglePose', 'regleActive', 'gabarit', 'constats', 'constatsDe', 'SEV_LABEL', 'ignore', 'ignKey', 'constatsVus', 'ignClean', 'conseilsHtml', 'reglesCard', 'planeteOuverte', 'cibleMines', 'mineEnRetard', 'naniteRetard', 'laboEnRetard', 'rechercheAilleurs', 'reglesRecherche', 'regOffHtml', 'raceDe', 'baseDe', 'lfNom', 'lfNomConnu', 'lfManques', 'rescanner', 'lfNomsRetiens', 'raceRows', 'alerteNeuve', 'ongletAffiche', 'expoJournal', 'expoMessages', 'expoStats', 'expoFretPropose', 'expoEvtDe', 'expoCalibHtml', 'expoStatsHtml', 'expoConnue', 'expoValeur', 'metalEq'], api, ext, prioAsk, rules);
}
/** L'application avec un rules.json donné — null pour un fichier illisible. */
const appRegles = (rules, modifier, ext) => app(modifier, null, null, ext, null, rules);

/* ---------- fraîcheur du relevé ---------- */

/** Deux planètes que le jeu nomme, sur un serveur connu. */
const RELEVE = s => { s.host = 's1-fr.ogame.gameforge.com'; s.planets[0].gid = '101'; s.planets[1].gid = '102'; };
/** Un relevé assez vieux pour que le bouton sorte. */
const PERIME = s => { s.planets.forEach(p => { p.stock.at = SOIR - 42 * 60e3; }); };

t('un relevé du jour même est frais, le bouton reste caché', () => {
  const g = app();
  assert.ok(g.releveAge() <= g.FRAIS_MS, 'les stocks de la fixture sont calés sur maintenant');
});

t("c'est la planète la moins souvent vue qui donne l'âge", () => {
  const g = app(s => { RELEVE(s); s.planets[1].stock.at = SOIR - 42 * 60e3; });
  assert.ok(g.releveAge() > g.FRAIS_MS);
  assert.equal(Math.round(g.releveAge() / 60e3), 42);
});

t("une planète que le jeu vient de révéler rend tout l'empire périmé", () => {
  // bNeuve : nommée par la liste du jeu, aucun niveau lu, stock inventé à maintenant
  const g = app(s => { RELEVE(s); s.planets[1].bNeuve = 1; });
  assert.ok(g.releveAge() > g.FRAIS_MS, 'le bouton doit sortir après une colonisation');
});

t("une planète relevée depuis ne périme plus l'empire", () => {
  const g = app(RELEVE);
  assert.ok(g.releveAge() <= g.FRAIS_MS);
});

t("une planète que le jeu ne nomme pas ne périme pas l'empire", () => {
  // le relevé ne passe jamais chez elle : la compter laissait le bouton rouge pour toujours
  const g = app(s => { RELEVE(s); delete s.planets[1].gid; s.planets[1].stock.at = SOIR - 42 * 60e3; });
  assert.ok(g.releveAge() <= g.FRAIS_MS);
});

t("en-tête : la synchro tant que le relevé est frais, l'heure du relevé sinon", () => {
  const frais = app(s => { RELEVE(s); s.syncAt = SOIR; });
  assert.match(frais.el('uniBadge').innerHTML, /^synchro /, 'rien à relire : la synchro suffit');
  const vieux = app(s => { RELEVE(s); PERIME(s); s.syncAt = SOIR; });
  assert.match(vieux.el('uniBadge').innerHTML, /^relevé /, "le bouton est sorti : l'en-tête parle de ce qu'il corrige");
});

t('sans serveur connu, aucun relevé à proposer', () => {
  const g = app(s => { s.planets.forEach(p => { p.gid = '101'; }); });
  assert.deepEqual(g.releveEtapes(), []);
});

t('une planète que le jeu ne nomme pas ne fait pas étape', () => {
  const g = app(s => { RELEVE(s); delete s.planets[1].gid; });
  assert.deepEqual([...new Set(g.releveEtapes().map(e => e.gid))], ['101']);
});

t('le relevé va page par page, pas planète par planète', () => {
  // arrêté à moitié, il rend un empire cohérent sur ce qu'il a lu
  const g = app(RELEVE);
  const e = g.releveEtapes();
  assert.deepEqual(e.slice(0, 4).map(x => `${x.page}:${x.gid}`),
    ['supplies:101', 'supplies:102', 'resourcesettings:101', 'resourcesettings:102']);
});

t('le relevé du coucher ne lit que le sol, la soute et les vols', () => {
  /* Une cinquantaine d'arrêts de quatre secondes devant un joueur qui veut
     aller dormir : la nuit ne regarde ni les niveaux de bâtiments ni la
     recherche. Elle regarde ce qu'il y a au sol et ce qui peut le lever. */
  const g = app(RELEVE);
  const nuit = g.releveEtapes(g.RELEVE_NUIT);
  assert.deepEqual([...new Set(nuit.map(e => e.page))], ['supplies', 'shipyard', 'movement']);
  assert.ok(nuit.length * 2 < g.releveEtapes().length,
    `${nuit.length} arrêts contre ${g.releveEtapes().length} : le relevé du coucher doit être court`);
});

t('chaque page porte son domaine, et une seule fois par planète', () => {
  const g = app(RELEVE);
  const e = g.releveEtapes();
  for (const page of ['supplies', 'resourcesettings', 'shipyard', 'defenses', 'facilities']) {
    assert.equal(e.filter(x => x.page === page).length, 2, page);
  }
  assert.ok(e[0].url.includes('component=supplies') && e[0].url.includes('cp=101'), e[0].url);
});

t('le relevé passe par le paramétrage de la production de chaque planète', () => {
  // sans lui, facteur, bonus de forme de vie et foreuses ne se rafraîchissent jamais
  const g = app(RELEVE);
  const e = g.releveEtapes().filter(x => x.page === 'resourcesettings');
  assert.deepEqual(e.map(x => x.gid), ['101', '102']);
  assert.ok(e[0].url.includes('component=resourcesettings'), e[0].url);
});

t("le relevé reprend le lien du jeu vers le paramétrage, planète changée", () => {
  // selon la version, cette page s'ouvre par `page=` et non par `component=` :
  // on ne devine pas l'adresse, on reprend celle que la page affiche
  const g = app(s => { RELEVE(s); s.prodUrl = 'https://s1-fr.ogame.gameforge.com/game/index.php?page=resourceSettings&cp=101'; });
  const e = g.releveEtapes().filter(x => x.page === 'resourcesettings');
  assert.deepEqual(e.map(x => x.url), [
    'https://s1-fr.ogame.gameforge.com/game/index.php?page=resourceSettings&cp=101',
    'https://s1-fr.ogame.gameforge.com/game/index.php?page=resourceSettings&cp=102']);
});

t("un lien illisible ne prive pas le relevé de sa page", () => {
  const g = app(s => { RELEVE(s); s.prodUrl = 'pas une adresse'; });
  const e = g.releveEtapes().filter(x => x.page === 'resourcesettings');
  assert.equal(e.length, 2);
  assert.ok(e[0].url.includes('component=resourcesettings'), e[0].url);
});

t('sans forme de vie jamais lue, le relevé ne va pas les attendre', () => {
  const g = app(RELEVE);
  assert.deepEqual(g.releveEtapes().filter(e => e.page.startsWith('lf')), []);
});

t("le menu du jeu suffit : un poste neuf relève les formes de vie sans qu'on lui en ouvre une", () => {
  /* Avoir des formes de vie est un fait du compte, pas du poste. Sur un second
     ordinateur, rien n'a encore été vu : le relevé sautait leurs pages et le
     panneau réclamait une ouverture à la main. */
  const g = app(s => { RELEVE(s); s.lfMenu = true; });
  const e = g.releveEtapes();
  assert.equal(e.filter(x => x.page === 'lfbuildings').length, 2);
  assert.equal(e.filter(x => x.page === 'lfresearch').length, 2);
});

t("un univers sans formes de vie ne les relève pas", () => {
  const g = app(s => { RELEVE(s); s.lfMenu = false; });
  assert.deepEqual(g.releveEtapes().filter(e => e.page.startsWith('lf')), []);
});

t("une page déjà relevée ici garde sa place, quoi que dise le menu", () => {
  // le menu ne fait qu'ajouter : une forme reconnue autrement n'est jamais perdue
  const g = app(s => { RELEVE(s); s.lfMenu = false; s.planets[0].lfSeen = { lfbuilding: SOIR }; });
  assert.equal(g.releveEtapes().filter(e => e.page === 'lfbuildings').length, 2);
});

t("le relevé ouvre lui-même une case non chiffrée, par un lien", () => {
  /* Le prix n'apparaît que dans le panneau de détail ; le jeu accepte openTech
     dans ses URL, donc le relevé l'ouvre sans rien cliquer dans la page. */
  const g = app(s => {
    RELEVE(s); s.lfMenu = true;
    s.planets[0].lf = { 11101: { lvl: 3, state: 'ok' } };
  });
  const e = g.releveEtapes().find(x => x.page === 'lfbuildings' && x.gid === '101');
  assert.ok(e.url.includes('openTech=11101'), e.url);
});

t("l'arrêt qui part chercher une case la nomme", () => {
  // sans ça, il ne peut pas savoir si la page lui a rendu ce qu'il demandait
  const g = app(s => {
    RELEVE(s); s.lfMenu = true;
    s.planets[0].lf = { 11101: { lvl: 3, state: 'ok' } };
  });
  const e = g.releveEtapes().find(x => x.page === 'lfbuildings' && x.gid === '101');
  assert.equal(e.tuile, '11101');
});

t("une case n'est tenue pour chiffrée qu'avec son prix et sa durée", () => {
  /* Le jeu charge le prix après la page : repartir sur le premier instantané,
     c'est repartir avant le prix — et aucune case n'était jamais chiffrée. */
  const g = app(s => {
    RELEVE(s); s.lfMenu = true;
    s.planets[0].lf = { 11101: { lvl: 3, state: 'ok' } };
  });
  assert.equal(g.lfChiffree('101', '11101'), false, 'niveau seul : pas de prix');
  g.S.planets[0].lf[11101] = { lvl: 3, state: 'ok', next: 4, cost: [100, 50, 0] };
  assert.equal(g.lfChiffree('101', '11101'), false, 'prix sans durée : incomplet');
  g.S.planets[0].lf[11101].secs = 600;
  assert.equal(g.lfChiffree('101', '11101'), true);
  // un arrêt qui ne demandait rien n'attend rien
  assert.equal(g.lfChiffree('101', null), true);
});

t("une case déjà chiffrée n'est pas rouverte", () => {
  const g = app(s => {
    RELEVE(s); s.lfMenu = true;
    s.planets[0].lf = { 11101: { lvl: 3, state: 'ok', next: 4, cost: [100, 50, 0], secs: 600 } };
  });
  const e = g.releveEtapes().find(x => x.page === 'lfbuildings' && x.gid === '101');
  assert.ok(!e.url.includes('openTech'), e.url);
});

t("une case verrouillée ne vaut pas la peine d'être ouverte", () => {
  const g = app(s => {
    RELEVE(s); s.lfMenu = true;
    s.planets[0].lf = { 11101: { lvl: 0, state: 'locked' } };
  });
  const e = g.releveEtapes().find(x => x.page === 'lfbuildings' && x.gid === '101');
  assert.ok(!e.url.includes('openTech'), e.url);
});

t("une page de forme de vie tout juste lue est rouverte pour son prix", () => {
  /* Installation neuve : les arrêts se figent avant que rien ne soit lu, donc
     aucun ne demandait de prix et le relevé entier n'en rapportait aucun. */
  const g = app(s => { RELEVE(s); s.lfMenu = true; });
  const e = g.releveEtapes().find(x => x.page === 'lfbuildings' && x.gid === '101');
  assert.equal(e.tuile, null, 'rien de connu : aucun prix demandé au départ');
  // la visite vient de rapporter les douze cases
  g.S.planets[0].lf = { 11101: { lvl: 3, state: 'ok' } };
  const rat = g.lfRelance(e);
  assert.equal(rat.tuile, '11101');
  assert.ok(rat.url.includes('openTech=11101'), rat.url);
  // une fois chiffrée, plus de second arrêt
  g.S.planets[0].lf[11101] = { lvl: 3, state: 'ok', next: 4, cost: [100, 50, 0], secs: 600 };
  assert.equal(g.lfRelance(e), null);
  // un arrêt qui demandait déjà un prix ne se répète pas
  assert.equal(g.lfRelance({ ...e, tuile: '11101' }), null);
  // et une page qui n'est pas une page de forme de vie non plus
  assert.equal(g.lfRelance({ ...e, page: 'supplies' }), null);
});

t("la file de recherche a sa propre case à ouvrir", () => {
  const g = app(s => {
    RELEVE(s); s.lfMenu = true;
    s.planets[0].lf = { 11101: { lvl: 3, state: 'ok' }, 11201: { lvl: 1, state: 'ok' } };
  });
  const e = g.releveEtapes().filter(x => x.gid === '101' && x.page.startsWith('lf'));
  const parPage = Object.fromEntries(e.map(x => [x.page, x.url]));
  assert.ok(parPage.lfbuildings.includes('openTech=11101'), parPage.lfbuildings);
  assert.ok(parPage.lfresearch.includes('openTech=11201'), parPage.lfresearch);
});

t("une forme de vie déjà vue ramène ses deux pages par planète", () => {
  const g = app(s => { RELEVE(s); s.planets[0].lfSeen = { lfbuilding: SOIR }; });
  const e = g.releveEtapes();
  assert.equal(e.filter(x => x.page === 'lfbuildings').length, 2);
  assert.equal(e.filter(x => x.page === 'lfresearch').length, 2);
});

t('recherche et mouvements ferment le relevé, une fois chacun', () => {
  const g = app(RELEVE);
  const e = g.releveEtapes();
  assert.deepEqual(e.slice(-2).map(x => x.page), ['research', 'movement']);
  assert.equal(e.filter(x => x.page === 'research').length, 1);
});

t('le bouton du haut lance le relevé', () => {
  const g = app(s => { RELEVE(s); PERIME(s); }, SOIR, null, true);
  g.click('majBtn');
  const go = g.sent().filter(m => m.type === 'scan');
  assert.equal(go.length, 1, 'le premier arrêt part au clic');
  assert.ok(go[0].url.includes('cp=101'), go[0].url);
});

t('le bouton se montre en rouge, et seulement quand il se montre', () => {
  // il ne sort que si le plan se fie à des chiffres périmés : il doit se voir
  const frais = app(RELEVE, SOIR, null, true);
  assert.ok(frais.el('majBtn').hidden, 'rien à relever');
  assert.ok(!frais.el('majBtn').classList.contains('bad'));
  const vieux = app(s => { RELEVE(s); PERIME(s); }, SOIR, null, true);
  assert.ok(!vieux.el('majBtn').hidden);
  assert.ok(vieux.el('majBtn').classList.contains('bad'));
});

t("le relevé ne navigue pas l'onglet du joueur : il demande le sien", () => {
  // sinon sa page de jeu clignote page après page sous ses yeux
  const g = app(s => { RELEVE(s); PERIME(s); }, SOIR, null, true);
  g.click('majBtn');
  assert.deepEqual(g.sent().filter(m => m.type === 'go'), [],
    "aucun message qui déplacerait l'onglet du joueur");
});

t("l'écran du relevé prend la place du contenu, et montre ce qui reste", () => {
  const g = app(s => { RELEVE(s); PERIME(s); }, SOIR, null, true);
  g.click('majBtn');
  const h = g.html().view;
  assert.ok(/Relevé en cours/.test(h), h.slice(0, 200));
  assert.ok(/0 \/ \d+/.test(h), 'le compteur est là');
  assert.ok(/ressources/.test(h) && /production/.test(h), 'les pages sont nommées');
});

t("un arrêt qui va chercher une case a plus de temps qu'une page simple", () => {
  /* Il attend deux réponses du jeu : la page, puis le panneau de détail qu'il
     charge à part. Les planètes les plus lentes expiraient là. */
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'vues', 'entete.js'), 'utf8');
  const simple = +/const RELEVE_DELAI = (\d+);/.exec(src)[1];
  const avecCase = +/const RELEVE_DELAI_CASE = (\d+);/.exec(src)[1];
  assert.ok(avecCase > simple, avecCase + ' doit dépasser ' + simple);
  assert.ok(/setTimeout\(\(\)=>fin\(true\), tuile \? RELEVE_DELAI_CASE : RELEVE_DELAI\)/.test(src),
    'le choix du délai doit suivre la présence d\'une case à chercher');
});

t("l'écran sépare la page lue de la page muette", () => {
  /* Une page qui n'a rien renvoyé a coûté le délai entier pour rien : c'est
     elle qui fait traîner un relevé, et il faut pouvoir la montrer du doigt. */
  const g = app(RELEVE, SOIR, null, true);
  assert.equal(g.scanEtat(5, 3, undefined), 'attente');
  assert.equal(g.scanEtat(3, 3, undefined), 'encours');
  assert.equal(g.scanEtat(1, 3, {muet:false, ms:420}), 'lu');
  assert.equal(g.scanEtat(1, 3, {muet:true, ms:4000}), 'muet');
  // un arrêt terminé dont le compte rendu manque passe pour lu, pas pour muet
  assert.equal(g.scanEtat(0, 3, undefined), 'lu');
});

t("l'écran dit le temps écoulé", () => {
  const g = app(s => { RELEVE(s); PERIME(s); }, SOIR, null, true);
  g.click('majBtn');
  assert.ok(/écoulée/.test(g.html().view), g.html().view.slice(0, 400));
});

t("un clic sur un onglet rend la main avant la fin du relevé", () => {
  const g = app(s => { RELEVE(s); PERIME(s); }, SOIR, null, true);
  g.click('majBtn');
  assert.ok(/Relevé en cours/.test(g.html().view));
  g.click('tabs', { closest: sel => (sel === 'button[data-tab]' ? { dataset: { tab: 'empire' } } : null) });
  assert.ok(!/Relevé en cours/.test(g.html().view), "l'écran s'est baissé");
});

t("le clic sur une carte, lui, amène bien l'onglet devant", () => {
  const g = app(RELEVE, SOIR, null, true);
  // une carte telle que la poignée déléguée la voit : porteuse de data-go
  const carte = { dataset: { go: g.goUrl('supplies', 0) } };
  carte.closest = sel => (sel === '[data-go]' ? carte : null);
  g.click('view', carte);
  const go = g.sent().filter(m => m.type === 'go');
  assert.equal(go.length, 1);
  assert.ok(!go[0].discret, 'un clic du joueur veut son onglet devant lui');
});

t('le bouton annonce sa progression et devient le bouton d\'arrêt', () => {
  const g = app(s => { RELEVE(s); PERIME(s); }, SOIR, null, true);
  const b = g.click('majBtn');
  assert.ok(/^Arrêter \(0\/\d+\)$/.test(b.textContent), b.textContent);
  // rappuyer arrête : le relevé ne repart pas, et le joueur est ramené
  g.click('majBtn');
  assert.equal(b.textContent, 'Actualiser');
});

/* ---------- ce qu'il y a à envoyer ---------- */

t('sans transporteur à quai, rien à proposer', () => {
  const g = app(s => { s.planets[0].ships = { pr: 4 }; });
  assert.equal(g.fleetsavePlan(SOIR), null);
});

/** Une colonie assez loin pour qu'un déploiement couvre la nuit. */
const loin = s => { s.planets[1].coords = '1:260:6'; };

t('avec des transporteurs, la flotte, la destination et l\'arrivée sont nommées', () => {
  const g = app(s => { loin(s); s.planets[0].ships = { lc: 30, sc: 6 }; });
  const fs = g.fleetsavePlan(SOIR);
  assert.ok(fs, 'un plan est proposé');
  assert.ok(fs.ships.lc > 0, 'des grands transporteurs sont choisis');
  assert.equal(fs.dest, '1:260:6', 'vers l\'autre planète');
  // La préférence du joueur : Transport, la flotte revient seule. Sans
  // coffre-fort, la cargaison ne se pose qu'après le réveil.
  assert.equal(fs.mission, 'transport');
  assert.ok(!fs.oneWay && fs.back > fs.arrive, 'aller-retour : la flotte revient');
  assert.ok(fs.arrive > REVEIL, 'la cargaison se pose après le réveil');
});

t('la soute embarque tout le stock quand elle le peut', () => {
  const g = app(s => { s.planets[0].ships = { lc: 30 }; });
  const fs = g.fleetsavePlan(SOIR);
  assert.ok(fs.cargo >= fs.load, 'soute ' + fs.cargo + ' pour ' + fs.load + ' à sauver');
});

t('la vitesse retenue fait arriver après le réveil, et jamais à 100 %', () => {
  const g = app(s => { loin(s); s.planets[0].ships = { lc: 30 }; });
  const fs = g.fleetsavePlan(SOIR);
  assert.ok(SOIR + g.flight('1:142:8', fs.dest, fs.ships, fs.pct).secs * 1000 > REVEIL,
    'à ' + fs.pct + ' %, la flotte se pose après le réveil');
  // « Avoid sending your fleets at 100% speed » : à 100 % le vol est le plus
  // court connu, donc le plus facile à chronométrer.
  assert.ok(fs.pct < 100, 'le cran 100 % est écarté, il est trop prévisible');
});

t('la vitesse ne reste pas la même tous les soirs', () => {
  // « Avoid using the same speed each time you fleetsave. » Elle change avec le
  // jour, et pas à chaque rafraîchissement : le plan ne doit pas se contredire
  // dans la même journée.
  const vu = new Set();
  for (let j = 0; j < 6; j++) {
    const soir = new Date(2026, 10, 8 + j, 22, 30, 0).getTime();
    const g = app(s => { loin(s); s.planets[0].ships = { lc: 30 }; }, soir);
    vu.add(g.fleetsavePlan(soir).pct);
  }
  assert.ok(vu.size > 1, 'la même vitesse six soirs de suite : ' + [...vu]);
  const soir = new Date(2026, 10, 8, 22, 30, 0).getTime();
  const g = app(s => { loin(s); s.planets[0].ships = { lc: 30 }; }, soir);
  assert.equal(g.fleetsavePlan(soir).pct, g.fleetsavePlan(soir + 60000).pct,
    'dans la même journée, la vitesse ne bouge pas');
});

t('le déploiement dit pourquoi, pas seulement quoi', () => {
  const g = app(s => { loin(s); s.planets[0].ships = { lc: 30 }; });
  const how = g.dailyMissions().find(m => m.id === 'night').how.join(' ');
  assert.match(how, /rappelle/i, 'le rappel est l\'intérêt de la méthode : ' + how);
  assert.match(how, /phalange/i, 'et ce qu\'il évite');
});

/* ---------- quand se taire ---------- */

t('rien à sauver : pas de proposition', () => {
  const g = app(s => {
    s.planets[0].ships = { lc: 30 };
    s.planets.forEach(p => { p.stock = { m: 300, c: 200, d: 0, at: SOIR }; });
  });
  assert.equal(g.fleetsavePlan(SOIR), null);
});

t('fenêtre de nuit dégénérée : pas de calcul, pas de boucle', () => {
  const g = app(s => { s.planets[0].ships = { lc: 30 }; s.day.nightStart = 7; s.day.nightEnd = 7; });
  assert.equal(g.fleetsavePlan(SOIR), null);
});

/* ---------- une seule planète ---------- */

t('sans déploiement qui tienne : expédition vers la 16, jamais Espionner', () => {
  // La position 16 n'accepte que l'Expédition : un Espionner vers elle, que le
  // copilote proposait dès qu'une sonde traînait au sol, se fait refuser par le
  // jeu. La sonde part quand même — à bord, elle double les gains.
  const g = app(s => {
    s.planets = [s.planets[0]];
    s.planets[0].ships = { lc: 20, pr: 1 };
  });
  const fs = g.fleetsavePlan(SOIR);
  assert.ok(fs, 'un plan est proposé');
  assert.equal(fs.mission, 'expedition', 'la 16 n\'accepte rien d\'autre');
  assert.match(fs.dest, /^1:\d+:16$/, 'la position 16 d\'un système choisi sur le temps de vol');
  assert.equal(fs.ships.pr, 1, 'la sonde est du voyage : elle double ce que l\'expédition rapporte');
  assert.ok(!fs.oneWay && fs.back > REVEIL, 'aller-retour, de retour après le réveil');
});

t('la carte dit ce qu\'elle emporte, pas ce qui est au sol', () => {
  // Une soute trop courte mettait à l'abri, sur le papier, ce qui passait la
  // nuit au sol : la carte annonçait le stock entier.
  const g = app(s => { s.planets = [s.planets[0]]; s.planets[0].ships = { lc: 1 }; });
  const fs = g.fleetsavePlan(SOIR);
  assert.ok(fs.cargo < fs.load, 'le cas visé : la soute ne lève pas tout');
  const nuit = g.dailyMissions().find(m => m.id === 'night');
  assert.match(nuit.why, new RegExp(g.fmt(Math.min(fs.load, fs.cargo))),
    'le pourquoi chiffre ce qui part : ' + nuit.why);
  assert.doesNotMatch(nuit.how.join(' '), /Ne laisse rien de valeur au sol/,
    'et ne demande pas l\'impossible quand la soute manque');
});

t('ni deuxième planète ni sonde : l\'expédition, en le disant', () => {
  const g = app(s => {
    s.planets = [s.planets[0]];
    s.planets[0].ships = { lc: 20 };
  });
  const fs = g.fleetsavePlan(SOIR);
  assert.equal(fs.mission, 'expedition');
  assert.match(fs.dest, /^1:\d+:16$/);
  assert.ok(!fs.ships.pr, 'pas de sonde au sol, pas de sonde à bord');
  const how = g.dailyMissions().find(m => m.id === 'night').how.join(' ');
  assert.match(how, /pis-aller/, 'le pis-aller est annoncé comme tel : ' + how);
});

/* ---------- ce que le joueur lit ---------- */

t('le rappel du soir nomme la flotte au lieu de rester vague', () => {
  const g = app(s => { s.planets[0].ships = { lc: 30 }; });
  const nuit = g.dailyMissions().find(m => m.id === 'night');
  assert.ok(nuit, 'le rappel existe le soir');
  assert.ok(/transporteur/.test(nuit.how.join(' ')), 'les étapes nomment la flotte');
  assert.ok(/1:\d+:(6|16)\b/.test(nuit.how.join(' ')), 'et la destination : ' + nuit.how.join(' '));
});

t('la carte du soir chiffre les trois ressources, pas seulement leur somme', () => {
  /* « 540 k au sol » ne dit pas s'il faut un hangar à métal ou un plein de
     deutérium — et c'est ce que le joueur vérifie avant de charger. */
  const g = app(s => { loin(s); s.planets[0].ships = { lc: 30, sc: 6 }; });
  const n = g.dailyMissions().find(m => m.id === 'night');
  const st = g.S.planets[0].stock;
  for (const [v, nom] of [[st.m, 'métal'], [st.c, 'cristal'], [st.d, 'deutérium']])
    assert.ok(n.sol.includes(`${g.fmt(v)} ${nom}`), `${nom} manque : ${n.sol}`);
  // et sans cliquer : la ligne est sur la carte fermée, pas derrière le ⓘ
  g.REFRESH.today();
  assert.ok(lu(g.html().tdNow || '').includes(n.sol), 'la ligne n\'est pas rendue');
});

t('ce que la flotte emporte n\'est plus compté comme exposé au matin', () => {
  // Annoncer « resteront exposés : 237 k » juste après avoir dit de charger ces
  // 237 k, c'est se contredire dans la même carte.
  const pleine = g => g.dailyMissions().find(m => m.id === 'night').how.join(' ');
  assert.ok(!/Resteront exposés/.test(pleine(app(s => { s.planets[0].ships = { lc: 30 }; }))),
    'la soute suffit : il ne reste que la production de la nuit');
  const court = pleine(app(s => { s.planets[0].ships = { lc: 1 }; }));
  assert.match(court, /Resteront exposés/, 'un seul transporteur ne lève pas 198 000 : ' + court);
});

t('sans transporteur, le rappel reste utile mais générique', () => {
  const g = app(s => { s.planets[0].ships = {}; });
  const nuit = g.dailyMissions().find(m => m.id === 'night');
  assert.ok(nuit, 'le rappel existe toujours');
  assert.ok(/Dépense/.test(nuit.how.join(' ')), 'il conseille au moins de dépenser');
});

/* ---------- le retour de l'écran Réglages ---------- */

t('l\'écran Réglages dit ce que le plan du jour devient', () => {
  const g = app(s => { s.day.focus = 'eco'; s.day.horizon = 48; });
  g.REFRESH.settings();
  const txt = g.html().daySum || '';
  assert.ok(/Économie pure/.test(txt), 'la priorité choisie est nommée : ' + txt);
  assert.ok(/en 48 h/.test(txt), 'l\'horizon choisi est dit : ' + txt);
  assert.ok(/production [+-]/.test(txt), 'le plan recalculé se voit : ' + txt);
});

/* Trois menus qui se ressemblent : sans phrase sous chacun, on cherchait la
   recherche dans l'objectif du plan. */
t('chaque menu du plan dit ce que le choix en place fait', () => {
  const dit = focus => { const g = app(s => { s.day.focus = focus; s.day.research = 'first'; }); g.REFRESH.settings(); return lu(g.html().aideJour || ''); };
  const eco = dit('eco'), col = dit('ecocol');
  assert.ok(/ne colonise pas/.test(eco), 'l\'économie pure dit qu\'elle ne colonise pas : ' + eco);
  assert.ok(/colonie/.test(col), 'économie + colonie parle de la colonie : ' + col);
  assert.notEqual(eco, col, 'la phrase suit le choix');
  /* Le nom du menu et le choix en place, puisque l'aide a quitté la case du
     menu : sans eux, trois phrases se suivent sans qu'on sache laquelle répond
     à quoi. */
  assert.ok(/Ce que le plan vise/.test(eco) && /Économie pure/.test(eco), 'le menu et le choix sont nommés : ' + eco);
  assert.ok(/devant les chantiers/.test(eco), 'la place de la recherche est dite : ' + eco);
  assert.ok(/Place des formes de vie/.test(eco), 'celle des formes de vie aussi : ' + eco);
});

t('deux heures de nuit égales s\'annoncent comme aucune nuit', () => {
  // Sinon le résumé disait « nuit 7h–7h », qui a l'air d'un réglage en place
  // alors que plus rien n'est sauté et que la mise à l'abri a disparu.
  const g = app(s => { s.day.nightStart = 7; s.day.nightEnd = 7; });
  g.REFRESH.settings();
  const txt = g.html().daySum || '';
  assert.ok(/aucune nuit/.test(txt), 'le résumé doit le dire : ' + txt);
});

t('en mode nuit l\'écran Réglages ne promet aucun plan', () => {
  const g = app(s => { s.day.night = true; });
  g.REFRESH.settings();
  assert.ok(/[Mm]ode nuit/.test(g.html().daySum || ''), 'le résumé dit la pause');
});

t('l\'onglet Aujourd\'hui affiche les pastilles de planète', () => {
  const g = app(s => { s.planets[0].ships = { lc: 30 }; });
  g.REFRESH.today();
  const html = g.html().tdNow || '';
  assert.ok(/class="ptag"/.test(html),
    'les étiquettes doivent porter la pastille : ' + html.slice(0, 300));
});

/* ---------- savoir où aller ---------- */

const JOUR = new Date(2026, 10, 8, 14, 0, 0).getTime();

/** Trois planètes, dont deux colonies au nom par défaut identique. */
function troisPlanetes(s) {
  s.planets[0].b.lab = 8;
  s.planets.push({ id: 'c2', name: 'Colonie', coords: '1:201:9', tmax: 48,
    b: Object.assign({}, s.planets[1].b, { metal: 5, lab: 2 }), sats: 0, ships: {}, shipsAt: 0,
    stock: { m: 8000, c: 5000, d: 800, at: JOUR } });
}

t('deux colonies du même nom se distinguent par leurs coordonnées', () => {
  const g = app(troisPlanetes, JOUR);
  const files = g.simulateDay().sessions[0].acts.map(a => a.q)
    .filter(q => /Colonie/.test(q));
  assert.ok(files.length >= 2, 'au moins deux actions sur une planète nommée Colonie');
  assert.equal(new Set(files).size, files.length,
    'étiquettes identiques pour deux planètes différentes : ' + files.join(' / '));
  assert.ok(files.every(q => /\[\d+:\d+:\d+\]/.test(q)), 'chacune porte ses coordonnées');
});

t('un nom unique reste affiché sans coordonnées', () => {
  const g = app(null, JOUR);
  const mere = g.simulateDay().sessions[0].acts.map(a => a.q).find(q => /Planète mère/.test(q));
  assert.ok(mere, 'une action sur la planète mère');
  assert.ok(!/\[/.test(mere), 'pas de coordonnées inutiles : ' + mere);
});

t('une recherche dit sur quelle planète la lancer', () => {
  const g = app(troisPlanetes, JOUR);
  const s0 = g.simulateDay().sessions[0];
  const rech = s0.acts.concat(s0.waits).find(x => /Recherche/.test(x.q));
  assert.ok(rech, 'une recherche est proposée');
  assert.ok(/Planète mère/.test(rech.q),
    'la recherche se lance depuis le meilleur laboratoire, ici Planète mère : ' + rech.q);
});

t('planetRef ne plante pas sans planète', () => {
  const g = app(null, JOUR);
  assert.equal(g.planetRef(null), '');
});

/* ---------- rapatrier des ressources ---------- */

/** La colonie déborde, mais toute la flotte est sur la planète mère. */
function flotteAuHub(s) {
  s.planets[1].stock = { m: 60000, c: 40000, d: 5000, at: JOUR };
  s.planets[1].ships = {};
  s.planets[0].ships = { lc: 10, sc: 5 };
}

/** La colonie a ses propres transporteurs. */
function flotteSurPlace(s) {
  s.planets[1].stock = { m: 60000, c: 40000, d: 5000, at: JOUR };
  s.planets[1].ships = { lc: 6 };
  s.planets[0].ships = { sc: 2 };
}

const transfert = g => g.simulateDay().sessions[0].acts.find(a => a.kind === 'transfer');

t('un rapatriement refusé ne revient pas dans le plan', () => {
  const g = app(flotteSurPlace, JOUR);
  const a = transfert(g);
  assert.ok(a, 'un rapatriement est proposé');
  const key = `transfer:${g.S.planets[a.p].id}:${a.dest}`;
  g.S.daily.no[key] = JOUR;
  assert.ok(!transfert(g), 'après un Non, le plan ne le repropose plus');
  // Un refus ne s'évapore pas : seul le joueur le défait, d'un bouton.
  g.S.daily.no[key] = JOUR - 400 * 24 * 3600e3;
  assert.ok(!transfert(g), 'le temps ne ramène pas une carte refusée');
  g.S.daily.no = {};
  assert.ok(transfert(g), 'remise, elle revient');
});

/* Le joueur a fait venir des ressources pour monter son usine de robots ; le
   classement, lui, voit un hangar à agrandir et le repropose à chaque passage.
   Le « Non » se pose donc avant le choix, pas sur la carte déjà dessinée :
   écarté, le bâtiment laisse la place au pas suivant au lieu d'un trou. */
const batiments = g => g.simulateDay().sessions[0].acts.filter(a => a.kind === 'b');
/* Le pas suivant d'une planète : une carte à lancer, ou la même en attente de
   ressources quand il coûte plus cher que celui qu'on vient d'écarter. */
const pasSuivant = (g, pid) => { const s = g.simulateDay().sessions[0];
  return s.acts.concat(s.waits).filter(x => x.kind === 'b' && g.S.planets[x.p].id === pid); };

t('un chantier mis de côté laisse la place au suivant, sur la même planète', () => {
  const g = app(null, JOUR);
  const a = batiments(g)[0];
  assert.ok(a, 'le plan propose un chantier');
  const pid = g.S.planets[a.p].id;
  // la clé que porte le bouton « Non » de la carte, pas une clé réécrite ici :
  // c'est la rencontre des deux qui se vérifie.
  g.S.daily.no[g.actKey(a)] = JOUR;
  const apres = pasSuivant(g, pid);
  assert.ok(!apres.some(x => x.k === a.k), 'ce bâtiment-là ne revient pas');
  assert.ok(apres.length, 'et la planète a quand même un pas suivant : ' + a.k);
  g.S.daily.no = {};
  assert.ok(batiments(g).some(x => x.k === a.k), 'remis, il revient');
});

t('le bouton « Non » est bien sur la carte de chantier', () => {
  const g = app(null, JOUR);
  const a = batiments(g)[0];
  assert.ok(lu(g.actHtml(a, true)).includes('data-no="' + g.actKey(a) + '"'),
    'sans ce bouton, rien ne permet de mettre le chantier de côté');
});

t('chaque carte mise de côté se nomme, et se remet toute seule', () => {
  const g = app(null, JOUR);
  const a = batiments(g)[0];
  const cle = g.actKey(a);
  g.S.daily.no[cle] = JOUR;
  // Le libellé se reconstruit depuis la clé : « b:mere:solar » ne se remet pas
  // en connaissance de cause.
  const nom = g.noLabel(cle);
  assert.ok(nom.includes(g.planetRef(g.S.planets[a.p])), 'la planète se nomme : ' + nom);
  assert.ok(nom.includes(g.B[a.k].n), 'le bâtiment se nomme : ' + nom);
  const html = lu(g.noListe());
  assert.ok(html.includes('data-noone="' + cle + '"'), 'un bouton par carte : ' + html);
  assert.ok(html.includes(nom), 'et son nom à côté : ' + html);
});

t("rien de côté, rien à remettre", () => {
  assert.equal(app(null, JOUR).noListe(), '', 'la liste ne s\'affiche pas pour rien');
});

t('une recherche et une mission mises de côté se nomment aussi', () => {
  const g = app(null, JOUR);
  const r = g.nextResearch().list[0];
  assert.ok(g.noLabel('t::' + r.k).includes(g.T[r.k].n), g.noLabel('t::' + r.k));
  // Une mission ne porte que son identifiant : son texte vient de la carte.
  const miss = g.dailyMissions();
  assert.ok(g.noLabel('m:' + miss[0].id, miss).includes(miss[0].what), g.noLabel('m:' + miss[0].id, miss));
});

t('un rapatriement mis de côté garde ses coordonnées lisibles', () => {
  // La destination porte ses propres deux-points : la clé ne se découpe pas
  // sur tous, sinon « 1:142:6 » devient « 1 ».
  const g = app(null, JOUR);
  assert.ok(g.noLabel('transfer:' + g.S.planets[0].id + ':1:142:6').includes('1:142:6'),
    g.noLabel('transfer:' + g.S.planets[0].id + ':1:142:6'));
});

t('une recherche mise de côté laisse la place à la suivante', () => {
  const g = app(null, JOUR);
  const r = g.nextResearch().list[0];
  // Sans planète : le labo peut déménager, le refus reste.
  assert.equal(g.actKey({ kind: 't', k: r.k, p: 0 }), 't::' + r.k);
  g.S.daily.no[g.actKey({ kind: 't', k: r.k, p: 0 })] = JOUR;
  const suivante = g.nextResearch().list[0];
  assert.ok(suivante && suivante.k !== r.k, 'la file passe à la suivante');
});

/* Le joueur fait ses rapatriements dans le jeu, pas en cliquant « Lancé » ici.
   Sans lire les mouvements de flotte, le plan reproposait la même carte comme
   si rien n'était parti. */
t('un rapatriement déjà parti dans le jeu ne se repropose pas', () => {
  const g = app(flotteSurPlace, JOUR);
  const a = transfert(g);
  assert.ok(a, 'un rapatriement est proposé');
  const depart = g.S.planets[a.p].coords;
  g.S.moves = [{ mission: 3, ret: false, arrival: (JOUR + 2 * 3600e3) / 1000, origin: depart, dest: '1:1:8' }];
  assert.ok(!transfert(g), 'les mouvements de flotte suffisent, sans « Lancé »');
});

t('sans vaisseau sur la colonie, l\'action se passe là où est la flotte', () => {
  const g = app(flotteAuHub, JOUR);
  const a = transfert(g);
  assert.ok(a, 'un rapatriement est proposé');
  assert.ok(/Planète mère/.test(a.q),
    'l\'étiquette doit désigner la planète d\'où partent les vaisseaux : ' + a.q);
  assert.ok(!/^Flotte · Colonie/.test(a.q),
    'surtout pas la colonie, où il n\'y a aucun vaisseau');
});

t('le texte dit qu\'il faut d\'abord envoyer les vaisseaux à vide', () => {
  const g = app(flotteAuHub, JOUR);
  const a = transfert(g);
  assert.ok(/vers Colonie/.test(a.what),
    'la première mission va vers la colonie : ' + a.what);
  assert.ok(/vide/.test(a.what + a.why),
    'et elle part à vide : ' + a.why);
});

t('le trajet à vide est un Stationner, pas un Transporter', () => {
  const g = app(flotteAuHub, JOUR);
  const a = transfert(g);
  // Une mission Transporter revient toute seule à vide : les vaisseaux ne
  // seraient plus là pour charger. Seul Stationner les laisse sur place.
  assert.ok(/Stationner/.test(a.why), 'la mission aller doit être Stationner : ' + a.why);
  assert.ok(!/Mission Transporter/.test(a.why),
    'Transporter repartirait tout seul : ' + a.why);
});

t('le texte dit que les transporteurs resteront basés sur la colonie', () => {
  const g = app(flotteAuHub, JOUR);
  const a = transfert(g);
  // Le Transporter de retour repart de la colonie : il y revient à vide.
  // La principale ne les récupère pas ; il faut que le joueur le sache
  // avant de dégarnir sa flotte d'expédition.
  assert.ok(/basés sur Colonie|restent sur Colonie|reviendront sur Colonie/.test(a.why),
    'le texte doit dire où ils vivront désormais : ' + a.why);
});

t('avec ses propres vaisseaux, la colonie envoie directement', () => {
  const g = app(flotteSurPlace, JOUR);
  const a = transfert(g);
  assert.ok(a, 'un rapatriement est proposé');
  assert.ok(/Colonie/.test(a.q), 'l\'action se passe sur la colonie : ' + a.q);
  assert.ok(/Rapatrier vers Planète mère/.test(a.what), a.what);
});

/* ---------- la recherche attire les ressources ---------- */

/* Le meilleur labo sur la colonie, le meilleur chantier sur la mère : la
   recherche se paie donc là où le hub n'est pas. */
function laboSurLaColonie(s) {
  s.day.focus = 'fleet';            // la feuille de route ouvre sur Combustion 5, critique
  s.planets[1].b.lab = 6;           // labo de la colonie devant celui de la mère (5)
  s.planets[1].stock = { m: 2000, c: 1000, d: 200, at: JOUR };
  s.planets[0].ships = { lc: 10, sc: 5 };
}

t('le rapatriement vise la planète du labo, pas le hub', () => {
  const g = app(laboSurLaColonie, JOUR);
  const a = g.simulateDay().sessions[0].acts
    .find(x => x.kind === 'transfer' && /Planète mère/.test(x.q));
  assert.ok(a, 'la mère envoie vers la colonie qui épargne pour la recherche');
  assert.equal(a.dest, '1:142:6', 'destination : la colonie, où est le labo');
  assert.ok(/Rapatrier vers Colonie/.test(a.what), a.what);
});

t('sans objectif ailleurs, le rapatriement vise toujours le hub', () => {
  const g = app(flotteSurPlace, JOUR);
  const a = transfert(g);
  assert.ok(a, 'un rapatriement est proposé');
  assert.equal(a.dest, '1:142:8', 'destination : la planète mère');
});

/* ---------- livrer une planète qui ne produit plus ---------- */

/* La colonie vient de perdre ses centrales : ses mines tournent au ralenti et
   elle n'a pas le cristal pour reconstruire. Le manque est chez elle, et
   aucun objectif n'y est attaché. */
function colonieSansEnergie(s) {
  s.planets[1].b = Object.assign({}, s.planets[1].b,
    { metal: 14, crystal: 12, deut: 10, solar: 12 });
  s.planets[1].stock = { m: 0, c: 0, d: 0, at: JOUR };
  s.planets[1].ships = {};
  s.planets[0].ships = { lc: 10, sc: 5 };
}

t('une planète bridée faute d\'énergie se fait livrer sa centrale', () => {
  const g = app(colonieSansEnergie, JOUR);
  const a = g.simulateDay().sessions[0].acts
    .find(x => x.kind === 'transfer' && /Planète mère/.test(x.q));
  assert.ok(a, 'la mère livre la colonie bridée');
  assert.equal(a.dest, '1:142:6', 'destination : la colonie qui manque d\'énergie');
  assert.ok(a.res && a.res[1] > 0, 'du cristal part : ' + JSON.stringify(a && a.res));
  assert.ok(/ralenti/.test(a.why), 'le texte dit pourquoi : ' + a.why);
});

t('« Avant les bâtiments » rend la tête de liste critique', () => {
  assert.equal(app(null, JOUR).nextResearch().list[0].crit, false,
    'à son tour, la tête de liste n\'est pas critique');
  const g = app(s => { s.day.research = 'first'; }, JOUR);
  assert.equal(g.nextResearch().list[0].crit, true);
});

t('« Avant les bâtiments » fait passer la recherche devant les chantiers', () => {
  const ordre = g => {
    const acts = g.simulateDay().sessions[0].acts;
    return [acts.findIndex(a => a.kind === 't'), acts.findIndex(a => a.kind === 'b')];
  };
  const [tNorm, bNorm] = ordre(app(null, JOUR));
  assert.ok(tNorm > bNorm && bNorm >= 0, 'à son tour, le bâtiment passe devant');
  const [tFirst, bFirst] = ordre(app(s => { s.day.research = 'first'; }, JOUR));
  assert.ok(tFirst >= 0 && tFirst < bFirst, 'en « avant les bâtiments », la recherche ouvre la session');
});

/* Relevé sur le jeu : Secteur résidentiel 25 sur la planète mère. */
const CASE_OK = { lvl: 24, state: 'ok', next: 25, cost: [13911, 3974, 0], secs: 1834,
  nom: 'Secteur résidentiel' };
const vieSur = (lf, modif) => app(s => {
  s.planets[0].lf = lf;
  if (modif) modif(s);
}, SOIR);
const premierLf = g => g.simulateDay().sessions[0].acts.find(a => a.kind === 'lf');

/* ---------- les emplacements d'une planète ---------- */

t('l\'infobulle de la vignette donne les emplacements', () => {
  const g = app();
  // Relevé sur le jeu : nom, coordonnées, diamètre et emplacements, températures.
  assert.deepEqual(g.casesTuile('Planète mère [1:234:5] 12.800km (150/163) -13 °C à 27 °C'),
    { pris: 150, max: 163 });
  assert.equal(g.casesTuile('Planète mère [1:234:5]'), null, 'rien à deviner');
  assert.equal(g.casesTuile(null), null);
});

t('un relevé d\'emplacements aberrant est ignoré plutôt que cru', () => {
  // Une parenthèse attrapée ailleurs dans l'infobulle déclarerait la planète
  // pleine et ferait taire le plan dessus : le silence est pire que le bug.
  const g = app(s => { s.planets[0].cases = { pris: 2, max: 3 }; });
  assert.equal(g.casesLibres(g.S.planets[0]), null, 'trois emplacements : ce n\'est pas une planète');
  assert.ok(!g.planetAlerts(g.S.planets[0]).some(a => /emplacement/.test(a.what)),
    'et rien ne s\'affiche');
  assert.ok(g.simulateDay().sessions[0].acts.some(a => a.kind === 'b'), 'le plan continue');
});

t('le dernier emplacement est annoncé avant d\'être pris', () => {
  const g = app(s => { s.planets[0].cases = { pris: 162, max: 163 }; });
  const a = g.planetAlerts(g.S.planets[0]).find(x => /Un seul emplacement/.test(x.what));
  assert.ok(a, 'c\'est maintenant que le joueur choisit, pas après avoir lancé');
  assert.ok(/Terraformeur/.test(a.why), 'et la raison de le garder : ' + (a && a.why));
  assert.ok(g.simulateDay().sessions[0].acts.some(a2 => a2.kind === 'b'),
    'mais le plan continue de proposer : prendre le dernier reste son droit');
});

t('une planète pleine le dit, et le plan n\'y propose plus rien', () => {
  // Un niveau de plus est un emplacement de plus : même une mine est refusée.
  const g = app(s => { s.planets[0].cases = { pris: 163, max: 163 }; });
  const a = g.planetAlerts(g.S.planets[0]).find(x => /Plus un emplacement/.test(x.what));
  assert.ok(a && a.sev === 'bad', 'le jeu refuse tout ici');
  assert.ok(!g.simulateDay().sessions.flatMap(x => x.acts).some(x => x.kind === 'b' && x.p === 0),
    'le plan ne propose plus de bâtiment sur cette planète');
});

t('chaque ligne de coût est rangée dans la bonne ressource', () => {
  const g = app();
  assert.equal(g.lfRes('resource metal icon sufficient tooltip'), 0);
  assert.equal(g.lfRes('resource crystal icon insufficient tooltip'), 1);
  assert.equal(g.lfRes('resource deuterium icon tooltip'), 2);
  // une classe inconnue ne doit pas atterrir dans le métal par défaut
  assert.equal(g.lfRes('resource energy icon'), -1);
});

/* ---------- ce que le script pose sur la page du jeu ---------- */

/* Relevé sur la page Recherche : Astrophysique 5, cristal insuffisant. */
const ASTRO = {
  planetId: '33657643',
  costs: [
    { cls: 'resource metal icon sufficient tooltip js_hideTipOnMobile', value: 37515 },
    { cls: 'resource crystal icon insufficient tooltip js_hideTipOnMobile', value: 75031 },
    { cls: 'resource deuterium icon sufficient tooltip js_hideTipOnMobile', value: 37515 }
  ],
  stock: [709703, 36384, 48432]
};
const SKIN = { hints: {}, rates: { '33657643': [12000, 6000, 3000] }, lean: false };

t('la page annonce le d\u00e9lai de la ressource qui manque', () => {
  // 75 031 - 36 384 = 38 647 cristal à 6 000/h
  assert.equal(runPage({ ...ASTRO, skin: SKIN }).eta, 'Payable dans 6h 27m');
});

t('la ligne sort de la bo\u00eete de co\u00fbt, qui la rognait', () => {
  const r = runPage({ ...ASTRO, skin: SKIN });
  assert.equal(r.etaParent, 'technologydetails',
    'posée dans .costs, elle était créée mais invisible');
});

t('rien \u00e0 annoncer quand tout est pay\u00e9', () => {
  assert.equal(runPage({ ...ASTRO, skin: SKIN, stock: [999999, 999999, 999999] }).eta, null);
});

t('sans d\u00e9bit connu, pas de d\u00e9lai invent\u00e9', () => {
  const r = runPage({ ...ASTRO, skin: { hints: {}, rates: {}, lean: false } });
  assert.equal(r.eta, null, 'le panneau n\'a pas publié ce débit');
});

t('une production nulle est annonc\u00e9e comme telle', () => {
  const r = runPage({ ...ASTRO, skin: { hints: {}, rates: { '33657643': [12000, 0, 3000] }, lean: false } });
  assert.ok(/Hors de port\u00e9e/.test(r.eta), r.eta);
});

/* Une planète voisine qui a le stock et les transporteurs : deux grands
   transporteurs couvrent les 38 647 cristal, et le vol dure 10 minutes. */
const DONNEUR = {
  ...SKIN,
  donors: { '33657643': [{ n: 'Caribou', st: [500000, 100000, 50000], lc: 2, sc: 0, sec: [600, 900] }] },
  cargo: [25000, 5000]
};

t('une livraison plus rapide que la production est propos\u00e9e', () => {
  const r = runPage({ ...ASTRO, skin: DONNEUR });
  assert.ok(/Payable dans 6h 27m/.test(r.eta), r.eta);
  assert.ok(/Ou fais livrer .*cristal depuis Caribou : 2 GT, 10m de vol/.test(r.eta), r.eta);
});

t('l\'aller \u00e0 vide est compt\u00e9 et nomm\u00e9', () => {
  const loin = { ...DONNEUR, donors: { '33657643': [{ ...DONNEUR.donors['33657643'][0], out: [1200, 1500], base: 'Planète mère' }] } };
  const r = runPage({ ...ASTRO, skin: loin });
  // 600 de vol chargé + 1 200 à vide = 30 minutes en tout
  assert.ok(/2 GT, 30m de vol — à envoyer d'abord à vide depuis Planète mère/.test(r.eta), r.eta);
});

t('le t\u00e9moin dit qui peut livrer', () => {
  const d = runPage({ ...ASTRO, skin: DONNEUR }).dataset.copilote;
  assert.ok(/donneurs=Caribou:2GT\+0PT/.test(d), d);
  // une charge d'avant la livraison se reconnaît, au lieu de passer pour un
  // empire sans donneur
  const vieux = runPage({ ...ASTRO, skin: SKIN }).dataset.copilote;
  assert.ok(/donneurs=charge ancienne/.test(vieux), vieux);
});

t('une livraison plus lente se dit, sans se faire passer pour mieux', () => {
  // Le joueur tranche : lui seul sait ce que sa flotte a d'autre à faire.
  const lent = { ...DONNEUR, donors: { '33657643': [{ ...DONNEUR.donors['33657643'][0], sec: [40000, 50000] }] } };
  const r = runPage({ ...ASTRO, skin: lent });
  assert.ok(/Payable dans 6h 27m/.test(r.eta), r.eta);
  assert.ok(/^Livraison plus lente que ta production : 38.647 cristal depuis Caribou/m.test(r.eta), r.eta);
});

t('la ligne revient d\u00e8s que le jeu refait son panneau', () => {
  // Le jeu reconstruit le détail à chaque tuile ouverte : attendre le tour de
  // garde suivant laissait la ligne absente jusqu'à cinq secondes, et elle
  // passait pour capricieuse.
  const r = runPage({ ...ASTRO, skin: DONNEUR });
  assert.ok(r.eta, 'elle est là au chargement');
  r.efface();
  assert.equal(r.read().eta, null, 'le jeu vient de l\'emporter');
  r.secousse();
  assert.ok(/Payable dans 6h 27m/.test(r.read().eta), 'elle revient sans attendre');
});

t('la ligne m\u00e8ne au formulaire de flotte, d\u00e9j\u00e0 rempli', () => {
  const pret = { ...DONNEUR, donors: { '33657643': [{ ...DONNEUR.donors['33657643'][0], cp: '33601', vers: '1:142:8', mission: 3 }] } };
  const r = runPage({ ...ASTRO, skin: pret });
  // Mêmes paramètres que les liens du panneau : le jeu remplit son formulaire.
  assert.ok(/component=fleetdispatch/.test(r.etaLink), r.etaLink);
  assert.ok(/cp=33601/.test(r.etaLink), 'on part de la planète qui donne');
  assert.ok(/galaxy=1&system=142&position=8/.test(r.etaLink), r.etaLink);
  assert.ok(/mission=3/.test(r.etaLink), 'Transporter');
  assert.ok(/am203=2/.test(r.etaLink), 'les deux grands transporteurs retenus');
  assert.equal(r.etaLinkText, '→ préparer la livraison');
});

t('sans transporteur sur place, le lien fait d\'abord l\'aller \u00e0 vide', () => {
  const vide = { ...DONNEUR, donors: { '33657643': [{ ...DONNEUR.donors['33657643'][0], out: [1200, 1500], base: 'Planète mère', cp: '33601', vers: '1:142:6', mission: 4 }] } };
  const r = runPage({ ...ASTRO, skin: vide });
  assert.ok(/mission=4/.test(r.etaLink), 'Stationner : sinon la flotte repart aussitôt');
  assert.ok(/galaxy=1&system=142&position=6/.test(r.etaLink), 'vers la planète qui donne, pas vers ici');
  assert.equal(r.etaLinkText, '→ envoyer les transporteurs');
});

t('une donneuse sans identifiant de jeu ne pose pas de lien', () => {
  // avant la synchro, viser « cp=null » enverrait sur la mauvaise planète
  const r = runPage({ ...ASTRO, skin: DONNEUR });
  assert.equal(r.etaLink, null, 'pas de cp publié : pas de lien');
  assert.ok(/Ou fais livrer/.test(r.eta), 'la phrase reste');
});

t('le t\u00e9moin nomme la raison du silence', () => {
  const vide = { ...DONNEUR, donors: { '33657643': [{ ...DONNEUR.donors['33657643'][0], st: [500000, 100, 50000] }] } };
  assert.ok(/livraison=stock/.test(runPage({ ...ASTRO, skin: vide }).dataset.copilote));
  const court = { ...DONNEUR, donors: { '33657643': [{ ...DONNEUR.donors['33657643'][0], lc: 1, sc: 0 }] } };
  assert.ok(/livraison=soute trop petite/.test(runPage({ ...ASTRO, skin: court }).dataset.copilote));
  assert.ok(/livraison=aucune donneuse/.test(runPage({ ...ASTRO, skin: { ...DONNEUR, donors: {} } }).dataset.copilote));
  assert.ok(/livraison=rien ne manque/.test(runPage({ ...ASTRO, skin: DONNEUR, stock: [999999, 999999, 999999] }).dataset.copilote));
  // et quand elle parle, le témoin porte la durée retenue
  assert.ok(/livraison=10m/.test(runPage({ ...ASTRO, skin: DONNEUR }).dataset.copilote));
});

t('un donneur qui n\'a pas le stock ne livre rien', () => {
  const vide = { ...DONNEUR, donors: { '33657643': [{ ...DONNEUR.donors['33657643'][0], st: [500000, 100, 50000] }] } };
  assert.equal(runPage({ ...ASTRO, skin: vide }).eta, 'Payable dans 6h 27m');
});

t('une soute trop petite ne livre rien', () => {
  const court = { ...DONNEUR, donors: { '33657643': [{ ...DONNEUR.donors['33657643'][0], lc: 1, sc: 0 }] } };
  assert.equal(runPage({ ...ASTRO, skin: court }).eta, 'Payable dans 6h 27m');
});

t('sans d\u00e9bit connu, la livraison parle quand m\u00eame', () => {
  // Le hangar ou une production nulle arrêtent la production locale, pas une
  // livraison : c'est justement là qu'elle vaut d'être dite.
  const r = runPage({ ...ASTRO, skin: { ...DONNEUR, rates: {} } });
  assert.ok(/^Ou fais livrer /.test(r.eta), r.eta);
});

t('le t\u00e9moin d\'\u00e9tat dit ce que la page a re\u00e7u', () => {
  const d = runPage({ ...ASTRO, skin: SKIN }).dataset.copilote;
  assert.ok(/debits=33657643/.test(d), d);
  assert.ok(/ici=33657643/.test(d), d);
});

/* ---------- la tournée d'une tuile, dans la page du jeu ---------- */

const TOUR = { hints: {}, rates: {}, lean: false, tour: {
  '33657643': { n: 'Planète mère', b: { '21': 4 }, cost: {}, bq: 0, lfq: 0, st: [0, 0, 0] },
  '102': { n: 'Colonie', b: { '21': 2 }, cost: {}, bq: 0, lfq: 0, st: [0, 0, 0] },
  '103': { n: 'Lune bleue', b: {}, cost: {}, bq: 0, lfq: 0, st: [0, 0, 0] }
} };
const ARRIVEE = { skin: TOUR, tiles: ['21'], search: '?page=ingame&component=facilities&openTech=21' };

/** Les pastilles par nom de planète : l'ordre a son propre test. */
const pins = r => Object.fromEntries(r.map(x => [x.txt.split(' · ')[0], x]));

t('la barre liste les planètes et ouvre la même tuile ailleurs', () => {
  const r = runPage(ARRIVEE).tour;
  assert.equal(r.length, 3);
  assert.equal(pins(r)['Colonie'].txt, 'Colonie · 2 → 3');
  assert.equal(pins(r)['Colonie'].href,
    '/game/index.php?page=ingame&component=facilities&cp=102&openTech=21');
});

t('les pastilles suivent l\'identifiant de planète, pas le hasard', () => {
  // L'ordre vient de JS : des clés entières se parcourent en croissant, ce qui
  // range les planètes par ancienneté — stable d'une page à l'autre.
  assert.deepEqual(runPage(ARRIVEE).tour.map(x => x.txt.split(' · ')[0]),
    ['Colonie', 'Lune bleue', 'Planète mère']);
});

t('la planète courante est marquée et n\'est pas un lien', () => {
  const p = pins(runPage(ARRIVEE).tour)['Planète mère'];
  assert.equal(p.courante, true);
  assert.equal(p.href, null);
});

t('un niveau inconnu se dit, et ne s\'invente pas', () => {
  assert.equal(pins(runPage(ARRIVEE).tour)['Lune bleue'].txt, 'Lune bleue · →');
});

t('sans tuile en main, pas de barre', () => {
  assert.deepEqual(runPage({ ...ARRIVEE, search: '?page=ingame&component=facilities' }).tour, []);
});

t('une tuile inconnue ou absurde ne produit pas de barre', () => {
  for (const q of ['openTech=9e9', 'openTech=__proto__', 'openTech=999']) {
    assert.deepEqual(runPage({ ...ARRIVEE, search: '?page=ingame&component=facilities&' + q }).tour, []);
  }
});

t('une recherche n\'ouvre pas de tournée : une seule file pour l\'empire', () => {
  const r = runPage({ ...ARRIVEE, tiles: ['124'], search: '?page=ingame&component=research&openTech=124' });
  assert.deepEqual(r.tour, []);
});

t('sans tournée publiée, pas de barre', () => {
  assert.deepEqual(runPage({ ...ARRIVEE, skin: { hints: {}, rates: {}, lean: false } }).tour, []);
});

t('seule à porter la tuile, une planète n\'ouvre pas de tournée', () => {
  const seule = { ...TOUR, tour: { '33657643': TOUR.tour['33657643'] } };
  assert.deepEqual(runPage({ ...ARRIVEE, skin: seule }).tour, []);
});

t('une secousse de la page ne duplique pas la barre', () => {
  const p = runPage(ARRIVEE);
  p.secousse();
  assert.equal(p.read().tour.length, 3);
});

const DEPART = { skin: TOUR, tiles: ['21', '1'], search: '?page=ingame&component=facilities' };

t('ouvrir une tuile ouvre la tournée', () => {
  const p = runPage(DEPART);
  assert.deepEqual(p.read().tour, []);
  p.clic('21');
  assert.equal(p.read().tour.length, 3);
});

t('ouvrir une autre tuile change de tournée', () => {
  const p = runPage(DEPART);
  p.clic('21'); p.clic('1');
  assert.deepEqual(p.read().tour, []);   // personne n'a de niveau pour la tuile 1
});

t('un clic l\'emporte sur l\'openTech de l\'arrivée', () => {
  // Arrivé par une pastille, le joueur ouvre une autre tuile : c'est elle qu'il
  // regarde. La barre qui resterait sur la précédente afficherait les niveaux
  // d'un bâtiment dont plus rien à l'écran ne parle.
  const p = runPage({ ...DEPART, search: '?page=ingame&component=facilities&openTech=21' });
  assert.equal(p.read().tour.length, 3, 'à l\'arrivée, la tournée est celle du lien');
  p.clic('1');
  assert.deepEqual(p.read().tour, []);
});

const occupee = { ...TOUR, tour: { ...TOUR.tour,
  '102': { ...TOUR.tour['102'], bq: Date.now() + 5400000 } } };
const pauvre = { ...TOUR, tour: { ...TOUR.tour,
  '102': { ...TOUR.tour['102'], cost: { '21': [1000, 500, 0] }, st: [400, 500, 0] } } };

t('une file occupée se dit, en temps restant', () => {
  const r = runPage({ ...ARRIVEE, skin: occupee });
  const p = pins(r.tour)['Colonie'];
  assert.equal(p.grisee, true);
  assert.equal(p.enFile, true, 'une file qui tourne n\'est pas un manque');
  // le mot « file » est au groupe : la pastille ne le redit pas
  assert.ok(/· 2h/.test(p.txt), p.txt);
  assert.ok(!/file/.test(p.txt), p.txt);
  assert.ok(r.tourGroupes.includes('file occupée — 1'), r.tourGroupes.join(' | '));
  assert.ok(p.href, 'grisée mais cliquable');
});

t('un labo ne part pas tant qu\'une recherche tourne, où qu\'il soit', () => {
  // Une seule recherche pour tout l'empire : la file de la planète a beau être
  // libre, le jeu refuse de monter le labo, et « prête » envoyait le joueur se
  // heurter au jeu.
  const labo = { hints: {}, rates: {}, lean: false, rq: Date.now() + 10800000, tour: {
    '33657643': { n: 'Planète mère', b: { '31': 7 }, cost: {}, bq: 0, lfq: 0, st: [0, 0, 0] },
    '102': { n: 'Colonie', b: { '31': 3 }, cost: {}, bq: 0, lfq: 0, st: [0, 0, 0] } } };
  const r = runPage({ skin: labo, tiles: ['31'],
    search: '?page=ingame&component=facilities&openTech=31' });
  const p = pins(r.tour)['Colonie'];
  assert.equal(p.grisee, true);
  assert.equal(p.enFile, true);
  // ce qui tient la tuile n'est pas la file de la planète : on le nomme
  assert.ok(/· recherche 3h/.test(p.txt), p.txt);
  assert.ok(/aucune prête/.test(r.tourTitre), r.tourTitre);
});

t('une file de plus d\'un jour ne se dit pas en heure du jour', () => {
  // « file jusqu'à 18:17 » pour une file qui finit demain à 18:17 se lit
  // aujourd'hui : un temps restant ne se lit jamais pour un autre.
  const longue = { ...TOUR, tour: { ...TOUR.tour,
    '102': { ...TOUR.tour['102'], bq: Date.now() + 30.5 * 3600000 } } };
  assert.ok(/· 31h/.test(pins(runPage({ ...ARRIVEE, skin: longue }).tour)['Colonie'].txt),
    pins(runPage({ ...ARRIVEE, skin: longue }).tour)['Colonie'].txt);
});

t('un stock trop court nomme ce qui manque', () => {
  const p = pins(runPage({ ...ARRIVEE, skin: pauvre }).tour)['Colonie'];
  assert.equal(p.grisee, true);
  assert.ok(/manque 600 métal/.test(p.txt), p.txt);
});

t('un gros manque s\'écrit au millier, comme le jeu écrit ses coûts', () => {
  const gros = { ...TOUR, tour: { ...TOUR.tour,
    '102': { ...TOUR.tour['102'], cost: { '21': [0, 176844, 0] }, st: [0, 0, 0] } } };
  const p = pins(runPage({ ...ARRIVEE, skin: gros }).tour)['Colonie'];
  assert.ok(/manque 177K cristal/.test(p.txt), p.txt);
  assert.ok(/hors de portée/.test(p.txt), p.txt);
});

t('un manque en millions se dit en millions', () => {
  const million = { ...TOUR, tour: { ...TOUR.tour,
    '102': { ...TOUR.tour['102'], cost: { '21': [1240000, 0, 0] }, st: [0, 0, 0] } } };
  assert.ok(/manque 1.2M métal/.test(pins(runPage({ ...ARRIVEE, skin: million }).tour)['Colonie'].txt));
});

t('un coût inconnu ne fait pas manquer', () => {
  const p = pins(runPage(ARRIVEE).tour)['Colonie'];
  assert.equal(p.grisee, false);
  assert.ok(!/manque/.test(p.txt), p.txt);
});

t('une recherche de forme de vie lit sa propre file, pas celle des bâtiments', () => {
  // 112xx : par planète comme les bâtiments de forme de vie, mais pas la même
  // file. Lire `lfq` pour une recherche annonce « libre » une planète occupée.
  const lfr = { hints: {}, rates: {}, lean: false, tour: {
    '33657643': { n: 'Planète mère', b: { '11201': 3 }, cost: {}, bq: 0, lfq: 0, lfr: 0, st: [0, 0, 0] },
    '102': { n: 'Colonie', b: { '11201': 1 }, cost: {}, bq: 0, lfq: 0,
      lfr: Date.now() + 5400000, st: [0, 0, 0] }
  } };
  const r = runPage({ skin: lfr, tiles: ['11201'],
    search: '?page=ingame&component=lfresearch&openTech=11201' });
  assert.ok(/· 2h/.test(pins(r.tour)['Colonie'].txt), pins(r.tour)['Colonie'].txt);
});

t('un bâtiment de forme de vie lit toujours la file des bâtiments', () => {
  const lfb = { hints: {}, rates: {}, lean: false, tour: {
    '33657643': { n: 'Planète mère', b: { '11101': 3 }, cost: {}, bq: 0, lfq: 0, lfr: 0, st: [0, 0, 0] },
    '102': { n: 'Colonie', b: { '11101': 1 }, cost: {}, bq: 0, lfr: 0,
      lfq: Date.now() + 5400000, st: [0, 0, 0] }
  } };
  const r = runPage({ skin: lfb, tiles: ['11101'],
    search: '?page=ingame&component=lfbuildings&openTech=11101' });
  assert.ok(/· 2h/.test(pins(r.tour)['Colonie'].txt), pins(r.tour)['Colonie'].txt);
});

t('une page que le copilote ne connaît pas ne reçoit rien', () => {
  /* Le copilote ne dessine que sur les pages où ses propres liens mènent.
     Une URL forgée — ouverte depuis un message, ou nommant deux fois la page
     pour que le serveur et nous ne lisions pas la même — n'en fait pas partie,
     et il n'y a donc rien à contourner. */
  for (const q of ['component=facilities%26component%3Dfleetdispatch',
    'component=alliance&component=facilities',
    'component=facilities&component=alliance',
    'component=boutique', 'component=']) {
    const r = runPage({ ...ARRIVEE, search: '?page=ingame&' + q + '&openTech=21' });
    assert.deepEqual(r.tour, [], q);
    assert.equal(r.bande, null, q);
  }
});

t('et la page nommée par `page` compte autant que celle nommée par `component`', () => {
  const r = runPage({ ...ARRIVEE, search: '?page=alliance&openTech=21' });
  assert.deepEqual(r.tour, []);
  assert.equal(r.bande, null);
});

t('le stock publié avance avec la production entre deux envois', () => {
  // Le panneau ne republie que toutes les 30 s, et seulement ouvert sur
  // Aujourd'hui : un stock gelé grise une planète qui paie depuis une heure.
  const vieux = { hints: {}, rates: { '102': [3600, 0, 0] }, lean: false, tour: {
    '33657643': TOUR.tour['33657643'],
    '102': { n: 'Colonie', b: { '21': 2 }, cost: { '21': [1000, 0, 0] }, bq: 0, lfq: 0,
      st: [0, 0, 0], at: Date.now() - 3600000 }
  } };
  const p = pins(runPage({ ...ARRIVEE, skin: vieux }).tour)['Colonie'];
  assert.ok(!/manque/.test(p.txt), p.txt);
  assert.equal(p.grisee, false);
});

t('le témoin dit la tuile en main et le nombre de planètes reçues', () => {
  // Sans barre, le joueur ne sait pas laquelle des trois conditions manque :
  // la tournée publiée, la tuile ouverte, ou deux planètes qui la connaissent.
  assert.ok(/tournee=21:3/.test(runPage(ARRIVEE).dataset.copilote), runPage(ARRIVEE).dataset.copilote);
  const muet = runPage({ ...ARRIVEE, skin: { hints: {}, rates: {}, lean: false } });
  assert.ok(/tournee=21:0/.test(muet.dataset.copilote), muet.dataset.copilote);
  const sansTuile = runPage({ ...ARRIVEE, search: '?page=ingame&component=facilities' });
  assert.ok(/tournee=-:3/.test(sansTuile.dataset.copilote), sansTuile.dataset.copilote);
});

t('sans tuile ouverte, la barre suit celle que le copilote conseille', () => {
  const conseil = { ...TOUR, hints: { '33657643': { '21': 5 } } };
  const r = runPage({ skin: conseil, tiles: ['21'], search: '?page=ingame&component=facilities' });
  assert.equal(r.tour.length, 3, 'la barre est là dès l\'arrivée sur la page');
});

t('un conseil qui n\'est pas sur cette page n\'ouvre pas de tournée', () => {
  // Le copilote conseille la mine de métal, qui vit sur Ressources : sur
  // Installations, un lien vers cette tuile ne mènerait nulle part.
  const ailleurs = { ...TOUR, hints: { '33657643': { '1': 9 } } };
  const r = runPage({ skin: ailleurs, tiles: ['21'], search: '?page=ingame&component=facilities' });
  assert.deepEqual(r.tour, []);
});

t('une tuile ouverte l\'emporte sur le conseil', () => {
  const conseil = { ...TOUR, hints: { '33657643': { '21': 5 } },
    tour: { ...TOUR.tour, '102': { ...TOUR.tour['102'], b: { '21': 2, '1': 7 } },
      '33657643': { ...TOUR.tour['33657643'], b: { '21': 4, '1': 9 } } } };
  const p = runPage({ skin: conseil, tiles: ['21', '1'], search: '?page=ingame&component=facilities' });
  assert.equal(p.read().tour.length, 3);
  p.clic('1');
  assert.equal(pins(p.read().tour)['Colonie'].txt, 'Colonie · 7 → 8');
});

t('une pastille dit quand la planète pourra payer', () => {
  const lent = { hints: {}, rates: { '102': [1000, 0, 0] }, lean: false, tour: {
    '33657643': TOUR.tour['33657643'],
    '102': { n: 'Colonie', b: { '21': 2 }, cost: { '21': [3000, 0, 0] }, bq: 0, lfq: 0, st: [0, 0, 0] }
  } };
  const p = pins(runPage({ ...ARRIVEE, skin: lent }).tour)['Colonie'];
  assert.ok(/manque/.test(p.txt) && /· dans 3h/.test(p.txt), p.txt);
});

t('sans production connue, la planète se dit hors de portée', () => {
  const mort = { hints: {}, rates: {}, lean: false, tour: {
    '33657643': TOUR.tour['33657643'],
    '102': { n: 'Colonie', b: { '21': 2 }, cost: { '21': [3000, 0, 0] }, bq: 0, lfq: 0, st: [0, 0, 0] }
  } };
  const p = pins(runPage({ ...ARRIVEE, skin: mort }).tour)['Colonie'];
  assert.ok(/hors de portée/.test(p.txt), p.txt);
  assert.ok(!/payable/.test(p.txt), p.txt);
});

t('une tournée mal formée ne casse pas la surcouche', () => {
  const casse = { ...TOUR, tour: { ...TOUR.tour, '104': null,
    '105': { n: 'X', b: { '21': 1 }, cost: { '21': 'beaucoup' }, bq: 0, lfq: 0, st: [0, 0, 0] } } };
  const r = runPage({ ...ARRIVEE, skin: casse });
  assert.ok(/ici=33657643/.test(r.dataset.copilote), 'la peinture va jusqu\'au bout');
});

/* ---------- la bande du bas ---------- */

const BANDE = { hints: {}, rates: {}, lean: false, tour: {}, band: { pages: {
  facilities: [{ what: 'Usine de robots 7', ou: 'Caribou Land', why: 'Accélère les constructions',
    url: '/game/index.php?page=ingame&component=facilities&cp=101' }],
  galaxy: [{ what: 'Espionner 1:140:6', ou: '', why: '',
    url: '/game/index.php?page=ingame&component=galaxy' }]
} } };

t('la bande ne se dessine pas sur les pages écrites par les joueurs', () => {
  // Alliance, messages, discussion : leur contenu vient d'autres joueurs. Elles
  // ne sont pas dans la liste des pages du copilote, donc rien ne s'y dessine.
  for (const comp of ['alliance', 'messages', 'chat', 'buddies']) {
    const r = runPage({ skin: TOUR, tiles: ['21'],
      search: '?page=ingame&component=' + comp + '&openTech=21' });
    assert.equal(r.bande, null, comp);
    assert.deepEqual(r.tour, [], comp);
  }
});

t('un bloc de cases vide ne devient pas l\'hôte de la bande', () => {
  // Une page d'alliance affiche du balisage écrit par d'autres joueurs, et il
  // vit dans le contenu du jeu : l'identifiant ne prouve donc rien. L'ancre se
  // déduit d'une vraie case, pas d'un nom.
  const r = runPage({ skin: BANDE, search: '?page=ingame&component=galaxy', casesIntruses: true });
  assert.equal(r.bandeEnTete, true, 'la bande reste en tête du contenu du jeu');
});

t('une page sans cases reçoit la bande en tête du contenu', () => {
  // Galaxie, Flotte, Vue d'ensemble : pas de bloc de cases où se glisser.
  assert.equal(runPage({ skin: BANDE, search: '?page=ingame&component=galaxy' }).bandeEnTete, true);
});

t('la bande porte ce qui se fait sur la page ouverte', () => {
  const b = runPage({ skin: BANDE, search: '?page=ingame&component=facilities' }).bande;
  assert.deepEqual(b.ici.map(x => x.txt), ['Usine de robots 7 · Caribou Land']);
  assert.equal(b.ici[0].why, 'Accélère les constructions', 'le pourquoi tient dans l\'infobulle');
  assert.ok(b.ici[0].href);
});

t('une ligne qui attend ses ressources se grise et porte sa date', () => {
  const att = { ...BANDE, band: { pages: { facilities: [{ what: 'Usine de robots 7',
    ou: 'Caribou Land', quand: 'vers 16:40', why: 'Il manque 1 000 métal',
    url: '/game/index.php?page=ingame&component=facilities&cp=101', gris: true }] } } };
  const b = runPage({ skin: att, search: '?page=ingame&component=facilities' }).bande;
  // l'heure tient en un seul morceau : espace insécable, sinon « vers » reste
  // sur la ligne de l'action et l'heure tombe toute seule à la ligne suivante
  assert.equal(b.ici[0].txt, 'Usine de robots 7 · Caribou Land ·\u00a0vers\u00a016:40');
  assert.equal(b.ici[0].grisee, true, 'ce n\'est pas lançable maintenant');
  assert.ok(b.ici[0].href, 'mais la page reste à un clic');
});

t('chaque page montre ses propres lignes', () => {
  const b = runPage({ skin: BANDE, search: '?page=ingame&component=galaxy' }).bande;
  assert.deepEqual(b.ici.map(x => x.txt), ['Espionner 1:140:6']);
});

t('une page dont le copilote n\'a rien à dire n\'a pas de bande', () => {
  assert.equal(runPage({ skin: BANDE, search: '?page=ingame&component=alliance' }).bande, null);
  assert.equal(runPage({ skin: { hints: {}, rates: {}, lean: false } }).bande, null);
});

t('la tournée et les lignes de la page tiennent dans la même bande', () => {
  const deux = { ...TOUR, band: BANDE.band };
  const r = runPage({ skin: deux, tiles: ['21'],
    search: '?page=ingame&component=facilities&openTech=21' });
  assert.equal(r.bande.ici.length, 1, 'ce qui se fait ici');
  assert.equal(r.tour.length, 3, 'et la tournée, dans la même bande');
});

t('un chiffre qui bouge met la bande à jour, il ne la repose pas', () => {
  // Les manques et les délais bougent sans arrêt : démolir la bande à chaque
  // fois, c'est la faire clignoter sous les yeux du joueur.
  /* Le manque bouge, l'état ne bouge pas : Colonie était déjà à payer, elle
     l'est encore. Même forme, donc la bande est réécrite sur place. */
  const avant = { ...TOUR, tour: { ...TOUR.tour,
    '102': { ...TOUR.tour['102'], cost: { '21': [3000, 0, 0] }, st: [0, 0, 0] } } };
  const p = runPage({ ...ARRIVEE, skin: avant });
  const pose = p.read().poses;
  const bouge = { ...TOUR, tour: { ...TOUR.tour,
    '102': { ...TOUR.tour['102'], cost: { '21': [9000, 0, 0] }, st: [0, 0, 0] } } };
  p.majSkin(bouge);
  assert.equal(p.read().poses, pose, 'la même bande, mise à jour');
  assert.ok(/manque 9K métal/.test(pins(p.read().tour)['Colonie'].txt), pins(p.read().tour)['Colonie'].txt);
});

/* Changer de groupe, en revanche, change la forme de la bande : une pastille
   passe sous un autre libellé, et la ligne de résumé apparaît. Là, on repose —
   réécrire en place rangerait la pastille sous le mauvais titre. */
t('une planète qui change d\'état repose la bande', () => {
  const p = runPage(ARRIVEE);
  const pose = p.read().poses;
  p.majSkin({ ...TOUR, tour: { ...TOUR.tour,
    '102': { ...TOUR.tour['102'], cost: { '21': [9000, 0, 0] }, st: [0, 0, 0] } } });
  const r = p.read();
  assert.ok(r.poses > pose, 'reposée');
  assert.deepEqual(r.tourGroupes, ['prêtes à lancer — 2', 'à payer — 1']);
});

/* ---------- la tournée rangée par état ---------- */

/* Le titre répondait « la même tuile ailleurs » à un joueur qui venait de
   cliquer sur une tuile — il savait. Ce qu'il ne savait pas, c'est combien
   partent tout de suite. */
t('le titre nomme la tuile et compte les prêtes', () => {
  const r = runPage(ARRIVEE);
  assert.ok(/ ailleurs · 3 prêtes sur 3$/.test(r.tourTitre), r.tourTitre);
  assert.ok(!/^la même tuile/.test(r.tourTitre), 'la tuile se nomme : ' + r.tourTitre);
  const une = runPage({ ...ARRIVEE, skin: occupee });
  assert.ok(/· 2 prêtes sur 3$/.test(une.tourTitre), une.tourTitre);
});

/* Un seul état, un seul groupe : le nommer ne dirait que ce que le titre
   vient de dire. La rangée reste nue, comme avant. */
t('tout au même état, aucun libellé de groupe', () => {
  const r = runPage(ARRIVEE);
  assert.deepEqual(r.tourGroupes, []);
  assert.equal(r.tourResume, '', 'rien ne bloque : rien à attendre');
  assert.equal(r.tour.length, 3);
});

/* La bande ne disait pas quand revenir : il fallait lire sept pastilles et
   garder le plus petit délai en tête. */
t('la ligne de résumé dit quand la prochaine se libère', () => {
  const r = runPage({ ...ARRIVEE, skin: occupee });
  assert.equal(r.tourResume, 'prochaine libre dans 2h sur Colonie', r.tourResume);
  assert.deepEqual(r.tourGroupes, ['prêtes à lancer — 2', 'file occupée — 1']);
});

t('deux bloquées : le résumé dit aussi le bout de la tournée', () => {
  const deux = { ...TOUR, tour: { ...TOUR.tour,
    '102': { ...TOUR.tour['102'], bq: Date.now() + 5400000 },
    '103': { ...TOUR.tour['103'], b: { '21': 1 }, bq: Date.now() + 4 * 3600000 } } };
  const r = runPage({ ...ARRIVEE, skin: deux });
  assert.ok(/^prochaine libre dans 2h sur Colonie · tout le tour dans 4h$/.test(r.tourResume), r.tourResume);
});

/* Ce qu'aucun délai ne couvre se compte à part : « dans 3h » et « jamais »
   ne se rangent pas sous le même mot. */
t('une planète hors de portée se compte dans le résumé', () => {
  const loin = { ...TOUR, tour: { ...TOUR.tour,
    '102': { ...TOUR.tour['102'], cost: { '21': [176844, 0, 0] }, st: [0, 0, 0] } } };
  const r = runPage({ ...ARRIVEE, skin: loin });
  assert.equal(r.tourResume, '1 hors de portée', r.tourResume);
  assert.deepEqual(r.tourGroupes, ['prêtes à lancer — 2', 'à payer — 1']);
});

t('une planète qui entre dans la tournée repose la bande', () => {
  const p = runPage(ARRIVEE);
  const pose = p.read().poses;
  const { '103': _, ...moins } = TOUR.tour;
  p.majSkin({ ...TOUR, tour: moins });
  assert.ok(p.read().poses > pose, 'la forme a changé : on repose');
  assert.equal(p.read().tour.length, 2);
});

t('un élément de la page qui porte notre classe n\'est ni réécrit ni retiré', () => {
  // Les pages d'alliance affichent du contenu écrit par d'autres joueurs : la
  // bande ne se retrouve donc pas par sa classe, mais par ce que ce script a
  // posé lui-même.
  const r = runPage({ skin: BANDE, search: '?page=ingame&component=galaxy', intruse: true });
  assert.equal(r.bandes, 2, 'l\'intruse est restée, la nôtre s\'est ajoutée');
  assert.deepEqual(r.bande.ici.map(x => x.txt), ['Espionner 1:140:6']);
});

t('la bande se pose sous l\'illustration, quelle que soit la page', () => {
  // `#middle > .maincontent` est le squelette commun : une seule place, haute,
  // et jamais à l'intérieur d'un encadré du jeu — la page Recherche range ses
  // cases en quatre listes côte à côte, s'y glisser cassait sa mise en page.
  const quatre = runPage({ skin: TOUR, tiles: [['21', '1'], ['124', '113']],
    search: '?page=ingame&component=research&openTech=21' });
  assert.equal(quatre.bandeSousIllustration, true, 'sous l\'illustration, au-dessus des cases');
  assert.equal(quatre.tour.length, 3, 'et la tournée reste');
  assert.equal(runPage(ARRIVEE).bandeSousIllustration, true, 'même place à une seule liste');
});

t('une secousse ne duplique pas la bande', () => {
  const p = runPage({ skin: BANDE, search: '?page=ingame&component=galaxy' });
  p.secousse();
  assert.equal(p.read().bande.ici.length, 1);
});

t('le témoin dit ce que la bande a trouvé à dire', () => {
  assert.ok(/bande=1:0/.test(runPage({ skin: BANDE, search: '?page=ingame&component=galaxy' }).dataset.copilote));
  assert.ok(/bande=0:3/.test(runPage(ARRIVEE).dataset.copilote));
  assert.ok(/bande=rien/.test(runPage({ skin: BANDE, search: '?page=ingame&component=alliance' }).dataset.copilote));
});

t('une feuille de style laissée par l\'ancienne version est remplacée', () => {
  // Recharger l'extension sans recharger la page réinjecte le script : le JS
  // est neuf, le <style> de la version d'avant est toujours là. Laisser
  // l'ancien, c'était des éléments neufs sans aucun style.
  const r = runPage({ skin: BANDE, vieuxStyle: '.copilote-eta{color:red}' });
  assert.ok(/copilote-bande/.test(r.styleTxt), 'la feuille porte les règles de cette version');
  assert.equal(r.styles, 1, 'une seule feuille, pas deux');
});

/* ---------- la largeur ---------- */

const LARGE = { ...BANDE, large: true };
const marques = r => [r.large.cadre, r.large.menu, r.large.jeu, r.large.planetes].join(' ');

t('réglage éteint : la page du jeu n\'est pas touchée', () => {
  const r = runPage({ skin: BANDE });
  assert.ok(!/copilote-large/.test(r.large.racine), 'pas de classe sur la racine');
  assert.ok(!/copilote-c/.test(marques(r)), 'ni cadre ni colonne marqués');
  assert.ok(/large=éteint/.test(r.dataset.copilote), r.dataset.copilote);
});

t('réglage allumé : le cadre et ses trois colonnes sont marqués', () => {
  const r = runPage({ skin: LARGE });
  assert.ok(/copilote-large/.test(r.large.racine));
  assert.ok(/copilote-cadre/.test(r.large.cadre), 'le cadre se déduit des deux bords');
  assert.ok(/copilote-col-menu/.test(r.large.menu));
  assert.ok(/copilote-col-jeu/.test(r.large.jeu));
  assert.ok(/copilote-col-planetes/.test(r.large.planetes));
  assert.ok(/large=posé/.test(r.dataset.copilote), r.dataset.copilote);
});

t('une secousse ne remarque pas deux fois le cadre', () => {
  const r = runPage({ skin: LARGE });
  r.secousse();
  assert.equal((r.read().large.cadre.match(/copilote-cadre/g) || []).length, 1);
});

t('page que le copilote ne connaît pas : la largeur ne s\'y pose pas', () => {
  const r = runPage({ skin: LARGE, search: '?page=ingame&component=alliance' });
  assert.ok(!/copilote-large/.test(r.large.racine), 'du contenu écrit par d\'autres joueurs reste intact');
  assert.ok(!/copilote-c/.test(marques(r)));
  assert.ok(/large=hors page/.test(r.dataset.copilote), r.dataset.copilote);
});

t('sans liste de planètes, le cadre ne se déduit pas et rien ne bouge', () => {
  const r = runPage({ skin: LARGE, planetList: false });
  assert.ok(!/copilote-c/.test(marques(r)), 'tout ou rien : pas de mise en page à moitié posée');
  assert.ok(/large=sans planètes/.test(r.dataset.copilote), r.dataset.copilote);
});

t('ce qui n\'est pas une colonne prend sa propre ligne', () => {
  // le jeu range sa barre de ressources dans le cadre : dans un flanc, elle
  // se retrouvait collée au menu
  const r = runPage({ skin: LARGE });
  assert.ok(/copilote-rang/.test(r.large.haut), 'la barre du jeu barre la rangée');
  assert.ok(!/copilote-rang/.test(marques(r)), 'aucune colonne ne la prend');
});

t('la feuille porte les règles de la largeur', () => {
  assert.ok(/copilote-col-jeu/.test(runPage({ skin: LARGE }).styleTxt));
});

/* ---------- notre dessin de la page ---------- */

const AVEC_PEAU = { ...BANDE, peau: true };
const SUR_RESSOURCES = { search: '?page=ingame&component=supplies', tiles: [1, 2, 4] };

t('réglage éteint : le jeu garde sa page', () => {
  const r = runPage({ ...SUR_RESSOURCES, skin: BANDE });
  assert.ok(!r.peau.posee, 'aucun panneau');
  assert.ok(!/copilote-peau/.test(r.peau.racine), 'rien de poussé hors de l\'écran');
  assert.ok(/peau=éteinte/.test(r.dataset.copilote), r.dataset.copilote);
});

t('réglage allumé : une case dessinée par case du jeu', () => {
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.ok(r.peau.posee, 'le panneau est posé');
  assert.equal(r.peau.cases, 3, 'trois cases lues, trois cases dessinées');
  assert.ok(/copilote-peau/.test(r.peau.racine), 'la page du jeu part hors de l\'écran');
  assert.ok(/peau=posée/.test(r.dataset.copilote), r.dataset.copilote);
});

t('une case en chantier dit son temps sur la carte', () => {
  /* Le jeu l'écrit en tout petit, en blanc, sur l'image : illisible d'un
     coup d'œil. La carte le dit en bas, en clair. */
  /* L'heure est figée le temps de la mesure : sinon la milliseconde écoulée
     entre la pose et la lecture fait basculer la minute affichée. */
  const vraie = Date.now;
  Date.now = () => 1700000000000;
  let r;
  try { r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU,
    enChantier: { tech: 2, fin: 1700000000 + 5400, vise: 13 } }); }
  finally { Date.now = vraie; }
  assert.deepEqual(r.peau.chantiers, ['→ 13 · 1 h 30']);
});

t('sans chantier, aucune carte ne porte de minuteur', () => {
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.deepEqual(r.peau.chantiers, []);
});

t('les groupes du jeu restent des groupes', () => {
  /* Recherche range ses cases en quatre encadrés, le Chantier en deux :
     tout aplatir en une grille perdrait ce que le jeu dit de ses cases. */
  const r = runPage({ ...SUR_RESSOURCES, tiles: [[1, 2], [3, 4, 12]], skin: AVEC_PEAU });
  assert.equal(r.peau.grilles, 2, 'deux listes, deux grilles');
  assert.equal(r.peau.cases, 5, 'et les cinq cases');
});

t('le nom d\'une case vient du jeu, pas de notre table', () => {
  /* Notre table ne connaît que trente-quatre cases ; le jeu en nomme des
     dizaines d'autres, formes de vie comprises, et dans la langue du joueur. */
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.deepEqual(r.peau.noms, ['Case 1', 'Case 2', 'Case 4'],
    'l\'étiquette du jeu gagne, et son niveau entre parenthèses ne la suit pas');
});

t('le titre de la page vient du jeu', () => {
  // faute d'en-tête dans cette page de test, c'est l'entrée du menu qui mène
  // ici — dans les mots du jeu, jamais dans les nôtres
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.equal(r.peau.titre, 'Ressources');
});

t('une secousse ne repose pas le panneau', () => {
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  r.secousse();
  assert.equal(r.read().peau.cases, 3, 'toujours trois cases, pas six');
});

t('page à cases sans case : le contenu du jeu reste entier', () => {
  /* La peau ne sait dessiner que ce qu'elle a lu. Sans case, elle s'en tient
     au cadre — rien ne part hors de l'écran derrière un panneau absent. */
  const r = runPage({ search: '?page=ingame&component=supplies', skin: AVEC_PEAU });
  assert.ok(!r.peau.posee, 'aucun panneau');
  assert.ok(!/copilote-peau-grille/.test(r.peau.racine), 'le contenu du jeu reste en place');
  assert.ok(/peau=cadre/.test(r.dataset.copilote), r.dataset.copilote);
});

t('Galaxie prend le cadre, pas la grille', () => {
  /* Son contenu est un tableau du jeu : il reste entier, et la page reçoit
     le rail, les planètes et la colonne. */
  const r = runPage({ skin: AVEC_PEAU, tiles: [1, 2], search: '?page=ingame&component=galaxy' });
  assert.ok(!r.peau.posee, 'aucune grille');
  assert.ok(!/copilote-peau-grille/.test(r.peau.racine), 'son tableau reste en place');
  assert.ok(r.peau.rail.length > 0, 'mais le rail est là');
  assert.ok(r.peau.planetesEnHaut, 'et les planètes aussi, en haut');
  assert.ok(/peau=cadre/.test(r.dataset.copilote), r.dataset.copilote);
});

t("la page publie le lien du jeu vers le paramétrage de la production", () => {
  /* Cette adresse-là, le copilote ne la devine pas : selon la version elle
     s'ouvre par `component=` ou par `page=`. Il lit celle que la page affiche,
     mais il la reconstruit : la forme du paramètre, rien d'autre. */
  const lien = 'https://s1-fr.ogame.gameforge.com/game/index.php?page=resourceSettings&cp=33657643';
  const r = runPage({ search: '?page=ingame&component=supplies', prodHref: lien });
  assert.equal(r.envois().find(m => m.type === 'snapshot').data.prodUrl,
    'https://s1-fr.ogame.gameforge.com/game/index.php?page=resourceSettings');
});

t("un lien pi\u00e9g\u00e9 dans la page du jeu n'est pas suivi", () => {
  /* Le DOM contient ce que d'autres joueurs y \u00e9crivent : messages, pages
     d'alliance. Un lien qui porte le bon mot ne suffit pas \u00e0 \u00eatre cru. */
  const pieges = [
    'https://evil.example/game/index.php?page=resourceSettings',
    'https://s1-fr.ogame.gameforge.com/game/index.php?page=ingame&component=fleetdispatch&x=resourcesettings',
    'https://s1-fr.ogame.gameforge.com/forum/index.php?page=resourceSettings'
  ];
  for (const lien of pieges) {
    const r = runPage({ search: '?page=ingame&component=supplies', prodHref: lien });
    assert.equal(r.envois().find(m => m.type === 'snapshot').data.prodUrl, null, lien);
  }
});

t("la page dit si l'univers a des formes de vie, d'après le menu du jeu", () => {
  const avec = runPage({ search: '?page=ingame&component=supplies', menuLf: true });
  assert.strictEqual(avec.envois().find(m => m.type === 'snapshot').data.lfMenu, true);
  const sans = runPage({ search: '?page=ingame&component=supplies' });
  assert.strictEqual(sans.envois().find(m => m.type === 'snapshot').data.lfMenu, false);
});

t("le prix d'une case part dès qu'il arrive, sans attendre le battement", () => {
  /* Le jeu charge le panneau de détail après la page. Tant que son prix
     attendait le tour de garde de cinq secondes, un relevé qui laisse quatre
     secondes à une page ne le voyait jamais : il ouvrait la case et repartait
     avant qu'elle réponde. */
  const r = runPage({ search: '?page=ingame&component=lfbuildings&openTech=11101' });
  const avant = r.envois().filter(m => m.type === 'snapshot').length;
  r.detailArrive(11101, [['resource metal', 1200], ['resource crystal', 600]]);
  const envois = r.envois().filter(m => m.type === 'snapshot');
  assert.ok(envois.length > avant, "l'arrivée du panneau doit partir tout de suite");
  const lf = envois[envois.length - 1].data.lf[11101];
  assert.deepEqual(lf.cost, [1200, 600, 0]);
});

t("une secousse qui ne touche pas au panneau de détail n'envoie rien de plus", () => {
  // sinon chaque remuement de la page du jeu referait tout l'instantané
  const r = runPage({ search: '?page=ingame&component=lfbuildings' });
  const avant = r.envois().filter(m => m.type === 'snapshot').length;
  r.secousse();
  assert.equal(r.envois().filter(m => m.type === 'snapshot').length, avant);
});

t("une page sans ce lien n'en invente pas", () => {
  const r = runPage({ search: '?page=ingame&component=supplies' });
  assert.equal(r.envois().find(m => m.type === 'snapshot').data.prodUrl, null);
});

t('la page Flotte est habillée, pas redessinée', () => {
  /* Ses cases portent le champ qui dit combien de vaisseaux partent : refaire
     ce champ, ce serait refaire l'envoi. On les reconnaît à ça, et on ne fait
     que les habiller — le formulaire du jeu reste le sien. */
  const r = runPage({ skin: AVEC_PEAU, tiles: [1, 2], champsFlotte: true,
    search: '?page=ingame&component=fleetdispatch' });
  assert.ok(/cp-flotte/.test(r.peau.flotte), 'la liste est habillée');
  assert.ok(/copilote-peau-flotte/.test(r.peau.racine));
  assert.ok(!r.peau.posee, 'et le contenu du jeu reste le sien');
});

t('sans champ dans les cases, rien ne se prend pour la Flotte', () => {
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.ok(!/cp-flotte/.test(r.peau.flotte));
  assert.ok(!/copilote-peau-flotte/.test(r.peau.racine));
});

t('Empire prend le cadre, que le copilote n\'y conseille rien', () => {
  /* Empire n'est pas une page où le copilote parle — elle n'est pas dans sa
     liste — mais le cadre, lui, n'a rien à dire : il range. */
  const r = runPage({ skin: AVEC_PEAU, search: '?page=ingame&component=empire' });
  assert.ok(/copilote-large/.test(r.peau.racine), 'la largeur vient avec le cadre');
  assert.ok(r.peau.rail.length > 0, 'et le rail aussi');
  assert.ok(!r.peau.posee, 'son tableau reste au jeu');
  assert.ok(/peau=cadre/.test(r.dataset.copilote), r.dataset.copilote);
});

t('une page hors de la peau ne reçoit rien', () => {
  // Recherche des formes de vie : des cases sans niveau ni panneau de détail
  const r = runPage({ skin: AVEC_PEAU, tiles: [1, 2], search: '?page=ingame&component=lfresearch' });
  assert.ok(!r.peau.posee);
  assert.ok(!/copilote-peau/.test(r.peau.racine));
  assert.ok(!r.peau.planetesEnHaut, 'ses planètes restent au jeu');
  assert.ok(/peau=hors page/.test(r.dataset.copilote), r.dataset.copilote);
});

t('la peau amène la largeur sur la page qu\'elle redessine', () => {
  // réglage de largeur éteint : la grille tiendrait sur trois colonnes
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.ok(/copilote-large/.test(r.large.racine), 'la largeur vient avec');
  assert.ok(/copilote-cadre/.test(r.large.cadre));
  assert.ok(/large=posé/.test(r.dataset.copilote), r.dataset.copilote);
});

t('ailleurs, la peau n\'impose aucune largeur', () => {
  const r = runPage({ skin: AVEC_PEAU, tiles: [1, 2], search: '?page=ingame&component=lfresearch' });
  assert.ok(!/copilote-large/.test(r.large.racine), 'le réglage seul décide');
  assert.ok(/large=éteint/.test(r.dataset.copilote), r.dataset.copilote);
});

t('le panneau de détail du jeu survit à une repeinture', () => {
  /* Il est emprunté au jeu, pas recopié : le jeter avec l'ancien dessin le
     faisait disparaître de la page pour de bon, et plus aucune case ne
     s'ouvrait. */
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.ok(r.peau.detailDansPanneau, 'emprunté');
  // le plan change : la peau se repeint entièrement
  r.majSkin({ ...AVEC_PEAU, hints: { 33657643: { 1: 15 } } });
  assert.ok(r.read().detailDansPanneau !== false, 'toujours dans la page');
  assert.ok(r.read().peau.detailDansPanneau, 'et toujours dans le panneau');
});

t('la ligne des mouvements de flotte reste chez le jeu', () => {
  // elle ne déménage plus : la peau la fait taire, et la colonne le dit mieux
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.ok(r.peau.notifRendue, 'elle est restée à sa place');
});

t('la peau retirée, le panneau de détail rentre chez le jeu', () => {
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  r.scriptNeuf();
  assert.ok(r.read().peau.detailRendu, 'remis là où on l\'a pris');
});

t('une ligne dit quoi, où et quand — le pourquoi va à l\'infobulle', () => {
  /* Dans trois cents pixels, deux phrases d'explication par action noyaient
     les actions. Elles restent lisibles au survol. */
  const avec = { ...AVEC_PEAU, colonne: [{ what: 'Mine de métal 24', ou: 'Mère',
    quand: 'vers 14 h', why: 'Meilleur rendement : amorti en 6h 42m', url: 'x' }] };
  const r = runPage({ ...SUR_RESSOURCES, skin: avec });
  assert.deepEqual(r.peau.actes, ['Mine de métal 24 | Mère · vers 14 h'],
    'le pourquoi n\'est pas dans la ligne');
});

t('les planètes nommées dans la phrase prennent leur couleur', () => {
  /* « Ramène 34 grands transporteurs de Tarpin land vers Caribou Land » ne
     met aucune planète dans son champ « où » : elles sont dans le texte, et
     c'est là qu'il faut aller les chercher. */
  const avec = { ...AVEC_PEAU, teintes: { 'Tarpin land': 3, 'Caribou Land': 0 },
    colonne: [{ what: 'Ramène 34 grands transporteurs de Tarpin land vers Caribou Land',
      ou: '', quand: '', why: '', url: '' }] };
  const r = runPage({ ...SUR_RESSOURCES, skin: avec });
  assert.deepEqual(r.peau.actes,
    ['Ramène 34 grands transporteurs de Tarpin land vers Caribou Land | '],
    'le texte reste entier, seulement découpé');
  assert.deepEqual(r.peau.teintes, ['var(--p3)', 'var(--p0)']);
});

t('une planète garde sa couleur en passant dans la page', () => {
  /* Le panneau donne à chaque planète une teinte selon son rang ; la page
     reprend ce rang, pour qu'une planète se reconnaisse sans se lire. */
  const avec = { ...AVEC_PEAU, colonne: [
    { what: 'Mine de métal 24', ou: 'Mère', quand: '', why: '', url: '', pc: 0 },
    { what: 'Hangar 9', ou: 'P4', quand: '', why: '', url: '', pc: 3 },
    { what: 'Recherche', ou: '', quand: 'vers 14 h', why: '', url: '' }] };
  const r = runPage({ ...SUR_RESSOURCES, skin: avec });
  assert.deepEqual(r.peau.teintes, ['var(--p0)', 'var(--p3)'],
    'une ligne sans planète n\'a pas de teinte');
});

t('tout le haut tient dans une seule bande', () => {
  /* Chaque morceau avait son cadre : six boîtes sur deux lignes au lieu
     d'une barre. La ligne du portail, elle, reste au jeu. */
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.deepEqual(r.peau.barre,
    ['resourcesbarcomponent', 'planetList', 'cp-bouton'],
    'ce qui monte dans la bande, et rien d\'autre');
});

t('la bande rend ses pièces quand la peau se retire', () => {
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  r.scriptNeuf();
  const apres = r.read();
  assert.deepEqual(apres.peau.barre, [], 'la bande est partie');
  assert.ok(apres.peau.planetesRendues, 'et les planètes sont rentrées chez le jeu');
  assert.ok(apres.peau.notifRendue, 'comme la ligne des mouvements');
});

t('le thème clair se pose et se retire avec la peau', () => {
  const clair = runPage({ ...SUR_RESSOURCES, skin: { ...AVEC_PEAU, clair: true } });
  assert.ok(/copilote-clair/.test(clair.peau.racine), 'le jour');
  const sombre = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.ok(!/copilote-clair/.test(sombre.peau.racine), 'la nuit par défaut');
  clair.scriptNeuf();
  assert.ok(!/copilote-clair/.test(clair.read().peau.racine), 'et rien ne reste');
});

/* Le panneau et la page du jeu sont le même copilote : la peau choisie dans
   l'un habille ce que l'autre pose. Elle voyage dans le même objet que les
   autres réglages d'allure, et se pose sur <html>, d'où les jetons tombent. */
t("l'habillage du panneau habille aussi la page du jeu", () => {
  const r = runPage({ ...SUR_RESSOURCES, skin: { ...AVEC_PEAU, panneau: 'hud' } });
  assert.equal(r.peau.habillage, 'hud');
  assert.equal(r.peau.pageVue, 'supplies', 'la page ouverte, dont « une couleur par page » tire sa teinte');
  // rien de publié : on retombe sur Relief, comme le panneau
  assert.equal(runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU }).peau.habillage, 'relief');
});

t('la feuille ne connaît plus aucune couleur en dur', () => {
  /* Deux thèmes ne tiennent que si les règles parlent de jetons. Une couleur
     écrite au milieu d'une règle serait juste dans l'un et fausse dans
     l'autre, et personne ne le verrait avant de basculer. */
  const feuille = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU }).styleTxt;
  const peau = feuille.slice(feuille.indexOf('html{--cp-fond'));
  const regles = peau.replace(/--[a-z0-9-]+:[^;}]+/g, '');
  const dures = regles.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) || [];
  assert.deepEqual(dures, [], 'couleurs hors des jetons : ' + dures.join(' '));
});

t('le bouton du panneau se pose dans la rangée du haut', () => {
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.ok(r.peau.bouton, 'posé');
  r.scriptNeuf();
  assert.ok(!r.read().peau.bouton, 'et retiré quand la peau se retire');
});

t('la colonne de droite porte ce que le panneau sait', () => {
  // le joueur n'a plus d'onglet à ouvrir pour savoir quoi faire
  const avec = { ...AVEC_PEAU, colonne: [
    { what: 'Mine de métal 24', ou: 'Mère', quand: 'vers 14 h 10', why: '', url: 'x?component=supplies' },
    { what: 'Hangar 9', ou: 'P2', quand: '', why: 'Il manque 48K cristal', url: '', gris: true }] };
  const r = runPage({ ...SUR_RESSOURCES, skin: avec });
  assert.equal(r.peau.colonne, 2, 'une ligne par action');
  assert.deepEqual(r.peau.cartes, ["aujourd'hui"], 'une seule carte : rien à faire sur cette page');
});

t('ce qui se fait ici a sa propre carte', () => {
  /* La page d'abord, la journée ensuite : le joueur lit la première carte
     et agit, sans trier ce qui le concerne ici de ce qui l'attend ailleurs. */
  const avec = { ...AVEC_PEAU,
    band: { pages: { supplies: [{ what: 'Mine de métal 24', ou: 'Mère', quand: 'vers 14 h', why: '', url: 'x' }] } },
    colonne: [{ what: 'Hangar 9', ou: 'P2', quand: '', why: '', url: '' }] };
  const r = runPage({ ...SUR_RESSOURCES, skin: avec });
  assert.deepEqual(r.peau.cartes, ['à faire ici', "aujourd'hui"]);
  assert.equal(r.peau.colonne, 2);
});

t('rien à faire : pas de colonne vide', () => {
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.equal(r.peau.colonne, 0, 'une colonne sans ligne ne se pose pas');
});

t('les planètes montent sur la ligne du haut', () => {
  /* Dans un flanc étroit, six lignes obligeaient à défiler pour en atteindre
     une ; en haut, elles tiennent sur une ligne, chacune à un clic. */
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.ok(r.peau.planetesEnHaut, 'la liste du jeu est sur la rangée du haut');
  assert.ok(/copilote-planetes-haut/.test(r.peau.racine), 'son flanc peut se fermer');
});

t('la peau retirée, les planètes retournent chez le jeu', () => {
  // la liste appartient au jeu : la garder laisserait sa page sans planètes
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  r.scriptNeuf();
  const apres = r.read();
  assert.ok(apres.peau.planetesRendues, 'remise là où on l\'a prise');
  assert.ok(!/copilote-planetes-haut/.test(apres.peau.racine));
});

t('sans peau, le flanc des planètes reste au jeu', () => {
  const r = runPage({ ...SUR_RESSOURCES, skin: BANDE });
  assert.ok(!r.peau.planetesEnHaut);
  assert.ok(r.peau.planetesRendues, 'elles n\'ont pas bougé');
});

t('le rail range les pages par familles', () => {
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU }).peau.rail;
  // par préfixe : le lien porte aussi sa touche
  const i = n => r.findIndex(x => x.startsWith(n));
  assert.ok(i('cp-fam:construire') >= 0 && i('cp-lien:Ressources') > i('cp-fam:construire'),
    'Ressources est sous « construire »');
  assert.ok(i('cp-fam:voler') < i('cp-lien:Galaxie'), 'Galaxie est sous « voler »');
  // une page qu'aucune famille ne connaît tombe à la fin, elle ne disparaît pas
  assert.ok(i('cp-fam:autres') >= 0 && i('cp-lien:Nouveauté') > i('cp-fam:autres'),
    'la page inconnue est sous « autres »');
});

t('chaque page du rail dit sa touche', () => {
  // la lettre est à nous, l'adresse vient du menu du jeu
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU }).peau.rail;
  assert.ok(r.includes('cp-lien:Ressources[R]'), r.join(' | '));
  assert.ok(r.includes('cp-lien:Galaxie[G]'));
  // une page qu'on ne connaît pas garde son lien, sans touche
  assert.ok(r.includes('cp-lien:Nouveauté'));
});

t('un menu sans libellé ne devient pas un rail vide', () => {
  // sans rail, le joueur n'aurait plus de quoi quitter la page : on laisse
  // alors le menu du jeu en place, même sous la peau
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU, menuMuet: true });
  assert.equal(r.peau.rail.length, 0, 'aucun rail');
  assert.ok(!/copilote-rail-hote/.test(r.large.menu), 'le menu du jeu reste');
  assert.ok(!r.peau.planetesEnHaut, 'et les planètes ne déménagent pas');
});

t('un script plus neuf arrive : l\'ancien se retire', () => {
  /* Recharger l'extension sans recharger la page laisse l'ancien script en
     vie dans son monde : son observateur bat encore. Sans retrait, le joueur
     voyait deux panneaux et deux bandes se répondre. */
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  assert.ok(r.peau.posee, 'posé avant');
  r.scriptNeuf();
  const apres = r.read();
  assert.ok(!apres.peau.posee, 'le panneau est retiré');
  assert.ok(!/copilote-peau|copilote-large/.test(apres.peau.racine), 'les classes partent');
  assert.equal(apres.bandes, 0, 'la bande aussi');
});

t('retiré, l\'ancien script ne redessine plus', () => {
  // son observateur continue de battre : une secousse ne doit rien reposer
  const r = runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU });
  r.scriptNeuf();
  r.secousse();
  assert.ok(!r.read().peau.posee, 'rien ne revient');
});

t('la feuille porte les règles de la peau', () => {
  assert.ok(/copilote-peau-panneau/.test(runPage({ ...SUR_RESSOURCES, skin: AVEC_PEAU }).styleTxt));
});

/* ---------- ouvrir la bonne page du jeu ---------- */

/** Un empire synchronisé : on connaît le serveur et l'identifiant des planètes. */
const relie = s => {
  s.host = 's199-fr.ogame.gameforge.com';
  s.planets[0].gid = '33601';
  s.planets[1].gid = '33602';
};

t('une mine renvoie sur la page Ressources de sa planète', () => {
  const g = app(relie);
  assert.equal(g.actGo({ kind: 'b', k: 'metal', p: 1 }),
    'https://s199-fr.ogame.gameforge.com/game/index.php?page=ingame&component=supplies&cp=33602');
});

t('le plan se traduit en indices pour la page du jeu', () => {
  const g = app(relie);
  const h = g.planHints([
    { kind: 'b', k: 'metal', lvl: 9, p: 1 },
    { kind: 't', k: 'astro', lvl: 4, p: 0 },
    { kind: 'lf', id: 11101, lvl: 25, p: 0 },
    { kind: 'expo', p: 0 }
  ]);
  // Rangés par planète du jeu, puis par identifiant de tuile, et la valeur est
  // le niveau visé : la page du jeu décide comment l'écrire dans ses tuiles.
  assert.equal(h['33602']['1'], 9, 'la mine de métal porte l\'identifiant 1');
  assert.equal(h['33601']['124'], 4, 'Astrophysique porte le 124');
  assert.equal(h['33601']['11101'], 25);
  assert.deepEqual(Object.keys(h['33601']).sort(), ['11101', '124'],
    'une expédition n\'a pas de tuile à surligner');
});

t('le d\u00e9lai se d\u00e9duit du manque et du d\u00e9bit', () => {
  const g = app();
  assert.equal(g.etaSecs(0, 1000), 0, 'rien ne manque : c\'est payable tout de suite');
  assert.equal(g.etaSecs(2000, 1000), 7200, '2 000 manquants à 1 000/h');
  // une production nulle ou négative n'y arrivera jamais : il faut le dire
  // plutôt que d'afficher un délai rassurant et faux.
  assert.equal(g.etaSecs(2000, 0), Infinity);
  assert.equal(g.etaSecs(2000, -50), Infinity);
});

t('le d\u00e9lai s\'\u00e9crit en heures et minutes', () => {
  const g = app();
  assert.equal(g.hms(7200), '2h 00m');
  // arrondi vers le haut : le bouton doit être cliquable avant l'heure dite
  assert.equal(g.hms(90), '2m');
  assert.equal(g.hms(30), '1m');
  assert.equal(g.hms(Infinity), 'jamais à ce rythme');
});

t('les d\u00e9bits de chaque plan\u00e8te partent vers la page', () => {
  const g = app(relie);
  const r = g.gameSkin([]).rates;
  assert.ok(r['33601'] && r['33601'][0] > 0, 'la planète mère produit du métal');
  assert.equal(r['33601'].length, 3, 'métal, cristal, deutérium');
});

t('un r\u00e9glage de mode reste un mot, les autres des nombres', () => {
  const g = app();
  // Le piège : un mode converti en nombre vaut 0, et le réglage ne prend
  // jamais sans que rien ne le dise.
  assert.equal(g.dayValue('research', 'first', 'normal'), 'first');
  assert.equal(g.dayValue('lf', 'off', 'after'), 'off');
  assert.equal(g.dayValue('focus', 'eco', 'ecocol'), 'eco');
  // un mot hors liste ne remplace pas ce qui est en place
  assert.equal(g.dayValue('research', 'nawak', 'first'), 'first');
  assert.equal(g.dayValue('interval', '90', 60), 90);
  // une heure hors du jour ne remplace pas ce qui est en place
  assert.equal(g.dayValue('nightStart', '-3', 23), 23);
});

t('les donneurs voyagent avec les d\u00e9bits', () => {
  const g = app(relie);
  // La mère a les transporteurs : c'est elle qui peut livrer la colonie.
  const d = g.gameSkin([]).donors['33602'];
  assert.ok(d && d.length, 'personne ne peut livrer la colonie');
  assert.equal(d[0].n, 'Planète mère');
  assert.ok(d[0].sec[0] > 0 && d[0].sec[1] > 0, 'un temps de vol par type de transporteur');
  assert.ok(d[0].st[0] > 0, 'son stock de métal voyage aussi');
  // La colonie n'a aucun transporteur à quai, et c'est le cas courant : elle
  // donne quand même, avec l'aller à vide depuis la planète qui les porte.
  const vers = g.gameSkin([]).donors['33601'];
  assert.ok(vers && vers.length, 'une colonie sans transporteur doit pouvoir donner');
  assert.equal(vers[0].n, 'Colonie');
  assert.equal(vers[0].base, 'Planète mère', 'la flotte vient de là');
  assert.ok(vers[0].out[0] > 0 && vers[0].out[1] > 0, 'le vol à vide est chiffré');
  assert.ok(vers[0].lc > 0, 'les vaisseaux comptés sont ceux de la base');
  assert.equal(d[0].base, null, 'la mère a les siens sur place : pas d\'aller à vide');
  assert.deepEqual(d[0].out, [0, 0]);
});

t('la soute publi\u00e9e est celle des transporteurs', () => {
  const g = app(relie);
  const c = g.gameSkin([]).cargo;
  assert.ok(c[0] >= 25000 && c[1] >= 5000, c.join('/'));
});

t('le panneau publie bien la charge utile en se rendant', () => {
  // Le tout est dans un try/catch pour ne jamais casser l'affichage : donc
  // une erreur ici serait silencieuse, et la page resterait vide sans
  // qu'aucune alerte ne le dise. D'où ce test de bout en bout.
  const g = app(relie, SOIR, null, true);
  g.REFRESH.today();
  const skin = g.stored().skin;
  assert.ok(skin, 'rien n\'a été publié : la page du jeu n\'aurait aucun repère');
  assert.ok(skin.rates['33601'], 'les débits de la planète mère');
  assert.ok(Object.keys(skin.hints).length, 'au moins un repère à poser');
});

t('l\'\u00e9puration du jeu est \u00e9teinte par d\u00e9faut', () => {
  // On ne touche pas à l'affichage du jeu sans que le joueur l'ait demandé.
  const g = app(relie);
  assert.equal(g.gameSkin([]).lean, false);
});

t('une fois demand\u00e9e, l\'\u00e9puration part avec les indices', () => {
  const g = app(s => { relie(s); s.settings.lean = true; });
  const skin = g.gameSkin([{ kind: 'b', k: 'metal', lvl: 9, p: 1 }]);
  assert.equal(skin.lean, true);
  assert.equal(skin.hints['33602']['1'], 9, 'les indices voyagent dans le même envoi');
});

t('sans plan\u00e8te connue du jeu, aucun indice', () => {
  // avant la première synchro il n'y a pas d'identifiant : surligner au
  // hasard vaudrait mieux ne rien surligner du tout.
  const g = app();
  assert.deepEqual(g.planHints([{ kind: 'b', k: 'metal', lvl: 9, p: 0 }]), {});
});

/* ---------- la tournée d'une tuile ---------- */

/** Deux planètes nommées par le jeu, chantier 4 et 0. */
const nommees = s => { s.planets[0].gid = '101'; s.planets[1].gid = '102'; };

t('la tournée donne le nom, le niveau et le coût du niveau suivant', () => {
  const g = app(nommees);
  const t1 = g.tourData();
  assert.equal(t1['101'].n, 'Planète mère');
  assert.equal(t1['101'].b['21'], 4);            // chantier spatial
  assert.deepEqual(t1['101'].cost['21'], g.levelCost(g.B.shipyard, 5));
  assert.equal(t1['102'].b['21'], 0);
});

t('la recherche en cours se publie pour tout l\'empire', () => {
  // Une recherche n'a pas de planète : elle ne peut pas voyager dans la
  // tournée, rangée par planète, et pourtant c'est elle qui tient les labos.
  const g = app(s => { nommees(s); s.timers = [
    { id: 'r', game: true, queue: 'research', kind: 't', k: 'energy', lvl: 5, pid: null, end: SOIR + 600000 }
  ]; });
  assert.equal(g.gameSkin([]).rq, SOIR + 600000);
  assert.equal(g.gameSkin([]).tour['101'].bq, 0, 'elle n\'est la file d\'aucune planète');
});

t('une planète que le jeu n\'a pas nommée est absente', () => {
  assert.deepEqual(Object.keys(app(s => { s.planets[0].gid = '101'; }).tourData()), ['101']);
});

t('la fin de file de bâtiment est publiée, par planète', () => {
  const g = app(s => { nommees(s); s.timers = [
    { id: 'a', game: true, queue: 'building', kind: 'b', k: 'metal', lvl: 15, pid: 'mere', end: SOIR + 600000 },
    { id: 'b', game: true, queue: 'lfbuilding', kind: 'x', k: 'other', label: 'Case de vie', pid: 'colo', end: SOIR + 900000 }
  ]; });
  const t1 = g.tourData();
  assert.equal(t1['101'].bq, SOIR + 600000);
  assert.equal(t1['101'].lfq, 0);
  assert.equal(t1['102'].lfq, SOIR + 900000);
});

t('une clé de planète hostile ne crée pas de pastille', () => {
  const g = app(s => { nommees(s); s.planets[1].gid = '__proto__'; });
  assert.deepEqual(Object.keys(g.tourData()), ['101']);
});

t('la file des recherches de forme de vie part à part', () => {
  const g = app(s => { nommees(s); s.timers = [
    { id: 'c', game: true, queue: 'lfresearch', kind: 'x', k: 'other', label: 'Étude', pid: 'mere', end: SOIR + 1200000 }
  ]; });
  assert.equal(g.tourData()['101'].lfr, SOIR + 1200000);
  assert.equal(g.tourData()['101'].lfq, 0);
});

t('une planète que la synchro vient de révéler ne publie aucun niveau', () => {
  // Le jeu nomme toutes les planètes dès la première page lue, mais ne dit les
  // niveaux que de celle qu'on regarde : les autres sont à zéro par défaut, et
  // « 0 → 1 » enverrait monter ce qui est peut-être au niveau 8.
  const g = app(nommees);
  g.applyGame({ meta: { host: 's1.ogame.gameforge.com' }, planets: {
    '101': { name: 'Planète mère', coords: '1:142:8', b: { metal: 14 } },
    '999': { name: 'Colonie neuve', coords: '1:142:3' }
  } });
  const t1 = g.tourData();
  assert.equal(t1['101'].b['1'], 14, 'la planète lue publie ses niveaux');
  assert.deepEqual(t1['999'].b, {}, 'la planète jamais lue n\'en publie aucun');
  assert.deepEqual(t1['999'].cost, {});
});

t('un prix de forme de vie estimé ne voyage pas comme un fait', () => {
  const g = app(s => { nommees(s);
    s.planets[0].lf = { '11101': { lvl: 3, seen: { 1: [100, 50, 0], 2: [200, 100, 0] } } }; });
  const e = g.tourData()['101'];
  assert.equal(e.b['11101'], 3, 'le niveau, lui, est connu');
  assert.equal(e.cost['11101'], undefined, 'un prix estimé ne grise personne');
});

t('le plan se range par page du jeu', () => {
  const g = app(relie);
  const pages = g.gameSkin([
    { kind: 'b', k: 'metal', lvl: 9, p: 1, what: 'Mine de métal 9',
      why: 'Première en amortissement', q: 'Bâtiment · Colonie' },
    { kind: 'def', p: 0, what: 'Construire 12 Lanceurs de missiles', q: 'Défense · Planète mère' }
  ]).band.pages;
  assert.equal(pages.supplies[0].what, 'Mine de métal 9');
  assert.equal(pages.supplies[0].ou, 'Colonie', 'la planète se dit, le lien n\'est pas lisible');
  assert.equal(pages.supplies[0].why, 'Première en amortissement');
  assert.ok(/cp=33602/.test(pages.supplies[0].url), pages.supplies[0].url);
  assert.equal(pages.defenses[0].what, 'Construire 12 Lanceurs de missiles');
});

t('une mission du jour se range sur la page où elle se fait', () => {
  const pages = app(relie).gameSkin([],
    [{ id: 'raid', q: 'Pillage', what: 'Espionner 1:140:6', how: [] }]).band.pages;
  assert.equal(pages.galaxy[0].what, 'Espionner 1:140:6');
});

t('quatre lignes au plus par page : au-delà, la bande redevient une liste', () => {
  const acts = [1, 2, 3, 4, 5, 6].map(n => ({ kind: 'b', k: 'metal', lvl: n, p: 0,
    what: 'Mine de métal ' + n, q: 'Bâtiment · Planète mère' }));
  assert.equal(app(relie).gameSkin(acts).band.pages.supplies.length, 4);
});

t('ce que le plan attend faute de ressources se dit aussi, avec sa date', () => {
  // Un empire dont rien n'est payable n'a aucune action lançable : sans les
  // attentes, la bande serait vide sur toutes les pages.
  const waits = [{ kind: 'b', k: 'metal', p: 1, q: 'Bâtiment · Colonie',
    what: 'Mine de métal 9', eta: 3600, miss: [1000, 0, 0] }];
  const l = app(relie).gameSkin([], [], waits).band.pages.supplies[0];
  assert.equal(l.what, 'Mine de métal 9');
  assert.equal(l.ou, 'Colonie');
  assert.ok(/vers \d\d:\d\d/.test(l.quand), l.quand);
  assert.equal(l.gris, true, 'une attente se grise : ce n\'est pas lançable');
  assert.ok(/manque 1 ?000 métal/.test(l.why.replace(/\u202f|\u00a0/g, ' ')), l.why);
});

t('une attente que la production ne comblera pas se dit à livrer', () => {
  const waits = [{ kind: 'b', k: 'metal', p: 1, q: 'Bâtiment · Colonie',
    what: 'Mine de métal 9', eta: Infinity, miss: [1000, 0, 0] }];
  assert.equal(app(relie).gameSkin([], [], waits).band.pages.supplies[0].quand, 'à faire livrer');
});

t('le lançable passe devant ce qui attend', () => {
  const acts = [{ kind: 'b', k: 'metal', lvl: 9, p: 0, what: 'Mine de métal 9', q: 'Bâtiment · Mère' }];
  const waits = [{ kind: 'b', k: 'crystal', p: 1, q: 'Bâtiment · Colonie',
    what: 'Mine de cristal 8', eta: 3600, miss: [0, 500, 0] }];
  const pages = app(relie).gameSkin(acts, [], waits).band.pages;
  assert.deepEqual(pages.supplies.map(l => l.what), ['Mine de métal 9', 'Mine de cristal 8']);
});

t('sans action ni mission, aucune page n\'a de ligne', () => {
  assert.deepEqual(app(relie).gameSkin([]).band.pages, {});
});

t('la tournée voyage dans le skin', () => {
  assert.ok(app(nommees).gameSkin([]).tour['101']);
});

t('une case de forme de vie renvoie sur sa propre file', () => {
  const g = app(relie);
  assert.ok(/component=lfbuildings/.test(g.actGo({ kind: 'lf', id: 11101, p: 0 })));
  assert.ok(/component=lfresearch/.test(g.actGo({ kind: 'lf', id: 11201, p: 0 })));
});

t('un labo renvoie sur Installations, pas sur Ressources', () => {
  const g = app(relie);
  assert.ok(/component=facilities/.test(g.actGo({ kind: 'b', k: 'lab', p: 0 })),
    'le laboratoire est une installation : ' + g.actGo({ kind: 'b', k: 'lab', p: 0 }));
});

t('une recherche renvoie sur la planète qui porte le labo', () => {
  // le labo est sur la planète mère dans l'état de test
  const g = app(relie);
  const url = g.actGo({ kind: 't', k: 'astro' });
  assert.ok(/component=research/.test(url), url);
  assert.ok(/cp=33601/.test(url), 'la recherche se lance depuis le labo : ' + url);
});

t('sans synchronisation, aucune carte n\'est cliquable', () => {
  // le serveur n'est connu qu'après un passage dans le jeu : inventer une URL
  // enverrait le joueur sur un univers qui n'est pas le sien.
  const g = app();
  assert.equal(g.actGo({ kind: 'b', k: 'metal', p: 0 }), null);
});

t('chaque lien dit sur quelle planète aller', () => {
  const g = app(relie);
  g.REFRESH.today();
  const liens = (g.html().tdNow || '').match(/data-go="[^"]*"/g) || [];
  assert.ok(liens.length, 'des liens sont attendus');
  // sans cp=, le jeu ouvre la page de la planète couramment sélectionnée :
  // le joueur se retrouve au bon endroit sur la mauvaise planète.
  const sansPlanete = liens.filter(l => !/cp=\d+/.test(l));
  assert.deepEqual(sansPlanete, [], 'liens sans planète : ' + sansPlanete.join(' '));
});

t('la carte des bâtiments de forme de vie pointe sur lfbuildings', () => {
  // Relevé sur le jeu : les bâtiments sont au pluriel, la recherche au
  // singulier. Un nom approchant ouvre la vue d'ensemble sans rien signaler.
  // Une case de bâtiment lue sur chaque planète : sans elle, la file de
  // recherche n'est pas réclamée — elle n'existe pas tant que l'espèce n'est
  // pas posée — et la carte des recherches ne sortirait pas.
  const g = app(s => { relie(s); s.syncAt = SOIR; s.timers = []; s.planets.forEach(p => { p.lf = { 11101: { lvl: 24, state: 'ok' } }; }); }, SOIR, null, true);
  assert.ok(g.dailyMissions().some(m => m.id === 'lfb'), 'la carte des bâtiments doit exister');
  g.REFRESH.today();
  const rendu = g.html().tdNow || '';
  assert.ok(/component=lfbuildings&amp;cp=/.test(rendu),
    'le lien des bâtiments de forme de vie : ' + (rendu.match(/component=lf\w+/g) || []).join(' '));
  assert.ok(/component=lfresearch&amp;cp=/.test(rendu),
    'le lien de la recherche de forme de vie : ' + (rendu.match(/component=lf\w+/g) || []).join(' '));
});

t('les cartes rendues portent leur lien', () => {
  const g = app(relie);
  g.REFRESH.today();
  assert.ok(/data-go="https:\/\/s199-fr/.test(g.html().tdNow || ''),
    'au moins une carte doit \u00eatre cliquable');
});

/* ---------- savoir sur quelle planète agir ---------- */

/** Mode extension, synchro fraîche, et une file de forme de vie au choix. */
const avecFiles = timers => app(s => { s.syncAt = SOIR; s.timers = timers; }, SOIR, null, true);
const mission = (g, id) => g.dailyMissions().find(m => m.id === id);

t('le rel\u00e9v\u00e9 n\'est r\u00e9clam\u00e9 que pour les plan\u00e8tes jamais vues', () => {
  // la mère est relevée, prix compris ; la colonie n'a jamais été ouverte
  const g = app(s => {
    s.syncAt = SOIR;
    s.planets[0].lf = { 11101: { lvl: 24, state: 'ok', next: 25, cost: [13911, 3974, 0], secs: 1834 },
      11201: { lvl: 1, state: 'ok', next: 2, cost: [5000, 5000, 0], secs: 900 } };
  }, SOIR, null, true);
  const m = g.dailyMissions().find(x => x.id === 'lfb');
  assert.ok(m, 'la colonie reste à relever');
  assert.deepEqual(m.tags, ['Colonie'], 'et elle seule : ' + JSON.stringify(m.tags));
});

t('une fois tout relev\u00e9, plus aucune carte de forme de vie', () => {
  const vue = { 11101: { lvl: 24, state: 'ok', next: 25, cost: [13911, 3974, 0], secs: 1834 },
    11201: { lvl: 1, state: 'ok', next: 2, cost: [5000, 5000, 0], secs: 900 } };
  const g = app(s => {
    s.syncAt = SOIR;
    s.planets.forEach(p => { p.lf = { ...vue }; });
  }, SOIR, null, true);
  // le plan s'en charge d\u00e9sormais : le rappel n'a plus de raison d'\u00eatre
  assert.ok(!g.dailyMissions().some(x => x.id === 'lfb' || x.id === 'lfr'),
    'le plan a pris le relais');
});

t('l\'étiquette met la planète en pastille colorée', () => {
  const g = app();
  assert.ok(/class="ptag"/.test(g.qHtml('Bâtiment · Colonie')),
    'la planète doit être une pastille : ' + g.qHtml('Bâtiment · Colonie'));
  // la couleur suit le rang de la planète : elle ne bouge pas d'une carte à l'autre
  assert.ok(/--pc:var\(--p0\)/.test(g.qHtml('Bâtiment · Planète mère')));
  assert.ok(/--pc:var\(--p1\)/.test(g.qHtml('Bâtiment · Colonie')));
  assert.equal(g.qHtml('Flotte'), 'Flotte', 'sans planète, rien à colorer');
});

/* ---------- espionner coûte un emplacement de flotte ---------- */

/** Trois inactifs plus faibles que moi, dans mon système. */
const INACTIFS = {
  planets: [['1:140:6', 'a'], ['1:145:10', 'b'], ['1:138:6', 'c']],
  players: { a: ['Alpha', 'i'], b: ['Beta', 'i'], c: ['Gamma', 'I'], moi: ['Moi', ''] },
  scores: { a: [900], b: [800], c: [700], moi: [5000] }
};
const avecSlots = (used, max) => app(s => {
  s.me = 'moi';
  s.syncAt = SOIR;
  s.slots = { fleet: [used, max], at: SOIR };
}, SOIR, INACTIFS);
const espionnage = g => g.dailyMissions().find(m => m.id === 'raid');

t('emplacements de flotte pleins : aucun espionnage proposé', () => {
  const g = avecSlots(8, 8);
  // Chaque sonde prend un emplacement : la mission échouerait avec
  // « Nombre maximal de flottes atteint ».
  assert.ok(!espionnage(g), 'rien à espionner sans emplacement libre');
  assert.ok(!g.dailyMissions().find(m => m.id === 'inactive'),
    'et surtout pas « repérer des inactifs » : ils sont déjà repérés');
});

t('un seul emplacement libre : une seule cible proposée', () => {
  const m = espionnage(avecSlots(7, 8));
  assert.ok(m, 'un espionnage reste possible');
  assert.equal((m.what.match(/\d+:\d+:\d+/g) || []).length, 1,
    'une seule cible tient dans l\'emplacement libre : ' + m.what);
});

t('assez d\'emplacements : les trois cibles sont proposées', () => {
  const m = espionnage(avecSlots(2, 8));
  assert.ok(m, 'un espionnage est proposé');
  assert.equal((m.what.match(/\d+:\d+:\d+/g) || []).length, 3, m.what);
});

t('chaque cible d\'espionnage porte le lien de sa galaxie', () => {
  // Le clic sur la carte n'ouvrait que le premier système : les autres
  // coordonnées n'étaient que du texte à retaper dans le jeu.
  const g = app(s => { relie(s); s.me = 'moi'; s.syncAt = SOIR; s.slots = { fleet: [2, 8], at: SOIR }; }, SOIR, INACTIFS);
  const m = espionnage(g);
  const liens = [...m.whatHtml.matchAll(/data-go="([^"]+)"/g)].map(x => x[1].replace(/&amp;/g, '&'));
  assert.equal(liens.length, 3, 'une cible sans lien : ' + m.whatHtml);
  for (const c of m.what.match(/\d+:\d+:\d+/g)) {
    const [ga, sy] = c.split(':');
    assert.ok(liens.some(u => u.includes('component=galaxy') && u.includes(`galaxy=${ga}&system=${sy}`)),
      `${c} ne mène pas à sa galaxie : ` + JSON.stringify(liens));
  }
  assert.ok(m.whatHtml.includes(m.what.split(' : ')[0]), 'le texte de la carte est conservé : ' + m.whatHtml);
});

t('serveur inconnu : la coordonnée reste du texte échappé', () => {
  const m = espionnage(avecSlots(2, 8));
  assert.ok(!/data-go/.test(m.whatHtml), 'un lien est fabriqué sans serveur : ' + m.whatHtml);
  assert.ok(!/</.test(m.whatHtml), 'du balisage sort quand même : ' + m.whatHtml);
});

t('une sonde en vol retire sa cible, sans cliquer sur Fait', () => {
  const g = avecSlots(2, 8);
  assert.ok(/1:140:6/.test(espionnage(g).what), 'elle est proposée au départ');
  g.applyGame({ planets: {}, timers: [], moves: [{ mission: 6, ret: false, arrival: SOIR / 1000 + 600, origin: '1:140:1', dest: '1:140:6' }] });
  assert.ok(!/1:140:6/.test(espionnage(g).what), 'sonde partie : la cible sort de la liste');
});

t('une cible espionnée hier ne revient pas aujourd\'hui', () => {
  const g = app(s => {
    s.me = 'moi';
    s.syncAt = SOIR;
    s.slots = { fleet: [2, 8], at: SOIR };
    // « Fait » sur l'espionnage marque les cibles : elles sortent pour 24 h.
    s.raids = { '1:140:6': { at: SOIR - 3600e3, probe: true } };
  }, SOIR, INACTIFS);
  const m = espionnage(g);
  assert.ok(m, 'les autres inactifs restent à espionner');
  assert.ok(!/1:140:6/.test(m.what), 'déjà espionnée il y a une heure : ' + m.what);
  // et elle redevient proposable une fois le rapport périmé
  const apres = app(s => {
    s.me = 'moi';
    s.syncAt = SOIR;
    s.slots = { fleet: [2, 8], at: SOIR };
    s.raids = { '1:140:6': { at: SOIR - 25 * 3600e3, probe: true } };
  }, SOIR, INACTIFS);
  assert.ok(/1:140:6/.test(espionnage(apres).what), 'après 24 h, on la réespionne');
});

t('sans sonde au sol, la consigne dit d\'en construire', () => {
  const chantier = ships => app(s => {
    s.me = 'moi';
    s.syncAt = SOIR;
    s.slots = { fleet: [2, 8], at: SOIR };
    s.planets[0].shipsAt = SOIR;
    s.planets[0].ships = ships;
  }, SOIR, INACTIFS);
  // L'œil de la Galaxie envoie les sondes déjà au sol : sans sonde, le jeu
  // répond « Vous n'avez pas sélectionné de vaisseaux » et la consigne ment.
  assert.ok(/chantier spatial/.test(espionnage(chantier({ sc: 4 })).how[0]),
    espionnage(chantier({ sc: 4 })).how[0]);
  assert.ok(/Galaxie/.test(espionnage(chantier({ pr: 3 })).how[0]),
    'avec des sondes, on retourne à la Galaxie');
  // chantier jamais ouvert : on ne sait rien, on ne prétend rien
  assert.ok(/Galaxie/.test(espionnage(avecSlots(2, 8)).how[0]),
    'sans relevé du chantier, la consigne ne change pas');
});

t('la liste espionnée part avec la carte', () => {
  const m = espionnage(avecSlots(2, 8));
  assert.deepEqual(m.mark, ['1:140:6', '1:138:6', '1:145:10'].filter(c => m.what.includes(c)),
    'les coordonnées marquées sont celles affichées : ' + JSON.stringify(m.mark));
});

/* ---------- des transporteurs à demeure sur les colonies ---------- */

/** Une colonie qui produit bien, déborde, et n'a ni chantier ni vaisseau. */
function colonieSansFlotte(s) {
  const c = s.planets[1];
  // solaire large : l'énergie ne doit pas masquer ce qu'on teste
  c.b = Object.assign({}, c.b, { metal: 12, crystal: 10, deut: 8, solar: 20, robot: 2, shipyard: 0, smetal: 2, scrystal: 2 });
  c.ships = {};
  c.stock = { m: 70000, c: 50000, d: 9000, at: JOUR };
  s.planets[0].ships = { lc: 10, sc: 5 };
  s.planets[0].stock = { m: 200000, c: 150000, d: 40000, at: JOUR };
}

const surColonie = (g, motif) => g.simulateDay().sessions[0].acts
  .filter(a => /Colonie/.test(a.q) && motif.test(a.what));

t('une colonie qui déborde sans chantier se voit proposer un chantier spatial', () => {
  const g = app(colonieSansFlotte, JOUR);
  const bati = surColonie(g, /Chantier spatial|Usine de robots/);
  assert.ok(bati.length, 'rien de proposé pour équiper la colonie : '
    + g.simulateDay().sessions[0].acts.map(a => a.q + ' → ' + a.what).join(' / '));
});

t('une colonie équipée construit ses propres transporteurs', () => {
  const g = app(s => { colonieSansFlotte(s); s.planets[1].b.shipyard = 2; }, JOUR);
  const flotte = surColonie(g, /transporteur/);
  assert.ok(flotte.length, 'aucun transporteur construit sur la colonie');
  assert.ok(/Chantier spatial · Colonie/.test(flotte[0].q), flotte[0].q);
});

t('la planète principale garde sa logique habituelle', () => {
  const g = app(colonieSansFlotte, JOUR);
  const s0 = g.simulateDay().sessions[0];
  const mere = s0.acts.filter(a => /Planète mère/.test(a.q));
  assert.ok(mere.length, 'la planète mère a toujours des actions');
});

/** Une flotte au sol capable de remplir plusieurs expéditions d'un coup. */
function flotteDExpedition(s) {
  s.planets[0].ships = { lc: 20, pr: 1 };
  s.planets[0].stock = { m: 2000000, c: 1500000, d: 800000, at: JOUR };
  s.planets[1].ships = {};
  s.syncAt = JOUR;
}

require('./expeditions.test')({ t, assert, app, lu, JOUR, SOIR, flotteDExpedition });

/* ---------- laisser le jeu remplir son propre formulaire ---------- */

t('une expédition ouvre la page de flotte déjà préparée par le jeu', () => {
  // Le jeu remplit son formulaire quand on arrive par un lien qui porte les
  // paramètres : c'est ce que fait sa propre page Galaxie. L'extension n'écrit
  // rien dans la page — elle ouvre un lien, le jeu fait le reste.
  const u = app(relie).actGo({ kind: 'expo', p: 1, dest: '1:79:16', mission: 15,
    ships: { sc: 21, pr: 1 } });
  assert.ok(/component=fleetdispatch/.test(u), u);
  assert.ok(/[?&]cp=33602(&|$)/.test(u), 'depuis la bonne planète : ' + u);
  assert.ok(/[?&]galaxy=1&system=79&position=16/.test(u), 'vers la bonne case : ' + u);
  assert.ok(/[?&]mission=15(&|$)/.test(u), 'en expédition : ' + u);
  assert.ok(/[?&]am202=21(&|$)/.test(u) && /[?&]am210=1(&|$)/.test(u),
    'avec les vaisseaux comptés : ' + u);
});

t('un rapatriement part en Transporter, un vol à vide en Stationner', () => {
  const g = app(s => {
    relie(s);
    const c = s.planets[1];
    c.b = Object.assign({}, c.b, { metal: 14, crystal: 12, solar: 18, shipyard: 2 });
    c.ships = { lc: 10 };
    c.stock = { m: 90000, c: 60000, d: 9000, at: JOUR };
  }, JOUR);
  const r = g.simulateDay().sessions[0].acts.find(a => a.kind === 'transfer' && a.res);
  assert.ok(r, 'un rapatriement est proposé');
  assert.equal(r.mission, 3, 'mission Transporter');
  assert.ok(/mission=3(&|$)/.test(g.actGo(r)), g.actGo(r));
});

t('sans destination, le lien reste la simple page de flotte', () => {
  assert.equal(app(relie).actGo({ kind: 'fleet', p: 0 }),
    'https://s199-fr.ogame.gameforge.com/game/index.php?page=ingame&component=fleetdispatch&cp=33601');
});

t('la mise à l\'abri du soir ouvre aussi un formulaire préparé', () => {
  const g = app(s => { relie(s); loin(s); s.planets[0].ships = { lc: 30 }; });
  const n = g.dailyMissions().find(m => m.id === 'night');
  assert.ok(n, 'le rappel du soir existe');
  const u = g.missionGo(n);
  assert.ok(/component=fleetdispatch/.test(u) && /am203=/.test(u), 'avec la flotte : ' + u);
  assert.ok(/mission=3(&|$)/.test(u), 'en Transport, la préférence du joueur : ' + u);
  assert.ok(/position=6(&|$)/.test(u), 'vers la colonie : ' + u);
});

t('le vaisseau de colonisation part en mission Coloniser', () => {
  const g = app(s => {
    relie(s);
    s.colo.target = '1:142:9';
    s.colo.built = true;
    s.planets[0].ships = { col: 1, lc: 4 };
  }, JOUR);
  const a = g.simulateDay().sessions.flatMap(x => x.acts)
    .find(x => /colonisation/.test(x.what) && x.kind === 'fleet');
  assert.ok(a, 'l\'envoi est proposé');
  assert.ok(/mission=7(&|$)/.test(g.actGo(a) || ''), g.actGo(a));
  assert.ok(/galaxy=1&system=142&position=9/.test(g.actGo(a) || ''), g.actGo(a));
});

t('ce que le lien prépare ne se retape pas', () => {
  // Vaisseaux et coordonnées arrivent remplis par le jeu : les proposer en
  // plus à la copie, c'est du bruit. Les ressources, elles, restent à saisir.
  const g = app(relie);
  const h = g.copyChips({ kind: 'transfer', p: 1, dest: '1:142:8', mission: 3,
    ships: { lc: 3 }, res: [4200, 0, 0] });
  assert.ok(!/galaxie|système|position/.test(h), 'plus de coordonnées : ' + h);
  assert.ok(!/Grand transporteur/.test(h), 'plus de vaisseaux : ' + h);
  assert.ok(/data-copy="4200"/.test(h), 'mais toujours le métal : ' + h);
});

t('sans lien préparé, tout reste copiable', () => {
  // Au chantier spatial il n\'y a pas de formulaire de flotte à préparer :
  // la quantité se tape à la main.
  const h = app(relie).copyChips({ kind: 'ship', p: 0, ships: { lc: 3 } });
  assert.ok(/Grand transporteur/.test(h) && /data-copy="3"/.test(h), h);
});

/* ---------- le Réseau de recherche intergalactique ---------- */

/* Centre forcé sur la mère, labo 5, et un plus gros labo sur la colonie : sans
   ça le centre se déplacerait sur le plus haut labo et il n'y aurait plus rien
   à relier. C'est aussi le cas qui compte — un centre au petit labo qui
   récupère le gros d'à côté. */
const RESEAU = (irn, labColo) => app(s => {
  s.centre = 'mere'; s.tech.irn = irn; s.planets[1].b.lab = labColo;
});
/** Une voisine de plus, labo donné, avec son propre stock. */
const voisine = (s, id, pos, lab) => s.planets.push(Object.assign({}, s.planets[1], {
  id, coords: '1:142:' + pos, b: Object.assign({}, s.planets[1].b, {lab}),
  stock: Object.assign({}, s.planets[1].stock)
}));

t('sans Réseau, seul le labo du centre compte', () => {
  const g = RESEAU(0, 9);
  assert.equal(g.labLevel(), 5, 'le labo du centre');
  assert.equal(g.labEffectif(), 5,
    'un labo 9 sur la colonie ne doit rien ajouter tant que le Réseau est à zéro');
});

t('le Réseau ajoute les meilleurs labos des autres planètes', () => {
  const g = RESEAU(1, 9);
  assert.equal(g.labLevel(), 5, 'le labo qui débloque ne bouge pas');
  assert.equal(g.labEffectif(), 14, '5 + 9 : Réseau 1 relie le meilleur labo d\'à côté');
});

t('le Réseau ne relie que N labos, N étant son niveau', () => {
  // Trois voisines à 7, 9 et 8 : au niveau 2, les deux meilleures seulement.
  const g = app(s => {
    s.centre = 'mere'; s.tech.irn = 2; s.planets[1].b.lab = 7;
    voisine(s, 'c2', 5, 9);
    voisine(s, 'c3', 4, 8);
  });
  assert.equal(g.labEffectif(), 22, '5 + 9 + 8, et pas le 7 de la troisième');
});

t('le Réseau raccourcit la recherche, sans toucher ce qui la débloque', () => {
  const sans = RESEAU(0, 9), avec = RESEAU(1, 9);
  const t0 = sans.researchTime('energy', 1), t1 = avec.researchTime('energy', 1);
  assert.ok(t1 < t0, `la durée doit baisser : ${t0} puis ${t1}`);
  // (1+5) contre (1+14) : le rapport des dénominateurs, à l'arrondi près
  assert.ok(Math.abs(t0 / t1 - 15 / 6) < .01, `rapport attendu 2,5, obtenu ${t0 / t1}`);
});

t('le Réseau n\'aide jamais à remplir un prérequis de labo', () => {
  /* Le piège de la modélisation : un prérequis est une propriété de la
     planète. Avec un labo effectif de 14, Nanites ne doit pas paraître
     débloquée alors que le labo du centre est à 5. */
  const g = RESEAU(1, 9);
  assert.equal(g.labEffectif(), 14, 'le labo effectif dépasse bien le seuil');
  assert.deepEqual(g.reqOk({lab:10}), ['Labo 10'],
    'le prérequis doit rester manquant : le Réseau accélère, il ne débloque pas');
});

t('le Réseau n\'est pas conseillé de lui-même', () => {
  // Choix assumé : on le compte quand le joueur l'a, on ne le pousse pas.
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'plan', 'journee.js'), 'utf8');
  const feuilles = /(?:export )?const ROADMAPS = \{[\s\S]*?\n\};/.exec(src)[0];
  assert.ok(!/'irn'/.test(feuilles), 'aucune feuille de route ne doit contenir irn');
});

/* ---------- pourquoi cette recherche ---------- */

t('un prérequis de recherche dit vers quelle recherche il mène', () => {
  const g = app(s => { s.day.focus = 'eco'; });
  const r = g.nextResearch().list[0];
  assert.equal(r.k, 'energy', 'la feuille de route éco commence par Énergie');
  assert.ok(/Plasma/.test(r.why || ''),
    'Énergie ' + r.lvl + ' est un péage : son pourquoi doit nommer Plasma, et dit « ' + (r.why || '(rien)') + ' »');
});

t('la recherche visée dit ce qu\'elle rapporte', () => {
  const g = app(s => {
    s.day.focus = 'eco';
    Object.assign(s.tech, { energy: 8, laser: 10, ion: 5 });
    s.planets[0].b.lab = 6;
  });
  const r = g.nextResearch().list[0];
  assert.equal(r.k, 'plasma');
  assert.ok(/métal/.test(r.why || ''), 'Plasma doit annoncer son bonus de production, et dit « ' + (r.why || '(rien)') + ' »');
});

t('Plasma annonce son amortissement, chiffré sur l\'empire du joueur', () => {
  const g = app(s => {
    s.day.focus = 'eco';
    Object.assign(s.tech, { energy: 8, laser: 10, ion: 5 });
    s.planets[0].b.lab = 6;
  });
  const h = g.techPayback('plasma', 1);
  assert.ok(h > 0 && isFinite(h), 'un amortissement en heures, et non ' + h);
  assert.ok(/[Aa]morti/.test(g.nextResearch().list[0].why || ''),
    'la carte Plasma doit le dire : « ' + g.nextResearch().list[0].why + ' »');
  assert.equal(g.techPayback('energy', 8), null, 'une recherche qui ne produit rien n\'a pas d\'amortissement');
});

/* ---------- le plafond du nombre de planètes ---------- */

t('toutes les planètes prises, un conseil nomme le palier d\'Astrophysique', () => {
  const g = app(s => { s.tech.astro = 2; });
  assert.equal(g.maxPlanets(), 2, 'Astro 2 autorise deux planètes, et le joueur en a deux');
  const c = g.dailyMissions().find(m => /Astrophysique 3/.test(m.what + ' ' + m.why));
  assert.ok(c, 'aucune carte ne dit qu\'Astrophysique 3 ouvrirait une planète de plus');
});

t('en focus colonie, le plan propose le palier qui ouvre une planète', () => {
  const g = app(s => { s.day.focus = 'ecocol'; s.tech.astro = 2; });
  const r = g.nextResearch().list.find(x => x.k === 'astro');
  assert.ok(r, 'Astrophysique doit être dans la file');
  assert.ok(/3ᵉ planète/.test(r.why || ''),
    'le pourquoi doit nommer la planète gagnée, et dit « ' + (r.why || '(rien)') + ' »');
});

t('en économie pure le plan ne pousse pas vers une colonie', () => {
  const g = app(s => { s.day.focus = 'eco'; s.tech.astro = 2; });
  const r = g.nextResearch().list.find(x => x.k === 'astro');
  assert.ok(!r || !/ᵉ planète/.test(r.why || ''),
    'ce focus ne colonise pas : lui vendre une planète de plus serait incohérent');
});

t('le plafond des planètes a sa carte dans le plan du jour', () => {
  const g = app(s => { s.tech.astro = 2; });
  const c = g.dailyMissions().find(m => m.id === 'colomax');
  assert.ok(c, 'aucune carte ne dit que les deux emplacements de planète sont pris');
  assert.ok(/Astrophysique 3/.test(c.why + ' ' + c.how.join(' ')), 'elle doit nommer le palier : « ' + c.why + ' »');
  assert.ok(/\d/.test(c.why), 'et son coût');
});

t('un emplacement de planète libre, pas de carte de plafond', () => {
  const g = app(s => { s.tech.astro = 3; });
  assert.equal(g.maxPlanets(), 3, 'un emplacement reste libre');
  assert.ok(!g.dailyMissions().some(m => m.id === 'colomax'));
});

t('en économie pure la carte dit que le plan ne colonisera pas seul', () => {
  const g = app(s => { s.day.focus = 'eco'; s.tech.astro = 2; });
  const c = g.dailyMissions().find(m => m.id === 'colomax');
  assert.ok(/Économie pure/.test(c.how.join(' ')),
    'sinon le joueur attend une colonie que ce focus ne lancera jamais');
});

t('le péage chiffre ce que sa destination rapportera', () => {
  const g = app(s => { s.day.focus = 'eco'; });
  const r = g.nextResearch().list[0];
  assert.ok(/amortira/.test(r.why || ''),
    'Énergie ne produit rien : son pourquoi doit chiffrer Plasma, et dit « ' + r.why + ' »');
});

/* ---------- une planète passe avant les mines ---------- */

/** Trois planètes et Astrophysique 4 : tous les emplacements sont pris. */
function pleinDePlanetes(s) {
  s.day.focus = 'ecocol';
  s.tech.astro = 4;
  const troisieme = JSON.parse(JSON.stringify(s.planets[1]));
  troisieme.id = 'colo2'; troisieme.name = 'Colonie 2'; troisieme.coords = '1:142:4';
  s.planets.push(troisieme);
}

t('en focus colonie, le palier qui ouvre une planète passe devant la chaîne Plasma', () => {
  const g = app(pleinDePlanetes);
  assert.equal(g.maxPlanets(), 3, 'trois emplacements, trois planètes');
  const l = g.nextResearch().list;
  assert.equal(l[0].k, 'astro', 'la file commence par ' + l.map(x => x.k + ' ' + x.lvl).join(', '));
  assert.ok(l[0].crit, 'et le plan met des ressources de côté pour elle');
  assert.ok(/4ᵉ planète/.test(l[0].why || ''), 'en disant pourquoi : « ' + l[0].why + ' »');
});

t('un emplacement libre, le palier ne double personne', () => {
  const g = app(s => { s.day.focus = 'ecocol'; s.tech.astro = 4; });
  assert.ok(g.S.planets.length < g.maxPlanets(), 'il reste un emplacement');
  assert.notEqual(g.nextResearch().list[0].k, 'astro',
    'rien ne presse : la colonie se prépare, elle ne demande aucune recherche');
});

t('en économie pure le palier ne double pas la file', () => {
  const g = app(s => { pleinDePlanetes(s); s.day.focus = 'eco'; });
  const l = g.nextResearch().list;
  assert.notEqual(l[0].k, 'astro', 'ce focus ne colonise pas : la file garde son ordre');
});

/* ---------- le plan équilibré ---------- */

t('le plan équilibré colonise comme le plan colonie', () => {
  const g = app(s => { pleinDePlanetes(s); s.day.focus = 'equi'; });
  const l = g.nextResearch().list;
  assert.equal(l[0].k, 'astro', 'la file commence par ' + l.map(x => x.k + ' ' + x.lvl).join(', '));
  assert.ok(l[0].crit, 'et le plan met des ressources de côté pour elle');
});

t('le plan équilibré fait passer le plafond d\'expéditions devant la feuille de route', () => {
  // Un emplacement de colonie reste libre : Astrophysique ne double donc rien
  // pour la colonie, et la soute au sol dépasse déjà le plafond d'expéditions.
  const cadre = s => {
    flotteDExpedition(s); s.tech.astro = 4;
    s.planets[0].b = Object.assign({}, s.planets[0].b, { lab: 10 });
    Object.assign(s.tech, { espionage: 4, impulse: 3, computer: 4, combustion: 6 });
    s.slots = { fleet: [0, 9], expo: [0, 1], at: JOUR };
  };
  const file = f => app(s => { cadre(s); s.day.focus = f; }, JOUR);
  const g = file('equi'), eq = g.nextResearch().list;
  assert.ok(g.S.planets.length < g.maxPlanets(), 'le cadre laisse un emplacement de colonie libre');
  assert.equal(eq[0].k, 'astro',
    'en équilibré elle passe devant : ' + eq.map(x => x.k + ' ' + x.lvl).join(', '));
  const co = file('ecocol').nextResearch().list;
  assert.notEqual(co[0].k, 'astro',
    'en colonie elle attend son tour : ' + co.map(x => x.k + ' ' + x.lvl).join(', '));
});

t('« Équilibré » est un réglage que la journée accepte', () => {
  const g = app();
  assert.equal(g.dayValue('focus', 'equi', 'ecocol'), 'equi');
});

t('Astrophysique ne promet pas une expédition à chaque niveau', () => {
  const g = app(pleinDePlanetes);
  const w = g.nextResearch().list[0].why;
  assert.ok(/carré|9/.test(w),
    'le joueur croit qu\'un niveau d\'Astro ajoute une expédition ; le pourquoi doit dire que le palier est un carré parfait : « ' + w + ' »');
});

t('le pourquoi d\'Astrophysique ne dit pas deux fois la même chose', () => {
  const g = app(s => {
    pleinDePlanetes(s); s.tech.astro = 6; s.planets[0].b.lab = 8;
    const q = JSON.parse(JSON.stringify(s.planets[1]));
    q.id = 'colo3'; q.name = 'Colonie 3'; q.coords = '1:142:2'; s.planets.push(q);
  });
  assert.equal(g.maxPlanets(), 4, 'quatre emplacements, quatre planètes');
  const w = g.nextResearch().list[0].why;
  assert.ok(!/un palier sur deux/.test(w),
    'l\'effet générique répète le plafond, qui est plus précis : « ' + w + ' »');
  assert.ok(/planète/.test(w), 'mais la planète gagnée reste dite');
});

/* ---------- le service worker ---------- */

/* background.js n'a pas de surface de test : il lui faudrait feindre alarms,
   notifications, tabs, windows, action, sidePanel, scripting, importScripts et
   fetch, et `merge` n'est joignable qu'à travers un message. On garde donc ses
   deux défauts corrigés là où on peut : sur sa source. Même repli que les
   quatre tests qui relisent app.js. */
const SW = () => require('fs').readFileSync(require('path').join(__dirname, '..', 'background.js'), 'utf8');

/** `pageDuJeu`, découpée dans la source du worker : elle ne dépend d'aucune API de Chrome. */
const pageDuJeu = () => new Function('return ' + /function pageDuJeu[\s\S]*?\n}/.exec(SW())[0])();

t("une adresse n'est autorisée que si l'analyseur d'URL la dit du jeu", () => {
  const ok = pageDuJeu();
  assert.equal(ok('https://s1-fr.ogame.gameforge.com/game/index.php?cp=1'),
    'https://s1-fr.ogame.gameforge.com/game/index.php?cp=1');
  assert.equal(ok('https://ogame.gameforge.com/game/index.php'),
    'https://ogame.gameforge.com/game/index.php');
});

t("les adresses que l'expression régulière laissait passer sont refusées", () => {
  /* La barre oblique inversée est une barre oblique pour l'analyseur, et le
     dièse ouvre le fragment : les deux mènent chez mechant.fr alors que
     /^https:\/\/[^/]*\.ogame\.gameforge\.com\// les accepte. Un onglet y serait
     parti avec la session du joueur dans l'adresse. */
  const ok = pageDuJeu();
  for (const u of [
    'https://mechant.fr\\.ogame.gameforge.com/game/index.php',
    'https://mechant.fr#.ogame.gameforge.com/game/index.php',
    'https://mechant-ogame.gameforge.com.evil.fr/game/index.php',
    'http://s1-fr.ogame.gameforge.com/game/index.php',
    'javascript:alert(1)//.ogame.gameforge.com/',
    'pas une adresse', '', null
  ]) assert.equal(ok(u), null, u);
});

t("la navigation part de ce que l'analyseur a compris, pas de la chaîne reçue", () => {
  // sinon la vérification porte sur un texte et le navigateur en suit un autre
  const src = SW();
  assert.ok(!/chrome\.tabs\.(update|create)\([^)]*\{ url,/.test(src),
    'aucune navigation ne doit reprendre `url` tel quel');
  assert.equal((src.match(/const sur = pageDuJeu\(url\);/g) || []).length, 2,
    'goToGame et scanGo passent toutes les deux par la vérification');
});

t('la file d\'une case de forme de vie est demandée à lfQueue, jamais recalculée', () => {
  const src = SW();
  assert.ok(/id >= 11000\) return lfQueue\(id\)/.test(src),
    'le worker doit déférer à la règle canonique de ids.js');
  assert.ok(!/% 10 === 2/.test(src),
    'la seconde copie de la règle ne doit pas revenir : elle ne s\'accordait que sur les Humains');
});

t('la règle canonique range les séries paires en recherche', () => {
  /* Ce que la copie du worker se trompait à dire. Les Humains occupent 111xx
     et 112xx, la race suivante 113xx et 114xx : la centaine impaire construit,
     la paire cherche. */
  const g = app();
  for (const id of [11101, 11301, 11501, 11701, 11901, 12101])
    assert.equal(g.lfQueue(id), 'lfbuilding', id + ' est une file de bâtiments');
  for (const id of [11201, 11401, 11601, 11801, 12001])
    assert.equal(g.lfQueue(id), 'lfresearch', id + ' est une file de recherche');
});

t('un instantané amputé ne tue pas le worker en silence', () => {
  const src = SW();
  const tete = /async function merge\(s\) \{[\s\S]{0,700}?const \{ game/.exec(src);
  assert.ok(tete, 'la tête de merge doit être lisible');
  for (const champ of ['meta', 'planets', 'levels', 'stock', 'timers'])
    assert.ok(new RegExp(champ + ': s\\.' + champ + ' \\|\\|').test(tete[0]),
      's.' + champ + ' est déréférencé plus bas sans garde : il doit être comblé en tête');
  assert.ok(/merge\(msg\.data\)\s*[\r\n]*\s*\.catch\(/.test(src),
    'l\'appel doit capturer : sinon ce que merge lève est un rejet non traité, invisible');
});

/* ---------- la version ---------- */

t('app.js et manifest.json annoncent la même version', () => {
  const fs = require('fs'), path = require('path');
  const root = path.join(__dirname, '..');
  const dansApp = fs.readFileSync(path.join(root, 'app.js'), 'utf8')
    .match(/APP_VERSION = '([^']+)'/)[1];
  const dansManifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')).version;
  assert.equal(dansApp, dansManifest,
    'le panneau afficherait ' + dansApp + ' alors que Chrome a chargé ' + dansManifest);
});

t('pack.sh emporte tout ce que Chrome charge', () => {
  /* `dist/` est ce que le navigateur voit : un fichier oublié dans la liste de
     pack.sh et l'extension se charge sans lui — le panneau reste blanc, et rien
     ne le dit avant le clic. La liste se garde donc depuis les endroits qui
     nomment des fichiers : le manifeste, sidepanel.html et panel.css. */
  const fs = require('fs'), path = require('path');
  const root = path.join(__dirname, '..');
  const lu = f => fs.readFileSync(path.join(root, f), 'utf8');
  const liste = lu('pack.sh').match(/FICHIERS="([^"]+)"/)[1].split(/\s+/);
  /* Les modules ES du panneau partent en dossier entier (`cp -R src`) : tout
     ce qui est sous src/ est emporté, et chacun est relu comme les autres. */
  assert.match(lu('pack.sh'), /^cp -R src dist\/src$/m, 'pack.sh doit emporter le dossier src/');
  const sousSrc = d => fs.readdirSync(path.join(root, d), { withFileTypes: true })
    .flatMap(e => e.isDirectory() ? sousSrc(d + '/' + e.name) : [d + '/' + e.name]);
  const emporte = [...liste, ...sousSrc('src')];
  const m = JSON.parse(lu('manifest.json'));
  /* Le manifeste ne dit pas tout : `app.js` n'est nommé que par boot.js, et
     `ids.js` par un `importScripts`. On relit donc chaque fichier emporté et on
     prend tout nom de fichier local qu'il cite — un nom qu'on lit dans du code
     qui part est un fichier qui doit partir avec lui. */
  /* Un nom donné à un téléchargement (`filename:'save.json'`, `a.download=…`)
     est un fichier que l'extension ÉCRIT chez le joueur, pas un fichier qu'elle
     charge : il ne part pas dans le zip. */
  /* Un chemin relatif (`'../app.js'` dans un import) se lit depuis le
     dossier du fichier qui le cite ; un autre, depuis la racine, comme
     `'src/main.js'` que boot.js ajoute à sidepanel.html. */
  const cites = emporte.filter(f => /\.(js|html|css)$/.test(f))
    .flatMap(f => [...lu(f).matchAll(/(?<!(?:filename\s*:|download\s*=)\s*)['"]((?:\.{1,2}\/)*[\w-]+(?:\/[\w-]+)*\.(?:js|css|html|png|woff2|json))['"]/g)]
      .map(x => /^\.{1,2}\//.test(x[1]) ? path.posix.normalize(path.posix.join(path.posix.dirname(f), x[1])) : x[1]))
    /* Un .json cité peut être un nom de téléchargement (save.json) : seul
       compte celui qui existe dans le dépôt, comme rules.json. */
    .filter(f => !f.endsWith('.json') || fs.existsSync(path.join(root, f)));
  const voulus = new Set(['manifest.json', m.background.service_worker,
    ...m.content_scripts.flatMap(c => c.js),
    ...Object.values(m.icons),
    ...m.web_accessible_resources.flatMap(r => r.resources),
    ...[...lu('sidepanel.html').matchAll(/(?:src|href)="([^":]+)"/g)].map(x => x[1]),
    ...cites]);
  for (const f of voulus)
    assert.ok(emporte.includes(f), f + ' est chargé par l\'extension et pack.sh ne l\'emporte pas');
  for (const f of liste)
    assert.ok(fs.existsSync(path.join(root, f)), 'pack.sh emporte ' + f + ', qui n\'existe pas');
});

/* ---------- les modules ES du panneau (issue #49) ---------- */
/* Le harnais met les modules à plat : il ne voit ni un import oublié, ni un
   import d'un nom que l'autre module n'exporte pas. Ces vérifications-ci le
   voient, à la lecture du source, et test/esm.js au vrai chargement. */
{
  const M = require('./modules');
  const fs = require('fs'), path = require('path');
  const lu = f => fs.readFileSync(path.join(M.ROOT, f), 'utf8');
  const mods = M.ordre('src/main.js');
  const haut = Object.fromEntries(mods.map(f => [f, M.nomsHaut(lu(f))]));

  t('modules : chaque import vise un fichier qui existe et un nom qu\'il exporte', () => {
    for (const f of mods) for (const { de, noms } of M.imports(f)) {
      assert.ok(fs.existsSync(path.join(M.ROOT, de)), f + ' importe ' + de + ', qui n\'existe pas');
      const ex = M.exports_(de);
      for (const n of noms) {
        assert.ok(/^[A-Za-z_$][\w$]*$/.test(n), f + ' : « ' + n + ' » — pas de renommage à l\'import, le harnais met les modules à plat');
        assert.ok(ex.has(n), f + ' importe ' + n + ' de ' + de + ', qui ne l\'exporte pas : le panneau ne se chargerait pas');
      }
    }
  });

  t('modules : chaque nom pris à un autre module est importé', () => {
    /* Sans exception pour les noms locaux : une variable locale qui porte le
       nom d'un autre module fait importer ce nom pour rien, ce qui ne casse
       rien ; l'excuser laissait passer un vrai oubli (`regle`, employé en
       paramètre dans une fonction et en appel dans une autre). */
    const manque = [];
    for (const f of mods) {
      const { emplois } = M.usages(lu(f));
      const importes = new Set(M.imports(f).flatMap(i => i.noms));
      for (const g of mods) if (g !== f) for (const n of haut[g])
        if (emplois.has(n) && !haut[f].has(n) && !importes.has(n)) manque.push(f + ' emploie ' + n + ' (' + g + ')');
    }
    assert.deepEqual(manque, [], 'sans import, le navigateur lève au premier appel');
  });

  t('modules : un nom n\'est déclaré qu\'une fois dans tout le panneau', () => {
    /* Un script classique laissait la dernière déclaration l'emporter ; un
       module refuse de se charger, et deux modules mis à plat par le
       harnais se marcheraient dessus. */
    const vu = {};
    for (const f of [...require('./harness').CLASSIQUES, ...mods]) {
      const j = M.jetons(lu(f));
      for (let k = 0; k < j.length - 1; k++)
        if (j[k].prof === 0 && j[k].v === 'function' && j[k + 1].t === 'id') {
          const n = j[k + 1].v;
          assert.ok(!vu[n], n + ' déclarée dans ' + vu[n] + ' et dans ' + f);
          vu[n] = f;
        }
    }
  });

  t('modules : les scripts classiques n\'empruntent rien aux modules', () => {
    /* ids.js et profils.js restent des scripts : les déclarations d'un module
       ne sont plus des globales, un script qui les appellerait lèverait. */
    const tous = new Set(mods.flatMap(f => [...haut[f]]));
    for (const f of require('./harness').CLASSIQUES) {
      const { emplois, locaux } = M.usages(lu(f));
      const propres = M.nomsHaut(lu(f));
      const pris = [...emplois].filter(n => tous.has(n) && !propres.has(n) && !locaux.has(n));
      assert.deepEqual(pris, [], f + ' emprunte aux modules');
    }
  });

  t('modules : les scripts classiques et ceux des content scripts n\'ont ni import ni export', () => {
    // Chrome ne charge pas de module en content script déclaré, ni importScripts() dans le service worker
    for (const f of ['ids.js', 'profils.js', 'boot.js', 'content.js', 'background.js', 'masque.js', 'masque-conf.js'])
      assert.ok(!/^\s*(?:import|export)\b/m.test(lu(f)), f + ' doit rester un script classique');
  });

  t('modules : pas de dépendance circulaire, hors app.js en cours de découpage', () => {
    /* app.js importe la météo et la flotte cible, qui lui empruntent en
       retour : ce cycle-là est toléré tant qu'app.js existe. Entre deux
       modules sortis de lui, aucun. */
    const graphe = Object.fromEntries(mods.map(f => [f, M.imports(f).map(i => i.de).filter(d => d !== 'app.js')]));
    const etat = {};
    const visite = (f, pile) => {
      if (etat[f] === 2) return;
      assert.ok(etat[f] !== 1, 'cycle : ' + [...pile, f].join(' → '));
      etat[f] = 1;
      for (const d of graphe[f] || []) visite(d, [...pile, f]);
      etat[f] = 2;
    };
    for (const f of mods) if (f !== 'app.js') visite(f, []);
  });

  t('modules : le noyau (src/core/) n\'importe que le noyau', () => {
    // la règle de #49 : core au fond, tout le reste peut s'appuyer dessus sans retour
    for (const f of mods.filter(f => f.startsWith('src/core/')))
      for (const { de } of M.imports(f))
        assert.ok(de.startsWith('src/core/'), f + ' importe ' + de);
  });

  t('modules : aucun module ne réassigne un nom qu\'il importe', () => {
    /* Un import est en lecture seule : `S = …` hors de core/etat.js lève dans
       le navigateur, mais passe dans le harnais, qui a tout mis à plat.
       Remplacer l'état passe par remplaceEtat. */
    const fautes = [];
    for (const f of mods) {
      const importes = new Set(M.imports(f).flatMap(i => i.noms));
      const { locaux } = M.usages(lu(f));
      const j = M.jetons(lu(f));
      for (let k = 0; k < j.length - 1; k++) {
        const x = j[k], av = j[k - 1], ap = j[k + 1];
        if (x.t !== 'id' || !importes.has(x.v) || locaux.has(x.v)) continue;
        if (av && (av.v === '.' || av.v === '?.')) continue;
        if (/^(?:=|\+=|-=|\*=|\/=|%=|\|\|=|&&=|\?\?=|\+\+|--)$/.test(ap.v) || (av && /^(?:\+\+|--)$/.test(av.v)))
          fautes.push(f + ' réassigne ' + x.v);
      }
    }
    assert.deepEqual(fautes, []);
  });

  t('modules : node test/run.js lance chaque fichier de test/*.test.js', () => {
    const ici = fs.readFileSync(__filename, 'utf8');
    for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')))
      assert.ok(ici.includes("require('./" + f.replace(/\.js$/, '') + "')"), f + ' n\'est lancé par personne');
  });

  t('modules : le panneau se charge en vrais modules ES, onglet par onglet', () => {
    /* Un processus par onglet : un module ne s'évalue qu'une fois par
       processus. Chaque outil de l'onglet Outils a sa vue. */
    const { spawnSync } = require('child_process');
    const cas = [['today'], ['empire'], ['settings'],
      ...['explore', 'server', 'research', 'moon', 'defense', 'fleet', 'colony'].map(o => ['tools', o])];
    for (const c of cas) {
      const r = spawnSync(process.execPath, [path.join(__dirname, 'esm.js'), ...c], { encoding: 'utf8', env: { ...process.env } });
      assert.equal(r.status, 0, c.join(' › ') + ' : ' + (r.stderr || r.stdout).slice(0, 1500));
    }
  });
}

t('le manifeste donné au joueur reste du JSON, sans notre clé', () => {
  /* pack.sh retire la ligne `"key"` du manifeste qu'il met dans le zip, avec un
     `grep -v`. C'est une découpe au texte : elle tient parce que la clé est sur
     une ligne à elle et n'est pas la dernière propriété. Reformate le manifeste
     et le zip part avec un JSON cassé — l'extension ne se charge plus du tout,
     et c'est le joueur d'en face qui le découvre. On refait donc ici la même
     découpe, et on relit. */
  const fs = require('fs'), path = require('path');
  const root = path.join(__dirname, '..');
  const brut = fs.readFileSync(path.join(root, 'manifest.json'), 'utf8');
  assert.ok(/^\s*"key"/m.test(brut), 'plus de clé dans le manifeste : pack.sh découpe une ligne qui n\'existe pas');
  const coupe = brut.split('\n').filter(l => !l.includes('"key"')).join('\n');
  const m = JSON.parse(coupe);
  assert.ok(!m.key, 'la clé survit à la découpe de pack.sh');
  assert.equal(m.version, JSON.parse(brut).version, 'la découpe a emporté autre chose que la clé');
});

/* ---------- version, historique, mise à jour ---------- */

t('une version se compare nombre par nombre, pas comme une chaîne', () => {
  const g = app();
  assert.ok(g.plusRecente('2.9.0', '2.10.0'), '2.10.0 vient après 2.9.0, ce que l\'ordre des chaînes dit à l\'envers');
  assert.ok(!g.plusRecente('2.10.0', '2.9.0'));
  assert.ok(g.plusRecente('2.4.0', '2.4.1'));
  assert.ok(!g.plusRecente('2.4.0', '2.4.0'), 'la même version n\'est pas plus récente');
  assert.ok(g.plusRecente('2.4', '2.4.1'), 'un numéro plus court se complète par des zéros');
  assert.ok(!g.plusRecente('3.0.0', '2.99.99'));
});

t('la carte Version dit quoi taper quand le dépôt est devant', () => {
  const g = app();
  const h = lu(g.versionCard('9.9.9', []));
  assert.match(h, /v9\.9\.9/, 'la version du dépôt est annoncée');
  assert.match(h, /git pull && \.\/pack\.sh/, 'la commande à taper, telle quelle');
  assert.match(h, /chrome:\/\/extensions/, 'et le rechargement, que la commande ne fait pas');
});

t("la carte Version ne réclame rien quand le panneau est à jour", () => {
  const g = app();
  const h = lu(g.versionCard('0.0.1', []));
  assert.ok(!/git pull/.test(h), 'un dépôt en retard sur le panneau ne demande pas de mise à jour');
  assert.match(h, /dernière du dépôt/);
});

t("la carte Version ne prétend pas être à jour quand le dépôt est muet", () => {
  const g = app();
  const h = lu(g.versionCard(null, []));
  assert.ok(!/dernière du dépôt/.test(h), 'réseau coupé : le panneau ne sait pas, et le dit');
  assert.match(h, /n'a pas pu être lue/);
});

t("l'historique liste chaque version avec son empreinte, et l'échappe", () => {
  const g = app();
  const h = g.versionCard(null, [['2.4.0', '2026-11-26', '2e4e020', 'feat: <b>gras</b> & co']]);
  assert.match(h, /v2\.4\.0/);
  assert.match(h, /2e4e020/, 'l\'empreinte est là : c\'est ce qu\'on passe à git checkout');
  assert.match(lu(h), /git checkout/, 'et la commande pour y revenir');
  assert.ok(!/<b>gras<\/b>/.test(h), 'un sujet de commit est du texte, pas du HTML');
});

t("sans historique, la carte Version le dit au lieu de montrer un vide", () => {
  const g = app();
  assert.match(lu(g.versionCard(null, [])), /au prochain <code>\.\/pack\.sh/);
});

t('dist/versions.tsv porte quatre colonnes par version', () => {
  /* Le fichier est écrit au shell par pack.sh et relu par le panneau : une
     colonne de travers et l'historique disparaît sans rien dire (le filtre
     jette les lignes courtes). Rien à vérifier tant que dist/ n'existe pas. */
  const fs = require('fs'), path = require('path');
  const p = path.join(__dirname, '..', 'dist', 'versions.tsv');
  if (!fs.existsSync(p)) return;
  const lignes = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean);
  assert.ok(lignes.length, 'dist/versions.tsv est vide : pack.sh n\'a rien pu lire de git');
  for (const l of lignes) {
    const c = l.split('\t');
    assert.equal(c.length, 4, 'ligne mal formée : ' + l);
    assert.match(c[0], /^\d+\.\d+\.\d+$/, 'le numéro de version : ' + l);
    assert.match(c[1], /^\d{4}-\d{2}-\d{2}$/, 'la date : ' + l);
    assert.match(c[2], /^[0-9a-f]{7,}$/, 'l\'empreinte : ' + l);
  }
});

t('l\'historique de pack.sh suit la ligne de main, pas les branches fusionnées', () => {
  /* Sans --first-parent, une branche partie avant un changement de numéro
     glisse l'ancien entre deux occurrences du nouveau, et le test suivant
     crie à la réutilisation sur un poste qui a lancé ./pack.sh. */
  const sh = require('fs').readFileSync(require('path').join(__dirname, '..', 'pack.sh'), 'utf8');
  assert.match(sh, /git log --first-parent /, 'pack.sh doit lire l\'historique en --first-parent');
});

t('un numéro de version ne ressert jamais', () => {
  /* Rien ne garde ce numéro : il se tape à la main dans deux fichiers, et quand
     plusieurs branches avancent ensemble, deux d'entre elles le prennent sans
     le savoir — c'est arrivé le 2026-11-26, et quatre fois avant sans qu'on le
     remarque (1.61.0, 1.63.0, 1.65.0 et 2.0.0 sont dans l'historique en double).
     `versions.tsv` liste les versions déjà livrées, celles de main comprises
     après un rebase : il suffit de le relire. Sa ligne de tête est la version
     courante, c'est la seule occurrence permise. Rien à dire tant que `dist/`
     n'existe pas, un dépôt fraîchement cloné n'en a pas. */
  const fs = require('fs'), path = require('path');
  const root = path.join(__dirname, '..');
  const p = path.join(root, 'dist', 'versions.tsv');
  if (!fs.existsSync(p)) return;
  const ici = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')).version;
  const numeros = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean)
    .map(l => l.split('\t')[0]);
  /* La version courante a le droit d'occuper les lignes de tête consécutives :
     une fusion par commit de fusion reprend le numéro de la tête qu'elle
     intègre, donc le même numéro s'y répète sans que personne l'ait réutilisé.
     Ce qui est interdit, c'est qu'il reparaisse après qu'un autre soit passé —
     là, quelqu'un a repris un numéro déjà dépassé. */
  let i = 0; while (i < numeros.length && numeros[i] === ici) i++;
  assert.ok(!numeros.slice(i).includes(ici),
    'la version ' + ici + ' a déjà été livrée : prends le numéro suivant');
});

t('un dist/ déjà construit ne reste pas en retard sur le dépôt', () => {
  /* `dist/` est ce que Chrome charge, et il est ignoré par git : il peut donc
     vieillir pendant que `git status` reste propre. C'est ce qui est arrivé le
     2026-11-24 — six commits et trois versions plus tard, le navigateur
     chargeait toujours celle d'avant, et recharger l'extension ne pouvait rien
     y faire. Rien à dire tant que `dist/` n'existe pas, un dépôt fraîchement
     cloné n'en a pas ; dès qu'il existe, il porte la version du dépôt. */
  const fs = require('fs'), path = require('path');
  const root = path.join(__dirname, '..');
  const bati = path.join(root, 'dist', 'manifest.json');
  if (!fs.existsSync(bati)) return;
  const ici = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')).version;
  const la = JSON.parse(fs.readFileSync(bati, 'utf8')).version;
  assert.equal(la, ici, 'dist/ porte ' + la + ' et le dépôt ' + ici + ' : relance ./pack.sh');
});

/* ---------- résultat ---------- */

/* ---------- spécification v2 : formules isolées : test/formules.test.js ---------- */
require('./formules.test')({ t, app, assert });

/* ---------- le hangar ne bloque pas une livraison ---------- */

t('un coût au-dessus du hangar nomme le niveau qui le logerait, pas un mur', () => {
  const g = app(s => { s.planets[0].b.scrystal = 4; s.tech.astro = 6; });
  const w = g.waitFor(g.S.planets[0], g.levelCost(g.T.astro, 7));
  assert.ok(w.small && w.small.length, 'le hangar est trop petit pour la production locale');
  const c = w.small.find(x => x.k === 'scrystal');
  assert.ok(c, 'c\'est le cristal qui manque de place : ' + JSON.stringify(w.small));
  assert.equal(c.lvl, 5, 'Hangar de cristal 5 suffit (255 000 ≥ 229 800) : jamais 6');
});

t('le hangar juste assez grand ne déclenche rien', () => {
  const g = app(s => { s.planets[0].b.scrystal = 5; s.planets[0].b.smetal = 5; s.planets[0].b.sdeut = 5; s.tech.astro = 6; });
  const w = g.waitFor(g.S.planets[0], g.levelCost(g.T.astro, 7));
  assert.ok(!w.small, 'rien à agrandir : ' + JSON.stringify(w.small));
});

/* ---------- l'Éclaireur n'est pas proposé hors Explorateur ---------- */

t('un Collectionneur ne se voit jamais proposer un éclaireur', () => {
  const g = app(s => {
    s.settings.cls = 'collector';
    s.tech.hyperdrive = 2; s.tech.hyper = 3;
    s.planets[0].b.shipyard = 5;
    s.planets[0].stock = { m: 2e6, c: 2e6, d: 1e6, at: SOIR };
  });
  const acts = g.simulateDay().sessions.flatMap(x => x.acts);
  assert.ok(!acts.some(a => /éclaireur/i.test(a.what || '')),
    'le chantier d\'un Collectionneur ne l\'affiche pas');
});

/* ---------- le carburant voyage dans la soute ---------- */
/* Le plein sort de la soute : ce que la flotte emporte, c'est la soute moins le
   carburant. Compté brut, le copilote annonçait un butin qu'elle ne pouvait pas
   charger, et un vol lointain le faisait d'autant plus. */

t('la soute annoncée par un vol est nette du carburant', () => {
  const g = app();
  const pres = g.flight('1:142:8', '1:142:9', { lc: 10 }, 100);
  const loin = g.flight('1:142:8', '5:300:8', { lc: 10 }, 100);
  assert.ok(loin.fuel > pres.fuel, 'le trajet lointain coûte plus de carburant');
  // La soute du vaisseau ne change pas avec la distance : soute + plein est donc
  // constant, et ce qui reste à charger baisse avec l'éloignement.
  assert.equal(pres.cargo + pres.fuel, loin.cargo + loin.fuel);
  assert.ok(loin.cargo < pres.cargo, `${loin.cargo} contre ${pres.cargo}`);
});

t('un pillage lointain n\'emporte pas plus que sa soute moins le plein', () => {
  const g = app(s => {
    s.planets[0].ships = { lc: 2 };
    s.raid = { coords: '4:300:9', m: 60000, c: 0, d: 0, safe: true, at: SOIR - 600e3 };
  });
  const r = g.raidPlan();
  assert.ok(r.fuel > 0, 'le trajet coûte du carburant : ' + r.fuel);
  assert.ok(r.got <= 2 * 25000 - r.fuel,
    `${r.got} emportés pour ${2 * 25000 - r.fuel} de soute utile`);
});

/* ---------- un rapport d'espionnage vieillit ---------- */

t('un rapport de plus de deux heures est marqué périmé', () => {
  const vieux = app(s => { s.raid = { coords: '1:142:9', m: 50000, c: 20000, d: 0, safe: true, at: SOIR - 3 * 3600e3 }; });
  assert.equal(vieux.raidPlan().stale, true);
  const frais = app(s => { s.raid = { coords: '1:142:9', m: 50000, c: 20000, d: 0, safe: true, at: SOIR - 600e3 }; });
  assert.equal(frais.raidPlan().stale, false);
});

t('un rapport périmé ne produit aucune carte de pillage', () => {
  const g = app(s => { s.raid = { coords: '1:142:9', m: 50000, c: 20000, d: 0, safe: true, at: SOIR - 3 * 3600e3 }; });
  assert.ok(!g.dailyMissions().some(m => m.id === 'raid-go'),
    'on réespionne avant d\'attaquer');
});

/* ---------- lire un rapport d'espionnage ---------- */

/** Un rapport de test, tel que le joueur le collerait. */
const lire = n => require('fs').readFileSync(require('path').join(__dirname, 'rapports', n), 'utf8');

t('un rapport sans section Défense lisible rend une défense inconnue, pas nulle', () => {
  const r = app().parseReport(lire('faible.txt'));
  assert.strictEqual(r.def, null, 'le jeu a dit qu\'il n\'avait rien vu : inconnue');
  assert.strictEqual(r.fleet, null, 'la flotte aussi');
  assert.deepEqual(r.res, [0, 0, 0], 'les ressources, elles, sont là');
});

t('une section Défense sans aucune ligne vaut zéro', () => {
  const r = app().parseReport(lire('nue.txt'));
  assert.deepEqual(r.def, {}, 'lue, et vide');
  assert.deepEqual(r.fleet, {});
});

t('un rapport complet rend la flotte et la défense par type', () => {
  const r = app().parseReport(lire('complet.txt'));
  assert.equal(r.def.rl, 45, 'les lanceurs de missiles sont comptés');
  assert.equal(r.def.ll, 12);
  assert.equal(r.fleet.sc, 12, 'les petits transporteurs aussi');
  assert.equal(r.fleet.sat, 30, 'et les satellites, qui ne se battent pas');
});

t('un libellé hors vocabulaire rend la section inconnue', () => {
  const txt = lire('nue.txt').replace('Défense', 'Défense\nTourelle fantôme\n4');
  assert.strictEqual(app().parseReport(txt).def, null,
    'lu sans comprendre n\'est pas compris vide');
});

t('les lignes d\'un bâtiment ne tombent pas dans la défense qui précède', () => {
  assert.deepEqual(app().parseReport(lire('nue.txt')).def, {},
    'le titre Bâtiment ferme la section Défense');
});

t('un libellé suivi de son nombre sur la même ligne se lit aussi', () => {
  const txt = 'Défense\nLanceur de missiles 45\nCommentaires';
  assert.equal(app().parseReport(txt).def.rl, 45);
});

t('le taux de butin se lit dans l\'en-tête', () => {
  assert.equal(app().parseReport(lire('complet.txt')).loot, 0.75);
  assert.equal(app().parseReport(lire('nue.txt')).loot, 0.5);
});

t('un rapport qui ne dit pas le butin ne l\'invente pas', () => {
  assert.strictEqual(app().parseReport('Métal\n10').loot, null);
});

t('les trois ressources se lisent encore comme avant', () => {
  assert.deepEqual(app().parseReport('Métal\n1.234\nCristal\n567\nDeutérium\n89').res,
    [1234, 567, 89]);
});

t('un collage sans ressources ne rend aucune ressource', () => {
  assert.strictEqual(app().parseReport('Défense\nCommentaires').res, null);
});

/* ---------- le collage remplit la case ---------- */

/** Une cible préparée, prête à recevoir un rapport. */
const cible = (extra) => s => { s.raid = Object.assign({ coords: '1:142:9', m: 0, c: 0, d: 0, safe: false }, extra); };

t('un rapport nu coche la case', () => {
  const g = app(cible({ coords: '2:88:4' }));
  g.applyReport(lire('nue.txt'));
  assert.strictEqual(g.S.raid.safe, true, 'ni flotte ni défense : la cible est nue');
});

t('un rapport avec défense décoche la case', () => {
  const g = app(cible({ coords: '3:120:7', safe: true }));
  g.applyReport(lire('complet.txt'));
  assert.strictEqual(g.S.raid.safe, false, 'la défense lue reprend la parole du joueur');
});

t('un rapport trop faible décoche aussi, et dit que la défense est inconnue', () => {
  const g = app(cible({ coords: '1:65:12', safe: true }));
  g.applyReport(lire('faible.txt'));
  assert.strictEqual(g.S.raid.safe, false);
  assert.strictEqual(g.S.raid.def, null, 'inconnue, pas vide');
});

t('un second collage efface la défense du premier', () => {
  const g = app(cible({ coords: '3:120:7' }));
  g.applyReport(lire('complet.txt'));
  assert.equal(g.S.raid.def.rl, 45, 'le premier rapport est bien lu');
  g.applyReport('Flottes\nAucune donnée fiable n\u0060a pu être détectée pour ce type en scannant.\nDéfense\nAucune donnée fiable n\u0060a pu être détectée pour ce type en scannant.\nCommentaires');
  assert.strictEqual(g.S.raid.def, null,
    'la défense d\'hier ne se lit pas sur la cible d\'aujourd\'hui');
});

t('un collage sans ressources laisse celles qui ont été tapées', () => {
  const g = app(cible({ m: 50000 }));
  g.applyReport('Défense\nCommentaires');
  assert.equal(g.S.raid.m, 50000,
    'un chiffre tapé à la main est une information du joueur');
});

t('une flotte de satellites et de sondes ne bloque pas le pillage', () => {
  const g = app(cible({ coords: '2:88:4' }));
  g.applyReport(lire('nue.txt').replace('Flottes', 'Flottes\nSatellite solaire\n12\nSonde d`espionnage\n3'));
  assert.strictEqual(g.S.raid.safe, true, 'ni l\'un ni l\'autre ne tire');
});

t('un petit transporteur au sol, lui, bloque le pillage', () => {
  const g = app(cible({ coords: '2:88:4' }));
  g.applyReport(lire('nue.txt').replace('Flottes', 'Flottes\nPetit transporteur\n2'));
  assert.strictEqual(g.S.raid.safe, false, 'c\'est un combat, et le copilote n\'en simule aucun');
});

/* Un libellé reconnu dont le compte ne suit pas laissait la section « lue et
   vide », donc la cible « nue », alors que le mot était sous les yeux du
   joueur. Le balayage vaut mieux que six cas ponctuels : c'est l'invariant
   qu'on protège, pas une mise en page. */
t('aucun rapport mal formé ne fait passer une cible pour nue', () => {
  const mauvais = [
    'Ressources\nMétal\n200.000\nFlottes\nDéfense\nLanceur de missiles',
    'Défense\nLanceur de missiles\nLaser léger\n12\nCommentaires',
    'Défense\nLanceur de missiles\nBâtiment\nUsine de robots\n4',
    'Flottes\nCroiseur\nDéfense\nCommentaires',
    'Défense\n45 Lanceur de missiles\nCommentaires'
  ];
  for(const txt of mauvais){
    const g = app(cible());
    g.applyReport(txt);
    assert.strictEqual(g.S.raid.safe, false,
      'un compte non apparié rend la section inconnue : ' + JSON.stringify(txt));
  }
});

t('un libellé sans son compte rend la section inconnue, pas vide', () => {
  const g = app(cible());
  g.applyReport('Flottes\nDéfense\nLanceur de missiles');
  assert.strictEqual(g.S.raid.def, null, 'lu à moitié n\'est pas lu');
});

t('un collage sans ressources ne rajeunit pas le rapport', () => {
  const g = app(cible({ m: 50000, at: SOIR - 5 * 3600e3 }));
  assert.equal(g.raidPlan().stale, true, 'le rapport est bien périmé au départ');
  g.applyReport('x');
  assert.equal(g.raidPlan().stale, true,
    'taper dans la zone ne remplace pas un espionnage');
});

t('un rapport qui parle d\'une autre planète n\'est pas appliqué', () => {
  const g = app(cible({ m: 50000 }));
  g.applyReport(lire('nue.txt'));
  assert.strictEqual(g.S.raid.safe, false, 'le rapport porte [2:88:4], la cible est 1:142:9');
  assert.equal(g.S.raid.m, 50000, 'et rien n\'est écrasé');
  assert.equal(g.S.raid.mismatch, '2:88:4', 'la carte pourra le dire');
});

t('le même rapport sur la bonne cible, lui, s\'applique', () => {
  const g = app(cible({ coords: '2:88:4' }));
  g.applyReport(lire('nue.txt'));
  assert.strictEqual(g.S.raid.safe, true);
  assert.ok(!g.S.raid.mismatch);
});

t('le butin lu dans le rapport est retenu', () => {
  const g = app(cible({ coords: '3:120:7' }));
  g.applyReport(lire('complet.txt'));
  assert.equal(g.S.raid.lootSeen, 0.75);
});

/* ---------- ce que la défense vaut, face au butin ---------- */

t('la défense lue est chiffrée au prix que le copilote paie pour la sienne', () => {
  const g = app(cible({ m: 100000, at: SOIR, def: { rl: 45 } }));
  const r = g.raidPlan();
  assert.equal(r.defValue, g.mse(45 * 2000, 0, 0));
  assert.ok(/45 lanceurs de missiles/.test(r.defList), r.defList);
});

t('une défense inconnue ne se chiffre pas', () => {
  const g = app(cible({ m: 100000, at: SOIR, def: null }));
  assert.strictEqual(g.raidPlan().defValue, null);
});

t('le taux de butin lu dans le rapport remplace celui déduit de la classe', () => {
  const g = app(cible({ m: 100000, at: SOIR, lootSeen: 0.75 }));
  const r = g.raidPlan();
  assert.equal(r.rateSeen, true);
  assert.equal(r.loot[0], 75000, 'le butin suit le rapport, pas la classe');
});

t('sans butin lu, la déduction par la classe tient', () => {
  const g = app(cible({ m: 100000, at: SOIR }));
  const r = g.raidPlan();
  assert.equal(r.rateSeen, false);
  assert.equal(r.loot[0], 50000);
});

/** Le HTML que la carte de pillage écrit dans #rdPlan. */
function carteRaidHtml(extra) {
  const g = app(s => {
    s.planets[0].ships = { lc: 10 };
    cible(extra)(s);
  }, SOIR, { planets: [['1:140:8', 'p1']], players: { p1: ['Alpha', 'i'] }, scores: { p1: [1000] } });
  g.REFRESH.explore();
  return g.html().rdPlan || '';
}

t('la carte pose la comparaison et ne compose aucun pillage', () => {
  const h = carteRaidHtml({ m: 100000, at: SOIR, def: { rl: 45 }, fleet: {} });
  assert.ok(/45 lanceurs de missiles/.test(h), 'ce qui a été lu : ' + h.slice(0, 400));
  assert.ok(/70 %/.test(h), 'et ce que percer coûte vraiment');
  assert.ok(!/data-launch/.test(h), 'aucune action d\'attaque');
});

t('la carte nomme la flotte adverse sans la chiffrer', () => {
  const h = carteRaidHtml({ m: 100000, at: SOIR, def: {}, fleet: { cr: 40 } });
  assert.ok(/40 croiseurs/.test(h), 'la flotte est nommée : ' + h.slice(0, 400));
  assert.ok(!/data-launch/.test(h), 'et rien n\'est composé');
});

/* Le verdict comparait un équivalent métal à une somme brute. Sur une cible
   riche en cristal et en deutérium, il disait « trop cher » d'une défense que
   le butin payait largement. */
t('le verdict compare deux équivalents métal, pas une pomme et une poire', () => {
  const h = carteRaidHtml({ m: 80000, c: 80000, d: 40000, at: SOIR, def: { gc: 3 }, fleet: {} });
  assert.ok(/3 canons de Gauss/.test(h), 'la défense est bien lue : ' + h.slice(0, 200));
  assert.ok(!/Percer coûte plus cher/.test(h),
    '145 500 de défense contre 160 000 de butin en équivalent métal');
});

t('une cible vide dit quand même que sa défense est inconnue', () => {
  const h = carteRaidHtml({ m: 0, c: 0, d: 0, at: SOIR, def: null, fleet: null });
  assert.ok(/ne montre pas/.test(h),
    'le collage ne doit pas avoir l\'air d\'avoir échoué : ' + h.slice(0, 300));
});

t('un rapport collé sur la mauvaise cible se voit', () => {
  const h = carteRaidHtml({ m: 50000, at: SOIR, mismatch: '2:88:4' });
  assert.ok(/2:88:4/.test(h), 'la carte nomme la planète du rapport : ' + h.slice(0, 300));
  assert.ok(!/data-launch/.test(h), 'et ne compose rien');
});

t('une cible nue, elle, compose bien l\'attaque', () => {
  const h = carteRaidHtml({ m: 100000, at: SOIR, def: {}, fleet: {}, safe: true });
  assert.ok(/data-launch/.test(h), 'le bouton est là quand tout est lu et vide');
});

t('la carte dit laquelle des deux sections manque', () => {
  const h = carteRaidHtml({ m: 100000, at: SOIR, def: null, fleet: {} });
  assert.ok(/défense/i.test(h) && /sonde/i.test(h),
    'elle nomme la défense inconnue et ce qui la montrerait : ' + h.slice(0, 400));
});

/* ---------- le statut hors-la-loi s'éteint à 500 000 points ---------- */

/** Un seul inactif voisin, plus fort que le joueur, et les scores qu'on veut. */
const apiPlusFort = moi => ({
  planets: [['1:140:8', 'p1']],
  players: { p1: ['Alpha', 'i'] },
  scores: moi == null ? { p1: [900000] } : { p1: [900000], moi: [moi] }
});

t('au-dessus de 500 000 points, un inactif plus fort reste une cible', () => {
  const g = app(s => { s.me = 'moi'; }, SOIR, apiPlusFort(600000));
  assert.equal(g.raidTargets()[0].outlaw, false,
    'le statut hors-la-loi n\'a plus d\'effet passé 500 000 points');
});

t('en dessous de 500 000 points, un inactif plus fort reste écarté', () => {
  const g = app(s => { s.me = 'moi'; }, SOIR, apiPlusFort(100000));
  assert.equal(g.raidTargets()[0].outlaw, true);
});

t('score du joueur inconnu : la prudence d\'avant ne bouge pas', () => {
  const g = app(s => { s.me = null; }, SOIR, apiPlusFort(null));
  assert.equal(g.raidTargets()[0].outlaw, false,
    'sans score, rien à comparer — comme aujourd\'hui');
});

/* ---------- les foreuses entrent dans le classement ---------- */

t('les foreuses se classent avec les mines quand le chantier les permet', () => {
  const g = app(s => {
    s.planets[0].b.shipyard = 5; s.tech.combustion = 4; s.tech.armour = 4; s.tech.laser = 4;
  });
  const r = g.rankUpgrades(g.S.planets[0]);
  const cw = r.find(u => u.key === 'crawl');
  assert.ok(cw, 'les foreuses sont une option du classement');
  assert.ok(cw.payback > 0 && isFinite(cw.payback), 'avec un amortissement chiffré : ' + cw.payback);
});

/* Le jeu exige aussi Laser 4 pour la foreuse. Sans ce prérequis le plan la
   proposait, et le chantier refusait. */
t('sans Laser 4, aucune foreuse proposée', () => {
  const g = app(s => {
    s.planets[0].b.shipyard = 5; s.tech.combustion = 4; s.tech.armour = 4; s.tech.laser = 3;
  });
  assert.ok(!g.rankUpgrades(g.S.planets[0]).some(u => u.key === 'crawl'));
});

t('sans le chantier qui les construit, aucune foreuse proposée', () => {
  const g = app();
  assert.ok(!g.rankUpgrades(g.S.planets[0]).some(u => u.key === 'crawl'));
});

/* ---------- les foreuses construites comptent ---------- */
/* Le jeu n'écrit la foreuse (217) que dans `crawlers`, jamais dans la flotte :
   217 ne figure pas dans OG_SHIPS. Le code simulé doit faire pareil, sans quoi
   la production ne voit jamais les foreuses et le plan les repropose. */

t('la fin d\'un minuteur de foreuses crédite le compte, pas la flotte', () => {
  const g = app();
  const p = g.S.planets[0];
  g.finishTimer({ kind: 'x', k: 'shipyard', pid: p.id, ships: { crawl: 40 }, end: SOIR });
  assert.equal(p.crawlers, 40, 'les foreuses doivent compter');
  assert.ok(!(p.ships && p.ships.crawl), 'et ne pas atterrir dans la flotte');
});

t('un minuteur lu dans le jeu ne touche pas au compte', () => {
  const g = app();
  const p = g.S.planets[0];
  p.crawlers = 120;
  g.finishTimer({ kind: 'x', k: 'shipyard', pid: p.id, ships: { crawl: 40 }, end: SOIR, game: true });
  assert.equal(p.crawlers, 120, 'la lecture du jeu fait foi');
});

/* Mines hautes et énergie large : un niveau de mine coûte alors assez cher pour
   que les foreuses passent devant, ce que le classement sait faire depuis
   toujours — mais que la boucle du chantier comparait par identité d'objet. */
const MINES_HAUTES = armour => s => {
  const p = s.planets[0];
  Object.assign(p.b, { metal: 28, crystal: 26, deut: 24, solar: 44, shipyard: 6 });
  // Laser 4 est l'autre prérequis de la foreuse ; l'armure reste l'interrupteur.
  s.tech.laser = 4;
  s.tech.armour = armour;
  p.stock = { m: 9e7, c: 9e7, d: 9e7, at: SOIR };
};

t('une carte de foreuses est proposee quand elles sont en tete du classement', () => {
  const g = app(MINES_HAUTES(4));
  assert.equal(g.rankUpgrades(g.S.planets[0])[0].key, 'crawl',
    'préalable du test : les foreuses doivent être en tête du classement');
  const cartes = g.simulateDay().sessions.flatMap(x => x.acts).filter(a => a.ships && a.ships.crawl);
  assert.ok(cartes.length, 'aucune carte de foreuses sur tout l\'horizon');
});

t('les lots de foreuses avancent et s\'arretent au plafond', () => {
  // La preuve que le compte avance : le moteur en pose 10 % du plafond par
  // connexion, et le dernier lot est rogné pour tomber juste. Avec le compte
  // figé, il aurait reproposé le même lot sans jamais s'arrêter.
  // La planète part près du plafond : un lot occupe son chantier une demi-
  // journée, et une journée n'en voit pas dix.
  const deja = 500;
  const g = app(s => { MINES_HAUTES(4)(s); s.planets[0].crawlers = deja; });
  const p = g.S.planets[0];
  const max = g.crawlerMax(p.b.metal, p.b.crystal, p.b.deut);
  const lots = g.simulateDay().sessions.flatMap(x => x.acts)
    .filter(a => a.ships && a.ships.crawl).map(a => a.ships.crawl);
  assert.ok(lots.length > 1, 'le plafond se remplit en plusieurs lots');
  assert.equal(deja + lots.reduce((a, b) => a + b, 0), max,
    'les lots doivent atteindre le plafond exactement, et donc s\'arrêter : ' + lots.join(','));
  assert.ok(lots[lots.length - 1] < lots[0], 'le dernier lot est rogné pour tomber juste');
});

t('le gain des foreuses se voit dans la journee', () => {
  // Armure 4 ouvre les foreuses, armure 0 les interdit : même planète sinon.
  const avec = app(MINES_HAUTES(4)).simulateDay();
  const sans = app(MINES_HAUTES(0)).simulateDay();
  assert.ok(avec.endV - avec.startV > sans.endV - sans.startV,
    'la journée avec foreuses doit produire plus : ' +
    Math.round(avec.endV - avec.startV) + ' contre ' + Math.round(sans.endV - sans.startV));
});

/* ---------- la pastille de foreuses ---------- */
/* Les foreuses sont invisibles dans le jeu une fois posées : la carte de
   planète est le seul endroit qui dit combien en profitent encore. */

t('la carte de planete dit combien de foreuses servent', () => {
  const g = app(s => { s.planets[0].crawlers = 120; });
  g.REFRESH.planets();
  const html = g.html()['pres-0'] || '';
  assert.ok(/120\s*\/\s*288/.test(html),
    'le compte et le plafond (8 x (14+12+10)) doivent figurer : ' + html.slice(0, 300));
});

t('la pastille de foreuses occupe toute la largeur des jauges', () => {
  // Les jauges sont une grille de quatre colonnes : posée telle quelle, la
  // pastille tiendrait dans une colonne et son texte déborderait sa bordure.
  const g = app(s => { s.planets[0].crawlers = 120; });
  g.REFRESH.planets();
  assert.ok(/class="wide"[^>]*>\s*<span class="pill/.test(g.html()['pres-0'] || ''),
    'la pastille doit être dans un bandeau pleine largeur');
});

/* L'écran Objectifs tenait une liste que rien ne lisait : le plan du jour ne
   la regardait pas. Supprimé, son nom peut rester dans les réglages du joueur
   — Outils ne doit pas s'ouvrir sur le vide. */
t('l\'onglet Objectifs n\'existe plus, et un réglage périmé retombe sur Colonie', () => {
  const g = app(s => { s.ui.tool = 'plan'; });
  assert.ok(!g.REFRESH.plan, 'plus d\'écran Objectifs');
  g.REFRESH.tools();
  assert.ok(/plan\u00e8tes/.test(g.html().coSlots || ''), 'Outils ouvre Colonie : ' + (g.html().coSlots || ''));
});

t('pas de pastille quand aucune foreuse n\'est possible', () => {
  const g = app(s => {
    Object.assign(s.planets[0].b, { metal: 0, crystal: 0, deut: 0 });
  });
  g.REFRESH.planets();
  assert.ok(!/[Ff]oreuse/.test(g.html()['pres-0'] || ''),
    'plafond nul : rien à dire');
});

/* ---------- le fil du debut de partie ---------- */

t('le bloc de progression nomme la prochaine etape', () => {
  const g = app(s => { s.planets[0].b.lab = 2; s.tech.impulse = 0; });
  g.REFRESH.today();
  const html = g.html().tdDay || '';
  assert.ok(/Prochaine étape/.test(html), 'le bloc doit être rendu : ' + html.slice(0, 300));
  assert.ok(/\d+\s*\/\s*11/.test(html), 'et porter le compte sur onze');
});

t('les jalons franchis dans le desordre comptent quand meme', () => {
  // Astro 3 est tenu, Ordinateur 2 aussi, mais le labo est à 2 : le compte
  // doit refléter ce qui est franchi, pas l'indice du premier manquant.
  const g = app(s => { s.planets[0].b.lab = 2; });
  g.REFRESH.today();
  const m = /(\d+)\s*\/\s*11/.exec(g.html().tdDay || '');
  assert.ok(m, 'le compte doit être rendu');
  assert.ok(+m[1] >= 9, 'neuf jalons au moins sont franchis ici, et non 7 : ' + (m && m[1]));
});

/* ---------- les alertes ne dependent plus d'un second moteur ---------- */
/* Elles sortaient d'adviceList, moteur parallèle que simulateDay et
   dailyMissions avaient rattrapé. Elles viennent désormais d'une passe par
   planète, sans garde de file : un bâtiment en cours ne doit rien taire. */

t('energie negative et hangar plein sont dits tous les deux', () => {
  const g = app(s => {
    const p = s.planets[0];
    Object.assign(p.b, { metal: 20, solar: 1, smetal: 0 });
    p.stock = { m: 9e9, c: 0, d: 0, at: SOIR };
  });
  const a = g.simulateDay().alerts;
  assert.ok(a.some(x => /[Éé]nergie/.test(x.what)), 'l\'énergie négative doit être dite');
  assert.ok(a.some(x => /au plafond/.test(x.what)), 'le hangar plein aussi');
});

/* rules.json illisible, ou plus ancien que le code : les alertes que les
   règles ont remplacées sortent quand même, avec les mêmes mots. */
function appSecours(rules, modifier) {
  const s = fixtureState();
  s.planets.forEach(p => { p.stock.at = SOIR; });
  if (modifier) modifier(s);
  return loadApp(s, SOIR, ['simulateDay', 'planetAlerts', 'constats', 'regle', 'S', 'REGLES_SECOURS'], null, false, null, rules);
}
const VIDE_ET_PLEIN = s => { Object.assign(s.planets[0].b, { metal: 20, solar: 1, smetal: 0 }); s.planets[0].stock = { m: 9e9, c: 0, d: 0, at: SOIR }; };

t('rules.json illisible : énergie négative et hangar plein sont dits quand même', () => {
  for (const [nom, rules] of [['illisible', null], ['sans ces règles', { version: 1, regles: [] }]]) {
    const g = appSecours(rules, VIDE_ET_PLEIN);
    const a = g.planetAlerts(g.S.planets[0]);
    assert.ok(a.some(x => x.sev === 'bad' && /^Rétablir l'énergie/.test(x.what)), nom + ' : l\'énergie : ' + JSON.stringify(a));
    assert.ok(a.some(x => x.sev === 'bad' && /^Métal au plafond/.test(x.what)), nom + ' : le hangar');
    assert.ok(g.constats().some(x => x.regle === 'RES_ENERGY_NEGATIVE'), nom + ' : et constats() les compte');
  }
});

t('le repli et rules.json disent la même chose', () => {
  const fichier = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'rules.json'), 'utf8'));
  const sec = appSecours(null).REGLES_SECOURS;
  for (const id of Object.keys(sec)) {
    const f = fichier.regles.find(r => r.id === id);
    assert.ok(f, id + ' manque dans rules.json');
    for (const k of ['domaine', 'cat', 'niveau', 'condition', 'parametres', 'effet', 'message', 'raison', 'actif_par_defaut', 'verrou'])
      assert.deepEqual(sec[id][k], f[k], id + '.' + k + ' diffère entre app.js et rules.json');
  }
  assert.deepEqual(appSecours(undefined).REGLES_SECOURS, {}, 'le fichier lu, le repli ne sert à rien');
});

t('rules.json illisible : les réglages de règles du joueur ne sont pas effacés', () => {
  const reg = { INST_QUEUE_EMPTY: { on: false }, RES_STORAGE_SOON: { p: { heures: 12 } } };
  const g = appSecours(null, s => { s.settings.regles = JSON.parse(JSON.stringify(reg)); });
  assert.deepEqual(g.S.settings.regles, reg);
  assert.equal(g.regle('RES_STORAGE_SOON').parametres.heures, 12, 'le repli suit le réglage du joueur');
});

t('une construction en cours ne fait pas taire les alertes', () => {
  const g = app(s => {
    const p = s.planets[0];
    Object.assign(p.b, { metal: 20, solar: 1 });
    s.timers = [{ id: 'x', kind: 'b', p: 0, k: 'metal', lvl: 21, end: SOIR + 6 * 3600e3 }];
  });
  assert.ok(g.simulateDay().alerts.some(x => /[Éé]nergie/.test(x.what)),
    'la file occupée ne doit pas effacer l\'avertissement');
});

t('l\'alerte nomme sa planete quand il y en a plusieurs', () => {
  const g = app(s => { Object.assign(s.planets[1].b, { metal: 12, solar: 1 }); });
  const nrj = g.simulateDay().alerts.filter(x => /énergie/i.test(x.what));
  assert.ok(nrj.length > 1, 'les deux planètes manquent d\'énergie ici');
  assert.ok(nrj.some(x => /Colonie/.test(x.what)), 'la colonie doit être nommée : ' + JSON.stringify(nrj));
  assert.ok(nrj.every(x => / sur /.test(x.what)), 'chaque alerte doit dire sur quelle planète');
});

t('une ressource sans production ne donne pas d\'alerte de hangar', () => {
  const g = app(s => {
    const p = s.planets[0];
    Object.assign(p.b, { deut: 0, sdeut: 0 });
    p.stock = { m: 0, c: 0, d: 0, at: SOIR };
  });
  g.simulateDay().alerts.forEach(x => {
    assert.ok(!/Infinity|NaN/.test(x.what + x.why), 'aucun chiffre absurde : ' + x.what);
  });
});

t('un debit negatif ne donne pas d\'alerte de hangar', () => {
  // Une centrale à fusion mange plus de deutérium que le synthétiseur n'en
  // produit : le débit est négatif, et sans le garde « plein dans » diviserait
  // par ce débit et annoncerait un réservoir plein dans une durée négative.
  const g = app(s => {
    const p = s.planets[0];
    Object.assign(p.b, { deut: 1, fusion: 12, sdeut: 4 });
    p.stock = { m: 0, c: 0, d: 0, at: SOIR };
  });
  const p = g.S.planets[0];
  assert.ok(g.production(p).d < 0, 'préalable du test : le débit de deutérium doit être négatif');
  assert.ok(!g.planetAlerts(p).some(a => /[Rr]éservoir/.test(a.what)),
    'rien à dire d\'un réservoir qui se vide : ' + JSON.stringify(g.planetAlerts(p)));
});

/* ---------- un hangar se prévoit avant le plafond, et au plafond on dépense ---------- */

/** Assez d'énergie pour que les mines tournent à 100 % : le plafond du hangar
    se lit alors seul, sans le secours de la centrale devant. */
const ENERGIE = s => { s.planets[0].b.solar = 30; };

t('un hangar deja plein fait proposer de depenser, pas de l\'agrandir', () => {
  // La planète mère de la fixture porte 120 000 de métal pour un Hangar M 3,
  // qui n'en loge que 75 000 : elle est au plafond dès le départ.
  const g = app();
  const p = g.S.planets[0];
  const a = g.planetAlerts(p).find(x => /Métal au plafond/.test(x.what));
  assert.ok(a, 'le plafond se dit : ' + JSON.stringify(g.planetAlerts(p)));
  assert.match(a.what, /: [\d\s k]+ métal\/h perdus$/, 'la perte horaire est dans le titre');
  assert.ok(/Lancer /.test(a.why), 'et la phrase nomme le chantier qui vide : ' + a.why);
  assert.ok(/45\s000 au-dessus de la capacité/.test(a.why), 'et dit l\'excédent : ' + a.why);
  assert.ok(!/Hangar de métal \d/.test(a.why), 'premier débordement : pas de hangar : ' + a.why);
});

t('au plafond, le plan met le gros chantier devant le hangar', () => {
  // De l'énergie en trop : sans elle, la centrale est le secours qui passe
  // devant tout, et c'est un autre sujet que le plafond du hangar.
  const g = app(ENERGIE);
  // pickBuildings lit une planète SIMULÉE : elle porte son stock sous `st`.
  const p = Object.assign({}, g.S.planets[0], { st: [120000, 60000, 18000] });
  const c = g.pickBuildings(p, { T: SOIR, iv: 1.5, goals: [] });
  const vide = c.findIndex(x => /au plafond/.test(x.why || ''));
  const hangar = c.findIndex(x => x.k === 'smetal');
  assert.ok(vide >= 0, 'un chantier sort pour vider le métal : ' + JSON.stringify(c.map(x => [x.k, x.why])));
  assert.ok(hangar < 0 || vide < hangar, 'et il passe devant le hangar : ' + JSON.stringify(c.map(x => x.k)));
});

t('l\'alerte du plafond ne propose pas d\'achat pour vider', () => {
  // Sur la planète mère, Robots 7 coûte 25 600 de métal, plus que Métal 15
  // (17 515). Il viderait le hangar plus vite, mais rien ne dit qu'il sert :
  // une dépense proposée doit déjà être utile, pas un puits.
  const g = app(ENERGIE);
  const a = g.planetAlerts(g.S.planets[0]).find(x => /Métal au plafond/.test(x.what));
  assert.ok(!/Robots 7/.test(a.why), 'pas de puits : ' + a.why);
  assert.ok(/Lancer /.test(a.why), 'une dépense utile à la place : ' + a.why);
});

t('la plus grosse depense compte les recherches, depuis le labo seulement', () => {
  const g = app(ENERGIE);
  const [mere, colo] = g.S.planets;
  const d = g.depensesPayables(mere, 0, [120000, 60000, 18000]);
  assert.ok(d.some(x => x.kind === 't'), 'le labo est ici, les recherches comptent : ' + JSON.stringify(d.map(x => x.what)));
  // Le jeu paie une recherche depuis la planète du labo : ailleurs, en proposer
  // une ferait dépenser un stock qui n'est pas celui-là.
  const ailleurs = g.depensesPayables(colo, 0, [120000, 60000, 18000]);
  assert.ok(!ailleurs.some(x => x.kind === 't'), 'pas de recherche depuis une colonie sans labo');
});

t('une recherche en cours ecarte les recherches de la liste', () => {
  // Le jeu n'en permet qu'une : en proposer une seconde serait un chantier que
  // le joueur ne peut pas lancer.
  const g = app(s => { ENERGIE(s); s.timers = [{ kind: 't', k: 'energy', lvl: 4, end: SOIR + 36e5 }]; });
  const d = g.depensesPayables(g.S.planets[0], 0, [120000, 60000, 18000]);
  assert.ok(!d.some(x => x.kind === 't'), 'aucune recherche tant que la première tourne : ' + JSON.stringify(d.map(x => x.what)));
});

t('au plafond, le plan ne pose qu\'une montee productive', () => {
  // L'alerte conseille le puits, le plan ne le pose pas : « Chantier spatial 8 »
  // tous les deux tours affamait la défense, et quand aucune mine n'est payable
  // c'est le hangar qu'il faut, lui seul relève le plafond.
  const g = app(ENERGIE);
  const p = Object.assign({}, g.S.planets[0], { st: [120000, 60000, 18000] });
  const c = g.pickBuildings(p, { T: SOIR, iv: 1.5, goals: [] }).find(x => /au plafond/.test(x.why || ''));
  assert.ok(c, 'un chantier sort pour vider le métal');
  assert.ok(['metal', 'crystal', 'deut', 'solar'].includes(c.k),
    'et c\'est une montée productive, pas un puits : ' + c.k);
});

/** `n` débordements fermés de la ressource k sur la planète pid, dans les sept derniers jours. */
const RECURRENT = (pid, k, n) => Array.from({ length: n }, (_, i) => ({ pid, k, d: SOIR - (i + 1) * 864e5, f: SOIR - (i + 1) * 864e5 + 36e5 }));
t('le hangar se propose assez tot pour etre monte avant le plafond', () => {
  // Un Hangar M 9 met près de quinze heures à sortir : proposé deux connexions
  // avant le plafond, il arriverait après. Quatorze heures avant, deux
  // connexions de quatre-vingt-dix minutes ne le voient pas venir ; son propre
  // temps de montée, si.
  const g = app(s => { ENERGIE(s); s.planets[0].b.smetal = 8; });
  const base = g.S.planets[0], pr = g.production(base), cap = g.storageCap(8);
  const p = Object.assign({}, base, { st: [cap - pr.m * 14, 60000, 18000] });
  assert.ok(p.st[0] < cap * 0.98, 'préalable : la planète n\'est pas encore au plafond');
  assert.ok(!g.pickBuildings(p, { T: SOIR, iv: 1.5, goals: [] }).some(x => x.k === 'smetal'),
    'sans débordement récurrent, pas de hangar : la carte Ressources en trop propose de dépenser ou d\'envoyer');
  // Trois débordements de métal en sept jours : le hangar se justifie.
  const h = app(s => { ENERGIE(s); s.planets[0].b.smetal = 8; s.__win = { __surplusLog: RECURRENT('mere', 0, 3) }; });
  const q = Object.assign({}, h.S.planets[0], { st: [cap - pr.m * 14, 60000, 18000] });
  const c = h.pickBuildings(q, { T: SOIR, iv: 1.5, goals: [] }).find(x => x.k === 'smetal');
  assert.ok(c, 'le hangar se propose vingt heures avant le plafond');
  assert.ok(/à sortir/.test(c.why), 'et la carte dit combien de temps il met : ' + c.why);
});

t('les alertes urgentes passent avant les avertissements', () => {
  // La planète mère n'a qu'un hangar qui se remplit (Attention), la colonie
  // manque d'énergie (Urgent). Dans l'ordre des planètes, l'Attention sort
  // en premier : c'est le tri par sévérité qui doit le remettre dessous.
  const g = app(s => {
    s.planets[0].stock = { m: 66524, c: 0, d: 0, at: SOIR };
    Object.assign(s.planets[1].b, { metal: 12, solar: 1 });
  });
  const sevs = g.simulateDay().alerts.map(a => a.sev);
  assert.ok(sevs.includes('bad') && sevs.includes('warn'),
    'préalable du test : il faut une urgence et un avertissement, et non ' + sevs.join(','));
  assert.ok(sevs.lastIndexOf('bad') < sevs.indexOf('warn'),
    'aucun Urgent ne doit se lire sous un Attention : ' + sevs.join(','));
});

t('la carte Alertes affiche ce que le moteur produit', () => {
  // Le moteur peut continuer à produire des alertes pendant que la carte cesse
  // de les montrer : c'est la carte, pas le tableau, que voit le joueur.
  const g = app(s => {
    Object.assign(s.planets[0].b, { metal: 20, solar: 1, smetal: 0 });
    s.planets[0].stock = { m: 9e9, c: 0, d: 0, at: SOIR };
  });
  g.REFRESH.today();
  const html = g.html().tdAlerts || '', sp = g.html().tdSurplus || '';
  assert.ok(/Critique/.test(html), 'la pastille de sévérité doit être rendue : ' + html.slice(0, 200));
  assert.ok(/Métal au plafond/.test(sp) && /Critique/.test(sp), 'et le hangar plein a sa carte : ' + sp.slice(0, 200));
  assert.ok(!/au plafond/.test(html), 'sans se répéter dans les conseils');
});

t('tous les jalons franchis, le bloc disparait', () => {
  const g = app(s => {
    Object.assign(s.planets[0].b, { lab: 3, robot: 2, shipyard: 2 });
    Object.assign(s.tech, { energy: 3, combustion: 4, espionage: 4, computer: 2, impulse: 3, astro: 3 });
  });
  g.REFRESH.today();
  assert.ok(!/Début de partie/.test(g.html().tdDay || ''),
    'rien à afficher quand les onze sont franchis');
});

/* ---------- le délai de retour d'une colonie est simulé ---------- */

t('une colonie ne s\'amortit pas en moins d\'un jour', () => {
  // Le plan v1 l'affirmait en comparant un coût à une production finale, sans
  // compter le vaisseau, le trajet, ni les jours de mines avant de produire.
  const g = app(s => { s.tech.astro = 4; });
  const cp = g.colonyPayback(8);
  assert.ok(cp, 'le délai se calcule');
  assert.ok(cp.hours > 24, 'bien plus d\'un jour : ' + cp.hours + ' h');
});

t('le délai compte le vaisseau et le trajet avant la première ressource', () => {
  const g = app(s => { s.tech.astro = 4; });
  const cp = g.colonyPayback(8), F = g.coloFleet();
  const avant = (F.shipTime + F.leg1.secs) / 3600;
  assert.ok(cp.ramp >= avant, 'la montée commence après le vol : ' + cp.ramp + ' < ' + avant);
  assert.ok(cp.hours > cp.ramp, 'la mise se rend après la montée');
  assert.ok(cp.rate > 0 && cp.b.metal > 0, 'la colonie finit par produire');
});

t('une position à bonus de métal rend sa mise plus vite qu\'une position froide', () => {
  const g = app(s => { s.tech.astro = 8; });
  assert.ok(g.colonyPayback(8).rate > g.colonyPayback(15).rate,
    'la position 8 (+35 % métal) produit plus que la 15');
});

/* ---------- la surcharge des foreuses se règle ---------- */

t('la surcharge augmente le bonus de moitié et double l\'énergie', () => {
  const g = app();
  assert.ok(Math.abs(g.crawlerBonus(100, 'collector', true)
                   - g.crawlerBonus(100, 'collector', false) * 1.5) < 1e-9);
  const avec = app(s => { s.settings.crawlerOverload = true; s.planets[0].crawlers = 100; });
  const sans = app(s => { s.settings.crawlerOverload = false; s.planets[0].crawlers = 100; });
  assert.equal(avec.production(avec.S.planets[0]).eCons - avec.production(avec.S.planets[0], { crawlers: 0 }).eCons,
    2 * (sans.production(sans.S.planets[0]).eCons - sans.production(sans.S.planets[0], { crawlers: 0 }).eCons),
    'cent foreuses en surcharge consomment deux fois plus');
});

/* ---------- la découverte coûte un emplacement de flotte ---------- */

/* Une mission de découverte prend un emplacement comme n'importe quelle autre.
   Proposée alors qu'ils sont tous pris, elle envoie sur un bouton gris :
   « Nombre maximal de flottes atteint ». Releve en jeu le 12 novembre, cinq
   decouvertes et deux expeditions pour sept emplacements. */
t('emplacements de flotte pleins : aucune carte de découverte', () => {
  const g = app(s => { s.slots = { expo: [2, 2], fleet: [7, 7], at: SOIR }; s.syncAt = SOIR; }, SOIR);
  assert.ok(!g.dailyMissions().some(m => m.id === 'discovery'), 'la carte ne sort pas');
});

t('avec un emplacement libre, la découverte est proposée', () => {
  const g = app(s => { s.slots = { expo: [0, 2], fleet: [2, 7], at: SOIR }; s.syncAt = SOIR; }, SOIR);
  assert.ok(g.dailyMissions().some(m => m.id === 'discovery'), 'la carte sort');
});

t('la carte de découverte dit ce qu\'elle coûte en emplacement', () => {
  const g = app(s => { s.slots = { expo: [0, 2], fleet: [2, 7], at: SOIR }; s.syncAt = SOIR; }, SOIR);
  const c = g.dailyMissions().find(m => m.id === 'discovery');
  assert.ok(/emplacement/i.test(c.why + c.how.join(' ')), 'le coût est dit : ' + c.why);
});

/* ---------- ce qu'un lien peut préremplir, et ce qu'il ne peut pas ---------- */

const HOTE = s => { s.host = 's1-fr.ogame.gameforge.com'; };
const BATIMENT = { kind: 'b', k: 'metal', lvl: 21, p: 0, q: 'Bâtiment', what: 'Métal 21' };
const PREREMPLI = /pr[ée]-?remplir/i;

t('une carte de bâtiment dit que le lien ne préremplit rien', () => {
  const g = app(HOTE, SOIR);
  const note = g.goNote(BATIMENT);
  assert.ok(PREREMPLI.test(note), 'la note explique la limite : ' + note);
});

t('une carte de flotte ne porte pas cette note', () => {
  const g = app(HOTE, SOIR);
  assert.equal(g.goNote({ kind: 'transfer', p: 0, dest: '1:142:6', mission: 3, ships: { sc: 1 } }), '');
});

t('sans serveur connu, aucune note : il n\'y a pas de lien', () => {
  const g = app(null, SOIR);
  assert.equal(g.goNote(BATIMENT), '');
});

t('la note apparaît dans le HTML de la carte', () => {
  const g = app(HOTE, SOIR);
  assert.ok(PREREMPLI.test(g.actHtml(BATIMENT, false)));
});

t('une recherche porte la même note', () => {
  const g = app(HOTE, SOIR);
  assert.ok(PREREMPLI.test(g.goNote({ kind: 't', k: 'astro', lvl: 5, p: 0 })));
});

/* Sans identifiant de planète, le lien n'emporte pas de `cp=` : il ouvre la
   page sur la planète que le jeu avait en tête. Promettre « la bonne planète »
   enverrait construire ailleurs un joueur qui en a plusieurs. */
t('sur une planète que le jeu a nommée, la note promet la bonne planète', () => {
  const g = app(s => { HOTE(s); s.planets[0].gid = '33001'; }, SOIR);
  assert.ok(/bonne planète/.test(g.goNote(BATIMENT)));
});

t('sur une planète jamais nommée, la note ne promet pas la planète', () => {
  const g = app(HOTE, SOIR);
  const note = g.goNote(BATIMENT);
  assert.ok(PREREMPLI.test(note), 'elle dit toujours la limite');
  assert.ok(!/bonne planète/.test(note), 'mais ne promet rien de faux : ' + note);
});

t('une carte de chantier ne parle pas de bâtiment ni de recherche', () => {
  const g = app(s => { HOTE(s); s.planets[0].gid = '33001'; }, SOIR);
  const note = g.goNote({ kind: 'ship', k: 'lc', n: 5, p: 0 });
  assert.ok(PREREMPLI.test(note), 'la note sort pour un chantier aussi');
  assert.ok(!/b[âa]timent ou une recherche/i.test(note), 'sans se tromper de vocabulaire : ' + note);
});


/* ---------- le panneau de production ---------- */

/* Relevé sur Caribou Land le 12 novembre. Les nombres du jeu portent des
   points comme séparateurs de milliers, et la colonne énergie du total
   s'écrit « libre/produite ». */
const PANNEAU_CARIBOU = [
  'Facteur de production: 100%',
  'Revenu de base\t240\t120\t0\t0',
  'Mine de métal (Niveau 21)\t37.297\t0\t0\t-1.554\t100%',
  'Mine de cristal (Niveau 17)\t0\t13.748\t0\t-859\t100%',
  'Synthétiseur de deutérium (Niveau 17)\t0\t0\t7.946\t-1.718\t100%',
  'Centrale électrique solaire (Niveau 19)\t0\t0\t0\t2.324\t100%',
  'Centrale électrique de fusion (Niveau 7)\t0\t0\t-1.091\t464\t100%',
  'Centre de recherche (Niveau 2)\t0\t0\t0\t-23',
  'Satellite solaire (Nombre : 34)\t0\t0\t0\t1.190\t100%',
  'Foreuse (Nombre : 0/440)\t0\t0\t0\t0\t100%',
  'Le collecteur\t9.324\t3.437\t1.986\t397',
  'Bonus technologique de forme de vie\t96\t46\t20\t9',
  'Capacité de stockage\t2M\t255.000\t470.000\t0',
  'Total par heure:\t46.958\t17.351\t8.862\t231/4.385'
].join('\n');

t('le panneau donne le bonus de forme de vie', () => {
  const g = app(null, SOIR);
  assert.deepEqual(g.parseProdPanel(PANNEAU_CARIBOU).lfBonus, [96, 46, 20, 9]);
});

t('le panneau donne l\'énergie libre et produite', () => {
  const g = app(null, SOIR);
  assert.deepEqual(g.parseProdPanel(PANNEAU_CARIBOU).energy, { free: 231, prod: 4385 });
});

t('le panneau donne le plafond de foreuses', () => {
  const g = app(null, SOIR);
  assert.equal(g.parseProdPanel(PANNEAU_CARIBOU).crawlerMax, 440);
});

t('le panneau donne le facteur de production', () => {
  const g = app(null, SOIR);
  assert.equal(g.parseProdPanel(PANNEAU_CARIBOU).factor, 1);
});

t('une ligne de bâtiment porte son niveau et ses quatre colonnes', () => {
  const g = app(null, SOIR);
  const r = g.parseProdPanel(PANNEAU_CARIBOU).rows.find(x => /Mine de métal/.test(x.label));
  assert.equal(r.lvl, 21);
  assert.deepEqual(r.v, [37297, 0, 0, -1554]);
  assert.equal(r.pct, 100);
});

t('le revenu de base et les capacités sont lus ; « 2M » reste inconnu', () => {
  const p = app(null, SOIR).parseProdPanel(PANNEAU_CARIBOU);
  assert.deepEqual(p.base, [240, 120, 0]);
  assert.deepEqual(p.caps, [null, 255000, 470000]);
});

t('sans la ligne « Total par heure », le panneau n\'est pas là', () => {
  assert.equal(app(null, SOIR).parseProdPanel('Facteur de production: 100%\nRevenu de base\t1\t1\t0\t0'), null);
  assert.equal(app(null, SOIR).parseProdPanel(null), null);
});

t('un compte absurde est ramené au plafond', () => {
  const p = app(null, SOIR).parseProdPanel('Foreuse (Nombre : 5/99999999)\t0\t0\t0\t0\nTotal par heure:\t1\t1\t1\t0/0');
  assert.strictEqual(p.crawlerMax, 1e6);
  assert.strictEqual(p.rows[0].max, 1e6);
});

t('un compte de plus de neuf chiffres est refusé, pas repris', () => {
  const p = app(null, SOIR).parseProdPanel('Foreuse (Nombre : 5/99999999999)\t0\t0\t0\t0\nTotal par heure:\t1\t1\t1\t0/0');
  assert.strictEqual(p.rows[0].max, null);
  assert.strictEqual(p.crawlerMax, 0);
});

t('applyGame range chaque panneau sous son gid, sans toucher aux autres', () => {
  const g = app(null, SOIR);
  g.S.prod = { 33003: { at: 1, factor: 1 } };
  const bad = {};
  bad['33001'] = { text: PANNEAU_CARIBOU, at: SOIR };
  bad['33002'] = { text: 'x', at: SOIR };
  // clé littérale « __proto__ » (comme après un JSON.parse), qu'une affectation ordinaire ne créerait pas
  Object.defineProperty(bad, '__proto__', { value: { text: PANNEAU_CARIBOU, at: SOIR }, enumerable: true });
  g.applyGame({ prod: bad, planets: {}, timers: [], moves: [] });
  assert.deepEqual(g.S.prod['33001'].lfBonus, [96, 46, 20, 9]);
  assert.strictEqual(g.S.prod['33001'].at, SOIR);
  assert.ok(!('33002' in g.S.prod), 'illisible : absent');
  assert.deepEqual(g.S.prod['33003'], { at: 1, factor: 1 }, 'l\'autre planète est intacte');
  assert.deepEqual(Object.keys(g.S.prod).sort(), ['33001', '33003']);
  assert.strictEqual(Object.getPrototypeOf(g.S.prod), Object.prototype);
});

t('le panneau d\'une planète n\'en renseigne pas une autre', () => {
  const g = app(s => { s.planets[0].gid = '33001'; s.planets[1].gid = '33002'; });
  g.S.prod = { 33001: { lfBonus: [96, 46, 20, 9], at: SOIR, factor: 1 } };
  assert.deepEqual(g.prodOf(g.S.planets[0]).lfBonus, [96, 46, 20, 9]);
  assert.equal(g.prodOf(g.S.planets[1]), undefined);
  g.S.planets[1].gid = undefined;
  assert.equal(g.prodOf(g.S.planets[1]), undefined);
  g.S.planets[1].gid = 'toString';
  assert.equal(g.prodOf(g.S.planets[1]), undefined, 'pas de repli sur le prototype');
});

t('le bonus de forme de vie lu s\'ajoute \u00e0 la production', () => {
  const sans = app(s => { s.planets[0].gid = '33001'; s.planets[0].sats = 500; }, SOIR);
  const avec = app(s => {
    s.planets[0].gid = '33001'; s.planets[0].sats = 500;
    s.prod = { 33001: { lfBonus: [96, 46, 20, 9], at: SOIR, factor: 1 } };
  }, SOIR);
  const a = avec.production(avec.S.planets[0]), b = sans.production(sans.S.planets[0]);
  assert.ok(Math.abs((a.m - b.m) - 96) < 1, 'm\u00e9tal : ' + (a.m - b.m));
  assert.ok(Math.abs((a.c - b.c) - 46) < 1, 'cristal : ' + (a.c - b.c));
  assert.ok(Math.abs((a.d - b.d) - 20) < 1, 'deut\u00e9rium : ' + (a.d - b.d));
  assert.equal(a.eProd - b.eProd, 9, '\u00e9nergie dans eProd');
  assert.equal(a.eBal - b.eBal, 9);
});

t('en manque d\'\u00e9nergie, l\'\u00e9nergie du bonus relève le facteur', () => {
  const sans = app(s => { s.planets[0].gid = '33001'; }, SOIR);
  const avec = app(s => {
    s.planets[0].gid = '33001';
    s.prod = { 33001: { lfBonus: [0, 0, 0, 9], at: SOIR, factor: 1 } };
  }, SOIR);
  const a = avec.production(avec.S.planets[0]), b = sans.production(sans.S.planets[0]);
  assert.equal(a.eProd - b.eProd, 9);
  assert.ok(a.factor > b.factor, 'facteur ' + b.factor + ' -> ' + a.factor);
});

t('le bonus lu ne touche pas une autre plan\u00e8te', () => {
  const g = app(s => {
    s.planets[0].gid = '33001'; s.planets[1].gid = '33002';
    s.prod = { 33001: { lfBonus: [96, 46, 20, 9], at: SOIR, factor: 1 } };
  }, SOIR);
  const sans = app(s => { s.planets[1].gid = '33002'; }, SOIR);
  assert.equal(g.production(g.S.planets[1]).m, sans.production(sans.S.planets[1]).m);
});

t('sans panneau lu, la production ne change pas', () => {
  const g = app(s => { s.planets[0].gid = '33001'; delete s.prod; }, SOIR);
  assert.ok(g.production(g.S.planets[0]).m > 0, 'le moteur garde ses formules');
});

t('une lecture de plus de sept jours est ignor\u00e9e', () => {
  const vieux = SOIR - 8 * 86400e3;
  const g = app(s => {
    s.planets[0].gid = '33001';
    s.prod = { 33001: { lfBonus: [9999, 0, 0, 0], at: vieux, factor: 1 } };
  }, SOIR);
  const sans = app(s => { s.planets[0].gid = '33001'; }, SOIR);
  assert.ok(Math.abs(g.production(g.S.planets[0]).m - sans.production(sans.S.planets[0]).m) < 1,
    'le bonus p\u00e9rim\u00e9 n\'est pas appliqu\u00e9');
});

t('une lecture de six jours compte encore', () => {
  const g = app(s => {
    s.planets[0].gid = '33001';
    s.prod = { 33001: { lfBonus: [500, 0, 0, 0], at: SOIR - 6 * 86400e3, factor: 1 } };
  }, SOIR);
  const sans = app(s => { s.planets[0].gid = '33001'; }, SOIR);
  assert.ok(g.production(g.S.planets[0]).m - sans.production(sans.S.planets[0]).m > 499);
});

t('un bonus illisible (non fini, n\u00e9gatif) n\'entre pas dans la production', () => {
  const g = app(s => {
    s.planets[0].gid = '33001';
    s.prod = { 33001: { lfBonus: [NaN, -50, 'x', Infinity], at: SOIR, factor: 1 } };
  }, SOIR);
  const sans = app(s => { s.planets[0].gid = '33001'; }, SOIR);
  const a = g.production(g.S.planets[0]), b = sans.production(sans.S.planets[0]);
  assert.equal(a.m, b.m); assert.equal(a.c, b.c); assert.equal(a.d, b.d); assert.equal(a.eProd, b.eProd);
});

/** Le panneau Caribou dont la dernière cellule (énergie libre/produite) est remplacée. */
const panneauEnergie = cell => PANNEAU_CARIBOU.replace('231/4.385', cell);
/** Fait lire à applyGame un panneau pour la planète 33001 de la fixture. */
function lis(g, text, at) {
  g.S.planets[0].gid = '33001';
  g.applyGame({ prod: { 33001: { text, at } }, planets: {}, timers: [], moves: [] });
  return g.production(g.S.planets[0]);
}

t('l\'énergie lue cale le bilan de la planète, quel que soit l\'ancien eAdj', () => {
  const g = app(s => { s.planets[0].eAdj = -300; }, SOIR);
  const avant = g.production(g.S.planets[0]).eBal;
  const pr = lis(g, PANNEAU_CARIBOU, SOIR);
  assert.notEqual(avant, 231, 'la fixture ne tombe pas déjà sur 231 : le test mord');
  assert.strictEqual(pr.eBal, 231, 'le solde suit la lecture : ' + pr.eBal);
});

t('l\'écart d\'énergie se mesure sans eAdj, contre le solde', () => {
  const g = app(null, SOIR);
  lis(g, PANNEAU_CARIBOU, SOIR);
  const p = g.S.planets[0], eAdj = p.eAdj;
  p.eAdj = 0;
  assert.strictEqual(231 - g.production(p).eBal, eAdj);
});

t('une énergie libre illisible laisse eAdj intact', () => {
  const g = app(s => { s.planets[0].eAdj = -77; }, SOIR);
  lis(g, panneauEnergie('1.2.3/4.385'), SOIR);
  assert.strictEqual(g.S.planets[0].eAdj, -77);
});

t('un panneau de plus de sept jours ne cale pas le bilan', () => {
  const g = app(s => { s.planets[0].eAdj = -77; }, SOIR);
  lis(g, PANNEAU_CARIBOU, SOIR - 8 * 86400e3);
  assert.strictEqual(g.S.planets[0].eAdj, -77);
});

t('une énergie libre démesurée est bornée', () => {
  const g = app(null, SOIR);
  lis(g, panneauEnergie('999.999.999.999/4.385'), SOIR);
  assert.ok(Math.abs(g.S.planets[0].eAdj) <= 2e9, 'eAdj borné : ' + g.S.planets[0].eAdj);
});

/* Une mine bridée produit moins ; c'est un état, pas une propriété de la mine.
   Le gain du niveau suivant se calcule sur la mine à pleine marche, sinon le
   classement condamnerait pour toujours une planète à court d'énergie. */
t('un facteur sous 100 % ne se propage pas au gain du niveau suivant', () => {
  const g = app(null, SOIR);
  lis(g, panneauEnergie('-500/2.000').replace('Facteur de production: 100%', 'Facteur de production: 80%'), SOIR);
  assert.ok(g.production(g.S.planets[0]).factor < 1, 'la planète manque d\'énergie');
  const ups = g.rankUpgrades(g.S.planets[0]);
  assert.ok(ups.length, 'des montées sont proposées');
  assert.strictEqual(ups[0].key, 'solar', 'et l\'énergie passe devant : ' + ups.map(u => u.key));
});

t('le panneau donne le total horaire que le jeu affiche', () => {
  const g = app(null, SOIR);
  assert.deepEqual(g.parseProdPanel(PANNEAU_CARIBOU).perHour, [46958, 17351, 8862]);
});

t('la production lue cale les trois ressources de la planète', () => {
  // le joueur compare la carte au « Total par heure » du jeu : les deux doivent dire pareil
  const g = app(null, SOIR);
  const avant = g.production(g.S.planets[0]);
  assert.ok(Math.round(avant.m) !== 46958, 'la fixture ne tombe pas déjà dessus : le test mord');
  const pr = lis(g, PANNEAU_CARIBOU, SOIR);
  assert.deepEqual([pr.m, pr.c, pr.d].map(Math.round), [46958, 17351, 8862]);
});

t("l'écart calé est additif : une montée simulée garde tout son gain", () => {
  /* Caler ne doit pas écraser la comparaison entre deux montées : l'écart est
     un forfait, le delta d'un niveau reste celui de la formule. */
  const g = app(null, SOIR);
  const p = g.S.planets[0];
  const nu = { metal: p.b.metal + 1 };
  lis(g, PANNEAU_CARIBOU, SOIR);
  const cale = g.production(p, nu).m - g.production(p).m;
  const ecart = p.pAdj;
  p.pAdj = null; // tout le reste identique : seul le forfait tombe
  const brut = g.production(p, nu).m - g.production(p).m;
  assert.ok(ecart && ecart[0] !== 0, 'un écart a bien été posé : ' + ecart);
  assert.ok(brut > 0, 'un niveau de mine rapporte : ' + brut);
  assert.ok(Math.abs(cale - brut) < 1e-6, cale + ' vs ' + brut);
});

t("un sol se lit sans la calibration posée sur la planète", () => {
  // sinon le forfait d'une planète la ferait passer devant les autres au classement des terrains
  const g = app(null, SOIR);
  const avant = g.terrainRates(g.S.planets[0]);
  lis(g, PANNEAU_CARIBOU, SOIR);
  assert.deepEqual(g.terrainRates(g.S.planets[0]), avant);
});

t("un total par heure illisible laisse la production au moteur", () => {
  const g = app(null, SOIR);
  const sans = PANNEAU_CARIBOU.replace('Total par heure:\t46.958\t17.351\t8.862\t231/4.385',
    'Total par heure:\t2M\t17.351\t8.862\t231/4.385');
  lis(g, sans, SOIR);
  assert.strictEqual(g.S.planets[0].pAdj, undefined, 'aucun écart posé sur un total tronqué');
});

t('un même panneau relu ne gomme pas le coût d\'un niveau monté depuis', () => {
  const g = app(null, SOIR);
  lis(g, PANNEAU_CARIBOU, SOIR);
  const p = g.S.planets[0], eAdj = p.eAdj;
  p.b.metal++;
  const apres = g.production(p).eBal;
  assert.ok(apres < 231, 'le niveau coûte de l\'énergie : ' + apres);
  lis(g, PANNEAU_CARIBOU, SOIR);
  assert.strictEqual(p.eAdj, eAdj, 'eAdj inchangé à la relecture');
  assert.strictEqual(g.production(p).eBal, apres, 'le solde garde le coût du niveau');
});

t('un nouveau panneau recale de nouveau', () => {
  const g = app(null, SOIR);
  lis(g, PANNEAU_CARIBOU, SOIR);
  g.S.planets[0].b.metal++;
  lis(g, PANNEAU_CARIBOU, SOIR + 1000);
  assert.strictEqual(g.production(g.S.planets[0]).eBal, 231);
});

t('le facteur ne descend jamais sous zéro', () => {
  const g = app(null, SOIR);
  const pr = lis(g, panneauEnergie('-100.000/4.385'), SOIR);
  assert.ok(pr.eProd < 0, 'la production d\'énergie est négative : ' + pr.eProd);
  assert.strictEqual(pr.factor, 0);
  assert.ok(pr.m >= 0 && pr.c >= 0 && pr.d >= 0, 'aucune production négative');
});

t('la fenêtre de sept jours : juste dedans calibre, juste dehors non', () => {
  const dedans = app(null, SOIR);
  lis(dedans, PANNEAU_CARIBOU, SOIR - 6.9 * 86400e3);
  assert.strictEqual(dedans.production(dedans.S.planets[0]).eBal, 231);
  const dehors = app(s => { s.planets[0].eAdj = -77; }, SOIR);
  lis(dehors, PANNEAU_CARIBOU, SOIR - 7.1 * 86400e3);
  assert.strictEqual(dehors.S.planets[0].eAdj, -77);
});

t('calibrer une planète ne touche pas les autres', () => {
  const g = app(s => { s.planets[1].gid = '33001'; s.planets[0].eAdj = -77; s.planets[1].eAdj = 0; }, SOIR);
  g.S.planets[0].gid = '33009';
  g.applyGame({ prod: { 33001: { text: PANNEAU_CARIBOU, at: SOIR } }, planets: {}, timers: [], moves: [] });
  assert.strictEqual(g.S.planets[0].eAdj, -77, 'l\'autre planète est intacte');
  assert.strictEqual(g.production(g.S.planets[1]).eBal, 231, 'la bonne planète est calée');
});

t("le copilote n'ajoute aucune entrée au menu du jeu", () => {
  /* Il en recolore les entrées et cache les payantes ; il n'en pose pas. Le
     joueur a demandé le retrait de l'entrée « Mouvement de flotte », et une
     copie d'entrée de menu est de toute façon le seul endroit où le copilote
     écrivait dans la page sans l'avoir lue ailleurs. */
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'content.js'), 'utf8');
  assert.ok(!/copilote-menu-ajout/.test(src), "la classe de l'entrée ajoutée ne doit pas revenir");
  assert.ok(!/ajouteMouvement/.test(src), 'ni la fonction qui la posait');
  assert.ok(!/li\.after\(/.test(src), 'ni une insertion à côté d\'une entrée du menu');
});

/* ---------- un chantier flou ne se relit qu'une fois son lot au sol ---------- */

/** Une planète dont le chantier a un lot, avec son heure de sortie et la dernière lecture. */
const CHANTIER = (g, sortie, lu) => {
  const p = g.S.planets[0];
  p.b.shipyard = 4; p.flotteFloue = sortie; p.shipsAt = lu;
  p.defFloue = 0; p.defsAt = lu;
  return p;
};

t('un lot encore en route rend le chantier flou', () => {
  // le copilote ne propose rien à ce chantier : il doublerait ce qui en sort
  const g = app(null, SOIR);
  assert.equal(g.chantierFlou(CHANTIER(g, SOIR + 2 * 3600e3, SOIR)), true);
});

t("mais on ne demande pas d'aller relire une page qui n'a rien de neuf", () => {
  /* Elle dirait le même compte qu'avant : le joueur faisait le geste, rien ne
     changeait, et la carte revenait au tour suivant. */
  const g = app(null, SOIR);
  assert.equal(g.chantierARelire(CHANTIER(g, SOIR + 2 * 3600e3, SOIR)), false);
});

t('le lot au sol et jamais relu, là il faut rouvrir la page', () => {
  const g = app(null, SOIR);
  assert.equal(g.chantierARelire(CHANTIER(g, SOIR - 3600e3, SOIR - 2 * 3600e3)), true);
});

t('un lot au sol et déjà relu ne demande plus rien', () => {
  const g = app(null, SOIR);
  const p = CHANTIER(g, SOIR - 2 * 3600e3, SOIR - 60e3);
  assert.equal(g.chantierFlou(p), false);
  assert.equal(g.chantierARelire(p), false);
});

t('la défense suit la même règle que la flotte', () => {
  const g = app(null, SOIR);
  const p = g.S.planets[0];
  p.b.shipyard = 4; p.flotteFloue = 0; p.shipsAt = SOIR;
  p.defFloue = SOIR + 3600e3; p.defsAt = SOIR;
  assert.equal(g.chantierARelire(p), false, 'le lot de défense est encore en route');
  p.defFloue = SOIR - 3600e3; p.defsAt = SOIR - 2 * 3600e3;
  assert.equal(g.chantierARelire(p), true);
});

/* ---------- un prix de case appartient à l'espèce, pas à la planète ---------- */

/** Deux planètes de la même espèce : la case 11101 y coûte la même chose. */
const DEUX_LF = (g, a, b) => {
  g.S.planets[0].lf = { 11101: a };
  g.S.planets[1].lf = { 11101: b };
  g.lfMetEnCommun();
  return [g.S.planets[0].lf[11101], g.S.planets[1].lf[11101]];
};

t('le prix lu sur une planète chiffre la même case sur les autres', () => {
  /* Sans ça le copilote ne comparait que la case qu'on venait d'ouvrir, et la
     désignait forcément — quelle qu'elle soit. */
  const g = app(null, SOIR);
  const [, b] = DEUX_LF(g,
    { lvl: 3, state: 'ok', next: 4, cost: [1200, 600, 0], secs: 900, seenAt: { 4: SOIR } },
    { lvl: 3, state: 'ok' });
  assert.deepEqual(b.seen[4], [1200, 600, 0], 'la seconde planète hérite du prix');
  assert.deepEqual(g.lfCost(b, 4).cost, [1200, 600, 0]);
});

t('la lecture locale prime toujours sur celle des voisines', () => {
  const g = app(null, SOIR);
  const [a] = DEUX_LF(g,
    { lvl: 3, state: 'ok', seen: { 4: [1, 1, 1] }, seenAt: { 4: SOIR } },
    { lvl: 3, state: 'ok', next: 4, cost: [9999, 9999, 9999], secs: 900, seenAt: { 4: SOIR + 1000 } });
  assert.deepEqual(a.seen[4], [1, 1, 1], 'ce que cette planète a lu reste le sien');
});

t("deux niveaux vus sur deux planètes donnent enfin le facteur", () => {
  /* C'est le vrai gain : une seule planète ne voit qu'un niveau à la fois, et
     lfCost en demande deux pour extrapoler. */
  const g = app(null, SOIR);
  const [a] = DEUX_LF(g,
    { lvl: 3, state: 'ok', next: 4, cost: [1000, 0, 0], secs: 900, seenAt: { 4: SOIR } },
    { lvl: 5, state: 'ok', next: 6, cost: [1440, 0, 0], secs: 900, seenAt: { 6: SOIR } });
  const c = g.lfCost(a, 8);
  assert.ok(c, 'le niveau 8 se chiffre maintenant');
  assert.equal(c.src, 'estimé');
  assert.equal(c.cost[0], 2074); // 1440 × 1,2² : le facteur se lit entre les niveaux 4 et 6
});

t("la durée ne se prête qu'à une planète qui n'en a aucune", () => {
  // elle dépend du chantier de la planète autant que de la case
  const g = app(null, SOIR);
  const [a, b] = DEUX_LF(g,
    { lvl: 3, state: 'ok', secs: 300 },
    { lvl: 3, state: 'ok', next: 4, cost: [1200, 0, 0], secs: 900, seenAt: { 4: SOIR } });
  assert.equal(a.secs, 300, 'sa propre durée est gardée');
  const g2 = app(null, SOIR);
  const [c] = DEUX_LF(g2,
    { lvl: 3, state: 'ok' },
    { lvl: 3, state: 'ok', next: 4, cost: [1200, 0, 0], secs: 900, seenAt: { 4: SOIR } });
  assert.equal(c.secs, 900, 'sans durée à elle, elle emprunte');
});

t("une case que personne n'a ouverte ne reçoit rien", () => {
  const g = app(null, SOIR);
  const [a, b] = DEUX_LF(g, { lvl: 3, state: 'ok' }, { lvl: 2, state: 'ok' });
  assert.ok(!a.seen || !Object.keys(a.seen).length, 'rien à partager');
  assert.equal(g.lfCost(a, 4), null);
});

/* ---------- le prix d'une case jamais ouverte ---------- */

/* Les coûts de forme de vie suivent base × facteur^(n−1), comme le reste du
   jeu. Deux niveaux observés donnent le facteur, donc tous les autres. */
t('deux prix vus donnent le prix d\'un troisième niveau', () => {
  const g = app(null, SOIR);
  const v = { seen: { 1: [1000, 500, 0], 3: [1440, 720, 0] }, lvl: 4 };
  const e = g.lfCost(v, 5);
  assert.equal(e.src, 'estimé');
  assert.ok(Math.abs(e.cost[0] - 1000 * Math.pow(1.2, 4)) < 20, 'métal : ' + e.cost[0]);
  assert.ok(Math.abs(e.cost[1] - 500 * Math.pow(1.2, 4)) < 20, 'cristal : ' + e.cost[1]);
});

t('un prix lu au bon niveau prime sur l\'estimation', () => {
  const g = app(null, SOIR);
  const v = { seen: { 1: [1000, 500, 0], 3: [1440, 720, 0] }, lvl: 2, next: 3, cost: [1440, 720, 0], secs: 60 };
  assert.equal(g.lfCost(v, 3).src, 'lu');
  assert.deepEqual(g.lfCost({ seen: { 1: [1000, 500, 0], 3: [1440, 720, 0] }, lvl: 2 }, 3).cost, [1440, 720, 0]);
});

t('un seul prix vu ne permet pas d\'estimer plus haut', () => {
  const g = app(null, SOIR);
  assert.equal(g.lfCost({ seen: { 1: [1000, 500, 0] }, lvl: 3 }, 4), null);
});

t('une case jamais vue n\'est pas classée, et le panneau le dit', () => {
  const g = app(s => { s.planets[0].lf = { 11101: { lvl: 0, state: 'on' } }; }, SOIR);
  assert.equal(g.lfCost(g.S.planets[0].lf[11101], 1), null);
  assert.ok(!g.lfCandidates(g.S.planets[0], 'lfbuilding').length, 'rien à classer');
});

t('le facteur est tiré des deux niveaux les plus hauts, pas des plus bas', () => {
  const g = app(null, SOIR);
  const v = { seen: { 1: [100, 0, 0], 2: [1000, 0, 0], 3: [1100, 0, 0], 4: [1210, 0, 0] } };
  assert.ok(Math.abs(g.lfCost(v, 5).cost[0] - 1331) <= 1, 'x1,1 par niveau : ' + g.lfCost(v, 5).cost[0]);
});

t('l\'estimation projette depuis le niveau le plus haut, vers le bas comme vers le haut', () => {
  const g = app(null, SOIR);
  const v = { seen: { 2: [1000, 0, 0], 4: [1440, 0, 0] } };
  assert.ok(Math.abs(g.lfCost(v, 3).cost[0] - 1200) <= 1, 'niveau 3 : ' + g.lfCost(v, 3).cost[0]);
  assert.equal(g.lfCost(v, 0), null, 'le niveau 0 n\'existe pas');
});

t('un facteur hors de [1, 5] ne chiffre pas : les deux prix ne peuvent pas être justes ensemble', () => {
  const g = app(null, SOIR);
  assert.equal(g.lfCost({ seen: { 1: [1000, 0, 0], 2: [500, 0, 0] } }, 3), null, 'à la baisse');
  assert.equal(g.lfCost({ seen: { 1: [100, 0, 0], 2: [100000, 0, 0] } }, 3), null, 'délirant');
  assert.deepEqual(g.lfCost({ seen: { 1: [1000, 0, 0], 2: [1000, 0, 0] } }, 3).cost, [1000, 0, 0], 'plat : 1 est dans les bornes');
  assert.deepEqual(g.lfCost({ seen: { 1: [100, 0, 0], 2: [500, 0, 0] } }, 3).cost, [2500, 0, 0], '5 est dans les bornes');
});

t('un prix nul au niveau bas ne sert pas de base au facteur', () => {
  const g = app(null, SOIR);
  const e = g.lfCost({ seen: { 1: [0, 100, 0], 2: [500, 200, 0] } }, 3);
  assert.ok(e && Math.abs(e.cost[1] - 400) <= 1, 'facteur 2 pris sur le cristal : ' + JSON.stringify(e));
});

t('un coût non numérique est ramené à zéro, pas propagé', () => {
  const g = app(null, SOIR);
  const e = g.lfCost({ seen: { 1: [NaN, 100, 0], 2: [NaN, 200, 0] } }, 3);
  assert.ok(e, 'estimé sur le cristal');
  assert.ok(e.cost.every(Number.isFinite), JSON.stringify(e.cost));
  assert.equal(e.cost[0], 0);
});

t('le facteur se tire du cristal quand le métal est nul, sinon rien', () => {
  const g = app(null, SOIR);
  const e = g.lfCost({ seen: { 1: [0, 100, 0], 2: [0, 120, 0] } }, 3);
  assert.ok(Math.abs(e.cost[1] - 144) <= 1, 'cristal : ' + e.cost[1]);
  assert.equal(g.lfCost({ seen: { 1: [0, 0, 0], 2: [0, 0, 0] } }, 3), null);
});

t('une estimation qui sort des bornes n\'est pas proposée', () => {
  const g = app(null, SOIR);
  const v = { seen: { 1: [1000, 0, 0], 2: [1200, 0, 0] } };
  assert.equal(g.lfCost(v, 1e6), null, 'niveau absurde');
  const e = g.lfCost({ seen: { 1: [1e30, 1, 0], 2: [-5, 2, 0] } }, 3);
  assert.ok(e.cost.every(x => x >= 0 && x <= 1e15), 'bornés : ' + JSON.stringify(e.cost));
});

t('un prix vu au niveau demandé est un prix lu', () => {
  const g = app(null, SOIR);
  const e = g.lfCost({ seen: { 1: [1000, 500, 0], 3: [1440, 720, 0] }, lvl: 0 }, 3);
  assert.equal(e.src, 'lu');
  assert.deepEqual(e.cost, [1440, 720, 0]);
});

/* applyGame : ce que le jeu lit entre dans la mémoire des prix vus. */
const ouvre = (g, id, niveau, cost, secs) => g.applyGame({
  planets: { 33009: { lf: { [id]: { lvl: niveau - 1, state: 'ok', name: 'Secteur', next: niveau, cost, secs: secs == null ? 60 : secs } } } },
  timers: [], moves: [] });
const DEUX_VUS = { 1: [1000, 500, 0], 2: [1200, 600, 0] };
const avecGid = () => { const g = app(null, SOIR); g.S.planets[0].gid = '33009'; return g; };

t('ouvrir une case en mémorise le prix au niveau lu', () => {
  const g = avecGid();
  ouvre(g, 11101, 5, [1000, 500, 0]);
  assert.deepEqual(g.S.planets[0].lf[11101].seen, { 5: [1000, 500, 0] });
});

t('les prix vus survivent à une lecture de la liste, qui ne porte pas de prix', () => {
  const g = avecGid();
  ouvre(g, 11101, 5, [1000, 500, 0]);
  g.applyGame({ planets: { 33009: { lf: { 11101: { lvl: 5, state: 'ok' } } } }, timers: [], moves: [] });
  const v = g.S.planets[0].lf[11101];
  assert.deepEqual(v.seen, { 5: [1000, 500, 0] });
  assert.equal(v.lvl, 5, 'et le niveau de la liste est adopté');
  assert.equal(v.secs, 60, 'la durée vue reste disponible pour le plan');
});

t('la mémoire garde les dix niveaux les plus hauts, ni plus ni moins', () => {
  const g = avecGid();
  for (let n = 1; n <= 10; n++) ouvre(g, 11101, n, [100 * n, 50, 0]);
  assert.deepEqual(Object.keys(g.S.planets[0].lf[11101].seen).map(Number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'dix tiennent');
  for (let n = 11; n <= 12; n++) ouvre(g, 11101, n, [100 * n, 50, 0]);
  assert.deepEqual(Object.keys(g.S.planets[0].lf[11101].seen).map(Number), [3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'les plus bas partent');
  ouvre(g, 11101, 1, [100, 50, 0]);
  assert.deepEqual(Object.keys(g.S.planets[0].lf[11101].seen).map(Number), [3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'un niveau plus bas que les dix ne rentre pas');
});

t('un niveau ou un prix absurde n\'entre pas dans la mémoire', () => {
  const g = avecGid();
  ouvre(g, 11101, 0, [100, 50, 0]);
  ouvre(g, 11101, 5, [0, 0, 0]);
  ouvre(g, 11101, 6, [1e30, -4, 0]);
  const seen = g.S.planets[0].lf[11101].seen;
  assert.deepEqual(Object.keys(seen), ['6'], 'seul le niveau 6 est gardé');
  assert.deepEqual(seen[6], [1e15, 0, 0], 'borné à l\'entrée');
});

t('deux cases ouvertes à des niveaux différents donnent une estimation à la case voisine', () => {
  const g = avecGid();
  ouvre(g, 11101, 1, [1000, 500, 0]);
  ouvre(g, 11101, 2, [1200, 600, 0]);
  g.applyGame({ planets: { 33009: { lf: { 11101: { lvl: 2, state: 'ok' } } } }, timers: [], moves: [] });
  const e = g.lfCost(g.S.planets[0].lf[11101], 3);
  assert.equal(e.src, 'estimé');
  assert.ok(Math.abs(e.cost[0] - 1440) <= 1, 'métal : ' + e.cost[0]);
});

/* Le plan : la case qu'on vient d'ouvrir n'est plus la seule éligible. */

t('une lecture de la liste n\'hérite ni du prix ni de l\'état de la lecture précédente', () => {
  const g = avecGid();
  ouvre(g, 11101, 5, [1000, 500, 0], 60);
  g.applyGame({ planets: { 33009: { lf: { 11101: { lvl: 4, state: 'short' } } } }, timers: [], moves: [] });
  const v = g.S.planets[0].lf[11101];
  assert.equal(v.cost, undefined);
  assert.equal(v.next, undefined);
  assert.equal(v.state, 'short');
  assert.deepEqual(v.seen, { 5: [1000, 500, 0] });
  assert.equal(v.secs, 60);
});

t('la carte dit combien de cases elle compare et combien elle ne sait pas chiffrer', () => {
  const g = vieSur({
    11101: { lvl: 2, state: 'ok', secs: 60, seen: DEUX_VUS },
    11102: { lvl: 0, state: 'ok' },
    11103: { lvl: 0, state: 'ok' },
    11104: { lvl: 0, state: 'locked' }
  });
  const a = premierLf(g);
  assert.ok(/1 case chiffrée/.test(a.why), a.why);
  assert.ok(/2 cases pas encore chiffrées/.test(a.why) && /ouvre-les/.test(a.why), 'les deux inconnues, la verrouillée non : ' + a.why);
  const tout = premierLf(vieSur({ 11101: CASE_OK }));
  assert.ok(!/pas encore chiffr/.test(tout.why), 'rien à signaler quand tout est chiffré : ' + tout.why);
});

t('la durée d\'une estimation est dite estimée, et l\'attente porte sa provenance', () => {
  const g = vieSur({ 11101: { lvl: 2, state: 'ok', secs: 60, seen: DEUX_VUS } });
  assert.ok(/durée estimés/.test(g.actHtml(premierLf(g), false)), 'durée');
  const h = vieSur({ 11101: { lvl: 2, state: 'short', secs: 60, seen: { 1: [1e6, 0, 0], 2: [2e6, 0, 0] } } });
  const w = h.simulateDay().sessions[0].waits.find(x => /Secteur résidentiel/.test(x.what));
  assert.equal(w.src, 'estimé');
});

t('un prix lu porte l\'heure de sa lecture', () => {
  const g = avecGid();
  ouvre(g, 11101, 3, [1440, 720, 0], 60);
  g.applyGame({ planets: { 33009: { lf: { 11101: { lvl: 2, state: 'ok' } } } }, timers: [], moves: [] });
  const a = g.simulateDay().sessions[0].acts.find(x => x.kind === 'lf');
  assert.equal(a.src, 'lu');
  assert.equal(a.at, g.S.planets[0].lf[11101].seenAt[3]);
  assert.ok(a.at > 0);
  assert.ok(/[Pp]rix lu à/.test(g.actHtml(a, false)));
});

/* Le ⓘ vit sur la ligne du type, son texte sous la carte : si les deux cessent
   de porter le même identifiant, le bouton n'ouvre plus rien et rien ne crie. */
t('le ⓘ ouvre bien son propre texte', () => {
  const g = app();
  /* Une carte dont le pourquoi tient en une phrase n'a pas de ⓘ : la phrase
     est déjà sur la carte. On cherche donc celle qui en a un. */
  const a = g.simulateDay().sessions[0].acts.find(x => x.why && /aria-controls/.test(g.actHtml(x, false)));
  const h = g.actHtml(a, false);
  const btn = h.match(/aria-controls="(why\d+)"/), txt = h.match(/<div class="why" id="(why\d+)"/);
  assert.ok(btn && txt, 'le ⓘ et son texte sont tous les deux posés');
  assert.equal(btn[1], txt[1], 'le bouton pointe sur son propre texte');
});

/* La raison ne doit plus demander un clic : la première phrase du pourquoi se
   lit sur la carte, et le ⓘ ne reste que s'il a davantage à dire. */
t('la carte porte la raison de l\'action', () => {
  const g = app();
  const a = g.simulateDay().sessions[0].acts.find(x => x.why);
  const h = g.actHtml(a, false);
  const lead = h.match(/<div class="but">([^<]+)<\/div>/);
  assert.ok(lead, 'la raison est posée sur la carte');
  assert.ok(a.why.startsWith(lead[1].replace(/…$/, '').trim().slice(0, 20)), 'c\'est bien le début du pourquoi');
});

t('un pourquoi d\'une seule phrase se passe du ⓘ', () => {
  const g = app();
  const [i, fold, lead] = g.whyParts(['Meilleur rendement']);
  assert.equal(i, '');
  assert.equal(fold, '');
  assert.equal(lead, 'Meilleur rendement');
});

t('la raison s\'arrête à la première phrase', () => {
  const g0 = app();
  assert.equal(g0.whyLead('Deux Grands transporteurs. Le reste suit.'), 'Deux Grands transporteurs.');
  assert.equal(g0.whyLead('Raison courte · détail · encore'), 'Raison courte');
  assert.equal(g0.whyLead(''), '');
});

t('le prix qu\'on vient d\'ouvrir porte aussi son heure de lecture', () => {
  const g = avecGid();
  ouvre(g, 11101, 5, [1000, 500, 0], 60);
  const c = g.lfCandidates(g.S.planets[0], 'lfbuilding')[0];
  assert.equal(c.src, 'lu');
  assert.equal(c.at, g.S.planets[0].lf[11101].seenAt[5]);
  assert.ok(c.at > 0);
});

t('la mémoire des heures suit celle des prix', () => {
  const g = avecGid();
  for (let n = 1; n <= 12; n++) ouvre(g, 11101, n, [100 * n, 50, 0]);
  const v = g.S.planets[0].lf[11101];
  assert.deepEqual(Object.keys(v.seenAt), Object.keys(v.seen));
});

t('une case estimée entre dans le plan, avec sa provenance', () => {
  const a = premierLf(vieSur({ 11101: { lvl: 2, state: 'ok', secs: 60, seen: DEUX_VUS } }));
  assert.ok(a, 'proposée sans que son prix ait été lu à ce niveau');
  assert.equal(a.src, 'estimé');
  assert.equal(a.lvl, 3);
  assert.ok(Math.abs(a.cost[0] - 1440) <= 1, 'au prix estimé : ' + a.cost[0]);
});

t('une carte qui repose sur une estimation le dit à l\'écran', () => {
  const g = vieSur({ 11101: { lvl: 2, state: 'ok', secs: 60, seen: DEUX_VUS } });
  const a = premierLf(g);
  assert.ok(/estim/i.test(g.actHtml(a, false)), 'estimation signalée');
  const lue = premierLf(vieSur({ 11101: CASE_OK }));
  assert.equal(lue.src, 'lu');
  assert.ok(!/estim/i.test(g.actHtml(lue, false)), 'un prix lu ne se dit pas estimé');
});

t('une estimation en attente le dit aussi', () => {
  const g = vieSur({ 11101: { lvl: 2, state: 'short', secs: 60, seen: { 1: [1e6, 0, 0], 2: [2e6, 0, 0] } } });
  const w = g.simulateDay().sessions[0].waits.find(x => /Secteur résidentiel/.test(x.what));
  assert.ok(w && /estim/i.test(w.what), 'attente estimée : ' + (w && w.what));
});

t('une case estimée sans durée connue n\'est pas proposée', () => {
  const g = vieSur({ 11101: { lvl: 2, state: 'ok', seen: DEUX_VUS } });
  assert.ok(!premierLf(g), 'on ne simule pas un chantier de durée nulle');
});

t('la case qu\'on vient d\'ouvrir ne verrouille plus le classement', () => {
  const g = app(s => {
    s.planets[0].lf = {
      11101: { lvl: 4, state: 'ok', next: 5, cost: [5000, 2000, 0], secs: 60, seen: { 5: [5000, 2000, 0] } },
      11102: { lvl: 2, state: 'ok', secs: 90, seen: { 1: [100, 50, 0], 2: [120, 60, 0] } }
    };
  }, SOIR);
  const c = g.lfCandidates(g.S.planets[0], 'lfbuilding');
  assert.deepEqual(c.map(x => x.id), [11102, 11101], 'la moins chère passe devant, ouverte ou non');
  assert.deepEqual(c.map(x => x.src), ['estimé', 'lu']);
});

/* ---------- une priorité de forme de vie prend la tête de sa file ---------- */

/* Une case lue : `next` est le niveau que le prix vise, sinon lfCost ne la
   dit pas chiffrée. */
const lfCase = (lvl, cost, over) => Object.assign({lvl, next: lvl + 1, state: 'ok', secs: 600, cost}, over);

t('une case priorisée passe devant une case plus chère à produire', () => {
  const g = app(s => { s.planets[0].lf = {
    11101: lfCase(1, [50000, 0, 0]),
    11102: lfCase(1, [1000, 0, 0], {eff: 0}) }; });
  assert.equal(g.lfCandidates(g.S.planets[0], 'lfbuilding')[0].id, 11102, 'sans priorité, la productrice');
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:2}];
  const l = g.lfCandidates(g.S.planets[0], 'lfbuilding');
  assert.equal(l[0].id, 11101, 'avec priorité, la tienne');
  assert.match(l[0].why, /priorité/i, 'et elle dit pourquoi');
  assert.equal(l[1].id, 11102, 'la productrice reste, juste derrière');
  assert.match(l[1].why, /production de métal/, 'et garde sa propre raison');
});

t('une case priorisée qui produit le dit dans sa raison', () => {
  const g = app(s => { s.planets[0].lf = { 11102: lfCase(1, [1000, 0, 0], {eff: 0}) }; });
  g.S.prio = [{kind:'lf', pid:'mere', k:11102, lvl:2}];
  const w = g.lfCandidates(g.S.planets[0], 'lfbuilding')[0].why;
  assert.match(w, /priorité/i);
  assert.match(w, /production de métal/, 'ce que la case fait');
});

t('deux priorités dans la même file : la première posée agit', () => {
  const g = app(s => { s.planets[0].lf = {
    11101: lfCase(1, [50000, 0, 0]), 11102: lfCase(1, [90000, 0, 0]), 11103: lfCase(1, [1000, 0, 0]) }; });
  /* La première posée porte l'identifiant du milieu : aucun tri par k, croissant
     ou décroissant, ne retombe sur elle par hasard. */
  g.S.prio = [{kind:'lf', pid:'mere', k:11102, lvl:2}, {kind:'lf', pid:'mere', k:11101, lvl:2}, {kind:'lf', pid:'mere', k:11103, lvl:2}];
  const l = g.lfCandidates(g.S.planets[0], 'lfbuilding');
  assert.equal(l[0].id, 11102, 'la première posée, même la plus chère');
  assert.equal(l.filter(c => /priorité/i.test(c.why)).length, 1, 'une seule se dit choisie');
});

t('une case priorisée pas encore chiffrée ne prend pas la tête', () => {
  const g = app(s => { s.planets[0].lf = {
    11101: {lvl:1, state:'ok'},                                  // ni prix ni durée
    11102: lfCase(1, [1000, 0, 0]) }; });
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:2}];
  const l = g.lfCandidates(g.S.planets[0], 'lfbuilding');
  assert.equal(l.length, 1, 'une case sans prix n\'est pas un candidat, priorisée ou non');
  assert.equal(l[0].id, 11102);
  assert.ok(!/priorité/i.test(l[0].why), 'et la suivante ne se prétend pas choisie');
});

t('une case priorisée verrouillée ne prend pas la tête', () => {
  const g = app(s => { s.planets[0].lf = {
    11101: lfCase(0, [1000, 0, 0], {state:'locked'}),
    11102: lfCase(1, [1000, 0, 0]) }; });
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:1}];
  const l = g.lfCandidates(g.S.planets[0], 'lfbuilding');
  assert.equal(l.length, 1);
  assert.equal(l[0].id, 11102);
});

t('une priorité dans l\'autre file ne dérange pas celle-ci', () => {
  const g = app(s => { s.planets[0].lf = {
    11101: lfCase(1, [1000, 0, 0]),
    11102: lfCase(1, [500, 0, 0]),
    11201: lfCase(1, [1000, 0, 0]) }; });
  g.S.prio = [{kind:'lf', pid:'mere', k:11201, lvl:2}];   // file des recherches
  const l = g.lfCandidates(g.S.planets[0], 'lfbuilding');
  assert.equal(l[0].id, 11102, 'le prix tranche encore');
  assert.ok(!l.some(c => /priorité/i.test(c.why)), 'aucune ne se dit choisie');
  assert.equal(g.lfCandidates(g.S.planets[0], 'lfresearch')[0].id, 11201);
});

t('la priorité d\'une autre planète ne déplace rien ici', () => {
  const g = app(s => {
    s.planets[0].lf = {11101: lfCase(1, [9500, 0, 0]), 11102: lfCase(1, [1000, 0, 0])};
    s.planets[1].lf = {11101: lfCase(1, [50000, 0, 0])}; });
  g.S.prio = [{kind:'lf', pid:g.S.planets[1].id, k:11101, lvl:2}];
  assert.equal(g.lfCandidates(g.S.planets[0], 'lfbuilding')[0].id, 11102);
  assert.equal(g.lfCandidates(g.S.planets[1], 'lfbuilding')[0].id, 11101, 'et elle agit chez elle');
});

t('les mines ne ralentissent pas pour une case priorisée en attente', () => {
  /* Sans priorité, la case bon marché part en premier ; avec, la chère attend
     en tête dès la première session et pose sa réserve molle. Cette réserve n'entre pas dans le
     chemin des bâtiments : le plan des bâtiments est le même dans les deux cas.
     Le stock est calé près du prix : la réserve molle ne retient que le stock
     d'aujourd'hui, et un prix hors de portée (eta infinie) n'en pose aucune. */
  const lf = s => { s.day.lf = 'first'; s.planets[1].stock.m = 9400;
    s.planets[1].lf = {11101: lfCase(1, [9500, 0, 0]), 11102: lfCase(1, [1000, 0, 0])}; };
  const bat = g => g.simulateDay().sessions.map(x => x.acts.filter(a => a.kind === 'b').map(a => [a.p, a.k, a.lvl]));
  const sans = app(lf);
  const avec = app(lf);
  avec.S.prio = [{kind:'lf', pid:'colo', k:11101, lvl:2}];
  assert.equal(avec.lfCandidates(avec.S.planets[1], 'lfbuilding')[0].id, 11101);
  /* Session 0 seulement : sur la journée entière la référence attend aussi (la bon
     marché construite, la chère devient candidate), donc rien n'y distinguerait. */
  const att = g => (g.simulateDay().sessions[0].waits || []).some(w => w.kind === 'lf');
  assert.ok(!att(sans), 'sans priorité, la bon marché part : rien n\'attend en première session');
  assert.ok(att(avec), 'avec, la chère attend en tête, avant les bâtiments');
  const ref = bat(sans);
  assert.ok(ref.flat().length > 0, 'le plan de référence pose des bâtiments');
  assert.deepEqual(bat(avec), ref, 'les mêmes bâtiments, aux mêmes sessions');
});

/* Relevé sur le panneau de détail du jeu, case Technique de catalyse. */
const CATALYSE = 'Chaque avancée de la technique de catalyse augmente la production '
  + 'de deutérium sur toutes les planètes.';

t('la phrase d\'effet du jeu dit quelle production la case augmente', () => {
  const g = app(null, SOIR);
  assert.equal(g.lfEffect(CATALYSE), 2, 'deutérium');
  assert.equal(g.lfEffect('… augmente la production de métal sur toutes les planètes.'), 0);
  assert.equal(g.lfEffect('… augmente la production de cristal de cette planète.'), 1);
  // l'énergie n'est pas une ressource qu'on classe, et un texte militaire non plus
  assert.equal(g.lfEffect('… augmente la production d\'énergie.'), null);
  assert.equal(g.lfEffect('… augmente la puissance des armes.'), null);
  assert.equal(g.lfEffect(''), null);
});

t('une case qui produit passe devant une case muette moins chère', () => {
  const g = app(s => {
    s.planets[0].lf = {
      11201: { lvl: 0, state: 'ok', next: 1, cost: [100, 50, 0], secs: 60 },
      11203: { lvl: 0, state: 'ok', next: 1, cost: [29000, 17000, 3000], secs: 413, eff: 2 }
    };
  }, SOIR);
  const c = g.lfCandidates(g.S.planets[0], 'lfresearch');
  assert.deepEqual(c.map(x => x.id), [11203, 11201],
    'celle qui augmente une production d\'abord, malgré son prix');
  assert.ok(/production de deutérium/.test(c[0].why), c[0].why);
  assert.ok(/moins chère/.test(c[1].why), c[1].why);
});

t('entre deux cases qui produisent, le prix départage à nouveau', () => {
  const g = app(s => {
    s.planets[0].lf = {
      11201: { lvl: 0, state: 'ok', next: 1, cost: [9000, 5000, 0], secs: 60, eff: 0 },
      11203: { lvl: 0, state: 'ok', next: 1, cost: [29000, 17000, 3000], secs: 413, eff: 2 }
    };
  }, SOIR);
  assert.deepEqual(g.lfCandidates(g.S.planets[0], 'lfresearch').map(x => x.id), [11201, 11203]);
});

t('l\'effet lu une fois survit à une relecture de la liste', () => {
  const g = app(null, SOIR);
  const detail = { lvl: 0, state: 'ok', next: 1, cost: [29000, 17000, 3000], secs: 413, eff: 2 };
  const liste = { lvl: 0, state: 'ok' };   // la liste ne porte ni prix ni effet
  assert.equal(g.lfMerge(detail, liste).eff, 2, 'la lecture de liste efface l\'effet');
  assert.equal(g.lfMerge(undefined, liste).eff, undefined, 'rien d\'inventé sans lecture');
  assert.equal(g.lfMerge(detail, { ...liste, eff: 9 }).eff, 2, 'un rang hors bornes est refusé');
});

t('à prix égal, une option lue passe devant une option estimée', () => {
  const g = app(s => {
    s.planets[0].lf = {
      11101: { lvl: 2, state: 'ok', secs: 90, seen: { 1: [1000, 500, 0], 2: [1000, 500, 0] } },
      11102: { lvl: 0, state: 'ok', next: 1, cost: [1000, 500, 0], secs: 60 }
    };
  }, SOIR);
  const c = g.lfCandidates(g.S.planets[0], 'lfbuilding');
  assert.deepEqual(c.map(x => x.src), ['lu', 'estimé']);
});

t('une case dont on sait estimer le prix ne fait plus redemander d\'en ouvrir une', () => {
  const g = app(s => {
    s.syncAt = SOIR;
    s.planets.forEach(p => { p.lf = { 11101: { lvl: 2, state: 'ok', secs: 60, seen: DEUX_VUS } }; });
  }, SOIR, null, true);
  assert.ok(!g.dailyMissions().some(m => m.id === 'lfb'), 'plus de carte « clique une case »');
});

t('après une montée simulée, la même case reste estimable au niveau suivant', () => {
  const g = vieSur({ 11101: { lvl: 2, state: 'ok', secs: 60, seen: DEUX_VUS } });
  const acts = g.simulateDay().sessions.flatMap(s => s.acts).filter(a => a.kind === 'lf');
  assert.ok(acts.length >= 2, 'plusieurs niveaux de suite : ' + acts.length);
  assert.deepEqual(acts.slice(0, 2).map(a => a.lvl), [3, 4]);
  assert.ok(acts[1].cost[0] > acts[0].cost[0], 'le prix suit la courbe');
});

t('la durée vue sert quand la liste n\'en porte pas, jamais contre une durée lue', () => {
  const g = avecGid();
  ouvre(g, 11101, 5, [1000, 500, 0], 60);
  g.applyGame({ planets: { 33009: { lf: { 11101: { lvl: 5, state: 'ok', secs: 30 } } } }, timers: [], moves: [] });
  assert.equal(g.S.planets[0].lf[11101].secs, 30, 'la durée lue du jour prime');
  ouvre(g, 11101, 6, [1100, 500, 0], 0);
  assert.ok(!(g.S.planets[0].lf[11101].secs > 0), 'une lecture sans durée ne reprend pas l\'ancienne');
});

t('un niveau au-delà des bornes n\'est pas mémorisé', () => {
  const g = avecGid();
  ouvre(g, 11101, 5000, [100, 50, 0]);
  assert.deepEqual(g.S.planets[0].lf[11101].seen, {});
});

t('une estimation finie mais au-dessus du plafond n\'est pas proposée', () => {
  const g = app(null, SOIR);
  const v = { seen: { 1: [1e14, 0, 0], 2: [2e14, 0, 0] } };
  assert.deepEqual(g.lfCost(v, 3).cost, [4e14, 0, 0]);
  assert.equal(g.lfCost(v, 6), null, '1,6e15 dépasse 1e15');
});

/** Un relevé de panneau réduit à ses libellés de bâtiments. */
const lus = (labels, at) => ({ at: at == null ? SOIR : at, factor: 1, rows: labels.map(label => ({ label })) });

t('l\'esp\u00e8ce se d\u00e9duit des b\u00e2timents lus sur la plan\u00e8te', () => {
  const g = app(null, SOIR);
  assert.equal(g.speciesOf(lus(['Centre technologique runique (Niveau 1)'])), 'rocktal');
  assert.equal(g.speciesOf(lus(['Centre de recherche (Niveau 2)'])), 'humans');
  assert.equal(g.speciesOf(lus(['Centre de recherche en robotique (Niveau 0)'])), 'mechas');
});

t('un b\u00e2timent de forme de vie au niveau 0 nomme encore l\'esp\u00e8ce', () => {
  const g = app(null, SOIR);
  assert.equal(g.speciesOf(lus(['Mine de m\u00e9tal (Niveau 21)', 'Centre de recherche en robotique (Niveau 0)'])), 'mechas');
});

t('sans b\u00e2timent de forme de vie, l\'esp\u00e8ce reste inconnue', () => {
  const g = app(null, SOIR);
  assert.equal(g.speciesOf(lus(['Mine de m\u00e9tal (Niveau 21)'])), null);
  assert.equal(g.speciesOf(lus([])), null);
  assert.equal(g.speciesOf(undefined), null);
  assert.equal(g.speciesOf({}), null);
});

t('l\'esp\u00e8ce d\'une plan\u00e8te vient de son propre relev\u00e9, et d\'un relev\u00e9 de moins de sept jours', () => {
  const g = app(s => {
    s.planets[0].gid = '33001'; s.planets[1].gid = '33002';
    s.prod = { 33001: lus(['Centre de recherche (Niveau 2)']), 33002: lus(['Centre technologique runique (Niveau 1)'], SOIR - 8 * 86400e3) };
  }, SOIR);
  assert.equal(g.speciesOfPlanet(g.S.planets[0]), 'humans');
  assert.equal(g.speciesOfPlanet(g.S.planets[1]), null, 'relev\u00e9 p\u00e9rim\u00e9');
});

t('une plan\u00e8te jamais lue n\'a pas d\'esp\u00e8ce', () => {
  const g = app(s => { s.planets[0].gid = '33001'; delete s.prod; }, SOIR);
  assert.equal(g.speciesOfPlanet(g.S.planets[0]), null);
});

t('les esp\u00e8ces lues sont compt\u00e9es une fois, m\u00eame sur deux plan\u00e8tes', () => {
  const g = app(s => {
    s.planets[0].gid = '33001'; s.planets[1].gid = '33002';
    s.lf.found = [];
    s.prod = { 33001: lus(['Centre technologique runique (Niveau 1)']), 33002: lus(['Centre technologique runique (Niveau 1)']) };
  }, SOIR);
  assert.deepEqual(g.foundLifeforms(), ['rocktal']);
});

t('sans rien de lu, la case \u00e0 cocher reste le rep\u00e8re', () => {
  const g = app(s => { s.lf.found = ['humans', 'kaelesh']; delete s.prod; }, SOIR);
  assert.deepEqual(g.foundLifeforms(), ['humans', 'kaelesh']);
});

t('la meilleure forme de vie se choisit parmi les lues et les coch\u00e9es', () => {
  const lu = app(s => {
    s.planets[0].gid = '33001'; s.lf.found = ['rocktal']; s.day.focus = 'fleet';
    s.prod = { 33001: lus(['Centre de recherche en robotique (Niveau 0)']) };
  }, SOIR);
  assert.equal(lu.bestLifeform(), 'mechas', 'une esp\u00e8ce lue est candidate');
  const garde = app(s => {
    s.planets[0].gid = '33001'; s.lf.found = ['rocktal'];
    s.prod = { 33001: lus(['Centre de recherche (Niveau 2)']) };
  }, SOIR);
  assert.equal(garde.bestLifeform(), 'rocktal', 'une lecture n\'efface pas la case');
});

t('une esp\u00e8ce lue s\'ajoute \u00e0 celles coch\u00e9es, elle n\'en retire aucune', () => {
  const g = app(s => {
    s.planets[0].gid = '33001'; s.lf.found = ['humans', 'kaelesh'];
    s.prod = { 33001: lus(['Centre technologique runique (Niveau 1)']) };
  }, SOIR);
  assert.deepEqual(g.foundLifeforms().slice().sort(), ['humans', 'kaelesh', 'rocktal']);
});

t('sans coche d\u00e9finie ni lecture, les Humains restent le rep\u00e8re', () => {
  const g = app(s => { s.lf.found = null; delete s.prod; }, SOIR);
  assert.deepEqual(g.foundLifeforms(), ['humans']);
});

t('un libell\u00e9 espac\u00e9 ou en minuscules nomme encore l\'esp\u00e8ce', () => {
  const g = app(null, SOIR);
  assert.equal(g.speciesOf(lus(['  CENTRE DE RECHERCHE (niveau 2) '])), 'humans');
  assert.equal(g.speciesOf(lus(['  centre de recherche en robotique (NIVEAU 0)  '])), 'mechas');
});

t('le plan du jour voit le bonus de forme de vie lu', () => {
  const jour = prod => app(s => {
    s.planets.forEach(p => { p.stock.m = 0; p.stock.c = 0; p.stock.d = 0; });
    s.planets[1].gid = '33001'; /* la colonie : c'est elle que le plan fait construire */
    if (prod) s.prod = { 33001: { lfBonus: prod, at: SOIR, factor: 1 } };
  }, SOIR).simulateDay();
  const sans = JSON.stringify(jour(null)), avec = JSON.stringify(jour([500000, 0, 0, 0]));
  assert.notStrictEqual(avec, sans, 'le plan ignore le bonus lu');
});

t('un prix relu au même niveau garde l\'heure de sa première lecture', () => {
  const tile = { lvl: 2, state: 'ok', next: 3, cost: [1440, 720, 0] };
  const a = app(null, SOIR), b = app(null, SOIR + 3 * 86400e3);
  const premiere = a.lfMerge(undefined, tile);
  const relue = b.lfMerge(premiere, tile);
  assert.equal(relue.seenAt[3], SOIR, 'l\'heure a bougé : ' + relue.seenAt[3]);
  const autre = b.lfMerge(premiere, { ...tile, cost: [2000, 720, 0] });
  assert.equal(autre.seenAt[3], SOIR + 3 * 86400e3, 'un prix différent se date à nouveau');
});

t('la limite de sept jours : 6,9 jours compte, 7 jours pile ne compte plus', () => {
  const g = app(s => {
    s.planets[0].gid = '33001'; s.planets[1].gid = '33002';
    s.prod = { 33001: lus(['Centre de recherche (Niveau 2)'], SOIR - 6.9 * 86400e3), 33002: lus(['Centre de recherche (Niveau 2)'], SOIR - 7 * 86400e3) };
  }, SOIR);
  assert.equal(g.speciesOfPlanet(g.S.planets[0]), 'humans');
  assert.equal(g.speciesOfPlanet(g.S.planets[1]), null);
});

t('la carte de d\u00e9couverte nomme les esp\u00e8ces lues et coch\u00e9es, et ne r\u00e9clame que le reste', () => {
  const g = app(s => {
    s.slots = { expo: [0, 2], fleet: [2, 7], at: SOIR }; s.syncAt = SOIR;
    s.planets[0].gid = '33001'; s.lf.found = ['kaelesh'];
    s.prod = { 33001: lus(['Centre technologique runique (Niveau 1)']) };
  }, SOIR);
  const c = g.dailyMissions().find(m => m.id === 'discovery');
  assert.ok(/Roctas/.test(c.why), 'lue : ' + c.why);
  assert.ok(/Kaeleshs/.test(c.why), 'coch\u00e9e : ' + c.why);
  assert.ok(/pas encore lue/i.test(c.how.join(' ')), 'la consigne ne vaut que pour ce qui n\'est pas lu');
});

t('les quatre races trouv\u00e9es, la d\u00e9couverte ne parle plus que d\'art\u00e9facts', () => {
  const g = app(s => {
    s.slots = { expo: [0, 2], fleet: [2, 7], at: SOIR }; s.syncAt = SOIR;
    s.lf.found = ['humans', 'rocktal', 'mechas', 'kaelesh'];
  }, SOIR);
  const c = g.dailyMissions().find(m => m.id === 'discovery');
  assert.ok(/quatre races/.test(c.why), 'elle le dit : ' + c.why);
  assert.ok(!/nouvelles races/.test(c.why), 'elle n\'en promet plus : ' + c.why);
  assert.ok(!/Coche-la/.test(c.how.join(' ')), 'plus rien \u00e0 cocher');
});

t('les r\u00e9glages montrent les esp\u00e8ces lues sans case \u00e0 cocher', () => {
  const g = app(s => {
    s.planets[0].gid = '33001';
    s.prod = { 33001: lus(['Centre technologique runique (Niveau 1)']) };
  }, SOIR);
  const h = g.lfSettingsHtml();
  assert.ok(!/data-lf="rocktal"/.test(h), 'pas de case pour une esp\u00e8ce lue');
  assert.ok(/data-lf="humans"/.test(h), 'une case pour les autres');
  assert.ok(/lue sur tes plan\u00e8tes/i.test(h));
});

/* ---------- le lien d'une carte mène au bon système ---------- */

/* Trois inactifs voisins de la planète mère (1:142:8). Au-delà de trente
   systèmes, raidTargets les écarte, d'où le 140. */
const API_INACTIFS = {
  planets: [['1:140:8', 'p1'], ['1:140:7', 'p2'], ['1:140:5', 'p3']],
  players: { p1: ['Alpha', 'i'], p2: ['Beta', 'i'], p3: ['Gamma', 'i'] },
  scores: { p1: [1000], p2: [900], p3: [800] }
};
const carteRaid = g => g.dailyMissions().find(m => m.id === 'raid');

t('le lien de la carte de pillage ouvre la galaxie au bon système', () => {
  const g = app(s => { s.host = 's1-fr.ogame.gameforge.com'; }, SOIR, API_INACTIFS);
  const c = carteRaid(g);
  assert.ok(c, 'la carte de pillage sort');
  const url = g.missionGo(c);
  assert.ok(/[?&]galaxy=1(&|$)/.test(url), 'la galaxie est dans le lien : ' + url);
  assert.ok(/[?&]system=140(&|$)/.test(url), 'le système aussi : ' + url);
});

t('une carte de galaxie sans coordonnées garde son lien de page', () => {
  const g = app(s => { s.host = 's1-fr.ogame.gameforge.com'; }, SOIR);
  const url = g.missionGo({ id: 'inactive', tags: [] });
  assert.ok(/component=galaxy/.test(url), 'la page galaxie : ' + url);
  assert.ok(!/galaxy=\d/.test(url), 'sans coordonnées inventées : ' + url);
});

t('le pillage prêt mène au système de la cible', () => {
  const g = app(s => {
    s.host = 's1-fr.ogame.gameforge.com';
    s.raid = { coords: '1:140:8', safe: true, m: 50000, c: 0, d: 0, at: SOIR };
  }, SOIR, API_INACTIFS);
  const c = g.dailyMissions().find(m => m.id === 'raid-go');
  assert.ok(c, 'la carte sort');
  assert.ok(/[?&]system=140(&|$)/.test(g.missionGo(c)), 'le lien vise le bon système');
});

t('un emplacement de colonie pris mène au système concerné', () => {
  const g = app(s => {
    s.host = 's1-fr.ogame.gameforge.com';
    s.colo.target = '1:140:7';
  }, SOIR, API_INACTIFS);
  const c = g.dailyMissions().find(m => m.id === 'colo-taken');
  assert.ok(c, 'la carte sort');
  assert.ok(/[?&]system=140(&|$)/.test(g.missionGo(c)), 'le lien vise le bon système');
});

/* ---------- ce qui lève la limite ---------- */

t('quand les emplacements de flotte brident le pillage, la carte dit quoi monter', () => {
  const g = app(s => {
    s.host = 's1-fr.ogame.gameforge.com';
    s.slots = { fleet: [8, 9], expo: [0, 2], at: SOIR };
    s.syncAt = SOIR;
    s.tech.computer = 2;
  }, SOIR, API_INACTIFS);
  const c = carteRaid(g);
  assert.ok(c, 'la carte sort');
  const txt = c.why + ' ' + (c.how || []).join(' ');
  assert.ok(/Ordinateur 3/.test(txt), 'elle nomme le niveau qui débloque : ' + txt);
});

t('la découverte dit ce qui ajoute un emplacement quand il n\'en reste qu\'un', () => {
  const g = app(s => {
    s.slots = { fleet: [6, 7], expo: [0, 2], at: SOIR }; s.syncAt = SOIR; s.tech.computer = 2;
  }, SOIR);
  const c = g.dailyMissions().find(m => m.id === 'discovery');
  assert.ok(c, 'la carte sort');
  assert.ok(/Ordinateur 3/.test(c.how.join(' ')), 'le levier est nommé : ' + c.how.join(' '));
});

t('avec de la place, la découverte ne parle pas d\'Ordinateur', () => {
  const g = app(s => { s.slots = { fleet: [1, 7], expo: [0, 2], at: SOIR }; s.syncAt = SOIR; }, SOIR);
  const c = g.dailyMissions().find(m => m.id === 'discovery');
  assert.ok(c && !/Ordinateur/.test(c.how.join(' ')), 'rien à lever');
});

t('sans bridage, la carte ne parle pas d\'Ordinateur', () => {
  const g = app(s => { s.host = 's1-fr.ogame.gameforge.com'; }, SOIR, API_INACTIFS);
  const c = carteRaid(g);
  const txt = c.why + ' ' + (c.how || []).join(' ');
  assert.ok(!/Ordinateur/.test(txt), 'rien à lever : ' + txt);
});

/* ---------- satellites contre centrale ---------- */

const sats = g => g.simulateDay().sessions.flatMap(x => x.acts).filter(a => a.kind === 'sats');
/* La planète mère de la fixture tourne déjà à 82 % faute d'énergie. */

/** Le réglage du compte, et la surcharge de la planète mère. */
const OUI = s => { s.settings.sats = true; };
const nrj = g => g.planetAlerts(g.S.planets[0]).find(x => /Rétablir l'énergie/.test(x.what));

t('par défaut les satellites ne sont pas autorisés', () => {
  const g = app();
  // une sauvegarde d'avant ce réglage n'a pas la clé : absente vaut non
  assert.ok(!g.S.settings.sats, 'le compte dit non tant que le joueur n\'a rien dit');
  assert.equal(g.satsOk(g.S.planets[0]), false);
});

t('réglage à non : aucune recommandation ne parle de satellites', () => {
  const g = app();
  assert.equal(sats(g).length, 0, 'ils partiraient en débris au premier raid');
  const a = nrj(g);
  assert.ok(a, 'le manque d\'énergie se dit quand même : ' + JSON.stringify(g.planetAlerts(g.S.planets[0])));
  assert.ok(!/satellite/i.test(a.why), 'rien que des centrales : ' + a.why);
  assert.ok(/[Cc]entrale/.test(a.why), 'et une centrale est nommée : ' + a.why);
});

t('réglage à oui : les satellites reviennent, avec leur prix', () => {
  const g = app(OUI);
  const a = sats(g);
  assert.ok(a.length > 0, 'le prix décide, maintenant que le joueur les accepte');
  assert.ok(a[0].cost[1] > 0 && a[0].cost[2] > 0, 'cristal et deutérium : ' + JSON.stringify(a[0].cost));
  assert.ok(/\+\d+ énergie/.test(a[0].why), 'et le gain d\'énergie : ' + a[0].why);
});

t('le non d\'une planète passe devant le oui du compte', () => {
  const g = app(s => { OUI(s); s.planets[0].satsOk = false; });
  assert.equal(g.satsOk(g.S.planets[0]), false);
  assert.equal(sats(g).filter(a => a.p === 0).length, 0, 'pas sur celle-là');
});

t('le oui d\'une planète passe devant le non du compte', () => {
  const g = app(s => { s.planets[0].satsOk = true; });
  assert.equal(g.satsOk(g.S.planets[0]), true);
  assert.ok(sats(g).some(a => a.p === 0), 'celle-là les accepte');
});

t('les satellites déjà posés comptent, réglage ou non', () => {
  const g0 = app(s => { s.planets[0].sats = 0; });
  const sans = g0.production(g0.S.planets[0]);
  const g = app(s => { s.planets[0].sats = 10; });
  const avec = g.production(g.S.planets[0]);
  assert.ok(!g.satsOk(g.S.planets[0]), 'et pourtant le réglage dit non');
  assert.ok(avec.eProd - sans.eProd >= 10 * g.satEnergy(g.S.planets[0].tmax),
    'dix satellites rendent leur énergie : ' + (avec.eProd - sans.eProd));
});

/* ---------- les sources d'énergie comparées ---------- */

t('la liste des options va de la moins chère à la plus chère par point', () => {
  const g = app(OUI);
  const o = g.energyOptions(g.S.planets[0]);
  assert.ok(o.length >= 2, 'au moins la centrale et les satellites : ' + JSON.stringify(o.map(x => x.kind)));
  for(let i = 1; i < o.length; i++) assert.ok(o[i-1].perPoint <= o[i].perPoint, 'triées par prix du point');
  for(const x of o) assert.ok(x.gain > 0, x.kind + ' doit rapporter de l\'énergie');
});

t('la centrale solaire est toujours posable, la fusion seulement avec ses prérequis', () => {
  const g = app(s => { s.planets[0].b.deut = 0; s.tech.energy = 0; });
  const o = g.energyOptions(g.S.planets[0]);
  const sol = o.find(x => x.kind === 'solar'), fus = o.find(x => x.kind === 'fusion');
  assert.ok(sol && sol.prete, 'la centrale solaire ne demande rien');
  assert.ok(!fus || !fus.prete, 'la fusion demande Synthétiseur 5 et Énergie 3');
  if(fus) assert.ok(/manque/.test(fus.pourquoiPas), fus.pourquoiPas);
});

t('une option écartée ne se dit que si elle était la moins chère', () => {
  const g = app();
  const o = g.energyOptions(g.S.planets[0]);
  const sat = o.find(x => x.kind === 'sats'), best = o.filter(x => x.prete)[0];
  assert.ok(sat && !sat.prete, 'le réglage par défaut les écarte');
  const dit = g.planetAlerts(g.S.planets[0]).some(x => /Satellites écartés/.test(x.what));
  assert.equal(dit, sat.perPoint < best.perPoint,
    'on en parle exactement quand le réglage coûte quelque chose au joueur');
});

/* ---------- mines bridées à la main ---------- */

/* Le panneau d'une colonie dont le métal tourne à 80 % et le deutérium à 30 %.
   Pleines, ces deux mines coûteraient 1.791 et 2.002 d'énergie : le bridage en
   économise 1.761. */
const PANNEAU_BRIDE = [
  'Facteur de production: 100%',
  'Mine de métal (Niveau 22)\t34.384\t0\t0\t-1.432\t80%',
  'Mine de cristal (Niveau 19)\t0\t18.592\t0\t-1.162\t100%',
  'Synthétiseur de deutérium (Niveau 18)\t0\t0\t2.776\t-600\t30%',
  'Total par heure:\t1\t1\t1\t39/4.000'
].join('\n');

/** La colonie, son relevé bridé en place, avec le solde d'énergie voulu. */
function bride(solde) {
  const g = app();
  const p = g.S.planets[1];
  p.gid = 'colo1';
  p.eAdj = solde - g.production(p).eBal;
  g.S.prod = { colo1: Object.assign(g.parseProdPanel(PANNEAU_BRIDE), { at: SOIR }) };
  return { g, p };
}

t('le bridage des mines est lu, avec ce qu\'il économise', () => {
  const { g, p } = bride(0);
  assert.deepEqual(g.bridage(p), { min: 30, extra: 1761 });
});

t('l\'énergie revenue, le rappel de remonter les mines', () => {
  const { g, p } = bride(1800);
  const a = g.planetAlerts(p).find(x => /Remonter les mines/.test(x.what));
  assert.ok(a, 'rien ne rappelle de les remonter : ' + JSON.stringify(g.planetAlerts(p)));
  assert.match(a.why, /bridées à 30 %/);
  assert.match(a.why, /39 de libre/, 'la marge restante est dite');
});

t('l\'énergie encore courte, le bridage est rappelé sans dire de remonter', () => {
  const { g, p } = bride(1000);
  const alerts = g.planetAlerts(p);
  assert.ok(!alerts.some(x => /Remonter les mines/.test(x.what)), 'l\'énergie ne suffit pas');
  const a = alerts.find(x => /Mines bridées/.test(x.what));
  assert.ok(a && /manque 761/.test(a.why), 'ce qui manque est chiffré : ' + JSON.stringify(a));
});

t('mines à 100 %, rien à dire', () => {
  const g = app();
  const p = g.S.planets[1];
  p.gid = 'colo1';
  g.S.prod = { colo1: Object.assign(g.parseProdPanel(PANNEAU_CARIBOU), { at: SOIR }) };
  assert.equal(g.bridage(p), null);
  assert.ok(!g.planetAlerts(p).some(x => /mines/i.test(x.what)));
});

/* ---------- la vocation d'une planète ---------- */
/* Le sol ne se choisit pas : il se lit. Et il ne se lit qu'en comparant les
   planètes entre elles — « la planète à cristal » est une place dans l'empire,
   pas une valeur absolue. */

t('la planète en 8 porte le métal, la colonie en 6 ne porte rien', () => {
  const g = app();
  const v = g.vocations();
  assert.deepEqual(v.mere.keys, ['metal', 'deut'], 'mère première sur métal et deutérium');
  assert.ok(!v.colo, 'la colonie n\'est première sur rien');
});

t('sans planète en position 1 à 3, personne ne porte le cristal', () => {
  const g = app();
  const v = g.vocations();
  assert.ok(!Object.values(v).some(x => x.keys.includes('crystal')));
});

t('une planète en position 1 porte le cristal', () => {
  const g = app(s => { s.planets[1].coords = '1:142:1'; s.planets[1].tmax = 240; });
  assert.deepEqual(g.vocations().colo.keys, ['crystal']);
});

t('une planète seule n\'a pas de vocation', () => {
  const g = app(s => { s.planets = [s.planets[0]]; });
  assert.deepEqual(g.vocations(), {});
});

t('deux planètes au même terrain n\'ont aucune vocation', () => {
  const g = app(s => { s.planets[1].coords = '1:143:8'; s.planets[1].tmax = 40; });
  assert.deepEqual(g.vocations(), {});
});

t('des coordonnées illisibles donnent une vocation inconnue, sans fausser les autres', () => {
  const g = app(s => {
    s.planets.push(Object.assign({}, s.planets[1], { id: 'perdue', coords: 'ailleurs' }));
  });
  const v = g.vocations();
  assert.deepEqual(v.perdue, { keys: [], why: 'vocation inconnue' });
  assert.deepEqual(v.mere.keys, ['metal', 'deut'], 'la mère garde sa vocation');
  assert.equal(g.terrainRates(g.S.planets[2]), null);
});

t('la vocation porte sa raison', () => {
  const g = app();
  assert.ok(/position 8/.test(g.vocations().mere.why), g.vocations().mere.why);
});

/* ---------- le centre ---------- */
/* Le wiki appelle ça une Vault Planet : la planète où vivent le labo et le
   chantier. Il dit aussi que ce n'est pas la planète mère, et c'est pourtant
   elle que le copilote prenait, parce qu'il prenait la première de la liste. */

t('le centre est la planète qui porte déjà le labo', () => {
  assert.equal(app().centrePlanet().id, 'mere');
});

t('sur un empire neuf, le centre est la planète qui a le plus de cases, pas la première', () => {
  const g = app(s => {
    s.planets[0].coords = '1:142:15'; s.planets[0].tmax = -110;
    s.planets[0].b.lab = 0; s.planets[0].b.shipyard = 0;
    s.planets[1].coords = '1:142:8'; s.planets[1].tmax = 40;
  });
  assert.equal(g.centrePlanet().id, 'colo', 'la position 8 a 204 cases, la 15 en a 127');
});

t('en stratégie flotte, il n\'y a pas de centre', () => {
  const g = app(s => { s.day.focus = 'fleet'; });
  assert.equal(g.centreIndex(), -1);
  assert.equal(g.centrePlanet(), null);
});

t('une planète seule n\'est pas un centre', () => {
  const g = app(s => { s.planets = [s.planets[0]]; });
  assert.equal(g.centreIndex(), -1);
});

t('le joueur reprend la main', () => {
  const g = app(s => { s.centre = 'colo'; });
  assert.equal(g.centrePlanet().id, 'colo');
  assert.equal(g.centreWhy(), '');
});

t('un centre qui ne répond plus retombe sur le choix automatique', () => {
  const g = app(s => { s.centre = 'disparue'; });
  assert.equal(g.centrePlanet().id, 'mere');
});

t('l\'ancien réglage de rôle est oublié au chargement', () => {
  const g = app(s => { s.roles = { mere: 'crystal' }; });
  assert.equal(g.S.roles, undefined);
});

/* ---------- la recherche part du centre ---------- */

t('la recherche part du centre, pas du plus haut labo', () => {
  const g = app(s => { s.centre = 'colo'; s.planets[1].b.lab = 2; });
  assert.equal(g.labPlanet().id, 'colo', 'la mère a le labo 5, le centre est la colonie');
});

t('la carte du labo dit pourquoi c\'est là', () => {
  const g = app(s => { s.centre = 'colo'; });
  const a = g.simulateDay().sessions.flatMap(x => x.acts).find(x => x.kind === 'b' && x.k === 'lab');
  assert.ok(a, 'un labo est proposé');
  assert.ok(/centre/i.test(a.why), 'la raison nomme le centre : ' + a.why);
});

t('le niveau de labo est celui du centre, pas le maximum de l\'empire', () => {
  const g = app(s => { s.centre = 'colo'; });
  assert.equal(g.labLevel(), 0, 'la colonie n\'a pas de labo, la mère en a 5');
});

t('sans centre, le labo reste le plus haut de l\'empire', () => {
  const g = app(s => { s.day.focus = 'fleet'; });
  assert.equal(g.labLevel(), 5);
});

/* ---------- les liens et le raid ---------- */

t('le raid part de la planète qui a les transporteurs, pas du centre', () => {
  const g = app(s => {
    s.centre = 'colo';
    s.raid = { coords: '1:142:9', m: 500000, c: 200000, d: 0, at: SOIR, safe: true };
  });
  assert.equal(g.raidPlan().home.id, 'mere', 'les transporteurs sont sur la mère');
});

t('la galaxie s\'ouvre depuis le centre', () => {
  const g = app(s => {
    s.centre = 'colo'; s.host = 's199-fr.ogame.gameforge.com';
    s.planets[0].gid = '111'; s.planets[1].gid = '222';
  });
  assert.ok(/cp=222/.test(g.galaxyUrl('1:142:9')), 'la galaxie s\'ouvre sur la colonie : ' + g.galaxyUrl('1:142:9'));
});

t('la planète du fret est celle qui porte la plus grosse soute', () => {
  const g = app(s => { s.planets[1].ships = { lc: 40 }; });
  assert.equal(g.cargoHomeIndex(), 1, '40 grands transporteurs battent 6 petits et 2 grands');
});

/* ---------- le chantier de l'empire ---------- */

t('le vaisseau de colonisation sort du centre', () => {
  const g = app(s => {
    s.centre = 'colo';
    s.planets[1].b.robot = 2; s.planets[1].b.shipyard = 4;
    s.planets[1].stock = { m: 80000, c: 80000, d: 20000, at: SOIR };
  });
  const a = g.simulateDay().sessions.flatMap(x => x.acts)
    .find(x => x.kind === 'ship' && /colonisation/i.test(x.what));
  assert.ok(a, 'un vaisseau de colonisation est proposé');
  assert.equal(a.p, 1, 'le chantier du centre sort le vaisseau');
});

t('une colonie monte son chantier pour ses propres transporteurs, centre ou pas', () => {
  const g = app(s => {
    s.centre = 'mere';
    // Sans transporteur nulle part, rien ne rapatrie : le hangar de la colonie
    // reste plein, et c'est ce qui lui fait mériter son propre chantier.
    s.planets[0].ships = {};
    Object.assign(s.planets[1].b, { robot: 2, smetal: 8, scrystal: 8, sdeut: 8 });
  });
  // Un stock aux trois quarts de la soute : au-dessus du seuil qui mérite un
  // transporteur, en dessous de celui qui réclamerait un hangar de plus.
  const cap = g.storageCap(8);
  g.S.planets[1].stock = { m: cap * 0.75, c: cap * 0.75, d: cap * 0.75, at: SOIR };
  const b = g.simulateDay().sessions.flatMap(x => x.acts).filter(x => x.kind === 'b' && x.p === 1);
  assert.ok(b.some(x => x.k === 'shipyard'), 'la règle locale survit au centre : ' + b.map(x => x.k).join(','));
});

/* ---------- la carte de planète ---------- */

t('la carte d\'une planète porte sa vocation et sa raison', () => {
  const h = app().VIEWS.planets();
  assert.ok(/[Mm]étal/.test(h) && /position 8/.test(h), 'la vocation et sa raison sont écrites');
});

t('la carte du centre dit le risque', () => {
  assert.ok(/espionnage/i.test(app().VIEWS.planets()), 'le risque du centre est dit');
});

t('un centre sans labo dit ce que le choix coûte', () => {
  const g = app(s => { s.centre = 'colo'; });
  assert.ok(/ne suit pas/.test(g.VIEWS.planets()), 'la carte annonce le labo laissé derrière');
});

t('le menu de rôle a disparu', () => {
  assert.ok(!/data-role=/.test(app().VIEWS.planets()), 'plus de menu Rôle');
});

/* ---------- ce que la relecture de branche a trouvé ---------- */

t('un chantier plus haut ailleurs ne déplace pas la recherche hors du labo', () => {
  // Le pire conseil possible : repayer un labo déjà posé. Le chantier ne doit
  // donc pas décider du centre tant qu'un labo existe quelque part.
  const g = app(s => {
    s.planets[0].b.lab = 10; s.planets[0].b.shipyard = 4;
    s.planets[1].b.shipyard = 12;
  });
  assert.equal(g.centrePlanet().id, 'mere', 'le labo 10 garde le centre');
  assert.equal(g.labLevel(), 10);
});

t('un chantier posé sur une colonie ne fait pas bouger le centre tout seul', () => {
  const neuf = s => { s.planets.forEach(p => { p.b.lab = 0; p.b.shipyard = 0; }); };
  const avant = app(neuf);
  const apres = app(s => { neuf(s); s.planets[1].b.shipyard = 1; });
  assert.equal(avant.centrePlanet().id, apres.centrePlanet().id,
    'le centre ne doit pas suivre le premier chantier de transporteur d\'une colonie');
});

t('la colonie part de la même planète que celle qui construit le vaisseau', () => {
  // `from` est un rang d'avant la migration : le laisser écraserait `fromId`.
  const g = app(s => { s.centre = 'mere'; delete s.colo.from; s.colo.fromId = 'colo'; });
  assert.equal(g.coloFrom().id, 'mere', 'sinon la durée de vol annoncée est celle d\'une autre planète');
});

t('le lien du raid ouvre la planète qui a les transporteurs', () => {
  const g = app(s => {
    s.ui.tool = 'explore'; s.host = 's199-fr.ogame.gameforge.com';
    s.planets[0].gid = '111'; s.planets[1].gid = '222';
    s.planets[0].ships = {}; s.planets[1].ships = { lc: 12 };
    s.raid = { coords: '1:142:9', m: 500000, c: 200000, d: 0, at: SOIR, safe: true };
  }, SOIR, API_INACTIFS);
  g.REFRESH.tools();
  const h = g.html().rdPlan || '';
  assert.ok(/cp=222/.test(h), 'le lien part de la colonie, qui a la soute : ' + h.slice(-400));
});

t('en stratégie flotte, la carte dit pourquoi il n\'y a pas de centre', () => {
  const h = app(s => { s.day.focus = 'fleet'; }).VIEWS.planets();
  assert.ok(!/data-centre=/.test(h), 'pas de case à cocher inerte');
  assert.ok(/dispers/i.test(h), 'la raison est dite : ' + h.slice(0, 300));
});

t('la carte du chantier du centre dit pourquoi là', () => {
  // De grands hangars loin d'être pleins : sinon la règle du hangar plein
  // gagne tous les créneaux de la colonie et le prérequis n'est jamais choisi.
  const g = app(s => {
    s.centre = 'colo';
    Object.assign(s.planets[1].b, { robot: 0, smetal: 8, scrystal: 8, sdeut: 8 });
  });
  const a = g.simulateDay().sessions.flatMap(x => x.acts)
    .find(x => x.kind === 'b' && (x.k === 'shipyard' || x.k === 'robot') && x.p === 1);
  assert.ok(a, 'un prérequis de chantier est proposé sur le centre');
  assert.ok(/centre/i.test(a.why), 'la raison nomme le centre : ' + a.why);
});

/* ---------- les détails relevés à la relecture ---------- */

t('la raison du deutérium ne promet pas un compte de planètes qu\'elle ne peut pas tenir', () => {
  const g = app(s => {
    s.planets.push(Object.assign({}, s.planets[1], { id: 'perdue', coords: 'ailleurs' }));
  });
  const why = g.vocations().mere.why;
  assert.ok(!/de tes \d+ plan/.test(why), 'pas de compte, il serait faux : ' + why);
});

t('deux planètes aussi froides se disent à égalité', () => {
  const g = app(s => {
    s.planets[1].tmax = 40;
    s.planets.push(Object.assign({}, s.planets[1], { id: 'chaude', coords: '1:142:3', tmax: 140 }));
  });
  const v = g.vocations();
  assert.ok(v.mere.keys.includes('deut') && v.colo.keys.includes('deut'), 'les deux portent le deutérium');
  assert.ok(/égalité/.test(v.mere.why), 'le superlatif se partage : ' + v.mere.why);
});

/* ---------- ce qui manque à l'empire pèse sur le classement des mines ---------- */

/** Une planète à cristal (position 1) encadrée par une mineuse à métal :
    l'empire déborde de métal, et le sol de la mère est bon pour le cristal. */
const GORGE_METAL = s => {
  s.planets[0].coords = '1:142:1';
  Object.assign(s.planets[0].b, { metal: 22, crystal: 19, deut: 19, solar: 40 });
  s.planets.push({
    id: 'mine', name: 'Mineuse', coords: '1:142:8', tmax: 40,
    b: Object.assign({}, s.planets[0].b, { metal: 30, crystal: 5, deut: 5, solar: 48 }),
    sats: 0, ships: {}, shipsAt: 0, stock: { m: 0, c: 0, d: 0, at: 0 }
  });
};

t('la ressource produite au-delà de sa part vaut moins, celle qui manque vaut plus', () => {
  const g = app(GORGE_METAL);
  const w = g.besoinEmpire();
  assert.ok(w[0] < 1, 'le métal déborde, il vaut moins que son cours : ' + w[0]);
  assert.ok(w[1] > 1 && w[2] > 1, 'cristal et deutérium manquent : ' + w.slice(1));
});

t('verser du métal dans l\'empire fait baisser le facteur du métal', () => {
  const avant = app(s => {}).besoinEmpire();
  const apres = app(GORGE_METAL).besoinEmpire();
  assert.ok(apres[0] < avant[0], `${apres[0]} doit tomber sous ${avant[0]}`);
});

t('un mélange sur sa cible ne corrige rien', () => {
  /* Le ratio lu comme des quantités : 3 de métal pour 2 de cristal pour 1 de
     deutérium. production() est trop contrainte pour viser ça pile ; on vérifie
     la formule sur un empire qui produit exactement sa cible. */
  const g = app(s => { s.settings.ratio = [1, 1, 1]; });
  const w = g.besoinEmpire.call(null);
  assert.equal(w.length, 3);
  assert.ok(w.every(x => x >= .5 && x <= 2), 'les bornes tiennent : ' + w);
});

t('les facteurs restent bornés quand une ressource manque tout à fait', () => {
  const g = app(s => { s.planets.forEach(p => { p.b.deut = 0; }); });
  const w = g.besoinEmpire();
  assert.ok(w[2] <= 2, 'un deutérium nul ne fait pas valoir la ressource cent fois : ' + w[2]);
  assert.ok(w.every(x => x >= .5), 'et rien ne tombe sous la moitié : ' + w);
});

t('l\'empire gorgé de métal fait passer la mine de cristal devant', () => {
  const g = app(GORGE_METAL);
  const p = g.S.planets[0];
  const r = g.rankUpgrades(p);
  /* Au cours du ratio seul, le métal gagnait : il coûte moins cher et son coût
     grossit moins vite. C'est la carte que le joueur voyait revenir. */
  const auCours = r.slice().sort((a, b) => a.payback - b.payback);
  assert.equal(auCours[0].key, 'metal', 'au cours, le métal gagne encore');
  assert.equal(r[0].key, 'crystal', 'au besoin de l\'empire, le cristal passe devant');
});

t('la pondération ne touche pas l\'amortissement affiché', () => {
  const nu = app(s => { s.planets[0].coords = '1:142:1'; Object.assign(s.planets[0].b, { metal: 22, crystal: 19, deut: 19, solar: 40 }); });
  const gorge = app(GORGE_METAL);
  const a = nu.rankUpgrades(nu.S.planets[0]).find(u => u.key === 'crystal');
  const b = gorge.rankUpgrades(gorge.S.planets[0]).find(u => u.key === 'crystal');
  /* Le chiffre de la carte se refait de tête : il ne doit pas bouger parce
     qu'une AUTRE planète a monté une mine. Seul l'ordre bouge. */
  assert.ok(Math.abs(a.payback - b.payback) < 1e-9, `${a.payback} ≠ ${b.payback}`);
  assert.ok(b.score < b.payback, 'le score, lui, tient compte du manque de cristal');
});

t('la carte dit ce qui manque à l\'empire et ce que le sol donne', () => {
  const g = app(GORGE_METAL);
  const why = g.mineWhy(g.S.planets[0], 'crystal');
  assert.ok(/manque de cristal/.test(why), 'le besoin se dit : ' + why);
  assert.ok(/planète à cristal/.test(why), 'la vocation se dit : ' + why);
  assert.ok(/\+40 % de cristal/.test(why), 'avec son bonus de position : ' + why);
  assert.ok(!/froide/.test(why), 'et pas la raison d\'une autre vocation : ' + why);
});

t('la carte dit aussi le cas gênant : tu en produis déjà trop', () => {
  const g = app(GORGE_METAL);
  assert.ok(/plus que ta part de métal/.test(g.mineWhy(g.S.planets[0], 'metal')),
    g.mineWhy(g.S.planets[0], 'metal'));
});

t('le classement des mines nourrit la raison de la carte', () => {
  const g = app(GORGE_METAL);
  // pickBuildings lit une planète SIMULÉE : elle porte son stock sous `st`.
  const p = Object.assign({}, g.S.planets[0], { st: [0, 0, 0] });
  const c = g.pickBuildings(p, { T: SOIR, iv: 90, goals: [] }).find(x => x.k === 'crystal');
  assert.ok(c && /manque de cristal/.test(c.why), 'la carte porte la raison : ' + (c && c.why));
});

t('l\'onglet Empire montre le mélange produit et sa cible', () => {
  const g = app(GORGE_METAL);
  g.VIEWS.planets(); g.REFRESH.planets();
  const h = lu(g.html().empireMix || '');
  assert.ok(/Mélange produit/.test(h), 'le mélange se lit : ' + h);
  assert.ok(/cible de/.test(h), 'et la cible avec : ' + h);
  assert.ok(/métal ×0\./.test(h), 'et le facteur appliqué au métal : ' + h);
});

t('le délai de retour d\'une colonie reste mesuré au cours du ratio', () => {
  /* Il compare des POSITIONS : pondérer sa montée par le manque de l'empire
     mesurerait chaque position avec une règle différente. */
  const g = app(s => { s.tech.astro = 8; GORGE_METAL(s); });
  assert.ok(g.colonyPayback(8).rate > g.colonyPayback(15).rate,
    'la position 8 (+35 % métal) produit encore plus que la 15');
});

t('la raison du centre ne disparaît pas quand le joueur confirme le conseil', () => {
  const g = app(s => { s.centre = 'mere'; });
  assert.equal(g.centreIndex(), 0);
  assert.ok(g.centreWhy(), 'confirmer le conseil ne doit pas faire taire sa raison');
});

t('retirer le centre emporte le réglage', () => {
  const g = app(s => { s.centre = 'colo'; });
  g.forgetPlanet('colo');
  assert.equal(g.S.centre, null, 'un id mort ne doit pas rester en sauvegarde');
});

t('une planète seule dit qu\'il n\'y a rien à comparer', () => {
  const h = app(s => { s.planets = [s.planets[0]]; }).VIEWS.planets();
  assert.ok(/rien à comparer/.test(h), 'le message dit la vérité : ' + h.slice(0, 300));
  assert.ok(!/aucune autre/.test(h), 'il n\'y a pas d\'autre planète dont la distinguer');
});

t('la ligne de vocation se remet à jour sans tout redessiner', () => {
  const g = app();
  g.REFRESH.planets();
  assert.ok(/[Mm]étal/.test(g.html()['pvoc-0'] || ''),
    'la vocation suit un changement de coordonnées sans attendre un rendu complet');
});

require('./defense.test')({ t, assert, app, relie, lu, SOIR });

/* ---------- inventaire des transporteurs ---------- */
/* Le cas vécu : les rapatriements laissent la soute stationnée sur les
   colonies, et la planète la plus riche passe la nuit pleine et nue. */

/** Caribou pleine et sans un vaisseau, toute la soute sur la colonie. */
function nue(mod) {
  return app(s => {
    relie(s);
    s.planets[0].name = 'Caribou';
    s.planets[0].ships = { pr: 4 };
    s.planets[0].stock = { m: 9e5, c: 4e5, d: 7e5, at: SOIR };
    s.planets[1].ships = { lc: 40, sc: 10 };
    if (mod) mod(s);
  });
}

t('la soute partie sur la colonie est inventoriée, pas ignorée', () => {
  const g = nue();
  const trous = g.cargoGaps();
  assert.equal(trous.length, 1, 'une seule planète manque de soute : ' + JSON.stringify(trous.map(x => x.p.name)));
  assert.equal(trous[0].p.name, 'Caribou');
  assert.ok(trous[0].cargo === 0 && trous[0].manque > 0, 'le manque est chiffré');
  assert.equal(trous[0].ailleurs[0].p.name, 'Colonie', 'et on sait où est la flotte');
});

t('la carte dit combien de chaque ressource charger, le plus cher d\'abord', () => {
  /* Le jeu demande trois nombres. Sans eux, le joueur clique « tout » sur le
     métal — ce qu'il a en plus grande quantité, et ce qui vaut le moins. */
  const g = nue(s => { s.planets[0].ships = { pr: 4, lc: 2 }; });
  const n = g.dailyMissions().find(m => /^night/.test(m.id) && /Caribou/.test(m.what));
  assert.ok(n && n.res, 'Caribou a sa carte, et elle porte les trois nombres');
  const r = n.res;
  const st = g.S.planets[0].stock;
  assert.ok(r[2] > 0 && r[2] < st.d, 'le deutérium part en premier, moins le plein : ' + JSON.stringify(r));
  assert.equal(r[0], 0, 'et le métal reste au sol tant que la soute est courte : ' + JSON.stringify(r));
});

t('soute suffisante : les pastilles portent tout le stock', () => {
  const g = app(s => { loin(s); s.planets[0].ships = { lc: 30, sc: 6 }; });
  const n = g.dailyMissions().find(m => m.id === 'night');
  const st = g.S.planets[0].stock;
  assert.equal(n.res[0], st.m, 'tout le métal : ' + JSON.stringify(n.res));
  assert.equal(n.res[1], st.c, 'tout le cristal');
  assert.ok(n.res[2] >= st.d - 3000 && n.res[2] <= st.d, 'tout le deutérium sauf le plein : ' + n.res[2]);
});

t('ce que la soute ne lève pas est dit sur la carte, avec où la trouver', () => {
  /* Le joueur doit savoir qu'il y a un mouvement à faire AVANT de charger :
     sinon il envoie sa flotte à moitié pleine et laisse le reste au sol. */
  const g = nue(s => { s.planets[0].ships = { pr: 4, lc: 2 }; });
  const n = g.dailyMissions().find(m => m.id === 'night');
  assert.ok(/Caribou/.test(n.what), 'la carte de tête est celle de Caribou : ' + n.what);
  const how = n.how.join(' ');
  assert.match(how, /restent au sol faute de soute/, how);
  assert.match(how, /Colonie/, 'et l\'endroit où la soute dort est nommé : ' + how);
  assert.match(how, /Ramène/, 'avec la carte qui l\'amène : ' + how);
});

t('une carte dit de ramener les transporteurs, en Stationner', () => {
  const g = nue();
  const m = g.dailyMissions().find(x => /^cargo-split/.test(x.id));
  assert.ok(m, 'rien ne propose de ramener la soute');
  assert.match(m.what, /de Colonie vers Caribou/, m.what);
  assert.equal(m.mission, 4, 'Stationner : un Transporter repartirait seul');
  assert.match(m.how[0], /Stationner/);
  const u = g.missionGo(m);
  assert.match(u, /mission=4/, 'le lien prépare la mission : ' + u);
  assert.match(u, /cp=33602/, 'elle part de la colonie, où sont les vaisseaux : ' + u);
  assert.match(u, /am203=/, 'avec les grands transporteurs : ' + u);
});

t('une flotte déjà partie vaut un « Fait » : la carte ne revient pas', () => {
  // Le vécu : les transporteurs sont en l'air, et les cinq cartes restent là
  // jusqu'à ce que le joueur clique « Fait » sur chacune.
  const g = nue();
  const m = g.dailyMissions().find(x => /^cargo-split/.test(x.id));
  assert.ok(!g.missionDone(m), 'rien n\'est parti, la carte doit tenir');
  g.S.moves = [{ mission: 4, ret: false, arrival: SOIR / 1000 + 3600, origin: '1:142:6', dest: m.dest }];
  assert.ok(g.missionDone(m), 'le rapatriement vole, la carte reste : ' + m.what);
  // et elle ne revient pas à l'arrivée, quand le mouvement disparaît du jeu
  g.S.moves = [];
  assert.ok(g.missionDone(m), 'la carte revient dès que la flotte est posée');
});

t('une marque périmée ne bloque pas la flotte d\'aujourd\'hui', () => {
  // Le vécu : la carte avait été marquée faite quatorze heures plus tôt, sa
  // période de douze heures l'avait ramenée, et le rapatriement lancé le matin
  // ne l'éteignait plus — la case était prise par une marque morte.
  const g = nue();
  const m = g.dailyMissions().find(x => /^cargo-split/.test(x.id));
  g.S.daily.done[m.id] = SOIR - 14 * 3600e3;
  assert.ok(!g.missionDone(m), 'une marque de quatorze heures a expiré');
  g.S.moves = [{ mission: 4, ret: false, arrival: SOIR / 1000 + 3600, origin: '1:142:6', dest: m.dest }];
  assert.ok(g.missionDone(m), 'la flotte vole, la carte doit s\'éteindre à nouveau');
});

t('une flotte venue d\'ailleurs ne vaut pas un « Fait »', () => {
  // Les mouvements du jeu portent aussi ceux des autres joueurs : un transport
  // d'allié vers la colonie éteindrait une carte que personne n'a honorée.
  const g = nue();
  const m = g.dailyMissions().find(x => /^cargo-split/.test(x.id));
  g.S.moves = [{ mission: 4, ret: false, arrival: SOIR / 1000 + 3600, origin: '3:300:9', dest: m.dest }];
  assert.ok(!g.missionDone(m), 'la flotte ne part d\'aucune de mes planètes');
});

t('un Transporter vaut le Stationner demandé, une expédition ne vaut rien', () => {
  const g = nue();
  const m = g.dailyMissions().find(x => /^cargo-split/.test(x.id));
  g.S.moves = [{ mission: 3, ret: false, arrival: SOIR / 1000 + 3600, origin: '1:142:6', dest: m.dest }];
  assert.ok(g.missionDone(m), 'le joueur a livré la soute, le nom de la mission n\'y change rien');
  const g2 = nue();
  const n = g2.dailyMissions().find(x => x.id === 'night');
  g2.S.daily.done = {};
  assert.equal(n.mission, 15, 'la carte du soir doit partir en expédition pour que le garde-fou compte');
  g2.S.moves = [{ mission: 15, ret: false, arrival: SOIR / 1000 + 3600, origin: '1:142:6', dest: n.dest }];
  assert.ok(!g2.missionDone(n), 'une expédition ordinaire éteindrait la carte du soir tous les jours');
});

t('le donneur garde de quoi lever sa propre charge', () => {
  const g = nue();
  const m = g.dailyMissions().find(x => /^cargo-split/.test(x.id));
  const colo = g.S.planets[1];
  const reste = { lc: (colo.ships.lc || 0) - (m.ships.lc || 0), sc: (colo.ships.sc || 0) - (m.ships.sc || 0) };
  const souteReste = g.cargoCap({ ships: reste });
  const charge = colo.stock.m + colo.stock.c + colo.stock.d;
  assert.ok(souteReste >= charge, `la colonie garde ${souteReste} de soute pour lever ${charge}`);
});

t('la mise à l\'abri protège la planète qui PEUT partir, pas seulement la plus chargée', () => {
  // Avant, elle ne regardait que la plus chargée : sans vaisseau dessus, elle
  // rendait null et la carte du soir retombait sur un conseil général.
  const fs = nue().fleetsavePlan(SOIR);
  assert.ok(fs, 'aucun plan alors que la colonie a 40 grands transporteurs');
  assert.equal(fs.from.name, 'Colonie');
});

t('chaque planète chargée a sa carte, pas une ligne dans celle de la voisine', () => {
  /* Les autres lots vivaient dans le « Comment faire » de la carte de tête :
     « Puis depuis Colonie : 10 grands transporteurs… ». À relire à chaque
     envoi, sans lien préparé, sans « Fait » à cocher. */
  const g = nue(s => { s.planets[0].ships = { lc: 40, pr: 4 }; s.planets[1].ships = { lc: 10 }; });
  const fs = g.fleetsavePlan(SOIR);
  assert.ok(fs && fs.rest && fs.rest.length === 1, 'le second lot manque : ' + JSON.stringify(fs && (fs.rest || []).length));
  assert.equal(fs.from.name, 'Caribou', 'le plus gros lot protégeable passe en premier');
  const ms = g.dailyMissions();
  const tete = ms.find(x => x.id === 'night');
  const second = ms.find(x => x.id === 'night:' + fs.rest[0].from.id);
  assert.ok(second, 'le second lot n\'a pas sa carte : ' + ms.map(x => x.id).join(' '));
  assert.ok(/Colonie/.test(second.what), 'et elle nomme sa planète : ' + second.what);
  assert.equal(second.dest, fs.rest[0].dest);
  assert.match(g.missionGo(second) || '', /component=fleetdispatch/, 'avec son formulaire préparé');
  assert.ok(!tete.how.some(h => /Puis depuis/.test(h)), 'la carte de tête ne récite plus les autres : ' + JSON.stringify(tete.how));
  // « Dépense d'abord » ne vaut qu'une fois : c'est un geste, pas un par lot.
  assert.ok(tete.how.some(h => /Dépense d'abord/.test(h)) && !second.how.some(h => /Dépense d'abord/.test(h)),
    JSON.stringify(second.how));
});

t('un nom de planète ne peut pas injecter de balise dans les étapes', () => {
  // taskHtml pose les lignes de `how` telles quelles dans innerHTML, pour que
  // le <b> voulu rende ; un nom de planète vient de la page du jeu.
  const g = nue(s => { s.planets[0].name = '<img src=x onerror=alert(1)>'; });
  const m = g.dailyMissions().find(x => /^cargo-split/.test(x.id));
  const how = m.how.join(' ');
  assert.ok(!/<img/.test(how), 'la balise passe telle quelle : ' + how);
  assert.match(how, /&lt;img/, 'le nom est échappé : ' + how);
});

t('la même soute n\'est promise qu\'une fois, et la colonie sans donneur est nommée', () => {
  // Avant, chaque colonie voyait tout le surplus du donneur : cinq cartes
  // « Ramène 1 grand transporteur » pour un seul transporteur libre, et dès le
  // premier rapatriement lancé les autres cartes s'évanouissaient.
  const g = app(s => {
    relie(s);
    s.planets[0].name = 'Wesh';
    s.planets[0].ships = { lc: 4, pr: 4 };
    s.planets[0].stock = { m: 5e4, c: 2e4, d: 1e4, at: SOIR };
    s.planets[1].stock = { m: 3e5, c: 1e5, d: 5e4, at: SOIR };
    const deux = JSON.parse(JSON.stringify(s.planets[1]));
    Object.assign(deux, { id: 'colo2', name: 'Lala', coords: '1:142:4', gid: '33603' });
    s.planets.push(deux);
  });
  const cartes = g.dailyMissions().filter(x => /^cargo-split/.test(x.id));
  assert.equal(cartes.length, 1, 'la même soute est promise plusieurs fois : ' + JSON.stringify(cartes.map(x => x.what)));
  const nuit = g.dailyMissions().find(x => x.id === 'night');
  assert.ok(nuit.how.some(h => /plus rien à emprunter/.test(h) && /Lala/.test(h)),
    'la colonie sans donneur n\'est pas nommée : ' + JSON.stringify(nuit.how));
});

t('soute suffisante partout : aucune carte de répartition', () => {
  const g = app(s => { relie(s); s.planets[0].ships = { lc: 40 }; s.planets[1].ships = { lc: 10 }; });
  assert.deepEqual(g.cargoGaps(), []);
  assert.ok(!g.dailyMissions().some(x => /^cargo-split/.test(x.id)));
});

/* ---------- « Ramène… » : critique au bon moment ---------- */
/* Le vécu : à 13 h, quatre cartes « Ramène N grands transporteurs » en rouge,
   devant les constructions, pour un vol de 25 minutes et une nuit dans 10 h.
   Le niveau suit maintenant l'heure : Conseil jusqu'à rappel − (vol + 1 h),
   Critique ensuite. */
const AH = (h, mi) => new Date(2026, 10, 8, h, mi || 0, 0).getTime();
/** Caribou pleine, trois grands transporteurs (assez pour son kit, pas pour son
    stock) : la flotte cible ne la réclame pas, la carte « Ramène » reste. */
function ramene(now, mod) {
  return app(s => {
    relie(s);
    s.planets[0].name = 'Caribou';
    s.planets[0].ships = { pr: 4, lc: 3 };
    s.planets[0].stock = { m: 9e5, c: 4e5, d: 7e5, at: now };
    s.planets[1].ships = { lc: 40, sc: 10 };
    s.settings.secu = { rappel: '22:00' };
    s.settings.reeqSeuil = 1;
    if (mod) mod(s);
  }, now);
}
const carteRamene = g => g.dailyMissions().find(x => /^cargo-split/.test(x.id));
/** L'heure d'escalade attendue : rappel − vol − 1 h. */
function escaladeDe(g, m, rappel) {
  const fl = g.flight(g.S.planets[m.p].coords, m.dest, m.ships, 100);
  return { at: rappel - fl.secs * 1000 - 3600e3, secs: fl.secs };
}

t('« Ramène » en pleine journée : Conseil, avec son échéance', () => {
  const g = ramene(AH(13));
  const m = carteRamene(g);
  assert.ok(m, 'la carte doit rester visible : ' + g.dailyMissions().map(x => x.id).join(' '));
  assert.equal(m.sev, 'info', 'à 13 h, la carte n\'est pas critique');
  const e = escaladeDe(g, m, AH(22));
  const hh = d => { const x = new Date(d); return String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0'); };
  assert.match(m.sol, new RegExp('^À faire avant ' + hh(e.at) + ' \\(vol de \\d+m \\d+s, rappel à 22:00\\)$'), m.sol);
  // le contenu ne change pas : mêmes vaisseaux, Stationner
  assert.equal(m.mission, 4);
  assert.match(m.how[0], /Stationner/);
});

t('« Ramène » passe Critique à rappel − (vol + 1 h)', () => {
  const avant = ramene(AH(13)), m0 = carteRamene(avant), e = escaladeDe(avant, m0, AH(22));
  const juste = ramene(e.at - 60e3), apres = ramene(e.at + 5 * 60e3);
  assert.equal(carteRamene(juste).sev, 'info', 'une minute avant l\'escalade, encore Conseil');
  const m = carteRamene(apres);
  assert.equal(m.sev, 'bad', 'cinq minutes après, Critique');
  assert.ok(!m.sol, 'en Critique, plus d\'échéance à lire : ' + m.sol);
});

t('un vol long passe Critique plus tôt', () => {
  const loinC = s => { s.planets[1].coords = '1:330:6'; };
  const ref = ramene(AH(13), loinC), m0 = carteRamene(ref);
  assert.ok(m0, 'la carte existe pour un donneur lointain');
  const e = escaladeDe(ref, m0, AH(22));
  assert.ok(e.secs > 3 * 3600, 'le vol dure plus de 3 h : ' + e.secs);
  assert.ok(e.at < AH(18), 'l\'escalade tombe avant 18 h : ' + new Date(e.at));
  assert.equal(carteRamene(ramene(AH(18, 30), loinC)).sev, 'bad', 'à 18 h 30, Critique');
  assert.equal(carteRamene(ramene(AH(16), loinC)).sev, 'info', 'à 16 h, encore Conseil');
});

t('« Ramène » arrivant après le début de la nuit : niveau et texte inchangés', () => {
  const g = nue();  // 22 h 30, vol de près d'une heure : arrivée après 23 h
  const m = carteRamene(g);
  assert.equal(m.sev, 'warn');
  assert.match(m.how[1], /après le début de la nuit\. Pour cette nuit-là, dépense le stock sur place\./, m.how[1]);
  assert.ok(!m.sol, 'pas d\'échéance sur une carte trop tardive');
});

t('sans rappel réglé, l\'escalade se cale sur l\'heure d\'avant-nuit', () => {
  /* Le réglage a toujours une valeur (22:00 par défaut, un champ vidé est
     ignoré) : le repli ne joue que pour une valeur illisible. Coucher à 21 h :
     avant-nuit à 20 h. */
  const sans = s => { s.day.nightStart = 21; s.settings.secu = { rappel: '22:00' }; };
  const illisible = s => { sans(s); s.settings.secu = { rappel: 'n/a' }; };
  const ref = ramene(AH(13), illisible), m0 = carteRamene(ref);
  assert.ok(m0, 'la carte existe');
  assert.match(m0.sol, /rappel à 20:00/, m0.sol);
  const e = escaladeDe(ref, m0, AH(20));
  assert.equal(carteRamene(ramene(e.at - 60e3, illisible)).sev, 'info');
  assert.equal(carteRamene(ramene(e.at + 60e3, illisible)).sev, 'bad');
  // Un rappel réglé après le coucher (22 h pour 21 h) ne repousse pas
  // l'échéance dans la nuit : il est ramené au début de la nuit.
  assert.match(carteRamene(ramene(AH(13), sans)).sol, /rappel à 21:00/);
});

t('après l\'heure du rappel, c\'est le rappel de ce soir qui compte, pas celui de demain', () => {
  // 22 h 15 : le rappel de 22 h est passé, la nuit n'a pas commencé. Sous un
  // « prochain rappel » naïf, la carte retomberait en Conseil jusqu'à demain.
  // Coucher à 23 h 30 : le vol d'une heure arrive encore avant la nuit.
  const g = ramene(AH(22, 15), s => { s.day.nightStart = 23.5; });
  const m = carteRamene(g);
  assert.ok(m, 'la carte existe : ' + g.dailyMissions().map(x => x.id).join(' '));
  assert.equal(m.sev, 'bad', 'la carte doit rester critique : ' + m.sev);
});

/* ---------- une planète, une identité ---------- */

t('un état en rangs se convertit au chargement, et la conversion rejouée ne change rien', () => {
  const g = app(s => {
    s.timers = [{ id: 'm1', manual: true, kind: 'b', k: 'metal', lvl: 15, p: 1, end: SOIR + 36e5 }];
    s.plan = [{ type: 'b', p: 1, k: 'crystal', lvl: 13 }];
    s.colo.from = 1;
  });
  const colonie = g.S.planets[1];
  assert.equal(g.S.timers[0].pid, colonie.id);
  assert.equal(g.S.colo.fromId, colonie.id);
  assert.ok(!('p' in g.S.timers[0]), 'le rang ne traîne pas à côté de l\'identité');
  // La liste d'objectifs a disparu : ce qu'elle a laissé derrière elle aussi.
  assert.ok(!('plan' in g.S), 'rien ne reste de l\'ancienne liste');
  assert.equal(g.S.v, 2);
  const avant = JSON.stringify(g.S);
  g.migratePlanetIds();
  assert.equal(JSON.stringify(g.S), avant);
});

t('un relevé qui réordonne les planètes laisse le minuteur sur la bonne', () => {
  const g = app(s => {
    s.planets[0].gid = '33001'; s.planets[1].gid = '33002';
    s.timers = [{ id: 'm1', manual: true, kind: 'b', k: 'metal', lvl: 15, p: 1, end: SOIR + 36e5 }];
  });
  g.applyGame({ order: ['33002', '33001'],
    planets: { 33001: { coords: '1:142:8' }, 33002: { coords: '1:142:6' } },
    timers: [], moves: [] });
  assert.equal(g.S.planets[0].name, 'Colonie', 'le jeu dicte l\'ordre');
  assert.equal(g.planetById(g.S.timers[0].pid).name, 'Colonie');
});

t('une planète retirée emporte ce qui la visait, et rien d\'autre', () => {
  const g = app(s => {
    s.timers = [{ id: 'm1', manual: true, kind: 'b', k: 'metal', lvl: 15, p: 1, end: SOIR + 36e5 },
                { id: 'm2', manual: true, kind: 't', k: 'astro', lvl: 4, end: SOIR + 36e5 }];
    s.colo.from = 1;
  });
  g.forgetPlanet(g.S.planets[1].id);
  assert.deepEqual(g.S.planets.map(p => p.name), ['Planète mère']);
  // une recherche ne vise pas de planète : elle reste
  assert.deepEqual(g.S.timers.map(t => t.id), ['m2']);
  assert.equal(g.S.colo.fromId, null);
});

t('un id qui ne répond plus : le minuteur sonne, rien ne se crédite', () => {
  const g = app();
  const p = g.S.planets[0];
  const niveau = p.b.metal;
  g.finishTimer({ kind: 'b', pid: 'disparue', k: 'metal', lvl: niveau + 9, end: SOIR });
  assert.equal(p.b.metal, niveau, 'aucun niveau posé sur une voisine');
  g.finishTimer({ kind: 'x', k: 'sats', pid: 'disparue', n: 7, end: SOIR });
  assert.equal(p.sats, 0, 'aucun satellite non plus');
});

/* ---------- mode nuit ---------- */

/** Le soir, flotte au sol et colonie assez loin : le plan a de quoi parler. */
const dodo = s => { loin(s); s.planets[0].ships = { lc: 30, sc: 6 }; };

t('mode nuit : seules les cartes de protection restent', () => {
  const g = app(s => { dodo(s); s.day.night = true; });
  const ms = g.dailyMissions();
  assert.ok(ms.length, 'il reste des cartes');
  assert.deepEqual([...new Set(ms.map(m => m.q))], ['Sécurité'], ms.map(m => m.q).join(' · '));
  assert.ok(ms.some(m => m.id === 'night'), 'la mise à l\'abri est proposée');
});

t('mode jour : le plan garde ses autres rubriques', () => {
  const g = app(dodo);
  assert.ok(g.dailyMissions().some(m => m.q !== 'Sécurité'), 'tout ne se réduit pas à la sécurité');
});

t('mode nuit : la carte de mise à l\'abri est dans les cartes du moment', () => {
  /* `at` portait l'heure du rappel d'avant-coucher. En pleine nuit elle vise le
     soir SUIVANT, et le rendu rangeait la carte dans une connexion à venir —
     que le mode nuit n'affiche pas. Le joueur réveillé à 3 h n'avait plus rien. */
  const troisH = new Date(2026, 10, 9, 3, 0, 0).getTime();
  for (const [quand, h] of [['3 h', troisH], ['22 h 30', SOIR]]) {
    const g = app(s => { dodo(s); s.day.night = true; }, h);
    const n = g.dailyMissions().find(m => m.id === 'night');
    g.REFRESH.today();
    assert.ok(lu(g.html().tdNow || '').includes(n.what), `à ${quand} : ${n.what}`);
    // « Avant la nuit (23 h) » à trois heures du matin ne nomme pas l'instant.
    assert.ok(!(h === troisH && /Avant la nuit/.test(n.what)), n.what);
  }
});

t('mode nuit en pleine nuit : la mise à l\'abri sort quand même', () => {
  const troisH = new Date(2026, 10, 9, 3, 0, 0).getTime();
  const avec = app(s => { dodo(s); s.day.night = true; }, troisH);
  const sans = app(dodo, troisH);
  assert.ok(avec.dailyMissions().some(m => m.id === 'night'), 'le mode nuit la réclame');
  assert.ok(!sans.dailyMissions().some(m => m.id === 'night'), 'le mode jour ne la propose pas à 3 h');
});

/* ---------- une carte ne sort que si la place existe ---------- */

t('emplacements de flotte pleins : aucun rapatriement proposé', () => {
  // Le copilote connaît les flottes en vol : proposer un envoi de plus, c'est
  // envoyer le joueur sur « Nombre maximal de flottes atteint ».
  const plein = app(s => { flotteAuHub(s); s.syncAt = JOUR; s.slots = { fleet: [9, 9], at: JOUR }; }, JOUR);
  assert.ok(!transfert(plein), 'sans emplacement libre, rien à lancer');
  const libre = app(s => { flotteAuHub(s); s.syncAt = JOUR; s.slots = { fleet: [2, 9], at: JOUR }; }, JOUR);
  assert.ok(transfert(libre), 'avec de la place, le rapatriement revient');
});

t('le dernier emplacement revient à l\'expédition, pas au rapatriement', () => {
  const g = app(s => { flotteDExpedition(s); s.planets[1].stock = { m: 60000, c: 40000, d: 5000, at: JOUR };
    s.slots = { fleet: [8, 9], expo: [0, 3], at: JOUR }; }, JOUR);
  const s0 = g.simulateDay().sessions[0];
  assert.equal(s0.acts.filter(a => a.kind === 'expo').length, 1, 'l\'expédition part');
  assert.ok(!s0.acts.some(a => a.kind === 'transfer'), 'le rapatriement lui laisse la place');
});

t('une flotte lancée depuis la lecture occupe son emplacement', () => {
  // Le chiffre « Flottes 7/8 » date de la dernière page de flotte ouverte ;
  // depuis, le joueur a cliqué Lancé. Le copilote le sait : c'est son minuteur.
  const g = app(s => {
    s.me = 'moi';
    s.syncAt = SOIR;
    s.slots = { fleet: [7, 8], at: SOIR - 3600e3 };
    s.timers = [{ id: 'f1', manual: true, kind: 'x', k: 'fleet', at: SOIR - 1800e3, end: SOIR + 3600e3, done: false }];
  }, SOIR, INACTIFS);
  assert.ok(!espionnage(g), 'le huitième emplacement est pris');
  assert.ok(espionnage(avecSlots(7, 8)), 'sans cette flotte, une cible reste proposée');
});

/** Une case de recherche de forme de vie (centaine paire). */
const CASE_LFR = 11201;

t('recherche de forme de vie en cours : pas de carte des artefacts', () => {
  // Choisir la technologie d'un slot, c'est lancer la recherche qui va avec.
  const enCours = app(s => {
    s.artefacts = 461;
    s.planets[0].lf = { [CASE_LFR]: { lvl: 3, state: 'ok' } };
    s.timers = [{ id: 'l1', game: true, kind: 'x', k: 'other', queue: 'lfresearch', pid: 'mere', end: SOIR + 3600e3, done: false }];
  });
  assert.ok(!enCours.dailyMissions().some(m => m.id === 'artefacts'),
    'la file de recherche de forme de vie est occupée');
  const libre = app(s => { s.artefacts = 461; s.planets[0].lf = { [CASE_LFR]: { lvl: 3, state: 'ok' } }; });
  assert.ok(libre.dailyMissions().some(m => m.id === 'artefacts'),
    'file libre : la carte sort');
});

t('aucune case de recherche lue : la carte des artefacts sort quand même', () => {
  const g = app(s => { s.artefacts = 461; });
  assert.ok(g.dailyMissions().some(m => m.id === 'artefacts'),
    'rien de lu, rien à déduire : on ne cache pas');
});

t('« Fait » tient une semaine sur la carte des artefacts', () => {
  /* Le copilote ne sait pas lire quels slots de palier sont déjà choisis : la
     carte ne peut que proposer, et la reproposer chaque matin est du bruit.
     Marquée faite hier, elle revenait pourtant — la journée civile bornait
     toutes les cartes de 24 h et plus. */
  const hier = SOIR - 23 * 3600e3; // la veille au soir : même durée, autre jour civil
  const g = app(s => { s.artefacts = 461; s.daily.done = { artefacts: hier }; });
  const m = g.dailyMissions().find(x => x.id === 'artefacts');
  assert.equal(m.every, 24 * 7);
  assert.ok(g.missionDone(m), 'faite hier : elle ne revient pas ce matin');
  // la carte quotidienne, elle, garde sa journée civile
  const q = { id: 'autre', every: 24 };
  g.S.daily.done.autre = hier;
  assert.ok(!g.missionDone(q), 'une carte du jour repart au jour suivant');
});

/* ---------- un lot sorti du chantier fait taire le chantier ---------- */
/* Le jeu nomme ce que son chantier construit, jamais combien, et sa file
   n'annonce que le lot en cours. Le copilote reproposait donc ce qui était
   déjà en construction — et la carte disparaissait au clic, quand la page
   relue lui apprenait la vérité. */

/** La planète mère, défense lue, reliée au jeu sous le gid 101. */
const chantierPret = s => {
  s.planets[0].gid = '101'; s.planets[1].gid = '102';
  s.planets[0].def = 500; s.planets[0].defs = { rl: 500 };
};
/** Le jeu publie un lot en chantier sur la planète mère. */
const publieLot = (g, techId, finSecs, planetes) => g.applyGame({
  meta: { host: 's1.ogame.gameforge.com' },
  planets: planetes || { '101': {}, '102': {} },
  timers: [{ end: Math.round(JOUR / 1000) + finSecs, techId, type: 'shipyard',
    label: 'Lot', planetId: '101' }],
  moves: [], at: JOUR
});
/** Les cartes de chantier de la planète mère, sur toute la journée. */
const cartesChantier = plan => plan.sessions.flatMap(x => x.acts)
  .filter(a => a.p === 0 && ['sats', 'shipbuild', 'def'].includes(a.kind));

t('un lot en chantier fait taire vaisseaux, défense et satellites', () => {
  const avant = app(chantierPret, JOUR);
  assert.ok(cartesChantier(avant.simulateDay()).length > 0,
    'sans lot, le chantier a bien quelque chose à proposer');
  const g = app(chantierPret, JOUR);
  publieLot(g, '203', 1200);                      // grands transporteurs
  assert.deepEqual(cartesChantier(g.simulateDay()).map(a => a.what), [],
    'le nombre construit est inconnu : on ne propose rien plutôt que de doubler');
});

t('le lot en cours reste affiché comme en cours', () => {
  const g = app(chantierPret, JOUR);
  publieLot(g, '203', 1200);
  assert.ok(g.simulateDay().busy.some(b => /Chantier spatial/.test(b.q)),
    'se taire n\'est pas cacher : la file occupée se voit');
});

t('la page du chantier relue rend la parole', () => {
  const g = app(chantierPret, JOUR);
  publieLot(g, '203', 1200);
  // la page Chantier rouverte après la fin du lot : le compte au sol est le vrai
  g.applyGame({ planets: { '101': { ships: { lc: 12 }, shipsAt: JOUR + 1300e3 }, '102': {} },
    timers: [], moves: [], at: JOUR + 1300e3 });
  assert.ok(cartesChantier(g.simulateDay()).length > 0, 'le chantier reparle');
  assert.ok(!g.dailyMissions().some(m => m.id === 'chantierlu'), 'et la carte de lecture s\'efface');
});

t('un lot de défense ne se juge pas sur la lecture de la flotte', () => {
  const g = app(chantierPret, JOUR);
  publieLot(g, '401', 1200);                      // lanceurs de missiles
  // La flotte relue ne dit rien de la défense : deux pages, deux comptes.
  g.applyGame({ planets: { '101': { ships: { lc: 12 }, shipsAt: JOUR + 1300e3 }, '102': {} },
    timers: [], moves: [], at: JOUR + 1300e3 });
  assert.deepEqual(cartesChantier(g.simulateDay()).map(a => a.what), [],
    'la page Défense n\'a pas été relue depuis le lot');
});

t('un lot que le jeu ne nomme pas rend les deux comptes douteux', () => {
  const g = app(chantierPret, JOUR);
  publieLot(g, null, 1200);
  assert.deepEqual(cartesChantier(g.simulateDay()).map(a => a.what), [],
    'sans identifiant, le lot peut être vaisseau comme défense');
});

t('une planète dont aucun lot n\'a été vu reste bavarde', () => {
  const g = app(chantierPret, JOUR);
  g.applyGame({ planets: { '101': {}, '102': {} }, timers: [], moves: [], at: JOUR });
  assert.ok(cartesChantier(g.simulateDay()).length > 0,
    'un compte vieux n\'est pas un compte faux : on ne se tait pas sans raison');
});

t('la carte de lecture dit quelle page ouvrir, et laquelle', () => {
  /* Le lot est sorti il y a vingt minutes : c'est à ce moment-là, et pas
     avant, qu'aller relire la page apprend quelque chose. */
  const g = app(chantierPret, JOUR);
  publieLot(g, '203', -1200);
  const m = g.dailyMissions().find(x => x.id === 'chantierlu');
  assert.ok(m, 'une carte réclame la lecture');
  assert.ok(/Planète mère/.test(m.what), 'elle nomme la planète : ' + m.what);
  assert.ok(/shipyard/.test(g.missionGo(m)), 'et mène au chantier spatial');
});

t('des satellites annoncés par le jeu évitent une centrale de plus', () => {
  const g = app(chantierPret, JOUR);
  publieLot(g, '212', 1800);                      // satellites solaires
  const s0 = g.simulateDay().sessions[0].acts;
  assert.ok(!s0.some(a => a.kind === 'b' && a.k === 'solar'),
    'l\'énergie arrive par le chantier : pas de centrale en double');
});

/* ---------- les heures du panneau : test/temps.test.js ---------- */
require('./temps.test')({ t, assert, loadApp, fixtureState, SOIR });

/* ---------- les heures du jeu ---------- */

/* 1794988642 = mercredi 18 novembre 2026, 07 h 57 min 22 s UTC.
   Le serveur l'écrit 08:57:22 : il est à UTC+1. Le joueur est à UTC-10. */
const HEURES = {
  epoch: 1794988642, horloge: '18.11.2026 08:57:22',
  arrivees: [{ epoch: 1794988647, txt: '08:57:27' }]
};

t('une heure du jeu se relit à la montre du joueur', () => {
  const r = runPage({ skin: null, heures: HEURES, heuresMode: 'local' });
  assert.equal(r.heures[0].txt, '21:57:27', 'onze heures de moins, la veille');
  assert.equal(r.heures[0].titre, 'heure du serveur : 08:57:27', 'et le serveur à portée de souris');
  assert.ok(/copilote-heure/.test(r.heures[0].cls), 'marquée comme traduite');
});

t('un joueur à l\'heure du serveur ne voit rien changer', () => {
  // Même instant, mais une horloge qui affiche déjà l'heure de Tahiti.
  const r = runPage({ skin: null, heures: { ...HEURES, horloge: '17.11.2026 21:57:22' } });
  assert.equal(r.heures[0].txt, '08:57:27', 'le texte du jeu reste le sien');
  assert.equal(r.heures[0].cls, 'arrivalTime', 'et rien ne le marque');
});

t('la date d\'un message se relit à la montre du joueur', () => {
  // 23.11.2026 08:20:27 au serveur (UTC+1) : 22.11.2026 21:20:27 à Tahiti.
  const r = runPage({ skin: null, heures: { ...HEURES, messages: ['23.11.2026 08:20:27'] }, heuresMode: 'local' });
  assert.equal(r.dates[0].txt, '22.11.2026 21:20:27', 'onze heures de moins, la veille');
  assert.equal(r.dates[0].titre, 'heure du serveur : 23.11.2026 08:20:27', 'et le serveur à portée de souris');
  assert.ok(/copilote-heure/.test(r.dates[0].cls), 'marquée comme traduite');
});

t('l\'horloge du jeu garde l\'heure du serveur', () => {
  const r = runPage({ skin: null, heures: { ...HEURES, messages: ['23.11.2026 08:20:27'] } });
  assert.equal(r.horloge, HEURES.horloge, 'le repère en heure serveur ne bouge pas');
});

t('une date déjà traduite ne se décale pas à chaque passage', () => {
  /* Le script repeint plusieurs fois une même page : sans la marque, la date
     reculerait d'onze heures de plus à chaque fois. */
  const r = runPage({ skin: null, heures: { ...HEURES, messages: ['23.11.2026 08:20:27'] }, heuresMode: 'local' });
  r.secousse();
  r.secousse();
  assert.equal(r.read().dates[0].txt, '22.11.2026 21:20:27', 'traduite une fois, pas trois');
});

t('en heure serveur, le jeu garde ses heures et donne la locale au survol', () => {
  // le mode par défaut, celui du premier lancement
  const r = runPage({ skin: null, heures: { ...HEURES, messages: ['23.11.2026 08:20:27'] } });
  assert.equal(r.heures[0].txt, '08:57:27', 'l\'arrivée reste à l\'heure du serveur');
  assert.equal(r.heures[0].titre, 'heure locale : 21:57:27');
  assert.equal(r.dates[0].txt, '23.11.2026 08:20:27', 'le message aussi');
  assert.equal(r.dates[0].titre, 'heure locale : 22.11.2026 21:20:27');
});

t('l\'interrupteur du panneau bascule les heures du jeu sans recharger', () => {
  const r = runPage({ skin: null, heures: { ...HEURES, messages: ['23.11.2026 08:20:27'] } });
  r.majMode('local');
  assert.equal(r.read().dates[0].txt, '22.11.2026 21:20:27', 'passée à l\'heure du joueur');
  assert.equal(r.read().heures[0].txt, '21:57:27');
  r.majMode('server');
  r.secousse();
  assert.equal(r.read().dates[0].txt, '23.11.2026 08:20:27', 'revenue au serveur, sans dériver');
  assert.equal(r.read().heures[0].txt, '08:57:27');
});

t('un texte qui n\'est pas l\'heure de cet instant n\'est pas touché', () => {
  /* Le garde-fou : la cellule dit autre chose que ce que le serveur dirait
     de cet instant — une durée, un reste de compte à rebours. On passe. */
  const r = runPage({ skin: null, heures: { ...HEURES, arrivees: [{ epoch: 1794988647, txt: '12:34:56' }] } });
  assert.equal(r.heures[0].txt, '12:34:56');
  assert.equal(r.heures[0].titre, '', 'aucune infobulle posée');
});

t('sans horloge lisible, aucune heure ne bouge', () => {
  const r = runPage({ skin: null, heures: { ...HEURES, horloge: 'temps du serveur' } });
  assert.equal(r.heures[0].txt, '08:57:27');
});

/** Une priorité de labo 10 sur la mère, qui est au labo 5 et n'a aucune raison
    de monter son labo aujourd'hui. */
const prioLabo = s => { s.prio = [{kind:'b', pid:'mere', k:'lab', lvl:10}]; };
/** Les trois prérequis de Plasma, pour que le pas lançable soit Plasma lui-même
    et non un prérequis : `resolveTech` rend le premier niveau qui manque. */
const prePlasma = s => { s.tech.energy = 8; s.tech.laser = 10; s.tech.ion = 5; };
const POSE = (k, lvl, hors) => s => { s.ui.pose = {k, lvl, hors: hors || {}}; };

require('./plan.test')({ t, assert, app, lu, SOIR, prioLabo, prePlasma, POSE });

/* ---------- une carte en attente dit ce qui la retient ---------- */

/* Le Labo 6 de la mère est la priorité : son objectif épargne sur la mère, qui
   porte aussi le labo. Énergie 4 (6,4 k de cristal, 3,2 k de deutérium) est
   payable avec le stock de la fixture seul, mais pas au-delà de la réserve :
   la recherche attend à cause de la priorité, et de rien d'autre. */
t('la recherche retenue par une priorité le dit', () => {
  const w = app(prioLabo).simulateDay().sessions[0].waits.find(x => x.kind === 't');
  assert.ok(w, 'la recherche attend');
  assert.ok(w.held, 'elle est retenue');
  assert.equal(w.heldBy, 'Labo 6');
});

t('sans priorité, la même recherche part au lieu d\'attendre', () => {
  // garde de la fixture : c'est bien la réserve de la priorité qui la retenait
  const s0 = app().simulateDay().sessions[0];
  assert.ok(s0.acts.some(a => a.kind === 't' && a.k === 'energy'), 'Énergie 4 part');
  assert.ok(!s0.waits.some(x => x.kind === 't'));
});

t('une recherche qui attend le stock, sans réserve, ne nomme personne', () => {
  const w = app(s => { s.planets[0].stock = {m:0, c:0, d:0, at:SOIR}; })
    .simulateDay().sessions[0].waits.find(x => x.kind === 't');
  assert.ok(w, 'la recherche attend');
  assert.equal(w.heldBy, '');
  assert.ok(!w.held);
});

t('la recherche qui épargne pour elle-même ne se dit pas retenue par elle-même', () => {
  // Plasma 5 (64 k de cristal pour 60 k) pose son propre objectif sur la mère
  const s0 = app(s => { s.prio = [{kind:'t', k:'plasma', lvl:5}];
    prePlasma(s); s.tech.plasma = 4; }).simulateDay().sessions[0];
  assert.deepEqual(s0.goals.map(g => g.key), ['t:plasma5'], 'l\'objectif est posé');
  const w = s0.waits.find(x => x.kind === 't');
  assert.ok(w, 'la recherche attend');
  assert.equal(w.heldBy, '');
});

t('une recherche non critique, qui n\'épargne qu\'après quatre heures, ne se nomme pas elle-même', () => {
  /* Stock vide : Énergie 4 n'est pas critique, son objectif naît pour la
     première fois en phase « post » de la session où l'attente atteint quatre
     heures — `mine` est alors encore vide. Le vaisseau de colonisation retient
     aussi la mère : lui seul doit être nommé. */
  const p = app(s => { s.planets[0].stock = {m:0, c:0, d:0, at:SOIR}; }).simulateDay();
  const i = p.sessions.findIndex(x => x.goals.some(g => g.label === 'Technologie Énergie 4'));
  assert.ok(i > 0, 'l\'objectif naît après la première session');
  const w = p.sessions[i].waits.find(x => x.kind === 't');
  assert.ok(w && w.heldBy, 'la recherche est retenue par autre chose');
  assert.ok(!/Énergie 4/.test(w.heldBy), w.heldBy);
});

t('le bâtiment retenu par la réserve d\'une priorité nomme laquelle', () => {
  // Mine de cristal 13 est retenue par la réserve du Labo 7. Sans numéro de
  // session : le rang dépend de la vitesse de la journée, pas de la retenue.
  const w = app(prioLabo).simulateDay().sessions
    .flatMap(x => x.waits).find(x => x.kind === 'b' && x.k === 'crystal');
  assert.ok(w && w.held, 'la mine est retenue');
  assert.equal(w.heldBy, 'Labo 7');
});

t('la carte en attente écrit ce que la priorité retient', () => {
  const g = app(prioLabo);
  g.REFRESH.today();
  assert.match(g.html().tdNow, /Retenu : tu épargnes pour Labo 6\./);
});

t('sans retenue, la carte n\'écrit pas « Retenu »', () => {
  const g = app(s => { s.planets[0].stock = {m:0, c:0, d:0, at:SOIR}; });
  g.REFRESH.today();
  assert.ok(/class="wait"/.test(g.html().tdNow), 'des cartes attendent');
  assert.ok(!/Retenu/.test(g.html().tdNow));
});

/* ---------- le joueur pose et retire ---------- */
const prio2 = s => { s.prio = [
  {kind:'b', pid:'mere', k:'lab', lvl:10},
  {kind:'b', pid:'mere', k:'metal', lvl:20}]; };

t('la grille des niveaux porte un champ de niveau visé', () => {
  assert.match(app().VIEWS.planets(), /data-prio="lab"/);
});

t('la table des recherches porte un champ de niveau visé', () => {
  assert.match(app().VIEWS.research(), /data-prio="plasma"/);
});

t('la colonne « Visé » reste atteignable dans un volet étroit', () => {
  /* Mesuré dans le navigateur à 380 px : le nom de technologie sur une seule
     ligne prenait 231 px et repoussait la colonne au-delà du bord visible — la
     seule commande qui pose une priorité de recherche était injoignable. Le
     repli du nom tient aux deux bouts : la table le demande par sa classe, la
     feuille de style le donne. */
  assert.match(app().VIEWS.research(), /<table class="tech">/);
  const css = require('fs').readFileSync(require('path').join(__dirname, '..', 'panel.css'), 'utf8');
  assert.match(css, /table\.tech td:first-child[^}]*white-space:normal[^}]*max-width/);
});

t('le champ affiche le niveau visé par la priorité posée, et seulement celui-là', () => {
  const h = app(prioLabo).VIEWS.planets();
  assert.match(h, /data-prio="lab"[^>]*value="10"/);
  assert.match(h, /data-prio="metal"[^>]*value=""/);
});

t('une priorité de la mère n\'emplit pas le champ de la colonie', () => {
  /* Même bâtiment sur deux planètes : seul le champ de la planète visée porte
     la valeur, et l'attribut data-pid dit à quelle planète il répond. */
  const h = app(prioLabo).VIEWS.planets();
  assert.equal((h.match(/data-prio="lab"[^>]*value="10"/g) || []).length, 1);
  assert.match(h, /data-pid="mere" data-prio="lab"/);
});

t('le bloc nomme la planète, la cible et celle qui attend son tour', () => {
  const h = app(prio2).prioHtml();
  assert.match(h, /Planète mère/);
  assert.match(h, /Labo 10/);
  assert.match(h, /attend son tour/);
  // Le bouton porte l'espèce et l'identité de sa ligne, plus un rang.
  assert.match(h, /data-prio-del="b\|mere\|lab"/);
  assert.match(h, /data-prio-del="b\|mere\|metal"/);
});

t('une seule attend son tour : celle qui agit dit ce que le plan en fait', () => {
  const h = app(prio2).prioHtml();
  assert.equal((h.match(/attend son tour/g) || []).length, 1);
  assert.match(h.split('</li>')[0], /Elle épargne pour Labo 6/,
    'la première dit l\'épargne que le plan a ouverte : ' + h);
});

t('une priorité que rien ne sert ne s\'annonce pas en tête', () => {
  /* L'état venait du rang dans la liste : la première de chaque planète
     annonçait qu'elle passait en premier, même quand le plan ne faisait rien
     pour elle. C'est l'anti-objectif retourné — plus le silence, mais le
     contraire du vrai. Ici le labo manque pour la recherche posée. */
  const h = app(s => { s.prio = [{kind:'t', k:'shielding', lvl:1}]; }).prioHtml();
  assert.match(h, /Laboratoire de recherche 6 manque/, h);
  assert.doesNotMatch(h, /épargne|passe en premier/i, h);
});

t('une priorité de recherche dont le labo manque le dit sur une carte', () => {
  /* `resolveTech` sait que le labo manque, la priorité n'entre alors dans
     aucune liste, et le `continue` était muet : la seule carte du jour était
     le laboratoire, que rien ne reliait à ce que le joueur avait posé. */
  const g = app(s => { s.prio = [{kind:'t', k:'shielding', lvl:1}]; });
  const w = g.simulateDay().sessions[0].waits.find(x => x.kind === 't' && x.k === 'shielding');
  assert.ok(w, 'la priorité a sa ligne d\'attente');
  assert.match(w.why, /Bouclier 1 en priorité/, w.why);
  assert.match(w.why, /Laboratoire de recherche 6 manque/, w.why);
  g.REFRESH.today();
  assert.match(g.html().tdNow, /Laboratoire de recherche 6 manque/, 'et la carte l\'écrit');
});

t('la carte d\'une priorité de recherche qui épargne dit qu\'elle en est une', () => {
  /* Sans le pourquoi sur la ligne d'attente, la seule phrase de la journée au
     sujet d'une priorité de recherche était l'heure à laquelle les ressources
     seraient réunies. */
  const g = app(s => { s.prio = [{kind:'t', k:'astro', lvl:5}]; });
  const w = g.simulateDay().sessions[0].waits.find(x => x.kind === 't');
  assert.ok(w, 'la recherche attend');
  assert.match(w.why || '', /priorité/i, 'vu : ' + w.why);
  g.REFRESH.today();
  assert.match(g.html().tdNow, /en priorité/, 'et la carte l\'écrit');
});

t('le vaisseau de colonisation repoussé par une priorité dit ce qui le retient', () => {
  /* C'est la carte que la priorité écarte le plus souvent : sans `heldBy`, le
     chantier était repoussé toute la journée sans un mot. */
  const g = app(s => { s.prio = [{kind:'t', k:'plasma', lvl:5}];
    prePlasma(s); s.tech.plasma = 4;
    s.planets[0].stock = {m:20000, c:40000, d:5000, at:SOIR}; });
  const w = g.simulateDay().sessions[0].waits.find(x => x.kind === 'ship');
  assert.ok(w, 'le vaisseau attend');
  assert.ok(w.held, 'et il est retenu');
  assert.match(w.heldBy, /Plasma 5/, 'par la priorité : ' + w.heldBy);
});

t('render() compacte les priorités avant de dessiner', () => {
  /* Une priorité atteinte doit quitter le stockage, et `prios()` n'écrit rien :
     c'est `prioClean()`, appelé au rendu, qui le fait. Rien ne le tenait. */
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(src, /function render\(\)\{\s*prioClean\(\);/);
});

t('sans aucune priorité, le bloc dit quand même où en poser une', () => {
  // Les deux champs vivent dans des volets repliés : un bloc vide était la
  // seule trace visible de la fonctionnalité, et il n'existait pas.
  const h = app().prioHtml();
  assert.ok(h, 'le bloc est rendu');
  assert.match(h, /Tes priorités/);
  assert.match(h, /Empire/, 'il nomme l\'onglet où aller');
  assert.match(h, /déplie/, 'il dit qu\'il faut déplier');
  assert.ok(!/data-prio-del/.test(h), 'et il ne propose rien à retirer');
});

t('les deux volets annoncent qu\'ils portent le niveau visé', () => {
  const g = app();
  assert.match(g.VIEWS.planets(), /Bâtiments et niveaux visés/);
  assert.match(g.VIEWS.research(), /Recherches et niveaux visés/);
});

const CSS = () => require('fs').readFileSync(require('path').join(__dirname, '..', 'panel.css'), 'utf8');

t('la case du centre tient sur une ligne, hors du gabarit des champs', () => {
  /* label.f empile un titre au-dessus d'un champ : la case y partait seule sur
     sa ligne, étirée par input{width:100%}, et son libellé tombait dessous. */
  const h = app().VIEWS.planets();
  assert.match(h, /<label class="f coche"><input id="pcentre-/);
  assert.doesNotMatch(h, /style="width:auto"><input id="pcentre-/);
  const css = CSS();
  assert.match(css, /label\.f\.coche\{[^}]*flex-direction:row/, 'la case et son libellé côte à côte');
  assert.match(css, /label\.f\.coche input\{[^}]*width:auto/, 'et la case à sa taille');
  /* La pastille de vocation et sa raison ne sont plus enfants de .row : sans
     règle propre, l'espacement de la rangée ne les atteint plus et la raison
     vient se coller à la pastille. */
  assert.match(h, /<span class="voc" id="pvoc-/);
  assert.match(css, /\.voc\{[^}]*gap:var\(--sp-2\)/, 'la raison garde ses distances');
});

t('le volet des niveaux se donne pour ce qu\'il est : un réglage qu\'on ouvre', () => {
  /* Sans classe il ne touchait aucune règle : triangle du navigateur et douze
     pixels de gris, rien qui dise qu\'on règle quelque chose derrière. */
  const h = app().VIEWS.planets();
  assert.match(h, /<details class="volet"><summary data-fold="niv:mere">/);
  /* Un render() le refermait sous les doigts du joueur : il retient son état,
     comme les volets d'Aujourd'hui. */
  const ouvert = app(s2 => { s2.ui.fold = { 'niv:mere': true }; }).VIEWS.planets();
  assert.match(ouvert, /<details class="volet" open><summary data-fold="niv:mere">/);
  const css = CSS();
  /* ENH-54 : un seul indicateur pour tous les volets, cartes comprises —
     « + » fermé, « – » ouvert — plutôt que « Ouvrir + » ici et « + » ailleurs.
     Le volet garde son cadre, qui dit qu'on règle quelque chose dedans. */
  assert.match(css, /details:not\(\.defpick\)>summary\{[^}]*cursor:pointer/);
  assert.match(css, /details:not\(\.defpick\)>summary::after\{content:"\+"/, 'il dit qu\'il s\'ouvre');
  assert.match(css, /details:not\(\.defpick\)\[open\]>summary::after\{content:"–"/, 'et qu\'il se ferme');
  assert.match(css, /details\.volet>summary[^{]*\{[^}]*border:1px solid/, 'et il reste encadré');
});

t('le compteur du niveau visé part du niveau en place, pas de 1', () => {
  /* Partir de 1 obligeait à retaper le niveau entier, et proposait d'abord des
     niveaux déjà atteints — que prioPose jette aussitôt. */
  const g = app(s2 => { s2.planets[0].b.lab = 5; s2.tech.plasma = 7;
    s2.planets[0].lf = { 11101: { lvl: 3, state: 'ok' } }; });
  const h = g.VIEWS.planets();
  assert.match(h, /min="6" data-pid="mere" data-prio="lab"/, 'un bâtiment');
  assert.match(h, /min="4" data-pid="mere" data-prio="11101" data-kind="lf"/, 'une forme de vie');
  assert.match(g.VIEWS.research(), /min="8" data-prio="plasma"/, 'une recherche');
});

/* Le stock a maintenant son propre volet : son nom est le titre de ce volet,
   donc visible même fermé, et ses trois valeurs l'accompagnent. C'est plus que
   ce que le libellé en gras donnait, qui ne se voyait qu'une fois ouvert. */
t('le stock dit son nom dans le titre de son volet, et son sens juste au-dessus de sa grille', () => {
  const h = app().VIEWS.planets();
  assert.match(h, /<summary data-fold="stock:[^"]*">Stock /);
  assert.match(h, /Ce que cette planète a en magasin/);
  assert.doesNotMatch(h, /stock et niveaux visés/, 'le titre des bâtiments ne le porte toujours pas');
});

t('l\'écho de notre propre écriture ne redessine pas la vue', () => {
  /* syncApply compare au JSON, qui dépend de l'ordre des clés : reconstruite
     dans un autre ordre, notre propre priorité revenait méconnaissable du
     stockage partagé, et render() refermait le volet toutes les dix secondes. */
  const g = app(s2 => { s2.planets[0].gid = '33701';
    s2.prio = [{ kind: 'b', pid: 'mere', k: 'lab', lvl: 10 }]; });
  const avant = JSON.stringify(g.S.prio);
  g.syncApply(g.syncOut());
  assert.equal(JSON.stringify(g.S.prio), avant, 'rien à réécrire, donc rien à redessiner');
});

t('une priorité posée sur l\'autre poste ne reste pas invisible', () => {
  /* Elle désigne sa planète par le gid tant que le relevé d'ici ne l'a pas
     nommée : prios() ne la rend pas, le champ d'Empire reste vide, et jusqu'ici
     rien ne la montrait nulle part. */
  const g = app(s2 => { s2.planets[0].gid = '33701';
    s2.prio = [{ kind: 'b', k: 'lab', lvl: 10, gid: '99999' }]; });
  assert.deepEqual(g.prios(), [], 'aucune planète d\'ici ne la porte');
  const h = g.prioHtml();
  assert.match(h, /Autre poste/);
  assert.match(h, /Labo 10/);
  g.prioClean();
  assert.equal(g.S.prio.length, 1, 'et le nettoyage ne la jette pas');
});

t('une priorité venue de l\'autre poste se retire comme les autres', () => {
  const g = app(s2 => { s2.planets[0].gid = '33701';
    s2.prio = [{ kind: 'b', k: 'lab', lvl: 10, gid: '99999' }]; });
  assert.match(g.prioHtml(), /data-prio-del="gid\|99999\|lab"/);
  g.prioRetire('gid|99999|lab');
  assert.deepEqual(g.S.prio, []);
});

t('les cases de forme de vie relevées entrent dans la grille des niveaux', () => {
  const g = app(s => { s.planets[0].lf = { 11102: { lvl: 7, state: 'ok' }, 11101: { lvl: 3, state: 'ok' } }; });
  /* Après la carte de pose : depuis qu'elle propose les cases de forme de vie,
     elle nomme « Secteur résidentiel » avant la grille, et un indexOf pris sur
     la vue entière mesurerait sa liste déroulante au lieu de la grille. */
  const h = g.VIEWS.planets().split('data-posego').pop();
  /* Dans l'ordre du jeu : les clés entières s'énumèrent en ordre croissant,
     quel que soit l'ordre où le relevé les a posées. */
  assert.ok(h.indexOf('Secteur résidentiel') < h.indexOf('Ferme biosphérique'), 'rangées par identifiant');
  assert.match(h, /Secteur résidentiel<span class="lv"><input type="number" value="3" readonly/, 'niveau relevé, non saisi');
  assert.match(h, /data-pid="mere" data-prio="11102" data-kind="lf"/, 'et son champ de niveau visé');
  /* Sous leur nom : mêlées aux bâtiments, elles étaient là sans se trouver. */
  assert.ok(h.indexOf('<b>Formes de vie</b>') < h.indexOf('Secteur résidentiel'), 'la grille porte son titre');
});

t('le champ de niveau visé d\'une forme de vie montre la priorité posée', () => {
  const g = app(s => { s.planets[0].lf = { 11101: { lvl: 3, state: 'ok' } };
    s.prio = [{ kind: 'lf', pid: 'mere', k: 11101, lvl: 6 }]; });
  assert.match(g.VIEWS.planets(), /data-prio="11101" data-kind="lf" value="6"/);
});

t('une planète dont aucune case n\'est relevée le dit au lieu de se taire', () => {
  const g = app(s => { for (const p of s.planets) p.lf = {}; });
  const h = g.VIEWS.planets();
  assert.match(h, /<b>Formes de vie<\/b> — aucune case de forme de vie relevée ici/);
  assert.doesNotMatch(h, /data-kind="lf"/, 'et pas de grille vide');
});

t('relire un niveau visé de forme de vie demande un entier, pas la chaîne du DOM', () => {
  /* Pourquoi le gestionnaire convertit : l'attribut d'une tuile se lit en
     chaîne, et priosLf() ne range que des entiers. Sans la conversion, le champ
     se viderait sous les doigts du joueur à l'instant où il pose. */
  const g = app(s => { s.planets[0].lf = { 11101: { lvl: 3, state: 'ok' } }; });
  g.prioPose('lf', 'mere', '11101', '6');
  assert.equal(g.prioLvl('lf', 'mere', 11101), 6);
  assert.equal(g.prioLvl('lf', 'mere', '11101'), '', 'la chaîne ne retrouve rien');
});

/* ---------- ce qui vient de la page du jeu est une valeur de frontière ---------- */
t('une apostrophe ne referme plus un attribut à apostrophes', () => {
  /* data-launch est écrit entre apostrophes, et « Tour d'habitation » est dans
     notre propre table de noms : le JSON s'y coupait en deux. Le bouton
     « Lancé » mourait sur la carte, et la fin du nom se lisait comme des
     attributs — un nom de planète bien choisi y posait ce qu'il voulait. */
  const g = app();
  assert.equal(g.esc("Tour d'habitation"), 'Tour d&#39;habitation');
  const charge = JSON.stringify({ what: "Tour d'habitation 5" });
  const html = `<button data-launch='${g.esc(charge)}'>Lancé</button>`;
  const dedans = html.match(/data-launch='([^']*)'/)[1];
  assert.deepEqual(JSON.parse(lu(dedans)), { what: "Tour d'habitation 5" }, 'le JSON traverse entier');
});

t('un nom relevé sur la page du jeu est plafonné, à la lecture et à la fusion', () => {
  /* Même règle que pour le nom qu'une demande apporte : ce que la page du jeu
     écrit n'a pas de longueur promise, et il finit dans le stockage. */
  const long = 'A'.repeat(500);
  const p2 = runPage({ search: '?page=ingame&component=lfbuildings', planetId: '33701',
    tiles: [12101], niveaux: { 12101: 1 }, noms: { 12101: long } });
  assert.equal(p2.envois()[0].data.lf[12101].nom.length, 80, 'à la lecture');
  assert.equal(app().lfMerge({}, { lvl: 1, nom: long }).nom.length, 80, 'et à la fusion');
});

/* ---------- le canal des priorités vers la page du jeu ---------- */
t('prioHints publie ce que le joueur a posé, pas ce que le plan fait', () => {
  const g = app(s => { s.planets[0].gid = '33701'; });
  g.S.prio = [{kind:'b', pid:'mere', k:'lab', lvl:10}];
  assert.deepEqual(g.prioHints(), {'33701': {31: 10}});
  assert.deepEqual(g.planHints([]), {}, 'planHints reste ce qu\'il était');
});

t('une priorité de recherche se montre sur la planète du labo, pas sur une autre', () => {
  const g = app(s => { s.planets[0].gid = '33701'; s.planets[1].gid = '33702'; });
  g.S.prio = [{kind:'t', k:'plasma', lvl:12}];
  assert.equal(g.labPlanet().id, 'mere', 'le labo de l\'échantillon est la mère');
  assert.deepEqual(g.prioHints(), {'33701': {122: 12}});
  g.S.centre = 'colo';
  assert.equal(g.labPlanet().id, 'colo');
  assert.deepEqual(g.prioHints(), {'33702': {122: 12}}, 'le centre déplacé, la pastille suit');
});

t('une priorité lf se montre sur sa planète, par son identifiant de tuile', () => {
  const g = app(s => { s.planets[0].gid = '33701'; s.planets[0].lf = {11101:{lvl:1, state:'ok'}}; });
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:4}];
  assert.deepEqual(g.prioHints(), {'33701': {11101: 4}});
});

t('une planète que le jeu n\'a pas nommée ne publie rien', () => {
  const g = app(s => { s.planets[0].gid = null; });
  g.S.prio = [{kind:'b', pid:'mere', k:'lab', lvl:10}, {kind:'lf', pid:'mere', k:11101, lvl:4}];
  assert.deepEqual(g.prioHints(), {});
});

t('une clé de planète hostile ne devient pas une clé du canal des priorités', () => {
  const g = app(s => { s.planets[0].gid = '__proto__'; s.planets[1].gid = '33702'; });
  g.S.prio = [{kind:'b', pid:'mere', k:'lab', lvl:10}, {kind:'lf', pid:'mere', k:11101, lvl:4},
    {kind:'b', pid:'colo', k:'lab', lvl:3}];
  const h = g.prioHints();
  assert.deepEqual(Object.keys(h), ['33702']);
  // sans garde, « __proto__ » n'ajoute aucune clé : il écrit dans le prototype
  assert.equal(Object.getPrototypeOf(h)[31], undefined);
  assert.equal(Object.getPrototypeOf(h)[11101], undefined);
  assert.equal(h[31], undefined);
});

t('deux priorités sur la même tuile : la première posée est publiée, comme le plan la sert', () => {
  const g = app(s => { s.planets[0].gid = '33701'; });
  g.S.prio = [{kind:'b', pid:'mere', k:'lab', lvl:8}, {kind:'b', pid:'mere', k:'lab', lvl:10}];
  assert.deepEqual(g.prioHints(), {'33701': {31: 8}});
});

t('gameSkin porte le canal des priorités', () => {
  const g = app(s => { s.planets[0].gid = '33701'; });
  g.S.prio = [{kind:'b', pid:'mere', k:'lab', lvl:10}];
  assert.deepEqual(g.gameSkin([], [], []).prio, {'33701': {31: 10}});
  assert.deepEqual(g.gameSkin([], [], []).hints, {}, 'hints ne porte pas la priorité');
});

/* ---------- le panneau reçoit les demandes de la page du jeu ---------- */
const D = (o) => Object.assign({gid:'33701', tech:31, nom:'Laboratoire', lvl:10, at:SOIR}, o);
const G = s => { s.planets[0].gid = '33701'; };

t('une demande devient une priorité de bâtiment', () => {
  const g = app(G);
  assert.deepEqual(g.prioDrain([D()]), [], 'rien ne reste en attente');
  assert.deepEqual(g.prios(), [{kind:'b', pid:'mere', k:'lab', lvl:10}]);
});

t('une demande de recherche n\'a pas besoin de planète connue', () => {
  const g = app(G);
  g.prioDrain([D({gid:'99999', tech:122, nom:'Plasma', lvl:12})]);
  assert.deepEqual(g.prios(), [{kind:'t', pid:'mere', k:'plasma', lvl:12}]);
});

t('une demande de forme de vie garde son identifiant de tuile', () => {
  const g = app(s => { G(s); s.planets[0].lf = {11101:{lvl:1, state:'ok'}}; });
  g.prioDrain([D({tech:11101, nom:'Habitation', lvl:4})]);
  assert.deepEqual(g.priosLf(), [{pid:'mere', k:11101, lvl:4}]);
});

t('une demande dont la planète est inconnue attend, et se laisse nommer', () => {
  const g = app(G);
  const reste = g.prioDrain([D({gid:'99999', nom:'Usine de robots', tech:14})]);
  assert.equal(reste.length, 1, 'gardée');
  assert.equal(reste[0].nom, 'Usine de robots', 'et nommable');
  assert.deepEqual(g.prios(), [], 'rien n\'est posé');
});

t('une demande gardée se pose dès que sa planète est relevée', () => {
  const g = app();
  const reste = g.prioDrain([D()]);
  assert.equal(reste.length, 1);
  g.S.planets[0].gid = '33701';
  assert.deepEqual(g.prioDrain(reste), []);
  assert.deepEqual(g.prios(), [{kind:'b', pid:'mere', k:'lab', lvl:10}]);
});

t('une demande gardée depuis plus de 24 h disparaît, une récente reste', () => {
  const g = app();
  assert.deepEqual(g.prioDrain([D({gid:'99999', at: SOIR - 25*3600*1000})]), []);
  assert.equal(g.prioDrain([D({gid:'99999', at: SOIR - 23*3600*1000})]).length, 1);
});

t('la liste gardée vit dans S : vide à neuf et sur un ancien état, rejouée au relevé', () => {
  const g = app(s => { delete s.prioAsk; });
  assert.deepEqual(g.prioDemandes(), []);
  assert.deepEqual(g.S.prioAsk, []);
  g.S.prioAsk = g.prioDrain([D()]);
  assert.equal(g.prioDemandes().length, 1);
  g.applyGame({planets:{'33701':{name:'Mère', coords:'1:142:8'}}, order:['33701']});
  assert.deepEqual(g.prioDemandes(), [], 'le relevé la place');
  assert.deepEqual(g.prios().map(x => x.k), ['lab']);
});

t('une demande malformée ne pose rien et ne lève pas', () => {
  const g = app(G);
  const sales = [null, undefined, 7, 'x', [], {}, D({tech:null}), D({lvl:'dix'}), D({lvl:2.5}), D({lvl:10.5}), D({lvl:'10'}), D({lvl:-3}), D({tech:'0x2B4D'}), D({tech:'11101abc'}),
    D({lvl:undefined}), D({gid:undefined}), D({gid:'__proto__'}), D({gid:'constructor'}), D({gid:'33701x'}),
    D({tech:'__proto__'}), D({tech:'constructor'}), D({tech:10999}), D({tech:50}), D({tech:0}), D({tech:41}), D({tech:105}), D({tech:125}),
    D({gid:'__proto__', tech:122}), D({gid:'__proto__', tech:11101})];
  // une à une : une entrée posée serait sinon retirée par la suivante, et le défaut passerait inaperçu
  for(const s of sales) {
    assert.deepEqual(g.prioDrain([s]), [], 'jetée : ' + JSON.stringify(s));
    assert.deepEqual(g.S.prio, [], 'rien posé pour ' + JSON.stringify(s));
  }
  const reste = g.prioDrain(sales);
  assert.equal(reste.length, 0, 'rien de ces entrées n\'est digne d\'être gardée');
  assert.deepEqual(g.prios(), []);
  assert.deepEqual(g.priosLf(), []);
  assert.deepEqual(g.S.prio, [], 'aucune priorité posée');
  // Object.keys est aveugle : « out.__proto__ = … » ne crée aucune clé propre
  for(const k of ['31', '122', '11101', 'lab', 'lvl', 'gid', 'k']) assert.equal(Object.prototype[k], undefined, 'Object.prototype.' + k);
  assert.equal(({})[31], undefined);
  assert.equal(({}).lvl, undefined);
});

t('deux demandes sur la même tuile n\'en font qu\'une, la dernière', () => {
  const g = app(G);
  g.prioDrain([D({lvl:9, at:1}), D({lvl:12, at:2})]);
  assert.deepEqual(g.prios(), [{kind:'b', pid:'mere', k:'lab', lvl:12}]);
});

t('une demande rejouée avec la file gardée ne double rien', () => {
  const g = app(G);
  g.S.prioAsk = g.prioDrain([D({gid:'99999'})]);
  g.prioDrain([D(), D({lvl:12})]);
  g.prioDrain(g.prioDemandes());
  assert.equal(g.prios().length, 1);
  assert.equal(g.prioDemandes().length, 1);
});

/* ---------- le chemin que la demande parcourt : stockage -> écouteur -> S.prio ---------- */
t('un changement de stockage prioAsk pose la priorité puis efface la clé', () => {
  const g = app(G);
  g.fire({prioAsk: {newValue: [D()]}});
  assert.deepEqual(g.prios(), [{kind:'b', pid:'mere', k:'lab', lvl:10}]);
  assert.deepEqual(g.removed(), ['prioAsk'], 'clé effacée');
  assert.deepEqual(g.saved().prio, [{kind:'b', pid:'mere', k:'lab', lvl:10}], 'et sauvegardée : plus de copie côté page');
});

t('accueillir une demande republie le plan, même hors de l\'onglet Aujourd\'hui', () => {
  // l'onglet Empire : son rafraîchissement ne publie pas le plan, c'est le cas qui rendait la tuile muette
  const g = app(s => { G(s); s.__tab = 'empire'; }, SOIR, null, true);
  assert.equal((((g.stored().skin || {}).prio) || {})['33701'], undefined, 'pas de priorité publiée avant la demande');
  g.fire({prioAsk: {newValue: [D()]}});
  const skin = g.stored().skin;
  assert.ok(skin, 'la peau a été publiée');
  assert.equal(skin.prio['33701'][31], 10, 'avec la priorité qui vient d\'être posée');
});

t('une demande en attente placée par un relevé republie le plan, même sur l\'onglet Empire', () => {
  const g = app(s => { s.__tab = 'empire'; }, SOIR, null, true);
  g.S.prioAsk = [D()];
  assert.equal((((g.stored().skin || {}).prio) || {})['33701'], undefined);
  g.applyGame({ planets: { '33701': { coords: '1:142:8', b: { lab: 5 } } }, order: ['33701'] });
  assert.equal(g.stored().skin.prio['33701'][31], 10, 'la tuile voit la demande enfin placée');
});

t('le champ du volet Empire republie le plan après avoir posé', () => {
  /* On nomme view et bind pour attraper l'écouteur « change » du champ, puis on
     le déclenche : c'est le comportement qui est vérifié, pas la présence d'une
     ligne — REFRESH.empire ne publie rien, seul publieLePlan() après save() le fait. */
  const g = app(s => { G(s); s.__tab = 'empire'; }, SOIR, null, true);
  let change;
  const champ = { dataset: { pid: 'mere', prio: 'lab' }, value: '10', addEventListener: (ev, fn) => { if (ev === 'change') change = fn; } };
  g.view.querySelectorAll = sel => (sel === 'input[data-prio]' ? [champ] : []);
  g.bind();
  assert.ok(change, 'le champ écoute « change »');
  assert.equal((((g.stored().skin || {}).prio) || {})['33701'], undefined, 'rien de publié avant la saisie');
  change();
  assert.deepEqual(g.stored().skin.prio['33701'], { 31: 10 }, 'la tuile voit la priorité posée');
});

t('la minuterie de 30 s republie le plan aussi sur Empire', () => {
  /* setInterval est neutralisé dans le harnais : on épingle la source. */
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
  // garderVue() enrobe le dessin pour que la carte lue ne bouge pas à l'écran
  assert.match(src, /garderVue\(\(\)=>\{\s*REFRESH\[tab\]\(\);\s*cartesSync\(\);\s*\}\);\s*publieLePlan\(\);\s*finDeNuit\(\);\s*\}, 30000\)/);
});

t('le changement que provoque l\'effacement lui-même ne rejoue rien', () => {
  const g = app(G);
  g.fire({prioAsk: {newValue: [D()]}});
  g.fire({prioAsk: {oldValue: [D()]}});          // newValue absent : c'est le remove()
  assert.equal(g.prios().length, 1);
  assert.deepEqual(g.removed(), ['prioAsk'], 'effacée une seule fois');
});

t('une demande dont la planète est inconnue, livrée par l\'écouteur, est gardée dans S', () => {
  const g = app(G);
  g.fire({prioAsk: {newValue: [D({gid:'99999', nom:'Lune'})]}});
  assert.deepEqual(g.prios(), []);
  assert.equal(g.prioDemandes()[0].nom, 'Lune');
});

t('au démarrage, une demande déposée panneau fermé est drainée', () => {
  const g = app(G, null, null, false, [D({lvl:7})]);
  assert.deepEqual(g.prios(), [{kind:'b', pid:'mere', k:'lab', lvl:7}]);
  assert.deepEqual(g.removed(), ['prioAsk']);
});

t('au démarrage sans demande, rien n\'est effacé ni posé', () => {
  const g = app(G);
  assert.deepEqual(g.removed(), []);
  assert.deepEqual(g.S.prio, []);
});

t('un changement d\'une autre clé ne touche pas aux priorités', () => {
  const g = app(G);
  g.S.prio = [{kind:'b', pid:'mere', k:'lab', lvl:10}];
  g.fire({api: {newValue: null}});
  g.fire({pendingAlerts: {newValue: []}});
  g.fire({prioAsk: {newValue: [D()]}}, 'sync');   // autre zone de stockage
  assert.deepEqual(g.S.prio, [{kind:'b', pid:'mere', k:'lab', lvl:10}]);
  assert.deepEqual(g.removed(), []);
});

t('boot.js transmet prioAsk à app.js, clé sans préfixe ls:', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'boot.js'), 'utf8');
  const win = {}, ask = [D()];
  /* Le chrome que boot.js voit dans le panneau : il lit aussi rules.json par
     l'URL de l'extension, et le mode des heures dans le stockage synchronisé. */
  const chrome = {storage: {local: {get(k, cb) { cb({'ls:x': '1', prioAsk: ask, game: null}); }, set() { return Promise.resolve(); }},
    sync: {get(k, cb) { cb({}); }}}, runtime: {getURL: f => 'chrome-extension://test/' + f}};
  const document = {createElement: () => ({}), body: {appendChild() {}}};
  const fetch = () => Promise.resolve({ok: true, json: () => Promise.resolve({version: 1, regles: []})});
  new Function('window', 'chrome', 'document', 'fetch', src)(win, chrome, document, fetch);
  assert.deepEqual(win.__prioAsk, ask);
  assert.equal(win.__mem.x, '1');
});

/* ---------- une demande gardée ne devient jamais une suppression ---------- */
/* ---------- lvl 0 retire ; une demande satisfaite est abandonnée, jamais lue comme un retrait ---------- */
const TUILES = [['b', 31, {kind:'b', pid:'mere', k:'lab', lvl:20}], ['t', 122, {kind:'t', k:'plasma', lvl:20}],
  ['lf', 11101, {kind:'lf', pid:'mere', k:11101, lvl:20}]];
const base = s => { G(s); s.planets[0].lf = {11101:{lvl:2, state:'ok'}}; s.tech.plasma = 4; };  // lab 5, plasma 4, 11101 à 2
const courant = {31: 5, 122: 4, 11101: 2};

t('lvl 0, fraîche, retire la priorité (b, t, lf)', () => {
  for(const [, tech, pose] of TUILES){
    const g = app(base);
    g.S.prio = [Object.assign({}, pose)];
    g.prioDrain([D({tech, lvl:0})]);
    assert.deepEqual(g.S.prio, [], 'retirée pour la tuile ' + tech);
  }
});

t('lvl 0, gardée faute de planète, retire au rejeu une fois la planète relevée', () => {
  for(const [kind, tech, pose] of TUILES.filter(x => x[0] !== 't')){
    const g = app(base);
    g.S.prio = [Object.assign({}, pose)];
    g.S.prioAsk = g.prioDrain([D({gid:'55555', tech, lvl:0})]);
    assert.equal(g.prioDemandes().length, 1, 'gardée : ' + kind);
    assert.equal(g.S.prio.length, 1, 'et rien n\'est retiré tant que la planète manque');
    g.applyGame({planets:{'55555':{name:'Mère', coords:'1:142:8'}}, order:['55555']});
    assert.deepEqual(g.S.prio, [], 'retirée au rejeu : ' + kind);
    assert.deepEqual(g.prioDemandes(), []);
  }
});

t('une demande satisfaite est abandonnée, fraîche ou rejouée, et ne touche à rien (b, t, lf)', () => {
  for(const [, tech, pose] of TUILES){
    const g = app(base);
    g.S.prio = [Object.assign({}, pose)];
    for(const lvl of [courant[tech], courant[tech] - 1].filter(x => x > 0)){
      assert.deepEqual(g.prioDrain([D({tech, lvl})]), [], 'fraîche, abandonnée');
      assert.deepEqual(g.S.prio, [pose], 'et la priorité posée à la main reste : ' + tech + ' lvl ' + lvl);
    }
    // gardée, puis rattrapée par le niveau pendant l'attente
    g.S.prioAsk = [D({tech, lvl:courant[tech]})];
    g.applyGame({planets:{'33701':{name:'Mère', coords:'1:142:8'}}, order:['33701']});
    assert.deepEqual(g.S.prio, [pose], 'rejouée, elle ne retire rien : ' + tech);
    assert.deepEqual(g.prioDemandes(), [], 'et n\'est pas gardée plus longtemps');
  }
});

t('un niveau fraîchement relevé n\'a plus à être demandé : la demande au-dessus du courant pose', () => {
  const g = app(base);
  g.prioDrain([D({tech:31, lvl:6})]);
  assert.deepEqual(g.S.prio, [{kind:'b', pid:'mere', k:'lab', lvl:6}]);
});

t('les demandes gardées sur la même tuile se réduisent à la dernière', () => {
  const g = app();
  const reste = g.prioDrain([D({lvl:6, at:SOIR}), D({lvl:8, at:SOIR}), D({lvl:9, at:SOIR, tech:14})]);
  assert.equal(reste.length, 2);
  assert.equal(reste.find(x => x.tech === 31).lvl, 8);
  g.S.prioAsk = reste;
  g.fire({prioAsk: {newValue: [D({lvl:12})]}});
  assert.equal(g.prioDemandes().filter(x => x.tech === 31).length, 1);
  assert.equal(g.prioDemandes().find(x => x.tech === 31).lvl, 12, 'la plus récente');
});

t('une demande sans at utilisable est gardée, non expirée', () => {
  const g = app();
  for(const at of [undefined, NaN, 'hier', null, SOIR + 3600e3]){
    const reste = g.prioDrain([D({at})]);
    assert.equal(reste.length, 1, 'gardée pour at = ' + String(at));
  }
});

t('un nom démesuré est borné avant d\'entrer dans l\'état', () => {
  const g = app();
  assert.equal(g.prioDrain([D({nom:'x'.repeat(5000)})])[0].nom.length, 80);
});

/* ---------- le bloc dit aussi les formes de vie et les demandes en attente ---------- */

/* Une case lue : `next` est le niveau que le prix vise, sinon lfCost ne la dit
   pas chiffrée (lfCase, plus haut, la construit). */
const lfBloc = (cases, mode) => { const g = app(s => { s.planets[0].lf = cases; }); if(mode) g.S.day.lf = mode; return g; };
const lfHtml = (g, prio) => { g.S.prio = prio; return g.prioHtml(g.simulateDay()); };
const lf11101 = [{kind:'lf', pid:'mere', k:11101, lvl:4}];

t('le bloc nomme une priorité de forme de vie, avec le nom du jeu', () => {
  const g = lfBloc({11101: lfCase(1, [10, 0, 0], {name:'Habitation'})});
  assert.match(lfHtml(g, lf11101), /Habitation 4/);
});

t('une priorité lf pas encore chiffrée dit quoi faire', () => {
  const g = lfBloc({11101: {lvl:1, state:'ok', name:'Habitation'}});
  assert.match(lfHtml(g, lf11101), /ouvre-la dans le jeu/i);
});

t('une priorité lf verrouillée le dit', () => {
  const g = lfBloc({11101: {lvl:0, state:'locked', name:'Habitation'}});
  assert.match(lfHtml(g, [{kind:'lf', pid:'mere', k:11101, lvl:1}]), /prérequis/i);
});

t('une priorité lf absente du relevé le dit, et n\'est pas « pas chiffrée »', () => {
  const h = lfHtml(lfBloc({}), lf11101);
  assert.match(h, /jamais vu cette case/);
  assert.doesNotMatch(h, /Pas encore chiffrée/);
  assert.match(h, /<span class="what">[^<]+ 4<\/span>/, 'la ligne existe, avec un nom de repli');
});

t('une priorité lf en tête de sa file le dit, et nomme le réglage', () => {
  const g = lfBloc({11101: lfCase(1, [10, 0, 0], {name:'Habitation'})}, 'first');
  const h = lfHtml(g, lf11101);
  assert.match(h, /En tête de sa file/);
  assert.match(h, /Avant les bâtiments/);
});

t('une priorité lf que le réglage fait passer après les bâtiments nomme ce réglage', () => {
  const g = lfBloc({11101: lfCase(1, [9e9, 0, 0], {name:'Habitation'})});
  g.S.day.lf = 'after';
  assert.match(lfHtml(g, lf11101), /après les bâtiments/i);
});

t('une priorité lf qui attend le tour d\'une autre de sa file le dit', () => {
  const g = lfBloc({11101: lfCase(1, [10, 0, 0], {name:'Habitation'}), 11102: lfCase(1, [10, 0, 0], {name:'Cuisine'})}, 'first');
  const h = lfHtml(g, [{kind:'lf', pid:'mere', k:11101, lvl:4}, {kind:'lf', pid:'mere', k:11102, lvl:4}]);
  assert.equal((h.match(/Attend son tour dans sa file/g) || []).length, 1);
  assert.match(h.split('</li>')[1], /Cuisine 4[\s\S]*Attend son tour/, 'la seconde attend');
  assert.match(h.split('</li>')[1], /Avant les bâtiments/, 'et nomme le réglage');
});

t('formes de vie réglées sur « Ne pas s\'en occuper » : la ligne le dit', () => {
  const g = lfBloc({11101: lfCase(1, [10, 0, 0], {name:'Habitation'})}, 'off');
  assert.match(lu(lfHtml(g, lf11101)), /Ne pas s'en occuper[^<]*n'y touche pas/);
});

// Review Focus 1, côté visible
t('une demande que le panneau n\'a pas su placer se voit', () => {
  const g = app();
  g.S.prioAsk = g.prioDrain([{gid:'99999', tech:14, nom:'Usine de robots', lvl:8, at:Date.now()}]);
  const h = g.prioHtml(g.simulateDay());
  assert.match(h, /Usine de robots/);
  assert.match(h, /aucune de tes planètes/i, 'et dit ce qui manque');
});

/* Ce que esc() produit, écrit en dur : « absent du HTML brut » passerait aussi
   contre un esc() à moitié fait, ou contre une ligne qui ne rendrait plus le nom. */
const HOSTILE = '<script>alert("x")</script><img src=x onerror=alert(1)>&';
const HOSTILE_ESC = '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;&amp;';

t('le nom d\'une demande, lu dans le jeu, est échappé en entier', () => {
  const g = app();
  g.S.prioAsk = g.prioDrain([{gid:'99999', tech:14, nom:HOSTILE, lvl:8, at:Date.now()}]);
  const h = g.prioHtml(g.simulateDay());
  assert.ok(h.includes(`<span class="what">${HOSTILE_ESC}</span>`), h);
  assert.ok(!h.includes('<script') && !h.includes('<img') && !h.includes('"x"'), 'rien de brut');
});

t('le nom d\'une planète est échappé dans le bloc (bâtiment et forme de vie)', () => {
  const g = lfBloc({11101: lfCase(1, [10, 0, 0], {name:'Habitation'})});
  g.S.planets[0].name = HOSTILE;
  g.S.prio = [{kind:'b', pid:'mere', k:'lab', lvl:10}, {kind:'lf', pid:'mere', k:11101, lvl:4}];
  const h = g.prioHtml(g.simulateDay());
  assert.equal(h.split(`<span class="pill">${HOSTILE_ESC}</span>`).length, 3, 'les deux lignes');
  assert.ok(!h.includes('<script') && !h.includes('<img'));
});

t('le nom d\'une case de forme de vie lu dans le jeu est échappé', () => {
  const g = lfBloc({11101: lfCase(1, [10, 0, 0], {name:HOSTILE})});
  const h = lfHtml(g, lf11101);
  assert.ok(h.includes(`<span class="what">${HOSTILE_ESC} 4</span>`), h);
  assert.ok(!h.includes('<script') && !h.includes('<img'));
});

t('une demande de retrait en attente se dit retrait', () => {
  const g = app();
  g.S.prioAsk = g.prioDrain([{gid:'99999', tech:14, nom:'Usine de robots', lvl:0, at:Date.now()}]);
  assert.match(g.prioHtml(g.simulateDay()), /Retrait demandé/);
});

t('Retirer enlève la bonne ligne, quelle que soit son espèce', () => {
  const g = lfBloc({11101: lfCase(1, [10, 0, 0], {name:'Habitation'})});
  g.S.prio = [{kind:'b', pid:'mere', k:'lab', lvl:10},
              {kind:'lf', pid:'mere', k:11101, lvl:4},
              {kind:'t', k:'plasma', lvl:12}];
  g.S.prioAsk = g.prioDrain([{gid:'99999', tech:14, nom:'Usine de robots', lvl:8, at:Date.now()}]);
  // Les références que le bloc pose sur ses boutons, relues telles quelles.
  const refs = () => [...g.prioHtml(g.simulateDay()).matchAll(/data-prio-del="([^"]+)"/g)].map(m => m[1]);
  assert.equal(refs().length, 4, 'quatre lignes, quatre boutons');
  // l'ordre du bloc : bâtiments et recherches (prios), puis formes de vie, puis demandes
  const [b, t4, l, ask] = refs();
  g.prioRetire(l);
  assert.deepEqual(g.priosLf(), [], 'la lf est partie');
  assert.equal(g.prios().length, 2, 'les deux autres priorités sont intactes');
  g.prioRetire(ask);
  assert.deepEqual(g.prioDemandes(), [], 'la demande est partie');
  assert.equal(g.prios().length, 2, 'et rien d\'autre n\'a bougé');
  g.prioRetire(t4);
  assert.deepEqual(g.prios().map(x => x.k), ['lab'], 'la recherche part, le bâtiment reste');
  g.prioRetire(b);
  assert.equal(g.prios().length, 0);
});

t('une référence périmée ou étrangère ne retire rien', () => {
  const g = app(prio2);
  g.prioRetire('lf|mere|11101'); g.prioRetire('ask|1|2'); g.prioRetire('n\'importe quoi'); g.prioRetire(0);
  assert.equal(g.S.prio.length, 2);
});

t('le bloc vide nomme le clic droit avant le volet Empire', () => {
  const h = app().prioHtml(app().simulateDay());
  assert.ok(h.indexOf('clic droit') >= 0, 'le clic droit est nommé');
  assert.ok(h.indexOf('clic droit') < h.indexOf('Empire'), 'et il vient avant');
});

t('le gestionnaire de clic passe la référence telle quelle, sans « + »', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(src, /prioRetire\(pd\.dataset\.prioDel\)/);
});

t('une demande en attente seule suffit à remplir le bloc', () => {
  const g = app();
  g.S.prioAsk = g.prioDrain([{gid:'99999', tech:14, nom:'Usine de robots', lvl:8, at:Date.now()}]);
  assert.doesNotMatch(g.prioHtml(g.simulateDay()), /Aucune pour l'instant/);
});

t('une file de forme de vie occupée ne laisse pas dire « servie »', () => {
  const g = lfBloc({11101: lfCase(1, [10, 0, 0], {name:'Habitation'})}, 'first');
  g.S.timers = [{id:'l1', game:true, kind:'x', k:'other', queue:'lfbuilding', pid:'mere', end:SOIR + 20*3600e3, done:false}];
  const h = lfHtml(g, lf11101);
  assert.match(h, /file de forme de vie est occupée/);
  assert.match(h, /dans 20h 00m/, 'et dit quand');
  assert.doesNotMatch(h, /En tête de sa file|sert avant tout/);
  g.S.timers[0].pid = 'colo';
  assert.match(lfHtml(g, lf11101), /En tête de sa file/, 'le chantier d\'une autre planète ne la gêne pas');
  g.S.timers[0].pid = 'mere'; g.S.timers[0].done = true;
  assert.match(lfHtml(g, lf11101), /En tête de sa file/, 'un chantier fini non plus');
  g.S.timers[0].done = false;
  g.S.timers[0].queue = 'lfresearch';
  assert.match(lfHtml(g, lf11101), /En tête de sa file/, 'une autre file ne la gêne pas');
});

t('une référence mal encodée ne lève pas et ne retire rien', () => {
  const g = app(prio2);
  g.prioRetire('b|%|lab'); g.prioRetire('lf|%E0%A4%A|1');
  assert.equal(g.S.prio.length, 2);
});

t('le réglage des formes de vie est localisé, et la demande dit son délai', () => {
  const g = lfBloc({11101: lfCase(1, [10, 0, 0], {name:'Habitation'})}, 'off');
  assert.match(lfHtml(g, lf11101), /Réglages › Plan du jour/);
  const a = app();
  a.S.prioAsk = [{gid:'99999', tech:14, nom:'Usine de robots', lvl:8, at:SOIR - 3600e3}];
  assert.match(lu(a.prioHtml(a.simulateDay())), /s'efface dans 23h 00m/);
});

/* ---------- le clic droit sur une tuile ---------- */

/* Une page de ressources à une tuile : la Mine de métal au niveau 14. `niveaux`
   dit ce que le jeu écrit dans la case ; le nom vient de son étiquette. */
const SUR_MINE = { search: '?page=ingame&component=supplies', planetId: '33701', tiles: [1],
  niveaux: { 1: 14 }, noms: { 1: 'Mine de métal' } };

t('un clic droit sur une tuile à niveau demande une priorité', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroit(1, '20');
  const l = p.ecrit().prioAsk;
  assert.equal(l.length, 1);
  assert.deepEqual(l[0], { gid: '33701', tech: 1, nom: 'Mine de métal', lvl: 20, at: l[0].at });
  assert.ok(l[0].at > 0, 'la demande est datée');
  assert.ok(p.menuEmpeche, 'le menu du navigateur ne s\'ouvre pas sur une tuile traitée');
});

t('le champ s\'ouvre prérempli au niveau suivant, contenu choisi, focus dedans', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroit(1, undefined, { laisse: true });
  assert.equal(p.champ.value, '15');
  assert.ok(p.champ.selectionne, 'le contenu est sélectionné');
  assert.ok(p.champ.focus_, 'le focus est dedans');
});

t('Entrée sans rien taper valide ce qui est prérempli', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroit(1);
  assert.equal(p.ecrit().prioAsk[0].lvl, 15);
});

t('une priorité déjà posée préremplit son niveau, pas le suivant', () => {
  const p = runPage({ ...SUR_MINE, skin: { prio: { 33701: { 1: 20 } } } });
  p.clicDroit(1, undefined, { laisse: true });
  assert.equal(p.champ.value, '20');
});

t('une tuile qui se compte ne reçoit pas de priorité, et le dit', () => {
  const p = runPage({ search: '?page=ingame&component=shipyard', planetId: '33701', tiles: [212],
    niveaux: { 212: { nombre: 7 } } });
  p.clicDroit(212, '20');
  assert.equal(p.ecrit().prioAsk, undefined, 'rien n\'est demandé');
  assert.ok(!p.menuEmpeche, 'le menu du navigateur reste disponible');
  assert.match(p.refus, /niveau/i, 'la tuile dit pourquoi');
  assert.equal(p.champ, null, 'aucun champ');
});

t('une case de recherche de forme de vie, sans niveau, est refusée pour ce motif', () => {
  const p = runPage({ search: '?page=ingame&component=lfresearch', planetId: '33701', tiles: [12101] });
  p.clicDroit(12101, '3');
  assert.equal(p.ecrit().prioAsk, undefined);
  assert.ok(!p.menuEmpeche);
  assert.match(p.refus, /niveau/i);
});

t('le Dépôt et le Silo se posent au clic droit', () => {
  for (const id of [34, 44]) {
    const p = runPage({ search: '?page=ingame&component=facilities', planetId: '33701',
      tiles: [id], niveaux: { [id]: 2 } });
    p.clicDroit(id, '5');
    assert.equal(p.ecrit().prioAsk[0].lvl, 5, 'tuile ' + id);
  }
});

t('le Terraformeur et le Dock spatial se posent au clic droit', () => {
  for (const id of [33, 36]) {
    const p = runPage({ search: '?page=ingame&component=facilities', planetId: '33701',
      tiles: [id], niveaux: { [id]: 2 } });
    p.clicDroit(id, '5');
    assert.equal(p.ecrit().prioAsk[0].lvl, 5, 'tuile ' + id);
  }
});

/* l'état chargé, complété et remplacé : test/etat.test.js */
require('./etat.test')({ t, app, assert, SOIR });

t('une tuile à niveau que le copilote ne modélise pas est refusée dans la page', () => {
  for (const id of [41, 42, 43]) {   // Base lunaire, Phalange, Porte de saut
    const p = runPage({ search: '?page=ingame&component=facilities', planetId: '33701', tiles: [id],
      niveaux: { [id]: 2 } });
    p.clicDroit(id, '5');
    assert.equal(p.ecrit().prioAsk, undefined, 'tuile ' + id);
    assert.ok(!p.menuEmpeche, 'tuile ' + id + ' : le menu du navigateur reste');
    assert.match(p.refus, /copilote/i, 'tuile ' + id);
    assert.doesNotMatch(p.refus, /niveau/i, 'le motif n\'est pas celui du niveau');
  }
});

t('les tuiles modélisées sont toutes acceptées : tous les bâtiments, toutes les recherches, les formes de vie', () => {
  const { OG_BUILD, OG_TECH } = new Function(require('fs').readFileSync(require('path').join(__dirname, '..', 'ids.js'), 'utf8')
    + '; return { OG_BUILD, OG_TECH };')();
  const ids = [...Object.keys(OG_BUILD), ...Object.keys(OG_TECH), 11101, 12345];
  for (const id of ids) {
    const p = runPage({ search: '?page=ingame&component=supplies', planetId: '33701', tiles: [id],
      niveaux: { [id]: 3 } });
    p.clicDroit(id, '9');
    assert.equal(p.ecrit().prioAsk[0].lvl, 9, 'tuile ' + id);
  }
});

t('Échap n\'écrit rien, et le champ part', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroit(1, '20', { echap: true });
  assert.equal(p.ecrit().prioAsk, undefined);
  assert.equal(p.champ, null);
});

t('perdre le focus n\'écrit rien non plus', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroit(1, '20', { perdFocus: true });
  assert.equal(p.ecrit().prioAsk, undefined);
  assert.equal(p.champ, null);
});

t('un clic droit ailleurs que sur une tuile laisse le menu du navigateur', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroitAilleurs();
  assert.ok(!p.menuEmpeche);
  assert.equal(p.ecrit().prioAsk, undefined);
});

t('deux clics droits sur la même tuile n\'empilent qu\'une demande', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroit(1, '18'); p.clicDroit(1, '20');
  assert.equal(p.ecrit().prioAsk.length, 1);
  assert.equal(p.ecrit().prioAsk[0].lvl, 20);
});

t('des tuiles différentes s\'ajoutent à la liste au lieu de s\'écraser', () => {
  const p = runPage({ ...SUR_MINE, tiles: [1, 2], niveaux: { 1: 14, 2: 9 } });
  p.clicDroit(1, '20'); p.clicDroit(2, '12');
  assert.deepEqual(p.ecrit().prioAsk.map(d => [d.tech, d.lvl]), [[1, 20], [2, 12]]);
});

t('un clic droit avant que le panneau ait publié quoi que ce soit marche quand même', () => {
  const p = runPage({ ...SUR_MINE, skin: null });
  p.clicDroit(1);
  assert.equal(p.ecrit().prioAsk[0].lvl, 15);
});

t('un champ vidé demande le retrait', () => {
  const p = runPage({ ...SUR_MINE, skin: { prio: { 33701: { 1: 20 } } } });
  p.clicDroit(1, '');
  assert.equal(p.ecrit().prioAsk[0].lvl, 0);
});

t('un niveau déjà atteint demande le retrait, il ne pose pas', () => {
  for (const saisie of ['14', '3']) {
    const p = runPage({ ...SUR_MINE });
    p.clicDroit(1, saisie);
    assert.equal(p.ecrit().prioAsk[0].lvl, 0, 'saisi : ' + saisie);
  }
});

t('un retrait sur une tuile sans priorité part quand même', () => {
  const p = runPage({ ...SUR_MINE, skin: {} });
  p.clicDroit(1, '');
  assert.equal(p.ecrit().prioAsk[0].lvl, 0, 'le panneau en fera un non-événement');
});

t('un niveau juste au-dessus du courant pose', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroit(1, '15');
  assert.equal(p.ecrit().prioAsk[0].lvl, 15);
});

t('une saisie qui n\'est pas un nombre ne part pas, et ne vaut pas un retrait', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroit(1, '12abc');
  assert.equal(p.ecrit().prioAsk, undefined);
  assert.match(p.refus, /nombre/i, 'la tuile dit ce qui ne va pas');
  assert.ok(p.champ, 'le champ reste, pour corriger');
});

t('sans planète lue sur la page, la tuile le dit et ne vole pas le menu', () => {
  const p = runPage({ ...SUR_MINE, planetId: '' });
  p.clicDroit(1, '20');
  assert.equal(p.ecrit().prioAsk, undefined);
  assert.ok(!p.menuEmpeche);
  assert.match(p.refus, /planète/i);
});

t('la demande part avec l\'identifiant de planète du jeu, pour une recherche aussi', () => {
  const p = runPage({ search: '?page=ingame&component=research', planetId: '33701', tiles: [124],
    niveaux: { 124: 5 }, noms: { 124: 'Astrophysique' } });
  p.clicDroit(124, '8');
  assert.deepEqual(p.ecrit().prioAsk.map(d => [d.gid, d.tech, d.nom, d.lvl]), [['33701', 124, 'Astrophysique', 8]]);
});

t('la carte de la peau reçoit le même geste que la tuile du jeu', () => {
  const p = runPage({ ...SUR_MINE, skin: { ...BANDE, peau: true } });
  assert.ok(p.peau.posee, 'la peau est posée');
  p.clicDroit(1, '20', { carte: true });
  assert.equal(p.ecrit().prioAsk[0].lvl, 20);
  assert.equal(p.ecrit().prioAsk[0].tech, 1);
  assert.ok(p.menuEmpeche);
});

/* ---------- le clic droit : ce que la revue a repris ---------- */

t('un clic droit tombé sur un descendant de la tuile ou de la carte est résolu par délégation', () => {
  const p = runPage({ ...SUR_MINE, skin: { ...BANDE, peau: true } });
  p.clicDroit(1, '20', { dessus: true });
  assert.equal(p.ecrit().prioAsk[0].lvl, 20, 'tuile du jeu');
  const q = runPage({ ...SUR_MINE, skin: { ...BANDE, peau: true } });
  q.clicDroit(1, '21', { carte: true, dessus: true });
  assert.equal(q.ecrit().prioAsk[0].lvl, 21, 'carte de la peau');
});

t('une écriture qui échoue le dit sur la tuile, au lieu de se taire', () => {
  for (const casse of ['get', 'lastError']) {
    const log = console.error; console.error = () => {};
    let p;
    try { p = runPage({ ...SUR_MINE, stockageCasse: casse }); p.clicDroit(1, '20'); }
    finally { console.error = log; }
    assert.match(p.refus, /pas enregistré/i, casse);
    assert.equal(p.champ, null, casse + ' : le champ est fermé');
  }
});

t('le champ et le refus ne se recouvrent pas : la faute de frappe se corrige sous le message', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroit(1, '12abc');
  assert.ok(p.champ && p.refus);
  // la règle propre au refus, après la règle partagée : il passe en haut, le champ reste en bas
  const refus = p.styleTxt.match(/\n\.cp-prio-refus\{[^}]*\}/)[0];
  assert.match(refus, /top:2px/);
  assert.match(refus, /bottom:auto/);
});

t('une faute corrigée puis validée ne laisse pas son reproche sur la tuile', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroit(1, '12abc');
  const champ = p.champ;
  champ.value = '20';
  champ.ecoutes.keydown.forEach(fn => fn({ key: 'Enter', isTrusted: true, preventDefault() {}, stopPropagation() {} }));
  assert.equal(p.ecrit().prioAsk[0].lvl, 20);
  assert.equal(p.refus, null, 'plus de message');
});

t('la demande que la page vient de poster gagne sur le préremplissage', () => {
  // planète jamais relevée : le panneau n'a rien placé, `prio` est vide
  const p = runPage({ ...SUR_MINE, skin: {} });
  p.clicDroit(1, '20');
  p.clicDroit(1, undefined, { laisse: true });
  assert.equal(p.champ.value, '20', 'pas niveau + 1');
});

t('une demande de retrait posée l\'emporte sur la priorité du panneau', () => {
  const p = runPage({ ...SUR_MINE, skin: { prio: { 33701: { 1: 20 } } } });
  p.clicDroit(1, '');
  p.clicDroit(1, undefined, { laisse: true });
  assert.equal(p.champ.value, '15', 'plus de cible : niveau + 1');
});

t('Entrée perd son action par défaut : un formulaire autour de la tuile ne part pas', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroit(1, '20');
  assert.ok(p.toucheEmpechee);
});

t('un clic droit fabriqué par un script de la page n\'ouvre rien', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroit(1, '20', { fabrique: true });
  assert.equal(p.champ, null);
  assert.ok(!p.menuEmpeche);
  assert.equal(p.ecrit().prioAsk, undefined);
});

t('une touche Entrée fabriquée ne valide pas', () => {
  const p = runPage({ ...SUR_MINE });
  p.clicDroit(1, '20', { synthese: true });
  assert.equal(p.ecrit().prioAsk, undefined);
  assert.ok(p.champ, 'le champ reste ouvert');
});

t('un attribut de carte qui n\'est pas un entier ne lève rien et laisse le menu', () => {
  const p = runPage({ ...SUR_MINE, skin: { ...BANDE, peau: true } });
  p.clicDroit(1, undefined, { carte: true, laisse: true });
  // on ne peut pas réécrire la carte ici : on en fabrique une, posée dans le panneau
  assert.doesNotThrow(() => p.clicDroitCarteForgee('1"] , [x'));
  assert.ok(!p.menuEmpeche);
});

/* ---------- les deux marquages sur la tuile ---------- */

/* Deux tuiles de ressources : la 1 à 14, la 2 à 9. */
const DEUX = { search: '?page=ingame&component=supplies', planetId: '33701', tiles: [1, 2],
  niveaux: { 1: 14, 2: 9 }, noms: { 1: 'Mine de métal', 2: 'Mine de cristal' } };

t('ta priorité se marque autrement que la cible du plan', () => {
  const p = runPage({ ...DEUX, skin: { hints: { 33701: { 2: 10 } }, prio: { 33701: { 1: 20 } } } });
  const a = p.tuile(1), b = p.tuile(2);
  assert.match(a.pastille, /20/);  assert.match(a.infobulle, /ta priorité/i);
  assert.match(b.pastille, /10/);  assert.ok(!/ta priorité/i.test(b.infobulle));
  assert.notEqual(a.classe, b.classe, 'deux teintes, pas une');
  assert.ok(a.marquee && b.marquee);
});

t('sur la même tuile, la priorité passe devant la cible du plan', () => {
  const p = runPage({ ...DEUX, skin: { hints: { 33701: { 1: 15 } }, prio: { 33701: { 1: 20 } } } });
  assert.match(p.tuile(1).pastille, /20/);
  assert.match(p.tuile(1).infobulle, /ta priorité/i);
  const q = runPage({ ...DEUX, skin: { ...BANDE, peau: true, hints: { 33701: { 1: 15 } }, prio: { 33701: { 1: 20 } } } });
  assert.match(q.carte(1).pastille, /20/, 'la carte dit la même chose');
});

t('une demande pas encore confirmée se voit, et se dit non confirmée', () => {
  const p = runPage({ ...DEUX, skin: {} });
  p.clicDroit(1, '20');
  assert.match(p.tuile(1).pastille, /20/);
  assert.match(p.tuile(1).infobulle, /pas encore|en attente/i);
  assert.notEqual(p.tuile(1).classe, runPage({ ...DEUX, skin: { prio: { 33701: { 1: 20 } } } }).tuile(1).classe,
    'ni la teinte de la priorité confirmée');
});

t('la priorité disparaît de la tuile quand le panneau la retire', () => {
  const p = runPage({ ...DEUX, skin: { prio: { 33701: { 1: 20 } } } });
  assert.match(p.tuile(1).pastille, /20/);
  p.majSkin({ prio: {} });
  assert.equal(p.tuile(1).pastille, null);
  assert.ok(!p.tuile(1).marquee, 'et la tuile n\'est plus entourée');
});

t('la pastille n\'est pas reposée quand rien n\'a changé : le jeu n\'est pas remué', () => {
  // retirer puis reposer le nœud ferait sonner l'observateur, qui repeindrait, sans fin
  for (const skin of [{ prio: { 33701: { 1: 20 } } }, { hints: { 33701: { 1: 15 } } }]) {
    const p = runPage({ ...DEUX, skin });
    const n = p.tuile(1).noeud;
    assert.ok(n);
    p.secousse();
    assert.equal(p.tuile(1).noeud, n);
  }
});

t('une demande dont la tuile n\'est pas un entier ne touche aucun sélecteur', () => {
  const p = runPage({ ...DEUX, skin: {}, askAvant: [{ gid: '33701', tech: '1"] , [x', lvl: 9, at: 1 }] });
  assert.equal(p.tuile(1).pastille, null);
});

t('la pastille « pas payable » garde une couleur lisible sur son fond', () => {
  const p = runPage({ ...DEUX, skin: {} });
  for (const e of ['lancé', 'pas payable']) {
    const r = p.styleTxt.match(new RegExp('cp-cible\\[data-etat="' + e + '"\\]\\{[^}]*\\}'))[0];
    assert.match(r, /color:var\(--cp-creux\)/, e);
  }
});

t('une écriture refusée ne fait pas sonner onChanged : pas de pastille en attente', () => {
  const log = console.error; console.error = () => {};
  let p;
  try { p = runPage({ ...DEUX, skin: {}, stockageCasse: 'lastError' }); p.clicDroit(1, '20'); }
  finally { console.error = log; }
  assert.equal(p.tuile(1).pastille, null);
});

t('une priorité marquée reste après une secousse de la page', () => {
  const p = runPage({ ...DEUX, skin: { prio: { 33701: { 1: 20 } } } });
  p.secousse();
  assert.match(p.tuile(1).pastille, /20/);
});

t('la peau marque aussi la priorité, et répond au clic droit', () => {
  const p = runPage({ ...SUR_MINE, skin: { ...BANDE, peau: true, prio: { 33701: { 1: 20 } } } });
  assert.match(p.carte(1).pastille, /20/);
  assert.match(p.carte(1).infobulle, /ta priorité/i);
  p.clicDroit(1, '25', { carte: true });
  assert.equal(p.ecrit().prioAsk[0].lvl, 25, 'le second sélecteur sert ici');
});

t('la carte distingue le plan, la priorité et la demande en attente', () => {
  const plan = runPage({ ...SUR_MINE, skin: { ...BANDE, peau: true, hints: { 33701: { 1: 15 } } } }).carte(1);
  const prio = runPage({ ...SUR_MINE, skin: { ...BANDE, peau: true, prio: { 33701: { 1: 15 } } } }).carte(1);
  const q = runPage({ ...SUR_MINE, skin: { ...BANDE, peau: true } });
  q.clicDroit(1, '15', { carte: true });
  const attente = q.carte(1);
  assert.equal(new Set([plan.classe, prio.classe, attente.classe]).size, 3, 'trois teintes');
  assert.ok(!/ta priorité/i.test(plan.infobulle));
  assert.match(attente.infobulle, /pas encore/i);
});

t('la source change, le niveau non : la carte se redessine', () => {
  const p = runPage({ ...SUR_MINE, askAvant: [{ gid: '33701', tech: 1, nom: 'Mine de métal', lvl: 20, at: 1 }],
    skin: { ...BANDE, peau: true, prio: { 33701: { 1: 20 } } } });
  const avant = p.carte(1);
  assert.match(avant.infobulle, /pas encore/i);
  p.majAsk(undefined);                       // le panneau a repris la demande
  const apres = p.carte(1);
  assert.equal(apres.pastille, avant.pastille, 'même « → 20 »');
  assert.ok(!/pas encore/i.test(apres.infobulle), 'mais plus en attente');
  assert.match(apres.infobulle, /ta priorité/i);
});

t('une demande de retrait ne fait pas une cible à 0', () => {
  const p = runPage({ ...DEUX, skin: { prio: { 33701: { 1: 20 } } } });
  p.clicDroit(1, '');
  assert.equal(p.tuile(1).pastille, null, 'plus de cible, pas « → 0 »');
  const q = runPage({ ...DEUX, skin: { hints: { 33701: { 1: 15 } }, prio: { 33701: { 1: 20 } } } });
  q.clicDroit(1, '');
  assert.match(q.tuile(1).pastille, /15/, 'la tuile retombe sur le plan');
  assert.ok(!/ta priorité/i.test(q.tuile(1).infobulle));
});

t('une peau publiée avant les priorités n\'a pas de clé prio : la tuile montre le plan', () => {
  const p = runPage({ ...DEUX, skin: { hints: { 33701: { 2: 10 } } } });
  assert.match(p.tuile(2).pastille, /10/);
  assert.equal(p.tuile(1).pastille, null);
  const q = runPage({ ...DEUX, skin: { ...BANDE, peau: true, hints: { 33701: { 2: 10 } } } });
  assert.match(q.carte(2).pastille, /10/);
});

t('la pastille suit le niveau quand la cible change sans que la tuile cesse d\'être marquée', () => {
  const p = runPage({ ...DEUX, skin: { hints: { 33701: { 2: 10 } } } });
  p.majSkin({ hints: { 33701: { 2: 12 } } });
  assert.match(p.tuile(2).pastille, /12/);
  p.majSkin({ hints: { 33701: { 2: 12 } }, prio: { 33701: { 2: 12 } } });
  assert.match(p.tuile(2).infobulle, /ta priorité/i, 'même niveau, autre source');
});

/* Le vrai `get` est asynchrone, et la peinture ne l'est pas : ces tests le
   rendent asynchrone, sinon un lecteur qui l'attendrait passerait quand même. */
t('le miroir s\'amorce par un get qui répond tard, et la page se repeint à ce moment', () => {
  const p = runPage({ ...DEUX, getDiffere: true, skin: {},
    askAvant: [{ gid: '33701', tech: 1, nom: 'Mine de métal', lvl: 20, at: 1 }] });
  assert.equal(p.tuile(1).pastille, null, 'rien tant que le stockage n\'a pas répondu');
  p.livre();
  assert.match(p.tuile(1).pastille, /20/);
  assert.match(p.tuile(1).infobulle, /pas encore/i);
});

t('un changement arrivé avant la réponse tardive du get n\'est pas défait par elle', () => {
  const p = runPage({ ...DEUX, getDiffere: true, skin: {},
    askAvant: [{ gid: '33701', tech: 1, nom: 'Mine de métal', lvl: 20, at: 1 }] });
  p.majAsk([{ gid: '33701', tech: 2, nom: 'Mine de cristal', lvl: 12, at: 2 }]);
  p.livre();                                   // la réponse porte l'état d'avant
  assert.match(p.tuile(2).pastille, /12/);
  assert.equal(p.tuile(1).pastille, null, 'l\'ancienne lecture n\'écrase pas le plus récent');
});

t('onChanged met le miroir à jour, et la clé vidée retire la demande', () => {
  const p = runPage({ ...DEUX, getDiffere: true, skin: {} });
  p.livre();
  p.majAsk([{ gid: '33701', tech: 1, nom: 'Mine de métal', lvl: 20, at: 1 }]);
  assert.match(p.tuile(1).pastille, /20/);
  p.majAsk(undefined);                         // newValue absent : c'est le remove() du panneau
  assert.equal(p.tuile(1).pastille, null);
  assert.ok(!p.tuile(1).marquee);
});

t('un stockage qui lève au chargement ne casse ni la page ni le plan', () => {
  const log = console.error; console.error = () => {};
  let p;
  try { p = runPage({ ...DEUX, stockageCasse: 'get', skin: { hints: { 33701: { 2: 10 } } } }); }
  finally { console.error = log; }
  assert.match(p.tuile(2).pastille, /10/);
});

/* ---------- deux postes, un seul plan ---------- */

/** Le même empire vu par deux postes : les gid viennent du jeu, les id sont locaux. */
const poste = (un, deux) => (s) => {
  s.planets[0].id = un; s.planets[0].gid = '33701';
  s.planets[1].id = deux; s.planets[1].gid = '33801';
};

t('vers l\'autre poste part ce que le joueur décide, pas le relevé de l\'empire', () => {
  const g = app(poste('a1', 'a2'));
  const envoi = g.syncOut();
  for (const k of ['sy:settings', 'sy:day', 'sy:daily', 'sy:prio', 'sy:raids'])
    assert.ok(k in envoi, k + ' doit voyager');
  for (const k of Object.keys(envoi))
    assert.ok(!/planets|tech|timers|explored|syncAt/.test(k), k + ' se relit des pages du jeu');
});

t('une priorité voyage par le gid : l\'autre poste la pose sur sa propre planète', () => {
  const a = app(poste('a1', 'a2'));
  a.prioPose('b', 'a2', 'metal', 12);
  const envoi = a.syncOut();
  assert.deepEqual(envoi['sy:prio'], [{ kind: 'b', k: 'metal', lvl: 12, gid: '33801' }]);
  const b = app(poste('b1', 'b2'));
  b.syncApply(envoi);
  assert.deepEqual(b.S.prio, [{ kind: 'b', k: 'metal', lvl: 12, pid: 'b2' }]);
});

t('une priorité retirée sur un poste s\'en va sur l\'autre', () => {
  const g = app(poste('b1', 'b2'));
  g.prioPose('b', 'b2', 'metal', 12);
  g.syncApply({ 'sy:prio': [] });
  assert.deepEqual(g.S.prio, []);
});

t('une priorité reçue avant le relevé attend sa planète, puis s\'y pose', () => {
  const g = app(poste('b1', 'b2'));
  g.syncApply({ 'sy:prio': [{ kind: 'b', k: 'metal', lvl: 12, gid: '44000' }] });
  assert.equal(g.S.prio[0].gid, '44000', 'gardée telle quelle : cette planète est inconnue ici');
  g.applyGame({ order: ['44000'], planets: { 44000: { name: 'Colonie neuve', coords: '1:142:4', tmax: 50, b: { metal: 3 } } } });
  const p = g.S.planets.find(x => x.gid === '44000');
  assert.deepEqual(g.S.prio[0], { kind: 'b', k: 'metal', lvl: 12, pid: p.id });
});

t('une priorité sur une planète que le jeu ne nomme pas ne part pas', () => {
  const g = app(s => { s.planets[0].gid = '33701'; });
  g.prioPose('b', 'colo', 'metal', 12);
  assert.ok(!('sy:prio' in g.syncOut()),
    'toute la liste reste à quai : envoyée sans elle, elle reviendrait effacée');
});

/* ---------- sauvegarde dans un fichier ---------- */

t("un fichier de sauvegarde se recharge tel qu'il a été écrit", () => {
  const g = app();
  const ecrit = JSON.stringify(g.S);
  g.S.planets = [];
  assert.ok(g.appliqueSauvegarde(ecrit), 'le texte vient du panneau lui-même');
  assert.equal(g.saved().planets.length, 2);
  assert.equal(g.saved().planets[0].name, 'Planète mère', 'rechargé veut dire enregistré');
});

t('« Enregistrer » écrit un save.json que le joueur place où il veut', () => {
  /* Le presse-papiers du panneau latéral échouait en silence : ce clic doit
     produire un fichier, et viser le dépôt plutôt que Téléchargements. */
  const s = fixtureState(); s.__tab = 'settings';
  const g = loadApp(s, SOIR, ['S'], null, true);
  g.click('ioSave');
  const f = g.telecharges()[0];
  assert.equal(f.filename, 'save.json');
  assert.ok(f.saveAs, 'sans la boîte de dialogue, le fichier n\'atteint pas le dépôt');
  assert.ok(/^blob:/.test(f.url));
  assert.ok(g.el('ioMsg').textContent, 'le panneau dit quoi faire du fichier');
  // « Charger » ouvre le sélecteur, et le fichier choisi est bien lu
  g.click('ioLoad');
  let lu = 0;
  const fichier = { text() { lu++; return new Promise(() => {}); } };
  (g.el('ioFile').on.change || []).forEach(fn => fn({ target: { files: [fichier], value: '' } }));
  assert.equal(lu, 1, 'le fichier choisi doit être lu');
});

t('« Réinitialiser » repart de l\'exemple et le panneau se redessine, sur chaque onglet', () => {
  /* sample() ne portait pas `timers` : le second clic enregistrait l'état
     neuf, puis le redessin levait dans renderTimers et le panneau restait
     figé jusqu'au rechargement. */
  for (const tab of ['today', 'empire', 'tools', 'settings']) {
    const s = fixtureState(); s.__tab = tab;
    const g = loadApp(s, SOIR, ['S']);
    g.click('ioReset');
    assert.equal(g.saved().planets.length, 2, tab + ' : le premier clic ne fait qu\'armer le bouton');
    assert.doesNotThrow(() => g.click('ioReset'), tab + ' : le redessin après réinitialisation');
    assert.equal(g.saved().planets.length, 1, tab + ' : l\'exemple n\'a qu\'une planète');
    assert.deepEqual(g.saved().timers, [], tab + ' : et aucun minuteur');
  }
});

t('un fichier qui n\'est pas une sauvegarde ne remplace rien', () => {
  const g = app();
  for (const txt of ['', 'pas du json', '{}', '{"planets":[]}', '{"settings":{}}'])
    assert.ok(!g.appliqueSauvegarde(txt), txt + ' ne devrait pas passer');
  assert.equal(g.S.planets.length, 2, 'l\'empire est resté en place');
});

t('un état venu d\'ailleurs ne peut pas porter de balisage', () => {
  /* Les champs des Réglages vérifient ce que le joueur tape, mais deux entrées
     les contournent : le fichier de sauvegarde et storage.sync. Les textes sont
     échappés à l'affichage ; ce qui restait à découvert, ce sont les champs tenus
     pour des nombres et donc interpolés bruts — le ratio, l'intervalle et les
     heures de nuit. */
  const g = app();
  const sain = JSON.parse(JSON.stringify(g.S));
  const piege = part => JSON.stringify(Object.assign({}, sain, part));
  const XSS = '<img src=x onerror=alert(1)>';

  // 1. le ratio, dans l'innerHTML de l'onglet Empire
  assert.ok(g.appliqueSauvegarde(piege({ settings: Object.assign({}, sain.settings, { ratio: [XSS, 2, 1] }) })),
    'le fichier reste une sauvegarde recevable : ce sont les champs seuls qui sont écartés');
  assert.deepEqual(g.saved().settings.ratio, [3, 2, 1], 'le ratio retombe sur sa valeur par défaut');
  g.VIEWS.planets(); g.REFRESH.planets();
  assert.ok(!/onerror/.test(g.html().empireMix || ''), 'rien n\'atteint l\'onglet Empire');

  // 2. l'intervalle et les heures de nuit, dans « Plan du jour » et les Réglages
  assert.ok(g.appliqueSauvegarde(piege({
    day: Object.assign({}, sain.day, { interval: XSS, nightStart: '"><b>x', nightEnd: {}, horizon: NaN, focus: XSS }),
  })));
  const d = g.saved().day;
  assert.equal(d.interval, 90, 'l\'intervalle retombe sur sa valeur par défaut');
  assert.equal(d.nightStart, 23, 'et l\'heure de début de nuit');
  assert.equal(d.nightEnd, 7, 'et celle de fin');
  assert.equal(d.horizon, 24, 'et l\'horizon');
  assert.equal(d.focus, 'equi', 'et la priorité, qui n\'est pas un nombre mais une clé connue');
  for(const h of [g.VIEWS.today(), g.VIEWS.settings()])
    assert.ok(!/onerror|"><b>/.test(h), 'ni « Plan du jour » ni les Réglages ne portent le balisage');

  // 3. storage.sync est l'autre chemin, et il ne passe pas par appliqueSauvegarde
  g.syncApply({ 'sy:day': Object.assign({}, sain.day, { nightStart: XSS }) });
  assert.equal(g.saved().day.nightStart, 23, 'l\'état reçu en synchro est écarté aussi');

  // 4. et ce que les menus des Réglages proposent traverse toujours
  assert.ok(g.appliqueSauvegarde(piege({
    settings: Object.assign({}, sain.settings, { ratio: [2, 1, 1] }),
    day: Object.assign({}, sain.day, { interval: 180, nightStart: 0, nightEnd: 6, horizon: 48, focus: 'fleet' }),
  })));
  assert.deepEqual(g.saved().settings.ratio, [2, 1, 1], 'trois nombres > 0 passent');
  assert.deepEqual(
    [g.saved().day.interval, g.saved().day.nightStart, g.saved().day.nightEnd, g.saved().day.horizon, g.saved().day.focus],
    [180, 0, 6, 48, 'fleet'], 'et les valeurs que les menus offrent ne sont pas rabotées');
});

t('aucun champ numérique d\'une sauvegarde n\'atteint un gabarit tel quel', () => {
  /* Une quarantaine d'attributs interpolent l'état sans `esc`, parce que le
     champ est tenu pour un nombre : `value`, `min`, `data-*`. `num()` est leur
     `esc()`. On vérifie qu'aucun attribut ne se referme trop tôt — le texte
     « onerror », lui, peut rester : échappé, il n'est qu'un mot. */
  const g = app();
  const sain = JSON.parse(JSON.stringify(g.S));
  const XSS = '"><img src=x onerror=alert(1)>';
  const piege = JSON.parse(JSON.stringify(sain));
  piege.tech[Object.keys(piege.tech)[0]] = XSS;
  Object.assign(piege.planets[0], { tmax: XSS, sats: XSS });
  piege.planets[0].b.metal = XSS;
  piege.raid = { coords: '1:1:1', m: XSS, c: XSS, d: XSS };
  piege.fleetCalc.ships.sc = XSS;
  piege.colo.bonus = XSS;
  piege.prio = [{ kind: 'b', pid: sain.planets[0].id, k: 'metal', lvl: XSS }];

  assert.ok(g.appliqueSauvegarde(JSON.stringify(piege)), 'le fichier reste recevable');
  for(const v of ['planets', 'research', 'settings', 'today', 'tools', 'fleet', 'moon'])
    assert.ok(!/"><img/.test(g.VIEWS[v]()), v + ' referme un attribut trop tôt');
  // et le champ montre un nombre, pas une chaîne vide ni « NaN »
  assert.match(g.VIEWS.planets(), /data-p="tmax" value="0"/);
  assert.match(g.VIEWS.research(), /data-t="energy" value="0"/);
});

t('une sauvegarde dont les identifiants sont truqués est refusée', () => {
  /* L'identifiant part dans une quinzaine d'attributs sans `esc`. Le réécrire
     obligerait à suivre le centre, la colonie, les priorités et les minuteurs
     qui le citent : le fichier est refusé en entier. */
  const g = app();
  const sain = JSON.parse(JSON.stringify(g.S));
  const XSS = '"><img src=x onerror=alert(1)>';

  const truque = JSON.parse(JSON.stringify(sain));
  truque.planets[0].id = XSS;
  assert.ok(!g.appliqueSauvegarde(JSON.stringify(truque)), 'planète truquée : refusée');

  const tmTruque = JSON.parse(JSON.stringify(sain));
  tmTruque.timers = [{ id: XSS, end: Date.now(), done: false }];
  assert.ok(!g.appliqueSauvegarde(JSON.stringify(tmTruque)), 'minuteur truqué : refusé');
  assert.equal(g.S.planets.length, 2, 'l\'empire est resté en place');

  // une sauvegarde d'avant les identifiants reste recevable, et reçoit les siens
  const vieille = JSON.parse(JSON.stringify(sain));
  vieille.planets.forEach(q => delete q.id);
  assert.ok(g.appliqueSauvegarde(JSON.stringify(vieille)), 'celle-là passe');
  assert.ok(g.saved().planets.every(q => /^[a-z0-9]{1,24}$/i.test(q.id)),
    'chaque planète repart avec un jeton : sinon tout l\'onglet s\'affiche en pn-undefined');
});

/* ---------- le tir de lune : les tables ---------- */

/** Coût et bouclier de base, relus sur ogame.fandom.com/wiki/Ships le
    24 novembre 2026. La coque n'y figure pas parce qu'elle n'a pas à y être :
    elle vaut métal + cristal, ce que les seize lignes du wiki vérifient sans
    une exception. */
const WIKI_VAISSEAUX = {
  sc:  { c: [2000, 2000, 0],        bou: 10 },
  lc:  { c: [6000, 6000, 0],        bou: 25 },
  pf:  { c: [8000, 15000, 8000],    bou: 100 },
  lf:  { c: [3000, 1000, 0],        bou: 10 },
  hf:  { c: [6000, 4000, 0],        bou: 25 },
  cr:  { c: [20000, 7000, 2000],    bou: 50 },
  bs:  { c: [45000, 15000, 0],      bou: 200 },
  bc:  { c: [30000, 40000, 15000],  bou: 400 },
  bb:  { c: [50000, 25000, 15000],  bou: 500 },
  ds:  { c: [60000, 50000, 15000],  bou: 500 },
  rp:  { c: [85000, 55000, 20000],  bou: 700 },
  rec: { c: [10000, 6000, 2000],    bou: 10 },
  col: { c: [10000, 20000, 10000],  bou: 100 },
  pr:  { c: [0, 1000, 0],           bou: 0.01 },
};

t('les quatorze vaisseaux ont le coût et le bouclier du wiki', () => {
  const g = app();
  assert.deepEqual(Object.keys(g.SHIPS).sort(), Object.keys(WIKI_VAISSEAUX).sort());
  for (const [k, w] of Object.entries(WIKI_VAISSEAUX)) {
    assert.deepEqual(g.SHIP_COST[k], w.c, 'coût de ' + k);
    assert.equal(g.SHIPS[k].bou, w.bou, 'bouclier de ' + k);
  }
});

t('le vaisseau de colonisation recoupe COL_SHIP_COST', () => {
  const g = app();
  assert.deepEqual(g.SHIP_COST.col, g.COL_SHIP_COST);
});

t('les huit attaques de défense sont celles de la revue', () => {
  const g = app();
  assert.deepEqual(['rl', 'll', 'hl', 'ic', 'gc', 'pt', 'sd', 'ld'].map(k => g.DEF[k].a),
    [80, 100, 250, 150, 1100, 3000, 1, 1]);
});

t('la coque d\'une pièce de défense vaut son métal plus son cristal', () => {
  const g = app();
  assert.deepEqual(['rl', 'll', 'hl', 'ic', 'gc', 'pt', 'sd', 'ld'].map(k => g.DEF[k].c[0] + g.DEF[k].c[1]),
    [2000, 2000, 8000, 8000, 35000, 100000, 20000, 100000]);
});

/* ---------- le tir de lune : l'arithmétique ---------- */

/** Le tableau « Probability of moon formation from ship debris » de
    ogame.fandom.com/wiki/Moon, colonnes 1 % et 20 %, relu le 24 novembre 2026.
    C'est la même fonction prouvée par une source extérieure.

    Deux cellules de ce tableau se contredisent avec celui de /wiki/Moonchance,
    qui dit 248 croiseurs et 90 bombardiers : 247 et 89 sont les plafonds
    exacts (247 × 8 100 = 2 000 700, déjà au-dessus de 2 M), Moonchance arrondit
    vers le haut. Et la ligne du chasseur léger de /wiki/Moon porte deux coquilles
    à 2 % et 16 % (166 et 1 337, là où le petit transporteur de même coque dit
    167 et 1 334) — d'où les colonnes 1 % et 20 % seules, où tout concorde. */
const WIKI_LUNE = {
  sc: [84, 1667], lc: [28, 556], lf: [84, 1667], hf: [34, 667],
  cr: [13, 247], bs: [6, 112], col: [12, 223], rec: [21, 417],
  pr: [334, 6667], bb: [5, 89], ds: [4, 61], bc: [5, 96],
};

t('le nombre de vaisseaux par chance est celui du tableau du wiki', () => {
  const g = app();
  for (const [k, [un, vingt]] of Object.entries(WIKI_LUNE)) {
    assert.equal(g.luneVaisseaux(k, 1, 30), un, k + ' à 1 %');
    assert.equal(g.luneVaisseaux(k, 20, 30), vingt, k + ' à 20 %');
  }
});

/** « Amt. for a 30/40/50/60/70 % DF » de /wiki/Moonchance : le taux de débris
    est un réglage d'univers, et le wiki en donne cinq. */
const WIKI_DF = {
  lf: { 30: 1667, 40: 1250, 50: 1000, 60: 834, 70: 715 },
  bs: { 30: 112, 40: 84, 50: 67, 60: 56, 70: 48 },
  pr: { 30: 6667, 40: 5000, 50: 4000, 60: 3334, 70: 2858 },
};

t('le taux de débris de l\'univers change le nombre de vaisseaux', () => {
  const g = app();
  for (const [k, par] of Object.entries(WIKI_DF))
    for (const [df, n] of Object.entries(par))
      assert.equal(g.luneVaisseaux(k, 20, +df), n, k + ' à 20 % sur un univers ' + df + ' %');
});

t('le taux de débris vaut 30 % quand on ne le dit pas', () => {
  const g = app();
  assert.equal(g.luneVaisseaux('lf', 20), 1667);
  assert.equal(g.luneTir('lf', 1000).debris, 1200000);
});

t('mille chasseurs légers font 1,2 M de débris et 12 % de chance', () => {
  const g = app(), r = g.luneTir('lf', 1000, 30);
  assert.equal(r.v, 4000);
  assert.equal(r.debris, 1200000);
  assert.equal(r.chance, 12);
});

t('sous 100 000 de débris, la chance est nulle', () => {
  const g = app();
  assert.equal(g.luneTir('lf', 83, 30).debris, 99600);
  assert.equal(g.luneTir('lf', 83, 30).chance, 0);
  assert.ok(g.luneTir('lf', 84, 30).chance > 1);
});

t('la chance plafonne à 20 %', () => {
  assert.equal(app().luneTir('lf', 2000, 30).chance, 20);
});

t('la chance par ressource dépensée est la même à 100 000 et à 2 M', () => {
  const g = app();
  const par = n => g.luneTir('lf', n, 30).chance / (n * 4000);
  assert.ok(Math.abs(par(84) - par(1666)) < 1e-12);
});

t('une chance visée hors bornes est ramenée dans les bornes', () => {
  const g = app();
  assert.equal(g.luneVaisseaux('lf', 50, 30), g.luneVaisseaux('lf', 20, 30));
  assert.equal(g.luneVaisseaux('lf', 0, 30), g.luneVaisseaux('lf', 1, 30));
});

t('la facture espérée compte les tirs et ce que le recyclage rend', () => {
  const g = app(), f = g.luneFacture('lf', 1000, 30);
  assert.equal(f.chance, 12);
  assert.equal(f.tirs, 9);
  assert.equal(f.m, 9 * 1000 * 3000);
  assert.equal(f.c, 9 * 1000 * 1000);
  assert.equal(f.recupere, 8 * 1200000);
});

t('un vaisseau sans coût ne sort ni débris ni NaN', () => {
  const g = app();
  assert.equal(g.luneTir('inconnu', 100, 30).debris, 0);
  assert.equal(g.luneTir('inconnu', 100, 30).chance, 0);
  assert.equal(g.luneVaisseaux('inconnu', 20, 30), 0);
  assert.equal(g.luneFacture('inconnu', 100, 30), null);
});

t('une chance nulle ne donne pas de facture', () => {
  assert.equal(app().luneFacture('lf', 83, 30), null);
});

/* ---------- le tir de lune : ce que la défense tue ---------- */

/** La défense du HQ au relevé du 24 novembre 2026, et Armes 8.
    Les tâches suivantes réemploient cette fixture. */
const HQ = s => {
  s.planets[0].defs = { rl: 3077, ll: 511, hl: 351, ic: 213, gc: 51, pt: 11, sd: 1, ld: 1 };
  s.tech.weapons = 8;
};

t('la défense du HQ tue environ un millier de chasseurs légers', () => {
  const g = app(HQ), d = g.luneDefense(g.S.planets[0], 'lf', 0);
  assert.equal(d.tirs, 4216, 'les huit pièces tirent, boucliers compris');
  assert.ok(d.puissance > 700000 && d.puissance < 715000, 'puissance : ' + d.puissance);
  assert.ok(d.tue / 4000 > 950 && d.tue / 4000 < 1050, 'chasseurs tués : ' + d.tue / 4000);
});

t('le niveau de Bouclier du camarade baisse ce qui est tué', () => {
  const g = app(HQ), p = g.S.planets[0];
  assert.ok(g.luneDefense(p, 'lf', 8).tue < g.luneDefense(p, 'lf', 0).tue);
});

t('la Technologie Armes monte ce que la défense tue', () => {
  const sans = app(s => { HQ(s); s.tech.weapons = 0; });
  const avec = app(HQ);
  assert.ok(avec.luneDefense(avec.S.planets[0], 'lf', 0).puissance
          > sans.luneDefense(sans.S.planets[0], 'lf', 0).puissance);
});

t('une défense jamais relevée ne rend aucun verdict', () => {
  const g = app(s => { HQ(s); s.planets[0].defs = null; });
  assert.equal(g.luneDefense(g.S.planets[0], 'lf', 0), null);
});

t('une défense rasée rend un verdict franc, pas un inconnu', () => {
  const g = app(s => { HQ(s); s.planets[0].defs = {}; });
  const d = g.luneDefense(g.S.planets[0], 'lf', 0);
  assert.notEqual(d, null, 'relevée et vide, ce n\'est pas inconnu');
  assert.equal(d.tue, 0);
  assert.equal(d.tirs, 0);
});

t('une clé inconnue dans la défense ne compte pour rien', () => {
  const g = app(s => { HQ(s); s.planets[0].defs = { rl: 10, __proto__: 5, zz: 99 }; });
  const d = g.luneDefense(g.S.planets[0], 'lf', 0);
  assert.equal(d.tirs, 10);
});

/* ---------- le tir de lune : la carte ---------- */

/** Le HQ, l'onglet Lune ouvert, et un tir de mille chasseurs légers. */
const LUNE = s => {
  HQ(s);
  s.ui.tool = 'moon';
  s.moonCalc = { pid: s.planets[0].id, ship: 'lf', n: 1000, bou: 0, viser: 12 };
};

t('l\'onglet Lune est dans la barre d\'Outils', () => {
  assert.ok(/Lune/.test(lu(app(LUNE).VIEWS.tools())));
});

t('la carte sort les débris, la chance et ce que la défense tue', () => {
  const g = app(LUNE);
  g.REFRESH.moon();
  const out = lu(g.html().moonOut || '');
  assert.ok(/1,20 M/.test(out), 'les débris : ' + out);
  assert.ok(/12 %/.test(out), 'la chance : ' + out);
  assert.ok(/999/.test(out), 'ce que la défense tue : ' + out);
  assert.ok(/chasseurs légers/i.test(out), 'le vaisseau visé est nommé : ' + out);
});

t('sans vaisseau, la carte ne sort aucun chiffre et le dit', () => {
  const g = app(s => { LUNE(s); s.moonCalc.n = 0; });
  g.REFRESH.moon();
  const out = lu(g.html().moonOut || '');
  assert.ok(/combien/i.test(out), out);
  assert.ok(!/%/.test(out), 'aucune chance annoncée : ' + out);
});

t('une défense jamais relevée se dit inconnue, pas nulle', () => {
  const g = app(s => { LUNE(s); s.planets[0].defs = null; });
  g.REFRESH.moon();
  const out = lu(g.html().moonOut || '');
  assert.ok(/jamais relevée/i.test(out), out);
  assert.ok(!/\b0 chasseurs/.test(out), 'pas de zéro inventé : ' + out);
});

t('le niveau de Bouclier proposé est celui du joueur', () => {
  const g = app(s => { LUNE(s); s.moonCalc.bou = null; s.tech.shielding = 8; });
  assert.ok(/value="8"/.test(g.VIEWS.moon()), g.VIEWS.moon().slice(0, 600));
});

t('les voyages de recycleur ne sortent que s\'il y a des recycleurs', () => {
  const avec = app(s => { LUNE(s); s.planets[0].ships = { rec: 31 }; });
  avec.REFRESH.moon();
  assert.ok(/voyage/i.test(lu(avec.html().moonOut || '')), 'avec 31 recycleurs');
  const sans = app(s => { LUNE(s); s.planets[0].ships = {}; });
  sans.REFRESH.moon();
  assert.ok(!/voyage/i.test(lu(sans.html().moonOut || '')), 'sans recycleur');
});

/* ---------- le tir de lune : les avertissements ---------- */

t('la flotte au sol est chiffrée pour l\'avertissement', () => {
  const g = app(s => { LUNE(s); s.planets[0].ships = { lf: 240, hf: 538 }; });
  assert.deepEqual(g.luneFlotteAuSol(g.S.planets[0]),
    { m: 240 * 3000 + 538 * 6000, c: 240 * 1000 + 538 * 4000 });
});

t('une flotte jamais relevée n\'invente pas un zéro', () => {
  const g = app(s => { LUNE(s); delete s.planets[0].ships; });
  assert.equal(g.luneFlotteAuSol(g.S.planets[0]), null);
});

t('la carte avertit sous le plancher et pour la flotte au sol', () => {
  const g = app(s => { LUNE(s); s.moonCalc.n = 83; s.planets[0].ships = { hf: 538 }; });
  g.REFRESH.moon();
  const note = lu(g.html().moonNote || '');
  assert.ok(/100 000/.test(note), 'le plancher : ' + note);
  assert.ok(/538/.test(note), 'la flotte au sol : ' + note);
  assert.ok(/Estimation/.test(note), 'l\'estimation est nommée : ' + note);
  assert.ok(/ne connaît pas les lunes/.test(note), 'la lune déjà là : ' + note);
});

t('au-dessus du plafond, la carte dit ce qui est perdu', () => {
  /* Défense jamais relevée : tout meurt, donc 3 000 chasseurs dépassent les
     2 M. Avec la défense du HQ, elle n'en tuerait que mille et le surplus
     n'existerait pas — c'est ce que vérifie « ce qui meurt » plus bas. */
  const g = app(s => { LUNE(s); s.moonCalc.n = 3000; s.planets[0].defs = null; });
  g.REFRESH.moon();
  const note = lu(g.html().moonNote || '');
  assert.ok(/perdu/.test(note), note);
  assert.ok(/667 morts suffisent/.test(note), 'le nombre qui suffit : ' + note);
});

t('sans flotte relevée, aucun avertissement de flotte au sol', () => {
  const g = app(s => { LUNE(s); delete s.planets[0].ships; });
  g.REFRESH.moon();
  assert.ok(!/à ta charge/.test(lu(g.html().moonNote || '')));
});

t('la note porte la règle de pushing et la facture espérée', () => {
  const g = app(LUNE);
  g.REFRESH.moon();
  const note = lu(g.html().moonNote || '');
  assert.ok(/pushing/i.test(note), 'la règle du jeu : ' + note);
  assert.ok(/Game Operator/.test(note), 'qui prévenir : ' + note);
  assert.ok(/9 tirs/.test(note), 'la facture espérée : ' + note);
});

/* ---------- le tir de lune : ce qui meurt, et rien de plus ---------- */

t('la chance se calcule sur ce qui meurt, pas sur ce qu\'il envoie', () => {
  /* 1 667 chasseurs légers, le nombre qu'il faut pour 20 % si tout meurt :
     la défense du HQ n'en tue qu'un millier, donc le tir vaut 12 %, pas 20 %. */
  const g = app(s => { LUNE(s); s.moonCalc.n = 1667; });
  g.REFRESH.moon();
  const out = lu(g.html().moonOut || '');
  assert.ok(/1,20 M/.test(out), 'les débris de ce qui meurt : ' + out);
  assert.ok(!/2,00 M/.test(out), 'pas ceux de ce qui part : ' + out);
  assert.ok(/12 %/.test(out), 'la chance réelle : ' + out);
});

t('une défense rasée ne promet aucune chance', () => {
  const g = app(s => { LUNE(s); s.planets[0].defs = {}; });
  g.REFRESH.moon();
  assert.ok(/0 %/.test(lu(g.html().moonOut || '')), 'aucune chance');
  const note = lu(g.html().moonNote || '');
  assert.ok(!/Facture/.test(note), 'aucune facture : ' + note);
  assert.ok(/n\'en tue aucun/.test(note), 'et la carte le dit : ' + note);
});

t('la carte dit quand la défense plafonne la chance visée', () => {
  const g = app(s => { LUNE(s); s.moonCalc.n = 1667; s.moonCalc.viser = 20; });
  g.REFRESH.moon();
  assert.ok(/plafonne/.test(lu(g.html().moonNote || '')), lu(g.html().moonNote || ''));
});

t('une défense jamais relevée suppose que tout meurt', () => {
  const g = app(s => { LUNE(s); s.planets[0].defs = null; });
  g.REFRESH.moon();
  assert.ok(/12 %/.test(lu(g.html().moonOut || '')));
});

t('la vieille forme p.def suffit à rendre un verdict de défense', () => {
  const g = app(s => { LUNE(s); delete s.planets[0].defs; s.planets[0].def = 4216; });
  assert.notEqual(g.luneDefense(g.S.planets[0], 'lf', 0), null,
    'defsOf sait lire p.def seul, luneDefense doit passer par lui');
});

t('sans vaisseau, la note se vide aussi', () => {
  const g = app(LUNE);
  g.REFRESH.moon();
  assert.ok(/Facture/.test(lu(g.html().moonNote || '')), 'posée une première fois');
  g.S.moonCalc.n = 0;
  g.REFRESH.moon();
  assert.ok(!/Facture/.test(lu(g.html().moonNote || '')), 'le tir d\'avant ne reste pas');
});

t('la règle de pushing est dite dans le bon sens', () => {
  const g = app(LUNE);
  g.REFRESH.moon();
  const note = lu(g.html().moonNote || '');
  assert.ok(/mieux classé/.test(note), note);
  assert.ok(/pushing/i.test(note) && /Game Operator/.test(note), note);
  assert.ok(!/renvoyer/.test(note), 'le risque est de ramasser, pas de renvoyer : ' + note);
});

t('la facture se dit moyenne, pas promesse', () => {
  const g = app(LUNE);
  g.REFRESH.moon();
  assert.ok(/moyenne, pas une promesse/.test(lu(g.html().moonNote || '')));
});

t('la facture compte le deutérium des coques qui en coûtent', () => {
  const g = app(), f = g.luneFacture('rp', 30, 30);
  assert.equal(f.deut, f.tirs * 30 * 20000);
  assert.equal(g.luneFacture('lf', 1000, 30).deut, 0);
});

t('le plancher exclut 100 000 pile, comme la règle le dit', () => {
  const g = app();
  assert.equal(g.luneTir('lf', 50, 50).debris, 100000);
  assert.equal(g.luneTir('lf', 50, 50).chance, 0, '« more than 100k debris »');
  assert.equal(g.luneVaisseaux('lf', 1, 50), 51, 'un vaisseau de plus pour dépasser');
});

t('le plafond inclut 2 M pile, comme le tableau du wiki', () => {
  const g = app();
  assert.equal(g.luneTir('pr', 5000, 40).debris, 2000000);
  assert.equal(g.luneTir('pr', 5000, 40).chance, 20);
  assert.equal(g.luneVaisseaux('pr', 20, 40), 5000);
});

t('une chance visée décimale est arrondie une seule fois', () => {
  const g = app(s => { LUNE(s); s.moonCalc.viser = 12.5; });
  g.REFRESH.moon();
  const out = lu(g.html().moonOut || '');
  assert.ok(/Pour 13 %/.test(out), 'ce qui est annoncé : ' + out);
  assert.ok(/084/.test(out), 'et le nombre qui va avec : ' + out);
});

t('un nom de planète hostile ne s\'exécute pas dans l\'avertissement', () => {
  const g = app(s => { LUNE(s); s.planets[0].name = '<b>HQ</b>'; s.planets[0].ships = { hf: 538 }; });
  g.REFRESH.moon();
  const brut = g.html().moonNote || '';
  assert.ok(/&lt;b&gt;HQ&lt;\/b&gt;/.test(brut), 'échappé comme ailleurs : ' + brut);
});

/* ---------- le tir de lune : le rangement d'après revue ---------- */

t('le taux de débris est un réglage d\'univers, donc il se synchronise', () => {
  const g = app(s => { LUNE(s); s.settings.debris = 50; });
  assert.equal(g.syncOut()['sy:settings'].debris, 50, 'il part vers l\'autre poste');
  g.REFRESH.moon();
  const out = lu(g.html().moonOut || '');
  assert.ok(/2,00 M/.test(out), 'la carte le lit : ' + out);
  assert.ok(!/1,20 M/.test(out), 'et pas les 30 % par défaut : ' + out);
});

t('le coût du vaisseau de colonisation n\'a qu\'une source', () => {
  const g = app();
  assert.strictEqual(g.SHIP_COST.col, g.COL_SHIP_COST, 'la même table, pas une copie');
});

t('l\'avertissement de flotte dit de quand date le relevé', () => {
  const g = app(s => { LUNE(s); s.planets[0].ships = { hf: 538 };
    s.planets[0].shipsAt = Date.now() - 3 * 24 * 3600e3; });
  g.REFRESH.moon();
  assert.ok(/relevée il y a/.test(lu(g.html().moonNote || '')), lu(g.html().moonNote || ''));
});

t('une flotte jamais datée ne se vieillit pas', () => {
  const g = app(s => { LUNE(s); s.planets[0].ships = { hf: 538 }; s.planets[0].shipsAt = 0; });
  g.REFRESH.moon();
  assert.ok(!/relevée il y a/.test(lu(g.html().moonNote || '')));
});

t('les recycleurs se ramènent après le tir, pas avant', () => {
  const g = app(s => { LUNE(s); s.planets[0].ships = { rec: 31 }; });
  g.REFRESH.moon();
  assert.ok(/après le tir/.test(lu(g.html().moonOut || '')), lu(g.html().moonOut || ''));
});

/* Un Oui/Non est une bascule : le select revenu en douce reprendrait deux
   lignes et un clic de plus, et la poignée lit `checked`, pas `value`. */
t('les réglages Oui/Non sont des bascules cochées selon le réglage', () => {
  const h = app(s => { s.settings.geo = true; s.settings.lean = false; }).VIEWS.settings();
  assert.ok(!/>Oui</.test(h), 'plus aucune liste Oui/Non');
  assert.match(h, /id="sGeo" data-set="geo" checked/);
  assert.match(h, /id="sLean" data-set="lean" >/);
  assert.match(app().VIEWS.fleet(), /id="expoPf" data-expo="pf" checked/);
});

/* L'habillage se pose sur <html>, pas dans une vue : aucune vue n'a à le
   connaître, et c'est ce qui le fait valoir pour toutes les pages. Un état
   d'avant le réglage — ou une peau inconnue — retombe sur Relief. */
t("l'habillage et la page courante se posent sur <html>", () => {
  const g = app(s => { s.__tab = 'empire'; });
  g.header();
  assert.equal(g.racine().dataset.skin, 'relief');
  assert.equal(g.racine().dataset.page, 'empire');

  const h = app(s => { s.settings.skin = 'hud'; s.__tab = 'settings'; });
  h.header();
  assert.equal(h.racine().dataset.skin, 'hud');
  assert.equal(h.racine().dataset.page, 'settings');
  assert.match(h.VIEWS.settings(), /<select id="sSkin" data-set="skin">/);
  assert.match(h.VIEWS.settings(), /value="hud" selected/);

  const x = app(s => { s.settings.skin = 'nimportequoi'; });
  x.header();
  assert.equal(x.racine().dataset.skin, 'relief');
});

require('./serveur.test')({ t, assert, app, lu, SOIR });

/* ---------- la question du coucher, et l'absence de jour ---------- */

/** 10 h du matin : en plein jour, hors de la fenêtre de nuit 23 h – 7 h. */
const MATIN = new Date(2026, 10, 8, 10, 0, 0).getTime();
/** 22 h : une heure avant la nuit, l'instant où la question se pose. */
const AVANT = new Date(2026, 10, 8, 22, 0, 0).getTime();

t('la nuit finie, le retour reste la fin de la nuit', () => {
  const g = app(null, SOIR);
  assert.equal(g.wakeTime(SOIR), REVEIL, 'le soir, on rentre au matin');
  assert.equal(g.absenceJour(SOIR), false, 'mode nuit éteint : aucune absence');
});

t('mode nuit lancé le matin : la flotte rentre à l\'heure de retour donnée', () => {
  const g = app(s => { s.day.night = true; s.day.backHour = 19; }, MATIN);
  assert.ok(g.absenceJour(MATIN), 'hors de la fenêtre de nuit, c\'est une absence');
  assert.equal(g.wakeTime(MATIN), new Date(2026, 10, 8, 19, 0, 0).getTime());
});

t('absence sans heure de retour : une nuit de durée, pas le matin suivant', () => {
  const g = app(s => { s.day.night = true; }, MATIN);
  assert.equal(g.nightLen(), 8, 'la fenêtre 23 h – 7 h fait huit heures');
  assert.equal(g.wakeTime(MATIN), MATIN + 8 * 3600e3, '18 h, pas 7 h demain');
});

t('une heure de retour déjà passée vise le lendemain', () => {
  const g = app(s => { s.day.night = true; s.day.backHour = 9; }, MATIN);
  assert.equal(g.wakeTime(MATIN), new Date(2026, 10, 9, 9, 0, 0).getTime());
});

/* C'est le trou que l'absence de jour vient boucher : à 10 h, `wake` tombait au
   lendemain 7 h, et fsFor() ne gardait que des vols de vingt-deux heures. */
t('sans coffre-fort, un Transport de nuit ne pose sa cargaison qu\'après le réveil', () => {
  const g = app(s => { loin(s); s.planets[0].ships = { lc: 30 }; });
  const fs = g.fleetsavePlan(SOIR);
  assert.equal(fs.mission, 'transport');
  assert.ok(fs.arrive > REVEIL && fs.back > fs.arrive);
  const n = g.dailyMissions().find(m => m.id === 'night');
  assert.ok(n.how.some(x => /Mission <b>Transport<\/b>/.test(x) && /phalange/.test(x)), 'la carte dit Transport et sa limite');
});

t('une absence de jour propose une mise à l\'abri qui rentre dans la journée', () => {
  // vers un coffre-fort, seul le retour de la flotte doit suivre celui du joueur
  const g = app(s => { loin(s); s.planets[0].ships = { lc: 30, sc: 6 }; s.day.night = true; s.day.backHour = 19; s.settings.secu = { vaults: ['colo'] }; }, MATIN);
  const fs = g.fleetsavePlan(MATIN);
  assert.ok(fs, 'un plan est proposé');
  assert.equal(fs.mission, 'transport');
  assert.ok(fs.back > g.wakeTime(MATIN), 'la flotte rentre après le retour du joueur');
  assert.ok(fs.back < MATIN + 15 * 3600e3, 'et pas le lendemain matin');
});

t('la carte nomme le retour, pas le coucher, quand c\'est une absence', () => {
  const g = app(s => { loin(s); s.planets[0].ships = { lc: 30, sc: 6 }; s.day.night = true; s.day.backHour = 19; }, MATIN);
  const w = g.dailyMissions().find(m => m.id === 'night').what;
  assert.ok(/^Absence jusqu'à 19 h/.test(w), w);
  assert.ok(!/Avant la nuit/.test(w), 'à 10 h du matin, « avant la nuit » ne veut rien dire');
});

t('sans heure donnée, la carte dit dans combien de temps elle croit le retour', () => {
  const g = app(s => { loin(s); s.planets[0].ships = { lc: 30, sc: 6 }; s.day.night = true; }, MATIN);
  const w = g.dailyMissions().find(m => m.id === 'night').what;
  assert.ok(/^Absence de 8 h/.test(w), w);
});

t('appelée dans la nuit, elle vise le matin qui vient, pas celui d\'après', () => {
  const minuit = new Date(2026, 10, 9, 0, 30, 0).getTime();
  const g = app(s => { s.day.night = true; }, minuit);
  assert.equal(g.absenceJour(minuit), false, 'minuit et demi, c\'est la nuit, pas une absence');
  assert.equal(g.wakeTime(minuit), new Date(2026, 10, 9, 7, 0, 0).getTime(), 'sept heures, pas trente');
});

t('à 22 h, « oui » veut dire « je vais dormir », pas « je m\'absente 8 h »', () => {
  const g = app(s => { s.day.night = true; }, AVANT);
  assert.equal(g.absenceJour(AVANT), false, 'le coucher est à une heure : c\'est un coucher');
  assert.equal(g.wakeTime(AVANT), REVEIL, 'fin de nuit, pas 6 h du matin');
});

/* ---------- le plan revient tout seul ---------- */

t('allumée le soir, la mise à l\'abri se donne la fin de nuit pour terme', () => {
  const g = app(null, AVANT, null, true);
  g.modeNuit(true);
  assert.equal(g.S.day.until, REVEIL, 'elle vaut jusqu\'à sept heures');
});

t('allumée le matin sans heure de retour, elle vaut une nuit', () => {
  const g = app(null, MATIN);
  g.modeNuit(true);
  assert.equal(g.S.day.until, MATIN + 8 * 3600e3);
});

t('l\'heure de retour donnée fixe le terme, et la déplacer le déplace', () => {
  const g = app(s => { s.day.night = true; s.day.backHour = 19; }, MATIN);
  g.modeNuit(true);
  assert.equal(g.S.day.until, new Date(2026, 10, 8, 19, 0, 0).getTime());
  g.S.day.backHour = 15; g.modeNuit(true);
  assert.equal(g.S.day.until, new Date(2026, 10, 8, 15, 0, 0).getTime(), 'le terme suit le retour');
});

t('avant le terme, rien ne bouge', () => {
  const g = app(s => { s.day.night = true; s.day.until = MATIN + 60e3; }, MATIN);
  assert.equal(g.finDeNuit(), false);
  assert.equal(g.S.day.night, true, 'le plan reste en veille');
});

/* Le panneau appelle finDeNuit() en se chargeant : le joueur qui l'ouvre après
   son réveil retrouve son plan sans avoir rien à cliquer. */
t('le terme passé, le mode jour revient au chargement, sans un clic', () => {
  const g = app(s => { s.day.night = true; s.day.backHour = 9; s.day.until = MATIN; }, MATIN);
  assert.equal(g.S.day.night, false, 'le plan est revenu');
  assert.equal(g.S.day.until, 0);
  assert.equal(g.S.day.backHour, null, 'elle appartenait à cette absence-là');
  assert.equal(g.saved().day.night, false, 'et c\'est enregistré');
});

t('éteindre à la main efface le terme comme l\'heure de retour', () => {
  const g = app(s => { s.day.night = true; s.day.backHour = 19; s.day.until = MATIN + 3600e3; }, MATIN);
  g.modeNuit(false);
  assert.equal(g.S.day.until, 0);
  assert.equal(g.S.day.backHour, null);
});

/* Le mode nuit traverse la nuit allumé : c'est au matin que le terme tombe, et
   le battement de trente secondes est le seul à repasser par là. */
t('une veille d\'avant le terme reçoit le sien au lieu de durer toujours', () => {
  const g = app(s => { s.day.night = true; delete s.day.until; }, AVANT);
  assert.equal(g.finDeNuit(), false, 'on ne l\'éteint pas sur un champ manquant');
  assert.equal(g.S.day.until, REVEIL, 'on lui donne son terme');
  assert.equal(g.saved().day.until, REVEIL);
});

t('un terme truqué par une synchro ne fige pas le plan en veille', () => {
  const g = app();
  g.S.day.until = '"><b>x';
  g.syncApply({ 'sy:day': g.S.day });
  assert.equal(g.S.day.until, 0);
});

t('l\'heure de retour n\'accepte qu\'une heure, et le vide vaut « aucune »', () => {
  const g = app();
  assert.equal(g.dayValue('backHour', '19', null), 19);
  assert.equal(g.dayValue('backHour', '0', null), 0, 'minuit est une heure');
  assert.equal(g.dayValue('backHour', '', 19), null, 'vidé, le champ n\'impose plus rien');
  assert.equal(g.dayValue('backHour', '24', null), null, 'hors des heures du jour');
  assert.equal(g.dayValue('backHour', '"><b>x', null), null, 'et rien qui vienne baliser un gabarit');
  assert.equal(g.dayValue('night', '1', false), true);
  assert.equal(g.dayValue('night', '0', true), false);
});

t('une heure de retour truquée par une synchro est refusée à l\'entrée', () => {
  const g = app();
  g.S.day.backHour = '"><b>x';
  g.syncApply({ 'sy:day': g.S.day });
  assert.equal(g.S.day.backHour, null);
});

/* ---------- la page Empire se lit d'un coup d'œil ---------- */

t('chaque planète est une carte repliée qui porte son nom et ses coordonnées', () => {
  const h = lu(app().VIEWS.planets());
  assert.ok(/<details class="card ligne"[^>]*data-pi="0"/.test(h), h.slice(0, 600));
  assert.ok(/data-fold="pl:/.test(h), 'le repli se souvient, par planète');
});

t('les cartes de planète partent fermées, même sans clé de repli en mémoire', () => {
  const h = app(s => { s.ui.fold = {}; }).VIEWS.planets();
  assert.ok(/<details class="card ligne"/.test(h), 'encore faut-il que la carte soit un volet');
  assert.ok(!/<details class="card ligne"[^>]* open/.test(h));
});

t('le résumé porte la production des trois ressources, sans rien déplier', () => {
  const g = app();
  g.VIEWS.planets(); g.REFRESH.planets();
  const s = lu(g.html()['psum-0'] || '');
  const pr = g.production(g.S.planets[0]);
  assert.ok(s.includes(g.fmtLigne(pr.m)) && s.includes(g.fmtLigne(pr.c)) && s.includes(g.fmtLigne(pr.d)), s);
});

t('le bouton Retirer est dans le corps, pas dans le résumé qui bascule le volet', () => {
  const h = lu(app().VIEWS.planets());
  const d = h.indexOf('<summary data-fold="pl:');
  assert.ok(d > -1, 'encore faut-il que la carte ait un résumé');
  const resume = h.slice(d, h.indexOf('</summary>', d));
  assert.ok(!/data-del=/.test(resume), 'un bouton dans le résumé ouvrirait la carte au lieu de retirer');
});


t('les niveaux lus dans le jeu ne se tapent plus', () => {
  const g = app(null, SOIR, null, true);
  g.applyGame({ meta: { host: 's1.ogame.gameforge.com' }, planets: {
    '101': { name: 'Planète mère', coords: '1:142:8', b: { metal: 14 } }
  } });
  const h = lu(g.VIEWS.planets());
  assert.ok(/data-b="metal"[^>]*readonly/.test(h), h.slice(0, 800));
});

/* Un `gid` dit que le jeu nomme cette planète, pas qu'il a lu ses niveaux :
   `applyGame` retrouve par coordonnées une planète saisie à la main et lui
   pose un `gid`, sans rien lire de sa grille. */
t('un gid posé sans niveaux lus ne verrouille rien', () => {
  const g = app(null, SOIR, null, true);
  g.applyGame({ meta: { host: 's1.ogame.gameforge.com' }, planets: {
    '101': { name: 'Planète mère', coords: '1:142:8' }
  } });
  const h = lu(g.VIEWS.planets());
  assert.ok(/data-b="metal"/.test(h), 'la grille existe toujours');
  assert.ok(!/data-b="metal"[^>]*readonly/.test(h), 'le jeu a nommé la planète, il n\'a pas lu ses niveaux');
});

/* La première frappe sur une colonie neuve efface `bNeuve` (app.js, bind) :
   si le verrou tenait à ce drapeau, taper un niveau figerait les quinze
   autres à zéro. */
t('taper un niveau sur une colonie neuve ne fige pas les quinze autres', () => {
  const g = app(s => { RELEVE(s); s.planets[1].bNeuve = 1; }, SOIR, null, true);
  delete g.S.planets[1].bNeuve;
  const h = lu(g.VIEWS.planets());
  const carte = h.slice(h.indexOf('data-pi="1"'));
  assert.ok(/data-b="metal"/.test(carte), 'la grille de la colonie existe toujours');
  assert.ok(!/data-b="metal"[^>]*readonly/.test(carte), 'une frappe efface bNeuve, elle ne doit rien verrouiller');
});

t("hors extension, les niveaux restent saisissables : rien ne les relève", () => {
  const h = lu(app(RELEVE, SOIR, null, false).VIEWS.planets());
  assert.ok(/data-b="metal"/.test(h), 'la grille existe toujours');
  assert.ok(!/data-b="metal"[^>]*readonly/.test(h));
});

t('une planète que le jeu a nommée sans la visiter garde ses niveaux saisissables', () => {
  const h = lu(app(s => { RELEVE(s); s.planets[1].bNeuve = 1; }, SOIR, null, true).VIEWS.planets());
  const carte = h.slice(h.indexOf('data-pi="1"'));
  assert.ok(/data-b="metal"/.test(carte), 'la grille de la colonie existe toujours');
  assert.ok(!/data-b="metal"[^>]*readonly/.test(carte), 'bNeuve : aucun niveau lu, il faut pouvoir les taper');
});

t("sur les données d'exemple, tout se tape", () => {
  const h = lu(app(s => { s.sample = true; s.planets.forEach(p => { delete p.gid; }); }, SOIR, null, true).VIEWS.planets());
  assert.ok(/data-b="metal"/.test(h), 'la grille existe toujours');
  assert.ok(!/data-b="metal"[^>]*readonly/.test(h));
});

/* Le joueur pose un niveau visé : l'écouteur rafraîchit sans redessiner, pour
   ne pas refermer le volet sous ses doigts. Un compte calculé dans le gabarit
   mentirait donc jusqu'au prochain rendu complet — c'est un trou. */
t('le volet des bâtiments annonce les priorités posées, et les suit', () => {
  const g = app(s => { RELEVE(s); });
  g.VIEWS.planets(); g.REFRESH.planets();
  assert.equal(lu(g.html()['pobj-0'] || ''), '', 'rien de posé, rien d\'annoncé');
  g.prioPose('b', g.S.planets[0].id, 'metal', g.S.planets[0].b.metal + 3);
  g.REFRESH.planets();
  assert.match(lu(g.html()['pobj-0'] || ''), /1 priorité/, 'le mot du glossaire, et le compte à jour');
});

/* Le volet promet une explication : sans vocation marquée et hors du centre,
   il n'en a aucune, et un « Ouvrir + » sur du vide est le bruit qu'on retire. */
t("le volet des raisons se cache quand il n'a rien à dire", () => {
  const g = app();
  g.VIEWS.planets(); g.REFRESH.planets();
  assert.equal(g.el('pq-0').hidden, false, 'le centre a ses raisons');
  assert.equal(g.el('pq-1').hidden, true, 'sans vocation ni centre, rien à ouvrir');
});


t("la raison d'une vocation se range derrière un volet, la pastille reste", () => {
  const h = lu(app().VIEWS.planets());
  assert.ok(/Pourquoi cette planète/.test(h), h.slice(0, 600));
  assert.ok(/id="pvoc-0"/.test(h) && /id="pvocw-0"/.test(h), 'pastille et raison sont deux trous distincts');
});

t('la note du centre est dans le volet des raisons, pas dans le passage', () => {
  const h = lu(app().VIEWS.planets());
  const i = h.indexOf('Pourquoi cette planète');
  assert.ok(i > -1 && h.indexOf('id="pctrn-0"') > i, 'pctrn doit suivre le résumé du volet');
  assert.ok(h.indexOf('id="pfleet-0"') > -1 && h.indexOf('id="pfleet-0"') < i, 'la flotte à quai est un fait court : elle reste visible');
});

t("le pavé du mélange se replie, les jauges d'empire restent", () => {
  const h = lu(app().VIEWS.planets());
  assert.ok(/Pourquoi ce classement/.test(h));
  assert.ok(/id="empireRes"/.test(h) && /id="empireFactor"/.test(h), 'les chiffres ne se replient pas');
  const i = h.indexOf('Pourquoi ce classement');
  assert.ok(h.indexOf('id="empireMix"') > i);
});

t('la raison de la vocation arrive dans son propre trou, pas dans la pastille', () => {
  const g = app();
  g.VIEWS.planets(); g.REFRESH.planets();
  const h = g.html();
  assert.ok(!/class="note"/.test(h['pvoc-0'] || '') || !/pill/.test(h['pvoc-0'] || ''),
    'la pastille ne porte plus la raison : ' + (h['pvoc-0'] || ''));
  assert.ok('pvocw-0' in h, 'REFRESH doit écrire la raison, même vide');
});


t('les stocks ont leur propre volet, hors de celui des bâtiments', () => {
  const h = lu(app().VIEWS.planets());
  const stk = h.indexOf('data-fold="stock:');
  assert.ok(stk > -1, 'un volet de stock existe');
  assert.ok(h.indexOf('data-s="m"') > stk, 'les champs de stock suivent leur propre résumé');
});

t('le résumé des stocks porte les trois valeurs, sans ouvrir', () => {
  const g = app();
  g.VIEWS.planets(); g.REFRESH.planets();
  const s = lu(g.html()['pstk-0'] || '');
  const st = g.S.planets[0].stock;
  assert.ok(s.includes(g.fmtLigne(st.m)) && s.includes(g.fmtLigne(st.c)) && s.includes(g.fmtLigne(st.d)), s);
});

t('une planète sans aucune forme de vie garde son volet de stock', () => {
  const h = lu(app(s => { s.planets.forEach(p => { p.lf = {}; }); }).VIEWS.planets());
  assert.ok(/data-fold="stock:/.test(h));
  assert.ok(/aucune case de forme de vie relevée/.test(h), 'et la phrase des formes de vie tient toujours');
});


/* ---------- le mode lune retiré ---------- */

t('l\'onglet Lune garde le calculateur, sans les champs du mode', () => {
  const g = app(s => { s.ui.tool = 'moon'; });
  const html = lu(g.VIEWS.moon());
  assert.ok(/Tir de lune/.test(html), 'le calculateur reste');
  assert.ok(!/Mode lune|datetime-local|data-lune=/.test(html), 'plus de champs du mode');
});

t('la campagne de lune ne voyage plus, et son reste est effacé du stockage partagé', () => {
  const g = app();
  assert.ok(!('sy:lune' in g.syncOut()));
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(src, /chrome\.storage\.sync\.remove\('sy:lune'\)/, 'syncNettoie efface la clé orpheline');
});

/* ---------- la carte Lune : ce qui meurt ---------- */

t('ce qui meurt est borné par ce que la défense tue', () => {
  const g = app(HQ);
  const r = g.luneMorts(g.S.planets[0], 'lf', 1667, 0);
  assert.equal(r.tues, 999);
  assert.equal(r.morts, 999);
  assert.equal(g.luneMorts(g.S.planets[0], 'lf', 400, 0).morts, 400);
});

t('sans défense relevée, tout meurt et on le dit', () => {
  const g = app(s => { HQ(s); s.planets[0].defs = null; });
  const r = g.luneMorts(g.S.planets[0], 'lf', 1667, 0);
  assert.equal(r.tues, null);
  assert.equal(r.morts, 1667);
});

/* `fmt` bascule en « k » à cent mille. Sur une colonne de sept planètes qui
   produisent toutes dans le même ordre de grandeur, elle écrivait « 112 k »
   au-dessus de « 82 951 » : deux écritures du même nombre de chiffres, que
   l'œil ne compare plus. La ligne repliée n'abrège donc rien. */
t("les lignes repliées ne mélangent pas les unités : elles se comparent", () => {
  const g = app(s => { s.planets[0].b.metal = 45; s.planets[0].b.solar = 50; });
  g.VIEWS.planets(); g.REFRESH.planets();
  const h = g.html();
  const grosse = lu(h['psum-0'] || ''), petite = lu(h['psum-1'] || '');
  assert.ok(g.production(g.S.planets[0]).m >= 1e5, 'la grosse planète passe bien le seuil du k');
  assert.ok(g.production(g.S.planets[1]).m < 1e5, 'la petite reste en dessous');
  assert.ok(!/\bk\b|\bM\b|\bG\b/.test(grosse), "rien d'abrégé sur la grosse : " + grosse);
  assert.ok(!/\bk\b|\bM\b|\bG\b/.test(petite), "ni sur la petite : " + petite);
});

t("le résumé du stock s'écrit comme le champ qu'il sert à recaler", () => {
  const g = app(s => { s.planets[0].stock = {m: 1200000, c: 60000, d: 18000, at: SOIR}; });
  g.VIEWS.planets(); g.REFRESH.planets();
  const resume = lu(g.html()['pstk-0'] || '');
  assert.ok(!/\bk\b|\bM\b|\bG\b/.test(resume), 'un « 1,20 M » au-dessus d\'un champ qui dit 1200000 : ' + resume);
});

/* ---------- Outils › Colonie : la position libre, pas la position rêvée ---------- */

/** Le système de la planète mère (1:142) est plein ; 1:143 a de la place. */
const VOISINAGE = {
  planets: [...Array(15)].map((_, i) => [`1:142:${i + 1}`, i === 7 ? 'moi' : 'v']).concat([['1:143:9', 'v']]),
  players: { v: ['Voisin', ''], moi: ['Moi', ''] },
  scores: { v: [900], moi: [5000] }
};
const onglietColonie = () => app(s => { s.me = 'moi'; s.ui.tool = 'colony'; }, SOIR, VOISINAGE);

t('la carte des positions montre des cases libres, pas le barème seul', () => {
  const g = onglietColonie();
  g.REFRESH.colony();
  const h = g.html().coCand || '';
  assert.ok(/1:143:8/.test(h), 'une case libre est proposée : ' + h.slice(0, 300));
  assert.ok(!/>1:142:8</.test(h), 'et jamais une case déjà occupée');
});

/** Les lignes de « Prêt à coloniser ? ». */
function pret(modif) {
  const g = app(s => { s.me = 'moi'; s.ui.tool = 'colony'; s.tech.astro = 4; s.colo.built = true; if (modif) modif(s); }, SOIR, VOISINAGE);
  g.REFRESH.colony();
  return lu(g.html().coReq || '');
}

t('rien ne bloque : une ligne, pas une liste de cases cochées', () => {
  const h = pret();
  assert.ok(/Tout est prêt/.test(h), 'une seule ligne : ' + h);
  assert.ok(!/Réacteur à impulsion|Chantier spatial 4/.test(h), 'aucun prérequis déjà tenu n\'est répété');
});

t('ce qui bloque est dit, et renvoyé au plan du jour', () => {
  const h = pret(s => { s.tech.impulse = 1; });
  assert.ok(/Réacteur à impulsion 1 → 3/.test(h), 'le prérequis manquant : ' + h);
  assert.ok(/déjà dans ses priorités/.test(h), 'et c\'est le plan qui s\'en charge');
  assert.ok(!/Tout est prêt/.test(h));
});

t('en « Économie pure », le plan ne colonise pas et le dit', () => {
  const h = pret(s => { s.day.focus = 'eco'; });
  assert.ok(/Économie \+ colonie/.test(h), 'le réglage à changer est nommé : ' + h);
});

t('le menu de planète de départ ne sort que quand il décide', () => {
  // Avec un centre, c'est lui qui sort le vaisseau : le menu n'était qu'un leurre.
  const avecCentre = app(s => { s.centre = 'mere'; });
  assert.ok(!/id="coFrom"/.test(avecCentre.VIEWS.colony()), 'pas de menu inerte');
  // Joueur de flotte : aucun centre n'est désigné, le choix redevient réel.
  const sansCentre = app(s => { s.day.focus = 'fleet'; });
  assert.ok(/id="coFrom"/.test(sansCentre.VIEWS.colony()), 'le menu revient quand il sert');
});

/** La position de la première case proposée, pour un objectif donné. */
function premiereCase(objectif) {
  const g = app(s => { s.me = 'moi'; s.ui.tool = 'colony'; s.tech.astro = 8; s.colo.objective = objectif; }, SOIR, VOISINAGE);
  g.REFRESH.colony();
  const m = (g.html().coCand || '').match(/>(\d+:\d+:(\d+))</);
  assert.ok(m, 'une case est proposée pour ' + objectif);
  return +m[2];
}

t('l\'objectif Cristal pousse vers les positions à bonus cristal', () => {
  // Le bonus cristal ne vit qu'en 1, 2 et 3 ; le métal, lui, est au centre.
  assert.ok(premiereCase('crystal') <= 3, 'cristal : position ' + premiereCase('crystal'));
  assert.ok(premiereCase('metal') >= 6 && premiereCase('metal') <= 10, 'métal : position ' + premiereCase('metal'));
});

t('« Choisir » désigne une case qui existe vraiment', () => {
  const g = onglietColonie();
  g.click('view', { closest: sel => (sel === '[data-copos]' ? { dataset: { copos: '8' } } : null) });
  // Sans l'univers, le panneau proposait 1:142:8 — la planète mère elle-même.
  assert.notEqual(g.S.colo.target, '1:142:8', 'pas la case de départ');
  assert.equal(g.S.colo.target.split(':')[2], '8', 'le numéro demandé est tenu');
  assert.ok(!VOISINAGE.planets.some(([c]) => c === g.S.colo.target), 'et la case est libre');
});

/* ---------- la pose en masse : ce que la revue de branche a trouvé ---------- */

t('une priorité déjà plus haute n\'est pas abaissée par la pose', () => {
  // Poser 43 partout ne doit pas faire redescendre le 50 posé à la main : la
  // conception interdit de défaire, et rien ici ne se défait.
  const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'metal', lvl:50}]; POSE('metal', 43)(s); });
  assert.deepEqual(g.poseLignes().map(x => x.agit), [false, true]);
  assert.equal(g.posePartout(), 1, 'la colonie seule');
  assert.equal(g.prioLvl('b', 'mere', 'metal'), 50);
});

t('la pose monte un niveau visé trop bas', () => {
  const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'metal', lvl:20}]; POSE('metal', 43)(s); });
  assert.equal(g.posePartout(), 2);
  assert.equal(g.prioLvl('b', 'mere', 'metal'), 43);
});

t('sans niveau visé, aucune ligne ne commente', () => {
  // L'état d'ouverture de la carte : « déjà à 14 » sur chaque ligne répétait le
  // nombre d'à côté et laissait croire qu'il n'y avait rien à faire.
  const g = app(POSE('metal', ''));
  const h = lu(g.poseBloc());
  assert.ok(!h.includes('déjà à'), h);
  assert.ok(/Poser sur 0 planète/.test(h), h);
});

t('après la pose, la carte ne redemande pas le même travail', () => {
  const g = app(POSE('metal', 43));
  g.posePartout();
  const h = lu(g.poseBloc());
  assert.ok(h.includes('déjà visé 43'), h);
  assert.ok(/Poser sur 0 planète/.test(h), h);
});

t('décocher une planète la range sous le bâtiment en cours', () => {
  const g = app(POSE('metal', 43));
  g.poseCoche('colo', false);
  assert.deepEqual(g.S.ui.pose.hors.metal, ['colo']);
  g.S.ui.pose.k = 'lab';
  assert.deepEqual(g.poseLignes().map(x => x.coche), [true, true], 'décochée pour la mine, pas pour le labo');
  g.S.ui.pose.k = 'metal';
  g.poseCoche('colo', true);
  assert.deepEqual(g.S.ui.pose.hors.metal, []);
});

t('une sauvegarde d\'avant la carte ne la casse pas', () => {
  /* appliqueSauvegarde remplace S.ui en entier : un fichier d'avant la 1.62
     n'a pas de `pose`, et la carte se figeait en silence au premier clic. */
  const g = app();
  const vieux = JSON.parse(JSON.stringify(g.S));
  delete vieux.ui.pose;
  assert.ok(g.appliqueSauvegarde(JSON.stringify(vieux)), 'le fichier reste recevable');
  // g.S est l'ancien objet : l'import en crée un neuf. On interroge la carte.
  g.poseCoche('colo', false);
  assert.deepEqual(g.poseLignes().map(x => x.coche), [true, false], 'la carte se redonne son état');
  assert.ok(lu(g.VIEWS.planets()).includes('Poser sur toutes les planètes'));
});

t('des décochées au mauvais type ne gèlent pas Empire', () => {
  const g = app(s => { s.ui.pose = {k:'metal', lvl:43, hors:{metal:3}}; });
  assert.deepEqual(g.poseLignes().map(x => x.coche), [true, true]);
  assert.ok(lu(g.VIEWS.planets()).includes('Poser sur toutes les planètes'));
});

/* ---------- et les formes de vie, par rang et non par identifiant ---------- */
/* Les cases de forme de vie ne sont pas dans B : leurs prix changent d'une
   espèce à l'autre, et c'est le relevé qui les nomme. Chaque espèce occupe
   deux séries — bâtiments puis recherches —, si bien qu'un empire à deux
   espèces donnait deux entrées pour la même ligne de la liste. La carte offre
   donc un rang, et chaque planète reçoit la case de son espèce à elle. */

const DEUX_ESPECES = s => {
  s.planets[0].lf = { 11101: { lvl: 3, nom: 'Secteur résidentiel' },
                      11102: { lvl: 1, nom: 'Ferme biosphérique' },
                      11103: { lvl: 0, nom: 'Centre de recherche' },
                      11104: { lvl: 0, nom: 'Académie des sciences' },
                      11105: { lvl: 0, nom: 'Centre de neurocalibrage' },
                      11106: { lvl: 0, nom: 'Fusion à haute énergie' },
                      11201: { lvl: 2, nom: 'Ambassadeurs intergalactiques' } };
  s.planets[1].lf = { 11301: { lvl: 2, nom: 'Enclave stoïque' } };
};
const OPTIONS = h => [...h.matchAll(/<option value="([^"]+)"/g)].map(m => m[1]);

t('un seul rang dans la liste, quelles que soient les espèces', () => {
  const g = app(s => { DEUX_ESPECES(s); POSE('metal', 43)(s); });
  const o = OPTIONS(g.poseBloc()).filter(x => x.startsWith('lf'));
  assert.deepEqual(o, ['lfbuilding:1', 'lfbuilding:2', 'lfbuilding:3', 'lfbuilding:4',
                       'lfbuilding:5', 'lfbuilding:6', 'lfresearch:1'], o.join(','));
});

t('le rang porte les noms que le relevé lui connaît, des deux espèces', () => {
  const g = app(s => { DEUX_ESPECES(s); POSE('metal', 43)(s); });
  const h = lu(g.poseBloc());
  assert.ok(h.includes('Secteur résidentiel / Enclave stoïque'), h);
});

/* Les trois rôles que les quatre espèces partagent — hébergement, nourriture,
   bâtiment de recherche — sont documentés, et eux seuls. Le rang de chacun se
   lit du nom humain, que le relevé connaît : « Secteur résidentiel » est
   11101, donc le rang 1. Au-delà du rang 3, la source se tait et le copilote
   aussi : ces rangs gardent les noms du relevé, sans rôle inventé. */

t('les trois rôles communs nomment leur rang', () => {
  const g = app(s => { DEUX_ESPECES(s); POSE('metal', 43)(s); });
  const h = lu(g.poseBloc());
  assert.ok(h.includes('Hébergement — Secteur résidentiel / Enclave stoïque'), h);
  assert.ok(h.includes('Nourriture — Ferme biosphérique'), h);
  assert.ok(h.includes('Technologies — Centre de recherche'), h);
});

t('les deux rangs qui font monter la population portent leur rôle', () => {
  const g = app(s => { DEUX_ESPECES(s); POSE('metal', 43)(s); });
  const h = lu(g.poseBloc());
  assert.ok(h.includes('Population T1 → T2 — Académie des sciences'), h);
  assert.ok(h.includes('Population T2 → T3 — Centre de neurocalibrage'), h);
});

t('au-delà du rang 5, le rang garde les seuls noms du relevé', () => {
  // Les espèces y divergent : le rang 6 réduit le temps de construction des
  // navires chez les Mécas et la consommation de nourriture chez les Kaeleshs.
  const g = app(s => { DEUX_ESPECES(s); POSE('metal', 43)(s); });
  assert.ok(lu(g.poseBloc()).includes('>Fusion à haute énergie<'), 'sans rôle devant');
});

t('le rang 1 des recherches ne porte pas le rôle des bâtiments', () => {
  const g = app(s => { DEUX_ESPECES(s); POSE('metal', 43)(s); });
  const h = lu(g.poseBloc());
  assert.ok(h.includes('>Ambassadeurs intergalactiques<'), h);
  assert.equal(h.match(/Hébergement/g).length, 1, 'un seul rang porte l\'hébergement');
});

t('poser un rang donne à chaque planète la case de son espèce', () => {
  const g = app(s => { DEUX_ESPECES(s); POSE('lfbuilding:1', 21)(s); });
  assert.deepEqual(g.poseLignes().map(x => x.actuel), [3, 2]);
  assert.equal(g.posePartout(), 2);
  assert.equal(g.prioLvl('lf', 'mere', 11101), 21, 'la case humaine');
  assert.equal(g.prioLvl('lf', 'colo', 11301), 21, "la case de l'autre espèce");
});

t('le rang des recherches ne touche pas celui des bâtiments', () => {
  const g = app(s => { DEUX_ESPECES(s); POSE('lfresearch:1', 21)(s); });
  assert.equal(g.posePartout(), 1, 'la mère seule : la colonie n\'a rien relevé là');
  assert.equal(g.prioLvl('lf', 'mere', 11201), 21);
  assert.equal(g.prioLvl('lf', 'mere', 11101), '', 'le bâtiment de même rang reste intact');
});

t("une planète qui n'a pas relevé ce rang ne reçoit rien", () => {
  const g = app(s => { DEUX_ESPECES(s); POSE('lfbuilding:2', 21)(s); });
  assert.deepEqual(g.poseLignes().map(x => x.agit), [true, false]);
  assert.equal(g.posePartout(), 1);
  assert.ok(lu(g.poseBloc()).includes('pas relevée ici'));
});

t('chaque ligne nomme la case de sa propre planète', () => {
  const g = app(s => { DEUX_ESPECES(s); POSE('lfbuilding:1', 21)(s); });
  const h = lu(g.poseBloc());
  assert.ok(h.includes('Secteur résidentiel 3'), h);
  assert.ok(h.includes('Enclave stoïque 2'), h);
});

t('un rang que personne n\'a relevé retombe sur la mine de métal', () => {
  const g = app(s => { DEUX_ESPECES(s); POSE('lfbuilding:9', 21)(s); });
  assert.equal(g.poseK(), 'metal');
});

t('une planète décochée pour un rang reste cochée pour la mine', () => {
  const g = app(s => { DEUX_ESPECES(s); POSE('lfbuilding:1', 21)(s); });
  g.poseCoche('colo', false);
  assert.deepEqual(g.poseLignes().map(x => x.coche), [true, false]);
  g.S.ui.pose.k = 'metal';
  assert.deepEqual(g.poseLignes().map(x => x.coche), [true, true]);
});

/* ---------- l'ordre des cibles, écrit ---------- */
/* « Elle attend son tour, derrière Mine de métal 43 » ne nomme que celle qui
   agit : à trois priorités sur une planète, on ne savait pas si on était
   deuxième ou dernier. Chaque ligne porte donc son rang — et deux files par
   planète, jamais une seule : les cases de forme de vie ne prennent pas le
   tour des bâtiments. */

t('deux priorités sur une planète portent leur rang', () => {
  const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'metal', lvl:43},
                                 {kind:'b', pid:'mere', k:'lab', lvl:12}]; });
  const h = lu(g.prioHtml());
  assert.ok(h.includes('rang 1 sur 2'), h);
  assert.ok(h.includes('rang 2 sur 2'), h);
});

t("une priorité seule sur sa planète n'annonce aucun rang", () => {
  const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'metal', lvl:43},
                                 {kind:'b', pid:'colo', k:'metal', lvl:43}]; });
  assert.ok(!lu(g.prioHtml()).includes('rang '), 'une par planète : rien à départager');
});

t('une recherche prend son rang sur le centre', () => {
  // Une recherche n'appartient à aucune planète : prios() la range sur le
  // centre, et elle y prend le tour comme un bâtiment.
  const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'metal', lvl:43},
                                 {kind:'t', k:'energy', lvl:10}]; });
  const h = lu(g.prioHtml());
  assert.ok(h.includes('rang 1 sur 2'), h);
  assert.ok(h.includes('rang 2 sur 2'), h);
});

t('les formes de vie comptent dans leur propre file', () => {
  const g = app(s => { DEUX_ESPECES(s);
    s.prio = [{kind:'b', pid:'mere', k:'metal', lvl:43},
              {kind:'lf', pid:'mere', k:11101, lvl:21},
              {kind:'lf', pid:'mere', k:11102, lvl:21}]; });
  const h = lu(g.prioHtml());
  assert.ok(h.includes('rang 1 sur 2'), h);
  assert.ok(h.includes('rang 2 sur 2'), h);
  assert.ok(!h.includes('sur 3'), 'le bâtiment ne grossit pas la file des formes de vie');
});

/* ---------- et le changer, cet ordre ---------- */
/* L'ordre de pose arbitre tout — le tour, les rapatriements — et ne se
   corrigeait que par un retrait suivi d'une nouvelle pose, qui perdait le
   second palier au passage. « Passer devant » met la priorité en tête de la
   file de sa planète, sans toucher aux autres files ni aux autres planètes. */

const REF = (...p) => p.map(x => encodeURIComponent(String(x))).join('|');

t('passer devant fait d\'une priorité la première de sa planète', () => {
  const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'metal', lvl:43},
                                 {kind:'b', pid:'mere', k:'lab', lvl:12}]; });
  g.prioDevant(REF('b', 'mere', 'lab'));
  assert.deepEqual(g.S.prio.map(x => x.k), ['lab', 'metal']);
});

t('passer devant laisse les autres planètes où elles sont', () => {
  const g = app(s => { s.prio = [{kind:'b', pid:'colo', k:'metal', lvl:20},
                                 {kind:'b', pid:'mere', k:'metal', lvl:43},
                                 {kind:'b', pid:'mere', k:'lab', lvl:12}]; });
  g.prioDevant(REF('b', 'mere', 'lab'));
  assert.deepEqual(g.S.prio.map(x => x.pid + ':' + x.k),
    ['colo:metal', 'mere:lab', 'mere:metal'], 'la colonie n\'a pas bougé');
});

t('une case de forme de vie ne double pas un bâtiment', () => {
  const g = app(s => { DEUX_ESPECES(s);
    s.prio = [{kind:'lf', pid:'mere', k:11101, lvl:21},
              {kind:'b', pid:'mere', k:'metal', lvl:43},
              {kind:'lf', pid:'mere', k:11102, lvl:21}]; });
  g.prioDevant(REF('lf', 'mere', 11102));
  assert.deepEqual(g.S.prio.map(x => String(x.k)), ['11102', '11101', 'metal'],
    'elle passe devant sa file, pas devant le bâtiment');
});

t('une recherche passe devant sur le centre', () => {
  const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'metal', lvl:43},
                                 {kind:'t', k:'energy', lvl:10}]; });
  g.prioDevant(REF('t', 'energy'));
  assert.deepEqual(g.S.prio.map(x => x.k), ['energy', 'metal']);
});

t('la première de sa file ne bouge pas', () => {
  const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'metal', lvl:43},
                                 {kind:'b', pid:'mere', k:'lab', lvl:12}]; });
  g.prioDevant(REF('b', 'mere', 'metal'));
  assert.deepEqual(g.S.prio.map(x => x.k), ['metal', 'lab']);
});

t('le second palier survit au changement de rang', () => {
  // C'est ce que « retirer puis reposer » perdait, et la raison d'être du bouton.
  const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'metal', lvl:43},
                                 {kind:'lf', pid:'mere', k:11101, lvl:21, puis:41}];
    DEUX_ESPECES(s); });
  g.prioDevant(REF('lf', 'mere', 11101));
  assert.equal(g.S.prio.find(x => x.k === 11101).puis, 41);
});

t('une référence abîmée ne touche à rien', () => {
  const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'metal', lvl:43},
                                 {kind:'b', pid:'mere', k:'lab', lvl:12}]; });
  g.prioDevant('b|%E0|lab');
  assert.deepEqual(g.S.prio.map(x => x.k), ['metal', 'lab'], 'et surtout ne lève pas');
});

t('seules les lignes qui attendent offrent le bouton', () => {
  const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'metal', lvl:43},
                                 {kind:'b', pid:'mere', k:'lab', lvl:12},
                                 {kind:'b', pid:'colo', k:'crystal', lvl:20}]; });
  const h = lu(g.prioHtml());
  assert.equal((h.match(/data-prio-up=/g) || []).length, 1, 'une seule : celle qui attend');
});

t('le bouton change vraiment l\'ordre', () => {
  const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'metal', lvl:43},
                                 {kind:'b', pid:'mere', k:'lab', lvl:12}]; });
  g.click('view', { closest: sel => (sel === '[data-prio-up]'
    ? { dataset: { prioUp: REF('b', 'mere', 'lab') } } : null) });
  assert.deepEqual(g.S.prio.map(x => x.k), ['lab', 'metal']);
});

/* ---------- quand rien ne se pose, la carte dit pourquoi ---------- */
/* Le joueur voit une planète au niveau 12 sous un objectif de 21 et un bouton
   éteint : il en conclut que la carte est cassée, alors qu'elle a déjà fait le
   travail — cette planète-là vise déjà 21, les autres sont plus haut. Le
   compte des raisons est la seule chose qui répond à ça. */

t('le bouton à zéro dit ce qui retient chaque planète', () => {
  const g = app(s => { s.prio = [{kind:'b', pid:'colo', k:'metal', lvl:10}]; POSE('metal', 10)(s); });
  // « vise déjà 10 » serait faux dès que l'objectif tapé est plus bas que ce
  // que la planète porte : c'est bien « aussi haut », pas « ce nombre-là ».
  const h = lu(g.poseBloc());
  assert.ok(/Poser sur 0 planète/.test(h), h);
  assert.ok(h.includes('Rien à poser : 1 planète déjà à ce niveau ou plus haut, 1 vise déjà aussi haut.'), h);
});

t('les décochées et les cases absentes comptent dans ce que la carte dit', () => {
  const g = app(s => { DEUX_ESPECES(s); POSE('lfbuilding:2', 1, {'lfbuilding:2': ['mere']})(s); });
  const h = lu(g.poseBloc());
  assert.ok(h.includes('Rien à poser : 1 décochée, 1 sans cette case.'), h);
});

t('tant qu\'aucun niveau n\'est tapé, la carte ne se justifie pas', () => {
  const g = app(POSE('metal', ''));
  assert.ok(!lu(g.poseBloc()).includes('Rien à poser'), 'rien à justifier avant un objectif');
});

t('dès qu\'une planète peut recevoir, la carte ne se justifie plus', () => {
  const g = app(POSE('metal', 43));
  assert.ok(!lu(g.poseBloc()).includes('Rien à poser'));
});

/* ---------- et le geste inverse : retirer ---------- */
/* La carte posait sur huit planètes d'un clic et demandait huit clics droits
   dans le jeu pour défaire. Un essai — « je mets 10 pour voir » — coûtait donc
   une tournée complète. Retirer est un geste à part, nommé, et non un niveau
   plus bas qu'on taperait : un objectif abaissé par mégarde effacerait en
   silence ce que le joueur a réglé tuile par tuile. */

t('retirer enlève la priorité des planètes cochées', () => {
  const g = app(POSE('metal', 43));
  assert.equal(g.posePartout(), 2);
  assert.equal(g.poseRetireTout(), 2);
  assert.equal(g.prioLvl('b', 'mere', 'metal'), '');
  assert.equal(g.prioLvl('b', 'colo', 'metal'), '');
});

t('retirer laisse la planète décochée tranquille', () => {
  const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'metal', lvl:43},
                                 {kind:'b', pid:'colo', k:'metal', lvl:43}];
                       POSE('metal', 43, {metal: ['colo']})(s); });
  assert.equal(g.poseRetireTout(), 1);
  assert.equal(g.prioLvl('b', 'colo', 'metal'), 43, 'la décochée garde la sienne');
});

t('retirer ne touche que la case choisie', () => {
  const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'metal', lvl:43},
                                 {kind:'b', pid:'mere', k:'lab', lvl:12}];
                       POSE('metal', 43)(s); });
  g.poseRetireTout();
  assert.equal(g.prioLvl('b', 'mere', 'metal'), '');
  assert.equal(g.prioLvl('b', 'mere', 'lab'), 12, 'le labo ne bouge pas');
});

t('retirer un rang de forme de vie suit chaque espèce', () => {
  const g = app(s => { DEUX_ESPECES(s); POSE('lfbuilding:1', 21)(s); });
  g.posePartout();
  assert.equal(g.poseRetireTout(), 2);
  assert.equal(g.prioLvl('lf', 'mere', 11101), '');
  assert.equal(g.prioLvl('lf', 'colo', 11301), '');
});

t('sans rien de posé, il n\'y a rien à retirer', () => {
  const g = app(POSE('metal', 43));
  assert.equal(g.poseRetireTout(), 0);
});

t('la carte offre le retrait et dit sur combien de planètes', () => {
  const g = app(POSE('metal', 43));
  assert.ok(!/data-posedel="1"[^>]*>Retirer sur 1/.test(lu(g.poseBloc())), 'rien à retirer au départ');
  g.posePartout();
  const h = lu(g.poseBloc());
  assert.ok(/Retirer sur 2 planètes/.test(h), h);
});

t('le bouton de retrait retire vraiment', () => {
  const g = app(POSE('metal', 43));
  g.posePartout();
  g.click('view', { closest: sel => (sel === '[data-posedel]' ? { dataset: { posedel: '1' } } : null) });
  assert.equal(g.prioLvl('b', 'mere', 'metal'), '');
  assert.equal(g.prioLvl('b', 'colo', 'metal'), '');
});

/* ---------- l'horloge du plan : une file occupée reste occupée ---------- */
/* Les durées du moteur sont en secondes, les instants en millisecondes. Les
   additionner sans convertir faisait finir tout chantier dans la seconde : la
   carte annonçait « fin » à l'heure de la session, et la file se rouvrait
   aussitôt — le plan relançait sur une planète qui construisait encore. */

t('une carte finit quand son chantier finit, pas à l\'heure de la session', () => {
  const g = app(null, JOUR);
  const s0 = g.simulateDay().sessions[0];
  const faux = s0.acts.filter(a => a.dur > 0 && a.end)
    .filter(a => Math.abs(a.end - (s0.T + a.dur * 1000)) > 2000);
  assert.deepEqual(faux.map(a => `${a.what} : fin ${a.end - s0.T} ms pour ${a.dur} s`), []);
});

/** Un chantier de plusieurs heures : robots à zéro, et de quoi tout payer. */
const CHANTIER_LONG = s => {
  s.planets[0].b.robot = 0;
  s.planets[0].stock = { m: 5e6, c: 3e6, d: 1e6, at: JOUR };
};

t('le plan ne relance pas une planète qui construit encore', () => {
  const g = app(CHANTIER_LONG, JOUR);
  const fin = new Map(), fautes = [];
  for (const s of g.simulateDay().sessions) for (const a of s.acts) {
    if (a.kind !== 'b') continue;
    if (fin.has(a.p) && s.T < fin.get(a.p)) fautes.push(`${a.what} lancé ${Math.round((fin.get(a.p) - s.T) / 60e3)} min trop tôt`);
    fin.set(a.p, s.T + a.dur * 1000);
  }
  assert.deepEqual(fautes, []);
});

t('une recherche attend la fin de la précédente', () => {
  const g = app(null, JOUR);
  let fin = 0; const fautes = [];
  for (const s of g.simulateDay().sessions) for (const a of s.acts) {
    if (a.kind !== 't') continue;
    if (s.T < fin) fautes.push(`${a.what} lancée ${Math.round((fin - s.T) / 60e3)} min trop tôt`);
    fin = s.T + a.dur * 1000;
  }
  assert.deepEqual(fautes, []);
});

/* ---------- un chantier que le relevé n'a pas su nommer ---------- */
/* Le jeu n'écrit pas toujours l'identifiant de ce qu'il construit : le minuteur
   arrive alors sans technologie, et il ne vaut plus que par sa file. Les tuiles
   du jeu la lisent — elles disent « file occupée ». Le plan, lui, ne lisait que
   les minuteurs qu'il avait su nommer : il relançait sur une planète prise. */

/** Un minuteur de bâtiment dont on ne sait rien, sinon qu'il occupe la file. */
const CHANTIER_ANONYME = s => { s.timers = [{ id: 'a1', game: true, kind: 'x', k: 'other',
  queue: 'building', pid: 'mere', label: 'Construction', end: JOUR + 2 * 3600e3, done: false }]; };

t('un chantier sans nom occupe quand même la file de sa planète', () => {
  const j = app(CHANTIER_ANONYME, JOUR).simulateDay();
  assert.deepEqual(j.sessions[0].acts.filter(a => a.kind === 'b' && a.p === 0).map(a => a.what), [],
    'rien ne se lance sur une planète qui construit déjà');
});

t('un chantier sans nom se dit « déjà en cours »', () => {
  const j = app(CHANTIER_ANONYME, JOUR).simulateDay();
  assert.ok(j.busy.some(b => /Bâtiment · Planète mère/.test(b.q)),
    'le joueur doit lire pourquoi sa planète ne reçoit rien : ' + JSON.stringify(j.busy));
});

t('une recherche sans nom occupe quand même le laboratoire', () => {
  const j = app(s => { s.timers = [{ id: 'a2', game: true, kind: 'x', k: 'other',
    queue: 'research', label: 'Recherche', end: JOUR + 2 * 3600e3, done: false }]; }, JOUR).simulateDay();
  assert.deepEqual(j.sessions[0].acts.filter(a => a.kind === 't').map(a => a.what), [],
    'une seule file de recherche pour tout l\'empire');
  assert.ok(j.busy.some(b => /Recherche/.test(b.q)), JSON.stringify(j.busy));
});

/* ---------- aucune file ne se double, sur la journée entière ---------- */
/* L'invariant que les deux défauts du 25 novembre enfreignaient chacun à sa
   façon. Il se vérifie sur les cinq files et sur les vingt-quatre heures, pas
   sur la première session : c'est en fin de journée que les écarts se voient. */

const FILE_DE = (g, a) => a.kind === 'b' ? 'building' : a.kind === 't' ? 'research'
  : a.kind === 'lf' ? g.lfQueue(a.id)
  : ['sats', 'ship', 'shipbuild', 'def'].includes(a.kind) ? 'shipyard' : null;

/** Les trois files de la planète mère déjà prises, pour des heures. */
const FILES_PRISES = s => { s.timers = [
  { id: 'f1', game: true, kind: 'b', k: 'metal', lvl: 15, pid: 'mere', queue: 'building', end: JOUR + 5 * 3600e3, done: false },
  { id: 'f2', game: true, kind: 't', k: 'energy', lvl: 4, queue: 'research', end: JOUR + 4 * 3600e3, done: false },
  { id: 'f3', game: true, kind: 'x', k: 'shipyard', pid: 'mere', queue: 'shipyard', label: 'Chantier', end: JOUR + 3 * 3600e3, done: false }
]; };

t('le plan ne double jamais une file de la journée', () => {
  const g = app(FILES_PRISES, JOUR);
  const libre = new Map(), fautes = [];
  for (const tm of g.S.timers) {
    const q = tm.kind === 't' ? 'research' : tm.queue;
    libre.set(q + '|' + (q === 'research' ? '*' : tm.pid), tm.end);
  }
  let vus = 0;
  for (const s of g.simulateDay().sessions) for (const a of s.acts) {
    const q = FILE_DE(g, a); if (!q) continue;
    const cle = q + '|' + (q === 'research' ? '*' : g.S.planets[a.p].id);
    const fin = libre.get(cle) || 0;
    vus++;
    if (s.T < fin) fautes.push(`${a.what} : ${q} prise encore ${Math.round((fin - s.T) / 60e3)} min`);
    libre.set(cle, s.T + a.dur * 1000);
  }
  assert.ok(vus > 20, 'la journée doit proposer de quoi vérifier : ' + vus);
  assert.deepEqual(fautes, []);
});

/* ---------- un labo ne monte pas pendant qu'une recherche tourne ---------- */
/* Une seule file de recherche pour tout l'empire, et le jeu refuse de monter
   un laboratoire — n'importe lequel, pas seulement celui d'où l'on cherche —
   tant qu'elle tourne : la tuile affiche « Une recherche est en cours ! ». Le
   plan ne connaissait cette règle que du labo qu'il choisit lui-même. Depuis
   qu'une priorité se pose sur toutes les planètes d'un coup, il envoyait le
   joueur se heurter au jeu, planète après planète. */

/** Labo 10 en priorité sur la colonie, et une recherche qui tourne deux heures. */
const LABO_PENDANT_RECHERCHE = s => {
  s.prio = [{ kind: 'b', pid: 'colo', k: 'lab', lvl: 10 }];
  // De quoi payer, et des hangars qui ne débordent pas : sinon la carte
  // attend faute d'argent, ou le hangar de secours passe devant, et le test
  // ne prouverait rien de la règle du jeu.
  Object.assign(s.planets[1].b, { smetal: 4, scrystal: 4, sdeut: 4 });
  s.planets[1].stock = { m: 20000, c: 20000, d: 5000, at: JOUR };
  s.timers = [{ id: 'r9', game: true, kind: 't', k: 'energy', lvl: 4,
    queue: 'research', end: JOUR + 2 * 3600e3, done: false }];
};

t('aucun labo ne se propose pendant qu\'une recherche tourne', () => {
  const s0 = app(LABO_PENDANT_RECHERCHE, JOUR).simulateDay().sessions[0];
  assert.deepEqual(s0.acts.filter(a => a.kind === 'b' && a.k === 'lab').map(a => a.q + ' ' + a.what), []);
});

t('le labo retenu par une recherche dit pourquoi, et jusqu\'à quand', () => {
  const s0 = app(LABO_PENDANT_RECHERCHE, JOUR).simulateDay().sessions[0];
  const w = s0.waits.find(x => x.kind === 'b' && x.k === 'lab');
  assert.ok(w, 'la priorité ne doit pas se taire : ' + JSON.stringify(s0.waits.map(x => x.what)));
  assert.match(w.why, /recherche/i);
});

t('le labo repart dès que la recherche est finie', () => {
  const j = app(LABO_PENDANT_RECHERCHE, JOUR).simulateDay();
  const labo = j.sessions.flatMap(s => s.acts.filter(a => a.kind === 'b' && a.k === 'lab').map(a => s.T));
  assert.ok(labo.length, 'le labo finit par se lancer');
  assert.ok(labo[0] >= JOUR + 2 * 3600e3,
    'pas avant la fin de la recherche : ' + new Date(labo[0]).toISOString());
});

/* ---------- et la règle miroir : un labo qui monte ---------- */
/* Confirmée dans le jeu par le joueur le 2026-11-25 : un laboratoire en
   chantier empêche de chercher **depuis cette planète-là**, et depuis elle
   seule. Un labo qui monte sur une colonie ne retient pas les recherches du
   centre. Le copilote l'appliquait déjà — `labBusy` n'interroge que la planète
   d'où partent ses recherches — mais rien ne le disait : ces deux
   vérifications tiennent la règle des deux côtés, pour qu'une correction
   future ne l'élargisse pas « par prudence ». */

/** Un labo en chantier jusqu'à trois heures d'ici, sur la planète choisie. */
const LABO_MONTE = pid => s => { s.timers = [{ id: 'L1', game: true, kind: 'b',
  k: 'lab', lvl: 6, pid, queue: 'building', end: JOUR + 3 * 3600e3, done: false }]; };

t('une recherche attend le labo du centre qui monte', () => {
  const j = app(LABO_MONTE('mere'), JOUR).simulateDay();
  const quand = j.sessions.flatMap(s => s.acts.filter(a => a.kind === 't').map(() => s.T));
  assert.ok(quand.length, 'la journée finit par chercher');
  assert.ok(quand[0] >= JOUR + 3 * 3600e3,
    'pas avant la fin du labo : ' + new Date(quand[0]).toLocaleTimeString('fr-FR'));
});

t('un labo qui monte ailleurs ne retient aucune recherche', () => {
  const s0 = app(LABO_MONTE('colo'), JOUR).simulateDay().sessions[0];
  assert.ok(s0.acts.some(a => a.kind === 't'),
    'le centre cherche pendant qu\'une colonie monte son labo');
});

/* ---------- le profil de jeu ---------- */

/** Un profil posé, répondu : le cas d'un joueur qui a passé l'assistant. */
const PROFIL = (style, extra) => s => {
  s.profil = Object.assign({style, classe: '', activite: 'regulier', focus: [], set: true}, extra || {});
};

t('l\'assistant s\'ouvre au premier lancement, en tête d\'Aujourd\'hui', () => {
  const h = lu(app().VIEWS.today());
  assert.ok(/Tu joues comment/.test(h), 'la première question est là');
  assert.ok(/Étape 1 sur 3/.test(h), 'et elle se dit première sur trois');
  for (const k of ['mineur', 'turtle', 'raideur', 'fleeter', 'explorateur'])
    assert.ok(h.includes(`data-pstyle="${k}"`), `le style ${k} est proposé`);
  assert.ok(h.indexOf('Tu joues comment') < h.indexOf('Maintenant'),
    'avant la carte du moment, pas après');
});

/* Le style ne pèse pas que les cartes : il pose « Ce que le plan vise », qui
   décide de la feuille de route et de la colonisation. Un plan inconnu de
   FOCUS serait refusé par `dayValue` en silence, et le style ne ferait rien. */
t('chaque style vise un plan que le panneau connaît', () => {
  const g = app();
  for (const [k, s] of Object.entries(g.PROFILS.styles))
    assert.equal(g.dayValue('focus', s.plan, 'equi'), s.plan,
      `le plan « ${s.plan} » du style ${k} n\'est pas un choix de FOCUS`);
});

t('la classe conseillée s\'affiche à l\'étape 2, selon le style choisi', () => {
  const g = app(s => { s.profil = {style: 'turtle', classe: '', activite: 'regulier', focus: [], set: false}; });
  const h = lu(g.profilCard(1));
  assert.ok(/Étape 2 sur 3/.test(h), 'c\'est bien la deuxième question');
  assert.ok(/la classe conseillée est <b>Collecteur<\/b>/.test(h), 'un turtle appelle le Collecteur');
  assert.ok(h.includes('data-pclasse=""'), 'et « Pas de préférence » reste proposé');
});

/* Le copilote ne change pas de classe dans le jeu : tout ce qu'il peut faire
   d'un écart, c'est le dire — et laisser le joueur choisir quand même. */
t('un écart de classe se dit, sans rien bloquer', () => {
  const g = app(s => {
    s.settings.cls = 'collector';
    s.profil = {style: 'raideur', classe: 'general', activite: 'regulier', focus: [], set: false};
  });
  const h = lu(g.profilCard(1));
  assert.ok(/Ton compte joue Collecteur, ton profil vise Général/.test(h), 'l\'écart est nommé');
  assert.ok(/Rien n\'est bloqué/.test(h), 'et il est dit non bloquant');
  assert.ok(h.includes('data-pclasse="general"'), 'les choix restent cliquables');
});

t('rien à dire quand le compte joue déjà la classe visée', () => {
  const g = app(PROFIL('turtle'));
  assert.equal(g.S.settings.cls, 'collector', 'le compte est Collecteur');
  assert.equal(g.classeEcart(), '', 'et c\'est ce que le style conseille');
});

t('« Pas de préférence » vaut la classe que le style conseille', () => {
  const g = app(PROFIL('explorateur'));
  assert.equal(g.classeVoulue(), 'explorer', 'celle du style');
  assert.ok(/^Explorateur · Explorateur/.test(g.profilLigne()), 'et elle se lit sur la ligne');
});

t('une fois les trois réponses données, l\'assistant s\'efface', () => {
  const g = app(PROFIL('turtle', {focus: ['expo']}));
  assert.equal(g.profilCard(), '', 'plus d\'assistant');
  const h = lu(g.VIEWS.today());
  assert.ok(!/Tu joues comment/.test(h), 'la question ne revient pas');
  assert.ok(/Ton profil/.test(h), 'la ligne du profil prend sa place');
  assert.ok(h.includes('Turtle · Collecteur · Régulier · + Expéditions'), 'profil en une ligne');
});

t('les focus se cochent depuis le panneau principal', () => {
  const h = lu(app(PROFIL('turtle', {focus: ['expo']})).VIEWS.today());
  for (const k of ['mines', 'def', 'expo', 'raids', 'combat', 'recherche'])
    assert.ok(h.includes(`data-pfocus="${k}"`), `le focus ${k} est proposé`);
  assert.ok(/data-pfocus="expo" checked/.test(h), 'et celui qui est posé est coché');
});

/* Le profil et le plan du jour ne faisaient qu'un sujet dans deux cartes, et
   la première finissait par un paragraphe qui décrivait la seconde — « ci-
   dessous ». Une seule carte, et l'adjacence dit ce que la prose disait. */
t('le profil et le plan du jour tiennent dans une seule carte', () => {
  const h = lu(app(PROFIL('turtle')).VIEWS.settings());
  assert.ok(/<h2>Profil et plan du jour<\/h2>/.test(h), 'la carte est là');
  assert.ok(!/<h2>Plan du jour<\/h2>/.test(h), 'et il n\'y a plus de seconde carte');
  assert.ok(!/ci-dessous/.test(h), 'donc plus de renvoi d\'une carte à l\'autre');

  // Les deux contenus sont bien dans la même carte, entre son titre et le suivant.
  const debut = h.indexOf('<h2>Profil et plan du jour</h2>');
  const carte = h.slice(debut, h.indexOf('<h2>', debut + 10));
  assert.ok(carte.includes('data-pfocus='), 'les focus y sont');
  assert.ok(carte.includes('data-day="focus"'), 'le menu du plan aussi');
  assert.ok(carte.includes('data-day="interval"'), 'et le rythme');
  assert.ok(carte.includes('data-refaire="1"'), 'avec le bouton qui relance l\'assistant');
  assert.ok(carte.includes('Turtle · Collecteur · Régulier'), 'et le profil en place');
});

/* Ce que le plan vise est posé par le style, puis le joueur peut en changer.
   Le dire sur le menu lui-même remplace le paragraphe qui renvoyait ailleurs. */
t('le menu du plan dit quand c\'est le style qui l\'a posé', () => {
  const suit = app(s => {
    s.day.focus = 'ecocol';
    s.profil = {style: 'turtle', classe: '', activite: 'regulier', focus: [], set: true};
  });
  assert.ok(suit.planPoseParLeStyle(), 'le plan en place est celui du turtle');
  assert.ok(/Posé par ton style \(Turtle\)/.test(lu(suit.VIEWS.settings())), 'et le menu le dit');

  const choisi = app(s => {
    s.day.focus = 'eco';
    s.profil = {style: 'turtle', classe: '', activite: 'regulier', focus: [], set: true};
  });
  assert.ok(!choisi.planPoseParLeStyle(), 'un plan choisi à la main ne vient plus du style');
  assert.ok(!/Posé par ton style/.test(lu(choisi.VIEWS.settings())), 'et le menu se tait');
});

t('le profil survit à la fermeture du panneau', () => {
  const g = app(PROFIL('turtle', {activite: 'peu', focus: ['def']}));
  assert.equal(g.S.profil.style, 'turtle', 'relu du stockage au démarrage');
  assert.equal(g.S.profil.activite, 'peu', 'l\'activité aussi');
  assert.deepEqual(g.S.profil.focus, ['def'], 'et les focus posés');
});

t('le profil part sur l\'autre poste entier', () => {
  const g = app(PROFIL('turtle', {focus: ['expo']}));
  const envoye = g.syncOut()['sy:profil'];
  assert.equal(envoye.style, 'turtle', 'le style voyage');
  assert.deepEqual(envoye.focus, ['expo'], 'les focus avec lui');
});

/* Une sauvegarde ou une synchro peut porter n'importe quoi, `__proto__`
   compris : une clé qui passe par la chaîne de prototypes aurait l'air connue
   et ferait écrire « undefined » dans la ligne du profil. */
t('un profil truqué ne survit pas à sainEtat', () => {
  const g = app(s => {
    s.profil = {style: '__proto__', classe: '<b>oui', activite: 'jamais', focus: ['expo', 'pirate', 2], set: true};
  });
  assert.equal(g.S.profil.style, '', 'un style inconnu ne passe pas, même par le prototype');
  assert.equal(g.S.profil.classe, '', 'ni une classe inconnue');
  assert.equal(g.S.profil.activite, 'regulier', 'l\'activité retombe sur le défaut');
  assert.deepEqual(g.S.profil.focus, ['expo'], 'seuls les focus connus restent');
  assert.strictEqual(g.S.profil.set, false, 'et sans style, la question se repose');
});

t('sans profil, rien n\'est pondéré', () => {
  const g = app();
  for (const cat of Object.keys(g.PROFILS.cats))
    assert.equal(g.poidsCat(cat), g.PROFILS.neutre, `${cat} garde sa place`);
});

t('le poids d\'une catégorie suit le style', () => {
  const tu = app(PROFIL('turtle'));
  assert.equal(tu.poidsCat('def'), 3, 'un turtle vise la défense');
  assert.equal(tu.poidsCat('combat'), 0, 'et jamais la flotte de combat');
  const ra = app(PROFIL('raideur'));
  assert.equal(ra.poidsCat('def'), 0, 'un raideur ne fortifie pas');
  assert.equal(ra.poidsCat('espio'), 3, 'il espionne, il va vite');
});

t('un focus ajoute +2, plafonné à 3', () => {
  assert.equal(app(PROFIL('turtle', {focus: ['expo']})).poidsCat('expo'), 3, '1 + 2 = 3');
  assert.equal(app(PROFIL('turtle', {focus: ['def']})).poidsCat('def'), 3, 'déjà à 3, il n\'y a pas de 5');
  const d = app(PROFIL('mineur', {focus: ['raids']}));
  assert.equal(d.poidsCat('cargo'), 3, 'un focus porte sur chacune de ses catégories');
  assert.equal(d.poidsCat('espio'), 3, 'les deux, pas la première');
  assert.equal(d.poidsCat('mines'), 3, 'et il n\'efface pas le style : les mines restent');
});

t('peu présent plafonne ce qui demande d\'être là, et met l\'abri devant', () => {
  const g = app(PROFIL('fleeter', {activite: 'peu'}));
  assert.equal(g.poidsCat('combat'), 1, 'la flotte de combat attend');
  assert.equal(g.poidsCat('espio'), 1, 'les raids aussi');
  assert.ok(g.poidsCat('abri') > g.poidsCat('mines'), 'la mise à l\'abri passe devant tout');
  const a = app(PROFIL('fleeter', {activite: 'actif'}));
  assert.equal(a.poidsCat('combat'), 3, 'très actif : aucun plafond');
  assert.equal(a.poidsCat('abri'), 3, 'et l\'abri redevient une carte comme une autre');
});

t('la catégorie d\'une carte se lit sur ce qu\'elle construit', () => {
  const g = app();
  assert.equal(g.catActe({kind: 'b', k: 'metal'}), 'mines');
  assert.equal(g.catActe({kind: 'b', k: 'smetal'}), 'stock');
  assert.equal(g.catActe({kind: 't', k: 'astro'}), 'techeco');
  assert.equal(g.catActe({kind: 't', k: 'shielding'}), 'techdef');
  assert.equal(g.catActe({kind: 'expo'}), 'expo');
  assert.equal(g.catActe({kind: 'fleet'}), 'abri', 'la mise à l\'abri n\'est pas une préférence');
  assert.equal(g.catActe({kind: 'b', k: 'lab'}), 'infra', 'un labo est une installation');
  assert.equal(g.catActe({kind: 'b', k: 'nanite'}), 'infra');
  /* Les formes de vie n'ont pas de catégorie, et c'est voulu : leur place dans
     le plan se règle dans Réglages (« Place des formes de vie »), qui décide
     avant / après / jamais — bien plus qu'un ordre. Un focus qui les pousserait
     aussi ferait deux commandes pour une seule chose. */
  assert.equal(g.catActe({kind: 'lf', id: 11201}), '', 'une forme de vie a son propre réglage');
  // Un chantier vaut ce qu'il sort, pas la file dont il relève.
  assert.equal(g.catActe({kind: 'def', ships: {rl: 20}}), 'def');
  assert.equal(g.catActe({kind: 'shipbuild', ships: {lc: 3}}), 'cargo');
  assert.equal(g.catActe({kind: 'shipbuild', ships: {lf: 12}}), 'combat');
  assert.equal(g.catActe({kind: 'shipbuild', ships: {pr: 5}}), 'espio');
  assert.equal(g.catActe({kind: 'shipbuild', ships: {}}), '', 'un lot vide ne relève de rien');
  assert.equal(g.catMission({id: 'expocargo', q: 'Exploration'}), 'cargo', 'l\'identifiant tranche avant la rubrique');
  assert.equal(g.catMission({id: 'night', q: 'Sécurité'}), 'abri');
  assert.equal(g.catMission({id: 'defseen', q: 'Sécurité'}), 'abri', 'une carte de relevé garde sa rubrique');
});

t('le profil écarte les cartes de poids nul et classe le reste', () => {
  const g = app(PROFIL('raideur'));
  const l = g.dailyMissions();
  assert.ok(l.length, 'il reste des cartes');
  assert.ok(l.every(m => g.poidsCat(g.catMission(m)) > 0), 'aucune carte de poids nul');
  const w = l.map(m => g.poidsCat(g.catMission(m)));
  for (let i = 1; i < w.length; i++)
    assert.ok(w[i] <= w[i - 1], `la liste descend en poids : ${w.join(' ')}`);
});

t('cocher Expéditions remonte les cartes d\'exploration', () => {
  const rang = g => g.dailyMissions().findIndex(m => m.q === 'Exploration');
  const sans = rang(app(PROFIL('turtle'))), avec = rang(app(PROFIL('turtle', {focus: ['expo']})));
  assert.ok(sans > 0, 'un turtle ne les a pas en tête');
  assert.ok(avec < sans, `le focus les fait remonter : ${avec} contre ${sans}`);
});

t('à ressources égales, le plan montre d\'abord ce que le profil pousse', () => {
  const g = app(PROFIL('turtle'));
  for (const x of g.simulateDay().sessions) {
    const w = x.acts.map(a => g.poidsCat(g.catActe(a)));
    for (let i = 1; i < w.length; i++)
      assert.ok(w[i] <= w[i - 1], `les cartes de ${new Date(x.T).toLocaleTimeString('fr-FR')} descendent en poids : ${w.join(' ')}`);
  }
});

/* Le style pose deux réglages, et rien de plus : ce que le joueur a choisi
   lui-même dans les Réglages lui appartient. La règle vaut pour les deux —
   l'avoir écrite pour le modèle de défense et oubliée pour le plan du jour est
   ce que la relecture de la PR a trouvé. */
t('le style pose le plan et le modèle de défense, sans écraser un choix du joueur', () => {
  const g = app();
  for (const [k, s] of Object.entries(g.PROFILS.styles))
    assert.ok(g.DEF_MODELES[s.defense], `le modèle « ${s.defense} » du style ${k} n\'existe pas`);

  const neuf = app(s => { s.day.focus = 'equi'; });
  assert.equal(neuf.S.settings.defModele, 'framework', 'le panneau part sur le framework');
  assert.equal(neuf.S.day.focus, 'equi', 'et sur le plan d\'usine, celui de qui n\'a jamais répondu');
  neuf.styleRepose('', 'turtle');
  assert.equal(neuf.S.settings.defModele, 'turtle', 'un turtle vise la tortue de fin de partie');
  assert.equal(neuf.S.day.focus, 'ecocol', 'et le plan qui mine et colonise');

  const choisi = app(s => { s.settings.defModele = 'vetter'; s.day.focus = 'eco'; });
  choisi.styleRepose('', 'turtle');
  assert.equal(choisi.S.settings.defModele, 'vetter', 'un modèle posé à la main tient bon');
  assert.equal(choisi.S.day.focus, 'eco', 'un plan posé à la main aussi');

  const suit = app(s => { s.settings.defModele = 'turtle'; s.day.focus = 'ecocol'; });
  suit.styleRepose('turtle', 'raideur');
  assert.equal(suit.S.settings.defModele, 'framework', 'et les deux suivent quand le style change');
  assert.equal(suit.S.day.focus, 'raid');
});

/* « Économie pure » et « Équilibré » ne sont visés par aucun style : refaire le
   questionnaire est le seul moment où l'assistant pourrait les effacer, et il
   ne saurait pas les rendre. */
t('refaire le questionnaire ne reprend pas un plan que le joueur a posé', () => {
  const g = app(s => {
    s.day.focus = 'eco';
    s.profil = {style: 'mineur', classe: '', activite: 'regulier', focus: [], set: true};
  });
  g.styleRepose('mineur', 'mineur');
  assert.equal(g.S.day.focus, 'eco', 'le plan du joueur survit à une réponse identique');
  g.styleRepose('mineur', 'turtle');
  assert.equal(g.S.day.focus, 'eco', 'et à un changement de style');
});

/* Une carte qui demande d'ouvrir une page du jeu remplit ce que le copilote ne
   sait pas : la masquer prive le joueur de bien plus que sa rubrique. `defseen`
   commande `p.def`, dont dépendent aussi les satellites solaires — un raideur
   qui ne la voit plus perd son énergie la moins chère, et garde l'alerte
   « Satellites écartés » qui le renvoie vers une carte disparue. */
t('aucun style ne masque la carte qui fait lire la page Défense', () => {
  for (const style of Object.keys(app().PROFILS.styles)) {
    const g = app(PROFIL(style));
    assert.ok(g.dailyMissions().some(m => m.id === 'defseen'),
      `le style ${style} fait disparaître « Ouvrir la page Défense »`);
  }
});

t('les Réglages disent quand le modèle de défense vient du profil', () => {
  const h = lu(app(s => {
    s.settings.defModele = 'turtle';
    s.profil = {style: 'turtle', classe: '', activite: 'regulier', focus: [], set: true};
  }).VIEWS.settings());
  assert.ok(/Posé par ton profil \(<b>Turtle<\/b>\)/.test(h), 'la note nomme le style');
  const autre = lu(app(s => {
    s.settings.defModele = 'vetter';
    s.profil = {style: 'turtle', classe: '', activite: 'regulier', focus: [], set: true};
  }).VIEWS.settings());
  assert.ok(!/Posé par ton profil/.test(autre), 'et se tait dès que le joueur en a choisi un autre');
});

/* La relecture de la PR a trouvé que `combat` n'était attribuée à aucune carte :
   le 0 du mineur et du turtle ne pesait sur rien, et le contrat annoncé — « une
   catégorie à 0 ne sort pas » — était vrai sans l'être. Une catégorie qu'on
   pondère sans jamais l'attribuer est une promesse qui ne tient qu'à l'œil de
   qui relit la table. */
t('chaque catégorie pondérée est attribuée quelque part', () => {
  const P = app().PROFILS;
  const vues = new Set([].concat(
    Object.values(P.actes.kinds), Object.values(P.actes.bat),
    Object.values(P.actes.tech), Object.values(P.actes.vaisseaux),
    Object.values(P.missions.q), Object.values(P.missions.id)));
  for (const c of Object.keys(P.cats))
    assert.ok(vues.has(c), `la catégorie « ${c} » est pondérée mais aucune carte ne la porte`);
});

t('un turtle lit sa défense avant les chasseurs, un fleeter l\'inverse', () => {
  const def = {kind: 'def', ships: {rl: 20}}, chasse = {kind: 'shipbuild', ships: {lf: 12}};
  const poids = (g, a) => g.poidsCat(g.catActe(a));
  const tu = app(PROFIL('turtle'));
  assert.ok(poids(tu, def) > poids(tu, chasse), 'le turtle fortifie');
  const fl = app(PROFIL('fleeter'));
  assert.ok(poids(fl, chasse) > poids(fl, def), 'le fleeter arme');
});

/* « Refaire le questionnaire » ouvrait une porte sans sortie : tant que les
   trois réponses n'étaient pas recliquées, l'assistant restait en tête
   d'Aujourd'hui, au-dessus de la carte que le joueur vient lire. */
t('l\'assistant se referme sans qu\'on reclique les trois réponses', () => {
  const vierge = app(s => { s.profil = {style: '', classe: '', activite: 'regulier', focus: [], set: false}; });
  assert.ok(!/data-pferme/.test(vierge.profilCard(0)),
    'rien à refermer tant qu\'aucun style n\'est choisi : il n\'y a pas de profil derrière');
  const refait = app(s => { s.profil = {style: 'turtle', classe: '', activite: 'regulier', focus: [], set: false}; });
  assert.ok(/data-pferme="1"/.test(refait.profilCard(0)), 'qui a déjà un style peut refermer');
  assert.ok(/data-pferme="1"/.test(refait.profilCard(2)), 'à n\'importe quelle étape');
});

/* Le garde d'origine ne regardait que dans un sens : il refusait une catégorie
   pondérée que personne ne porte, jamais une carte qui ne relève d'aucune
   catégorie. C'est par là que six bâtiments — robot, chantier, labo, nanites,
   terraformeur, dock — sont restés au poids neutre sans que rien ne le dise,
   et sans qu'aucun focus puisse les remonter. Le joueur l'a vu avant les
   tests, en lisant la liste des focus. */
t('aucun bâtiment n\'échappe aux catégories', () => {
  const g = app();
  const sans = Object.keys(g.B).filter(k => !g.PROFILS.actes.bat[k]);
  assert.deepEqual(sans, [], 'bâtiments sans catégorie : ' + sans.map(k => g.B[k].n).join(', '));
});

t('aucun vaisseau constructible n\'échappe aux catégories', () => {
  const g = app();
  /* Le vaisseau de colonisation est la seule exception, et elle est dans la
     table : il ne sort pas du chantier comme un lot, il a sa propre carte, que
     rien ne pondère. */
  const sans = Object.keys(g.SHIPS).filter(k => k !== 'col' && !g.PROFILS.actes.vaisseaux[k]);
  assert.deepEqual(sans, [], 'vaisseaux sans catégorie : ' + sans.map(k => g.SHIPS[k].n).join(', '));
});

t('les huit focus se cochent depuis le panneau', () => {
  const h = lu(app(PROFIL('turtle')).VIEWS.today());
  for (const k of ['mines', 'stock', 'infra', 'def', 'expo', 'raids', 'combat', 'recherche'])
    assert.ok(h.includes(`data-pfocus="${k}"`), `le focus ${k} est proposé`);
  assert.ok(h.includes('Installations'), 'les installations ont leur case');
  assert.ok(h.includes('Stockage'), 'le stockage aussi');
});

/* Un libellé qui promet plus qu'il ne tient fait douter du panneau entier. */
t('le focus Recherche dit qu\'il ne porte pas les formes de vie', () => {
  const g = app();
  assert.deepEqual(g.PROFILS.focus.recherche.cats, ['techdef', 'techeco'],
    'il ne pousse que les deux familles de technologies');
  assert.ok(/armes et économie/i.test(g.PROFILS.focus.recherche.n),
    'et son libellé le dit : ' + g.PROFILS.focus.recherche.n);
  /* La case a la place de le dire, la ligne du profil non : elle doit tenir
     sur une ligne, et c'est là que le joueur lit son profil d'un coup d'œil. */
  const ligne = app(PROFIL('turtle', {focus: ['recherche', 'expo']})).profilLigne();
  assert.ok(!/armes et économie/.test(ligne), 'la ligne garde le nom court : ' + ligne);
  assert.ok(ligne.endsWith('+ Recherche, Expéditions'), ligne);
});

t('cocher Installations remonte le labo et le chantier', () => {
  const nu = app(PROFIL('mineur')), focalise = app(PROFIL('mineur', {focus: ['infra']}));
  assert.equal(nu.poidsCat('infra'), 2, 'sans focus, une installation garde sa place');
  assert.equal(focalise.poidsCat('infra'), 3, 'avec, elle passe devant');
});

/* Le joueur a coché « Expéditions » en Explorateur et n'a rien vu bouger. Il
   avait raison : ce style met déjà la catégorie à 3, et le +2 du focus est
   plafonné là — la case ne pouvait rien faire. Une case qui ne peut pas agir
   et qui n'en dit rien laisse croire que le panneau ne répond pas. */
t('un focus que le style met déjà au maximum le dit', () => {
  const ex = app(PROFIL('explorateur'));
  assert.equal(ex.poidsCat('expo'), 3, 'un explorateur est déjà au plafond côté expéditions');
  assert.ok(ex.focusInerte('expo'), 'donc le focus Expéditions ne peut rien ajouter');
  assert.ok(/Expéditions[^<]*<span class="note">· déjà au max/.test(ex.profilFocusHtml()),
    'et la case l\'annonce');

  const mi = app(PROFIL('mineur'));
  assert.ok(!mi.focusInerte('expo'), 'chez un mineur, le même focus agit');
  assert.ok(!/Expéditions[^<]*déjà au max/.test(mi.profilFocusHtml()), 'et sa case ne dit rien');
});

/* Un plafond d'activité retient la catégorie plus bas que le focus ne la
   pousserait : le focus est alors inerte lui aussi, pour une autre raison. */
t('« Peu présent » rend inerte le focus Flotte de combat', () => {
  /* Un raideur, et non un fleeter : celui-ci est déjà à 3 en combat, donc son
     focus y est inerte de toute façon, pour l'autre raison. Le raideur part de
     2, ce qui laisse voir le plafond agir — et c'est le test qui me l'a appris,
     j'avais écrit fleeter. */
  const g = app(PROFIL('raideur', {activite: 'peu'}));
  assert.equal(g.poidsCat('combat'), 1, 'le plafond le retient à 1');
  assert.ok(g.focusInerte('combat'), 'donc le cocher ne changerait rien');
  const actif = app(PROFIL('raideur', {activite: 'actif'}));
  assert.equal(actif.poidsCat('combat'), 2, 'sans plafond il part de 2');
  assert.ok(!actif.focusInerte('combat'), 'et le focus le monte à 3');
});

/* L'autre raison de ne rien voir bouger : la catégorie existe, mais aucune
   carte à l'écran ne la porte. Ça ne se sait qu'une fois le plan calculé. */
t('les focus qui n\'ont rien à déplacer sont nommés sous les cases', () => {
  const g = app(PROFIL('explorateur'));
  g.REFRESH.today();
  const dit = g.el('pfMuets').textContent;
  assert.ok(/Rien à déplacer pour l'instant/.test(dit), 'la ligne est là : ' + dit);
  /* Aucune carte de ce plan ne relève de la défense ni de la flotte de
     combat : ce sont celles-là qu'on doit lire. */
  assert.ok(/Défense/.test(dit), 'la défense en fait partie : ' + dit);
  assert.ok(/Flotte de combat/.test(dit), 'la flotte de combat aussi : ' + dit);
  assert.ok(!/Expéditions/.test(dit),
    'mais pas les expéditions, dont des cartes relèvent : ' + dit);
});

/* Les poids sont des réglages : les relire et les corriger ne doit pas obliger
   à relire la logique qui les applique. Un style nommé en dur dans app.js est
   le premier pas vers une table recopiée à deux endroits. */
t('les styles et leurs poids vivent dans profils.js, pas dans app.js', () => {
  const src = ['app.js', ...require('./modules').ordre('src/main.js').filter(f => f !== 'app.js')].map(f => require('fs').readFileSync(require('path').join(__dirname, '..', f), 'utf8')).join('\n');
  for (const k of ['mineur', 'turtle', 'raideur', 'fleeter', 'explorateur'])
    assert.ok(!src.includes(`'${k}'`), `app.js nomme le style ${k} : il doit passer par PROFILS`);
  const cfg = require('fs').readFileSync(require('path').join(__dirname, '..', 'profils.js'), 'utf8');
  assert.ok(/poids:/.test(cfg), 'et la table des poids y est');
});

/* ---------- le plan du pilleur ---------- */

/** Un labo assez haut pour que la feuille de route ait quelque chose à dire. */
const LABO7 = s => { s.planets.forEach(p => { p.b.lab = 7; }); };

t('en pillage, la recherche voit les cibles et y va vite', () => {
  const r = app(s => { LABO7(s); s.day.focus = 'raid'; }).nextResearch();
  const vise = r.list.map(x => x.k);
  assert.ok(vise.includes('espionage'), 'Espionnage, pour voir les inactifs');
  assert.ok(vise.indexOf('espionage') < vise.indexOf('plasma') || !vise.includes('plasma'),
    'avant la production, pas après');
  assert.ok(!vise.includes('weapons') && !vise.includes('shielding'),
    'aucune technologie de combat : l\'onglet Cibles ne pille que ce qui ne tire pas');
});

t('en pillage, Espionnage se justifie par les rapports, pas par Astrophysique', () => {
  const r = app(s => { LABO7(s); s.day.focus = 'raid'; }).nextResearch();
  const esp = r.list.find(x => x.k === 'espionage');
  assert.ok(esp && !/Astrophysique/.test(esp.why), 'sa raison est la sienne : ' + (esp && esp.why));
});

t('en pillage, Astrophysique revient dès que les cases sont prises', () => {
  const r = app(s => {
    LABO7(s); s.day.focus = 'raid';
    s.tech.astro = 1; s.tech.espionage = 4; s.tech.impulse = 3;
  }).nextResearch();
  assert.ok(r.list.some(x => x.k === 'astro'),
    'le plafond la remet, même absente de la feuille de route');
});

t('le pilleur n\'a pas de centre, comme le joueur de flotte', () => {
  assert.equal(app(s => { s.day.focus = 'raid'; }).centreIndex(), -1, 'aucun centre');
  const h = lu(app(s => { s.day.focus = 'raid'; }).VIEWS.planets());
  assert.ok(/Pillage d'inactifs : pas de centre/.test(h), 'et la carte dit pourquoi');
});


/* ---------- le modèle de défense ---------- */

/* Les trois planètes des critères d'acceptation. La première est celle de
   l'énoncé : 13 lanceurs de plasma, 54 canons de Gauss, et tout le reste du
   Framework mineur déjà au sol. Les niveaux sont ceux qu'il faut pour que rien
   ne soit hors de portée, sans quoi le manque se doublerait d'un prérequis. */
const DEFENSE = s => {
  s.tech = Object.assign(s.tech, {laser: 12, ion: 5, energy: 8, plasma: 7, weapons: 3, shielding: 6});
  s.planets[0].b.shipyard = 8;
  s.planets[0].defs = {rl: 800, ll: 500, hl: 200, ic: 0, gc: 54, pt: 13, sd: 1, ld: 1};
  s.planets[1].b.shipyard = 8;
  s.planets[1].defs = {rl: 40, ll: 25, hl: 10, ic: 0, gc: 4, pt: 1, sd: 1, ld: 1};
  /* Une troisième, nue mais capable : elle montre le manque entier. */
  s.planets.push({id: 'trois', name: 'Avant-poste', coords: '1:142:4', tmax: 30,
    b: Object.assign({}, s.planets[1].b, {shipyard: 8}), sats: 0, ships: {}, shipsAt: 0,
    defs: {}, stock: {m: 5e6, c: 5e6, d: 5e6, at: 0}});
};
/** Le manque d'une pièce dans un plan. */
const dManque = (d, k) => { const l = d.lignes.find(x => x.k === k); return l ? l.manque : null; };
const dCible = (d, k) => { const l = d.lignes.find(x => x.k === k); return l ? l.cible : null; };

t('les six modèles du wiki sont proposés, plus le perso', () => {
  const g = app();
  assert.deepEqual(Object.keys(g.DEF_MODELES),
    ['framework', 'balanced', 'vetter', 'turtle', 'fodder', 'plasma', 'perso']);
  assert.equal(g.S.settings.defModele, 'framework', 'et le Framework mineur par défaut');
});

t('Framework mineur, palier 20 : 7 lanceurs de plasma et 26 Gauss manquent', () => {
  const g = app(DEFENSE);
  const d = g.defPlan(g.S.planets[0]);
  assert.equal(d.nom, 'Framework mineur');
  assert.equal(dManque(d, 'pt'), 7, '20 visés, 13 au sol');
  assert.equal(dManque(d, 'gc'), 26, '80 visés, 54 au sol');
  assert.equal(dManque(d, 'll'), 0, 'les lasers légers sont au complet');
  assert.equal(dManque(d, 'hl'), 0, 'les lasers lourds aussi');
  /* Le coût ne compte que le manque : 7 lanceurs de plasma et 26 Gauss. */
  assert.deepEqual(d.cout, [7 * 50000 + 26 * 20000, 7 * 50000 + 26 * 15000, 7 * 30000 + 26 * 2000]);
});

t('Balanced Defense change les manques sur la même planète', () => {
  const g = app(s => { DEFENSE(s); s.settings.defModele = 'balanced'; });
  const d = g.defPlan(g.S.planets[0]);
  /* 20 lanceurs de plasma visés sur un modèle qui en veut 5 : facteur 4. */
  assert.equal(dCible(d, 'ic'), 80, '20 artilleries par lanceur de plasma, facteur 4');
  assert.equal(dManque(d, 'ic'), 80, 'aucune au sol');
  assert.equal(dManque(d, 'gc'), 0, '40 visés, 54 au sol');
  assert.equal(dManque(d, 'pt'), 7);
});

t('une planète peut prendre un autre modèle que les réglages', () => {
  const g = app(s => { DEFENSE(s); s.planets[0].defModele = 'plasma'; });
  const d = g.defPlan(g.S.planets[0]);
  assert.equal(d.modele, 'plasma', 'la surcharge passe devant le réglage global');
  assert.equal(dCible(d, 'gc'), 0, 'ce modèle ne veut aucun Gauss');
  assert.equal(g.defPlan(g.S.planets[1]).modele, 'framework', 'les autres gardent le global');
});

t('une planète peut aussi prendre son propre palier', () => {
  const g = app(s => { DEFENSE(s); s.planets[0].defPalier = 40; });
  assert.equal(dCible(g.defPlan(g.S.planets[0]), 'pt'), 40);
  assert.equal(dCible(g.defPlan(g.S.planets[1]), 'pt'), 20, 'le global reste à 20');
});

t('« compléter » cale le palier sur les lanceurs de plasma déjà au sol', () => {
  const g = app(s => { DEFENSE(s); s.settings.defPalier = 'fill'; });
  const d = g.defPlan(g.S.planets[0]);
  assert.equal(d.palier, 13, 'treize au sol, treize visés');
  assert.equal(dManque(d, 'pt'), 0, 'rien à ajouter de ce côté');
  assert.equal(dCible(d, 'gc'), 52, '4 Gauss par lanceur de plasma');
  assert.equal(dManque(d, 'gc'), 0, '54 au sol, 52 suffisent');
});

t('un excédent s\'affiche sans jamais rogner le calcul', () => {
  const g = app(s => { DEFENSE(s); s.planets[0].defs.rl = 2000; });
  const d = g.defPlan(g.S.planets[0]);
  const l = d.lignes.find(x => x.k === 'rl');
  assert.equal(l.manque, 0, 'un manque ne devient jamais négatif');
  assert.equal(l.exces, 1200, '800 visés, 2000 au sol');
  assert.deepEqual(l.cout, [0, 0, 0], 'et il ne rapporte rien au budget');
  assert.equal(dManque(d, 'pt'), 7, 'le reste du plan ne bouge pas');
});

t('les deux boucliers sont hors modèle : comptés, jamais demandés', () => {
  const g = app(DEFENSE);
  const d = g.defPlan(g.S.planets[0]);
  assert.equal(dCible(d, 'sd'), 0);
  assert.equal(dManque(d, 'ld'), 0);
  assert.ok(d.lignes.find(l => l.k === 'sd').hors, 'au sol, donc « hors modèle »');
  const nus = app(s => { DEFENSE(s); delete s.planets[0].defs.sd; delete s.planets[0].defs.ld; });
  assert.equal(dCible(nus.defPlan(nus.S.planets[0]), 'sd'), null, 'absents : rien à dire');
});

t('un prérequis manquant est nommé, bâtiment et recherche', () => {
  const g = app(s => { DEFENSE(s); s.planets[0].b.shipyard = 4; s.tech.plasma = 0; });
  const l = g.defPlan(g.S.planets[0]).lignes.find(x => x.k === 'pt');
  assert.ok(/Chantier spatial 8/.test(l.req), 'le chantier : ' + l.req);
  assert.ok(/Plasma 7/.test(l.req), 'et la recherche : ' + l.req);
  const h = lu(g.VIEWS.defense());
  assert.ok(/Plasma : nécessite|PL : nécessite/.test(h), 'et la carte le dit');
});

t('un prérequis ne se signale que s\'il bloque quelque chose', () => {
  // le modèle plasma pur ne veut aucun Gauss : son prérequis absent n'est pas un problème
  const g = app(s => { DEFENSE(s); s.planets[0].defModele = 'plasma'; s.tech.weapons = 0; });
  assert.ok(g.defPlan(g.S.planets[0]).lignes.every(l => !l.req), 'rien à signaler');
});

t('la carte dit si la planète peut payer son manque', () => {
  const g = app(s => { DEFENSE(s); s.planets[0].stock = {m: 1e9, c: 1e9, d: 1e9, at: 0}; });
  assert.equal(g.defPlan(g.S.planets[0]).payable, true);
  const pauvre = app(s => { DEFENSE(s); s.planets[0].stock = {m: 1000, c: 1000, d: 0, at: 0}; });
  assert.equal(pauvre.defPlan(pauvre.S.planets[0]).payable, false);
});

t('une défense jamais relevée ne réclame rien', () => {
  const g = app(s => { DEFENSE(s); delete s.planets[0].defs; delete s.planets[0].def; });
  assert.equal(g.defPlan(g.S.planets[0]), null, 'inconnu n\'est pas zéro');
  assert.ok(/jamais relevée/.test(lu(g.defCarte(g.S.planets[0]))), 'et la carte le dit plutôt que de chiffrer');
});

t('les trois planètes de test sortent chacune leur tableau', () => {
  const g = app(DEFENSE);
  const h = lu(g.VIEWS.defense());
  for (const p of g.S.planets) assert.ok(h.includes(p.name), p.name + ' est dans la carte');
  assert.ok(/Avant-poste/.test(h));
  /* La planète nue doit son modèle entier : 800 lanceurs de missiles. */
  const d = g.defPlan(g.S.planets[2]);
  assert.equal(dManque(d, 'rl'), 800);
  assert.equal(dManque(d, 'pt'), 20);
});

t('le ratio perso se saisit, se valide et voyage avec les réglages', () => {
  const g = app(s => {
    DEFENSE(s);
    s.settings.defModele = 'perso';
    s.settings.defPerso = {rl: 10, ll: '5', hl: -3, ic: null, gc: 'x', pt: 1};
  });
  g.sainEtat();
  assert.deepEqual(g.S.settings.defPerso, {rl: 10, ll: 5, hl: 0, ic: 0, gc: 0, pt: 1},
    'des nombres entiers, jamais négatifs');
  const d = g.defPlan(g.S.planets[0]);
  assert.equal(dCible(d, 'rl'), 200, '10 par lanceur de plasma, palier 20');
  assert.equal(dCible(d, 'gc'), 0, 'zéro reste zéro');
  assert.deepEqual(g.syncOut()['sy:settings'].defPerso, g.S.settings.defPerso,
    'et il part sur l\'autre poste avec le reste des réglages');
});

t('un ratio perso sans lanceur de plasma ne divise pas par zéro', () => {
  const g = app(s => {
    DEFENSE(s);
    s.settings.defModele = 'perso';
    s.settings.defPerso = {rl: 40, ll: 25, hl: 0, ic: 0, gc: 0, pt: 0};
  });
  const d = g.defPlan(g.S.planets[0]);
  assert.equal(d.ancre, 'rl', 'le palier se compte alors en lanceurs de missiles');
  assert.equal(dCible(d, 'll'), Math.ceil(25 * 20 / 40));
  assert.ok(d.lignes.every(l => Number.isFinite(l.cible)), 'aucune cible infinie');
});

t('un modèle ou un palier venus d\'ailleurs sont écartés', () => {
  const g = app(s => {
    DEFENSE(s);
    s.settings.defModele = 'inconnu';
    s.settings.defPalier = 999;
    s.planets[0].defModele = '<script>';
    s.planets[0].defPalier = 7;
  });
  g.sainEtat();
  assert.equal(g.S.settings.defModele, 'framework');
  assert.equal(g.S.settings.defPalier, 20);
  assert.equal(g.S.planets[0].defModele, undefined, 'la surcharge douteuse part');
  assert.equal(g.S.planets[0].defPalier, undefined, 'et le palier hors menu aussi');
});

t('le palier « compléter » survit à sainEtat', () => {
  const g = app(s => { DEFENSE(s); s.settings.defPalier = 'fill'; s.planets[0].defPalier = 'fill'; });
  g.sainEtat();
  assert.equal(g.S.settings.defPalier, 'fill');
  assert.equal(g.S.planets[0].defPalier, 'fill');
});

t('l\'onglet Défense se dessine sans toucher au jeu', () => {
  const g = app(s => { DEFENSE(s); s.ui.tool = 'defense'; });
  const h = lu(g.VIEWS.tools());
  assert.ok(/Modèle de défense/.test(h), 'la carte est là');
  assert.ok(/Framework mineur/.test(h));
  assert.ok(!/data-launch|data-sent/.test(h), 'aucun bouton d\'action : lecture seule');
});

t('les Réglages proposent le modèle, et le ratio perso quand il est choisi', () => {
  const sans = lu(app(DEFENSE).VIEWS.settings());
  assert.ok(/Palier visé/.test(sans));
  assert.ok(!/sDefR-rl/.test(sans), 'pas de cases de ratio hors modèle perso');
  const avec = lu(app(s => { DEFENSE(s); s.settings.defModele = 'perso'; }).VIEWS.settings());
  assert.ok(/sDefR-rl/.test(avec), 'une case par pièce du ratio');
  assert.ok(!/sDefR-sd/.test(avec), 'sauf les boucliers, hors ratio');
});

t('les Réglages proposent le plancher au Mineur, et la durée max à tous', () => {
  const mineur = lu(app(s => { DEFENSE(s); s.profil = {style: 'mineur', classe: '', activite: 'regulier', focus: [], set: true}; }).VIEWS.settings());
  assert.ok(/id="sDefF"/.test(mineur) && /Comme le profil \(2\)/.test(mineur), 'le plancher du Mineur');
  assert.ok(/id="sDefD"/.test(mineur), 'la durée max');
  const raideur = lu(app(s => { DEFENSE(s); s.profil = {style: 'raideur', classe: '', activite: 'regulier', focus: [], set: true}; }).VIEWS.settings());
  assert.ok(!/id="sDefF"/.test(raideur), 'pas de plancher sans profil qui en porte');
  const g = app(s => { DEFENSE(s); s.settings.defPlancher = 7; s.settings.defDuree = 99; });
  g.sainEtat();
  assert.equal(g.S.settings.defPlancher, null, 'un plancher hors menu retombe sur le profil');
  assert.equal(g.S.settings.defDuree, 4, 'une durée hors menu retombe à 4 h');
});

t('une sauvegarde d\'avant le modèle de défense en reçoit un', () => {
  const g = app(s => { DEFENSE(s); delete s.settings.defModele; delete s.settings.defPalier; delete s.settings.defPerso; });
  assert.equal(g.S.settings.defModele, 'framework');
  assert.equal(g.S.settings.defPalier, 20);
  assert.ok(g.defPlan(g.S.planets[0]), 'et le calcul tourne quand même');
});

/* ---------- la recette des modèles, en clair ---------- */

/* Intl écrit ses milliers avec une espace insécable fine : on la ramène à une
   espace pour comparer au tableau de la demande. */
const esp = s => String(s).replace(/[  ]/g, ' ');
const RECETTES = {
  framework: ['Pour 1 PL : 40 LM / 25 LL / 10 LLo / 4 Gauss', '', '307,5 k M / 142,5 k C / 38 k D'],
  balanced: ['Pour 100 LL : 20 LM / 10 LLo / 10 Gauss / 20 Ions / 5 PL', 'Pour 1 PL : 4 LM / 20 LL / 2 LLo / 2 Gauss / 4 Ions', '800 k M / 530 k C / 170 k D'],
  vetter: ['Pour 1 PL : 270 LM / 180 LL / 45 LLo / 5 Gauss / 15 Ions', '', '1,305 M M / 350 k C / 40 k D'],
  turtle: ['Pour 40 PL : 1 000 LM / 1 000 LL / 400 LLo / 100 Gauss / 100 Ions', 'Pour 1 PL : 25 LM / 25 LL / 10 LLo / 2,5 Gauss / 2,5 Ions', '10,4 M M / 5,1 M C / 1,4 M D'],
  fodder: ['Pour 9 PL : 900 LM / 300 LL / 50 LLo / 18 Gauss / 30 Ions', 'Pour 1 PL : 100 LM / 33,3 LL / 5,6 LLo / 2 Gauss / 3,3 Ions', '3,51 M M / 1,06 M C / 306 k D'],
  plasma: ['Pour 1 PL : 50 LM', '', '150 k M / 50 k C / 30 k D'],
};
t('chaque modèle du wiki a sa recette, sa version à 1 PL et son pack', () => {
  const g = app();
  for (const [k, [nat, pl, cout]] of Object.entries(RECETTES)) {
    const m = g.defModele(k);
    assert.equal(esp(g.formatRecipe(m, {per: 'native'})), nat, k + ' natif');
    if (pl) assert.equal(esp(g.formatRecipe(m, {per: 'PL'})), pl, k + ' à 1 PL');
    assert.equal(esp(g.packText(g.packCost(m))), cout, k + ' pack');
    const carte = esp(lu(g.defModeleCarte(k)).replace(/<[^>]+>/g, ''));
    assert.ok(carte.includes(nat), k + ' : la carte porte la recette native');
    assert.equal(/Pour 1 PL : \d/.test(carte.replace(nat, '')), !!pl, k + ' : la ligne à 1 PL seulement hors ancre 1 PL');
    assert.ok(lu(g.defModeleCarte(k)).includes('Defense_Build_Strategies'), k + ' : le lien source');
  }
});
t('le pack se calcule sur la table DEF, pas sur des prix recopiés', () => {
  const g = app();
  g.DEF.gc.c = [1, 2, 3];
  assert.deepEqual(g.packCost({r: {gc: 2}}), [2, 4, 6]);
});
t('le ratio perso : ancre par défaut, 1 PL / 15 Gauss', () => {
  const g = app(s => { s.settings.defModele = 'perso'; s.settings.defPerso = {rl: 0, ll: 0, hl: 0, ic: 0, gc: 15, pt: 1}; });
  const m = g.defModele('perso');
  assert.equal(esp(g.formatRecipe(m)), 'Pour 1 PL : 15 Gauss');
  assert.equal(esp(g.packText(g.packCost(m))), '350 k M / 275 k C / 60 k D');
  const sans = g.defModele('perso'); sans.r = {rl: 40, ll: 0, hl: 0, ic: 0, gc: 4, pt: 0};
  assert.equal(esp(g.formatRecipe(sans)), 'Pour 4 Gauss : 40 LM', 'sans PL, la pièce la plus chère');
  assert.equal(g.formatRecipe(sans, {per: 'PL'}), '', 'et pas de ligne à 1 PL');
});
t('une abréviation dit son nom complet et son prix', () => {
  const g = app();
  assert.equal(esp(g.defUniteTitre('hl')), 'Artillerie laser lourde : 6 000 M / 2 000 C');
  assert.ok(/<abbr title="Artillerie laser lourde/.test(g.defRecetteHtml(g.defModele('framework'))));
});
t('le sélecteur écrit sous chaque nom sa recette et son pack', () => {
  const g = app(DEFENSE);
  const h = esp(lu(g.VIEWS.settings()));
  for (const k of Object.keys(RECETTES)) assert.ok(h.includes(RECETTES[k][0] + ' · ' + RECETTES[k][2]), k + ' dans le menu');
  assert.ok(/data-defpick="perso"/.test(h), 'le perso y est aussi');
  const d = lu(g.VIEWS.defense());
  assert.ok(/data-defpick="" data-dp=/.test(d), 'et chaque planète garde « Comme les réglages »');
  assert.ok(!/data-launch|data-sent/.test(d), 'toujours en lecture seule');
});

/* ---------- masquer la pub, le bandeau et le chat ---------- */

const MASQUE_CONF = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'config', 'hide-selectors.json'), 'utf8'));

t('masque.css et masque-conf.js sont ceux que donne le JSON des sélecteurs', () => {
  const fs = require('fs'), path = require('path');
  const { cssDe, confDe } = require('../config/masque-css.js');
  const root = path.join(__dirname, '..');
  assert.equal(fs.readFileSync(path.join(root, 'masque.css'), 'utf8'), cssDe(MASQUE_CONF),
    'masque.css ne suit plus config/hide-selectors.json : lance node config/masque-css.js');
  assert.equal(fs.readFileSync(path.join(root, 'masque-conf.js'), 'utf8'), confDe(MASQUE_CONF));
});

t('chaque interrupteur ne masque que ses éléments, sous sa propre classe', () => {
  const { cssDe } = require('../config/masque-css.js');
  const css = cssDe(MASQUE_CONF);
  for (const k of ['pub', 'bandeau', 'chat']) {
    assert.ok(MASQUE_CONF[k].masquer.length, k + ' masque au moins un élément');
    for (const sel of MASQUE_CONF[k].masquer) {
      assert.ok(css.includes(`html.cp-hide-${k} ${sel}`), sel + ' sous cp-hide-' + k);
      for (const autre of ['pub', 'bandeau', 'chat'].filter(x => x !== k))
        assert.ok(!css.includes(`html.cp-hide-${autre} ${sel},`) && !css.includes(`html.cp-hide-${autre} ${sel}{`), sel + ' ne dépend pas de ' + autre);
    }
  }
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'masque.js'), 'utf8');
  assert.ok(!/innerHTML\s*=|\.click\(\)|fetch\(|XMLHttpRequest|sendBeacon|\.submit\(/.test(src),
    'masque.js ne réécrit rien, ne clique rien, n\'appelle aucun serveur');
  for (const l of src.split('\n').filter(x => /\.remove\(\)/.test(x)))
    assert.ok(/pastille|vieille|p\.remove/i.test(l), 'masque.js ne retire du DOM que sa propre pastille : ' + l.trim());
});

t('ni les ressources, ni les planètes, ni le menu, ni les alertes ne se masquent', () => {
  const tous = [].concat(...['pub', 'bandeau', 'chat'].map(k => MASQUE_CONF[k].masquer.concat(Object.keys(MASQUE_CONF[k].recaler || {}))));
  for (const interdit of ['resourcesbarcomponent', 'resources', 'planetList', 'menuTable', 'links',
    'newmessagesindicatorcomponent', 'eventboxContent', 'eventListWrap', 'attack_alert', 'notificationbarcomponent'])
    for (const sel of tous)
      assert.ok(!new RegExp('[#.]' + interdit + '(?![\\w-])').test(sel), sel + ' touche ' + interdit);
});

/** Le panneau en mode extension, avec les fonctions du masquage. */
function appMasque(modifier) {
  const st = fixtureState();
  st.planets.forEach(p => { p.stock.at = SOIR; });
  if (modifier) modifier(st);
  return loadApp(st, SOIR, ['masque', 'setMasque', 'masqueBascule', 'toutMasque', 'VIEWS', 'render', 'header'], null, true);
}

t('« Tout masquer » cache les trois, et « Tout afficher » les rend', () => {
  const g = appMasque();
  assert.deepEqual(g.masqueBascule({ pub: false, bandeau: false, chat: false }), { pub: true, bandeau: true, chat: true });
  assert.deepEqual(g.masqueBascule({ pub: true, bandeau: false, chat: true }), { pub: true, bandeau: true, chat: true }, 'à moitié masqué : tout se masque');
  assert.deepEqual(g.masqueBascule({ pub: true, bandeau: true, chat: true }), { pub: false, bandeau: false, chat: false });
});

t('un interrupteur du panneau s\'écrit dans le stockage partagé, que la page écoute', () => {
  const g = appMasque();
  g.setMasque({ pub: true, bandeau: false, chat: true });
  assert.deepEqual(g.shared().masque, { pub: true, bandeau: false, chat: true });
  assert.ok(/data-masque-tout>Tout masquer/.test(g.VIEWS.settings()));
  g.setMasque({ pub: true, bandeau: true, chat: true });
  assert.ok(/data-masque-tout>Tout afficher/.test(g.VIEWS.settings()), 'tout masqué : le raccourci rend tout');
});

t('les Réglages portent les trois cases, dans la carte « Page du jeu »', () => {
  const g = appMasque();
  g.setMasque({ pub: false, bandeau: true, chat: false });
  const h = g.VIEWS.settings();
  for (const k of ['pub', 'bandeau', 'chat']) assert.ok(h.includes(`data-masque="${k}"`), k + ' dans Réglages');
  assert.ok(/id="sMqbandeau" data-masque="bandeau" checked/.test(h), 'la case suit le choix');
  assert.ok(!/id="sMqpub" data-masque="pub" checked/.test(h));
  assert.ok(/data-masque-tout>Tout masquer/.test(h));
  const i = h.indexOf('<h2>Page du jeu</h2>');
  assert.ok(i >= 0 && h.indexOf('data-masque="pub"') > i, 'dans la carte Page du jeu');
  for (const n of ['Masquer la pub', 'Masquer la bannière', 'Masquer le chat']) assert.ok(h.includes(n), n);
});

t('jamais réglé : les trois sont masqués, et rien n\'est écrit', () => {
  // le harnais répond {} à la première lecture du stockage partagé : installation neuve
  const g = appMasque();
  assert.deepEqual(g.masque, { pub: true, bandeau: true, chat: true });
  assert.equal(g.shared().masque, undefined, 'le défaut ne s\'écrit pas : il ne pourra rien écraser');
  const h = g.VIEWS.settings();
  for (const k of ['pub', 'bandeau', 'chat']) assert.ok(new RegExp(`id="sMq${k}" data-masque="${k}" checked`).test(h), k + ' cochée par défaut');
});

t('un choix déjà enregistré n\'est pas écrasé par le défaut', () => {
  const st = fixtureState(); st.planets.forEach(p => { p.stock.at = SOIR; });
  st.__win = { __masque: { pub: false, bandeau: false, chat: false } };
  const g = loadApp(st, SOIR, ['masque'], null, true);
  assert.deepEqual(g.masque, { pub: false, bandeau: false, chat: false });
  const st2 = fixtureState(); st2.planets.forEach(p => { p.stock.at = SOIR; });
  st2.__win = { __masque: { pub: false } };
  assert.deepEqual(loadApp(st2, SOIR, ['masque'], null, true).masque, { pub: false, bandeau: true, chat: true }, 'une clé absente prend le défaut, la présente reste');
});

t('l\'en-tête ne porte plus le mode lune, ni la disposition, ni le masquage', () => {
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', 'sidepanel.html'), 'utf8');
  for (const id of ['luneBtn', 'cartesBtn', 'masqueBtn', 'masqueMenu']) assert.ok(!html.includes(`id="${id}"`), id);
  for (const id of ['appVer', 'uniBadge', 'tzBtn', 'tzLbl', 'nightBtn', 'gearBtn']) assert.ok(html.includes(`id="${id}"`), id + ' reste');
  const src = ['app.js', ...require('./modules').ordre('src/main.js').filter(f => f !== 'app.js')].map(f => require('fs').readFileSync(require('path').join(__dirname, '..', f), 'utf8')).join('\n');
  for (const id of ['luneBtn', 'cartesBtn', 'masqueBtn', 'masqueMenu']) assert.ok(!src.includes(id), id + ' n\'a plus de référence dans app.js');
});

/** Un document de page du jeu, juste assez pour masque.js. */
function pageMasque({ sync, local, compteurs = [] } = {}) {
  const classes = new Set(), byId = new Map(), listeners = [], observers = [];
  const el = (tag) => {
    const e = { tagName: tag, textContent: '', title: '', attrs: {}, on: {},
      setAttribute(k, v) { this.attrs[k] = v; },
      addEventListener(t, f) { (this.on[t] = this.on[t] || []).push(f); },
      remove() { if (this.id) byId.delete(this.id); this.parent = null; } };
    Object.defineProperty(e, 'id', { get() { return this._id; }, set(v) { this._id = v; } });
    return e;
  };
  const html = { classList: { add: c => classes.add(c), remove: c => classes.delete(c),
    toggle: (c, on) => { if (on) classes.add(c); else classes.delete(c); }, contains: c => classes.has(c) } };
  const doc = {
    documentElement: html, readyState: 'loading',
    body: { appendChild(n) { n.parent = this; if (n.id) byId.set(n.id, n); } },
    getElementById: id => byId.get(id) || null,
    createElement: el,
    querySelectorAll: () => compteurs,
    addEventListener() {}
  };
  let syncCb = null, localCb = null;
  const chrome = {
    runtime: { id: 'x' },
    storage: {
      sync: { get(k, cb) { syncCb = () => cb(sync === undefined ? {} : { masque: sync }); } },
      local: { get(k, cb) { localCb = () => cb(local || {}); } },
      onChanged: { addListener: f => listeners.push(f) }
    }
  };
  class MO { constructor(f) { this.f = f; observers.push(this); } observe() { this.on = true; } disconnect() { this.on = false; } }
  const { demarre } = require('../masque.js');
  const api = demarre({ doc, chrome, conf: MASQUE_CONF, win: { addEventListener() {} }, MO });
  return { api, classes, byId, observers,
    repondSync: () => syncCb && syncCb(), repondLocal: () => localCb && localCb(),
    change: v => listeners.forEach(f => f({ masque: { newValue: v } }, 'sync')) };
}

t('rien ne clignote : tout attend masqué que les choix soient lus', () => {
  const p = pageMasque({ sync: { pub: true, bandeau: false, chat: false } });
  assert.ok(p.classes.has('cp-masque-attente'), 'avant la réponse du stockage, la page attend');
  p.repondSync();
  assert.ok(!p.classes.has('cp-masque-attente'), 'l\'attente se lève une fois les choix lus');
  assert.ok(p.classes.has('cp-hide-pub') && !p.classes.has('cp-hide-bandeau') && !p.classes.has('cp-hide-chat'));
  const { cssDe } = require('../config/masque-css.js');
  for (const k of ['pub', 'bandeau', 'chat']) for (const sel of MASQUE_CONF[k].masquer)
    assert.ok(cssDe(MASQUE_CONF).includes('html.cp-masque-attente ' + sel), sel + ' est caché pendant l\'attente');
});

t('un interrupteur changé ailleurs s\'applique sans recharger', () => {
  const p = pageMasque({ sync: { pub: false, bandeau: false, chat: false } });
  p.repondSync();
  assert.ok(![...p.classes].some(c => c.startsWith('cp-hide-')));
  p.change({ pub: true, bandeau: true, chat: true });
  assert.ok(['pub', 'bandeau', 'chat'].every(k => p.classes.has('cp-hide-' + k)));
  p.change({ pub: false, bandeau: false, chat: false });
  assert.ok(![...p.classes].some(c => c.startsWith('cp-hide-')));
});

t('jamais réglé : la page masque les trois, sans clignoter', () => {
  const p = pageMasque({ sync: undefined });
  assert.ok(p.classes.has('cp-masque-attente'), 'tout attend masqué');
  p.repondSync();
  assert.ok(['pub', 'bandeau', 'chat'].every(k => p.classes.has('cp-hide-' + k)), 'le défaut masque les trois');
  assert.ok(!p.classes.has('cp-masque-attente'));
  const q = pageMasque({ sync: { chat: false } });
  q.repondSync();
  assert.ok(q.classes.has('cp-hide-pub') && q.classes.has('cp-hide-bandeau') && !q.classes.has('cp-hide-chat'), 'un choix enregistré à false reste visible');
});

t('chat masqué : un message fait sortir la pastille, un clic rouvre le chat', () => {
  const compteurs = [];
  const p = pageMasque({ sync: { chat: true }, compteurs });
  p.repondSync();
  assert.ok(p.classes.has('cp-hide-chat'));
  assert.equal(p.observers.filter(o => o.on).length, 1, 'le chat se guette tant qu\'il est masqué');
  p.api.montre();
  assert.equal(p.byId.get('cp-pastille-chat'), undefined, 'pas de message, pas de pastille');
  compteurs.push({ textContent: '1' });
  p.api.montre();
  const past = p.byId.get('cp-pastille-chat');
  assert.ok(past, 'un non-lu : la pastille sort');
  assert.equal(past.textContent, '1 message');
  compteurs.push({ textContent: '2' });
  p.api.montre();
  assert.equal(past.textContent, '3 messages');
  past.on.click.forEach(f => f());
  assert.ok(!p.classes.has('cp-hide-chat'), 'le clic réaffiche le chat');
  assert.equal(p.byId.get('cp-pastille-chat'), undefined, 'et la pastille s\'en va');
  assert.equal(p.api.etat().chat, true, 'sans toucher à l\'interrupteur');
  assert.equal(p.observers.filter(o => o.on).length, 0, 'chat visible : plus rien à guetter');
  p.change({ chat: false });
  p.change({ chat: true });
  assert.ok(p.classes.has('cp-hide-chat'), 'rebasculé, l\'interrupteur reprend la main');
});

t('les lignes de chat de la page qui se charge ne comptent pas', () => {
  const p = pageMasque({ sync: { chat: true } });
  p.repondSync();
  const ligne = { nodeType: 1, closest: () => ({}), matches: () => true };
  assert.equal(p.api.compte([{ addedNodes: [ligne] }]), 0, 'l\'historique du chat arrive avec la page');
  p.api.ouvreCompte();
  assert.equal(p.api.compte([{ addedNodes: [ligne, { nodeType: 3 }] }]), 1, 'après, chaque ligne ajoutée compte');
  const ailleurs = { nodeType: 1, closest: () => null, matches: () => true };
  assert.equal(p.api.compte([{ addedNodes: [ailleurs] }]), 0, 'hors de la barre de chat, rien ne compte');
});

/* ---------- ce qui est ouvert reste ouvert ---------- */

/** La carte de mise à l'abri du soir, et sa clé d'affichage. */
const nuitDe = g => g.dailyMissions().find(m => m.id === 'night');
/** Le « Comment faire » d'une carte, tel que REFRESH.today l'écrit. */
const howDe = (html, key) => {
  const i = html.indexOf(`data-fold="${key}.comment-faire"`);
  return i < 0 ? null : html.slice(html.lastIndexOf('<details', i), i);
};

t("la clé d'une recommandation dit son type, sa règle, sa planète et sa cible", () => {
  const g = app();
  const m = nuitDe(g), k = g.missionKey(m);
  assert.ok(m, 'la fixture a sa carte du soir');
  assert.equal(k, `securite:fleetsave-nuit:mere:${String(m.dest).replace(/:/g, '-')}`);
});

t('la clé ne bouge pas quand les montants ou les heures de la carte changent', () => {
  const a = app(), b = app(s => { s.planets[0].stock.m = 160000; s.planets[0].stock.d = 25000; }, SOIR + 7 * 60e3);
  const ma = nuitDe(a), mb = nuitDe(b);
  assert.notEqual(ma.sol, mb.sol, 'préalable : le stock affiché a changé');
  assert.equal(a.missionKey(ma), b.missionKey(mb));
});

t('la carte de tête et ses voisines portent la même règle, chacune sa planète', () => {
  const g = app();
  const tete = g.missionKey({id: 'night', q: 'Sécurité', p: 0, dest: '1:142:16'});
  const autre = g.missionKey({id: 'night:colo', q: 'Sécurité', p: 1, dest: '1:142:16'});
  assert.equal(tete, 'securite:fleetsave-nuit:mere:1-142-16');
  assert.equal(autre, 'securite:fleetsave-nuit:colo:1-142-16');
});

t('« Comment faire » est fermé tant que le joueur ne l\'a pas ouvert', () => {
  const g = app();
  g.REFRESH.today();
  const k = g.missionKey(nuitDe(g)), h = howDe(g.html().tdNow, k);
  assert.ok(h != null, 'la section porte sa clé');
  assert.ok(!/\sopen/.test(h), 'fermée par défaut : ' + h);
});

t('« Comment faire » ouvert le reste quand une autre carte apparaît ou disparaît', () => {
  const g = app();
  const k = g.missionKey(nuitDe(g));
  g.uiNote(k + '.comment-faire', true);
  const cartes = () => (g.html().tdNow.match(/data-ck="/g) || []).length;
  g.REFRESH.today();
  assert.ok(/\sopen/.test(howDe(g.html().tdNow, k)), 'ouvert au premier dessin');
  const n0 = cartes();
  // une carte de plus : la colonie arrivée à évaluer
  g.S.colo.target = '1:142:9'; g.S.colo.sentAt = SOIR;
  g.REFRESH.today();
  assert.ok(cartes() > n0, 'préalable : une carte est bien apparue');
  assert.ok(/\sopen/.test(howDe(g.html().tdNow, k)), 'toujours ouvert après le changement de liste');
  // et une de moins : on écarte toutes les autres
  const n1 = cartes();
  for (const m of g.dailyMissions()) if (m.id !== 'night') g.S.daily.no['m:' + m.id] = SOIR;
  g.REFRESH.today();
  assert.ok(cartes() < n1, 'préalable : des cartes ont bien disparu');
  assert.ok(/\sopen/.test(howDe(g.html().tdNow, k)), 'toujours ouvert quand les voisines disparaissent');
});

t('« Comment faire » ouvert le reste quand ses propres montants changent', () => {
  const g = app();
  const k = g.missionKey(nuitDe(g));
  g.uiNote(k + '.comment-faire', true);
  g.S.planets[0].stock.m += 50000;
  g.REFRESH.today();
  assert.ok(/\sopen/.test(howDe(g.html().tdNow, k)));
});

t("l'état est lu avant le premier dessin, depuis le stockage du poste", () => {
  const g = app(s => { s.__ui = {etats: {journee: 'open', expeditions: 'closed', bidon: 'peut-être'}, vus: {}}; });
  assert.equal(g.uiOuvert('journee', false), true);
  assert.equal(g.uiOuvert('expeditions', true), false, 'le choix enregistré bat le défaut');
  assert.equal(g.UI.etats.bidon, undefined, 'une valeur inconnue est ignorée');
  assert.match(g.VIEWS.today(), /<details class="card" open><summary data-fold="journee">/);
});

t('une carte fixe est globale : sa clé ne porte pas la planète', () => {
  const g = app();
  g.uiNote('expeditions', true);
  assert.equal(g.fold('expeditions', false), ' open');
  g.S.centre = 'colo';
  assert.equal(g.fold('expeditions', false), ' open');
});

t('le clic du joueur est groupé puis écrit dans chrome.storage.local, hors de la sauvegarde', () => {
  const g = app();
  g.uiNote('journee', true); g.uiNote('aide', false);
  g.uiEcrit();
  assert.deepEqual(g.stored().uiState, {journee: 'open', aide: 'closed'});
  g.REFRESH.today(); g.uiEcrit();
  assert.ok(Object.keys(g.stored().uiSeen).some(k => k.startsWith('securite:fleetsave-nuit:')), 'la carte du soir a sa date');
  assert.equal(JSON.stringify(g.S).includes('"fold"'), false, 'rien dans S, donc rien dans save.json');
});

t('les replis rangés dans S.ui.fold passent dans le nouveau stockage', () => {
  const g = app(s => { s.ui.fold = {journee: true, aide: false}; });
  assert.equal(g.UI.etats.journee, 'open');
  assert.equal(g.UI.etats.aide, 'closed');
  assert.equal(g.S.ui.fold, undefined);
  assert.deepEqual(g.stored().uiState, {journee: 'open', aide: 'closed'}, 'écrit tout de suite');
});

t('une carte disparue depuis plus de 7 jours est oubliée, une carte revue dans les 24 h garde son état', () => {
  const vieux = new Date(SOIR - 8 * 86400e3).toISOString(), hier = new Date(SOIR - 20 * 3600e3).toISOString();
  const g = app(s => { s.__ui = {
    etats: {'a:x:p:c': 'open', 'a:x:p:c.comment-faire': 'open', 'b:y:p:c.comment-faire': 'open', journee: 'open'},
    vus: {'a:x:p:c': vieux, 'b:y:p:c': hier}}; });
  assert.equal(g.UI.etats['a:x:p:c'], undefined);
  assert.equal(g.UI.etats['a:x:p:c.comment-faire'], undefined, 'ses sections partent avec elle');
  assert.equal(g.UI.vus['a:x:p:c'], undefined);
  assert.equal(g.UI.etats['b:y:p:c.comment-faire'], 'open', 'revue hier : gardée');
  assert.equal(g.UI.etats.journee, 'open', 'une carte fixe ne se purge pas');
});

t('une alerte critique ouvre la carte sans toucher au choix enregistré', () => {
  const g = app();
  g.uiNote('alertes', false);
  assert.equal(g.fold('alertes', true, true), ' open', 'ouverte de force');
  assert.equal(g.UI.etats.alertes, 'closed', 'le choix reste');
  assert.equal(g.fold('alertes', true, false), '', "l'alerte passée, elle revient fermée");
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'vues', 'conseils.js'), 'utf8');
  assert.match(src, /fold\('conseils', false, critique\)/, 'le bloc des conseils passe la criticité');
});

t('le ⓘ ouvert le reste au dessin suivant', () => {
  const g = app();
  const [b0, w0] = g.whyParts(['Une raison. Puis le détail.'], 'k:1');
  assert.ok(/aria-expanded="false"/.test(b0) && / hidden>/.test(w0), 'fermé par défaut');
  g.uiNote('k:1.pourquoi', true);
  const [b1, w1] = g.whyParts(['Une raison. Puis le détail.'], 'k:1');
  assert.ok(/aria-expanded="true"/.test(b1) && !/hidden/.test(w1));
  assert.ok(/data-ui="k:1\.pourquoi"/.test(b1), 'le bouton dit quelle clé écrire');
});

t('« Fait », « Non » et la copie ne touchent pas à l\'affichage des cartes', () => {
  const src = ['app.js', 'src/vues/navigation.js'].map(f => require('fs').readFileSync(require('path').join(__dirname, '..', f), 'utf8')).join('\n');
  // seuls le résumé d'un repli et le ⓘ écrivent un état
  assert.equal((src.match(/uiNote\(/g) || []).length, 4, 'définition + résumé + ⓘ + « Voir plus »');
});

t('« Réinitialiser l\'affichage des cartes » remet les défauts', () => {
  const g = app();
  g.uiNote('journee', true); g.uiNote('alertes', false); g.uiVu('a:b:c:d');
  g.uiReset();
  assert.deepEqual(g.UI.etats, {});
  assert.equal(g.fold('journee', false), '');
  assert.equal(g.fold('alertes', true), ' open');
  assert.deepEqual(g.stored().uiState, {});
  assert.match(g.VIEWS.settings(), /id="uiReset"/);
});

t('garderVue dessine même sans fenêtre qui défile', () => {
  const g = app();
  let n = 0;
  g.garderVue(() => { n++; g.garderVue(() => { n++; }); });
  assert.equal(n, 2);
});

/* Le service worker, évalué avec un navigateur factice : seul ce qui compose le badge et fusionne les mouvements nous intéresse. */
function chargeWorker() {
  const noop = () => {};
  const ev = { addListener: noop };
  const chrome = { runtime: { onMessage: ev, onInstalled: ev, onStartup: ev, getManifest: () => ({ version: '2.9.0' }) },
    storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} }, session: { get: async () => ({}) }, onChanged: ev },
    alarms: { create: noop, clear: noop, onAlarm: ev }, action: { setBadgeText: noop, setBadgeBackgroundColor: noop, onClicked: ev },
    notifications: { create: noop, clear: noop, getAll: noop, onClicked: ev, onButtonClicked: ev },
    tabs: { onUpdated: ev, onActivated: ev, onRemoved: ev, query: noop, update: noop, create: noop }, sidePanel: { setOptions: noop, setPanelBehavior: () => ({ catch: noop }) },
    scripting: { executeScript: noop }, windows: { update: noop } };
  const src = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
  const importScripts = () => {};
  return new Function('chrome', 'importScripts', 'fetch', src + '\nreturn { badgeEtat, fusionneMouvements };')(chrome, importScripts, async () => ({ ok: false }));
}
const fs = require('fs'), path = require('path');

require('./securite.test')({ t, assert, lu, loadApp, fixtureState, mission, SOIR, chargeWorker });

/* ---------- la météo de l'empire ---------- */

const METEO_WANT = ['S', 'domainColor', 'planetWeather', 'empireWeather', 'meteoElements', 'meteoCauses', 'meteoHtml',
  'renderMeteo', 'meteoVoit', 'REFRESH', 'VIEWS', 'render', 'constats', 'ignore', 'ignKey', 'planetById', 'esc', 'UI', 'uiEcrit'];
/** Un empire où tout tourne : deux files occupées, une recherche en cours,
    des stocks bas, assez d'énergie. Rien ne doit y dégrader la météo. */
const CALME = s => {
  const fin = SOIR + 3 * 3600e3;
  s.timers = [
    { id: 'b1', kind: 'b', pid: 'mere', k: 'metal', lvl: 15, end: fin },
    { id: 'b2', kind: 'b', pid: 'colo', k: 'metal', lvl: 5, end: fin },
    { id: 't1', kind: 't', pid: 'mere', k: 'computer', lvl: 3, end: fin }
  ];
  s.planets.forEach(p => { p.stock = { m: 100, c: 100, d: 0, at: SOIR }; p.b.solar = 20; });
  // deux planètes pour deux places : aucune colonie à proposer (RECH_ASTRO_COLONY)
  s.tech.astro = 1;
};
function meteo(modifier, ext) {
  const s = fixtureState();
  s.planets.forEach(p => { p.stock.at = SOIR; });
  CALME(s);
  if (modifier) modifier(s);
  return loadApp(s, SOIR, METEO_WANT, null, ext);
}
const rangDe = (g, pid) => g.planetWeather(g.meteoElements(), pid);
const empireDe = g => g.empireWeather(g.meteoElements(), g.S.planets.map(p => p.id));

t('météo : les fonctions de calcul suivent le tableau des couleurs', () => {
  const g = meteo();
  const el = [{ pid: 'a', dom: 'eco', niveau: 'conseil', txt: 'x' }];
  assert.equal(g.domainColor(el, 'a', 'eco'), 'good', 'un simple Conseil ne dégrade pas');
  el.push({ pid: 'a', dom: 'eco', niveau: 'important', txt: 'y' });
  assert.equal(g.domainColor(el, 'a', 'eco'), 'warn');
  assert.equal(g.planetWeather(el, 'a'), 1, 'une orange : Nuageux');
  el.push({ pid: 'a', dom: 'eco', niveau: 'critique', txt: 'z' });
  assert.equal(g.domainColor(el, 'a', 'eco'), 'bad');
  assert.equal(g.planetWeather(el, 'a'), 2, 'une rouge : Orage');
  assert.equal(g.domainColor(el, 'b', 'eco'), 'good', 'une autre planète n\'en hérite pas');
  assert.equal(g.domainColor(el, 'a', 'act'), 'good', 'ni un autre domaine');
  el.push({ pid: 'b', dom: 'sec', niveau: 'critique', tempete: true, txt: 'attaque' });
  assert.equal(g.planetWeather(el, 'b'), 3, 'une attaque : Tempête');
  assert.equal(g.empireWeather(el, ['a', 'b']), 3, 'l\'empire prend la pire');
  assert.equal(g.empireWeather([], ['a', 'b']), 0);
});

t('météo : un empire sans alerte est au soleil, quatre pastilles vertes', () => {
  const g = meteo();
  assert.deepEqual(g.meteoElements().filter(e => e.niveau !== 'conseil'), [], 'rien ne colore');
  assert.equal(empireDe(g), 0);
  const h = g.meteoHtml(g.meteoElements());
  assert.ok(/<b>Soleil<\/b>/.test(h), 'le bandeau dit Soleil');
  assert.equal((h.match(/mt-dot mt-good/g) || []).length, 8, 'deux planètes, quatre pastilles vertes chacune');
  assert.ok(/title="Tout va bien"/.test(h), 'le survol dit « Tout va bien »');
});

t('météo : une file vide met Activité au rouge, la planète et l\'empire en Orage', () => {
  const g = meteo(s => { s.timers = s.timers.filter(t => t.id !== 'b2'); });
  const el = g.meteoElements();
  assert.equal(g.domainColor(el, 'colo', 'act'), 'bad');
  assert.equal(g.planetWeather(el, 'colo'), 2);
  assert.equal(g.planetWeather(el, 'mere'), 0, 'la voisine reste au soleil');
  assert.equal(empireDe(g), 2);
  assert.ok(/Activité : file de construction vide/.test(g.meteoCauses(el, 'colo')), g.meteoCauses(el, 'colo'));
});

t('météo : un hangar bientôt plein met Économie à l\'orange, planète Nuageux', () => {
  const g = meteo(s => { s.planets[0].b.metal = 20; s.planets[0].stock = { m: 66000, c: 0, d: 0, at: SOIR }; });
  const el = g.meteoElements();
  assert.equal(g.domainColor(el, 'mere', 'eco'), 'warn', JSON.stringify(el));
  assert.equal(g.planetWeather(el, 'mere'), 1);
  assert.ok(/Économie : métal au plafond dans/.test(g.meteoCauses(el, 'mere')), g.meteoCauses(el, 'mere'));
});

t('météo : une alerte ignorée ne dégrade plus la météo', () => {
  const g = meteo(s => { s.timers = s.timers.filter(t => t.id !== 'b2'); });
  assert.equal(rangDe(g, 'colo'), 2);
  const c = g.constats().find(x => x.regle === 'INST_QUEUE_EMPTY' && x.pid === 'colo');
  g.ignore(c);
  assert.equal(rangDe(g, 'colo'), 0, 'la planète redevient Soleil');
  g.REFRESH.today();
  const html = lu(g.el('tdAlerts').innerHTML);
  assert.ok(!/File de construction vide/.test(html), 'et l\'alerte quitte la carte');
});

t('météo : la carte Alertes porte un bouton Ignorer sur un constat', () => {
  const g = meteo(s => { s.timers = s.timers.filter(t => t.id !== 'b2'); });
  g.REFRESH.today();
  const html = lu(g.el('tdAlerts').innerHTML);
  assert.ok(/File de construction vide/.test(html), html.slice(0, 300));
  assert.ok(/data-ign="INST_QUEUE_EMPTY\|colo\|/.test(html), 'Ignorer porte la clé du constat');
});

t('météo : une attaque entrante fait Tempête sur la planète et sur l\'empire', () => {
  const g = meteo(s => { s.moves = [{ mission: 1, ret: false, arrival: SOIR / 1000 + 3600, origin: '2:10:5', dest: '1:142:6' }]; });
  const el = g.meteoElements();
  assert.equal(g.domainColor(el, 'colo', 'sec'), 'bad');
  assert.equal(g.planetWeather(el, 'colo'), 3);
  assert.equal(empireDe(g), 3);
  assert.ok(/<b>Tempête<\/b>/.test(g.meteoHtml(el)));
  assert.ok(/Sécurité : attaque entrant/.test(g.meteoCauses(el, 'colo')));
});

t('météo : un espionnage entrant met Sécurité à l\'orange, sans tempête', () => {
  const g = meteo(s => { s.moves = [{ mission: 6, ret: false, arrival: SOIR / 1000 + 600, origin: '2:10:5', dest: '1:142:8' }]; });
  const el = g.meteoElements();
  assert.equal(g.domainColor(el, 'mere', 'sec'), 'warn');
  assert.equal(g.planetWeather(el, 'mere'), 1);
});

t('météo : ses propres flottes, un retour ou une arrivée passée ne sont pas une menace', () => {
  const g = meteo(s => { s.moves = [
    { mission: 1, ret: false, arrival: SOIR / 1000 + 600, origin: '1:142:8', dest: '1:142:6' },
    { mission: 1, ret: true, arrival: SOIR / 1000 + 600, origin: '2:10:5', dest: '1:142:6' },
    { mission: 1, ret: false, arrival: SOIR / 1000 - 600, origin: '2:10:5', dest: '1:142:6' },
    { mission: 3, ret: false, arrival: SOIR / 1000 + 600, origin: '2:10:5', dest: '1:142:6' }]; });
  assert.equal(empireDe(g), 0);
});

t('météo : la défense suit le palier du modèle choisi', () => {
  const tenu = meteo(s => { s.planets[0].b.shipyard = 8; Object.assign(s.tech, {laser: 12, ion: 5, energy: 8, plasma: 7, weapons: 3, shielding: 6});
    s.planets[0].defs = {rl: 800, ll: 500, hl: 200, ic: 0, gc: 80, pt: 20, sd: 1, ld: 1}; });
  assert.equal(tenu.domainColor(tenu.meteoElements(), 'mere', 'def'), 'good', 'palier atteint : vert');
  const court = meteo(s => { s.planets[0].b.shipyard = 8; Object.assign(s.tech, {laser: 12, ion: 5, energy: 8, plasma: 7, weapons: 3, shielding: 6});
    s.planets[0].defs = {rl: 700, ll: 450, hl: 180, ic: 0, gc: 70, pt: 18, sd: 1, ld: 1}; });
  assert.equal(court.domainColor(court.meteoElements(), 'mere', 'def'), 'warn', 'incomplet : orange');
  const vide = meteo(s => { s.planets[0].b.shipyard = 8; Object.assign(s.tech, {laser: 12, ion: 5, energy: 8, plasma: 7, weapons: 3, shielding: 6});
    s.planets[0].defs = {rl: 100, ll: 450, hl: 180, ic: 0, gc: 70, pt: 18, sd: 1, ld: 1}; });
  assert.equal(vide.domainColor(vide.meteoElements(), 'mere', 'def'), 'bad', 'une pièce sous 50 % : rouge');
  assert.equal(vide.domainColor(vide.meteoElements(), 'colo', 'def'), 'good', 'une défense jamais relevée ne dit rien');
});

t('météo : un style qui met la défense à 0 ne la compte pas', () => {
  const g = meteo(s => { s.profil = {style: 'raideur', activite: 'souvent', focus: []};
    s.planets[0].defs = {rl: 0, ll: 0, hl: 0, ic: 0, gc: 0, pt: 0, sd: 0, ld: 0}; });
  assert.equal(g.domainColor(g.meteoElements(), 'mere', 'def'), 'good');
});

t('météo : la recherche à l\'arrêt va sur la planète d\'où la dernière est partie', () => {
  const g = meteo(s => { s.timers = s.timers.filter(t => t.kind !== 't'); s.rechPid = 'colo'; s.planets[1].b.lab = 1; });
  const el = g.meteoElements();
  // RECH_LAB_IDLE est critique depuis les règles du moteur (vague 1)
  assert.equal(g.domainColor(el, 'colo', 'act'), 'bad', JSON.stringify(el));
  assert.equal(g.domainColor(el, 'mere', 'act'), 'good');
});

t('météo : un clic sur le bandeau replie ou déplie la grille, et l\'état se garde', () => {
  const g = meteo();
  g.renderMeteo();
  assert.ok(/class="mt-grid" hidden/.test(g.el('meteo').innerHTML), 'repliée par défaut');
  const tog = { closest: sel => sel === '[data-meteo-tog]' ? {} : null };
  g.click('meteo', tog);
  // l'état part dans le store d'affichage du poste, comme celui des cartes
  g.uiEcrit();
  assert.equal(g.stored().uiState.meteo, 'open', 'l\'état part dans le stockage, comme celui des cartes');
  assert.ok(!/class="mt-grid" hidden/.test(g.el('meteo').innerHTML), 'dépliée');
  g.click('meteo', tog);
  g.uiEcrit();
  assert.equal(g.stored().uiState.meteo, 'closed');
});

t('météo : la grille se rouvre comme on l\'a laissée', () => {
  const g = meteo(s => { s.ui.fold = { meteo: true }; });
  g.renderMeteo();
  assert.ok(/aria-expanded="true"/.test(g.el('meteo').innerHTML));
  assert.ok(!/class="mt-grid" hidden/.test(g.el('meteo').innerHTML));
});

t('météo : une ligne par planète, dans l\'ordre du jeu, en-têtes abrégés', () => {
  const g = meteo();
  const h = g.meteoHtml(g.meteoElements());
  assert.ok(h.indexOf('data-meteo-p="mere"') < h.indexOf('data-meteo-p="colo"'));
  for (const [c, n] of [['Séc', 'Sécurité'], ['Act', 'Activité'], ['Éco', 'Économie'], ['Déf', 'Défense']])
    assert.ok(h.includes(`<abbr title="${n}">${c}</abbr>`), c);
  assert.ok(/Soleil.*Nuageux.*Orage.*Tempête/s.test(h.slice(h.indexOf('mt-leg'))), 'la légende porte les quatre');
  assert.ok(!/#[0-9a-f]{3,6}\b/i.test(h), 'aucune couleur en dur');
  assert.ok(!/data-launch|data-go|href=/.test(h), 'lecture seule : rien ne mène au jeu');
});

t('météo : un clic sur une planète filtre les cartes, la croix retire le filtre', () => {
  const g = meteo(s => { s.timers = []; });
  g.REFRESH.today();
  assert.ok(/Planète mère/.test(lu(g.el('tdAlerts').innerHTML)) && /Colonie/.test(lu(g.el('tdAlerts').innerHTML)), 'sans filtre, les deux');
  g.click('meteo', { closest: sel => sel === '[data-meteo-p]' ? { dataset: { meteoP: 'colo' } } : null });
  assert.ok(/Filtré : Colonie/.test(lu(g.el('meteoFiltre').innerHTML)), 'la puce apparaît');
  assert.equal(g.el('meteoFiltre').hidden, false);
  g.REFRESH.today();
  const al = lu(g.el('tdAlerts').innerHTML);
  assert.ok(/Colonie/.test(al) && !/Planète mère/.test(al), 'seules ses alertes : ' + al.slice(0, 300));
  assert.ok(!/Planète mère/.test(lu(g.el('tdNow').innerHTML)), 'et seules ses cartes');
  assert.ok(g.meteoVoit({ p: 1 }) && !g.meteoVoit({ p: 0 }));
  assert.ok(!/filterPlanet|meteoP/.test(JSON.stringify(g.saved())), 'le filtre ne s\'écrit nulle part');
  g.click('meteoFiltre', { closest: sel => sel === '[data-meteo-off]' ? {} : null });
  assert.equal(g.el('meteoFiltre').hidden, true, 'la puce s\'en va');
  assert.ok(g.meteoVoit({ p: 0 }), 'toutes les cartes reviennent');
});

t('météo : l\'Empire n\'affiche que la planète filtrée', () => {
  const g = meteo();
  g.click('meteo', { closest: sel => sel === '[data-meteo-p]' ? { dataset: { meteoP: 'colo' } } : null });
  const h = g.VIEWS.planets();
  assert.ok(/data-pi="0"[^>]* hidden/.test(h), 'la planète mère se cache');
  assert.ok(!/data-pi="1"[^>]* hidden/.test(h), 'la colonie reste');
});

/* ---------- disposition des cartes : empilées ou en onglets ---------- */

const CARTES_W = ['VIEWS', 'CARTES', 'RESUMES', 'REFRESH', 'resumeDe', 'niveauDe', 'critCle', 'segTabs', 'cardLayout', 'cartesPresentes', 'setCardMode', 'header', 'render'];
/** Le panneau avec ce que boot.js aurait lu : `mode` vaut 'tabs', 'stacked' ou rien. */
function appCartes(mode, modifier) {
  const s = fixtureState();
  s.planets.forEach(p => { p.stock.at = SOIR; });
  if (modifier) modifier(s);
  if (mode) s.__win = { __cardLayout: mode };
  return loadApp(s, SOIR, CARTES_W.concat(['cardMode', 'cardTabs']));
}
const ordreCartes = h => [...h.matchAll(/data-carte="([^"]+)"/g)].map(m => m[1]);

/* ENH-54 : les onglets sont devenus le défaut ; l'empilé reste un choix. */
t('cartes : le mode empilé, choisi, n\'a ni barre ni masquage', () => {
  const g = appCartes('stacked');
  const h = g.VIEWS.today();
  assert.ok(!/en-onglets|carteTabs/.test(h), 'rien du mode onglets');
  assert.ok(!/<div class="carte"[^>]* hidden/.test(h), 'aucune carte masquée');
  assert.deepEqual(ordreCartes(h), ['profil', 'attaque', 'maintenant', 'surplus', 'alertes', 'securite', 'expeditions', 'journee', 'minuteurs']);
  for (const id of ['tdNow', 'tdAlerts', 'expoBloc', 'tdDay', 'tmList']) assert.ok(h.includes(`id="${id}"`), id + ' toujours là');
});
t('cartes : un mode inconnu retombe sur les onglets, le défaut', () => {
  assert.ok(/en-onglets/.test(appCartes('grille').VIEWS.today()));
  assert.ok(/en-onglets/.test(appCartes().VIEWS.today()), 'rien d\'écrit : onglets');
  assert.ok(!/en-onglets/.test(appCartes('stacked').VIEWS.today()), 'empilé choisi : gardé');
});
t('cartes : en onglets, une barre .seg en tête, les cartes dans le même ordre', () => {
  const h = appCartes('tabs').VIEWS.today();
  assert.ok(/<section class="panel en-onglets" data-disposition="today"><div class="seg" role="tablist" id="carteTabs"/.test(h));
  assert.deepEqual(ordreCartes(h), ['profil', 'attaque', 'maintenant', 'surplus', 'alertes', 'securite', 'expeditions', 'journee', 'minuteurs']);
});
t('cartes : une carte ne sait pas dans quel mode elle est montrée', () => {
  const pile = appCartes('stacked').VIEWS.today();
  const ong = appCartes('tabs').VIEWS.today()
    .replace(' en-onglets', '').replace('<div class="seg" role="tablist" id="carteTabs" aria-label="Sections"></div>', '');
  assert.equal(ong, pile, 'seul le conteneur change');
});
t('cartes : le compteur prend le niveau le plus grave', () => {
  const g = appCartes();
  assert.deepEqual(g.resumeDe([{sev: 'info'}, {sev: 'warn'}, {sev: 'good'}], 'x'), {count: 3, maxLevel: 'imp', critiques: []});
  const r = g.resumeDe([{sev: 'warn'}, {sev: 'bad', key: 'Plus un emplacement libre sur Erablis (12/12)'}], 'alertes');
  assert.equal(r.maxLevel, 'crit');
  assert.deepEqual(r.critiques, ['alertes:Plus un emplacement libre sur Erablis ( / )']);
  assert.deepEqual(g.resumeDe([], 'x'), {count: 0, maxLevel: null, critiques: []});
  assert.equal(g.niveauDe('good'), 'info', 'un « Prêt » reste un conseil');
});
t('cartes : une alerte dont seuls les montants bougent reste la même', () => {
  const g = appCartes();
  assert.equal(g.critCle('Hangar plein sur Mère : 1 200 000 métal'), g.critCle('Hangar plein sur Mère : 1 350 500 métal'));
  assert.notEqual(g.critCle('Hangar plein sur Mère'), g.critCle('Hangar plein sur Colonie'));
});
t('cartes : compteurs colorés, rien quand l\'onglet est vide', () => {
  const g = appCartes();
  const h = g.segTabs([['securite', 'Sécurité', {count: 2, maxLevel: 'crit'}], ['defense', 'Défense', {count: 0, maxLevel: null}], ['conseils', 'Conseils', {count: 3, maxLevel: 'info'}], ['x', 'X', null]], 'data-carte-tab', 'defense');
  assert.ok(/data-carte-tab="securite" aria-selected="false">Sécurité <span class="cpt crit"[^>]*>\(2\)<\/span>/.test(h));
  assert.ok(/data-carte-tab="defense" aria-selected="true">Défense<\/button>/.test(h), 'pas de compteur à zéro');
  assert.ok(/class="cpt info"[^>]*>\(3\)/.test(h), 'gris pour des conseils seuls');
  assert.ok(/data-carte-tab="x" aria-selected="false">X<\/button>/.test(h));
});
t('cartes : Outils garde la même barre, construite par le même composant', () => {
  const g = appCartes();
  const h = g.VIEWS.tools();
  assert.ok(/<div class="seg" role="tablist"><button role="tab" data-tool="explore" aria-selected="false">Cibles<\/button>/.test(h));
  assert.ok(/data-tool="colony" aria-selected="true">Colonie</.test(h));
});
t('cartes : une carte dynamique vide n\'a pas d\'onglet, une fixe toujours', () => {
  const g = appCartes();
  g.RESUMES.alertes = g.resumeDe([], 'alertes');
  g.RESUMES.surplus = g.resumeDe([], 'surplus');
  g.RESUMES.maintenant = g.resumeDe([], 'maintenant');
  let ids = g.cartesPresentes('today').map(x => x.c.cardId);
  assert.ok(!ids.includes('alertes'), 'pas d\'alerte, pas d\'onglet');
  assert.deepEqual(ids, ['profil', 'maintenant', 'securite', 'expeditions', 'journee', 'minuteurs'], 'pas d\'attaque, pas d\'onglet Attaque');
  g.RESUMES.alertes = g.resumeDe([{sev: 'warn'}], 'alertes');
  ids = g.cartesPresentes('today').map(x => x.c.cardId);
  assert.equal(ids[2], 'alertes', 'à sa place dans l\'ordre de la pile');
});
t('cartes : le rafraîchissement dit ce que contient chaque carte', () => {
  // toutes les cases prises : l'alerte la plus grave que le moteur sache dire
  const g = appCartes(null, s => { s.planets[0].cases = {max: 163, pris: 163}; });
  g.render();
  const r = g.RESUMES;
  assert.ok(r.maintenant && r.alertes && r.expeditions, 'les trois cartes calculées ont leur résumé');
  assert.equal(r.alertes.maxLevel, 'crit', JSON.stringify(r.alertes));
  assert.ok(r.alertes.critiques.length && r.alertes.critiques.every(k => k.startsWith('alertes:') && !/\d/.test(k)), 'clé sans chiffres');
});
t('cartes : l\'interrupteur se retient dans le stockage partagé et redessine', () => {
  const s = fixtureState(); s.planets.forEach(p => { p.stock.at = SOIR; });
  s.__win = { __cardLayout: 'stacked' };
  const g = loadApp(s, SOIR, ['setCardMode', 'VIEWS', 'cardMode']);
  g.setCardMode('tabs');
  assert.equal(g.shared().cardLayout, 'tabs');
  assert.ok(/class="panel en-onglets"/.test(g.el('view').innerHTML), 'appliqué sans recharger');
  assert.ok(!/id="sEmpile" data-empile="1" checked/.test(g.VIEWS.settings()), 'Réglages le montrent : plus empilé');
  g.setCardMode('stacked');
  assert.equal(g.shared().cardLayout, 'stacked');
  assert.ok(/id="sEmpile" data-empile="1" checked/.test(g.VIEWS.settings()));
});
t('cartes : sur une installation neuve, les sections sont en onglets, et la bascule le dit', () => {
  const s = fixtureState(); s.planets.forEach(p => { p.stock.at = SOIR; });
  const g = loadApp(s, SOIR, ['VIEWS', 'cardMode']);
  assert.equal(g.cardMode, 'tabs');
  const h = g.VIEWS.settings(), i = h.indexOf('<h2>Affichage</h2>');
  assert.ok(i >= 0 && h.indexOf('id="sEmpile" data-empile="1"') > i, '« Empiler les sections » est dans Affichage');
  assert.ok(!/id="sEmpile" data-empile="1" checked/.test(h), 'et décochée');
});
t('cartes : un autre panneau change le mode, celui-ci suit sans le réécrire', () => {
  const s = fixtureState(); s.planets.forEach(p => { p.stock.at = SOIR; });
  const g = loadApp(s, SOIR, ['VIEWS']);
  g.fire({cardLayout: {newValue: 'tabs'}}, 'sync');
  assert.ok(/class="panel en-onglets"/.test(g.el('view').innerHTML));
  assert.equal(g.shared().cardLayout, undefined, 'rien de renvoyé');
});
t('cartes : l\'onglet choisi se relit au démarrage', () => {
  const s = fixtureState(); s.__win = {__cardLayout: 'tabs', __cardTab: {today: 'expeditions'}};
  const g = loadApp(s, SOIR, ['cardTabs', 'cardMode']);
  assert.equal(g.cardMode, 'tabs');
  assert.deepEqual(g.cardTabs, {today: 'expeditions'});
});
t('cartes : les onglets ne lancent rien dans le jeu', () => {
  const g = appCartes('tabs');
  const h = g.segTabs(g.CARTES.today.map(c => [c.cardId, c.titre, null]), 'data-carte-tab', 'maintenant');
  assert.ok(!/data-launch|data-sent|data-prep|href/.test(h));
});

/* ---------- combien de cartes par liste ---------- */
const carte = (i, crit) => ({html: `<li>c${i}</li>`, crit: !!crit});
const huit = () => Array.from({length: 8}, (_, i) => carte(i));

t('limite 3 sur 8 cartes sans urgence : 3 visibles, 5 masquées, dans l\'ordre', () => {
  const g = app();
  const r = g.applyLimit(huit(), 3);
  assert.deepEqual(r.visibles.map(c => c.html), ['<li>c0</li>', '<li>c1</li>', '<li>c2</li>']);
  assert.equal(r.masquees.length, 5);
  assert.equal(r.masquees[0].html, '<li>c3</li>', 'l\'ordre de priorité est gardé');
});
t('les urgences passent toutes, d\'abord, et ne comptent pas dans la limite', () => {
  const g = app();
  const l = huit().concat([carte('u1', true), carte('u2', true)]);
  const r = g.applyLimit(l, 3);
  assert.deepEqual(r.visibles.map(c => c.html), ['<li>cu1</li>', '<li>cu2</li>', '<li>c0</li>', '<li>c1</li>', '<li>c2</li>']);
  assert.equal(r.masquees.length, 5, '« Voir 5 de plus »');
  assert.ok(r.masquees.every(c => !c.crit), 'aucune urgence masquée');
});
t('« Toutes » ne masque rien', () => {
  const g = app();
  assert.equal(g.applyLimit(huit(), 'all').masquees.length, 0);
});
t('« Voir N de plus » dit le bon nombre ; pas de lien sous la limite', () => {
  const g = app();
  const h = g.listeCartes('maintenant', huit(), 'acts');
  assert.ok(/data-voirplus="maintenant"/.test(h) && h.includes('Voir 5 de plus'));
  assert.ok(/data-masquees="maintenant"[^>]* hidden/.test(h), 'le reste est replié sur place');
  for (let i = 0; i < 8; i++) assert.ok(h.includes(`c${i}`), 'toutes les cartes sont écrites, masquées comprises');
  const court = g.listeCartes('maintenant', [carte(0), carte(1)], 'acts');
  assert.ok(!/data-voirplus|Voir/.test(court), '2 cartes, limite 3 : pas de lien');
});
t('l\'état « Voir plus » vient du même stock que les volets', () => {
  const g = app(s => { s.ui = Object.assign({}, s.ui, {fold: {'maintenant.voirPlus': true}}); });
  const h = g.listeCartes('maintenant', huit(), 'acts');
  assert.ok(!/data-masquees="maintenant"[^>]* hidden/.test(h), 'déplié au démarrage');
  assert.ok(h.includes('Voir moins'));
});
t('la valeur propre l\'emporte sur la globale, et la globale vaut 3 par défaut', () => {
  const g = app();
  assert.equal(g.cartesGlobal(), 3);
  g.S.settings.cartesListe = {alertes: 'all'};
  g.S.settings.cartesMax = 5;
  assert.equal(g.cartesMax('alertes'), 'all', 'Sécurité reste sur Toutes');
  assert.equal(g.cartesMax('maintenant'), 5, 'les autres suivent la globale');
});
t('une valeur abîmée se remet d\'aplomb, une clé inconnue reste', () => {
  const g = app(s => { s.settings.cartesMax = 7; s.settings.cartesListe = {maintenant: 'x', alertes: '10', futur: 1, encours: true}; });
  g.cartesSain();
  assert.equal(g.S.settings.cartesMax, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(g.S.settings.cartesListe)), {alertes: 10, futur: 1});
});
t('les réglages de limite voyagent avec la synchro entre postes', () => {
  const g = app(s => { s.settings.cartesListe = {alertes: 'all'}; });
  assert.deepEqual(JSON.parse(JSON.stringify(g.syncOut()['sy:settings'].cartesListe)), {alertes: 'all'});
});
t('Réglages › Affichage montre la valeur propre posée depuis l\'en-tête', () => {
  const g = app(s => { s.settings.cartesListe = {alertes: 'all'}; });
  const h = lu(g.affichageCard());
  assert.ok(/data-cartesl="alertes"[^>]*>.*<option value="all" selected>Toutes/.test(h.replace(/\n/g, '')), h);
  assert.ok(/data-cartesl="maintenant"[^>]*><option value="" selected>Valeur globale \(3\)/.test(h), 'les autres sur la globale');
  assert.ok(/data-cartesreset="1"(?! disabled)/.test(h), 'Réinitialiser est actif');
  assert.ok(g.VIEWS.settings().includes('data-cartesg'), 'la carte est dans Réglages');
  assert.ok(lu(g.cartesMenu('alertes')).includes('<option value="all" selected>'), 'l\'en-tête dit la même chose');
});
t('Maintenant : le compteur compte tout, la liste coupe à la limite', () => {
  const rend = lim => { const g = app(s => { s.settings.cartesMax = lim; }); g.REFRESH.today(); return g.html(); };
  const un = rend(1), tout = rend('all');
  const n = +((un.tdNowN || '').match(/\d+/) || [0])[0];
  assert.ok(n > 1, 'la fixture doit porter plusieurs cartes : ' + un.tdNowN);
  assert.equal(un.tdNowN, tout.tdNowN, 'le compteur ne dépend pas de la limite');
  const m = (un.tdNow || '').match(/data-voirplus="maintenant" data-n="(\d+)"[^>]*>Voir (\d+) de plus/);
  assert.ok(m, 'limite 1 : un lien « Voir N de plus »');
  assert.equal(m[1], m[2]);
  assert.ok(+m[1] <= n - 1 && +m[1] >= 1, `${m[1]} masquées sur ${n}`);
  assert.ok(!/data-voirplus/.test(tout.tdNow || ''), '« Toutes » : pas de lien');
  assert.equal(lu(un.tdNow).replace(/<ul[^>]*>|<\/ul>|<button[^>]*data-voirplus[\s\S]*?<\/button>/g, '').length,
    lu(tout.tdNow).replace(/<ul[^>]*>|<\/ul>/g, '').length, 'les mêmes cartes, masquées comprises');
});

t('en onglets, le volet de la carte Alertes est trouvé sous #tdAlerts', () => {
  const g = app();
  const el = (tag, cls, kid) => ({tagName: tag, classList: {contains: c => c === cls}, firstElementChild: kid || null});
  const direct = el('DETAILS', 'card');
  assert.equal(g.carteDetails(el('DIV', 'carte', direct)), direct, 'carte fixe : enfant direct');
  const alertes = el('DETAILS', 'card');
  assert.equal(g.carteDetails(el('DIV', 'carte', el('DIV', '', alertes))), alertes, 'Alertes : un cran plus bas');
  assert.equal(g.carteDetails(el('DIV', 'carte', el('DIV', 'card'))), null, 'Maintenant : pas de volet');
});

/* ---------- les règles du moteur : test/regles.test.js ---------- */
require('./regles.test')({ t, assert, app, appRegles, loadApp, fixtureState, lu, SOIR, REVEIL, chargeWorker });

/* ---------- les règles du moteur : vague 2, ressources ---------- */

const MINEUR = s => { s.profil = { style: 'mineur', classe: '', activite: 'regulier', focus: [], set: true }; };
// le deutérium au même étage : sinon son pas, bon marché, borne la mine d'équilibre hors du classement
const MINES_28_27 = s => { Object.assign(s.planets[0].b, { metal: 28, crystal: 27, deut: 25, solar: 40 }); };
/** pickBuildings lit une planète SIMULÉE : elle porte son stock sous `st`. */
const simulee = (g, i, st) => Object.assign({}, g.S.planets[i], { st: st || [0, 0, 0] });

t('Mineur en position 8, métal 28 et cristal 27 : cible +3, actuel +1', () => {
  const g = app(s => { MINEUR(s); MINES_28_27(s); });
  assert.deepEqual(g.cibleMines(g.S.planets[0]), { cible: 3, actuel: 1, position: 8 });
  const c = g.constats().find(x => x.regle === 'RES_MINE_BALANCE');
  assert.match(c.what, /^Cible métal − cristal : \+3, actuel : \+1 sur Planète mère$/);
  assert.equal(c.action, 'Mine de métal 29');
});

t('la mine de métal devient candidate, avec la cible dans sa raison', () => {
  const g = app(s => { MINEUR(s); MINES_28_27(s); });
  const c = g.pickBuildings(simulee(g, 0), { T: SOIR, iv: 1.5, goals: [] });
  assert.ok(c.some(x => x.k === 'metal' && /Cible métal − cristal : \+3, actuel : \+1/.test(x.why)), JSON.stringify(c.map(x => [x.k, x.why])));
});

t('en Raideur, la cible de cette planète passe à +2 ; en position 3, un Mineur vise +1', () => {
  const g = app(s => { MINEUR(s); s.profil.style = 'raideur'; MINES_28_27(s); });
  assert.equal(g.cibleMines(g.S.planets[0]).cible, 2);
  const h = app(s => { MINEUR(s); s.planets[0].coords = '1:142:3'; });
  assert.equal(h.cibleMines(h.S.planets[0]).cible, 1);
});

t('sans style, ni cible ni constat', () => {
  const g = app(MINES_28_27);
  assert.equal(g.cibleMines(g.S.planets[0]), null);
  assert.ok(!g.constats().some(x => x.regle === 'RES_MINE_BALANCE'));
});

t('la tolérance : un niveau au-dessus de la cible ne fait rien monter', () => {
  const g = app(s => { MINEUR(s); Object.assign(s.planets[0].b, { metal: 30, crystal: 26 }); });
  assert.equal(g.mineEnRetard(g.S.planets[0]), null, 'cible +3, actuel +4 : dans la tolérance');
  const h = app(s => { MINEUR(s); Object.assign(s.planets[0].b, { metal: 31, crystal: 26 }); });
  assert.equal(h.mineEnRetard(h.S.planets[0]).k, 'crystal');
});

t('une mine d\'équilibre trop chère ne passe pas devant le classement', () => {
  const g = app(s => { MINEUR(s); MINES_28_27(s); s.settings.regles = { RES_MINE_BALANCE: { p: { facteurCout: 0.01 } } }; });
  const c = g.pickBuildings(simulee(g, 0), { T: SOIR, iv: 1.5, goals: [] });
  assert.ok(!c.some(x => /Cible métal/.test(x.why)));
});

/* ---------- les règles du moteur : vague 2, installations ---------- */

const NANITES = s => { s.planets.forEach(p => { p.b.robot = 10; }); s.tech.computer = 10;
  s.planets[0].b.nanite = 5; s.planets[1].b.nanite = 1;
  Object.assign(s.planets[1].b, { metal: 30, crystal: 30, deut: 20, solar: 40 }); };

t('nanites en retard sur l\'empire : constat, et Nanites +1 candidate', () => {
  const g = app(NANITES);
  assert.ok(g.constats().some(x => x.regle === 'INST_NANITES_LAGGING' && x.pid === 'colo'));
  assert.ok(!g.constats().some(x => x.regle === 'INST_NANITES_LAGGING' && x.pid === 'mere'), 'pas la planète qui mène');
  const c = g.pickBuildings(simulee(g, 1), { T: SOIR, iv: 1.5, goals: [] });
  assert.ok(c.some(x => x.k === 'nanite' && /Nanites 1 ici, 5 ailleurs/.test(x.why)));
});

t('une priorité Robots 11 : le copilote obéit, et chiffre les nanites', () => {
  // des hangars et un stock à la mesure de Robots 11, sinon la priorité commence par le hangar
  const g = app(s => { s.planets[0].b.robot = 10; s.tech.computer = 10; s.prio = [{ kind: 'b', pid: 'mere', k: 'robot', lvl: 11 }];
    Object.assign(s.planets[0].b, { smetal: 20, scrystal: 20, sdeut: 20, solar: 30 }); s.planets[0].stock = { m: 9e7, c: 9e7, d: 9e7, at: SOIR }; });
  assert.ok(g.constats().some(x => x.regle === 'INST_NANITES_OVER_ROBOTS' && x.pid === 'mere'));
  const s0 = g.simulateDay().sessions[0];
  const a = s0.acts.concat(s0.waits).find(a => a.p === 0 && a.k === 'robot');
  assert.ok(a, 'la priorité est servie');
  assert.match(a.why || '', /Usine de nanites 1 diviserait le temps des chantiers par 2/);
});

t('14 cases libres sous un seuil de 15 : le conseil sort ; à 10 il se tait', () => {
  const peu = s => { s.planets[1].cases = { pris: 191, max: 205 }; };
  assert.ok(!app(peu).constats().some(x => x.regle === 'INST_FIELDS_LOW'));
  const g = app(s => { peu(s); s.settings.regles = { INST_FIELDS_LOW: { p: { seuil: 15 } } }; });
  const c = g.constats().find(x => x.regle === 'INST_FIELDS_LOW' && x.pid === 'colo');
  assert.ok(c);
  assert.match(c.why, /demande Nanites 1/, 'sans ses prérequis, il le dit au lieu de pousser');
});

t('le Terraformeur est poussé quand il peut l\'être', () => {
  const g = app(s => { s.planets[1].cases = { pris: 200, max: 205 }; s.planets[1].b.nanite = 1; s.tech.energy = 12; });
  const c = g.pickBuildings(simulee(g, 1), { T: SOIR, iv: 1.5, goals: [] });
  assert.ok(c.some(x => x.k === 'terra'));
});

t('une règle coupée pour une planète ne s\'y évalue plus, ni dans le plan', () => {
  const g = app(s => { s.planets[1].cases = { pris: 200, max: 205 }; s.planets[1].b.nanite = 1; s.tech.energy = 12;
    s.planets[1].regOff = { INST_FIELDS_LOW: true }; });
  assert.ok(!g.constats().some(x => x.regle === 'INST_FIELDS_LOW'));
  assert.ok(!g.pickBuildings(simulee(g, 1), { T: SOIR, iv: 1.5, goals: [] }).some(x => x.k === 'terra'));
  assert.match(lu(g.regOffHtml(g.S.planets[1])), /data-regoff="colo\|INST_FIELDS_LOW"  class/);
});

t('le réseau de labos ne parle que si on a le Réseau', () => {
  const sans = app(s => { s.planets[0].b.lab = 10; s.planets[1].b.lab = 2; });
  assert.ok(!sans.constats().some(x => x.regle === 'INST_LAB_NETWORK'));
  const avec = app(s => { s.planets[0].b.lab = 10; s.planets[1].b.lab = 2; s.tech.irn = 1; });
  assert.ok(avec.constats().some(x => x.regle === 'INST_LAB_NETWORK' && x.pid === 'colo'));
  assert.equal(avec.constats().find(x => x.regle === 'INST_LAB_NETWORK').statut, 'a_valider');
});

/* ---------- les règles du moteur : vague 2, recherche ---------- */

const PLASMA_OUVERT = s => { s.tech.energy = 8; s.tech.laser = 10; s.tech.ion = 5; };

t('un mineur sous le plasma visé : Plasma passe en tête', () => {
  const g = app(s => { MINEUR(s); PLASMA_OUVERT(s); });
  const r = g.nextResearch().list[0];
  assert.equal(r.k, 'plasma'); assert.equal(r.regle, 'RECH_PLASMA_MINER');
  assert.match(r.why, /^Profil Mineur : le Plasma/);
  assert.ok(g.constats().some(x => x.regle === 'RECH_PLASMA_MINER'));
});

t('une priorité du joueur reste devant le plasma de la règle', () => {
  const g = app(s => { MINEUR(s); PLASMA_OUVERT(s); s.prio = [{ kind: 't', k: 'astro', lvl: 5 }]; });
  assert.equal(g.nextResearch().list[0].k, 'astro');
});

t('sans le style visé, la règle ne pousse rien', () => {
  const g = app(PLASMA_OUVERT);
  assert.deepEqual(g.reglesRecherche(), []);
});

t('un explorateur pousse l\'Hyperespace, et dit le gain du serveur', () => {
  const g = app(s => { s.profil = { style: 'explorateur', classe: '', activite: 'regulier', focus: [], set: true };
    s.planets[0].b.lab = 7; s.tech.energy = 5; s.tech.shielding = 5; });
  const r = g.nextResearch().list[0];
  assert.equal(r.k, 'hyper');
  assert.match(r.why, /ajoute 5 % de soute/);
});

const AILLEURS = s => { s.planets[0].stock = { m: 0, c: 0, d: 0, at: SOIR }; s.planets[1].b.lab = 5;
  Object.assign(s.planets[1].b, { smetal: 20, scrystal: 20, sdeut: 20 }); s.planets[1].stock = { m: 9e7, c: 9e7, d: 9e7, at: SOIR }; };

t('la recherche impayable au centre part d\'une planète qui peut', () => {
  const g = app(AILLEURS);
  assert.ok(g.constats().some(x => x.regle === 'RECH_FUND_ELSEWHERE' && x.pid === 'colo'));
  const a = g.simulateDay().sessions[0].acts.find(a => a.kind === 't');
  assert.equal(a.p, 1); assert.match(a.why, /^Depuis Colonie/);
});

t('une planète sans le labo du prérequis ne la lance pas', () => {
  const g = app(s => { AILLEURS(s); s.planets[1].b.lab = 0; });
  assert.ok(!g.simulateDay().sessions[0].acts.some(a => a.kind === 't' && a.p === 1));
  assert.equal(g.rechercheAilleurs(), null);
});

t('RECH_FUND_ELSEWHERE coupée : la recherche attend au centre', () => {
  const g = app(s => { AILLEURS(s); s.settings.regles = { RECH_FUND_ELSEWHERE: { on: false } }; });
  assert.ok(!g.simulateDay().sessions[0].acts.some(a => a.kind === 't' && a.p === 1));
});

t('une planète de plus possible : constat, et en économie pure il dit pourquoi le plan n\'y va pas', () => {
  const g = app();
  assert.ok(g.constats().some(x => x.regle === 'RECH_ASTRO_COLONY'), 'Astrophysique 3 : trois planètes, deux prises');
  const e = app(s => { s.day.focus = 'eco'; });
  assert.match(e.constats().find(x => x.regle === 'RECH_ASTRO_COLONY').why, /Économie pure/);
  const plein = app(s => { s.tech.astro = 1; });
  assert.ok(!plein.constats().some(x => x.regle === 'RECH_ASTRO_COLONY'));
});

require('./formes-de-vie.test')({ t, assert, app, appRegles, lu, SOIR, prioLabo, prio2, CASE_OK, vieSur, premierLf });

/* ---------- cartes en onglets : la bascule sur alerte critique ---------- */
const presentes = l => l.map(([cardId, critiques]) => ({c: {cardId}, r: critiques ? {critiques} : null}));
t('cartes : une alerte critique neuve fait basculer sur sa carte, une seule fois', () => {
  const g = app(), vus = new Set();
  const p = presentes([['maintenant', null], ['alertes', ['attaque:Erablis']], ['journee', []]]);
  assert.equal(g.alerteNeuve(p, vus), 'alertes');
  assert.equal(g.alerteNeuve(p, vus), null, 'la même alerte ne ramène pas le joueur');
});
t('cartes : une nouvelle alerte critique rebascule', () => {
  const g = app(), vus = new Set(['attaque:Erablis']);
  assert.equal(g.alerteNeuve(presentes([['alertes', ['attaque:Erablis', 'attaque:Gaspesion']]]), vus), 'alertes');
  assert.ok(vus.has('attaque:Gaspesion'));
});
t('cartes : la première carte qui porte une alerte neuve l\'emporte', () => {
  const g = app(), vus = new Set();
  assert.equal(g.alerteNeuve(presentes([['maintenant', ['a']], ['alertes', ['b']]]), vus), 'maintenant');
  assert.ok(vus.has('b'), 'les autres sont comptées vues aussi : elles ne rebasculeront pas');
});
t('cartes : la bascule passe devant le choix du joueur, qui reprend la main ensuite', () => {
  const g = app(), ids = ['maintenant', 'alertes', 'journee'];
  assert.equal(g.ongletAffiche(ids, 'alertes', 'journee'), 'alertes');
  assert.equal(g.ongletAffiche(ids, undefined, 'journee'), 'journee', 'bascule effacée par un clic');
  assert.equal(g.ongletAffiche(['maintenant', 'journee'], 'alertes', 'journee'), 'journee', 'l\'alerte finie, son onglet parti : retour au choix');
  assert.equal(g.ongletAffiche(ids, undefined, 'disparu'), 'maintenant', 'un onglet qui n\'existe plus : le premier');
});

/* ---------- flotte cible ---------- */
/* 14 h : loin de la mise à l'abri (rappel 22:00 par défaut, réveil 7 h). */
const MIDI = new Date(2026, 10, 8, 14, 0, 0).getTime();
const FC_WANT = ['fleetTarget', 'fleetGap', 'suggestMoves', 'flotteCible', 'flotteCibleHtml', 'reequilibreCartes', 'flotteAjout', 'fcFenetre', 'dailyMissions', 'expoFleet', 'expoCap', 'shipStats', 'S', 'VIEWS'];
/** Trois planètes, Hyperespace 0 : un GT vaut 25 000 × 1,25 (collecteur), un PT 6 250. */
function fcEmpire(s) {
  s.tech.astro = 9; s.tech.hyperdrive = 6; s.tech.impulse = 6;
  const base = s.planets[0];
  s.planets[0] = Object.assign({}, base, { id: 'pout', name: 'Poutinia', coords: '1:142:8',
    ships: { lc: 287, sc: 0, pr: 3, pf: 0, rp: 18, bs: 30 }, stock: { m: 200000, c: 100000, d: 900000, at: 0 } });
  s.planets[1] = Object.assign({}, base, { id: 'gasp', name: 'Gaspesion', coords: '1:150:8',
    ships: { lc: 25, bs: 10 }, stock: { m: 2000000, c: 600000, d: 200000, at: 0 } });
  s.planets.push(Object.assign({}, base, { id: 'erab', name: 'Erablis', coords: '1:160:8',
    b: Object.assign({}, base.b, { metal: 4, crystal: 3, deut: 2 }),
    ships: { lc: 10 }, stock: { m: 100000, c: 50000, d: 300000, at: 0 } }));
}
function fc(modifier, now) {
  const s = fixtureState(); const at = now == null ? MIDI : now;
  fcEmpire(s);
  if (modifier) modifier(s);
  s.planets.forEach(p => { p.stock.at = at; });
  return loadApp(s, at, FC_WANT);
}

t('flotte cible : 3 emplacements, 3 kits complets placés, un noyau partout', () => {
  const g = fc();
  assert.equal(g.expoCap(), 3);
  const r = g.flotteCible(MIDI);
  const kits = Object.values(r.par).reduce((a, t) => a + t.kits.length, 0);
  assert.equal(kits, 3);
  for (const id of ['pout', 'gasp', 'erab']) {
    const t = r.par[id];
    assert.ok(t.kits.length === 1, id + ' porte un kit');
    // collecteur sans Éclaireur dans l'empire : le manque est dit, gros vaisseau seul
    assert.ok(t.noyau.manque.includes('1 Éclaireur') && t.noyau.pfImpossible, id + ' signale l\'Éclaireur');
    assert.equal(t.kits[0].ships.rp, 1, 'gros vaisseau = Faucheur, le plus avancé de l\'empire');
  }
});

t('flotte cible : l\'Astrophysique 16 donne 4 kits', () => {
  const g = fc(s => { s.tech.astro = 16; });
  assert.equal(g.expoCap(), 4);
  const r = g.flotteCible(MIDI);
  assert.equal(Object.values(r.par).reduce((a, t) => a + t.kits.length, 0), 4);
});

t('flotte cible : le kit vient de expoFleet, sans seconde composition', () => {
  const g = fc();
  const r = g.flotteCible(MIDI), pout = r.par.pout;
  // le premier kit placé est composé sur tout l'empire, noyaux des autres retenus
  const k = pout.kits[0];
  assert.ok(k.ships.lc > 0 && k.pts <= k.ptsCap * 1.05);
  assert.deepEqual(Object.keys(k).sort(), Object.keys(g.expoFleet({ lc: 50, pr: 1 }, { expoRes: 0 })).sort());
});

t('flotte cible : les kits vont là où ils demandent le moins de mouvements', () => {
  // un seul emplacement : Poutinia, qui a déjà presque tout, le prend
  const g = fc(s => { s.tech.astro = 1; });
  const r = g.flotteCible(MIDI);
  assert.equal(r.par.pout.kits.length, 1);
  assert.equal(r.par.gasp.kits.length + r.par.erab.kits.length, 0);
});

t('flotte cible : la soute vise le stock prévu à l\'heure du fleet save, réserve incluse', () => {
  const g = fc(s => { s.settings.expoRes = 200; });
  const r = g.flotteCible(MIDI), t1 = r.par.gasp, gt = g.shipStats('lc').cargoEff;
  assert.ok(t1.soute.besoin >= 2800000, 'stock du soir ≥ 2,8 M');
  assert.equal(t1.soute.cible, Math.round(Math.max(t1.soute.besoin, 200 * gt)));
  const e = r.par.erab;
  assert.equal(e.soute.cible, 200 * gt, 'la réserve fait plancher sur une petite planète');
});

t('flotte cible : transporteurs insuffisants, prorata des besoins et manque chiffré', () => {
  const g = fc(s => { s.planets[0].ships.lc = 40; s.planets[1].ships.lc = 0; s.planets[2].ships.lc = 0; s.tech.astro = 0; });
  const r = g.flotteCible(MIDI);
  assert.ok(r.manqueGT > 0, 'il manque des GT');
  const c = ['pout', 'gasp', 'erab'].map(id => r.par[id].soute);
  const ratio = c.map(x => x.couverte / x.cible);
  assert.ok(Math.max(...ratio) - Math.min(...ratio) < 0.15, 'même part du besoin couverte partout : ' + ratio.join(', '));
  assert.ok(/il manque <b>\d[\d\s ]* GT<\/b>/i.test(g.flotteCibleHtml(MIDI).replace(/ | /g, ' ')));
});

t('flotte cible : le combat restant se répartit à parts égales, le reste aux plus productives', () => {
  const g = fc(s => { s.tech.astro = 0; s.planets[0].ships.bs = 10; s.planets[1].ships.bs = 0; });
  const r = g.flotteCible(MIDI);
  const n = ['pout', 'gasp', 'erab'].map(id => r.par[id].combat.bs || 0);
  assert.equal(n.reduce((a, x) => a + x, 0), 10);
  assert.ok(Math.max(...n) - Math.min(...n) <= 1);
  assert.equal(r.par.erab.combat.bs, 3, 'la moins productive n\'a pas le reste');
});

t('flotte cible : carburant insuffisant pour le fleet save signalé', () => {
  const g = fc(s => { s.planets[1].stock.d = 50; s.planets[1].b.deut = 0; s.settings.secu = { vaults: ['erab'] }; });
  const r = g.flotteCible(MIDI), c = r.par.gasp.carburant;
  assert.ok(!c.ok && c.fuel > c.dispo, JSON.stringify(c));
  assert.ok(r.par.erab.carburant.coffre);
  assert.ok(/Carburant/.test(g.flotteCibleHtml(MIDI)));
});

t('flotte cible : la vue Outils › Flotte affiche cible, actuel et écart', () => {
  const g = fc();
  const h = g.VIEWS.fleet();
  assert.ok(/Flotte cible/.test(h));
  for (const n of ['Poutinia', 'Gaspesion', 'Erablis']) assert.ok(h.includes(n));
  assert.ok(/ne construit pas d'Éclaireur/.test(h.replace(/&#39;/g, "'")), 'le collecteur est prévenu, gros vaisseau seul');
  assert.ok(/Soute \(cible \/ actuelle\)/.test(h) && /Combat \(écart\)/.test(h) && /Carburant/.test(h));
});

t('rééquilibrer : carte en Stationner depuis la planète la plus excédentaire', () => {
  const g = fc();
  const cartes = g.reequilibreCartes(MIDI);
  const vers = cartes.find(m => m.dstId === 'gasp');
  assert.ok(vers, 'Gaspesion, soute 25 GT pour 2,8 M, a sa carte');
  assert.equal(vers.mission, 4);
  assert.equal(g.S.planets[vers.p].id, 'pout', 'depuis Poutinia, la plus excédentaire');
  assert.ok(/Stationner/.test(vers.how[0]) && /restent sur la planète cible/.test(vers.how[0]));
  assert.ok(/<th>Mission<\/th>/.test(vers.whatHtml) && /<td>Stationner<\/td>/.test(vers.whatHtml));
  assert.ok(g.dailyMissions().some(m => m.id === vers.id), 'la carte sort dans les missions du jour');
});

t('rééquilibrer : rien sous le seuil, rien pendant la fenêtre de fleet save ni sous attaque', () => {
  assert.equal(fc(s => { s.planets[1].ships.lc = 5000; s.planets[2].ships.lc = 5000; s.planets[0].ships.lc = 5000; s.planets.forEach(p => { p.ships.pr = 2; p.ships.rp = 2; }); }).reequilibreCartes(MIDI).length, 0, 'tout le monde est au-dessus');
  const soir = new Date(2026, 10, 8, 22, 30, 0).getTime();
  const g = fc(null, soir);
  assert.ok(g.fcFenetre(soir).dedans);
  assert.equal(g.reequilibreCartes(soir).length, 0);
  assert.ok(!g.dailyMissions().some(m => /^reequilibre/.test(m.id)));
  const att = fc(s => { s.moves = [{ mission: 1, hostile: true, origin: '2:1:1', dest: '1:150:8', arrival: (MIDI + 3600e3) / 1000 }]; });
  assert.equal(att.reequilibreCartes(MIDI).length, 0);
});

t('flotte cible : un vol proposé indique les vaisseaux à faire suivre', () => {
  const g = fc();
  const r = g.flotteCible(MIDI);
  const txt = g.flotteAjout(r, g.S.planets[0], g.S.planets[1]);
  assert.ok(/Stationner vers .*Gaspesion/.test(txt) && /grands transporteurs/.test(txt), txt);
  assert.equal(g.flotteAjout(r, g.S.planets[1], g.S.planets[1]), '');
});

t('flotte cible : une flotte en vol se compte là où elle se posera', () => {
  const g = fc(s => { s.moves = [{ mission: 15, ret: true, origin: '1:150:8', dest: '1:150:16', arrival: (MIDI + 3600e3) / 1000, ships: { lc: 100 } }]; });
  assert.equal(g.flotteCible(MIDI).par.gasp.actuel.lc, 125);
});

t('flotte cible : fonctions pures, écart et mouvements groupés par paire', () => {
  const g = fc();
  assert.deepEqual(g.fleetGap({ lc: 10, bs: 2 }, { lc: 4, bs: 5 }), { plus: { lc: 6 }, moins: { bs: 3 } });
  const m = g.suggestMoves([{ id: 'a', plus: {}, moins: { lc: 5, bs: 3 } }, { id: 'b', plus: { lc: 4, bs: 1 }, moins: {} }]);
  assert.deepEqual(m, [{ de: 'a', vers: 'b', ships: { lc: 4, bs: 1 } }]);
});

/* ---------- ressources en trop : dépenser, transférer, monter le hangar (#44) ---------- */
const SURPLUS_NOMS = ['S', 'solutionsSurplus', 'surplusListe', 'surplusHtml', 'surplusNote', 'surplusCompte', 'transfertVersBesoin',
  'hangarSiJustifie', 'depenseSurPlace', 'flotteLibre', 'pertesParHeure', 'transportSuggere', 'debordeA', 'debordeTexte', 'expoFleet',
  'stockNow', 'production', 'storageCap', 'simulateDay', 'constats', 'REFRESH', 'transportHtml'];
/** L'application avec les fonctions du surplus ; `ext` pour le stockage de l'extension. */
function appSurplus(modifier, ext) {
  const s = fixtureState();
  s.planets.forEach(p => { p.stock.at = SOIR; });
  if (modifier) modifier(s);
  return loadApp(s, SOIR, SURPLUS_NOMS, null, ext);
}
/** Un plan réduit à ce que les solutions lisent : la première connexion. */
const planDe = (waits, acts, goals) => ({ sessions: [{ T: SOIR, acts: acts || [], waits: waits || [], goals: goals || [] }], constats: [] });

t('surplus : la perte se compte en production arrêtée, au ratio du joueur', () => {
  const g = appSurplus(s => { s.planets[0].stock.c = 1e9; });
  const p = g.S.planets[0], pr = g.production(p), l = g.pertesParHeure(p, 1);
  assert.equal(Math.round(l.res), Math.round(pr.c));
  assert.equal(Math.round(l.eqM), Math.round(pr.c * 3 / 2), 'un cristal vaut 1,5 métal au ratio 3/2/1');
});

t('surplus : la première solution est une dépense utile sur place, la recherche depuis la planète qui a le stock', () => {
  // La colonie a un labo qui suffit, le cristal au plafond, et le plan attend
  // une recherche : elle la paie, comme RECH_FUND_ELSEWHERE.
  const g = appSurplus(s => { Object.assign(s.planets[1].b, { lab: 4, scrystal: 2 }); s.planets[1].stock = { m: 2e5, c: 4e5, d: 2e5, at: SOIR }; });
  const plan = planDe([{ kind: 't', k: 'energy', what: 'Technologie Énergie 4', cost: [0, 800 * 8, 400 * 8], p: 0, miss: [0, 0, 0] }]);
  const s = g.solutionsSurplus(g.S.planets[1], 1, plan);
  assert.equal(s[0].type, 'depense', JSON.stringify(s));
  assert.equal(s[0].what, 'Lancer Technologie Énergie 4 depuis Colonie');
});

t('surplus : une dépense absente du plan n\'est pas proposée — pas d\'achat pour vider', () => {
  const g = appSurplus(s => { s.planets[1].stock = { m: 2e5, c: 4e5, d: 2e5, at: SOIR }; });
  assert.equal(g.depenseSurPlace(g.S.planets[1], 1, planDe([])), null);
});

/** La mère déborde de cristal ; la colonie attend une mine qui en manque. */
const VERS_COLONIE = s => {
  s.planets[0].stock.c = 2e6; s.planets[0].ships = { lc: 200, sc: 0, pr: 4 };
  Object.assign(s.planets[1].b, { scrystal: 5 });
};
const ATTENTE_COLONIE = besoin => planDe([{ kind: 'b', what: 'Mine de cristal 4', cost: [0, besoin, 0], p: 1, miss: [0, besoin, 0] }]);

t('surplus : sans dépense, un transfert vers la planète bloquée, au format du tableau', () => {
  const g = appSurplus(VERS_COLONIE);
  const s = g.solutionsSurplus(g.S.planets[0], 1, ATTENTE_COLONIE(1e5));
  assert.equal(s[0].type, 'transfert', JSON.stringify(s.map(x => x.type)));
  assert.equal(s[0].dest.name, 'Colonie'); assert.equal(s[0].mission, 3);
  assert.equal(s[0].charge[1], 1e5, 'limité par le besoin');
  const h = lu(g.transportHtml(s[0]));
  assert.match(h, /<th>Source<\/th><th>Vaisseaux<\/th><th>Cible<\/th><th>Mission<\/th><th>M \/ C \/ D<\/th>/);
  assert.match(h, /Transport/);
});

t('surplus : la quantité respecte la place libre de la cible', () => {
  // Hangar C 5 : 255 000. 95 % moins les 4 000 au sol laissent 238 250.
  const g = appSurplus(VERS_COLONIE);
  const t0 = g.transfertVersBesoin(g.S.planets[0], 1, ATTENTE_COLONIE(9e5));
  const cap = g.storageCap(5), place = 0.95 * cap - g.stockNow(g.S.planets[1])[1];
  assert.ok(t0.charge[1] <= place && t0.charge[1] > place - 5000, `${t0.charge[1]} pour ${place} de place`);
});

t('surplus : la quantité respecte la soute et l\'excédent', () => {
  // Trois GT libres seulement : la soute borne.
  const g = appSurplus(s => { VERS_COLONIE(s); s.planets[0].ships = { lc: 3 }; s.expo = { pf: false }; s.settings.expoRes = 0; });
  const p = g.S.planets[0], kit = g.expoFleet(p.ships, p), libres = g.flotteLibre(p);
  const t0 = g.transfertVersBesoin(p, 1, ATTENTE_COLONIE(1e5));
  if (t0) assert.ok(t0.ships.lc <= libres.lc, 'jamais plus que les GT libres');
  assert.ok(!t0 || t0.charge[1] <= 3 * 25000 * 2, 'jamais plus que la soute : ' + JSON.stringify(t0 && t0.charge) + ' kit ' + JSON.stringify(kit));
  // Un débordement juste au-dessus de 90 % : l'excédent borne.
  const h = appSurplus(s => { VERS_COLONIE(s); s.planets[0].stock.c = 75000 * 0.96; });
  assert.equal(h.transfertVersBesoin(h.S.planets[0], 1, ATTENTE_COLONIE(1e5)), null, 'moins de 5 000 au-dessus de 90 % : rien ne vaut le vol');
});

t('surplus : le transfert laisse à quai le kit d\'expédition et la réserve de GT', () => {
  const g = appSurplus(s => { VERS_COLONIE(s); s.settings.expoRes = 20; });
  const p = g.S.planets[0], kit = g.expoFleet(p.ships, p), libres = g.flotteLibre(p);
  assert.equal(libres.lc, 200 - 20 - ((kit && kit.ships.lc) || 0));
  const t0 = g.transfertVersBesoin(p, 1, ATTENTE_COLONIE(1e5));
  assert.ok(t0.ships.lc <= libres.lc, JSON.stringify(t0.ships));
  // Rien de libre : pas de transfert.
  const h = appSurplus(s => { VERS_COLONIE(s); s.settings.expoRes = 200; });
  assert.equal(h.transfertVersBesoin(h.S.planets[0], 1, ATTENTE_COLONIE(1e5)), null);
});

t('surplus : une cible sans place n\'est pas retenue', () => {
  const g = appSurplus(s => { VERS_COLONIE(s); s.planets[1].stock.c = g0cap(5) * 0.95; });
  assert.equal(g.transfertVersBesoin(g.S.planets[0], 1, ATTENTE_COLONIE(1e5)), null);
});
/** La capacité d'un hangar, sans charger l'application. */
function g0cap(L) { return 5000 * Math.floor(2.5 * Math.exp(20 * L / 33)); }

t('surplus : premier débordement, pas de hangar ; récurrent, le hangar avec coût et durée', () => {
  const g = appSurplus(s => { s.planets[0].stock.c = 1e9; });
  const p = g.S.planets[0];
  assert.equal(g.hangarSiJustifie(p, 1), null, 'un débordement ponctuel ne justifie pas le hangar');
  const h = appSurplus(s => { s.planets[0].stock.c = 1e9; s.__win = { __surplusLog: RECURRENT('mere', 1, 3) }; });
  h.surplusNote(SOIR);
  assert.equal(h.surplusCompte('mere', 1, SOIR), 4, 'quatrième débordement en sept jours');
  const x = h.hangarSiJustifie(h.S.planets[0], 1);
  assert.equal(x.what, 'Hangar de cristal 4');
  assert.ok(x.cost.some(c => c > 0) && x.duree > 0, JSON.stringify(x));
  assert.equal(h.solutionsSurplus(h.S.planets[0], 1, planDe([])).slice(-1)[0].type, 'hangar', 'en dernier');
});

t('surplus : l\'historique s\'écrit dans le stockage local et oublie au-delà de sept jours', () => {
  const vieux = { pid: 'mere', k: 1, d: SOIR - 9 * 864e5, f: SOIR - 8 * 864e5 };
  const g = appSurplus(s => { s.planets[0].stock.c = 1e9; s.__win = { __surplusLog: [vieux] }; }, true);
  g.surplusNote(SOIR);   // le premier rendu l'a déjà fait : relancer ne change rien
  const log = g.stored().surplusLog;
  assert.ok(Array.isArray(log), 'écrit dans chrome.storage.local');
  assert.ok(!log.some(e => e.d === vieux.d), 'le débordement de neuf jours est oublié');
  assert.ok(log.some(e => e.pid === 'mere' && e.k === 1 && e.f == null), 'celui en cours est ouvert');
  // Le stock redescend : il se ferme.
  g.S.planets[0].stock.c = 0;
  g.surplusNote(SOIR + 1000);
  assert.ok(g.stored().surplusLog.filter(e => e.k === 1).every(e => e.f != null), 'le cristal redescendu ferme son débordement');
});

t('surplus : la carte de la planète qui perd le plus passe devant', () => {
  // Deux planètes pleines : la mère en métal, la colonie en cristal.
  const g = appSurplus(s => { s.planets[0].stock.m = 1e9; s.planets[1].stock.c = 1e9; });
  const l = g.surplusListe(g.simulateDay()).filter(x => x.plein);
  assert.ok(l.length >= 2, JSON.stringify(l.map(x => [x.p.name, x.k])));
  for (let i = 1; i < l.length; i++) assert.ok(l[i - 1].pertes.eqM >= l[i].pertes.eqM, 'trié par perte en équivalent métal');
  assert.equal(l[0].p.name, 'Planète mère', 'la mère produit le plus');
});

t('surplus : la carte dit la perte horaire et l\'excédent, et ne propose jamais de baisser la production', () => {
  const g = appSurplus(s => { s.planets[0].stock.c = 1e9; });
  g.REFRESH.today();
  const h = lu(g.html().tdSurplus || '');
  assert.match(h, /Cristal au plafond sur Planète mère : [\d\s k,M]+ cristal\/h perdus/);
  assert.match(h, /au-dessus de la capacité/);
  assert.ok(!/baiss|rédui|diminu|pourcentage de production/i.test(h), h);
});

t('surplus : un retour d\'expédition qui fera déborder déclenche l\'alerte anticipée, avec sa cause', () => {
  const g = appSurplus(s => {
    s.moves = [{ mission: 15, ret: true, arrival: SOIR / 1000 + 8.7 * 3600, origin: '1:142:8', dest: '1:142:16', cargo: [0, 3.2e6, 0] }];
  });
  const c = g.constats().find(x => x.regle === 'RES_STORAGE_SOON' && x.valeur === 1 && x.pid === 'mere');
  assert.ok(c, 'le cristal déborde au retour');
  assert.match(c.vars.cause, /^Retour d'expédition à (demain )?\d\d:\d\d : \+3,20 M cristal\. $/);
  assert.match(c.why, /Retour d'expédition/);
});

t('surplus : un convoi qui ferait déborder sa cible est signalé, avec une autre cible', () => {
  const g = appSurplus(s => {
    s.planets.push({ id: 'trois', name: 'Troisième', coords: '1:150:4', tmax: 40,
      b: Object.assign({}, s.planets[0].b, { smetal: 10, scrystal: 10, sdeut: 10 }), sats: 0, ships: {}, shipsAt: 0, stock: { m: 0, c: 0, d: 0, at: SOIR } });
    s.planets[0].stock = { m: 6e4, c: 6e4, d: 1e4, at: SOIR };
    s.planets[0].ships = { lc: 10 };
    s.planets[1].stock = { m: 9500, c: 9500, d: 9500, at: SOIR };   // Colonie à 95 % de ses hangars de 10 000
    s.settings.secu = { vaults: ['colo'] };
  });
  const t0 = g.transportSuggere(g.S.planets[0], { mode: 'routine', now: SOIR, wake: REVEIL, visees: new Set() });
  assert.equal(t0.dest.name, 'Colonie', 'le seul coffre-fort déclaré');
  assert.ok(t0.deborde.length, 'la cargaison la fait déborder');
  assert.match(t0.note, /À l'arrivée, Colonie dépassera sa capacité en .* s'arrêter/);
  assert.match(t0.note, /Autre cible avec la place : Troisième\./);
});

t('surplus : la phrase de débordement nomme ce qui s\'arrête', () => {
  const g = appSurplus();
  assert.equal(g.debordeTexte('Erablis', [1]), 'À l\'arrivée, Erablis dépassera sa capacité en cristal : la mine s\'arrêtera.');
  assert.equal(g.debordeTexte('Erablis', [2]), 'À l\'arrivée, Erablis dépassera sa capacité en deutérium : le synthétiseur s\'arrêtera.');
  assert.equal(g.debordeTexte('Erablis', [0, 1]), 'À l\'arrivée, Erablis dépassera sa capacité en métal et cristal : les mines s\'arrêteront.');
  assert.equal(g.debordeTexte('Erablis', []), '');
});

t('surplus : rien n\'est envoyé tout seul — un transfert ne se prépare que par le bouton', () => {
  const g = appSurplus(VERS_COLONIE, true);
  const s = g.transfertVersBesoin(g.S.planets[0], 1, ATTENTE_COLONIE(1e5));
  g.REFRESH.today();
  assert.ok(!g.sent().some(m => m && /fleet|send|dispatch/i.test(JSON.stringify(m))), JSON.stringify(g.sent()));
  assert.ok(s && s.mission === 3);
});

/* ENH-54, étape 2 : Réglages en sous-onglets, renvois cliquables. */
const appReglages = (mode, modifier) => {
  const s = fixtureState();
  s.planets.forEach(p => { p.stock.at = SOIR; });
  if (modifier) modifier(s);
  if (mode) s.__win = { __cardLayout: mode };
  return loadApp(s, SOIR, CARTES_W.concat(['cardMode', 'cardTabs', 'renvoiCible', 'allerVers', 'RENVOI_RE', 'TOOLS', 'enOnglets', 'S', 'ongletAffiche']));
};
/** Les titres de carte (h2 ou résumé) d'un groupe de Réglages, dans l'ordre. */
const titresDuGroupe = (h, id) => {
  const bloc = h.split(`data-carte="${id}">`)[1].split('<div class="carte"')[0];
  return [...bloc.matchAll(/<div class="card"><h2>([^<]+)<\/h2>|<summary data-fold="[^"]+">([^<]+?)\s*<span/g)].map(m => (m[1] || m[2]).trim());
};

t('ENH-54 : Réglages se range en cinq onglets, même quand Aujourd\'hui est empilé', () => {
  const g = appReglages('stacked');
  assert.equal(g.cardMode, 'stacked', 'Aujourd\'hui empilé, par choix du joueur');
  const h = g.VIEWS.settings();
  assert.match(h, /<section class="panel en-onglets" data-disposition="settings"><div class="seg" role="tablist" id="carteTabs"/);
  assert.deepEqual(ordreCartes(h), ['jeu', 'defense', 'affichage', 'moteur', 'donnees']);
  assert.deepEqual(g.CARTES.settings.map(c => c.titre), ['Mon jeu', 'Défense et sécurité', 'Affichage', 'Moteur', 'Données']);
  assert.ok(g.enOnglets('settings') && g.enOnglets('empire') && !g.enOnglets('today'));
});

t('ENH-54 : chaque carte de Réglages est dans son groupe, aucune ne manque', () => {
  const h = appReglages().VIEWS.settings();
  assert.deepEqual(titresDuGroupe(h, 'jeu'), ['Profil et plan du jour', 'Formes de vie découvertes', 'Bonus', 'Énergie']);
  assert.deepEqual(titresDuGroupe(h, 'defense'), ['Modèle de défense', 'Sécurité et mise à l\'abri']);
  assert.deepEqual(titresDuGroupe(h, 'affichage'), ['Allure du panneau', 'Affichage', 'Page du jeu']);
  assert.deepEqual(titresDuGroupe(h, 'moteur'), ['Règles du moteur', 'Fiabilité des calculs']);
  assert.deepEqual(titresDuGroupe(h, 'donnees'), ['Sauvegarde', 'Version']);
  // Les champs lus par REFRESH.settings et bind() restent dans le DOM, masqués ou non.
  for (const id of ['aideJour', 'daySum', 'sSkin', 'sEmpile', 'ioSave', 'sRatio']) assert.ok(h.includes(`id="${id}"`), id);
});

t('ENH-54 : passer en onglets depuis Réglages ne touche pas le sous-onglet de Réglages', () => {
  const g = appReglages(null, s => { s.__tab = 'settings'; });
  g.render();
  g.cardTabs.settings = 'moteur';
  g.setCardMode('tabs');
  assert.equal(g.cardTabs.settings, 'moteur');
  assert.ok(!('today' in g.cardTabs) || g.cardTabs.today !== 'jeu', 'aucun groupe de Réglages n\'atterrit sur Aujourd\'hui');
});

t('ENH-54 : un renvoi mène au bon onglet et au bon sous-onglet', () => {
  const g = appReglages();
  assert.equal(g.renvoiCible('Réglages', 'Affichage'), 'settings:affichage');
  assert.equal(g.renvoiCible('Réglages', 'Plan du jour'), 'settings:jeu');
  assert.equal(g.renvoiCible('Réglages', 'Sécurité'), 'settings:defense');
  assert.equal(g.renvoiCible('Réglages', 'Version'), 'settings:donnees');
  assert.equal(g.renvoiCible('Outils', 'Défense'), 'tools:defense');
  assert.equal(g.renvoiCible('Outils', 'Colonie'), 'tools:colony');
  assert.equal(g.renvoiCible('Outils', 'Ailleurs'), null);
  for (const [k, l] of g.TOOLS) assert.equal(g.renvoiCible('Outils', l), 'tools:' + k, l);
});

t('ENH-54 : tout renvoi écrit dans le panneau mène quelque part', () => {
  /* Un renvoi qui ne mène nulle part resterait du texte : le joueur ne saurait
     pas pourquoi celui-ci ne se clique pas. Un nouveau nom de groupe ou
     d'outil doit s'ajouter à renvoiCible. */
  const g = appReglages();
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
  const perdus = [...src.matchAll(g.RENVOI_RE)].filter(m => !g.renvoiCible(m[1], m[2])).map(m => m[0]);
  assert.deepEqual([...new Set(perdus)], []);
});

t('ENH-54 : « Modifier » et les renvois ouvrent le sous-onglet, retenu comme un clic', () => {
  const g = appReglages();
  g.allerVers('settings:affichage');
  assert.equal(g.cardTabs.settings, 'affichage');
  g.allerVers('tools:defense');
  assert.equal(g.S.ui.tool, 'defense');
  g.allerVers('settings:nulle-part');
  assert.equal(g.cardTabs.settings, 'affichage', 'un sous-onglet inconnu ne change rien');
  const src = ['app.js', 'src/vues/aujourdhui.js', 'src/vues/defense.js'].map(f => require('fs').readFileSync(require('path').join(__dirname, '..', f), 'utf8')).join('\n');
  const gotos = [...src.matchAll(/data-goto="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(gotos, ['settings:defense', 'settings:jeu', 'settings:defense']);
});

/* ENH-54, étape 3 : Empire en sous-onglets, Aujourd'hui en onglets par défaut. */
t('ENH-54 : Empire se range en deux onglets, Planètes et Recherche', () => {
  const g = appReglages('stacked');
  const h = g.VIEWS.empire();
  assert.match(h, /<section class="panel en-onglets" data-disposition="empire"><div class="seg" role="tablist" id="carteTabs"/, 'même quand Aujourd\'hui est empilé');
  assert.deepEqual(ordreCartes(h), ['planetes', 'recherche']);
  assert.ok(h.split('data-carte="recherche"')[1].includes('Recherches et niveaux visés'), 'la recherche dans son onglet');
  for (const id of ['empireRes', 'empireFactor', 'labLv']) assert.ok(h.includes(`id="${id}"`), id + ' toujours là pour REFRESH.empire');
});

t('ENH-54 : Aujourd\'hui s\'ouvre sur Maintenant une fois le profil posé, sur le questionnaire avant', () => {
  const g = appReglages();
  assert.equal(g.ongletAffiche(['profil', 'maintenant', 'journee'], null, undefined, 'maintenant'), 'maintenant', 'le défaut de la vue');
  assert.equal(g.ongletAffiche(['profil', 'maintenant'], null, 'profil', 'maintenant'), 'profil', 'le choix du joueur passe devant');
  assert.equal(g.ongletAffiche(['profil', 'maintenant'], 'maintenant', 'profil', 'profil'), 'maintenant', 'une alerte passe devant tout');
  assert.equal(g.ongletAffiche(['profil', 'journee'], null, null, 'maintenant'), 'profil', 'défaut absent : le premier');
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'vues', 'navigation.js'), 'utf8');
  assert.match(src, /CARTE_DEFAUT = \{today: \(\)=> S\.profil\.set \? 'maintenant' : 'profil'\}/);
});

/* ENH-54, étape 4 : un contrôle par type de donnée, une phrase d'aide visible par carte. */
const PROFIL_POSE = s => { s.profil = { set: true, style: 'mineur', classe: 'collector', activite: 'souvent', focus: [] }; };

t('ENH-54 : la mise à l\'abri est une bascule, le retour un champ heure', () => {
  const g = app();
  const h = g.VIEWS.settings();
  assert.match(h, /<label class="f bascule"><span>Mise à l'abri \(nuit, absence\)<\/span><input type="checkbox" id="dNight" data-day="night"/);
  assert.match(h, /<input id="dBack" type="time" step="3600" data-day="backHour" value="">/);
  assert.doesNotMatch(h, />non<\/option><option value="1"[^>]*>oui</, 'plus de menu non/oui');
  assert.equal(g.dayValue('backHour', '07:00', null), 7, 'la valeur d\'un champ heure');
  assert.match(app(s => { s.day.backHour = 7; }).VIEWS.settings(), /data-day="backHour" value="07:00"/);
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
  assert.match(src, /el\.type==='checkbox' \? \(el\.checked \? '1' : '0'\) : el\.value/, 'la bascule se lit cochée ou non');
});

t('ENH-54 : les explications longues de Réglages attendent derrière « En savoir plus »', () => {
  const h = app(PROFIL_POSE).VIEWS.settings();
  for (const id of ['focus', 'jour', 'energie', 'defense', 'allure', 'page', 'fiabilite', 'sauvegarde', 'secu', 'regles'])
    assert.ok(h.includes(`<details class="aide"><summary data-fold="aide:${id}">En savoir plus</summary>`), id);
  assert.match(h, /data-fold="aide:jour">En savoir plus<\/summary><p class="note" id="aideJour">/, 'l\'aide du plan du jour, que REFRESH remplit');
  // Rien n'est perdu : les textes sont toujours là, repliés.
  for (const bout of ['Masqué, pas supprimé', 'Moins sûrs : la production de deutérium', 'Décocher une règle l\'éteint', 'l\'icône du Copilote affiche « FS »'])
    assert.ok(h.includes(bout), bout);
});

t('ENH-54 : aucune carte de Réglages n\'affiche plus d\'un long paragraphe d\'aide', () => {
  for (const mod of [null, PROFIL_POSE]) {
    const h = app(mod).VIEWS.settings().replace(/<details class="aide"[\s\S]*?<\/details>/g, '');
    for (const c of h.split(/(?=<div class="card">|<details class="card")/).slice(1)) {
      const titre = (c.match(/<h2>([^<]+)|data-fold="[^"]+">([^<]+)/) || []).slice(1).find(Boolean);
      const longs = [...c.matchAll(/<p class="note[^"]*"[^>]*>([\s\S]*?)<\/p>/g)].map(m => m[1].replace(/<[^>]+>/g, '')).filter(x => x.length > 120);
      assert.ok(longs.length <= 1, `${titre} : ${longs.length} longs paragraphes visibles`);
    }
  }
});

/* ENH-54, étape 5 : les critères restés partiels. */
/** Les volets imbriqués d'un HTML : [classe du parent, classe de l'enfant] pour chaque volet posé dans un volet. */
function voletsDansVolets(h) {
  const pile = [], fautes = [];
  for (const m of h.matchAll(/<details\b([^>]*)>|<\/details>/g)) {
    if (!m[1] && m[0] === '</details>') { pile.pop(); continue; }
    const cls = ((m[1] || '').match(/class="([^"]*)"/) || [, ''])[1];
    const volet = /\bvolet\b/.test(cls);
    if (volet && pile.some(c => /\bvolet\b/.test(c))) fautes.push(cls);
    pile.push(cls);
  }
  return fautes;
}

t('ENH-54 : aucun volet dans un volet, sur toutes les pages', () => {
  /* Deux niveaux : la carte repliable (details.card, et sa forme en ligne
     details.card.ligne pour une planète ou le profil), et le volet posé
     dedans. La carte d'une planète portait aussi la classe volet : ses volets
     Niveaux, Stock et « Pourquoi » étaient des volets dans un volet. */
  const g = app(PROFIL_POSE);
  const pages = { today: g.VIEWS.today(), empire: g.VIEWS.empire(), settings: g.VIEWS.settings(), conseils: g.conseilsHtml(g.simulateDay()) || '' };
  for (const k of ['explore', 'colony', 'fleet', 'defense', 'moon', 'server']) { g.S.ui.tool = k; pages['tools:' + k] = g.VIEWS.tools(); }
  for (const [nom, h] of Object.entries(pages)) assert.deepEqual(voletsDansVolets(h), [], nom);
  assert.match(pages.empire, /<details class="card ligne" data-pi="0"/);
  assert.deepEqual(voletsDansVolets('<details class="volet"><details class="volet"></details></details>'), ['volet'], 'le contrôle mord');
});

t('ENH-54 : un oui/non est un interrupteur ; une case reste pour choisir dans une liste', () => {
  /* Restent des cases : choisir des éléments d'une liste (formes de vie,
     focus, coffres-forts, jours du rappel, planètes de « Poser sur toutes »),
     et la forme de vie lue sur les planètes, affichée cochée et grisée. */
  const LISTES = ['data-lf=', 'data-pfocus=', 'data-secu-vault=', 'data-secu-jour=', 'data-posep=', 'checked disabled', 'id="${id}" ${attr}'];
  const fs = require('fs'), path = require('path');
  const src = ['app.js', 'src/flotte/cible.js', 'src/meteo.js', 'profils.js', ...fs.readdirSync(path.join(__dirname, '..', 'src', 'vues')).map(f => 'src/vues/' + f)].map(f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n');
  const cases = [...src.matchAll(/<input[^>]*type="checkbox"[^>]*>/g)].map(m => m[0]);
  const fautes = cases.filter(c => !/class="[^"]*\binterrupteur\b/.test(c) && !LISTES.some(x => c.includes(x)));
  assert.deepEqual(fautes, []);
  for (const a of ['data-rg-on=', 'data-regoff=', 'id="rdSafe"', 'data-cf="manque"', 'data-centre=']) assert.ok(cases.some(c => c.includes(a) && c.includes('interrupteur')), a);
  const css = CSS();
  assert.match(css, /label\.f\.bascule input,input\.interrupteur\{/, 'même dessin que la bascule');
  assert.match(css, /label\.f\.bascule input:checked::after,input\.interrupteur:checked::after\{/);
});

t('ENH-54 : les aides longues d\'Outils attendent derrière « En savoir plus »', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'vues', 'outils.js'), 'utf8');
  assert.match(src, /aide\('cotransport', '<p class="note">Les transporteurs partent après/);
  const fl = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'flotte', 'cible.js'), 'utf8');
  assert.match(fl, /<p class="note">Ce que chaque planète devrait avoir pour lancer une expédition et lever son stock seule le soir\.<\/p>\s*\$\{aide\('flottecible'/);
});

/* ENH-54, étape 1 : une seule échelle de styles. Ces deux vérifications
   empêchent les écarts de revenir un par un, ce qui les avait fait naître. */
const sansCommentaires = css => css.replace(/\/\*[\s\S]*?\*\//g, '');

t('ENH-54 : aucun style en ligne dans le panneau, hors couleur de planète', () => {
  /* 97 attributs style="…" faisaient chacun leur espacement. Le seul qui
     reste porte une valeur calculée : la couleur de la planète (--pc). */
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', 'sidepanel.html'), 'utf8');
  const styles = (src + html).match(/style="[^"]*"/g) || [];
  assert.deepEqual(styles.filter(x => !x.startsWith('style="--pc:')), [], 'styles en ligne : ' + styles.join(' '));
});

t('ENH-54 : panel.css ne prend ses tailles et ses espacements que dans l\'échelle', () => {
  const css = sansCommentaires(CSS());
  // Tailles de texte : uniquement --fs-*, hors titre du panneau qui suit la largeur (clamp).
  const tailles = (css.match(/font(?:-size)?:[^;}]*\d+px[^;}]*/g) || []).filter(x => !/clamp\(/.test(x));
  assert.deepEqual(tailles, [], 'tailles en dur : ' + tailles.join(' | '));
  // Espacements : uniquement --sp-*, hors le vide de fin de page (48px) et le repli 0px de env().
  const esp = (css.match(/(?:padding|margin|gap)[a-z-]*:[^;}]+/g) || [])
    .map(x => x.replace(/env\([^)]*\)/g, '').replace(/48px/, ''))
    .filter(x => /\d+px/.test(x));
  assert.deepEqual(esp, [], 'espacements en dur : ' + esp.join(' | '));
  // Rayons : --r, --r-sm, la pilule (999px), le rond (50%), l'angle droit (0) et le filet de 2px du thème Relief.
  const rayons = (css.match(/border-radius:[^;}]+/g) || [])
    .filter(x => !/^border-radius:(var\(--r(-sm)?\)|999px|50%|0|2px)$/.test(x));
  assert.deepEqual(rayons, [], 'rayons hors échelle : ' + rayons.join(' | '));
});

t('ENH-54 : un seul style de volet, déclaré une seule fois', () => {
  const css = sansCommentaires(CSS());
  assert.doesNotMatch(css, /details\.card summary\{/, 'l\'ancienne règle en double a disparu');
  assert.doesNotMatch(css, /Ouvrir \+/, 'plus de second indicateur');
  // Chaque repli du panneau est une carte ou un volet (le sélecteur de défense et le « comment faire » d'une carte d'action exceptés).
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
  const nus = (src.match(/<details(?![^>]*class="[^"]*\b(?:card|volet|defpick|how|aide)\b)[^>]*\$\{fold/g) || []);
  assert.deepEqual(nus, [], 'volets sans style : ' + nus.join(' '));
});

if (failures.length) {
  for (const [name, e] of failures) console.error('ÉCHEC  ' + name + '\n       ' + e.message);
  console.error('\n' + failures.length + ' échec(s), ' + passed + ' réussite(s)');
  process.exit(1);
}
console.log(passed + ' vérifications passées');
