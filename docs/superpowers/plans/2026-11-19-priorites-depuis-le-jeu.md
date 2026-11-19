# Poser une priorité depuis le jeu — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser ou retirer une priorité d'un clic droit sur une tuile du jeu, et étendre les priorités aux cases de forme de vie.

**Architecture:** La page refuse ce qu'elle peut juger et *demande* le reste dans une clé de stockage (`prioAsk`) ; le panneau reste le seul écrivain de `S.prio`. En retour, `gameSkin` publie un second canal `skin.prio` — les priorités posées, pas les actions du plan — que la page peint d'une autre teinte que `hints`. Une nouvelle espèce `lf` vit dans la même liste `S.prio` mais se lit par un accesseur séparé, `priosLf()`, pour ne pas entrer dans la boucle des objectifs.

**Tech Stack:** JavaScript brut, extension Chrome MV3, aucune dépendance. Tests : `node test/run.js` (moteur) et le harnais `test/page.js` (content.js contre un DOM réduit).

**Spec:** `docs/superpowers/specs/2026-11-19-priorites-depuis-le-jeu-design.md`, qui prolonge `docs/superpowers/specs/2026-11-18-priorites-du-joueur-design.md`.

## Global Constraints

- Aucune dépendance, aucun cadriciel, aucun outil de compilation. JavaScript brut.
- `node test/run.js` doit passer en entier à chaque commit. **Les 610 vérifications existantes ne se modifient pas** : si l'une casse, c'est la conception qui est fautive, pas le test.
- **`prios()` ne rend jamais une entrée `kind:'lf'`.** C'est la garantie qui protège la boucle des objectifs (`app.js:2074`, `2078`), `prioStep` (`app.js:1794`) et `nextResearch` (`app.js:1635`).
- **ADR 0001** : une planète se désigne par son `id` local. Le `gid` n'apparaît qu'aux frontières — la demande venue de la page, le canal publié vers elle.
- Code, commentaires et texte affiché en **français**. Les commentaires disent *pourquoi*, pas *quoi*.
- `APP_VERSION` (`app.js:2`) et `"version"` (`manifest.json`) sont montés **ensemble, à chaque commit**.
- Chaque test écrit est validé par mutation : saboter le code qu'il garde, vérifier qu'il échoue, remettre le code. Un test qui passe sur du code cassé ne garde rien.

## Review Focus

Les cinq classes d'entrée que la conception implique et qu'aucune tâche n'exercerait sans cette liste. Chacune reçoit son test dans la tâche qui porte le code.

1. **Un clic droit sur une tuile d'une planète que le panneau ne connaît pas** (une lune, une colonie jamais relevée) : la demande est gardée et nommée dans le bloc, jamais avalée. → Tâche 4.
2. **`prioAsk` contenant n'importe quoi** : champ manquant, `lvl` non entier, `gid` valant `__proto__` ou `constructor`, entrée `null`. Rien ne doit être posé, rien ne doit lever. → Tâche 4.
3. **Deux clics droits de suite sur la même tuile, panneau fermé** : une seule priorité, au dernier niveau saisi. → Tâches 4 et 6.
4. **Une priorité `lf` sur une planète ensuite oubliée** (`forgetPlanet`, `app.js:143`, qui ne touche pas `S.prio`) : elle meurt à la lecture comme les deux autres espèces. → Tâche 1.
5. **Un clic droit avant que le panneau ait jamais tourné** : pas de `skin` en stockage, donc pas de priorités connues. Le champ s'ouvre quand même au niveau courant + 1, et la demande attend. → Tâche 6.

---

## File Structure

- **Modify `app.js`** — l'état (`priosLf`, les branches `lf` de `prioPose`/`prioLvl`/`prioClean`), la réception des demandes (`prioDrain`), le canal publié (`prioHints` dans `gameSkin`), la file des formes de vie (`lfCandidates`), le bloc « Tes priorités » (`prioHtml`).
- **Modify `content.js`** — l'écouteur `contextmenu`, la résolution de tuile à deux sélecteurs, le champ sur la tuile, le refus local, l'écriture de `prioAsk`, la lecture de `skin.prio` et les deux marquages.
- **Modify `boot.js`** — transmettre `prioAsk` au démarrage.
- **Modify `test/page.js`** — capturer les écritures de `chrome.storage.local.set`, ajouter un helper `clicDroit`.
- **Modify `test/run.js`** — les tests du moteur, et la liste d'exports.
- **Modify `GLOSSARY.md`** — l'entrée **demande**.

---

## Task 1 : l'espèce `lf` dans l'état

**Files:**
- Modify: `app.js` (`priosLf` neuf après `prios`, `app.js:158` ; `prioPose`, `app.js:202` ; `prioLvl`, `app.js:194` ; `prioClean`, `app.js:178`)
- Modify: `test/run.js` (tests, et `priosLf` dans la liste d'exports ligne 27)

**Interfaces:**
- Consomme : `prios()`, `prioIdx(kind, pid, k)`, `planetById(id)`, `S.prio`.
- Produit : `priosLf()` → `{pid, k, lvl}[]`, dans l'ordre de pose, `k` étant l'identifiant de tuile **numérique** du jeu (`>= 11000`). `prioPose('lf', pid, id, raw)` et `prioLvl('lf', pid, id)` acceptent la nouvelle espèce.

- [ ] **Step 1 : écrire les tests qui échouent**

Dans `test/run.js`, à la suite des tests de priorités existants :

```js
t('priosLf rend les cases de forme de vie, prios ne les voit pas', () => {
  const g = app(s => { s.planets[0].lf = {11101:{lvl:3, state:'ok'}}; });
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:5}, {kind:'b', pid:'mere', k:'lab', lvl:10}];
  assert.deepEqual(g.priosLf(), [{pid:'mere', k:11101, lvl:5}]);
  assert.deepEqual(g.prios().map(x=>x.k), ['lab'], 'prios() ignore lf');
});

t('une priorité lf atteinte n\'existe plus', () => {
  const g = app(s => { s.planets[0].lf = {11101:{lvl:5, state:'ok'}}; });
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:5}];
  assert.deepEqual(g.priosLf(), []);
});

t('une priorité lf sur une case que le relevé ignore ne compte pas', () => {
  const g = app();                       // p.lf vide
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:5}];
  assert.deepEqual(g.priosLf(), []);
});

// Review Focus 4
t('une priorité lf meurt avec sa planète oubliée', () => {
  const g = app(s => { s.planets[0].lf = {11101:{lvl:1, state:'ok'}}; });
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:5}];
  g.forgetPlanet('mere');
  assert.deepEqual(g.priosLf(), []);
});

t('prioClean garde les lf et ne réécrit pas pour rien', () => {
  const g = app(s => { s.planets[0].lf = {11101:{lvl:1, state:'ok'}}; });
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:5}, {kind:'b', pid:'mere', k:'lab', lvl:10}];
  const avant = JSON.stringify(g.S.prio);
  g.prioClean();
  assert.equal(JSON.stringify(g.S.prio), avant, 'rien ne tombe, donc rien ne se réécrit');
  g.S.prio.push({kind:'b', pid:'mere', k:'metal', lvl:1});   // morte : niveau sous l'actuel
  g.prioClean();
  assert.equal(g.S.prio.length, 2, 'la morte tombe, les deux vivantes restent');
  assert.ok(g.S.prio.some(e => e.kind === 'lf'), 'la lf a survécu à la compaction');
});

t('prioPose et prioLvl savent compter en lf', () => {
  const g = app(s => { s.planets[0].lf = {11101:{lvl:3, state:'ok'}}; });
  g.prioPose('lf', 'mere', 11101, '5');
  assert.equal(g.prioLvl('lf', 'mere', 11101), 5);
  g.prioPose('lf', 'mere', 11101, '3');          // au niveau actuel : retire
  assert.equal(g.prioLvl('lf', 'mere', 11101), '');
});
```

- [ ] **Step 2 : les lancer et vérifier qu'ils échouent**

Run: `node test/run.js`
Expected: les six nouveaux échouent (`priosLf is not a function`, puis sur les branches manquantes). Les 610 existants passent.

- [ ] **Step 3 : écrire `priosLf()` dans `app.js`, à côté de `prios()`**

Même forme que `prios()` : pur, aucun effet de bord, aucune écriture — la raison est écrite dans la conception de la veille et vaut mot pour mot ici (`simulateDay` remplace `S.planets` par ses copies). Garde `hasOwnProperty` sur `p.lf` comme `prios()` l'a sur `B` et `T`. Vivante si `e.lvl` est un entier > 0, si `planetById(e.pid)` répond, si `p.lf[e.k]` existe, et si `e.lvl > (p.lf[e.k].lvl || 0)`.

Un commentaire dit **pourquoi** cette lecture est séparée de `prios()` : la boucle des objectifs lit `T[pr.k].n` et réserve la planète au premier posé toutes espèces confondues ; une case de forme de vie y lèverait, ou volerait le rang d'un Labo 10.

- [ ] **Step 4 : étendre `prioPose` et `prioLvl`**

`prioPose` : `actuel` vaut, pour `kind === 'lf'`, `((planetById(pid) || {lf:{}}).lf[k] || {}).lvl || 0`. L'entrée poussée est `{kind:'lf', pid, k, lvl}`. `prioIdx` fonctionne déjà pour `lf` — son test `kind !== 't'` compare le `pid` — à condition que `k` soit du même type qu'à la pose : **toujours un nombre**.

`prioLvl` : pour `kind === 'lf'`, chercher dans `priosLf()` au lieu de `prios()`.

- [ ] **Step 5 : corriger `prioClean`**

Le piège est dans la ligne de sortie rapide : `vivantes.length === S.prio.length`. Dès que `prios()` exclut les `lf`, les longueurs ne coïncident plus jamais — `prioClean` réécrirait le stockage à **chaque rendu** et, pire, `S.prio = vivantes.map(…)` **effacerait toutes les priorités de forme de vie**. La comparaison porte donc sur les deux lectures réunies, et la reconstruction les conserve toutes deux dans l'ordre de pose d'origine.

- [ ] **Step 6 : lancer les tests**

Run: `node test/run.js`
Expected: tout passe, 610 + 6.

- [ ] **Step 7 : valider chaque test par mutation**

Pour chacun des six : casser la ligne qu'il garde (retirer la branche `lf` de `prioPose` ; remettre l'ancienne comparaison de `prioClean` ; retirer la garde `p.lf[e.k]`), vérifier que *ce* test échoue, remettre le code. Noter dans le rapport ce que chaque mutation a produit.

- [ ] **Step 8 : commit**

```bash
# monter APP_VERSION (app.js:2) et manifest.json ensemble
git add app.js manifest.json test/run.js
git commit -m "feat: une priorité peut viser une case de forme de vie"
```

---

## Task 2 : la file des formes de vie respecte la priorité

**Files:**
- Modify: `app.js` (`lfCandidates`, `app.js:528`)
- Modify: `test/run.js`

**Interfaces:**
- Consomme : `priosLf()` (Tâche 1), `lfCost`, `lfQueue`.
- Produit : `lfCandidates(p, queue)` rend la case priorisée en tête quand elle est dans cette file, chiffrable et non verrouillée, avec `why` annonçant la priorité. Les autres candidats gardent leur ordre actuel.

- [ ] **Step 1 : écrire les tests qui échouent**

```js
t('une case priorisée passe devant une case plus chère à produire', () => {
  // la case 11102 produit du métal (eff 0) et coûte peu ; 11101 ne produit rien
  // et coûte plus : sans priorité, 11102 est en tête.
  const g = app(s => { s.planets[0].lf = {
    11101:{lvl:1, state:'ok', secs:600, cost:[50000,0,0]},
    11102:{lvl:1, state:'ok', secs:600, cost:[1000,0,0], eff:0} }; });
  assert.equal(g.lfCandidates(g.S.planets[0], 'lfbuilding')[0].id, 11102, 'sans priorité, la productrice');
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:2}];
  const l = g.lfCandidates(g.S.planets[0], 'lfbuilding');
  assert.equal(l[0].id, 11101, 'avec priorité, la tienne');
  assert.match(l[0].why, /priorité/i, 'et elle dit pourquoi');
  assert.equal(l[1].id, 11102, 'la productrice reste, juste derrière');
});

t('une case priorisée pas encore chiffrée ne prend pas la tête', () => {
  const g = app(s => { s.planets[0].lf = {
    11101:{lvl:1, state:'ok'},                                   // ni prix ni durée
    11102:{lvl:1, state:'ok', secs:600, cost:[1000,0,0]} }; });
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:2}];
  const l = g.lfCandidates(g.S.planets[0], 'lfbuilding');
  assert.equal(l.length, 1, 'une case sans prix n\'est pas un candidat, priorisée ou non');
  assert.equal(l[0].id, 11102);
});

t('une case priorisée verrouillée ne prend pas la tête', () => {
  const g = app(s => { s.planets[0].lf = {
    11101:{lvl:0, state:'locked', secs:600, cost:[1000,0,0]},
    11102:{lvl:1, state:'ok', secs:600, cost:[1000,0,0]} }; });
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:1}];
  assert.equal(g.lfCandidates(g.S.planets[0], 'lfbuilding')[0].id, 11102);
});

t('une priorité dans l\'autre file ne dérange pas celle-ci', () => {
  // lfQueue départage par l'identifiant : une case de recherche ne pèse pas
  // sur la file des bâtiments.
  const g = app(s => { s.planets[0].lf = {
    11101:{lvl:1, state:'ok', secs:600, cost:[1000,0,0]},
    11102:{lvl:1, state:'ok', secs:600, cost:[500,0,0]} }; });
  g.S.prio = [{kind:'lf', pid:'mere', k:11201, lvl:2}];   // autre file
  assert.equal(g.lfCandidates(g.S.planets[0], 'lfbuilding')[0].id, 11102, 'le prix tranche encore');
});

t('la priorité d\'une autre planète ne déplace rien ici', () => {
  const g = app(s => {
    s.planets[0].lf = {11101:{lvl:1, state:'ok', secs:600, cost:[50000,0,0]},
                       11102:{lvl:1, state:'ok', secs:600, cost:[1000,0,0]}};
    s.planets[1].lf = {11101:{lvl:1, state:'ok', secs:600, cost:[50000,0,0]}}; });
  g.S.prio = [{kind:'lf', pid:g.S.planets[1].id, k:11101, lvl:2}];
  assert.equal(g.lfCandidates(g.S.planets[0], 'lfbuilding')[0].id, 11102);
});

t('les mines ne ralentissent pas pour une case priorisée en attente', () => {
  // La réserve molle poussée par une case inabordable (app.js:2344) n'entre pas
  // dans le calcul du chemin des bâtiments (app.js:2357) : le plan du jour
  // continue de proposer un bâtiment.
  const g = app(s => { s.planets[0].lf = {11101:{lvl:1, state:'ok', secs:600, cost:[9e9,0,0]}}; });
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:2}];
  const plan = g.simulateDay();
  assert.ok(plan.sessions[0].acts.some(a => a.kind === 'b'), 'un bâtiment part quand même');
});
```

- [ ] **Step 2 : les lancer et vérifier qu'ils échouent**

Run: `node test/run.js`
Expected : le premier échoue sur l'ordre, les quatre suivants passent déjà (ils gardent ce qui ne doit pas changer — les écrire maintenant est ce qui rend l'étape 3 sûre), le dernier passe déjà. L'implémenteur note lesquels passaient avant.

- [ ] **Step 3 : insérer la priorité en tête de `lfCandidates`**

À la fin de la fonction, après le tri et la composition des `why` : si `priosLf()` contient une entrée pour cette planète dont `k` appartient à cette file (`lfQueue`), et si cette case est **présente dans `out`** — donc chiffrable et non verrouillée — la sortir de sa place et la mettre en tête, avec un `why` qui commence par « Tu l'as mise en priorité. » suivi de ce que la case fait (l'effet de production s'il y en a un).

Un commentaire dit ce que « en tête » coûte : l'appelant ne lit que `lfCandidates(p, q)[0]` (`app.js:2329`), donc une case priorisée plus chère fait attendre toute la file — c'est voulu, puisque retomber sur la suivante annulerait la demande dans le seul cas qui l'a motivée.

- [ ] **Step 4 : lancer les tests**

Run: `node test/run.js`
Expected: tout passe.

- [ ] **Step 5 : valider par mutation**

Retirer le filtre `lfQueue` de l'insertion → le test « autre file » échoue. Retirer le test d'appartenance à `out` → les tests « pas encore chiffrée » et « verrouillée » échouent. Ne pas comparer le `pid` → le test « autre planète » échoue.

- [ ] **Step 6 : commit** (version montée)

```bash
git add app.js manifest.json test/run.js
git commit -m "feat: le plan sert d'abord la case de forme de vie que tu as choisie"
```

---

## Task 3 : le canal `skin.prio`

**Files:**
- Modify: `app.js` (`prioHints` neuf près de `planHints`, `app.js:562` ; `gameSkin`, `app.js:757`)
- Modify: `test/run.js` (tests, et `prioHints` dans les exports)

**Interfaces:**
- Consomme : `prios()`, `priosLf()`, `BUILD_ID`, `TECH_ID`, `labPlanet()`, `planetById`.
- Produit : `prioHints()` → `{ [gid]: { [tuile]: niveau } }`. `gameSkin` rend en plus `prio: prioHints()`.

- [ ] **Step 1 : écrire les tests qui échouent**

```js
t('prioHints publie ce que le joueur a posé, pas ce que le plan fait', () => {
  const g = app(s => { s.planets[0].gid = '33701'; });
  g.S.prio = [{kind:'b', pid:'mere', k:'lab', lvl:10}];
  assert.deepEqual(g.prioHints(), {'33701': {31: 10}});
  assert.deepEqual(g.planHints([]), {}, 'planHints reste ce qu\'il était');
});

t('une priorité de recherche se montre sur le centre', () => {
  const g = app(s => { s.planets[0].gid = '33701'; s.planets[1].gid = '33702'; });
  g.S.prio = [{kind:'t', k:'plasma', lvl:12}];
  const h = g.prioHints();
  assert.deepEqual(h, {[g.labPlanet().gid]: {122: 12}});
});

t('une priorité lf se montre sur sa planète, par son identifiant de tuile', () => {
  const g = app(s => { s.planets[0].gid = '33701'; s.planets[0].lf = {11101:{lvl:1, state:'ok'}}; });
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:4}];
  assert.deepEqual(g.prioHints(), {'33701': {11101: 4}});
});

t('une planète que le jeu n\'a pas nommée ne publie rien', () => {
  const g = app(s => { s.planets[0].gid = null; });
  g.S.prio = [{kind:'b', pid:'mere', k:'lab', lvl:10}];
  assert.deepEqual(g.prioHints(), {});
});

t('gameSkin porte le canal des priorités', () => {
  const g = app(s => { s.planets[0].gid = '33701'; });
  g.S.prio = [{kind:'b', pid:'mere', k:'lab', lvl:10}];
  assert.deepEqual(g.gameSkin([], [], []).prio, {'33701': {31: 10}});
});
```

- [ ] **Step 2 : les lancer et vérifier qu'ils échouent**

Run: `node test/run.js`
Expected: `prioHints is not a function`.

- [ ] **Step 3 : écrire `prioHints()` dans `app.js`**

Même garde que `tourData` (`app.js:592`-`593`) contre un `gid` qui n'est pas un nombre — `__proto__` n'est jamais une planète du jeu. Pour `kind:'t'`, le `gid` est celui de `labPlanet()` ; pour `b` et `lf`, celui de `planetById(e.pid)`.

Un commentaire dit pourquoi ce canal existe à côté de `hints` : `hints` vient de `planHints(acts)`, donc des actions de la session en cours ; une priorité qui épargne sans être payable n'y figure pas, et la tuile n'aurait rien à montrer.

- [ ] **Step 4 : brancher dans `gameSkin`**

Ajouter `prio: prioHints()` à l'objet rendu (`app.js:757`).

- [ ] **Step 5 : lancer les tests** — Run: `node test/run.js`, Expected: tout passe.

- [ ] **Step 6 : valider par mutation**

Bâtir `prioHints` depuis `acts` au lieu des accesseurs → le premier test échoue. Retirer la garde sur le `gid` → ajouter une planète de `gid` `'__proto__'` fait échouer un test de `tourData` existant ou lever.

- [ ] **Step 7 : commit** (version montée)

```bash
git add app.js manifest.json test/run.js
git commit -m "feat: la page du jeu sait maintenant quelles priorités tu as posées"
```

---

## Task 4 : le panneau reçoit les demandes

**Files:**
- Modify: `app.js` (`prioDrain` et `prioDemandes` neufs près de `prioClean` ; l'écouteur `storage.onChanged`, `app.js:4431` ; le démarrage)
- Modify: `boot.js` (transmettre `prioAsk`)
- Modify: `test/run.js` (tests, exports)

**Interfaces:**
- Consomme : `prioPose` (Tâche 1), `OG_BUILD`, `OG_TECH`, `planetById`, `S.planets`.
- Produit : `prioDrain(liste)` → applique les demandes traduisibles, rend celles qu'il n'a pas su placer. `prioDemandes()` → les demandes en attente, `{gid, tech, nom, lvl, at}[]`, pour le bloc.

- [ ] **Step 1 : écrire les tests qui échouent**

```js
const D = (o) => Object.assign({gid:'33701', tech:31, nom:'Laboratoire', lvl:10, at:1}, o);

t('une demande devient une priorité de bâtiment', () => {
  const g = app(s => { s.planets[0].gid = '33701'; });
  assert.deepEqual(g.prioDrain([D()]), [], 'rien ne reste en attente');
  assert.deepEqual(g.prios(), [{kind:'b', pid:'mere', k:'lab', lvl:10}]);
});

t('une demande de recherche n\'a pas de planète', () => {
  const g = app(s => { s.planets[0].gid = '33701'; });
  g.prioDrain([D({tech:122, nom:'Plasma', lvl:12})]);
  assert.deepEqual(g.prios(), [{kind:'t', k:'plasma', lvl:12}]);
});

t('une demande de forme de vie garde son identifiant de tuile', () => {
  const g = app(s => { s.planets[0].gid = '33701'; s.planets[0].lf = {11101:{lvl:1, state:'ok'}}; });
  g.prioDrain([D({tech:11101, nom:'Habitation', lvl:4})]);
  assert.deepEqual(g.priosLf(), [{pid:'mere', k:11101, lvl:4}]);
});

// Review Focus 1
t('une demande dont la planète est inconnue attend, et se laisse nommer', () => {
  const g = app(s => { s.planets[0].gid = '33701'; });
  const reste = g.prioDrain([D({gid:'99999', nom:'Usine de robots'})]);
  assert.equal(reste.length, 1, 'gardée');
  assert.equal(reste[0].nom, 'Usine de robots', 'et nommable');
  assert.deepEqual(g.prios(), [], 'rien n\'est posé');
});

t('une demande gardée se pose dès que sa planète est relevée', () => {
  const g = app();
  const reste = g.prioDrain([D({gid:'33701'})]);
  assert.equal(reste.length, 1);
  g.S.planets[0].gid = '33701';
  assert.deepEqual(g.prioDrain(reste), []);
  assert.deepEqual(g.prios(), [{kind:'b', pid:'mere', k:'lab', lvl:10}]);
});

t('une demande gardée depuis plus de 24 h disparaît', () => {
  const g = app();
  assert.deepEqual(g.prioDrain([D({gid:'99999', at: Date.now() - 25*3600*1000})]), []);
});

// Review Focus 2
t('une demande malformée ne pose rien et ne lève pas', () => {
  const g = app(s => { s.planets[0].gid = '33701'; });
  const sales = [null, {}, D({tech:null}), D({lvl:'dix'}), D({lvl:0}), D({lvl:2.5}),
                 D({gid:'__proto__'}), D({tech:999999}), D({tech:33})];  // 33 : Terraformeur, non modélisé
  assert.deepEqual(g.prioDrain(sales).filter(x => /^\d+$/.test(String(x.gid))).length, 0);
  assert.deepEqual(g.prios(), []);
  assert.deepEqual(g.priosLf(), []);
  assert.ok(!('__proto__' in ({}).constructor.prototype && false), 'aucun prototype touché');
});

// Review Focus 3
t('deux demandes sur la même tuile n\'en font qu\'une, la dernière', () => {
  const g = app(s => { s.planets[0].gid = '33701'; });
  g.prioDrain([D({lvl:9, at:1}), D({lvl:12, at:2})]);
  assert.deepEqual(g.prios(), [{kind:'b', pid:'mere', k:'lab', lvl:12}]);
});
```

- [ ] **Step 2 : les lancer et vérifier qu'ils échouent** — Run: `node test/run.js`, Expected: `prioDrain is not a function`.

- [ ] **Step 3 : écrire `prioDrain(liste)` dans `app.js`**

Pour chaque entrée : rejeter ce qui n'est pas un objet, ce dont `lvl` n'est pas un entier > 0, ce dont le `gid` n'est pas une suite de chiffres. Traduire `tech` : `OG_BUILD[tech]` → `prioPose('b', pid, clé, lvl)` ; `OG_TECH[tech]` → `prioPose('t', null, clé, lvl)` ; `tech >= 11000` → `prioPose('lf', pid, tech, lvl)` ; sinon jeter. Pour `b` et `lf`, le `pid` vient de la planète dont le `gid` correspond : absente, l'entrée est **rendue** (gardée), sauf si `at` a plus de 24 h.

- [ ] **Step 4 : écrire `prioDemandes()`**

Lit la liste gardée, la rend telle quelle pour le bloc. Où la liste vit — `S` ou un champ à part — est au constructeur ; elle doit survivre à un rechargement du panneau.

- [ ] **Step 5 : brancher les deux bouts**

`boot.js` : passer `d.prioAsk` à côté de `d.game` et `d.api` (`boot.js:15`). `app.js` : au démarrage, vider ce qui attendait ; dans l'écouteur `storage.onChanged` (`app.js:4431`), traiter `ch.prioAsk` — appliquer, puis **effacer la clé**, sauvegarder, redessiner.

- [ ] **Step 6 : lancer les tests** — Run: `node test/run.js`, Expected: tout passe.

- [ ] **Step 7 : valider par mutation**

Retirer la garde sur `lvl` entier → le test des demandes malformées échoue. Retirer la garde sur le `gid` numérique → de même. Jeter au lieu de garder une planète inconnue → le Review Focus 1 échoue. Retirer le délai de 24 h → son test échoue.

- [ ] **Step 8 : commit** (version montée)

```bash
git add app.js boot.js manifest.json test/run.js
git commit -m "feat: le panneau écoute ce que la page du jeu lui demande"
```

---

## Task 5 : le bloc « Tes priorités » dit tout

**Files:**
- Modify: `app.js` (`prioHtml`, `app.js:227`)
- Modify: `test/run.js`

**Interfaces:**
- Consomme : `priosLf()` (T1), `prioDemandes()` (T4), `lfCandidates` (T2), `lfMode()`, `LF_MODE`, `prioIdx`.
- Produit : `prioHtml(plan)` couvre trois sources. `prioRetire(ref)` ne prend plus un rang dans `prios()` mais une référence que la ligne porte elle-même, et sait retirer les trois espèces comme une demande en attente.

- [ ] **Step 1 : écrire les tests qui échouent**

```js
t('le bloc nomme une priorité de forme de vie, avec le nom du jeu', () => {
  const g = app(s => { s.planets[0].lf = {11101:{lvl:1, state:'ok', name:'Habitation', secs:600, cost:[10,0,0]}}; });
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:4}];
  const h = g.prioHtml(g.simulateDay());
  assert.match(h, /Habitation 4/);
});

t('une priorité lf pas encore chiffrée dit quoi faire', () => {
  const g = app(s => { s.planets[0].lf = {11101:{lvl:1, state:'ok', name:'Habitation'}}; });
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:4}];
  assert.match(g.prioHtml(g.simulateDay()), /ouvre-la dans le jeu/i);
});

t('une priorité lf verrouillée le dit', () => {
  const g = app(s => { s.planets[0].lf = {11101:{lvl:0, state:'locked', name:'Habitation'}}; });
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:1}];
  assert.match(g.prioHtml(g.simulateDay()), /prérequis|verrouill/i);
});

t('une priorité lf qui attend le tour de sa file nomme le réglage', () => {
  const g = app(s => { s.planets[0].lf = {11101:{lvl:1, state:'ok', name:'Habitation', secs:600, cost:[9e9,0,0]}}; });
  g.S.day.lf = 'after';
  g.S.prio = [{kind:'lf', pid:'mere', k:11101, lvl:4}];
  assert.match(g.prioHtml(g.simulateDay()), /après les bâtiments/i);
});

// Review Focus 1, côté visible
t('une demande que le panneau n\'a pas su placer se voit', () => {
  const g = app();
  g.prioDrain([{gid:'99999', tech:14, nom:'Usine de robots', lvl:8, at:Date.now()}]);
  const h = g.prioHtml(g.simulateDay());
  assert.match(h, /Usine de robots/);
  assert.match(h, /planète/i, 'et dit ce qui manque');
});

t('Retirer enlève la bonne ligne, quelle que soit son espèce', () => {
  const g = app(s => {
    s.planets[0].lf = {11101:{lvl:1, state:'ok', name:'Habitation', secs:600, cost:[10,0,0]}}; });
  g.S.prio = [{kind:'b', pid:'mere', k:'lab', lvl:10},
              {kind:'lf', pid:'mere', k:11101, lvl:4},
              {kind:'t', k:'plasma', lvl:12}];
  g.prioDrain([{gid:'99999', tech:14, nom:'Usine de robots', lvl:8, at:Date.now()}]);
  // Les références que le bloc pose sur ses boutons, relues telles quelles.
  const refs = [...g.prioHtml(g.simulateDay()).matchAll(/data-prio-del="([^"]+)"/g)].map(m => m[1]);
  assert.equal(refs.length, 4, 'quatre lignes, quatre boutons');
  g.prioRetire(refs[1]);                       // la forme de vie
  assert.deepEqual(g.priosLf(), [], 'la lf est partie');
  assert.equal(g.prios().length, 2, 'les deux autres priorités sont intactes');
  g.prioRetire(refs[3]);                       // la demande en attente
  assert.deepEqual(g.prioDemandes(), [], 'la demande est partie');
  assert.equal(g.prios().length, 2, 'et rien d\'autre n\'a bougé');
});

t('le bloc vide nomme le clic droit avant le volet Empire', () => {
  const g = app();
  const h = g.prioHtml(g.simulateDay());
  assert.ok(h.indexOf('clic droit') >= 0, 'le clic droit est nommé');
  assert.ok(h.indexOf('clic droit') < h.indexOf('Empire'), 'et il vient avant');
});
```

- [ ] **Step 2 : les lancer et vérifier qu'ils échouent** — Run: `node test/run.js`.

- [ ] **Step 3 : étendre `prioHtml`**

Trois sources dans un seul bloc : `prios()` (inchangé), `priosLf()` et `prioDemandes()`. L'état d'une ligne `lf` se lit sur `p.lf[k]` et sur sa place dans `lfCandidates` : en tête, pas encore chiffrée, verrouillée, ou en attente du tour de sa file — et dans ce dernier cas la phrase nomme le réglage, par `LF_MODE[lfMode()]`.

Le texte du bloc vide nomme le clic droit d'abord, le volet Empire ensuite.

- [ ] **Step 4 : refaire `prioRetire` sur une référence, pas sur un rang**

`prioRetire(rang)` lit aujourd'hui `prios()[rang]` (`app.js:211`), et `prioHtml`
pose `data-prio-del="${i}"` avec l'indice de cette même liste. Dès que le bloc
affiche trois sources dans un seul tableau, cet indice ne désigne plus rien de
sûr : la deuxième ligne peut être une forme de vie, la quatrième une demande en
attente, et un rang de `prios()` les manquerait toutes les deux — ou en
retirerait une autre.

Chaque ligne porte donc une référence qui dit son espèce et son identité, et
`prioRetire` la lit. Les trois espèces passent par `prioIdx` ; une demande en
attente se retire de la liste gardée. La forme exacte de la référence est au
constructeur, à une condition : elle doit résister à un `esc`, puisqu'elle
voyage dans un attribut HTML.

Le gestionnaire de clic de `[data-prio-del]` (`app.js:4155`) suit — il fait `+pd.dataset.prioDel`, et ce `+` tombe avec le rang.

- [ ] **Step 5 : lancer les tests** — Run: `node test/run.js`, Expected: tout passe.

- [ ] **Step 6 : valider par mutation** — supprimer chacune des quatre phrases
  d'état à son tour ; le test correspondant doit échouer, et lui seul. Puis
  remettre `prioRetire` sur un rang de `prios()` : le test du retrait doit
  échouer.

- [ ] **Step 7 : commit** (version montée)

```bash
git add app.js manifest.json test/run.js
git commit -m "feat: le bloc des priorités parle aussi des formes de vie"
```

---

## Task 6 : le clic droit dans la page

**Files:**
- Modify: `content.js` (l'écouteur `contextmenu` près du `click` délégué, `content.js:2241` ; `data-technology` sur la carte de la peau, `content.js:1487`)
- Modify: `test/page.js` (capturer `chrome.storage.local.set`, `content.js` ligne 314 du harnais ; helper `clicDroit` près de `clic`, ligne 457)
- Modify: `test/run.js` (les tests de page vivent avec les autres)

**Interfaces:**
- Consomme : `OG_BUILD`, `OG_TECH` (chargés dans le script de contenu), `meta('planet-id')`.
- Produit : des entrées ajoutées à `chrome.storage.local` sous `prioAsk`, de la forme `{gid, tech, nom, lvl, at}`.

- [ ] **Step 1 : préparer le harnais**

`test/page.js` : remplacer le `set() {}` vide (ligne 314) par une capture — garder le dernier état écrit et l'exposer dans le retour de `runPage`. Ajouter `clicDroit: (id, saisie) => …` à côté de `clic` (ligne 457) : il trouve la tuile, lance un `contextmenu` dessus avec un `preventDefault` observable, puis joue la saisie et l'Entrée. Rendre aussi `menuEmpeche` : si `preventDefault` a été appelé.

- [ ] **Step 2 : écrire les tests qui échouent**

```js
t('un clic droit sur une tuile à niveau demande une priorité', () => {
  const p = page({comp:'supplies', planet:'33701', tuiles:[{id:1, niv:14}]});
  p.clicDroit(1, '20');
  assert.deepEqual(p.ecrit().prioAsk, [{gid:'33701', tech:1, nom:'Mine de métal', lvl:20, at:p.ecrit().prioAsk[0].at}]);
  assert.ok(p.menuEmpeche, 'le menu du navigateur ne s\'ouvre pas sur une tuile traitée');
});

t('le champ est prérempli au niveau suivant', () => {
  const p = page({comp:'supplies', planet:'33701', tuiles:[{id:1, niv:14}]});
  p.clicDroit(1);                       // Entrée sans rien taper
  assert.equal(p.ecrit().prioAsk[0].lvl, 15);
});

t('une tuile qui se compte ne reçoit pas de priorité', () => {
  const p = page({comp:'shipyard', planet:'33701', tuiles:[{id:212, nombre:7}]});
  p.clicDroit(212, '20');
  assert.equal(p.ecrit().prioAsk, undefined, 'rien n\'est demandé');
  assert.ok(!p.menuEmpeche, 'et le menu du navigateur reste disponible');
  assert.match(p.refus, /niveau/i, 'la tuile dit pourquoi');
});

t('une tuile que le copilote ne modélise pas est refusée dans la page', () => {
  const p = page({comp:'facilities', planet:'33701', tuiles:[{id:33, niv:2}]});  // Terraformeur
  p.clicDroit(33, '5');
  assert.equal(p.ecrit().prioAsk, undefined);
  assert.match(p.refus, /copilote/i);
});

t('Échap n\'écrit rien', () => {
  const p = page({comp:'supplies', planet:'33701', tuiles:[{id:1, niv:14}]});
  p.clicDroit(1, '20', {echap:true});
  assert.equal(p.ecrit().prioAsk, undefined);
});

t('un clic droit ailleurs que sur une tuile laisse le menu du navigateur', () => {
  const p = page({comp:'supplies', planet:'33701', tuiles:[{id:1, niv:14}]});
  p.clicDroitAilleurs();
  assert.ok(!p.menuEmpeche);
});

// Review Focus 3
t('deux clics droits sur la même tuile n\'empilent qu\'une demande', () => {
  const p = page({comp:'supplies', planet:'33701', tuiles:[{id:1, niv:14}]});
  p.clicDroit(1, '18'); p.clicDroit(1, '20');
  assert.equal(p.ecrit().prioAsk.length, 1);
  assert.equal(p.ecrit().prioAsk[0].lvl, 20);
});

// Review Focus 5
t('un clic droit avant que le panneau ait tourné marche quand même', () => {
  const p = page({comp:'supplies', planet:'33701', tuiles:[{id:1, niv:14}], skin:null});
  p.clicDroit(1);
  assert.equal(p.ecrit().prioAsk[0].lvl, 15);
});
```

- [ ] **Step 3 : les lancer et vérifier qu'ils échouent** — Run: `node test/run.js`.

- [ ] **Step 4 : écrire la résolution de tuile et l'écouteur**

Un écouteur `contextmenu` unique sur `document`, par délégation. **Deux sélecteurs** : `li.technology[data-technology]` et `.cp-case[data-technology]` — la carte de la peau est un `div` posé hors des listes du jeu (`content.js:1566`), donc `closest('li.technology')` ne l'atteint jamais. Ajouter `data-technology` à la carte au moment du dessin (`content.js:1487`).

La tuile est retenue si elle a un niveau courant lisible **et** si son identifiant est dans `OG_BUILD`, dans `OG_TECH`, ou `>= 11000`. Sinon : `preventDefault` n'est pas appelé, et un court message sur la tuile dit laquelle des deux raisons s'applique.

- [ ] **Step 5 : écrire le champ**

Posé sur la tuile, prérempli (priorité déjà connue, sinon niveau + 1), contenu sélectionné, focus dedans. Entrée valide, Échap et la perte du focus annulent. Valider écrit dans `prioAsk` : lire la liste, remplacer l'entrée de même `gid`+`tech` s'il y en a une, sinon ajouter.

**Le champ vidé, ou un niveau au niveau courant ou au-dessous, envoie `lvl: 0`** — « retire cette priorité ». C'est la page qui tranche, parce que c'est là que le joueur a formé l'intention ; le panneau ne devine pas. Deux tests : un champ vidé envoie `0`, et un niveau au niveau courant envoie `0`.

- [ ] **Step 6 : lancer les tests** — Run: `node test/run.js`, Expected: tout passe.

- [ ] **Step 7 : valider par mutation**

Retirer le second sélecteur → aucun test ne tombe encore (la peau est en Tâche 7) ; le noter. Appeler `preventDefault` avant de savoir si la tuile est retenue → deux tests échouent. Retirer le remplacement de l'entrée existante → le Review Focus 3 échoue.

- [ ] **Step 8 : commit** (version montée)

```bash
git add content.js manifest.json test/page.js test/run.js
git commit -m "feat: un clic droit sur une tuile du jeu pose ta priorité"
```

---

## Task 7 : les deux marquages sur la tuile

**Files:**
- Modify: `content.js` (le peintre des tuiles du jeu, `content.js:2136`-`2154` ; la pastille de la peau, `content.js:1510`-`1524` ; la lecture de `skin`, `content.js:2200`-`2215`)
- Modify: `test/run.js`

**Interfaces:**
- Consomme : `skin.prio` (Tâche 3), `skin.hints`, `prioAsk` (Tâche 6).
- Produit : rien de neuf ; deux marquages distincts sur la tuile.

- [ ] **Step 1 : écrire les tests qui échouent**

```js
t('ta priorité se marque autrement que la cible du plan', () => {
  const p = page({comp:'supplies', planet:'33701', tuiles:[{id:1, niv:14}, {id:2, niv:9}],
                  skin:{hints:{'33701':{2:10}}, prio:{'33701':{1:20}}}});
  const a = p.tuile(1), b = p.tuile(2);
  assert.match(a.pastille, /20/);  assert.match(a.infobulle, /ta priorité/i);
  assert.match(b.pastille, /10/);  assert.ok(!/ta priorité/i.test(b.infobulle));
  assert.notEqual(a.classe, b.classe, 'deux teintes, pas une');
});

t('sur la même tuile, la priorité passe devant la cible du plan', () => {
  const p = page({comp:'supplies', planet:'33701', tuiles:[{id:1, niv:14}],
                  skin:{hints:{'33701':{1:15}}, prio:{'33701':{1:20}}}});
  assert.match(p.tuile(1).pastille, /20/);
  assert.match(p.tuile(1).infobulle, /ta priorité/i);
});

t('une demande pas encore confirmée se voit, et se dit non confirmée', () => {
  const p = page({comp:'supplies', planet:'33701', tuiles:[{id:1, niv:14}], skin:{}});
  p.clicDroit(1, '20');
  assert.match(p.tuile(1).pastille, /20/);
  assert.match(p.tuile(1).infobulle, /pas encore|en attente/i);
});

t('la priorité disparaît de la tuile quand le panneau la retire', () => {
  const p = page({comp:'supplies', planet:'33701', tuiles:[{id:1, niv:14}],
                  skin:{prio:{'33701':{1:20}}}});
  assert.match(p.tuile(1).pastille, /20/);
  p.majSkin({prio:{}});
  assert.equal(p.tuile(1).pastille, null);
});

t('la peau marque aussi la priorité, et répond au clic droit', () => {
  const p = page({comp:'supplies', planet:'33701', tuiles:[{id:1, niv:14}],
                  skin:{peau:true, prio:{'33701':{1:20}}}});
  assert.match(p.carte(1).pastille, /20/);
  p.clicDroit(1, '25');
  assert.equal(p.ecrit().prioAsk[0].lvl, 25, 'le second sélecteur sert ici');
});
```

- [ ] **Step 2 : les lancer et vérifier qu'ils échouent** — Run: `node test/run.js`.

- [ ] **Step 3 : peindre les deux marquages sur la tuile du jeu**

La boucle de `content.js:2144`-`2154` lit aujourd'hui `hints` seul. Elle lit maintenant l'union de `skin.prio`, des demandes en attente dans `prioAsk` et de `hints`, dans cet ordre de priorité, et pose une classe et une infobulle différentes selon la source. Le nettoyage de `content.js:2137`-`2142` suit la même union, sinon un marquage retiré resterait collé.

- [ ] **Step 4 : peindre la pastille de la peau**

Même union pour `c.cible` (`content.js:1415`), et la pastille porte la source. La clé de repeinte (`content.js:1419`) doit inclure la source, sinon un changement de teinte sans changement de niveau ne redessinerait pas.

- [ ] **Step 5 : lancer les tests** — Run: `node test/run.js`, Expected: tout passe.

- [ ] **Step 6 : valider par mutation**

Laisser `hints` gagner sur `prio` → le second test échoue. Oublier la source dans la clé de repeinte → le quatrième échoue. Retirer l'écho de `prioAsk` → le troisième échoue.

- [ ] **Step 7 : ajouter l'entrée « demande » au glossaire**

`GLOSSARY.md` : une **demande** est ce que la page envoie au panneau sur un clic droit ; elle devient une **priorité** quand le panneau a su la placer. Lier aux entrées **priorité** et **objectif** déjà présentes.

- [ ] **Step 8 : commit** (version montée)

```bash
git add content.js GLOSSARY.md manifest.json test/run.js
git commit -m "feat: la tuile montre ta priorité, distincte de ce que le plan vise"
```

---

## Note sur l'ordre

Les tâches 1 → 5 ne touchent que `app.js` et `test/run.js` ; les tâches 6 et 7 ne touchent que `content.js` et `test/page.js`, sauf le glossaire. La tâche 4 consomme la forme de `prioAsk` que la tâche 6 produit : elle est décrite dans la conception et dans les interfaces des deux tâches, donc l'ordre 4-avant-6 tient. La tâche 7 a besoin du canal de la tâche 3.
