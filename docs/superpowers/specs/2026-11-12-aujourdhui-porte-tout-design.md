# Copilote OGame — Aujourd'hui porte tout

Document de conception, 12 novembre 2026. Fait suite à
`2026-11-12-plan-v3-design.md`.

## Intention

Le joueur ne se sert presque que de l'onglet **Aujourd'hui**. Il ne s'en
plaint pas : il craint de rater ce que les autres écrans contiennent.

L'audit répond à cette crainte, et la réponse n'est pas celle qu'on
attendait. Aujourd'hui couvre déjà presque tout, et ce que le filtre de
sévérité lui cache est, à deux exceptions près, de la redondance.

`adviceList()` est un moteur de la v1.8 que `simulateDay()` et
`dailyMissions()` ont rattrapé sans jamais le retirer. Ses conseils de
niveau `info` et `good` disent ce que les missions disent déjà :

| Conseil de `adviceList()` | Déjà dit par |
| --- | --- |
| `Astrophysique N pour une Nᵉ planète` (avec coût) | mission `colomax`, mêmes chiffres |
| `Avant de te déconnecter` | mission `night` |
| `Coloniser (n/max planètes)` | le flux colonie du moteur + `colomax` |
| `Construire <meilleur amortissement>` | l'action que `pickBuildings` propose |
| `Plan : lancer X` | le moteur consomme déjà `S.plan` |
| `Rétablir l'énergie` (`bad`) | `pickBuildings` ajoute `solar` |
| `Hangar plein` (`bad`/`warn`) | `pickBuildings` ajoute le hangar |

Lever le filtre ferait donc apparaître chaque chose deux fois. Le travail
est ailleurs : **réparer les deux manques réels, et retirer le moteur en
double qui les a masqués.**

### Les deux manques

**Les foreuses ne se comptent jamais.** Contrairement à ce qu'une
première lecture laissait croire, le moteur *propose* bien les foreuses :
la boucle du chantier les met en tête quand le classement les y met
(`app.js:1426-1427`, ajouté le 11 novembre). Le défaut est plus étroit,
et plus ennuyeux : **quand elles sont construites, le compte atterrit au
mauvais endroit.**

| Où | Ce qui est écrit | Ce que lit la production |
| --- | --- | --- |
| Fin de construction simulée, `app.js:1444` | `p.ships.crawl` | `p.crawlers` (`app.js:516`) |
| Fin du minuteur réel, `app.js:771` | `pl.ships.crawl` | `p.crawlers` |

Trois conséquences, toutes visibles par le joueur :

1. le gain de production des foreuses n'entre jamais dans le plan de la
   journée — le « Production +X % » est sous-évalué ;
2. `rankUpgrades()` lit `p.crawlers` (`app.js:596`), qui n'a pas bougé :
   le moteur reproposera les mêmes foreuses à la connexion suivante ;
3. seule une visite sur la bonne page du jeu remet le compte d'aplomb
   (`app.js:2626`).

**Le fil du début de partie.** `MILESTONES` (`app.js:655`) décrit onze
jalons, de *Labo 1* à *Astrophysique 1*, chacun avec sa raison et ses
prérequis manquants. Aujourd'hui l'exclut explicitement : `app.js:2205`
ne garde que `bad` et `warn`, puis retire « Prochaine étape » par
expression régulière. Son autre lieu d'affichage, `VIEWS.advice`, n'est
relié à aucun onglet.

### Ce que l'audit a cru à tort

Deux affirmations d'une première version de ce document sont fausses et
ne doivent pas guider le travail :

- « le moteur ne propose jamais les foreuses ». Il les propose. Le filtre
  `B[u.key]` qui les écarte est bien réel, mais il est dans
  `pickBuildings()`, la *file des bâtiments* ; la *file du chantier* a sa
  propre entrée.
- « il faut copier le patron des satellites ». Non : un nouveau
  `kind:'crawl'` casserait le dédoublonnage entre minuteurs manuels et
  minuteurs lus dans le jeu, qui apparie sur `g.k===t.k`
  (`app.js:2646`) et voit toujours `shipyard` côté jeu. Le chemin actuel
  passe par `kind:'shipbuild'`, qui pose `tm.k='shipyard'` et se
  dédoublonne correctement. **Il faut le garder.**

### Un point vérifié, pas un chantier

Le jeu publie son propre plafond de foreuses, que l'extension lit déjà
dans `parseProdPanel().crawlerMax` (`app.js:458`) sans le consommer. On
aurait pu croire qu'il contredit la formule `8 × (métal + cristal +
deutérium)`. Le relevé réel du 12 novembre dit le contraire : mines
21 / 17 / 17, le jeu affiche `Foreuse (Nombre : 0/440)`, la formule donne
440 (`test/run.js:1483-1491`). **Les deux concordent. Rien à brancher.**
Le chiffre lu reste disponible comme recoupement si un jour un bonus
d'espèce les sépare.

## Objectifs

- Aujourd'hui est le seul écran à consulter pour savoir quoi faire.
- Les foreuses construites comptent, dans la production comme dans le
  classement.
- Le joueur voit où il en est dans le début de partie, et ce qui le
  bloque.
- Une seule source dit quoi faire. Rien n'apparaît deux fois.
- L'application perd plus de lignes qu'elle n'en gagne.

## Non-objectifs

- Supprimer les onglets Empire, Outils et Réglages. Ils restent les
  écrans de saisie (niveaux, objectifs, réglages) et de consultation
  (cibles, calculateur de vol).
- Toucher à la navigation ou au nombre d'onglets.
- Ressusciter `VIEWS.build` ou `VIEWS.advice`.
- Brancher le plafond de foreuses lu dans le jeu (voir ci-dessus).

## Anti-objectifs

Ce qui ferait échouer le travail même s'il fonctionne :

- **Aujourd'hui devient un mur.** Si la page s'allonge au point qu'on
  cesse de la lire, on a déplacé le problème.
- **Deux moteurs se contredisent.** C'est la situation actuelle, et c'est
  elle qui a produit un écran mort d'un côté et un filtre de l'autre.
- **Une alerte disparaît silencieusement.** Retirer `adviceList()` ne
  doit faire perdre aucun avertissement que le joueur voyait hier.

## Contraintes

- `app.js` est un seul fichier, chargé comme script classique. Aucune
  dépendance, aucun outil de construction.
- Les tests tournent par `node test/run.js`, sans framework, avec un DOM
  factice. 231 tests au moment d'écrire.
- Tout le texte visible est en français, tutoiement.
- Le panneau n'ouvre que des pages du jeu. Il ne remplit aucun
  formulaire et ne lance rien (`app.js:164`).

## Approches

**A — Lever le filtre de sévérité.** Deux lignes en `app.js:2205`.
Écartée : `adviceList()` fait doublon presque partout, le joueur verrait
chaque chose deux fois. Du bruit, pas de l'information.

**B — Réparer ce qui manque, retirer le doublon.** Le compte des
foreuses est corrigé à la source ; le fil des jalons devient un bloc dans
*Ta journée* ; `adviceList()` disparaît, sa carte *Alertes* étant
réalimentée par le moteur lui-même. Une seule source de vérité, solde de
lignes négatif.

**C — B sans la suppression**, en gardant `adviceList()` comme filet.
Écartée par le joueur : le doublon n'est pas un filet, c'est la cause de
l'écart constaté.

**Retenue : B**, choisie par le joueur le 12 novembre.

## Le détail

### 1. Les foreuses construites comptent

Deux endroits écrivent dans `p.ships.crawl` au lieu de `p.crawlers`. La
correction porte sur eux, et sur rien d'autre.

- `app.js:1444`, l'événement de fin de construction de la boucle
  chantier : quand `k === 'crawl'`, créditer `p.crawlers` ;
- `app.js:771`, la branche `tm.k==='shipyard'` de `finishTimer()` : même
  aiguillage, en gardant le garde `!tm.game` — quand l'extension lit le
  vrai nombre sur les pages du jeu, c'est la lecture qui fait foi.

La boucle du chantier (`app.js:1426-1427`), le genre de carte
`kind:'shipbuild'`, le lien vers le chantier, le bouton « Lancé » et le
dédoublonnage des minuteurs restent **inchangés**.

*Décision prise faute de mieux :* le même aiguillage vaut pour les
satellites solaires achetés par cette boucle, s'il s'avère qu'elle peut
en produire — à vérifier au moment d'écrire, `p.sats` ayant le même
problème de destination que `p.crawlers`.

### 2. Le fil du début de partie

Un bloc dans la carte *Ta journée*, au-dessus des phases, tant que les
onze jalons ne sont pas tous franchis. Il disparaît ensuite de lui-même.

**Sémantique, décidée ici** (une première version mélangeait deux
sélecteurs et produisait un exemple incohérent) :

- le compte `7 / 11` est le **nombre de jalons franchis**, pas l'indice
  du suivant. Ils peuvent l'être dans le désordre : on peut tenir
  *Astro 1* sans *Ordinateur 2* ;
- « Prochaine étape » nomme le **premier jalon non franchi dans l'ordre
  de la liste** — celui que `milestoneMissing()` renseigne. C'est le
  sélecteur `next[0]` de `adviceList()`, pas `ready`.

```
Début de partie · 10 / 11
Prochaine étape : Labo 3
Requis pour Astrophysique.
```

La ligne « Il manque » n'apparaît que si `milestoneMissing()` renvoie
quelque chose, ce qui est rare : la liste est ordonnée de sorte que les
prérequis d'un jalon soient eux-mêmes des jalons antérieurs. Elle sert
aux cas où le prérequis échappe à la liste — un labo plus haut sur une
colonie que sur la planète mère, par exemple, puisque `milestoneDone()`
regarde la planète mère et `reqOk()` le meilleur labo de l'empire.

`MILESTONES`, `milestoneDone()`, `milestoneLabel()` et
`milestoneMissing()` (`app.js:655-669`) survivent à la suppression de
`adviceList()` : ils sont indépendants.

**Pourquoi dans *Ta journée* et pas dans *Maintenant*.** *Maintenant* est
une file d'actions, avec un bouton par ligne. Un repère de progression
n'est pas une action ; l'y mettre diluerait la file.

### 3. `adviceList()` disparaît, les alertes changent de source

C'est la pièce qui demande le plus de soin, parce qu'elle est la seule à
pouvoir perdre quelque chose.

**Le piège à éviter.** L'idée naturelle — récupérer les candidats que
`pickBuildings()` a calculés mais que la file n'a pas retenus — ne tient
pas, pour deux raisons :

1. la boucle est gardée par `if(p.bq>Tm) continue` (`app.js:1400`) :
   pendant toute construction en cours, `pickBuildings()` n'est pas
   appelé. Les alertes disparaîtraient dès qu'un bâtiment monte, c'est-
   à-dire la plupart du temps ;
2. `pickBuildings()` ajoute aussi `if(pr.factor<1 && !satsSoon)`
   (`app.js:1159`) : l'alerte énergie se tait pendant que des satellites
   arrivent.

Les deux sont justes pour *choisir quoi construire*, et faux pour
*avertir*. Ce sont exactement les disparitions silencieuses que
l'anti-objectif interdit.

**La solution.** Une petite passe indépendante, `planetAlerts(p)`,
appelée par `simulateDay()` sur l'état de départ de chaque planète, sans
garde de file. Elle produit les deux seules familles d'avertissement que
`adviceList()` portait et que rien d'autre ne dit :

| Alerte | Seuil | Sévérité |
| --- | --- | --- |
| Énergie négative | `production().factor < 1` | `bad` |
| Hangar plein | stock ≥ 98 % de la capacité | `bad` |
| Hangar bientôt plein | plein dans moins de **8 h** | `warn` |

**Décision prise ici :** le seuil des 8 h est conservé, et non remplacé
par les « deux intervalles de connexion » de `pickBuildings()` (environ
2 h par défaut). Le texte d'origine dit « prévois-le avant une longue
absence » ; passer à 2 h retirerait l'avertissement au seul moment où il
sert.

Le résultat part dans `plan.alerts`, retourné avec le reste
(`app.js:1463`), et `REFRESH.today` en alimente la carte *Alertes*.

**L'exception à déplacer.** Un seul message de `adviceList()` n'a pas
d'équivalent : l'alerte « file vide » tirée de `S.lastAlerts` après un
import manuel de la Vue empire (`app.js:710`). Elle part dans
`dailyMissions()`, dont elle a la forme. *Décisions prises ici :*
`info:true` et `every:24`, comme les autres messages d'information.

**Ce qui est supprimé** : `adviceList()`, `VIEWS.advice`,
`REFRESH.advice`, `VIEWS.build`, `REFRESH.build`, et `SEV_LABEL` s'il ne
sert plus. `coloPaybackTxt()` et `astroForPlanet()` restent : la mission
`colomax` les utilise. Côté tests, `test/run.js:1050` vise `adviceList`
pour le conseil Astrophysique et doit viser la mission `colomax` ; et
`'adviceList'` doit sortir de la liste `want` de `test/run.js:24`, sans
quoi le harnais lève.

### 4. Où se voit le compte de foreuses

Une fois `VIEWS.build` supprimé, plus rien n'affiche
`Foreuses 120 / 440 utiles · +9,6 %` (`app.js:2287`). Or les foreuses
sont invisibles dans le jeu une fois posées, et le moteur ne les
mentionne que quand elles arrivent en tête du classement — donc jamais,
pour un joueur qui en a déjà sans en avoir assez.

**Décidé par le joueur le 12 novembre : dans Empire**, en pastille sur
la carte de chaque planète, à côté des jauges de production, reprenant
la formulation existante de `app.js:2287` :

```
Foreuses 120 / 440 utiles · +9,6 %
```

La pastille est verte quand le plafond est atteint, neutre sinon. Elle
ne s'affiche pas quand le plafond est nul, c'est-à-dire tant que les
mines ne permettent aucune foreuse.

C'est un état, pas une action : Empire est l'écran des niveaux et de la
production par planète, et le compteur y tient sa place sans allonger la
file d'Aujourd'hui. Ce choix nuance « tout porter » sur un point, et sur
un seul : Aujourd'hui porte tout ce qu'il y a **à faire** ; le détail
par planète reste dans Empire, où il était déjà.

## Ce qui est laissé au constructeur

- La mise en forme de la carte *Alertes* réalimentée.
- Le libellé final du bloc de progression.
- L'emplacement exact de la pastille de foreuses sur la carte de
  planète.
- L'ordre des pièces. Elles sont indépendantes ; la 1 est un défaut
  silencieux qui fausse les chiffres, donc la première à livrer.

## Vérification

`node test/run.js` doit passer en entier à chaque étape. Trois tests à
ajouter, un par pièce :

1. **Foreuses** : sur une planète où les foreuses sont en tête du
   classement, chantier libre et ressources réunies, la première session
   contient la carte correspondante ; après la fin du minuteur,
   `p.crawlers` a augmenté du bon nombre et `p.ships.crawl` n'a pas
   bougé. Un second passage du moteur ne repropose pas les mêmes
   foreuses. Avec `tm.game`, `p.crawlers` est laissé à la lecture du jeu.
2. **Jalons** : avec un état où *Labo 3* est le premier jalon non
   franchi et son prérequis manquant, le rendu d'Aujourd'hui contient le
   compte des jalons franchis et la mention du prérequis.
3. **Alertes** : sur une planète à énergie négative dont un hangar
   déborde aussi, la carte *Alertes* montre les deux — y compris quand
   la file de construction est occupée, et quand des satellites sont en
   route.
4. **Pastille de foreuses** : le rendu d'Empire porte le compte et le
   plafond d'une planète qui en permet, et ne porte rien quand le
   plafond est nul.

Vérification manuelle, dans le jeu : construire des foreuses depuis une
carte du panneau, puis confirmer qu'après le minuteur le « Production
+X % » du plan a bougé, et que le panneau n'en repropose pas aussitôt.
