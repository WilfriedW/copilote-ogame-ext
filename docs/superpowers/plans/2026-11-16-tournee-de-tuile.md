# Barre de tournée — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Depuis une page à tuiles du jeu, atteindre la même tuile sur une
autre planète en un clic, la tuile déjà ouverte à l'arrivée.

**Architecture:** Le panneau publie dans `skin` un relevé par planète (nom,
niveaux, coût du niveau suivant, fin de file, stock). Le script de page lit la
tuile en main — `openTech` de l'URL, sinon la dernière tuile cliquée — et pose
au-dessus de la liste des tuiles une barre de liens
`component=<courant>&cp=<gid>&openTech=<tuile>`. Aucun clic, aucune écriture
dans la page du jeu.

**Tech Stack:** JavaScript sans dépendance, extension Chrome MV3. Tests :
`node test/run.js`, faux DOM maison (`test/page.js`), pas de framework.

**Spec:** `docs/superpowers/specs/2026-11-16-tournee-de-tuile-design.md`

## Global Constraints

- Un lien, pas un robot : rien n'est cliqué ni écrit dans la page du jeu
  (`app.js:217`).
- Une planète sans `gid` n'a pas de pastille (`app.js:283`).
- Niveau inconnu → pastille sans niveau, jamais un niveau 0.
- Une pastille grisée reste un lien.
- La barre s'efface si aucune tuile n'est en main, ou si moins de deux planètes
  portent cette tuile.
- Tout nouveau sélecteur de `content.js` demande sa route dans `test/page.js` :
  le faux DOM lève sur un sélecteur inconnu.
- Commits en français, sujet à l'intention, corps expliquant le pourquoi,
  terminés par `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## Review Focus

| Entrée que la spec n'exerce pas | Comportement attendu | Tâche |
| --- | --- | --- |
| `openTech` inconnu ou absurde (`9e9`, `__proto__`) | aucune barre, aucune exception | 2 |
| `skin.tour` absent ou vide (panneau jamais ouvert) | aucune barre, aucune exception | 2 |
| clé de planète hostile dans `tour` (`__proto__`) | ignorée, comme `applyGame` le fait pour `S.prod` (`app.js:3173`) | 1 |
| le jeu refait sa liste de tuiles (secousse) | la barre ne se duplique pas | 2 |
| coût inconnu (forme de vie jamais ouverte) | pas d'état « stock court » plutôt qu'un manque faux | 4 |

---

### Task 1 : Le panneau publie la tournée

**Files:**
- Modify: `app.js` — nouvelle fonction à côté de `planHints` (`app.js:445`), appel dans `gameSkin` (`app.js:512`)
- Test: `test/run.js`

**Interfaces:**
- Consumes: `S.planets`, `S.timers`, `BUILD_ID`, `B`, `levelCost`, `lfCost`, `planetRef`, `stockNow`
- Produces: `tourData()` → `{ [gid]: { n, b: {[tuile]: niveau}, cost: {[tuile]: [m,c,d]}, bq, lfq, st: [m,c,d] } }`, publié par `gameSkin()` sous la clé `tour`. `bq`/`lfq` : fin de file en millisecondes, `0` si libre.

- [ ] **Step 1 : Écrire les tests qui échouent** dans `test/run.js`, après les tests de `gameSkin`. Ajouter `'tourData'` à la liste d'exports de `app()`.

```js
/** Deux planètes nommées par le jeu, chantier 4 et 0. */
const nommees = s => { s.planets[0].gid = '101'; s.planets[1].gid = '102'; };

t('la tournée donne le nom, le niveau et le coût du niveau suivant', () => {
  const g = app(nommees);
  const t1 = g.tourData();
  assert.equal(t1['101'].n, 'Planète mère');
  assert.equal(t1['101'].b['21'], 4);            // chantier spatial
  assert.deepEqual(t1['101'].cost['21'], g.levelCost(g.B.shipyard, 5));
  assert.equal(t1['102'].b['21'], 0);
});

t('une planète que le jeu n\'a pas nommée est absente', () => {
  assert.deepEqual(Object.keys(app(s => { s.planets[0].gid = '101'; }).tourData()), ['101']);
});

t('la fin de file de bâtiment est publiée, par planète', () => {
  const g = app(s => { nommees(s); s.timers = [
    { id: 'a', game: true, queue: 'building', kind: 'b', pid: 'mere', end: SOIR + 600000 },
    { id: 'b', game: true, queue: 'lfbuilding', kind: 'x', pid: 'colo', end: SOIR + 900000 }
  ]; });
  const t1 = g.tourData();
  assert.equal(t1['101'].bq, SOIR + 600000);
  assert.equal(t1['101'].lfq, 0);
  assert.equal(t1['102'].lfq, SOIR + 900000);
});

t('une clé de planète hostile ne crée pas de pastille', () => {
  const g = app(s => { nommees(s); s.planets[1].gid = '__proto__'; });
  assert.deepEqual(Object.keys(g.tourData()), ['101']);
});

t('la tournée voyage dans le skin', () => {
  assert.ok(app(nommees).gameSkin([]).tour['101']);
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `node test/run.js`
Attendu : ÉCHEC, `g.tourData is not a function`.

- [ ] **Step 3 : Écrire `tourData()` dans `app.js`**

Une entrée par planète dont le `gid` est une suite de chiffres (`/^\d+$/`, le
même garde que `app.js:3173`). `b` et `cost` couvrent les clés de `B` qui ont un
`BUILD_ID` — `crawl` n'en a pas — puis les bâtiments de forme de vie de `p.lf`
(niveau `v.lvl || 0`, coût `lfCost(v, niveau+1)`, omis quand il rend `null`).
`bq` et `lfq` : la plus grande fin des minuteurs non terminés de `S.timers` dont
`queue` vaut `'building'` ou `'lfbuilding'` et `pid` la planète. `st` :
`stockNow(p)` arrondi. Publier `tour: tourData()` dans `gameSkin()`.

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

Run: `node test/run.js`
Attendu : « N vérifications passées ».

- [ ] **Step 5 : Commit**

```bash
git add app.js test/run.js
git commit
```
Sujet : `feat: le panneau publie les niveaux de toutes les planètes`.

---

### Task 2 : La barre, à l'arrivée par un lien

**Files:**
- Modify: `content.js` — `paint()` (`content.js:395`) et le bloc `STYLE` (`content.js:385`)
- Modify: `test/page.js` — faux DOM
- Test: `test/run.js`

**Interfaces:**
- Consumes: `skin.tour` de la tâche 1.
- Produces: un `<div class="copilote-tour">` d'`<a class="copilote-pin">`, posé avant le `ul` qui porte la première `li.technology[data-technology]`. `runPage` gagne les options `search` et `tiles`, et son relevé gagne `tour: [{txt, href, courante, grisee}]`.

- [ ] **Step 1 : Outiller le faux DOM** (`test/page.js`)

`runPage` accepte `search` (défaut inchangé) et `tiles` (défaut `[]`, liste
d'identifiants de tuiles) : les tuiles deviennent des `li.technology` enfants
d'un `ul` ajouté au `body`, et la route `li.technology[data-technology]` les
rend. Ajouter la route `.copilote-tour`. `el()` gagne `closest(sel)`, qui
remonte `parent` et ne connaît que `li.technology[data-technology]`. `document`
retient les écouteurs de `addEventListener` ; `runPage` rend
`clic: id => handler({ target: <la tuile> })`. `read()` gagne `tour`.

- [ ] **Step 2 : Écrire les tests qui échouent** dans `test/run.js`, après les tests de la surcouche

```js
const TOUR = { hints: {}, rates: {}, lean: false, tour: {
  '33657643': { n: 'Planète mère', b: { '21': 4 }, cost: {}, bq: 0, lfq: 0, st: [0, 0, 0] },
  '102': { n: 'Colonie', b: { '21': 2 }, cost: {}, bq: 0, lfq: 0, st: [0, 0, 0] },
  '103': { n: 'Lune bleue', b: {}, cost: {}, bq: 0, lfq: 0, st: [0, 0, 0] }
} };
const ARRIVEE = { skin: TOUR, tiles: ['21'], search: '?page=ingame&component=facilities&openTech=21' };

t('la barre liste les planètes et ouvre la même tuile ailleurs', () => {
  const r = runPage(ARRIVEE).tour;
  assert.equal(r.length, 3);
  assert.equal(r[1].txt, 'Colonie · 2 → 3');
  assert.equal(r[1].href, '/game/index.php?page=ingame&component=facilities&cp=102&openTech=21');
});

t('la planète courante est marquée et n\'est pas un lien', () => {
  const r = runPage(ARRIVEE).tour;
  assert.equal(r[0].courante, true);
  assert.equal(r[0].href, null);
});

t('un niveau inconnu se dit, et ne s\'invente pas', () => {
  assert.equal(runPage(ARRIVEE).tour[2].txt, 'Lune bleue · →');
});

t('sans tuile en main, pas de barre', () => {
  assert.deepEqual(runPage({ ...ARRIVEE, search: '?page=ingame&component=facilities' }).tour, []);
});

t('une tuile inconnue ou absurde ne produit pas de barre', () => {
  for (const q of ['openTech=9e9', 'openTech=__proto__', 'openTech=999']) {
    assert.deepEqual(runPage({ ...ARRIVEE, search: '?page=ingame&component=facilities&' + q }).tour, []);
  }
});

t('une recherche n\'ouvre pas de tournée : une seule file pour l\'empire', () => {
  const r = runPage({ ...ARRIVEE, tiles: ['124'], search: '?page=ingame&component=research&openTech=124' });
  assert.deepEqual(r.tour, []);
});

t('sans tournée publiée, pas de barre', () => {
  assert.deepEqual(runPage({ ...ARRIVEE, skin: { hints: {}, rates: {}, lean: false } }).tour, []);
});

t('seule à porter la tuile, une planète n\'ouvre pas de tournée', () => {
  const seule = { ...TOUR, tour: { '33657643': TOUR.tour['33657643'] } };
  assert.deepEqual(runPage({ ...ARRIVEE, skin: seule }).tour, []);
});

t('une secousse de la page ne duplique pas la barre', () => {
  const p = runPage(ARRIVEE);
  p.secousse();
  assert.equal(p.read().tour.length, 3);
});
```

- [ ] **Step 3 : Poser la barre dans `paint()`** (`content.js`)

La tuile en main vient d'`openTech` de `location.search`, retenue seulement si
`/^\d+$/` la valide et si **au moins deux entrées de `skin.tour` connaissent son
niveau** — c'est ce seuil qui écarte les recherches et les vaisseaux, dont
aucune planète ne porte le niveau, sans avoir à lister les pages interdites. Composant : celui de `location.search`. Une pastille par
entrée de `tour` dont la clé est `/^\d+$/`, dans l'ordre de l'objet, texte
`<nom> · <niveau> → <niveau+1>` ou `<nom> · →` si le niveau manque, `href`
`location.pathname + '?page=ingame&component=<comp>&cp=<gid>&openTech=<tuile>'`
sauf pour la planète courante (`meta('planet-id')`), qui porte la classe
`copilote-ici`. La barre se refait entière quand son contenu change, à la
manière du `dataset.cle` de `paintEta` (`content.js:371`). Style dans `STYLE` :
même bleu `#8aa9ff` que `copilote-tag`.

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

Run: `node test/run.js`
Attendu : « N vérifications passées ».

- [ ] **Step 5 : Commit**

```bash
git add content.js test/page.js test/run.js
git commit
```
Sujet : `feat: la même tuile sur la planète suivante, en un clic`.

---

### Task 3 : La barre, sur la première planète

**Files:**
- Modify: `content.js`
- Test: `test/run.js`

**Interfaces:**
- Consumes: le `clic` du faux DOM et la barre de la tâche 2.
- Produces: rien de nouveau ; la tuile en main a désormais une seconde source.

- [ ] **Step 1 : Écrire les tests qui échouent**

```js
const DEPART = { skin: TOUR, tiles: ['21', '1'], search: '?page=ingame&component=facilities' };

t('ouvrir une tuile ouvre la tournée', () => {
  const p = runPage(DEPART);
  assert.deepEqual(p.read().tour, []);
  p.clic('21');
  assert.equal(p.read().tour.length, 3);
});

t('ouvrir une autre tuile change de tournée', () => {
  const p = runPage(DEPART);
  p.clic('21'); p.clic('1');
  assert.deepEqual(p.read().tour, []);   // personne n'a de niveau pour la tuile 1
});

t('openTech l\'emporte sur un clic plus ancien', () => {
  const p = runPage({ ...DEPART, search: '?page=ingame&component=facilities&openTech=21' });
  p.clic('1');
  assert.equal(p.read().tour.length, 3);
});
```

Le troisième test fixe l'ordre : `openTech` est le départ de la tournée en
cours, un clic ne le renverse pas. _(À l'implémentation : si cet ordre gêne à
l'usage, c'est ce test qu'il faut discuter, pas contourner.)_

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `node test/run.js`
Attendu : ÉCHEC, la barre reste vide après `clic`.

- [ ] **Step 3 : Écouter les clics de tuiles** (`content.js`)

Un seul écouteur sur `document`, par délégation — la liste des tuiles est
refaite par le jeu, un écouteur par tuile mourrait avec elle. Il lit
`e.target.closest('li.technology[data-technology]')`, retient l'identifiant
dans une variable du module, puis `paint()`. Rien n'est écrit dans la page.

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

Run: `node test/run.js`
Attendu : « N vérifications passées ».

- [ ] **Step 5 : Commit**

```bash
git add content.js test/run.js
git commit
```
Sujet : `feat: la tuile ouverte lance la tournée`.

---

### Task 4 : Ce qu'une pastille dit d'une planète

**Files:**
- Modify: `content.js`
- Test: `test/run.js`

**Interfaces:**
- Consumes: `bq`, `lfq`, `cost`, `st` de la tâche 1 ; la barre des tâches 2 et 3.
- Produces: la classe `copilote-gris` et le texte d'état des pastilles.

- [ ] **Step 1 : Écrire les tests qui échouent**

```js
const occupee = { ...TOUR, tour: { ...TOUR.tour,
  '102': { ...TOUR.tour['102'], bq: Date.now() + 3600000 } } };
const pauvre = { ...TOUR, tour: { ...TOUR.tour,
  '102': { ...TOUR.tour['102'], cost: { '21': [1000, 500, 0] }, st: [400, 500, 0] } } };

t('une file occupée se dit, avec son heure de fin', () => {
  const r = runPage({ ...ARRIVEE, skin: occupee }).tour[1];
  assert.equal(r.grisee, true);
  assert.ok(/file jusqu'à \d\d:\d\d/.test(r.txt), r.txt);
  assert.ok(r.href, 'grisée mais cliquable');
});

t('un stock trop court nomme ce qui manque', () => {
  const r = runPage({ ...ARRIVEE, skin: pauvre }).tour[1];
  assert.equal(r.grisee, true);
  assert.ok(/manque 600 métal/.test(r.txt), r.txt);
});

t('un coût inconnu ne fait pas manquer', () => {
  const r = runPage({ ...ARRIVEE, skin: TOUR }).tour[1];
  assert.equal(r.grisee, false);
  assert.ok(!/manque/.test(r.txt), r.txt);
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `node test/run.js`
Attendu : ÉCHEC, `grisee` toujours `false`.

- [ ] **Step 3 : Ajouter les états** (`content.js`)

Pour la tuile en main : file occupée si `bq` (ou `lfq` au-delà de 11000)
dépasse l'instant courant — texte `file jusqu'à hh:mm`, même format que
l'existant. Stock court si `cost[tuile]` existe et qu'une ressource de `st` ne
la couvre pas — texte `manque <montant> <ressource>`, la plus grosse manquante
seulement, `RES_NOMS` et `qte` existent déjà (`content.js:270`). Les deux états
posent `copilote-gris` (opacité réduite dans `STYLE`) et laissent le lien.

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

Run: `node test/run.js`
Attendu : « N vérifications passées ».

- [ ] **Step 5 : Commit**

```bash
git add content.js test/run.js
git commit
```
Sujet : `feat: une pastille dit si la planète peut payer et si sa file est libre`.
