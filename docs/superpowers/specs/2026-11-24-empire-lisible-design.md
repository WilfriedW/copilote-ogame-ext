# Rendre la page Empire lisible

*Petite modification. Une vue, une feuille de style, aucune donnée nouvelle.*

## Pourquoi

Le joueur vient sur l'onglet Empire pour **deux choses, dans le même passage** :
regarder sa production, et remplir les niveaux visés. La page en montre dix.

Ce qu'elle empile aujourd'hui, pour chacune des 7 planètes, d'un seul tenant :
quatre jauges, une pastille forages, cinq phrases de conseil toutes en `.note`
gris 12 px, puis un volet de ~45 champs de saisie. Soit plus de 300 champs sur
une page, dont le volet « Bâtiments et niveaux visés » ouvert par défaut.

Et surtout : dans `applique le relevé` (`app.js:5551`), le jeu réécrit **nom,
coordonnées, température, tous les niveaux, satellites, formes de vie et
stocks**. Sur les ~45 champs d'une planète, deux sortes seulement appartiennent
au joueur : les `→` (niveaux visés) et la case Centre. Le reste *ressemble* à de
la saisie sans en être. La page crie « remplis-moi » partout, alors qu'une seule
colonne est à remplir.

## Buts

- Lire la production de tout l'empire **sans rien déplier**.
- Que le champ `→` soit le seul champ vif de sa ligne.
- Que la prose de conseil reste accessible sans être dans le passage.

## Non-buts

- Le tableau des recherches (`VIEWS.research`) : déjà replié, on n'y touche pas.
- Les calculs, les conseils eux-mêmes, le relevé : rien ne change au fond.
- Les autres onglets.

## Contre-buts

- **Faire des allers-retours** : regarder la prod et saisir les objectifs doivent
  rester un seul passage, sur la même page.
- **Rendre intypable un niveau que le jeu n'a pas lu** : hors extension, au
  premier lancement, ou sur une planète révélée par la liste mais jamais
  visitée, les niveaux doivent rester saisissables.

## Approches considérées

| | Ce que c'est | Pourquoi pas |
|---|---|---|
| **A** Dégraisser la carte sur place | niveaux relevés en lecture seule, prose repliée, volet fermé | seule, ne règle pas les 7 cartes empilées |
| **B** Séparer lire et saisir | Empire en lecture, les objectifs dans leur propre vue | **écartée** : impose des allers-retours, contre-but |
| **C** Une planète ouverte à la fois | chaque carte se replie en une ligne portant sa prod | seule, ne dégraisse pas la carte ouverte |

**Retenu : A + C**, qui se complètent — C cache le gros du bruit, A nettoie ce
qui reste visible quand une planète est ouverte.

## Ce qui est décidé

**La carte de planète devient un `<details class="volet">`**, fermé par défaut,
dont le résumé porte : nom, coordonnées, et la production métal / cristal /
deutérium en chiffres compacts. Sept lignes : l'empire se lit sans un clic.
L'état se souvient par planète, via le `fold('pl:'+p.id, false)` existant — pas
d'accordéon, pas de logique nouvelle : ouvrir une deuxième planète n'en ferme
aucune.

**Les niveaux relevés passent en lecture seule**, au style pointillé déjà défini
pour les formes de vie (`panel.css:170`). Condition : `IS_EXT && p.gid &&
!p.bNeuve` — le jeu les a réellement lus. Partout ailleurs ils restent
saisissables (contre-but ci-dessus).

**Le `→` devient le champ vif** : bordure pleine et accent, là où le niveau
relevé est muet. C'est le seul endroit de la carte où l'on tape.

**La prose de conseil se replie** dans un `<details class="volet">` « Pourquoi
cette planète », fermé : raison de la vocation, note du centre, le labo qui ne
suit pas, l'espionnage. Restent visibles dans la carte ouverte : la pastille de
vocation, la pastille forages, la case Centre, et « Flotte à quai » — des faits
courts, pas du conseil.

**Les stocks sortent du volet des bâtiments** vers leur propre
`<details class="volet">`, dont le résumé porte les trois valeurs. Ils sont
aujourd'hui le seul endroit où le stock se lit en chiffres : le résumé le rend
lisible sans ouvrir, et ouvrir sert à recaler.

**Le pavé « Mélange produit… »** de la carte d'empire se replie derrière
« Pourquoi ce classement ». Les jauges et la pastille d'énergie restent.

**Le volet « Bâtiments et niveaux visés »** reste fermé par défaut et annonce
dans son titre combien d'objectifs sont posés sur cette planète.

## Laissé au constructeur

- Le format exact des chiffres du résumé (`fmt()` compact, séparateur).
- Les identifiants des nouveaux nœuds que `REFRESH.planets` doit remplir
  (résumé de prod, résumé de stock, compte d'objectifs) : même mécanique que
  `pres-`, `pvoc-`, `pctrn-` aujourd'hui.
- Vérification : rendu par la recette d'aperçu (Node + `test/harness.js`, HTML
  autonome sans script dans le dossier du dépôt), à ~820 px, volets ouverts puis
  fermés.
