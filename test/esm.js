/* node test/esm.js <onglet> [outil] — charge le panneau en vrais modules ES.

   Le harnais met les modules à plat dans une seule portée : un nom emprunté
   sans `import`, ou importé d'un module qui ne l'exporte pas, y passe sans
   bruit, alors que le navigateur, lui, refuse de charger le panneau ou lève
   au premier appel. Ce script fait ce que fait la page : les scripts
   classiques d'abord, dans la portée globale, puis `import()` du point
   d'entrée. Il dessine l'onglet demandé et sort en erreur à la moindre
   exception ou au moindre console.error.

   Un processus par onglet : un module ne s'évalue qu'une fois par processus.
   Lancé par test/run.js ; lecture seule comme le reste, rien n'est envoyé. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');
const { fakeEl, fixtureState, CLASSIQUES, ENTREE } = require('./harness');

const ROOT = path.join(__dirname, '..');
const [onglet = 'today', outil] = process.argv.slice(2);

const erreurs = [];
const errOrig = console.error;
console.error = (...a) => { erreurs.push(a.map(x => (x && x.stack) || String(x)).join(' ')); };
process.on('uncaughtException', e => { erreurs.push(String(e && e.stack || e)); fin(); });
process.on('unhandledRejection', e => { erreurs.push(String(e && e.stack || e)); fin(); });

function fin() {
  console.error = errOrig;
  if (erreurs.length) { errOrig(erreurs.join('\n')); process.exit(1); }
  process.exit(0);
}

const NOW = new Date(2026, 10, 8, 22, 30, 0).getTime();
const etat = fixtureState();
etat.planets.forEach(p => { p.stock.at = NOW; });
if (outil) etat.ui.tool = outil;
const store = { 'ogame-copilot-v1': JSON.stringify(etat), 'ogame-copilot-v1-tab': onglet };

const byId = new Map();
class FrozenDate extends Date {
  constructor(...args) { super(...(args.length ? args : [NOW])); }
  static now() { return NOW; }
}
const globales = {
  document: {
    title: 'Copilote OGame',
    getElementById: id => { if (!byId.has(id)) byId.set(id, fakeEl()); return byId.get(id); },
    querySelector: () => fakeEl(), querySelectorAll: () => [], createElement: () => fakeEl(),
    addEventListener() {}, body: fakeEl(), documentElement: fakeEl()
  },
  chrome: {
    storage: {
      local: { get(k, cb) { if (cb) cb({}); }, set() {}, remove() {} },
      sync: { get(k, cb) { if (cb) cb({}); }, set() { return Promise.resolve(); } },
      onChanged: { addListener() {} }
    },
    runtime: { sendMessage() {} },
    downloads: { download() {} },
    alarms: { create() {}, clear() {} },
    notifications: { create() {}, clear() {}, getAll(cb) { if (cb) cb({}); }, onClicked: { addListener() {} }, onButtonClicked: { addListener() {} } }
  },
  LS: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } },
  Date: FrozenDate,
  setInterval: () => 0, clearInterval: () => {}, setTimeout: () => 0, clearTimeout: () => {}
};
globales.window = { addEventListener() {}, chrome: undefined, __api: null, __game: null, __prioAsk: null,
  __rules: JSON.parse(fs.readFileSync(path.join(ROOT, 'rules.json'), 'utf8')), __uiState: null, __uiSeen: null };
Object.assign(globalThis, globales);

// les scripts classiques, dans la portée globale comme sur la page
for (const f of CLASSIQUES) vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });

import(pathToFileURL(path.join(ROOT, ENTREE)).href).then(() => {
  // le premier rendu est fait au chargement : la vue demandée doit être là
  const vue = byId.get('view');
  if (!vue || !String(vue.innerHTML).length) erreurs.push('la vue ' + onglet + ' est restée vide');
  fin();
}, e => { erreurs.push(String(e && e.stack || e)); fin(); });
