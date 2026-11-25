# Copilote OGame — La campagne de lune suit d'un poste à l'autre

Document de conception, 24 novembre 2026. Petit changement.

## Intention

Le mode lune a été livré sans synchronisation, et c'est une correction de
dernière minute qui l'a retirée : `lune.tirs` est indexé par identifiant de
planète, et ces identifiants sont tirés au sort sur chaque machine
(`newPlanet`, `migratePlanetIds`). Envoyé tel quel, le paquet faisait évacuer
la mauvaise planète sur le second poste et annonçait 0 %.

Le joueur joue sur deux postes et une campagne dure des jours. Il veut que son
heure d'impact, son compteur de tirs et sa dette le suivent. Le dépôt sait déjà
faire exactement ça pour ses priorités et son centre : `prioOut` / `prioIn`
traduisent pid→gid et retour (`app.js:5916`), et `sy:prio` n'est envoyé que si
toutes ses entrées portent un identifiant de jeu (`app.js:5942`).

**Ce que la conception ajoute à la demande :** `S.moonCalc` ne se synchronise
pas non plus, et le mode y lit la planète visée (`moonPlanete`) et le nombre de
vaisseaux. Synchroniser `lune` seul laisserait le second poste viser la
mauvaise planète et annoncer 0 % — le même défaut, à moitié réparé. C'est donc
la **campagne entière** qui voyage.

## Objectifs

- L'heure d'impact, le compteur de tirs par planète, la dette et l'interrupteur
  traversent d'un poste à l'autre.
- La planète visée et les paramètres du tir — nombre, vaisseau, Bouclier du
  camarade, chance visée — traversent avec, puisque le mode les lit.
- Les identifiants de planète sont traduits dans les deux sens, comme pour les
  priorités.

## Non-objectifs

- **Synchroniser le reste de `moonCalc`** au-delà de ce que le mode lit. Rien
  d'autre n'y vit.
- **Synchroniser `fleetCalc` et `colo`.** Ce sont des calculatrices d'un coup,
  pas des opérations qui durent ; la documentation le dit déjà.
- **Fusionner deux campagnes divergentes.** Le dernier poste qui écrit gagne,
  comme pour tout le reste de la synchronisation.

## Anti-objectifs

- **Appliquer une campagne qui parle d'une planète que ce poste ne connaît
  pas.** C'est exactement le défaut qu'on répare : la carte envoyait évacuer
  une planète tirée du repli `centreIndex()`.
- **Envoyer un paquet à moitié traduit**, qu'un poste recevrait en croyant le
  comprendre.
- **Perdre un compteur** parce qu'une planète n'a pas encore d'identifiant de
  jeu ici : l'entrée attend, elle ne s'efface pas.

## Contraintes

- `gidDe(pid)` rend `null` pour une planète que le jeu n'a pas encore nommée ;
  `pidDe(gid)` rend `null` pour une planète que ce poste n'a pas relevée.
- `syncApply` compare au JSON avant d'écrire (`app.js:5967`) : un paquet
  identique ne doit pas provoquer de rendu.
- `sainEtat()` passe après l'écriture des clés simples.
- Lecture seule, et aucun chiffre affiché sans sa source.

## Approches

| | Ce que ça donne | Pourquoi pas |
| --- | --- | --- |
| **Traduire pid↔gid, sur le patron de `prioOut`/`prioIn`** | retenue | — |
| Remettre `lune` dans `SYNC_KEYS` tel quel | une ligne | c'est le défaut qu'on répare |
| Indexer `tirs` par coordonnées plutôt que par identifiant | pas de traduction | les coordonnées changent (déménagement, abandon), et le glossaire interdit de désigner une planète par elles |
| Ne synchroniser que `impact` et `rendu`, qui ne nomment aucune planète | le plus simple | le compteur resterait divergent et la planète visée fausse : la moitié qui compte ne voyagerait pas |

## Ce qui est décidé

**Deux fonctions, sur le patron exact de `prioOut` / `prioIn`.**

`luneOut()` compose le paquet : `{on, impact, rendu, tirs: {[gid]: n}, cible,
n, ship, bou, viser}`, où `cible` est le gid de la planète visée. Il n'est
**envoyé que si** la planète visée et toutes les planètes de `tirs` ont un gid
— la même garde que `sy:prio`.

`luneIn(p)` traduit en sens inverse. **Si `cible` ne se résout pas sur ce
poste, rien n'est appliqué** : une campagne qui parle d'une planète inconnue
ici est précisément ce qui a produit le défaut. Les entrées de `tirs` dont le
gid ne se résout pas sont laissées de côté plutôt que devinées.

**L'accroche** suit celle du centre : `luneOut()` dans `syncOut`, et dans
`syncApply` une ligne qui n'écrit que si quelque chose change, après
`sainEtat()`.

**`lune` ne retourne pas dans `SYNC_KEYS`** : le paquet est composé à la main,
comme `prio` et `centre`.

## Ce qui reste au constructeur

- Le nom exact des champs du paquet.
- Si `on` doit voyager — je dis oui : un mode allumé décrit la même campagne des
  deux côtés, et l'éteindre d'un poste doit l'éteindre partout.
- Les tests dans `test/run.js` : une campagne complète fait l'aller-retour ;
  une planète sans gid empêche l'envoi ; un paquet dont la cible est inconnue
  ici n'écrit rien ; un paquet identique ne déclenche aucun changement ; un
  `tirs` portant un gid inconnu n'efface pas les autres.
