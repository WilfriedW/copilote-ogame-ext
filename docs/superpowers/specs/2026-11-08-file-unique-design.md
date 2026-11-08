# Copilote OGame — la file unique

Document de conception, 8 novembre 2026.

## Intention

L'extension doit répondre à une seule question, en permanence : **quelle est la
prochaine chose à faire ?**

Elle y répond déjà, mais mal. Elle sait calculer presque tout ce qu'il faut —
l'amortissement d'une mine, la composition d'une flotte d'expédition, les
positions libres pour coloniser, les inactifs à portée, les systèmes pas
explorés depuis une semaine — et elle range chaque calcul derrière son propre
onglet. Le tri, c'est-à-dire la seule chose que le joueur ne sait pas faire,
reste à sa charge.

Le joueur est débutant. Il ne peut pas juger si un conseil est bon : il vient
de coloniser pour la première fois, vient de découvrir sa première forme de
vie, n'a jamais mis ses ressources à l'abri et n'a jamais recyclé un champ de
débris. L'extension n'est pas son tableau de bord, elle est sa connaissance du
jeu. Elle doit donc être assez sûre d'elle pour qu'il la suive sans vérifier,
et assez explicite pour qu'il comprenne au fur et à mesure.

Son rythme de jeu n'est pas celui que l'application suppose aujourd'hui.
L'onglet OGame reste ouvert toute la journée pendant qu'il fait autre chose ;
les minuteurs et les bips le ramènent quand une expédition rentre ou qu'une
recherche finit. La question « qu'est-ce que je fais à chaque passage » est
donc la mauvaise question. La vraie est « qu'est-ce que je fais là, tout de
suite ».

## Objectifs

- Au moment où le bip retentit, l'écran affiche **une action**, pourquoi elle,
  et de quoi elle a besoin.
- Toutes les familles d'actions se classent **dans la même file** : bâtiments,
  recherches, expéditions, espionnage, raids, colonisation, formes de vie,
  recyclage, mise à l'abri.
- Chaque ligne dit ce qui la bloque : payable, dans 1 h 10, manque 12 k métal.
- Une action jamais faite s'explique. Une action connue tient sur une ligne.
- Les calculs existants deviennent le **détail d'une ligne** : on clique
  « Lance une expédition » et la flotte est déjà composée.
- Le joueur garde un endroit pour regarder son empire sans qu'on lui dise quoi
  faire.

## Non-objectifs

- **Aucune action dans le jeu.** L'extension ne clique pas, ne poste pas, ne
  remplit aucun formulaire d'OGame. Le joueur exécute à la main. C'est une
  règle du jeu, pas une précaution : l'automatisation est interdite.
- Pas de planificateur de session. La simulation par connexions de 90 minutes
  répond à une question que le joueur ne se pose pas.
- Pas de combat optimisé, pas de simulateur de bataille.
- Pas de multi-compte, pas de partage de données entre joueurs.

## Anti-objectifs

Ce qui ferait échouer le projet même s'il fonctionne :

- **Un tableau de bord.** Si l'écran affiche des chiffres que le joueur doit
  interpréter pour décider, c'est raté. Il veut une phrase, pas une jauge.
- **Nourrir l'outil avant qu'il serve.** Aujourd'hui le joueur fait le tour de
  tous les onglets du jeu en partie pour alimenter l'extension. Si cette corvée
  reste un passage obligé, le reste ne vaut rien.
- **Une file si longue qu'il faut la trier.** Remplacer quatre onglets par
  trente lignes, c'est déplacer le problème.
- **Du jargon non expliqué.** « Recycle le champ de débris en 2:84:11 » ne veut
  rien dire pour qui n'a jamais construit de recycleur.

## Contraintes

- Extension Chrome MV3 existante, en service, en français. Pas d'étape de
  build, pas de gestionnaire de paquets, pas de framework : des scripts
  classiques chargés par `sidepanel.html`. Ça reste ainsi.
- Lecture seule du jeu : `content.js` lit le DOM de la page affichée et
  n'émet aucune requête vers OGame. Seules les données publiques officielles
  (`/api/*.xml`) sont téléchargées, par `background.js`.
- L'extension ne voit que ce que la page affiche. Les niveaux d'une planète
  qu'on n'a pas ouverte depuis trois jours datent de trois jours.
- Le panneau latéral est étroit (~400 px). Tout se lit en une colonne.
- Le code métier existant est juste et éprouvé. **On ne le réécrit pas.** Le
  projet redistribue l'interface par-dessus les calculs en place.

## Les décisions prises

### Structure

Deux onglets au lieu de quatre.

- **À faire** — la file. C'est l'application.
- **Empire** — consultation : planètes, niveaux, production, recherches. Aucun
  conseil, aucune action *dans le jeu*. Le joueur y va quand il a envie de
  regarder. La saisie manuelle des niveaux y reste : corriger ses propres
  données n'est pas une action de jeu, et c'est la seule réparation possible
  pour une planète que l'extension n'a jamais vue.

Les réglages passent derrière un engrenage dans l'en-tête. Les onglets
« Outils » et « Aujourd'hui » disparaissent en tant que tels.

### L'écran « À faire »

Trois blocs, dans cet ordre, en une colonne :

1. **Maintenant** — une seule action, en gros : son titre, une phrase de
   justification, son coût, un bouton « C'est lancé ». Cliquer le bouton la
   retire de la file et fait remonter la suivante.
2. **Ensuite** — quatre à six lignes compactes. Chacune porte une étiquette de
   famille (Mine, Recherche, Flotte, Espionnage, Défense), le quoi, une
   demi-phrase de pourquoi, et son blocage à droite.
3. **En cours** — les files du jeu qui tournent, avec leur barre et leur temps
   restant, plus les flottes en vol.

Sous les trois blocs, le **rendez-vous du soir** : une ligne qui rappelle, à
l'approche de la nuit, de lancer du long et de mettre les ressources à l'abri.

Cliquer une ligne la déplie sur place et affiche son détail : la flotte
composée pour une expédition, la position retenue pour une colonisation, les
sondes nécessaires pour un espionnage. C'est là que vivent les anciens outils.

### Le classement

Une action porte quatre attributs : sa famille, son urgence, son blocage, et
le gain qu'elle rapporte. L'ordre se décide dans cet ordre de priorité :

1. **Ce qui se perd** passe devant. Un slot d'expédition libre, un stock qui
   va déborder, une file de construction vide, une nuit qui approche avec des
   ressources à découvert : ce sont des pertes qui courent.
2. **Ce qui est faisable maintenant** passe devant ce qui attend des
   ressources.
3. À égalité, **le meilleur amortissement** gagne.

Le blocage est une **pénalité de score, pas un filtre** : une action bloquée
reste dans la file avec son blocage affiché, c'est ce qui permet d'anticiper.
Elle ne peut simplement pas occuper le bloc « Maintenant », qui prend la
première action réellement faisable.

Exception : une perte imminente **et** bloquée — hangar plein dont le niveau
suivant n'est pas payable, slot d'expédition libre sans transporteur
disponible — ne doit pas se retrouver enterrée au moment où elle compte. Elle
s'affiche en bandeau au-dessus de « Maintenant », avec ce qui la débloquerait.

« Une file de construction vide » est l'état normal de toute action de
construction : c'est donc un **multiplicateur de priorité** appliqué aux
actions constructibles, jamais une ligne à soi. (Le code actuel souffre déjà
de la version ligne : `adviceList` pousse « Aucune recherche suivie » et
`REFRESH.today` doit l'exclure par expression régulière.)

### Ce que « C'est lancé » veut dire

Deux mécanismes existent déjà dans `app.js` et servent à deux cas distincts ;
l'action porte un attribut qui dit lequel s'applique.

- **Le jeu va le confirmer** (bâtiment, recherche, construction de vaisseaux,
  départ de flotte) : comme `data-launch` aujourd'hui — on crée un minuteur
  local marqué `manual`, on débite le stock local, et `applyGame` reprend la
  main dès que `content.js` voit le vrai minuteur du jeu. La ligne part pour
  de bon.
- **Le jeu ne confirmera jamais** (mise à l'abri, envoi d'une sonde,
  recyclage) : comme `S.daily.done` et `missionDone` aujourd'hui — la ligne
  est mise en sommeil pour une durée propre à sa famille, puis revient.

Aucune action ne peut vider le bloc « Maintenant » : s'il ne reste rien de
faisable, il affiche la meilleure action bloquée avec son blocage, ou le
rendez-vous du soir.

### L'apprentissage

L'application retient les familles d'actions que le joueur a déjà exécutées.
La clé de cette mémoire est la **famille fine** — celle des neuf citées dans
les Objectifs, pas l'étiquette de couleur affichée. Les étiquettes (Mine,
Recherche, Flotte, Espionnage) ne sont qu'un regroupement visuel : sans ça, la
première expédition ferait taire l'explication de la première mise à l'abri.
L'étiquette « Défense » disparaît tant qu'aucun calcul de défense n'existe.

- Première fois : la ligne s'affiche dépliée, avec trois lignes qui expliquent
  ce que c'est, pourquoi on le fait et ce qu'il faut avoir avant.
- Ensuite : la ligne se réduit au titre et au pourquoi en demi-phrase.

L'outil se tait à mesure que le joueur apprend. Au moment où ce document est
écrit, sont « jamais faites » : la mise à l'abri, le recyclage. Sont « faites
une fois » : la colonisation, la découverte d'une forme de vie.

### Recyclage et mise à l'abri

Ces deux familles n'existent nulle part dans le code actuel, et elles ne se
valent pas.

**La mise à l'abri est calculée.** Tout est déjà là : la flotte à quai
(`p.ships`), les durées de vol (`flight`, `shipStats`), la fenêtre de nuit.
L'action dit quoi envoyer, où, et à quelle vitesse pour que la flotte rentre
après le réveil. C'est le cœur du rendez-vous du soir, et c'est la chose que
le joueur n'a jamais faite alors qu'il en a le plus besoin.

**Le recyclage est un rappel, sans chiffres.** L'extension ne voit pas les
champs de débris : `content.js` ne lit pas la vue Galaxie et les fichiers
publics `/api/*.xml` ne les contiennent pas. Les calculer supposerait
d'apprendre à lire la page Galaxie, de stocker ces champs, et d'exiger du
joueur qu'il passe par Galaxie — une fonctionnalité neuve, pas une
redistribution. Donc : après le retour d'une expédition, une ligne propose
d'aller voir en Galaxie, avec l'explication « première fois » (ce qu'est un
recycleur, pourquoi on recycle, qu'il faut en construire avant). Si l'usage
s'installe, le calcul viendra dans un second temps.

C'est la seule réduction de portée consentie par rapport à l'intention de
départ, et elle est assumée : elle garde le projet sur sa ligne — redistribuer
ce qui existe déjà.

### La fraîcheur des données

La corvée du tour des onglets devient une ligne de la file, et seulement quand
elle sert. Quand un calcul dépend d'une donnée trop vieille pour être fiable,
la file propose : « Ouvre la page Recherche — mes niveaux datent de trois
jours ». Le joueur ouvre la page, `content.js` lit, la ligne disparaît d'elle
même.

Chaque donnée du modèle porte donc l'horodatage de sa dernière lecture, et
chaque source de la file déclare ce dont elle a besoin et à partir de quel âge
cette donnée n'est plus sûre. Cela demande du travail dans `background.js` :
`merge()` écrit aujourd'hui les niveaux sans date, et seul un `syncAt` global
existe. Il faut horodater par donnée et migrer l'état enregistré.

**Règle d'émission, pour que la corvée ne revienne pas par la fenêtre :** une
ligne de fraîcheur n'apparaît que lorsqu'elle bloque une action qui serait
sinon bien classée, elle nomme cette action, et il n'y en a **qu'une seule à
la fois**. Jamais de corvée gratuite.

Au premier démarrage, toutes les données sont périmées. La file n'affiche
alors pas six corvées : elle affiche une ligne d'accueil unique — « ouvre une
page du jeu, je lis tout seul » — et se remplit au fur et à mesure. C'est le
cas le plus exposé à l'anti-objectif « nourrir l'outil avant qu'il serve ».

### Ce qu'on garde du code existant

Tout le calcul. La redistribution ne touche pas à ces fonctions d'`app.js`,
elle les appelle :

| Ce que la file affiche | Ce qui le calcule déjà |
|---|---|
| Prochaines améliorations de mines | `rankUpgrades`, `pickBuildings` |
| Prochaine recherche | `nextResearch`, `resolveTech` |
| Actions hors file de construction | `dailyMissions`, `adviceList` |
| Expédition | `expoFleet`, `freeExpoSlots`, `fleetSlots` |
| Espionnage et raids | `raidTargets`, `raidPlan`, `parseReport` |
| Exploration | `exploreSystems` |
| Colonisation | `colonyCandidates`, `coloFleet`, `coloTarget`, `rankPositions`, `coloVerdict` |
| Formes de vie | `bestLifeform` |
| Production, stocks, attente | `production`, `stockNow`, `waitFor`, `storageCap` |
| Coûts et durées | `levelCost`, `rangeCost`, `buildTime`, `researchTime` |
| Vols | `flight`, `shipStats`, `distance` |
| Minuteurs et bips | `visibleTimers`, `tickTimers`, `finishTimer`, `renderTimers` |
| Synchronisation | `applyGame`, `content.js`, `background.js` |

Les alarmes, notifications et le bandeau de fin de file de `background.js`
restent tels quels : c'est le mécanisme qui ramène le joueur, et il marche.

### Ce qu'on abandonne

- L'onglet « Ta journée » et le **découpage en sessions** de `simulateDay` :
  une simulation par connexions de 90 minutes modélise un rythme de jeu qui
  n'est pas le sien. Les réglages `day.interval` et `day.horizon` disparaissent
  avec. La fenêtre de nuit (`day.nightStart`, `day.nightEnd`) survit : elle
  sert au rendez-vous du soir, et `day.focus` passe derrière l'engrenage
  (il alimente `nextResearch` et `bestLifeform`).

  **Mais la projection, elle, survit et doit être extraite.** C'est le point le
  plus facile à rater. `simulateDay` contient la seule logique qui met du
  deutérium de côté pour la recherche en cours de financement (`setGoal`,
  `reserveOf`, `tryResearch`). Sans elle, la file dira « monte la mine de
  cristal 14, payable maintenant » pile sur les ressources que le joueur
  accumulait pour Astrophysique — exactement le mauvais conseil pour quelqu'un
  censé suivre sans vérifier. Et les blocages affichés (« dans 1 h 10 »,
  « manque 12 k ») sont par nature des projections.

  Il faut donc sortir de `simulateDay` un moteur de projection appelable seul :
  stocks dans le temps, réserves engagées, date à laquelle une action devient
  payable. `pickBuildings` en dépend aussi — il lit `p.st` et un `ctx` qui
  n'existent que dans la boucle de session — et doit être rebranché sur ce
  moteur plutôt que réécrit.
- Les onglets « Outils » et ses sous-vues comme destinations : leur contenu
  devient le détail d'une ligne.
- Le **plan manuel** (`S.plan`) : le joueur ne s'en est jamais servi, et il
  contredit le principe — c'est la file qui décide de l'ordre. Avec lui
  partent une source d'`adviceList`, l'écran d'édition du plan, et le
  remappage d'index que `applyGame` fait pour le préserver.

### Le rafraîchissement

`content.js` envoie un instantané toutes les 5 secondes dès que la page change,
et `refresh()` réécrit tout le panneau. Les détails dépliés contiennent des
formulaires à état (`S.colo`, `S.fleetCalc`, le coller-rapport d'espionnage).

Donc : **l'ordre de la file est gelé tant qu'un détail est ouvert**, et chaque
action porte une clé de rendu stable pour que sa ligne ne se recrée pas sous le
curseur. Les chiffres, eux, continuent de se mettre à jour.

## Ce qui reste au constructeur

- La forme exacte de l'objet « action » et la façon dont les sources existantes
  s'y déversent. C'est la pièce centrale : une fonction qui collecte toutes les
  sources, les normalise, les classe et rend une liste.
- Le découpage des fichiers. `app.js` fait 1542 lignes ; le projet est
  l'occasion de le séparer, mais sans introduire d'étape de build.
- Le seuil de péremption de chaque donnée.
- Le nombre de lignes affichées dans « Ensuite » : commencer à cinq, ajuster à
  l'usage.
- Les textes d'explication « première fois ». Ils doivent être écrits comme le
  reste de l'application : tutoiement, direct, sans emoji, avec les noms
  français exacts du jeu.
- La migration de l'état enregistré : les joueurs existants — un seul,
  aujourd'hui — ne doivent pas perdre leurs niveaux saisis à la main.
