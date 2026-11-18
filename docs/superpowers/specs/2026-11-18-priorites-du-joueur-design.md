# Copilote OGame — Le joueur pose une priorité, et le plan épargne pour elle

Document de conception, 18 novembre 2026. Projet.

## Intention

Le joueur se balade dans le jeu et voit des choses à faire. « Mon labo est
niveau 7 sur la principale, il faut qu'il monte à 10. » Il n'a aujourd'hui
aucun endroit pour le poser. Son seul recours est de demander qu'on change le
moteur, c'est-à-dire d'attendre une version de l'extension.

Deux choses manquent, et une seule compte :

**Noter** ne manque pas vraiment. Le panneau est le volet latéral de Chrome,
ouvert à côté du jeu pendant qu'il navigue ; il y a de la place pour un
champ.

**Être écouté** manque entièrement. Une liste d'objectifs manuelle a déjà
existé dans ce projet et elle est morte : commit `be101c4`, « suppression du
plan manuel ». `migratePlanetIds` (`app.js:154`) efface encore `S.plan` au
chargement, avec son épitaphe — « rien ne la lisait ». Le piège n'est pas de
noter l'intention, c'est de la faire lire par le plan.

Et le cas que le joueur cite n'est pas un réglage fin : **« labo 10 » est
aujourd'hui impossible à obtenir.** Le labo n'entre dans les candidats de
`pickBuildings` (`app.js:1614`) que s'il bloque une recherche de la feuille de
route (`labNeed`), et il est absent de `rankUpgrades` (`app.js:966`) parce
qu'il n'a aucun amortissement en production. Monter le labo pour la *vitesse*
de recherche est une raison que le moteur ne compte nulle part. Aucun réglage
existant — `focus`, « recherche avant les bâtiments », mode des formes de vie —
ne sait dire « cette cible-là, maintenant » : ils choisissent une stratégie,
pas une cible.

Le moteur, en revanche, sait déjà faire le travail. `simulateDay` a des
**objectifs** (`setGoal`, `app.js:1727`) : une cible chiffrée posée sur une
planète, qui réserve ses ressources (`reserveOf`, `app.js:1726`), fait
converger les rapatriements vers elle (`destOf`, `app.js:1804`), et fait
écrire sur la carte « Économisée depuis 14 h 30 ». Deux objectifs seulement
naissent aujourd'hui : la recherche critique et le vaisseau de colonisation.
Rien ne permet d'en déclarer un.

Une priorité du joueur est donc un objectif de plus, et la seule chose neuve
est qui le pose.

## Objectifs

- Le joueur pose une cible — un bâtiment ou une recherche, à un niveau visé —
  depuis le panneau, là où il lit déjà le niveau actuel.
- Le plan épargne pour elle : réserve sur la planète, rapatriements vers elle,
  carte en tête.
- Elle passe **devant** ce que le moteur se donnait comme objectif sur cette
  planète, et le plan dit ce qu'elle retarde.
- Elle vit jusqu'à ce qu'elle soit atteinte, ou que le joueur l'enlève.
- Le copilote obéit sans juger, et chiffre ce que le choix coûte.

## Non-objectifs

- **Un bouton sur la page du jeu.** `content.js` ne fait que lire ce que le
  panneau publie ; un retour page → panneau n'existe pas. Il coûterait un
  canal neuf pour gagner un clic, alors que le panneau est déjà à côté.
- **Une note en texte libre.** C'est exactement ce qui est mort avec `S.plan` :
  une phrase que le moteur ne sait pas lire. Une priorité est une cible
  chiffrée, ou elle n'est rien.
- **Les formes de vie.** Leurs prix sont estimés (`lfCost`, `app.js:405`) et
  elles ont déjà leur place réglable dans la journée (`LF_MODE`).
- **Les vaisseaux, la défense, les satellites, les foreuses.** Ils n'ont pas
  de niveau : la défense se compte par type (`defMix`), les transporteurs par
  besoin de soute. Une priorité y voudrait dire autre chose.
- **Résoudre la chaîne de prérequis d'un bâtiment.** « Nanites 1 » demande
  Robots 10 et Ordinateur 10 ; la priorité le dit et attend, elle ne décide pas
  de monter Robots pour autant. Les recherches, elles, héritent gratuitement de
  `resolveTech` (`app.js:1488`).
- **Réordonner la liste.** L'ordre est celui où les priorités ont été posées.
  On en retire une et on la repose.
- **Une échéance.** « Labo 10 avant ce soir » demanderait au plan de promettre
  une date qu'il ne contrôle pas.
- **Toucher au classement des mines.** `rankUpgrades` continue de dire la
  vérité sur l'amortissement ; une priorité passe à côté de lui, elle ne le
  fausse pas.

## Anti-objectifs

Des échecs, même si le code marche :

- **Une priorité posée qui ne change rien au plan, en silence.** C'est la
  mort de `S.plan`, et le seul vrai risque de cette conception.
- **Une planète gelée sans le dire.** Une réserve qui retient tous les
  chantiers d'une planète pendant deux jours, sans que la carte dise pour quoi
  elle épargne ni ce qui attend.
- **Le copilote qui refuse une priorité** parce qu'il la trouve mauvaise.
  Comme pour le centre (`labLaisse`, `app.js:2986`) : il obéit, et il chiffre.
- **Une priorité qui survit à son accomplissement.** Le labo atteint 10 et la
  carte le réclame encore.
- **Une priorité impossible qui attend sans rien dire.** Un coût plus grand
  que les hangars, un prérequis absent : `setGoal` refuse une attente infinie
  (`app.js:1730`) et rendrait `null` — la priorité disparaîtrait du plan sans
  un mot.
- **Deux réserves sur une planète.** `reserveOf` les additionne : la planète
  n'achète plus rien jusqu'à ce que les deux soient payables.

## Contraintes

- **Une planète se désigne par son id local** (ADR 0001). Une priorité de
  bâtiment porte un `pid` ; un id qui ne répond plus ne désigne aucune planète,
  et la priorité est muette, sans se rabattre sur une voisine.
- **`setGoal` refuse une attente infinie** et rend `null`. Tout ce qui rendrait
  l'attente infinie — coût au-dessus des hangars, production nulle dans une
  ressource — se traite avant, pas après.
- **`reserveOf` somme les objectifs d'une planète.** Une seule réserve à la
  fois par planète.
- **L'appelant de `pickBuildings` calcule une seule réserve pour toute la
  liste** (`app.js:1963`). Un candidat impayable en tête bloque donc tous les
  suivants : une réserve de priorité peut geler une planète entière, secours
  compris, si le `res` n'est pas calculé par candidat.
- **`tryResearch('pre')` passe avant les bâtiments** (`app.js:1776`) : une
  réserve de priorité doit être posée avant lui, sinon la recherche critique
  sert la première.
- **Le labo est absent de `rankUpgrades`** : aucun classement ne l'y fera
  entrer, un candidat forcé est le seul chemin.
- **Pas de donnée nouvelle.** Ni requête, ni page à lire côté jeu.
- **OGame interdit l'automatisation** : le copilote pose des liens, il ne
  clique pas (`app.js:224`).
- **Le plan doit rester simulable par `test/run.js`** sans DOM réel.

## Approches

### Ce qu'une priorité fait au plan

| | Ce que ça donne | Pourquoi pas |
| --- | --- | --- |
| **Un objectif d'épargne déclaré** | retenue | — |
| Un coup de pouce au classement : la cible remonte dans `rankUpgrades` | presque gratuit à écrire | sans épargne, « labo 10 » perd contre n'importe quelle mine amortie en 4 h, à chaque session, pour toujours |
| Une carte de rappel sans effet moteur | le plus simple | c'est `S.plan`, et on sait comment ça finit |

### Par où elle entre

| | Ce que ça donne | Pourquoi pas |
| --- | --- | --- |
| **Chacun son chemin** : une priorité de recherche se glisse en tête de la feuille de route avec le drapeau `'c'` ; une priorité de bâtiment devient un objectif et un candidat forcé | la recherche hérite gratuitement de `resolveTech`, du `labNeed`, du texte du pourquoi et du chemin `crit → setGoal` qui existe déjà | deux endroits au lieu d'un |
| Un seul chemin neuf, lu avant tout le reste, qui traite les deux | plus propre à lire | il faudrait refaire ce que `resolveTech` fait déjà : remonter les prérequis, le labo qui manque, les paliers intermédiaires. Du code qu'on réécrit mal |

### Précédence sur la planète

| | Ce que ça donne | Pourquoi pas |
| --- | --- | --- |
| **Devant, seule** : tant que la priorité n'est pas finie, c'est elle qui épargne, l'objectif du moteur attend | tombe presque tout seul — il suffit de poser l'objectif avant `tryResearch`, et `reserveOf` fait le reste | la recherche critique peut attendre longtemps ; la carte doit le dire |
| Les deux en parallèle | tout finit par arriver | la planète gèle deux fois plus longtemps et la priorité ne se sent presque pas |

## Ce qui est décidé

### Le mot

**Une priorité** est une cible que le joueur pose : un bâtiment sur une
planète, ou une recherche, avec un niveau visé. Le moteur, lui, en fait un
**objectif** — le mot qu'il emploie déjà pour une épargne en cours. La
priorité est ce que le joueur décide ; l'objectif est ce que le plan en fait.
Les deux mots vont au glossaire.

### L'état

Une seule liste, pour tout l'empire, dans l'ordre où le joueur a posé :

```
S.prio = [{kind:'b', pid:<id>, k:'lab', lvl:10}, {kind:'t', k:'plasma', lvl:12}]
```

Une priorité de recherche n'a pas de `pid` : la recherche se lance depuis le
centre, et c'est sur lui qu'elle épargne.

**Une priorité atteinte n'existe plus.** Un accesseur `prios()` filtre à la
lecture : `kind:'b'` dont la planète est à ce niveau, `kind:'t'` dont la
technologie y est, `pid` qui ne répond plus, niveau visé au-dessous du niveau
actuel.

**`prios()` lit l'état réel, et il ne touche à rien pendant une simulation.**
`simulateDay` remplace `S.tech` et `S.planets` par ses copies le temps de son
travail (restauré ligne 2064) : appelé à l'intérieur de la boucle des sessions,
un filtre qui écrirait dans `S.prio` amputerait la liste du joueur sur la foi
d'une prévision — « le plan compte monter ton labo à 10 demain à 11 h, donc
j'oublie ta priorité ». C'est l'anti-objectif principal, introduit par la
mécanique même qui devait l'éviter. Donc deux lectures, et elles ne se
confondent pas :

- **vivante** : `prios()`, sur l'état réel, sans effet de bord. La compaction
  de `S.prio` se fait au rendu, hors de toute simulation.
- **encore à faire à cette session** : le niveau de la planète *simulée* à cet
  instant. C'est ce test qui décide de poser l'objectif ou non, et il cesse de
  le poser dès que la session simulée a atteint la cible — sinon la réserve
  tiendrait jusqu'au bout de l'horizon et gèlerait la planète après coup.

**Pour chaque planète, une seule priorité agit : la première de la liste qui
la visait.** Les suivantes attendent leur tour, et la liste le montre. C'est
la contrainte de `reserveOf` qui l'impose, et l'ordre de pose qui l'arbitre.

**La règle ne connaît pas les `kind`.** Une priorité de recherche visant le
centre et une priorité de bâtiment sur ce même centre sont dans la même file :
la première posée agit, l'autre attend son tour en le disant. Les deux chemins
du moteur ne se voient pas l'un l'autre — c'est `prios()` qui les arbitre, en
amont, en ne rendant agissante qu'une priorité par planète.

**Plusieurs planètes portent chacune la leur, et toutes agissent.** Chacune
épargne chez elle. Mais `destOf` (`app.js:1804`) rend le premier objectif du
tableau qui n'est pas la planète d'origine : **les rapatriements de l'empire
vont vers la priorité posée en premier**, les autres n'avancent que sur leur
production locale. Aujourd'hui l'ordre de `goals` est sans conséquence — les
deux seuls objectifs vivent au même endroit — et il devient l'arbitre dès
qu'il y a des priorités. Il est donc explicite : `goals` reçoit les priorités
dans l'ordre de pose, et le bloc « Tes priorités » dit laquelle reçoit les
transports.

### Ce que le plan en fait

**Une priorité de recherche** se glisse en tête d'une copie de
`ROADMAPS[focus]`, sous la forme `[k, lvl, 'c']`. `nextResearch` fait alors
tout le reste tout seul : `resolveTech` remonte les prérequis et le labo qui
manque, le drapeau `'c'` rend le niveau critique, et le chemin
`crit → setGoal` de `tryResearch` (`app.js:1768`) pose l'épargne.

Elle passe aussi devant les **plafonds en tête** — l'Astrophysique qui
ouvrirait une planète de plus (`app.js:1544`). Et là, l'insertion ne suffit
pas : la boucle des `plafonds` tourne *après* celle de la feuille de route et
fait `list.unshift` ou `splice(0, …)` quand le plafond est « tête », donc
l'astro reprend la place et `tryResearch`, qui ne regarde que `nr.list[0]`,
n'aurait jamais vu la priorité. Il faut une ligne explicite dans
`nextResearch` : un plafond « tête » ne passe pas devant une priorité du
joueur. Le copilote obéit et le chiffre : « Une planète de plus attend : tu as
mis Plasma 12 devant. » C'est la même règle que pour le centre — obéir, et
dire ce que ça laisse.

**Le chemin de la recherche n'est pas tout à fait gratuit**, contrairement à ce
que ce document a d'abord dit. Un coût au-dessus des hangars du centre y mène
au même silence que pour un bâtiment : `wait` rend `Infinity`, `setGoal` rend
`null`, aucune réserve, et `pickBuildings` n'ajoute le hangar que pour un
objectif présent dans `ctx.goals` — donc pas de hangar non plus. Et ce n'est
pas un cas limite : Plasma 12 coûte environ 8,2 M de cristal, soit Hangar C 11.
L'étape du hangar ci-dessous vaut donc pour les deux `kind`.

**Une priorité de bâtiment** se traite au début de chaque session, avant
`tryResearch` :

1. `reqOk(B[k].req, p)` n'est pas vide → rien n'est posé ; la carte dit ce
   qui manque. Pas d'objectif, pas de réserve, pas de silence.
2. Le coût du prochain niveau dépasse les hangars → **la priorité commence par
   le hangar** : c'est lui qui devient la cible du moment, avec la phrase que
   `storageNote` écrit déjà. La priorité ne disparaît pas, elle fait un pas de
   côté. Le test ne peut pas passer par `waitFor` (`app.js:936`), qui lit
   `stockNow(p)` donc `p.stock`, absent des copies de `simulateDay` : il se
   fait sur place avec `cost[j] > pr.cap[j]`, et le `{small:[…]}` qu'attend
   `storageNote` se reconstruit avec `storageLevelFor`.
3. Sinon `setGoal` pose l'objectif, et le bâtiment visé passe **devant le
   classement par amortissement**, puisque c'est tout l'objet.

**Mais pas devant les deux chantiers de secours.** `pickBuildings` met en tête,
avant le classement, la centrale quand l'énergie est négative et le hangar
quand un stock débordera avant la prochaine connexion. Ils gardent leur place
devant la priorité : ils protègent la production qui la paie, et c'est
exactement l'argument que le plan fait déjà pour les planètes bridées
(`app.js:1795`) — une mine au ralenti coûte de la production à chaque heure,
une priorité repoussée ne coûte que du temps.

**Et la réserve ne les bloque pas.** Le piège est dans l'appelant : il calcule
`res` une seule fois pour toute la liste des candidats
(`cands.find(x => can(p, …, res))`, `app.js:1963`). Un secours placé devant
mais rendu impayable par la réserve ferait que la planète **ne construit plus
rien du tout** — ni le secours, ni la priorité, et pour aussi longtemps que
l'épargne dure. Le `res` se calcule donc par candidat, en sautant l'objectif de
la priorité pour les deux secours comme pour la priorité elle-même. Ce que la
réserve retient, ce sont les mines du classement, pas la centrale.

Comme l'objectif est posé avant `tryResearch`, `reserveOf` fait le reste : la
recherche ne partira que s'il reste de quoi la payer au-delà de la réserve. Et
`tryResearch` ne pose pas son objectif **spontané** sur une planète qui porte
déjà une priorité — la recherche critique de la feuille de route, la famine,
le vaisseau de colonisation — sinon les deux réserves s'additionnent et la
planète gèle. Celui qui *vient* d'une priorité de recherche, lui, se pose
normalement : c'est la priorité elle-même, et la règle lue trop largement la
tuerait.

**Le candidat forcé lit sa propre réserve en la sautant.** `reserveOf` prend
déjà un argument `skip` (`app.js:1726`), comme `tryResearch` le fait avec
`mine` : sans lui, la priorité s'interdirait elle-même de dépenser ce qu'elle
a mis de côté.

**Ce qui converge vers elle est déjà écrit.** `destOf` (`app.js:1804`) envoie
les rapatriements vers la planète qui porte un objectif, et `pickBuildings`
ajoute déjà le hangar quand un objectif de `ctx.goals` ne tient pas dedans
(`app.js:1621`). Une priorité devenue objectif hérite des deux sans une ligne.

### Ce que les cartes disent

Trois phrases, et elles sont obligatoires — une priorité muette est
l'anti-objectif principal :

- **Sur la carte de la priorité** : pourquoi elle est là. « Tu l'as mise en
  priorité. » Puis, quand l'épargne a commencé, le « Économisée depuis 14 h 30 »
  que `tryResearch` sait déjà écrire pour un objectif.
- **Sur ce qui attend à cause d'elle** : les lignes de `waits` portent `held`
  quand une réserve les retient (`app.js:1948` et `1964`) — mais **rien ne le
  lit** : `REFRESH.today` ne rend que la file, le quoi, l'eta et le manque. Il
  y a donc un rendu neuf à écrire, et `held` étant un booléen, il doit porter
  avec lui le nom de ce qui retient : « Retenu : tu épargnes pour Labo 10. »
  Le `waits.push` de `tryResearch` (`app.js:1770`) ne pose pas `held` du tout
  et doit le poser, puisque c'est la recherche que la priorité retiendra le
  plus souvent.
- **Sur ce que la priorité déplace** : la recherche critique ou le palier
  d'Astrophysique mis de côté le dit sur sa propre ligne.

### Ce que le panneau montre

**Où on pose.** Dans la carte de planète (vue Empire), la grille des niveaux
`pb-<id>-<k>` (`app.js:3085`) reçoit un second champ par ligne : le niveau
visé. Le joueur lit « Labo 7 », il tape 10 à côté. Même chose dans le tableau
des recherches (`app.js:3105`), qui portait déjà un bouton « + Objectif » au
même endroit avant `be101c4`. Vide veut dire pas de priorité.

**Ce champ écrit sur `change`, pas sur `input`**, à la différence de ses
voisins. Sur un labo 7, taper « 10 » passe par « 1 » : à la frappe, la
priorité serait jugée atteinte, jetée, puis recréée **en fin de liste** — et
l'ordre de pose est l'arbitre de précédence. Le joueur aurait perdu son rang
sans rien avoir demandé.

**Où on relit.** Un bloc « Tes priorités » sur Aujourd'hui, dans l'ordre de la
liste, chaque ligne avec sa planète, sa cible, son état — celle qui épargne,
celles qui attendent leur tour — et un « Retirer ». Le même geste que
`noRestore` (`app.js:2698`) pour les refus : une décision du joueur se relit et
se défait là où le plan se lit. Pas de bloc quand la liste est vide.

Un refus (`S.daily.no`) et une priorité sont les deux faces de la même chose :
le joueur qui reprend la main. Le premier dit non à ce que le plan propose, la
seconde dit oui à ce qu'il ne proposait pas.

## Ce qui reste au constructeur

- La place exacte du second champ dans la grille des niveaux, et sa taille.
- Comment se rend `held`, qui n'a aujourd'hui aucun lecteur : une mention sur
  la ligne d'attente, ou une phrase sous le bloc des priorités.
- Le libellé des trois phrases, dans la langue du projet.
- Faut-il dire, sur la carte d'un labo visé, le temps de recherche que le
  niveau fera gagner — `researchTime` (`app.js:683`) le sait. C'est la raison
  pour laquelle le joueur monte un labo, et le moteur ne la compte nulle part.
- Comment une priorité sur un hangar, posée alors qu'un autre bâtiment visé
  passe par le même hangar, se lit sans se répéter.
- Les tests, dans `test/run.js` :
  - sur la fixture, une priorité `{kind:'b', k:'lab', lvl:10}` sur la
    principale fait sortir une carte Labo alors qu'aucune n'apparaissait, et
    `waits` montre la recherche retenue ;
  - une priorité dont le coût dépasse les hangars fait sortir le hangar, pas
    le silence ;
  - une priorité sur `nanite` sans Robots 10 ne pose aucune réserve et ne gèle
    rien ;
  - une priorité `{kind:'t', k:'plasma', lvl:12}` passe devant le palier
    d'Astrophysique en tête ;
  - une priorité atteinte ne ressort pas de `prios()` ;
  - deux priorités sur la même planète : une seule réserve.
