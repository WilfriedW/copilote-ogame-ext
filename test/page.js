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
    /* Le script peint par variables CSS — les entrées du menu, la couleur
       d'une planète : on garde ce qu'il écrit, pour pouvoir le vérifier. */
    style: { props: {}, setProperty(k, v) { this.props[k] = v; }, removeProperty(k) { delete this.props[k]; } },
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
      if (sel === 'li.technology[data-technology]') {
        for (let n = e; n; n = n.parent) {
          if (n.className.split(' ').includes('technology') && n.dataset.technology != null) return n;
        }
        return null;
      }
      if (sel === '.cp-case[data-technology]') {
        for (let n = e; n; n = n.parent) {
          if (n.className.split(' ').includes('cp-case') && n.dataset.technology != null) return n;
        }
        return null;
      }
      if (sel === '#technologies') {
        for (let n = e; n; n = n.parent) if (n.id === 'technologies') return n;
        return null;
      }
      throw new Error('closest non prévu par le faux DOM : ' + sel);
    },
    getAttribute() { return null; },
    setAttribute() {},
    /* La peau pose des boutons : un élément de page en écoute les clics. */
    addEventListener(type, fn) { (e.ecoutes[type] = e.ecoutes[type] || []).push(fn); },
    ecoutes: {},
    focus() { e.focus_ = true; },
    select() { e.selectionne = true; }
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
 * @param {object} opts.niveaux par tuile : un niveau (14), ou { nombre: 7 } pour une case qui se compte ; absente, la case n'a ni l'un ni l'autre
 * @param {string} opts.stockageCasse 'get' : le stockage lève en lecture ; 'lastError' : l'écriture finit sur une erreur
 * @param {object[]} opts.askAvant ce que `prioAsk` contient déjà au chargement
 * @param {boolean} opts.getDiffere le `get('prioAsk')` ne répond qu'à `livre()` : le vrai est asynchrone
 * @param {object} opts.noms par tuile : le nom que le jeu écrit dans son étiquette
 * @returns {object} { html, eta, dataset }
 */
function runPage({ skin, planetId = '33657643', costs = [], stock = [0, 0, 0], details = true,
  search = '?page=ingame&component=research', tiles = [], vieuxStyle = null, intruse = false,
  casesIntruses = false, planetList = true, menuMuet = false, champsFlotte = false,
  enChantier = null, heures = null, niveaux = {}, noms = {}, stockageCasse = null, getDiffere = false, askAvant }) {
  const html = el('html');
  const head = el('head');
  const body = el('body');

  const metaEl = el('meta', { content: planetId });
  /* Ce qui date une page : la balise que le jeu remplit à sa naissance, son
     horloge — toutes deux en heure du serveur — et les lignes d'arrivée de
     flotte, relevées sur la page Mouvements : un `tr` qui porte l'instant,
     une cellule qui l'écrit. */
  const metaHeure = heures ? el('meta', { content: String(heures.epoch) }) : null;
  const horloge = heures ? el('div', { className: 'OGameClock', textContent: heures.horloge }) : null;
  const arrivees = ((heures && heures.arrivees) || []).map(a => {
    const cellule = el('td', { className: 'arrivalTime', textContent: a.txt });
    const ligne = el('tr', { className: 'eventFleet' });
    ligne.appendChild(cellule);
    ligne.getAttribute = n => (n === 'data-arrival-time' ? String(a.epoch) : null);
    ligne.querySelectorAll = sel => (sel === '*' ? [cellule] : []);
    return cellule;
  });
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
  /* La colonne du jeu et son contenu principal : `#middle > .maincontent`, le
     même squelette sur toutes les pages — seul l'identifiant change
     (`#suppliescomponent`, `#researchcomponent`…). */
  const milieu = el('div', { id: 'middle' });
  const principal = el('div', { id: 'pagecomponent', className: 'maincontent' });
  milieu.appendChild(principal);
  /* Le cadre du jeu et ses trois colonnes — le menu, le contenu, les planètes.
     La mise en page large le déduit de ses deux bords, sans jamais le nommer :
     le faux DOM lui donne donc la forme, pas l'identifiant. */
  const cadre = el('div', { id: 'pageContent' });
  /* Le cadre porte un quatrième enfant, relevé sur la vraie page : la barre de
     ressources du jeu, qui n'est pas une colonne et n'en est pas une. */
  const rangHaut = el('div', { id: 'top' });
  // la ligne des missions et des mouvements de flotte, que la peau emprunte
  const barreNotif = el('div', { id: 'notificationbarcomponent' });
  rangHaut.appendChild(barreNotif);
  /* La barre de ressources du jeu, dans son porteur : c'est ce porteur que
     la bande du haut emmène, pas la liste elle-même. */
  const porteRes = el('div', { id: 'resourcesbarcomponent' });
  const listeRes = el('div', { id: 'resources' });
  porteRes.appendChild(listeRes);
  rangHaut.appendChild(porteRes);
  const colMenu = el('div', { id: 'links' });
  const menuTable = el('ul', { id: 'menuTable' });
  colMenu.appendChild(menuTable);
  /* Les entrées du menu, telles que le jeu les écrit : chacune nomme sa page
     dans son adresse, et porte son libellé dans un `.textlabel`. La dernière
     est une page qu'aucune famille du rail ne connaît. */
  const MENU = [['overview', "Vue d'ensemble"], ['supplies', 'Ressources'],
    ['facilities', 'Installations'], ['research', 'Recherche'],
    ['fleetdispatch', 'Flotte'], ['galaxy', 'Galaxie'], ['zorglub', 'Nouveauté']];
  const liensMenu = MENU.map(([comp, nom]) => {
    const a = el('a');
    // un menu dont aucune entrée ne porte de nom : le jeu n'en fait pas, mais
    // il suffirait qu'il renomme sa balise de libellé
    const lab = el('span', { className: 'textlabel', textContent: menuMuet ? '' : nom });
    a.appendChild(lab);
    a.getAttribute = s => s === 'href' ? '/game/index.php?page=ingame&component=' + comp : null;
    a.querySelector = s => s === '.textlabel' ? lab : null;
    a.closest = () => a;
    menuTable.appendChild(a);
    return a;
  });
  menuTable.querySelectorAll = s => s === 'a[href]' ? liensMenu : [];
  const colPlanetes = el('div', { id: 'rechts' });
  const listePlanetes = planetList ? el('div', { id: 'planetList' }) : null;
  if (listePlanetes) colPlanetes.appendChild(listePlanetes);
  cadre.appendChild(rangHaut);
  cadre.appendChild(colMenu);
  cadre.appendChild(milieu);
  cadre.appendChild(colPlanetes);
  body.appendChild(cadre);

  /* Le dedans d'une page à cases, relevé sur le jeu : le titre, l'illustration
     avec son panneau de détail, puis les cases. La bande se pose entre les deux
     derniers. */
  const page = el('div', { id: 'supplies' });
  const entete = el('header');
  const illustration = el('div', { id: 'technologydetails_wrapper' });
  const cases = el('div', { id: 'technologies' });

  /* Une liste de tuiles, ou plusieurs : la page Recherche range ses cases en
     quatre encadrés, chacun avec sa propre liste. */
  const groupes = tiles.length && Array.isArray(tiles[0]) ? tiles : (tiles.length ? [tiles] : []);
  const tuiles = [];
  /* Page Flotte : chaque case porte le champ qui dit combien partent. C'est
     à ça qu'on la reconnaît, pas à son nom. */
  const champs = [];
  for (const g of groupes) {
    const ul = el('ul');
    for (const id of g) {
      const li = el('li', { className: 'technology', dataset: { technology: String(id) } });
      if (champsFlotte) champs.push(li.appendChild(el('input')));
      /* Une case en chantier : le jeu la marque et y met la fin et le niveau
         visé. C'est tout ce que la carte lit pour afficher son minuteur. */
      if (enChantier && String(enChantier.tech) === String(id)) {
        li.dataset.status = 'active';
        const fin = el('time', { dataset: { end: String(enChantier.fin) } });
        const vise = el('span', { className: 'targetlevel', textContent: String(enChantier.vise) });
        li.appendChild(fin);
        li.appendChild(vise);
        li.querySelector = sel => sel === '[data-end]' ? fin
          : sel === '.targetlevel' ? vise : null;
      }
      /* Le niveau ou le nombre d'une case, là où le jeu l'écrit : une balise
         `.level` ou `.amount` qui porte la valeur. Sans entrée, la case n'a ni l'un ni l'autre. */
      if (niveaux[id] != null) {
        const compte = typeof niveaux[id] === 'object';
        const n = el('span', { className: compte ? 'amount' : 'level',
          dataset: { value: String(compte ? niveaux[id].nombre : niveaux[id]) } });
        const avant = li.querySelector;
        li.querySelector = sel => sel === (compte ? '.amount[data-value]' : '.level[data-value]') ? n : avant(sel);
      }
      // le jeu étiquette ses cases, et c'est de là que vient leur nom
      // la pastille que le script pose sur la tuile
      const sansPastille = li.querySelector;
      li.querySelector = sel => sel === '.copilote-tag'
        ? li.children.find(c => String(c.className).split(' ').includes('copilote-tag')) || null
        : sansPastille(sel);
      li.getAttribute = s => s === 'aria-label' ? (noms[id] || 'Case ' + id) + ' (niveau 3)' : null;
      ul.appendChild(li);
      tuiles.push(li);
    }
    cases.appendChild(ul);
  }
  if (tuiles.length) {
    page.appendChild(entete);
    page.appendChild(illustration);
    page.appendChild(cases);
    principal.appendChild(page);
  }

  /* Une feuille de style laissée par une version précédente du script : c'est
     ce que trouve la réinjection qui suit une mise à jour de l'extension. */
  if (vieuxStyle != null) {
    const vieux = el('style', { id: 'copilote-style' });
    vieux.textContent = vieuxStyle;
    head.appendChild(vieux);
  }

  /* Un élément de la page qui porte la même classe que la nôtre : sur une page
     d'alliance, le contenu vient d'autres joueurs. */
  if (intruse) principal.appendChild(el('div', { className: 'copilote-bande' }));

  /* Un bloc de cases écrit par un autre joueur, hors du squelette du jeu :
     c'est ce que peut contenir une page d'alliance. */
  const fausses = el('div', { id: 'technologies' });
  // dans le contenu du jeu, et avant lui : c'est le pire cas
  if (casesIntruses) principal.children.unshift(fausses);

  const byId = { ...res, middle: milieu, menuTable, planetList: listePlanetes,
    resources: listeRes,
    // le panneau de détail du jeu : la peau l'emprunte et doit le rendre
    technologydetails_wrapper: illustration, notificationbarcomponent: barreNotif,
    technologies: casesIntruses ? fausses : (tuiles.length ? cases : null) };
  if (det) byId.technologydetails = det;

  // Sélecteurs exacts employés par content.js, et ce que la vraie page y répond.
  /* La bande se pose au-dessus des tuiles quand la page en a, sinon en bas de
     la colonne : on la cherche aux deux endroits. */
  const estBande = c => c.className.split(' ').includes('copilote-bande');
  // la nôtre se reconnaît à son compteur de poses
  const estNotre = c => estBande(c) && c.dataset.pose;
  const laBande = () => page.children.find(estNotre) || principal.children.find(estNotre) || null;
  const toutes = () => page.children.filter(estBande).length + principal.children.filter(estBande).length;

  const routes = {
    '#middle .maincontent': () => principal,
    'meta[name="ogame-planet-id"]': () => metaEl,
    '.costs': () => costsBox,
    '.copilote-eta': () => (det ? det.children.find(c => c.className === 'copilote-eta') || null : null),
    '.costs li.resource[data-value]': () => costEls,
    'li.technology.copilote-next': () => tuiles.filter(t => t.classList.contains('copilote-next')),
    'h3': () => null,
    '.information .level[data-value]': () => null,
    '.build_duration time[datetime]': () => null,
    'li.technology[data-technology]': () => tuiles,
    // les cases qui portent un champ : celles de la page Flotte
    'li.technology[data-technology] > input': () => champs,
    // comme un vrai navigateur : la première du document, intruse comprise
    '.copilote-bande': () => page.children.find(estBande) || principal.children.find(estBande) || null,
    '[data-end]': () => [],
    '[data-technology]': () => [],
    '[data-mission-type][data-arrival-time]': () => [],
    'meta[name="ogame-timestamp"]': () => metaHeure,
    '.OGameClock': () => horloge,
    '[data-arrival-time]': () => arrivees.map(c => c.parent),
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

  /* Les écoutes posées sur le document, par type : le script en pose une sur
     les clics, et une sur l'arrivée d'un script plus neuf. */
  const ecoutes = {};
  const document = {
    documentElement: html,
    head, body,
    title: '',
    getElementById: id => byId[id] || null,
    createElement: tag => el(tag),
    querySelector: sel => pick(sel, false),
    querySelectorAll: sel => pick(sel, true),
    addEventListener(type, fn) { (ecoutes[type] = ecoutes[type] || []).push(fn); },
    dispatchEvent(ev) { (ecoutes[ev.type] || []).forEach(fn => fn(ev)); return true; }
  };
  byId['copilote-style'] = null;
  const realGet = document.getElementById;
  document.getElementById = id => {
    if (id === 'copilote-style') return head.children.find(c => c.id === 'copilote-style') || null;
    return realGet(id);
  };

  const ecrit = {};
  if (askAvant !== undefined) ecrit.prioAsk = askAvant;
  let dernier = null;
  // Le panneau republie son envoi : on garde l'écouteur pour rejouer la scène.
  let republie = null;
  const enAttente = [];
  const chrome = {
    storage: {
      /* Ce que le script écrit est gardé : un test le relit comme le ferait le
         panneau. `prioAsk` est la seule clé que le script lise et écrive ; le
         reste de ce qu'il lit est le relevé du panneau. */
      local: {
        get(k, cb) {
          if (stockageCasse === 'get' && k === 'prioAsk') throw new Error('Extension context invalidated.');
          // la valeur se lit à l'appel : une réponse tardive porte l'état d'alors, pas celui d'après
          const v = k === 'prioAsk' ? (ecrit.prioAsk !== undefined ? { prioAsk: ecrit.prioAsk } : {}) : { skin };
          const rep = () => cb(v);
          if (getDiffere && k === 'prioAsk') enAttente.push(rep); else rep();
        },
        set(o, cb) {
          Object.assign(ecrit, JSON.parse(JSON.stringify(o)));
          // `onChanged` sonne aussi dans le contexte qui écrit
          if ('prioAsk' in o && republie && stockageCasse !== 'lastError') republie({ prioAsk: { newValue: ecrit.prioAsk } }, 'local');
          if (stockageCasse === 'lastError') chrome.runtime.lastError = { message: 'Extension context invalidated.' };
          try { if (cb) cb(); } finally { delete chrome.runtime.lastError; }
        }
      },
      onChanged: { addListener(fn) { republie = fn; } }
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
    Event: class { constructor(type) { this.type = type; } },
    setTimeout: fn => { fn(); return 0; },
    setInterval: () => 0,
    // le jeu peint ses entrées payantes en jaune ; ici rien n'est peint
    getComputedStyle: () => ({ color: '' }),
    URLSearchParams: global.URLSearchParams,
    URL: global.URL
  };
  const names = Object.keys(args);
  new Function(...names, src)(...names.map(n => args[n]));

  const read = () => {
    const eta = det ? det.children.find(c => c.className === 'copilote-eta') : null;
    const lien = eta ? eta.children.find(c => c.tagName === 'A') : null;
    const bande = laBande();
    const zone = n => {
      const z = bande && bande.children.find(c => c.dataset.zone === n);
      return z ? z.children : [];
    };
    const rail = colMenu.children.find(c => String(c.className).includes('cp-rail'));
    const panneau = principal.children.find(c => String(c.className).includes('copilote-peau-panneau'));
    const grilles = panneau ? panneau.children.filter(c => c.className === 'cp-grille') : [];
    const tetePeau = panneau && panneau.children.find(c => c.className === 'cp-tete');
    return {
      /** Les heures d'arrivée, telles qu'elles se lisent après passage. */
      heures: arrivees.map(c => ({ txt: c.textContent, titre: c.title, cls: c.className })),
      /** Ce que notre dessin de la page a posé. */
      peau: { posee: !!panneau, racine: html.className,
        cases: grilles.reduce((t, g) => t + g.children.length, 0),
        grilles: grilles.length,
        groupes: panneau ? panneau.children.filter(c => c.className === 'cp-groupe').map(c => c.textContent) : [],
        titre: (tetePeau && tetePeau.children.find(c => c.tagName === 'H2') || {}).textContent || '',
        noms: grilles.flatMap(g => g.children.map(carte => {
          const b = carte.children[0] || { children: [] };
          const txt = b.children.find(x => x.className === 'cp-txt') || { children: [] };
          return (txt.children.find(x => x.className === 'cp-nom') || {}).textContent || '';
        })),
        planetes: listePlanetes ? listePlanetes.className : null,
        colonne: (() => {
          const col = cadre.children.find(c => String(c.className).includes('cp-colonne'));
          if (!col) return 0;
          return col.children.reduce((t, carte) =>
            t + carte.children.filter(x => String(x.className).includes('cp-act')).length, 0);
        })(),
        cartes: (cadre.children.find(c => String(c.className).includes('cp-colonne')) || { children: [] }).children
          .map(c => (c.children[0] || {}).textContent || ''),
        rail: rail ? rail.children.map(c => String(c.className).split(' ')[0] + ':' + (c.textContent || c.id)
          + (c.dataset && c.dataset.touche ? '[' + c.dataset.touche + ']' : '')) : [],
        planetesEnHaut: (() => {
          if (!listePlanetes) return false;
          const b = rangHaut.children.find(c => String(c.className).includes('cp-barre'));
          return rangHaut.children.indexOf(listePlanetes) >= 0
            || !!(b && b.children.indexOf(listePlanetes) >= 0);
        })(),
        planetesRendues: !!listePlanetes && listePlanetes.parentNode === colPlanetes,
        detailDansPanneau: !!(panneau && panneau.children.some(c => c.children.indexOf(illustration) >= 0)),
        detailRendu: illustration.parentNode === page,
        chantiers: grilles.flatMap(g => g.children
          .filter(c => c.dataset.actif)
          .map(c => (c.children.find(x => x.className === 'cp-encours') || {}).textContent || '')),
        flotte: (tuiles[0] && tuiles[0].parentNode ? String(tuiles[0].parentNode.className) : ''),
        notifRendue: barreNotif.parentNode === rangHaut,
        bouton: !!rangHaut.children.find(c => String(c.className).includes('cp-barre'))
          && rangHaut.children.find(c => String(c.className).includes('cp-barre'))
            .children.some(c => String(c.className).includes('cp-bouton')),
        barre: (() => {
          const b = rangHaut.children.find(c => String(c.className).includes('cp-barre'));
          return b ? b.children.map(c => c.id || String(c.className).split(' ')[0]) : [];
        })(),
        actes: (() => {
          const col = cadre.children.find(c => String(c.className).includes('cp-colonne'));
          if (!col) return [];
          return col.children.flatMap(carte => carte.children
            .filter(x => String(x.className).includes('cp-act'))
            // ce qu'une ligne dit, puis où et quand — ce dernier en morceaux
            .map(a => a.children.map(c =>
              c.textContent || c.children.map(x => x.textContent).join('')).join(' | ')));
        })(),
        teintes: (() => {
          const col = cadre.children.find(c => String(c.className).includes('cp-colonne'));
          if (!col) return [];
          return col.children.flatMap(carte => carte.children
            .filter(x => String(x.className).includes('cp-act'))
            .flatMap(a => a.children.flatMap(c => c.children
              .filter(x => x.className === 'cp-ou')
              .map(x => x.style.props['--pc'] || ''))));
        })() },
      /** Ce que la mise en page large a marqué, cadre et colonnes. */
      large: {
        racine: html.className,
        cadre: cadre.className,
        haut: rangHaut.className,
        menu: colMenu.className,
        jeu: milieu.className,
        planetes: colPlanetes.className
      },
      poses: bande ? +bande.dataset.pose : 0,
      bandeEnTete: principal.children[0] === laBande(),
      bandeSousIllustration: page.children.indexOf(laBande()) === page.children.indexOf(cases) - 1
        && page.children.indexOf(illustration) === page.children.indexOf(laBande()) - 1,
      bandes: toutes(),
      bande: bande ? { ici: zone('ici').map(x => ({ txt: x.textContent, href: x.href || null,
        why: x.title || '', grisee: x.className.split(' ').includes('copilote-gris') })) } : null,
      tour: zone('tour').map(x => ({
        txt: x.textContent,
        href: x.href || null,
        courante: x.className.split(' ').includes('copilote-ici'),
        grisee: x.className.split(' ').includes('copilote-gris')
      })),
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
    /** Le panneau republie un envoi : les chiffres bougent, la page suit. */
    majSkin: neuf => republie && republie({ skin: { newValue: neuf } }, 'local'),
    /** Le panneau écrit ou vide `prioAsk` : sans argument, il retire la clé. */
    majAsk: neuf => {
      if (neuf === undefined) delete ecrit.prioAsk; else ecrit.prioAsk = neuf;
      republie && republie({ prioAsk: neuf === undefined ? { oldValue: [] } : { newValue: neuf } }, 'local');
    },
    /** Le stockage répond enfin aux `get('prioAsk')` restés en l'air. */
    livre: () => { while (enAttente.length) enAttente.shift()(); },
    /** Ce que la tuile du jeu porte : sa pastille, son infobulle, sa teinte. */
    tuile: id => {
      const li = tuiles.find(t => t.dataset.technology === String(id));
      const tag = li && li.querySelector('.copilote-tag');
      return { pastille: tag ? tag.textContent : null, infobulle: tag ? tag.title : '',
        classe: tag ? tag.className : '', noeud: tag, marquee: !!li && li.classList.contains('copilote-next') };
    },
    /** La pastille de la carte de la peau, ou null. */
    carte: id => {
      const panneau = principal.children.find(c => String(c.className).includes('copilote-peau-panneau'));
      const carte = (panneau ? panneau.children.filter(c => c.className === 'cp-grille').flatMap(g => g.children) : [])
        .find(c => c.dataset.technology === String(id));
      const t = carte && carte.children.find(c => String(c.className).split(' ').includes('cp-cible'));
      return { pastille: t ? t.textContent : null, infobulle: t ? t.title : '', classe: t ? t.className : '' };
    },
    /** Une secousse de la page, comme en produit le jeu. */
    secousse: () => secousse && secousse(),
    /** Un script plus neuf arrive : recharger l'extension sans recharger la
        page laisse l'ancien en vie, et les deux dessinaient côte à côte. */
    scriptNeuf: () => document.dispatchEvent({ type: 'copilote:arrivee' }),
    /** Le joueur ouvre une tuile : le jeu ne recharge rien, il déplie son panneau. */
    clic: id => {
      const li = tuiles.find(t => t.dataset.technology === String(id));
      if (!li) throw new Error('aucune tuile ' + id + ' dans cette page');
      (ecoutes.click || []).forEach(fn => fn({ target: li }));
    },
    /** Un clic droit sur une tuile, puis ce que fait le joueur dans le champ :
        `saisie` remplace le contenu (absente, il laisse le champ prérempli),
        puis Entrée — ou `{ echap }`, ou `{ perdFocus }`. `{ laisse: true }` ne fait rien
        du champ, pour le regarder ouvert. `{ dessus: true }` clique sur un descendant, `{ fabrique }` et
        `{ synthese }` rendent le clic droit, ou la touche, non fiables. `{ carte: true }` vise la carte de la peau plutôt que la tuile du jeu. Retourne ce que le
        script a fait de l'événement et de la tuile. */
    clicDroit: (id, saisie, { echap = false, perdFocus = false, carte = false, laisse = false, dessus = false, fabrique = false, synthese = false } = {}) => {
      /* La carte de notre peau, ou la tuile du jeu : le geste est le même, le
         joueur vise celle qu'il a sous les yeux. */
      const panneau = principal.children.find(c => String(c.className).includes('copilote-peau-panneau'));
      const li = carte
        ? (panneau ? panneau.children.filter(c => c.className === 'cp-grille').flatMap(g => g.children) : [])
          .find(c => c.dataset.technology === String(id))
        : tuiles.find(t => t.dataset.technology === String(id));
      if (!li) throw new Error('aucune ' + (carte ? 'carte ' : 'tuile ') + id + ' dans cette page');
      /* `dessus` : le clic tombe sur un descendant de la tuile (l'icône, le
         nom), comme avec une vraie souris. `fabrique` : l'événement vient d'un
         script de la page, non d'un geste du joueur. */
      const cible = dessus ? li.appendChild(el('span')) : li;
      const ev = { target: cible, isTrusted: !fabrique, empeche: false, preventDefault() { this.empeche = true; } };
      (ecoutes.contextmenu || []).forEach(fn => fn(ev));
      dernier = { ev, li };
      const champ = li.children.find(c => c.className === 'cp-prio-champ');
      if (!champ) return;
      if (laisse) return;
      if (saisie !== undefined) champ.value = saisie;
      const touche = key => {
        const k = { key, isTrusted: !synthese, empeche: false, preventDefault() { this.empeche = true; }, stopPropagation() {} };
        dernier.touche = k;
        (champ.ecoutes.keydown || []).forEach(fn => fn(k));
      };
      if (echap) touche('Escape');
      else if (perdFocus) (champ.ecoutes.blur || []).forEach(fn => fn({}));
      else touche('Enter');
    },
    /** Un clic droit sur une carte dont l'attribut `data-technology` a été écrit
        par quelqu'un d'autre : du texte qui voudrait casser un sélecteur. */
    clicDroitCarteForgee: valeur => {
      const panneau = principal.children.find(c => String(c.className).includes('copilote-peau-panneau'));
      const carte = el('div', { className: 'cp-case', dataset: { technology: valeur } });
      (panneau || principal).appendChild(carte);
      const ev = { target: carte, isTrusted: true, empeche: false, preventDefault() { this.empeche = true; } };
      (ecoutes.contextmenu || []).forEach(fn => fn(ev));
      dernier = { ev, li: carte };
    },
    /** Un clic droit sur autre chose qu'une tuile : un élément de la page, sans tuile au-dessus. */
    clicDroitAilleurs: () => {
      const ev = { target: el('div'), isTrusted: true, empeche: false, preventDefault() { this.empeche = true; } };
      (ecoutes.contextmenu || []).forEach(fn => fn(ev));
      dernier = { ev, li: null };
    },
    /** Le clic droit le plus récent : a-t-il pris le menu du navigateur ? */
    get menuEmpeche() { return !!(dernier && dernier.ev.empeche); },
    /** La touche jouée dans le champ a-t-elle perdu son action par défaut ? */
    get toucheEmpechee() { return !!(dernier && dernier.touche && dernier.touche.empeche); },
    /** Ce que la tuile du dernier clic droit dit pour refuser, ou null. */
    get refus() {
      const r = dernier && dernier.li && dernier.li.children.find(c => c.className === 'cp-prio-refus');
      return r ? r.textContent : null;
    },
    /** Le champ resté sur la tuile du dernier clic droit, ou null. */
    get champ() { return (dernier && dernier.li && dernier.li.children.find(c => c.className === 'cp-prio-champ')) || null; },
    /** Ce que le script a écrit dans le stockage local, par clé. */
    ecrit: () => ecrit,
    dataset: html.dataset,
    styleInjected: !!document.getElementById('copilote-style'),
    styleTxt: (document.getElementById('copilote-style') || {}).textContent || '',
    styles: head.children.filter(c => c.id === 'copilote-style').length
  };
}

module.exports = { runPage };
