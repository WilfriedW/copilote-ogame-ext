/* Exécute content.js hors du navigateur, contre un DOM réduit.

   Le script de page vit dans un monde isolé : rien de ce qu'il calcule n'est
   observable depuis la console du jeu, et les relevés faits de l'extérieur
   induisent en erreur. On le charge donc ici avec juste assez de DOM pour
   rejouer ce que le jeu affiche — structure relevée sur la vraie page.

   Le faux DOM ne comprend pas les sélecteurs CSS en général : il répond aux
   sélecteurs exacts qu'emploie content.js, listés dans `routes`. Un sélecteur
   inconnu lève, pour qu'un changement de code ne passe pas en silence. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/** Élément minimal : attributs, classes, enfants, dataset. */
function el(tag, attrs = {}) {
  const e = {
    tagName: tag.toUpperCase(),
    dataset: { ...(attrs.dataset || {}) },
    className: attrs.className || '',
    id: attrs.id || '',
    textContent: attrs.textContent || '',
    children: [],
    style: {},
    title: '',
    content: attrs.content,
    classList: {
      add(c) { if (!e.className.split(' ').includes(c)) e.className = (e.className + ' ' + c).trim(); },
      remove(c) { e.className = e.className.split(' ').filter(x => x && x !== c).join(' '); },
      contains(c) { return e.className.split(' ').includes(c); },
      toggle(c, on) { on ? e.classList.add(c) : e.classList.remove(c); }
    },
    appendChild(c) { e.children.push(c); c.parent = c.parentNode = e; return c; },
    insertBefore(n, ref) {
      const i = e.children.indexOf(ref);
      e.children.splice(i < 0 ? e.children.length : i, 0, n);
      n.parent = n.parentNode = e;
      return n;
    },
    remove() { if (e.parent) e.parent.children = e.parent.children.filter(x => x !== e); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    /* Le seul `closest` qu'emploie content.js : la tuile sous le clic. */
    closest(sel) {
      if (sel !== 'li.technology[data-technology]') throw new Error('closest non prévu par le faux DOM : ' + sel);
      for (let n = e; n; n = n.parent) {
        if (n.className.split(' ').includes('technology') && n.dataset.technology != null) return n;
      }
      return null;
    },
    getAttribute() { return null; },
    setAttribute() {}
  };
  return e;
}

/**
 * Monte la page et y exécute ids.js puis content.js.
 * @param {object} opts
 * @param {object} opts.skin charge utile publiée par le panneau
 * @param {string} opts.planetId identifiant de planète déclaré par le jeu
 * @param {object[]} opts.costs lignes de coût du panneau de détail
 * @param {number[]} opts.stock stocks affichés [métal, cristal, deutérium]
 * @returns {object} { html, eta, dataset }
 */
function runPage({ skin, planetId = '33657643', costs = [], stock = [0, 0, 0], details = true,
  search = '?page=ingame&component=research', tiles = [] }) {
  const html = el('html');
  const head = el('head');
  const body = el('body');

  const metaEl = el('meta', { content: planetId });
  const det = details ? el('div', { id: 'technologydetails' }) : null;
  const costsBox = det ? el('div', { className: 'costs' }) : null;
  if (det) det.appendChild(costsBox);

  const costEls = costs.map(c => el('li', { className: c.cls, dataset: { value: String(c.value) } }));
  const res = {
    resources_metal: el('div', { id: 'resources_metal', dataset: { raw: String(stock[0]) } }),
    resources_crystal: el('div', { id: 'resources_crystal', dataset: { raw: String(stock[1]) } }),
    resources_deuterium: el('div', { id: 'resources_deuterium', dataset: { raw: String(stock[2]) } })
  };

  // Les tuiles du jeu, rangées dans leur liste : c'est devant cette liste que
  // la barre de tournée se pose.
  const tuiles = tiles.map(id => el('li', { className: 'technology', dataset: { technology: String(id) } }));
  if (tuiles.length) {
    const ul = el('ul');
    tuiles.forEach(li => ul.appendChild(li));
    body.appendChild(ul);
  }

  const byId = { ...res };
  if (det) byId.technologydetails = det;

  // Sélecteurs exacts employés par content.js, et ce que la vraie page y répond.
  const routes = {
    'meta[name="ogame-planet-id"]': () => metaEl,
    '.costs': () => costsBox,
    '.copilote-eta': () => (det ? det.children.find(c => c.className === 'copilote-eta') || null : null),
    '.costs li.resource[data-value]': () => costEls,
    'li.technology.copilote-next': () => [],
    'h3': () => null,
    '.information .level[data-value]': () => null,
    '.build_duration time[datetime]': () => null,
    'li.technology[data-technology]': () => tuiles,
    '.copilote-tour': () => body.children.find(c => c.className.split(' ').includes('copilote-tour')) || null,
    '[data-end]': () => [],
    '[data-technology]': () => [],
    '[data-mission-type][data-arrival-time]': () => [],
    '#slots, .fleetStatus': () => null,
    '#planetList .smallplanet': () => []
  };
  const pick = (sel, all) => {
    if (!(sel in routes)) {
      const une = sel.match(/^li\.technology\[data-technology="(\d+)"\]$/);
      if (une) {
        const v = tuiles.filter(t => t.dataset.technology === une[1]);
        return all ? v : v[0] || null;
      }
      // les autres balises meta du jeu : absentes de ce faux DOM
      if (/^meta\[name="ogame-/.test(sel)) return all ? [] : null;
      throw new Error('sélecteur non prévu par le faux DOM : ' + sel);
    }
    const v = routes[sel]();
    return all ? (Array.isArray(v) ? v : v ? [v] : []) : (Array.isArray(v) ? v[0] || null : v);
  };

  for (const e of [det, costsBox].filter(Boolean)) {
    e.querySelector = sel => pick(sel, false);
    e.querySelectorAll = sel => pick(sel, true);
  }

  const clics = [];
  const document = {
    documentElement: html,
    head, body,
    title: '',
    getElementById: id => byId[id] || null,
    createElement: tag => el(tag),
    querySelector: sel => pick(sel, false),
    querySelectorAll: sel => pick(sel, true),
    addEventListener(type, fn) { if (type === 'click') clics.push(fn); }
  };
  byId['copilote-style'] = null;
  const realGet = document.getElementById;
  document.getElementById = id => {
    if (id === 'copilote-style') return head.children.find(c => c.id === 'copilote-style') || null;
    return realGet(id);
  };

  const chrome = {
    storage: {
      local: { get(k, cb) { cb({ skin }); }, set() {} },
      onChanged: { addListener() {} }
    },
    runtime: { sendMessage() { return { catch() {} }; } }
  };

  const src = ['ids.js', 'content.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  // Le script repeint quand la page bouge : on garde la main sur l'observateur
  // pour rejouer une secousse, et on exécute les minuteries tout de suite.
  let secousse = null;
  const args = {
    document, chrome,
    window: {},
    location: { search, pathname: '/game/index.php', href: 'https://x/game/index.php' + search },
    MutationObserver: class { constructor(cb) { secousse = cb; } observe() {} },
    setTimeout: fn => { fn(); return 0; },
    setInterval: () => 0,
    URLSearchParams: global.URLSearchParams,
    URL: global.URL
  };
  const names = Object.keys(args);
  new Function(...names, src)(...names.map(n => args[n]));

  const read = () => {
    const eta = det ? det.children.find(c => c.className === 'copilote-eta') : null;
    const lien = eta ? eta.children.find(c => c.tagName === 'A') : null;
    const barre = body.children.find(c => c.className.split(' ').includes('copilote-tour'));
    return {
      tour: barre ? barre.children.map(x => ({
        txt: x.textContent,
        href: x.href || null,
        courante: x.className.split(' ').includes('copilote-ici'),
        grisee: x.className.split(' ').includes('copilote-gris')
      })) : [],
      eta: eta ? eta.textContent : null,
      etaLink: lien ? lien.href : null,
      etaLinkText: lien ? lien.textContent : null,
      etaParent: eta && eta.parentNode ? eta.parentNode.id || eta.parentNode.className : null
    };
  };
  return {
    ...read(),
    read,
    /** Ce que fait le jeu en ouvrant une autre tuile : il refait son panneau. */
    efface: () => { const e = det && det.children.find(c => c.className === 'copilote-eta'); if (e) e.remove(); },
    /** Une secousse de la page, comme en produit le jeu. */
    secousse: () => secousse && secousse(),
    /** Le joueur ouvre une tuile : le jeu ne recharge rien, il déplie son panneau. */
    clic: id => {
      const li = tuiles.find(t => t.dataset.technology === String(id));
      if (!li) throw new Error('aucune tuile ' + id + ' dans cette page');
      clics.forEach(fn => fn({ target: li }));
    },
    dataset: html.dataset,
    styleInjected: !!document.getElementById('copilote-style')
  };
}

module.exports = { runPage };
