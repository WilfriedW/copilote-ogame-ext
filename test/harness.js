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
  /* Les classes se retiennent : une couleur posée par le panneau n'a pas
     d'autre trace, et un test qui ne peut pas la lire ne peut pas la tenir. */
  const cls = new Set();
  const el = {
    textContent: '', innerHTML: '', value: '', hidden: false, checked: false,
    dataset: {}, style: {},
    classList: {
      add(...c) { c.forEach(x => cls.add(x)); },
      remove(...c) { c.forEach(x => cls.delete(x)); },
      toggle(c, on) { (on === undefined ? !cls.has(c) : on) ? cls.add(c) : cls.delete(c); },
      contains(c) { return cls.has(c); }
    },
    on: {},
    addEventListener(type, fn) { (this.on[type] = this.on[type] || []).push(fn); },
    removeEventListener() {}, setAttribute() {},
    getAttribute() { return null; }, appendChild() {}, focus() {}, select() {}, click() {},
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
function loadApp(state, nowMs, want, api, ext, prioAsk) {
  // l'onglet où le panneau se trouve à l'ouverture : il le relit dans le stockage de page
  const tab = state.__tab; delete state.__tab;
  const store = { 'ogame-copilot-v1': JSON.stringify(state) };
  if (tab) store['ogame-copilot-v1-tab'] = tab;
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

  // ce que le panneau publie pour le script de page, pour pouvoir le relire
  const written = {};
  // ce que le panneau a envoyé au service worker
  const sent = [];
  const removed = [];
  const listeners = [];
  // ce que le panneau a envoyé aux autres postes
  const shared = {};
  // les fichiers que le panneau a fait écrire sur le disque
  const telecharges = [];
  const chrome = {
    storage: {
      local: { get(k, cb) { if (cb) cb({}); }, set(v) { Object.assign(written, v); },
        remove(k) { [].concat(k).forEach(x => removed.push(x)); } },
      sync: { get(k, cb) { if (cb) cb({}); }, set(v) { Object.assign(shared, v); return Promise.resolve(); } },
      onChanged: { addListener(fn) { listeners.push(fn); } }
    },
    runtime: { sendMessage(m) { sent.push(m); }, id: ext ? 'test-extension' : undefined },
    downloads: { download(o, cb) { telecharges.push(o); if (cb) cb(1); } }
  };

  // IS_EXT se lit sur window.chrome.runtime.id : seuls les tests qui veulent
  // le mode extension le demandent, les autres restent en mode page.
  const window = { addEventListener() {}, chrome: ext ? chrome : undefined, __api: api || null, __game: null, __prioAsk: prioAsk || null };

  // même ordre que boot.js
  const src = ['ids.js', 'app.js']
    .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');

  // l'envoi aux autres postes est différé : sans ces bouchons, le test
  // attendrait dix secondes pour rien et le runner ne rendrait pas la main
  const args = { document, window, chrome, LS, Date: FrozenDate,
    setInterval: () => 0, clearInterval: () => {},
    setTimeout: () => 0, clearTimeout: () => {} };
  const names = Object.keys(args);
  const out = new Function(...names, src + '\nreturn {' + want.join(', ') + '};')(
    ...names.map(n => args[n]));
  /** Ce que le rendu a écrit, par identifiant d'élément. */
  /** Ce que le panneau a écrit dans le stockage de l'extension. */
  out.stored = () => written;
  /** Ce que le panneau a envoyé au stockage partagé entre postes. */
  out.shared = () => shared;
  /** Les fichiers que le panneau a fait enregistrer. */
  out.telecharges = () => telecharges;
  /** L'état tel que le panneau l'a sauvegardé. */
  out.saved = () => JSON.parse(store['ogame-copilot-v1']);
  /** Les clés que le panneau a effacées du stockage. */
  out.removed = () => removed;
  /** Rejoue un changement de stockage, comme le navigateur le livre aux écouteurs. */
  out.fire = (changes, area) => listeners.forEach(fn => fn(changes, area || 'local'));
  /** Les messages que le panneau a envoyés au service worker. */
  out.sent = () => sent;
  /** Rejoue un clic sur un élément du panneau ; `target` sert aux poignées déléguées. */
  out.click = (id, target) => { const el = byId.get(id); if (!el) throw new Error('aucun élément ' + id); (el.on.click || []).forEach(fn => fn({ target: target || el, currentTarget: el })); return el; };
  /** Un élément du panneau, pour lire ce que le code lui a posé. */
  out.el = id => byId.get(id) || null;
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
