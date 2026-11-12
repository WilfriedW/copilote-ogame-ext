# Aujourd'hui porte tout — plan de mise en œuvre

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réparer le compte des foreuses, montrer au joueur où il en est
dans le début de partie et combien de foreuses lui servent, puis retirer
`adviceList()` sans perdre un seul avertissement.

**Architecture:** Quatre changements indépendants dans `app.js`, le
fichier unique du panneau. Le moteur (`simulateDay`) gagne une passe
d'alerte par planète qui ne dépend d'aucune file ; `REFRESH.today` cesse
d'appeler un second moteur ; `REFRESH.planets` gagne une pastille. Aucun
nouveau genre de carte, aucun nouveau fichier.

**Tech Stack:** JavaScript sans dépendance, script classique chargé par
`sidepanel.html`. Tests `node test/run.js`, sans framework, `assert` de
Node.

**Spec:** `docs/superpowers/specs/2026-11-12-aujourdhui-porte-tout-design.md`

## Global Constraints

- `app.js` est un script classique : pas de `import`/`export`, pas de
  dépendance, pas d'outil de construction.
- Tests : `node test/run.js`, tout doit passer à chaque tâche. Un test
  s'écrit `t('nom en français', () => { ... })` et charge l'application
  par `app(modifier, now, api, ext)`. Une fonction n'est visible du test
  que si son nom figure dans la liste `want` de `test/run.js:24`.
- Le rendu se lit par `g.html()`, qui renvoie un objet indexé par
  identifiant d'élément (`g.html().tdNow`, `g.html()['pres-0']`).
- Tout texte visible est en français, au tutoiement.
- Le panneau n'ouvre que des pages du jeu : aucun formulaire rempli,
  aucune action lancée à la place du joueur (`app.js:164`).
- Messages de commit : sujet en français **sans accents**, en minuscules,
  préfixé `feat:` ou `fix:` ou `refactor:`. Corps en français avec
  accents. Chaque commit se termine par
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## Review Focus

Cinq cas que la conception implique sans qu'aucune tâche ne les teste
d'elle-même. Chacun est ajouté aux tests de la tâche qui porte le code.

1. **Plusieurs planètes** — une alerte doit nommer sa planète.
   `adviceList()` le faisait par ` sur ${p.name}` (`app.js:676`) ; la
   nouvelle passe doit le faire aussi, sans quoi le joueur à quatre
   planètes ne sait plus laquelle déborde. → Tâche 4.
2. **Ressource à production nulle** — le seuil « plein dans 8 h » divise
   par le débit. `adviceList()` garde `rate>0` (`app.js:684`) ; sans ce
   garde, une planète sans synthétiseur donne une division par zéro.
   → Tâche 4.
3. **Les onze jalons franchis** — le bloc de progression doit disparaître
   entièrement, pas afficher `11 / 11`. → Tâche 3.
4. **Jalons franchis dans le désordre** — on peut tenir *Astro 1* sans
   *Ordinateur 2*. Le compte est le nombre franchi, jamais l'indice du
   suivant. → Tâche 3.
5. **L'alerte « file vide » déplacée** — elle porte un garde
   `importFresh` (`app.js:712`) qui la tait dès que la lecture de
   l'extension est plus fraîche que l'import manuel. Le garde doit
   voyager avec elle, sinon un vieil import ressort après chaque
   synchro. → Tâche 4.

---

### Task 1 : les foreuses construites comptent

La boucle du chantier propose déjà les foreuses (`app.js:1426-1427`).
Deux endroits créditent `p.ships.crawl`, que rien ne lit, au lieu de
`p.crawlers`, que lit `production()` (`app.js:516`) et `rankUpgrades()`
(`app.js:596`).

Le bon modèle est la lecture du jeu : `background.js:118` écrit la
foreuse (`217`) dans `cur.crawlers` **seulement** — `217` ne figure pas
dans `OG_SHIPS` (`ids.js:76`), donc le jeu ne la met jamais dans
`ships`. Le code simulé doit faire pareil.

La boucle `wants` ne produit que `'pr'`, `'crawl'`, `'lc'`/`'sc'` et
`'pf'` : seul `'crawl'` a besoin de l'aiguillage. Les satellites
solaires n'y passent pas, ils ont leur propre bloc.

**Files:**
- Modify: `app.js:1448` (événement de fin de construction simulée)
- Modify: `app.js:771` (branche `tm.k==='shipyard'` de `finishTimer`)
- Test: `test/run.js`

**Interfaces:**
- Consomme : `rankUpgrades(p)` renvoie des entrées
  `{key, n, lvl, cost, gain, payback, extraSolar}` ; `key === 'crawl'`
  pour les foreuses.
- Produit : `p.crawlers` (nombre) correctement tenu à jour par la
  simulation et par la fin d'un minuteur manuel.

- [ ] **Étape 1 : rendre `finishTimer` visible du test**

Ajouter `'finishTimer'` à la liste `want` de `test/run.js:24`.

- [ ] **Étape 2 : écrire les tests qui échouent**

```js
/* ---------- les foreuses construites comptent ---------- */

t('la fin d\'un minuteur de foreuses crédite le compte, pas la flotte', () => {
  const g = app();
  const p = g.S.planets[0];
  g.finishTimer({ kind: 'x', k: 'shipyard', p: 0, ships: { crawl: 40 }, end: SOIR });
  assert.equal(p.crawlers, 40, 'les foreuses doivent compter');
  assert.ok(!(p.ships && p.ships.crawl), 'et ne pas atterrir dans la flotte');
});

t('un minuteur lu dans le jeu ne touche pas au compte', () => {
  const g = app();
  const p = g.S.planets[0];
  p.crawlers = 120;
  g.finishTimer({ kind: 'x', k: 'shipyard', p: 0, ships: { crawl: 40 }, end: SOIR, game: true });
  assert.equal(p.crawlers, 120, 'la lecture du jeu fait foi');
});

t('les foreuses simulees entrent dans la production, et ne sont pas reproposees', () => {
  // Mines hautes : les niveaux suivants coûtent cher, les foreuses passent devant.
  const g = app(s => {
    const p = s.planets[0];
    Object.assign(p.b, { metal: 20, crystal: 18, deut: 16, solar: 26, shipyard: 6 });
    s.tech.armour = 4;
    p.stock = { m: 9e6, c: 9e6, d: 9e6, at: SOIR };
  });
  const p = g.S.planets[0];
  assert.equal(g.rankUpgrades(p)[0].key, 'crawl',
    'préalable du test : les foreuses doivent être en tête du classement');
  const plan = g.simulateDay();
  const cartes = plan.sessions.flatMap(x => x.acts).filter(a => a.ships && a.ships.crawl);
  assert.equal(cartes.length, 1, 'une seule carte de foreuses sur tout l\'horizon, pas une par connexion');
  assert.ok(plan.endV > plan.startV, 'le gain des foreuses entre dans la production');
});
```

Si `rankUpgrades(p)[0].key` n'est pas `'crawl'`, monter les niveaux de
mines jusqu'à ce qu'il le soit : l'assertion de préalable dit laquelle
tient.

`finishTimer()` appelle `save()`, `chime()`, `flashTitle()` et
`showBigAlert()`. Si l'un d'eux ne survit pas au DOM factice, la
correction est dans `test/harness.js`, pas dans `app.js` : le code de
production ne change pas pour arranger un test.

- [ ] **Étape 3 : vérifier qu'ils échouent**

Run: `node test/run.js`
Expected: les trois tests échouent — le compte reste à 0, et la carte de
foreuses revient à chaque connexion.

- [ ] **Étape 4 : implémenter l'aiguillage aux deux endroits**

Dans `app.js:1448`, l'événement de fin : quand `k === 'crawl'`, créditer
`p.crawlers` et laisser `p.ships` intact ; sinon, comportement actuel.

Dans `app.js:771`, la branche `tm.k==='shipyard'` de `finishTimer()` :
même aiguillage par clé de vaisseau, en conservant le garde `!tm.game`
qui laisse la main à la lecture du jeu.

- [ ] **Étape 5 : vérifier qu'ils passent**

Run: `node test/run.js`
Expected: tout passe, 234 tests.

- [ ] **Étape 6 : commit**

```bash
git add app.js test/run.js
git commit -m "fix: les foreuses construites comptent enfin dans la production"
```

---

### Task 2 : la pastille de foreuses dans Empire

Le compte des foreuses n'apparaît nulle part dans un écran vivant. Il
rejoint les jauges de production, sur la carte de chaque planète.

**Files:**
- Modify: `app.js:2266-2268` (`REFRESH.planets`, après les quatre jauges)
- Test: `test/run.js`

**Interfaces:**
- Consomme : `crawlerMax(metal, crystal, deut)` (`app.js:483`),
  `crawlerBonus(n, cls, overload)` (`app.js:490`), `p.crawlers`.
- Produit : rien dont une autre tâche dépend.

- [ ] **Étape 1 : écrire le test qui échoue**

```js
/* ---------- la pastille de foreuses ---------- */

t('la carte de planete dit combien de foreuses servent', () => {
  const g = app(s => { s.planets[0].crawlers = 120; });
  g.REFRESH.planets();
  const html = g.html()['pres-0'] || '';
  assert.ok(/120\s*\/\s*288/.test(html),
    'le compte et le plafond (8 x (14+12+10)) doivent figurer : ' + html.slice(0, 300));
});

t('pas de pastille quand aucune foreuse n\'est possible', () => {
  const g = app(s => {
    Object.assign(s.planets[0].b, { metal: 0, crystal: 0, deut: 0 });
  });
  g.REFRESH.planets();
  assert.ok(!/[Ff]oreuse/.test(g.html()['pres-0'] || ''),
    'plafond nul : rien à dire');
});
```

- [ ] **Étape 2 : vérifier qu'ils échouent**

Run: `node test/run.js`
Expected: FAIL, aucune mention de foreuse dans `pres-0`.

- [ ] **Étape 3 : ajouter la pastille**

Dans `REFRESH.planets` (`app.js:2266`), à la suite des quatre `gauge(...)`
de `pres-${i}`, ajouter une pastille reprenant la formulation de l'écran
supprimé (`app.js:2287-2288`) :

```
Foreuses 120 / 288 utiles · +9,6 %
```

Classe `good` quand `p.crawlers >= crawlerMax(...)`, `info` sinon. Rien
n'est rendu quand le plafond vaut 0. Le pourcentage vient de
`crawlerBonus(Math.min(have, max), S.settings.cls, S.settings.crawlerOverload)`,
formaté à une décimale avec la virgule, comme l'original.

- [ ] **Étape 4 : vérifier qu'ils passent**

Run: `node test/run.js`
Expected: PASS.

- [ ] **Étape 5 : commit**

```bash
git add app.js test/run.js
git commit -m "feat: la carte de planete dit combien de foreuses servent"
```

---

### Task 3 : le fil du début de partie

Un bloc de progression dans la carte *Ta journée*, au-dessus des phases.

Sémantique fixée par la conception : le compte est le **nombre de jalons
franchis** (ils peuvent l'être dans le désordre) ; « Prochaine étape »
nomme le **premier jalon non franchi dans l'ordre de la liste**, avec ses
prérequis manquants s'il en a.

**Files:**
- Modify: `app.js:2222` (`REFRESH.today`, construction de `tdDay`)
- Test: `test/run.js`

**Interfaces:**
- Consomme : `MILESTONES` (`app.js:655`, onze entrées),
  `milestoneDone(m)`, `milestoneLabel(m)`, `milestoneMissing(m)`
  (`app.js:667-669`). Ces quatre survivent à la tâche 4.
- Produit : rien dont une autre tâche dépend.

- [ ] **Étape 1 : écrire les tests qui échouent**

```js
/* ---------- le fil du debut de partie ---------- */

t('le bloc de progression nomme la prochaine etape et son prerequis', () => {
  const g = app(s => { s.planets[0].b.lab = 2; s.tech.impulse = 0; });
  g.REFRESH.today();
  const html = g.html().tdDay || '';
  assert.ok(/Prochaine étape/.test(html), 'le bloc doit être rendu : ' + html.slice(0, 300));
  assert.ok(/\d+\s*\/\s*11/.test(html), 'et porter le compte sur onze');
});

t('les jalons franchis dans le desordre comptent quand meme', () => {
  // Astro 3 est tenu, Ordinateur 2 aussi, mais le labo est à 2 : le
  // compte doit refléter ce qui est franchi, pas l'indice du suivant.
  const g = app(s => { s.planets[0].b.lab = 2; });
  g.REFRESH.today();
  const m = /(\d+)\s*\/\s*11/.exec(g.html().tdDay || '');
  assert.ok(m, 'le compte doit être rendu');
  assert.ok(+m[1] >= 9, 'neuf jalons au moins sont franchis dans cet état, et non 7');
});

t('tous les jalons franchis, le bloc disparait', () => {
  const g = app(s => {
    Object.assign(s.planets[0].b, { lab: 3, robot: 2, shipyard: 2 });
    Object.assign(s.tech, { energy: 3, combustion: 4, espionage: 4, computer: 2, impulse: 3, astro: 3 });
  });
  g.REFRESH.today();
  assert.ok(!/Début de partie/.test(g.html().tdDay || ''),
    'rien à afficher quand les onze sont franchis');
});
```

- [ ] **Étape 2 : vérifier qu'ils échouent**

Run: `node test/run.js`
Expected: FAIL, `tdDay` ne contient aucun bloc de progression.

- [ ] **Étape 3 : rendre le bloc**

Dans `REFRESH.today`, préfixer la valeur assignée à
`document.getElementById('tdDay').innerHTML` (`app.js:2222`) par le bloc,
placé avant `strategy`. Forme :

```
Début de partie · 10 / 11
Prochaine étape : Labo 3
Requis pour Astrophysique.
```

La ligne « Il manque : … » n'est rendue que si `milestoneMissing()`
renvoie une liste non vide — cas rare, la liste étant ordonnée de sorte
que les prérequis soient des jalons antérieurs. Le bloc entier n'est pas
rendu quand tous les jalons sont franchis. Réutiliser les classes
existantes de la carte (`advice`, `pill`, `what`, `why`) plutôt que d'en
créer.

- [ ] **Étape 4 : vérifier qu'ils passent**

Run: `node test/run.js`
Expected: PASS.

- [ ] **Étape 5 : commit**

```bash
git add app.js test/run.js
git commit -m "feat: le plan du jour dit ou tu en es dans le debut de partie"
```

---

### Task 4 : `adviceList()` disparaît, les alertes changent de source

La dernière, parce qu'elle supprime. Les trois précédentes doivent être
vertes avant de commencer.

Le piège, détaillé dans la conception : les candidats de
`pickBuildings()` ne peuvent pas servir d'alertes, parce que la boucle
est gardée par `if(p.bq>Tm) continue` (`app.js:1400`) et que l'alerte
énergie se tait quand des satellites arrivent (`app.js:1159`). Les
alertes viennent donc d'une passe à part, sans garde de file.

**Files:**
- Modify: `app.js` — ajouter `planetAlerts(p)` près de `production()` ;
  le remplir dans `simulateDay` et le retourner (`app.js:1463`) ;
  réécrire `app.js:2205-2206`
- Modify: `app.js:1684+` — l'alerte « file vide » rejoint `dailyMissions()`
- Delete: `adviceList()` (`app.js:673-717`), `VIEWS.advice`
  (`app.js:1987-2001`), `REFRESH.advice` (`app.js:2255-2260`),
  `VIEWS.build` (`app.js:2040-2050`), `REFRESH.build`
  (`app.js:2275-2294`), `SEV_LABEL` s'il ne sert plus
- Modify: `test/run.js:24` (retirer `'adviceList'` de `want`),
  `test/run.js:1046` (viser la mission `colomax`)

**Interfaces:**
- Produit : `simulateDay()` renvoie désormais
  `{now, sessions, busy, startV, endV, ups, alerts}`, où `alerts` est un
  tableau de `{sev, what, why}` avec `sev` valant `'bad'` ou `'warn'`.
- Conserve : `MILESTONES`, `milestoneDone`, `milestoneLabel`,
  `milestoneMissing` (tâche 3), `coloPaybackTxt()` et
  `astroForPlanet()` (mission `colomax`).

- [ ] **Étape 1 : écrire les tests qui échouent**

```js
/* ---------- les alertes ne dependent plus d'un second moteur ---------- */

t('energie negative et hangar plein sont dits tous les deux', () => {
  const g = app(s => {
    const p = s.planets[0];
    Object.assign(p.b, { metal: 20, solar: 1, smetal: 0 });
    p.stock = { m: 9e9, c: 0, d: 0, at: SOIR };
  });
  const a = g.simulateDay().alerts;
  assert.ok(a.some(x => /[Éé]nergie/.test(x.what)), 'l\'énergie négative doit être dite');
  assert.ok(a.some(x => /[Hh]angar/.test(x.what)), 'le hangar plein aussi');
});

t('une construction en cours ne fait pas taire les alertes', () => {
  const g = app(s => {
    const p = s.planets[0];
    Object.assign(p.b, { metal: 20, solar: 1 });
    s.timers = [{ id: 'x', kind: 'b', p: 0, k: 'metal', lvl: 21, end: SOIR + 6 * 3600e3 }];
  });
  assert.ok(g.simulateDay().alerts.some(x => /[Éé]nergie/.test(x.what)),
    'la file occupée ne doit pas effacer l\'avertissement');
});

t('l\'alerte nomme sa planete quand il y en a plusieurs', () => {
  const g = app(s => { Object.assign(s.planets[1].b, { metal: 12, solar: 1 }); });
  const a = g.simulateDay().alerts.find(x => /[Éé]nergie/.test(x.what));
  assert.ok(a && /Colonie/.test(a.what + ' ' + a.why), 'il faut savoir laquelle : ' + JSON.stringify(a));
});

t('une ressource sans production ne donne pas d\'alerte de hangar', () => {
  const g = app(s => {
    const p = s.planets[0];
    Object.assign(p.b, { deut: 0, sdeut: 0 });
    p.stock = { m: 0, c: 0, d: 0, at: SOIR };
  });
  g.simulateDay().alerts.forEach(x => {
    assert.ok(!/Infinity|NaN/.test(x.what + x.why), 'aucun chiffre absurde : ' + x.what);
  });
});

t('l\'alerte de file vide reste tue quand l\'extension a lu plus recemment', () => {
  const g = app(s => {
    s.lastAlerts = ['File de construction vide sur Planète mère'];
    s.lastImport = SOIR - 3600e3;
    s.syncAt = SOIR;
  });
  assert.ok(!g.dailyMissions().some(m => /file vide/i.test(m.what)),
    'un vieil import ne doit pas ressortir après une synchro');
});
```

- [ ] **Étape 2 : vérifier qu'ils échouent**

Run: `node test/run.js`
Expected: FAIL — `simulateDay()` ne renvoie pas `alerts`.

- [ ] **Étape 3 : écrire `planetAlerts(p)`**

Signature : `planetAlerts(p) -> [{sev, what, why}]`, placée près de
`production()`. Elle ne consulte aucune file. Trois familles, reprises
de `adviceList()` (`app.js:678-686`) avec leurs textes :

| Condition | `sev` |
| --- | --- |
| `production(p).factor < 1` | `bad` |
| stock ≥ 98 % de la capacité | `bad` |
| plein dans moins de **8 h**, et débit > 0 | `warn` |

Le nom de la planète figure dans le message dès que `S.planets.length > 1`,
par le suffixe ` sur ${p.name}` de l'original. Le garde `rate > 0` est
conservé tel quel.

- [ ] **Étape 4 : brancher la passe sur `simulateDay`**

Appeler `planetAlerts` sur chaque planète dans l'état de départ, avant
la boucle des sessions, et joindre le résultat au retour de
`app.js:1463` sous la clé `alerts`.

- [ ] **Étape 5 : déplacer l'alerte « file vide »**

Dans `dailyMissions()`, ajouter la mission tirée de `S.lastAlerts`
(`app.js:712-713`), **avec son garde `importFresh` inchangé**, en forme
de mission : `info: true`, `every: 24`, `q: 'Empire'`, et un `how` d'une
ou deux étapes.

- [ ] **Étape 6 : réécrire la carte *Alertes* et supprimer le reste**

`app.js:2205-2206` lit `plan.alerts` au lieu d'appeler `adviceList()`.
Puis supprimer `adviceList()`, `VIEWS.advice`, `REFRESH.advice`,
`VIEWS.build`, `REFRESH.build`, et `SEV_LABEL` s'il n'a plus d'usage.

Enfin, dans `test/run.js` : retirer `'adviceList'` de la liste `want`
(ligne 24) — sans quoi le harnais lève — et réécrire le test de la ligne
1046 pour viser la mission `colomax` de `dailyMissions()` au lieu du
conseil supprimé.

- [ ] **Étape 7 : vérifier que tout passe**

Run: `node test/run.js`
Expected: PASS, aucun test perdu.

- [ ] **Étape 8 : commit**

```bash
git add app.js test/run.js
git commit -m "refactor: un seul moteur dit quoi faire, les alertes en viennent"
```

---

## Vérification finale

- [ ] `node test/run.js` — tout vert.
- [ ] `grep -n "adviceList\|VIEWS.build\|VIEWS.advice" app.js test/run.js`
      ne renvoie rien.
- [ ] Dans le jeu, sur une partie réelle : construire des foreuses depuis
      une carte du panneau, attendre la fin du minuteur, et confirmer que
      le « Production +X % » du plan a bougé et que le panneau ne les
      repropose pas aussitôt.
- [ ] Dans le jeu : vérifier que la pastille d'Empire affiche le même
      plafond que la ligne `Foreuse (Nombre : x/y)` du panneau de
      production.
