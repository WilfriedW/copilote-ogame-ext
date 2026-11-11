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
    if (id >= 11000) return Math.floor(id / 100) % 10 === 2 ? 'lfresearch' : 'lfbuilding';
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

/**
 * Merges a page snapshot into the stored game state and schedules alarms.
 * @param {object} s snapshot from content.js
 */
async function merge(s) {
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
  }
  for (const [id, lvl] of Object.entries(s.levels)) if (OG_TECH[id]) game.tech[OG_TECH[id]] = lvl;

  const now = Date.now();
  const keepMoves = (game.moves || []).filter(m => m.arrival * 1000 > now);
  if (s.movePage) game.moves = s.moves || [];
  else { for (const m of s.moves || []) if (!keepMoves.some(x => x.mission === m.mission && x.arrival === m.arrival && x.ret === m.ret)) keepMoves.push(m); game.moves = keepMoves; }
  if (s.slots) game.slots = { ...s.slots, at: s.at };
  if (s.artefacts != null) game.artefacts = s.artefacts;
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
 * @param {string} url page du jeu
 */
function goToGame(url) {
  if (!OGAME.test(url || '')) return;
  chrome.tabs.query({}, tabs => {
    const t = tabs.find(x => OGAME.test(x.url || ''));
    if (!t) return void chrome.tabs.create({ url });
    chrome.tabs.update(t.id, { url, active: true });
    chrome.windows.update(t.windowId, { focused: true }).catch(() => {});
  });
}

chrome.runtime.onMessage.addListener(msg => {
  if (msg && msg.type === 'snapshot' && msg.data) merge(msg.data);
  if (msg && msg.type === 'go' && msg.url) goToGame(msg.url);
  if (msg && msg.type === 'alert' && msg.text) showAlertWindow(msg.text);
  if (msg && msg.type === 'apiRefresh') apiRefresh(!!msg.force);
});

chrome.storage.onChanged.addListener(async (ch, area) => {
  if (area !== 'local' || !ch.pendingAlerts || (ch.pendingAlerts.newValue || []).length) return;
  chrome.action.setBadgeText({ text: '' });
  chrome.notifications.getAll(all => Object.keys(all || {}).forEach(id => chrome.notifications.clear(id)));
});

chrome.notifications.onClicked.addListener(() => chrome.storage.local.set({ pendingAlerts: [] }));

const API_TTL = { server: 20 * 3600e3, players: 20 * 3600e3, universe: 24 * 3600e3, scores: 55 * 60e3 };
const attrs = s => Object.fromEntries([...s.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')]));
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
      out.server = { galaxies: +tag(x, 'galaxies') || 9, systems: +tag(x, 'systems') || 499, donutGalaxy: tag(x, 'donutGalaxy') === '1', donutSystem: tag(x, 'donutSystem') === '1', bonusFields: +tag(x, 'bonusFields') || 0, speed: +tag(x, 'speed') || null };
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
  chrome.action.setBadgeBackgroundColor({ color: '#ff4d6d' });
  chrome.action.setBadgeText({ text: String(pendingAlerts.length) });
}
