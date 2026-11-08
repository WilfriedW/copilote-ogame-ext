/* node test/run.js — vérifie la logique pure de queue.js.
   Pas de framework : queue.js reste un script classique chargé par le
   navigateur, et on l'évalue ici comme le navigateur le ferait. */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const { loadApp, fixtureState } = require('./harness');
const REF = require('./fixtures/projection-avant.json');
const NOW = Date.UTC(2026, 10, 8, 14, 0, 0);

const SRC = fs.readFileSync(path.join(__dirname, '..', 'queue.js'), 'utf8');
const EXPORTS = ['rankActions', 'collect', 'fleetsaveAction', 'recycleAction', 'freshnessAction', 'shouldExpand'];

/** Évalue queue.js et renvoie ses fonctions, avec les globales injectées. */
function load(globals) {
  const names = Object.keys(globals || {});
  return new Function(...names, SRC + '\nreturn {' + EXPORTS.join(', ') + '};')(
    ...names.map(n => globals[n]));
}

const Q = load();

let passed = 0;
const failures = [];
function t(name, fn) {
  try { fn(); passed++; } catch (e) { failures.push([name, e]); }
}

/* ---------- le classement ---------- */

const a = (over) => Object.assign({
  id: 'x', family: 'mine', label: 'l', why: 'w', how: null, cost: null,
  loss: false, blocked: null, payback: null, confirm: 'game',
  snoozeHours: null, running: null, detail: null, launch: null
}, over);

t('une perte faisable passe devant une action faisable ordinaire', () => {
  assert.equal(Q.rankActions([a({id: 'ord'}), a({id: 'perte', loss: true})], 0).now.id, 'perte');
});

t('une action bloquée ne prend jamais Maintenant, même si c\'est une perte', () => {
  const r = Q.rankActions([a({id: 'libre'}), a({id: 'perdu', loss: true, blocked: {kind: 'eta', secs: 600}})], 0);
  assert.equal(r.now.id, 'libre');
  assert.equal(r.banner.id, 'perdu');
});

t('à égalité de rang, le meilleur amortissement gagne', () => {
  assert.equal(Q.rankActions([a({id: 'lent', payback: 40}), a({id: 'vite', payback: 9})], 0).now.id, 'vite');
});

t('payback absent ne passe pas devant un payback connu', () => {
  assert.equal(Q.rankActions([a({id: 'sans'}), a({id: 'avec', payback: 50})], 0).now.id, 'avec');
});

t('à égalité de rang, l\'échéance la plus proche d\'abord', () => {
  assert.equal(Q.rankActions([
    a({id: 'tard', blocked: {kind: 'eta', secs: 7200}}),
    a({id: 'tot', blocked: {kind: 'eta', secs: 600}})
  ], 0).next[0].id, 'tot');
});

t('un hangar trop petit passe après une attente chiffrée', () => {
  assert.equal(Q.rankActions([
    a({id: 'hangar', blocked: {kind: 'storage'}}),
    a({id: 'attente', blocked: {kind: 'eta', secs: 7200}})
  ], 0).next[0].id, 'attente');
});

t('une action en cours sort de la file et va dans busy', () => {
  const r = Q.rankActions([a({id: 'run', running: {endsAt: 1, label: 'x'}}), a({id: 'libre'})], 0);
  assert.equal(r.busy.length, 1);
  assert.equal(r.next.length, 0);
});

t('file vide : rien ne plante', () => {
  const r = Q.rankActions([], 0);
  assert.equal(r.now, null);
  assert.equal(r.banner, null);
});

/* ---------- les sources existantes deviennent des actions ---------- */

const vide = { now: 0, first: { acts: [], waits: [], goals: [] }, busy: [] };
const avecActe = {
  now: 0, busy: [], first: {
    acts: [{ q: 'Bâtiment · Mère', what: 'Mine de cristal 13', why: 'r',
      cost: [18400, 9200, 0], kind: 'b', k: 'crystal', lvl: 13, p: 0 }],
    waits: [], goals: []
  }
};

t('une action de la projection devient une action faisable', () => {
  const [act] = Q.collect(avecActe, [], 0);
  assert.equal(act.blocked, null);
  assert.deepEqual(act.cost, [18400, 9200, 0]);
  assert.equal(act.launch.k, 'crystal');
  assert.equal(act.confirm, 'game');
  assert.equal(act.family, 'mine');
});

t('une attente devient une action bloquée, pas une action absente', () => {
  const b = Q.collect({ now: 0, busy: [], first: { acts: [], goals: [],
    waits: [{ q: 'Recherche', what: 'Astrophysique 4', eta: 4200, miss: [0, 12000, 0] }] } }, [], 0)[0];
  assert.equal(b.blocked.kind, 'eta');
  assert.equal(b.blocked.secs, 4200);
  assert.equal(b.family, 'recherche');
});

t('un hangar trop petit devient storage, sans Infinity sur l\'action', () => {
  const petit = Q.collect({ now: 0, busy: [], first: { acts: [], goals: [],
    waits: [{ q: 'Bâtiment · Mère', what: 'x', eta: Infinity, miss: [1, 0, 0] }] } }, [], 0)[0];
  assert.equal(petit.blocked.kind, 'storage');
  // un hangar trop petit est une perte bloquée : il part au bandeau, pas dans Ensuite
  const r = Q.rankActions([petit], 0);
  assert.equal(r.banner.id, petit.id);
  assert.ok(Number.isFinite(r.banner.blocked.secs ?? 0));
});

t('une mission garde ses étapes et sa mise en sommeil', () => {
  const m = Q.collect(vide, [{ id: 'raid', q: 'Pillage', every: 12, sev: 'good',
    what: 'Espionner', why: 'w', how: ['a', 'b'] }], 0)[0];
  assert.deepEqual(m.how, ['a', 'b']);
  assert.equal(m.confirm, 'snooze');
  assert.equal(m.snoozeHours, 12);
  assert.equal(m.family, 'raid');
});

t('une file en cours devient une action running', () => {
  const r = Q.collect({ now: 0, first: { acts: [], waits: [], goals: [] },
    busy: [{ q: 'Bâtiment · Mère', what: 'Usine de robots 9', end: 5000 }] }, [], 0)[0];
  assert.equal(r.running.endsAt, 5000);
});

t('une perte exceptionnelle est marquée, un bâtiment ordinaire ne l\'est pas', () => {
  const bati = Q.collect(avecActe, [], 0)[0];
  assert.equal(bati.loss, false);
  const expo = Q.collect({ now: 0, busy: [], first: { goals: [], waits: [],
    acts: [{ q: 'Flotte · Mère', what: 'Expédition : 2 sc', why: '', kind: 'expo', p: 0 }] } }, [], 0)[0];
  assert.equal(expo.loss, true);
  const urgent = Q.collect(vide, [{ id: 'x', q: 'Sécurité', every: 1, sev: 'bad',
    what: 'w', why: 'y', how: [] }], 0)[0];
  assert.equal(urgent.loss, true);
});

t('une planète unique : aucune source ne plante', () => {
  assert.doesNotThrow(() => Q.collect(vide, [], 0));
  assert.deepEqual(Q.collect(vide, [], 0), []);
});

t('les identifiants sont stables d\'un appel à l\'autre', () => {
  assert.equal(Q.collect(avecActe, [], 0)[0].id, Q.collect(avecActe, [], 5000)[0].id);
});

/* ---------- mise à l'abri et recyclage ---------- */

const T0 = Date.UTC(2026, 10, 8, 22, 30, 0);
const stats = {
  cargoEff: k => ({ lc: 25000, sc: 5000 })[k] || 0,
  // 1 h à 100 %, proportionnellement plus long en dessous
  flightSecs: (from, to, ships, pct) => 3600 * (100 / pct)
};
const nuitProche = { start: 23, end: 7, isNight: () => false,
  startMs: T0 + 0.5 * 3600e3, endMs: T0 + 8.5 * 3600e3 };
const nuitEnCours = { start: 23, end: 7, isNight: () => true,
  startMs: T0 - 2 * 3600e3, endMs: T0 + 3 * 3600e3 };
const flotteOk = [
  { name: 'Mère', coords: '1:142:8', ships: { lc: 30 }, stock: { m: 9e5, c: 9e5, d: 5e4 } },
  { name: 'Colonie', coords: '1:142:6', ships: {}, stock: { m: 0, c: 0, d: 0 } }
];

t('rien à sauver sans transporteur : on se tait', () => {
  assert.equal(Q.fleetsaveAction(
    [{ name: 'Mère', coords: '1:142:8', ships: {}, stock: { m: 9e5, c: 9e5, d: 0 } }],
    stats, nuitProche, T0), null);
});

t('avec des transporteurs, l\'action nomme la flotte et l\'heure de retour', () => {
  const fs = Q.fleetsaveAction(flotteOk, stats, nuitProche, T0);
  assert.equal(fs.family, 'abri');
  assert.ok(fs.detail.ships.lc > 0);
  assert.ok(fs.detail.backAt > nuitProche.endMs);
  assert.equal(fs.confirm, 'snooze');
  assert.equal(fs.loss, true);
  assert.ok(fs.how && fs.how.length);
});

t('il fait déjà nuit : pas de rendez-vous du soir', () => {
  assert.equal(Q.fleetsaveAction(flotteOk, stats, nuitEnCours, T0), null);
});

t('trop tôt dans la journée : pas encore de rendez-vous du soir', () => {
  const loin = Object.assign({}, nuitProche, { startMs: T0 + 6 * 3600e3 });
  assert.equal(Q.fleetsaveAction(flotteOk, stats, loin, T0), null);
});

t('fenêtre de nuit dégénérée : pas de boucle, pas d\'Infinity', () => {
  const dege = { start: 7, end: 7, isNight: () => false, startMs: null, endMs: null };
  assert.equal(Q.fleetsaveAction(flotteOk, stats, dege, T0), null);
});

t('une seule planète : la mise à l\'abri passe par une expédition', () => {
  const seule = [{ name: 'Mère', coords: '1:142:8', ships: { lc: 10 }, stock: { m: 5e5, c: 2e5, d: 1e4 } }];
  const fs = Q.fleetsaveAction(seule, stats, nuitProche, T0);
  assert.equal(fs.detail.mission, 'expedition');
  assert.equal(fs.detail.dest, '1:142:16');
});

t('après le retour d\'une expédition, un rappel de recyclage sans chiffres', () => {
  const rec = Q.recycleAction([{ mission: 15, ret: true, arrival: (T0 - 20 * 60e3) / 1000, dest: '1:142:16' }], T0);
  assert.equal(rec.family, 'recyclage');
  assert.equal(rec.cost, null);
  assert.ok(rec.how && rec.how.length);
  assert.equal(rec.confirm, 'snooze');
});

t('aucune expédition rentrée récemment : pas de rappel de recyclage', () => {
  assert.equal(Q.recycleAction([], T0), null);
  assert.equal(Q.recycleAction([{ mission: 15, ret: true, arrival: (T0 - 5 * 3600e3) / 1000 }], T0), null);
});

/* ---------- la fraîcheur des données ---------- */

const frais = { levels: T0 - 60e3, ships: T0 - 60e3, slots: T0 - 60e3, moves: T0 - 60e3 };

t('installation vierge : une seule ligne d\'accueil, pas six corvées', () => {
  const v = Q.freshnessAction({}, T0, true);
  assert.equal(v.family, 'fraicheur');
  assert.equal(v.blocked.kind, 'stale');
  assert.equal(Q.freshnessAction({}, T0, true).id, v.id);
});

t('installation vierge : la ligne d\'accueil ne dépend pas d\'une action bloquée', () => {
  assert.ok(Q.freshnessAction({}, T0, false));
});

t('donnée fraîche : rien', () => {
  assert.equal(Q.freshnessAction(frais, T0, true), null);
});

t('donnée périmée mais aucune action bloquée derrière : on ne dérange pas', () => {
  assert.equal(Q.freshnessAction(Object.assign({}, frais, { levels: T0 - 5 * 864e5 }), T0, false), null);
});

t('la ligne nomme la page à ouvrir et l\'âge de la donnée', () => {
  const vieux = Q.freshnessAction(Object.assign({}, frais, { levels: T0 - 5 * 864e5 }), T0, true);
  assert.ok(vieux.blocked.page);
  assert.ok(/jour/.test(vieux.why));
});

t('une seule ligne de fraîcheur à la fois, la donnée la plus ancienne', () => {
  const deux = Q.freshnessAction({ levels: T0 - 5 * 864e5, ships: T0 - 20 * 3600e3,
    slots: T0 - 60e3, moves: T0 - 60e3 }, T0, true);
  assert.equal(deux.blocked.page, 'Recherche');
});

/* ---------- l'apprentissage ---------- */

t('une famille jamais faite s\'affiche dépliée', () => {
  assert.equal(Q.shouldExpand({ family: 'abri', how: ['a'] }, {}), true);
});

t('une famille déjà faite se replie', () => {
  assert.equal(Q.shouldExpand({ family: 'abri', how: ['a'] }, { abri: 1 }), false);
});

t('une famille voisine ne fait pas taire l\'autre', () => {
  assert.equal(Q.shouldExpand({ family: 'abri', how: ['a'] }, { expedition: 1 }), true);
});

t('sans étapes, rien à déplier', () => {
  assert.equal(Q.shouldExpand({ family: 'mine', how: null }, {}), false);
});

t('une mémoire absente ne plante pas', () => {
  assert.equal(Q.shouldExpand({ family: 'abri', how: ['a'] }, null), true);
});

t('la colonisation et les formes de vie partent comme déjà faites', () => {
  const app = loadApp(fixtureState(), NOW, ['sample']);
  const learned = app.sample().learned;
  assert.equal(Q.shouldExpand({ family: 'colonisation', how: ['a'] }, learned), false);
  assert.equal(Q.shouldExpand({ family: 'formevie', how: ['a'] }, learned), false);
  assert.equal(Q.shouldExpand({ family: 'abri', how: ['a'] }, learned), true);
  assert.equal(Q.shouldExpand({ family: 'recyclage', how: ['a'] }, learned), true);
});

/* ---------- la projection ---------- */

const what = l => (l || []).map(x => x.what);

t('la projection propose les mêmes actions qu\'avant le passage au pas interne', () => {
  const first = loadApp(fixtureState(), NOW, ['project']).project().first;
  assert.deepEqual(what(first.acts), what(REF.acts));
  assert.deepEqual(what(first.waits), what(REF.waits));
});

t('la projection ne publie plus les instants suivants', () => {
  const plan = loadApp(fixtureState(), NOW, ['project']).project();
  assert.equal(plan.sessions, undefined);
  assert.ok(plan.first && Array.isArray(plan.first.acts));
  assert.ok(Array.isArray(plan.busy));
});

t('l\'écran À faire se rend sans erreur sur un empire réel', () => {
  const app = loadApp(fixtureState(), NOW, ['REFRESH']);
  assert.doesNotThrow(() => app.REFRESH.queue());
});

t('l\'écran À faire se rend sur une installation vierge', () => {
  const vierge = fixtureState();
  vierge.sample = true;
  vierge.syncAt = 0;
  vierge.planets = [vierge.planets[0]];
  for (const k of Object.keys(vierge.planets[0].b)) vierge.planets[0].b[k] = 0;
  vierge.planets[0].ships = {};
  vierge.planets[0].stock = { m: 500, c: 500, d: 0, at: 0 };
  for (const k of Object.keys(vierge.tech)) vierge.tech[k] = 0;
  const app = loadApp(vierge, NOW, ['REFRESH']);
  assert.doesNotThrow(() => app.REFRESH.queue());
});

/* ---------- résultat ---------- */

if (failures.length) {
  for (const [name, e] of failures) console.error('ÉCHEC  ' + name + '\n       ' + e.message);
  console.error('\n' + failures.length + ' échec(s), ' + passed + ' réussite(s)');
  process.exit(1);
}
console.log(passed + ' vérifications passées');
