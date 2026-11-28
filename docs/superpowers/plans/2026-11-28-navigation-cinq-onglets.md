# ENH-75 : cinq onglets principaux, tout se replie

Issue : #75. Ce plan précède le code (CLAUDE.md, « gros changement »).

## Décisions déjà prises (ailleurs que dans l'issue)

- « Ta journée » est retirée (ISS-72, #117). Les Minuteurs sont passés dans
  Outils (#119) : ils y restent, Aujourd'hui ne les reprend pas.
- La carte « Cible sur plusieurs planètes » porte déjà son nouveau nom (ENH-74, #121).
- Conflit de nom « Cibles » : on retient la proposition de l'issue, Outils ›
  Cibles devient **Pillage**. Une carte de décision a été posée au joueur ;
  si sa réponse diffère, seul le libellé change.

## 1. La barre principale

- `ONGLETS` (src/vues/navigation.js) : liste des onglets principaux, `[clé, libellé]`.
  `ongletsPrincipaux(liste)` renvoie la liste avec `tools` toujours en dernier,
  quel que soit l'ordre d'écriture. Un test ajoute un onglet après Outils et
  vérifie qu'Outils reste à droite.
- La barre est écrite par le code (`#tabs` vide dans sidepanel.html), une fois,
  au démarrage : plus de liste en double entre le HTML et le JS.
- Ordre : Aujourd'hui · Empire · Recherche / Cibles · Défense · Outils.
- Clés : `today`, `empire`, `niveaux` (nouvelle), `defense` (la vue Défense
  d'Outils, devenue principale), `tools`.

## 2. Aujourd'hui

- La carte Profil quitte `CARTES.today` et rejoint Réglages › Mon jeu, en tête
  (`profilCard()` + `profilBloc()`, inchangés).
- `CARTE_DEFAUT.today` vaut `maintenant`.
- Profil non posé : une ligne en tête de Maintenant renvoie vers Réglages ›
  Mon jeu (`data-goto="settings:jeu"`).
- « Tes priorités » sort de `#tdNow` pour son propre emplacement `#tdPrios`,
  juste sous Maintenant, dans le même onglet : replier Maintenant la laisse voir.

## 3. Empire et Recherche / Cibles

- `CARTES.empire` ne garde que Planètes ; Empire sort de `VUES_ONGLETS` et
  n'a plus de sous-onglets.
- Nouvelle vue `niveaux` :
  1. Recherches et niveaux visés (`VIEWS.research()`, déplacé),
  2. Cible sur plusieurs planètes (`poseBloc()`, déplacé),
  3. Cibles par planète : un volet par planète, ses bâtiments avec niveau
     relevé (lecture seule) et niveau visé, puis ses formes de vie (`lfBloc`).
- Dans Empire, le volet « Bâtiments et niveaux visés » devient « Bâtiments » :
  les niveaux restent saisissables (planète non relevée), les champs « → »
  partent, un renvoi « Cibles de cette planète » mène à l'onglet.
- `REFRESH.niveaux` relance ce que `REFRESH.research` faisait ; les champs
  gardent leurs attributs `data-prio`, `data-pid`, `data-kind` : `bind()` les
  trouve où qu'ils soient.

## 4. Défense

- `defense` devient un onglet principal. `TOOLS` perd `defense`.
- Outils : Pillage, Colonie, Flotte, Lune, Minuteurs, Serveur.

## 5. Tout se replie

- Les cartes titrées des cinq onglets passent de `<div class="card"><h2>` à
  `<details class="card">` avec `fold(clé, défaut)` ; les identifiants
  internes (`#tdNow`, `#exRaid`…) ne bougent pas.
- Par défaut : Maintenant ouvert, et la première carte de chaque page ouverte ;
  les autres fermées.
- Une carte qui porte un critique ne reste pas fermée : Attaque n'est pas un
  volet, et une carte repliée affiche son compteur, en rouge s'il y a un critique.
- Réglages n'est pas touché : il est déjà rangé en cinq onglets (ENH-54), et
  l'issue le laisse inchangé.

## 6. Migration et renvois

- Onglet principal retenu inconnu : retour à Aujourd'hui.
- `S.ui.tool === 'defense'` : `toolTab()` retombe déjà sur Colonie ; un renvoi
  `tools:defense` mène à l'onglet Défense.
- Empire › Recherche, Aujourd'hui › Profil retenus : `ongletAffiche` retombe
  sur un onglet présent.
- `renvoiCible` : « Outils › Défense » et « Outils › Cibles » (anciens textes)
  mènent aux nouveaux endroits.

## Tests (d'abord, validés par mutation)

- Ordre de la barre, Outils à droite même ajouté en premier.
- Aujourd'hui sans Profil ; Profil dans Réglages › Mon jeu ; la ligne de renvoi.
- Empire sans sous-onglets ; la vue `niveaux` et ses trois blocs ; plus de
  champ « → » dans Empire, le renvoi présent.
- Défense principale ; Outils sans Défense ; libellé Pillage.
- Anciens états (`tools:defense`, Empire › Recherche, Aujourd'hui › Profil).
- Chaque carte titrée des cinq onglets est un `details` avec sa clé `data-fold`.
- Maintenant replié : Tes priorités hors du volet.

Les tests existants qui décrivent l'ancienne navigation sont réécrits sur la
nouvelle ; la PR les liste.

Version : 2.25.0.
