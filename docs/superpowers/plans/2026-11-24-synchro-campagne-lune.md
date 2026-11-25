# Synchro de la campagne de lune — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que l'heure d'impact, le compteur de tirs, la dette et la planète
visée suivent le joueur d'un poste à l'autre, sans jamais désigner une planète
que le poste d'arrivée ne connaît pas.

**Architecture:** Deux fonctions sur le patron exact de `prioOut` / `prioIn`
(`app.js:5916`), qui traduisent les identifiants de planète en identifiants de
jeu et retour, et deux lignes d'accroche dans `syncOut` / `syncApply`. `lune`
ne retourne pas dans `SYNC_KEYS` : le paquet se compose à la main, comme `prio`
et `centre`.

**Tech Stack:** JavaScript sans dépendance, extension Chrome MV3. Tests :
`node test/run.js`, faux DOM maison, pas de framework.

**Spec:** `docs/superpowers/specs/2026-11-24-synchro-campagne-lune-design.md`

## Global Constraints

- **`gidDe(pid)` rend `null`** pour une planète que le jeu n'a pas encore
  nommée ; **`pidDe(gid)` rend `null`** pour une planète que ce poste n'a pas
  relevée (`app.js:5786-5787`).
- **Le paquet n'est envoyé que si toutes les planètes qu'il nomme ont un gid**,
  la même garde que `sy:prio` (`app.js:5942`).
- **Si la planète visée ne se résout pas à l'arrivée, rien n'est appliqué.**
- **Une entrée de `tirs` dont le gid ne se résout pas est laissée de côté**, pas
  devinée et pas effacée chez l'émetteur.
- `syncApply` compare au JSON avant d'écrire (`app.js:5967`) : un paquet
  identique ne provoque aucun rendu.
- `lune` reste **hors** de `SYNC_KEYS`.
- Commits en français, sujet à l'intention, corps expliquant le pourquoi,
  terminés par `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Version à incrémenter dans `manifest.json` et `app.js` à chaque commit.

## Review Focus

| Entrée que la spec n'exerce pas | Comportement attendu | Tâche |
| --- | --- | --- |
| aucune planète relevée ici n'a de gid (poste neuf) | `luneOut()` rend `undefined`, rien ne part, rien ne lève | 1 |
| le paquet reçu est celui qu'on vient d'écrire | aucun changement, aucun rendu | 2 |
| `tirs` porte un gid inconnu ici, à côté d'un gid connu | le connu s'applique, l'inconnu est laissé de côté | 2 |
| un paquet sans `cible` (campagne jamais ciblée) | rien n'est appliqué, et rien ne lève | 2 |
| deux planètes partagent un gid (relevé abîmé) | la traduction ne boucle pas et ne lève pas | 1 |

---

### Task 1 : `luneOut()`, la campagne qui part

**Files:**
- Modify: `app.js` — nouvelle fonction à côté de `prioOut` (`app.js:5916`)
- Modify: `app.js:5942` — `syncOut` pose `sy:lune`
- Test: `test/run.js`

**Interfaces:**
- Consumes: `gidDe(pid)`, `S.lune`, `S.moonCalc`
- Produces: `luneOut()` → `{on, impact, rendu, tirs:{[gid]:n}, cible, n, ship,
  bou, viser}` ou `undefined` quand une planète nommée n'a pas de gid.

- [ ] **Step 1 : Écrire les tests qui échouent.** Ajouter `'luneOut'` et
  `'gidDe'` aux exports de `app()`.

```js
/** Deux planètes que le jeu nomme, et une campagne en cours sur la première. */
const CAMPAGNE = s => {
  s.planets[0].gid = '101'; s.planets[1].gid = '102';
  s.moonCalc = { pid: s.planets[0].id, ship: 'lf', n: 900, bou: 12, viser: 12 };
  s.lune = { on: true, impact: 1795600000000, tirs: { [s.planets[0].id]: 5 },
             rendu: { coords: '1:140:8', n: 900, dus: 9, faits: 3 } };
};

t('la campagne part avec des identifiants de jeu, pas des identifiants locaux', () => {
  const g = app(CAMPAGNE), p = g.luneOut();
  assert.equal(p.cible, '101');
  assert.deepEqual(p.tirs, { '101': 5 });
  assert.equal(p.impact, 1795600000000);
  assert.equal(p.on, true);
  assert.equal(p.n, 900);
  assert.equal(p.rendu.faits, 3);
});

t('une planète que le jeu ne nomme pas retient tout le paquet', () => {
  const g = app(s => { CAMPAGNE(s); delete s.planets[0].gid; });
  assert.equal(g.luneOut(), undefined, 'mieux vaut ne rien envoyer qu\'un paquet à moitié traduit');
});

t('un poste neuf, sans aucun identifiant de jeu, n\'envoie rien et ne lève pas', () => {
  const g = app(s => { CAMPAGNE(s); delete s.planets[0].gid; delete s.planets[1].gid; });
  assert.equal(g.luneOut(), undefined);
});

t('deux planètes au même identifiant de jeu ne perdent pas le compteur', () => {
  /* Un relevé abîmé peut donner le même gid à deux planètes ; `pidDe` rend
     alors la première. La traduction ne doit ni lever ni écraser en silence. */
  const g = app(s => { CAMPAGNE(s); s.planets[1].gid = '101';
    s.lune.tirs[s.planets[1].id] = 2; });
  const p = g.luneOut();
  assert.equal(Object.keys(p.tirs).length, 1, 'les deux se rangent sous le même gid');
  assert.ok(p.tirs['101'] === 5 || p.tirs['101'] === 2, 'et l\'un des deux passe : ' + p.tirs['101']);
});

t('syncOut emporte la campagne', () => {
  const g = app(CAMPAGNE);
  assert.equal(g.syncOut()['sy:lune'].cible, '101');
});
```

- [ ] **Step 2 : Lancer les tests pour les voir échouer**

Run: `node test/run.js`
Expected: FAIL — `luneOut is not defined`.

- [ ] **Step 3 : Écrire `luneOut()`** à côté de `prioOut`, et la poser dans
  `syncOut` à côté de `sy:prio` et `sy:centre`.

La garde est celle de `sy:prio` : si `gidDe` rend `null` pour la planète visée
ou pour une clé de `tirs`, la fonction rend `undefined` et rien n'est envoyé.
Un paquet à moitié traduit serait lu de travers par l'autre poste, ce qui est
le défaut que ce document répare.

- [ ] **Step 4 : Lancer les tests pour les voir passer**

Run: `node test/run.js`
Expected: PASS

- [ ] **Step 5 : Commit**

```bash
git add app.js test/run.js manifest.json
git commit -m "feat: la campagne de lune part avec les identifiants du jeu"
```

---

### Task 2 : `luneIn()`, la campagne qui arrive

**Files:**
- Modify: `app.js` — nouvelle fonction à côté de `prioIn` (`app.js:5925`)
- Modify: `app.js:5971` — `syncApply` applique `sy:lune`
- Test: `test/run.js`

**Interfaces:**
- Consumes: `pidDe(gid)`, `luneOut()` (tâche 1)
- Produces: `luneIn(p)` → `{lune, moonCalc}` à écrire, ou `null` quand la
  planète visée ne se résout pas ici.

- [ ] **Step 1 : Écrire les tests qui échouent.** Ajouter `'luneIn'` aux
  exports.

```js
t('la campagne revient sur les identifiants de ce poste', () => {
  const g = app(CAMPAGNE), r = g.luneIn(g.luneOut());
  assert.equal(r.moonCalc.pid, g.S.planets[0].id);
  assert.deepEqual(r.lune.tirs, { [g.S.planets[0].id]: 5 });
  assert.equal(r.lune.impact, 1795600000000);
});

t('une cible que ce poste ne connaît pas n\'écrit rien', () => {
  const g = app(CAMPAGNE);
  assert.equal(g.luneIn({ cible: '999', tirs: {}, on: true, impact: 1, rendu: {} }), null,
    'c\'est ce qui faisait évacuer la mauvaise planète');
});

t('un paquet sans cible n\'écrit rien et ne lève pas', () => {
  assert.equal(app(CAMPAGNE).luneIn({ tirs: {}, on: true }), null);
  assert.equal(app(CAMPAGNE).luneIn(null), null);
});

t('un compteur venu d\'une planète inconnue ici est laissé de côté', () => {
  const g = app(CAMPAGNE);
  const p = g.luneOut(); p.tirs['999'] = 7;
  const r = g.luneIn(p);
  assert.deepEqual(r.lune.tirs, { [g.S.planets[0].id]: 5 }, 'le connu passe, l\'inconnu attend');
});

t('le paquet qu\'on vient d\'écrire ne change rien', () => {
  const g = app(CAMPAGNE);
  const avant = JSON.stringify(g.S.lune) + JSON.stringify(g.S.moonCalc);
  g.syncApply(g.syncOut());
  assert.equal(JSON.stringify(g.S.lune) + JSON.stringify(g.S.moonCalc), avant);
});

t('une campagne reçue remplace celle d\'ici', () => {
  const g = app(s => { CAMPAGNE(s); s.lune.tirs = {}; s.lune.impact = null; });
  g.syncApply({ 'sy:lune': { on: true, impact: 1795600000000, cible: '101',
    tirs: { '101': 5 }, rendu: { coords: '1:140:8', n: 900, dus: 9, faits: 3 },
    n: 900, ship: 'lf', bou: 12, viser: 12 } });
  assert.equal(g.S.lune.impact, 1795600000000);
  assert.equal(g.S.lune.tirs[g.S.planets[0].id], 5);
  assert.equal(g.S.moonCalc.pid, g.S.planets[0].id);
});
```

- [ ] **Step 2 : Lancer les tests pour les voir échouer**

Run: `node test/run.js`
Expected: FAIL — `luneIn is not defined`.

- [ ] **Step 3 : Écrire `luneIn(p)`** à côté de `prioIn`, et l'accrocher dans
  `syncApply` après `sainEtat()`, sur le patron de la ligne du centre
  (`app.js:5971`) : n'écrire que si quelque chose change, et poser `chg`.

`luneIn` rend `null` dès que `p` est absent, sans `cible`, ou que `pidDe(cible)`
ne résout pas. Les clés de `tirs` qui ne résolvent pas sont ignorées, comme
`prioIn` laisse attendre une entrée dont la planète n'est pas encore relevée.

- [ ] **Step 4 : Lancer les tests pour les voir passer**

Run: `node test/run.js`
Expected: PASS

- [ ] **Step 5 : Commit**

```bash
git add app.js test/run.js manifest.json
git commit -m "feat: la campagne de lune arrive sur les identifiants du poste"
```

---

### Task 3 : La documentation

**Files:**
- Modify: `docs/comment-ca-marche.md` — la section 6.10, qui dit le contraire

- [ ] **Step 1 : Corriger le paragraphe** qui annonce que rien ne voyage. Dire
  ce qui voyage, ce qui est traduit, et la règle d'arrivée : une campagne qui
  nomme une planète inconnue ici n'est pas appliquée.

- [ ] **Step 2 : Commit**

```bash
git add docs/comment-ca-marche.md app.js manifest.json
git commit -m "docs: la campagne de lune suit d'un poste à l'autre"
```
