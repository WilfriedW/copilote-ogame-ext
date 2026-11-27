# Copilote OGame

Le panneau latéral lit les pages du jeu et dit au joueur quoi faire ensuite.
Ce glossaire fixe les mots du domaine : ce qu'ils désignent, et lesquels
éviter. Il ne décrit pas le code.

## Langue

**planète** :
Un corps de l'empire du joueur. Son identité ne vient pas du jeu : son nom,
ses coordonnées et son identifiant de jeu peuvent changer, manquer, ou se
répéter d'une planète à l'autre. Une planète porte donc une identité propre
au copilote, que rien d'extérieur ne fixe, et que rien ne réutilise après
elle.
_Éviter_ : colonie (une colonie est une planète qui n'est pas la mère, pas un
synonyme), corps, base, emplacement.

**priorité** :
Ce que le joueur pose : une cible chiffrée, bâtiment ou recherche, avec le
niveau qu'il vise. Elle s'accomplit quand le niveau est atteint.
_Éviter_ : objectif, cible — « Cibles » est l'onglet des inactifs à piller, et
objectif est ce que le moteur en fait.

**objectif** :
L'épargne que le plan ouvre sur une planète, qu'elle vienne du moteur ou d'une
priorité.
_Éviter_ : réserve, qui est le montant, pas la raison.

**demande** :
Ce que la page envoie au panneau sur un clic droit : un niveau visé pour une
tuile, ou son retrait. Elle devient une **priorité** quand le panneau a su la
placer, et le panneau la retire alors ; tant qu'elle attend, la tuile la montre
comme non confirmée. Ce que le plan en fait est un **objectif**.
_Éviter_ : ordre, commande (une commande est ce qu'on passe au jeu pour un
vaisseau).

**nom**, **coordonnées**, **identifiant de jeu** :
Trois choses que le jeu dit d'une planète. Chacune se lit, s'affiche et sert
à parler au jeu ; aucune ne désigne la planète de façon sûre. Un rang dans
une liste n'en est pas une non plus : il change dès que la liste change.
_Éviter_ : désigner une planète par l'une d'elles.

**labo effectif** :
Le niveau de laboratoire qui fixe la **durée** d'une recherche : celui du
centre, plus les meilleurs laboratoires des autres planètes que le Réseau de
recherche intergalactique y relie, autant qu'il a de niveaux. À distinguer du
laboratoire du centre, qui seul **débloque** : un prérequis est une propriété
de la planète, et le Réseau ne le remplit jamais. Confondre les deux fait
croire débloqué ce qui ne l'est pas, ou fait annoncer une durée que le jeu ne
tiendra pas.
_Éviter_ : niveau de labo (ne dit pas lequel des deux), labo de l'empire, somme
des labos (le Réseau n'en relie qu'un nombre borné).

**défense** :
Ce qui est posé au sol d'une planète et ne bouge pas. Elle ne protège pas la
planète : elle rend le pillage non rentable, en valant plus que ce qu'un
pilleur peut emporter. Contre une flotte décidée, rien ne tient — c'est la
mise à l'abri qui sert. Elle se compte par type, jamais en bloc : un tas d'un
seul type est gratuit à percer.
_Éviter_ : protection, bouclier (le bouclier est une pièce de la défense, pas
la défense), invulnérable.

**règle** :
Une bonne pratique décrite dans `rules.json` : ce qu'elle surveille sur une
planète, son niveau, ses seuils, ses textes. Le joueur l'allume, l'éteint et
règle ses seuils ; le fichier garde le reste.
_Éviter_ : alerte (une règle n'alerte pas forcément), conseil (c'est une ligne
du bloc, pas la règle).

**constat** :
Ce qu'une règle trouve sur une planète à un instant : elle, la planète, un
niveau et une valeur. Il disparaît dès que la situation change.
_Éviter_ : alerte, problème.

**pousser**, **marquer**, **suspendre**, **signaler** :
Les quatre choses que le moteur fait d'un constat, et rien d'autre. Pousser :
ajouter une construction que le plan paie comme les autres. Marquer : donner
son niveau à une carte que le plan sort déjà. Suspendre : retirer ce qui
dépend d'une donnée manquante. Signaler : une ligne du bloc des conseils,
seulement quand le plan n'a rien qui y réponde.
_Éviter_ : déclencher, afficher (une règle qui ne fait qu'afficher est
précisément ce que le moteur refuse).

**niveau** (d'une règle ou d'une carte) :
Critique, Important ou Conseil — un seul vocabulaire dans tout le panneau. Il
se lit sur la carte ; il ne la déplace pas.
_Éviter_ : Urgent, Attention, sévérité, priorité (une priorité est ce que le
joueur pose).

**race** :
L'espèce de formes de vie d'une planète : Humains, Rock'tal, Mécas ou Kaelesh.
Posée à la main, ou lue dans le jeu ; une lecture qui se contredit n'en est
pas une.
_Éviter_ : forme de vie (c'est le système de jeu, pas l'espèce), faction.

**chair à canon** :
Les pièces nombreuses et peu chères — lanceurs de missiles, lasers légers —
dont la masse encaisse les tirs pour que les gros canons tirent. Deux types
valent mieux qu'un : chaque vaisseau d'attaque a un tir rapide contre l'un et
rien contre l'autre.
_Éviter_ : piétaille, remplissage.
