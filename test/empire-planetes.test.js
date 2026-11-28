/* ENH-74 : Empire › Planètes se lit replié — le stock sur chaque ligne, et une
   carte de cible qui dit ce qu'elle posera. Lancé par test/run.js. */
module.exports = ({ t, assert, app, lu, SOIR }) => {
  const POSE = (k, lvl) => s => { s.ui.pose = { k, lvl }; };
  const resume = g => { g.VIEWS.planets(); g.REFRESH.planets(); return g.html()['psum-0'] || ''; };

  t('ENH-74 : la ligne repliée montre le stock, pas la production', () => {
    const g = app(s => { s.planets[0].stock = { m: 123456, c: 65432, d: 4321, at: SOIR }; });
    const s = lu(resume(g)).replace(/<[^>]+>/g, '');
    const stock = lu(g.html()['pstk-0'] || '');
    assert.ok(stock && s.includes(stock), `le stock ${stock} dans ${s}`);
    const pr = g.production(g.S.planets[0]);
    assert.ok(!s.includes(g.fmtLigne(pr.m)), 'la production reste dans le détail : ' + s);
  });

  t('ENH-74 : l\'infobulle date le relevé et dit que le stock est projeté', () => {
    const g = app();
    assert.match(lu(resume(g)), /title="Stock relevé à \d\d:\d\d, projeté à maintenant"/);
  });

  t('ENH-74 : un hangar presque plein se colore, au seuil de la règle', () => {
    const g = app(s => { s.planets[0].stock = { m: 0, c: 0, d: 0, at: SOIR }; });
    const cap = g.production(g.S.planets[0]).cap;
    g.S.planets[0].stock = { m: Math.floor(cap[0] * 0.99), c: Math.floor(cap[1] * 0.93), d: Math.floor(cap[2] * 0.5), at: SOIR };
    const h = resume(g);
    assert.match(h, /<span class="st-bad">[^<]+<\/span> · <span class="st-warn">[^<]+<\/span> · [^<]+<\/span>$/, h);
  });

  t('ENH-74 : les seuils de couleur se lisent dans rules.json', () => {
    const g = app(s => { s.planets[0].stock = { m: 0, c: 0, d: 0, at: SOIR }; });
    const cap = g.production(g.S.planets[0]).cap;
    g.S.planets[0].stock = { m: Math.floor(cap[0] * 0.93), c: 0, d: 0, at: SOIR };
    assert.equal(g.regle('RES_STORAGE_FULL').parametres.avertir, 0.9, 'le seuil vit dans la règle');
    assert.ok(/st-warn/.test(resume(g)), 'à 93 %, au-dessus de 90 %');
    g.S.settings.regles = Object.assign(g.S.settings.regles || {}, { RES_STORAGE_FULL: { p: { avertir: 0.95 } } });
    assert.ok(!/st-warn/.test(resume(g)), 'à 93 %, sous un avertissement réglé à 95 %');
  });

  t('ENH-74 : une planète jamais relevée ne montre pas un stock inventé', () => {
    const g = app(s => { s.planets[1].bNeuve = 1; });
    g.VIEWS.planets(); g.REFRESH.planets();
    const h = lu(g.html()['psum-1'] || '');
    assert.match(h, /title="Stock pas encore relevé"[^>]*>— · — · —</, h);
  });

  t('ENH-74 : la carte s\'appelle « Cible sur plusieurs planètes » et garde son repli', () => {
    const h = lu(app().poseBloc());
    assert.match(h, /<summary data-fold="pose" class="posesum">Cible sur plusieurs planètes/);
    assert.ok(!/Poser sur toutes les planètes/.test(h));
  });

  t('ENH-74 : sans niveau choisi, pas d\'indicateur, jamais « 0 planète »', () => {
    const h = lu(app(s => { s.ui.pose = { k: 'metal' }; }).poseBloc());
    const sum = h.slice(h.indexOf('<summary'), h.indexOf('</summary>'));
    assert.match(sum, /<span class="note"><\/span>$/, sum);
    assert.ok(!/0 planète/.test(sum), sum);
  });

  t('ENH-74 : bâtiment et niveau choisis, l\'indicateur nomme la cible et ses planètes', () => {
    const g = app(POSE('metal', 43));
    const h = lu(g.poseBloc());
    const sum = h.slice(h.indexOf('<summary'), h.indexOf('</summary>'));
    assert.match(sum, /<span class="note">Mine de métal 43 · 2 planètes<\/span>$/, sum);
  });

  t('ENH-74 : un niveau que toutes les planètes ont déjà ne donne pas « 0 planète »', () => {
    const h = lu(app(POSE('metal', 1)).poseBloc());
    const sum = h.slice(h.indexOf('<summary'), h.indexOf('</summary>'));
    assert.ok(!/planète/.test(sum.replace('Cible sur plusieurs planètes', '')), sum);
  });

  t('ENH-74 : des cibles déjà posées par la carte se comptent', () => {
    const g = app(s => { s.ui.pose = { k: 'metal' }; s.prio = [{ kind: 'b', pid: s.planets[0].id, k: 'metal', lvl: 50 }, { kind: 'b', pid: s.planets[1].id, k: 'metal', lvl: 50 }]; });
    const h = lu(g.poseBloc());
    const sum = h.slice(h.indexOf('<summary'), h.indexOf('</summary>'));
    assert.match(sum, /2 cibles posées/, sum);
  });
};
