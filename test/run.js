/* node test/run.js — vérifie la mise à l'abri.
   Pas de framework : app.js reste un script classique chargé par la page, et on
   l'évalue ici comme le ferait le navigateur, avec un DOM factice. */
const assert = require('assert');
const { loadApp, fixtureState } = require('./harness');
const { runPage } = require('./page');

let passed = 0;
const failures = [];
function t(name, fn) {
  try { fn(); passed++; } catch (e) { failures.push([name, e]); }
}

/* 22 h 30 : la nuit commence à 23 h et finit à 7 h dans l'état de test. */
const SOIR = new Date(2026, 10, 8, 22, 30, 0).getTime();
const REVEIL = new Date(2026, 10, 9, 7, 0, 0).getTime();

/** Charge l'application avec un état modifié à la volée. */
function app(modifier, now, api, ext) {
  const s = fixtureState();
  // le stock avance tout seul depuis sa date : on le cale sur l'instant du test
  s.planets.forEach(p => { p.stock.at = now == null ? SOIR : now; });
  if (modifier) modifier(s);
  return loadApp(s, now == null ? SOIR : now, ['fleetsavePlan', 'dailyMissions', 'S', 'shipList', 'flight', 'REFRESH', 'simulateDay', 'planetRef', 'qHtml', 'actGo', 'goUrl', 'lfSecs', 'lfRes', 'lfQueue', 'planHints', 'gameSkin', 'etaSecs', 'hms', 'copyChips', 'missionGo', 'nextResearch', 'techPayback', 'maxPlanets', 'adviceList', 'storageCap', 'storageLevelFor', 'crawlerMax', 'crawlerBonus', 'levelCost', 'rangeCost', 'mse', 'T', 'POS_BONUS_M', 'expoCap', 'expoInFlight', 'goNote', 'actHtml', 'waitFor', 'raidPlan', 'production', 'rankUpgrades', 'colonyPayback', 'coloFleet'], api, ext);
}

/* ---------- ce qu'il y a à envoyer ---------- */

t('sans transporteur à quai, rien à proposer', () => {
  const g = app(s => { s.planets[0].ships = { pr: 4 }; });
  assert.equal(g.fleetsavePlan(SOIR), null);
});

t('avec des transporteurs, la flotte, la destination et le retour sont nommés', () => {
  const g = app(s => { s.planets[0].ships = { lc: 30, sc: 6 }; });
  const fs = g.fleetsavePlan(SOIR);
  assert.ok(fs, 'un plan est proposé');
  assert.ok(fs.ships.lc > 0, 'des grands transporteurs sont choisis');
  assert.equal(fs.dest, '1:142:6', 'vers l\'autre planète');
  assert.equal(fs.mission, 'transport');
  assert.ok(fs.back > REVEIL, 'la flotte rentre après le réveil');
});

t('la soute embarque tout le stock quand elle le peut', () => {
  const g = app(s => { s.planets[0].ships = { lc: 30 }; });
  const fs = g.fleetsavePlan(SOIR);
  assert.ok(fs.cargo >= fs.load, 'soute ' + fs.cargo + ' pour ' + fs.load + ' à sauver');
});

t('la vitesse retenue est la plus rapide qui tient jusqu\'au réveil', () => {
  const g = app(s => { s.planets[0].ships = { lc: 30 }; });
  const fs = g.fleetsavePlan(SOIR);
  assert.ok(SOIR + 2 * g.flight('1:142:8', fs.dest, fs.ships, fs.pct).secs * 1000 > REVEIL,
    'à ' + fs.pct + ' %, la flotte rentre après le réveil');
  if (fs.pct < 100) {
    const cran = fs.pct + 10;
    assert.ok(SOIR + 2 * g.flight('1:142:8', fs.dest, fs.ships, cran).secs * 1000 <= REVEIL,
      'à ' + cran + ' %, elle rentrerait trop tôt — donc ' + fs.pct + ' % est bien le plus rapide qui tient');
  }
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

t('sans deuxième planète, la flotte part en expédition', () => {
  const g = app(s => {
    s.planets = [s.planets[0]];
    s.planets[0].ships = { lc: 20 };
  });
  const fs = g.fleetsavePlan(SOIR);
  assert.ok(fs, 'un plan est proposé quand même');
  assert.equal(fs.mission, 'expedition');
  assert.equal(fs.dest, '1:142:16');
});

/* ---------- ce que le joueur lit ---------- */

t('le rappel du soir nomme la flotte au lieu de rester vague', () => {
  const g = app(s => { s.planets[0].ships = { lc: 30 }; });
  const nuit = g.dailyMissions().find(m => m.id === 'night');
  assert.ok(nuit, 'le rappel existe le soir');
  assert.ok(/transporteur/.test(nuit.how.join(' ')), 'les étapes nomment la flotte');
  assert.ok(/1:142:6/.test(nuit.how.join(' ')), 'et la destination');
});

t('sans transporteur, le rappel reste utile mais générique', () => {
  const g = app(s => { s.planets[0].ships = {}; });
  const nuit = g.dailyMissions().find(m => m.id === 'night');
  assert.ok(nuit, 'le rappel existe toujours');
  assert.ok(/Dépense/.test(nuit.how.join(' ')), 'il conseille au moins de dépenser');
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

/* ---------- les formes de vie dans le plan ---------- */

/* Relevé sur le jeu : Secteur résidentiel 25 sur la planète mère. */
const CASE_OK = { lvl: 24, state: 'ok', next: 25, cost: [13911, 3974, 0], secs: 1834,
  nom: 'Secteur résidentiel' };
const vieSur = (lf, modif) => app(s => {
  s.planets[0].lf = lf;
  if (modif) modif(s);
}, SOIR);
const premierLf = g => g.simulateDay().sessions[0].acts.find(a => a.kind === 'lf');

t('une case de forme de vie payable entre dans le plan', () => {
  const a = premierLf(vieSur({ 11101: CASE_OK }));
  assert.ok(a, 'elle doit être proposée comme une construction ordinaire');
  assert.deepEqual(a.cost, [13911, 3974, 0], 'au prix que le jeu affiche');
  assert.equal(a.dur, 1834, 'et à la durée que le jeu affiche');
  assert.ok(/Secteur résidentiel 25/.test(a.what), a.what);
});

t('une case trop ch\u00e8re \u00e0 l\'instant T devient une attente, pas un silence', () => {
  // « Pas assez de ressources » décrit la seconde où le joueur a vu la page.
  // Le plan, lui, sait quand le stock sera là : c'est tout son intérêt.
  const g = vieSur({ 11101: { ...CASE_OK, state: 'short', cost: [400000, 0, 0] } });
  const w = g.simulateDay().sessions[0].waits.find(x => /Secteur résidentiel/.test(x.what));
  assert.ok(w, 'elle doit figurer en attente');
  assert.ok(w.miss[0] > 0, 'avec ce qui manque : ' + JSON.stringify(w.miss));
});

t('une case de forme de vie ne passe pas devant un b\u00e2timent qui attend', () => {
  // Les deux files sont indépendantes, mais le stock est commun. Une case à
  // 20 000 métal vide ce que la mine met de côté : elle doit s'effacer, comme
  // le chantier spatial le fait déjà.
  const g = app(s => {
    // la centrale de la planète mère est à moins d'une heure de ses ressources
    s.planets[0].stock = { m: 20000, c: 8000, d: 1000, at: SOIR };
    s.planets[0].lf = { 11101: { ...CASE_OK, cost: [20000, 0, 0], secs: 60 } };
  }, SOIR);
  const s0 = g.simulateDay().sessions[0];
  const mere = w => /Planète mère/.test(w.q);
  assert.ok(s0.waits.some(w => mere(w) && /Centrale/.test(w.what)),
    'la centrale de la planète mère doit bien être en attente');
  assert.ok(!s0.acts.some(a => a.kind === 'lf'),
    'la forme de vie ne doit pas prendre le stock que la centrale économise');
  assert.ok(s0.waits.some(w => mere(w) && /Secteur résidentiel/.test(w.what)),
    'elle attend son tour au lieu de disparaître');
});

/* Le même décor que le test précédent : la centrale de la planète mère est
   à moins d'une heure de ses ressources, et une case coûte tout le métal. */
const disputeStock = s => {
  s.planets[0].stock = { m: 20000, c: 8000, d: 1000, at: SOIR };
  s.planets[0].lf = { 11101: { ...CASE_OK, cost: [20000, 0, 0], secs: 60 } };
};

t('\u00ab apr\u00e8s les b\u00e2timents \u00bb vaut aussi pour un b\u00e2timent lointain', () => {
  // La centrale de la planète mère est à six heures de son compte. Le joueur
  // qui a choisi « après les bâtiments » n'a pas demandé « après ceux de la
  // prochaine heure » : une case ne doit pas lui manger cette épargne.
  const g = app(s => {
    s.planets[0].stock = { m: 20000, c: 4000, d: 1000, at: SOIR };
    s.planets[0].lf = { 11101: { ...CASE_OK, cost: [20000, 0, 0], secs: 60 } };
  }, SOIR);
  const s0 = g.simulateDay().sessions[0];
  assert.ok(s0.waits.some(w => /Planète mère/.test(w.q) && /Centrale/.test(w.what)),
    'la centrale attend bien');
  assert.ok(!s0.acts.some(a => a.kind === 'lf'),
    'la case ne doit pas passer devant : ' + s0.acts.map(a => a.what).join(', '));
});

t('r\u00e9gl\u00e9es en priorit\u00e9, les formes de vie passent devant', () => {
  const g = app(s => { disputeStock(s); s.day.lf = 'first'; }, SOIR);
  assert.ok(g.simulateDay().sessions[0].acts.some(a => a.kind === 'lf'),
    'le joueur a demandé qu\'elles passent en premier');
});

t('d\u00e9sactiv\u00e9es, elles dispara\u00eessent compl\u00e8tement', () => {
  const g = app(s => { disputeStock(s); s.day.lf = 'off'; s.syncAt = SOIR; }, SOIR, null, true);
  const s0 = g.simulateDay().sessions[0];
  assert.ok(!s0.acts.some(a => a.kind === 'lf'), 'rien de proposé');
  assert.ok(!s0.waits.some(w => /Secteur résidentiel/.test(w.what)), 'rien en attente');
  // et surtout plus de rappel d'aller relever les pages : il ne servirait à rien
  assert.ok(!g.dailyMissions().some(m => m.id === 'lfb' || m.id === 'lfr'),
    'ni de rappel de relevé');
});

t('un prix relev\u00e9 pour un niveau d\u00e9pass\u00e9 n\'est plus utilis\u00e9', () => {
  // le joueur a monté la case deux fois depuis : le prix lu alors ne vaut
  // plus rien, et l'afficher annoncerait un niveau déjà construit.
  const g = vieSur({ 11101: { ...CASE_OK, lvl: 26, next: 25 } });
  const s0 = g.simulateDay().sessions[0];
  assert.ok(!s0.acts.some(a => a.kind === 'lf'), 'pas de prix périmé dans le plan');
  assert.ok(!s0.waits.some(x => /Secteur résidentiel/.test(x.what)), 'ni en attente');
});

t('un prix p\u00e9rim\u00e9 fait redemander une case', () => {
  const g = app(s => {
    s.syncAt = SOIR;
    s.planets.forEach(p => { p.lf = { 11101: { ...CASE_OK, lvl: 26, next: 25 } }; });
  }, SOIR, null, true);
  const m = g.dailyMissions().find(x => x.id === 'lfb');
  assert.ok(m && /Clique une case/.test(m.what), 'il redemande le prix : ' + (m && m.what));
});

t('une page visit\u00e9e sans aucune case ne se r\u00e9clame plus', () => {
  // la recherche de forme de vie demande un bâtiment : tant qu'il manque,
  // la page est vide. Rien à relever, donc rien à rappeler.
  const g = app(s => {
    s.syncAt = SOIR;
    s.planets.forEach(p => { p.lfSeen = { lfresearch: SOIR }; });
  }, SOIR, null, true);
  assert.ok(!g.dailyMissions().some(x => x.id === 'lfr'),
    'le copilote est passé, il n\'y avait rien : il se tait');
});

t('une case verrouill\u00e9e par un pr\u00e9requis reste exclue', () => {
  // « Prérequis non remplis » n'est pas une question de ressources : aucune
  // attente ne la débloquera, l'annoncer serait un faux espoir.
  const g = vieSur({ 11101: { ...CASE_OK, state: 'locked' } });
  const s0 = g.simulateDay().sessions[0];
  assert.ok(!s0.acts.some(a => a.kind === 'lf'), 'pas proposée');
  assert.ok(!s0.waits.some(x => /Secteur résidentiel/.test(x.what)), 'pas en attente non plus');
});

t('page lue mais aucun prix : la carte demande d\'ouvrir une case', () => {
  const g = app(s => {
    s.syncAt = SOIR;
    s.planets.forEach(p => { p.lf = { 11101: { lvl: 24, state: 'short' } }; });
  }, SOIR, null, true);
  const m = g.dailyMissions().find(x => x.id === 'lfb');
  assert.ok(m, 'le copilote connaît les niveaux mais pas les prix : il doit le dire');
  assert.ok(/case/.test(m.what + m.why),
    'et demander d\'ouvrir une case, pas de relever la page : ' + m.what);
  assert.ok(/1 case/.test(m.why), 'en disant ce qu\'il a déjà lu : ' + m.why);
});

t('une case verrouill\u00e9e n\'est pas propos\u00e9e', () => {
  const a = premierLf(vieSur({ 11104: { lvl: 0, state: 'locked' } }));
  assert.ok(!a, 'un prérequis manquant n\'est pas une action');
});

t('sans prix connu, le copilote demande d\'ouvrir la page une fois', () => {
  const g = app(s => {
    s.syncAt = SOIR;
    s.planets.forEach(p => { p.lf = { 11101: { lvl: 24, state: 'ok' } }; });
  }, SOIR, null, true);
  assert.ok(!premierLf(g), 'on ne propose pas ce qu\'on ne sait pas chiffrer');
  const m = g.dailyMissions().find(x => x.id === 'lfb');
  assert.ok(m && /Clique une case/.test(m.what),
    'il demande d\'ouvrir une case : ' + (m && m.what));
});

t('la carte ne r\u00e9clame plus rien quand tout est trop cher', () => {
  const g = app(s => {
    s.syncAt = SOIR;
    s.planets.forEach(p => { p.lf = { 11101: { ...CASE_OK, state: 'short' } }; });
  }, SOIR, null, true);
  assert.ok(!g.dailyMissions().some(m => m.id === 'lfb'),
    'le joueur n\'a pas de quoi : le lui rappeler toutes les deux heures ne sert à rien');
});

/* ---------- lire les formes de vie sur la page ---------- */

t('chaque identifiant tombe dans la bonne file', () => {
  const g = app();
  // relevé : 111xx bâtiments des Humains, 112xx leurs recherches
  assert.equal(g.lfQueue(11101), 'lfbuilding', 'Secteur résidentiel');
  assert.equal(g.lfQueue(11201), 'lfresearch', 'Ambassadeurs intergalactiques');
  // la race suivante décale de deux séries
  assert.equal(g.lfQueue(11301), 'lfbuilding');
  assert.equal(g.lfQueue(11401), 'lfresearch');
});

t('la durée de production se lit au format du jeu', () => {
  const g = app();
  assert.equal(g.lfSecs('PT30M34S'), 1834, 'relevé sur Secteur résidentiel 25');
  assert.equal(g.lfSecs('PT1H2M3S'), 3723);
  assert.equal(g.lfSecs('PT45S'), 45);
  assert.equal(g.lfSecs(null), 0, 'pas de durée affichée : on ne devine pas');
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

t('le t\u00e9moin d\'\u00e9tat dit ce que la page a re\u00e7u', () => {
  const d = runPage({ ...ASTRO, skin: SKIN }).dataset.copilote;
  assert.ok(/debits=33657643/.test(d), d);
  assert.ok(/ici=33657643/.test(d), d);
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
  const g = app(s => { relie(s); s.syncAt = SOIR; s.timers = []; }, SOIR, null, true);
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

/* ---------- le plafond des expéditions ---------- */

/** Une flotte au sol capable de remplir plusieurs expéditions d'un coup. */
function flotteDExpedition(s) {
  s.planets[0].ships = { lc: 20, pr: 1 };
  s.planets[0].stock = { m: 2000000, c: 1500000, d: 800000, at: JOUR };
  s.planets[1].ships = {};
  s.syncAt = JOUR;
}
const expeditions = g => g.simulateDay().sessions[0].acts.filter(a => a.kind === 'expo');

t('le nombre d\'expéditions affiché par le jeu l\'emporte sur la formule', () => {
  // Astrophysique 9 ferait croire à trois expéditions ; le jeu en annonce deux,
  // et c'est lui qui refuse la troisième.
  const g = app(s => { flotteDExpedition(s); s.tech.astro = 9;
    s.slots = { fleet: [0, 9], expo: [0, 2], at: JOUR }; }, JOUR);
  assert.equal(expeditions(g).length, 2);
});

t('pas plus d\'expéditions que d\'emplacements de flotte libres', () => {
  // Une expédition occupe aussi un emplacement de flotte : trois proposées sur
  // un seul emplacement libre, c'est « Nombre maximal de flottes atteint ».
  const g = app(s => { flotteDExpedition(s); s.tech.astro = 9;
    s.slots = { fleet: [8, 9], expo: [0, 3], at: JOUR }; }, JOUR);
  assert.equal(expeditions(g).length, 1);
});

t('au plafond, le plan dit quelle recherche l\'augmente', () => {
  const g = app(s => { flotteDExpedition(s); s.tech.astro = 8;
    s.slots = { fleet: [0, 9], expo: [2, 2], at: JOUR }; }, JOUR);
  const m = g.dailyMissions().find(x => x.id === 'expomax');
  assert.ok(m, 'la carte du plafond existe');
  assert.ok(/Astrophysique 9/.test(m.why + m.how.join(' ')),
    'elle nomme le niveau qui débloque la troisième : ' + m.why);
});

t('la flotte au sol dans le plafond : aucune carte de plafond', () => {
  const g = app(s => { s.planets[0].ships = { pr: 4 }; s.planets[1].ships = {};
    s.syncAt = JOUR; s.slots = { fleet: [0, 9], expo: [0, 2], at: JOUR }; }, JOUR);
  assert.ok(!g.dailyMissions().find(x => x.id === 'expomax'),
    'sans transporteur, rien à débloquer');
});

t('feuille de route épuisée : Astrophysique entre dans le plan pour les expéditions', () => {
  const g = app(s => {
    flotteDExpedition(s);
    s.day.focus = 'fleet';
    // toute la feuille de route « flotte » est derrière lui, sauf Astrophysique
    Object.assign(s.tech, { combustion: 6, impulse: 5, espionage: 4, computer: 6,
      hyper: 3, hyperdrive: 2, energy: 8, astro: 8 });
    s.planets[0].b = Object.assign({}, s.planets[0].b, { lab: 10 });
    s.slots = { fleet: [0, 9], expo: [0, 2], at: JOUR };
  }, JOUR);
  const j = g.simulateDay();
  const rech = j.sessions.flatMap(x => x.acts).filter(a => a.kind === 't')
    .concat(j.sessions.flatMap(x => x.waits).filter(w => /Recherche/.test(w.q)));
  assert.ok(rech.some(a => /Astrophysique/.test(a.what)),
    'Astrophysique est proposée ou attendue : ' + (rech.map(a => a.what).join(', ') || 'rien'));
});

t('la carte du plafond dit d\'où vient le chiffre', () => {
  // Sans ce témoin, « je ne vois pas de changement » est indécidable : le
  // plafond lu dans le jeu et le plafond déduit d'Astrophysique donnent la
  // même carte, mais seul le premier prouve que la page a été lue.
  const lu = app(s => { flotteDExpedition(s); s.tech.astro = 8;
    s.slots = { fleet: [3, 9], expo: [1, 2], at: JOUR }; }, JOUR);
  const m = lu.dailyMissions().find(x => x.id === 'expomax');
  assert.ok(/1\/2/.test(m.why), 'le chiffre lu dans le jeu : ' + m.why);
  assert.ok(/3\/9/.test(m.why), 'et les emplacements de flotte : ' + m.why);

  const deduit = app(s => { flotteDExpedition(s); s.tech.astro = 8; s.slots = null; }, JOUR);
  const d = deduit.dailyMissions().find(x => x.id === 'expomax');
  assert.ok(/Astrophysique/.test(d.why) && !/\d\/\d/.test(d.why),
    'sans lecture du jeu, la carte le dit au lieu d\'inventer un chiffre : ' + d.why);
});

t('le plafond lu hier vaut toujours aujourd\'hui', () => {
  // Le nombre d'expéditions simultanées ne change qu'avec Astrophysique : le
  // jeter au bout de trois heures ramenait le plan à la formule, c'est-à-dire
  // au bug. Seul le nombre d'expéditions *en cours* se périme.
  const g = app(s => { flotteDExpedition(s); s.tech.astro = 9;
    s.slots = { fleet: [0, 9], expo: [0, 2], at: JOUR - 20 * 3600e3 }; }, JOUR);
  assert.equal(expeditions(g).length, 2, 'toujours deux, pas la formule');
});

t('les expéditions déjà en vol sont comptées sur les mouvements du jeu', () => {
  // Le jeu dit « Expéditions 2/2 » et liste deux vols (mission 15), mais un
  // seul retour avait un minuteur. Le plan en déduisait un emplacement libre
  // et proposait une troisième expédition que le jeu refuse.
  const g = app(s => {
    flotteDExpedition(s);
    s.tech.astro = 4;
    s.slots = { fleet: [4, 7], expo: [2, 2], at: JOUR };
    const r1 = Math.floor(JOUR / 1000) + 4 * 3600, r2 = r1 + 600;
    s.moves = [
      { arrival: r1 - 1200, dest: '1:88:16', mission: 15, origin: '1:142:8', ret: false },
      { arrival: r1, dest: '1:88:16', mission: 15, origin: '1:142:8', ret: true },
      { arrival: r2 - 1200, dest: '1:92:16', mission: 15, origin: '1:142:6', ret: false },
      { arrival: r2, dest: '1:92:16', mission: 15, origin: '1:142:6', ret: true }
    ];
    // un seul des deux retours a son minuteur : c'est le cas réel
    s.timers = [{ id: 'g1', game: true, queue: 'fleet', end: r1 * 1000, done: false,
      kind: 'x', k: 'expo', label: "Retour d'expédition" }];
  }, JOUR);
  assert.equal(expeditions(g).length, 0,
    'les deux emplacements sont pris jusqu\'au premier retour');
});

t('un retour compté une seule fois, minuteur et mouvement confondus', () => {
  // Le minuteur du jeu porte l'heure d'arrivée du mouvement : les additionner
  // bloquerait une expédition que le joueur peut lancer.
  const g = app(s => {
    flotteDExpedition(s);
    s.tech.astro = 4;
    s.slots = { fleet: [1, 7], expo: [1, 2], at: JOUR };
    const r = Math.floor(JOUR / 1000) + 4 * 3600;
    s.moves = [
      { arrival: r - 1200, dest: '1:88:16', mission: 15, origin: '1:142:8', ret: false },
      { arrival: r, dest: '1:88:16', mission: 15, origin: '1:142:8', ret: true }
    ];
    s.timers = [{ id: 'g1', game: true, queue: 'fleet', end: r * 1000, done: false,
      kind: 'x', k: 'expo', label: "Retour d'expédition" }];
  }, JOUR);
  assert.equal(expeditions(g).length, 1, 'un emplacement reste libre');
});

t('expéditions à moitié vides : des transporteurs, pas de la recherche', () => {
  // Deux emplacements, deux flottes, mais chacune très loin de la soute qu'une
  // expédition peut ramener : un emplacement de plus ne rapporterait rien.
  // Dire « fais Astrophysique » ici enverrait le joueur dépenser pour rien.
  const g = app(s => {
    s.settings.eco = 8;               // soute utile par expédition très haute
    s.tech.astro = 4;
    s.planets[0].ships = { lc: 2 };
    s.planets[1].ships = { sc: 21 };
    s.syncAt = JOUR;
    s.slots = { fleet: [2, 7], expo: [2, 2], at: JOUR };
  }, JOUR);
  const c = g.dailyMissions().find(x => x.id === 'expocargo');
  assert.ok(c, 'la carte existe');
  assert.ok(/transporteur/i.test(c.how.join(' ')), 'elle envoie au chantier : ' + c.how.join(' '));
  assert.ok(!g.dailyMissions().find(x => x.id === 'expomax'),
    'et pas en même temps celle qui réclame Astrophysique');
});

t('soutes pleines : c\'est bien le plafond qui limite', () => {
  // Même plafond, mais des flottes qui saturent la soute : là, un emplacement
  // de plus rapporte vraiment, et c'est Astrophysique qu'il faut.
  const g = app(s => {
    s.settings.eco = 1;
    s.tech.astro = 4;
    s.planets[0].ships = { lc: 40 };
    s.planets[1].ships = {};
    s.syncAt = JOUR;
    s.slots = { fleet: [0, 7], expo: [0, 2], at: JOUR };
  }, JOUR);
  assert.ok(g.dailyMissions().find(x => x.id === 'expomax'), 'la carte du plafond');
  assert.ok(!g.dailyMissions().find(x => x.id === 'expocargo'), 'pas celle des soutes');
});

/* ---------- recopier sans jouer à sa place ---------- */

t('une expédition porte sa destination', () => {
  const g = app(s => { flotteDExpedition(s); s.tech.astro = 4;
    s.slots = { fleet: [0, 7], expo: [0, 2], at: JOUR }; }, JOUR);
  const e = expeditions(g)[0];
  assert.ok(e, 'une expédition est proposée');
  assert.ok(/^\d+:\d+:16$/.test(e.dest || ''), 'la destination voyage avec l\'action : ' + e.dest);
});

t('un rapatriement porte sa destination et sa charge', () => {
  const g = app(s => {
    const c = s.planets[1];
    c.b = Object.assign({}, c.b, { metal: 14, crystal: 12, solar: 18, shipyard: 2 });
    c.ships = { lc: 10 };
    c.stock = { m: 90000, c: 60000, d: 9000, at: JOUR };
  }, JOUR);
  const r = g.simulateDay().sessions[0].acts.find(a => a.kind === 'transfer' && a.res);
  assert.ok(r, 'un rapatriement chargé est proposé');
  assert.ok(/^\d+:\d+:\d+$/.test(r.dest || ''), 'vers des coordonnées : ' + r.dest);
  assert.ok(r.res[0] > 0, 'avec le métal à saisir : ' + JSON.stringify(r.res));
});

t('les pastilles donnent ce qu\'il faut retaper, découpé comme les champs du jeu', () => {
  const h = app().copyChips({ ships: { sc: 21 }, dest: '1:79:16', res: [4200, 0, 0] });
  assert.ok(/data-copy="21"/.test(h), 'le nombre de vaisseaux : ' + h);
  // Le jeu a trois champs de coordonnées : une pastille par champ, sinon le
  // collage ne tombe pas dans le bon.
  assert.ok(/data-copy="1"/.test(h), 'la galaxie : ' + h);
  assert.ok(/data-copy="79"/.test(h), 'le système : ' + h);
  assert.ok(/data-copy="16"/.test(h), 'la position : ' + h);
  assert.ok(/data-copy="4200"/.test(h), 'le métal, en chiffres bruts : ' + h);
  assert.ok(!/4 200|4 200/.test(h), 'jamais d\'espace dans une valeur à coller : ' + h);
});

t('rien à recopier pour un bâtiment : pas de pastille', () => {
  assert.equal(app().copyChips({ kind: 'b', k: 'metal', lvl: 20, cost: [1, 2, 3] }), '');
});

t('une pastille s\'annonce comme un bouton qui copie', () => {
  // Posées à côté des étiquettes de planète, qui ne cliquent pas, les
  // pastilles passaient pour de simples libellés : le joueur ne savait pas
  // qu'elles étaient cliquables.
  const h = app().copyChips({ res: [0, 0, 8957] });
  assert.ok(/aria-label="Copier 8957"/.test(h), 'elle dit ce qu\'elle fait : ' + h);
  assert.ok(/⧉/.test(h), 'et le montre à l\'œil : ' + h);
});

t('les pastilles ont leur propre ligne, annoncée', () => {
  // Mêlées au gris des métadonnées, elles passaient pour des libellés. Une
  // ligne à elles, avec son intitulé, dit ce qu'on peut en faire.
  const h = app().copyChips({ res: [0, 0, 8957] });
  assert.ok(/class="cp"/.test(h), 'une ligne à part : ' + h);
  assert.ok(/À recopier/.test(h), 'qui s\'annonce : ' + h);
});

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
  const g = app(s => { relie(s); s.planets[0].ships = { lc: 30 }; });
  const n = g.dailyMissions().find(m => m.id === 'night');
  assert.ok(n, 'le rappel du soir existe');
  const u = g.missionGo(n);
  assert.ok(/component=fleetdispatch/.test(u) && /am203=/.test(u), 'avec la flotte : ' + u);
  assert.ok(/mission=3(&|$)/.test(u), 'en Transporter : ' + u);
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
  const c = g.adviceList().find(a => /Astrophysique 3/.test(a.what + ' ' + a.why));
  assert.ok(c, 'aucun conseil ne dit qu\'Astrophysique 3 ouvrirait une planète de plus');
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

/* ---------- résultat ---------- */

/* ---------- spécification v2 : formules isolées ---------- */

t('la capacité de hangar suit la formule du jeu', () => {
  const g = app();
  assert.equal(g.storageCap(4), 140000);
  assert.equal(g.storageCap(5), 255000);
  assert.equal(g.storageCap(7), 865000);
  assert.equal(g.storageCap(8), 1590000);
});

t('Astrophysique 5 coûte 37 500 / 75 000 / 37 500, soit 262 500 éq.', () => {
  const g = app();
  assert.deepEqual(g.levelCost(g.T.astro, 5), [37500, 75000, 37500]);
  assert.equal(g.mse(37500, 75000, 37500), 262500);
});

t('la chaîne vers Plasma 4 depuis Énergie 7, Laser 7 et Ion 5 coûte 785 800 éq.', () => {
  const g = app();
  const eq = c => g.mse(c[0], c[1], c[2]);
  const total = eq(g.rangeCost(g.T.energy, 7, 8))
              + eq(g.rangeCost(g.T.laser, 7, 10))
              + eq(g.rangeCost(g.T.plasma, 0, 4));
  assert.equal(Math.round(total), 785800);
});

t('le nombre de planètes et d\'expéditions suit Astrophysique', () => {
  assert.equal(app(s => { s.tech.astro = 4; }).maxPlanets(), 3);
  assert.equal(app(s => { s.tech.astro = 5; }).maxPlanets(), 4);
  assert.equal(app(s => { s.tech.astro = 9; }).maxPlanets(), 6);
  const g = app();
  assert.equal(g.expoCap(8), 2);
  assert.equal(g.expoCap(9), 3);
});

t('le bonus de position du métal vaut 1,35 en 8 et rien en 11', () => {
  const g = app();
  assert.equal(1 + (g.POS_BONUS_M[8] || 0), 1.35);
  assert.equal(1 + (g.POS_BONUS_M[11] || 0), 1);
});

t('les foreuses utiles valent huit fois les niveaux de mine', () => {
  const g = app();
  assert.equal(g.crawlerMax(19, 16, 15), 400);
  // +0,02 % chacune, ×1,5 pour un Collectionneur, plafonné à 50 %
  assert.ok(Math.abs(g.crawlerBonus(400, 'collector', false) - 0.12) < 1e-9);
  assert.equal(g.crawlerBonus(100000, 'collector', true), 0.5);
});

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

/* ---------- les foreuses entrent dans le classement ---------- */

t('les foreuses se classent avec les mines quand le chantier les permet', () => {
  const g = app(s => {
    s.planets[0].b.shipyard = 5; s.tech.combustion = 4; s.tech.armour = 4;
  });
  const r = g.rankUpgrades(g.S.planets[0]);
  const cw = r.find(u => u.key === 'crawl');
  assert.ok(cw, 'les foreuses sont une option du classement');
  assert.ok(cw.payback > 0 && isFinite(cw.payback), 'avec un amortissement chiffré : ' + cw.payback);
});

t('sans le chantier qui les construit, aucune foreuse proposée', () => {
  const g = app();
  assert.ok(!g.rankUpgrades(g.S.planets[0]).some(u => u.key === 'crawl'));
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

/* ---------- les expéditions en vol se lisent dans le jeu ---------- */

/* Les actions du passage en cours. La lecture « Expéditions 2/2 » ne vaut que
   trois heures : plus tard dans la journée simulée, le plan reprend la main et
   propose à nouveau — c'est voulu. La carte qui ment est celle de maintenant. */
const actes = g => g.simulateDay().sessions[0].acts;

t('deux expéditions en vol lues dans le jeu : aucune carte d\'expédition', () => {
  const g = app(s => {
    s.planets[0].ships = { lc: 30 };
    s.slots = { expo: [2, 2], fleet: [2, 9], at: SOIR };
    s.syncAt = SOIR;
    s.tech.astro = 4;
  }, SOIR);
  assert.ok(!actes(g).some(a => a.kind === 'expo'), 'le plan ne propose aucune expédition');
});

t('le compte lu est rendu tel quel quand le plafond a baissé', () => {
  const g = app(s => { s.slots = { expo: [5, 2], fleet: [5, 9], at: SOIR }; s.syncAt = SOIR; }, SOIR);
  assert.equal(g.expoInFlight().n, 5);
});

t('sans lecture de la page de flotte, les expéditions restent proposées', () => {
  const g = app(s => { s.planets[0].ships = { lc: 30 }; s.tech.astro = 4; delete s.slots; }, SOIR);
  assert.equal(g.expoInFlight(), null, 'rien de lu');
  assert.ok(actes(g).some(a => a.kind === 'expo'), 'le plan propose quand même');
});

t('une lecture de plus de trois heures ne compte plus', () => {
  const vieux = SOIR - 4 * 3600e3;
  const g = app(s => { s.slots = { expo: [2, 2], fleet: [2, 9], at: vieux }; s.syncAt = vieux; }, SOIR);
  assert.equal(g.expoInFlight(), null, 'la lecture est périmée');
});

t('les expéditions reviennent quand la lecture a expiré', () => {
  const g = app(s => {
    s.planets[0].ships = { lc: 30 };
    s.slots = { expo: [2, 2], fleet: [0, 9], at: SOIR - 4 * 3600e3 };
    s.syncAt = SOIR - 4 * 3600e3;
    s.tech.astro = 4;
  }, SOIR);
  assert.ok(actes(g).some(a => a.kind === 'expo'), 'le plan reprend la main');
});

t('la carte des expéditions dit à quelle heure le chiffre a été lu', () => {
  // assez de transporteurs pour remplir plus d'expéditions que le plafond :
  // c'est ce qui fait sortir la carte qui porte la provenance du chiffre
  const g = app(s => {
    s.planets[0].ships = { lc: 400 };
    s.slots = { expo: [1, 1], fleet: [1, 9], at: SOIR };
    s.syncAt = SOIR;
  }, SOIR);
  const c = g.dailyMissions().find(m => m.id === 'expomax');
  assert.ok(c, 'la carte du plafond d\'expéditions sort');
  assert.ok(/lu dans le jeu à \d/.test(c.why), 'elle porte l\'heure de la lecture : ' + c.why);
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

if (failures.length) {
  for (const [name, e] of failures) console.error('ÉCHEC  ' + name + '\n       ' + e.message);
  console.error('\n' + failures.length + ' échec(s), ' + passed + ' réussite(s)');
  process.exit(1);
}
console.log(passed + ' vérifications passées');
