/* Le moteur de règles : src/regles/moteur.js (rules.json, règles de secours,
   constats, marquage, ignorés, réglages) et sa tenue en charge. Lancé par
   test/run.js. Les évaluateurs propres à un domaine (vagues 2 et 3) restent
   avec leur domaine dans run.js. */
module.exports = ({ t, assert, app, appRegles, loadApp, fixtureState, lu, SOIR, REVEIL, chargeWorker }) => {
  /* ---------- les règles du moteur : le fichier ---------- */

  t('rules.json se lit, et chaque règle a ce qu\'il lui faut', () => {
    const g = app();
    assert.equal(g.REGLES_ERR, '');
    assert.ok(g.REGLES.regles.length, 'des règles dans le fichier');
    const ids = new Set();
    for (const r of g.REGLES.regles) {
      assert.ok(!ids.has(r.id), 'id en double : ' + r.id); ids.add(r.id);
      assert.ok(['ressources', 'installations', 'recherche', 'formes_de_vie'].includes(r.domaine), r.id + ' : domaine');
      assert.ok(['critique', 'important', 'conseil'].includes(r.niveau), r.id + ' : niveau');
      assert.ok(['pousser', 'marquer', 'suspendre', 'signaler'].includes(r.effet), r.id + ' : effet');
      assert.ok(['valide', 'a_valider'].includes(r.statut), r.id + ' : statut');
      assert.ok(r.domaine === 'formes_de_vie' ? !r.cat : g.PROFILS.cats[r.cat], r.id + ' : cat');
      assert.equal(typeof g.EVAL[r.condition], 'function', r.id + ' : un évaluateur pour ' + r.condition);
      assert.ok(r.message && r.raison && r.nom, r.id + ' : ses textes');
      if (r.verrou) assert.ok(r.pourquoi_verrou, r.id + ' : un verrou dit pourquoi');
    }
  });

  t('un fichier de règles illisible laisse tourner le plan d\'avant, et l\'en-tête le dit', () => {
    const g = appRegles(null);
    assert.match(g.REGLES_ERR, /illisibles/);
    assert.deepEqual(g.REGLES.regles, []);
    assert.ok(g.simulateDay().sessions.length, 'le plan tourne quand même');
    assert.ok(g.regleActive('RES_STORAGE_FULL'), 'une règle inconnue laisse le moteur faire ce qu\'il faisait');
    // ENH-77 : plus de badge dans l'en-tête, un bandeau sous lui
    assert.match(lu(g.el('reglesErr').textContent), /règles illisibles/);
  });

  const DEUX_REGLES = { version: 1, mineBalance: { byStyle: {}, byPosition: {} }, lifeforms: {},
    regles: [
      { id: 'A', nom: 'A', domaine: 'installations', cat: 'infra', niveau: 'important', condition: 'queueEmpty',
        effet: 'signaler', parametres: { seuil: 10 }, message: 'a', raison: 'a', statut: 'valide', actif_par_defaut: true },
      { id: 'B', nom: 'B', domaine: 'ressources', cat: 'stock', niveau: 'critique', condition: 'queueEmpty',
        effet: 'pousser', parametres: {}, message: 'b', raison: 'b', statut: 'valide', actif_par_defaut: true, verrou: true }] };

  /** Les deux mêmes, sans évaluateur. */
  const CASSEES = Object.assign({}, DEUX_REGLES, { regles: DEUX_REGLES.regles.map(r => Object.assign({}, r, { condition: 'inexistante' })) });

  t('le joueur remplace un seuil et un interrupteur, pas le reste', () => {
    const g = appRegles(DEUX_REGLES, s => { s.settings.regles = { A: { on: false, p: { seuil: 15 } } }; });
    assert.equal(g.regle('A').on, false);
    assert.equal(g.regle('A').parametres.seuil, 15);
    assert.equal(g.regle('A').niveau, 'important');
    assert.equal(g.regle('Z'), null);
  });

  t('une règle à verrou ne se coupe pas', () => {
    const g = appRegles(DEUX_REGLES, s => { s.settings.regles = { B: { on: false } }; });
    assert.equal(g.regle('B').on, true);
    assert.deepEqual(g.S.settings.regles, {}, 'et l\'écart n\'est même pas gardé');
  });

  t('des réglages de règles abîmés sont jetés sans exception', () => {
    const g = appRegles(DEUX_REGLES, s => { s.settings.regles = JSON.parse(
      '{"A":{"on":"non","p":{"seuil":"dix","inconnu":3}},"Z":{"on":false},"__proto__":{"on":false},"B":null}'); });
    assert.equal(g.regle('A').on, true);
    assert.equal(g.regle('A').parametres.seuil, 10);
    assert.deepEqual(g.S.settings.regles, {});
  });

  t('une règle sans évaluateur se tait, et ne le dit qu\'une fois', () => {
    // le premier rendu, au chargement, évalue déjà les règles : on écoute avant
    const avant = console.error; let n = 0; console.error = () => { n++; };
    // les constats du repli (règles absentes du fichier) ne viennent pas des règles cassées
    const SECOURS = ['RES_STORAGE_FULL', 'RES_STORAGE_SOON', 'RES_ENERGY_NEGATIVE'];
    try { const g = appRegles(CASSEES); assert.deepEqual(g.constats().filter(c => !SECOURS.includes(c.regle)), []); g.constats(); g.render(); }
    finally { console.error = avant; }
    assert.equal(n, 2, 'une ligne par règle cassée, pas une par rendu');
  });

  t('reglePose n\'écrit que l\'écart au fichier', () => {
    const g = app();
    const defaut = g.REGLES.regles.find(r => r.id === 'RES_STORAGE_SOON').parametres.heures;
    g.reglePose('RES_STORAGE_SOON', { p: { heures: 20 } });
    assert.deepEqual(g.S.settings.regles, { RES_STORAGE_SOON: { p: { heures: 20 } } });
    g.reglePose('RES_STORAGE_SOON', { p: { heures: defaut } });
    assert.deepEqual(g.S.settings.regles, {}, 'revenu au fichier : plus rien d\'écrit');
  });

  t('un gabarit remplit ce qu\'il connaît et laisse voir le reste', () => {
    assert.equal(app().gabarit('{batiment} {niveau+1} sur {planete} · {trou}',
      { batiment: 'Hangar de cristal', niveau: 7, planete: 'Mère' }),
      'Hangar de cristal 8 sur Mère · {trou}');
  });

  t('un seul vocabulaire de niveau', () => {
    assert.deepEqual(app().SEV_LABEL, { bad: 'Critique', warn: 'Important', info: 'Conseil', good: 'Prêt' });
  });

  /* ---------- les règles du moteur : ressources ---------- */

  /** Le cristal de la mère au-dessus de son hangar (Hangar C 3). */
  const CRISTAL_PLEIN = s => { s.planets[0].stock.c = 1e9; };

  t('cristal au-dessus du hangar : un constat critique, et le plan dépense', () => {
    const g = app(CRISTAL_PLEIN);
    const c = g.constats().find(x => x.regle === 'RES_STORAGE_FULL' && x.valeur === 1);
    assert.equal(c.pid, 'mere'); assert.equal(c.niveau, 'critique');
    assert.match(c.what, /^Cristal au plafond sur Planète mère : [\d\s k,M]+ cristal\/h perdus$/);
    const plan = g.simulateDay();
    assert.ok(plan.sessions[0].acts.some(a => a.kind === 'b' && a.p === 0), 'le plan pousse un chantier sur la mère');
    assert.ok(plan.constats.find(x => x.regle === 'RES_STORAGE_FULL' && x.valeur === 1).servi, 'et la carte est sa réponse');
  });

  t('RES_STORAGE_FULL coupée : ni constat, ni secours du plafond dans le plan', () => {
    const g = app(s => { CRISTAL_PLEIN(s); s.settings.regles = { RES_STORAGE_FULL: { on: false } }; });
    assert.ok(!g.constats().some(x => x.regle === 'RES_STORAGE_FULL'));
    assert.ok(!g.planetAlerts(g.S.planets[0]).some(a => /plein sur/.test(a.what) && !/dans/.test(a.what)));
    assert.ok(!g.simulateDay().sessions[0].acts.some(a => /plafond/.test(a.why || '')), 'le secours du plafond ne sort plus');
  });

  t('le seuil de RES_STORAGE_SOON se règle', () => {
    const sans = app(), avec = app(s => { s.settings.regles = { RES_STORAGE_SOON: { p: { heures: 1000 } } }; });
    const n = g => g.constats().filter(x => x.regle === 'RES_STORAGE_SOON').length;
    assert.ok(n(avec) > n(sans), `${n(avec)} constats à 1000 h, ${n(sans)} à 8 h`);
  });

  t('une catégorie de poids 0 ne rend aucun constat, et le plan ne paie rien pour elle', () => {
    const g = app(s => { CRISTAL_PLEIN(s); s.profil = { style: 'raideur', classe: '', activite: 'regulier', focus: [], set: true }; });
    g.PROFILS.poids.raideur.stock = 0;
    try {
      assert.ok(!g.constats().some(x => x.cat === 'stock'));
      assert.ok(!g.simulateDay().sessions[0].acts.some(a => /plafond/.test(a.why || '')));
    } finally { g.PROFILS.poids.raideur.stock = 1; }
  });

  t('l\'énergie négative est une règle, et son texte ne change pas', () => {
    const g = app(s => { Object.assign(s.planets[1].b, { metal: 12, solar: 1 }); });
    const a = g.planetAlerts(g.S.planets[1]).find(x => x.regle === 'RES_ENERGY_NEGATIVE');
    assert.match(a.what, /^Rétablir l'énergie sur Colonie$/);
    assert.match(a.why, /^Tes mines tournent à \d+ %\. /);
  });

  t('mine plus chère que le hangar : le hangar sort, et la règle ne se décoche pas', () => {
    const g = app(s => { Object.assign(s.planets[0].b, { metal: 30, crystal: 30, deut: 30, solar: 40 });
      s.settings.regles = { RES_MINE_BLOCKED_BY_STORAGE: { on: false } }; });
    assert.equal(g.regle('RES_MINE_BLOCKED_BY_STORAGE').on, true);
    assert.ok(g.constats().some(x => x.regle === 'RES_MINE_BLOCKED_BY_STORAGE' && x.pid === 'mere'));
    const s0 = g.simulateDay().sessions[0];
    assert.ok(s0.acts.concat(s0.waits).some(a => a.p === 0 && /^s(metal|crystal|deut)$/.test(a.k)), 'un hangar est proposé sur la mère');
  });

  /* ---------- les règles du moteur : marquer ---------- */

  t('planète sans chantier : sa carte bâtiment est critique', () => {
    const a = app().simulateDay().sessions[0].acts.find(a => a.kind === 'b' && a.p === 0);
    assert.equal(a.niveau, 'critique'); assert.equal(a.regle, 'INST_QUEUE_EMPTY');
    assert.match(app().actHtml(a, true), /class="pill bad">Critique/);
  });

  t('INST_QUEUE_EMPTY coupée : la carte reste, sans ce niveau-là', () => {
    const g = app(s => { s.settings.regles = { INST_QUEUE_EMPTY: { on: false } }; });
    const a = g.simulateDay().sessions[0].acts.find(a => a.kind === 'b' && a.p === 0);
    assert.ok(a, 'c\'est une carte du plan, elle ne dépend pas de la règle');
    assert.notEqual(a.regle, 'INST_QUEUE_EMPTY');
  });

  t('un chantier en cours : pas de constat de file vide', () => {
    const g = app(s => { s.timers = [{ kind: 'b', pid: 'mere', k: 'metal', lvl: 15, end: SOIR + 3600e3 }]; });
    assert.ok(!g.constats().some(x => x.regle === 'INST_QUEUE_EMPTY' && x.pid === 'mere'));
    assert.ok(g.constats().some(x => x.regle === 'INST_QUEUE_EMPTY' && x.pid === 'colo'));
  });

  t('file vide sans rien de payable : le constat reste à signaler', () => {
    const g = app(s => { s.planets[1].stock = { m: 0, c: 0, d: 0, at: SOIR }; });
    const c = g.simulateDay().constats.find(x => x.regle === 'INST_QUEUE_EMPTY' && x.pid === 'colo');
    assert.equal(c.servi, false);
  });

  t('aucune recherche en cours : la carte recherche est critique, ou le constat reste', () => {
    const plan = app().simulateDay();
    const a = plan.sessions[0].acts.find(a => a.kind === 't');
    if (a) assert.equal(a.niveau, 'critique');
    else assert.ok(plan.constats.some(x => x.regle === 'RECH_LAB_IDLE' && !x.servi));
  });

  t('une recherche en cours : pas de constat de labo à l\'arrêt', () => {
    const g = app(s => { s.timers = [{ kind: 't', pid: 'mere', k: 'energy', lvl: 4, end: SOIR + 3600e3 }]; });
    assert.ok(!g.constats().some(x => x.regle === 'RECH_LAB_IDLE'));
  });

  /* ---------- les règles du moteur : l'icône ---------- */

  t('le panneau publie le compte des critiques', () => {
    const g = app(null, null, null, true);
    g.render();
    assert.equal(g.stored().critiques.n, g.constatsVus().filter(x => x.niveau === 'critique').length);
    assert.ok(g.stored().critiques.n > 0, 'la fixture a deux files vides');
  });

  t('les règles critiques coupées : le compte tombe à zéro', () => {
    const off = { on: false };
    const g = app(s => { s.settings.regles = { INST_QUEUE_EMPTY: off, RECH_LAB_IDLE: off, RES_STORAGE_FULL: off, RES_ENERGY_NEGATIVE: off }; }, null, null, true);
    g.render();
    assert.equal(g.stored().critiques.n, 0);
  });

  t('le badge : les critiques avant les files finies, rien à zéro', () => {
    const w = chargeWorker(), now = Date.now();
    const b = d => w.badgeEtat(d, now, '2.9.0');
    assert.equal(b({ critiques: { n: 0, at: 1 }, pendingAlerts: [] }).text, '');
    assert.equal(b({}).text, '');
    assert.equal(b({ critiques: { n: 2, at: 5 }, pendingAlerts: ['a'], fileAt: 1 }).text, '2');
    assert.equal(b({ critiques: { n: 2, at: 1 }, pendingAlerts: ['a', 'b', 'c'], fileAt: 5 }).text, '3',
      'un compte de critiques d\'avant la fin de file ne l\'écrase pas');
    assert.equal(b({ critiques: { n: 2, at: 1 }, pendingAlerts: [], fileAt: 5 }).text, '2', 'sans file finie, il reste');
    assert.equal(b({ critiques: { n: 0 }, pendingAlerts: ['a'] }).text, '1');
    assert.equal(b({ versionInstable: true, critiques: { n: 4, at: 9 } }).quoi, 'instable', 'la version instable passe devant');
  });

  /* ---------- les règles du moteur : le bloc des conseils ---------- */

  const TETE = g => lu(g.el('tdAlerts').innerHTML).split('<details')[0];

  t('la tête du bloc ne parle que de la planète ouverte, puis Voir tout', () => {
    const g = app(s => { s.planets[1].gid = '102'; s.cur = '102'; s.planets[0].stock.c = 1e9;
      s.planets[0].b.scrystal = 0; s.planets[0].stock.m = 0; s.planets[0].stock.d = 0; });
    g.REFRESH.today();
    const h = lu(g.el('tdAlerts').innerHTML);
    assert.ok(!/sur Planète mère/.test(TETE(g)), 'la tête ne parle que de la Colonie : ' + TETE(g));
    assert.ok((TETE(g).match(/<li/g) || []).length <= 3);
    assert.match(h, /Voir tout \(\d+\)/);
  });

  t('un constat servi par une carte ne se répète pas dans le bloc', () => {
    const g = app(CRISTAL_PLEIN); g.REFRESH.today();
    assert.ok(!/Hangar de cristal plein/.test(lu(g.el('tdAlerts').innerHTML)), 'le plan dépense déjà : sa carte est la réponse');
  });

  t('une ligne sans réponse du plan dit son niveau, son domaine, et peut s\'ignorer', () => {
    const g = app(s => { s.planets[1].stock = { m: 0, c: 0, d: 0, at: SOIR }; }); g.REFRESH.today();
    const h = lu(g.el('tdAlerts').innerHTML);
    assert.match(h, /Critique/); assert.match(h, /Installations/);
    assert.match(h, /data-ign="INST_QUEUE_EMPTY\|colo\|0"/);
  });

  t('le filtre Données manquantes ne garde que FDV_DATA_MISSING', () => {
    const g = app(s => { s.ui.cf = { manque: true }; s.planets[1].stock = { m: 0, c: 0, d: 0, at: SOIR }; });
    g.REFRESH.today();
    // ENH-75 : la carte Conseils est elle-même un volet, « Voir tout » est le second
    assert.match(lu(g.el('tdAlerts').innerHTML).split('<details')[2], /Aucun conseil pour ces filtres/);
  });

  /* ---------- les règles du moteur : ignorer ---------- */

  const COLO_VIDE = s => { s.planets[1].stock = { m: 0, c: 0, d: 0, at: SOIR }; };
  const fileVideColo = g => g.constatsVus().some(x => x.regle === 'INST_QUEUE_EMPTY' && x.pid === 'colo');

  t('Ignorer, remplir la file, la revider : le constat revient', () => {
    const g = app(COLO_VIDE, null, null, true);
    g.ignore(g.constats().find(x => x.regle === 'INST_QUEUE_EMPTY' && x.pid === 'colo'));
    assert.ok(!fileVideColo(g), 'masqué');
    g.S.timers.push({ kind: 'b', pid: 'colo', k: 'metal', lvl: 5, end: SOIR + 60e3 });
    g.render();
    assert.deepEqual(g.S.daily.ign, {}, 'la condition a changé : l\'entrée tombe');
    g.S.timers = []; g.render();
    assert.ok(fileVideColo(g), 'et il revient');
  });

  t('un constat ignoré il y a 25 h revient', () => {
    const g = app(COLO_VIDE, null, null, true);
    const c = g.constats().find(x => x.regle === 'INST_QUEUE_EMPTY' && x.pid === 'colo');
    g.S.daily.ign = { [g.ignKey(c)]: SOIR - 25 * 3600e3 };
    assert.ok(fileVideColo(g));
    g.render();
    assert.deepEqual(g.S.daily.ign, {});
  });

  t('ignorer ne change rien au plan', () => {
    const g = app(CRISTAL_PLEIN, null, null, true);
    const avant = JSON.stringify(g.simulateDay().sessions[0].acts);
    g.ignore(g.constats().find(x => x.regle === 'RES_STORAGE_FULL'));
    assert.equal(JSON.stringify(g.simulateDay().sessions[0].acts), avant);
  });

  t('sur les données d\'exemple, rien n\'est nettoyé', () => {
    const g = app(s => { s.sample = true; s.daily.ign = { 'X|1|0': SOIR }; }, null, null, true);
    g.render();
    assert.deepEqual(g.S.daily.ign, { 'X|1|0': SOIR });
  });

  t('la clé d\'Ignorer porte l\'identifiant du jeu quand il existe', () => {
    const g = app(s => { COLO_VIDE(s); s.planets[1].gid = '102'; });
    assert.equal(g.ignKey(g.constats().find(x => x.regle === 'INST_QUEUE_EMPTY' && x.pid === 'colo')), 'INST_QUEUE_EMPTY|102|0');
  });

  /* ---------- les règles du moteur : Réglages ---------- */

  t('chaque règle a sa ligne, la règle à verrou est grisée et dit pourquoi', () => {
    const g = app(s => { s.__tab = 'settings'; }); g.render();
    const h = lu(g.view.innerHTML);
    for (const r of g.REGLES.regles) assert.ok(h.includes(r.id), r.id);
    assert.match(h, /data-rg-on="RES_MINE_BLOCKED_BY_STORAGE" checked disabled/);
    assert.match(h, /Toujours active : Sans elle/);
    assert.match(h, /data-rg-p="RES_STORAGE_SOON:heures" value="8"/);
  });

  /* ---------- les règles du moteur : tenue ---------- */

  t('constats() sur dix planètes de dix-huit cases chacune : moins de 50 ms', () => {
    const g = app(s => {
      const base = s.planets[0];
      s.profil = { style: 'mineur', classe: '', activite: 'regulier', focus: [], set: true }; s.tech.irn = 3;
      s.planets = Array.from({ length: 10 }, (_, i) => Object.assign(JSON.parse(JSON.stringify(base)),
        { id: 'p' + i, gid: String(200 + i), coords: `1:${100 + i}:8`, stock: { m: 0, c: 0, d: 0, at: SOIR },
          lf: Object.fromEntries(Array.from({ length: 12 }, (_, k) => [11101 + k, { lvl: 5, cost: [1000, 1000, 0], next: 6, secs: 60 }])
            .concat(Array.from({ length: 6 }, (_, k) => [11201 + k, { lvl: 2 }]))) }));
    });
    g.constats();
    // Date est figé par le harnais : la mesure passe par l'horloge du processus
    const t0 = process.hrtime.bigint(); g.constats(); const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    assert.ok(ms < 50, ms.toFixed(1) + ' ms');
  });

};
