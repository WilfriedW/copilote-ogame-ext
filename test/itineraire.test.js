/* ENH-83 : les cartes de flotte disent d'où, vers où, quoi et quand.
   Lancé par test/run.js. */
module.exports = ({ t, assert, loadApp, fixtureState, JOUR, lu }) => {
  const W = ['simulateDay', 'S', 'routeHtml', 'actHtml', 'transportHtml', 'solutionsSurplus', 'chargeTexte', 'vaisseauxTexte'];
  const charge = mod => {
    const s = fixtureState();
    s.planets.forEach(p => { p.stock.at = JOUR; });
    if (mod) mod(s);
    return loadApp(s, JOUR, W);
  };
  /* La colonie déborde et a ses transporteurs : un rapatriement vers la mère. */
  const surPlace = s => { s.planets[1].stock = { m: 60000, c: 40000, d: 5000, at: JOUR }; s.planets[1].ships = { lc: 6 }; s.planets[0].ships = { sc: 2 }; };
  const auHub = s => { s.planets[1].stock = { m: 60000, c: 40000, d: 5000, at: JOUR }; s.planets[1].ships = {}; s.planets[0].ships = { lc: 10, sc: 5 }; };
  const rapatrie = g => g.simulateDay().sessions[0].acts.find(a => a.kind === 'transfer');

  t('ENH-83 : l\'itinéraire en pastilles, coordonnées et flèche', () => {
    const g = charge();
    const h = lu(g.routeHtml({ src: g.S.planets[1], dest: '1:142:8', ships: { lc: 12, sc: 3 }, res: [0, 1725693, 64556], dur: 791, end: JOUR + 791e3, retour: JOUR + 1582e3 }));
    assert.match(h, /class="ptag"[^>]*>Colonie<\/span> <span class="mono">1:142:6<\/span><\/span><span class="fleche"[^>]*>→<\/span><span class="bout"><span class="ptag"[^>]*>Planète mère<\/span> <span class="mono">1:142:8<\/span>/);
    assert.match(h, /Cristal 1\s725\s693 · Deutérium 64\s556/);
    assert.ok(!/Métal/.test(h), 'une ressource à zéro ne s\'affiche pas');
    assert.match(h, /12 GT · 3 PT/);
    assert.match(h, /Vol 13m 11s · arrivée \d\d:\d\d · retour \d\d:\d\d/);
  });

  t('ENH-83 : une cible hors empire garde ses coordonnées, sans pastille', () => {
    const g = charge();
    const h = g.routeHtml({ src: g.S.planets[0], dest: '2:10:4' });
    assert.match(h, /→<\/span><span class="bout"><span class="mono">2:10:4<\/span>/);
  });

  t('ENH-83 : le rapatriement a un titre sans cargaison, et son itinéraire', () => {
    const g = charge(surPlace), a = rapatrie(g);
    assert.ok(a, 'un rapatriement');
    assert.equal(a.titre, 'Rapatrier · Transporter');
    assert.match(a.what, /^Rapatrier vers Planète mère : /, 'la clé de la carte et du minuteur ne bouge pas');
    const h = lu(g.actHtml(a, true));
    assert.match(h, /<div class="w">Rapatrier · Transporter<\/div>/);
    assert.match(h, /class="route"/);
    assert.match(h, /Vol .* · arrivée \d\d:\d\d · retour \d\d:\d\d/, 'un Transporter revient');
    assert.ok(!/<span>fin \d/.test(h), 'plus de « fin » sans libellé');
    const exact = a.res.find(x => x > 0);
    assert.ok(h.includes(String(Math.floor(exact))), 'les pastilles à recopier gardent la valeur exacte');
  });

  t('ENH-83 : sans transporteur sur place, Stationner à vide, et la seconde étape annoncée', () => {
    const g = charge(auHub), a = rapatrie(g);
    assert.ok(a, 'une carte');
    assert.equal(a.titre, 'Envoyer à vide · Stationner');
    const h = lu(g.actHtml(a, true));
    assert.match(h, /Planète mère<\/span> <span class="mono">1:142:8<\/span><\/span><span class="fleche"[^>]*>→<\/span><span class="bout"><span class="ptag"[^>]*>Colonie/, 'la première étape : du hub vers la colonie');
    assert.match(h, /Puis, depuis Colonie : Transporter .* vers Planète mère, arrivée vers \d\d:\d\d/);
    assert.ok(!/retour \d/.test(h), 'un Stationner ne revient pas');
  });

  t('ENH-83 : le transfert d\'excédent dessine le même itinéraire', () => {
    const g = charge(s => { s.planets[0].stock.c = 2e6; s.planets[0].ships = { lc: 200, sc: 0, pr: 4 }; Object.assign(s.planets[1].b, { scrystal: 5 }); });
    const plan = { sessions: [{ T: JOUR, acts: [], waits: [{ kind: 'b', what: 'Mine de cristal 4', cost: [0, 1e5, 0], p: 1, miss: [0, 1e5, 0] }], goals: [] }], constats: [] };
    const tr = g.solutionsSurplus(g.S.planets[0], 1, plan).find(x => x.type === 'transfert');
    assert.ok(tr, 'un transfert');
    const h = lu(g.transportHtml(tr));
    assert.match(h, /class="route"/);
    assert.match(h, /Cristal 100\s000/);
    assert.ok(!/fs-tab/.test(h), 'plus de second tableau');
  });
};
