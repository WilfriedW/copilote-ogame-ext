# Vocation de planète et centre — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le copilote lit la vocation de chaque planète, désigne un centre, et y place le labo et le chantier au lieu de les subir.

**Architecture:** Trois fonctions nouvelles dans `app.js` — `terrainRates(p)`, `vocations()`, `centreIndex()` — et le remplacement de `hubIndex()`/`labPlanet()` par le centre aux endroits que la conception liste. Aucun fichier nouveau : `app.js` est un script unique chargé par la page, et le projet le garde ainsi. Les mines ne sont pas touchées : `rankUpgrades` reste seul maître du classement.

**Tech Stack:** JavaScript sans dépendance, script classique (pas de module). Tests : `node test/run.js`, assertions Node, sans framework.

**Spec:** [docs/superpowers/specs/2026-11-18-vocation-de-planete-design.md](../specs/2026-11-18-vocation-de-planete-design.md)

## Global Constraints

- **Chaque commit incrémente la version** dans `manifest.json` (`"version"`) et `app.js` (`const APP_VERSION`), les deux toujours égales. Base : `1.46.1`.
- **Ne jamais stager `content.js`** : il porte une modification antérieure à ce travail. Chaque `git add` nomme ses fichiers.
- **Baseline :** `node test/run.js` affiche `452 vérifications passées` avant de commencer. Aucune tâche ne le fait baisser.
- **Une planète se désigne par son id local** (ADR 0001). Un id qui ne répond plus ne désigne aucune planète : on retombe sur le choix automatique, jamais sur une voisine.
- **`rankUpgrades` n'est pas modifié.** Aucun poids, aucun plafond, aucun filtre lié à la vocation.
- Pas de donnée nouvelle lue dans le jeu, pas de sélecteur nouveau dans `content.js`.
- Le français du projet : commentaires et libellés en français, commentaires qui disent *pourquoi*.

## Review Focus

- **`S.centre` désigne une planète retirée** → retombe sur le choix automatique sans lever (Task 2).
- **Empire d'une seule planète** → aucune vocation, aucun centre, plan inchangé (Tasks 1 et 2).
- **Coordonnées illisibles** (`parseC` rend `null`) → vocation « inconnue », et la planète ne fausse pas la comparaison des autres (Task 1).
- **Toutes les planètes au même terrain** → aucune ne porte de vocation, puisque rien ne les distingue (Task 1).
- **Centre choisi à la main sur une planète sans labo, alors qu'un labo existe ailleurs** → `labLevel()` tombe à ce labo-là, le plan obéit, et rien ne lève (Task 3).

---

### Task 1 : La vocation se lit sur le terrain

**Files:**
- Modify: `app.js` — après `production()` et `mse()`, avant `rankUpgrades` (~`app.js:900`)
- Test: `test/run.js`

**Interfaces:**
- Consumes: `production(p, ov)`, `parseC(s)`, `POS_BONUS_M`, `POS_BONUS_C` (déjà présents)
- Produces:
  - `terrainRates(p)` → `{m:number, c:number, d:number} | null` — `null` quand `parseC(p.coords)` rend `null`
  - `vocations()` → `{[planetId]: {keys: string[], why: string}}` — une entrée par planète qui porte au moins une vocation ; `keys` parmi `'metal'`, `'crystal'`, `'deut'`. Une planète sans vocation est absente de l'objet. Une planète aux coordonnées illisibles porte `{keys: [], why: 'vocation inconnue'}`.

- [ ] **Step 1 : Écrire les tests qui échouent**

Dans `test/run.js`, après le bloc des alertes de planète, et en ajoutant `'terrainRates'`, `'vocations'` à la liste des noms exportés par `app()` :

```js
t('la planète en 8 porte le métal, la colonie en 6 ne porte rien', () => {
  const g = app();
  const v = g.vocations();
  assert.deepEqual(v.mere.keys, ['metal', 'deut'], 'mère première sur métal et deutérium');
  assert.ok(!v.colo, 'la colonie n\'est première sur rien');
});

t('sans planète en position 1 à 3, personne ne porte le cristal', () => {
  const g = app();
  const v = g.vocations();
  assert.ok(!Object.values(v).some(x => x.keys.includes('crystal')));
});

t('une planète en position 1 porte le cristal', () => {
  const g = app(s => { s.planets[1].coords = '1:142:1'; s.planets[1].tmax = 240; });
  assert.deepEqual(g.vocations().colo.keys, ['crystal']);
});

t('une planète seule n\'a pas de vocation', () => {
  const g = app(s => { s.planets = [s.planets[0]]; });
  assert.deepEqual(g.vocations(), {});
});

t('deux planètes au même terrain n\'ont aucune vocation', () => {
  const g = app(s => { s.planets[1].coords = '1:143:8'; s.planets[1].tmax = 40; });
  assert.deepEqual(g.vocations(), {});
});

t('des coordonnées illisibles donnent une vocation inconnue, sans fausser l\'autre', () => {
  const g = app(s => { s.planets[1].coords = 'ailleurs'; });
  const v = g.vocations();
  assert.deepEqual(v.colo, { keys: [], why: 'vocation inconnue' });
  assert.ok(v.mere.keys.length > 0, 'la mère garde sa vocation');
  assert.equal(g.terrainRates(g.S.planets[1]), null);
});

t('la vocation porte sa raison', () => {
  const g = app();
  assert.ok(/position 8/.test(g.vocations().mere.why), g.vocations().mere.why);
});
```

- [ ] **Step 2 : Lancer les tests pour les voir échouer**

Run: `node test/run.js`
Expected: échecs sur les sept, `g.vocations is not a function`.

- [ ] **Step 3 : Écrire `terrainRates(p)` dans `app.js`**

Signature : `function terrainRates(p)`. Rend `null` si `parseC(p.coords)` rend `null`. Sinon appelle `production(p, ov)` avec `ov = {metal:20, crystal:20, deut:20, fusion:0, crawlers:0, solar:L}` où `L` est monté jusqu'à ce que `factor === 1` — même boucle bornée que `rankUpgrades` (`app.js:875`). Rend `{m, c, d}` de ce `production`, **sans** le bonus de forme de vie : soustraire `lfBonusOf(p)` des trois taux, ou passer par un `p` dépouillé de `lf`. Un commentaire dit pourquoi fusion, foreuses et formes de vie sortent : ce ne sont pas des traits du sol, et la lecture des formes de vie périme au bout de sept jours, ce qui ferait changer une vocation toute seule.

- [ ] **Step 4 : Écrire `vocations()` dans `app.js`**

Signature : `function vocations()`. Pour chacune des trois clés : prendre le maximum et le minimum des taux sur les planètes dont `terrainRates` n'est pas `null` ; si `max - min` est négligeable devant `max` (pas de dispersion), la ressource ne donne de vocation à personne. Sinon, toute planète au maximum la porte. Une planète absente de toutes les listes n'entre pas dans l'objet rendu. `why` nomme ce qui fonde la vocation : la position et son bonus pour le métal et le cristal, la température et le rang de froideur pour le deutérium.

- [ ] **Step 5 : Lancer les tests**

Run: `node test/run.js`
Expected: `459 vérifications passées`, aucun échec.

- [ ] **Step 6 : Commit**

```bash
git add app.js manifest.json test/run.js
git commit -m "feat: chaque planète dit ce que son sol lui donne de mieux"
```
(version `1.46.2` dans les deux fichiers)

---

### Task 2 : Le centre se choisit

**Files:**
- Modify: `app.js` — `migratePlanetIds` (`app.js:154`), `sample()` (`app.js:80`), et un bloc neuf près de `hubIndex()` (`app.js:2777`)
- Test: `test/run.js`

**Interfaces:**
- Consumes: `terrainRates`, `planetById`, `POS` (`app.js:1104`), `FOCUS` (`app.js:1351`)
- Produces:
  - `centreIndex()` → `number` — l'index du centre dans `S.planets`, ou `-1` quand il n'y en a pas
  - `centrePlanet()` → planète | `null`
  - `centreWhy()` → `string` — la raison du choix automatique, vide quand le joueur a choisi
  - `S.centre` : `string | null` dans l'état enregistré

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter `'centreIndex'`, `'centrePlanet'`, `'centreWhy'` aux noms exportés.

```js
t('le centre est la planète qui porte déjà le labo', () => {
  assert.equal(app().centrePlanet().id, 'mere');
});

t('sur un empire neuf, le centre est la planète qui a le plus de cases, pas la première', () => {
  const g = app(s => {
    s.planets[0].coords = '1:142:15'; s.planets[0].tmax = -110;
    s.planets[0].b.lab = 0; s.planets[0].b.shipyard = 0;
    s.planets[1].coords = '1:142:8'; s.planets[1].tmax = 40;
  });
  assert.equal(g.centrePlanet().id, 'colo', 'la position 8 a 204 cases, la 15 en a 127');
});

t('en stratégie flotte, il n\'y a pas de centre', () => {
  const g = app(s => { s.day.focus = 'fleet'; });
  assert.equal(g.centreIndex(), -1);
  assert.equal(g.centrePlanet(), null);
});

t('une planète seule n\'est pas un centre', () => {
  const g = app(s => { s.planets = [s.planets[0]]; });
  assert.equal(g.centreIndex(), -1);
});

t('le joueur reprend la main', () => {
  const g = app(s => { s.centre = 'colo'; });
  assert.equal(g.centrePlanet().id, 'colo');
  assert.equal(g.centreWhy(), '');
});

t('un centre qui ne répond plus retombe sur le choix automatique', () => {
  const g = app(s => { s.centre = 'disparue'; });
  assert.equal(g.centrePlanet().id, 'mere');
});

t('l\'ancien réglage de rôle est oublié au chargement', () => {
  const g = app(s => { s.roles = { mere: 'crystal' }; });
  assert.equal(g.S.roles, undefined);
});
```

- [ ] **Step 2 : Lancer les tests pour les voir échouer**

Run: `node test/run.js`
Expected: échecs sur les sept.

- [ ] **Step 3 : Écrire le centre dans `app.js`**

`sample()` porte `centre: null` et perd `roles`. `migratePlanetIds` fait `delete S.roles` et, comme pour `S.plan`, un commentaire dit que rien ne le lisait.

`centreIndex()` rend `-1` quand `S.day.focus === 'fleet'` ou quand `S.planets.length < 2`. Sinon, si `S.centre` désigne une planète vivante, son index. Sinon le choix automatique : si une planète a `b.lab > 0` ou `b.shipyard > 0`, celle dont `Math.max(b.lab, b.shipyard)` est la plus haute ; sinon celle dont `POS[pos].avg` est le plus grand. Départage dans les deux cas : la production en équivalent métal, puis l'index le plus grand — une colonie passe devant la planète mère, que le wiki écarte.

`centreWhy()` rend `''` quand `S.centre` a décidé, et sinon la phrase du choix : le bâti déjà posé, ou le nombre de cases attendu de la position.

- [ ] **Step 4 : Lancer les tests**

Run: `node test/run.js`
Expected: `466 vérifications passées`.

- [ ] **Step 5 : Commit**

```bash
git add app.js manifest.json test/run.js
git commit -m "feat: une planète devient le centre, et ce n'est pas la première venue"
```
(version `1.46.3`)

---

### Task 3 : La recherche part du centre

**Files:**
- Modify: `app.js` — `labPlanet()` et `labLevel()` (`app.js:668-669`), `labP` (`app.js:1641`)
- Test: `test/run.js`

**Interfaces:**
- Consumes: `centrePlanet()`, `centreIndex()` (Task 2)
- Produces: rien de neuf ; `labPlanet()` et `labLevel()` gardent leur signature.

- [ ] **Step 1 : Écrire les tests qui échouent**

```js
t('la recherche part du centre, pas du plus haut labo', () => {
  const g = app(s => { s.centre = 'colo'; s.planets[1].b.lab = 2; });
  assert.equal(g.labPlanet().id, 'colo', 'la mère a le labo 5, le centre est la colonie');
});

t('la carte du labo dit pourquoi c\'est là', () => {
  const g = app(s => { s.centre = 'colo'; });
  const a = g.simulateDay().acts.find(x => x.kind === 'b' && x.k === 'lab');
  if (a) assert.ok(/centre/i.test(a.why), 'la raison nomme le centre : ' + a.why);
});

t('le niveau de labo est celui du centre, pas le maximum de l\'empire', () => {
  const g = app(s => { s.centre = 'colo'; });
  assert.equal(g.labLevel(), 0, 'la colonie n\'a pas de labo, la mère en a 5');
});

t('sans centre, le labo reste le plus haut de l\'empire', () => {
  const g = app(s => { s.day.focus = 'fleet'; });
  assert.equal(g.labLevel(), 5);
});
```

Ajouter `'labLevel'`, `'labPlanet'` aux noms exportés.

- [ ] **Step 2 : Lancer les tests pour les voir échouer**

Run: `node test/run.js`
Expected: `labLevel()` rend `5` au lieu de `0` dans le deuxième.

- [ ] **Step 3 : Brancher le centre**

`labPlanet()` rend `centrePlanet()` quand il y en a un, et sinon garde sa réduction actuelle sur le plus haut labo. `labLevel()` rend le labo de `labPlanet()`, et non plus le maximum : un commentaire dit qu'une recherche se lance depuis une planète et que c'est le labo de celle-là qui en fixe la durée et les prérequis. Dans `simulateDay`, `labP` devient `P[centreIndex()]` quand l'index est valide, et garde sinon sa réduction actuelle.

La carte du labo (`app.js:1647`, aujourd'hui « Débloque la recherche suivante ») ajoute la raison du lieu quand il y a un centre : c'est de là que partent les recherches et les vaisseaux.

- [ ] **Step 4 : Lancer les tests**

Run: `node test/run.js`
Expected: `470 vérifications passées`.

- [ ] **Step 5 : Commit**

```bash
git add app.js manifest.json test/run.js
git commit -m "feat: la recherche se paie et se lance depuis le centre"
```
(version `1.46.4`)

---

### Task 4 : Les transports, les liens et le raid

**Files:**
- Modify: `app.js` — `missionGo` (`app.js:271`), `galaxyUrl` (`app.js:281`), `hubP` (`app.js:1675`), `raidPlan` (`app.js:2791`)
- Test: `test/run.js`

**Interfaces:**
- Consumes: `centreIndex()` (Task 2), `donorsOf()` (`app.js:539`)
- Produces: `cargoHomeIndex()` → `number` — l'index de la planète de plus grande capacité de fret, `0` à défaut.

- [ ] **Step 1 : Écrire les tests qui échouent**

```js
t('le raid part de la planète qui a les transporteurs, pas du centre', () => {
  const g = app(s => {
    s.centre = 'colo';
    s.raid = { coords: '1:142:9', m: 500000, c: 200000, d: 0, at: Date.now(), safe: true };
  });
  assert.equal(g.raidPlan().home.id, 'mere', 'les transporteurs sont sur la mère');
});

t('les liens ouvrent le jeu sur le centre', () => {
  const g = app(s => {
    s.centre = 'colo'; s.host = 's199-fr.ogame.gameforge.com';
    s.planets[0].gid = '111'; s.planets[1].gid = '222';
  });
  assert.ok(/cp=222/.test(g.goUrl('galaxy', g.centreIndex())), 'la galaxie s\'ouvre sur la colonie');
});
```

- [ ] **Step 2 : Lancer les tests pour les voir échouer**

Run: `node test/run.js`
Expected: le second échoue (`centreIndex` n'est pas encore branché sur `goUrl`). Le premier passe déjà, parce que `hubIndex()` tombe aujourd'hui sur la mère par coïncidence : c'est un test de non-régression, il protège l'étape 3 contre le branchement naïf du centre sur `raidPlan`.

- [ ] **Step 3 : Brancher le centre et le fret**

Écrire `cargoHomeIndex()` : l'index de la planète dont `(sh.lc||0)*25000 + (sh.sc||0)*5000` est le plus grand, `0` quand aucune n'a de transporteur — la même mesure que `donorsOf` (`app.js:540`) utilise pour choisir sa base. `raidPlan` prend `S.planets[cargoHomeIndex()]` et non `hubIndex()`, avec un commentaire : un centre désigné à la main sur une colonie neuve donnerait un plan de raid sans vaisseaux, en silence.

`missionGo` et `galaxyUrl` prennent `centreIndex()` quand il est valide, et `hubIndex()` sinon. `hubP` dans `simulateDay` devient `P[centreIndex()]` quand l'index est valide.

- [ ] **Step 4 : Lancer les tests**

Run: `node test/run.js`
Expected: `472 vérifications passées`.

- [ ] **Step 5 : Commit**

```bash
git add app.js manifest.json test/run.js
git commit -m "fix: le raid part d'où sont les transporteurs, les liens du centre"
```
(version `1.46.5`)

---

### Task 5 : Le chantier de l'empire va au centre

**Files:**
- Modify: `app.js` — `pickBuildings` (`app.js:1527-1545`), et le vaisseau de colonisation (`app.js:1669`)
- Test: `test/run.js`

**Interfaces:**
- Consumes: `centreIndex()` (Task 2)
- Produces: rien de neuf.

- [ ] **Step 1 : Écrire les tests qui échouent**

```js
t('le vaisseau de colonisation sort du centre', () => {
  const g = app(s => { s.centre = 'colo'; s.planets[1].b.robot = 2; s.planets[1].b.shipyard = 4; });
  const a = g.simulateDay().acts.find(x => x.kind === 'ship');
  if (a) assert.equal(a.p, 1, 'le chantier du centre sort le vaisseau');
});

t('une colonie monte son chantier pour ses propres transporteurs, centre ou pas', () => {
  const g = app(s => {
    s.centre = 'mere';
    s.planets[1].b.robot = 2; s.planets[1].transferAt = 1;
    s.planets[1].stock = { m: 200000, c: 200000, d: 20000, at: 0 };
  });
  const b = g.simulateDay().acts.filter(x => x.kind === 'b' && x.p === 1);
  assert.ok(b.some(x => x.k === 'shipyard'), 'la règle locale survit au centre');
});
```

- [ ] **Step 2 : Lancer les tests pour les voir échouer**

Run: `node test/run.js`

- [ ] **Step 3 : Router le chantier d'empire vers le centre**

Dans `simulateDay`, la planète de départ de la colonie (`dep`) devient le centre quand il y en a un et que le joueur n'a pas déjà posé un vaisseau ailleurs — `coloFrom()` (`app.js:1147`) garde la priorité quand un vaisseau est à quai. Dans `pickBuildings`, les deux règles existantes ne changent pas : celle du vaisseau de colonisation suit `ctx.dep`, donc le centre, et `needsOwnCargo` reste locale. Un commentaire dit que le centre dit *où*, pas *combien* : aucune demande de flotte n'est inventée.

- [ ] **Step 4 : Lancer les tests**

Run: `node test/run.js`
Expected: `474 vérifications passées`.

- [ ] **Step 5 : Commit**

```bash
git add app.js manifest.json test/run.js
git commit -m "feat: le chantier de l'empire se monte au centre"
```
(version `1.46.6`)

---

### Task 6 : La carte dit la vocation et le centre

**Files:**
- Modify: `app.js` — la carte de planète (`app.js:2877-2885`), `ROLES`/`autoRole`/`roleOf` (`app.js:2776-2779`), l'écoute `[data-role]` (`app.js:3218`)
- Test: `test/run.js`

**Interfaces:**
- Consumes: `vocations()` (Task 1), `centreIndex()`, `centreWhy()` (Task 2)
- Produces: rien de neuf. `ROLES`, `autoRole` et `roleOf` disparaissent.

- [ ] **Step 1 : Écrire les tests qui échouent**

```js
t('la carte d\'une planète porte sa vocation et sa raison', () => {
  const h = app().VIEWS.planets();
  assert.ok(/[Mm]étal/.test(h) && /position 8/.test(h), 'la vocation et sa raison sont écrites : ' + h.slice(0, 400));
});

t('la carte du centre dit le risque', () => {
  assert.ok(/espionnage/i.test(app().VIEWS.planets()), 'le risque du centre est dit');
});

t('un centre sans labo dit ce que le choix coûte', () => {
  const g = app(s => { s.centre = 'colo'; });
  assert.ok(/ne suit pas/.test(g.VIEWS.planets()), 'la carte annonce le labo laissé derrière');
});

t('le menu de rôle a disparu', () => {
  assert.ok(!/data-role=/.test(app().VIEWS.planets()), 'plus de menu Rôle');
});
```

Ajouter `'VIEWS'` aux noms exportés par `app()` : `VIEWS.planets()` rend le balisage de la vue Empire sans dépendre de l'onglet actif, là où `g.html()['pres-0']` ne porte que le bloc de ressources rafraîchi par `REFRESH.planets()`.

- [ ] **Step 2 : Lancer les tests pour les voir échouer**

Run: `node test/run.js`

- [ ] **Step 3 : Écrire la carte**

Sur chaque carte de planète : une ligne de vocation (`vocations()[p.id]`, ou « vocation inconnue », ou rien quand la planète n'est première sur aucune ressource) avec sa raison, et une case à cocher « Centre » liée à `S.centre` — cocher une planète décoche l'autre, puisqu'il n'y a qu'un centre. La planète que `centreIndex()` désignerait de lui-même porte « (conseillé) ». La carte du centre porte le risque que le wiki nomme : un espionnage montre où le joueur base sa flotte. Quand le centre choisi à la main laisse derrière lui un labo plus haut, la carte dit lequel et ce que repartir coûterait (`rangeCost(B.lab, 0, <ce labo>)`).

Retirer `ROLES`, `autoRole`, `roleOf` et l'écoute `[data-role]` : plus rien ne les lit.

- [ ] **Step 4 : Lancer les tests**

Run: `node test/run.js`
Expected: `478 vérifications passées`, aucun échec.

- [ ] **Step 5 : Commit**

```bash
git add app.js manifest.json test/run.js
git commit -m "feat: la carte d'une planète dit sa vocation, et le centre dit son risque"
```
(version `1.46.7`)
