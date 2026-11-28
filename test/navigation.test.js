/* ENH-75 : cinq onglets principaux, chacun un rôle, et tout se replie.
   Lancé par test/run.js. */
module.exports = ({ t, assert, loadApp, fixtureState, SOIR, lu }) => {
  const W = ['S', 'VIEWS', 'REFRESH', 'render', 'ONGLETS', 'ongletsPrincipaux', 'barreHtml', 'TOOLS', 'CARTES', 'VUES_ONGLETS',
    'allerVers', 'renvoiCible', 'cardTabs', 'ongletAffiche', 'CARTE_DEFAUT', 'carteDetails', 'simulateDay', 'carteHtml', 'ongletValide'];
  const charge = (mod, mode) => {
    const s = fixtureState();
    s.planets.forEach(p => { p.stock.at = SOIR; });
    s.profil = Object.assign(s.profil || {}, { set: true, style: 'mineur', focus: [] });
    if (mod) mod(s);
    if (mode) s.__win = { __cardLayout: mode };
    return loadApp(s, SOIR, W);
  };
  const ordre = h => [...h.matchAll(/data-carte="([^"]+)"/g)].map(m => m[1]);
  const vue = g => lu(g.html().view || '');

  /* ---------- la barre ---------- */
  t('ENH-75 : la barre principale, dans l\'ordre, Outils à droite', () => {
    const g = charge();
    assert.deepEqual(g.ongletsPrincipaux().map(([k]) => k), ['today', 'empire', 'niveaux', 'defense', 'tools']);
    assert.deepEqual(g.ongletsPrincipaux().map(([, l]) => l), ["Aujourd'hui", 'Empire', 'Recherche / Cibles', 'Défense', 'Outils']);
    assert.match(g.barreHtml(), /^<button role="tab" data-tab="today">Aujourd&#39;hui<\/button>.*data-tab="tools">Outils<\/button>$/);
  });

  t('ENH-75 : un onglet ajouté, même écrit après Outils, se range à sa gauche', () => {
    const g = charge();
    const liste = [['tools', 'Outils'], ...g.ONGLETS.filter(([k]) => k !== 'tools'), ['nouveau', 'Nouveau']];
    const k = g.ongletsPrincipaux(liste).map(([x]) => x);
    assert.equal(k[k.length - 1], 'tools');
    assert.equal(k[k.length - 2], 'nouveau');
  });

  t('ENH-75 : la barre est écrite par le code, pas en double dans le HTML', () => {
    const h = require('fs').readFileSync(require('path').join(__dirname, '..', 'sidepanel.html'), 'utf8');
    assert.match(h, /<nav class="tabs" role="tablist" id="tabs"><\/nav>/);
    const g = charge();
    assert.match(g.el('tabs').innerHTML, /data-tab="niveaux"/);
  });

  t('ENH-75 : chaque onglet principal a sa vue', () => {
    const g = charge();
    for (const [k] of g.ongletsPrincipaux()) assert.equal(typeof g.VIEWS[k], 'function', k);
  });

  /* ---------- Aujourd'hui ---------- */
  t('ENH-75 : Aujourd\'hui sans Profil, et Maintenant par défaut', () => {
    const g = charge();
    assert.ok(!g.CARTES.today.some(c => c.cardId === 'profil'));
    assert.equal(g.CARTE_DEFAUT.today(), 'maintenant');
    assert.ok(!/data-carte="profil"/.test(g.VIEWS.today()));
  });

  t('ENH-75 : le Profil vit en tête de Réglages › Mon jeu', () => {
    const g = charge(s => { s.profil.set = false; });
    const h = lu(g.VIEWS.settings()), jeu = h.slice(h.indexOf('data-carte="jeu"'), h.indexOf('data-carte="defense"'));
    assert.ok(/data-profil|Ton style|profil/i.test(jeu.slice(0, 1500)), jeu.slice(0, 400));
  });

  t('ENH-75 : profil pas encore posé, une ligne de Maintenant y renvoie', () => {
    const g = charge(s => { s.profil.set = false; });
    g.VIEWS.today(); g.REFRESH.today();
    assert.match(lu(g.html().tdNow), /data-goto="settings:jeu"/);
    const posé = charge(); posé.VIEWS.today(); posé.REFRESH.today();
    assert.ok(!/data-goto="settings:jeu"/.test(lu(posé.html().tdNow)), 'profil posé : rien');
  });

  t('ENH-75 : Tes priorités sort du volet Maintenant', () => {
    const g = charge(s => { s.prio = [{ kind: 'b', pid: 'mere', k: 'metal', lvl: 20 }]; });
    const h = g.VIEWS.today();
    assert.ok(h.includes('id="tdPrios"'), 'son emplacement');
    const m = h.slice(h.indexOf('data-carte="maintenant"'));
    assert.ok(m.indexOf('</details>') < m.indexOf('id="tdPrios"'), 'après la fermeture du volet Maintenant');
    g.REFRESH.today();
    assert.match(lu(g.html().tdPrios), /Tes priorités/);
    assert.ok(!/Tes priorités/.test(lu(g.html().tdNow)));
  });

  t('ENH-75 : Maintenant se replie même rangé en onglets', () => {
    const g = charge();
    const h = g.VIEWS.today();
    assert.match(h, /<details class="card pliable" open><summary data-fold="maintenant">Maintenant/);
    assert.equal(g.carteDetails({ firstElementChild: { tagName: 'DETAILS', classList: { contains: c => c === 'pliable' } } }), null,
      'l\'onglet ne force pas un volet pliable à rester ouvert');
  });

  /* ---------- Empire, Recherche / Cibles ---------- */
  t('ENH-75 : Empire ne garde que Planètes, sans sous-onglets', () => {
    const g = charge();
    assert.deepEqual(g.CARTES.empire.map(c => c.cardId), ['planetes']);
    assert.ok(!g.VUES_ONGLETS.has('empire'));
    const h = g.VIEWS.empire();
    assert.ok(!/carteTabs/.test(h), 'pas de barre');
    assert.ok(!/Recherches et niveaux visés|Cible sur plusieurs planètes/.test(lu(h)));
  });

  t('ENH-75 : Empire perd ses champs de niveau visé, et renvoie vers l\'onglet', () => {
    const g = charge();
    const h = g.VIEWS.empire();
    assert.ok(!/data-prio=/.test(h), 'plus de champ →');
    assert.match(h, /data-goto="niveaux"[^>]*>Cibles de cette planète/);
    assert.ok(/data-b="metal"/.test(h), 'les niveaux, eux, restent saisissables');
  });

  t('ENH-75 : Recherche / Cibles porte la recherche, la cible multi-planètes et les cibles par planète', () => {
    const g = charge();
    const h = lu(g.VIEWS.niveaux());
    const a = h.indexOf('Recherches et niveaux visés'), b = h.indexOf('Cible sur plusieurs planètes'), c = h.indexOf('Cibles par planète');
    assert.ok(a > -1 && b > a && c > b, `${a} ${b} ${c}`);
    assert.match(h, /data-pid="mere" data-prio="metal"/);
    assert.match(h, /data-pid="colo" data-prio="crystal"/);
    assert.match(h, /data-prio="energy"/, 'la recherche');
    g.REFRESH.niveaux();
  });

  /* ---------- Défense et Outils ---------- */
  t('ENH-75 : Défense est un onglet principal, Outils n\'a plus de Défense', () => {
    const g = charge();
    assert.ok(!g.TOOLS.some(([k]) => k === 'defense'));
    assert.match(lu(g.VIEWS.defense()), /Modèle de défense/);
    assert.deepEqual(g.TOOLS.map(([, l]) => l), ['Pillage', 'Colonie', 'Flotte', 'Lune', 'Minuteurs', 'Serveur']);
  });

  /* ---------- l'existant mémorisé ---------- */
  t('ENH-75 : un ancien renvoi vers Outils › Défense mène à l\'onglet Défense', () => {
    const g = charge();
    g.allerVers('tools:defense');
    assert.match(vue(g), /Modèle de défense/);
    assert.equal(g.renvoiCible('Outils', 'Défense'), 'defense');
    assert.equal(g.renvoiCible('Outils', 'Pillage'), 'tools:explore');
    assert.equal(g.renvoiCible('Outils', 'Cibles'), 'tools:explore', 'l\'ancien nom aussi');
  });

  t('ENH-75 : un état mémorisé qui n\'existe plus rouvre sur un onglet valide', () => {
    const g = charge(s => { s.ui.tool = 'defense'; });
    g.allerVers('tools');
    assert.ok(!/Modèle de défense/.test(vue(g)), 'Outils ne montre plus la défense');
    assert.ok(vue(g).length > 100, 'rien de vide');
    assert.equal(g.ongletValide('recherche'), 'today', 'un onglet principal inconnu');
    assert.equal(g.ongletValide('settings'), 'settings', 'les réglages restent');
    assert.equal(g.ongletValide('niveaux'), 'niveaux');
  });

  /* ---------- tout se replie ---------- */
  t('ENH-75 : chaque carte titrée des cinq onglets est un volet', () => {
    const g = charge();
    const pages = { today: g.VIEWS.today(), empire: g.VIEWS.empire(), niveaux: g.VIEWS.niveaux(), defense: g.VIEWS.defense() };
    for (const [k] of g.TOOLS) { g.S.ui.tool = k; pages['tools:' + k] = g.VIEWS.tools(); }
    for (const [nom, h] of Object.entries(pages)) {
      assert.ok(!/<div class="card"><h2>/.test(h), nom + ' : une carte à titre fixe');
      assert.ok(!/<div class="card"><div class="row spread[^"]*"><h2>/.test(h), nom + ' : un titre en rangée');
    }
  });

  t('ENH-75 : Outils › Flotte, la flotte cible ouverte, la taille d\'expédition fermée', () => {
    const g = charge(s => { s.ui.tool = 'fleet'; });
    const h = lu(g.VIEWS.tools());
    assert.match(h, /<details class="card" open><summary data-fold="fl:cible">Flotte cible/);
    assert.match(h, /<details class="card"><summary data-fold="fl:expo">Taille d'expédition/);
  });

  t('ENH-75 : un volet se souvient de son état', () => {
    const g = charge(s => { s.ui.fold = { 'fl:cible': false, 'fl:expo': true }; s.ui.tool = 'fleet'; });
    const h = lu(g.VIEWS.tools());
    assert.match(h, /<details class="card"><summary data-fold="fl:cible">/);
    assert.match(h, /<details class="card" open><summary data-fold="fl:expo">/);
  });

  t('ENH-75 : un volet replié garde son résumé, en rouge s\'il porte un critique', () => {
    const g = charge();
    assert.equal(g.carteHtml('x', 'Titre', '<p>corps</p>', { ouvert: false, resume: { count: 2, maxLevel: 'crit' } }),
      '<details class="card" open><summary data-fold="x">Titre <span class="cpt crit">(2)</span></summary><p>corps</p></details>',
      'un critique ne reste pas fermé par défaut, et son compteur se voit');
    assert.equal(g.carteHtml('y', 'Titre', '', { ouvert: false, resume: { count: 1, maxLevel: 'info' } }),
      '<details class="card"><summary data-fold="y">Titre <span class="cpt info">(1)</span></summary></details>');
  });
};
