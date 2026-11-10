/* node test/run.js — vérifie la mise à l'abri.
   Pas de framework : app.js reste un script classique chargé par la page, et on
   l'évalue ici comme le ferait le navigateur, avec un DOM factice. */
const assert = require('assert');
const { loadApp, fixtureState } = require('./harness');

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
  return loadApp(s, now == null ? SOIR : now, ['fleetsavePlan', 'dailyMissions', 'S', 'shipList', 'flight', 'REFRESH', 'simulateDay', 'planetRef', 'qHtml', 'actGo', 'goUrl', 'lfSecs', 'lfRes', 'lfQueue', 'planHints', 'gameSkin', 'etaSecs', 'hms'], api, ext);
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

if (failures.length) {
  for (const [name, e] of failures) console.error('ÉCHEC  ' + name + '\n       ' + e.message);
  console.error('\n' + failures.length + ' échec(s), ' + passed + ' réussite(s)');
  process.exit(1);
}
console.log(passed + ' vérifications passées');
