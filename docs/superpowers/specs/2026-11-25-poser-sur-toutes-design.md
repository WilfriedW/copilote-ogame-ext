# Copilote OGame — Poser un niveau visé sur toutes les planètes

Document de conception, 25 novembre 2026. Petit changement.

## Intention

Le joueur veut « mine de métal 43 » sur tout l'empire. Aujourd'hui il doit le
poser dix fois : un clic droit par tuile dans le jeu, ou dix volets à déplier
dans Empire. Le geste est le bon, c'est sa répétition qui coûte.

Une carte pose le même niveau sur les planètes qu'il coche, d'un bouton. Le
clic droit ne bouge pas : il reste la correction d'une planète, posée là où le
joueur la voit.

## Ce qui existe déjà et ne change pas

- La carte **Recherches et niveaux visés** est déjà sur la page Empire, et une
  recherche ne porte pas de planète : `prios()` la range sous le centre
  (`labPlanet`, app.js:1158). Le labo est sur HB, HB est coché « Centre » :
  « je ne cherche que depuis HB » est déjà vrai. Rien à faire pour les
  recherches, elles n'entrent pas dans cette carte.
- Le clic droit pose déjà bâtiments **et** recherches (content.js:2628).
- Une priorité reste par planète, et seule la première posée sur une planète
  agit (`prioOf`). La carte n'invente rien : elle écrit N priorités d'un coup,
  par le même `prioPose` que le clic droit.

## Approches

**Une règle qui vit** — « métal 43 partout sauf la logistique » resterait vraie,
une colonie neuve en hériterait. Écartée : elle crée une deuxième source de
vérité à côté de ce que le clic droit a posé, et il faudrait trancher qui gagne
sur une planète où les deux parlent. Le joueur a demandé à garder le clic droit ;
il doit rester le dernier mot.

**Un remplissage en une fois** — retenue. La carte coche, écrit, et s'efface :
après, chaque planète vit sa vie comme aujourd'hui. Rien de neuf dans le moteur,
aucune ambiguïté. Le prix : passer de 43 à 45 veut dire repasser par la carte.

## Ce que la carte montre

En haut de l'onglet **Empire**, au-dessus de la liste des planètes — les champs
par planète sont sur cette page, Outils garde les calculettes.

```
┌─ Poser sur toutes les planètes ───────────────────────┐
│  Bâtiment [ Mine de métal ▾ ]   Niveau visé [ 43 ]    │
│                                                        │
│  ☑ HB           1:140:8    métal 38 → 43              │
│  ☑ Colo 2       1:140:9    métal 41 → 43              │
│  ☐ Logistique   2:55:4     métal 12                   │
│  ☑ Colo 4       1:201:6    métal 45 · déjà au-dessus  │
│                                                        │
│              [ Poser sur 2 planètes ]                  │
└────────────────────────────────────────────────────────┘
```

- Une ligne par planète, avec son niveau actuel et ce que la pose ferait. Le
  joueur voit avant de cliquer, il ne pose pas en aveugle.
- Une planète déjà au niveau ou au-dessus le dit et ne compte pas : `prioPose`
  retire une priorité qu'on « vise » sans rien demander, la carte le montre
  plutôt que de laisser croire.
- Le bouton dit combien de planètes il touche, et rien d'autre ne s'écrit.
- Les planètes décochées sont retenues **par bâtiment** : la logistique reste
  décochée pour la mine de métal au passage suivant, sans l'être pour le labo.
  C'est tout le sujet du joueur — l'oubli le lui ferait refaire à chaque fois.

## Non-buts

- Les recherches. Elles n'ont pas de planète.
- Les formes de vie. Même raison que `priosLf` : elles se posent depuis leur page.
- Un palier `puis`. Le clic droit le pose déjà, la carte ne pose qu'un niveau.
- Défaire la pose d'un bouton. Les priorités restent effaçables une par une, là
  où elles sont.

## Contraintes

- `prioPose` est le seul écrivain, pour que les deux chemins ne divergent pas.
- Une planète jamais relevée a un niveau actuel inconnu : elle s'affiche quand
  même, la ligne dit ce qu'elle sait.

## Laissé au bâtisseur

La forme exacte de la mémoire des décochées dans `S`, et la place de la carte
dans le rendu d'Empire.
