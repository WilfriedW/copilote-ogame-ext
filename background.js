importScripts('ids.js');

const OGAME = /^https:\/\/[^/]*\.ogame\.gameforge\.com\//;

/**
 * Enables the side panel and the toolbar icon only on OGame tabs.
 * @param {number} tabId tab to configure
 * @param {string|undefined} url tab URL, readable only on OGame hosts
 */
function scopeToTab(tabId, url) {
  const on = OGAME.test(url || '');
  chrome.sidePanel.setOptions(on ? { tabId, path: 'sidepanel.html', enabled: true } : { tabId, enabled: false }).catch(() => {});
  (on ? chrome.action.enable(tabId) : chrome.action.disable(tabId)).catch(() => {});
}

/** Applies the OGame-only scope to every open tab. */
function scopeAll() {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  chrome.action.disable().catch(() => {});
  chrome.tabs.query({}, tabs => tabs.forEach(t => scopeToTab(t.id, t.url)));
}

/**
 * Réinjecte le script de page dans les onglets OGame qui ne l'ont plus.
 * Recharger ou mettre à jour l'extension coupe le script des onglets en
 * cours sans le remplacer : la page continue de tourner sans repères, sans
 * rien signaler, jusqu'à ce que le joueur pense à la rafraîchir. On sonde
 * d'abord le marqueur que pose le script, pour ne jamais en empiler deux.
 */
function reinject() {
  chrome.tabs.query({ url: 'https://*.ogame.gameforge.com/game/index.php*' }, tabs => {
    if (chrome.runtime.lastError) return;
    for (const t of tabs || []) {
      chrome.scripting
        .executeScript({ target: { tabId: t.id }, func: () => !!window.__copilote })
        .then(res => {
          if (res && res[0] && res[0].result) return null;
          return chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['ids.js', 'content.js'] });
        })
        .catch(() => {});
    }
  });
}

chrome.runtime.onInstalled.addListener(() => { scopeAll(); reinject(); });
// Au démarrage du service worker aussi : un simple rechargement de
// l'extension ne déclenche pas forcément onInstalled.
reinject();
chrome.runtime.onStartup.addListener(scopeAll);
chrome.tabs.onUpdated.addListener((tabId, info, tab) => { if (info.url || info.status === 'loading' || info.status === 'complete') scopeToTab(tabId, tab.url); });
chrome.tabs.onActivated.addListener(({ tabId }) => chrome.tabs.get(tabId, t => { if (!chrome.runtime.lastError) scopeToTab(tabId, t && t.url); }));

const timerKey = t => `${t.techId || t.type}|${t.planetId || 'g'}|${t.end}`;

/**
 * Keeps one timer per queue and end time, preferring the one that names its technology.
 * @param {object[]} list stored timers
 * @returns {object[]} deduplicated timers
 */
function dedupe(list) {
  const queue = t => {
    const id = +t.techId || 0;
    if (t.type === 'fleet') return 'fleet';
    if (OG_TECH[t.techId] || /^research$/.test(t.type)) return 'research';
    /* La file d'une case de forme de vie se demande à `lfQueue`, et ne se
       recalcule pas ici : cette ligne en portait une seconde version, qui ne
       donnait la même réponse que sur la série des Humains. Pour une autre
       race (11401, 11601, 11801, 12001…) elle classait une recherche comme un
       bâtiment, la fusion d'en dessous l'écrasait contre un minuteur de
       bâtiment finissant à moins de 5 s près, et l'alarme du survivant était
       effacée : le joueur perdait une notification, sans trace. */
    if (id >= 11000) return lfQueue(id);
    if (/^lf/.test(t.type)) return /research/.test(t.type) ? 'lfresearch' : 'lfbuilding';
    if (/shipyard|defen/.test(t.type) || (id >= 200 && id < 600)) return 'shipyard';
    return 'building';
  };
  for (const t of list) t.type = queue(t);
  const scope = t => t.type === 'research' ? 'g' : (t.planetId || 'g');
  const kept = [];
  for (const t of list) {
    const i = kept.findIndex(u => u.type === t.type && scope(u) === scope(t) && Math.abs(u.end - t.end) <= 5);
    if (i < 0) kept.push(t);
    else if (!kept[i].techId && t.techId) kept[i] = t;
  }
  for (const t of list) if (!kept.includes(t)) chrome.alarms.clear('tm|' + timerKey(t));
  return kept;
}

/** Ce qui distingue deux mouvements : deux convois peuvent arriver à la même seconde. */
const cleMouvement = m => [m.mission, m.arrival, !!m.ret, m.origin || '', m.dest || '', m.camp || 'own'].join('|');

/**
 * Les mouvements de flotte après une lecture de page.
 *
 * Trois sources ne disent pas la même chose. L'encart des événements montre
 * tout ce qui vole, miens et hostiles : ce qu'il ne montre plus est arrivé ou
 * rappelé, il remplace donc tout. La page Mouvements ne montre que mes
 * flottes : elle remplace les miennes et garde les autres. Toute autre page
 * n'ajoute que ce qu'elle voit — une flotte n'y disparaît qu'à son arrivée.
 * Le témoin d'attaque du jeu, lui, se lit partout : éteint, aucune flotte
 * hostile ne vole vers moi, et une attaque rappelée cesse d'alerter.
 *
 * Une flotte arrivée n'est pas oubliée tout de suite : sa cargaison est sur la
 * planète, mais le stock lu avant son arrivée ne la porte pas. Elle passe dans
 * `arrived` douze heures, pour que le panneau la crédite tant qu'aucune page
 * n'a relu ce stock.
 */
function fusionneMouvements(game, s, now) {
  const vivant = m => m && m.arrival * 1000 > now;
  const avant = game.moves || [];
  const arrives = (game.arrived || []).filter(m => now - m.arrival * 1000 < 12 * 3600e3);
  for (const m of avant) if (!vivant(m) && m.cargo && !m.hostile && !arrives.some(x => cleMouvement(x) === cleMouvement(m))) arrives.push(m);
  game.arrived = arrives.slice(-100);
  const lus = (s.moves || []).filter(vivant);
  let base;
  if (s.eventList) base = [];
  else if (s.movePage) base = avant.filter(m => vivant(m) && m.camp && m.camp !== 'own');
  else base = avant.filter(vivant);
  const par = new Map(base.map(m => [cleMouvement(m), m]));
  // la lecture neuve l'emporte : elle peut porter le détail que l'ancienne n'avait pas
  for (const m of lus) par.set(cleMouvement(m), m);
  let out = [...par.values()];
  if (s.alerteJeu === false) out = out.filter(m => !m.hostile);
  return out.slice(0, 300);
}

/**
 * Merges a page snapshot into the stored game state and schedules alarms.
 * @param {object} s snapshot from content.js
 */
async function merge(s) {
  /* Les champs que la suite déréférence sans garde, comblés une fois ici plutôt
     que sept fois plus bas. `merge` est appelée sans `await` ni `catch` : un
     lèvement y partait en rejet non traité, dans un service worker — donc pas
     de notification, pas de badge, aucune console que le joueur ouvrira, et
     `game` cessait d'avancer en silence. `applyGame`, à l'autre bout de la même
     charge, est défensif partout : les deux moitiés avaient des politiques
     d'erreur opposées. */
  s = { ...s, meta: s.meta || {}, planets: s.planets || [], levels: s.levels || {},
    stock: s.stock || {}, timers: s.timers || [], moves: s.moves || [] };
  const { game = {} } = await chrome.storage.local.get('game');
  game.meta = { ...(game.meta || {}), ...Object.fromEntries(Object.entries(s.meta).filter(([, v]) => v != null)) };
  game.planets = game.planets || {};
  game.tech = game.tech || {};
  if (s.planets.length) game.order = s.planets.map(p => p.id);
  for (const p of s.planets) {
    const cur = game.planets[p.id] = game.planets[p.id] || { b: {} };
    cur.name = p.name || cur.name;
    cur.coords = p.coords || cur.coords;
    if (p.tmax != null) cur.tmax = p.tmax;
  }

  // La planète et la page que le joueur regarde : le relevé y lit son avancement,
  // et y revient à la fin.
  if (s.planetId) game.cur = s.planetId;
  game.page = s.page || null;

  if (s.planetType === 'planet') {
    const cur = game.planets[s.planetId] = game.planets[s.planetId] || { b: {} };
    cur.name = s.planetName || cur.name;
    cur.coords = s.coords || cur.coords;
    for (const [id, lvl] of Object.entries(s.levels)) {
      if (OG_BUILD[id]) cur.b[OG_BUILD[id]] = lvl;
      else if (id === '212') cur.sats = lvl;
    }
    // Les formes de vie s'apprennent au fil des visites : on complète sans
    // jamais effacer ce qu'une autre page avait déjà appris sur cette planète.
    if (s.lf && Object.keys(s.lf).length) {
      cur.lf = { ...(cur.lf || {}) };
      for (const [id, v] of Object.entries(s.lf)) cur.lf[id] = { ...(cur.lf[id] || {}), ...v, at: s.at };
    }
    if (s.lfSeen) cur.lfSeen = { ...(cur.lfSeen || {}), ...s.lfSeen };
    if (s.stock.m != null) cur.stock = { ...s.stock, at: s.at };
    if (s.energy != null) { cur.energy = s.energy; cur.energyLevels = JSON.stringify(cur.b); }
    if (s.ships && Object.keys(s.ships).length) {
      cur.ships = {};
      for (const [id, n] of Object.entries(s.ships)) { if (OG_SHIPS[id]) cur.ships[OG_SHIPS[id]] = n; if (id === '212') cur.sats = n; if (id === '217') cur.crawlers = n; }
      cur.shipsAt = s.at;
    }
    // L'heure de lecture, pas seulement le compte : après un lot sorti du
    // chantier, c'est elle qui dit si la défense affichée est encore la vraie.
    if (s.def != null) { cur.def = s.def; cur.defsAt = s.at; }
    if (s.defs) cur.defs = s.defs;
  }
  for (const [id, lvl] of Object.entries(s.levels)) if (OG_TECH[id]) game.tech[OG_TECH[id]] = lvl;

  const now = Date.now();
  game.moves = fusionneMouvements(game, s, now);
  if (s.slots) game.slots = { ...s.slots, at: s.at };
  if (s.artefacts != null) game.artefacts = s.artefacts;
  if (s.prodPanel && s.planetId) game.prod = { ...(game.prod || {}), [s.planetId]: { text: s.prodPanel, at: s.at } };
  // L'adresse du paramétrage de la production, telle que le jeu l'écrit : le relevé la réutilise.
  if (s.prodUrl) game.prodUrl = s.prodUrl;
  // Cet univers a-t-il des formes de vie : su dès la première page lue, sur n'importe quel poste.
  if (s.lfMenu != null) game.lfMenu = s.lfMenu;
  const timers = (game.timers || []).filter(t => t.end * 1000 > now - 10 * 60 * 1000);
  for (const t of s.timers) {
    const k = timerKey(t);
    if (timers.some(x => timerKey(x) === k)) continue;
    const same = timers.findIndex(x => (x.techId || x.type) === (t.techId || t.type) && x.planetId === t.planetId && Math.abs(x.end - t.end) < 600);
    if (same >= 0) { chrome.alarms.clear('tm|' + timerKey(timers[same])); timers.splice(same, 1); }
    timers.push(t);
    chrome.alarms.create('tm|' + k, { when: t.end * 1000 });
  }
  game.timers = dedupe(timers);
  /* Le décalage du serveur sur UTC, relu à chaque page : il suit donc les
     changements d'heure du serveur. Une page dont l'horloge ne se lit pas
     garde le dernier connu, marqué non vérifié — le panneau le dit. */
  if (Number.isFinite(s.srvOff)) game.srvTz = { off: s.srvOff, at: now, ok: true };
  else if (game.srvTz) game.srvTz = { ...game.srvTz, ok: false };
  game.at = now;
  for (const m of s.moves || []) if (m.mission === 18 && m.dest) { game.explored = game.explored || {}; game.explored[m.dest] = now; }
  await chrome.storage.local.set({ game });
  const { api } = await chrome.storage.local.get('api');
  if (!api || !api.at || api.host !== game.meta.host) apiRefresh(false);
}

/**
 * Ouvre une page du jeu dans l'onglet OGame déjà ouvert, sinon dans un nouvel
 * onglet. On ne navigue que vers OGame : l'URL vient du panneau, on la vérifie
 * quand même avant de l'envoyer à un onglet.
 *
 * Un clic du joueur sur une carte veut l'onglet devant lui : on l'active et on
 * ramène sa fenêtre. Le relevé, non — il enchaîne des dizaines de pages, et
 * reprendre la main à chaque fois arrachait le joueur à l'application où il
 * travaillait, bureau compris. Il navigue donc l'onglet là où il est, sans
 * l'activer ni toucher à la fenêtre : le script de page tourne et relève aussi
 * bien dans un onglet d'arrière-plan.
 * @param {string} url page du jeu
 * @param {boolean} discret ne pas prendre la main sur l'onglet ni la fenêtre
 */
/**
 * L'adresse, si c'en est bien une du jeu — telle que le navigateur la comprend.
 *
 * `OGAME` ne suffit pas à autoriser une navigation : son `[^/]*` accepte des
 * chaînes que le navigateur lit tout autrement. `https://mechant.fr\\.ogame.
 * gameforge.com/` et `https://mechant.fr#.ogame.gameforge.com/` la satisfont
 * toutes les deux, et mènent chez mechant.fr — la barre oblique inversée est
 * une barre oblique pour l'analyseur d'URL, et le dièse ouvre le fragment.
 * Rien dans le copilote ne fabrique aujourd'hui une telle adresse, mais celles
 * qui arrivent ici sont bâties sur `S.host`, lu dans une balise de la page :
 * c'est à l'entrée qu'on vérifie, pas à la source.
 *
 * On rend donc ce que l'analyseur a compris, jamais la chaîne reçue : le
 * chemin suivi est celui qui a été vérifié.
 * @param {string} url adresse à vérifier
 * @returns {string|null} l'adresse normalisée, ou null si elle n'est pas du jeu
 */
function pageDuJeu(url) {
  let u;
  try { u = new URL(String(url)); } catch (e) { return null; }
  if (u.protocol !== 'https:') return null;
  const h = u.hostname;
  if (h !== 'ogame.gameforge.com' && !h.endsWith('.ogame.gameforge.com')) return null;
  return u.href;
}

function goToGame(url, discret) {
  const sur = pageDuJeu(url);
  if (!sur) return;
  chrome.tabs.query({}, tabs => {
    const t = tabs.find(x => OGAME.test(x.url || ''));
    if (!t) return void chrome.tabs.create({ url: sur, active: !discret });
    chrome.tabs.update(t.id, discret ? { url: sur } : { url: sur, active: true });
    if (!discret) chrome.windows.update(t.windowId, { focused: true }).catch(() => {});
  });
}

/* L'onglet de travail du relevé. Il navigue des dizaines de pages : le faire
   dans l'onglet du joueur transformait sa page de jeu en clignotement et le
   déplaçait de planète en planète. Il a donc le sien, ouvert en arrière-plan à
   côté du sien et refermé à la fin — pendant ce temps le joueur continue de
   jouer sur le sien, qui ne bouge pas.
   L'identifiant vit dans le stockage de session et non dans une variable : le
   service worker peut s'arrêter entre deux arrêts du relevé, et on rouvrirait
   alors un onglet par page. */
const SCAN_TAB = 'scanTab';
const OGAME_MATCH = 'https://*.ogame.gameforge.com/game/index.php*';
/**
 * Mène l'onglet du relevé à cette page, en l'ouvrant la première fois.
 * @param {string} url page du jeu
 */
async function scanGo(url) {
  const sur = pageDuJeu(url);
  if (!sur) return;
  const { [SCAN_TAB]: id } = await chrome.storage.session.get(SCAN_TAB);
  // Le joueur a pu le fermer à la main : on le rouvre plutôt que d'échouer.
  if (id != null) { try { await chrome.tabs.update(id, { url: sur }); return; } catch (e) {} }
  const [jeu] = await chrome.tabs.query({ url: OGAME_MATCH });
  const t = await chrome.tabs.create(Object.assign({ url: sur, active: false },
    jeu ? { windowId: jeu.windowId, index: jeu.index + 1 } : {}));
  await chrome.storage.session.set({ [SCAN_TAB]: t.id });
}
/** Ferme l'onglet du relevé, s'il en reste un. */
async function scanFin() {
  const { [SCAN_TAB]: id } = await chrome.storage.session.get(SCAN_TAB);
  if (id == null) return;
  await chrome.storage.session.remove(SCAN_TAB);
  try { await chrome.tabs.remove(id); } catch (e) {}
}

chrome.runtime.onMessage.addListener(msg => {
  // Le seul endroit où l'échec de `merge` peut encore se dire : sans ce
  // `catch`, ce qu'elle lève part en rejet non traité, donc invisible.
  if (msg && msg.type === 'snapshot' && msg.data) merge(msg.data)
    .catch(e => console.error('Copilote : instantané non fusionné, l\'état du jeu n\'a pas avancé', e));
  if (msg && msg.type === 'go' && msg.url) goToGame(msg.url, !!msg.discret);
  if (msg && msg.type === 'scan' && msg.url) scanGo(msg.url).catch(e => console.error('Copilote : onglet de relevé', e));
  if (msg && msg.type === 'scanFin') scanFin().catch(e => console.error('Copilote : fermeture de l\'onglet de relevé', e));
  if (msg && msg.type === 'alert' && msg.text) showAlertWindow(msg.text);
  if (msg && msg.type === 'apiRefresh') apiRefresh(!!msg.force);
});

chrome.storage.onChanged.addListener(async (ch, area) => {
  if (area !== 'local') return;
  if (BADGE_CLES.some(k => ch[k])) badge().catch(e => console.error('Copilote : badge', e));
  if (!ch.pendingAlerts || (ch.pendingAlerts.newValue || []).length) return;
  chrome.notifications.getAll(all => Object.keys(all || {}).forEach(id => chrome.notifications.clear(id)));
});

/* Le corps d'une notification de file finie vaut « OK, vu ». Celle du coucher
   n'est pas une file : la vider effaçait les alertes du joueur sans répondre à
   la question. */
chrome.notifications.onClicked.addListener(id => {
  if (id === 'nuit') return;
  chrome.storage.local.set({ pendingAlerts: [] });
});
chrome.notifications.onButtonClicked.addListener((id, idx) => {
  if (id !== 'nuit') return;
  chrome.notifications.clear(id);
  chrome.storage.local.set({ nightAnswer: { at: Date.now(), oui: idx === 0 } });
});

const API_TTL = { server: 20 * 3600e3, players: 20 * 3600e3, universe: 24 * 3600e3, scores: 55 * 60e3 };
const attrs = s => Object.fromEntries([...s.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')]));
/* Les faits du serveur, tels que serverData.xml les publie. Lus tels quels et
   nommés une seule fois : la carte Serveur du panneau les affiche, et le reste
   du copilote n'en prend que ce dont il a besoin (anneaux, systèmes, cases
   bonus). Une clé absente d'une version du jeu laisse un trou, pas une erreur. */
const SRV_NUM = ['number', 'galaxies', 'systems', 'bonusFields', 'topScore', 'speed', 'speedFleetPeaceful', 'speedFleetWar', 'speedFleetHolding', 'researchDurationDivisor', 'globalDeuteriumSaveFactor', 'debrisFactor', 'debrisFactorDef', 'repairFactor', 'combatDebrisFieldLimit', 'wfMinimumRessLost', 'wfMinimumLossPercentage', 'wfBasicPercentageRepairable', 'bashlimit', 'newbieProtectionLimit', 'newbieProtectionHigh', 'probeCargo', 'cargoHyperspaceTechMultiplier', 'darkMatterNewAcount'];
const SRV_FLAG = ['donutGalaxy', 'donutSystem', 'acs', 'rapidFire', 'defToTF', 'deuteriumInDebris', 'wfEnabled', 'bashingSystemEnabled', 'marketplaceEnabled', 'characterClassesEnabled'];
const SRV_TXT = ['name', 'language', 'version', 'domain', 'timezone', 'timezoneOffset'];
const tag = (x, name) => { const m = x.match(new RegExp(`<${name}>([^<]*)</${name}>`)); return m ? m[1] : null; };

/**
 * Downloads the universe's public statistics files (official OGame API) when stale.
 * @param {boolean} force ignore cache durations
 */
async function apiRefresh(force) {
  const { game = {}, api = {} } = await chrome.storage.local.get(['game', 'api']);
  const host = game.meta && game.meta.host;
  if (!host) return;
  const now = Date.now(), out = { ...api, host }, stale = k => force || !api.at || !api.at[k] || now - api.at[k] > API_TTL[k] || api.host !== host;
  out.at = { ...(api.host === host ? api.at : {}) };
  const get = async path => { const r = await fetch(`https://${host}/api/${path}`, { credentials: 'omit' }); if (!r.ok) throw new Error(`${path} ${r.status}`); return r.text(); };
  try {
    if (stale('server')) {
      const x = await get('serverData.xml');
      const sv = {};
      for (const k of SRV_NUM) { const v = tag(x, k); if (v !== null && v !== '') sv[k] = +v; }
      for (const k of SRV_FLAG) sv[k] = tag(x, k) === '1';
      for (const k of SRV_TXT) { const v = tag(x, k); if (v) sv[k] = v; }
      sv.galaxies = sv.galaxies || 9; sv.systems = sv.systems || 499;
      out.server = sv;
      out.at.server = now;
    }
    if (stale('players')) {
      const x = await get('players.xml'), players = {};
      for (const m of x.matchAll(/<player\s([^>]*?)\/?>/g)) { const a = attrs(m[1]); players[a.id] = [a.name || '', a.status || '', a.alliance || '']; }
      out.players = players; out.at.players = now;
    }
    if (stale('universe')) {
      const x = await get('universe.xml'), planets = [];
      for (const m of x.matchAll(/<planet\s([^>]*?)\/?>/g)) { const a = attrs(m[1]); planets.push([a.coords, a.player]); }
      out.planets = planets; out.at.universe = now; out.uniTs = +(attrs((x.match(/<universe\s([^>]*)>/) || ['', ''])[1]).timestamp || 0) * 1000 || now;
    }
    if (stale('scores')) {
      const x = await get('highscore.xml?category=1&type=0'), scores = {};
      for (const m of x.matchAll(/<player\s([^>]*?)\/?>/g)) { const a = attrs(m[1]); scores[a.id] = [+a.score || 0, +a.position || 0]; }
      out.scores = scores; out.at.scores = now;
    }
    out.error = null;
  } catch (e) { out.error = String(e && e.message || e); }
  await chrome.storage.local.set({ api: out });
}

chrome.alarms.create('api', { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === 'api') { apiRefresh(false); return; }
  // Le son coupé dans le panneau vaut aussi pour ce qui sonne panneau fermé.
  const { muet } = await chrome.storage.local.get('muet');
  /* La question du coucher. Le panneau pose l'heure — il est le seul à lire les
     réglages — et le service worker sonne, même panneau fermé. Il ne décide
     rien : le plan de mise à l'abri vit dans le panneau, qui recueille la
     réponse par le stockage. */
  if (alarm.name === 'nuit') {
    chrome.notifications.create('nuit', {
      type: 'basic',
      iconUrl: 'icon128.png',
      title: 'Copilote OGame',
      message: 'On passe en mode sauvegarde des ressources ?',
      buttons: [{ title: 'Oui' }, { title: 'Non' }],
      requireInteraction: true,
      silent: !!muet,
      priority: 2
    });
    return;
  }
  if (!alarm.name.startsWith('tm|')) return;
  const { game = {} } = await chrome.storage.local.get('game');
  const t = (game.timers || []).find(x => 'tm|' + timerKey(x) === alarm.name);
  if (!t) return;
  const planet = t.planetId && game.planets?.[t.planetId]?.name;
  const text = t.label + (planet ? ` · ${planet}` : '');
  chrome.notifications.create(alarm.name, {
    type: 'basic',
    iconUrl: 'icon128.png',
    title: 'OGame : terminé',
    message: text,
    silent: !!muet,
    priority: 2
  });
  await showAlertWindow(text);
});

/**
 * Queues a finished item for the side panel banner and updates the icon badge.
 * @param {string} text finished item
 */
async function showAlertWindow(text) {
  const { pendingAlerts = [] } = await chrome.storage.local.get('pendingAlerts');
  if (pendingAlerts.includes(text)) return;
  pendingAlerts.push(text);
  await chrome.storage.local.set({ pendingAlerts });
  await badge();
}

/* ---------- le badge de l'icône ---------- */
/* Un seul badge pour tout ce qui veut l'icône, et un seul endroit qui le
   compose : chaque source qui l'écrivait elle-même effaçait celle d'à côté.
   Priorité : attaque entrante > version instable > alertes critiques > files
   terminées > rappel de mise à l'abri > mise à jour disponible. */
const BADGE_CLES = ['game', 'pendingAlerts', 'critiques', 'versionInstable', 'fsRappelOn', 'majVer'];
/** Une flotte hostile qui vient frapper l'une de mes planètes, et pas encore arrivée. */
const estAttaque = (m, now) => m && m.hostile && !m.ret && [1, 2, 9].includes(+m.mission) && m.arrival * 1000 > now;
/** Vrai si `b` est une version plus récente que `a`, nombre par nombre. */
function versionPlusRecente(a, b) {
  const n = v => String(v || '').split('.').map(x => parseInt(x, 10) || 0), x = n(a), y = n(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((y[i] || 0) !== (x[i] || 0)) return (y[i] || 0) > (x[i] || 0);
  return false;
}
/**
 * Ce que le badge doit montrer, à partir de ce que le stockage porte.
 * Pur, pour pouvoir le vérifier sans navigateur.
 * @returns {{text:string, color:string, quoi:string}}
 */
function badgeEtat(d, now, version) {
  const game = d.game || {};
  if ((game.moves || []).some(m => estAttaque(m, now))) return { text: '!', color: '#e0102b', quoi: 'attaque' };
  if (d.versionInstable) return { text: 'v!', color: '#ff8c1a', quoi: 'instable' };
  const crit = d.critiques && +d.critiques.n;
  if (crit > 0) return { text: String(Math.min(crit, 99)), color: '#ff4d6d', quoi: 'critiques' };
  const fin = (d.pendingAlerts || []).length;
  if (fin > 0) return { text: String(Math.min(fin, 99)), color: '#ff4d6d', quoi: 'terminé' };
  if (d.fsRappelOn && now - (+d.fsRappelOn.at || 0) < 24 * 3600e3) return { text: 'FS', color: '#3d7eff', quoi: 'rappel' };
  if (d.majVer && versionPlusRecente(version, d.majVer)) return { text: '↑', color: '#2e9e5b', quoi: 'maj' };
  return { text: '', color: '#ff4d6d', quoi: '' };
}
async function badge() {
  const d = await chrome.storage.local.get(BADGE_CLES);
  const e = badgeEtat(d, Date.now(), chrome.runtime.getManifest().version);
  chrome.action.setBadgeBackgroundColor({ color: e.color });
  chrome.action.setBadgeText({ text: e.text });
}

/* ---------- le rappel de mise à l'abri ---------- */
/* Le panneau pose l'alarme et recopie ici ce dont elle a besoin
   (`fsRappelCfg` : les jours actifs) : le service worker ne lit pas les
   réglages du panneau. Pas de notification système : un badge, qui reste
   jusqu'à ce que le joueur ouvre le plan — le panneau efface `fsRappelOn`. */
chrome.alarms.create('badge', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === 'badge') { badge().catch(() => {}); return; }
  if (alarm.name !== 'fsRappel') return;
  const { fsRappelCfg } = await chrome.storage.local.get('fsRappelCfg');
  const jours = fsRappelCfg && Array.isArray(fsRappelCfg.jours) ? fsRappelCfg.jours : [0, 1, 2, 3, 4, 5, 6];
  if (!jours.includes(new Date().getDay())) return;
  await chrome.storage.local.set({ fsRappelOn: { at: Date.now() } });
});
badge().catch(() => {});
