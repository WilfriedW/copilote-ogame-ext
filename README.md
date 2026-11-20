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
3. Va dans **Réglages › Univers** et renseigne la **vitesse économie**, la
   **vitesse flotte** et ta **classe**. Ces trois valeurs ne se devinent pas :
   elles sont sur la liste des univers à la connexion. Mal réglées, tout
   l'onglet Empire est faux.
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

**Réglages › Sauvegarde › Copier mes données** te donne tout ton état en texte :
garde-le avant de désinstaller ou de changer de machine, c'est la seule copie de
tes réglages.
