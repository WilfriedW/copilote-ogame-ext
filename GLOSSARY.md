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

**défense** :
Ce qui est posé au sol d'une planète et ne bouge pas. Elle ne protège pas la
planète : elle rend le pillage non rentable, en valant plus que ce qu'un
pilleur peut emporter. Contre une flotte décidée, rien ne tient — c'est la
mise à l'abri qui sert. Elle se compte par type, jamais en bloc : un tas d'un
seul type est gratuit à percer.
_Éviter_ : protection, bouclier (le bouclier est une pièce de la défense, pas
la défense), invulnérable.

**chair à canon** :
Les pièces nombreuses et peu chères — lanceurs de missiles, lasers légers —
dont la masse encaisse les tirs pour que les gros canons tirent. Deux types
valent mieux qu'un : chaque vaisseau d'attaque a un tir rapide contre l'un et
rien contre l'autre.
_Éviter_ : piétaille, remplissage.
