# Copilote OGame — la file unique : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les quatre onglets de l'extension par une file unique d'actions classées, qui répond en permanence à « quelle est la prochaine chose à faire ».

**Architecture:** Un nouveau fichier `queue.js` contient le modèle d'action, le classement et les sources neuves ; c'est la seule logique inédite, et elle est pure donc testable sous Node. Les calculs existants d'`app.js` ne bougent pas : ils sont adaptés en objets Action. `simulateDay` perd son découpage en sessions mais garde son moteur de projection, qui porte la logique de réserve.

**Tech Stack:** JavaScript classique, aucun build, aucune dépendance. Scripts chargés dans l'ordre par `boot.js` (`s.async = false`). Tests : `node test/run.js`, `assert` de la bibliothèque standard.

**Spec:** `docs/superpowers/specs/2026-11-08-file-unique-design.md`

## Global Constraints

- Aucune étape de build, aucun gestionnaire de paquets, aucun framework. Scripts classiques dans `sidepanel.html` / injectés par `boot.js`.
- Lecture seule du jeu : aucune requête vers OGame depuis `content.js`, aucune action automatisée. Seuls les `/api/*.xml` publics sont téléchargés, par `background.js`.
- Interface en français, tutoiement, sans emoji, avec les noms français exacts du jeu (tables `B`, `T`, `SHIPS`, `OG_NAMES`).
- Panneau latéral étroit (~400 px) : une seule colonne.
- Le code métier existant est juste et éprouvé : on l'appelle, on ne le réécrit pas.
- La migration ne doit perdre aucun niveau saisi à la main (`S.planets[i].b`, `S.tech`).
- Node ≥ 18 pour les tests (`node --check`, `node test/run.js`).

## Review Focus

Cinq cas que la conception suppose et qu'aucune tâche n'exerce spontanément. Chaque ligne a son test rattaché à la tâche qui possède le code.

1. **Installation vierge** (`S.sample === true`, aucune page du jeu lue) : la file affiche une ligne d'accueil unique, jamais une pile de corvées ni une erreur. → Tâche 5.
2. **Flotte inconnue** (`p.ships` vide parce que la page Flotte n'a jamais été ouverte) : mise à l'abri et expédition se taisent au lieu de proposer zéro vaisseau. → Tâche 4.
3. **Une seule planète** : les sources qui supposent un hub et des transferts ne produisent rien plutôt que de planter. → Tâche 3.
4. **Il fait déjà nuit** (`isNight(now)`) : le rendez-vous du soir ne s'affiche pas, et ne se répète pas à chaque rafraîchissement. → Tâche 4.
5. **Fenêtre de nuit dégénérée** (`nightStart === nightEnd`, ou fenêtre à cheval sur minuit) : aucune boucle infinie, aucun `Infinity` propagé dans le classement. → Tâche 4.

---

### Task 1 : Le modèle d'action et son classement

**Files:**
- Create: `queue.js`
- Create: `test/run.js`

**Interfaces:**
- Consumes: rien.
- Produces: `rankActions(actions, now) -> {now: Action|null, banner: Action|null, next: Action[], busy: Action[]}` et la forme de l'objet Action, consommée par toutes les tâches suivantes.

L'objet Action, à documenter en tête de `queue.js` :

```js
// id       string   clé de rendu stable (survit aux rafraîchissements)
// family   string   'mine'|'recherche'|'expedition'|'espionnage'|'raid'
//                   |'colonisation'|'formevie'|'recyclage'|'abri'|'fraicheur'
// label    string   'Monte la Mine de cristal 13'
// why      string   une phrase
// how      string[] | null   étapes « première fois »
// cost     [m,c,d] | null
// loss     bool     une perte court tant que ce n'est pas fait
// blocked  null | {kind:'eta', secs} | {kind:'miss', res:[m,c,d]}
//                 | {kind:'storage'} | {kind:'stale', page}
// payback  number | null    heures, plus petit est meilleur
// confirm  'game' | 'snooze'
// snoozeHours number | null
// running  null | {endsAt, label}   si posée, l'action est « en cours »
// detail   object | null   charge utile du volet déplié
// launch   object | null   charge utile de data-launch
```

Le classement, à implémenter exactement ainsi — quatre rangs, puis deux départages :

| rang | condition |
|---|---|
| 0 | `loss && !blocked` |
| 1 | `!loss && !blocked` |
| 2 | `loss && blocked` |
| 3 | `!loss && blocked` |

Départage dans un rang : `blocked.secs` croissant (absent = 0), puis `payback` croissant (`null` = `Infinity`). `now` est la première action de rang 0 ou 1. `banner` est la première action de rang 2, ou `null`. `next` est le reste, hors `running`. `busy` regroupe les actions portant `running`.

- [ ] **Step 1 : Écrire les tests qui échouent**

```js
// test/run.js
const a = (over) => Object.assign({id:'x', family:'mine', label:'l', why:'w',
  how:null, cost:null, loss:false, blocked:null, payback:null,
  confirm:'game', snoozeHours:null, running:null, detail:null, launch:null}, over);

// une perte faisable passe devant une action faisable ordinaire
assert.equal(rankActions([a({id:'ord'}), a({id:'perte', loss:true})], 0).now.id, 'perte');

// une action bloquée ne prend jamais « Maintenant », même si c'est une perte
const r = rankActions([a({id:'libre'}), a({id:'perdu', loss:true, blocked:{kind:'eta', secs:600}})], 0);
assert.equal(r.now.id, 'libre');
assert.equal(r.banner.id, 'perdu');

// à égalité de rang, le meilleur amortissement gagne
assert.equal(rankActions([a({id:'lent', payback:40}), a({id:'vite', payback:9})], 0).now.id, 'vite');

// payback absent ne doit pas passer devant un payback connu
assert.equal(rankActions([a({id:'sans'}), a({id:'avec', payback:50})], 0).now.id, 'avec');

// à égalité de rang, l'échéance la plus proche d'abord
assert.equal(rankActions([a({id:'tard', blocked:{kind:'eta', secs:7200}}),
                          a({id:'tot', blocked:{kind:'eta', secs:600}})], 0).next[0].id, 'tot');

// une action en cours sort de la file et va dans busy
const r2 = rankActions([a({id:'run', running:{endsAt:1, label:'x'}}), a({id:'libre'})], 0);
assert.equal(r2.busy.length, 1);
assert.equal(r2.next.length, 0);

// file vide : rien ne plante
const r3 = rankActions([], 0);
assert.equal(r3.now, null);
assert.equal(r3.banner, null);
```

Le chargeur en tête de `test/run.js` lit `queue.js` et l'évalue dans un `new Function` en lui passant les globales dont il a besoin, afin que le fichier reste un script classique utilisable tel quel par le navigateur.

- [ ] **Step 2 : Lancer les tests et vérifier l'échec**

Run: `node test/run.js`
Expected: FAIL — `rankActions is not defined`

- [ ] **Step 3 : Implémenter `rankActions(actions, now)` dans `queue.js`**

Tri stable : calculer le rang, puis trier par `[rang, secs, payback]`. Ne jamais filtrer une action bloquée hors de `next`.

- [ ] **Step 4 : Lancer les tests et vérifier le succès**

Run: `node test/run.js`
Expected: PASS

- [ ] **Step 5 : Commit**

```bash
git add queue.js test/run.js
git commit -m "feat: modèle d'action et classement de la file"
```

---

### Task 2 : La projection sans le découpage en sessions

**Files:**
- Modify: `app.js` — `sessionTimes`, `simulateDay`, `pickBuildings`
- Create: `test/fixtures/projection-avant.json` (capture de référence)

**Interfaces:**
- Consumes: rien de la tâche 1.
- Produces: `project() -> {now, first:{acts, waits, goals}, busy, startV, endV, ups}` — `first` est l'ancien `sessions[0]`. Les sessions suivantes ne sont plus renvoyées.

Cette tâche touche le code le plus intriqué du projet. Elle ne change **aucune** règle métier : elle remplace le réglage utilisateur `S.day.interval` par un pas de simulation interne et réduit ce qui sort.

- [ ] **Step 1 : Capturer le comportement actuel avant d'y toucher**

Charger le panneau dans Chrome, ouvrir sa console, exécuter
`copy(JSON.stringify(simulateDay().sessions[0]))` et coller le résultat dans
`test/fixtures/projection-avant.json`. C'est la référence de non-régression.

- [ ] **Step 2 : Remplacer le réglage par un pas interne**

Dans `sessionTimes`, remplacer `+S.day.interval || 90` par la constante `TICK_MIN = 60` déclarée au-dessus, et `+S.day.horizon || 24` par `HORIZON_H = 24`. Garder intégralement le saut de la fenêtre de nuit (`isNight`) : il représente le fait que le joueur ne lance rien pendant son sommeil.

Dans `simulateDay`, remplacer `const iv = Math.max(15,+S.day.interval||90)/60` par `const iv = TICK_MIN/60`. Dans `pickBuildings`, `ctx.iv` garde le même rôle et la même valeur.

- [ ] **Step 3 : Réduire ce que la projection renvoie**

Renommer `simulateDay` en `project` et renvoyer `{now, first: sessions[0], busy, startV, endV, ups}`. Conserver la boucle complète sur `sessionTimes(now)` — c'est elle qui alimente les réserves (`goals`) et les échéances ; seules les sessions au-delà de la première cessent d'être exposées. Garder le `try/finally` qui restaure `S.tech` et `S.planets`.

Laisser un appelant temporaire dans `REFRESH.today` pour que l'extension continue de tourner : `const plan = project(), s0 = plan.first;` et supprimer les usages de `plan.sessions`.

- [ ] **Step 4 : Vérifier la non-régression**

Recharger l'extension, exécuter `JSON.stringify(project().first)` dans la console du panneau, comparer avec `test/fixtures/projection-avant.json`. Les `acts` et `waits` doivent porter les mêmes `what` dans le même ordre. Un écart sur les horaires (`end`) est attendu si le pas change l'instant des connexions simulées ; un écart sur la liste des actions ne l'est pas.

- [ ] **Step 5 : Commit**

```bash
git add app.js test/fixtures/projection-avant.json
git commit -m "refactor: projection sans découpage en sessions"
```

---

### Task 3 : Les sources existantes deviennent des actions

**Files:**
- Modify: `queue.js`
- Modify: `test/run.js`

**Interfaces:**
- Consumes: la forme Action et `rankActions` de la tâche 1 ; la forme `project()` de la tâche 2.
- Produces: `collect(plan, missions, now) -> Action[]`.

Correspondances à implémenter, une par source :

| Entrée | Devient |
|---|---|
| `plan.first.acts[]` | Action faisable. `cost` repris, `payback` repris de `rankUpgrades` quand présent, `launch` = la charge utile actuelle de `data-launch`, `confirm: 'game'` |
| `plan.first.waits[]` | Action bloquée : `{kind:'eta', secs:w.eta}`, ou `{kind:'storage'}` si `eta` vaut `Infinity`, `blocked.res = w.miss` |
| `plan.busy[]` | Action portant `running: {endsAt: b.end, label: b.what}` |
| `dailyMissions()` non faites | Action, `how` repris tel quel, `confirm: 'snooze'`, `snoozeHours = m.every`, `family` déduite de `m.q` |

`loss` vaut `true` pour : une mission de sévérité `bad`, une action `waits` de type `storage`, une action de construction dont la file de la planète est vide (le multiplicateur « file vide » de la conception), une mission dont l'`id` est `fleetslots`.

- [ ] **Step 1 : Écrire les tests qui échouent**

```js
// une action de la projection devient une action faisable, coût et lancement conservés
const plan = {now:0, first:{acts:[{q:'Bâtiment · Mère', what:'Mine de cristal 13', why:'r',
  cost:[18400,9200,0], kind:'b', k:'crystal', lvl:13, p:0}], waits:[], goals:[]}, busy:[]};
const [act] = collect(plan, [], 0);
assert.equal(act.blocked, null);
assert.deepEqual(act.cost, [18400,9200,0]);
assert.equal(act.launch.k, 'crystal');
assert.equal(act.confirm, 'game');

// une attente devient une action bloquée, pas une action absente
const bloque = collect({now:0, first:{acts:[], waits:[{q:'Recherche', what:'Astrophysique 4',
  eta:4200, miss:[0,12000,0]}], goals:[]}, busy:[]}, [], 0)[0];
assert.equal(bloque.blocked.kind, 'eta');
assert.equal(bloque.blocked.secs, 4200);

// hangar trop petit : eta infini devient un blocage de type storage, jamais Infinity dans le tri
const petit = collect({now:0, first:{acts:[], waits:[{q:'Bâtiment', what:'x', eta:Infinity,
  miss:[1,0,0]}], goals:[]}, busy:[]}, [], 0)[0];
assert.equal(petit.blocked.kind, 'storage');
assert.ok(Number.isFinite(rankActions([petit], 0).next[0].blocked.secs ?? 0));

// une mission garde ses étapes et sa mise en sommeil
const m = collect({now:0, first:{acts:[], waits:[], goals:[]}, busy:[]},
  [{id:'raid', q:'Pillage', every:12, sev:'good', what:'Espionner', why:'w', how:['a','b']}], 0)[0];
assert.deepEqual(m.how, ['a','b']);
assert.equal(m.confirm, 'snooze');
assert.equal(m.snoozeHours, 12);

// une planète unique : aucune source ne plante, la file peut être vide
assert.doesNotThrow(() => collect({now:0, first:{acts:[], waits:[], goals:[]}, busy:[]}, [], 0));

// les identifiants sont stables d'un appel à l'autre
assert.equal(collect(plan, [], 0)[0].id, collect(plan, [], 5000)[0].id);
```

- [ ] **Step 2 : Lancer les tests et vérifier l'échec**

Run: `node test/run.js`
Expected: FAIL — `collect is not defined`

- [ ] **Step 3 : Implémenter `collect(plan, missions, now)` dans `queue.js`**

L'`id` d'une action est dérivé de son contenu, pas de son index ni de l'heure : `famille + what`, afin que la ligne ne se recrée pas sous le curseur au rafraîchissement.

- [ ] **Step 4 : Lancer les tests et vérifier le succès**

Run: `node test/run.js`
Expected: PASS

- [ ] **Step 5 : Commit**

```bash
git add queue.js test/run.js
git commit -m "feat: les sources existantes deviennent des actions"
```

---

### Task 4 : La mise à l'abri calculée, le recyclage rappelé

**Files:**
- Modify: `queue.js`
- Modify: `test/run.js`

**Interfaces:**
- Consumes: la forme Action.
- Produces: `fleetsaveAction(planets, stats, night, now) -> Action|null` et `recycleAction(moves, now) -> Action|null`, où `stats` est `{cargoEff(shipKey), flightSecs(from, to, ships, pct)}` — les fonctions existantes `shipStats` et `flight` injectées, pour que `queue.js` reste pur ; `night` est `{start, end, isNight(ms), endMs}` où `endMs` est l'instant de fin
de la prochaine nuit.

C'est le seul calcul neuf du projet. Il choisit, sur la planète qui porte le plus de ressources à découvert, les transporteurs à envoyer et la vitesse qui fait rentrer la flotte **après** `night.end`.

- [ ] **Step 1 : Écrire les tests qui échouent**

```js
// rien à sauver sans transporteur : on se tait plutôt que de proposer zéro vaisseau
assert.equal(fleetsaveAction([{name:'Mère', coords:'1:1:8', ships:{}, stock:{m:9e5,c:9e5,d:0}}],
  stats, nuitProche, t0), null);

// avec des transporteurs, l'action nomme la flotte, la destination et l'heure de retour
const fs = fleetsaveAction([{name:'Mère', coords:'1:1:8', ships:{lc:30}, stock:{m:9e5,c:9e5,d:5e4}},
  {name:'Colonie', coords:'1:142:6', ships:{}, stock:{m:0,c:0,d:0}}], stats, nuitProche, t0);
assert.equal(fs.family, 'abri');
assert.ok(fs.detail.ships.lc > 0);
assert.ok(fs.detail.backAt > nuitProche.endMs);
assert.equal(fs.confirm, 'snooze');

// il fait déjà nuit : pas de rendez-vous du soir
assert.equal(fleetsaveAction(flotteOk, stats, nuitEnCours, t0), null);

// fenêtre de nuit dégénérée : pas de boucle, pas d'Infinity
const dege = {start:7, end:7, isNight:()=>false, endMs:0};
assert.equal(fleetsaveAction(flotteOk, stats, dege, t0), null);
```

- [ ] **Step 2 : Lancer les tests et vérifier l'échec**

Run: `node test/run.js`
Expected: FAIL — `fleetsaveAction is not defined`

- [ ] **Step 3 : Implémenter `fleetsaveAction(planets, stats, night, now)` dans `queue.js`**

L'action n'apparaît qu'entre `night.start - 1 h` et `night.start`, et jamais si `night.isNight(now)`. Elle porte `loss: true`, `confirm: 'snooze'`, `snoozeHours: 24`, et un `how` pour la première fois. `detail` contient `{ships, dest, pct, backAt}`. Si aucune combinaison de vitesse ne fait rentrer la flotte après `night.end`, renvoyer l'action avec la vitesse la plus lente disponible plutôt que `null` : tard vaut mieux que rien.

- [ ] **Step 4 : Lancer les tests et vérifier le succès**

Run: `node test/run.js`
Expected: PASS

- [ ] **Step 5 : Écrire le test du rappel de recyclage**

```js
// après le retour d'une expédition, un rappel sans chiffres
const moves = [{mission:15, ret:true, arrival:(t0-20*60e3)/1000, dest:'1:142:16'}];
const rec = recycleAction(moves, t0);
assert.equal(rec.family, 'recyclage');
assert.equal(rec.cost, null);          // aucun chiffre : on ne voit pas les débris
assert.ok(rec.how && rec.how.length);  // explication première fois
assert.equal(rec.confirm, 'snooze');

// aucune expédition rentrée récemment : rien
assert.equal(recycleAction([], t0), null);
```

- [ ] **Step 6 : Implémenter `recycleAction(moves, now)` dans `queue.js`**

Renvoie une action seulement si un mouvement de mission 15 avec `ret` est rentré
dans la dernière heure. `loss: false`, `snoozeHours: 2`. Le `how` explique ce
qu'est un recycleur, qu'il faut en construire avant, et où regarder en Galaxie.
Aucun calcul de champ de débris : l'extension ne les voit pas.

- [ ] **Step 7 : Lancer les tests et vérifier le succès**

Run: `node test/run.js`
Expected: PASS

- [ ] **Step 8 : Remplacer le rappel générique par l'action calculée**

Dans `dailyMissions`, supprimer la mission `id:'night'` : elle est remplacée par
`fleetsaveAction`. Vérifier qu'aucune autre source ne produit de doublon de mise
à l'abri ni de recyclage.

- [ ] **Step 9 : Commit**

```bash
git add queue.js test/run.js app.js
git commit -m "feat: mise à l'abri calculée et rappel de recyclage"
```

---

### Task 5 : La fraîcheur des données

**Files:**
- Modify: `background.js` — `merge()`
- Modify: `app.js` — `applyGame()`
- Modify: `queue.js`
- Modify: `test/run.js`

**Interfaces:**
- Consumes: la forme Action.
- Produces: `freshnessAction(seen, now, hasBlockedSource) -> Action|null`, où `seen` est `{levels, ships, slots, moves}` en millisecondes.

`merge()` écrit aujourd'hui les niveaux sans date. Il faut horodater par donnée, puis n'émettre **qu'une** ligne de fraîcheur à la fois, et seulement quand elle débloquerait une action qui comptait.

- [ ] **Step 1 : Écrire les tests qui échouent**

```js
// installation vierge : une seule ligne d'accueil, pas six corvées
const vierge = freshnessAction({}, t0, true);
assert.equal(vierge.family, 'fraicheur');
assert.equal(vierge.blocked.kind, 'stale');
assert.equal(freshnessAction({}, t0, true).id, vierge.id); // une seule, stable

// donnée fraîche : rien
assert.equal(freshnessAction({levels:t0-60e3, ships:t0-60e3, slots:t0-60e3, moves:t0-60e3}, t0, true), null);

// donnée périmée mais aucune action bloquée derrière : on ne dérange pas
assert.equal(freshnessAction({levels:t0-5*864e5, ships:t0-60e3, slots:t0-60e3, moves:t0-60e3}, t0, false), null);

// la ligne nomme la page à ouvrir
const vieux = freshnessAction({levels:t0-5*864e5, ships:t0-60e3, slots:t0-60e3, moves:t0-60e3}, t0, true);
assert.ok(vieux.blocked.page);
assert.ok(vieux.why.includes('3') || /jour/.test(vieux.why));
```

- [ ] **Step 2 : Lancer les tests et vérifier l'échec**

Run: `node test/run.js`
Expected: FAIL — `freshnessAction is not defined`

- [ ] **Step 3 : Horodater les données dans `background.js`**

Dans `merge()`, écrire `cur.bAt = s.at` à côté de `cur.b[...]`, et conserver `cur.shipsAt`, `game.slots.at`, `game.at`. Dans `applyGame()`, reporter ces dates sur `S.planets[i]` sans écraser une date plus récente. Les états enregistrés sans ces champs se comportent comme « jamais vu » : aucune migration destructrice.

- [ ] **Step 4 : Implémenter `freshnessAction(seen, now, hasBlockedSource)` dans `queue.js`**

Seuils : niveaux 48 h, flotte 12 h, emplacements 3 h, mouvements 1 h. Renvoyer au plus une action, celle de la donnée la plus anciennement vue. Si `seen` est vide, renvoyer l'action d'accueil : « ouvre une page du jeu, je lis tout seul ». `confirm: 'snooze'`, `snoozeHours: 1`.

- [ ] **Step 5 : Lancer les tests et vérifier le succès**

Run: `node test/run.js`
Expected: PASS

- [ ] **Step 6 : Commit**

```bash
git add background.js app.js queue.js test/run.js
git commit -m "feat: horodatage par donnée et ligne de fraîcheur rationnée"
```

---

### Task 6 : L'écran « À faire »

**Files:**
- Modify: `app.js` — `VIEWS.today` devient `VIEWS.queue`, `REFRESH.today` devient `REFRESH.queue`
- Modify: `panel.css`
- Modify: `boot.js` — charger `queue.js` avant `app.js`

**Interfaces:**
- Consumes: `collect`, `rankActions`, `fleetsaveAction`, `freshnessAction`.
- Produces: l'écran. Aucune interface consommée par les tâches suivantes.

Trois blocs en une colonne : **Maintenant** (`r.now`, en grand, avec `why`, `cost`, bouton « C'est lancé »), **Ensuite** (`r.next` limité à cinq lignes compactes avec étiquette de famille et blocage à droite), **En cours** (`r.busy` avec barre et temps restant). `r.banner` s'affiche au-dessus de « Maintenant » quand il existe. Si `r.now` est `null`, « Maintenant » affiche la meilleure action bloquée, ou le rendez-vous du soir.

- [ ] **Step 1 : Charger `queue.js`**

Dans `boot.js`, injecter `queue.js` puis `app.js`, les deux avec `s.async = false` pour garantir l'ordre.

- [ ] **Step 2 : Écrire la vue**

`VIEWS.queue()` rend la coquille des trois blocs ; `REFRESH.queue()` appelle `project()`, `dailyMissions()`, les deux sources neuves, passe le tout à `collect` puis `rankActions`, et remplit les blocs. Reprendre `costHtml`, `dur`, `hm`, `fmt`, `esc` tels quels.

- [ ] **Step 3 : Geler l'ordre quand un détail est ouvert**

Conserver dans une variable de module l'`id` de l'action dépliée. Tant qu'elle est non nulle, `REFRESH.queue` réutilise l'ordre du rendu précédent et ne met à jour que les textes. Les étiquettes de famille utilisent les quatre valeurs d'affichage : Mine, Recherche, Flotte, Espionnage.

- [ ] **Step 4 : Vérifier à la main**

Recharger l'extension sur une page OGame. Attendu : un bloc « Maintenant » non vide, des lignes « Ensuite » portant un blocage lisible, les files du jeu dans « En cours ». Laisser le panneau ouvert deux minutes et vérifier qu'une ligne dépliée ne se referme pas.

- [ ] **Step 5 : Commit**

```bash
git add app.js panel.css boot.js
git commit -m "feat: écran À faire, file unique en trois blocs"
```

---

### Task 7 : « C'est lancé » et l'apprentissage

**Files:**
- Modify: `app.js` — gestionnaires `data-launch`, `data-done`
- Modify: `queue.js`
- Modify: `test/run.js`

**Interfaces:**
- Consumes: la forme Action, `S.daily.done`.
- Produces: `S.learned` — `{<family>: timestamp}`, et `shouldExpand(action, learned) -> bool`.

- [ ] **Step 1 : Écrire les tests qui échouent**

```js
// jamais faite : l'action s'affiche dépliée
assert.equal(shouldExpand({family:'abri', how:['a']}, {}), true);
// déjà faite : repliée
assert.equal(shouldExpand({family:'abri', how:['a']}, {abri:1}), false);
// une famille voisine ne fait pas taire l'autre
assert.equal(shouldExpand({family:'abri', how:['a']}, {expedition:1}), true);
// sans étapes, rien à déplier
assert.equal(shouldExpand({family:'mine', how:null}, {}), false);
```

- [ ] **Step 2 : Lancer les tests et vérifier l'échec**

Run: `node test/run.js`
Expected: FAIL — `shouldExpand is not defined`

- [ ] **Step 3 : Implémenter `shouldExpand` et brancher les deux confirmations**

`confirm === 'game'` : conserver le comportement actuel de `data-launch` — minuteur `manual`, débit du stock local, reprise par `applyGame`. `confirm === 'snooze'` : écrire `S.daily.done[id] = Date.now()` comme `data-done` et laisser `missionDone` gérer le retour après `snoozeHours`.

Dans les deux cas, écrire `S.learned[action.family] = Date.now()` au premier clic, puis `save()`. Amorcer `S.learned` dans `sample()` avec `{colonisation: 0, formevie: 0}` — la conception indique que ces deux-là ont déjà été faites une fois, tandis que `abri` et `recyclage` ne le sont jamais.

- [ ] **Step 4 : Lancer les tests et vérifier le succès**

Run: `node test/run.js`
Expected: PASS

- [ ] **Step 5 : Commit**

```bash
git add app.js queue.js test/run.js
git commit -m "feat: confirmation selon la famille et explication première fois"
```

---

### Task 8 : Deux onglets, et le ménage

**Files:**
- Modify: `sidepanel.html`, `app.js`, `panel.css`

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: rien.

- [ ] **Step 1 : Réduire la barre d'onglets**

Dans `sidepanel.html`, remplacer les quatre boutons par `À faire` et `Empire`, plus un bouton engrenage pour les réglages. Dans `app.js`, `VIEWS` ne garde que `queue`, `empire` et `settings` ; `tab` par défaut passe à `queue`.

- [ ] **Step 2 : Déplacer les anciens outils dans les détails**

`VIEWS` ne garde que `queue`, `empire` et `settings`. Les autres vues deviennent
le volet déplié de l'action de même famille, ou disparaissent :

| Vue actuelle | Devient |
|---|---|
| `VIEWS.colony` | volet de l'action `colonisation` |
| `VIEWS.fleet` | volet de l'action `expedition` et de `abri` |
| `VIEWS.explore` | volet des actions `espionnage` et `raid` |
| `VIEWS.build`, `VIEWS.research` | restent dans `empire` en consultation |
| `VIEWS.advice` | supprimée : c'est la file |
| `VIEWS.plan` | supprimée avec `S.plan` |

Les fonctions de calcul qu'elles appelaient ne bougent pas.

- [ ] **Step 3 : Supprimer le plan manuel et la vue « Ta journée »**

Retirer `S.plan` de `sample()`, la boucle `S.plan.forEach` d'`adviceList`, le remappage d'index d'`applyGame`, et les gestionnaires `plAdd` / `data-plrm`. Retirer de `sample()` les réglages `day.interval` et `day.horizon` ; conserver `day.nightStart`, `day.nightEnd` et `day.focus`, ce dernier derrière l'engrenage puisqu'il alimente `nextResearch` et `bestLifeform`.

- [ ] **Step 4 : Vérifier la migration**

Charger l'extension avec un état enregistré contenant des niveaux saisis à la main (`S.sample === false`, `S.planets[0].b.metal > 0`). Attendu : les niveaux et les recherches sont intacts dans l'onglet Empire, et l'absence de `S.plan` ne provoque aucune erreur en console.

- [ ] **Step 5 : Vérifier qu'il ne reste rien**

Run: `grep -n "S\.plan\|day\.interval\|day\.horizon\|VIEWS\.plan\|simulateDay" app.js`
Expected: aucune correspondance.

Run: `node --check app.js && node --check queue.js && node --check boot.js && node test/run.js`
Expected: PASS

- [ ] **Step 6 : Commit**

```bash
git add sidepanel.html app.js panel.css
git commit -m "feat: deux onglets, suppression du plan manuel et de Ta journée"
```
