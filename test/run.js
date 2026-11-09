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
  return loadApp(s, now == null ? SOIR : now, ['fleetsavePlan', 'dailyMissions', 'S', 'shipList', 'flight', 'REFRESH', 'simulateDay', 'planetRef', 'qHtml', 'actGo', 'goUrl'], api, ext);
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

t('la file de forme de vie vide nomme les planètes concernées', () => {
  // un chantier tourne sur la planète mère, rien sur la colonie
  const g = avecFiles([{ queue: 'lfbuilding', p: 0, end: SOIR + 36e5, done: false }]);
  const m = mission(g, 'lfb');
  assert.ok(m, 'la colonie n\'a rien en file : il faut le dire');
  assert.deepEqual(m.tags, ['Colonie'],
    'seule la colonie est en attente : ' + JSON.stringify(m.tags));
});

t('toutes les files occupées : pas de carte', () => {
  const g = avecFiles([
    { queue: 'lfbuilding', p: 0, end: SOIR + 36e5, done: false },
    { queue: 'lfbuilding', p: 1, end: SOIR + 36e5, done: false }
  ]);
  assert.ok(!mission(g, 'lfb'), 'rien à signaler quand les deux files tournent');
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
