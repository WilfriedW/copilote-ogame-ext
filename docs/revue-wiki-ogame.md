# OGame par le wiki, et ce que le copilote en fait

Revue du 16 novembre 2026, copilote v1.36.0.

Ce document a deux usages. Lu de haut en bas, il apprend les règles d'OGame qui
comptent, domaine par domaine, sans passer par le wiki. Lu par ses fins de
section, il donne la roadmap : chaque domaine se termine par **à ajouter**,
**à corriger**, **à retirer**.

## Comment lire la source

Le wiki communautaire (`ogame.fandom.com`) est solide sur la mécanique stable —
formules, coûts, distances, combat, bonus de classe — et peu fiable sur le méta.
Des pages sont dédoublées « Old Universe / Redesign », les changelogs s'arrêtent
à la v7, la page `Bashing` se déclare elle-même périmée. Une page de formule a
même sa correction écrite à la main dans le texte : « (1.44 not 1.36) ».

D'où la règle suivie ici : une formule du wiki vaut preuve, un conseil de jeu
vaut indice. Le copilote n'a aucune raison de reculer vers la v7.

---

## 1. Ressources et production

### La règle

Une planète produit chaque heure, hors mines, un revenu de base de 30 métal et
15 cristal, multiplié par la vitesse économique de l'univers. Les mines
ajoutent, pour un niveau `L` :

| Mine | Production/h | Énergie consommée |
|---|---|---|
| Métal | 30 · L · 1,1^L | 10 · L · 1,1^L |
| Cristal | 20 · L · 1,1^L | 10 · L · 1,1^L |
| Deutérium | 10 · L · 1,1^L · (1,44 − 0,004 · T) | 20 · L · 1,1^L |

`T` est la température maximale de la planète : le deutérium aime le froid, et
au-delà de 360 °C il ne produirait plus rien. C'est ce qui rend les positions 13
à 15 intéressantes.

L'énergie vient de trois sources : la centrale solaire (20 · L · 1,1^L), la
centrale de fusion (30 · L · (1,05 + 0,01 · Énergie)^L, qui brûle
10 · L · 1,1^L de deutérium), et le satellite solaire (T/4 + 20 par satellite,
donc rentable surtout près du soleil).

Si l'énergie produite ne couvre pas la consommation, **tout** est bridé du même
facteur : production ÷ consommation. Une mine de plus sans énergie de plus fait
baisser les deux autres.

Le hangar plafonne la production locale, pas les livraisons : un transport peut
déborder la capacité, la mine s'arrête au plafond. Capacité au niveau `L` :
5000 · ⌊2,5 · e^(20L/33)⌋.

Les **foreuses** ajoutent 0,02 % de la production de base chacune, plafonné à
50 %. Leur nombre utile est (métal + cristal + deut) × 8, où ce 8 est un réglage
de serveur. Une foreuse au-delà ne produit rien et ne consomme rien.

### Ce que le copilote en fait

Tout, et à la virgule. `production()` reprend les sept formules, le facteur
d'énergie, les bonus de position (+40/30/20 % cristal en 1-3, +17/23/35 % métal
en 6-10), le plasma (+1 % métal, +0,66 % cristal, +0,33 % deut par niveau), le
géologue appliqué aux mines et pas au revenu de base — exactement comme le wiki
le précise — et le bonus de forme de vie lu sur la page du jeu. `storageCap()`,
`waitFor()`, `crawlerBonus()` et son plafond à 50 % sont justes.

Le bridage manuel des mines est lu et signalé, mais `production()` compte
toujours à 100 % : les débits annoncés sont optimistes tant que le joueur bride.
C'est déjà noté dans le code.

### Pour le copilote

- **À ajouter** : le bonus +2 % mines et énergie du pack d'officiers complet
  (l'« État-major »), que le joueur a dès qu'il possède les cinq. Le réglage 8
  des foreuses devrait être réglable : c'est un paramètre de serveur, pas une
  constante du jeu.
- **À corriger** : la foreuse exige **Technologie Laser 4** en plus du chantier
  5, de la combustion 4 et de la protection 4. `SHIP_REQ.crawl` l'oubliait, donc
  le plan proposait des foreuses que le jeu refusait. **Corrigé.**
- **À retirer** : le réglage « Collecteur : +25 % soute transporteurs ». Ce
  n'est pas une option du jeu, c'est un bonus de classe toujours actif. Le
  copilote lui donne un interrupteur qui ne peut avoir qu'une bonne position.

---

## 2. Bâtiments, durées et cases

### La règle

Un niveau coûte son coût de base × facteur^(niveau − 1). Les facteurs : 1,5
pour le métal, le deutérium et le solaire, 1,6 pour le cristal, 1,8 pour la
fusion, 2 pour tout le reste. L'astrophysique est à part : ×1,75, arrondi à la
centaine.

Les durées, en heures :

- Bâtiment : (métal + cristal) / (2500 · (1 + robots) · 2^nanites · vitesse)
- Recherche : (métal + cristal) / (1000 · (1 + labo) · vitesse)
- Vaisseau ou défense : **intégrité de structure** / (2500 · (1 + chantier) · 2^nanites · vitesse)

L'intégrité de structure est le coût en métal + cristal, le deutérium exclu. Le
canon de Gauss coûte 20 000 / 15 000 / 2 000 pour 35 000 d'intégrité, le lanceur
de plasma 50 000 / 50 000 / 30 000 pour 100 000 : le deutérium n'y entre jamais.
La coque d'un vaisseau en combat vaut un dixième de cette intégrité.

Les cases limitent les bâtiments, jamais la défense. Quand une planète est
pleine, le **Terraformeur** ajoute ⌊5,5 · L⌋ cases : il coûte cristal, deutérium
et de l'énergie *disponible au lancement* (pas consommée ensuite), exige Nanites
1 et Énergie 12, ne demande aucun métal, et ne se démolit jamais.

Trois bâtiments que le copilote nomme sans les chiffrer :

- **Silo de missiles** : 10 emplacements par niveau. Niveau 2 pour les missiles
  d'interception (1 emplacement chacun), niveau 4 pour les missiles
  interplanétaires (2 emplacements).
- **Dock spatial** : répare les épaves.
- **Dépôt de ravitaillement** : uniquement dans les univers où le combat
  d'alliance est activé. Ravitaille une flotte alliée stationnée chez vous,
  20 000 deutérium par niveau.

### Ce que le copilote en fait

Les coûts et les facteurs sont justes pour les treize bâtiments et les quinze
recherches, l'arrondi à la centaine de l'astrophysique inclus. `researchTime()`
est juste, avec le −25 % de l'Explorateur.

Un écart de durée : `buildTime()` divise en plus par `max(4 − L/2, 1)`, ce qui
rend les niveaux 1 à 5 plus rapides. Le wiki n'a pas ce facteur. Les Réglages du
copilote l'avouent déjà comme « moins sûr ». Un chronométrage en jeu tranche en
une fois.

`shipTime()`, qui n'additionne que métal + cristal, est en revanche juste : c'est
bien la définition de l'intégrité de structure.

### Pour le copilote

- **À ajouter** : le Terraformeur. Le copilote sait dire qu'une planète est
  pleine et ne sait pas dire comment en sortir — et sur une planète pleine,
  c'est le seul bâtiment qui débloque le plan.
- **À corriger** : rien de certain. Le facteur `4 − L/2` se tranche au
  chronomètre, pas au wiki.
- **À retirer** : rien. Le Dépôt de ravitaillement et le Dock spatial doivent
  rester dehors : le premier n'existe que dans les univers ACS, le second
  suppose des épaves que l'extension ne lit pas.

---

## 3. Recherche

### La règle

L'astrophysique commande trois choses à la fois, et c'est pour ça qu'elle est la
recherche qui structure une partie :

| Elle donne | Règle |
|---|---|
| Planètes | 1 + ⌈niveau / 2⌉ |
| Expéditions simultanées | ⌊√niveau⌋ |
| Positions colonisables | 4-12, puis 3-13 au niveau 4, 2-14 au 6, 1-15 au 8 |

Elle allonge aussi l'expédition d'une heure par niveau.

Le reste de l'arbre est classique, sauf deux recherches à coût non doublant :
l'astrophysique (×1,75) et la **Technologie Graviton**, qui ne coûte que de
l'énergie et ne sert qu'à l'Étoile de la mort.

### Ce que le copilote en fait

Les trois règles de l'astrophysique sont exactes, y compris l'ouverture des
positions aux niveaux 4, 6 et 8 — chaque entrée de `POS` porte son palier.
`astroForExpo()` donne bien le prochain carré, `maxPlanets()` la bonne formule.

### Pour le copilote

- **À ajouter** : le Technocrate (−25 % de temps de recherche, et +2 niveaux
  d'espionnage pour les sondes seulement, pas pour le rapport). C'est le seul
  officier qui change un chiffre que le copilote affiche déjà.
- **À corriger** : rien.
- **À retirer** : rien. La Graviton n'a pas sa place tant qu'il n'y a pas
  d'Étoile de la mort.

---

## 4. Flotte, vol et carburant

### La règle

La distance, qui gouverne tout :

| Entre | Distance |
|---|---|
| Galaxies | 20 000 × écart |
| Systèmes | 2 700 + 95 × écart |
| Positions | 1 000 + 5 × écart |
| Même planète | 5 |

Dans un univers en « donut », l'écart de systèmes se compte dans les deux sens.

Le carburant : 1 + arrondi(consommation_de_base × distance / 35 000 ×
(vitesse% / 100 + 1)²). Il est brûlé entièrement au départ : rappeler une flotte
aussitôt ne rend rien. Et surtout, **le carburant occupe de la soute** : il
réduit ce que la flotte peut transporter.

Trois vaisseaux changent de moteur en cours de partie : le petit transporteur
passe à l'impulsion à Impulsion 5 (vitesse 5 000 → 10 000), le bombardier à
l'hyperespace à Hyperespace 8, le recycleur à l'impulsion à 17 ou à
l'hyperespace à 15.

### Ce que le copilote en fait

`distance()`, `flight()` et le carburant sont justes, donut compris. Les trois
changements de moteur sont là, avec les bons seuils. Le +100 % de vitesse des
transporteurs du Collecteur est appliqué.

Le carburant n'était pas soustrait de la soute : `flight()`, le pillage et la
mise à l'abri annonçaient la soute brute, donc un chargement que la flotte ne
pouvait pas prendre, et d'autant plus que le trajet était long. **Corrigé** :
`souteUtile()` retire le plein, et les trois appelants s'en servent. Le kit de
colonie et l'expédition comptent encore brut — l'écart y est plus petit, et le
kit ajoute déjà le carburant à son coût.

Et la classe **Général** : le copilote l'offre dans les réglages et n'en applique
rien. Le Général a +100 % de vitesse sur tous les vaisseaux de combat et les
recycleurs, −25 % de deutérium, +2 emplacements de flotte, +2 niveaux de
recherche militaire, +5 cases par lune, et des crans de vitesse de 5 % au lieu
de 10 %. Zéro sur douze.

### Pour le copilote

- **À ajouter** : les bonus du Général, en commençant par les deux qui changent
  un chiffre affiché — le −25 % de carburant et les crans de 5 % dans
  `FS_SPEEDS`, qui changent la mise à l'abri qu'on lui propose.
- **À corriger** : fait. Reste le kit de colonie, qui dimensionne ses
  transporteurs sur la soute brute.
- **À retirer** : rien.

---

## 5. Défense et combat

### La règle

Huit pièces au sol. Elles ne prennent aucune case, ne se démolissent pas, ne se
déplacent pas, et après chaque combat chacune a **70 % de chance d'être
reconstruite gratuitement** — 85 % avec l'Ingénieur. Sauf si c'est un missile
interplanétaire qui l'a détruite : alors rien ne revient. Et la défense détruite
ne fait pas de champ de débris, donc l'attaquant n'en récupère rien.

| Pièce | Coût (M/C/D) | Intégrité | Bouclier | Attaque |
|---|---|---|---|---|
| Lanceur de missiles | 2 000 / – / – | 2 000 | 20 | 80 |
| Laser léger | 1 500 / 500 / – | 2 000 | 25 | 100 |
| Laser lourd | 6 000 / 2 000 / – | 8 000 | 100 | 250 |
| Artillerie à ions | 5 000 / 3 000 / – | 8 000 | 500 | 150 |
| Canon de Gauss | 20 000 / 15 000 / 2 000 | 35 000 | 200 | 1 100 |
| Lanceur de plasma | 50 000 / 50 000 / 30 000 | 100 000 | 300 | 3 000 |
| Petit bouclier | 10 000 / 10 000 / – | 20 000 | 2 000 | 1 |
| Grand bouclier | 50 000 / 50 000 / – | 100 000 | 10 000 | 1 |

Le **tir rapide** explique pourquoi on mélange. Le croiseur tire 10 fois par
lanceur de missiles et rien contre le laser léger ; le destructeur l'inverse. Un
tas d'un seul type est gratuit à percer. L'Étoile de la mort, elle, tire 200 fois
contre les deux.

Le combat : six manches au plus, sinon match nul et l'attaquant ne pille rien.
Chaque tir compare l'attaque au bouclier de la cible. Sous 1 % du bouclier le
tir rebondit sans rien faire. Sous le bouclier, le bouclier absorbe. Au-dessus,
la coque prend la différence. Et dès que la coque est sous 70 % de sa valeur de
départ, chaque tir reçu a 1 − coque/coque_initiale de chance de faire exploser
la pièce — ce qui fait que beaucoup de petits tirs tuent mieux qu'un gros.

Le pillage : la moitié au maximum de **chaque** ressource. L'Explorateur monte à
75 % sur un inactif. Le remplissage suit un ordre : un tiers de la soute en
métal, puis la moitié de ce qui reste en cristal, puis le deutérium, puis on
reboucle.

### Ce que le copilote en fait

Les huit coûts, les huit prérequis, l'ordre de construction chair-à-canon
d'abord, les deux types de chair à canon pour la raison du tir rapide, le petit
bouclier à partir de 20 pièces et le grand à partir de 100 : tout cela colle au
wiki. Le budget de défense calé sur la moitié d'une nuit de production est un
raisonnement propre, qui dit la bonne chose — rendre le pillage non rentable,
pas rendre la planète invulnérable.

Le pillage lui-même prend 50 % de chaque ressource, 75 % en Explorateur, et
dimensionne la soute sur la somme. L'ordre de remplissage du jeu est ignoré :
l'écart est petit et ne vaut probablement pas le code.

Aucune simulation de combat, aucun missile.

### Pour le copilote

- **À ajouter** : la reconstruction gratuite à 70 %. C'est l'argument qui
  justifie la défense dans le texte du copilote, et il ne l'utilise pas : une
  défense qui renaît aux trois quarts après chaque raid change le calcul de
  rentabilité qu'il présente au joueur.
- **À corriger** : rien de chiffré.
- **À retirer** : rien. Le simulateur de combat et les missiles doivent rester
  dehors — le premier demande de connaître la flotte adverse, les seconds un
  silo que l'extension ne lit pas. C'est déjà la décision inscrite dans le code.

---

## 6. Expéditions

### La règle

On envoie une flotte sur la position 16 d'un système. Le nombre d'expéditions
simultanées est ⌊√astrophysique⌋, +2 pour l'Explorateur, +1 avec l'Amiral. La
durée de stationnement monte d'une heure par niveau d'astrophysique, mais le
wiki est net : **rester plus d'une heure n'augmente pas les gains**, seulement
la probabilité d'événements, bons comme mauvais.

Le gain maximal dépend de cinq choses : l'intégrité de structure *et* la soute
de la flotte envoyée, les points du n°1 de l'univers, la vitesse économique, la
présence d'au moins un éclaireur (×2), et la classe. Le bonus de l'Explorateur
est annoncé comme **1,5 × la vitesse économique de l'univers**, ce qui n'est pas
la même chose qu'un simple ×1,5.

Les risques : 5,6 % de pirates, 2,6 % d'aliens, et l'Explorateur divise les deux
par deux. Les pirates ont vos technologies moins trois niveaux, les aliens plus
trois. Un combat d'expédition laisse 10 % en débris sur la position 16, et ces
débris ne se récoltent qu'à l'éclaireur, pas au recycleur.

En vaisseaux trouvés, le plafond annoncé est de 500 000 unités de valeur.

### Ce que le copilote en fait

Le plafond est lu dans le classement public pour en déduire la tranche du n°1,
l'éclaireur double, l'Explorateur multiplie par 1,5, la vitesse économique
multiplie, le stationnement est compté à une heure. Les expéditions simultanées
viennent du jeu quand la page Flotte est fraîche, de la formule sinon — avec le
+2 de l'Explorateur.

La table `EXPO_CAPS` (neuf tranches de points du n°1) n'a pas d'équivalent sur
le wiki : c'est une estimation communautaire. Elle reste la meilleure
approximation disponible.

### Pour le copilote

- **À ajouter** : le +1 expédition de l'Amiral. Et, si un relevé en jeu le
  confirme, le second facteur de vitesse économique dans le bonus de
  l'Explorateur — c'est la plus grosse incertitude chiffrée de tout le copilote,
  et dans un univers rapide elle change les gains d'un facteur égal à la vitesse.
- **À corriger** : rien de certain. Le `×1,5` est à vérifier, pas à changer à
  l'aveugle.
- **À retirer** : le réglage manuel « Points du n°1 de l'univers ». Le copilote
  affiche lui-même « Ce réglage ne sert plus » dès que l'API répond, et l'API
  répond dans l'extension. Ça fait disparaître un `select`, la table
  `EXPO_LABELS` et une branche de `top1Tier()`.

---

## 7. Mise à l'abri

### La règle

« If it sits, it gets hit. » Une flotte en vol ne peut pas être détruite, donc
on l'envoie dormir en l'air avec toutes les ressources à bord.

La seule chose qui compte, c'est ce que la **phalange de capteurs** voit.
Construite sur une lune, elle scanne une planète pour 5 000 deutérium et montre
les flottes en route, leur composition et leur heure d'arrivée. Une lune ne se
scanne pas.

Conséquence, et c'est la règle centrale :

- **Sans lune**, une seule mise à l'abri tient : un **déploiement** d'une de vos
  planètes vers une autre — et elle ne tient que parce qu'un déploiement
  **rappelé** est la seule mission vers une planète qu'aucune phalange ne voit.
  Il faut donc être revenu avant l'arrivée, et rappeler. Un rappel repart pour
  exactement le temps déjà volé.
- **Avec une lune**, un déploiement de lune à lune est indétectable. C'est la
  meilleure mise à l'abri du jeu.
- Transport, récolte et attaque sont des suicides : visibles, et une fois le
  retour entamé il n'y a plus rien à faire.

Et un conseil qui vaut autant que la mécanique : être imprévisible. Varier la
vitesse, éviter 100 %, varier les heures.

### Ce que le copilote en fait

`fsFor()` suit l'ordre du wiki : déploiement vers une autre planète d'abord,
sinon un aller-retour vers la position 16 d'un système choisi pour son temps de
vol. Il exclut 100 %, fait tourner le cran de vitesse avec le jour du mois, et
cale le réveil. Il reconnaît lui-même, en commentaire, que l'expédition n'est
pas sur la liste du wiki et qu'il s'en sert faute de mieux.

Il manque la moitié du conseil : **le copilote ne dit jamais de rappeler le
déploiement**. Or c'est le rappel, pas le déploiement, qui rend la manœuvre
invisible. Tel quel, il propose la bonne mission avec la mauvaise consigne.

### Pour le copilote

- **À ajouter** : la consigne de rappel sur chaque déploiement de mise à l'abri,
  et le minuteur qui va avec — il faut être là avant l'arrivée. C'est la
  correction la moins chère et la plus utile de tout ce document : une phrase et
  un minuteur, pour une manœuvre qui protège tout le compte.
- **À corriger** : ~~l'espionnage vers la position 16 comme solution de repli~~
  — fait en 1.58.0. La raison était plus sèche encore que celle écrite ici : la
  16 n'accepte que l'Expédition, le jeu refusait l'ordre. Le repli est
  désormais toujours une expédition, avec la sonde à bord quand la planète en a
  une, puisqu'elle y double les gains.
- **À retirer** : rien.

---

## 8. Lunes

### La règle

Une lune naît d'un champ de débris de plus de 100 000 ressources : 1 % de chance
par 100 000, plafonné à 20 %. Les débris valent 30 % des vaisseaux détruits
(métal et cristal seulement, jamais le deutérium, et la défense détruite n'en
produit pas).

Une lune commence avec **une** case. La Base lunaire en ajoute 4 par niveau et
en consomme 1, donc 3 nettes. La taille de la lune plafonne le tout :
(taille / 1000)² cases.

On n'y construit que : usine de robots, chantier spatial, hangars (inutiles),
Base lunaire, Phalange de capteurs, Porte de saut. Pas de mines, pas de
laboratoire, pas de nanites, pas de terraformeur, pas de silo. La défense, elle,
se construit normalement.

La portée de la phalange est niveau² − 1 systèmes, +20 % pour l'Explorateur.

Une lune se détruit à l'Étoile de la mort : (100 − √taille) × √nombre de chance
de la détruire, √taille / 2 de perdre la flotte.

### Ce que le copilote en fait

Rien. Le modèle du copilote n'a pas de lunes. C'est le plus gros trou, et il
n'est pas qu'une table de données manquante : sans lune, le conseil de mise à
l'abri reste structurellement le plus faible que le jeu propose, et la phalange
adverse reste invisible au joueur.

### Pour le copilote

- **À ajouter** : les lunes comme objets du modèle, à terme. Avant ça, bien
  moins cher et déjà utile : dire au joueur quand un champ de débris chez lui
  dépasse 100 000 et quelle chance de lune ça représente, et l'avertir qu'une
  lune adverse à portée de phalange voit ses déploiements.
- **À corriger** : rien à corriger, il n'y a rien.
- **À retirer** : rien.

---

## 9. Formes de vie

### La règle

Quatre races : Humains (de départ), Roctas, Mécas, Kaeleshs. Les trois autres se
découvrent, et seuls les Humains ont la technologie pour les découvrir.

Le cœur de la mécanique est la **population** : chaque race a un bâtiment qui
produit de la population et un autre qui produit de la nourriture, plus deux
bâtiments qui font passer la population aux paliers 2 et 3. Avec assez de
population, on ouvre jusqu'à 18 recherches de forme de vie. Les joueurs avancés
mélangent les races selon les planètes.

### Ce que le copilote en fait

Il lit le panneau du jeu : noms, niveaux, coûts observés, et la phrase d'effet
pour savoir quelle ressource une case augmente. Il apprend les coûts par
observation, les borne, et classe les cases. Il ne modélise ni population, ni
nourriture, ni paliers — ce qui est cohérent avec une extension en lecture
seule, qui préfère lire plutôt que deviner.

`OG_LF_TECH` s'arrête à 4 recherches sur 18 pour les Humains, et les séries
d'identifiants des trois autres races ne sont pas relevées. Le commentaire du
code le dit, et refuse explicitement de les déduire.

### Pour le copilote

- **À ajouter** : rien de modélisé. Relever les identifiants manquants au fil
  des parties, comme le code prévoit déjà de le faire.
- **À corriger** : rien.
- **À retirer** : rien.

---

## 10. Univers et joueurs

### La règle

**Bashing** : pas plus de 6 attaques sur une même planète ou lune en 24 heures,
12 ou 20 dans les univers rapides. Les inactifs ne comptent pas, mais si le
joueur revient et que plus de 6 attaques sont encore en vol, c'est une
infraction. Les flottes entièrement détruites ne comptent pas, ni les sondes en
mission d'espionnage, ni les missiles interplanétaires. La destruction de lune
compte.

**Espionnage** : ce que le rapport révèle dépend de
`nombre_de_sondes + écart × |écart|`, où l'écart est votre niveau moins le sien.
Il faut 2 pour voir la flotte, 3 la défense, 5 les bâtiments, 7 les recherches.
Trois niveaux de retard coûtent 9 sondes avant même de commencer à voir quelque
chose.

**Matière noire**, **marchand**, **alliance**, **points d'honneur**, **combat
d'alliance** : tout cela est du jeu payant ou social, hors de portée d'une
extension en lecture.

### Ce que le copilote en fait

L'onglet Cibles trouve les inactifs et chiffre le pillage. Il ne dit jamais
combien de sondes il faut envoyer pour que le rapport montre la flotte et la
défense — alors que c'est précisément la question qu'il pose au joueur
(« Vérifie qu'il n'a ni flotte ni défense ») et que le plan réclame déjà
5 sondes sans expliquer pourquoi 5.

Rien sur le bashing.

### Pour le copilote

- **À ajouter** : le nombre de sondes nécessaire, calculé depuis le niveau
  d'espionnage du joueur, à côté de chaque cible. C'est une ligne de formule et
  ça remplace un chiffre magique par une raison. Et un compteur de bashing si le
  joueur pille la même cible plusieurs fois par jour.
- **À corriger** : rien.
- **À retirer** : rien, et ne rien ajouter non plus sur la matière noire, le
  marchand ou l'alliance.

---

## Décompte

Ce que cette revue a produit, en chiffres.

**Lu** : 24 pages du wiki — Formulas, Defense, Combat, Expedition, Officer,
Class, Collector, General, Discoverer, Commander, Astrophysics, Sensor Phalanx,
Moon, Fleetsaving, Bashing, Crawler, Lifeform, Debris Field, Terraformer,
Missile Silo, Alliance Depot, Espionage, Dark Matter, Fuel Consumption.

**Formules vérifiées comme justes dans le copilote** : 15 — production des trois
mines, revenu de base, consommation d'énergie des mines, solaire, fusion et sa
consommation de deutérium, satellite, facteur d'énergie, capacité de hangar,
coûts par niveau et facteurs, arrondi de l'astrophysique, temps de recherche,
temps de construction des vaisseaux et de la défense, distance (donut compris),
temps de vol, carburant.

**Écarts entre le copilote et le wiki** : 2, tous deux à trancher par une mesure
en jeu — le facteur `4 − L/2` des bâtiments de bas niveau (absent du wiki), et le
bonus d'expédition de l'Explorateur annoncé comme 1,5 × vitesse économique et
appliqué comme 1,5.

**Erreurs franches trouvées** : 2, **corrigées toutes les deux** — la foreuse à
qui manquait le prérequis Laser 4, et le carburant jamais retiré de la soute.

**Fausse piste** : `shipTime()` semblait oublier le deutérium. Vérification
faite, l'intégrité de structure n'en contient pas : la fonction était juste.

**Bonus de classe et d'officier** : 13 modélisés sur 35. Le Collecteur est
quasi complet (7 sur 8), l'Explorateur à moitié (4,5 sur 9), les officiers à
peine (1,5 sur 7), et le **Général à zéro sur 11** alors qu'il est proposé dans
les réglages.

**Mécaniques absentes et assumées** : simulateur de combat, missiles, matière
noire, marchand, alliance, points d'honneur — toutes bonnes à rester dehors.

**Mécanique absente et coûteuse** : les lunes, et avec elles la phalange, les
champs de débris et la meilleure mise à l'abri du jeu.

**Réglages à retirer** : 2 sûrs — « Points du n°1 de l'univers » (mort dès que
l'API répond, le copilote le dit lui-même) et « Collecteur : +25 % soute »
(bonus de classe déguisé en option). Deux candidats à discuter : les quatre
objectifs de colonisation, qui classent presque pareil puisque les cases et le
métal culminent tous deux en position 8, et les cinq kits de démarrage, alors
que le copilote imprime déjà le seul ordre de construction que le wiki conseille.

---

## Roadmap qui en sort

Du moins cher au plus cher, à certitude décroissante.

**1. Corrections. — Fait.** Prérequis Laser 4 de la foreuse, et carburant retiré
de la soute dans `flight()`, le pillage et la mise à l'abri. Deux tests ajoutés.
Reste le kit de colonie, qui dimensionne encore ses transporteurs sur la soute
brute.

**2. La consigne de rappel.** Dire de rappeler le déploiement de mise à l'abri,
et poser le minuteur avant l'arrivée. Une phrase, un minuteur, et la manœuvre
devient celle que le wiki décrit.

**3. Le petit nettoyage.** Retirer les deux réglages morts. Trancher sur les
objectifs de colonisation et les kits.

**4. Ce qui remplace un chiffre magique par une raison.** Le nombre de sondes
pour l'espionnage. La reconstruction à 70 % dans l'argumentaire de la défense.

**5. Un relevé en jeu, puis une décision.** Chronométrer un bâtiment de niveau 2
et un de niveau 8 pour trancher le facteur `4 − L/2`. Relever une expédition
d'Explorateur pour trancher le facteur de vitesse économique. Les deux sont des
mesures, pas du code.

**6. Les bonus du Général.** Carburant −25 % et crans de 5 % d'abord : ce sont
les deux qui changent un chiffre que le copilote affiche déjà.

**7. Le Terraformeur.** Pour qu'une planète pleine ait une suite.

**8. Les lunes.** Le gros morceau, et à faire par l'extérieur d'abord : alerter
sur un champ de débris à 100 000, alerter sur une phalange adverse à portée.
Les modéliser vraiment est un chantier à part.
