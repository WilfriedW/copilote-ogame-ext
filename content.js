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
  let hints = {}, rates = {}, donors = {}, cargo = null, lean = false, tour = {}, band = {};
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
  /* Sur une pastille, le chiffre exact ne sert à rien : on ne décide pas d'un
     voyage à mille unités près. Le jeu écrit déjà ses coûts « 1M / 500K », on
     écrit comme lui. */
  const court = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'M'
    : n >= 1000 ? Math.round(n / 1000) + 'K' : String(Math.ceil(n));
  /* Et l'heure se dit à l'heure près, arrondie vers le haut comme `hms` :
     mieux vaut revenir un peu tard que devant une planète qui ne paie pas. */
  const bref = secs => secs >= 3600 ? Math.ceil(secs / 3600) + 'h'
    : Math.max(1, Math.ceil(secs / 60)) + 'm';

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

  /* Sans tuile ouverte, la tournée part de ce que le copilote conseille ici :
     il entoure déjà une tuile sur chaque planète. La barre est donc là dès
     l'arrivée sur la page, et elle dit « voilà ce que je conseille ici, et
     voilà où ça en est ailleurs ». Un conseil qui n'est pas sur la page
     ouverte ne compte pas : son lien ne mènerait nulle part. */
  function tuileConseillee() {
    const want = hints[meta('planet-id')] || {};
    return Object.keys(want).find(id =>
      /^\d+$/.test(id) && document.querySelector('li.technology[data-technology="' + id + '"]')) || '';
  }

  /** La tuile dont le joueur fait le tour, ou '' quand il n'y en a aucune.
      Un clic passe devant l'`openTech` de l'arrivée : il est plus récent, et
      c'est bien la tuile que le joueur regarde. Le conseil vient en dernier :
      c'est un défaut, pas un choix du joueur. */
  function tuileEnMain() {
    const t = tuileVue || new URLSearchParams(location.search).get('openTech') || tuileConseillee();
    return /^\d+$/.test(String(t || '')) ? String(t) : '';
  }

  /** Les pastilles de la tournée, ou [] quand il n'y a pas de tournée à faire. */
  function pastilles() {
    const tuile = tuileEnMain();
    const gids = Object.keys(tour).filter(g => /^\d+$/.test(g) && tour[g] && tour[g].n);
    /* Deux planètes au moins doivent connaître le niveau de cette tuile. C'est
       ce seuil qui écarte les recherches — une seule file pour tout l'empire —
       et les vaisseaux, dont aucune planète ne porte de niveau, sans avoir à
       tenir la liste des pages interdites. */
    const connus = gids.filter(g => (tour[g].b || {})[tuile] != null);
    if (!tuile || connus.length < 2) return [];
    const comp = new URLSearchParams(location.search).get('component') || '';
    const ici = meta('planet-id');
    const maintenant = Date.now();
    const pins = gids.map(g => {
      const e = tour[g], lvl = (e.b || {})[tuile];
      /* Ce qui empêche de lancer là-bas, pour n'ouvrir aucune planète pour
         rien : une file encore prise, ou un stock qui ne paie pas. Les deux
         grisent la pastille sans fermer le lien — c'est un état, pas une
         interdiction, et le joueur a le droit d'aller voir. */
      // Les cases de forme de vie ont deux files, construire et chercher : lire
      // l'une pour l'autre annonce libre une planète occupée.
      const fin = (+tuile >= 11000 ? (lfQueue(tuile) === 'lfresearch' ? e.lfr : e.lfq) : e.bq) || 0;
      const c = (e.cost || {})[tuile];
      /* Le stock part du panneau, qui ne republie que toutes les trente
         secondes et seulement ouvert sur Aujourd'hui : gelé, il grise une
         planète qui paie depuis une heure. On l'avance avec le débit, déjà
         publié par planète.
         ponytail: avance linéaire, sans plafond de hangar — à borner si une
         pastille se met à promettre ce que le hangar ne peut pas garder. */
      const heures = Math.max(0, (maintenant - (e.at || maintenant)) / 3600000);
      const debit = rates[g] || [];
      const st = (Array.isArray(e.st) ? e.st : []).map((x, i) => x + (debit[i] || 0) * heures);
      let etat = '';
      // Un temps restant ne se lit jamais pour un autre : « jusqu'à 18:17 » se
      // lit aujourd'hui, même quand la file finit demain.
      if (fin > maintenant) etat = 'file ' + bref((fin - maintenant) / 1000);
      else if (Array.isArray(c)) {
        // La plus grosse ressource manquante suffit à nommer ce qui bloque ;
        // le délai, lui, est celui de la dernière à tomber.
        let pire = 0, j = -1, eta = 0;
        c.forEach((x, i) => {
          const m = x - (st[i] || 0);
          if (m > pire) { pire = m; j = i; }
          const e = etaSecs(m, debit[i] || 0);
          if (e > eta) eta = e;
        });
        // Un prix que le panneau ne connaît pas ne fait manquer personne.
        if (j >= 0) etat = 'manque ' + court(pire) + ' ' + RES_NOMS[j] + ' · '
          + (isFinite(eta) ? 'payable dans ' + bref(eta) : 'hors de portée');
      }
      // Un niveau inconnu se dit : écrire 0 enverrait monter ce qui est déjà là.
      return { ici: g === ici, gris: !!etat,
        txt: e.n + ' · ' + (lvl == null ? '→' : lvl + ' → ' + (lvl + 1)) + (etat ? ' · ' + etat : ''),
        href: g === ici ? '' : location.pathname + '?page=ingame&component=' + encodeURIComponent(comp)
          + '&cp=' + g + '&openTech=' + tuile };
    });
    return pins;
  }
   /* Une seule bande, et ce qu'elle porte dépend de la page. Le panneau est
     déjà à côté du joueur : lui répéter ses minuteurs et ses alertes en bas de
     page ne lui apprend rien. Ce que le panneau ne peut pas dire, c'est ce qui
     se fait ici — les actions du plan et les missions du jour qui se lancent
     sur la page ouverte, et la tournée de la tuile en main.
     Elle se pose au-dessus des tuiles quand la page en a, et en bas de la
     colonne sinon : une bande à la fois, là où les yeux sont. */
  function peintBande() {
    const comp = new URLSearchParams(location.search).get('component') || '';
    const lignes = ((band || {}).pages || {})[comp] || [];
    const pins = pastilles();
    const premiere = document.querySelector('li.technology[data-technology]');
    const liste = premiere && premiere.parentNode;
    const hote = liste ? liste.parentNode : document.getElementById('middle');
    const vieille = document.querySelector('.copilote-bande');
    if (!hote || (!lignes.length && !pins.length)) { if (vieille) vieille.remove(); return; }
    const cle = JSON.stringify([comp, lignes, pins.map(p => p.txt + (p.ici ? '*' : ''))]);
    if (vieille && vieille.dataset.cle === cle) return;
    if (vieille) vieille.remove();
    const hud = document.createElement('div');
    hud.className = 'copilote-bande';
    hud.dataset.cle = cle;
    const zone = (nom, titre) => {
      const z = hud.appendChild(document.createElement('div'));
      z.className = 'copilote-zone';
      z.dataset.zone = nom;
      // le titre se dessine en CSS : ce n'est pas une ligne de la zone
      z.dataset.titre = titre;
      return z;
    };
    if (lignes.length) {
      const z = zone('ici', 'à faire sur cette page');
      for (const l of lignes) {
        const n = z.appendChild(document.createElement(l.url ? 'a' : 'div'));
        // grisée quand le plan ne peut pas encore la payer : un état, pas une
        // interdiction — la page reste à un clic
        n.className = 'cb-l' + (l.gris ? ' copilote-gris' : '');
        /* L'heure tient en un seul morceau : sans espaces insécables, « vers »
           reste accroché à l'action et l'heure tombe seule à la ligne suivante. */
        n.textContent = l.what + (l.ou ? ' · ' + l.ou : '')
          + (l.quand ? ' ·\u00a0' + l.quand.replace(/ /g, '\u00a0') : '');
        // le pourquoi tient dans l'infobulle : quatre lignes de raisons
        // rendraient la bande illisible, et elle se lit d'un coup d'œil
        if (l.why) n.title = l.why;
        if (l.url) n.href = l.url;
      }
    }
    if (pins.length) {
      const z = zone('tour', 'la même tuile ailleurs');
      for (const p of pins) {
        const n = z.appendChild(document.createElement(p.href ? 'a' : 'span'));
        n.className = 'copilote-pin' + (p.ici ? ' copilote-ici' : '') + (p.gris ? ' copilote-gris' : '');
        n.textContent = p.txt;
        if (p.href) n.href = p.href;
      }
    }
    if (liste) hote.insertBefore(hud, liste); else hote.appendChild(hud);
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
.copilote-pin.copilote-ici{background:transparent;color:#e4edff;box-shadow:inset 0 0 0 1px #8aa9ff}
.copilote-pin.copilote-gris{background:transparent;color:#9fb2d4;font-weight:400;
box-shadow:inset 0 0 0 1px rgba(138,169,255,.3)}
.copilote-pin.copilote-gris:hover{background:rgba(138,169,255,.14);color:#e4edff}
.copilote-bande .cb-l.copilote-gris{color:#9fb2d4;font-weight:400}
.copilote-bande{display:flex;flex-wrap:wrap;gap:14px;
margin:10px 0 18px;padding:10px 12px;border:1px solid rgba(138,169,255,.45);
border-left:3px solid #8aa9ff;background:#101a2b;box-shadow:0 2px 10px rgba(0,0,0,.55);
font:400 12px/1.6 Arial,sans-serif;color:#e4edff;text-shadow:none}
.copilote-zone{min-width:0}
.copilote-zone[data-zone="ici"]{flex:1 1 340px}
.copilote-zone[data-zone="tour"]{flex:1 1 340px;display:flex;flex-wrap:wrap;gap:6px;align-content:flex-start}
.copilote-zone[data-zone="tour"]::before{flex:0 0 100%}
.copilote-zone + .copilote-zone{border-left:1px solid rgba(138,169,255,.18);padding-left:14px}
.copilote-zone::before{content:attr(data-titre);display:block;margin-bottom:4px;
font-size:11px;letter-spacing:.08em;color:#8aa9ff}
.copilote-bande .cb-f{font-weight:700;color:#e4edff}
.copilote-bande .cb-n{color:#9fb2d4}
.copilote-bande .cb-a{color:#f0997b}
.copilote-bande .cb-l{display:block;color:#8aa9ff;text-decoration:none;font-weight:700}
.copilote-bande .cb-l:hover{color:#c3d4ff}`;

  /* Recharger l'extension sans recharger la page réinjecte ce script : le code
     est neuf, mais le <style> posé par la version d'avant est toujours dans la
     page. Le garder laissait les éléments neufs sans aucune règle — une barre
     et une bande en texte brut. On repose donc la feuille une fois par vie du
     script, en retirant celle qu'on trouve. */
  let styleFait = false;

  function paint() {
    if (!styleFait) {
      styleFait = true;
      const vieille = document.getElementById('copilote-style');
      if (vieille) vieille.remove();
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
    peintBande();
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
      /* Une barre absente a trois causes : la tournée n'est pas publiée (le
         panneau n'a pas été ouvert sur Aujourd'hui depuis la mise à jour),
         aucune tuile n'est ouverte, ou moins de deux planètes connaissent son
         niveau. Le témoin dit les deux premières d'un coup d'œil. */
      'tournee=' + (tuileEnMain() || '-') + ':' + Object.keys(tour).length,
      // `sans-middle` : la colonne du jeu n'a pas été trouvée, la bande n'a
      // nulle part où se poser ; `rien` : elle n'a rien à dire.
      'bande=' + (!document.getElementById('middle') ? 'sans-middle'
        : !document.querySelector('.copilote-bande') ? 'rien'
        : (((band || {}).pages || {})[new URLSearchParams(location.search).get('component') || ''] || []).length
          + ':' + pastilles().length),
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
      band = (skin && skin.band) || {};
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
