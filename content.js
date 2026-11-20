(() => {
  // Marqueur de présence : l'extension s'en sert pour savoir si cet onglet a
  // déjà son script avant d'en réinjecter un, et ne jamais en empiler deux.
  if (window.__copilote) return;
  window.__copilote = 1;
  /* Ce marqueur ne tient que dans un monde : recharger l'extension sans
     recharger la page donne au script neuf un monde neuf, où il est seul, et
     l'ancien continue pourtant de battre dans le sien. Les deux partagent le
     document : c'est par là qu'ils s'annoncent, tout en bas de ce fichier.
     Jusque-là, on est vivant. */
  let vivant = true;

  const meta = n => document.querySelector(`meta[name="ogame-${n}"]`)?.content;

  /* Les pages du jeu que le copilote connaît : celles où ses propres liens
     mènent. Tout le reste — alliance, messages, boutique, et ce que le jeu
     ajoutera — ne reçoit rien. Une liste d'autorisés ne se contourne pas, là
     où une liste d'interdits se contourne en nommant la page autrement. */
  const PAGES_COPILOTE = ['overview', 'supplies', 'facilities', 'research', 'shipyard',
    'defenses', 'fleetdispatch', 'galaxy', 'movement', 'lfbuildings', 'lfresearch'];

  /**
   * La page ouverte, lue une seule fois pour tout le script.
   * Le jeu la nomme dans `component`, et dans `page` sur ses pages anciennes.
   * Une URL qui en nomme plusieurs ne se tranche pas : le serveur pourrait
   * retenir l'autre, et nous dessinerions sur une page que nous croyons être
   * une autre. On ne devine pas, on se tait.
   * @returns {string} le nom de la page, ou '' si l'URL n'en désigne pas une seule
   */
  function pageCourante() {
    const qs = new URLSearchParams(location.search);
    const vues = qs.getAll('component').concat(qs.getAll('page'))
      .map(v => String(v).trim().toLowerCase())
      .filter(v => v && v !== 'ingame');
    return vues.length === 1 ? vues[0] : '';
  }
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
    const component = pageCourante();

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
      // La page lue, pour que le panneau sache quel arrêt de son relevé vient d'arriver.
      page: component,
      movePage: /movement/i.test(component),
      artefacts,
      prodPanel,
      /* Le lien que le jeu affiche vers « Paramétrage de la production ». Le
         relevé ne devine pas cette adresse — selon la version elle s'ouvre par
         `component=` ou par `page=` — il reprend celle du jeu. Mais le DOM
         contient aussi ce que d'autres joueurs y écrivent (messages, pages
         d'alliance) : on ne garde pas l'adresse lue, on la reconstruit à partir
         de la seule chose qu'on en accepte, la forme du paramètre. */
      prodUrl: prodLink(),
      lf,
      lfSeen: lfPage ? { [lfPage]: Date.now() } : null,
      /* Le menu du jeu dit, sur n'importe quelle page, si cet univers a des
         formes de vie. C'est un fait du compte, pas du poste : sans lui, un
         deuxième ordinateur devait rouvrir une page de forme de vie à la main
         avant que le relevé accepte d'y passer. On ne lit que la forme du
         paramètre dans les liens du menu, rien de ce qui est écrit dedans. */
      lfMenu: lfAuMenu(),
      slots,
      timers: unique
    };
  }

  /**
   * Cet univers offre-t-il les pages de forme de vie ? Lu dans le menu du jeu.
   * @returns {boolean|null} null quand la page n'a pas de menu : on ne sait pas
   */
  function lfAuMenu() {
    const menu = document.getElementById('menuTable');
    if (!menu) return null;
    return [...menu.querySelectorAll('a[href]')]
      .some(a => /[?&]component=lf[a-z]*(&|$)/i.test(a.getAttribute('href') || ''));
  }

  /**
   * Adresse du paramétrage de la production, reconstruite : même origine, même
   * chemin, et rien d'autre que `page`/`component` tels que le jeu les écrit.
   * @returns {string|null}
   */
  function prodLink() {
    const a = document.querySelector('a[href*="esourcesettings" i]');
    if (!a) return null;
    try {
      const ici = new URL(location.href), u = new URL(a.href, location.href);
      if (u.origin !== ici.origin || u.pathname !== ici.pathname) return null;
      const comp = u.searchParams.get('component'), page = u.searchParams.get('page');
      const v = new URL(ici.origin + ici.pathname);
      if (/^resourcesettings$/i.test(comp || '') && /^ingame$/i.test(page || '')) {
        v.searchParams.set('page', 'ingame'); v.searchParams.set('component', comp);
      } else if (!comp && /^resourcesettings$/i.test(page || '')) {
        v.searchParams.set('page', page);
      } else return null;
      return v.href;
    } catch (e) { return null; }
  }

  /* Le panneau publie ce qu'il recommande ; on le montre sur la tuile. On
     n'ajoute qu'une classe et une étiquette inerte : rien n'est cliqué, rien
     n'est envoyé, et l'étiquette ne peut pas intercepter un clic. */
  let prio = {}, asks = [], hints = {}, rates = {}, donors = {}, cargo = null, lean = false, tour = {}, band = {}, noshop = false, large = false, peau = false, clair = false, colonne = [], teintes = {};
  /* Chaque règle vise un bloc nommé, repéré sur la page, et ne fait que le
     masquer. Elles ne s'appliquent que si le joueur a coché « Épurer », et
     décocher les retire toutes d'un coup. */
  /* Épurer, c'est quatre gestes, et aucun ne redessine quoi que ce soit : on
     enlève ce qui parasite la lecture et on laisse la page du jeu telle
     qu'elle est. C'est ce qui se répare tout seul quand Gameforge bouge
     quelque chose — on ne lit ici que quatre identifiants. */
  const LEAN = `html.copilote-lean #mmonetbar,
html.copilote-lean #siteHeader,
html.copilote-lean #siteFooter{display:none}
/* Le fond du jeu est une photo posée sur le corps de la page : elle se voit
   entre les panneaux et derrière le texte des listes. On garde l'aplat.
   La peau repose le sien par-dessus — même règle, plus bas dans la feuille. */
html.copilote-lean body{background-image:none !important;background-color:var(--cp-fond) !important}
/* La bannière du jeu : 160 px sur 600 au flanc de la page. */
html.copilote-lean #bannerskyscrapercomponent{display:none}
/* Le menu grossit d'un septième. Un zoom, et non une taille de police : le
   jeu dessine ses entrées sur des images de fond à hauteur fixe, et le texte
   seul, grossi, débordait de son bouton. Sous la peau, c'est le rail qui
   prend le relais — inutile d'agrandir ce qui est hors de l'écran. */
/* Grossi, le menu déborde de son couloir : le jeu lui laisse 170 px entre
   le bord et la page, et un septième de plus en fait 199. On le décale
   d'autant vers la gauche, dans la marge de l'écran — sans quoi sa colonne
   d'icônes passait par-dessus les panneaux du jeu. Le décalage est écrit
   avant le zoom, qui le grossit lui aussi : 26 px deviennent 30.
   Cette marge n'existe qu'au-delà de 1056 px de fenêtre — la page du jeu en
   fait 996, centrées. En dessous, le menu garde sa taille : mieux vaut un
   menu normal qu'un menu rogné par le bord de l'écran. */
@media (min-width:1060px){
  html.copilote-lean:not(.copilote-peau) #links{margin-left:-26px;zoom:1.15}
}
.copilote-menu a, .copilote-menu a .textlabel, a.copilote-menu, a.copilote-menu .textlabel{color:var(--cm) !important}`;

  /* La largeur. Le jeu range sa page dans un cadre étroit et centré : sur un
     écran large, deux bandes mortes à gauche et à droite, et des cases à six
     par ligne alors que la place existe. Rien n'est déplacé ici — le cadre
     s'étale, et chaque colonne prend ce qu'il lui faut.
     La colonne du jeu ne s'étire pas : elle épouse son contenu, plafonnée à
     `--copilote-jeu`. Une page à cases y gagne — ses listes, libérées de
     leur largeur fixe, étalent leurs cases sur une ligne — tandis qu'une page
     à tableau, Galaxie, garde sa taille et laisse la liste des planètes se
     ranger juste à côté plutôt qu'au bout de l'écran.
     `!important` est partout obligatoire : le jeu fixe ces largeurs par
     identifiant, et aucune classe ne bat un identifiant. */
  const LARGE = `html.copilote-large{--copilote-jeu:1400px}
html.copilote-large .copilote-cadre{display:flex !important;flex-wrap:wrap;align-items:flex-start;
width:auto !important;max-width:none !important;margin-left:0 !important;margin-right:0 !important}
html.copilote-large .copilote-rang{flex:0 0 100%;min-width:0;position:relative}
html.copilote-large .copilote-col-menu,
html.copilote-large .copilote-col-planetes{flex:0 0 auto}
html.copilote-large .copilote-col-jeu{flex:0 1 auto;min-width:0;
width:auto !important;max-width:var(--copilote-jeu);
margin-left:0 !important;margin-right:0 !important}
html.copilote-large #middle .maincontent,
html.copilote-large #technologies,
html.copilote-large #technologies > ul,
html.copilote-large ul.icons{width:auto !important;max-width:none !important}`;

  /* ---------- les heures du jeu, dans la zone du joueur ----------

     Le jeu écrit ses heures dans celle de son serveur. À onze heures d'écart,
     chaque arrivée de flotte demande un calcul de tête, et c'est la nuit
     qu'on se trompe. On réécrit donc les heures que le jeu marque d'un
     instant : le chiffre vient de l'attribut, jamais du texte lu.

     Deux garde-fous. On ne remplace un texte que s'il dit exactement l'heure
     que le serveur donnerait à cet instant-là : sinon on passe, et rien ne
     bouge. Et l'heure du serveur reste à portée de souris, dans l'infobulle,
     parce qu'une alliance se donne rendez-vous dans celle-là.

     L'horloge du jeu n'est pas touchée : elle se réécrit chaque seconde et
     efface ce qu'on y pose — essayé, elle avale tout en trois secondes.
     C'est donc elle qui reste le repère en heure serveur. */

  const d2 = n => String(n).padStart(2, '0');

  /** Le décalage du serveur sur UTC, en secondes, ou null s'il ne se lit pas. */
  function decalageServeur() {
    /* L'instant de naissance de la page, que le jeu écrit en clair, et la
       même seconde telle que son horloge l'affiche : entre les deux, le
       décalage. On ne devine rien du pays du serveur. */
    const meta = document.querySelector('meta[name="ogame-timestamp"]');
    const epoch = meta && Number(meta.content);
    if (!epoch) return null;
    const horloge = document.querySelector('.OGameClock');
    const t = horloge && (horloge.textContent || '').match(/(\d{1,2}):(\d{2}):(\d{2})/);
    if (!t) return null;
    let d = (+t[1]) * 3600 + (+t[2]) * 60 + (+t[3]) - (epoch % 86400);
    if (d > 43200) d -= 86400; else if (d < -43200) d += 86400;
    /* L'horloge a pu avancer d'une seconde ou deux depuis que la page est
       née. Les fuseaux allant par quart d'heure, on arrondit au quart. */
    return Math.round(d / 900) * 900;
  }

  /** L'heure d'un instant telle que le serveur l'écrit. */
  function heureServeur(epoch, dec, avecSec) {
    const j = (epoch + dec) % 86400;
    return d2(Math.floor(j / 3600)) + ':' + d2(Math.floor(j % 3600 / 60))
      + (avecSec ? ':' + d2(j % 60) : '');
  }

  /** La même, à la montre du joueur. */
  function heureIci(epoch, avecSec) {
    const d = new Date(epoch * 1000);
    return d2(d.getHours()) + ':' + d2(d.getMinutes())
      + (avecSec ? ':' + d2(d.getSeconds()) : '');
  }

  /** Réécrit à l'heure du joueur ce que le jeu date d'un instant précis. */
  function heuresIci() {
    const dec = decalageServeur();
    if (dec == null) return;
    // Le joueur vit à l'heure du serveur : il n'y a rien à traduire.
    if (dec === -new Date().getTimezoneOffset() * 60) return;
    document.querySelectorAll('[data-arrival-time]').forEach(cadre => {
      const epoch = Number(cadre.getAttribute('data-arrival-time'));
      if (!epoch) return;
      for (const n of [cadre, ...cadre.querySelectorAll('*')]) {
        if (n.children.length) continue;
        const txt = (n.textContent || '').trim();
        /* Le texte doit dire l'heure du serveur pour cet instant-là, à la
           seconde ou à la minute. Tout le reste — une durée, un compte à
           rebours, un nombre de vaisseaux — ne ressemble pas et ne bouge pas. */
        const avecSec = txt.length > 5;
        if (txt !== heureServeur(epoch, dec, avecSec)) continue;
        n.textContent = heureIci(epoch, avecSec);
        n.title = 'heure du serveur : ' + txt;
        n.classList.add('copilote-heure');
      }
    });
  }

  /* Le menu du jeu. Trois gestes, et rien d'autre : une entrée de plus vers
     Mouvements de flotte, les entrées payantes masquées quand le joueur le
     demande, un peu de couleur sur les autres — le gris sur gris du jeu se
     lit mal, et la couleur dit du même coup de quelle famille est la page.

     On ne nomme aucune page à la main : le lien de chaque entrée porte déjà
     le nom de sa page, et le jaune des boutiques est celui que le jeu leur
     donne. Gameforge peut donc renommer sa boutique sans rien casser ici. */
  const MENU_COULEURS = {
    overview: '#cfe0ff', supplies: '#f0b37b', facilities: '#f0b37b',
    lfbuildings: '#9ad6a0', lfresearch: '#9ad6a0', lfbonuses: '#9ad6a0',
    research: '#c7a6ff', shipyard: '#8aa9ff', defenses: '#8aa9ff',
    fleetdispatch: '#7fe0d0', movement: '#7fe0d0', galaxy: '#7fe0d0',
    empire: '#e4edff', alliance: '#e4edff'
  };
  /** La page que vise un lien du menu, ou '' quand son URL n'en nomme pas. */
  const compDuLien = a => ((a.getAttribute('href') || '').match(/component=([a-z]+)/i) || ['', ''])[1].toLowerCase();
  /* Le menu se trouve par son identifiant, et par rien d'autre. Chercher
     ailleurs « une liste qui porte un lien Flotte » ramasserait, sur une page
     écrite par les joueurs, un lien écrit par eux — et c'est celui-là qu'on
     recopierait en entrée de menu. Si Gameforge renomme son `#menuTable`, le
     témoin le dit et on se tait : c'est le bon silence. */
  const leMenu = () => document.getElementById('menuTable');
  /** La case d'une entrée : son <li>, ou le lien lui-même si le menu n'en a pas. */
  const caseDuLien = a => a.closest('li') || a;
  /** Vrai dès qu'un morceau de l'entrée est peint en jaune par le jeu. */
  function entreeJaune(a) {
    return [a, ...a.querySelectorAll('*')].some(n => {
      const c = (getComputedStyle(n).color.match(/\d+/g) || []).map(Number);
      return c.length >= 3 && c[0] > 150 && c[1] > 120 && c[2] < 90;
    });
  }
  /* L'entrée est une copie de celle du jeu : même balisage, même habillage,
     et elle suivra le jour où Gameforge redessinera son menu. Seuls l'adresse
     et le texte changent ; les identifiants partent, le jeu retrouve les siens
     par eux. */
  function ajouteMouvement(menu) {
    if (menu.querySelector('.copilote-menu-ajout')) return;
    const src = menu.querySelector('a[href*="component=fleetdispatch"]');
    const li = src && caseDuLien(src);
    if (!li) return;
    /* L'adresse se relit avant d'être reposée : on ne recopie une entrée de
       menu que si elle mène à une page de ce serveur. Un `href` d'une autre
       forme — un autre domaine, un `javascript:` — n'en est pas une. Et elle
       se rebâtit par ses paramètres, pas par un remplacement de texte. */
    let u;
    try { u = new URL(src.getAttribute('href'), location.href); } catch (e) { return; }
    if (u.origin !== location.origin) return;
    u.searchParams.set('component', 'movement');
    const href = u.pathname + u.search;
    const copie = li.cloneNode(true);
    copie.classList.add('copilote-menu-ajout');
    copie.removeAttribute('id');
    copie.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
    /* Tous les liens de la copie, et la copie elle-même si c'est un lien : le
       jeu en pose parfois deux sur une entrée, l'icône et le texte. N'en
       changer qu'un enverrait un clic sur deux à la page de flotte. */
    const liens = [copie, ...copie.querySelectorAll('a[href]')]
      .filter(n => n.tagName === 'A' && n.getAttribute('href'));
    if (!liens.length) return;
    liens.forEach(a => { a.setAttribute('href', href); a.title = 'Mouvements de flotte'; });
    renomme(copie, clean(src.textContent));
    li.after(copie);
  }
  /** Les nœuds de texte d'un élément, dans l'ordre où ils se lisent. */
  const textes = n => [...n.childNodes].flatMap(c => c.nodeType === 3 ? [c] : textes(c));
  /* Le libellé n'est pas toujours dans le lien : le jeu le pose parfois à côté,
     et l'écrire dans le lien laissait « Flotte » à l'écran. On cherche donc le
     texte que portait l'entrée d'origine, où qu'il soit, et on ne touche qu'à
     lui — le reste de la copie tient l'icône et l'habillage. */
  function renomme(copie, ancien) {
    const txts = textes(copie).filter(t => clean(t.nodeValue));
    const cible = txts.find(t => clean(t.nodeValue) === ancien) || txts[0];
    if (cible) { cible.nodeValue = 'Mouvement de flotte'; return; }
    const el = copie.querySelector('.textlabel');
    if (el) el.textContent = 'Mouvement de flotte';
  }
  /* Le menu du jeu est le seul morceau de page que le copilote retouche sans
     l'avoir lu ailleurs : si Gameforge renomme son `#menuTable`, tout se tait.
     Le témoin le dit, plutôt que de laisser chercher. */
  let menuEtat = 'absent';
  /** Repose le menu : l'entrée ajoutée, les payantes cachées, les autres colorées. */
  function peintMenu() {
    const menu = leMenu();
    if (!menu) { menuEtat = 'absent'; return; }
    ajouteMouvement(menu);
    let payantes = 0;
    menu.querySelectorAll('a[href]').forEach(a => {
      const li = caseDuLien(a);
      /* Le jaune se lit une fois : une entrée cachée n'a plus de couleur à
         montrer, et la nôtre ne doit pas être reprise pour celle du jeu. */
      if (!li.classList.contains('copilote-paye') && !li.classList.contains('copilote-menu')
          && !li.classList.contains('copilote-menu-ajout') && entreeJaune(a)) {
        li.classList.add('copilote-paye');
      }
      if (li.classList.contains('copilote-paye')) {
        payantes++;
        li.style.display = noshop ? 'none' : '';
        return;
      }
      const c = MENU_COULEURS[compDuLien(a)];
      if (c) { li.classList.add('copilote-menu'); li.style.setProperty('--cm', c); }
    });
    menuEtat = (menu.querySelector('.copilote-menu-ajout') ? 'ok' : 'sans-flotte') + ':' + payantes + 'payantes';
  }

  /* Le cadre du jeu ne se nomme pas : un identifiant peut changer, et une page
     d'alliance porte du balisage écrit par d'autres joueurs. Il se déduit de
     deux morceaux que le jeu pose lui-même de part et d'autre de son contenu —
     le menu et la liste des planètes : leur plus proche ancêtre commun est le
     cadre, et les enfants directs qui les portent sont les colonnes. Faute de
     l'un des deux, ou d'une colonne sur trois, rien ne bouge : une mise en
     page à moitié posée serait pire que celle du jeu. */
  let largeEtat = 'éteint', leCadre = null;
  /** Marque le cadre du jeu et ses trois colonnes, ou laisse la page intacte. */
  function poseLargeur() {
    const comp = pageCourante();
    /* La peau amène la largeur avec elle : sa grille, dans la colonne étroite
       du jeu, retomberait à trois cases par ligne, et ses deux flancs n'ont
       de place nulle part ailleurs. Elle ne l'amène que sur les pages qu'elle
       habille — ailleurs, le réglage seul décide. */
    /* Deux listes d'autorisés, pas une interdiction : le réglage de largeur
       garde la sienne — les pages où le copilote conseille — et la peau
       apporte la sienne, plus large, qui va jusqu'à Empire et Alliance.
       Une page absente des deux ne reçoit rien. */
    const ici = (large && PAGES_COPILOTE.indexOf(comp) >= 0)
      || (peau && PAGES_CADRE.indexOf(comp) >= 0);
    /* Un seul interrupteur, sur la racine : l'ôter rend au jeu sa page, sans
       rien à défaire. */
    document.documentElement.classList.toggle('copilote-large', ici);
    if (!ici) { largeEtat = large ? 'hors page' : 'éteint'; leCadre = null; return; }
    const menu = leMenu(), milieu = document.getElementById('middle');
    if (!menu || !milieu) { largeEtat = menu ? 'sans contenu' : 'sans menu'; return; }
    /* Le cadre se déduit de deux morceaux qui ne bougent jamais : le menu et
       la colonne du contenu. La liste des planètes ferait un troisième repère
       naturel, mais la peau la déménage sous le menu — s'en servir ici, c'est
       perdre le cadre à la seconde où elle part. */
    const hauts = new Set();
    for (let x = menu; x && x !== document.body; x = x.parentNode) hauts.add(x);
    let cadre = null;
    for (let x = milieu; x && x !== document.body; x = x.parentNode) {
      if (hauts.has(x)) { cadre = x; break; }
    }
    if (!cadre) { largeEtat = 'sans cadre'; return; }
    const colonne = n => { let x = n; while (x && x.parentNode !== cadre) x = x.parentNode; return x; };
    /* Une colonne déjà marquée se retrouve à sa marque : celle des planètes
       n'a plus de planètes dedans une fois la liste déménagée. */
    const marquee = c => [...cadre.children].find(n => n.classList.contains(c));
    const planetes = document.getElementById('planetList');
    const gauche = colonne(menu), jeu = colonne(milieu);
    const droite = marquee('copilote-col-planetes') || (planetes && colonne(planetes));
    if (!droite) { largeEtat = 'sans planètes'; return; }
    if (!gauche || !droite || !jeu || gauche === droite || jeu === gauche || jeu === droite) {
      largeEtat = 'sans colonnes'; return;
    }
    cadre.classList.add('copilote-cadre');
    gauche.classList.add('copilote-col-menu');
    droite.classList.add('copilote-col-planetes');
    jeu.classList.add('copilote-col-jeu');
    /* Le cadre porte plus que ses trois colonnes : le jeu y range aussi sa
       barre de ressources et son en-tête, qui n'ont rien à faire dans un
       flanc. Tout ce qui n'est pas une colonne prend donc sa propre ligne —
       sans qu'on ait à savoir ce que c'est, ni combien il y en a. */
    for (const n of cadre.children) {
      if (n === gauche || n === droite || n === jeu) continue;
      // notre propre colonne est une colonne, pas une rangée
      if (n.classList.contains('cp-colonne')) continue;
      n.classList.add('copilote-rang');
    }
    leCadre = cadre;
    largeEtat = 'posé';
  }

  /* La peau : notre dessin de la page, à la place de celui du jeu. Un essai,
     sur une seule page — celle où le joueur passe ses journées.
     Rien n'est supprimé. Le contenu du jeu reste dans la page, poussé hors de
     l'écran, et chaque case que nous dessinons clique la sienne : le jeu
     accroche ses actions en jQuery et les envoie avec un jeton, que nous
     n'avons pas à connaître. Son panneau de détail n'est pas redessiné non
     plus, il est déplacé chez nous — il porte le bouton qui construit. Le
     refaire, ce serait réécrire le protocole du jeu, et le premier changement
     de jeton nous laisserait avec un bouton mort. Le jeu le pose en absolu,
     pour le faire flotter sur son illustration ; sous notre grille il revient
     dans le flux, et c'est tout ce qu'on lui change.
     Faute de cases, la peau se retire : la page du jeu reparaît entière. */
  /* Les pages à cases. Elles partagent le même balisage — des listes de cases
     coiffées d'un titre, chacune avec son niveau et son panneau de détail —
     donc un seul dessin les couvre toutes, Bâtiments des formes de vie
     compris.
     Deux pages du jeu ressemblent à celles-là sans en être : Recherche des
     formes de vie a des cases sans niveau et sans panneau de détail — nos
     cartes n'y diraient qu'un nom et un tiret, et le clic ne mènerait nulle
     part ; Bonus des formes de vie n'a pas de cases du tout. Flotte et
     Galaxie, elles, sont des formulaires : les refaire serait refaire le
     jeu. */
  const PAGES_PEAU = ['supplies', 'facilities', 'research', 'shipyard', 'defenses', 'lfbuildings'];
  /* Le cadre va plus loin que la grille : il ne sait rien du contenu, donc il
     vaut pour toute page que le copilote connaît. Flotte, Mouvement, Galaxie,
     Empire et Alliance gardent leur contenu — ce sont des formulaires et des
     tableaux, qui appartiennent au jeu — et prennent le rail, les planètes et
     la colonne. Rien n'est écrit dans leur contenu, pas même sur Alliance,
     où il vient d'autres joueurs. */
  const PAGES_CADRE = PAGES_PEAU.concat(
    ['overview', 'fleetdispatch', 'movement', 'galaxy', 'empire', 'alliance', 'combatsim']);
  const PEAU = `/* Les couleurs de la peau, en un seul endroit. Le sombre est celui du jeu ;
   le clair est celui du panneau, pour que les deux se ressemblent. Seules
   ces valeurs changent : pas une règle plus bas ne connaît une couleur. */
html{--cp-fond:#070b16;--cp-surface:#101a2b;--cp-surface2:#131c30;
--cp-creux:#0c1120;--cp-survol:#16203a;--cp-ligne:#28335a;
--cp-texte:#e4edff;--cp-doux:#9fb2d4;--cp-faible:#8e98b8;
--cp-accent:#8aa9ff;--cp-accent-vif:#c3d4ff;
--cp-bon:#4fdeb0;--cp-bon-fond:rgba(79,222,176,.14);
--cp-attention:#ffc95c;--cp-mauvais:#ff7a8a;
--cp-voile:rgba(12,17,32,.85);--cp-ombre:rgba(6,9,18,.72);
--cp-ombre-portee:rgba(0,0,0,.6)}
html.copilote-peau.copilote-clair{--cp-fond:#eef1f8;--cp-surface:#ffffff;--cp-surface2:#f3f5fb;
--cp-creux:#e9edf7;--cp-survol:#e3e9f8;--cp-ligne:#d6dcec;
--cp-texte:#141a2c;--cp-doux:#4a5570;--cp-faible:#6b7389;
--cp-accent:#3d5fd6;--cp-accent-vif:#2746b5;
--cp-bon:#0f9a70;--cp-bon-fond:rgba(15,154,112,.12);
--cp-attention:#b07800;--cp-mauvais:#c8354a;
--cp-voile:rgba(255,255,255,.85);--cp-ombre:rgba(20,26,44,.45);
--cp-ombre-portee:rgba(20,26,44,.22)}
html.copilote-peau body{background-image:none !important;background-color:var(--cp-fond) !important}
html.copilote-peau .copilote-rail-hote > *:not(.cp-rail),
html.copilote-peau .copilote-col-menu > *:not(.copilote-chemin),
html.copilote-peau .copilote-col-planetes > *:not(.copilote-chemin){
position:absolute !important;left:-99999px !important;top:0 !important;width:160px !important}
/* Le flanc est un panneau, comme les cases de la barre du haut : un aplat,
   un liseré, et les modules dedans. Sa largeur a un plancher — la liste des
   planètes du jeu mesure 147 px et ne se rétrécit pas : vidée de sa largeur,
   elle se replie à zéro. On s'arrête donc juste au-dessus. */
/* La largeur du rail, c'est celle de son entrée la plus longue : aucune ne
   revient à la ligne, et pas un pixel n'est pris pour rien. Elle suit donc
   la langue du joueur — « Mouvement de flotte » ici, autre chose ailleurs.
   Deux bornes : la liste des planètes du jeu mesure 147 px et ne se rétrécit
   pas, et au-delà de 320 px un menu n'apprend plus rien de plus. */
html.copilote-peau .copilote-col-menu{width:max-content !important;
min-width:190px;max-width:320px}
/* Le jeu fait flotter ses blocs de menu : un flottant se rétracte sur son
   contenu, et le rail restait étroit dans une colonne large. */
html.copilote-peau .copilote-col-menu .copilote-chemin,
html.copilote-peau .copilote-col-menu #links{float:none !important;
width:100% !important;max-width:100% !important}
.cp-rail{display:flex;flex-direction:column;gap:0;box-sizing:border-box;
margin:0 6px;padding:8px 0 10px;background:var(--cp-surface);border:1px solid var(--cp-ligne);border-radius:8px}
.cp-rail .cp-lien{display:flex;align-items:center;gap:8px;padding:7px 12px;color:var(--cm,var(--cp-texte));
text-decoration:none;text-shadow:none;font:600 12px/1.35 Arial,sans-serif;letter-spacing:.03em;
white-space:nowrap;border-left:3px solid transparent;border-radius:0 4px 4px 0}
.cp-rail .cp-lien:hover{background:var(--cp-survol);color:var(--cp-texte)}
.cp-rail .cp-lien.cp-ici{background:var(--cp-survol);border-left-color:var(--cp-accent)}
/* la touche qui mène ici, dite sur le lien lui-même */
.cp-rail .cp-touche{margin-left:auto;text-decoration:none;
font:600 10px/1 ui-monospace,Menlo,monospace;color:var(--cp-faible);
border:1px solid var(--cp-ligne);border-radius:3px;padding:3px 5px}
.cp-rail .cp-lien:hover .cp-touche{color:var(--cp-texte);border-color:var(--cp-accent)}
.cp-rail .cp-fam{margin:13px 12px 4px;font:700 9px/1 Arial,sans-serif;letter-spacing:.12em;
text-transform:uppercase;color:var(--cp-faible)}
.cp-rail > .cp-fam:first-child{margin-top:2px}
/* le compte des planètes doublait le titre d'à côté et chevauchait le rail */
.cp-rail .cp-planetes #countColonies{display:none}
/* La barre du haut. Le jeu la pose en absolu, à des coordonnées calculées pour
   un cadre de mille pixels, et il écrit ses ressources en vignettes. Sous la
   peau elle redevient une ligne de texte : une étiquette, un chiffre.
   On ne touche pas à la boîte qui porte l'infobulle du jeu — c'est elle qu'on
   survole pour lire le détail d'une ressource, et elle reste la sienne. */
html.copilote-peau #top{display:flex;flex-wrap:wrap;align-items:center;gap:10px;
height:auto !important;top:0 !important;padding:0;box-sizing:border-box;
background-image:none !important}
/* Le jeu décale sa barre de 32 px pour laisser passer le bandeau du portail,
   et remonte la colonne du menu d'autant. Notre barre est plus haute que la
   sienne : les deux décalages se mordaient. On les remet à plat, et on ne
   garde la place du bandeau que s'il est encore là. */
html.copilote-peau:not(.copilote-lean) #top{padding-top:32px}
html.copilote-peau .copilote-col-menu{top:0 !important}
/* Remettre dans le flux ce que le jeu pose en absolu — et le suivre dans la
   bande : une pièce déménagée n'est plus enfant direct de la rangée, et la
   règle cessait de l'atteindre. Elle repartait alors à sa place d'origine,
   par-dessus le contenu de la page. */
html.copilote-peau #top > *,
html.copilote-peau .cp-barre > *{position:relative !important;left:auto !important;
top:auto !important;right:auto !important;flex:0 0 auto;background-image:none}
html.copilote-peau #top > #headerbarcomponent{order:-1;flex:0 0 100%;
width:auto !important;max-width:100% !important}
/* le logo et les officiers ne sont que des images : la barre n'en vit plus */
html.copilote-peau #top > #pageReloader,
html.copilote-peau #top > #commandercomponent{display:none !important}
/* Les deux porte-cases gardaient une hauteur et des marges taillées pour la
   barre d'origine : les ressources pendaient dix pixels plus bas que les
   messages. Remis à plat, tout se pose sur la même ligne. */
/* La bande disait ce que la colonne dit déjà, en mieux : une seule voix.
   La ligne des mouvements de flotte se tait pour la même raison — ce qu'elle
   annonce, la colonne le dit, et elle prenait une rangée pour « pas de
   mouvements ». */
html.copilote-peau .copilote-bande,
html.copilote-peau #notificationbarcomponent{display:none}
html.copilote-peau #resourcesbarcomponent,
html.copilote-peau #newmessagesindicatorcomponent{display:flex !important;align-items:center;
width:auto !important;height:auto !important;min-height:0 !important;
padding:0 !important;margin:0 !important}
html.copilote-peau #resources{width:auto !important;height:auto !important;
display:flex !important;gap:4px;align-items:stretch;padding:0 !important;margin:0 !important}
html.copilote-peau #resources .resource_tile{background-image:none !important;display:flex;
width:auto !important;height:auto !important;margin:0 !important;padding:0 !important}
/* l'image, et le lien de boutique qui la portait : la case de matière noire
   restait deux fois plus haute que ses voisines */
html.copilote-peau #resources .resourceIcon,
html.copilote-peau #resources a.overlay,
html.copilote-peau #resources img{display:none !important}
html.copilote-peau #resources .resource_tile > div{position:relative !important;
left:auto !important;top:auto !important;width:auto !important;height:auto !important;
display:flex !important;flex-direction:column;align-items:center;justify-content:center;gap:1px;
min-width:86px;min-height:44px;padding:3px 9px;text-align:center;
border:1px solid var(--cp-ligne);border-radius:5px;background:var(--cp-surface);cursor:help}
html.copilote-peau #resources .value{position:relative !important;display:block !important;
width:auto !important;height:auto !important;text-align:center !important}
html.copilote-peau #resources .value > span{position:relative !important;left:auto !important;
top:auto !important;width:auto !important;height:auto !important;display:block !important;
font:700 14px/1.25 Arial,sans-serif !important;color:var(--cp-texte) !important;
text-shadow:none !important;text-align:center !important}
/* Le jeu marque lui-même ce qui manque et ce qui déborde — énergie dans le
   rouge, soute presque pleine. En uniformisant la couleur des chiffres, on
   effaçait le seul signal qui se lit sans lire. On le lui rend. */
html.copilote-peau #resources .value > span.overmark{color:var(--cp-mauvais) !important}
html.copilote-peau #resources .value > span.middlemark{color:var(--cp-attention) !important}
html.copilote-peau #resources .resource_tile > div::before{display:block;
font:700 9px/1.3 Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--cp-faible)}
html.copilote-peau #resources .resource_tile > div.metal::before{content:"métal"}
html.copilote-peau #resources .resource_tile > div.crystal::before{content:"cristal"}
html.copilote-peau #resources .resource_tile > div.deuterium::before{content:"deutérium"}
html.copilote-peau #resources .resource_tile > div.energy::before{content:"énergie"}
html.copilote-peau #resources .resource_tile > div.population::before{content:"population"}
html.copilote-peau #resources .resource_tile > div.food::before{content:"nourriture"}
html.copilote-peau #resources .resource_tile > div.darkmatter::before{content:"matière noire"}
html.copilote-peau #notificationbarcomponent{width:auto !important;min-width:0;
color:var(--cp-doux);font:400 12px/1.4 Arial,sans-serif;text-shadow:none}
html.copilote-peau #notificationbarcomponent *{background-image:none !important}
html.copilote-peau #newmessagesindicatorcomponent{gap:8px}
html.copilote-peau #newmessagesindicatorcomponent .messagesIndicator,
html.copilote-peau #newmessagesindicatorcomponent .chatIndicator{background-image:none !important;
width:auto !important;height:auto !important;padding:3px 9px;border:1px solid var(--cp-ligne);
border-radius:5px;background:var(--cp-surface);color:var(--cp-texte);font:700 13px/1.2 Arial,sans-serif;
text-indent:0 !important;overflow:visible !important;white-space:nowrap;min-width:0;min-height:44px;
display:inline-flex !important;align-items:center;justify-content:center;gap:5px;
position:relative !important}
/* le compte des messages était posé en absolu, au coin de la vignette qui
   n'existe plus : il revient à sa place, juste après le mot */
html.copilote-peau #newmessagesindicatorcomponent .newCount{position:relative !important;
left:auto !important;right:auto !important;top:auto !important;margin:0 !important;
display:inline-block !important}
/* Une enveloppe et une bulle : le compte dit le reste, et deux mots en
   capitales prenaient trois fois la place pour la même chose. */
html.copilote-peau #newmessagesindicatorcomponent .messagesIndicator::before{content:"✉";
font:400 15px/1 Arial,sans-serif;letter-spacing:0;text-transform:none;color:var(--cp-texte)}
html.copilote-peau #newmessagesindicatorcomponent .chatIndicator::before{content:"💬";
font:400 13px/1 Arial,sans-serif;letter-spacing:0;text-transform:none;color:var(--cp-texte)}
/* Les planètes, sur la ligne du haut : des pastilles de texte comme les
   ressources. L'image de chaque planète s'en va — dans une pastille d'une
   ligne, elle écrase le nom — et le lien du jeu reste le lien du jeu. */
/* Une seule barre, et les planètes dedans. Six encadrés côte à côte — chacun
   sa bordure, ses marges, son image — ne tenaient pas sur la ligne des
   ressources : ils passaient dessous. Un seul cadre, un filet entre les noms,
   pas d'image : la même information dans la moitié de la place.
   Le jeu nomme son conteneur d'image planetBarSpaceObjectContainer et non
   planetBarSpaceObject : on vise donc le début du nom, pas le nom entier. */
.cp-planetes-haut{display:flex !important;flex-wrap:nowrap;gap:0;overflow:hidden;
width:auto !important;height:auto !important;margin:0 0 0 auto !important;padding:0 !important;
border:1px solid var(--cp-ligne);border-radius:5px;background:var(--cp-surface)}
.cp-planetes-haut .smallplanet{flex:0 0 auto;display:flex;align-items:center;
width:auto !important;height:auto !important;margin:0 !important;padding:0 !important}
.cp-planetes-haut .smallplanet + .smallplanet{border-left:1px solid var(--cp-ligne)}
.cp-planetes-haut [class^="planetBarSpaceObject"],
.cp-planetes-haut img{display:none !important}
.cp-planetes-haut .planetlink{display:flex !important;align-items:baseline;gap:5px;
width:auto !important;height:auto !important;min-height:0 !important;
padding:5px 10px !important;line-height:1.3 !important;
border:0;border-radius:0;background:none;text-decoration:none;text-shadow:none}
.cp-planetes-haut .planetlink:hover{background:var(--cp-survol)}
.cp-planetes-haut .planetlink.active{background:var(--cp-survol);box-shadow:inset 0 -2px 0 var(--cp-accent)}
.cp-planetes-haut .planet-name{color:var(--cp-texte);font:700 12px/1.3 Arial,sans-serif}
/* Les coordonnées s'en vont : à six planètes, elles coûtent 370 px sur la
   ligne — de quoi faire passer toute la barre en dessous — pour une donnée que
   l'infobulle du jeu donne au survol. Le nom suffit à choisir. */
.cp-planetes-haut .planet-koords{display:none !important}
html.copilote-planetes-haut.copilote-peau .copilote-col-planetes{display:none !important}
/* Les pages qu'on n'habille pas — Galaxie, Alliance, Empire — gardent la
   largeur que le jeu leur donne. Sans rien d'autre, elles se collaient au
   rail et laissaient tout le vide à droite. Des marges automatiques posent
   leur cadre au milieu de la place qui reste, entre le rail et la colonne. */
html.copilote-peau:not(.copilote-peau-grille):not(.copilote-peau-flotte) .copilote-col-jeu{
margin-left:auto !important;margin-right:auto !important}
/* sous la peau, la colonne du jeu ne se plafonne plus : notre grille sait
   s'étaler, et la colonne de droite prend sa part du reste */
/* base zéro, et non auto : avec une base auto, la colonne du jeu réclame la
   largeur de sa grille et pousse celle du copilote à la ligne du dessous.
   À zéro, les quatre colonnes tiennent sur une ligne et le jeu prend ce qui
   reste. */
html.copilote-peau-grille .copilote-col-jeu{flex:1 1 0 !important;max-width:none !important}
/* La colonne n'est plus un bloc : une carte par sujet, posées l'une sous
   l'autre, chacune avec son titre. On lit la première et on agit. */
/* Elle garde ses 320 px tant qu'il y a la place, et passe sous le jeu quand
   l'écran est trop étroit — plutôt que de pousser le rail hors de l'écran. */
.cp-colonne{flex:1 1 320px;max-width:360px;min-width:0;margin:0 6px;padding:0;box-sizing:border-box;
display:flex;flex-direction:column;gap:10px;
font:400 13px/1.5 Arial,sans-serif;color:var(--cp-texte);text-shadow:none}
.cp-colonne .cp-carte{background:var(--cp-surface);border:1px solid var(--cp-ligne);border-radius:8px;
padding:10px 12px}
.cp-colonne h3{margin:0 0 8px;font:700 12px/1 Arial,sans-serif;letter-spacing:.1em;
text-transform:uppercase;color:var(--cp-doux)}
.cp-colonne .cp-act{display:block;padding:7px 0;border-top:1px solid var(--cp-ligne);
color:var(--cp-accent);text-decoration:none;font:700 12px/1.35 Arial,sans-serif}
/* Deux lignes au plus pour dire quoi : au-delà, c'est une explication, et
   l'explication est dans l'infobulle. */
.cp-colonne .cp-quoi{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
overflow:hidden}
.cp-colonne .cp-act:hover{color:var(--cp-accent-vif)}
.cp-colonne .cp-act.copilote-gris{color:var(--cp-doux);font-weight:400}
.cp-colonne .cp-act small{display:block;color:var(--cp-doux);font-weight:400;font-size:11px}
/* Les six teintes du panneau, recopiées ici : les deux documents n'ont pas
   de feuille commune, et une planète doit garder sa couleur en passant de
   l'un à l'autre. Elles tournent au-delà de six planètes — deux teintes
   proches valent mieux que deux indistinguables. */
html.copilote-peau{--p0:#74b9ff;--p1:#ffa94d;--p2:#63e6a8;--p3:#ff8fb1;--p4:#ffe066;--p5:#c4a0ff}
/* Sur fond clair, les mêmes teintes seraient illisibles : on prend celles du
   panneau en thème clair, qui disent les mêmes planètes en plus sombre. */
html.copilote-peau.copilote-clair{--p0:#1b6cc9;--p1:#b35c00;--p2:#0b8a5a;
--p3:#c0336a;--p4:#8a6a00;--p5:#6b3fc9}
.cp-colonne .cp-act .cp-ou{color:var(--pc,var(--cp-doux));font-weight:700}
html.copilote-peau-grille #middle .maincontent > *:not(.copilote-peau-panneau){
position:absolute !important;left:-99999px !important;top:0 !important;width:900px !important}
.copilote-peau-panneau{font:400 13px/1.5 Arial,sans-serif;color:var(--cp-texte);text-shadow:none;
display:flex;flex-direction:column;gap:14px;padding:4px 0 24px 10px}
/* Une seule ligne : le titre, ce que dit le jeu, ce que dit le plan, et le
   retour à la page du jeu. Ce qui ne tient pas se coupe plutôt que de
   prendre une rangée de plus — c'est un résumé, pas une lecture. */
.copilote-peau-panneau .cp-tete{display:flex;align-items:baseline;gap:12px;flex-wrap:nowrap;
overflow:hidden;padding-bottom:10px;border-bottom:1px solid var(--cp-ligne)}
.copilote-peau-panneau .cp-tete h2,
.copilote-peau-panneau .cp-tete .cp-rendre{flex:0 0 auto}
.copilote-peau-panneau h2{margin:0;font:700 17px/1.2 Arial,sans-serif;letter-spacing:.06em;
text-transform:uppercase;color:var(--cp-texte)}
.copilote-peau-panneau .cp-rendre{background:none;border:1px solid var(--cp-ligne);
color:var(--cp-doux);border-radius:4px;padding:3px 9px;font:400 11px/1.4 Arial,sans-serif;cursor:pointer}
.copilote-peau-panneau .cp-rendre:hover{color:var(--cp-texte);border-color:var(--cp-accent)}
/* La page Flotte, habillée et non redessinée : ses cases deviennent des
   cartes, son champ de saisie reste le sien, à sa place dans le formulaire. */
html.copilote-peau .cp-chemin-large{width:auto !important;max-width:none !important}
html.copilote-peau #technologies.cp-chemin-large{display:flex;gap:14px;align-items:flex-start}
html.copilote-peau #technologies.cp-chemin-large > .cp-chemin-large{flex:1 1 0;min-width:0}
html.copilote-peau-flotte .copilote-col-jeu{flex:1 1 0 !important}
/* L'illustration du jeu fait 250 px de haut pour un titre : on garde le
   titre, on laisse l'image. Les trois lignes d'état — flottes, retrait,
   mission — se rangent côte à côte au lieu de prendre trois rangées. */
html.copilote-peau-flotte .planet-header{background-image:none !important;
height:auto !important;min-height:0 !important;width:auto !important;
padding:0 !important;margin:0 0 8px !important}
/* Le jeu décale son titre de 144 px pour le poser sur l'illustration ; sans
   elle, il flottait à droite de tout le reste. */
html.copilote-peau-flotte .planet-header h2{margin:0 !important;padding:0 !important;
text-indent:0 !important;width:auto !important;text-align:left;
font:700 15px/1.3 Arial,sans-serif;color:var(--cp-texte);text-shadow:none}
html.copilote-peau-flotte .planet-header .toggleHeader{display:none}
html.copilote-peau-flotte .fleetStatus{display:inline-block;vertical-align:top;
width:auto !important;height:auto !important;background-image:none !important;
margin:0 6px 6px 0;padding:5px 10px;border:1px solid var(--cp-ligne);border-radius:6px;
background:var(--cp-surface);font:400 12px/1.5 Arial,sans-serif;color:var(--cp-doux);text-shadow:none}
html.copilote-peau .cp-flotte{display:grid !important;gap:8px;
grid-template-columns:repeat(auto-fill,minmax(190px,1fr));
width:auto !important;height:auto !important;padding:0 !important;margin:0 !important}
html.copilote-peau .cp-flotte > li.technology{display:grid !important;
grid-template-columns:80px minmax(0,1fr);grid-template-rows:auto auto auto;gap:2px 10px;
width:auto !important;height:auto !important;margin:0 !important;padding:8px 10px !important;
border:1px solid var(--cp-ligne);border-radius:6px;background:var(--cp-surface);text-align:left}
/* le nom, que le jeu ne montrait que dans son infobulle */
html.copilote-peau .cp-flotte > li.technology::before{content:attr(aria-label);
grid-column:2;grid-row:1;align-self:end;font:400 10px/1.25 Arial,sans-serif;
letter-spacing:.05em;text-transform:uppercase;color:var(--cp-doux)}
html.copilote-peau .cp-flotte .icon{grid-column:1;grid-row:1/4;align-self:center;position:relative}
/* le nombre disponible, en pastille sur l'image */
html.copilote-peau .cp-flotte .amount{position:absolute !important;left:3px !important;
top:3px !important;right:auto !important;bottom:auto !important;
width:auto !important;height:auto !important;padding:1px 6px;border-radius:4px;
background:var(--cp-voile);text-align:left !important}
html.copilote-peau .cp-flotte .amount .stockAmount{display:inline !important;
color:var(--cp-texte) !important;font:700 12px/1.4 Arial,sans-serif !important}
html.copilote-peau .cp-flotte > li.technology > input{grid-column:2;grid-row:3;
position:static !important;width:100% !important;height:auto !important;
left:auto !important;top:auto !important;box-sizing:border-box;padding:4px 7px;
border:1px solid var(--cp-ligne);border-radius:4px;background:var(--cp-creux);color:var(--cp-texte);
font:700 13px/1.2 Arial,sans-serif;text-align:left}
/* Le bouton qui ouvre le panneau, et la fenêtre qui le porte. */
.cp-bouton{margin-left:12px;padding:5px 12px;border:1px solid var(--cp-ligne);border-radius:5px;
background:var(--cp-surface);color:var(--cp-texte);font:700 11px/1.4 Arial,sans-serif;letter-spacing:.08em;
text-transform:uppercase;text-shadow:none;cursor:pointer}
.cp-bouton:hover{border-color:var(--cp-accent);color:var(--cp-texte)}
.cp-fenetre{position:fixed;inset:0;z-index:9000;background:var(--cp-ombre);
display:flex;align-items:center;justify-content:center;padding:24px}
.cp-fenetre-boite{position:relative;width:min(900px,100%);height:min(900px,100%);
background:var(--cp-creux);border:1px solid var(--cp-ligne);border-radius:10px;overflow:hidden;
box-shadow:0 30px 80px var(--cp-ombre-portee)}
.cp-fenetre iframe{width:100%;height:100%;border:0;display:block}
.cp-fermer{position:absolute;top:8px;right:10px;z-index:2;padding:4px 10px;
border:1px solid var(--cp-ligne);border-radius:5px;background:var(--cp-surface);color:var(--cp-doux);
font:700 11px/1.4 Arial,sans-serif;cursor:pointer}
.cp-fermer:hover{color:var(--cp-texte);border-color:var(--cp-accent)}
/* La bande du haut : un seul cadre, un seul fond, et les pièces dedans.
   Les cadres intérieurs s'effacent — c'est ce qui faisait des carreaux. */
.cp-barre{flex:0 0 100%;display:flex;flex-wrap:wrap;align-items:center;gap:0;
box-sizing:border-box;padding:0 6px;
border:0;border-bottom:1px solid var(--cp-ligne);border-radius:0;background:var(--cp-surface)}
/* La bande traverse l'écran d'un bord à l'autre : un seul trait, le sien, au
   bas duquel pendent les deux flancs — leur liseré du haut remonte d'un pixel
   pour ne faire qu'une ligne avec lui.
   La largeur est écrite avec l'identifiant du haut parce que la règle qui
   remet dans le flux ce que le jeu pose en absolu l'est aussi : sans lui son
   flex:0 0 auto l'emportait, la bande se repliait sur son contenu, et il
   restait un vide à droite entre elle et le bord de l'écran. */
html.copilote-peau #top > .cp-barre{flex:0 0 100%;margin:0}
/* Le mou de la ligne tombe là : entre les messages et la première planète.
   Les planètes et le bouton du copilote restent ainsi collés au bord droit,
   quelle que soit la largeur de l'écran. */
html.copilote-peau .cp-barre .cp-planetes-haut{margin-left:auto}
html.copilote-peau .cp-rail{margin-top:-1px;border-top-left-radius:0;border-top-right-radius:0}
html.copilote-peau .cp-colonne > .cp-carte:first-child{margin-top:-1px;
border-top-left-radius:0;border-top-right-radius:0}
html.copilote-peau .cp-barre #resources .resource_tile > div,
html.copilote-peau .cp-barre .messagesIndicator,
html.copilote-peau .cp-barre .chatIndicator,
html.copilote-peau .cp-barre .cp-bouton,
html.copilote-peau .cp-barre .cp-planetes-haut,
html.copilote-peau .cp-barre .cp-planetes-haut .smallplanet + .smallplanet{
border:0 !important;background:none !important;border-radius:0}
html.copilote-peau .cp-barre .cp-planetes-haut{overflow:visible}
/* le titre que le jeu donne à chaque groupe de cases */
.copilote-peau-panneau .cp-groupe{margin:0 0 -6px;font:700 11px/1 Arial,sans-serif;
letter-spacing:.1em;text-transform:uppercase;color:var(--cp-faible)}
.copilote-peau-panneau .cp-grille{display:grid;gap:8px;
grid-template-columns:repeat(auto-fill,minmax(176px,1fr))}
.copilote-peau-panneau .cp-case{position:relative;border:1px solid var(--cp-ligne);border-radius:6px;
background:var(--cp-surface);overflow:hidden}
.copilote-peau-panneau .cp-ouvrir{display:flex;align-items:center;gap:10px;width:100%;
text-align:left;padding:8px 10px;border:0;background:none;color:var(--cp-texte);
font:400 13px/1.4 Arial,sans-serif;cursor:pointer}
.copilote-peau-panneau .cp-case:hover{border-color:var(--cp-accent);background:var(--cp-survol)}
/* Une case en chantier : le temps qui reste, en bas de la carte, lisible
   sans chercher. */
.copilote-peau-panneau .cp-case[data-actif]{border-color:var(--cp-bon)}
.copilote-peau-panneau .cp-case[data-actif] .cp-ouvrir{padding-bottom:24px}
.copilote-peau-panneau .cp-encours{position:absolute;left:0;right:0;bottom:0;
padding:3px 10px;background:var(--cp-bon-fond);color:var(--cp-bon);
font:700 11px/1.4 Arial,sans-serif;text-align:center}
.copilote-peau-panneau .cp-ouvrir[aria-pressed="true"]{background:var(--cp-survol);
box-shadow:inset 3px 0 0 var(--cp-accent)}
/* l'image du jeu fait 100 px : on la réduit, on ne la redimensionne pas —
   sa place sur la planche de sprites ne se met pas à l'échelle */
.copilote-peau-panneau .cp-img{flex:0 0 46px;width:46px;height:46px;overflow:hidden;
border-radius:4px;display:block}
.copilote-peau-panneau .cp-img .icon{transform:scale(.46);transform-origin:top left;display:block}
.copilote-peau-panneau .cp-txt{display:flex;flex-direction:column;gap:1px;min-width:0}
.copilote-peau-panneau .cp-nom{color:var(--cp-doux);font-size:11px;letter-spacing:.04em;text-transform:uppercase}
.copilote-peau-panneau .cp-niv{font:700 20px/1.1 Arial,sans-serif}
.copilote-peau-panneau .cp-cible{position:absolute;top:6px;right:6px;border:0;border-radius:3px;
background:var(--cp-accent);color:var(--cp-creux);font:700 11px/1.5 Arial,sans-serif;padding:1px 7px;cursor:pointer}
.copilote-peau-panneau .cp-cible:hover{background:var(--cp-accent-vif)}
/* ta priorité n'a pas la teinte de la cible du plan ; pas encore confirmée,
   elle reste en creux jusqu'à ce que le panneau l'ait reprise */
.copilote-peau-panneau .cp-cible-prio,
.copilote-peau-panneau .cp-cible-prio:hover{background:var(--cp-attention)}
.copilote-peau-panneau .cp-cible-attente,
.copilote-peau-panneau .cp-cible-attente:hover{background:transparent;color:var(--cp-attention);
box-shadow:inset 0 0 0 1px var(--cp-attention)}
/* ce qui se compte ne se lance pas d'un clic : la pastille informe, sans
   faire croire qu'elle agit */
.copilote-peau-panneau .cp-cible-muette,
.copilote-peau-panneau .cp-cible-muette:hover{background:transparent;color:var(--cp-doux);
box-shadow:inset 0 0 0 1px var(--cp-ligne);cursor:default}
/* la pastille est posée sur la carte : le nom lui laisse la place, et
   seulement sur les cartes qui en portent une */
.copilote-peau-panneau .cp-case:has(.cp-cible) .cp-txt{padding-right:38px}
.copilote-peau-panneau .cp-cible[disabled]{background:var(--cp-ligne);color:var(--cp-doux)}
/* ce que le clic a donné, dit sur la pastille elle-même */
.copilote-peau-panneau .cp-cible[data-etat]::after{content:" · " attr(data-etat)}
.copilote-peau-panneau .cp-cible[data-etat="lancé"]{background:var(--cp-bon);color:var(--cp-creux)}
.copilote-peau-panneau .cp-cible[data-etat="pas payable"]{background:var(--cp-attention);color:var(--cp-creux)}
.copilote-peau-panneau .cp-vide{color:var(--cp-doux);font-size:12px}
/* Le jeu donne 654 px à son panneau et l'empile en trois étages posés en
   absolu : l'enveloppe, le contenu, le panneau. Les trois reviennent dans le
   flux. Mais tout ce qu'il y range est ancré à droite — le titre, le niveau,
   le bouton de montée — et son cadre est une image taillée pour 654 px.
   Étirée sur deux mille pixels, elle se répète en bandes et le titre part à
   un mètre de l'illustration. On sépare donc les deux rôles : la bande prend
   toute la largeur et sépare ce qu'on clique de ce qu'on lit, la carte garde
   ses proportions au milieu. --copilote-detail règle sa largeur, et 100% la
   rend à l'écran entier. */
.copilote-peau-panneau{--copilote-detail:1000px}
.copilote-peau-panneau .cp-detail{position:relative;min-height:1px;margin-top:6px;
padding:8px 0;border:1px solid var(--cp-ligne);border-radius:8px;background:var(--cp-surface2)}
.copilote-peau-panneau .cp-detail > #technologydetails_wrapper{position:relative !important;
left:auto !important;top:auto !important;width:auto !important;
max-width:var(--copilote-detail) !important;margin-left:auto;margin-right:auto}
.copilote-peau-panneau .cp-detail #technologydetails_content{position:relative !important;
width:auto !important;max-width:var(--copilote-detail) !important;
margin-left:auto;margin-right:auto;background-image:none !important;
background-color:transparent !important}
.copilote-peau-panneau .cp-detail #technologydetails{position:relative !important;
width:auto !important;max-width:none !important;background-image:none !important}`;

  /* Le menu du jeu, redessiné : ses liens, ses couleurs, notre trait. Les
     adresses sortent du menu lui-même — aucun nom de page n'est écrit ici, et
     le jour où Gameforge en ajoute une, elle est dans le rail sans qu'on y
     touche. Le jeu double chaque entrée : une icône muette, puis le libellé.
     On ne garde que ce qui porte un nom. */
  let leRail = null, leRailHote = null, leChemin = [];
  // la liste des planètes, et la place du jeu où la remettre
  let laListe = null, listeParent = null, listeSuivant = null;
  // le panneau de détail du jeu, et la place d'où on l'a pris
  let leDetail = null, detailParent = null, detailSuivant = null;

  /* Un flanc ne montre que ce pour quoi il est là : le rail à gauche, les
     planètes à droite. On marque, dans la colonne, l'enfant qui mène à ce
     qu'on garde ; ses voisins partent hors de l'écran — l'encart de mission,
     la bannière. Rien n'est nommé : on part de ce qu'on garde et on remonte,
     donc ce que le jeu ajoutera à côté s'en ira tout seul.
     Un seul étage, celui de la colonne : plus bas, on cacherait des morceaux
     du jeu qu'on ne connaît pas. */
  function enfantDeColonne(noeud, colonne) {
    for (let x = noeud; x && x !== document.body; x = x.parentNode) {
      const p = x.parentNode;
      if (p && p.classList && p.classList.contains(colonne)) return x;
    }
    return null;
  }

  function gardeDansColonne(garde, colonne) {
    const x = enfantDeColonne(garde, colonne);
    if (x) {
      x.classList.add('copilote-chemin');
      leChemin.push(x);
    }
    /* Colonne introuvable : on ne cache rien. Mieux vaut un encart de trop
       qu'un flanc vidé par erreur. */
  }

  function oteChemin() {
    for (const x of leChemin) x.classList.remove('copilote-chemin');
    leChemin = [];
  }

  function oteRail() {
    oteChemin();
    /* La liste des planètes appartient au jeu : on la remet où on l'a prise,
       sinon la page du jeu rendue se retrouve sans ses planètes. */
    if (laListe && listeParent) {
      laListe.classList.remove('cp-planetes-haut');
      listeParent.insertBefore(laListe, listeSuivant);
    }
    laListe = listeParent = listeSuivant = null;
    document.documentElement.classList.remove('copilote-planetes-haut');
    if (leRail) leRail.remove();
    if (leRailHote) leRailHote.classList.remove('copilote-rail-hote');
    leRail = leRailHote = null;
  }

  /* Le rail, rangé par familles. Le jeu liste ses pages à plat ; le joueur,
     lui, pense par gestes — construire, chercher, armer, voler. Une famille
     n'est qu'une liste de pages : celle que Gameforge ajoutera demain n'est
     dans aucune, et tombe à la fin sous « autres ». Rien ne se perd. */
  const RAIL_FAMILLES = [
    ['', ['overview']],
    ['construire', ['supplies', 'facilities', 'lfbuildings']],
    ['chercher', ['research', 'lfresearch', 'lfbonuses']],
    ['armer', ['shipyard', 'defenses']],
    ['voler', ['fleetdispatch', 'movement', 'galaxy']],
    ['empire', ['empire', 'alliance']]
  ];

  /* Une touche par page. Les lettres sont à nous — le jeu ne nomme pas ses
     pages en une lettre — mais les adresses viennent du menu : on n'invente
     aucune URL, et une page absente du menu n'a pas de touche. */
  const RAIL_TOUCHES = {
    overview: 'O', supplies: 'R', facilities: 'I', lfbuildings: 'V',
    research: 'C', lfresearch: 'B', shipyard: 'S', defenses: 'D',
    fleetdispatch: 'F', movement: 'M', galaxy: 'G', empire: 'E', alliance: 'A'
  };
  let touchesPosees = false;

  /* L'écouteur se pose une fois pour la vie du script : le rail, lui, se
     repose à chaque dessin, et un écouteur par rail s'empilerait. Rien ne
     part pendant qu'on écrit, ni avec une touche de commande — le jeu a ses
     propres raccourcis, et le chat des champs de saisie. */
  function poseTouches() {
    if (touchesPosees) return;
    touchesPosees = true;
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && laFenetre) { fermeFenetre(); return; }
      if (!leRail || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      // une touche de page n'emmène nulle part tant que la fenêtre est ouverte
      if (laFenetre) return;
      const t = e.target;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '') || t.isContentEditable)) return;
      const k = String(e.key || '').toUpperCase();
      const lien = [...leRail.querySelectorAll('a[data-touche]')].find(a => a.dataset.touche === k);
      if (!lien) return;
      e.preventDefault();
      location.href = lien.href;
    });
  }

  /** La rangée du haut : le seul enfant du cadre qui n'est pas une colonne. */
  function laRangee() {
    return leCadre && [...leCadre.children].find(x => x.classList.contains('copilote-rang'));
  }

  function poseRail(menu) {
    const hote = menu && menu.parentNode;
    if (!hote) return;
    const ici = pageCourante();
    const entrees = [];
    for (const a of menu.querySelectorAll('a[href]')) {
      // les entrées payantes suivent le réglage du menu : cachées là, cachées ici
      if (noshop && caseDuLien(a).classList.contains('copilote-paye')) continue;
      const lab = a.querySelector('.textlabel');
      const txt = clean(lab ? lab.textContent : '');
      // une entrée sans nom est une icône : le jeu double chaque ligne
      if (!txt) continue;
      entrees.push({ txt, href: a.getAttribute('href'), comp: compDuLien(a) });
    }
    /* Tout ou rien : un rail vide à la place du menu du jeu, et le joueur n'a
       plus de quoi quitter la page. */
    if (!entrees.length) return;
    const rail = document.createElement('nav');
    rail.className = 'cp-rail';
    const reste = entrees.slice();
    const famille = (titre, liste) => {
      if (!liste.length) return;
      if (titre) {
        const t = rail.appendChild(document.createElement('div'));
        t.className = 'cp-fam';
        t.textContent = titre;
      }
      for (const e of liste) {
        const n = rail.appendChild(document.createElement('a'));
        n.href = e.href;
        n.textContent = e.txt;
        n.className = 'cp-lien' + (e.comp && e.comp === ici ? ' cp-ici' : '');
        const c = MENU_COULEURS[e.comp];
        if (c) n.style.setProperty('--cm', c);
        const touche = RAIL_TOUCHES[e.comp];
        if (touche) {
          n.dataset.touche = touche;
          const u = n.appendChild(document.createElement('u'));
          u.className = 'cp-touche';
          u.textContent = touche;
        }
      }
    };
    for (const [titre, pages] of RAIL_FAMILLES) {
      const prises = [];
      for (const p of pages) {
        const i = reste.findIndex(e => e.comp === p);
        if (i >= 0) prises.push(reste.splice(i, 1)[0]);
      }
      famille(titre, prises);
    }
    famille('autres', reste);
    /* Les planètes passent sous le menu. Elles étaient à l'autre bout de
       l'écran, alors que le joueur fait sans cesse l'aller-retour entre une
       page et une planète : les deux moitiés du même geste se touchent enfin.
       On déplace la liste du jeu, on ne la recopie pas — elle garde ses
       infobulles et son code — et on retient d'où elle vient, pour l'y
       remettre quand la peau se retire. */
    /* Les planètes montent sur la ligne du haut. Dans un flanc, six lignes
       dans une colonne étroite obligeaient à défiler pour en atteindre une ;
       en haut, elles tiennent sur une ligne et chacune est à un clic.
       On déménage la liste du jeu : ses liens, ses infobulles et ses lunes
       viennent avec elle. */
    const haut = laRangee();
    const pl = document.getElementById('planetList');
    if (haut && pl && pl.parentNode) {
      laListe = pl;
      listeParent = pl.parentNode;
      listeSuivant = pl.nextSibling;
      pl.classList.add('cp-planetes-haut');
      haut.appendChild(pl);
      document.documentElement.classList.add('copilote-planetes-haut');
    }
    poseTouches();
    hote.classList.add('copilote-rail-hote');
    hote.insertBefore(rail, hote.children[0] || null);
    leRail = rail;
    leRailHote = hote;
  }

  /* Monter une case. On n'écrit pas la requête du jeu : on ouvre sa case, on
     attend son panneau, et on clique son bouton. Deux précautions, et elles
     comptent toutes les deux : le panneau doit être celui de la bonne case —
     le jeu le refait à chaque ouverture, et cliquer dans celui d'avant
     monterait autre chose — et le bouton doit être `upgrade`, celui qui paie
     en ressources. À côté de lui vivent celui qui paie en matière noire et
     celui qui démolit.
     Pas de bouton `upgrade` : le jeu dit non, il manque de quoi payer. On le
     dit sur la pastille et on s'arrête là. */
  function souris(el) {
    for (const t of ['mousedown', 'mouseup', 'click']) {
      el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
    }
  }

  function construire(id, cible, pastille) {
    /* On relit la case au moment du clic. Le jeu refait sa liste de cases sans
       arrêt, et celle qu'on tenait à la peinture peut ne plus être dans la
       page : on cliquait alors dans le vide. */
    const li = document.querySelector('li.technology[data-technology="' + id + '"]');
    if (!li) { pastille.dataset.etat = 'case introuvable'; return; }
    const e = li.querySelector('.level[data-value]') || li.querySelector('.amount[data-value]');
    const niv = e ? +e.dataset.value || 0 : null;
    /* Le bouton du jeu monte d'un niveau, quel qu'il soit — il ne sait pas où
       le plan veut aller. Si la case a déjà atteint ce qu'on demande, cliquer
       la ferait monter plus haut que prévu. On s'arrête. */
    if (niv != null && cible != null && niv >= cible) { pastille.dataset.etat = 'déjà fait'; return; }
    pastille.disabled = true;
    pastille.dataset.etat = 'ouvre';
    souris(li.querySelector('.icon') || li);
    let reste = 12;
    const tente = () => {
      const det = document.getElementById('technologydetails');
      if (det && String(det.dataset.technologyId) === String(id)) {
        const b = det.querySelector('button.upgrade');
        if (b) { souris(b); pastille.dataset.etat = 'lancé'; return; }
        pastille.dataset.etat = 'pas payable';
        pastille.disabled = false;
        return;
      }
      if (--reste > 0) setTimeout(tente, 150);
      else { pastille.dataset.etat = 'sans panneau'; pastille.disabled = false; }
    };
    setTimeout(tente, 150);
  }

  /* Ce que le panneau latéral sait, posé à droite de la page : le joueur n'a
     plus d'onglet à ouvrir pour savoir quoi faire. La colonne vit dans le
     cadre, à côté de celle des planètes, et prend sa part de la largeur. */
  let laColonne = null;

  /* Une carte par sujet, plutôt qu'une liste d'affilée : ce qui se fait sur
     cette page d'abord, le reste de la journée ensuite. Le joueur lit la
     première carte et agit sans avoir à trier. Une carte sans ligne ne se pose
     pas — une section vide n'apprend rien. */
  /** Un caractère qui a un sens dans une expression, rendu inoffensif. */
  const echappe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /* Une action nomme souvent ses planètes dans sa phrase. On y peint les noms
     qu'on connaît, de leur teinte, et rien d'autre : le texte reste celui du
     panneau, découpé, jamais réécrit.
     Les noms les plus longs passent devant, sinon « Caribou » mangerait
     « Caribou Land ». */
  function ecrisEnCouleur(hote, texte) {
    const noms = Object.keys(teintes).filter(Boolean).sort((a, b) => b.length - a.length);
    const morceau = (t, cls, pc) => {
      if (!t) return;
      const s = hote.appendChild(document.createElement('span'));
      if (cls) s.className = cls;
      s.textContent = t;
      if (pc != null) s.style.setProperty('--pc', 'var(--p' + pc + ')');
    };
    if (!noms.length) { morceau(texte, '', null); return; }
    const re = new RegExp('(' + noms.map(echappe).join('|') + ')', 'g');
    let i = 0;
    for (const m of String(texte).matchAll(re)) {
      morceau(texte.slice(i, m.index), '', null);
      morceau(m[0], 'cp-ou', teintes[m[0]]);
      i = m.index + m[0].length;
    }
    morceau(texte.slice(i), '', null);
  }

  function carteColonne(c, titre, lignes) {
    if (!lignes.length) return;
    const carte = c.appendChild(document.createElement('section'));
    carte.className = 'cp-carte';
    const h = carte.appendChild(document.createElement('h3'));
    h.textContent = titre;
    for (const l of lignes) {
      const a = carte.appendChild(document.createElement(l.url ? 'a' : 'div'));
      a.className = 'cp-act' + (l.gris ? ' copilote-gris' : '');
      if (l.url) a.href = l.url;
      /* Trois choses se lisent d'un coup d'œil : quoi, où, quand. Le
         pourquoi — deux phrases, parfois trois — passe à l'infobulle : il se
         lit quand on hésite, pas à chaque passage. Dans une colonne de trois
         cents pixels, l'afficher noyait les actions sous les explications. */
      const q = a.appendChild(document.createElement('span'));
      q.className = 'cp-quoi';
      ecrisEnCouleur(q, l.what);
      const s = a.appendChild(document.createElement('small'));
      /* La planète porte sa couleur, la même que sa pastille dans le panneau :
         d'un flanc à l'autre, une planète se reconnaît sans se lire. */
      if (l.ou) {
        const o = s.appendChild(document.createElement('span'));
        o.className = 'cp-ou';
        o.textContent = l.ou;
        const pc = l.pc != null ? l.pc : teintes[l.ou];
        if (pc != null) o.style.setProperty('--pc', 'var(--p' + pc + ')');
      }
      if (l.quand) {
        const q2 = s.appendChild(document.createElement('span'));
        q2.textContent = (l.ou ? ' · ' : '') + l.quand;
      }
      a.title = [l.what, l.ou, l.quand, l.why].filter(Boolean).join(' · ');
    }
  }

  function poseColonne(cadre, ici) {
    if (laColonne) { laColonne.remove(); laColonne = null; }
    const dIci = (ici || []).map(l => ({ what: l.what, ou: l.ou, quand: l.quand, why: l.why, url: l.url, gris: l.gris }));
    if (!cadre || (!colonne.length && !dIci.length)) return;
    const c = document.createElement('aside');
    c.className = 'cp-colonne';
    carteColonne(c, 'à faire ici', dIci);
    carteColonne(c, "aujourd'hui", colonne);
    if (!c.children.length) return;
    cadre.appendChild(c);
    laColonne = c;
  }

  let peauEtat = 'éteinte', laPeau = null, peauRevelee = false, laCle = '';
  /* Les comptes à rebours des cases en chantier. La peau ne se redessine que
     lorsque le plan change ; un compte à rebours, lui, change à chaque
     seconde. On garde donc la main sur ces étiquettes-là pour les réécrire
     en place, sans rien reposer. */
  let lesMinuteurs = [];

  /** Un temps restant, dit court : « 18 s », « 9 min », « 2 h 05 ». */
  const compte = sec => sec >= 3600
    ? Math.floor(sec / 3600) + ' h ' + String(Math.floor(sec % 3600 / 60)).padStart(2, '0')
    : sec >= 60 ? Math.ceil(sec / 60) + ' min' : Math.max(0, Math.ceil(sec)) + ' s';

  function majMinuteurs() {
    const maintenant = Date.now();
    for (const m of lesMinuteurs) {
      if (!m.el.parentNode) continue;
      /* La fin vient du jeu, en secondes : on ne compte pas le temps nous-
         mêmes, on lit la sienne. */
      const t = m.li.querySelector('[data-end]');
      const fin = t ? +t.dataset.end * 1000 : 0;
      m.el.textContent = (m.vise ? '→ ' + m.vise + ' · ' : '')
        + (fin ? compte((fin - maintenant) / 1000) : 'en cours');
    }
  }


  /** Dessine la page à notre façon, ou rend celle du jeu. */
  function peintPeau() {
    const comp = pageCourante();
    /* Deux portées : le cadre, qui ne touche pas au contenu, et la grille,
       qui le remplace. Une page sans case prend le cadre seul. */
    const cadre = peau && !peauRevelee && PAGES_CADRE.indexOf(comp) >= 0;
    const veutGrille = cadre && PAGES_PEAU.indexOf(comp) >= 0;
    const rendre = (etat) => {
      document.documentElement.classList.remove('copilote-peau');
      /* Le panneau de détail appartient au jeu : on le remet avant de jeter
         le nôtre, qui l'héberge. */
      if (leDetail && detailParent) detailParent.insertBefore(leDetail, detailSuivant);
      leDetail = detailParent = detailSuivant = null;
      if (laPeau) { laPeau.remove(); laPeau = null; }
      if (laColonne) { laColonne.remove(); laColonne = null; }
      /* La bande rend ses pièces d'abord : elle les a prises à la rangée du
         haut, et le rail rendra ensuite les planètes au flanc du jeu. Dans
         l'autre sens, la liste finissait là où la bande l'avait trouvée. */
      oteBarre();
      oteRail();
      oteFlotte();
      oteBouton();
      document.documentElement.classList.remove('copilote-peau-grille');
      document.documentElement.classList.remove('copilote-clair');
      laCle = '';
      peauEtat = etat;
    };
    if (!cadre) { rendre(peauRevelee ? 'rendue' : peau ? 'hors page' : 'éteinte'); return; }
    const hote = document.querySelector('#middle .maincontent');
    const tuiles = veutGrille ? [...document.querySelectorAll('li.technology[data-technology]')] : [];
    /* Une page à cases sans case n'est pas la page qu'on croit : elle garde
       son contenu et s'en tient au cadre, plutôt que de recevoir un panneau
       vide par-dessus. */
    const grille = veutGrille && !!hote && tuiles.length > 0;
    document.documentElement.classList.add('copilote-peau');
    /* Le jour ou la nuit : une classe, et toutes les couleurs suivent. */
    document.documentElement.classList.toggle('copilote-clair', clair);
    /* Le contenu du jeu ne part hors de l'écran que là où on le remplace. */
    document.documentElement.classList.toggle('copilote-peau-grille', grille);
    const dit = marques(meta('planet-id'));
    const want = {};
    for (const id of Object.keys(dit)) want[id] = dit[id].lvl;
    const cases = tuiles.map(li => {
      const c = lireTuile(li, want);
      c.src = (dit[c.id] || {}).src;
      return c;
    });
    const lignes = ((band || {}).pages || {})[comp] || [];
    // Tant que rien ne change, on ne repose rien : la page clignoterait.
    const cle = JSON.stringify([comp, grille, cases.map(c => [c.id, c.niv, c.cible, c.src, c.actif]),
      lignes.map(l => [l.what, l.quand, l.gris]), colonne.map(l => [l.what, l.quand])]);
    if (laCle === cle && (!grille || (laPeau && laPeau.parentNode === hote))) {
      peauEtat = grille ? 'posée' : 'cadre';
      return;
    }
    majMinuteurs();
    laCle = cle;
    /* Sans grille, le cadre se pose seul et le contenu du jeu reste entier. */
    if (!grille) {
      if (laPeau) { laPeau.remove(); laPeau = null; }
      poseCadre(lignes);
      peauEtat = 'cadre';
      return;
    }
    const p = document.createElement('div');
    p.className = 'copilote-peau-panneau';
    p.dataset.cle = cle;
    const tete = p.appendChild(document.createElement('div'));
    tete.className = 'cp-tete';
    const h = tete.appendChild(document.createElement('h2'));
    /* Le titre vient du jeu : il nomme sa page dans la langue du joueur, et y
       met la planète. Faute de titre, l'entrée du menu qui mène ici fait
       l'affaire — elle non plus n'est pas écrite par nous. Une page dont on
       ne sait pas le nom n'en reçoit aucun : on n'en invente pas. */
    /* L'en-tête du jeu porte son titre dans un h2, et parfois un lien à côté
       (« Paramétrage de la production ») : on prend le titre, pas la ligne. */
    const tete0 = hote.querySelector('header');
    const entete = tete0 && (tete0.querySelector('h2, h3') || tete0);
    const barre = leMenu();
    const entree = barre && [...barre.querySelectorAll('a[href]')]
      .find(a => compDuLien(a) === comp && clean((a.querySelector('.textlabel') || {}).textContent));
    const lab = entree && entree.querySelector('.textlabel');
    h.textContent = clean(entete ? entete.textContent : '')
      || clean(lab ? lab.textContent : '');
    /* Ce qu'il y a à faire ici a quitté cette ligne pour la colonne de
       droite, où chaque action a la place de dire son pourquoi. */
    const rendreBtn = tete.appendChild(document.createElement('button'));
    rendreBtn.className = 'cp-rendre';
    rendreBtn.type = 'button';
    rendreBtn.textContent = 'page du jeu';
    rendreBtn.addEventListener('click', () => { peauRevelee = true; peintPeau(); });
    /* Le jeu range ses cases en groupes et les coiffe d'un titre : quatre sur
       Recherche, deux au Chantier, un sur Ressources. Les aplatir en une seule
       grille ferait perdre ce que le jeu dit de ses propres cases. On suit donc
       ses listes, et on reprend leur titre quand elles en ont un. */
    const groupes = [];
    for (const c of cases) {
      const liste = c.li.parentNode;
      let g = groupes.find(x => x.liste === liste);
      if (!g) {
        const h = liste && liste.parentNode && liste.parentNode.querySelector('h2, h3');
        groupes.push(g = { liste, titre: clean(h ? h.textContent : ''), cases: [] });
      }
      g.cases.push(c);
    }
    lesMinuteurs = [];
    for (const g of groupes) {
      // un seul groupe sans titre : le titre de la page suffit, on n'en remet pas
      if (g.titre && groupes.length > 1) {
        const t = p.appendChild(document.createElement('h3'));
        t.className = 'cp-groupe';
        t.textContent = g.titre;
      }
      const grille = p.appendChild(document.createElement('div'));
      grille.className = 'cp-grille';
      for (const c of g.cases) {
      const carte = grille.appendChild(document.createElement('div'));
      carte.className = 'cp-case';
      /* Le clic droit retrouve sa tuile par ce numéro : la carte est posée hors
         des listes du jeu, `closest('li.technology')` ne l'atteindrait jamais. */
      carte.dataset.technology = String(c.id);
      const b = carte.appendChild(document.createElement('button'));
      b.className = 'cp-ouvrir';
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      /* L'image est celle du jeu, reprise telle quelle : la redessiner
         demanderait un dessin par case, et le jeu en a déjà un. Elle vient
         avec ses classes, donc avec sa place sur la planche de sprites ; on
         ne la redimensionne pas, on la réduit. */
      const img = c.li.querySelector('.icon');
      if (img) {
        const cadre = b.appendChild(document.createElement('span'));
        cadre.className = 'cp-img';
        cadre.appendChild(img.cloneNode(true));
      }
      const txt = b.appendChild(document.createElement('span'));
      txt.className = 'cp-txt';
      const n = txt.appendChild(document.createElement('span'));
      n.className = 'cp-nom';
      n.textContent = c.nom;
      const v = txt.appendChild(document.createElement('span'));
      v.className = c.niv == null ? 'cp-vide' : 'cp-niv';
      v.textContent = c.niv == null ? '—' : String(c.niv);
      // atteint ou dépassé, le plan n'a plus rien à demander ici
      if (c.cible != null && (c.niv == null || c.niv < c.cible)) {
        /* Ce qui se compte ne se monte pas d'un clic : un vaisseau se commande
           par quantité, dans le formulaire du jeu, et son bouton de montée
           n'existe pas. La pastille dit alors ce que le plan veut, sans
           prétendre le lancer. */
        const t = carte.appendChild(document.createElement(c.compte ? 'span' : 'button'));
        t.className = 'cp-cible' + (c.compte ? ' cp-cible-muette' : '')
          + (c.src === 'prio' || c.src === 'attente' ? ' cp-cible-' + c.src : '');
        t.textContent = '→ ' + c.cible;
        if (!c.compte) {
          t.type = 'button';
          t.title = c.src && c.src !== 'plan' ? MARQUE[c.src].titre(c.cible) : 'Monter au niveau ' + c.cible;
          t.addEventListener('click', () => construire(c.id, c.cible, t));
        } else {
          t.title = 'Le plan en veut ' + c.cible + ' : ouvre la case pour en commander';
        }
      }
      /* Une case en chantier le dit sur elle-même : le jeu n'écrit son
         compte à rebours qu'en tout petit, sur l'image. */
      if (c.actif) {
        carte.dataset.actif = '1';
        const e = carte.appendChild(document.createElement('span'));
        e.className = 'cp-encours';
        lesMinuteurs.push({ el: e, li: c.li, vise: c.vise });
      }
      /* Le clic du jeu part sur l'icône, pas sur la case : c'est là qu'il
         écoute. Et il lui faut les trois temps d'une vraie souris. */
      b.addEventListener('click', () => {
        for (const x of grille.children) {
          const o = x.children[0];
          if (o && o.setAttribute) o.setAttribute('aria-pressed', 'false');
        }
        b.setAttribute('aria-pressed', 'true');
        souris(c.li.querySelector('.icon') || c.li);
      });
      }
    }
    const detail = p.appendChild(document.createElement('div'));
    detail.className = 'cp-detail';
    /* Le panneau de détail du jeu vient vivre ici, tel quel : déplacé, il
       garde son code et ses écouteurs, et le jeu continue d'écrire dedans.
       On retient d'où il vient : il appartient au jeu, et la page rendue
       doit le retrouver. */
    const vrai = document.getElementById('technologydetails_wrapper');
    if (vrai) {
      if (!detailParent && vrai.parentNode) {
        detailParent = vrai.parentNode;
        detailSuivant = vrai.nextSibling;
      }
      leDetail = vrai;
      detail.appendChild(vrai);
    }
    /* L'ancien panneau ne s'en va qu'une fois celui du jeu mis à l'abri dans
       le neuf. Le retirer d'abord l'emportait avec lui : la page perdait pour
       de bon de quoi ouvrir une case, et plus rien ne s'affichait. */
    if (laPeau) laPeau.remove();
    hote.insertBefore(p, hote.children[0] || null);
    laPeau = p;
    majMinuteurs();
    poseCadre(lignes);
    peauEtat = 'posée';
  }

  /* La page Flotte n'est pas une grille à nous. Son formulaire appartient au
     jeu : chaque case y porte le champ qui dit combien de vaisseaux partent, et
     refaire ce champ, ce serait refaire l'envoi. On ne la redessine donc pas,
     on l'habille — les cases deviennent des cartes, comme ailleurs, et pas un
     champ ne change de place dans le formulaire.
     Les listes se reconnaissent à ce qu'elles portent, non à leur nom : des
     cases du jeu qui tiennent chacune un champ de saisie. */
  let lesFlottes = [];

  function oteFlotte() {
    for (const n of lesFlottes) {
      n.classList.remove('cp-flotte');
      n.classList.remove('cp-chemin-large');
    }
    lesFlottes = [];
    document.documentElement.classList.remove('copilote-peau-flotte');
  }

  function poseFlotte() {
    oteFlotte();
    const champs = [...document.querySelectorAll('li.technology[data-technology] > input')];
    if (!champs.length) return;
    const mc = document.querySelector('#middle .maincontent');
    const listes = new Set();
    for (const i of champs) {
      const ul = i.parentNode && i.parentNode.parentNode;
      if (ul) listes.add(ul);
    }
    for (const ul of listes) {
      ul.classList.add('cp-flotte');
      lesFlottes.push(ul);
      /* Le jeu enferme ses listes dans des boîtes de quatre cents pixels :
         on élargit le chemin qui y mène, et rien d'autre. */
      for (let x = ul; x && x !== mc && x !== document.body; x = x.parentNode) {
        x.classList.add('cp-chemin-large');
        lesFlottes.push(x);
      }
    }
    document.documentElement.classList.add('copilote-peau-flotte');
  }

  /* Le panneau latéral porte déjà tout : Empire, Outils, Réglages, et le plan
     complet. Le refaire dans la page serait l'écrire deux fois et le laisser
     diverger. On l'ouvre donc tel quel, dans une fenêtre posée sur le jeu —
     c'est la même page d'extension, le même code, les mêmes réglages, et ce
     qu'on y change arrive dans la page par le chemin habituel.
     Le bouton vit dans la rangée du haut, repérée par sa marque et non par son
     nom : c'est la seule bande qui traverse la page. */
  let leBouton = null, laFenetre = null;

  function fermeFenetre() {
    if (laFenetre) laFenetre.remove();
    laFenetre = null;
  }

  function ouvreFenetre() {
    if (laFenetre) { fermeFenetre(); return; }
    let url = '';
    try { url = chrome.runtime.getURL('sidepanel.html'); } catch (e) {}
    if (!url) return;
    const f = document.createElement('div');
    f.className = 'cp-fenetre';
    const boite = f.appendChild(document.createElement('div'));
    boite.className = 'cp-fenetre-boite';
    const fermer = boite.appendChild(document.createElement('button'));
    fermer.className = 'cp-fermer';
    fermer.type = 'button';
    fermer.textContent = 'fermer';
    fermer.addEventListener('click', fermeFenetre);
    const cadre = boite.appendChild(document.createElement('iframe'));
    cadre.src = url;
    // un clic à côté referme : la fenêtre ne retient pas le joueur
    f.addEventListener('click', e => { if (e.target === f) fermeFenetre(); });
    document.body.appendChild(f);
    laFenetre = f;
  }

  function oteBouton() {
    if (leBouton) leBouton.remove();
    leBouton = null;
    fermeFenetre();
  }

  function poseBouton() {
    if (leBouton && leBouton.parentNode) return;
    /* La rangée du haut, celle que la mise en page large a marquée. Sans elle,
       pas de bouton : on ne va pas le poser au hasard dans la page du jeu. */
    const haut = laRangee();
    if (!haut) return;
    const b = document.createElement('button');
    b.className = 'cp-bouton';
    b.type = 'button';
    b.textContent = 'copilote';
    b.title = 'Le panneau du copilote : plan, empire, outils, réglages';
    b.addEventListener('click', ouvreFenetre);
    haut.appendChild(b);
    leBouton = b;
  }

  /* Une seule bande en haut, et tout dedans : les ressources, les messages, le
     bouton, les planètes. Chaque morceau avait son cadre et ses marges, ce qui
     faisait six boîtes sur deux lignes au lieu d'une barre. On les range donc
     dans une enveloppe à nous, et les cadres intérieurs disparaissent.
     La ligne du portail garde la sienne, au-dessus : elle est à Gameforge. */
  let laBarre = null, piecesBarre = [];

  function oteBarre() {
    for (const p of piecesBarre) if (p.parent) p.parent.insertBefore(p.noeud, p.suivant);
    piecesBarre = [];
    if (laBarre) laBarre.remove();
    laBarre = null;
  }

  function poseBarre() {
    const haut = laRangee();
    if (!haut) return;
    if (laBarre && laBarre.parentNode === haut) return;
    oteBarre();
    const b = document.createElement('div');
    b.className = 'cp-barre';
    /* Ce qui monte dans la bande : ce qui porte les ressources, ce qui porte
       les messages, les planètes, et notre bouton. Rien d'autre — et surtout
       pas ce que le jeu ajouterait plus tard sans qu'on sache quoi. */
    const pieces = [
      enfantDeColonne(document.getElementById('resources'), 'copilote-rang'),
      document.getElementById('newmessagesindicatorcomponent'),
      laListe,
      leBouton
    ];
    for (const n of pieces) {
      if (!n || !n.parentNode) continue;
      piecesBarre.push({ noeud: n, parent: n.parentNode, suivant: n.nextSibling });
      b.appendChild(n);
    }
    if (!b.children.length) { piecesBarre = []; return; }
    haut.appendChild(b);
    laBarre = b;
  }

  /* Le rail, les planètes et la colonne : ce qui ne dépend pas du contenu de
     la page, et qu'on pose donc partout de la même façon. */
  function poseCadre(lignes) {
    oteRail();
    poseRail(leMenu());
    if (leRail) gardeDansColonne(leRail, 'copilote-col-menu');
    /* La liste partie dans le rail, son flanc n'a plus rien à montrer. Tant
       qu'elle n'est pas partie, il garde ses planètes et perd le reste. */
    gardeDansColonne(document.getElementById('planetList'), 'copilote-col-planetes');
    poseColonne(leCadre, lignes);
    poseFlotte();
    poseBouton();
    poseBarre();
  }

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
  /* Ce que dit une tuile du jeu : son numéro, son nom, son niveau ou son nombre.
     Le clic droit la relit au moment du geste, la peau à chaque dessin : une
     seule lecture, pour que les deux disent la même chose. */
  function lireTuile(li, want) {
    const id = +li.dataset.technology;
    /* Une case se compte ou se monte : un satellite et une foreuse ont un
       nombre, une mine a un niveau. Le jeu les écrit dans deux balises. */
    const niveau = li.querySelector('.level[data-value]');
    const compte = niveau ? null : li.querySelector('.amount[data-value]');
    const niv = niveau || compte;
    /* Le nom vient du jeu d'abord : il le met dans l'étiquette de sa case,
       dans la langue du joueur, et il nomme ce que notre table ignore —
       les formes de vie en ont des dizaines. Notre table ne sert que de
       secours. Le jeu écrit « Mine de métal (niveau 14) » : le niveau est
       déjà dans la carte, on ne le redit pas. */
    const dit = clean(String(li.getAttribute('aria-label') || '').split('(')[0]);
    /* Le jeu marque la case en chantier, et y met le niveau visé : c'est
       là que se lit ce qui monte, et jusqu'où. */
    const actif = li.dataset.status === 'active';
    const vise = clean((li.querySelector('.targetlevel') || {}).textContent);
    return { id, nom: dit || OG_NAMES[id] || ('Tech ' + id), compte: !!compte, actif, vise,
      niv: niv ? +niv.dataset.value || 0 : null, cible: want[id], li };
  }

  /* Ce que dit une tuile de cette planète, et d'où ça vient : { id: { lvl, src } }.
     Trois sources, la cause avant l'effet : ta demande pas encore reprise par le
     panneau (`attente`), ta priorité (`prio`), puis ce que le plan vise
     (`hints`) — la priorité est la raison, la cible du plan n'en est que la suite.
     Une demande à 0 est un retrait : `prioVisee` rend alors null et la tuile
     retombe sur le plan. Une seule union pour la tuile du jeu et pour la carte. */
  function marques(gid) {
    const m = {};
    const ids = new Set([...Object.keys(hints[gid] || {}), ...Object.keys(prio[gid] || {}),
      ...(Array.isArray(asks) ? asks : []).filter(x => x && String(x.gid) === String(gid)).map(x => String(x.tech))
      // la valeur vient du stockage et entre dans un sélecteur : un entier, ou rien
      .filter(id => /^\d+$/.test(id))]);
    for (const id of ids) {
      const v = prioVisee(gid, id, asks);
      if (v != null) m[id] = { lvl: v, src: demandeDe(asks, gid, id) ? 'attente' : 'prio' };
      else if ((hints[gid] || {})[id] !== undefined) m[id] = { lvl: hints[gid][id], src: 'plan' };
    }
    return m;
  }
  const MARQUE = {
    plan: { cls: '', titre: n => 'Copilote : monter au niveau ' + n },
    prio: { cls: ' cp-tag-prio', titre: n => 'Ta priorité : monter au niveau ' + n + '. Clic droit pour la changer.' },
    attente: { cls: ' cp-tag-attente', titre: n => 'Ta priorité : niveau ' + n + ', pas encore confirmée par le panneau. Clic droit pour la changer.' }
  };

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
    const comp = pageCourante();
    if (!tuile || connus.length < 2 || PAGES_COPILOTE.indexOf(comp) < 0) return [];
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
  /* La bande que ce script a posée, et aucune autre : on ne la retrouve pas par
     sa classe. Une page d'alliance affiche du contenu écrit par d'autres
     joueurs, et réécrire — ou retirer — un élément de la page parce qu'il porte
     le même nom que le nôtre serait à la fois faux et grossier. */
  let laBande = null, poses = 0, bandeErr = '';

  function peintBande() {
    const comp = pageCourante();
    if (PAGES_COPILOTE.indexOf(comp) < 0) {
      if (laBande) { laBande.remove(); laBande = null; }
      return;
    }
    const lignes = ((band || {}).pages || {})[comp] || [];
    const pins = pastilles();
    /* Une seule place, sur toutes les pages : sous l'illustration, au-dessus des
       cases. Le jeu range une page à cases ainsi — le titre, l'illustration et
       son panneau de détail (`#technologydetails_wrapper`), puis les cases
       (`#technologies`) — et se poser devant ce dernier bloc met la bande là
       où le regard descend, sans jamais entrer dans une liste de cases : la
       page Recherche en range quatre côte à côte, et s'y glisser la cassait.
       Les pages sans cases — Galaxie, Flotte — la prennent en tête de leur
       contenu. */
    const racine = document.querySelector('#middle .maincontent') || document.getElementById('middle');
    /* Le bloc des cases se déduit d'une vraie case, jamais d'un identifiant
       cherché dans la page : une page d'alliance affiche du balisage écrit par
       d'autres joueurs, et il vit dans ce même contenu. Un nom ne prouve rien,
       une tuile du jeu si. */
    const premiere = document.querySelector('li.technology[data-technology]');
    const cases = premiere && premiere.closest && premiere.closest('#technologies');
    const hote = (cases && cases.parentNode) || racine;
    const vieille = laBande && laBande.parentNode === hote ? laBande : null;
    if (!hote || (!lignes.length && !pins.length)) {
      if (vieille) vieille.remove();
      laBande = null;
      return;
    }
    // ce qu'on veut afficher, zone par zone
    const voulu = [];
    if (lignes.length) voulu.push(['ici', 'à faire sur cette page', lignes.map(l => ({
      /* L'heure tient en un seul morceau : sans espaces insécables, « vers »
         reste accroché à l'action et l'heure tombe seule à la ligne suivante. */
      txt: l.what + (l.ou ? ' · ' + l.ou : '')
        + (l.quand ? ' · ' + String(l.quand).replace(/ /g, ' ') : ''),
      href: l.url || '', titre: l.why || '',
      // grisée quand le plan ne peut pas encore la payer : un état, pas une
      // interdiction — la page reste à un clic
      cls: 'cb-l' + (l.gris ? ' copilote-gris' : '')
    }))]);
    if (pins.length) voulu.push(['tour', 'la même tuile ailleurs', pins.map(p => ({
      txt: p.txt, href: p.href || '', titre: '',
      cls: 'copilote-pin' + (p.ici ? ' copilote-ici' : '') + (p.gris ? ' copilote-gris' : '')
    }))]);
    /* Les manques et les délais bougent sans arrêt. Démolir la bande à chaque
       chiffre la ferait clignoter sous les yeux du joueur : tant que la forme
       ne change pas — mêmes zones, mêmes liens — on réécrit les textes en
       place, et on ne repose la bande que lorsqu'elle change vraiment. */
    const forme = JSON.stringify(voulu.map(([n, , l]) => [n, l.map(x => x.href)]));
    const cle = JSON.stringify(voulu);
    if (vieille && vieille.dataset.cle === cle) return;
    // même forme : on réécrit en place, à condition que la bande soit bien celle
    // qu'on croit — sinon on la repose plutôt que d'écrire à l'aveugle
    if (vieille && vieille.dataset.forme === forme
        && voulu.every(([, , l], i) => vieille.children[i] && vieille.children[i].children.length === l.length)) {
      vieille.dataset.cle = cle;
      voulu.forEach(([, , l], i) => {
        const z = vieille.children[i];
        l.forEach((x, j) => {
          const n = z.children[j];
          n.textContent = x.txt;
          n.className = x.cls;
          if (x.titre) n.title = x.titre;
        });
      });
      return;
    }
    if (vieille) vieille.remove();
    const hud = document.createElement('div');
    hud.className = 'copilote-bande';
    hud.dataset.cle = cle;
    hud.dataset.forme = forme;
    hud.dataset.pose = String(++poses);
    for (const [nom, titre, lignesZone] of voulu) {
      const z = hud.appendChild(document.createElement('div'));
      z.className = 'copilote-zone';
      z.dataset.zone = nom;
      // le titre se dessine en CSS : ce n'est pas une ligne de la zone
      z.dataset.titre = titre;
      for (const x of lignesZone) {
        const n = z.appendChild(document.createElement(x.href ? 'a' : 'div'));
        n.className = x.cls;
        n.textContent = x.txt;
        // le pourquoi tient dans l'infobulle : quatre lignes de raisons
        // rendraient la bande illisible, et elle se lit d'un coup d'œil
        if (x.titre) n.title = x.titre;
        if (x.href) n.href = x.href;
      }
    }
    if (cases && cases.parentNode === hote) hote.insertBefore(hud, cases);
    else if (hote.children[0]) hote.insertBefore(hud, hote.children[0]);
    else hote.appendChild(hud);
    laBande = hud;
  }

  const STYLE = `.copilote-heure{text-decoration:underline dotted;text-underline-offset:3px}
li.technology.copilote-next{position:relative;outline:2px solid #8aa9ff;outline-offset:2px;border-radius:4px}
.copilote-tag{position:absolute;top:3px;right:3px;z-index:5;pointer-events:none;max-width:calc(100% - 6px);
overflow:hidden;background:#8aa9ff;color:#0c1120;font:700 11px/1.5 Arial,sans-serif;padding:0 5px;
border-radius:4px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.5)}
/* Deux teintes : la cible du plan est bleue, ta priorité est ambre ; ta demande
   que le panneau n'a pas encore reprise garde l'ambre, mais en retrait : cerclée
   et atténuée, pour qu'on la voie comme provisoire. */
.copilote-tag.cp-tag-prio{background:#ffc95c}
.copilote-tag.cp-tag-attente{background:#ffc95c;box-shadow:inset 0 0 0 1px #0c1120,0 1px 3px rgba(0,0,0,.5);opacity:.8}
/* Le champ du clic droit et son refus : posés sur la tuile, retirés après.
   Tout est en !important, et la tuile est hissée tant que le champ est ouvert.
   Nos nœuds vivent dans le DOM du jeu, dont la feuille est plus spécifique que
   la nôtre : elle gagnait sur le fond, sur la largeur, et surtout sur le
   z-index — ramené de 50 à 2, le champ passait sous le titre de section, qui
   avalait le clic. Hisser la tuile elle-même, et pas seulement le champ, est
   ce qui tient aussi quand elle fabrique son propre contexte d'empilement :
   un enfant n'en sort jamais, si haut soit son z-index. Ces règles ne visent
   que nos classes, le poids ne déborde donc sur rien du jeu, et tout revient
   en place quand le champ se ferme. */
.cp-prio-hote{position:relative !important;z-index:2147483000 !important}
.cp-prio-champ,.cp-prio-refus{position:absolute !important;left:2px !important;right:2px !important;
bottom:2px !important;width:auto !important;height:auto !important;min-width:0 !important;max-width:none !important;
z-index:2147483000 !important;box-sizing:border-box !important;
margin:0 !important;padding:3px 5px !important;border-radius:3px !important;font:12px/1.3 Arial,sans-serif !important}
.cp-prio-champ{border:1px solid #6f9fff !important;background:#0c1120 !important;color:#e8eefc !important;
-webkit-appearance:none !important;appearance:none !important;text-align:left !important}
.cp-prio-refus{border:1px solid #6f9fff !important;background:#0c1120 !important;color:#e8eefc !important;
pointer-events:none !important;bottom:auto !important;top:2px !important}
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
/* Le panneau de détail d'une case n'est pas dans le flux : le jeu le pose en
   absolu sur le bandeau de titre, toujours 300 px de haut. Les pages dont le
   bandeau en fait 250 lui laissent donc 50 px de trop, qui retombaient sur le
   haut de la bande — on la voyait par-dessous, dépassant du panneau. Le temps
   qu'il est ouvert, le bandeau prend la taille du panneau qui le couvre : la
   bande descend d'autant, et les pages dont le bandeau fait déjà 300 px ne
   bougent pas. */
.maincontent:has(#technologydetails_wrapper.slide-up) > div > header{min-height:300px}
.copilote-bande{display:flex;flex-wrap:wrap;gap:14px;width:100%;box-sizing:border-box;
flex-basis:100%;grid-column:1/-1;
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
    // un script plus neuf a pris la page : le nôtre ne dessine plus
    if (!vivant) return;
    if (!styleFait) {
      styleFait = true;
      const vieille = document.getElementById('copilote-style');
      if (vieille) vieille.remove();
      const st = document.createElement('style');
      st.id = 'copilote-style';
      st.textContent = STYLE + '\n' + LEAN + '\n' + LARGE + '\n' + PEAU;
      document.head.appendChild(st);
    }
    document.documentElement.classList.toggle('copilote-lean', lean);
    /* Le menu vit sur toutes les pages du jeu, celles que le copilote ne
       connaît pas comprises : c'est un moyen d'en partir, pas un conseil. */
    try { peintMenu(); } catch (e) {}
    try { heuresIci(); } catch (e) {}
    /* La largeur se pose avant le reste : la bande et les pastilles se placent
       dans une page dont le cadre a déjà sa forme. */
    try { poseLargeur(); } catch (e) { largeEtat = 'erreur ' + String((e && e.message) || e).slice(0, 40); }
    const dit = marques(meta('planet-id'));
    document.querySelectorAll('li.technology.copilote-next').forEach(li => {
      if (!dit[li.dataset.technology]) {
        li.classList.remove('copilote-next');
        const t = li.querySelector('.copilote-tag');
        if (t) t.remove();
      }
    });
    for (const [tech, m] of Object.entries(dit)) {
      const li = document.querySelector(`li.technology[data-technology="${tech}"]`);
      if (!li) continue;
      li.classList.add('copilote-next');
      // Court exprès : la tuile est petite et affiche déjà son niveau courant
      // en bas. L'infobulle porte la phrase entière.
      let tag = li.querySelector('.copilote-tag');
      if (!tag) { tag = document.createElement('span'); li.appendChild(tag); }
      /* La pastille se met à jour sur place : la source ou le niveau peuvent
         changer sans que la tuile cesse d'être marquée. N'écrire que ce qui
         diffère, sinon la page bouge à chaque dessin et le dessin la rappelle. */
      const v = MARQUE[m.src], txt = '→ ' + m.lvl;
      if (tag.className !== 'copilote-tag' + v.cls) tag.className = 'copilote-tag' + v.cls;
      if (tag.textContent !== txt) tag.textContent = txt;
      if (tag.title !== v.titre(m.lvl)) tag.title = v.titre(m.lvl);
    }
    paintEta();
    /* Le témoin se lit après : une anomalie de la page ne doit pas emporter le
       seul moyen de savoir ce qui s'est passé. */
    try { peintBande(); bandeErr = ''; } catch (e) { bandeErr = String((e && e.message) || e).slice(0, 60); }
    try { peintPeau(); } catch (e) { peauEtat = 'erreur ' + String((e && e.message) || e).slice(0, 40); }
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
      'bande=' + (bandeErr ? 'erreur ' + bandeErr
        : !document.getElementById('middle') ? 'sans-middle'
        : !document.querySelector('.copilote-bande') ? 'rien'
        : (((band || {}).pages || {})[pageCourante()] || []).length
          + ':' + pastilles().length
          // combien de fois la bande a été reposée : si ce compte grimpe seul,
          // c'est le jeu qui l'emporte à chaque rafraîchissement de sa page
          + '@' + poses),
      'menu=' + menuEtat + (noshop ? ' sans-boutique' : ''),
      'large=' + largeEtat,
      'peau=' + peauEtat,
      'ici=' + meta('planet-id'),
      'epure=' + (lean ? 1 : 0)
    ].join(' ');
  }

  try {
    const take = skin => {
      hints = (skin && skin.hints) || {};
      prio = (skin && skin.prio) || {};
      rates = (skin && skin.rates) || {};
      donors = (skin && skin.donors) || {};
      cargo = (skin && skin.cargo) || null;
      lean = !!(skin && skin.lean);
      noshop = !!(skin && skin.noshop);
      large = !!(skin && skin.large);
      peau = !!(skin && skin.peau);
      clair = !!(skin && skin.clair);
      colonne = (skin && skin.colonne) || [];
      teintes = (skin && skin.teintes) || {};
      tour = (skin && skin.tour) || {};
      band = (skin && skin.band) || {};
    };
    chrome.storage.local.get('skin', v => { take(v && v.skin); paint(); });
    /* Un miroir synchrone de `prioAsk` : le dessin d'une carte ne peut pas
       attendre un `get`, qui est asynchrone. Il s'amorce une fois, puis suit
       `onChanged` — qui sonne aussi dans le contexte qui écrit, donc nos
       propres demandes y arrivent sans code en plus. Le panneau vide la clé en
       la retirant : plus de valeur, plus de demande. */
    let askVu = false;
    const prends = l => { asks = Array.isArray(l) ? l : []; paint(); };
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== 'local') return;
      if (ch.skin) { take(ch.skin.newValue); paint(); }
      // un changement plus neuf que l'amorce : la réponse tardive du `get` ne le défait pas
      if (ch.prioAsk) { askVu = true; prends(ch.prioAsk.newValue); }
    });
    try { chrome.storage.local.get('prioAsk', v => { if (!askVu) prends(v && v.prioAsk); }); } catch (e) {}
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
  /* Le refus du clic droit, et le champ qui peut être ouvert : déclarés avant tout
     écouteur qui les appelle. Le refus reste sur la tuile jusqu'au prochain clic
     ou clic droit : il est ancré sur la tuile que le joueur vient de viser, il n'y
     en a jamais qu'un, et un message qui s'efface seul se manque quand les yeux
     sont sur le jeu. */
  let refusEl = null, refusHote = null, fermeChamp = null;
  const effaceRefus = () => {
    if (refusEl) refusEl.remove();
    // l'hôte garde sa position tant qu'un champ y est ouvert
    if (refusHote && !fermeChamp) refusHote.classList.remove('cp-prio-hote');
    refusEl = refusHote = null;
  };
  const refuse = (hote, txt) => {
    effaceRefus();
    refusEl = document.createElement('span');
    refusEl.className = 'cp-prio-refus';
    refusEl.textContent = txt;
    refusHote = hote;
    hote.classList.add('cp-prio-hote');
    hote.appendChild(refusEl);
  };

  /* Un seul écouteur, par délégation : le jeu refait sa liste de tuiles à tout
     bout de champ, et un écouteur par tuile mourrait avec elle. Écouter n'est
     pas cliquer — rien n'est écrit dans la page. */
  document.addEventListener('click', e => {
    effaceRefus();
    const li = e.target && e.target.closest && e.target.closest('li.technology[data-technology]');
    if (!li) return;
    tuileVue = li.dataset.technology || '';
    paint();
  });

  /* Le niveau visé que le joueur a déjà dit pour cette tuile : la demande que la
     page vient de poster l'emporte, car le panneau ne l'a peut-être pas encore
     placée (planète jamais relevée) et `prio` ne la porte pas. Une demande à 0 est
     un retrait : il n'y a plus de cible. Pure, pour que le dessin de la carte
     dise la même chose que le champ.
     @returns {number|null} */
  /* La demande postée pour cette tuile, ou undefined : une par tuile. */
  function demandeDe(liste, gid, tech) {
    return (Array.isArray(liste) ? liste : [])
      .find(x => x && String(x.gid) === String(gid) && String(x.tech) === String(tech));
  }
  function prioVisee(gid, tech, asks) {
    const d = demandeDe(asks, gid, tech);
    if (d) return d.lvl > 0 ? d.lvl : null;
    const p = (prio[gid] || {})[tech];
    return p != null ? p : null;
  }
  /* Une écriture qui échoue le dit sur la tuile : le champ est déjà fermé, et
     sans cela le joueur croirait sa priorité posée. Le cas classique est
     l'extension rechargée, dont le contexte n'existe plus. */
  function ecritAsk(e, hote) {
    const echec = err => {
      console.error('Copilote : priorité non enregistrée', err || (chrome.runtime && chrome.runtime.lastError));
      refuse(hote, 'Pas enregistré : recharge la page.');
    };
    try {
      chrome.storage.local.get('prioAsk', v => {
        try {
          // une demande par tuile : la nouvelle remplace l'ancienne
          const l = (Array.isArray(v && v.prioAsk) ? v.prioAsk : [])
            .filter(x => !(x && String(x.gid) === String(e.gid) && String(x.tech) === String(e.tech)));
          l.push(e);
          chrome.storage.local.set({ prioAsk: l }, () => { if (chrome.runtime.lastError) echec(); });
        } catch (err) { echec(err); }
      });
    } catch (err) { echec(err); }
  }
  function poseChamp(hote, t, gid, asks) {
    effaceRefus();
    if (fermeChamp) fermeChamp();
    const connue = prioVisee(gid, t.id, asks);
    const champ = document.createElement('input');
    champ.className = 'cp-prio-champ';
    champ.type = 'text';
    champ.setAttribute('inputmode', 'numeric');
    champ.setAttribute('aria-label', 'Niveau visé pour ' + t.nom);
    champ.value = String(connue != null ? connue : t.niv + 1);
    hote.classList.add('cp-prio-hote');
    hote.appendChild(champ);
    let fini = false;
    const ferme = () => {
      if (fini) return;
      fini = true; champ.remove(); fermeChamp = null;
      hote.classList.remove('cp-prio-hote');
      // la faute de frappe corrigée ne laisse pas son reproche sur la tuile
      effaceRefus();
    };
    fermeChamp = ferme;
    champ.addEventListener('click', e => e.stopPropagation());
    champ.addEventListener('keydown', e => {
      // un script de la page ne valide pas à la place du joueur
      if (!e.isTrusted) return;
      e.stopPropagation();
      if (e.key === 'Escape') { ferme(); return; }
      if (e.key !== 'Enter') return;
      // dans un formulaire, Entrée enverrait la page avec la demande
      e.preventDefault();
      const raw = champ.value.trim();
      /* Un champ vidé ne dit pas la même chose qu'une faute de frappe : le
         premier retire, la seconde se corrige. Le jeu lit en chaîne, et
         `parseInt('12abc')` ferait 12. */
      if (!/^\d*$/.test(raw)) { refuse(hote, 'Un nombre entier, ou rien pour retirer.'); return; }
      /* L'intention se tranche ici, là où le joueur l'a formée : au niveau déjà
         atteint ou au-dessous, c'est un retrait (0) ; le panneau ne le devine pas.
         Un champ vidé vaut Number('') = 0, donc tombe dans ce cas sans branche à lui. */
      const lvl = +raw <= t.niv ? 0 : +raw;
      ferme();
      ecritAsk({ gid, tech: t.id, nom: t.nom, lvl, at: Date.now() }, hote);
    });
    champ.addEventListener('blur', ferme);
    champ.focus();
    champ.select();
  }
  /* Le clic droit sur une tuile pose une priorité. Même délégation que le clic :
     le jeu refait ses listes, un écouteur par tuile mourrait avec elles.
     Deux tuiles possibles : celle du jeu, et la carte de notre peau, qui n'est
     jamais dans une `li.technology` — la carte renvoie à la tuile du jeu, seule
     à dire le niveau. Hors de l'une et de l'autre, l'événement n'est pas touché :
     le menu du navigateur reste l'outil du joueur. */
  document.addEventListener('contextmenu', e => {
    // un geste fabriqué par un script de la page n'écrit rien dans le stockage
    if (!e.isTrusted) return;
    const cible = e.target;
    if (!cible || !cible.closest) return;
    if (cible.classList && cible.classList.contains('cp-prio-champ')) return;
    effaceRefus();
    let hote = cible.closest('li.technology[data-technology]'), li = hote;
    if (!hote) {
      hote = cible.closest('.cp-case[data-technology]');
      /* La valeur vient d'un attribut du DOM, qu'une page de joueurs peut avoir
         écrit : elle entre dans un sélecteur, donc elle est un entier ou rien. */
      const id = hote && hote.dataset.technology;
      if (hote && /^\d+$/.test(id || '')) li = document.querySelector('li.technology[data-technology="' + id + '"]');
    }
    if (!hote || !li) return;
    const t = lireTuile(li, hints[meta('planet-id')] || {});
    /* Deux refus, et la tuile dit lequel : le jeu donne un niveau à des cases
       que le moteur ne modélise pas (Terraformeur, Dock spatial, Silo), et n'en
       donne pas à celles qui se comptent ni aux recherches de forme de vie.
       Le menu du navigateur n'est volé qu'à une tuile qu'on traite. */
    /* `niv` lit aussi le nombre d'un satellite : c'est `compte` qui dit qu'il ne se monte pas. */
    if (t.compte || t.niv == null) { refuse(hote, 'Pas de priorité ici : cette case n\'a pas de niveau.'); return; }
    if (!(OG_BUILD[t.id] || OG_TECH[t.id] || t.id >= 11000)) {
      refuse(hote, 'Le copilote ne gère pas encore cette technologie.'); return;
    }
    /* Sans planète lue, le panneau jetterait la demande — même une recherche,
       qui n'en a pas besoin : il la range par `gid`. On le dit sur place. */
    const gid = meta('planet-id');
    if (!gid) { refuse(hote, 'Planète introuvable sur cette page.'); return; }
    e.preventDefault();
    /* Les demandes déjà postées sont dans le miroir : le panneau en retire dès
       qu'il les a placées, et le miroir suit. */
    poseChamp(hote, t, gid, asks);
  });
  /* L'arrivée d'un script neuf. Il s'annonce avant de peindre, et celui qui
     l'entend se retire : il enlève ce qu'il a posé et cesse de dessiner.
     Sans cela, deux bandes et deux panneaux se répondaient dans la page à
     chaque rechargement de l'extension.
     On s'annonce avant d'écouter, sinon on se retire soi-même. Et on ne
     touche pas à la feuille de style : celle qui est dans la page est déjà
     celle du neuf, qui la repose en arrivant. */
  const ARRIVEE = 'copilote:arrivee';
  document.dispatchEvent(new Event(ARRIVEE));
  document.addEventListener(ARRIVEE, () => {
    if (!vivant) return;
    vivant = false;
    try {
      // la peau se retire par le même chemin que le bouton « page du jeu »
      peauRevelee = true;
      peintPeau();
    } catch (e) {}
    if (laBande) { laBande.remove(); laBande = null; }
    document.documentElement.classList.remove('copilote-large');
    document.documentElement.classList.remove('copilote-lean');
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
