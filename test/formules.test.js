/* Les formules du jeu : src/core/formules.js (tables B et T, coûts,
   hangars, foreuses, bonus de position). Lancé par test/run.js, qui lui
   passe son `t` et son `app` : le harnais charge tout le panneau, et un test
   d'ici peut lire n'importe quel symbole. */
module.exports = ({ t, app, assert }) => {
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

  /* ---------- les prix et les noms des bâtiments ---------- */

  t('tout bâtiment modélisé a sa tuile et son nom court', () => {
    const g = app();
    const { OG_BUILD } = new Function(require('fs').readFileSync(require('path').join(__dirname, '..', 'ids.js'), 'utf8')
      + '; return { OG_BUILD };')();
    const tuiles = Object.values(OG_BUILD);
    /* Trois tables à tenir ensemble : une clé qui manque à l'une passe inaperçue
       jusqu'à ce que le volet Empire affiche « undefined » chez le joueur. */
    for (const k of Object.keys(g.B)) {
      assert.ok(tuiles.includes(k), k + ' n\'a pas de tuile dans OG_BUILD');
      assert.ok(g.B_SHORT[k], k + ' n\'a pas de nom court');
    }
  });

  t('le Terraformeur et le Dock spatial ont le prix du jeu', () => {
    const g = app();
    /* Relevés sur le wiki OGame. Le Dock spatial est le seul à quintupler d'un
       niveau à l'autre : lui donner le doublement des autres le ferait paraître
       douze fois trop bon marché au niveau 4. */
    assert.deepEqual(g.levelCost(g.B.terra, 1), [0, 50000, 100000]);
    assert.deepEqual(g.levelCost(g.B.terra, 10), [0, 25600000, 51200000]);
    assert.deepEqual(g.levelCost(g.B.dock, 1), [200, 0, 50]);
    assert.deepEqual(g.levelCost(g.B.dock, 4), [25000, 0, 6250]);
    // le terraformeur demande des nanites et de l'énergie ; le dock, rien de relevé
    assert.deepEqual(g.B.terra.req, { b: { nanite: 1 }, t: { energy: 12 } });
    assert.equal(g.B.dock.req, undefined);
  });

  t('le Dépôt de ravitaillement et le Silo de missiles ont le prix du jeu', () => {
    const g = app();
    /* Relevé sur le wiki OGame, niveau 1 puis doublement : un prix inventé ferait
       épargner la mauvaise somme sans que rien ne le signale. */
    assert.deepEqual(g.levelCost(g.B.depot, 1), [20000, 40000, 0]);
    assert.deepEqual(g.levelCost(g.B.depot, 8), [2560000, 5120000, 0]);
    assert.deepEqual(g.levelCost(g.B.silo, 1), [20000, 20000, 1000]);
    assert.deepEqual(g.levelCost(g.B.silo, 10), [10240000, 10240000, 512000]);
    // le silo demande un chantier, le dépôt ne demande rien
    assert.deepEqual(g.B.silo.req, { b: { shipyard: 1 } });
    assert.equal(g.B.depot.req, undefined);
  });
};
