/* ENH-77 : un en-tête qui ne garde que le quotidien — Actualiser quand le plan
   en souffre, le mode nuit qui s'allume seul, la météo en icône.
   Lancé par test/run.js. */
module.exports = ({ t, assert, loadApp, fixtureState, SOIR, lu }) => {
  const W = ['S', 'header', 'render', 'VIEWS', 'simulateDay', 'releveARelire', 'FRAIS_MS', 'cartePlanetes', 'carteSur',
    'nuitAuto', 'nuitAutoCle', 'modeNuit', 'finDeNuit', 'renderMeteo', 'meteoHtml', 'meteoElements', 'meteoOuvre', 'meteoFerme',
    'meteoDehors', 'meteoTouche', 'meteoFiltre', 'REGLES_ERR', 'APP_VERSION'];
  const MIN = 60e3;
  /** Deux planètes que le jeu nomme, relevées à SOIR. */
  const charge = (mod, now, rules) => {
    const s = fixtureState();
    s.host = 's1-fr.ogame.gameforge.com';
    s.planets.forEach((p, i) => { p.stock.at = SOIR; p.gid = String(101 + i); });
    if (mod) mod(s);
    return loadApp(s, now == null ? SOIR : now, W, null, null, null, rules);
  };
  const html = () => require('fs').readFileSync(require('path').join(__dirname, '..', 'sidepanel.html'), 'utf8');

  /* ---------- ce qui quitte l'en-tête ---------- */
  t('ENH-77 : l\'en-tête ne porte plus ni version, ni classe, ni synchro, ni interrupteur d\'heure', () => {
    const h = html(), top = h.slice(h.indexOf('<header'), h.indexOf('</header>'));
    for (const id of ['appVer', 'uniBadge', 'tzBtn', 'tzLbl']) assert.ok(!top.includes(`id="${id}"`), id);
    for (const id of ['majBtn', 'meteo', 'nightBtn', 'gearBtn']) assert.ok(top.includes(`id="${id}"`), id + ' reste');
    assert.ok(top.indexOf('id="majBtn"') < top.indexOf('id="meteo"') && top.indexOf('id="meteo"') < top.indexOf('id="nightBtn"')
      && top.indexOf('id="nightBtn"') < top.indexOf('id="gearBtn"'), 'Actualiser · Météo · Nuit · Réglages');
  });

  t('ENH-77 : la version et la synchro se lisent dans Réglages › Données', () => {
    const g = charge(s => { s.syncAt = SOIR - 5 * MIN; });
    const h = lu(g.VIEWS.settings());
    assert.ok(h.includes(`v${g.APP_VERSION}`), 'la version');
    assert.match(h, /Dernière synchro : \d\d:\d\d/);
  });

  t('ENH-77 : l\'heure locale ou serveur se choisit dans Réglages › Affichage', () => {
    const g = charge();
    const h = lu(g.VIEWS.settings());
    assert.match(h, /<select id="sTz"[^>]*>.*<option value="local"[^>]*>Heure locale<\/option>.*<option value="server"[^>]*>Heure du serveur<\/option>/s);
  });

  t('ENH-77 : un rules.json illisible se dit dans un bandeau, hors de l\'en-tête', () => {
    const g = charge(null, null, null);
    g.header();
    const b = g.el('reglesErr');
    assert.match(lu(b.innerHTML || b.textContent), /illisibles/);
    assert.equal(b.hidden, false);
    assert.ok(html().includes('id="reglesErr"'));
    const ok = charge(); ok.header();
    assert.equal(ok.el('reglesErr').hidden, true, 'rien à dire, rien d\'affiché');
  });

  /* ---------- Actualiser ---------- */
  t('ENH-77 : une planète sans carte, relevée il y a 30 min, ne fait pas sortir Actualiser', () => {
    const g = charge(s => { s.planets[1].stock.at = SOIR - 30 * MIN; });
    assert.equal(g.FRAIS_MS, 60 * MIN, '60 min par défaut');
    assert.equal(g.releveARelire().sort, false);
    g.header();
    assert.ok(g.el('majBtn').hidden);
  });

  t('ENH-77 : une planète qui porte une carte, relevée il y a 61 min, le fait sortir', () => {
    const g = charge(s => { s.planets.forEach(p => { p.stock.at = SOIR - 61 * MIN; }); });
    const avec = g.cartePlanetes(g.simulateDay());
    assert.ok(avec.size, 'la fixture a des cartes');
    assert.equal(g.releveARelire().sort, true);
    g.header();
    assert.ok(!g.el('majBtn').hidden);
  });

  t('ENH-77 : sans carte, il faut trois fois la fraîcheur pour que le bouton sorte', () => {
    const vide = { sessions: [{ acts: [], waits: [] }] };
    const vieille = age => charge(s => { s.planets.forEach(p => { p.stock.at = SOIR - age; }); });
    assert.equal(vieille(61 * MIN).releveARelire(vide).sort, false, '61 min sans carte');
    assert.equal(vieille(181 * MIN).releveARelire(vide).sort, true, '181 min, même sans carte');
    const surColo = { sessions: [{ acts: [{ p: 1 }], waits: [] }] };
    const g = charge(s => { s.planets[0].stock.at = SOIR - 90 * MIN; });
    assert.equal(g.releveARelire(surColo).sort, false, 'la planète vieille ne porte pas la carte');
    assert.equal(g.releveARelire({ sessions: [{ acts: [], waits: [{ p: 0 }] }] }).sort, true, 'une attente compte comme une carte');
  });

  t('ENH-77 : la fraîcheur se règle', () => {
    const g = charge(s => { s.settings.releveFrais = 20; s.planets.forEach(p => { p.stock.at = SOIR - 30 * MIN; }); });
    assert.equal(g.releveARelire().sort, true, '30 min, réglé à 20');
  });

  t('ENH-77 : une planète jamais relevée fait sortir le bouton', () => {
    const g = charge(s => { s.planets[1].bNeuve = 1; });
    assert.equal(g.releveARelire().sort, true);
  });

  t('ENH-77 : la synchro passe dans l\'infobulle du bouton', () => {
    const g = charge(s => { s.syncAt = SOIR - 2 * MIN; s.planets.forEach(p => { p.stock.at = SOIR - 200 * MIN; }); });
    g.header();
    assert.match(g.el('majBtn').title, /synchro \d\d:\d\d/);
  });

  t('ENH-77 : une carte se reconnaît à sa planète, quelle que soit sa façon de la dire', () => {
    const g = charge();
    const [mere, colo] = g.S.planets;
    assert.ok(g.carteSur({ pid: 'mere' }, mere) && !g.carteSur({ pid: 'mere' }, colo));
    assert.ok(g.carteSur({ p: 1 }, colo));
    assert.ok(g.carteSur({ tags: ['Colonie'] }, colo));
    assert.ok(!g.carteSur({}, mere), 'une carte d\'empire n\'a pas de planète');
  });

  /* ---------- le mode nuit automatique ---------- */
  const AVANT = new Date(2026, 10, 8, 22, 5).getTime();   // nuit à 23:00, une heure d'avance
  const TOT = new Date(2026, 10, 8, 21, 50).getTime();
  const nuitA = (h, mod) => charge(s => { s.day = Object.assign(s.day || {}, { nightStart: 23, nightEnd: 7 }); if (mod) mod(s); }, h);

  t('ENH-77 : le mode nuit s\'allume seul une heure avant la nuit, et le dit', () => {
    const g = nuitA(AVANT);
    assert.ok(g.nuitAuto(), 'allumé');
    assert.equal(g.S.day.night, true);
    assert.match(g.el('toast').textContent, /Mode nuit activé automatiquement/);
  });

  t('ENH-77 : pas avant l\'heure', () => {
    const g = nuitA(TOT);
    assert.ok(!g.nuitAuto());
    assert.equal(g.S.day.night, false);
  });

  t('ENH-77 : éteint à la main, il ne se rallume pas la même nuit', () => {
    const g = nuitA(AVANT);
    g.nuitAuto();
    g.modeNuit(false);
    assert.ok(!g.nuitAuto(), 'pas deux fois');
    assert.equal(g.S.day.night, false);
  });

  t('ENH-77 : la nuit suivante, il se rallume', () => {
    const g = nuitA(AVANT, s => { s.day.nuitAutoFaite = '2026-11-07'; });
    assert.ok(g.nuitAuto());
  });

  t('ENH-77 : après minuit, c\'est encore la nuit de la veille', () => {
    const g = nuitA(new Date(2026, 10, 9, 1, 0).getTime());
    assert.equal(g.nuitAutoCle(new Date(2026, 10, 9, 1, 0).getTime()), '2026-11-08');
    assert.equal(g.nuitAutoCle(AVANT), '2026-11-08');
    assert.equal(g.nuitAutoCle(TOT), null);
  });

  t('ENH-77 : réglable, et rien quand la nuit est vide', () => {
    assert.ok(!nuitA(AVANT, s => { s.day.nuitAuto = false; }).nuitAuto(), 'désactivé');
    assert.ok(nuitA(TOT, s => { s.day.nuitAvance = 2; }).nuitAuto(), 'deux heures d\'avance');
    assert.ok(!nuitA(AVANT, s => { s.day.nightStart = 7; s.day.nightEnd = 7; }).nuitAuto(), 'coucher = réveil : aucune nuit');
  });

  t('ENH-77 : allumé à la main avant l\'heure, il ne se rallume pas après une extinction', () => {
    const g = nuitA(AVANT, s => { s.day.night = true; s.day.until = SOIR + 9 * 3600e3; });
    assert.ok(!g.nuitAuto(), 'déjà allumé : rien à faire');
    g.modeNuit(false);
    assert.ok(!g.nuitAuto(), 'la nuit est comptée comme faite');
  });

  t('ENH-77 : l\'allumage automatique ne lance aucun relevé (lecture seule)', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'src/vues/entete.js'), 'utf8');
    const corps = src.slice(src.indexOf('export function nuitAuto('), src.indexOf('\n}', src.indexOf('export function nuitAuto(')));
    assert.ok(corps.length > 20 && !/faitLeReleve|location|navigate/.test(corps), corps);
  });

  t('ENH-77 : les réglages du mode nuit automatique sont dans Profil et plan du jour', () => {
    const h = lu(charge().VIEWS.settings());
    assert.match(h, /data-day="nuitAuto"[^>]*checked/);
    assert.match(h, /data-day="nuitAvance"/);
  });

  /* ---------- la météo en icône ---------- */
  t('ENH-77 : la météo est une icône fermée, colorée par la pire planète', () => {
    const g = charge();
    g.renderMeteo();
    const h = g.el('meteo').innerHTML;
    assert.match(h, /data-meteo-tog="1"[^>]*aria-expanded="false"/);
    assert.match(h, /class="mt-grid mt-pop" hidden/);
    assert.match(h, /class="mt-band"[^>]*>\s*<span class="mt-(good|warn|bad)">/);
  });

  t('ENH-77 : un clic ouvre le panneau, un second le ferme, rien ne s\'écrit', () => {
    const g = charge();
    g.renderMeteo();
    const tog = { closest: sel => sel === '[data-meteo-tog]' ? {} : null };
    g.click('meteo', tog);
    assert.ok(!/mt-pop" hidden/.test(g.el('meteo').innerHTML), 'ouvert');
    assert.match(g.el('meteo').innerHTML, /aria-expanded="true"/);
    g.click('meteo', tog);
    assert.ok(/mt-pop" hidden/.test(g.el('meteo').innerHTML), 'refermé');
    assert.ok(!/meteo/.test(JSON.stringify(g.saved().ui || {})), 'un panneau volant ne se retient pas');
  });

  t('ENH-77 : Échap et un clic en dehors le ferment', () => {
    const g = charge();
    g.meteoOuvre();
    g.meteoTouche({ key: 'Escape' });
    assert.ok(/mt-pop" hidden/.test(g.el('meteo').innerHTML), 'Échap');
    g.meteoOuvre();
    g.meteoDehors({ closest: () => null });
    assert.ok(/mt-pop" hidden/.test(g.el('meteo').innerHTML), 'clic en dehors');
    g.meteoOuvre();
    g.meteoDehors({ closest: sel => sel === '#meteo' ? {} : null });
    assert.ok(!/mt-pop" hidden/.test(g.el('meteo').innerHTML), 'un clic dedans le laisse ouvert');
  });

  t('ENH-77 : choisir une planète dans le panneau filtre et le referme', () => {
    const g = charge();
    g.meteoOuvre();
    g.click('meteo', { closest: sel => sel === '[data-meteo-p]' ? { dataset: { meteoP: 'colo' } } : null });
    assert.equal(g.meteoFiltre().id, 'colo');
    assert.equal(g.el('meteoFiltre').hidden, false, 'la puce');
    assert.ok(/mt-pop" hidden/.test(g.el('meteo').innerHTML), 'refermé sur les cartes filtrées');
  });
};
