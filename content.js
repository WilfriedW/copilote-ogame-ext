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
    if (id >= 11000) return lfQueue(id);
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

    /* Formes de vie : la liste donne le niveau et l'état de chaque case, et le
       panneau de détail — ouvert par le joueur lui-même — donne le coût exact
       du niveau suivant et sa durée, bonus compris. On ne clique sur rien. */
    const lf = {};
    document.querySelectorAll('li.technology[data-technology]').forEach(li => {
      const id = +li.dataset.technology;
      if (id < 11000) return;
      const tip = String(li.dataset.tooltipTitle || '');
      lf[id] = {
        lvl: +(li.querySelector('.level[data-value]')?.dataset.value) || 0,
        state: /pas assez/i.test(tip) ? 'short' : /pr[ée]requis/i.test(tip) ? 'locked' : 'ok'
      };
    });
    // Être passé sur une page vide est une information : la file demande un
    // bâtiment que le joueur n'a pas, il n'y a rien à relever.
    const lfPage = /lfbuildings/i.test(component) ? 'lfbuilding'
      : /lfresearch/i.test(component) ? 'lfresearch' : null;

    const det = document.getElementById('technologydetails');
    const detId = det ? +det.dataset.technologyId : 0;
    if (detId >= 11000) {
      const cost = [0, 0, 0];
      det.querySelectorAll('.costs li.resource[data-value]').forEach(c => {
        const j = lfRes(c.className);
        if (j >= 0) cost[j] = +c.dataset.value || 0;
      });
      lf[detId] = Object.assign(lf[detId] || {}, {
        name: clean(det.querySelector('h3')?.textContent),
        next: +(det.querySelector('.information .level[data-value]')?.dataset.value) || 0,
        cost,
        secs: lfSecs(det.querySelector('.build_duration time[datetime]')?.getAttribute('datetime'))
      });
    }

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
      lf,
      lfSeen: lfPage ? { [lfPage]: Date.now() } : null,
      slots,
      timers: unique
    };
  }

  /* Le panneau publie ce qu'il recommande ; on le montre sur la tuile. On
     n'ajoute qu'une classe et une étiquette inerte : rien n'est cliqué, rien
     n'est envoyé, et l'étiquette ne peut pas intercepter un clic. */
  let hints = {}, rates = {}, lean = false;
  /* Chaque règle vise un bloc nommé, repéré sur la page, et ne fait que le
     masquer. Elles ne s'appliquent que si le joueur a coché « Épurer », et
     décocher les retire toutes d'un coup. */
  const LEAN = `html.copilote-lean #mmonetbar,
html.copilote-lean #siteHeader,
html.copilote-lean #siteFooter{display:none}
html.copilote-lean #middle .maincontent > div > header{display:none}`;

  /* Stock affiché par le jeu, hors du snapshot : la surcouche en a besoin
     à chaque passage, pas seulement quand on envoie une photo. */
  const rawRes = id => {
    const e = document.getElementById('resources_' + id);
    return e && e.dataset.raw != null ? +e.dataset.raw : null;
  };

  /* Sous le coût d'un détail, le temps qu'il reste à attendre. Le jeu colore
     en rouge ce qui manque mais ne dit pas combien de temps ; le panneau,
     lui, connaît le débit de chaque planète. */
  function paintEta() {
    const det = document.getElementById('technologydetails');
    if (!det) return;
    const costs = det.querySelector('.costs');
    const vieux = det.querySelector('.copilote-eta');
    if (!costs) { if (vieux) vieux.remove(); return; }
    const r = rates[meta('planet-id')];
    const have = [rawRes('metal'), rawRes('crystal'), rawRes('deuterium')];
    let worst = 0;
    det.querySelectorAll('.costs li.resource[data-value]').forEach(li => {
      const j = lfRes(li.className);
      if (j < 0 || have[j] == null) return;
      const eta = etaSecs((+li.dataset.value || 0) - have[j], r ? r[j] : 0);
      if (eta > worst) worst = eta;
    });
    const txt = !r || worst <= 0 ? ''
      : isFinite(worst) ? 'Payable dans ' + hms(worst)
      : 'Hors de portée au rythme actuel de cette planète';
    if (!txt) { if (vieux) vieux.remove(); return; }
    const el = vieux || costs.appendChild(document.createElement('p'));
    el.className = 'copilote-eta';
    if (el.textContent !== txt) el.textContent = txt;
  }

  const STYLE = `li.technology.copilote-next{position:relative;outline:2px solid #8aa9ff;outline-offset:2px;border-radius:4px}
.copilote-tag{position:absolute;top:3px;right:3px;z-index:5;pointer-events:none;max-width:calc(100% - 6px);
overflow:hidden;background:#8aa9ff;color:#0c1120;font:700 11px/1.5 Arial,sans-serif;padding:0 5px;
border-radius:4px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.5)}
.copilote-eta{margin:6px 0 0;padding:3px 8px;border-left:3px solid #8aa9ff;background:rgba(138,169,255,.12);
color:#cfe0ff;font:700 12px/1.5 Arial,sans-serif}`;

  function paint() {
    if (!document.getElementById('copilote-style')) {
      const st = document.createElement('style');
      st.id = 'copilote-style';
      st.textContent = STYLE + '\n' + LEAN;
      document.head.appendChild(st);
    }
    document.documentElement.classList.toggle('copilote-lean', lean);
    const want = hints[meta('planet-id')] || {};
    document.querySelectorAll('li.technology.copilote-next').forEach(li => {
      if (want[li.dataset.technology] === undefined) {
        li.classList.remove('copilote-next');
        const t = li.querySelector('.copilote-tag');
        if (t) t.remove();
      }
    });
    for (const [tech, lvl] of Object.entries(want)) {
      const li = document.querySelector(`li.technology[data-technology="${tech}"]`);
      if (!li || li.classList.contains('copilote-next')) continue;
      li.classList.add('copilote-next');
      // Court exprès : la tuile est petite et affiche déjà son niveau courant
      // en bas. L'infobulle porte la phrase entière.
      const tag = document.createElement('span');
      tag.className = 'copilote-tag';
      tag.textContent = '→ ' + lvl;
      tag.title = 'Copilote : monter au niveau ' + lvl;
      li.appendChild(tag);
    }
    paintEta();
  }

  try {
    const take = skin => {
      hints = (skin && skin.hints) || {};
      rates = (skin && skin.rates) || {};
      lean = !!(skin && skin.lean);
    };
    chrome.storage.local.get('skin', v => { take(v && v.skin); paint(); });
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area === 'local' && ch.skin) { take(ch.skin.newValue); paint(); }
    });
  } catch (e) {}

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
  send(); paint();
  setInterval(() => { send(); paint(); }, 5000);
})();
