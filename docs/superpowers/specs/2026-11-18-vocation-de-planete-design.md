# Copilote OGame — Chaque planète a une vocation, une planète est le centre

Document de conception, 18 novembre 2026. Projet.

## Intention

Le joueur veut savoir à quoi sert chacune de ses planètes : celle-ci fera le
cristal, celle-là la recherche. Le copilote ne le dit nulle part, et surtout
il ne le décide pas.

Deux choses se cachent sous le mot « rôle », et les confondre est la faute
d'aujourd'hui :

**La vocation** est ce que le terrain donne. La position 1 donne +40 % de
cristal, la position 8 donne +35 % de métal, une planète froide donne du
deutérium (`production`, `app.js:819-823`). Elle ne se choisit pas : elle se
lit. Le plan en tient déjà compte tout seul — `rankUpgrades` (`app.js:871`)
classe les mines par amortissement, et son calcul connaît le bonus de
position et la température. Ce qui manque n'est pas une consigne, c'est une
phrase : le joueur n'a nulle part où lire ce que sa planète est.

**La charge** est une décision. Où vit le labo ? Où vit le chantier ? Le
copilote ne décide ni l'un ni l'autre : `labP` (`app.js:1641`) est « celle
qui a déjà le plus haut labo », donc sur un empire neuf, où toutes sont à
zéro, c'est la première de la liste. Le premier labo de la partie atterrit
par accident, et il y reste pour toujours parce que la règle se nourrit
d'elle-même. Même chose pour le chantier, posé au gré du vaisseau de
colonisation et des transporteurs (`pickBuildings`, `app.js:1535-1541`).

Un rôle par planète existe pourtant déjà (`ROLES`, `app.js:2776`), avec un
menu sur chaque carte et une suggestion « (conseillé) ». Il n'est lu nulle
part : `roleOf` ne sert qu'à remplir son propre menu. Le choisir ne change
rien.

## Objectifs

- Chaque planète porte une vocation lisible, avec la raison qui la fonde.
- Un centre choisi et dit : la planète où vivent le labo et le chantier.
- Le plan y monte le labo et le chantier, au lieu de les subir.
- Le joueur reprend la main sur ce choix.

## Non-objectifs

- Toucher au classement des mines. `rankUpgrades` fait déjà mieux qu'une
  étiquette, et c'est lui qui garantit que « amorti en 3 j » est vrai.
- Lire la page Empire du jeu. Tout ce qu'il faut — position, température,
  niveaux — est déjà là.
- Lire le nombre de cases réel d'une planète. Le choix du centre se fait sur
  la moyenne de la position (`POS`, `app.js:1104`), et la carte le dit.
- Le Réseau de recherche intergalactique. Le wiki confirme qu'il fait compter
  plusieurs labos à la fois, et le copilote n'en sait rien : il raisonnera sur
  le seul labo du centre, ce qui est exact sans réseau et pessimiste avec.
- Une charge par planète. Il y a un centre, pas un par planète.
- Inventer un besoin de flotte. Le copilote ne propose aucun vaisseau de
  combat aujourd'hui ; le centre dit où, pas combien.

## Anti-objectifs

Des échecs, même si le code marche :

- Conseiller un labo 1 sur une planète alors qu'un labo 12 existe ailleurs.
  Le copilote ferait payer deux fois la même chose, et c'est le pire conseil
  qu'il puisse donner.
- Une vocation annoncée sans sa raison. Le joueur ne peut pas la contredire,
  donc il ne peut pas lui faire confiance.
- Une vocation devinée sur une planète dont la position ou la température
  manque. L'inconnu se dit, il ne se remplace pas par 8 et 20 °C.
- Un centre qui change de planète d'une connexion à l'autre.
- Un rôle qui déplace le classement des mines par la bande : le chiffre
  d'amortissement doit rester celui que le jeu donnera.

## Contraintes

- **`hubIndex()` sert à cinq choses.** Destination des transports
  (`app.js:1675`), planète de départ d'un raid (`app.js:2791`), planète des
  liens de mission (`app.js:271`), ouverture de la galaxie (`app.js:281`), et
  le conseil de rôle lui-même (`app.js:2778`). Quatre deviennent le centre ;
  le raid n'en est pas une, voir plus bas.
- **Le copilote ne lit pas le nombre de cases d'une planète.** Il connaît la
  moyenne de la position (`POS`, `app.js:1104`), pas la planète.
- **Une planète se désigne par son id local** (ADR 0001). Un centre est donc
  un id, et un id qui ne répond plus ne désigne aucune planète : le centre
  retombe sur le choix automatique, sans se rabattre sur une voisine.
- **Pas de donnée nouvelle.** Ni requête, ni page à lire, ni champ à saisir.
- **Le faux DOM de `test/page.js` lève sur un sélecteur inconnu** : rien ici
  n'ajoute de sélecteur, mais le plan doit rester simulable par `test/run.js`.
- OGame interdit l'automatisation : le copilote pose des liens, il ne clique
  pas (`app.js:224`).

## Approches

### À quoi sert le rôle

| | Ce que ça donne | Pourquoi pas |
| --- | --- | --- |
| **Le rôle nomme, et place les bâtiments d'empire** | retenue | — |
| Le rôle pondère l'amortissement : la ressource du rôle voit son gain majoré dans `rankUpgrades` | la mine « du rôle » remonte visiblement | le rôle passe devant le rendement réel, et le « amorti en 3 j » affiché devient faux — c'est ce que le projet évite partout ailleurs |
| Le rôle pose des plafonds : sur une planète « deutérium », le métal s'arrête | simple à dire | en OGame toutes les mines finissent rentables partout ; le plafond laisse de la production au sol et rien ne dit quand le lever |

### Combien de centres

Le joueur a d'abord demandé deux centres, puis a renvoyé la question au wiki.
Le wiki y répond directement, et il répond **un**.

La page [Vault Planet](https://ogame.fandom.com/wiki/Vault_Planet) décrit
exactement l'objet de cette conception — « a planet that a player uses as his
or her main plane, or hub » — et dit ce qu'on y fait : elle « should build
most of your fleets, defenses, and do most of the research ». Les trois sur
la même planète. Il n'y a pas, dans la stratégie du jeu, une planète de
recherche distincte d'une planète de chantier : il y a une planète haute et
des planètes à mines.

| | Ce que ça donne | Pourquoi pas |
| --- | --- | --- |
| **Un centre, celui que le wiki appelle Vault Planet** | retenue | — |
| Deux centres, recherche et chantier | sépare deux chaînes qui consomment chacune des cases | le wiki les met au même endroit ; et séparer obligerait les cinq usages de `hubIndex()` à choisir leur camp, pour une distinction que le jeu ne fait pas |

La page apporte trois règles que je n'avais pas, et chacune change le choix :

- **Le centre est la plus grande planète, et ce n'est pas la planète mère.**
  « Vault Planets should generally be the biggest planet that a player has,
  for they allow the most buildings. Home planets should not be a Vault,
  because they have limited numbers of fields. » C'est exactement ce que fait
  `labP` aujourd'hui sur un empire neuf : il prend la première de la liste,
  donc la mère.
- **La position 8 est la bonne.** Plus grandes planètes du jeu (204 cases en
  moyenne contre 127 en position 15) et température médiane, donc du
  deutérium correct *et* des satellites corrects. C'est déjà ce que `POS`
  (`app.js:1104`) et `bestPosition()` savent.
- **Un joueur de flotte n'en veut pas.** « For a Fleeter however, your
  planets should be spread out so that you won't be frequently attacked. In
  that case, it is unnecessary to have a vault planet. » Le copilote connaît
  déjà la stratégie choisie, `S.day.focus` (`app.js:89`).

Elle nomme aussi le risque, et le copilote le dira : « any Fleeter can
identify it and focus attention there ».

Et elle confirme le non-objectif sur les mines : « if a player builds mine
levels higher on this planet than others, it is very inefficient in use of
resources ». Le centre porte des bâtiments, pas des mines plus hautes.

## Ce qui est décidé

### La vocation se lit, elle ne se choisit pas

Trois vocations : **métal**, **cristal**, **deutérium**. Elles décrivent le
terrain, et le terrain ne se négocie pas — il n'y a donc pas de menu pour
en changer.

**Une planète porte la vocation d'une ressource quand elle est la meilleure
de ton empire sur cette ressource.** Comparer les trois ressources d'une
planète entre elles ne dit rien d'utile : au taux 3:2:1 le deutérium
l'emporte presque toujours, et les quinze planètes seraient « deutérium ».
Ce que le joueur demande est une comparaison entre planètes : *la* planète à
cristal.

Trois conséquences, et elles sont voulues :

- **Une ressource sur laquelle toutes tes planètes se valent ne donne de
  vocation à personne.** `POS_BONUS_C` (`app.js:1126`) ne couvre que les
  positions 1 à 3 : un empire sans aucune planète en 1, 2 ou 3 n'a pas de
  planète à cristal, et le copilote le dit au lieu d'en désigner une au
  hasard.
- **Une planète peut n'être première nulle part.** Elle n'a alors pas de
  vocation marquée, et c'est une information vraie : rien ne la distingue.
- **Une planète peut être première sur deux ressources.** Elle les porte
  toutes les deux. « Métal et deutérium » est une phrase utile ; en couper
  une au hasard ne l'est pas.

Un empire d'une seule planète n'a rien à comparer : aucune vocation, et la
carte le dit ainsi. C'est le début de partie, et c'est exact — une planète
seule n'est spécialisée en rien.

**Le terrain se mesure à niveaux égaux, et sur le terrain seul.** On appelle
`production(p, ov)` en neutralisant tout ce qui n'est pas le sol :

```
{metal: L, crystal: L, deut: L, fusion: 0, crawlers: 0, solar: <assez pour factor === 1>}
```

`L` vaut 20, et la valeur n'a pas d'importance tant qu'elle est la même
partout et non nulle — à zéro, les trois taux de deutérium valent zéro et il
n'y a plus rien à classer. `fusion` est remis à zéro parce que `dFus`
(`app.js:823`) est retranché du deutérium : une centrale de fusion n'est pas
un trait du sol. `crawlers` de même, qui entre dans `common`.

**Le bonus de forme de vie reste dehors.** `lfBonusOf` (`app.js:762`) ajoute
des montants forfaitaires lus sur le panneau de production du jeu, avec une
durée de validité de sept jours. Les laisser entrer ferait changer la
vocation d'une planète toute seule, le jour où la lecture périme — un
anti-objectif — et leur poids face à `30*g(L)` dépendrait du `L` choisi, ce
qui n'est pas une mesure de terrain.

**Ce qui manque se dit.** Des coordonnées illisibles (`parseC` rend null)
donnent « vocation inconnue ». La température, elle, est toujours un nombre
(`app.js:3233` la force avec `parseInt(el.value)||0`) : 0 °C est une
température froide légitime, pas une absence, et le copilote ne cherche pas
à distinguer les deux. Poser un `tmax: null` pour y arriver coûterait une
migration pour un cas que rien ne signale.

**La raison voyage avec la vocation.** « Cristal — position 1, +40 %, la
seule de ton empire » ; « Deutérium — 48 °C, la plus froide de tes six
planètes ». Une vocation sans raison est un anti-objectif.

### Une seule charge : le centre

L'état enregistré n'est plus un rôle par planète mais un id :

```
S.centre = <id|null>
```

`null` veut dire « le copilote choisit ». Un id qui ne répond plus est traité
comme `null` (ADR 0001 : il ne se rabat jamais sur une voisine).

**`S.roles` disparaît au chargement**, comme `S.plan` avant lui
(`migratePlanetIds`, `app.js:154`) : rien ne le lisait, donc rien n'est perdu.

**La règle du choix automatique, en une phrase : les cases décident tant que
rien n'est bâti, le bâti décide ensuite.**

- **Stratégie « flotte » : pas de centre.** C'est `S.day.focus === 'fleet'`
  (`FOCUS`, `app.js:1351`) et cette valeur seule — `FOCUS_FLOTTE`
  (`app.js:1361`) compte aussi « Équilibré », qui est le réglage par défaut et
  n'est pas le joueur de flotte dont parle le wiki. Le copilote s'efface au
  lieu d'inventer. Les cartes disent pourquoi : tes planètes
  doivent rester dispersées.
- **Aucune planète n'a de labo ni de chantier** : le centre est la planète
  qui a le plus de cases attendues, `POS[pos].avg` (`app.js:1104`), parce
  qu'un centre est d'abord de la place. À égalité de cases, celle qui produit
  le plus. À égalité encore, une colonie passe devant la planète mère.
- **Un labo existe quelque part** : le centre est la planète qui porte le plus
  haut. Un labo payé est payé ; en déplacer un coûterait tout ce qu'il a déjà
  coûté, et c'est l'anti-objectif. Le centre ne bouge donc plus de lui-même.

  **Le chantier ne décide pas**, bien que ce document ait d'abord dit « le plus
  haut des deux ». La relecture de branche a montré ce que ça donnait : une
  colonie au chantier 12 emportait le centre à côté d'un labo 10, et le plan
  conseillait de repartir d'un labo 1 — l'anti-objectif, décidé par le copilote
  seul et non par le joueur. Pire, le centre basculait au premier chantier de
  transporteur qu'une colonie montait, contre la promesse qu'il ne bouge pas de
  lui-même. Le chantier n'a de toute façon rien à réclamer : le laisser
  derrière ne coûte rien, puisqu'une colonie monte le sien dès qu'elle en a
  besoin, alors que le labo est suivi par `labP` et `labLevel()`.

Ce n'est pas la règle d'aujourd'hui déguisée. Aujourd'hui, sur un empire neuf,
`labP` est la première planète de la liste parce que toutes sont à zéro —
c'est-à-dire la planète mère, que le wiki écarte nommément. Ce que cette
conception corrige est ce premier choix, celui qui engage toute la partie.

**Le copilote ne lit pas les cases réelles.** Il ne connaît que la moyenne de
la position, et une planète en 8 peut être sortie à 140 cases. La carte le
dit, et c'est précisément pourquoi le joueur garde la main.

**Le joueur reprend la main** par une case à cocher « Centre » sur chaque
carte de planète. Cocher ailleurs décoche ici : il n'y a qu'un centre. La
planète que le copilote aurait choisie porte « (conseillé) ».

**Le copilote obéit, et dit ce que ça coûte.** Désigner comme centre une
planète sans labo alors qu'un labo 12 existe ailleurs est exactement
l'anti-objectif ; mais c'est le joueur qui décide, et le copilote ne refuse
pas un choix. Il l'accepte et pose sur la carte ce que le choix engage :
« Le labo 12 de Hécate ne suit pas. Repartir d'un labo 1 ici coûterait
4,2 M. » Le plan, lui, fait ce qui a été demandé.

**Le risque se dit, une fois.** Sur la carte du centre : « Un espionnage
montre où tu bases ta flotte. Mets-la à l'abri comme ailleurs. »

### Ce que le plan en fait

Sans centre — stratégie « flotte », ou empire d'une seule planète — tout
ci-dessous retombe sur le comportement actuel. Rien ne casse.

- `labP` (`app.js:1641`) devient le centre, et non plus le plus haut labo.
- **`labLevel()` (`app.js:669`) devient le labo du centre**, et non plus le
  maximum de l'empire. Les deux coïncidaient par construction tant que `labP`
  était la planète du plus haut labo ; ils divergent dès que le joueur reprend
  la main. Or une recherche se lance depuis une planète, et c'est le labo de
  *cette* planète qui en fixe la durée (`app.js:673`), les prérequis (`reqOk`,
  `app.js:862`) et le `labNeed` que `nextResearch` calcule (`app.js:1397`).
  Laisser le maximum ferait lancer une recherche depuis un labo trop petit et
  annoncer une durée que le jeu ne tiendra pas.
- `pickBuildings` (`app.js:1533`) ajoute déjà `lab` quand `p === ctx.labP` :
  il garde sa règle et hérite du nouveau `labP`.
- **Le centre dit où, il n'invente pas un besoin.** Le copilote ne propose
  aujourd'hui aucun vaisseau de combat ni de transport : les seuls
  déclencheurs d'un chantier spatial sont le vaisseau de colonisation
  (`app.js:1529`) et `needsOwnCargo` (`app.js:1534`). Ces deux règles restent
  ce qu'elles sont — une colonie qui a besoin de ses propres transporteurs
  monte son chantier, centre ou pas. Ce que le centre change : quand un
  chantier de l'empire est en jeu plutôt qu'un chantier local, c'est le centre
  qui le reçoit, et c'est de lui que part le vaisseau de colonisation. Faire
  naître une demande de flotte est un autre sujet, et il mérite sa propre
  conception.
- `hubP`, la destination de repli des transports (`app.js:1675`), devient le
  centre. Le wiki dit la même chose de la Vault Planet : « Resources are
  gathered from other planets to this location. »
- `missionGo` (`app.js:271`) et `galaxyUrl` (`app.js:281`) prennent le centre.
  Un seul centre dissout la question de savoir lequel des deux ils
  désignaient.
- **`raidPlan` (`app.js:2791`) ne prend pas le centre.** Il lit `home.ships`
  pour composer le raid ; la bonne planète de départ est celle qui a les
  transporteurs. Un centre désigné à la main sur une colonie neuve donnerait
  un plan de raid sans vaisseaux, en silence. Il prend donc la planète de plus
  grande capacité de fret — ce que `donorsOf` (`app.js:540`) calcule déjà pour
  choisir sa base.
- `labPlanet()` (`app.js:668`) devient le centre, pour que l'étiquette
  « Recherche · <planète> » des cartes nomme la bonne.

### Ce que le panneau montre

Sur chaque carte de planète, dans la vue Empire : une ligne de vocation avec
sa raison, et la case « Centre ». La planète choisie par le copilote porte
« (conseillé) », comme le menu de rôle le fait déjà aujourd'hui
(`app.js:2882`).

Dans le plan, la carte qui propose un labo ou un chantier dit pourquoi là :
« Ton centre : c'est de là que partent tes recherches et tes vaisseaux. »

## Ce qui reste au constructeur

- Combien de `solar` il faut passer pour que `factor` vaille 1 à `L` = 20 :
  la boucle de `rankUpgrades` (`app.js:875`) montre comment le trouver.
- Le libellé exact des raisons, et la place de la ligne sur la carte.
- Comment une planète première sur deux ressources se lit en une ligne.
- Les tests, dans `test/run.js` : sur un empire neuf de deux planètes, le
  premier labo est conseillé sur celle qui produit le plus et non sur la
  première de la liste ; sur la fixture de `test/harness.js`, dont aucune
  planète n'est en position 1 à 3, aucune planète ne porte la vocation
  cristal ; avec `S.day.focus` sur la flotte, aucune planète n'est centre et
  le plan est celui d'avant.
