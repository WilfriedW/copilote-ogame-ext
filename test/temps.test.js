/* Le temps du panneau : src/core/temps.js (heures serveur ou locale, durées).
   Lancé par test/run.js. Les tests tournent dans le fuseau de Tahiti
   (UTC−10), posé en tête de run.js ; SOIR y vaut le 8 novembre, 22 h 30. */
module.exports = ({ t, assert, loadApp, fixtureState, SOIR }) => {
  const NOMS = ['S', 'dur', 'clockText', 'formatTime', 'timeTitle', 'timeZoneShown', 'srvOffSec', 'timeMode', 'poseModeHeure'];
  /** Le panneau, avec le décalage du serveur relevé (en secondes) ou non. */
  const temps = (off, win) => {
    const s = fixtureState();
    s.planets.forEach(p => { p.stock.at = SOIR; });
    if (off != null) s.srvTz = { off, ok: true };
    if (win) s.__win = win;
    return loadApp(s, SOIR, NOMS);
  };
  const H = 3600e3;

  t('temps : une durée s\'écrit à l\'unité utile, « jamais » pour l\'infini', () => {
    const g = temps();
    assert.equal(g.dur(42), '42s');
    assert.equal(g.dur(125), '2m 05s');
    assert.equal(g.dur(3 * 3600 + 7 * 60), '3h 07m');
    assert.equal(g.dur(2 * 86400 + 5 * 3600), '2j 5h');
    assert.equal(g.dur(-5), '0s', 'une durée passée vaut zéro');
    assert.equal(g.dur(Infinity), 'jamais');
  });

  t('temps : sans décalage relevé, l\'heure serveur demandée retombe sur la locale', () => {
    const g = temps();
    assert.equal(g.timeMode, 'server', 'le mode par défaut');
    assert.equal(g.srvOffSec(), null);
    assert.equal(g.timeZoneShown(), 'local');
    assert.equal(g.formatTime(SOIR), '22:30');
    assert.match(g.timeTitle(SOIR), /heure serveur pas encore lue/);
  });

  t('temps : avec le décalage du serveur, l\'heure est celle du serveur et l\'infobulle donne la locale', () => {
    const g = temps(3600);   // un serveur européen en hiver, UTC+1 : onze heures devant Tahiti
    assert.equal(g.timeZoneShown(), 'server');
    assert.equal(g.formatTime(SOIR), '09:30');
    assert.equal(g.timeTitle(SOIR), '22:30 heure locale');
  });

  t('temps : le jour se dit par rapport au jour civil du fuseau affiché', () => {
    const g = temps();
    assert.equal(g.clockText(SOIR + 2 * H, 'local'), 'demain 00:30');
    assert.equal(g.clockText(SOIR + 3 * 24 * H, 'local'), 'mer. 22:30');
    assert.equal(g.clockText(SOIR + 10 * 24 * H, 'local'), '18/11 22:30');
    assert.equal(g.clockText(SOIR + 2 * H, 'local', { date: true }), '00:30 le 09/11/2026');
  });

  t('temps : le mode choisi sur ce poste s\'applique dès le premier dessin', () => {
    const g = temps(3600, { __timeMode: 'local' });
    assert.equal(g.timeMode, 'local');
    assert.equal(g.formatTime(SOIR), '22:30');
    assert.equal(g.timeTitle(SOIR), '09:30 heure serveur');
  });
};
