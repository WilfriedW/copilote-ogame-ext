/* L'état du panneau : src/core/etat.js (S, sample, chargement, remplaceEtat)
   et les réparations faites juste après dans app.js. Lancé par test/run.js,
   qui lui passe son `t` et son `app`. */
module.exports = ({ t, app, assert, SOIR }) => {
  t('une sauvegarde d\'avant ces bâtiments les compte à zéro, pas à « undefined »', () => {
    const g = app(s => { for (const p of s.planets) { delete p.b.depot; delete p.b.silo; } });
    assert.equal(g.S.planets[0].b.depot, 0);
    assert.equal(g.S.planets[0].b.silo, 0);
  });

  t('une sauvegarde qui porte encore le mode lune le perd, sans lever', () => {
    // la fixture du harnais porte `lune` comme une sauvegarde d'avant le retrait
    const g = app(s => { s.lune = { on: true, impact: SOIR + 3600e3, tirs: { mere: 4 }, rendu: { coords: '1:1:1', n: 9, dus: 2, faits: 0 } }; });
    assert.equal(g.S.lune, undefined);
    assert.ok(!g.dailyMissions().some(m => m.q === 'Lune' || /^lune-/.test(m.id)), 'plus aucune carte du mode');
  });

  t('un moonCalc abîmé ne fait pas taire toute la synchro', () => {
    const g = app(s => { s.moonCalc = null; });
    assert.doesNotThrow(() => g.syncOut(), 'priorités, centre et réglages continuent de partir');
  });

  /* ---------- remplacer l'état ---------- */
  /* Un module qui importe `S` ne peut pas le réassigner : la réinitialisation
     et l'import d'une sauvegarde passent par remplaceEtat (src/core/etat.js).
     Ce qui compte, c'est que tout le panneau voie le nouvel état ensuite. */

  t('après l\'import d\'une sauvegarde, tout le panneau lit le nouvel état', () => {
    const g = app();
    const s = JSON.parse(JSON.stringify(g.S));
    s.planets[0].name = 'Nouvelle mère';
    assert.ok(g.appliqueSauvegarde(JSON.stringify(s)));
    assert.equal(g.planetById(s.planets[0].id).name, 'Nouvelle mère', 'planetById lit l\'état remplacé');
    assert.equal(g.saved().planets[0].name, 'Nouvelle mère', 'et c\'est lui qui est enregistré');
  });

  t('la réinitialisation repart de l\'empire d\'exemple, confirmée en deux clics', () => {
    const g = app();
    g.click('ioReset');
    assert.equal(g.saved().planets.length, 2, 'le premier clic ne fait qu\'armer le bouton');
    g.click('ioReset');
    const apres = g.saved();
    assert.equal(apres.planets.length, 1, 'l\'exemple n\'a qu\'une planète');
    assert.equal(apres.planets[0].name, 'Planète mère');
    assert.equal(g.planetById('mere'), null, 'planetById ne voit plus l\'ancien empire');
  });
};
