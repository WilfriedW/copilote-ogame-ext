# Tir de lune — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un onglet « Lune » dans Outils qui dit, avant le tir, combien de
vaisseaux font quelle chance de lune, ce que la défense de la planète en tue,
et ce qu'une lune coûtera.

**Architecture:** Quatre fonctions pures dans `app.js` — l'arithmétique des
débris (exacte), son inverse, la facture espérée, et une estimation de ce que
la défense tue en six manches. Une vue et un rafraîchissement sur le patron de
`fleet()` (`app.js:4429`, `app.js:4720`). Trois tables de données étendues :
les coûts des coques de combat, les attaques de la défense, les boucliers des
vaisseaux.

**Tech Stack:** JavaScript sans dépendance, extension Chrome MV3. Tests :
`node test/run.js`, faux DOM maison (`test/page.js`), pas de framework.

**Spec:** `docs/superpowers/specs/2026-11-24-lune-sur-le-hq-design.md`

## Global Constraints

- **La coque d'une pièce ou d'un vaisseau est `c[0] + c[1]`**, jamais une table
  à part.
- **Le plancher est dur** : sous 100 000 de débris, la chance vaut `0`, pas une
  fraction de pourcent.
- **Le plafond est à 20 %**, atteint à 2 000 000 de débris.
- **`p.defs == null` veut dire inconnu, jamais zéro** — le partage de `defsOf`
  (`app.js:2822`). Une défense inconnue ne rend aucun verdict de défense.
- **Aucun chiffre affiché n'est estimé en silence** : l'estimation de défense
  est la seule de la carte, et la note la nomme.
- **Lecture seule** : la carte calcule, elle n'envoie rien, elle ne clique pas.
- **Les trois tables se relisent sur le wiki avant d'être posées.** Le
  recoupement de `col` avec `COL_SHIP_COST` (`app.js:1902`) vaut pour une
  ligne, pas pour trente-deux.
- Le +5 % par niveau d'Armes et de Bouclier vient du wiki, pas de
  `docs/revue-wiki-ogame.md` : à marquer en commentaire là où il s'emploie.
- Commits en français, sujet à l'intention, corps expliquant le pourquoi,
  terminés par `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Version à incrémenter dans `manifest.json` et `app.js` à chaque commit.

## Écart avec la spec, à corriger ici

La spec écrit la formule de défense avec un terme `bouclier_du_vaisseau` et un
champ pour le niveau de Bouclier du camarade, mais sa section « tables
étendues » n'autorise que les coûts et les attaques. Le terme a besoin du
bouclier de base de chaque vaisseau, qui n'est nulle part dans le modèle.

**Tranché ici** : `SHIPS` gagne un `bou:`, comme `DEF` gagne un `a:`. Quatorze
nombres de plus, du même wiki, relus de la même façon. L'autre issue — jeter le
terme de bouclier et le dire dans la note — économisait une table mais rendait
l'estimation optimiste sans l'avouer, ce que la contrainte interdit.

## Review Focus

| Entrée que la spec n'exerce pas | Comportement attendu | Tâche |
| --- | --- | --- |
| chance à `0` passée à la facture (tir sous le plancher) | `null`, jamais `Infinity` tirs ni un `NaN` affiché | 2 |
| nombre de vaisseaux vide ou `0` | aucun chiffre, et la carte le dit en une phrase | 4 |
| chance visée hors de `]0 ; 20]` | bornée à cet intervalle, et la carte dit laquelle elle a prise | 2 |
| `p.defs` lu mais toutes les pièces à zéro | `tue: 0` et un verdict franc, pas « inconnu » | 3 |
| `p.ships` jamais relevé | pas d'avertissement « 0 à ta charge », qui serait un chiffre faux | 5 |

---

### Task 1 : Les trois tables

**Files:**
- Modify: `app.js:3846` — `SHIP_COST`, dix coques de plus
- Modify: `app.js:3820` — `DEF`, un `a:` par pièce
- Modify: `app.js:49` — `SHIPS`, un `bou:` par vaisseau
- Test: `test/run.js`

**Interfaces:**
- Produces: `SHIP_COST[k]` → `[m, c, d]` pour les quatorze clés de `SHIPS` ;
  `DEF[k].a` → attaque de base ; `SHIPS[k].bou` → bouclier de base.

- [ ] **Step 1 : Écrire les tests qui échouent** dans `test/run.js`. Ajouter
  `'SHIP_COST'`, `'DEF'`, `'SHIPS'`, `'COL_SHIP_COST'` à la liste d'exports de
  `app()`.

```js
t('les huit attaques de défense sont celles de la revue', () => {
  const g = app();
  assert.deepEqual(['rl','ll','hl','ic','gc','pt','sd','ld'].map(k => g.DEF[k].a),
    [80, 100, 250, 150, 1100, 3000, 1, 1]);
});

t('la coque d\'une pièce de défense vaut son métal plus son cristal', () => {
  const g = app();
  assert.deepEqual(['rl','ll','hl','ic','gc','pt','sd','ld'].map(k => g.DEF[k].c[0] + g.DEF[k].c[1]),
    [2000, 2000, 8000, 8000, 35000, 100000, 20000, 100000]);
});

t('chaque vaisseau a un coût et un bouclier', () => {
  const g = app();
  Object.keys(g.SHIPS).forEach(k => {
    assert.ok(Array.isArray(g.SHIP_COST[k]), `coût manquant : ${k}`);
    assert.equal(typeof g.SHIPS[k].bou, 'number', `bouclier manquant : ${k}`);
  });
  assert.deepEqual(g.SHIP_COST.lf, [3000, 1000, 0]);
  assert.equal(g.SHIPS.lf.bou, 10);
});

t('le vaisseau de colonisation recoupe COL_SHIP_COST', () => {
  const g = app();
  assert.deepEqual(g.SHIP_COST.col, g.COL_SHIP_COST);
});
```

- [ ] **Step 2 : Lancer les tests pour les voir échouer**

Run: `node test/run.js`
Expected: FAIL — `DEF.rl.a` vaut `undefined`, `SHIP_COST.lf` n'existe pas.

- [ ] **Step 3 : Relire les trente-deux nombres sur le wiki**, puis les poser :
  `a:` sur les huit pièces de `DEF`, `bou:` sur les quatorze de `SHIPS`, et les
  dix coques manquantes de `SHIP_COST` (`lf`, `hf`, `cr`, `bs`, `bc`, `bb`,
  `ds`, `rp`, `rec`, `col`).

Un commentaire au-dessus de `SHIP_COST` dit pourquoi les coques de combat y
entrent alors que le copilote n'en propose aucune : c'est le tir de lune qui
les lit, et rien d'autre.

- [ ] **Step 4 : Lancer les tests pour les voir passer**

Run: `node test/run.js`
Expected: PASS

- [ ] **Step 5 : Commit**

```bash
git add app.js test/run.js manifest.json
git commit -m "feat: les coques de combat ont un coût, la défense une attaque"
```

---

### Task 2 : L'arithmétique exacte du tir

**Files:**
- Modify: `app.js` — trois fonctions à côté de `SHIP_COST` (`app.js:3846`)
- Test: `test/run.js`

**Interfaces:**
- Consumes: `SHIP_COST` (tâche 1)
- Produces:
  - `luneTir(k, n)` → `{v, debris, chance}`. `v` = `métal + cristal` d'un
    vaisseau `k`, `debris` = `0,3 × n × v`, `chance` en pourcent.
  - `luneVaisseaux(k, pct)` → nombre entier de vaisseaux `k` pour viser `pct`.
  - `luneFacture(chance, n, k)` → `{tirs, m, c, recupere}`, ou `null` si
    `chance <= 0`.

- [ ] **Step 1 : Écrire les tests qui échouent** dans `test/run.js`. Ajouter
  `'luneTir'`, `'luneVaisseaux'`, `'luneFacture'` aux exports.

```js
t('mille chasseurs légers font 1,2 M de débris et 12 % de chance', () => {
  const g = app(), r = g.luneTir('lf', 1000);
  assert.equal(r.v, 4000);
  assert.equal(r.debris, 1200000);
  assert.equal(r.chance, 12);
});

t('sous 100 000 de débris, la chance est nulle', () => {
  const g = app();
  assert.equal(g.luneTir('lf', 83).debris, 99600);
  assert.equal(g.luneTir('lf', 83).chance, 0);
  assert.ok(g.luneTir('lf', 84).chance > 1);
});

t('la chance plafonne à 20 %', () => {
  assert.equal(app().luneTir('lf', 2000).chance, 20);
});

t('la chance par ressource dépensée est la même à 100 000 et à 2 M', () => {
  const g = app();
  const par = n => g.luneTir('lf', n).chance / (n * 4000);
  assert.ok(Math.abs(par(84) - par(1666)) < 1e-12);
});

t('viser une chance donne le nombre de vaisseaux, et l\'inverse se recoupe', () => {
  const g = app();
  assert.equal(g.luneVaisseaux('lf', 12), 1000);
  assert.equal(g.luneVaisseaux('lf', 1), 84);
  assert.ok(g.luneTir('lf', g.luneVaisseaux('lf', 7)).chance >= 7);
});

t('une chance visée hors bornes est ramenée dans les bornes', () => {
  const g = app();
  assert.equal(g.luneVaisseaux('lf', 50), g.luneVaisseaux('lf', 20));
  assert.equal(g.luneVaisseaux('lf', 0), g.luneVaisseaux('lf', 1));
});

t('la facture espérée compte les tirs et ce que le recyclage rend', () => {
  const g = app(), f = g.luneFacture(12, 1000, 'lf');
  assert.equal(f.tirs, Math.ceil(100 / 12));
  assert.equal(f.m, f.tirs * 1000 * 3000);
  assert.equal(f.c, f.tirs * 1000 * 1000);
  assert.equal(f.recupere, (f.tirs - 1) * 1200000);
});

t('une chance nulle ne donne pas de facture', () => {
  assert.equal(app().luneFacture(0, 83, 'lf'), null);
});
```

- [ ] **Step 2 : Lancer les tests pour les voir échouer**

Run: `node test/run.js`
Expected: FAIL — `luneTir is not defined`.

- [ ] **Step 3 : Écrire les trois fonctions** dans `app.js`.

`chance` : `debris < 1e5 ? 0 : Math.min(20, debris / 1e5)`.
`luneVaisseaux` : borne `pct` dans `[1 ; 20]`, puis
`Math.ceil(pct * 1e5 / (0,3 × v))`.
`luneFacture` : `tirs = Math.ceil(100 / chance)`, et `recupere` compte les
`tirs - 1` ratés — le tir qui réussit consomme son champ de débris.

Un commentaire au-dessus de `luneTir` porte la raison du plancher dur : la
revue dit « plus de 100 000 », et afficher zéro en dessous ne peut que
sous-promettre.

- [ ] **Step 4 : Lancer les tests pour les voir passer**

Run: `node test/run.js`
Expected: PASS

- [ ] **Step 5 : Commit**

```bash
git add app.js test/run.js manifest.json
git commit -m "feat: le copilote chiffre les débris et la chance d'un tir de lune"
```

---

### Task 3 : L'estimation de ce que la défense tue

**Files:**
- Modify: `app.js` — une fonction à côté de `luneTir` (tâche 2)
- Test: `test/run.js`

**Interfaces:**
- Consumes: `DEF[k].a`, `SHIPS[k].bou` (tâche 1), `S.tech.weapons`
- Produces: `luneDefense(p, k, bouLvl)` → `{puissance, tirs, tue}`, ou `null`
  si `p.defs == null`. `tue` est en métal+cristal, directement comparable à
  `n × v` de `luneTir`.

- [ ] **Step 1 : Écrire les tests qui échouent** dans `test/run.js`. Ajouter
  `'luneDefense'` aux exports.

```js
/** La défense du HQ au relevé du 24 novembre, et Armes 8.
    Les tâches 4 et 5 réemploient cette fixture. */
const HQ = s => {
  s.planets[0].defs = {rl:3077, ll:511, hl:351, ic:213, gc:51, pt:11, sd:1, ld:1};
  s.tech.weapons = 8;
};

t('la défense du HQ tue environ un millier de chasseurs légers', () => {
  const g = app(HQ), d = g.luneDefense(g.S.planets[0], 'lf', 0);
  assert.equal(d.tirs, 4215);
  assert.ok(d.puissance > 700000 && d.puissance < 715000);
  assert.ok(d.tue / 4000 > 950 && d.tue / 4000 < 1050);
});

t('le niveau de Bouclier du camarade baisse ce qui est tué', () => {
  const g = app(HQ), p = g.S.planets[0];
  assert.ok(g.luneDefense(p, 'lf', 8).tue < g.luneDefense(p, 'lf', 0).tue);
});

t('une défense jamais relevée ne rend aucun verdict', () => {
  const g = app(s => { s.planets[0].defs = null; });
  assert.equal(g.luneDefense(g.S.planets[0], 'lf', 0), null);
});

t('une défense rasée rend un verdict franc, pas un inconnu', () => {
  const g = app(s => { s.planets[0].defs = {}; });
  const d = g.luneDefense(g.S.planets[0], 'lf', 0);
  assert.notEqual(d, null);
  assert.equal(d.tue, 0);
});
```

- [ ] **Step 2 : Lancer les tests pour les voir échouer**

Run: `node test/run.js`
Expected: FAIL — `luneDefense is not defined`.

- [ ] **Step 3 : Écrire `luneDefense(p, k, bouLvl)`** dans `app.js` :

```
puissance = Σ(p.defs[j] × DEF[j].a) × (1 + 0,05 × S.tech.weapons)
tirs      = Σ(p.defs[j])
tue       = max(0, 6 × puissance − 6 × tirs × SHIPS[k].bou × (1 + 0,05 × bouLvl))
```

Les clés se lisent sur `DEF`, pas sur `p.defs`, pour qu'une clé inconnue
venue du stockage ne compte pour rien.

Un commentaire dit les deux écarts assumés, et dans quel sens chacun tire :
la règle d'explosion sous 70 % de coque n'est pas comptée, ce qui sous-estime ;
le rebond d'un tir sous 1 % du bouclier ne l'est pas non plus, ce qui
surestime — sans portée ici, où le plus faible des tirs vaut 80.

- [ ] **Step 4 : Lancer les tests pour les voir passer**

Run: `node test/run.js`
Expected: PASS

- [ ] **Step 5 : Commit**

```bash
git add app.js test/run.js manifest.json
git commit -m "feat: le copilote estime ce qu'une défense tue en six manches"
```

---

### Task 4 : La carte dans Outils

**Files:**
- Modify: `app.js:4202` — `TOOLS` gagne `['moon','Lune']`
- Modify: `app.js:95` — `sample()` gagne `moonCalc`
- Modify: `app.js:4285` — `VIEWS` gagne `moon()`
- Modify: `app.js:4720` — `REFRESH` gagne `moon()`
- Modify: `app.js:4834` — `bind` gagne `[data-mc]`
- Test: `test/run.js`

**Interfaces:**
- Consumes: `luneTir`, `luneVaisseaux`, `luneFacture` (tâche 2), `luneDefense`
  (tâche 3), `gauge` (`app.js:4551`), `shipStats`, `planetById`, `centreIndex`
- Produces: `S.moonCalc` → `{pid, ship, n, bou, viser}`. La vue sort les
  identifiants `moonOut` (les jauges) et `moonNote` (la note).

- [ ] **Step 1 : Écrire les tests qui échouent** dans `test/run.js`. Ajouter
  `'VIEWS'` et `'REFRESH'` s'ils n'y sont pas déjà.

```js
t('l\'onglet Lune sort les débris, la chance et ce que la défense tue', () => {
  const g = app(s => { HQ(s); s.ui.tool = 'moon';
    s.moonCalc = {pid: s.planets[0].id, ship:'lf', n:1000, bou:0, viser:12}; });
  assert.ok(/Lune/.test(lu(g.VIEWS.tools())));
  g.REFRESH.moon();
  const out = lu(g.html().moonOut || '');
  assert.ok(/12/.test(out), out);
  assert.ok(/1 200 000|1 200 k|1,2 M/.test(out), out);
});

t('sans vaisseau, la carte ne sort aucun chiffre et le dit', () => {
  const g = app(s => { HQ(s); s.ui.tool = 'moon';
    s.moonCalc = {pid: s.planets[0].id, ship:'lf', n:0, bou:0, viser:12}; });
  g.REFRESH.moon();
  assert.ok(/combien/i.test(lu(g.html().moonOut || '')));
});
```

- [ ] **Step 2 : Lancer les tests pour les voir échouer**

Run: `node test/run.js`
Expected: FAIL — `REFRESH.moon is not a function`.

- [ ] **Step 3 : Écrire la vue, le rafraîchissement et la liaison.**

`VIEWS.moon()` suit `fleet()` : un `<select>` de planètes sur le patron de
`coFrom` (`app.js:4458`, `data-mc="pid"`), un `<select>` sur `SHIPS`, un nombre,
un nombre pour le Bouclier du camarade, un nombre pour la chance visée, puis
`<div class="res" id="moonOut">` et `<p class="note" id="moonNote">`.

`REFRESH.moon()` pose quatre `gauge()` — débris, chance, ce que la défense tue,
voyages de recycleur — et la ligne inverse « tu visais plutôt X % → N
vaisseaux ». Les voyages :
`ceil(debris / ((p.ships.rec || 0) × shipStats('rec').cargoEff))`, et rien
affiché sans recycleur au sol.

`bind` gagne une ligne sur `[data-mc]`, copiée de celle de `[data-fc]`
(`app.js:4834`) : les nombres passent par `parseInt`, le reste par `trim`.

Un commentaire `ponytail:` au-dessus du `<select>` de vaisseau dit le plafond
que la spec assume : un seul type à la fois, et une flotte mélangée
demanderait la grille de quatorze champs de la carte Flotte.

- [ ] **Step 4 : Lancer les tests pour les voir passer**

Run: `node test/run.js`
Expected: PASS

- [ ] **Step 5 : Commit**

```bash
git add app.js test/run.js manifest.json
git commit -m "feat: un onglet Lune dans Outils chiffre le tir avant qu'il parte"
```

---

### Task 5 : Les avertissements et la note

**Files:**
- Modify: `app.js` — `luneFlotteAuSol` à côté de `luneDefense`, et `REFRESH.moon`
- Test: `test/run.js`

**Interfaces:**
- Consumes: `p.ships`, `SHIP_COST` (tâche 1), `luneTir` (tâche 2)
- Produces: `luneFlotteAuSol(p)` → `{m, c}`, ou `null` si `p.ships` est absent.

- [ ] **Step 1 : Écrire les tests qui échouent** dans `test/run.js`. Ajouter
  `'luneFlotteAuSol'` aux exports.

```js
t('la flotte au sol est chiffrée pour l\'avertissement', () => {
  const g = app(s => { s.planets[0].ships = {lf:240, hf:538}; });
  assert.deepEqual(g.luneFlotteAuSol(g.S.planets[0]),
    {m: 240*3000 + 538*6000, c: 240*1000 + 538*4000});
});

t('une flotte jamais relevée n\'invente pas un zéro', () => {
  const g = app(s => { delete s.planets[0].ships; });
  assert.equal(g.luneFlotteAuSol(g.S.planets[0]), null);
});

t('la carte avertit sous le plancher, au-dessus du plafond, et pour la flotte au sol', () => {
  const g = app(s => { HQ(s); s.ui.tool = 'moon'; s.planets[0].ships = {hf:538};
    s.moonCalc = {pid: s.planets[0].id, ship:'lf', n:83, bou:0, viser:12}; });
  g.REFRESH.moon();
  const note = lu(g.html().moonNote || '');
  assert.ok(/100 000/.test(note), note);
  assert.ok(/538/.test(note), note);
  assert.ok(/Estimation/.test(note), note);
  assert.ok(/ne connaît pas les lunes|déjà une/.test(note), note);
});

t('au-dessus du plafond, la carte dit ce qui est perdu', () => {
  const g = app(s => { HQ(s); s.ui.tool = 'moon';
    s.moonCalc = {pid: s.planets[0].id, ship:'lf', n:3000, bou:0, viser:12}; });
  g.REFRESH.moon();
  assert.ok(/perdu|suffi/.test(lu(g.html().moonNote || '')));
});
```

- [ ] **Step 2 : Lancer les tests pour les voir échouer**

Run: `node test/run.js`
Expected: FAIL — `luneFlotteAuSol is not defined`.

- [ ] **Step 3 : Écrire `luneFlotteAuSol` et compléter `moonNote`.**

La note porte, dans cet ordre : la facture espérée (`luneFacture`), puis les
avertissements qui s'appliquent — sous le plancher, au-dessus du plafond, la
flotte au sol —, puis **Estimation** en gras sur le patron de `expoNote`
(`app.js:4727`), avec la linéarité, les deux seuils, et la phrase que la spec
fixe : le copilote ne connaît pas les lunes, donc il ne peut pas savoir si la
position en porte déjà une.

- [ ] **Step 4 : Lancer les tests pour les voir passer**

Run: `node test/run.js`
Expected: PASS

- [ ] **Step 5 : Commit**

```bash
git add app.js test/run.js manifest.json
git commit -m "feat: la carte Lune avertit des seuils et de la flotte au sol"
```
