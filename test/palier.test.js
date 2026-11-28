/* ENH-70 : le palier d'une cible d'installation livré en un seul convoi.
   Lancé par test/run.js. */
module.exports = ({ t, assert, loadApp, fixtureState, JOUR, SOIR }) => {
  const W = ['simulateDay', 'S', 'palierDe', 'besoinPalier', 'choisirSources', 'rangeCost', 'B', 'flotteLibre',
    'levelCost', 'production', 'prioHtml', 'VIEWS', 'livraisonMode'];
  /* La colonie à Robots 6 avec la cible Robots 10, la mère riche et pleine de
     grands transporteurs. Des hangars à la mesure du palier des deux côtés :
     sans eux, le plafond de la destination raboterait la livraison et le test
     ne parlerait plus de ce qu'il croit. */
  const base = s => {
    const A = s.planets[1], Bm = s.planets[0];
    Object.assign(A.b, { robot: 6, metal: 10, crystal: 8, deut: 6, solar: 10, smetal: 8, scrystal: 8, sdeut: 8, shipyard: 0 });
    Object.assign(Bm.b, { smetal: 8, scrystal: 8, sdeut: 8 });
    A.stock = { m: 9000, c: 4000, d: 500, at: s.planets[0].stock.at };
    Bm.stock = { m: 600000, c: 250000, d: 400000, at: Bm.stock.at };
    Bm.ships = { lc: 60, sc: 4 };
    s.prio = [{ kind: 'b', pid: 'colo', k: 'robot', lvl: 10 }];
  };
  const charge = (now, ...mods) => {
    const s = fixtureState();
    s.planets.forEach(p => { p.stock.at = now; });
    base(s);
    mods.forEach(m => m(s));
    return loadApp(s, now, W);
  };
  const versColonie = se => se.acts.filter(a => a.kind === 'transfer' && a.dest === '1:142:6');
  const troisieme = (stock, ships) => s => {
    s.planets.push({ id: 'trois', name: 'Troisième', coords: '1:150:8', tmax: 40,
      b: Object.assign({}, s.planets[0].b), sats: 0, ships, shipsAt: 0, stock: Object.assign({ at: s.planets[0].stock.at }, stock) });
  };

  /* ---------- le calcul, sans simulation ---------- */

  t('ENH-70 : le palier Robots 6 → 10 coûte la somme des niveaux 7 à 10', () => {
    const g = charge(JOUR);
    const p = g.palierDe(6, false, 'robot', 10, 'palier');
    assert.deepEqual(p.cost, [384000, 115200, 192000]);
    assert.equal(p.de, 6); assert.equal(p.a, 10);
    assert.deepEqual(g.palierDe(6, false, 'robot', 10, 'niveau').cost, [25600, 7680, 12800], 'mode niveau : Robots 7 seul');
    assert.equal(g.palierDe(6, true, 'robot', 10, 'palier').de, 7, 'un niveau en chantier est déjà payé');
    assert.equal(g.palierDe(10, false, 'robot', 10, 'palier'), null, 'cible atteinte : rien');
  });

  t('ENH-70 : le besoin retire le stock libre, ce qui est en route et la production jusqu\'à l\'arrivée', () => {
    const g = charge(JOUR);
    const r = g.besoinPalier([384000, 115200, 192000], [9000, 4000, 500], [0, 10000, 0], [1000, 500, 200], 2, null);
    assert.deepEqual(r.besoin, [384000 - 9000 - 2000, 115200 - 4000 - 10000 - 1000, 192000 - 500 - 400]);
    assert.deepEqual(r.plafond, []);
    const p = g.besoinPalier([384000, 0, 0], [9000, 0, 0], [0, 0, 0], [0, 0, 0], 0, [75000, 75000, 75000]);
    assert.deepEqual(p.besoin, [66000, 0, 0], 'plafonné à la place du hangar');
    assert.deepEqual(p.plafond, [0]);
  });

  t('ENH-70 : une source qui couvre seule passe devant une paire plus proche', () => {
    const g = charge(JOUR), v = x => x[0] + x[1] + x[2];
    const loin = { q: 'loin', libre: [500, 500, 500], soute: 2000, dist: 90, fuel: 50 };
    const pres1 = { q: 'p1', libre: [300, 300, 300], soute: 2000, dist: 5, fuel: 5 };
    const pres2 = { q: 'p2', libre: [300, 300, 300], soute: 2000, dist: 6, fuel: 5 };
    const r = g.choisirSources([400, 400, 400], [pres1, pres2, loin], v);
    assert.deepEqual(r.map(x => x.q), ['loin']);
    assert.deepEqual(r[0].charge, [400, 400, 400]);
  });

  t('ENH-70 : sans source qui couvre seule, deux au plus, la plus grosse part en premier', () => {
    const g = charge(JOUR), v = x => x[0] + x[1] + x[2];
    const a = { q: 'a', libre: [100, 0, 0], soute: 1e6, dist: 1, fuel: 1 };
    const b = { q: 'b', libre: [300, 0, 0], soute: 1e6, dist: 2, fuel: 1 };
    const c = { q: 'c', libre: [200, 0, 0], soute: 1e6, dist: 3, fuel: 1 };
    const r = g.choisirSources([1000, 0, 0], [a, b, c], v);
    assert.deepEqual(r.map(x => x.q), ['b', 'c']);
    assert.deepEqual(r.map(x => x.charge[0]), [300, 200]);
  });

  t('ENH-70 : la soute rabote la part d\'une source', () => {
    const g = charge(JOUR), v = x => x[0] + x[1] + x[2];
    const r = g.choisirSources([1000, 0, 0], [{ q: 'a', libre: [1000, 0, 0], soute: 400, dist: 1, fuel: 1 }], v);
    assert.deepEqual(r[0].charge, [400, 0, 0]);
  });

  /* ---------- dans le plan du jour ---------- */

  t('ENH-70 : une seule carte Transport livre le palier, et nomme la cible du joueur', () => {
    const g = charge(JOUR);
    const s0 = g.simulateDay().sessions[0], l = versColonie(s0);
    assert.equal(l.length, 1, 'un convoi : ' + l.map(a => a.what).join(' | '));
    const a = l[0];
    assert.match(a.q, /Planète mère/);
    assert.match(a.why, /Usine de robots 6 → 10/);
    assert.ok(!/Robots 7/.test(a.what + a.why), 'jamais le seul pas en cours : ' + a.what + ' / ' + a.why);
    assert.equal(a.mission, 3);
    // le montant : le palier moins le stock et la production de la colonie d'ici l'arrivée
    const pr = g.production(g.S.planets[1]), h = (a.end - JOUR) / 3600e3;
    const attendu = g.besoinPalier([384000, 115200, 192000], [9000, 4000, 500], [0, 0, 0], [pr.m, pr.c, pr.d], h, null).besoin;
    assert.deepEqual(a.res, attendu);
  });

  t('ENH-70 : une planète qui a tout envoie seule, les autres rien vers la destination', () => {
    const g = charge(JOUR, troisieme({ m: 100000, c: 100000, d: 100000 }, { lc: 20 }));
    const l = versColonie(g.simulateDay().sessions[0]);
    assert.equal(l.length, 1, l.map(a => a.q + ' ' + a.what).join(' | '));
    assert.match(l[0].q, /Planète mère/);
  });

  t('ENH-70 : aucune ne couvre seule, deux cartes au plus, la plus grosse d\'abord', () => {
    const g = charge(JOUR, s => { s.planets[0].stock = { m: 250000, c: 80000, d: 120000, at: JOUR }; },
      troisieme({ m: 150000, c: 60000, d: 100000 }, { lc: 40 }));
    const l = versColonie(g.simulateDay().sessions[0]);
    assert.equal(l.length, 2, l.map(a => a.q + ' ' + a.what).join(' | '));
    const tot = a => a.res[0] + a.res[1] + a.res[2];
    assert.ok(tot(l[0]) >= tot(l[1]), 'la première source est celle qui couvre le plus');
  });

  t('ENH-70 : mode niveau, la carte ne livre que le niveau suivant', () => {
    const g = charge(JOUR, s => { s.day.livraison = 'niveau'; });
    const a = versColonie(g.simulateDay().sessions[0])[0];
    assert.ok(a, 'une carte');
    assert.ok(a.res[0] <= 25600 - 9000, 'pas plus que Robots 7 moins le stock : ' + a.res);
    assert.equal(g.livraisonMode({}), 'palier', 'le palier par défaut');
  });

  t('ENH-70 : kit d\'expédition et réserve de GT restent à quai', () => {
    const g = charge(JOUR, s => { s.settings.expoRes = 50; });
    const libre = g.flotteLibre(g.S.planets[0]);
    const a = versColonie(g.simulateDay().sessions[0])[0];
    assert.ok(a, 'une carte, avec ce qui reste');
    assert.ok((a.ships.lc || 0) <= libre.lc, a.ships.lc + ' GT envoyés pour ' + libre.lc + ' libres');
  });

  t('ENH-70 : aucun emplacement de flotte libre, une ligne d\'attente le dit', () => {
    const g = charge(JOUR, s => {
      s.syncAt = JOUR; s.slots = { fleet: [7, 7], at: JOUR };
      s.timers = [{ id: 'r', kind: 'x', k: 'fleet', end: JOUR + 2 * 3600e3, done: false }];
    });
    const s0 = g.simulateDay().sessions[0];
    assert.equal(versColonie(s0).length, 0);
    const w = s0.waits.find(x => /Transport pour Robots 10/.test(x.what + ' ' + (x.why || '')));
    assert.ok(w, 'la ligne d\'attente : ' + s0.waits.map(x => x.what + ' ' + (x.why || '')).join(' | '));
    assert.match(w.why, /aucun emplacement de flotte libre avant \d\d:\d\d/);
  });

  t('ENH-70 : un palier plus grand que les hangars de la destination est plafonné, et la carte le dit', () => {
    const g = charge(JOUR, s => { Object.assign(s.planets[1].b, { smetal: 3, scrystal: 3, sdeut: 3 }); });
    const a = versColonie(g.simulateDay().sessions[0])[0];
    assert.ok(a, 'une carte');
    const cap = g.production(g.S.planets[1]).cap;
    assert.ok(a.res[0] <= cap[0], 'pas plus que le hangar : ' + a.res[0] + ' / ' + cap[0]);
    assert.match(a.why, /capacité/);
  });

  t('ENH-70 : à la dernière connexion avant la nuit, seul le niveau suivant part', () => {
    const g = charge(SOIR);
    const a = versColonie(g.simulateDay().sessions[0])[0];
    assert.ok(a, 'une carte');
    assert.ok(a.res[0] <= 25600, 'Robots 7 seulement : ' + a.res);
    assert.match(a.why, /nuit/);
  });

  t('ENH-70 : un palier en route ne repart pas à la session suivante', () => {
    const g = charge(JOUR);
    const ss = g.simulateDay().sessions;
    assert.equal(versColonie(ss[0]).length, 1);
    assert.equal(ss.slice(1, 4).reduce((n, se) => n + versColonie(se).length, 0), 0, 'pas de second convoi');
  });

  t('ENH-70 : le palier livré reste sur la destination jusqu\'au niveau visé', () => {
    /* Une case de forme de vie à 140 k M sur la colonie : sans retenue, elle
       mange le convoi dès son arrivée et un second transport repart. */
    const g = charge(JOUR, s => { s.planets[1].lf = {11101: { lvl: 24, state: 'ok', next: 25, cost: [139110, 39740, 0], secs: 1834, nom: 'Secteur résidentiel' }}; });
    const ss = g.simulateDay().sessions.slice(0, 4);
    assert.ok(!ss.some(se => se.acts.some(a => a.kind === 'lf' && a.p === 1)), 'la case attend que le palier soit monté');
    assert.equal(ss.reduce((n, se) => n + versColonie(se).length, 0), 1, 'un seul convoi');
  });

  t('ENH-70 : Robots 10 atteint, la cible Nanites 1 reçoit sa carte', () => {
    const g = charge(JOUR, s => {
      s.planets[1].b.robot = 10; s.tech.computer = 10;
      s.prio = [{ kind: 'b', pid: 'colo', k: 'nanite', lvl: 1 }];
    });
    const a = versColonie(g.simulateDay().sessions[0])[0];
    assert.ok(a, 'une carte Transport pour les nanites');
    assert.match(a.why, /Usine de nanites 0 → 1/);
  });

  t('ENH-70 : Ordinateur 9, pas de carte pour les nanites, la ligne d\'attente nomme Ordinateur 10', () => {
    const g = charge(JOUR, s => {
      s.planets[1].b.robot = 10; s.tech.computer = 9;
      s.prio = [{ kind: 'b', pid: 'colo', k: 'nanite', lvl: 1 }];
    });
    const s0 = g.simulateDay().sessions[0];
    assert.ok(!versColonie(s0).some(a => /nanites/i.test(a.why)), 'pas de transport');
    assert.ok(s0.waits.some(w => /Ordinateur 10/.test(w.why || '')), s0.waits.map(w => w.why).join(' | '));
  });

  t('ENH-70 : le bloc « Tes priorités » mentionne le transport', () => {
    const g = charge(JOUR);
    const h = g.prioHtml(g.simulateDay()).replace(/&#39;/g, "'");
    assert.match(h, /Transport depuis Planète mère/);
  });

  t('ENH-70 : le réglage de livraison est dans Profil et plan du jour', () => {
    const g = charge(JOUR);
    const h = g.VIEWS.settings();
    assert.match(h, /data-day="livraison"/);
  });
};
