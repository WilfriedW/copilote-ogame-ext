# Les règles du moteur — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Les règles du catalogue « Conseils et alertes » agissent sur le
moteur : elles poussent des candidats que la simulation paie, marquent les
cartes que le plan sort déjà, suspendent ce qui dépend d'une donnée manquante,
et ne signalent que ce à quoi le plan n'a rien à répondre. Elles sont décrites
dans `rules.json`, et le joueur les règle sans toucher au code.

**Architecture:** `rules.json` est lu par `boot.js` avant `app.js` et posé
dans `window.__rules`. L'accesseur `regle(id)` fusionne le fichier et les
réglages du joueur (`S.settings.regles`). Une fonction pure `constats()` lit
l'état réel et rend les constats ; `simulateDay` l'appelle avant de remplacer
l'état, au même endroit que `planetAlerts`, et fait passer chaque constat à
son point d'entrée : `pickBuildings` (pousser), la feuille de route (pousser),
`lfPass` (suspendre), les cartes de la première connexion (marquer), le bloc
des conseils (signaler). `applyGame` l'appelle aussi, pour publier le compte
des critiques que le service worker met sur l'icône.

**Tech Stack:** JavaScript sans dépendance, extension Chrome MV3. Tests :
`node test/run.js`, faux DOM maison (`test/harness.js`), pas de framework.

**Spec:** `docs/superpowers/specs/2026-11-26-regles-du-moteur-design.md`

## Global Constraints

- **Chaque commit monte la version** : `APP_VERSION` (`app.js:1`) et
  `version` dans `manifest.json`, les deux à la même valeur. Un test le garde
  (`test/run.js:3733`).
- Commits en français, sujet à l'intention, corps expliquant le pourquoi,
  terminés par `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **`constats()` n'écrit jamais**, ni dans `S`, ni dans le stockage. Comme
  `prios()` : `simulateDay` remplace `S.planets` et `S.tech` par ses copies,
  et un accesseur à effet de bord écrirait sur une prévision. Le nettoyage
  d'« Ignorer » se fait dans `render()`, hors simulation.
- **Un poids 0 coupe la règle avant la simulation** : `constats()` ne rend pas
  une règle dont `poidsCat(cat)` vaut 0. On ne masque jamais une carte que la
  simulation a payée (`app.js:4147`).
- **Une règle à `verrou` ne se désactive pas.** `regle(id).on` vaut `true`
  quoi que dise `S.settings.regles`.
- **Une planète se désigne par son id local** (ADR 0001). Ce qui voyage
  (`S.daily`, `S.settings`) porte des `gid`, sur le patron de `prioOut`
  (`app.js:8253`). Ce qui vise une planète sans voyager reste sur la planète
  (`p.regOff`, `p.race`).
- **Rien ne navigue sans clic.** « Scanner » est un `data-go`, comme toutes les
  cartes.
- **Pas de règle qui parle sans que le plan bouge** : chaque tâche qui ajoute
  une règle à effet `pousser` ou `marquer` a un test sur `simulateDay()`, pas
  seulement sur `constats()`.
- Chaque tâche finit par `node test/run.js` au vert sur **toute** la suite.
- Les tâches de la vague 3 (formes de vie) attendent la tâche 13, qui est un
  relevé à faire **dans le jeu**, par le joueur.

## Review Focus

| Entrée que la spec n'exerce pas | Comportement attendu | Tâche |
| --- | --- | --- |
| `rules.json` absent, illisible, ou sans `regles` | une seule erreur console, le plan d'avant, l'en-tête le dit | 1 |
| une règle du fichier dont `condition` n'a pas d'évaluateur | ignorée avec une erreur console nommant l'id, les autres tournent | 1 |
| `S.settings.regles` abîmé : `on` non booléen, seuil non numérique, id inconnu, `__proto__` | entrée ignorée, valeur du fichier, aucune exception | 2 |
| profil sans style (`S.profil.style === ''`, l'état d'usine) | RES_MINE_BALANCE n'est pas évaluée : pas de cible sans style | 10 |
| planète sans coordonnées lisibles (`parseC` rend `null`) | RES_MINE_BALANCE n'est pas évaluée pour elle | 10 |
| mode nuit : `REFRESH.today` vide `acts` et `waits` | les constats restent calculés et le badge compte, le bloc des conseils reste lisible | 7 |
| données d'exemple (`S.sample`, ou hors extension) | aucun nettoyage d'« Ignorer » | 8 |
| deux planètes au même `gid` | la clé d'« Ignorer » ne boucle pas et ne lève pas | 8 |
| panneau fermé pendant qu'une file finit | le badge montre les files finies, pas un vieux compte de critiques | 6 |
| race posée à la main sur une planète sans aucune case lue | la race est connue, les noms manquent : FDV_DATA_MISSING « noms inconnus » | 14, 16 |
| `constats()` sur dix planètes, chacune avec douze cases de forme de vie | moins de 50 ms | 19 |

---

## Vague 1 — le socle

### Task 1 : `rules.json` et son chargement

**Files:**
- Create: `rules.json`
- Modify: `boot.js` — lecture avant `app.js`
- Modify: `test/harness.js:103` — le harnais pose `window.__rules`
- Modify: `pack.sh` — `FICHIERS` emporte `rules.json`
- Modify: `test/run.js:3753` — le test de `pack.sh` reconnaît les `.json` cités
- Modify: `app.js` — `REGLES`, `EVAL` (vide), garde de chargement
- Test: `test/run.js`

**Interfaces:**
- Consumes: `window.__rules` (objet, ou `null` si la lecture a échoué)
- Produces:
  - `REGLES` → `{version, regles:[…], mineBalance, lifeforms}`, ou un
    squelette vide `{regles:[], mineBalance:{byStyle:{}, byPosition:{}},
    lifeforms:{}}` quand le fichier manque.
  - `REGLES_ERR` → `''` ou la raison, que l'en-tête affiche.
  - `EVAL` → `{[condition]: (p, prm, ctx) => constat[] }`, vide à cette tâche.

- [ ] **Step 1 : Écrire les tests qui échouent.** Ajouter `'REGLES'`,
  `'REGLES_ERR'`, `'EVAL'` aux exports de `app()`. Le harnais prend un
  septième argument `rules` (défaut : le vrai fichier).

```js
/* ---------- les règles du moteur : le fichier ---------- */
t('rules.json se lit, et chaque règle a ce qu\'il lui faut', () => {
  const g = app();
  assert.equal(g.REGLES_ERR, '');
  const ids = new Set();
  for (const r of g.REGLES.regles) {
    assert.ok(!ids.has(r.id), 'id en double : ' + r.id); ids.add(r.id);
    assert.ok(['ressources','installations','recherche','formes_de_vie'].includes(r.domaine), r.id);
    assert.ok(['critique','important','conseil'].includes(r.niveau), r.id);
    assert.ok(['pousser','marquer','suspendre','signaler'].includes(r.effet), r.id);
    assert.ok(['valide','a_valider'].includes(r.statut), r.id);
    assert.ok(r.domaine === 'formes_de_vie' ? !r.cat : g.PROFILS.cats[r.cat], r.id + ' : cat');
  }
});

t('un fichier de règles illisible laisse tourner le plan d\'avant', () => {
  const g = appRegles(null);
  assert.match(g.REGLES_ERR, /illisible/);
  assert.deepEqual(g.REGLES.regles, []);
  assert.ok(g.simulateDay().sessions.length, 'le plan tourne quand même');
});
```

`appRegles(rules, modifier)` est une variante d'`app()` qui passe `rules` au
harnais ; à écrire à côté d'`app()`.

- [ ] **Step 2 : Lancer les tests pour les voir échouer**

Run: `node test/run.js`
Expected: FAIL — `REGLES is not defined`.

- [ ] **Step 3 : Créer `rules.json`** avec `version: 1`, `regles: []`,
  `mineBalance` (valeurs de la spec), `lifeforms` (la table des Humains de
  l'annexe de l'issue, et les trois autres races vides, `idPrefix` compris,
  chacune avec `"statut": "a_valider"`). Les règles arrivent tâche par tâche.

- [ ] **Step 4 : Lire le fichier dans `boot.js`**, avant d'appeler `go()` :
  `fetch(chrome.runtime.getURL('rules.json')).then(r => r.json())` →
  `window.__rules`, et `window.__rules = null` sur échec, avec **une**
  `console.error`. Même patron que `versions.tsv` (`app.js`, fin de fichier).

- [ ] **Step 5 : Poser `REGLES`, `REGLES_ERR` et `EVAL`** en tête d'`app.js`,
  après `PROFILS`. Un objet qui n'a pas de tableau `regles` compte comme
  illisible. Le harnais lit `rules.json` avec `fs` et le pose dans
  `window.__rules`.

- [ ] **Step 6 : Emporter le fichier.** Ajouter `rules.json` à `FICHIERS` dans
  `pack.sh`, et faire reconnaître `.json` au relevé des noms cités du test
  `pack.sh emporte tout ce que Chrome charge` — sinon un `rules.json` oublié ne
  serait pas vu.

- [ ] **Step 7 : Lancer les tests**

Run: `node test/run.js`
Expected: PASS, toute la suite.

- [ ] **Step 8 : Commit**

```bash
git add rules.json boot.js pack.sh app.js manifest.json test/harness.js test/run.js
git commit -m "feat: les règles du moteur se décrivent dans rules.json"
```

---

### Task 2 : `regle(id)`, le fichier et le joueur

**Files:**
- Modify: `app.js` — `regle`, `regleSaine`, fusion au chargement de `S.settings.regles`
- Test: `test/run.js`

**Interfaces:**
- Consumes: `REGLES`, `S.settings.regles`
- Produces:
  - `regle(id)` → la règle du fichier, `on` et `parametres` remplacés par ceux
    du joueur, ou `null` si l'id n'existe pas. `on` vaut toujours `true` sous
    `verrou`.
  - `regleSaine()` → nettoie `S.settings.regles` : id inconnu, `on` non
    booléen, paramètre absent du fichier ou non fini → retiré. Appelée au
    chargement.
  - `gabarit(texte, vars)` → `{x}` et `{x+1}` remplacés ; une variable
    inconnue reste écrite telle quelle.

- [ ] **Step 1 : Tests qui échouent.** Exports : `'regle'`, `'regleSaine'`,
  `'gabarit'`.

```js
const DEUX_REGLES = { version: 1, mineBalance: {byStyle:{}, byPosition:{}}, lifeforms: {},
  regles: [
    { id: 'A', domaine: 'installations', cat: 'infra', niveau: 'important', condition: 'test',
      effet: 'signaler', parametres: { seuil: 10 }, statut: 'valide', actif_par_defaut: true },
    { id: 'B', domaine: 'ressources', cat: 'stock', niveau: 'critique', condition: 'test',
      effet: 'pousser', parametres: {}, statut: 'valide', actif_par_defaut: true, verrou: true } ] };

t('le joueur remplace un seuil et un interrupteur, pas le reste', () => {
  const g = appRegles(DEUX_REGLES, s => { s.settings.regles = { A: { on: false, p: { seuil: 15 } } }; });
  assert.equal(g.regle('A').on, false);
  assert.equal(g.regle('A').parametres.seuil, 15);
  assert.equal(g.regle('A').niveau, 'important');
});

t('une règle à verrou ne se coupe pas', () => {
  const g = appRegles(DEUX_REGLES, s => { s.settings.regles = { B: { on: false } }; });
  assert.equal(g.regle('B').on, true);
});

t('des réglages de règles abîmés sont jetés sans exception', () => {
  const g = appRegles(DEUX_REGLES, s => { s.settings.regles = {
    A: { on: 'non', p: { seuil: 'dix', inconnu: 3 } }, Z: { on: false }, __proto__: { on: false } }; });
  assert.equal(g.regle('A').on, true);
  assert.equal(g.regle('A').parametres.seuil, 10);
  assert.equal(g.regle('Z'), null);
});

t('un gabarit remplit ce qu\'il connaît et laisse voir le reste', () => {
  const g = app();
  assert.equal(g.gabarit('{batiment} {niveau+1} sur {planete} · {trou}',
    { batiment: 'Hangar de cristal', niveau: 7, planete: 'Mère' }),
    'Hangar de cristal 8 sur Mère · {trou}');
});
```

- [ ] **Step 2 : Lancer les tests pour les voir échouer**

Run: `node test/run.js`
Expected: FAIL — `regle is not defined`.

- [ ] **Step 3 : Écrire `regle`, `regleSaine`, `gabarit`.**
  `Object.prototype.hasOwnProperty`, jamais `in`, comme `profilConnu`
  (`app.js:6632`). Ne garder dans `S.settings.regles` que ce qui s'écarte du
  fichier.

- [ ] **Step 4 : Lancer les tests**

Run: `node test/run.js`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add app.js manifest.json test/run.js
git commit -m "feat: le joueur règle une règle sans toucher au fichier"
```

---

### Task 3 : `constats()` et les trois règles de ressources qui existent

Le moteur fait déjà RES_STORAGE_FULL, RES_STORAGE_SOON et RES_ENERGY_NEGATIVE,
en deux endroits qui écrivent chacun leur phrase (`planetAlerts`,
`app.js:2380`, et `pickBuildings`, `app.js:3389-3421`). Cette tâche les fait
passer par les règles, et fait de `planetAlerts` un lecteur des constats.

**Files:**
- Modify: `rules.json` — les trois règles
- Modify: `app.js` — `constats()`, `EVAL.storageRatio`, `EVAL.storageEta`,
  `EVAL.energyBalance`, `SEV_LABEL` (`app.js:2430`)
- Modify: `app.js:2412-2427` et `app.js:2383-2395` — `planetAlerts` lit les
  constats au lieu de recalculer
- Modify: `app.js:3389`, `app.js:3397`, `app.js:3421` — `pickBuildings` lit
  les seuils de `regle(id)`
- Test: `test/run.js`

**Interfaces:**
- Consumes: `regle`, `production`, `stockNow`, `buildTime`, `poidsCat`,
  `energyOptions`, `depensesPayables`
- Produces:
  - `constats()` → `Array<{regle, pid, niveau, valeur, vars, effet, domaine,
    cat, rang}>`, triés niveau → poids → rang. Lit l'état réel, n'écrit rien.
    Une règle coupée, ou dont `poidsCat(cat)` vaut 0, n'en rend aucun.
  - `NIVEAU_SEV = {critique:'bad', important:'warn', conseil:'info'}`.
  - `SEV_LABEL` → `{bad:'Critique', warn:'Important', info:'Conseil', good:'Prêt'}`.

- [ ] **Step 1 : Tests qui échouent.** Exports : `'constats'`, `'SEV_LABEL'`.

```js
/* ---------- les règles du moteur : ressources ---------- */
/** Le cristal de la mère au-dessus de son hangar (Hangar C 3). */
const CRISTAL_PLEIN = s => { s.planets[0].stock.c = 1e9; };

t('cristal au-dessus du hangar : un constat critique, et le plan dépense', () => {
  const g = app(CRISTAL_PLEIN);
  const c = g.constats().find(x => x.regle === 'RES_STORAGE_FULL');
  assert.equal(c.pid, 'mere'); assert.equal(c.niveau, 'critique');
  const a = g.simulateDay().sessions[0].acts.find(a => a.kind === 'b' && a.p === 0);
  assert.ok(a, 'le plan pousse un chantier sur la mère');
});

t('RES_STORAGE_FULL coupée : ni constat, ni secours dans le plan', () => {
  const g = app(s => { CRISTAL_PLEIN(s); s.settings.regles = { RES_STORAGE_FULL: { on: false } }; });
  assert.ok(!g.constats().some(x => x.regle === 'RES_STORAGE_FULL'));
  const a = g.simulateDay().sessions[0].acts.find(a => a.p === 0 && /plafond/.test(a.why || ''));
  assert.equal(a, undefined, 'le secours du plafond ne sort plus');
});

t('le seuil de RES_STORAGE_SOON se règle', () => {
  const g = app(s => { s.settings.regles = { RES_STORAGE_SOON: { p: { heures: 1000 } } }; });
  assert.ok(g.constats().some(x => x.regle === 'RES_STORAGE_SOON'));
});

t('une catégorie de poids 0 ne rend aucun constat', () => {
  const g = app(s => { CRISTAL_PLEIN(s); s.profil = { style: 'raideur', activite: 'regulier', focus: [], set: true };
    PROFILS_STOCK_A_ZERO(s); });
  assert.ok(!g.constats().some(x => x.cat === 'stock'));
});

t('un seul vocabulaire de niveau', () => {
  assert.deepEqual(app().SEV_LABEL, { bad: 'Critique', warn: 'Important', info: 'Conseil', good: 'Prêt' });
});
```

`PROFILS_STOCK_A_ZERO` : aucun style ne met `stock` à 0 dans
`profils.js:72-76`. Le test pose le poids à la main sur la copie de `PROFILS`
du harnais ; le constructeur l'écrit comme une fonction qui prend `g` après
chargement, si la fixture ne peut pas l'atteindre avant.

- [ ] **Step 2 : Lancer les tests pour les voir échouer**

Run: `node test/run.js`
Expected: FAIL — `constats is not defined`.

- [ ] **Step 3 : Ajouter les trois règles à `rules.json`.** Seuils par défaut :
  ceux du moteur (`seuil: 0.98` ; `heures: 8`, qui garde le `max(8 h, montée)`
  d'`app.js:2426`). Texte et raison repris des phrases actuelles, une seule
  version de chacune.

- [ ] **Step 4 : Écrire `constats()` et les trois évaluateurs.** L'évaluateur
  d'énergie reprend `energyOptions` tel quel : l'option satellites y est déjà.
  `planetAlerts` garde les alertes qui ne sont pas des règles (bridage,
  emplacements à 0 et 1) et rend, pour les trois règles, ce que `constats()`
  dit. `pickBuildings` lit `regle(id).on` et ses seuils aux trois lignes.

- [ ] **Step 5 : Renommer `SEV_LABEL`.** Chercher dans `test/run.js` les
  attentes sur « Urgent », « Attention », « Conseillé » et les mettre à jour.

- [ ] **Step 6 : Lancer les tests**

Run: `node test/run.js`
Expected: PASS, toute la suite.

- [ ] **Step 7 : Commit**

```bash
git add rules.json app.js manifest.json test/run.js
git commit -m "feat: stockage et énergie passent par les règles du moteur"
```

---

### Task 4 : Les deux règles à verrou

**Files:**
- Modify: `rules.json` — RES_ENERGY_NEXT_MINE, RES_MINE_BLOCKED_BY_STORAGE, `verrou: true`
- Modify: `app.js` — `EVAL.nextLevelCost`, `EVAL.nextMineEnergy` ; textes
  d'`app.js:3441` et `app.js:3456` lus du fichier
- Test: `test/run.js`

- [ ] **Step 1 : Tests qui échouent.**

```js
t('mine plus chère que le hangar : le hangar sort, et la règle ne se décoche pas', () => {
  const g = app(s => { s.planets[0].b.crystal = 30; s.settings.regles = { RES_MINE_BLOCKED_BY_STORAGE: { on: false } }; });
  assert.equal(g.regle('RES_MINE_BLOCKED_BY_STORAGE').on, true);
  const sess = g.simulateDay().sessions;
  assert.ok(sess.some(x => x.acts.concat(x.waits).some(a => a.p === 0 && /^s(metal|crystal|deut)$/.test(a.k))),
    'un hangar est proposé sur la mère');
});
```

- [ ] **Step 2 : Les voir échouer** — `node test/run.js`, FAIL.
- [ ] **Step 3 : Ajouter les deux règles et leurs évaluateurs.** Le texte
  d'`app.js:3441` (« Hangar trop petit pour la suite ») et d'`app.js:3456`
  (« Énergie pour X ») vient de `regle(id).raison` via `gabarit`.
- [ ] **Step 4 : Lancer les tests** — PASS, toute la suite.
- [ ] **Step 5 : Commit**

```bash
git add rules.json app.js manifest.json test/run.js
git commit -m "feat: deux règles que la simulation ne laisse pas couper"
```

---

### Task 5 : Marquer — file vide, labo à l'arrêt

**Files:**
- Modify: `rules.json` — INST_QUEUE_EMPTY, RECH_LAB_IDLE
- Modify: `app.js` — `EVAL.queueEmpty`, `EVAL.researchIdle` ; `simulateDay`
  pose `a.niveau` et `a.regle` sur les cartes de la première connexion ; tri
  d'`app.js:4151` par niveau puis poids ; `actHtml` (`app.js:4211`) affiche
  le niveau
- Test: `test/run.js`

**Interfaces:**
- Produces:
  - sur une carte de `sessions[0].acts` : `niveau` (`'critique'|…`) et
    `regle` (id), quand un constat `marquer` la vise.
  - `plan.constats` → les constats de ce rendu, servis ou non, chacun avec
    `servi: true` quand une carte de la première connexion lui répond.

- [ ] **Step 1 : Tests qui échouent.**

```js
/* ---------- les règles du moteur : marquer ---------- */
t('planète sans chantier : sa carte bâtiment est critique', () => {
  const g = app();
  const a = g.simulateDay().sessions[0].acts.find(a => a.kind === 'b' && a.p === 0);
  assert.equal(a.niveau, 'critique'); assert.equal(a.regle, 'INST_QUEUE_EMPTY');
});

t('INST_QUEUE_EMPTY coupée : la carte reste, sans niveau', () => {
  const g = app(s => { s.settings.regles = { INST_QUEUE_EMPTY: { on: false } }; });
  const a = g.simulateDay().sessions[0].acts.find(a => a.kind === 'b' && a.p === 0);
  assert.ok(a, 'c\'est une carte du plan, elle ne dépend pas de la règle');
  assert.equal(a.niveau, undefined);
});

t('un chantier en cours : pas de constat de file vide', () => {
  const g = app(s => { s.timers = [{ kind: 'b', pid: 'mere', k: 'metal', lvl: 15, end: SOIR + 3600e3 }]; });
  assert.ok(!g.constats().some(x => x.regle === 'INST_QUEUE_EMPTY' && x.pid === 'mere'));
});

t('file vide sans rien de payable : le constat reste à signaler, avec l\'heure', () => {
  const g = app(s => { s.planets[1].stock = { m: 0, c: 0, d: 0, at: SOIR }; });
  const c = g.simulateDay().constats.find(x => x.regle === 'INST_QUEUE_EMPTY' && x.pid === 'colo');
  assert.equal(c.servi, false);
  assert.ok(c.vars.attente, 'il dit quand les ressources seront réunies');
});

t('aucune recherche en cours : la carte recherche est critique', () => {
  const g = app();
  const a = g.simulateDay().sessions[0].acts.find(a => a.kind === 't');
  if (a) assert.equal(a.niveau, 'critique');
  else assert.ok(g.simulateDay().constats.some(x => x.regle === 'RECH_LAB_IDLE' && !x.servi));
});

t('une carte critique se lit avant une carte du même instant de plus gros poids', () => {
  // la mère est marquée, la colonie aussi : à niveau égal, le poids départage
  const acts = app().simulateDay().sessions[0].acts;
  const rang = a => ({ critique: 0, important: 1, conseil: 2 })[a.niveau] ?? 3;
  for (let i = 1; i < acts.length; i++) assert.ok(rang(acts[i - 1]) <= rang(acts[i]));
});
```

- [ ] **Step 2 : Les voir échouer** — FAIL.
- [ ] **Step 3 : Écrire les deux évaluateurs.** File vide : aucun minuteur
  `kind:'b'` ni `queue:'building'` non fini sur la planète (même lecture que
  `simulateDay`, `app.js:3478` et `3492`). Labo : `!rechercheEnCours()`
  (`app.js:2323`). Valeur de condition (pour « Ignorer ») : la fin du dernier
  minuteur connu de cette file, ou 0.
- [ ] **Step 4 : Marquer dans `simulateDay`**, après la première session :
  chaque constat `marquer` cherche la carte qu'il vise dans `sessions[0].acts`
  (même `kind`, même planète), lui pose `niveau` et `regle`, et prend
  `servi: true`. Sans carte, il prend la ligne d'attente correspondante dans
  `sessions[0].waits` comme `vars.attente`. Rendre `constats` dans le résultat.
- [ ] **Step 5 : Trier les cartes** d'une même connexion par niveau, puis
  poids (`app.js:4151`).
- [ ] **Step 6 : Afficher le niveau** dans `actHtml` : une pastille avec
  `SEV_LABEL[NIVEAU_SEV[a.niveau]]`.
- [ ] **Step 7 : Lancer les tests** — PASS, toute la suite.
- [ ] **Step 8 : Commit**

```bash
git add rules.json app.js manifest.json test/run.js
git commit -m "feat: une file vide fait de sa carte une carte critique"
```

---

### Task 6 : Le badge

**Files:**
- Modify: `app.js` — `publieCritiques()`, appelé par `applyGame` (`app.js:8078`) et par `render()`
- Modify: `background.js:278-282`, `background.js:393-400` — `composeBadge()`
- Test: `test/run.js`

**Interfaces:**
- Produces:
  - `chrome.storage.local.critiques = {n, at}` : les constats critiques non
    ignorés.
  - `composeBadge({instable, critiques, pendingAlerts, maj})` dans
    `background.js`, pure : `{text, color}`. Ordre : instable → critiques →
    files finies → mise à jour. Vide quand tout est à zéro. Le compte des
    critiques plus vieux que la dernière file finie cède la place.
    `instable` et `maj` restent à `false` tant que l'issue Versions ne les
    fournit pas.

- [ ] **Step 1 : Tests qui échouent.** `composeBadge` se teste en évaluant
  `background.js` comme le fait déjà la suite pour le service worker ; à
  défaut, le constructeur la sort dans `ids.js`, que les deux chargent.

```js
t('le panneau publie le compte des critiques', () => {
  const g = app(null, null, null, true);
  g.render();
  assert.equal(g.stored().critiques.n, g.constats().filter(x => x.niveau === 'critique').length);
});

t('le badge : les critiques avant les files finies, rien à zéro', () => {
  const b = badge();
  assert.deepEqual(b.composeBadge({ critiques: { n: 0, at: 1 }, pendingAlerts: [] }), { text: '', color: null });
  assert.equal(b.composeBadge({ critiques: { n: 2, at: 5 }, pendingAlerts: [{ at: 1 }] }).text, '2');
  assert.equal(b.composeBadge({ critiques: { n: 2, at: 1 }, pendingAlerts: ['a', 'b', 'c'], fileAt: 5 }).text, '3',
    'un compte de critiques d\'avant la fin de file ne l\'écrase pas');
});

t('INST_QUEUE_EMPTY coupée : le compte tombe', () => {
  const g = app(s => { s.settings.regles = { INST_QUEUE_EMPTY: { on: false }, RECH_LAB_IDLE: { on: false } }; }, null, null, true);
  g.render();
  assert.equal(g.stored().critiques.n, 0);
});
```

- [ ] **Step 2 : Les voir échouer** — FAIL.
- [ ] **Step 3 : Écrire `publieCritiques()`** et l'appeler à la fin
  d'`applyGame` et de `render()`, seulement sous `IS_EXT`.
- [ ] **Step 4 : Écrire `composeBadge`** et l'appeler à chaque changement de
  `critiques` ou de `pendingAlerts` dans `chrome.storage.onChanged`, et dans
  `showAlertWindow`. `showAlertWindow` retient l'heure de la dernière fin de
  file (`fileAt`).
- [ ] **Step 5 : Lancer les tests** — PASS.
- [ ] **Step 6 : Commit**

```bash
git add app.js background.js manifest.json test/run.js
git commit -m "feat: l'icône compte les critiques, et les files finies quand le panneau dort"
```

---

### Task 7 : Le bloc des conseils

**Files:**
- Modify: `app.js:7298-7299` — `tdAlerts` devient le bloc des conseils
- Modify: `app.js` — `conseilsHtml(plan)`, `S.ui.cf` (filtres), poignées dans `bind()`
- Test: `test/run.js`

**Interfaces:**
- Consumes: `plan.constats`, `plan.alerts` (ce qui reste de `planetAlerts`), `S.cur`
- Produces: `conseilsHtml(plan)` → le HTML ; trois lignes de la planète `S.cur`
  (ou de la première si `S.cur` ne répond pas), puis un `<details>` « Voir tout
  (N) » avec quatre `<select data-cf="domaine|niveau|planete|manque">`.

- [ ] **Step 1 : Tests qui échouent.**

```js
/* ---------- les règles du moteur : le bloc des conseils ---------- */
t('trois conseils de la planète ouverte, puis Voir tout', () => {
  const g = app(s => { s.cur = '102'; s.planets[1].gid = '102'; s.planets[1].stock = { m: 0, c: 0, d: 0, at: SOIR };
    s.planets[1].cases = { pris: 200, max: 205 }; });
  g.render();
  const h = lu(g.el('tdAlerts').innerHTML);
  const tete = h.split('<details')[0];
  assert.ok((tete.match(/<li/g) || []).length <= 3);
  assert.ok(/Colonie/.test(tete) && !/Planète mère/.test(tete), 'la tête ne parle que de la planète ouverte');
  assert.match(h, /Voir tout \(\d+\)/);
});

t('un constat servi par une carte ne se répète pas dans le bloc', () => {
  const g = app(CRISTAL_PLEIN); g.render();
  assert.ok(!/Hangar de cristal plein/.test(lu(g.el('tdAlerts').innerHTML)),
    'le plan dépense déjà : sa carte est la réponse');
});

t('chaque ligne dit son niveau, son domaine, sa raison, et si on peut la payer', () => {
  const g = app(s => { s.planets[1].stock = { m: 0, c: 0, d: 0, at: SOIR }; }); g.render();
  const h = lu(g.el('tdAlerts').innerHTML);
  assert.match(h, /Critique/); assert.match(h, /Installations/);
  assert.match(h, /payable maintenant|pas encore payable/);
});

t('une règle à valider le dit', () => {
  const g = app(s => { s.tech.irn = 1; s.planets[1].b.lab = 1; s.planets[0].b.lab = 8; });
  g.render();
  if (/INST_LAB_NETWORK/.test(JSON.stringify(g.constats()))) assert.match(lu(g.el('tdAlerts').innerHTML), /à valider/);
});

t('le filtre Données manquantes ne garde que FDV_DATA_MISSING', () => {
  const g = app(s => { s.ui.cf = { manque: true }; s.planets[1].stock = { m: 0, c: 0, d: 0, at: SOIR }; }); g.render();
  const tout = lu(g.el('tdAlerts').innerHTML).split('<details')[1] || '';
  assert.ok(!/Installations/.test(tout));
});
```

Le dernier test s'enrichit à la tâche 16, quand FDV_DATA_MISSING existe.

- [ ] **Step 2 : Les voir échouer** — FAIL.
- [ ] **Step 3 : Écrire `conseilsHtml`.** Une ligne : pastille de niveau,
  domaine, message, action et son coût (`costHtml`), « payable maintenant » ou
  non (`can` sur `stockNow` de la planète), raison, lien `source`, « à
  valider », bouton « Ignorer » (`data-ign`, câblé à la tâche suivante). Les
  alertes de `planetAlerts` qui ne sont pas des règles (bridage, emplacements)
  passent dans la même liste, au niveau de leur `sev`.
- [ ] **Step 4 : Les filtres** écrivent `S.ui.cf` et appellent `refresh()`.
  `S.ui` n'est pas dans `SYNC_KEYS` : ils restent sur ce poste.
- [ ] **Step 5 : Lancer les tests** — PASS, toute la suite.
- [ ] **Step 6 : Commit**

```bash
git add app.js manifest.json test/run.js
git commit -m "feat: le bloc des conseils, planète ouverte d'abord, l'empire en dessous"
```

---

### Task 8 : « Ignorer »

**Files:**
- Modify: `app.js` — `ignKey(c)`, `ignore(c)`, `ignClean()` (dans `render()`),
  `constats()` filtre l'affichage et le compte, pas les effets
- Test: `test/run.js`

**Interfaces:**
- Produces:
  - `ignKey(c)` → `` `${c.regle}|${gidDe(c.pid) || c.pid}|${c.valeur}` ``.
  - `S.daily.ign = {[clé]: horodatage}`. `daily` voyage déjà.
  - `ignClean()` → retire les entrées de plus de 24 h et celles dont aucun
    constat de ce rendu ne porte la clé. Ne fait rien hors extension ou sur les
    données d'exemple.
  - Un constat ignoré garde ses effets dans la simulation ; il sort du bloc et
    du compte des critiques.

- [ ] **Step 1 : Tests qui échouent.**

```js
t('Ignorer, remplir la file, la revider : le constat revient', () => {
  const g = app(s => { s.planets[1].stock = { m: 0, c: 0, d: 0, at: SOIR }; }, null, null, true);
  const c = g.constats().find(x => x.regle === 'INST_QUEUE_EMPTY' && x.pid === 'colo');
  g.ignore(c);
  assert.ok(!g.constatsVus().some(x => x.regle === 'INST_QUEUE_EMPTY' && x.pid === 'colo'));
  g.S.timers.push({ kind: 'b', pid: 'colo', k: 'metal', lvl: 5, end: SOIR + 60e3 });
  g.render();
  assert.deepEqual(g.S.daily.ign, {}, 'la condition a changé : l\'entrée tombe');
  g.S.timers = []; g.render();
  assert.ok(g.constatsVus().some(x => x.regle === 'INST_QUEUE_EMPTY' && x.pid === 'colo'));
});

t('un constat ignoré il y a 25 h revient', () => {
  const g = app(s => { s.planets[1].stock = { m: 0, c: 0, d: 0, at: SOIR }; }, null, null, true);
  const c = g.constats().find(x => x.regle === 'INST_QUEUE_EMPTY' && x.pid === 'colo');
  g.S.daily.ign = { [g.ignKey(c)]: SOIR - 25 * 3600e3 };
  g.render();
  assert.ok(g.constatsVus().some(x => x.regle === 'INST_QUEUE_EMPTY' && x.pid === 'colo'));
});

t('ignorer ne change rien au plan', () => {
  const g = app(CRISTAL_PLEIN, null, null, true);
  const avant = JSON.stringify(g.simulateDay().sessions[0].acts);
  g.ignore(g.constats().find(x => x.regle === 'RES_STORAGE_FULL'));
  assert.equal(JSON.stringify(g.simulateDay().sessions[0].acts), avant);
});

t('sur les données d\'exemple, rien n\'est nettoyé', () => {
  const g = app(s => { s.sample = true; s.daily.ign = { 'X|1|0': SOIR }; });
  g.render();
  assert.deepEqual(g.S.daily.ign, { 'X|1|0': SOIR });
});
```

Exports : `'ignore'`, `'ignKey'`, `'constatsVus'` (les constats moins les
ignorés).

- [ ] **Step 2 : Les voir échouer** — FAIL.
- [ ] **Step 3 : Écrire les quatre fonctions.** `ignClean()` dans `render()`,
  à côté de `prioClean()` (`app.js:2269`). Le bouton `data-ign` appelle
  `ignore`, `save()`, `refresh()`.
- [ ] **Step 4 : Lancer les tests** — PASS.
- [ ] **Step 5 : Commit**

```bash
git add app.js manifest.json test/run.js
git commit -m "feat: ignorer un conseil jusqu'à ce que la situation change"
```

---

### Task 9 : Réglages › Règles

**Files:**
- Modify: `app.js` — `VIEWS.settings` reçoit la carte « Règles » ; poignées
  `data-rg-on`, `data-rg-p` dans `bind()` ; `p.regOff` sous chaque planète
  dans Empire
- Test: `test/run.js`

- [ ] **Step 1 : Tests qui échouent.**

```js
t('chaque règle a sa ligne, la règle à verrou est grisée et dit pourquoi', () => {
  const g = app(s => { s.__tab = 'settings'; }); g.render();
  const h = lu(g.view.innerHTML);
  for (const r of g.REGLES.regles) assert.ok(h.includes(r.id), r.id);
  assert.match(h, /data-rg-on="RES_MINE_BLOCKED_BY_STORAGE"[^>]*disabled/);
});

t('cocher une règle l\'écrit dans les réglages, et seulement l\'écart', () => {
  const g = app(s => { s.__tab = 'settings'; }); g.render();
  g.reglePose('INST_FIELDS_LOW', { p: { seuil: 15 } });
  assert.deepEqual(g.S.settings.regles, { INST_FIELDS_LOW: { p: { seuil: 15 } } });
  g.reglePose('INST_FIELDS_LOW', { p: { seuil: g.REGLES.regles.find(r => r.id === 'INST_FIELDS_LOW').parametres.seuil } });
  assert.deepEqual(g.S.settings.regles, {}, 'revenu au fichier : plus rien d\'écrit');
});

t('une règle coupée pour une planète ne s\'y évalue plus', () => {
  const g = app(s => { s.planets[1].cases = { pris: 200, max: 205 }; s.planets[1].regOff = { INST_FIELDS_LOW: true }; });
  assert.ok(!g.constats().some(x => x.regle === 'INST_FIELDS_LOW' && x.pid === 'colo'));
});
```

Le dernier test attend la tâche 11 (INST_FIELDS_LOW) : le constructeur le pose
là, ou passe les tâches 9 et 11 dans l'autre ordre.

- [ ] **Step 2 : Les voir échouer** — FAIL.
- [ ] **Step 3 : La carte.** Groupée par domaine, dans l'ordre du fichier : case,
  niveau, un champ par paramètre, « à valider », case grisée et raison pour
  `verrou`. `reglePose(id, ecart)` écrit, `regleSaine()`, `save()`,
  `refresh()`.
- [ ] **Step 4 : Sous chaque planète** dans Empire, les règles dont le fichier
  dit `parPlanete: true` (INST_FIELDS_LOW pour commencer), en cases.
- [ ] **Step 5 : Lancer les tests** — PASS.
- [ ] **Step 6 : Commit**

```bash
git add app.js manifest.json test/run.js
git commit -m "feat: Réglages › Règles, une ligne par règle du moteur"
```

---

## Vague 2 — les règles que le moteur ne connaît pas

### Task 10 : RES_MINE_BALANCE

**Files:**
- Modify: `rules.json` — la règle, `parametres: {facteurCout: 2, tolerance: 1}`
- Modify: `app.js` — `cibleMines(p)`, `EVAL.mineBalanceTarget` ; candidat
  forcé dans `pickBuildings` juste avant la ligne des robots (`app.js:3452`)
- Test: `test/run.js`

**Interfaces:**
- Produces: `cibleMines(p)` → `{cible, actuel}` ou `null` (pas de style, pas de
  position lisible).

- [ ] **Step 1 : Tests qui échouent.**

```js
/* ---------- les règles du moteur : vague 2 ---------- */
const MINEUR = s => { s.profil = { style: 'mineur', classe: '', activite: 'regulier', focus: [], set: true }; };
const MINES_28_27 = s => { s.planets[0].b.metal = 28; s.planets[0].b.crystal = 27; s.planets[0].b.solar = 30; };

t('Mineur en position 8, métal 28 et cristal 27 : cible +3, actuel +1', () => {
  const g = app(s => { MINEUR(s); MINES_28_27(s); });
  assert.deepEqual(g.cibleMines(g.S.planets[0]), { cible: 3, actuel: 1 });
  const c = g.constats().find(x => x.regle === 'RES_MINE_BALANCE');
  assert.match(g.gabarit(g.regle('RES_MINE_BALANCE').message, c.vars), /Cible métal − cristal : \+3, actuel : \+1/);
});

t('le plan monte la mine de métal', () => {
  const g = app(s => { MINEUR(s); MINES_28_27(s); s.planets[0].stock = { m: 9e7, c: 9e7, d: 9e7, at: SOIR }; });
  const a = g.simulateDay().sessions[0].acts.find(a => a.kind === 'b' && a.p === 0);
  assert.equal(a.k, 'metal');
});

t('en Raideur, la cible de cette planète passe à +2', () => {
  const g = app(s => { MINEUR(s); s.profil.style = 'raideur'; MINES_28_27(s); });
  assert.equal(g.cibleMines(g.S.planets[0]).cible, 2);
});

t('sans style, aucune cible', () => {
  assert.equal(app().cibleMines(app().S.planets[0]), null);
});

t('une mine d\'équilibre trop chère ne passe pas devant le classement', () => {
  const g = app(s => { MINEUR(s); MINES_28_27(s); s.settings.regles = { RES_MINE_BALANCE: { p: { facteurCout: 0.01 } } }; });
  const c = g.pickBuildings(Object.assign({ st: [9e7, 9e7, 9e7] }, g.S.planets[0]), { T: SOIR, iv: 1.5, goals: [] });
  assert.ok(!c.some(x => /Cible métal/.test(x.why)));
});
```

Le cinquième test appelle `pickBuildings` sur une planète réelle avec un `st`
posé ; le constructeur l'adapte à la forme que les tests existants de
`pickBuildings` utilisent déjà dans `test/run.js`.

- [ ] **Step 2 : Les voir échouer** — FAIL.
- [ ] **Step 3 : `cibleMines`, l'évaluateur, le candidat.** Plages de
  `byPosition` lues `"a-b"`. Le candidat passe par `add` (donc par « Non »), et
  sa raison dit la cible et l'écart, suivis de `mineWhy(p, k)`
  (`app.js:3349`) : deux raisons contraires se disent toutes les deux.
- [ ] **Step 4 : Lancer les tests** — PASS.
- [ ] **Step 5 : Commit**

```bash
git add rules.json app.js manifest.json test/run.js
git commit -m "feat: l'équilibre métal-cristal suit le style et la position"
```

---

### Task 11 : Installations — nanites, champs, réseau de labos

**Files:**
- Modify: `rules.json` — INST_NANITES_LAGGING, INST_NANITES_OVER_ROBOTS,
  INST_FIELDS_LOW (`seuil: 10`, `parPlanete: true`), INST_LAB_NETWORK
  (`statut: a_valider`)
- Modify: `app.js` — quatre évaluateurs ; candidats dans `pickBuildings` avec
  le garde de coût des robots (`app.js:3453`) ; INST_NANITES_OVER_ROBOTS
  s'accroche au pas de priorité (`ctx.prio`, `app.js:3433`)
- Test: `test/run.js`

- [ ] **Step 1 : Tests qui échouent.**

```js
t('nanites en retard sur l\'empire : Nanites +1 est candidate', () => {
  const g = app(s => { s.planets.forEach(p => { p.b.robot = 10; }); s.tech.computer = 10;
    s.planets[0].b.nanite = 5; s.planets[1].b.nanite = 1; s.planets[1].stock = { m: 9e7, c: 9e7, d: 9e7, at: SOIR }; });
  assert.ok(g.constats().some(x => x.regle === 'INST_NANITES_LAGGING' && x.pid === 'colo'));
  assert.ok(g.simulateDay().sessions[0].acts.some(a => a.p === 1 && a.k === 'nanite'));
});

t('une priorité Robots 11 : le copilote obéit, et chiffre les nanites', () => {
  const g = app(s => { s.planets[0].b.robot = 10; s.tech.computer = 10; s.prio = [{ kind: 'b', pid: 'mere', k: 'robot', lvl: 11 }]; });
  const sess = g.simulateDay().sessions[0];
  const a = sess.acts.concat(sess.waits).find(a => a.p === 0 && a.k === 'robot');
  assert.ok(a, 'la priorité est servie');
  assert.match(a.why || '', /Nanites/);
});

t('14 cases libres sous un seuil de 15 : le conseil sort', () => {
  const g = app(s => { s.planets[1].cases = { pris: 191, max: 205 }; s.settings.regles = { INST_FIELDS_LOW: { p: { seuil: 15 } } }; });
  assert.ok(g.constats().some(x => x.regle === 'INST_FIELDS_LOW' && x.pid === 'colo'));
});

t('le réseau de labos ne parle que si on a le Réseau', () => {
  assert.ok(!app(s => { s.planets[1].b.lab = 1; s.planets[0].b.lab = 10; })
    .constats().some(x => x.regle === 'INST_LAB_NETWORK'));
});
```

- [ ] **Step 2 : Les voir échouer** — FAIL.
- [ ] **Step 3 : Les quatre évaluateurs et leurs points d'entrée.**
  INST_FIELDS_LOW pousse le Terraformeur seulement si `reqOk(B.terra.req, p)`
  est vide ; sinon il signale, avec le prérequis manquant. INST_LAB_NETWORK :
  `S.tech.irn > 0`, et `!rechercheEnCours()`.
- [ ] **Step 4 : Lancer les tests** — PASS.
- [ ] **Step 5 : Commit**

```bash
git add rules.json app.js manifest.json test/run.js
git commit -m "feat: nanites, cases et labos du réseau entrent dans le plan"
```

---

### Task 12 : Recherche — plasma, hyperespace, colonie, financée ailleurs

**Files:**
- Modify: `rules.json` — RECH_PLASMA_MINER (`niveauCible`), RECH_HYPERSPACE_CARGO
  (`niveauCible`), RECH_ASTRO_COLONY (`marquer`), RECH_FUND_ELSEWHERE
- Modify: `app.js:3088` — `nextResearch` reçoit les pas poussés par les
  règles, en tête d'une copie de la feuille de route, sans `'c'` ; ils passent
  derrière les priorités du joueur
- Modify: `app.js` — `tryResearch` (autour d'`app.js:3614`) essaie un second
  payeur quand le centre ne peut pas
- Test: `test/run.js`

- [ ] **Step 1 : Tests qui échouent.**

```js
t('un mineur sous le plasma visé : la recherche Plasma passe en tête', () => {
  const g = app(s => { MINEUR(s); s.tech.energy = 8; s.tech.laser = 10; s.tech.ion = 5; s.planets[0].b.lab = 4; });
  assert.equal(g.nextResearch().list[0].k, 'plasma');
});

t('une priorité du joueur reste devant le plasma de la règle', () => {
  const g = app(s => { MINEUR(s); s.tech.energy = 8; s.tech.laser = 10; s.tech.ion = 5; s.planets[0].b.lab = 4;
    s.prio = [{ kind: 't', k: 'astro', lvl: 5 }]; });
  assert.equal(g.nextResearch().list[0].k, 'astro');
});

t('la recherche impayable au centre part d\'une planète qui peut', () => {
  const g = app(s => { s.planets[0].stock = { m: 0, c: 0, d: 0, at: SOIR };
    s.planets[1].b.lab = 5; s.planets[1].stock = { m: 9e7, c: 9e7, d: 9e7, at: SOIR }; });
  const a = g.simulateDay().sessions[0].acts.find(a => a.kind === 't');
  assert.equal(a.p, 1); assert.match(a.why, /depuis Colonie/);
});

t('une planète dont le labo ne remplit pas le prérequis ne la lance pas', () => {
  const g = app(s => { s.planets[0].stock = { m: 0, c: 0, d: 0, at: SOIR };
    s.planets[1].b.lab = 0; s.planets[1].stock = { m: 9e7, c: 9e7, d: 9e7, at: SOIR }; });
  assert.ok(!g.simulateDay().sessions[0].acts.some(a => a.kind === 't' && a.p === 1));
});
```

- [ ] **Step 2 : Les voir échouer** — FAIL.
- [ ] **Step 3 : Les pas poussés.** Même chemin que les priorités de recherche
  (`resolveTech` remonte les prérequis), insérés après elles. Le « +5 % » de
  l'hyperespace se lit de `hyperCargoPct()` (`app.js:838`).
- [ ] **Step 4 : Le second payeur.** `reqOk(T[k].req, autre)` vide, stock
  suffisant après sa réserve. La durée se calcule sur le labo de cette planète ;
  si elle ne peut pas être tenue juste, la carte n'affiche pas de durée
  (`dur: null`) et `actHtml` le supporte.
- [ ] **Step 5 : RECH_ASTRO_COLONY** marque la carte du vaisseau de
  colonisation ou la mission `colomax` ; sous « Économie pure », sa ligne dit
  que le réglage ne colonise pas de lui-même.
- [ ] **Step 6 : Lancer les tests** — PASS.
- [ ] **Step 7 : Commit**

```bash
git add rules.json app.js manifest.json test/run.js
git commit -m "feat: plasma, hyperespace et recherche financée ailleurs"
```

---

## Vague 3 — les formes de vie

### Task 13 : Relevé dans le jeu (joueur, bloquant)

Rien à coder. Trois faits à lire dans le jeu, que la spec refuse de deviner :

- [ ] **Step 1 : Les séries d'identifiants.** Sur une planète de chaque race
  disponible (ou dans l'Encyclopédie), ouvrir l'inspecteur sur une tuile de
  bâtiment et une de recherche : noter les deux premiers chiffres de la série.
  Trancher entre 111/121/131/141 et 111/113/115/117.
- [ ] **Step 2 : L'Encyclopédie.** L'URL de la page d'une race
  (`component=…`), et l'élément qui porte le nom de chaque bâtiment et de
  chaque recherche (attribut, titre, infobulle), avec son identifiant.
- [ ] **Step 3 : La page Formes de vie.** Confirmer que le nom de chaque case
  est lisible sans ouvrir son détail (infobulle de la tuile), pour que le cache
  se remplisse à la simple visite.
- [ ] **Step 4 : Écrire les trois réponses** dans
  `docs/revue-wiki-ogame.md`, section formes de vie, avec la date. Mettre à
  jour les `idPrefix` de `rules.json` et leur statut ; corriger le commentaire
  d'`ids.js:49`.

```bash
git add docs/revue-wiki-ogame.md rules.json ids.js manifest.json app.js
git commit -m "docs: séries et encyclopédie des formes de vie, relevées dans le jeu"
```

---

### Task 14 : La race d'une planète

**Files:**
- Modify: `app.js` — `raceDe(p)` ; Réglages › Formes de vie, une ligne par planète
- Modify: `app.js:4486-4499` — `speciesOf` reste la troisième source
- Test: `test/run.js`

**Interfaces:**
- Produces: `raceDe(p)` → `{race, src:'main'|'ids'|'nom', conflit:boolean}`
  ou `{race:null}`. Clés : celles de `LIFEFORMS` (`app.js:4471`) ;
  `rules.json` les reprend telles quelles.

- [ ] **Step 1 : Tests qui échouent.**

```js
/* ---------- les règles du moteur : formes de vie ---------- */
const HUMAINS = s => { s.planets[0].lf = { 11101: { lvl: 20, nom: 'Secteur résidentiel' }, 11102: { lvl: 18, nom: 'Ferme biosphérique' } }; };

t('la race se déduit des identifiants', () => {
  assert.deepEqual(app(HUMAINS).raceDe(app(HUMAINS).S.planets[0]), { race: 'humans', src: 'ids', conflit: false });
});

t('la race posée à la main l\'emporte', () => {
  const g = app(s => { HUMAINS(s); s.planets[0].race = 'rocktal'; });
  assert.equal(g.raceDe(g.S.planets[0]).race, 'rocktal');
  assert.equal(g.raceDe(g.S.planets[0]).src, 'main');
});

t('identifiants et nom qui se contredisent : pas de race', () => {
  const g = app(s => { HUMAINS(s); s.prod = { [s.planets[0].id]: { at: SOIR, rows: [{ label: 'Centre technologique runique (Niveau 3)' }] } }; });
  assert.equal(g.raceDe(g.S.planets[0]).conflit, true);
});

t('changer la race à la main déplace habitat et nourriture', () => {
  const g = app(s => { HUMAINS(s); s.planets[0].race = 'rocktal'; });
  assert.notDeepEqual(g.baseDe(g.S.planets[0]), { habitat: 11101, nourriture: 11102 });
});
```

Le troisième test dépend de la forme de `S.prod` ; le constructeur reprend
celle des tests existants de `speciesOfPlanet`.

- [ ] **Step 2 : Les voir échouer** — FAIL.
- [ ] **Step 3 : `raceDe` et `baseDe`.** Préfixe : `Math.floor(id / 100)`
  comparé à `idPrefix` du fichier. `baseDe(p)` lit `lifeforms[race].base`, et
  retombe sur `lfPopNourriture` (`app.js:6534`) quand le fichier n'en a pas.
- [ ] **Step 4 : Réglages › Formes de vie**, une ligne par planète : race,
  source, liste pour corriger (écrit `p.race`, vide l'efface).
- [ ] **Step 5 : Lancer les tests** — PASS.
- [ ] **Step 6 : Commit**

```bash
git add app.js manifest.json test/run.js
git commit -m "feat: la race de chaque planète, lue, déduite ou posée à la main"
```

---

### Task 15 : Les noms

**Files:**
- Modify: `ids.js:9-21` — `OG_LF_BUILD` et `OG_LF_TECH` quittent le fichier
- Modify: `rules.json` — les noms par défaut (déjà là depuis la tâche 1)
- Modify: `app.js:1014` — `LF_NAMES` lit `REGLES.lifeforms` ; `S.lfNoms` ;
  `lfNom` (`app.js:519`) lit le cache, puis le fichier, puis rien
- Modify: `app.js` — `applyGame` (`app.js:8078`) verse les `v.nom` lus dans
  `S.lfNoms`
- Modify: `content.js` — la lecture de l'Encyclopédie (tâche 13)
- Test: `test/run.js`, `test/page.js`

- [ ] **Step 1 : Tests qui échouent.**

```js
t('un nom lu dans le jeu remplace le nom du fichier, pour toutes les planètes', () => {
  const g = app(s => { HUMAINS(s); s.planets[0].lf[11101].nom = 'Quartier résidentiel'; s.planets[1].lf = { 11101: { lvl: 2 } }; });
  g.applyGame({ planets: [] });
  assert.equal(g.lfNom(g.S.planets[1], 11101), 'Quartier résidentiel');
});

t('sans nom lu ni nom du fichier, le nom manque', () => {
  const g = app(s => { s.planets[0].lf = { 12101: { lvl: 3 } }; });
  assert.equal(g.lfNom(g.S.planets[0], 12101), null);
});

t('le cache des noms ne voyage pas', () => {
  const g = app(HUMAINS); g.applyGame({ planets: [] });
  assert.ok(!JSON.stringify(g.syncOut()).includes('lfNoms'));
});
```

Et dans `test/page.js`, un test de lecture de l'Encyclopédie sur un extrait de
page fourni par la tâche 13.

- [ ] **Step 2 : Les voir échouer** — FAIL.
- [ ] **Step 3 : Déplacer les tables et écrire le cache.** `lfNom` rend `null`
  quand rien ne nomme la case ; ses appelants (`lfRows`, `lfCandidates`,
  `prioHtml`) affichent alors « case 12101 (nom inconnu) » et la case compte
  comme donnée manquante (tâche 16).
- [ ] **Step 4 : `content.js`** lit l'Encyclopédie sur le patron des autres
  lectures de page, et envoie `{lfNoms:{id:nom}}` dans l'instantané ;
  `background.js` `merge` le garde (`background.js:130`).
- [ ] **Step 5 : Lancer les tests** — PASS, toute la suite.
- [ ] **Step 6 : Commit**

```bash
git add ids.js rules.json app.js content.js background.js manifest.json test/run.js test/page.js
git commit -m "feat: les noms des formes de vie viennent du jeu, sinon du fichier"
```

---

### Task 16 : FDV_DATA_MISSING, « Scanner », « Rescanner »

**Files:**
- Modify: `rules.json` — FDV_DATA_MISSING
- Modify: `app.js` — `lfManques(p)`, `EVAL.lifeformDataComplete` ;
  `lfPass` (`app.js:3963`) saute une planète dont la race manque, et les cases
  sans nom ou sans niveau lisible
- Modify: `app.js:5093-5134` — les missions `lfb` et `lfr` disparaissent au
  profit du constat
- Modify: `app.js` — bouton « Rescanner » dans Réglages
- Test: `test/run.js`

**Interfaces:**
- Produces: `lfManques(p)` → `[{quoi:'race'|'noms'|'niveau'|'conflit',
  detail, page:'lfbuildings'|'encyclopedie'}]`. Vide quand tout est là.

- [ ] **Step 1 : Tests qui échouent.**

```js
t('cache des noms vidé : FDV_DATA_MISSING sur chaque planète, formes de vie suspendues', () => {
  const g = app(s => { HUMAINS(s); s.planets[1].lf = { 11101: { lvl: 2 } }; s.planets.forEach(p => { for (const v of Object.values(p.lf)) delete v.nom; }); });
  g.rescanner();
  for (const p of g.S.planets) assert.ok(g.constats().some(x => x.regle === 'FDV_DATA_MISSING' && x.pid === p.id), p.id);
  assert.ok(!g.simulateDay().sessions.some(x => x.acts.some(a => a.kind === 'lf')));
});

t('les noms reviennent par un instantané : le constat tombe', () => {
  const g = app(s => { HUMAINS(s); s.planets[0].race = 'humans'; delete s.planets[0].lf[11101].nom; });
  assert.ok(g.constats().some(x => x.regle === 'FDV_DATA_MISSING' && x.pid === 'mere'));
  g.applyGame({ planets: [], lfNoms: { 11101: 'Secteur résidentiel' } });
  assert.ok(!g.constats().some(x => x.regle === 'FDV_DATA_MISSING' && x.pid === 'mere'));
});

t('Rocta sans données : noms inconnus, et Scanner ouvre l\'Encyclopédie', () => {
  const g = app(s => { s.planets[0].race = 'rocktal'; s.planets[0].gid = '101'; });
  const c = g.constats().find(x => x.regle === 'FDV_DATA_MISSING' && x.pid === 'mere');
  assert.match(c.vars.detail, /Rocta/);
  assert.match(c.vars.url, /encyclop/i);
});

t('Scanner sur une planète Humains ouvre sa page de formes de vie', () => {
  const g = app(s => { s.planets[0].gid = '101'; s.planets[0].lf = { 11101: { lvl: 2 } }; s.planets[0].race = 'humans';
    delete s.planets[0].lf[11101].nom; s.host = 's1-fr.ogame.gameforge.com'; });
  const c = g.constats().find(x => x.regle === 'FDV_DATA_MISSING');
  assert.match(c.vars.url, /component=lfbuildings/);
  assert.match(c.vars.url, /cp=101/);
});

t('Rescanner garde la race posée à la main', () => {
  const g = app(s => { HUMAINS(s); s.planets[0].race = 'humans'; });
  g.rescanner();
  assert.equal(g.S.planets[0].race, 'humans');
});

t('les missions lfb et lfr ne doublent plus le constat', () => {
  const g = app(s => { s.planets[0].lfSeen = {}; s.planets[0].race = 'humans'; });
  assert.ok(!g.dailyMissions().some(m => m.id === 'lfb' || m.id === 'lfr'));
});
```

Exports : `'rescanner'`, `'lfManques'`, `'lfNom'`, `'raceDe'`, `'baseDe'`.

- [ ] **Step 2 : Les voir échouer** — FAIL.
- [ ] **Step 3 : `lfManques` et l'évaluateur.** Le détail se compose du plus
  bloquant au moins bloquant (race, conflit, noms, niveaux). L'URL vient de
  `goUrl('lfbuildings', i)` (`app.js:926`) ou de la page Encyclopédie relevée à
  la tâche 13.
- [ ] **Step 4 : Suspendre dans `lfPass`.** Les cartes « Choisis la forme de
  vie » et « Clique une case pour le prix » de `lfCard` (`app.js:5093`)
  restent pour le prix et le choix d'espèce, qui ne sont pas des manques de
  race ou de nom ; le reste passe au constat.
- [ ] **Step 5 : « Rescanner »** vide `S.lfNoms`, les `nom` des cases, la race
  déduite ; jamais `p.race`. `save()`, `render()`.
- [ ] **Step 6 : Compléter le test du filtre « Données manquantes »** de la
  tâche 7.
- [ ] **Step 7 : Lancer les tests** — PASS, toute la suite.
- [ ] **Step 8 : Commit**

```bash
git add rules.json app.js manifest.json test/run.js
git commit -m "feat: une donnée de forme de vie manquante suspend ses règles et le dit"
```

---

### Task 17 : Les règles de forme de vie

**Files:**
- Modify: `rules.json` — FDV_QUEUE_EMPTY, FDV_RESEARCH_IDLE, FDV_POP_LIMIT,
  FDV_FOOD_LIMIT et FDV_HOUSING_LIMIT (`actif_par_defaut: false`),
  FDV_BASE_FIRST (`niveau` repris de `LF_PALIER`)
- Modify: `app.js:6533` — `LF_PALIER` lit `rules.json`
- Modify: `app.js:1186` — `lfCandidates` met la base en tête quand FDV_POP_LIMIT
  ou FDV_BASE_FIRST la poussent, derrière une priorité du joueur
- Test: `test/run.js`

- [ ] **Step 1 : Tests qui échouent.**

```js
t('une case que la population bloque : la nourriture passe en tête', () => {
  const g = app(s => { HUMAINS(s); s.planets[0].race = 'humans';
    s.planets[0].lf[11104] = { lvl: 0, state: 'pop', nom: 'Académie des sciences' };
    Object.assign(s.planets[0].lf[11102], { cost: [1, 1, 0], next: 19, secs: 60 });
    Object.assign(s.planets[0].lf[11101], { cost: [1, 1, 0], next: 21, secs: 60 }); });
  assert.equal(g.lfCandidates(g.S.planets[0], 'lfbuilding')[0].id, 11102);
});

t('file de forme de vie vide : sa carte est importante', () => {
  const g = app(s => { HUMAINS(s); s.planets[0].race = 'humans';
    Object.assign(s.planets[0].lf[11101], { cost: [1, 1, 0], next: 21, secs: 60 }); });
  const a = g.simulateDay().sessions[0].acts.find(a => a.kind === 'lf');
  assert.equal(a.niveau, 'important');
});

t('« Ne pas s\'en occuper » coupe les règles de forme de vie', () => {
  const g = app(s => { HUMAINS(s); s.planets[0].race = 'humans'; s.day.lf = 'off'; });
  assert.ok(!g.constats().some(x => x.domaine === 'formes_de_vie' && x.regle !== 'FDV_DATA_MISSING'));
});

t('les paliers de population se lisent du fichier', () => {
  const g = appRegles(Object.assign(JSON.parse(require('fs').readFileSync('rules.json', 'utf8'))), s => {});
  assert.equal(g.LF_PALIER.nourriture, g.regle('FDV_BASE_FIRST').parametres.nourriture);
});
```

- [ ] **Step 2 : Les voir échouer** — FAIL.
- [ ] **Step 3 : Les évaluateurs et l'entrée dans `lfCandidates`.** Les
  règles de forme de vie ne sont pas évaluées sous `lfMode() === 'off'`, sauf
  FDV_DATA_MISSING, qui ne dit qu'un manque.
- [ ] **Step 4 : Lancer les tests** — PASS.
- [ ] **Step 5 : Commit**

```bash
git add rules.json app.js manifest.json test/run.js
git commit -m "feat: files, population et base des formes de vie dans le plan"
```

---

### Task 18 : Les règles propres à une race

**Files:**
- Modify: `rules.json` — `races: ["humans"]` sur les règles qui le demandent,
  `statut: a_valider`
- Modify: `app.js` — `constats()` saute une règle dont `races` ne contient pas
  `raceDe(p).race`
- Test: `test/run.js`

- [ ] **Step 1 : Test qui échoue.**

```js
t('une règle Humains ne s\'évalue pas sur une planète Rocta', () => {
  const r = { id: 'H', domaine: 'formes_de_vie', niveau: 'conseil', condition: 'toujours', effet: 'signaler',
    races: ['humans'], parametres: {}, statut: 'a_valider', actif_par_defaut: true };
  const g = appRegles({ version: 1, mineBalance: { byStyle: {}, byPosition: {} }, lifeforms: {}, regles: [r] },
    s => { s.planets[0].race = 'rocktal'; s.planets[1].race = 'humans'; });
  assert.deepEqual(g.constats().filter(x => x.regle === 'H').map(x => x.pid), ['colo']);
});
```

`EVAL.toujours` est un évaluateur de test, posé par le test sur `g.EVAL`.

- [ ] **Step 2 : Le voir échouer** — FAIL.
- [ ] **Step 3 : Le filtre `races`.**
- [ ] **Step 4 : Lancer les tests** — PASS.
- [ ] **Step 5 : Commit**

```bash
git add rules.json app.js manifest.json test/run.js
git commit -m "feat: une règle peut ne viser qu'une race"
```

---

### Task 19 : Tenue et documentation

**Files:**
- Modify: `test/run.js` — le temps de `constats()`
- Modify: `app.js:7327` — la phrase « Hors plan : formes de vie »
- Modify: `docs/comment-ca-marche.md` — une section « Les règles du moteur » ;
  § 6 reçoit Réglages › Règles et la race par planète
- Modify: `GLOSSARY.md` — *règle*, *constat*, *pousser*, *marquer*,
  *suspendre*, *signaler*
- Test: `test/run.js`

- [ ] **Step 1 : Test.**

```js
t('constats() sur dix planètes en moins de 50 ms', () => {
  const g = app(s => {
    const base = s.planets[0];
    s.planets = Array.from({ length: 10 }, (_, i) => Object.assign(JSON.parse(JSON.stringify(base)),
      { id: 'p' + i, gid: String(200 + i), coords: `1:${100 + i}:8`,
        lf: Object.fromEntries(Array.from({ length: 12 }, (_, k) => [11101 + k, { lvl: 5, nom: 'x' }])) }));
  });
  g.constats();
  const t0 = process.hrtime.bigint(); g.constats(); const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 50, ms + ' ms');
});
```

`Date` est figé par le harnais : la mesure passe par `process.hrtime`.

- [ ] **Step 2 : Lancer** — PASS ; sinon, mettre en cache par rendu ce que
  `constats()` recalcule (`production(p)` en premier).
- [ ] **Step 3 : Corriger la phrase d'`app.js:7327`** : les formes de vie sont
  dans le plan depuis longtemps.
- [ ] **Step 4 : La documentation**, écrite pour être lue sans ouvrir le code,
  comme le reste de `comment-ca-marche.md` : les quatre effets, l'ordre, ce
  qu'un poids 0 fait, les deux verrous, ce qu'« Ignorer » oublie et pour
  combien de temps, le badge.
- [ ] **Step 5 : Lancer toute la suite** — `node test/run.js`, PASS.
- [ ] **Step 6 : Commit**

```bash
git add app.js docs/comment-ca-marche.md GLOSSARY.md manifest.json test/run.js
git commit -m "docs: les règles du moteur, et ce qu'elles font au plan"
```
