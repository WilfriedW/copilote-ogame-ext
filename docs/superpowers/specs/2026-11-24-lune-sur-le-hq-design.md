# Copilote OGame — Le tir de lune, calculé avant d'être tiré

Document de conception, 24 novembre 2026. Petit changement.

## Intention

Le joueur veut une lune sur son HQ, par un tir croisé avec un camarade de
guilde : le camarade envoie une flotte sur le HQ, la défense du HQ la détruit,
les débris des vaisseaux morts tombent chez le joueur, et le joueur rend la
pareille chez lui. Chacun paie la lune de l'autre avec ses propres vaisseaux.

Il ne demande pas que le copilote **gère** les lunes. Il demande qu'il
**calcule** le tir, avant qu'il ait lieu. C'est une distinction qui tient tout
ce document : les lunes comme objets du modèle restent dehors, et la revue du
wiki continue de les porter comme son plus gros trou.

Ce que le calcul vaut, en une phrase : **la chance de lune est linéaire en
débris**. 1 % de chance coûte 333 333 de métal+cristal en vaisseaux détruits,
que le tir soit gros ou petit. Le prix d'une lune ne dépend donc ni de la
taille des tirs, ni de la défense. Ce que le joueur ignore et que le copilote
peut lui dire, c'est combien de vaisseaux fait un tir, ce que sa défense
encaisse, et à combien la facture totale monte.

Le chiffre qui a décidé la conversation, calculé sur son relevé du 24 novembre
(3 077 lanceurs de missiles, 511 lasers légers, 351 lasers lourds, 213
artilleries à ions, 51 canons de Gauss, 11 lanceurs de plasma, Armes 8) : un
tir sort autour de **12 %**, pour un millier de chasseurs légers côté camarade.
Sa défense n'est pas le frein. En ajouter ne rendrait pas la lune moins chère —
seulement les tirs moins nombreux, jusqu'au plafond de 20 %.

## Objectifs

- Pour un nombre de vaisseaux donné, dire les débris et la chance du tir.
- Dire l'inverse : pour une chance visée, le nombre de vaisseaux.
- Dire si la défense de la planète les tue en six manches. C'est le **seul**
  chiffre estimé de la carte, et il est marqué comme tel.
- Dire la facture espérée d'une lune, et ce que le recyclage en rend.
- Avertir des deux seuils : sous 100 000 de débris le tir ne compte pour rien,
  au-delà de 2 000 000 le surplus est perdu.
- Avertir que la flotte au sol mourrait avec, et ce qu'elle coûterait.

## Non-objectifs

- **Les lunes comme objets du modèle.** Conséquence à assumer dans le texte de
  la carte : le copilote ne sait pas si une lune existe déjà sur la position,
  et il le dit plutôt que de le taire.
- **Lire le champ de débris.** `content.js` ne dessine que sur une liste fermée
  de pages (`content.js:19`) et n'analyse rien de la Galaxie. La carte calcule
  avant le tir, pas après.
- **Une alerte dans Aujourd'hui.** C'est ce que la revue proposait comme
  première marche, et elle demande de voir le champ de débris. Sans lui, elle
  n'a rien à déclencher.
- **Un simulateur de combat.** Voir les approches.
- **La base lunaire, la phalange, la porte de saut, l'Étoile de la mort.** Tout
  cela vit après la lune.
- **Le bashing.** Il ne s'applique pas : une flotte entièrement détruite ne
  compte pas dans les six attaques par 24 h (revue, § Bashing). Rien à
  compter, donc rien à avertir.
- **Construire des coques de combat.** Leurs coûts entrent parce que ce calcul
  les lit ; le copilote ne proposera toujours aucun chasseur.

## Anti-objectifs

- **Annoncer une chance que le jeu ne tiendra pas.** Le prix d'une lune est une
  espérance sur une dizaine de tirs. Un joueur qui lit « 12 % » et comprend
  « au huitième tir » a été trompé par la carte.
- **Dire « ta défense les tue » sur une défense jamais relevée.**
  `p.defs == null` veut dire inconnu, jamais zéro — c'est déjà le partage que
  `defsOf` fait (`app.js:2822`). Une défense inconnue ne rend aucun verdict.
- **Faire mourir la flotte du joueur.** Ses 538 chasseurs lourds au sol pendant
  un tir, c'est 5,4 M à sa charge, et c'est le copilote qui l'y aurait laissé
  en se taisant.
- **Présenter l'estimation de combat comme un chiffre lu.** La carte « Taille
  d'expédition » dit déjà **Estimation** en gras ; celle-ci fera pareil.

## Contraintes

- **La coque est `métal + cristal`, et rien ne s'ajoute au modèle pour elle.**
  Vérifié : les huit intégrités de la table de défense de la revue valent
  exactement `c[0] + c[1]` des huit pièces de `DEF` (`app.js:3820`), les huit.
  La même règle vaut pour les vaisseaux — le vaisseau de colonisation de
  `COL_SHIP_COST` (`app.js:1902`) la recoupe.
- **Les huit attaques sont dans la revue** (`docs/revue-wiki-ogame.md:249`) :
  80, 100, 250, 150, 1 100, 3 000, et 1 pour les deux boucliers. Rien
  d'inventé.
- **`SHIP_COST` (`app.js:3846`) ne porte que `sc`, `lc`, `pr`, `pf`, `crawl` et
  les huit pièces de défense.** Les coques de combat n'y sont pas, parce que
  le copilote n'en propose aucune.
- **Un seul chiffre vient d'ailleurs que la revue** : le +5 % d'attaque par
  niveau de Technologie Armes. Il vient du wiki. À marquer comme tel là où il
  s'emploie.
- Le modèle porte déjà tout le reste : `p.defs`, `p.def`, `p.ships`,
  `S.tech.weapons`, et `shipStats('rec').cargoEff` pour les recycleurs.
- **La revue dit « plus de 100 000 ».** Sous ce seuil, le copilote ne promet
  rien plutôt que d'annoncer une fraction de pourcent que la revue ne couvre
  pas.
- Lecture seule : la carte calcule, elle n'envoie rien et ne clique pas.
- Aucun chiffre affiché n'est estimé en silence.

## Approches

| | Ce que ça donne | Pourquoi pas |
| --- | --- | --- |
| **A. Un 4ᵉ onglet « Lune » dans Outils** | retenue | — |
| B. Deux lignes dans la carte Flotte existante | un peu moins de code | cette carte parle de temps de vol et de soute ; un calcul de combat n'y a rien à faire. Et le 4ᵉ onglet coûte une ligne dans `TOOLS` (`app.js:4202`) : il n'y a rien à économiser |
| C. Un vrai simulateur à six manches : tirs répartis, boucliers, règle d'explosion | le chiffre le plus juste | des centaines de lignes pour affiner ce que le plafond à 20 % écrase de toute façon, et le joueur ne peut rien faire de la troisième décimale. La revue dit déjà que le simulateur reste dehors ; son argument — « il demande de connaître la flotte adverse » — tombe ici, puisque le camarade annonce ce qu'il envoie, mais les deux autres tiennent |

## Ce qui est décidé

### Un onglet de plus dans Outils

`TOOLS` (`app.js:4202`) gagne `['moon','Lune']`, `VIEWS` et `REFRESH` gagnent
chacun un `moon()`, sur le patron exact de `fleet()` (`app.js:4429` et
`app.js:4720`) : des champs liés par `data-*`, une rangée de `gauge()`, une
note en bas. L'état vit dans `S.moonCalc`.

### Les formules

Toutes sur `v = métal + cristal` d'un vaisseau, et `n` son nombre.

1. **Débris d'un tir** : `D = 0,3 × n × v`. Jamais le deutérium, et la défense
   détruite n'en produit aucun.
2. **Chance du tir** : `p = D < 100 000 ? 0 : min(20, D / 100 000)` en pourcent.
3. **L'inverse** : pour une chance `p` visée, `n = p × 100 000 / (0,3 × v)`.
   C'est de l'arithmétique exacte, et c'est la direction principale de la
   carte.
4. **Facture espérée d'une lune** : `100 / p` tirs, donc `(100/p) × n × v` de
   vaisseaux détruits ; le joueur récupère `(100/p − 1) × D` en recyclant les
   tirs ratés. Le net est la différence.
5. **Voyages de recycleur** : `ceil(D / (p.ships.rec × shipStats('rec').cargoEff))`.

### Le seul chiffre estimé

Ce que la défense tue en six manches :

```
puissance = Σ(p.defs[k] × ATT[k]) × (1 + 0,05 × S.tech.weapons)
tirs      = Σ(p.defs[k])
tué       = 6 × puissance − 6 × tirs × bouclier_du_vaisseau
```

`ATT` est les huit valeurs de la revue, posées dans `DEF` à côté des coûts.
`tué` est en métal+cristal, donc directement comparable à `n × v`.

Deux écarts assumés, et la note de la carte les dit tous les deux :

- **Elle ignore la règle d'explosion** sous 70 % de coque, qui ne peut
  qu'augmenter le nombre tué. Pessimiste.
- **Le bouclier du camarade.** Son niveau de Technologie Bouclier monte le
  bouclier de ses vaisseaux et baisse donc `tué`. La carte lui demande ce
  niveau dans un champ, par défaut celui du joueur : un camarade de guilde est
  d'ordinaire comparable, et un chiffre demandé vaut mieux qu'une hypothèse
  muette.

### Ce que la carte montre

```
Lune                                    [HQ 88 4 ▾]

Ce qu'il envoie     [Chasseur léger ▾] [1000]   Son Bouclier [8]

  Débris 1 200 k   Chance 12 %   Ta défense tue ~1 000   3 voyages

Tu visais plutôt    [12] % de chance  →  1 000 chasseurs légers
                                          3,0 M métal · 1,0 M cristal

Facture espérée d'une lune : ~8 tirs, 25 M métal et 8 M cristal chez lui.
Tu ramasses ~8 M de débris sur les tirs ratés.

⚠ Sors ta flotte du HQ : 240 chasseurs légers et 538 chasseurs lourds au
  sol mourraient avec, 6,3 M à ta charge.

Estimation. La chance est linéaire : 1 % coûte 333 000 de vaisseaux, gros
tir ou petit. Sous 100 000 de débris aucune lune ne naît ; au-delà de
2 M le surplus est perdu. Le copilote ne connaît pas les lunes : il ne
peut pas savoir si ta position en porte déjà une.
```

### Les tables étendues

- **`SHIP_COST`** gagne les dix coques manquantes : `lf`, `hf`, `cr`, `bs`,
  `bc`, `bb`, `ds`, `rp`, `rec`, `col`. Elles viennent du wiki ; `col` recoupe
  `COL_SHIP_COST`, qui est déjà dans le code, et ce recoupement est le contrôle
  de la table.
- **`DEF`** gagne un `a:` par pièce, les huit attaques de la revue.
- **Aucune table de coque, aucune table de bouclier de défense.** La coque se
  déduit du coût ; les boucliers de la défense ne servent pas, puisque les
  vaisseaux du camarade ne tirent presque rien.

### Un type de vaisseau à la fois

Un `<select>` sur `SHIPS` et un nombre, pas la grille de quatorze champs de la
carte Flotte. Un tir de lune se fait d'un seul type. Une flotte mélangée
demanderait la grille, et un commentaire `ponytail:` le dira à l'endroit du
calcul.

## Ce qui reste au constructeur

- **La formulation exacte des notes**, et la place des avertissements dans la
  carte. Le texte ci-dessus est une maquette, pas une maquette à copier.
- **Les dix coûts de coques se relisent sur le wiki avant d'être posés.** Le
  recoupement de `col` avec `COL_SHIP_COST` vaut pour une ligne, pas pour dix.
- **Si le plancher à 100 000 est dur.** La revue dit « plus de 100 000 » ; le
  wiki se lit aussi comme une chance linéaire dès le premier débris. Le
  copilote suit la revue et affiche zéro en dessous, ce qui ne peut que
  sous-promettre. À corriger si un tir réel dit le contraire.
- **Les tests**, dans `test/run.js` : un tir de 100 000 de débris donne 1 % ;
  un tir de 3 M donne 20 % et non 30 ; un tir de 99 000 donne zéro ; la chance
  par ressource dépensée est la même à 100 000 et à 2 M ; une planète dont
  `p.defs` est `null` ne rend aucun verdict de défense ; la coque d'une pièce
  de `DEF` vaut bien son `c[0] + c[1]` pour les huit.
