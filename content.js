(() => {
  // Marqueur de présence : l'extension s'en sert pour savoir si cet onglet a
  // déjà son script avant d'en réinjecter un, et ne jamais en empiler deux.
  if (window.__copilote) return;
  window.__copilote = 1;

  const meta = n => document.querySelector(`meta[name="ogame-${n}"]`)?.content;
  const clean = s => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  /**
   * Maps a timer to its game queue so the same countdown read on two pages merges.
   * @param {string|null} techId technology id when known
   * @param {string} where production box id or page component
   * @returns {string} research | lfbuilding | lfresearch | shipyard | building
   */
  let prodWarned = false; // le message « sans tableau reconnu » ne sort qu'une fois par état
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
        eff: lfEffect(det.textContent),
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

    /* La page Défense se lit comme le chantier : même balisage, identifiants
       400 à 499. Rien n'est publié tant qu'elle n'a pas été ouverte, pour que
       « aucune défense » se distingue de « page jamais ouverte » — c'est la
       différence qui décide entre satellites et centrale.
       Chaque type se compte à part : un tas d'un seul type est gratuit à
       percer, et savoir lequel manque demande de les distinguer. Le total
       reste publié, c'est lui que lisent les pages qui ne veulent qu'un oui
       ou non. */
    let def = null, defs = null;
    if (/defen[cs]e/i.test(component)) {
      def = 0; defs = {};
      document.querySelectorAll('[data-technology]').forEach(el => {
        const id = +el.dataset.technology;
        if (id < 400 || id >= 500) return;
        const a = el.querySelector('.amount[data-value]') || el.querySelector('.level[data-value]');
        if (!a) return;
        const n = +a.dataset.value || 0;
        def += n;
        const k = OG_DEF[id];
        if (k) defs[k] = n;
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
    /* Trois chiffres au plus : le jeu n'en affiche jamais davantage ici, et ce
       texte porte des chaînes écrites par d'autres joueurs. Un nombre absurde
       n'entre donc pas dans le stockage, où il servirait de borne de boucle. */
    const fm = slotTxt.match(/Flottes?\s*:?\s*(\d{1,3})\s*\/\s*(\d{1,3})/i), em = slotTxt.match(/Exp\S*\s*:?\s*(\d{1,3})\s*\/\s*(\d{1,3})/i);
    const slots = (fm || em) ? { fleet: fm ? [+fm[1], +fm[2]] : null, expo: em ? [+em[1], +em[2]] : null } : null;

    const bodyText = document.body.textContent; // une seule lecture par passage : le corps d'une page OGame est lourd
    const artTxt = clean(bodyText.match(/Art[ée]facts?\s+collect[ée]s?\s*:?\s*[\d.]+\s*\/\s*[\d.]+/i)?.[0]);
    const artefacts = artTxt ? +artTxt.match(/:?\s*([\d.]+)\s*\//)[1].replace(/\./g, '') : null;

    /* Le panneau se repère par ses deux libellés, sans sélecteur : on prend le
       plus petit bloc qui porte les deux, une rangée par ligne, cellules par tabulation. */
    let prodPanel = null;
    if (/Facteur de production/i.test(bodyText) && /Total par heure/i.test(bodyText)) {
      /* On part des éléments qui portent « Total par heure » (XPath natif, sans
         lire le texte de chaque bloc), et pour chacun on remonte jusqu'au
         premier ancêtre qui porte aussi « Facteur de production ». On garde le
         plus petit bloc trouvé.

         Prendre la première ancre et s'arrêter là suffisait tant que le libellé
         n'apparaissait qu'une fois. S'il apparaît ailleurs — infobulle, gabarit
         caché —, la remontée atteint un ancêtre énorme, parfois le corps, et on
         publierait des lignes sans rapport : le moteur se nourrirait de chiffres
         faux au lieu de ne rien lire. La casse est neutralisée des deux côtés
         pour la même raison : une majuscule changée par le jeu ferait perdre le
         panneau en silence. */
      const bas = (s) => `translate(${s}, 'ABCDEFGHIJKLMNOPQRSTUVWXYZÀÂÉÈÊËÎÏÔÙÛÜÇ', 'abcdefghijklmnopqrstuvwxyzàâéèêëîïôùûüç')`;
      const ancres = document.evaluate(`//*[text()[contains(${bas('.')}, 'total par heure')]]`,
        document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      let blk = null;
      for (let i = 0; i < ancres.snapshotLength; i++) {
        let b = ancres.snapshotItem(i);
        b = b.closest('table') || b;
        while (b && !/Facteur de production/i.test(b.textContent)) b = b.parentElement;
        if (b && (!blk || b.textContent.length < blk.textContent.length)) blk = b;
      }
      const rows = blk ? [...blk.querySelectorAll('tr')].map(r => [...r.children].map(c => clean(c.textContent)).join('\t')).filter(Boolean) : [];
      // Pas de tableau reconnu : on ne publie rien (un textContent à plat ne se découpe pas).
      if (rows.length) { prodPanel = (clean(blk.textContent.match(/Facteur de production\s*:?\s*\d+\s*%/i)?.[0]) + '\n' + rows.join('\n')).slice(0, 20000); prodWarned = false; }
      else if (!prodWarned) { prodWarned = true; console.debug('[copilote] panneau de production sans tableau reconnu'); }
    } else prodWarned = false;

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
      def,
      defs,
      moves,
      movePage: /movement/i.test(component),
      artefacts,
      prodPanel,
      lf,
      lfSeen: lfPage ? { [lfPage]: Date.now() } : null,
      slots,
      timers: unique
    };
  }

  /* Le panneau publie ce qu'il recommande ; on le montre sur la tuile. On
     n'ajoute qu'une classe et une étiquette inerte : rien n'est cliqué, rien
     n'est envoyé, et l'étiquette ne peut pas intercepter un clic. */
  let hints = {}, rates = {}, donors = {}, cargo = null, lean = false, tour = {};
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

  const RES_NOMS = ['métal', 'cristal', 'deutérium'];
  const qte = n => Math.ceil(n).toLocaleString('fr-FR');

  const MUET = { txt: '', href: '', mission: 0 };
  const shipId = k => Object.keys(OG_SHIPS).find(id => OG_SHIPS[id] === k);

  /* Le jeu remplit lui-même son formulaire de flotte quand on arrive par un
     lien qui porte les paramètres — c'est ce que fait sa page Galaxie, et ce
     que le panneau fait déjà pour ses propres actions. On ne clique donc
     rien et on n'écrit rien dans la page : on pose un lien, le joueur
     décide, le jeu fait le reste. Le trajet décrit est le premier à faire :
     la livraison, ou l'aller à vide qui amène les transporteurs. */
  function fleetHref(b) {
    const c = String(b.vers || '').match(/^(\d+):(\d+):(\d+)$/);
    if (!b.cp || !c || !b.mission) return '';
    const q = ['page=ingame', 'component=fleetdispatch', 'cp=' + b.cp,
      'galaxy=' + c[1], 'system=' + c[2], 'position=' + c[3], 'type=1', 'mission=' + b.mission];
    if (b.lc) q.push('am' + shipId('lc') + '=' + b.lc);
    if (b.sc) q.push('am' + shipId('sc') + '=' + b.sc);
    return location.pathname + '?' + q.join('&');
  }

  /* Pourquoi la ligne de livraison se tait, en un mot, pour le témoin d'état.
     Un silence sans raison affichée se diagnostique en devinant, et deviner
     a déjà coûté deux allers-retours. */
  let livNote = 'rien à dire';

  /* L'autre sortie : attendre la production locale, ou se faire livrer. Le
     panneau a publié, pour chaque planète voisine, son stock, ses
     transporteurs et le temps de vol jusqu'ici ; il reste à voir laquelle
     couvre ce qui manque. Une livraison n'est pas plafonnée par le hangar,
     donc elle vaut aussi quand l'attente est annoncée infinie — et même plus
     lente que la production, elle se dit : c'est au joueur de trancher, lui
     seul sait ce que sa flotte a d'autre à faire.
     @returns {object} { txt, href, mission } — txt vide si personne ne peut livrer */
  function delivery(miss, worst) {
    const d = donors[meta('planet-id')];
    const sum = miss.reduce((a, b) => a + b, 0);
    livNote = sum <= 0 ? 'rien ne manque' : !cargo ? 'charge ancienne' : !d ? 'aucune donneuse' : 'stock';
    if (!d || !cargo || sum <= 0) return MUET;
    let best = null;
    for (const s of d) {
      if (miss.some((m, j) => m > s.st[j])) continue;
      const lc = Math.min(s.lc, Math.ceil(sum / cargo[0]));
      const reste = sum - lc * cargo[0];
      const sc = reste > 0 ? Math.min(s.sc, Math.ceil(reste / cargo[1])) : 0;
      if (lc * cargo[0] + sc * cargo[1] < sum) { if (livNote === 'stock') livNote = 'soute trop petite'; continue; }
      // Le vol dure celui du plus lent : un seul grand transporteur dans le
      // lot et toute la flotte avance à son rythme. Et quand les vaisseaux ne
      // sont pas encore sur la planète qui donne, l'aller à vide compte aussi.
      const leg = t => Math.max(lc ? t[0] : 0, sc ? t[1] : 0);
      const sec = leg(s.sec) + leg(s.out || [0, 0]);
      if (!sec || (best && sec >= best.sec)) continue;
      best = { sec, lc, sc, n: s.n, base: s.base, cp: s.cp, vers: s.vers, mission: s.mission };
    }
    if (!best) return MUET;
    livNote = hms(best.sec);
    const flotte = [best.lc ? best.lc + ' GT' : '', best.sc ? best.sc + ' PT' : ''].filter(Boolean).join(' + ');
    const charge = miss.map((m, j) => m > 0 ? qte(m) + ' ' + RES_NOMS[j] : '').filter(Boolean).join(', ');
    const vide = best.base ? ` — à envoyer d'abord à vide depuis ${best.base}` : '';
    return {
      txt: best.sec >= worst
        ? `Livraison plus lente que ta production : ${charge} depuis ${best.n}, ${flotte}, ${hms(best.sec)} de vol${vide}`
        : `Ou fais livrer ${charge} depuis ${best.n} : ${flotte}, ${hms(best.sec)} de vol${vide}`,
      href: fleetHref(best),
      mission: best.mission
    };
  }

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
    const miss = [0, 0, 0];
    let worst = 0;
    det.querySelectorAll('.costs li.resource[data-value]').forEach(li => {
      const j = lfRes(li.className);
      if (j < 0 || have[j] == null) return;
      miss[j] = Math.max(0, (+li.dataset.value || 0) - have[j]);
      const eta = etaSecs(miss[j], r ? r[j] : 0);
      if (eta > worst) worst = eta;
    });
    const eta = !r || worst <= 0 ? ''
      : isFinite(worst) ? 'Payable dans ' + hms(worst)
      : 'Hors de portée au rythme actuel de cette planète';
    const liv = delivery(miss, worst);
    const txt = [eta, liv.txt].filter(Boolean).join('\n');
    if (!txt) { if (vieux) vieux.remove(); return; }
    // Au-dessus de la boîte de coût, pas dedans : cette boîte a sa hauteur et
    // rognait la ligne sans rien laisser voir. Ici elle tombe dans le vide au
    // milieu du panneau de détail.
    const host = costs.parentNode || costs;
    const el = vieux || host.insertBefore(document.createElement('p'), costs);
    el.className = 'copilote-eta';
    // Le texte et le lien se refont ensemble : écrire le texte efface le lien.
    const cle = txt + '|' + liv.href;
    if (el.dataset.cle !== cle) {
      el.dataset.cle = cle;
      el.textContent = txt;
      if (liv.href) {
        const a = document.createElement('a');
        a.className = 'copilote-go';
        a.href = liv.href;
        a.textContent = liv.mission === 4 ? '→ envoyer les transporteurs' : '→ préparer la livraison';
        el.appendChild(a);
      }
    }
  }

  /* La tournée : la même tuile sur les autres planètes. Monter un bâtiment sur
     tout un empire est une corvée de navigation, pas de décision — et le jeu
     accepte `openTech` dans ses URL, comme le montrent ses propres encadrés de
     production. Un lien peut donc ouvrir la bonne page, la bonne planète et la
     bonne tuile d'un coup : il reste deux clics par planète, la pastille puis
     « Améliorer ». Rien n'est cliqué ni écrit dans la page, comme partout
     ailleurs : la barre pose des liens, le joueur décide. */

  /* La tuile cliquée à la main : c'est la première planète d'une tournée, celle
     où le joueur décide ce qu'il fait le tour. Le jeu ne recharge rien en
     ouvrant une tuile, donc l'URL ne le dit pas — seul le clic le dit. */
  let tuileVue = '';

  /** La tuile dont le joueur fait le tour, ou '' quand il n'en ouvre aucune. */
  function tuileEnMain() {
    const t = new URLSearchParams(location.search).get('openTech') || tuileVue;
    return /^\d+$/.test(String(t || '')) ? String(t) : '';
  }

  function peintTour() {
    const tuile = tuileEnMain();
    const gids = Object.keys(tour).filter(g => /^\d+$/.test(g));
    /* Deux planètes au moins doivent connaître le niveau de cette tuile. C'est
       ce seuil qui écarte les recherches — une seule file pour tout l'empire —
       et les vaisseaux, dont aucune planète ne porte de niveau, sans avoir à
       tenir la liste des pages interdites. */
    const connus = gids.filter(g => ((tour[g] || {}).b || {})[tuile] != null);
    const premiere = document.querySelector('li.technology[data-technology]');
    const liste = premiere && premiere.parentNode;
    const vieille = document.querySelector('.copilote-tour');
    if (!tuile || connus.length < 2 || !liste) { if (vieille) vieille.remove(); return; }
    const comp = new URLSearchParams(location.search).get('component') || '';
    const ici = meta('planet-id');
    const pins = gids.map(g => {
      const e = tour[g], lvl = (e.b || {})[tuile];
      // Un niveau inconnu se dit : écrire 0 enverrait monter ce qui est déjà là.
      return { g, txt: e.n + ' · ' + (lvl == null ? '→' : lvl + ' → ' + (lvl + 1)), ici: g === ici };
    });
    // La barre se refait entière quand son contenu change, et se tait sinon :
    // le jeu secoue sa page à chaque tuile ouverte.
    const cle = tuile + '|' + comp + '|' + pins.map(p => p.txt + (p.ici ? '*' : '')).join(';');
    if (vieille && vieille.dataset.cle === cle) return;
    if (vieille) vieille.remove();
    const barre = liste.parentNode.insertBefore(document.createElement('div'), liste);
    barre.className = 'copilote-tour';
    barre.dataset.cle = cle;
    for (const p of pins) {
      // La planète courante n'est pas un lien : elle est déjà là.
      const n = barre.appendChild(document.createElement(p.ici ? 'span' : 'a'));
      n.className = 'copilote-pin' + (p.ici ? ' copilote-ici' : '');
      n.textContent = p.txt;
      if (!p.ici) n.href = location.pathname + '?page=ingame&component=' + comp + '&cp=' + p.g + '&openTech=' + tuile;
    }
  }

  const STYLE = `li.technology.copilote-next{position:relative;outline:2px solid #8aa9ff;outline-offset:2px;border-radius:4px}
.copilote-tag{position:absolute;top:3px;right:3px;z-index:5;pointer-events:none;max-width:calc(100% - 6px);
overflow:hidden;background:#8aa9ff;color:#0c1120;font:700 11px/1.5 Arial,sans-serif;padding:0 5px;
border-radius:4px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.5)}
.copilote-eta{position:relative;z-index:2;margin:8px 0;padding:8px 10px;white-space:pre-line;
border:1px solid rgba(138,169,255,.45);border-left:3px solid #8aa9ff;border-radius:4px;
background:#101a2b;box-shadow:0 2px 10px rgba(0,0,0,.55);
color:#e4edff;font:700 12px/1.5 Arial,sans-serif;text-shadow:none}
.copilote-eta .copilote-go{display:inline-block;margin-top:6px;padding:3px 9px;border-radius:3px;
background:#8aa9ff;color:#0c1120;font-weight:700;text-decoration:none}
.copilote-eta .copilote-go:hover{background:#c3d4ff;color:#0c1120}
.copilote-tour{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px;padding:8px 10px;
border:1px solid rgba(138,169,255,.45);border-left:3px solid #8aa9ff;border-radius:4px;
background:#101a2b;box-shadow:0 2px 10px rgba(0,0,0,.55)}
.copilote-pin{display:inline-block;padding:3px 9px;border-radius:3px;background:#8aa9ff;
color:#0c1120;font:700 12px/1.5 Arial,sans-serif;text-decoration:none;text-shadow:none}
.copilote-pin:hover{background:#c3d4ff;color:#0c1120}
.copilote-pin.copilote-ici{background:transparent;color:#e4edff;box-shadow:inset 0 0 0 1px #8aa9ff}`;

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
    peintTour();
    // Témoin lisible depuis la console de la page : le script vit dans un
    // monde isolé, donc ses variables y sont invisibles. L'heure dit s'il
    // tourne encore, le reste dit ce qu'il a reçu du panneau.
    document.documentElement.dataset.copilote = [
      new Date().toTimeString().slice(0, 8),
      'planetes=' + (Object.keys(hints).join('|') || '-'),
      'debits=' + (Object.keys(rates).join('|') || '-'),
      // Un silence de la ligne de livraison se diagnostique d'ici : qui peut
      // livrer cette planète, et avec quelle flotte.
      'donneurs=' + (!cargo ? 'charge ancienne'
        : (donors[meta('planet-id')] || []).map(s => `${s.n}:${s.lc}GT+${s.sc}PT`).join('|') || 'aucun'),
      'livraison=' + livNote,
      'ici=' + meta('planet-id'),
      'epure=' + (lean ? 1 : 0)
    ].join(' ');
  }

  try {
    const take = skin => {
      hints = (skin && skin.hints) || {};
      rates = (skin && skin.rates) || {};
      donors = (skin && skin.donors) || {};
      cargo = (skin && skin.cargo) || null;
      lean = !!(skin && skin.lean);
      tour = (skin && skin.tour) || {};
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

  /* Le jeu refait tout le panneau de détail à chaque tuile ouverte, ce qui
     emporte notre ligne : attendre le tour de garde suivant la faisait
     clignoter, absente jusqu'à cinq secondes. On repeint donc dès que la page
     bouge, en groupant les secousses — le jeu en produit à chaque seconde pour
     ses propres comptes à rebours. Repeindre n'écrit rien quand rien n'a
     changé, donc la secousse que nous causons nous-mêmes s'arrête là.
     L'envoi du relevé, lui, reste au rythme de garde : c'est le coûteux. */
  /* Un seul écouteur, par délégation : le jeu refait sa liste de tuiles à tout
     bout de champ, et un écouteur par tuile mourrait avec elle. Écouter n'est
     pas cliquer — rien n'est écrit dans la page. */
  document.addEventListener('click', e => {
    const li = e.target && e.target.closest && e.target.closest('li.technology[data-technology]');
    if (!li) return;
    tuileVue = li.dataset.technology || '';
    paint();
  });

  let bientot = null;
  new MutationObserver(() => {
    dirty = true;
    if (bientot) return;
    bientot = setTimeout(() => { bientot = null; paint(); }, 250);
  }).observe(document.body, { childList: true, subtree: true });
  send(); paint();
  setInterval(() => { send(); paint(); }, 5000);
})();
