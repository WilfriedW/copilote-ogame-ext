/* La file d'actions : modèle, classement, et les sources que le reste du code
   ne calcule pas. Logique pure, sans DOM — voir test/run.js. */

/* Une Action :
   id       string   clé de rendu stable (survit aux rafraîchissements)
   family   string   'mine'|'recherche'|'expedition'|'espionnage'|'raid'
                     |'colonisation'|'formevie'|'recyclage'|'abri'|'fraicheur'
   label    string   'Monte la Mine de cristal 13'
   why      string   une phrase
   how      string[] | null   étapes « première fois »
   cost     [m,c,d] | null
   loss     bool     une perte court tant que ce n'est pas fait
   blocked  null | {kind:'eta', secs} | {kind:'miss', res:[m,c,d]}
                  | {kind:'storage'} | {kind:'stale', page}
   payback  number | null    heures, plus petit est meilleur
   confirm  'game' | 'snooze'
   snoozeHours number | null
   running  null | {endsAt, label}   si posée, l'action est « en cours »
   detail   object | null   charge utile du volet déplié
   launch   object | null   charge utile de data-launch */

/* ---------- adaptation des sources existantes ---------- */

/* Les actions de la projection portent déjà un `kind` : il suffit à nommer la
   famille. Les files (`q`) servent de repli pour les attentes et les en-cours. */
const ACT_FAMILY = {
  b: 'mine', sats: 'mine', t: 'recherche', ship: 'colonisation',
  fleet: 'colonisation', expo: 'expedition', transfer: 'chantier', shipbuild: 'chantier'
};
const MISSION_FAMILY = {
  'Colonie': 'colonisation', 'Flotte': 'expedition', 'Exploration': 'formevie',
  'Formes de vie': 'formevie', 'Pillage': 'raid', 'Sécurité': 'abri'
};

/** Identifiant stable : dérivé du contenu, jamais de l'index ni de l'heure. */
function slug(s) {
  return String(s == null ? '' : s).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

/** Famille déduite du nom d'une file de jeu. */
function familyOfQueue(q) {
  const s = String(q || '');
  if (/^Recherche/.test(s)) return 'recherche';
  if (/^Chantier/.test(s)) return 'chantier';
  if (/^Flotte/.test(s)) return 'expedition';
  return 'mine';
}

/** Gabarit d'action : tous les champs présents, pour que le classement ne devine rien. */
function action(over) {
  return Object.assign({
    id: '', family: 'mine', label: '', why: '', how: null, cost: null,
    loss: false, blocked: null, payback: null, confirm: 'game',
    snoozeHours: null, running: null, detail: null, launch: null
  }, over);
}

/**
 * Convertit les sources existantes en actions.
 * @param {object} plan sortie de project()
 * @param {object[]} missions sortie de dailyMissions(), déjà filtrée des faites
 * @param {number} now horodatage courant
 * @returns {object[]} actions, non classées
 */
function collect(plan, missions, now) {
  const first = (plan && plan.first) || { acts: [], waits: [] };
  const out = [];

  for (const a of first.acts || []) {
    const family = ACT_FAMILY[a.kind] || familyOfQueue(a.q);
    out.push(action({
      id: family + ':' + slug(a.what), family, label: a.what, why: a.why || '',
      cost: a.cost || null, payback: a.payback == null ? null : a.payback,
      // Un slot d'expédition inoccupé perd une rotation par heure. Une file de
      // construction libre est l'état normal de toute action de construction :
      // la traiter en perte mettrait la file entière au rang 0 (voir le ledger).
      loss: family === 'expedition',
      launch: { kind: a.kind, k: a.k, lvl: a.lvl, p: a.p, n: a.n, ships: a.ships,
        cost: a.cost, coords: a.coords, dur: Math.round(a.dur || 0), what: a.what }
    }));
  }

  for (const w of first.waits || []) {
    const family = familyOfQueue(w.q);
    const reachable = isFinite(w.eta);
    out.push(action({
      id: family + ':' + slug(w.what), family, label: w.what,
      why: w.held ? 'Les ressources partent d\'abord dans la réserve d\'une recherche en cours de financement.' : '',
      blocked: reachable
        ? { kind: 'eta', secs: Math.max(0, Math.round(w.eta)), res: w.miss || null }
        : { kind: 'storage', res: w.miss || null },
      loss: !reachable
    }));
  }

  for (const b of (plan && plan.busy) || []) {
    out.push(action({
      id: 'busy:' + slug(b.q + '-' + b.what), family: familyOfQueue(b.q),
      label: b.what, running: { endsAt: b.end, label: b.what }
    }));
  }

  for (const m of missions || []) {
    const family = MISSION_FAMILY[m.q] || slug(m.q) || 'autre';
    out.push(action({
      // l'identifiant reste celui de la mission : S.daily.done et missionDone s'en servent
      id: m.id, family, label: m.what, why: m.why || '',
      how: m.how && m.how.length ? m.how : null,
      loss: m.sev === 'bad' || m.id === 'fleetslots',
      confirm: 'snooze', snoozeHours: m.every == null ? 24 : m.every,
      detail: m.at ? { at: m.at } : null
    }));
  }

  return out;
}

/* ---------- mise à l'abri et recyclage ---------- */

/* Vitesses de vol proposées par le jeu, de la plus rapide à la plus lente. */
const SPEEDS = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];

/**
 * Que faire de tes ressources avant de dormir.
 * Apparaît dans l'heure qui précède la nuit, et seulement si des transporteurs
 * sont à quai. Choisit la vitesse la plus rapide qui fait quand même rentrer la
 * flotte après ton réveil.
 * @param {object[]} planets planètes avec `coords`, `ships`, `stock`
 * @param {{cargoEff:function, flightSecs:function}} stats soute et durées de vol
 * @param {{start:number, startMs:number, endMs:number, isNight:function}} night fenêtre de nuit
 * @param {number} now horodatage courant
 * @returns {object|null} action, ou null s'il n'y a rien à proposer
 */
function fleetsaveAction(planets, stats, night, now) {
  if (!night || !night.startMs || !night.endMs) return null;
  if (night.isNight && night.isNight(now)) return null;
  if (now < night.startMs - 3600e3 || now >= night.startMs) return null;

  const list = (planets || []).filter(Boolean);
  const load = p => { const s = p.stock || {}; return (s.m || 0) + (s.c || 0) + (s.d || 0); };
  const from = list.slice().sort((a, b) => load(b) - load(a))[0];
  if (!from || load(from) <= 0) return null;

  const need = load(from), ships = {};
  let cap = 0;
  for (const k of ['lc', 'sc']) {
    const have = (from.ships || {})[k] || 0, unit = stats.cargoEff(k);
    if (!have || !unit || cap >= need) continue;
    const n = Math.min(have, Math.ceil((need - cap) / unit));
    if (n > 0) { ships[k] = n; cap += n * unit; }
  }
  if (!Object.keys(ships).length) return null;

  // Vers une autre planète si tu en as une ; sinon une expédition, qui garde la
  // flotte en l'air aussi bien. La durée vient de `stats`, pas d'ici.
  const other = list.find(p => p !== from && p.coords);
  const c = String(from.coords || '').split(':').map(Number);
  const dest = other ? other.coords : (c.length === 3 && c.every(x => !isNaN(x)) ? c[0] + ':' + c[1] + ':16' : null);
  if (!dest) return null;
  const mission = other ? 'transport' : 'expedition';

  let pct = null, backAt = null;
  for (const s of SPEEDS) {
    const secs = stats.flightSecs(from.coords, dest, ships, s);
    if (!isFinite(secs) || secs <= 0) continue;
    const back = now + 2 * secs * 1000;
    if (back > night.endMs) { pct = s; backAt = back; break; }
  }
  if (backAt == null) {
    const secs = stats.flightSecs(from.coords, dest, ships, 10);
    if (!isFinite(secs) || secs <= 0) return null;
    pct = 10; backAt = now + 2 * secs * 1000;
  }

  const fleet = Object.keys(ships).map(k => ships[k] + ' ' + (k === 'lc' ? 'grand' : 'petit') +
    ' transporteur' + (ships[k] > 1 ? 's' : '')).join(' et ');
  return action({
    id: 'abri:nuit', family: 'abri',
    label: 'Mets tes ressources à l\'abri avant ' + night.start + ' h',
    why: 'Une planète pleine pendant ton sommeil est une cible. Envoie ' + fleet +
      ' vers ' + dest + ' à ' + pct + ' %.',
    how: [
      'Dépense d\'abord tout ce que tu peux : lance une construction longue et une recherche.',
      'Charge le reste dans tes transporteurs et envoie-les vers ' + dest +
        (mission === 'transport' ? ' en mission Transporter.' : ' en mission Expédition.'),
      'Règle la vitesse sur ' + pct + ' % : la flotte rentre après ton réveil, hors de portée pendant la nuit.'
    ],
    loss: true, confirm: 'snooze', snoozeHours: 24,
    detail: { ships, dest, pct, mission, backAt, load: need, from: from.name }
  });
}

/**
 * Rappel d'aller voir si une expédition a laissé un champ de débris.
 * Sans chiffres : l'extension ne voit pas les champs de débris, qui ne sont ni
 * sur la page affichée ni dans les fichiers publics de l'univers.
 * Se branche sur les minuteurs et non sur les mouvements de flotte : un
 * mouvement déjà arrivé est effacé au premier instantané suivant, donc la
 * fenêtre d'une heure ne s'ouvrait jamais.
 * @param {object[]} timers minuteurs connus, `end` en millisecondes
 * @param {number} now horodatage courant
 * @returns {object|null}
 */
function recycleAction(timers, now) {
  const rentree = (timers || []).some(t => t && t.kind === 'x' && t.k === 'expo' &&
    t.end <= now && now - t.end <= 3600e3);
  if (!rentree) return null;
  return action({
    id: 'recyclage:expedition', family: 'recyclage',
    label: 'Va voir si ton expédition a laissé un champ de débris',
    why: 'Une expédition qui tombe sur une flotte la détruit et laisse des débris sur place. Personne ne te prévient : il faut aller regarder.',
    how: [
      'Un recycleur est un vaisseau qui ramasse les débris. Il faut en construire au chantier spatial avant de pouvoir recycler.',
      'Galaxie : va sur la position de ton expédition. Un champ de débris s\'affiche sous le numéro de position.',
      'S\'il y en a, envoie tes recycleurs dessus en mission Recycler. Sinon il n\'y a rien à faire.'
    ],
    confirm: 'snooze', snoozeHours: 2
  });
}

/* ---------- la fraîcheur des données ---------- */

/* Au-delà de cet âge, la donnée ne porte plus de conseil sûr. Ordre : la plus
   structurante d'abord, pour départager deux données également périmées. */
const STALE = [
  { key: 'levels', hours: 48, page: 'Recherche', what: 'tes niveaux',
    families: ['mine', 'recherche', 'chantier'] },
  { key: 'ships', hours: 12, page: 'Flotte', what: 'ta flotte à quai',
    families: ['expedition', 'abri', 'colonisation'] },
  { key: 'slots', hours: 3, page: 'Mouvements de flotte', what: 'tes emplacements de flotte',
    families: ['expedition'] },
  { key: 'moves', hours: 1, page: 'Mouvements de flotte', what: 'tes flottes en vol',
    families: ['expedition', 'recyclage'] }
];

/** Âge en français, au jour ou à l'heure près. */
function ageText(ms) {
  const h = Math.floor(ms / 3600e3);
  if (h >= 24) { const j = Math.floor(h / 24); return j + ' jour' + (j > 1 ? 's' : ''); }
  return Math.max(1, h) + ' heure' + (h > 1 ? 's' : '');
}

/**
 * Propose d'ouvrir une page du jeu, au plus une à la fois.
 * Ne dérange que lorsque la donnée périmée bloque vraiment quelque chose :
 * sinon la corvée du tour des onglets revient par la fenêtre.
 * @param {object} seen dernière lecture de chaque donnée, en millisecondes
 * @param {number} now horodatage courant
 * @param {string[]} blockedFamilies familles ayant au moins une action bloquée
 * @returns {object|null}
 */
function freshnessAction(seen, now, blockedFamilies) {
  const s = seen || {};
  const attend = blockedFamilies || [];
  if (!STALE.some(x => s[x.key])) {
    return action({
      id: 'fraicheur:accueil', family: 'fraicheur',
      label: 'Ouvre une page du jeu, je lis tout seul',
      why: 'Je n\'ai encore rien vu de ton empire. Va sur n\'importe quelle page d\'OGame : je relève tes niveaux, tes ressources et tes files au passage.',
      blocked: { kind: 'stale', page: 'n\'importe laquelle' },
      // une perte : tant que je n'ai rien lu, tout ce que je conseille est faux
      loss: true, confirm: 'snooze', snoozeHours: 1
    });
  }

  // une donnée jamais vue est périmée, pas fraîche
  const perimee = x => s[x.key] == null || now - s[x.key] > x.hours * 3600e3;
  const vieille = STALE
    .filter(x => perimee(x) && x.families.some(f => attend.indexOf(f) >= 0))
    .sort((a, b) => (s[a.key] || 0) - (s[b.key] || 0))[0];
  if (!vieille) return null;

  const age = s[vieille.key] == null ? null : ageText(now - s[vieille.key]);
  return action({
    id: 'fraicheur:' + vieille.key, family: 'fraicheur',
    label: 'Ouvre la page ' + vieille.page,
    why: (age ? 'Je ne vois ' + vieille.what + ' que tels qu\'ils étaient il y a ' + age + '.'
               : 'Je n\'ai jamais vu ' + vieille.what + '.') +
      ' Passe sur la page, je relis tout seul.',
    blocked: { kind: 'stale', page: vieille.page },
    loss: true, confirm: 'snooze', snoozeHours: 1
  });
}

/* ---------- l'apprentissage ---------- */

/**
 * Une action d'une famille jamais exécutée s'explique ; ensuite elle se tait.
 * @param {object} a action
 * @param {object} learned {famille: horodatage du premier clic}
 * @returns {boolean}
 */
function shouldExpand(a, learned) {
  if (!a || !a.how || !a.how.length) return false;
  return !((learned || {})[a.family]);
}

/* ---------- classement ---------- */

/**
 * Rang d'une action : ce qui se perd d'abord, le faisable avant le bloqué.
 * @param {object} x action
 * @returns {number} 0 perte faisable, 1 faisable, 2 perte bloquée, 3 bloqué
 */
function rankOf(x) { return (x.loss ? 0 : 1) + (x.blocked ? 2 : 0); }

/**
 * Distance d'un blocage, pour départager deux actions de même rang.
 * Un hangar trop petit ou un manque sans échéance n'a rien à attendre de
 * précis : il passe en dernier, sans qu'aucun Infinity soit écrit sur l'action.
 * @param {object|null} b champ `blocked`
 * @returns {number} secondes, ou Infinity
 */
function blockKey(b) {
  if (!b) return 0;
  if (b.kind === 'eta') return b.secs;
  if (b.kind === 'stale') return 0;
  return Infinity;
}

/**
 * Classe la file et en extrait les trois blocs de l'écran.
 * @param {object[]} actions actions brutes, dans n'importe quel ordre
 * @param {number} now horodatage courant
 * @returns {{now: object|null, banner: object|null, next: object[], busy: object[]}}
 */
function rankActions(actions, now) {
  const list = (Array.isArray(actions) ? actions : []).filter(Boolean);
  const busy = list.filter(x => x.running)
    .sort((p, q) => (p.running.endsAt || 0) - (q.running.endsAt || 0));

  const sorted = list.filter(x => !x.running)
    .map((x, i) => ({ x, i }))
    .sort((p, q) => {
      const r = rankOf(p.x) - rankOf(q.x);
      if (r) return r;
      const bp = blockKey(p.x.blocked), bq = blockKey(q.x.blocked);
      if (bp !== bq) return bp < bq ? -1 : 1;
      const pp = p.x.payback == null ? Infinity : p.x.payback;
      const pq = q.x.payback == null ? Infinity : q.x.payback;
      if (pp !== pq) return pp < pq ? -1 : 1;
      return p.i - q.i;
    })
    .map(e => e.x);

  const act = sorted.find(x => !x.blocked) || null;
  const banner = sorted.find(x => x.blocked && x.loss) || null;
  return { now: act, banner, next: sorted.filter(x => x !== act && x !== banner), busy };
}
