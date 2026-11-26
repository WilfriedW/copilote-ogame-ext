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

## Mettre à jour

**Réglages › Version** dit en quelle version tourne le panneau, si le dépôt en
a une plus récente, et liste les versions passées — date, empreinte du commit
et ce qu'elle apportait. Pour prendre la dernière : refais l'installation
ci-dessus avec le nouveau zip, puis **Recharger** sur `chrome://extensions`.
Tes données restent, elles ne vivent pas dans le dossier.

Depuis le dépôt, c'est `git pull && ./pack.sh`, puis **Recharger**. Pour
revenir à une version passée, `git checkout` son empreinte et `./pack.sh` —
mais une version plus ancienne relit un stockage écrit par la nouvelle, donc
garde un `save.json` d'avant sous la main.

## Les expéditions

Le bloc **Expéditions** d'Aujourd'hui dit combien d'emplacements sont pris,
quand le prochain rentre, et pour chaque emplacement libre d'où partir, avec
quoi, vers quelle position 16 et pour quel carburant. **Préparer** ouvre le
formulaire de flotte du jeu avec la planète, les vaisseaux, la destination et
la mission déjà posés. **La durée d'exploration reste à choisir dans le
jeu** : le panneau dit celle qu'il vise, il ne la règle pas. Et l'envoi est
toujours ton clic — le copilote ne clique jamais à ta place.

La flotte se compose comme le framework d'expédition de la communauté : une
sonde, un éclaireur, un gros vaisseau — le plus avancé que tu aies, car c'est
lui qui décide de ce qui se trouve — des grands transporteurs jusqu'au fret
visé, puis des vaisseaux de combat jusqu'au plafond de points, sans jamais le
dépasser de plus de 5 %.

Trois réglages dans **Outils › Flotte**, parce que ces chiffres sont des
estimations à calibrer, pas des lois du jeu :

- **facteur de fret** : les ressources qu'une expédition ramène par point de
  flotte. 200 au départ. Si tes soutes reviennent à moitié vides, baisse-le ;
  si elles reviennent pleines à ras bord, monte-le.
- **réserve de grands transporteurs** : ceux qu'une expédition ne prendra
  jamais, parce qu'ils servent aux convois et à la mise à l'abri du soir.
  Zéro au départ.
- **durée d'exploration par défaut** : une heure, celle qui rapporte le plus à
  l'heure passée en l'air. En mode nuit, le panneau allonge de lui-même pour
  que la flotte rentre à ton retour.

Le plafond de points, lui, se déduit des points du n°1 de l'univers, lus dans
le classement public.

## À savoir

**Il faut jouer en français.** Le Copilote lit le tableau de production, les
slots de flotte, les expéditions et les artéfacts dans le texte de la page, et
ce texte est attendu en français. Dans une autre langue, les niveaux et les
files continuent de marcher, mais ces quatre-là restent vides sans rien dire.

Tes données ne sortent jamais de ton navigateur : elles sont rangées dans le
stockage local de l'extension. Rien n'est envoyé nulle part. Le seul appel
réseau va à l'API publique de ton univers, celle que tout le monde peut lire,
pour le classement — sans aucun identifiant. À l'ouverture, le panneau lit
aussi le numéro de version du dépôt public sur GitHub, pour te dire s'il en
existe une plus récente : un fichier public, sans identifiant ni cookie.

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
