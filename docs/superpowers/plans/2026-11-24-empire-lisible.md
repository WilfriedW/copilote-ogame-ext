# Page Empire lisible — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** L'onglet Empire se lit d'un coup d'œil : sept planètes repliées en sept lignes portant leur production, et dans la carte ouverte, le niveau visé comme seul champ vif.

**Architecture:** Tout tient dans `VIEWS.planets()` (le HTML) et `REFRESH.planets()` (ce qu'on y réinjecte par identifiant), plus quelques règles de `panel.css`. On réutilise la mécanique de repli existante — `fold(nom, défaut)` au rendu, `summary[data-fold]` au clic — sans rien y ajouter. Aucune donnée nouvelle dans `S`, à part des clés de repli.

**Tech Stack:** JavaScript sans framework, script classique chargé par `sidepanel.html`. Tests : `node test/run.js`, helper `t(nom, fn)` + `assert`, assertions sur les chaînes HTML rendues.

**Spec:** `docs/superpowers/specs/2026-11-24-empire-lisible-design.md`

## Global Constraints

- **Version à chaque commit** : `manifest.json:4` et `APP_VERSION` (`app.js:2`) montent ensemble, correctif +1 (1.54.10 → 1.54.11, puis .12…).
- **Les identifiants que `REFRESH.planets()` remplit restent des `<div>`/`<span>` vides dans le HTML rendu** : la vue ne calcule pas, elle pose des trous. C'est la convention de `pres-`, `pvoc-`, `pctrn-`, `pfleet-`.
- **Ne jamais appeler `render()` depuis un écouteur de la carte** : il refermerait le volet qui porte le champ (raison écrite en clair à `app.js:5262`). `changed()` / `refresh()`.
- **Aucune dépendance nouvelle.** Pas de bibliothèque, pas de fichier nouveau hors tests.
- **La liste `want` de `test/run.js:28` s'allonge** avec tout symbole qu'un test appelle : `fmt` dès la tâche 1, puis `lvLu` et `prioCount`. Un symbole absent de cette liste est `undefined` dans le test, pas une erreur.
- **Tests en français**, comme les 800 existants, et chaque `t()` nomme un comportement, pas une fonction.

## Review Focus

Cinq cas que la spec implique sans qu'aucune tâche ne les exerce d'elle-même. Chacun a son test, posé dans la tâche qui porte le code.

1. **Hors extension** (`IS_EXT` faux) : aucun relevé n'existe, les niveaux doivent rester saisissables. → Tâche 2.
2. **Planète `bNeuve`** (nommée par la liste du jeu, jamais visitée) : ses niveaux sont à zéro et doivent rester saisissables. → Tâche 2.
3. **Données d'exemple** (`S.sample`) : premier lancement, rien n'est lu, tout se tape. → Tâche 2.
4. **Un repli venu d'une sauvegarde d'un autre poste**, sans les clés `pl:` : les cartes doivent partir fermées, pas ouvertes. → Tâche 1.
5. **Une planète sans aucune forme de vie relevée** : le volet des stocks et le compte d'objectifs doivent tenir quand même. → Tâche 4.

---

### Tâche 1 : La carte de planète se replie, sa production dans le résumé

**Files:**
- Modify: `app.js:4751-4789` (`VIEWS.planets`), `app.js:5073-5090` (`REFRESH.planets`)
- Modify: `panel.css` (règle du résumé de planète)
- Test: `test/run.js`

**Interfaces:**
- Consomme : `fold(nom, défaut)` (`app.js:1568`), `fmt(n)` (`app.js:500`), `production(p)`, `esc()`.
- Produit : la clé de repli `'pl:' + p.id`, et l'identifiant `psum-${i}` que `REFRESH.planets()` remplit. Les tâches suivantes travaillent dans le **corps** de ce `<details>`.

- [ ] **Étape 1 : écrire les tests qui échouent**

```js
t('chaque planète est une carte repliée qui porte son nom et ses coordonnées', () => {
  const h = lu(app().VIEWS.planets());
  assert.ok(/<details class="card volet"[^>]*data-pi="0"/.test(h), h.slice(0, 600));
  assert.ok(/data-fold="pl:/.test(h), 'le repli se souvient, par planète');
});

t('les cartes de planète partent fermées, même sans clé de repli en mémoire', () => {
  const h = app(s => { s.ui.fold = {}; }).VIEWS.planets();
  assert.ok(!/<details class="card volet" open/.test(h));
});

t('le résumé porte la production des trois ressources, sans rien déplier', () => {
  const g = app();
  g.VIEWS.planets(); g.REFRESH.planets();
  const s = lu(g.html()['psum-0'] || '');
  const pr = g.production(g.S.planets[0]);
  assert.ok(s.includes(g.fmt(pr.m)) && s.includes(g.fmt(pr.c)) && s.includes(g.fmt(pr.d)), s);
});

t('le bouton Retirer est dans le corps, pas dans le résumé qui bascule le volet', () => {
  const h = lu(app().VIEWS.planets());
  const resume = h.slice(h.indexOf('<summary'), h.indexOf('</summary>'));
  assert.ok(!/data-del=/.test(resume), 'un bouton dans le résumé ouvrirait la carte au lieu de retirer');
});
```

- [ ] **Étape 2 : lancer les tests, vérifier qu'ils échouent**

Run: `node test/run.js`
Attendu : ÉCHEC sur les quatre, `.card` n'est pas un `<details>`.

- [ ] **Étape 3 : rendre la carte repliable dans `VIEWS.planets()`**

Le `<div class="card" data-pi="${i}">` devient
`<details class="card volet" data-pi="${i}"${fold('pl:'+p.id, false)}>`, suivi d'un
`<summary data-fold="pl:${p.id}">` qui porte, en texte : le nom de la planète, ses
coordonnées, et `<span class="mono" id="psum-${i}"></span>`. Tout le reste de la carte
— `.planet-head` et ses champs, le bouton `data-del`, les jauges, les pastilles, les
volets — passe dans le corps, après le `</summary>`, inchangé.

Ajouter dans `panel.css`, près de `details.volet>summary` (ligne 164) : une règle qui
rend le résumé de planète plus haut que celui d'un volet ordinaire (nom en gras,
`.mono` des chiffres aligné à droite) — le résumé est maintenant la ligne qu'on lit sept fois.

- [ ] **Étape 4 : remplir le résumé dans `REFRESH.planets()`**

Dans la boucle `S.planets.forEach`, à côté de l'écriture de `pres-${i}`, écrire dans
`psum-${i}` les trois productions au format `fmt()`, séparées par ` · `, dans l'ordre
métal, cristal, deutérium. Protéger par un `if(el)` comme le fait déjà `pfleet-`.

- [ ] **Étape 5 : lancer les tests**

Run: `node test/run.js`
Attendu : PASS, et aucune régression sur les vérifications existantes.

- [ ] **Étape 6 : commit**

```bash
git add app.js panel.css test/run.js manifest.json
git commit -m "feat: chaque planète se replie en une ligne qui porte sa production"
```

---

### Tâche 2 : Les niveaux relevés deviennent muets, le niveau visé seul vif

**Files:**
- Modify: `app.js:4774` (grille des bâtiments), `app.js:4772` (résumé du volet), `panel.css:170`
- Test: `test/run.js`

**Interfaces:**
- Consomme : `IS_EXT` (`app.js:465`), `p.gid` et `p.bNeuve` posés par le relevé (`app.js:5550-5557`), `prios()` et `priosLf()`.
- Produit : `lvLu(p) -> boolean` — vrai quand le jeu a réellement lu les niveaux de cette planète. Et `prioCount(pid) -> number`.

- [ ] **Étape 1 : écrire les tests qui échouent**

```js
t('les niveaux lus dans le jeu ne se tapent plus', () => {
  const h = lu(app(RELEVE, SOIR, null, true).VIEWS.planets());
  assert.ok(/data-b="m"[^>]*readonly/.test(h) || /readonly[^>]*data-b="m"/.test(h), h.slice(0, 800));
});

t("hors extension, les niveaux restent saisissables : rien ne les relève", () => {
  const h = lu(app(RELEVE, SOIR, null, false).VIEWS.planets());
  assert.ok(!/data-b="m"[^>]*readonly/.test(h));
});

t('une planète que le jeu a nommée sans la visiter garde ses niveaux saisissables', () => {
  const h = lu(app(s => { RELEVE(s); s.planets[1].bNeuve = 1; }, SOIR, null, true).VIEWS.planets());
  const carte = h.slice(h.indexOf('data-pi="1"'));
  assert.ok(!/data-b="m"[^>]*readonly/.test(carte), 'bNeuve : aucun niveau lu, il faut pouvoir les taper');
});

t("sur les données d'exemple, tout se tape", () => {
  const h = lu(app(s => { s.sample = true; s.planets.forEach(p => { delete p.gid; }); }, SOIR, null, true).VIEWS.planets());
  assert.ok(!/data-b="m"[^>]*readonly/.test(h));
});

t('le volet des bâtiments annonce combien d\'objectifs sont posés', () => {
  const g = app(s => { RELEVE(s); });
  g.prioPose('b', g.S.planets[0].id, 'm', g.S.planets[0].b.m + 3);
  const h = lu(g.VIEWS.planets());
  const resume = h.slice(h.indexOf('data-fold="niv:'));
  assert.ok(/1 objectif/.test(resume.slice(0, 200)), resume.slice(0, 200));
});
```

- [ ] **Étape 2 : lancer les tests, vérifier qu'ils échouent**

Run: `node test/run.js`
Attendu : ÉCHEC — aucun `readonly` sur `data-b`, aucun compte dans le résumé.

- [ ] **Étape 3 : implémenter `lvLu(p)` et `prioCount(pid)` dans `app.js`**

`lvLu(p)` rend `IS_EXT && !!p.gid && !p.bNeuve` — les trois conditions de la spec, dans
cet ordre : hors extension rien n'est relevé, sans `gid` le jeu ne connaît pas cette
planète, et `bNeuve` dit que son nom est lu mais pas ses niveaux.

`prioCount(pid)` rend le nombre d'entrées de `prios()` plus celles de `priosLf()` dont
le `pid` est celui-là. Les deux listes, parce qu'une case de forme de vie est un
objectif comme un autre pour le joueur.

Les poser près de `prioLvl` (`app.js:311`) et les ajouter à la liste `want` de `test/run.js`.

- [ ] **Étape 4 : appliquer dans la vue**

Dans la grille des bâtiments (`app.js:4774`), l'`<input data-b>` et l'`<input data-p="sats">`
prennent `readonly tabindex="-1"` quand `lvLu(p)` — exactement la forme déjà employée pour
les formes de vie (`app.js:4579`). Le `<input class="prio">` ne change pas.

Le résumé du volet (`app.js:4772`) devient
`Bâtiments et niveaux visés <span class="note">N objectif(s)</span>`, N venant de
`prioCount(p.id)` ; rien quand N vaut zéro.

Dans `panel.css`, la règle `.lv input[readonly]` (ligne 170) couvre déjà le style muet ;
ajouter la règle qui rend `.lv input.prio` vif — bordure `var(--accent)` — pour que le
seul champ typable de la ligne se voie.

- [ ] **Étape 5 : lancer les tests**

Run: `node test/run.js`
Attendu : PASS.

- [ ] **Étape 6 : commit**

```bash
git add app.js panel.css test/run.js manifest.json
git commit -m "feat: les niveaux lus dans le jeu deviennent muets, le niveau visé seul se tape"
```

---

### Tâche 3 : La prose de conseil se replie

**Files:**
- Modify: `app.js:4765-4771` (vocation, centre, notes), `app.js:4754` (carte d'empire), `app.js:5086-5089` (`REFRESH.planets`)
- Test: `test/run.js`

**Interfaces:**
- Consomme : `vocHtml(v)` (`app.js:4551`), `centreNoteHtml(p, i, ci)` (`app.js:4546`), `fold()`.
- Produit : `vocHtml` se scinde en `vocPill(v) -> string` (la pastille, ou la phrase qui dit qu'il n'y a rien à dire) et `vocWhy(v) -> string` (la raison, vide quand il n'y en a pas). `REFRESH.planets` remplit `pvoc-${i}` et, nouveau, `pvocw-${i}`.

- [ ] **Étape 1 : écrire les tests qui échouent**

```js
t('la raison d\'une vocation se range derrière un volet, la pastille reste', () => {
  const g = app(s => { s.planets.push(JSON.parse(JSON.stringify(s.planets[0]))); });
  const h = lu(g.VIEWS.planets());
  assert.ok(/Pourquoi cette planète/.test(h), h.slice(0, 600));
  assert.ok(/id="pvoc-0"/.test(h) && /id="pvocw-0"/.test(h), 'pastille et raison sont deux trous distincts');
});

t('la note du centre est dans le volet des raisons, pas dans le passage', () => {
  const h = lu(app().VIEWS.planets());
  const i = h.indexOf('Pourquoi cette planète');
  assert.ok(i > -1 && h.indexOf('id="pctrn-0"') > i, 'pctrn doit suivre le résumé du volet');
  assert.ok(h.indexOf('id="pfleet-0"') < i, 'la flotte à quai est un fait court : elle reste visible');
});

t('le pavé du mélange se replie, les jauges d\'empire restent', () => {
  const h = lu(app().VIEWS.planets());
  assert.ok(/Pourquoi ce classement/.test(h));
  assert.ok(/id="empireRes"/.test(h) && /id="empireFactor"/.test(h), 'les chiffres ne se replient pas');
  const i = h.indexOf('Pourquoi ce classement');
  assert.ok(h.indexOf('id="empireMix"') > i);
});
```

- [ ] **Étape 2 : lancer les tests, vérifier qu'ils échouent**

Run: `node test/run.js`
Attendu : ÉCHEC — ni « Pourquoi cette planète », ni « Pourquoi ce classement », ni `pvocw-0`.

- [ ] **Étape 3 : scinder `vocHtml` et poser le volet des raisons**

`vocPill(v)` rend ce que `vocHtml` rendait moins la raison ; `vocWhy(v)` rend
`<span class="note">…</span>` avec `esc(v.why)`, ou la chaîne vide. `vocHtml` disparaît,
et ses appels dans `REFRESH.planets` se dédoublent : `pvoc-${i}` reçoit la pastille,
`pvocw-${i}` la raison.

Dans la carte, après la ligne qui porte la pastille et la case Centre, insérer
`<details class="volet"${fold('pq:'+p.id, false)}><summary data-fold="pq:${p.id}">Pourquoi cette planète</summary>`
contenant, dans cet ordre et sans rien changer à leur contenu : `<span id="pvocw-${i}"></span>`
et le `<p id="pctrn-${i}">` — la raison de la vocation, et la note du centre avec le
labo qui ne suit pas.

Restent hors du volet, visibles dès la carte ouverte : la pastille `pvoc-${i}`, la
pastille des forages posée par `crawlerPill`, la case Centre avec son libellé, et le
`<p id="pfleet-${i}">` — « Flotte à quai » est un fait court, pas du conseil (spec,
section « Ce qui est décidé »).

- [ ] **Étape 4 : replier le mélange de la carte d'empire**

Dans `app.js:4754`, le `<p class="note" id="empireMix">` passe à l'intérieur d'un
`<details class="volet"${fold('mix', false)}><summary data-fold="mix">Pourquoi ce classement</summary>`.
`empireRes` et `empireFactor` ne bougent pas.

- [ ] **Étape 5 : lancer les tests**

Run: `node test/run.js`
Attendu : PASS. Vérifier en particulier qu'aucune vérification existante sur `vocHtml` ne subsiste sous ce nom.

- [ ] **Étape 6 : commit**

```bash
git add app.js test/run.js manifest.json
git commit -m "feat: la prose de conseil se range derrière un volet, les chiffres restent"
```

---

### Tâche 4 : Les stocks dans leur propre volet, valeurs dans le résumé

**Files:**
- Modify: `app.js:4777-4784` (fin du volet des bâtiments), `app.js:5073-5090` (`REFRESH.planets`)
- Test: `test/run.js`

**Interfaces:**
- Consomme : `stockNow(p)`, `fmt(n)`, `fold()`. Les écouteurs `input[data-s]` de `bind()` (`app.js:5253`) cherchent dans `card.querySelectorAll` : déplacer les champs dans le même `[data-pi]` ne les casse pas.
- Produit : l'identifiant `pstk-${i}`, rempli par `REFRESH.planets()`.

- [ ] **Étape 1 : écrire les tests qui échouent**

```js
t('les stocks ont leur propre volet, hors de celui des bâtiments', () => {
  const h = lu(app().VIEWS.planets());
  const niv = h.indexOf('data-fold="niv:'), stk = h.indexOf('data-fold="stock:');
  assert.ok(stk > -1, 'un volet de stock existe');
  assert.ok(h.indexOf('data-s="m"') > stk, 'les champs de stock suivent leur propre résumé');
});

t('le résumé des stocks porte les trois valeurs, sans ouvrir', () => {
  const g = app();
  g.VIEWS.planets(); g.REFRESH.planets();
  const s = lu(g.html()['pstk-0'] || '');
  const st = g.S.planets[0].stock;
  assert.ok(s.includes(g.fmt(st.m)), s);
});

t('une planète sans aucune forme de vie garde son volet de stock', () => {
  const h = lu(app(s => { s.planets.forEach(p => { p.lf = {}; }); }).VIEWS.planets());
  assert.ok(/data-fold="stock:/.test(h));
  assert.ok(/aucune case de forme de vie relevée/.test(h), 'et la phrase des formes de vie tient toujours');
});
```

- [ ] **Étape 2 : lancer les tests, vérifier qu'ils échouent**

Run: `node test/run.js`
Attendu : ÉCHEC — les champs `data-s` sont encore dans le volet `niv:`.

- [ ] **Étape 3 : sortir les stocks du volet des bâtiments**

Le paragraphe « **Stock** — ce que cette planète a en magasin… » et la `div.grid.tight`
des trois champs quittent le volet `niv:` et deviennent, dans le corps de la carte,
juste après lui :
`<details class="volet"${fold('stock:'+p.id, false)}><summary data-fold="stock:${p.id}">Stock <span class="mono note" id="pstk-${i}"></span></summary>`
avec, dedans, le paragraphe d'explication inchangé et les trois champs.

- [ ] **Étape 4 : remplir le résumé dans `REFRESH.planets()`**

Écrire dans `pstk-${i}` les trois valeurs de `stockNow(p)` au format `fmt()`, séparées
par ` · `, dans l'ordre métal, cristal, deutérium. Même garde `if(el)` que les autres.

- [ ] **Étape 5 : lancer les tests**

Run: `node test/run.js`
Attendu : PASS.

- [ ] **Étape 6 : commit**

```bash
git add app.js test/run.js manifest.json
git commit -m "feat: les stocks ont leur volet, leurs valeurs se lisent sans l'ouvrir"
```

---

### Tâche 5 : Vérification visuelle à l'aperçu

Les 800 vérifications sont aveugles au rendu : c'est ce qui a livré deux champs
invisibles le 2026-11-18. Cette tâche ne change pas de code, elle regarde.

**Files:**
- Create (temporaire, supprimé avant le commit) : `apercu-empire.html` à la racine du dépôt

- [ ] **Étape 1 : produire l'aperçu**

Un script Node qui charge `test/harness.js`, appelle `VIEWS.planets()`, puis
`REFRESH.planets()`, recolle le contenu de `view.html()` dans les `<div id="…">` de la
chaîne, et écrit **dans le dossier du dépôt** un `.html` autonome avec `panel.css`
inliné et **aucun `<script>`** — une page qui charge `app.js` s'affiche en coquille vide.

- [ ] **Étape 2 : regarder, cartes fermées**

`mcp__Claude_Browser__preview_start` sur le fichier, fenêtre à ~820 px de large.
Attendu : sept lignes, chacune avec son nom, ses coordonnées et ses trois chiffres de
production. Rien d'autre.

- [ ] **Étape 3 : regarder, une carte ouverte**

Remplacer `<details` par `<details open` dans le fichier produit, recharger.
Attendu : dans la grille, le niveau relevé est muet (pointillé, gris) et le `→` est le
seul champ vif ; la prose tient derrière « Pourquoi cette planète ».

- [ ] **Étape 4 : supprimer l'aperçu et clore**

```bash
rm apercu-empire.html && node test/run.js && git status --short
```
Attendu : les vérifications passent et l'arbre est propre.
