# Poser un niveau visé sur toutes les planètes — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** une carte d'Empire pose le même niveau visé sur les planètes cochées, d'un bouton, par le même `prioPose` que le clic droit.

**Architecture:** trois fonctions dans `app.js` — `poseLignes()` calcule ce que la pose ferait, `posePartout()` l'exécute, `poseBloc()` l'affiche. L'état du formulaire vit dans `S.ui.pose`. Aucune nouvelle notion dans le moteur : la carte écrit des priorités ordinaires.

**Tech Stack:** JavaScript sans framework, `app.js` chargé comme script classique ; tests `node test/run.js` (assert, DOM factice).

**Spec:** `docs/superpowers/specs/2026-11-25-poser-sur-toutes-design.md`

## Global Constraints

- `prioPose(kind, pid, k, raw)` est le seul écrivain de `S.prio`. La carte ne touche jamais `S.prio` directement.
- Rien pour les recherches ni les formes de vie : bâtiments seulement (`B`).
- Le français du panneau est celui du glossaire : **priorité**, **niveau visé**. Jamais « cible » (c'est l'onglet des inactifs à piller).
- Bump de version à chaque commit : `manifest.json` **et** `APP_VERSION` (app.js:2), puis `./pack.sh`.
- Toute fonction vérifiée par un test doit être ajoutée à la liste de noms exportés de `app()` dans `test/run.js:31`.

## Review Focus

- **Niveau visé vide ou 0** : `prioPose` traite `lvl <= actuel` comme un retrait. Un clic sur le bouton avec le champ vide effacerait en silence toutes les priorités du bâtiment. `posePartout` doit rendre 0 sans rien toucher. → Task 2.
- **Planète cochée déjà au niveau ou au-dessus** : même piège, par planète. Sa priorité existante doit survivre. → Task 2.
- **Empire d'une ou zéro planète** : `poseLignes()` rend la liste sans lever, le bouton annonce 0. → Tasks 1 et 3.
- **Un id resté dans `hors` après `forgetPlanet`** : la planète disparue ne doit ni réapparaître ni gêner les autres lignes. → Task 1.
- **Un `k` qui n'est pas un bâtiment connu** (sauvegarde d'une autre version) : `poseLignes()` retombe sur `metal` au lieu de lever. → Task 1.

---

### Task 1 : ce que la pose ferait

**Files:**
- Modify: `app.js` — l'état par défaut (`sample()`, app.js:103) et les trois fonctions, posées près de `prioPose` (app.js:361)
- Modify: `test/run.js:31` — ajouter `poseLignes`, `poseK` à la liste de noms
- Test: `test/run.js`

**Interfaces:**
- Consomme : `planetById`, `prioLvl('b', pid, k)`, `B`, `B_SHORT`, `S`.
- Produit :
  - `S.ui.pose = {k:'metal', lvl:'', hors:{}}` dans `sample().ui` — `hors[k]` est un tableau d'ids de planètes décochées pour le bâtiment `k`.
  - `poseK() -> string` : la clé de bâtiment en cours, `'metal'` si `S.ui.pose.k` n'est pas une clé de `B`.
  - `poseLignes() -> [{pid, name, coords, actuel, deja, coche, agit}]`, une entrée par planète dans l'ordre de `S.planets` :
    `actuel` = `p.b[poseK()] || 0` ; `deja` = le niveau déjà visé sur cette planète pour ce bâtiment, ou `null` ; `coche` = la planète n'est pas dans `hors[poseK()]` ; `agit` = `coche && vise > actuel`, où `vise` est `parseInt(S.ui.pose.lvl)`.

- [ ] **Step 1 : écrire les tests qui échouent**

```js
/* ---------- poser sur toutes les planètes ---------- */

const POSE = (k, lvl, hors) => s => { s.ui.pose = {k, lvl, hors: hors || {}}; };

t('la carte montre une ligne par planète, avec son niveau actuel', () => {
  const g = app(POSE('metal', 43));
  const l = g.poseLignes();
  assert.equal(l.length, 2);
  assert.deepEqual(l.map(x => x.actuel), [14, 4]);
  assert.deepEqual(l.map(x => x.agit), [true, true]);
});

t('une planète décochée pour un bâtiment reste cochée pour les autres', () => {
  const g = app(POSE('metal', 43, {metal: ['colo']}));
  assert.deepEqual(g.poseLignes().map(x => x.coche), [true, false]);
  g.S.ui.pose.k = 'lab';
  assert.deepEqual(g.poseLignes().map(x => x.coche), [true, true]);
});

t("une planète déjà au-dessus du niveau visé n'agit pas", () => {
  const g = app(POSE('metal', 10));
  assert.deepEqual(g.poseLignes().map(x => x.agit), [false, true]);
});

t('une priorité déjà posée se voit avant la pose', () => {
  const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'metal', lvl:50}]; POSE('metal', 43)(s); });
  const l = g.poseLignes();
  assert.equal(l[0].deja, 50);
  assert.equal(l[1].deja, null);
});

t("un id resté dans les décochées après l'oubli d'une planète ne gêne rien", () => {
  const g = app(POSE('metal', 43, {metal: ['disparue']}));
  assert.deepEqual(g.poseLignes().map(x => x.coche), [true, true]);
});

t("un bâtiment inconnu retombe sur la mine de métal au lieu de lever", () => {
  const g = app(POSE('__proto__', 43));
  assert.equal(g.poseK(), 'metal');
  assert.equal(g.poseLignes()[0].actuel, 14);
});

t('sans planète, la carte rend une liste vide', () => {
  const g = app(s => { s.planets = []; POSE('metal', 43)(s); });
  assert.deepEqual(g.poseLignes(), []);
});
```

- [ ] **Step 2 : lancer les tests pour les voir échouer**

Run : `node test/run.js`
Attendu : ÉCHEC, « g.poseLignes is not a function ».

- [ ] **Step 3 : ajouter `pose` à `sample().ui` et écrire `poseK()` puis `poseLignes()` dans `app.js`**

`sample().ui` devient `{tool:'colony', fold:{}, pose:{k:'metal', lvl:'', hors:{}}}` ; `S.ui = Object.assign(sample().ui, S.ui)` (app.js:142) porte déjà le défaut sur une vieille sauvegarde. `poseK()` teste l'appartenance avec `Object.prototype.hasOwnProperty.call(B, k)` — `'__proto__'` passerait un `in`. Un commentaire dit pourquoi `hors` est rangé par bâtiment : décocher la planète logistique pour la mine ne doit pas la décocher pour le labo.

- [ ] **Step 4 : lancer les tests pour les voir passer**

Run : `node test/run.js`
Attendu : tous verts.

- [ ] **Step 5 : commit**

```bash
git add app.js test/run.js
git commit -m "feat: la carte de pose en masse sait ce qu'elle ferait"
```

---

### Task 2 : la pose

**Files:**
- Modify: `app.js` — `posePartout()`, à la suite de `poseLignes()`
- Modify: `test/run.js:31` — ajouter `posePartout`
- Test: `test/run.js`

**Interfaces:**
- Consomme : `poseLignes()` (Task 1), `prioPose`.
- Produit : `posePartout() -> number`, le nombre de planètes touchées. Appelle `prioPose('b', pid, poseK(), vise)` pour les seules lignes dont `agit` est vrai, et rien d'autre : aucune ligne qui n'agit pas ne doit passer par `prioPose`, dont un niveau non supérieur à l'actuel retire la priorité en place.

- [ ] **Step 1 : écrire les tests qui échouent**

```js
t('poser écrit une priorité par planète cochée', () => {
  const g = app(POSE('metal', 43));
  assert.equal(g.posePartout(), 2);
  assert.equal(g.prioLvl('b', 'mere', 'metal'), 43);
  assert.equal(g.prioLvl('b', 'colo', 'metal'), 43);
});

t('une planète décochée ne reçoit rien', () => {
  const g = app(POSE('metal', 43, {metal: ['colo']}));
  assert.equal(g.posePartout(), 1);
  assert.equal(g.prioLvl('b', 'colo', 'metal'), '');
});

t("un niveau visé vide ne pose rien et n'efface rien", () => {
  const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'metal', lvl:50}]; POSE('metal', '')(s); });
  assert.equal(g.posePartout(), 0);
  assert.equal(g.prioLvl('b', 'mere', 'metal'), 50);
});

t('une planète déjà au-dessus garde la priorité qu’elle avait', () => {
  const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'metal', lvl:50}]; POSE('metal', 10)(s); });
  assert.equal(g.posePartout(), 1, 'la colonie seule');
  assert.equal(g.prioLvl('b', 'mere', 'metal'), 50, 'la mère n’est pas effacée');
});
```

- [ ] **Step 2 : lancer les tests pour les voir échouer**

Run : `node test/run.js`
Attendu : ÉCHEC, « g.posePartout is not a function ».

- [ ] **Step 3 : écrire `posePartout()` dans `app.js`**

Un commentaire au-dessus dit le piège : `prioPose` lit un niveau non supérieur à l'actuel comme un retrait, donc la boucle ne lui donne que les lignes qui agissent — sinon un champ vide effacerait d'un clic tout ce que le joueur a posé au clic droit.

- [ ] **Step 4 : lancer les tests pour les voir passer**

Run : `node test/run.js`
Attendu : tous verts.

- [ ] **Step 5 : commit**

```bash
git add app.js test/run.js
git commit -m "feat: poser le niveau visé sur les planètes cochées"
```

---

### Task 3 : la carte dans Empire

**Files:**
- Modify: `app.js` — `poseBloc()` près de `lfBloc` (app.js:5084), son appel dans `VIEWS.planets()` (app.js:5195) et le câblage dans `bind()` (app.js:5787) et la délégation de clic (app.js:5924)
- Modify: `panel.css` si la grille des lignes le demande
- Modify: `manifest.json`, `app.js:2` — version
- Modify: `test/run.js:31` — ajouter `poseBloc`
- Test: `test/run.js`

**Interfaces:**
- Consomme : `poseLignes()`, `poseK()`, `posePartout()`, `B`, `B_SHORT`, `fold`, `esc`.
- Produit : `poseBloc() -> string` (HTML). Attributs de câblage : `select[data-pose="k"]`, `input[data-pose="lvl"]`, `input[type=checkbox][data-posep="<pid>"]`, `button[data-posego="1"]`.

- [ ] **Step 1 : écrire les tests qui échouent**

```js
t('la carte nomme chaque planète et compte ce qu’elle va poser', () => {
  const g = app(POSE('metal', 43, {metal: ['colo']}));
  const h = lu(g.poseBloc());
  assert.ok(h.includes('Planète mère'));
  assert.ok(h.includes('Colonie'));
  assert.ok(/Poser sur 1 planète/.test(h), h);
});

t('la carte dit quand une planète vise déjà plus haut', () => {
  const g = app(s => { s.prio = [{kind:'b', pid:'mere', k:'metal', lvl:50}]; POSE('metal', 43)(s); });
  assert.ok(lu(g.poseBloc()).includes('déjà visé 50'));
});

t('la carte est dans Empire', () => {
  const g = app(POSE('metal', 43));
  assert.ok(lu(g.VIEWS.planets()).includes('Poser sur toutes les planètes'));
});
```

- [ ] **Step 2 : lancer les tests pour les voir échouer**

Run : `node test/run.js`
Attendu : ÉCHEC, « g.poseBloc is not a function ».

- [ ] **Step 3 : écrire `poseBloc()` et le poser dans `VIEWS.planets()`**

Un `<details class="card">` replié par défaut (`fold('pose', false)`), posé après la carte « Empire · production / heure » et avant la liste des planètes — comme la carte des recherches, qui se replie de la même façon. Titre : « Poser sur toutes les planètes ». Le `<select>` liste `B` sous les libellés de `B_SHORT`. Une ligne par planète : case cochée, nom, coordonnées, `<B_SHORT> <actuel>`, puis `→ <vise>` si elle agit, `déjà visé <deja>` si une priorité plus haute est en place, et rien si elle n'agit pas. Le bouton porte le compte des lignes qui agissent, au singulier comme au pluriel.

- [ ] **Step 4 : câbler les trois champs et le bouton**

Dans `bind()` : `view.querySelectorAll('[data-pose]')` sur `change` écrit `S.ui.pose.k` ou `S.ui.pose.lvl` puis `save(); render();` — `change` et non `input`, comme les champs `data-prio` voisins, pour que le rendu n'arrive pas au milieu d'une frappe. Les cases `[data-posep]` sur `change` ajoutent ou retirent l'id dans `S.ui.pose.hors[poseK()]` puis `save(); render();`. Le bouton passe par la délégation de clic, à côté de `[data-lfpaliers]` : `posePartout()`, et si le compte est positif `save(); render(); publieLePlan(); toast(...)` — `publieLePlan` pour que les tuiles du jeu montrent ce qui vient d'être posé.

- [ ] **Step 5 : lancer les tests pour les voir passer**

Run : `node test/run.js`
Attendu : tous verts.

- [ ] **Step 6 : version et paquet**

`manifest.json` et `APP_VERSION` passent à `1.62.0`, puis :

```bash
./pack.sh && node test/run.js
```

- [ ] **Step 7 : commit**

```bash
git add app.js panel.css manifest.json test/run.js dist copilote-ogame.zip
git commit -m "feat: poser un niveau visé sur toutes les planètes depuis Empire"
```
