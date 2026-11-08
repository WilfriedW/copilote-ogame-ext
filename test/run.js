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
function app(modifier, now) {
  const s = fixtureState();
  // le stock avance tout seul depuis sa date : on le cale sur l'instant du test
  s.planets.forEach(p => { p.stock.at = now == null ? SOIR : now; });
  if (modifier) modifier(s);
  return loadApp(s, now == null ? SOIR : now, ['fleetsavePlan', 'dailyMissions', 'S', 'shipList', 'flight', 'REFRESH', 'simulateDay', 'planetRef']);
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

t('l\'onglet Aujourd\'hui se rend toujours sans erreur', () => {
  const g = app(s => { s.planets[0].ships = { lc: 30 }; });
  assert.doesNotThrow(() => g.REFRESH.today());
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

/* ---------- résultat ---------- */

if (failures.length) {
  for (const [name, e] of failures) console.error('ÉCHEC  ' + name + '\n       ' + e.message);
  console.error('\n' + failures.length + ' échec(s), ' + passed + ' réussite(s)');
  process.exit(1);
}
console.log(passed + ' vérifications passées');
