/* La défense : src/defense/defense.js vue depuis le plan du jour (modèles,
   paliers, plancher du profil, file du chantier, prix des pièces). Lancé par
   test/run.js. Les tests du tir de lune et des rapports d'espionnage restent
   avec leur domaine dans run.js. */
module.exports = ({ t, assert, app, relie, lu, SOIR }) => {
  /* ---------- défense ---------- */
  /* Ce qui manquait : le plan ne proposait jamais de défense, et une planète
     pleine restait une ferme gratuite. On vérifie les trois états de p.def :
     jamais lu, lu à zéro, lu au-dessus de la cible. */

  /** Planète mère riche, chantier libre de la colonie, avec la défense donnée.
      `def` vaut null (page jamais ouverte), un total (ancien relevé) ou le
      détail par type. */
  function defense(def, mod) {
    const g = app(s => {
      relie(s);
      s.colo.built = true;
      const p = s.planets[0];
      if (typeof def === 'number') p.def = def;
      else if (def) { p.defs = def; p.def = Object.values(def).reduce((a, n) => a + n, 0); }
      p.stock = { m: 5e6, c: 2e6, d: 1e6, at: SOIR };
      p.ships = { lc: 50, sc: 20, pr: 10 };
      if (mod) mod(s);
    });
    const plan = g.simulateDay();
    const acts = plan.sessions.flatMap(x => x.acts);
    return { g, acts, act: acts.find(a => a.kind === 'def') };
  }

  /** Des mines assez hautes pour mériter les deux boucliers. */
  const mineuse = s => {
    const p = s.planets[0];
    p.b.metal = p.b.crystal = p.b.deut = 34;
    p.b.solar = 42;
  };

  /** La technologie qui débloque tout le mélange de début de partie. */
  const chercheur = s => {
    Object.assign(s.tech, { laser: 6, energy: 6, ion: 4, shielding: 6, weapons: 3 });
    s.planets[0].b.shipyard = 6;
  };

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

  /* Le modèle de défense est la seule source des cartes : plus de budget « une
     moitié de nuit » à côté. Le cas vécu : Framework mineur actif, et le plan
     proposait des artilleries à ions que le modèle ne nomme pas. */
  const defActs = acts => acts.filter(a => a.kind === 'def');
  const defKeys = acts => defActs(acts).flatMap(a => Object.keys(a.ships));

  t('Framework mineur : jamais d\'artillerie à ions ni de bouclier, même tout débloqué', () => {
    const { acts } = defense({ rl: 10 }, s => { chercheur(s); mineuse(s); });
    const k = defKeys(acts);
    assert.ok(k.length, 'de la défense est proposée : ' + JSON.stringify(acts.map(a => a.what)));
    for (const x of ['ic', 'sd', 'ld']) assert.ok(!k.includes(x), x + ' hors modèle proposé : ' + k.join(','));
    for (const a of defActs(acts)) assert.ok(!/ce qui absorbe/.test(a.why), 'l\'ancien texte tronqué : ' + a.why);
  });

  t('un autre modèle change ce qui sort : Plasma pur ne propose que LM et PL', () => {
    const { acts } = defense({ rl: 10 }, s => { chercheur(s); mineuse(s); s.tech.plasma = 7; s.planets[0].b.shipyard = 8; s.settings.defModele = 'plasma'; });
    const k = defKeys(acts);
    assert.ok(k.length && k.every(x => x === 'rl' || x === 'pt'), k.join(','));
  });

  t('le modèle d\'une planète passe devant celui des réglages, jusque dans le plan', () => {
    const { acts } = defense({ rl: 10 }, s => { chercheur(s); mineuse(s); s.planets[0].defModele = 'balanced'; });
    const a = defActs(acts);
    assert.ok(a.length && a.every(x => /pour le modèle Balanced Defense/.test(x.why)), a.map(x => x.why).join(' | '));
  });

  t('la quantité d\'une carte est l\'écart au modèle, quand le stock et la durée suivent', () => {
    // Tout au sol sauf 3 lasers légers : la carte en demande exactement 3.
    const plein = { rl: 800, ll: 497, hl: 200, gc: 80 };
    const { acts } = defense(plein, chercheur);
    const ll = defActs(acts).find(a => a.ships.ll);
    assert.ok(ll, 'le manque de lasers légers : ' + defActs(acts).map(a => a.what).join(' | '));
    assert.equal(ll.ships.ll, 3, '500 visés − 497 au sol');
    assert.ok(!defKeys(acts).includes('rl') && !defKeys(acts).includes('hl'), 'le reste est tenu');
  });

  t('la défense en file compte : pas de carte en double', () => {
    const g = app(s => { relie(s); chercheur(s);
      s.planets[0].defs = { rl: 800, ll: 490, hl: 200, gc: 80 }; s.planets[0].def = 1570;
      s.timers = [{ kind: 'x', k: 'shipyard', queue: 'shipyard', pid: 'mere', end: SOIR + 3600e3, manual: true, ships: { ll: 10 } }];
    });
    const d = g.defPlan(g.S.planets[0]);
    const l = d.lignes.find(x => x.k === 'll');
    assert.equal(l.file, 10, 'les 10 lancés sont lus');
    assert.equal(l.manque, 0, '500 − 490 − 10');
    assert.ok(/En file/.test(lu(g.defCarte(g.S.planets[0]))), 'et la colonne le montre');
  });

  t('une défense hors modèle au sol est comptée, jamais redemandée', () => {
    const g = app(s => { relie(s); chercheur(s); s.planets[0].defs = { rl: 5, ic: 10 }; s.planets[0].def = 15; });
    const d = g.defPlan(g.S.planets[0]);
    const ic = d.lignes.find(x => x.k === 'ic');
    assert.ok(ic && ic.hors && ic.manque === 0 && ic.cible === 0, JSON.stringify(ic));
    assert.ok(/Hors modèle[^<]*10 artilleries à ions/.test(lu(g.defCarte(g.S.planets[0]))), 'Outils › Défense le dit');
    assert.ok(/hors modèle/.test(lu(g.defCarte(g.S.planets[0]))));
    const { acts } = defense({ rl: 5, ic: 10 }, chercheur);
    assert.ok(!defKeys(acts).includes('ic'), 'et aucune carte');
  });

  t('un type pas encore débloqué n\'a pas de carte, son prérequis est dit', () => {
    // Pas de Gauss sans Armes 3 : les autres types sortent en attendant.
    const sansGauss = s => { chercheur(s); s.tech.weapons = 0; };
    const { acts } = defense({ rl: 800, ll: 500, hl: 200 }, sansGauss);
    assert.ok(!defKeys(acts).includes('gc'), 'aucun Gauss : ' + defKeys(acts).join(','));
    const g = app(s => { relie(s); sansGauss(s); s.planets[0].defs = { rl: 10 }; s.planets[0].def = 10; });
    assert.ok(/Gauss : nécessite[^<]*Armes 3/.test(lu(g.defCarte(g.S.planets[0]))), lu(g.defCarte(g.S.planets[0])));
    const { acts: a2 } = defense({ rl: 10 }, sansGauss);
    const c = defActs(a2)[0];
    assert.ok(c && /En attente : Gauss : nécessite/.test(c.why), 'la carte le dit aussi : ' + (c && c.why));
  });

  t('le moins complet d\'abord, puis le moins cher à l\'unité', () => {
    const g = app(s => { relie(s); chercheur(s); s.planets[0].defs = { rl: 400, ll: 0, hl: 0, gc: 0 }; s.planets[0].def = 400; });
    const o = g.defPropositions(g.S.planets[0]).ordre.map(l => l.k);
    assert.deepEqual(o, ['ll', 'hl', 'gc', 'rl'], 'trois à 0 % par prix, puis les lanceurs à 50 %');
  });

  t('profil Mineur sous le plancher : les cartes du plancher passent d\'abord', () => {
    const mineur = s => { chercheur(s); mineuse(s); s.profil = { style: 'mineur', classe: '', activite: 'regulier', focus: [], set: true }; };
    const g = app(s => { relie(s); mineur(s); s.planets[0].defs = { rl: 10 }; s.planets[0].def = 10; });
    assert.equal(g.defPlancherDe(), 2, 'le profil Mineur porte un plancher de 2 packs');
    const pr = g.defPropositions(g.S.planets[0]);
    assert.equal(pr.phase, 'plancher');
    assert.equal(pr.gap.lignes.find(l => l.k === 'rl').cible, 80, '40 LM × 2');
    const { acts } = defense({ rl: 10 }, mineur);
    const q = acts.map(a => a.q);
    const iDef = q.findIndex(x => /^Défense/.test(x)), iSh = q.findIndex(x => /^Chantier/.test(x));
    assert.ok(iDef >= 0, 'une carte Défense');
    if (iSh >= 0) assert.ok(iDef < iSh, 'le plancher avant le reste du chantier : ' + q.join(' | '));
    assert.match(defActs(acts)[0].why, /plancher 2, avant le palier 20/, defActs(acts)[0].why);
    // Le plancher tenu, on monte vers le palier.
    const tenu = app(s => { relie(s); mineur(s); s.planets[0].defs = { rl: 80, ll: 50, hl: 20, gc: 8 }; s.planets[0].def = 158; });
    assert.equal(tenu.defPropositions(tenu.S.planets[0]).phase, 'palier');
    // Un autre style n'a pas de plancher, et le réglage le surcharge.
    assert.equal(app(s => { s.profil = { style: 'raideur', set: true }; }).defPlancherDe(), 0);
    assert.equal(app(s => { mineur(s); s.settings.defPlancher = 0; }).defPlancherDe(), 0);
  });

  t('le texte d\'une carte Défense suit le format, entier', () => {
    const { g, acts } = defense({ rl: 10 }, chercheur);
    const a = defActs(acts)[0];
    assert.match(a.why, /^\d[\d  ]* [a-zé ]+ sur [\d  ]+ visés? pour le modèle Framework mineur \(palier 20\)\./, a.why);
    const lead = g.whyLead(a.why);
    assert.ok(!/…$/.test(lead), 'jamais coupée : ' + lead);
  });

  t('changer de modèle ou de palier recalcule les cartes', () => {
    const g = app(s => { relie(s); s.colo.built = true; chercheur(s); mineuse(s);
      const p = s.planets[0]; p.defs = { rl: 10 }; p.def = 10; p.stock = { m: 5e6, c: 2e6, d: 1e6, at: SOIR }; p.ships = { lc: 50, sc: 20, pr: 10 }; });
    const avant = defKeys(g.simulateDay().sessions.flatMap(x => x.acts));
    assert.ok(avant.some(k => k !== 'rl'), 'le Framework demande plus que des lanceurs : ' + avant);
    g.S.settings.defModele = 'plasma';
    const apres = defKeys(g.simulateDay().sessions.flatMap(x => x.acts));
    assert.ok(apres.length && apres.every(k => k === 'rl'), 'plasma pur sans plasma débloqué : des lanceurs seuls : ' + apres);
    g.S.settings.defModele = 'framework'; g.S.settings.defPalier = 10;
    assert.equal(g.defPlan(g.S.planets[0]).lignes.find(l => l.k === 'rl').cible, 400, 'palier 10 : 400 LM');
  });

  t('une carte ne dépasse pas la durée de chantier réglée', () => {
    const { acts } = defense({ rl: 10 }, s => { chercheur(s); s.settings.defDuree = 1; });
    for (const a of defActs(acts)) assert.ok(a.dur <= 3600 + 1, a.what + ' dure ' + a.dur);
  });

  t('la défense sort par paquets, jamais une pièce à la fois', () => {
    const petit = s => { chercheur(s); mineuse(s); s.planets[0].stock = { m: 2000, c: 700, d: 0, at: SOIR }; };
    const { acts } = defense({ rl: 500 }, petit);
    const lots = defActs(acts);
    assert.ok(lots.length, 'la défense manque toujours : ' + JSON.stringify(acts.map(a => a.what)));
    for (const a of lots) assert.ok(Object.values(a.ships)[0] > 1, 'une pièce à la fois : ' + a.what);
  });

  /* ---------- au-delà du palier : la défense ne sert qu'à ne pas perdre de production ---------- */

  /** Framework mineur, palier 20, tout au sol : 800 LM, 500 LL, 200 LLo, 80 Gauss, 20 PL. */
  const AU_PALIER = { rl: 800, ll: 500, hl: 200, gc: 80, pt: 20 };
  /** Tout débloqué, plasma compris. */
  const toutDebloque = s => { chercheur(s); s.tech.plasma = 7; s.planets[0].b.shipyard = 8; };
  /** La mère au palier, son stock posé en fraction du hangar : [métal, cristal, deut]. */
  function auPalier(frac, mod) {
    const g = app(s => {
      relie(s); s.colo.built = true; toutDebloque(s);
      const p = s.planets[0];
      p.defs = Object.assign({}, AU_PALIER); p.def = Object.values(AU_PALIER).reduce((a, n) => a + n, 0);
      p.ships = { lc: 50, sc: 20, pr: 10 };
      // Des hangars qui logent plusieurs packs : 307,5 k de métal par pack.
      p.b.smetal = p.b.scrystal = p.b.sdeut = 10;
      if (mod) mod(s);
    });
    const p = g.S.planets[0], cap = g.production(p).cap;
    p.stock = { m: cap[0] * frac[0], c: cap[1] * frac[1], d: cap[2] * frac[2], at: SOIR };
    return { g, p, cap };
  }
  const sessionsDef = g => g.simulateDay().sessions.map(x => x.acts);

  t('palier tenu, aucun hangar plein : aucune carte Défense', () => {
    const { g } = auPalier([0.3, 0.3, 0.3]);
    assert.ok(g.defPlan(g.S.planets[0]).lignes.every(l => l.manque === 0), 'le palier est tenu');
    assert.equal(g.defSurplus(g.S.planets[0]), null);
    const a = sessionsDef(g)[0].filter(x => x.kind === 'def');
    assert.equal(a.length, 0, 'rien à construire : ' + a.map(x => x.what).join(' | '));
  });

  t('palier tenu, métal au plafond : des packs du modèle, au ratio du modèle', () => {
    const { g, p, cap } = auPalier([0.99, 0.9, 0.9]);
    const s = g.defSurplus(p);
    assert.ok(s && s.pack, JSON.stringify(s));
    assert.equal(s.k, 'pack');
    assert.equal(s.j, 0, 'le métal');
    const n = s.n;
    assert.deepEqual(s.ships, { rl: 40 * n, ll: 25 * n, hl: 10 * n, gc: 4 * n, pt: n }, 'la recette du Framework, jamais d\'ions');
    const packM = 307500;
    assert.equal(n, Math.min(Math.ceil((0.99 - 0.9) * cap[0] / packM), Math.floor(0.9 * cap[1] / 142500), Math.floor(0.9 * cap[2] / 38000)), 'sous 90 % du hangar, ou ce que paient les autres');
    assert.match(s.why, /^Métal au plafond sur [^:]+ : \d+ packs? du modèle pour ne pas perdre la production \(Framework mineur, palier 20 tenu/, s.why);
  });

  t('métal au plafond sans de quoi payer un pack : la pièce qui mange le plus de métal', () => {
    const { g, p } = auPalier([0.99, 0, 0]);
    const s = g.defSurplus(p);
    assert.ok(s && !s.pack, JSON.stringify(s));
    assert.deepEqual(Object.keys(s.ships), ['rl'], 'des lanceurs de missiles : ' + JSON.stringify(s.ships));
    assert.match(s.why, /pas de quoi payer un pack du modèle/);
  });

  t('sous le palier, le surplus ne parle pas : c\'est le manque', () => {
    const { g, p } = auPalier([0.99, 0.9, 0.9], s => { s.planets[0].defs.ll = 380; });
    assert.equal(g.defSurplus(p), null);
    const l = g.defPlan(p).lignes.find(x => x.k === 'll');
    assert.equal(l.cible, 500);
    assert.equal(l.manque, 120);
  });

  t('une ressource qu\'un chantier de la session dépense déjà ne déclenche rien', () => {
    const { g, p } = auPalier([0.99, 0.9, 0.9]);
    assert.equal(g.defSurplus(p, { servies: [true, false, false] }), null);
  });

  t('règles de stockage coupées sur la planète : pas de packs', () => {
    const { g, p } = auPalier([0.99, 0.9, 0.9], s => { s.planets[0].regOff = { RES_STORAGE_FULL: true, RES_STORAGE_SOON: true }; });
    assert.equal(g.defSurplus(p), null);
  });

  t('la carte packs passe après les constructions et recherches, jamais avec une dépense de métal', () => {
    const { g } = auPalier([0.99, 0.9, 0.9]);
    const sessions = sessionsDef(g);
    let vue = false;
    for (const acts of sessions) {
      const pk = acts.findIndex(a => a.kind === 'def' && a.k === 'pack' && a.p === 0);
      if (pk < 0) continue;
      vue = true;
      const a = acts[pk];
      assert.ok(!Object.keys(a.ships).includes('ic'), 'jamais d\'ions');
      for (const [i, x] of acts.entries()) {
        if (x.p !== 0 || !['b', 't', 'lf'].includes(x.kind)) continue;
        assert.ok(i < pk, 'après les constructions et recherches : ' + acts.map(y => y.what).join(' | '));
        assert.ok(!(x.cost && x.cost[0] > 0), 'une dépense de métal sur la planète : pas de packs, ' + x.what);
      }
      assert.match(a.why, /du modèle pour ne pas perdre la production/);
      assert.equal(g.actKey(a), g.cardKey('def', g.S.planets[0].id, 'pack'), 'refusable comme une carte');
    }
    assert.ok(vue || sessions.some(acts => acts.some(a => a.p === 0 && ['b', 't'].includes(a.kind) && a.cost && a.cost[0] > 0)),
      'le métal au plafond part quelque part : ' + sessions.map(a => a.map(x => x.what).join(', ')).join(' || '));
  });

  t('« Non » sur les packs : la carte ne revient pas', () => {
    const { g, p } = auPalier([0.99, 0.9, 0.9]);
    g.S.daily.no[g.cardKey('def', p.id, 'pack')] = 1;
    const s = g.defSurplus(p);
    assert.ok(!s || !s.pack, JSON.stringify(s));
    assert.match(g.noLabel(g.cardKey('def', p.id, 'pack')), /Packs du modèle/);
  });

  t('Framework mineur palier 20 : jamais d\'ions, la carte cite modèle et palier, la cible est celle d\'Outils', () => {
    const { acts: tous } = defense(Object.assign({}, AU_PALIER, { ll: 380 }), toutDebloque);
    const acts = tous.filter(a => a.kind === 'def' && a.p === 0);
    assert.ok(acts.length, 'une carte pour les lasers légers');
    assert.ok(acts.every(a => !a.ships.ic), 'jamais d\'ions');
    const ll = acts.find(a => a.ships.ll);
    assert.match(ll.why, /^380 lasers légers sur 500 visés pour le modèle Framework mineur \(palier 20\)/, ll.why);
  });

  t('Balanced Defense : les ions sortent, avec la cible d\'Outils › Défense', () => {
    const { g, acts } = defense(Object.assign({}, AU_PALIER), s => { toutDebloque(s); s.planets[0].defModele = 'balanced'; });
    const ic = g.defPlan(g.S.planets[0]).lignes.find(l => l.k === 'ic');
    assert.equal(ic.cible, 80, 'le modèle en contient');
    const a = acts.find(x => x.kind === 'def' && x.ships.ic);
    assert.ok(a, 'une carte ions : ' + acts.map(x => x.what).join(' | '));
    assert.match(a.why, /^0 artillerie à ions sur 80 vis\S+ pour le modèle Balanced Defense \(palier 20\)/, a.why);
  });

  t('« Compléter » sans unité d\'ancrage : le plus petit palier sert de cible', () => {
    const g = app(s => { relie(s); chercheur(s); s.settings.defPalier = 'fill'; s.planets[0].defs = { rl: 10 }; s.planets[0].def = 10; });
    const d = g.defPlan(g.S.planets[0]);
    assert.equal(d.palier, g.DEF_PALIERS[0], 'palier ' + d.palier);
    assert.equal(d.lignes.find(l => l.k === 'rl').cible, 400, '40 × 10');
    assert.match(lu(g.defCarte(g.S.planets[0])), /rien à compléter/);
    const avec = app(s => { relie(s); chercheur(s); s.settings.defPalier = 'fill'; s.planets[0].defs = { rl: 10, pt: 3 }; s.planets[0].def = 13; });
    assert.equal(avec.defPlan(avec.S.planets[0]).palier, 3, 'avec des PL au sol, ce sont eux qui fixent la taille');
  });

  t('planète nue : prioritaire, et la cible est celle du palier du modèle', () => {
    const { g, acts } = defense(0, chercheur);
    const a = acts.find(x => x.kind === 'def');
    assert.ok(a, 'une carte');
    assert.match(a.why, /sur 800 visés pour le modèle Framework mineur \(palier 20\)/, a.why);
    assert.match(a.why, /Aucune défense/);
  });

  t('chaque pièce de défense a son prix', () => {
    const g0DEF = app().DEF;
    const { act } = defense({ rl: 800 }, chercheur);
    const [k, n] = Object.entries(act.ships)[0];
    assert.deepEqual(act.cost, [0, 1, 2].map(i => g0DEF[k].c[i] * n), JSON.stringify(act));
  });

  t('un ancien relevé ne compte qu\'un total, et ne se perd pas en route', () => {
    // Avant, le copilote ne lisait que le total : il le comptait en lanceurs.
    const { acts } = defense(800, chercheur);
    const vus = defActs(acts).map(a => a.why).join(' | ');
    assert.ok(!defKeys(acts).includes('rl'), 'les 800 lanceurs restent comptés : ' + vus);
  });
};
