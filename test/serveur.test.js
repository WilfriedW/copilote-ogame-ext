/* Ce que le serveur sait mieux que nous : src/core/serveur.js (vitesses,
   carburant, soute, durées publiées par l'API) vu depuis le panneau. Lancé
   par test/run.js. */
module.exports = ({ t, assert, app, lu, SOIR }) => {
  /* ---------- les faits du serveur ---------- */

  /** serverData.xml tel que le fond de tâche le range : Celestia, vitesse 8. */
  const API_SERVEUR = {
    server: { name: 'Celestia', number: 284, version: '13.1.1-r5', galaxies: 5, systems: 499,
      donutGalaxy: true, donutSystem: true, speed: 8, speedFleetPeaceful: 3, debrisFactor: 0.3,
      researchDurationDivisor: 2, globalDeuteriumSaveFactor: 0.6, cargoHyperspaceTechMultiplier: 5,
      defToTF: false, marketplaceEnabled: false, bonusFields: 10 },
    at: { server: SOIR }
  };

  t('la carte Serveur dit les faits du serveur dans ses unités', () => {
    const h = lu(app(s => { s.ui.tool = 'server'; }, SOIR, API_SERVEUR).VIEWS.server());
    assert.ok(/Celestia/.test(h), 'le nom de l\'univers : ' + h.slice(0, 300));
    assert.ok(/×8/.test(h), 'la vitesse éco garde son ×');
    assert.ok(/30 %/.test(h), 'le taux de débris est un pourcent, pas 0,3');
    assert.ok(/Non/.test(h), 'un drapeau à zéro se lit Non, pas 0');
  });

  t('la carte Serveur ne montre que quatre faits par groupe, le reste replié', () => {
    /* Vingt faits d'affilée noyaient les quatre qui changent le plan. L'ordre de
       SRV_ROWS décide : les quatre premiers présents restent dehors. */
    const h = lu(app(s => { s.ui.tool = 'server'; }, SOIR, API_SERVEUR).VIEWS.server());
    const uni = h.slice(h.indexOf('L\'univers'), h.indexOf('Vitesses'));
    const dehors = uni.slice(0, uni.indexOf('<details'));
    assert.equal((dehors.match(/<li>/g) || []).length, 4, 'quatre lignes dehors : ' + dehors);
    assert.ok(/Le reste \(4\)/.test(uni), 'les autres sont comptées dans le repli : ' + uni);
    assert.ok(uni.indexOf('Celestia') > uni.indexOf('<details'), 'et le nom, qui ne sert à rien de calculé, est dedans');
  });

  t('les vitesses du serveur passent devant le réglage saisi', () => {
    // réglage faux exprès : ×1 au lieu des ×8 du serveur, et la recherche y est ÷2
    const faux = s => { s.settings.eco = 1; s.settings.fleet = 1; };
    const sans = app(faux).researchTime('energy', 5);
    const avec = app(faux, SOIR, API_SERVEUR).researchTime('energy', 5);
    assert.ok(Math.abs(avec - sans / 16) < 1,
      `la vitesse éco (×8) et le diviseur de recherche (÷2) s'appliquent : ${sans} / 16 ≠ ${avec}`);
  });

  t('le carburant suit le facteur du serveur', () => {
    const vol = g => g.flight('1:1:8', '1:5:8', { lc: 10 }, 100);
    const sans = vol(app()), avec = vol(app(null, SOIR, API_SERVEUR));
    assert.ok(Math.abs(avec.fuel - (sans.fuel - 1) * 0.6 - 1) <= 1,
      `0,6 de deutérium brûlé : ${sans.fuel} attendu à ${Math.round((sans.fuel - 1) * 0.6) + 1}, lu ${avec.fuel}`);
    assert.ok(avec.secs < sans.secs, 'et la vitesse flotte du serveur raccourcit le vol');
  });

  t('la carte Lune lit le taux de débris du serveur, sans rien demander', () => {
    const h = lu(app(s => { s.ui.tool = 'moon'; s.settings.debris = 50; }, SOIR, API_SERVEUR).VIEWS.moon());
    assert.ok(/<b class="mono">30 %<\/b>/.test(h), 'le taux lu remplace la liste déroulante : ' + h.slice(0, 400));
    assert.ok(!/data-set="debris"/.test(h), 'plus de réglage à saisir quand le serveur l\'a dit');
  });

  t('sans serveur, le réglage de débris sert encore', () => {
    const h = lu(app(s => { s.ui.tool = 'moon'; s.settings.debris = 50; }).VIEWS.moon());
    assert.ok(/data-set="debris"/.test(h), 'la liste déroulante reste tant que rien n\'est lu');
    assert.ok(/<option selected>50</.test(h) || /selected>50/.test(h), 'et elle montre le réglage du joueur');
  });

  t('sans données du serveur, la carte le dit au lieu de casser', () => {
    const g = app(s => { s.ui.tool = 'server'; });
    const h = lu(g.VIEWS.server());
    assert.ok(/serveur/i.test(h));
    g.REFRESH.tools();
  });
};
