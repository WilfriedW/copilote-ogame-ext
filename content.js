(() => {
  const meta = n => document.querySelector(`meta[name="ogame-${n}"]`)?.content;
  const clean = s => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  /**
   * Maps a timer to its game queue so the same countdown read on two pages merges.
   * @param {string|null} techId technology id when known
   * @param {string} where production box id or page component
   * @returns {string} research | lfbuilding | lfresearch | shipyard | building
   */
  function queueOf(techId, where) {
    const id = +techId || 0;
    if (OG_TECH[techId] || /research/i.test(where) && !/lf/i.test(where)) return 'research';
    if (id >= 11200 && id % 100 >= 1 && Math.floor(id / 100) % 10 === 2) return 'lfresearch';
    if (id >= 11000) return 'lfbuilding';
    if (/lfresearch/i.test(where)) return 'lfresearch';
    if (/lfbuilding/i.test(where)) return 'lfbuilding';
    if (/shipyard|defense|defence/i.test(where) || (id >= 200 && id < 600)) return 'shipyard';
    return 'building';
  }

  /**
   * Reads what the current OGame page already displays. Never clicks, never requests.
   * @returns {object|null} snapshot, or null outside the game
   */
  function snapshot() {
    const planetId = meta('planet-id');
    if (!planetId) return null;
    const qs = new URLSearchParams(location.search);
    const component = qs.get('component') || qs.get('page') || '';

    const levels = {};
    document.querySelectorAll('li.technology[data-technology]').forEach(li => {
      const v = li.querySelector('.level[data-value]');
      if (v) levels[li.dataset.technology] = +v.dataset.value || 0;
    });

    const raw = id => {
      const e = document.getElementById('resources_' + id);
      return e && e.dataset.raw != null ? +e.dataset.raw : null;
    };

    const planets = [...document.querySelectorAll('#planetList .smallplanet')].map(sp => {
      const link = sp.querySelector('.planetlink');
      const tip = link ? (link.dataset.tooltipTitle || link.getAttribute('title') || '') : '';
      const temps = [...clean(tip).matchAll(/(-?\d+)\s*°C/g)].map(m => +m[1]);
      return {
        id: (sp.id || '').replace('planet-', ''),
        name: clean(sp.querySelector('.planet-name')?.textContent),
        coords: clean(sp.querySelector('.planet-koords')?.textContent).replace(/[\[\]]/g, ''),
        tmax: temps.length ? Math.max(...temps) : null
      };
    }).filter(p => p.id);

    const timers = [];
    document.querySelectorAll('[data-end]').forEach(el => {
      let end = +el.dataset.end;
      if (!end) return;
      if (end > 1e12) end = Math.round(end / 1000);
      if (end * 1000 < Date.now()) return;
      const box = el.closest('[id^="productionbox"]');
      const li = el.closest('[data-technology]');
      let techId = li?.dataset.technology || box?.querySelector('[data-technology]')?.dataset.technology || null;
      if (!techId) {
        const a = box?.querySelector('a[href*="openTech="]');
        if (a) techId = new URL(a.href, location.href).searchParams.get('openTech');
      }
      const tipEl = techId ? document.querySelector(`[data-technology="${techId}"][data-tooltip-title]`) : null;
      const tipName = clean(String(tipEl?.dataset.tooltipTitle || '').split(/<br\s*\/?>|\n/i)[0]);
      const label = (techId && OG_NAMES[techId]) || tipName
        || clean(box?.querySelector('th, h3, .header')?.textContent).slice(0, 60) || 'Construction';
      const type = queueOf(techId, box ? box.id : component);
      timers.push({ end, techId, type, label, planetId: OG_TECH[techId] ? null : planetId });
    });

    const ships = {};
    if (/fleetdispatch|shipyard/i.test(component)) {
      document.querySelectorAll('[data-technology]').forEach(el => {
        const id = +el.dataset.technology;
        if (id < 200 || id >= 300) return;
        const a = el.querySelector('.amount[data-value]') || el.querySelector('.level[data-value]');
        if (a) ships[id] = +a.dataset.value || 0;
      });
    }

    const moves = [], seen = new Set();
    document.querySelectorAll('[data-mission-type][data-arrival-time]').forEach(el => {
      const arrival = +el.dataset.arrivalTime;
      if (!arrival || arrival * 1000 < Date.now()) return;
      const ret = /^(true|1)$/i.test(el.dataset.returnFlight || '');
      const coords = sel => (clean(el.querySelector(sel)?.textContent).match(/\d+:\d+:\d+/) || [''])[0];
      const mission = +el.dataset.missionType;
      const key = `${mission}|${arrival}|${ret}`;
      if (seen.has(key)) return;
      seen.add(key);
      moves.push({ mission, ret, arrival, origin: coords('.coordsOrigin, .originCoords, .origin'), dest: coords('.destCoords, .destinationCoords, .destination') });
    });

    const slotTxt = clean(document.querySelector('#slots, .fleetStatus')?.textContent);
    const fm = slotTxt.match(/Flottes?\s*:?\s*(\d+)\s*\/\s*(\d+)/i), em = slotTxt.match(/Exp\S*\s*:?\s*(\d+)\s*\/\s*(\d+)/i);
    const slots = (fm || em) ? { fleet: fm ? [+fm[1], +fm[2]] : null, expo: em ? [+em[1], +em[2]] : null } : null;

    const artTxt = clean(document.body.textContent.match(/Art[ée]facts?\s+collect[ée]s?\s*:?\s*[\d.]+\s*\/\s*[\d.]+/i)?.[0]);
    const artefacts = artTxt ? +artTxt.match(/:?\s*([\d.]+)\s*\//)[1].replace(/\./g, '') : null;

    const unique = [];
    for (const t of timers) {
      const i = unique.findIndex(u => u.type === t.type && Math.abs(u.end - t.end) <= 5);
      if (i < 0) unique.push(t);
      else if (!unique[i].techId && t.techId) unique[i] = t;
    }
    for (const m of moves) {
      if (!m.ret) continue;
      if (unique.some(u => u.type === 'fleet' && Math.abs(u.end - m.arrival) <= 5)) continue;
      unique.push({ end: m.arrival, techId: null, type: 'fleet', label: 'Retour ' + (m.mission === 15 ? "d'expédition" : (OG_MISSIONS[m.mission] ? '(' + OG_MISSIONS[m.mission] + ')' : 'de flotte')), planetId: null });
    }

    return {
      at: Date.now(),
      component,
      meta: {
        uni: meta('universe-name'),
        eco: +meta('universe-speed') || null,
        fleet: +meta('universe-speed-fleet-peaceful') || null,
        cls: OG_CLASS[meta('player-characterclass-id')] || null,
        host: meta('universe') || location.host,
        playerId: meta('player-id') || null
      },
      planetId,
      planetName: meta('planet-name'),
      coords: meta('planet-coordinates'),
      planetType: meta('planet-type'),
      levels,
      stock: { m: raw('metal'), c: raw('crystal'), d: raw('deuterium') },
      energy: raw('energy'),
      planets,
      ships,
      moves,
      movePage: /movement/i.test(component),
      artefacts,
      slots,
      timers: unique
    };
  }

  let last = '', dirty = true;
  /** Sends the snapshot to the extension only when something changed. */
  function send() {
    if (!dirty) return;
    dirty = false;
    const s = snapshot();
    if (!s) return;
    const key = JSON.stringify({ ...s, at: 0 });
    if (key === last) return;
    last = key;
    try { chrome.runtime.sendMessage({ type: 'snapshot', data: s }).catch(() => {}); } catch (e) {}
  }

  new MutationObserver(() => { dirty = true; }).observe(document.body, { childList: true, subtree: true });
  send();
  setInterval(send, 5000);
})();
