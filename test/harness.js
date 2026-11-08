/* Charge app.js sous Node avec un DOM factice et une horloge figée, pour
   pouvoir appeler la logique de planification hors du navigateur.

   app.js reste un script classique : on l'évalue ici comme le ferait la page,
   avec les globales qu'il attend. Le code évalué est un fichier du dépôt, pas
   une entrée extérieure. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/** Élément de DOM tolérant : tout accès réussit, rien n'a d'effet. */
function fakeEl() {
  const el = {
    textContent: '', innerHTML: '', value: '', hidden: false, checked: false,
    dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {}, removeEventListener() {}, setAttribute() {},
    getAttribute() { return null; }, appendChild() {}, focus() {}, select() {},
    closest() { return null; }, querySelector() { return fakeEl(); },
    querySelectorAll() { return []; }
  };
  return el;
}

/**
 * Évalue ids.js puis app.js et renvoie les symboles demandés.
 * @param {object} state état à placer dans le stockage local (devient `S`)
 * @param {number} nowMs instant figé renvoyé par Date.now()
 * @param {string[]} want noms des symboles d'app.js à récupérer
 * @returns {object} les symboles demandés
 */
function loadApp(state, nowMs, want) {
  const store = { 'ogame-copilot-v1': JSON.stringify(state) };
  const LS = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = v; }
  };

  class FrozenDate extends Date {
    constructor(...args) { super(...(args.length ? args : [nowMs])); }
    static now() { return nowMs; }
  }

  // un élément par identifiant, mémorisé : les tests peuvent relire ce qui a été écrit
  const byId = new Map();
  const document = {
    title: 'Copilote OGame',
    getElementById: id => { if (!byId.has(id)) byId.set(id, fakeEl()); return byId.get(id); },
    querySelector: () => fakeEl(),
    querySelectorAll: () => [],
    createElement: () => fakeEl(),
    addEventListener() {},
    body: fakeEl()
  };

  const chrome = {
    storage: { local: { get(k, cb) { if (cb) cb({}); }, set() {} }, onChanged: { addListener() {} } },
    runtime: { sendMessage() {} }
  };

  const window = { addEventListener() {}, chrome: undefined, __api: null, __game: null };

  // même ordre que boot.js : ids, puis la file, puis l'application
  const src = ['ids.js', 'queue.js', 'app.js']
    .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');

  const args = { document, window, chrome, LS, Date: FrozenDate,
    setInterval: () => 0, clearInterval: () => {} };
  const names = Object.keys(args);
  const out = new Function(...names, src + '\nreturn {' + want.join(', ') + '};')(
    ...names.map(n => args[n]));
  /** Ce que le rendu a écrit, par identifiant d'élément. */
  out.html = () => { const o = {}; for (const [k, el] of byId) o[k] = el.innerHTML || el.textContent || ''; return o; };
  return out;
}

/** Un empire de début de partie : deux planètes, Astrophysique fraîchement montée. */
function fixtureState() {
  const b = (over) => Object.assign({
    metal: 0, crystal: 0, deut: 0, solar: 0, fusion: 0, robot: 0, shipyard: 0,
    lab: 0, nanite: 0, smetal: 0, scrystal: 0, sdeut: 0
  }, over);
  return {
    v: 1, sample: false,
    settings: { eco: 1, fleet: 1, cls: 'collector', geo: false, eng: false, ratio: [3, 2, 1], top1: 0, colCargo: true },
    tech: {
      energy: 3, laser: 0, ion: 0, hyper: 0, plasma: 0, combustion: 4, impulse: 3,
      hyperdrive: 0, espionage: 4, computer: 2, astro: 3, irn: 0, weapons: 0,
      shielding: 0, armour: 0
    },
    planets: [
      { id: 'mere', name: 'Planète mère', coords: '1:142:8', tmax: 40,
        b: b({ metal: 14, crystal: 12, deut: 10, solar: 14, robot: 6, shipyard: 4, lab: 5, smetal: 3, scrystal: 3, sdeut: 2 }),
        sats: 0, ships: { sc: 6, lc: 2, pr: 4 }, shipsAt: 0,
        stock: { m: 120000, c: 60000, d: 18000, at: 0 } },
      { id: 'colo', name: 'Colonie', coords: '1:142:6', tmax: 55,
        b: b({ metal: 4, crystal: 3, deut: 2, solar: 6, robot: 2 }),
        sats: 0, ships: {}, shipsAt: 0,
        stock: { m: 9000, c: 4000, d: 500, at: 0 } }
    ],
    plan: [], fleetCalc: { from: '1:142:8', to: '1:142:6', pct: 100, ships: { sc: 1 } },
    expo: { pf: true }, ui: { tool: 'colony' },
    day: { interval: 90, nightStart: 23, nightEnd: 7, horizon: 24, focus: 'ecocol' },
    lf: { found: ['humans'] }, roles: {}, raid: null, raids: {}, daily: { done: {} },
    colo: { from: 0, objective: 'balanced', bonus: 0, target: '', kit: 'std', tr: 'sc', built: false, fields: '', fpos: '' },
    timers: [], moves: [], syncAt: 0
  };
}

module.exports = { loadApp, fixtureState };
