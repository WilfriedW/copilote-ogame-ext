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
      id: family + ':' + slug(m.id), family, label: m.what, why: m.why || '',
      how: m.how && m.how.length ? m.how : null,
      loss: m.sev === 'bad' || m.id === 'fleetslots',
      confirm: 'snooze', snoozeHours: m.every == null ? 24 : m.every,
      detail: m.at ? { at: m.at } : null
    }));
  }

  return out;
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
