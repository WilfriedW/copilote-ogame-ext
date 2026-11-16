# Copilote OGame — La tournée suit la tuile

Document de conception, 16 novembre 2026. Petit changement.

## Intention

Monter un même bâtiment sur toutes ses planètes est une corvée de
navigation, pas de décision. Le joueur sait déjà ce qu'il veut : il monte
ses chantiers spatiaux. Ce qui le fatigue est le trajet — lancer ici,
retrouver la planète suivante, retrouver la page, retrouver la tuile,
lancer, recommencer.

Le copilote sait déjà quoi surligner sur chaque planète
(`app.js:445`, `content.js:405`), et il sait les niveaux de toutes les
planètes qu'il a vues. Il ne sait pas encore les mettre côte à côte au
moment où le joueur en a besoin : dans la page du jeu, la tuile ouverte.

**La tournée est définie par la tuile regardée.** Le joueur ouvre
Chantier spatial sur une planète ; une barre lui montre la même tuile sur
toutes ses autres planètes, et un clic l'y emmène, tuile déjà ouverte.

## Objectifs

- Atteindre la même tuile sur une autre planète en un clic, sans quitter
  le jeu.
- Savoir avant de cliquer : le niveau de là-bas, le niveau suivant, si la
  file est libre, si le stock paie.
- N'ouvrir aucune planète pour rien.

## Non-objectifs

- Cliquer « Améliorer » à la place du joueur.
- Les tournées de vaisseaux et de défense : ce sont des comptes, pas des
  niveaux, et la page du chantier a sa propre forme. Plus tard, si la
  barre fait ses preuves sur les bâtiments.
- Les recherches : une seule file pour tout l'empire, donc pas de tournée.
- Toucher au panneau latéral, sauf la donnée qu'il publie.

## Anti-objectifs

Échecs, même si le code marche :

- Une planète absente de la barre. Un trou se lit « rien à faire là-bas »,
  et c'est faux dès qu'il veut dire « je ne sais pas ».
- Un niveau annoncé comme lu sur le jeu alors qu'il date de la dernière
  visite. Une planète dont le niveau est inconnu porte une pastille **sans
  niveau**, jamais un niveau 0.
- Une barre qui reste affichée quand elle n'a rien à dire.

## Contraintes

- **Un lien, pas un robot** (`app.js:217`). OGame interdit
  l'automatisation ; la barre pose des liens, le joueur clique dans le jeu.
- `cp=` est le seul moyen de choisir la planète. Une planète que le jeu
  n'a pas encore nommée n'a pas de `gid` : pas de pastille (`app.js:283`).
- `openTech=` existe dans les URL du jeu (`content.js:70`) : le lien peut
  donc ouvrir la tuile lui-même. C'est ce qui fait tomber le compte à
  **deux clics par planète** — la pastille, puis « Améliorer ».
- Le faux DOM de `test/page.js` lève sur un sélecteur inconnu : tout
  nouveau sélecteur de `content.js` demande sa route.
- Le panneau ne connaît que ce qu'il a visité. La barre hérite de cette
  limite et la dit (anti-objectifs).

## Approches

| | Ce que ça donne | Pourquoi pas |
| --- | --- | --- |
| **Barre dans le jeu, tournée = tuile regardée** | retenue | — |
| Barre dans le jeu, tournée = plan du copilote | quasi gratuit, les indices sont déjà publiés | envoie monter du Métal chez l'une et du Labo chez l'autre : ce n'est pas une tournée |
| Vue « Chantiers » dans le panneau | plus petit diff, tout existe (`VIEWS`, `data-go`, `data-launch`) | impose l'aller-retour panneau ↔ jeu à chaque planète, l'inverse du besoin |
| Le copilote clique | seul vrai gain en clics | automatisation interdite, et tue le principe du projet |

## Ce qui est décidé

**D'où vient la tuile.** `openTech` de l'URL courante ; à défaut, la
dernière tuile cliquée dans cette page (écoute des clics sur
`li.technology[data-technology]`, rien n'est écrit dans la page). Sans
tuile en main, pas de barre.

**Le lien d'une pastille.**
`?page=ingame&component=<composant courant>&cp=<gid>&openTech=<tuile>` —
la même page, la même tuile, l'autre planète.

**Ce qu'une pastille dit.** `Nom · 6 → 7`, puis son état :

| État | Rendu |
| --- | --- |
| prête | normale |
| file occupée | grisée, fin de file en hh:mm |
| stock court | grisée, ce qui manque |
| planète courante | marquée, pas un lien |
| niveau inconnu | `Nom · →`, normale |

Une pastille grisée reste cliquable : c'est un état, pas une interdiction.

**Placement.** Au-dessus de la liste des tuiles, inséré avant le `ul` qui
porte la première `li.technology` — aucun identifiant du jeu n'est
supposé.

**Nouvelle donnée publiée** par `gameSkin()` (`app.js:512`), à côté de
`planHints` :

```
tour: { [gid]: { n, b: {[tuile]: niveau}, cost: {[tuile]: [m,c,d]},
                 bq, lfq, st: [m,c,d] } }
```

`b` et `cost` couvrent les bâtiments (`B`) et les bâtiments de forme de
vie (`p.lf`). `bq` pour les bâtiments, `lfq.lfbuilding` pour les formes de
vie : le chantier spatial est un bâtiment, sa file est `bq`. `sq` ne sert
pas ici, les vaisseaux étant hors sujet.

**La barre s'efface** quand aucune tuile n'est en main, ou quand moins de
deux planètes portent cette tuile.

## Laissé au constructeur

- L'ancrage DOM exact et les routes à ajouter dans `test/page.js`.
- Le style de la barre, dans le bloc `STYLE` existant de `content.js`,
  même bleu que `copilote-tag`.
- État écrit sur la pastille ou dans son `title` — ce qui tient dans la
  largeur.
- Deux vérifications : la donnée `tour` dans `test/run.js` (une planète à
  file occupée est marquée, une planète sans `gid` est absente) et la
  barre dans `test/page.js` (trois planètes connues, tuile ouverte → deux
  liens plus la planète courante marquée).

## Après revue (16 novembre 2026)

La revue de branche a renversé trois décisions écrites plus haut, et corrigé un
oubli. Ce qui suit l'emporte sur les sections précédentes.

- **Le clic passe devant `openTech`.** « D'où vient la tuile » disait l'inverse.
  Arrivé par une pastille, un joueur qui ouvre une autre tuile regarde cette
  autre tuile : la barre la suit. Figée sur la précédente, elle affichait les
  niveaux d'un bâtiment dont plus rien à l'écran ne parlait.
- **La file se dit en temps restant, pas en heure du jour.** « file jusqu'à
  18:17 » se lit aujourd'hui, même quand la file finit demain.
- **Une planète que la synchro vient de révéler ne publie aucun niveau.** Le jeu
  nomme toutes les planètes dès la première page lue, mais ne dit les niveaux
  que de celle qu'on regarde : le zéro par défaut tombait droit dans
  l'anti-objectif « jamais un niveau 0 ». Elle porte donc une pastille sans
  niveau jusqu'à la première lecture, la première saisie à la main, ou un import
  d'empire.
- **Les recherches de forme de vie ont leur propre file.** 112xx se construit
  dans `lfresearch`, pas dans `lfbuilding` : la barre lit désormais la bonne, et
  le relevé publie les deux.

Reste à vérifier dans le jeu, faute de pouvoir l'éprouver hors ligne : que
`openTech` ouvre bien la tuile sur les quatre pages à tuiles, et que la barre se
pose au-dessus de la liste et non au-dessus d'un encadré de production.
