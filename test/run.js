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
  return loadApp(s, now == null ? SOIR : now, ['fleetsavePlan', 'dailyMissions', 'S', 'shipList', 'flight', 'REFRESH', 'simulateDay', 'planetRef', 'qHtml', 'actGo', 'goUrl', 'lfSecs', 'lfRes', 'lfQueue', 'planHints', 'gameSkin', 'etaSecs', 'hms', 'copyChips', 'missionGo', 'nextResearch', 'techPayback', 'maxPlanets', 'finishTimer', 'planetAlerts', 'storageCap', 'storageLevelFor', 'crawlerMax', 'crawlerBonus', 'levelCost', 'rangeCost', 'mse', 'T', 'POS_BONUS_M', 'expoCap', 'expoInFlight', 'goNote', 'actHtml', 'waitFor', 'raidPlan', 'production', 'rankUpgrades', 'colonyPayback', 'coloFleet', 'parseProdPanel', 'prodOf', 'bridage', 'applyGame', 'lfCost', 'lfCandidates', 'speciesOf', 'speciesOfPlanet', 'foundLifeforms', 'bestLifeform', 'lfSettingsHtml', 'lfMerge', 'lfEffect', 'dayValue', 'defTarget', 'cargoGaps', 'cargoCap', 'pickCargo', 'planetById', 'forgetPlanet', 'migratePlanetIds'], api, ext);
}

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
  // Le wiki : sans lune, le déploiement est la seule mise à l'abri sûre, parce
  // qu'un déploiement rappelé est invisible à la phalange. Un Transporter se
  // voit, et une fois le retour commencé il n'y a plus rien à faire.
  assert.equal(fs.mission, 'deployment');
  assert.ok(fs.oneWay, 'un déploiement ne vole qu\'à l\'aller');
  assert.ok(fs.arrive === fs.back, 'il n\'y a pas de retour à attendre');
  assert.ok(fs.arrive > REVEIL, 'la flotte se pose après le réveil, pour pouvoir être rappelée');
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

t('une seule planète mais une sonde : espionnage vers la position 16', () => {
  // Deuxième méthode du wiki, et la seule qui ramène les ressources avec la
  // flotte : rien ne se pose sur une planète qu'on laisserait exposée.
  const g = app(s => {
    s.planets = [s.planets[0]];
    s.planets[0].ships = { lc: 20, pr: 1 };
  });
  const fs = g.fleetsavePlan(SOIR);
  assert.ok(fs, 'un plan est proposé');
  assert.equal(fs.mission, 'espionage');
  assert.match(fs.dest, /^1:\d+:16$/, 'la position 16 d\'un système choisi sur le temps de vol');
  assert.equal(fs.ships.pr, 1, 'la sonde part : sans elle le jeu refuse l\'ordre');
  assert.ok(!fs.oneWay && fs.back > REVEIL, 'aller-retour, de retour après le réveil');
});

t('ni deuxième planète ni sonde : l\'expédition, en le disant', () => {
  const g = app(s => {
    s.planets = [s.planets[0]];
    s.planets[0].ships = { lc: 20 };
  });
  const fs = g.fleetsavePlan(SOIR);
  assert.equal(fs.mission, 'expedition');
  assert.match(fs.dest, /^1:\d+:16$/);
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
  assert.equal(g.dayValue('nightStart', '-3', 23), 0);
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
  const g = app(s => { relie(s); loin(s); s.planets[0].ships = { lc: 30 }; });
  const n = g.dailyMissions().find(m => m.id === 'night');
  assert.ok(n, 'le rappel du soir existe');
  const u = g.missionGo(n);
  assert.ok(/component=fleetdispatch/.test(u) && /am203=/.test(u), 'avec la flotte : ' + u);
  assert.ok(/mission=4(&|$)/.test(u), 'en Stationner — le déploiement, seule mise à l\'abri sûre sans lune : ' + u);
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
  const g = app(MINES_HAUTES(4));
  const p = g.S.planets[0];
  const max = g.crawlerMax(p.b.metal, p.b.crystal, p.b.deut);
  const lots = g.simulateDay().sessions.flatMap(x => x.acts)
    .filter(a => a.ships && a.ships.crawl).map(a => a.ships.crawl);
  assert.ok(lots.length > 1, 'le plafond se remplit en plusieurs lots');
  assert.equal(lots.reduce((a, b) => a + b, 0), max,
    'les lots doivent totaliser le plafond exactement, et donc s\'arrêter : ' + lots.join(','));
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

t('le plan ne renvoie plus a un ecran supprime', () => {
  const g = app(s => { s.plan = []; });
  g.REFRESH.plan();
  assert.ok(!/Construire/.test(g.html().plList || ''),
    'l\'écran Construire n\'existe plus : ' + (g.html().plList || ''));
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
  assert.ok(a.some(x => /[Hh]angar/.test(x.what)), 'le hangar plein aussi');
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
  const html = g.html().tdAlerts || '';
  assert.ok(/Urgent/.test(html), 'la pastille de sévérité doit être rendue : ' + html.slice(0, 200));
  assert.ok(/[Hh]angar/.test(html), 'et le hangar plein y figurer : ' + html.slice(0, 200));
});

t('l\'alerte de file vide reste tue quand l\'extension a lu plus recemment', () => {
  const g = app(s => {
    s.lastAlerts = ['Planète mère : File vide'];
    s.lastImport = SOIR - 3600e3;
    s.syncAt = SOIR;
  });
  assert.ok(!g.dailyMissions().some(m => /file vide/i.test(m.what)),
    'un vieil import ne doit pas ressortir après une synchro');
});

t('l\'alerte de file vide est dite quand l\'import est le plus frais', () => {
  const g = app(s => {
    s.lastAlerts = ['Planète mère : File vide'];
    s.lastImport = SOIR;
    s.syncAt = SOIR - 3600e3;
  });
  assert.ok(g.dailyMissions().some(m => /file vide/i.test(m.what)),
    'une file vide signalée par le dernier import doit remonter');
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
  const g = app(s => {
    s.planets[0].ships = { lc: 30 };
    s.slots = { expo: [5, 2], fleet: [5, 9], at: SOIR };
    s.syncAt = SOIR;
    s.tech.astro = 4;
  }, SOIR);
  assert.equal(g.expoInFlight().n, 5);
  assert.ok(!actes(g).some(a => a.kind === 'expo'), 'et le plan se tait quand même');
});

/* Avant la 1.25, `slots` était enregistré sans heure de lecture. Se rabattre
   sur `syncAt`, qui avance à chaque synchronisation, rendrait ce chiffre
   éternellement frais : le panneau se tairait sur les expéditions jusqu'à la
   prochaine ouverture de la page de flotte. */
t('un réglage enregistré avant la 1.25 ne fige pas le compte', () => {
  const g = app(s => { s.slots = { expo: [2, 2], fleet: [2, 9] }; s.syncAt = SOIR; }, SOIR);
  assert.equal(g.expoInFlight(), null, 'sans heure de lecture, on ne compte pas');
});

/* Le chiffre vient d'une expression régulière sur le texte d'une page du jeu,
   où des chaînes écrites par d'autres joueurs s'affichent. Un nombre absurde y
   arriverait tôt ou tard ; il sert de borne de boucle, donc il se borne. */
t('un compte absurde est ramené à une borne tenable', () => {
  const g = app(s => { s.slots = { expo: [1e9, 2], fleet: [1, 9], at: SOIR }; s.syncAt = SOIR; }, SOIR);
  assert.ok(g.expoInFlight().n <= 32, 'borné : ' + g.expoInFlight().n);
});

t('un compte illisible vaut zéro, pas NaN', () => {
  const g = app(s => { s.slots = { expo: ['beaucoup', 2], fleet: [1, 9], at: SOIR }; s.syncAt = SOIR; }, SOIR);
  assert.equal(g.expoInFlight().n, 0);
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
  assert.ok(/prix lu à/.test(g.actHtml(a, false)));
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

t('sans défense vue sur la planète, aucun satellite proposé', () => {
  const g = app();
  assert.equal(sats(g).length, 0, 'ils partiraient en débris au premier raid');
  const a = g.planetAlerts(g.S.planets[0]).find(x => /Satellites écartés/.test(x.what));
  assert.ok(a, 'et la raison est dite');
});

t('avec une défense sur la planète, les satellites reviennent', () => {
  const g = app(s => { s.planets[0].def = 12; });
  assert.ok(sats(g).length > 0, 'la planète est défendue, le prix décide');
  assert.ok(!g.planetAlerts(g.S.planets[0]).some(x => /Satellites écartés/.test(x.what)), 'rien à expliquer');
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

/* ---------- défense ---------- */
/* Ce qui manquait : le plan ne proposait jamais de défense, et une planète
   pleine restait une ferme gratuite. On vérifie les trois états de p.def :
   jamais lu, lu à zéro, lu au-dessus de la cible. */

/** Planète mère riche, chantier libre de la colonie, avec le total donné. */
function defense(def) {
  const g = app(s => {
    relie(s);
    s.colo.built = true;
    const p = s.planets[0];
    if (def != null) p.def = def;
    p.stock = { m: 5e6, c: 2e6, d: 1e6, at: SOIR };
    p.ships = { lc: 50, sc: 20, pr: 10 };
  });
  const plan = g.simulateDay();
  const acts = plan.sessions.flatMap(x => x.acts);
  return { g, acts, act: acts.find(a => a.kind === 'def') };
}

t('page Défense jamais ouverte : rien n\'est proposé, mais on la réclame', () => {
  const { g, act } = defense(null);
  assert.equal(act, undefined, 'sans lecture, proposer doublerait ce qui existe');
  const m = g.dailyMissions().find(x => x.id === 'defseen');
  assert.ok(m, 'la carte réclamant la page manque');
  assert.match(g.missionGo(m), /component=defenses/, 'la carte mène à la page Défense');
});

t('aucune défense : des lanceurs entrent dans le plan, sur la page Défense', () => {
  const { g, acts, act } = defense(0);
  assert.ok(act, 'aucune défense proposée : ' + JSON.stringify(acts.map(a => a.what)));
  assert.ok(act.ships.rl > 0, 'des lanceurs de missiles');
  assert.equal(act.cost[0], act.ships.rl * 2000, 'métal seul, 2 000 par lanceur');
  assert.equal(act.cost[1] + act.cost[2], 0);
  assert.match(act.what, /lanceurs de missiles/, 'nommés en clair : ' + act.what);
  assert.match(g.actGo(act), /component=defenses/, 'le lien ouvre la page Défense');
  assert.match(act.q, /^Défense · /, 'rangé sous Défense : ' + act.q);
  assert.ok(!g.dailyMissions().some(x => x.id === 'defseen'), 'la page est lue, plus rien à réclamer');
});

t('zéro défense passe devant le reste du chantier', () => {
  const { acts } = defense(0);
  const q = acts.map(a => a.q);
  const iDef = q.findIndex(x => /^Défense/.test(x)), iSh = q.findIndex(x => /^Chantier/.test(x));
  if (iSh >= 0) assert.ok(iDef < iSh, 'le raid est gratuit, la défense d\'abord : ' + q.join(' | '));
});

t('la cible suit la production, et une défense suffisante se tait', () => {
  const g = app(relie);
  const cible = g.defTarget(g.S.planets[0]);
  assert.ok(cible > 0, 'une planète qui produit mérite une défense');
  assert.equal(defense(cible * 3).act, undefined, 'la cible dépassée, on arrête');
  const { act } = defense(cible - 50);
  assert.ok(act, 'sous la cible, le plan complète');
  assert.match(act.why, /sur \d+ lanceurs visés/, 'la cible est chiffrée : ' + act.why);
});

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

t('chaque planète chargée a son lot, et la carte du soir les nomme tous', () => {
  const g = nue(s => { s.planets[0].ships = { lc: 40, pr: 4 }; s.planets[1].ships = { lc: 10 }; });
  const fs = g.fleetsavePlan(SOIR);
  assert.ok(fs && fs.rest && fs.rest.length === 1, 'le second lot manque : ' + JSON.stringify(fs && (fs.rest || []).length));
  assert.equal(fs.from.name, 'Caribou', 'le plus gros lot protégeable passe en premier');
  const m = g.dailyMissions().find(x => x.id === 'night');
  assert.ok(m.how.some(h => /Puis depuis Colonie/.test(h)), 'le second lot n\'est pas dit : ' + JSON.stringify(m.how));
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

t('soute suffisante partout : aucune carte de répartition', () => {
  const g = app(s => { relie(s); s.planets[0].ships = { lc: 40 }; s.planets[1].ships = { lc: 10 }; });
  assert.deepEqual(g.cargoGaps(), []);
  assert.ok(!g.dailyMissions().some(x => /^cargo-split/.test(x.id)));
});

/* ---------- une planète, une identité ---------- */

t('un état en rangs se convertit au chargement, et la conversion rejouée ne change rien', () => {
  const g = app(s => {
    s.timers = [{ id: 'm1', manual: true, kind: 'b', k: 'metal', lvl: 15, p: 1, end: SOIR + 36e5 }];
    s.plan = [{ type: 'b', p: 1, k: 'crystal', lvl: 13 }, { type: 't', k: 'astro', lvl: 4 }];
    s.colo.from = 1;
  });
  const colonie = g.S.planets[1];
  assert.equal(g.S.timers[0].pid, colonie.id);
  assert.equal(g.S.plan[0].pid, colonie.id);
  assert.equal(g.S.colo.fromId, colonie.id);
  assert.ok(!('p' in g.S.timers[0]) && !('p' in g.S.plan[0]), 'le rang ne traîne pas à côté de l\'identité');
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
    s.plan = [{ type: 'b', p: 1, k: 'crystal', lvl: 13 }, { type: 't', k: 'astro', lvl: 4 }];
    s.colo.from = 1;
  });
  g.forgetPlanet(g.S.planets[1].id);
  assert.deepEqual(g.S.planets.map(p => p.name), ['Planète mère']);
  // une recherche ne vise pas de planète : elle reste
  assert.deepEqual(g.S.timers.map(t => t.id), ['m2']);
  assert.deepEqual(g.S.plan.map(x => x.type), ['t']);
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

if (failures.length) {
  for (const [name, e] of failures) console.error('ÉCHEC  ' + name + '\n       ' + e.message);
  console.error('\n' + failures.length + ' échec(s), ' + passed + ' réussite(s)');
  process.exit(1);
}
console.log(passed + ' vérifications passées');
