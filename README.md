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

## Les heures

L'interrupteur à côté du badge, en haut du panneau, choisit dans quel fuseau
le panneau écrit **toutes** ses heures — retours d'expédition, fins de
construction et de recherche, arrivées de flotte, alertes : **heure serveur**
(au premier lancement, comme le jeu) ou **heure locale** (celle du navigateur).
Le libellé à côté dit le mode actif. Survole une heure : l'infobulle donne la
même dans l'autre fuseau. Les comptes à rebours ne bougent pas. Les dates des
messages et les heures d'arrivée, dans les pages du jeu, suivent le même
interrupteur ; seule l'horloge du jeu reste toujours en heure serveur.

L'heure du serveur se relit à chaque page du jeu, donc l'écart suit seul les
changements d'heure, même les semaines où l'Europe et l'Amérique ne changent
pas le même dimanche. Si une page ne la donne pas, le dernier écart connu sert
et l'infobulle dit « décalage non vérifié ». Le choix est retenu d'une session
à l'autre, et `save.json` porte toujours les deux heures (`serverTime`,
`localTime`, `localTimeZone`, `serverOffsetMinutes`).

## Les cartes en onglets

Le bouton 🗂️ de l'en-tête — ou **Réglages › Allure du panneau › Organiser les
sections en onglets** — range les cartes d'**Aujourd'hui** (Profil,
Maintenant, Alertes, Expéditions, Ta journée, Minuteurs) en onglets, avec la
même barre que dans **Outils**. Une seule carte s'affiche, toujours dépliée ;
ses sections internes gardent leur état. Empilé reste le mode par défaut.

- Chaque onglet porte un compteur : **rouge** s'il contient au moins un
  élément urgent, **orange** un élément à surveiller, **gris** des conseils
  seulement. Pas de compteur quand l'onglet est vide.
- Alertes n'a d'onglet que lorsqu'il y a une alerte ; les autres cartes ont
  toujours le leur.
- Une nouvelle alerte urgente fait basculer une fois sur son onglet. Revenir
  sur le tien ne te ramène pas pour la même alerte ; une autre, si. Une alerte
  déjà vue en mode empilé ne fait pas basculer.
- L'onglet choisi est retenu sur cette machine (changement de page, de
  planète, redémarrage). S'il n'existe plus, c'est le premier qui s'affiche,
  et le tien revient dès qu'il réapparaît.
- En passant en onglets, la carte où tu t'étais arrêté de défiler devient
  l'onglet actif ; en revenant à la pile, le panneau défile jusqu'à elle.
- Le mode suit ton compte d'un poste à l'autre, comme l'interrupteur des
  heures.

## Combien de cartes par liste

Chaque liste d'Aujourd'hui — **Maintenant**, **Alertes**, **Expéditions**,
**En attente de ressources**, **Déjà en cours** — montre d'office 3 cartes. Le
menu **Afficher** en tête de liste change ce nombre pour cette liste seule
(1, 3, 5, 10 ou Toutes) ; **Réglages › Affichage** change la valeur de toutes
les listes et montre celles qui ont la leur. **Réinitialiser** les remet toutes
sur la valeur commune.

Les cartes **urgentes** s'affichent toujours, en plus de la limite. Le reste se
déplie sur place avec **Voir N de plus**, et le panneau s'en souvient d'un
démarrage à l'autre. Le compteur en tête de liste compte toutes les cartes,
masquées comprises : la limite ne coupe que l'affichage, jamais les calculs.

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

## Flottes en vol et sécurité

Le copilote lit les mouvements de flotte que **le jeu t'affiche déjà** —
l'encart des événements de la vue d'ensemble, quand tu l'ouvres, et la page
Mouvements de flotte : les tiens (aller et retour, toutes missions) et les
flottes hostiles (attaques, attaques groupées, espionnages), avec l'heure, les
vaisseaux et la cargaison. Il n'envoie aucune requête au serveur pour les
rafraîchir.

**Conseils de construction.** Les ressources d'une planète se projettent avec
les convois qui arrivent : la production s'arrête au hangar, une livraison
non. Un conseil en attente dit « Finançable à 07:12 (convoi Tourtierion,
30 GT) », « Finançable à … (production) » ou « Non finançable sous 24 h ». À
l'arrivée du convoi, il passe dans les actions de maintenant.

**Attaque entrante.** Une carte critique en tête d'Aujourd'hui, avec compte à
rebours : ressources exposées à l'impact, constructions finançables pour
dépenser, transport de la flotte à quai vers un coffre-fort, et les convois à
toi qui arrivent avant l'impact + 10 min (« à rappeler ou à laisser » : ta
décision). L'icône affiche « ! ». Un espionnage hostile donne une alerte
Importante.

**Rappel de mise à l'abri.** Réglages › Sécurité : tes planètes coffres-forts,
l'heure du rappel (22:00), les jours actifs, l'heure de réveil — la fin de
nuit du plan du jour, un seul réglage pour les deux (7 h) —, et
« Préférer Stationner ». À l'heure du rappel l'icône affiche « FS » — aucune
notification — jusqu'à ce que tu ouvres **Plan de la nuit** dans Aujourd'hui.
Le plan propose une vitesse, et au besoin une heure de départ, pour que la
flotte se pose à ton réveil. Heures du rappel en heure locale du navigateur.

Les transports suggérés vont au coffre-fort le plus proche (même galaxie
d'abord), jamais vers un coffre-fort attaqué, en mission Transport par défaut.
**Préparer** remplit vaisseaux, cible et mission dans le formulaire du jeu ;
les ressources se recopient (⧉) et la vitesse se règle à la main. L'envoi
reste ton clic.

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
