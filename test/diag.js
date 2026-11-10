/* node test/diag.js mon-etat.json — rejoue l'état réel du joueur.

   Quand le joueur dit « je ne vois rien », il n'y a qu'un moyen honnête de
   savoir pourquoi : charger son état et lire ce que l'application en fait.
   Le JSON vient du bouton « Copier mes données » dans Outils. */
const { loadApp } = require('./harness');

const chemin = process.argv[2];
if (!chemin) { console.error('usage : node test/diag.js <etat.json>'); process.exit(1); }
const S = JSON.parse(require('fs').readFileSync(chemin, 'utf8'));
const now = Date.now();

const g = loadApp(S, now, ['S', 'dailyMissions', 'simulateDay', 'expoCap', 'expoWanted',
  'astroForExpo', 'fleetSlots', 'expoFleet', 'planetRef', 'nextResearch'], null, false);

const ligne = (k, v) => console.log(k.padEnd(28) + ' ' + v);

console.log('--- ce que l\'application sait ---');
ligne('Astrophysique', g.S.tech.astro);
ligne('classe', g.S.settings.cls);
ligne('tranche top 1', g.S.settings.top1);
ligne('slots lus', JSON.stringify(g.S.slots || null));
ligne('dernière synchro', g.S.syncAt ? new Date(g.S.syncAt).toLocaleString('fr-FR') : 'jamais');
ligne('emplacements de flotte', JSON.stringify(g.fleetSlots()));

console.log('\n--- le plafond ---');
ligne('plafond retenu', g.expoCap());
ligne('expéditions remplissables', g.expoWanted());
ligne('palier Astro utile', g.astroForExpo());
ligne('carte « plafond » ?', g.expoWanted() > g.expoCap() ? 'oui' : 'NON : la flotte ne remplirait pas plus que le plafond');

console.log('\n--- flotte au sol, planète par planète ---');
for (const p of g.S.planets) {
  const f = g.expoFleet(Object.assign({}, p.ships));
  ligne(g.planetRef(p), JSON.stringify(p.ships || {}) + ' → ' +
    (f ? `1 expédition (soute ${f.cargo} pour ${f.cap} max)` : 'aucune expédition possible'));
}

console.log('\n--- ce que le plan propose ---');
const j = g.simulateDay();
const s1 = j.sessions[0] || { acts: [], waits: [] };
for (const a of s1.acts) console.log('  ' + a.q + ' — ' + a.what);
console.log('expéditions dans la 1re session : ' + s1.acts.filter(a => a.kind === 'expo').length);

console.log('\n--- recherches en file ---');
const nr = g.nextResearch();
console.log(nr.list.map(r => r.k + ' ' + r.lvl + (r.crit ? ' (critique)' : '') + (r.why ? ' — ' + r.why : '')).join('\n') || '(aucune)');

console.log('\n--- cartes du jour ---');
console.log(g.dailyMissions().map(m => m.id + ' : ' + m.what).join('\n'));
