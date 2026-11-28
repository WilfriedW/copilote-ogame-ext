/* Les formes de vie : src/formes-de-vie/formes-de-vie.js vu depuis le plan du
   jour (cases à proposer, lecture sur la page, noms des cases, paliers de
   population) et les règles du moteur propres aux formes de vie (vague 3).
   Lancé par test/run.js. */
const { runPage } = require('./page');

module.exports = ({ t, assert, app, appRegles, lu, SOIR, prioLabo, prio2, CASE_OK, vieSur, premierLf }) => {
  /* ---------- les formes de vie dans le plan ---------- */


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

  t('les deux menus nomment la même place : la recherche passe quand même la première', () => {
    /* « Avant tout le reste » laissait croire que les cases devancent la
       recherche. Le joueur qui veut recherche, puis formes de vie, puis mines
       règle les deux menus sur « avant les bâtiments », et c'est ce qu'il a. */
    const g = app(s => {
      disputeStock(s);
      s.planets[0].stock = { m: 200000, c: 80000, d: 20000, at: SOIR };
      s.day.lf = 'first'; s.day.research = 'first';
    }, SOIR);
    const ordre = g.simulateDay().sessions[0].acts.map(a => a.kind).filter(k => ['t', 'lf', 'b'].includes(k));
    assert.deepEqual(ordre.slice(0, 2), ['t', 'lf'], 'la recherche, puis la case : ' + ordre.join(' '));
    assert.ok(ordre.indexOf('b') > ordre.indexOf('lf'), 'et les bâtiments après : ' + ordre.join(' '));
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

  t('une page de b\u00e2timents ouverte et vide fait choisir l\'esp\u00e8ce', () => {
    // Le jeu montre les douze cases dès qu'une espèce habite la planète, niveau
    // 0 compris. Aucune ne sort : la colonie n'en a pas encore, et lui demander
    // de cliquer une case l'envoyait sur un écran de sélection.
    const g = app(s => {
      s.syncAt = SOIR;
      s.lf.found = ['humans', 'rocktal', 'mechas'];
      s.planets.forEach(p => { p.lfSeen = { lfbuilding: SOIR }; });
    }, SOIR, null, true);
    const m = g.dailyMissions().find(x => x.id === 'lfb');
    assert.ok(m && /Choisis la forme de vie/.test(m.what), 'la carte choisit : ' + (m && m.what));
    // 1:142:6 et 1:142:8 : deux emplacements tièdes, donc les mineurs
    assert.ok(/Roctas/.test(m.what), 'et nomme l\'espèce de l\'emplacement : ' + m.what);
    assert.ok(/°C/.test(m.why), 'en disant ce que vaut l\'emplacement : ' + m.why);
  });

  t('un emplacement froid conseille les M\u00e9cas, un chaud les Roctas', () => {
    const g = app(s => { s.lf.found = ['humans', 'rocktal', 'mechas', 'kaelesh']; }, SOIR);
    assert.equal(g.lfPourPos(15), 'mechas', 'le froid vaut par son deutérium');
    assert.equal(g.lfPourPos(1), 'rocktal', 'le chaud par son cristal et son énergie');
    const sans = app(s => { s.lf.found = ['humans']; delete s.prod; }, SOIR);
    assert.equal(sans.lfPourPos(15), 'humans', 'on ne conseille pas une race non trouvée');
    assert.match(g.lfRaisonPos(1), /\+40 % cristal/, 'la raison cite le bonus : ' + g.lfRaisonPos(1));
  });

  t('sans case de b\u00e2timent lue, la page des recherches n\'est pas r\u00e9clam\u00e9e', () => {
    // Une file de recherche n'existe qu'une fois l'espèce posée : la réclamer
    // doublait la carte qui demande déjà de choisir l'espèce.
    const g = app(s => { s.syncAt = SOIR; }, SOIR, null, true);
    assert.ok(!g.dailyMissions().some(x => x.id === 'lfr'),
      'rien à ouvrir côté recherche tant qu\'aucun bâtiment n\'est lu');
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

  t('une case que la population bloque n\'est pas proposée non plus', () => {
    // Relevé sur le jeu : Académie des sciences 1 à 5 000 / 3 200 / 1 500, tout à
    // fait payable, et refusée quand même — elle coûte aussi 20 M de population,
    // que le relevé ne lit pas. Le plan la reproposait chaque matin.
    const g = vieSur({ 11104: { ...CASE_OK, state: 'pop' } });
    assert.ok(!premierLf(g), 'le jeu la refuse : ce n\'est pas une action');
    assert.ok(!g.simulateDay().sessions[0].waits.some(x => /Secteur résidentiel/.test(x.what)),
      'ni une attente : rien ne dit quand la population sera là');
  });

  t('la priorité bloquée par la population renvoie aux paliers', () => {
    const g = vieSur({ 11104: { ...CASE_OK, state: 'pop' } },
      s => { s.prio = [{ kind: 'lf', pid: s.planets[0].id, k: 11104, lvl: 25 }]; });
    const h = g.prioHtml();
    assert.ok(/population de la planète est trop faible/.test(h), h.slice(0, 500));
    assert.ok(/paliers de population/.test(h), 'et dit où aller la chercher');
  });

  t('l\'infobulle du jeu dit lequel des trois refus', () => {
    const g = app();
    // Relevé sur le jeu : le nom sur la première ligne, la raison sur la suivante.
    assert.equal(g.lfState('Académie des sciences\nLa population est trop faible.'), 'pop');
    assert.equal(g.lfState('Secteur résidentiel<br>Pas assez de ressources.'), 'short');
    assert.equal(g.lfState('Métropolis<br/>Il manque un prérequis.'), 'locked');
    assert.equal(g.lfState('Ferme biosphérique'), 'ok', 'un nom seul ne refuse rien');
    assert.equal(g.lfState(null), 'ok');
    // Le piège que la première ligne tendait : un nom n'est pas une raison.
    assert.equal(g.lfState('Tour de population<br>'), 'ok', 'le nom ne doit pas classer la case');
    assert.ok(g.lfBloquee({ state: 'pop' }) && g.lfBloquee({ state: 'locked' }),
      'les deux murs se gardent pareil');
    assert.ok(!g.lfBloquee({ state: 'short' }) && !g.lfBloquee({ state: 'ok' }),
      'le manque de ressources n\'en est pas un : le plan épargne');
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

  /* ---------- le nom des cases de forme de vie ---------- */
  t('le relevé nomme chaque case, pas seulement celle que le joueur a ouverte', () => {
    /* Le panneau de détail ne nomme que la case ouverte : onze sur douze
       restaient « Forme de vie 12103 » sous les yeux du joueur. Le nom est
       pourtant sur chaque tuile, dans sa langue. */
    const p = runPage({ search: '?page=ingame&component=lfbuildings', planetId: '33701',
      tiles: [12101, 12102], niveaux: { 12101: 38, 12102: 34 },
      noms: { 12101: 'Enclave de méditation', 12102: 'Ferme de cristal' } });
    const lf = p.envois()[0].data.lf;
    assert.equal(lf[12101].nom, 'Enclave de méditation');
    assert.equal(lf[12102].nom, 'Ferme de cristal', 'les douze, pas une');
  });

  t('un nom déjà connu survit à une lecture de liste qui ne le porte pas', () => {
    const g = app();
    const fondu = g.lfMerge({ lvl: 3, name: 'Enclave de méditation' }, { lvl: 4, state: 'ok' });
    assert.equal(fondu.nom, 'Enclave de méditation');
    assert.equal(fondu.lvl, 4, 'le niveau, lui, vient bien de la lecture fraîche');
  });

  t('la grille appelle les cases par leur nom quand le relevé le connaît', () => {
    const g = app(s2 => { s2.planets[0].lf = {
      12101: { lvl: 38, state: 'ok', nom: 'Enclave de méditation' },
      12103: { lvl: 4, state: 'ok' } }; });
    const h = g.VIEWS.planets();
    assert.match(h, /Enclave de méditation<span class="lv"/);
    assert.match(h, /Forme de vie 12103<span class="lv"/, 'et se rabat sur le numéro quand il l\'ignore');
  });

  /* ---------- les paliers de population ---------- */
  /** Une planète roctas telle que le relevé la voit : la série, pas les noms. */
  const vie = (lf, autres) => s2 => { s2.planets[0].lf = lf; if (autres) autres(s2); };
  const CASES_1_2 = { 11101: { lvl: 0, state: 'ok' }, 11102: { lvl: 0, state: 'ok' } };

  t('un palier vise le premier niveau, puis le second une fois celui-ci atteint', () => {
    const g = app(vie({ 11101: { lvl: 5, state: 'ok' } }));
    g.prioPalier('lf', 'mere', 11101, 21, 41);
    assert.equal(g.prioLvl('lf', 'mere', 11101), 21, 'tant que 21 n\'est pas atteint');
    g.S.planets[0].lf[11101].lvl = 21;
    assert.equal(g.prioLvl('lf', 'mere', 11101), 41, 'une fois 21 atteint');
    g.S.planets[0].lf[11101].lvl = 41;
    assert.deepEqual(g.priosLf(), [], 'et au bout, elle est accomplie');
  });

  t('le second palier survit au nettoyage', () => {
    /* prioClean recopiait l'entrée rendue — qui porte la cible du moment, pas le
       palier — à la place de l'entrée rangée. */
    const g = app(vie({ 11101: { lvl: 5, state: 'ok' }, 11102: { lvl: 1, state: 'ok' } }));
    g.prioPalier('lf', 'mere', 11101, 21, 41);
    g.prioPose('lf', 'mere', 11102, '4');
    assert.equal(g.S.prio.length, 2);
    /* La seconde s'accomplit en cours de route : le nettoyage réécrit la liste,
       et c'est là que le palier de la première se perdait. */
    g.S.planets[0].lf[11102].lvl = 4;
    g.prioClean();
    assert.equal(g.S.prio.length, 1, 'la case accomplie est partie');
    assert.equal(g.S.prio[0].puis, 41, 'le palier est toujours là');
  });

  t('corriger le champ à la main efface le palier', () => {
    const g = app(vie({ 11101: { lvl: 5, state: 'ok' } }));
    g.prioPalier('lf', 'mere', 11101, 21, 41);
    g.prioPose('lf', 'mere', 11101, '30');
    assert.equal(g.S.prio[0].lvl, 30);
    assert.equal(g.S.prio[0].puis, undefined, 'le joueur reprend la barre');
  });

  t('un premier palier déjà atteint vise directement le second', () => {
    const g = app(vie({ 11101: { lvl: 25, state: 'ok' } }));
    g.prioPalier('lf', 'mere', 11101, 21, 41);
    assert.equal(g.prioLvl('lf', 'mere', 11101), 41);
  });

  t('la préselection pose la nourriture avant la population', () => {
    const g = app(vie(CASES_1_2));
    assert.ok(g.lfPosePaliers(g.S.planets[0]));
    assert.deepEqual(g.S.prio.map(e => [e.k, e.lvl, e.puis]),
      [[11102, g.LF_PALIER.nourriture, undefined], [11101, g.LF_PALIER.population[0], g.LF_PALIER.population[1]]],
      'la nourriture d\'abord : l\'ordre de pose arbitre la précédence');
  });

  t('sans les deux premières cases relevées, aucune préselection n\'est proposée', () => {
    /* On ne devine pas un identifiant : viser la mauvaise case ne se verrait pas. */
    const g = app(vie({ 11103: { lvl: 2, state: 'ok' }, 11104: { lvl: 1, state: 'ok' } }));
    assert.equal(g.lfPopNourriture(g.S.planets[0]), null);
    assert.equal(g.lfPosePaliers(g.S.planets[0]), false);
    assert.deepEqual(g.S.prio, []);
    assert.doesNotMatch(g.VIEWS.planets(), /data-lfpaliers/, 'et pas de bouton');
  });

  t('le bouton des paliers paraît dès que les deux cases sont là', () => {
    const g = app(vie(CASES_1_2));
    assert.match(g.VIEWS.planets(), /data-lfpaliers="mere"/);
  });

  t('le bloc dit le palier qui attend derrière', () => {
    const g = app(vie({ 11101: { lvl: 5, state: 'ok', nom: 'Enclave de méditation' } }));
    g.prioPalier('lf', 'mere', 11101, 21, 41);
    assert.match(g.prioHtml(), /Enclave de méditation 21, puis 41/);
  });

  t('un palier voyage entre les postes sans réveiller le rendu', () => {
    const g = app(vie({ 11101: { lvl: 5, state: 'ok' } }, s2 => { s2.planets[0].gid = '33701'; }));
    g.prioPalier('lf', 'mere', 11101, 21, 41);
    const avant = JSON.stringify(g.S.prio);
    g.syncApply(g.syncOut());
    assert.equal(JSON.stringify(g.S.prio), avant, 'même forme à l\'aller qu\'au retour');
    assert.equal(g.S.prio[0].puis, 41, 'et le palier a fait le voyage');
  });

  t('en mode nuit le bloc reste lisible et ne promet rien', () => {
    const h = app(s => { s.day.night = true; prioLabo(s); }).prioHtml();
    assert.match(h, /Labo 10/);
    assert.match(h, /data-prio-del/);
    assert.doesNotMatch(h, /épargne|lancement|attend|passe en premier/i);
  });

  t('une priorité bloquée par un bâtiment annonce ce bâtiment', () => {
    const h = app(s => { s.prio = [{kind:'b', pid:'colo', k:'nanite', lvl:1}]; }).prioHtml();
    assert.match(h, /Nanites 1/, 'la cible du joueur ne bouge pas');
    assert.match(h, /Robots/, 'et le bloc dit ce qui monte pour elle : ' + h);
  });

  t('une priorité bloquée par une recherche le dit, avec la phrase de prioBloque', () => {
    /* Robots 10 posé, il ne reste que l'Ordinateur : rien que cette planète
       puisse construire, donc elle attend vraiment — et elle le dit. */
    const g = app(s => { s.prio = [{kind:'b', pid:'colo', k:'nanite', lvl:1}]; s.planets[1].b.robot = 10; });
    const phrase = g.prioBloque(g.S.planets[1], 'nanite');
    assert.match(phrase, /Ordinateur 10/, 'la fixture doit réellement bloquer : ' + phrase);
    assert.ok(g.prioHtml().includes(phrase), g.prioHtml());
  });

  t('une recherche se lit « Recherche » : elle n\'a pas de planète à nommer', () => {
    const h = app(s => { s.prio = [{kind:'t', k:'plasma', lvl:3}]; }).prioHtml();
    assert.match(h, /Technologie Plasma 3/);
    assert.match(h, />Recherche</);
    assert.doesNotMatch(h, /Planète mère/);
  });

  t('Aujourd\'hui affiche le bloc sous les cartes', () => {
    const g = app(prioLabo);
    g.REFRESH.today();
    assert.match(g.html().tdNow, /Tes priorités/);
  });

  t('poser : une cible au-dessus du niveau s\'ajoute en fin de liste', () => {
    const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'metal', lvl:20}]; });
    g.prioPose('b', 'mere', 'lab', '10');
    assert.deepEqual(g.S.prio.map(x => x.k), ['metal', 'lab']);
    assert.deepEqual(g.S.prio[1], {kind:'b', pid:'mere', k:'lab', lvl:10});
  });

  t('poser une recherche ne stocke pas de planète', () => {
    const g = app();
    g.prioPose('t', null, 'plasma', '4');
    assert.deepEqual(g.S.prio, [{kind:'t', k:'plasma', lvl:4}]);
  });

  t('corriger un niveau met à jour sur place et garde le rang', () => {
    const g = app(prio2);
    g.prioPose('b', 'mere', 'lab', '12');
    assert.deepEqual(g.S.prio.map(x => x.k + x.lvl), ['lab12', 'metal20']);
  });

  t('vider le champ retire la priorité', () => {
    const g = app(prio2);
    g.prioPose('b', 'mere', 'lab', '');
    assert.deepEqual(g.S.prio.map(x => x.k), ['metal']);
  });

  t('un niveau déjà atteint retire la priorité au lieu de la poser', () => {
    const g = app(prio2);
    g.prioPose('b', 'mere', 'lab', '5');   // le labo de la mère est à 5
    assert.deepEqual(g.S.prio.map(x => x.k), ['metal']);
    g.prioPose('b', 'mere', 'robot', '3'); // robots à 6 : rien à poser
    assert.deepEqual(g.S.prio.map(x => x.k), ['metal']);
  });

  t('un texte qui n\'est pas un nombre ne pose rien', () => {
    const g = app();
    g.prioPose('b', 'mere', 'lab', 'abc');
    assert.deepEqual(g.S.prio, []);
  });

  t('le même bâtiment sur deux planètes fait deux priorités distinctes', () => {
    const g = app();
    g.prioPose('b', 'colo', 'lab', '3');
    g.prioPose('b', 'mere', 'lab', '10');
    assert.deepEqual(g.S.prio.map(x => x.pid + x.lvl), ['colo3', 'mere10']);
    g.prioPose('b', 'mere', 'lab', '');
    assert.deepEqual(g.S.prio.map(x => x.pid + x.lvl), ['colo3']);
  });

  t('après une pose le champ dit la priorité, et se vide quand elle est retirée', () => {
    /* Le gestionnaire n'appelle plus render() : il réécrit lui-même le champ
       avec prioLvl. Cette valeur doit donc être juste après chaque geste. */
    const g = app();
    g.prioPose('b', 'mere', 'lab', '10');
    assert.equal(g.prioLvl('b', 'mere', 'lab'), 10);
    g.prioPose('b', 'mere', 'lab', '5');   // niveau déjà atteint : retirée
    assert.equal(g.prioLvl('b', 'mere', 'lab'), '');
    g.prioPose('t', null, 'plasma', '4');
    assert.equal(g.prioLvl('t', null, 'plasma'), 4);
    assert.equal(g.prioLvl('b', 'mere', 'plasma'), '', 'une recherche ne remplit aucun bâtiment');
  });

  t('le champ de niveau visé ne redessine pas la vue', () => {
    /* render() refermerait le <details> qui porte le champ. */
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
    const i = src.indexOf("querySelectorAll('input[data-prio]')");
    const corps = src.slice(i, src.indexOf('\n  }));', i));
    assert.ok(!/render\(\)/.test(corps.replace(/\/\*[\s\S]*?\*\//g, '')), 'pas de render()');
    assert.match(corps, /el\.value = prioLvl\(/);
  });

  t('retirer par référence enlève la bonne entrée', () => {
    const g = app(prio2);
    g.prioRetire('b|mere|metal');
    assert.deepEqual(g.S.prio.map(x => x.k), ['lab']);
  });

  t('la référence du bouton désigne sa ligne même quand une entrée morte la précède', () => {
    /* Le labo atteint son niveau en cours de session : prios() l'écarte, mais
       S.prio ne se compacte qu'au rendu suivant. Le premier bouton du bloc doit
       retirer la mine, pas l'entrée morte qui la précède dans S.prio. */
    /* Posée après le chargement : le rendu de départ compacte S.prio et
       emporterait l'entrée morte avant que le test ne la voie. */
    const g = app(s => { s.prio = [
      {kind:'b', pid:'mere', k:'metal', lvl:20},
      {kind:'b', pid:'mere', k:'crystal', lvl:20}]; });
    g.S.prio.unshift({kind:'b', pid:'mere', k:'lab', lvl:4});
    g.prioRetire(/data-prio-del="([^"]+)"/.exec(g.prioHtml(g.simulateDay()))[1]);
    assert.deepEqual(g.S.prio.map(x => x.k), ['lab', 'crystal']);
  });

  t('le champ de niveau visé écoute change, jamais input', () => {
    /* Sur un labo 5, taper « 10 » passe par « 1 » : à l'écoute de input, la
       priorité serait jugée atteinte, retirée, puis recréée en fin de liste. */
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
    const m = src.match(/querySelectorAll\('input\[data-prio\]'\)\.forEach\(el=>el\.addEventListener\('(\w+)'/);
    assert.ok(m, 'le champ est branché');
    assert.equal(m[1], 'change');
  });

  /* ---------- les règles du moteur : vague 3, formes de vie ---------- */

  /** Une planète Humains : habitat et nourriture lus, la nourriture chiffrée. */
  const HUMAINS = s => { s.host = 's1-fr.ogame.gameforge.com'; s.planets[0].gid = '101';
    s.planets[0].lf = { 11101: { lvl: 20, nom: 'Secteur résidentiel' },
      11102: { lvl: 18, nom: 'Ferme biosphérique', cost: [1, 1, 0], next: 19, secs: 60 } }; };
  /** Le tableau de production de la mère nomme un bâtiment Rock'tal. */
  const PROD_ROCTA = s => { s.prod = { '101': { at: SOIR, rows: [{ label: 'Centre technologique runique (Niveau 3)' }] } }; };
  const lfActs = g => g.simulateDay().sessions[0].acts.filter(a => a.kind === 'lf' && a.p === 0);

  t('la race se déduit des identifiants de ses cases', () => {
    const g = app(HUMAINS);
    assert.deepEqual(g.raceDe(g.S.planets[0]), { race: 'humans', src: 'ids', conflit: false });
    assert.deepEqual(g.lfManques(g.S.planets[0]), []);
  });

  t('les quatre séries de rules.json donnent les quatre races', () => {
    const g = app(s => { s.planets[0].lf = { 14203: { lvl: 1 } }; s.planets[1].lf = { 13105: { lvl: 2 } }; });
    assert.equal(g.raceDe(g.S.planets[0]).race, 'kaelesh', 'une recherche Kaelesh (142xx)');
    assert.equal(g.raceDe(g.S.planets[1]).race, 'mechas');
  });

  t('la race posée à la main l\'emporte, et déplace habitat et nourriture', () => {
    const g = app(s => { HUMAINS(s); s.planets[0].race = 'rocktal'; });
    assert.deepEqual(g.raceDe(g.S.planets[0]), { race: 'rocktal', src: 'main', conflit: false });
    assert.deepEqual(g.baseDe(g.S.planets[0]), { habitat: 12101, nourriture: 12102 });
  });

  t('identifiants et nom qui se contredisent : pas de race, et rien de forme de vie dans le plan', () => {
    assert.ok(lfActs(app(HUMAINS)).length, 'préalable : sans contradiction, la nourriture part');
    const g = app(s => { HUMAINS(s); PROD_ROCTA(s); });
    const r = g.raceDe(g.S.planets[0]);
    assert.equal(r.conflit, true); assert.equal(r.race, null);
    const c = g.constats().find(x => x.regle === 'FDV_DATA_MISSING' && x.pid === 'mere');
    assert.match(c.why, /Race contradictoire : les identifiants disent Humains, le tableau de production Roctas/);
    assert.deepEqual(lfActs(g), [], 'suspendues : pas de conseil sur la mauvaise espèce');
  });

  t('FDV_DATA_MISSING coupée : plus de suspension', () => {
    const g = app(s => { HUMAINS(s); PROD_ROCTA(s); s.settings.regles = { FDV_DATA_MISSING: { on: false } }; });
    assert.ok(!g.constats().some(x => x.regle === 'FDV_DATA_MISSING'));
    assert.ok(lfActs(g).length);
  });

  t('une case Rock\'tal sans nom : le manque est dit, et Scanner ouvre sa page', () => {
    const g = app(s => { HUMAINS(s); s.planets[0].lf = { 12101: { lvl: 3 } }; });
    const c = g.constats().find(x => x.regle === 'FDV_DATA_MISSING' && x.pid === 'mere');
    assert.match(c.why, /^Noms des bâtiments Roctas inconnus \(1\)/);
    assert.equal(c.vars.url, 'https://s1-fr.ogame.gameforge.com/game/index.php?page=ingame&component=lfbuildings&cp=101');
    g.REFRESH.today();
    assert.match(lu(g.el('tdAlerts').innerHTML), /data-prep="https:[^"]*component=lfbuildings&cp=101">Scanner/);
  });

  t('race Rock\'tal posée sans aucune donnée : noms inconnus, et l\'Encyclopédie est nommée', () => {
    const g = app(s => { s.planets[0].race = 'rocktal'; });
    const c = g.constats().find(x => x.regle === 'FDV_DATA_MISSING' && x.pid === 'mere');
    assert.match(c.why, /^Noms Roctas inconnus/);
    assert.equal(c.vars.url, null);
    assert.match(c.action, /Encyclopédie/);
  });

  t('les noms reviennent par un instantané : le constat tombe, et sert à toutes les planètes', () => {
    const g = app(s => { HUMAINS(s); s.planets[0].lf = { 12101: { lvl: 3 } }; s.planets[1].lf = { 12101: { lvl: 1 } }; });
    assert.ok(g.constats().some(x => x.regle === 'FDV_DATA_MISSING' && x.pid === 'colo'));
    g.S.planets[0].lf[12101].nom = 'Enclave stoïque';
    g.lfNomsRetiens();
    assert.equal(g.lfNom(g.S.planets[1], 12101), 'Enclave stoïque');
    assert.ok(!g.constats().some(x => x.regle === 'FDV_DATA_MISSING'));
  });

  t('un nom lu dans le jeu remplace le nom du fichier', () => {
    const g = app(s => { HUMAINS(s); s.planets[0].lf[11101].nom = 'Quartier résidentiel'; });
    assert.equal(g.lfNom(g.S.planets[0], 11101), 'Quartier résidentiel');
    assert.equal(g.lfNomConnu(g.S.planets[1], 11101), 'Secteur résidentiel', 'le fichier, faute de lecture ici');
  });

  t('le cache des noms ne voyage pas', () => {
    const g = app(HUMAINS); g.lfNomsRetiens();
    assert.ok(Object.keys(g.S.lfNoms).length);
    assert.ok(!JSON.stringify(g.syncOut()).includes('Ferme biosphérique'));
  });

  t('Rescanner oublie les noms lus, garde la race posée à la main', () => {
    const g = app(s => { s.planets[0].race = 'rocktal'; s.planets[0].lf = { 12101: { lvl: 3, nom: 'Enclave stoïque' } }; });
    g.lfNomsRetiens();
    assert.ok(!g.constats().some(x => x.regle === 'FDV_DATA_MISSING'));
    g.rescanner();
    assert.equal(g.S.planets[0].race, 'rocktal');
    assert.match(g.constats().find(x => x.regle === 'FDV_DATA_MISSING').why, /Noms des bâtiments Roctas inconnus/);
  });

  t('Réglages › Formes de vie montre la race de chaque planète, et Rescanner', () => {
    const g = app(HUMAINS);
    const h = lu(g.raceRows());
    assert.match(h, /Planète mère.*Humains · déduite des identifiants/);
    assert.match(h, /data-race="mere"/); assert.match(h, /data-rescan="1"/);
  });

  t('une case que la population bloque : la nourriture passe en tête', () => {
    const g = app(s => { HUMAINS(s);
      s.planets[0].lf[11104] = { lvl: 0, state: 'pop', nom: 'Académie des sciences' };
      s.planets[0].lf[11106] = { lvl: 1, nom: 'Fusion à haute énergie', cost: [1, 0, 0], next: 2, secs: 30, eff: 0 };
      Object.assign(s.planets[0].lf[11101], { cost: [1, 1, 0], next: 21, secs: 60 }); });
    const l = g.lfCandidates(g.S.planets[0], 'lfbuilding');
    assert.deepEqual(l.slice(0, 2).map(c => c.id), [11102, 11101], 'la nourriture, puis l\'habitat, devant la case qui produit');
    assert.ok(g.constats().some(x => x.regle === 'FDV_POP_LIMIT'));
  });

  t('une priorité du joueur reste devant la base poussée par la règle', () => {
    const g = app(s => { HUMAINS(s);
      s.planets[0].lf[11104] = { lvl: 0, state: 'pop', nom: 'Académie des sciences' };
      s.planets[0].lf[11106] = { lvl: 1, nom: 'Fusion à haute énergie', cost: [1, 0, 0], next: 2, secs: 30, eff: 0 };
      s.prio = [{ kind: 'lf', pid: 'mere', k: 11106, lvl: 5 }]; });
    assert.equal(g.lfCandidates(g.S.planets[0], 'lfbuilding')[0].id, 11106);
  });

  t('la base sous son palier alors qu\'un bâtiment avancé attend : la base d\'abord', () => {
    const g = app(s => { HUMAINS(s); s.planets[0].lf[11102].lvl = 10; s.planets[0].lf[11102].next = 11;
      s.planets[0].lf[11106] = { lvl: 1, nom: 'Fusion à haute énergie', cost: [1, 0, 0], next: 2, secs: 30, eff: 0 }; });
    assert.equal(g.lfCandidates(g.S.planets[0], 'lfbuilding')[0].id, 11102);
    assert.match(g.constats().find(x => x.regle === 'FDV_BASE_FIRST').what, /La base d'abord : Ferme biosphérique 10/);
  });

  t('file de forme de vie vide : sa carte est marquée', () => {
    const a = lfActs(app(HUMAINS))[0];
    assert.equal(a.niveau, 'important'); assert.equal(a.regle, 'FDV_QUEUE_EMPTY');
  });

  t('« Ne pas s\'en occuper » fait taire les règles de forme de vie, pas le manque', () => {
    const g = app(s => { HUMAINS(s); s.planets[1].lf = { 12101: { lvl: 1 } }; s.day.lf = 'off'; });
    const cs = g.constats().filter(x => x.domaine === 'formes_de_vie');
    assert.deepEqual([...new Set(cs.map(x => x.regle))], ['FDV_DATA_MISSING']);
  });

  t('les paliers de population se lisent du fichier', () => {
    const g = app();
    assert.equal(g.LF_PALIER.nourriture, g.REGLES.regles.find(r => r.id === 'FDV_BASE_FIRST').parametres.nourriture);
  });

  t('une règle propre à une race ne s\'évalue que sur ses planètes', () => {
    const r = { id: 'H', nom: 'H', domaine: 'installations', cat: 'infra', niveau: 'conseil', condition: 'queueEmpty',
      effet: 'signaler', races: ['humans'], parametres: {}, message: 'h', raison: 'h', statut: 'a_valider', actif_par_defaut: true };
    const g = appRegles({ version: 1, mineBalance: { byStyle: {}, byPosition: {} }, lifeforms: {}, regles: [r] },
      s => { s.planets[0].race = 'rocktal'; s.planets[1].race = 'humans'; });
    assert.deepEqual(g.constats().filter(x => x.regle === 'H').map(x => x.pid), ['colo']);
  });
};
