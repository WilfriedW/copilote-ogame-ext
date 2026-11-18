# Copilote OGame — La flotte qu'on ne demandera pas, et le rapport qui décide

Document de conception, 18 novembre 2026. Projet.

## Intention

Le joueur part d'un constat et d'une hypothèse, et les séparer est tout
l'objet de ce document.

**Le constat est juste.** « Le copilote ne me dit d'aller que sur des
planètes inactives, qui ont très peu de ressources. » C'est vrai :
`raidTargets()` (`app.js:2748`) ne retient que les inactifs, et en écarte
tous ceux dont le score dépasse le sien.

**L'hypothèse ne suit pas.** « Si j'avais une flotte, je pourrais attaquer
des gens qui ont des défenses. » Le wiki répond non, des deux côtés à la
fois. Côté attaquant : « A profitable target would thus be a planet with
resources enough to justify a raid. And naturally with few enough defenses
so you won't waste a lot of deuterium on support fighters »
([Profit](https://ogame.fandom.com/wiki/Profit)), et « When fleetcrashing a
heavily defended planet it may not be profitable, similar to raids ». Côté
défenseur : « Aim to make possible attackers go looking for easier targets
than you, or at least equal targets that bring higher profit »
([Defense Build Strategies](https://ogame.fandom.com/wiki/Defense_Build_Strategies)).
C'est mot pour mot la doctrine que `defMix` (`app.js:2843`) applique déjà
aux planètes du joueur, vue de l'autre bord : une défense qui vaut plus que
le butin fait passer le pilleur à la cible suivante. Le copilote la connaît,
il ne l'a jamais retournée.

S'ajoute ce que la revue du wiki a déjà relevé : la défense percée se
reconstruit à 70 % gratuitement et ne laisse aucun champ de débris.
L'attaquant paie son écran, le défenseur récupère sa défense.

Ce qui manque n'est donc pas une flotte. C'est que le copilote **lise le
rapport d'espionnage** que le joueur a sous les yeux, et dise ce qu'il
contient : aujourd'hui il en extrait trois nombres (`parseReport`,
`app.js:2972`) et laisse le joueur cocher à la main « le rapport ne montre
ni flotte ni défense » (`app.js:3067`).

## Objectifs

- Le rapport collé se lit en entier : ressources, flotte, défense, taux de
  butin.
- « La section n'est pas affichée » ne se confond jamais avec « il n'a
  rien ».
- Pour une cible défendue, le copilote chiffre ce que la défense vaut face
  au butin, et s'arrête là.
- Il cesse de cacher des cibles au joueur quand la règle qui les cachait ne
  s'applique plus à lui.
- Il écrit, une fois pour toutes, pourquoi il ne demandera pas de vaisseau
  de combat.

## Non-objectifs

- **Simuler un combat.** C'était déjà la décision écrite dans
  `docs/revue-wiki-ogame.md` ; la raison qui y figure — « il demande de
  connaître la flotte adverse » — tombe en partie, puisqu'un rapport la
  donne. Deux autres la remplacent, plus solides : le combat est aléatoire
  (tir rapide, probabilité d'explosion sous 70 % de coque), donc sa sortie
  est une fourchette et non un chiffre ; et le wiki lui-même renvoie les
  joueurs à SpeedSim plutôt qu'à une règle.
- **Dimensionner un écran.** Conséquence du précédent.
- **Ajouter les coûts et prérequis des coques de combat.** La table du wiki
  est fiable et tient en dix lignes, mais rien ne la lirait : `SHIP_COST` et
  `SHIP_REQ` (`app.js:2815`) servent à construire, et on ne construira rien.
  La flotte lue chez la cible ne la demande pas non plus — elle se nomme,
  elle ne se chiffre pas, voir plus bas. Elle entrera le jour où quelque
  chose la demande.
- **Faire naître une demande de flotte depuis une cible.** Une flotte de
  combat se construit en semaines ; un rapport vaut deux heures
  (`raidPlan`, `app.js:2980`) et une cible inactive se fait piller par
  d'autres. Le plan du jour ne peut pas réclamer des croiseurs pour une
  cible qui n'existera plus quand ils sortiront.
- **Les joueurs actifs comme cibles.** Ils ripostent, la règle de bashing
  s'applique à eux et pas aux inactifs, et la protection débutant les
  couvre. Le copilote reste sur les inactifs.
- **Deviner le seuil du statut hors-la-loi.** La page
  [Outlaw](https://ogame.fandom.com/wiki/Outlaw) dit « a stronger player »,
  le message du jeu « more than 5 times more powerful », et l'option de
  réglage « opponents 10-times stronger ». Trois chiffres, donc aucun. Le
  jeu affiche sa propre pop-up avant l'acte : c'est lui qui tranche.
- **Lire le rapport depuis la page du jeu.** `content.js` ne dessine que sur
  une liste fermée de pages (`content.js:19`), et la page Messages n'y est
  pas. Le rapport arrive par copier-coller, et c'est très bien ainsi : rien
  à automatiser.
- Toucher à `rankUpgrades`, à `defMix` ou au centre.

## Anti-objectifs

Des échecs, même si le code marche :

- **Annoncer « il te faut 40 croiseurs ».** Un chiffre que le jeu ne tiendra
  pas, sur la seule décision du copilote, et qui coûte une flotte.
- **Un « sans défense » déduit d'un rapport qui ne montrait pas la
  défense.** C'est le pire mensonge possible ici : il envoie la flotte. Un
  espionnage trop faible n'affiche pas la section — et une section absente
  ressemble beaucoup à une planète nue.
- **Faire perdre au joueur sa protection pendant sept jours en silence.**
  Espionner suffit à la déclencher : « To become an outlaw, a player has
  tried to spy and/or attack a stronger player ».
- **Remplir un chiffre que le rapport ne donnait pas.** Un champ laissé à sa
  valeur d'avant, après un collage, est un chiffre faux présenté comme lu.

## Contraintes

- **Le joueur ne colle aujourd'hui que la partie Ressources.** C'est ce
  qu'il fait et ce que le champ lui demande. Tout le reste en dépend : si
  l'invite ne change pas, rien de ce document ne sert.
- **Le format du rapport, relevé sur une partie du joueur le 18 novembre
  2026** : un libellé sur une ligne, sa valeur sur la suivante, point comme
  séparateur de milliers. `parseReport` l'encaisse déjà, son `\s*` avale le
  saut de ligne. L'en-tête porte « Butin : 75 % ».
- **Les noms français sont déjà dans le code** : `DEF` porte `n`, `o` et `p`
  pour chaque pièce (`app.js:2787`), `SHIPS` porte `n` pour chaque coque
  (`app.js:40`). L'analyseur n'invente aucun libellé.
- **Un rapport vieillit.** `raidPlan` le périme à deux heures ; ce qui est
  lu en plus vieillit pareil.
- **`defsOf` distingue déjà « jamais lu » de « zéro »** (`app.js:2822`,
  `p.def == null`). Le même partage s'applique à la cible, et pour la même
  raison.
- OGame interdit l'automatisation : le copilote pose des liens, il ne clique
  pas.
- Aucun chiffre affiché n'est estimé en silence.

## Approches

### Ce que la flotte viendrait faire

| | Ce que ça donne | Pourquoi pas |
| --- | --- | --- |
| **Le rapport décide, et le copilote ne compose aucune flotte de combat** | retenue | — |
| Un écran chiffré, donc un simulateur de combat complet | répond littéralement à la demande | sortie aléatoire donc fourchette ; et surtout une flotte se construit en semaines quand la cible vit deux heures — le plan du jour ne peut pas la demander |
| Un budget de flotte permanent accroché à `S.day.focus === 'fleet'`, comme `defMix` le fait pour la défense | se brancherait sur un réglage qui existe déjà | le wiki ne donne aucun ratio : le chiffre serait inventé, ce que le projet refuse partout. Le seul chiffre qu'il donne — l'intégrité de structure compte dans le gain d'expédition — est déjà couvert par les transporteurs : « sending a fleet comprised solely of Small Cargos or Large Cargos will allow you to find lots of resources » |

### Les cibles cachées

Première lecture, et elle était fausse : « le jeu n'interdit pas les
inactifs riches, puisque l'inactivité lève la protection débutant ». Elle
confond deux mécaniques. L'inactivité lève la protection **de la cible** ;
ce que le copilote évite, c'est le statut **hors-la-loi du joueur**, et
celui-là se déclenche sur l'écart de score, que la cible soit active ou non.
Le `outlaw` de `raidTargets()` est donc la règle, et le texte de la carte
(« tu perdrais ta protection pendant 7 jours », `app.js:2600`) est juste.

Reste une phrase de la page Outlaw que le copilote ignore : « Since the
stronger/weaker player status is part of the Newbie Protection mechanic of
the game, the status has no effect after 500,000 points. » Au-dessus de ce
score, le copilote cache des cibles pour rien.

## Ce qui est décidé

### Le rapport se lit en entier

`parseReport` rend aujourd'hui trois nombres. Il rendra un relevé :

```
{res:[m,c,d]|null, fleet:{k:n}|null, def:{k:n}|null, loot:0.75|null}
```

**`null` veut dire « le rapport ne le dit pas », et jamais zéro.** C'est le
partage que `defsOf` fait déjà sur les planètes du joueur, pour la même
raison : un espionnage trop faible n'affiche pas la section, et confondre
les deux envoie la flotte.

**L'analyseur se repère aux noms, pas à la mise en page.** Une section
s'ouvre sur son titre — `Flotte`, `Défense` — et se referme au titre
suivant. Entre les deux, chaque libellé porte le nombre qui le suit.

**Un libellé reconnu dont le compte n'arrive pas rend aussi la section
inconnue.** C'est le cas que la revue de branche a trouvé, et que le
raisonnement de sûreté ne couvrait pas : il ne parlait que du libellé *non*
reconnu. Un libellé reconnu posait une attente, et une attente perdue laissait
la section « lue et vide », donc la cible nue, alors que le mot était sous les
yeux du joueur. Perdre une attente rend donc la section inconnue.

**Un libellé qu'on ne reconnaît pas rend la section inconnue, jamais
vide.** C'est la correction la plus importante que la relecture a apportée,
et elle vient d'un cas banal : une planète qui ne porte que des satellites
solaires. Ni `DEF` ni `SHIPS` ne les nomment ; avec la règle « un titre sans
libellé reconnu vaut zéro », cette planète se lisait « nue », le copilote
composait le raid, et c'est l'anti-objectif mot pour mot. Une section vaut
donc zéro seulement quand son titre est là et qu'**aucune ligne d'objet**
ne suit. Dès qu'une ligne ne se range pas dans le vocabulaire, la section
vaut `null` — on a lu sans comprendre, ce qui n'est pas avoir compris que
c'était vide.

**Le vocabulaire est donc fermé, et doit être complet.** Les noms de `DEF`
(`n`, `o`, `p`) et de `SHIPS` (`n`) n'en couvrent qu'une partie : il y
manque le satellite solaire, la foreuse, le missile d'interception et le
missile interplanétaire, que le jeu affiche sous Flotte ou sous Défense et
que le copilote ne nomme nulle part. `SHIPS` ne porte en plus que le
singulier, quand le rapport pourrait écrire au pluriel. Le vocabulaire se
construit donc sur un rapport réel, singulier et pluriel, et chaque entrée
dit en outre si la pièce **se bat** — c'est ce qui décide plus bas.

**Le taux de butin se lit au lieu de se déduire.** Le rapport l'affiche
(« Butin : 75 % ») ; `raidPlan` le déduit de la classe du joueur
(`app.js:2988`), ce qui ignore le statut d'honneur de la cible — le wiki
donne 100 % sur un bandit, 75 % sur une cible honorable, 50 % sinon. Lu, il
est juste ; déduit, il l'est par hasard. Faute de l'avoir lu, la déduction
d'aujourd'hui reste, et la carte dit laquelle des deux elle montre.

**Un rapport qui parle d'une autre planète n'est pas appliqué.** L'en-tête
porte les coordonnées de la planète espionnée. Coller le rapport de la cible
d'à côté pré-cocherait « sans défense » pour celle qui est ouverte — une
erreur de manipulation banale dès qu'on espionne plusieurs cibles, et qui
coûte exactement le prix du mensonge qu'on cherche à éviter. Le copilote ne
prend alors rien et le dit.

**La date du rapport suit les ressources, et elles seules.** C'est le stock
qui vieillit. Posée à chaque frappe dans la zone de collage, elle rajeunissait
un rapport de cinq heures sans que personne ait réespionné, et l'avertissement
« rapport périmé » disparaissait avec elle.

**Un collage ne laisse jamais la flotte ou la défense à leur valeur
d'avant.** Ce que le nouveau rapport n'en dit pas redevient inconnu. Sinon
la défense d'une cible d'hier se lirait sur la cible d'aujourd'hui.

**Les trois ressources, elles, survivent à un collage qui ne les contient
pas.** Le champ propose aujourd'hui « ou saisis ses ressources »
(`app.js:3060`) et le collage ne les écrase que s'il en a trouvé au moins
une (`app.js:3451`) : cette règle reste. Un chiffre tapé à la main est une
information du joueur, et l'effacer sur un collage partiel lui reprendrait
son travail sans rien gagner — une ressource périmée fait rater un butin,
une défense périmée fait perdre une flotte. Les deux cas ne méritent pas la
même sévérité.

**Le champ demande le rapport entier.** L'invite d'aujourd'hui (« Colle le
rapport ici ou saisis ses ressources », `app.js:3060`) laisse croire que la
partie Ressources suffit — c'est ce que le joueur colle. Elle dira de tout
prendre, et que ce qui manque sera dit comme manquant.

### La case se remplit, et reste la parole du joueur

`S.raid.safe` garde exactement le sens qu'il a : *le joueur affirme que la
cible est nue*, et c'est lui qui engage sa flotte. Ce qui change, c'est
qu'un collage le **pré-remplit** et montre sur quoi. Un seul champ, un seul
sens, aucun troisième état à faire voyager jusqu'aux deux endroits qui
déclenchent une action réelle (`app.js:2588` et `app.js:3348`).

À chaque collage, la case prend ce que la lecture dit, et la carte dit
laquelle des trois lectures elle a faite :

- **Flotte et défense lues, rien qui se batte** : cochée. Le raid se
  compose comme aujourd'hui.
- **Quelque chose qui se bat** : décochée, avec ce qui a été lu.
- **L'une des deux inconnue** : décochée, et dit comme tel — « ton rapport
  ne montre pas sa défense ». Un rapport plus complet demande plus de sondes
  ou un meilleur niveau d'Espionnage ; le copilote le rappelle sans
  promettre combien.

**Le joueur peut recocher, et alors le raid se compose.** Il a pu lire le
rapport mieux que l'analyseur, et le copilote n'a jamais refusé un choix du
joueur — c'est déjà la règle du centre. La ligne de comparaison reste
affichée sous la case cochée : il décide en voyant, pas à la place de voir.
Une case recochée à la main tient jusqu'au collage suivant, qui la reprend.

**« Rien qui se bat » plutôt que « zéro vaisseau ».** Un inactif porte
presque toujours quelques satellites, une foreuse ou une sonde oubliée ;
exiger une flotte vide ferait retomber le joueur sur la case à cocher à la
main, c'est-à-dire sur le point de départ. Ces trois-là ne tirent pas
(puissance d'attaque 1, 1 et 0,01 contre les 4 000 de coque d'un petit
transporteur, [Ships](https://ogame.fandom.com/wiki/Ships)), et les deux
missiles ne visent pas une flotte. Tout le reste tire, un petit transporteur
compris : c'est un combat, le copilote ne simule pas de combat, donc il ne
compose pas et laisse le joueur trancher.

**Un `safe` déjà enregistré ne se touche pas.** Il n'y a pas de rapport
gardé pour le relire, et c'était la parole du joueur. `raidPlan().stale` le
neutralise de toute façon au bout de deux heures (`app.js:2980`).

### La défense se compare, elle ne se perce pas

Quand le rapport montre de la défense, la carte de pillage ajoute une
ligne, et deux nombres seulement, tous deux lus :

> Défense : 45 lanceurs de missiles, 12 lasers légers — 114 k en équivalent
> métal, contre 60 k de butin dans la même unité. Percer coûte plus cher que
> ce que ça rapporte, et sa défense repousse à 70 % gratuitement sans laisser
> de débris. Le copilote ne compose pas d'écran : dimensionner un combat
> demande un simulateur, et le résultat serait une fourchette.

**Les deux nombres sont dans la même unité, et ce n'est pas un détail.** La
première rédaction comparait l'équivalent métal de la défense à la somme brute
des trois ressources du butin. Sur une cible riche en cristal et en deutérium
le verdict s'inversait : le copilote disait « trop cher » d'une défense que le
butin payait largement. Le butin passe donc par `mse` lui aussi.

La valeur de la défense est la somme des coûts de `DEF` passée à `mse`
(`app.js:840`) — les mêmes chiffres que le copilote emploie pour décider de
la défense du joueur. Le butin est celui que `raidPlan` calcule déjà. Aucune
estimation, aucune simulation, aucun seuil inventé : les deux nombres sont
posés côte à côte et le joueur tranche. Une cible à deux lanceurs de
missiles devant trois cent mille de butin se voit d'un coup d'œil, et c'est
son affaire — le copilote ne clique jamais à sa place.

**La flotte de la cible se nomme, elle ne se chiffre pas.** « 40 croiseurs,
12 destructeurs au sol » suffit à dire non ; ce que ça vaut n'ajoute rien,
puisqu'il n'y a pas de comparaison à faire — une flotte qui tire suffit à
renvoyer le joueur. La chiffrer demanderait les coûts des coques de combat,
que le non-objectif écarte, et une table de données entière pour une phrase
qui ne changerait aucune décision ne vaut pas d'exister. Le copilote dit
donc ce qu'il a vu, sans total.

### Le statut hors-la-loi, dit au lieu d'être subi

`outlaw` reste ce qu'il est en dessous de 500 000 points, et le restera avec
sa raison. Au-dessus, il ne s'applique plus : `raidTargets()` cesse de
marquer, l'onglet Cibles cesse de reléguer, et les cartes du jour cessent de
filtrer. Le score du joueur est déjà là (`myScore()`, `app.js:2724`) ; quand
il est inconnu, rien ne change et la prudence reste.

### Pas de demande de flotte de combat

Le copilote ne proposera aucun chasseur, croiseur ou vaisseau de bataille,
et cette conception est l'endroit où c'est écrit. Les raisons, dans
l'ordre :

1. **Le chiffre ne peut pas être tenu.** Dimensionner un écran demande de
   simuler six manches avec tir rapide, boucliers et probabilité
   d'explosion. La sortie est une distribution. « Il te faut 40 croiseurs »
   n'est pas un fait, et le projet n'affiche pas ce qu'il ne peut pas tenir.
2. **Le besoin ne dure pas.** Une flotte sort en semaines, un rapport vaut
   deux heures. Rien de durable ne la réclame.
3. **Le marché est mauvais.** Le wiki le dit des deux côtés, et la défense
   repousse gratuitement à 70 % sans laisser de débris.
4. **Ce que le joueur cherchait est ailleurs.** Des cibles plus riches, et
   un rapport lu pour lui. C'est ce que fait ce document.

Ce qui reste vrai de la demande de flotte existante ne bouge pas : les
transporteurs du centre, les sondes, l'éclaireur de l'Explorateur, les
transporteurs à demeure d'une colonie qui déborde, et toute la défense
(`app.js:1981`).

## Ce qui reste au constructeur

- **Les titres exacts des sections du rapport**, et **le vocabulaire
  complet** : singulier et pluriel de chaque pièce, satellite solaire,
  foreuse et missiles compris, plus ce que le jeu écrit quand l'espionnage
  est trop faible. Le relevé du 18 novembre ne couvre que la partie
  Ressources. Tout cela se lit sur un rapport réel avant d'écrire
  l'analyseur, et ne se suppose pas : un libellé manqué rend la section
  inconnue, donc ne ment pas, mais un vocabulaire trop maigre rendrait tout
  rapport inconnu et la fonction inutile.
- La place des lignes dans la carte de pillage, et leur formulation exacte.
- Si l'en-tête « Butin : 75 % » se lit assez sûrement pour remplacer la
  déduction par la classe, ou s'il vaut mieux montrer les deux.
- Les tests, dans `test/run.js` : un rapport sans section Défense ne vaut
  pas « sans défense » et ne compose aucun raid ; un rapport dont la section
  Défense ne porte aucune ligne compose le raid ; un rapport dont une ligne
  n'est pas du vocabulaire rend la section inconnue et ne compose rien ;
  une flotte de satellites et de sondes seule compose quand même ; un
  rapport avec défense donne la comparaison et aucun raid ; un second
  collage efface la flotte et la défense du premier mais laisse les
  ressources tapées à la main ; au-dessus de 500 000 points, un inactif plus
  fort redevient une cible proposée.
