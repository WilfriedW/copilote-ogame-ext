# Les priorités du joueur — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le joueur pose une cible — un bâtiment sur une planète, une recherche
— et le plan épargne pour elle, devant ce que le moteur se donnait.

**Architecture:** Une liste `S.prio` dans l'ordre de pose, lue par un accesseur
pur `prios()`. Une priorité de bâtiment devient un objectif `setGoal` posé
avant `tryResearch`, plus un candidat forcé dans `pickBuildings` ; une priorité
de recherche se glisse en tête d'une copie de `ROADMAPS[focus]` avec le drapeau
`'c'`. À partir de là, `reserveOf`, `destOf` et le hangar automatique
travaillent pour elle sans code neuf.

**Tech Stack:** JavaScript sans dépendance, extension Chrome MV3. Tests :
`node test/run.js`, faux DOM maison (`test/page.js`), pas de framework.

**Spec:** `docs/superpowers/specs/2026-11-18-priorites-du-joueur-design.md`

## Global Constraints

- **Chaque commit monte la version** : `APP_VERSION` dans `app.js:2` et
  `version` dans `manifest.json`, les deux à la même valeur.
- Commits en français, sujet à l'intention, corps expliquant le pourquoi,
  terminés par `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Une planète se désigne par son id** (ADR 0001). Un id qui ne répond plus ne
  désigne aucune planète : la priorité est muette, elle ne se rabat pas sur une
  voisine.
- **`prios()` n'écrit jamais.** `simulateDay` remplace `S.tech` et `S.planets`
  par ses copies ; un accesseur à effet de bord amputerait `S.prio` sur une
  prévision. La compaction se fait dans `render()`, hors simulation.
- **Une seule réserve par planète** : `reserveOf` somme les objectifs d'une même
  planète, et deux réserves gèlent tout.
- **Le `res` se calcule par candidat** dans la boucle des bâtiments
  (`app.js:1961`) : un seul `res` pour toute la liste fait qu'un candidat
  impayable en tête bloque tous les suivants.
- Une priorité qui ne peut rien faire le dit. Le silence est l'anti-objectif
  principal.
- Chaque tâche finit par `node test/run.js` au vert sur toute la suite, pas
  seulement sur ses propres tests.

## Review Focus

| Entrée que la spec n'exerce pas | Comportement attendu | Tâche |
| --- | --- | --- |
| Production nulle dans une ressource du coût (deutérium sur une planète sans synthétiseur) : `wait` rend `Infinity` sans que le hangar soit en cause, donc `setGoal` rend `null` | la priorité le dit — « rien ne produit de deutérium ici » — au lieu de disparaître | 2 |
| `S.prio` relu d'un stockage abîmé : `kind` inconnu, `lvl` non numérique, `k` absent de `B` et de `T`, `__proto__` comme `k` | entrée ignorée, aucune exception | 1 |
| Une priorité de recherche sans centre (`S.day.focus === 'fleet'`, `centreIndex() < 0`) | elle épargne sur la planète du plus haut labo, comme le reste du plan | 3 |
| Mode nuit (`S.day.night`) : `REFRESH.today` vide `acts` et `waits` | le bloc « Tes priorités » reste lisible et ne promet aucune carte | 5 |
| La première priorité d'une planète est bloquée par un prérequis | elle garde son rang sans rien réserver, et la suivante n'agit pas | 2 |

---

### Task 1 : L'état et sa lecture

**Files:**
- Modify: `app.js` — `sample()` (`app.js:81`), fusion au chargement (`app.js:117`), accesseurs à poser après `forgetPlanet` (`app.js:143`), appel dans `render()` (`app.js:1066`)
- Modify: `GLOSSARY.md`
- Test: `test/run.js`

**Interfaces:**
- Consumes: `S.planets`, `S.tech`, `B`, `T`, `planetById`, `labPlanet`
- Produces:
  - `prios()` → `Array<{kind:'b'|'t', pid:string, k:string, lvl:number}>`, dans
    l'ordre de `S.prio`, les mortes retirées, le `pid` toujours résolu — celui
    de `labPlanet()` pour `kind:'t'`. Aucun effet de bord.
  - `prioOf(pid)` → la première entrée de `prios()` qui porte ce `pid`, ou
    `null`. C'est elle qui agit ; les autres attendent leur tour.
  - `prioClean()` → réécrit `S.prio` sans les mortes. Appelé par `render()`.
  - Forme stockée : `S.prio = [{kind:'b', pid, k, lvl}, {kind:'t', k, lvl}]`.
    Une entrée `kind:'t'` n'a pas de `pid` en stockage.

- [ ] **Step 1 : Écrire les tests qui échouent** dans `test/run.js`, dans une
section `/* ---------- les priorités du joueur ---------- */`. Ajouter
`'prios'`, `'prioOf'`, `'prioClean'` à la liste d'exports de `app()`.

```js
t('une priorité vivante sort avec son pid résolu', () => {
  const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'lab', lvl:10}]; });
  assert.deepEqual(g.prios(), [{kind:'b', pid:'mere', k:'lab', lvl:10}]);
});

t('une priorité atteinte ne sort plus', () => {
  // la mère est au labo 5 dans la fixture
  const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'lab', lvl:5}]; });
  assert.deepEqual(g.prios(), []);
});

t('une recherche atteinte ne sort plus, une recherche à faire porte le centre', () => {
  const g = app(s => { s.prio = [{kind:'t', k:'astro', lvl:3}, {kind:'t', k:'plasma', lvl:4}]; });
  const l = g.prios();
  assert.equal(l.length, 1, 'astro 3 est déjà acquis dans la fixture');
  assert.equal(l[0].k, 'plasma');
  assert.equal(l[0].pid, g.labPlanet().id);
});

t('une priorité sur une planète oubliée est muette', () => {
  const g = app(s => { s.prio = [{kind:'b', pid:'disparue', k:'lab', lvl:10}]; });
  assert.deepEqual(g.prios(), []);
});

t('une entrée abîmée est ignorée sans exception', () => {
  const g = app(s => { s.prio = [
    {kind:'z', pid:'mere', k:'lab', lvl:10},
    {kind:'b', pid:'mere', k:'__proto__', lvl:10},
    {kind:'b', pid:'mere', k:'lab', lvl:'dix'},
    {kind:'t', k:'plasma', lvl:4}]; });
  assert.deepEqual(g.prios().map(x=>x.k), ['plasma']);
});

t('l\'ordre de pose est gardé, et prioOf rend la première de la planète', () => {
  const g = app(s => { s.prio = [
    {kind:'b', pid:'mere', k:'nanite', lvl:1},
    {kind:'b', pid:'colo', k:'metal', lvl:8},
    {kind:'b', pid:'mere', k:'lab', lvl:10}]; });
  assert.deepEqual(g.prios().map(x=>x.k), ['nanite', 'metal', 'lab']);
  assert.equal(g.prioOf('mere').k, 'nanite');
  assert.equal(g.prioOf('colo').k, 'metal');
  assert.equal(g.prioOf('absente'), null);
});

t('prioClean retire les mortes du stockage, prios n\'y touche pas', () => {
  const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'lab', lvl:5}, {kind:'t', k:'plasma', lvl:4}]; });
  g.prios();
  assert.equal(g.S.prio.length, 2, 'prios() n\'écrit rien');
  g.prioClean();
  assert.deepEqual(g.S.prio, [{kind:'t', k:'plasma', lvl:4}]);
});
```

- [ ] **Step 2 : Lancer les tests pour les voir échouer**

Run: `node test/run.js`
Expected: FAIL, `g.prios is not a function`

- [ ] **Step 3 : Poser `S.prio = []` dans `sample()`** et `S.prio = Array.isArray(S.prio) ? S.prio : []` au chargement, à côté des autres fusions (`app.js:117-123`).

- [ ] **Step 4 : Écrire `prios()`, `prioOf(pid)` et `prioClean()`** après `forgetPlanet` (`app.js:143`).

Une entrée est vivante quand : `kind` vaut `'b'` ou `'t'` ; `lvl` est un entier
positif ; `k` est une clé propre de `B` (pour `'b'`) ou de `T` (pour `'t'`) —
`Object.prototype.hasOwnProperty`, jamais `in`, qui laisserait passer
`__proto__` ; la planète répond (`planetById(pid)` pour `'b'`, `labPlanet()`
pour `'t'`) ; et le niveau visé dépasse le niveau actuel. `prioClean()`
réécrit `S.prio` à partir de `prios()` en laissant tomber le `pid` des entrées
`kind:'t'`, puis `save()`.

- [ ] **Step 5 : Appeler `prioClean()` dans `render()`** (`app.js:1066`), avant `header()`.

- [ ] **Step 6 : Lancer les tests**

Run: `node test/run.js`
Expected: PASS, toute la suite au vert

- [ ] **Step 7 : Ajouter les deux mots à `GLOSSARY.md`**, dans la section Langue, au format des entrées existantes : **priorité** (ce que le joueur pose : une cible chiffrée, bâtiment ou recherche, avec son niveau visé ; _éviter_ : objectif, cible — « Cibles » est l'onglet des inactifs à piller, et objectif est ce que le moteur en fait) et **objectif** (l'épargne que le plan ouvre sur une planète, qu'elle vienne du moteur ou d'une priorité ; _éviter_ : réserve, qui est le montant, pas la raison).

- [ ] **Step 8 : Commit**

```bash
git add app.js GLOSSARY.md test/run.js manifest.json
git commit -m "feat: le joueur peut noter une priorité, et elle se relit"
```

---

### Task 2 : Une priorité de bâtiment épargne, et passe devant le classement

**Files:**
- Modify: `app.js` — helpers à poser avant `pickBuildings` (`app.js:1628`), `pickBuildings` lui-même, pose de l'objectif dans la boucle des sessions avant `tryResearch('pre')` (`app.js:1776`), boucle des bâtiments (`app.js:1957-1965`)
- Test: `test/run.js`

**Interfaces:**
- Consumes: `prios`, `prioOf`, `labPlanet` (tâche 1), `reqOk`, `storageLevelFor`, `production`, `levelCost`, `B`, `B_SHORT`, `T`
- Produces:
  - `prioStep(p, k, lvl)` → `{k, lvl, why}` : ce qu'il faut construire **sur
    `p` maintenant** pour cette priorité. Le hangar quand le coût du **prochain
    niveau** dépasse un plafond de `p` — le pas, jamais le niveau visé, parce
    qu'un niveau se paie un par un (spec, « Le coût du prochain niveau dépasse
    les hangars ») ; sinon le niveau suivant de `k` lui-même. `lvl` ne sert
    alors qu'à nommer la cible sur la carte.
    `p` est une planète simulée (elle porte `st`, pas `stock`) : le test se
    fait sur `production(p).cap`, et le niveau de hangar sur
    `storageLevelFor`. Ne jamais appeler `waitFor`, qui lit `p.stock`.
  - `prioBloque(p, k)` → `string` : la phrase des prérequis qui manquent,
    `reqOk(B[k].req, p)` mis en mots, et `''` quand la priorité est jouable.
    Elle ne lit que `p.b` et `S.tech`, jamais le stock : elle est appelée sur
    une planète réelle (tâche 5) comme sur une copie simulée, et les deux ne
    portent pas le stock sous le même nom.
  - `prioRien(p, cost)` → `string` : quand `setGoal` a rendu `null`, laquelle
    des trois ressources du coût n'arrive jamais sur cette planète — ni
    production, ni stock. Appelée seulement dans `simulateDay`, sur une
    planète simulée.
  - `pickBuildings` accepte `ctx.prio` (une entrée de `prios()` ou `null`) et
    place `prioStep` **après** les deux candidats de secours (centrale sur
    énergie négative, hangar qui va déborder) et **devant** le classement par
    amortissement.

- [ ] **Step 1 : Écrire les tests qui échouent.** Ajouter `'prioStep'`, `'prioBloque'`, `'prioRien'`, `'pickBuildings'` aux exports de `app()`.

```js
/** Une priorité de labo 10 sur la mère, qui est au labo 5 et n'a aucune raison
    de monter son labo aujourd'hui. */
const prioLabo = s => { s.prio = [{kind:'b', pid:'mere', k:'lab', lvl:10}]; };

t('sans priorité, aucune carte de labo ne sort', () => {
  const p = app().simulateDay();
  assert.ok(!p.sessions[0].acts.some(a => a.kind === 'b' && a.k === 'lab'));
});

t('avec la priorité, le labo sort et porte sa raison', () => {
  const p = app(prioLabo).simulateDay();
  const a = p.sessions[0].acts.find(x => x.kind === 'b' && x.k === 'lab');
  assert.ok(a, 'le labo est proposé');
  assert.equal(a.lvl, 6, 'le niveau suivant, pas le niveau visé');
  assert.match(a.why, /priorité/i);
});

t('la priorité ouvre un objectif, et la recherche n\'en ouvre pas un second', () => {
  const p = app(prioLabo).simulateDay();
  const g = p.sessions[0].goals.filter(x => x.key.startsWith('prio:'));
  assert.equal(g.length, 1);
  assert.equal(p.sessions[0].goals.length, 1, 'un seul objectif sur la planète');
});

t('un coût au-dessus du hangar fait sortir le hangar, pas le silence', () => {
  // Nanites : 1 M de métal, très au-dessus du Hangar M 3 de la fixture
  const p = app(s => { s.prio = [{kind:'b', pid:'mere', k:'nanite', lvl:1}];
    s.planets[0].b.robot = 10; s.tech.computer = 10; }).simulateDay();
  const tout = p.sessions.flatMap(x => x.acts).concat(p.sessions.flatMap(x => x.waits));
  assert.ok(tout.some(a => a.k === 'smetal'), 'le hangar de métal est demandé');
});

t('un prérequis manquant ne réserve rien et le dit', () => {
  const p = app(s => { s.prio = [{kind:'b', pid:'mere', k:'nanite', lvl:1}]; }).simulateDay();
  assert.equal(p.sessions[0].goals.filter(x => x.key.startsWith('prio:')).length, 0);
  const dit = p.sessions[0].acts.concat(p.sessions[0].waits).map(x => x.why || '').join(' ');
  assert.match(dit, /Robots 10/);
});

t('une ressource sans production le dit au lieu de disparaître', () => {
  // la colonie n'a ni synthétiseur ni deutérium en stock : il n'y vient jamais
  const p = app(s => { s.prio = [{kind:'b', pid:'colo', k:'fusion', lvl:1}];
    s.planets[1].b.deut = 5; s.planets[1].stock = {m:9000, c:4000, d:0, at:0};
    s.planets[1].tmax = 150; }).simulateDay();
  const dit = p.sessions[0].waits.map(x => (x.why || '') + ' ' + (x.what || '')).join(' ');
  assert.match(dit, /deutérium/i);
});

t('prioBloque ne lit pas le stock : elle vaut sur une planète réelle', () => {
  const g = app();
  assert.match(g.prioBloque(g.S.planets[1], 'nanite'), /Robots 10/);
  assert.equal(g.prioBloque(g.S.planets[0], 'lab'), '');
});

t('la centrale passe devant la priorité quand l\'énergie est négative', () => {
  const p = app(s => { prioLabo(s); s.planets[0].b.solar = 1; }).simulateDay();
  const a = p.sessions[0].acts.find(x => x.kind === 'b' && x.p === 0);
  assert.equal(a && a.k, 'solar', 'la centrale d\'abord');
});

t('la réserve de la priorité ne gèle pas la centrale', () => {
  // le secours doit être payable même quand la réserve couvre tout le stock
  const p = app(s => { prioLabo(s); s.planets[0].b.solar = 1;
    s.planets[0].stock = {m:5000, c:5000, d:1000, at:0}; }).simulateDay();
  const tout = p.sessions.flatMap(x => x.acts);
  assert.ok(tout.some(a => a.k === 'solar'), 'la centrale finit par sortir');
});

t('sur le centre, une priorité de recherche posée avant tient le rang', () => {
  const g = app(s => { s.prio = [
    {kind:'t', k:'plasma', lvl:4},
    {kind:'b', pid:'mere', k:'lab', lvl:10}]; s.tech.energy = 8; });
  assert.equal(g.prioOf(g.labPlanet().id).kind, 't', 'la file ignore les kind');
  const p = g.simulateDay();
  assert.ok(!p.sessions[0].acts.some(a => a.kind === 'b' && a.k === 'lab'));
});

t('deux planètes, deux priorités : les transports vont à la première posée', () => {
  const p = app(s => { s.prio = [
    {kind:'b', pid:'colo', k:'metal', lvl:12},
    {kind:'b', pid:'mere', k:'lab', lvl:10}]; }).simulateDay();
  const g = p.sessions[0].goals.filter(x => x.key.startsWith('prio:'));
  assert.equal(g.length, 2, 'les deux épargnent chez elles');
  assert.match(g[0].label, /Métal/, 'l\'ordre de pose décide de l\'ordre dans goals');
});

t('la première priorité d\'une planète bloquée garde son rang', () => {
  const p = app(s => { s.prio = [
    {kind:'b', pid:'mere', k:'nanite', lvl:1},
    {kind:'b', pid:'mere', k:'lab', lvl:10}]; }).simulateDay();
  assert.ok(!p.sessions[0].acts.some(a => a.kind === 'b' && a.k === 'lab'),
    'la seconde n\'agit pas tant que la première est posée');
});
```

- [ ] **Step 2 : Lancer les tests pour les voir échouer**

Run: `node test/run.js`
Expected: FAIL, le labo n'est jamais proposé

- [ ] **Step 3 : Écrire `prioBloque(p, k)` et `prioStep(p, k, lvl)`** avant `pickBuildings` (`app.js:1628`).

`prioBloque` met en mots `reqOk(B[k].req, p)` et rien de plus. `prioRien`
nomme la ressource que la planète ne produit pas et ne porte pas en stock :
c'est elle qui rend `wait` infini sans que le hangar soit en cause, et
`setGoal` renverrait `null` en silence. `prioStep` rend le hangar
(`{k:'smetal'|'scrystal'|'sdeut', lvl:storageLevelFor(cost[j])}`) dès qu'un
`cost[j]` dépasse `production(p).cap[j]`, sinon `{k, lvl:p.b[k]+1}`.

- [ ] **Step 4 : Poser l'objectif de la priorité dans la boucle des sessions**, juste avant `tryResearch('pre')` (`app.js:1776`).

Pour chaque planète simulée `p` : `pr = prioOf(p.id)`, ignorée si elle est de
`kind:'t'`, si `p.b[pr.k] >= pr.lvl` dans la simulation, ou si `prioBloque`
rend une phrase. Sinon `setGoal('prio:'+p.id+':'+pr.k, …)` avec le coût de
`prioStep`, et `pickBuildings` reçoit `pr` par `ctx.prio`. Quand `setGoal`
rend `null` — une ressource du coût n'arrive jamais ici — pousser une ligne
de `waits` qui le dit, avec la phrase de `prioRien` : c'est le seul chemin où
la priorité ne peut rien faire, et il ne doit pas être muet.

- [ ] **Step 5 : Faire qu'aucun objectif spontané ne se pose** sur une planète qui porte déjà un objectif `prio:`.

Deux endroits, pas un : `tryResearch` (`app.js:1768`) pour la recherche
critique et la famine, **et** le bloc du vaisseau de colonisation
(`app.js:1792`), qui pose le sien sur le centre — exactement là où une
priorité de labo se pose. Un objectif qui vient d'une priorité de recherche,
lui, se pose normalement : c'est la priorité elle-même.

- [ ] **Step 6 : Placer le candidat forcé dans `pickBuildings`**, après les deux `add` de secours (énergie négative, hangar qui déborde) et avant le reste.

- [ ] **Step 7 : Pousser les objectifs de priorité dans `goals` dans l'ordre de `prios()`**

`destOf` (`app.js:1817`) rend le premier objectif du tableau qui n'est pas la
planète d'origine : c'est lui qui reçoit les rapatriements de l'empire. L'ordre
de `goals` était sans conséquence — les deux seuls objectifs vivaient au même
endroit — et il devient l'arbitre. La boucle de la Step 4 suit donc l'ordre de
`prios()`, pas celui de `P`.

- [ ] **Step 8 : Calculer le `res` par candidat** dans la boucle des bâtiments (`app.js:1961`).

`cands.find(…)` remplace son `res` unique par un `res` calculé pour le candidat
examiné : `reserveOf(p, Tm, gPrio)` — l'objectif de la priorité sauté — pour la
priorité elle-même et pour les deux candidats de secours, `reserveOf(p, Tm)`
pour les autres. La raison n'est pas qu'un candidat impayable arrêterait la
liste — `find` continue après lui — mais qu'un `res` unique oppose la réserve
de la priorité **à la priorité elle-même**, qui s'interdit alors de dépenser ce
qu'elle a mis de côté, et au secours, qui ne peut plus soigner la planète.

- [ ] **Step 9 : Lancer les tests**

Run: `node test/run.js`
Expected: PASS, toute la suite au vert

- [ ] **Step 10 : Commit**

```bash
git add app.js test/run.js manifest.json
git commit -m "feat: une priorité de bâtiment épargne, et passe devant le rendement"
```

---

### Task 3 : Une priorité de recherche passe en tête de la feuille de route

**Files:**
- Modify: `app.js` — `nextResearch` (`app.js:1534-1592`), boucle des plafonds (`app.js:1572`)
- Test: `test/run.js`

**Interfaces:**
- Consumes: `prios`, `prioOf` (tâche 1), `prioStep`, `prioBloque` (tâche 2), `ROADMAPS`, `resolveTech`, `labPlanet`
- Produces: `nextResearch()` inchangé dans sa forme — `{list, labNeed, k, lvl}` — mais sa `list[0]` est la priorité du joueur quand il y en a une, et elle porte `crit: true`.

- [ ] **Step 1 : Écrire les tests qui échouent.** Retourner d'abord le test de la tâche 2 qui entérine le silence d'une priorité `kind:'t'` : cette tâche est précisément ce qui le fait parler, et le laisser tel quel ferait passer la tâche contre un test qui affirme le contraire d'elle.

```js
t('une priorité de recherche prend la tête de la feuille de route', () => {
  const g = app(s => { s.prio = [{kind:'t', k:'plasma', lvl:4}]; });
  const nr = g.nextResearch();
  assert.equal(nr.list[0].k, 'energy', 'le prérequis d\'abord, par resolveTech');
  assert.ok(nr.list[0].crit);
});

t('un plafond « tête » ne double pas une priorité', () => {
  // toutes les planètes prises : Astrophysique s'unshift aujourd'hui
  const g = app(s => { s.prio = [{kind:'t', k:'plasma', lvl:4}];
    s.tech.astro = 1; s.tech.energy = 8; s.tech.laser = 10; s.tech.ion = 5; });
  assert.equal(g.nextResearch().list[0].k, 'plasma');
});

t('la priorité de recherche dit pourquoi elle est là', () => {
  const g = app(s => { s.prio = [{kind:'t', k:'plasma', lvl:4}]; s.tech.energy = 8; });
  assert.match(g.nextResearch().list[0].why, /priorité/i);
});

t('sans centre, la priorité de recherche épargne sur le plus haut labo', () => {
  const p = app(s => { s.prio = [{kind:'t', k:'plasma', lvl:4}];
    s.day.focus = 'fleet'; s.tech.energy = 8; }).simulateDay();
  const g = p.sessions[0].goals[0];
  assert.ok(g, 'un objectif est ouvert');
  assert.match(g.label, /Plasma/);
});

t('une priorité de recherche trop chère pour le hangar fait sortir le hangar', () => {
  const p = app(s => { s.prio = [{kind:'t', k:'plasma', lvl:12}];
    s.tech.energy = 8; s.tech.plasma = 11; }).simulateDay();
  const tout = p.sessions.flatMap(x => x.acts).concat(p.sessions.flatMap(x => x.waits));
  assert.ok(tout.some(a => a.k === 'scrystal'), 'le hangar de cristal est demandé');
});
```

- [ ] **Step 2 : Lancer les tests pour les voir échouer**

Run: `node test/run.js`
Expected: FAIL, `list[0].k` vaut la recherche de la feuille de route

- [ ] **Step 3 : Glisser la priorité en tête d'une copie de `ROADMAPS[focus]`** au début de `nextResearch` (`app.js:1535`), sous la forme `[k, lvl, 'c']`.

Une copie, jamais la table elle-même. `resolveTech` fait le reste : prérequis,
`labNeed`, paliers intermédiaires.

- [ ] **Step 4 : Empêcher un plafond « tête » de passer devant** dans la boucle des plafonds (`app.js:1572`).

`tryResearch` ne regarde que `nr.list[0]` : sans cette ligne, l'`unshift` de
l'Astrophysique rend la priorité inerte.

- [ ] **Step 5 : Faire dire au `why` que c'est une priorité du joueur**, devant le texte que `techWhy` compose déjà — **et ce qu'elle déplace**.

C'est la carte de la priorité qui porte la phrase, parce que la recherche
écartée n'a aucune ligne à elle : `nr.list` au-delà de `[0]` ne s'affiche
nulle part. Quand la priorité a chassé un plafond « tête », son `why` le dit :
« Une planète de plus attend : tu as mis Plasma 12 devant. »

- [ ] **Step 6 : Faire que la priorité de recherche passe par `prioStep`** quand son coût dépasse les plafonds du centre : le hangar devient la cible du moment, comme pour un bâtiment. La priorité garde son rang, elle fait un pas de côté.

- [ ] **Step 7 : Lancer les tests**

Run: `node test/run.js`
Expected: PASS, toute la suite au vert

- [ ] **Step 8 : Commit**

```bash
git add app.js test/run.js manifest.json
git commit -m "feat: une recherche mise en priorité passe devant la feuille de route"
```

---

### Task 4 : Les cartes disent ce que la priorité retient

**Files:**
- Modify: `app.js` — `waits.push` de `tryResearch` (`app.js:1780`), rendu des attentes dans `REFRESH.today` (`app.js:3288`)
- Test: `test/run.js`

**Interfaces:**
- Consumes: les `acts` et `waits` des tâches 2 et 3
- Produces: les lignes de `waits` portent `held` (booléen, déjà posé aux lignes `1948` et `1964`) **et** `heldBy` (string) : le libellé de l'objectif qui retient, `''` sinon. Le rendu des attentes l'affiche.

- [ ] **Step 1 : Écrire les tests qui échouent**

```js
t('la recherche retenue par une priorité le dit', () => {
  // Nanites : un million de métal, donc l'étape est le Hangar M, très au-delà
  // du stock — la réserve tient toute la journée simulée
  const p = app(s => { s.prio = [{kind:'b', pid:'mere', k:'nanite', lvl:1}];
    s.planets[0].b.robot = 10; s.tech.computer = 10; }).simulateDay();
  const w = p.sessions[0].waits.find(x => x.kind === 't');
  assert.ok(w, 'la recherche attend');
  assert.ok(w.held, 'elle est retenue');
  assert.match(w.heldBy, /Hangar M/);
});
```

- [ ] **Step 2 : Lancer le test pour le voir échouer**

Run: `node test/run.js`
Expected: FAIL, `w.held` vaut `undefined`

- [ ] **Step 3 : Poser `held` et `heldBy` sur le `waits.push` de `tryResearch`** (il ne porte aujourd'hui ni l'un ni l'autre) (`app.js:1780`), lus sur les objectifs de la planète du labo.

- [ ] **Step 4 : Poser `heldBy` sur les deux `waits.push` qui portent déjà `held`** (`app.js:1948` et `1964`).

- [ ] **Step 5 : Afficher la retenue** dans le rendu des attentes de `REFRESH.today` (`app.js:3288`), à côté du « il manque » : « Retenu : tu épargnes pour Labo 6. » Rien quand `heldBy` est vide.

- [ ] **Step 6 : Lancer les tests**

Run: `node test/run.js`
Expected: PASS, toute la suite au vert

- [ ] **Step 7 : Commit**

```bash
git add app.js test/run.js manifest.json
git commit -m "feat: une carte en attente dit pour quoi la planète épargne"
```

---

### Task 5 : Le joueur pose et retire

**Files:**
- Modify: `app.js` — grille des niveaux (`app.js:3108`), table des recherches (`app.js:3113`), bloc dans `REFRESH.today` à côté de `noRestore` (`app.js:3296`), `bind()` (`app.js:3461-3466`)
- Modify: `panel.css`
- Test: `test/run.js`

**Interfaces:**
- Consumes: `prios`, `prioOf` (tâche 1), `VIEWS.planets`, `VIEWS.research`, `REFRESH.today`
- Produces: `prioHtml()` → le bloc « Tes priorités », `''` quand la liste est vide. Champs `data-prio="<k>"` dans les cartes de planète et la table des recherches ; bouton `data-prio-del="<rang>"` dans le bloc.

- [ ] **Step 1 : Écrire les tests qui échouent.** Ajouter `'prioHtml'` aux exports de `app()`.

```js
t('la grille des niveaux porte un champ de niveau visé', () => {
  const h = app().VIEWS.planets();
  assert.match(h, /data-prio="lab"/);
});

t('le bloc nomme la planète, la cible et celle qui attend son tour', () => {
  const g = app(s => { s.prio = [
    {kind:'b', pid:'mere', k:'lab', lvl:10},
    {kind:'b', pid:'mere', k:'metal', lvl:20}]; });
  const h = g.prioHtml();
  assert.match(h, /Planète mère/);
  assert.match(h, /Labo 10/);
  assert.match(h, /attend son tour/);
  assert.match(h, /data-prio-del/);
});

t('aucun bloc quand il n\'y a aucune priorité', () => {
  assert.equal(app().prioHtml(), '');
});

t('en mode nuit le bloc reste lisible et ne promet rien', () => {
  const g = app(s => { s.day.night = true; s.prio = [{kind:'b', pid:'mere', k:'lab', lvl:10}]; });
  const h = g.prioHtml();
  assert.match(h, /Labo 10/);
  assert.doesNotMatch(h, /épargne|lancement/i);
});
```

- [ ] **Step 2 : Lancer les tests pour les voir échouer**

Run: `node test/run.js`
Expected: FAIL, pas de `data-prio` dans la grille

- [ ] **Step 3 : Ajouter le champ de niveau visé** dans la grille des niveaux (`app.js:3108`) et dans la table des recherches (`app.js:3113`), vide quand aucune priorité ne porte cette clé.

- [ ] **Step 4 : Écrire `prioHtml()`** à côté de `noRestore` (`app.js:2712`).

Une ligne par priorité dans l'ordre : la planète (pour `kind:'b'`), la cible
« Labo 10 », son état — celle qui agit, celles qui attendent leur tour, celle
qui est bloquée avec la phrase de `prioBloque` — et « Retirer ». En mode nuit,
l'état se tait : le plan du jour ne tourne pas.

- [ ] **Step 5 : Rendre le bloc** dans `REFRESH.today`, dans `tdNow`, juste avant `noRestore()` (`app.js:3296`) : les deux disent la même chose, le joueur qui reprend la main.

- [ ] **Step 6 : Brancher les deux gestes dans `bind()`** (`app.js:3461`).

Le champ écoute `change`, **pas `input`** comme ses voisins : sur un labo 5,
taper « 10 » passe par « 1 », la priorité serait jugée atteinte, jetée, puis
recréée en fin de liste — et l'ordre de pose est l'arbitre de précédence.
Valeur vide ou au-dessous du niveau actuel : l'entrée est retirée. Sinon elle
est ajoutée **en fin de liste** si elle n'y est pas, ou son `lvl` est mis à
jour sur place si elle y est, pour qu'une correction ne coûte pas son rang.
Puis `save()` et `render()`. Le bouton `data-prio-del` retire l'entrée de son
rang, `save()`, `render()`.

- [ ] **Step 7 : Styler le bloc dans `panel.css`** au format des listes `advice` existantes, et donner au champ de niveau visé une largeur qui ne casse pas la grille `tight`.

- [ ] **Step 8 : Lancer les tests**

Run: `node test/run.js`
Expected: PASS, toute la suite au vert

- [ ] **Step 9 : Commit**

```bash
git add app.js panel.css test/run.js manifest.json
git commit -m "feat: poser une priorité là où le niveau se lit, la retirer là où le plan se lit"
```
