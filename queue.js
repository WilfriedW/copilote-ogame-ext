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
