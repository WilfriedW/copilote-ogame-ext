/* node test/run.js — vérifie la logique pure de queue.js.
   Pas de framework : queue.js reste un script classique chargé par le
   navigateur, et on l'évalue ici comme le navigateur le ferait. */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'queue.js'), 'utf8');
const EXPORTS = ['rankActions'];

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

/* ---------- la projection ---------- */

const { loadApp, fixtureState } = require('./harness');
const REF = require('./fixtures/projection-avant.json');
const NOW = Date.UTC(2026, 10, 8, 14, 0, 0);
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

/* ---------- résultat ---------- */

if (failures.length) {
  for (const [name, e] of failures) console.error('ÉCHEC  ' + name + '\n       ' + e.message);
  console.error('\n' + failures.length + ' échec(s), ' + passed + ' réussite(s)');
  process.exit(1);
}
console.log(passed + ' vérifications passées');
