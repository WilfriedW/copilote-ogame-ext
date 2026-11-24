# Copilote OGame — Le mode lune, qui dit quoi faire et quand

Document de conception, 24 novembre 2026. Projet.

## Intention

Le joueur a mené un tir de lune à la main aujourd'hui, la carte Outils › Lune
en appui. Ce qui lui a manqué n'est pas un chiffre — il les avait tous, et
justes. C'est que personne ne lui dise **maintenant** : sors ta flotte avant
l'impact, ramène les recycleurs après.

Il demande donc que le copilote porte l'opération comme un objectif, et sorte
la bonne carte au bon moment, comme il le fait déjà pour une file qui se vide.

**Et l'opération est croisée.** Son camarade tire chez lui, puis il rend la
pareille — autant de tirs qu'il en a reçus. Le mode porte donc les deux côtés :
celui où il reçoit, et celui où il doit. Le second n'a pas la même forme : il
n'y a rien à mettre à l'abri, mais il y a des chasseurs à construire et une
dette à tenir.

Le copilote a déjà exactement cette forme, et c'est elle qu'on reprend : le
**mode nuit**. Un interrupteur dans Aujourd'hui (`app.js:5033`), et une seule
ligne au fond qui refait les cartes — `return S.day.night ? out.filter(m => m.q
=== 'Sécurité') : out` (`app.js:3725`). Un réflexe acquis devant, presque rien
derrière.

## Objectifs

- Un interrupteur **Lune** dans Aujourd'hui, voisin du 🌙.
- Tant qu'il est allumé, les cartes du tir passent **devant** le reste du plan.
- Avant l'impact : sortir la flotte, en disant ce qu'elle vaut.
- Après l'impact : ramener les recycleurs, et dire si une lune est née.
- Compter les tirs déjà encaissés, et le dire honnêtement.
- Rappeler le nombre de vaisseaux à demander au camarade, repris de la carte
  Lune.
- **Du côté où il rend** : savoir combien de tirs il doit, combien de chasseurs
  légers il lui manque pour le prochain, et le lui dire quand il les a.

## Non-objectifs

- **Lire l'attaque dans la page du jeu.** C'est l'approche B, une couche
  au-dessus de celle-ci, et elle attend d'être construite sur du HTML réel
  plutôt que deviné. Tant qu'elle n'existe pas, le joueur saisit l'heure
  d'impact que son camarade lui annonce — il l'a de toute façon.
- **Pousser la défense.** L'arithmétique de la carte Lune dit qu'elle ne rend
  pas la lune moins chère, seulement les tirs moins nombreux. Un mode qui la
  pousserait contredirait le calcul affiché deux onglets plus loin. Du côté où
  le joueur reçoit, il n'a donc rien à construire et rien à épargner : son
  camarade paie le tir.
- **Dimensionner le tir qu'il rend.** Il faudrait connaître la défense du
  camarade, que le copilote ne voit pas. Le nombre vient du camarade, et le
  joueur le saisit.
- **Les lunes comme objets du modèle.** Toujours pas. Le copilote ne saura
  jamais qu'une lune est née : le joueur le lui dit.
- **Vider le plan, comme le mode nuit.** Une campagne dure des jours, et le
  joueur continue de construire entre deux tirs. Le mode lune **ordonne**, il
  ne filtre pas.
- **Une durée de mode.** Le joueur a parlé de « pour X heures » ; l'ancre
  retenue est l'heure d'impact, pas un compte à rebours de mode. Deux horloges
  à tenir d'accord en vaudraient une fausse.
- Automatiser quoi que ce soit : le copilote ne clique pas, il dit.

## Anti-objectifs

Des échecs, même si le code marche :

- **Laisser croire que les chances montent après un raté.** Chaque tir vaut ce
  que la configuration dit, que ce soit le premier ou le neuvième. La page
  `Moonchance` du wiki renvoie elle-même au sophisme du joueur. Une carte qui
  dirait « plus que 3 tirs » serait un mensonge qui coûte des dizaines de
  millions à un tiers.
- **Dire « sors ta flotte » après l'impact.** Pire que de se taire : le joueur
  agit sur une carte qui a déjà tort.
- **Se taire avant.** Son symétrique, et c'est le mode nuit qui l'apporte :
  voir « Nuit et lune » plus bas.
- **Affirmer que la flotte est déjà dehors.** La relecture a montré que le
  modèle ne peut pas le savoir : `S.moves` ne porte aucun compte de vaisseaux
  et des coordonnées plutôt qu'un identifiant de planète, et `p.ships` est le
  dernier relevé au sol, qui peut dater d'avant le départ. Un faux « elle est
  dehors » coûte exactement les millions que la carte existe pour sauver. Le
  copilote ne l'affirmera donc jamais.
- **Un compte à rebours qui tourne encore sur une heure périmée.**
- **Une carte lune qui survit à l'extinction du mode.**
- **Envoyer ramasser les débris sans rappeler la règle de pushing**, que
  l'onglet Lune porte déjà.
- **Chiffrer une flotte au sol sur un relevé d'il y a trois jours sans le
  dire.** La carte Lune porte l'âge du relevé ; celle-ci en hérite.

## Ce que ce document change dans les décisions du projet

Deux règles écrites ailleurs tombent ici, et il vaut mieux le dire que
l'enfreindre sans le voir.

**`2026-11-18-demande-de-flotte-design.md` écrit « le copilote ne proposera
aucun chasseur, croiseur ou vaisseau de bataille », avec quatre raisons.** Les
quatre tombent pour des munitions de tir de lune :

1. « Le chiffre ne peut pas être tenu » — il valait pour un écran de combat à
   dimensionner. Ici le nombre est exact et vient du camarade.
2. « Le besoin ne dure pas » — il valait pour une cible inactive qui vit deux
   heures. Une campagne de lune dure des jours, et la planète d'un camarade ne
   se périme pas.
3. « Le marché est mauvais » — ce n'est pas un pillage, c'est un échange de
   lunes.
4. « Ce que le joueur cherchait est ailleurs » — il cherchait bien ceci.

Le copilote proposera donc des chasseurs légers, **et seulement pour ce
lecteur-là** : tant que le mode lune est allumé et qu'une dette reste à rendre.
La règle générale ne bouge pas.

**La conception du matin a déjà ouvert la porte** en posant les dix coûts de
coques dans `SHIP_COST` « pour ce seul lecteur ». Ce document est le second.

## Contraintes

- **`dailyMissions()` ordonne les cartes entre elles, et rien de plus**
  (`app.js:3459`). L'ordre de la page vient de `REFRESH.today()`, qui pose
  d'abord `s0.acts` — les constructions à lancer — puis les missions, dans la
  même liste (`app.js:4762`). Trier dans `dailyMissions()` ne met donc jamais
  une carte devant « Monte Métal 21 ».
- **`taskHtml` câble deux boutons sur toute mission** (`app.js:4760`) : `Fait`,
  qui masque la carte pendant `m.every` heures (`missionDone`, `app.js:3750`),
  et `Non`, qui la met de côté jusqu'à ce que le joueur la remette à la main
  (`refused`, `app.js:3740`). Un « Non » de réflexe tuerait la carte pour toute
  la campagne.
- **La zone « Maintenant » est réécrite toutes les 30 secondes**
  (`app.js:5283`) et `refresh()` ne rappelle pas `bind()` (`app.js:1739`). Un
  champ de saisie posé dans une carte perdrait le focus et n'aurait aucun
  écouteur. Les champs qui marchent vivent dans le squelette des `VIEWS`.
- **Une clé de premier niveau ne se synchronise pas** si elle n'est pas dans
  `SYNC_KEYS` (`app.js:5470`), et le joueur joue sur deux postes.
- **La combinaison qui compte — `morts = min(envoyés, ce que la défense tue)` —
  n'est pas une fonction** : elle est en ligne dans `REFRESH.moon()`
  (`app.js:4911`).
- Le copilote ne voit pas l'attaque arriver (`content.js:185`).
- **Le copilote ne voit rien de la planète du camarade** : ni sa défense, ni ce
  qu'elle tuerait. Le nombre à envoyer ne se calcule pas ici.
- `SHIP_COST.lf` existe depuis ce matin, et `shipTime()` chiffre déjà une durée
  de chantier spatial (`app.js:3051`).
- Lecture seule. Aucun chiffre affiché n'est estimé en silence.

## Approches

| | Ce que ça donne | Pourquoi pas |
| --- | --- | --- |
| **A. Un mode sur le patron du mode nuit, l'heure d'impact saisie** | retenue | — |
| B. Le même mode, mais le copilote lit l'heure dans la boîte d'événements | plus rien à taper, et l'événement apparaît au lancement de la flotte, précisément quand il faut bouger | c'est une **couche sur A**, pas une alternative. Et elle demande un relevé neuf dans une page du jeu, là où `test/page.js` n'a pas de cascade CSS — un sélecteur cassé passe toutes les vérifications. Elle se construira sur le HTML d'un vrai tir |
| Une priorité « lune » dans `S.prio` | se brancherait sur une liste qui existe | une priorité, dans le glossaire du projet, est un **niveau visé** pour un bâtiment ou une recherche. Un tir de lune n'a ni niveau ni achèvement par niveau |
| Une checklist dans l'onglet Outils › Lune | presque gratuit | rien n'atteint Aujourd'hui, rien ne connaît l'heure |
| Le mode pilote aussi la construction | répondrait littéralement à « optimiser » | l'arithmétique de la carte dit que la défense ne change pas le prix d'une lune. Le mode dirait le contraire de ce que le copilote affiche deux onglets plus loin |

## Ce qui est décidé

### L'état

```
S.lune = { on, impact, tirs, rendu: { coords, n, dus, faits } }
```

- `on` — l'interrupteur.
- `impact` — l'instant du prochain tir reçu, en millisecondes, ou `null`.
- `tirs` — `{ [pid]: n }`, le nombre de tirs encaissés **par planète**.
- `rendu.coords` — la planète du camarade.
- `rendu.n` — le nombre de chasseurs légers par tir, **que le camarade annonce**.
- `rendu.dus` — le nombre de tirs promis.
- `rendu.faits` — le nombre déjà envoyés.

**Pas de `pid`.** La première rédaction en portait un tout en affirmant ne rien
dupliquer : la planète visée est déjà `S.moonCalc.pid`, que lisent
`moonPlanete()` (`app.js:3925`) et donc toute l'arithmétique. Deux champs qui
divergent feraient chiffrer deux planètes différentes dans deux onglets. Le
mode lit `moonPlanete()`, point. Et comme le joueur peut en changer, `tirs` est
une table par planète plutôt qu'un compteur unique.

**`lune` entre dans `SYNC_KEYS`.** Une campagne dure des jours et le joueur a
deux postes ; une heure d'impact absente ou un compteur plus bas d'un côté est
précisément ce que la synchronisation existe pour éviter. `on` voyage avec : un
mode allumé décrit la même campagne des deux côtés.

### Nuit et lune

Le filtre de la nuit ne garde que `q === 'Sécurité'` (`app.js:3725`). Un impact
à 2 h du matin ferait donc disparaître la carte la plus critique de toutes —
l'anti-objectif pris par l'autre bout.

**La rubrique `Lune` échappe au filtre de la nuit**, au même titre que
`Sécurité`, et pour la même raison : sortir sa flotte avant un impact *est* de
la mise à l'abri. Les deux interrupteurs cohabitent sans s'éteindre l'un
l'autre.

### L'ordre : devant les constructions, mais seulement quand ça compte

Trier dans `dailyMissions()` ne suffit pas, et la conception le croyait. Donc :

- **Hors fenêtre d'urgence**, les cartes `Lune` passent en tête des missions, et
  le plan garde sa forme — le joueur continue de monter ses mines entre deux
  tirs.
- **Dans la fenêtre d'urgence** (une heure avant l'impact, à ajuster), la carte
  Lune passe **avant `s0.acts`** dans `REFRESH.today()` (`app.js:4762`). À ce
  moment-là, « Monte Métal 21 » n'a aucune raison d'être au-dessus de « sors ta
  flotte, 7 M à ta charge ».

C'est plus de chantier que la ligne unique du mode nuit, et l'intention le
disait trop vite.

### Les cartes ne sont pas des missions ordinaires

Les cartes `Lune` **sautent le filtre `missionDone` / `refused`**
(`app.js:4749`) : leur état vient de `S.lune`, pas d'une mise en sommeil. Elles
ne portent donc ni `Fait` ni `Non` génériques, mais leurs propres boutons :

| État | La carte | Son bouton |
| --- | --- | --- |
| `impact` absent | « Demande-lui N chasseurs légers. Dis-moi ensuite quand il arrive. » | *(aucun : la saisie est dans l'onglet Lune)* |
| `impact` à venir | « Sors ta flotte de HQ 88 4 — impact dans 1 h 12. 4,26 M métal et 2,95 M cristal à ta charge si elle reste. » | `Flotte sortie` |
| `impact` passé | « Le tir est passé. Ramène tes recycleurs : 2 voyages. Si tu es le mieux classé des deux, préviens un Game Operator avant de ramasser. » | `Lune ? Oui / Non` |

`Non` → `tirs[pid]++`, `impact` revient à `null`. `Oui` → le compteur de cette
planète repart à zéro et le mode s'éteint : une campagne réussie ne lègue pas
son compteur à la suivante.

**La carte d'avant-impact ne disparaît pas sur `Flotte sortie`** : elle devient
une ligne calme qui rappelle l'heure. Le copilote ne peut pas vérifier que la
flotte est partie, et il ne le prétend pas.

**Un impact passé de plus de 24 heures sans réponse** change de texte : la carte
demande ce qui s'est passé au lieu d'envoyer chercher des débris qui ne sont
plus là.

### La saisie de l'heure

**Dans l'onglet Outils › Lune**, pas dans la carte : la zone « Maintenant » est
réécrite toutes les 30 secondes sans relier ses écouteurs, et un champ y
perdrait le focus à chaque passage.

**Un `datetime-local`**, pas une heure seule. « Impact à 00:40 » saisi à 23:50
est ambigu, et `S.lune.impact` est un instant absolu.

### La probabilité, recalculée et jamais figée

La première rédaction écrivait 10,8 % quand la conception du matin écrivait
12 % sur le même relevé : la preuve que le chiffre vient de la configuration et
non d'une constante. **La chance se recalcule à chaque rendu**, depuis
`S.moonCalc`, `S.settings.debris` et ce que la défense tue. Figer la chance de
chaque tir passé demanderait de les stocker un par un, pour une exactitude dont
le joueur ne fera rien.

Conséquence assumée, et la carte le dit : s'il change le nombre de vaisseaux en
cours de campagne, la phrase « X % des joueurs auraient déjà leur lune » parle
de la configuration d'aujourd'hui.

**Si la configuration donne 0 %** — sous 100 000 de débris, ou une défense qui
ne tue rien — la carte dit que le tir ne vaut rien et pourquoi, au lieu
d'afficher « 0 % des joueurs auraient leur lune ».

**`morts = min(envoyés, ce que la défense tue)` sort de `REFRESH.moon()`** et
devient une fonction que les deux appellent. La contrainte « le mode ne
recalcule rien » ne tenait pas sans ça.

### Le côté où il rend

Deux cartes de plus, qui ne vivent que tant que `rendu.faits < rendu.dus` :

| Condition | La carte | Son bouton |
| --- | --- | --- |
| moins de `rendu.n` chasseurs légers au sol | « Il te manque 340 chasseurs légers pour le tir que tu lui dois (4 sur 9). Chantier spatial : 1,02 M métal, 0,34 M cristal, ~6 h. » | *(aucun : c'est le plan qui construit)* |
| au moins `rendu.n` au sol | « Tes 900 chasseurs légers sont prêts. Envoie-les sur 1:140:8, mission Attaquer. » | `Envoyé` |

`Envoyé` → `rendu.faits++`. Quand `faits` atteint `dus`, les deux cartes
s'effacent et le mode dit la dette soldée.

**Le plan construit vraiment ces chasseurs.** C'est la seule chose que le mode
change à ce que le joueur bâtit, et elle ne vaut que tant qu'une dette reste :
le chantier passe par le même chemin que les transporteurs et les sondes
(`app.js:3051`), à la planète qui porte déjà la flotte.

**Le copilote ne dit jamais combien envoyer.** `rendu.n` est ce que le camarade
a demandé, saisi dans l'onglet Lune à côté de ses coordonnées. Le copilote ne
voit pas sa défense ; prétendre la chiffrer serait inventer.

### Le nombre à demander

Celui de la jauge « Pour X % » de l'onglet Lune, **plafonné par ce que la
défense tue** — c'est le plafond qui décide, comme la carte le montre déjà.
Jamais `S.moonCalc.n`, qui vaut 0 tant que le joueur n'a rien saisi.

## Ce qui reste au constructeur

- La formulation exacte des trois cartes, et la place du bouton dans la barre
  d'Aujourd'hui, à côté du 🌙.
- Le seuil d'urgence : une heure est un point de départ, pas une règle.
- `lune` dans `sample()`, la ligne de migration à côté de `app.js:143`, les
  noms exportés dans `loadApp` (`test/run.js:31`), et la mise à jour de
  `docs/comment-ca-marche.md` — le tableau des réglages et la section 6.
- **Les tests**, dans `test/run.js` : un impact à venir sort la carte « sors ta
  flotte » et pas l'autre ; un impact passé sort la carte recycleurs et aucun
  compte à rebours ; un impact passé de 25 h demande ce qui s'est passé ; le
  mode éteint ne sort aucune carte Lune ; mode nuit **et** mode lune allumés,
  la carte Lune est toujours là ; dans la fenêtre d'urgence elle est avant les
  constructions, hors fenêtre elle est après ; `Oui` remet à zéro le compteur
  de cette planète et pas celui d'une autre ; une configuration à 0 % ne dit
  jamais un pourcentage de joueurs ; `syncOut()` emporte `lune` ; sans dette à
  rendre, aucun chasseur léger n'entre dans le plan ; avec une dette, il en
  entre et il en sort dès que `faits` atteint `dus` ; `Envoyé` incrémente
  `faits` et pas `tirs`.
