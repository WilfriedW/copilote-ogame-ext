# Copilote OGame

Un copilote en lecture seule pour OGame : il lit tes pages, tient tes niveaux et
ta production à jour, te dit quoi construire ensuite et te prévient quand une
file se vide. Il ne clique jamais à ta place et ne touche jamais à ton compte.

## Installer

Il faut **Chrome ou Edge, version 114 ou plus récente**. Firefox ne peut pas :
le panneau latéral n'y existe pas.

1. Dézippe `copilote-ogame.zip` quelque part où tu ne le supprimeras pas : le
   navigateur relit ce dossier à chaque démarrage.
2. Ouvre `chrome://extensions` (ou `edge://extensions`).
3. Active **Mode développeur**, en haut à droite.
4. Clique **Charger l'extension non empaquetée** et choisis le dossier dézippé
   (celui qui contient `manifest.json`, pas le zip).

Chrome t'affichera un bandeau « Désactiver les extensions en mode
développeur » à chaque démarrage. C'est normal pour une extension installée
hors du Store : laisse-le, il ne casse rien.

## Premiers pas

1. Ouvre OGame et connecte-toi. L'icône du Copilote ne s'allume que sur les
   onglets du jeu.
2. Clique l'icône : le panneau s'ouvre à droite. Au premier lancement il montre
   des **données d'exemple**, le temps qu'il lise tes vraies pages.
3. Vérifie le bandeau en haut du panneau : il affiche `éco x… · flotte x… ·`
   ta classe. Ces trois valeurs se lisent dans la page du jeu, tu n'as rien à
   chercher ni à régler. Si l'une manque, navigue une page de plus dans le jeu.
4. Clique **Actualiser** en haut du panneau : le relevé passe sur chaque page de
   chaque planète, puis te ramène où tu étais. Laisse-le finir.

Ensuite il se tient à jour tout seul au fil de ta navigation.

## À savoir

**Il faut jouer en français.** Le Copilote lit le tableau de production, les
slots de flotte, les expéditions et les artéfacts dans le texte de la page, et
ce texte est attendu en français. Dans une autre langue, les niveaux et les
files continuent de marcher, mais ces quatre-là restent vides sans rien dire.

Tes données ne sortent jamais de ton navigateur : elles sont rangées dans le
stockage local de l'extension. Rien n'est envoyé nulle part. Le seul appel
réseau va à l'API publique de ton univers, celle que tout le monde peut lire,
pour le classement — sans aucun identifiant.

**Réglages › Sauvegarde › Enregistrer dans un fichier** écrit `save.json`, et
**Charger un fichier…** le relit. C'est comme ça qu'on porte ses réglages d'un
poste à l'autre : en déplaçant le fichier soi-même.

Range-le **hors du dossier de l'extension**. Ce dossier-là se remplace à chaque
mise à jour, et ce qui s'y trouve part avec. Et si tu travailles depuis le
dépôt, il ignore `save*.json` exprès : un `save.json` commité, c'est ton empire
entier — planètes, coordonnées, flottes — dans un historique git qui ne
s'oublie pas, et qu'un dépôt ouvert ou partagé emporte tel quel.

C'est la seule copie de tes réglages : fais-la avant de désinstaller ou de
changer de machine.
