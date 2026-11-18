# Le rapport d'espionnage lu en entier — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le copilote lit la flotte et la défense du rapport d'espionnage collé, ne confond jamais « pas affiché » avec « il n'a rien », et chiffre ce que la défense vaut face au butin — sans jamais proposer de vaisseau de combat.

**Architecture:** Tout tient dans `app.js`. `parseReport` passe de trois nombres à un relevé `{res, fleet, def, loot}` où `null` veut dire « le rapport ne le dit pas ». Le gestionnaire de collage (`app.js:3451`) pré-remplit `S.raid.safe` à partir de ce relevé ; `raidPlan` expose la valeur de la défense lue ; la carte Pillage affiche la comparaison. Aucune donnée nouvelle n'est lue dans le jeu : `content.js` ne bouge pas.

**Tech Stack:** JavaScript classique sans module ni compilation, `node test/run.js` sans framework.

**Spec:** `docs/superpowers/specs/2026-11-18-demande-de-flotte-design.md`

## Global Constraints

- **Chaque commit incrémente la version**, dans `manifest.json` et dans `APP_VERSION` (`app.js:2`), les deux toujours égales. Partir de `1.46.9`.
- **`content.js` porte une modification non committée qui n'appartient pas à ce travail : ne jamais la stager.** `git add` nomme les fichiers un par un, jamais `-A` ni `.`.
- Les commentaires, libellés et noms de tests sont en français, et les commentaires disent *pourquoi*, pas *quoi*.
- Aucun chiffre affiché n'est estimé en silence.
- `rankUpgrades` reste seul maître du classement des mines ; le centre garde sa règle ; `defMix` ne bouge pas.
- Toute fonction nouvelle à tester s'ajoute à la liste d'exports de `app()` dans `test/run.js:27`.

## Review Focus

Ce que la conception implique et qu'aucune tâche n'exercerait sans ça. Chaque ligne a son test dans la tâche qui porte le code.

- **Un rapport collé deux fois de suite, le second plus pauvre** : la défense du premier ne doit pas rester. → Tâche 4.
- **Un collage qui ne contient pas la section Ressources** : les trois nombres tapés à la main survivent. → Tâche 4.
- **Une section présente mais dont une ligne sort du vocabulaire** : inconnue, jamais vide. → Tâche 3.
- **Un `S.raid` enregistré avant la mise à jour**, sans relevé : rien ne casse, `safe` garde sa valeur. → Tâche 4.
- **Un score de joueur inconnu** (`myScore()` rend `null`) : la prudence d'aujourd'hui reste. → Tâche 1.

## Structure des fichiers

- `app.js` — tout le code. `parseReport` (`:2972`), `raidPlan` (`:2977`), `raidTargets` (`:2748`), la carte Pillage (`VIEWS.explore`, `:3336`) et le gestionnaire de collage (`:3451`).
- `test/run.js` — tous les tests, à la suite des tests de pillage existants (`:2579`).
- `test/rapports/` — **créé par la tâche 2** : les rapports réels, en texte brut, qui servent de fixtures. C'est là que vit la preuve que le vocabulaire est juste.

---

### Task 1 : le statut hors-la-loi s'éteint à 500 000 points

Indépendante du reste : à faire en premier, elle ne dépend d'aucun relevé.

**Files:**
- Modify: `app.js:2756` (`raidTargets`)
- Test: `test/run.js`

**Interfaces:**
- Produces: `raidTargets()` rend les mêmes objets ; `outlaw` vaut toujours `false` quand `myScore() >= 5e5`.

- [ ] **Step 1 : écrire le test qui échoue**

Dans `test/run.js`, à la suite des tests de pillage. `API_INACTIFS` existe déjà (`test/run.js:3847`) ; il lui faut un inactif plus fort que le joueur et un score pour le joueur, via `S.me` et `API.scores`.

```js
t('au-dessus de 500 000 points, un inactif plus fort reste une cible', () => {
  const api = { planets: [['1:140:8', 'p1']], players: { p1: ['Alpha', 'i'] }, scores: { p1: [900000], moi: [600000] } };
  const g = app(s => { s.me = 'moi'; }, SOIR, api);
  const t0 = g.raidTargets()[0];
  assert.equal(t0.outlaw, false, 'le statut hors-la-loi n\'a plus d\'effet passé 500 000 points');
});

t('en dessous de 500 000 points, un inactif plus fort reste écarté', () => {
  const api = { planets: [['1:140:8', 'p1']], players: { p1: ['Alpha', 'i'] }, scores: { p1: [900000], moi: [100000] } };
  const g = app(s => { s.me = 'moi'; }, SOIR, api);
  assert.equal(g.raidTargets()[0].outlaw, true);
});

t('score du joueur inconnu : la prudence d\'avant ne bouge pas', () => {
  const api = { planets: [['1:140:8', 'p1']], players: { p1: ['Alpha', 'i'] }, scores: { p1: [900000] } };
  const g = app(s => { s.me = null; }, SOIR, api);
  assert.equal(g.raidTargets()[0].outlaw, false, 'sans score, rien à comparer — comme aujourd\'hui');
});
```

- [ ] **Step 2 : lancer les tests pour les voir échouer**

Run : `node test/run.js`
Attendu : le premier test échoue (`outlaw` vaut `true`).
`raidTargets` doit être ajouté à la liste d'exports de `test/run.js:27` pour que l'échec soit le bon.

- [ ] **Step 3 : implémenter**

Dans `raidTargets` (`app.js:2756`), `outlaw` ne vaut `true` que si `me != null && me < 5e5 && sc > me`. Un commentaire dit pourquoi le seuil existe, en citant la page Outlaw : « the status has no effect after 500,000 points ».

- [ ] **Step 4 : lancer les tests**

Run : `node test/run.js`
Attendu : tout passe, y compris les tests de cibles existants (`test/run.js:3846`).

- [ ] **Step 5 : commit**

Version `1.46.10` dans `manifest.json` et `app.js:2`. La conception et ce plan partent dans ce commit : ils ne sont pas encore versionnés, et un commit de documentation seul coûterait un numéro de version pour rien.

```bash
git add app.js manifest.json test/run.js docs/superpowers/specs/2026-11-18-demande-de-flotte-design.md docs/superpowers/plans/2026-11-18-demande-de-flotte.md && git commit -m "fix: passé 500 000 points, le hors-la-loi ne cache plus de cibles"
```

---

### Task 2 : le vocabulaire du rapport, relevé et non supposé

**Bloquée** tant que le joueur n'a pas fourni les rapports. Ne rien écrire à l'aveugle : un vocabulaire supposé rend chaque rapport inconnu, donc la fonction inutile.

**Files:**
- Create: `test/rapports/complet.txt`, `test/rapports/faible.txt`, `test/rapports/nue.txt`
- Modify: `app.js`, sous `DEF` (`:2796`)

**Interfaces:**
- Produces: `REPORT_WORDS` — `{<libellé minuscule>: <clé>}` ; `REPORT_HEADS` — les titres de section reconnus, chacun associé à `'res' | 'fleet' | 'def'` ; `SE_BAT` — `{<clé>: true}` pour les seules pièces qui tirent. L'appartenance se teste par clé et non par libellé, parce que c'est la clé que `parseReport` rend et que la tâche 4 relit.

- [ ] **Step 1 : réunir les rapports réels**

Trois fichiers, collés tels que le jeu les donne : un rapport complet avec Flotte et Défense, un rapport trop faible pour les montrer, un rapport sur une planète sans défense. Les coordonnées et noms de joueur peuvent être remplacés ; la mise en page, les titres et les libellés ne se touchent pas — c'est ce qu'on teste.

- [ ] **Step 2 : écrire `REPORT_WORDS`, `REPORT_HEADS` et `SE_BAT`**

Chaque libellé lu dans les fixtures, en minuscules, associé à sa clé. Les noms de `DEF` (`n`/`o`/`p`) et de `SHIPS` (`n`) alimentent la table plutôt que d'être recopiés ; ce qui leur manque — pluriels des coques, satellite solaire, foreuse, les deux missiles — s'ajoute à la main, d'après les fixtures et elles seules.

`SE_BAT` porte toutes les clés **sauf** le satellite solaire, la foreuse, la sonde d'espionnage et les deux missiles. Un commentaire dit pourquoi : ces cinq-là ne tirent pas (puissance d'attaque 1, 1 et 0,01 ; les missiles ne visent pas une flotte), donc leur présence n'empêche pas un raid ; tout le reste, petit transporteur compris, déclenche un combat, et le copilote ne simule pas de combat.

- [ ] **Step 3 : commit**

```bash
git add app.js manifest.json test/rapports && git commit -m "feat: le vocabulaire d'un rapport d'espionnage, relevé sur le jeu"
```

---

### Task 3 : `parseReport` rend un relevé

**Files:**
- Modify: `app.js:2972` (`parseReport`)
- Test: `test/run.js`

**Interfaces:**
- Consumes: `REPORT_WORDS`, `REPORT_HEADS` (tâche 2).
- Produces: `parseReport(txt)` → `{res: [m,c,d]|null, fleet: {<clé>:n}|null, def: {<clé>:n}|null, loot: number|null}`. `null` veut dire « le rapport ne le dit pas ». `{}` veut dire « lu, et vide ».

- [ ] **Step 1 : écrire les tests qui échouent**

Les fixtures se lisent avec `fs.readFileSync` depuis `test/rapports/`.

```js
t('un rapport sans section Défense rend une défense inconnue, pas nulle', () => {
  const r = app().parseReport(lire('faible.txt'));
  assert.equal(r.def, null, 'inconnue');
  assert.ok(r.res, 'les ressources, elles, sont là');
});

t('une section Défense sans aucune ligne vaut zéro', () => {
  assert.deepEqual(app().parseReport(lire('nue.txt')).def, {});
});

t('un rapport complet rend la flotte et la défense par type', () => {
  const r = app().parseReport(lire('complet.txt'));
  assert.ok(r.def.rl > 0, 'les lanceurs de missiles sont comptés');
  assert.ok(Object.keys(r.fleet).length > 0, 'la flotte aussi');
});

t('un libellé hors vocabulaire rend la section inconnue', () => {
  const txt = lire('nue.txt').replace(/Défense/, 'Défense\nTourelle fantôme\n4');
  assert.equal(app().parseReport(txt).def, null, 'lu sans comprendre n\'est pas compris vide');
});

t('le taux de butin se lit dans l\'en-tête', () => {
  assert.equal(app().parseReport(lire('complet.txt')).loot, 0.75);
});

t('les trois ressources se lisent encore comme avant', () => {
  assert.deepEqual(app().parseReport('Métal\n1.234\nCristal\n567\nDeutérium\n89').res, [1234, 567, 89]);
});
```

- [ ] **Step 2 : lancer les tests pour les voir échouer**

Run : `node test/run.js`
Attendu : échecs sur `r.def`, `r.fleet`, `r.loot` (`parseReport` rend encore un tableau).
`parseReport` s'ajoute à la liste d'exports de `test/run.js:27`.

- [ ] **Step 3 : implémenter `parseReport(txt)`**

Le texte se découpe en lignes. Une ligne qui est un titre de `REPORT_HEADS` ouvre une section et ferme la précédente. Dans une section `fleet` ou `def`, une ligne non vide est soit un libellé de `REPORT_WORDS` — et le nombre qui suit lui revient —, soit un nombre qui vient d'être consommé, soit rien de connu : dans ce dernier cas la section entière vaut `null`. Une section ouverte dont aucune ligne n'a donné de libellé vaut `{}`. Une section jamais ouverte vaut `null`. Les ressources gardent les expressions régulières d'aujourd'hui, pour que `Métal` suivi d'un saut de ligne continue de marcher ; `res` vaut `null` si aucune des trois n'a été trouvée. `loot` se lit sur « Butin : <n> % », divisé par 100, `null` sinon.

Les nombres se lisent avec la conversion existante (point comme séparateur de milliers).

- [ ] **Step 4 : lancer les tests**

Run : `node test/run.js`
Attendu : tout passe. Les appelants de `parseReport` cassent à cette étape — la tâche 4 les reprend ; en attendant, `app.js:3451` lit `.res`.

- [ ] **Step 5 : commit**

```bash
git add app.js manifest.json test/run.js && git commit -m "feat: un rapport d'espionnage se lit en entier, et dit ce qu'il ignore"
```

---

### Task 4 : le collage remplit la case, sans effacer ce que le joueur a tapé

**Files:**
- Modify: `app.js:3451` (gestionnaire `data-raid="paste"`), `app.js:3060` (l'invite du champ)
- Test: `test/run.js`

**Interfaces:**
- Consumes: `parseReport` (tâche 3).
- Produces: `S.raid` porte en plus `fleet`, `def` et `lootSeen`, aux mêmes valeurs que le relevé. `S.raid.safe` reste un booléen, et garde son sens : la parole du joueur.

- [ ] **Step 1 : écrire les tests qui échouent**

Le collage passe par le DOM ; les tests appellent plutôt une fonction nommée, `applyReport(txt)`, que le gestionnaire appelle aussi.

```js
t('un rapport nu coche la case et compose le raid', () => {
  const g = app(s => { s.raid = { coords: '1:142:9', m: 0, c: 0, d: 0, safe: false }; });
  g.applyReport(lire('nue.txt'));
  assert.equal(g.S.raid.safe, true);
});

t('un rapport avec défense décoche la case', () => {
  const g = app(s => { s.raid = { coords: '1:142:9', m: 0, c: 0, d: 0, safe: true }; });
  g.applyReport(lire('complet.txt'));
  assert.equal(g.S.raid.safe, false, 'la défense lue reprend la parole du joueur');
});

t('un rapport trop faible décoche aussi, et le dit', () => {
  const g = app(s => { s.raid = { coords: '1:142:9', m: 0, c: 0, d: 0, safe: true }; });
  g.applyReport(lire('faible.txt'));
  assert.equal(g.S.raid.safe, false);
  assert.equal(g.S.raid.def, null, 'inconnue, pas vide');
});

t('un second collage efface la défense du premier', () => {
  const g = app(s => { s.raid = { coords: '1:142:9', m: 0, c: 0, d: 0, safe: false }; });
  g.applyReport(lire('complet.txt'));
  g.applyReport(lire('faible.txt'));
  assert.equal(g.S.raid.def, null, 'la défense d\'hier ne se lit pas sur la cible d\'aujourd\'hui');
});

t('un collage sans ressources laisse celles qui ont été tapées', () => {
  const g = app(s => { s.raid = { coords: '1:142:9', m: 50000, c: 0, d: 0, safe: false }; });
  g.applyReport('Flotte\nDéfense');
  assert.equal(g.S.raid.m, 50000, 'un chiffre tapé à la main est une information du joueur');
});

t('une flotte de satellites et de sondes ne bloque pas le raid', () => {
  const g = app(s => { s.raid = { coords: '1:142:9', m: 0, c: 0, d: 0, safe: false }; });
  g.applyReport(lire('nue.txt').replace(/Flotte/, 'Flotte\nSatellite solaire\n12\nSonde d\'espionnage\n3'));
  assert.equal(g.S.raid.safe, true, 'ni l\'un ni l\'autre ne tire');
});
```

- [ ] **Step 2 : lancer les tests pour les voir échouer**

Run : `node test/run.js`
Attendu : `g.applyReport is not a function`.
`applyReport` s'ajoute à la liste d'exports de `test/run.js:27`.

- [ ] **Step 3 : implémenter `applyReport(txt)` dans `app.js`**

Appelle `parseReport`, pose `S.raid.fleet`, `S.raid.def` et `S.raid.lootSeen` au relevé — y compris à `null`, c'est tout l'objet du test du second collage. N'écrit `m`, `c`, `d` et `at` que si `res` n'est pas `null`, comme aujourd'hui (`app.js:3451`). Pose `safe` à vrai seulement si `fleet` et `def` sont tous deux non nuls et qu'aucune pièce comptée n'a `bat` vrai ; à faux sinon. Le gestionnaire de `data-raid="paste"` (`app.js:3451`) se réduit à l'appeler, puis `save(); render();`.

Un `S.raid` enregistré avant la mise à jour n'a ni `fleet` ni `def` : les deux valent `undefined`, que le reste traite comme `null` — rien à migrer, et `safe` garde la valeur que le joueur lui avait donnée.

- [ ] **Step 4 : réécrire l'invite du champ (`app.js:3060`)**

Elle demande le rapport entier et annonce que ce qui manque sera dit comme manquant, au lieu de « Colle le rapport ici ou saisis ses ressources » qui laisse croire que la partie Ressources suffit. La saisie à la main reste proposée pour les trois ressources.

- [ ] **Step 5 : lancer les tests**

Run : `node test/run.js`
Attendu : tout passe.

- [ ] **Step 6 : commit**

```bash
git add app.js manifest.json test/run.js && git commit -m "feat: le rapport collé remplit la case, et ne reprend pas ce que tu as tapé"
```

---

### Task 5 : ce que la défense vaut, face au butin

**Files:**
- Modify: `app.js:2977` (`raidPlan`), `app.js:3344` (la carte Pillage)
- Test: `test/run.js`

**Interfaces:**
- Consumes: `S.raid.def`, `S.raid.fleet`, `S.raid.lootSeen` (tâche 4).
- Produces: `raidPlan()` rend en plus `defValue: number|null` (équivalent métal de la défense lue, `null` si inconnue), `defList: string|null` (la défense en clair, via `shipList`) et `rateSeen: boolean` (le taux de butin vient du rapport, et non de la classe).

- [ ] **Step 1 : écrire les tests qui échouent**

```js
t('la défense lue est chiffrée en équivalent métal', () => {
  const g = app(s => { s.raid = { coords: '1:142:9', m: 100000, c: 0, d: 0, safe: false, at: SOIR, def: { rl: 45 } }; });
  const r = g.raidPlan();
  assert.equal(r.defValue, g.mse(45 * 2000, 0, 0), 'le même prix que celui que le copilote paie pour la sienne');
  assert.ok(/45 lanceurs de missiles/.test(r.defList));
});

t('une défense inconnue ne se chiffre pas', () => {
  const g = app(s => { s.raid = { coords: '1:142:9', m: 100000, c: 0, d: 0, safe: false, at: SOIR, def: null }; });
  assert.equal(g.raidPlan().defValue, null);
});

t('la carte pose la comparaison et ne compose aucun raid', () => {
  const g = app(s => {
    s.planets[0].ships = { lc: 10 };
    s.raid = { coords: '1:142:9', m: 100000, c: 0, d: 0, safe: false, at: SOIR, def: { rl: 45 }, fleet: {} };
  });
  const h = carteHtml(g);
  assert.ok(/45 lanceurs de missiles/.test(h), 'ce qui a été lu');
  assert.ok(/70 %/.test(h), 'et ce que ça coûte de le percer');
  assert.ok(!/data-act/.test(h), 'aucune action d\'attaque');
});
```

`carteHtml` rend le HTML de `VIEWS.explore` pour `#rdPlan`, comme le font les tests de vue existants.

- [ ] **Step 2 : lancer les tests pour les voir échouer**

Run : `node test/run.js`
Attendu : `defValue` vaut `undefined`.

- [ ] **Step 3 : implémenter**

Dans `raidPlan` : `defValue` est la somme des `DEF[k].c` passée à `mse` (`app.js:840`), `null` si `S.raid.def` est `null` ou `undefined` ; `defList` vient de `shipList` (`app.js:1368`), qui nomme déjà la défense.

Le taux de butin devient `S.raid.lootSeen` quand il a été lu, et la déduction par la classe (`app.js:2988`) sinon ; `rateSeen` dit lequel des deux. La jauge « 50 % du stock » (`app.js:3346`) le reprend : lu dans le rapport, ou déduit de ta classe. Lu, il est juste ; déduit, il ignore le statut d'honneur de la cible — d'où l'intérêt de dire d'où il vient.

Dans la carte (`app.js:3344`), sous les jauges : quand `defValue > 0`, une ligne qui donne la défense en clair, sa valeur, le butin en regard, et la phrase que la conception fixe — percer coûte plus cher que ça rapporte, la défense repousse à 70 % gratuitement sans laisser de débris, et le copilote ne compose pas d'écran parce que dimensionner un combat demande un simulateur. Quand `S.raid.fleet` porte une pièce qui se bat, une ligne qui la **nomme sans la chiffrer**. Quand `def` ou `fleet` vaut `null`, la ligne qui dit laquelle manque et que plus de sondes ou un meilleur Espionnage la montreraient.

La condition qui compose l'action d'attaque (`app.js:3348`) ne change pas : elle lit `S.raid.safe`, que la tâche 4 pose. Un joueur qui recoche garde son raid, et la comparaison reste affichée sous la case.

- [ ] **Step 4 : lancer les tests**

Run : `node test/run.js`
Attendu : tout passe, les 491 vérifications d'avant comprises.

- [ ] **Step 5 : commit**

```bash
git add app.js manifest.json test/run.js && git commit -m "feat: ce que sa défense vaut, face à ce qu'il y a à prendre"
```
